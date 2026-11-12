// ⚠ Copia de shared/spell/useSpellCheck.tsx: edita el original y ejecuta node scripts/sync-shared.mjs
// Corrector ortográfico en la interfaz: subraya las faltas, cuenta los
// errores, salta al siguiente y ofrece sugerencias con el clic derecho.
//
// Dos modos:
// - "dom": revisa un área editable (contentEditable) y corrige en ella.
// - "model": revisa textos del documento (celdas, cuadros de texto…). Los
//   elementos que muestran cada texto llevan data-spell-key con su clave.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SpellCheck, ChevronUp, Check, BookPlus, EyeOff, ArrowRight, Loader2, AlertTriangle, X } from "lucide-react";
import * as engine from "./engine";

export interface SpellSegment {
  key: string;
  text: string;
  /** Dónde está (se muestra en el menú): «Diapositiva 2», «Celda B4»… */
  label: string;
}

export interface SpellError {
  id: string;
  key: string;
  start: number;
  end: number;
  word: string;
  label: string;
  /** Solo en el modo "dom". */
  node?: Text;
}

type Options =
  | { mode: "dom"; root: () => HTMLElement | null; watch?: unknown }
  | {
      mode: "model";
      segments: SpellSegment[];
      onReveal: (error: SpellError) => void;
      onReplace: (error: SpellError, replacement: string) => void;
    };

const HL = "coffee-spell";
const HL_CURRENT = "coffee-spell-current";

type HighlightApi = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const highlights = (): HighlightApi | null => {
  const css = (globalThis as unknown as { CSS?: { highlights?: HighlightApi } }).CSS;
  return css?.highlights && typeof (globalThis as unknown as { Highlight?: unknown }).Highlight === "function" ? css.highlights : null;
};
const makeHighlight = (ranges: Range[]) => new (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight(...ranges);

/** Nodos de texto visibles bajo un elemento (sin los no editables). */
function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = (n as Text).parentElement;
      if (!p || p.closest("[contenteditable='false'], script, style, [data-spell-skip]")) return NodeFilter.FILTER_REJECT;
      return (n as Text).data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) out.push(walker.currentNode as Text);
  return out;
}

/** Elemento editable que contiene un nodo (o el propio contenedor). */
const editableOf = (node: Node, root: HTMLElement): HTMLElement => (node.parentElement?.closest<HTMLElement>("[contenteditable='true'], [contenteditable='']") || root);

/** Posición (nodo y desplazamiento) de un carácter dentro del texto de un elemento. */
function locate(el: Element, offset: number): { node: Text; offset: number } | null {
  let rest = offset;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    if (rest <= t.data.length) return { node: t, offset: rest };
    rest -= t.data.length;
  }
  return null;
}

function offsetWithin(el: Element, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode === node) return total + offset;
    total += (walker.currentNode as Text).data.length;
  }
  return -1;
}

const caretAt = (x: number, y: number): { node: Node; offset: number } | null => {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
};

