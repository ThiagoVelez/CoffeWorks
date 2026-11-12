// Ajustes preestablecidos y traducción de los ajustes a argumentos de FFmpeg.

import type { Container, EncodeSettings, Preset, SourceInfo, VideoCodec } from "../types";

export const BASE: EncodeSettings = {
  container: "mp4",
  vcodec: "h264",
  hardware: "none",
  width: 0,
  height: 0,
  fit: "fit",
  fps: 0,
  rateMode: "crf",
  crf: 21,
  bitrate: 8000,
  speed: "medium",
  proresProfile: 2,
  acodec: "aac",
  abitrate: 192,
  sampleRate: 0,
  channels: 0,
  loudnorm: false,
  loudness: -14,
  deinterlace: false,
  rotate: 0,
  watermark: "",
  watermarkPos: "br",
  trimIn: 0,
  trimOut: 0,
  frameAt: 1,
};

const p = (id: string, category: string, name: string, description: string, s: Partial<EncodeSettings>, browser = false): Preset => ({
  id,
  category,
  name,
  description,
  settings: { ...BASE, ...s },
  browser,
});

export const PRESETS: Preset[] = [
  // Video
  p("h264-source", "Video", "H.264 · igual que el original", "MP4 H.264 + AAC con la resolución y los fotogramas del original. El más compatible.", {}),
  p("h264-1080", "Video", "H.264 · 1080p", "MP4 1920×1080, calidad alta.", { width: 1920, height: 1080 }),
  p("h264-720", "Video", "H.264 · 720p", "MP4 1280×720, archivo más ligero.", { width: 1280, height: 720, crf: 23 }),
  p("hevc-source", "Video", "HEVC (H.265)", "La mitad de tamaño que H.264 con la misma calidad.", { vcodec: "hevc", crf: 24 }),
  p("av1", "Video", "AV1", "Códec abierto de última generación: archivos muy pequeños (codifica despacio).", { container: "mkv", vcodec: "av1", crf: 32, acodec: "opus", abitrate: 128 }),
  p("prores", "Video", "ProRes 422 (edición y archivo)", "MOV ProRes 422 + PCM: para editar o archivar sin pérdida visible.", { container: "mov", vcodec: "prores", acodec: "pcm" }),
  p("webm", "Video", "WebM VP9 (web)", "Para publicar en páginas web.", { container: "webm", vcodec: "vp9", crf: 33, acodec: "opus", abitrate: 128 }),
  p("webm-browser", "Video", "WebM (sin FFmpeg)", "Se convierte en el propio programa, en tiempo real (tarda lo que dura el video).", { container: "webm", vcodec: "vp9", acodec: "opus", rateMode: "bitrate", bitrate: 5000, abitrate: 128 }, true),
  p("remux-mp4", "Video", "Cambiar contenedor a MP4 (sin recodificar)", "Copia los flujos tal cual a un MP4: instantáneo y sin pérdida (si los códecs lo permiten).", { vcodec: "copy", acodec: "copy" }),
  // Redes sociales
  p("youtube-1080", "Redes sociales", "YouTube 1080p", "Ajustes recomendados por YouTube para 1080p: H.264 alto perfil, 12 Mbps, AAC 384 kbps.", { width: 1920, height: 1080, rateMode: "bitrate", bitrate: 12000, abitrate: 384, sampleRate: 48000, loudnorm: true, loudness: -14 }),
  p("youtube-4k", "Redes sociales", "YouTube 4K", "3840×2160 a 45 Mbps.", { width: 3840, height: 2160, rateMode: "bitrate", bitrate: 45000, abitrate: 384, sampleRate: 48000 }),
  p("reels", "Redes sociales", "Instagram Reels / TikTok (9:16)", "1080×1920 vertical, rellenando el cuadro.", { width: 1080, height: 1920, fit: "fill", fps: 30, rateMode: "bitrate", bitrate: 8000, loudnorm: true }),
  p("insta-square", "Redes sociales", "Instagram cuadrado (1:1)", "1080×1080 recortado al centro.", { width: 1080, height: 1080, fit: "fill", fps: 30, rateMode: "bitrate", bitrate: 6000 }),
  p("insta-45", "Redes sociales", "Instagram vertical (4:5)", "1080×1350.", { width: 1080, height: 1350, fit: "fill", fps: 30, rateMode: "bitrate", bitrate: 6000 }),
  p("x-720", "Redes sociales", "X (Twitter) 720p", "1280×720, 30 fps, 5 Mbps.", { width: 1280, height: 720, fps: 30, rateMode: "bitrate", bitrate: 5000, abitrate: 128 }),
  p("facebook", "Redes sociales", "Facebook 1080p", "1920×1080, 30 fps, 8 Mbps.", { width: 1920, height: 1080, fps: 30, rateMode: "bitrate", bitrate: 8000 }),
  p("whatsapp", "Redes sociales", "WhatsApp (ligero)", "854×480 para enviar por mensajería.", { width: 854, height: 480, crf: 28, speed: "fast", abitrate: 96, fps: 30 }),
  // Dispositivos
  p("phone", "Dispositivos", "Teléfono (1080p)", "H.264 perfil alto compatible con iPhone y Android.", { width: 1920, height: 1080, crf: 22 }),
  p("tablet", "Dispositivos", "Tableta (720p)", "1280×720.", { width: 1280, height: 720, crf: 23 }),
  p("tv-4k", "Dispositivos", "Televisor 4K (HEVC)", "3840×2160 H.265.", { vcodec: "hevc", width: 3840, height: 2160, crf: 22 }),
  // Audio
  p("mp3-320", "Solo audio", "MP3 320 kbps", "La mejor calidad en MP3.", { container: "mp3", vcodec: "none", acodec: "mp3", abitrate: 320 }),
  p("mp3-192", "Solo audio", "MP3 192 kbps", "Equilibrio entre tamaño y calidad.", { container: "mp3", vcodec: "none", acodec: "mp3", abitrate: 192 }),
  p("aac-256", "Solo audio", "AAC 256 kbps (M4A)", "Calidad alta en M4A.", { container: "m4a", vcodec: "none", acodec: "aac", abitrate: 256 }),
  p("podcast", "Solo audio", "Pódcast (MP3 mono, −16 LUFS)", "Voz en mono a 96 kbps con sonoridad normalizada para pódcast.", { container: "mp3", vcodec: "none", acodec: "mp3", abitrate: 96, channels: 1, sampleRate: 44100, loudnorm: true, loudness: -16 }),
  p("wav", "Solo audio", "WAV (sin compresión)", "PCM 16 bits.", { container: "wav", vcodec: "none", acodec: "pcm" }, true),
  p("flac", "Solo audio", "FLAC (sin pérdida)", "Comprimido sin pérdida.", { container: "flac", vcodec: "none", acodec: "flac" }),
  p("ogg", "Solo audio", "OGG Vorbis", "Formato abierto.", { container: "ogg", vcodec: "none", acodec: "vorbis", abitrate: 192 }),
  p("opus", "Solo audio", "Opus", "Muy eficiente a tasas bajas.", { container: "opus", vcodec: "none", acodec: "opus", abitrate: 96 }),
  // Imagen
  p("gif", "Imagen", "GIF animado (480 px)", "GIF con paleta optimizada a 15 fps.", { container: "gif", vcodec: "gif", acodec: "none", width: 480, height: 0, fps: 15 }),
  p("gif-hq", "Imagen", "GIF animado (720 px)", "Más grande y fluido (24 fps).", { container: "gif", vcodec: "gif", acodec: "none", width: 720, height: 0, fps: 24 }),
  p("thumb-jpg", "Imagen", "Miniatura JPG", "Un fotograma (elige el segundo en los ajustes).", { container: "jpg", vcodec: "mjpeg", acodec: "none", frameAt: 1 }, true),
  p("thumb-png", "Imagen", "Fotograma PNG", "Un fotograma sin pérdida.", { container: "png", vcodec: "png", acodec: "none", frameAt: 1 }, true),
];

