// Barra superior de CoffeeUI/UX: menú, herramientas, nombre del archivo,
// zoom, presentar, exportar y controles de la ventana.

import React, { useEffect, useRef, useState } from "react";
import {
  Menu,
  MousePointer2,
  Hand,
  Frame,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Hexagon,
  Star,
  PenTool,
  Pencil,
  Type,
  Image as ImageIcon,
  Play,
  Upload,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  ChevronDown,
  X,
  Square as Max,
} from "lucide-react";
import { appWindow } from "../services/desktop";
import { DEVICES, type Tool } from "../types";
import type { MenuDefinition, SaveStatus } from "./SuiteHeader";

interface Props {
  title: string;
  onTitle: (t: string) => void;
  menus: MenuDefinition[];
  saveStatus: SaveStatus;
  tool: Tool;
  onTool: (t: Tool) => void;
  onDevice: (deviceId: string) => void;
  onImage: () => void;
  zoom: number;
  onZoom: (action: "in" | "out" | "100" | "fit" | "selection") => void;
  onPresent: () => void;
  onExport: () => void;
  onLogo: () => void;
  onBeforeClose: () => Promise<void>;
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.FC<{ size?: number }> }[] = [
  { id: "move", label: "Mover", key: "V", icon: MousePointer2 },
  { id: "hand", label: "Mano", key: "H", icon: Hand },
  { id: "frame", label: "Marco", key: "F", icon: Frame },
  { id: "rect", label: "Rectángulo", key: "R", icon: Square },
  { id: "ellipse", label: "Elipse", key: "O", icon: Circle },
  { id: "line", label: "Línea", key: "L", icon: Minus },
  { id: "arrow", label: "Flecha", key: "Mayús+L", icon: MoveUpRight },
  { id: "polygon", label: "Polígono", key: "", icon: Hexagon },
  { id: "star", label: "Estrella", key: "", icon: Star },
  { id: "pen", label: "Pluma", key: "P", icon: PenTool },
  { id: "pencil", label: "Lápiz", key: "Mayús+P", icon: Pencil },
  { id: "text", label: "Texto", key: "T", icon: Type },
];

const STATUS: Record<SaveStatus, string> = { saved: "Guardado", saving: "Guardando…", dirty: "Sin guardar", error: "Error al guardar" };

