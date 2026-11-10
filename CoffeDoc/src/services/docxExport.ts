// Exportación a Microsoft Word (.docx) real.
//
// Recorre el HTML del documento y lo convierte en un paquete OOXML con la
// biblioteca `docx`: párrafos, títulos, listas anidadas, tablas, imágenes,
// enlaces y formato de carácter (negrita, color, tamaño, fuente, resaltado).

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import type { PageSettings } from "../types";
import { MARGIN_PIXELS, PAGE_DIMENSIONS } from "../types";

type BlockChild = Paragraph | Table;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  size?: number;
  font?: string;
  superScript?: boolean;
  subScript?: boolean;
}

interface LoadedImage {
  data: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
  width: number;
  height: number;
}

interface Context {
  images: Map<string, LoadedImage>;
  listInstance: number;
  /** Ancho útil de la página en píxeles, para ajustar imágenes grandes. */
  contentWidth: number;
}

const BLOCK_TAGS = new Set([
  "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE",
  "PRE", "TABLE", "HR", "SECTION", "ARTICLE", "HEADER", "FOOTER", "FIGURE",
]);

const HEADINGS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

let colorCanvas: CanvasRenderingContext2D | null = null;

/** Convierte cualquier color CSS a hexadecimal RRGGBB (sin almohadilla). */
export function cssColorToHex(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  const value = color.trim();
  if (!value || value === "transparent" || value === "inherit" || value === "initial") {
    return undefined;
  }
  if (!colorCanvas) {
    colorCanvas = document.createElement("canvas").getContext("2d");
  }
  if (!colorCanvas) return undefined;
  colorCanvas.fillStyle = "#000000";
  colorCanvas.fillStyle = value;
  const normalized = colorCanvas.fillStyle;
  if (normalized.startsWith("#")) {
    return normalized.slice(1, 7).toUpperCase();
  }
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(normalized);
  if (!match) return undefined;
  if (match[4] !== undefined && Number(match[4]) === 0) return undefined;
  return [match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Tamaño de fuente CSS a medios puntos de Word. */
function fontSizeToHalfPoints(value: string): number | undefined {
  const match = /^([\d.]+)(pt|px|em|rem)?$/.exec(value.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!amount) return undefined;
  switch (match[2]) {
    case "pt":
      return Math.round(amount * 2);
    case "em":
    case "rem":
      return Math.round(amount * 11 * 2);
    default:
      return Math.round(amount * 0.75 * 2);
  }
}

const LEGACY_FONT_SIZES: Record<string, number> = {
  "1": 16, "2": 20, "3": 24, "4": 28, "5": 36, "6": 48, "7": 72,
};

function styleForElement(el: HTMLElement, inherited: RunStyle): RunStyle {
  const style: RunStyle = { ...inherited };
  const tag = el.tagName;

  if (tag === "B" || tag === "STRONG" || tag === "TH") style.bold = true;
  if (tag === "I" || tag === "EM" || tag === "CITE") style.italics = true;
  if (tag === "U" || tag === "INS") style.underline = true;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") style.strike = true;
  if (tag === "SUP") style.superScript = true;
  if (tag === "SUB") style.subScript = true;
  if (tag === "MARK") style.highlight = style.highlight || "FFF59D";
  if (tag === "CODE" || tag === "KBD" || tag === "PRE") style.font = "Courier New";
  if (tag === "FONT") {
    const face = el.getAttribute("face");
    const size = el.getAttribute("size");
    const color = el.getAttribute("color");
    if (face) style.font = face.split(",")[0].replace(/['"]/g, "").trim();
    if (size && LEGACY_FONT_SIZES[size]) style.size = LEGACY_FONT_SIZES[size];
    if (color) style.color = cssColorToHex(color) || style.color;
  }

  const css = el.style;
  if (css.fontWeight) {
    const weight = css.fontWeight;
    style.bold = weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  }
  if (css.fontStyle) style.italics = css.fontStyle === "italic";
  const decoration = `${css.textDecoration} ${css.textDecorationLine}`;
  if (decoration.includes("underline")) style.underline = true;
  if (decoration.includes("line-through")) style.strike = true;
  if (css.color) style.color = cssColorToHex(css.color) || style.color;
  if (css.backgroundColor && !BLOCK_TAGS.has(tag) && tag !== "TD" && tag !== "TH") {
    style.highlight = cssColorToHex(css.backgroundColor) || style.highlight;
  }
  if (css.fontSize) style.size = fontSizeToHalfPoints(css.fontSize) || style.size;
  if (css.fontFamily) {
    style.font = css.fontFamily.split(",")[0].replace(/['"]/g, "").trim() || style.font;
  }
  if (css.verticalAlign === "super") style.superScript = true;
  if (css.verticalAlign === "sub") style.subScript = true;

  return style;
}

function runOptions(style: RunStyle): Partial<IRunOptions> {
  return {
    bold: style.bold,
    italics: style.italics,
    underline: style.underline ? {} : undefined,
    strike: style.strike,
    color: style.color,
    size: style.size,
    font: style.font,
    superScript: style.superScript,
    subScript: style.subScript,
    shading: style.highlight
      ? { type: ShadingType.CLEAR, color: "auto", fill: style.highlight }
      : undefined,
  };
}

function alignmentOf(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = el.style.textAlign || el.getAttribute("align") || "";
  switch (align.toLowerCase()) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
    case "end":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "left":
    case "start":
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

function isBlock(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName);
}

/** Convierte nodos en línea en "runs" de Word. */
function inlineRuns(nodes: Node[], style: RunStyle, ctx: Context): ParagraphChild[] {
  const runs: ParagraphChild[] = [];

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").replace(/\s+/g, " ");
      if (text) runs.push(new TextRun({ text, ...runOptions(style) }));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === "BR") {
      runs.push(new TextRun({ break: 1, ...runOptions(style) }));
      continue;
    }
    if (tag === "IMG") {
      const image = ctx.images.get(el.getAttribute("src") || "");
      if (image) {
        const requested = parseFloat(el.style.width || el.getAttribute("width") || "0");
        let width = requested > 0 && !el.style.width.endsWith("%") ? requested : image.width;
        if (el.style.width.endsWith("%")) {
          width = (ctx.contentWidth * parseFloat(el.style.width)) / 100;
        }
        width = Math.min(width, ctx.contentWidth);
        const height = Math.round((width / image.width) * image.height);
        runs.push(
          new ImageRun({
            type: image.type,
            data: image.data,
            transformation: { width: Math.round(width), height },
          })
        );
      }
      continue;
    }
    if (tag === "A" && el.getAttribute("href")) {
      const linkStyle: RunStyle = { ...styleForElement(el, style), color: "0B57D0", underline: true };
      const children = inlineRuns(Array.from(el.childNodes), linkStyle, ctx);
      runs.push(new ExternalHyperlink({ link: el.getAttribute("href") || "", children }));
      continue;
    }
    if (tag === "INPUT" && (el as HTMLInputElement).type === "checkbox") {
      runs.push(
        new TextRun({ text: (el as HTMLInputElement).checked ? "☑ " : "☐ ", ...runOptions(style) })
      );
      continue;
    }

    runs.push(...inlineRuns(Array.from(el.childNodes), styleForElement(el, style), ctx));
  }

  return runs;
}

interface BlockOptions {
  style: RunStyle;
  paragraph: Partial<IParagraphOptions>;
}

/** Agrupa nodos mezclados: los tramos en línea forman un párrafo implícito. */
function convertChildren(parent: Node, options: BlockOptions, ctx: Context): BlockChild[] {
  const blocks: BlockChild[] = [];
  let pending: Node[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    const hasContent = pending.some(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent || "").trim() !== ""
    );
    if (hasContent) {
      blocks.push(
        new Paragraph({ ...options.paragraph, children: inlineRuns(pending, options.style, ctx) })
      );
    }
    pending = [];
  };

  for (const child of Array.from(parent.childNodes)) {
    if (isBlock(child)) {
      flush();
      blocks.push(...convertBlock(child as HTMLElement, options, ctx));
    } else {
      pending.push(child);
    }
  }
  flush();
  return blocks;
}

function convertList(
  list: HTMLElement,
  level: number,
  options: BlockOptions,
  ctx: Context
): BlockChild[] {
  const blocks: BlockChild[] = [];
  const ordered = list.tagName === "OL";
  const instance = ++ctx.listInstance;

  for (const item of Array.from(list.children)) {
    if (item.tagName !== "LI") {
      if (item.tagName === "UL" || item.tagName === "OL") {
        blocks.push(...convertList(item as HTMLElement, level + 1, options, ctx));
      }
      continue;
    }
    const li = item as HTMLElement;
    const inlineNodes: Node[] = [];
    const nested: HTMLElement[] = [];
    for (const child of Array.from(li.childNodes)) {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        ((child as HTMLElement).tagName === "UL" || (child as HTMLElement).tagName === "OL")
      ) {
        nested.push(child as HTMLElement);
      } else if (isBlock(child)) {
        // Párrafos dentro del elemento de lista: se aplanan a su contenido
        inlineNodes.push(...Array.from(child.childNodes));
      } else {
        inlineNodes.push(child);
      }
    }

    const style = styleForElement(li, options.style);
    blocks.push(
      new Paragraph({
        ...options.paragraph,
        alignment: alignmentOf(li) ?? options.paragraph.alignment,
        children: inlineRuns(inlineNodes, style, ctx),
        ...(ordered
          ? { numbering: { reference: "cfd-numbered", level: Math.min(level, 8), instance } }
          : { bullet: { level: Math.min(level, 8) } }),
      })
    );
    for (const sub of nested) {
      blocks.push(...convertList(sub, level + 1, options, ctx));
    }
  }
  return blocks;
}

function convertTable(table: HTMLElement, options: BlockOptions, ctx: Context): BlockChild[] {
  const rows: TableRow[] = [];
  const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };

  for (const tr of Array.from(table.querySelectorAll("tr"))) {
    if (tr.closest("table") !== table) continue;
    const cells: TableCell[] = [];
    for (const cellEl of Array.from(tr.children)) {
      if (cellEl.tagName !== "TD" && cellEl.tagName !== "TH") continue;
      const cell = cellEl as HTMLTableCellElement;
      const isHeader = cell.tagName === "TH";
      const style = styleForElement(cell, { ...options.style, bold: isHeader || options.style.bold });
      const content = convertChildren(
        cell,
        { style, paragraph: { alignment: alignmentOf(cell), spacing: { before: 40, after: 40 } } },
        ctx
      );
      const fill = cssColorToHex(cell.style.backgroundColor) || (isHeader ? "F1F3F4" : undefined);
      cells.push(
        new TableCell({
          children: content.length > 0 ? content : [new Paragraph({})],
          columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
          shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          borders: { top: border, bottom: border, left: border, right: border },
        })
      );
    }
    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
  }

  if (rows.length === 0) return [];
  return [
    new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({}),
  ];
}

function convertBlock(el: HTMLElement, options: BlockOptions, ctx: Context): BlockChild[] {
  const tag = el.tagName;
  if (el.hasAttribute("data-page-break")) {
    return [new Paragraph({ children: [new PageBreak()] })];
  }
  const style = styleForElement(el, options.style);
  const alignment = alignmentOf(el) ?? options.paragraph.alignment;

  if (HEADINGS[tag]) {
    return [
      new Paragraph({
        heading: HEADINGS[tag],
        alignment,
        children: inlineRuns(Array.from(el.childNodes), { ...style, bold: undefined }, ctx),
      }),
    ];
  }
  if (tag === "UL" || tag === "OL") {
    return convertList(el, 0, { ...options, style }, ctx);
  }
  if (tag === "TABLE") {
    return convertTable(el, options, ctx);
  }
  if (tag === "HR") {
    return [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF", space: 1 } },
        children: [],
      }),
    ];
  }
  if (tag === "PRE") {
    const lines = (el.textContent || "").replace(/\n$/, "").split("\n");
    return lines.map(
      (line) =>
        new Paragraph({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "F5F5F5" },
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: line, font: "Courier New", size: 20 })],
        })
    );
  }
  if (tag === "BLOCKQUOTE") {
    return convertChildren(
      el,
      {
        style: { ...style, italics: true, color: style.color || "5F6368" },
        paragraph: {
          ...options.paragraph,
          alignment,
          indent: { left: 567 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: "DADCE0", space: 12 } },
        },
      },
      ctx
    );
  }

  const indent = parseFloat(el.style.marginLeft || el.style.paddingLeft || "0");
  const paragraph: Partial<IParagraphOptions> = {
    ...options.paragraph,
    alignment,
    ...(indent > 0
      ? { indent: { ...(options.paragraph.indent || {}), left: Math.round(indent * 15) } }
      : {}),
  };

  const hasBlockChildren = Array.from(el.childNodes).some(isBlock);
  if (hasBlockChildren) {
    return convertChildren(el, { style, paragraph }, ctx);
  }

  const children = inlineRuns(Array.from(el.childNodes), style, ctx);
  // Un bloque vacío (<p><br></p>) representa una línea en blanco
  return [new Paragraph({ ...paragraph, children })];
}

