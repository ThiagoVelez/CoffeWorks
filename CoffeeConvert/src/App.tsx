// CoffeeConvert: convierte y organiza documentos (como una caja de herramientas de PDF),
// todo en el equipo y sin conexión.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Files,
  Hash,
  Layers,
  Loader2,
  Minimize2,
  Minus,
  Presentation,
  RotateCw,
  ScanText,
  Scissors,
  Search,
  Square,
  Stamp,
  Trash2,
  Upload,
  X,
  ListOrdered,
  FileDown,
} from "lucide-react";
import JSZip from "jszip";
import { DialogHost, showMessage, toast } from "./components/Dialogs";
import { ThemeSwitch } from "./theme/ThemeSwitch";
import { appWindow, getLaunchArgs, isTauri, readFileBytes, saveFileAs, baseName } from "./services/desktop";
import { GROUPS, TOOLS, accepts, toolById, type InputFile, type OutputFile, type Tool } from "./convert/tools";
import { addonStatus, installAddon } from "./convert/native";

const ACCENT = "#0f8b8d";

const TOOL_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "pdf-pptx": Presentation,
  "pdf-docx": FileText,
  "pdf-xlsx": FileSpreadsheet,
  "pdf-image": FileImage,
  "pdf-text": FileType2,
  "image-pdf": FileImage,
  "text-pdf": FileText,
  "office-pdf": FileDown,
  merge: Layers,
  split: Scissors,
  rotate: RotateCw,
  reorder: ListOrdered,
  compress: Minimize2,
  number: Hash,
  watermark: Stamp,
  ocr: ScanText,
};

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

const Logo = <img src="/app-icon.png" alt="" className="w-8 h-8" draggable={false} />;

