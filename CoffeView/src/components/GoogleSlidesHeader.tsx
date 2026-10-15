import React, { useState, useRef, useEffect } from "react";
import {
  Star,
  Cloud,
  MessageSquare,
  Video,
  Play,
  Lock,
  Minus,
  Square,
  X,
  FilePlus,
  Save,
  Download,
  Printer,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  HelpCircle,
  ChevronDown,
} from "lucide-react";

import type { SlideLayout } from "../types";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

interface GoogleSlidesHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onNewPresentation: () => void;
  onStartPresentation: () => void;
  onAddSlide: (layout?: SlideLayout) => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onPrint: () => void;
  isSaving: boolean;
  onToggleHideSlide?: () => void;
  isSlideHidden?: boolean;
  onAddText?: () => void;
  onAddImage?: () => void;
  onAddTable?: () => void;
  onToggleBold?: () => void;
  onToggleItalic?: () => void;
  onToggleUnderline?: () => void;
  onSpellCheck?: () => void;
  onToggleNotes?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onToggleGridlines?: () => void;
  onTranslate?: () => void;
  onChangeAspectRatio?: (ratio: "16:9" | "4:3") => void;
}

export const GoogleSlidesHeader: React.FC<GoogleSlidesHeaderProps> = ({
  title,
  onTitleChange,
  onSave,
  onUndo,
  onRedo,
  onExport,
  onNewPresentation,
  onStartPresentation,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onPrint,
  isSaving,
  onToggleHideSlide,
  isSlideHidden,
  onAddText,
  onAddImage,
  onAddTable,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onSpellCheck,
  onToggleNotes,
  onCut,
  onCopy,
  onPaste,
  onToggleGridlines,
  onTranslate,
  onChangeAspectRatio,
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
        { label: "Nueva presentación", icon: FilePlus, action: onNewPresentation, shortcut: "Ctrl+N" },
        { label: "Guardar", icon: Save, action: onSave, shortcut: "Ctrl+S" },
        { label: "Descargar / Exportar...", icon: Download, action: onExport },
        { divider: true },
        { label: "Pantalla ancha (16:9)", action: () => onChangeAspectRatio?.("16:9") },
        { label: "Estándar (4:3)", action: () => onChangeAspectRatio?.("4:3") },
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
        { label: "Copiar", action: () => onCopy?.(), shortcut: "Ctrl+C" },
        { label: "Pegar", action: () => onPaste?.(), shortcut: "Ctrl+V" },
        { divider: true },
        { label: "Duplicar diapositiva", icon: Copy, action: onDuplicateSlide, shortcut: "Ctrl+D" },
        { label: "Eliminar diapositiva", icon: Trash2, action: onDeleteSlide, shortcut: "Supr" },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        { label: "Iniciar presentación", icon: Play, action: onStartPresentation, shortcut: "F5" },
        { label: "Mostrar/Ocultar notas del orador", action: () => onToggleNotes?.() },
        { label: "Mostrar líneas de cuadrícula", action: () => onToggleGridlines?.() },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        { label: "Cuadro de texto", action: () => onAddText?.() },
        { label: "Imagen", action: () => onAddImage?.() },
        { label: "Tabla", action: () => onAddTable?.() },
      ],
    },
    {
      id: "formato",
      label: "Formato",
      items: [
        { label: "Negrita", action: () => onToggleBold?.(), shortcut: "Ctrl+B" },
        { label: "Cursiva", action: () => onToggleItalic?.(), shortcut: "Ctrl+I" },
        { label: "Subrayado", action: () => onToggleUnderline?.(), shortcut: "Ctrl+U" },
      ],
    },
    {
      id: "diapositiva",
      label: "Diapositiva",
      items: [
        { label: "Nueva diapositiva", action: () => onAddSlide("title-content"), shortcut: "Ctrl+M" },
        { label: "Duplicar diapositiva", action: onDuplicateSlide },
        { label: "Eliminar diapositiva", action: onDeleteSlide },
        {
          label: isSlideHidden ? "Mostrar diapositiva" : "Ocultar diapositiva",
          action: () => onToggleHideSlide?.(),
        },
      ],
    },
    {
      id: "estructura",
      label: "Estructura",
      items: [
        { label: "Centrar en la página", action: () => {} },
      ],
    },
    {
      id: "herramientas",
      label: "Herramientas",
      items: [
        { label: "Ortografía y gramática", action: () => onSpellCheck?.() },
        { label: "Traducir diapositiva", action: () => onTranslate?.() },
        { label: "Diccionario", action: () => {} },
      ],
    },
    {
      id: "extensiones",
      label: "Extensiones",
      items: [
        { label: "Complementos de Presentaciones", action: () => {} },
      ],
    },
    {
      id: "ayuda",
      label: "Ayuda",
      items: [
        { label: "Ayuda de CoffeView", icon: HelpCircle, action: () => {} },
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
        {/* Lado izquierdo: Icono de Google Slides + Título + Menús */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Icono de Google Slides (Hoja amarilla/ámbar con pantalla) */}
          <div
            className="w-9 h-10 shrink-0 cursor-pointer pt-0.5"
            title="Página principal de Presentaciones"
            onClick={onNewPresentation}
          >
            <svg viewBox="0 0 40 40" fill="none" className="w-full h-full drop-shadow-xs">
              <path
                d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
                fill="#F4B400"
              />
              <path d="M24 4V13H33L24 4Z" fill="#FCE8B2" />
              <rect x="11" y="16" width="18" height="14" rx="1.5" fill="#FFE082" stroke="white" strokeWidth="1.5" />
              <rect x="14" y="19" width="12" height="8" rx="0.5" fill="#F4B400" />
            </svg>
          </div>

          <div className="flex flex-col min-w-0 flex-1" ref={menuRef}>
            {/* Fila superior: Nombre de la presentación + Estrella */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                title="Renombrar presentación"
                placeholder="Presentación sin título"
                className="font-medium text-[18px] text-[#1f1f1f] leading-tight bg-transparent hover:border-gray-400 focus:border-[#F4B400] border border-transparent rounded px-1.5 py-0.5 outline-none transition-colors max-w-md truncate"
              />

              <button
                type="button"
                onClick={() => setIsStarred(!isStarred)}
                title={isStarred ? "Destacada" : "Destacar presentación"}
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

            {/* Fila inferior: Menús estándar de Google Slides */}
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

        {/* Lado derecho: Guardado + Comentarios + Meet + Presentación diapositivas + Compartir + Avatar */}
        <div className="flex items-center gap-2 shrink-0 pb-1">
          <div
            className="flex items-center gap-1.5 text-xs text-[#444746] px-2 py-1"
            title={isSaving ? "Guardando cambios..." : "Guardado en Drive"}
          >
            <Cloud size={16} className={isSaving ? "animate-pulse text-[#F4B400]" : "text-[#444746]"} />
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

          {/* Botón Presentación de diapositivas (Google Slides signature button) */}
          <button
            type="button"
            onClick={onStartPresentation}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-300 hover:bg-gray-100 text-[#1f1f1f] font-medium text-xs bg-white shadow-2xs transition-colors"
            title="Presentación de diapositivas (F5)"
          >
            <Play size={13} className="fill-[#1f1f1f] text-[#1f1f1f]" />
            <span>Presentación de diapositivas</span>
            <ChevronDown size={12} className="text-gray-500 ml-0.5" />
          </button>

          {/* Botón Compartir */}
          <button
            type="button"
            onClick={onExport}
            className="bg-[#c2e7ff] hover:bg-[#b3dcfa] text-[#001d35] font-semibold text-xs px-5 py-2 rounded-full flex items-center gap-2 transition-all shadow-none"
            title="Compartir o exportar presentación"
          >
            <Lock size={14} className="text-[#001d35]" />
            <span>Compartir</span>
          </button>

          <div
            className="w-8 h-8 rounded-full bg-[#F4B400] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-xs ml-1"
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
