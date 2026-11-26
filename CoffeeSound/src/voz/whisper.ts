// Whisper (sherpa-onnx, «small» int8) para sacar la letra: espectrograma como el Whisper original
// (Hann de 400, salto 160, 80 bandas mel de librosa, log10), detección de idioma y decodificación
// voraz con caché, como el ejemplo de referencia de sherpa-onnx. Sirve con onnxruntime-web y -node.

import { stft } from "./senal";
import type { Ort, SesionOnnx } from "./separar";

export interface ModelosWhisper {
  ort: Ort;
  codificador: SesionOnnx;
  decodificador: SesionOnnx;
  /** Bytes de cada pieza (tokens.txt de sherpa, en base64). */
  fichas: Uint8Array[];
  /** Metadatos del codificador (sot, eot, idiomas…). */
  meta: Record<string, string>;
}

export const IDIOMAS = [
  { codigo: "", nombre: "Detectar" },
  { codigo: "es", nombre: "Español" },
  { codigo: "en", nombre: "Inglés" },
  { codigo: "pt", nombre: "Portugués" },
  { codigo: "fr", nombre: "Francés" },
  { codigo: "it", nombre: "Italiano" },
  { codigo: "de", nombre: "Alemán" },
];

// ---------- Espectrograma ----------

let filtros: Float64Array[] | null = null;
/** Filtros mel de librosa (escala Slaney, normalización «slaney»): 80 × 201. */
function filtrosMel(): Float64Array[] {
  if (filtros) return filtros;
  const sr = 16000, nFft = 400, nMel = 80, bandas = nFft / 2 + 1;
  const hzAMel = (h: number) => (h >= 1000 ? 15 + Math.log(h / 1000) / (Math.log(6.4) / 27) : h / (200 / 3));
  const melAHz = (m: number) => (m >= 15 ? 1000 * Math.exp((Math.log(6.4) / 27) * (m - 15)) : (200 / 3) * m);
  const maxMel = hzAMel(sr / 2);
  const mels = Array.from({ length: nMel + 2 }, (_, i) => melAHz((maxMel * i) / (nMel + 1)));
  const fft = Array.from({ length: bandas }, (_, i) => (i * sr) / 2 / (bandas - 1));
  filtros = [];
  for (let m = 0; m < nMel; m++) {
    const w = new Float64Array(bandas);
    const enorm = 2 / (mels[m + 2] - mels[m]);
    for (let k = 0; k < bandas; k++) {
      const sube = (fft[k] - mels[m]) / (mels[m + 1] - mels[m]);
      const baja = (mels[m + 2] - fft[k]) / (mels[m + 2] - mels[m + 1]);
      w[k] = Math.max(0, Math.min(sube, baja)) * enorm;
    }
    filtros.push(w);
  }
  return filtros;
}

/** Entrada del codificador: 80 × cuadros (por banda), normalizada, con 1500 cuadros de relleno. */
export function melWhisper(x16k: Float32Array): { datos: Float32Array; cuadros: number } {
  const s = stft(x16k, 400, 160);
  const T = Math.max(0, s.cuadros - 1); // Whisper descarta el último cuadro
  const F = filtrosMel();
  const log = new Float32Array(80 * T);
  let max = -Infinity;
  for (let t = 0; t < T; t++) {
    for (let m = 0; m < 80; m++) {
      const w = F[m];
      let e = 0;
      for (let b = 0; b < s.bandas; b++) {
        if (w[b] === 0) continue;
        const re = s.re[b * s.cuadros + t], im = s.im[b * s.cuadros + t];
        e += w[b] * (re * re + im * im);
      }
      const v = Math.log10(Math.max(e, 1e-10));
      log[m * T + t] = v;
      if (v > max) max = v;
    }
  }
  const util = Math.min(T, T + 1500 > 3000 ? 2950 : T);
  const cuadros = T + 1500 > 3000 ? 3000 : T + 1500;
  const datos = new Float32Array(80 * cuadros);
  for (let m = 0; m < 80; m++)
    for (let t = 0; t < util; t++) datos[m * cuadros + t] = (Math.max(log[m * T + t], max - 8) + 4) / 4;
  return { datos, cuadros };
}

// ---------- Fichas y metadatos ----------

export function leerFichas(txt: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (const linea of txt.split("\n")) {
    const [b64, id] = linea.trim().split(/\s+/);
    if (!b64 || id === undefined) continue;
    let s = "";
    try {
      s = atob(b64);
    } catch {
      s = ""; // hay una pieza vacía escrita como «=»
    }
    out[Number(id)] = Uint8Array.from(s, (c) => c.charCodeAt(0));
  }
  return out;
}

/** Metadatos (metadata_props) de un archivo ONNX, sin cargar el modelo. */
export function metaDeArchivo(bytes: Uint8Array): Record<string, string> {
  let i = 0;
  const varint = () => {
    let r = 0, f = 1, b;
    do { b = bytes[i++]; r += (b & 0x7f) * f; f *= 128; } while (b & 0x80);
    return r;
  };
  const meta: Record<string, string> = {};
  const dec = new TextDecoder();
  while (i < bytes.length) {
    const clave = varint();
    const campo = Math.floor(clave / 8), tipo = clave & 7;
    if (tipo === 0) { varint(); continue; }
    if (tipo === 1) { i += 8; continue; }
    if (tipo === 5) { i += 4; continue; }
    if (tipo !== 2) break;
    const largo = varint();
    if (campo === 14) {
      // StringStringEntryProto { key = 1; value = 2 }
      const fin = i + largo;
      let k = "", v = "";
      while (i < fin) {
        const c = varint();
        const l = varint();
        const t = dec.decode(bytes.subarray(i, i + l));
        i += l;
        if (c >> 3 === 1) k = t; else if (c >> 3 === 2) v = t;
      }
      meta[k] = v;
    } else i += largo;
  }
  return meta;
}

