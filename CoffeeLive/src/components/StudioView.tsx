// Estudio de CoffeeLive: vista previa/programa, escenas, fuentes, mezclador,
// transiciones, controles de grabación y transmisión, y estadísticas.

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Monitor,
  Camera,
  Image as ImageIcon,
  Images,
  Film,
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
  Headphones,
  Loader2,
  FolderOpen,
  Clapperboard,
  ArrowRightLeft,
  Camera as CameraIcon,
  Lock,
  Scissors,
  X,
  Copy,
  Columns2,
} from "lucide-react";
import type { HotkeyAction, LiveDocument, LiveSettings, Scene, SourceKind, StudioSource } from "../types";
import { formatClock, formatSize, newId, newSource, recordingName, rescaleScenes, SOURCE_LABEL } from "../services/live";
import { LiveEngine, type Channel } from "../services/studio";
import { holdAwake, recordingFormat, streamingMime } from "../services/media";
import {
  ChunkWriter,
  IMAGE_FILTERS,
  downloadBlob,
  fileUrl,
  listDevices,
  onStreamEvents,
  openFolder,
  openInEditor,
  pickMediaPath,
  recordingPath,
  streamStart,
  streamStop,
  streamWrite,
  videosDir,
} from "../services/store";
import { baseName, bytesToBase64, extensionOf, isTauri, pickOpenFile } from "../services/desktop";
import { registerHotkeys } from "../services/hotkeys";
import { askConfirm, askText, showMessage, toast } from "./Dialogs";
import { SettingsDialog, type SettingsTab } from "./SettingsDialog";
import { SourcePanel } from "./SourcePanel";

export interface StudioHandle {
  openSettings: (tab?: SettingsTab) => void;
  toggleRecording: () => void;
  toggleStreaming: () => void;
  screenshot: () => void;
  addSource: (kind: SourceKind) => void;
  toggleStudioMode: () => void;
}

interface StudioViewProps {
  doc: LiveDocument;
  onChange: (doc: LiveDocument, key?: string) => void;
  onBusyChange: (busy: boolean) => void;
  /** Avisa si se está grabando o transmitiendo (indicadores de la barra superior). */
  onLiveChange?: (status: { recording: boolean; streaming: boolean }) => void;
}

const SOURCE_ICON: Record<SourceKind, React.ComponentType<{ size?: number; className?: string }>> = {
  screen: Monitor,
  camera: Camera,
  image: ImageIcon,
  slideshow: Images,
  media: Film,
  text: Type,
  color: Square,
};

const KEY_STORAGE = "coffeelive_stream_key";

const Meter: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-2 w-full rounded-sm bg-[#2a201b] overflow-hidden relative">
    <div className="absolute inset-0 flex">
      <div className="h-full bg-[#2f5d3a]" style={{ width: "70%" }} />
      <div className="h-full bg-[#6b5a1e]" style={{ width: "20%" }} />
      <div className="h-full bg-[#6b2420]" style={{ width: "10%" }} />
    </div>
    <div className="absolute inset-y-0 right-0 bg-[#2a201b] transition-[width] duration-75" style={{ width: `${100 - Math.round(value * 100)}%` }} />
  </div>
);

const toDb = (volume: number) => (volume <= 0.001 ? "-∞" : `${(20 * Math.log10(volume)).toFixed(1)}`);

const readImage = async (): Promise<{ src: string; name: string } | null> => {
  const picked = await pickOpenFile(IMAGE_FILTERS, "Elegir imagen");
  if (!picked) return null;
  const ext = extensionOf(picked.name);
  const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
  return { src: `data:${mime};base64,${bytesToBase64(picked.bytes)}`, name: picked.name };
};

