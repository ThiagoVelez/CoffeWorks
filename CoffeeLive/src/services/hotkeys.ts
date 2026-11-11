// Atajos de teclado de CoffeeLive. En el escritorio son globales (funcionan
// con la ventana minimizada o mientras juegas); en el navegador, solo con la
// pestaña activa.

import { isTauri } from "./desktop";
import type { HotkeyAction } from "../types";

const KEY_NAMES: Record<string, string> = {
  ArrowRight: "Right",
  ArrowLeft: "Left",
  ArrowUp: "Up",
  ArrowDown: "Down",
  " ": "Space",
};

/** Convierte una pulsación en un atajo legible ("Ctrl+Shift+R"). */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const key = KEY_NAMES[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  const isFunction = /^F\d{1,2}$/.test(key);
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift"].filter(Boolean) as string[];
  // Sin modificadores solo se aceptan las teclas de función (F1-F24)
  if (mods.length === 0 && !isFunction) return null;
  return [...mods, key].join("+");
}

export type HotkeyHandler = (action: HotkeyAction, pressed: boolean) => void;

/** Registra los atajos. Devuelve una función que los quita. */
export async function registerHotkeys(map: Record<HotkeyAction, string>, handler: HotkeyHandler): Promise<() => void> {
  const entries = (Object.entries(map) as [HotkeyAction, string][]).filter(([, combo]) => combo);
  if (isTauri) {
    const plugin = await import("@tauri-apps/plugin-global-shortcut");
    await plugin.unregisterAll().catch(() => undefined);
    const failed: string[] = [];
    for (const [action, combo] of entries) {
      try {
        await plugin.register(combo, (event) => handler(action, event.state === "Pressed"));
      } catch {
        failed.push(combo);
      }
    }
    if (failed.length) console.warn("Atajos no disponibles (los usa otro programa):", failed.join(", "));
    return () => void plugin.unregisterAll().catch(() => undefined);
  }
  const lookup = new Map(entries.map(([action, combo]) => [combo, action]));
  const down = (e: KeyboardEvent) => {
    const combo = comboFromEvent(e);
    const action = combo ? lookup.get(combo) : undefined;
    if (!action || e.repeat) return;
    e.preventDefault();
    handler(action, true);
  };
  const up = (e: KeyboardEvent) => {
    const combo = comboFromEvent(e);
    const action = combo ? lookup.get(combo) : undefined;
    if (action) handler(action, false);
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
  };
}
