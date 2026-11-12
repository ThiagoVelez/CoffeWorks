// Lienzo de CoffeeVector (SVG): mesas de trabajo, objetos y herramientas.

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Artboard, Bounds, PathNode, PathObj, Pt, Subpath, TextObj, Tool, VDoc, VObject } from "../types";
import { ObjectSvg } from "../services/svg";
import { boundsCenter, dist, nearestOnPath, objectBounds, pathD, rotateObject, rotatePt, scaleObject, simplify, smoothNodes, splitSegment, translateObject } from "../services/geom";
import { artboard, cloneObject, ellipseNodes, findObject, newId, pathObj, polygonNodes, rectNodes, selectionBounds, starNodes, textObj, topLevelOf } from "../services/model";
import type { Paint, StrokeStyle } from "../types";

export interface View {
  x: number;
  y: number;
  zoom: number;
}

export interface NodeRef {
  id: string;
  sub: number;
  node: number;
}

export interface ShapeOptions {
  sides: number;
  points: number;
  radius: number;
}

interface Props {
  doc: VDoc;
  tool: Tool;
  setTool: (t: Tool) => void;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  selection: string[];
  setSelection: (ids: string[]) => void;
  nodes: NodeRef[];
  setNodes: (n: NodeRef[]) => void;
  activeArtboard: string | null;
  setActiveArtboard: (id: string | null) => void;
  fill: Paint | null;
  stroke: StrokeStyle | null;
  shapeOpts: ShapeOptions;
  /** Aplica un cambio (agrupado por `key` durante los arrastres). */
  onChange: (doc: VDoc, key?: string) => void;
  onEyedropper: (o: VObject) => void;
  showGrid: boolean;
  snap: boolean;
}

