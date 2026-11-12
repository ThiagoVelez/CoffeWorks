// Lienzo de CoffeePhoto: muestra el documento con zoom y desplazamiento y
// aplica las herramientas (pinceles, selecciones, recorte, degradado, texto,
// mover y transformación libre).

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Layer, PhotoDoc, TextLayer, Tool, ToolOptions } from "../types";
import { compose, textBounds } from "../services/model";
import { ctx2d, getCanvas, newCanvas, subscribe } from "../services/pixels";
import { Stroke, applyStroke, gradientFill, shiftedSource, toneSource } from "../services/brush";
import { antsCanvases, combine, polygonMask, rectMask, wandMask, makeSelection, type Selection, featherMask } from "../services/selection";
import { applyFilter } from "../services/adjust";
import { contentAwareFill } from "../services/inpaint";
import { rgba } from "../studio/color";

export interface View {
  x: number;
  y: number;
  zoom: number;
}

export interface TransformState {
  layerId: string;
  /** Contenido que se transforma (la capa o la parte seleccionada). */
  source: HTMLCanvasElement;
  /** Lo que queda de la capa si se transforma solo la selección. */
  rest: HTMLCanvasElement | null;
  box: { x: number; y: number; w: number; h: number };
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  angle: number;
}

export interface CanvasActions {
  /** Sustituye los píxeles de una capa (o su máscara). */
  commitPixels: (layerId: string, canvas: HTMLCanvasElement, target: "pixels" | "mask", label: string) => void;
  /** Crea una capa nueva con estos píxeles. */
  addPixelLayer: (canvas: HTMLCanvasElement, name: string) => void;
  updateLayer: (id: string, patch: Partial<Layer>, key?: string) => void;
  setSelection: (sel: Selection | null) => void;
  pickColor: (hex: string, background: boolean) => void;
  applyCrop: (rect: { x: number; y: number; w: number; h: number }) => void;
  addText: (x: number, y: number) => void;
  editText: (id: string) => void;
  toast: (msg: string) => void;
  setTransform: (t: TransformState | null) => void;
  busy: (msg: string | null) => void;
}

interface Props {
  doc: PhotoDoc;
  selection: Selection | null;
  tool: Tool;
  opts: ToolOptions;
  fg: string;
  bg: string;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  actions: CanvasActions;
  /** Se pinta en la máscara de la capa activa. */
  editMask: boolean;
  transform: TransformState | null;
  /** Capa de texto que se está editando (no se dibuja: la muestra el editor). */
  editingText: string | null;
  showGrid: boolean;
  /** Vista previa de un ajuste o filtro sobre una capa. */
  previewOverride?: { id: string; canvas: HTMLCanvasElement } | null;
}

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (k: number) => void;
  actual: () => void;
  composite: () => HTMLCanvasElement;
  applyTransform: () => void;
  cancelCrop: () => void;
  applyCropNow: () => void;
  screenOf: (x: number, y: number) => { x: number; y: number };
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "stroke"; stroke: Stroke; layerId: string; base: HTMLCanvasElement; mode: "paint" | "erase" | "reveal" | "heal"; source?: HTMLCanvasElement; target: "pixels" | "mask"; color: string; opacity: number }
  | { kind: "rect"; x0: number; y0: number; x1: number; y1: number; ellipse: boolean; mode: ToolOptions["selectMode"] }
  | { kind: "lasso"; pts: Array<{ x: number; y: number }>; mode: ToolOptions["selectMode"] }
  | { kind: "move"; x0: number; y0: number; dx: number; dy: number; layer: Layer; base: HTMLCanvasElement | null; lifted: HTMLCanvasElement | null; rest: HTMLCanvasElement | null }
  | { kind: "gradient"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "shape"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "crop"; handle: string; start: { x: number; y: number }; orig: { x: number; y: number; w: number; h: number } }
  | { kind: "transform"; handle: string; start: { x: number; y: number }; orig: TransformState };

