// Editor de código: un textarea transparente sobre una capa con colores, números de línea y
// el subrayado del corrector (las zonas de prosa llevan data-spell-key).

import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { SpellSegment } from "../spell/useSpellCheck";
import { colorear, type Tramo } from "./colorear";
import { insertar, type Modo } from "./insertar";
import { rangosDeProsa } from "./prosa";

export interface EditorApi {
  /** Inserta una plantilla (▮ cursor, § selección) en la posición del cursor. */
  insertar(plantilla: string): void;
  reemplazar(ini: number, fin: number, texto: string): void;
  /** Pega un texto tal cual donde está el cursor (sin marcas ▮ ni §). */
  pegar(texto: string): void;
  irALinea(linea: number): void;
  irA(ini: number, fin: number): void;
  enFormula(): boolean;
  foco(): void;
}

/** Zonas de prosa partidas por línea: cada una es un texto del corrector. */
export function segmentosDeProsa(texto: string, modo: Modo): SpellSegment[] {
  const out: SpellSegment[] = [];
  for (const r of rangosDeProsa(texto, modo)) {
    let ini = r.ini;
    while (ini < r.fin) {
      const nl = texto.indexOf("\n", ini);
      const fin = nl < 0 || nl > r.fin ? r.fin : nl;
      const t = texto.slice(ini, fin);
      if (/\p{L}{2}/u.test(t)) out.push({ key: `p${ini}`, text: t, label: "" });
      ini = fin + 1;
    }
  }
  return out;
}

const pintar = (texto: string, ini: number, fin: number, tramos: Tramo[], k: string) => {
  const out: React.ReactNode[] = [];
  let i = ini;
  for (const t of tramos) {
    if (t.fin <= ini || t.ini >= fin) continue;
    const a = Math.max(t.ini, ini), b = Math.min(t.fin, fin);
    if (a > i) out.push(texto.slice(i, a));
    out.push(<span key={`${k}-${a}`} className={`c-${t.clase}`}>{texto.slice(a, b)}</span>);
    i = b;
  }
  if (i < fin) out.push(texto.slice(i, fin));
  return out;
};

interface Props {
  texto: string;
  modo: Modo;
  onCambio: (texto: string) => void;
  onTecla?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  segmentos: SpellSegment[];
}

