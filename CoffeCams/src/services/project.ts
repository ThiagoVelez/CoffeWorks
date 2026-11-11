// Operaciones puras sobre el proyecto: crear, validar y editar clips.

import type {
  Adjustments,
  Clip,
  MediaClip,
  MediaItem,
  Project,
  Scene,
  StreamSettings,
  StudioSource,
  TextClip,
  Track,
  TrackKind,
  Transform,
} from "../types";

let counter = 0;
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const DEFAULT_ADJUST: Adjustments = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, grayscale: 0, sepia: 0 };
export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
export const IMAGE_DURATION = 5;
export const TEXT_DURATION = 4;
export const MIN_CLIP = 0.1;

export const DEFAULT_STREAM: StreamSettings = {
  service: "twitch",
  server: "rtmp://live.twitch.tv/app",
  videoKbps: 4500,
  audioKbps: 160,
  fps: 30,
  height: 1080,
};

export const newTrack = (kind: TrackKind, index: number): Track => ({
  id: newId("trk"),
  kind,
  name: kind === "video" ? `Video ${index}` : kind === "text" ? `Texto ${index}` : `Audio ${index}`,
  muted: false,
  hidden: false,
  locked: false,
});

export function defaultScene(width: number, height: number): Scene {
  return {
    id: newId("scn"),
    name: "Escena principal",
    sources: [
      {
        id: newId("src"),
        kind: "camera",
        name: "Cámara",
        visible: true,
        x: Math.round(width * 0.74),
        y: Math.round(height * 0.68),
        w: Math.round(width * 0.24),
        h: Math.round(height * 0.3),
        round: false,
      },
      { id: newId("src"), kind: "screen", name: "Pantalla", visible: true, x: 0, y: 0, w: width, h: height },
    ],
  };
}

export function newProject(): Project {
  const width = 1920;
  const height = 1080;
  return {
    format: "coffecams",
    version: 1,
    settings: { width, height, fps: 30, background: "#000000" },
    media: [],
    // De arriba abajo: lo de arriba se dibuja encima
    tracks: [newTrack("text", 1), newTrack("video", 2), newTrack("video", 1), newTrack("audio", 1)],
    clips: [],
    scenes: [defaultScene(width, height)],
    stream: { ...DEFAULT_STREAM },
  };
}

const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const str = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

/** Lee un proyecto guardado y descarta lo que no tenga la forma esperada. */
export function parseProject(text: string): Project {
  let raw: Partial<Project>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un proyecto de CoffeCams válido.");
  }
  if (!raw || raw.format !== "coffecams") throw new Error("El archivo no es un proyecto de CoffeCams válido.");
  const base = newProject();
  const settings = { ...base.settings, ...(raw.settings || {}) };
  const media: MediaItem[] = (Array.isArray(raw.media) ? raw.media : [])
    .filter((m) => m && typeof m.id === "string" && ["video", "audio", "image"].includes(m.kind))
    .map((m) => ({
      id: m.id,
      name: str(m.name, "Medio"),
      kind: m.kind,
      path: typeof m.path === "string" ? m.path : null,
      duration: num(m.duration, 0),
      width: num(m.width, 0),
      height: num(m.height, 0),
    }));
  const tracks: Track[] = (Array.isArray(raw.tracks) ? raw.tracks : [])
    .filter((t) => t && typeof t.id === "string" && ["video", "text", "audio"].includes(t.kind))
    .map((t) => ({ ...t, name: str(t.name, "Pista"), muted: !!t.muted, hidden: !!t.hidden, locked: !!t.locked }));
  const trackIds = new Set(tracks.map((t) => t.id));
  const mediaIds = new Set(media.map((m) => m.id));
  const clips: Clip[] = (Array.isArray(raw.clips) ? raw.clips : [])
    .filter((c) => c && typeof c.id === "string" && trackIds.has(c.trackId))
    .filter((c) => c.type === "text" || (c.type === "media" && mediaIds.has((c as MediaClip).mediaId)))
    .map((c) => {
      const common = {
        id: c.id,
        trackId: c.trackId,
        start: Math.max(0, num(c.start, 0)),
        duration: Math.max(MIN_CLIP, num(c.duration, 1)),
        fadeIn: Math.max(0, num(c.fadeIn, 0)),
        fadeOut: Math.max(0, num(c.fadeOut, 0)),
      };
      if (c.type === "text") {
        const t = c as TextClip;
        return { ...defaultText(), ...t, ...common, type: "text" } as TextClip;
      }
      const m = c as MediaClip;
      return {
        ...common,
        type: "media",
        mediaId: m.mediaId,
        in: Math.max(0, num(m.in, 0)),
        speed: Math.min(4, Math.max(0.25, num(m.speed, 1))),
        volume: Math.min(2, Math.max(0, num(m.volume, 1))),
        fit: m.fit === "cover" ? "cover" : "contain",
        transform: { ...DEFAULT_TRANSFORM, ...(m.transform || {}) },
        adjust: { ...DEFAULT_ADJUST, ...(m.adjust || {}) },
      } as MediaClip;
    });
  const scenes: Scene[] = (Array.isArray(raw.scenes) ? raw.scenes : [])
    .filter((s) => s && typeof s.id === "string" && Array.isArray(s.sources))
    .map((s) => ({
      id: s.id,
      name: str(s.name, "Escena"),
      sources: s.sources.filter((src: StudioSource) => src && typeof src.id === "string" && typeof src.kind === "string"),
    }));
  return {
    format: "coffecams",
    version: 1,
    settings,
    media,
    tracks: tracks.length ? tracks : base.tracks,
    clips,
    scenes: scenes.length ? scenes : [defaultScene(settings.width, settings.height)],
    stream: { ...DEFAULT_STREAM, ...(raw.stream || {}) },
  };
}

