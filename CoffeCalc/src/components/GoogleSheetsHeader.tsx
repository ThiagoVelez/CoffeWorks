import React, { useState, useRef, useEffect } from "react";
import {
  Star,
  Cloud,
  MessageSquare,
  Video,
  Lock,
  Minus,
  Square,
  X,
  FilePlus,
  FolderOpen,
  Save,
  Download,
  Printer,
  Undo2,
  Redo2,
  CheckSquare,
  Sparkles,
  HelpCircle,
  Shield,
  Filter,
  BarChart3,
  ChevronDown,
} from "lucide-react";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

interface GoogleSheetsHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImport: () => void;
  onNewWorkbook: () => void;
  onPrint: () => void;
  isSaving: boolean;
  showGridlines: boolean;
  onToggleGridlines: () => void;
  showFormulaBar: boolean;
  onToggleFormulaBar: () => void;
  isSheetProtected: boolean;
  onToggleProtectSheet: () => void;
  isFilterActive: boolean;
  onToggleFilter: () => void;
  onInsertChart: () => void;
  onSpellCheck: () => void;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onInsertRowOrCol?: (type: "row" | "col", after?: boolean) => void;
  onDeleteRowOrCol?: (type: "row" | "col") => void;
  onCut?: () => void;
  onPaste?: () => void;
  onToggleRawFormulas?: () => void;
  onToggleFreezePanes?: () => void;
  onConditionalFormatting?: () => void;
  onFormatAsTable?: () => void;
  onTextToColumns?: () => void;
  onRemoveDuplicates?: () => void;
  onInsertAverage?: () => void;
  onInsertCount?: () => void;
  onInsertMax?: () => void;
  onInsertMin?: () => void;
}

