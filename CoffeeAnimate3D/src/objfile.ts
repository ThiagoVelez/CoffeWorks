// Exportar a OBJ (posiciones en bloques, UV al atlas, material con la textura PNG) y
// leer OBJ ajenos como malla de referencia para calcar encima.

import { buildAtlas, encodePng } from "./gltf";
import { meshGeometry } from "./meshgeo";
import { hexToRgb, meshTexturePixels } from "./model";
import { shapeGeometry } from "./geometry";
import { quatFromEuler, rotateVec } from "./rotation";
import { TEX, UNITS_PER_BLOCK, type FaceName, type Model3D, type Part, type Vec3 } from "./types";

export interface RefMesh {
  positions: number[];
  indices: number[];
}

const fmt = (v: number) => String(Math.round(v * 1e5) / 1e5 + 0);

/** Punto de una pieza en coordenadas del mundo, en la pose de reposo. */
function toWorld(m: Model3D, part: Part, v: Vec3): Vec3 {
  const r = rotateVec(quatFromEuler(part.rotation), v);
  const p: Vec3 = [part.pivot[0] + r[0], part.pivot[1] + r[1], part.pivot[2] + r[2]];
  const parent = part.parent ? m.parts.find((x) => x.id === part.parent) : null;
  return parent ? toWorld(m, parent, p) : p;
}

/** Nombre de archivo sin espacios (muchos lectores de OBJ cortan `mtllib` en el primer espacio). */
export function objFileBase(name: string): string {
  return name.trim().replace(/\s+/g, "_") || "modelo";
}

export function exportObj(m: Model3D, name: string): { obj: string; mtl: string; pngs: { name: string; data: Uint8Array }[] } {
  const baseName = objFileBase(name);
  const atlas = buildAtlas(m);
  const out = [`# CoffeeAnimate3D (CoffeeWorks): ${m.name}`, `# 1 unidad = 1 bloque`, `mtllib ${baseName}.mtl`];
  let base = 1;
  for (const p of m.parts) {
    if (!p.box || !p.visible) continue;
    const g = shapeGeometry(p.box);
    const faceOf: FaceName[] = new Array(g.positions.length / 3);
    for (const grp of g.groups) for (let k = grp.start; k < grp.start + grp.count; k++) faceOf[g.indices[k]] = grp.face;
    out.push(`o ${p.name.replace(/\s+/g, " ")}`, "usemtl atlas");
    for (let i = 0; i < g.positions.length; i += 3) {
      const w = toWorld(m, p, [g.positions[i], g.positions[i + 1], g.positions[i + 2]]);
      out.push(`v ${w.map((x) => fmt(x / UNITS_PER_BLOCK)).join(" ")}`);
    }
    for (let v = 0; v < faceOf.length; v++) {
      const rect = atlas.rects.get(`${p.id}:${faceOf[v]}`)!;
      const u = (rect.x + 0.02 + g.uvs[v * 2] * (TEX - 0.04)) / atlas.width;
      const t = (rect.y + 0.02 + g.uvs[v * 2 + 1] * (TEX - 0.04)) / atlas.height;
      out.push(`vt ${fmt(u)} ${fmt(1 - t)}`);
    }
    for (let i = 0; i < g.indices.length; i += 3) {
      const [a, b, c] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]].map((x) => x + base);
      out.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
    }
    base += g.positions.length / 3;
  }
  // Mallas libres: en reposo, con simetría y suavizado aplicados; cada una con su material.
  const mtlLines = [`# CoffeeAnimate3D`, `newmtl atlas`, `Kd 1 1 1`, `d 1`, `illum 1`, `map_Kd ${baseName}.png`, ""];
  const pngs = [{ name: `${baseName}.png`, data: encodePng(atlas.width, atlas.height, atlas.rgba) }];
  const usedNames = new Set<string>();
  for (const p of m.parts) {
    if (!p.mesh || !p.visible) continue;
    const g = meshGeometry(p.mesh);
    if (!g.indices.length) continue;
    let mat = `${baseName}_${objFileBase(p.name)}`;
    for (let k = 2; usedNames.has(mat); k++) mat = `${baseName}_${objFileBase(p.name)}_${k}`;
    usedNames.add(mat);
    if (p.mesh.uvs.length) {
      mtlLines.push(`newmtl ${mat}`, `Kd 1 1 1`, `d 1`, `illum 1`, `map_Kd ${mat}.png`, "");
      pngs.push({ name: `${mat}.png`, data: encodePng(p.mesh.texture.size, p.mesh.texture.size, meshTexturePixels(p.mesh.texture)) });
    } else mtlLines.push(`newmtl ${mat}`, `Kd ${hexToRgb(p.mesh.texture.color).map((c) => fmt(c / 255)).join(" ")}`, `d 1`, `illum 1`, "");
    out.push(`o ${p.name.replace(/\s+/g, " ")}`, `usemtl ${mat}`);
    for (let i = 0; i < g.positions.length; i += 3) {
      const w = toWorld(m, p, [g.positions[i], g.positions[i + 1], g.positions[i + 2]]);
      out.push(`v ${w.map((x) => fmt(x / UNITS_PER_BLOCK)).join(" ")}`);
    }
    for (let i = 0; i < g.uvs.length; i += 2) out.push(`vt ${fmt(g.uvs[i])} ${fmt(1 - g.uvs[i + 1])}`);
    for (let i = 0; i < g.indices.length; i += 3) {
      const [a, b, c] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]].map((x) => x + base);
      out.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
    }
    base += g.positions.length / 3;
  }
  return { obj: out.join("\n") + "\n", mtl: mtlLines.join("\n"), pngs };
}

/** Lee un OBJ: posiciones y triángulos (los polígonos se dividen en abanico). */
export function parseObj(text: string): RefMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("v ")) {
      const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
      positions.push(x || 0, y || 0, z || 0);
    } else if (line.startsWith("f ")) {
      const count = positions.length / 3;
      const ids = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const n = parseInt(tok.split("/")[0], 10);
          return n < 0 ? count + n : n - 1;
        })
        .filter((n) => Number.isInteger(n) && n >= 0 && n < count);
      for (let i = 1; i + 1 < ids.length; i++) indices.push(ids[0], ids[i], ids[i + 1]);
    }
  }
  if (!indices.length) throw new Error("El archivo OBJ no tiene caras");
  return { positions, indices };
}

/** OBJ como malla de referencia, en unidades del editor (el OBJ va en bloques o metros: ×16). */
export function objReference(text: string): RefMesh {
  const r = parseObj(text);
  return { positions: r.positions.map((v) => v * UNITS_PER_BLOCK), indices: r.indices };
}
