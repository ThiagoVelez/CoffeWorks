import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Keyboard, Info, Play, Square, Plus, Trash2, Copy, RotateCcw, Film, Music, Image as ImageIcon, Search, Folder, Terminal, ChevronDown, ChevronRight, Star, CheckCircle2, XCircle, Loader2, Clock3, FolderOutput } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore, downloadBlob } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, IconButton, Modal, NumberField, STUDIO_CSS, Section, Select, Slider, Toggle, cx } from "./studio/ui";
import { baseName, isTauri, openExternal, stripExtension } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import { newId } from "./studio/color";
import { invoke } from "@tauri-apps/api/core";
import { ACCENT, ACCENT_DARK, type Container, type EncodeSettings, type Output, type Preset, type Queue, type QueueItem } from "./types";
import { ACODEC_LABEL, CATEGORIES, CONTAINER_CODECS, CONTAINER_LABEL, PRESETS, VCODEC_LABEL, buildArgs, commandLine, estimateSize, fmtBytes, fmtDuration, isAudioOnly, isStill, normalizeSettings, outputDuration } from "./services/ffmpeg";
import { browserCan, cancelJob, encodeBrowser, encodeDesktop, hasBrowserFile, probe, registerBrowserFile, thumbnail, type Progress } from "./services/engine";

const newQueue = (): Queue => ({ version: 1, items: [], customPresets: [], outputDir: "", autoStart: false, chime: true, history: [] });

const store = createDocStore<Queue>({
  appId: "coffeeencoder",
  extension: "cen",
  category: "Ilustración",
  defaultTitle: "Cola sin título",
  kindLabel: "Colas de CoffeeEncoder",
  serialize: (q) => JSON.stringify({ app: "CoffeeEncoder", ...q, items: q.items.map((i) => ({ ...i, outputs: i.outputs.map((o) => (o.status === "encoding" ? { ...o, status: "ready", progress: 0 } : o)) })) }),
  parse: (text) => ({ ...newQueue(), ...JSON.parse(text), version: 1 }),
  create: newQueue,
});

const MEDIA_EXT = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mts", "m2ts", "wmv", "flv", "mpg", "mpeg", "ogv", "3gp", "gif", "mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "aif", "aiff"];
const DEFAULT_PRESET = "h264-source";

const sep = (path: string) => (path.includes("\\") ? "\\" : "/");
const dirOf = (path: string) => {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : "";
};

const STATUS_LOOK: Record<Output["status"], { label: string; color: string }> = {
  ready: { label: "Listo", color: "#9a9aa2" },
  encoding: { label: "Codificando", color: "#ffa94d" },
  done: { label: "Terminado", color: "#69db7c" },
  error: { label: "Error", color: "#ff6b6b" },
  cancelled: { label: "Cancelado", color: "#adb5bd" },
  skipped: { label: "Omitido", color: "#adb5bd" },
};

