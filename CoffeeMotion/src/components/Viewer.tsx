// Visor de la composición: muestra el fotograma, permite seleccionar capas,
// moverlas, escalarlas y girarlas, y dibujar formas, trazados, textos y máscaras.

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Comp, Layer, PathPoint, Vec } from "../types";
import { layerBounds, layerMatrix, renderComp, releaseCanvas, seekMedia, isActive, val, type RenderEnv } from "../services/render";

export type Tool = "select" | "hand" | "rect" | "ellipse" | "star" | "polygon" | "pen" | "text" | "maskRect" | "maskEllipse";

interface Props {
  env: RenderEnv;
  comp: Comp;
  time: number;
  selected: string[];
  setSelected: (ids: string[]) => void;
  tool: Tool;
  quality: number;
  showGuides: boolean;
  /** Modifica una capa (key = agrupa el historial durante un arrastre). */
  onTransform: (layerId: string, patch: { position?: Vec; scale?: Vec; rotation?: number; anchor?: Vec }, key: string) => void;
  onCreateShape: (kind: "rect" | "ellipse" | "star" | "polygon", center: Vec, size: Vec) => void;
  onCreatePath: (points: PathPoint[], closed: boolean) => void;
  onCreateText: (at: Vec) => void;
  onCreateMask: (layerId: string, kind: "rect" | "ellipse", rect: [number, number, number, number]) => void;
  version: number;
  playing: boolean;
}

type Drag =
  | { kind: "move"; id: string; start: Vec; orig: Vec; parentInv: DOMMatrix }
  | { kind: "scale"; id: string; orig: Vec; center: Vec; startDist: number; uniform: boolean }
  | { kind: "rotate"; id: string; orig: number; center: Vec; startAngle: number }
  | { kind: "pan"; start: Vec; orig: Vec }
  | { kind: "draw"; start: Vec; now: Vec }
  | { kind: "marquee"; start: Vec; now: Vec };

