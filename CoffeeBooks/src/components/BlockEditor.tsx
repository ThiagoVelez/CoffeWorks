// Editor de bloques al estilo de Notion: cada bloque es un párrafo editable;
// «/» abre el menú de bloques, los atajos de Markdown cambian el tipo y el
// asa ⋮⋮ permite arrastrar, convertir, colorear, duplicar o borrar.

import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical, Plus, ChevronRight, Trash2, Copy, ImagePlus, FileText, Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, MessageSquare, Code2, Minus, Table, ListCollapse } from "lucide-react";
import type { Block, BlockColor, BlockType, Workspace } from "../types";
import { COLOR_NAME, COLOR_STYLE } from "../types";
import { block, escapeHtml, htmlToText, markdownToBlocks, sanitize } from "../services/model";

// ---------------------------------------------------------------------------
// Contexto de foco: tras crear o unir bloques se coloca el cursor
// ---------------------------------------------------------------------------

type FocusAt = { id: string; at: "start" | "end" | number } | null;
interface EditorCtx {
  focus: React.MutableRefObject<FocusAt>;
  workspace: Workspace;
  onOpenPage: (id: string) => void;
  onCreateSubpage: () => string;
  readOnly: boolean;
}
const Ctx = createContext<EditorCtx | null>(null);

export const BLOCK_TYPES: { type: BlockType; label: string; hint: string; icon: React.FC<{ size?: number }>; keys: string }[] = [
  { type: "paragraph", label: "Texto", hint: "Párrafo normal", icon: Type, keys: "texto parrafo" },
  { type: "h1", label: "Título 1", hint: "Encabezado grande (#)", icon: Heading1, keys: "titulo 1 h1 encabezado" },
  { type: "h2", label: "Título 2", hint: "Encabezado mediano (##)", icon: Heading2, keys: "titulo 2 h2" },
  { type: "h3", label: "Título 3", hint: "Encabezado pequeño (###)", icon: Heading3, keys: "titulo 3 h3" },
  { type: "bullet", label: "Lista con viñetas", hint: "Lista simple (-)", icon: List, keys: "lista viñetas bullet" },
  { type: "numbered", label: "Lista numerada", hint: "Lista con números (1.)", icon: ListOrdered, keys: "lista numerada numero" },
  { type: "todo", label: "Lista de tareas", hint: "Casillas ([])", icon: CheckSquare, keys: "tarea todo casilla checklist" },
  { type: "toggle", label: "Desplegable", hint: "Oculta contenido dentro (>)", icon: ListCollapse, keys: "desplegable toggle" },
  { type: "page", label: "Página", hint: "Subpágina dentro de esta", icon: FileText, keys: "pagina subpagina" },
  { type: "callout", label: "Aviso", hint: "Texto destacado con emoji", icon: MessageSquare, keys: "aviso callout nota destacado" },
  { type: "quote", label: "Cita", hint: "Cita (\")", icon: Quote, keys: "cita quote" },
  { type: "code", label: "Código", hint: "Bloque de código (```)", icon: Code2, keys: "codigo code" },
  { type: "table", label: "Tabla", hint: "Tabla sencilla", icon: Table, keys: "tabla table" },
  { type: "image", label: "Imagen", hint: "Sube una imagen o pega un enlace", icon: ImagePlus, keys: "imagen foto image" },
  { type: "divider", label: "Separador", hint: "Línea divisoria (---)", icon: Minus, keys: "separador divisor linea" },
];

const TEXT_TYPES = new Set<BlockType>(["paragraph", "h1", "h2", "h3", "bullet", "numbered", "todo", "toggle", "quote", "callout"]);
/** Quita etiquetas de formato vacías que deja el navegador (<b></b>...). */
const dropEmpty = (html: string) => {
  let out = html;
  for (let i = 0; i < 3; i++) out = out.replace(/<(b|i|u|s|code|mark|strong|em)(\s[^>]*)?>\s*<\/\1>/g, "");
  return out;
};

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------------------
// Texto editable
// ---------------------------------------------------------------------------

