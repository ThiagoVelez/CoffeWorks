// ⚠ Copia de shared/spell/engine.ts: edita el original y ejecuta node scripts/sync-shared.mjs
// Motor del corrector ortográfico de CoffeeWorks (común a todas las apps).
//
// Los diccionarios (español e inglés) son del sistema: el Launcher los deja en
// %LOCALAPPDATA%\CoffeeWorks\Dictionaries y se leen con core_spell_dictionary.
// El diccionario personal se comparte entre todas las apps.

import { invoke } from "@tauri-apps/api/core";

export type SpellLang = "es" | "en" | "es+en";

export const LANG_LABEL: Record<SpellLang, string> = { es: "Español", en: "Inglés", "es+en": "Español e inglés" };

const LANG_KEY = "coffeeworks_spell_lang";
const ENABLED_KEY = "coffeeworks_spell_enabled";
const USER_KEY = "coffeeworks_spell_user_words";
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const loaded = new Map<"es" | "en", Promise<void>>();
const cache = new Map<string, boolean>();
const ignored = new Set<string>();
let userWords: string[] = [];
let userLoaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let status: "idle" | "loading" | "ready" | "error" = "idle";
let lastError = "";

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error || "Error del corrector"));
    };
  }
  return worker;
}

function call<T>(msg: Record<string, unknown>): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ ...msg, id });
  });
}

const notify = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getStatus = () => ({ status, error: lastError });

export function getLang(): SpellLang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "es" || v === "en" || v === "es+en") return v;
  } catch {
    // sin almacenamiento
  }
  return "es+en";
}

export function setLang(lang: SpellLang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // sin almacenamiento
  }
  cache.clear();
  notify();
}

export function isEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    // sin almacenamiento
  }
  notify();
}

const langsOf = (l: SpellLang): ("es" | "en")[] => (l === "es+en" ? ["es", "en"] : [l]);

async function readDictionary(lang: "es" | "en"): Promise<{ aff: string; dic: string }> {
  if (isTauri) return invoke<{ aff: string; dic: string }>("core_spell_dictionary", { lang });
  // Modo web de desarrollo: el servidor del Launcher sirve la carpeta del repositorio
  const base = `${location.protocol}//${location.hostname}:1420/dictionaries`;
  const [aff, dic] = await Promise.all([fetch(`${base}/${lang}.aff`).then((r) => r.text()), fetch(`${base}/${lang}.dic`).then((r) => r.text())]);
  if (!aff.includes("SET") || dic.length < 1000) throw new Error("No se encontraron los diccionarios (arranca el Launcher en modo desarrollo).");
  return { aff, dic };
}

async function loadUserWords() {
  if (!userLoaded)
    userLoaded = (async () => {
      try {
        userWords = isTauri ? await invoke<string[]>("core_spell_user_words") : JSON.parse(localStorage.getItem(USER_KEY) || "[]");
      } catch {
        userWords = [];
      }
      if (userWords.length) await call({ type: "add", words: userWords });
    })();
  return userLoaded;
}

/** Carga (una vez) los diccionarios del idioma elegido. */
export async function ensureLoaded(): Promise<void> {
  const langs = langsOf(getLang());
  const missing = langs.filter((l) => !loaded.has(l));
  if (missing.length) {
    status = "loading";
    notify();
  }
  for (const l of langs) {
    if (!loaded.has(l))
      loaded.set(
        l,
        readDictionary(l).then(({ aff, dic }) => call<void>({ type: "load", lang: l, aff, dic }))
      );
  }
  try {
    await Promise.all([...langs.map((l) => loaded.get(l)!), loadUserWords()]);
    if (status !== "ready") {
      status = "ready";
      lastError = "";
      notify();
    }
  } catch (err) {
    for (const l of langs) loaded.delete(l);
    status = "error";
    lastError = err instanceof Error ? err.message : String(err);
    notify();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Palabras
// ---------------------------------------------------------------------------

export interface Token {
  word: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{M}](?:[\p{L}\p{M}'’-]*[\p{L}\p{M}])?/gu;
const SKIP = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\S*\d\S*/gu;

/** Separa un texto en palabras revisables (sin enlaces, correos, números ni siglas). */
export function tokenize(text: string): Token[] {
  const masked = text.replace(SKIP, (m) => " ".repeat(m.length));
  const out: Token[] = [];
  for (const m of masked.matchAll(WORD)) {
    const word = m[0];
    if (word.length < 2) continue;
    if (word === word.toUpperCase() && word.length <= 6) continue; // siglas (ONU, PDF…)
    if (/[a-zá-úñ][A-ZÁ-ÚÑ]/.test(word)) continue; // identificadores tipoCamello
    out.push({ word, start: m.index!, end: m.index! + word.length });
  }
  return out;
}

/** Devuelve las palabras con faltas de una lista. */
export async function misspelled(words: string[]): Promise<Set<string>> {
  await ensureLoaded();
  const lang = getLang();
  const unknown = [...new Set(words)].filter((w) => !cache.has(`${lang}|${w}`));
  if (unknown.length) {
    const bad = new Set(await call<string[]>({ type: "check", words: unknown, langs: langsOf(lang) }));
    for (const w of unknown) cache.set(`${lang}|${w}`, !bad.has(w));
  }
  return new Set(words.filter((w) => !cache.get(`${lang}|${w}`) && !ignored.has(w.toLowerCase())));
}

export async function suggest(word: string): Promise<string[]> {
  await ensureLoaded();
  const list = await call<string[]>({ type: "suggest", word, langs: langsOf(getLang()) });
  // Respeta la mayúscula inicial de la palabra original
  return word[0] === word[0].toUpperCase() ? list.map((s) => s[0].toUpperCase() + s.slice(1)) : list;
}

export function ignoreWord(word: string) {
  ignored.add(word.toLowerCase());
  notify();
}

export async function addWord(word: string) {
  try {
    userWords = isTauri ? await invoke<string[]>("core_spell_add_word", { word }) : [...new Set([...userWords, word])];
    if (!isTauri) localStorage.setItem(USER_KEY, JSON.stringify(userWords));
  } catch {
    userWords = [...new Set([...userWords, word])];
  }
  await call({ type: "add", words: [word] });
  for (const k of [...cache.keys()]) if (k.endsWith(`|${word}`)) cache.set(k, true);
  notify();
}

export async function getUserWords(): Promise<string[]> {
  await loadUserWords();
  return [...userWords];
}

export async function removeUserWord(word: string) {
  try {
    userWords = isTauri ? await invoke<string[]>("core_spell_remove_word", { word }) : userWords.filter((w) => w !== word);
    if (!isTauri) localStorage.setItem(USER_KEY, JSON.stringify(userWords));
  } catch {
    userWords = userWords.filter((w) => w !== word);
  }
  // nspell no permite quitar palabras: se recarga el proceso
  worker?.terminate();
  worker = null;
  loaded.clear();
  userLoaded = null;
  cache.clear();
  status = "idle";
  notify();
}
