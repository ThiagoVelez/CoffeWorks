// Complementos de la suite desde las apps de Ilustración: estado, instalar y
// ejecutar (los programas se ejecutan en el lado nativo de coffee-core).

import { invoke } from "@tauri-apps/api/core";
import { bytesToBase64, isTauri } from "./desktop";
import { askConfirm, showMessage, toast } from "./Dialogs";

export interface AddonInfo {
  id: string;
  name: string;
  summary: string;
  description: string;
  installed: boolean;
  can_install: boolean;
  download_size: string;
  manual_hint: string;
}

export async function addonStatus(id: string): Promise<AddonInfo | null> {
  if (!isTauri) return null;
  try {
    return await invoke<AddonInfo>("core_addon_status", { id });
  } catch {
    return null;
  }
}

/**
 * Comprueba que el complemento esté instalado y, si no, ofrece instalarlo.
 * Devuelve `true` si se puede usar.
 */
export async function ensureAddon(id: string, appName: string): Promise<boolean> {
  if (!isTauri) {
    await showMessage("Solo en la aplicación de escritorio", `Este complemento se instala en la versión de escritorio de ${appName} (Launcher › Complementos).`);
    return false;
  }
  const info = await addonStatus(id);
  if (!info) return false;
  if (info.installed) return true;
  if (!info.can_install) {
    await showMessage(info.name, info.manual_hint);
    return false;
  }
  const ok = await askConfirm({
    title: `Complemento «${info.name}»`,
    message: `${info.description}\n\n${info.download_size === "Sin descarga" ? "No hay que descargar nada." : `Se descargará una sola vez (${info.download_size}).`} También aparece en el Launcher, en Complementos.`,
    confirmLabel: info.download_size === "Sin descarga" ? "Activar" : `Instalar (${info.download_size})`,
  });
  if (!ok) return false;
  toast(`Instalando «${info.name}»…`, "info");
  try {
    const next = await invoke<AddonInfo>("core_addon_install", { id });
    if (next.installed) toast(`Complemento «${info.name}» listo`);
    return next.installed;
  } catch (err) {
    await showMessage("No se pudo instalar el complemento", err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Ejecuta un complemento con un archivo de entrada; con `{output}` devuelve el archivo resultante. */
export async function runAddonFile(id: string, args: string[], data: Uint8Array, extension: string): Promise<string> {
  return invoke<string>("core_addon_run_file", { id, args, data: bytesToBase64(data), extension });
}