export const App: React.FC = () => {
  const sd = useStudioDoc<Queue>(store, { appName: "CoffeeEncoder", historyLimit: 50 });
  const queue = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = (next: Queue, key = "") => sd.apply(next, key);

  const [selected, setSelected] = useState<{ item: string; output: string } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<{ itemId: string; outputId: string; progress: Progress; started: number } | null>(null);
  const [presetQuery, setPresetQuery] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(CATEGORIES));
  const [commandOpen, setCommandOpen] = useState(false);
  const [showCmd, setShowCmd] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const stopRequested = useRef(false);
  const runningRef = useRef(false);
  const defaultDir = useRef("");

  useEffect(() => {
    if (isTauri) void invoke<string>("core_videos_dir").then((d) => (defaultDir.current = d));
  }, []);

  const allPresets = useMemo(() => [...PRESETS, ...(queue?.customPresets || [])], [queue?.customPresets]);
  const presetById = (id: string) => allPresets.find((p) => p.id === id) || PRESETS[0];

  // ------------------------------------------------------------------------
  // Modificar la cola
  // ------------------------------------------------------------------------

  const patchOutput = (itemId: string, outputId: string, patch: Partial<Output>, key = "") => {
    const q = cur();
    apply({ ...q, items: q.items.map((i) => (i.id === itemId ? { ...i, outputs: i.outputs.map((o) => (o.id === outputId ? { ...o, ...patch } : o)) } : i)) }, key);
  };
  const patchItem = (itemId: string, patch: Partial<QueueItem>, key = "") => {
    const q = cur();
    apply({ ...q, items: q.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }, key);
  };

  /** Ruta (o nombre) del resultado, sin pisar otro archivo de la cola. */
  const targetFor = (item: QueueItem, preset: Preset, settings: EncodeSettings, q = cur()) => {
    const stem = stripExtension(item.name);
    const suffix = preset.id === DEFAULT_PRESET ? "" : `_${preset.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 24)}`;
    const dir = isTauri ? q.outputDir || dirOf(item.source) || defaultDir.current : "";
    const taken = new Set(q.items.flatMap((i) => i.outputs.map((o) => o.target.toLowerCase())));
    taken.add(item.source.toLowerCase());
    let n = 0;
    let name = "";
    do {
      name = `${stem}${suffix}${n ? ` (${n})` : ""}.${settings.container}`;
      n++;
    } while (taken.has((dir ? dir + sep(dir) + name : name).toLowerCase()));
    return dir ? dir + sep(dir) + name : name;
  };

  const makeOutput = (item: QueueItem, preset: Preset, q = cur()): Output => {
    const settings = { ...preset.settings };
    // Sin video en el original: se pasa a un ajuste de audio
    return { id: newId("out"), presetId: preset.id, presetName: preset.name, settings, target: targetFor(item, preset, settings, q), status: "ready", progress: 0, message: "" };
  };

  const addSources = async (sources: { key: string; name: string; size: number }[]) => {
    if (!sources.length) return;
    if (!sd.docRef.current) await sd.newDocument();
    let q = cur();
    const added: QueueItem[] = [];
    for (const s of sources) {
      const item: QueueItem = { id: newId("it"), source: s.key, name: s.name, size: s.size, info: null, thumb: null, outputs: [] };
      const defaultPreset = presetById(lastPreset.current);
      item.outputs = [makeOutput(item, defaultPreset, { ...q, items: [...q.items, ...added] })];
      added.push(item);
    }
    q = { ...q, items: [...q.items, ...added] };
    apply(q);
    setSelected({ item: added[0].id, output: added[0].outputs[0].id });
    // Análisis y miniaturas en segundo plano
    for (const item of added) {
      void probe(item.source).then(async (info) => {
        let thumb: string | null = null;
        if (info) thumb = await thumbnail(item.source, info);
        const q2 = cur();
        const it = q2.items.find((i) => i.id === item.id);
        if (!it) return;
        let outputs = it.outputs;
        // Un archivo de solo audio no puede ir a un ajuste de video
        if (info && !info.hasVideo) outputs = outputs.map((o) => (o.status === "ready" && !isAudioOnly(o.settings) ? { ...makeOutput(it, presetById("mp3-320"), q2), id: o.id } : o));
        sd.apply({ ...q2, items: q2.items.map((i) => (i.id === item.id ? { ...i, info, thumb, outputs } : i)) }, `probe-${item.id}`);
      });
    }
    if (q.autoStart) window.setTimeout(() => void startQueue(), 300);
  };

  const addFilesDialog = async () => {
    if (isTauri) {
      if (!(await ensureAddon("ffmpeg", "CoffeeEncoder"))) return;
      const paths = await invoke<string[]>("core_pick_paths", { title: "Añadir archivos a la cola", filters: [{ name: "Video y audio", extensions: MEDIA_EXT }] });
      await addSources(paths.map((p) => ({ key: p, name: baseName(p), size: 0 })));
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "video/*,audio/*";
      input.onchange = () => void addBrowserFiles([...(input.files || [])]);
      input.click();
    }
  };

  const addBrowserFiles = async (files: File[]) => {
    const list = files.filter((f) => /^(video|audio)\//.test(f.type) || MEDIA_EXT.includes(f.name.split(".").pop()?.toLowerCase() || ""));
    const sources = list.map((f) => {
      const key = `browser:${newId("f")}:${f.name}`;
      registerBrowserFile(key, f);
      return { key, name: f.name, size: f.size };
    });
    await addSources(sources);
  };

  // Arrastrar archivos a la ventana (escritorio: rutas reales)
  useEffect(() => {
    if (!isTauri) return;
    let off: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
      getCurrentWebview()
        .onDragDropEvent((e) => {
          if (e.payload.type === "over" || e.payload.type === "enter") setDragOver(true);
          else if (e.payload.type === "leave") setDragOver(false);
          else if (e.payload.type === "drop") {
            setDragOver(false);
            const paths = e.payload.paths.filter((p) => MEDIA_EXT.includes(p.split(".").pop()?.toLowerCase() || ""));
            void ensureAddon("ffmpeg", "CoffeeEncoder").then((ok) => void (ok && addSources(paths.map((p) => ({ key: p, name: baseName(p), size: 0 })))));
          }
        })
        .then((u) => (off = u))
    );
    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastPreset = useRef(DEFAULT_PRESET);

  const applyPreset = (preset: Preset, mode: "replace" | "add") => {
    lastPreset.current = preset.id;
    const q = cur();
    const targets = checked.size ? q.items.filter((i) => checked.has(i.id)) : q.items.filter((i) => i.id === selected?.item);
    if (!targets.length) return toast("Selecciona un archivo de la cola (o márcalos) para aplicar el ajuste", "info");
    let next = q;
    let sel: { item: string; output: string } | null = null;
    for (const t of targets) {
      const it = next.items.find((i) => i.id === t.id)!;
      if (mode === "add" || !it.outputs.length) {
        const o = makeOutput(it, preset, next);
        next = { ...next, items: next.items.map((i) => (i.id === it.id ? { ...i, outputs: [...i.outputs, o] } : i)) };
        sel = { item: it.id, output: o.id };
      } else {
        const oid = selected && selected.item === it.id ? selected.output : it.outputs[0].id;
        const old = it.outputs.find((o) => o.id === oid)!;
        const o = { ...makeOutput(it, preset, { ...next, items: next.items.map((i) => (i.id === it.id ? { ...i, outputs: i.outputs.filter((x) => x.id !== oid) } : i)) }), id: oid };
        if (old.status === "encoding") continue;
        next = { ...next, items: next.items.map((i) => (i.id === it.id ? { ...i, outputs: i.outputs.map((x) => (x.id === oid ? o : x)) } : i)) };
        sel = { item: it.id, output: oid };
      }
    }
    apply(next);
    if (sel) setSelected(sel);
    toast(`«${preset.name}» ${mode === "add" ? "añadido" : "aplicado"}`);
  };

  const removeSelected = () => {
    const q = cur();
    if (checked.size) {
      apply({ ...q, items: q.items.filter((i) => !checked.has(i.id) || i.outputs.some((o) => o.status === "encoding")) });
      setChecked(new Set());
      return;
    }
    if (!selected) return;
    const it = q.items.find((i) => i.id === selected.item);
    if (!it) return;
    const o = it.outputs.find((x) => x.id === selected.output);
    if (o?.status === "encoding") return toast("No se puede quitar mientras se codifica", "info");
    if (it.outputs.length <= 1) apply({ ...q, items: q.items.filter((i) => i.id !== it.id) });
    else apply({ ...q, items: q.items.map((i) => (i.id === it.id ? { ...i, outputs: i.outputs.filter((x) => x.id !== selected.output) } : i)) });
    setSelected(null);
  };

  const duplicateOutput = () => {
    if (!selected) return;
    const q = cur();
    const it = q.items.find((i) => i.id === selected.item)!;
    const o = it.outputs.find((x) => x.id === selected.output)!;
    const copy: Output = { ...o, id: newId("out"), status: "ready", progress: 0, message: "", size: undefined, target: targetFor(it, presetById(o.presetId), o.settings, q) };
    apply({ ...q, items: q.items.map((i) => (i.id === it.id ? { ...i, outputs: [...i.outputs, copy] } : i)) });
    setSelected({ item: it.id, output: copy.id });
  };

  const resetStatus = () => {
    const q = cur();
    apply({ ...q, items: q.items.map((i) => ({ ...i, outputs: i.outputs.map((o) => (o.status === "encoding" ? o : { ...o, status: "ready", progress: 0, message: "", size: undefined })) })) });
  };

  const clearDone = () => {
    const q = cur();
    apply({ ...q, items: q.items.map((i) => ({ ...i, outputs: i.outputs.filter((o) => o.status !== "done") })).filter((i) => i.outputs.length) });
  };

  // ------------------------------------------------------------------------
  // Codificar
  // ------------------------------------------------------------------------

  const chime = () => {
    try {
      const c = new AudioContext();
      [660, 880, 1320].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, c.currentTime + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.2, c.currentTime + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.12 + 0.4);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + i * 0.12);
        o.stop(c.currentTime + i * 0.12 + 0.45);
      });
      window.setTimeout(() => void c.close(), 1200);
    } catch {
      /* sin sonido */
    }
  };

  const startQueue = async () => {
    if (runningRef.current) return;
    if (isTauri && !(await ensureAddon("ffmpeg", "CoffeeEncoder"))) return;
    runningRef.current = true;
    stopRequested.current = false;
    setRunning(true);
    let ok = 0;
    let failed = 0;
    try {
      for (;;) {
        if (stopRequested.current) break;
        const q = cur();
        const item = q.items.find((i) => i.outputs.some((o) => o.status === "ready"));
        if (!item) break;
        const out = item.outputs.find((o) => o.status === "ready")!;
        const s = out.settings;
        const started = Date.now();
        patchOutput(item.id, out.id, { status: "encoding", progress: 0, message: "", startedAt: started }, `st-${out.id}`);
        setLive({ itemId: item.id, outputId: out.id, progress: { fraction: 0, time: 0, speed: "", fps: "" }, started });
        const onProgress = (p: Progress) => setLive((l) => (l && l.outputId === out.id ? { ...l, progress: p } : l));
        let res;
        try {
          if (isTauri) res = await encodeDesktop(out.id, item.source, out.target, s, item.info, outputDuration(s, item.info), onProgress);
          else {
            res = await encodeBrowser(out.id, item, s, onProgress);
            if (res.ok && res.blob) downloadBlob(res.blob, out.target);
          }
        } catch (err) {
          res = { ok: false, message: err instanceof Error ? err.message : String(err), size: 0 };
        }
        const finished = Date.now();
        patchOutput(item.id, out.id, { status: res.ok ? "done" : res.cancelled ? "cancelled" : "error", progress: res.ok ? 1 : 0, message: res.message, size: res.size, finishedAt: finished }, `st-${out.id}`);
        const q3 = cur();
        apply({ ...q3, history: [{ id: newId("h"), name: item.name, preset: out.presetName, target: out.target, ok: res.ok, message: res.message, seconds: (finished - started) / 1000, at: finished }, ...q3.history].slice(0, 200) }, `hist-${out.id}`);
        if (res.ok) ok++;
        else if (!res.cancelled) failed++;
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      setLive(null);
    }
    if (ok || failed) {
      if (cur().chime) chime();
      toast(failed ? `Cola terminada: ${ok} correctos, ${failed} con error` : `Cola terminada: ${ok} ${ok === 1 ? "archivo" : "archivos"}`, failed ? "error" : "success");
    }
  };

  const stopQueue = () => {
    stopRequested.current = true;
    if (live) cancelJob(live.outputId);
  };

  const chooseOutputDir = async () => {
    if (!isTauri) return void showMessage("Carpeta de salida", "En el navegador, los resultados se descargan en tu carpeta de descargas.");
    const dir = await invoke<string | null>("core_pick_folder", { title: "Carpeta para los archivos codificados" });
    if (!dir) return;
    const q = cur();
    // Se actualizan los destinos de lo que aún no se ha codificado
    apply({ ...q, outputDir: dir, items: q.items.map((i) => ({ ...i, outputs: i.outputs.map((o) => (o.status === "ready" ? { ...o, target: dir + sep(dir) + baseName(o.target) } : o)) })) });
    toast("Carpeta de salida cambiada");
  };

  const saveCustomPreset = async () => {
    const o = selectedOutput();
    if (!o) return toast("Selecciona una salida para guardar sus ajustes", "info");
    const name = await askText({ title: "Guardar ajuste preestablecido", label: "Nombre", defaultValue: `${o.presetName} (personal)` });
    if (!name) return;
    const preset: Preset = { id: newId("pre"), name, category: "Mis ajustes", description: "Ajuste guardado por ti.", settings: { ...o.settings, trimIn: 0, trimOut: 0 }, custom: true };
    apply({ ...cur(), customPresets: [...cur().customPresets, preset] });
    toast("Ajuste guardado en «Mis ajustes»");
  };

  const selectedItem = () => cur()?.items.find((i) => i.id === selected?.item) || null;
  const selectedOutput = () => selectedItem()?.outputs.find((o) => o.id === selected?.output) || null;

  // ------------------------------------------------------------------------
  // Teclado y menús
  // ------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sd.docRef.current || sd.showStart || document.querySelector("[data-modal-open]")) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") return e.preventDefault(), e.shiftKey ? sd.redo() : sd.undo();
      if (mod && k === "y") return e.preventDefault(), sd.redo();
      if (mod && k === "i") return e.preventDefault(), void addFilesDialog();
      if (mod && k === "o") return e.preventDefault(), void sd.open();
      if (mod && k === "k") return e.preventDefault(), setCommandOpen(true);
      if (mod && k === "s") return e.preventDefault(), void (e.shiftKey ? sd.saveAs() : sd.flush().then(() => toast("Guardado")));
      if (mod && k === "d") return e.preventDefault(), duplicateOutput();
      if (e.key === "Enter" && !running) return void startQueue();
      if (e.key === "Escape" && running) return stopQueue();
      if (e.key === "Delete" || e.key === "Backspace") return removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pending = queue ? queue.items.reduce((n, i) => n + i.outputs.filter((o) => o.status === "ready").length, 0) : 0;

  const menus: MenuDefinition[] = queue
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Cola nueva", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir cola…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { label: "Añadir archivos…", icon: Plus, shortcut: "Ctrl+I", action: () => void addFilesDialog() },
            { divider: true },
            { label: "Guardar cola", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar cola como…", icon: SaveAll, action: () => void sd.saveAs() },
            { divider: true },
            { label: "Carpeta de salida…", icon: FolderOutput, action: () => void chooseOutputDir() },
            { label: "Pantalla de inicio", icon: Home, action: () => sd.setShowStart(true) },
          ],
        },
        {
          id: "edit",
          label: "Edición",
          items: [
            { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: sd.undo, disabled: !sd.canUndo },
            { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Mayús+Z", action: sd.redo, disabled: !sd.canRedo },
            { divider: true },
            { label: "Duplicar salida", icon: Copy, shortcut: "Ctrl+D", action: duplicateOutput, disabled: !selected },
            { label: "Quitar de la cola", icon: Trash2, shortcut: "Supr", action: removeSelected },
            { label: "Restablecer el estado", icon: RotateCcw, action: resetStatus },
            { label: "Quitar los terminados", action: clearDone },
            { divider: true },
            { label: "Seleccionar todos los archivos", action: () => setChecked(new Set(cur().items.map((i) => i.id))) },
            { label: "Quitar la selección", action: () => setChecked(new Set()) },
          ],
        },
        {
          id: "queue",
          label: "Cola",
          items: [
            { label: "Iniciar la cola", icon: Play, shortcut: "Intro", action: () => void startQueue(), disabled: running || !pending },
            { label: "Detener", icon: Square, shortcut: "Esc", action: stopQueue, disabled: !running },
            { divider: true },
            { label: "Empezar al añadir archivos", checked: queue.autoStart, action: () => apply({ ...cur(), autoStart: !cur().autoStart }, "auto") },
            { label: "Sonido al terminar", checked: queue.chime, action: () => apply({ ...cur(), chime: !cur().chime }, "chime") },
            { divider: true },
            { label: "Guardar ajustes como preestablecido…", icon: Star, action: () => void saveCustomPreset(), disabled: !selected },
            { label: "Ver comando de FFmpeg", icon: Terminal, action: () => {
              const it = selectedItem();
              const o = selectedOutput();
              if (it && o) setShowCmd(commandLine(buildArgs(it.source.startsWith("browser:") ? it.name : it.source, o.target, o.settings, it.info, false)));
            }, disabled: !selected },
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Cómo funciona",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Cómo funciona CoffeeEncoder",
                  "1. Añade o arrastra videos y audios a la cola.\n2. Elige un ajuste preestablecido a la izquierda (doble clic lo aplica; «+» añade otra salida al mismo archivo).\n3. Retoca los ajustes de la salida a la derecha: formato, resolución, calidad, recorte, marca de agua...\n4. Pulsa «Iniciar la cola» (Intro). Esc detiene.\n\nAtajos: Ctrl+I añadir · Ctrl+D duplicar salida · Supr quitar · Ctrl+K buscar comandos.\n\nLa codificación usa el complemento «Motor de video FFmpeg» (Launcher › Complementos). En el navegador solo están disponibles los ajustes marcados «sin FFmpeg»."
                ),
            },
            { label: "Acerca de CoffeeEncoder", icon: Info, action: () => void showMessage("CoffeeEncoder", "Cola de conversión de video y audio de la suite CoffeeWorks, con ajustes preestablecidos para redes sociales, dispositivos, web, edición y audio, y aceleración por hardware (NVIDIA, Intel y AMD).") },
          ],
        },
      ]
    : [];

  const sel = queue && selected ? queue.items.find((i) => i.id === selected.item) : null;
  const selOut = sel?.outputs.find((o) => o.id === selected?.output) || null;
  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeeencoder">
      <style>{STUDIO_CSS}</style>
      {queue && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Cola sin título"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <div className="flex items-center gap-2">
                <Button onClick={() => void addFilesDialog()}>
                  <Plus size={13} /> Añadir archivos
                </Button>
                {running ? (
                  <Button onClick={stopQueue} data-action="stop">
                    <Square size={12} /> Detener
                  </Button>
                ) : (
                  <Button primary accent={ACCENT} onClick={() => void startQueue()} disabled={!pending} data-action="start">
                    <Play size={13} /> Iniciar la cola{pending ? ` (${pending})` : ""}
                  </Button>
                )}
              </div>
            }
          />
          <div className="flex-1 flex min-h-0">
            <PresetBrowser
              presets={allPresets}
              query={presetQuery}
              setQuery={setPresetQuery}
              open={openCats}
              setOpen={setOpenCats}
              onApply={(p) => applyPreset(p, "replace")}
              onAdd={(p) => applyPreset(p, "add")}
              onDelete={(p) => apply({ ...cur(), customPresets: cur().customPresets.filter((x) => x.id !== p.id) })}
              current={selOut?.presetId}
            />
            <div className="flex-1 flex flex-col min-w-0">
              <div
                className={cx("flex-1 overflow-y-auto p-3 relative", dragOver && "ring-2 ring-inset ring-[#d6336c]")}
                data-queue
                onDragOver={(e) => {
                  if (isTauri) return;
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  if (isTauri) return;
                  e.preventDefault();
                  setDragOver(false);
                  void addBrowserFiles([...e.dataTransfer.files]);
                }}
              >
                <div className="flex items-center gap-2 mb-2 text-[11px] text-[#9a9aa2]">
                  <span className="font-semibold uppercase tracking-wide text-[#c9c9cf]">Cola</span>
                  <span>
                    {queue.items.length} {queue.items.length === 1 ? "archivo" : "archivos"} · {pending} pendientes
                  </span>
                  <div className="flex-1" />
                  <button type="button" onClick={() => void chooseOutputDir()} className="flex items-center gap-1 hover:text-white max-w-[45%]" title="Carpeta de salida" data-outdir>
                    <Folder size={12} />
                    <span className="truncate">{isTauri ? queue.outputDir || "Junto a cada original" : "Carpeta de descargas"}</span>
                  </button>
                  <IconButton icon={Copy} title="Duplicar salida (Ctrl+D)" onClick={duplicateOutput} size={14} />
                  <IconButton icon={RotateCcw} title="Restablecer el estado" onClick={resetStatus} size={14} />
                  <IconButton icon={Trash2} title="Quitar (Supr)" onClick={removeSelected} size={14} />
                </div>
                {queue.items.length === 0 && (
                  <div className="h-[70%] flex flex-col items-center justify-center gap-3 text-[#8b8b93] border-2 border-dashed border-white/10 rounded-xl">
                    <Film size={40} />
                    <span>Arrastra aquí videos o audios, o pulsa «Añadir archivos».</span>
                    <Button primary accent={ACCENT} onClick={() => void addFilesDialog()}>
                      <Plus size={13} /> Añadir archivos
                    </Button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {queue.items.map((item) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      selected={selected}
                      checked={checked.has(item.id)}
                      live={live?.itemId === item.id ? live : null}
                      presets={allPresets}
                      onCheck={(v) => {
                        const n = new Set(checked);
                        if (v) n.add(item.id);
                        else n.delete(item.id);
                        setChecked(n);
                      }}
                      onSelect={(output) => setSelected({ item: item.id, output })}
                      onPreset={(outputId, presetId) => {
                        const pr = presetById(presetId);
                        const it = cur().items.find((i) => i.id === item.id)!;
                        const o = { ...makeOutput(it, pr, { ...cur(), items: cur().items.map((i) => (i.id === item.id ? { ...i, outputs: i.outputs.filter((x) => x.id !== outputId) } : i)) }), id: outputId };
                        patchItem(item.id, { outputs: it.outputs.map((x) => (x.id === outputId ? o : x)) });
                        lastPreset.current = presetId;
                      }}
                      onAddOutput={() => {
                        const it = cur().items.find((i) => i.id === item.id)!;
                        const o = makeOutput(it, presetById(lastPreset.current));
                        patchItem(item.id, { outputs: [...it.outputs, o] });
                        setSelected({ item: item.id, output: o.id });
                      }}
                      onReveal={(o) => (isTauri ? void openExternal(dirOf(o.target)) : undefined)}
                      onRetry={(o) => patchOutput(item.id, o.id, { status: "ready", progress: 0, message: "" })}
                    />
                  ))}
                </div>
              </div>
              <EncodingPanel queue={queue} live={live} />
            </div>
            <SettingsPanel
              item={sel || null}
              output={selOut}
              onChange={(s, key) => {
                if (!sel || !selOut) return;
                const n = normalizeSettings(s);
                // Cambiar el contenedor cambia la extensión del destino
                const target = n.container !== selOut.settings.container ? selOut.target.replace(/\.[^.\\/]+$/, `.${n.container}`) : selOut.target;
                patchOutput(sel.id, selOut.id, { settings: n, target, presetName: selOut.presetName.endsWith(" (modificado)") ? selOut.presetName : `${selOut.presetName} (modificado)` }, key);
              }}
              onTarget={(t) => sel && selOut && patchOutput(sel.id, selOut.id, { target: t }, "target")}
              onSavePreset={() => void saveCustomPreset()}
            />
          </div>
        </>
      )}
      {showCmd && (
        <Modal title="Comando de FFmpeg" onClose={() => setShowCmd(null)} width={620} footer={<><Button onClick={() => void navigator.clipboard?.writeText(showCmd).then(() => toast("Copiado"))}>Copiar</Button><Button primary accent={ACCENT} onClick={() => setShowCmd(null)}>Cerrar</Button></>}>
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] bg-black/40 p-3 rounded select-text" data-command>{showCmd}</pre>
        </Modal>
      )}
      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />
      {sd.showStart && (
        <StartScreen
          appName="CoffeeEncoder"
          tagline="Conversión de video y audio por lotes • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Cola nueva: añade videos y audios y elige el formato"
          openHint="Abrir una cola guardada (.cen)"
          formats={[".cen"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={queue ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Navegador de ajustes preestablecidos
// ---------------------------------------------------------------------------

const presetIcon = (p: Preset) => (isAudioOnly(p.settings) ? Music : isStill(p.settings) || p.settings.container === "gif" ? ImageIcon : Film);

const PresetBrowser: React.FC<{
  presets: Preset[];
  query: string;
  setQuery: (q: string) => void;
  open: Set<string>;
  setOpen: (s: Set<string>) => void;
  onApply: (p: Preset) => void;
  onAdd: (p: Preset) => void;
  onDelete: (p: Preset) => void;
  current?: string;
}> = ({ presets, query, setQuery, open, setOpen, onApply, onAdd, onDelete, current }) => {
  const q = query.trim().toLowerCase();
  const list = q ? presets.filter((p) => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q)) : presets;
  return (
    <aside className="w-[270px] shrink-0 bg-[#202023] border-r border-black/50 flex flex-col" data-presets>
      <div className="px-3 h-9 flex items-center border-b border-black/40">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Ajustes preestablecidos</span>
      </div>
      <div className="p-2">
        <label className="flex items-center gap-2 bg-[#141416] rounded px-2 h-7">
          <Search size={12} className="text-[#8b8b93]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar (YouTube, MP3, GIF...)" className="flex-1 bg-transparent outline-none text-[12px]" data-preset-search />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {CATEGORIES.map((cat) => {
          const items = list.filter((p) => p.category === cat);
          if (!items.length) return null;
          const isOpen = open.has(cat) || !!q;
          return (
            <div key={cat}>
              <button
                type="button"
                className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#c9c9cf] hover:text-white"
                onClick={() => {
                  const n = new Set(open);
                  if (n.has(cat)) n.delete(cat);
                  else n.add(cat);
                  setOpen(n);
                }}
              >
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {cat} <span className="text-[#6f6f77] font-normal">({items.length})</span>
              </button>
              {isOpen &&
                items.map((p) => {
                  const Icon = presetIcon(p);
                  return (
                    <div
                      key={p.id}
                      className={cx("group flex items-start gap-2 pl-5 pr-1 py-1.5 rounded cursor-pointer", current === p.id ? "bg-[#d6336c]/25" : "hover:bg-white/5")}
                      onDoubleClick={() => onApply(p)}
                      title={`${p.description}\nDoble clic: aplicar a la salida seleccionada`}
                      data-preset={p.name}
                    >
                      <Icon size={13} className="mt-0.5 shrink-0 text-[#ff8fab]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] truncate">{p.name}</div>
                        <div className="text-[10px] text-[#7d7d85] truncate">
                          {CONTAINER_LABEL[p.settings.container]}
                          {p.settings.width ? ` · ${p.settings.width}×${p.settings.height || "auto"}` : ""}
                          {p.browser ? " · sin FFmpeg" : ""}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex">
                        <button type="button" title="Aplicar" onClick={() => onApply(p)} className="p-0.5 text-[#b9b9c0] hover:text-white" data-apply>
                          <CheckCircle2 size={13} />
                        </button>
                        <button type="button" title="Añadir como otra salida" onClick={() => onAdd(p)} className="p-0.5 text-[#b9b9c0] hover:text-white" data-add>
                          <Plus size={13} />
                        </button>
                        {p.custom && (
                          <button type="button" title="Borrar" onClick={() => onDelete(p)} className="p-0.5 text-[#b9b9c0] hover:text-white">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Fila de la cola
// ---------------------------------------------------------------------------

const QueueRow: React.FC<{
  item: QueueItem;
  selected: { item: string; output: string } | null;
  checked: boolean;
  live: { outputId: string; progress: Progress } | null;
  presets: Preset[];
  onCheck: (v: boolean) => void;
  onSelect: (outputId: string) => void;
  onPreset: (outputId: string, presetId: string) => void;
  onAddOutput: () => void;
  onReveal: (o: Output) => void;
  onRetry: (o: Output) => void;
}> = ({ item, selected, checked, live, presets, onCheck, onSelect, onPreset, onAddOutput, onReveal, onRetry }) => {
  const info = item.info;
  const missing = !isTauri && item.source.startsWith("browser:") && !hasBrowserFile(item.source);
  return (
    <div className={cx("rounded-lg bg-[#202024] border", selected?.item === item.id ? "border-[#d6336c]/70" : "border-white/5")} data-item={item.name}>
      <div className="flex items-center gap-3 p-2">
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} title="Marcar para aplicar ajustes a varios" />
        <div className="w-[88px] h-[50px] rounded bg-black/50 overflow-hidden flex items-center justify-center shrink-0">
          {item.thumb ? <img src={item.thumb} alt="" className="w-full h-full object-cover" /> : info && !info.hasVideo ? <Music size={18} className="text-[#ff8fab]" /> : <Film size={18} className="text-[#6f6f77]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" title={item.source.startsWith("browser:") ? item.name : item.source}>
            {item.name}
          </div>
          <div className="text-[11px] text-[#8b8b93] font-mono truncate" data-info>
            {missing
              ? "Vuelve a añadirlo: el navegador no conserva el archivo al recargar"
              : info
              ? [fmtDuration(info.duration), info.hasVideo ? `${info.width}×${info.height}` : "solo audio", info.hasVideo && info.fps ? `${+info.fps.toFixed(2)} fps` : "", info.vcodec, info.hasAudio ? `${info.acodec} ${info.sampleRate ? info.sampleRate / 1000 + " kHz" : ""}` : "sin audio", item.size ? fmtBytes(item.size) : ""].filter(Boolean).join(" · ")
              : "Analizando…"}
          </div>
        </div>
        <IconButton icon={Plus} title="Añadir otra salida" onClick={onAddOutput} size={14} />
      </div>
      <div className="flex flex-col border-t border-white/5">
        {item.outputs.map((o) => {
          const isLive = live?.outputId === o.id;
          const frac = isLive ? live!.progress.fraction : o.progress;
          const look = STATUS_LOOK[o.status];
          const est = estimateSize(o.settings, info);
          const blocked = !isTauri && !browserCan(o.settings);
          return (
            <div
              key={o.id}
              onClick={() => onSelect(o.id)}
              className={cx("relative flex items-center gap-2 pl-10 pr-2 py-1.5 cursor-pointer text-[12px]", selected?.output === o.id ? "bg-[#d6336c]/15" : "hover:bg-white/[0.03]")}
              data-output={o.presetName}
              data-status={o.status}
            >
              {(o.status === "encoding" || o.status === "done") && <div className="absolute left-0 bottom-0 h-[2px]" style={{ width: `${frac * 100}%`, background: o.status === "done" ? "#69db7c" : ACCENT }} />}
              <select
                value={o.presetId}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onPreset(o.id, e.target.value)}
                disabled={o.status === "encoding"}
                className="bg-[#141416] rounded px-1 h-6 text-[12px] max-w-[220px]"
                title="Ajuste preestablecido"
              >
                {CATEGORIES.map((c) => (
                  <optgroup key={c} label={c}>
                    {presets
                      .filter((p) => p.category === c)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {o.presetName.endsWith("(modificado)") && <span className="text-[10px] text-[#ffa94d]">modificado</span>}
              <span className="text-[#8b8b93] text-[11px] w-14 shrink-0">{CONTAINER_LABEL[o.settings.container].split(" ")[0]}</span>
              <span className="flex-1 min-w-0 truncate text-[#b9b9c0] font-mono text-[11px]" title={o.target}>
                {isTauri ? o.target : baseName(o.target)}
              </span>
              {est && o.status === "ready" && <span className="text-[10px] text-[#6f6f77]">≈ {fmtBytes(est)}</span>}
              {o.size && o.status === "done" ? <span className="text-[10px] text-[#8ce99a]">{fmtBytes(o.size)}</span> : null}
              <span className="flex items-center gap-1 w-28 justify-end shrink-0" style={{ color: blocked && o.status === "ready" ? "#ffa94d" : look.color }} title={o.message}>
                {o.status === "encoding" ? <Loader2 size={12} className="animate-spin" /> : o.status === "done" ? <CheckCircle2 size={12} /> : o.status === "error" ? <XCircle size={12} /> : <Clock3 size={12} />}
                {o.status === "encoding" ? `${Math.round(frac * 100)} %` : blocked && o.status === "ready" ? "Necesita FFmpeg" : look.label}
              </span>
              {o.status === "done" && isTauri && (
                <button type="button" onClick={(e) => (e.stopPropagation(), onReveal(o))} title="Abrir la carpeta" className="text-[#b9b9c0] hover:text-white">
                  <FolderOpen size={13} />
                </button>
              )}
              {(o.status === "error" || o.status === "cancelled") && (
                <button type="button" onClick={(e) => (e.stopPropagation(), onRetry(o))} title="Reintentar" className="text-[#b9b9c0] hover:text-white">
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          );
        })}
        {item.outputs.some((o) => o.status === "error" && o.message) && (
          <div className="pl-10 pr-2 pb-2 text-[11px] text-[#ff8787] whitespace-pre-wrap" data-error>
            {item.outputs.find((o) => o.status === "error")!.message}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ajustes de exportación
// ---------------------------------------------------------------------------

const SettingsPanel: React.FC<{
  item: QueueItem | null;
  output: Output | null;
  onChange: (s: EncodeSettings, key: string) => void;
  onTarget: (t: string) => void;
  onSavePreset: () => void;
}> = ({ item, output, onChange, onTarget, onSavePreset }) => {
  if (!item || !output)
    return (
      <aside className="w-[310px] shrink-0 bg-[#202023] border-l border-black/50 flex items-center justify-center text-[12px] text-[#6f6f77] p-6 text-center" data-settings>
        Selecciona una salida de la cola para ver y cambiar sus ajustes de exportación.
      </aside>
    );
  const s = output.settings;
  const locked = output.status === "encoding";
  const set = (patch: Partial<EncodeSettings>, key: string) => !locked && onChange({ ...s, ...patch }, key);
  const codecs = CONTAINER_CODECS[s.container];
  const video = !isAudioOnly(s) && s.vcodec !== "copy";
  const still = isStill(s);
  const est = estimateSize(s, item.info);
  const dur = outputDuration(s, item.info);
  const hwOk = s.vcodec === "h264" || s.vcodec === "hevc" || s.vcodec === "av1";
  return (
    <aside className="w-[310px] shrink-0 bg-[#202023] border-l border-black/50 flex flex-col min-h-0" data-settings>
      <div className="px-3 h-9 flex items-center border-b border-black/40 justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Ajustes de exportación</span>
        <button type="button" onClick={onSavePreset} title="Guardar como ajuste preestablecido" className="text-[#b9b9c0] hover:text-white">
          <Star size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] text-[#9a9aa2] border-b border-black/30">
          <div className="text-[#e4e4e8] text-[12px] font-medium truncate">{output.presetName}</div>
          <div>
            {dur ? `Duración ${fmtDuration(dur)}` : ""}
            {est ? ` · Tamaño estimado ≈ ${fmtBytes(est)}` : ""}
          </div>
          {locked && <div className="text-[#ffa94d]">Se está codificando: los ajustes están bloqueados.</div>}
        </div>
        <Section title="Formato">
          <Select value={s.container} onChange={(v) => set({ container: v as Container }, "container")} options={(Object.keys(CONTAINER_LABEL) as Container[]).map((c) => ({ value: c, label: CONTAINER_LABEL[c] }))} data-name="container" />
          <label className="flex flex-col gap-1 text-[11px] text-[#9a9aa2]">
            Archivo de salida
            <input value={isTauri ? output.target : baseName(output.target)} onChange={(e) => onTarget(isTauri ? e.target.value : e.target.value)} disabled={locked} className="bg-[#141416] rounded px-2 h-7 text-[11px] font-mono text-[#e4e4e8]" data-target />
          </label>
        </Section>
        {!isAudioOnly(s) && (
          <Section title="Video">
            {codecs.v.length > 1 && <Select value={s.vcodec} onChange={(v) => set({ vcodec: v as EncodeSettings["vcodec"] }, "vcodec")} options={codecs.v.map((c) => ({ value: c, label: VCODEC_LABEL[c] }))} data-name="vcodec" />}
            {video && (
              <>
                <div className="flex gap-2">
                  <NumberField label="Ancho" value={s.width} min={0} max={7680} step={2} onChange={(v) => set({ width: v }, "w")} className="flex-1" />
                  <NumberField label="Alto" value={s.height} min={0} max={4320} step={2} onChange={(v) => set({ height: v }, "h")} className="flex-1" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    ["Original", 0, 0],
                    ["4K", 3840, 2160],
                    ["1080p", 1920, 1080],
                    ["720p", 1280, 720],
                    ["480p", 854, 480],
                    ["9:16", 1080, 1920],
                    ["1:1", 1080, 1080],
                  ].map(([l, w, h]) => (
                    <button key={l as string} type="button" onClick={() => set({ width: w as number, height: h as number }, "size")} className={cx("px-1.5 h-5 rounded text-[10px]", s.width === w && s.height === h ? "bg-[#d6336c] text-white" : "bg-[#141416] text-[#b9b9c0] hover:text-white")}>
                      {l}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-[#6f6f77]">0 = como el original{item.info?.hasVideo ? ` (${item.info.width}×${item.info.height})` : ""}.</span>
                {s.width > 0 && s.height > 0 && (
                  <Select
                    value={s.fit}
                    onChange={(v) => set({ fit: v as EncodeSettings["fit"] }, "fit")}
                    options={[
                      { value: "fit", label: "Encajar (con bandas negras)" },
                      { value: "fill", label: "Rellenar (recorta los bordes)" },
                      { value: "stretch", label: "Estirar" },
                    ]}
                  />
                )}
                {!still && (
                  <Select
                    value={String(s.fps)}
                    onChange={(v) => set({ fps: Number(v) }, "fps")}
                    options={[
                      { value: "0", label: "Fotogramas: como el original" },
                      ...[12, 15, 23.976, 24, 25, 29.97, 30, 50, 59.94, 60].map((f) => ({ value: String(f), label: `${f} fps` })),
                    ]}
                  />
                )}
                {!still && s.vcodec !== "gif" && s.vcodec !== "prores" && (
                  <>
                    <Select
                      value={s.rateMode}
                      onChange={(v) => set({ rateMode: v as EncodeSettings["rateMode"] }, "rate")}
                      options={[
                        { value: "crf", label: "Calidad constante (recomendado)" },
                        { value: "bitrate", label: "Tasa de bits objetivo" },
                      ]}
                    />
                    {s.rateMode === "crf" ? (
                      <Slider label="Calidad (menor = mejor)" value={s.crf} min={s.vcodec === "vp9" || s.vcodec === "av1" ? 15 : 14} max={s.vcodec === "vp9" || s.vcodec === "av1" ? 50 : 36} onChange={(v) => set({ crf: v }, "crf")} data-name="crf" />
                    ) : (
                      <NumberField label="Tasa de bits" value={s.bitrate} min={200} max={150000} step={500} suffix="kbps" onChange={(v) => set({ bitrate: v }, "br")} />
                    )}
                  </>
                )}
                {s.vcodec === "prores" && (
                  <Select value={String(s.proresProfile)} onChange={(v) => set({ proresProfile: Number(v) }, "prores")} options={[{ value: "0", label: "ProRes 422 Proxy" }, { value: "1", label: "ProRes 422 LT" }, { value: "2", label: "ProRes 422" }, { value: "3", label: "ProRes 422 HQ" }]} />
                )}
                {(s.vcodec === "h264" || s.vcodec === "hevc" || s.vcodec === "av1" || s.vcodec === "vp9") && s.hardware === "none" && (
                  <Select
                    value={s.speed}
                    onChange={(v) => set({ speed: v as EncodeSettings["speed"] }, "speed")}
                    options={[
                      { value: "ultrafast", label: "Velocidad: la más rápida" },
                      { value: "veryfast", label: "Velocidad: muy rápida" },
                      { value: "fast", label: "Velocidad: rápida" },
                      { value: "medium", label: "Velocidad: equilibrada" },
                      { value: "slow", label: "Velocidad: lenta (archivo menor)" },
                      { value: "veryslow", label: "Velocidad: muy lenta" },
                    ]}
                  />
                )}
                {hwOk && (
                  <Select
                    value={s.hardware}
                    onChange={(v) => set({ hardware: v as EncodeSettings["hardware"] }, "hw")}
                    options={[
                      { value: "none", label: "Codificador: software (CPU)" },
                      { value: "nvenc", label: "Hardware: NVIDIA NVENC" },
                      { value: "qsv", label: "Hardware: Intel Quick Sync" },
                      { value: "amf", label: "Hardware: AMD AMF" },
                    ]}
                  />
                )}
              </>
            )}
            {still && <NumberField label="Fotograma en el segundo" value={s.frameAt} min={0} max={item.info?.duration || 36000} step={0.5} onChange={(v) => set({ frameAt: v }, "frame")} />}
          </Section>
        )}
        {video && (
          <Section title="Efectos de video" defaultOpen={false}>
            <Select value={String(s.rotate)} onChange={(v) => set({ rotate: Number(v) }, "rot")} options={[{ value: "0", label: "Sin girar" }, { value: "90", label: "Girar 90° a la derecha" }, { value: "180", label: "Girar 180°" }, { value: "270", label: "Girar 90° a la izquierda" }]} />
            <Toggle checked={s.deinterlace} onChange={(v) => set({ deinterlace: v }, "deint")} label="Desentrelazar" accent={ACCENT} />
            <label className="flex flex-col gap-1 text-[11px] text-[#9a9aa2]">
              Marca de agua (texto)
              <input value={s.watermark} onChange={(e) => set({ watermark: e.target.value }, "wm")} placeholder="© Tu nombre" className="bg-[#141416] rounded px-2 h-7 text-[12px] text-[#e4e4e8]" data-watermark />
            </label>
            {s.watermark && (
              <Select value={s.watermarkPos} onChange={(v) => set({ watermarkPos: v as EncodeSettings["watermarkPos"] }, "wmpos")} options={[{ value: "br", label: "Abajo a la derecha" }, { value: "bl", label: "Abajo a la izquierda" }, { value: "tr", label: "Arriba a la derecha" }, { value: "tl", label: "Arriba a la izquierda" }, { value: "c", label: "Centro" }]} />
            )}
          </Section>
        )}
        {s.acodec !== "none" && !still && (
          <Section title="Audio">
            {codecs.a.length > 1 && <Select value={s.acodec} onChange={(v) => set({ acodec: v as EncodeSettings["acodec"] }, "acodec")} options={codecs.a.map((c) => ({ value: c, label: ACODEC_LABEL[c] }))} data-name="acodec" />}
            {["aac", "mp3", "opus", "vorbis"].includes(s.acodec) && (
              <Select value={String(s.abitrate)} onChange={(v) => set({ abitrate: Number(v) }, "ab")} options={[64, 96, 128, 160, 192, 256, 320, 384].map((b) => ({ value: String(b), label: `${b} kbps` }))} />
            )}
            {s.acodec !== "copy" && (
              <>
                <Select value={String(s.sampleRate)} onChange={(v) => set({ sampleRate: Number(v) }, "sr")} options={[{ value: "0", label: "Frecuencia: como el original" }, { value: "44100", label: "44,1 kHz" }, { value: "48000", label: "48 kHz" }, { value: "96000", label: "96 kHz" }]} />
                <Select value={String(s.channels)} onChange={(v) => set({ channels: Number(v) }, "ch")} options={[{ value: "0", label: "Canales: como el original" }, { value: "1", label: "Mono" }, { value: "2", label: "Estéreo" }]} />
                <Toggle checked={s.loudnorm} onChange={(v) => set({ loudnorm: v }, "ln")} label="Normalizar la sonoridad" accent={ACCENT} />
                {s.loudnorm && <Slider label="Sonoridad objetivo" value={s.loudness} min={-30} max={-9} suffix="LUFS" onChange={(v) => set({ loudness: v }, "lufs")} />}
              </>
            )}
          </Section>
        )}
        {!still && (
          <Section title="Recorte de tiempo" defaultOpen={s.trimIn > 0 || s.trimOut > 0}>
            <div className="flex gap-2">
              <NumberField label="Desde" value={s.trimIn} min={0} max={item.info?.duration || 360000} step={0.5} suffix="s" onChange={(v) => set({ trimIn: v }, "tin")} className="flex-1" />
              <NumberField label="Hasta" value={s.trimOut} min={0} max={item.info?.duration || 360000} step={0.5} suffix="s" onChange={(v) => set({ trimOut: v }, "tout")} className="flex-1" />
            </div>
            <span className="text-[10px] text-[#6f6f77]">«Hasta» 0 = hasta el final.</span>
          </Section>
        )}
        <Section title="Resumen" defaultOpen={false}>
          <div className="text-[11px] text-[#9a9aa2] leading-relaxed" data-summary>
            {CONTAINER_LABEL[s.container]}
            {!isAudioOnly(s) ? ` · ${VCODEC_LABEL[s.vcodec]}` : ""}
            {s.width ? ` · ${s.width}×${s.height || "auto"}` : ""}
            {s.fps ? ` · ${s.fps} fps` : ""}
            {s.acodec !== "none" && !still ? ` · ${ACODEC_LABEL[s.acodec]}${["aac", "mp3", "opus", "vorbis"].includes(s.acodec) ? ` ${s.abitrate} kbps` : ""}` : ""}
            {s.loudnorm ? ` · ${s.loudness} LUFS` : ""}
            {s.hardware !== "none" ? ` · ${s.hardware.toUpperCase()}` : ""}
          </div>
        </Section>
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Panel de codificación e historial
// ---------------------------------------------------------------------------

const EncodingPanel: React.FC<{ queue: Queue; live: { itemId: string; outputId: string; progress: Progress; started: number } | null }> = ({ queue, live }) => {
  const [tab, setTab] = useState<"now" | "history">("now");
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [live]);
  const item = live ? queue.items.find((i) => i.id === live.itemId) : null;
  const out = item?.outputs.find((o) => o.id === live?.outputId);
  const elapsed = live ? (Date.now() - live.started) / 1000 : 0;
  const frac = live?.progress.fraction || 0;
  const remaining = frac > 0.02 ? (elapsed / frac) * (1 - frac) : NaN;
  return (
    <div className="h-[150px] shrink-0 bg-[#1c1c1f] border-t border-black/50 flex flex-col" data-encoding>
      <div className="flex items-center gap-3 px-3 h-8 border-b border-black/40 text-[11px]">
        {(["now", "history"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cx("h-full border-b-2 font-semibold uppercase tracking-wide", tab === t ? "border-[#d6336c] text-white" : "border-transparent text-[#8b8b93]")}>
            {t === "now" ? "Codificando" : `Historial (${queue.history.length})`}
          </button>
        ))}
      </div>
      {tab === "now" ? (
        live && item && out ? (
          <div className="flex-1 flex items-center gap-4 px-4">
            <div className="w-[160px] h-[90px] bg-black/50 rounded overflow-hidden flex items-center justify-center">{item.thumb ? <img src={item.thumb} alt="" className="w-full h-full object-cover" /> : <Music size={24} className="text-[#ff8fab]" />}</div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="text-[13px] truncate">
                {item.name} <span className="text-[#8b8b93]">→ {out.presetName}</span>
              </div>
              <div className="h-2 bg-[#2a2a2f] rounded overflow-hidden">
                <div className="h-full transition-[width]" style={{ width: `${frac * 100}%`, background: `linear-gradient(90deg, ${ACCENT_DARK}, ${ACCENT})` }} />
              </div>
              <div className="flex gap-4 text-[11px] text-[#9a9aa2] font-mono" data-live>
                <span>{Math.round(frac * 100)} %</span>
                <span>Transcurrido {fmtDuration(elapsed)}</span>
                <span>Restante {fmtDuration(remaining)}</span>
                {live.progress.speed && <span>Velocidad {live.progress.speed}</span>}
                {live.progress.fps && live.progress.fps !== "0.00" && <span>{live.progress.fps} fps</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12px] text-[#6f6f77]">No se está codificando nada. Pulsa «Iniciar la cola» o Intro.</div>
        )
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-1 text-[11px]" data-history>
          {queue.history.length === 0 && <div className="text-[#6f6f77] p-2">Aún no hay nada en el historial.</div>}
          {queue.history.map((h) => (
            <div key={h.id} className="flex items-center gap-2 py-0.5">
              {h.ok ? <CheckCircle2 size={12} className="text-[#69db7c]" /> : <XCircle size={12} className="text-[#ff6b6b]" />}
              <span className="truncate flex-1">
                {h.name} → {h.preset}
              </span>
              <span className="text-[#6f6f77] truncate max-w-[40%] font-mono" title={h.target}>
                {baseName(h.target)}
              </span>
              <span className="text-[#6f6f77] w-14 text-right">{fmtDuration(h.seconds)}</span>
              <span className="text-[#6f6f77] w-32 text-right">{new Date(h.at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

