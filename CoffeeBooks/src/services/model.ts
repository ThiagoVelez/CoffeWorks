// Operaciones sobre el espacio de trabajo: crear páginas y bloques,
// plantillas, Markdown y búsqueda.

import { newId } from "./docStore";
import type { Block, BlockColor, BlockType, Column, Database, DbView, Page, Row, Workspace } from "../types";

export { newId };

export const block = (type: BlockType = "paragraph", text = "", extra: Partial<Block> = {}): Block => ({ id: newId("b"), type, text, ...extra });

export function newPage(parentId: string | null, title = "", kind: Page["kind"] = "page"): Page {
  const now = Date.now();
  return { id: newId("p"), parentId, title, icon: kind === "database" ? "🗂️" : "📄", cover: null, kind, blocks: kind === "page" ? [block()] : [], db: kind === "database" ? newDatabase() : undefined, fullWidth: kind === "database", expanded: true, createdAt: now, updatedAt: now };
}

export const col = (name: string, type: Column["type"], extra: Partial<Column> = {}): Column => ({ id: newId("c"), name, type, ...extra });

export function newDatabase(): Database {
  const title = col("Nombre", "title", { width: 260 });
  const status = col("Estado", "select", {
    options: [
      { id: newId("o"), name: "Por hacer", color: "gray" },
      { id: newId("o"), name: "En curso", color: "blue" },
      { id: newId("o"), name: "Hecho", color: "green" },
    ],
  });
  const date = col("Fecha", "date");
  const views: DbView[] = [
    { id: newId("v"), name: "Tabla", kind: "table" },
    { id: newId("v"), name: "Tablero", kind: "board", groupBy: status.id },
  ];
  return { columns: [title, status, date], rows: [], views, activeView: views[0].id };
}

export const newRow = (db: Database, values: Row["values"] = {}): Row => ({ id: newId("r"), values: { ...Object.fromEntries(db.columns.map((c) => [c.id, c.type === "checkbox" ? false : c.type === "multi" ? [] : null])), ...values }, blocks: [block()], createdAt: Date.now() });

export function newWorkspace(): Workspace {
  const welcome = newPage(null, "Bienvenida");
  welcome.icon = "☕";
  welcome.cover = "coffee";
  welcome.blocks = [
    block("paragraph", "Este es tu espacio de trabajo de <b>CoffeeBooks</b>: notas, wikis y bases de datos en un solo lugar."),
    block("h2", "Empieza aquí"),
    block("todo", "Escribe <code>/</code> en una línea vacía para elegir un tipo de bloque"),
    block("todo", "Usa atajos de Markdown: <code>#</code> título, <code>-</code> lista, <code>[]</code> tarea, <code>&gt;</code> cita"),
    block("todo", "Crea subpáginas y bases de datos desde la barra lateral"),
    block("todo", "Arrastra los bloques con el asa ⋮⋮ para reordenarlos"),
    block("callout", "Todo se guarda en tu equipo, en un único archivo <b>.cbk</b>.", { emoji: "💡", color: "yellow" }),
  ];
  return { version: 1, name: "Mi espacio", pages: [welcome], favorites: [], trash: [] };
}

export const serializeWorkspace = (w: Workspace) => JSON.stringify({ app: "CoffeeBooks", ...w });

export function parseWorkspace(text: string): Workspace {
  if (!text.trim()) return newWorkspace();
  const raw = JSON.parse(text);
  if (!Array.isArray(raw.pages)) throw new Error("El archivo no es un espacio de CoffeeBooks.");
  return { version: 1, name: raw.name || "Mi espacio", pages: raw.pages, favorites: raw.favorites || [], trash: raw.trash || [] };
}

// ---------------------------------------------------------------------------
// Árbol
// ---------------------------------------------------------------------------

export const childrenOf = (w: Workspace, id: string | null) => w.pages.filter((p) => p.parentId === id);

export function descendants(w: Workspace, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => childrenOf(w, pid).forEach((c) => (out.push(c.id), walk(c.id)));
  walk(id);
  return out;
}

