// Lienzo de CoffeeDiagram: colocar figuras, conectarlas, mover,
// redimensionar, editar en el propio diagrama y mover mensajes.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { DEdge, DNode, Diagram, EdgeKind, Member, PaletteItem } from "../types";
import { SELECT, hasMembers, kindInfo } from "../types";
import { addEdge, addNodes, boundsOf, compartments, makeEdge, makeNode, member, memberText, updateEdges, updateNodes, LINE, PAD, type Box } from "../services/model";
import { DiagramSvgContent, LIFELINES, center, distanceToPath, edgePoints } from "../services/render";

export type CanvasTool = { mode: "select" } | { mode: "shape"; item: PaletteItem } | { mode: "edge"; kind: EdgeKind };

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasHandle {
  center: () => { x: number; y: number };
  fit: (box?: Box | null) => void;
  zoomBy: (f: number) => void;
  editName: (id: string) => void;
}

interface Props {
  diagram: Diagram;
  selection: string[];
  onSelect: (ids: string[]) => void;
  tool: CanvasTool;
  onToolDone: () => void;
  viewport: Viewport;
  onViewport: (v: Viewport) => void;
  onChange: (d: Diagram, key?: string) => void;
  snap: boolean;
}

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; base: string[] }
  | { kind: "move"; x0: number; y0: number; start: Diagram; ids: string[]; key: string; moved: boolean }
  | { kind: "message"; y0: number; start: Diagram; id: string; key: string }
  | { kind: "resize"; handle: Handle; x0: number; y0: number; start: Diagram; id: string; key: string }
  | { kind: "connect"; from: string; edge: EdgeKind; x: number; y: number; y0: number };

const CONTAINER = new Set(["system", "swimlane", "package", "fragment"]);
const FIXED = new Set(["initial", "final", "flowFinal", "history", "providedInterface", "connector", "choice"]);

