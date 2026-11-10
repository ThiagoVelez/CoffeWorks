// Almacén de documentos de CoffeDoc: formato nativo .cfd, guardado en la bóveda
// de CoffeWorks, importación (Word, Markdown, HTML, texto) y exportación.

import type { CoffeDocument, DocumentTab, ExportFormat, PageSettings } from "../types";
import { DEFAULT_PAGE_SETTINGS } from "../types";
import {
  baseName,
  bytesToText,
  extensionOf,
  isTauri,
  readFileBytes,
  registerRecent,
  renameInVault,
  saveFileAs,
  stripExtension,
  vaultPath,
  writeFileText,
  type PickedFile,
} from "./desktop";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

export const APP_ID = "coffedoc";
export const NATIVE_EXTENSION = "cfd";
export const DEFAULT_TITLE = "Documento sin título";

const WEB_DOC_PREFIX = "coffedoc:doc:";
const LAST_KEY = "coffedoc:last";
const LEGACY_KEY = "coffedoc_active_document";

export const OPEN_FILTERS = [
  {
    name: "Documentos",
    extensions: ["cfd", "docx", "md", "markdown", "txt", "html", "htm"],
  },
  { name: "Documento de CoffeDoc", extensions: ["cfd"] },
  { name: "Documento de Word", extensions: ["docx"] },
  { name: "Markdown", extensions: ["md", "markdown"] },
  { name: "Página web", extensions: ["html", "htm"] },
  { name: "Texto sin formato", extensions: ["txt"] },
];

export interface OpenResult {
  document: CoffeDocument;
  /** Ruta del archivo .cfd en disco; `null` si el documento aún no tiene archivo. */
  filePath: string | null;
}

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function createTab(name: string, content = "<p><br></p>"): DocumentTab {
  return { id: newId("tab"), name, content };
}

export function createBlankDocument(title = DEFAULT_TITLE, content = "<p><br></p>"): CoffeDocument {
  const now = new Date().toISOString();
  const tab = createTab("Pestaña 1", content);
  return {
    metadata: {
      id: newId("doc"),
      title,
      author: "Usuario CoffeWorks",
      createdAt: now,
      updatedAt: now,
    },
    settings: { ...DEFAULT_PAGE_SETTINGS },
    tabs: [tab],
    activeTabId: tab.id,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string): string {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html = paragraphs
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return html || "<p><br></p>";
}

/** Elimina scripts y manejadores de eventos de HTML importado. */
function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, link, meta, iframe, object, embed").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
      if ((attr.name === "href" || attr.name === "src") && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML.trim() || "<p><br></p>";
}

/** Interpreta el contenido de un archivo .cfd (formato actual o heredado). */
export function parseCfd(text: string, fallbackTitle: string): CoffeDocument {
  const parsed = JSON.parse(text);
  const blank = createBlankDocument(fallbackTitle);

  const metadata = {
    ...blank.metadata,
    ...(parsed.metadata || {}),
  };
  if (!metadata.title) metadata.title = fallbackTitle;
  const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, ...(parsed.settings || {}) };

  let tabs: DocumentTab[] = [];
  if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
    tabs = parsed.tabs.map((tab: Partial<DocumentTab>, index: number) => ({
      id: tab.id || newId("tab"),
      name: tab.name || `Pestaña ${index + 1}`,
      content: sanitizeHtml(tab.content || ""),
    }));
  } else if (typeof parsed.content === "string") {
    // Formato .cfd de las primeras versiones: un único bloque de contenido
    tabs = [createTab("Pestaña 1", sanitizeHtml(parsed.content))];
  } else {
    throw new Error("El archivo no es un documento de CoffeDoc válido");
  }

  const activeTabId = tabs.some((t) => t.id === parsed.activeTabId) ? parsed.activeTabId : tabs[0].id;
  return { metadata, settings, tabs, activeTabId };
}

export function serializeCfd(doc: CoffeDocument): string {
  return JSON.stringify({ format: "coffedoc", version: 2, ...doc }, null, 2);
}

