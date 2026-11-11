// Editor de video: biblioteca de medios y títulos, vista previa, propiedades
// del clip y línea de tiempo. La exportación graba la composición en tiempo real.

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Trash2,
  Upload,
  Film,
  Music,
  Image as ImageIcon,
  Type,
  Plus,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  X,
  Loader2,
  Download,
  Copy,
} from "lucide-react";
import type { Clip, MediaClip, MediaItem, Project, TextClip, TrackKind } from "../types";
import { ACCENT } from "../types";
import { TimelineEngine, drawText } from "../services/engine";
import {
  DEFAULT_ADJUST,
  DEFAULT_TRANSFORM,
  IMAGE_DURATION,
  clipEnd,
  defaultText,
  formatTime,
  freeSlot,
  newId,
  newTrack,
  splitClip,
} from "../services/project";
import { canRecordMp4, recordingFormat } from "../services/media";
import { ChunkWriter, downloadBlob, pickSavePath } from "../services/store";
import { isTauri } from "../services/desktop";
import { Inspector } from "./Inspector";
import { MEDIA_DRAG_TYPE, Timeline } from "./Timeline";
import { askConfirm, showMessage, toast } from "./Dialogs";

export interface EditorHandle {
  togglePlay: () => void;
  split: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  openExport: () => void;
  addText: (preset?: string) => void;
}

interface EditorViewProps {
  project: Project;
  title: string;
  visible: boolean;
  urls: Map<string, string>;
  thumbnails: Record<string, string>;
  waveforms: Record<string, number[]>;
  missing: Set<string>;
  onChange: (project: Project, key?: string) => void;
  onImport: () => void;
  onImportFiles: (files: File[]) => void;
  onRemoveMedia: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
}

const TEXT_PRESETS: { id: string; name: string; sample: string; patch: Partial<TextClip> }[] = [
  { id: "title", name: "Título", sample: "Título grande", patch: { text: "Tu título aquí", size: 120, y: 0.5, animation: "pop" } },
  {
    id: "subtitle",
    name: "Subtítulo",
    sample: "Subtítulo con fondo",
    patch: { text: "Escribe aquí el subtítulo", size: 52, bold: false, y: 0.86, background: "rgba(0,0,0,0.6)", outline: false, animation: "fade" },
  },
  {
    id: "lower",
    name: "Tercio inferior",
    sample: "Nombre · cargo",
    patch: { text: "Nombre Apellido\nCargo o descripción", size: 54, align: "left", x: 0.24, y: 0.8, background: "#26a680", outline: false, animation: "slide" },
  },
  { id: "typewriter", name: "Máquina de escribir", sample: "Letra a letra…", patch: { text: "Había una vez…", size: 84, animation: "typewriter", outline: true } },
  { id: "end", name: "Créditos finales", sample: "Gracias por ver", patch: { text: "¡Gracias por ver!\nSuscríbete", size: 96, animation: "fade", fadeIn: 0.8, fadeOut: 0.8 } },
];

const QUALITIES = [
  { id: "high", label: "Alta", factor: 1.0 },
  { id: "medium", label: "Media", factor: 0.55 },
  { id: "low", label: "Ligera", factor: 0.3 },
];

const bitrateFor = (width: number, height: number, fps: number, factor: number) =>
  Math.round(((width * height * fps) / (1920 * 1080 * 30)) * 12_000_000 * factor);

