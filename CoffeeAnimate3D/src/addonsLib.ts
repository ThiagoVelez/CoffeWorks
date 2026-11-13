// Complementos de CoffeeAnimate3D desde la app: «Render» (de servicio) y «Pack de piezas»
// (de datos, leído de la carpeta del complemento). En desarrollo, en el navegador, se
// usan las piezas del código para poder probarlo sin la app de escritorio.

import { invoke } from "@tauri-apps/api/core";
import { isTauri, readFileText } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import { normalizeIds, parseModel } from "./model";
import type { Model3D } from "./types";

export interface PieceEntry {
  name: string;
  category: string;
  file: string;
}

const devBrowser = !isTauri && import.meta.env.DEV;

export async function canRender(): Promise<boolean> {
  return devBrowser || ensureAddon("ca3d-render", "CoffeeAnimate3D");
}

async function piecesDir(): Promise<string | null> {
  if (!(await ensureAddon("ca3d-piezas", "CoffeeAnimate3D"))) return null;
  return invoke<string | null>("core_addon_dir", { id: "ca3d-piezas" });
}

/** Índice de piezas (o null si el complemento no está y el usuario no lo instala). */
export async function loadPieceIndex(): Promise<PieceEntry[] | null> {
  if (devBrowser) {
    const { PIECES } = await import("./pieces");
    return PIECES.map((p) => ({ name: p.name, category: p.category, file: p.file }));
  }
  const dir = await piecesDir();
  if (!dir) return null;
  return JSON.parse(await readFileText(`${dir}/piezas.json`)) as PieceEntry[];
}

export async function loadPiece(entry: PieceEntry): Promise<Model3D> {
  if (devBrowser) {
    const { PIECES } = await import("./pieces");
    const p = PIECES.find((x) => x.file === entry.file);
    if (!p) throw new Error(`No existe la pieza ${entry.name}`);
    return normalizeIds(p.make());
  }
  const dir = await piecesDir();
  if (!dir) throw new Error("Instala el complemento «Pack de piezas» desde el Launcher › Complementos");
  return parseModel(await readFileText(`${dir}/${entry.file}`));
}

/** Para Claude (MCP): ¿está el complemento? Sin preguntar ni abrir diálogos. */
export async function addonReady(id: "ca3d-render" | "ca3d-piezas"): Promise<boolean> {
  if (devBrowser) return true;
  if (!isTauri) return false;
  try {
    return (await invoke<{ installed: boolean }>("core_addon_status", { id })).installed;
  } catch {
    return false;
  }
}