function imageTypeOf(mime: string, src: string): LoadedImage["type"] | null {
  const hint = `${mime} ${src.slice(0, 80)}`.toLowerCase();
  if (hint.includes("png")) return "png";
  if (hint.includes("jpeg") || hint.includes("jpg")) return "jpg";
  if (hint.includes("gif")) return "gif";
  if (hint.includes("bmp")) return "bmp";
  return null;
}

function measureImage(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Descarga y mide las imágenes del documento antes de construir el .docx. */
async function loadImages(root: HTMLElement): Promise<Map<string, LoadedImage>> {
  const images = new Map<string, LoadedImage>();
  const sources = new Set<string>();
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) sources.add(src);
  });

  await Promise.all(
    Array.from(sources).map(async (src) => {
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        const type = imageTypeOf(blob.type, src);
        if (!type) return;
        const size = await measureImage(src);
        if (!size) return;
        images.set(src, {
          data: new Uint8Array(await blob.arrayBuffer()),
          type,
          width: size.width,
          height: size.height,
        });
      } catch {
        // Imagen remota inaccesible: se omite en la exportación.
      }
    })
  );
  return images;
}

const pxToTwip = (px: number) => Math.round(px * 15);

/** Genera el archivo .docx a partir del HTML de las secciones del documento. */
export async function htmlToDocx(
  sections: string[],
  settings: PageSettings,
  info: { title: string; author: string }
): Promise<Uint8Array> {
  const root = document.createElement("div");
  root.innerHTML = sections.join('<p data-page-break="1"></p>');

  const dims = PAGE_DIMENSIONS[settings.pageSize];
  const landscape = settings.orientation === "landscape";
  const pageWidth = landscape ? dims.height : dims.width;
  const margin = MARGIN_PIXELS[settings.margins];

  const ctx: Context = {
    images: await loadImages(root),
    listInstance: 0,
    contentWidth: pageWidth - margin * 2,
  };

  const lineSpacing = Math.round((Number(settings.lineSpacing) || 1.15) * 240);
  const children = convertChildren(
    root,
    { style: {}, paragraph: { spacing: { line: lineSpacing, after: 120 } } },
    ctx
  );

  const body = children.length > 0 ? children : [new Paragraph({})];

  const doc = new Document({
    creator: info.author,
    title: info.title,
    description: "Documento creado con CoffeDoc",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 } },
        heading1: {
          run: { font: "Arial", size: 40, bold: true, color: "1F1F1F" },
          paragraph: { spacing: { before: 400, after: 120 } },
        },
        heading2: {
          run: { font: "Arial", size: 32, bold: true, color: "1F1F1F" },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        heading3: {
          run: { font: "Arial", size: 28, bold: true, color: "434343" },
          paragraph: { spacing: { before: 320, after: 80 } },
        },
        heading4: {
          run: { font: "Arial", size: 24, bold: true, color: "666666" },
          paragraph: { spacing: { before: 280, after: 80 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "cfd-numbered",
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format:
              level % 3 === 0
                ? LevelFormat.DECIMAL
                : level % 3 === 1
                ? LevelFormat.LOWER_LETTER
                : LevelFormat.LOWER_ROMAN,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pxToTwip(dims.width),
              height: pxToTwip(dims.height),
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: pxToTwip(margin),
              bottom: pxToTwip(margin),
              left: pxToTwip(margin),
              right: pxToTwip(margin),
            },
          },
          column: settings.columns > 1 ? { count: settings.columns, space: 708 } : undefined,
        },
        children: body,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
