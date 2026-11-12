import React, { useEffect, useRef, useState } from "react";
import { Plus, Menu, ChevronDown, Minus, Pencil, Copy, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { SelectionStats, Sheet } from "../types";

interface SheetTabsBarProps {
  sheets: Sheet[];
  activeSheetId: string;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (id: string, name: string) => void;
  onDuplicateSheet: (id: string) => void;
  onDeleteSheet: (id: string) => void;
  onMoveSheet: (id: string, direction: -1 | 1) => void;
  isEditing: boolean;
  stats: SelectionStats;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Indicador del corrector ortográfico. */
  spellSlot?: React.ReactNode;
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);

export const SheetTabsBar: React.FC<SheetTabsBarProps> = ({
  sheets,
  activeSheetId,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDuplicateSheet,
  onDeleteSheet,
  onMoveSheet,
  isEditing,
  stats,
  zoom,
  onZoomChange,
  spellSlot,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuId && !listOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-sheet-popup]")) {
        setMenuId(null);
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [menuId, listOpen]);

  const finishRename = (id: string) => {
    const name = tempName.trim();
    if (name) onRenameSheet(id, name);
    setRenamingId(null);
  };

  const startRename = (sheet: Sheet) => {
    setMenuId(null);
    setRenamingId(sheet.id);
    setTempName(sheet.name);
  };

  const popupClass = "absolute bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[180px]";
  const itemClass =
    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[#1f1f1f] hover:bg-[#f0f4f9] disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <footer
      ref={rootRef}
      className="h-9 bg-[#f0f4f9] border-t border-[#e1dfdd] flex items-center justify-between px-3 select-none text-xs z-40 shrink-0 print:hidden"
    >
      <div className="flex items-center gap-1.5 min-w-0 py-1">
        <button
          type="button"
          onClick={onAddSheet}
          title="Añadir hoja"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200/80 text-[#444746] shrink-0"
        >
          <Plus size={16} />
        </button>

        <div className="relative shrink-0" data-sheet-popup>
          <button
            type="button"
            onClick={() => setListOpen((open) => !open)}
            title="Todas las hojas"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200/80 text-[#444746]"
          >
            <Menu size={15} />
          </button>
          {listOpen && (
            <div className={`${popupClass} left-0 max-h-72 overflow-y-auto`}>
              {sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() => {
                    setListOpen(false);
                    onSelectSheet(sheet.id);
                  }}
                  className={itemClass}
                >
                  {sheet.id === activeSheetId ? <Check size={13} className="text-[#0F9D58]" /> : <span className="w-[13px]" />}
                  <span className="truncate">{sheet.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 mx-1 shrink-0" />

        <div className="flex items-center gap-0.5 overflow-x-auto min-w-0">
          {sheets.map((sheet, index) => {
            const isActive = sheet.id === activeSheetId;
            return (
              <div key={sheet.id} className="relative shrink-0" data-sheet-popup>
                <div
                  onClick={() => onSelectSheet(sheet.id)}
                  onDoubleClick={() => startRename(sheet)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onSelectSheet(sheet.id);
                    setMenuId(sheet.id);
                  }}
                  className={`h-7 px-3.5 flex items-center gap-1.5 font-medium cursor-pointer transition-all rounded-t-md text-xs ${
                    isActive
                      ? "bg-white text-[#1f1f1f] font-semibold border-t-2 border-t-[#0F9D58] shadow-xs"
                      : "bg-transparent text-[#444746] hover:bg-white/60"
                  }`}
                >
                  {renamingId === sheet.id ? (
                    <input
                      type="text"
                      value={tempName}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => finishRename(sheet.id)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") finishRename(sheet.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-24 px-1 py-0.5 text-xs bg-white border border-[#0F9D58] focus:outline-none rounded select-text"
                    />
                  ) : (
                    <>
                      <span className="truncate max-w-[140px]">{sheet.name}</span>
                      {isActive && (
                        <button
                          type="button"
                          title="Opciones de la hoja"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === sheet.id ? null : sheet.id);
                          }}
                          className="rounded hover:bg-gray-200 p-0.5 -mr-1.5"
                        >
                          <ChevronDown size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {menuId === sheet.id && (
                  <div className={`${popupClass} left-0`}>
                    <button type="button" className={itemClass} onClick={() => startRename(sheet)}>
                      <Pencil size={13} /> Cambiar nombre
                    </button>
                    <button
                      type="button"
                      className={itemClass}
                      onClick={() => {
                        setMenuId(null);
                        onDuplicateSheet(sheet.id);
                      }}
                    >
                      <Copy size={13} /> Duplicar
                    </button>
                    <button
                      type="button"
                      className={itemClass}
                      disabled={index === 0}
                      onClick={() => {
                        setMenuId(null);
                        onMoveSheet(sheet.id, -1);
                      }}
                    >
                      <ArrowLeft size={13} /> Mover a la izquierda
                    </button>
                    <button
                      type="button"
                      className={itemClass}
                      disabled={index === sheets.length - 1}
                      onClick={() => {
                        setMenuId(null);
                        onMoveSheet(sheet.id, 1);
                      }}
                    >
                      <ArrowRight size={13} /> Mover a la derecha
                    </button>
                    <div className="h-px bg-gray-200 my-1" />
                    <button
                      type="button"
                      className={`${itemClass} !text-[#b3261e]`}
                      disabled={sheets.length <= 1}
                      onClick={() => {
                        setMenuId(null);
                        onDeleteSheet(sheet.id);
                      }}
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-[#444746] shrink-0 pl-3">
        {spellSlot}
        {isEditing && (
          <span className="text-[10px] bg-emerald-100 text-[#0F9D58] px-2 py-0.5 rounded font-medium">Editando</span>
        )}
        {stats.count > 1 && (
          <div className="flex items-center gap-3">
            {stats.numericCount > 0 && (
              <>
                <span>
                  Suma: <strong className="text-[#1f1f1f]">{formatNumber(stats.sum)}</strong>
                </span>
                <span>
                  Promedio: <strong className="text-[#1f1f1f]">{formatNumber(stats.average)}</strong>
                </span>
                <span className="hidden lg:inline">
                  Mín: <strong className="text-[#1f1f1f]">{formatNumber(stats.min)}</strong>
                </span>
                <span className="hidden lg:inline">
                  Máx: <strong className="text-[#1f1f1f]">{formatNumber(stats.max)}</strong>
                </span>
              </>
            )}
            <span>
              Recuento: <strong className="text-[#1f1f1f]">{stats.count}</strong>
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 text-gray-500">
          <button type="button" onClick={() => onZoomChange(Math.max(50, zoom - 10))} className="p-1 hover:bg-gray-200 rounded" title="Alejar">
            <Minus size={11} />
          </button>
          <button type="button" onClick={() => onZoomChange(100)} className="text-[10px] font-mono w-9 hover:bg-gray-200 rounded" title="Restablecer zoom">
            {zoom}%
          </button>
          <button type="button" onClick={() => onZoomChange(Math.min(200, zoom + 10))} className="p-1 hover:bg-gray-200 rounded" title="Acercar">
            <Plus size={11} />
          </button>
        </div>
      </div>
    </footer>
  );
};
