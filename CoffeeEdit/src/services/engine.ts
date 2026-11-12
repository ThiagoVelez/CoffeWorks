// Motor de reproducción del editor: sincroniza un elemento <video>/<audio>/<img>
// por clip con la línea de tiempo, compone el fotograma en un lienzo y mezcla
// el audio con Web Audio. La exportación graba ese mismo lienzo.

import type { Clip, MediaClip, MediaItem, Project, TextClip, Track } from "../types";
import { clipEnd, cssFilter, projectDuration } from "./project";
import { Ticker } from "./media";
import { drawVignette, gradeFilter } from "./color";

interface Slot {
  clipId: string;
  mediaId: string;
  el: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
  gain: GainNode | null;
  url: string;
}

const isMediaEl = (el: Slot["el"]): el is HTMLVideoElement | HTMLAudioElement => !(el instanceof HTMLImageElement);

export function fadeFactor(clip: Clip, t: number): number {
  const local = t - clip.start;
  const remaining = clipEnd(clip) - t;
  let f = 1;
  if (clip.fadeIn > 0) f = Math.min(f, Math.max(0, local / clip.fadeIn));
  if (clip.fadeOut > 0) f = Math.min(f, Math.max(0, remaining / clip.fadeOut));
  return f;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export interface TextBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Dibuja un título en el lienzo y devuelve su caja (para seleccionarlo). */
export function drawText(ctx: CanvasRenderingContext2D, clip: TextClip, t: number, W: number, H: number): TextBounds {
  const local = t - clip.start;
  const fade = fadeFactor(clip, t);
  const intro = Math.max(0.25, clip.fadeIn || 0.4);
  let alpha = clip.animation === "none" ? 1 : fade;
  let dy = 0;
  let scale = 1;
  let text = clip.text;
  if (clip.animation === "slide") dy = (1 - easeOut(Math.min(1, local / intro))) * H * 0.06;
  if (clip.animation === "pop") scale = 0.6 + 0.4 * easeBack(Math.min(1, local / intro));
  if (clip.animation === "typewriter") {
    const span = Math.max(0.4, Math.min(clip.duration * 0.6, text.length * 0.06));
    text = text.slice(0, Math.ceil(text.length * Math.min(1, local / span)));
    alpha = clip.fadeOut > 0 ? Math.min(1, Math.max(0, (clipEnd(clip) - t) / clip.fadeOut)) : 1;
  }

  ctx.save();
  ctx.font = `${clip.italic ? "italic " : ""}${clip.bold ? "700" : "400"} ${clip.size}px "${clip.font}", "Segoe UI", sans-serif`;
  ctx.textBaseline = "middle";
  const lines = text.split("\n");
  const fullLines = clip.text.split("\n");
  const lineHeight = clip.size * 1.2;
  const boxW = Math.max(...fullLines.map((l) => ctx.measureText(l || " ").width), clip.size);
  const boxH = fullLines.length * lineHeight;
  const cx = clip.x * W;
  const cy = clip.y * H + dy;
  const pad = clip.size * 0.3;
  const bounds = { x: cx - boxW / 2 - pad, y: clip.y * H - boxH / 2 - pad, w: boxW + pad * 2, h: boxH + pad * 2 };

  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (clip.background) {
    ctx.fillStyle = clip.background;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2 - pad, -boxH / 2 - pad, boxW + pad * 2, boxH + pad * 2, clip.size * 0.2);
    ctx.fill();
  }
  ctx.textAlign = clip.align;
  const anchor = clip.align === "center" ? 0 : clip.align === "left" ? -boxW / 2 : boxW / 2;
  lines.forEach((line, i) => {
    const y = -boxH / 2 + lineHeight * (i + 0.5);
    if (clip.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(2, clip.size * 0.09);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(line, anchor, y);
    }
    ctx.fillStyle = clip.color;
    ctx.fillText(line, anchor, y);
  });
  ctx.restore();
  return bounds;
}

export interface ExportOptions {
  mime: string;
  videoBitsPerSecond: number;
  onChunk: (blob: Blob) => void;
  onProgress: (fraction: number) => void;
  signal: { cancelled: boolean };
}

