// Intercambio con Microsoft PowerPoint (.pptx).
//
// Exportación con `pptxgenjs` (cuadros de texto, formas, imágenes, tablas,
// líneas, fondos y notas del orador) e importación básica leyendo el XML del
// paquete con JSZip (textos, imágenes, tablas, fondos y notas).

import type { Presentation, ShapeType, Slide, SlideElement } from "../types";
import { bytesToBase64 } from "./desktop";
import { createBlankPresentation, isDarkColor, newId, themeById } from "./presentationVault";

const hex = (color: string | undefined, fallback: string): string => {
  const value = color || fallback;
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  return match ? match[1].toUpperCase() : fallback.replace("#", "").toUpperCase();
};

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

export async function exportPptx(presentation: Presentation): Promise<Uint8Array> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const wide = presentation.metadata.aspectRatio !== "4:3";
  pptx.layout = wide ? "LAYOUT_16x9" : "LAYOUT_4x3";
  pptx.title = presentation.metadata.title;
  pptx.author = presentation.metadata.author;

  const slideWidth = 10;
  const slideHeight = wide ? 5.625 : 7.5;
  // La diapositiva lógica mide 960 px de ancho = 10 pulgadas: 1 px = 0,75 pt
  const points = (px: number) => Math.round(px * 0.75 * 10) / 10;
  const theme = themeById(presentation.metadata.themeId);

  const shapeNames: Record<ShapeType, string> = {
    rectangle: "rect",
    rounded: "roundRect",
    circle: "ellipse",
    triangle: "triangle",
    "arrow-right": "rightArrow",
    star: "star5",
    diamond: "diamond",
    callout: "wedgeRectCallout",
  };

  for (const slide of presentation.slides) {
    const target = pptx.addSlide();
    target.background = { color: hex(slide.background, theme.slideBg) };
    if (slide.hidden) target.hidden = true;
    if (slide.notes.trim()) target.addNotes(slide.notes);

    for (const el of slide.elements) {
      const box = {
        x: (el.x / 100) * slideWidth,
        y: (el.y / 100) * slideHeight,
        w: Math.max(0.05, (el.width / 100) * slideWidth),
        h: Math.max(0.05, (el.height / 100) * slideHeight),
      };
      const isTitle = el.type === "title";
      const textOptions = {
        ...box,
        fontSize: points(el.fontSize || (isTitle ? 40 : 20)),
        fontFace: el.fontFamily || theme.fontFamily,
        bold: (el.fontWeight || (isTitle ? "bold" : "normal")) === "bold",
        italic: el.fontStyle === "italic",
        underline: el.underline ? { style: "sng" as const } : undefined,
        color: hex(el.color, isTitle ? theme.titleColor : theme.textColor),
        align: (el.align || "center") as "left" | "center" | "right" | "justify",
        valign: (el.valign || "middle") as "top" | "middle" | "bottom",
        margin: 6,
        fit: "shrink" as const,
      };

      switch (el.type) {
        case "image": {
          if (el.content.startsWith("data:")) {
            target.addImage({ data: el.content.replace(/^data:/, ""), ...box, sizing: { type: "contain", w: box.w, h: box.h } });
          } else if (el.content) {
            target.addImage({ path: el.content, ...box, sizing: { type: "contain", w: box.w, h: box.h } });
          }
          break;
        }
        case "video": {
          // PowerPoint necesita el archivo de vídeo incrustado; se deja su enlace
          target.addText(`Vídeo: ${el.content.startsWith("data:") ? "(archivo incrustado en CoffeView)" : el.content}`, {
            ...textOptions,
            fontSize: 12,
            color: "5F6368",
            fill: { color: "F1F3F4" },
            hyperlink: el.content.startsWith("http") ? { url: el.content } : undefined,
          });
          break;
        }
        case "line": {
          target.addShape("line", {
            ...box,
            flipV: Boolean(el.flip),
            line: { color: hex(el.color, theme.textColor), width: el.borderWidth || 3 },
          });
          break;
        }
        case "table": {
          const rows = (el.rows || []).map((row, r) =>
            row.map((cell) => ({
              text: cell,
              options: {
                bold: r === 0,
                color: r === 0 ? "FFFFFF" : hex(el.color, theme.textColor),
                fill: { color: r === 0 ? hex(undefined, theme.accentColor) : hex(el.bg, "#ffffff") },
              },
            }))
          );
          if (rows.length > 0) {
            target.addTable(rows, {
              x: box.x,
              y: box.y,
              w: box.w,
              fontSize: points(el.fontSize || 16),
              fontFace: el.fontFamily || theme.fontFamily,
              border: { type: "solid", color: "BDC1C6", pt: 1 },
              rowH: box.h / rows.length,
            });
          }
          break;
        }
        case "shape": {
          const fill = hex(el.bg, theme.accentColor);
          target.addText(el.content || "", {
            ...textOptions,
            shape: shapeNames[el.shapeType || "rectangle"] as never,
            fill: { color: fill },
            line: el.borderWidth ? { color: hex(el.borderColor, "#000000"), width: el.borderWidth } : undefined,
            color: hex(el.color, isDarkColor(`#${fill}`) ? "#ffffff" : "#1f1f1f"),
          });
          break;
        }
        default: {
          if (!el.content && !el.bg) break;
          target.addText(el.content, {
            ...textOptions,
            fill: el.bg ? { color: hex(el.bg, "#ffffff") } : undefined,
          });
        }
      }
    }
  }

  const output = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
  return output;
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

