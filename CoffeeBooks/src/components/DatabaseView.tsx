// Base de datos de CoffeeBooks: vistas de tabla, tablero, lista y
// calendario; propiedades con tipo; filtros, orden y búsqueda; cada fila se
// abre como una página.

import React, { useMemo, useState } from "react";
import { Plus, Table2, Columns3, List, CalendarDays, Search, ArrowUpDown, Filter, Trash2, X, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import type { BlockColor, Column, ColumnType, Database, DbView, Row, Workspace } from "../types";
import { COLOR_STYLE } from "../types";
import { cellText, col, newId, newRow, visibleRows } from "../services/model";
import { BlockEditor } from "./BlockEditor";

const TYPE_LABEL: Record<ColumnType, string> = {
  title: "Título",
  text: "Texto",
  number: "Número",
  select: "Selección",
  multi: "Selección múltiple",
  date: "Fecha",
  checkbox: "Casilla",
  url: "Enlace",
};
const VIEW_ICON = { table: Table2, board: Columns3, list: List, calendar: CalendarDays };
const VIEW_LABEL = { table: "Tabla", board: "Tablero", list: "Lista", calendar: "Calendario" };
const OPTION_COLORS: BlockColor[] = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

const Tag: React.FC<{ name: string; color: BlockColor }> = ({ name, color }) => (
  <span className="inline-block px-1.5 rounded text-[12px] leading-5 whitespace-nowrap" style={{ background: COLOR_STYLE[color].bg, color: COLOR_STYLE[color].fg }}>
    {name}
  </span>
);

export const DatabaseView: React.FC<{
  db: Database;
  onChange: (db: Database, key?: string) => void;
  workspace: Workspace;
  onOpenPage: (id: string) => void;
}> = ({ db, onChange, workspace, onOpenPage }) => {
  const [query, setQuery] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [colMenu, setColMenu] = useState<string | null>(null);
  const view = db.views.find((v) => v.id === db.activeView) || db.views[0];
  const rows = useMemo(() => visibleRows(db, view, query), [db, view, query]);
  const titleCol = db.columns.find((c) => c.type === "title") || db.columns[0];

  const setView = (patch: Partial<DbView>, key = "") => onChange({ ...db, views: db.views.map((v) => (v.id === view.id ? { ...v, ...patch } : v)) }, key);
  const setRow = (id: string, values: Row["values"], key = "") => onChange({ ...db, rows: db.rows.map((r) => (r.id === id ? { ...r, values: { ...r.values, ...values } } : r)) }, key);
  const setCol = (id: string, patch: Partial<Column>, key = "") => onChange({ ...db, columns: db.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, key);
  const addRow = (values: Row["values"] = {}) => {
    const r = newRow(db, values);
    onChange({ ...db, rows: [...db.rows, r] });
    return r;
  };
  const addCol = (type: ColumnType) => {
    const c = col(TYPE_LABEL[type], type, type === "select" || type === "multi" ? { options: [] } : {});
    onChange({ ...db, columns: [...db.columns, c], rows: db.rows.map((r) => ({ ...r, values: { ...r.values, [c.id]: type === "checkbox" ? false : type === "multi" ? [] : null } })) });
  };
  const addOption = (c: Column, name: string): string => {
    const o = { id: newId("o"), name, color: OPTION_COLORS[(c.options?.length || 0) % OPTION_COLORS.length] };
    setCol(c.id, { options: [...(c.options || []), o] });
    return o.id;
  };

  const row = db.rows.find((r) => r.id === openRow) || null;
  const groupCol = db.columns.find((c) => c.id === view.groupBy && (c.type === "select")) || db.columns.find((c) => c.type === "select");
  const dateCol = db.columns.find((c) => c.id === view.groupBy && c.type === "date") || db.columns.find((c) => c.type === "date");

  return (
    <div className="flex flex-col gap-2" data-database>
      {/* Vistas y herramientas */}
      <div className="flex items-center gap-1 border-b border-[#e9e9e7] pb-1 flex-wrap">
        {db.views.map((v) => {
          const Icon = VIEW_ICON[v.kind];
          return (
            <button key={v.id} type="button" onClick={() => onChange({ ...db, activeView: v.id })} onDoubleClick={() => {
              const name = window.prompt("Nombre de la vista", v.name);
              if (name) onChange({ ...db, views: db.views.map((x) => (x.id === v.id ? { ...x, name } : x)) });
            }} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[13px] ${v.id === view.id ? "text-[#37352f] font-medium border-b-2 border-[#37352f] rounded-b-none" : "text-[#787774] hover:bg-[#f1f1ef]"}`} data-view={v.name}>
              <Icon size={14} /> {v.name}
            </button>
          );
        })}
        <select value="" onChange={(e) => {
          const kind = e.target.value as DbView["kind"];
          if (!kind) return;
          const v: DbView = { id: newId("v"), name: VIEW_LABEL[kind], kind, groupBy: kind === "board" ? groupCol?.id : kind === "calendar" ? dateCol?.id : undefined };
          onChange({ ...db, views: [...db.views, v], activeView: v.id });
        }} className="text-[13px] text-[#787774] bg-transparent outline-none rounded hover:bg-[#f1f1ef] px-1 py-1" title="Añadir una vista">
          <option value="">+ Vista</option>
          {(Object.keys(VIEW_LABEL) as DbView["kind"][]).map((k) => (
            <option key={k} value={k}>
              {VIEW_LABEL[k]}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-[13px] text-[#787774] px-2 py-1 rounded hover:bg-[#f1f1ef]">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" className="bg-transparent outline-none w-24 focus:w-40 transition-all text-[#37352f]" />
        </label>
        <select value={view.sort ? `${view.sort.column}:${view.sort.dir}` : ""} onChange={(e) => {
          const [c, d] = e.target.value.split(":");
          setView({ sort: c ? { column: c, dir: d as "asc" | "desc" } : null });
        }} className="text-[13px] text-[#787774] bg-transparent outline-none rounded hover:bg-[#f1f1ef] px-1 py-1" title="Ordenar">
          <option value="">Sin ordenar</option>
          {db.columns.flatMap((c) => [
            <option key={c.id + "a"} value={`${c.id}:asc`}>
              ↑ {c.name}
            </option>,
            <option key={c.id + "d"} value={`${c.id}:desc`}>
              ↓ {c.name}
            </option>,
          ])}
        </select>
        <ArrowUpDown size={13} className="text-[#9b9a97] -ml-1" />
        <FilterControl db={db} view={view} onChange={(filter) => setView({ filter })} />
        {view.kind === "board" || view.kind === "calendar" ? (
          <select value={view.groupBy || ""} onChange={(e) => setView({ groupBy: e.target.value })} className="text-[13px] text-[#787774] bg-transparent outline-none rounded hover:bg-[#f1f1ef] px-1 py-1" title={view.kind === "board" ? "Agrupar por" : "Fecha"}>
            {db.columns
              .filter((c) => (view.kind === "board" ? c.type === "select" : c.type === "date"))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {view.kind === "board" ? "Agrupar: " : "Fecha: "}
                  {c.name}
                </option>
              ))}
          </select>
        ) : null}
        {db.views.length > 1 && (
          <button type="button" title="Eliminar esta vista" className="p-1 rounded text-[#9b9a97] hover:bg-[#f1f1ef]" onClick={() => onChange({ ...db, views: db.views.filter((v) => v.id !== view.id), activeView: db.views.find((v) => v.id !== view.id)!.id })}>
            <Trash2 size={14} />
          </button>
        )}
        <button type="button" onClick={() => setOpenRow(addRow().id)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2383e2] text-white text-[13px] font-medium hover:bg-[#0077d4]" data-new-row>
          <Plus size={14} /> Nueva
        </button>
      </div>

      {view.kind === "table" && (
        <div className="overflow-x-auto" data-db-table>
          <table className="border-collapse text-[14px] min-w-full">
            <thead>
              <tr>
                {db.columns.map((c) => (
                  <th key={c.id} className="relative border-y border-r border-[#e9e9e7] text-left font-normal text-[#787774] px-2 py-1.5 whitespace-nowrap" style={{ width: c.width || 160, minWidth: c.width || 160 }}>
                    <button type="button" onClick={() => setColMenu(colMenu === c.id ? null : c.id)} className="hover:text-[#37352f]" data-col={c.name}>
                      {c.name}
                    </button>
                    {colMenu === c.id && <ColumnMenu c={c} onClose={() => setColMenu(null)} onChange={(patch) => setCol(c.id, patch)} onDelete={c.type === "title" ? undefined : () => (setColMenu(null), onChange({ ...db, columns: db.columns.filter((x) => x.id !== c.id) }))} />}
                  </th>
                ))}
                <th className="border-y border-[#e9e9e7] px-1 text-left">
                  <select value="" onChange={(e) => e.target.value && addCol(e.target.value as ColumnType)} className="bg-transparent text-[#9b9a97] outline-none text-[13px]" title="Añadir una propiedad" data-add-col>
                    <option value="">+</option>
                    {(Object.keys(TYPE_LABEL) as ColumnType[])
                      .filter((t) => t !== "title")
                      .map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="group" data-row>
                  {db.columns.map((c) => (
                    <td key={c.id} className="border-b border-r border-[#e9e9e7] px-2 py-1 align-top relative">
                      <Cell c={c} v={r.values[c.id]} onChange={(v, key) => setRow(r.id, { [c.id]: v }, key)} addOption={(name) => addOption(c, name)} />
                      {c.id === titleCol.id && (
                        <button type="button" onClick={() => setOpenRow(r.id)} className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-[#787774] bg-white border border-[#e9e9e7] rounded px-1" data-open-row>
                          <Maximize2 size={11} /> Abrir
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="border-b border-[#e9e9e7] px-1">
                    <button type="button" title="Eliminar la fila" onClick={() => onChange({ ...db, rows: db.rows.filter((x) => x.id !== r.id) })} className="opacity-0 group-hover:opacity-100 text-[#9b9a97] hover:text-[#d44c47]">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => addRow()} className="w-full text-left px-2 py-1.5 text-[14px] text-[#9b9a97] hover:bg-[#f7f6f3] border-b border-[#e9e9e7]">
            + Nueva fila
          </button>
          <div className="text-[12px] text-[#9b9a97] px-2 pt-1">
            {rows.length} {rows.length === 1 ? "fila" : "filas"}
          </div>
        </div>
      )}

      {view.kind === "board" && groupCol && (
        <div className="flex gap-3 overflow-x-auto pb-2" data-db-board>
          {[...(groupCol.options || []), { id: "", name: "Sin " + groupCol.name.toLowerCase(), color: "gray" as BlockColor }].map((o) => {
            const list = rows.filter((r) => (r.values[groupCol.id] || "") === o.id);
            return (
              <div
                key={o.id || "none"}
                className="w-64 shrink-0 flex flex-col gap-2 rounded-lg bg-[#f7f6f3] p-2"
                onDragOver={(e) => e.dataTransfer.types.includes("text/coffee-row") && e.preventDefault()}
                onDrop={(e) => setRow(e.dataTransfer.getData("text/coffee-row"), { [groupCol.id]: o.id || null })}
                data-group={o.name}
              >
                <div className="flex items-center gap-2 px-1">
                  <Tag name={o.name} color={o.color} />
                  <span className="text-[12px] text-[#9b9a97]">{list.length}</span>
                </div>
                {list.map((r) => (
                  <button key={r.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/coffee-row", r.id)} onClick={() => setOpenRow(r.id)} className="text-left rounded-md bg-white shadow-[0_1px_2px_rgba(15,15,15,0.1)] border border-[#e9e9e7] p-2 hover:bg-[#fbfbfa] flex flex-col gap-1" data-card>
                    <span className="text-[14px] font-medium text-[#37352f]">{cellText(titleCol, r.values[titleCol.id]) || "Sin título"}</span>
                    {db.columns
                      .filter((c) => c.id !== titleCol.id && c.id !== groupCol.id && cellText(c, r.values[c.id]))
                      .slice(0, 3)
                      .map((c) => (
                        <span key={c.id} className="text-[12px] text-[#787774]">
                          {c.type === "select" ? <Tag name={cellText(c, r.values[c.id])} color={c.options?.find((x) => x.id === r.values[c.id])?.color || "gray"} /> : cellText(c, r.values[c.id])}
                        </span>
                      ))}
                  </button>
                ))}
                <button type="button" onClick={() => setOpenRow(addRow({ [groupCol.id]: o.id || null }).id)} className="text-left text-[13px] text-[#9b9a97] hover:text-[#37352f] px-1">
                  + Nueva
                </button>
              </div>
            );
          })}
        </div>
      )}
      {view.kind === "board" && !groupCol && <div className="text-[13px] text-[#9b9a97] p-4">Añade una propiedad de tipo «Selección» para agrupar el tablero.</div>}

      {view.kind === "list" && (
        <div className="flex flex-col" data-db-list>
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setOpenRow(r.id)} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#f1f1ef] text-left">
              <span className="text-[14px] text-[#37352f] font-medium flex-1">📄 {cellText(titleCol, r.values[titleCol.id]) || "Sin título"}</span>
              {db.columns
                .filter((c) => c.id !== titleCol.id && cellText(c, r.values[c.id]))
                .slice(0, 3)
                .map((c) => (
                  <span key={c.id} className="text-[12px] text-[#787774]">
                    {cellText(c, r.values[c.id])}
                  </span>
                ))}
            </button>
          ))}
        </div>
      )}

      {view.kind === "calendar" &&
        (dateCol ? (
          <CalendarView rows={rows} dateCol={dateCol} titleCol={titleCol} onOpen={setOpenRow} onAdd={(d) => setOpenRow(addRow({ [dateCol.id]: d }).id)} onMove={(id, d) => setRow(id, { [dateCol.id]: d })} />
        ) : (
          <div className="text-[13px] text-[#9b9a97] p-4">Añade una propiedad de tipo «Fecha» para ver el calendario.</div>
        ))}

      {/* Fila abierta como página */}
      {row && (
        <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onMouseDown={(e) => e.target === e.currentTarget && setOpenRow(null)} data-row-peek>
          <div className="w-[min(760px,92vw)] h-full bg-white shadow-2xl overflow-y-auto px-14 py-10">
            <div className="flex justify-end -mr-8 -mt-4">
              <button type="button" onClick={() => setOpenRow(null)} className="p-1 rounded hover:bg-[#f1f1ef] text-[#787774]" title="Cerrar (Esc)">
                <X size={18} />
              </button>
            </div>
            <input value={String(row.values[titleCol.id] || "")} onChange={(e) => setRow(row.id, { [titleCol.id]: e.target.value }, `title-${row.id}`)} placeholder="Sin título" className="w-full text-[2.2em] font-bold outline-none text-[#37352f] placeholder:text-[#d3d3d1] bg-transparent" data-row-title />
            <div className="flex flex-col gap-1 my-4">
              {db.columns
                .filter((c) => c.id !== titleCol.id)
                .map((c) => (
                  <div key={c.id} className="flex items-start gap-4 text-[14px]">
                    <span className="w-36 shrink-0 text-[#787774] py-1">{c.name}</span>
                    <div className="flex-1 py-1">
                      <Cell c={c} v={row.values[c.id]} onChange={(v, key) => setRow(row.id, { [c.id]: v }, key)} addOption={(name) => addOption(c, name)} />
                    </div>
                  </div>
                ))}
            </div>
            <hr className="border-[#e9e9e7] mb-4" />
            <div className="pl-12">
              <BlockEditor blocks={row.blocks} onChange={(blocks, key) => onChange({ ...db, rows: db.rows.map((r) => (r.id === row.id ? { ...r, blocks } : r)) }, key)} workspace={workspace} onOpenPage={onOpenPage} onCreateSubpage={() => ""} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Celdas y menús
// ---------------------------------------------------------------------------

const Cell: React.FC<{ c: Column; v: Row["values"][string]; onChange: (v: Row["values"][string], key?: string) => void; addOption: (name: string) => string }> = ({ c, v, onChange, addOption }) => {
  const input = "w-full bg-transparent outline-none text-[14px] text-[#37352f]";
  switch (c.type) {
    case "title":
      return <input value={String(v || "")} onChange={(e) => onChange(e.target.value, `cell-${c.id}`)} placeholder="Sin título" className={`${input} font-medium placeholder:text-[#c7c6c4]`} data-cell="title" />;
    case "text":
      return <input value={String(v || "")} onChange={(e) => onChange(e.target.value, `cell-${c.id}`)} className={input} />;
    case "url":
      return (
        <div className="flex items-center gap-1">
          <input value={String(v || "")} onChange={(e) => onChange(e.target.value, `cell-${c.id}`)} className={`${input} underline decoration-[#d3d3d1]`} />
          {typeof v === "string" && /^https?:/.test(v) && (
            <a href={v} target="_blank" rel="noreferrer" className="text-[11px] text-[#2383e2]">
              ↗
            </a>
          )}
        </div>
      );
    case "number":
      return <input type="number" value={v === null || v === undefined ? "" : String(v)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), `cell-${c.id}`)} className={`${input} text-right`} />;
    case "date":
      return <input type="date" value={String(v || "")} onChange={(e) => onChange(e.target.value || null)} className={input} />;
    case "checkbox":
      return <input type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[#2383e2]" />;
    case "select":
    case "multi": {
      const multi = c.type === "multi";
      const selected = multi ? ((v as string[]) || []) : v ? [v as string] : [];
      return (
        <div className="flex flex-wrap items-center gap-1">
          {selected.map((id) => {
            const o = c.options?.find((x) => x.id === id);
            return o ? (
              <button key={id} type="button" title="Quitar" onClick={() => onChange(multi ? selected.filter((x) => x !== id) : null)}>
                <Tag name={o.name} color={o.color} />
              </button>
            ) : null;
          })}
          {(multi || !selected.length) && (
            <select
              value=""
              onChange={(e) => {
                let id = e.target.value;
                if (!id) return;
                if (id === "__new") {
                  const name = window.prompt("Nueva opción");
                  if (!name) return;
                  id = addOption(name);
                }
                onChange(multi ? [...selected, id] : id);
              }}
              className="bg-transparent outline-none text-[12px] text-[#9b9a97] max-w-[90px]"
              data-select-cell={c.name}
            >
              <option value="">{selected.length ? "+" : "Elegir…"}</option>
              {c.options
                ?.filter((o) => !selected.includes(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              <option value="__new">+ Nueva opción…</option>
            </select>
          )}
        </div>
      );
    }
  }
};

const ColumnMenu: React.FC<{ c: Column; onClose: () => void; onChange: (patch: Partial<Column>) => void; onDelete?: () => void }> = ({ c, onClose, onChange, onDelete }) => (
  <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg bg-white shadow-[0_8px_30px_rgba(15,15,15,0.18)] border border-[#e9e9e7] p-2 flex flex-col gap-2 text-[13px] text-[#37352f] font-normal" onMouseLeave={onClose} data-col-menu>
    <input value={c.name} onChange={(e) => onChange({ name: e.target.value })} className="border border-[#e9e9e7] rounded px-2 py-1 outline-none" autoFocus />
    {c.type !== "title" && (
      <select value={c.type} onChange={(e) => onChange({ type: e.target.value as ColumnType, options: c.options || [] })} className="border border-[#e9e9e7] rounded px-1 py-1 outline-none">
        {(Object.keys(TYPE_LABEL) as ColumnType[])
          .filter((t) => t !== "title")
          .map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
      </select>
    )}
    {(c.type === "select" || c.type === "multi") && (
      <div className="flex flex-col gap-1">
        {c.options?.map((o) => (
          <div key={o.id} className="flex items-center gap-1">
            <input value={o.name} onChange={(e) => onChange({ options: c.options!.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })} className="flex-1 border border-[#e9e9e7] rounded px-1 outline-none" />
            <select value={o.color} onChange={(e) => onChange({ options: c.options!.map((x) => (x.id === o.id ? { ...x, color: e.target.value as BlockColor } : x)) })} className="text-[11px] outline-none">
              {OPTION_COLORS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onChange({ options: c.options!.filter((x) => x.id !== o.id) })} className="text-[#9b9a97] hover:text-[#d44c47]">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    )}
    <label className="flex items-center gap-2 text-[12px] text-[#787774]">
      Ancho
      <input type="range" min={90} max={420} value={c.width || 160} onChange={(e) => onChange({ width: Number(e.target.value) })} className="flex-1" />
    </label>
    {onDelete && (
      <button type="button" onClick={onDelete} className="flex items-center gap-2 text-[#d44c47] hover:bg-[#fdebec] rounded px-2 py-1">
        <Trash2 size={13} /> Eliminar la propiedad
      </button>
    )}
  </div>
);

const FilterControl: React.FC<{ db: Database; view: DbView; onChange: (f: DbView["filter"]) => void }> = ({ db, view, onChange }) => {
  const f = view.filter;
  if (!f)
    return (
      <button type="button" onClick={() => onChange({ column: db.columns[0].id, op: "contains", value: "" })} className="flex items-center gap-1 text-[13px] text-[#787774] px-2 py-1 rounded hover:bg-[#f1f1ef]" data-filter>
        <Filter size={13} /> Filtro
      </button>
    );
  const c = db.columns.find((x) => x.id === f.column) || db.columns[0];
  return (
    <div className="flex items-center gap-1 text-[12px] bg-[#e7f3f8] text-[#337ea9] rounded px-2 py-0.5">
      <Filter size={12} />
      <select value={f.column} onChange={(e) => onChange({ ...f, column: e.target.value })} className="bg-transparent outline-none">
        {db.columns.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <select value={f.op} onChange={(e) => onChange({ ...f, op: e.target.value as NonNullable<DbView["filter"]>["op"] })} className="bg-transparent outline-none">
        {c.type === "checkbox" ? (
          <>
            <option value="checked">marcada</option>
            <option value="unchecked">sin marcar</option>
          </>
        ) : (
          <>
            <option value="contains">contiene</option>
            <option value="is">es</option>
            <option value="isNot">no es</option>
            <option value="empty">está vacía</option>
            <option value="notEmpty">no está vacía</option>
          </>
        )}
      </select>
      {!["checked", "unchecked", "empty", "notEmpty"].includes(f.op) &&
        (c.type === "select" ? (
          <select value={f.value} onChange={(e) => onChange({ ...f, value: e.target.value })} className="bg-transparent outline-none">
            <option value="">—</option>
            {c.options?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : (
          <input value={f.value} onChange={(e) => onChange({ ...f, value: e.target.value })} className="bg-white/70 rounded px-1 outline-none w-24 text-[#37352f]" data-filter-value />
        ))}
      <button type="button" onClick={() => onChange(null)} title="Quitar el filtro">
        <X size={12} />
      </button>
    </div>
  );
};

const CalendarView: React.FC<{ rows: Row[]; dateCol: Column; titleCol: Column; onOpen: (id: string) => void; onAdd: (date: string) => void; onMove: (id: string, date: string) => void }> = ({ rows, dateCol, titleCol, onOpen, onAdd, onMove }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const first = new Date(month);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = iso(new Date());
  return (
    <div data-db-calendar>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[15px] font-semibold text-[#37352f] capitalize">{month.toLocaleDateString("es", { month: "long", year: "numeric" })}</span>
        <div className="flex-1" />
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded hover:bg-[#f1f1ef]">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-[13px] px-2 py-0.5 rounded hover:bg-[#f1f1ef]">
          Hoy
        </button>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded hover:bg-[#f1f1ef]">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 border-l border-t border-[#e9e9e7] text-[12px]">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="border-r border-b border-[#e9e9e7] px-2 py-1 text-[#9b9a97]">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = iso(d);
          const items = rows.filter((r) => r.values[dateCol.id] === key);
          return (
            <div key={key} className={`group border-r border-b border-[#e9e9e7] min-h-[96px] p-1 flex flex-col gap-1 ${d.getMonth() !== month.getMonth() ? "bg-[#fbfbfa] text-[#c7c6c4]" : ""}`} onDragOver={(e) => e.dataTransfer.types.includes("text/coffee-row") && e.preventDefault()} onDrop={(e) => onMove(e.dataTransfer.getData("text/coffee-row"), key)}>
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full ${key === today ? "bg-[#eb5757] text-white" : ""}`}>{d.getDate()}</span>
                <button type="button" onClick={() => onAdd(key)} className="opacity-0 group-hover:opacity-100 text-[#9b9a97] hover:text-[#37352f]">
                  <Plus size={13} />
                </button>
              </div>
              {items.map((r) => (
                <button key={r.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/coffee-row", r.id)} onClick={() => onOpen(r.id)} className="text-left truncate rounded bg-white border border-[#e9e9e7] shadow-[0_1px_2px_rgba(15,15,15,0.08)] px-1.5 py-0.5 text-[#37352f] hover:bg-[#f7f6f3]">
                  {cellText(titleCol, r.values[titleCol.id]) || "Sin título"}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
