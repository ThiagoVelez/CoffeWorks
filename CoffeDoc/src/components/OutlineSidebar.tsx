import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, MoreVertical, ListTree, Pencil, Copy, Trash2 } from "lucide-react";
import type { DocumentHeading, DocumentTab } from "../types";

interface OutlineSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: DocumentTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onRenameTab: (id: string) => void;
  onDuplicateTab: (id: string) => void;
  onDeleteTab: (id: string) => void;
  headings: DocumentHeading[];
  onSelectHeading: (index: number) => void;
}

/** Panel lateral con las pestañas del documento y el esquema de títulos. */
export const OutlineSidebar: React.FC<OutlineSidebarProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRenameTab,
  onDuplicateTab,
  onDeleteTab,
  headings,
  onSelectHeading,
}) => {
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuTabId) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-tab-menu]")) setMenuTabId(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [menuTabId]);

  if (!isOpen) return null;

  return (
    <aside
      ref={asideRef}
      className="w-64 border-r border-[#e1dfdd]/70 bg-white flex flex-col p-3 select-none z-30 shrink-0 text-[#1f1f1f] print:hidden"
    >
      <div className="flex items-center mb-4">
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 text-[#444746] transition-colors"
          title="Cerrar el panel de pestañas y esquema"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between pb-2 mb-2">
        <h3 className="text-xs font-semibold text-[#444746]">Pestañas del documento</h3>
        <button
          type="button"
          onClick={onAddTab}
          className="p-1 rounded-full hover:bg-gray-100 text-[#444746] transition-colors"
          title="Agregar pestaña"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1 mb-3">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div key={tab.id} className="relative" data-tab-menu>
              <div
                className={`font-medium text-xs pl-3 pr-1.5 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  isActive ? "bg-[#d3e3fd] text-[#041e49]" : "text-[#444746] hover:bg-[#f0f4f9]"
                }`}
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={() => onRenameTab(tab.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ListTree size={15} className={isActive ? "text-[#0b57d0] shrink-0" : "shrink-0"} />
                  <span className="truncate">{tab.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTabId(menuTabId === tab.id ? null : tab.id);
                  }}
                  className="p-0.5 hover:bg-black/10 rounded shrink-0"
                  title="Opciones de la pestaña"
                >
                  <MoreVertical size={14} />
                </button>
              </div>

              {menuTabId === tab.id && (
                <div className="absolute right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-40 min-w-[150px]">
                  {[
                    { label: "Cambiar nombre", icon: Pencil, action: () => onRenameTab(tab.id) },
                    { label: "Duplicar", icon: Copy, action: () => onDuplicateTab(tab.id) },
                    {
                      label: "Eliminar",
                      icon: Trash2,
                      action: () => onDeleteTab(tab.id),
                      disabled: tabs.length <= 1,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        setMenuTabId(null);
                        item.action();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[#1f1f1f] hover:bg-[#f0f4f9] disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <item.icon size={13} className="text-[#444746]" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="text-xs font-semibold text-[#444746] px-1 mb-1">Esquema</h3>
      {headings.length === 0 && (
        <p className="text-[11px] text-[#747775] leading-relaxed mb-3 px-1">
          Los encabezados que agregues al documento se mostrarán aquí.
        </p>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        {headings.map((heading) => (
          <button
            key={heading.index}
            type="button"
            onClick={() => onSelectHeading(heading.index)}
            style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
            title={heading.text}
            className={`text-left py-1.5 pr-2 rounded-md text-xs transition-colors hover:bg-[#f0f4f9] hover:text-[#0b57d0] text-[#444746] truncate ${
              heading.level === 1 ? "font-semibold" : "font-normal"
            }`}
          >
            {heading.text || "(Título vacío)"}
          </button>
        ))}
      </div>
    </aside>
  );
};
