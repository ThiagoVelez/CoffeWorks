// Codificador de GIF animado: paleta global por corte de la mediana, tramado
// ordenado opcional, transparencia y compresión LZW.

type RGB = [number, number, number];

/** Paleta de hasta 255 colores a partir de muestras de varios fotogramas. */
function medianCut(samples: number[], maxColors: number): RGB[] {
  type Box = number[];
  const boxes: Box[] = [samples];
  const range = (b: Box, ch: number) => {
    let lo = 255;
    let hi = 0;
    for (const c of b) {
      const v = (c >> (16 - ch * 8)) & 255;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi - lo;
  };
  while (boxes.length < maxColors) {
    let best = -1;
    let bestRange = 0;
    let bestCh = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      for (let ch = 0; ch < 3; ch++) {
        const r = range(boxes[i], ch) * Math.sqrt(boxes[i].length);
        if (r > bestRange) {
          bestRange = r;
          best = i;
          bestCh = ch;
        }
      }
    }
    if (best < 0) break;
    const box = boxes[best];
    const shift = 16 - bestCh * 8;
    box.sort((a, b) => ((a >> shift) & 255) - ((b >> shift) & 255));
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes
    .filter((b) => b.length)
    .map((b) => {
      let r = 0;
      let g = 0;
      let bl = 0;
      for (const c of b) {
        r += (c >> 16) & 255;
        g += (c >> 8) & 255;
        bl += c & 255;
      }
      return [Math.round(r / b.length), Math.round(g / b.length), Math.round(bl / b.length)] as RGB;
    });
}

function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const out: number[] = [];
  let cur = 0;
  let bits = 0;
  const clear = 1 << minCode;
  const eoi = clear + 1;
  let size = minCode + 1;
  let next = eoi + 1;
  let dict = new Map<number, number>();
  const emit = (code: number) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(cur & 255);
      cur >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(clear);
      dict = new Map();
      size = minCode + 1;
      next = eoi + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(cur & 255);
  // Subbloques de 255 bytes
  const blocks: number[] = [minCode];
  for (let i = 0; i < out.length; i += 255) {
    const n = Math.min(255, out.length - i);
    blocks.push(n, ...out.slice(i, i + n));
  }
  blocks.push(0);
  return new Uint8Array(blocks);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.5) * 24);

export interface GifOptions {
  width: number;
  height: number;
  /** Retardo por fotograma en centésimas de segundo. */
  delay: number;
  /** 0 = repetir siempre. */
  loop?: number;
  dither?: boolean;
  transparent?: boolean;
}

/** Codifica fotogramas (ImageData) en un GIF animado. */
export async function encodeGif(frames: ImageData[], o: GifOptions, onProgress?: (f: number) => void): Promise<Blob> {
  const { width: w, height: h } = o;
  // Muestras para la paleta (hasta ~60 000 píxeles de todos los fotogramas)
  const samples: number[] = [];
  const step = Math.max(1, Math.floor((w * h * frames.length) / 60000));
  let hasAlpha = false;
  frames.forEach((f) => {
    for (let i = 0; i < w * h; i += step) {
      const a = f.data[i * 4 + 3];
      if (a < 128) {
        hasAlpha = true;
        continue;
      }
      samples.push((f.data[i * 4] << 16) | (f.data[i * 4 + 1] << 8) | f.data[i * 4 + 2]);
    }
  });
  const transparent = !!o.transparent && hasAlpha;
  const palette = medianCut(samples.length ? samples : [0], transparent ? 255 : 256);
  while (palette.length < 2) palette.push([0, 0, 0]);
  const tIndex = transparent ? palette.length : -1;
  const size = Math.max(2, Math.ceil(Math.log2(palette.length + (transparent ? 1 : 0))));
  const tableLen = 1 << size;
  const cache = new Map<number, number>();
  const nearest = (r: number, g: number, b: number) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const c = cache.get(key);
    if (c !== undefined) return c;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = (p[0] - r) * (p[0] - r) * 0.3 + (p[1] - g) * (p[1] - g) * 0.59 + (p[2] - b) * (p[2] - b) * 0.11;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };

  const parts: Uint8Array[] = [];
  const bytes = (...b: number[]) => parts.push(new Uint8Array(b));
  const le = (n: number) => [n & 255, (n >> 8) & 255];
  parts.push(new TextEncoder().encode("GIF89a"));
  bytes(...le(w), ...le(h), 0xf0 | (size - 1), 0, 0);
  const table = new Uint8Array(tableLen * 3);
  palette.forEach((p, i) => table.set(p, i * 3));
  parts.push(table);
  // Repetición (NETSCAPE2.0)
  bytes(0x21, 0xff, 11, ...new TextEncoder().encode("NETSCAPE2.0"), 3, 1, ...le(o.loop ?? 0), 0);

  for (let fi = 0; fi < frames.length; fi++) {
    const d = frames[fi].data;
    const idx = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (transparent && d[i * 4 + 3] < 128) {
          idx[i] = tIndex;
          continue;
        }
        const t = o.dither ? BAYER[(y & 3) * 4 + (x & 3)] : 0;
        idx[i] = nearest(Math.max(0, Math.min(255, d[i * 4] + t)), Math.max(0, Math.min(255, d[i * 4 + 1] + t)), Math.max(0, Math.min(255, d[i * 4 + 2] + t)));
      }
    // Control gráfico: retardo, transparencia y borrado al fondo
    bytes(0x21, 0xf9, 4, (transparent ? 1 : 0) | ((transparent ? 2 : 1) << 2), ...le(o.delay), transparent ? tIndex : 0, 0);
    bytes(0x2c, 0, 0, 0, 0, ...le(w), ...le(h), 0);
    parts.push(lzw(idx, size));
    onProgress?.((fi + 1) / frames.length);
    if (fi % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  bytes(0x3b);
  return new Blob(parts as BlobPart[], { type: "image/gif" });
}
