// Exportación a glTF binario (.glb): un nodo por pieza (con su jerarquía de huesos),
// una malla por caja, un atlas PNG con todas las caras (muestreo sin suavizar) y las
// animaciones muestreadas a 24 fps. 16 unidades del editor = 1 metro (1 bloque).

import { facePixels, findAnimation, samplePose } from "./model";
import { CORNER_UV, FACE_GEOMETRY, QUAD_INDICES, faceCorners } from "./geometry";
import { FACES, TEX, UNITS_PER_BLOCK, type Model3D, type Vec3 } from "./types";

export const FPS = 24;
const S = 1 / UNITS_PER_BLOCK;

// ---------- PNG (sin dependencias: deflate en bloques sin comprimir) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const v of bytes) {
    a = (a + v) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 65535));
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4);
  let o = 0;
  out[o++] = 0x78;
  out[o++] = 0x01;
  for (let i = 0; i < blocks; i++) {
    const chunk = data.subarray(i * 65535, Math.min(data.length, (i + 1) * 65535));
    out[o++] = i === blocks - 1 ? 1 : 0;
    out[o++] = chunk.length & 0xff;
    out[o++] = chunk.length >> 8;
    out[o++] = ~chunk.length & 0xff;
    out[o++] = (~chunk.length >> 8) & 0xff;
    out.set(chunk, o);
    o += chunk.length;
  }
  new DataView(out.buffer).setUint32(o, adler32(data));
  return out;
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlibStored(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---------- Atlas ----------

export interface Atlas {
  width: number;
  height: number;
  rgba: Uint8Array;
  /** Posición en píxeles de cada cara: clave `${parte}:${cara}`. */
  rects: Map<string, { x: number; y: number }>;
}

export function buildAtlas(m: Model3D): Atlas {
  const faces: { key: string; px: Uint8Array }[] = [];
  for (const p of m.parts) if (p.box) for (const f of FACES) faces.push({ key: `${p.id}:${f}`, px: facePixels(p.box.faces[f]) });
  const cols = Math.max(1, Math.ceil(Math.sqrt(faces.length)));
  const rows = Math.max(1, Math.ceil(faces.length / cols));
  const width = cols * TEX;
  const height = rows * TEX;
  const rgba = new Uint8Array(width * height * 4);
  const rects = new Map<string, { x: number; y: number }>();
  faces.forEach((f, i) => {
    const x = (i % cols) * TEX;
    const y = Math.floor(i / cols) * TEX;
    rects.set(f.key, { x, y });
    for (let row = 0; row < TEX; row++) rgba.set(f.px.subarray(row * TEX * 4, (row + 1) * TEX * 4), ((y + row) * width + x) * 4);
  });
  return { width, height, rgba, rects };
}

// ---------- Utilidades ----------

/** Cuaternión de una rotación Euler XYZ en grados (igual que three.js). */
export function quatFromEuler(deg: Vec3): [number, number, number, number] {
  const [x, y, z] = deg.map((d) => (d * Math.PI) / 360);
  const [c1, c2, c3] = [Math.cos(x), Math.cos(y), Math.cos(z)];
  const [s1, s2, s3] = [Math.sin(x), Math.sin(y), Math.sin(z)];
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const r3 = (v: Vec3): Vec3 => [round(v[0]), round(v[1]), round(v[2])];

class BinWriter {
  chunks: Uint8Array[] = [];
  length = 0;
  views: { buffer: 0; byteOffset: number; byteLength: number; target?: number }[] = [];
  add(bytes: Uint8Array, target?: number): number {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) {
      this.chunks.push(new Uint8Array(pad));
      this.length += pad;
    }
    this.views.push({ buffer: 0, byteOffset: this.length, byteLength: bytes.length, ...(target ? { target } : {}) });
    this.chunks.push(bytes);
    this.length += bytes.length;
    return this.views.length - 1;
  }
  bytes(): Uint8Array {
    const pad = (4 - (this.length % 4)) % 4;
    const out = new Uint8Array(this.length + pad);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}

const f32 = (a: number[]) => new Uint8Array(new Float32Array(a).buffer);
const u16 = (a: number[]) => new Uint8Array(new Uint16Array(a).buffer);

// ---------- Exportación ----------

export function exportGlb(m: Model3D): Uint8Array {
  const bin = new BinWriter();
  const accessors: any[] = [];
  const addAccessor = (data: number[], type: "SCALAR" | "VEC2" | "VEC3" | "VEC4", opts: { indices?: boolean; minmax?: boolean; target?: number } = {}) => {
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    const view = bin.add(opts.indices ? u16(data) : f32(data), opts.target);
    const acc: any = { bufferView: view, componentType: opts.indices ? 5123 : 5126, count: data.length / comps, type };
    if (opts.minmax) {
      const min = Array(comps).fill(Infinity);
      const max = Array(comps).fill(-Infinity);
      for (let i = 0; i < data.length; i++) {
        min[i % comps] = Math.min(min[i % comps], data[i]);
        max[i % comps] = Math.max(max[i % comps], data[i]);
      }
      acc.min = min.map(round);
      acc.max = max.map(round);
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  const atlas = buildAtlas(m);
  const imageView = bin.add(encodePng(atlas.width, atlas.height, atlas.rgba));
  const nodeIndex = new Map(m.parts.map((p, i) => [p.id, i]));
  const meshes: any[] = [];
  const nodes = m.parts.map((p) => {
    const node: any = { name: p.name, translation: r3(p.pivot.map((v) => v * S) as Vec3) };
    if (p.rotation.some((r) => r !== 0)) node.rotation = quatFromEuler(p.rotation).map(round);
    const kids = m.parts.filter((c) => c.parent === p.id).map((c) => nodeIndex.get(c.id)!);
    if (kids.length) node.children = kids;
    if (p.box && p.visible) {
      const pos: number[] = [];
      const nor: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (const f of FACES) {
        const base = pos.length / 3;
        const rect = atlas.rects.get(`${p.id}:${f}`)!;
        faceCorners(p.box, f, S).forEach((c, i) => {
          pos.push(...r3(c));
          nor.push(...FACE_GEOMETRY[f].normal);
          // Medio texel hacia dentro para que el muestreo no tome la cara vecina.
          const [cu, cv] = CORNER_UV[i];
          uv.push((rect.x + 0.02 + cu * (TEX - 0.04)) / atlas.width, (rect.y + 0.02 + cv * (TEX - 0.04)) / atlas.height);
        });
        idx.push(...QUAD_INDICES.map((k) => k + base));
      }
      meshes.push({
        name: p.name,
        primitives: [
          {
            attributes: {
              POSITION: addAccessor(pos, "VEC3", { minmax: true, target: 34962 }),
              NORMAL: addAccessor(nor, "VEC3", { target: 34962 }),
              TEXCOORD_0: addAccessor(uv, "VEC2", { target: 34962 }),
            },
            indices: addAccessor(idx, "SCALAR", { indices: true, target: 34963 }),
            material: 0,
          },
        ],
      });
      node.mesh = meshes.length - 1;
    }
    return node;
  });

  const animations = m.animations
    .filter((a) => Object.keys(a.tracks).length)
    .map((a) => {
      const anim = findAnimation(m, a.id);
      const frames = Math.max(1, Math.round(anim.length * FPS));
      const times = Array.from({ length: frames + 1 }, (_, i) => round((i / frames) * anim.length));
      const input = addAccessor(times, "SCALAR", { minmax: true });
      const samplers: any[] = [];
      const channels: any[] = [];
      const poses = times.map((t) => samplePose(m, a.id, t === anim.length && anim.loop ? anim.length - 1e-9 : t));
      for (const pid of Object.keys(a.tracks)) {
        const part = m.parts.find((p) => p.id === pid);
        if (!part) continue;
        const node = nodeIndex.get(pid)!;
        const tr: number[] = [];
        const rot: number[] = [];
        const sc: number[] = [];
        for (const pose of poses) {
          const ps = pose.get(pid)!;
          tr.push(...r3([0, 1, 2].map((k) => (part.pivot[k] + ps.pos[k]) * S) as Vec3));
          rot.push(...quatFromEuler([0, 1, 2].map((k) => part.rotation[k] + ps.rot[k]) as Vec3).map(round));
          sc.push(...r3(ps.scale));
        }
        for (const [path, data, type] of [["translation", tr, "VEC3"], ["rotation", rot, "VEC4"], ["scale", sc, "VEC3"]] as const) {
          samplers.push({ input, output: addAccessor(data as number[], type), interpolation: "LINEAR" });
          channels.push({ sampler: samplers.length - 1, target: { node, path } });
        }
      }
      return { name: a.name, samplers, channels };
    });

  const binBytes = bin.bytes();
  const json: any = {
    asset: { version: "2.0", generator: "CoffeeAnimate3D (CoffeeWorks)" },
    scene: 0,
    scenes: [{ name: m.name, nodes: m.parts.filter((p) => !p.parent).map((p) => nodeIndex.get(p.id)!) }],
    nodes,
    meshes,
    materials: [{ name: "Textura", pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: imageView, mimeType: "image/png" }],
    accessors,
    bufferViews: bin.views,
    buffers: [{ byteLength: binBytes.length }],
  };
  if (animations.length) json.animations = animations;
  if (!meshes.length) delete json.meshes;

  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20);
    padded.set(jsonBytes);
    jsonBytes = padded;
  }
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  dv.setUint32(20 + jsonBytes.length, binBytes.length, true);
  dv.setUint32(24 + jsonBytes.length, 0x004e4942, true);
  out.set(binBytes, 28 + jsonBytes.length);
  return out;
}
