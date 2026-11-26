// Herramientas «Desde LaTeX» y «Desde Markdown»: usan los complementos «Motor LaTeX» y «Pandoc»
// con los mismos comandos nativos que CoffeeLatex (coffee-core/docconv).

import type { Tool } from "./tools";
import { compilarPdf, convertir, type Desde, type Hacia } from "./native";
import { outputName } from "./ranges";

export const DOC_GROUPS: { id: "latex" | "markdown"; title: string }[] = [
  { id: "latex", title: "Desde LaTeX" },
  { id: "markdown", title: "Desde Markdown" },
];

const IMAGENES = ["png", "jpg", "jpeg", "pdf", "eps", "svg"];
const ext = (n: string) => n.toLowerCase().split(".").pop() ?? "";

function conPandoc(id: string, desde: Desde, hacia: Hacia, salida: string, title: string, description: string): Tool {
  const entrada = desde === "latex" ? ["tex"] : ["md", "markdown"];
  return {
    id,
    group: desde,
    title,
    description,
    accepts: entrada,
    multiple: true,
    addon: "pandoc",
    run: async (files, _o, p) => {
      const out = [];
      for (let i = 0; i < files.length; i++) {
        p(i / files.length, files[i].name);
        out.push({ name: outputName(files[i].name, salida), bytes: await convertir(files[i].bytes, desde, hacia) });
      }
      p(1, "");
      return out;
    },
  };
}

export const DOC_TOOLS: Tool[] = [
  {
    id: "latex-pdf",
    group: "latex",
    title: "LaTeX a PDF",
    description: "Compila el documento con fórmulas, ecuaciones numeradas y referencias. Agrega también las imágenes que usa.",
    accepts: ["tex", ...IMAGENES],
    multiple: true,
    addon: "latex",
    run: async (files, _o, p) => {
      const documentos = files.filter((f) => ext(f.name) === "tex");
      if (!documentos.length) throw new Error("Agrega al menos un archivo .tex.");
      const archivos = files.filter((f) => ext(f.name) !== "tex").map((f) => ({ nombre: f.name, datos: f.bytes }));
      const out = [];
      for (let i = 0; i < documentos.length; i++) {
        p(i / documentos.length, documentos[i].name);
        out.push({ name: outputName(documentos[i].name, "pdf"), bytes: await compilarPdf(new TextDecoder().decode(documentos[i].bytes), archivos) });
      }
      p(1, "");
      return out;
    },
  },
  conPandoc("latex-docx", "latex", "docx", "docx", "LaTeX a Word", "Un .docx con las fórmulas como ecuaciones editables de Word."),
  conPandoc("latex-html", "latex", "html", "html", "LaTeX a HTML", "Una página web con las fórmulas en MathML."),
  conPandoc("latex-md", "latex", "markdown", "md", "LaTeX a Markdown", "Texto Markdown con las fórmulas entre $…$."),
  conPandoc("md-docx", "markdown", "docx", "docx", "Markdown a Word", "Un .docx con títulos, listas, tablas y fórmulas."),
  conPandoc("md-html", "markdown", "html", "html", "Markdown a HTML", "Una página web con las fórmulas en MathML."),
  conPandoc("md-latex", "markdown", "latex", "tex", "Markdown a LaTeX", "Un documento .tex completo, listo para compilar o seguir en CoffeeLatex."),
];