/** Interpreta «- nombre: Tipo = valor» o «+ op(a: int): Tipo» al editar un miembro. */
export function parseMember(text: string, base: Member, kind: "attr" | "op", node: DNode): Member {
  let t = text.trim();
  const m: Member = { ...base };
  if (node.type === "object") {
    const [name, ...rest] = t.split("=");
    return { ...m, name: name.trim(), value: rest.join("=").trim() };
  }
  if (node.type === "state") return { ...m, name: t };
  if (node.type === "entity") {
    const [name, ...type] = t.split(/\s+/);
    return { ...m, name: name || m.name, type: type.join(" ") || m.type };
  }
  if (/^[+\-#~]/.test(t)) {
    m.visibility = t[0] as Member["visibility"];
    t = t.slice(1).trim();
  }
  if (kind === "op") {
    const op = t.match(/^([^(]+)\(([^)]*)\)\s*(?::\s*(.+))?$/);
    if (op) return { ...m, name: op[1].trim(), params: op[2].trim(), type: (op[3] || "").trim() };
    return { ...m, name: t.replace(/[():]/g, "").trim() };
  }
  const attr = t.match(/^([^:=]+)(?::\s*([^=]+))?(?:=\s*(.+))?$/);
  if (attr) return { ...m, name: attr[1].trim(), type: (attr[2] || "").trim(), value: (attr[3] || "").trim() };
  return { ...m, name: t };
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(props, ref) {
  const { diagram: d, selection, onSelect, tool, onToolDone, viewport, onViewport, onChange, snap } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const gRef = useRef<Gesture | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: "name" | "text" | "label" | "attr" | "op" | "literal"; index?: number; value: string; box: Box; multiline?: boolean } | null>(null);
  const spaceRef = useRef(false);
  const dRef = useRef(d);
  dRef.current = d;

  const setG = (g: Gesture | null) => {
    gRef.current = g;
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

  const toWorld = (cx: number, cy: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - viewport.x) / viewport.zoom, y: (cy - r.top - viewport.y) / viewport.zoom };
  };
  const toScreen = (x: number, y: number) => ({ x: x * viewport.zoom + viewport.x, y: y * viewport.zoom + viewport.y });
  const g10 = (v: number) => (snap ? Math.round(v / 10) * 10 : Math.round(v));

  const zoomAt = (sx: number, sy: number, zoom: number) => {
    const z = Math.min(5, Math.max(0.1, zoom));
    const wx = (sx - viewport.x) / viewport.zoom;
    const wy = (sy - viewport.y) / viewport.zoom;
    onViewport({ zoom: z, x: sx - wx * z, y: sy - wy * z });
  };

  useImperativeHandle(ref, () => ({
    center: () => ({ x: (size.w / 2 - viewport.x) / viewport.zoom, y: (size.h / 2 - viewport.y) / viewport.zoom }),
    fit: (box) => {
      const b = box === undefined ? boundsOf(d) : box;
      if (!b) {
        onViewport({ x: 60, y: 60, zoom: 1 });
        return;
      }
      const zoom = Math.min(1.5, Math.max(0.15, Math.min((size.w - 100) / Math.max(1, b.w), (size.h - 100) / Math.max(1, b.h))));
      onViewport({ zoom, x: size.w / 2 - (b.x + b.w / 2) * zoom, y: size.h / 2 - (b.y + b.h / 2) * zoom });
    },
    zoomBy: (f) => zoomAt(size.w / 2, size.h / 2, viewport.zoom * f),
    editName: (id) => startEdit(id),
  }));

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
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest?.("input,textarea,select")) spaceRef.current = true;
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
  }, []);

  // -------------------------------------------------------------------------
  // Búsqueda bajo el puntero
  // -------------------------------------------------------------------------

  const nodeAt = (x: number, y: number, exclude?: string): string | null => {
    for (let i = d.order.length - 1; i >= 0; i--) {
      const n = d.nodes[d.order[i]];
      if (!n || n.id === exclude) continue;
      if (CONTAINER.has(n.type)) continue;
      if (LIFELINES.has(n.type)) {
        if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h && (y <= n.y + (n.type === "actorLifeline" ? 86 : 42) || Math.abs(x - (n.x + n.w / 2)) < 14)) return n.id;
        continue;
      }
      if (x >= n.x - 2 && x <= n.x + n.w + 2 && y >= n.y - 2 && y <= n.y + n.h + 2) return n.id;
    }
    // Los contenedores solo por su borde o su título
    for (let i = d.order.length - 1; i >= 0; i--) {
      const n = d.nodes[d.order[i]];
      if (!n || n.id === exclude || !CONTAINER.has(n.type)) continue;
      const inside = x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h;
      const edge = Math.min(x - n.x, n.x + n.w - x, y - n.y, n.y + n.h - y) < 8 / viewport.zoom;
      const title = y - n.y < (n.type === "swimlane" ? 32 : n.type === "fragment" ? 24 : 26);
      if (inside && (edge || title)) return n.id;
    }
    return null;
  };

  const edgeAt = (x: number, y: number): string | null => {
    let best: string | null = null;
    let bestD = 7 / viewport.zoom;
    for (const e of Object.values(d.edges)) {
      const dist = distanceToPath({ x, y }, edgePoints(d, e));
      if (dist < bestD) {
        bestD = dist;
        best = e.id;
      }
    }
    return best;
  };



  // -------------------------------------------------------------------------
  // Puntero
  // -------------------------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || (e.target as Element).closest("input,textarea")) return;
    wrapRef.current?.setPointerCapture(e.pointerId);
    const w = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || spaceRef.current) {
      setG({ kind: "pan", sx: e.clientX, sy: e.clientY, vx: viewport.x, vy: viewport.y });
      return;
    }
    if (e.button !== 0) return;

    if (tool.mode === "shape") {
      let node = makeNode(tool.item.type, tool.item.preset);
      node = { ...node, x: g10(w.x - node.w / 2), y: g10(w.y - node.h / 2) };
      if (node.type === "activation") {
        const owner = Object.values(d.nodes).find((n) => LIFELINES.has(n.type) && Math.abs(center(n).x - w.x) < 50);
        if (owner) node = { ...node, x: Math.round(center(owner).x - node.w / 2), y: Math.round(w.y) };
      }
      if (LIFELINES.has(node.type)) node = { ...node, y: 40 };
      onChange(addNodes(d, [node]), `add-${node.id}`);
      onSelect([node.id]);
      if (!e.shiftKey) onToolDone();
      if (["class", "interface", "enum", "usecase", "action", "state", "entity", "lifeline", "actorLifeline", "actor", "process", "terminator", "subtopic", "topic"].includes(node.type)) window.setTimeout(() => startEdit(node.id, node), 30);
      return;
    }

    const handle = (e.target as Element).closest("[data-handle]")?.getAttribute("data-handle");
    if (handle === "connect" && selection.length === 1) {
      setG({ kind: "connect", from: selection[0], edge: kindInfo(d.kind).defaultEdge, x: w.x, y: w.y, y0: w.y });
      return;
    }
    if (handle && selection.length === 1 && d.nodes[selection[0]]) {
      setG({ kind: "resize", handle: handle as Handle, x0: w.x, y0: w.y, start: d, id: selection[0], key: `resize-${Date.now()}` });
      return;
    }

    const hitNode = nodeAt(w.x, w.y);
    if (tool.mode === "edge") {
      if (hitNode) setG({ kind: "connect", from: hitNode, edge: tool.kind, x: w.x, y: w.y, y0: w.y });
      return;
    }
    const hitEdge = hitNode && !LIFELINES.has(d.nodes[hitNode].type) ? null : edgeAt(w.x, w.y);
    if (hitEdge) {
      onSelect(e.shiftKey ? [...new Set([...selection, hitEdge])] : [hitEdge]);
      const edge = d.edges[hitEdge];
      if (edge.y !== undefined) setG({ kind: "message", y0: w.y, start: d, id: hitEdge, key: `msg-${Date.now()}` });
      return;
    }
    if (!hitNode) {
      const base = e.shiftKey ? [...selection] : [];
      if (!e.shiftKey) onSelect([]);
      setG({ kind: "marquee", x0: w.x, y0: w.y, x1: w.x, y1: w.y, base });
      return;
    }
    let ids = selection;
    if (e.shiftKey || e.ctrlKey) {
      ids = selection.includes(hitNode) ? selection.filter((s) => s !== hitNode) : [...selection, hitNode];
      onSelect(ids);
      if (!ids.includes(hitNode)) return;
    } else if (!selection.includes(hitNode)) {
      ids = [hitNode];
      onSelect(ids);
    }
    // Mover un contenedor arrastra también lo que hay dentro
    const moving = new Set(ids.filter((id) => d.nodes[id]));
    for (const id of [...moving]) {
      const c = d.nodes[id];
      if (!CONTAINER.has(c.type)) continue;
      for (const n of Object.values(d.nodes)) if (n.id !== id && n.x >= c.x && n.y >= c.y && n.x + n.w <= c.x + c.w && n.y + n.h <= c.y + c.h) moving.add(n.id);
    }
    // Las activaciones acompañan a su línea de vida
    for (const id of [...moving]) {
      const l = d.nodes[id];
      if (!LIFELINES.has(l.type)) continue;
      for (const a of Object.values(d.nodes)) if (a.type === "activation" && Math.abs(center(a).x - center(l).x) < 4) moving.add(a.id);
    }
    setG({ kind: "move", x0: w.x, y0: w.y, start: d, ids: [...moving], key: `move-${Date.now()}`, moved: false });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gRef.current;
    const w = toWorld(e.clientX, e.clientY);
    if (!g) {
      if (!editing) setHover(nodeAt(w.x, w.y));
      return;
    }
    if (g.kind === "pan") onViewport({ ...viewport, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy });
    else if (g.kind === "marquee") {
      setG({ ...g, x1: w.x, y1: w.y });
      const x0 = Math.min(g.x0, w.x);
      const y0 = Math.min(g.y0, w.y);
      const x1 = Math.max(g.x0, w.x);
      const y1 = Math.max(g.y0, w.y);
      const hits = Object.values(d.nodes)
        .filter((n) => n.x >= x0 && n.y >= y0 && n.x + n.w <= x1 && n.y + n.h <= y1)
        .map((n) => n.id);
      const edges = Object.values(d.edges)
        .filter((ed) => hits.includes(ed.source) && hits.includes(ed.target))
        .map((ed) => ed.id);
      onSelect([...new Set([...g.base, ...hits, ...edges])]);
    } else if (g.kind === "move") {
      const dx = w.x - g.x0;
      const dy = w.y - g.y0;
      if (!g.moved && Math.hypot(dx, dy) * viewport.zoom < 3) return;
      const patches: Record<string, Partial<DNode>> = {};
      const first = g.start.nodes[g.ids[0]];
      // El ajuste a la cuadrícula se calcula con la primera figura
      const ox = first ? g10(first.x + dx) - (first.x + dx) : 0;
      const oy = first ? g10(first.y + dy) - (first.y + dy) : 0;
      for (const id of g.ids) {
        const n = g.start.nodes[id];
        if (!n) continue;
        patches[id] = { x: Math.round(n.x + dx + (e.altKey ? 0 : ox)), y: LIFELINES.has(n.type) ? n.y : Math.round(n.y + dy + (e.altKey ? 0 : oy)) };
      }
      // Los mensajes entre las figuras movidas se desplazan con ellas
      let next = updateNodes(g.start, patches);
      const msgPatches: Record<string, Partial<DEdge>> = {};
      for (const ed of Object.values(g.start.edges))
        if (ed.y !== undefined && g.ids.includes(ed.source) && g.ids.includes(ed.target) && !LIFELINES.has(g.start.nodes[ed.source].type)) msgPatches[ed.id] = { y: ed.y + dy };
      if (Object.keys(msgPatches).length) next = updateEdges(next, msgPatches);
      onChange(next, g.key);
      gRef.current = { ...g, moved: true };
    } else if (g.kind === "message") {
      const ed = g.start.edges[g.id];
      onChange(updateEdges(g.start, { [g.id]: { y: g10((ed.y || 0) + w.y - g.y0) } }), g.key);
    } else if (g.kind === "resize") {
      const n = g.start.nodes[g.id];
      let x0 = n.x;
      let y0 = n.y;
      let x1 = n.x + n.w;
      let y1 = n.y + n.h;
      if (g.handle.includes("w")) x0 = g10(w.x);
      if (g.handle.includes("e")) x1 = g10(w.x);
      if (g.handle.includes("n")) y0 = g10(w.y);
      if (g.handle.includes("s")) y1 = g10(w.y);
      const minW = n.type === "fork" ? 4 : 20;
      const nw = Math.max(minW, x1 - x0);
      const nh = Math.max(n.type === "fork" ? 4 : 16, y1 - y0);
      onChange(updateNodes(g.start, { [g.id]: { x: g.handle.includes("w") ? x1 - nw : x0, y: g.handle.includes("n") ? y1 - nh : y0, w: nw, h: nh, autoSize: false } }), g.key);
    } else if (g.kind === "connect") {
      setG({ ...g, x: w.x, y: w.y });
      setHover(nodeAt(w.x, w.y));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gRef.current;
    setG(null);
    if (!g) return;
    if (g.kind === "connect") {
      const w = toWorld(e.clientX, e.clientY);
      let target = nodeAt(w.x, w.y);
      const source = d.nodes[g.from];
      if (!target && Math.hypot(w.x - center(source).x, w.y - center(source).y) > 30) {
        // Soltar en vacío: se crea una figura nueva conectada (como en las herramientas de modelado)
        const info = kindInfo(d.kind);
        const same = info.shapes.find((s) => s.type === source.type) || info.shapes[0];
        let node = makeNode(same.type, same.preset);
        node = { ...node, x: g10(w.x - node.w / 2), y: LIFELINES.has(node.type) ? source.y : g10(w.y - node.h / 2) };
        target = node.id;
        const withNode = addNodes(d, [node]);
        const edge = makeEdge(g.edge, g.from, target, LIFELINES.has(source.type) || source.type === "activation" ? { y: g10(g.y0) } : {});
        onChange(addEdge(withNode, edge), `connect-${node.id}`);
        onSelect([node.id]);
        if (tool.mode === "edge") onToolDone();
        return;
      }
      if (!target) return;
      const isSeq = (LIFELINES.has(source.type) || source.type === "activation") && (LIFELINES.has(d.nodes[target].type) || d.nodes[target].type === "activation");
      const edge = makeEdge(g.edge, g.from, target, isSeq ? { y: g10(g.y0), label: g.edge === "reply" ? "respuesta" : g.edge === "createMessage" ? "«create»" : "mensaje()" } : {});
      onChange(addEdge(d, edge), `edge-${edge.id}`);
      onSelect([edge.id]);
      if (tool.mode === "edge" && !e.shiftKey) onToolDone();
      if (isSeq) window.setTimeout(() => startEditEdge(edge.id), 30);
    }
  };

  // -------------------------------------------------------------------------
  // Edición en el diagrama
  // -------------------------------------------------------------------------

  const screenBox = (b: Box): Box => {
    const s = toScreen(b.x, b.y);
    return { x: s.x, y: s.y, w: b.w * viewport.zoom, h: b.h * viewport.zoom };
  };

  function startEdit(id: string, nodeOverride?: DNode, at?: { x: number; y: number }) {
    const n = nodeOverride || dRef.current.nodes[id];
    if (!n) return;
    if (n.type === "note") {
      setEditing({ id, field: "text", value: n.text, box: screenBox(n), multiline: true });
      return;
    }
    if (hasMembers(n.type) || n.type === "enum") {
      const c = compartments(n);
      if (at && at.y - n.y > c.header) {
        const relY = at.y - n.y - c.header - PAD / 2;
        if (n.type === "enum") {
          const index = Math.floor(relY / LINE);
          if (index >= 0 && index < n.literals.length) {
            setEditing({ id, field: "literal", index, value: n.literals[index], box: screenBox({ x: n.x, y: n.y + c.header + PAD / 2 + index * LINE, w: n.w, h: LINE }) });
            return;
          }
        } else if (relY < c.attrH - PAD / 2) {
          const index = Math.floor(relY / LINE);
          if (index >= 0 && index < n.attributes.length) {
            setEditing({ id, field: "attr", index, value: memberText(n.attributes[index], "attr", n), box: screenBox({ x: n.x, y: n.y + c.header + PAD / 2 + index * LINE, w: n.w, h: LINE }) });
            return;
          }
        } else if (n.type === "class" || n.type === "interface") {
          const index = Math.floor((relY - c.attrH) / LINE);
          if (index >= 0 && index < n.operations.length) {
            setEditing({ id, field: "op", index, value: memberText(n.operations[index], "op", n), box: screenBox({ x: n.x, y: n.y + c.header + c.attrH + PAD / 2 + index * LINE, w: n.w, h: LINE }) });
            return;
          }
        }
      }
      setEditing({ id, field: "name", value: n.name, box: screenBox({ x: n.x, y: n.y, w: n.w, h: c.header }) });
      return;
    }
    if (n.type === "fragment") {
      setEditing({ id, field: "text", value: n.text, box: screenBox({ x: n.x + 60, y: n.y, w: Math.max(160, n.w - 70), h: 24 }) });
      return;
    }
    const nameBox = LIFELINES.has(n.type) ? { x: n.x, y: n.y + (n.type === "actorLifeline" ? 66 : 0), w: n.w, h: n.type === "actorLifeline" ? 22 : 42 } : n.type === "actor" ? { x: n.x - 30, y: n.y + n.h - 20, w: n.w + 60, h: 22 } : n;
    setEditing({ id, field: "name", value: n.name, box: screenBox(nameBox), multiline: ["action", "usecase", "process", "note", "text"].includes(n.type) });
  }

  function startEditEdge(id: string) {
    const e = dRef.current.edges[id];
    if (!e) return;
    const pts = edgePoints(dRef.current, e);
    const mx = (pts[0].x + pts[pts.length - 1].x) / 2;
    const my = (pts[0].y + pts[pts.length - 1].y) / 2;
    setEditing({ id, field: "label", value: e.label, box: screenBox({ x: mx - 80, y: my - 24, w: 160, h: 22 }) });
  }

  const commitEdit = (value: string) => {
    const ed = editing;
    setEditing(null);
    if (!ed) return;
    const cur = dRef.current;
    if (ed.field === "label") {
      onChange(updateEdges(cur, { [ed.id]: { label: value } }), `label-${ed.id}`);
      return;
    }
    const n = cur.nodes[ed.id];
    if (!n) return;
    if (ed.field === "name") onChange(updateNodes(cur, { [ed.id]: { name: value } }), `name-${ed.id}`);
    else if (ed.field === "text") onChange(updateNodes(cur, { [ed.id]: { text: value } }), `text-${ed.id}`);
    else if (ed.field === "literal") {
      const literals = [...n.literals];
      if (value.trim()) literals[ed.index!] = value.trim();
      else literals.splice(ed.index!, 1);
      onChange(updateNodes(cur, { [ed.id]: { literals } }));
    } else {
      const key = ed.field === "attr" ? "attributes" : "operations";
      const list = [...n[key]];
      if (value.trim()) list[ed.index!] = parseMember(value, list[ed.index!], ed.field, n);
      else list.splice(ed.index!, 1);
      onChange(updateNodes(cur, { [ed.id]: { [key]: list } }));
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    const hitNode = nodeAt(w.x, w.y);
    if (hitNode) {
      startEdit(hitNode, undefined, w);
      return;
    }
    const hitEdge = edgeAt(w.x, w.y);
    if (hitEdge) startEditEdge(hitEdge);
  };

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  const selSet = useMemo(() => new Set(selection), [selection]);
  const single = selection.length === 1 ? d.nodes[selection[0]] : null;
  const cursor = gesture?.kind === "pan" ? "grabbing" : tool.mode === "shape" ? "copy" : tool.mode === "edge" ? "crosshair" : "default";
  const gridStep = 20 * viewport.zoom;

  return (
    <div
      ref={wrapRef}
      data-canvas
      className="relative flex-1 overflow-hidden"
      style={{
        cursor,
        backgroundColor: "#fbfcfe",
        backgroundImage: gridStep > 6 ? "radial-gradient(circle, #d5dde8 1px, transparent 1px)" : undefined,
        backgroundSize: `${gridStep}px ${gridStep}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <svg className="absolute inset-0" width={size.w} height={size.h}>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          <DiagramSvgContent d={d} selection={selSet} />
          {/* Resaltado de la selección */}
          {selection.map((id) => {
            const n = d.nodes[id];
            if (!n) return null;
            return <rect key={id} x={n.x - 3} y={n.y - 3} width={n.w + 6} height={n.h + 6} fill="none" stroke={SELECT} strokeWidth={1.5 / viewport.zoom} strokeDasharray={`${4 / viewport.zoom} ${3 / viewport.zoom}`} rx={3} pointerEvents="none" />;
          })}
          {hover && !selSet.has(hover) && d.nodes[hover] && (
            <rect x={d.nodes[hover].x - 2} y={d.nodes[hover].y - 2} width={d.nodes[hover].w + 4} height={d.nodes[hover].h + 4} fill="none" stroke={gesture?.kind === "connect" ? "#27ae60" : "#9cc3f5"} strokeWidth={(gesture?.kind === "connect" ? 2.5 : 1.5) / viewport.zoom} rx={3} pointerEvents="none" />
          )}
          {gesture?.kind === "connect" && d.nodes[gesture.from] && (
            <line
              x1={LIFELINES.has(d.nodes[gesture.from].type) ? center(d.nodes[gesture.from]).x : center(d.nodes[gesture.from]).x}
              y1={LIFELINES.has(d.nodes[gesture.from].type) || d.nodes[gesture.from].type === "activation" ? gesture.y0 : center(d.nodes[gesture.from]).y}
              x2={gesture.x}
              y2={gesture.y}
              stroke="#27ae60"
              strokeWidth={2 / viewport.zoom}
              strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
              pointerEvents="none"
            />
          )}
          {gesture?.kind === "marquee" && (
            <rect
              x={Math.min(gesture.x0, gesture.x1)}
              y={Math.min(gesture.y0, gesture.y1)}
              width={Math.abs(gesture.x1 - gesture.x0)}
              height={Math.abs(gesture.y1 - gesture.y0)}
              fill="rgba(47,128,237,0.07)"
              stroke={SELECT}
              strokeWidth={1 / viewport.zoom}
              pointerEvents="none"
            />
          )}
        </g>
        {/* Tiradores en coordenadas de pantalla */}
        {single && !editing && tool.mode === "select" && !gesture && (() => {
          const s = screenBox(single);
          const handles: [Handle, number, number, string][] = FIXED.has(single.type)
            ? []
            : [
                ["nw", s.x, s.y, "nwse-resize"],
                ["n", s.x + s.w / 2, s.y, "ns-resize"],
                ["ne", s.x + s.w, s.y, "nesw-resize"],
                ["e", s.x + s.w, s.y + s.h / 2, "ew-resize"],
                ["se", s.x + s.w, s.y + s.h, "nwse-resize"],
                ["s", s.x + s.w / 2, s.y + s.h, "ns-resize"],
                ["sw", s.x, s.y + s.h, "nesw-resize"],
                ["w", s.x, s.y + s.h / 2, "ew-resize"],
              ];
          const cx = s.x + s.w + 16;
          const cy = LIFELINES.has(single.type) ? s.y + 20 * viewport.zoom : s.y + s.h / 2;
          return (
            <g>
              {handles.map(([id, x, y, c]) => (
                <rect key={id} data-handle={id} x={x - 4} y={y - 4} width={8} height={8} fill="#ffffff" stroke={SELECT} strokeWidth={1.5} style={{ cursor: c }} />
              ))}
              <g data-handle="connect" style={{ cursor: "crosshair" }}>
                <circle cx={cx} cy={cy} r={9} fill={SELECT} />
                <path d={`M${cx - 4} ${cy} H${cx + 4} M${cx + 1} ${cy - 3} L${cx + 4} ${cy} L${cx + 1} ${cy + 3}`} stroke="#ffffff" strokeWidth={1.6} fill="none" />
                <title>Arrastra para conectar con otra figura (o suelta en vacío para crear una nueva)</title>
              </g>
            </g>
          );
        })()}
      </svg>

      {editing &&
        (editing.multiline ? (
          <textarea
            autoFocus
            data-inline-editor
            defaultValue={editing.value}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commitEdit(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") setEditing(null);
              if (e.key === "Enter" && (e.ctrlKey || !editing.multiline)) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            className="absolute z-10 p-1.5 text-[13px] rounded border-2 border-[#2f80ed] bg-white shadow-lg outline-none resize-none"
            style={{ left: editing.box.x, top: editing.box.y, width: Math.max(140, editing.box.w), height: Math.max(48, editing.box.h) }}
          />
        ) : (
          <input
            autoFocus
            data-inline-editor
            defaultValue={editing.value}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commitEdit(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") setEditing(null);
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="absolute z-10 px-1.5 text-[13px] rounded border-2 border-[#2f80ed] bg-white shadow-lg outline-none font-semibold"
            style={{ left: editing.box.x, top: editing.box.y + Math.max(0, (editing.box.h - 28) / 2), width: Math.max(150, editing.box.w), height: 28 }}
          />
        ))}

      {tool.mode !== "select" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#1e3a5f] text-white text-[12px] shadow-lg pointer-events-none">
          {tool.mode === "shape" ? `Haz clic en el lienzo para colocar: ${tool.item.label} (Mayús: varias)` : "Arrastra de una figura a otra para conectarlas · Esc para cancelar"}
        </div>
      )}
    </div>
  );
});

export { member };
