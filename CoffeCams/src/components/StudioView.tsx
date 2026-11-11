// Estudio: escenas con fuentes (pantalla, cámara, imagen, texto, color),
// mezclador de audio, grabación a archivo y transmisión en directo.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Monitor,
  Camera,
  Image as ImageIcon,
  Type,
  Square,
  Plus,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Trash2,
  Circle,
  Pause,
  Play,
  Radio,
  Settings2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize,
  CornerDownRight,
  Loader2,
  FolderOpen,
  Clapperboard,
} from "lucide-react";
import type { Project, Scene, SourceKind, StudioSource } from "../types";
import { ACCENT } from "../types";
import { newId } from "../services/project";
import { DESIGN_H, DESIGN_W, StudioEngine, type ChannelId } from "../services/studio";
import { holdAwake, recordingFormat, streamingMime } from "../services/media";
import {
  ChunkWriter,
  listDevices,
  newVideoPath,
  onStreamEvents,
  openFolder,
  stamp,
  streamStart,
  streamStop,
  streamWrite,
  videosDir,
} from "../services/store";
import { isTauri, pickOpenFile, bytesToBase64, extensionOf } from "../services/desktop";
import { askText, showMessage, toast } from "./Dialogs";
import { StreamDialog } from "./StreamDialog";

interface StudioViewProps {
  project: Project;
  visible: boolean;
  onChange: (project: Project, key?: string) => void;
  /** Grabación terminada: ruta en disco (escritorio) o Blob (navegador). */
  onRecorded: (result: { path: string | null; blob: Blob | null; name: string }) => void;
  onBusyChange: (busy: boolean) => void;
}

const SOURCE_META: Record<SourceKind, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  screen: { label: "Captura de pantalla", icon: Monitor },
  camera: { label: "Cámara", icon: Camera },
  image: { label: "Imagen", icon: ImageIcon },
  text: { label: "Texto", icon: Type },
  color: { label: "Color", icon: Square },
};

const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const fmtSize = (bytes: number) =>
  bytes > 1 << 30 ? `${(bytes / (1 << 30)).toFixed(2)} GB` : `${(bytes / (1 << 20)).toFixed(1)} MB`;

const Meter: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-1.5 w-full rounded-full bg-[#2b3633] overflow-hidden">
    <div
      className="h-full rounded-full transition-[width] duration-75"
      style={{
        width: `${Math.round(value * 100)}%`,
        background: value > 0.9 ? "#ef5350" : value > 0.75 ? "#ffca28" : "#4fd1a5",
      }}
    />
  </div>
);

