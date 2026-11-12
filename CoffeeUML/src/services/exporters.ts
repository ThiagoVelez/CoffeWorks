// Exportación de diagramas a SVG, PNG y PDF.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsPDF } from "jspdf";
import type { Diagram } from "../types";
import { boundsOf } from "./model";
import { DiagramSvgContent } from "./render";

const fontCache = new Map<string, string>();

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Incrusta las fuentes de la app (las imágenes SVG no ven las de la página). */
async function fontFaceCss(): Promise<string> {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(list)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
      if (family !== "Hanken Grotesk" && family !== "JetBrains Mono") continue;
      const range = rule.style.getPropertyValue("unicode-range");
      if (range && !/U\+0000/i.test(range)) continue;
      const match = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) continue;
      try {
        const url = new URL(match[1], sheet.href || location.href).href;
        if (!fontCache.has(url)) fontCache.set(url, await toDataUrl(url));
        rules.push(`@font-face{font-family:'${family}';font-weight:${rule.style.getPropertyValue("font-weight") || "400"};src:url(${fontCache.get(url)}) format('woff2');}`);
      } catch {
        // se usa la fuente del sistema
      }
    }
  }
  return rules.join("");
}

export async function diagramSvg(d: Diagram, ids?: string[], background = "#ffffff"): Promise<{ svg: string; w: number; h: number }> {
  const b = boundsOf(d, ids && ids.length ? ids : undefined);
  if (!b) throw new Error("El diagrama está vacío.");
  const pad = 24;
  const box = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  // Solo se exportan las figuras pedidas y las conexiones entre ellas
  const sub: Diagram = ids && ids.length
    ? { ...d, nodes: Object.fromEntries(ids.filter((id) => d.nodes[id]).map((id) => [id, d.nodes[id]])), edges: Object.fromEntries(Object.entries(d.edges).filter(([, e]) => ids.includes(e.source) && ids.includes(e.target))), order: d.order.filter((id) => ids.includes(id)) }
    : d;
  const markup = renderToStaticMarkup(
    React.createElement(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", width: box.w, height: box.h, viewBox: `${box.x} ${box.y} ${box.w} ${box.h}` },
      background ? React.createElement("rect", { x: box.x, y: box.y, width: box.w, height: box.h, fill: background }) : null,
      React.createElement(DiagramSvgContent, { d: sub })
    )
  );
  const css = await fontFaceCss();
  return { svg: css ? markup.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`) : markup, w: box.w, h: box.h };
}

export async function diagramPng(d: Diagram, scale = 2, ids?: string[], background = "#ffffff"): Promise<Blob> {
  const { svg, w, h } = await diagramSvg(d, ids, background);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo dibujar el diagrama."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PDF con una página por diagrama. */
export async function diagramsPdf(diagrams: Diagram[]): Promise<Blob> {
  let pdf: jsPDF | null = null;
  for (const d of diagrams) {
    if (!Object.keys(d.nodes).length) continue;
    const { w, h } = await diagramSvg(d);
    const png = new Uint8Array(await (await diagramPng(d, 2)).arrayBuffer());
    const wPt = Math.max(200, w * 0.75);
    const hPt = Math.max(200, h * 0.75) + 30;
    const orientation = wPt > hPt ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ unit: "pt", format: [wPt, hPt], orientation });
    else pdf.addPage([wPt, hPt], orientation);
    pdf.setFontSize(11);
    pdf.setTextColor(30, 58, 95);
    pdf.text(d.name, 18, 20);
    pdf.addImage(png, "PNG", 0, 30, w * 0.75, h * 0.75);
  }
  if (!pdf) throw new Error("Los diagramas están vacíos.");
  pdf.setProperties({ title: diagrams[0]?.name || "Diagramas", creator: "CoffeeUML" });
  return pdf.output("blob");
}
