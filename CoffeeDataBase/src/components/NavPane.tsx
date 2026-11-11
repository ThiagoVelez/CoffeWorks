// Panel de objetos: tablas, consultas guardadas y vistas de la base.

import React, { useState } from "react";
import { Table2, FileSearch, Eye, Plus, Search, Pencil, Trash2, PencilRuler } from "lucide-react";
import type { Schema } from "../types";

export type Selection = { kind: "table" | "query" | "view"; name: string } | null;

interface NavProps {
  schema: Schema;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onNewTable: () => void;
  onNewQuery: () => void;
  onDesign: (name: string) => void;
  onRename: (kind: "table" | "query", name: string) => void;
  onDelete: (kind: "table" | "query" | "view", name: string) => void;
}

export const NavPane: React.FC<NavProps> = ({ schema, selection, onSelect, onNewTable, onNewQuery, onDesign, onRename, onDelete }) => {
  const [filter, setFilter] = useState("");
  const match = (name: string) => name.toLowerCase().includes(filter.toLowerCase());
  const item = (kind: "table" | "query" | "view", name: string, extra: React.ReactNode, Icon: React.ComponentType<{ size?: number; className?: string }>) => {
    const active = selection?.kind === kind && selection.name === name;
    return (
      <div
        key={`${kind}-${name}`}
        data-nav={`${kind}:${name}`}
        onClick={() => onSelect({ kind, name })}
        onDoubleClick={() => kind === "table" && onDesign(name)}
        className={`group mx-1.5 my-0.5 px-2 py-1.5 rounded-md flex items-center gap-2 cursor-pointer text-[13px] ${
          active ? "bg-[#9b111e] text-white" : "text-[#3a1a1e] hover:bg-[#f6e6e8]"
        }`}
      >
        <Icon size={14} className={active ? "text-white" : "text-[#9b111e]"} />
        <span className="flex-1 truncate">{name}</span>
        <span className={`text-[10px] font-mono ${active ? "text-white/80" : "text-[#a08a8d]"} group-hover:hidden`}>{extra}</span>
        <span className="hidden group-hover:flex items-center gap-0.5">
          {kind === "table" && (
            <button type="button" title="Diseño" onClick={(e) => (e.stopPropagation(), onDesign(name))} className="p-0.5 rounded hover:bg-black/10">
              <PencilRuler size={12} />
            </button>
          )}
          {kind !== "view" && (
            <button type="button" title="Cambiar nombre" onClick={(e) => (e.stopPropagation(), onRename(kind, name))} className="p-0.5 rounded hover:bg-black/10">
              <Pencil size={12} />
            </button>
          )}
          <button type="button" title="Eliminar" onClick={(e) => (e.stopPropagation(), onDelete(kind, name))} className="p-0.5 rounded hover:bg-black/10">
            <Trash2 size={12} />
          </button>
        </span>
      </div>
    );
  };
  const header = (label: string, onAdd?: () => void, title?: string) => (
    <div className="px-3 pt-3 pb-1 flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b111e]">{label}</span>
      {onAdd && (
        <button type="button" onClick={onAdd} title={title} className="p-0.5 rounded hover:bg-[#f6e6e8] text-[#9b111e]">
          <Plus size={14} />
        </button>
      )}
    </div>
  );
  return (
    <nav className="w-60 shrink-0 bg-[#fdf7f7] border-r border-[#ead9db] flex flex-col overflow-hidden" aria-label="Objetos">
      <div className="p-2 border-b border-[#ead9db]">
        <div className="flex items-center gap-1.5 bg-white border border-[#e2cfd1] rounded-lg px-2 h-8 focus-within:border-[#9b111e]">
          <Search size={13} className="text-[#9a8285]" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar objetos" className="flex-1 text-[12px] outline-none bg-transparent" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        {header("Tablas", onNewTable, "Nueva tabla")}
        {schema.tables.filter((t) => match(t.name)).map((t) => item("table", t.name, t.rowCount, Table2))}
        {schema.tables.length === 0 && <p className="px-4 text-[11px] text-[#a08a8d]">Sin tablas</p>}
        {header("Consultas", onNewQuery, "Nueva consulta")}
        {schema.queries.filter((q) => match(q.name)).map((q) => item("query", q.name, "", FileSearch))}
        {schema.queries.length === 0 && <p className="px-4 text-[11px] text-[#a08a8d]">Sin consultas guardadas</p>}
        {schema.views.length > 0 && header("Vistas")}
        {schema.views.filter((v) => match(v.name)).map((v) => item("view", v.name, "", Eye))}
      </div>
    </nav>
  );
};