const SELECT_TOOLS = new Set<Tool>(["marquee", "ellipseSelect", "lasso", "polyLasso", "wand"]);
const BRUSH_TOOLS = new Set<Tool>(["brush", "pencil", "eraser", "clone", "heal", "dodge", "burn", "blurTool"]);

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(props, ref) {
  const { doc, selection, tool, opts, view, setView, actions, editMask, transform, editingText, showGrid } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const composite = useRef<HTMLCanvasElement | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const override = useRef<{ id: string; canvas: HTMLCanvasElement } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const overlay = useRef<{ kind: string; [k: string]: unknown } | null>(null);
  const [poly, setPoly] = useState<Array<{ x: number; y: number }> | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cloneSource = useRef<{ x: number; y: number } | null>(null);
  const cloneOffset = useRef<{ dx: number; dy: number } | null>(null);
  const pointer = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const spaceDown = useRef(false);
  const ants = useRef<{ sel: Selection | null; frames: [HTMLCanvasElement, HTMLCanvasElement] | null; phase: number }>({ sel: null, frames: null, phase: 0 });
  const dirty = useRef(true);
  const frame = useRef(0);
  const props_ = useRef(props);
  props_.current = props;

  // ------------------------------------------------------------------------
  // Tamaño y vista
  // ------------------------------------------------------------------------

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;
    const z = Math.min((el.clientWidth - 80) / doc.width, (el.clientHeight - 80) / doc.height, 1);
    const zoom = Math.max(0.02, z);
    setView({ zoom, x: (el.clientWidth - doc.width * zoom) / 2, y: (el.clientHeight - doc.height * zoom) / 2 });
  }, [doc.width, doc.height, setView]);

  const zoomAt = useCallback(
    (k: number, cx: number, cy: number) =>
      setView((v) => {
        const zoom = Math.min(32, Math.max(0.02, v.zoom * k));
        const f = zoom / v.zoom;
        return { zoom, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
      }),
    [setView]
  );

  const toDoc = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = props_.current.view;
    return { x: (e.clientX - r.left - v.x) / v.zoom, y: (e.clientY - r.top - v.y) / v.zoom };
  };

  // ------------------------------------------------------------------------
  // Composición y dibujo
  // ------------------------------------------------------------------------

  const recompose = useCallback(() => {
    const p = props_.current;
    const hide = new Set<string>();
    if (p.editingText) hide.add(p.editingText);
    let ov = override.current || p.previewOverride || null;
    if (p.transform) {
      const t = p.transform;
      const c = newCanvas(p.doc.width, p.doc.height);
      const g = ctx2d(c);
      if (t.rest) g.drawImage(t.rest, 0, 0);
      drawTransformed(g, t);
      ov = { id: t.layerId, canvas: c };
    }
    const layer = p.doc.layers.find((l) => l.id === ov?.id);
    // La máscara en edición se previsualiza aplicándola a la capa
    if (ov && layer && p.editMask && gesture.current?.kind === "stroke" && gesture.current.target === "mask") {
      const masked = layer.kind === "raster" ? getCanvas(layer.data) : null;
      if (masked) {
        const c = newCanvas(p.doc.width, p.doc.height);
        const g = ctx2d(c);
        g.drawImage(masked, 0, 0);
        const alpha = newCanvas(p.doc.width, p.doc.height);
        const ag = ctx2d(alpha);
        const img = ctx2d(ov.canvas).getImageData(0, 0, p.doc.width, p.doc.height);
        for (let i = 0; i < img.data.length; i += 4) {
          img.data[i + 3] = img.data[i];
        }
        ag.putImageData(img, 0, 0);
        g.globalCompositeOperation = "destination-in";
        g.drawImage(alpha, 0, 0);
        composite.current = compose({ ...p.doc, layers: p.doc.layers.map((l) => (l.id === layer.id ? { ...l, mask: null } : l)) }, { override: { id: layer.id, canvas: c }, hide, scratch: scratch.current || undefined });
        scratch.current = composite.current;
        return;
      }
    }
    composite.current = compose(p.doc, { override: ov || undefined, hide, scratch: scratch.current || undefined });
    scratch.current = composite.current;
  }, []);

  const requestDraw = useCallback((recomp = false) => {
    if (recomp) dirty.current = true;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (dirty.current) {
        recompose();
        dirty.current = false;
      }
      drawRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => subscribe(() => requestDraw(true)), [requestDraw]);
  useEffect(() => requestDraw(true), [doc, transform, editingText, editMask, props.previewOverride, requestDraw]);
  useEffect(() => requestDraw(), [view, size, crop, poly, tool, showGrid, opts, requestDraw]);

  // Hormigas de la selección
  useEffect(() => {
    ants.current.sel = selection;
    ants.current.frames = selection ? antsCanvases(selection.mask) : null;
    requestDraw();
    if (!selection) return;
    const id = window.setInterval(() => {
      ants.current.phase ^= 1;
      requestDraw();
    }, 320);
    return () => window.clearInterval(id);
  }, [selection, requestDraw]);

  function draw() {
    const c = canvasRef.current;
    if (!c) return;
    const p = props_.current;
    const size = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
    }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#232326";
    g.fillRect(0, 0, size.w, size.h);
    const v = p.view;
    const W = p.doc.width * v.zoom;
    const H = p.doc.height * v.zoom;
    // Sombra y tablero de transparencia
    g.save();
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 18;
    g.fillStyle = "#fff";
    g.fillRect(v.x, v.y, W, H);
    g.restore();
    g.save();
    g.beginPath();
    g.rect(v.x, v.y, W, H);
    g.clip();
    const cell = 8;
    g.fillStyle = "#d4d4d8";
    for (let yy = 0; yy < H; yy += cell) for (let xx = (Math.floor(yy / cell) % 2) * cell; xx < W; xx += cell * 2) g.fillRect(v.x + xx, v.y + yy, cell, cell);
    g.restore();
    if (composite.current) {
      g.imageSmoothingEnabled = v.zoom < 2;
      g.imageSmoothingQuality = "high";
      g.drawImage(composite.current, v.x, v.y, W, H);
    }
    // Cuadrícula de píxeles al ampliar mucho y cuadrícula del documento
    if (v.zoom >= 10) {
      g.strokeStyle = "rgba(0,0,0,0.12)";
      g.lineWidth = 1;
      g.beginPath();
      const x0 = Math.max(0, Math.floor(-v.x / v.zoom));
      const x1 = Math.min(p.doc.width, Math.ceil((size.w - v.x) / v.zoom));
      const y0 = Math.max(0, Math.floor(-v.y / v.zoom));
      const y1 = Math.min(p.doc.height, Math.ceil((size.h - v.y) / v.zoom));
      for (let x = x0; x <= x1; x++) {
        g.moveTo(Math.round(v.x + x * v.zoom) + 0.5, v.y + y0 * v.zoom);
        g.lineTo(Math.round(v.x + x * v.zoom) + 0.5, v.y + y1 * v.zoom);
      }
      for (let y = y0; y <= y1; y++) {
        g.moveTo(v.x + x0 * v.zoom, Math.round(v.y + y * v.zoom) + 0.5);
        g.lineTo(v.x + x1 * v.zoom, Math.round(v.y + y * v.zoom) + 0.5);
      }
      g.stroke();
    }
    if (p.showGrid) {
      const step = Math.max(10, Math.round(Math.min(p.doc.width, p.doc.height) / 12));
      g.strokeStyle = "rgba(0,180,255,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = step; x < p.doc.width; x += step) {
        g.moveTo(v.x + x * v.zoom + 0.5, v.y);
        g.lineTo(v.x + x * v.zoom + 0.5, v.y + H);
      }
      for (let y = step; y < p.doc.height; y += step) {
        g.moveTo(v.x, v.y + y * v.zoom + 0.5);
        g.lineTo(v.x + W, v.y + y * v.zoom + 0.5);
      }
      g.stroke();
    }
    // Selección
    const fr = ants.current.frames;
    if (fr) {
      g.imageSmoothingEnabled = false;
      g.drawImage(fr[ants.current.phase], v.x, v.y, W, H);
    }
    drawOverlays(g, v);
  }

  // requestDraw se crea una sola vez: siempre llama a la versión más reciente
  const drawRef = useRef(draw);
  drawRef.current = draw;

  function drawOverlays(g: CanvasRenderingContext2D, v: View) {
    const p = props_.current;
    const size = sizeRef.current;
    const sx = (x: number) => v.x + x * v.zoom;
    const sy = (y: number) => v.y + y * v.zoom;
    const ge = gesture.current;
    g.lineWidth = 1;
    const dashed = (draw: () => void) => {
      g.setLineDash([4, 4]);
      g.strokeStyle = "#000";
      draw();
      g.lineDashOffset = 4;
      g.strokeStyle = "#fff";
      draw();
      g.setLineDash([]);
      g.lineDashOffset = 0;
    };
    if (ge?.kind === "rect") {
      const x = Math.min(ge.x0, ge.x1);
      const y = Math.min(ge.y0, ge.y1);
      const w = Math.abs(ge.x1 - ge.x0);
      const h = Math.abs(ge.y1 - ge.y0);
      dashed(() => {
        g.beginPath();
        if (ge.ellipse) g.ellipse(sx(x + w / 2), sy(y + h / 2), (w * v.zoom) / 2, (h * v.zoom) / 2, 0, 0, Math.PI * 2);
        else g.rect(sx(x) + 0.5, sy(y) + 0.5, w * v.zoom, h * v.zoom);
        g.stroke();
      });
    }
    const pts = ge?.kind === "lasso" ? ge.pts : poly;
    if (pts && pts.length) {
      dashed(() => {
        g.beginPath();
        pts.forEach((q, i) => (i ? g.lineTo(sx(q.x), sy(q.y)) : g.moveTo(sx(q.x), sy(q.y))));
        if (poly && pointer.current.inside) g.lineTo(sx(pointer.current.x), sy(pointer.current.y));
        g.stroke();
      });
    }
    if (ge?.kind === "gradient" || ge?.kind === "shape") {
      g.strokeStyle = "#fff";
      g.setLineDash(ge.kind === "shape" ? [] : [6, 3]);
      g.beginPath();
      if (ge.kind === "gradient") {
        g.moveTo(sx(ge.x0), sy(ge.y0));
        g.lineTo(sx(ge.x1), sy(ge.y1));
      }
      g.stroke();
      g.setLineDash([]);
    }
    // Recorte
    if (crop) {
      const x = sx(crop.x);
      const y = sy(crop.y);
      const w = crop.w * v.zoom;
      const h = crop.h * v.zoom;
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.beginPath();
      g.rect(0, 0, size.w, size.h);
      g.rect(x, y, w, h);
      g.fill("evenodd");
      g.strokeStyle = "#fff";
      g.strokeRect(x + 0.5, y + 0.5, w, h);
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.beginPath();
      for (let k = 1; k < 3; k++) {
        g.moveTo(x + (w * k) / 3, y);
        g.lineTo(x + (w * k) / 3, y + h);
        g.moveTo(x, y + (h * k) / 3);
        g.lineTo(x + w, y + (h * k) / 3);
      }
      g.stroke();
      for (const [hx, hy] of handlePoints({ x, y, w, h })) {
        g.fillStyle = "#fff";
        g.fillRect(hx - 4, hy - 4, 8, 8);
      }
      g.fillStyle = "#fff";
      g.font = "11px sans-serif";
      g.fillText(`${Math.round(crop.w)} × ${Math.round(crop.h)} px · Intro para recortar`, x + 4, y - 6);
    }
    // Transformación libre
    if (p.transform) {
      const t = p.transform;
      const corners = transformCorners(t).map(([x, y]) => [sx(x), sy(y)]);
      g.strokeStyle = "#4dabf7";
      g.beginPath();
      corners.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.stroke();
      for (const [x, y] of [...corners, ...corners.map((c, i) => {
        const n = corners[(i + 1) % 4];
        return [(c[0] + n[0]) / 2, (c[1] + n[1]) / 2];
      })]) {
        g.fillStyle = "#fff";
        g.strokeStyle = "#4dabf7";
        g.fillRect(x - 4, y - 4, 8, 8);
        g.strokeRect(x - 4 + 0.5, y - 4 + 0.5, 8, 8);
      }
    }
    // Contorno de la capa de texto bajo el puntero
    if (p.tool === "text" || p.tool === "move") {
      const active = p.doc.layers.find((l) => l.id === p.doc.activeId);
      if (active?.kind === "text" && !p.editingText) {
        const b = textBounds(active);
        g.strokeStyle = "rgba(77,171,247,0.8)";
        g.strokeRect(sx(b.x) - 2, sy(b.y) - 2, b.w * v.zoom + 4, b.h * v.zoom + 4);
      }
    }
    // Cursor del pincel
    if (BRUSH_TOOLS.has(p.tool) && pointer.current.inside) {
      const s = brushOf(p.tool, p.opts);
      const r = Math.max(1, (s.size * v.zoom) / 2);
      const cx = sx(pointer.current.x);
      const cy = sy(pointer.current.y);
      g.strokeStyle = "rgba(0,0,0,0.7)";
      g.beginPath();
      g.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
      g.stroke();
      if (p.tool === "clone" && cloneSource.current) {
        const off = cloneOffset.current;
        const src = off ? { x: pointer.current.x + off.dx, y: pointer.current.y + off.dy } : cloneSource.current;
        g.strokeStyle = "#fff";
        g.beginPath();
        g.moveTo(sx(src.x) - 6, sy(src.y));
        g.lineTo(sx(src.x) + 6, sy(src.y));
        g.moveTo(sx(src.x), sy(src.y) - 6);
        g.lineTo(sx(src.x), sy(src.y) + 6);
        g.stroke();
      }
    }
    void overlay;
  }

  // ------------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------------

  const activeLayer = () => props_.current.doc.layers.find((l) => l.id === props_.current.doc.activeId);

  /** Lienzo base para editar la capa activa (o su máscara). */
  const editableBase = (target: "pixels" | "mask"): { layer: Layer; base: HTMLCanvasElement } | null => {
    const p = props_.current;
    const layer = activeLayer();
    if (!layer) return null;
    if (layer.locked) {
      actions.toast("La capa está bloqueada");
      return null;
    }
    if (target === "mask") {
      const c = newCanvas(p.doc.width, p.doc.height);
      const g = ctx2d(c);
      const m = getCanvas(layer.mask);
      if (m) g.drawImage(m, 0, 0);
      else {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
      }
      return { layer, base: c };
    }
    if (layer.kind !== "raster") {
      actions.toast(layer.kind === "text" ? "Es una capa de texto: rasterízala (menú Capa) para pintar en ella" : "Selecciona una capa de píxeles para pintar");
      return null;
    }
    const c = newCanvas(p.doc.width, p.doc.height);
    const src = getCanvas(layer.data);
    if (src) ctx2d(c).drawImage(src, 0, 0);
    return { layer, base: c };
  };

  const sampleCanvas = (): HTMLCanvasElement | null => {
    const p = props_.current;
    if (p.opts.sampleAll) return composite.current;
    const l = activeLayer();
    return l?.kind === "raster" ? getCanvas(l.data) : composite.current;
  };

  const selectMode = (e: { shiftKey: boolean; altKey: boolean }): ToolOptions["selectMode"] =>
    e.shiftKey && e.altKey ? "intersect" : e.shiftKey ? "add" : e.altKey ? "subtract" : props_.current.opts.selectMode;

  const finishSelection = (mask: HTMLCanvasElement, mode: ToolOptions["selectMode"]) => {
    const p = props_.current;
    const f = p.opts.feather > 0 && (p.tool === "lasso" || p.tool === "polyLasso" || p.tool === "wand") ? featherMask(mask, p.opts.feather) : mask;
    const merged = combine(p.selection?.mask || null, f, mode);
    actions.setSelection(makeSelection(merged));
  };

  // ------------------------------------------------------------------------
  // Puntero
  // ------------------------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    const p = props_.current;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toDoc(e);
    if (e.button === 1 || spaceDown.current || p.tool === "hand") {
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: p.view.x, vy: p.view.y };
      return;
    }
    if (e.button !== 0) return;
    // Transformación libre activa
    if (p.transform) {
      const handle = transformHandleAt(p.transform, pt, p.view.zoom);
      gesture.current = { kind: "transform", handle, start: pt, orig: { ...p.transform } };
      return;
    }
    switch (p.tool) {
      case "zoom": {
        const r = canvasRef.current!.getBoundingClientRect();
        zoomAt(e.altKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top);
        return;
      }
      case "eyedropper": {
        const src = sampleCanvas();
        if (!src) return;
        const d = ctx2d(src).getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data;
        actions.pickColor(`#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`, e.altKey);
        return;
      }
      case "marquee":
      case "ellipseSelect":
        gesture.current = { kind: "rect", x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, ellipse: p.tool === "ellipseSelect", mode: selectMode(e) };
        return;
      case "lasso":
        gesture.current = { kind: "lasso", pts: [pt], mode: selectMode(e) };
        return;
      case "polyLasso": {
        if (!poly) setPoly([pt]);
        else {
          const first = poly[0];
          if (poly.length > 2 && Math.hypot(first.x - pt.x, first.y - pt.y) * p.view.zoom < 8) {
            finishSelection(polygonMask(p.doc.width, p.doc.height, poly), selectMode(e));
            setPoly(null);
          } else setPoly([...poly, pt]);
        }
        return;
      }
      case "wand": {
        const src = sampleCanvas();
        if (!src) return;
        const img = ctx2d(src).getImageData(0, 0, src.width, src.height);
        finishSelection(wandMask(img, pt.x, pt.y, p.opts.wandTolerance, p.opts.wandContiguous), selectMode(e));
        return;
      }
      case "crop": {
        if (crop) {
          const handle = cropHandleAt(crop, pt, p.view.zoom);
          if (handle) {
            gesture.current = { kind: "crop", handle, start: pt, orig: { ...crop } };
            return;
          }
        }
        setCrop({ x: pt.x, y: pt.y, w: 0, h: 0 });
        gesture.current = { kind: "crop", handle: "se", start: pt, orig: { x: pt.x, y: pt.y, w: 0, h: 0 } };
        return;
      }
      case "text": {
        const hit = [...p.doc.layers].reverse().find((l): l is TextLayer => {
          if (l.kind !== "text" || !l.visible) return false;
          const b = textBounds(l);
          return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
        });
        if (hit) actions.editText(hit.id);
        else actions.addText(pt.x, pt.y);
        return;
      }
      case "move": {
        const layer = activeLayer();
        if (!layer || layer.locked) {
          if (layer?.locked) actions.toast("La capa está bloqueada");
          return;
        }
        let base: HTMLCanvasElement | null = null;
        let lifted: HTMLCanvasElement | null = null;
        let rest: HTMLCanvasElement | null = null;
        if (layer.kind === "raster") {
          base = getCanvas(layer.data);
          if (base && p.selection) {
            lifted = newCanvas(p.doc.width, p.doc.height);
            const lg = ctx2d(lifted);
            lg.drawImage(base, 0, 0);
            lg.globalCompositeOperation = "destination-in";
            lg.drawImage(p.selection.mask, 0, 0);
            rest = newCanvas(p.doc.width, p.doc.height);
            const rg = ctx2d(rest);
            rg.drawImage(base, 0, 0);
            rg.globalCompositeOperation = "destination-out";
            rg.drawImage(p.selection.mask, 0, 0);
          }
        }
        gesture.current = { kind: "move", x0: pt.x, y0: pt.y, dx: 0, dy: 0, layer, base, lifted, rest };
        return;
      }
      case "gradient":
        gesture.current = { kind: "gradient", x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
        return;
      case "shape":
        gesture.current = { kind: "shape", x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
        return;
      case "bucket": {
        const ed = editableBase(p.editMask ? "mask" : "pixels");
        if (!ed) return;
        const src = p.opts.sampleAll ? composite.current : ed.base;
        if (!src) return;
        const region = wandMask(ctx2d(src).getImageData(0, 0, src.width, src.height), pt.x, pt.y, p.opts.bucketTolerance, true);
        const rg = ctx2d(region);
        if (p.selection) {
          rg.globalCompositeOperation = "destination-in";
          rg.drawImage(p.selection.mask, 0, 0);
        }
        actions.commitPixels(ed.layer.id, applyStroke(ed.base, region, { kind: "paint", color: p.fg }, 1, null), p.editMask ? "mask" : "pixels", "Bote de pintura");
        return;
      }
      default:
        break;
    }
    if (BRUSH_TOOLS.has(p.tool)) {
      if (p.tool === "clone" && e.altKey) {
        cloneSource.current = pt;
        cloneOffset.current = null;
        actions.toast("Origen del tampón fijado");
        return;
      }
      const target = p.editMask ? "mask" : "pixels";
      const ed = editableBase(target);
      if (!ed) return;
      const s = brushOf(p.tool, p.opts);
      const stroke = new Stroke(p.doc.width, p.doc.height, s, p.tool === "pencil");
      let mode: "paint" | "erase" | "reveal" | "heal" = "paint";
      let source: HTMLCanvasElement | undefined;
      let color = p.fg;
      if (p.tool === "eraser") {
        if (target === "mask") color = p.bg;
        else mode = "erase";
      } else if (p.tool === "clone") {
        if (!cloneSource.current) {
          actions.toast("Pulsa Alt + clic para elegir el origen del tampón");
          return;
        }
        if (!cloneOffset.current) cloneOffset.current = { dx: cloneSource.current.x - pt.x, dy: cloneSource.current.y - pt.y };
        const from = p.opts.sampleAll && composite.current ? composite.current : ed.base;
        source = shiftedSource(from, -cloneOffset.current.dx, -cloneOffset.current.dy);
        mode = "reveal";
      } else if (p.tool === "dodge" || p.tool === "burn") {
        source = toneSource(ed.base, p.tool, p.opts.tone.range, p.opts.tone.opacity);
        mode = "reveal";
      } else if (p.tool === "blurTool") {
        source = applyFilter(ed.base, "gaussian", { radius: Math.max(2, s.size / 8) });
        mode = "reveal";
      } else if (p.tool === "heal") mode = "heal";
      gesture.current = { kind: "stroke", stroke, layerId: ed.layer.id, base: ed.base, mode, source, target, color, opacity: p.tool === "dodge" || p.tool === "burn" ? 1 : s.opacity / 100 };
      stroke.add({ ...pt, pressure: e.pointerType === "pen" ? e.pressure || 0.5 : 1 });
      updateStrokePreview();
    }
  };

  const updateStrokePreview = () => {
    const ge = gesture.current;
    if (ge?.kind !== "stroke") return;
    const p = props_.current;
    const sel = p.selection?.mask || null;
    let out: HTMLCanvasElement;
    if (ge.mode === "heal") {
      // Vista previa: marca roja translúcida sobre la zona a reparar
      out = applyStroke(ge.base, ge.stroke.mask, { kind: "paint", color: "#ff3b30" }, 0.45, sel);
    } else out = applyStroke(ge.base, ge.stroke.mask, ge.mode === "erase" ? { kind: "erase" } : ge.mode === "reveal" ? { kind: "reveal", source: ge.source! } : { kind: "paint", color: ge.color }, ge.opacity, sel);
    override.current = { id: ge.layerId, canvas: out };
    requestDraw(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = props_.current;
    const pt = toDoc(e);
    pointer.current = { ...pt, inside: true };
    const ge = gesture.current;
    if (!ge) {
      if (BRUSH_TOOLS.has(p.tool) || poly) requestDraw();
      return;
    }
    switch (ge.kind) {
      case "pan":
        setView((v) => ({ ...v, x: ge.vx + e.clientX - ge.sx, y: ge.vy + e.clientY - ge.sy }));
        return;
      case "stroke": {
        const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [e.nativeEvent];
        for (const ev of events) {
          const q = toDoc(ev);
          ge.stroke.add({ ...q, pressure: ev.pointerType === "pen" ? ev.pressure || 0.5 : 1 });
        }
        updateStrokePreview();
        return;
      }
      case "rect": {
        let x1 = pt.x;
        let y1 = pt.y;
        if (e.shiftKey) {
          const d = Math.max(Math.abs(x1 - ge.x0), Math.abs(y1 - ge.y0));
          x1 = ge.x0 + Math.sign(x1 - ge.x0 || 1) * d;
          y1 = ge.y0 + Math.sign(y1 - ge.y0 || 1) * d;
        }
        ge.x1 = x1;
        ge.y1 = y1;
        requestDraw();
        return;
      }
      case "lasso":
        ge.pts.push(pt);
        requestDraw();
        return;
      case "move": {
        ge.dx = Math.round(pt.x - ge.x0);
        ge.dy = Math.round(pt.y - ge.y0);
        if (ge.layer.kind === "raster" && ge.base) {
          const c = newCanvas(p.doc.width, p.doc.height);
          const g = ctx2d(c);
          if (ge.lifted && ge.rest) {
            g.drawImage(ge.rest, 0, 0);
            g.drawImage(ge.lifted, ge.dx, ge.dy);
          } else g.drawImage(ge.base, ge.dx, ge.dy);
          override.current = { id: ge.layer.id, canvas: c };
          requestDraw(true);
        } else if (ge.layer.kind === "text") {
          actions.updateLayer(ge.layer.id, { x: ge.layer.x + ge.dx, y: ge.layer.y + ge.dy } as Partial<Layer>, `move-${ge.layer.id}`);
        }
        return;
      }
      case "gradient": {
        ge.x1 = pt.x;
        ge.y1 = pt.y;
        const ed = editableBase(p.editMask ? "mask" : "pixels");
        if (ed) {
          const fill = gradientFill(p.doc.width, p.doc.height, { x: ge.x0, y: ge.y0 }, { x: ge.x1, y: ge.y1 }, p.opts.gradientType, p.fg, p.opts.gradientMode === "fgbg" ? p.bg : rgba(p.fg, 0));
          const c = newCanvas(p.doc.width, p.doc.height);
          const g = ctx2d(c);
          g.drawImage(ed.base, 0, 0);
          if (p.selection) {
            const clipped = newCanvas(p.doc.width, p.doc.height);
            const cg = ctx2d(clipped);
            cg.drawImage(fill, 0, 0);
            cg.globalCompositeOperation = "destination-in";
            cg.drawImage(p.selection.mask, 0, 0);
            g.drawImage(clipped, 0, 0);
          } else g.drawImage(fill, 0, 0);
          override.current = { id: ed.layer.id, canvas: c };
        }
        requestDraw(true);
        return;
      }
      case "shape": {
        ge.x1 = pt.x;
        ge.y1 = pt.y;
        if (e.shiftKey && p.opts.shape !== "line") {
          const d = Math.max(Math.abs(ge.x1 - ge.x0), Math.abs(ge.y1 - ge.y0));
          ge.x1 = ge.x0 + Math.sign(ge.x1 - ge.x0 || 1) * d;
          ge.y1 = ge.y0 + Math.sign(ge.y1 - ge.y0 || 1) * d;
        }
        const layer = activeLayer();
        if (layer) {
          const base = layer.kind === "raster" ? getCanvas(layer.data) : null;
          const c = newCanvas(p.doc.width, p.doc.height);
          const g = ctx2d(c);
          if (base) g.drawImage(base, 0, 0);
          g.drawImage(shapeCanvas(p, ge), 0, 0);
          if (layer.kind === "raster") override.current = { id: layer.id, canvas: c };
        }
        requestDraw(true);
        return;
      }
      case "crop": {
        const dx = pt.x - ge.start.x;
        const dy = pt.y - ge.start.y;
        const o = ge.orig;
        let { x, y, w, h } = o;
        if (ge.handle === "move") {
          x += dx;
          y += dy;
        } else {
          if (ge.handle.includes("w")) {
            x = o.x + dx;
            w = o.w - dx;
          }
          if (ge.handle.includes("e")) w = o.w + dx;
          if (ge.handle.includes("n")) {
            y = o.y + dy;
            h = o.h - dy;
          }
          if (ge.handle.includes("s")) h = o.h + dy;
        }
        if (w < 0) {
          x += w;
          w = -w;
        }
        if (h < 0) {
          y += h;
          h = -h;
        }
        setCrop({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
        return;
      }
      case "transform": {
        actions.setTransform(dragTransform(ge.orig, ge.handle, ge.start, pt, e.shiftKey));
        return;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = props_.current;
    const ge = gesture.current;
    gesture.current = null;
    if (!ge) return;
    switch (ge.kind) {
      case "stroke": {
        override.current = null;
        if (ge.mode === "heal") {
          let mask = ge.stroke.mask;
          if (p.selection) {
            mask = newCanvas(p.doc.width, p.doc.height);
            const mg = ctx2d(mask);
            mg.drawImage(ge.stroke.mask, 0, 0);
            mg.globalCompositeOperation = "destination-in";
            mg.drawImage(p.selection.mask, 0, 0);
          }
          actions.busy("Reparando…");
          window.setTimeout(() => {
            try {
              actions.commitPixels(ge.layerId, contentAwareFill(ge.base, mask), "pixels", "Pincel corrector");
            } finally {
              actions.busy(null);
            }
          }, 20);
          return;
        }
        const out = applyStroke(ge.base, ge.stroke.mask, ge.mode === "erase" ? { kind: "erase" } : ge.mode === "reveal" ? { kind: "reveal", source: ge.source! } : { kind: "paint", color: ge.color }, ge.opacity, p.selection?.mask || null);
        actions.commitPixels(ge.layerId, out, ge.target, TOOL_LABEL[p.tool] || "Pincel");
        return;
      }
      case "rect": {
        const x = Math.min(ge.x0, ge.x1);
        const y = Math.min(ge.y0, ge.y1);
        const w = Math.abs(ge.x1 - ge.x0);
        const h = Math.abs(ge.y1 - ge.y0);
        if (w < 1 || h < 1) {
          if (ge.mode === "new") actions.setSelection(null);
          requestDraw();
          return;
        }
        finishSelection(rectMask(p.doc.width, p.doc.height, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, ge.ellipse, p.opts.feather), ge.mode);
        requestDraw();
        return;
      }
      case "lasso":
        if (ge.pts.length > 2) finishSelection(polygonMask(p.doc.width, p.doc.height, ge.pts), ge.mode);
        requestDraw();
        return;
      case "move": {
        if (ge.layer.kind === "raster" && (ge.dx || ge.dy) && override.current) {
          const c = override.current.canvas;
          override.current = null;
          actions.commitPixels(ge.layer.id, c, "pixels", "Mover");
          if (p.selection) {
            const moved = newCanvas(p.doc.width, p.doc.height);
            ctx2d(moved).drawImage(p.selection.mask, ge.dx, ge.dy);
            actions.setSelection(makeSelection(moved));
          }
        } else override.current = null;
        requestDraw(true);
        return;
      }
      case "gradient": {
        const c = override.current?.canvas;
        const id = override.current?.id;
        override.current = null;
        if (c && id && Math.hypot(ge.x1 - ge.x0, ge.y1 - ge.y0) > 1) actions.commitPixels(id, c, p.editMask ? "mask" : "pixels", "Degradado");
        requestDraw(true);
        return;
      }
      case "shape": {
        override.current = null;
        if (Math.abs(ge.x1 - ge.x0) > 1 || Math.abs(ge.y1 - ge.y0) > 1) actions.addPixelLayer(shapeCanvas(p, ge), "Forma");
        requestDraw(true);
        return;
      }
      default:
        void e;
    }
  };

  const onDoubleClick = () => {
    const p = props_.current;
    if (p.tool === "polyLasso" && poly && poly.length > 2) {
      finishSelection(polygonMask(p.doc.width, p.doc.height, poly), p.opts.selectMode);
      setPoly(null);
    }
    if (p.tool === "crop" && crop) applyCropNow();
  };

  const applyCropNow = () => {
    if (!crop || crop.w < 2 || crop.h < 2) return;
    actions.applyCrop(crop);
    setCrop(null);
  };

  // Rueda: zoom en el puntero; con Mayús, desplazamiento horizontal
  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || !e.shiftKey) {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 2 && Math.abs(e.deltaX) > 0) return;
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    } else setView((v) => ({ ...v, x: v.x - e.deltaY, y: v.y }));
  };

  // Barra espaciadora: mano temporal; Intro/Esc para recorte, lazo y transformación
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.code === "Space") {
        spaceDown.current = true;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }
      if (e.key === "Enter") {
        if (crop) applyCropNow();
        if (poly && poly.length > 2) {
          finishSelection(polygonMask(doc.width, doc.height, poly), opts.selectMode);
          setPoly(null);
        }
        if (props_.current.transform) applyTransform();
      }
      if (e.key === "Escape") {
        setCrop(null);
        setPoly(null);
        if (props_.current.transform) actions.setTransform(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  useEffect(() => {
    if (tool !== "crop") setCrop(null);
    if (tool !== "polyLasso") setPoly(null);
  }, [tool]);

  const applyTransform = () => {
    const p = props_.current;
    const t = p.transform;
    if (!t) return;
    const c = newCanvas(p.doc.width, p.doc.height);
    const g = ctx2d(c);
    if (t.rest) g.drawImage(t.rest, 0, 0);
    g.imageSmoothingQuality = "high";
    drawTransformed(g, t);
    actions.setTransform(null);
    actions.commitPixels(t.layerId, c, "pixels", "Transformación libre");
    if (p.selection) actions.setSelection(null);
  };

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (k: number) => zoomAt(k, size.w / 2, size.h / 2),
    actual: () => setView({ zoom: 1, x: (size.w - doc.width) / 2, y: (size.h - doc.height) / 2 }),
    composite: () => {
      recompose();
      return composite.current!;
    },
    applyTransform,
    cancelCrop: () => setCrop(null),
    applyCropNow,
    screenOf: (x: number, y: number) => ({ x: view.x + x * view.zoom, y: view.y + y * view.zoom }),
  }));

  const cursor = (() => {
    if (tool === "hand") return "grab";
    if (tool === "zoom") return "zoom-in";
    if (tool === "move") return "move";
    if (tool === "text") return "text";
    if (BRUSH_TOOLS.has(tool)) return "none";
    if (tool === "eyedropper") return "copy";
    return "crosshair";
  })();

  return (
    <div ref={hostRef} className="relative flex-1 min-w-0 overflow-hidden" data-photo-canvas>
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          pointer.current.inside = false;
          requestDraw();
        }}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {SELECT_TOOLS.has(tool) && poly && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] bg-black/70 text-white px-2 py-1 rounded">Doble clic o Intro para cerrar el lazo</div>}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Ayudas de geometría
