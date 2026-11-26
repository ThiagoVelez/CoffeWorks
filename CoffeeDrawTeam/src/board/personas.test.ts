import { test } from "node:test";
import assert from "node:assert/strict";
import { colorLibre, nombreValido, PALETA } from "./personas";

test("paleta de 12 colores", () => assert.equal(new Set(PALETA).size, 12));

test("colorLibre devuelve el preferido si nadie lo usa", () => {
  assert.equal(colorLibre(PALETA[3], [PALETA[0]]), PALETA[3]);
});

test("colorLibre da el siguiente de la paleta si está usado", () => {
  assert.equal(colorLibre(PALETA[3], [PALETA[3]]), PALETA[4]);
  assert.equal(colorLibre(PALETA[11], [PALETA[11], PALETA[0]]), PALETA[1]);
});

test("colorLibre con los 12 usados devuelve el preferido", () => {
  assert.equal(colorLibre(PALETA[5], [...PALETA]), PALETA[5]);
});

test("nombreValido", () => {
  assert.equal(nombreValido("  Sofía "), "Sofía");
  assert.equal(nombreValido(""), null);
  assert.equal(nombreValido("   "), null);
  assert.equal(nombreValido("a".repeat(25)), null);
  assert.equal(nombreValido("a".repeat(24)), "a".repeat(24));
});

test("cada color contrasta al menos 3:1 sobre blanco y sobre #1e1e1e", () => {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const oscuro = lum("#1e1e1e");
  for (const c of PALETA) {
    const l = lum(c);
    assert.ok(1.05 / (l + 0.05) >= 3, `${c} sobre blanco`);
    assert.ok((l + 0.05) / (oscuro + 0.05) >= 3, `${c} sobre oscuro`);
  }
});