export const EditorView = forwardRef<EditorHandle, EditorViewProps>(function EditorView(
  { project, title, visible, urls, thumbnails, waveforms, missing, onChange, onImport, onImportFiles, onRemoveMedia, onBusyChange },
  ref
) {
  const engineRef = useRef<TimelineEngine | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pxPerSec, setPxPerSec] = useState(40);
  const [libraryTab, setLibraryTab] = useState<"media" | "text">("media");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm">(canRecordMp4() ? "mp4" : "webm");
  const [exportQuality, setExportQuality] = useState("high");
  const [exporting, setExporting] = useState<{ progress: number; signal: { cancelled: boolean } } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ w: 640, h: 360 });

  const mediaMap = useMemo(() => new Map(project.media.map((m) => [m.id, m])), [project.media]);
  const selected = project.clips.find((c) => c.id === selectedId) || null;
  const duration = project.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
  const fps = project.settings.fps;

  // ---- Motor -----------------------------------------------------------------
  useEffect(() => {
    const engine = new TimelineEngine();
    engineRef.current = engine;
    engine.onTime = setTime;
    engine.onState = setPlaying;
    engine.canvas.className = "w-full h-full block shadow-2xl";
    previewRef.current?.appendChild(engine.canvas);
    return () => {
      engine.canvas.remove();
      engine.dispose();
    };
  }, []);

  // La vista previa ocupa el mayor tamaño posible con la proporción del proyecto
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ratio = project.settings.width / project.settings.height;
    const update = () => {
      const w = Math.max(80, stage.clientWidth - 32);
      const h = Math.max(45, stage.clientHeight - 32);
      setFit(w / h > ratio ? { w: Math.round(h * ratio), h } : { w, h: Math.round(w / ratio) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [project.settings.width, project.settings.height]);

  useEffect(() => engineRef.current?.setUrls(urls), [urls]);
  useEffect(() => engineRef.current?.setProject(project), [project]);
  useEffect(() => {
    if (!visible) engineRef.current?.pause();
  }, [visible]);
  useEffect(() => onBusyChange(exporting !== null), [exporting, onBusyChange]);

  const seek = useCallback((t: number) => engineRef.current?.seek(t), []);

  // ---- Edición -----------------------------------------------------------------
  const commitClips = (clips: Clip[], key?: string) => onChange({ ...projectRef.current, clips }, key);

  const updateClip = (clip: Clip, key?: string) =>
    commitClips(projectRef.current.clips.map((c) => (c.id === clip.id ? clip : c)), key);

  const ensureTrack = (kind: TrackKind): { project: Project; trackId: string } => {
    const current = projectRef.current;
    // Pista principal: la última del tipo (la de más abajo)
    const existing = [...current.tracks].reverse().find((t) => t.kind === kind && !t.locked);
    if (existing) return { project: current, trackId: existing.id };
    const track = newTrack(kind, current.tracks.filter((t) => t.kind === kind).length + 1);
    const tracks = kind === "text" ? [track, ...current.tracks] : kind === "audio" ? [...current.tracks, track] : [...current.tracks];
    if (kind === "video") {
      const firstAudio = tracks.findIndex((t) => t.kind === "audio");
      tracks.splice(firstAudio < 0 ? tracks.length : firstAudio, 0, track);
    }
    return { project: { ...current, tracks }, trackId: track.id };
  };

  const addMediaClip = (mediaId: string, trackId?: string, at?: number) => {
    const media = projectRef.current.media.find((m) => m.id === mediaId);
    if (!media) return;
    if (missing.has(mediaId)) {
      toast("Ese archivo ya no está disponible", "error");
      return;
    }
    const kind: TrackKind = media.kind === "audio" ? "audio" : "video";
    let base = projectRef.current;
    let target = trackId;
    if (!target) {
      const ensured = ensureTrack(kind);
      base = ensured.project;
      target = ensured.trackId;
    }
    const length = media.kind === "image" ? IMAGE_DURATION : media.duration > 0 ? media.duration : IMAGE_DURATION;
    const trackEnd = base.clips.filter((c) => c.trackId === target).reduce((max, c) => Math.max(max, clipEnd(c)), 0);
    const start = freeSlot(base.clips, target, at ?? trackEnd, length);
    const clip: MediaClip = {
      id: newId("clip"),
      type: "media",
      trackId: target,
      mediaId,
      start,
      duration: length,
      in: 0,
      speed: 1,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      fit: "contain",
      transform: { ...DEFAULT_TRANSFORM },
      adjust: { ...DEFAULT_ADJUST },
    };
    onChange({ ...base, clips: [...base.clips, clip] });
    setSelectedId(clip.id);
  };

  const addText = (presetId = "title") => {
    const preset = TEXT_PRESETS.find((p) => p.id === presetId) || TEXT_PRESETS[0];
    const { project: base, trackId } = ensureTrack("text");
    const length = preset.patch.duration || defaultText().duration;
    const start = freeSlot(base.clips, trackId, engineRef.current?.time ?? 0, length);
    const clip: TextClip = { ...defaultText(), ...preset.patch, id: newId("clip"), trackId, start } as TextClip;
    onChange({ ...base, clips: [...base.clips, clip] });
    setSelectedId(clip.id);
  };

  const split = () => {
    const t = engineRef.current?.time ?? time;
    const current = projectRef.current;
    // El seleccionado, o todos los clips bajo el cabezal
    const targets = current.clips.filter((c) => (selectedId ? c.id === selectedId : true) && t > c.start && t < clipEnd(c));
    if (targets.length === 0) {
      toast("Coloca el cabezal sobre un clip para dividirlo", "info");
      return;
    }
    let clips = current.clips;
    let rightId: string | null = null;
    for (const clip of targets) {
      const parts = splitClip(clip, t);
      if (!parts) continue;
      clips = clips.flatMap((c) => (c.id === clip.id ? parts : [c]));
      rightId = parts[1].id;
    }
    commitClips(clips);
    if (rightId && selectedId) setSelectedId(rightId);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commitClips(projectRef.current.clips.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    const clip = projectRef.current.clips.find((c) => c.id === selectedId);
    if (!clip) return;
    const start = freeSlot(projectRef.current.clips, clip.trackId, clipEnd(clip), clip.duration);
    const copy = { ...clip, id: newId("clip"), start } as Clip;
    commitClips([...projectRef.current.clips, copy]);
    setSelectedId(copy.id);
  };

  const addTrack = (kind: TrackKind) => {
    const current = projectRef.current;
    const track = newTrack(kind, current.tracks.filter((t) => t.kind === kind).length + 1);
    const tracks = [...current.tracks];
    if (kind === "text") tracks.unshift(track);
    else if (kind === "audio") tracks.push(track);
    else tracks.splice(Math.max(0, tracks.findIndex((t) => t.kind === "video")), 0, track);
    onChange({ ...current, tracks });
  };

  const deleteTrack = async (id: string) => {
    const current = projectRef.current;
    const count = current.clips.filter((c) => c.trackId === id).length;
    if (
      count > 0 &&
      !(await askConfirm({ title: "Eliminar la pista", message: `La pista tiene ${count} clips. ¿Eliminarla igualmente?`, confirmLabel: "Eliminar", danger: true }))
    )
      return;
    onChange({ ...current, tracks: current.tracks.filter((t) => t.id !== id), clips: current.clips.filter((c) => c.trackId !== id) });
  };

  // ---- Exportar ----------------------------------------------------------------
  const runExport = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (duration <= 0) {
      void showMessage("Nada que exportar", "Añade clips a la línea de tiempo antes de exportar.");
      return;
    }
    const format = recordingFormat(exportFormat);
    if (!format) {
      void showMessage("No se puede exportar", "Este equipo no admite la grabación de video.");
      return;
    }
    const name = `${title || "Mi video"}.${format.extension}`;
    let path: string | null = null;
    if (isTauri) {
      path = await pickSavePath(name, format.extension, format.extension === "mp4" ? "Video MP4" : "Video WebM");
      if (!path) return;
    }
    setExportOpen(false);
    const signal = { cancelled: false };
    setExporting({ progress: 0, signal });
    let writer: ChunkWriter | null = null;
    try {
      writer = await ChunkWriter.open(path, format.mime);
      const w = writer;
      const factor = QUALITIES.find((q) => q.id === exportQuality)?.factor || 1;
      await engine.export({
        mime: format.mime,
        videoBitsPerSecond: bitrateFor(project.settings.width, project.settings.height, fps, factor),
        onChunk: (blob) => w.append(blob),
        onProgress: (p) => setExporting((prev) => (prev ? { ...prev, progress: p } : prev)),
        signal,
      });
      const result = await writer.close(signal.cancelled);
      if (signal.cancelled) {
        toast("Exportación cancelada", "info");
      } else if (result.blob) {
        downloadBlob(result.blob, name);
        toast("Video exportado");
      } else {
        toast(`Video guardado: ${result.path}`);
      }
    } catch (err) {
      await writer?.close(true).catch(() => undefined);
      void showMessage("No se pudo exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };

  useImperativeHandle(ref, () => ({
    togglePlay: () => engineRef.current?.toggle(),
    split,
    deleteSelected,
    duplicateSelected,
    openExport: () => setExportOpen(true),
    addText,
  }));

  // ---- Teclado -------------------------------------------------------------------
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!visible || exporting) return;
    const target = e.target as HTMLElement;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
    if (document.querySelector("[data-modal-open]")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const engine = engineRef.current;
    if (!engine) return;
    if (e.code === "Space") {
      e.preventDefault();
      engine.toggle();
    } else if (!ctrl && e.key.toLowerCase() === "s") {
      e.preventDefault();
      split();
    } else if (ctrl && e.key.toLowerCase() === "b") {
      e.preventDefault();
      split();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedId) {
        e.preventDefault();
        deleteSelected();
      }
    } else if (ctrl && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateSelected();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const delta = (e.shiftKey ? 1 : 1 / fps) * (e.key === "ArrowLeft" ? -1 : 1);
      engine.pause();
      engine.seek(engine.time + delta);
    } else if (e.key === "Home") {
      engine.seek(0);
    } else if (e.key === "End") {
      engine.seek(duration);
    } else if (e.key === "Escape") {
      setSelectedId(null);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---- Mover el clip seleccionado sobre la vista previa -------------------------
  const moveRef = useRef<{ startX: number; startY: number; orig: Clip; w: number; h: number } | null>(null);
  const handlePreviewDown = (e: React.PointerEvent) => {
    const canvas = engineRef.current?.canvas;
    if (!canvas || e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const t = engineRef.current?.time ?? 0;
    const W = project.settings.width;
    const H = project.settings.height;
    // Se elige el clip visible bajo el puntero (los textos primero)
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    const ctx = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
    const visibleTracks = project.tracks.filter((tr) => tr.kind !== "audio" && !tr.hidden);
    let hit: Clip | null = null;
    for (const track of visibleTracks) {
      const clip = project.clips.find((c) => c.trackId === track.id && t >= c.start && t < clipEnd(c));
      if (!clip) continue;
      if (clip.type === "text") {
        const b = drawText(ctx, clip, t, W, H);
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
          hit = clip;
          break;
        }
      } else {
        hit = clip;
        break;
      }
    }
    if (!hit) {
      setSelectedId(null);
      return;
    }
    setSelectedId(hit.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moveRef.current = { startX: e.clientX, startY: e.clientY, orig: hit, w: rect.width, h: rect.height };
  };
  const handlePreviewMove = (e: React.PointerEvent) => {
    const drag = moveRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / drag.w;
    const dy = (e.clientY - drag.startY) / drag.h;
    if (Math.abs(dx) + Math.abs(dy) < 0.002) return;
    if (drag.orig.type === "text") {
      updateClip({ ...drag.orig, x: Math.min(1, Math.max(0, drag.orig.x + dx)), y: Math.min(1, Math.max(0, drag.orig.y + dy)) }, `pos-${drag.orig.id}`);
    } else {
      const o = drag.orig as MediaClip;
      updateClip({ ...o, transform: { ...o.transform, x: o.transform.x + dx, y: o.transform.y + dy } }, `pos-${o.id}`);
    }
  };

  // ---- Interfaz -------------------------------------------------------------------
  const kindIcon = { video: Film, audio: Music, image: ImageIcon };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0f1513] text-[#e8f3ef]" style={{ display: visible ? "flex" : "none" }}>
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Biblioteca */}
        <aside
          className={`w-72 shrink-0 border-r border-[#26322e] flex flex-col bg-[#131a18] ${dropActive ? "ring-2 ring-inset ring-[#4fd1a5]" : ""}`}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes("Files")) {
              e.preventDefault();
              setDropActive(true);
            }
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            setDropActive(false);
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            onImportFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="flex border-b border-[#26322e]">
            {(
              [
                ["media", "Medios", Film],
                ["text", "Textos", Type],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLibraryTab(id)}
                className={`flex-1 h-10 text-[12px] font-semibold flex items-center justify-center gap-1.5 border-b-2 ${
                  libraryTab === id ? "border-[#4fd1a5] text-white" : "border-transparent text-[#8fb5a8] hover:text-white"
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {libraryTab === "media" ? (
            <div className="flex-1 overflow-y-auto p-3">
              <button
                type="button"
                onClick={onImport}
                className="w-full h-20 rounded-xl border-2 border-dashed border-[#36504a] hover:border-[#4fd1a5] text-[#9fd8c4] flex flex-col items-center justify-center gap-1 text-[12px]"
              >
                <Upload size={18} />
                <span className="font-semibold">Importar video, audio o imagen</span>
                <span className="text-[10px] text-[#6f8f84]">o arrastra los archivos aquí</span>
              </button>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {project.media.map((item: MediaItem) => {
                  const Icon = kindIcon[item.kind];
                  const thumb = thumbnails[item.id];
                  const gone = missing.has(item.id);
                  return (
                    <div
                      key={item.id}
                      data-media={item.id}
                      draggable={!gone}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(MEDIA_DRAG_TYPE, item.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDoubleClick={() => addMediaClip(item.id)}
                      className="group relative rounded-lg overflow-hidden bg-[#1b2522] border border-[#26322e] hover:border-[#4fd1a5] cursor-grab"
                      title={`${item.name}\nDoble clic o «+» para añadirlo; también puedes arrastrarlo a una pista`}
                    >
                      <div className="aspect-video bg-[#0c1110] flex items-center justify-center">
                        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} /> : <Icon size={22} className="text-[#4f6b62]" />}
                      </div>
                      <div className="px-1.5 py-1">
                        <div className="text-[11px] truncate">{item.name}</div>
                        <div className="text-[10px] text-[#7d9a90] flex items-center gap-1">
                          <Icon size={10} />
                          {item.kind === "image" ? "Imagen" : formatTime(item.duration)}
                        </div>
                      </div>
                      {gone && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-[10px] text-[#ffca28] gap-1 p-1 text-center">
                          <AlertTriangle size={14} /> Archivo no encontrado
                        </div>
                      )}
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100">
                        {!gone && (
                          <button
                            type="button"
                            title="Añadir a la línea de tiempo"
                            onClick={() => addMediaClip(item.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[#0d1f19]"
                            style={{ background: "#4fd1a5" }}
                          >
                            <Plus size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Quitar de la biblioteca"
                          onClick={() => onRemoveMedia(item.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-black/70 text-white hover:text-red-300"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {project.media.length === 0 && (
                <p className="text-[11px] text-[#6f8f84] mt-4 leading-relaxed">
                  Tus grabaciones del Estudio también aparecen aquí automáticamente.
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => addText(preset.id)}
                  className="h-16 rounded-xl bg-[#1b2522] border border-[#26322e] hover:border-[#4fd1a5] flex items-center gap-3 px-3 text-left"
                >
                  <div className="w-16 h-10 rounded-md bg-black flex items-center justify-center text-[10px] font-bold text-white px-1 text-center leading-tight">
                    {preset.sample}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold">{preset.name}</div>
                    <div className="text-[10px] text-[#7d9a90]">Se añade en el cabezal</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Vista previa */}
        <section className="flex-1 flex flex-col min-w-0">
          <div ref={stageRef} className="flex-1 min-h-0 flex items-center justify-center bg-[#0b100e] overflow-hidden">
            <div
              ref={previewRef}
              data-preview
              className="relative cursor-move"
              style={{ width: fit.w, height: fit.h }}
              onPointerDown={handlePreviewDown}
              onPointerMove={handlePreviewMove}
              onPointerUp={() => (moveRef.current = null)}
            />
          </div>
          <div className="h-12 shrink-0 border-t border-[#26322e] flex items-center gap-2 px-3 bg-[#131a18]">
            <button type="button" title="Ir al inicio (Inicio)" onClick={() => seek(0)} className="p-1.5 rounded hover:bg-[#22302b]">
              <SkipBack size={16} />
            </button>
            <button type="button" title="Fotograma anterior (←)" onClick={() => seek(time - 1 / fps)} className="p-1.5 rounded hover:bg-[#22302b]">
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              title="Reproducir o pausar (Espacio)"
              onClick={() => engineRef.current?.toggle()}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#0d1f19]"
              style={{ background: "#4fd1a5" }}
            >
              {playing ? <Pause size={17} className="fill-current" /> : <Play size={17} className="fill-current ml-0.5" />}
            </button>
            <button type="button" title="Fotograma siguiente (→)" onClick={() => seek(time + 1 / fps)} className="p-1.5 rounded hover:bg-[#22302b]">
              <ChevronRight size={16} />
            </button>
            <span className="font-mono text-[12px] ml-1" data-timecode>
              {formatTime(time, true, fps)} <span className="text-[#6f8f84]">/ {formatTime(duration, true, fps)}</span>
            </span>
            <div className="flex-1" />
            <button type="button" title="Dividir en el cabezal (S)" onClick={split} className="h-8 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 hover:bg-[#22302b]">
              <Scissors size={14} /> Dividir
            </button>
            <button type="button" title="Duplicar (Ctrl+D)" onClick={duplicateSelected} disabled={!selected} className="h-8 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 hover:bg-[#22302b] disabled:opacity-40">
              <Copy size={14} />
            </button>
            <button type="button" title="Eliminar (Supr)" onClick={deleteSelected} disabled={!selected} className="h-8 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 hover:bg-[#22302b] disabled:opacity-40">
              <Trash2 size={14} />
            </button>
            <div className="w-px h-6 bg-[#26322e] mx-1" />
            <button type="button" title="Alejar la línea de tiempo" onClick={() => setPxPerSec((p) => Math.max(4, p / 1.4))} className="p-1.5 rounded hover:bg-[#22302b]">
              <ZoomOut size={15} />
            </button>
            <input
              type="range"
              min={4}
              max={400}
              value={pxPerSec}
              onChange={(e) => setPxPerSec(Number(e.target.value))}
              className="w-24 accent-[#4fd1a5]"
              title="Zoom de la línea de tiempo (Ctrl + rueda)"
            />
            <button type="button" title="Acercar la línea de tiempo" onClick={() => setPxPerSec((p) => Math.min(400, p * 1.4))} className="p-1.5 rounded hover:bg-[#22302b]">
              <ZoomIn size={15} />
            </button>
          </div>
        </section>

        {/* Propiedades */}
        <aside className="w-72 shrink-0 border-l border-[#26322e] overflow-y-auto bg-[#131a18]">
          <Inspector
            clip={selected}
            media={selected?.type === "media" ? mediaMap.get(selected.mediaId) : undefined}
            settings={project.settings}
            onClip={(clip, key) => {
              const before = projectRef.current.clips.find((c) => c.id === clip.id);
              // Al cambiar la velocidad, los clips siguientes de la pista se desplazan
              if (before && key?.startsWith("speed-") && Math.abs(before.duration - clip.duration) > 1e-6) {
                const delta = clip.duration - before.duration;
                const oldEnd = clipEnd(before);
                commitClips(
                  projectRef.current.clips.map((c) =>
                    c.id === clip.id ? clip : c.trackId === clip.trackId && c.start >= oldEnd - 1e-6 ? ({ ...c, start: Math.max(0, c.start + delta) } as Clip) : c
                  ),
                  key
                );
                return;
              }
              updateClip(clip, key);
            }}
            onSettings={(settings) => onChange({ ...projectRef.current, settings }, "settings")}
            onDelete={deleteSelected}
            onDuplicate={duplicateSelected}
            onSplit={split}
          />
        </aside>
      </div>

      <div className="h-[260px] shrink-0 border-t border-[#26322e]">
        <Timeline
          project={project}
          time={time}
          pxPerSec={pxPerSec}
          selectedId={selectedId}
          thumbnails={thumbnails}
          waveforms={waveforms}
          onSeek={seek}
          onSelect={setSelectedId}
          onChange={onChange}
          onDropMedia={(mediaId, trackId, start) => {
            const media = mediaMap.get(mediaId);
            const track = project.tracks.find((t) => t.id === trackId);
            if (!media || !track) return;
            const wants: TrackKind = media.kind === "audio" ? "audio" : "video";
            addMediaClip(mediaId, track.kind === wants ? trackId : undefined, start);
          }}
          onZoom={setPxPerSec}
          onAddTrack={addTrack}
          onDeleteTrack={(id) => void deleteTrack(id)}
        />
      </div>

      {/* Exportar */}
      {exportOpen && (
        <div data-modal-open className="fixed inset-0 z-[99990] bg-black/60 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setExportOpen(false)}>
          <div className="w-[440px] bg-white rounded-2xl shadow-2xl text-[#1f2b27] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e6efeb]">
              <h2 className="text-[15px] font-semibold">Exportar video</h2>
              <button type="button" onClick={() => setExportOpen(false)} className="p-1.5 rounded-lg hover:bg-[#eef5f2]">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4 text-[13px]">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-lg bg-[#f2f8f6] px-3 py-2">
                  <div className="text-[#5f7a71]">Resolución</div>
                  <div className="font-semibold">
                    {project.settings.width} × {project.settings.height} · {fps} fps
                  </div>
                </div>
                <div className="rounded-lg bg-[#f2f8f6] px-3 py-2">
                  <div className="text-[#5f7a71]">Duración</div>
                  <div className="font-semibold">{formatTime(duration)}</div>
                </div>
              </div>
              <div>
                <span className="text-[12px] font-semibold text-[#3d5550]">Formato</span>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {(["mp4", "webm"] as const).map((f) => {
                    const disabled = f === "mp4" && !canRecordMp4();
                    return (
                      <button
                        key={f}
                        type="button"
                        disabled={disabled}
                        onClick={() => setExportFormat(f)}
                        className={`h-10 rounded-lg border text-[12px] font-semibold disabled:opacity-40 ${
                          exportFormat === f ? "border-[#26a680] bg-[#e3f6ef]" : "border-[#d5e4de] hover:bg-[#f2f8f6]"
                        }`}
                      >
                        {f === "mp4" ? "MP4 (recomendado)" : "WebM"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className="text-[12px] font-semibold text-[#3d5550]">Calidad</span>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {QUALITIES.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setExportQuality(q.id)}
                      className={`h-10 rounded-lg border text-[12px] ${exportQuality === q.id ? "border-[#26a680] bg-[#e3f6ef] font-semibold" : "border-[#d5e4de] hover:bg-[#f2f8f6]"}`}
                    >
                      {q.label}
                      <span className="block text-[10px] text-[#5f7a71] font-normal">
                        {(bitrateFor(project.settings.width, project.settings.height, fps, q.factor) / 1e6).toFixed(1)} Mbps
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#5f7a71]">
                El video se genera reproduciendo el proyecto, así que tarda lo mismo que dura. No minimices la ventana mientras tanto.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[#e6efeb] bg-[#fafcfb]">
              <button type="button" onClick={() => setExportOpen(false)} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[#eef5f2]">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void runExport()}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-2"
                style={{ background: ACCENT }}
              >
                <Download size={15} /> Exportar
              </button>
            </div>
          </div>
        </div>
      )}

      {exporting && (
        <div data-modal-open className="fixed inset-0 z-[99995] bg-black/70 flex items-center justify-center">
          <div className="w-[380px] bg-white rounded-2xl shadow-2xl text-[#1f2b27] px-6 py-5">
            <div className="flex items-center gap-2.5 font-semibold text-[14px]">
              <Loader2 size={17} className="animate-spin text-[#26a680]" /> Exportando el video…
            </div>
            <div className="mt-4 h-2 rounded-full bg-[#e3efea] overflow-hidden">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(exporting.progress * 100)}%`, background: ACCENT }} />
            </div>
            <div className="mt-2 flex justify-between text-[12px] text-[#5f7a71]">
              <span data-export-progress>{Math.round(exporting.progress * 100)} %</span>
              <span>
                {formatTime(exporting.progress * duration)} / {formatTime(duration)}
              </span>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  exporting.signal.cancelled = true;
                }}
                className="h-8 px-3 rounded-lg text-[12px] border border-[#d5e4de] hover:bg-[#f2f8f6]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