export const GoogleSheetsHeader: React.FC<GoogleSheetsHeaderProps> = ({
  title,
  onTitleChange,
  onSave,
  onUndo,
  onRedo,
  onExport,
  onImport,
  onNewWorkbook,
  onPrint,
  isSaving,
  showGridlines,
  onToggleGridlines,
  showFormulaBar,
  onToggleFormulaBar,
  isSheetProtected,
  onToggleProtectSheet,
  isFilterActive,
  onToggleFilter,
  onInsertChart,
  onSpellCheck,
  onSortAsc,
  onSortDesc,
  onInsertRowOrCol,
  onDeleteRowOrCol,
  onCut,
  onPaste,
  onToggleRawFormulas,
  onToggleFreezePanes,
  onConditionalFormatting,
  onFormatAsTable,
  onTextToColumns,
  onRemoveDuplicates,
  onInsertAverage,
  onInsertCount,
  onInsertMax,
  onInsertMin,
}) => {
  const [isStarred, setIsStarred] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMinimize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch (err) {
        console.warn(err);
      }
    } else {
      window.close();
    }
  };

  const menus = [
    {
      id: "archivo",
      label: "Archivo",
      items: [
        { label: "Nuevo libro", icon: FilePlus, action: onNewWorkbook, shortcut: "Ctrl+N" },
        { label: "Abrir archivo...", icon: FolderOpen, action: onImport, shortcut: "Ctrl+O" },
        { label: "Guardar libro", icon: Save, action: onSave, shortcut: "Ctrl+S" },
        { label: "Descargar / Exportar...", icon: Download, action: onExport },
        { divider: true },
        { label: "Imprimir", icon: Printer, action: onPrint, shortcut: "Ctrl+P" },
      ],
    },
    {
      id: "editar",
      label: "Editar",
      items: [
        { label: "Deshacer", icon: Undo2, action: onUndo, shortcut: "Ctrl+Z" },
        { label: "Rehacer", icon: Redo2, action: onRedo, shortcut: "Ctrl+Y" },
        { divider: true },
        { label: "Cortar", action: () => onCut?.(), shortcut: "Ctrl+X" },
        { label: "Pegar", action: () => onPaste?.(), shortcut: "Ctrl+V" },
        { divider: true },
        { label: "Seleccionar todo", icon: CheckSquare, action: () => {}, shortcut: "Ctrl+A" },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        {
          label: showGridlines ? "Ocultar líneas de cuadrícula" : "Mostrar líneas de cuadrícula",
          action: onToggleGridlines,
        },
        {
          label: showFormulaBar ? "Ocultar barra de fórmulas" : "Mostrar barra de fórmulas",
          action: onToggleFormulaBar,
        },
        {
          label: "Mostrar fórmulas directas",
          action: () => onToggleRawFormulas?.(),
        },
        {
          label: "Inmovilizar paneles",
          action: () => onToggleFreezePanes?.(),
        },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        { label: "Fila encima", action: () => onInsertRowOrCol?.("row", false) },
        { label: "Fila debajo", action: () => onInsertRowOrCol?.("row", true) },
        { label: "Columna a la izquierda", action: () => onInsertRowOrCol?.("col", false) },
        { label: "Columna a la derecha", action: () => onInsertRowOrCol?.("col", true) },
        { label: "Eliminar fila", action: () => onDeleteRowOrCol?.("row") },
        { label: "Eliminar columna", action: () => onDeleteRowOrCol?.("col") },
        { divider: true },
        { label: "Gráfico", icon: BarChart3, action: onInsertChart },
        { label: "Función: PROMEDIO", action: () => onInsertAverage?.() },
        { label: "Función: CONTAR", action: () => onInsertCount?.() },
        { label: "Función: MAX", action: () => onInsertMax?.() },
        { label: "Función: MIN", action: () => onInsertMin?.() },
      ],
    },
    {
      id: "formato",
      label: "Formato",
      items: [
        { label: "Formato condicional", action: () => onConditionalFormatting?.() },
        { label: "Dar formato como tabla", action: () => onFormatAsTable?.() },
      ],
    },
    {
      id: "datos",
      label: "Datos",
      items: [
        { label: "Ordenar hoja de A a Z", action: () => onSortAsc?.() },
        { label: "Ordenar hoja de Z a A", action: () => onSortDesc?.() },
        { divider: true },
        { label: "Texto en columnas", action: () => onTextToColumns?.() },
        { label: "Quitar duplicados", action: () => onRemoveDuplicates?.() },
        { divider: true },
        {
          label: isFilterActive ? "Desactivar filtro" : "Crear un filtro",
          icon: Filter,
          action: onToggleFilter,
        },
        {
          label: isSheetProtected ? "Desproteger hoja" : "Proteger hoja y rangos",
          icon: Shield,
          action: onToggleProtectSheet,
        },
      ],
    },
    {
      id: "herramientas",
      label: "Herramientas",
      items: [
        { label: "Ortografía", action: onSpellCheck },
      ],
    },
    {
      id: "gemini",
      label: "Gemini",
      items: [
        {
          label: "Generar fórmulas con IA...",
          icon: Sparkles,
          action: () => {
            const prompt = window.prompt("¿Qué cálculo deseas automatizar en esta hoja?");
            if (prompt) {
              alert(`Gemini sugiere la fórmula matricial correspondiente a: ${prompt}`);
            }
          },
        },
      ],
    },
    {
      id: "extensiones",
      label: "Extensiones",
      items: [
        { label: "Complementos de Hojas de cálculo", action: () => {} },
      ],
    },
    {
      id: "ayuda",
      label: "Ayuda",
      items: [
        { label: "Ayuda de CoffeCalc", icon: HelpCircle, action: () => {} },
        { label: "Atajos de teclado", action: () => {}, shortcut: "Ctrl+/" },
      ],
    },
  ];

  return (
    <header
      data-tauri-drag-region
      className="bg-[#f9fbfd] border-b border-[#e1dfdd]/60 select-none px-4 pt-2 pb-1 text-xs text-[#444746] relative z-40"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Lado izquierdo: Icono de Google Sheets + Título + Menús */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Icono de Google Sheets (Hoja verde con cuadrícula) */}
          <div
            className="w-9 h-10 shrink-0 cursor-pointer pt-0.5"
            title="Página principal de Hojas de cálculo"
            onClick={onNewWorkbook}
          >
            <svg viewBox="0 0 40 40" fill="none" className="w-full h-full drop-shadow-xs">
              <path
                d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
                fill="#0F9D58"
              />
              <path d="M24 4V13H33L24 4Z" fill="#87CEAC" />
              <rect x="11" y="16" width="18" height="15" rx="1" fill="#0F9D58" stroke="white" strokeWidth="1.5" />
              <line x1="11" y1="21" x2="29" y2="21" stroke="white" strokeWidth="1.5" />
              <line x1="11" y1="26" x2="29" y2="26" stroke="white" strokeWidth="1.5" />
              <line x1="17" y1="16" x2="17" y2="31" stroke="white" strokeWidth="1.5" />
            </svg>
          </div>

          <div className="flex flex-col min-w-0 flex-1" ref={menuRef}>
            {/* Fila superior: Nombre de la hoja de cálculo + Estrella */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                title="Renombrar hoja de cálculo"
                placeholder="Hoja de cálculo sin título"
                className="font-medium text-[18px] text-[#1f1f1f] leading-tight bg-transparent hover:border-gray-400 focus:border-[#107c41] border border-transparent rounded px-1.5 py-0.5 outline-none transition-colors max-w-md truncate"
              />

              <button
                type="button"
                onClick={() => setIsStarred(!isStarred)}
                title={isStarred ? "Destacada" : "Destacar hoja de cálculo"}
                className="p-1 rounded-full hover:bg-gray-200/60 text-[#444746] transition-colors"
              >
                <Star
                  size={16}
                  className={
                    isStarred
                      ? "fill-[#f4b400] text-[#f4b400]"
                      : "text-[#444746]"
                  }
                />
              </button>
            </div>

            {/* Fila inferior: Menús estándar de Google Sheets */}
            <div className="flex items-center gap-0.5 mt-0.5 relative">
              {menus.map((menu) => {
                const isOpen = activeMenu === menu.id;

                return (
                  <div key={menu.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenu(isOpen ? null : menu.id)}
                      onMouseEnter={() => {
                        if (activeMenu) setActiveMenu(menu.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[13px] font-normal transition-colors cursor-pointer ${
                        isOpen
                          ? "bg-[#e1dfdd] text-[#1f1f1f]"
                          : "text-[#444746] hover:bg-[#edebe9] hover:text-[#1f1f1f]"
                      }`}
                    >
                      {menu.label}
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 min-w-[220px] z-50">
                        {menu.items.map((item, idx) => {
                          if ("divider" in item && item.divider) {
                            return (
                              <div
                                key={idx}
                                className="h-px bg-gray-200 my-1"
                              />
                            );
                          }

                          const ItemIcon = "icon" in item ? item.icon : null;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if ("action" in item && item.action) {
                                  item.action();
                                }
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9] flex items-center justify-between gap-3 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {ItemIcon ? (
                                  <ItemIcon size={14} className="text-[#444746]" />
                                ) : (
                                  <span className="w-3.5" />
                                )}
                                <span>{"label" in item ? item.label : ""}</span>
                              </div>
                              {"shortcut" in item && item.shortcut && (
                                <span className="font-mono text-[10px] text-gray-400">
                                  {item.shortcut}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lado derecho: Estado de guardado + Comentarios + Meet + Compartir + Avatar */}
        <div className="flex items-center gap-2 shrink-0 pb-1">
          <div
            className="flex items-center gap-1.5 text-xs text-[#444746] px-2 py-1"
            title={isSaving ? "Guardando cambios..." : "Guardado en la nube"}
          >
            <Cloud size={16} className={isSaving ? "animate-pulse text-[#0F9D58]" : "text-[#444746]"} />
          </div>

          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-200/60 text-[#444746] transition-colors"
            title="Historial de comentarios"
          >
            <MessageSquare size={18} />
          </button>

          <button
            type="button"
            className="flex items-center gap-1 p-2 rounded-full hover:bg-gray-200/60 text-[#444746] transition-colors"
            title="Videollamada con Google Meet"
          >
            <Video size={18} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            onClick={onExport}
            className="bg-[#c2e7ff] hover:bg-[#b3dcfa] text-[#001d35] font-semibold text-xs px-5 py-2 rounded-full flex items-center gap-2 transition-all shadow-none"
            title="Compartir o exportar libro"
          >
            <Lock size={14} className="text-[#001d35]" />
            <span>Compartir</span>
          </button>

          <div
            className="w-8 h-8 rounded-full bg-[#0F9D58] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-xs ml-1"
            title="Cuenta de Google / CoffeWorks"
          >
            U
          </div>

          {isTauri && (
            <div className="flex items-center ml-2 border-l border-gray-300 pl-2">
              <button
                type="button"
                onClick={handleMinimize}
                className="p-1 hover:bg-gray-200 rounded text-gray-500"
                title="Minimizar"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                onClick={handleMaximize}
                className="p-1 hover:bg-gray-200 rounded text-gray-500"
                title="Maximizar"
              >
                <Square size={12} />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 hover:bg-red-500 hover:text-white rounded text-gray-500 transition-colors"
                title="Cerrar"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
