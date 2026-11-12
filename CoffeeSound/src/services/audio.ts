// Motor de audio de CoffeeSound: almacén de búferes, operaciones de edición,
// efectos (Web Audio, en tiempo real y sin conexión), reducción de ruido por
// espectro, espectrograma, generadores y WAV.

import type { Effect, EffectKind } from "../types";

let ctx: AudioContext | null = null;
export const audioContext = () => (ctx ||= new AudioContext({ latencyHint: "interactive" }));

// ---------------------------------------------------------------------------
// Almacén de búferes (fichas inmutables, como el almacén de píxeles)
// ---------------------------------------------------------------------------

interface Entry {
  buffer: AudioBuffer | null;
  wav: string | null;
  used: number;
}
const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
let counter = 0;

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function fromBuffer(buffer: AudioBuffer): string {
  const token = `au${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  store.set(token, { buffer, wav: null, used: counter });
  evict();
  return token;
}

/** Registra un audio guardado (data URL); se decodifica en segundo plano. */
export function fromDataUrl(url: string): string {
  const token = `au${(++counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entry: Entry = { buffer: null, wav: url.startsWith("data:audio/wav") ? url : null, used: counter };
  store.set(token, entry);
  void fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => audioContext().decodeAudioData(b))
    .then((buf) => {
      entry.buffer = buf;
      listeners.forEach((f) => f());
    })
    .catch(() => {
      entry.buffer = audioContext().createBuffer(1, 1, 48000);
      listeners.forEach((f) => f());
    });
  return token;
}

export function getBuffer(token: string | null | undefined): AudioBuffer | null {
  if (!token) return null;
  const e = store.get(token);
  if (!e) return null;
  e.used = ++counter;
  return e.buffer;
}

export function toDataUrl(token: string): string {
  const e = store.get(token);
  if (!e) return "";
  if (!e.wav && e.buffer) e.wav = `data:audio/wav;base64,${bytesToBase64(encodeWav(e.buffer, 16))}`;
  return e.wav || "";
}

let keep: () => Set<string> = () => new Set();
export const setKeep = (fn: () => Set<string>) => (keep = fn);
function evict() {
  if (store.size <= 120) return;
  const k = keep();
  [...store.entries()]
    .filter(([t]) => !k.has(t))
    .sort((a, b) => a[1].used - b[1].used)
    .slice(0, store.size - 120)
    .forEach(([t]) => store.delete(t));
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ---------------------------------------------------------------------------
// WAV
// ---------------------------------------------------------------------------

export function encodeWav(buf: AudioBuffer, bits: 16 | 24 | 32 = 16): Uint8Array {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const bps = bits / 8;
  const data = new Uint8Array(44 + len * ch * bps);
  const dv = new DataView(data.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  dv.setUint32(4, 36 + len * ch * bps, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, bits === 32 ? 3 : 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * ch * bps, true);
  dv.setUint16(32, ch * bps, true);
  dv.setUint16(34, bits, true);
  w(36, "data");
  dv.setUint32(40, len * ch * bps, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      if (bits === 16) dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      else if (bits === 24) {
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff);
        dv.setUint8(o, v & 255);
        dv.setUint8(o + 1, (v >> 8) & 255);
        dv.setUint8(o + 2, (v >> 16) & 255);
      } else dv.setFloat32(o, s, true);
      o += bps;
    }
  return data;
}

export async function decodeBytes(bytes: Uint8Array): Promise<AudioBuffer> {
  return audioContext().decodeAudioData(bytes.slice().buffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Operaciones de edición (devuelven búferes nuevos)
// ---------------------------------------------------------------------------

export const makeBuffer = (channels: number, length: number, rate: number) => audioContext().createBuffer(Math.max(1, channels), Math.max(1, Math.round(length)), rate);

export function slice(buf: AudioBuffer, a: number, b: number): AudioBuffer {
  const s = Math.max(0, Math.floor(a * buf.sampleRate));
  const e = Math.min(buf.length, Math.ceil(b * buf.sampleRate));
  const out = makeBuffer(buf.numberOfChannels, e - s, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(s, e), c);
  return out;
}

/** Sustituye [a, b] por `insert` (o lo borra si es null). */
export function splice(buf: AudioBuffer, a: number, b: number, insert: AudioBuffer | null): AudioBuffer {
  const s = Math.max(0, Math.floor(a * buf.sampleRate));
  const e = Math.min(buf.length, Math.ceil(b * buf.sampleRate));
  const ins = insert ? resampleChannels(insert, buf.numberOfChannels, buf.sampleRate) : null;
  const len = buf.length - (e - s) + (ins ? ins.length : 0);
  const out = makeBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, s), 0);
    if (ins) dst.set(ins.getChannelData(c), s);
    dst.set(src.subarray(e), s + (ins ? ins.length : 0));
  }
  return out;
}

/** Ajusta canales y frecuencia de muestreo (para pegar entre archivos distintos). */
export function resampleChannels(buf: AudioBuffer, channels: number, rate: number): AudioBuffer {
  const k = rate / buf.sampleRate;
  const len = Math.max(1, Math.round(buf.length * k));
  const out = makeBuffer(channels, len, rate);
  for (let c = 0; c < channels; c++) {
    const src = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
    const dst = out.getChannelData(c);
    if (k === 1) dst.set(src.subarray(0, len));
    else
      for (let i = 0; i < len; i++) {
        const x = i / k;
        const i0 = Math.floor(x);
        const t = x - i0;
        dst[i] = (src[i0] || 0) * (1 - t) + (src[i0 + 1] || 0) * t;
      }
  }
  return out;
}

/** Aplica una función a las muestras de [a, b] de una copia del búfer. */
export function mapRange(buf: AudioBuffer, a: number, b: number, fn: (v: number, i: number, n: number, c: number) => number): AudioBuffer {
  const out = makeBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  const s = Math.max(0, Math.floor(a * buf.sampleRate));
  const e = Math.min(buf.length, Math.ceil(b * buf.sampleRate));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src);
    for (let i = s; i < e; i++) dst[i] = fn(src[i], i - s, e - s, c);
  }
  return out;
}

