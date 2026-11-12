// Sesión de CoffeeSound: archivo .csn, reproducción (forma de onda y
// multipista con efectos en tiempo real) y mezcla final.

import type { Asset, Clip, Session, Track } from "../types";
import { TRACK_COLORS } from "../types";
import { audioContext, buildChain, dbToGain, effectTail, fromBuffer, fromDataUrl, getBuffer, toDataUrl } from "./audio";
import { newId } from "../studio/color";

export { newId };

export function newSession(): Session {
  return { version: 1, sampleRate: 48000, assets: [], tracks: [newTrack(0), newTrack(1)], masterVolume: 0, markers: [], activeAsset: null, mode: "waveform" };
}

export function newTrack(i: number): Track {
  return { id: newId("tr"), name: `Pista ${i + 1}`, color: TRACK_COLORS[i % TRACK_COLORS.length], volume: 0, pan: 0, mute: false, solo: false, effects: [], clips: [] };
}

export function assetFrom(buf: AudioBuffer, name: string): Asset {
  return { id: newId("as"), name, data: fromBuffer(buf), duration: buf.duration, sampleRate: buf.sampleRate, channels: buf.numberOfChannels };
}

export const serializeSession = (s: Session) => JSON.stringify({ app: "CoffeeSound", ...s, assets: s.assets.map((a) => ({ ...a, data: toDataUrl(a.data) })) });

export function parseSession(text: string): Session {
  const raw = JSON.parse(text);
  const base = newSession();
  return {
    ...base,
    ...raw,
    version: 1,
    assets: (raw.assets || []).map((a: Asset) => ({ ...a, data: typeof a.data === "string" && a.data.startsWith("data:") ? fromDataUrl(a.data) : fromBuffer(audioContext().createBuffer(1, 1, 48000)) })),
    tracks: raw.tracks?.length ? raw.tracks : base.tracks,
    markers: raw.markers || [],
  };
}

export const sessionTokens = (s: Session) => s.assets.map((a) => a.data);

export function sessionLength(s: Session): number {
  return Math.max(0, ...s.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)));
}

// ---------------------------------------------------------------------------
// Reproducción
// ---------------------------------------------------------------------------

type Graph = { stop: () => void };

/** Programa un clip en un contexto (en tiempo real o sin conexión). */
function scheduleClip(c: BaseAudioContext, dest: AudioNode, clip: Clip, buf: AudioBuffer, when: number, from: number) {
  // `from`: segundo de la línea de tiempo desde el que se reproduce
  const clipEnd = clip.start + clip.duration;
  if (clipEnd <= from) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const gain = dbToGain(clip.gain);
  const startAt = Math.max(clip.start, from);
  const offset = clip.offset + (startAt - clip.start);
  const dur = clipEnd - startAt;
  const t0 = when + (startAt - from);
  // Fundidos
  const fi = Math.min(clip.fadeIn, clip.duration / 2);
  const fo = Math.min(clip.fadeOut, clip.duration / 2);
  const local = startAt - clip.start;
  g.gain.setValueAtTime(fi && local < fi ? gain * (local / fi) : gain, t0);
  if (fi && local < fi) g.gain.linearRampToValueAtTime(gain, t0 + (fi - local));
  if (fo) {
    const foStart = Math.max(t0, when + (clipEnd - fo - from));
    g.gain.setValueAtTime(gain, foStart);
    g.gain.linearRampToValueAtTime(0.0001, when + (clipEnd - from));
  }
  src.connect(g).connect(dest);
  src.start(t0, offset, dur);
  return src;
}

