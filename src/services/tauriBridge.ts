// Puente del Launcher con el backend nativo (Tauri) y alternativa para el
// navegador (npm run dev), donde las aplicaciones se abren en sus puertos de
// desarrollo y el estado se guarda en localStorage y en /api/vault.

import { invoke } from "@tauri-apps/api/core";
import type { RecentDocument, SuiteApp, SuiteInfo } from "../types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const RECENT_KEY = "coffeeworks_recent_docs";
const INSTALLED_KEY = "coffeeworks_installed_apps";
const FOCUS_KEY = "coffeeworks_focus_mode";

/** Puertos de los servidores de desarrollo de cada aplicación. */
const DEV_PORTS: Record<string, number> = { coffedoc: 1421, coffecalc: 1422, coffeview: 1423, coffepdf: 1424 };

const ALIASES: Record<string, string> = { coffesheet: "coffecalc", coffeslides: "coffeview" };

export const canonicalAppId = (id: string) => ALIASES[id] || id;

/** Aplicación que abre un documento, según su `app_id` o su extensión. */
export function appForDocument(doc: Pick<RecentDocument, "app_id" | "name">): string {
  const id = canonicalAppId(doc.app_id || "");
  if (DEV_PORTS[id]) return id;
  const extension = doc.name.split(".").pop()?.toLowerCase() || "";
  if (["cfs", "xlsx", "xls", "csv"].includes(extension)) return "coffecalc";
  if (["csl", "pptx"].includes(extension)) return "coffeview";
  if (extension === "pdf") return "coffepdf";
  return "coffedoc";
}

// Catálogo usado en el navegador; en escritorio lo proporciona el backend
const WEB_CATALOG: SuiteApp[] = [
  {
    id: "coffedoc",
    name: "CoffeDoc",
    subtitle: "Procesador de textos con formato enriquecido",
    description:
      "Documentos con estilos, tablas, imágenes y esquema automático. Abre y guarda Word (.docx), Markdown, HTML y PDF.",
    version: "v1.4",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "primary",
    icon_name: "file-text",
    icon_url: "/icons/CoffeText.ico",
    category: "Office",
  },
  {
    id: "coffecalc",
    name: "CoffeCalc",
    subtitle: "Hoja de cálculo con fórmulas y gráficos",
    description:
      "Libros con varias hojas, más de 80 funciones, formato de celdas, filtros y gráficos. Compatible con Excel (.xlsx) y CSV.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "secondary",
    icon_name: "table",
    icon_url: "/icons/CoffeSheet.ico",
    category: "Office",
  },
  {
    id: "coffeview",
    name: "CoffeView",
    subtitle: "Presentaciones y diapositivas",
    description:
      "Diseñador de diapositivas con temas, formas, imágenes, transiciones, notas del orador y exportación a PowerPoint (.pptx) y PDF.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "tertiary",
    icon_name: "presentation",
    icon_url: "/icons/CoffeSlides.ico",
    category: "Office",
  },
  {
    id: "coffepdf",
    name: "CoffePDF",
    subtitle: "Editor de documentos PDF",
    description:
      "Abre, anota y edita PDF: texto, resaltado, formas, firmas e imágenes, formularios, y organiza, gira, une o extrae páginas.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "error",
    icon_name: "file-pen",
    icon_url: "/icons/CoffePDF.ico",
    category: "Office",
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento lleno o no disponible: el estado no se conserva.
  }
}

function webApps(): SuiteApp[] {
  const installed = readJson<Record<string, boolean>>(INSTALLED_KEY, {});
  return WEB_CATALOG.map((app) => {
    const isInstalled = installed[app.id] !== false;
    return {
      ...app,
      installed: isInstalled,
      status: isInstalled ? "Disponible en modo web" : "Disponible para instalar",
    };
  });
}

async function webRecentDocuments(): Promise<RecentDocument[]> {
  try {
    const response = await fetch("/api/vault");
    if (response.ok) {
      const docs = (await response.json()) as RecentDocument[];
      if (Array.isArray(docs)) {
        writeJson(RECENT_KEY, docs);
        return docs;
      }
    }
  } catch {
    // Sin servidor de desarrollo: se usa la copia local.
  }
  return readJson<RecentDocument[]>(RECENT_KEY, []);
}

async function webSaveDocuments(docs: RecentDocument[]): Promise<void> {
  writeJson(RECENT_KEY, docs);
  try {
    await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(docs),
    });
  } catch {
    // Se conserva al menos la copia local.
  }
}