export const peak = (buf: AudioBuffer, a = 0, b = buf.duration) => {
  let m = 0;
  const s = Math.floor(a * buf.sampleRate);
  const e = Math.min(buf.length, Math.ceil(b * buf.sampleRate));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = s; i < e; i++) if (Math.abs(d[i]) > m) m = Math.abs(d[i]);
  }
  return m;
};

export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => (g > 0 ? 20 * Math.log10(g) : -Infinity);

export const OPS = {
  silence: (b: AudioBuffer, a: number, z: number) => mapRange(b, a, z, () => 0),
  fadeIn: (b: AudioBuffer, a: number, z: number) => mapRange(b, a, z, (v, i, n) => v * Math.pow(i / n, 1.5)),
  fadeOut: (b: AudioBuffer, a: number, z: number) => mapRange(b, a, z, (v, i, n) => v * Math.pow(1 - i / n, 1.5)),
  invert: (b: AudioBuffer, a: number, z: number) => mapRange(b, a, z, (v) => -v),
  amplify: (b: AudioBuffer, a: number, z: number, db: number) => mapRange(b, a, z, (v) => v * dbToGain(db)),
  normalize: (b: AudioBuffer, a: number, z: number, targetDb = -1) => {
    const p = peak(b, a, z);
    return p ? mapRange(b, a, z, (v) => (v / p) * dbToGain(targetDb)) : b;
  },
  reverse: (b: AudioBuffer, a: number, z: number) => {
    const part = slice(b, a, z);
    for (let c = 0; c < part.numberOfChannels; c++) part.getChannelData(c).reverse();
    return splice(b, a, z, part);
  },
  /** Elimina el desplazamiento de continua (DC). */
  dcOffset: (b: AudioBuffer, a: number, z: number) => {
    const means = Array.from({ length: b.numberOfChannels }, (_, c) => {
      const d = b.getChannelData(c);
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i];
      return s / d.length;
    });
    return mapRange(b, a, z, (v, _i, _n, c) => v - means[c]);
  },
  /** Convierte a mono (o duplica a estéreo). */
  channels: (b: AudioBuffer, n: number) => {
    const out = makeBuffer(n, b.length, b.sampleRate);
    if (n === 1 && b.numberOfChannels > 1) {
      const l = b.getChannelData(0);
      const r = b.getChannelData(1);
      const d = out.getChannelData(0);
      for (let i = 0; i < b.length; i++) d[i] = (l[i] + r[i]) / 2;
    } else for (let c = 0; c < n; c++) out.copyToChannel(b.getChannelData(Math.min(c, b.numberOfChannels - 1)), c);
    return out;
  },
};