export class TimelineEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: Project | null = null;
  private media = new Map<string, MediaItem>();
  private tracks = new Map<string, Track>();
  private urls = new Map<string, string>();
  private slots = new Map<string, Slot>();
  private holder: HTMLDivElement;
  private audio: AudioContext | null = null;
  private master: GainNode | null = null;
  private raf = 0;
  private clockStart = 0;
  private ticker: Ticker | null = null;
  private exportEnd: (() => void) | null = null;
  playing = false;
  time = 0;
  onTime: ((t: number) => void) | null = null;
  onState: ((playing: boolean) => void) | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    // Los elementos de medios viven en el documento (invisibles) para que el
    // navegador no deje de decodificarlos.
    this.holder = document.createElement("div");
    this.holder.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(this.holder);
  }

  dispose() {
    this.pause();
    this.slots.forEach((slot) => this.dropSlot(slot));
    this.holder.remove();
    void this.audio?.close();
  }

  get duration() {
    return this.project ? projectDuration(this.project) : 0;
  }

  setUrls(urls: Map<string, string>) {
    this.urls = urls;
    if (this.project) this.setProject(this.project);
  }

  setProject(project: Project) {
    this.project = project;
    if (this.canvas.width !== project.settings.width || this.canvas.height !== project.settings.height) {
      this.canvas.width = project.settings.width;
      this.canvas.height = project.settings.height;
    }
    this.media = new Map(project.media.map((m) => [m.id, m]));
    this.tracks = new Map(project.tracks.map((t) => [t.id, t]));
    const wanted = new Set<string>();
    for (const clip of project.clips) {
      if (clip.type !== "media") continue;
      const item = this.media.get(clip.mediaId);
      const url = item ? this.urls.get(item.id) : undefined;
      if (!item || !url) continue;
      wanted.add(clip.id);
      const existing = this.slots.get(clip.id);
      if (existing && existing.url === url) continue;
      if (existing) this.dropSlot(existing);
      this.slots.set(clip.id, this.makeSlot(clip, item, url));
    }
    for (const [id, slot] of this.slots) {
      if (!wanted.has(id)) {
        this.dropSlot(slot);
        this.slots.delete(id);
      }
    }
    if (!this.playing) this.render();
  }

  private makeSlot(clip: MediaClip, item: MediaItem, url: string): Slot {
    let el: Slot["el"];
    if (item.kind === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => !this.playing && this.render();
      img.src = url;
      el = img;
    } else {
      const media = document.createElement(item.kind === "video" ? "video" : "audio");
      media.crossOrigin = "anonymous";
      media.preload = "auto";
      media.src = url;
      (media as HTMLVideoElement).playsInline = true;
      media.addEventListener("seeked", () => !this.playing && this.render());
      media.addEventListener("loadeddata", () => !this.playing && this.render());
      this.holder.appendChild(media);
      el = media;
    }
    const slot: Slot = { clipId: clip.id, mediaId: item.id, el, gain: null, url };
    this.attachAudio(slot);
    return slot;
  }

  private dropSlot(slot: Slot) {
    if (isMediaEl(slot.el)) {
      slot.el.pause();
      slot.el.removeAttribute("src");
      slot.el.load();
      slot.el.remove();
    }
    slot.gain?.disconnect();
  }

  private ensureAudio() {
    if (!this.audio) {
      this.audio = new AudioContext({ latencyHint: "playback" });
      this.master = this.audio.createGain();
      this.master.connect(this.audio.destination);
      this.slots.forEach((slot) => this.attachAudio(slot));
    }
    if (this.audio.state === "suspended") void this.audio.resume();
  }

  private attachAudio(slot: Slot) {
    if (!this.audio || !this.master || slot.gain || !isMediaEl(slot.el)) return;
    try {
      const source = this.audio.createMediaElementSource(slot.el);
      const gain = this.audio.createGain();
      source.connect(gain).connect(this.master);
      slot.gain = gain;
    } catch {
      slot.gain = null;
    }
  }

  // -------------------------------------------------------------------------
  // Reproducción
  // -------------------------------------------------------------------------

  play() {
    if (!this.project || this.playing) return;
    this.ensureAudio();
    if (this.time >= this.duration - 0.02) this.time = 0;
    this.playing = true;
    this.clockStart = performance.now() - this.time * 1000;
    this.onState?.(true);
    const loop = () => {
      if (!this.playing || this.ticker) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.slots.forEach((slot) => isMediaEl(slot.el) && slot.el.pause());
    this.onState?.(false);
    this.render();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    this.time = Math.max(0, Math.min(t, Math.max(this.duration, 0)));
    if (this.playing) this.clockStart = performance.now() - this.time * 1000;
    this.render();
    this.onTime?.(this.time);
  }

  private frame() {
    const t = (performance.now() - this.clockStart) / 1000;
    const end = this.duration;
    if (t >= end) {
      this.time = end;
      this.sync(end);
      this.draw(end);
      this.onTime?.(end);
      if (this.exportEnd) this.exportEnd();
      else this.pause();
      return;
    }
    this.time = t;
    this.sync(t);
    this.draw(t);
    this.onTime?.(t);
  }

  render() {
    this.sync(this.time);
    this.draw(this.time);
  }

  /** Coloca cada elemento en su instante y ajusta volumen y velocidad. */
  private sync(t: number) {
    if (!this.project) return;
    for (const clip of this.project.clips) {
      if (clip.type !== "media") continue;
      const slot = this.slots.get(clip.id);
      if (!slot || !isMediaEl(slot.el)) continue;
      const el = slot.el;
      const track = this.tracks.get(clip.trackId);
      const active = t >= clip.start && t < clipEnd(clip);
      const local = clip.in + (t - clip.start) * clip.speed;
      if (active) {
        const volume = track?.muted ? 0 : clip.volume * fadeFactor(clip, t);
        if (slot.gain) {
          el.volume = 1;
          slot.gain.gain.value = volume;
        } else {
          el.volume = Math.min(1, volume);
        }
        if (el.playbackRate !== clip.speed) el.playbackRate = clip.speed;
        if (this.playing) {
          if (el.paused) {
            el.currentTime = local;
            void el.play().catch(() => undefined);
          } else if (Math.abs(el.currentTime - local) > 0.3) {
            el.currentTime = local;
          }
        } else {
          if (!el.paused) el.pause();
          if (!el.seeking && Math.abs(el.currentTime - local) > 0.02) el.currentTime = local;
        }
      } else {
        if (!el.paused) el.pause();
        // Se prepara el clip siguiente para que empiece sin saltos
        if (t < clip.start && clip.start - t < 1.5 && !el.seeking && Math.abs(el.currentTime - clip.in) > 0.05) {
          el.currentTime = clip.in;
        }
      }
    }
  }

  /** Compone el fotograma del instante `t`. */
  draw(t: number) {
    const ctx = this.ctx;
    const project = this.project;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = project?.settings.background || "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (!project) return;
    // Las pistas de arriba se dibujan encima: se recorren de abajo arriba
    const tracks = [...project.tracks].reverse().filter((tr) => tr.kind !== "audio" && !tr.hidden);
    for (const track of tracks) {
      for (const clip of project.clips) {
        if (clip.trackId !== track.id || t < clip.start || t >= clipEnd(clip)) continue;
        if (clip.type === "text") drawText(ctx, clip, t, W, H);
        else this.drawMedia(clip, t, W, H);
      }
    }
  }

  private drawMedia(clip: MediaClip, t: number, W: number, H: number, nested = false) {
    const slot = this.slots.get(clip.id);
    if (!slot) return;
    const el = slot.el;
    let sw = 0;
    let sh = 0;
    if (el instanceof HTMLVideoElement) {
      if (el.readyState < 2) return;
      sw = el.videoWidth;
      sh = el.videoHeight;
    } else if (el instanceof HTMLImageElement) {
      if (!el.complete || !el.naturalWidth) return;
      sw = el.naturalWidth;
      sh = el.naturalHeight;
    } else {
      return; // audio
    }
    if (!sw || !sh) return;
    const ctx = this.ctx;
    // Transición al principio del clip
    const tr = !nested && clip.transition ? clip.transition : null;
    const u = tr && t < clip.start + tr.duration ? Math.max(0, Math.min(1, (t - clip.start) / tr.duration)) : 1;
    if (tr && u < 1 && tr.kind === "dissolve") {
      // El clip anterior de la pista, congelado en su último fotograma, debajo
      const prev = this.project?.clips.find((c) => c.trackId === clip.trackId && c.type === "media" && Math.abs(clipEnd(c) - clip.start) < 0.05) as MediaClip | undefined;
      if (prev) this.drawMedia(prev, clipEnd(prev) - 0.001, W, H, true);
    }
    const eased = 1 - Math.pow(1 - u, 3);
    const base = clip.fit === "cover" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
    let s = base * clip.transform.scale;
    if (tr && u < 1 && tr.kind === "zoom") s *= 1.35 - 0.35 * eased;
    const dw = sw * s;
    const dh = sh * s;
    ctx.save();
    let alpha = clip.transform.opacity * fadeFactor(clip, t);
    if (tr && u < 1 && (tr.kind === "dissolve" || tr.kind === "zoom")) alpha *= u;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const css = cssFilter(clip.adjust);
    const grade = gradeFilter(clip.color);
    const filter = [css !== "none" ? css : "", grade].filter(Boolean).join(" ");
    if (filter) ctx.filter = filter;
    let x = W / 2 + clip.transform.x * W;
    if (tr && u < 1 && tr.kind === "slide") x += (1 - eased) * W;
    ctx.translate(x, H / 2 + clip.transform.y * H);
    if (clip.transform.rotation) ctx.rotate((clip.transform.rotation * Math.PI) / 180);
    if (tr && u < 1 && tr.kind === "wipe") {
      ctx.beginPath();
      ctx.rect(-dw / 2, -dh / 2, dw * eased, dh);
      ctx.clip();
    }
    ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh);
    drawVignette(ctx, clip, dw, dh);
    ctx.restore();
    if (tr && u < 1 && (tr.kind === "dipBlack" || tr.kind === "dipWhite")) {
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = tr.kind === "dipBlack" ? "#000" : "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // Exportación
  // -------------------------------------------------------------------------

  private async waitReady(timeoutMs = 4000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      const pending = [...this.slots.values()].some(
        (slot) => slot.el instanceof HTMLVideoElement && (slot.el.readyState < 2 || slot.el.seeking)
      );
      if (!pending) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /** Reproduce el proyecto completo y lo graba en tiempo real. */
  async export(options: ExportOptions): Promise<void> {
    const project = this.project;
    if (!project || this.duration <= 0) throw new Error("La línea de tiempo está vacía.");
    this.pause();
    this.ensureAudio();
    const audio = this.audio as AudioContext;
    const master = this.master as GainNode;
    const destination = audio.createMediaStreamDestination();
    master.connect(destination);
    master.disconnect(audio.destination); // silencio en los altavoces durante la exportación

    this.time = 0;
    this.render();
    await this.waitReady();
    this.render();

    const fps = project.settings.fps;
    const stream = this.canvas.captureStream(fps);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, {
      mimeType: options.mime,
      videoBitsPerSecond: options.videoBitsPerSecond,
      audioBitsPerSecond: 192_000,
    });
    recorder.ondataavailable = (e) => options.onChunk(e.data);
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

    const total = this.duration;
    try {
      await new Promise<void>((resolve) => {
        this.exportEnd = resolve;
        recorder.start(1000);
        this.playing = true;
        this.onState?.(true);
        this.clockStart = performance.now();
        this.ticker = new Ticker();
        this.ticker.start(1000 / fps, () => {
          if (options.signal.cancelled) {
            resolve();
            return;
          }
          this.frame();
          options.onProgress(Math.min(1, this.time / total));
        });
      });
    } finally {
      this.ticker?.stop();
      this.ticker = null;
      this.exportEnd = null;
      this.playing = false;
      this.slots.forEach((slot) => isMediaEl(slot.el) && slot.el.pause());
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());
      master.disconnect(destination);
      master.connect(audio.destination);
      this.onState?.(false);
      this.render();
    }
  }
}
