import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  Download,
  Printer,
  Undo2,
  Redo2,
  FileText,
  Combine,
  Image as ImageIcon,
  Search,
  ClipboardList,
  Keyboard,
  Info,
  Trash2,
  Copy,
  RotateCw,
  RotateCcw,
  FileOutput,
  Plus,
  Type,
  Signature,
  Loader2,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { PdfToolbar } from "./components/PdfToolbar";
import { PageView } from "./components/PageView";
import { SpellIndicator, SpellStyles, useSpellCheck } from "./spell/useSpellCheck";
import { OriginalCheck, useOriginalText } from "./components/OriginalCheck";
import { Thumbnails } from "./components/Thumbnails";
import { SidePanel, type PanelTab } from "./components/SidePanel";
import { SignatureModal } from "./components/SignatureModal";
import { ExportModal, type ExportOption } from "./components/ExportModal";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askChoice, askForm, showMessage, toast } from "./components/Dialogs";
import {
  ProtectedPdfError,
  blankPage,
  buildPdf,
  emptyPdfBytes,
  loadSource,
  normalizeImage,
  openForPreview,
  readFormFields,
  readInfo,
  searchText,
  type SourcePdf,
  type TextMatch,
} from "./services/pdfEngine";
import {
  APP_ID,
  DEFAULT_TITLE,
  IMAGE_FILTERS,
  OPEN_FILTERS,
  openPath,
  openWebEntry,
  persistPdf,
  rememberOpened,
  type OpenedFile,
} from "./services/pdfStore";
import {
  appWindow,
  bytesToBase64,
  extensionOf,
  getLaunchArgs,
  isTauri,
  listRecent,
  pickOpenFile,
  renameInVault,
  saveFileAs,
  setPinned,
  stripExtension,
  type RecentEntry,
} from "./services/desktop";
import { displaySize, newId, rotateAnnotation, translate, type Bounds } from "./services/geometry";
import type { Annotation, DocumentInfo, DocumentModel, FormField, PageItem, Tool, ToolStyle } from "./types";

const HISTORY_LIMIT = 80;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

const PdfLogo = (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <path
      d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
      fill="#C62828"
    />
    <path d="M24 4V13H33L24 4Z" fill="#EF9A9A" />
    <rect x="10.5" y="20" width="19" height="9" rx="2" fill="white" />
    <text x="20" y="27" textAnchor="middle" fontSize="7" fontWeight="700" fill="#C62828" fontFamily="Arial, sans-serif">
      PDF
    </text>
  </svg>
);

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "pdf",
    name: "Guardar una copia en PDF",
    description: "Todas las páginas con las anotaciones, firmas y formularios rellenados.",
    badge: "PDF",
    icon: FileText,
  },
  {
    id: "selection",
    name: "Extraer las páginas seleccionadas",
    description: "Crea un PDF nuevo solo con las páginas marcadas en la barra de miniaturas.",
    badge: "PDF",
    icon: FileOutput,
  },
  {
    id: "png",
    name: "Página actual como imagen (.png)",
    description: "Imagen de alta resolución de la página que estás viendo.",
    badge: "PNG",
    icon: ImageIcon,
  },
  {
    id: "print",
    name: "Imprimir",
    description: "Abre el diálogo de impresión del sistema.",
    badge: "Imprimir",
    icon: Printer,
  },
];

const EMPTY_MODEL: DocumentModel = { pages: [], formValues: {}, flattenForms: false };
const EMPTY_INFO: DocumentInfo = { title: "", author: "", subject: "", keywords: "" };

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
};

const cloneAnnotation = (annotation: Annotation): Annotation => ({ ...annotation, id: newId("ann") });