export const Viewer: React.FC<Props> = (p) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<{ zoom: number; x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const [pen, setPen] = useState<PathPoint[]>([]);
  const frameReq = useRef(0);
  const busy = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const zoom = Math.min((size.w - 40) / p.comp.width, (size.h - 40) / p.comp.height);
    setView({ zoom, x: (size.w - p.comp.width * zoom) / 2, y: (size.h - p.comp.height * zoom) / 2 });
  }, [size, p.comp.width, p.comp.height]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, p.comp.id, p.comp.width, p.comp.height]);

  const v = view || { zoom: 0.4, x: 0, y: 0 };
  const toComp = (cx: number, cy: number): Vec => [(cx - v.x) / v.zoom, (cy - v.y) / v.zoom];

  // Render del fotograma
  const draw = useCallback(async () => {
    if (busy.current) {
      pending.current = true;
      return;
    }
    busy.current = true;
    try {
      const k = Math.min(1, v.zoom * (window.devicePixelRatio || 1)) * p.quality;
      if (!p.playing) await seekMedia(p.env, p.comp, p.time);
      const frame = renderComp({ ...p.env, scale: k, draft: p.playing }, p.comp, p.time, k);
      const c = canvasRef.current;
      if (c) {
        const dpr = window.devicePixelRatio || 1;
        c.width = Math.round(size.w * dpr);
        c.height = Math.round(size.h * dpr);
        const g = c.getContext("2d")!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = "#1b1b1f";
        g.fillRect(0, 0, size.w, size.h);
        // Damero bajo el fondo transparente
        const W = p.comp.width * v.zoom;
        const H = p.comp.height * v.zoom;
        g.save();
        g.beginPath();
        g.rect(v.x, v.y, W, H);
        g.clip();
        const cell = 12;
        for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
          g.fillStyle = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? "#2a2a30" : "#34343a";
          g.fillRect(v.x + x, v.y + y, cell, cell);
        }
        g.restore();
        g.imageSmoothingQuality = "high";
        g.drawImage(frame, v.x, v.y, W, H);
      }
      releaseCanvas(frame);
    } finally {
      busy.current = false;
      if (pending.current) {
        pending.current = false;
        frameReq.current = requestAnimationFrame(() => void draw());
      }
    }
  }, [p.env, p.comp, p.time, p.quality, p.playing, size, v.zoom, v.x, v.y]);

  useEffect(() => {
    cancelAnimationFrame(frameReq.current);
    frameReq.current = requestAnimationFrame(() => void draw());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, p.version]);

  // Superposición: cajas de selección, asas, guías y trazado en curso
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);
    const screen = new DOMMatrix().translate(v.x, v.y).scale(v.zoom, v.zoom);
    if (p.showGuides) {
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.setLineDash([4, 4]);
      const W = p.comp.width * v.zoom;
      const H = p.comp.height * v.zoom;
      // Zonas seguras (90 % y 80 %) y tercios
      for (const k of [0.9, 0.8]) g.strokeRect(v.x + (W * (1 - k)) / 2, v.y + (H * (1 - k)) / 2, W * k, H * k);
      for (const k of [1 / 3, 2 / 3]) {
        g.beginPath();
        g.moveTo(v.x + W * k, v.y);
        g.lineTo(v.x + W * k, v.y + H);
        g.moveTo(v.x, v.y + H * k);
        g.lineTo(v.x + W, v.y + H * k);
        g.stroke();
      }
      g.setLineDash([]);
    }
    for (const id of p.selected) {
      const l = p.comp.layers.find((x) => x.id === id);
      if (!l || !isActive(l, p.time)) continue;
      const b = layerBounds(p.env, p.comp, l, p.time);
      if (!b) continue;
      const m = screen.multiply(layerMatrix(p.comp, l, p.time));
      const pts = [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x + b.w, b.y + b.h],
        [b.x, b.y + b.h],
      ].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      g.strokeStyle = l.label;
      g.lineWidth = 1.5;
      g.beginPath();
      pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.closePath();
      g.stroke();
      if (p.selected.length === 1 && p.tool === "select") {
        g.fillStyle = "#fff";
        for (const q of pts) g.fillRect(q.x - 4, q.y - 4, 8, 8);
        // Asa de giro
        const top = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) - Math.PI / 2;
        const rx = top.x + Math.cos(ang) * 26;
        const ry = top.y + Math.sin(ang) * 26;
        g.beginPath();
        g.moveTo(top.x, top.y);
        g.lineTo(rx, ry);
        g.stroke();
        g.beginPath();
        g.arc(rx, ry, 5, 0, Math.PI * 2);
        g.fill();
      }
      // Punto de anclaje
      const anchor = val(p.comp, l, "anchor", l.transform.anchor, p.time);
      const a = m.transformPoint(new DOMPoint(anchor[0], anchor[1]));
      g.strokeStyle = "#fff";
      g.beginPath();
      g.arc(a.x, a.y, 5, 0, Math.PI * 2);
      g.moveTo(a.x - 8, a.y);
      g.lineTo(a.x + 8, a.y);
      g.moveTo(a.x, a.y - 8);
      g.lineTo(a.x, a.y + 8);
      g.stroke();
    }
    const d = drag.current;
    if (d && (d.kind === "draw" || d.kind === "marquee")) {
      const a = screen.transformPoint(new DOMPoint(...d.start));
      const b = screen.transformPoint(new DOMPoint(...d.now));
      g.strokeStyle = d.kind === "marquee" ? "rgba(255,255,255,0.6)" : "#ffa94d";
      g.setLineDash(d.kind === "marquee" ? [4, 3] : []);
      if (p.tool === "ellipse" || p.tool === "maskEllipse") {
        g.beginPath();
        g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
        g.stroke();
      } else g.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      g.setLineDash([]);
    }
    if (pen.length) {
      g.strokeStyle = "#ffa94d";
      g.lineWidth = 2;
      g.beginPath();
      pen.forEach((q, i) => {
        const s = screen.transformPoint(new DOMPoint(q.x, q.y));
        if (!i) g.moveTo(s.x, s.y);
        else {
          const prev = pen[i - 1];
          const c1 = screen.transformPoint(new DOMPoint(prev.x + prev.ox, prev.y + prev.oy));
          const c2 = screen.transformPoint(new DOMPoint(q.x + q.ix, q.y + q.iy));
          g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, s.x, s.y);
        }
      });
      g.stroke();
      g.fillStyle = "#fff";
      for (const q of pen) {
        const s = screen.transformPoint(new DOMPoint(q.x, q.y));
        g.fillRect(s.x - 3, s.y - 3, 6, 6);
      }
    }
  });

  // ------------------------------------------------------------------------
  // Ratón
  // ------------------------------------------------------------------------

  const hitLayer = (pt: Vec): Layer | null => {
    for (const l of p.comp.layers) {
      if (!l.visible || l.locked || !isActive(l, p.time) || l.type === "audio") continue;
      const b = layerBounds(p.env, p.comp, l, p.time);
      if (!b) continue;
      if (l.type === "solid" || l.type === "adjustment") continue;
      const inv = layerMatrix(p.comp, l, p.time).inverse();
      const q = inv.transformPoint(new DOMPoint(pt[0], pt[1]));
      if (q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h) return l;
    }
    // Sólidos al final (suelen ser fondos)
    for (const l of p.comp.layers) {
      if (!l.visible || l.locked || !isActive(l, p.time) || (l.type !== "solid" && l.type !== "adjustment")) continue;
      const inv = layerMatrix(p.comp, l, p.time).inverse();
      const q = inv.transformPoint(new DOMPoint(pt[0], pt[1]));
      if (q.x >= 0 && q.x <= p.comp.width && q.y >= 0 && q.y <= p.comp.height) return l;
    }
    return null;
  };

  const handleAt = (sx: number, sy: number): "scale" | "rotate" | null => {
    if (p.selected.length !== 1) return null;
    const l = p.comp.layers.find((x) => x.id === p.selected[0]);
    if (!l) return null;
    const b = layerBounds(p.env, p.comp, l, p.time);
    if (!b) return null;
    const screen = new DOMMatrix().translate(v.x, v.y).scale(v.zoom, v.zoom).multiply(layerMatrix(p.comp, l, p.time));
    const pts = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x + b.w, b.y + b.h],
      [b.x, b.y + b.h],
    ].map(([x, y]) => screen.transformPoint(new DOMPoint(x, y)));
    const top = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) - Math.PI / 2;
    if (Math.hypot(sx - (top.x + Math.cos(ang) * 26), sy - (top.y + Math.sin(ang) * 26)) < 9) return "rotate";
    if (pts.some((q) => Math.hypot(sx - q.x, sy - q.y) < 8)) return "scale";
    return null;
  };

  const anchorScreen = (l: Layer): Vec => {
    const anchor = val(p.comp, l, "anchor", l.transform.anchor, p.time);
    const q = layerMatrix(p.comp, l, p.time).transformPoint(new DOMPoint(anchor[0], anchor[1]));
    return [q.x, q.y];
  };

  const onDown = (e: React.PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const pt = toComp(sx, sy);
    (e.target as Element).setPointerCapture(e.pointerId);
    if (p.tool === "hand" || e.button === 1 || e.altKey) {
      drag.current = { kind: "pan", start: [sx, sy], orig: [v.x, v.y] };
      return;
    }
    if (["rect", "ellipse", "star", "polygon", "maskRect", "maskEllipse"].includes(p.tool)) {
      drag.current = { kind: "draw", start: pt, now: pt };
      return;
    }
    if (p.tool === "text") {
      p.onCreateText(pt);
      return;
    }
    if (p.tool === "pen") {
      if (pen.length > 2 && Math.hypot(pen[0].x - pt[0], pen[0].y - pt[1]) * v.zoom < 10) {
        p.onCreatePath(pen, true);
        setPen([]);
        return;
      }
      setPen([...pen, { x: pt[0], y: pt[1], ix: 0, iy: 0, ox: 0, oy: 0 }]);
      drag.current = { kind: "draw", start: pt, now: pt };
      return;
    }
    // Selección
    const h = handleAt(sx, sy);
    if (h) {
      const l = p.comp.layers.find((x) => x.id === p.selected[0])!;
      const center = anchorScreen(l);
      if (h === "scale") drag.current = { kind: "scale", id: l.id, orig: val(p.comp, l, "scale", l.transform.scale, p.time), center, startDist: Math.hypot(pt[0] - center[0], pt[1] - center[1]) || 1, uniform: !e.shiftKey };
      else drag.current = { kind: "rotate", id: l.id, orig: val(p.comp, l, "rotation", l.transform.rotation, p.time), center, startAngle: Math.atan2(pt[1] - center[1], pt[0] - center[0]) };
      return;
    }
    const hit = hitLayer(pt);
    if (hit) {
      const ids = e.shiftKey ? (p.selected.includes(hit.id) ? p.selected.filter((x) => x !== hit.id) : [...p.selected, hit.id]) : p.selected.includes(hit.id) ? p.selected : [hit.id];
      p.setSelected(ids);
      const parent = hit.parent ? p.comp.layers.find((x) => x.id === hit.parent) : null;
      const parentInv = parent ? layerMatrix(p.comp, parent, p.time).inverse() : new DOMMatrix();
      drag.current = { kind: "move", id: hit.id, start: pt, orig: val(p.comp, hit, "position", hit.transform.position, p.time), parentInv };
    } else {
      p.setSelected([]);
      drag.current = { kind: "marquee", start: pt, now: pt };
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = overlayRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const pt = toComp(sx, sy);
    if (d.kind === "pan") {
      setView({ ...v, x: d.orig[0] + sx - d.start[0], y: d.orig[1] + sy - d.start[1] });
    } else if (d.kind === "move") {
      let dx = pt[0] - d.start[0];
      let dy = pt[1] - d.start[1];
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      // El desplazamiento se expresa en el espacio del padre
      const a = d.parentInv.transformPoint(new DOMPoint(d.start[0], d.start[1]));
      const b = d.parentInv.transformPoint(new DOMPoint(d.start[0] + dx, d.start[1] + dy));
      p.onTransform(d.id, { position: [d.orig[0] + (b.x - a.x), d.orig[1] + (b.y - a.y)] }, `move-${d.id}`);
    } else if (d.kind === "scale") {
      const dist = Math.hypot(pt[0] - d.center[0], pt[1] - d.center[1]);
      const k = dist / d.startDist;
      p.onTransform(d.id, { scale: [Math.round(d.orig[0] * k * 10) / 10, Math.round(d.orig[1] * k * 10) / 10] }, `scale-${d.id}`);
    } else if (d.kind === "rotate") {
      const a = Math.atan2(pt[1] - d.center[1], pt[0] - d.center[0]);
      let deg = d.orig + ((a - d.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      p.onTransform(d.id, { rotation: Math.round(deg * 10) / 10 }, `rot-${d.id}`);
    } else if (d.kind === "draw") {
      d.now = pt;
      if (p.tool === "pen" && pen.length) {
        // Arrastrar al crear un punto = manejadores de curva
        const last = pen[pen.length - 1];
        const ox = pt[0] - last.x;
        const oy = pt[1] - last.y;
        setPen([...pen.slice(0, -1), { ...last, ox, oy, ix: -ox, iy: -oy }]);
      } else setPen((x) => x);
    } else if (d.kind === "marquee") {
      d.now = pt;
      setPen((x) => x.slice());
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "draw" && p.tool !== "pen") {
      let [x0, y0] = d.start;
      let [x1, y1] = d.now;
      if (e.shiftKey) {
        const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        x1 = x0 + Math.sign(x1 - x0 || 1) * s;
        y1 = y0 + Math.sign(y1 - y0 || 1) * s;
      }
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (p.tool === "maskRect" || p.tool === "maskEllipse") {
        const l = p.comp.layers.find((x) => x.id === p.selected[0]);
        if (!l || w < 3 || h < 3) return;
        // A coordenadas de la capa
        const inv = layerMatrix(p.comp, l, p.time).inverse();
        const a = inv.transformPoint(new DOMPoint(Math.min(x0, x1), Math.min(y0, y1)));
        const b = inv.transformPoint(new DOMPoint(Math.max(x0, x1), Math.max(y0, y1)));
        p.onCreateMask(l.id, p.tool === "maskRect" ? "rect" : "ellipse", [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)]);
        return;
      }
      const kind = p.tool as "rect" | "ellipse" | "star" | "polygon";
      if (w < 4 || h < 4) p.onCreateShape(kind, d.start, [300, 300]);
      else p.onCreateShape(kind, [(x0 + x1) / 2, (y0 + y1) / 2], [w, h]);
    } else if (d.kind === "marquee") {
      const [x0, y0] = d.start;
      const [x1, y1] = d.now;
      if (Math.abs(x1 - x0) < 3 && Math.abs(y1 - y0) < 3) return;
      const ids = p.comp.layers
        .filter((l) => {
          if (!l.visible || l.locked || !isActive(l, p.time) || l.type === "solid") return false;
          const pos = val(p.comp, l, "position", l.transform.position, p.time);
          return pos[0] >= Math.min(x0, x1) && pos[0] <= Math.max(x0, x1) && pos[1] >= Math.min(y0, y1) && pos[1] <= Math.max(y0, y1);
        })
        .map((l) => l.id);
      p.setSelected(ids);
    }
  };

  // Terminar el trazado con Intro (abierto) o Esc (cancelar)
  const createPath = useRef(p.onCreatePath);
  createPath.current = p.onCreatePath;
  useEffect(() => {
    if (p.tool !== "pen") setPen((x) => (x.length ? [] : x));
  }, [p.tool]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (p.tool !== "pen" || !pen.length) return;
      if (e.key === "Enter") {
        if (pen.length > 1) createPath.current(pen, false);
        setPen([]);
      } else if (e.key === "Escape") setPen([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.tool, pen]);

  const onWheel = (e: React.WheelEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const zoom = Math.max(0.05, Math.min(8, v.zoom * k));
    setView({ zoom, x: sx - ((sx - v.x) / v.zoom) * zoom, y: sy - ((sy - v.y) / v.zoom) * zoom });
  };

  const cursor = p.tool === "hand" ? "grab" : p.tool === "text" ? "text" : p.tool === "select" ? "default" : "crosshair";

  return (
    <div ref={hostRef} className="flex-1 min-h-0 relative overflow-hidden bg-[#1b1b1f]" data-viewer>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: size.w, height: size.h }} />
      <canvas ref={overlayRef} className="absolute inset-0" style={{ width: size.w, height: size.h, cursor }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel} onDoubleClick={() => p.tool === "hand" && fit()} data-overlay />
      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] text-[#c9c9cf] bg-black/50 rounded px-2 py-0.5">
        <button type="button" onClick={fit} className="hover:text-white" title="Ajustar a la ventana">
          {Math.round(v.zoom * 100)} %
        </button>
      </div>
    </div>
  );
};