export const StudioView = forwardRef<StudioHandle, StudioViewProps>(function StudioView({ doc, onChange, onBusyChange, onLiveChange }, ref) {
  const engineRef = useRef<LiveEngine | null>(null);
  const programHost = useRef<HTMLDivElement>(null);
  const previewHost = useRef<HTMLDivElement>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const settings = doc.settings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [previewId, setPreviewId] = useState(doc.currentSceneId);
  const [programId, setProgramId] = useState(doc.currentSceneId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [streamKey, setStreamKey] = useState(() => {
    try {
      return localStorage.getItem(KEY_STORAGE) || "";
    } catch {
      return "";
    }
  });
  const streamKeyRef = useRef(streamKey);
  streamKeyRef.current = streamKey;

  // Grabación
  const recorderRef = useRef<MediaRecorder | null>(null);
  const writerRef = useRef<ChunkWriter | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const [recording, setRecording] = useState<"idle" | "recording" | "paused" | "saving">("idle");
  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  const [recStart, setRecStart] = useState(0);
  const [recPausedMs, setRecPausedMs] = useState(0);
  const pauseStartRef = useRef(0);
  const [recBytes, setRecBytes] = useState(0);
  const [lastRecording, setLastRecording] = useState<string | null>(null);

  // Transmisión
  const streamRecRef = useRef<MediaRecorder | null>(null);
  const streamQueue = useRef<Promise<void>>(Promise.resolve());
  const [streaming, setStreaming] = useState<"idle" | "starting" | "live" | "reconnecting" | "stopping">("idle");
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;
  const stopRequested = useRef(false);
  const retries = useRef(0);
  const [streamStartAt, setStreamStartAt] = useState(0);
  const [streamInfo, setStreamInfo] = useState("");
  const [encoderUsed, setEncoderUsed] = useState("");
  const [micMuted, setMicMuted] = useState(false);

  const [now, setNow] = useState(Date.now());
  const studioMode = settings.general.studioMode;
  const editingId = studioMode ? previewId : programId;
  const scene: Scene | undefined = doc.scenes.find((s) => s.id === editingId) || doc.scenes[0];
  const selected = scene?.sources.find((s) => s.id === selectedId) || null;
  const live = recording !== "idle" || streaming !== "idle";
  const base = { w: settings.video.baseWidth, h: settings.video.baseHeight };

  // ---- Motor ---------------------------------------------------------------
  useEffect(() => {
    const engine = new LiveEngine();
    engineRef.current = engine;
    engine.sampleRate = settingsRef.current.audio.sampleRate;
    engine.programId = docRef.current.currentSceneId;
    engine.previewId = docRef.current.currentSceneId;
    engine.onSourceEnded = (id) =>
      setActiveIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    engine.onChannelsChanged = () => setChannels(engine.channelList());
    engine.program.className = "w-full h-full block";
    engine.preview.className = "w-full h-full block";
    programHost.current?.appendChild(engine.program);
    previewHost.current?.appendChild(engine.preview);
    void listDevices().then(({ cameras: c, mics: m }) => {
      setCameras(c);
      setMics(m);
    });
    return () => {
      engine.program.remove();
      engine.preview.remove();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Los lienzos cambian de sitio al entrar o salir del modo estudio
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.studioMode = studioMode;
    programHost.current?.appendChild(engine.program);
    if (studioMode) previewHost.current?.appendChild(engine.preview);
    if (!studioMode) {
      engine.previewId = engine.programId;
      setPreviewId(engine.programId);
    }
  }, [studioMode]);

  useEffect(() => {
    engineRef.current?.setScenes(doc.scenes);
  }, [doc.scenes]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const v = settings.video;
    engine.setResolution(v.baseWidth, v.baseHeight, v.outWidth, v.outHeight);
    if (!live) engine.resetOutput();
    engine.start(v.fps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.video]);

  // Micrófono y sus filtros
  const a = settings.audio;
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine
      .setMic(a.micDevice, { echoCancellation: a.echoCancellation, noiseSuppression: a.noiseSuppression, autoGainControl: a.autoGain, channels: a.channels })
      .then(() => {
        engine.setMicFilters(a.micGainDb, a.compressor, a.noiseGate, a.gateThreshold);
        return listDevices();
      })
      .then((devices) => {
        if (!devices) return;
        setMics(devices.mics);
        setCameras(devices.cameras);
      })
      .catch((err) => toast(`Micrófono: ${err instanceof Error ? err.message : String(err)}`, "error"));
  }, [a.micDevice, a.echoCancellation, a.noiseSuppression, a.autoGain, a.channels]);

  useEffect(() => {
    engineRef.current?.setMicFilters(a.micGainDb, a.compressor, a.noiseGate, a.gateThreshold);
  }, [a.micGainDb, a.compressor, a.noiseGate, a.gateThreshold]);

  useEffect(() => {
    engineRef.current?.setPushToTalk(Boolean(settings.hotkeys.pushToTalk));
  }, [settings.hotkeys.pushToTalk]);

  // Fuentes de video del disco: se activan solas al abrir
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const s of doc.scenes.flatMap((x) => x.sources)) {
      if (s.kind === "media" && s.path && isTauri && !engine.isActive(s.id)) {
        void engine.activate(s, { desktopAudio: false, mediaUrl: fileUrl(s.path) }).then(() => setActiveIds((prev) => new Set(prev).add(s.id)));
      }
    }
  }, [doc.scenes]);

  // Vúmetros, relojes y estadísticas
  useEffect(() => {
    const id = window.setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const next: Record<string, number> = {};
      engine.channelList().forEach((c) => (next[c.id] = engine.level(c.id)));
      setLevels(next);
      setNow(Date.now());
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => onBusyChange(live), [live, onBusyChange]);
  useEffect(
    () => onLiveChange?.({ recording: recording !== "idle", streaming: streaming === "live" || streaming === "reconnecting" }),
    [recording, streaming, onLiveChange]
  );

  // ---- Escenas -------------------------------------------------------------
  const updateScenes = useCallback((fn: (scenes: Scene[]) => Scene[], key?: string) => {
    const current = docRef.current;
    onChange({ ...current, scenes: fn(current.scenes) }, key);
  }, [onChange]);

  const updateScene = useCallback(
    (fn: (scene: Scene) => Scene, key?: string) => updateScenes((scenes) => scenes.map((s) => (s.id === (scene?.id || "") ? fn(s) : s)), key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateScenes, scene?.id]
  );

  const updateSource = useCallback(
    (id: string, patch: Partial<StudioSource>, key?: string) =>
      updateScenes((scenes) => scenes.map((s) => ({ ...s, sources: s.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)) })), key),
    [updateScenes]
  );

  const selectScene = (id: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    setSelectedId(null);
    if (studioMode) {
      engine.previewId = id;
      setPreviewId(id);
      return;
    }
    engine.transitionTo(id, settings.transition.kind, settings.transition.durationMs);
    engine.previewId = id;
    setProgramId(id);
    setPreviewId(id);
    onChange({ ...docRef.current, currentSceneId: id });
  };

  const doTransition = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!studioMode) return;
    engine.transitionTo(previewId, settings.transition.kind, settings.transition.durationMs);
    setProgramId(previewId);
    onChange({ ...docRef.current, currentSceneId: previewId });
  };

  const stepScene = (delta: number) => {
    const list = docRef.current.scenes;
    const index = list.findIndex((s) => s.id === (studioMode ? previewId : programId));
    const next = list[(index + delta + list.length) % list.length];
    if (next) selectScene(next.id);
  };

  const addScene = async () => {
    const name = await askText({ title: "Nueva escena", label: "Nombre", defaultValue: `Escena ${doc.scenes.length + 1}` });
    if (!name?.trim()) return;
    const created: Scene = { id: newId("scn"), name: name.trim(), sources: [] };
    updateScenes((scenes) => [...scenes, created]);
    selectScene(created.id);
  };

  const duplicateScene = (id: string) => {
    const original = doc.scenes.find((s) => s.id === id);
    if (!original) return;
    // Las capturas se comparten; las demás fuentes se copian
    const copy: Scene = {
      id: newId("scn"),
      name: `${original.name} (copia)`,
      sources: original.sources.map((s) => (s.kind === "screen" || s.kind === "camera" || s.kind === "media" ? { ...s, id: newId("src") } : { ...s, id: newId("src") })),
    };
    updateScenes((scenes) => [...scenes, copy]);
  };

  const renameScene = async (id: string) => {
    const target = doc.scenes.find((s) => s.id === id);
    if (!target) return;
    const name = await askText({ title: "Cambiar el nombre de la escena", label: "Nombre", defaultValue: target.name });
    if (!name?.trim()) return;
    updateScenes((scenes) => scenes.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)));
  };

  const deleteScene = async (id: string) => {
    if (doc.scenes.length <= 1) return;
    const target = doc.scenes.find((s) => s.id === id);
    const ok = await askConfirm({ title: "Eliminar la escena", message: `¿Eliminar «${target?.name}» y sus fuentes?`, confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    target?.sources.forEach((s) => engineRef.current?.deactivate(s.id));
    const remaining = doc.scenes.filter((s) => s.id !== id);
    onChange({ ...docRef.current, scenes: remaining, currentSceneId: remaining.some((s) => s.id === programId) ? programId : remaining[0].id });
    if (id === programId || id === previewId) {
      const engine = engineRef.current;
      if (engine) {
        engine.programId = remaining[0].id;
        engine.previewId = remaining[0].id;
      }
      setProgramId(remaining[0].id);
      setPreviewId(remaining[0].id);
    }
  };

  const moveScene = (id: string, delta: number) =>
    updateScenes((scenes) => {
      const i = scenes.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= scenes.length) return scenes;
      const next = [...scenes];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  // ---- Fuentes -------------------------------------------------------------
  const activate = async (source: StudioSource) => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      await engine.activate(source, {
        desktopAudio: settingsRef.current.audio.desktopAudio,
        mediaUrl: source.kind === "media" && source.path ? fileUrl(source.path) : undefined,
      });
      setActiveIds((prev) => new Set(prev).add(source.id));
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
  };

  const addSource = async (kind: SourceKind) => {
    if (!scene) return;
    let source = newSource(kind, base);
    if (kind === "image") {
      const image = await readImage();
      if (!image) return;
      const img = new Image();
      img.src = image.src;
      await new Promise((r) => {
        img.onload = r;
        img.onerror = r;
      });
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 16 / 9;
      const w = Math.min(base.w * 0.4, img.naturalWidth || 640);
      source = { ...source, name: image.name, src: image.src, x: 60, y: 60, w: Math.round(w), h: Math.round(w / ratio) };
    }
    if (kind === "slideshow") {
      const image = await readImage();
      if (!image) return;
      source = { ...source, srcs: [image.src] };
    }
    if (kind === "media") {
      if (!isTauri) {
        toast("Las fuentes de video del disco están disponibles en la aplicación de escritorio", "info");
        return;
      }
      const path = await pickMediaPath();
      if (!path) return;
      source = { ...source, name: baseName(path), path };
    }
    updateScene((s) => ({ ...s, sources: [source, ...s.sources] }));
    setSelectedId(source.id);
    if (kind === "screen" || kind === "camera") void activate(source);
  };

  const removeSource = (id: string) => {
    deactivate(id);
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

  const fitSource = (source: StudioSource, mode: "full" | "corner" | "center") => {
    if (mode === "full") {
      updateSource(source.id, { x: 0, y: 0, w: base.w, h: base.h });
      return;
    }
    const size = engineRef.current?.sourceSize(source.id);
    const ratio = size ? size.width / size.height : source.w / Math.max(1, source.h);
    if (mode === "center") {
      updateSource(source.id, { x: Math.round((base.w - source.w) / 2), y: Math.round((base.h - source.h) / 2) });
      return;
    }
    const w = Math.round(base.w * 0.24);
    const h = Math.round(w / ratio);
    const margin = Math.round(base.w * 0.02);
    updateSource(source.id, { w, h, x: base.w - w - margin, y: base.h - h - margin });
  };

  // ---- Arrastrar fuentes sobre el lienzo -----------------------------------
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: StudioSource } | null>(null);
  const editHost = studioMode ? previewHost : programHost;

  const toDesign = (clientX: number, clientY: number) => {
    const rect = editHost.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * base.w, y: ((clientY - rect.top) / rect.height) * base.h };
  };

  const handleDown = (e: React.PointerEvent) => {
    if (!scene || e.button !== 0) return;
    const p = toDesign(e.clientX, e.clientY);
    const hit = scene.sources.find((s) => s.visible && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    setSelectedId(hit?.id || null);
    if (!hit || hit.locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: hit.id, mode: "move", startX: p.x, startY: p.y, orig: hit };
  };

  const handleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toDesign(e.clientX, e.clientY);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;
    if (drag.mode === "move") {
      // Imán a los bordes del lienzo
      const snap = base.w * 0.012;
      let x = Math.round(drag.orig.x + dx);
      let y = Math.round(drag.orig.y + dy);
      if (Math.abs(x) < snap) x = 0;
      if (Math.abs(y) < snap) y = 0;
      if (Math.abs(x + drag.orig.w - base.w) < snap) x = base.w - drag.orig.w;
      if (Math.abs(y + drag.orig.h - base.h) < snap) y = base.h - drag.orig.h;
      updateSource(drag.id, { x, y }, `move-${drag.id}`);
    } else {
      const ratio = drag.orig.w / drag.orig.h;
      const w = Math.max(20, Math.round(drag.orig.w + dx));
      const h = e.shiftKey ? Math.max(20, Math.round(drag.orig.h + dy)) : Math.round(w / ratio);
      updateSource(drag.id, { w, h }, `resize-${drag.id}`);
    }
  };

  // ---- Grabación -----------------------------------------------------------
  const startRecording = async () => {
    const engine = engineRef.current;
    if (!engine || recordingRef.current !== "idle") return;
    const r = settingsRef.current.recording;
    const format = recordingFormat(r.format);
    if (!format) {
      void showMessage("No se puede grabar", "Este equipo no admite la grabación de video.");
      return;
    }
    try {
      const name = recordingName(r.fileName, format.extension);
      const path = await recordingPath(name, r.folder);
      const writer = await ChunkWriter.open(path, format.mime);
      const recorder = new MediaRecorder(engine.outputStream(), {
        mimeType: format.mime,
        videoBitsPerSecond: r.videoKbps * 1000,
        audioBitsPerSecond: r.audioKbps * 1000,
      });
      recorder.ondataavailable = (e) => {
        writer.append(e.data);
        setRecBytes(writer.bytes);
      };
      recorder.onstop = async () => {
        setRecording("saving");
        try {
          const result = await writer.close();
          if (result.blob) {
            downloadBlob(result.blob, name);
            toast("Grabación descargada");
          } else if (result.path) {
            setLastRecording(result.path);
            toast("Grabación guardada");
          }
        } catch (err) {
          void showMessage("No se pudo guardar la grabación", err instanceof Error ? err.message : String(err));
        } finally {
          if (streamingRef.current === "idle") {
            releaseRef.current?.();
            releaseRef.current = null;
          }
          setRecording("idle");
        }
      };
      writerRef.current = writer;
      recorderRef.current = recorder;
      if (!releaseRef.current) releaseRef.current = holdAwake();
      recorder.start(1000);
      if (streamingRef.current === "idle") engine.stats.dropped = 0;
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

  // ---- Transmisión ---------------------------------------------------------
  const stopStreamRecorder = async () => {
    const recorder = streamRecRef.current;
    streamRecRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      const done = new Promise((r) => (recorder.onstop = r));
      recorder.stop();
      await done;
    }
    await streamQueue.current;
  };

  /** Arranca ffmpeg y el envío de video (también al reconectar). */
  const startSession = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const s = settingsRef.current;
    const encoder = await streamStart({
      server: s.stream.server,
      key: streamKeyRef.current,
      fps: s.video.fps,
      videoKbps: s.stream.videoKbps,
      audioKbps: s.stream.audioKbps,
      encoder: s.stream.encoder,
      rateControl: s.stream.rateControl,
      preset: s.stream.preset,
      profile: s.stream.profile,
      keyframeSec: s.stream.keyframeSec,
      outWidth: s.video.outWidth,
      outHeight: s.video.outHeight,
      downscale: s.video.downscale,
      sampleRate: s.audio.sampleRate,
      channels: s.audio.channels,
    });
    setEncoderUsed(encoder);
    const recorder = new MediaRecorder(engine.outputStream(), {
      mimeType: streamingMime(),
      // Se envía con calidad de sobra: ffmpeg recodifica a la tasa elegida
      videoBitsPerSecond: Math.max(8_000_000, s.stream.videoKbps * 2500),
      audioBitsPerSecond: 256_000,
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
    recorder.start(250);
  };

  const startStreaming = async () => {
    if (streamingRef.current !== "idle") return;
    if (!isTauri) {
      setSettingsTab("stream");
      return;
    }
    const s = settingsRef.current.stream;
    if (!streamKeyRef.current.trim() || !/^(rtmps?|srt):\/\//.test(s.server)) {
      toast("Configura el servidor y la clave de transmisión", "info");
      setSettingsTab("stream");
      return;
    }
    if (s.confirmStart && !(await askConfirm({ title: "Iniciar la transmisión", message: "¿Quieres empezar a transmitir en directo?", confirmLabel: "Transmitir" }))) return;
    stopRequested.current = false;
    retries.current = 0;
    if (engineRef.current && recordingRef.current === "idle") engineRef.current.stats.dropped = 0;
    setStreaming("starting");
    try {
      await startSession();
      if (!releaseRef.current) releaseRef.current = holdAwake();
      setStreamStartAt(Date.now());
      setStreaming("live");
      if (s.recordWhileStreaming && recordingRef.current === "idle") void startRecording();
    } catch (err) {
      setStreaming("idle");
      void showMessage("No se pudo iniciar la transmisión", err instanceof Error ? err.message : String(err));
    }
  };

  const stopStreaming = async (ask = true) => {
    if (streamingRef.current === "idle") return;
    if (ask && settingsRef.current.stream.confirmStop && !(await askConfirm({ title: "Detener la transmisión", message: "¿Quieres terminar el directo?", confirmLabel: "Detener", danger: true }))) return;
    stopRequested.current = true;
    setStreaming("stopping");
    await stopStreamRecorder();
    await streamStop().catch(() => undefined);
    setStreaming("idle");
    setStreamInfo("");
    if (recordingRef.current === "idle") {
      releaseRef.current?.();
      releaseRef.current = null;
    }
  };

  useEffect(
    () =>
      onStreamEvents(
        (line) => {
          const bitrate = /bitrate=\s*([\d.]+\w*bits\/s)/.exec(line)?.[1];
          const speed = /speed=\s*([\d.]+x)/.exec(line)?.[1];
          if (bitrate) setStreamInfo(`${bitrate}${speed ? ` · ${speed}` : ""}`);
        },
        (ok, message) => {
          void (async () => {
            await stopStreamRecorder();
            if (stopRequested.current || streamingRef.current === "idle") return;
            const s = settingsRef.current.stream;
            // Corte inesperado: reconexión automática
            if (!ok && s.reconnect && retries.current < s.maxRetries) {
              retries.current += 1;
              setStreaming("reconnecting");
              setStreamInfo(`Reconectando (${retries.current}/${s.maxRetries})…`);
              await new Promise((r) => setTimeout(r, s.retryDelaySec * 1000));
              if (stopRequested.current) return;
              try {
                await startSession();
                setStreaming("live");
                setStreamInfo("");
                toast("Transmisión reconectada");
              } catch {
                setStreaming("reconnecting");
                // El siguiente intento llega con el próximo fin de sesión
                setTimeout(() => {
                  if (!stopRequested.current && streamingRef.current === "reconnecting") {
                    setStreaming("idle");
                    void showMessage("La transmisión se detuvo", "No se pudo reconectar. Revisa la conexión a Internet.");
                  }
                }, s.retryDelaySec * 1000);
              }
              return;
            }
            setStreaming("idle");
            setStreamInfo("");
            if (!ok) void showMessage("La transmisión se detuvo", message);
            else toast("Transmisión finalizada");
          })();
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---- Otras acciones ------------------------------------------------------
  const screenshot = async () => {
    const blob = await engineRef.current?.screenshot();
    if (!blob) return;
    const name = recordingName("Captura %fecha%", "png");
    if (isTauri) {
      const path = await recordingPath(name, settingsRef.current.recording.folder);
      const writer = await ChunkWriter.open(path, "image/png");
      writer.append(blob);
      await writer.close();
      toast("Captura guardada en la carpeta de grabaciones");
    } else {
      downloadBlob(blob, name);
    }
  };

  const toggleMic = () => {
    const engine = engineRef.current;
    const mic = engine?.channelList().find((c) => c.kind === "mic");
    if (!engine || !mic) return;
    engine.setChannel(mic.id, { muted: !mic.muted });
    setMicMuted(!mic.muted);
    setChannels(engine.channelList());
  };

  const toggleRecording = () => {
    if (recordingRef.current === "idle") void startRecording();
    else if (recordingRef.current !== "saving") stopRecording();
  };
  const toggleStreaming = () => {
    if (streamingRef.current === "idle") void startStreaming();
    else void stopStreaming();
  };

  // Atajos de teclado (globales en el escritorio)
  const actionsRef = useRef<Record<HotkeyAction, (pressed: boolean) => void>>({} as Record<HotkeyAction, (pressed: boolean) => void>);
  actionsRef.current = {
    toggleRecording: (p) => p && toggleRecording(),
    pauseRecording: (p) => p && togglePause(),
    toggleStreaming: (p) => p && toggleStreaming(),
    toggleMic: (p) => p && toggleMic(),
    pushToTalk: (p) => engineRef.current?.setPushToTalkPressed(p),
    transition: (p) => p && doTransition(),
    nextScene: (p) => p && stepScene(1),
    previousScene: (p) => p && stepScene(-1),
    screenshot: (p) => p && void screenshot(),
  };
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    void registerHotkeys(settings.hotkeys, (action, pressed) => actionsRef.current[action]?.(pressed)).then((fn) => {
      if (cancelled) fn();
      else cleanup = fn;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [settings.hotkeys]);

  useImperativeHandle(ref, () => ({
    openSettings: (tab = "general") => setSettingsTab(tab),
    toggleRecording,
    toggleStreaming,
    screenshot: () => void screenshot(),
    addSource: (kind) => void addSource(kind),
    toggleStudioMode: () => onChange({ ...docRef.current, settings: { ...settingsRef.current, general: { ...settingsRef.current.general, studioMode: !studioMode } } }),
  }));

  // Al cerrar no se deja nada abierto
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      if (streamRecRef.current) void streamStop().catch(() => undefined);
    },
    []
  );

  const setSettings = (next: LiveSettings) => {
    const current = docRef.current;
    const prev = current.settings.video;
    const v = next.video;
    // Al cambiar la resolución base, las fuentes se adaptan al lienzo nuevo
    const scenes =
      prev.baseWidth !== v.baseWidth || prev.baseHeight !== v.baseHeight
        ? rescaleScenes(current.scenes, { w: prev.baseWidth, h: prev.baseHeight }, { w: v.baseWidth, h: v.baseHeight })
        : current.scenes;
    // La salida mantiene la proporción de la base
    let video = v;
    if (v.outWidth / v.outHeight !== v.baseWidth / v.baseHeight && (prev.baseWidth !== v.baseWidth || prev.baseHeight !== v.baseHeight)) {
      video = { ...v, outWidth: v.baseWidth, outHeight: v.baseHeight };
    }
    onChange({ ...current, scenes, settings: { ...next, video } }, "settings");
  };

  // ---- Interfaz ------------------------------------------------------------
  if (!scene) return null;
  const recElapsed = recording === "idle" ? 0 : (recording === "paused" ? pauseStartRef.current : now) - recStart - recPausedMs;
  const dock = "flex flex-col min-w-0 border-r border-[#33261f] last:border-r-0";
  const dockTitle = "h-8 px-3 flex items-center justify-between border-b border-[#33261f] text-[11px] font-semibold uppercase tracking-wide text-[#d39b6f]";
  const tool = "p-1 rounded hover:bg-[#2c201a] text-[#e9d3c2] disabled:opacity-30";
  const bigBtn = "w-full h-9 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60";
  const stats = engineRef.current?.stats;

  const canvasBox = (host: React.RefObject<HTMLDivElement | null>, title: string, editable: boolean, sceneName: string, liveBadge: boolean) => (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#d39b6f] flex items-center gap-2">
        {title} <span className="normal-case font-normal text-[#a88b78]">· {sceneName}</span>
      </div>
      <div className="w-full relative" style={{ aspectRatio: `${base.w} / ${base.h}`, maxHeight: "100%" }}>
        <div
          ref={host}
          data-live-canvas={editable ? "edit" : "program"}
          className={`absolute inset-0 rounded-md overflow-hidden bg-black ring-1 ${liveBadge && streaming === "live" ? "ring-red-500" : "ring-[#3a2b23]"} ${
            editable ? "cursor-move touch-none" : ""
          }`}
          onPointerDown={editable ? handleDown : undefined}
          onPointerMove={editable ? handleMove : undefined}
          onPointerUp={editable ? () => (dragRef.current = null) : undefined}
        />
        {editable && (
          <div className="absolute inset-0 pointer-events-none">
            {scene.sources
              .filter((s) => s.visible && (s.kind === "screen" || s.kind === "camera") && !activeIds.has(s.id))
              .map((s) => (
                <div
                  key={s.id}
                  className="absolute flex flex-col items-center justify-center gap-2 border border-dashed border-[#ff8a2a]/60 bg-[#ff8a2a]/5 text-[#ffc89a] text-[12px]"
                  style={{ left: `${(s.x / base.w) * 100}%`, top: `${(s.y / base.h) * 100}%`, width: `${(s.w / base.w) * 100}%`, height: `${(s.h / base.h) * 100}%` }}
                >
                  {s.kind === "screen" ? <Monitor size={22} /> : <Camera size={22} />}
                  <button
                    type="button"
                    className="pointer-events-auto px-3 py-1 rounded-full text-[11px] font-semibold text-black"
                    style={{ background: "#ff8a2a" }}
                    onClick={() => void activate(s)}
                  >
                    {s.kind === "screen" ? "Capturar pantalla" : "Activar cámara"}
                  </button>
                </div>
              ))}
            {selected && selected.visible && (
              <div
                className="absolute border-2 border-[#ff8a2a]"
                style={{
                  left: `${(selected.x / base.w) * 100}%`,
                  top: `${(selected.y / base.h) * 100}%`,
                  width: `${(selected.w / base.w) * 100}%`,
                  height: `${(selected.h / base.h) * 100}%`,
                  borderRadius: selected.round ? "50%" : undefined,
                }}
              >
                {!selected.locked && (
                  <div
                    className="pointer-events-auto absolute -right-2 -bottom-2 w-4 h-4 rounded-sm bg-[#ff8a2a] border-2 border-[#120c09] cursor-nwse-resize"
                    title="Arrastra para cambiar el tamaño (Mayús: libre)"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const p = toDesign(e.clientX, e.clientY);
                      (editHost.current as HTMLDivElement).setPointerCapture(e.pointerId);
                      dragRef.current = { id: selected.id, mode: "resize", startX: p.x, startY: p.y, orig: selected };
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
        {liveBadge && recording !== "idle" && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[11px] font-mono flex items-center gap-1.5 text-white">
            <span className={`w-2 h-2 rounded-full bg-red-500 ${recording === "recording" ? "animate-pulse" : ""}`} />
            REC {formatClock(recElapsed)}
          </div>
        )}
        {liveBadge && streaming === "live" && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-600 text-[11px] font-bold flex items-center gap-1.5 text-white">
            <Radio size={12} /> EN DIRECTO
          </div>
        )}
      </div>
    </div>
  );

  const programScene = doc.scenes.find((s) => s.id === programId) || doc.scenes[0];
  const previewScene = doc.scenes.find((s) => s.id === previewId) || doc.scenes[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#120c09] text-[#f5e9df]">
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Vista previa y programa */}
        <section className="flex-1 min-w-0 flex items-center gap-3 p-4 overflow-hidden">
          {studioMode && canvasBox(previewHost, "Vista previa", true, previewScene.name, false)}
          {studioMode && (
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={doTransition}
                disabled={previewId === programId}
                className="h-10 px-4 rounded-lg font-semibold text-[12px] text-black flex items-center gap-2 disabled:opacity-40"
                style={{ background: "#ff8a2a" }}
                title={`Pasar la vista previa al programa (${settings.hotkeys.transition || "sin atajo"})`}
              >
                <ArrowRightLeft size={15} /> Transición
              </button>
            </div>
          )}
          {canvasBox(programHost, studioMode ? "Programa (en directo)" : "Programa", !studioMode, programScene.name, true)}
          {/* El lienzo de vista previa existe siempre para no recrear el motor */}
          {!studioMode && <div ref={previewHost} className="hidden" />}
        </section>

        {selected && (
          <SourcePanel
            source={selected}
            active={activeIds.has(selected.id)}
            cameras={cameras}
            onChange={(patch, key) => {
              updateSource(selected.id, patch, key);
              if (patch.deviceId !== undefined && activeIds.has(selected.id)) void activate({ ...selected, ...patch });
            }}
            onActivate={() => void activate(selected)}
            onDeactivate={() => deactivate(selected.id)}
            onRemove={() => removeSource(selected.id)}
            onFit={(mode) => fitSource(selected, mode)}
            onPickImage={() =>
              void readImage().then((image) => {
                if (image) updateSource(selected.id, { src: image.src, name: image.name });
              })
            }
            onAddSlides={() =>
              void readImage().then((image) => {
                if (image) updateSource(selected.id, { srcs: [...(selected.srcs || []), image.src] });
              })
            }
            onPickMedia={() =>
              void pickMediaPath().then((path) => {
                if (!path) return;
                const next = { ...selected, path, name: baseName(path) };
                updateSource(selected.id, { path, name: baseName(path) });
                void activate(next);
              })
            }
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Paneles inferiores */}
      <div className="h-60 shrink-0 border-t border-[#33261f] bg-[#18110e] grid grid-cols-[1fr_1.3fr_1.6fr_0.9fr_1fr]">
        {/* Escenas */}
        <div className={dock}>
          <div className={dockTitle}>
            Escenas
            <span className="flex gap-0.5">
              <button type="button" className={tool} title="Nueva escena" onClick={() => void addScene()}>
                <Plus size={14} />
              </button>
              <button type="button" className={tool} title="Duplicar escena" onClick={() => duplicateScene(editingId)}>
                <Copy size={13} />
              </button>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {doc.scenes.map((s, i) => (
              <div
                key={s.id}
                data-scene={s.id}
                onClick={() => selectScene(s.id)}
                onDoubleClick={() => void renameScene(s.id)}
                className={`group mx-1 my-0.5 px-2 py-1.5 rounded text-[12px] flex items-center gap-2 cursor-pointer ${
                  s.id === editingId ? "bg-[#4a2a15] text-white font-semibold" : "hover:bg-[#241a15] text-[#e9d3c2]"
                }`}
              >
                <Clapperboard size={12} className={s.id === programId ? "text-red-400" : "text-[#ff8a2a]"} />
                <span className="flex-1 truncate">{s.name}</span>
                {i < 9 && <span className="text-[10px] text-[#8a6f5f] font-mono">{i + 1}</span>}
                <span className="hidden group-hover:flex items-center">
                  <button type="button" className={tool} disabled={i === 0} onClick={(e) => (e.stopPropagation(), moveScene(s.id, -1))}>
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" className={tool} disabled={i === doc.scenes.length - 1} onClick={(e) => (e.stopPropagation(), moveScene(s.id, 1))}>
                    <ChevronDown size={12} />
                  </button>
                  {doc.scenes.length > 1 && (
                    <button type="button" className={tool} onClick={(e) => (e.stopPropagation(), void deleteScene(s.id))}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fuentes */}
        <div className={dock}>
          <div className={dockTitle}>
            Fuentes · {scene.name}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-1.5 py-1.5 border-b border-[#33261f]">
            {(Object.keys(SOURCE_ICON) as SourceKind[]).map((kind) => {
              const Icon = SOURCE_ICON[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  data-add-source={kind}
                  title={`Añadir: ${SOURCE_LABEL[kind]}`}
                  onClick={() => void addSource(kind)}
                  className="h-7 rounded bg-[#241a15] hover:bg-[#33251d] flex items-center justify-center text-[#ffc89a]"
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {scene.sources.length === 0 && <p className="px-3 py-2 text-[11px] text-[#9c7f6d]">Añade fuentes con los botones de arriba.</p>}
            {scene.sources.map((source, index) => {
              const Icon = SOURCE_ICON[source.kind];
              const capture = source.kind === "screen" || source.kind === "camera" || source.kind === "media";
              const on = activeIds.has(source.id);
              return (
                <div
                  key={source.id}
                  data-source={source.id}
                  onClick={() => setSelectedId(source.id)}
                  className={`group mx-1 my-0.5 px-2 py-1 rounded text-[12px] flex items-center gap-2 cursor-pointer ${
                    source.id === selectedId ? "bg-[#4a2a15] text-white" : "hover:bg-[#241a15] text-[#e9d3c2]"
                  }`}
                >
                  <Icon size={13} className={capture && !on ? "text-[#7c6556]" : "text-[#ff8a2a]"} />
                  <span className="flex-1 truncate">{source.name}</span>
                  {source.locked && <Lock size={11} className="text-[#a88b78]" />}
                  {capture && <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-[#4fd1a5]" : "bg-[#5a4a40]"}`} title={on ? "Activa" : "Inactiva"} />}
                  <span className="flex items-center opacity-60 group-hover:opacity-100">
                    <button type="button" className={tool} disabled={index === 0} onClick={(e) => (e.stopPropagation(), moveSource(source.id, -1))} title="Subir">
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      className={tool}
                      disabled={index === scene.sources.length - 1}
                      onClick={(e) => (e.stopPropagation(), moveSource(source.id, 1))}
                      title="Bajar"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button type="button" className={tool} title={source.visible ? "Ocultar" : "Mostrar"} onClick={(e) => (e.stopPropagation(), updateSource(source.id, { visible: !source.visible }))}>
                      {source.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mezclador */}
        <div className={dock}>
          <div className={dockTitle}>
            Mezclador de audio
            <button type="button" className={tool} title="Ajustes de audio" onClick={() => setSettingsTab("audio")}>
              <Settings2 size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
            {channels.length === 0 && (
              <p className="text-[11px] text-[#9c7f6d]">
                Elige un micrófono en Ajustes › Audio, o captura la pantalla con audio del sistema.
              </p>
            )}
            {channels.map((c) => (
              <div key={c.id} data-channel={c.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 truncate font-semibold">{c.label}</span>
                  <span className="font-mono text-[10px] text-[#a88b78] w-14 text-right">{toDb(c.volume)} dB</span>
                  <button
                    type="button"
                    className={tool}
                    title={c.monitor ? "Dejar de escuchar" : "Escuchar (monitor)"}
                    onClick={() => {
                      engineRef.current?.setChannel(c.id, { monitor: !c.monitor });
                      setChannels(engineRef.current?.channelList() || []);
                    }}
                  >
                    <Headphones size={13} className={c.monitor ? "text-[#ff8a2a]" : ""} />
                  </button>
                  <button
                    type="button"
                    className={tool}
                    title={c.muted ? "Activar" : "Silenciar"}
                    onClick={() => {
                      engineRef.current?.setChannel(c.id, { muted: !c.muted });
                      if (c.kind === "mic") setMicMuted(!c.muted);
                      setChannels(engineRef.current?.channelList() || []);
                    }}
                  >
                    {c.kind === "mic" ? (
                      c.muted ? <MicOff size={13} className="text-red-400" /> : <Mic size={13} />
                    ) : c.muted ? (
                      <VolumeX size={13} className="text-red-400" />
                    ) : (
                      <Volume2 size={13} />
                    )}
                  </button>
                </div>
                <Meter value={c.muted ? 0 : levels[c.id] || 0} />
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.01}
                  value={c.volume}
                  className="accent-[#ff8a2a]"
                  onChange={(e) => {
                    engineRef.current?.setChannel(c.id, { volume: Number(e.target.value) });
                    setChannels(engineRef.current?.channelList() || []);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Transiciones */}
        <div className={dock}>
          <div className={dockTitle}>Transiciones</div>
          <div className="p-3 flex flex-col gap-2 text-[12px]">
            <select
              className="h-8 px-2 rounded-md bg-[#201713] border border-[#3a2b23] text-[#f5e9df]"
              value={settings.transition.kind}
              onChange={(e) => setSettings({ ...settings, transition: { ...settings.transition, kind: e.target.value as LiveSettings["transition"]["kind"] } })}
            >
              <option value="cut">Corte</option>
              <option value="fade">Fundido</option>
              <option value="slide">Deslizar</option>
              <option value="swipe">Barrido</option>
              <option value="zoom">Zoom</option>
            </select>
            <label className="flex items-center gap-2">
              Duración
              <input
                type="number"
                min={0}
                max={5000}
                step={50}
                className="w-20 h-8 px-2 rounded-md bg-[#201713] border border-[#3a2b23] text-[#f5e9df]"
                value={settings.transition.durationMs}
                onChange={(e) => setSettings({ ...settings, transition: { ...settings.transition, durationMs: Number(e.target.value) || 0 } })}
              />
              ms
            </label>

          </div>
        </div>

        {/* Controles */}
        <div className={dock}>
          <div className={dockTitle}>Controles</div>
          <div className="p-2.5 flex flex-col gap-1.5">
            {streaming === "idle" ? (
              <button type="button" className={`${bigBtn} text-black`} style={{ background: "#ff8a2a" }} onClick={() => void startStreaming()}>
                <Radio size={15} /> Iniciar transmisión
              </button>
            ) : (
              <button
                type="button"
                className={`${bigBtn} bg-red-600 text-white`}
                disabled={streaming === "starting" || streaming === "stopping"}
                onClick={() => void stopStreaming()}
              >
                {streaming === "live" ? <Square size={12} className="fill-white" /> : <Loader2 size={14} className="animate-spin" />}
                {streaming === "starting" ? "Conectando…" : streaming === "stopping" ? "Finalizando…" : streaming === "reconnecting" ? "Reconectando…" : "Detener transmisión"}
              </button>
            )}
            {recording === "idle" ? (
              <button type="button" className={`${bigBtn} bg-[#2c201a] hover:bg-[#3a2a21] text-white`} onClick={() => void startRecording()}>
                <Circle size={12} className="fill-red-500 text-red-500" /> Iniciar grabación
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button type="button" className={`${bigBtn} bg-white text-black`} disabled={recording === "saving"} onClick={stopRecording}>
                  {recording === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Square size={11} className="fill-black" />}
                  {recording === "saving" ? "Guardando…" : "Detener"}
                </button>
                <button type="button" className={`${bigBtn} !w-12 bg-[#2c201a] text-white`} disabled={recording === "saving"} onClick={togglePause} title="Pausar o reanudar">
                  {recording === "paused" ? <Play size={13} /> : <Pause size={13} />}
                </button>
              </div>
            )}
            <button
              type="button"
              data-studio-mode
              onClick={() => setSettings({ ...settings, general: { ...settings.general, studioMode: !studioMode } })}
              className={`${bigBtn} ${studioMode ? "text-black" : "bg-[#2c201a] hover:bg-[#3a2a21] text-white"}`}
              style={studioMode ? { background: "#ff8a2a" } : undefined}
              title="Muestra la vista previa y el programa por separado para preparar la siguiente escena"
            >
              <Columns2 size={14} /> Modo estudio{studioMode ? ": activado" : ""}
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" className={`${bigBtn} bg-[#2c201a] hover:bg-[#3a2a21] text-white`} onClick={() => void screenshot()} title="Captura de la salida (PNG)">
                <CameraIcon size={14} />
              </button>
              <button type="button" className={`${bigBtn} bg-[#2c201a] hover:bg-[#3a2a21] text-white`} onClick={() => toggleMic()} title="Silenciar el micrófono">
                {micMuted ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} />}
              </button>
              <button type="button" className={`${bigBtn} bg-[#2c201a] hover:bg-[#3a2a21] text-white`} onClick={() => setSettingsTab("general")} title="Ajustes">
                <Settings2 size={14} />
              </button>
            </div>
            {isTauri && (
              <button
                type="button"
                className={`${bigBtn} bg-[#2c201a] hover:bg-[#3a2a21] text-white !h-8`}
                onClick={() => void (settings.recording.folder ? openFolder(settings.recording.folder) : videosDir().then((dir) => dir && openFolder(dir)))}
              >
                <FolderOpen size={13} /> Carpeta de grabaciones
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barra de estado */}
      <div className="h-7 shrink-0 border-t border-[#33261f] bg-[#0e0907] flex items-center gap-4 px-3 text-[11px] font-mono text-[#cdb4a2]">
        <span className={streaming === "live" ? "text-red-400 font-bold" : ""}>
          LIVE {streaming === "idle" ? "00:00:00" : formatClock(now - streamStartAt)}
        </span>
        <span className={recording !== "idle" ? "text-red-400 font-bold" : ""}>
          REC {formatClock(recElapsed)}
          {recording !== "idle" ? ` · ${formatSize(recBytes)}` : ""}
        </span>
        {streaming !== "idle" && streamInfo && <span>{streamInfo}</span>}
        {streaming === "live" && encoderUsed && <span>Codificador: {encoderUsed}</span>}
        {settings.general.showStats && stats && (
          <>
            <span>{stats.fps.toFixed(1)} / {settings.video.fps} FPS</span>
            <span>Render {stats.renderMs.toFixed(1)} ms</span>
            <span className={stats.dropped > 0 ? "text-[#ffca28]" : ""}>Perdidos {stats.dropped}</span>
          </>
        )}
        <span className="ml-auto">
          {settings.video.baseWidth}×{settings.video.baseHeight} → {settings.video.outWidth}×{settings.video.outHeight}
        </span>
        {lastRecording && (
          <span className="flex items-center gap-1.5 text-[#ffc89a]">
            <button type="button" className="underline" onClick={() => void openInEditor(lastRecording).catch((e) => toast(String(e), "error"))}>
              <Scissors size={11} className="inline mr-1" />
              Editar la última grabación en CoffeeEdit
            </button>
            <button type="button" title="Ocultar" onClick={() => setLastRecording(null)}>
              <X size={11} />
            </button>
          </span>
        )}
      </div>

      {settingsTab && (
        <SettingsDialog
          settings={settings}
          streamKey={streamKey}
          live={live}
          mics={mics}
          initialTab={settingsTab}
          onChange={setSettings}
          onStreamKey={(key) => {
            setStreamKey(key);
            try {
              if (settings.stream.rememberKey) localStorage.setItem(KEY_STORAGE, key);
              else localStorage.removeItem(KEY_STORAGE);
            } catch {
              // Sin almacenamiento
            }
          }}
          onClose={() => {
            try {
              if (settingsRef.current.stream.rememberKey) localStorage.setItem(KEY_STORAGE, streamKeyRef.current);
              else localStorage.removeItem(KEY_STORAGE);
            } catch {
              // Sin almacenamiento
            }
            setSettingsTab(null);
          }}
        />
      )}
    </div>
  );
});
