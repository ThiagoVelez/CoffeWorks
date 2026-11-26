import { test } from "node:test";
import assert from "node:assert/strict";
import { DOC_GROUPS, DOC_TOOLS } from "./docTools";

// tools.ts carga pdf.js (no se puede importar en Node): estas herramientas viven en docTools.ts
// y tools.ts las incluye en TOOLS y GROUPS.

const acepta = (accepts: string[], nombre: string) => accepts.includes(nombre.toLowerCase().split(".").pop() ?? "");

test("herramientas de LaTeX y Markdown", () => {
  const esperadas: Record<string, { addon: string; ext: string; grupo: string }> = {
    "latex-pdf": { addon: "latex", ext: "tex", grupo: "latex" },
    "latex-docx": { addon: "pandoc", ext: "tex", grupo: "latex" },
    "latex-html": { addon: "pandoc", ext: "tex", grupo: "latex" },
    "latex-md": { addon: "pandoc", ext: "tex", grupo: "latex" },
    "md-docx": { addon: "pandoc", ext: "md", grupo: "markdown" },
    "md-html": { addon: "pandoc", ext: "md", grupo: "markdown" },
    "md-latex": { addon: "pandoc", ext: "md", grupo: "markdown" },
  };
  for (const [id, e] of Object.entries(esperadas)) {
    const t = DOC_TOOLS.find((x) => x.id === id);
    assert.ok(t, id);
    assert.equal(t.addon, e.addon, id);
    assert.equal(t.group, e.grupo, id);
    assert.ok(acepta(t.accepts, `informe.${e.ext}`), id);
  }
  assert.deepEqual(DOC_GROUPS, [{ id: "latex", title: "Desde LaTeX" }, { id: "markdown", title: "Desde Markdown" }]);
  for (const t of DOC_TOOLS) assert.ok(DOC_GROUPS.some((g) => g.id === t.group), t.id);
});

test("LaTeX a PDF exige al menos un .tex", async () => {
  const t = DOC_TOOLS.find((x) => x.id === "latex-pdf")!;
  await assert.rejects(() => t.run([{ name: "foto.png", bytes: new Uint8Array([1]) }], {}, () => undefined), /\.tex/);
});