export const Editor = forwardRef<EditorApi, Props>(({ texto, modo, onCambio, onTecla, segmentos }, ref) => {
  const area = useRef<HTMLTextAreaElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  const capa = useMemo(() => {
    const tramos = colorear(texto, modo);
    const lineas: React.ReactNode[] = [];
    let ini = 0;
    let n = 1;
    for (const linea of texto.split("\n")) {
      const fin = ini + linea.length;
      const partes: React.ReactNode[] = [];
      let i = ini;
      // Las zonas de prosa de esta línea, en orden.
      const zonas = segmentos.filter((s) => { const a = Number(s.key.slice(1)); return a >= ini && a < fin; });
      for (const z of zonas) {
        const a = Number(z.key.slice(1)), b = a + z.text.length;
        if (a > i) partes.push(...pintar(texto, i, a, tramos, `${n}-${i}`));
        partes.push(<span key={z.key} data-spell-key={z.key}>{pintar(texto, a, b, tramos, z.key)}</span>);
        i = b;
      }
      if (i < fin) partes.push(...pintar(texto, i, fin, tramos, `${n}-${i}`));
      lineas.push(<div key={n} className="linea" data-linea={n}>{partes.length ? partes : "​"}</div>);
      ini = fin + 1;
      n++;
    }
    return lineas;
  }, [texto, modo, segmentos]);

  const reemplazarRango = (ini: number, fin: number, nuevo: string, cursor: number) => {
    const t = area.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    t.setSelectionRange(ini, fin);
    // insertText conserva el deshacer del navegador (Ctrl+Z).
    if (!document.execCommand("insertText", false, nuevo)) {
      onCambio(t.value.slice(0, ini) + nuevo + t.value.slice(fin));
    }
    requestAnimationFrame(() => t.setSelectionRange(cursor, cursor));
    t.setSelectionRange(cursor, cursor);
  };

  const mostrarLinea = (n: number) => {
    const el = caja.current?.querySelector<HTMLElement>(`[data-linea="${n}"]`);
    el?.scrollIntoView({ block: "center" });
  };

  useImperativeHandle(ref, () => ({
    insertar(plantilla) {
      const t = area.current;
      if (!t) return;
      const ini = t.selectionStart, fin = t.selectionEnd;
      const r = insertar(t.value, ini, fin, plantilla);
      const nuevo = r.texto.slice(ini, r.texto.length - (t.value.length - fin));
      reemplazarRango(ini, fin, nuevo, r.cursor);
    },
    pegar(nuevo) {
      const t = area.current;
      if (!t) return;
      const ini = t.selectionStart, fin = t.selectionEnd;
      const antes = ini > 0 && t.value[ini - 1] !== "\n" ? "\n" : "";
      reemplazarRango(ini, fin, antes + nuevo, ini + antes.length + nuevo.length);
    },
    reemplazar(ini, fin, nuevo) {
      reemplazarRango(ini, fin, nuevo, ini + nuevo.length);
    },
    irALinea(linea) {
      const t = area.current;
      if (!t) return;
      const lineas = t.value.split("\n");
      const n = Math.max(1, Math.min(linea, lineas.length));
      const ini = lineas.slice(0, n - 1).reduce((s, l) => s + l.length + 1, 0);
      t.focus({ preventScroll: true });
      t.setSelectionRange(ini, ini + lineas[n - 1].length);
      mostrarLinea(n);
    },
    irA(ini, fin) {
      const t = area.current;
      if (!t) return;
      t.focus({ preventScroll: true });
      t.setSelectionRange(ini, fin);
      mostrarLinea(t.value.slice(0, ini).split("\n").length);
    },
    enFormula() {
      const t = area.current;
      if (!t) return false;
      const c = t.selectionStart;
      return colorear(t.value, modo).some((x) => x.clase === "mate" && x.ini < c && c < x.fin);
    },
    foco: () => area.current?.focus(),
  }), [modo, onCambio]);

  const tecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const t = e.currentTarget;
      reemplazarRango(t.selectionStart, t.selectionEnd, "  ", t.selectionStart + 2);
      return;
    }
    onTecla?.(e);
  };

  return (
    <div ref={caja} className="editor-caja h-full overflow-auto" data-testid="editor">
      <div className="editor-hoja relative min-h-full">
        <div className="editor-capa" aria-hidden>{capa}</div>
        <textarea
          ref={area}
          className="editor-area bg-transparent"
          value={texto}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Código del documento"
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={tecla}
        />
      </div>
    </div>
  );
});
Editor.displayName = "Editor";

export const EDITOR_CSS = `
.editor-caja{background:var(--cl-codigo,#fbfcfc);counter-reset:linea}
.editor-hoja{font-family:'JetBrains Mono',Consolas,monospace;font-size:13.5px;line-height:1.6;tab-size:2}
.editor-capa,.editor-area{margin:0;padding:12px 16px 40vh 56px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;font:inherit;letter-spacing:0;box-sizing:border-box}
.editor-capa{color:var(--cl-texto,#24323a);pointer-events:none;user-select:none}
.editor-capa .linea{position:relative;counter-increment:linea;min-height:1.6em}
.editor-capa .linea::before{content:counter(linea);position:absolute;left:-48px;width:36px;text-align:right;color:#a8b3b8;font-size:11.5px}
.editor-area{position:absolute;inset:0;width:100%;height:100%;resize:none;border:0;outline:0;background:transparent;color:transparent;caret-color:#0d5e6f;overflow:hidden;user-select:text;-webkit-user-select:text}
.editor-area::selection{background:rgba(13,94,111,.22);color:transparent}
.c-cmd{color:#0d5e6f;font-weight:600}
.c-mate{color:#9b3d8a}
.c-coment{color:#8b979c;font-style:italic}
.c-llave{color:#c2701a}
:root[data-theme="dark"] .editor-caja{--cl-codigo:#151b1e;--cl-texto:#d6e1e4}
:root[data-theme="dark"] .c-cmd{color:#5fc4d6}
:root[data-theme="dark"] .c-mate{color:#e29bd4}
:root[data-theme="dark"] .c-llave{color:#f0a860}
`;
