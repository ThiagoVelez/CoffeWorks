// Frases de la voz separada: se corta donde la voz calla. Cada frase es una línea de la letra
// (y su tiempo, el del .lrc). Las frases largas se parten para que Whisper (máx. 30 s) las lea.

export interface Frase {
  ini: number;
  fin: number;
}

export interface OpcionesFrases {
  /** Umbral relativo al cuadro más fuerte (dB). */
  umbralDb?: number;
  /** Silencio mínimo que separa dos frases (s). */
  silencioMin?: number;
  maxDur?: number;
  minDur?: number;
  margen?: number;
}

export function frases(voz: Float32Array, rate: number, op: OpcionesFrases = {}): Frase[] {
  const umbralDb = op.umbralDb ?? -40, silencioMin = op.silencioMin ?? 0.4, maxDur = op.maxDur ?? 28, minDur = op.minDur ?? 0.3, margen = op.margen ?? 0.15;
  const paso = Math.max(1, Math.round(rate * 0.02));
  const nc = Math.ceil(voz.length / paso);
  const db = new Float32Array(nc);
  let pico = -Infinity;
  for (let c = 0; c < nc; c++) {
    let s = 0;
    const a = c * paso, b = Math.min(voz.length, a + paso);
    for (let i = a; i < b; i++) s += voz[i] * voz[i];
    db[c] = 10 * Math.log10(s / Math.max(1, b - a) + 1e-12);
    if (db[c] > pico) pico = db[c];
  }
  if (!(pico > -60)) return []; // nada que se oiga
  const limite = Math.max(pico + umbralDb, -60);
  // Tramos con voz, uniendo pausas cortas
  const tramos: Frase[] = [];
  for (let c = 0; c < nc; ) {
    if (db[c] < limite) { c++; continue; }
    let f = c;
    while (f < nc && db[f] >= limite) f++;
    const ini = (c * paso) / rate, fin = Math.min(voz.length, f * paso) / rate;
    const prev = tramos.at(-1);
    if (prev && ini - prev.fin < silencioMin) prev.fin = fin;
    else tramos.push({ ini, fin });
    c = f;
  }
  const dur = voz.length / rate;
  const out: Frase[] = [];
  for (const [k, t] of tramos.entries()) {
    if (t.fin - t.ini < minDur) continue;
    const antes = k > 0 ? (tramos[k - 1].fin + t.ini) / 2 : 0;
    const despues = k < tramos.length - 1 ? (t.fin + tramos[k + 1].ini) / 2 : dur;
    const ini = Math.max(antes, t.ini - margen, 0), fin = Math.min(despues, t.fin + margen, dur);
    const partes = Math.ceil((fin - ini) / maxDur);
    const largo = (fin - ini) / partes;
    for (let p = 0; p < partes; p++) out.push({ ini: ini + p * largo, fin: p === partes - 1 ? fin : ini + (p + 1) * largo });
  }
  return out;
}