export function useSpellCheck(options: Options) {
  const [enabled, setEnabledState] = useState(engine.isEnabled());
  const [lang, setLangState] = useState(engine.getLang());
  const [{ status, error }, setStatus] = useState(engine.getStatus());
  const [errors, setErrors] = useState<SpellError[]>([]);
  const [version, setVersion] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; error: SpellError; suggestions: string[] | null } | null>(null);
  const indexRef = useRef(-1);
  const optsRef = useRef(options);
  optsRef.current = options;
  const errorsRef = useRef<SpellError[]>([]);
  errorsRef.current = errors;

  useEffect(
    () =>
      engine.subscribe(() => {
        setEnabledState(engine.isEnabled());
        setLangState(engine.getLang());
        setStatus(engine.getStatus());
        setVersion((v) => v + 1);
      }),
    []
  );

  // -------------------------------------------------------------------------
  // Revisión
  // -------------------------------------------------------------------------

  const segmentsKey = options.mode === "model" ? options.segments.map((s) => `${s.key}\u0001${s.text}`).join("\u0002") : "";

  const runDom = useCallback(async () => {
    const o = optsRef.current;
    if (o.mode !== "dom") return;
    const root = o.root();
    if (!root) return;
    const nodes = textNodes(root);
    const tokens = nodes.map((n) => engine.tokenize(n.data));
    const bad = await engine.misspelled(tokens.flat().map((t) => t.word));
    const out: SpellError[] = [];
    // La palabra que se está escribiendo no se marca hasta terminarla
    const sel = window.getSelection();
    const typing = sel && sel.isCollapsed && root.contains(sel.anchorNode) && document.activeElement?.contains(sel.anchorNode) ? { node: sel.anchorNode, offset: sel.anchorOffset } : null;
    nodes.forEach((node, i) =>
      tokens[i].forEach((t) => {
        if (!bad.has(t.word)) return;
        if (typing && typing.node === node && typing.offset === t.end) return;
        out.push({ id: `${i}:${t.start}`, key: "dom", start: t.start, end: t.end, word: t.word, label: "", node });
      })
    );
    setErrors(out);
  }, []);

  const runModel = useCallback(async () => {
    const o = optsRef.current;
    if (o.mode !== "model") return;
    const tokens = o.segments.map((s) => engine.tokenize(s.text));
    const bad = await engine.misspelled(tokens.flat().map((t) => t.word));
    const out: SpellError[] = [];
    o.segments.forEach((s, i) => tokens[i].forEach((t) => bad.has(t.word) && out.push({ id: `${s.key}:${t.start}`, key: s.key, start: t.start, end: t.end, word: t.word, label: s.label })));
    setErrors(out);
  }, []);

  const run = useCallback(() => {
    if (!engine.isEnabled()) {
      setErrors([]);
      return;
    }
    const p = optsRef.current.mode === "dom" ? runDom() : runModel();
    p.catch(() => setErrors([]));
  }, [runDom, runModel]);

  // Modo dom: se revisa al cambiar el contenido (con una pequeña espera)
  const domWatch = options.mode === "dom" ? options.watch : null;
  useEffect(() => {
    if (options.mode !== "dom") return;
    const root = options.root();
    if (!root) return;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 450);
    };
    const mo = new MutationObserver(schedule);
    mo.observe(root, { characterData: true, childList: true, subtree: true });
    root.addEventListener("blur", schedule);
    schedule();
    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
      root.removeEventListener("blur", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.mode, run, version, domWatch]);

  // Modo model: al cambiar los textos
  useEffect(() => {
    if (options.mode !== "model") return;
    const t = window.setTimeout(run, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.mode, segmentsKey, version, run]);

  // -------------------------------------------------------------------------
  // Subrayado
  // -------------------------------------------------------------------------

  const paint = useCallback(() => {
    const api = highlights();
    if (!api) return;
    if (!engine.isEnabled() || !errorsRef.current.length) {
      api.delete(HL);
      return;
    }
    const ranges: Range[] = [];
    if (optsRef.current.mode === "dom") {
      for (const e of errorsRef.current) {
        if (!e.node?.isConnected || e.end > e.node.data.length) continue;
        const r = document.createRange();
        r.setStart(e.node, e.start);
        r.setEnd(e.node, e.end);
        ranges.push(r);
      }
    } else {
      const byKey = new Map<string, SpellError[]>();
      for (const e of errorsRef.current) (byKey.get(e.key) || byKey.set(e.key, []).get(e.key)!).push(e);
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-spell-key]"))) {
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) continue;
        const list = byKey.get(el.dataset.spellKey || "");
        if (!list) continue;
        for (const e of list) {
          const a = locate(el, e.start);
          const b = locate(el, e.end);
          if (!a || !b) continue;
          const r = document.createRange();
          r.setStart(a.node, a.offset);
          r.setEnd(b.node, b.offset);
          ranges.push(r);
        }
      }
    }
    api.set(HL, makeHighlight(ranges));
  }, []);

  useLayoutEffect(paint);
  useEffect(() => {
    // Los textos se vuelven a dibujar al editar o cambiar de vista: se repinta
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      highlights()?.delete(HL);
      highlights()?.delete(HL_CURRENT);
    };
  }, [paint]);

  // -------------------------------------------------------------------------
  // Ir a la siguiente falta
  // -------------------------------------------------------------------------

  const rangeOf = (e: SpellError): Range | null => {
    if (e.node) {
      if (!e.node.isConnected) return null;
      const r = document.createRange();
      r.setStart(e.node, e.start);
      r.setEnd(e.node, Math.min(e.end, e.node.data.length));
      return r;
    }
    const el = document.querySelector<HTMLElement>(`[data-spell-key="${CSS.escape(e.key)}"]`);
    if (!el || el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return null;
    const a = locate(el, e.start);
    const b = locate(el, e.end);
    if (!a || !b) return null;
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  };

  const markCurrent = (e: SpellError) => {
    const r = rangeOf(e);
    const api = highlights();
    if (!r) return;
    api?.set(HL_CURRENT, makeHighlight([r]));
    const host = r.startContainer.parentElement;
    host?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    window.setTimeout(() => api?.delete(HL_CURRENT), 2200);
    if (optsRef.current.mode === "dom") {
      const root = optsRef.current.root();
      if (root) editableOf(r.startContainer, root).focus({ preventScroll: true });
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  };

  const goNext = useCallback(() => {
    const list = errorsRef.current;
    if (!list.length) return;
    let i = indexRef.current + 1;
    if (optsRef.current.mode === "dom") {
      // La siguiente después del cursor
      const sel = window.getSelection();
      if (sel?.rangeCount) {
        const cur = sel.getRangeAt(0);
        const j = list.findIndex((e) => {
          const r = rangeOf(e);
          return r && r.compareBoundaryPoints(Range.START_TO_END, cur) > 0 && r.compareBoundaryPoints(Range.START_TO_START, cur) > 0;
        });
        i = j >= 0 ? j : 0;
      }
    }
    if (i >= list.length) i = 0;
    indexRef.current = i;
    const e = list[i];
    const o = optsRef.current;
    if (o.mode === "model") {
      o.onReveal(e);
      window.setTimeout(() => markCurrent(e), 90);
    } else markCurrent(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Menú contextual
  // -------------------------------------------------------------------------

  useEffect(() => {
    const onContext = (ev: MouseEvent) => {
      if (!engine.isEnabled() || !errorsRef.current.length) return;
      const target = ev.target as HTMLElement;
      const o = optsRef.current;
      let found: SpellError | undefined;
      if (o.mode === "dom") {
        const root = o.root();
        if (!root || !root.contains(target)) return;
        const c = caretAt(ev.clientX, ev.clientY);
        if (!c) return;
        found = errorsRef.current.find((e) => e.node === c.node && c.offset >= e.start && c.offset <= e.end);
      } else {
        // Por la posición: las capas de selección pueden tapar el texto
        found = errorsRef.current.find((e) => {
          const r = rangeOf(e);
          return !!r && Array.from(r.getClientRects()).some((b) => ev.clientX >= b.left - 2 && ev.clientX <= b.right + 2 && ev.clientY >= b.top - 2 && ev.clientY <= b.bottom + 2);
        });
        const host = found ? null : target.closest<HTMLElement>("[data-spell-key]");
        if (!found && !host) return;
      }
      if (!found && o.mode === "model") {
        const host = target.closest<HTMLElement>("[data-spell-key]")!;
        const key = host.dataset.spellKey!;
        let offset = -1;
        if (host instanceof HTMLTextAreaElement || host instanceof HTMLInputElement) offset = host.selectionStart ?? -1;
        else {
          const c = caretAt(ev.clientX, ev.clientY);
          if (c && host.contains(c.node)) offset = offsetWithin(host, c.node, c.offset);
        }
        found = errorsRef.current.find((e) => e.key === key && offset >= e.start && offset <= e.end);
      }
      if (!found) return;
      ev.preventDefault();
      ev.stopPropagation();
      const err = found;
      setMenu({ x: ev.clientX, y: ev.clientY, error: err, suggestions: null });
      void engine.suggest(err.word).then((suggestions) => setMenu((m) => (m && m.error.id === err.id ? { ...m, suggestions } : m)));
    };
    document.addEventListener("contextmenu", onContext, true);
    return () => document.removeEventListener("contextmenu", onContext, true);
  }, []);

  /** Abre el menú de sugerencias de la primera falta de un texto (p. ej., una celda). */
  const openMenu = useCallback((key: string, x: number, y: number): boolean => {
    if (!engine.isEnabled()) return false;
    const err = errorsRef.current.find((e) => e.key === key);
    if (!err) return false;
    setMenu({ x, y, error: err, suggestions: null });
    void engine.suggest(err.word).then((suggestions) => setMenu((m) => (m && m.error.id === err.id ? { ...m, suggestions } : m)));
    return true;
  }, []);

  const replace = (e: SpellError, text: string) => {
    setMenu(null);
    const o = optsRef.current;
    if (o.mode === "model") {
      o.onReplace(e, text);
      return;
    }
    const r = rangeOf(e);
    const root = o.root();
    if (!r || !root) return;
    const host = editableOf(r.startContainer, root);
    host.focus({ preventScroll: true });
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    // insertText mantiene el deshacer del editor y avisa del cambio
    if (!document.execCommand("insertText", false, text)) {
      r.deleteContents();
      r.insertNode(document.createTextNode(text));
      host.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const menuNode = menu
    ? createPortal(
        <div className="fixed inset-0 z-[99999]" onMouseDown={() => setMenu(null)} onContextMenu={(e) => (e.preventDefault(), setMenu(null))}>
          <div
            data-spell-menu
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute min-w-[220px] max-w-[300px] rounded-lg bg-white shadow-2xl border border-[#e3e3e3] py-1.5 text-[13px] text-[#202124]"
            style={{ left: Math.min(menu.x, window.innerWidth - 300), top: Math.min(menu.y, window.innerHeight - 320) }}
          >
            <div className="px-3 pb-1.5 mb-1 border-b border-[#efefef] text-[11px] text-[#80868b] truncate">
              «{menu.error.word}» no está en el diccionario{menu.error.label ? ` · ${menu.error.label}` : ""}
            </div>
            {menu.suggestions === null ? (
              <div className="px-3 py-1.5 text-[#80868b] flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Buscando sugerencias…
              </div>
            ) : menu.suggestions.length ? (
              menu.suggestions.map((s) => (
                <button key={s} type="button" data-spell-suggestion={s} onClick={() => replace(menu.error, s)} className="w-full text-left px-3 py-1.5 font-semibold hover:bg-[#e8f0fe]">
                  {s}
                </button>
              ))
            ) : (
              <div className="px-3 py-1.5 text-[#80868b]">Sin sugerencias</div>
            )}
            <div className="border-t border-[#efefef] my-1" />
            <button type="button" onClick={() => (setMenu(null), engine.ignoreWord(menu.error.word))} className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[#f1f3f4]">
              <EyeOff size={14} className="text-[#5f6368]" /> Omitir todo
            </button>
            <button type="button" data-spell-add onClick={() => (setMenu(null), void engine.addWord(menu.error.word))} className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[#f1f3f4]">
              <BookPlus size={14} className="text-[#5f6368]" /> Agregar al diccionario
            </button>
            <button type="button" onClick={() => (setMenu(null), goNext())} className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-[#f1f3f4]">
              <ArrowRight size={14} className="text-[#5f6368]" /> Siguiente falta
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return {
    enabled,
    setEnabled: engine.setEnabled,
    lang,
    setLang: engine.setLang,
    status,
    error,
    errors,
    goNext,
    openMenu,
    menu: menuNode,
  };
}

export type SpellState = ReturnType<typeof useSpellCheck>;

/** Indicador para la barra inferior: número de faltas, ir a la siguiente e idioma. */
export const SpellIndicator: React.FC<{ spell: SpellState; tone?: "light" | "dark"; className?: string }> = ({ spell, tone = "light", className = "" }) => {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && (setOpen(false), setWords(null));
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [open]);

  const n = spell.errors.length;
  const text = !spell.enabled
    ? "Ortografía desactivada"
    : spell.status === "error"
      ? "Diccionario no disponible"
      : spell.status === "loading" || spell.status === "idle"
        ? "Cargando diccionario…"
        : n === 0
          ? "Sin faltas de ortografía"
          : n === 1
            ? "1 falta de ortografía"
            : `${n} faltas de ortografía`;
  const dark = tone === "dark";
  const color = !spell.enabled || n === 0 ? (dark ? "text-white/85" : "text-[#5f6368]") : dark ? "text-[#ffd6d6]" : "text-[#d93025]";
  const Icon = spell.status === "error" ? AlertTriangle : spell.enabled && n === 0 && spell.status === "ready" ? Check : spell.status === "loading" ? Loader2 : SpellCheck;
  const hover = dark ? "hover:bg-white/15" : "hover:bg-black/5";

  return (
    <div ref={ref} className={`relative flex items-center ${className}`} data-spell-indicator>
      <button
        type="button"
        data-spell-next
        title={n ? "Ir a la siguiente falta de ortografía" : spell.error || "Corrector ortográfico"}
        onClick={() => (n ? spell.goNext() : setOpen((v) => !v))}
        className={`flex items-center gap-1.5 px-1.5 h-[22px] rounded ${hover} ${color} font-medium`}
      >
        <Icon size={13} className={spell.status === "loading" ? "animate-spin" : ""} />
        <span className="whitespace-nowrap">{text}</span>
      </button>
      <button type="button" title="Idioma y opciones del corrector" onClick={() => setOpen((v) => !v)} className={`h-[22px] px-0.5 rounded ${hover} ${dark ? "text-white/80" : "text-[#5f6368]"}`}>
        <ChevronUp size={12} />
      </button>
      {open && (
        <div className="absolute bottom-7 right-0 w-64 rounded-lg bg-white shadow-2xl border border-[#e3e3e3] py-1.5 text-[12.5px] text-[#202124] z-[99990]">
          {words === null ? (
            <>
              <div className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#80868b]">Idioma de revisión</div>
              {(["es", "en", "es+en"] as engine.SpellLang[]).map((l) => (
                <button key={l} type="button" data-spell-lang={l} onClick={() => (spell.setLang(l), setOpen(false))} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#f1f3f4]">
                  {engine.LANG_LABEL[l]} {spell.lang === l && <Check size={14} className="text-[#1a73e8]" />}
                </button>
              ))}
              <div className="border-t border-[#efefef] my-1" />
              <button type="button" data-spell-toggle onClick={() => (spell.setEnabled(!spell.enabled), setOpen(false))} className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4]">
                {spell.enabled ? "Desactivar el corrector" : "Activar el corrector"}
              </button>
              <button type="button" onClick={() => void engine.getUserWords().then(setWords)} className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4]">
                Diccionario personal…
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-[#80868b]">Diccionario personal ({words.length})</div>
              <div className="max-h-56 overflow-y-auto">
                {words.map((w) => (
                  <div key={w} className="flex items-center justify-between px-3 py-1 hover:bg-[#f8f9fa]">
                    {w}
                    <button type="button" title="Quitar" onClick={() => void engine.removeUserWord(w).then(() => setWords(words.filter((x) => x !== w)))} className="text-[#80868b] hover:text-[#d93025]">
                      <X size={13} />
                    </button>
                  </div>
                ))}
                {!words.length && <p className="px-3 py-2 text-[#80868b]">Vacío. Usa «Agregar al diccionario» en el menú de una palabra.</p>}
              </div>
              <p className="px-3 pt-1.5 text-[10.5px] text-[#80868b]">Se comparte con todas las apps de CoffeeWorks.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Estilos del subrayado (añadir una vez por app). */
export const SPELL_CSS = `::highlight(${HL}){text-decoration:underline wavy #e53935;text-decoration-thickness:1.4px;text-underline-offset:3px;text-decoration-skip-ink:none}::highlight(${HL_CURRENT}){background-color:rgba(229,57,53,.22)}`;

export const SpellStyles: React.FC = () => useMemo(() => <style>{SPELL_CSS}</style>, []);