/** Cambia la velocidad (y el tono, como una cinta). */
export async function changeSpeed(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  const len = Math.max(1, Math.round(buf.length / rate));
  const off = new OfflineAudioContext(buf.numberOfChannels, len, buf.sampleRate);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(off.destination);
  src.start();
  return off.startRendering();
}

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

export function generate(kind: "silence" | "tone" | "noise" | "pink", seconds: number, rate: number, channels: number, freq = 440, db = -12): AudioBuffer {
  const out = makeBuffer(channels, seconds * rate, rate);
  const g = dbToGain(db);
  for (let c = 0; c < channels; c++) {
    const d = out.getChannelData(c);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < d.length; i++) {
      if (kind === "tone") d[i] = Math.sin((2 * Math.PI * freq * i) / rate) * g;
      else if (kind === "noise") d[i] = (Math.random() * 2 - 1) * g;
      else if (kind === "pink") {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2 * g;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------------

export const EFFECT_INFO: Record<EffectKind, { label: string; params: Array<{ key: string; label: string; min: number; max: number; step?: number; unit?: string; def: number }> }> = {
  eq: {
    label: "Ecualizador de 3 bandas",
    params: [
      { key: "low", label: "Graves (100 Hz)", min: -18, max: 18, unit: "dB", def: 0 },
      { key: "mid", label: "Medios", min: -18, max: 18, unit: "dB", def: 0 },
      { key: "midFreq", label: "Frecuencia de medios", min: 200, max: 6000, unit: "Hz", def: 1000 },
      { key: "high", label: "Agudos (8 kHz)", min: -18, max: 18, unit: "dB", def: 0 },
    ],
  },
  compressor: {
    label: "Compresor",
    params: [
      { key: "threshold", label: "Umbral", min: -60, max: 0, unit: "dB", def: -20 },
      { key: "ratio", label: "Proporción", min: 1, max: 20, step: 0.5, def: 4 },
      { key: "attack", label: "Ataque", min: 0, max: 200, unit: "ms", def: 5 },
      { key: "release", label: "Liberación", min: 10, max: 1000, unit: "ms", def: 150 },
      { key: "makeup", label: "Ganancia de compensación", min: 0, max: 24, unit: "dB", def: 4 },
    ],
  },
  limiter: {
    label: "Limitador",
    params: [
      { key: "ceiling", label: "Techo", min: -12, max: 0, step: 0.1, unit: "dB", def: -1 },
      { key: "input", label: "Ganancia de entrada", min: 0, max: 24, unit: "dB", def: 3 },
    ],
  },
  reverb: {
    label: "Reverberación",
    params: [
      { key: "size", label: "Tamaño de la sala", min: 0.2, max: 6, step: 0.1, unit: "s", def: 1.8 },
      { key: "decay", label: "Caída", min: 1, max: 8, step: 0.1, def: 3 },
      { key: "mix", label: "Mezcla", min: 0, max: 100, unit: "%", def: 30 },
    ],
  },
  delay: {
    label: "Eco",
    params: [
      { key: "time", label: "Tiempo", min: 20, max: 1500, unit: "ms", def: 300 },
      { key: "feedback", label: "Repeticiones", min: 0, max: 90, unit: "%", def: 40 },
      { key: "mix", label: "Mezcla", min: 0, max: 100, unit: "%", def: 35 },
    ],
  },
  lowpass: { label: "Filtro de paso bajo", params: [{ key: "freq", label: "Frecuencia de corte", min: 200, max: 20000, unit: "Hz", def: 6000 }, { key: "q", label: "Resonancia", min: 0.1, max: 12, step: 0.1, def: 0.7 }] },
  highpass: { label: "Filtro de paso alto (quitar graves)", params: [{ key: "freq", label: "Frecuencia de corte", min: 20, max: 2000, unit: "Hz", def: 80 }, { key: "q", label: "Resonancia", min: 0.1, max: 12, step: 0.1, def: 0.7 }] },
  gain: { label: "Ganancia", params: [{ key: "db", label: "Ganancia", min: -40, max: 24, step: 0.5, unit: "dB", def: 0 }] },
  distortion: { label: "Distorsión", params: [{ key: "amount", label: "Cantidad", min: 0, max: 100, unit: "%", def: 30 }, { key: "mix", label: "Mezcla", min: 0, max: 100, unit: "%", def: 100 }] },
  chorus: {
    label: "Coro",
    params: [
      { key: "rate", label: "Velocidad", min: 0.1, max: 8, step: 0.1, unit: "Hz", def: 1.5 },
      { key: "depth", label: "Profundidad", min: 0, max: 100, unit: "%", def: 40 },
      { key: "mix", label: "Mezcla", min: 0, max: 100, unit: "%", def: 50 },
    ],
  },
};

export function defaultEffect(kind: EffectKind): Effect {
  return { id: `fx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, enabled: true, params: Object.fromEntries(EFFECT_INFO[kind].params.map((p) => [p.key, p.def])) };
}

const impulseCache = new Map<string, AudioBuffer>();
function impulse(c: BaseAudioContext, size: number, decay: number): AudioBuffer {
  const key = `${c.sampleRate}:${size}:${decay}`;
  const cached = impulseCache.get(key);
  if (cached && cached.sampleRate === c.sampleRate) return cached;
  const len = Math.round(c.sampleRate * size);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  impulseCache.set(key, buf);
  return buf;
}

function wetDry(c: BaseAudioContext, input: AudioNode, wet: AudioNode, wetOut: AudioNode, mix: number): AudioNode {
  const out = c.createGain();
  const dry = c.createGain();
  dry.gain.value = 1 - mix;
  const w = c.createGain();
  w.gain.value = mix;
  input.connect(dry).connect(out);
  input.connect(wet);
  wetOut.connect(w).connect(out);
  return out;
}

/** Conecta la cadena de efectos tras `input` y devuelve el último nodo. */
export function buildChain(c: BaseAudioContext, input: AudioNode, effects: Effect[]): AudioNode {
  let node = input;
  for (const fx of effects) {
    if (!fx.enabled) continue;
    const p = fx.params;
    switch (fx.kind) {
      case "eq": {
        const lo = c.createBiquadFilter();
        lo.type = "lowshelf";
        lo.frequency.value = 100;
        lo.gain.value = p.low;
        const mid = c.createBiquadFilter();
        mid.type = "peaking";
        mid.frequency.value = p.midFreq;
        mid.Q.value = 0.9;
        mid.gain.value = p.mid;
        const hi = c.createBiquadFilter();
        hi.type = "highshelf";
        hi.frequency.value = 8000;
        hi.gain.value = p.high;
        node.connect(lo).connect(mid).connect(hi);
        node = hi;
        break;
      }
      case "compressor": {
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = p.threshold;
        comp.ratio.value = p.ratio;
        comp.attack.value = p.attack / 1000;
        comp.release.value = p.release / 1000;
        comp.knee.value = 6;
        const mk = c.createGain();
        mk.gain.value = dbToGain(p.makeup);
        node.connect(comp).connect(mk);
        node = mk;
        break;
      }
      case "limiter": {
        const pre = c.createGain();
        pre.gain.value = dbToGain(p.input);
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = p.ceiling - 1;
        comp.ratio.value = 20;
        comp.attack.value = 0.001;
        comp.release.value = 0.08;
        comp.knee.value = 0;
        node.connect(pre).connect(comp);
        node = comp;
        break;
      }
      case "reverb": {
        const conv = c.createConvolver();
        conv.buffer = impulse(c, p.size, p.decay);
        node = wetDry(c, node, conv, conv, p.mix / 100);
        break;
      }
      case "delay": {
        const d = c.createDelay(2);
        d.delayTime.value = p.time / 1000;
        const fb = c.createGain();
        fb.gain.value = p.feedback / 100;
        d.connect(fb).connect(d);
        node = wetDry(c, node, d, d, p.mix / 100);
        break;
      }
      case "lowpass":
      case "highpass": {
        const f = c.createBiquadFilter();
        f.type = fx.kind;
        f.frequency.value = p.freq;
        f.Q.value = p.q;
        node.connect(f);
        node = f;
        break;
      }
      case "gain": {
        const g = c.createGain();
        g.gain.value = dbToGain(p.db);
        node.connect(g);
        node = g;
        break;
      }
      case "distortion": {
        const ws = c.createWaveShaper();
        const k = (p.amount / 100) * 80 + 1;
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
          const x = (i / 1023) * 2 - 1;
          curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
        }
        ws.curve = curve;
        ws.oversample = "4x";
        node = wetDry(c, node, ws, ws, p.mix / 100);
        break;
      }
      case "chorus": {
        const d = c.createDelay(0.1);
        d.delayTime.value = 0.02;
        const lfo = c.createOscillator();
        lfo.frequency.value = p.rate;
        const depth = c.createGain();
        depth.gain.value = (p.depth / 100) * 0.008;
        lfo.connect(depth).connect(d.delayTime);
        lfo.start();
        node = wetDry(c, node, d, d, p.mix / 100);
        break;
      }
    }
  }
  return node;
}

/** Aplica una cadena de efectos a un búfer (con la cola de la reverberación/eco). */
export async function renderEffects(buf: AudioBuffer, effects: Effect[], tail = 0): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(buf.numberOfChannels, buf.length + Math.round(tail * buf.sampleRate), buf.sampleRate);
  const src = off.createBufferSource();
  src.buffer = buf;
  const last = buildChain(off, src, effects);
  last.connect(off.destination);
  src.start();
  return off.startRendering();
}

export const effectTail = (effects: Effect[]) =>
  effects.filter((e) => e.enabled).reduce((t, e) => t + (e.kind === "reverb" ? e.params.size : e.kind === "delay" ? (e.params.time / 1000) * (1 + e.params.feedback / 15) : 0), 0);

// ---------------------------------------------------------------------------
// FFT, espectrograma y reducción de ruido
// ---------------------------------------------------------------------------

function fft(re: Float32Array, im: Float32Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
}

const hann = (n: number) => Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));

/** Columnas del espectrograma (magnitud en dB normalizada 0-1) entre a y b. */
export function spectrogram(buf: AudioBuffer, a: number, b: number, columns: number, size = 1024): Float32Array[] {
  const d = buf.getChannelData(0);
  const win = hann(size);
  const s0 = Math.floor(a * buf.sampleRate);
  const s1 = Math.floor(b * buf.sampleRate);
  const out: Float32Array[] = [];
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  for (let c = 0; c < columns; c++) {
    const center = s0 + Math.floor(((s1 - s0) * (c + 0.5)) / columns);
    for (let i = 0; i < size; i++) {
      re[i] = (d[center - size / 2 + i] || 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    const col = new Float32Array(size / 2);
    for (let k = 0; k < size / 2; k++) {
      const mag = Math.hypot(re[k], im[k]) / (size / 4);
      col[k] = Math.max(0, Math.min(1, (20 * Math.log10(mag + 1e-9) + 100) / 100));
    }
    out.push(col);
  }
  return out;
}

/** Perfil de ruido: magnitud media por banda de una zona con solo ruido. */
export function noiseProfile(buf: AudioBuffer, a: number, b: number, size = 2048): Float32Array[] {
  return Array.from({ length: buf.numberOfChannels }, (_, ch) => {
    const d = buf.getChannelData(ch);
    const win = hann(size);
    const acc = new Float32Array(size / 2 + 1);
    let frames = 0;
    const re = new Float32Array(size);
    const im = new Float32Array(size);
    for (let s = Math.floor(a * buf.sampleRate); s + size <= Math.min(d.length, b * buf.sampleRate); s += size / 2) {
      for (let i = 0; i < size; i++) {
        re[i] = d[s + i] * win[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let k = 0; k <= size / 2; k++) acc[k] += Math.hypot(re[k], im[k]);
      frames++;
    }
    if (frames) for (let k = 0; k < acc.length; k++) acc[k] /= frames;
    return acc;
  });
}

/** Reducción de ruido por sustracción espectral (puerta suave por banda). */
export function reduceNoise(buf: AudioBuffer, profile: Float32Array[], a: number, b: number, amount: number, sensitivity = 1.5, size = 2048): AudioBuffer {
  const out = makeBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  const win = hann(size);
  const hop = size / 4;
  const s0 = Math.max(0, Math.floor(a * buf.sampleRate));
  const s1 = Math.min(buf.length, Math.ceil(b * buf.sampleRate));
  const reduce = Math.min(1, amount / 100);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    dst.set(src);
    const prof = profile[Math.min(ch, profile.length - 1)];
    const acc = new Float32Array(s1 - s0 + size);
    const norm = new Float32Array(s1 - s0 + size);
    const re = new Float32Array(size);
    const im = new Float32Array(size);
    let prevGain = new Float32Array(size / 2 + 1).fill(1);
    for (let s = s0 - size / 2; s < s1; s += hop) {
      for (let i = 0; i < size; i++) {
        re[i] = (src[s + i] || 0) * win[i];
        im[i] = 0;
      }
      fft(re, im);
      const gains = new Float32Array(size / 2 + 1);
      for (let k = 0; k <= size / 2; k++) {
        const mag = Math.hypot(re[k], im[k]);
        const noise = prof[k] * sensitivity;
        // Ganancia suave: atenúa las bandas que no superan al ruido
        const g = mag > noise ? 1 - (noise / mag) * reduce * 0.9 : 1 - reduce;
        gains[k] = Math.max(0.02, 0.6 * g + 0.4 * prevGain[k]);
      }
      prevGain = gains;
      for (let k = 0; k <= size / 2; k++) {
        re[k] *= gains[k];
        im[k] *= gains[k];
        if (k && k < size / 2) {
          re[size - k] *= gains[k];
          im[size - k] *= gains[k];
        }
      }
      fft(re, im, true);
      for (let i = 0; i < size; i++) {
        const idx = s - s0 + i;
        if (idx < 0 || idx >= acc.length) continue;
        acc[idx] += re[i] * win[i];
        norm[idx] += win[i] * win[i];
      }
    }
    for (let i = s0; i < s1; i++) {
      const n = norm[i - s0];
      dst[i] = n > 1e-6 ? acc[i - s0] / n : src[i];
    }
  }
  return out;
}

/** Picos por píxel para dibujar la forma de onda. */
export function peaks(buf: AudioBuffer, ch: number, a: number, b: number, columns: number): Array<[number, number]> {
  const d = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
  const s0 = a * buf.sampleRate;
  const step = ((b - a) * buf.sampleRate) / columns;
  const out: Array<[number, number]> = [];
  for (let c = 0; c < columns; c++) {
    const from = Math.floor(s0 + c * step);
    const to = Math.max(from + 1, Math.floor(s0 + (c + 1) * step));
    let mn = 1;
    let mx = -1;
    const stride = Math.max(1, Math.floor((to - from) / 400));
    for (let i = from; i < to; i += stride) {
      const v = d[i] ?? 0;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    out.push(mn > mx ? [0, 0] : [mn, mx]);
  }
  return out;
}
