// Conversión entre HTML y Markdown para importar y exportar archivos .md

import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

let turndown: TurndownService | null = null;

/** Convierte el HTML del documento en Markdown (con tablas y tachado GFM). */
export function htmlToMarkdown(html: string): string {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      hr: "---",
    });
    turndown.use(gfm);
  }
  // Los saltos de línea dentro de celdas romperían las tablas de Markdown
  const holder = document.createElement("div");
  holder.innerHTML = html;
  holder.querySelectorAll("td br, th br").forEach((br) => br.replaceWith(" "));
  return turndown.turndown(holder.innerHTML).trim() + "\n";
}

/** Convierte Markdown en HTML listo para el editor. */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
}