export function breadcrumb(w: Workspace, id: string): Page[] {
  const out: Page[] = [];
  let p = w.pages.find((x) => x.id === id);
  while (p) {
    out.unshift(p);
    p = p.parentId ? w.pages.find((x) => x.id === p!.parentId) : undefined;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Limpia el HTML pegado o escrito: solo formato en línea. */
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "CODE", "A", "MARK", "BR", "SPAN"]);
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const inner = [...el.childNodes].map(clean).join("");
    if (!allowed.has(el.tagName)) return el.tagName === "DIV" || el.tagName === "P" ? inner + "<br>" : inner;
    const tag = el.tagName === "STRONG" ? "b" : el.tagName === "EM" ? "i" : el.tagName === "STRIKE" ? "s" : el.tagName.toLowerCase();
    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
    }
    if (tag === "span" || tag === "mark") {
      const color = el.getAttribute("data-color");
      return color ? `<mark data-color="${escapeHtml(color)}">${inner}</mark>` : inner;
    }
    return `<${tag}>${inner}</${tag}>`;
  };
  return [...doc.body.firstChild!.childNodes].map(clean).join("").replace(/(<br>)+$/, "");
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function inlineMd(html: string): string {
  return htmlToText(
    html
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")
      .replace(/<s>(.*?)<\/s>/gi, "~~$1~~")
      .replace(/<code>(.*?)<\/code>/gi, "`$1`")
      .replace(/<a href="([^"]*)">(.*?)<\/a>/gi, "[$2]($1)")
  );
}

function mdInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(?<![*\w])\*(?!\s)(.+?)\*(?!\w)/g, "<i>$1</i>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
}

export function blocksToMarkdown(blocks: Block[], w: Workspace, depth = 0): string {
  const pad = "  ".repeat(depth);
  let n = 0;
  return blocks
    .map((b) => {
      if (b.type !== "numbered") n = 0;
      const t = inlineMd(b.text);
      switch (b.type) {
        case "h1":
          return `# ${t}`;
        case "h2":
          return `## ${t}`;
        case "h3":
          return `### ${t}`;
        case "bullet":
          return `${pad}- ${t}`;
        case "numbered":
          return `${pad}${++n}. ${t}`;
        case "todo":
          return `${pad}- [${b.checked ? "x" : " "}] ${t}`;
        case "toggle":
          return `${pad}- ${t}\n${blocksToMarkdown(b.children || [], w, depth + 1)}`;
        case "quote":
          return `> ${t}`;
        case "callout":
          return `> ${b.emoji || "💡"} ${t}`;
        case "code":
          return "```" + (b.lang || "") + "\n" + htmlToText(b.text) + "\n```";
        case "divider":
          return "---";
        case "image":
          return `![](${b.src && b.src.startsWith("http") ? b.src : "imagen"})`;
        case "page": {
          const p = w.pages.find((x) => x.id === b.pageId);
          return `📄 ${p ? p.title || "Sin título" : "Página"}`;
        }
        case "table":
          return (b.rows || [])
            .map((r, i) => `| ${r.join(" | ")} |` + (i === 0 ? `\n|${r.map(() => " --- |").join("")}` : ""))
            .join("\n");
        default:
          return t;
      }
    })
    .join("\n\n");
}

export function pageToMarkdown(p: Page, w: Workspace): string {
  let md = `# ${p.icon} ${p.title || "Sin título"}\n\n`;
  if (p.kind === "database" && p.db) {
    const cols = p.db.columns;
    md += `| ${cols.map((c) => c.name).join(" | ")} |\n|${cols.map(() => " --- |").join("")}\n`;
    md += p.db.rows.map((r) => `| ${cols.map((c) => cellText(c, r.values[c.id])).join(" | ")} |`).join("\n");
  } else md += blocksToMarkdown(p.blocks, w);
  return md + "\n";
}

export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpMatchArray | null;
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      out.push(block("code", escapeHtml(code.join("\n")).replace(/\n/g, "<br>"), { lang }));
    } else if ((m = line.match(/^(#{1,3})\s+(.*)/))) out.push(block((["h1", "h2", "h3"] as const)[m[1].length - 1], mdInline(m[2])));
    else if ((m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)/))) out.push(block("todo", mdInline(m[2]), { checked: m[1] !== " " }));
    else if ((m = line.match(/^\s*[-*+]\s+(.*)/))) out.push(block("bullet", mdInline(m[1])));
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) out.push(block("numbered", mdInline(m[1])));
    else if ((m = line.match(/^>\s?(.*)/))) out.push(block("quote", mdInline(m[1])));
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) out.push(block("divider"));
    else if ((m = line.match(/^!\[[^\]]*\]\((https?:[^)]+)\)/))) out.push(block("image", "", { src: m[1] }));
    else if (/^\|.*\|$/.test(line.trim())) {
      const rows: string[][] = [];
      for (; i < lines.length && /^\|.*\|$/.test(lines[i].trim()); i++) {
        if (/^\|[\s:|-]+\|$/.test(lines[i].trim())) continue;
        rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
      }
      i--;
      out.push(block("table", "", { rows }));
    } else out.push(block("paragraph", mdInline(line)));
  }
  return out.length ? out : [block()];
}

// ---------------------------------------------------------------------------
// Bases de datos
// ---------------------------------------------------------------------------

