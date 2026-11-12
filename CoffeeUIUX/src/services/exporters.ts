// Exportación: SVG, PNG, JPG, PDF y código HTML/CSS.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsPDF } from "jspdf";
import type { Page, Paint, UNode, UxDocument } from "../types";
import { absoluteBox, findComponent, parentMap, unionBox, type Box } from "./model";
import { pathData, polygonPoints, renderNode } from "./render";

// ---------------------------------------------------------------------------
// Fuentes incrustadas (las imágenes SVG no ven las fuentes de la página)
// ---------------------------------------------------------------------------

const fontCache = new Map<string, string>();

function usedFamilies(page: Page, ids: string[], doc: UxDocument): Set<string> {
  const out = new Set<string>();
  const visit = (p: Page, id: string) => {
    const n = p.nodes[id];
    if (!n) return;
    if (n.font) out.add(n.font.family);
    n.children?.forEach((c) => visit(p, c));
    if (n.type === "instance" && n.componentId) {
      const found = findComponent(doc, n.componentId);
      found?.node.children?.forEach((c) => visit(found.page, c));
    }
  };
  ids.forEach((id) => visit(page, id));
  return out;
}

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fontFaceCss(families: Set<string>): Promise<string> {
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
      if (!families.has(family)) continue;
      const src = rule.style.getPropertyValue("src");
      const match = src.match(/url\(["']?([^"')]+\.woff2)["']?\)/) || src.match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) continue;
      // Solo el subconjunto latino (el que usan los textos en español)
      const range = rule.style.getPropertyValue("unicode-range");
      if (range && !/U\+0000/i.test(range)) continue;
      try {
        const url = new URL(match[1], sheet.href || location.href).href;
        if (!fontCache.has(url)) fontCache.set(url, await toDataUrl(url));
        rules.push(`@font-face{font-family:'${family}';font-style:${rule.style.getPropertyValue("font-style") || "normal"};font-weight:${rule.style.getPropertyValue("font-weight") || "400"};src:url(${fontCache.get(url)}) format('woff2');}`);
      } catch {
        // Sin la fuente se usa la del sistema
      }
    }
  }
  return rules.join("");
}

// ---------------------------------------------------------------------------
// SVG, PNG y PDF
// ---------------------------------------------------------------------------

export function exportBox(page: Page, ids: string[]): Box | null {
  const parents = parentMap(page);
  return unionBox(ids.map((id) => absoluteBox(page, id, parents)));
}

/** Dibuja los nodos con su posición absoluta, recortados a la caja. */
function exportSvgMarkup(doc: UxDocument, page: Page, ids: string[], box: Box, background: string | null): string {
  const parents = parentMap(page);
  const groups = ids.map((id, i) => {
    const abs = absoluteBox(page, id, parents);
    const n = page.nodes[id];
    return React.createElement("g", { key: id, transform: `translate(${abs.x - n.x - box.x} ${abs.y - n.y - box.y})` }, renderNode(id, { doc, page, prefix: `x${i}-` }));
  });
  return renderToStaticMarkup(
    React.createElement(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", width: box.w, height: box.h, viewBox: `0 0 ${box.w} ${box.h}` },
      background ? React.createElement("rect", { width: box.w, height: box.h, fill: background }) : null,
      ...groups
    )
  );
}

export async function exportSvg(doc: UxDocument, page: Page, ids: string[], background: string | null): Promise<string> {
  const box = exportBox(page, ids);
  if (!box) throw new Error("No hay nada que exportar.");
  let svg = exportSvgMarkup(doc, page, ids, box, background);
  const css = await fontFaceCss(usedFamilies(page, ids, doc));
  if (css) svg = svg.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
  return svg;
}

export async function exportRaster(doc: UxDocument, page: Page, ids: string[], scale: number, format: "png" | "jpeg", background: string | null): Promise<Blob> {
  const box = exportBox(page, ids);
  if (!box) throw new Error("No hay nada que exportar.");
  const svg = await exportSvg(doc, page, ids, background ?? (format === "jpeg" ? "#ffffff" : null));
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo dibujar la imagen."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen."))), `image/${format}`, 0.92));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** PDF con una página por marco. */
export async function exportPdf(doc: UxDocument, page: Page, frameIds: string[]): Promise<Blob> {
  if (!frameIds.length) throw new Error("No hay marcos que exportar.");
  let pdf: jsPDF | null = null;
  for (const id of frameIds) {
    const n = page.nodes[id];
    const blob = await exportRaster(doc, page, [id], 2, "png", null);
    const data = new Uint8Array(await blob.arrayBuffer());
    const wPt = n.w * 0.75;
    const hPt = n.h * 0.75;
    const orientation = wPt > hPt ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ unit: "pt", format: [wPt, hPt], orientation });
    else pdf.addPage([wPt, hPt], orientation);
    pdf.addImage(data, "PNG", 0, 0, wPt, hPt);
  }
  pdf!.setProperties({ title: page.name, creator: "CoffeeUI/UX" });
  return pdf!.output("blob");
}

