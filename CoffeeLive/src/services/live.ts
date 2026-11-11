// Operaciones sobre la colección de escenas de CoffeeLive.

import type { HotkeyAction, LiveDocument, LiveSettings, Scene, SourceFilters, SourceKind, StudioSource } from "../types";

let counter = 0;
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const DEFAULT_FILTERS: SourceFilters = {
  crop: { left: 0, top: 0, right: 0, bottom: 0 },
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  opacity: 100,
  blur: 0,
  chroma: { enabled: false, color: "#00ff00", similarity: 40, smoothness: 10 },
};

export const DEFAULT_HOTKEYS: Record<HotkeyAction, string> = {
  toggleRecording: "Ctrl+Shift+R",
  pauseRecording: "Ctrl+Shift+P",
  toggleStreaming: "Ctrl+Shift+S",
  toggleMic: "Ctrl+Shift+M",
  pushToTalk: "",
  transition: "Ctrl+Shift+T",
  nextScene: "Ctrl+Shift+Right",
  previousScene: "Ctrl+Shift+Left",
  screenshot: "Ctrl+Shift+F12",
};

export function defaultSettings(): LiveSettings {
  return {
    stream: {
      service: "twitch",
      server: "rtmp://live.twitch.tv/app",
      rememberKey: false,
      videoKbps: 4500,
      audioKbps: 160,
      encoder: "auto",
      rateControl: "cbr",
      preset: "veryfast",
      profile: "high",
      keyframeSec: 2,
      reconnect: true,
      retryDelaySec: 10,
      maxRetries: 20,
      confirmStart: false,
      confirmStop: true,
      recordWhileStreaming: false,
    },
    recording: { format: "mp4", videoKbps: 10000, audioKbps: 192, folder: null, fileName: "Grabación %fecha%" },
    video: { baseWidth: 1920, baseHeight: 1080, outWidth: 1920, outHeight: 1080, fps: 30, downscale: "bicubic" },
    audio: {
      sampleRate: 48000,
      channels: 2,
      micDevice: "",
      echoCancellation: true,
      noiseSuppression: true,
      autoGain: false,
      desktopAudio: true,
      noiseGate: false,
      gateThreshold: -45,
      compressor: false,
      micGainDb: 0,
    },
    hotkeys: { ...DEFAULT_HOTKEYS },
    transition: { kind: "fade", durationMs: 300 },
    general: { studioMode: false, showStats: true, confirmExit: true },
  };
}

export const SOURCE_LABEL: Record<SourceKind, string> = {
  screen: "Pantalla o ventana",
  camera: "Cámara",
  image: "Imagen",
  slideshow: "Presentación de imágenes",
  media: "Video o audio",
  text: "Texto",
  color: "Color",
};

export function newSource(kind: SourceKind, base: { w: number; h: number }, patch: Partial<StudioSource> = {}): StudioSource {
  const full = { x: 0, y: 0, w: base.w, h: base.h };
  const k = base.w / 1920;
  const layout: Partial<StudioSource> =
    kind === "camera"
      ? { x: Math.round(1420 * k), y: Math.round(730 * k), w: Math.round(460 * k), h: Math.round(310 * k), fit: "cover" }
      : kind === "text"
        ? { x: Math.round(160 * k), y: Math.round(880 * k), w: Math.round(1600 * k), h: Math.round(140 * k) }
        : full;
  return {
    id: newId("src"),
    kind,
    name: SOURCE_LABEL[kind],
    visible: true,
    locked: false,
    rotation: 0,
    flipH: false,
    flipV: false,
    radius: 0,
    round: false,
    fit: kind === "screen" || kind === "media" ? "contain" : "stretch",
    filters: structuredClone(DEFAULT_FILTERS),
    ...full,
    ...layout,
    ...(kind === "text"
      ? { text: "¡Bienvenidos al directo!", font: "Hanken Grotesk", size: Math.round(72 * k), color: "#ffffff", bold: true, outline: true, background: null, align: "center" as const }
      : {}),
    ...(kind === "color" ? { color: "#1d1410" } : {}),
    ...(kind === "media" ? { loop: true } : {}),
    ...(kind === "slideshow" ? { srcs: [], interval: 5 } : {}),
    ...patch,
  };
}

