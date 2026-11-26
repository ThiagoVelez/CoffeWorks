// Reconocedor de fórmulas: pix2tex (modelos ONNX del complemento «latexocr»). Funciona con
// onnxruntime-web (la app) y onnxruntime-node (las pruebas): solo usa lo común de los dos.

import { limitar, normalizar, redimensionar, rellenar, type Gris } from "./imagen";
import { armarLatex, type Duda, type Pieza } from "./tokens";

/** Lo que se usa de onnxruntime (web o node). */
export interface Ort {
  Tensor: new (tipo: string, datos: Float32Array | BigInt64Array | Uint8Array | boolean[], dims: number[]) => unknown;
}
export interface SesionOnnx {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(entradas: Record<string, unknown>): Promise<Record<string, { data: unknown; dims: readonly number[] }>>;
}

export interface Modelos {
  ort: Ort;
  redimensionador: SesionOnnx;
  codificador: SesionOnnx;
  decodificador: SesionOnnx;
  /** Texto de cada pieza por su número. */
  vocabulario: string[];
}

export interface Resultado {
  latex: string;
  dudas: Duda[];
  /** Confianza media (0…1). */
  confianza: number;
}

const BOS = 1;
const EOS = 2;
export const UMBRAL_DUDA = 0.5;

/** Vocabulario a partir del tokenizer.json de pix2tex. */
export function leerVocabulario(json: string): string[] {
  const vocab = (JSON.parse(json) as { model: { vocab: Record<string, number> } }).model.vocab;
  const v: string[] = [];
  for (const [t, i] of Object.entries(vocab)) v[i] = t;
  return v;
}

const tensorImagen = (ort: Ort, img: Gris) => new ort.Tensor("float32", normalizar(img), [1, 1, img.alto, img.ancho]);

/** Elige el tamaño con el que el modelo lee mejor la fórmula (como pix2tex: hasta 10 intentos). */
async function prepararImagen(m: Modelos, img: Gris): Promise<Gris> {
  const entrada = limitar(rellenar(img));
  let r = 1, w = entrada.ancho, h = entrada.alto;
  let final = entrada;
  for (let intento = 0; intento < 10; intento++) {
    h = Math.trunc(h * r);
    final = rellenar(limitar(redimensionar(entrada, w, h, r > 1 ? "bilineal" : "lanczos")));
    const out = await m.redimensionador.run({ [m.redimensionador.inputNames[0]]: tensorImagen(m.ort, final) });
    const datos = out[m.redimensionador.outputNames[0]].data as Float32Array;
    let mejor = 0;
    for (let k = 1; k < datos.length; k++) if (datos[k] > datos[mejor]) mejor = k;
    w = (mejor + 1) * 32;
    if (w === final.ancho) break;
    r = w / final.ancho;
  }
  return final;
}

/** Reconoce una fórmula. `alAvanzar` recibe cuántas piezas lleva (para la barra de progreso). */
export async function reconocerFormula(m: Modelos, img: Gris, opciones: { maxPiezas?: number; alAvanzar?: (n: number) => void; cancelado?: () => boolean } = {}): Promise<Resultado> {
  const final = await prepararImagen(m, img);
  const cod = await m.codificador.run({ [m.codificador.inputNames[0]]: tensorImagen(m.ort, final) });
  const contexto = cod[m.codificador.outputNames[0]];
  const ctx = new m.ort.Tensor("float32", contexto.data as Float32Array, [...contexto.dims]);
  const [nx, nmask, nctx] = m.decodificador.inputNames;
  const secuencia: number[] = [BOS];
  const piezas: Pieza[] = [];
  const max = opciones.maxPiezas ?? 400;
  for (let paso = 0; paso < max; paso++) {
    if (opciones.cancelado?.()) break;
    const x = new m.ort.Tensor("int64", BigInt64Array.from(secuencia.map(BigInt)), [1, secuencia.length]);
    const mascara = new m.ort.Tensor("bool", new Uint8Array(secuencia.length).fill(1), [1, secuencia.length]);
    const out = await m.decodificador.run({ [nx]: x, [nmask]: mascara, [nctx]: ctx });
    const o = out[m.decodificador.outputNames[0]];
    const datos = o.data as Float32Array;
    const V = o.dims[o.dims.length - 1];
    const ultimo = datos.subarray(datos.length - V);
    // Probabilidades (softmax) y las tres mejores
    let maxv = -Infinity;
    for (const v of ultimo) if (v > maxv) maxv = v;
    let suma = 0;
    const p = new Float32Array(V);
    for (let k = 0; k < V; k++) { p[k] = Math.exp(ultimo[k] - maxv); suma += p[k]; }
    const orden = [0, 1, 2, 3].map(() => -1);
    for (let k = 0; k < V; k++) {
      p[k] /= suma;
      for (let j = 0; j < 4; j++) {
        if (orden[j] < 0 || p[k] > p[orden[j]]) { orden.splice(j, 0, k); orden.length = 4; break; }
      }
    }
    const elegido = orden[0];
    if (elegido === EOS) break;
    secuencia.push(elegido);
    if (elegido > EOS) {
      piezas.push({
        texto: m.vocabulario[elegido] ?? "",
        prob: p[elegido],
        alternativas: orden.slice(1).filter((k) => k > EOS && p[k] > 0.02).map((k) => ({ texto: m.vocabulario[k] ?? "", prob: p[k] })),
      });
    }
    opciones.alAvanzar?.(piezas.length);
  }
  const { latex, dudas } = armarLatex(piezas, UMBRAL_DUDA);
  const confianza = piezas.length ? piezas.reduce((s, x) => s + x.prob, 0) / piezas.length : 0;
  return { latex, dudas, confianza };
}