export const App: React.FC = () => {
  // Documento
  const [sources, setSources] = useState<SourcePdf[]>([]);
  const [model, setModel] = useState<DocumentModel>(EMPTY_MODEL);
  const [info, setInfo] = useState<DocumentInfo>(EMPTY_INFO);
  const [fields, setFields] = useState<FormField[]>([]);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [docId, setDocId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [busy, setBusy] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);

  // Pantalla de inicio
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  // Edición
  const [tool, setTool] = useState<Tool>("select");
  const [toolStyle, setToolStyle] = useState<ToolStyle>({
    color: "#000000",
    highlight: "#fff176",
    fill: null,
    strokeWidth: 2,
    fontSize: 12,
    font: "Helvetica",
    bold: false,
    italic: false,
  });
  const [selection, setSelection] = useState<{ pageId: string; annotationId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Annotation | null>(null);

  // Vista
  const [zoomMode, setZoomMode] = useState<number | "fit">("fit");
  const [viewerWidth, setViewerWidth] = useState(900);
  const [panelTab, setPanelTab] = useState<PanelTab | null>("props");
  const [showThumbnails, setShowThumbnails] = useState(true);

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<TextMatch[]>([]);
  const [searching, setSearching] = useState(false);

  // Ventanas
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [printImages, setPrintImages] = useState<string[] | null>(null);

  const sourcesRef = useRef<SourcePdf[]>([]);
  const modelRef = useRef<DocumentModel>(EMPTY_MODEL);
  const history = useRef<{ stack: DocumentModel[]; index: number; lastKey: string; lastTime: number }>({
    stack: [],
    index: -1,
    lastKey: "",
    lastTime: 0,
  });
  const pageElements = useRef(new Map<string, HTMLDivElement>());
  const viewerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const dirtyRef = useRef(false);

  sourcesRef.current = sources;
  modelRef.current = model;

  const pages = model.pages;
  const currentIndex = Math.max(0, pages.findIndex((p) => p.id === currentPageId));
  const currentPage = pages[currentIndex] || null;
  const selectedAnnotation = useMemo(() => {
    if (!selection) return null;
    return pages.find((p) => p.id === selection.pageId)?.annotations.find((a) => a.id === selection.annotationId) || null;
  }, [pages, selection]);

  // --- Zoom -----------------------------------------------------------------

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewerWidth(element.clientWidth));
    observer.observe(element);
    setViewerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [loaded, showStartScreen]);

  const maxPageWidth = useMemo(() => Math.max(300, ...pages.map((p) => displaySize(p).width)), [pages]);
  const zoom = zoomMode === "fit" ? Math.max(0.2, Math.min(3, (viewerWidth - 64) / maxPageWidth)) : zoomMode;

  const stepZoom = (direction: 1 | -1) => {
    const next = direction === 1 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
    setZoomMode(next ?? (direction === 1 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : ZOOM_STEPS[0]));
  };

  // --- Historial ------------------------------------------------------------

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus("dirty");
  }, []);

  /** Aplica un nuevo estado del documento y lo registra para deshacer. */
  const applyModel = useCallback(
    (next: DocumentModel, coalesceKey = "") => {
      modelRef.current = next;
      setModel(next);
      const h = history.current;
      const now = Date.now();
      if (coalesceKey && h.lastKey === coalesceKey && now - h.lastTime < 1500 && h.index === h.stack.length - 1) {
        h.stack[h.index] = next;
      } else {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(next);
        if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
        h.index = h.stack.length - 1;
      }
      h.lastKey = coalesceKey;
      h.lastTime = now;
      markDirty();
    },
    [markDirty]
  );

  const updatePages = useCallback(
    (mutate: (pages: PageItem[]) => PageItem[], coalesceKey = "") => {
      const current = modelRef.current;
      applyModel({ ...current, pages: mutate(current.pages) }, coalesceKey);
    },
    [applyModel]
  );

  const travel = useCallback((direction: -1 | 1) => {
    const h = history.current;
    const target = h.index + direction;
    if (target < 0 || target >= h.stack.length) return;
    h.index = target;
    h.lastKey = "";
    modelRef.current = h.stack[target];
    setModel(h.stack[target]);
    setEditingId(null);
    setSelection(null);
    dirtyRef.current = true;
    setSaveStatus("dirty");
  }, []);

  const handleUndo = useCallback(() => travel(-1), [travel]);
  const handleRedo = useCallback(() => travel(1), [travel]);

  const handleChangeAnnotations = useCallback(
    (pageId: string, update: (list: Annotation[]) => Annotation[], coalesceKey?: string) => {
      updatePages((list) => list.map((p) => (p.id === pageId ? { ...p, annotations: update(p.annotations) } : p)), coalesceKey);
    },
    [updatePages]
  );

  // Texto original del PDF (complemento «Revisión del PDF original»)
  const original = useOriginalText(sources, pages, loaded);

  // Corrector ortográfico de los textos añadidos y, con el complemento, del original
  const spell = useSpellCheck({
    mode: "model",
    segments: [
      ...pages.flatMap((p, i) => p.annotations.flatMap((a) => (a.type === "text" ? [{ key: a.id, text: a.text, label: `Página ${i + 1}` }] : []))),
      ...original.segments,
    ],
    onReveal: (err) => {
      if (err.key.startsWith("orig:")) {
        const pageId = original.pageOf(err.key);
        if (!pageId) return;
        setCurrentPageId(pageId);
        setSelection(null);
        document.querySelector(`[data-spell-key="${CSS.escape(err.key)}"]`)?.scrollIntoView({ block: "center" });
        return;
      }
      const page = pages.find((p) => p.annotations.some((a) => a.id === err.key));
      if (!page) return;
      setCurrentPageId(page.id);
      setSelection({ pageId: page.id, annotationId: err.key });
      pageElements.current.get(page.id)?.scrollIntoView({ block: "start" });
    },
    onReplace: (err, replacement) => {
      if (err.key.startsWith("orig:")) {
        const fix = original.correction(err.key, err.start, err.end, replacement);
        if (fix) handleChangeAnnotations(fix.pageId, (list) => [...list, ...fix.annotations]);
        return;
      }
      const page = pages.find((p) => p.annotations.some((a) => a.id === err.key));
      if (page)
        handleChangeAnnotations(page.id, (list) =>
          list.map((a) => (a.id === err.key && a.type === "text" ? { ...a, text: a.text.slice(0, err.start) + replacement + a.text.slice(err.end) } : a))
        );
    },
  });

  // --- Abrir y crear --------------------------------------------------------

  const refreshRecents = useCallback(async () => setRecents(await listRecent(APP_ID)), []);

  const resetDocument = (nextSources: SourcePdf[], nextModel: DocumentModel) => {
    sourcesRef.current = nextSources;
    modelRef.current = nextModel;
    setSources(nextSources);
    setModel(nextModel);
    history.current = { stack: [nextModel], index: 0, lastKey: "", lastTime: 0 };
    dirtyRef.current = false;
    setSaveStatus("saved");
    setSelection(null);
    setEditingId(null);
    setSelectedPages(new Set());
    setCurrentPageId(nextModel.pages[0]?.id || null);
    setMatches([]);
    setSearchQuery("");
    setTool("select");
    setZoomMode("fit");
    setLoaded(true);
    setShowStartScreen(false);
    viewerRef.current?.scrollTo({ top: 0 });
  };

  const reportError = (err: unknown, fallback: string) => {
    console.error(err);
    void showMessage(
      err instanceof ProtectedPdfError ? "PDF protegido" : "No se pudo abrir el archivo",
      err instanceof Error && err.message ? err.message : fallback
    );
  };

  const loadFile = useCallback(async (file: OpenedFile, pinned = false) => {
    setBusy("Abriendo el PDF…");
    try {
      const { source, pages: sourcePages } = await loadSource(file.bytes, file.name);
      for (const old of sourcesRef.current) void old.proxy.destroy();
      const nextFields = await readFormFields(file.bytes, 0);
      const nextInfo = await readInfo(file.bytes);
      setFields(nextFields);
      setInfo(nextInfo);
      setTitle(stripExtension(file.name) || DEFAULT_TITLE);
      setLocation(file.location);
      setDocId(file.docId);
      setIsStarred(pinned);
      resetDocument([source], {
        pages: sourcePages.map((p) => ({ ...p, source: 0 })),
        formValues: {},
        flattenForms: false,
      });
      void rememberOpened(file);
    } catch (err) {
      reportError(err, "El archivo no es un PDF válido o está dañado.");
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Pregunta qué hacer con los cambios sin guardar. Devuelve `false` para cancelar. */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true;
    const choice = await askChoice({
      title: "Hay cambios sin guardar",
      message: `¿Quieres guardar los cambios de «${title || DEFAULT_TITLE}» antes de continuar?`,
      choices: [
        { id: "cancel", label: "Cancelar" },
        { id: "discard", label: "No guardar", danger: true },
        { id: "save", label: "Guardar", primary: true },
      ],
    });
    if (choice === "save") return saveRef.current();
    return choice === "discard";
  }, [title]);

  const handleNew = useCallback(
    async (newTitle?: string) => {
      if (!(await confirmDiscard())) return;
      const bytes = await emptyPdfBytes();
      await loadFile({ name: `${newTitle || DEFAULT_TITLE}.pdf`, bytes, location: null, docId: newId("pdf") });
    },
    [confirmDiscard, loadFile]
  );

  const handleOpen = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    const picked = await pickOpenFile(OPEN_FILTERS, "Abrir PDF");
    if (!picked) return;
    await loadFile({ name: picked.name, bytes: picked.bytes, location: picked.path, docId: newId("pdf") });
  }, [confirmDiscard, loadFile]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      if (!(await confirmDiscard())) return;
      try {
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("El PDF ya no está en el almacenamiento del navegador.");
        await loadFile(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró el archivo.");
        void refreshRecents();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmDiscard, loadFile, refreshRecents]
  );

  // Arranque: archivo indicado por el Launcher o por el Explorador de Windows
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          await loadFile(await openPath(args.file));
          return;
        }
        if (args.docId) {
          const file = await openWebEntry(args.docId);
          if (file) {
            await loadFile(file);
            return;
          }
        }
        if (args.payload) {
          // Plantilla del Launcher en el modo web (PDF en texto ASCII)
          await loadFile({ name: `${DEFAULT_TITLE}.pdf`, bytes: new TextEncoder().encode(args.payload), location: null, docId: newId("pdf") });
          return;
        }
        if (args.newTitle !== null) {
          const bytes = await emptyPdfBytes();
          await loadFile({ name: `${args.newTitle || DEFAULT_TITLE}.pdf`, bytes, location: null, docId: newId("pdf") });
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir el archivo.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE}${saveStatus === "dirty" ? " •" : ""} - CoffeePDF` : "CoffeePDF");
  }, [loaded, title, saveStatus]);

  // Aviso del navegador al cerrar la pestaña con cambios (modo web)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && !isTauri) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // --- Guardar --------------------------------------------------------------

  const compose = useCallback(
    (only?: Set<string>) => buildPdf(sourcesRef.current, modelRef.current, { ...info, title: info.title || title }, only),
    [info, title]
  );

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!loaded) return false;
    setSaveStatus("saving");
    setBusy("Guardando el PDF…");
    try {
      const bytes = await compose();
      let target = location;
      if (target && isTauri && !target.startsWith("web:")) {
        // En la bóveda, el archivo se renombra si cambió el título
        target = await renameInVault(target, `${title || DEFAULT_TITLE}.pdf`, docId);
      }
      const saved = await persistPdf(bytes, title || DEFAULT_TITLE, docId, target, isStarred);
      setLocation(saved);
      dirtyRef.current = false;
      setSaveStatus("saved");
      toast(isTauri ? "PDF guardado" : "PDF guardado en el navegador");
      return true;
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      void showMessage("No se pudo guardar", err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  }, [compose, docId, isStarred, loaded, location, title]);

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  const exportBytes = async (bytes: Uint8Array, name: string, dialogTitle: string): Promise<string | null> =>
    saveFileAs(`${name}.pdf`, [{ name: "Documento PDF", extensions: ["pdf"] }], bytes, dialogTitle);

  const handleSaveAs = async () => {
    if (!loaded) return;
    setBusy("Generando el PDF…");
    try {
      const bytes = await compose();
      setBusy(null);
      const path = await exportBytes(bytes, title || DEFAULT_TITLE, "Guardar PDF como");
      if (path === null) return;
      if (path) {
        setLocation(path);
        setTitle(stripExtension(path.split(/[\\/]/).pop() || title));
        dirtyRef.current = false;
        setSaveStatus("saved");
        await rememberOpened({ name: path.split(/[\\/]/).pop() || "", bytes, location: path, docId });
        toast("PDF guardado en la nueva ubicación");
      } else {
        toast("PDF descargado");
      }
    } catch (err) {
      void showMessage("No se pudo guardar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleExtract = async () => {
    const ids = selectedPages.size > 0 ? selectedPages : currentPage ? new Set([currentPage.id]) : new Set<string>();
    if (ids.size === 0) return;
    setBusy("Extrayendo páginas…");
    try {
      const bytes = await compose(ids);
      setBusy(null);
      const done = await exportBytes(bytes, `${title || DEFAULT_TITLE} (páginas)`, "Guardar las páginas extraídas");
      if (done !== null) toast(`${ids.size} ${ids.size === 1 ? "página extraída" : "páginas extraídas"}`);
    } catch (err) {
      void showMessage("No se pudo extraer", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  /** Genera imágenes de las páginas finales (con anotaciones) a la escala indicada. */
  const renderFinalPages = async (scale: number, only?: Set<string>): Promise<string[]> => {
    const bytes = await compose(only);
    const preview = await openForPreview(bytes);
    const images: string[] = [];
    try {
      for (let i = 1; i <= preview.numPages; i++) {
        const page = await preview.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({ canvasContext: context, viewport }).promise;
        images.push(canvas.toDataURL("image/jpeg", 0.92));
      }
    } finally {
      void preview.destroy();
    }
    return images;
  };

  const handlePrint = async () => {
    if (!loaded) return;
    setBusy("Preparando la impresión…");
    try {
      setPrintImages(await renderFinalPages(2));
    } catch (err) {
      void showMessage("No se pudo imprimir", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!printImages) return;
    const finish = () => setPrintImages(null);
    window.addEventListener("afterprint", finish);
    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(finish, 1000);
    }, 300);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
    };
  }, [printImages]);

  const handleExportPng = async () => {
    if (!currentPage) return;
    setBusy("Generando la imagen…");
    try {
      const [image] = await renderFinalPages(3, new Set([currentPage.id]));
      setBusy(null);
      const data = Uint8Array.from(atob(image.split(",")[1]), (c) => c.charCodeAt(0));
      // Se vuelve a codificar como PNG para conservar la calidad
      const img = new Image();
      img.src = image;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      const saved = await saveFileAs(
        `${title || DEFAULT_TITLE} - página ${currentIndex + 1}.png`,
        [{ name: "Imagen PNG", extensions: ["png"] }],
        png || data,
        "Guardar página como imagen"
      );
      if (saved !== null) toast("Imagen guardada");
    } catch (err) {
      void showMessage("No se pudo exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleExport = (id: string) => {
    if (id === "pdf") void handleSaveAs();
    else if (id === "selection") void handleExtract();
    else if (id === "png") void handleExportPng();
    else void handlePrint();
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    if (location) await setPinned(docId, next);
    toast(next ? "PDF fijado en el Launcher" : "PDF desfijado");
  };

  // --- Páginas --------------------------------------------------------------

  const targetPageIds = (ids?: string[]) => ids ?? (selectedPages.size > 0 ? [...selectedPages] : currentPage ? [currentPage.id] : []);

  const rotatePages = (clockwise: boolean, ids?: string[]) => {
    const targets = new Set(targetPageIds(ids));
    updatePages((list) =>
      list.map((page) => {
        if (!targets.has(page.id)) return page;
        const { width, height } = displaySize(page);
        return {
          ...page,
          rotation: (page.rotation + (clockwise ? 90 : 270)) % 360,
          annotations: page.annotations.map((a) => rotateAnnotation(a, clockwise, width, height)),
        };
      })
    );
  };

  const duplicatePages = (ids?: string[]) => {
    const targets = new Set(targetPageIds(ids));
    updatePages((list) =>
      list.flatMap((page) =>
        targets.has(page.id) ? [page, { ...page, id: newId("page"), annotations: page.annotations.map(cloneAnnotation) }] : [page]
      )
    );
  };

  const deletePages = (ids?: string[]) => {
    const targets = new Set(targetPageIds(ids));
    if (targets.size === 0) return;
    if (targets.size >= pages.length) {
      toast("El PDF debe conservar al menos una página", "info");
      return;
    }
    const firstIndex = pages.findIndex((p) => targets.has(p.id));
    updatePages((list) => list.filter((p) => !targets.has(p.id)));
    const remaining = pages.filter((p) => !targets.has(p.id));
    setCurrentPageId(remaining[Math.min(firstIndex, remaining.length - 1)]?.id || null);
    setSelectedPages(new Set());
    setSelection(null);
  };

  const movePage = (id: string, toIndex: number) => {
    updatePages((list) => {
      const from = list.findIndex((p) => p.id === id);
      if (from < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex > from ? toIndex - 1 : toIndex, 0, moved);
      return next;
    });
  };

  const insertBlankPage = () => {
    const reference = currentPage;
    const size = reference ? displaySize(reference) : { width: 595.28, height: 841.89 };
    const page = blankPage([0, 0, size.width, size.height]);
    updatePages((list) => {
      const next = [...list];
      next.splice(reference ? currentIndex + 1 : next.length, 0, page);
      return next;
    });
    setCurrentPageId(page.id);
    window.setTimeout(() => pageElements.current.get(page.id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
  };

  /** Combina otro PDF: sus páginas se insertan después de la página actual. */
  const handleInsertPdf = async () => {
    const picked = await pickOpenFile(OPEN_FILTERS, "Insertar páginas de otro PDF");
    if (!picked) return;
    setBusy("Añadiendo páginas…");
    try {
      const { source, pages: newPages } = await loadSource(picked.bytes, picked.name);
      const sourceIndex = sourcesRef.current.length;
      const nextSources = [...sourcesRef.current, source];
      sourcesRef.current = nextSources;
      setSources(nextSources);
      const extraFields = await readFormFields(picked.bytes, sourceIndex);
      setFields((prev) => [...prev, ...extraFields]);
      const items = newPages.map((p) => ({ ...p, source: sourceIndex }));
      updatePages((list) => {
        const next = [...list];
        next.splice(currentIndex + 1, 0, ...items);
        return next;
      });
      toast(`${items.length} ${items.length === 1 ? "página añadida" : "páginas añadidas"} de «${picked.name}»`);
    } catch (err) {
      reportError(err, "No se pudo leer el PDF.");
    } finally {
      setBusy(null);
    }
  };

  const handleSelectPage = (id: string, mode: "single" | "toggle" | "range") => {
    setCurrentPageId(id);
    if (mode === "single") {
      setSelectedPages(new Set());
      pageElements.current.get(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
    } else if (mode === "toggle") {
      setSelectedPages((prev) => {
        const next = new Set(prev.size === 0 && currentPage ? [currentPage.id] : prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      const from = currentIndex;
      const to = pages.findIndex((p) => p.id === id);
      const [a, b] = from < to ? [from, to] : [to, from];
      setSelectedPages(new Set(pages.slice(a, b + 1).map((p) => p.id)));
    }
  };

  const goToPage = (number: number) => {
    const page = pages[Math.max(0, Math.min(pages.length - 1, Math.round(number) - 1))];
    if (!page) return;
    setCurrentPageId(page.id);
    pageElements.current.get(page.id)?.scrollIntoView({ block: "start" });
  };

  const registerElement = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) pageElements.current.set(id, element);
    else pageElements.current.delete(id);
  }, []);

  // La página actual es la que ocupa el centro de la zona visible
  const scrollFrame = useRef<number | null>(null);
  const handleViewerScroll = () => {
    if (scrollFrame.current !== null) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      const viewer = viewerRef.current;
      if (!viewer) return;
      const middle = viewer.getBoundingClientRect().top + viewer.clientHeight / 3;
      let best: string | null = null;
      let bestDistance = Infinity;
      for (const [id, element] of pageElements.current) {
        const rect = element.getBoundingClientRect();
        const distance = rect.top <= middle && rect.bottom >= middle ? 0 : Math.min(Math.abs(rect.top - middle), Math.abs(rect.bottom - middle));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = id;
        }
      }
      if (best && best !== currentPageId) setCurrentPageId(best);
    });
  };

  // --- Anotaciones ----------------------------------------------------------

  const addToCurrentPage = (annotation: Annotation) => {
    const page = currentPage;
    if (!page) return;
    handleChangeAnnotations(page.id, (list) => [...list, annotation]);
    setSelection({ pageId: page.id, annotationId: annotation.id });
    setTool("select");
  };

  /** Inserta una imagen centrada en la página actual con su proporción. */
  const placeImage = async (dataUrl: string, maxWidthRatio: number, pixelWidth?: number, pixelHeight?: number) => {
    const page = currentPage;
    if (!page) return;
    try {
      const normalized = await normalizeImage(dataUrl);
      const size = displaySize(page);
      const naturalW = (pixelWidth ?? normalized.width) * 0.75;
      const naturalH = (pixelHeight ?? normalized.height) * 0.75;
      const factor = Math.min(1, (size.width * maxWidthRatio) / naturalW, (size.height * 0.8) / naturalH);
      const w = naturalW * factor;
      const h = naturalH * factor;
      addToCurrentPage({ id: newId("ann"), type: "image", x: (size.width - w) / 2, y: (size.height - h) / 2, w, h, dataUrl: normalized.dataUrl });
    } catch {
      toast("No se pudo leer la imagen", "error");
    }
  };

  const handleInsertImage = async () => {
    const picked = await pickOpenFile(IMAGE_FILTERS, "Insertar imagen");
    if (!picked) return;
    const extension = extensionOf(picked.name);
    const mime = extension === "svg" ? "image/svg+xml" : extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    await placeImage(`data:${mime};base64,${bytesToBase64(picked.bytes)}`, 0.6);
  };

  const updateSelected = (patch: Partial<Annotation>) => {
    if (!selection) return;
    handleChangeAnnotations(
      selection.pageId,
      (list) => list.map((a) => (a.id === selection.annotationId ? ({ ...a, ...patch } as Annotation) : a)),
      `props-${selection.annotationId}-${Object.keys(patch).join("-")}`
    );
  };

  const deleteSelected = () => {
    if (!selection) return;
    handleChangeAnnotations(selection.pageId, (list) => list.filter((a) => a.id !== selection.annotationId));
    setSelection(null);
    setEditingId(null);
  };

  const duplicateSelected = () => {
    if (!selection || !selectedAnnotation) return;
    const copy = translate(cloneAnnotation(selectedAnnotation), 12, 12);
    handleChangeAnnotations(selection.pageId, (list) => [...list, copy]);
    setSelection({ pageId: selection.pageId, annotationId: copy.id });
  };

  const pasteAnnotation = () => {
    if (!clipboard || !currentPage) return;
    const copy = translate(cloneAnnotation(clipboard), 12, 12);
    handleChangeAnnotations(currentPage.id, (list) => [...list, copy]);
    setSelection({ pageId: currentPage.id, annotationId: copy.id });
    setClipboard(copy);
  };

  // --- Búsqueda -------------------------------------------------------------

  const runSearch = async () => {
    if (!searchQuery.trim()) {
      setMatches([]);
      return;
    }
    setSearching(true);
    try {
      setMatches(await searchText(sourcesRef.current, modelRef.current.pages, searchQuery));
    } catch (err) {
      console.error(err);
      toast("No se pudo buscar en el documento", "error");
    } finally {
      setSearching(false);
    }
  };

  const goToMatch = (match: TextMatch) => {
    setCurrentPageId(match.pageId);
    const element = pageElements.current.get(match.pageId);
    const viewer = viewerRef.current;
    if (!element || !viewer) return;
    const box = match.boxes[0];
    viewer.scrollTo({ top: element.offsetTop + (box ? box.y * zoom : 0) - viewer.clientHeight / 3, behavior: "smooth" });
  };

  const highlightMatches = () => {
    const byPage = new Map<string, Bounds[]>();
    for (const match of matches) byPage.set(match.pageId, [...(byPage.get(match.pageId) || []), ...match.boxes]);
    updatePages((list) =>
      list.map((page) => {
        const boxes = byPage.get(page.id);
        if (!boxes) return page;
        const added: Annotation[] = boxes.map((b) => ({
          id: newId("ann"),
          type: "highlight",
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          color: toolStyle.highlight,
          fill: null,
          strokeWidth: 0,
        }));
        return { ...page, annotations: [...page.annotations, ...added] };
      })
    );
    toast(`${matches.length} coincidencias resaltadas`);
    setMatches([]);
  };

  const searchBoxesByPage = useMemo(() => {
    const map = new Map<string, Bounds[]>();
    for (const match of matches) map.set(match.pageId, [...(map.get(match.pageId) || []), ...match.boxes]);
    return map;
  }, [matches]);

  // --- Propiedades del documento ---------------------------------------------

  const handleProperties = async () => {
    const values = await askForm({
      title: "Propiedades del documento",
      message: "Se guardan dentro del PDF y las muestran otros lectores.",
      confirmLabel: "Guardar",
      fields: [
        { name: "title", label: "Título", defaultValue: info.title },
        { name: "author", label: "Autor", defaultValue: info.author },
        { name: "subject", label: "Asunto", defaultValue: info.subject },
        { name: "keywords", label: "Palabras clave (separadas por comas)", defaultValue: info.keywords },
      ],
    });
    if (!values) return;
    setInfo({ title: values.title, author: values.author, subject: values.subject, keywords: values.keywords });
    markDirty();
  };

  // --- Teclado --------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showStartScreen || !loaded) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const typing = isTypingTarget(e.target);

      if (e.altKey && e.key === "/") {
        e.preventDefault();
        setCommandSearchOpen(true);
        return;
      }
      if (mod) {
        switch (key) {
          case "s":
            e.preventDefault();
            if (e.shiftKey) void handleSaveAs();
            else void handleSave();
            return;
          case "o":
            e.preventDefault();
            void handleOpen();
            return;
          case "n":
            e.preventDefault();
            void handleNew();
            return;
          case "p":
            e.preventDefault();
            void handlePrint();
            return;
          case "f":
            e.preventDefault();
            setPanelTab("search");
            return;
          case "=":
          case "+":
            e.preventDefault();
            stepZoom(1);
            return;
          case "-":
            e.preventDefault();
            stepZoom(-1);
            return;
          case "0":
            e.preventDefault();
            setZoomMode("fit");
            return;
        }
        if (typing) return;
        switch (key) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
            return;
          case "y":
            e.preventDefault();
            handleRedo();
            return;
          case "d":
            e.preventDefault();
            duplicateSelected();
            return;
          case "c":
            if (selectedAnnotation) {
              e.preventDefault();
              setClipboard(selectedAnnotation);
            }
            return;
          case "x":
            if (selectedAnnotation) {
              e.preventDefault();
              setClipboard(selectedAnnotation);
              deleteSelected();
            }
            return;
        }
        return;
      }
      if (typing) return;

      if (e.key === "Escape") {
        setSelection(null);
        setTool("select");
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key.startsWith("Arrow") && selection && selectedAnnotation) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        handleChangeAnnotations(
          selection.pageId,
          (list) => list.map((a) => (a.id === selection.annotationId ? translate(a, dx, dy) : a)),
          `nudge-${selection.annotationId}`
        );
        return;
      }
      if (e.key === "PageDown" || e.key === "PageUp") {
        e.preventDefault();
        goToPage(currentIndex + 1 + (e.key === "PageDown" ? 1 : -1));
        return;
      }
      if (e.key === "Enter" && selectedAnnotation?.type === "text") {
        e.preventDefault();
        setEditingId(selectedAnnotation.id);
        return;
      }
      const shortcuts: Record<string, Tool> = { v: "select", t: "text", r: "replace", h: "highlight", w: "whiteout", l: "line", a: "arrow", d: "ink" };
      if (shortcuts[key]) setTool(shortcuts[key]);
    };

    // Pegar: una imagen del portapapeles del sistema o la anotación copiada
    const handlePaste = (e: ClipboardEvent) => {
      if (showStartScreen || !loaded || isTypingTarget(e.target)) return;
      const file = Array.from(e.clipboardData?.files || []).find((item) => item.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => void placeImage(String(reader.result), 0.6);
        reader.readAsDataURL(file);
        return;
      }
      if (clipboard) {
        e.preventDefault();
        pasteAnnotation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePaste);
    };
  });

  // --- Menús ----------------------------------------------------------------

  const noAnnotation = !selectedAnnotation;
  const menus: MenuDefinition[] = [
    {
      id: "archivo",
      label: "Archivo",
      items: [
        { label: "Nuevo PDF en blanco", icon: FilePlus, action: () => void handleNew(), shortcut: "Ctrl+N" },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpen(), shortcut: "Ctrl+O" },
        { label: "Pantalla de inicio", icon: FileText, action: () => setShowStartScreen(true) },
        { divider: true },
        { label: "Guardar", icon: Save, action: () => void handleSave(), shortcut: "Ctrl+S" },
        { label: "Guardar como…", icon: SaveAll, action: () => void handleSaveAs(), shortcut: "Ctrl+Mayús+S" },
        { label: "Exportar…", icon: Download, action: () => setExportOpen(true) },
        { label: "Extraer páginas seleccionadas…", icon: FileOutput, action: () => void handleExtract() },
        { divider: true },
        { label: "Propiedades del documento…", icon: Info, action: () => void handleProperties() },
        { label: "Imprimir", icon: Printer, action: () => void handlePrint(), shortcut: "Ctrl+P" },
      ],
    },
    {
      id: "editar",
      label: "Editar",
      items: [
        { label: "Deshacer", icon: Undo2, action: handleUndo, shortcut: "Ctrl+Z" },
        { label: "Rehacer", icon: Redo2, action: handleRedo, shortcut: "Ctrl+Y" },
        { divider: true },
        { label: "Copiar anotación", icon: Copy, action: () => selectedAnnotation && setClipboard(selectedAnnotation), shortcut: "Ctrl+C", disabled: noAnnotation },
        { label: "Pegar anotación", action: pasteAnnotation, shortcut: "Ctrl+V", disabled: !clipboard },
        { label: "Duplicar anotación", action: duplicateSelected, shortcut: "Ctrl+D", disabled: noAnnotation },
        { label: "Eliminar anotación", icon: Trash2, action: deleteSelected, shortcut: "Supr", disabled: noAnnotation },
        { divider: true },
        { label: "Buscar texto", icon: Search, action: () => setPanelTab("search"), shortcut: "Ctrl+F" },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        { label: "Acercar", action: () => stepZoom(1), shortcut: "Ctrl++" },
        { label: "Alejar", action: () => stepZoom(-1), shortcut: "Ctrl+-" },
        { label: "Ajustar al ancho", action: () => setZoomMode("fit"), shortcut: "Ctrl+0", checked: zoomMode === "fit" },
        { label: "Tamaño real (100%)", action: () => setZoomMode(1), checked: zoomMode === 1 },
        { divider: true },
        { label: "Miniaturas de páginas", action: () => setShowThumbnails((v) => !v), checked: showThumbnails },
        { label: "Panel de propiedades", action: () => setPanelTab(panelTab === "props" ? null : "props"), checked: panelTab === "props" },
        { label: "Formulario", icon: ClipboardList, action: () => setPanelTab("form"), checked: panelTab === "form" },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        { label: "Texto", icon: Type, action: () => setTool("text"), shortcut: "T" },
        { label: "Imagen…", icon: ImageIcon, action: () => void handleInsertImage() },
        { label: "Firma…", icon: Signature, action: () => setSignatureOpen(true) },
        {
          label: "Fecha de hoy",
          action: () => {
            const page = currentPage;
            if (!page) return;
            const size = displaySize(page);
            const text = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
            addToCurrentPage({
              id: newId("ann"),
              type: "text",
              x: size.width / 2 - 80,
              y: size.height / 2 - 10,
              w: 160,
              h: toolStyle.fontSize * 1.2 + 4,
              text,
              fontSize: toolStyle.fontSize,
              font: toolStyle.font,
              bold: false,
              italic: false,
              color: toolStyle.color,
              align: "left",
            });
          },
        },
        { divider: true },
        { label: "Página en blanco", icon: Plus, action: insertBlankPage },
        { label: "Páginas de otro PDF (combinar)…", icon: Combine, action: () => void handleInsertPdf() },
      ],
    },
    {
      id: "pagina",
      label: "Página",
      items: [
        { label: "Girar a la derecha", icon: RotateCw, action: () => rotatePages(true) },
        { label: "Girar a la izquierda", icon: RotateCcw, action: () => rotatePages(false) },
        { label: "Duplicar", icon: Copy, action: () => duplicatePages() },
        { label: "Eliminar", icon: Trash2, action: () => deletePages(), disabled: pages.length <= 1 },
        { divider: true },
        { label: "Mover hacia arriba", action: () => currentPage && movePage(currentPage.id, currentIndex - 1), disabled: currentIndex === 0 },
        { label: "Mover hacia abajo", action: () => currentPage && movePage(currentPage.id, currentIndex + 2), disabled: currentIndex >= pages.length - 1 },
        { divider: true },
        { label: "Insertar página en blanco", icon: Plus, action: insertBlankPage },
        { label: "Extraer a un PDF nuevo…", icon: FileOutput, action: () => void handleExtract() },
      ],
    },
    {
      id: "ayuda",
      label: "Ayuda",
      items: [
        { label: "Buscar en los menús", icon: Search, action: () => setCommandSearchOpen(true), shortcut: "Alt+/" },
        {
          label: "Atajos de teclado",
          icon: Keyboard,
          action: () =>
            void showMessage(
              "Atajos de teclado",
              [
                "V seleccionar · T texto · R reemplazar texto · H resaltar · W corrector",
                "L línea · A flecha · D dibujo a mano · Esc volver a seleccionar",
                "Supr eliminar la anotación · flechas moverla (Mayús: más rápido)",
                "Ctrl+C / Ctrl+V copiar y pegar anotaciones (o pegar una imagen)",
                "Ctrl+D duplicar · Ctrl+Z / Ctrl+Y deshacer y rehacer",
                "Av Pág / Re Pág cambiar de página · Ctrl+ +/− zoom · Ctrl+0 ajustar",
                "Ctrl+S guardar · Ctrl+Mayús+S guardar como · Ctrl+P imprimir · Ctrl+F buscar",
              ].join("\n")
            ),
        },
        {
          label: "Acerca de CoffeePDF",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeePDF 1.0",
              "Editor de PDF de la suite CoffeeWorks.\n\nAñade textos, resaltados, formas, imágenes y firmas; rellena formularios; reordena, gira, combina y extrae páginas. Al guardar, las anotaciones se incorporan al PDF y se pueden ver en cualquier lector."
            ),
        },
      ],
    },
  ];

  const zoomLabel = zoomMode === "fit" ? `${Math.round(zoom * 100)}% ↔` : `${Math.round(zoom * 100)}%`;

  return (
    <div className="pdf-app flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {loaded && (
        <>
          <SuiteHeader
            logo={PdfLogo}
            logoTitle="Pantalla de inicio de CoffeePDF"
            onLogoClick={() => setShowStartScreen(true)}
            title={title}
            titlePlaceholder={DEFAULT_TITLE}
            onTitleChange={(next) => {
              setTitle(next);
              markDirty();
            }}
            menus={menus}
            saveStatus={saveStatus}
            fileLocation={location && !location.startsWith("web:") ? location : null}
            isStarred={isStarred}
            onToggleStar={() => void handleToggleStar()}
            onRequestClose={confirmDiscard}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  className="bg-[#c62828] hover:bg-[#a51f1f] text-white font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                  title="Guardar (Ctrl+S)"
                >
                  <Save size={14} />
                  <span>Guardar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="bg-[#fce8e6] hover:bg-[#f9d7d4] text-[#7f1d1d] font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                  title="Exportar"
                >
                  <ArrowUpRight size={15} />
                  <span>Exportar</span>
                </button>
              </>
            }
          />

          <PdfToolbar
            tool={tool}
            onToolChange={(next) => {
              setTool(next);
              setEditingId(null);
              if (next !== "select") setSelection(null);
            }}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={history.current.index > 0}
            canRedo={history.current.index < history.current.stack.length - 1}
            onPrint={() => void handlePrint()}
            onInsertImage={() => void handleInsertImage()}
            onSignature={() => setSignatureOpen(true)}
            zoomLabel={zoomLabel}
            onZoomIn={() => stepZoom(1)}
            onZoomOut={() => stepZoom(-1)}
            onZoomFit={() => setZoomMode("fit")}
            onRotate={(clockwise) => rotatePages(clockwise)}
            pageNumber={currentIndex + 1}
            pageCount={pages.length}
            onGoToPage={goToPage}
            onOpenCommandSearch={() => setCommandSearchOpen(true)}
          />

          <div className="flex-1 flex overflow-hidden print:hidden">
            {showThumbnails && (
              <Thumbnails
                pages={pages}
                sources={sources}
                currentId={currentPage?.id || null}
                selected={selectedPages}
                onSelect={handleSelectPage}
                onRotate={(ids, clockwise) => rotatePages(clockwise, ids)}
                onDuplicate={(ids) => duplicatePages(ids)}
                onDelete={(ids) => deletePages(ids)}
                onMove={movePage}
                onAddBlank={insertBlankPage}
              />
            )}

            <div
              ref={viewerRef}
              onScroll={handleViewerScroll}
              className="flex-1 overflow-auto bg-[#e8eaed] relative"
              onDragOver={(e) => {
                if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
              }}
              onDrop={(e) => {
                const file = e.dataTransfer.files[0];
                if (!file) return;
                e.preventDefault();
                if (file.type.startsWith("image/")) {
                  const reader = new FileReader();
                  reader.onload = () => void placeImage(String(reader.result), 0.6);
                  reader.readAsDataURL(file);
                } else if (/\.pdf$/i.test(file.name)) {
                  void file.arrayBuffer().then((buffer) =>
                    loadFile({ name: file.name, bytes: new Uint8Array(buffer), location: null, docId: newId("pdf") })
                  );
                }
              }}
            >
              <div className="min-w-fit flex flex-col items-center gap-5 py-6 px-8">
                {pages.map((page, index) => (
                  <PageView
                    key={page.id}
                    item={page}
                    pageNumber={index + 1}
                    sources={sources}
                    zoom={zoom}
                    tool={tool}
                    style={toolStyle}
                    selectedId={selection?.pageId === page.id ? selection.annotationId : null}
                    editingId={editingId}
                    isCurrent={page.id === currentPage?.id && pages.length > 1}
                    searchBoxes={searchBoxesByPage.get(page.id) || []}
                    onSelect={(pageId, annotationId) => {
                      setCurrentPageId(pageId);
                      setSelection(annotationId ? { pageId, annotationId } : null);
                    }}
                    onSetEditing={setEditingId}
                    onChangeAnnotations={handleChangeAnnotations}
                    onToolDone={() => {
                      // Las herramientas de dibujo siguen activas; el texto vuelve a seleccionar
                      if (tool === "text" || tool === "replace") setTool("select");
                    }}
                    registerElement={registerElement}
                    original={original.layers.get(page.id)}
                  />
                ))}
              </div>
            </div>

            <SidePanel
              tab={panelTab}
              onTabChange={setPanelTab}
              tool={tool}
              style={toolStyle}
              onStyleChange={(patch) => setToolStyle((prev) => ({ ...prev, ...patch }))}
              selected={selectedAnnotation}
              onUpdateSelected={updateSelected}
              onDeleteSelected={deleteSelected}
              onDuplicateSelected={duplicateSelected}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearch={() => void runSearch()}
              searching={searching}
              matches={matches}
              onGoToMatch={goToMatch}
              onHighlightMatches={highlightMatches}
              onClearSearch={() => {
                setMatches([]);
                setSearchQuery("");
              }}
              fields={fields}
              formValues={model.formValues}
              onFieldChange={(key, value) =>
                applyModel({ ...modelRef.current, formValues: { ...modelRef.current.formValues, [key]: value } }, `field-${key}`)
              }
              flattenForms={model.flattenForms}
              onToggleFlatten={() => applyModel({ ...modelRef.current, flattenForms: !modelRef.current.flattenForms })}
            />
          </div>

          <footer className="h-7 px-3 flex items-center justify-between text-[11px] font-mono select-none border-t bg-[#c62828] text-white print:hidden">
            <span>
              Página {currentIndex + 1} de {pages.length}
              {selectedPages.size > 1 ? ` · ${selectedPages.size} seleccionadas` : ""}
              {" · "}
              {pages.reduce((sum, p) => sum + p.annotations.length, 0)} anotaciones
            </span>
            <span className="flex items-center gap-3 min-w-0">
              <OriginalCheck state={original} />
              <SpellIndicator spell={spell} tone="dark" className="font-sans shrink-0" />
              <span className="truncate" title={location || undefined}>
                {location && !location.startsWith("web:") ? location : "Sin guardar en disco"}
              </span>
            </span>
          </footer>
        </>
      )}

      {printImages && (
        <div className="pdf-print-view">
          {printImages.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      )}

      {busy && (
        <div className="fixed inset-0 z-[999990] bg-black/20 flex items-center justify-center print:hidden">
          <div className="bg-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-3 text-sm text-[#1f1f1f]">
            <Loader2 size={18} className="animate-spin text-[#c62828]" />
            {busy}
          </div>
        </div>
      )}

      <SignatureModal
        isOpen={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onInsert={(dataUrl, width, height) => void placeImage(dataUrl, 0.3, width / 3, height / 3)}
      />
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Exportar"
        fileTitle={`${title || DEFAULT_TITLE}.pdf`}
        options={EXPORT_OPTIONS}
        onExport={handleExport}
      />
      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeePDF"
          tagline="Editor de PDF • CoffeeWorks"
          accent="#c62828"
          newHint="Crear un PDF en blanco"
          openHint="Abrir un PDF para editarlo"
          formats={[".pdf"]}
          recents={recents}
          onNew={() => void handleNew()}
          onOpen={() => void handleOpen()}
          onOpenRecent={(entry) => void handleOpenRecent(entry)}
          onContinue={loaded ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      {spell.menu}
      <SpellStyles />
      <DialogHost />
    </div>
  );
};
