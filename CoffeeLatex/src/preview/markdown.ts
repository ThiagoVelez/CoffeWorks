// Vista previa de Markdown: `marked` con las fórmulas $…$ y $$…$$ dibujadas por KaTeX.
// Las fórmulas se protegen antes de pasar por `marked`, para que sus «_» y «*» no se vuelvan cursiva.
// Un .md puede venir de cualquier parte: el HTML escrito a mano se muestra como texto y los enlaces
// solo pueden ser http(s), mailto, anclas o rutas relativas (nunca javascript: ni data:).

import { Marked, type Tokens } from "marked";
import { mathHtml } from "./latex";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Si un destino de enlace o imagen es seguro. */
export function urlSegura(url: string): boolean {
  const u = url.trim().replace(/[\u0000-\u001f\s]+/g, "").toLowerCase();
  const esquema = /^([a-z][a-z0-9+.-]*):/.exec(u);
  return !esquema || ["http", "https", "mailto"].includes(esquema[1]);
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  async: false,
  walkTokens(t) {
    if (t.type === "link" || t.type === "image") {
      const l = t as Tokens.Link | Tokens.Image;
      if (!urlSegura(l.href)) l.href = "#";
    }
  },
  renderer: {
    html: ({ text }: Tokens.HTML | Tokens.Tag) => esc(text),
  },
});

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
    html = marked.parse(t) as string;
  } catch {
    html = `<pre>${esc(md)}</pre>`;
  }
  return html.replace(/\u0002F(\d+)\u0002/g, (_, n: string) => formulas[+n]);
}
