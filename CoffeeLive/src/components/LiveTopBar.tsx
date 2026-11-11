// Barra superior de CoffeeLive: compacta y oscura, como en las apps de
// streaming. Logo, nombre de la colección de escenas, un único menú, el
// estado en directo y los controles de la ventana.

import React, { useEffect, useRef, useState } from "react";
import { Menu, Star, Minus, Square, X, Check, Cloud, CloudOff, Loader2, Settings2, HelpCircle } from "lucide-react";
import { appWindow } from "../services/desktop";
import type { MenuDefinition, SaveStatus } from "./SuiteHeader";

interface LiveTopBarProps {
  title: string;
  placeholder: string;
  onTitleChange: (title: string) => void;
  menus: MenuDefinition[];
  saveStatus: SaveStatus;
  isStarred: boolean;
  onToggleStar: () => void;
  onLogoClick: () => void;
  onSettings: () => void;
  onHelp: () => void;
  live: { recording: boolean; streaming: boolean };
  onRequestClose: () => Promise<boolean>;
  onBeforeClose: () => Promise<void>;
}

const STATUS: Record<SaveStatus, string> = { saved: "Guardado", saving: "Guardando…", dirty: "Cambios sin guardar", error: "Error al guardar" };

export const LiveTopBar: React.FC<LiveTopBarProps> = ({
  title,
  placeholder,
  onTitleChange,
  menus,
  saveStatus,
  isStarred,
  onToggleStar,
  onLogoClick,
  onSettings,
  onHelp,
  live,
  onRequestClose,
  onBeforeClose,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  /** Guarda y cierra; si el guardado tarda más de 4 s, cierra igualmente. */
  const handleClose = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const proceed = await onRequestClose().catch(() => true);
    if (!proceed) {
      closingRef.current = false;
      return;
    }
    try {
      await Promise.race([onBeforeClose().catch(() => undefined), new Promise((r) => window.setTimeout(r, 4000))]);
    } finally {
      await appWindow.close().catch(() => {
        closingRef.current = false;
      });
    }
  };

  const StatusIcon = saveStatus === "saving" ? Loader2 : saveStatus === "error" ? CloudOff : Cloud;
  const iconBtn = "h-7 w-7 rounded-md flex items-center justify-center text-[#cdb4a2] hover:bg-[#2a1d16] hover:text-white";

  return (
    <header data-tauri-drag-region data-live-topbar className="h-10 shrink-0 flex items-center gap-2 px-2 bg-[#0e0907] border-b border-[#2a1d16] text-[#f5e9df] select-none relative z-40">
      <button type="button" onClick={onLogoClick} title="Pantalla de inicio" className="w-7 h-7 shrink-0">
        <img src="/app-icon.png" alt="" className="w-full h-full" draggable={false} />
      </button>

      <div ref={menuRef} className="relative">
        <button type="button" onClick={() => setOpen((v) => !v)} className={`${iconBtn} ${open ? "bg-[#2a1d16] text-white" : ""}`} title="Menú" data-live-menu>
          <Menu size={16} />
        </button>
        {open && (
          <div className="absolute left-0 top-9 w-72 max-h-[75vh] overflow-y-auto rounded-lg bg-[#1c1310] border border-[#3a2b23] shadow-2xl py-1.5 z-50">
            {menus.map((menu, mi) => (
              <div key={menu.id} className={mi ? "border-t border-[#2e211b] mt-1 pt-1" : ""}>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c8854f]">{menu.label}</div>
                {menu.items.map((item, i) =>
                  "divider" in item ? null : (
                    <button
                      key={`${menu.id}-${i}`}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        setOpen(false);
                        item.action?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-left text-[#f0dccb] hover:bg-[#2c201a] disabled:opacity-40"
                    >
                      {item.icon ? <item.icon size={14} className="text-[#ff8a2a] shrink-0" /> : <span className="w-3.5" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.checked && <Check size={13} className="text-[#ff8a2a]" />}
                      {item.shortcut && <span className="text-[10px] font-mono text-[#8a6f5f]">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <span className="text-[12px] font-semibold text-[#ff8a2a] pl-1">CoffeeLive</span>
      <span className="text-[#4a362b]">/</span>
      <input
        value={title}
        placeholder={placeholder}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        title="Nombre de la colección de escenas"
        className="h-7 px-2 rounded-md bg-transparent hover:bg-[#1c1310] focus:bg-[#1c1310] text-[13px] text-white outline-none w-56 border border-transparent focus:border-[#3a2b23]"
      />
      <button type="button" onClick={onToggleStar} title={isStarred ? "Quitar de fijados" : "Fijar en el Launcher"} className={iconBtn}>
        <Star size={14} className={isStarred ? "fill-[#ffb300] text-[#ffb300]" : ""} />
      </button>
      <span className="flex items-center gap-1 text-[11px] text-[#8a6f5f]" title={STATUS[saveStatus]}>
        <StatusIcon size={13} className={saveStatus === "saving" ? "animate-spin" : ""} />
        {STATUS[saveStatus]}
      </span>

      <div data-tauri-drag-region className="flex-1 h-full" />

      {live.streaming && (
        <span className="px-2 py-0.5 rounded bg-red-600 text-[10px] font-bold tracking-wide text-white animate-pulse">EN DIRECTO</span>
      )}
      {live.recording && (
        <span className="px-2 py-0.5 rounded border border-red-500 text-[10px] font-bold tracking-wide text-red-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> REC
        </span>
      )}
      <button type="button" onClick={onSettings} title="Ajustes (Ctrl+,)" className={iconBtn}>
        <Settings2 size={15} />
      </button>
      <button type="button" onClick={onHelp} title="Guía rápida" className={iconBtn}>
        <HelpCircle size={15} />
      </button>
      <div className="flex items-center ml-1 pl-1 border-l border-[#2a1d16]">
        <button type="button" onClick={() => void appWindow.minimize()} className={iconBtn} title="Minimizar">
          <Minus size={14} />
        </button>
        <button type="button" onClick={() => void appWindow.toggleMaximize()} className={iconBtn} title="Maximizar / Restaurar">
          <Square size={11} />
        </button>
        <button type="button" onClick={() => void handleClose()} className={`${iconBtn} hover:!bg-red-600`} title="Cerrar">
          <X size={15} />
        </button>
      </div>
    </header>
  );
};
