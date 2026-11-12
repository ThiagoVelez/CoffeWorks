// Lienzo de CoffeeUI/UX: dibujo, selección, mover, redimensionar, rotar,
// guías inteligentes, zoom, edición de textos y soltar elementos.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Page, Tool, UNode, UxDocument } from "../types";
import { SELECT, isContainer } from "../types";
import {
  absoluteBox,
  absolutePos,
  ancestors,
  deleteNodes,
  descendants,
  duplicate,
  fontCss,
  insertNodes,
  makeNode,
  normBox,
  parentMap,
  reparent,
  solid,
  topLevelOnly,
  unionBox,
  updateNodes,
  type Box,
} from "../services/model";
import { renderNode } from "../services/render";

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasHandle {
  /** Centro visible del lienzo, en coordenadas del lienzo. */
  center: () => { x: number; y: number };
  zoomTo: (box: Box | null) => void;
  zoomBy: (factor: number) => void;
  editText: (id: string) => void;
}

interface CanvasProps {
  doc: UxDocument;
  page: Page;
  selection: string[];
  onSelect: (ids: string[]) => void;
  tool: Tool;
  onToolDone: () => void;
  viewport: Viewport;
  onViewport: (v: Viewport) => void;
  onChange: (page: Page, key?: string) => void;
  /** Se suelta un elemento de la biblioteca, un componente o una imagen. */
  onDropItem: (data: DataTransfer, at: { x: number; y: number }, parent: string | null) => void;
  showLinks: boolean;
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "rot" | "p0" | "p1";

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; container: string | null; base: string[] }
  | { kind: "move"; x0: number; y0: number; start: Page; ids: string[]; key: string; moved: boolean; layoutParent: string | null }
  | { kind: "resize"; handle: Handle; x0: number; y0: number; start: Page; ids: string[]; box: Box; key: string }
  | { kind: "rotate"; cx: number; cy: number; start: Page; id: string; key: string; a0: number; r0: number }
  | { kind: "draw"; tool: Tool; x0: number; y0: number; x1: number; y1: number; parent: string | null }
  | { kind: "pencil"; points: [number, number][]; parent: string | null };