// ---------------------------------------------------------------------------
// Código
// ---------------------------------------------------------------------------

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (alpha >= 1) return `#${full.toLowerCase()}`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${+alpha.toFixed(2)})`;
};

export function paintCss(p: Paint): string {
  if (p.type === "linear") return `linear-gradient(${p.angle}deg, ${hexToRgba(p.color, p.opacity)}, ${hexToRgba(p.color2, p.opacity)})`;
  if (p.type === "radial") return `radial-gradient(circle, ${hexToRgba(p.color, p.opacity)}, ${hexToRgba(p.color2, p.opacity)})`;
  return hexToRgba(p.color, p.opacity);
}

const JUSTIFY: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", "space-between": "space-between" };
const ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end" };

/** Estilos CSS de un nodo (lo que muestra el panel «Código»). */
export function nodeCss(n: UNode, inLayout = false, root = false): Record<string, string> {
  const css: Record<string, string> = {};
  if (!root) {
    if (inLayout) {
      if (n.sizing.w === "fill") css.flex = "1 1 0";
    } else {
      css.position = "absolute";
      css.left = `${Math.round(n.x)}px`;
      css.top = `${Math.round(n.y)}px`;
    }
  } else css.position = "relative";
  const textAuto = n.type === "text" && n.font?.autoSize === "width";
  if (!(inLayout && n.sizing.w === "fill") && !(n.layout?.mode !== "none" && n.sizing.w === "hug") && !textAuto) css.width = `${Math.round(n.w)}px`;
  if (!(inLayout && n.sizing.h === "fill") && !(n.layout?.mode !== "none" && n.sizing.h === "hug") && n.type !== "text") css.height = `${Math.round(n.h)}px`;
  if (inLayout && n.sizing.h === "fill") css["align-self"] = "stretch";
  if (n.type === "text" && n.font) {
    const f = n.font;
    css["font-family"] = `'${f.family}', sans-serif`;
    css["font-size"] = `${f.size}px`;
    css["font-weight"] = String(f.weight);
    if (f.italic) css["font-style"] = "italic";
    css["line-height"] = `${Math.round(f.size * f.lineHeight)}px`;
    if (f.letterSpacing) css["letter-spacing"] = `${f.letterSpacing}px`;
    if (f.align !== "left") css["text-align"] = f.align;
    if (f.transform !== "none") css["text-transform"] = f.transform;
    const deco = [f.underline && "underline", f.strike && "line-through"].filter(Boolean).join(" ");
    if (deco) css["text-decoration"] = deco;
    if (n.fill) css.color = n.fill.type === "solid" ? hexToRgba(n.fill.color, n.fill.opacity) : hexToRgba(n.fill.color, 1);
    css.margin = "0";
    css["white-space"] = textAuto ? "pre" : "pre-wrap";
  } else if (n.fill && n.type !== "line" && n.type !== "path" && n.type !== "polygon" && n.type !== "star" && n.type !== "image") {
    css.background = paintCss(n.fill);
  }
  if (n.stroke && n.stroke.width > 0 && !["line", "path", "polygon", "star", "text"].includes(n.type))
    css.border = `${n.stroke.width}px ${n.stroke.dash ? "dashed" : "solid"} ${hexToRgba(n.stroke.color, n.stroke.opacity)}`;
  if (n.type === "ellipse") css["border-radius"] = "50%";
  else if (n.radius) css["border-radius"] = `${n.radius}px`;
  if (n.shadow) css["box-shadow"] = `${n.shadow.inner ? "inset " : ""}${n.shadow.x}px ${n.shadow.y}px ${n.shadow.blur}px ${hexToRgba(n.shadow.color, n.shadow.opacity)}`;
  if (n.blur) css.filter = `blur(${n.blur}px)`;
  if (n.opacity < 1) css.opacity = String(+n.opacity.toFixed(2));
  if (n.rotation) css.transform = `rotate(${n.rotation}deg)`;
  if ((n.type === "frame" || n.type === "component") && n.clip) css.overflow = "hidden";
  if (n.layout && n.layout.mode !== "none") {
    const L = n.layout;
    css.display = "flex";
    css["flex-direction"] = L.mode;
    if (L.gap && L.justify !== "space-between") css.gap = `${L.gap}px`;
    const p = L.padding;
    if (p.top || p.right || p.bottom || p.left) css.padding = `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
    css["justify-content"] = JUSTIFY[L.justify];
    css["align-items"] = ALIGN[L.align];
    css["box-sizing"] = "border-box";
  }
  if (n.type === "image") css["object-fit"] = n.fit === "fill" ? "fill" : n.fit || "cover";
  return css;
}

