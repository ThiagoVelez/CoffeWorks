// Dibuja el QR en SVG: formas de los módulos, ojos, degradados, fondo, adornos del tema, logo y marco.
// Todo lo decorativo queda fuera de la zona de lectura o en el centro (como máximo ~15 % del área),
// y el QR usa corrección H para que siga leyéndose.
import { matriz, type Nivel } from "./matriz";
import { tema, type TemaId } from "./adornos";

export type Forma = "cuadrado" | "redondeado" | "puntos" | "gotas" | "diamantes" | "estrellas" | "barrasV" | "barrasH" | "liquido";
export type FormaOjo = "cuadrado" | "redondeado" | "circulo" | "hoja";
export type FormaCentro = "cuadrado" | "punto" | "redondeado" | "hoja";
export type EstiloMarco = "abajo" | "burbuja" | "ninguno";

export type Relleno =
  | string
  | { tipo: "lineal"; colores: [string, string]; angulo: number }
  | { tipo: "radial"; colores: [string, string] };

export interface Diseno {
  modulo: Forma;
  ojoMarco: FormaOjo;
  ojoCentro: FormaCentro;
  color: Relleno;
  colorOjos?: string;
  /** `null` = sin fondo (transparente). */
  fondo: string | null;
  /** Zona en blanco alrededor, en módulos (mínimo 2). */
  margen: number;
  tema: TemaId | null;
  adornoCentro: boolean;
  adornoBorde: boolean;
  /** Imagen (data URL) para el centro. */
  logo: string | null;
  /** Parte del lado del QR que ocupa el centro (se limita a ~15 % del área). */
  tamanoCentro?: number;
  marco: { texto: string; color: string; estilo: EstiloMarco };
}

export const FORMAS: { id: Forma; nombre: string }[] = [
  { id: "cuadrado", nombre: "Cuadrado" },
  { id: "redondeado", nombre: "Redondeado" },
  { id: "puntos", nombre: "Puntos" },
  { id: "gotas", nombre: "Gotas" },
  { id: "diamantes", nombre: "Diamantes" },
  { id: "estrellas", nombre: "Estrellas" },
  { id: "barrasV", nombre: "Barras verticales" },
  { id: "barrasH", nombre: "Barras horizontales" },
  { id: "liquido", nombre: "Líquido" },
];
export const OJOS_MARCO: { id: FormaOjo; nombre: string }[] = [
  { id: "cuadrado", nombre: "Cuadrado" },
  { id: "redondeado", nombre: "Redondeado" },
  { id: "circulo", nombre: "Círculo" },
  { id: "hoja", nombre: "Hoja" },
];
export const OJOS_CENTRO: { id: FormaCentro; nombre: string }[] = [
  { id: "cuadrado", nombre: "Cuadrado" },
  { id: "punto", nombre: "Punto" },
  { id: "redondeado", nombre: "Redondeado" },
  { id: "hoja", nombre: "Hoja" },
];

export const DISENO_BASE: Diseno = {
  modulo: "cuadrado",
  ojoMarco: "cuadrado",
  ojoCentro: "cuadrado",
  color: "#000000",
  fondo: "#ffffff",
  margen: 4,
  tema: null,
  adornoCentro: false,
  adornoBorde: false,
  logo: null,
  marco: { texto: "", color: "#000000", estilo: "ninguno" },
};

/** Lado máximo del centro como parte del lado del QR: √0,15 ≈ 0,387 → 15 % del área. */
export const CENTRO_MAXIMO = Math.sqrt(0.15);
const CENTRO_PREDETERMINADO = 0.3;