/** Convierte un archivo elegido por el usuario en un documento editable. */
export async function importFile(file: PickedFile): Promise<OpenResult> {
  const extension = extensionOf(file.name);
  const title = stripExtension(file.name) || DEFAULT_TITLE;

  if (extension === NATIVE_EXTENSION || extension === "json") {
    const document = parseCfd(bytesToText(file.bytes), title);
    return { document, filePath: extension === NATIVE_EXTENSION ? file.path : null };
  }

  if (extension === "doc") {
    throw new Error(
      "El formato .doc de Word 97-2003 no es compatible. Guárdalo como .docx y vuelve a abrirlo."
    );
  }

  let html: string;
  if (extension === "docx") {
    const isZip = file.bytes.length >= 4 && file.bytes[0] === 0x50 && file.bytes[1] === 0x4b;
    if (isZip) {
      const mammoth = await import("mammoth");
      const buffer = file.bytes.buffer.slice(
        file.bytes.byteOffset,
        file.bytes.byteOffset + file.bytes.byteLength
      ) as ArrayBuffer;
      const result = await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Título'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "p[style-name='Subtítulo'] => h2:fresh",
            "u => u",
            "strike => s",
          ],
        }
      );
      html = sanitizeHtml(result.value);
    } else {
      // Archivos .docx antiguos de CoffeDoc que en realidad contenían HTML
      html = sanitizeHtml(bytesToText(file.bytes));
    }
  } else if (extension === "md" || extension === "markdown") {
    html = sanitizeHtml(markdownToHtml(bytesToText(file.bytes)));
  } else if (extension === "html" || extension === "htm") {
    html = sanitizeHtml(bytesToText(file.bytes));
  } else {
    html = plainTextToHtml(bytesToText(file.bytes));
  }

  return { document: createBlankDocument(title, html), filePath: null };
}

/** Abre un archivo del disco a partir de su ruta (solo en escritorio). */
export async function openPath(path: string): Promise<OpenResult> {
  const bytes = await readFileBytes(path);
  return importFile({ name: baseName(path), path, bytes });
}

/** Carga un documento guardado en el navegador (modo web). */
export function loadWebDocument(id: string): CoffeDocument | null {
  try {
    const raw = localStorage.getItem(WEB_DOC_PREFIX + id);
    return raw ? parseCfd(raw, DEFAULT_TITLE) : null;
  } catch {
    return null;
  }
}

/** Referencia al último documento abierto, para "Continuar editando". */
export function getLastReference(): string | null {
  return localStorage.getItem(LAST_KEY);
}

/** Abre el documento de la sesión anterior, si sigue existiendo. */
export async function openLast(): Promise<OpenResult | null> {
  const reference = getLastReference();
  try {
    if (isTauri) {
      return reference ? await openPath(reference) : null;
    }
    if (reference) {
      const document = loadWebDocument(reference);
      if (document) return { document, filePath: null };
    }
    // Migración del almacenamiento de versiones anteriores
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      return { document: parseCfd(legacy, DEFAULT_TITLE), filePath: null };
    }
  } catch (err) {
    console.warn("No se pudo recuperar el último documento:", err);
  }
  return null;
}

/**
 * Guarda el documento. En escritorio escribe el archivo .cfd (en la bóveda si
 * todavía no tiene ubicación) y devuelve su ruta; en el navegador usa
 * localStorage. En ambos casos lo registra en los recientes del Launcher.
 */
