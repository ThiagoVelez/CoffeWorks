import React from "react";
import {
  Coffee,
  ChevronsUpDown,
  LayoutGrid,
  FolderOpen,
  LayoutTemplate,
  GitFork,
  Settings,
  HardDrive,
  ShieldCheck,
} from "lucide-react";

export type NavTab = "launcher" | "documents" | "templates" | "integrations" | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
    { id: "launcher", label: "Inicio / Launcher", icon: LayoutGrid },
    { id: "documents", label: "Mis Documentos", icon: FolderOpen },
    { id: "templates", label: "Plantillas", icon: LayoutTemplate },
    { id: "integrations", label: "Integraciones", icon: GitFork },
    { id: "settings", label: "Ajustes", icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-10 bottom-0 w-64 bg-[#faf7f2] border-r border-[#e8dfd8] z-40 flex flex-col justify-between py-3 px-2 select-none shadow-xs">
      <div className="flex flex-col gap-3">
        {/* Selector de espacio de trabajo / Bóveda estilo Tostaduría */}
        <div className="px-1">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-[#f4ede6] transition-colors cursor-pointer border border-[#dfd3c7] shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#eeddd0] border border-[#dfd3c7] flex items-center justify-center text-[#6f4e37] shrink-0">
                <Coffee size={18} strokeWidth={2.4} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#2c1b12] truncate">
                  Tostaduría Principal
                </span>
                <span className="font-mono text-[10px] text-[#795548] truncate">
                  Equipo de Producción
                </span>
              </div>
            </div>
            <ChevronsUpDown size={15} className="text-[#8d6e63] shrink-0 ml-1" />
          </div>
        </div>

        {/* Encabezado de navegación */}
        <div className="px-2 pt-1 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase text-[#795548] tracking-wider font-bold">
            Suite de Trabajo
          </span>
          <div className="w-2 h-2 rounded-full bg-[#6f4e37]/40" title="Activo" />
        </div>

        {/* Lista de navegación */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#eeddd0] text-[#3e2723] font-bold shadow-xs border-l-4 border-[#6f4e37]"
                    : "text-[#5c3a21] hover:bg-[#f3eae1] hover:text-[#2c1b12]"
                }`}
              >
                <Icon size={17} className={isActive ? "text-[#6f4e37]" : "text-[#8d6e63]"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Pie de barra lateral con estado del sistema y bóveda */}
      <div className="p-2.5 border-t border-[#e8dfd8] flex flex-col gap-2 bg-white/70 rounded-xl mx-1">
        <div className="flex items-center justify-between text-[#795548] text-[11px] font-mono">
          <span className="flex items-center gap-1.5 font-medium">
            <HardDrive size={13} className="text-[#6f4e37]" />
            Bóveda Local
          </span>
          <span className="text-[#6f4e37] font-bold">98% Cifrada</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#795548] text-[11px] font-mono">
          <ShieldCheck size={13} className="text-[#8d5b4c]" />
          <span>Sincronización P2P Lista</span>
        </div>
      </div>
    </aside>
  );
};
