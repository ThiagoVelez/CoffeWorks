import React, { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import type { Sheet, SelectionStats } from "../types";

interface SheetTabsBarProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (id: string, newName: string) => void;
  isEditing: boolean;
  stats: SelectionStats;
  zoom: number;
  onZoomChange: (z: number) => void;
}

export const SheetTabsBar: React.FC<SheetTabsBarProps> = ({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  isEditing,
  stats,
  zoom,
  onZoomChange,
}) => {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  const handleFinishRename = (id: string) => {
    if (tempName.trim()) {
      onRenameSheet(id, tempName.trim());
    }
    setEditingSheetId(null);
  };

  return (
    <footer className="h-8 bg-[#f3f2f1] border-t border-[#d2d0ce] flex items-center justify-between px-2 select-none text-xs z-40 shadow-xs">
      {/* 1. Selector de Hojas de cálculo de Excel */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-xl">
        {/* Controles de desplazamiento de hojas */}
        <div className="flex items-center text-gray-500 mr-1">
          <button
            type="button"
            className="p-1 hover:bg-[#edebe9] rounded transition-colors"
            title="Primera hoja"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-[#edebe9] rounded transition-colors"
            title="Última hoja"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Pestañas de hojas */}
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const isRenaming = editingSheetId === sheet.id;

          return (
            <div
              key={sheet.id}
              onClick={() => onSelectSheet(sheet.id)}
              onDoubleClick={() => {
                setEditingSheetId(sheet.id);
                setTempName(sheet.name);
              }}
              className={`h-7 px-3.5 flex items-center gap-1.5 font-medium cursor-pointer transition-all border-r border-[#d2d0ce] relative ${
                isActive
                  ? "bg-white text-[#107c41] font-bold border-b-2 border-b-white border-t-2 border-t-[#107c41] shadow-xs"
                  : "bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9] hover:text-[#201f1e]"
              }`}
            >
              {isRenaming ? (
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={() => handleFinishRename(sheet.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFinishRename(sheet.id);
                    if (e.key === "Escape") setEditingSheetId(null);
                  }}
                  autoFocus
                  className="w-16 px-1 py-0.5 text-xs bg-white border border-[#107c41] focus:outline-none"
                />
              ) : (
                <span className="truncate">{sheet.name}</span>
              )}
            </div>
          );
        })}

        {/* Botón agregar nueva hoja (+) */}
        <button
          type="button"
          onClick={onAddSheet}
          title="Nueva hoja"
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#dff6dd] text-gray-600 hover:text-[#107c41] transition-colors ml-1"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 2. Barra de Estado y Métricas Automáticas de Excel (SUMA, PROMEDIO, RECUENTO) */}
      <div className="flex items-center gap-4 text-[11px] font-mono text-[#595959]">
        {/* Indicador de estado */}
        <span className="font-bold text-[#107c41] uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-[#dff6dd]">
          {isEditing ? "Modo Edición" : "Listo"}
        </span>

        {/* Estadísticas en vivo */}
        {stats.numericCount > 0 && (
          <div className="hidden md:flex items-center gap-3 border-l border-gray-300 pl-3">
            <span>
              PROMEDIO:{" "}
              <strong className="text-[#201f1e]">
                {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(stats.average)}
              </strong>
            </span>
            <span>
              RECUENTO: <strong className="text-[#201f1e]">{stats.count}</strong>
            </span>
            <span>
              SUMA:{" "}
              <strong className="text-[#201f1e]">
                {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(stats.sum)}
              </strong>
            </span>
          </div>
        )}

        {/* Controles de Zoom */}
        <div className="flex items-center gap-1 border-l border-gray-300 pl-3">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
            className="p-1 hover:bg-[#edebe9] rounded transition-colors"
            title="Reducir zoom"
          >
            <Minus size={11} />
          </button>
          <span className="w-9 text-center font-bold text-[10px]">{zoom}%</span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            className="p-1 hover:bg-[#edebe9] rounded transition-colors"
            title="Aumentar zoom"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>
    </footer>
  );
};
