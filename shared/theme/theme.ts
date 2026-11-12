// Tema claro u oscuro, común a toda la suite (salvo las apps de Ilustración,
// que siempre son oscuras). Se guarda en coffee-core (tema.txt), así que al
// cambiarlo en una app las demás lo adoptan al volver a ellas.

import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";

export type Theme = "light" | "dark";

const KEY = "coffeeworks_theme";
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const listeners = new Set<() => void>();

const stored = (): Theme => {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

let current: Theme = typeof window !== "undefined" ? stored() : "light";

function apply(theme: Theme) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((f) => f());
}

async function refresh() {
  if (!isTauri) return;
  try {
    const t = await invoke<string>("core_get_theme");
    if (t !== current) apply(t === "dark" ? "dark" : "light");
  } catch {
    /* versión antigua del núcleo */
  }
}

/** Aplica el tema guardado. Llamar una vez, antes de dibujar la app. */
export function initTheme() {
  apply(stored());
  void refresh();
  window.addEventListener("focus", () => void refresh());
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) apply(e.newValue === "dark" ? "dark" : "light");
  });
}

export const getTheme = () => current;

export async function setTheme(theme: Theme) {
  apply(theme);
  if (isTauri) await invoke("core_set_theme", { theme }).catch(() => undefined);
}

export const toggleTheme = () => setTheme(current === "dark" ? "light" : "dark");

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => current
  );
  return [theme, (t) => void setTheme(t)];
}
