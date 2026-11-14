// Herramientas de CoffeeConvert: qué aceptan, sus opciones y cómo producen los archivos.

import { csvToBlocks, htmlToBlocks, markdownToBlocks, textToBlocks } from "./blocks";
import { blocksToPdf, compressBasic, imagesToPdf, mergePdfs, numberPages, reorderPages, rotatePages, splitPdf, watermark } from "./organize";
import { pdfToDocx, pdfToPptx, pdfToText, pdfToXlsx } from "./office";
import { canvasBytes, openPdf, readPages, renderPage } from "./pdfReader";
import { toEmbeddable } from "./media";
import { ocrImage, officeToPdf } from "./native";
import { outputName, parseRanges } from "./ranges";

export interface InputFile {
  name: string;
  bytes: Uint8Array;
}

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
}

export type Group = "desde" | "hacia" | "organizar" | "ocr";

export interface OptionDef {
  id: string;
  label: string;
  kind: "select" | "text" | "number";
  choices?: { value: string; label: string }[];
  default: string;
  placeholder?: string;
  hint?: string;
}

export interface Tool {
  id: string;
  group: Group;
  title: string;
  description: string;
  /** Extensiones que acepta (en minúscula, sin punto). */
  accepts: string[];
  multiple: boolean;
  /** Archivos mínimos (unir pide 2). */
  min?: number;
  options?: OptionDef[];
  /** Complemento necesario (se comprueba antes de convertir). */
  addon?: "officeconv" | "pdfcheck";
  run: (files: InputFile[], opts: Record<string, string>, progress: (f: number, label: string) => void) => Promise<OutputFile[]>;
}

export const GROUPS: { id: Group; title: string }[] = [
  { id: "desde", title: "Convertir desde PDF" },
  { id: "hacia", title: "Convertir a PDF" },
  { id: "organizar", title: "Organizar PDF" },
  { id: "ocr", title: "Reconocer texto" },
];

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"];
export const OFFICE_EXT = ["docx", "doc", "xlsx", "xls", "pptx", "ppt", "odt", "ods", "odp", "rtf", "epub"];
const text = (b: Uint8Array) => new TextDecoder().decode(b);

/** Recorre cada PDF de entrada con su progreso. */
async function eachPdf(files: InputFile[], progress: (f: number, l: string) => void, fn: (f: InputFile, step: (x: number) => void) => Promise<OutputFile[]>) {
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    progress(i / files.length, files[i].name);
    out.push(...(await fn(files[i], (x) => progress((i + x) / files.length, files[i].name))));
  }
  progress(1, "");
  return out;
}