// ---------------------------------------------------------------------------

export const TOOL_LABEL: Partial<Record<Tool, string>> = {
  brush: "Pincel",
  pencil: "Lápiz",
  eraser: "Borrador",
  clone: "Tampón de clonar",
  heal: "Pincel corrector",
  dodge: "Sobreexponer",
  burn: "Subexponer",
  blurTool: "Desenfocar",
};

function brushOf(tool: Tool, o: ToolOptions) {
  return tool === "eraser" ? o.eraser : tool === "clone" ? o.clone : tool === "heal" ? o.heal : tool === "dodge" || tool === "burn" ? o.tone : tool === "blurTool" ? o.blur : o.brush;
}

function shapeCanvas(p: Props, ge: { x0: number; y0: number; x1: number; y1: number }): HTMLCanvasElement {
  const c = newCanvas(p.doc.width, p.doc.height);
  const g = ctx2d(c);
  const x = Math.min(ge.x0, ge.x1);
  const y = Math.min(ge.y0, ge.y1);
  const w = Math.abs(ge.x1 - ge.x0);
  const h = Math.abs(ge.y1 - ge.y0);
  g.fillStyle = p.fg;
  g.strokeStyle = p.opts.shapeFill ? p.bg : p.fg;
  g.lineWidth = Math.max(1, p.opts.shapeStroke);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  if (p.opts.shape === "line") {
    g.moveTo(ge.x0, ge.y0);
    g.lineTo(ge.x1, ge.y1);
    g.strokeStyle = p.fg;
    g.stroke();
    return c;
  }
  if (p.opts.shape === "ellipse") g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (p.opts.shape === "roundRect") g.roundRect(x, y, w, h, Math.min(p.opts.cornerRadius, w / 2, h / 2));
  else g.rect(x, y, w, h);
  if (p.opts.shapeFill) g.fill();
  if (!p.opts.shapeFill || p.opts.shapeStroke > 0) g.stroke();
  return c;
}