export const StudioView: React.FC<StudioViewProps> = ({ project, visible, onChange, onRecorded, onBusyChange }) => {
  const engineRef = useRef<StudioEngine | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const [sceneId, setSceneId] = useState(project.scenes[0]?.id || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | null>(null);
  const [mixer, setMixer] = useState<Record<ChannelId, { volume: number; muted: boolean }>>({
    mic: { volume: 1, muted: false },
    system: { volume: 1, muted: false },
  });
  const [levels, setLevels] = useState<Record<ChannelId, number>>({ mic: 0, system: 0 });
  const [hasSystemAudio, setHasSystemAudio] = useState(false);

  // Grabación
  const recorderRef = useRef<MediaRecorder | null>(null);
  const writerRef = useRef<ChunkWriter | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const [recording, setRecording] = useState<"idle" | "recording" | "paused" | "saving">("idle");
  const [recStart, setRecStart] = useState(0);
  const [recPausedMs, setRecPausedMs] = useState(0);
  const pauseStartRef = useRef(0);
  const [recBytes, setRecBytes] = useState(0);

  // Transmisión
  const streamRecRef = useRef<MediaRecorder | null>(null);
  const streamQueue = useRef<Promise<void>>(Promise.resolve());
  const [streaming, setStreaming] = useState<"idle" | "starting" | "live" | "stopping">("idle");
  const [streamStartAt, setStreamStartAt] = useState(0);
  const [streamInfo, setStreamInfo] = useState("");
  const [streamDialog, setStreamDialog] = useState(false);
  const streamKeyRef = useRef("");

  const [now, setNow] = useState(Date.now());
  const scene: Scene | undefined = project.scenes.find((s) => s.id === sceneId) || project.scenes[0];
  const selected = scene?.sources.find((s) => s.id === selectedId) || null;
  const live = recording !== "idle" || streaming !== "idle";

  // ---- Motor ---------------------------------------------------------------
  useEffect(() => {
    const engine = new StudioEngine();
    engineRef.current = engine;
    engine.onSourceEnded = (id) => {
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setHasSystemAudio(engine.hasChannel("system"));
    };
    engine.canvas.className = "w-full h-full block";
    previewRef.current?.appendChild(engine.canvas);
    return () => {
      engine.canvas.remove();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !scene) return;
    engine.setScene(scene);
  }, [scene]);

  useEffect(() => {
    engineRef.current?.setHeight(project.stream.height);
  }, [project.stream.height]);

  // El lienzo solo se compone mientras se ve el estudio o hay algo en curso
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (visible || live) engine.start(project.stream.fps);
    else engine.pause();
  }, [visible, live, project.stream.fps]);

  // Vúmetros y relojes
  useEffect(() => {
    if (!visible && !live) return;
    const id = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      setLevels({ mic: engine.level("mic"), system: engine.level("system") });
      setNow(Date.now());
    }, 100);
    return () => window.clearInterval(id);
  }, [visible, live]);

  useEffect(() => {
    void listDevices().then(({ cameras: c, mics: m }) => {
      setCameras(c);
      setMics(m);
    });
  }, []);

  useEffect(() => onBusyChange(live), [live, onBusyChange]);

  // ---- Escenas y fuentes ---------------------------------------------------
  const updateScene = useCallback(
    (fn: (scene: Scene) => Scene, key?: string) => {
      const current = projectRef.current;
      const target = current.scenes.find((s) => s.id === sceneId) || current.scenes[0];
      onChange({ ...current, scenes: current.scenes.map((s) => (s.id === target.id ? fn(s) : s)) }, key);
    },
    [onChange, sceneId]
  );

  const updateSource = useCallback(
    (id: string, patch: Partial<StudioSource>, key?: string) =>
      updateScene((s) => ({ ...s, sources: s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)) }), key),
    [updateScene]
  );

  const addScene = async () => {
    const name = await askText({ title: "Nueva escena", label: "Nombre", defaultValue: `Escena ${project.scenes.length + 1}` });
    if (!name?.trim()) return;
    const created: Scene = { id: newId("scn"), name: name.trim(), sources: [] };
    onChange({ ...projectRef.current, scenes: [...projectRef.current.scenes, created] });
    setSceneId(created.id);
  };

  const renameScene = async (id: string) => {
    const target = project.scenes.find((s) => s.id === id);
    if (!target) return;
    const name = await askText({ title: "Cambiar el nombre de la escena", label: "Nombre", defaultValue: target.name });
    if (!name?.trim()) return;
    onChange({ ...projectRef.current, scenes: projectRef.current.scenes.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)) });
  };

  const deleteScene = (id: string) => {
    if (project.scenes.length <= 1) return;
    const remaining = project.scenes.filter((s) => s.id !== id);
    onChange({ ...projectRef.current, scenes: remaining });
    if (id === scene?.id) setSceneId(remaining[0].id);
  };

  const addSource = async (kind: SourceKind) => {
    let source: StudioSource = {
      id: newId("src"),
      kind,
      name: SOURCE_META[kind].label,
      visible: true,
      x: 0,
      y: 0,
      w: DESIGN_W,
      h: DESIGN_H,
    };
    if (kind === "camera") source = { ...source, x: 1420, y: 730, w: 460, h: 310, deviceId: cameras[0]?.deviceId };
    if (kind === "text") source = { ...source, x: 160, y: 860, w: 1600, h: 160, text: "¡Bienvenidos al directo!", color: "#ffffff", size: 72, name: "Texto" };
    if (kind === "color") source = { ...source, color: "#1d2b28", name: "Fondo de color" };
    if (kind === "image") {
      const picked = await pickOpenFile([{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }], "Elegir imagen");
      if (!picked) return;
      const ext = extensionOf(picked.name);
      const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
      const src = `data:${mime};base64,${bytesToBase64(picked.bytes)}`;
      const img = new Image();
      img.src = src;
      await new Promise((r) => {
        img.onload = r;
        img.onerror = r;
      });
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 16 / 9;
      const w = Math.min(DESIGN_W * 0.4, img.naturalWidth || 640);
      source = { ...source, name: picked.name, src, x: 60, y: 60, w: Math.round(w), h: Math.round(w / ratio) };
    }
    updateScene((s) => ({ ...s, sources: [source, ...s.sources] }));
    setSelectedId(source.id);
    if (kind === "screen" || kind === "camera") void activate(source);
  };

  const removeSource = (id: string) => {
    engineRef.current?.deactivate(id);
    setActiveIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    updateScene((s) => ({ ...s, sources: s.sources.filter((src) => src.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const moveSource = (id: string, delta: number) =>
    updateScene((s) => {
      const index = s.sources.findIndex((src) => src.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= s.sources.length) return s;
      const sources = [...s.sources];
      [sources[index], sources[target]] = [sources[target], sources[index]];
      return { ...s, sources };
    });

  const activate = async (source: StudioSource) => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      await engine.activate(source);
      setActiveIds((prev) => new Set(prev).add(source.id));
      setHasSystemAudio(engine.hasChannel("system"));
      engine.setVolume("system", mixer.system.volume, mixer.system.muted);
      // Con permiso de cámara ya aparecen los nombres de los dispositivos
      const devices = await listDevices();
      setCameras(devices.cameras);
      setMics(devices.mics);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        toast(source.kind === "screen" ? "Captura de pantalla cancelada" : "No se dio permiso para usar la cámara", "info");
      } else {
        void showMessage("No se pudo iniciar la captura", err instanceof Error ? err.message : String(err));
      }
    }
  };

  const deactivate = (id: string) => {
    engineRef.current?.deactivate(id);
    setActiveIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setHasSystemAudio(Boolean(engineRef.current?.hasChannel("system")));
  };

  const fitSource = async (source: StudioSource, mode: "full" | "corner") => {
    if (mode === "full") {
      updateSource(source.id, { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H });
      return;
    }
    const size = engineRef.current?.sourceSize(source.id);
    const ratio = size ? size.width / size.height : 16 / 9;
    const w = 460;
    const h = Math.round(w / ratio);
    updateSource(source.id, { w, h, x: DESIGN_W - w - 40, y: DESIGN_H - h - 40 });
  };

  // ---- Arrastrar fuentes sobre la vista previa -----------------------------
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: StudioSource } | null>(null);

  const toDesign = (clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * DESIGN_W, y: ((clientY - rect.top) / rect.height) * DESIGN_H };
  };

  const handlePreviewDown = (e: React.PointerEvent) => {
    if (!scene || e.button !== 0) return;
    const p = toDesign(e.clientX, e.clientY);
    const hit = scene.sources.find((s) => s.visible && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    setSelectedId(hit?.id || null);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: hit.id, mode: "move", startX: p.x, startY: p.y, orig: hit };
  };

  const handlePreviewMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toDesign(e.clientX, e.clientY);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (drag.mode === "move") {
      updateSource(drag.id, { x: Math.round(drag.orig.x + dx), y: Math.round(drag.orig.y + dy) }, `move-${drag.id}`);
    } else {
      const ratio = drag.orig.w / drag.orig.h;
      const w = Math.max(40, Math.round(drag.orig.w + dx));
      const h = e.shiftKey ? Math.max(40, Math.round(drag.orig.h + dy)) : Math.round(w / ratio);
      updateSource(drag.id, { w, h }, `resize-${drag.id}`);
    }
  };

  // ---- Audio -----------------------------------------------------------------
  const setChannel = (id: ChannelId, patch: Partial<{ volume: number; muted: boolean }>) => {
    setMixer((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      engineRef.current?.setVolume(id, next[id].volume, next[id].muted);
      return next;
    });
  };

  const chooseMic = async (deviceId: string | null) => {
    try {
      await engineRef.current?.setMic(deviceId);
      setMicId(deviceId);
      engineRef.current?.setVolume("mic", mixer.mic.volume, mixer.mic.muted);
      const devices = await listDevices();
      setMics(devices.mics);
      setCameras(devices.cameras);
    } catch (err) {
      void showMessage("No se pudo usar el micrófono", err instanceof Error ? err.message : String(err));
    }
  };

  // ---- Grabación -------------------------------------------------------------
  const startRecording = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const format = recordingFormat("mp4");
    if (!format) {
      void showMessage("No se puede grabar", "Este equipo no admite la grabación de video.");
      return;
    }
    try {
      const name = `Grabación ${stamp()}.${format.extension}`;
      const path = await newVideoPath(name);
      const writer = await ChunkWriter.open(path, format.mime);
      const height = project.stream.height;
      const recorder = new MediaRecorder(engine.outputStream(), {
        mimeType: format.mime,
        videoBitsPerSecond: height === 1080 ? 10_000_000 : 6_000_000,
        audioBitsPerSecond: 192_000,
      });
      recorder.ondataavailable = (e) => {
        writer.append(e.data);
        setRecBytes(writer.bytes);
      };
      recorder.onstop = async () => {
        setRecording("saving");
        try {
          const result = await writer.close();
          onRecorded({ ...result, name });
          toast(isTauri ? `Grabación guardada en Videos\\CoffeWorks` : "Grabación añadida a los medios");
        } catch (err) {
          void showMessage("No se pudo guardar la grabación", err instanceof Error ? err.message : String(err));
        } finally {
          releaseRef.current?.();
          releaseRef.current = null;
          setRecording("idle");
        }
      };
      writerRef.current = writer;
      recorderRef.current = recorder;
      releaseRef.current = holdAwake();
      recorder.start(1000);
      setRecStart(Date.now());
      setRecPausedMs(0);
      setRecBytes(0);
      setRecording("recording");
    } catch (err) {
      void showMessage("No se pudo iniciar la grabación", err instanceof Error ? err.message : String(err));
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
  };

  const togglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      pauseStartRef.current = Date.now();
      setRecording("paused");
    } else if (recorder.state === "paused") {
      recorder.resume();
      setRecPausedMs((ms) => ms + Date.now() - pauseStartRef.current);
      setRecording("recording");
    }
  };

  // ---- Transmisión -----------------------------------------------------------
  useEffect(
    () =>
      onStreamEvents(
        (line) => {
          const bitrate = /bitrate=\s*([\d.]+\w*bits\/s)/.exec(line)?.[1];
          const speed = /speed=\s*([\d.]+x)/.exec(line)?.[1];
          if (bitrate) setStreamInfo(`${bitrate}${speed ? ` · ${speed}` : ""}`);
        },
        (ok, message) => {
          const recorder = streamRecRef.current;
          if (recorder && recorder.state !== "inactive") recorder.stop();
          streamRecRef.current = null;
          setStreaming("idle");
          setStreamInfo("");
          if (!ok) void showMessage("La transmisión se detuvo", message);
          else toast("Transmisión finalizada");
        }
      ),
    []
  );

  const startStreaming = async (key: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    streamKeyRef.current = key;
    setStreamDialog(false);
    setStreaming("starting");
    try {
      const s = project.stream;
      await streamStart({ server: s.server, key, fps: s.fps, videoKbps: s.videoKbps, audioKbps: s.audioKbps });
      const recorder = new MediaRecorder(engine.outputStream(), {
        mimeType: streamingMime(),
        // Se envía con calidad de sobra: ffmpeg recodifica a la tasa elegida
        videoBitsPerSecond: Math.max(6_000_000, s.videoKbps * 2000),
        audioBitsPerSecond: 192_000,
      });
      streamQueue.current = Promise.resolve();
      recorder.ondataavailable = (e) => {
        const blob = e.data;
        if (!blob.size) return;
        streamQueue.current = streamQueue.current.then(async () => {
          try {
            await streamWrite(new Uint8Array(await blob.arrayBuffer()));
          } catch {
            // ffmpeg terminó: el aviso llega por el evento de fin
          }
        });
      };
      streamRecRef.current = recorder;
      if (!releaseRef.current) releaseRef.current = holdAwake();
      recorder.start(250);
      setStreamStartAt(Date.now());
      setStreaming("live");
    } catch (err) {
      setStreaming("idle");
      void showMessage("No se pudo iniciar la transmisión", err instanceof Error ? err.message : String(err));
    }
  };

  const stopStreaming = async () => {
    setStreaming("stopping");
    const recorder = streamRecRef.current;
    if (recorder && recorder.state !== "inactive") {
      const done = new Promise((r) => (recorder.onstop = r));
      recorder.stop();
      await done;
    }
    streamRecRef.current = null;
    await streamQueue.current;
    await streamStop().catch(() => undefined);
    if (recording === "idle") {
      releaseRef.current?.();
      releaseRef.current = null;
    }
  };

  // Al salir de la aplicación no se deja nada abierto
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      if (streamRecRef.current) void streamStop().catch(() => undefined);
    },
    []
  );

  if (!scene) return null;

  const recElapsed = recording === "idle" ? 0 : (recording === "paused" ? pauseStartRef.current : now) - recStart - recPausedMs;
  const field = "w-full h-8 px-2 text-[12px] rounded-md bg-[#1b2422] border border-[#33413d] text-[#e8f3ef] outline-none focus:border-[#4fd1a5]";
  const smallBtn = "h-7 px-2 rounded-md text-[11px] font-semibold flex items-center gap-1.5 bg-[#26332f] hover:bg-[#30403b] text-[#d7ebe4] disabled:opacity-40";

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#121816] text-[#e8f3ef]" style={{ display: visible ? "flex" : "none" }}>
      <div className="flex-1 flex overflow-hidden">
        {/* Escenas y fuentes */}
        <aside className="w-64 shrink-0 border-r border-[#26322e] flex flex-col">
          <div className="px-3 h-9 flex items-center justify-between border-b border-[#26322e]">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8fb5a8]">Escenas</span>
            <button type="button" title="Nueva escena" onClick={() => void addScene()} className="p-1 rounded hover:bg-[#22302b]">
              <Plus size={15} />
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            {project.scenes.map((s) => (
              <div
                key={s.id}
                onClick={() => setSceneId(s.id)}
                onDoubleClick={() => void renameScene(s.id)}
                className={`group mx-1.5 my-0.5 px-2.5 py-1.5 rounded-md text-[13px] flex items-center gap-2 cursor-pointer ${
                  s.id === scene.id ? "bg-[#22403a] text-white font-semibold" : "hover:bg-[#1c2724] text-[#cfe3dc]"
                }`}
              >
                <Clapperboard size={13} className="text-[#4fd1a5]" />
                <span className="flex-1 truncate">{s.name}</span>
                {project.scenes.length > 1 && (
                  <button
                    type="button"
                    title="Eliminar escena"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScene(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[#9ab] hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="px-3 h-9 flex items-center justify-between border-y border-[#26322e] mt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8fb5a8]">Fuentes</span>
          </div>
          <div className="grid grid-cols-5 gap-1 px-2 py-2 border-b border-[#26322e]">
            {(Object.keys(SOURCE_META) as SourceKind[]).map((kind) => {
              const Icon = SOURCE_META[kind].icon;
              return (
                <button
                  key={kind}
                  type="button"
                  title={`Añadir: ${SOURCE_META[kind].label}`}
                  onClick={() => void addSource(kind)}
                  className="h-9 rounded-md bg-[#1b2623] hover:bg-[#24342f] flex items-center justify-center text-[#bfe3d6]"
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {scene.sources.length === 0 && (
              <p className="px-4 py-3 text-[12px] text-[#7d9a90]">Añade una fuente con los botones de arriba: pantalla, cámara, imagen, texto o color.</p>
            )}
            {scene.sources.map((source, index) => {
              const Icon = SOURCE_META[source.kind].icon;
              const capture = source.kind === "screen" || source.kind === "camera";
              const on = activeIds.has(source.id);
              return (
                <div
                  key={source.id}
                  data-source={source.id}
                  onClick={() => setSelectedId(source.id)}
                  className={`group mx-1.5 my-0.5 px-2 py-1.5 rounded-md text-[12px] flex items-center gap-2 cursor-pointer ${
                    source.id === selectedId ? "bg-[#22403a] text-white" : "hover:bg-[#1c2724] text-[#cfe3dc]"
                  }`}
                >
                  <Icon size={14} className={capture && !on ? "text-[#6c827a]" : "text-[#4fd1a5]"} />
                  <span className="flex-1 truncate">{source.name}</span>
                  {capture && <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-[#4fd1a5]" : "bg-[#5a6964]"}`} title={on ? "Activa" : "Sin capturar"} />}
                  <span className="flex items-center opacity-60 group-hover:opacity-100">
                    <button type="button" title="Subir" disabled={index === 0} onClick={(e) => (e.stopPropagation(), moveSource(source.id, -1))} className="disabled:opacity-30">
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      title="Bajar"
                      disabled={index === scene.sources.length - 1}
                      onClick={(e) => (e.stopPropagation(), moveSource(source.id, 1))}
                      className="disabled:opacity-30"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      title={source.visible ? "Ocultar" : "Mostrar"}
                      onClick={(e) => (e.stopPropagation(), updateSource(source.id, { visible: !source.visible }))}
                      className="ml-0.5"
                    >
                      {source.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Vista previa */}
        <section className="flex-1 flex flex-col items-center justify-center p-5 overflow-hidden min-w-0">
          <div className="w-full max-w-[1280px] relative" style={{ aspectRatio: "16 / 9" }}>
            <div
              ref={previewRef}
              data-studio-preview
              className="absolute inset-0 rounded-lg overflow-hidden ring-1 ring-[#2c3a36] bg-black cursor-move touch-none"
              onPointerDown={handlePreviewDown}
              onPointerMove={handlePreviewMove}
              onPointerUp={() => (dragRef.current = null)}
            />
            {/* Fuentes sin capturar y selección (solo en pantalla, no se graban) */}
            <div className="absolute inset-0 pointer-events-none">
              {scene.sources
                .filter((s) => s.visible && (s.kind === "screen" || s.kind === "camera") && !activeIds.has(s.id))
                .map((s) => (
                  <div
                    key={s.id}
                    className="absolute flex flex-col items-center justify-center gap-2 border border-dashed border-[#4fd1a5]/50 bg-[#4fd1a5]/5 text-[#9fd8c4] text-[12px]"
                    style={{ left: `${(s.x / DESIGN_W) * 100}%`, top: `${(s.y / DESIGN_H) * 100}%`, width: `${(s.w / DESIGN_W) * 100}%`, height: `${(s.h / DESIGN_H) * 100}%` }}
                  >
                    {s.kind === "screen" ? <Monitor size={22} /> : <Camera size={22} />}
                    <button
                      type="button"
                      className="pointer-events-auto px-3 py-1 rounded-full text-[11px] font-semibold text-[#0d1f19]"
                      style={{ background: "#4fd1a5" }}
                      onClick={() => void activate(s)}
                    >
                      {s.kind === "screen" ? "Capturar pantalla" : "Activar cámara"}
                    </button>
                  </div>
                ))}
              {selected && selected.visible && (
                <div
                  className="absolute border-2 border-[#4fd1a5]"
                  style={{
                    left: `${(selected.x / DESIGN_W) * 100}%`,
                    top: `${(selected.y / DESIGN_H) * 100}%`,
                    width: `${(selected.w / DESIGN_W) * 100}%`,
                    height: `${(selected.h / DESIGN_H) * 100}%`,
                    borderRadius: selected.round ? "50%" : undefined,
                  }}
                >
                  <div
                    className="pointer-events-auto absolute -right-2 -bottom-2 w-4 h-4 rounded-sm bg-[#4fd1a5] border-2 border-[#121816] cursor-nwse-resize"
                    title="Arrastra para cambiar el tamaño (Mayús: libre)"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const p = toDesign(e.clientX, e.clientY);
                      (previewRef.current as HTMLDivElement).setPointerCapture(e.pointerId);
                      dragRef.current = { id: selected.id, mode: "resize", startX: p.x, startY: p.y, orig: selected };
                    }}
                  />
                </div>
              )}
            </div>
            {recording !== "idle" && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-[12px] font-mono flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full bg-red-500 ${recording === "recording" ? "animate-pulse" : ""}`} />
                REC {fmtClock(recElapsed)}
              </div>
            )}
            {streaming === "live" && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-red-600 text-[12px] font-bold flex items-center gap-1.5">
                <Radio size={13} /> EN DIRECTO {fmtClock(now - streamStartAt)}
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-[#7d9a90]">
            Arrastra las fuentes en la vista previa para colocarlas; usa el tirador de la esquina para cambiar su tamaño.
          </p>
        </section>

        {/* Propiedades y mezclador */}
        <aside className="w-72 shrink-0 border-l border-[#26322e] flex flex-col overflow-y-auto">
          <div className="px-3 h-9 flex items-center border-b border-[#26322e]">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8fb5a8]">Propiedades</span>
          </div>
          {!selected && <p className="px-4 py-3 text-[12px] text-[#7d9a90]">Selecciona una fuente para ver sus opciones.</p>}
          {selected && (
            <div className="p-3 flex flex-col gap-2.5 text-[12px]">
              <label className="flex flex-col gap-1">
                <span className="text-[#9fbfb4]">Nombre</span>
                <input className={field} value={selected.name} onChange={(e) => updateSource(selected.id, { name: e.target.value }, `name-${selected.id}`)} />
              </label>
              {(selected.kind === "screen" || selected.kind === "camera") && (
                <div className="flex gap-1.5">
                  {activeIds.has(selected.id) ? (
                    <button type="button" className={smallBtn} onClick={() => deactivate(selected.id)}>
                      Detener captura
                    </button>
                  ) : (
                    <button type="button" className={smallBtn} onClick={() => void activate(selected)}>
                      {selected.kind === "screen" ? "Capturar pantalla" : "Activar cámara"}
                    </button>
                  )}
                  {selected.kind === "screen" && activeIds.has(selected.id) && (
                    <button type="button" className={smallBtn} onClick={() => void activate(selected)} title="Elegir otra pantalla o ventana">
                      Cambiar
                    </button>
                  )}
                </div>
              )}
              {selected.kind === "camera" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[#9fbfb4]">Dispositivo</span>
                    <select
                      className={field}
                      value={selected.deviceId || ""}
                      onChange={(e) => {
                        const next = { ...selected, deviceId: e.target.value || undefined };
                        updateSource(selected.id, { deviceId: next.deviceId });
                        if (activeIds.has(selected.id)) void activate(next);
                      }}
                    >
                      <option value="">Cámara predeterminada</option>
                      {cameras.map((c, i) => (
                        <option key={c.deviceId || i} value={c.deviceId}>
                          {c.label || `Cámara ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!selected.round} onChange={(e) => updateSource(selected.id, { round: e.target.checked })} />
                    Recortar en círculo
                  </label>
                </>
              )}
              {selected.kind === "text" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[#9fbfb4]">Texto</span>
                    <textarea
                      className={`${field} h-16 py-1.5 resize-none`}
                      value={selected.text || ""}
                      onChange={(e) => updateSource(selected.id, { text: e.target.value }, `text-${selected.id}`)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <label className="flex flex-col gap-1 flex-1">
                      <span className="text-[#9fbfb4]">Tamaño</span>
                      <input
                        type="number"
                        min={12}
                        max={300}
                        className={field}
                        value={selected.size || 64}
                        onChange={(e) => updateSource(selected.id, { size: Number(e.target.value) || 64 }, `size-${selected.id}`)}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[#9fbfb4]">Color</span>
                      <input type="color" className="h-8 w-12 rounded bg-transparent" value={selected.color || "#ffffff"} onChange={(e) => updateSource(selected.id, { color: e.target.value }, `color-${selected.id}`)} />
                    </label>
                  </div>
                </>
              )}
              {selected.kind === "color" && (
                <label className="flex items-center gap-2">
                  <span className="text-[#9fbfb4]">Color</span>
                  <input type="color" className="h-8 w-12 rounded bg-transparent" value={selected.color || "#1d2b28"} onChange={(e) => updateSource(selected.id, { color: e.target.value }, `color-${selected.id}`)} />
                </label>
              )}
              <div className="grid grid-cols-4 gap-1.5">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-[#9fbfb4] uppercase">{k === "w" ? "Ancho" : k === "h" ? "Alto" : k}</span>
                    <input
                      type="number"
                      className={`${field} px-1.5`}
                      value={Math.round(selected[k])}
                      onChange={(e) => updateSource(selected.id, { [k]: Number(e.target.value) || 0 }, `${k}-${selected.id}`)}
                    />
                  </label>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" className={smallBtn} onClick={() => void fitSource(selected, "full")}>
                  <Maximize size={12} /> Pantalla completa
                </button>
                <button type="button" className={smallBtn} onClick={() => void fitSource(selected, "corner")}>
                  <CornerDownRight size={12} /> Esquina
                </button>
              </div>
              <button type="button" className={`${smallBtn} text-red-300 hover:text-red-200 self-start`} onClick={() => removeSource(selected.id)}>
                <Trash2 size={12} /> Eliminar fuente
              </button>
            </div>
          )}

          <div className="px-3 h-9 flex items-center border-y border-[#26322e] mt-auto">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8fb5a8]">Mezclador de audio</span>
          </div>
          <div className="p-3 flex flex-col gap-4 text-[12px]">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button type="button" title={mixer.mic.muted ? "Activar micrófono" : "Silenciar micrófono"} onClick={() => setChannel("mic", { muted: !mixer.mic.muted })}>
                  {mixer.mic.muted ? <MicOff size={15} className="text-red-400" /> : <Mic size={15} className="text-[#4fd1a5]" />}
                </button>
                <span className="font-semibold">Micrófono</span>
              </div>
              <select className={field} value={micId ?? "off"} onChange={(e) => void chooseMic(e.target.value === "off" ? null : e.target.value)}>
                <option value="off">Sin micrófono</option>
                <option value="">Micrófono predeterminado</option>
                {mics
                  .filter((m) => m.deviceId && m.deviceId !== "default")
                  .map((m, i) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label || `Micrófono ${i + 1}`}
                    </option>
                  ))}
              </select>
              <Meter value={micId === null ? 0 : levels.mic} />
              <input type="range" min={0} max={2} step={0.05} value={mixer.mic.volume} onChange={(e) => setChannel("mic", { volume: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button type="button" title={mixer.system.muted ? "Activar audio" : "Silenciar audio"} onClick={() => setChannel("system", { muted: !mixer.system.muted })}>
                  {mixer.system.muted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-[#4fd1a5]" />}
                </button>
                <span className="font-semibold">Audio del escritorio</span>
              </div>
              <Meter value={levels.system} />
              <input type="range" min={0} max={2} step={0.05} value={mixer.system.volume} onChange={(e) => setChannel("system", { volume: Number(e.target.value) })} />
              {!hasSystemAudio && (
                <p className="text-[11px] text-[#7d9a90]">Para incluirlo, marca «Compartir audio del sistema» al capturar la pantalla.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Controles de grabación y transmisión */}
      <div className="h-16 shrink-0 border-t border-[#26322e] bg-[#0f1513] flex items-center gap-3 px-4">
        {recording === "idle" ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="h-10 px-4 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-[13px] flex items-center gap-2"
          >
            <Circle size={14} className="fill-white" /> Iniciar grabación
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={recording === "saving"}
              onClick={stopRecording}
              className="h-10 px-4 rounded-full bg-white text-[#121816] font-semibold text-[13px] flex items-center gap-2 disabled:opacity-60"
            >
              {recording === "saving" ? <Loader2 size={14} className="animate-spin" /> : <Square size={13} className="fill-[#121816]" />}
              {recording === "saving" ? "Guardando…" : "Detener grabación"}
            </button>
            <button type="button" disabled={recording === "saving"} onClick={togglePause} className={smallBtn} title="Pausar o reanudar">
              {recording === "paused" ? <Play size={13} /> : <Pause size={13} />}
              {recording === "paused" ? "Reanudar" : "Pausar"}
            </button>
            <span className="font-mono text-[12px] text-[#cfe3dc]">
              {fmtClock(recElapsed)} · {fmtSize(recBytes)}
            </span>
          </>
        )}

        <div className="w-px h-8 bg-[#26322e] mx-1" />

        {streaming === "idle" ? (
          <button
            type="button"
            onClick={() => setStreamDialog(true)}
            className="h-10 px-4 rounded-full font-semibold text-[13px] flex items-center gap-2 text-[#0d1f19]"
            style={{ background: "#4fd1a5" }}
          >
            <Radio size={15} /> Transmitir en directo
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={streaming !== "live"}
              onClick={() => void stopStreaming()}
              className="h-10 px-4 rounded-full bg-white text-[#121816] font-semibold text-[13px] flex items-center gap-2 disabled:opacity-60"
            >
              {streaming === "live" ? <Square size={13} className="fill-[#121816]" /> : <Loader2 size={14} className="animate-spin" />}
              {streaming === "starting" ? "Conectando…" : streaming === "stopping" ? "Finalizando…" : "Finalizar transmisión"}
            </button>
            {streaming === "live" && <span className="font-mono text-[12px] text-[#cfe3dc]">{streamInfo || "Enviando…"}</span>}
          </>
        )}
        <button type="button" title="Ajustes de transmisión" onClick={() => setStreamDialog(true)} className="p-2 rounded-full hover:bg-[#1f2b27] text-[#bfe3d6]" disabled={streaming !== "idle"}>
          <Settings2 size={16} />
        </button>

        <div className="flex-1" />
        {isTauri && (
          <button
            type="button"
            className={smallBtn}
            onClick={() => void videosDir().then((dir) => dir && openFolder(dir))}
            title="Abrir la carpeta Videos\CoffeWorks"
          >
            <FolderOpen size={13} /> Carpeta de grabaciones
          </button>
        )}
        <span className="text-[11px] text-[#7d9a90] font-mono">
          {project.stream.height}p · {project.stream.fps} fps
        </span>
      </div>

      {streamDialog && (
        <StreamDialog
          settings={project.stream}
          initialKey={streamKeyRef.current}
          onChange={(stream) => onChange({ ...projectRef.current, stream })}
          onClose={() => setStreamDialog(false)}
          onStart={(key) => void startStreaming(key)}
        />
      )}
    </div>
  );
};

// Accent usado por otras vistas
export const STUDIO_ACCENT = ACCENT;
