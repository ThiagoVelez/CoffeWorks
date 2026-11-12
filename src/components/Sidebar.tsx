import React, { useState } from "react";
import {
  LayoutGrid,
  Package,
  ChevronDown,
  Briefcase,
  LayoutTemplate,
  Puzzle,
  Settings,
  HardDrive,
  ShieldCheck,
  Clapperboard,
  Code2,
  Palette,
  Gamepad2,
} from "lucide-react";

export type NavTab = "launcher" | "games" | "templates" | "addons" | "settings";

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  appCount: number;
  /** Categorías de la tienda con su número de aplicaciones. */
  categories: Array<{ name: string; count: number }>;
  installedCount: number;
  documentCount: number;
  onOpenVault?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  selectedCategory,
  onSelectCategory,
  appCount,
  categories,
  installedCount,
  documentCount,
  onOpenVault,
}) => {
  // Cerrado al abrir el Launcher; se despliega al hacer clic
  const [isAppsOpen, setIsAppsOpen] = useState<boolean>(false);

  const staticNavItems: Array<{ id: NavTab; label: string; icon: React.FC<{ size?: number; className?: string }> }> = [
    { id: "games", label: "Games", icon: Gamepad2 },
    { id: "templates", label: "Plantillas", icon: LayoutTemplate },
    { id: "addons", label: "Complementos", icon: Puzzle },
    { id: "settings", label: "Ajustes", icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-10 bottom-0 w-64 bg-[#faf7f2] border-r border-[#e8dfd8] z-40 flex flex-col justify-between py-3 px-2 select-none shadow-xs">
      <div className="flex flex-col gap-3">
        {/* Selector de espacio de trabajo / Bóveda estilo Tostaduría */}
        <div className="px-1">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#dfd3c7] shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/icons/CoffeeWorks.png" alt="" className="w-8 h-8 shrink-0" draggable={false} />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#2c1b12] truncate">
                  CoffeeWorks
                </span>
                <span className="font-mono text-[10px] text-[#795548] truncate">
                  Suite ofimática local
                </span>
              </div>
            </div>
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
          {/* Inicio / Launcher */}
          <button
            type="button"
            onClick={() => {
              onSelectTab("launcher");
              onSelectCategory(null);
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
              currentTab === "launcher" && !selectedCategory
                ? "bg-[#eeddd0] text-[#3e2723] font-bold shadow-xs border-l-4 border-[#6f4e37]"
                : "text-[#5c3a21] hover:bg-[#f3eae1] hover:text-[#2c1b12]"
            }`}
          >
            <LayoutGrid size={17} className={currentTab === "launcher" && !selectedCategory ? "text-[#6f4e37]" : "text-[#8d6e63]"} />
            <span>Inicio / Launcher</span>
          </button>

          {/* Acordeón Coffee Apps */}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                setIsAppsOpen((prev) => !prev);
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                selectedCategory !== null
                  ? "bg-[#eeddd0]/60 text-[#3e2723] font-bold"
                  : "text-[#5c3a21] hover:bg-[#f3eae1] hover:text-[#2c1b12]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package size={17} className={selectedCategory ? "text-[#6f4e37]" : "text-[#8d6e63]"} />
                <span>Coffee Apps</span>
              </div>
              <ChevronDown
                size={15}
                className={`text-[#8d6e63] transition-transform duration-200 ${
                  isAppsOpen ? "rotate-180 text-[#6f4e37]" : ""
                }`}
              />
            </button>

            {/* Categorías del acordeón */}
            {isAppsOpen && (
              <div className="ml-5 pl-2.5 border-l-2 border-[#dfd3c7] flex flex-col gap-1 py-1 mt-0.5">
                {categories.map(({ name, count }) => {
                  const active = currentTab === "launcher" && selectedCategory === name;
                  const CategoryIcon = name === "Multimedia" ? Clapperboard : name === "Desarrollador" ? Code2 : name === "Ilustración" ? Palette : Briefcase;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onSelectTab("launcher");
                        onSelectCategory(name);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                        active
                          ? "bg-[#eeddd0] text-[#3e2723] font-bold shadow-xs border-l-4 border-[#6f4e37]"
                          : "text-[#5c3a21] hover:bg-[#f3eae1] hover:text-[#2c1b12]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon size={14} className={active ? "text-[#6f4e37]" : "text-[#8d6e63]"} />
                        <span>{name}</span>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[#eeddd0] text-[#6f4e37] font-semibold border border-[#dfd3c7]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resto de secciones estáticas */}
          {staticNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onSelectCategory(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
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

      {/* Pie de barra lateral: estado real de la suite */}
      <div className="p-2.5 border-t border-[#e8dfd8] flex flex-col gap-2 bg-white/70 rounded-xl mx-1">
        <button
          type="button"
          onClick={onOpenVault}
          disabled={!onOpenVault}
          title={onOpenVault ? "Abrir la carpeta de documentos" : undefined}
          className="flex items-center justify-between text-[#795548] text-[11px] font-mono enabled:hover:text-[#3e2723] text-left"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <HardDrive size={13} className="text-[#6f4e37]" />
            Bóveda local
          </span>
          <span className="text-[#6f4e37] font-bold">
            {documentCount} {documentCount === 1 ? "documento" : "documentos"}
          </span>
        </button>
        <div className="flex items-center gap-1.5 text-[#795548] text-[11px] font-mono">
          <ShieldCheck size={13} className="text-[#8d5b4c]" />
          <span>
            {installedCount} de {appCount} apps instaladas
          </span>
        </div>
      </div>
    </aside>
  );
};
