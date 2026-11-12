import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, Play, Pause, SkipBack, SkipForward, MousePointer2, Hand, Square, Circle, Star, Hexagon, PenTool, Type, Scissors, Copy, Trash2, Layers, Camera, Repeat, Grid3x3, ImagePlus } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, showMessage, toast } from "./studio/Dialogs";
import { createDocStore, downloadBlob } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, IconButton, Modal, NumberField, STUDIO_CSS, Select, Slider, Toggle, cx } from "./studio/ui";
import { isTauri, pickOpenFiles, saveFileAs, type PickedFile } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import { newId } from "./studio/color";
import { FORMAT_LABEL, encodeGifJob, encodePngSequence, encodeWebM, encodeWithFfmpeg, extensionOf, isCancelled, needsFfmpeg, type FrameJob, type VideoFormat } from "./studio/videoExport";
import { invoke } from "@tauri-apps/api/core";
import { ACCENT, ACCENT_DARK, type Asset, type Comp, type Ease, type EffectKind, type Layer, type PathPoint, type Project, type Vec } from "./types";
import { ANIM_PRESETS, TITLE_TEMPLATES, adjustmentLayer, compUses, mediaLayer, newComp, newEffect, newMask, newProject, nullLayer, parseProject, precompLayer, serializeProject, shapeLayer, solidLayer, textLayer, P } from "./services/model";
import { EASE_CURVES, EASE_LABEL, cubicBezier, fmtTimecode, keyedValue, setAt } from "./services/anim";
import { MediaCache, renderComp, releaseCanvas, seekMedia, snapshot, type RenderEnv } from "./services/render";
import { AudioPreview, mixAudio } from "./services/audio";
import { layerProps } from "./services/props";
import { Viewer, type Tool } from "./components/Viewer";
import { Timeline, type KeyRef } from "./components/Timeline";
import { EffectsPanel, ProjectPanel, PropertiesPanel } from "./components/Panels";

const store = createDocStore<Project>({
  appId: "coffeemotion",
  extension: "cmo",
  category: "Ilustración",
  defaultTitle: "Proyecto sin título",
  kindLabel: "Proyectos de CoffeeMotion",
  serialize: serializeProject,
  parse: parseProject,
  create: newProject,
});

const IMPORT_EXT = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "mp4", "webm", "mov", "m4v", "mp3", "wav", "ogg", "m4a", "aac", "flac"];

const COMP_PRESETS = [
  { label: "HD 1080p (1920×1080)", w: 1920, h: 1080 },
  { label: "4K UHD (3840×2160)", w: 3840, h: 2160 },
  { label: "HD 720p (1280×720)", w: 1280, h: 720 },
  { label: "Vertical 9:16 (1080×1920)", w: 1080, h: 1920 },
  { label: "Cuadrado (1080×1080)", w: 1080, h: 1080 },
  { label: "Instagram 4:5 (1080×1350)", w: 1080, h: 1350 },
];

type Dialog = { kind: "comp"; id: string | null } | { kind: "export" } | { kind: "key"; ref: KeyRef } | null;

const kindOf = (name: string): Asset["kind"] | null => {
  const e = name.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(e)) return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(e)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(e)) return "audio";
  return null;
};

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", bmp: "image/bmp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac" };

async function assetFromFile(file: PickedFile): Promise<Asset | null> {
  const kind = kindOf(file.name);
  if (!kind) return null;
  const ext = file.name.split(".").pop()!.toLowerCase();
  const data = await new Promise<string>((r) => {
    const fr = new FileReader();
    fr.onload = () => r(String(fr.result));
    fr.readAsDataURL(new Blob([file.bytes as BlobPart], { type: MIME[ext] || "application/octet-stream" }));
  });
  const asset: Asset = { id: newId("as"), name: file.name, kind, data, width: 0, height: 0, duration: 0 };
  if (kind === "image") {
    const img = new Image();
    await new Promise<void>((r) => {
      img.onload = () => r();
      img.onerror = () => r();
      img.src = data;
    });
    asset.width = img.naturalWidth || 512;
    asset.height = img.naturalHeight || 512;
  } else {
    const el = document.createElement(kind === "video" ? "video" : "audio") as HTMLVideoElement;
    el.preload = "metadata";
    await new Promise<void>((r) => {
      el.onloadedmetadata = () => r();
      el.onerror = () => r();
      el.src = data;
    });
    asset.duration = isFinite(el.duration) ? el.duration : 0;
    asset.width = el.videoWidth || 0;
    asset.height = el.videoHeight || 0;
  }
  return asset;
}