export const TopBar: React.FC<Props> = (p) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t)) setMenuOpen(false);
      if (!deviceRef.current?.contains(t)) setDeviceOpen(false);
      if (!zoomRef.current?.contains(t)) setZoomOpen(false);
    };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, []);

  const btn = (active: boolean) => `h-8 w-8 rounded-md flex items-center justify-center ${active ? "bg-[#ffc400] text-[#2b2100]" : "text-[#e6e6e6] hover:bg-[#3d3d3d]"}`;
  const StatusIcon = p.saveStatus === "saving" ? Loader2 : p.saveStatus === "error" ? CloudOff : Cloud;
  const groups = ["Móvil", "Tableta", "Escritorio", "Web"] as const;

  return (
    <header data-tauri-drag-region data-topbar className="h-11 shrink-0 flex items-center gap-1 px-2 bg-[#2c2c2c] text-white select-none relative z-40">
      <button type="button" onClick={p.onLogo} title="Pantalla de inicio" className="w-7 h-7 shrink-0 mr-1">
        <img src="/app-icon.png" alt="" className="w-full h-full" draggable={false} />
      </button>

      <div ref={menuRef} className="relative">
        <button type="button" data-menu onClick={() => setMenuOpen((v) => !v)} className={btn(menuOpen)} title="Menú">
          <Menu size={16} />
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-10 w-72 max-h-[78vh] overflow-y-auto rounded-lg bg-[#1e1e1e] border border-[#383838] shadow-2xl py-1.5 z-50">
            {p.menus.map((menu, mi) => (
              <div key={menu.id} className={mi ? "border-t border-[#333] mt-1 pt-1" : ""}>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffc400]">{menu.label}</div>
                {menu.items.map((item, i) =>
                  "divider" in item ? null : (
                    <button
                      key={i}
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        setMenuOpen(false);
                        item.action?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-left text-[#eaeaea] hover:bg-[#0d99ff] disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      {item.icon ? <item.icon size={14} className="shrink-0 opacity-80" /> : <span className="w-3.5" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.checked && <Check size={13} />}
                      {item.shortcut && <span className="text-[10px] font-mono text-[#9a9a9a]">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-[#444] mx-1" />

      <div className="flex items-center gap-0.5" data-tools>
        {TOOLS.map((t) => (
          <React.Fragment key={t.id}>
            <button type="button" data-tool={t.id} onClick={() => p.onTool(t.id)} className={btn(p.tool === t.id)} title={`${t.label}${t.key ? ` (${t.key})` : ""}`}>
              <t.icon size={16} />
            </button>
            {t.id === "frame" && (
              <div ref={deviceRef} className="relative">
                <button type="button" data-device-menu onClick={() => setDeviceOpen((v) => !v)} className="h-8 w-4 rounded-md flex items-center justify-center text-[#bbb] hover:bg-[#3d3d3d]" title="Tamaños de dispositivo">
                  <ChevronDown size={12} />
                </button>
                {deviceOpen && (
                  <div className="absolute left-0 top-10 w-64 max-h-[75vh] overflow-y-auto rounded-lg bg-[#1e1e1e] border border-[#383838] shadow-2xl py-1.5 z-50">
                    {groups.map((g) => (
                      <div key={g}>
                        <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#ffc400]">{g}</div>
                        {DEVICES.filter((d) => d.group === g).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            data-device={d.id}
                            onClick={() => {
                              setDeviceOpen(false);
                              p.onDevice(d.id);
                            }}
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-[#eaeaea] hover:bg-[#0d99ff]"
                          >
                            <span>{d.name}</span>
                            <span className="text-[10.5px] text-[#9a9a9a] font-mono">
                              {d.w}×{d.h}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
        <button type="button" data-tool="image" onClick={p.onImage} className={btn(false)} title="Imagen (Ctrl+Mayús+K)">
          <ImageIcon size={16} />
        </button>
      </div>

      <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-center gap-2 min-w-0">
        <input
          value={p.title}
          onChange={(e) => p.onTitle(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          title="Nombre del archivo"
          className="h-7 px-2 rounded-md bg-transparent hover:bg-[#3d3d3d] focus:bg-[#3d3d3d] text-[12.5px] text-center text-white outline-none w-48 min-w-0"
        />
        <span className="flex items-center gap-1 text-[11px] text-[#9a9a9a] shrink-0" title={STATUS[p.saveStatus]}>
          <StatusIcon size={12} className={p.saveStatus === "saving" ? "animate-spin" : ""} />
        </span>
      </div>

      <div ref={zoomRef} className="relative">
        <button type="button" data-zoom onClick={() => setZoomOpen((v) => !v)} className="h-8 px-2 rounded-md text-[12px] text-[#e6e6e6] hover:bg-[#3d3d3d] flex items-center gap-1 font-mono">
          {Math.round(p.zoom * 100)}% <ChevronDown size={11} />
        </button>
        {zoomOpen && (
          <div className="absolute right-0 top-10 w-52 rounded-lg bg-[#1e1e1e] border border-[#383838] shadow-2xl py-1.5 z-50">
            {(
              [
                ["in", "Acercar", "Ctrl +"],
                ["out", "Alejar", "Ctrl −"],
                ["100", "Zoom al 100%", "Ctrl+0"],
                ["fit", "Ver todo", "Mayús+1"],
                ["selection", "Ver la selección", "Mayús+2"],
              ] as const
            ).map(([id, label, key]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setZoomOpen(false);
                  p.onZoom(id);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-[#eaeaea] hover:bg-[#0d99ff]"
              >
                {label} <span className="text-[10px] font-mono text-[#9a9a9a]">{key}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" data-btn="present-top" onClick={p.onPresent} className="h-8 w-8 rounded-md flex items-center justify-center text-[#e6e6e6] hover:bg-[#3d3d3d]" title="Presentar el prototipo (Ctrl+Alt+Intro)">
        <Play size={15} />
      </button>
      <button type="button" data-btn="export-top" onClick={p.onExport} className="h-8 px-3 rounded-md bg-[#0d99ff] hover:bg-[#0a85e0] text-[12px] font-semibold flex items-center gap-1.5" title="Exportar (Ctrl+Mayús+E)">
        <Upload size={14} /> Exportar
      </button>
      <div className="flex items-center ml-1 pl-1 border-l border-[#444]">
        <button type="button" onClick={() => void appWindow.minimize()} className="h-8 w-8 rounded-md flex items-center justify-center text-[#ccc] hover:bg-[#3d3d3d]" title="Minimizar">
          <Minus size={14} />
        </button>
        <button type="button" onClick={() => void appWindow.toggleMaximize()} className="h-8 w-8 rounded-md flex items-center justify-center text-[#ccc] hover:bg-[#3d3d3d]" title="Maximizar">
          <Max size={11} />
        </button>
        <button
          type="button"
          onClick={async () => {
            await Promise.race([p.onBeforeClose().catch(() => undefined), new Promise((r) => setTimeout(r, 4000))]);
            await appWindow.close();
          }}
          className="h-8 w-8 rounded-md flex items-center justify-center text-[#ccc] hover:bg-red-600 hover:text-white"
          title="Cerrar"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
};