export const cssText = (css: Record<string, string>, indent = "  ") => Object.entries(css).map(([k, v]) => `${indent}${k}: ${v};`).join("\n");

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "capa";

/** Genera una página HTML con su CSS a partir de un marco. */
export function exportHtml(doc: UxDocument, page: Page, frameId: string): { html: string; css: string } {
  const rules: string[] = [];
  const used = new Map<string, number>();
  const className = (n: UNode) => {
    const base = slug(n.name);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count ? `${base}-${count + 1}` : base;
  };

  const emit = (p: Page, id: string, depth: number, inLayout: boolean, root: boolean, overrides?: UNode["overrides"]): string => {
    const original = p.nodes[id];
    if (!original) return "";
    const o = overrides?.[id];
    const n: UNode = { ...original, ...(o?.text !== undefined ? { text: o.text } : {}), ...(o?.fill !== undefined ? { fill: o.fill } : {}), ...(o?.visible !== undefined ? { visible: o.visible } : {}) };
    if (!n.visible) return "";
    const pad = "  ".repeat(depth);
    const cls = className(n);
    rules.push(`.${cls} {\n${cssText(nodeCss(n, inLayout, root))}\n}`);
    const childLayout = !!n.layout && n.layout.mode !== "none";
    switch (n.type) {
      case "text": {
        const tag = n.font && n.font.size >= 28 ? "h1" : n.font && n.font.size >= 20 ? "h2" : "p";
        return `${pad}<${tag} class="${cls}">${escapeHtml(n.text || "")}</${tag}>`;
      }
      case "image":
        return `${pad}<img class="${cls}" src="${n.src ? n.src : "imagen.png"}" alt="${escapeHtml(n.name)}" />`;
      case "line":
      case "path":
      case "polygon":
      case "star": {
        const color = n.stroke?.color || "#000";
        const sw = n.stroke?.width || 0;
        const fill = n.fill && n.type !== "line" && (n.type !== "path" || n.closed) ? paintCss(n.fill) : "none";
        const shape =
          n.type === "line"
            ? `<line x1="0" y1="0" x2="${n.w}" y2="${n.h}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" />`
            : n.type === "path"
              ? `<path d="${pathData(n)}" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" />`
              : `<polygon points="${polygonPoints(n)}" fill="${fill}" stroke="${n.stroke ? color : "none"}" stroke-width="${sw}" />`;
        return `${pad}<svg class="${cls}" viewBox="0 0 ${Math.max(1, n.w)} ${Math.max(1, n.h)}" overflow="visible">${shape}</svg>`;
      }
      case "instance": {
        const found = n.componentId ? findComponent(doc, n.componentId) : null;
        const kids = found ? (found.node.children || []).map((c) => emit(found.page, c, depth + 1, !!found.node.layout && found.node.layout.mode !== "none", false, n.overrides)) : [];
        if (found?.node.layout && found.node.layout.mode !== "none") {
          const extra = nodeCss({ ...found.node, x: n.x, y: n.y, w: n.w, h: n.h, sizing: n.sizing }, inLayout, root);
          rules[rules.length - 1] = `.${cls} {\n${cssText(extra)}\n}`;
        }
        return `${pad}<div class="${cls}">\n${kids.filter(Boolean).join("\n")}\n${pad}</div>`;
      }
      default: {
        const kids = (n.children || []).map((c) => emit(p, c, depth + 1, childLayout, false, overrides)).filter(Boolean);
        const tag = depth === 0 ? "main" : "div";
        return kids.length ? `${pad}<${tag} class="${cls}">\n${kids.join("\n")}\n${pad}</${tag}>` : `${pad}<${tag} class="${cls}"></${tag}>`;
      }
    }
  };

  const body = emit(page, frameId, 2, false, true);
  const frame = page.nodes[frameId];
  const css = `* { box-sizing: border-box; }\nbody {\n  margin: 0;\n  font-family: 'Hanken Grotesk', 'Segoe UI', sans-serif;\n  background: ${page.background};\n  display: flex;\n  justify-content: center;\n}\n\n${rules.join("\n\n")}\n`;
  const fonts = [...usedFamilies(page, [frameId], doc)].filter((f) => f === "Hanken Grotesk" || f === "JetBrains Mono");
  const link = fonts.length
    ? `    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts.map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700;800`).join("&")}&display=swap" />\n`
    : "";
  const html = `<!DOCTYPE html>\n<html lang="es">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${escapeHtml(frame?.name || "Diseño")}</title>\n${link}    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n${body}\n  </body>\n</html>\n`;
  return { html, css };
}

/** Una sola página HTML con el CSS incrustado (para abrirla directamente). */
export function exportHtmlSingle(doc: UxDocument, page: Page, frameId: string): string {
  const { html, css } = exportHtml(doc, page, frameId);
  return html.replace('    <link rel="stylesheet" href="styles.css" />\n', `    <style>\n${css}    </style>\n`);
}