const HANDLE = 8;
const SNAP = 5;

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(props, ref) {
  const { doc, page, selection, onSelect, tool, onToolDone, viewport, onViewport, onChange, onDropItem, showLinks } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [editing, setEditing] = useState<string | null>(null);
  const [pen, setPen] = useState<{ points: [number, number][]; parent: string | null; cursor: [number, number] | null } | null>(null);
  const spaceRef = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;

  const setG = (g: Gesture | null) => {
    gestureRef.current = g;
    setGesture(g);
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const parents = useMemo(() => parentMap(page), [page]);
  const toWorld = (cx: number, cy: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - viewport.x) / viewport.zoom, y: (cy - r.top - viewport.y) / viewport.zoom };
  };
  const toScreen = (x: number, y: number) => ({ x: x * viewport.zoom + viewport.x, y: y * viewport.zoom + viewport.y });

  useImperativeHandle(ref, () => ({
    center: () => ({ x: (size.w / 2 - viewport.x) / viewport.zoom, y: (size.h / 2 - viewport.y) / viewport.zoom }),
    zoomTo: (box) => {
      if (!box || box.w <= 0 || box.h <= 0) {
        onViewport({ x: size.w / 2, y: size.h / 2, zoom: 1 });
        return;
      }
      const zoom = Math.min(4, Math.max(0.05, Math.min((size.w - 120) / box.w, (size.h - 120) / box.h)));
      onViewport({ zoom, x: size.w / 2 - (box.x + box.w / 2) * zoom, y: size.h / 2 - (box.y + box.h / 2) * zoom });
    },
    zoomBy: (factor) => zoomAt(size.w / 2, size.h / 2, viewport.zoom * factor),
    editText: (id) => setEditing(id),
  }));

  const zoomAt = (sx: number, sy: number, zoom: number) => {
    const z = Math.min(32, Math.max(0.02, zoom));
    const wx = (sx - viewport.x) / viewport.zoom;
    const wy = (sy - viewport.y) / viewport.zoom;
    onViewport({ zoom: z, x: sx - wx * z, y: sy - wy * z });
  };

  // Rueda: desplazar; Ctrl + rueda (o pellizco): zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, viewport.zoom * Math.exp(-e.deltaY * 0.0025));
      else onViewport({ ...viewport, x: viewport.x - (e.shiftKey ? e.deltaY : e.deltaX), y: viewport.y - (e.shiftKey ? 0 : e.deltaY) });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]")) spaceRef.current = true;
      if (pen && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault();
        finishPen(e.key === "Escape");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  // -------------------------------------------------------------------------
  // Ayudas
  // -------------------------------------------------------------------------

  /** Contenedor (marco o componente) más profundo bajo un punto. */
  const containerAt = (x: number, y: number, exclude: Set<string> = new Set()): string | null => {
    let best: string | null = null;
    let bestDepth = -1;
    for (const n of Object.values(page.nodes)) {
      if (!(n.type === "frame" || n.type === "component") || !n.visible || exclude.has(n.id)) continue;
      if (ancestors(page, n.id, parents).some((a) => exclude.has(a))) continue;
      const b = absoluteBox(page, n.id, parents);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const depth = ancestors(page, n.id, parents).length;
        if (depth > bestDepth) {
          best = n.id;
          bestDepth = depth;
        }
      }
    }
    return best;
  };

  /** Qué nodo se selecciona al hacer clic sobre el más profundo. */
  const pickTarget = (deepest: string, deep: boolean): string => {
    if (deep) return deepest;
    const chain = [deepest, ...ancestors(page, deepest, parents)]; // de dentro hacia fuera
    const rootFirst = [...chain].reverse();
    // Si ya hay algo seleccionado dentro de un contenedor de esta cadena, se queda en ese nivel
    for (const sel of selection) {
      const selParent = parents.get(sel) ?? null;
      if (selParent && rootFirst.includes(selParent)) {
        const idx = rootFirst.indexOf(selParent);
        return rootFirst[idx + 1] || deepest;
      }
    }
    if (rootFirst.length >= 2 && (page.nodes[rootFirst[0]].type === "frame" || page.nodes[rootFirst[0]].type === "component")) return rootFirst[1];
    return rootFirst[0];
  };

  const selectionBox = (): Box | null => unionBox(selection.filter((id) => page.nodes[id]).map((id) => absoluteBox(page, id, parents)));

  const snapTargets = (ids: string[]) => {
    const moving = new Set(ids.flatMap((id) => [id, ...descendants(page, id)]));
    const parent = ids.length ? parents.get(ids[0]) ?? null : null;
    const others = (parent ? page.nodes[parent]?.children || [] : page.children).filter((id) => !moving.has(id));
    const xs: number[] = [];
    const ys: number[] = [];
    for (const id of others) {
      const b = absoluteBox(page, id, parents);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    if (parent) {
      const b = absoluteBox(page, parent, parents);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    }
    return { xs, ys };
  };

  const snapDelta = (box: Box, targets: { xs: number[]; ys: number[] }) => {
    const th = SNAP / viewport.zoom;
    let dx = 0;
    let dy = 0;
    let gx: number[] = [];
    let gy: number[] = [];
    let best = th;
    for (const m of [box.x, box.x + box.w / 2, box.x + box.w])
      for (const t of targets.xs)
        if (Math.abs(t - m) < best) {
          best = Math.abs(t - m);
          dx = t - m;
          gx = [t];
        }
    best = th;
    for (const m of [box.y, box.y + box.h / 2, box.y + box.h])
      for (const t of targets.ys)
        if (Math.abs(t - m) < best) {
          best = Math.abs(t - m);
          dy = t - m;
          gy = [t];
        }
    return { dx, dy, gx, gy };
  };

  // -------------------------------------------------------------------------
  // Puntero
  // -------------------------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    const target = e.target as Element;
    if (target.closest("textarea")) return;
    wrapRef.current?.setPointerCapture(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || tool === "hand" || spaceRef.current) {
      setG({ kind: "pan", sx: e.clientX, sy: e.clientY, vx: viewport.x, vy: viewport.y });
      return;
    }
    if (e.button !== 0) return;

    if (tool === "pen") {
      const parent = pen?.parent ?? containerAt(w.x, w.y);
      if (pen && pen.points.length > 2) {
        const [fx, fy] = pen.points[0];
        if (Math.hypot((fx - w.x) * viewport.zoom, (fy - w.y) * viewport.zoom) < 8) {
          finishPen(false, true);
          return;
        }
      }
      setPen({ points: [...(pen?.points || []), [w.x, w.y]], parent, cursor: null });
      return;
    }
    if (tool === "pencil") {
      setG({ kind: "pencil", points: [[w.x, w.y]], parent: containerAt(w.x, w.y) });
      return;
    }
    if (tool !== "move") {
      setG({ kind: "draw", tool, x0: w.x, y0: w.y, x1: w.x, y1: w.y, parent: tool === "frame" ? containerAt(w.x, w.y) : containerAt(w.x, w.y) });
      return;
    }

    const handle = target.closest("[data-handle]")?.getAttribute("data-handle") as Handle | null;
    if (handle) {
      const box = selectionBox()!;
      const key = `resize-${Date.now()}`;
      if (handle === "rot") {
        const id = selection[0];
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        setG({ kind: "rotate", cx, cy, start: page, id, key, a0: Math.atan2(w.y - cy, w.x - cx), r0: page.nodes[id].rotation });
      } else setG({ kind: "resize", handle, x0: w.x, y0: w.y, start: page, ids: [...selection], box, key });
      return;
    }

    const label = target.closest("[data-frame-label]")?.getAttribute("data-frame-label");
    const hitEl = target.closest("[data-node-id]");
    let hit = label || hitEl?.getAttribute("data-node-id") || null;
    if (hit && page.nodes[hit]?.locked) hit = null;
    if (hit && !label) hit = pickTarget(hit, e.ctrlKey || e.metaKey);
    if (hit && page.nodes[hit]?.locked) hit = null;
    // Como en las herramientas de diseño: sobre el fondo de una pantalla con
    // contenido se selecciona por área; la pantalla se elige por su título
    const hitNode = hit ? page.nodes[hit] : null;
    if (hitNode && !label && !parents.get(hitNode.id) && (hitNode.type === "frame" || hitNode.type === "component") && hitNode.children?.length && !selection.includes(hitNode.id)) {
      const base = e.shiftKey ? [...selection] : [];
      if (!e.shiftKey) onSelect([]);
      setG({ kind: "marquee", x0: w.x, y0: w.y, x1: w.x, y1: w.y, container: hitNode.id, base });
      return;
    }

    if (!hit) {
      const base = e.shiftKey ? [...selection] : [];
      if (!e.shiftKey) onSelect([]);
      setG({ kind: "marquee", x0: w.x, y0: w.y, x1: w.x, y1: w.y, container: null, base });
      return;
    }
    let ids: string[];
    if (e.shiftKey) {
      ids = selection.includes(hit) ? selection.filter((s) => s !== hit) : [...selection, hit];
      onSelect(ids);
      if (!ids.includes(hit)) return;
    } else {
      ids = selection.includes(hit) ? selection : [hit];
      if (!selection.includes(hit)) onSelect(ids);
    }
    let start = page;
    if (e.altKey) {
      const dup = duplicate(page, ids, 0);
      start = dup.page;
      ids = dup.ids;
      onChange(start, `dup-${Date.now()}`);
      onSelect(ids);
    }
    const tops = topLevelOnly(start, ids).filter((id) => !start.nodes[id]?.locked);
    const lp = tops.length === 1 ? parentMap(start).get(tops[0]) ?? null : null;
    const layoutParent = lp && start.nodes[lp]?.layout && start.nodes[lp].layout!.mode !== "none" ? lp : null;
    setG({ kind: "move", x0: w.x, y0: w.y, start, ids: tops, key: `move-${Date.now()}`, moved: false, layoutParent });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    const w = toWorld(e.clientX, e.clientY);
    if (!g) {
      if (pen) setPen({ ...pen, cursor: [w.x, w.y] });
      if (tool === "move" && !editing) {
        const el = (e.target as Element).closest?.("[data-node-id]");
        const id = el?.getAttribute("data-node-id");
        setHover(id ? pickTarget(id, e.ctrlKey || e.metaKey) : null);
      }
      return;
    }
    if (g.kind === "pan") {
      onViewport({ ...viewport, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy });
    } else if (g.kind === "marquee") {
      setG({ ...g, x1: w.x, y1: w.y });
      const box = normBox({ x: g.x0, y: g.y0, w: w.x - g.x0, h: w.y - g.y0 });
      const container = containerAt(g.x0, g.y0);
      const pool = container ? page.nodes[container].children || [] : page.children;
      const hits = pool.filter((id) => {
        const n = page.nodes[id];
        if (!n?.visible || n.locked) return false;
        const b = absoluteBox(page, id, parents);
        return b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y;
      });
      onSelect([...new Set([...g.base, ...hits])]);
    } else if (g.kind === "move") {
      let dx = w.x - g.x0;
      let dy = w.y - g.y0;
      if (!g.moved && Math.hypot(dx * viewport.zoom, dy * viewport.zoom) < 3) return;
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const sp = parentMap(g.start);
      const box = unionBox(g.ids.map((id) => absoluteBox(g.start, id, sp)))!;
      if (!g.layoutParent && !e.ctrlKey) {
        const s = snapDelta({ ...box, x: box.x + dx, y: box.y + dy }, snapTargets(g.ids));
        dx += s.dx;
        dy += s.dy;
        setGuides({ x: s.gx, y: s.gy });
      }
      const patches: Record<string, Partial<UNode>> = {};
      for (const id of g.ids) patches[id] = { x: Math.round(g.start.nodes[id].x + dx), y: Math.round(g.start.nodes[id].y + dy) };
      if (g.layoutParent) {
        // En diseño automático solo se cambia el orden: se muestra el movimiento sin aplicar la maquetación
        const nodes = { ...g.start.nodes };
        for (const [id, p] of Object.entries(patches)) nodes[id] = { ...nodes[id], ...p };
        onChange({ ...g.start, nodes }, g.key);
      } else onChange(updateNodes(g.start, patches), g.key);
      gestureRef.current = { ...g, moved: true };
    } else if (g.kind === "resize") {
      onChange(resizeSelection(g, w.x, w.y, e.shiftKey, e.altKey), g.key);
    } else if (g.kind === "rotate") {
      let deg = g.r0 + ((Math.atan2(w.y - g.cy, w.x - g.cx) - g.a0) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      deg = ((Math.round(deg) % 360) + 360) % 360;
      onChange(updateNodes(g.start, { [g.id]: { rotation: deg > 180 ? deg - 360 : deg } }), g.key);
    } else if (g.kind === "draw") {
      let x1 = w.x;
      let y1 = w.y;
      if (e.shiftKey && g.tool !== "line" && g.tool !== "arrow") {
        const d = Math.max(Math.abs(x1 - g.x0), Math.abs(y1 - g.y0));
        x1 = g.x0 + Math.sign(x1 - g.x0 || 1) * d;
        y1 = g.y0 + Math.sign(y1 - g.y0 || 1) * d;
      } else if (e.shiftKey) {
        const a = Math.round(Math.atan2(y1 - g.y0, x1 - g.x0) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(x1 - g.x0, y1 - g.y0);
        x1 = g.x0 + Math.cos(a) * len;
        y1 = g.y0 + Math.sin(a) * len;
      }
      setG({ ...g, x1, y1 });
    } else if (g.kind === "pencil") {
      setG({ ...g, points: [...g.points, [w.x, w.y]] });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    setG(null);
    setGuides({ x: [], y: [] });
    if (!g) return;
    const w = toWorld(e.clientX, e.clientY);
    if (g.kind === "move" && g.moved) {
      const current = pageRef.current;
      if (g.layoutParent) {
        // Reordenar dentro del diseño automático según la posición del puntero
        const parent = g.start.nodes[g.layoutParent];
        const row = parent.layout!.mode === "row";
        const others = (parent.children || []).filter((id) => !g.ids.includes(id));
        const pBox = absoluteBox(g.start, g.layoutParent, parentMap(g.start));
        const pos = row ? w.x - pBox.x : w.y - pBox.y;
        let index = others.findIndex((id) => {
          const n = g.start.nodes[id];
          return pos < (row ? n.x + n.w / 2 : n.y + n.h / 2);
        });
        if (index < 0) index = others.length;
        const outside = w.x < pBox.x || w.y < pBox.y || w.x > pBox.x + pBox.w || w.y > pBox.y + pBox.h;
        if (outside) {
          const target = containerAt(w.x, w.y, new Set(g.ids));
          onChange(reparent(current, g.ids, target), g.key);
        } else {
          const list = [...others];
          list.splice(index, 0, ...g.ids);
          onChange(updateNodes({ ...g.start, nodes: { ...g.start.nodes, [g.layoutParent]: { ...parent, children: list } } }, {}), g.key);
        }
        return;
      }
      // Soltar dentro de otro marco: el elemento pasa a ser su hijo
      const cp = parentMap(current);
      const moving = new Set(g.ids);
      const target = containerAt(w.x, w.y, moving);
      const currentParent = cp.get(g.ids[0]) ?? null;
      const isTopFrame = g.ids.every((id) => (current.nodes[id].type === "frame" || current.nodes[id].type === "component") && !cp.get(id));
      if (target !== currentParent && !(isTopFrame && target === null)) {
        if (!(isTopFrame && target)) onChange(reparent(current, g.ids, target), g.key);
      }
      return;
    }
    if (g.kind === "draw") finishDraw(g);
    if (g.kind === "pencil" && g.points.length > 1) {
      const xs = g.points.map((p) => p[0]);
      const ys = g.points.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
      createPath(
        g.points.filter((_, i) => i % 2 === 0 || i === g.points.length - 1),
        box,
        g.parent,
        false
      );
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== "move") return;
    const el = (e.target as Element).closest("[data-node-id]");
    const id = el?.getAttribute("data-node-id");
    if (!id) return;
    const chain = [id, ...ancestors(page, id, parents)].reverse();
    const sel = selection[0];
    const idx = sel ? chain.indexOf(sel) : -1;
    if (sel && page.nodes[sel]?.type === "text" && chain[chain.length - 1] === sel) {
      setEditing(sel);
      return;
    }
    const next = idx >= 0 ? chain[idx + 1] : chain[chain.length - 1];
    if (next) {
      onSelect([next]);
      if (page.nodes[next]?.type === "text") setEditing(next);
    }
  };

  // -------------------------------------------------------------------------
  // Crear
  // -------------------------------------------------------------------------

  const localPos = (parent: string | null, x: number, y: number) => {
    if (!parent) return { x, y };
    const p = absolutePos(page, parent, parents);
    return { x: x - p.x, y: y - p.y };
  };

  const finishDraw = (g: Extract<Gesture, { kind: "draw" }>) => {
    const dragged = Math.hypot((g.x1 - g.x0) * viewport.zoom, (g.y1 - g.y0) * viewport.zoom) > 4;
    const box = normBox({ x: g.x0, y: g.y0, w: g.x1 - g.x0, h: g.y1 - g.y0 });
    const local = localPos(g.parent, box.x, box.y);
    let node: UNode;
    if (g.tool === "text") {
      const l = localPos(g.parent, g.x0, g.y0);
      node = makeNode("text", { x: Math.round(l.x), y: Math.round(l.y), text: "" });
      if (dragged) node = { ...node, w: Math.round(box.w), font: { ...node.font!, autoSize: "height" } };
    } else if (g.tool === "line" || g.tool === "arrow") {
      const l = localPos(g.parent, g.x0, g.y0);
      node = makeNode("line", {
        x: Math.round(l.x),
        y: Math.round(l.y),
        w: Math.round(dragged ? g.x1 - g.x0 : 120),
        h: Math.round(dragged ? g.y1 - g.y0 : 0),
        arrowEnd: g.tool === "arrow",
        name: g.tool === "arrow" ? "Flecha" : "Línea",
      });
    } else {
      const type = g.tool === "frame" ? "frame" : g.tool === "rect" ? "rect" : g.tool === "ellipse" ? "ellipse" : g.tool === "polygon" ? "polygon" : "star";
      const size = type === "frame" ? { w: 360, h: 640 } : { w: 100, h: 100 };
      node = makeNode(type, {
        x: Math.round(dragged ? local.x : local.x - size.w / 2),
        y: Math.round(dragged ? local.y : local.y - size.h / 2),
        w: Math.round(dragged ? box.w : size.w),
        h: Math.round(dragged ? box.h : size.h),
        ...(type === "frame" && g.parent ? { fill: solid("#ffffff") } : {}),
      });
    }
    // Un marco dibujado sobre elementos sueltos los adopta
    let next = insertNodes(page, [node], g.parent, [node.id]);
    if (node.type === "frame" && dragged) {
      const pool = (g.parent ? page.nodes[g.parent].children || [] : page.children).filter((id) => {
        const b = absoluteBox(page, id, parents);
        return b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h;
      });
      if (pool.length) next = reparent(next, pool, node.id);
    }
    onChange(next, `create-${node.id}`);
    onSelect([node.id]);
    onToolDone();
    if (node.type === "text") setEditing(node.id);
  };

  const createPath = (points: [number, number][], box: Box, parent: string | null, closed: boolean) => {
    const local = localPos(parent, box.x, box.y);
    const node = makeNode("path", {
      x: Math.round(local.x),
      y: Math.round(local.y),
      w: Math.round(box.w),
      h: Math.round(box.h),
      points: points.map(([x, y]) => [(x - box.x) / box.w, (y - box.y) / box.h] as [number, number]),
      closed,
      fill: closed ? solid("#d9d9d9") : null,
      name: closed ? "Forma" : "Trazado",
    });
    onChange(insertNodes(page, [node], parent, [node.id]), `create-${node.id}`);
    onSelect([node.id]);
  };

  const finishPen = (cancel: boolean, closed = false) => {
    const current = pen;
    setPen(null);
    if (cancel || !current || current.points.length < 2) {
      onToolDone();
      return;
    }
    const xs = current.points.map((p) => p[0]);
    const ys = current.points.map((p) => p[1]);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
    createPath(current.points, box, current.parent, closed);
    onToolDone();
  };

  useEffect(() => {
    if (tool !== "pen" && pen) setPen(null);
  }, [tool, pen]);

  // -------------------------------------------------------------------------
  // Redimensionar
  // -------------------------------------------------------------------------

  function resizeSelection(g: Extract<Gesture, { kind: "resize" }>, wx: number, wy: number, keepRatio: boolean, fromCenter: boolean): Page {
    const start = g.start;
    const sp = parentMap(start);
    // Extremos de una línea
    if ((g.handle === "p0" || g.handle === "p1") && g.ids.length === 1) {
      const n = start.nodes[g.ids[0]];
      const abs = absolutePos(start, n.id, sp);
      if (g.handle === "p1") return updateNodes(start, { [n.id]: { w: Math.round(wx - abs.x), h: Math.round(wy - abs.y) } });
      const ex = abs.x + n.w;
      const ey = abs.y + n.h;
      return updateNodes(start, { [n.id]: { x: Math.round(n.x + wx - abs.x), y: Math.round(n.y + wy - abs.y), w: Math.round(ex - wx), h: Math.round(ey - wy) } });
    }
    const b = g.box;
    let x0 = b.x;
    let y0 = b.y;
    let x1 = b.x + b.w;
    let y1 = b.y + b.h;
    const h = g.handle;
    if (h.includes("w")) x0 = wx;
    if (h.includes("e")) x1 = wx;
    if (h.includes("n")) y0 = wy;
    if (h.includes("s")) y1 = wy;
    if (fromCenter) {
      if (h.includes("w")) x1 = b.x + b.w + (b.x - wx);
      if (h.includes("e")) x0 = b.x - (wx - b.x - b.w);
      if (h.includes("n")) y1 = b.y + b.h + (b.y - wy);
      if (h.includes("s")) y0 = b.y - (wy - b.y - b.h);
    }
    let nw = Math.max(1, x1 - x0);
    let nh = Math.max(1, y1 - y0);
    if (keepRatio && b.w > 0 && b.h > 0) {
      const ratio = b.w / b.h;
      if (h === "n" || h === "s") nw = nh * ratio;
      else if (h === "e" || h === "w") nh = nw / ratio;
      else if (nw / nh > ratio) nh = nw / ratio;
      else nw = nh * ratio;
      if (h.includes("w")) x0 = x1 - nw;
      if (h.includes("n")) y0 = y1 - nh;
      if (h === "n" || h === "s") x0 = b.x + (b.w - nw) / 2;
      if (h === "e" || h === "w") y0 = b.y + (b.h - nh) / 2;
    }
    if (x1 < x0) x0 = x1 - nw;
    if (y1 < y0) y0 = y1 - nh;
    const sx = nw / Math.max(1, b.w);
    const sy = nh / Math.max(1, b.h);
    const patches: Record<string, Partial<UNode>> = {};
    for (const id of g.ids) {
      const n = start.nodes[id];
      const abs = absoluteBox(start, id, sp);
      const ax = x0 + (abs.x - b.x) * sx;
      const ay = y0 + (abs.y - b.y) * sy;
      const patch: Partial<UNode> = { x: Math.round(n.x + ax - abs.x), y: Math.round(n.y + ay - abs.y), w: Math.max(1, Math.round(abs.w * sx)), h: Math.max(1, Math.round(abs.h * sy)) };
      if (n.type === "line") {
        patch.w = Math.round(n.w * sx);
        patch.h = Math.round(n.h * sy);
        patch.x = Math.round(n.x + (x0 + ((n.w < 0 ? abs.x + abs.w : abs.x) - b.x) * sx) - (n.w < 0 ? abs.x + abs.w : abs.x));
        patch.y = Math.round(n.y + (y0 + ((n.h < 0 ? abs.y + abs.h : abs.y) - b.y) * sy) - (n.h < 0 ? abs.y + abs.h : abs.y));
      }
      if (n.type === "text" && n.font) {
        if (h === "n" || h === "s" || (!h.includes("e") && !h.includes("w"))) patch.font = { ...n.font, autoSize: "fixed" };
        else patch.font = { ...n.font, autoSize: h.length === 2 ? "fixed" : "height" };
      }
      // Fuera de la maquetación automática, cambiar el tamaño fija el modo «fijo»
      const sizing = { ...n.sizing };
      if (h.includes("e") || h.includes("w")) sizing.w = sizing.w === "fill" ? "fill" : "fixed";
      if (h.includes("n") || h.includes("s")) sizing.h = sizing.h === "fill" ? "fill" : "fixed";
      if (n.sizing.w === "hug" || n.sizing.h === "hug") patch.sizing = { w: sizing.w === "hug" ? "hug" : sizing.w, h: sizing.h === "hug" ? "hug" : sizing.h };
      if ((h.includes("e") || h.includes("w")) && n.sizing.w === "hug") patch.sizing = { ...(patch.sizing || n.sizing), w: "fixed" };
      if ((h.includes("n") || h.includes("s")) && n.sizing.h === "hug") patch.sizing = { ...(patch.sizing || n.sizing), h: "fixed" };
      patches[id] = patch;
      // Los grupos escalan su contenido
      if (n.type === "group") {
        for (const d of descendants(start, id)) {
          const dn = start.nodes[d];
          patches[d] = { x: Math.round(dn.x * sx), y: Math.round(dn.y * sy), w: Math.max(1, Math.round(dn.w * sx)), h: Math.max(1, Math.round(dn.h * sy)) };
        }
      }
    }
    return updateNodes(start, patches);
  }

  // -------------------------------------------------------------------------
  // Soltar desde la biblioteca o el sistema
  // -------------------------------------------------------------------------

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    onDropItem(e.dataTransfer, w, containerAt(w.x, w.y));
  };

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  const hidden = useMemo(() => (editing ? new Set([editing]) : undefined), [editing]);
  const selBox = selectionBox();
  const single = selection.length === 1 ? page.nodes[selection[0]] : null;
  const screenSel = selBox ? { ...toScreen(selBox.x, selBox.y), w: selBox.w * viewport.zoom, h: selBox.h * viewport.zoom } : null;
  const topFrames = page.children.map((id) => page.nodes[id]).filter((n) => n && (n.type === "frame" || n.type === "component"));
  const cursor = tool === "hand" || gesture?.kind === "pan" ? (gesture?.kind === "pan" ? "grabbing" : "grab") : tool === "move" ? "default" : tool === "text" ? "text" : "crosshair";

  const handles: { id: Handle; x: number; y: number; c: string }[] = screenSel
    ? [
        { id: "nw", x: screenSel.x, y: screenSel.y, c: "nwse-resize" },
        { id: "n", x: screenSel.x + screenSel.w / 2, y: screenSel.y, c: "ns-resize" },
        { id: "ne", x: screenSel.x + screenSel.w, y: screenSel.y, c: "nesw-resize" },
        { id: "e", x: screenSel.x + screenSel.w, y: screenSel.y + screenSel.h / 2, c: "ew-resize" },
        { id: "se", x: screenSel.x + screenSel.w, y: screenSel.y + screenSel.h, c: "nwse-resize" },
        { id: "s", x: screenSel.x + screenSel.w / 2, y: screenSel.y + screenSel.h, c: "ns-resize" },
        { id: "sw", x: screenSel.x, y: screenSel.y + screenSel.h, c: "nesw-resize" },
        { id: "w", x: screenSel.x, y: screenSel.y + screenSel.h / 2, c: "ew-resize" },
      ]
    : [];

  const editNode = editing ? page.nodes[editing] : null;
  const editPos = editNode ? absolutePos(page, editNode.id, parents) : null;

  const links = showLinks
    ? Object.values(page.nodes)
        .filter((n) => n.link && n.link.target !== "back" && page.nodes[n.link.target])
        .map((n) => {
          const a = absoluteBox(page, n.id, parents);
          const t = absoluteBox(page, n.link!.target, parents);
          const s0 = toScreen(a.x + a.w, a.y + a.h / 2);
          const s1 = toScreen(t.x, t.y + Math.min(40, t.h / 2));
          const mid = (s0.x + s1.x) / 2;
          return { id: n.id, d: `M${s0.x} ${s0.y} C${mid} ${s0.y} ${mid} ${s1.y} ${s1.x} ${s1.y}`, s0, s1 };
        })
    : [];

  return (
    <div
      ref={wrapRef}
      data-canvas
      data-paper
      className="relative flex-1 overflow-hidden"
      style={{ background: page.background, cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <svg className="absolute inset-0" width={size.w} height={size.h} style={{ overflow: "visible" }}>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {page.children.map((id) => (
            <React.Fragment key={id}>{renderNode(id, { doc, page, prefix: "c", interactive: true, hidden })}</React.Fragment>
          ))}
        </g>
      </svg>

      {/* Capa de ayudas en coordenadas de pantalla */}
      <svg className="absolute inset-0 pointer-events-none" width={size.w} height={size.h}>
        {topFrames.map((f) => {
          const s = toScreen(f.x, f.y);
          const isComp = f.type === "component";
          return (
            <text
              key={f.id}
              data-frame-label={f.id}
              x={s.x}
              y={s.y - 6}
              fontSize={11}
              fontFamily="Hanken Grotesk, sans-serif"
              fill={selection.includes(f.id) ? SELECT : isComp ? "#9747ff" : "#6b6b6b"}
              style={{ pointerEvents: "all", cursor: "default" }}
            >
              {isComp ? "◆ " : ""}
              {f.name}
              {page.startFrame === f.id ? "  ▶" : ""}
            </text>
          );
        })}
        {hover && !selection.includes(hover) && page.nodes[hover] && (() => {
          const b = absoluteBox(page, hover, parents);
          const s = toScreen(b.x, b.y);
          return <rect x={s.x} y={s.y} width={b.w * viewport.zoom} height={b.h * viewport.zoom} fill="none" stroke={SELECT} strokeWidth={1.5} />;
        })()}
        {selection.length > 1 &&
          selection.map((id) => {
            if (!page.nodes[id]) return null;
            const b = absoluteBox(page, id, parents);
            const s = toScreen(b.x, b.y);
            return <rect key={id} x={s.x} y={s.y} width={b.w * viewport.zoom} height={b.h * viewport.zoom} fill="none" stroke={SELECT} strokeWidth={1} />;
          })}
        {links.map((l) => (
          <g key={l.id}>
            <path d={l.d} fill="none" stroke="#9747ff" strokeWidth={2} />
            <circle cx={l.s0.x} cy={l.s0.y} r={4} fill="#9747ff" />
            <path d={`M${l.s1.x - 8} ${l.s1.y - 5} L${l.s1.x} ${l.s1.y} L${l.s1.x - 8} ${l.s1.y + 5}`} fill="none" stroke="#9747ff" strokeWidth={2} />
          </g>
        ))}
        {guides.x.map((x, i) => (
          <line key={`gx${i}`} x1={toScreen(x, 0).x} x2={toScreen(x, 0).x} y1={0} y2={size.h} stroke="#f24822" strokeWidth={1} />
        ))}
        {guides.y.map((y, i) => (
          <line key={`gy${i}`} y1={toScreen(0, y).y} y2={toScreen(0, y).y} x1={0} x2={size.w} stroke="#f24822" strokeWidth={1} />
        ))}
        {gesture?.kind === "marquee" && (() => {
          const b = normBox({ x: gesture.x0, y: gesture.y0, w: gesture.x1 - gesture.x0, h: gesture.y1 - gesture.y0 });
          const s = toScreen(b.x, b.y);
          return <rect x={s.x} y={s.y} width={b.w * viewport.zoom} height={b.h * viewport.zoom} fill="rgba(13,153,255,0.08)" stroke={SELECT} />;
        })()}
        {gesture?.kind === "draw" && (() => {
          const s0 = toScreen(gesture.x0, gesture.y0);
          const s1 = toScreen(gesture.x1, gesture.y1);
          if (gesture.tool === "line" || gesture.tool === "arrow") return <line x1={s0.x} y1={s0.y} x2={s1.x} y2={s1.y} stroke={SELECT} strokeWidth={2} />;
          const b = normBox({ x: s0.x, y: s0.y, w: s1.x - s0.x, h: s1.y - s0.y });
          const label = `${Math.round(b.w / viewport.zoom)} × ${Math.round(b.h / viewport.zoom)}`;
          return (
            <>
              {gesture.tool === "ellipse" ? <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill="rgba(13,153,255,0.08)" stroke={SELECT} /> : <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="rgba(13,153,255,0.08)" stroke={SELECT} />}
              <SizeTag x={b.x + b.w / 2} y={b.y + b.h + 8} label={label} />
            </>
          );
        })()}
        {gesture?.kind === "pencil" && (
          <polyline points={gesture.points.map(([x, y]) => `${toScreen(x, y).x},${toScreen(x, y).y}`).join(" ")} fill="none" stroke={SELECT} strokeWidth={2} />
        )}
        {pen && (
          <>
            <polyline
              points={[...pen.points, ...(pen.cursor ? [pen.cursor] : [])].map(([x, y]) => `${toScreen(x, y).x},${toScreen(x, y).y}`).join(" ")}
              fill="none"
              stroke={SELECT}
              strokeWidth={2}
            />
            {pen.points.map(([x, y], i) => (
              <rect key={i} x={toScreen(x, y).x - 4} y={toScreen(x, y).y - 4} width={8} height={8} fill="#fff" stroke={SELECT} />
            ))}
          </>
        )}
        {screenSel && !editing && tool === "move" && gesture?.kind !== "marquee" && (
          <g style={{ pointerEvents: "all" }}>
            <rect x={screenSel.x} y={screenSel.y} width={screenSel.w} height={screenSel.h} fill="none" stroke={SELECT} strokeWidth={1.5} style={{ pointerEvents: "none" }} />
            {single?.type === "line" ? (
              (() => {
                const a = absolutePos(page, single.id, parents);
                const p0 = toScreen(a.x, a.y);
                const p1 = toScreen(a.x + single.w, a.y + single.h);
                return (
                  <>
                    <circle data-handle="p0" cx={p0.x} cy={p0.y} r={5} fill="#fff" stroke={SELECT} strokeWidth={1.5} style={{ cursor: "move" }} />
                    <circle data-handle="p1" cx={p1.x} cy={p1.y} r={5} fill="#fff" stroke={SELECT} strokeWidth={1.5} style={{ cursor: "move" }} />
                  </>
                );
              })()
            ) : (
              <>
                {handles.map((h) => (
                  <rect key={h.id} data-handle={h.id} x={h.x - HANDLE / 2} y={h.y - HANDLE / 2} width={HANDLE} height={HANDLE} fill="#fff" stroke={SELECT} strokeWidth={1.5} style={{ cursor: h.c }} />
                ))}
                {single && (
                  <circle data-handle="rot" cx={screenSel.x + screenSel.w / 2} cy={screenSel.y - 22} r={5} fill="#fff" stroke={SELECT} strokeWidth={1.5} style={{ cursor: "grab" }} />
                )}
              </>
            )}
            {selBox && <SizeTag x={screenSel.x + screenSel.w / 2} y={screenSel.y + screenSel.h + 10} label={`${Math.round(selBox.w)} × ${Math.round(selBox.h)}`} />}
          </g>
        )}
      </svg>

      {editNode && editPos && editNode.font && (
        <textarea
          autoFocus
          data-text-editor
          value={editNode.text || ""}
          onChange={(e) => {
            // La capa toma el nombre de su contenido mientras no se le haya puesto otro
            const old = editNode.text || "";
            const autoName = editNode.name === "Texto" || editNode.name === old.slice(0, 40).trim();
            const value = e.target.value;
            onChange(updateNodes(page, { [editNode.id]: { text: value, ...(autoName ? { name: value.slice(0, 40).trim() || "Texto" } : {}) } }), `text-${editNode.id}`);
          }}
          onBlur={() => {
            const n = pageRef.current.nodes[editNode.id];
            setEditing(null);
            // Un texto que se queda vacío se elimina
            if (n && !n.text?.trim()) {
              onChange(deleteNodes(pageRef.current, [n.id]), `text-${n.id}`);
              onSelect([]);
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
          }}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          className="absolute bg-transparent resize-none outline-none overflow-hidden p-0 m-0 border-0"
          style={{
            left: toScreen(editPos.x, editPos.y).x,
            top: toScreen(editPos.x, editPos.y).y,
            width: Math.max(editNode.w, 8) * viewport.zoom + (editNode.font.autoSize === "width" ? 40 : 0),
            height: Math.max(editNode.h, editNode.font.size * editNode.font.lineHeight) * viewport.zoom,
            font: fontCss({ ...editNode.font, size: editNode.font.size * viewport.zoom }),
            lineHeight: editNode.font.lineHeight,
            letterSpacing: editNode.font.letterSpacing * viewport.zoom,
            textAlign: editNode.font.align,
            color: editNode.fill?.color || "#000",
            caretColor: SELECT,
            whiteSpace: editNode.font.autoSize === "width" ? "pre" : "pre-wrap",
            transform: editNode.rotation ? `rotate(${editNode.rotation}deg)` : undefined,
            textTransform: editNode.font.transform === "none" ? undefined : editNode.font.transform,
            outline: `1.5px solid ${SELECT}`,
          }}
        />
      )}
    </div>
  );
});

const SizeTag: React.FC<{ x: number; y: number; label: string }> = ({ x, y, label }) => (
  <g style={{ pointerEvents: "none" }}>
    <rect x={x - label.length * 3.4 - 6} y={y - 1} width={label.length * 6.8 + 12} height={17} rx={3} fill={SELECT} />
    <text x={x} y={y + 11.5} fontSize={10.5} fill="#fff" textAnchor="middle" fontFamily="Hanken Grotesk, sans-serif" fontWeight={600}>
      {label}
    </text>
  </g>
);

export { isContainer };
