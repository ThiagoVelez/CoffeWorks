// Operaciones sobre el área de redacción (contentEditable) de CoffeDoc.
//
// Centraliza el acceso al editor para que la barra de herramientas, los menús
// y los atajos de teclado compartan la misma lógica: conservar la selección al
// pulsar un botón, aplicar formato, editar tablas, buscar texto, etc.

import type { FormatState } from "../types";

export const EDITOR_ID = "cfd-editor";

let lastRange: Range | null = null;
let pendingFontSize: number | null = null;

export function getEditor(): HTMLElement | null {
  return document.getElementById(EDITOR_ID);
}

function isInsideEditor(node: Node | null): boolean {
  const editor = getEditor();
  return Boolean(editor && node && editor.contains(node));
}

/** Guarda la selección actual si está dentro del editor. */
export function rememberSelection(): void {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && isInsideEditor(selection.anchorNode)) {
    lastRange = selection.getRangeAt(0).cloneRange();
  }
}

/** Devuelve el foco al editor recuperando la última selección conocida. */
export function focusEditor(): void {
  const editor = getEditor();
  if (!editor) return;
  const selection = window.getSelection();
  const alreadyInside = selection && selection.rangeCount > 0 && isInsideEditor(selection.anchorNode);
  editor.focus({ preventScroll: true });
  if (alreadyInside || !selection) return;

  if (lastRange && isInsideEditor(lastRange.startContainer)) {
    selection.removeAllRanges();
    selection.addRange(lastRange);
  } else {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/** Notifica al editor que su contenido cambió por una operación programática. */
export function notifyChange(): void {
  getEditor()?.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Ejecuta un comando de edición enriquecida sobre la selección. */
export function exec(command: string, value?: string): void {
  focusEditor();
  try {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
  } catch (err) {
    console.warn("Comando de edición no disponible:", command, err);
  }
  rememberSelection();
  notifyChange();
}

const BLOCK_SELECTOR = "ul, ol, table, h1, h2, h3, h4, h5, h6, blockquote, pre, p, div, hr";

/**
 * Corrige el HTML inválido que generan los navegadores al crear listas o
 * tablas dentro de un párrafo (<p><ul>…</ul></p>): saca los bloques del
 * párrafo y conserva la posición del cursor.
 */
export function normalizeStructure(): void {
  const editor = getEditor();
  if (!editor) return;
  const offenders = Array.from(editor.querySelectorAll("p")).filter((p) =>
    Array.from(p.children).some((child) => child.matches(BLOCK_SELECTOR))
  );
  if (offenders.length === 0) return;

  // Los nodos se mueven sin recrearse, así que basta con volver a apuntar la
  // selección a los mismos nodos una vez reorganizado el árbol.
  const selection = window.getSelection();
  const saved =
    selection && selection.rangeCount > 0 && isInsideEditor(selection.anchorNode)
      ? {
          anchorNode: selection.anchorNode as Node,
          anchorOffset: selection.anchorOffset,
          focusNode: selection.focusNode as Node,
          focusOffset: selection.focusOffset,
        }
      : null;

  for (const paragraph of offenders) {
    const parent = paragraph.parentNode;
    if (!parent) continue;
    let inlineHolder: HTMLParagraphElement | null = null;
    for (const child of Array.from(paragraph.childNodes)) {
      const isBlock = child.nodeType === Node.ELEMENT_NODE && (child as Element).matches(BLOCK_SELECTOR);
      if (isBlock) {
        inlineHolder = null;
        parent.insertBefore(child, paragraph);
      } else if (child.nodeType === Node.TEXT_NODE && !(child.textContent || "").trim() && !inlineHolder) {
        child.remove();
      } else {
        if (!inlineHolder) {
          inlineHolder = document.createElement("p");
          for (const attr of Array.from(paragraph.attributes)) {
            inlineHolder.setAttribute(attr.name, attr.value);
          }
          parent.insertBefore(inlineHolder, paragraph);
        }
        inlineHolder.appendChild(child);
      }
    }
    paragraph.remove();
  }
  if (saved && selection && editor.contains(saved.anchorNode) && editor.contains(saved.focusNode)) {
    try {
      selection.setBaseAndExtent(
        saved.anchorNode,
        saved.anchorOffset,
        saved.focusNode,
        saved.focusOffset
      );
    } catch {
      // Si la posición ya no es válida se deja la selección que decida el navegador.
    }
  }
}

/** Sustituye los marcadores temporales de tamaño por el tamaño real en puntos. */
export function fixupFontSizes(): void {
  const editor = getEditor();
  if (!editor || pendingFontSize === null) return;
  editor.querySelectorAll<HTMLElement>("span, font").forEach((el) => {
    const isMarker = el.style.fontSize.includes("xxx-large") || el.getAttribute("size") === "7";
    if (isMarker) {
      el.removeAttribute("size");
      el.style.fontSize = `${pendingFontSize}pt`;
    }
  });
}

/** Aplica un tamaño de fuente exacto (en puntos) a la selección. */
export function applyFontSize(points: number): void {
  pendingFontSize = points;
  focusEditor();
  document.execCommand("styleWithCSS", false, "true");
  // execCommand solo admite 7 tamaños: se marca con el mayor y se corrige después
  document.execCommand("fontSize", false, "7");
  fixupFontSizes();
  rememberSelection();
  notifyChange();
}

export function insertHtml(html: string): void {
  focusEditor();
  document.execCommand("insertHTML", false, html);
  rememberSelection();
  notifyChange();
}

function closestInEditor(selector: string): HTMLElement | null {
  const selection = window.getSelection();
  let node: Node | null =
    selection && selection.rangeCount > 0 && isInsideEditor(selection.anchorNode)
      ? selection.anchorNode
      : lastRange?.startContainer || null;
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  const editor = getEditor();
  const found = (node as HTMLElement | null)?.closest?.(selector) as HTMLElement | null;
  return found && editor?.contains(found) ? found : null;
}

function rgbToHex(color: string): string {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (!match) return color;
  return (
    "#" +
    [match[1], match[2], match[3]].map((p) => Number(p).toString(16).padStart(2, "0")).join("")
  );
}

/** Lee el formato en la posición del cursor para reflejarlo en la barra. */
export function readFormatState(): FormatState | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !isInsideEditor(selection.anchorNode)) {
    return null;
  }
  let element: Node | null = selection.anchorNode;
  if (element && element.nodeType === Node.TEXT_NODE) element = element.parentNode;
  if (!(element instanceof HTMLElement)) return null;

  const computed = window.getComputedStyle(element);
  const state = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };

  const blockElement = element.closest("h1, h2, h3, h4, h5, h6, pre, blockquote, p, li, div");
  let block = blockElement ? blockElement.tagName.toLowerCase() : "p";
  if (block === "li" || block === "div") block = "p";
  const quote = element.closest("blockquote");
  if (quote && !quote.getAttribute("style") && isInsideEditor(quote)) block = "blockquote";

  const align = computed.textAlign;
  return {
    bold: state("bold"),
    italic: state("italic"),
    underline: state("underline"),
    strikethrough: state("strikeThrough"),
    orderedList: state("insertOrderedList"),
    unorderedList: state("insertUnorderedList"),
    align:
      align === "center" ? "center" : align === "right" || align === "end" ? "right" : align === "justify" ? "justify" : "left",
    block,
    fontFamily: computed.fontFamily.split(",")[0].replace(/['"]/g, "").trim(),
    fontSize: Math.round(parseFloat(computed.fontSize) * 0.75 * 2) / 2,
    textColor: rgbToHex(computed.color),
  };
}

// ---------------------------------------------------------------------------
// Copiar formato
// ---------------------------------------------------------------------------

export interface CapturedFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontFamily: string;
  fontSize: number;
  textColor: string;
}

export function captureFormat(): CapturedFormat | null {
  const state = readFormatState();
  if (!state) return null;
  return {
    bold: state.bold,
    italic: state.italic,
    underline: state.underline,
    strikethrough: state.strikethrough,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    textColor: state.textColor,
  };
}

export function applyCapturedFormat(format: CapturedFormat): void {
  const current = readFormatState();
  if (!current) return;
  focusEditor();
  document.execCommand("styleWithCSS", false, "true");
  const toggle = (command: string, wanted: boolean, actual: boolean) => {
    if (wanted !== actual) document.execCommand(command, false);
  };
  toggle("bold", format.bold, current.bold);
  toggle("italic", format.italic, current.italic);
  toggle("underline", format.underline, current.underline);
  toggle("strikeThrough", format.strikethrough, current.strikethrough);
  document.execCommand("fontName", false, format.fontFamily);
  document.execCommand("foreColor", false, format.textColor);
  applyFontSize(format.fontSize);
}

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

export function buildTableHtml(rows: number, cols: number, withHeader: boolean): string {
  const cell = (tag: string, text: string) => `<${tag}>${text || "<br>"}</${tag}>`;
  let html = '<table class="cfd-table"><tbody>';
  for (let r = 0; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) {
      html += withHeader && r === 0 ? cell("th", `Encabezado ${c + 1}`) : cell("td", "");
    }
    html += "</tr>";
  }
  html += "</tbody></table><p><br></p>";
  return html;
}