export interface CanvasHandle {
  fit: (b?: Bounds | null) => void;
  zoomBy: (k: number) => void;
  finishPen: () => void;
  editText: (id: string) => void;
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "move"; start: Pt; orig: VDoc; ids: string[]; moved: boolean; dup: boolean }
  | { kind: "scale"; handle: string; start: Pt; orig: VDoc; box: Bounds; ids: string[] }
  | { kind: "rotate"; start: Pt; orig: VDoc; center: Pt; ids: string[] }
  | { kind: "marquee"; start: Pt; cur: Pt; direct: boolean; add: boolean }
  | { kind: "nodes"; start: Pt; orig: VDoc; moved: boolean }
  | { kind: "handle"; ref: NodeRef; which: "hin" | "hout"; orig: VDoc; alt: boolean }
  | { kind: "pen"; ref: NodeRef; orig: VDoc }
  | { kind: "pencil"; pts: Pt[] }
  | { kind: "shape"; start: Pt; cur: Pt; shift: boolean; alt: boolean }
  | { kind: "artboard"; start: Pt; cur: Pt; moving: Artboard | null; orig: VDoc | null };

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(p, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 700 });
  const gesture = useRef<Gesture | null>(null);
  const [, force] = useState(0);
  const redraw = () => force((n) => n + 1);
  const [pen, setPen] = useState<{ id: string; sub: number } | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const space = useRef(false);
  const P = useRef(p);
  P.current = p;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(
    (b?: Bounds | null) => {
      const el = hostRef.current;
      if (!el) return;
      const box = b || P.current.doc.artboards.find((a) => a.id === P.current.activeArtboard) || P.current.doc.artboards[0];
      if (!box) return;
      const zoom = Math.max(0.02, Math.min(8, Math.min((el.clientWidth - 100) / box.w, (el.clientHeight - 100) / box.h)));
      P.current.setView({ zoom, x: el.clientWidth / 2 - (box.x + box.w / 2) * zoom, y: el.clientHeight / 2 - (box.y + box.h / 2) * zoom });
    },
    []
  );

  const zoomAt = (k: number, cx: number, cy: number) =>
    p.setView((v) => {
      const zoom = Math.min(64, Math.max(0.02, v.zoom * k));
      const f = zoom / v.zoom;
      return { zoom, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });

  const toDoc = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = P.current.view;
    return { x: (e.clientX - r.left - v.x) / v.zoom, y: (e.clientY - r.top - v.y) / v.zoom };
  };

  const snapPt = (q: Pt): Pt => (P.current.snap ? { x: Math.round(q.x), y: Math.round(q.y) } : q);

  const finishPen = () => {
    setPen(null);
    redraw();
  };

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (k: number) => zoomAt(k, size.w / 2, size.h / 2),
    finishPen,
    editText: (id: string) => setEditing(id),
  }));

  useEffect(() => {
    if (p.tool !== "pen") setPen(null);
  }, [p.tool]);

  // ------------------------------------------------------------------------
  // Ayudas
  // ------------------------------------------------------------------------

  const z = p.view.zoom;
  const selBox = selectionBounds(p.doc, p.selection);

  const handleAt = (q: Pt): string | null => {
    if (!selBox || p.tool !== "select") return null;
    const pts = handlePoints(selBox);
    const tol = 7 / z;
    for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - q.x) < tol && Math.abs(pts[i].y - q.y) < tol) return HANDLES[i];
    // Junto a una esquina (fuera de la caja): girar
    for (const i of [0, 2, 4, 6]) {
      const d = dist(pts[i], q);
      if (d >= tol && d < 22 / z && (q.x < selBox.x || q.x > selBox.x + selBox.w || q.y < selBox.y || q.y > selBox.y + selBox.h)) return "rotate";
    }
    return null;
  };

  const objectIdAt = (target: EventTarget | null): string | null => {
    const el = (target as Element | null)?.closest?.("[data-oid]");
    return el ? el.getAttribute("data-oid") : null;
  };

  const selectedPaths = (): PathObj[] => p.selection.map((id) => findObject(p.doc.objects, id)).filter((o): o is PathObj => o?.type === "path");

  /** Nodo o manejador bajo el puntero (selección directa / pluma). */
  const nodeAt = (q: Pt): { ref: NodeRef; which: "node" | "hin" | "hout" } | null => {
    const tol = 6 / z;
    for (const o of selectedPaths())
      for (let s = 0; s < o.subpaths.length; s++)
        for (let n = 0; n < o.subpaths[s].nodes.length; n++) {
          const node = o.subpaths[s].nodes[n];
          const ref = { id: o.id, sub: s, node: n };
          const nodeSelected = p.nodes.some((r) => r.id === o.id && r.sub === s && r.node === n);
          if (nodeSelected || p.tool === "pen") {
            if (node.hin && dist(node.hin, q) < tol) return { ref, which: "hin" };
            if (node.hout && dist(node.hout, q) < tol) return { ref, which: "hout" };
          }
          if (dist(node, q) < tol) return { ref, which: "node" };
        }
    return null;
  };

  const updateObj = (doc: VDoc, id: string, fn: (o: VObject) => VObject): VDoc => {
    const rec = (list: VObject[]): VObject[] => list.map((o) => (o.id === id ? fn(o) : o.type === "group" ? { ...o, children: rec(o.children) } : o));
    return { ...doc, objects: rec(doc.objects) };
  };

  const updateNodeIn = (doc: VDoc, ref: NodeRef, fn: (n: PathNode, sp: Subpath) => PathNode): VDoc =>
    updateObj(doc, ref.id, (o) =>
      o.type !== "path" ? o : { ...o, subpaths: o.subpaths.map((sp, si) => (si !== ref.sub ? sp : { ...sp, nodes: sp.nodes.map((n, ni) => (ni === ref.node ? fn(n, sp) : n)) })) }
    );

  // ------------------------------------------------------------------------
  // Puntero
  // ------------------------------------------------------------------------

  const onDown = (e: React.PointerEvent) => {
    if (editing) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const q = toDoc(e);
    const s = snapPt(q);
    if (e.button === 1 || space.current || p.tool === "hand") {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: p.view.x, vy: p.view.y };
      return;
    }
    if (e.button !== 0) return;
    const hitId = objectIdAt(e.target);
    switch (p.tool) {
      case "zoom": {
        const r = svgRef.current!.getBoundingClientRect();
        zoomAt(e.altKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
        return;
      }
      case "select": {
        const h = handleAt(q);
        if (h === "rotate" && selBox) {
          gesture.current = { kind: "rotate", start: q, orig: p.doc, center: boundsCenter(selBox), ids: p.selection };
          return;
        }
        if (h && selBox) {
          gesture.current = { kind: "scale", handle: h, start: q, orig: p.doc, box: selBox, ids: p.selection };
          return;
        }
        if (hitId) {
          const top = topLevelOf(p.doc, hitId);
          if (!top || top.locked) return;
          let ids = p.selection;
          if (e.shiftKey) ids = ids.includes(top.id) ? ids.filter((x) => x !== top.id) : [...ids, top.id];
          else if (!ids.includes(top.id)) ids = [top.id];
          p.setSelection(ids);
          gesture.current = { kind: "move", start: s, orig: p.doc, ids, moved: false, dup: e.altKey };
          return;
        }
        gesture.current = { kind: "marquee", start: q, cur: q, direct: false, add: e.shiftKey };
        if (!e.shiftKey) p.setSelection([]);
        return;
      }
      case "direct": {
        const hit = nodeAt(q);
        if (hit && hit.which !== "node") {
          gesture.current = { kind: "handle", ref: hit.ref, which: hit.which, orig: p.doc, alt: e.altKey };
          return;
        }
        if (hit) {
          const has = p.nodes.some((r) => r.id === hit.ref.id && r.sub === hit.ref.sub && r.node === hit.ref.node);
          if (e.shiftKey) p.setNodes(has ? p.nodes.filter((r) => !(r.id === hit.ref.id && r.sub === hit.ref.sub && r.node === hit.ref.node)) : [...p.nodes, hit.ref]);
          else if (!has) p.setNodes([hit.ref]);
          gesture.current = { kind: "nodes", start: s, orig: p.doc, moved: false };
          return;
        }
        if (hitId) {
          const o = findObject(p.doc.objects, hitId);
          if (o && !o.locked) {
            // Clic en el trazado: se selecciona (sin nodos) y se puede arrastrar entero
            p.setSelection(e.shiftKey ? [...new Set([...p.selection, hitId])] : [hitId]);
            if (!e.shiftKey) p.setNodes([]);
            gesture.current = { kind: "move", start: s, orig: p.doc, ids: [hitId], moved: false, dup: e.altKey };
          }
          return;
        }
        gesture.current = { kind: "marquee", start: q, cur: q, direct: true, add: e.shiftKey };
        if (!e.shiftKey) p.setNodes([]);
        return;
      }
      case "pen": {
        // Cerrar el trazado al pulsar su primer nodo
        if (pen) {
          const o = findObject(p.doc.objects, pen.id) as PathObj | null;
          const sp = o?.subpaths[pen.sub];
          if (o && sp && sp.nodes.length > 1 && dist(sp.nodes[0], q) < 8 / z) {
            p.onChange(updateObj(p.doc, o.id, (x) => (x.type === "path" ? { ...x, subpaths: x.subpaths.map((y, i) => (i === pen.sub ? { ...y, closed: true } : y)) } : x)));
            gesture.current = { kind: "pen", ref: { id: o.id, sub: pen.sub, node: 0 }, orig: p.doc };
            setPen(null);
            return;
          }
          if (o && sp) {
            const next = updateObj(p.doc, o.id, (x) => (x.type === "path" ? { ...x, subpaths: x.subpaths.map((y, i) => (i === pen.sub ? { ...y, nodes: [...y.nodes, { x: s.x, y: s.y }] } : y)) } : x));
            p.onChange(next);
            gesture.current = { kind: "pen", ref: { id: o.id, sub: pen.sub, node: sp.nodes.length }, orig: next };
            return;
          }
        }
        // Sin trazado en curso: añadir o quitar nodos de un trazado seleccionado
        const hit = nodeAt(q);
        if (hit?.which === "node") {
          const o = findObject(p.doc.objects, hit.ref.id) as PathObj;
          const sp = o.subpaths[hit.ref.sub];
          if (!sp.closed && (hit.ref.node === sp.nodes.length - 1 || hit.ref.node === 0)) {
            // Continuar un trazado abierto desde un extremo
            if (hit.ref.node === 0) {
              const rev = reverseSub(sp);
              p.onChange(updateObj(p.doc, o.id, (x) => (x.type === "path" ? { ...x, subpaths: x.subpaths.map((y, i) => (i === hit.ref.sub ? rev : y)) } : x)));
            }
            setPen({ id: o.id, sub: hit.ref.sub });
            return;
          }
          if (sp.nodes.length > 2) {
            p.onChange(updateObj(p.doc, o.id, (x) => (x.type === "path" ? { ...x, subpaths: x.subpaths.map((y, i) => (i === hit.ref.sub ? { ...y, nodes: y.nodes.filter((_, j) => j !== hit.ref.node) } : y)) } : x)));
            p.setNodes([]);
          }
          return;
        }
        for (const o of selectedPaths()) {
          const near = nearestOnPath(o, q);
          if (near && near.d < 6 / z) {
            p.onChange(updateObj(p.doc, o.id, (x) => (x.type === "path" ? { ...x, subpaths: x.subpaths.map((y, i) => (i === near.sub ? splitSegment(y, near.seg, near.t) : y)) } : x)));
            return;
          }
        }
        const obj = pathObj("Trazado", [{ x: s.x, y: s.y }], false, null, p.stroke || { color: "#1f1f1f", opacity: 1, width: 2, cap: "round", join: "round", dash: [] });
        if (p.fill && p.fill.type !== "solid") obj.fill = p.fill;
        else obj.fill = p.fill;
        const next = { ...p.doc, objects: [...p.doc.objects, obj] };
        p.onChange(next);
        p.setSelection([obj.id]);
        setPen({ id: obj.id, sub: 0 });
        gesture.current = { kind: "pen", ref: { id: obj.id, sub: 0, node: 0 }, orig: next };
        return;
      }
      case "convert": {
        const hit = nodeAt(q);
        if (!hit || hit.which !== "node") {
          if (hitId) p.setSelection([hitId]);
          return;
        }
        const o = findObject(p.doc.objects, hit.ref.id) as PathObj;
        const sp = o.subpaths[hit.ref.sub];
        const n = sp.nodes[hit.ref.node];
        if (n.hin || n.hout) p.onChange(updateNodeIn(p.doc, hit.ref, (x) => ({ ...x, hin: null, hout: null })));
        else {
          const prev = sp.nodes[(hit.ref.node - 1 + sp.nodes.length) % sp.nodes.length];
          const next = sp.nodes[(hit.ref.node + 1) % sp.nodes.length];
          const tx = (next.x - prev.x) / 4;
          const ty = (next.y - prev.y) / 4;
          p.onChange(updateNodeIn(p.doc, hit.ref, (x) => ({ ...x, hin: { x: x.x - tx, y: x.y - ty }, hout: { x: x.x + tx, y: x.y + ty } })));
        }
        return;
      }
      case "pencil":
        gesture.current = { kind: "pencil", pts: [q] };
        return;
      case "rect":
      case "roundRect":
      case "ellipse":
      case "polygon":
      case "star":
      case "line":
        gesture.current = { kind: "shape", start: s, cur: s, shift: e.shiftKey, alt: e.altKey };
        return;
      case "text": {
        // Evita que el clic quite el foco al editor de texto recién creado
        e.preventDefault();
        if (hitId) {
          const o = findObject(p.doc.objects, hitId);
          if (o?.type === "text") {
            p.setSelection([o.id]);
            setEditing(o.id);
            return;
          }
        }
        const t = textObj(s.x, s.y, "Texto", p.fill || { type: "solid", color: "#1f1f1f", opacity: 1 });
        p.onChange({ ...p.doc, objects: [...p.doc.objects, t] });
        p.setSelection([t.id]);
        setEditing(t.id);
        return;
      }
      case "eyedropper": {
        if (hitId) {
          const o = findObject(p.doc.objects, hitId);
          if (o) p.onEyedropper(o);
        }
        return;
      }
      case "artboard": {
        const ab = [...p.doc.artboards].reverse().find((a) => q.x >= a.x && q.x <= a.x + a.w && q.y >= a.y && q.y <= a.y + a.h);
        if (ab) {
          p.setActiveArtboard(ab.id);
          gesture.current = { kind: "artboard", start: s, cur: s, moving: ab, orig: p.doc };
        } else gesture.current = { kind: "artboard", start: s, cur: s, moving: null, orig: null };
        return;
      }
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const q = toDoc(e);
    const s = snapPt(q);
    if (p.tool === "pen" && pen) setHover(s);
    const g = gesture.current;
    if (!g) return;
    switch (g.kind) {
      case "pan":
        p.setView((v) => ({ ...v, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy }));
        return;
      case "move": {
        let dx = s.x - g.start.x;
        let dy = s.y - g.start.y;
        if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
        if (!g.moved && Math.hypot(dx, dy) * z < 3) return;
        g.moved = true;
        if (g.dup) {
          // Alt + arrastrar: duplicar (una sola vez)
          const copies = g.ids.map((id) => cloneObject(findObject(g.orig.objects, id)!));
          g.orig = { ...g.orig, objects: [...g.orig.objects, ...copies] };
          g.ids = copies.map((c) => c.id);
          g.dup = false;
          p.setSelection(g.ids);
        }
        const base = g.orig;
        const ids = g.ids;
        const moved = new Map(ids.map((id) => [id, translateObject(findObject(base.objects, id)!, dx, dy)]));
        p.onChange({ ...base, objects: base.objects.map((o) => moved.get(o.id) || o) }, "move");
        return;
      }
      case "scale": {
        const b = g.box;
        let x0 = b.x;
        let y0 = b.y;
        let x1 = b.x + b.w;
        let y1 = b.y + b.h;
        if (g.handle.includes("w")) x0 = s.x;
        if (g.handle.includes("e")) x1 = s.x;
        if (g.handle.includes("n")) y0 = s.y;
        if (g.handle.includes("s")) y1 = s.y;
        if (e.shiftKey && g.handle.length === 2) {
          const k = Math.max(Math.abs(x1 - x0) / (b.w || 1), Math.abs(y1 - y0) / (b.h || 1));
          if (g.handle.includes("w")) x0 = x1 - b.w * k;
          else x1 = x0 + b.w * k;
          if (g.handle.includes("n")) y0 = y1 - b.h * k;
          else y1 = y0 + b.h * k;
        }
        const to = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.max(1e-3, Math.abs(x1 - x0)), h: Math.max(1e-3, Math.abs(y1 - y0)) };
        const map = new Map(g.ids.map((id) => [id, scaleObject(findObject(g.orig.objects, id)!, b, to)]));
        p.onChange({ ...g.orig, objects: g.orig.objects.map((o) => map.get(o.id) || o) }, "scale");
        return;
      }
      case "rotate": {
        let a = ((Math.atan2(q.y - g.center.y, q.x - g.center.x) - Math.atan2(g.start.y - g.center.y, g.start.x - g.center.x)) * 180) / Math.PI;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        const map = new Map(g.ids.map((id) => [id, rotateObject(findObject(g.orig.objects, id)!, g.center, a)]));
        p.onChange({ ...g.orig, objects: g.orig.objects.map((o) => map.get(o.id) || o) }, "rotate");
        return;
      }
      case "marquee":
        g.cur = q;
        redraw();
        return;
      case "nodes": {
        const dx = s.x - g.start.x;
        const dy = s.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) * z < 2) return;
        g.moved = true;
        let next = g.orig;
        for (const r of p.nodes)
          next = updateNodeIn(next, r, (n) => ({ x: n.x + dx, y: n.y + dy, hin: n.hin ? { x: n.hin.x + dx, y: n.hin.y + dy } : n.hin, hout: n.hout ? { x: n.hout.x + dx, y: n.hout.y + dy } : n.hout }));
        p.onChange(next, "nodes");
        return;
      }
      case "handle": {
        const next = updateNodeIn(g.orig, g.ref, (n) => {
          const other = g.which === "hin" ? "hout" : "hin";
          const out: PathNode = { ...n, [g.which]: s };
          // Mantiene el nodo suave (Alt rompe la simetría)
          if (!e.altKey && !g.alt && n[other]) {
            const len = dist(n, n[other]!);
            const d = dist(n, s) || 1;
            out[other] = { x: n.x - ((s.x - n.x) / d) * len, y: n.y - ((s.y - n.y) / d) * len };
          }
          return out;
        });
        p.onChange(next, "handle");
        return;
      }
      case "pen": {
        // Arrastrar al crear un nodo: manejadores simétricos
        const next = updateNodeIn(g.orig, g.ref, (n) => (dist(n, s) * z < 3 ? n : { ...n, hout: s, hin: { x: 2 * n.x - s.x, y: 2 * n.y - s.y } }));
        p.onChange(next, "pen");
        return;
      }
      case "pencil":
        g.pts.push(q);
        redraw();
        return;
      case "shape":
        g.cur = s;
        g.shift = e.shiftKey;
        g.alt = e.altKey;
        redraw();
        return;
      case "artboard": {
        g.cur = s;
        if (g.moving && g.orig) {
          const dx = s.x - g.start.x;
          const dy = s.y - g.start.y;
          p.onChange({ ...g.orig, artboards: g.orig.artboards.map((a) => (a.id === g.moving!.id ? { ...a, x: Math.round(g.moving!.x + dx), y: Math.round(g.moving!.y + dy) } : a)) }, "artboard-move");
        } else redraw();
        return;
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    switch (g.kind) {
      case "marquee": {
        const r = norm(g.start, g.cur);
        if (r.w * z < 3 && r.h * z < 3) {
          redraw();
          return;
        }
        if (g.direct) {
          const refs: NodeRef[] = [];
          const paths = p.doc.objects.filter((o): o is PathObj => o.type === "path" && o.visible && !o.locked);
          for (const o of paths)
            o.subpaths.forEach((sp, si) => sp.nodes.forEach((n, ni) => n.x >= r.x && n.x <= r.x + r.w && n.y >= r.y && n.y <= r.y + r.h && refs.push({ id: o.id, sub: si, node: ni })));
          p.setNodes(g.add ? [...p.nodes, ...refs] : refs);
          p.setSelection([...new Set(refs.map((x) => x.id))]);
        } else {
          const hits = p.doc.objects.filter((o) => {
            if (!o.visible || o.locked) return false;
            const b = objectBounds(o);
            return b && b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
          });
          p.setSelection(g.add ? [...new Set([...p.selection, ...hits.map((o) => o.id)])] : hits.map((o) => o.id));
        }
        redraw();
        return;
      }
      case "pencil": {
        if (g.pts.length < 3) {
          redraw();
          return;
        }
        const pts = simplify(g.pts, 1.6 / z);
        const closed = pts.length > 3 && dist(pts[0], pts[pts.length - 1]) < 10 / z;
        const nodes = smoothNodes(closed ? pts.slice(0, -1) : pts, closed);
        const o = pathObj("Trazo a mano", nodes, closed, closed ? p.fill : null, p.stroke || { color: "#1f1f1f", opacity: 1, width: 3, cap: "round", join: "round", dash: [] });
        p.onChange({ ...p.doc, objects: [...p.doc.objects, o] });
        p.setSelection([o.id]);
        redraw();
        return;
      }
      case "shape": {
        const o = shapeFrom(p.tool, g, p.fill, p.stroke, p.shapeOpts);
        if (o) {
          p.onChange({ ...p.doc, objects: [...p.doc.objects, o] });
          p.setSelection([o.id]);
        }
        redraw();
        return;
      }
      case "artboard": {
        if (!g.moving) {
          const r = norm(g.start, g.cur);
          if (r.w > 10 && r.h > 10) {
            const ab = artboard(`Mesa de trabajo ${p.doc.artboards.length + 1}`, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
            p.onChange({ ...p.doc, artboards: [...p.doc.artboards, ab] });
            p.setActiveArtboard(ab.id);
          }
        }
        redraw();
        return;
      }
      default:
        void e;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    else p.setView((v) => ({ ...v, x: v.x - (e.shiftKey ? e.deltaY : e.deltaX), y: v.y - (e.shiftKey ? 0 : e.deltaY) }));
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.code === "Space") space.current = true;
      if ((e.key === "Enter" || e.key === "Escape") && pen) finishPen();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  // ------------------------------------------------------------------------
  // Dibujo
  // ------------------------------------------------------------------------

  const g = gesture.current;
  const sw = 1 / z;
  const editObj = editing ? (findObject(p.doc.objects, editing) as TextObj | null) : null;

  const cursor = p.tool === "hand" ? "grab" : p.tool === "zoom" ? "zoom-in" : p.tool === "text" ? "text" : p.tool === "select" || p.tool === "direct" ? "default" : "crosshair";

  return (
    <div ref={hostRef} className="relative flex-1 min-w-0 overflow-hidden bg-[#2a2a2e]" data-vector-canvas>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        style={{ cursor, touchAction: "none", display: "block" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          const id = objectIdAt(e.target);
          const o = id ? findObject(p.doc.objects, id) : null;
          if (o?.type === "text") {
            p.setSelection([o.id]);
            setEditing(o.id);
          } else if (o?.type === "path" && p.tool === "select") p.setTool("direct");
          else if (p.tool === "pen" && pen) finishPen();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${p.view.x} ${p.view.y}) scale(${z})`}>
          {/* Mesas de trabajo */}
          {p.doc.artboards.map((a) => (
            <g key={a.id}>
              <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={a.background || "#ffffff"} stroke={a.id === p.activeArtboard ? "#e8590c" : "rgba(0,0,0,0.4)"} strokeWidth={sw * (a.id === p.activeArtboard ? 2 : 1)} style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }} />
              <text x={a.x} y={a.y - 6 * sw} fontSize={11 * sw} fill="#b9b9c0" style={{ pointerEvents: "none" }}>
                {a.name}
              </text>
            </g>
          ))}
          {p.showGrid && <Grid boards={p.doc.artboards} sw={sw} />}
          {/* Objetos */}
          {p.doc.objects.map((o) => (o.id === editing ? null : <ObjectSvg key={o.id} o={o} hit />))}
          {/* Contorno de los objetos seleccionados */}
          {p.selection.map((id) => {
            const o = findObject(p.doc.objects, id);
            if (!o) return null;
            if (o.type === "path") return <path key={id} d={pathD(o.subpaths)} fill="none" stroke="#4dabf7" strokeWidth={sw} style={{ pointerEvents: "none" }} />;
            const b = objectBounds(o);
            return b ? <rect key={id} x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#4dabf7" strokeWidth={sw} style={{ pointerEvents: "none" }} /> : null;
          })}
          {/* Caja de transformación */}
          {p.tool === "select" && selBox && !(g && g.kind === "move") && (
            <g style={{ pointerEvents: "none" }}>
              <rect x={selBox.x} y={selBox.y} width={selBox.w} height={selBox.h} fill="none" stroke="#4dabf7" strokeWidth={sw} strokeDasharray={`${4 * sw} ${3 * sw}`} />
              {handlePoints(selBox).map((h, i) => (
                <rect key={i} x={h.x - 4 * sw} y={h.y - 4 * sw} width={8 * sw} height={8 * sw} fill="#fff" stroke="#4dabf7" strokeWidth={sw} />
              ))}
            </g>
          )}
          {/* Nodos (selección directa y pluma) */}
          {(p.tool === "direct" || p.tool === "pen" || p.tool === "convert") &&
            selectedPaths().map((o) =>
              o.subpaths.map((sp, si) =>
                sp.nodes.map((n, ni) => {
                  const sel = p.nodes.some((r) => r.id === o.id && r.sub === si && r.node === ni);
                  return (
                    <g key={`${o.id}-${si}-${ni}`} style={{ pointerEvents: "none" }}>
                      {(sel || p.tool === "pen") &&
                        (["hin", "hout"] as const).map((k) =>
                          n[k] ? (
                            <g key={k}>
                              <line x1={n.x} y1={n.y} x2={n[k]!.x} y2={n[k]!.y} stroke="#4dabf7" strokeWidth={sw} />
                              <circle cx={n[k]!.x} cy={n[k]!.y} r={3.5 * sw} fill="#fff" stroke="#4dabf7" strokeWidth={sw} />
                            </g>
                          ) : null
                        )}
                      <rect x={n.x - 3.5 * sw} y={n.y - 3.5 * sw} width={7 * sw} height={7 * sw} fill={sel ? "#4dabf7" : "#fff"} stroke="#4dabf7" strokeWidth={sw} data-node />
                    </g>
                  );
                })
              )
            )}
          {/* Vista previa de la pluma */}
          {pen && hover && (() => {
            const o = findObject(p.doc.objects, pen.id) as PathObj | null;
            const last = o?.subpaths[pen.sub]?.nodes.slice(-1)[0];
            if (!last) return null;
            const c1 = last.hout || last;
            return <path d={`M${last.x} ${last.y} C${c1.x} ${c1.y} ${hover.x} ${hover.y} ${hover.x} ${hover.y}`} fill="none" stroke="#4dabf7" strokeWidth={sw} strokeDasharray={`${3 * sw} ${3 * sw}`} style={{ pointerEvents: "none" }} />;
          })()}
          {g?.kind === "marquee" && (() => {
            const r = norm(g.start, g.cur);
            return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(77,171,247,0.12)" stroke="#4dabf7" strokeWidth={sw} />;
          })()}
          {g?.kind === "pencil" && <polyline points={g.pts.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={p.stroke?.color || "#1f1f1f"} strokeWidth={(p.stroke?.width || 2)} strokeLinecap="round" strokeLinejoin="round" />}
          {g?.kind === "shape" && (() => {
            const o = shapeFrom(p.tool, g, p.fill, p.stroke, p.shapeOpts);
            return o ? <ObjectSvg o={o} /> : null;
          })()}
          {g?.kind === "artboard" && !g.moving && (() => {
            const r = norm(g.start, g.cur);
            return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(255,255,255,0.6)" stroke="#e8590c" strokeWidth={sw} />;
          })()}
        </g>
      </svg>
      {editObj && (
        <TextEditor
          obj={editObj}
          view={p.view}
          onDone={(text) => {
            setEditing(null);
            if (!text.trim()) p.onChange({ ...p.doc, objects: p.doc.objects.filter((o) => o.id !== editObj.id) });
            else if (text !== editObj.text) p.onChange(updateObj(p.doc, editObj.id, (o) => ({ ...o, text, name: text.slice(0, 24) }) as VObject));
          }}
        />
      )}
      {pen && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] bg-black/70 text-white px-2 py-1 rounded pointer-events-none">Clic: nodo · arrastrar: curva · clic en el primer nodo: cerrar · Intro: terminar</div>}
    </div>
  );
});

// ---------------------------------------------------------------------------

const Grid: React.FC<{ boards: Artboard[]; sw: number }> = ({ boards, sw }) => (
  <g style={{ pointerEvents: "none" }}>
    {boards.map((a) => {
      const step = 20;
      const lines: React.ReactNode[] = [];
      for (let x = a.x + step; x < a.x + a.w; x += step) lines.push(<line key={`x${x}`} x1={x} y1={a.y} x2={x} y2={a.y + a.h} />);
      for (let y = a.y + step; y < a.y + a.h; y += step) lines.push(<line key={`y${y}`} x1={a.x} y1={y} x2={a.x + a.w} y2={y} />);
      return (
        <g key={a.id} stroke="rgba(0,120,255,0.15)" strokeWidth={sw}>
          {lines}
        </g>
      );
    })}
  </g>
);

const TextEditor: React.FC<{ obj: TextObj; view: View; onDone: (text: string) => void }> = ({ obj, view, onDone }) => {
  const [text, setText] = useState(obj.text === "Texto" ? "" : obj.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 30);
    return () => window.clearTimeout(id);
  }, []);
  const size = obj.size * view.zoom;
  return (
    <textarea
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onDone(text)}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) (e.target as HTMLTextAreaElement).blur();
        e.stopPropagation();
      }}
      data-text-editor
      placeholder="Escribe…"
      style={{
        position: "absolute",
        left: view.x + obj.x * view.zoom - 2,
        top: view.y + (obj.y - obj.size * 0.85) * view.zoom - 2,
        fontFamily: `'${obj.font}', sans-serif`,
        fontSize: size,
        fontWeight: obj.weight,
        fontStyle: obj.italic ? "italic" : "normal",
        lineHeight: obj.lineHeight,
        color: obj.fill?.type === "solid" ? obj.fill.color : "#1f1f1f",
        background: "rgba(255,255,255,0.6)",
        outline: "1px solid #4dabf7",
        border: "none",
        resize: "none",
        whiteSpace: "pre",
        overflow: "hidden",
        minWidth: 60,
        width: Math.max(80, (text.split("\n").reduce((m, l) => Math.max(m, l.length), 4) + 2) * size * 0.6),
        height: (text.split("\n").length + 0.3) * size * obj.lineHeight + 4,
        padding: 0,
        zIndex: 20,
      }}
    />
  );
};

const norm = (a: Pt, b: Pt): Bounds => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });

function handlePoints(b: Bounds): Pt[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w / 2, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h / 2 },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x + b.w / 2, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
    { x: b.x, y: b.y + b.h / 2 },
  ];
}

function reverseSub(sp: Subpath): Subpath {
  return { ...sp, nodes: [...sp.nodes].reverse().map((n) => ({ ...n, hin: n.hout, hout: n.hin })) };
}

function shapeFrom(tool: Tool, g: { start: Pt; cur: Pt; shift: boolean; alt: boolean }, fill: Paint | null, stroke: StrokeStyle | null, o: ShapeOptions): PathObj | null {
  let { start, cur } = g;
  const dx = cur.x - start.x;
  const dy = cur.y - start.y;
  if (Math.hypot(dx, dy) < 1) return null;
  if (tool === "line") {
    let end = cur;
    if (g.shift) {
      const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      end = { x: start.x + Math.cos(a) * len, y: start.y + Math.sin(a) * len };
    }
    return pathObj("Línea", [{ ...start }, { ...end }], false, null, stroke || { color: "#1f1f1f", opacity: 1, width: 2, cap: "round", join: "round", dash: [] });
  }
  if (tool === "polygon" || tool === "star") {
    const r = Math.hypot(dx, dy);
    const nodes = tool === "polygon" ? polygonNodes(start.x, start.y, r, Math.max(3, o.sides)) : starNodes(start.x, start.y, r, Math.max(3, o.points));
    const rot = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    return pathObj(tool === "polygon" ? "Polígono" : "Estrella", g.shift ? nodes : nodes.map((n) => rotatePt(n, start, rot)), true, fill, stroke);
  }
  let w = dx;
  let h = dy;
  if (g.shift) {
    const m = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * m;
    h = Math.sign(h || 1) * m;
  }
  if (g.alt) {
    start = { x: start.x - w, y: start.y - h };
    w *= 2;
    h *= 2;
  }
  const x = Math.min(start.x, start.x + w);
  const y = Math.min(start.y, start.y + h);
  const aw = Math.abs(w);
  const ah = Math.abs(h);
  if (tool === "ellipse") return pathObj("Elipse", ellipseNodes(x + aw / 2, y + ah / 2, aw / 2, ah / 2), true, fill, stroke);
  return pathObj(tool === "roundRect" ? "Rectángulo redondeado" : "Rectángulo", rectNodes(x, y, aw, ah, tool === "roundRect" ? o.radius : 0), true, fill, stroke);
}

export { newId };