export async function persistDocument(
  doc: CoffeDocument,
  filePath: string | null
): Promise<string | null> {
  const stamped: CoffeDocument = {
    ...doc,
    metadata: { ...doc.metadata, updatedAt: new Date().toISOString() },
  };
  const json = serializeCfd(stamped);
  const title = doc.metadata.title.trim() || DEFAULT_TITLE;
  const fileName = `${title}.${NATIVE_EXTENSION}`;
  const entry = {
    id: doc.metadata.id,
    name: fileName,
    app_id: APP_ID,
    category: "Documento",
    last_modified: "",
    is_pinned: false,
    path: "",
    updated_at: Date.now(),
  };

  if (isTauri) {
    const path = filePath
      ? await renameInVault(filePath, fileName, doc.metadata.id)
      : await vaultPath(fileName, doc.metadata.id);
    await writeFileText(path, json);
    await registerRecent({ ...entry, name: baseName(path), path });
    localStorage.setItem(LAST_KEY, path);
    return path;
  }

  localStorage.setItem(WEB_DOC_PREFIX + doc.metadata.id, json);
  localStorage.setItem(LAST_KEY, doc.metadata.id);
  await registerRecent({ ...entry, path: `web:${doc.metadata.id}` });
  return null;
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

/** Estilos mínimos para que el HTML exportado se vea como en el editor. */
const EXPORT_CSS = `
body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.5;color:#1f1f1f;max-width:800px;margin:40px auto;padding:0 24px;}
h1{font-size:20pt;margin:20pt 0 6pt;}h2{font-size:16pt;margin:18pt 0 6pt;}h3{font-size:14pt;margin:16pt 0 4pt;color:#434343;}
p{margin:0 0 8pt;}ul,ol{margin:0 0 8pt;padding-left:28pt;}
blockquote{border-left:3px solid #dadce0;margin:10pt 0;padding:2pt 14pt;color:#5f6368;font-style:italic;}
pre{background:#f5f5f5;padding:10pt;border-radius:4px;font-family:'Courier New',monospace;font-size:10pt;overflow-x:auto;}
code{font-family:'Courier New',monospace;background:#f1f3f4;padding:1px 4px;border-radius:3px;}
table{border-collapse:collapse;width:100%;margin:10pt 0;}th,td{border:1px solid #bfbfbf;padding:5pt 8pt;text-align:left;vertical-align:top;}th{background:#f1f3f4;}
img{max-width:100%;height:auto;}a{color:#0b57d0;}hr{border:none;border-top:1px solid #dadce0;margin:14pt 0;}
mark.cfd-comment{background:#fff59d;}
section + section{margin-top:32pt;padding-top:16pt;border-top:1px dashed #dadce0;}
`;

function htmlToPlainText(html: string): string {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;width:800px;white-space:pre-wrap;";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const text = holder.innerText;
  holder.remove();
  return text.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/**
 * Exporta el documento al formato indicado mediante el diálogo "Guardar como".
 * Devuelve `false` si el usuario canceló. El formato PDF se gestiona con el
 * diálogo de impresión del sistema, fuera de esta función.
 */
export async function exportDocument(
  doc: CoffeDocument,
  format: Exclude<ExportFormat, "pdf">
): Promise<boolean> {
  const title = doc.metadata.title.trim() || DEFAULT_TITLE;
  const sections = doc.tabs.map((tab) => tab.content);
  let data: Uint8Array | string;
  let filterName: string;

  switch (format) {
    case "cfd":
      data = serializeCfd(doc);
      filterName = "Documento de CoffeDoc";
      break;
    case "docx": {
      const { htmlToDocx } = await import("./docxExport");
      data = await htmlToDocx(sections, doc.settings, {
        title,
        author: doc.metadata.author,
      });
      filterName = "Documento de Word";
      break;
    }
    case "md":
      data = sections.map(htmlToMarkdown).join("\n---\n\n");
      filterName = "Markdown";
      break;
    case "html": {
      const body =
        doc.tabs.length > 1
          ? doc.tabs.map((tab) => `<section>${tab.content}</section>`).join("\n")
          : sections[0];
      data = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(
        title
      )}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
      filterName = "Página web";
      break;
    }
    case "txt":
      data = sections.map(htmlToPlainText).join("\n\n");
      filterName = "Texto sin formato";
      break;
  }

  const saved = await saveFileAs(
    `${title}.${format}`,
    [{ name: filterName, extensions: [format] }],
    data,
    "Exportar documento"
  );
  return saved !== null;
}

/** "Guardar como": elige una nueva ubicación para el archivo .cfd. */
export async function saveDocumentAs(doc: CoffeDocument): Promise<string | null> {
  const title = doc.metadata.title.trim() || DEFAULT_TITLE;
  return saveFileAs(
    `${title}.${NATIVE_EXTENSION}`,
    [{ name: "Documento de CoffeDoc", extensions: [NATIVE_EXTENSION] }],
    serializeCfd(doc),
    "Guardar documento como"
  );
}