export function currentTableCell(): HTMLTableCellElement | null {
  return closestInEditor("td, th") as HTMLTableCellElement | null;
}

function placeCaretIn(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  rememberSelection();
}

export type TableAction =
  | "row-above"
  | "row-below"
  | "col-left"
  | "col-right"
  | "delete-row"
  | "delete-col"
  | "delete-table";

export function tableAction(action: TableAction): void {
  const cell = currentTableCell();
  if (!cell) return;
  const row = cell.parentElement as HTMLTableRowElement;
  const table = cell.closest("table") as HTMLTableElement;
  const columnIndex = cell.cellIndex;

  const newCell = () => {
    const td = document.createElement("td");
    td.innerHTML = "<br>";
    return td;
  };

  switch (action) {
    case "row-above":
    case "row-below": {
      const fresh = document.createElement("tr");
      for (let i = 0; i < row.cells.length; i++) fresh.appendChild(newCell());
      row.parentElement?.insertBefore(fresh, action === "row-above" ? row : row.nextSibling);
      placeCaretIn(fresh.cells[Math.min(columnIndex, fresh.cells.length - 1)]);
      break;
    }
    case "col-left":
    case "col-right": {
      for (const tr of Array.from(table.rows)) {
        const reference = tr.cells[Math.min(columnIndex, tr.cells.length - 1)];
        const isHeader = reference?.tagName === "TH";
        const fresh = isHeader ? document.createElement("th") : newCell();
        if (isHeader) fresh.innerHTML = "<br>";
        tr.insertBefore(fresh, action === "col-left" ? reference : reference?.nextSibling || null);
      }
      break;
    }
    case "delete-row": {
      if (table.rows.length <= 1) {
        table.remove();
      } else {
        const neighbour = (row.nextElementSibling || row.previousElementSibling) as HTMLTableRowElement | null;
        row.remove();
        if (neighbour) placeCaretIn(neighbour.cells[Math.min(columnIndex, neighbour.cells.length - 1)]);
      }
      break;
    }
    case "delete-col": {
      if (row.cells.length <= 1) {
        table.remove();
      } else {
        for (const tr of Array.from(table.rows)) {
          tr.cells[Math.min(columnIndex, tr.cells.length - 1)]?.remove();
        }
        placeCaretIn(row.cells[Math.min(columnIndex, row.cells.length - 1)]);
      }
      break;
    }
    case "delete-table":
      table.remove();
      break;
  }
  notifyChange();
}

