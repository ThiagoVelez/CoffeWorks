// Relaciones: diagrama entidad-relación con tablas que se mueven arrastrando,
// líneas entre los campos relacionados y creación de relaciones (1:N, 1:1 y
// muchos a muchos con tabla intermedia).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Key, Link2, X, LayoutGrid, ZoomIn, ZoomOut } from "lucide-react";
import type { ColumnDraft, RefAction, Schema } from "../types";
import { CoffeeDb } from "../services/engine";
import { explain } from "../services/doctor";
import { askConfirm, showMessage, toast } from "./Dialogs";

interface RelationsProps {
  db: CoffeeDb;
  schema: Schema;
  onChanged: () => void;
  pending?: { child: string; column: string; parent: string } | null;
  onPendingHandled?: () => void;
}

type Layout = Record<string, { x: number; y: number }>;

const BOX_W = 210;
const HEADER_H = 30;
const ROW_H = 22;

interface Draft {
  child: string;
  column: string;
  parent: string;
  to: string;
  kind: "1n" | "11" | "nm";
  onDelete: RefAction;
  junction: string;
  extras: boolean;
}

export const RelationsView: React.FC<RelationsProps> = ({ db, schema, onChanged, pending, onPendingHandled }) => {
  const [layout, setLayout] = useState<Layout>(() => db.getMeta<Layout>("layout", {}));
  const [zoom, setZoom] = useState(1);
  const [dialog, setDialog] = useState<Draft | null>(null);
  const [link, setLink] = useState<{ table: string; column: string; x: number; y: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ table: string; dx: number; dy: number } | null>(null);

  // Posición automática para las tablas que aún no tienen
  const positions = useMemo(() => {
    const next: Layout = { ...layout };
    let i = 0;
    for (const t of schema.tables) {
      if (!next[t.name]) {
        next[t.name] = { x: 40 + (i % 4) * 260, y: 40 + Math.floor(i / 4) * 280 };
      }
      i++;
    }
    return next;
  }, [layout, schema]);

  useEffect(() => {
    if (!pending) return;
    const parent = schema.tables.find((t) => t.name === pending.parent);
    setDialog({
      child: pending.child,
      column: pending.column,
      parent: pending.parent,
      to: parent?.columns.find((c) => c.pk)?.name || "id",
      kind: "1n",
      onDelete: "RESTRICT",
      junction: "",
      extras: true,
    });
    onPendingHandled?.();
  }, [pending, schema, onPendingHandled]);

  const saveLayout = (next: Layout) => {
    setLayout(next);
    try {
      db.setMeta("layout", next);
      onChanged();
    } catch {
      // Base de solo lectura
    }
  };

  const toLocal = (clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    const el = areaRef.current;
    if (!rect || !el) return { x: 0, y: 0 };
    return { x: (clientX - rect.left + el.scrollLeft) / zoom, y: (clientY - rect.top + el.scrollTop) / zoom };
  };

  const columnAnchor = (table: string, column: string, side: "left" | "right") => {
    const p = positions[table];
    const t = schema.tables.find((x) => x.name === table);
    const index = Math.max(0, t?.columns.findIndex((c) => c.name === column) ?? 0);
    return { x: p.x + (side === "right" ? BOX_W : 0), y: p.y + HEADER_H + index * ROW_H + ROW_H / 2 };
  };

  const lines = schema.tables.flatMap((t) =>
    t.foreignKeys
      .filter((f) => positions[f.table])
      .map((f) => {
        const childRight = positions[t.name].x < positions[f.table].x;
        const a = columnAnchor(t.name, f.column, childRight ? "right" : "left");
        const b = columnAnchor(f.table, f.to || schema.tables.find((x) => x.name === f.table)?.columns.find((c) => c.pk)?.name || "", childRight ? "left" : "right");
        const dx = Math.max(40, Math.abs(b.x - a.x) / 2) * (childRight ? 1 : -1);
        const unique = t.columns.find((c) => c.name === f.column)?.unique;
        return { key: `${t.name}.${f.column}`, d: `M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`, a, b, label: unique ? "1:1" : "N:1", child: t.name, column: f.column, parent: f.table };
      })
  );

  const autoLayout = () => {
    // Las tablas principales (sin relaciones salientes) a la izquierda
    const level = new Map<string, number>();
    const depth = (name: string, seen = new Set<string>()): number => {
      if (level.has(name)) return level.get(name) as number;
      if (seen.has(name)) return 0;
      seen.add(name);
      const t = schema.tables.find((x) => x.name === name);
      const d = t && t.foreignKeys.length ? 1 + Math.max(...t.foreignKeys.map((f) => depth(f.table, seen))) : 0;
      level.set(name, d);
      return d;
    };
    schema.tables.forEach((t) => depth(t.name));
    const columns = new Map<number, number>();
    const next: Layout = {};
    for (const t of schema.tables) {
      const l = level.get(t.name) || 0;
      const row = columns.get(l) || 0;
      next[t.name] = { x: 40 + l * 290, y: 40 + row };
      columns.set(l, row + HEADER_H + t.columns.length * ROW_H + 50);
    }
    saveLayout(next);
  };

  const create = () => {
    if (!dialog) return;
    try {
      if (dialog.kind === "nm") {
        const a = schema.tables.find((t) => t.name === dialog.child);
        const b = schema.tables.find((t) => t.name === dialog.parent);
        const pkA = a?.columns.find((c) => c.pk)?.name || "id";
        const pkB = b?.columns.find((c) => c.pk)?.name || "id";
        const name = dialog.junction.trim() || `${dialog.child}_${dialog.parent}`;
        const colA = `${dialog.child.replace(/s$/, "")}_id`;
        const colB = `${dialog.parent.replace(/s$/, "")}_id`;
        const mk = (n: string, type: ColumnDraft["type"], pk = false): ColumnDraft => ({ key: n, original: null, name: n, type, pk, notNull: !pk, unique: false, defaultValue: "" });
        const extras: ColumnDraft[] = dialog.extras
          ? [
              { ...mk("fecha_asignacion", "date"), defaultValue: "CURRENT_TIMESTAMP" },
              { ...mk("estado", "shortText"), defaultValue: "ACTIVO" },
            ]
          : [];
        db.createTable(name, [mk("id", "autonumber", true), mk(colA, "integer"), mk(colB, "integer"), ...extras], [
          { column: colA, table: dialog.child, to: pkA, onDelete: "CASCADE", onUpdate: "CASCADE" },
          { column: colB, table: dialog.parent, to: pkB, onDelete: "CASCADE", onUpdate: "CASCADE" },
        ]);
        toast(`Tabla intermedia «${name}» creada`);
      } else {
        db.addRelationship({ child: dialog.child, column: dialog.column, table: dialog.parent, to: dialog.to, onDelete: dialog.onDelete, onUpdate: "CASCADE" }, dialog.kind === "11");
        toast("Relación creada");
      }
      setDialog(null);
      onChanged();
    } catch (err) {
      void showMessage("No se pudo crear la relación", explain(err));
    }
  };

  const remove = async (child: string, column: string) => {
    const ok = await askConfirm({ title: "Eliminar la relación", message: `¿Quitar la relación de «${child}.${column}»? Los datos no se borran.`, confirmLabel: "Quitar", danger: true });
    if (!ok) return;
    try {
      db.removeRelationship(child, column);
      onChanged();
    } catch (err) {
      void showMessage("No se pudo quitar la relación", explain(err));
    }
  };

  const width = Math.max(1200, ...Object.values(positions).map((p) => p.x + BOX_W + 80));
  const height = Math.max(700, ...schema.tables.map((t) => (positions[t.name]?.y || 0) + HEADER_H + t.columns.length * ROW_H + 80));
  const field = "w-full h-9 px-2 text-[13px] rounded-lg border border-[#e2cfd1] outline-none focus:border-[#9b111e] bg-white";
  const childTable = schema.tables.find((t) => t.name === dialog?.child);
  const parentTable = schema.tables.find((t) => t.name === dialog?.parent);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#fcf8f8]">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[#ead9db] bg-white">
          <button
            type="button"
            data-new-relation
            onClick={() =>
              schema.tables.length >= 2 &&
              setDialog({
                child: schema.tables[1].name,
                column: schema.tables[1].columns.find((c) => !c.pk)?.name || schema.tables[1].columns[0]?.name || "",
                parent: schema.tables[0].name,
                to: schema.tables[0].columns.find((c) => c.pk)?.name || schema.tables[0].columns[0]?.name || "",
                kind: "1n",
                onDelete: "RESTRICT",
                junction: "",
                extras: true,
              })
            }
            disabled={schema.tables.length < 2}
            className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: "#9b111e" }}
          >
            <Plus size={13} /> Nueva relación
          </button>
          <button type="button" onClick={autoLayout} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0]">
            <LayoutGrid size={13} /> Ordenar
          </button>
          <span className="text-[11px] text-[#9a8285]">Arrastra el punto rojo de un campo hasta el campo de otra tabla para relacionarlos.</span>
          <div className="flex-1" />
          <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} className="p-1.5 rounded hover:bg-[#fbeef0]">
            <ZoomOut size={15} />
          </button>
          <span className="text-[12px] font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} className="p-1.5 rounded hover:bg-[#fbeef0]">
            <ZoomIn size={15} />
          </button>
        </div>

        <div
          ref={areaRef}
          className="flex-1 overflow-auto relative"
          style={{ backgroundImage: "radial-gradient(#e8d8da 1px, transparent 1px)", backgroundSize: `${20 * zoom}px ${20 * zoom}px` }}
          onPointerMove={(e) => {
            const p = toLocal(e.clientX, e.clientY);
            if (dragRef.current) {
              const d = dragRef.current;
              setLayout((prev) => ({ ...prev, [d.table]: { x: Math.max(0, Math.round(p.x - d.dx)), y: Math.max(0, Math.round(p.y - d.dy)) } }));
            }
            if (link) setPointer(p);
          }}
          onPointerUp={(e) => {
            if (dragRef.current) {
              dragRef.current = null;
              saveLayout({ ...positions, ...layout });
            }
            if (link) {
              const target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-er-column]");
              const [table, column] = (target?.dataset.erColumn || "").split("\u0000");
              if (table && column && table !== link.table) {
                const targetInfo = schema.tables.find((t) => t.name === table);
                const targetCol = targetInfo?.columns.find((c) => c.name === column);
                // Si se suelta sobre la clave principal, la tabla de origen es la «hija»
                const toPk = Boolean(targetCol?.pk);
                setDialog({
                  child: toPk ? link.table : table,
                  column: toPk ? link.column : column,
                  parent: toPk ? table : link.table,
                  to: toPk ? column : link.column,
                  kind: "1n",
                  onDelete: "RESTRICT",
                  junction: "",
                extras: true,
                });
              }
              setLink(null);
              setPointer(null);
            }
          }}
        >
          <div className="relative origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
            <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
              <defs>
                <marker id="one" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M5 0 L5 10" stroke="#9b111e" strokeWidth="2" />
                </marker>
              </defs>
              {lines.map((l) => (
                <g key={l.key}>
                  <path d={l.d} stroke="#9b111e" strokeWidth={2} fill="none" opacity={0.75} />
                  <circle cx={l.a.x} cy={l.a.y} r={4} fill="#9b111e" />
                  <rect x={l.b.x - 3} y={l.b.y - 6} width={6} height={12} fill="#9b111e" />
                  <text x={(l.a.x + l.b.x) / 2} y={(l.a.y + l.b.y) / 2 - 6} fontSize="10" fill="#6e0a16" textAnchor="middle">
                    {l.label}
                  </text>
                </g>
              ))}
              {link && pointer && <line x1={link.x} y1={link.y} x2={pointer.x} y2={pointer.y} stroke="#9b111e" strokeWidth={2} strokeDasharray="5 4" />}
            </svg>
            {schema.tables.map((t) => {
              const p = positions[t.name];
              return (
                <div
                  key={t.name}
                  data-er-table={t.name}
                  className="absolute bg-white rounded-lg shadow-md border border-[#e2cfd1] overflow-hidden select-none"
                  style={{ left: p.x, top: p.y, width: BOX_W }}
                >
                  <div
                    className="px-3 flex items-center justify-between text-white text-[12px] font-semibold cursor-move"
                    style={{ height: HEADER_H, background: "#9b111e" }}
                    onPointerDown={(e) => {
                      const local = toLocal(e.clientX, e.clientY);
                      dragRef.current = { table: t.name, dx: local.x - p.x, dy: local.y - p.y };
                    }}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="text-[10px] opacity-80 font-mono">{t.rowCount}</span>
                  </div>
                  {t.columns.map((c) => {
                    const isFk = t.foreignKeys.some((f) => f.column === c.name);
                    return (
                      <div
                        key={c.name}
                        data-er-column={`${t.name}\u0000${c.name}`}
                        className="group relative px-3 flex items-center gap-1.5 text-[11px] border-t border-[#f6eeef] hover:bg-[#fbeef0]"
                        style={{ height: ROW_H }}
                      >
                        {c.pk ? <Key size={10} className="text-[#c99a1e] shrink-0" /> : isFk ? <Link2 size={10} className="text-[#9b111e] shrink-0" /> : <span className="w-2.5" />}
                        <span className={`truncate ${c.pk ? "font-semibold" : ""}`}>{c.name}</span>
                        <span className="ml-auto text-[9px] text-[#b39a9d] font-mono truncate max-w-[70px]">{c.declared}</span>
                        <span
                          className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#9b111e] opacity-0 group-hover:opacity-100 cursor-crosshair"
                          title="Arrastra hasta otra tabla para relacionar"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const a = columnAnchor(t.name, c.name, "right");
                            setLink({ table: t.name, column: c.name, x: a.x, y: a.y });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {schema.tables.length === 0 && <div className="absolute left-10 top-10 text-[13px] text-[#7a6265]">Crea tablas para ver aquí sus relaciones.</div>}
          </div>
        </div>
      </div>

      <aside className="w-72 shrink-0 border-l border-[#ead9db] bg-white overflow-y-auto">
        <div className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#9b111e] border-b border-[#f1e6e7]">Relaciones ({lines.length})</div>
        {lines.length === 0 && <p className="p-3 text-[12px] text-[#9a8285]">Todavía no hay relaciones.</p>}
        {lines.map((l) => {
          const fk = schema.tables.find((t) => t.name === l.child)?.foreignKeys.find((f) => f.column === l.column);
          return (
            <div key={l.key} className="group px-3 py-2 border-b border-[#f6eeef] text-[12px]" data-relation={l.key}>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold truncate">{l.child}.{l.column}</span>
                <button type="button" className="ml-auto opacity-0 group-hover:opacity-100 text-[#9b111e]" onClick={() => void remove(l.child, l.column)} title="Quitar relación">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="text-[#7a6265]">
                → {l.parent}.{fk?.to} · {l.label}
              </div>
              <div className="text-[10px] text-[#a08a8d]">Al borrar: {fk?.onDelete}</div>
            </div>
          );
        })}
      </aside>

      {dialog && (
        <div data-modal-open className="fixed inset-0 z-[99990] bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setDialog(null)}>
          <div className="w-[520px] bg-white rounded-2xl shadow-2xl text-[#2a1a1c] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f1e6e7]">
              <h2 className="text-[15px] font-semibold">Relación entre tablas</h2>
              <button type="button" onClick={() => setDialog(null)} className="p-1.5 rounded-lg hover:bg-[#fbeef0]">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3 text-[13px]">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ["1n", "Uno a varios"],
                    ["11", "Uno a uno"],
                    ["nm", "Varios a varios"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDialog({ ...dialog, kind: id })}
                    className={`h-9 rounded-lg text-[12px] font-semibold border ${dialog.kind === id ? "text-white border-transparent" : "border-[#e2cfd1] hover:bg-[#fbeef0]"}`}
                    style={dialog.kind === id ? { background: "#9b111e" } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {dialog.kind === "nm" ? (
                <>
                  <p className="text-[12px] text-[#6e5559]">
                    Se crea una tabla intermedia con un campo para cada tabla (por ejemplo, alumnos ↔ cursos se guarda en «alumnos_cursos»).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["child", "parent"] as const).map((k) => (
                      <select key={k} className={field} value={dialog[k]} onChange={(e) => setDialog({ ...dialog, [k]: e.target.value })}>
                        {schema.tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                  <input className={field} placeholder={`${dialog.child}_${dialog.parent}`} value={dialog.junction} onChange={(e) => setDialog({ ...dialog, junction: e.target.value })} />
                  <div className="rounded-lg bg-[#fdf6f6] border border-[#f1e6e7] px-3 py-2 text-[12px] font-mono text-[#5a3a3e]">
                    <div className="font-sans font-semibold text-[11px] text-[#7a6265] mb-1">Campos que se crearán</div>
                    <div>• id (autonumérico)</div>
                    <div className="text-[#9b111e]">
                      • {dialog.child.replace(/s$/, "")}_id → {dialog.child}
                    </div>
                    <div className="text-[#9b111e]">
                      • {dialog.parent.replace(/s$/, "")}_id → {dialog.parent}
                    </div>
                    {dialog.extras && (
                      <>
                        <div>• fecha_asignacion (fecha y hora)</div>
                        <div>• estado (texto, ACTIVO)</div>
                      </>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" className="accent-[#9b111e]" checked={dialog.extras} onChange={(e) => setDialog({ ...dialog, extras: e.target.checked })} data-junction-extras />
                    Incluir campos adicionales (fecha de asignación y estado)
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[#7a6265]">Tabla relacionada («varios»)</span>
                      <select className={field} value={dialog.child} onChange={(e) => setDialog({ ...dialog, child: e.target.value, column: schema.tables.find((t) => t.name === e.target.value)?.columns[0]?.name || "" })}>
                        {schema.tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <select className={field} value={dialog.column} onChange={(e) => setDialog({ ...dialog, column: e.target.value })} data-rel-column>
                        {childTable?.columns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="pb-2 text-[#9b111e] font-bold">→</span>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[#7a6265]">Tabla principal («uno»)</span>
                      <select className={field} value={dialog.parent} onChange={(e) => setDialog({ ...dialog, parent: e.target.value, to: schema.tables.find((t) => t.name === e.target.value)?.columns.find((c) => c.pk)?.name || "" })}>
                        {schema.tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <select className={field} value={dialog.to} onChange={(e) => setDialog({ ...dialog, to: e.target.value })}>
                        {parentTable?.columns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                            {c.pk ? " (clave)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#7a6265]">Al borrar un registro de «{dialog.parent}»</span>
                    <select className={field} value={dialog.onDelete} onChange={(e) => setDialog({ ...dialog, onDelete: e.target.value as RefAction })}>
                      <option value="RESTRICT">Impedirlo si tiene registros relacionados</option>
                      <option value="CASCADE">Borrar también los registros relacionados</option>
                      <option value="SET NULL">Dejar vacío el campo en los registros relacionados</option>
                      <option value="NO ACTION">No hacer nada</option>
                    </select>
                  </label>
                  <p className="text-[11px] text-[#9a8285]">
                    La relación se comprueba al guardar: los valores de «{dialog.child}.{dialog.column}» deben existir en «{dialog.parent}.{dialog.to}».
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#f1e6e7] bg-[#fdf9f9]">
              <button type="button" onClick={() => setDialog(null)} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[#fbeef0]">
                Cancelar
              </button>
              <button type="button" onClick={create} data-create-relation className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white" style={{ background: "#9b111e" }}>
                Crear relación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