// ---------- Decodificación ----------

export interface Transcripcion {
  texto: string;
  idioma: string;
  dudas: { ini: number; fin: number; prob: number }[];
  probMedia: number;
}

const UMBRAL_DUDA = 0.5;

export async function transcribir(m: ModelosWhisper, x16k: Float32Array, op: { idioma?: string; cancelado?: () => boolean } = {}): Promise<Transcripcion> {
  const n = (k: string) => Number(m.meta[k]);
  const SOT = n("sot"), EOT = n("eot"), TRANSCRIBIR = n("transcribe"), SIN_TIEMPOS = n("no_timestamps"), TRADUCIR = n("translate"), SIN_VOZ = n("no_speech");
  const BLANCO = Number(m.meta.blank_id ?? 220);
  const capas = n("n_text_layer"), ctx = n("n_text_ctx"), estado = n("n_text_state");
  const idiomasTok = m.meta.all_language_tokens.split(",").map(Number);
  const idiomasCod = m.meta.all_language_codes.split(",");

  const mel = melWhisper(x16k);
  const enc = await m.codificador.run({ [m.codificador.inputNames[0]]: new m.ort.Tensor("float32", mel.datos, [1, 80, mel.cuadros]) });
  const [ck, cv] = m.codificador.outputNames.map((k) => enc[k]);
  const cache = () => new m.ort.Tensor("float32", new Float32Array(capas * ctx * estado), [capas, 1, ctx, estado]);
  const nombres = m.decodificador.inputNames;
  const salidas = m.decodificador.outputNames;
  const paso = async (fichas: number[], offset: number, k: unknown, v: unknown) => {
    const out = await m.decodificador.run({
      [nombres[0]]: new m.ort.Tensor("int64", BigInt64Array.from(fichas.map(BigInt)), [1, fichas.length]),
      [nombres[1]]: k,
      [nombres[2]]: v,
      [nombres[3]]: ck,
      [nombres[4]]: cv,
      [nombres[5]]: new m.ort.Tensor("int64", BigInt64Array.from([BigInt(offset)]), [1]),
    });
    const lg = out[salidas[0]];
    const datos = lg.data as Float32Array;
    const V = lg.dims[lg.dims.length - 1];
    return { logits: Float32Array.from(datos.subarray(datos.length - V)), k: out[salidas[1]], v: out[salidas[2]] };
  };

  // Idioma
  let idioma = op.idioma && idiomasCod.includes(op.idioma) ? idiomasTok[idiomasCod.indexOf(op.idioma)] : -1;
  if (idioma < 0) {
    const { logits } = await paso([SOT], 0, cache(), cache());
    let mejor = idiomasTok[0];
    for (const t of idiomasTok) if (logits[t] > logits[mejor]) mejor = t;
    idioma = mejor;
  }

  const inicio = [SOT, idioma, TRANSCRIBIR, SIN_TIEMPOS];
  let r = await paso(inicio, 0, cache(), cache());
  let offset = inicio.length;
  const fichas: number[] = [];
  const probs: number[] = [];
  for (let i = 0; i < ctx - inicio.length - 1; i++) {
    if (op.cancelado?.()) throw new Error("Cancelado");
    const lg = r.logits;
    for (const t of [SOT, SIN_TIEMPOS, TRADUCIR, SIN_VOZ]) lg[t] = -Infinity;
    if (i === 0) { lg[EOT] = -Infinity; lg[BLANCO] = -Infinity; }
    let mejor = 0, max = -Infinity;
    for (let t = 0; t < lg.length; t++) if (lg[t] > max) { max = lg[t]; mejor = t; }
    if (mejor === EOT) break;
    let suma = 0;
    for (let t = 0; t < lg.length; t++) if (lg[t] > -Infinity) suma += Math.exp(lg[t] - max);
    probs.push(1 / suma);
    fichas.push(mejor);
    // Repeticiones sin fin (alucinación): se corta
    if (fichas.length > 24 && fichas.slice(-8).join() === fichas.slice(-16, -8).join()) break;
    r = await paso([mejor], offset, r.k, r.v);
    offset++;
  }

  // Texto y dudas (posiciones por pieza)
  const dec = new TextDecoder();
  const partes: Uint8Array[] = [];
  let previo = "";
  const rangos: [number, number][] = [];
  for (const f of fichas) {
    partes.push(m.fichas[f] ?? new Uint8Array());
    const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of partes) { total.set(p, o); o += p.length; }
    const ahora = dec.decode(total);
    rangos.push([previo.length, ahora.length]);
    previo = ahora;
  }
  const inicioTxt = previo.length - previo.trimStart().length;
  const texto = previo.trim();
  const dudas: Transcripcion["dudas"] = [];
  fichas.forEach((_, i) => {
    if (probs[i] >= UMBRAL_DUDA) return;
    let [a, b] = rangos[i];
    while (a < b && /\s/.test(previo[a])) a++;
    if (a >= b) return;
    const ini = a - inicioTxt, fin = Math.min(texto.length, b - inicioTxt);
    if (ini >= 0 && fin > ini) dudas.push({ ini, fin, prob: probs[i] });
  });
  const probMedia = probs.length ? probs.reduce((s, p) => s + p, 0) / probs.length : 0;
  return { texto, idioma: idiomasCod[idiomasTok.indexOf(idioma)] ?? "", dudas, probMedia };
}