export const App: React.FC = () => {
  const [toolId, setToolId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const tool = toolId ? toolById(toolId) ?? null : null;

  // Abierta desde «Abrir con» un PDF: herramientas para PDF con el archivo ya cargado.
  const [launchFile, setLaunchFile] = useState<InputFile | null>(null);
  useEffect(() => {
    void getLaunchArgs().then(async (a) => {
      if (!a.file) return;
      try {
        setLaunchFile({ name: baseName(a.file), bytes: await readFileBytes(a.file) });
      } catch {
        /* sin archivo */
      }
    });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => (!launchFile || accepts(t, launchFile.name)) && (!q || `${t.title} ${t.description} ${t.accepts.join(" ")}`.toLowerCase().includes(q)));
  }, [query, launchFile]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f5f8f8] text-[#1d2b2c]" data-app="coffeeconvert">
      <header data-tauri-drag-region className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-[#dbe5e5] bg-white">
        <button type="button" onClick={() => setToolId(null)} title="Todas las herramientas" className="shrink-0">
          {Logo}
        </button>
        <div data-tauri-drag-region className="flex flex-col leading-tight">
          <span className="font-bold text-[15px]">CoffeeConvert</span>
          <span className="text-[11px] text-[#5d7072]">Convierte y organiza documentos, sin conexión</span>
        </div>
        <div data-tauri-drag-region className="flex-1" />
        <ThemeSwitch />
        {isTauri && (
          <div className="flex items-center gap-0.5 ml-2">
            <button type="button" onClick={() => void appWindow.minimize()} title="Minimizar" className="w-8 h-8 grid place-items-center rounded hover:bg-[#eef3f3]">
              <Minus size={14} />
            </button>
            <button type="button" onClick={() => void appWindow.toggleMaximize()} title="Maximizar" className="w-8 h-8 grid place-items-center rounded hover:bg-[#eef3f3]">
              <Square size={12} />
            </button>
            <button type="button" onClick={() => void appWindow.close()} title="Cerrar" className="w-8 h-8 grid place-items-center rounded hover:bg-red-600 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        {tool ? (
          <ToolView key={tool.id} tool={tool} initial={launchFile && accepts(tool, launchFile.name) ? [launchFile] : []} onBack={() => setToolId(null)} />
        ) : (
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="text-2xl font-bold">¿Qué quieres hacer?</h1>
              {launchFile && (
                <div className="flex items-center gap-2 text-sm text-[#3d5153]">
                  <FileText size={16} style={{ color: ACCENT }} /> Herramientas para <b>{launchFile.name}</b>
                  <button type="button" className="text-xs underline text-[#5d7072]" onClick={() => setLaunchFile(null)}>
                    ver todas
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 h-10 max-w-md px-3 rounded-xl bg-white border border-[#dbe5e5]">
                <Search size={16} className="text-[#5d7072]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar una herramienta (por ejemplo «powerpoint» o «unir»)" className="flex-1 bg-transparent outline-none text-sm" data-search />
              </label>
            </div>
            {GROUPS.map((g) => {
              const items = visible.filter((t) => t.group === g.id);
              if (!items.length) return null;
              return (
                <section key={g.id} className="flex flex-col gap-3">
                  <h2 className="text-xs uppercase tracking-wider font-bold text-[#5d7072]">{g.title}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {items.map((t) => {
                      const Icon = TOOL_ICON[t.id] ?? Files;
                      return (
                        <button key={t.id} type="button" onClick={() => setToolId(t.id)} className="text-left p-4 rounded-2xl bg-white border border-[#dbe5e5] hover:border-[#0f8b8d] hover:shadow-sm transition-all flex flex-col gap-2" data-tool={t.id}>
                          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: "#e3f2f2", color: ACCENT }}>
                            <Icon size={18} />
                          </span>
                          <span className="font-semibold text-sm">{t.title}</span>
                          <span className="text-xs text-[#5d7072] leading-relaxed">{t.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {!visible.length && <p className="text-sm text-[#5d7072]">No hay ninguna herramienta que coincida con «{query}».</p>}
          </div>
        )}
      </main>
      <DialogHost />
    </div>
  );
};

const ToolView: React.FC<{ tool: Tool; initial: InputFile[]; onBack: () => void }> = ({ tool, initial, onBack }) => {
  const [files, setFiles] = useState<InputFile[]>(initial);
  const [opts, setOpts] = useState<Record<string, string>>(() => Object.fromEntries((tool.options ?? []).map((o) => [o.id, o.default])));
  const [busy, setBusy] = useState<{ fraction: number; label: string } | null>(null);
  const [results, setResults] = useState<OutputFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const Icon = TOOL_ICON[tool.id] ?? Files;

  const add = async (list: FileList | File[]) => {
    const picked: InputFile[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(list)) {
      if (!accepts(tool, f.name)) rejected.push(f.name);
      else picked.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    if (rejected.length) toast(`No se aceptan: ${rejected.join(", ")}. Esta herramienta usa ${tool.accepts.join(", ")}.`, "error");
    setResults([]);
    setError(null);
    setFiles((cur) => (tool.multiple ? [...cur, ...picked] : picked.slice(0, 1)));
  };

  const move = (i: number, d: -1 | 1) =>
    setFiles((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /** Comprueba (y ofrece instalar) el complemento que necesita la herramienta. */
  const ensureAddon = async (): Promise<boolean> => {
    if (!tool.addon) return true;
    if (!isTauri) {
      await showMessage("Solo en la app de escritorio", "Esta herramienta usa un complemento que se instala desde el Launcher de CoffeeWorks › Complementos.");
      return false;
    }
    const info = await addonStatus(tool.addon);
    if (info?.installed) return true;
    if (info?.can_install) {
      setBusy({ fraction: 0, label: `Instalando «${info.name}» (${info.download_size})…` });
      try {
        await installAddon(tool.addon);
        return true;
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
        return false;
      } finally {
        setBusy(null);
      }
    }
    setError(info?.manual_hint || "Instala el complemento desde el Launcher › Complementos.");
    return false;
  };

  const run = async () => {
    setError(null);
    setResults([]);
    if (!(await ensureAddon())) return;
    setBusy({ fraction: 0, label: "" });
    try {
      const out = await tool.run(files, opts, (fraction, label) => setBusy({ fraction, label }));
      setResults(out);
      toast(out.length === 1 ? "Listo: 1 archivo" : `Listo: ${out.length} archivos`);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const saveOne = async (f: OutputFile) => {
    const ext = f.name.split(".").pop() ?? "";
    if (await saveFileAs(f.name, [{ name: ext.toUpperCase(), extensions: [ext] }], f.bytes, "Guardar")) toast(`Guardado «${f.name}»`);
  };
  const saveAll = async () => {
    const zip = new JSZip();
    const used = new Set<string>();
    for (const f of results) {
      let name = f.name;
      for (let n = 2; used.has(name); n++) name = f.name.replace(/(\.[^.]+)$/, `-${n}$1`);
      used.add(name);
      zip.file(name, f.bytes);
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    if (await saveFileAs(`${tool.title}.zip`, [{ name: "ZIP", extensions: ["zip"] }], bytes, "Guardar todo")) toast("Guardado el ZIP con todos los archivos");
  };

  const tooFew = files.length < (tool.min ?? 1);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-5" data-tool-view={tool.id}>
      <button type="button" onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-[#3d5153] hover:text-black">
        <ArrowLeft size={16} /> Todas las herramientas
      </button>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: "#e3f2f2", color: ACCENT }}>
          <Icon size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold">{tool.title}</h1>
          <p className="text-sm text-[#5d7072]">{tool.description}</p>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 flex flex-col items-center gap-3 text-center transition-colors ${over ? "border-[#0f8b8d] bg-[#e3f2f2]" : "border-[#c5d6d6] bg-white"}`}
        data-dropzone
      >
        <Upload size={28} style={{ color: ACCENT }} />
        <p className="text-sm">
          Suelta aquí {tool.multiple ? "los archivos" : "el archivo"} o{" "}
          <button type="button" className="font-semibold underline" style={{ color: ACCENT }} onClick={() => inputRef.current?.click()}>
            elige {tool.multiple ? "archivos" : "un archivo"}
          </button>
        </p>
        <p className="text-xs text-[#5d7072]">{tool.accepts.map((e) => `.${e}`).join("  ")}</p>
        <input ref={inputRef} type="file" hidden multiple={tool.multiple} accept={tool.accepts.map((e) => `.${e}`).join(",")} onChange={(e) => e.target.files && void add(e.target.files).then(() => (e.target.value = ""))} data-file-input />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5" data-files>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 h-10 rounded-xl bg-white border border-[#dbe5e5] text-sm">
              <FileText size={15} className="text-[#5d7072] shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-[#5d7072]">{sizeText(f.bytes.length)}</span>
              {tool.multiple && (
                <>
                  <button type="button" title="Subir" onClick={() => move(i, -1)} className="p-1 rounded hover:bg-[#eef3f3]">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" title="Bajar" onClick={() => move(i, 1)} className="p-1 rounded hover:bg-[#eef3f3]">
                    <ArrowDown size={14} />
                  </button>
                </>
              )}
              <button type="button" title="Quitar" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-red-50 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(tool.options ?? []).length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {(tool.options ?? []).map((o) => (
            <label key={o.id} className="flex flex-col gap-1 text-xs text-[#3d5153]">
              {o.label}
              {o.kind === "select" ? (
                <select value={opts[o.id]} onChange={(e) => setOpts({ ...opts, [o.id]: e.target.value })} className="h-9 rounded-lg border border-[#c5d6d6] bg-white px-2 text-sm" data-option={o.id}>
                  {o.choices!.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={opts[o.id]} placeholder={o.placeholder} onChange={(e) => setOpts({ ...opts, [o.id]: e.target.value })} className="h-9 rounded-lg border border-[#c5d6d6] bg-white px-2 text-sm" data-option={o.id} />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" disabled={!!busy || !files.length || tooFew} onClick={() => void run()} className="h-11 px-6 rounded-xl text-white font-semibold disabled:opacity-40 flex items-center gap-2" style={{ background: ACCENT }} data-run>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
          {busy ? "Convirtiendo…" : tool.group === "organizar" ? "Aplicar" : "Convertir"}
        </button>
        {tooFew && files.length > 0 && <span className="text-xs text-[#5d7072]">Añade al menos {tool.min} archivos.</span>}
        {busy && (
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-2 rounded-full bg-[#dbe5e5] overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${Math.round(busy.fraction * 100)}%`, background: ACCENT }} />
            </div>
            <span className="text-[11px] text-[#5d7072] truncate">{busy.label}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm p-3" data-error>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2" data-results>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Resultado</h2>
            {results.length > 1 && (
              <button type="button" onClick={() => void saveAll()} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: ACCENT }}>
                <FileArchive size={15} /> Guardar todo (.zip)
              </button>
            )}
          </div>
          {results.map((r, i) => (
            <div key={`${r.name}-${i}`} className="flex items-center gap-2 px-3 h-11 rounded-xl bg-white border border-[#dbe5e5] text-sm">
              <FileText size={15} style={{ color: ACCENT }} />
              <span className="flex-1 truncate">{r.name}</span>
              <span className="text-xs text-[#5d7072]">{sizeText(r.bytes.length)}</span>
              <button type="button" onClick={() => void saveOne(r)} className="flex items-center gap-1 px-3 h-8 rounded-lg text-white text-xs font-semibold" style={{ background: ACCENT }} data-save>
                <Download size={13} /> Guardar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