export function newDocument(): LiveDocument {
  const settings = defaultSettings();
  const base = { w: settings.video.baseWidth, h: settings.video.baseHeight };
  const main: Scene = {
    id: newId("scn"),
    name: "Escena principal",
    sources: [{ ...newSource("camera", base), name: "Cámara" }, { ...newSource("screen", base), name: "Pantalla" }],
  };
  const pause: Scene = {
    id: newId("scn"),
    name: "Pausa",
    sources: [
      { ...newSource("text", base), name: "Aviso", text: "Volvemos enseguida", y: Math.round(base.h / 2 - 80), h: 160, size: 96 },
      { ...newSource("color", base), name: "Fondo", color: "#3b1d0a" },
    ],
  };
  return { format: "coffeelive", version: 1, scenes: [main, pause], currentSceneId: main.id, settings };
}

function mergeDeep<T>(base: T, value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const current = out[k];
    if (current && typeof current === "object" && !Array.isArray(current)) out[k] = mergeDeep(current, v);
    else if (v !== undefined && (current === undefined || current === null || typeof v === typeof current)) out[k] = v;
  }
  return out as T;
}

/** Lee una colección guardada, completando lo que falte con los valores por omisión. */
export function parseDocument(text: string): LiveDocument {
  let raw: Partial<LiveDocument>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es una colección de escenas de CoffeeLive válida.");
  }
  if (!raw || raw.format !== "coffeelive") throw new Error("El archivo no es una colección de escenas de CoffeeLive válida.");
  const settings = mergeDeep(defaultSettings(), raw.settings);
  const base = { w: settings.video.baseWidth, h: settings.video.baseHeight };
  const scenes: Scene[] = (Array.isArray(raw.scenes) ? raw.scenes : [])
    .filter((s) => s && typeof s.id === "string" && Array.isArray(s.sources))
    .map((s) => ({
      id: s.id,
      name: typeof s.name === "string" ? s.name : "Escena",
      sources: s.sources
        .filter((src) => src && typeof src.id === "string" && typeof src.kind === "string")
        .map((src) => {
          const template = newSource(src.kind, base);
          return { ...template, ...src, filters: mergeDeep(template.filters, src.filters) };
        }),
    }));
  const doc = newDocument();
  const finalScenes = scenes.length ? scenes : doc.scenes;
  return {
    format: "coffeelive",
    version: 1,
    scenes: finalScenes,
    currentSceneId: finalScenes.some((s) => s.id === raw.currentSceneId) ? (raw.currentSceneId as string) : finalScenes[0].id,
    settings,
  };
}

export const serializeDocument = (doc: LiveDocument) => JSON.stringify(doc);

/** Escala todas las fuentes cuando cambia la resolución base. */
export function rescaleScenes(scenes: Scene[], from: { w: number; h: number }, to: { w: number; h: number }): Scene[] {
  const kx = to.w / from.w;
  const ky = to.h / from.h;
  if (kx === 1 && ky === 1) return scenes;
  return scenes.map((scene) => ({
    ...scene,
    sources: scene.sources.map((s) => ({
      ...s,
      x: Math.round(s.x * kx),
      y: Math.round(s.y * ky),
      w: Math.round(s.w * kx),
      h: Math.round(s.h * ky),
      size: s.size ? Math.round(s.size * Math.min(kx, ky)) : s.size,
    })),
  }));
}

/** Nombre de archivo de una grabación a partir del patrón (%fecha%, %hora%). */
export function recordingName(pattern: string, extension: string): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  let name = (pattern || "Grabación %fecha%").replace(/%fecha%/gi, `${date} ${time}`).replace(/%hora%/gi, time).replace(/%dia%/gi, date);
  if (!/%fecha%|%hora%/i.test(pattern || "")) name = `${name} ${date} ${time}`;
  return `${name.replace(/[<>:"/\\|?*]/g, "-").trim()}.${extension}`;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export const formatSize = (bytes: number) =>
  bytes > 1 << 30 ? `${(bytes / (1 << 30)).toFixed(2)} GB` : `${(bytes / (1 << 20)).toFixed(1)} MB`;
