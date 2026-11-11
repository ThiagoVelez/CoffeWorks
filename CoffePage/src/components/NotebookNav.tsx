// Columnas de navegación: secciones (con su color) y páginas de la sección.

import React, { useEffect, useRef, useState } from "react";
import { Plus, MoreHorizontal, FilePlus2, IndentIncrease, IndentDecrease, Copy, Trash2, Pencil, Palette, ArrowRightLeft } from "lucide-react";
import type { Section } from "../types";
import { SECTION_COLORS } from "../types";
import { pagePreview } from "../services/notebook";

interface NavProps {
  sections: Section[];
  sectionId: string;
  pageId: string;
  accent: string;
  onSelectSection: (id: string) => void;
  onSelectPage: (id: string) => void;
  onAddSection: () => void;
  onRenameSection: (id: string) => void;
  onRecolorSection: (id: string, color: string) => void;
  onDeleteSection: (id: string) => void;
  onMoveSection: (id: string, toIndex: number) => void;
  onAddPage: (afterId?: string, level?: 0 | 1) => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onSetPageLevel: (id: string, level: 0 | 1) => void;
  onMovePage: (id: string, toIndex: number) => void;
  onMovePageToSection: (id: string, sectionId: string) => void;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Menú contextual pequeño anclado a la posición del ratón. */
const ContextMenu: React.FC<{ x: number; y: number; items: (MenuItem | "divider" | React.ReactNode)[]; onClose: () => void }> = ({
  x,
  y,
  items,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  const left = Math.min(x, window.innerWidth - 230);
  const top = Math.min(y, window.innerHeight - 320);
  return (
    <div
      ref={ref}
      className="fixed z-[9000] w-56 bg-white rounded-lg shadow-xl border border-[#e0e0e0] py-1 text-[13px] text-[#1f1f1f]"
      style={{ left, top }}
    >
      {items.map((item, i) => {
        if (item === "divider") return <div key={i} className="my-1 border-t border-[#eee]" />;
        if (item && typeof item === "object" && "label" in (item as MenuItem)) {
          const entry = item as MenuItem;
          const Icon = entry.icon;
          return (
            <button
              key={i}
              type="button"
              disabled={entry.disabled}
              onClick={() => {
                onClose();
                entry.action();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#f3e5f5] disabled:opacity-40 disabled:hover:bg-transparent ${
                entry.danger ? "text-red-700" : ""
              }`}
            >
              <Icon size={14} className={entry.danger ? "text-red-600" : "text-[#5f6368]"} />
              {entry.label}
            </button>
          );
        }
        return <React.Fragment key={i}>{item as React.ReactNode}</React.Fragment>;
      })}
    </div>
  );
};

export const NotebookNav: React.FC<NavProps> = ({
  sections,
  sectionId,
  pageId,
  accent,
  onSelectSection,
  onSelectPage,
  onAddSection,
  onRenameSection,
  onRecolorSection,
  onDeleteSection,
  onMoveSection,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onSetPageLevel,
  onMovePage,
  onMovePageToSection,
}) => {
  const [menu, setMenu] = useState<{ x: number; y: number; kind: "section" | "page"; id: string } | null>(null);
  const [drag, setDrag] = useState<{ kind: "section" | "page"; id: string } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const section = sections.find((s) => s.id === sectionId) || sections[0];

  const openMenu = (e: React.MouseEvent, kind: "section" | "page", id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, kind, id });
  };

  const finishDrag = () => {
    if (drag && dropIndex !== null) {
      if (drag.kind === "section") onMoveSection(drag.id, dropIndex);
      else onMovePage(drag.id, dropIndex);
    }
    setDrag(null);
    setDropIndex(null);
  };

  const menuItems = (): (MenuItem | "divider" | React.ReactNode)[] => {
    if (!menu) return [];
    if (menu.kind === "section") {
      return [
        { label: "Cambiar el nombre", icon: Pencil, action: () => onRenameSection(menu.id) },
        { label: "Nueva página", icon: FilePlus2, action: () => onAddPage() },
        "divider",
        <div key="colors" className="px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-[#5f6368] mb-1.5">
            <Palette size={12} /> Color de la sección
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                style={{ background: color }}
                onClick={() => {
                  onRecolorSection(menu.id, color);
                  setMenu(null);
                }}
              />
            ))}
          </div>
        </div>,
        "divider",
        {
          label: "Eliminar la sección",
          icon: Trash2,
          danger: true,
          disabled: sections.length <= 1,
          action: () => onDeleteSection(menu.id),
        },
      ];
    }
    const page = section.pages.find((p) => p.id === menu.id);
    const index = section.pages.findIndex((p) => p.id === menu.id);
    const others = sections.filter((s) => s.id !== section.id);
    return [
      { label: "Nueva página debajo", icon: FilePlus2, action: () => onAddPage(menu.id, 0) },
      { label: "Nueva subpágina", icon: IndentIncrease, action: () => onAddPage(menu.id, 1) },
      page?.level === 1
        ? { label: "Convertir en página", icon: IndentDecrease, action: () => onSetPageLevel(menu.id, 0) }
        : { label: "Convertir en subpágina", icon: IndentIncrease, disabled: index === 0, action: () => onSetPageLevel(menu.id, 1) },
      { label: "Duplicar la página", icon: Copy, action: () => onDuplicatePage(menu.id) },
      ...(others.length > 0
        ? [
            "divider" as const,
            <div key="move-title" className="px-3 pt-1 pb-0.5 text-[11px] text-[#5f6368] flex items-center gap-1.5">
              <ArrowRightLeft size={12} /> Mover a la sección
            </div>,
            ...others.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#f3e5f5]"
                onClick={() => {
                  onMovePageToSection(menu.id, s.id);
                  setMenu(null);
                }}
              >
                <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                <span className="truncate">{s.name}</span>
              </button>
            )),
          ]
        : []),
      "divider",
      {
        label: "Eliminar la página",
        icon: Trash2,
        danger: true,
        disabled: section.pages.length <= 1,
        action: () => onDeletePage(menu.id),
      },
    ];
  };

  return (
    <>
      {/* Secciones */}
      <nav className="w-48 shrink-0 bg-[#faf7fc] border-r border-[#e8e0ee] flex flex-col select-none" aria-label="Secciones">
        <div className="h-9 px-3 flex items-center justify-between border-b border-[#ece4f1]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6a5a75]">Secciones</span>
          <button type="button" title="Nueva sección" onClick={onAddSection} className="p-1 rounded hover:bg-[#efe3f5] text-[#5f4b6b]">
            <Plus size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {sections.map((s, index) => (
            <div
              key={s.id}
              data-section={s.id}
              draggable
              onDragStart={(e) => {
                setDrag({ kind: "section", id: s.id });
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (drag?.kind === "page" && drag && s.id !== section.id) {
                  e.preventDefault();
                  return;
                }
                if (drag?.kind !== "section") return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setDropIndex(index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag?.kind === "page" && s.id !== section.id) {
                  onMovePageToSection(drag.id, s.id);
                  setDrag(null);
                  setDropIndex(null);
                  return;
                }
                finishDrag();
              }}
              onDragEnd={finishDrag}
              onClick={() => onSelectSection(s.id)}
              onDoubleClick={() => onRenameSection(s.id)}
              onContextMenu={(e) => openMenu(e, "section", s.id)}
              className={`group relative mx-1.5 my-0.5 pl-3 pr-1.5 py-2 rounded-md flex items-center gap-2 cursor-pointer text-[13px] ${
                s.id === section.id ? "bg-white shadow-sm font-semibold text-[#1f1f1f]" : "text-[#3c3c3c] hover:bg-[#f1e8f6]"
              } ${drag?.id === s.id ? "opacity-40" : ""}`}
            >
              {dropIndex === index && drag?.kind === "section" && <div className="absolute -top-1 left-1 right-1 h-0.5 rounded" style={{ background: accent }} />}
              {dropIndex === index + 1 && index === sections.length - 1 && drag?.kind === "section" && (
                <div className="absolute -bottom-1 left-1 right-1 h-0.5 rounded" style={{ background: accent }} />
              )}
              <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 truncate">{s.name}</span>
              <button
                type="button"
                title="Opciones de la sección"
                onClick={(e) => openMenu(e, "section", s.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#ece2f2] text-[#5f6368]"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          ))}
        </div>
      </nav>

      {/* Páginas de la sección */}
      <nav className="w-60 shrink-0 bg-white border-r border-[#e8e0ee] flex flex-col select-none" aria-label="Páginas">
        <div className="h-9 px-3 flex items-center justify-between border-b border-[#ece4f1]" style={{ borderTop: `3px solid ${section.color}` }}>
          <span className="text-[13px] font-semibold text-[#1f1f1f] truncate">{section.name}</span>
          <button
            type="button"
            title="Nueva página (Ctrl+N)"
            onClick={() => onAddPage()}
            className="flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded hover:bg-[#f3e5f5]"
            style={{ color: accent }}
          >
            <Plus size={14} /> Página
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {section.pages.map((p, index) => {
            const label = p.title.trim() || pagePreview(p) || "Página sin título";
            return (
              <div
                key={p.id}
                data-page={p.id}
                draggable
                onDragStart={(e) => {
                  setDrag({ kind: "page", id: p.id });
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (drag?.kind !== "page") return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropIndex(index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  finishDrag();
                }}
                onDragEnd={finishDrag}
                onClick={() => onSelectPage(p.id)}
                onContextMenu={(e) => openMenu(e, "page", p.id)}
                className={`group relative mx-1.5 my-0.5 pr-1.5 py-1.5 rounded-md flex items-center gap-2 cursor-pointer text-[13px] ${
                  p.level === 1 ? "pl-7" : "pl-3"
                } ${p.id === pageId ? "font-semibold text-[#1f1f1f]" : "text-[#3c3c3c] hover:bg-[#f7f1fa]"} ${drag?.id === p.id ? "opacity-40" : ""}`}
                style={p.id === pageId ? { background: "#f3e5f5" } : undefined}
              >
                {dropIndex === index && drag?.kind === "page" && <div className="absolute -top-1 left-1 right-1 h-0.5 rounded" style={{ background: accent }} />}
                {dropIndex === index + 1 && index === section.pages.length - 1 && drag?.kind === "page" && (
                  <div className="absolute -bottom-1 left-1 right-1 h-0.5 rounded" style={{ background: accent }} />
                )}
                <span className={`flex-1 truncate ${p.title.trim() ? "" : "italic text-[#7a7a7a] font-normal"}`}>{label}</span>
                <button
                  type="button"
                  title="Opciones de la página"
                  onClick={(e) => openMenu(e, "page", p.id)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#ece2f2] text-[#5f6368]"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </nav>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </>
  );
};
