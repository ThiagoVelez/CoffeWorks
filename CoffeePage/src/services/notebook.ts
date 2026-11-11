// Operaciones puras sobre el cuaderno: crear, validar, buscar y exportar.

import type { Block, Notebook, Page, PaperStyle, Section, Stroke } from "../types";
import { SECTION_COLORS } from "../types";

let counter = 0;
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const PAGE_WIDTH = 1600;
export const PAGE_MIN_HEIGHT = 1100;

export function newPage(title = "", level: 0 | 1 = 0, paper: PaperStyle = "blank"): Page {
  const now = Date.now();
  return { id: newId("page"), title, level, createdAt: now, updatedAt: now, paper, blocks: [], strokes: [] };
}

export function newSection(name: string, index: number): Section {
  return { id: newId("sec"), name, color: SECTION_COLORS[index % SECTION_COLORS.length], pages: [newPage()] };
}

export function newNotebook(): Notebook {
  const section = newSection("Notas rápidas", 0);
  section.pages[0] = {
    ...section.pages[0],
    title: "Bienvenido a CoffeePage",
    blocks: [
      {
        id: newId("blk"),
        kind: "text",
        x: 48,
        y: 24,
        width: 620,
        html:
          "<p>Haz clic en cualquier parte de la página para empezar a escribir.</p>" +
          '<ul><li>Organiza tus notas en <b>secciones</b> y <b>páginas</b> (columna de la izquierda).</li>' +
          "<li>Arrastra la barra superior de una nota para moverla.</li>" +
          "<li>Usa <b>Dibujar</b> para escribir a mano o resaltar.</li>" +
          "<li>Pega o arrastra imágenes directamente en la página.</li></ul>",
      },
    ],
  };
  return { format: "coffeepage", version: 1, sections: [section] };
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function sanitizeBlock(raw: unknown): Block | null {
  const b = raw as Partial<Block> | null;
  if (!b || typeof b !== "object" || !isNumber(b.x) || !isNumber(b.y)) return null;
  const id = typeof b.id === "string" ? b.id : newId("blk");
  if (b.kind === "text") {
    return { id, kind: "text", x: b.x, y: b.y, width: isNumber(b.width) ? b.width : 480, html: String(b.html ?? "") };
  }
  if (b.kind === "image" && typeof b.src === "string") {
    return {
      id,
      kind: "image",
      x: b.x,
      y: b.y,
      width: isNumber(b.width) ? b.width : 320,
      height: isNumber(b.height) ? b.height : 240,
      src: b.src,
    };
  }
  return null;
}

function sanitizeStroke(raw: unknown): Stroke | null {
  const s = raw as Partial<Stroke> | null;
  if (!s || !Array.isArray(s.points)) return null;
  const points = s.points.filter(
    (p): p is [number, number] => Array.isArray(p) && isNumber(p[0]) && isNumber(p[1])
  );
  if (points.length === 0) return null;
  return {
    id: typeof s.id === "string" ? s.id : newId("ink"),
    tool: s.tool === "highlighter" ? "highlighter" : "pen",
    color: typeof s.color === "string" ? s.color : "#1f1f1f",
    width: isNumber(s.width) ? s.width : 3,
    points,
  };
}

/** Lee un cuaderno guardado y descarta lo que no tenga la forma esperada. */
export function parseNotebook(text: string): Notebook {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un cuaderno de CoffeePage válido.");
  }
  const raw = data as Partial<Notebook> | null;
  if (!raw || raw.format !== "coffeepage" || !Array.isArray(raw.sections)) {
    throw new Error("El archivo no es un cuaderno de CoffeePage válido.");
  }
  const sections: Section[] = raw.sections.map((rs, i) => {
    const s = rs as Partial<Section>;
    const pages: Page[] = (Array.isArray(s.pages) ? s.pages : []).map((rp) => {
      const p = rp as Partial<Page>;
      const base = newPage();
      return {
        id: typeof p.id === "string" ? p.id : base.id,
        title: typeof p.title === "string" ? p.title : "",
        level: p.level === 1 ? 1 : 0,
        createdAt: isNumber(p.createdAt) ? p.createdAt : base.createdAt,
        updatedAt: isNumber(p.updatedAt) ? p.updatedAt : base.updatedAt,
        paper: p.paper === "lines" || p.paper === "grid" ? p.paper : "blank",
        blocks: (Array.isArray(p.blocks) ? p.blocks : []).map(sanitizeBlock).filter((b): b is Block => b !== null),
        strokes: (Array.isArray(p.strokes) ? p.strokes : []).map(sanitizeStroke).filter((st): st is Stroke => st !== null),
      };
    });
    return {
      id: typeof s.id === "string" ? s.id : newId("sec"),
      name: typeof s.name === "string" && s.name.trim() ? s.name : `Sección ${i + 1}`,
      color: typeof s.color === "string" ? s.color : SECTION_COLORS[i % SECTION_COLORS.length],
      pages: pages.length > 0 ? pages : [newPage()],
    };
  });
  if (sections.length === 0) sections.push(newSection("Notas rápidas", 0));
  return { format: "coffeepage", version: 1, sections };
}

