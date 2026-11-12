// Operaciones sobre el diseño: crear nodos, recorrer el árbol, agrupar,
// componentes, diseño automático y medición de textos. Todas devuelven
// copias nuevas (los nodos que no cambian se comparten).

import {
  DEVICES,
  PLATFORM_DEVICE,
  isContainer,
  type AutoLayout,
  type NodeType,
  type Page,
  type Paint,
  type Platform,
  type Stroke,
  type TextStyle,
  type UNode,
  type UxDocument,
} from "../types";

let counter = 0;
export const newId = (prefix = "n") => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const solid = (color: string, opacity = 1): Paint => ({ type: "solid", color, color2: "#ffffff", angle: 90, opacity });
export const stroke = (color: string, width = 1): Stroke => ({ color, width, opacity: 1, dash: false });

export const DEFAULT_FONT: TextStyle = {
  family: "Hanken Grotesk",
  size: 16,
  weight: 400,
  italic: false,
  underline: false,
  strike: false,
  align: "left",
  valign: "top",
  lineHeight: 1.3,
  letterSpacing: 0,
  transform: "none",
  autoSize: "width",
};

export const DEFAULT_LAYOUT: AutoLayout = {
  mode: "column",
  gap: 12,
  padding: { top: 16, right: 16, bottom: 16, left: 16 },
  justify: "start",
  align: "start",
};

const DEFAULT_NAMES: Record<NodeType, string> = {
  frame: "Marco",
  group: "Grupo",
  component: "Componente",
  instance: "Instancia",
  rect: "Rectángulo",
  ellipse: "Elipse",
  line: "Línea",
  polygon: "Polígono",
  star: "Estrella",
  path: "Trazado",
  text: "Texto",
  image: "Imagen",
};

/** Crea un nodo con valores por omisión según su tipo. */
export function makeNode(type: NodeType, patch: Partial<UNode> = {}): UNode {
  const base: UNode = {
    id: newId(type.slice(0, 3)),
    type,
    name: DEFAULT_NAMES[type],
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: solid("#d9d9d9"),
    stroke: null,
    radius: 0,
    shadow: null,
    blur: 0,
    sizing: { w: "fixed", h: "fixed" },
  };
  if (type === "frame" || type === "component") {
    Object.assign(base, { fill: solid("#ffffff"), children: [], clip: true, layout: { ...DEFAULT_LAYOUT, mode: "none" } });
  } else if (type === "group") {
    Object.assign(base, { fill: null, children: [] });
  } else if (type === "text") {
    Object.assign(base, { fill: solid("#1e1e1e"), text: "Texto", font: { ...DEFAULT_FONT }, w: 40, h: 21 });
  } else if (type === "line") {
    Object.assign(base, { fill: null, stroke: stroke("#1e1e1e", 2), h: 0 });
  } else if (type === "polygon") {
    Object.assign(base, { sides: 3 });
  } else if (type === "star") {
    Object.assign(base, { sides: 5, innerRatio: 0.45 });
  } else if (type === "path") {
    Object.assign(base, { fill: null, stroke: stroke("#1e1e1e", 2), points: [], closed: false });
  } else if (type === "image") {
    Object.assign(base, { fill: solid("#eeeeee"), fit: "cover" as const });
  } else if (type === "instance") {
    Object.assign(base, { fill: null, overrides: {} });
  }
  const node = { ...base, ...patch };
  if (type === "text") return measureText(node);
  return node;
}

export function newPage(name = "Página 1"): Page {
  return { id: newId("pg"), name, background: "#f5f5f5", nodes: {}, children: [] };
}

