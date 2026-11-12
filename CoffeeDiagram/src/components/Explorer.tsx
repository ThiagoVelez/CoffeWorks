// Panel izquierdo: explorador del modelo (diagramas y elementos) y paleta.

import React, { useState } from "react";
import { Plus, Trash2, Copy, MousePointer2, ChevronDown, ChevronRight, Network, Search } from "lucide-react";
import type { DiagramDocument, EdgeKind, PaletteItem } from "../types";
import { SHAPE_LABEL, kindInfo } from "../types";
import { currentDiagram } from "../services/model";
import { ShapeIcon, EdgeIcon, KindIcon } from "./icons";
import type { CanvasTool } from "./Canvas";

interface Props {
  doc: DiagramDocument;
  selection: string[];
  tool: CanvasTool;
  onTool: (t: CanvasTool) => void;
  onSelect: (ids: string[]) => void;
  onSwitch: (id: string) => void;
  onAddDiagram: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export const Explorer: React.FC<Props> = ({ doc, selection, tool, onTool, onSelect, onSwitch, onAddDiagram, onRename, onDelete, onDuplicate }) => {
  const d = currentDiagram(doc);
  const info = kindInfo(d.kind);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [showElements, setShowElements] = useState(true);
  const [filter, setFilter] = useState("");
  const isShape = (item: PaletteItem) => tool.mode === "shape" && tool.item === item;
  const isEdge = (k: EdgeKind) => tool.mode === "edge" && tool.kind === k;
  const elements = Object.values(d.nodes)
    .filter((n) => n.name || n.text)
    .filter((n) => !filter || `${n.name} ${n.text}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <aside className="w-[250px] shrink-0 bg-white border-r border-[#e1e6ed] flex flex-col min-h-0" data-explorer>
      <div className="px-3 pt-3 pb-2 border-b border-[#eef1f5]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#5b6b7b]">Modelo</span>
          <button type="button" data-btn="add-diagram" title="Nuevo diagrama" onClick={onAddDiagram} className="w-6 h-6 rounded hover:bg-[#eef3f9] flex items-center justify-center text-[#1e3a5f]">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex flex-col max-h-[26vh] overflow-y-auto">
          {doc.diagrams.map((x) => (
            <div
              key={x.id}
              data-diagram={x.id}
              onClick={() => onSwitch(x.id)}
              onDoubleClick={() => setRenaming(x.id)}
              className={`group flex items-center gap-2 h-7 px-2 rounded-md text-[12.5px] cursor-default ${x.id === d.id ? "bg-[#e7eef7] text-[#1e3a5f] font-semibold" : "hover:bg-[#f4f7fb]"}`}
            >
              <KindIcon kind={x.kind} size={14} />
              {renaming === x.id ? (
                <input
                  autoFocus
                  defaultValue={x.name}
                  onBlur={(e) => {
                    onRename(x.id, e.target.value.trim() || x.name);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 min-w-0 h-5 px-1 text-[12px] outline-none ring-1 ring-[#2f80ed] rounded"
                />
              ) : (
                <span className="flex-1 truncate">{x.name}</span>
              )}
              <button type="button" title="Duplicar" onClick={(e) => (e.stopPropagation(), onDuplicate(x.id))} className="invisible group-hover:visible text-[#7b8b9b] hover:text-[#1e3a5f]">
                <Copy size={12} />
              </button>
              {doc.diagrams.length > 1 && (
                <button type="button" title="Eliminar" onClick={(e) => (e.stopPropagation(), onDelete(x.id))} className="invisible group-hover:visible text-[#7b8b9b] hover:text-red-600">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2.5 border-b border-[#eef1f5]" data-palette>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#5b6b7b] mb-2">{info.label}</div>
          <button
            type="button"
            data-tool="select"
            onClick={() => onTool({ mode: "select" })}
            className={`w-full flex items-center gap-2 h-8 px-2 rounded-md text-[12.5px] mb-1 ${tool.mode === "select" ? "bg-[#1e3a5f] text-white" : "hover:bg-[#f4f7fb]"}`}
          >
            <MousePointer2 size={14} /> Seleccionar
            <span className="ml-auto text-[10px] opacity-60 font-mono">V</span>
          </button>
          <div className="grid grid-cols-2 gap-1">
            {info.shapes.map((item, i) => (
              <button
                key={`${item.type}-${i}`}
                type="button"
                data-shape={item.label}
                title={`${item.label} (clic y luego clic en el lienzo; doble clic para colocar varias)`}
                onClick={() => onTool(isShape(item) ? { mode: "select" } : { mode: "shape", item })}
                className={`flex flex-col items-center justify-center gap-1 h-[58px] px-1 rounded-md border text-[10.5px] leading-tight text-center ${isShape(item) ? "border-[#2f80ed] bg-[#eaf2fd] text-[#1e3a5f]" : "border-[#eef1f5] hover:border-[#c9d6e6] hover:bg-[#f8fafc]"}`}
              >
                <ShapeIcon type={item.type} />
                <span className="line-clamp-2">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#5b6b7b] mt-3 mb-1.5">Conexiones</div>
          <div className="flex flex-col gap-0.5">
            {info.edges.map((e) => (
              <button
                key={e.kind}
                type="button"
                data-edge-tool={e.kind}
                onClick={() => onTool(isEdge(e.kind) ? { mode: "select" } : { mode: "edge", kind: e.kind })}
                className={`flex items-center gap-2 h-7 px-2 rounded-md text-[12px] ${isEdge(e.kind) ? "bg-[#eaf2fd] text-[#1e3a5f] font-semibold ring-1 ring-[#2f80ed]" : "hover:bg-[#f4f7fb]"}`}
              >
                <EdgeIcon kind={e.kind} />
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2.5">
          <button type="button" onClick={() => setShowElements((v) => !v)} className="w-full flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#5b6b7b] mb-1.5">
            {showElements ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Elementos ({Object.keys(d.nodes).length})
          </button>
          {showElements && (
            <>
              <div className="flex items-center gap-1.5 h-7 rounded-md bg-[#f4f7fb] px-2 mb-1.5">
                <Search size={12} className="text-[#7b8b9b]" />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Filtrar" className="flex-1 bg-transparent outline-none text-[12px]" />
              </div>
              <div className="flex flex-col" data-elements>
                {elements.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onSelect([n.id])}
                    className={`flex items-center gap-2 h-7 px-2 rounded-md text-[12px] text-left ${selection.includes(n.id) ? "bg-[#e7eef7] font-semibold" : "hover:bg-[#f4f7fb]"}`}
                  >
                    <ShapeIcon type={n.type} size={14} />
                    <span className="truncate flex-1">{n.name || n.text}</span>
                    <span className="text-[10px] text-[#9aa8b6] shrink-0">{SHAPE_LABEL[n.type]}</span>
                  </button>
                ))}
                {!elements.length && (
                  <p className="text-[11.5px] text-[#7b8b9b] leading-snug flex items-start gap-1.5">
                    <Network size={13} className="shrink-0 mt-0.5" /> Elige una figura de la paleta y haz clic en el lienzo. Arrastra el círculo azul de una figura para conectarla.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