const EMU_FALLBACK = { cx: 9144000, cy: 5143500 };

function children(node: Element | Document, localName: string): Element[] {
  return Array.from(node.getElementsByTagName("*")).filter((el) => el.localName === localName);
}

function firstChild(node: Element | Document, localName: string): Element | null {
  return children(node, localName)[0] || null;
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  webp: "image/webp",
};

export async function importPptx(bytes: Uint8Array, title: string): Promise<Presentation> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const parser = new DOMParser();

  const readXml = async (path: string): Promise<Document | null> => {
    const file = zip.file(path);
    return file ? parser.parseFromString(await file.async("string"), "application/xml") : null;
  };
  const readRels = async (path: string): Promise<Map<string, { target: string; type: string }>> => {
    const folder = path.split("/").slice(0, -1).join("/");
    const name = path.split("/").pop();
    const doc = await readXml(`${folder}/_rels/${name}.rels`);
    const map = new Map<string, { target: string; type: string }>();
    if (doc) {
      for (const rel of children(doc, "Relationship")) {
        map.set(rel.getAttribute("Id") || "", {
          target: resolvePath(path, rel.getAttribute("Target") || ""),
          type: rel.getAttribute("Type") || "",
        });
      }
    }
    return map;
  };

  const presentationXml = await readXml("ppt/presentation.xml");
  if (!presentationXml) throw new Error("El archivo no es una presentación de PowerPoint válida");

  const sizeNode = firstChild(presentationXml, "sldSz");
  const cx = Number(sizeNode?.getAttribute("cx")) || EMU_FALLBACK.cx;
  const cy = Number(sizeNode?.getAttribute("cy")) || EMU_FALLBACK.cy;
  const presentationRels = await readRels("ppt/presentation.xml");
  const slidePaths = children(presentationXml, "sldId")
    .map((node) => presentationRels.get(node.getAttribute("r:id") || node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "")?.target)
    .filter((path): path is string => Boolean(path));

  const presentation = createBlankPresentation(title);
  presentation.metadata.aspectRatio = cx / cy < 1.5 ? "4:3" : "16:9";
  const slides: Slide[] = [];

  const colorOf = (node: Element | null): string | undefined => {
    const srgb = node ? firstChild(node, "srgbClr") : null;
    const value = srgb?.getAttribute("val");
    return value ? `#${value.toLowerCase()}` : undefined;
  };

  for (const path of slidePaths) {
    const doc = await readXml(path);
    if (!doc) continue;
    const rels = await readRels(path);
    const elements: SlideElement[] = [];
    let placeholderIndex = 0;

    const boxOf = (node: Element): [number, number, number, number] | null => {
      const xfrm = firstChild(node, "xfrm");
      const off = xfrm ? firstChild(xfrm, "off") : null;
      const ext = xfrm ? firstChild(xfrm, "ext") : null;
      if (!off || !ext) return null;
      return [
        (Number(off.getAttribute("x")) / cx) * 100,
        (Number(off.getAttribute("y")) / cy) * 100,
        (Number(ext.getAttribute("cx")) / cx) * 100,
        (Number(ext.getAttribute("cy")) / cy) * 100,
      ];
    };

    const tree = firstChild(doc, "spTree");
    for (const node of tree ? Array.from(tree.children) : []) {
      if (node.localName === "sp") {
        const placeholder = firstChild(node, "ph");
        const phType = placeholder?.getAttribute("type") || (placeholder ? "body" : "");
        const paragraphs = children(node, "p").map((p) =>
          children(p, "t")
            .map((t) => t.textContent || "")
            .join("")
        );
        const text = paragraphs.join("\n").trim();
        const shapeProps = firstChild(node, "spPr");
        const fill = shapeProps ? colorOf(Array.from(shapeProps.children).find((c) => c.localName === "solidFill") || null) : undefined;
        if (!text && !fill) continue;

        const runProps = firstChild(node, "rPr");
        const size = Number(runProps?.getAttribute("sz")) || 0;
        const type: SlideElement["type"] =
          phType === "title" || phType === "ctrTitle" ? "title" : phType === "subTitle" ? "subtitle" : fill && !placeholder ? "shape" : "text";
        // Los marcadores sin posición propia la heredan del patrón: se colocan por tipo
        let box = boxOf(node);
        if (!box) {
          box = type === "title" ? [6, 7, 88, 16] : type === "subtitle" ? [15, 54, 70, 14] : [6, 26 + placeholderIndex * 4, 88, 60];
          if (type !== "title") placeholderIndex++;
        }
        const algn = firstChild(node, "pPr")?.getAttribute("algn");
        const geometry = firstChild(node, "prstGeom")?.getAttribute("prst") || "";
        const shapeType: ShapeType =
          geometry === "ellipse" ? "circle" : geometry === "roundRect" ? "rounded" : geometry === "triangle" ? "triangle" : geometry === "rightArrow" ? "arrow-right" : geometry.startsWith("star") ? "star" : geometry === "diamond" ? "diamond" : geometry.startsWith("wedge") ? "callout" : "rectangle";
        elements.push({
          id: newId("el"),
          type,
          x: box[0],
          y: box[1],
          width: box[2],
          height: box[3],
          content: text,
          fontSize: size ? Math.round((size / 100) * (4 / 3)) : type === "title" ? 36 : 20,
          fontWeight: runProps?.getAttribute("b") === "1" || type === "title" ? "bold" : "normal",
          fontStyle: runProps?.getAttribute("i") === "1" ? "italic" : "normal",
          color: colorOf(runProps),
          bg: fill,
          align: algn === "ctr" ? "center" : algn === "r" ? "right" : algn === "just" ? "justify" : type === "shape" ? "center" : "left",
          valign: type === "text" ? "top" : "middle",
          shapeType: type === "shape" ? shapeType : undefined,
        });
      } else if (node.localName === "pic") {
        const blip = firstChild(node, "blip");
        const relId = blip?.getAttribute("r:embed") || blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") || "";
        const target = rels.get(relId)?.target;
        const file = target ? zip.file(target) : null;
        const box = boxOf(node);
        if (!file || !box || !target) continue;
        const extension = target.split(".").pop()?.toLowerCase() || "png";
        const mime = MIME_TYPES[extension];
        if (!mime) continue;
        const data = await file.async("uint8array");
        elements.push({
          id: newId("el"),
          type: "image",
          x: box[0],
          y: box[1],
          width: box[2],
          height: box[3],
          content: `data:${mime};base64,${bytesToBase64(data)}`,
        });
      } else if (node.localName === "graphicFrame") {
        const table = firstChild(node, "tbl");
        const box = boxOf(node);
        if (!table || !box) continue;
        const rows = children(table, "tr").map((tr) =>
          children(tr, "tc").map((tc) =>
            children(tc, "t")
              .map((t) => t.textContent || "")
              .join("")
          )
        );
        elements.push({
          id: newId("el"),
          type: "table",
          x: box[0],
          y: box[1],
          width: box[2],
          height: box[3],
          content: "",
          rows,
          fontSize: 16,
        });
      } else if (node.localName === "cxnSp") {
        const box = boxOf(node);
        if (!box) continue;
        const line = firstChild(node, "ln");
        elements.push({
          id: newId("el"),
          type: "line",
          x: box[0],
          y: box[1],
          width: Math.max(0.5, box[2]),
          height: Math.max(0.5, box[3]),
          content: "",
          color: colorOf(line) || "#444746",
          borderWidth: Math.max(1, Math.round((Number(line?.getAttribute("w")) || 12700) / 12700)),
          flip: firstChild(node, "xfrm")?.getAttribute("flipV") === "1",
        });
      }
    }

    // Notas del orador
    let notes = "";
    for (const rel of rels.values()) {
      if (rel.type.endsWith("/notesSlide")) {
        const notesDoc = await readXml(rel.target);
        if (notesDoc) {
          notes = children(notesDoc, "sp")
            .filter((sp) => firstChild(sp, "ph")?.getAttribute("type") === "body")
            .map((sp) =>
              children(sp, "p")
                .map((p) => children(p, "t").map((t) => t.textContent || "").join(""))
                .join("\n")
            )
            .join("\n")
            .trim();
        }
      }
    }

    const background = colorOf(firstChild(doc, "bg"));
    slides.push({
      id: newId("slide"),
      layout: "blank",
      background,
      elements,
      notes,
      transition: "fade",
      hidden: firstChild(doc, "sld")?.getAttribute("show") === "0",
    });
  }

  if (slides.length === 0) throw new Error("La presentación no contiene diapositivas");
  return { ...presentation, slides };
}
