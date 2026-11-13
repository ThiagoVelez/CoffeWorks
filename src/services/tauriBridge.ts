// Puente del Launcher con el backend nativo (Tauri) y alternativa para el
// navegador (npm run dev), donde las aplicaciones se abren en sus puertos de
// desarrollo y el estado se guarda en localStorage y en /api/vault.

import { invoke } from "@tauri-apps/api/core";
import type { AddonInfo, McpState, RecentDocument, SuiteApp, SuiteInfo, UpdateInfo } from "../types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Estado de un juego de CoffeeWorks Games (lo devuelve el Launcher de escritorio). */
export interface GameStatus {
  id: string;
  installed: string | null;
  latest: string | null;
  stage: string | null;
  size: number | null;
  update_available: boolean;
  error: string | null;
}

const RECENT_KEY = "coffeeworks_recent_docs";
const INSTALLED_KEY = "coffeeworks_installed_apps";
const FOCUS_KEY = "coffeeworks_focus_mode";

/** Puertos de los servidores de desarrollo de cada aplicación. */
const DEV_PORTS: Record<string, number> = { coffeedoc: 1421, coffeebooks: 1440, coffeecalc: 1422, coffeeview: 1423, coffeepdf: 1424, coffeepage: 1425, coffeeedit: 1426, coffeelive: 1427, coffeedatabase: 1428, coffeeuiux: 1429, coffeeuml: 1430, coffeephoto: 1431, coffeevector: 1432, coffeepaint: 1433, coffeelens: 1434, coffeemotion: 1435, coffeesound: 1436, coffeeencoder: 1437, coffeeanimate: 1438, coffeepuppet: 1439, coffeeanimate3d: 1441 };

const ALIASES: Record<string, string> = { coffeesheet: "coffeecalc", coffeeslides: "coffeeview", coffeecams: "coffeeedit" };

/** Identificador actual (los documentos antiguos usan "coffedoc", "coffesheet"...). */
export const canonicalAppId = (id: string) => {
  const current = id.toLowerCase().replace(/^coffe(?!e)/, "coffee");
  return ALIASES[current] || current;
};

/** Aplicación que abre un documento, según su `app_id` o su extensión. */
export function appForDocument(doc: Pick<RecentDocument, "app_id" | "name">): string {
  const id = canonicalAppId(doc.app_id || "");
  if (DEV_PORTS[id]) return id;
  const extension = doc.name.split(".").pop()?.toLowerCase() || "";
  if (["cfs", "xlsx", "xls", "csv"].includes(extension)) return "coffeecalc";
  if (["csl", "pptx"].includes(extension)) return "coffeeview";
  if (extension === "pdf") return "coffeepdf";
  if (extension === "cpg") return "coffeepage";
  if (extension === "cbk") return "coffeebooks";
  if (["ccm", "mp4", "webm", "mov", "mkv"].includes(extension)) return "coffeeedit";
  if (extension === "clv") return "coffeelive";
  if (["cdb", "db", "sqlite", "sqlite3"].includes(extension)) return "coffeedatabase";
  if (extension === "cux") return "coffeeuiux";
  if (extension === "cuml") return "coffeeuml";
  if (extension === "cph") return "coffeephoto";
  if (extension === "cvc") return "coffeevector";
  if (extension === "cpt") return "coffeepaint";
  if (extension === "clc") return "coffeelens";
  if (extension === "cmo") return "coffeemotion";
  if (extension === "csn") return "coffeesound";
  if (extension === "cen") return "coffeeencoder";
  if (extension === "can") return "coffeeanimate";
  if (extension === "cpup") return "coffeepuppet";
  if (extension === "ca3d") return "coffeeanimate3d";
  return "coffeedoc";
}