export function newDocument(platform: Platform = "mobile"): UxDocument {
  const page = newPage();
  const device = DEVICES.find((d) => d.id === PLATFORM_DEVICE[platform])!;
  const frame = makeNode("frame", { name: device.name, x: 0, y: 0, w: device.w, h: device.h, device: device.id });
  page.nodes[frame.id] = frame;
  page.children.push(frame.id);
  page.startFrame = frame.id;
  return {
    format: "coffeeuiux",
    version: 1,
    platform,
    pages: [page],
    currentPage: page.id,
    colorStyles: [
      { id: newId("cs"), name: "Primario", color: "#0d99ff" },
      { id: newId("cs"), name: "Texto", color: "#1e1e1e" },
      { id: newId("cs"), name: "Fondo", color: "#ffffff" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Árbol
// ---------------------------------------------------------------------------

export function parentOf(page: Page, id: string): string | null {
  for (const node of Object.values(page.nodes)) if (node.children?.includes(id)) return node.id;
  return null;
}

export function parentMap(page: Page): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const id of page.children) map.set(id, null);
  for (const node of Object.values(page.nodes)) for (const child of node.children || []) map.set(child, node.id);
  return map;
}

export function siblingsOf(page: Page, parent: string | null): string[] {
  return parent ? page.nodes[parent]?.children || [] : page.children;
}

/** Posición absoluta (en el lienzo) de un nodo. */
export function absolutePos(page: Page, id: string, parents = parentMap(page)): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: string | null | undefined = id;
  while (current) {
    const n: UNode | undefined = page.nodes[current];
    if (!n) break;
    x += n.x;
    y += n.y;
    current = parents.get(current);
  }
  return { x, y };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function absoluteBox(page: Page, id: string, parents = parentMap(page)): Box {
  const n = page.nodes[id];
  const p = absolutePos(page, id, parents);
  return normBox({ x: p.x, y: p.y, w: n?.w || 0, h: n?.h || 0 });
}

/** Las líneas pueden tener ancho o alto negativo (van de un punto a otro). */
export function normBox(b: Box): Box {
  return { x: b.w < 0 ? b.x + b.w : b.x, y: b.h < 0 ? b.y + b.h : b.y, w: Math.abs(b.w), h: Math.abs(b.h) };
}

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function descendants(page: Page, id: string): string[] {
  const out: string[] = [];
  const walk = (nid: string) => {
    for (const c of page.nodes[nid]?.children || []) {
      out.push(c);
      walk(c);
    }
  };
  walk(id);
  return out;
}

export function ancestors(page: Page, id: string, parents = parentMap(page)): string[] {
  const out: string[] = [];
  let current = parents.get(id);
  while (current) {
    out.push(current);
    current = parents.get(current);
  }
  return out;
}

/** Quita de la lista los nodos cuyo antecesor también está en ella. */
export function topLevelOnly(page: Page, ids: string[]): string[] {
  const set = new Set(ids);
  const parents = parentMap(page);
  return ids.filter((id) => !ancestors(page, id, parents).some((a) => set.has(a)));
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

export function updateNodes(page: Page, patches: Record<string, Partial<UNode>>): Page {
  const nodes = { ...page.nodes };
  for (const [id, patch] of Object.entries(patches)) {
    if (!nodes[id]) continue;
    let next = { ...nodes[id], ...patch };
    if (next.type === "text" && ("text" in patch || "font" in patch || "w" in patch)) next = measureText(next);
    nodes[id] = next;
  }
  return applyLayouts({ ...page, nodes });
}

/** Inserta nodos (ya creados) bajo un padre, al final o en una posición. */
export function insertNodes(page: Page, created: UNode[], parent: string | null, rootIds: string[], index?: number): Page {
  const nodes = { ...page.nodes };
  for (const n of created) nodes[n.id] = n;
  let children = page.children;
  if (parent && nodes[parent]) {
    const list = [...(nodes[parent].children || [])];
    list.splice(index ?? list.length, 0, ...rootIds);
    nodes[parent] = { ...nodes[parent], children: list };
  } else {
    children = [...page.children];
    children.splice(index ?? children.length, 0, ...rootIds);
  }
  return applyLayouts({ ...page, nodes, children });
}

export function deleteNodes(page: Page, ids: string[]): Page {
  const remove = new Set<string>();
  for (const id of ids) {
    remove.add(id);
    descendants(page, id).forEach((d) => remove.add(d));
  }
  const nodes: Record<string, UNode> = {};
  for (const [id, n] of Object.entries(page.nodes)) {
    if (remove.has(id)) continue;
    nodes[id] = n.children?.some((c) => remove.has(c)) ? { ...n, children: n.children.filter((c) => !remove.has(c)) } : n;
  }
  return applyLayouts({
    ...page,
    nodes,
    children: page.children.filter((c) => !remove.has(c)),
    startFrame: page.startFrame && remove.has(page.startFrame) ? undefined : page.startFrame,
  });
}

/** Copia profunda de nodos con identificadores nuevos. */
export function cloneSubtrees(page: Page, ids: string[]): { nodes: UNode[]; roots: string[]; map: Map<string, string> } {
  const map = new Map<string, string>();
  const out: UNode[] = [];
  const copy = (id: string): string => {
    const n = page.nodes[id];
    const nid = newId(n.type.slice(0, 3));
    map.set(id, nid);
    const children = n.children?.map(copy);
    out.push({ ...n, id: nid, children });
    return nid;
  };
  const roots = ids.filter((id) => page.nodes[id]).map(copy);
  // Los enlaces de prototipo entre nodos copiados apuntan a las copias
  for (const n of out) if (n.link && map.has(n.link.target)) n.link = { ...n.link, target: map.get(n.link.target)! };
  return { nodes: out, roots, map };
}

export function duplicate(page: Page, ids: string[], offset = 16): { page: Page; ids: string[] } {
  let next = page;
  const created: string[] = [];
  const parents = parentMap(page);
  for (const id of topLevelOnly(page, ids)) {
    const parent = parents.get(id) ?? null;
    const { nodes, roots } = cloneSubtrees(next, [id]);
    const root = nodes.find((n) => n.id === roots[0])!;
    const inLayout = parent && next.nodes[parent]?.layout && next.nodes[parent].layout!.mode !== "none";
    if (!inLayout) {
      root.x += offset;
      root.y += offset;
    }
    root.name = next.nodes[id].name;
    const siblings = siblingsOf(next, parent);
    next = insertNodes(next, nodes, parent, roots, siblings.indexOf(id) + 1);
    created.push(roots[0]);
  }
  return { page: next, ids: created };
}

/** Mueve nodos a otro padre conservando su posición en pantalla. */
export function reparent(page: Page, ids: string[], target: string | null, index?: number): Page {
  const parents = parentMap(page);
  const targetPos = target ? absolutePos(page, target, parents) : { x: 0, y: 0 };
  const nodes = { ...page.nodes };
  let children = [...page.children];
  const moving = topLevelOnly(page, ids).filter((id) => id !== target && !(target && ancestors(page, target, parents).includes(id)));
  for (const id of moving) {
    const abs = absolutePos(page, id, parents);
    const old = parents.get(id) ?? null;
    if (old) nodes[old] = { ...nodes[old], children: (nodes[old].children || []).filter((c) => c !== id) };
    else children = children.filter((c) => c !== id);
    nodes[id] = { ...nodes[id], x: Math.round(abs.x - targetPos.x), y: Math.round(abs.y - targetPos.y) };
  }
  if (target) {
    const list = [...(nodes[target].children || [])];
    list.splice(index ?? list.length, 0, ...moving);
    nodes[target] = { ...nodes[target], children: list };
  } else {
    children.splice(index ?? children.length, 0, ...moving);
  }
  return applyLayouts({ ...page, nodes, children });
}

/** Agrupa nodos hermanos en un grupo (o en un marco). */
export function groupNodes(page: Page, ids: string[], type: "group" | "frame" = "group"): { page: Page; id: string | null } {
  const parents = parentMap(page);
  const tops = topLevelOnly(page, ids);
  if (!tops.length) return { page, id: null };
  const parent = parents.get(tops[0]) ?? null;
  const same = tops.filter((id) => (parents.get(id) ?? null) === parent);
  const boxes = same.map((id) => normBox(page.nodes[id]));
  const box = unionBox(boxes)!;
  const siblings = siblingsOf(page, parent);
  const index = Math.min(...same.map((id) => siblings.indexOf(id)));
  const group = makeNode(type, { x: box.x, y: box.y, w: box.w, h: box.h, ...(type === "frame" ? { fill: null, clip: false } : {}) });
  const nodes = { ...page.nodes, [group.id]: { ...group, children: siblings.filter((id) => same.includes(id)) } };
  for (const id of same) nodes[id] = { ...nodes[id], x: nodes[id].x - box.x, y: nodes[id].y - box.y };
  const newSiblings = siblings.filter((id) => !same.includes(id));
  newSiblings.splice(index, 0, group.id);
  let next: Page = { ...page, nodes };
  if (parent) next.nodes[parent] = { ...next.nodes[parent], children: newSiblings };
  else next.children = newSiblings;
  next = applyLayouts(next);
  return { page: next, id: group.id };
}

export function ungroup(page: Page, ids: string[]): { page: Page; ids: string[] } {
  let next = page;
  const released: string[] = [];
  for (const id of ids) {
    const g = next.nodes[id];
    if (!g || !(g.type === "group" || g.type === "frame") || !g.children?.length) continue;
    const parents = parentMap(next);
    const parent = parents.get(id) ?? null;
    const siblings = siblingsOf(next, parent);
    const index = siblings.indexOf(id);
    const nodes = { ...next.nodes };
    for (const c of g.children) {
      nodes[c] = { ...nodes[c], x: nodes[c].x + g.x, y: nodes[c].y + g.y };
      released.push(c);
    }
    const list = [...siblings];
    list.splice(index, 1, ...g.children);
    delete nodes[id];
    next = { ...next, nodes };
    if (parent) next.nodes[parent] = { ...next.nodes[parent], children: list };
    else next.children = list;
  }
  return { page: applyLayouts(next), ids: released };
}

export function reorder(page: Page, ids: string[], where: "front" | "back" | "forward" | "backward"): Page {
  const parents = parentMap(page);
  let next = page;
  for (const id of ids) {
    const parent = parents.get(id) ?? null;
    const list = [...siblingsOf(next, parent)];
    const i = list.indexOf(id);
    if (i < 0) continue;
    list.splice(i, 1);
    const j = where === "front" ? list.length : where === "back" ? 0 : where === "forward" ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
    list.splice(j, 0, id);
    next = parent ? { ...next, nodes: { ...next.nodes, [parent]: { ...next.nodes[parent], children: list } } } : { ...next, children: list };
  }
  return applyLayouts(next);
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

/** Convierte un nodo en componente (los marcos y grupos conservan sus hijos). */
export function makeComponent(page: Page, id: string): { page: Page; id: string } {
  const n = page.nodes[id];
  if (!n) return { page, id };
  if (n.type === "frame" || n.type === "group") {
    const comp: UNode = { ...n, type: "component", clip: n.clip ?? false, layout: n.layout || { ...DEFAULT_LAYOUT, mode: "none" } };
    return { page: updateNodesRaw(page, { [id]: comp }), id };
  }
  const { page: grouped, id: gid } = groupNodes(page, [id], "frame");
  if (!gid) return { page, id };
  const g = grouped.nodes[gid];
  return { page: updateNodesRaw(grouped, { [gid]: { ...g, type: "component", name: n.name, fill: null, clip: false, layout: { ...DEFAULT_LAYOUT, mode: "none" } } }), id: gid };
}

function updateNodesRaw(page: Page, nodes: Record<string, UNode>): Page {
  return applyLayouts({ ...page, nodes: { ...page.nodes, ...nodes } });
}

export function findComponent(doc: UxDocument, id: string): { page: Page; node: UNode } | null {
  for (const page of doc.pages) {
    const node = page.nodes[id];
    if (node?.type === "component") return { page, node };
  }
  return null;
}

export function allComponents(doc: UxDocument): { page: Page; node: UNode }[] {
  return doc.pages.flatMap((page) => Object.values(page.nodes).filter((n) => n.type === "component").map((node) => ({ page, node })));
}

export function makeInstance(doc: UxDocument, componentId: string, x: number, y: number): UNode | null {
  const found = findComponent(doc, componentId);
  if (!found) return null;
  return makeNode("instance", { name: found.node.name, componentId, x, y, w: found.node.w, h: found.node.h, radius: found.node.radius });
}

/** Separa una instancia de su componente (pasa a ser un marco editable). */
export function detachInstance(doc: UxDocument, page: Page, id: string): Page {
  const inst = page.nodes[id];
  const found = inst?.componentId ? findComponent(doc, inst.componentId) : null;
  if (!inst || !found) return page;
  const { nodes, roots, map } = cloneSubtrees(found.page, found.node.children || []);
  for (const n of nodes) {
    const original = [...map.entries()].find(([, v]) => v === n.id)?.[0];
    const o = original ? inst.overrides?.[original] : undefined;
    if (o?.text !== undefined) Object.assign(n, measureText({ ...n, text: o.text }));
    if (o?.fill !== undefined) n.fill = o.fill;
    if (o?.visible !== undefined) n.visible = o.visible;
  }
  const frame: UNode = {
    ...found.node,
    id: inst.id,
    type: "frame",
    name: inst.name,
    x: inst.x,
    y: inst.y,
    w: inst.w,
    h: inst.h,
    children: roots,
    link: inst.link,
  };
  const all: Record<string, UNode> = { ...page.nodes, [inst.id]: frame };
  for (const n of nodes) all[n.id] = n;
  return applyLayouts({ ...page, nodes: all });
}

// ---------------------------------------------------------------------------
// Diseño automático
// ---------------------------------------------------------------------------

const hasLayout = (n: UNode | undefined) => !!n?.layout && n.layout.mode !== "none" && !!n.children;

/** Recalcula las posiciones de los hijos de los marcos con diseño automático. */
export function applyLayouts(page: Page): Page {
  const containers = Object.values(page.nodes).filter((n) => hasLayout(n));
  if (!containers.length) return page;
  const nodes = { ...page.nodes };
  const done = new Set<string>();
  const run = (id: string) => {
    if (done.has(id)) return;
    done.add(id);
    const frame = nodes[id];
    for (const c of frame.children || []) if (hasLayout(nodes[c])) run(c);
    layoutOne(nodes, id);
  };
  // De dentro hacia fuera: los hijos se ajustan antes que sus padres
  for (const n of containers) run(n.id);
  return { ...page, nodes };
}

function layoutOne(nodes: Record<string, UNode>, id: string) {
  const f = nodes[id];
  const L = f.layout!;
  const row = L.mode === "row";
  const kids = (f.children || []).map((c) => nodes[c]).filter((k) => k && k.visible);
  const pad = L.padding;
  const mainOf = (k: UNode) => (row ? k.w : k.h);
  const crossOf = (k: UNode) => (row ? k.h : k.w);
  const mainMode = (k: UNode) => (row ? k.sizing.w : k.sizing.h);
  const crossMode = (k: UNode) => (row ? k.sizing.h : k.sizing.w);
  const gaps = Math.max(0, kids.length - 1) * L.gap;
  const hugMain = (row ? f.sizing.w : f.sizing.h) === "hug";
  const hugCross = (row ? f.sizing.h : f.sizing.w) === "hug";

  const fixedMain = kids.filter((k) => mainMode(k) !== "fill").reduce((s, k) => s + mainOf(k), 0);
  const fills = kids.filter((k) => mainMode(k) === "fill");
  let frameMain = row ? f.w : f.h;
  let frameCross = row ? f.h : f.w;
  const padMain = row ? pad.left + pad.right : pad.top + pad.bottom;
  const padCross = row ? pad.top + pad.bottom : pad.left + pad.right;
  if (hugMain) frameMain = fixedMain + fills.reduce((s, k) => s + mainOf(k), 0) + gaps + padMain;
  const innerMain = frameMain - padMain;
  const fillSize = fills.length ? Math.max(1, (innerMain - fixedMain - gaps) / fills.length) : 0;
  const sizes = kids.map((k) => (mainMode(k) === "fill" ? fillSize : mainOf(k)));
  if (hugCross) frameCross = Math.max(0, ...kids.filter((k) => crossMode(k) !== "fill").map(crossOf)) + padCross;
  const innerCross = frameCross - padCross;

  const used = sizes.reduce((s, v) => s + v, 0) + gaps;
  let cursor = row ? pad.left : pad.top;
  let gap = L.gap;
  if (!fills.length) {
    if (L.justify === "center") cursor += (innerMain - used) / 2;
    else if (L.justify === "end") cursor += innerMain - used;
    else if (L.justify === "space-between" && kids.length > 1) gap = (innerMain - (used - gaps)) / (kids.length - 1);
  }
  kids.forEach((k, i) => {
    const main = sizes[i];
    const cross = crossMode(k) === "fill" ? innerCross : crossOf(k);
    const crossStart = row ? pad.top : pad.left;
    const offset = L.align === "center" ? (innerCross - cross) / 2 : L.align === "end" ? innerCross - cross : 0;
    const patch = row
      ? { x: Math.round(cursor), y: Math.round(crossStart + offset), w: Math.round(main), h: Math.round(cross) }
      : { x: Math.round(crossStart + offset), y: Math.round(cursor), w: Math.round(cross), h: Math.round(main) };
    let next = { ...k, ...patch };
    if (next.type === "text" && next.w !== k.w) next = measureText({ ...next, font: { ...next.font!, autoSize: next.font!.autoSize === "width" ? "height" : next.font!.autoSize } });
    nodes[k.id] = next;
    cursor += main + gap;
  });
  const size = row ? { w: Math.round(frameMain), h: Math.round(frameCross) } : { w: Math.round(frameCross), h: Math.round(frameMain) };
  if (size.w !== f.w || size.h !== f.h) nodes[id] = { ...f, ...size };
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;

export function fontCss(font: TextStyle): string {
  return `${font.italic ? "italic " : ""}${font.weight} ${font.size}px "${font.family}", "Segoe UI", sans-serif`;
}

const transformText = (text: string, font: TextStyle) =>
  font.transform === "uppercase" ? text.toUpperCase() : font.transform === "lowercase" ? text.toLowerCase() : text;

export function textWidth(text: string, font: TextStyle): number {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * font.size * 0.55;
  measureCtx.font = fontCss(font);
  return measureCtx.measureText(text).width + Math.max(0, text.length - 1) * font.letterSpacing;
}

/** Divide el texto en líneas según el ancho disponible. */
export function wrapText(text: string, font: TextStyle, width: number | null): string[] {
  const out: string[] = [];
  for (const paragraph of transformText(text, font).split("\n")) {
    if (width === null || !paragraph) {
      out.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word;
      if (line && textWidth(candidate.trimEnd(), font) > width) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = candidate;
    }
    out.push(line);
  }
  return out;
}

/** Ajusta el tamaño de un texto según su modo de tamaño automático. */
export function measureText(n: UNode): UNode {
  if (n.type !== "text" || !n.font) return n;
  const font = n.font;
  const lineH = font.size * font.lineHeight;
  if (font.autoSize === "width") {
    const lines = wrapText(n.text || "", font, null);
    const w = Math.ceil(Math.max(1, ...lines.map((l) => textWidth(l, font))));
    return { ...n, w, h: Math.ceil(lines.length * lineH) };
  }
  if (font.autoSize === "height") {
    const lines = wrapText(n.text || "", font, n.w);
    return { ...n, h: Math.ceil(Math.max(1, lines.length) * lineH) };
  }
  return n;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export function currentPage(doc: UxDocument): Page {
  return doc.pages.find((p) => p.id === doc.currentPage) || doc.pages[0];
}

export function withPage(doc: UxDocument, page: Page): UxDocument {
  return { ...doc, pages: doc.pages.map((p) => (p.id === page.id ? page : p)) };
}

const isNum = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Lee un diseño guardado completando lo que falte. */
export function parseDocument(text: string): UxDocument {
  let raw: Partial<UxDocument>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un diseño de CoffeeUI/UX válido.");
  }
  if (!raw || raw.format !== "coffeeuiux" || !Array.isArray(raw.pages)) throw new Error("El archivo no es un diseño de CoffeeUI/UX válido.");
  const pages: Page[] = raw.pages.map((p, i) => {
    const nodes: Record<string, UNode> = {};
    for (const [id, n] of Object.entries(p.nodes || {})) {
      if (!n || typeof n.type !== "string") continue;
      const base = makeNode(n.type as NodeType);
      nodes[id] = {
        ...base,
        ...n,
        id,
        x: isNum(n.x, 0),
        y: isNum(n.y, 0),
        w: isNum(n.w, 100),
        h: isNum(n.h, 100),
        sizing: { ...base.sizing, ...(n.sizing || {}) },
        font: base.font ? { ...base.font, ...(n.font || {}) } : n.font,
      };
    }
    for (const n of Object.values(nodes)) if (n.children) n.children = n.children.filter((c) => nodes[c]);
    return {
      id: p.id || newId("pg"),
      name: p.name || `Página ${i + 1}`,
      background: p.background || "#f5f5f5",
      nodes,
      children: (p.children || []).filter((c) => nodes[c]),
      startFrame: p.startFrame && nodes[p.startFrame] ? p.startFrame : undefined,
    };
  });
  if (!pages.length) pages.push(newPage());
  return {
    format: "coffeeuiux",
    version: 1,
    platform: raw.platform === "desktop" || raw.platform === "web" ? raw.platform : "mobile",
    pages,
    currentPage: pages.some((p) => p.id === raw.currentPage) ? raw.currentPage! : pages[0].id,
    colorStyles: Array.isArray(raw.colorStyles) ? raw.colorStyles : [],
  };
}

export const serializeDocument = (doc: UxDocument) => JSON.stringify(doc);

/** Marcos de primer nivel de una página (pantallas del prototipo). */
export const topFrames = (page: Page) => page.children.map((id) => page.nodes[id]).filter((n) => n && (n.type === "frame" || n.type === "component"));

export { isContainer };
