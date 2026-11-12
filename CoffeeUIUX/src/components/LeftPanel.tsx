// Panel izquierdo: páginas, capas y recursos (kits de interfaz, componentes).

import React, { useMemo, useState } from "react";
import {
  Plus,
  Frame,
  Square,
  Circle,
  Minus,
  Hexagon,
  Star,
  Spline,
  Type,
  Image as ImageIcon,
  Group,
  Diamond,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronRight,
  Search,
  Trash2,
  Smartphone,
  Monitor,
  Globe,
  Layers,
  Shapes,
} from "lucide-react";
import type { NodeType, Page, Platform, UNode, UxDocument } from "../types";
import { PLATFORM_LABEL } from "../types";
import { allComponents, parentMap, reparent, updateNodes } from "../services/model";
import { KITS } from "../services/kits";

const TYPE_ICON: Record<NodeType, React.FC<{ size?: number; className?: string }>> = {
  frame: Frame,
  group: Group,
  component: Diamond,
  instance: Copy,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  polygon: Hexagon,
  star: Star,
  path: Spline,
  text: Type,
  image: ImageIcon,
};

interface Props {
  doc: UxDocument;
  page: Page;
  selection: string[];
  onSelect: (ids: string[]) => void;
  onPage: (page: Page, key?: string) => void;
  onDoc: (doc: UxDocument, key?: string) => void;
  onSwitchPage: (id: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  onInsertKit: (kitId: string) => void;
  onInsertComponent: (id: string) => void;
  onZoomTo: (id: string) => void;
}

export const LeftPanel: React.FC<Props> = (props) => {
  const { doc, page, selection, onSelect, onPage, onDoc, onSwitchPage, onAddPage, onDeletePage, onInsertKit, onInsertComponent, onZoomTo } = props;
  const [tab, setTab] = useState<"layers" | "assets">("layers");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; where: "before" | "after" | "inside" } | null>(null);
  const [query, setQuery] = useState("");
  const [kitFilter, setKitFilter] = useState<Platform | "all">(doc.platform);

  const parents = useMemo(() => parentMap(page), [page]);
  const selected = new Set(selection);
  // Al seleccionar algo dentro de un contenedor plegado, se despliega
  const openAncestors = useMemo(() => {
    const s = new Set<string>();
    for (const id of selection) {
      let p = parents.get(id);
      while (p) {
        s.add(p);
        p = parents.get(p);
      }
    }
    return s;
  }, [selection, parents]);

  const toggle = (id: string, patch: (n: UNode) => Partial<UNode>) => onPage(updateNodes(page, { [id]: patch(page.nodes[id]) }));

