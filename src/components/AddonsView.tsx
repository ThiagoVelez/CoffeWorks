import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Puzzle,
  Search,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  HardDrive,
  ArrowRightLeft,
  Store,
  FileText,
  Table,
  Presentation,
  FilePen,
  NotebookPen,
  Scissors,
  Radio,
  Database,
  PenTool,
  Workflow,
  ScanText,
  Sparkles,
  Aperture,
  Spline,
  Image as ImageIcon,
  PenLine,
  Brush,
  Smile,
} from "lucide-react";
import { isTauri, tauriBridge } from "../services/tauriBridge";
import type { AddonInfo, SuiteApp } from "../types";

/** Formatos que cada aplicación abre y guarda (pestaña «Formatos»). */
const FORMAT_SUPPORT = [
  { app: "CoffeeDoc", icon: FileText, color: "text-[#185abd]", native: ".cfd", opens: "Word (.docx), Markdown (.md), HTML, texto (.txt)", exports: "Word (.docx), Markdown, HTML, texto y PDF" },
  { app: "CoffeeCalc", icon: Table, color: "text-[#107c41]", native: ".cfs", opens: "Excel (.xlsx, .xls), CSV", exports: "Excel (.xlsx) con formato, CSV y PDF" },
  { app: "CoffeeView", icon: Presentation, color: "text-[#c43e1c]", native: ".csl", opens: "PowerPoint (.pptx)", exports: "PowerPoint (.pptx), HTML y PDF" },
  { app: "CoffeePDF", icon: FilePen, color: "text-[#c62828]", native: ".pdf", opens: "PDF (.pdf), imágenes para insertar (PNG, JPG); revisa la ortografía del texto original y de PDF escaneados (con complemento)", exports: "PDF editado, páginas extraídas y PNG por página" },
  { app: "CoffeePage", icon: NotebookPen, color: "text-[#7b1fa2]", native: ".cpg", opens: "Cuadernos de CoffeePage; imágenes y texto (.txt, .md) para insertar", exports: "HTML (página, sección o cuaderno), Markdown y PDF (imprimir)" },
  {
    app: "CoffeeDataBase",
    icon: Database,
    color: "text-[#9b111e]",
    native: ".cdb (SQLite)",
    opens: "SQLite (.db, .sqlite); importa Excel (.xlsx), CSV y bases .accdb/.mdb",
    exports: "Excel (una hoja por tabla), CSV, script SQL, informes en PDF y Access (.accdb, con complemento)",
  },
  { app: "CoffeeEdit", icon: Scissors, color: "text-[#26a680]", native: ".ccm", opens: "Video (MP4, WebM, MOV, MKV), audio (MP3, WAV, M4A…) e imágenes", exports: "Video MP4 o WebM" },
  {
    app: "CoffeeLive",
    icon: Radio,
    color: "text-[#ef6c00]",
    native: ".clv (colección de escenas)",
    opens: "Pantalla, cámara, imágenes, videos y audio como fuentes",
    exports: "Grabaciones MP4/WebM, capturas PNG y transmisión RTMP/SRT (con el complemento FFmpeg)",
  },
  {
    app: "CoffeeUI/UX",
    icon: PenTool,
    color: "text-[#b38600]",
    native: ".cux",
    opens: "Diseños de CoffeeUI/UX; imágenes (PNG, JPG, SVG) para insertar",
    exports: "PNG, JPG, SVG, PDF y código HTML/CSS",
  },
  {
    app: "CoffeeUML",
    icon: Workflow,
    color: "text-[#2e6b58]",
    native: ".cuml",
    opens: "Modelos de CoffeeUML; importa scripts SQL (CREATE TABLE)",
    exports: "PNG, SVG, PDF; código Java, C#, TypeScript, Python, SQL, Mermaid y PlantUML",
  },
  { app: "CoffeePhoto", icon: ImageIcon, color: "text-[#e8452c]", native: ".cph", opens: "PNG, JPG, WebP, BMP, GIF; RAW de cámara (con complemento)", exports: "PNG, JPG, WebP, PDF y capas como PNG (ZIP)" },
  { app: "CoffeeVector", icon: PenLine, color: "text-[#e8590c]", native: ".cvc", opens: "SVG (trazados, formas, texto, degradados), PNG y JPG para colocar o calcar (con complemento)", exports: "SVG, PDF vectorial, PNG y JPG por mesa de trabajo" },
  { app: "CoffeePaint", icon: Brush, color: "text-[#e64980]", native: ".cpt", opens: "PNG, JPG y WebP (como capa de referencia)", exports: "PNG (con o sin papel), JPG, capas en ZIP y SVG vectorizado (con complemento)" },
  { app: "CoffeeLens", icon: Aperture, color: "text-[#d9480f]", native: ".clc (catálogo)", opens: "JPG, PNG, WebP, TIFF y RAW de cámara (con complemento)", exports: "JPG, PNG y WebP por lotes, con cambio de tamaño" },
];

