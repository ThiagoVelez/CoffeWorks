// Audio de la composición: capas de audio y el sonido de los videos (también
// dentro de composiciones anidadas), para la vista previa y la exportación.

import type { Comp, Layer, Project } from "../types";
import { propValue } from "./anim";
import { contentTime } from "./render";

const decoded = new Map<string, Promise<AudioBuffer | null>>();
let ctx: AudioContext | null = null;
export const audioContext = () => (ctx ||= new AudioContext());

export function assetBuffer(project: Project, assetId: string): Promise<AudioBuffer | null> {
  let p = decoded.get(assetId);
  if (!p) {
    const a = project.assets.find((x) => x.id === assetId);
    p = (async () => {
      if (!a || a.kind === "image") return null;
      try {
        const bytes = await (await fetch(a.data)).arrayBuffer();
        return await audioContext().decodeAudioData(bytes);
      } catch {
        return null;
      }
    })();
    decoded.set(assetId, p);
  }
  return p;
}

interface Placement {
  layer: Layer;
  comp: Comp;
  buffer: AudioBuffer;
  /** Segundo de la comp principal en que empieza a sonar. */
  at: number;
  /** Segundo del recurso desde el que suena. */
  offset: number;
  duration: number;
  rate: number;
  /** Desplazamiento de tiempo entre la comp principal y la de la capa. */
  shift: number;
}

async function collect(project: Project, comp: Comp, shift: number, from: number, to: number, out: Placement[], depth = 0) {
  if (depth > 6) return;
  const anySolo = comp.layers.some((l) => l.solo);
  for (const l of comp.layers) {
    if (!l.visible || (anySolo && !l.solo)) continue;
    const a = Math.max(l.inPoint + shift, from);
    const b = Math.min(l.outPoint + shift, to);
    if (b <= a) continue;
    if ((l.type === "audio" || l.type === "video") && l.assetId) {
      const buf = await assetBuffer(project, l.assetId);
      if (!buf) continue;
      const rate = (l.timeStretch || 100) / 100;
      const offset = contentTime(l, a - shift);
      if (offset >= buf.duration || offset < -1) continue;
      out.push({ layer: l, comp, buffer: buf, at: a, offset: Math.max(0, offset), duration: Math.min(b - a, (buf.duration - Math.max(0, offset)) / rate), rate, shift });
    } else if (l.type === "precomp" && l.compId) {
      const inner = project.comps.find((c) => c.id === l.compId);
      if (inner) await collect(project, inner, l.startTime + shift, a, b, out, depth + 1);
    }
  }
}

/** Programa el audio en un contexto: `when` = momento del contexto que corresponde a `from`. */
function schedule(c: BaseAudioContext, dest: AudioNode, list: Placement[], from: number, when: number) {
  const sources: AudioBufferSourceNode[] = [];
  for (const p of list) {
    const src = c.createBufferSource();
    src.buffer = p.buffer;
    src.playbackRate.value = p.rate;
    const g = c.createGain();
    const vol = p.layer.volume;
    const t0 = when + (p.at - from);
    if (vol) {
      // Volumen animado: se muestrea 20 veces por segundo
      const steps = Math.max(1, Math.ceil(p.duration * 20));
      for (let i = 0; i <= steps; i++) {
        const tt = p.at + (i / steps) * p.duration;
        const db = propValue(vol, tt - p.shift);
        g.gain.setValueAtTime(db <= -60 ? 0 : Math.pow(10, db / 20), Math.max(0, t0 + (tt - p.at)));
      }
    }
    src.connect(g).connect(dest);
    src.start(Math.max(0, t0), p.offset, p.duration * p.rate);
    sources.push(src);
  }
  return sources;
}

export class AudioPreview {
  private sources: AudioBufferSourceNode[] = [];
  async start(project: Project, comp: Comp, from: number, to: number) {
    this.stop();
    const list: Placement[] = [];
    await collect(project, comp, 0, from, to, list);
    if (!list.length) return;
    const c = audioContext();
    await c.resume();
    this.sources = schedule(c, c.destination, list, from, c.currentTime + 0.03);
  }
  stop() {
    for (const s of this.sources)
      try {
        s.stop();
      } catch {
        /* parado */
      }
    this.sources = [];
  }
}

/** Mezcla del audio entre `from` y `to` (null si no hay audio). */
export async function mixAudio(project: Project, comp: Comp, from: number, to: number): Promise<AudioBuffer | null> {
  const list: Placement[] = [];
  await collect(project, comp, 0, from, to, list);
  if (!list.length) return null;
  const off = new OfflineAudioContext(2, Math.max(1, Math.ceil((to - from) * 48000)), 48000);
  schedule(off, off.destination, list, from, 0);
  return off.startRendering();
}