  const onDropLayer = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragged = e.dataTransfer.getData("application/x-layer");
    setDrop(null);
    if (!dragged || dragged === targetId || !drop) return;
    const target = page.nodes[targetId];
    if (drop.where === "inside" && target.children) {
      onPage(reparent(page, [dragged], targetId, target.children.length));
      return;
    }
    const parent = parents.get(targetId) ?? null;
    const list = (parent ? page.nodes[parent].children! : page.children).filter((id) => id !== dragged);
    // La lista de capas se muestra de arriba (delante) a abajo (detrás)
    const idx = list.indexOf(targetId);
    const index = drop.where === "before" ? idx + 1 : idx;
    onPage(reparent(page, [dragged], parent, index));
  };

  const renderLayer = (id: string, depth: number): React.ReactNode => {
    const n = page.nodes[id];
    if (!n) return null;
    const Icon = TYPE_ICON[n.type];
    const kids = n.children || [];
    const open = kids.length > 0 && (!collapsed.has(id) || openAncestors.has(id));
    const isSel = selected.has(id);
    const inSelectedTree = !isSel && [...(function* () {
      let p = parents.get(id);
      while (p) {
        yield p;
        p = parents.get(p);
      }
    })()].some((a) => selected.has(a));
    const dropHere = drop?.id === id;
    return (
      <div key={id}>
        <div
          data-layer={id}
          draggable={renaming !== id}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-layer", id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("application/x-layer")) return;
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = (e.clientY - r.top) / r.height;
            setDrop({ id, where: n.children && y > 0.3 && y < 0.7 ? "inside" : y < 0.5 ? "before" : "after" });
          }}
          onDragLeave={() => setDrop((d) => (d?.id === id ? null : d))}
          onDrop={(e) => onDropLayer(e, id)}
          onClick={(e) => {
            if (e.shiftKey || e.ctrlKey || e.metaKey) onSelect(isSel ? selection.filter((s) => s !== id) : [...selection, id]);
            else onSelect([id]);
          }}
          onDoubleClick={() => setRenaming(id)}
          className={`group relative flex items-center h-7 pr-1.5 text-[12px] cursor-default ${isSel ? "bg-[#e5f4ff]" : inSelectedTree ? "bg-[#f3faff]" : "hover:bg-[#f5f5f5]"} ${!n.visible ? "opacity-50" : ""}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          {dropHere && drop.where !== "inside" && <div className={`absolute left-0 right-0 h-0.5 bg-[#0d99ff] ${drop.where === "before" ? "top-0" : "bottom-0"}`} />}
          {dropHere && drop.where === "inside" && <div className="absolute inset-0 border-2 border-[#0d99ff] rounded pointer-events-none" />}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => {
                const next = new Set(c);
                if (open) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            className={`w-4 h-4 flex items-center justify-center text-[#8a8a8a] ${kids.length ? "" : "invisible"}`}
          >
            <ChevronRight size={11} className={open ? "rotate-90" : ""} />
          </button>
          <Icon size={13} className={`shrink-0 mr-1.5 ${n.type === "component" || n.type === "instance" ? "text-[#9747ff]" : "text-[#6b6b6b]"}`} />
          {renaming === id ? (
            <input
              autoFocus
              defaultValue={n.name}
              onBlur={(e) => {
                toggle(id, () => ({ name: e.target.value.trim() || n.name }));
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setRenaming(null);
              }}
              className="flex-1 min-w-0 h-5 px-1 text-[12px] outline-none ring-1 ring-[#0d99ff] rounded"
            />
          ) : (
            <span className={`flex-1 truncate ${n.type === "component" || n.type === "instance" ? "text-[#9747ff]" : ""}`}>{n.name}</span>
          )}
          <button
            type="button"
            title={n.locked ? "Desbloquear" : "Bloquear"}
            onClick={(e) => {
              e.stopPropagation();
              toggle(id, (x) => ({ locked: !x.locked }));
            }}
            className={`w-5 h-5 flex items-center justify-center text-[#8a8a8a] hover:text-[#1e1e1e] ${n.locked ? "" : "invisible group-hover:visible"}`}
          >
            {n.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
          <button
            type="button"
            title={n.visible ? "Ocultar" : "Mostrar"}
            onClick={(e) => {
              e.stopPropagation();
              toggle(id, (x) => ({ visible: !x.visible }));
            }}
            className={`w-5 h-5 flex items-center justify-center text-[#8a8a8a] hover:text-[#1e1e1e] ${n.visible ? "invisible group-hover:visible" : ""}`}
          >
            {n.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>
        {open && [...kids].reverse().map((c) => renderLayer(c, depth + 1))}
      </div>
    );
  };

  const components = allComponents(doc);
  const q = query.trim().toLowerCase();
  const kits = KITS.filter((k) => (kitFilter === "all" || k.platform === kitFilter || k.platform === "common") && (!q || k.name.toLowerCase().includes(q)));
  const comps = components.filter((c) => !q || c.node.name.toLowerCase().includes(q));

  return (
    <aside className="w-[248px] shrink-0 bg-white border-r border-[#e6e6e6] flex flex-col min-h-0" data-left-panel>
      <div className="flex items-center gap-1 px-2 h-10 border-b border-[#e6e6e6] shrink-0">
        {(
          [
            ["layers", "Capas", Layers],
            ["assets", "Recursos", Shapes],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            data-left-tab={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-semibold ${tab === id ? "bg-[#f0f0f0] text-[#1e1e1e]" : "text-[#8a8a8a] hover:text-[#1e1e1e]"}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "layers" && (
        <>
          <div className="border-b border-[#e6e6e6] py-1.5 shrink-0 max-h-[30%] overflow-y-auto">
            <div className="flex items-center justify-between px-3 h-6">
              <span className="text-[11px] font-semibold">Páginas</span>
              <button type="button" title="Nueva página" data-btn="add-page" onClick={onAddPage} className="w-6 h-6 rounded hover:bg-[#f0f0f0] flex items-center justify-center">
                <Plus size={13} />
              </button>
            </div>
            {doc.pages.map((p) => (
              <div
                key={p.id}
                data-page={p.id}
                onClick={() => onSwitchPage(p.id)}
                onDoubleClick={() => setRenamingPage(p.id)}
                className={`group flex items-center h-7 px-3 text-[12px] cursor-default ${p.id === page.id ? "font-semibold bg-[#f5f5f5]" : "hover:bg-[#fafafa]"}`}
              >
                {renamingPage === p.id ? (
                  <input
                    autoFocus
                    defaultValue={p.name}
                    onBlur={(e) => {
                      onDoc({ ...doc, pages: doc.pages.map((x) => (x.id === p.id ? { ...x, name: e.target.value.trim() || x.name } : x)) });
                      setRenamingPage(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="flex-1 h-5 px-1 outline-none ring-1 ring-[#0d99ff] rounded"
                  />
                ) : (
                  <span className="flex-1 truncate">{p.name}</span>
                )}
                {doc.pages.length > 1 && (
                  <button
                    type="button"
                    title="Eliminar página"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(p.id);
                    }}
                    className="invisible group-hover:visible text-[#8a8a8a] hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto py-1" data-layers onDoubleClick={(e) => e.stopPropagation()}>
            {page.children.length === 0 && <p className="px-3 py-4 text-[11.5px] text-[#8a8a8a] leading-relaxed">La página está vacía. Pulsa F para dibujar un marco o elige un tamaño de dispositivo en la barra superior.</p>}
            {[...page.children].reverse().map((id) => (
              <div key={id} onDoubleClick={() => page.nodes[id] && (page.nodes[id].type === "frame" || page.nodes[id].type === "component") && onZoomTo(id)}>
                {renderLayer(id, 0)}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "assets" && (
        <div className="flex-1 overflow-y-auto" data-assets>
          <div className="p-2 sticky top-0 bg-white z-10 flex flex-col gap-2 border-b border-[#efefef]">
            <div className="flex items-center gap-1.5 h-7 rounded-md bg-[#f5f5f5] px-2">
              <Search size={13} className="text-[#8a8a8a]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Buscar recursos" className="flex-1 bg-transparent outline-none text-[12px]" />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  ["mobile", Smartphone],
                  ["desktop", Monitor],
                  ["web", Globe],
                  ["all", Shapes],
                ] as const
              ).map(([id, Icon]) => (
                <button
                  key={id}
                  type="button"
                  data-kit-filter={id}
                  title={id === "all" ? "Todos" : PLATFORM_LABEL[id]}
                  onClick={() => setKitFilter(id)}
                  className={`h-7 rounded-md flex items-center justify-center gap-1 text-[10.5px] font-semibold ${kitFilter === id ? "bg-[#1e1e1e] text-white" : "bg-[#f5f5f5] text-[#444] hover:bg-[#ebebeb]"}`}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>

          {comps.length > 0 && (
            <div className="px-2 pt-2">
              <div className="text-[11px] font-semibold px-1 mb-1.5">Componentes del documento</div>
              <div className="grid grid-cols-2 gap-1.5">
                {comps.map(({ node }) => (
                  <button
                    key={node.id}
                    type="button"
                    draggable
                    data-component={node.id}
                    onDragStart={(e) => e.dataTransfer.setData("application/x-component", node.id)}
                    onClick={() => onInsertComponent(node.id)}
                    title="Clic o arrastra para crear una instancia"
                    className="h-14 rounded-md border border-[#ececec] hover:border-[#9747ff] flex flex-col items-center justify-center gap-1 text-[11px] px-1"
                  >
                    <Diamond size={15} className="text-[#9747ff]" />
                    <span className="truncate max-w-full">{node.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-2 py-2">
            <div className="text-[11px] font-semibold px-1 mb-1.5">
              Kit de interfaz {kitFilter === "all" ? "" : `· ${PLATFORM_LABEL[kitFilter]}`}
            </div>
            <div className="flex flex-col gap-1">
              {kits.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  draggable
                  data-kit={k.id}
                  onDragStart={(e) => e.dataTransfer.setData("application/x-kit", k.id)}
                  onClick={() => onInsertKit(k.id)}
                  title="Clic para insertar en el marco seleccionado, o arrástralo al lienzo"
                  className="h-8 px-2 rounded-md hover:bg-[#f5f5f5] flex items-center gap-2 text-[12px] text-left"
                >
                  <span className="w-5 h-5 rounded bg-[#fff4cc] text-[#7a5b00] flex items-center justify-center shrink-0">
                    {k.platform === "mobile" ? <Smartphone size={11} /> : k.platform === "desktop" ? <Monitor size={11} /> : k.platform === "web" ? <Globe size={11} /> : <Shapes size={11} />}
                  </span>
                  <span className="truncate">{k.name}</span>
                </button>
              ))}
              {kits.length === 0 && <p className="text-[11.5px] text-[#8a8a8a] px-1">No hay elementos que coincidan.</p>}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