// Complementos en el navegador (solo para mostrar el catálogo; se instalan en escritorio)
const WEB_ADDONS: AddonInfo[] = [
  {
    id: "accdb",
    name: "Compatibilidad con Access",
    summary: "Guarda bases de CoffeeDataBase en formato .accdb y .mdb",
    description:
      "Exporta tablas, datos, claves principales y relaciones a archivos .accdb (Access 2010 o posterior) y .mdb. Es un programa pequeño que solo se ejecuta al exportar: no necesita Java ni deja nada abierto.",
    apps: ["coffeedatabase"],
    version: "1.0.0",
    download_size: "8 MB",
    publisher: "CoffeeWorks",
    license: "Apache 2.0 (Jackcess)",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
  {
    id: "ffmpeg",
    name: "Motor de video FFmpeg",
    summary: "Codificación de video y audio: transmisión, cola de exportación y formatos MP4, MOV, MP3, FLAC...",
    description:
      "Codifica el video para Twitch, YouTube, Facebook o cualquier servidor RTMP/SRT, con aceleración NVIDIA NVENC, Intel Quick Sync o AMD AMF si el equipo la tiene. También es el motor de CoffeeEncoder (convertir a H.264, HEVC, ProRes, GIF...), de la exportación a MP4 de CoffeeEdit, CoffeeMotion y CoffeeAnimate, y de la exportación a MP3, OGG y FLAC de CoffeeSound.",
    apps: ["coffeelive", "coffeeencoder", "coffeeedit", "coffeemotion", "coffeeanimate", "coffeesound"],
    version: "7.x",
    download_size: "90 MB",
    publisher: "Proyecto FFmpeg",
    license: "GPL",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
  {
    id: "pdfcheck",
    name: "Revisión del PDF original",
    summary: "Revisa la ortografía del texto que ya trae el PDF, también si está escaneado",
    description:
      "CoffeePDF revisa por defecto solo los textos que agregas. Con este complemento también revisa el texto original del documento: lo subraya en rojo, lo cuenta en el indicador de faltas y lo corrige con clic derecho (tapa la palabra y escribe la corrección encima). En las páginas escaneadas reconoce el texto con OCR (Tesseract) en español e inglés.",
    apps: ["coffeepdf"],
    version: "5.4",
    download_size: "36 MB",
    publisher: "Proyecto Tesseract OCR",
    license: "Apache 2.0",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
  {
    id: "aigen",
    name: "IA generativa",
    summary: "Relleno generativo y generar imágenes a partir de una descripción en CoffeePhoto",
    description:
      "Rellena una selección con lo que describas (quitar o añadir objetos, ampliar el fondo) y genera imágenes nuevas como capas. Usa un servicio compatible con la API de imágenes de OpenAI con tu propia clave, que solo se guarda en este equipo. Sin el complemento, CoffeePhoto ya incluye «Relleno según el contenido», que no necesita internet.",
    apps: ["coffeephoto"],
    version: "1.0",
    download_size: "Sin descarga",
    publisher: "CoffeeWorks",
    license: "Servicio externo (requiere clave de API)",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
  {
    id: "raw",
    name: "Revelado RAW",
    summary: "Abre fotos RAW de cámara (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2) en CoffeeLens y CoffeePhoto",
    description:
      "Decodifica los archivos RAW de casi todas las cámaras con LibRaw, con balance de blancos de la cámara y espacio de color sRGB, para revelarlos en CoffeeLens o retocarlos en CoffeePhoto.",
    apps: ["coffeelens", "coffeephoto"],
    version: "0.21",
    download_size: "4 MB",
    publisher: "Proyecto LibRaw",
    license: "LGPL 2.1 / CDDL",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
  {
    id: "potrace",
    name: "Calco vectorial",
    summary: "Convierte imágenes y dibujos en trazados vectoriales en CoffeeVector y CoffeePaint",
    description:
      "Calca una imagen de mapa de bits (un logotipo escaneado, una foto o un dibujo de CoffeePaint) y la convierte en trazados vectoriales editables, en blanco y negro o por colores. Usa Potrace.",
    apps: ["coffeevector", "coffeepaint"],
    version: "1.16",
    download_size: "1 MB",
    publisher: "Peter Selinger (Potrace)",
    license: "GPL",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
  {
    id: "puppetcompat",
    name: "Compatibilidad para equipos antiguos",
    summary: "Seguimiento facial de CoffeePuppet en procesadores sin instrucciones SIMD",
    description:
      "CoffeePuppet sigue tu cara con un motor optimizado para los procesadores actuales. Este complemento añade la versión compatible con equipos muy antiguos, cuyo procesador no tiene instrucciones SIMD. Solo hace falta si CoffeePuppet te lo pide.",
    apps: ["coffeepuppet"],
    version: "0.10.21",
    download_size: "4 MB",
    publisher: "Google (MediaPipe)",
    license: "Apache 2.0",
    installed: false,
    installed_bytes: 0,
    can_install: false,
    manual_hint: "Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.",
  },
];

// Catálogo usado en el navegador; en escritorio lo proporciona el backend
const WEB_CATALOG: SuiteApp[] = [
  {
    id: "coffeedoc",
    name: "CoffeeDoc",
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
    icon_url: "/icons/CoffeeText.ico",
    category: "Office",
  },
  {
    id: "coffeebooks",
    name: "CoffeeBooks",
    subtitle: "Notas, wikis y bases de datos",
    description:
      "Notas, wikis y bases de datos en páginas hechas de bloques: escribe con «/», crea subpáginas, tablas con vistas de tablero, lista y calendario, y plantillas.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "notes",
    icon_name: "notebook-pen",
    icon_url: "/icons/CoffeeBooks.ico",
    category: "Office",
  },
  {
    id: "coffeecalc",
    name: "CoffeeCalc",
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
    icon_url: "/icons/CoffeeSheet.ico",
    category: "Office",
  },
  {
    id: "coffeeview",
    name: "CoffeeView",
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
    icon_url: "/icons/CoffeeSlides.ico",
    category: "Office",
  },
  {
    id: "coffeepdf",
    name: "CoffeePDF",
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
    icon_url: "/icons/CoffeePDF.ico",
    category: "Office",
  },
  {
    id: "coffeepage",
    name: "CoffeePage",
    subtitle: "Cuaderno digital de notas",
    description:
      "Notas en secciones y páginas: escribe en cualquier parte, dibuja a mano, pega imágenes, marca tareas y busca en todo el cuaderno.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "notes",
    icon_name: "notebook",
    icon_url: "/icons/CoffeePage.ico",
    category: "Office",
  },
  {
    id: "coffeedatabase",
    name: "CoffeeDataBase",
    subtitle: "Bases de datos de escritorio",
    description:
      "Tablas, formularios, consultas SQL y visuales, relaciones con diagrama y asistente. Importa Excel, CSV y archivos .accdb/.mdb.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "database",
    icon_name: "database",
    icon_url: "/icons/CoffeeDataBase.ico",
    category: "Office",
  },
  {
    id: "coffeeedit",
    name: "CoffeeEdit",
    subtitle: "Editor de video",
    description:
      "Edita videos con varias pistas, cortes, velocidad, filtros, textos animados y transiciones, y exporta a MP4. Abre las grabaciones de CoffeeLive.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "media",
    icon_name: "scissors",
    icon_url: "/icons/CoffeeEdit.ico",
    category: "Multimedia",
  },
  {
    id: "coffeelive",
    name: "CoffeeLive",
    subtitle: "Grabación de pantalla y transmisión en directo",
    description:
      "Escenas con pantalla, cámara, imágenes y textos; filtros, croma, transiciones, mezclador y atajos globales. Graba en MP4 o transmite a Twitch, YouTube y más.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "live",
    icon_name: "radio",
    icon_url: "/icons/CoffeeLive.ico",
    category: "Multimedia",
  },  {
    id: "coffeeuiux",
    name: "CoffeeUI/UX",
    subtitle: "Diseño de interfaces y prototipos",
    description:
      "Diseña interfaces para móvil, escritorio y web: marcos con tamaños de dispositivo, formas, textos, componentes, diseño automático, prototipos navegables y exportación a PNG, SVG, PDF y HTML/CSS.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "design",
    icon_name: "pen-tool",
    icon_url: "/icons/CoffeeUIUX.ico",
    category: "Desarrollador",
  },
  {
    id: "coffeeuml",
    name: "CoffeeUML",
    subtitle: "Modelado UML y diagramas",
    description:
      "Diagramas UML de clases, casos de uso, secuencia, actividad, estados, componentes y despliegue; modelos entidad-relación y diagramas de flujo. Genera código y SQL y exporta a PNG, SVG y PDF.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "diagram",
    icon_name: "workflow",
    icon_url: "/icons/CoffeeUML.ico",
    category: "Desarrollador",
  },
  {
    id: "coffeephoto",
    name: "CoffeePhoto",
    subtitle: "Edición de imágenes y retoque fotográfico",
    description:
      "Edición avanzada de imágenes: capas, máscaras, selecciones, pinceles, ajustes de color, filtros, texto y relleno según el contenido. Abre PNG, JPG y WebP y exporta a PNG, JPG, WebP y PDF.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "image",
    icon_url: "/icons/CoffeePhoto.ico",
    category: "Ilustración",
  },
  {
    id: "coffeevector",
    name: "CoffeeVector",
    subtitle: "Gráficos vectoriales e ilustración",
    description:
      "Gráficos vectoriales, logotipos e ilustraciones escalables: pluma Bézier, formas, buscatrazos, degradados, texto y mesas de trabajo. Abre y exporta SVG, y exporta a PNG y PDF.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "pen-line",
    icon_url: "/icons/CoffeeVector.ico",
    category: "Ilustración",
  },
  {
    id: "coffeepaint",
    name: "CoffeePaint",
    subtitle: "Pintura y dibujo digital",
    description:
      "Pintura y dibujo digital con presión del lápiz: pinceles de lápiz, tinta, acuarela, óleo, aerógrafo y marcador; capas, simetría, mezcla de colores y lienzos táctiles. Exporta a PNG, JPG, capas en ZIP y, con el complemento, a SVG vectorizado.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "brush",
    icon_url: "/icons/CoffeePaint.ico",
    category: "Ilustración",
  },
  {
    id: "coffeelens",
    name: "CoffeeLens",
    subtitle: "Revelado y organización de fotografías",
    description:
      "Organiza y revela fotografías: catálogo con estrellas, colores y colecciones; ajustes de luz, color, curvas, HSL, nitidez y viñeta no destructivos; ajustes preestablecidos y exportación por lotes.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "aperture",
    icon_url: "/icons/CoffeeLens.ico",
    category: "Ilustración",
  },
  {
    id: "coffeemotion",
    name: "CoffeeMotion",
    subtitle: "Gráficos en movimiento y efectos visuales",
    description:
      "Composiciones con capas de forma, texto, imagen y video animadas con fotogramas clave y curvas de suavizado; efectos, máscaras, plantillas de títulos y exportación a video WebM o MP4.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "wand-sparkles",
    icon_url: "/icons/CoffeeMotion.ico",
    category: "Ilustración",
  },
  {
    id: "coffeesound",
    name: "CoffeeSound",
    subtitle: "Edición, mezcla y restauración de audio",
    description:
      "Edita formas de onda (cortar, copiar, silencio, fundidos), mezcla varias pistas con volumen y panorama, aplica efectos (ecualizador, compresor, reverberación, eco, reducción de ruido, normalizar) y graba desde el micrófono. Exporta WAV y, con FFmpeg, MP3.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "audio-waveform",
    icon_url: "/icons/CoffeeSound.ico",
    category: "Ilustración",
  },
  {
    id: "coffeeencoder",
    name: "CoffeeEncoder",
    subtitle: "Conversión de video y audio",
    description:
      "Cola de conversión de video y audio con ajustes preestablecidos (YouTube, redes sociales, móvil, web, solo audio, GIF): cambia formato, resolución, calidad y recorte, y procesa varios archivos seguidos con FFmpeg.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "refresh-cw",
    icon_url: "/icons/CoffeeEncoder.ico",
    category: "Ilustración",
  },
  {
    id: "coffeeanimate",
    name: "CoffeeAnimate",
    subtitle: "Animación 2D interactiva",
    description:
      "Animación cuadro a cuadro e interpolada con línea de tiempo, capas, fotogramas clave, papel cebolla, símbolos y botones interactivos; exporta a HTML5, GIF, video y secuencia PNG.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "film",
    icon_url: "/icons/CoffeeAnimate.ico",
    category: "Ilustración",
  },
  {
    id: "coffeepuppet",
    name: "CoffeePuppet",
    subtitle: "Animación de personajes en tiempo real",
    description:
      "Personajes 2D que imitan tu cara por la cámara (cabeza, ojos, cejas, boca y parpadeo) y se mueven con el teclado; graba la actuación con voz y exporta video.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "smile",
    icon_url: "/icons/CoffeePuppet.ico",
    category: "Ilustración",
  },
  {
    id: "coffeeanimate3d",
    name: "CoffeeAnimate3D",
    subtitle: "Modelado y animación 3D por bloques",
    description:
      "Modelos 3D hechos de cubos con texturas pixeladas de 32×32, huesos y animación por fotogramas clave; plantillas de cuadrúpedo, bípedo, ave y araña, exporta a glTF (.glb) y Claude puede modelar y animar por MCP.",
    version: "v1.0",
    installed: true,
    available: true,
    size_mb: 0,
    status: "",
    color_badge: "art",
    icon_name: "box",
    icon_url: "/icons/CoffeeAnimate3D.ico",
    category: "Ilustración",
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

  async updateStatus(): Promise<UpdateInfo | null> {
    return isTauri ? invoke<UpdateInfo>("update_status") : null;
  },

  /** Busca una versión nueva y, si la hay, la descarga. */
  async updateCheck(): Promise<UpdateInfo> {
    return invoke<UpdateInfo>("update_check");
  },

  /** Cierra el Launcher, instala la actualización y lo vuelve a abrir. */
  async updateApply(): Promise<void> {
    await invoke("update_apply");
  },

  async updateSetAuto(enabled: boolean): Promise<UpdateInfo> {
    return invoke<UpdateInfo>("update_set_auto", { enabled });
  },

  async mcpStatus(): Promise<McpState> {
    return invoke<McpState>("mcp_status");
  },

  async mcpSetEnabled(enabled: boolean): Promise<McpState> {
    return invoke<McpState>("mcp_set_enabled", { enabled });
  },

  async mcpRegenerateToken(): Promise<McpState> {
    return invoke<McpState>("mcp_regenerate_token");
  },

  async mcpClientConfig(): Promise<string> {
    return invoke<string>("mcp_client_config");
  },

  /** Versión instalada y, con `online`, la última publicada. Sin la app de escritorio devuelve null. */
  async gameStatus(id: string, online: boolean): Promise<GameStatus | null> {
    return isTauri ? invoke<GameStatus>("game_status", { id, online }) : null;
  },

  async installGame(id: string): Promise<GameStatus> {
    if (isTauri) return invoke<GameStatus>("game_install", { id });
    throw new Error("Los juegos se instalan desde la app de escritorio de CoffeeWorks.");
  },

  async uninstallGame(id: string): Promise<void> {
    if (isTauri) await invoke("game_uninstall", { id });
  },

  async launchGame(id: string): Promise<void> {
    if (isTauri) await invoke("game_launch", { id });
    else throw new Error("Los juegos se abren desde la app de escritorio de CoffeeWorks.");
  },

  async getAddons(): Promise<AddonInfo[]> {
    if (isTauri) return invoke<AddonInfo[]>("get_addons");
    return WEB_ADDONS;
  },

  async installAddon(id: string): Promise<AddonInfo> {
    if (isTauri) return invoke<AddonInfo>("install_addon", { id });
    throw new Error("Los complementos se instalan en la aplicación de escritorio de CoffeeWorks.");
  },

  async uninstallAddon(id: string): Promise<AddonInfo> {
    if (isTauri) return invoke<AddonInfo>("uninstall_addon", { id });
    throw new Error("Los complementos se gestionan en la aplicación de escritorio de CoffeeWorks.");
  },

  async openAddonsFolder(): Promise<void> {
    if (isTauri) await invoke("open_addons_folder");
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
