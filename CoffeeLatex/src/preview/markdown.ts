// Vista previa de Markdown: `marked` con las fórmulas $…$ y $$…$$ dibujadas por KaTeX.
// Las fórmulas se protegen antes de pasar por `marked`, para que sus «_» y «*» no se vuelvan cursiva.

import { marked } from "marked";
import { mathHtml } from "./latex";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function markdownToHtml(md: string): string {
  const formulas: string[] = [];
  const guardar = (html: string) => `\u0002F${formulas.push(html) - 1}\u0002`;
  // El código no se toca: se aparta primero.
  const codigos: string[] = [];
  let t = md.replace(/```[\s\S]*?(```|$)|`[^`\n]*`/g, (m) => `\u0003C${codigos.push(m) - 1}\u0003`);
  t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, f: string) => guardar(mathHtml(f.trim(), true)));
  t = t.replace(/(^|[^\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, a: string, f: string) => a + guardar(mathHtml(f, false)));
  t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_, f: string) => guardar(mathHtml(f.trim(), true)));
  t = t.replace(/\\\(([\s\S]+?)\\\)/g, (_, f: string) => guardar(mathHtml(f, false)));
  t = t.replace(/\u0003C(\d+)\u0003/g, (_, n: string) => codigos[+n]);
  let html: string;
  try {
    html = marked.parse(t, { async: false, gfm: true, breaks: false, renderer: rendererSeguro() }) as string;
  } catch {
    html = `<pre>${esc(md)}</pre>`;
  }
  return html.replace(/\u0002F(\d+)\u0002/g, (_, n: string) => formulas[+n]);
}

function rendererSeguro() {
  const r = new marked.Renderer();
  // El HTML escrito a mano se muestra como texto: la vista previa nunca ejecuta nada.
  r.html = ({ text }: { text: string }) => esc(text);
  return r;
}
