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
  Save,
  Download,
  Printer,
  Undo2,
  Redo2,
  Search,
  CheckSquare,
  Sparkles,
  HelpCircle,
  Shield,
  FileText,
  ChevronDown,
} from "lucide-react";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

interface GoogleDocsHeaderProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  isSaving: boolean;
  onNewDocument: () => void;
  onSave: () => void;
  onOpenExportModal: () => void;
  onPrint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenFindReplace: () => void;
  onOpenWordCount: () => void;
  onOpenHelp: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  isProtected: boolean;
  onToggleProtected: () => void;
  onInsertTable?: () => void;
}

export const GoogleDocsHeader: React.FC<GoogleDocsHeaderProps> = ({
  title,
  onTitleChange,
  isSaving,
  onNewDocument,
  onSave,
  onOpenExportModal,
  onPrint,
  onUndo,
  onRedo,
  onOpenFindReplace,
  onOpenWordCount,
  onOpenHelp,
  zenMode,
  onToggleZenMode,
  showRuler,
  onToggleRuler,
  outlineOpen,
  onToggleOutline,
  isProtected,
  onToggleProtected,
  onInsertTable,
}) => {
  const [isStarred, setIsStarred] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú desplegable al hacer clic fuera
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
        { label: "Nuevo documento", icon: FilePlus, action: onNewDocument, shortcut: "Ctrl+N" },
        { label: "Guardar en la bóveda", icon: Save, action: onSave, shortcut: "Ctrl+S" },
        { label: "Descargar / Exportar...", icon: Download, action: onOpenExportModal },
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
        { label: "Buscar y reemplazar", icon: Search, action: onOpenFindReplace, shortcut: "Ctrl+F" },
        { label: "Seleccionar todo", icon: CheckSquare, action: () => document.execCommand("selectAll"), shortcut: "Ctrl+A" },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        {
          label: showRuler ? "Ocultar regla" : "Mostrar regla",
          action: onToggleRuler,
        },
        {
          label: outlineOpen ? "Ocultar esquema" : "Mostrar esquema del documento",
          action: onToggleOutline,
        },
        {
          label: zenMode ? "Salir de pantalla completa" : "Pantalla completa (Modo Zen)",
          action: onToggleZenMode,
        },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        {
          label: "Tabla",
          action: () => {
            if (onInsertTable) onInsertTable();
          },
        },
        {
          label: "Imagen",
          action: () => {
            const url = window.prompt("Introduce la URL de la imagen:");
            if (url) document.execCommand("insertImage", false, url);
          },
        },
        {
          label: "Enlace",
          action: () => {
            const url = window.prompt("Introduce el enlace:");
            if (url) document.execCommand("createLink", false, url);
          },
        },
        {
          label: "Línea horizontal",
          action: () => document.execCommand("insertHorizontalRule"),
        },
      ],
    },
    {
      id: "formato",
      label: "Formato",
      items: [
        { label: "Negrita", action: () => document.execCommand("bold"), shortcut: "Ctrl+B" },
        { label: "Cursiva", action: () => document.execCommand("italic"), shortcut: "Ctrl+I" },
        { label: "Subrayado", action: () => document.execCommand("underline"), shortcut: "Ctrl+U" },
        { label: "Borrar formato", action: () => document.execCommand("removeFormat") },
      ],
    },
    {
      id: "herramientas",
      label: "Herramientas",
      items: [
        { label: "Contar palabras", icon: FileText, action: onOpenWordCount },
        {
          label: isProtected ? "Desproteger documento" : "Proteger documento",
          icon: Shield,
          action: onToggleProtected,
        },
      ],
    },
    {
      id: "gemini",
      label: "Gemini",
      items: [
        {
          label: "Ayúdame a redactar...",
          icon: Sparkles,
          action: () => {
            const prompt = window.prompt("¿Sobre qué tema deseas generar contenido?");
            if (prompt) {
              document.execCommand(
                "insertHTML",
                false,
                `<p><em>Generado con Gemini:</em> En respuesta a "<strong>${prompt}</strong>", se presenta este contenido estructurado para el documento.</p>`
              );
            }
          },
        },
      ],
    },
    {
      id: "extensiones",
      label: "Extensiones",
      items: [
        { label: "Complementos de CoffeWorks", action: () => {} },
        { label: "Integración Zotero", action: () => {} },
      ],
    },
    {
      id: "zotero",
      label: "Zotero",
      items: [
        { label: "Añadir / editar cita", action: () => {} },
        { label: "Añadir bibliografía", action: () => {} },
      ],
    },
    {
      id: "ayuda",
      label: "Ayuda",
      items: [
        { label: "Ayuda de CoffeDoc", icon: HelpCircle, action: onOpenHelp },
        { label: "Atajos de teclado", action: onOpenHelp, shortcut: "Ctrl+/" },
      ],
    },
  ];

  return (
    <header
      data-tauri-drag-region
      className="bg-[#f9fbfd] border-b border-[#e1dfdd]/60 select-none px-4 pt-2 pb-1 text-xs text-[#444746] relative z-40"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Lado izquierdo: Icono de Google Docs + Título + Menús */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Icono de Google Docs (Hoja azul con líneas blancas) */}
          <div
            className="w-9 h-10 shrink-0 cursor-pointer pt-0.5"
            title="Página principal de Documentos"
            onClick={onNewDocument}
          >
            <svg viewBox="0 0 40 40" fill="none" className="w-full h-full drop-shadow-xs">
              <path
                d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
                fill="#4285F4"
              />
              <path d="M24 4V13H33L24 4Z" fill="#A1C2FA" />
              <rect x="12" y="17" width="16" height="2" rx="1" fill="white" />
              <rect x="12" y="22" width="16" height="2" rx="1" fill="white" />
              <rect x="12" y="27" width="11" height="2" rx="1" fill="white" />
            </svg>
          </div>

          <div className="flex flex-col min-w-0 flex-1" ref={menuRef}>
            {/* Fila superior: Nombre de documento + Estrella */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                title="Renombrar documento"
                placeholder="Documento sin título"
                className="font-medium text-[18px] text-[#1f1f1f] leading-tight bg-transparent hover:border-gray-400 focus:border-[#1a73e8] border border-transparent rounded px-1.5 py-0.5 outline-none transition-colors max-w-md truncate"
              />

              <button
                type="button"
                onClick={() => setIsStarred(!isStarred)}
                title={isStarred ? "Destacado" : "Destacar documento"}
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

            {/* Fila inferior: Barra de menús estándar de Google Docs */}
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

                    {/* Menú desplegable */}
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

        {/* Lado derecho: Estado de guardado + Historial + Meet + Compartir + Avatar */}
        <div className="flex items-center gap-2 shrink-0 pb-1">
          {/* Indicador de estado de guardado en la nube/bóveda */}
          <div
            className="flex items-center gap-1.5 text-xs text-[#444746] px-2 py-1"
            title={isSaving ? "Guardando cambios..." : "Guardado en la bóveda"}
          >
            <Cloud size={16} className={isSaving ? "animate-pulse text-[#1a73e8]" : "text-[#444746]"} />
          </div>

          {/* Historial de comentarios */}
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-200/60 text-[#444746] transition-colors"
            title="Abrir historial de comentarios"
          >
            <MessageSquare size={18} />
          </button>

          {/* Icono de Meet / Videollamada */}
          <button
            type="button"
            className="flex items-center gap-1 p-2 rounded-full hover:bg-gray-200/60 text-[#444746] transition-colors"
            title="Unirse a una videollamada aquí o presentar esta pestaña"
          >
            <Video size={18} />
            <ChevronDown size={12} />
          </button>

          {/* Botón oficial de Compartir de Google Workspace */}
          <button
            type="button"
            onClick={onOpenExportModal}
            className="bg-[#c2e7ff] hover:bg-[#b3dcfa] text-[#001d35] font-semibold text-xs px-5 py-2 rounded-full flex items-center gap-2 transition-all shadow-none"
            title="Compartir o exportar documento"
          >
            <Lock size={14} className="text-[#001d35]" />
            <span>Compartir</span>
          </button>

          {/* Avatar del usuario de Google */}
          <div
            className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-xs ml-1"
            title="Cuenta de Google / CoffeWorks"
          >
            U
          </div>

          {/* Controles de ventana si se ejecuta dentro de Tauri */}
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