const U = 10; // unidades SVG por módulo
const r2 = (x: number) => Math.round(x * 100) / 100;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Rectángulo con un radio por esquina (sup-izq, sup-der, inf-der, inf-izq). */
function rectR(x: number, y: number, w: number, h: number, [a, b, c, d]: number[]): string {
  return `M${r2(x + a)} ${r2(y)}H${r2(x + w - b)}${b ? `A${r2(b)} ${r2(b)} 0 0 1 ${r2(x + w)} ${r2(y + b)}` : ""}V${r2(y + h - c)}${c ? `A${r2(c)} ${r2(c)} 0 0 1 ${r2(x + w - c)} ${r2(y + h)}` : ""}H${r2(x + d)}${d ? `A${r2(d)} ${r2(d)} 0 0 1 ${r2(x)} ${r2(y + h - d)}` : ""}V${r2(y + a)}${a ? `A${r2(a)} ${r2(a)} 0 0 1 ${r2(x + a)} ${r2(y)}` : ""}Z`;
}
const circulo = (cx: number, cy: number, r: number) => `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
const rombo = (cx: number, cy: number, r: number) => `M${r2(cx)} ${r2(cy - r)}L${r2(cx + r)} ${r2(cy)}L${r2(cx)} ${r2(cy + r)}L${r2(cx - r)} ${r2(cy)}Z`;
function estrella(cx: number, cy: number, ro: number, ri: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? "L" : "M"}${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`;
  }
  return d + "Z";
}

/** Trazos de los módulos (sin los ojos ni el centro reservado). */
function modulos(n: number, on: (f: number, c: number) => boolean, forma: Forma, ox: number, oy: number): string {
  const p: string[] = [];
  const X = (c: number) => ox + c * U;
  const Y = (f: number) => oy + f * U;
  if (forma === "barrasV" || forma === "barrasH") {
    const v = forma === "barrasV";
    for (let a = 0; a < n; a++) {
      let b = 0;
      while (b < n) {
        const ok = (k: number) => (v ? on(k, a) : on(a, k));
        if (!ok(b)) { b++; continue; }
        let e = b;
        while (e + 1 < n && ok(e + 1)) e++;
        const largo = (e - b + 1) * U - 0.16 * U;
        const ancho = 0.84 * U;
        const rr = ancho / 2;
        p.push(v ? rectR(X(a) + 0.08 * U, Y(b) + 0.08 * U, ancho, largo, [rr, rr, rr, rr]) : rectR(X(b) + 0.08 * U, Y(a) + 0.08 * U, largo, ancho, [rr, rr, rr, rr]));
        b = e + 1;
      }
    }
    return p.join("");
  }
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (!on(f, c)) continue;
      const x = X(c), y = Y(f), cx = x + U / 2, cy = y + U / 2;
      switch (forma) {
        case "cuadrado": p.push(`M${x} ${y}h${U}v${U}h${-U}Z`); break;
        case "redondeado": p.push(rectR(x + 0.04 * U, y + 0.04 * U, 0.92 * U, 0.92 * U, [3, 3, 3, 3])); break;
        case "puntos": p.push(circulo(cx, cy, 0.46 * U)); break;
        case "gotas": p.push(rectR(x + 0.04 * U, y + 0.04 * U, 0.92 * U, 0.92 * U, [4.6, 4.6, 0, 4.6])); break;
        case "diamantes": p.push(rombo(cx, cy, 0.6 * U)); break;
        case "estrellas": p.push(estrella(cx, cy, 0.64 * U, 0.34 * U)); break;
        case "liquido": {
          const ar = on(f - 1, c), ab = on(f + 1, c), iz = on(f, c - 1), de = on(f, c + 1);
          const R = U / 2;
          p.push(rectR(x, y, U, U, [!ar && !iz ? R : 0, !ar && !de ? R : 0, !ab && !de ? R : 0, !ab && !iz ? R : 0]));
          break;
        }
      }
    }
  }
  return p.join("");
}

/**
 * Centros que se leen bien con cada marco, con su tamaño (probado con jsQR a 600 y 180 px con todas
 * las formas): los lectores buscan las proporciones 1:1:3:1:1 también en diagonal.
 */
export const CENTROS_POR_MARCO: Record<FormaOjo, Partial<Record<FormaCentro, number>>> = {
  cuadrado: { cuadrado: 1.05, redondeado: 1.05 },
  redondeado: { redondeado: 1.05, punto: 1.1, cuadrado: 0.85 },
  circulo: { punto: 1.1, redondeado: 1 },
  hoja: { hoja: 1.075, redondeado: 1 },
};

/** El centro pedido si se lee bien con ese marco; si no, el primero que sí. */
export function centroValido(m: FormaOjo, c: FormaCentro): FormaCentro {
  const ok = CENTROS_POR_MARCO[m];
  return c in ok ? c : (Object.keys(ok)[0] as FormaCentro);
}

