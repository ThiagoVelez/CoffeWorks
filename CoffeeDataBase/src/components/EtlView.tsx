// ETL de semilleros: extrae las fichas de varias tablas (semillero,
// descripción y observaciones), las filtra, permite escribir observaciones
// en el registro original y guarda o exporta el resultado.

import React, { useEffect, useMemo, useState } from "react";
import { Play, Download, Save, Search, X, ChevronDown, ChevronUp, StickyNote, LayoutGrid, Table2, Filter } from "lucide-react";
import type { Schema } from "../types";
import { CoffeeDb, quoteId } from "../services/engine";
import { explain } from "../services/doctor";
import { uniqueTableName } from "../services/io";
import { askConfirm, showMessage, toast } from "./Dialogs";

interface EtlProps {
  db: CoffeeDb;
  schema: Schema;
  version: number;
  onChanged: () => void;
  onExport: (columns: string[], rows: unknown[][], name: string) => void;
}

interface Mapping {
  semillero: string;
  descripcion: string;
  observaciones: string;
}

interface EtlRecord {
  key: string;
  rowid: number;
  table: string;
  semillero: string;
  descripcion: string;
  observaciones: string;
}

const RELEVANT = /semiller|estudiante|investiga|observac|proyect/i;
const find = (cols: string[], test: RegExp) => cols.find((c) => test.test(c)) || "";

/** Columnas que el ETL reconoce automáticamente en cada tabla. */
export function detectMapping(columns: string[]): Mapping {
  return {
    semillero: find(columns, /semillero|grupo|programa/i),
    descripcion: find(columns, /descripcion|desc|detalle|resumen/i),
    observaciones: find(columns, /observac|comentario|nota|bitacora|retroalimenta/i),
  };
}