// ---------------------------------------------------------------------------
// Enlaces, comentarios e imágenes
// ---------------------------------------------------------------------------

export function currentLink(): HTMLAnchorElement | null {
  return closestInEditor("a[href]") as HTMLAnchorElement | null;
}

export function currentComment(): HTMLElement | null {
  return closestInEditor("mark.cfd-comment");
}

export function selectedText(): string {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && isInsideEditor(selection.anchorNode)) {
    return selection.toString();
  }
  return lastRange ? lastRange.toString() : "";
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inserta o actualiza un hipervínculo. */
export function applyLink(url: string, text: string): void {
  let href = url.trim();
  if (href && !/^[a-z][a-z0-9+.-]*:|^#|^\//i.test(href)) href = `https://${href}`;
  const existing = currentLink();
  if (existing) {
    existing.href = href;
    if (text && text !== existing.textContent) existing.textContent = text;
    notifyChange();
    return;
  }
  const label = text || selectedText() || href;
  insertHtml(`<a href="${escapeAttribute(href)}">${escapeText(label)}</a>`);
}

export function removeLink(): void {
  const link = currentLink();
  if (!link) return;
  const parent = link.parentNode;
  while (link.firstChild) parent?.insertBefore(link.firstChild, link);
  link.remove();
  notifyChange();
}

/** Marca la selección con un comentario. */
export function addComment(comment: string): boolean {
  focusEditor();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  const mark = document.createElement("mark");
  mark.className = "cfd-comment";
  mark.dataset.comment = comment;
  mark.title = comment;
  try {
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  } catch {
    return false;
  }
  selection.removeAllRanges();
  notifyChange();
  return true;
}

export function updateComment(mark: HTMLElement, comment: string): void {
  mark.dataset.comment = comment;
  mark.title = comment;
  notifyChange();
}

export function resolveComment(mark: HTMLElement): void {
  const parent = mark.parentNode;
  while (mark.firstChild) parent?.insertBefore(mark.firstChild, mark);
  mark.remove();
  parent?.normalize();
  notifyChange();
}

export function insertImage(src: string, alt = ""): void {
  insertHtml(
    `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" style="max-width:100%;">`
  );
}

// ---------------------------------------------------------------------------
// Buscar y reemplazar
// ---------------------------------------------------------------------------

export interface FindOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

/** Localiza todas las apariciones del texto dentro del editor. */
export function findMatches(query: string, options: FindOptions): Range[] {
  const editor = getEditor();
  if (!editor || !query) return [];

  // Se concatena el texto de todos los nodos para encontrar coincidencias que
  // atraviesan fragmentos con formato distinto.
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes: Array<{ node: Text; start: number }> = [];
  let text = "";
  let current = walker.nextNode() as Text | null;
  while (current) {
    nodes.push({ node: current, start: text.length });
    text += current.data;
    current = walker.nextNode() as Text | null;
  }

  const haystack = options.matchCase ? text : text.toLocaleLowerCase();
  const needle = options.matchCase ? query : query.toLocaleLowerCase();
  const isWordChar = (ch: string | undefined) => Boolean(ch && /[\p{L}\p{N}_]/u.test(ch));

  const locate = (offset: number) => {
    let low = 0;
    let high = nodes.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (nodes[mid].start <= offset) low = mid;
      else high = mid - 1;
    }
    return { node: nodes[low].node, offset: offset - nodes[low].start };
  };

  const ranges: Range[] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1 && nodes.length > 0) {
    const end = index + needle.length;
    const boundaryOk =
      !options.wholeWord || (!isWordChar(text[index - 1]) && !isWordChar(text[end]));
    if (boundaryOk) {
      const from = locate(index);
      const to = locate(end - 1);
      const range = document.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset + 1);
      ranges.push(range);
    }
    index = haystack.indexOf(needle, index + Math.max(1, needle.length));
  }
  return ranges;
}

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