function handlePoints(r: { x: number; y: number; w: number; h: number }): Array<[number, number]> {
  return [
    [r.x, r.y],
    [r.x + r.w / 2, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h / 2],
    [r.x + r.w, r.y + r.h],
    [r.x + r.w / 2, r.y + r.h],
    [r.x, r.y + r.h],
    [r.x, r.y + r.h / 2],
  ];
}

const HANDLE_NAMES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function cropHandleAt(r: { x: number; y: number; w: number; h: number }, pt: { x: number; y: number }, zoom: number): string | null {
  const tol = 8 / zoom;
  const pts = handlePoints(r);
  for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i][0] - pt.x) < tol && Math.abs(pts[i][1] - pt.y) < tol) return HANDLE_NAMES[i];
  if (pt.x > r.x && pt.x < r.x + r.w && pt.y > r.y && pt.y < r.y + r.h) return "move";
  return null;
}

export function transformCorners(t: TransformState): Array<[number, number]> {
  const cx = t.box.x + t.box.w / 2 + t.tx;
  const cy = t.box.y + t.box.h / 2 + t.ty;
  const a = (t.angle * Math.PI) / 180;
  const hw = (t.box.w * t.sx) / 2;
  const hh = (t.box.h * t.sy) / 2;
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as Array<[number, number]>).map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
}

