// Lienzo de CoffeePaint: vista con zoom, desplazamiento y giro (también con
// dos dedos), trazos con presión del lápiz, simetría y estabilizador.

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PaintDoc, PaintLayer, Symmetry, Tool } from "../types";
import { compose } from "../services/model";
import { ctx2d, getCanvas, newCanvas, subscribe } from "../services/pixels";
import { ERASER, PaintStroke, SMUDGE, Stabilizer, floodMask, type BrushDef } from "../services/brushes";

export interface View {
  x: number;
  y: number;
  zoom: number;
  /** Giro de la vista en grados. */
  rot: number;
}

interface Props {
  doc: PaintDoc;
  tool: Tool;
  brush: BrushDef;
  size: number;
  opacity: number;
  smoothing: number;
  color: string;
  symmetry: Symmetry;
  radial: number;
  penOnly: boolean;
  fillTolerance: number;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  onCommit: (layerId: string, canvas: HTMLCanvasElement) => void;
  onPick: (hex: string) => void;
  onToast: (msg: string) => void;
}

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (k: number) => void;
  rotateBy: (deg: number) => void;
  resetRotation: () => void;
}

type Gesture =
  | { kind: "stroke"; stroke: PaintStroke; stab: Stabilizer; layer: PaintLayer; base: HTMLCanvasElement; work: HTMLCanvasElement }
  | { kind: "pan"; sx: number; sy: number; v: View }
  | { kind: "move"; sx: number; sy: number; layer: PaintLayer; base: HTMLCanvasElement; mode: "move" | "scale" | "rotate"; dx: number; dy: number; k: number; a: number }
  | { kind: "pinch"; ids: number[]; start: Map<number, { x: number; y: number }>; v: View };

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(p, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 700 });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const P = useRef(p);
  P.current = p;
  const composite = useRef<HTMLCanvasElement | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const override = useRef<{ id: string; canvas: HTMLCanvasElement } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const cursor = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const dirty = useRef(true);
  const frame = useRef(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ------------------------------------------------------------------------
  // Coordenadas (con giro)
  // ------------------------------------------------------------------------

  const toDoc = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = P.current.view;
    const a = (-v.rot * Math.PI) / 180;
    const sx = cx - r.left - v.x;
    const sy = cy - r.top - v.y;
    return { x: (sx * Math.cos(a) - sy * Math.sin(a)) / v.zoom, y: (sx * Math.sin(a) + sy * Math.cos(a)) / v.zoom };
  };

  const fit = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;
    const d = P.current.doc;
    const zoom = Math.max(0.02, Math.min((el.clientWidth - 60) / d.width, (el.clientHeight - 60) / d.height, 1.5));
    P.current.setView({ zoom, rot: 0, x: (el.clientWidth - d.width * zoom) / 2, y: (el.clientHeight - d.height * zoom) / 2 });
  }, []);

  /** Gira o amplía alrededor de un punto de la pantalla. */
  const transformAround = (v: View, cx: number, cy: number, k: number, dRot: number): View => {
    const zoom = Math.min(40, Math.max(0.02, v.zoom * k));
    const kk = zoom / v.zoom;
    const a = (dRot * Math.PI) / 180;
    const dx = v.x - cx;
    const dy = v.y - cy;
    return { zoom, rot: v.rot + dRot, x: cx + (dx * Math.cos(a) - dy * Math.sin(a)) * kk, y: cy + (dx * Math.sin(a) + dy * Math.cos(a)) * kk };
  };

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (k: number) => p.setView((v) => transformAround(v, size.w / 2, size.h / 2, k, 0)),
    rotateBy: (deg: number) => p.setView((v) => transformAround(v, size.w / 2, size.h / 2, 1, deg)),
    resetRotation: () => p.setView((v) => transformAround(v, size.w / 2, size.h / 2, 1, -v.rot)),
  }));

  // ------------------------------------------------------------------------
  // Dibujo
  // ------------------------------------------------------------------------

  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const pp = P.current;
    const s = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(s.w * dpr) || c.height !== Math.round(s.h * dpr)) {
      c.width = Math.round(s.w * dpr);
      c.height = Math.round(s.h * dpr);
    }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#2b2b30";
    g.fillRect(0, 0, s.w, s.h);
    const v = pp.view;
    g.save();
    g.translate(v.x, v.y);
    g.rotate((v.rot * Math.PI) / 180);
    g.scale(v.zoom, v.zoom);
    g.shadowColor = "rgba(0,0,0,0.45)";
    g.shadowBlur = 24 / v.zoom;
    g.fillStyle = pp.doc.paperColor;
    g.fillRect(0, 0, pp.doc.width, pp.doc.height);
    g.shadowColor = "transparent";
    if (composite.current) {
      g.imageSmoothingEnabled = v.zoom < 2;
      g.imageSmoothingQuality = "high";
      g.drawImage(composite.current, 0, 0);
    }
    // Guías de simetría
    if (pp.symmetry !== "none") {
      g.strokeStyle = "rgba(230,73,128,0.6)";
      g.lineWidth = 1 / v.zoom;
      g.setLineDash([6 / v.zoom, 6 / v.zoom]);
      g.beginPath();
      const W = pp.doc.width;
      const H = pp.doc.height;
      if (pp.symmetry === "vertical" || pp.symmetry === "quad") {
        g.moveTo(W / 2, 0);
        g.lineTo(W / 2, H);
      }
      if (pp.symmetry === "horizontal" || pp.symmetry === "quad") {
        g.moveTo(0, H / 2);
        g.lineTo(W, H / 2);
      }
      if (pp.symmetry === "radial") {
        const n = Math.max(2, pp.radial);
        const R = Math.hypot(W, H);
        for (let k = 0; k < n; k++) {
          const t = (k / n) * Math.PI * 2 - Math.PI / 2;
          g.moveTo(W / 2, H / 2);
          g.lineTo(W / 2 + Math.cos(t) * R, H / 2 + Math.sin(t) * R);
        }
      }
      g.stroke();
      g.setLineDash([]);
    }
    // Cursor del pincel
    if (cursor.current.inside && (pp.tool === "brush" || pp.tool === "smudge" || pp.tool === "eraser")) {
      const r = Math.max(1, pp.size / 2);
      g.lineWidth = 1 / v.zoom;
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.beginPath();
      g.arc(cursor.current.x, cursor.current.y, r + 0.5 / v.zoom, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.beginPath();
      g.arc(cursor.current.x, cursor.current.y, Math.max(0.5, r - 0.5 / v.zoom), 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const requestDraw = useCallback((recomp = false) => {
    if (recomp) dirty.current = true;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (dirty.current) {
        composite.current = compose(P.current.doc, { override: override.current || undefined, scratch: scratch.current || undefined, paper: true });
        scratch.current = composite.current;
        dirty.current = false;
      }
      drawRef.current();
    });
  }, []);

  useEffect(() => subscribe(() => requestDraw(true)), [requestDraw]);
  useEffect(() => requestDraw(true), [p.doc, requestDraw]);
  useEffect(() => requestDraw(), [p.view, size, p.symmetry, p.radial, p.size, p.tool, requestDraw]);

  // ------------------------------------------------------------------------
  // Puntero
  // ------------------------------------------------------------------------

  const activeLayer = () => P.current.doc.layers.find((l) => l.id === P.current.doc.activeId);

  const startStroke = (x: number, y: number, pressure: number) => {
    const pp = P.current;
    const layer = activeLayer();
    if (!layer) return;
    if (layer.locked) return pp.onToast("La capa está bloqueada");
    if (!layer.visible) return pp.onToast("La capa está oculta");
    const src = getCanvas(layer.data);
    const base = newCanvas(pp.doc.width, pp.doc.height);
    if (src) ctx2d(base).drawImage(src, 0, 0);
    const work = newCanvas(pp.doc.width, pp.doc.height);
    ctx2d(work).drawImage(base, 0, 0);
    const brush = pp.tool === "eraser" ? ERASER : pp.tool === "smudge" ? SMUDGE : pp.brush;
    const stroke = new PaintStroke({ width: pp.doc.width, height: pp.doc.height, brush, size: pp.size, opacity: pp.opacity, color: pp.color, symmetry: pp.symmetry, radial: pp.radial, layer: work });
    const stab = new Stabilizer(pp.smoothing);
    gesture.current = { kind: "stroke", stroke, stab, layer, base, work };
    stroke.add(stab.next({ x, y, pressure }));
    preview();
  };

  const preview = () => {
    const ge = gesture.current;
    if (ge?.kind !== "stroke") return;
    override.current = { id: ge.layer.id, canvas: ge.stroke.result(ge.base, ge.layer.alphaLock, false) };
    requestDraw(true);
  };

  const pressureOf = (e: PointerEvent | React.PointerEvent) => (e.pointerType === "pen" ? Math.max(0.05, e.pressure || 0.5) : 1);

  const onDown = (e: React.PointerEvent) => {
    const pp = P.current;
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    // Dos dedos: zoom, giro y desplazamiento
    const touches = [...pointers.current.entries()].filter(([, q]) => q.type === "touch");
    if (touches.length === 2) {
      if (gesture.current?.kind === "stroke") override.current = null;
      gesture.current = { kind: "pinch", ids: touches.map(([id]) => id), start: new Map(touches.map(([id, q]) => [id, { x: q.x, y: q.y }])), v: pp.view };
      requestDraw(true);
      return;
    }
    if (e.pointerType === "touch" && pp.penOnly && pp.tool !== "hand") {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, v: pp.view };
      return;
    }
    if (e.button === 1 || pp.tool === "hand" || spaceDown.current) {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, v: pp.view };
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const q = toDoc(e.clientX, e.clientY);
    switch (pp.tool) {
      case "eyedropper": {
        const c = composite.current;
        if (!c) return;
        const d = ctx2d(c).getImageData(Math.floor(q.x), Math.floor(q.y), 1, 1).data;
        pp.onPick(`#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
        return;
      }
      case "fill": {
        const layer = activeLayer();
        if (!layer || layer.locked) return;
        const src = composite.current;
        const base = getCanvas(layer.data);
        if (!src || !base) return;
        const mask = floodMask(src, q.x, q.y, pp.fillTolerance);
        const out = newCanvas(pp.doc.width, pp.doc.height);
        const g = ctx2d(out);
        g.drawImage(base, 0, 0);
        const paint = newCanvas(pp.doc.width, pp.doc.height);
        const pg = ctx2d(paint);
        pg.drawImage(mask, 0, 0);
        pg.globalCompositeOperation = "source-in";
        pg.fillStyle = pp.color;
        pg.fillRect(0, 0, paint.width, paint.height);
        g.globalCompositeOperation = layer.alphaLock ? "source-atop" : "source-over";
        g.drawImage(paint, 0, 0);
        pp.onCommit(layer.id, out);
        return;
      }
      case "move": {
        const layer = activeLayer();
        if (!layer || layer.locked) return;
        const base = getCanvas(layer.data);
        if (!base) return;
        gesture.current = { kind: "move", sx: e.clientX, sy: e.clientY, layer, base, mode: e.shiftKey ? "scale" : e.altKey ? "rotate" : "move", dx: 0, dy: 0, k: 1, a: 0 };
        return;
      }
      default:
        startStroke(q.x, q.y, pressureOf(e));
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const pp = P.current;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const q = toDoc(e.clientX, e.clientY);
    cursor.current = { ...q, inside: true };
    const ge = gesture.current;
    if (!ge) {
      requestDraw();
      return;
    }
    switch (ge.kind) {
      case "stroke": {
        const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [e.nativeEvent];
        for (const ev of events) {
          const d = toDoc(ev.clientX, ev.clientY);
          ge.stroke.add(ge.stab.next({ ...d, pressure: pressureOf(ev) }));
        }
        preview();
        return;
      }
      case "pan":
        pp.setView({ ...ge.v, x: ge.v.x + e.clientX - ge.sx, y: ge.v.y + e.clientY - ge.sy });
        return;
      case "pinch": {
        const [a, b] = ge.ids.map((id) => pointers.current.get(id)!);
        const [a0, b0] = ge.ids.map((id) => ge.start.get(id)!);
        if (!a || !b) return;
        const r = canvasRef.current!.getBoundingClientRect();
        const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
        const d1 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ang = ((Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x)) * 180) / Math.PI;
        const c0 = { x: (a0.x + b0.x) / 2 - r.left, y: (a0.y + b0.y) / 2 - r.top };
        const c1 = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
        const v = transformAround(ge.v, c0.x, c0.y, d1 / d0, ang);
        pp.setView({ ...v, x: v.x + c1.x - c0.x, y: v.y + c1.y - c0.y });
        return;
      }
      case "move": {
        const dx = (e.clientX - ge.sx) / pp.view.zoom;
        const dy = (e.clientY - ge.sy) / pp.view.zoom;
        const a = (-pp.view.rot * Math.PI) / 180;
        ge.dx = dx * Math.cos(a) - dy * Math.sin(a);
        ge.dy = dx * Math.sin(a) + dy * Math.cos(a);
        if (ge.mode === "scale") ge.k = Math.max(0.05, 1 + (e.clientX - ge.sx) / 300);
        if (ge.mode === "rotate") ge.a = (e.clientX - ge.sx) / 2;
        override.current = { id: ge.layer.id, canvas: movedLayer(ge, pp.doc.width, pp.doc.height) };
        requestDraw(true);
        return;
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const ge = gesture.current;
    if (ge?.kind === "pinch") {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (!ge) return;
    if (ge.kind === "stroke") {
      const out = ge.stroke.result(ge.base, ge.layer.alphaLock, true);
      override.current = null;
      P.current.onCommit(ge.layer.id, out);
    } else if (ge.kind === "move") {
      const out = movedLayer(ge, P.current.doc.width, P.current.doc.height);
      override.current = null;
      if (ge.dx || ge.dy || ge.k !== 1 || ge.a) P.current.onCommit(ge.layer.id, out);
      requestDraw(true);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    if (e.altKey) p.setView((v) => transformAround(v, e.clientX - r.left, e.clientY - r.top, 1, e.deltaY > 0 ? 5 : -5));
    else p.setView((v) => transformAround(v, e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12, 0));
  };

  const spaceDown = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.code === "Space") spaceDown.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const cursorStyle = p.tool === "hand" ? "grab" : p.tool === "move" ? "move" : p.tool === "eyedropper" ? "copy" : p.tool === "fill" ? "cell" : "none";

  return (
    <div ref={hostRef} className="relative flex-1 min-w-0 overflow-hidden" data-paint-canvas>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor: cursorStyle, touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => {
          cursor.current.inside = false;
          requestDraw();
        }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
});

function movedLayer(ge: { base: HTMLCanvasElement; dx: number; dy: number; k: number; a: number }, w: number, h: number): HTMLCanvasElement {
  const c = newCanvas(w, h);
  const g = ctx2d(c);
  g.imageSmoothingQuality = "high";
  g.translate(w / 2 + ge.dx, h / 2 + ge.dy);
  g.rotate((ge.a * Math.PI) / 180);
  g.scale(ge.k, ge.k);
  g.drawImage(ge.base, -w / 2, -h / 2);
  return c;
}