export const CATEGORIES = ["Video", "Redes sociales", "Dispositivos", "Solo audio", "Imagen", "Mis ajustes"];

export const CONTAINER_LABEL: Record<Container, string> = {
  mp4: "MP4",
  mov: "QuickTime (MOV)",
  mkv: "Matroska (MKV)",
  webm: "WebM",
  gif: "GIF animado",
  mp3: "MP3",
  m4a: "M4A (AAC)",
  wav: "WAV",
  flac: "FLAC",
  ogg: "OGG",
  opus: "Opus",
  jpg: "Imagen JPG",
  png: "Imagen PNG",
};

/** Códecs válidos para cada contenedor. */
export const CONTAINER_CODECS: Record<Container, { v: VideoCodec[]; a: EncodeSettings["acodec"][] }> = {
  mp4: { v: ["h264", "hevc", "av1", "copy"], a: ["aac", "mp3", "opus", "copy", "none"] },
  mov: { v: ["h264", "hevc", "prores", "copy"], a: ["aac", "pcm", "copy", "none"] },
  mkv: { v: ["h264", "hevc", "vp9", "av1", "copy"], a: ["aac", "opus", "vorbis", "flac", "mp3", "copy", "none"] },
  webm: { v: ["vp9", "av1"], a: ["opus", "vorbis", "none"] },
  gif: { v: ["gif"], a: ["none"] },
  mp3: { v: ["none"], a: ["mp3"] },
  m4a: { v: ["none"], a: ["aac"] },
  wav: { v: ["none"], a: ["pcm"] },
  flac: { v: ["none"], a: ["flac"] },
  ogg: { v: ["none"], a: ["vorbis", "opus"] },
  opus: { v: ["none"], a: ["opus"] },
  jpg: { v: ["mjpeg"], a: ["none"] },
  png: { v: ["png"], a: ["none"] },
};

