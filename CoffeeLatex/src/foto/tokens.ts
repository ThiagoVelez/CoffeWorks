// De las piezas que da el decodificador a LaTeX, con las dudas ubicadas en el texto final.

export interface Pieza {
  /** Texto de la pieza tal como está en el vocabulario («Ġ» marca un espacio delante). */
  texto: string;
  /** Probabilidad que le dio el modelo (0…1). */
  prob: number;
  /** Otras piezas probables en ese punto, de más a menos probable. */
  alternativas: { texto: string; prob: number }[];
}

export interface Duda {
  ini: number;
  fin: number;
  prob: number;
  /** Lo que el modelo también consideró (sin espacios alrededor). */
  alternativas: string[];
}

const esLetra = (c: string | undefined) => !!c && /[a-zA-Z]/.test(c);
const limpiar = (t: string) => t.replace(/Ġ/g, " ");

/**
 * Quita los espacios sobrantes como pix2tex: se conserva un espacio solo entre dos letras o tras
 * «\» (un «\ » explícito), y dentro de \mathrm{…}, \text{…}, \mathbf{…} u \operatorname{…} se
 * quitan todos. `mapa[i]` es la posición final del carácter i (-1 si se quitó).
 */
export function posprocesar(s: string): { texto: string; mapa: number[] } {
  const quitar = new Uint8Array(s.length);
  // Comandos de texto: todos sus espacios fuera.
  for (const m of s.matchAll(/\\(operatorname|mathrm|text|mathbf)\s?\*? \{.*?\}/g)) {
    for (let k = m.index!; k < m.index! + m[0].length; k++) if (/\s/.test(s[k])) quitar[k] = 1;
  }
  for (let i = 0; i < s.length; ) {
    if (!/\s/.test(s[i]) || quitar[i]) { i++; continue; }
    let j = i;
    while (j < s.length && /\s/.test(s[j]) && !quitar[j]) j++;
    const a = s[i - 1], b = s[j];
    const conservar = i === 0 || j === s.length ? false : (esLetra(a) && esLetra(b)) || a === "\\";
    if (!conservar) for (let k = i; k < j; k++) quitar[k] = 1;
    i = j;
  }
  const mapa: number[] = [];
  let texto = "";
  for (let i = 0; i < s.length; i++) {
    if (quitar[i]) mapa.push(-1);
    else { mapa.push(texto.length); texto += s[i]; }
  }
  // Recortar espacios de los extremos que hayan quedado
  const inicio = texto.length - texto.trimStart().length;
  if (inicio || texto !== texto.trimEnd()) {
    const t2 = texto.trim();
    for (let i = 0; i < mapa.length; i++) if (mapa[i] >= 0) mapa[i] = mapa[i] - inicio < 0 || mapa[i] - inicio >= t2.length ? -1 : mapa[i] - inicio;
    texto = t2;
  }
  return { texto, mapa };
}

/** Une las piezas y marca como duda las que tienen probabilidad por debajo de `umbral`. */
export function armarLatex(piezas: Pieza[], umbral: number): { latex: string; dudas: Duda[] } {
  let bruto = "";
  const rangos: [number, number][] = [];
  for (const p of piezas) {
    const t = limpiar(p.texto);
    rangos.push([bruto.length, bruto.length + t.length]);
    bruto += t;
  }
  const { texto, mapa } = posprocesar(bruto);
  const dudas: Duda[] = [];
  piezas.forEach((p, i) => {
    if (p.prob >= umbral) return;
    const [a, b] = rangos[i];
    const pos = [];
    for (let k = a; k < b; k++) if (mapa[k] >= 0 && !/\s/.test(bruto[k])) pos.push(mapa[k]);
    if (!pos.length) return;
    let ini = pos[0];
    let alternativas = p.alternativas.map((x) => limpiar(x.texto).trim()).filter((x, j, l) => x && l.indexOf(x) === j);
    // «alpha» tras «\»: la duda es el comando entero y las alternativas también son comandos.
    const esNombre = /^[A-Za-z]/.test(texto[ini]) && texto[ini - 1] === "\\";
    if (esNombre) {
      ini--;
      alternativas = alternativas.map((x) => (/^[A-Za-z]+$/.test(x) ? `\\${x}` : x));
    }
    dudas.push({ ini, fin: pos[pos.length - 1] + 1, prob: p.prob, alternativas });
  });
  return { latex: texto, dudas };
}
