// Imágenes en escala de grises (0 negro … 255 blanco) y su preparación para el reconocedor de
// fórmulas. Reproduce lo que hace pix2tex con PIL: recortar al contenido, rellenar a múltiplos de
// 32, limitar el tamaño y normalizar. Todo es puro para poder probarlo en Node.

export interface Gris {
  ancho: number;
  alto: number;
  datos: Uint8ClampedArray;
}

export const gris = (ancho: number, alto: number, relleno = 255): Gris => ({ ancho, alto, datos: new Uint8ClampedArray(ancho * alto).fill(relleno) });

/** Lee un PGM binario (P5), el formato de las muestras de las pruebas. */
export function leerPgm(bytes: Uint8Array): Gris {
  let i = 0;
  const campo = () => {
    while (i < bytes.length) {
      if (bytes[i] === 0x23) while (i < bytes.length && bytes[i] !== 0x0a) i++;
      else if (bytes[i] <= 0x20) i++;
      else break;
    }
    let s = "";
    while (i < bytes.length && bytes[i] > 0x20) s += String.fromCharCode(bytes[i++]);
    return s;
  };
  if (campo() !== "P5") throw new Error("No es un PGM binario");
  const ancho = Number(campo()), alto = Number(campo());
  campo();
  i++;
  return { ancho, alto, datos: new Uint8ClampedArray(bytes.subarray(i, i + ancho * alto)) };
}

/** Escala de grises de un RGBA (como un ImageData del navegador). */
export function desdeRgba(rgba: Uint8ClampedArray, ancho: number, alto: number): Gris {
  const g = gris(ancho, alto);
  for (let p = 0, q = 0; p < g.datos.length; p++, q += 4) {
    const a = rgba[q + 3] / 255;
    const y = 0.299 * rgba[q] + 0.587 * rgba[q + 1] + 0.114 * rgba[q + 2];
    g.datos[p] = Math.round(y * a + 255 * (1 - a)); // lo transparente cuenta como papel blanco
  }
  return g;
}

export function recortar(img: Gris, x: number, y: number, ancho: number, alto: number): Gris {
  const r = gris(ancho, alto);
  for (let f = 0; f < alto; f++) {
    const yy = y + f;
    if (yy < 0 || yy >= img.alto) continue;
    for (let c = 0; c < ancho; c++) {
      const xx = x + c;
      if (xx >= 0 && xx < img.ancho) r.datos[f * ancho + c] = img.datos[yy * img.ancho + xx];
    }
  }
  return r;
}

// ---------- Redimensionar como PIL (convolución separable) ----------

type Filtro = { soporte: number; f: (x: number) => number };
const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const LANCZOS: Filtro = { soporte: 3, f: (x) => (x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0) };
const BILINEAL: Filtro = { soporte: 1, f: (x) => { x = Math.abs(x); return x < 1 ? 1 - x : 0; } };

function pesos(entrada: number, salida: number, filtro: Filtro) {
  const escala = entrada / salida;
  const fs = Math.max(escala, 1);
  const soporte = filtro.soporte * fs;
  const res: { ini: number; w: Float64Array }[] = [];
  for (let o = 0; o < salida; o++) {
    const centro = (o + 0.5) * escala;
    const ini = Math.max(0, Math.floor(centro - soporte + 0.5));
    const fin = Math.min(entrada, Math.floor(centro + soporte + 0.5));
    const w = new Float64Array(Math.max(0, fin - ini));
    let total = 0;
    for (let k = 0; k < w.length; k++) {
      w[k] = filtro.f((k + ini - centro + 0.5) / fs);
      total += w[k];
    }
    if (total !== 0) for (let k = 0; k < w.length; k++) w[k] /= total;
    res.push({ ini, w });
  }
  return res;
}

