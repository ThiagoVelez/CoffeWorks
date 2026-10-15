import React from "react";
import { ArrowLeft, Plus, MoreVertical, ListTree } from "lucide-react";
import type { DocumentHeading, DocumentTheme } from "../types";

interface OutlineSidebarProps {
  isOpen: boolean;
  headings: DocumentHeading[];
  onSelectHeading: (text: string) => void;
  theme?: DocumentTheme;
}

export const OutlineSidebar: React.FC<OutlineSidebarProps> = ({
  isOpen,
  headings,
  onSelectHeading,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-64 border-r border-[#e1dfdd]/70 bg-white flex flex-col p-3 select-none z-30 shrink-0 text-[#1f1f1f]">
      {/* Botón de retroceso a la izquierda */}
      <div className="flex items-center mb-4">
        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-100 text-[#444746] transition-colors"
          title="Cerrar panel de pestañas y esquemas"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      {/* Encabezado: Pestañas del documento + botón '+' */}
      <div className="flex items-center justify-between pb-2 mb-2">
        <h3 className="text-xs font-semibold text-[#444746]">
          Pestañas del documento
        </h3>
        <button
          type="button"
          className="p-1 rounded-full hover:bg-gray-100 text-[#444746] transition-colors"
          title="Agregar pestaña"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Píldora de Pestaña activa (Pestaña 1) con menú contextual */}
      <div className="bg-[#d3e3fd] text-[#041e49] font-medium text-xs px-3 py-2 rounded-lg flex items-center justify-between shadow-xs mb-3">
        <div className="flex items-center gap-2">
          <ListTree size={15} className="text-[#0b57d0]" />
          <span>Pestaña 1</span>
        </div>
        <button
          type="button"
          className="p-0.5 hover:bg-black/5 rounded text-[#041e49]"
          title="Opciones de pestaña"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Texto informativo oficial de Google Docs */}
      <p className="text-[11px] text-[#747775] leading-relaxed mb-3 px-1">
        Los encabezados que agregues al documento se mostrarán aquí.
      </p>

      {/* Esquema de títulos extraídos */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {headings.map((h, i) => (
          <button
            key={`${h.id}-${i}`}
            type="button"
            onClick={() => onSelectHeading(h.text)}
            style={{ paddingLeft: `${(h.level - 1) * 12 + 6}px` }}
            className="text-left py-1.5 px-2 rounded-md text-xs transition-colors hover:bg-[#f0f4f9] hover:text-[#0b57d0] text-[#444746] truncate font-medium"
          >
            <span className="truncate">{h.text}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};
