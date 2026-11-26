// Separar la voz de la música con MDX-Net (modelo UVR-MDX-NET-Voc_FT, complemento «separarvoz»).
// Reproduce la referencia de UVR / python-audio-separator: trozos de 255 saltos, STFT de 7680
// puntos, 3072 bandas al modelo, ISTFT, y música = mezcla − voz. Funciona con onnxruntime-web y
// onnxruntime-node (solo usa lo común de los dos).

import { istft, stft } from "./senal";

export interface Ort {
  Tensor: new (tipo: string, datos: Float32Array | BigInt64Array | Uint8Array, dims: number[]) => unknown;
}
export interface SesionOnnx {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(entradas: Record<string, unknown>): Promise<Record<string, { data: unknown; dims: readonly number[] }>>;
}

const N_FFT = 7680;
const SALTO = 1024;
const DIM_F = 3072;
const DIM_T = 256;
const COMPENSAR = 1.021;
export const RATE_SEPARAR = 44100;

export interface OpcionesSeparar {
  alAvanzar?: (fraccion: number) => void;
  cancelado?: () => boolean;
}

type Par = [Float32Array, Float32Array];

/** Separa a 44,1 kHz estéreo. Lanza «Cancelado» si `cancelado()` se vuelve verdadero. */
export async function separarVoz(m: { ort: Ort; sesion: SesionOnnx }, l: Float32Array, r: Float32Array, op: OpcionesSeparar = {}): Promise<{ voz: Par; musica: Par }> {
  const n = l.length;
  const trozo = SALTO * (DIM_T - 1);
  const recorte = N_FFT >> 1;
  const gen = trozo - 2 * recorte;
  const relleno = gen - (n % gen);
  const largo = recorte + n + relleno + recorte;
  const pad = (x: Float32Array) => {
    const y = new Float32Array(largo);
    y.set(x, recorte);
    return y;
  };
  const ml = pad(l), mr = pad(r);
  const vl = new Float32Array(n + relleno), vr = new Float32Array(n + relleno);
  const total = Math.ceil((n + relleno) / gen);
  const entrada = new Float32Array(4 * DIM_F * DIM_T);
  const [nombreEntrada] = m.sesion.inputNames;
  const [nombreSalida] = m.sesion.outputNames;
  for (let k = 0, i = 0; i < n + relleno; i += gen, k++) {
    if (op.cancelado?.()) throw new Error("Cancelado");
    const specs = [stft(ml.subarray(i, i + trozo), N_FFT, SALTO), stft(mr.subarray(i, i + trozo), N_FFT, SALTO)];
    // [re L, im L, re R, im R] × 3072 bandas × 256 cuadros; las 3 primeras bandas en cero
    for (let c = 0; c < 2; c++) {
      const s = specs[c];
      for (let b = 0; b < DIM_F; b++) {
        const dst = b * DIM_T, src = b * s.cuadros;
        const ceros = b < 3;
        for (let t = 0; t < DIM_T; t++) {
          entrada[(2 * c) * DIM_F * DIM_T + dst + t] = ceros ? 0 : s.re[src + t];
          entrada[(2 * c + 1) * DIM_F * DIM_T + dst + t] = ceros ? 0 : s.im[src + t];
        }
      }
    }
    const out = await m.sesion.run({ [nombreEntrada]: new m.ort.Tensor("float32", entrada, [1, 4, DIM_F, DIM_T]) });
    const y = out[nombreSalida].data as Float32Array;
    const bandas = (N_FFT >> 1) + 1;
    for (let c = 0; c < 2; c++) {
      const re = new Float32Array(bandas * DIM_T), im = new Float32Array(bandas * DIM_T);
      re.set(y.subarray((2 * c) * DIM_F * DIM_T, (2 * c + 1) * DIM_F * DIM_T));
      im.set(y.subarray((2 * c + 1) * DIM_F * DIM_T, (2 * c + 2) * DIM_F * DIM_T));
      const onda = istft(re, im, bandas, DIM_T, N_FFT, SALTO, trozo);
      (c === 0 ? vl : vr).set(onda.subarray(recorte, recorte + gen), i);
    }
    op.alAvanzar?.((k + 1) / total);
    // Deja respirar a quien escucha los mensajes (barra de progreso, cancelar)
    await new Promise((ok) => setTimeout(ok, 0));
  }
  const voz: Par = [new Float32Array(n), new Float32Array(n)];
  const musica: Par = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    voz[0][i] = vl[i] * COMPENSAR;
    voz[1][i] = vr[i] * COMPENSAR;
    musica[0][i] = l[i] - voz[0][i];
    musica[1][i] = r[i] - voz[1][i];
  }
  op.alAvanzar?.(1);
  return { voz, musica };
}
