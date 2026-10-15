import React, { useState } from "react";
import { Plus, Menu, ChevronDown, Minus } from "lucide-react";
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
    <footer className="h-9 bg-[#f0f4f9] border-t border-[#e1dfdd] flex items-center justify-between px-3 select-none text-xs z-40">
      {/* 1. Selector de Hojas estilo Google Sheets (+, Hamburguesa, Pestañas) */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl py-1">
        {/* Botón Añadir hoja (+) */}
        <button
          type="button"
          onClick={onAddSheet}
          title="Añadir hoja"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200/80 text-[#444746] transition-colors cursor-pointer"
        >
          <Plus size={16} />
        </button>

        {/* Botón Todas las hojas (Menú hamburguesa) */}
        <button
          type="button"
          title="Todas las hojas"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200/80 text-[#444746] transition-colors cursor-pointer"
        >
          <Menu size={15} />
        </button>

        <div className="h-4 w-px bg-gray-300 mx-1" />

        {/* Pestañas de hojas con píldora de Google Sheets */}
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
              className={`h-7 px-3.5 flex items-center gap-1.5 font-medium cursor-pointer transition-all rounded-t-md relative text-xs ${
                isActive
                  ? "bg-white text-[#1f1f1f] font-semibold border-t-2 border-t-[#0F9D58] shadow-xs"
                  : "bg-transparent text-[#444746] hover:bg-white/60"
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
                  className="w-16 px-1 py-0.5 text-xs bg-white border border-[#0F9D58] focus:outline-none rounded"
                />
              ) : (
                <>
                  <span className="truncate">{sheet.name}</span>
                  {isActive && <ChevronDown size={11} className="text-[#444746]" />}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Estadísticas automáticas (Suma, Promedio, Recuento) */}
      <div className="flex items-center gap-4 text-[11px] text-[#444746]">
        {isEditing && (
          <span className="text-[10px] bg-emerald-100 text-[#0F9D58] px-2 py-0.5 rounded font-medium">
            Modo Edición
          </span>
        )}
        {stats.numericCount > 0 && (
          <div className="flex items-center gap-3">
            <span>
              Promedio:{" "}
              <strong className="text-[#1f1f1f]">
                {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(stats.average)}
              </strong>
            </span>
            <span>
              Recuento: <strong className="text-[#1f1f1f]">{stats.count}</strong>
            </span>
            <span>
              Suma:{" "}
              <strong className="text-[#1f1f1f]">
                {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(stats.sum)}
              </strong>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 ml-2 text-gray-500">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
            className="p-1 hover:bg-gray-200 rounded"
            title="Alejar"
          >
            <Minus size={11} />
          </button>
          <span className="text-[10px] font-mono">{zoom}%</span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            className="p-1 hover:bg-gray-200 rounded"
            title="Acercar"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>
    </footer>
  );
};