export const TOOLS: Tool[] = [
  {
    id: "pdf-pptx",
    group: "desde",
    title: "PDF a PowerPoint",
    description: "Cada página pasa a una diapositiva, con el texto editable o idéntica como imagen.",
    accepts: ["pdf"],
    multiple: true,
    options: [{ id: "mode", label: "Modo", kind: "select", default: "editable", choices: [{ value: "editable", label: "Editable (texto editable sobre el diseño)" }, { value: "image", label: "Fiel (cada página como imagen)" }, { value: "text", label: "Solo el texto (sin el diseño)" }] }],
    run: (files, o, p) =>
      eachPdf(files, p, async (f, step) => {
        const pages = await readPages(await openPdf(f.bytes), o.mode === "image" ? "page" : o.mode === "text" ? "none" : "background", step);
        return [{ name: outputName(f.name, "pptx"), bytes: await pdfToPptx(pages, o.mode === "image" ? "image" : "editable") }];
      }),
  },
  {
    id: "pdf-docx",
    group: "desde",
    title: "PDF a Word",
    description: "El texto en párrafos y en orden de lectura, con los títulos como encabezados.",
    accepts: ["pdf"],
    multiple: true,
    run: (files, _o, p) => eachPdf(files, p, async (f, step) => [{ name: outputName(f.name, "docx"), bytes: await pdfToDocx(await readPages(await openPdf(f.bytes), "none", step)) }]),
  },
  {
    id: "pdf-xlsx",
    group: "desde",
    title: "PDF a Excel",
    description: "El texto de cada página en filas y columnas según su posición (tablas sencillas).",
    accepts: ["pdf"],
    multiple: true,
    run: (files, _o, p) => eachPdf(files, p, async (f, step) => [{ name: outputName(f.name, "xlsx"), bytes: await pdfToXlsx(await readPages(await openPdf(f.bytes), "none", step)) }]),
  },
  {
    id: "pdf-image",
    group: "desde",
    title: "PDF a imagen",
    description: "Una imagen por página, en PNG o JPG.",
    accepts: ["pdf"],
    multiple: true,
    options: [
      { id: "format", label: "Formato", kind: "select", default: "png", choices: [{ value: "png", label: "PNG" }, { value: "jpg", label: "JPG" }] },
      { id: "dpi", label: "Resolución", kind: "select", default: "150", choices: [{ value: "96", label: "96 ppp (pantalla)" }, { value: "150", label: "150 ppp" }, { value: "300", label: "300 ppp (impresión)" }] },
    ],
    run: (files, o, p) =>
      eachPdf(files, p, async (f, step) => {
        const doc = await openPdf(f.bytes);
        const out: OutputFile[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const canvas = await renderPage(doc, n, Number(o.dpi) / 72);
          out.push({ name: outputName(f.name, o.format, doc.numPages > 1 ? n : undefined), bytes: await canvasBytes(canvas, o.format === "jpg" ? "image/jpeg" : "image/png") });
          step(n / doc.numPages);
        }
        return out;
      }),
  },
  {
    id: "pdf-text",
    group: "desde",
    title: "PDF a texto",
    description: "Solo el texto, en un archivo .txt.",
    accepts: ["pdf"],
    multiple: true,
    run: (files, _o, p) => eachPdf(files, p, async (f, step) => [{ name: outputName(f.name, "txt"), bytes: new TextEncoder().encode(pdfToText(await readPages(await openPdf(f.bytes), "none", step))) }]),
  },
  {
    id: "image-pdf",
    group: "hacia",
    title: "Imágenes a PDF",
    description: "PNG, JPG, WebP, GIF, BMP o SVG: una página por imagen, en el orden de la lista.",
    accepts: IMAGE_EXT,
    multiple: true,
    options: [
      { id: "fit", label: "Tamaño de página", kind: "select", default: "a4", choices: [{ value: "a4", label: "A4 (con margen)" }, { value: "image", label: "Igual que la imagen" }] },
      { id: "join", label: "Resultado", kind: "select", default: "one", choices: [{ value: "one", label: "Un solo PDF" }, { value: "each", label: "Un PDF por imagen" }] },
    ],
    run: async (files, o, p) => {
      const imgs = [];
      for (let i = 0; i < files.length; i++) {
        p(i / files.length, files[i].name);
        imgs.push(await toEmbeddable(files[i].bytes, files[i].name));
      }
      const fit = o.fit === "image" ? "image" : "a4";
      if (o.join === "each") return Promise.all(imgs.map(async (img, i) => ({ name: outputName(files[i].name, "pdf"), bytes: await imagesToPdf([img], fit) })));
      return [{ name: outputName(files.length === 1 ? files[0].name : "imágenes", "pdf"), bytes: await imagesToPdf(imgs, fit) }];
    },
  },
  {
    id: "text-pdf",
    group: "hacia",
    title: "Texto, Markdown, HTML o CSV a PDF",
    description: "Maquetado en A4 con títulos, párrafos, listas y tablas.",
    accepts: ["txt", "md", "markdown", "html", "htm", "csv"],
    multiple: true,
    run: (files, _o, p) =>
      eachPdf(files, p, async (f) => {
        const ext = f.name.toLowerCase().split(".").pop() ?? "";
        const src = text(f.bytes);
        const blocks = ext === "md" || ext === "markdown" ? markdownToBlocks(src) : ext === "html" || ext === "htm" ? htmlToBlocks(src) : ext === "csv" ? csvToBlocks(src) : textToBlocks(src);
        return [{ name: outputName(f.name, "pdf"), bytes: await blocksToPdf(blocks, outputName(f.name, "").replace(/\.$/, "")) }];
      }),
  },
  {
    id: "office-pdf",
    group: "hacia",
    title: "Word, Excel, PowerPoint y más a PDF",
    description: "DOCX, DOC, XLSX, XLS, PPTX, PPT, ODT, ODS, ODP, RTF y EPUB, con su formato.",
    accepts: OFFICE_EXT,
    multiple: true,
    addon: "officeconv",
    run: (files, _o, p) => eachPdf(files, p, async (f) => [{ name: outputName(f.name, "pdf"), bytes: await officeToPdf(f.name, f.bytes) }]),
  },
  {
    id: "merge",
    group: "organizar",
    title: "Unir PDF",
    description: "Junta varios PDF en uno, en el orden de la lista.",
    accepts: ["pdf"],
    multiple: true,
    min: 2,
    run: async (files, _o, p) => {
      p(0.5, "");
      return [{ name: "unidos.pdf", bytes: await mergePdfs(files.map((f) => f.bytes)) }];
    },
  },
  {
    id: "split",
    group: "organizar",
    title: "Dividir PDF",
    description: "Un PDF por página o por los rangos que escribas.",
    accepts: ["pdf"],
    multiple: false,
    options: [{ id: "ranges", label: "Rangos (vacío: una por página)", kind: "text", default: "", placeholder: "1-3, 5, 8-" }],
    run: async (files, o) => {
      const f = files[0];
      const total = (await openPdf(f.bytes)).numPages;
      const groups = o.ranges.trim() ? parseRanges(o.ranges, total) : Array.from({ length: total }, (_, i) => [i + 1]);
      return (await splitPdf(f.bytes, groups)).map((bytes, i) => ({ name: outputName(f.name, "pdf", i + 1), bytes }));
    },
  },
  {
    id: "rotate",
    group: "organizar",
    title: "Rotar páginas",
    description: "Gira todas las páginas o solo las que indiques.",
    accepts: ["pdf"],
    multiple: true,
    options: [
      { id: "angle", label: "Giro", kind: "select", default: "90", choices: [{ value: "90", label: "90° a la derecha" }, { value: "180", label: "180°" }, { value: "270", label: "90° a la izquierda" }] },
      { id: "pages", label: "Páginas (vacío: todas)", kind: "text", default: "", placeholder: "1, 3-4" },
    ],
    run: (files, o, p) =>
      eachPdf(files, p, async (f) => {
        const total = (await openPdf(f.bytes)).numPages;
        const pages = o.pages.trim() ? parseRanges(o.pages, total).flat() : [];
        return [{ name: outputName(f.name, "pdf"), bytes: await rotatePages(f.bytes, pages, Number(o.angle) as 90 | 180 | 270) }];
      }),
  },
  {
    id: "reorder",
    group: "organizar",
    title: "Quitar o reordenar páginas",
    description: "Escribe las páginas que quieres conservar, en el orden nuevo.",
    accepts: ["pdf"],
    multiple: false,
    options: [{ id: "order", label: "Páginas en el orden nuevo", kind: "text", default: "", placeholder: "3, 1-2, 5-" }],
    run: async (files, o) => {
      const f = files[0];
      const total = (await openPdf(f.bytes)).numPages;
      return [{ name: outputName(f.name, "pdf"), bytes: await reorderPages(f.bytes, parseRanges(o.order, total).flat()) }];
    },
  },
  {
    id: "compress",
    group: "organizar",
    title: "Comprimir PDF",
    description: "Básica: sin perder calidad. Fuerte: las páginas pasan a imagen JPG (el texto deja de poder seleccionarse).",
    accepts: ["pdf"],
    multiple: true,
    options: [{ id: "level", label: "Nivel", kind: "select", default: "basic", choices: [{ value: "basic", label: "Básica (sin perder calidad)" }, { value: "strong", label: "Fuerte (páginas como imagen)" }] }],
    run: (files, o, p) =>
      eachPdf(files, p, async (f, step) => {
        if (o.level !== "strong") return [{ name: outputName(f.name, "pdf"), bytes: await compressBasic(f.bytes) }];
        const doc = await openPdf(f.bytes);
        const imgs = [];
        for (let n = 1; n <= doc.numPages; n++) {
          imgs.push({ bytes: await canvasBytes(await renderPage(doc, n, 1.5), "image/jpeg", 0.7), type: "jpg" as const });
          step(n / doc.numPages);
        }
        return [{ name: outputName(f.name, "pdf"), bytes: await imagesToPdf(imgs, "image") }];
      }),
  },
  {
    id: "number",
    group: "organizar",
    title: "Numerar páginas",
    description: "Añade el número de página al pie.",
    accepts: ["pdf"],
    multiple: true,
    options: [{ id: "pattern", label: "Formato ({n} = página, {total} = total)", kind: "text", default: "{n} / {total}" }],
    run: (files, o, p) => eachPdf(files, p, async (f) => [{ name: outputName(f.name, "pdf"), bytes: await numberPages(f.bytes, o.pattern || "{n}") }]),
  },
  {
    id: "watermark",
    group: "organizar",
    title: "Marca de agua",
    description: "Un texto en diagonal sobre cada página.",
    accepts: ["pdf"],
    multiple: true,
    options: [{ id: "text", label: "Texto", kind: "text", default: "CONFIDENCIAL" }],
    run: (files, o, p) => eachPdf(files, p, async (f) => [{ name: outputName(f.name, "pdf"), bytes: await watermark(f.bytes, o.text || "CONFIDENCIAL") }]),
  },
  {
    id: "ocr",
    group: "ocr",
    title: "PDF escaneado a texto (OCR)",
    description: "Reconoce el texto de páginas escaneadas o fotografiadas, en español e inglés.",
    accepts: ["pdf", "png", "jpg", "jpeg"],
    multiple: true,
    addon: "pdfcheck",
    run: (files, _o, p) =>
      eachPdf(files, p, async (f, step) => {
        const pages: string[] = [];
        if (f.name.toLowerCase().endsWith(".pdf")) {
          const doc = await openPdf(f.bytes);
          for (let n = 1; n <= doc.numPages; n++) {
            pages.push(await ocrImage(await canvasBytes(await renderPage(doc, n, 3), "image/png")));
            step(n / doc.numPages);
          }
        } else pages.push(await ocrImage((await toEmbeddable(f.bytes, f.name)).bytes));
        return [{ name: outputName(f.name, "txt"), bytes: new TextEncoder().encode(pages.map((t) => t.trim()).join("\n\n\f\n\n") + "\n") }];
      }),
  },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);

/** ¿Acepta la herramienta este archivo? */
export function accepts(tool: Tool, name: string): boolean {
  return tool.accepts.includes(name.toLowerCase().split(".").pop() ?? "");
}
