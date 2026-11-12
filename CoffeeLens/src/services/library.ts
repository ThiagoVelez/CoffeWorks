// Biblioteca de CoffeeLens: importar fotos (con sus datos EXIF), miniaturas
// y carga de los originales.

import type { Catalog, Photo, PhotoExif } from "../types";
import { DEFAULT_EDITS } from "./develop";
import { newId } from "../studio/color";
import { isTauri, readFileBytes, type PickedFile } from "../studio/desktop";
import { decodeRaw, isRaw } from "../studio/raw";

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "tif", "tiff", "bmp", "gif", "heic"];

export const newCatalog = (): Catalog => ({ version: 1, photos: [], collections: [], presets: [] });

export function parseCatalog(text: string): Catalog {
  const raw = JSON.parse(text);
  return {
    version: 1,
    photos: (raw.photos || []).map((p: Partial<Photo>) => ({ ...p, rating: p.rating || 0, flag: p.flag || null, label: p.label || null, keywords: p.keywords || [], caption: p.caption || "", exif: p.exif || {}, edits: { ...DEFAULT_EDITS, ...(p.edits || {}) } }) as Photo),
    collections: raw.collections || [],
    presets: raw.presets || [],
  };
}

export const serializeCatalog = (c: Catalog) => JSON.stringify({ app: "CoffeeLens", ...c });

// ---------------------------------------------------------------------------
// EXIF (JPEG)
// ---------------------------------------------------------------------------

export function readExif(bytes: Uint8Array): PhotoExif {
  const out: PhotoExif = {};
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return out;
  let i = 2;
  while (i < bytes.length - 4) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && String.fromCharCode(...bytes.subarray(i + 4, i + 8)) === "Exif") {
      const t = i + 10;
      const le = bytes[t] === 0x49;
      const dv = new DataView(bytes.buffer, bytes.byteOffset);
      const u16 = (o: number) => dv.getUint16(t + o, le);
      const u32 = (o: number) => dv.getUint32(t + o, le);
      const str = (o: number, n: number) => String.fromCharCode(...bytes.subarray(t + o, t + o + n)).replace(/\0+$/, "").trim();
      const rational = (o: number) => {
        const a = u32(o);
        const b = u32(o + 4);
        return b ? a / b : 0;
      };
      const readIfd = (off: number, cb: (tag: number, type: number, count: number, valOff: number) => void) => {
        if (off <= 0 || t + off + 2 > bytes.length) return;
        const n = u16(off);
        for (let k = 0; k < n; k++) {
          const e = off + 2 + k * 12;
          const tag = u16(e);
          const type = u16(e + 2);
          const count = u32(e + 4);
          const size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] * count;
          const valOff = size > 4 ? u32(e + 8) : e + 8;
          cb(tag, type, count, valOff);
        }
      };
      let exifOff = 0;
      let make = "";
      let model = "";
      readIfd(u32(4), (tag, _type, count, v) => {
        if (tag === 0x010f) make = str(v, count);
        if (tag === 0x0110) model = str(v, count);
        if (tag === 0x0112) out.orientation = u16(v);
        if (tag === 0x8769) exifOff = u32(v);
      });
      out.camera = model.startsWith(make) ? model : `${make} ${model}`.trim() || undefined;
      readIfd(exifOff, (tag, type, count, v) => {
        if (tag === 0x829a) {
          const s = rational(v);
          out.shutter = s >= 1 ? `${s} s` : `1/${Math.round(1 / s)} s`;
        }
        if (tag === 0x829d) out.aperture = `f/${rational(v).toFixed(1)}`;
        if (tag === 0x8827) out.iso = type === 3 ? u16(v) : u32(v);
        if (tag === 0x920a) out.focal = `${Math.round(rational(v))} mm`;
        if (tag === 0x9003) out.date = str(v, count).replace(/^(\d+):(\d+):(\d+)/, "$3/$2/$1");
        if (tag === 0xa434) out.lens = str(v, count);
      });
      return out;
    }
    i += 2 + len;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

const mimeOf = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "jpg";
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "tif" || ext === "tiff" ? "image/tiff" : `image/${ext}`;
};

async function bytesToCanvas(bytes: Uint8Array, name: string): Promise<HTMLCanvasElement> {
  if (isRaw(name)) {
    const c = await decodeRaw(bytes, name, "CoffeeLens");
    if (!c) throw new Error("Instala el complemento «Revelado RAW» para abrir archivos RAW.");
    return c;
  }
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mimeOf(name) }), { imageOrientation: "from-image" });
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

function scaled(c: HTMLCanvasElement, max: number): HTMLCanvasElement {
  const k = Math.min(1, max / Math.max(c.width, c.height));
  if (k >= 1) return c;
  const o = document.createElement("canvas");
  o.width = Math.round(c.width * k);
  o.height = Math.round(c.height * k);
  const g = o.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

/** Crea la ficha de una foto importada. */
export async function importPhoto(file: PickedFile): Promise<{ photo: Photo; full: HTMLCanvasElement }> {
  const full = await bytesToCanvas(file.bytes, file.name);
  const thumb = scaled(full, 360).toDataURL("image/jpeg", 0.82);
  // En el navegador no hay ruta: la foto se guarda dentro del catálogo (reducida a 3000 px)
  const data = isTauri && file.path ? null : scaled(full, 3000).toDataURL("image/jpeg", 0.92);
  const photo: Photo = {
    id: newId("ph"),
    name: file.name,
    path: isTauri ? file.path : null,
    data,
    thumb,
    width: full.width,
    height: full.height,
    added: Date.now(),
    rating: 0,
    flag: null,
    label: null,
    keywords: [],
    caption: "",
    exif: /\.jpe?g$/i.test(file.name) ? readExif(file.bytes) : {},
    edits: { ...DEFAULT_EDITS },
  };
  return { photo, full };
}

const originals = new Map<string, Promise<HTMLCanvasElement>>();

/** Original a resolución completa (se recuerda mientras la app está abierta). */
export function loadOriginal(p: Photo): Promise<HTMLCanvasElement> {
  let pr = originals.get(p.id);
  if (!pr) {
    pr = (async () => {
      if (p.path) return bytesToCanvas(await readFileBytes(p.path), p.name);
      const src = p.data || p.thumb;
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c;
    })();
    pr.catch(() => originals.delete(p.id));
    if (originals.size > 12) originals.delete(originals.keys().next().value!);
    originals.set(p.id, pr);
  }
  return pr;
}

export const rememberOriginal = (id: string, c: HTMLCanvasElement) => originals.set(id, Promise.resolve(c));