export const App: React.FC = () => {
  const sd = useStudioDoc<Project>(store, { appName: "CoffeeMotion", historyLimit: 80 });
  const project = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = (next: Project, key = "") => sd.apply(next, key);
  const comp = project?.comps.find((c) => c.id === project.activeComp) || null;

  const media = useMemo(() => new MediaCache(), []);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    media.onReady = () => setVersion((v) => v + 1);
  }, [media]);
  useEffect(() => {
    if (project) media.sync(project.assets);
  }, [project?.assets, media, project]);
  const env: RenderEnv | null = useMemo(() => (project ? { project, media, scale: 1 } : null), [project, media]);

  const [time, setTimeState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<KeyRef[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [quality, setQuality] = useState(1);
  const [guides, setGuides] = useState(false);
  const [pps, setPps] = useState(120);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<"project" | "effects">("project");
  const [exporting, setExporting] = useState<{ fraction: number; label: string } | null>(null);
  const cancelExport = useRef(false);
  const audio = useMemo(() => new AudioPreview(), []);
  const timeRef = useRef(0);
  const setTime = (t: number) => {
    timeRef.current = t;
    setTimeState(t);
  };

  useEffect(() => {
    setSelected([]);
    setSelectedKeys([]);
    if (comp && time > comp.duration) setTime(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp?.id]);

  // ------------------------------------------------------------------------
  // Modificar el proyecto
  // ------------------------------------------------------------------------

  const patchComp = (fn: (c: Comp) => Comp, key = "") => {
    const p = cur();
    apply({ ...p, comps: p.comps.map((c) => (c.id === p.activeComp ? fn(c) : c)) }, key);
  };
  const patchLayer = (id: string, fn: (l: Layer) => Layer, key = "") => patchComp((c) => ({ ...c, layers: c.layers.map((l) => (l.id === id ? fn(l) : l)) }), key);
  const addLayer = (l: Layer, select = true) => {
    patchComp((c) => ({ ...c, layers: [l, ...c.layers] }));
    if (select) setSelected([l.id]);
  };
  const activeComp = () => cur().comps.find((c) => c.id === cur().activeComp)!;

  const importFiles = async (files: PickedFile[], addToComp = true) => {
    if (!files.length) return;
    if (!sd.docRef.current) await sd.newDocument();
    const assets: Asset[] = [];
    for (const f of files) {
      const a = await assetFromFile(f);
      if (a) assets.push(a);
    }
    if (!assets.length) return void showMessage("Formato no admitido", "Importa imágenes (PNG, JPG, SVG...), videos (MP4, WebM) o audio (MP3, WAV...).");
    const p = cur();
    const c = activeComp();
    const layers = addToComp ? assets.map((a) => mediaLayer(c, a, timeRef.current)) : [];
    apply({ ...p, assets: [...p.assets, ...assets], comps: p.comps.map((x) => (x.id === c.id ? { ...x, layers: [...layers.reverse(), ...x.layers] } : x)) });
    if (layers.length) setSelected([layers[0].id]);
    toast(assets.length === 1 ? `«${assets[0].name}» importado` : `${assets.length} archivos importados`);
  };

  const importDialog = async () => importFiles(await pickOpenFiles([{ name: "Imágenes, video y audio", extensions: IMPORT_EXT }], "Importar"));

  // Arrastrar archivos a la ventana
  useEffect(() => {
    const over = (e: DragEvent) => e.dataTransfer?.types.includes("Files") && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      void Promise.all([...e.dataTransfer.files].map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), path: null }) as PickedFile)).then((fs) => importFiles(fs));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  const duplicate = () => {
    if (!selected.length) return;
    const c = activeComp();
    const copies: Layer[] = [];
    const layers = c.layers.flatMap((l) => {
      if (!selected.includes(l.id)) return [l];
      const copy = { ...structuredClone(l), id: newId("ly"), name: `${l.name} copia` };
      copies.push(copy);
      return [copy, l];
    });
    patchComp((x) => ({ ...x, layers }));
    setSelected(copies.map((l) => l.id));
  };

  const removeSelected = () => {
    if (selectedKeys.length) {
      const c = activeComp();
      const byLayer = new Map<string, KeyRef[]>();
      selectedKeys.forEach((k) => byLayer.set(k.layer, [...(byLayer.get(k.layer) || []), k]));
      patchComp(() => ({
        ...c,
        layers: c.layers.map((l) => {
          const ks = byLayer.get(l.id);
          if (!ks) return l;
          let next = l;
          for (const ref of layerProps(l)) {
            const pr = ref.get(next);
            if (!pr.keys) continue;
            const left = pr.keys.filter((k) => !ks.some((s) => s.path === ref.path && s.id === k.id));
            if (left.length === pr.keys.length) continue;
            next = ref.set(next, left.length ? { ...pr, keys: left } : { ...pr, value: keyedValue(pr, timeRef.current), keys: undefined });
          }
          return next;
        }),
      }));
      setSelectedKeys([]);
      return;
    }
    if (!selected.length) return;
    patchComp((c) => ({ ...c, layers: c.layers.filter((l) => !selected.includes(l.id)).map((l) => (l.parent && selected.includes(l.parent) ? { ...l, parent: null } : l)) }));
    setSelected([]);
  };

  const splitLayer = () => {
    const t = timeRef.current;
    const c = activeComp();
    const layers = c.layers.flatMap((l) => {
      if (!selected.includes(l.id) || t <= l.inPoint || t >= l.outPoint) return [l];
      const b = { ...structuredClone(l), id: newId("ly"), inPoint: t };
      return [b, { ...l, outPoint: t }];
    });
    patchComp((x) => ({ ...x, layers }));
  };

  const precompose = () => {
    if (!selected.length) return;
    const p = cur();
    const c = activeComp();
    const inner = { ...newComp(`Precomposición ${p.comps.length}`, c.width, c.height, c.fps, c.duration), background: "#00000000", layers: c.layers.filter((l) => selected.includes(l.id)) };
    const firstIdx = c.layers.findIndex((l) => selected.includes(l.id));
    const pl = precompLayer(c, inner, 0);
    const layers = c.layers.filter((l) => !selected.includes(l.id));
    layers.splice(firstIdx, 0, pl);
    apply({ ...p, comps: [...p.comps.map((x) => (x.id === c.id ? { ...x, layers } : x)), inner] });
    setSelected([pl.id]);
    toast("Capas precompuestas");
  };

  const applyPreset = (id: string) => {
    const preset = ANIM_PRESETS.find((x) => x.id === id);
    if (!preset || !selected.length) return;
    const c = activeComp();
    patchComp((x) => ({ ...x, layers: x.layers.map((l) => (selected.includes(l.id) ? preset.apply(l, c, timeRef.current) : l)) }));
    toast(`«${preset.name}» aplicado`);
  };

  const applyEffect = (k: EffectKind) => {
    if (!selected.length) return;
    patchComp((x) => ({ ...x, layers: x.layers.map((l) => (selected.includes(l.id) ? { ...l, effects: [...l.effects, newEffect(k)] } : l)) }));
  };

  const addTemplate = async (id: string) => {
    const tpl = TITLE_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (!sd.docRef.current) await sd.newDocument();
    const c0 = activeComp();
    const c = tpl.build(c0.width, c0.height);
    apply({ ...cur(), comps: [...cur().comps, c], activeComp: c.id });
    setTime(0);
    toast(`Plantilla «${tpl.name}» creada`);
  };

  const easeSelectedKeys = (ease: Ease, bez?: [number, number, number, number]) => {
    if (!selectedKeys.length) return toast("Selecciona fotogramas clave en la línea de tiempo", "info");
    const c = activeComp();
    patchComp(() => ({
      ...c,
      layers: c.layers.map((l) => {
        const ks = selectedKeys.filter((k) => k.layer === l.id);
        if (!ks.length) return l;
        let next = l;
        for (const ref of layerProps(l)) {
          const pr = ref.get(next);
          if (!pr.keys?.some((k) => ks.some((s) => s.path === ref.path && s.id === k.id))) continue;
          next = ref.set(next, { ...pr, keys: pr.keys.map((k) => (ks.some((s) => s.path === ref.path && s.id === k.id) ? { ...k, ease, bez } : k)) });
        }
        return next;
      }),
    }));
  };

  const onTransform = (id: string, patch: { position?: Vec; scale?: Vec; rotation?: number; anchor?: Vec }, key: string) => {
    const t = timeRef.current;
    patchLayer(
      id,
      (l) => ({
        ...l,
        transform: {
          ...l.transform,
          ...(patch.position ? { position: setAt(l.transform.position, t, patch.position) } : {}),
          ...(patch.scale ? { scale: setAt(l.transform.scale, t, patch.scale) } : {}),
          ...(patch.rotation !== undefined ? { rotation: setAt(l.transform.rotation, t, patch.rotation) } : {}),
          ...(patch.anchor ? { anchor: setAt(l.transform.anchor, t, patch.anchor) } : {}),
        },
      }),
      key
    );
  };

  // ------------------------------------------------------------------------
  // Reproducción
  // ------------------------------------------------------------------------

  useEffect(() => {
    if (!playing || !comp || !project) return;
    const a = comp.workIn;
    const b = comp.workOut;
    let start = timeRef.current >= b - 1e-3 || timeRef.current < a ? a : timeRef.current;
    let t0 = performance.now();
    void audio.start(project, comp, start, b);
    let raf = 0;
    const step = () => {
      let t = start + (performance.now() - t0) / 1000;
      if (t >= b) {
        if (!loop) {
          setTime(b);
          setPlaying(false);
          audio.stop();
          return;
        }
        start = a;
        t0 = performance.now();
        t = a;
        void audio.start(project, comp, a, b);
      }
      // Ajuste al fotograma
      setTime(Math.floor(t * comp.fps) / comp.fps);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Los videos se reproducen solos durante la vista previa
    const vids: HTMLVideoElement[] = [];
    return () => {
      cancelAnimationFrame(raf);
      audio.stop();
      vids.forEach((v) => v.pause());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Durante la reproducción, los videos se ponen en su sitio sin esperar
  useEffect(() => {
    if (!playing || !env || !comp) return;
    void seekMedia(env, comp, time);
  }, [playing, time, env, comp]);

  const togglePlay = () => setPlaying((p) => !p);
  const frameStep = (n: number) => comp && setTime(Math.max(0, Math.min(comp.duration, Math.round((timeRef.current + n / comp.fps) * comp.fps) / comp.fps)));

  // ------------------------------------------------------------------------
  // Exportar
  // ------------------------------------------------------------------------

  const runExport = async (format: VideoFormat, range: "work" | "all", scale: number) => {
    if (!project || !comp || !env) return;
    setDialog(null);
    setPlaying(false);
    const from = range === "work" ? comp.workIn : 0;
    const to = range === "work" ? comp.workOut : comp.duration;
    const frames = Math.max(1, Math.round((to - from) * comp.fps));
    const transparent = /^#[0-9a-f]{6}00$/i.test(comp.background);
    const base = sd.title || comp.name;
    const name = `${base}.${extensionOf(format)}`;
    let target: string | null = null;
    if (needsFfmpeg(format)) {
      if (!isTauri) return void showMessage("Necesita FFmpeg", "MP4, MOV y el GIF de alta calidad se exportan desde la aplicación de escritorio con el complemento «Motor de video FFmpeg». En el navegador, exporta a WebM, GIF o secuencia PNG.");
      if (!(await ensureAddon("ffmpeg", "CoffeeMotion"))) return;
      target = await invoke<string | null>("core_pick_save", { title: "Exportar video", defaultName: name, filters: [{ name: FORMAT_LABEL[format], extensions: [extensionOf(format)] }] });
      if (!target) return;
    }
    cancelExport.current = false;
    setExporting({ fraction: 0, label: "Preparando" });
    try {
      await media.ready();
      const audioBuf = format === "gif" || format === "gif-ffmpeg" || format === "png" ? null : await mixAudio(project, comp, from, to);
      const W = Math.round(comp.width * scale);
      const H = Math.round(comp.height * scale);
      let last: HTMLCanvasElement | null = null;
      const job: FrameJob = {
        width: W,
        height: H,
        fps: comp.fps,
        frames,
        audio: audioBuf,
        alpha: transparent,
        cancelled: () => cancelExport.current,
        onProgress: (fraction, label) => setExporting({ fraction, label }),
        render: async (i) => {
          const t = from + i / comp.fps;
          await seekMedia(env, comp, t);
          if (last) releaseCanvas(last);
          last = renderComp({ ...env, scale }, comp, t, scale);
          return last;
        },
      };
      if (format === "webm") {
        const blob = await encodeWebM(job);
        await saveFileAs(name, [{ name: "WebM", extensions: ["webm"] }], blob, "Exportar video");
      } else if (format === "gif") {
        const blob = await encodeGifJob(job, Math.min(W, 800));
        await saveFileAs(name, [{ name: "GIF", extensions: ["gif"] }], blob, "Exportar GIF");
      } else if (format === "png") {
        const blob = await encodePngSequence(job, base.replace(/[^\w-]+/g, "_"));
        await saveFileAs(name, [{ name: "ZIP", extensions: ["zip"] }], blob, "Exportar secuencia PNG");
      } else await encodeWithFfmpeg(job, format, target!);
      toast("Exportación terminada");
    } catch (err) {
      if (!isCancelled(err)) await showMessage("No se pudo exportar", err instanceof Error ? err.message : String(err));
      else toast("Exportación cancelada", "info");
    } finally {
      setExporting(null);
    }
  };

  const exportFrame = async () => {
    if (!env || !comp) return;
    await seekMedia(env, comp, timeRef.current);
    const c = snapshot(renderComp({ ...env, scale: 1 }, comp, timeRef.current, 1));
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    if (isTauri) await saveFileAs(`${comp.name} ${fmtTimecode(timeRef.current, comp.fps).replace(/:/g, "-")}.png`, [{ name: "PNG", extensions: ["png"] }], blob, "Guardar fotograma");
    else downloadBlob(blob, `${comp.name}.png`);
  };

  // ------------------------------------------------------------------------
  // Teclado
  // ------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sd.docRef.current || sd.showStart || dialog || document.querySelector("[data-modal-open]") || exporting) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select,[contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod) {
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? sd.redo() : sd.undo()),
          y: () => sd.redo(),
          s: () => (e.shiftKey ? void sd.saveAs() : void sd.flush().then(() => toast("Guardado"))),
          o: () => void sd.open(),
          i: () => void importDialog(),
          d: () => (e.shiftKey ? splitLayer() : duplicate()),
          m: () => setDialog({ kind: "export" }),
          k: () => (e.shiftKey ? setDialog({ kind: "comp", id: cur().activeComp }) : setCommandOpen(true)),
          n: () => setDialog({ kind: "comp", id: null }),
          c: () => e.shiftKey && precompose(),
          a: () => setSelected(activeComp().layers.map((l) => l.id)),
        };
        const fn = map[k];
        if (fn && (k !== "c" || e.shiftKey)) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (e.code === "Space") return e.preventDefault(), togglePlay();
      if (e.key === "Delete" || e.key === "Backspace") return removeSelected();
      if (e.key === "Home") return setTime(0);
      if (e.key === "End") return comp && setTime(comp.duration - 1 / comp.fps);
      if (e.key === "PageDown" || e.key === "ArrowRight") return e.preventDefault(), frameStep(e.shiftKey ? 10 : 1);
      if (e.key === "PageUp" || e.key === "ArrowLeft") return e.preventDefault(), frameStep(e.shiftKey ? -10 : -1);
      if (e.key === "F9") return e.preventDefault(), easeSelectedKeys("easeInOut");
      if (e.key === "Escape") return setSelected([]), setSelectedKeys([]);
      if (e.altKey && (e.key === "[" || e.code === "BracketLeft")) return selected.forEach((id) => patchLayer(id, (l) => ({ ...l, inPoint: Math.min(timeRef.current, l.outPoint - 0.01) })));
      if (e.altKey && (e.key === "]" || e.code === "BracketRight")) return selected.forEach((id) => patchLayer(id, (l) => ({ ...l, outPoint: Math.max(timeRef.current, l.inPoint + 0.01) })));
      if (k === "b") return patchComp((c) => ({ ...c, workIn: Math.min(timeRef.current, c.workOut - 1 / c.fps) }));
      if (k === "n") return patchComp((c) => ({ ...c, workOut: Math.max(timeRef.current + 1 / c.fps, c.workIn + 1 / c.fps) }));
      if (k === "u") return selected.forEach((id) => patchLayer(id, (l) => ({ ...l, expanded: !l.expanded })));
      const tools: Record<string, Tool> = { v: "select", h: "hand", q: "rect", e: "ellipse", g: "pen", t: "text" };
      if (tools[k]) return setTool(tools[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------------
  // Menús
  // ------------------------------------------------------------------------

  const t = time;
  const menus: MenuDefinition[] = project && comp
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Proyecto nuevo", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir proyecto…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { label: "Importar…", icon: ImagePlus, shortcut: "Ctrl+I", action: () => void importDialog() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, action: () => void sd.saveAs() },
            { divider: true },
            { label: "Exportar video…", icon: Download, shortcut: "Ctrl+M", action: () => setDialog({ kind: "export" }) },
            { label: "Guardar el fotograma como PNG", icon: Camera, action: () => void exportFrame() },
            { divider: true },
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
            { label: "Duplicar", icon: Copy, shortcut: "Ctrl+D", action: duplicate, disabled: !selected.length },
            { label: "Dividir la capa en el cabezal", icon: Scissors, shortcut: "Ctrl+Mayús+D", action: splitLayer, disabled: !selected.length },
            { label: "Eliminar", icon: Trash2, shortcut: "Supr", action: removeSelected, disabled: !selected.length && !selectedKeys.length },
            { label: "Seleccionar todas las capas", shortcut: "Ctrl+A", action: () => setSelected(comp.layers.map((l) => l.id)) },
          ],
        },
        {
          id: "comp",
          label: "Composición",
          items: [
            { label: "Composición nueva…", shortcut: "Ctrl+N", action: () => setDialog({ kind: "comp", id: null }) },
            { label: "Ajustes de la composición…", shortcut: "Ctrl+Mayús+K", action: () => setDialog({ kind: "comp", id: comp.id }) },
            { divider: true },
            { label: "Inicio del área de trabajo en el cabezal", shortcut: "B", action: () => patchComp((c) => ({ ...c, workIn: Math.min(t, c.workOut - 1 / c.fps) })) },
            { label: "Final del área de trabajo en el cabezal", shortcut: "N", action: () => patchComp((c) => ({ ...c, workOut: Math.max(t + 1 / c.fps, c.workIn + 1 / c.fps) })) },
            { label: "Recortar la composición al área de trabajo", action: () => patchComp((c) => ({ ...c, duration: c.workOut, workIn: c.workIn })) },
            { divider: true },
            { label: "Desenfoque de movimiento", checked: comp.motionBlurOn, action: () => patchComp((c) => ({ ...c, motionBlurOn: !c.motionBlurOn })) },
          ],
        },
        {
          id: "layer",
          label: "Capa",
          items: [
            { label: "Nuevo texto", icon: Type, action: () => addLayer(textLayer(comp, "Tu texto aquí", t)) },
            { label: "Nuevo sólido", action: () => addLayer(solidLayer(comp, "#e8590c", t)) },
            { label: "Nueva forma: rectángulo", icon: Square, action: () => addLayer(shapeLayer(comp, "rect", t)) },
            { label: "Nueva forma: elipse", icon: Circle, action: () => addLayer(shapeLayer(comp, "ellipse", t, "#f06595")) },
            { label: "Nueva forma: estrella", icon: Star, action: () => addLayer(shapeLayer(comp, "star", t, "#ffd43b")) },
            { label: "Nuevo objeto nulo", action: () => addLayer(nullLayer(comp, t)) },
            { label: "Nueva capa de ajuste", action: () => addLayer(adjustmentLayer(comp, t)) },
            { divider: true },
            { label: "Máscara rectangular en la capa", action: () => selected[0] && setTool("maskRect"), disabled: !selected.length },
            { label: "Máscara elíptica en la capa", action: () => selected[0] && setTool("maskEllipse"), disabled: !selected.length },
            { label: "Precomponer…", icon: Layers, shortcut: "Ctrl+Mayús+C", action: precompose, disabled: !selected.length },
            { divider: true },
            { label: "Traer al frente", action: () => patchComp((c) => ({ ...c, layers: [...c.layers.filter((l) => selected.includes(l.id)), ...c.layers.filter((l) => !selected.includes(l.id))] })), disabled: !selected.length },
            { label: "Enviar al fondo", action: () => patchComp((c) => ({ ...c, layers: [...c.layers.filter((l) => !selected.includes(l.id)), ...c.layers.filter((l) => selected.includes(l.id))] })), disabled: !selected.length },
            { label: "Mostrar u ocultar propiedades", shortcut: "U", action: () => selected.forEach((id) => patchLayer(id, (l) => ({ ...l, expanded: !l.expanded }))), disabled: !selected.length },
          ],
        },
        {
          id: "anim",
          label: "Animación",
          items: [
            { label: "Suavizado (entrada y salida)", shortcut: "F9", action: () => easeSelectedKeys("easeInOut"), disabled: !selectedKeys.length },
            { label: "Acelerar", action: () => easeSelectedKeys("easeIn"), disabled: !selectedKeys.length },
            { label: "Frenar", action: () => easeSelectedKeys("easeOut"), disabled: !selectedKeys.length },
            { label: "Lineal", action: () => easeSelectedKeys("linear"), disabled: !selectedKeys.length },
            { label: "Mantener (sin interpolar)", action: () => easeSelectedKeys("hold"), disabled: !selectedKeys.length },
            { divider: true },
            ...ANIM_PRESETS.slice(0, 8).map((pr) => ({ label: pr.name, action: () => applyPreset(pr.id), disabled: !selected.length })),
          ],
        },
        {
          id: "view",
          label: "Vista",
          items: [
            { label: "Calidad completa", checked: quality === 1, action: () => setQuality(1) },
            { label: "Media calidad", checked: quality === 0.5, action: () => setQuality(0.5) },
            { label: "Un cuarto", checked: quality === 0.25, action: () => setQuality(0.25) },
            { divider: true },
            { label: "Guías y zonas seguras", icon: Grid3x3, checked: guides, action: () => setGuides(!guides) },
            { label: "Repetir la reproducción", icon: Repeat, checked: loop, action: () => setLoop(!loop) },
            { label: "Buscar comandos…", shortcut: "Ctrl+K", action: () => setCommandOpen(true) },
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Atajos y expresiones",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Atajos y expresiones",
                  "Herramientas: V selección · H mano · Q rectángulo · E elipse · G pluma · T texto.\nEspacio reproducir · ←/→ o RePág/AvPág fotograma a fotograma (Mayús: 10) · Inicio/Fin.\nB / N: inicio y final del área de trabajo · U: mostrar propiedades · F9: suavizado.\nAlt+[ / Alt+]: recortar la entrada o la salida en el cabezal · Ctrl+D duplicar · Ctrl+Mayús+D dividir · Ctrl+Mayús+C precomponer · Ctrl+M exportar.\n\nAnimar: pulsa el cronómetro de una propiedad y cambia su valor en otro instante: se crea una clave. Doble clic en una clave para elegir el suavizado.\n\nExpresiones (botón «=»): time, value, wiggle(frecuencia, cantidad), loopOut(), loopOut(\"pingpong\"), linear(t, a, b, x, y), ease(...), random(), Math... Ejemplos: wiggle(2, 30) · value + time * 90 · [value[0], value[1] + Math.sin(time * 3) * 20]."
                ),
            },
            { label: "Acerca de CoffeeMotion", icon: Info, action: () => void showMessage("CoffeeMotion", "Gráficos en movimiento y efectos visuales de la suite CoffeeWorks: composiciones anidadas, capas de forma, texto, imagen, video y audio, fotogramas clave con suavizado, expresiones, efectos, máscaras, mates de seguimiento, desenfoque de movimiento y exportación a WebM, GIF, PNG y, con FFmpeg, MP4 y MOV.") },
          ],
        },
      ]
    : [];

  const selLayer = comp && selected.length === 1 ? comp.layers.find((l) => l.id === selected[0]) || null : null;
  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  const TOOLS: { id: Tool; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Selección (V)" },
    { id: "hand", icon: Hand, label: "Mano (H)" },
    { id: "rect", icon: Square, label: "Rectángulo (Q)" },
    { id: "ellipse", icon: Circle, label: "Elipse (E)" },
    { id: "star", icon: Star, label: "Estrella" },
    { id: "polygon", icon: Hexagon, label: "Polígono" },
    { id: "pen", icon: PenTool, label: "Pluma (G): clic para puntos, arrastra para curvas, Intro termina" },
    { id: "text", icon: Type, label: "Texto (T)" },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeemotion">
      <style>{STUDIO_CSS}</style>
      {project && comp && env && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Proyecto sin título"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <Button primary accent={ACCENT} onClick={() => setDialog({ kind: "export" })}>
                <Download size={13} /> Exportar
              </Button>
            }
          />
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex min-h-0">
              {/* Izquierda */}
              <aside className="w-[250px] shrink-0 bg-[#202023] border-r border-black/50 flex flex-col min-h-0">
                <div className="flex text-[11px] border-b border-black/40">
                  {(["project", "effects"] as const).map((tab) => (
                    <button key={tab} type="button" onClick={() => setLeftTab(tab)} className={cx("flex-1 h-8 font-semibold", leftTab === tab ? "text-white border-b-2 border-[#c2367f]" : "text-[#8b8b93]")}>
                      {tab === "project" ? "Proyecto" : "Efectos"}
                    </button>
                  ))}
                </div>
                {leftTab === "project" ? (
                  <ProjectPanel
                    project={project}
                    onOpenComp={(id) => apply({ ...cur(), activeComp: id }, "open-comp")}
                    onNewComp={() => setDialog({ kind: "comp", id: null })}
                    onImport={() => void importDialog()}
                    onAddToComp={(a) => addLayer(mediaLayer(activeComp(), a, timeRef.current))}
                    onRemoveAsset={(id) => apply({ ...cur(), assets: cur().assets.filter((a) => a.id !== id), comps: cur().comps.map((c) => ({ ...c, layers: c.layers.filter((l) => l.assetId !== id) })) })}
                    onRemoveComp={(id) => {
                      const p = cur();
                      const comps = p.comps.filter((c) => c.id !== id).map((c) => ({ ...c, layers: c.layers.filter((l) => l.compId !== id) }));
                      apply({ ...p, comps, activeComp: p.activeComp === id ? comps[0].id : p.activeComp });
                    }}
                    onCompSettings={(id) => setDialog({ kind: "comp", id })}
                    onNestComp={(id) => {
                      if (compUses(cur(), id, cur().activeComp)) return toast("No se puede anidar una composición dentro de sí misma", "error");
                      const inner = cur().comps.find((c) => c.id === id)!;
                      addLayer(precompLayer(activeComp(), inner, timeRef.current));
                    }}
                  />
                ) : (
                  <EffectsPanel onEffect={applyEffect} onPreset={applyPreset} onTemplate={(id) => void addTemplate(id)} hasLayer={!!selected.length} />
                )}
              </aside>
              {/* Centro */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="h-9 shrink-0 flex items-center gap-1 px-2 bg-[#1e1e21] border-b border-black/50" data-tools>
                  {TOOLS.map((tl) => (
                    <IconButton key={tl.id} icon={tl.icon} title={tl.label} active={tool === tl.id} accent={ACCENT} onClick={() => setTool(tl.id)} data-tool={tl.id} />
                  ))}
                  <div className="w-px h-5 bg-white/10 mx-1" />
                  <IconButton icon={SkipBack} title="Ir al inicio (Inicio)" onClick={() => setTime(comp.workIn)} />
                  <IconButton icon={playing ? Pause : Play} title="Reproducir (Espacio)" onClick={togglePlay} active={playing} accent={ACCENT} data-tool="play" />
                  <IconButton icon={SkipForward} title="Ir al final" onClick={() => setTime(comp.workOut - 1 / comp.fps)} />
                  <IconButton icon={Repeat} title="Repetir" active={loop} accent={ACCENT} onClick={() => setLoop(!loop)} />
                  <div className="flex-1" />
                  <select value={comp.id} onChange={(e) => apply({ ...cur(), activeComp: e.target.value }, "open-comp")} className="bg-[#141416] rounded h-6 text-[12px] px-1 max-w-[220px]" title="Composición activa">
                    {project.comps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select value={String(quality)} onChange={(e) => setQuality(Number(e.target.value))} className="bg-[#141416] rounded h-6 text-[12px] px-1" title="Calidad de la vista previa">
                    <option value="1">Completa</option>
                    <option value="0.5">Media</option>
                    <option value="0.25">Un cuarto</option>
                  </select>
                  <IconButton icon={Grid3x3} title="Guías" active={guides} accent={ACCENT} onClick={() => setGuides(!guides)} />
                  <IconButton icon={Camera} title="Guardar el fotograma (PNG)" onClick={() => void exportFrame()} />
                </div>
                <div
                  className="flex-1 flex min-h-0"
                  onDragOver={(e) => (e.dataTransfer.types.includes("text/coffee-asset") || e.dataTransfer.types.includes("text/coffee-comp")) && e.preventDefault()}
                  onDrop={(e) => {
                    const aid = e.dataTransfer.getData("text/coffee-asset");
                    const cid = e.dataTransfer.getData("text/coffee-comp");
                    if (aid) {
                      const a = cur().assets.find((x) => x.id === aid);
                      if (a) addLayer(mediaLayer(activeComp(), a, timeRef.current));
                    } else if (cid && cid !== cur().activeComp) {
                      if (compUses(cur(), cid, cur().activeComp)) return toast("No se puede anidar una composición dentro de sí misma", "error");
                      addLayer(precompLayer(activeComp(), cur().comps.find((c) => c.id === cid)!, timeRef.current));
                    }
                  }}
                >
                  <Viewer
                    env={env}
                    comp={comp}
                    time={time}
                    selected={selected}
                    setSelected={(ids) => {
                      setSelected(ids);
                      setSelectedKeys([]);
                    }}
                    tool={tool}
                    quality={quality}
                    showGuides={guides}
                    onTransform={onTransform}
                    onCreateShape={(kind, center, size) => {
                      const fills: Record<string, string> = { rect: "#ff922b", ellipse: "#f06595", star: "#ffd43b", polygon: "#4dabf7" };
                      const l = shapeLayer(comp, kind, timeRef.current, fills[kind], Math.round(size[0]), Math.round(size[1]));
                      l.transform.position = P<Vec>([Math.round(center[0]), Math.round(center[1])]);
                      addLayer(l);
                      setTool("select");
                    }}
                    onCreatePath={(points: PathPoint[], closed) => {
                      const cx0 = points.reduce((s, q) => s + q.x, 0) / points.length;
                      const cy0 = points.reduce((s, q) => s + q.y, 0) / points.length;
                      const l = shapeLayer(comp, "path", timeRef.current, "#69db7c");
                      l.shape!.path = points.map((q) => ({ ...q, x: q.x - cx0, y: q.y - cy0 }));
                      l.shape!.closed = closed;
                      l.shape!.fillOn = closed;
                      l.shape!.strokeOn = true;
                      l.transform.position = P<Vec>([cx0, cy0]);
                      addLayer(l);
                    }}
                    onCreateText={(at) => {
                      const l = textLayer(comp, "Tu texto", timeRef.current, Math.round(comp.height / 10));
                      l.transform.position = P<Vec>([Math.round(at[0]), Math.round(at[1])]);
                      addLayer(l);
                      setTool("select");
                      window.setTimeout(() => (document.querySelector("[data-text-input]") as HTMLTextAreaElement | null)?.select(), 80);
                    }}
                    onCreateMask={(id, kind, rect) => {
                      patchLayer(id, (l) => ({ ...l, masks: [...l.masks, newMask(kind, rect)] }));
                      setTool("select");
                    }}
                    version={version}
                    playing={playing}
                  />
                </div>
              </div>
              {/* Derecha */}
              <aside className="w-[290px] shrink-0 bg-[#202023] border-l border-black/50 flex flex-col min-h-0">
                <div className="px-3 h-8 flex items-center border-b border-black/40 text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Propiedades</div>
                <PropertiesPanel comp={comp} layer={selLayer} time={time} onLayer={(fn, key) => selLayer && patchLayer(selLayer.id, fn, key)} />
              </aside>
            </div>
            <div className="h-[300px] shrink-0 border-t border-black/60">
              <Timeline
                comp={comp}
                time={time}
                setTime={(tt) => {
                  setPlaying(false);
                  setTime(tt);
                }}
                selected={selected}
                setSelected={setSelected}
                onLayer={patchLayer}
                onComp={patchComp}
                selectedKeys={selectedKeys}
                setSelectedKeys={setSelectedKeys}
                onEditKey={(ref) => setDialog({ kind: "key", ref })}
                pxPerSec={pps}
                setPxPerSec={setPps}
              />
            </div>
          </div>
        </>
      )}

      {dialog?.kind === "comp" && project && (
        <CompDialog
          comp={dialog.id ? project.comps.find((c) => c.id === dialog.id)! : null}
          onCancel={() => setDialog(null)}
          onTemplate={(id) => {
            setDialog(null);
            void addTemplate(id);
          }}
          onSave={(c) => {
            setDialog(null);
            const p = cur();
            if (dialog.id) apply({ ...p, comps: p.comps.map((x) => (x.id === c.id ? c : x)) });
            else {
              apply({ ...p, comps: [...p.comps, c], activeComp: c.id });
              setTime(0);
            }
          }}
        />
      )}
      {dialog?.kind === "export" && comp && <ExportDialog comp={comp} onCancel={() => setDialog(null)} onExport={(f, r, s) => void runExport(f, r, s)} />}
      {dialog?.kind === "key" && comp && (
        <KeyDialog
          initial={(() => {
            const l = comp.layers.find((x) => x.id === dialog.ref.layer);
            const pr = l && layerProps(l).find((x) => x.path === dialog.ref.path);
            return pr?.get(l!).keys?.find((k) => k.id === dialog.ref.id) || null;
          })()}
          onCancel={() => setDialog(null)}
          onApply={(ease, bez) => {
            const ref = dialog.ref;
            setDialog(null);
            patchLayer(ref.layer, (l) => {
              const pr = layerProps(l).find((x) => x.path === ref.path);
              if (!pr) return l;
              const prop = pr.get(l);
              return pr.set(l, { ...prop, keys: prop.keys?.map((k) => (k.id === ref.id ? { ...k, ease, bez } : k)) });
            });
          }}
        />
      )}
      {exporting && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center" data-exporting>
          <div className="bg-[#26262b] rounded-xl px-6 py-5 w-[380px] shadow-2xl flex flex-col gap-3">
            <div className="text-sm font-semibold">Exportando…</div>
            <div className="h-2 bg-[#141416] rounded overflow-hidden">
              <div className="h-full" style={{ width: `${exporting.fraction * 100}%`, background: ACCENT }} />
            </div>
            <div className="text-[12px] text-[#9a9aa2] flex justify-between">
              <span>{exporting.label}</span>
              <span>{Math.round(exporting.fraction * 100)} %</span>
            </div>
            <Button onClick={() => (cancelExport.current = true)}>Cancelar</Button>
          </div>
        </div>
      )}
      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />
      {sd.showStart && (
        <StartScreen
          appName="CoffeeMotion"
          tagline="Gráficos en movimiento y efectos visuales • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Proyecto nuevo con una composición 1080p"
          openHint="Abrir un proyecto .cmo"
          formats={[".cmo"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={project ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

const CompDialog: React.FC<{ comp: Comp | null; onSave: (c: Comp) => void; onCancel: () => void; onTemplate: (id: string) => void }> = ({ comp, onSave, onCancel, onTemplate }) => {
  const [c, setC] = useState<Comp>(() => comp || newComp("Composición nueva"));
  const transparent = /^#[0-9a-f]{6}00$/i.test(c.background);
  return (
    <Modal
      title={comp ? "Ajustes de la composición" : "Composición nueva"}
      onClose={onCancel}
      width={460}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACCENT} onClick={() => onSave({ ...c, workOut: Math.min(c.workOut > c.duration || !comp ? c.duration : c.workOut, c.duration), workIn: Math.min(c.workIn, c.duration - 1 / c.fps) })}>
            {comp ? "Aceptar" : "Crear"}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1 text-[11px] text-[#9a9aa2]">
        Nombre
        <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className="bg-[#141416] rounded px-2 h-7 text-[12px] text-white" data-comp-name />
      </label>
      <Select value="" onChange={(v) => {
        const pr = COMP_PRESETS[Number(v)];
        if (pr) setC({ ...c, width: pr.w, height: pr.h });
      }} options={[{ value: "", label: "Ajuste preestablecido…" }, ...COMP_PRESETS.map((pr, i) => ({ value: String(i), label: pr.label }))]} />
      <div className="flex gap-2">
        <NumberField label="Ancho" value={c.width} min={16} max={7680} onChange={(v) => setC({ ...c, width: Math.round(v) })} className="flex-1" suffix="px" />
        <NumberField label="Alto" value={c.height} min={16} max={7680} onChange={(v) => setC({ ...c, height: Math.round(v) })} className="flex-1" suffix="px" />
      </div>
      <div className="flex gap-2">
        <Select value={String(c.fps)} onChange={(v) => setC({ ...c, fps: Number(v) })} options={[12, 15, 24, 25, 30, 50, 60].map((f) => ({ value: String(f), label: `${f} fps` }))} className="flex-1" />
        <NumberField label="Duración" value={c.duration} min={0.1} max={3600} step={0.5} onChange={(v) => setC({ ...c, duration: v, workOut: comp ? Math.min(c.workOut, v) : v })} className="flex-1" suffix="s" />
      </div>
      <div className="flex items-center gap-3 text-[12px]">
        Fondo
        <input type="color" value={c.background.slice(0, 7)} onChange={(e) => setC({ ...c, background: e.target.value + (transparent ? "00" : "") })} className="w-8 h-6 bg-transparent" />
        <Toggle checked={transparent} onChange={(v) => setC({ ...c, background: c.background.slice(0, 7) + (v ? "00" : "") })} label="Transparente" accent={ACCENT} />
      </div>
      <Slider label="Obturador del desenfoque de movimiento" value={c.shutterAngle} min={0} max={720} suffix="°" onChange={(v) => setC({ ...c, shutterAngle: v })} />
      {!comp && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-[#9a9aa2]">O empieza con una plantilla de título:</span>
          <div className="grid grid-cols-2 gap-1.5">
            {TITLE_TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" onClick={() => onTemplate(tpl.id)} className="text-left bg-[#1b1b1f] hover:bg-[#2a2a30] rounded p-2" data-template-btn={tpl.name}>
                <div className="text-[12px] font-medium">{tpl.name}</div>
                <div className="text-[10px] text-[#8b8b93]">{tpl.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

const ExportDialog: React.FC<{ comp: Comp; onExport: (f: VideoFormat, range: "work" | "all", scale: number) => void; onCancel: () => void }> = ({ comp, onExport, onCancel }) => {
  const [format, setFormat] = useState<VideoFormat>(isTauri ? "mp4" : "webm");
  const [range, setRange] = useState<"work" | "all">("work");
  const [scale, setScale] = useState(1);
  const dur = range === "work" ? comp.workOut - comp.workIn : comp.duration;
  return (
    <Modal title="Exportar" onClose={onCancel} width={420} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onExport(format, range, scale)}>Exportar</Button></>}>
      <Select value={format} onChange={(v) => setFormat(v as VideoFormat)} options={(Object.keys(FORMAT_LABEL) as VideoFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} data-name="format" />
      {needsFfmpeg(format) && !isTauri && <span className="text-[11px] text-[#ffa94d]">Este formato necesita la aplicación de escritorio con el complemento FFmpeg.</span>}
      <Select value={range} onChange={(v) => setRange(v as "work" | "all")} options={[{ value: "work", label: "Área de trabajo" }, { value: "all", label: "Composición completa" }]} />
      <Select value={String(scale)} onChange={(v) => setScale(Number(v))} options={[{ value: "1", label: `Tamaño completo (${comp.width}×${comp.height})` }, { value: "0.5", label: `Mitad (${Math.round(comp.width / 2)}×${Math.round(comp.height / 2)})` }, { value: "0.25", label: `Un cuarto (${Math.round(comp.width / 4)}×${Math.round(comp.height / 4)})` }]} />
      <span className="text-[11px] text-[#8b8b93]">
        {dur.toFixed(2)} s · {Math.round(dur * comp.fps)} fotogramas a {comp.fps} fps
      </span>
    </Modal>
  );
};

const KeyDialog: React.FC<{ initial: { ease: Ease; bez?: [number, number, number, number] } | null; onApply: (e: Ease, bez?: [number, number, number, number]) => void; onCancel: () => void }> = ({ initial, onApply, onCancel }) => {
  const [ease, setEase] = useState<Ease>(initial?.ease || "linear");
  const [bez, setBez] = useState<[number, number, number, number]>(initial?.bez || (ease !== "hold" && ease !== "bezier" ? EASE_CURVES[ease] : EASE_CURVES.easeInOut));
  const curve = ease === "bezier" ? bez : ease === "hold" ? null : EASE_CURVES[ease];
  const W = 220;
  const H = 160;
  const path = curve ? Array.from({ length: 41 }, (_, i) => `${i ? "L" : "M"}${(i / 40) * W},${H - cubicBezier(i / 40, curve) * H}`).join(" ") : `M0,${H} L${W},${H} L${W},0`;
  return (
    <Modal title="Suavizado del fotograma clave" onClose={onCancel} width={380} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onApply(ease, ease === "bezier" ? bez : undefined)}>Aplicar</Button></>}>
      <Select value={ease} onChange={(v) => setEase(v as Ease)} options={(Object.keys(EASE_LABEL) as Ease[]).map((e) => ({ value: e, label: EASE_LABEL[e] }))} />
      <svg width={W} height={H} className="self-center bg-[#141416] rounded overflow-visible">
        <path d={path} fill="none" stroke={ACCENT} strokeWidth={2.5} />
      </svg>
      {ease === "bezier" && (
        <div className="grid grid-cols-2 gap-2">
          {(["Salida X", "Salida Y", "Entrada X", "Entrada Y"] as const).map((lbl, i) => (
            <Slider key={lbl} label={lbl} value={bez[i]} min={i % 2 ? -0.5 : 0} max={i % 2 ? 1.5 : 1} step={0.01} onChange={(v) => setBez(bez.map((b, j) => (j === i ? v : b)) as [number, number, number, number])} />
          ))}
        </div>
      )}
      <span className="text-[11px] text-[#8b8b93]">Se aplica al tramo que empieza en esta clave.</span>
    </Modal>
  );
};