export function drawTransformed(g: CanvasRenderingContext2D, t: TransformState) {
  const cx = t.box.x + t.box.w / 2;
  const cy = t.box.y + t.box.h / 2;
  g.save();
  g.translate(cx + t.tx, cy + t.ty);
  g.rotate((t.angle * Math.PI) / 180);
  g.scale(t.sx, t.sy);
  g.drawImage(t.source, t.box.x, t.box.y, t.box.w, t.box.h, -t.box.w / 2, -t.box.h / 2, t.box.w, t.box.h);
  g.restore();
}

function transformHandleAt(t: TransformState, pt: { x: number; y: number }, zoom: number): string {
  const corners = transformCorners(t);
  const tol = 9 / zoom;
  const names = ["nw", "ne", "se", "sw"];
  for (let i = 0; i < 4; i++) if (Math.hypot(corners[i][0] - pt.x, corners[i][1] - pt.y) < tol) return names[i];
  const mids = ["n", "e", "s", "w"];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    if (Math.hypot((a[0] + b[0]) / 2 - pt.x, (a[1] + b[1]) / 2 - pt.y) < tol) return mids[i];
  }
  // Dentro: mover; fuera: girar
  const cx = t.box.x + t.box.w / 2 + t.tx;
  const cy = t.box.y + t.box.h / 2 + t.ty;
  const a = (-t.angle * Math.PI) / 180;
  const lx = (pt.x - cx) * Math.cos(a) - (pt.y - cy) * Math.sin(a);
  const ly = (pt.x - cx) * Math.sin(a) + (pt.y - cy) * Math.cos(a);
  return Math.abs(lx) <= (t.box.w * Math.abs(t.sx)) / 2 && Math.abs(ly) <= (t.box.h * Math.abs(t.sy)) / 2 ? "move" : "rotate";
}

