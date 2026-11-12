// Exportación de CoffeeVector: PNG/JPG (por mesa de trabajo, a la escala
// elegida), PDF vectorial (una página por mesa) y SVG.

import { jsPDF } from "jspdf";
import type { Artboard, Paint, VDoc, VObject } from "../types";
import { objectBounds, pathD } from "./geom";
import { exportSvg } from "./svg";

type Ctx = CanvasRenderingContext2D;

function fillStyleOf(g: Ctx, p: Paint, o: VObject): string | CanvasGradient {
  if (p.type === "solid") return p.color;
  const b = objectBounds(o) || { x: 0, y: 0, w: 1, h: 1 };
  let grad: CanvasGradient;
  if (p.type === "linear") {
    const a = (p.angle * Math.PI) / 180;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = (Math.cos(a) * b.w) / 2;
    const dy = (Math.sin(a) * b.h) / 2;
    grad = g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  } else grad = g.createRadialGradient(b.x + b.w * p.cx, b.y + b.h * p.cy, 0, b.x + b.w * p.cx, b.y + b.h * p.cy, Math.max(b.w, b.h) * p.r);
  for (const s of p.stops) grad.addColorStop(Math.min(1, Math.max(0, s.offset)), hexA(s.color, s.opacity));
  return grad;
}

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Dibuja un objeto en un contexto 2D (lienzo o PDF). */
export async function drawObject(g: Ctx, o: VObject): Promise<void> {
  if (!o.visible) return;
  g.save();
  g.globalAlpha *= o.opacity;
  if (o.blend && o.blend !== "normal") g.globalCompositeOperation = o.blend as GlobalCompositeOperation;
  switch (o.type) {
    case "path": {
      const path = new Path2D(pathD(o.subpaths));
      if (o.fill) {
        g.fillStyle = fillStyleOf(g, o.fill, o);
        if (o.fill.type === "solid") g.globalAlpha *= o.fill.opacity;
        g.fill(path, o.fillRule);
        if (o.fill.type === "solid") g.globalAlpha /= o.fill.opacity || 1;
      }
      if (o.stroke && o.stroke.width > 0) {
        g.strokeStyle = hexA(o.stroke.color, o.stroke.opacity);
        g.lineWidth = o.stroke.width;
        g.lineCap = o.stroke.cap;
        g.lineJoin = o.stroke.join;
        g.setLineDash(o.stroke.dash);
        g.stroke(path);
      }
      break;
    }
    case "text": {
      g.translate(o.x, o.y);
      g.rotate((o.rotation * Math.PI) / 180);
      g.font = `${o.italic ? "italic " : ""}${o.weight} ${o.size}px "${o.font}", sans-serif`;
      (g as unknown as { letterSpacing: string }).letterSpacing = `${o.letterSpacing}px`;
      g.textAlign = o.align === "middle" ? "center" : o.align === "end" ? "right" : "left";
      g.textBaseline = "alphabetic";
      o.text.split("\n").forEach((line, i) => {
        const y = i * o.size * o.lineHeight;
        if (o.stroke && o.stroke.width > 0) {
          g.strokeStyle = hexA(o.stroke.color, o.stroke.opacity);
          g.lineWidth = o.stroke.width;
          g.lineJoin = "round";
          g.strokeText(line, 0, y);
        }
        if (o.fill) {
          g.fillStyle = o.fill.type === "solid" ? hexA(o.fill.color, o.fill.opacity) : fillStyleOf(g, o.fill, o);
          g.fillText(line, 0, y);
        }
      });
      break;
    }
    case "image": {
      const img = new Image();
      img.src = o.href;
      await img.decode().catch(() => undefined);
      g.translate(o.x + o.w / 2, o.y + o.h / 2);
      g.rotate((o.rotation * Math.PI) / 180);
      g.drawImage(img, -o.w / 2, -o.h / 2, o.w, o.h);
      break;
    }
    case "group": {
      const kids = o.clip ? o.children.slice(1) : o.children;
      if (o.clip && o.children[0]?.type === "path") g.clip(new Path2D(pathD(o.children[0].subpaths)));
      for (const c of kids) await drawObject(g, c);
      break;
    }
  }
  g.restore();
}

export async function renderArtboard(doc: VDoc, ab: Artboard, scale: number, opts: { transparent?: boolean; background?: string } = {}): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(ab.w * scale));
  c.height = Math.max(1, Math.round(ab.h * scale));
  const g = c.getContext("2d")!;
  const bg = opts.background || ab.background;
  if (bg && !opts.transparent) {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.scale(scale, scale);
  g.translate(-ab.x, -ab.y);
  for (const o of doc.objects) await drawObject(g, o);
  return c;
}

export async function exportRaster(doc: VDoc, ab: Artboard, format: "png" | "jpg", scale: number, transparent: boolean): Promise<Blob> {
  const c = await renderArtboard(doc, ab, scale, { transparent: format === "png" && transparent, background: format === "jpg" ? ab.background || "#ffffff" : undefined });
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), format === "jpg" ? "image/jpeg" : "image/png", 0.92));
}

/** PDF vectorial: una página por mesa de trabajo. */
export async function exportPdf(doc: VDoc, boards: Artboard[]): Promise<Blob> {
  const first = boards[0];
  const pdf = new jsPDF({ orientation: first.w > first.h ? "landscape" : "portrait", unit: "pt", format: [first.w * 0.75, first.h * 0.75] });
  for (let i = 0; i < boards.length; i++) {
    const ab = boards[i];
    if (i) pdf.addPage([ab.w * 0.75, ab.h * 0.75], ab.w > ab.h ? "landscape" : "portrait");
    const g = pdf.context2d as unknown as Ctx;
    g.save();
    g.scale(0.75, 0.75);
    g.translate(-ab.x, -ab.y);
    if (ab.background) {
      g.fillStyle = ab.background;
      g.fillRect(ab.x, ab.y, ab.w, ab.h);
    }
    for (const o of doc.objects) await drawObject(g, o);
    g.restore();
  }
  return pdf.output("blob");
}

export const svgBlob = (doc: VDoc, ab: Artboard | null, transparent = false) => new Blob([exportSvg(doc, ab, transparent)], { type: "image/svg+xml" });