/** Marco (7×7) y centro (3×3) de un ojo; `giro` orienta la hoja hacia fuera. */
function ojo(x: number, y: number, m: FormaOjo, c: FormaCentro, giro: 0 | 1 | 2): { marco: string; centro: string } {
  const s = 7 * U, cx = x + s / 2, cy = y + s / 2;
  const hoja = (R: number) => (giro === 1 ? [0, R, 0, R] : [R, 0, R, 0]);
  let marco: string;
  switch (m) {
    case "cuadrado": marco = rectR(x, y, s, s, [0, 0, 0, 0]) + rectR(x + U, y + U, 5 * U, 5 * U, [0, 0, 0, 0]); break;
    case "redondeado": marco = rectR(x, y, s, s, [20, 20, 20, 20]) + rectR(x + U, y + U, 5 * U, 5 * U, [11, 11, 11, 11]); break;
    case "circulo": marco = circulo(cx, cy, 3.5 * U) + circulo(cx, cy, 2.5 * U); break;
    case "hoja": marco = rectR(x, y, s, s, hoja(30)) + rectR(x + U, y + U, 5 * U, 5 * U, hoja(20)); break;
  }
  c = centroValido(m, c);
  const e = CENTROS_POR_MARCO[m][c] ?? 1;
  const t = 3 * U * e, tx = cx - t / 2, ty = cy - t / 2;
  let centro: string;
  switch (c) {
    case "cuadrado": centro = rectR(tx, ty, t, t, [0, 0, 0, 0]); break;
    case "punto": centro = circulo(cx, cy, t / 2); break;
    case "redondeado": centro = rectR(tx, ty, t, t, [t * 0.27, t * 0.27, t * 0.27, t * 0.27]); break;
    case "hoja": centro = rectR(tx, ty, t, t, hoja(t * 0.45)); break;
  }
  return { marco, centro };
}

/** Patrón de alineación de 5×5 (anillo + punto) con la forma de los ojos. */
function alineacion(x: number, y: number, m: FormaOjo): string {
  const s = 5 * U, cx = x + s / 2, cy = y + s / 2;
  switch (m) {
    case "circulo": return circulo(cx, cy, 2.5 * U) + circulo(cx, cy, 1.5 * U) + circulo(cx, cy, 0.5 * U);
    case "cuadrado": return rectR(x, y, s, s, [0, 0, 0, 0]) + rectR(x + U, y + U, 3 * U, 3 * U, [0, 0, 0, 0]) + rectR(x + 2 * U, y + 2 * U, U, U, [0, 0, 0, 0]);
    default: return rectR(x, y, s, s, [14, 14, 14, 14]) + rectR(x + U, y + U, 3 * U, 3 * U, [7, 7, 7, 7]) + circulo(cx, cy, 0.55 * U);
  }
}

