// ⚠ Copia de shared/studio/SuiteHeader.tsx: edita el original y ejecuta node scripts/sync-shared.mjs
// Encabezado común de los editores de CoffeeWorks: icono, título editable,
// barra de menús desplegables, acciones a la derecha y controles de ventana.
// La zona libre del encabezado permite arrastrar la ventana sin marco.

import React, { useEffect, useRef, useState } from "react";
import { Star, Minus, Square, X, Check, CloudOff, Cloud, Loader2 } from "lucide-react";
import { appWindow } from "./desktop";

export type MenuEntry =
  | { divider: true }
  | {
      label: string;
      icon?: React.ComponentType<{ size?: number; className?: string }>;
      action?: () => void;
      shortcut?: string;
      /** Muestra una marca de verificación (opciones conmutables). */
      checked?: boolean;
      disabled?: boolean;
    };

export interface MenuDefinition {
  id: string;
  label: string;
  items: MenuEntry[];
}

export type SaveStatus = "saved" | "saving" | "dirty" | "error";

interface SuiteHeaderProps {
  logo: React.ReactNode;
  logoTitle: string;
  onLogoClick: () => void;
  title: string;
  titlePlaceholder: string;
  onTitleChange: (title: string) => void;
  menus: MenuDefinition[];
  saveStatus: SaveStatus;
  /** Ubicación del archivo (se muestra como ayuda sobre el estado de guardado). */
  fileLocation?: string | null;
  isStarred: boolean;
  onToggleStar: () => void;
  /** Botones propios de cada aplicación (Exportar, Presentar...). */
  actions?: React.ReactNode;
  /** Se ejecuta antes de cerrar la ventana para guardar cambios pendientes. */
  onBeforeClose?: () => Promise<void> | void;
  /** Pregunta previa al cierre; si devuelve `false` la ventana no se cierra. */
  onRequestClose?: () => Promise<boolean>;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Guardado",
  saving: "Guardando…",
  dirty: "Cambios sin guardar",
  error: "Error al guardar",
};