export function redimensionar(img: Gris, ancho: number, alto: number, modo: "lanczos" | "bilineal" = "bilineal"): Gris {
  ancho = Math.max(1, Math.round(ancho));
  alto = Math.max(1, Math.round(alto));
  if (ancho === img.ancho && alto === img.alto) return { ancho, alto, datos: new Uint8ClampedArray(img.datos) };
  const filtro = modo === "lanczos" ? LANCZOS : BILINEAL;
  // Horizontal
  const ph = pesos(img.ancho, ancho, filtro);
  const tmp = new Uint8ClampedArray(ancho * img.alto);
  for (let y = 0; y < img.alto; y++) {
    const fila = y * img.ancho;
    for (let x = 0; x < ancho; x++) {
      const { ini, w } = ph[x];
      let s = 0;
      for (let k = 0; k < w.length; k++) s += img.datos[fila + ini + k] * w[k];
      tmp[y * ancho + x] = Math.round(s);
    }
  }
  // Vertical
  const pv = pesos(img.alto, alto, filtro);
  const out = new Uint8ClampedArray(ancho * alto);
  for (let y = 0; y < alto; y++) {
    const { ini, w } = pv[y];
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      for (let k = 0; k < w.length; k++) s += tmp[(ini + k) * ancho + x] * w[k];
      out[y * ancho + x] = Math.round(s);
    }
  }
  return { ancho, alto, datos: out };
}

// ---------- Preparación de pix2tex ----------

const MAX = [672, 192] as const;
const MIN = [32, 32] as const;

/** Recorta al contenido (texto oscuro sobre fondo claro) y rellena a múltiplos de 32 con blanco. */
export function rellenar(img: Gris, multiplo = 32): Gris {
  let min = 255, max = 0;
  for (const v of img.datos) { if (v < min) min = v; if (v > max) max = v; }
  const rango = max - min || 1;
  const datos = new Float64Array(img.datos.length);
  let suma = 0;
  for (let p = 0; p < datos.length; p++) { datos[p] = ((img.datos[p] - min) / rango) * 255; suma += datos[p]; }
  const claro = suma / datos.length > 128;
  if (!claro) for (let p = 0; p < datos.length; p++) datos[p] = 255 - datos[p];
  // Caja del contenido
  let x0 = img.ancho, y0 = img.alto, x1 = -1, y1 = -1;
  for (let y = 0; y < img.alto; y++)
    for (let x = 0; x < img.ancho; x++) {
      // Tras invertir (si hacía falta) la tinta es siempre lo oscuro.
      if (datos[y * img.ancho + x] < (claro ? 128 : 127)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = img.ancho - 1; y1 = img.alto - 1; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const W = Math.ceil(w / multiplo) * multiplo, H = Math.ceil(h / multiplo) * multiplo;
  const out = gris(W, H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.datos[y * W + x] = Math.trunc(datos[(y + y0) * img.ancho + x + x0]);
  return out;
}

/** Limita a 672×192 (reduciendo) y como mínimo 32×32 (rellenando). */
export function limitar(img: Gris): Gris {
  let r = img;
  const ratios = [img.ancho / MAX[0], img.alto / MAX[1]];
  if (ratios.some((x) => x > 1)) {
    const m = Math.max(...ratios);
    r = redimensionar(img, Math.max(1, Math.floor(img.ancho / m)), Math.max(1, Math.floor(img.alto / m)), "bilineal");
  }
  const W = Math.max(r.ancho, MIN[0]), H = Math.max(r.alto, MIN[1]);
  if (W === r.ancho && H === r.alto) return r;
  const out = gris(W, H);
  for (let y = 0; y < r.alto; y++) for (let x = 0; x < r.ancho; x++) out.datos[y * W + x] = r.datos[y * r.ancho + x];
  return out;
}

/** Tensor [1,1,alto,ancho] normalizado como en el entrenamiento. */
export function normalizar(img: Gris): Float32Array {
  const media = 0.7931 * 255, desv = 0.1738 * 255;
  const t = new Float32Array(img.datos.length);
  for (let p = 0; p < t.length; p++) t[p] = (img.datos[p] - media) / desv;
  return t;
}