/** Icono y color de cada complemento. */
const ADDON_LOOK: Record<string, { bg: string; fg: string; icon: React.FC<{ size?: number; className?: string }> }> = {
  accdb: { bg: "#fbe9eb", fg: "#9b111e", icon: Database },
  ffmpeg: { bg: "#fff1e5", fg: "#ef6c00", icon: Radio },
  pdfcheck: { bg: "#fdecea", fg: "#c62828", icon: ScanText },
  aigen: { bg: "#fde4dc", fg: "#e8452c", icon: Sparkles },
  raw: { bg: "#ffead5", fg: "#d9480f", icon: Aperture },
  potrace: { bg: "#fff0db", fg: "#e8590c", icon: Spline },
  puppetcompat: { bg: "#ffe0ec", fg: "#d6336c", icon: Smile },
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

interface AddonsViewProps {
  apps: SuiteApp[];
  onNotify: (message: string, isError?: boolean) => void;
  onOpenVault?: () => void;
}

export const AddonsView: React.FC<AddonsViewProps> = ({ apps, onNotify, onOpenVault }) => {
  const [tab, setTab] = useState<"market" | "formats">("market");
  const [addons, setAddons] = useState<AddonInfo[]>([]);
  const [busy, setBusy] = useState<Record<string, "install" | "uninstall">>({});
  const [appFilter, setAppFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    try {
      setAddons(await tauriBridge.getAddons());
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), true);
    }
  }, [onNotify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const appById = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const filterApps = useMemo(() => [...new Set(addons.flatMap((a) => a.apps))], [addons]);

  const visible = addons.filter((addon) => {
    if (appFilter === "installed" && !addon.installed) return false;
    if (appFilter !== "all" && appFilter !== "installed" && !addon.apps.includes(appFilter)) return false;
    const q = query.trim().toLowerCase();
    return !q || `${addon.name} ${addon.summary} ${addon.description}`.toLowerCase().includes(q);
  });

  const run = async (addon: AddonInfo, action: "install" | "uninstall") => {
    setBusy((b) => ({ ...b, [addon.id]: action }));
    try {
      const updated = action === "install" ? await tauriBridge.installAddon(addon.id) : await tauriBridge.uninstallAddon(addon.id);
      setAddons((list) => list.map((a) => (a.id === updated.id ? updated : a)));
      onNotify(action === "install" ? `«${addon.name}» instalado` : `«${addon.name}» desinstalado`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[addon.id];
        return next;
      });
    }
  };

  const installedCount = addons.filter((a) => a.installed).length;
  const installedBytes = addons.reduce((sum, a) => sum + a.installed_bytes, 0);

  return (
    <div className="flex flex-col gap-5" data-addons-view>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#e8dfd8] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#eeddd0] flex items-center justify-center text-[#5c3a21] shrink-0 border border-[#dfd3c7]">
            <Puzzle size={22} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#2c1b12]">Complementos</h1>
            <p className="text-xs text-[#795548] mt-0.5 max-w-xl">
              Herramientas opcionales para las apps de la suite. No vienen en el instalador para que CoffeeWorks siga siendo ligero: instala solo
              las que uses y quítalas cuando quieras.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#faf7f2] border border-[#e8dfd8] self-start md:self-center">
          {[
            { id: "market" as const, label: "Mercado", icon: Store },
            { id: "formats" as const, label: "Formatos e integración", icon: ArrowRightLeft },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.id ? "bg-[#5c3a21] text-white shadow-xs" : "text-[#5c3a21] hover:bg-[#f3eae1]"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "market" && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {[{ id: "all", label: `Todos (${addons.length})` }, { id: "installed", label: `Instalados (${installedCount})` }, ...filterApps.map((id) => ({ id, label: appById.get(id)?.name || id }))].map(
                (chip) => {
                  const app = appById.get(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      data-addon-filter={chip.id}
                      onClick={() => setAppFilter(chip.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                        appFilter === chip.id ? "bg-[#5c3a21] text-white shadow-xs font-semibold" : "bg-white text-[#5c3a21] border border-[#e8dfd8] hover:border-[#5c3a21]"
                      }`}
                    >
                      {app?.icon_url && <img src={app.icon_url} alt="" className="w-3.5 h-3.5" />}
                      {chip.label}
                    </button>
                  );
                }
              )}
            </div>
            <div className="relative w-full lg:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar complementos..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dfd3c7] bg-white text-xs text-[#2c1b12] placeholder-stone-400 focus:outline-none focus:border-[#6f4e37]"
              />
            </div>
          </div>

          {!isTauri && (
            <div className="px-4 py-3 rounded-xl bg-[#fff8e1] border border-[#f3e0a6] text-xs text-[#6d4c00]">
              Estás en el modo web de desarrollo: el catálogo se muestra, pero los complementos se instalan en la aplicación de escritorio.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visible.map((addon) => {
              const look = ADDON_LOOK[addon.id] || { bg: "#eeddd0", fg: "#5c3a21", icon: Puzzle };
              const state = busy[addon.id];
              return (
                <div key={addon.id} data-addon={addon.id} className="flex flex-col gap-3 p-5 rounded-2xl bg-white border border-[#e8dfd8] hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: look.bg, color: look.fg }}>
                      <look.icon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold text-[#2c1b12]">{addon.name}</h2>
                        {addon.installed && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e1f3e7] text-[#107c41]">
                            <CheckCircle2 size={11} /> Instalado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5c3a21] mt-0.5">{addon.summary}</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{addon.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wide font-bold text-[#a1887f]">Para</span>
                    {addon.apps.map((id) => {
                      const app = appById.get(id);
                      return (
                        <span key={id} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#faf7f2] border border-[#e8dfd8] text-[#5c3a21]">
                          {app?.icon_url && <img src={app.icon_url} alt="" className="w-3.5 h-3.5" />}
                          {app?.name || id}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-[#8d6e63] pt-3 border-t border-[#f4ede6] flex-wrap">
                    <span title="Versión">v{addon.version.replace(/^v/, "")}</span>
                    <span title="Descarga">
                      <Download size={11} className="inline -mt-0.5" /> {addon.download_size}
                    </span>
                    <span title="Licencia">
                      <ShieldCheck size={11} className="inline -mt-0.5" /> {addon.license}
                    </span>
                    <span>{addon.publisher}</span>
                    {addon.installed && (
                      <span title="Espacio en disco">
                        <HardDrive size={11} className="inline -mt-0.5" /> {formatBytes(addon.installed_bytes)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {addon.installed ? (
                      <button
                        type="button"
                        disabled={!!state || !isTauri}
                        onClick={() => void run(addon, "uninstall")}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#e8dfd8] text-[#5c3a21] hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50"
                      >
                        {state === "uninstall" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Desinstalar
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-addon-install={addon.id}
                        disabled={!!state || !addon.can_install}
                        onClick={() => void run(addon, "install")}
                        title={addon.can_install ? undefined : addon.manual_hint}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#6f4e37] hover:bg-[#5c3a21] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {state === "install" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {state === "install" ? "Descargando…" : "Instalar"}
                      </button>
                    )}
                    {!addon.can_install && !addon.installed && <span className="text-[11px] text-[#8d6e63]">{addon.manual_hint}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {visible.length === 0 && (
            <div className="p-10 text-center bg-white rounded-2xl border border-[#e8dfd8] text-sm text-stone-500">No hay complementos que coincidan con la búsqueda.</div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] font-mono text-[#795548]">
            <span>
              {installedCount} de {addons.length} complementos instalados{installedBytes ? ` · ${formatBytes(installedBytes)} en disco` : ""}
            </span>
            {isTauri && (
              <button type="button" onClick={() => void tauriBridge.openAddonsFolder()} className="flex items-center gap-1.5 hover:text-[#3e2723]">
                <FolderOpen size={13} /> Abrir la carpeta de complementos
              </button>
            )}
          </div>
        </>
      )}

      {tab === "formats" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {FORMAT_SUPPORT.map((item) => (
              <div key={item.app} className="p-5 rounded-2xl bg-white border border-[#dfd3c7] flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <item.icon size={18} className={item.color} />
                  <span className="font-display font-bold text-[#2c1b12]">{item.app}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#f4ede6] text-[#6f4e37] border border-[#dfd3c7]">{item.native}</span>
                </div>
                <div className="text-xs text-[#5c3a21] leading-relaxed">
                  <span className="font-semibold">Abre:</span> {item.opens}
                </div>
                <div className="text-xs text-[#5c3a21] leading-relaxed">
                  <span className="font-semibold">Exporta:</span> {item.exports}
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#dfd3c7] flex flex-col gap-2 text-xs text-[#5c3a21] leading-relaxed">
            <div className="flex items-center gap-2 font-display font-bold text-sm text-[#2c1b12]">
              <ArrowRightLeft size={16} className="text-[#6f4e37]" />
              Integración con Windows
            </div>
            <p>
              Al instalar una aplicación desde la Tienda de Apps se crea su acceso directo en el menú Inicio (carpeta CoffeeWorks) y se asocia su tipo de
              archivo, de modo que un doble clic en el Explorador abre el documento directamente.
            </p>
            <p>
              Todos los documentos se guardan como archivos normales en la carpeta <strong>Documentos\CoffeeWorks</strong>: puedes copiarlos,
              respaldarlos o sincronizarlos con el servicio que prefieras.
            </p>
            {onOpenVault && (
              <button
                type="button"
                onClick={onOpenVault}
                className="self-start mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6f4e37] hover:bg-[#5c3a21] text-white font-bold transition-colors"
              >
                <FolderOpen size={14} />
                Abrir la carpeta de documentos
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