function openDevApp(appId: string, query = ""): string {
  const id = canonicalAppId(appId);
  const port = DEV_PORTS[id];
  if (!port) throw new Error(`Aplicación desconocida: ${appId}`);
  window.open(`http://localhost:${port}/${query}`, "_blank");
  return `Abierta en http://localhost:${port}`;
}

export const tauriBridge = {
  async getSuiteApps(): Promise<SuiteApp[]> {
    return isTauri ? invoke<SuiteApp[]>("get_suite_apps") : webApps();
  },

  /** Instala una aplicación. Lanza un error con el motivo si no es posible. */
  async installApp(appId: string): Promise<SuiteApp> {
    if (isTauri) return invoke<SuiteApp>("install_app", { appId });
    writeJson(INSTALLED_KEY, { ...readJson<Record<string, boolean>>(INSTALLED_KEY, {}), [appId]: true });
    return webApps().find((app) => app.id === appId) as SuiteApp;
  },

  async uninstallApp(appId: string): Promise<SuiteApp> {
    if (isTauri) return invoke<SuiteApp>("uninstall_app", { appId });
    writeJson(INSTALLED_KEY, { ...readJson<Record<string, boolean>>(INSTALLED_KEY, {}), [appId]: false });
    return webApps().find((app) => app.id === appId) as SuiteApp;
  },

  /** Abre una aplicación, opcionalmente creando un documento con el título dado. */
  async launchApp(appId: string, newTitle?: string): Promise<string> {
    const id = canonicalAppId(appId);
    if (isTauri) {
      return invoke<string>("launch_app", { appId: id, file: null, newTitle: newTitle ?? null });
    }
    return openDevApp(id, newTitle !== undefined ? `?new=${encodeURIComponent(newTitle)}` : "");
  },

  async getRecentDocuments(): Promise<RecentDocument[]> {
    return isTauri ? invoke<RecentDocument[]>("get_recent_documents") : webRecentDocuments();
  },

  async saveDocuments(docs: RecentDocument[]): Promise<void> {
    if (isTauri) await invoke("save_recent_documents", { docs });
    else await webSaveDocuments(docs);
  },

  /** Quita un documento de la bóveda (y borra su archivo si vive en ella). */
  async deleteDocument(id: string): Promise<RecentDocument[]> {
    if (isTauri) return invoke<RecentDocument[]>("delete_document", { id });
    const docs = (await webRecentDocuments()).filter((doc) => doc.id !== id);
    await webSaveDocuments(docs);
    return docs;
  },

  async openDocument(doc: RecentDocument): Promise<string> {
    if (isTauri) return invoke<string>("open_document", { id: doc.id });
    return openDevApp(appForDocument(doc), `?doc=${encodeURIComponent(doc.id)}`);
  },

  /** Crea un documento a partir del contenido de una plantilla y lo abre. */
  async createFromTemplate(appId: string, docId: string, fileName: string, contents: string): Promise<string> {
    if (isTauri) {
      return invoke<string>("create_document_file", { appId, docId, fileName, contents });
    }
    return openDevApp(appId, `#cfw=${encodeURIComponent(contents)}`);
  },

  async openVaultFolder(): Promise<string> {
    if (isTauri) return invoke<string>("open_vault_folder");
    throw new Error("La carpeta de documentos solo existe en la aplicación de escritorio.");
  },

  async getSuiteInfo(): Promise<SuiteInfo | null> {
    return isTauri ? invoke<SuiteInfo>("get_suite_info") : null;
  },

  /** Modo enfoque: minimizar el Launcher al abrir una aplicación. */
  getFocusMode(): boolean {
    return readJson<boolean>(FOCUS_KEY, false);
  },

  setFocusMode(enabled: boolean): void {
    writeJson(FOCUS_KEY, enabled);
  },

  async openExternal(target: string): Promise<void> {
    if (isTauri) await invoke("open_external", { target });
    else window.open(target, "_blank", "noopener");
  },

  async minimizeWindow(): Promise<void> {
    if (isTauri) await invoke("minimize_window");
  },

  async maximizeWindow(): Promise<void> {
    if (isTauri) {
      await invoke("maximize_window");
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
  },

  async closeWindow(): Promise<void> {
    if (isTauri) await invoke("close_window");
    else window.close();
  },
};

/** Texto relativo ("hace 5 min") para la fecha de un documento. */
export function relativeTime(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "hace un momento";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return new Date(timestamp).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}
