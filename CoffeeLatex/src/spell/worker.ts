// ⚠ Copia de shared/spell/worker.ts: edita el original y ejecuta node scripts/sync-shared.mjs
// Proceso en segundo plano del corrector: carga los diccionarios Hunspell
// (nspell) y responde consultas sin bloquear la interfaz.

import nspell from "nspell";

type Lang = "es" | "en";
type Message =
  | { type: "load"; id: number; lang: Lang; aff: string; dic: string }
  | { type: "check"; id: number; words: string[]; langs: Lang[] }
  | { type: "suggest"; id: number; word: string; langs: Lang[] }
  | { type: "add"; id: number; words: string[] };

const spells: Partial<Record<Lang, ReturnType<typeof nspell>>> = {};
const extra = new Set<string>();

/** Distancia de edición con transposiciones (Damerau-Levenshtein). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Confusiones frecuentes al escribir en español (y tildes olvidadas)
const SWAPS: [string, string][] = [
  ["s", "c"], ["c", "s"], ["s", "z"], ["z", "s"], ["c", "z"], ["z", "c"], ["b", "v"], ["v", "b"],
  ["y", "ll"], ["ll", "y"], ["g", "j"], ["j", "g"], ["k", "c"], ["c", "qu"], ["qu", "c"], ["x", "s"],
];
const ACCENTS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", n: "ñ" };

function variants(word: string): string[] {
  const out = new Set<string>();
  const one = (w: string) => {
    const res: string[] = [];
    for (const [a, b] of SWAPS) for (let i = w.indexOf(a); i >= 0; i = w.indexOf(a, i + 1)) res.push(w.slice(0, i) + b + w.slice(i + a.length));
    for (let i = 0; i < w.length; i++) if (ACCENTS[w[i]]) res.push(w.slice(0, i) + ACCENTS[w[i]] + w.slice(i + 1));
    for (let i = 0; i <= w.length; i++) res.push(w.slice(0, i) + "h" + w.slice(i));
    const h = w.indexOf("h");
    if (h >= 0) res.push(w.slice(0, h) + w.slice(h + 1));
    return res;
  };
  for (const a of one(word)) {
    out.add(a);
    for (const b of one(a)) out.add(b);
  }
  out.delete(word);
  return [...out];
}

/** Ordena las sugerencias por parecido: primero tildes y letras olvidadas. */
function rank(word: string, list: string[]): string[] {
  const w = word.toLowerCase();
  const score = (s: string) => {
    const t = s.toLowerCase();
    let v = distance(w, t) * 10;
    if (strip(t) === strip(w)) v -= 9; // solo falta o sobra una tilde
    // La palabra escrita está contenida en la sugerencia (letra olvidada)
    let k = 0;
    for (const ch of t) if (ch === w[k]) k++;
    if (k === w.length) v -= 3;
    if (t[0] === w[0]) v -= 1;
    return v;
  };
  return list.map((s, i) => ({ s, v: score(s), i })).sort((a, b) => a.v - b.v || a.i - b.i).map((x) => x.s);
}

const correct = (word: string, langs: Lang[]) => {
  if (extra.has(word) || extra.has(word.toLowerCase())) return true;
  for (const l of langs) {
    const s = spells[l];
    if (!s) return true; // diccionario aún sin cargar: no se marca nada
    if (s.correct(word)) return true;
  }
  return false;
};

self.onmessage = (event: MessageEvent<Message>) => {
  const m = event.data;
  try {
    if (m.type === "load") {
      if (!spells[m.lang]) {
        spells[m.lang] = nspell(m.aff, m.dic);
        for (const w of extra) spells[m.lang]!.add(w);
      }
      self.postMessage({ id: m.id, ok: true });
    } else if (m.type === "check") {
      self.postMessage({ id: m.id, ok: true, result: m.words.filter((w) => !correct(w, m.langs)) });
    } else if (m.type === "suggest") {
      const seen = new Set<string>();
      const out: string[] = [];
      m.langs.forEach((l, i) => {
        // El segundo idioma solo completa cuando el primero da pocas sugerencias
        if (i > 0 && out.length >= 2) return;
        let found = spells[l]?.suggest(m.word) || [];
        // Si hay pocas, se prueban las confusiones típicas (dos cambios: «programasion» → «programación»)
        if (found.length < 3 && m.word.length <= 20 && spells[l]) {
          const lower = m.word.toLowerCase();
          const extra = variants(lower).filter((v) => spells[l]!.correct(v));
          found = [...found, ...extra.filter((v) => !found.some((f) => f.toLowerCase() === v))];
        }
        const ranked = rank(m.word, found);
        for (const s of ranked) if (!seen.has(s)) seen.add(s) && out.push(s);
      });
      self.postMessage({ id: m.id, ok: true, result: out.slice(0, 7) });
    } else if (m.type === "add") {
      for (const w of m.words) {
        extra.add(w);
        for (const s of Object.values(spells)) s?.add(w);
      }
      self.postMessage({ id: m.id, ok: true });
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String(err) });
  }
};