export const EtlView: React.FC<EtlProps> = ({ db, schema, version, onChanged, onExport }) => {
  const tables = schema.tables;
  const [selected, setSelected] = useState<string[]>(() => {
    const relevant = tables.filter((t) => RELEVANT.test(t.name)).map((t) => t.name);
    return relevant.length ? relevant : tables.slice(0, 1).map((t) => t.name);
  });
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [records, setRecords] = useState<EtlRecord[]>([]);
  const [message, setMessage] = useState("");
  const [semFilter, setSemFilter] = useState<string | null>(null);
  const [obsFilter, setObsFilter] = useState<"all" | "with" | "without">("all");
  const [tableFilter, setTableFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [tab, setTab] = useState<"cards" | "table">("cards");
  const [editing, setEditing] = useState<EtlRecord | null>(null);
  const [note, setNote] = useState("");

  const mappingOf = (table: string): Mapping => {
    if (mappings[table]) return mappings[table];
    const info = tables.find((t) => t.name === table);
    return detectMapping(info?.columns.map((c) => c.name) || []);
  };

  const run = () => {
    const out: EtlRecord[] = [];
    try {
      for (const table of selected) {
        const m = mappingOf(table);
        const cols = [m.semillero, m.descripcion, m.observaciones].map((c) => (c ? `${quoteId(c)}` : "NULL"));
        const rows = db.values(`SELECT rowid, ${cols.join(", ")} FROM ${quoteId(table)} LIMIT 5000`);
        for (const r of rows) {
          out.push({
            key: `${table}:${r[0]}`,
            rowid: Number(r[0]),
            table,
            semillero: m.semillero ? String(r[1] ?? "Sin semillero asignado") : `General (${table})`,
            descripcion: r[2] === null || r[2] === undefined ? "" : String(r[2]),
            observaciones: r[3] === null || r[3] === undefined ? "" : String(r[3]),
          });
        }
      }
      setRecords(out);
      setMessage(`ETL completado: ${out.length} registros extraídos de ${selected.length} ${selected.length === 1 ? "tabla" : "tablas"}.`);
    } catch (err) {
      setMessage(explain(err));
    }
  };

  // Se vuelve a ejecutar al cambiar las tablas, el mapeo o los datos
  useEffect(() => {
    if (selected.length) run();
    else setRecords([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mappings, version]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(
      (r) =>
        (!semFilter || r.semillero === semFilter) &&
        (!tableFilter || r.table === tableFilter) &&
        (obsFilter === "all" || (obsFilter === "with" ? r.observaciones.trim() !== "" : r.observaciones.trim() === "")) &&
        (!q || `${r.semillero} ${r.descripcion} ${r.observaciones} ${r.table}`.toLowerCase().includes(q))
    );
  }, [records, semFilter, tableFilter, obsFilter, search]);

  const semilleros = useMemo(() => {
    const counts = new Map<string, number>();
    records.forEach((r) => counts.set(r.semillero, (counts.get(r.semillero) || 0) + 1));
    return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  }, [records]);
  const withObs = records.filter((r) => r.observaciones.trim()).length;
  const grouped = useMemo(() => {
    const map = new Map<string, EtlRecord[]>();
    filtered.forEach((r) => map.set(r.semillero, [...(map.get(r.semillero) || []), r]));
    return [...map];
  }, [filtered]);

  const saveNote = async () => {
    if (!editing) return;
    try {
      let column = mappingOf(editing.table).observaciones;
      if (!column) {
        const ok = await askConfirm({
          title: "Añadir campo de observaciones",
          message: `«${editing.table}» no tiene un campo de observaciones. ¿Añadir el campo «observaciones»?`,
          confirmLabel: "Añadir",
        });
        if (!ok) return;
        db.run(`ALTER TABLE ${quoteId(editing.table)} ADD COLUMN "observaciones" TEXT`);
        column = "observaciones";
        setMappings((prev) => ({ ...prev, [editing.table]: { ...mappingOf(editing.table), observaciones: column } }));
      }
      db.updateCell(editing.table, editing.rowid, column, note.trim() || null);
      setEditing(null);
      onChanged();
      toast("Observación guardada");
    } catch (err) {
      void showMessage("No se pudo guardar la observación", explain(err));
    }
  };

  const saveTable = () => {
    if (!filtered.length) return;
    try {
      const name = uniqueTableName(db, "etl_semilleros_resumen");
      db.transaction(() => {
        db.run(
          `CREATE TABLE ${quoteId(name)} (id INTEGER PRIMARY KEY AUTOINCREMENT, tabla_origen TEXT NOT NULL, semillero TEXT NOT NULL, descripcion TEXT, observaciones TEXT, fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP)`
        );
        for (const r of filtered) {
          db.run(`INSERT INTO ${quoteId(name)} (tabla_origen, semillero, descripcion, observaciones) VALUES (?, ?, ?, ?)`, [
            r.table,
            r.semillero,
            r.descripcion || null,
            r.observaciones || null,
          ]);
        }
      });
      onChanged();
      toast(`Tabla «${name}» creada con ${filtered.length} registros`);
    } catch (err) {
      void showMessage("No se pudo guardar el resultado", explain(err));
    }
  };

  const chip = (active: boolean) =>
    `h-7 px-2.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${active ? "text-white border-transparent" : "border-[#e2cfd1] hover:bg-[#fbeef0]"}`;
  const field = "h-8 px-2 text-[12px] rounded-md border border-[#e2cfd1] outline-none focus:border-[#9b111e] bg-white";

  if (!tables.length) return <div className="flex-1 flex items-center justify-center text-[13px] text-[#7a6265]">Crea o importa tablas para usar el ETL.</div>;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#fcf8f8]">
      {/* Origen: tablas y campos */}
      <aside className="w-72 shrink-0 border-r border-[#ead9db] bg-white overflow-y-auto p-3 flex flex-col gap-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9b111e]">1. Extraer · tablas de origen</div>
        {tables.map((t) => {
          const on = selected.includes(t.name);
          const m = mappingOf(t.name);
          const cols = t.columns.map((c) => c.name);
          return (
            <div key={t.name} className={`rounded-lg border p-2 ${on ? "border-[#9b111e] bg-[#fdf6f6]" : "border-[#ead9db]"}`}>
              <label className="flex items-center gap-2 text-[12px] font-semibold">
                <input
                  type="checkbox"
                  className="accent-[#9b111e]"
                  checked={on}
                  data-etl-table={t.name}
                  onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, t.name] : prev.filter((x) => x !== t.name)))}
                />
                {t.name}
                <span className="ml-auto text-[10px] font-mono text-[#a08a8d]">{t.rowCount}</span>
              </label>
              {on && (
                <div className="mt-2 grid grid-cols-[86px_1fr] gap-1 items-center text-[11px]">
                  {(["semillero", "descripcion", "observaciones"] as (keyof Mapping)[]).map((k) => (
                    <React.Fragment key={k}>
                      <span className="text-[#7a6265]">{k === "descripcion" ? "Descripción" : k === "semillero" ? "Semillero" : "Observaciones"}</span>
                      <select
                        className={`${field} h-7 w-full`}
                        value={m[k]}
                        onChange={(e) => setMappings((prev) => ({ ...prev, [t.name]: { ...m, [k]: e.target.value } }))}
                      >
                        <option value="">(ninguno)</option>
                        {cols.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-[#ead9db] bg-white">
          <button type="button" onClick={run} className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1.5" style={{ background: "#9b111e" }}>
            <Play size={13} className="fill-white" /> Ejecutar ETL
          </button>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={() => onExport(["Tabla de origen", "Semillero", "Descripción", "Observaciones"], filtered.map((r) => [r.table, r.semillero, r.descripcion, r.observaciones]), "ETL semilleros")}
            className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0] disabled:opacity-40"
          >
            <Download size={13} /> Exportar a Excel
          </button>
          <button type="button" disabled={!filtered.length} onClick={saveTable} data-etl-save className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border border-[#e2cfd1] hover:bg-[#fbeef0] disabled:opacity-40">
            <Save size={13} /> Guardar en la base
          </button>
          <span className="text-[11px] text-[#7a6265] truncate" data-etl-message>
            {message}
          </span>
        </div>

        {/* 2. Transformar: filtros */}
        <div className="shrink-0 border-b border-[#ead9db] bg-white">
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="w-full h-9 px-3 flex items-center gap-2 text-[12px] font-semibold text-[#5a3a3e]">
            <Filter size={13} className="text-[#9b111e]" /> 2. Transformar · filtros
            <span className="font-normal text-[#7a6265]">
              {filtered.length} de {records.length} registros
              {semFilter ? ` · ${semFilter}` : ""}
              {obsFilter !== "all" ? ` · ${obsFilter === "with" ? "con observaciones" : "sin observaciones"}` : ""}
            </span>
            {(semFilter || tableFilter || obsFilter !== "all" || search) && (
              <span
                role="button"
                className="ml-2 text-[11px] text-[#9b111e] underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSemFilter(null);
                  setTableFilter(null);
                  setObsFilter("all");
                  setSearch("");
                }}
              >
                Limpiar filtros
              </span>
            )}
            <span className="ml-auto">{filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          </button>
          {filtersOpen && (
            <div className="px-3 pb-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={chip(!semFilter)} style={!semFilter ? { background: "#9b111e" } : undefined} onClick={() => setSemFilter(null)}>
                  Todos los semilleros ({records.length})
                </button>
                {semilleros.map(([s, n]) => (
                  <button key={s} type="button" data-etl-sem={s} className={chip(semFilter === s)} style={semFilter === s ? { background: "#9b111e" } : undefined} onClick={() => setSemFilter(s)}>
                    {s} ({n})
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {(
                  [
                    ["all", `Todas (${records.length})`],
                    ["with", `Con observaciones (${withObs})`],
                    ["without", `Sin observaciones / pendientes (${records.length - withObs})`],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" data-etl-obs={id} className={chip(obsFilter === id)} style={obsFilter === id ? { background: "#9b111e" } : undefined} onClick={() => setObsFilter(id)}>
                    {label}
                  </button>
                ))}
                {selected.length > 1 && (
                  <select className={`${field} h-7`} value={tableFilter || ""} onChange={(e) => setTableFilter(e.target.value || null)}>
                    <option value="">Todas las tablas</option>
                    {selected.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-1.5 border border-[#e2cfd1] rounded-lg px-2 h-7 ml-auto w-64 bg-white">
                  <Search size={12} className="text-[#9a8285]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar texto" className="flex-1 text-[12px] outline-none bg-transparent" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Cargar: vistas */}
        <div className="h-9 shrink-0 px-3 flex items-center gap-1 border-b border-[#ead9db] bg-[#fdf7f7]">
          {(
            [
              ["cards", `Fichas de semillero (${filtered.length})`, LayoutGrid],
              ["table", "Vista tabular", Table2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`h-7 px-3 rounded-md text-[12px] font-semibold flex items-center gap-1.5 ${tab === id ? "bg-white shadow-sm text-[#9b111e]" : "text-[#5a3a3e]"}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {tab === "cards" ? (
            <div className="flex flex-col gap-4" data-etl-cards>
              {grouped.map(([sem, list]) => (
                <section key={sem}>
                  <h3 className="text-[13px] font-bold text-[#6e0a16] mb-2">
                    {sem} <span className="font-normal text-[#a08a8d]">· {list.length}</span>
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
                    {list.map((r) => (
                      <div key={r.key} className="bg-white rounded-lg border border-[#ead9db] p-3 text-[12px]" data-etl-record={r.key}>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#a08a8d]">
                          <span className="px-1.5 py-0.5 rounded bg-[#fbe9eb] text-[#9b111e]">{r.table}</span>#{r.rowid}
                          <button
                            type="button"
                            title="Escribir observación"
                            className="ml-auto h-6 px-2 rounded border border-[#e2cfd1] hover:bg-[#fbeef0] text-[#5a3a3e] flex items-center gap-1"
                            onClick={() => {
                              setEditing(r);
                              setNote(r.observaciones);
                            }}
                          >
                            <StickyNote size={11} /> Nota
                          </button>
                        </div>
                        <p className="mt-1.5 text-[#3a1a1e]">{r.descripcion || <span className="italic text-[#b39a9d]">Sin descripción</span>}</p>
                        <p className={`mt-1.5 rounded px-2 py-1 ${r.observaciones ? "bg-[#fff8e1] text-[#6b5200]" : "text-[#b39a9d] italic"}`}>{r.observaciones || "Sin observaciones"}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {!filtered.length && <p className="text-[12px] text-[#7a6265]">No hay registros con estos filtros.</p>}
            </div>
          ) : (
            <table className="text-[12px] bg-white border border-[#ead9db] min-w-full">
              <thead className="bg-[#f7eced] text-left">
                <tr>
                  {["#", "Acción", "Tabla", "Semillero", "Descripción", "Observaciones"].map((h) => (
                    <th key={h} className="px-2.5 py-1.5 border-b border-[#ead9db]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.key} className="border-b border-[#f6eeef]">
                    <td className="px-2.5 py-1 font-mono text-[#a08a8d]">{i + 1}</td>
                    <td className="px-2.5 py-1">
                      <button type="button" className="h-6 px-2 rounded border border-[#e2cfd1] hover:bg-[#fbeef0] text-[11px]" onClick={() => (setEditing(r), setNote(r.observaciones))}>
                        Nota
                      </button>
                    </td>
                    <td className="px-2.5 py-1">{r.table}</td>
                    <td className="px-2.5 py-1">{r.semillero}</td>
                    <td className="px-2.5 py-1 max-w-[320px] truncate">{r.descripcion}</td>
                    <td className="px-2.5 py-1 max-w-[360px] truncate">{r.observaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <div data-modal-open className="fixed inset-0 z-[99990] bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="w-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f1e6e7]">
              <div>
                <h2 className="text-[15px] font-semibold">Observación</h2>
                <p className="text-[11px] text-[#7a6265]">
                  {editing.semillero} · {editing.table} #{editing.rowid}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-[#fbeef0]">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <textarea
                autoFocus
                data-etl-note
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: Semillero en etapa de formulación de propuesta, excelente avance técnico…"
                className="w-full h-32 p-3 text-[13px] rounded-lg border border-[#e2cfd1] outline-none focus:border-[#9b111e] resize-none"
              />
              <p className="text-[11px] text-[#9a8285] mt-1">Se guarda en el registro original de «{editing.table}».</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#f1e6e7] bg-[#fdf9f9]">
              <button type="button" onClick={() => setEditing(null)} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[#fbeef0]">
                Cancelar
              </button>
              <button type="button" onClick={() => void saveNote()} data-etl-note-save className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white" style={{ background: "#9b111e" }}>
                Guardar observación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