function relleno(id: string, r: Relleno, x: number, y: number, s: number): { defs: string; fill: string } {
  if (typeof r === "string") return { defs: "", fill: r };
  const [a, b] = r.colores;
  if (r.tipo === "radial") {
    return { defs: `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${r2(x + s / 2)}" cy="${r2(y + s / 2)}" r="${r2(s * 0.7)}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`, fill: `url(#${id})` };
  }
  const ang = (r.angulo * Math.PI) / 180, dx = (Math.cos(ang) * s) / 2, dy = (Math.sin(ang) * s) / 2;
  const cx = x + s / 2, cy = y + s / 2;
  return { defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(cx - dx)}" y1="${r2(cy - dy)}" x2="${r2(cx + dx)}" y2="${r2(cy + dy)}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`, fill: `url(#${id})` };
}

/** Color «representativo» de un relleno (el primero del degradado). */
export const colorDe = (r: Relleno) => (typeof r === "string" ? r : r.colores[0]);

/** Lado del centro (en módulos, impar), limitado a ~15 % del área. */
export function ladoCentro(n: number, parte = CENTRO_PREDETERMINADO): number {
  const k = Math.floor(n * Math.min(Math.max(parte, 0.1), CENTRO_MAXIMO));
  const impar = k % 2 ? k : k - 1;
  return (impar * impar) / (n * n) > 0.15 ? impar - 2 : impar;
}

export interface Dibujo { svg: string; ancho: number; alto: number }

/**
 * Prueba «chica» (como una foto de un QR impreso pequeño): anchos a los que cada módulo mide 4, 5 y
 * 6 píxeles. A esos tamaños la lectura depende de cómo caen los píxeles, así que se pide que lea en
 * al menos dos de los tres (`LECTURAS_CHICAS`).
 */
export const PX_MODULO_CHICO = [4, 5, 6];
export const LECTURAS_CHICAS = 2;
export const anchosChicos = (d: Dibujo) => PX_MODULO_CHICO.map((k) => Math.round((d.ancho / U) * k));

export function dibujarSvg(texto: string, d: Diseno, nivel: Nivel = "H"): Dibujo {
  const m = matriz(texto, nivel);
  const n = m.n;
  const t = tema(d.tema);
  const margen = Math.max(2, Math.round(d.margen));
  const bandaBorde = d.adornoBorde && t ? 4 : 0;
  const lado = (n + 2 * margen + 2 * bandaBorde) * U; // cuadrado del QR con su margen y adornos
  const conMarco = d.marco.estilo !== "ninguno" && d.marco.texto.trim() !== "";
  // El marco crece con el QR (k = 1 para un QR de 41 módulos de lado con su margen).
  const k = lado / (41 * U);
  const grosor = conMarco && d.marco.estilo === "abajo" ? 1.2 * U * k : 0;
  const altoTexto = conMarco ? 6 * U * k : 0;
  const ancho = lado + 2 * grosor;
  const alto = lado + 2 * grosor + altoTexto + (conMarco && d.marco.estilo === "burbuja" ? 1.5 * U * k : 0);
  const ox = grosor + (margen + bandaBorde) * U, oy = ox; // esquina del primer módulo
  const s = n * U;

  // Centro reservado (insignia del tema o logo).
  const hayCentro = !!d.logo || (d.adornoCentro && !!t);
  const kc = hayCentro ? ladoCentro(n, d.tamanoCentro) : 0;
  const c0 = Math.floor((n - kc) / 2);
  const enCentro = (f: number, c: number) => hayCentro && f >= c0 && f < c0 + kc && c >= c0 && c < c0 + kc;
  const on = (f: number, c: number) => m.oscuro(f, c) && !m.esOjo(f, c) && !m.esAlineacion(f, c) && !enCentro(f, c);

  const partes: string[] = [];
  const defs: string[] = [];
  const fondoQr = d.fondo;

  // Con fondo se pinta todo el lienzo (el PNG «con fondo» no tiene ningún píxel transparente).
  if (fondoQr) partes.push(`<rect width="${r2(ancho)}" height="${r2(alto)}" fill="${fondoQr}"/>`);
  if (conMarco && d.marco.estilo === "abajo") {
    const R = 3 * U * k;
    partes.push(`<path d="${rectR(0, 0, ancho, alto, [R, R, R, R])}" fill="${d.marco.color}"/>`);
    // Dentro del marco siempre hay un fondo claro: sin él, el QR quedaría sobre el color del marco.
    partes.push(`<path d="${rectR(grosor, grosor, lado, lado, [R * 0.7, R * 0.7, R * 0.7, R * 0.7])}" fill="${fondoQr ?? "#ffffff"}"/>`);
  }

  // Adornos del borde: dibujos del tema repartidos en la banda exterior, fuera de la zona en blanco.
  if (bandaBorde && t) {
    const tam = 2.6 * U;
    const ini = grosor + 0.7 * U;
    const fin = grosor + lado - 0.7 * U - tam;
    const pasos = Math.max(3, Math.round((fin - ini) / (tam * 1.55)));
    const g: string[] = [];
    let i = 0;
    const pon = (x: number, y: number, rot: number) => {
      const dib = t.borde[i++ % t.borde.length];
      g.push(`<g transform="translate(${r2(x)} ${r2(y)}) rotate(${rot} ${r2(tam / 2)} ${r2(tam / 2)}) scale(${r2(tam / 24)})">${dib}</g>`);
    };
    for (let j = 0; j <= pasos; j++) {
      const p = ini + ((fin - ini) * j) / pasos;
      pon(p, ini, (j * 37) % 40 - 20);
      pon(p, fin, (j * 53) % 40 - 20);
      if (j > 0 && j < pasos) { pon(ini, p, (j * 29) % 40 - 20); pon(fin, p, (j * 41) % 40 - 20); }
    }
    partes.push(`<g color="${t.acento}" opacity="0.9">${g.join("")}</g>`);
  }

  const fm = relleno("cq-mod", d.color, ox, oy, s);
  if (fm.defs) defs.push(fm.defs);
  partes.push(`<path d="${modulos(n, on, d.modulo, ox, oy)}" fill="${fm.fill}"/>`);
  // Patrones de alineación (5×5) enteros, al estilo de los ojos: los lectores los buscan por su forma.
  const al = m.alineacion.filter(([f, c]) => !enCentro(f, c)).map(([f, c]) => alineacion(ox + (c - 2) * U, oy + (f - 2) * U, d.ojoMarco)).join("");
  if (al) partes.push(`<path d="${al}" fill="${fm.fill}" fill-rule="evenodd"/>`);

  const fo = d.colorOjos ? { defs: "", fill: d.colorOjos } : fm;
  const ojos = [ojo(ox, oy, d.ojoMarco, d.ojoCentro, 0), ojo(ox + (n - 7) * U, oy, d.ojoMarco, d.ojoCentro, 1), ojo(ox, oy + (n - 7) * U, d.ojoMarco, d.ojoCentro, 1)];
  partes.push(`<path d="${ojos.map((o) => o.marco).join("")}" fill="${fo.fill}" fill-rule="evenodd"/>`);
  partes.push(`<path d="${ojos.map((o) => o.centro).join("")}" fill="${fo.fill}"/>`);

  if (hayCentro) {
    const x = ox + c0 * U, y = oy + c0 * U, w = kc * U;
    const pad = 0.35 * U;
    if (d.logo) {
      partes.push(`<path d="${rectR(x + pad, y + pad, w - 2 * pad, w - 2 * pad, [U, U, U, U])}" fill="${fondoQr ?? "#ffffff"}"/>`);
      partes.push(`<image href="${esc(d.logo)}" x="${r2(x + 2 * pad)}" y="${r2(y + 2 * pad)}" width="${r2(w - 4 * pad)}" height="${r2(w - 4 * pad)}" preserveAspectRatio="xMidYMid meet"/>`);
    } else if (t) {
      const cx = x + w / 2, cy = y + w / 2;
      const r = w / 2 - pad;
      partes.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r - 0.3 * U)}" fill="${fondoQr ?? "#ffffff"}" stroke="${t.color}" stroke-width="${r2(0.6 * U)}"/>`);
      const tamI = (w - 2 * pad) * 0.6;
      partes.push(`<g color="${t.color}" transform="translate(${r2(cx - tamI / 2)} ${r2(cy - tamI / 2)}) scale(${r2(tamI / 24)})">${t.icono}</g>`);
    }
  }

  if (conMarco) {
    const texto = esc(d.marco.texto.trim().slice(0, 40));
    const tamLetra = Math.min(3.4 * U * k, (ancho * 1.6) / Math.max(texto.length, 6));
    if (d.marco.estilo === "abajo") {
      partes.push(`<text x="${r2(ancho / 2)}" y="${r2(lado + 1.5 * grosor + altoTexto / 2)}" text-anchor="middle" dominant-baseline="central" font-family="Hanken Grotesk, Arial, Helvetica, sans-serif" font-weight="700" font-size="${r2(tamLetra)}" fill="#ffffff">${texto}</text>`);
    } else {
      const by = lado + 1.5 * U * k, bh = altoTexto - 0.5 * U * k, bx = 2 * U * k, bw = ancho - 4 * U * k;
      partes.push(`<path d="${rectR(bx, by, bw, bh, [bh / 2, bh / 2, bh / 2, bh / 2])}M${r2(ancho / 2 - U * k)} ${r2(by + 0.5)}L${r2(ancho / 2)} ${r2(by - 1.3 * U * k)}L${r2(ancho / 2 + U * k)} ${r2(by + 0.5)}Z" fill="${d.marco.color}"/>`);
      partes.push(`<text x="${r2(ancho / 2)}" y="${r2(by + bh / 2)}" text-anchor="middle" dominant-baseline="central" font-family="Hanken Grotesk, Arial, Helvetica, sans-serif" font-weight="700" font-size="${r2(tamLetra)}" fill="#ffffff">${texto}</text>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(ancho)} ${r2(alto)}" width="${r2(ancho)}" height="${r2(alto)}" shape-rendering="geometricPrecision">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${partes.join("")}</svg>`;
  return { svg, ancho, alto };
}
