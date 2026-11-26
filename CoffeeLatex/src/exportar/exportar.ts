// Exportar a HTML: un documento completo que se abre sin internet, con el CSS de KaTeX y sus
// fuentes incrustadas. La parte pura vive aquí (y se prueba en Node); las fuentes reales las
// aporta `exportarHtml.ts` con las importaciones `?inline` de Vite.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Cambia las `url(fonts/…)` del CSS de KaTeX por los `data:` de `fuentes` (nombre de archivo →
 * data URL). Solo se conservan las woff2; las demás variantes se quitan.
 */
export function incrustarFuentes(css: string, fuentes: Record<string, string>): string {
  return css.replace(/src:([^;}]*)/g, (decl, lista: string) => {
    const woff2 = /url\(["']?fonts\/([^)"']+\.woff2)["']?\)/.exec(lista);
    if (!woff2) return decl;
    const dato = fuentes[woff2[1]];
    return dato ? `src:url(${dato}) format("woff2")` : "src:local(serif)";
  });
}

/** Estilo de la hoja: el mismo de la vista previa. */
export const HOJA_CSS = `
.hoja{font-family:"Latin Modern Roman","CMU Serif","Computer Modern",Georgia,"Times New Roman",serif;color:#111;line-height:1.5;font-size:12pt}
.hoja h1{font-size:1.7em;text-align:center;margin:.2em 0 .3em;font-weight:normal}
.hoja h2{font-size:1.3em;margin:1.2em 0 .4em}
.hoja h3{font-size:1.1em;margin:1em 0 .3em}
.hoja h4{font-size:1em;margin:.8em 0 .2em}
.hoja p{margin:.5em 0;text-align:justify;hyphens:auto}
.hoja .titulo-doc{text-align:center;margin-bottom:1.6em}
.hoja .titulo-doc .autor,.hoja .titulo-doc .fecha{margin-top:.3em}
.hoja .ecuacion{position:relative;margin:.8em 0;padding:0 3em}
.hoja .ecuacion .num{position:absolute;right:0;top:50%;transform:translateY(-50%)}
.hoja table.tabla{border-collapse:collapse;margin:.8em auto}
.hoja table.tabla td{border:1px solid #333;padding:.25em .7em;text-align:center}
.hoja figure{margin:1em 0;text-align:center}
.hoja figure img{max-width:80%}
.hoja figcaption{font-size:.95em;margin-top:.3em}
.hoja .resumen{margin:1em 3em;font-size:.95em}
.hoja blockquote{margin:.6em 2em}
.hoja pre,.hoja code{font-family:"Latin Modern Mono",Consolas,monospace;font-size:.92em}
.hoja pre{background:#f5f5f5;padding:.6em;border-radius:4px;overflow:auto}
.hoja .desconocido{color:#8a8a8a;font-family:Consolas,monospace;font-size:.85em}
.hoja .url{color:#0d5e6f;word-break:break-all}
.hoja .nota{color:#0d5e6f;cursor:help}
.hoja table:not(.tabla){border-collapse:collapse;margin:.8em 0}
.hoja table:not(.tabla) td,.hoja table:not(.tabla) th{border:1px solid #bbb;padding:.25em .6em}
`;

/** Documento HTML completo con el cuerpo ya traducido. */
export function documentoHtml(titulo: string, cuerpo: string, katexCss: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="CoffeeLatex">
<title>${esc(titulo || "Documento")}</title>
<style>${katexCss}</style>
<style>
body{margin:0;background:#fff}
.hoja{max-width:42em;margin:0 auto;padding:3em 1.5em}
@media print{.hoja{padding:0}}
${HOJA_CSS}
</style>
</head>
<body>
<article class="hoja">
${cuerpo}
</article>
</body>
</html>
`;
}
