// Exportar el tablero (todo o lo seleccionado) a PNG y PDF.
// Se arma un SVG sin foreignObject (los textos se parten en líneas) para poder pasarlo a imagen.

import type * as Y from "yjs";
import { imagenesDe, listar, NOTA_COLORES, type Elemento } from "../board/model";
import { rutaConector } from "../canvas/conectores";
import { unirCajas } from "../canvas/vista";

const MARGEN = 40;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Parte un texto en líneas de hasta `max` caracteres (respetando saltos y palabras). */
export function envolver(texto: string, max: number): string[] {
  const out: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let linea = "";
    for (const palabra of parrafo.split(/\s+/)) {
      if (!palabra) continue;
      let p = palabra;
      while (p.length > max) {
        if (linea) { out.push(linea); linea = ""; }
        out.push(p.slice(0, max));
        p = p.slice(max);
      }
      if (!linea) linea = p;
      else if ((linea + " " + p).length <= max) linea += " " + p;
      else { out.push(linea); linea = p; }
    }
    out.push(linea);
  }
  return out;
}

function textoSVG(el: Elemento, texto: string, tam: number, color: string, centrado: boolean, negrita = false): string {
  const max = Math.max(4, Math.floor((el.w - 16) / (tam * 0.55)));
  const lineas = envolver(texto, max).slice(0, Math.max(1, Math.floor((el.h - 8) / (tam * 1.2))));
  const alto = lineas.length * tam * 1.2;
  const y0 = centrado ? el.y + (el.h - alto) / 2 + tam : el.y + tam + 2;
  const x = centrado ? el.x + el.w / 2 : el.x + 4;
  return lineas
    .map((l, i) => `<text x="${x}" y="${y0 + i * tam * 1.2}" font-size="${tam}" font-family="Hanken Grotesk, Segoe UI, sans-serif" font-weight="${negrita ? 700 : 500}" fill="${color}"${centrado ? ' text-anchor="middle"' : ""}>${esc(l)}</text>`)
    .join("");
}

function aBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function tipoImagen(b: Uint8Array): string {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49) return "image/webp";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  return "image/jpeg";
}

function elementoSVG(doc: Y.Doc, el: Elemento): string {
  switch (el.kind) {
    case "nota":
      return `<rect x="${el.x + 3}" y="${el.y + 5}" width="${el.w}" height="${el.h}" rx="6" fill="rgba(0,0,0,0.12)"/>` +
        `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="6" fill="${NOTA_COLORES[el.color]}"/>` +
        textoSVG(el, el.texto, Math.max(12, Math.min(24, Math.sqrt((el.w * el.h) / Math.max(1, el.texto.length)) * 0.9)), "#2c1b12", true);
    case "texto":
      return textoSVG(el, el.texto, el.tam, el.color, false, el.negrita);
    case "forma": {
      const { x, y, w, h } = el;
      const a = `fill="${el.relleno}" stroke="${el.borde}" stroke-width="2"`;
      const f =
        el.forma === "elipse" ? `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${a}/>` :
        el.forma === "rombo" ? `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" ${a}/>` :
        el.forma === "flecha" ? `<polygon points="${x},${y + h * 0.3} ${x + w * 0.65},${y + h * 0.3} ${x + w * 0.65},${y} ${x + w},${y + h / 2} ${x + w * 0.65},${y + h} ${x + w * 0.65},${y + h * 0.7} ${x},${y + h * 0.7}" ${a}/>` :
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${a}/>`;
      return f + (el.texto ? textoSVG(el, el.texto, 18, "#2c1b12", true) : "");
    }
    case "conector": {
      const p = rutaConector(doc, el).puntos;
      let d = "";
      for (let i = 0; i + 1 < p.length; i += 2) d += `${i ? "L" : "M"}${p[i]} ${p[i + 1]}`;
      const id = `f${el.color.replace("#", "")}`;
      return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${el.color}"/></marker></defs>` +
        `<path d="${d}" stroke="${el.color}" stroke-width="2.5" fill="none"${el.flecha ? ` marker-end="url(#${id})"` : ""}/>`;
    }
    case "trazo": {
      let d = "";
      for (let i = 0; i + 1 < el.puntos.length; i += 2) d += `${i ? "L" : "M"}${el.x + el.puntos[i]} ${el.y + el.puntos[i + 1]}`;
      return `<path d="${d}" stroke="${el.color}" stroke-width="${el.grosor}" stroke-opacity="${el.marcador ? 0.45 : 1}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    case "imagen": {
      const b = imagenesDe(doc).get(el.imagenId);
      return b ? `<image href="data:${tipoImagen(b)};base64,${aBase64(b)}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="none"/>` : "";
    }
  }
}

/** SVG del tablero (o de los ids dados) con margen y fondo claro. */
export function svgDelTablero(doc: Y.Doc, ids?: string[]): { svg: string; w: number; h: number } {
  const els = listar(doc).filter((e) => !ids?.length || ids.includes(e.id));
  const caja = unirCajas(els.filter((e) => e.kind !== "conector").map(({ x, y, w, h }) => ({ x, y, w, h }))) ?? { x: 0, y: 0, w: 400, h: 300 };
  const x = caja.x - MARGEN, y = caja.y - MARGEN, w = caja.w + 2 * MARGEN, h = caja.h + 2 * MARGEN;
  const cuerpo = els.map((e) => elementoSVG(doc, e)).join("");
  return {
    w, h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#faf7f2"/>${cuerpo}</svg>`,
  };
}

async function aCanvas(doc: Y.Doc, ids?: string[]): Promise<HTMLCanvasElement> {
  const { svg, w, h } = svgDelTablero(doc, ids);
  const escala = Math.min(2, 8000 / Math.max(w, h));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, mal) => { img.onload = () => ok(); img.onerror = () => mal(new Error("No se pudo dibujar el tablero")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * escala);
    c.height = Math.ceil(h * escala);
    const ctx = c.getContext("2d")!;
    ctx.scale(escala, escala);
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportarPNG(doc: Y.Doc, ids?: string[]): Promise<Blob> {
  const c = await aCanvas(doc, ids);
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo crear la imagen"))), "image/png"));
}

export async function exportarPDF(doc: Y.Doc, ids?: string[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const c = await aCanvas(doc, ids);
  const w = c.width / 2, h = c.height / 2;
  const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "pt", format: [w, h] });
  pdf.addImage(c.toDataURL("image/png"), "PNG", 0, 0, w, h);
  return pdf.output("blob");
}