/** Resalta todas las coincidencias (API CSS Highlight, si está disponible). */
export function highlightMatches(ranges: Range[], activeIndex: number): void {
  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  const HighlightCtor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown })
    .Highlight;
  if (!registry || !HighlightCtor) return;
  registry.delete("cfd-find");
  registry.delete("cfd-find-active");
  if (ranges.length === 0) return;
  registry.set("cfd-find", new HighlightCtor(...ranges));
  if (ranges[activeIndex]) {
    registry.set("cfd-find-active", new HighlightCtor(ranges[activeIndex]));
  }
}

export function clearHighlights(): void {
  highlightMatches([], -1);
}

/** Lleva una coincidencia a la vista y la selecciona. */
export function revealRange(range: Range): void {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range.cloneRange());
  rememberSelection();
  const target =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : (range.startContainer as HTMLElement);
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** Reemplaza el texto de un rango conservando el formato del primer fragmento. */
export function replaceRange(range: Range, replacement: string): void {
  range.deleteContents();
  if (replacement) range.insertNode(document.createTextNode(replacement));
  range.commonAncestorContainer.normalize?.();
}

// ---------------------------------------------------------------------------
// Posición del cursor (para deshacer / rehacer)
// ---------------------------------------------------------------------------

/** Desplazamiento del cursor en caracteres desde el inicio del editor. */
export function getCaretOffset(): number | null {
  const editor = getEditor();
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0 || !isInsideEditor(selection.focusNode)) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.focusNode as Node, selection.focusOffset);
  return range.toString().length;
}

export function setCaretOffset(offset: number | null): void {
  const editor = getEditor();
  if (!editor) return;
  editor.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();

  if (offset === null) {
    range.selectNodeContents(editor);
    range.collapse(false);
  } else {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode() as Text | null;
    let placed = false;
    while (node) {
      if (remaining <= node.data.length) {
        range.setStart(node, remaining);
        placed = true;
        break;
      }
      remaining -= node.data.length;
      node = walker.nextNode() as Text | null;
    }
    if (!placed) range.selectNodeContents(editor);
    range.collapse(placed);
  }
  selection.removeAllRanges();
  selection.addRange(range);
  rememberSelection();
}

/** Encabezados del documento, en orden de aparición. */
export function headingElements(): HTMLElement[] {
  const editor = getEditor();
  return editor ? Array.from(editor.querySelectorAll<HTMLElement>("h1, h2, h3")) : [];
}
