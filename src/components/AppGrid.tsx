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
  onLaunchApp: (appId: string) => void;
  onInstallApp: (appId: string) => void;
  onUninstallApp: (appId: string) => void;
}

export const AppGrid: React.FC<AppGridProps> = ({
  apps,
  onLaunchApp,
  onInstallApp,
  onUninstallApp,
}) => {
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
      {/* Encabezado de la cuadrícula */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#eeddd0] flex items-center justify-center text-[#6f4e37] border border-[#dfd3c7]">
            <BookOpen size={14} strokeWidth={2.2} />
          </div>
          <h2 className="font-display text-lg lg:text-xl text-[#2c1b12] font-bold tracking-tight">
            Suite CoffeWorks
          </h2>
          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] font-semibold border border-[#dfd3c7]">
            {apps.length === 1 ? "1 Aplicación Nuclear Activa" : `${apps.length} Aplicaciones Nucleares`}
          </span>
        </div>

        <button
          type="button"
          className="text-xs text-[#6f4e37] hover:text-[#3e2723] flex items-center gap-1 font-semibold transition-colors"
        >
          <span>Gestionar paquetes locales</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Cuadrícula de aplicaciones con acabado blanco y café */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {apps.map((app) => {
          const Icon = getAppIcon(app.icon_name);

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
                  <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] font-bold border border-[#dfd3c7]">
                    {app.version}
                  </span>
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
                        onClick={() => onUninstallApp(app.id)}
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
                      onClick={() => onInstallApp(app.id)}
                      className="bg-[#eeddd0] text-[#3e2723] hover:bg-[#6f4e37] hover:text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5 border border-[#dfd3c7]"
                    >
                      <Download size={14} />
                      <span>Instalar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