export const serializeProject = (project: Project) => JSON.stringify(project);

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export function defaultText(): Omit<TextClip, "id" | "trackId" | "start"> {
  return {
    type: "text",
    duration: TEXT_DURATION,
    fadeIn: 0.3,
    fadeOut: 0.3,
    text: "Tu título aquí",
    font: "Hanken Grotesk",
    size: 96,
    color: "#ffffff",
    bold: true,
    italic: false,
    align: "center",
    background: null,
    outline: true,
    x: 0.5,
    y: 0.5,
    animation: "fade",
  };
}

export const clipEnd = (clip: Clip) => clip.start + clip.duration;

export const projectDuration = (project: Project) => project.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);

/** Primer hueco libre en una pista a partir de `from` donde cabe `duration`. */
export function freeSlot(clips: Clip[], trackId: string, from: number, duration: number, ignoreId?: string): number {
  const others = clips
    .filter((c) => c.trackId === trackId && c.id !== ignoreId)
    .sort((a, b) => a.start - b.start);
  let start = Math.max(0, from);
  for (const c of others) {
    if (start + duration <= c.start + 1e-6) break;
    if (start < clipEnd(c) - 1e-6) start = clipEnd(c);
  }
  return start;
}

export function overlaps(clips: Clip[], trackId: string, start: number, duration: number, ignoreId?: string): boolean {
  return clips.some(
    (c) => c.trackId === trackId && c.id !== ignoreId && start < clipEnd(c) - 1e-6 && start + duration > c.start + 1e-6
  );
}

/** Divide un clip en el instante `time` (de la línea de tiempo). */
export function splitClip(clip: Clip, time: number): [Clip, Clip] | null {
  const offset = time - clip.start;
  if (offset < MIN_CLIP || clip.duration - offset < MIN_CLIP) return null;
  const left = { ...clip, duration: offset, fadeOut: 0 } as Clip;
  const right = { ...clip, id: newId("clip"), start: time, duration: clip.duration - offset, fadeIn: 0 } as Clip;
  if (right.type === "media") right.in = (clip as MediaClip).in + offset * (clip as MediaClip).speed;
  return [left, right];
}

/** Duración máxima de un clip de medio según lo que queda del archivo. */
export function maxDuration(clip: MediaClip, media: MediaItem | undefined): number {
  if (!media || media.kind === "image") return 3600;
  return Math.max(MIN_CLIP, (media.duration - clip.in) / clip.speed);
}

export function formatTime(seconds: number, withFrames = false, fps = 30): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const base = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  if (!withFrames) return base;
  const f = Math.floor((safe % 1) * fps);
  return `${base}:${f.toString().padStart(2, "0")}`;
}

export function cssFilter(a: Adjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
  if (a.saturation !== 100) parts.push(`saturate(${a.saturation}%)`);
  if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.blur) parts.push(`blur(${a.blur}px)`);
  if (a.grayscale) parts.push(`grayscale(${a.grayscale}%)`);
  if (a.sepia) parts.push(`sepia(${a.sepia}%)`);
  return parts.join(" ") || "none";
}

/** Filtros rápidos (como los de las apps de edición móvil). */
export const FILTER_PRESETS: { id: string; name: string; adjust: Partial<Adjustments> }[] = [
  { id: "none", name: "Original", adjust: {} },
  { id: "vivid", name: "Vívido", adjust: { saturation: 145, contrast: 115 } },
  { id: "warm", name: "Cálido", adjust: { sepia: 25, saturation: 120, hue: -8 } },
  { id: "cool", name: "Frío", adjust: { hue: 15, saturation: 95, brightness: 103 } },
  { id: "bw", name: "Blanco y negro", adjust: { grayscale: 100, contrast: 115 } },
  { id: "vintage", name: "Vintage", adjust: { sepia: 55, contrast: 90, brightness: 105 } },
  { id: "drama", name: "Dramático", adjust: { contrast: 150, saturation: 80, brightness: 92 } },
  { id: "soft", name: "Suave", adjust: { blur: 1, brightness: 108, contrast: 92 } },
];