/** Construye el grafo de la mezcla: clips → efectos de pista → volumen/panorama → maestro. */
export function buildMix(c: BaseAudioContext, s: Session, when: number, from: number): { sources: AudioScheduledSourceNode[]; master: GainNode } {
  const master = c.createGain();
  master.gain.value = dbToGain(s.masterVolume);
  master.connect(c.destination);
  const anySolo = s.tracks.some((t) => t.solo);
  const sources: AudioScheduledSourceNode[] = [];
  for (const t of s.tracks) {
    if (t.mute || (anySolo && !t.solo)) continue;
    const input = c.createGain();
    const chainEnd = buildChain(c, input, t.effects);
    const vol = c.createGain();
    vol.gain.value = dbToGain(t.volume);
    const pan = c.createStereoPanner();
    pan.pan.value = t.pan;
    chainEnd.connect(vol).connect(pan).connect(master);
    for (const clip of t.clips) {
      const asset = s.assets.find((a) => a.id === clip.assetId);
      const buf = getBuffer(asset?.data);
      if (!buf) continue;
      const src = scheduleClip(c, input, clip, buf, when, from);
      if (src) sources.push(src);
    }
  }
  return { sources, master };
}

export class Player {
  private graph: Graph | null = null;
  private startedAt = 0;
  private from = 0;
  playing = false;

  get ctx() {
    return audioContext();
  }

  /** Segundo actual de la reproducción. */
  position(): number {
    return this.playing ? this.from + (this.ctx.currentTime - this.startedAt) : this.from;
  }

  playBuffer(buf: AudioBuffer, from: number, to: number, loop: boolean, onEnd: () => void) {
    this.stop();
    void this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    if (loop) {
      src.loop = true;
      src.loopStart = from;
      src.loopEnd = to;
      src.start(0, from);
    } else src.start(0, from, Math.max(0.01, to - from));
    this.startedAt = this.ctx.currentTime;
    this.from = from;
    this.playing = true;
    const loopLen = to - from;
    this.position = () => (this.playing ? (loop ? from + ((this.ctx.currentTime - this.startedAt) % loopLen) : this.from + (this.ctx.currentTime - this.startedAt)) : this.from);
    src.onended = () => {
      if (this.graph?.stop === stopFn) {
        this.playing = false;
        this.graph = null;
        onEnd();
      }
    };
    const stopFn = () => {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* ya parado */
      }
    };
    this.graph = { stop: stopFn };
  }

  playSession(s: Session, from: number, onEnd: () => void) {
    this.stop();
    void this.ctx.resume();
    const when = this.ctx.currentTime + 0.05;
    const { sources, master } = buildMix(this.ctx, s, when, from);
    this.startedAt = when;
    this.from = from;
    this.playing = true;
    this.position = () => (this.playing ? this.from + Math.max(0, this.ctx.currentTime - this.startedAt) : this.from);
    const end = sessionLength(s) + effectTail(s.tracks.flatMap((t) => t.effects));
    const timer = window.setTimeout(() => {
      if (this.graph?.stop === stopFn) {
        this.playing = false;
        this.graph = null;
        onEnd();
      }
    }, Math.max(100, (end - from) * 1000 + 100));
    const stopFn = () => {
      window.clearTimeout(timer);
      sources.forEach((s2) => {
        try {
          s2.stop();
        } catch {
          /* ya parado */
        }
      });
      master.disconnect();
    };
    this.graph = { stop: stopFn };
  }

  stop() {
    if (this.graph) {
      const pos = this.position();
      this.graph.stop();
      this.graph = null;
      this.from = pos;
    }
    this.playing = false;
    this.position = () => this.from;
  }

  seek(t: number) {
    this.from = t;
  }
}

/** Mezcla final de la sesión (respeta mute/solo, efectos, volumen y panorama). */
export async function mixdown(s: Session, a = 0, b = sessionLength(s)): Promise<AudioBuffer> {
  const tail = effectTail(s.tracks.flatMap((t) => t.effects));
  const len = Math.max(1, Math.ceil((b - a + tail) * s.sampleRate));
  const off = new OfflineAudioContext(2, len, s.sampleRate);
  buildMix(off, s, 0, a);
  return off.startRendering();
}
