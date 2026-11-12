// Corrección de color tipo Lumetri: exposición, balance de blancos, tonos,
// intensidad, «looks» creativos y viñeta. Se convierte en un filtro SVG que
// el navegador aplica con la GPU, así la vista previa sigue en tiempo real.

import type { ColorGrade, MediaClip } from "../types";

export const DEFAULT_GRADE: ColorGrade = {
  exposure: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  vibrance: 0,
  look: "none",
  lookIntensity: 100,
  vignette: 0,
};

export const LOOKS: { id: ColorGrade["look"]; name: string }[] = [
  { id: "none", name: "Ninguno" },
  { id: "cinematic", name: "Cine" },
  { id: "tealOrange", name: "Verde azulado y naranja" },
  { id: "vintage", name: "Película antigua" },
  { id: "bwFilm", name: "Blanco y negro de cine" },
  { id: "warmSunset", name: "Atardecer cálido" },
  { id: "coolNight", name: "Noche fría" },
  { id: "bleach", name: "Blanqueado" },
  { id: "faded", name: "Desvaído" },
  { id: "matrix", name: "Verde digital" },
];

export const isNeutral = (g?: ColorGrade | null) => !g || JSON.stringify({ ...g, vignette: 0 }) === JSON.stringify({ ...DEFAULT_GRADE, vignette: 0 });

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const sCurve = (x: number, k: number) => x + k * (x - 0.5) * (1 - Math.abs(2 * x - 1)) * 2;

/** Curva de un «look» por canal (0 = rojo, 1 = verde, 2 = azul). */
function lookCurve(look: ColorGrade["look"], ch: number, x: number): number {
  const sh = 1 - smooth(0, 0.5, x); // peso en las sombras
  const hi = smooth(0.5, 1, x); // peso en las luces
  switch (look) {
    case "cinematic":
      return sCurve(x, 0.12) + [-0.02 * sh + 0.03 * hi, 0.01 * sh, 0.04 * sh - 0.03 * hi][ch];
    case "tealOrange":
      return sCurve(x, 0.15) + [-0.06 * sh + 0.07 * hi, 0.02 * sh + 0.01 * hi, 0.08 * sh - 0.08 * hi][ch];
    case "vintage":
      return 0.07 + x * 0.86 + [0.04, 0.01, -0.05][ch] * (0.5 + 0.5 * hi);
    case "bwFilm":
      return sCurve(x, 0.2);
    case "warmSunset":
      return x + [0.07, 0.02, -0.08][ch] * (0.3 + 0.7 * x);
    case "coolNight":
      return x * 0.92 + [-0.05, 0.0, 0.07][ch] * (0.4 + 0.6 * (1 - x));
    case "bleach":
      return sCurve(x, 0.3);
    case "faded":
      return 0.1 + x * 0.82;
    case "matrix":
      return x * [0.85, 1.02, 0.85][ch] + [0, 0.03, 0][ch];
    default:
      return x;
  }
}

const lookSaturation: Partial<Record<ColorGrade["look"], number>> = { cinematic: 0.9, tealOrange: 1.05, vintage: 0.75, bwFilm: 0, warmSunset: 1.1, coolNight: 0.85, bleach: 0.45, faded: 0.8, matrix: 0.7 };

function channelTable(g: ColorGrade, ch: number): string {
  const n = 48;
  const exp = Math.pow(2, g.exposure);
  // Balance de blancos: ganancia por canal
  const wb = [1 + g.temperature * 0.0025 + g.tint * 0.001, 1 - g.tint * 0.002, 1 - g.temperature * 0.0025 + g.tint * 0.001][ch];
  const k = g.lookIntensity / 100;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let x = i / (n - 1);
    x = x * exp * wb;
    // Sombras y luces (realzan o recuperan sin tocar los extremos)
    x += (g.shadows / 100) * 0.35 * Math.pow(1 - clamp(x), 2) * clamp(x) * 2.5;
    x += (g.highlights / 100) * 0.35 * Math.pow(clamp(x), 2) * (1 - clamp(x)) * 2.5;
    // Blancos y negros (puntos extremos)
    const lift = (g.blacks / 100) * 0.1;
    const gain = 1 + (g.whites / 100) * 0.15;
    x = lift + x * (gain - lift);
    x = clamp(x);
    if (g.look !== "none") x = x + (clamp(lookCurve(g.look, ch, x)) - x) * k;
    out.push(clamp(x).toFixed(4));
  }
  return out.join(" ");
}

let host: SVGSVGElement | null = null;
const made = new Map<string, string>();

/** Devuelve `url(#...)` con el filtro SVG de la corrección (o "" si es neutra). */
export function gradeFilter(g?: ColorGrade | null): string {
  if (!g || isNeutral(g) || typeof document === "undefined") return "";
  const key = JSON.stringify({ ...g, vignette: 0 });
  const found = made.get(key);
  if (found) return found;
  if (!host) {
    host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    host.setAttribute("width", "0");
    host.setAttribute("height", "0");
    host.setAttribute("aria-hidden", "true");
    host.style.position = "absolute";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);
  }
  const id = `cg${made.size}`;
  const ns = "http://www.w3.org/2000/svg";
  const filter = document.createElementNS(ns, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const ct = document.createElementNS(ns, "feComponentTransfer");
  ["R", "G", "B"].forEach((c, i) => {
    const f = document.createElementNS(ns, `feFunc${c}`);
    f.setAttribute("type", "table");
    f.setAttribute("tableValues", channelTable(g, i));
    ct.appendChild(f);
  });
  filter.appendChild(ct);
  const sat = (1 + g.vibrance / 150) * (g.look !== "none" ? 1 + ((lookSaturation[g.look] ?? 1) - 1) * (g.lookIntensity / 100) : 1);
  if (Math.abs(sat - 1) > 0.001) {
    const cm = document.createElementNS(ns, "feColorMatrix");
    cm.setAttribute("type", "saturate");
    cm.setAttribute("values", String(Math.max(0, sat)));
    filter.appendChild(cm);
  }
  host.appendChild(filter);
  const url = `url(#${id})`;
  made.set(key, url);
  return url;
}

/** Viñeta sobre el rectángulo del clip (en sus coordenadas). */
export function drawVignette(ctx: CanvasRenderingContext2D, clip: MediaClip, w: number, h: number) {
  const amount = (clip.color?.vignette || 0) / 100;
  if (amount <= 0) return;
  const r = Math.hypot(w, h) / 2;
  const gr = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, `rgba(0,0,0,${Math.min(0.95, amount)})`);
  ctx.filter = "none";
  ctx.fillStyle = gr;
  ctx.fillRect(-w / 2, -h / 2, w, h);
}

export const TRANSITIONS: { id: NonNullable<MediaClip["transition"]>["kind"]; name: string }[] = [
  { id: "dissolve", name: "Disolución cruzada" },
  { id: "dipBlack", name: "Fundido a negro" },
  { id: "dipWhite", name: "Fundido a blanco" },
  { id: "wipe", name: "Barrido" },
  { id: "slide", name: "Deslizar" },
  { id: "zoom", name: "Zoom" },
];