function dragTransform(o: TransformState, handle: string, start: { x: number; y: number }, pt: { x: number; y: number }, shift: boolean): TransformState {
  if (handle === "move") return { ...o, tx: o.tx + pt.x - start.x, ty: o.ty + pt.y - start.y };
  const cx = o.box.x + o.box.w / 2 + o.tx;
  const cy = o.box.y + o.box.h / 2 + o.ty;
  if (handle === "rotate") {
    const a0 = Math.atan2(start.y - cy, start.x - cx);
    const a1 = Math.atan2(pt.y - cy, pt.x - cx);
    let angle = o.angle + ((a1 - a0) * 180) / Math.PI;
    if (shift) angle = Math.round(angle / 15) * 15;
    return { ...o, angle };
  }
  // Escala desde el centro (en el sistema girado)
  const a = (-o.angle * Math.PI) / 180;
  const local = (q: { x: number; y: number }) => ({ x: (q.x - cx) * Math.cos(a) - (q.y - cy) * Math.sin(a), y: (q.x - cx) * Math.sin(a) + (q.y - cy) * Math.cos(a) });
  const s0 = local(start);
  const s1 = local(pt);
  let sx = o.sx;
  let sy = o.sy;
  if (handle.includes("e") || handle.includes("w")) sx = o.sx * (s1.x / (s0.x || 1));
  if (handle.includes("n") || handle.includes("s")) sy = o.sy * (s1.y / (s0.y || 1));
  // Las esquinas mantienen la proporción (Mayús la libera)
  if (handle.length === 2 && !shift) {
    const k = Math.max(sx / o.sx, sy / o.sy);
    sx = o.sx * k;
    sy = o.sy * k;
  }
  return { ...o, sx, sy };
}
