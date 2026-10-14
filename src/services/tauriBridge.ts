// Capa de comunicación con Tauri (IPC) y fallback para navegador web estándar
import type { SuiteApp, RecentDocument } from "../types";

// Verificación de si la aplicación se ejecuta dentro del runtime de Tauri
const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

// Aplicaciones activas centrales de la suite CoffeWorks
const MOCK_APPS: SuiteApp[] = [
  {
    id: "coffedoc",
    name: "CoffeDoc",
    subtitle: "Procesador de textos colaborativo & Markdown enriquecido",
    description: "Documentos ágiles, cinta Ribbon completa de Microsoft Word y exportación a formatos universales (.cfd, .docx, .md, .pdf).",
    version: "v1.4",
    installed: true,
    size_mb: 184,
    status: "Instalada (184 MB)",
    color_badge: "primary",
    icon_name: "file-text",
    icon_url: "/icons/CoffeText.ico",
    category: "Office",
  },
  {
    id: "coffecalc",
    name: "CoffeCalc",
    subtitle: "Hoja de cálculo profesional y modelado matricial avanzado",
    description: "Cuadrícula matricial A-Z, cinta Ribbon verde Excel, barra de fórmulas fx, funciones estadísticas y compatibilidad total XLSX/CSV.",
    version: "v1.0",
    installed: true,
    size_mb: 192,
    status: "Instalada (192 MB)",
    color_badge: "secondary",
    icon_name: "table",
    icon_url: "/icons/CoffeSheet.ico",
    category: "Office",
  },
  {
    id: "coffeview",
    name: "CoffeView",
    subtitle: "Diseño de presentaciones visuales y diapositivas de alto impacto",
    description: "Diseñador de diapositivas interactivas, transiciones cinematográficas, lienzos gráficos, modo orador y exportación universal.",
    version: "v1.0 (Próximamente)",
    installed: true,
    size_mb: 178,
    status: "Instalada (178 MB)",
    color_badge: "tertiary",
    icon_name: "presentation",
    icon_url: "/icons/CoffeSlides.ico",
    category: "Office",
  },
];

// Carga de documentos desde almacenamiento local para persistencia real
// Carga de documentos desde endpoint compartido o almacenamiento local
const loadStoredDocs = (): RecentDocument[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("coffeeworks_recent_docs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredDocs = (docs: RecentDocument[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("coffeeworks_recent_docs", JSON.stringify(docs));
  } catch (err) {
    console.error("Error al persistir documentos:", err);
  }
};

let mockDocs: RecentDocument[] = loadStoredDocs();
let mockFocusMode = true;

// Sincronización con el endpoint compartido de la suite (/api/vault)
const syncWithVaultEndpoint = async (): Promise<RecentDocument[]> => {
  if (typeof window === "undefined") return mockDocs;
  try {
    const res = await fetch("/api/vault");
    if (res.ok) {
      const data = (await res.json()) as RecentDocument[];
      if (Array.isArray(data) && data.length > 0) {
        mockDocs = data;
        saveStoredDocs(data);
        return data;
      }
    }
  } catch {
    // Si la llamada HTTP falla, usa almacenamiento local
  }
  return mockDocs;
};

// Servicio unificado de IPC
export const tauriBridge = {
  async getSuiteApps(): Promise<SuiteApp[]> {
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<SuiteApp[]>("get_suite_apps");
      } catch (err) {
        console.warn("Fallo al invocar get_suite_apps en Tauri:", err);
      }
    }
    return Promise.resolve([...MOCK_APPS]);
  },

  async launchApp(appId: string): Promise<string> {
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<string>("launch_app", { appId });
      } catch (err) {
        console.warn("Fallo al invocar launch_app en Tauri:", err);
      }
    }
    if (typeof window !== "undefined") {
      if (appId === "coffedoc") {
        window.open("http://localhost:1421", "_blank");
        return "Abriendo CoffeDoc en http://localhost:1421";
      }
      if (appId === "coffecalc" || appId === "coffesheet") {
        window.open("http://localhost:1422", "_blank");
        return "Abriendo CoffeCalc en http://localhost:1422";
      }
      if (appId === "coffeview" || appId === "coffeslides") {
        window.open("http://localhost:1423", "_blank");
        return "Abriendo CoffeView en http://localhost:1423";
      }
    }
    return Promise.resolve(`Lanzando aplicación: ${appId}`);
  },

  async getRecentDocuments(): Promise<RecentDocument[]> {
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<RecentDocument[]>("get_recent_documents");
      } catch (err) {
        console.warn("Fallo al invocar get_recent_documents en Tauri:", err);
      }
    }

    const liveDocs = await syncWithVaultEndpoint();
    return liveDocs;
  },

  async createDocument(docType: string, title: string): Promise<RecentDocument> {
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<RecentDocument>("create_document", { docType, title });
      } catch (err) {
        console.warn("Fallo al invocar create_document en Tauri:", err);
      }
    }

    const extensions: Record<string, string> = {
      coffedoc: "cfd",
      coffecalc: "cfs",
      coffesheet: "cfs",
      coffeslides: "csl",
      coffenotes: "cfn",
    };

    const ext = extensions[docType] || "cfd";
    const name = title.trim() ? `${title.trim()}.${ext}` : `Nuevo Documento.${ext}`;

    const categories: Record<string, string> = {
      coffedoc: "Producto",
      coffecalc: "Finanzas",
      coffesheet: "Finanzas",
      coffeslides: "Presentación",
      coffenotes: "Creativo",
    };

    const created: RecentDocument = {
      id: `doc_${Date.now()}`,
      name,
      app_id: docType,
      category: categories[docType] || "General",
      last_modified: "Hace unos instantes",
      is_pinned: false,
      path: `./vault/${name}`,
    };

    mockDocs = [created, ...mockDocs];
    saveStoredDocs(mockDocs);

    // Sincronizar vía endpoint
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(created),
      });
    } catch {
      // Ignorar si está fuera de línea
    }

    return Promise.resolve(created);
  },

  async saveDocuments(docs: RecentDocument[]): Promise<void> {
    mockDocs = docs;
    saveStoredDocs(docs);
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docs),
      });
    } catch {
      // Ignorar si falla
    }
  },

  async deleteDocument(id: string): Promise<RecentDocument[]> {
    mockDocs = mockDocs.filter((doc) => doc.id !== id);
    saveStoredDocs(mockDocs);
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockDocs),
      });
    } catch {
      // Ignorar si falla la llamada
    }
    return Promise.resolve(mockDocs);
  },

  async clearDocuments(): Promise<void> {
    mockDocs = [];
    saveStoredDocs([]);
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([]),
      });
    } catch {
      // Ignorar
    }
  },

  async toggleFocusMode(): Promise<boolean> {
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        return await invoke<boolean>("toggle_focus_mode");
      } catch (err) {
        console.warn("Fallo al alternar modo enfoque en Tauri:", err);
      }
    }
    mockFocusMode = !mockFocusMode;
    return Promise.resolve(mockFocusMode);
  },

  async minimizeWindow(): Promise<void> {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn("Error al minimizar ventana:", err);
      }
    }
  },

  async maximizeWindow(): Promise<void> {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.warn("Error al maximizar ventana:", err);
      }
    }
  },

  async closeWindow(): Promise<void> {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch (err) {
        console.warn("Error al cerrar ventana:", err);
      }
    }
  },
};