export const VCODEC_LABEL: Record<VideoCodec, string> = {
  h264: "H.264 (AVC)",
  hevc: "H.265 (HEVC)",
  vp9: "VP9",
  av1: "AV1",
  prores: "Apple ProRes",
  gif: "GIF",
  mjpeg: "JPEG",
  png: "PNG",
  copy: "Copiar sin recodificar",
  none: "Sin video",
};

export const ACODEC_LABEL: Record<EncodeSettings["acodec"], string> = {
  aac: "AAC",
  mp3: "MP3",
  opus: "Opus",
  vorbis: "Vorbis",
  flac: "FLAC",
  pcm: "PCM sin compresión",
  copy: "Copiar sin recodificar",
  none: "Sin audio",
};

export const isStill = (s: EncodeSettings) => s.container === "jpg" || s.container === "png";
export const isAudioOnly = (s: EncodeSettings) => s.vcodec === "none";

/** Ajusta códecs incompatibles después de cambiar el contenedor. */
export function normalizeSettings(s: EncodeSettings): EncodeSettings {
  const c = CONTAINER_CODECS[s.container];
  const out = { ...s };
  if (!c.v.includes(out.vcodec)) out.vcodec = c.v[0];
  if (!c.a.includes(out.acodec)) out.acodec = c.a[0];
  if (out.vcodec !== "h264" && out.vcodec !== "hevc" && out.vcodec !== "av1") out.hardware = "none";
  return out;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Filtros de video (escala, encuadre, giro, marca de agua...). */
function videoFilters(s: EncodeSettings, info: SourceInfo | null): string[] {
  const f: string[] = [];
  if (s.deinterlace) f.push("yadif");
  if (s.rotate === 90) f.push("transpose=1");
  else if (s.rotate === 180) f.push("transpose=1,transpose=1");
  else if (s.rotate === 270) f.push("transpose=2");
  if (s.fps && s.vcodec !== "gif") f.push(`fps=${s.fps}`);
  const w = s.width;
  const h = s.height;
  if (w && h) {
    const W = even(w);
    const H = even(h);
    if (s.fit === "stretch") f.push(`scale=${W}:${H}`, "setsar=1");
    else if (s.fit === "fill") f.push(`scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`, "setsar=1");
    else f.push(`scale=${W}:${H}:force_original_aspect_ratio=decrease`, `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`, "setsar=1");
  } else if (w) f.push(`scale=${even(w)}:-2`);
  else if (h) f.push(`scale=-2:${even(h)}`);
  else if (info && (info.width % 2 || info.height % 2) && ["h264", "hevc", "av1"].includes(s.vcodec)) f.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
  if (s.watermark.trim()) {
    const pos: Record<EncodeSettings["watermarkPos"], string> = {
      tl: "x=24:y=24",
      tr: "x=w-tw-24:y=24",
      bl: "x=24:y=h-th-24",
      br: "x=w-tw-24:y=h-th-24",
      c: "x=(w-tw)/2:y=(h-th)/2",
    };
    const text = s.watermark.replace(/\\/g, "\\\\\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "\\%");
    f.push(`drawtext=text='${text}':fontcolor=white@0.8:fontsize=h/22:borderw=2:bordercolor=black@0.5:${pos[s.watermarkPos]}`);
  }
  return f;
}

function videoCodecArgs(s: EncodeSettings): string[] {
  const hw = s.hardware;
  const crf = String(s.crf);
  const br = `${s.bitrate}k`;
  const vbv = s.rateMode === "bitrate" ? ["-maxrate", `${Math.round(s.bitrate * 1.5)}k`, "-bufsize", `${s.bitrate * 2}k`] : [];
  switch (s.vcodec) {
    case "copy":
      return ["-c:v", "copy"];
    case "h264":
    case "hevc": {
      const x = s.vcodec === "h264" ? "264" : "265";
      if (hw === "nvenc") return ["-c:v", `${s.vcodec === "h264" ? "h264" : "hevc"}_nvenc`, "-preset", "p5", ...(s.rateMode === "crf" ? ["-rc", "vbr", "-cq", crf, "-b:v", "0"] : ["-b:v", br, ...vbv]), "-pix_fmt", "yuv420p"];
      if (hw === "qsv") return ["-c:v", `${s.vcodec === "h264" ? "h264" : "hevc"}_qsv`, ...(s.rateMode === "crf" ? ["-global_quality", crf] : ["-b:v", br, ...vbv]), "-pix_fmt", "nv12"];
      if (hw === "amf") return ["-c:v", `${s.vcodec === "h264" ? "h264" : "hevc"}_amf`, ...(s.rateMode === "crf" ? ["-rc", "cqp", "-qp_i", crf, "-qp_p", crf] : ["-b:v", br, ...vbv]), "-pix_fmt", "yuv420p"];
      return [
        "-c:v",
        `libx${x}`,
        "-preset",
        s.speed,
        ...(s.rateMode === "crf" ? ["-crf", crf] : ["-b:v", br, ...vbv]),
        "-pix_fmt",
        "yuv420p",
        ...(s.vcodec === "hevc" ? ["-tag:v", "hvc1"] : ["-profile:v", "high"]),
      ];
    }
    case "vp9":
      return ["-c:v", "libvpx-vp9", "-row-mt", "1", "-deadline", "good", "-cpu-used", s.speed === "slow" || s.speed === "veryslow" ? "1" : "3", ...(s.rateMode === "crf" ? ["-crf", crf, "-b:v", "0"] : ["-b:v", br]), "-pix_fmt", "yuv420p"];
    case "av1":
      if (hw === "nvenc") return ["-c:v", "av1_nvenc", "-cq", crf, "-pix_fmt", "yuv420p"];
      return ["-c:v", "libsvtav1", "-preset", s.speed === "veryslow" || s.speed === "slow" ? "6" : s.speed === "medium" ? "8" : "10", ...(s.rateMode === "crf" ? ["-crf", crf] : ["-b:v", br]), "-pix_fmt", "yuv420p"];
    case "prores":
      return ["-c:v", "prores_ks", "-profile:v", String(s.proresProfile), "-pix_fmt", "yuv422p10le", "-vendor", "apl0"];
    case "mjpeg":
      return ["-c:v", "mjpeg", "-q:v", "2", "-frames:v", "1"];
    case "png":
      return ["-c:v", "png", "-frames:v", "1"];
    default:
      return [];
  }
}

function audioArgs(s: EncodeSettings): string[] {
  if (s.acodec === "none") return ["-an"];
  if (s.acodec === "copy") return ["-c:a", "copy"];
  const codec: Record<string, string[]> = {
    aac: ["-c:a", "aac", "-b:a", `${s.abitrate}k`],
    mp3: ["-c:a", "libmp3lame", "-b:a", `${s.abitrate}k`],
    opus: ["-c:a", "libopus", "-b:a", `${s.abitrate}k`],
    vorbis: ["-c:a", "libvorbis", "-b:a", `${s.abitrate}k`],
    flac: ["-c:a", "flac"],
    pcm: ["-c:a", s.container === "mov" ? "pcm_s24le" : "pcm_s16le"],
  };
  const out = [...codec[s.acodec]];
  const rate = s.sampleRate || (s.acodec === "opus" ? 48000 : 0);
  if (rate) out.push("-ar", String(rate));
  if (s.channels) out.push("-ac", String(s.channels));
  if (s.loudnorm) out.push("-af", `loudnorm=I=${s.loudness}:TP=-1.5:LRA=11`);
  return out;
}

/**
 * Argumentos de FFmpeg para una salida. Con `progress` se añade
 * `-progress pipe:1` para seguir el avance.
 */
export function buildArgs(input: string, output: string, s: EncodeSettings, info: SourceInfo | null, progress = true): string[] {
  const args = ["-hide_banner", "-y"];
  if (progress) args.push("-nostats", "-progress", "pipe:1");
  const still = isStill(s);
  if (still) args.push("-ss", String(Math.max(0, s.frameAt)));
  else if (s.trimIn > 0) args.push("-ss", String(s.trimIn));
  args.push("-i", input);
  if (!still && s.trimOut > 0 && s.trimOut > s.trimIn) args.push("-t", String(+(s.trimOut - s.trimIn).toFixed(3)));
  if (s.vcodec === "none") {
    args.push("-vn");
  } else if (s.vcodec === "gif") {
    const vf = videoFilters({ ...s, watermark: s.watermark }, info);
    const fps = s.fps || 15;
    const chain = [`fps=${fps}`, ...vf.filter((x) => !x.startsWith("fps=")).map((x) => (x.startsWith("scale=") && !x.includes(":flags") ? `${x}:flags=lanczos` : x))].join(",");
    args.push("-filter_complex", `[0:v]${chain},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0");
  } else if (s.vcodec !== "copy") {
    const vf = videoFilters(s, info);
    if (vf.length) args.push("-vf", vf.join(","));
    if (s.fps && !vf.some((x) => x.startsWith("fps="))) args.push("-r", String(s.fps));
  }
  args.push(...videoCodecArgs(s));
  if (still || s.vcodec === "gif") args.push("-an");
  else args.push(...audioArgs(s));
  if (s.container === "mp4" || s.container === "mov" || s.container === "m4a") args.push("-movflags", "+faststart");
  if (still) args.push("-update", "1");
  args.push(output);
  return args;
}

/** Línea de comandos legible (para «Ver comando»). */
export const commandLine = (args: string[]) => ["ffmpeg", ...args.map((a) => (/[\s'"(),;[\]]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))].join(" ");

export const extensionFor = (s: EncodeSettings) => s.container;

/** Duración que tendrá la salida (para el porcentaje de avance). */
export function outputDuration(s: EncodeSettings, info: SourceInfo | null): number {
  const d = info?.duration || 0;
  const end = s.trimOut > 0 ? Math.min(d || s.trimOut, s.trimOut) : d;
  return Math.max(0, end - Math.max(0, s.trimIn));
}

/** Tamaño estimado en bytes (null si no se puede calcular). */
export function estimateSize(s: EncodeSettings, info: SourceInfo | null): number | null {
  const d = outputDuration(s, info);
  if (!d || isStill(s)) return null;
  const audio = s.acodec === "none" ? 0 : s.acodec === "pcm" ? 1536 : s.acodec === "flac" ? 900 : s.acodec === "copy" ? 192 : s.abitrate;
  let video = 0;
  if (s.vcodec !== "none") {
    if (s.rateMode === "bitrate" && s.vcodec !== "prores" && s.vcodec !== "gif" && s.vcodec !== "copy") video = s.bitrate;
    else {
      const w = s.width || info?.width || 1920;
      const h = s.height || (s.width && info?.width ? Math.round((info.height * s.width) / info.width) : info?.height || 1080);
      const fps = s.fps || info?.fps || 30;
      const px = w * h * fps;
      if (s.vcodec === "copy") video = info?.bitrate ? info.bitrate - audio : 8000;
      else if (s.vcodec === "prores") video = (px * [0.6, 1.4, 2.1, 3.1][s.proresProfile]) / 1000;
      else if (s.vcodec === "gif") video = (px * 0.35) / 1000;
      else {
        // Bits por píxel aproximados según el códec y la calidad
        const eff = s.vcodec === "h264" ? 1 : s.vcodec === "hevc" ? 0.6 : s.vcodec === "vp9" ? 0.65 : 0.5;
        const ref = s.vcodec === "h264" ? 23 : s.vcodec === "hevc" ? 28 : s.vcodec === "vp9" ? 33 : 32;
        video = ((px * 0.075 * eff) / 1000) * Math.pow(2, (ref - s.crf) / 6);
      }
    }
  }
  return ((video + audio) * 1000 * d) / 8;
}

export const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);

export const fmtDuration = (t: number) => {
  if (!isFinite(t) || t < 0) return "--:--";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/** Interpreta la salida de `ffmpeg -i`. */
export function parseProbe(text: string): SourceInfo | null {
  const info: SourceInfo = { duration: 0, width: 0, height: 0, fps: 0, vcodec: "", acodec: "", sampleRate: 0, channels: 0, bitrate: 0, hasVideo: false, hasAudio: false };
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(text);
  if (dur) info.duration = +dur[1] * 3600 + +dur[2] * 60 + +dur[3];
  const br = /bitrate:\s*(\d+)\s*kb\/s/.exec(text);
  if (br) info.bitrate = +br[1];
  for (const line of text.split(/\r?\n/)) {
    const v = /Stream #\S+.*?Video:\s*(\w+)/.exec(line);
    if (v && !info.hasVideo && !/attached pic/.test(line)) {
      info.hasVideo = true;
      info.vcodec = v[1];
      const size = /,\s*(\d{2,5})x(\d{2,5})/.exec(line);
      if (size) {
        info.width = +size[1];
        info.height = +size[2];
      }
      const fps = /([\d.]+)\s*fps/.exec(line) || /([\d.]+)\s*tbr/.exec(line);
      if (fps) info.fps = +fps[1];
    }
    const a = /Stream #\S+.*?Audio:\s*(\w+)/.exec(line);
    if (a && !info.hasAudio) {
      info.hasAudio = true;
      info.acodec = a[1];
      const hz = /(\d+)\s*Hz/.exec(line);
      if (hz) info.sampleRate = +hz[1];
      info.channels = /mono/.test(line) ? 1 : /stereo/.test(line) ? 2 : /5\.1/.test(line) ? 6 : 2;
    }
  }
  if (!info.hasVideo && !info.hasAudio) return null;
  return info;
}
