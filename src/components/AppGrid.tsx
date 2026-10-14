import React from "react";
import {
  FileText,
  Table,
  Presentation,
  StickyNote,
  GitBranch,
  Mail,
  ExternalLink,
  Trash2,
  Download,
  BookmarkPlus,
  ArrowRight,
  Clock,
  BookOpen,
} from "lucide-react";
import type { SuiteApp } from "../types";

interface AppGridProps {
  apps: SuiteApp[];
  selectedCategory?: string | null;
  onClearCategory?: () => void;
  onLaunchApp: (appId: string) => void;
  onInstallApp: (appId: string) => void;
  onUninstallApp: (appId: string) => void;
}

export const AppGrid: React.FC<AppGridProps> = ({
  apps,
  selectedCategory,
  onClearCategory,
  onLaunchApp,
  onInstallApp,
  onUninstallApp,
}) => {
  const [actionState, setActionState] = React.useState<
    Record<string, { mode: "install" | "uninstall"; progress: number }>
  >({});

  const handleStartInstall = (appId: string) => {
    setActionState((prev) => ({ ...prev, [appId]: { mode: "install", progress: 8 } }));
    const startTime = Date.now();
    const duration = 2000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));

      setActionState((prev) => {
        if (!prev[appId]) return prev;
        return { ...prev, [appId]: { mode: "install", progress } };
      });

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setActionState((prev) => {
            const next = { ...prev };
            delete next[appId];
            return next;
          });
          onInstallApp(appId);
        }, 300);
      }
    }, 60);
  };

  const handleStartUninstall = (appId: string) => {
    setActionState((prev) => ({ ...prev, [appId]: { mode: "uninstall", progress: 8 } }));
    const startTime = Date.now();
    const duration = 1400;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));

      setActionState((prev) => {
        if (!prev[appId]) return prev;
        return { ...prev, [appId]: { mode: "uninstall", progress } };
      });

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setActionState((prev) => {
            const next = { ...prev };
            delete next[appId];
            return next;
          });
          onUninstallApp(appId);
        }, 300);
      }
    }, 50);
  };
  const getAppIcon = (iconName: string) => {
    switch (iconName) {
      case "file-text":
        return FileText;
      case "table":
        return Table;
      case "presentation":
        return Presentation;
      case "sticky-note":
        return StickyNote;
      case "git-branch":
        return GitBranch;
      case "mail":
        return Mail;
      default:
        return FileText;
    }
  };

  return (
    <section className="flex flex-col gap-4">
      {/* Encabezado de la tienda de aplicaciones */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#eeddd0] flex items-center justify-center text-[#6f4e37] border border-[#dfd3c7]">
            <BookOpen size={14} strokeWidth={2.2} />
          </div>
          <h2 className="font-display text-lg lg:text-xl text-[#2c1b12] font-bold tracking-tight">
            Tienda de Apps CoffeWorks
          </h2>
          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] font-semibold border border-[#dfd3c7]">
            {apps.length === 1 ? "1 Aplicación" : `${apps.length} Aplicaciones`}
          </span>
          {selectedCategory && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#eeddd0] text-[#3e2723] font-bold border border-[#dfd3c7]">
              <span>Categoría: {selectedCategory}</span>
              {onClearCategory && (
                <button
                  type="button"
                  onClick={onClearCategory}
                  className="hover:text-red-700 ml-1 text-xs"
                  title="Ver todas las categorías"
                >
                  x
                </button>
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          className="text-xs text-[#6f4e37] hover:text-[#3e2723] flex items-center gap-1 font-semibold transition-colors"
        >
          <span>Gestionar paquetes locales</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Cuadrícula de aplicaciones de 2 columnas estrictas (2 arriba, 2 abajo) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {apps.map((app) => {
          const Icon = getAppIcon(app.icon_name);
          const currentAction = actionState[app.id];

          return (
            <div
              key={app.id}
              className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white hover:bg-[#fcfaf7] transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 border border-[#dfd3c7] hover:border-[#6f4e37]"
            >
              {/* Contenido principal */}
              <div className="flex flex-col gap-3.5">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#eeddd0] flex items-center justify-center shadow-xs border border-[#dfd3c7] overflow-hidden p-1.5">
                    {app.icon_url ? (
                      <img
                        src={app.icon_url}
                        alt={app.name}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Icon size={24} strokeWidth={2.2} className="text-[#6f4e37]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {app.category && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#eeddd0] text-[#5c3a21] font-semibold border border-[#dfd3c7]">
                        {app.category}
                      </span>
                    )}
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] font-bold border border-[#dfd3c7]">
                      {app.version}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-base text-[#2c1b12] font-bold group-hover:text-[#6f4e37] transition-colors">
                    {app.name}
                  </h3>
                  <p className="text-[11px] text-[#795548] mt-0.5 font-mono">
                    {app.subtitle}
                  </p>
                </div>

                <p className="text-xs text-[#5c3a21] line-clamp-2 leading-relaxed font-sans">
                  {app.description}
                </p>
              </div>

              {/* Barra inferior de estado y acciones */}
              <div className="flex items-center justify-between mt-5 pt-3.5 bg-[#faf7f2] -mx-5 -mb-5 px-5 pb-4 rounded-b-2xl border-t border-[#dfd3c7]">
                {currentAction ? (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="flex items-center gap-1.5 font-medium">
                        {currentAction.mode === "install" ? (
                          <>
                            <Download size={13} className="text-[#6f4e37] animate-bounce" />
                            <span className="text-[#6f4e37]">
                              Descargando e instalando... {Math.round((app.size_mb * currentAction.progress) / 100)} / {app.size_mb} MB
                            </span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={13} className="text-red-600 animate-pulse" />
                            <span className="text-red-700">
                              Desinstalando y liberando espacio...
                            </span>
                          </>
                        )}
                      </span>
                      <span className="font-bold text-[#2c1b12] text-[11px]">
                        {currentAction.progress}%
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="h-2 w-full bg-[#dfd3c7] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-75 rounded-full ${
                          currentAction.mode === "install" ? "bg-[#6f4e37]" : "bg-red-600"
                        }`}
                        style={{ width: `${currentAction.progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-[#795548] font-mono text-[11px]">
                      {app.installed ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#6f4e37]" />
                          <span className="font-medium">Instalada ({app.size_mb} MB)</span>
                        </>
                      ) : app.version === "Próximamente" ? (
                        <>
                          <Clock size={13} className="text-[#a1887f]" />
                          <span>Lanzamiento Q4</span>
                        </>
                      ) : (
                        <>
                          <Download size={13} className="text-[#a1887f]" />
                          <span>Descarga: {app.size_mb} MB</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {app.installed ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartUninstall(app.id)}
                            className="p-1.5 rounded-lg text-[#8d6e63] hover:text-red-700 hover:bg-[#f4ede6] transition-colors flex items-center gap-1 text-xs"
                            title={`Desinstalar ${app.name}`}
                          >
                            <Trash2 size={14} />
                            <span className="hidden sm:inline">Desinstalar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onLaunchApp(app.id)}
                            className="bg-[#6f4e37] hover:bg-[#5c3a21] text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>Abrir App</span>
                            <ExternalLink size={13} />
                          </button>
                        </>
                      ) : app.version === "Próximamente" ? (
                        <button
                          type="button"
                          className="bg-white text-[#795548] hover:text-[#2c1b12] text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-[#dfd3c7]"
                        >
                          <BookmarkPlus size={14} />
                          <span>Pre-instalar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartInstall(app.id)}
                          className="bg-[#eeddd0] text-[#3e2723] hover:bg-[#6f4e37] hover:text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5 border border-[#dfd3c7]"
                        >
                          <Download size={14} />
                          <span>Instalar</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