function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return r.toString().length;
}

function placeCaret(el: HTMLElement, at: "start" | "end" | number) {
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  if (at === "start") r.setStart(el, 0);
  else if (at === "end") {
    r.selectNodeContents(el);
    r.collapse(false);
  } else {
    // Posición en caracteres
    let left = at;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const len = node.textContent?.length || 0;
      if (left <= len) {
        r.setStart(node, left);
        break;
      }
      left -= len;
      node = walker.nextNode();
    }
    if (!node) {
      r.selectNodeContents(el);
      r.collapse(false);
    }
  }
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

const Editable: React.FC<{
  id: string;
  html: string;
  placeholder?: string;
  className?: string;
  plain?: boolean;
  onHtml: (html: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>, el: HTMLDivElement) => void;
  onPasteText?: (text: string, el: HTMLDivElement) => boolean;
}> = ({ id, html, placeholder, className, plain, onHtml, onKeyDown, onPasteText }) => {
  const ref = useRef<HTMLDivElement>(null);
  const ctx = useContext(Ctx)!;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);
  useLayoutEffect(() => {
    const f = ctx.focus.current;
    if (f && f.id === id && ref.current) {
      ctx.focus.current = null;
      placeCaret(ref.current, f.at);
    }
  });
  return (
    <div
      ref={ref}
      contentEditable={!ctx.readOnly}
      suppressContentEditableWarning
      spellCheck
      data-block-text={id}
      data-placeholder={placeholder}
      className={`outline-none min-h-[1.5em] whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#c7c6c4] ${className || ""}`}
      onInput={(e) => {
        const el = e.currentTarget;
        if (el.innerHTML === "<br>") el.innerHTML = "";
        onHtml(plain ? escapeHtml(el.innerText).replace(/\n/g, "<br>") : el.innerHTML);
      }}
      onKeyDown={(e) => onKeyDown?.(e, e.currentTarget)}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        if (onPasteText?.(text, e.currentTarget)) return;
        const htmlData = e.clipboardData.getData("text/html");
        document.execCommand("insertHTML", false, plain || !htmlData ? escapeHtml(text).replace(/\n/g, "<br>") : sanitize(htmlData));
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Lista de bloques
// ---------------------------------------------------------------------------

export const BlockEditor: React.FC<{
  blocks: Block[];
  onChange: (blocks: Block[], key?: string) => void;
  workspace: Workspace;
  onOpenPage: (id: string) => void;
  onCreateSubpage: () => string;
  readOnly?: boolean;
}> = ({ blocks, onChange, workspace, onOpenPage, onCreateSubpage, readOnly }) => {
  const focus = useRef<FocusAt>(null);
  return (
    <Ctx.Provider value={{ focus, workspace, onOpenPage, onCreateSubpage, readOnly: !!readOnly }}>
      <BlockList blocks={blocks} onChange={onChange} />
      {!readOnly && (
        <div
          className="h-24 cursor-text"
          onClick={() => {
            const last = blocks[blocks.length - 1];
            if (last && last.type === "paragraph" && !last.text) focus.current = { id: last.id, at: "end" };
            else {
              const b = block();
              focus.current = { id: b.id, at: "start" };
              onChange([...blocks, b]);
            }
            // Fuerza el foco aunque no cambien los bloques
            setTimeout(() => {
              const id = focus.current?.id;
              const el = id ? (document.querySelector(`[data-block-text="${id}"]`) as HTMLElement | null) : null;
              if (el) {
                placeCaret(el, "end");
                focus.current = null;
              }
            }, 0);
          }}
        />
      )}
    </Ctx.Provider>
  );
};

const BlockList: React.FC<{ blocks: Block[]; onChange: (blocks: Block[], key?: string) => void; depth?: number }> = ({ blocks, onChange, depth = 0 }) => {
  const ctx = useContext(Ctx)!;
  const [slash, setSlash] = useState<{ id: string; query: string; sel: number } | null>(null);
  const slashList = slash ? BLOCK_TYPES.filter((t) => fold(`${t.label} ${t.keys}`).includes(fold(slash.query))) : [];
  const pickSlash = (b: Block, t: BlockType) => {
    // Quita el «/consulta» escrito
    const el = document.querySelector(`[data-block-text="${b.id}"]`) as HTMLElement | null;
    // Solo el «/consulta» final (puede ir seguido de etiquetas de cierre)
    const q = (slash?.query || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const html = dropEmpty((el?.innerHTML || b.text).replace(new RegExp(`/${q}(?=(?:<[^>]*>)*$)`), ""));
    convert({ ...b, text: html }, t);
  };
  const [menu, setMenu] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const update = (id: string, patch: Partial<Block>, key = "") => onChange(blocksRef.current.map((b) => (b.id === id ? { ...b, ...patch } : b)), key);
  const insertAfter = (id: string, ...nb: Block[]) => {
    const i = blocksRef.current.findIndex((b) => b.id === id);
    const next = blocksRef.current.slice();
    next.splice(i + 1, 0, ...nb);
    onChange(next);
  };
  const remove = (id: string) => onChange(blocksRef.current.filter((b) => b.id !== id));

  const convert = (b: Block, type: BlockType) => {
    setSlash(null);
    setMenu(null);
    const patch: Partial<Block> = { type };
    if (type === "todo") patch.checked = false;
    if (type === "toggle") {
      patch.open = true;
      patch.children = b.children || [block()];
    }
    if (type === "callout") patch.emoji = b.emoji || "💡";
    if (type === "table") patch.rows = [["", "", ""], ["", "", ""]];
    if (type === "code") patch.text = escapeHtml(htmlToText(b.text)).replace(/\n/g, "<br>");
    if (type === "page") {
      patch.pageId = ctx.onCreateSubpage();
      patch.text = "";
    }
    if (type === "divider" || type === "image" || type === "table" || type === "page") {
      // Estos bloques no se escriben: se añade un párrafo detrás
      const after = block();
      const i = blocksRef.current.findIndex((x) => x.id === b.id);
      const next = blocksRef.current.slice();
      next[i] = { ...b, ...patch, text: type === "divider" || type === "image" ? "" : patch.text ?? b.text };
      next.splice(i + 1, 0, after);
      ctx.focus.current = { id: after.id, at: "start" };
      onChange(next);
      return;
    }
    ctx.focus.current = { id: b.id, at: "end" };
    update(b.id, { text: b.text, ...patch });
  };

  /** Atajos de Markdown al escribir al principio de un párrafo. */
  const markdownShortcut = (b: Block, html: string): boolean => {
    if (b.type !== "paragraph") return false;
    const text = htmlToText(html);
    const rules: [RegExp, BlockType, Partial<Block>?][] = [
      [/^#\s/, "h1"],
      [/^##\s/, "h2"],
      [/^###\s/, "h3"],
      [/^[-*]\s/, "bullet"],
      [/^1[.)]\s/, "numbered"],
      [/^\[\s?\]\s/, "todo", { checked: false }],
      [/^\[x\]\s/i, "todo", { checked: true }],
      [/^>\s/, "toggle", { open: true, children: [block()] }],
      [/^["“]\s/, "quote"],
      [/^```$/, "code"],
      [/^---$/, "divider"],
    ];
    for (const [re, type, extra] of rules) {
      const m = text.match(re);
      if (!m) continue;
      if (type === "divider" || type === "code") {
        convert({ ...b, text: "" }, type);
        return true;
      }
      // Quita el prefijo escrito (el espacio puede llegar como &nbsp;)
      let stripped = html;
      for (const ch of m[0]) stripped = /\s/.test(ch) && stripped.startsWith("&nbsp;") ? stripped.slice(6) : stripped.slice(ch === ">" && stripped.startsWith("&gt;") ? 4 : 1);
      ctx.focus.current = { id: b.id, at: "start" };
      update(b.id, { type, text: stripped, ...(extra || {}) });
      return true;
    }
    return false;
  };

  const onKey = (b: Block, i: number) => (e: React.KeyboardEvent<HTMLDivElement>, el: HTMLDivElement) => {
    if (slash && slash.id === b.id && slashList.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setSlash({ ...slash, sel: Math.max(0, Math.min(slashList.length - 1, slash.sel + d)) });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickSlash(b, slashList[Math.min(slash.sel, slashList.length - 1)].type);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "e") {
      e.preventDefault();
      const t = window.getSelection()?.toString() || "";
      if (t) document.execCommand("insertHTML", false, `<code>${escapeHtml(t)}</code>`);
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      document.execCommand("strikeThrough");
      return;
    }
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      e.stopPropagation();
      const url = window.prompt("Enlace (https://...)");
      if (url && /^(https?:|mailto:)/i.test(url)) document.execCommand("createLink", false, url);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      if (b.type === "code") return; // salto de línea normal
      e.preventDefault();
      const listy = b.type === "bullet" || b.type === "numbered" || b.type === "todo";
      if (listy && !el.innerText.trim()) {
        // Lista vacía + Intro: vuelve a párrafo
        ctx.focus.current = { id: b.id, at: "start" };
        update(b.id, { type: "paragraph" });
        return;
      }
      // Divide el texto en el cursor
      const sel = window.getSelection();
      let after = "";
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const tail = document.createRange();
        tail.setStart(r.endContainer, r.endOffset);
        tail.setEnd(el, el.childNodes.length);
        const frag = tail.extractContents();
        const tmp = document.createElement("div");
        tmp.appendChild(frag);
        after = dropEmpty(tmp.innerHTML.replace(/^<br>$/, ""));
      }
      const before = dropEmpty(el.innerHTML.replace(/<br>$/, ""));
      const nb = block(listy ? b.type : "paragraph", after, b.type === "todo" ? { checked: false } : {});
      ctx.focus.current = { id: nb.id, at: "start" };
      const next = blocksRef.current.slice();
      next[i] = { ...b, text: before };
      if (b.type === "toggle" && b.open) {
        next[i] = { ...next[i], children: [nb, ...(b.children || [])] };
        onChange(next);
        return;
      }
      next.splice(i + 1, 0, nb);
      onChange(next);
      return;
    }
    if (e.key === "Backspace" && caretOffset(el) === 0 && !window.getSelection()?.toString()) {
      if (b.type !== "paragraph") {
        e.preventDefault();
        ctx.focus.current = { id: b.id, at: "start" };
        update(b.id, { type: "paragraph" });
        return;
      }
      const prev = blocksRef.current[i - 1];
      if (!prev) return;
      e.preventDefault();
      if (TEXT_TYPES.has(prev.type)) {
        const len = htmlToText(prev.text).length;
        ctx.focus.current = { id: prev.id, at: len };
        onChange(blocksRef.current.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, text: x.text + el.innerHTML } : x)));
      } else if (!el.innerText.trim()) {
        remove(b.id);
      }
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const up = e.key === "ArrowUp";
      const len = el.innerText.length;
      const off = caretOffset(el);
      if ((up && off === 0) || (!up && off >= len)) {
        const all = [...document.querySelectorAll<HTMLElement>("[data-block-text]")];
        const k = all.indexOf(el);
        const target = all[k + (up ? -1 : 1)];
        if (target) {
          e.preventDefault();
          placeCaret(target, up ? "end" : "start");
        }
      }
    }
    if (e.key === "Tab" && (b.type === "bullet" || b.type === "numbered" || b.type === "todo")) {
      // Sangría: mete el bloque en un desplegable anterior no hay; se usa color gris
      e.preventDefault();
    }
  };

  const onDrop = (to: number, e: React.DragEvent) => {
    setDropAt(null);
    const id = e.dataTransfer.getData("text/coffee-block");
    const from = blocksRef.current.findIndex((b) => b.id === id);
    if (from < 0) return;
    const next = blocksRef.current.slice();
    const [m] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, m);
    onChange(next);
  };

  let num = 0;
  return (
    <div className="flex flex-col" data-depth={depth}>
      {blocks.map((b, i) => {
        num = b.type === "numbered" ? num + 1 : 0;
        const color = b.color && b.color !== "default" ? COLOR_STYLE[b.color] : null;
        return (
          <div
            key={b.id}
            className="group relative"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("text/coffee-block")) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
            }}
            onDragLeave={() => setDropAt(null)}
            onDrop={(e) => onDrop(dropAt ?? i, e)}
            data-block={b.type}
          >
            {dropAt === i && <div className="absolute -top-px left-0 right-0 h-[3px] bg-[#2383e2] rounded z-10" />}
            {dropAt === i + 1 && i === blocks.length - 1 && <div className="absolute -bottom-px left-0 right-0 h-[3px] bg-[#2383e2] rounded z-10" />}
            {!ctx.readOnly && (
              <div className="absolute -left-12 top-[3px] flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" title="Añadir un bloque debajo" className="p-0.5 rounded text-[#a5a4a1] hover:bg-[#ebebea]" onClick={() => {
                  const nb = block();
                  ctx.focus.current = { id: nb.id, at: "start" };
                  insertAfter(b.id, nb);
                }}>
                  <Plus size={16} />
                </button>
                <button type="button" title="Arrastra para mover · clic para opciones" draggable className="p-0.5 rounded text-[#a5a4a1] hover:bg-[#ebebea] cursor-grab" onDragStart={(e) => e.dataTransfer.setData("text/coffee-block", b.id)} onClick={() => setMenu(menu === b.id ? null : b.id)} data-handle>
                  <GripVertical size={16} />
                </button>
              </div>
            )}
            {menu === b.id && (
              <BlockMenu
                b={b}
                onClose={() => setMenu(null)}
                onConvert={(t) => convert(b, t)}
                onColor={(c) => (setMenu(null), update(b.id, { color: c }))}
                onDuplicate={() => (setMenu(null), insertAfter(b.id, { ...structuredClone(b), id: block().id }))}
                onDelete={() => (setMenu(null), remove(b.id))}
              />
            )}
            <div className="py-[3px]" style={color ? { color: color.fg } : undefined}>
              <BlockBody b={b} i={i} num={num} update={update} onKey={onKey(b, i)} onSlash={(q) => setSlash(q === null ? null : { id: b.id, query: q, sel: 0 })} markdownShortcut={markdownShortcut} insertAfter={insertAfter} onChildren={(children, key) => update(b.id, { children }, key)} depth={depth} />
            </div>
            {slash?.id === b.id && slashList.length > 0 && <SlashMenu list={slashList} sel={slash.sel} onHover={(i) => setSlash({ ...slash, sel: i })} onPick={(t) => pickSlash(b, t)} />}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cuerpo de cada tipo de bloque
// ---------------------------------------------------------------------------

const TEXT_CLASS: Partial<Record<BlockType, string>> = {
  h1: "text-[1.875em] font-bold leading-tight mt-6",
  h2: "text-[1.5em] font-semibold leading-tight mt-4",
  h3: "text-[1.25em] font-semibold leading-tight mt-2",
};

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  paragraph: "Escribe o pulsa «/» para los comandos…",
  h1: "Título 1",
  h2: "Título 2",
  h3: "Título 3",
  bullet: "Lista",
  numbered: "Lista",
  todo: "Tarea",
  toggle: "Desplegable",
  quote: "Cita",
  callout: "Escribe algo…",
};

const BlockBody: React.FC<{
  b: Block;
  i: number;
  num: number;
  depth: number;
  update: (id: string, patch: Partial<Block>, key?: string) => void;
  onKey: (e: React.KeyboardEvent<HTMLDivElement>, el: HTMLDivElement) => void;
  onSlash: (q: string | null) => void;
  markdownShortcut: (b: Block, html: string) => boolean;
  insertAfter: (id: string, ...nb: Block[]) => void;
  onChildren: (children: Block[], key?: string) => void;
}> = ({ b, num, depth, update, onKey, onSlash, markdownShortcut, insertAfter, onChildren }) => {
  const ctx = useContext(Ctx)!;
  const text = (cls = "", ph = PLACEHOLDER[b.type]) => (
    <Editable
      id={b.id}
      html={b.text}
      placeholder={ph}
      className={cls}
      onHtml={(html) => {
        if (markdownShortcut(b, html)) return;
        const t = htmlToText(html);
        const m = t.match(/(?:^|\s)\/([^\s/]*)$/);
        onSlash(m ? m[1] : null);
        update(b.id, { text: html }, `t-${b.id}`);
      }}
      onKeyDown={onKey}
      onPasteText={(pasted) => {
        if (!pasted.includes("\n")) return false;
        const nb = markdownToBlocks(pasted);
        insertAfter(b.id, ...nb);
        return true;
      }}
    />
  );
  switch (b.type) {
    case "paragraph":
    case "h1":
    case "h2":
    case "h3":
      return text(TEXT_CLASS[b.type] || "", b.type === "paragraph" ? undefined : PLACEHOLDER[b.type]);
    case "bullet":
      return (
        <div className="flex gap-2">
          <span className="select-none w-5 text-center leading-[1.5]">{["•", "◦", "▪"][depth % 3]}</span>
          <div className="flex-1 min-w-0">{text()}</div>
        </div>
      );
    case "numbered":
      return (
        <div className="flex gap-2">
          <span className="select-none min-w-5 text-right leading-[1.5]">{num}.</span>
          <div className="flex-1 min-w-0">{text()}</div>
        </div>
      );
    case "todo":
      return (
        <div className="flex gap-2 items-start">
          <input type="checkbox" checked={!!b.checked} onChange={(e) => update(b.id, { checked: e.target.checked })} disabled={ctx.readOnly} className="mt-[5px] w-4 h-4 accent-[#2383e2] cursor-pointer" data-todo />
          <div className={`flex-1 min-w-0 ${b.checked ? "line-through text-[#9b9a97]" : ""}`}>{text()}</div>
        </div>
      );
    case "toggle":
      return (
        <div>
          <div className="flex gap-1 items-start">
            <button type="button" onClick={() => update(b.id, { open: !b.open })} className="mt-[2px] p-0.5 rounded hover:bg-[#ebebea] text-[#37352f]" data-toggle>
              <ChevronRight size={16} className={`transition-transform ${b.open ? "rotate-90" : ""}`} />
            </button>
            <div className="flex-1 min-w-0">{text()}</div>
          </div>
          {b.open && (
            <div className="pl-6">
              <BlockList blocks={b.children?.length ? b.children : [block()]} onChange={onChildren} depth={depth + 1} />
            </div>
          )}
        </div>
      );
    case "quote":
      return <div className="border-l-[3px] border-[#37352f] pl-4 text-[1.05em]">{text()}</div>;
    case "callout": {
      const st = COLOR_STYLE[b.color && b.color !== "default" ? b.color : "default"];
      return (
        <div className="flex gap-3 rounded-md p-4" style={{ background: st.bg }} data-callout>
          <button type="button" className="text-[1.2em] leading-none select-none" title="Cambiar el emoji" onClick={() => {
            const all = ["💡", "📌", "⚠️", "✅", "❗", "🔥", "📎", "🧭", "👥", "☕", "⭐", "📝"];
            update(b.id, { emoji: all[(all.indexOf(b.emoji || "💡") + 1) % all.length] });
          }}>
            {b.emoji || "💡"}
          </button>
          <div className="flex-1 min-w-0 text-[#37352f]">{text()}</div>
        </div>
      );
    }
    case "code":
      return (
        <div className="rounded-md bg-[#f7f6f3] p-4 relative" data-paper>
          <select value={b.lang || ""} onChange={(e) => update(b.id, { lang: e.target.value })} className="absolute top-2 right-2 text-[11px] bg-transparent text-[#787774] outline-none">
            {["", "JavaScript", "TypeScript", "Python", "Rust", "Java", "C#", "SQL", "HTML", "CSS", "JSON", "Bash"].map((l) => (
              <option key={l} value={l}>
                {l || "Texto"}
              </option>
            ))}
          </select>
          <Editable id={b.id} html={b.text} plain placeholder="Código" className="font-mono text-[0.85em] text-[#37352f] leading-relaxed" onHtml={(html) => update(b.id, { text: html }, `t-${b.id}`)} onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              document.execCommand("insertText", false, "  ");
            }
          }} />
        </div>
      );
    case "divider":
      return <hr className="my-2 border-[#e9e9e7]" />;
    case "page": {
      const p = ctx.workspace.pages.find((x) => x.id === b.pageId);
      return (
        <button type="button" onClick={() => p && ctx.onOpenPage(p.id)} className="flex items-center gap-2 w-full text-left px-1 py-1 rounded hover:bg-[#f1f1ef] underline decoration-[#d3d3d1] underline-offset-4" data-page-link>
          <span>{p?.icon || "📄"}</span>
          <span className="font-medium">{p ? p.title || "Sin título" : "Página eliminada"}</span>
        </button>
      );
    }
    case "image":
      return b.src ? (
        <figure className="flex flex-col gap-1">
          <img src={b.src} alt="" className="max-w-full rounded-md" />
          <Editable id={b.id} html={b.text} placeholder="Escribe un pie de foto…" className="text-[0.85em] text-[#787774]" onHtml={(html) => update(b.id, { text: html }, `t-${b.id}`)} />
        </figure>
      ) : (
        <ImagePicker onPick={(src) => update(b.id, { src })} />
      );
    case "table":
      return <SimpleTable rows={b.rows || [[""]]} onChange={(rows, key) => update(b.id, { rows }, key)} readOnly={ctx.readOnly} />;
  }
  return null;
};

const ImagePicker: React.FC<{ onPick: (src: string) => void }> = ({ onPick }) => {
  const [url, setUrl] = useState("");
  return (
    <div className="flex items-center gap-2 rounded-md bg-[#f1f1ef] px-3 py-3 text-[0.9em] text-[#787774]">
      <ImagePlus size={18} />
      <label className="cursor-pointer hover:underline">
        Subir una imagen
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = () => onPick(String(fr.result));
            fr.readAsDataURL(f);
          }}
        />
      </label>
      <span>o</span>
      <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && /^https?:/.test(url) && onPick(url)} placeholder="pega un enlace https://… e Intro" className="flex-1 bg-white rounded px-2 py-1 outline-none text-[#37352f]" />
    </div>
  );
};

const SimpleTable: React.FC<{ rows: string[][]; onChange: (rows: string[][], key?: string) => void; readOnly: boolean }> = ({ rows, onChange, readOnly }) => {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return (
    <div className="overflow-x-auto" data-simple-table>
      <table className="border-collapse text-[0.92em]">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {Array.from({ length: cols }, (_, j) => (
                <td key={j} className={`border border-[#e9e9e7] min-w-[120px] px-2 py-1 ${i === 0 ? "bg-[#f7f6f3] font-semibold" : ""}`}>
                  <input value={r[j] || ""} readOnly={readOnly} onChange={(e) => onChange(rows.map((row, a) => (a === i ? Array.from({ length: cols }, (_, b) => (b === j ? e.target.value : row[b] || "")) : row)), `cell-${i}-${j}`)} className="w-full bg-transparent outline-none" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="flex gap-3 text-[12px] text-[#9b9a97] mt-1">
          <button type="button" className="hover:text-[#37352f]" onClick={() => onChange([...rows, Array(cols).fill("")])}>
            + Fila
          </button>
          <button type="button" className="hover:text-[#37352f]" onClick={() => onChange(rows.map((r) => [...r, ""]))}>
            + Columna
          </button>
          {rows.length > 1 && (
            <button type="button" className="hover:text-[#37352f]" onClick={() => onChange(rows.slice(0, -1))}>
              − Fila
            </button>
          )}
          {cols > 1 && (
            <button type="button" className="hover:text-[#37352f]" onClick={() => onChange(rows.map((r) => r.slice(0, cols - 1)))}>
              − Columna
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Menús
// ---------------------------------------------------------------------------

const SlashMenu: React.FC<{ list: typeof BLOCK_TYPES; sel: number; onHover: (i: number) => void; onPick: (t: BlockType) => void }> = ({ list, sel, onHover, onPick }) => {
  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-72 max-h-80 overflow-y-auto rounded-lg bg-white shadow-[0_8px_30px_rgba(15,15,15,0.18)] border border-[#e9e9e7] py-1" data-slash-menu>
      <div className="px-3 py-1 text-[11px] text-[#9b9a97]">Bloques</div>
      {list.map((t, i) => {
        const Icon = t.icon;
        return (
          <button key={t.type} type="button" onMouseDown={(e) => (e.preventDefault(), onPick(t.type))} onMouseEnter={() => onHover(i)} className={`w-full flex items-center gap-3 px-3 py-1.5 text-left ${i === sel ? "bg-[#f1f1ef]" : ""}`} data-slash={t.label}>
            <span className="w-9 h-9 rounded border border-[#e9e9e7] bg-white flex items-center justify-center text-[#37352f]">
              <Icon size={18} />
            </span>
            <span className="flex flex-col">
              <span className="text-[13px] text-[#37352f]">{t.label}</span>
              <span className="text-[11px] text-[#9b9a97]">{t.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

const BlockMenu: React.FC<{ b: Block; onClose: () => void; onConvert: (t: BlockType) => void; onColor: (c: BlockColor) => void; onDuplicate: () => void; onDelete: () => void }> = ({ b, onClose, onConvert, onColor, onDuplicate, onDelete }) => {
  useEffect(() => {
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest("[data-block-menu]") && onClose();
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);
  return (
    <div className="absolute -left-12 top-7 z-30 w-60 max-h-96 overflow-y-auto rounded-lg bg-white shadow-[0_8px_30px_rgba(15,15,15,0.18)] border border-[#e9e9e7] py-1 text-[13px] text-[#37352f]" data-block-menu>
      <button type="button" onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f1f1ef]">
        <Trash2 size={14} /> Eliminar
      </button>
      <button type="button" onClick={onDuplicate} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f1f1ef]">
        <Copy size={14} /> Duplicar
      </button>
      <div className="px-3 pt-2 pb-1 text-[11px] text-[#9b9a97]">Convertir en</div>
      {BLOCK_TYPES.filter((t) => TEXT_TYPES.has(t.type) && t.type !== b.type).map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.type} type="button" onClick={() => onConvert(t.type)} className="w-full flex items-center gap-2 px-3 py-1 hover:bg-[#f1f1ef]">
            <Icon size={14} /> {t.label}
          </button>
        );
      })}
      <div className="px-3 pt-2 pb-1 text-[11px] text-[#9b9a97]">Color</div>
      <div className="grid grid-cols-5 gap-1 px-3 pb-2">
        {(Object.keys(COLOR_STYLE) as BlockColor[]).map((c) => (
          <button key={c} type="button" title={COLOR_NAME[c]} onClick={() => onColor(c)} className="h-7 rounded border border-[#e9e9e7] font-semibold" style={{ color: COLOR_STYLE[c].fg, background: c === "default" ? "#fff" : COLOR_STYLE[c].bg }}>
            A
          </button>
        ))}
      </div>
    </div>
  );
};