export const SuiteHeader: React.FC<SuiteHeaderProps> = ({
  logo,
  logoTitle,
  onLogoClick,
  title,
  titlePlaceholder,
  onTitleChange,
  menus,
  saveStatus,
  fileLocation,
  isStarred,
  onToggleStar,
  actions,
  onBeforeClose,
  onRequestClose,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú abierto al hacer clic fuera o pulsar Escape
  useEffect(() => {
    if (!activeMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [activeMenu]);

  const closingRef = useRef(false);

  /**
   * Guarda lo pendiente y cierra. Si el guardado no termina en 4 segundos la
   * ventana se cierra igualmente: el botón nunca debe quedarse "trabado".
   */
  const handleClose = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (onRequestClose) {
      const proceed = await onRequestClose().catch(() => true);
      if (!proceed) {
        closingRef.current = false;
        return;
      }
    }
    try {
      await Promise.race([
        Promise.resolve(onBeforeClose?.()).catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 4000)),
      ]);
    } finally {
      await appWindow.close().catch(() => {
        closingRef.current = false;
      });
    }
  };

  const StatusIcon =
    saveStatus === "saving" ? Loader2 : saveStatus === "error" ? CloudOff : Cloud;

  return (
    <header
      data-tauri-drag-region
      className="bg-[#1c1c1f] border-b border-black/50 select-none px-3 pt-1.5 pb-1 text-xs text-[#c9c9cf] relative z-40 print:hidden"
    >
      <div data-tauri-drag-region className="flex items-center justify-between gap-4">
        <div data-tauri-drag-region className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            className="w-9 h-10 shrink-0 cursor-pointer pt-0.5"
            title={logoTitle}
            onClick={onLogoClick}
          >
            {logo}
          </button>

          <div data-tauri-drag-region className="flex flex-col min-w-0 flex-1" ref={menuRef}>
            {/* Fila superior: nombre del documento, estrella y estado de guardado */}
            <div data-tauri-drag-region className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                spellCheck={false}
                title="Cambiar nombre"
                placeholder={titlePlaceholder}
                style={{ width: `${Math.min(46, Math.max(10, (title || titlePlaceholder).length + 2))}ch` }}
                className="font-medium text-[15px] text-white leading-tight bg-transparent hover:border-white/20 focus:border-[#ff8a3d] border border-transparent rounded px-1.5 py-0.5 outline-none transition-colors truncate"
              />

              <button
                type="button"
                onClick={onToggleStar}
                title={isStarred ? "Quitar de fijados" : "Fijar en el Launcher"}
                className="p-1 rounded-full hover:bg-white/10 text-[#c9c9cf] transition-colors"
              >
                <Star
                  size={16}
                  className={isStarred ? "fill-[#f4b400] text-[#f4b400]" : "text-[#8b8b93]"}
                />
              </button>

              <span
                className={`flex items-center gap-1 text-[11px] ${
                  saveStatus === "error" ? "text-[#b3261e]" : "text-[#8b8b93]"
                }`}
                title={fileLocation || undefined}
              >
                <StatusIcon size={13} className={saveStatus === "saving" ? "animate-spin" : ""} />
                <span>{STATUS_TEXT[saveStatus]}</span>
              </span>
            </div>

            {/* Fila inferior: barra de menús */}
            <div className="flex items-center gap-0.5 mt-0.5 relative w-fit">
              {menus.map((menu) => {
                const isOpen = activeMenu === menu.id;
                return (
                  <div key={menu.id} className="relative">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setActiveMenu(isOpen ? null : menu.id)}
                      onMouseEnter={() => {
                        if (activeMenu) setActiveMenu(menu.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[13px] font-normal transition-colors cursor-pointer ${
                        isOpen
                          ? "bg-white/15 text-white"
                          : "text-[#c9c9cf] hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {menu.label}
                    </button>

                    {isOpen && (
                      <div
                        role="menu"
                        className="absolute left-0 top-full mt-1 bg-[#2a2a2f] border border-black/60 rounded-lg shadow-2xl py-1.5 min-w-[250px] max-h-[75vh] overflow-y-auto z-50"
                      >
                        {menu.items.map((item, idx) => {
                          if ("divider" in item) {
                            return <div key={idx} className="h-px bg-white/10 my-1" />;
                          }
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={idx}
                              type="button"
                              role="menuitem"
                              disabled={item.disabled}
                              // Evita que el editor pierda la selección al usar el menú
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setActiveMenu(null);
                                item.action?.();
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#e4e4e8] hover:bg-white/10 flex items-center justify-between gap-3 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                              <div className="flex items-center gap-2">
                                {item.checked ? (
                                  <Check size={14} className="text-[#ff8a3d]" />
                                ) : ItemIcon ? (
                                  <ItemIcon size={14} className="text-[#8b8b93]" />
                                ) : (
                                  <span className="w-3.5" />
                                )}
                                <span>{item.label}</span>
                              </div>
                              {item.shortcut && (
                                <span className="font-mono text-[10px] text-[#7a7a82]">
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

        {/* Lado derecho: acciones de la aplicación y controles de ventana */}
        <div className="flex items-center gap-2 shrink-0 pb-1">
          {actions}
          <div className="flex items-center ml-2 border-l border-white/10 pl-2">
            <button
              type="button"
              onClick={() => void appWindow.minimize()}
              className="p-1 hover:bg-white/10 rounded text-[#a5a5ad] transition-colors"
              title="Minimizar"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={() => void appWindow.toggleMaximize()}
              className="p-1 hover:bg-white/10 rounded text-[#a5a5ad] transition-colors"
              title="Maximizar / Restaurar"
            >
              <Square size={12} />
            </button>
            <button
              type="button"
              onClick={() => void handleClose()}
              className="p-1 hover:bg-red-500 hover:text-white rounded text-[#a5a5ad] transition-colors"
              title="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
