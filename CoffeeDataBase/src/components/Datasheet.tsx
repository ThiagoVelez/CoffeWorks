// Hoja de datos: edita los registros de una tabla como en una hoja de cálculo.
// Doble clic (o Intro) edita una celda; la última fila sirve para añadir
// registros; los campos relacionados muestran una lista con los valores válidos.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Key, Link2, RefreshCw } from "lucide-react";
import type { ColumnInfo, TableInfo } from "../types";
import { CoffeeDb, coerce, formatCell, quoteId } from "../services/engine";
import { explain } from "../services/doctor";
import { askConfirm, showMessage, toast } from "./Dialogs";
import { SpellIndicator, useSpellCheck } from "../spell/useSpellCheck";

interface DatasheetProps {
  db: CoffeeDb;
  table: TableInfo;
  version: number;
  onChanged: () => void;
}

const PAGE = 100;

type Lookup = Map<string, { value: unknown; label: string }[]>;

export const Datasheet: React.FC<DatasheetProps> = ({ db, table, version, onChanged }) => {
  const [offset, setOffset] = useState(0);
  const [orderBy, setOrderBy] = useState<string | null>(null);
  const [desc, setDesc] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ rowid: number | "new"; column: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const columns = table.columns;
  const names = columns.map((c) => c.name);

  useEffect(() => {
    setOffset(0);
    setSelected(new Set());
    setEditing(null);
    setNewRow({});
    setOrderBy(null);
    setSearch("");
    setQuery("");
  }, [table.name]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search);
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const data = useMemo(() => {
    try {
      return db.page(table.name, { offset, limit: PAGE, orderBy, desc, search: query, columns: names });
    } catch (err) {
      return { rowids: [], rows: [], total: 0, error: explain(err) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, table, offset, orderBy, desc, query, version, tick]);

  // Corrector ortográfico: campos de texto de los registros visibles
  const fkColumns = useMemo(() => new Set(table.foreignKeys.map((f) => f.column)), [table]);
  const textColumns = columns.map((c, i) => ({ c, i })).filter(({ c }) => (c.type === "shortText" || c.type === "longText") && !fkColumns.has(c.name));
  const spell = useSpellCheck({
    mode: "model",
    segments: data.rows.flatMap((row, r) =>
      textColumns.flatMap(({ c, i }) => (typeof row[i] === "string" && row[i] ? [{ key: `${data.rowids[r]}:${c.name}`, text: row[i] as string, label: `Registro ${offset + r + 1} · ${c.name}` }] : []))
    ),
    onReveal: (err) => {
      const el = document.querySelector<HTMLElement>(`[data-cell="${CSS.escape(err.key)}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", inline: "nearest" });
    },
    onReplace: (err, replacement) => {
      const sep = err.key.indexOf(":");
      const rowid = Number(err.key.slice(0, sep));
      const column = err.key.slice(sep + 1);
      const r = (data.rowids as number[]).indexOf(rowid);
      const ci = columns.findIndex((c) => c.name === column);
      const current = r >= 0 && ci >= 0 ? String(data.rows[r][ci] ?? "") : "";
      try {
        db.updateCell(table.name, rowid, column, current.slice(0, err.start) + replacement + current.slice(err.end));
        onChanged();
        setTick((t) => t + 1);
      } catch (e) {
        void showMessage("No se pudo corregir", explain(e));
      }
    },
  });

  // Valores válidos de los campos relacionados (clave + campo descriptivo)
  const lookups: Lookup = useMemo(() => {
    const map: Lookup = new Map();
    for (const fk of table.foreignKeys) {
      try {
        const parent = db.tableInfo(fk.table);
        const label = parent.columns.find((c) => c.name !== fk.to && (c.type === "shortText" || c.type === "longText"));
        const rows = db.values(
          `SELECT ${quoteId(fk.to || "rowid")}${label ? `, ${quoteId(label.name)}` : ""} FROM ${quoteId(fk.table)} ORDER BY ${label ? quoteId(label.name) : 1} LIMIT 1000`
        );
        map.set(
          fk.column,
          rows.map((r) => ({ value: r[0], label: label ? `${r[0]} · ${r[1] ?? ""}` : String(r[0]) }))
        );
      } catch {
        // Tabla relacionada inexistente
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, table, version]);

  useEffect(() => {
    if (!editing) return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }, 0);
  }, [editing]);

  const refresh = () => setTick((t) => t + 1);

  const startEdit = (rowid: number | "new", column: ColumnInfo, current: unknown) => {
    if (column.autoIncrement) return;
    if (column.type === "binary") {
      toast("Los campos binarios no se editan en la hoja de datos", "info");
      return;
    }
    if (column.type === "boolean" && rowid !== "new") {
      try {
        db.updateCell(table.name, rowid, column.name, Number(current) ? 0 : 1);
        onChanged();
        refresh();
      } catch (err) {
        void showMessage("No se pudo guardar", explain(err));
      }
      return;
    }
    setEditing({ rowid, column: column.name });
    setDraft(rowid === "new" ? newRow[column.name] || "" : current === null || current === undefined ? "" : String(current));
  };

  const commit = useCallback(() => {
    if (!editing) return;
    const column = columns.find((c) => c.name === editing.column);
    if (!column) return;
    if (editing.rowid === "new") {
      setNewRow((prev) => ({ ...prev, [column.name]: draft }));
      setEditing(null);
      return;
    }
    try {
      const value = coerce(draft, column.type);
      db.updateCell(table.name, editing.rowid, column.name, value);
      onChanged();
      refresh();
      setEditing(null);
    } catch (err) {
      void showMessage("No se pudo guardar el cambio", explain(err));
    }
  }, [editing, draft, columns, db, table.name, onChanged]);

  const addRecord = () => {
    try {
      const values: Record<string, string | number | null> = {};
      for (const c of columns) {
        const raw = newRow[c.name];
        if (raw === undefined || raw === "") continue;
        values[c.name] = coerce(raw, c.type) as string | number | null;
      }
      db.insertRow(table.name, values);
      setNewRow({});
      onChanged();
      // Ir a la última página para ver el registro nuevo
      const total = Number(db.scalar(`SELECT COUNT(*) FROM ${quoteId(table.name)}`) || 0);
      if (!orderBy && !query) setOffset(Math.max(0, Math.floor((total - 1) / PAGE) * PAGE));
      refresh();
      toast("Registro añadido");
    } catch (err) {
      void showMessage("No se pudo añadir el registro", explain(err));
    }
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    const ok = await askConfirm({
      title: "Eliminar registros",
      message: `¿Eliminar ${selected.size} ${selected.size === 1 ? "registro" : "registros"} de «${table.name}»? No se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      db.deleteRows(table.name, [...selected]);
      setSelected(new Set());
      onChanged();
      refresh();
    } catch (err) {
      void showMessage("No se pudieron eliminar", explain(err));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setEditing(null);
    }
  };

  const editor = (column: ColumnInfo) => {
    const options = lookups.get(column.name);
    if (options) {
      return (
        <select
          ref={(el) => {
            inputRef.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          autoFocus
          className="w-full h-full px-1.5 text-[12px] outline-none bg-white ring-2 ring-[#9b111e]"
        >
          <option value="">(vacío)</option>
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        ref={(el) => {
            inputRef.current = el;
          }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        autoFocus
        type={column.type === "boolean" ? "text" : "text"}
        placeholder={column.type === "date" ? "AAAA-MM-DD" : ""}
        className="w-full h-full px-1.5 text-[12px] outline-none bg-white ring-2 ring-[#9b111e]"
      />
    );
  };

  const display = (column: ColumnInfo, value: unknown) => {
    if (column.type === "boolean") {
      return <input type="checkbox" readOnly checked={Boolean(Number(value))} className="accent-[#9b111e] pointer-events-none" />;
    }
    const options = lookups.get(column.name);
    if (options && value !== null) {
      const match = options.find((o) => String(o.value) === String(value));
      if (match) return match.label;
    }
    return formatCell(value, column.type);
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;
  const allSelected = data.rowids.length > 0 && data.rowids.every((id) => selected.has(id));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[#ead9db] bg-white">
        <div className="flex items-center gap-1.5 border border-[#e2cfd1] rounded-lg px-2 h-8 w-64 focus-within:border-[#9b111e]">
          <Search size={14} className="text-[#9a8285]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en la tabla" className="flex-1 text-[12px] outline-none" />
        </div>
        <button
          type="button"
          onClick={() => void deleteSelected()}
          disabled={!selected.size}
          className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0] disabled:opacity-40"
        >
          <Trash2 size={13} /> Eliminar{selected.size ? ` (${selected.size})` : ""}
        </button>
        <button type="button" onClick={refresh} title="Actualizar" className="h-8 w-8 rounded-lg flex items-center justify-center border border-[#e2cfd1] hover:bg-[#fbeef0]">
          <RefreshCw size={13} />
        </button>
        <div className="flex-1" />
        <SpellIndicator spell={spell} className="text-[12px]" />
        {spell.menu}
        <span className="text-[12px] text-[#7a6265]">
          {data.total.toLocaleString("es")} {data.total === 1 ? "registro" : "registros"}
        </span>
        <button type="button" disabled={page <= 1} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="p-1.5 rounded hover:bg-[#fbeef0] disabled:opacity-30">
          <ChevronLeft size={15} />
        </button>
        <span className="text-[12px] font-mono">
          {page} / {pages}
        </span>
        <button type="button" disabled={page >= pages} onClick={() => setOffset(offset + PAGE)} className="p-1.5 rounded hover:bg-[#fbeef0] disabled:opacity-30">
          <ChevronRight size={15} />
        </button>
      </div>

      {"error" in data && data.error && <div className="m-3 p-3 rounded-lg bg-[#fdecee] text-[12px] text-[#7a1520] whitespace-pre-line">{data.error}</div>}

      <div className="flex-1 overflow-auto bg-[#fcf8f8]">
        <table className="text-[12px] border-collapse min-w-full bg-white" data-datasheet={table.name}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-[#f7eced] border-b border-r border-[#ead9db] w-9 px-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(data.rowids))}
                  className="accent-[#9b111e]"
                  title="Seleccionar la página"
                />
              </th>
              {columns.map((c) => {
                const fk = table.foreignKeys.find((f) => f.column === c.name);
                return (
                  <th
                    key={c.name}
                    onClick={() => {
                      if (orderBy === c.name) setDesc(!desc);
                      else {
                        setOrderBy(c.name);
                        setDesc(false);
                      }
                    }}
                    className="bg-[#f7eced] text-[#4a2a2e] text-left font-semibold px-2.5 py-1.5 border-b border-r border-[#ead9db] whitespace-nowrap cursor-pointer select-none hover:bg-[#f1e0e2] min-w-[110px]"
                    title={`${c.declared || "sin tipo"}${c.notNull ? " · requerido" : ""}${c.unique ? " · único" : ""}${fk ? ` · relacionado con ${fk.table}` : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.pk && <Key size={11} className="text-[#c99a1e]" />}
                      {fk && <Link2 size={11} className="text-[#9b111e]" />}
                      {c.name}
                      {orderBy === c.name && (desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => {
              const rowid = data.rowids[r];
              const isSel = selected.has(rowid);
              return (
                <tr key={rowid} className={isSel ? "bg-[#fbe9eb]" : "hover:bg-[#fdf6f6]"}>
                  <td className="border-b border-r border-[#f1e6e7] px-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(rowid)) next.delete(rowid);
                          else next.add(rowid);
                          return next;
                        })
                      }
                      className="accent-[#9b111e]"
                    />
                  </td>
                  {columns.map((c, i) => {
                    const isEditing = editing?.rowid === rowid && editing.column === c.name;
                    const value = row[i];
                    return (
                      <td
                        key={c.name}
                        data-cell={`${rowid}:${c.name}`}
                        data-spell-key={!isEditing && typeof value === "string" && textColumns.some((t) => t.c.name === c.name) ? `${rowid}:${c.name}` : undefined}
                        onDoubleClick={() => startEdit(rowid, c, value)}
                        onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && startEdit(rowid, c, value)}
                        tabIndex={0}
                        className={`border-b border-r border-[#f1e6e7] h-7 ${isEditing ? "p-0" : "px-2.5"} whitespace-nowrap max-w-[320px] truncate outline-none focus:ring-1 focus:ring-inset focus:ring-[#9b111e] ${
                          typeof value === "number" && c.type !== "boolean" ? "text-right font-mono" : ""
                        } ${c.autoIncrement ? "text-[#9a8285]" : ""} ${c.type === "boolean" ? "text-center" : ""}`}
                      >
                        {isEditing ? editor(c) : display(c, value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Fila para añadir un registro */}
            <tr className="bg-[#fffdf5]" data-new-row>
              <td className="border-b border-r border-[#f1e6e7] text-center text-[#9b111e]">
                <Plus size={13} className="inline" />
              </td>
              {columns.map((c) => {
                const options = lookups.get(c.name);
                const value = newRow[c.name] ?? "";
                const set = (v: string) => setNewRow((prev) => ({ ...prev, [c.name]: v }));
                const cls = "w-full h-full px-2 text-[12px] bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#9b111e]";
                return (
                  <td key={c.name} className="border-b border-r border-[#f1e6e7] h-7 p-0">
                    {c.autoIncrement ? (
                      <span className="px-2.5 text-[#9a8285] italic">(automático)</span>
                    ) : c.type === "boolean" ? (
                      <div className="text-center">
                        <input type="checkbox" checked={value === "1"} onChange={(e) => set(e.target.checked ? "1" : "0")} className="accent-[#9b111e]" />
                      </div>
                    ) : options ? (
                      <select data-new-cell={c.name} value={value} onChange={(e) => set(e.target.value)} className={cls}>
                        <option value="">—</option>
                        {options.map((o) => (
                          <option key={String(o.value)} value={String(o.value)}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        data-new-cell={c.name}
                        value={value}
                        disabled={c.type === "binary"}
                        onChange={(e) => set(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addRecord()}
                        placeholder={c.type === "date" ? "AAAA-MM-DD" : c.notNull ? "requerido" : ""}
                        className={`${cls} placeholder:text-[#c9b3b6] placeholder:italic`}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <div className="px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={addRecord}
            data-add-record
            className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5"
            style={{ background: "#9b111e" }}
          >
            <Plus size={14} /> Añadir registro
          </button>
          <span className="text-[11px] text-[#9a8285]">Escribe en la fila amarilla y pulsa Intro o «Añadir registro». Doble clic en una celda para editarla.</span>
        </div>
      </div>
    </div>
  );
};
