// Exportar a HTML dentro de la app: el CSS de KaTeX y sus fuentes woff2 entran en el archivo.

import katexCss from "katex/dist/katex.min.css?inline";
import { documentoHtml, incrustarFuentes } from "./exportar";

const archivos = import.meta.glob("../../node_modules/katex/dist/fonts/*.woff2", { query: "?inline", import: "default", eager: true }) as Record<string, string>;

const fuentes: Record<string, string> = Object.fromEntries(Object.entries(archivos).map(([ruta, dato]) => [ruta.split("/").pop()!, dato]));

let css: string | null = null;

export function exportarHtml(titulo: string, cuerpo: string): string {
  css ??= incrustarFuentes(katexCss, fuentes);
  return documentoHtml(titulo, cuerpo, css);
}
