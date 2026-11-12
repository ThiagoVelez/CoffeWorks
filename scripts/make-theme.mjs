// Genera el tema alternativo (claro u oscuro) de cada aplicación a partir de
// sus clases de color de Tailwind: `src/theme.generated.css`.
//
// - Apps claras (la mayoría): crea el modo oscuro, en negro, bajo
//   html[data-theme="dark"].
// - Apps oscuras (CoffeeEdit, CoffeeLive): crea el modo claro bajo
//   html[data-theme="light"], que pasa a ser el predeterminado.
// Los elementos con data-paper (la hoja de un documento, una diapositiva, el
// lienzo de diseño...) y todo lo que contienen conservan sus colores.
//
// Uso: node scripts/make-theme.mjs [--check]

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** App → tema nativo. El generado es el contrario. */
export const THEMED_APPS = {
  ".": "light",
  CoffeeDoc: "light",
  CoffeeCalc: "light",
  CoffeeView: "light",
  CoffeePDF: "light",
  CoffeePage: "light",
  CoffeeDataBase: "light",
  CoffeeUIUX: "light",
  CoffeeUML: "light",
  CoffeeBooks: "light",
  CoffeeEdit: "dark",
  CoffeeLive: "dark",
};

// Paleta por defecto de Tailwind (solo grises, blanco y negro)
const NAMED = {
  white: "#ffffff",
  black: "#000000",
  ...Object.fromEntries(
    Object.entries({
      gray: ["#f9fafb", "#f3f4f6", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563", "#374151", "#1f2937", "#111827", "#030712"],
      slate: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"],
      zinc: ["#fafafa", "#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a", "#18181b", "#09090b"],
      neutral: ["#fafafa", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#404040", "#262626", "#171717", "#0a0a0a"],
      stone: ["#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"],
    }).flatMap(([name, list]) => [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n, i) => [`${name}-${n}`, list[i]]))
  ),
};

// --------------------------------------------------------------------------
// Color
// --------------------------------------------------------------------------

function parseHex(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function toHsl({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const hslCss = ({ h, s, l }, a = 1) => `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%${a < 1 ? ` / ${+a.toFixed(3)}` : ""})`;
const clamp = (v) => Math.max(0, Math.min(1, v));

/** Color del tema generado, o null si se deja igual. */
function transform(hex, role, target, alpha) {
  const c = parseHex(hex);
  const a = alpha * c.a;
  const hsl = toHsl(c);
  const { h, s, l } = hsl;
  if (target === "dark") {
    if (role === "bg") {
      // Tintes muy suaves (hover:bg-black/5): se invierten
      if (a <= 0.15 && l < 0.2) return hslCss({ h, s: 0, l: 1 }, a);
      if (l < 0.5) return null; // botones de acento y velos oscuros
      return hslCss({ h, s: s * 0.22, l: 0.045 + (1 - l) * 0.32 }, a);
    }
    if (role === "border") {
      if (l < 0.45) return null;
      return hslCss({ h, s: s * 0.2, l: 0.13 + (1 - l) * 0.35 }, a);
    }
    // Texto
    if (l >= 0.6) return null; // texto blanco sobre botones
    if (s < 0.45) return hslCss({ h, s: s * 0.3, l: clamp(0.93 - l * 0.55) }, a);
    return hslCss({ h, s, l: Math.max(l, 0.66) }, a);
  }
  // Tema claro a partir de uno oscuro
  if (role === "bg") {
    if (a <= 0.15 && l > 0.8) return hslCss({ h, s: 0, l: 0 }, a * 0.8);
    if (l > 0.5) return null;
    return hslCss({ h, s: s * 0.35, l: clamp(0.975 - l * 0.45) }, a);
  }
  if (role === "border") {
    if (l > 0.55) return null;
    return hslCss({ h, s: s * 0.3, l: clamp(0.86 - l * 0.3) }, a);
  }
  if (l <= 0.45) return null;
  if (s < 0.45) return hslCss({ h, s: s * 0.4, l: clamp(0.12 + (1 - l) * 0.55) }, a);
  return hslCss({ h, s, l: Math.min(l, 0.38) }, a);
}

// --------------------------------------------------------------------------
// Clases
// --------------------------------------------------------------------------

const esc = (s) => s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);

const UTIL = {
  bg: { role: "bg", css: (v) => `background-color: ${v} !important;` },
  text: { role: "text", css: (v) => `color: ${v} !important;` },
  border: { role: "border", css: (v) => `border-color: ${v} !important;` },
  "border-t": { role: "border", css: (v) => `border-top-color: ${v} !important;` },
  "border-b": { role: "border", css: (v) => `border-bottom-color: ${v} !important;` },
  "border-l": { role: "border", css: (v) => `border-left-color: ${v} !important;` },
  "border-r": { role: "border", css: (v) => `border-right-color: ${v} !important;` },
  "border-x": { role: "border", css: (v) => `border-left-color: ${v} !important; border-right-color: ${v} !important;` },
  "border-y": { role: "border", css: (v) => `border-top-color: ${v} !important; border-bottom-color: ${v} !important;` },
  divide: { role: "border", css: (v) => `border-color: ${v} !important;`, child: " > :not([hidden]) ~ :not([hidden])" },
  ring: { role: "border", css: (v) => `--tw-ring-color: ${v} !important;` },
  outline: { role: "border", css: (v) => `outline-color: ${v} !important;` },
  fill: { role: "text", css: (v) => `fill: ${v} !important;` },
  stroke: { role: "text", css: (v) => `stroke: ${v} !important;` },
  placeholder: { role: "text", css: (v) => `color: ${v} !important;`, pseudo: "::placeholder" },
  from: { role: "bg", css: (v) => `--tw-gradient-from: ${v} var(--tw-gradient-from-position) !important; --tw-gradient-to: transparent var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;` },
  via: { role: "bg", css: (v) => `--tw-gradient-stops: var(--tw-gradient-from), ${v} var(--tw-gradient-via-position), var(--tw-gradient-to) !important;` },
  to: { role: "bg", css: (v) => `--tw-gradient-to: ${v} var(--tw-gradient-to-position) !important;` },
};

const PSEUDO = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  active: ":active",
  disabled: ":disabled",
  checked: ":checked",
  first: ":first-child",
  last: ":last-child",
  odd: ":nth-child(odd)",
  even: ":nth-child(even)",
};
const RESPONSIVE = new Set(["sm", "md", "lg", "xl", "2xl"]);

const TOKEN = /(?<![\w-])((?:[a-z0-9-]+:)*)(bg|text|border-[tblrxy]|border|divide|ring|outline|fill|stroke|placeholder|from|via|to)-(\[#[0-9a-fA-F]{3,8}\]|white|black|(?:gray|slate|zinc|neutral|stone)-(?:50|[1-9]00|950))(\/(?:\d{1,3}|\[[0-9.]+\]))?(?![\w-])/g;

function ruleFor(token, prefixes, util, color, opacity, target, scope) {
  const info = UTIL[util];
  const hex = color.startsWith("[") ? color.slice(1, -1) : NAMED[color];
  if (!hex) return null;
  let alpha = 1;
  if (opacity) alpha = opacity.startsWith("/[") ? parseFloat(opacity.slice(2, -1)) : parseInt(opacity.slice(1), 10) / 100;
  const value = transform(hex, info.role, target, alpha);
  if (!value) return null;
  const parts = prefixes.split(":").filter(Boolean);
  let pseudo = "";
  let groupPrefix = "";
  for (const p of parts) {
    if (RESPONSIVE.has(p)) continue;
    if (PSEUDO[p]) pseudo += PSEUDO[p];
    else if (p === "group-hover") groupPrefix = ".group:hover ";
    else if (p === "placeholder") pseudo += "::placeholder";
    else return null; // dark:, peer-*, data-*, aria-*...
  }
  const cls = `.${esc(token)}`;
  const sel = `${scope} ${groupPrefix}${cls}:not([data-paper] *):not([data-paper])${pseudo}${info.pseudo || ""}${info.child || ""}`;
  return `${sel} { ${info.css(value)} }`;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "studio" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

export function generate(app) {
  const native = THEMED_APPS[app];
  const target = native === "light" ? "dark" : "light";
  const scope = `html[data-theme="${target}"]`;
  const src = join(root, app, "src");
  const rules = new Set();
  for (const file of walk(src)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(TOKEN)) {
      const [token, prefixes, util, color, opacity] = m;
      const r = ruleFor(token, prefixes || "", util, color, opacity || "", target, scope);
      if (r) rules.add(r);
    }
  }
  const base =
    target === "dark"
      ? `${scope} { color-scheme: dark; }
${scope} body { background-color: #0b0b0d !important; color: #e6e6ea; }
${scope} :is(input, select, textarea):not([data-paper] *):not(.bg-transparent):not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]) { background-color: #141417; color: #e6e6ea; border-color: #2c2c32; }
${scope} ::-webkit-scrollbar-thumb { background-color: #33333a; }
${scope} img[data-invert-dark] { filter: invert(1) hue-rotate(180deg); }`
      : `${scope} { color-scheme: light; }
${scope} body { background-color: #f6f6f7 !important; color: #1d1d22; }
${scope} :is(input, select, textarea):not([data-paper] *):not(.bg-transparent):not([type="color"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]) { background-color: #ffffff; color: #1d1d22; border-color: #d4d4da; }
${scope} ::-webkit-scrollbar-thumb { background-color: #c4c4cc; }`;
  return `/* Generado por scripts/make-theme.mjs: no editar a mano. Tema ${target === "dark" ? "oscuro" : "claro"} de ${app === "." ? "Launcher" : app}. */\n${base}\n${[...rules].sort().join("\n")}\n`;
}

const check = process.argv.includes("--check");
let stale = 0;
for (const app of Object.keys(THEMED_APPS)) {
  if (!existsSync(join(root, app, "src"))) continue;
  const out = join(root, app, "src", "theme.generated.css");
  const css = generate(app);
  // En Windows git puede dejar los archivos con CRLF
  const old = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : "";
  if (old === css) continue;
  if (check) {
    console.error(`Tema desactualizado: ${out}`);
    stale++;
  } else {
    writeFileSync(out, css);
    console.log(`${app}: ${css.split("\n").length - 7} reglas`);
  }
}
if (check && stale) {
  console.error("Ejecuta: node scripts/make-theme.mjs");
  process.exit(1);
}
if (check) console.log("Los temas generados están al día.");