export const serializeNotebook = (notebook: Notebook) => JSON.stringify(notebook);

// ---------------------------------------------------------------------------
// Texto y búsqueda
// ---------------------------------------------------------------------------

const scratch = typeof document !== "undefined" ? document.implementation.createHTMLDocument("") : null;

/** Texto plano de un fragmento HTML sin ejecutar nada (documento inerte). */
export function htmlToText(html: string): string {
  if (!scratch) return html.replace(/<[^>]+>/g, " ");
  const div = scratch.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("p, div, li, br, tr, h1, h2, h3").forEach((el) => el.append(" "));
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

export const pageText = (page: Page) =>
  page.blocks.map((b) => (b.kind === "text" ? htmlToText(b.html) : "")).join(" ");

/** Primera línea con texto de la página (para las páginas sin título). */
export function pagePreview(page: Page): string {
  return pageText(page).slice(0, 80);
}

export const fold = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export interface SearchHit {
  sectionId: string;
  pageId: string;
  sectionName: string;
  pageTitle: string;
  snippet: string;
  inTitle: boolean;
}

export function searchNotebook(notebook: Notebook, query: string): SearchHit[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const hits: SearchHit[] = [];
  for (const section of notebook.sections) {
    for (const page of section.pages) {
      const title = page.title || "Página sin título";
      const inTitle = fold(title).includes(needle);
      const text = pageText(page);
      const at = fold(text).indexOf(needle);
      if (!inTitle && at < 0) continue;
      const start = Math.max(0, at - 40);
      const snippet = at >= 0 ? `${start > 0 ? "…" : ""}${text.slice(start, at + needle.length + 60)}` : pagePreview(page);
      hits.push({ sectionId: section.id, pageId: page.id, sectionName: section.name, pageTitle: title, snippet, inTitle });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function strokePath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${x} ${y} L${x + 0.1} ${y + 0.1}`;
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d += ` Q${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

export function pageExtent(page: Page): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const b of page.blocks) {
    width = Math.max(width, b.x + b.width);
    height = Math.max(height, b.y + (b.kind === "image" ? b.height : 120));
  }
  for (const s of page.strokes) {
    for (const [x, y] of s.points) {
      width = Math.max(width, x + s.width);
      height = Math.max(height, y + s.width);
    }
  }
  return { width, height };
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/** HTML autónomo de una página (exportar o imprimir). */
export function pageToHtmlBody(page: Page): string {
  const { width, height } = pageExtent(page);
  const blocks = page.blocks
    .map((b) =>
      b.kind === "text"
        ? `<div class="blk" style="left:${b.x}px;top:${b.y}px;width:${b.width}px">${b.html}</div>`
        : `<img class="blk" src="${b.src}" style="left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px" alt="">`
    )
    .join("\n");
  const ink = page.strokes
    .map(
      (s) =>
        `<path d="${strokePath(s.points)}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"${
          s.tool === "highlighter" ? ' opacity="0.35"' : ""
        }/>`
    )
    .join("");
  return `<section class="page">
<h1>${escapeHtml(page.title || "Página sin título")}</h1>
<p class="date">${escapeHtml(formatDate(page.createdAt))}</p>
<div class="canvas" style="width:${Math.max(width, 200)}px;height:${Math.max(height + 20, 60)}px">
${blocks}
<svg width="${Math.max(width, 200)}" height="${Math.max(height + 20, 60)}">${ink}</svg>
</div>
</section>`;
}

export const EXPORT_STYLES = `
body{font-family:'Segoe UI',Calibri,Arial,sans-serif;color:#1f1f1f;margin:32px;}
.page{page-break-after:always;margin-bottom:48px;}
.page:last-child{page-break-after:auto;}
h1{font-size:26px;font-weight:600;margin:0 0 4px;}
.date{color:#666;font-size:12px;margin:0 0 16px;}
.canvas{position:relative;}
.canvas svg{position:absolute;left:0;top:0;pointer-events:none;}
.blk{position:absolute;font-size:15px;line-height:1.45;}
.blk p{margin:0 0 4px;}
.blk ul,.blk ol{margin:0 0 4px;padding-left:24px;}
.blk table{border-collapse:collapse;}
.blk td,.blk th{border:1px solid #bbb;padding:4px 8px;min-width:60px;}
.cp-tag{display:inline-block;margin-right:6px;}
.cp-tag[data-tag=todo]::before{content:'☐';}
.cp-tag[data-tag=todo][data-checked=true]::before{content:'☑';}
.cp-tag[data-tag=important]::before{content:'★';color:#f4b400;}
.cp-tag[data-tag=question]::before{content:'?';color:#7b1fa2;font-weight:700;}
.cp-tag[data-tag=idea]::before{content:'💡';}
`;

export function pagesToHtmlDocument(title: string, pages: Page[]): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${EXPORT_STYLES}</style></head>
<body>
${pages.map(pageToHtmlBody).join("\n")}
</body></html>`;
}

/** Markdown aproximado de una página (texto, listas y tareas). */
export function pageToMarkdown(page: Page): string {
  const lines: string[] = [`# ${page.title || "Página sin título"}`, ""];
  const sorted = [...page.blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const block of sorted) {
    if (block.kind === "image") {
      lines.push("![imagen]()", "");
      continue;
    }
    if (!scratch) continue;
    const div = scratch.createElement("div");
    div.innerHTML = block.html;
    const walk = (node: Element) => {
      for (const child of Array.from(node.children)) {
        const tag = child.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") {
          Array.from(child.children).forEach((li, i) => {
            lines.push(`${tag === "ol" ? `${i + 1}.` : "-"} ${tagPrefix(li)}${(li.textContent || "").trim()}`);
          });
        } else if (/^h[1-3]$/.test(tag)) {
          lines.push(`${"#".repeat(Number(tag[1]) + 1)} ${(child.textContent || "").trim()}`);
        } else if (tag === "div" || tag === "p") {
          const text = (child.textContent || "").trim();
          if (text) lines.push(`${tagPrefix(child)}${text}`);
        } else {
          const text = (child.textContent || "").trim();
          if (text) lines.push(text);
        }
      }
    };
    if (div.children.length === 0) {
      const text = (div.textContent || "").trim();
      if (text) lines.push(text);
    } else {
      walk(div);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function tagPrefix(el: Element): string {
  const tag = el.querySelector(".cp-tag");
  if (!tag) return "";
  switch (tag.getAttribute("data-tag")) {
    case "todo":
      return tag.getAttribute("data-checked") === "true" ? "[x] " : "[ ] ";
    case "important":
      return "⭐ ";
    case "question":
      return "❓ ";
    case "idea":
      return "💡 ";
    default:
      return "";
  }
}
