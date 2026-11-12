// ⚠ Copia de shared/studio/webm.ts: edita el original y ejecuta node scripts/sync-shared.mjs
// Contenedor WebM (Matroska) mínimo para los fragmentos de WebCodecs: video
// VP9/VP8 y audio Opus, con duración e índice (Cues) para poder avanzar y
// retroceder en cualquier reproductor.

export interface MuxChunk {
  track: 1 | 2;
  /** Milisegundos. */
  time: number;
  key: boolean;
  data: Uint8Array;
}

export interface MuxOptions {
  width: number;
  height: number;
  videoCodec: "V_VP9" | "V_VP8";
  /** Duración total en milisegundos. */
  duration: number;
  audio?: { sampleRate: number; channels: number; codecPrivate: Uint8Array } | null;
}

const concat = (parts: Uint8Array[]) => {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

function idBytes(id: number): Uint8Array {
  const b: number[] = [];
  let v = id;
  while (v > 0) {
    b.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return new Uint8Array(b);
}

function sizeBytes(n: number): Uint8Array {
  // Longitud variable (vint) con el menor número de bytes posible
  for (let len = 1; len <= 8; len++) {
    if (n < Math.pow(2, 7 * len) - 1) {
      const out = new Uint8Array(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) {
        out[i] = v & 0xff;
        v = Math.floor(v / 256);
      }
      out[0] |= 1 << (8 - len);
      return out;
    }
  }
  throw new Error("Elemento demasiado grande");
}

const el = (id: number, ...data: Uint8Array[]) => {
  const body = concat(data);
  return concat([idBytes(id), sizeBytes(body.length), body]);
};

function uint(n: number, width = 0): Uint8Array {
  const b: number[] = [];
  let v = Math.max(0, Math.floor(n));
  do {
    b.unshift(v & 0xff);
    v = Math.floor(v / 256);
  } while (v > 0);
  while (b.length < width) b.unshift(0);
  return new Uint8Array(b);
}

const float = (n: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n);
  return b;
};
const str = (s: string) => new TextEncoder().encode(s);

export function muxWebM(chunks: MuxChunk[], o: MuxOptions): Blob {
  const header = el(0x1a45dfa3, el(0x4286, uint(1)), el(0x42f7, uint(1)), el(0x42f2, uint(4)), el(0x42f3, uint(8)), el(0x4282, str("webm")), el(0x4287, uint(4)), el(0x4285, uint(2)));
  const info = el(0x1549a966, el(0x2ad7b1, uint(1_000_000)), el(0x4d80, str("CoffeeWorks")), el(0x5741, str("CoffeeWorks")), el(0x4489, float(o.duration)));
  const videoTrack = el(0xae, el(0xd7, uint(1)), el(0x73c5, uint(1)), el(0x83, uint(1)), el(0x86, str(o.videoCodec)), el(0xe0, el(0xb0, uint(o.width)), el(0xba, uint(o.height))));
  const tracks = [videoTrack];
  if (o.audio)
    tracks.push(
      el(0xae, el(0xd7, uint(2)), el(0x73c5, uint(2)), el(0x83, uint(2)), el(0x86, str("A_OPUS")), el(0x63a2, o.audio.codecPrivate), el(0x56aa, uint(6_500_000)), el(0x56bb, uint(80_000_000)), el(0xe1, el(0xb5, float(o.audio.sampleRate)), el(0x9f, uint(o.audio.channels))))
    );
  const tracksEl = el(0x1654ae6b, ...tracks);

  // Clústeres: uno nuevo en cada fotograma clave de video (o cada 30 s)
  const sorted = [...chunks].sort((a, b) => a.time - b.time || a.track - b.track);
  const clusters: { time: number; bytes: Uint8Array }[] = [];
  let blocks: Uint8Array[] = [];
  let clusterTime = -1;
  const flush = () => {
    if (clusterTime >= 0 && blocks.length) clusters.push({ time: clusterTime, bytes: el(0x1f43b675, el(0xe7, uint(clusterTime)), ...blocks) });
    blocks = [];
  };
  for (const c of sorted) {
    const t = Math.round(c.time);
    if (clusterTime < 0 || (c.track === 1 && c.key) || t - clusterTime > 30000) {
      flush();
      clusterTime = t;
    }
    const rel = t - clusterTime;
    const head = new Uint8Array(4);
    head[0] = 0x80 | c.track;
    new DataView(head.buffer).setInt16(1, rel);
    head[3] = c.key ? 0x80 : 0;
    blocks.push(el(0xa3, head, c.data));
  }
  flush();

  // Índice con posiciones de 8 bytes (tamaño fijo) para calcularlo antes de colocarlo
  const cuesFor = (offset: number) => {
    let pos = offset;
    const points: Uint8Array[] = [];
    for (const c of clusters) {
      points.push(el(0xbb, el(0xb3, uint(c.time)), el(0xb7, el(0xf7, uint(1)), el(0xf1, uint(pos, 8)))));
      pos += c.bytes.length;
    }
    return el(0x1c53bb6b, ...points);
  };
  const before = info.length + tracksEl.length;
  const probe = cuesFor(0);
  const cues = cuesFor(before + probe.length);
  const segment = el(0x18538067, info, tracksEl, cues, ...clusters.map((c) => c.bytes));
  return new Blob([header as BlobPart, segment as BlobPart], { type: "video/webm" });
}

/** Cabecera Opus (RFC 7845) para el CodecPrivate. */
export function opusHead(channels: number, sampleRate: number): Uint8Array {
  const b = new Uint8Array(19);
  b.set(str("OpusHead"), 0);
  const v = new DataView(b.buffer);
  v.setUint8(8, 1);
  v.setUint8(9, channels);
  v.setUint16(10, 312, true);
  v.setUint32(12, sampleRate, true);
  v.setInt16(16, 0, true);
  v.setUint8(18, 0);
  return b;
}