export function cellText(c: Column, v: Row["values"][string]): string {
  if (v === null || v === undefined || v === "") return "";
  if (c.type === "checkbox") return v ? "✓" : "";
  if (c.type === "select") return c.options?.find((o) => o.id === v)?.name || "";
  if (c.type === "multi") return ((v as string[]) || []).map((id) => c.options?.find((o) => o.id === id)?.name).filter(Boolean).join(", ");
  if (c.type === "date" && typeof v === "string") return new Date(v + "T00:00").toLocaleDateString();
  return String(v);
}

export function visibleRows(db: Database, view: DbView, query = ""): Row[] {
  let rows = db.rows.slice();
  const f = view.filter;
  if (f) {
    const c = db.columns.find((x) => x.id === f.column);
    if (c)
      rows = rows.filter((r) => {
        const v = r.values[c.id];
        const t = cellText(c, v).toLowerCase();
        switch (f.op) {
          case "contains":
            return t.includes(f.value.toLowerCase());
          case "is":
            return c.type === "select" ? v === f.value : t === f.value.toLowerCase();
          case "isNot":
            return c.type === "select" ? v !== f.value : t !== f.value.toLowerCase();
          case "checked":
            return !!v;
          case "unchecked":
            return !v;
          case "empty":
            return !t;
          case "notEmpty":
            return !!t;
        }
        return true;
      });
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    rows = rows.filter((r) => db.columns.some((c) => cellText(c, r.values[c.id]).toLowerCase().includes(q)));
  }
  const s = view.sort;
  if (s) {
    const c = db.columns.find((x) => x.id === s.column);
    if (c)
      rows.sort((a, b) => {
        const va = a.values[c.id];
        const vb = b.values[c.id];
        const cmp = c.type === "number" ? Number(va || 0) - Number(vb || 0) : c.type === "select" ? (c.options?.findIndex((o) => o.id === va) ?? 0) - (c.options?.findIndex((o) => o.id === vb) ?? 0) : cellText(c, va).localeCompare(cellText(c, vb), "es", { numeric: true });
        return s.dir === "asc" ? cmp : -cmp;
      });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function pageText(p: Page): string {
  const walk = (bs: Block[]): string => bs.map((b) => htmlToText(b.text) + " " + (b.rows || []).flat().join(" ") + " " + walk(b.children || [])).join(" ");
  const db = p.db ? p.db.rows.map((r) => p.db!.columns.map((c) => cellText(c, r.values[c.id])).join(" ")).join(" ") : "";
  return `${p.title} ${walk(p.blocks)} ${db}`;
}

export function search(w: Workspace, query: string): { page: Page; snippet: string }[] {
  const q = fold(query.trim());
  if (!q) return w.pages.slice(0, 12).map((page) => ({ page, snippet: "" }));
  return w.pages
    .map((page) => {
      const text = pageText(page);
      const i = fold(text).indexOf(q);
      const inTitle = fold(page.title).includes(q);
      if (i < 0 && !inTitle) return null;
      return { page, snippet: i >= 0 ? text.slice(Math.max(0, i - 30), i + q.length + 50).trim() : "", score: inTitle ? 0 : 1 };
    })
    .filter(Boolean)
    .sort((a, b) => a!.score - b!.score)
    .slice(0, 30) as { page: Page; snippet: string }[];
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export interface PageTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  build: (parentId: string | null) => Page;
}

const opt = (name: string, color: BlockColor) => ({ id: newId("o"), name, color });

export const TEMPLATES: PageTemplate[] = [
  {
    id: "meeting",
    name: "Notas de reunión",
    icon: "🗓️",
    description: "Asistentes, agenda, decisiones y tareas.",
    build: (parent) => {
      const p = newPage(parent, "Reunión " + new Date().toLocaleDateString());
      p.icon = "🗓️";
      p.blocks = [
        block("callout", "<b>Fecha:</b> " + new Date().toLocaleDateString() + " · <b>Asistentes:</b> ", { emoji: "👥", color: "blue" }),
        block("h2", "Agenda"),
        block("numbered", "Punto 1"),
        block("numbered", "Punto 2"),
        block("h2", "Notas"),
        block("bullet", ""),
        block("h2", "Decisiones"),
        block("bullet", ""),
        block("h2", "Tareas"),
        block("todo", "Tarea · responsable · fecha"),
      ];
      return p;
    },
  },
  {
    id: "journal",
    name: "Diario",
    icon: "📔",
    description: "Una entrada para el día de hoy con ánimo y gratitud.",
    build: (parent) => {
      const p = newPage(parent, new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }));
      p.icon = "📔";
      p.cover = "peach";
      p.blocks = [block("h3", "¿Cómo me siento?"), block("paragraph", ""), block("h3", "Tres cosas por las que estoy agradecido"), block("numbered", ""), block("numbered", ""), block("numbered", ""), block("h3", "Lo más importante de hoy"), block("todo", "")];
      return p;
    },
  },
  {
    id: "wiki",
    name: "Wiki del equipo",
    icon: "📚",
    description: "Portada con secciones para documentar procesos.",
    build: (parent) => {
      const p = newPage(parent, "Wiki del equipo");
      p.icon = "📚";
      p.cover = "ocean";
      p.blocks = [
        block("callout", "Todo lo que el equipo necesita saber, en un solo lugar.", { emoji: "🧭", color: "blue" }),
        block("h2", "Empieza aquí"),
        block("bullet", "Quiénes somos y cómo trabajamos"),
        block("bullet", "Herramientas y accesos"),
        block("h2", "Procesos"),
        block("toggle", "Cómo pedir vacaciones", { open: false, children: [block("paragraph", "Escribe aquí el proceso…")] }),
        block("toggle", "Cómo publicar una versión", { open: false, children: [block("paragraph", "Escribe aquí el proceso…")] }),
        block("h2", "Contactos"),
        block("table", "", { rows: [["Área", "Persona", "Correo"], ["Soporte", "", ""], ["Diseño", "", ""]] }),
      ];
      return p;
    },
  },
  {
    id: "tasks",
    name: "Seguimiento de tareas",
    icon: "✅",
    description: "Base de datos con tablero por estado y prioridad.",
    build: (parent) => {
      const p = newPage(parent, "Tareas", "database");
      p.icon = "✅";
      const db = p.db!;
      const prio = col("Prioridad", "select", { options: [opt("Alta", "red"), opt("Media", "yellow"), opt("Baja", "gray")] });
      const who = col("Responsable", "text");
      db.columns.push(prio, who);
      const [title, status, date] = db.columns;
      const st = status.options!;
      const rows: [string, number, number, string][] = [
        ["Preparar la presentación", 1, 0, "Ana"],
        ["Revisar el presupuesto", 0, 1, "Luis"],
        ["Enviar el informe mensual", 2, 1, "Ana"],
        ["Planificar el próximo sprint", 0, 2, "Marta"],
      ];
      db.rows = rows.map(([t, s, pr, w], i) => newRow(db, { [title.id]: t, [status.id]: st[s].id, [prio.id]: prio.options![pr].id, [who.id]: w, [date.id]: new Date(Date.now() + i * 86400000 * 2).toISOString().slice(0, 10) }));
      db.activeView = db.views[1].id;
      return p;
    },
  },
  {
    id: "reading",
    name: "Lista de lectura",
    icon: "📖",
    description: "Libros con autor, estado, valoración y enlace.",
    build: (parent) => {
      const p = newPage(parent, "Lista de lectura", "database");
      p.icon = "📖";
      const db = p.db!;
      db.columns = [col("Título", "title", { width: 240 }), col("Autor", "text"), col("Estado", "select", { options: [opt("Pendiente", "gray"), opt("Leyendo", "orange"), opt("Leído", "green")] }), col("Valoración", "number"), col("Enlace", "url")];
      db.views = [
        { id: newId("v"), name: "Tabla", kind: "table" },
        { id: newId("v"), name: "Por estado", kind: "board", groupBy: db.columns[2].id },
      ];
      db.activeView = db.views[0].id;
      const st = db.columns[2].options!;
      db.rows = [
        ["Cien años de soledad", "Gabriel García Márquez", 2, 5],
        ["La sombra del viento", "Carlos Ruiz Zafón", 1, 0],
        ["Ficciones", "Jorge Luis Borges", 0, 0],
      ].map(([t, a, s, v]) => newRow(db, { [db.columns[0].id]: t as string, [db.columns[1].id]: a as string, [db.columns[2].id]: st[s as number].id, [db.columns[3].id]: (v as number) || null }));
      return p;
    },
  },
  {
    id: "project",
    name: "Plan de proyecto",
    icon: "🚀",
    description: "Objetivo, hitos, riesgos y próximos pasos.",
    build: (parent) => {
      const p = newPage(parent, "Plan de proyecto");
      p.icon = "🚀";
      p.cover = "sunset";
      p.blocks = [
        block("callout", "Describe en una frase qué quieres conseguir y por qué.", { emoji: "🎯", color: "orange" }),
        block("h2", "Hitos"),
        block("table", "", { rows: [["Hito", "Fecha", "Estado"], ["Investigación", "", "Pendiente"], ["Primera versión", "", "Pendiente"], ["Lanzamiento", "", "Pendiente"]] }),
        block("h2", "Riesgos"),
        block("bullet", ""),
        block("h2", "Próximos pasos"),
        block("todo", ""),
      ];
      return p;
    },
  },
];
