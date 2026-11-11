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
  Search,
  CheckSquare,
  HelpCircle,
  FileText,
  FileCog,
  Image as ImageIcon,
  Link as LinkIcon,
  Table,
  Minus,
  MessageSquarePlus,
  CalendarDays,
  SeparatorHorizontal,
  Keyboard,
  Maximize,
  Info,
  X,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { GoogleDocsToolbar } from "./components/GoogleDocsToolbar";
import { Ruler } from "./components/Ruler";
import { DocumentCanvas } from "./components/DocumentCanvas";
import { StatusBar } from "./components/StatusBar";
import { OutlineSidebar } from "./components/OutlineSidebar";
import { ExportModal } from "./components/ExportModal";
import { FindReplaceModal } from "./components/FindReplaceModal";
import { WordCountModal } from "./components/WordCountModal";
import { HelpModal } from "./components/HelpModal";
import { PageSetupModal } from "./components/PageSetupModal";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askConfirm, askForm, askText, showMessage, toast } from "./components/Dialogs";
import {
  APP_ID,
  DEFAULT_TITLE,
  OPEN_FILTERS,
  createBlankDocument,
  createTab,
  exportDocument,
  importFile,
  loadWebDocument,
  openLast,
  openPath,
  parseCfd,
  persistDocument,
  saveDocumentAs,
  type OpenResult,
} from "./services/documentVault";
import {
  appWindow,
  bytesToBase64,
  extensionOf,
  getLaunchArgs,
  isTauri,
  listRecent,
  pickOpenFile,
  setPinned,
  type RecentEntry,
} from "./services/desktop";
import {
  addComment,
  applyCapturedFormat,
  applyLink,
  buildTableHtml,
  captureFormat,
  currentLink,
  exec,
  getCaretOffset,
  headingElements,
  insertHtml,
  insertImage,
  readFormatState,
  selectedText,
  setCaretOffset,
  updateComment,
  type CapturedFormat,
} from "./services/editor";
import type {
  CoffeDocument,
  DocumentHeading,
  DocumentStats,
  ExportFormat,
  FormatState,
  PageSettings,
} from "./types";
import { MARGIN_PIXELS, PAGE_DIMENSIONS } from "./types";

const DEFAULT_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  orderedList: false,
  unorderedList: false,
  align: "left",
  block: "p",
  fontFamily: "Arial",
  fontSize: 11,
  textColor: "#1f1f1f",
};

interface HistoryEntry {
  html: string;
  caret: number | null;
}

interface TabHistory {
  stack: HistoryEntry[];
  index: number;
}

const HISTORY_LIMIT = 200;

const DocsLogo = (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <path
      d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
      fill="#4285F4"
    />
    <path d="M24 4V13H33L24 4Z" fill="#A1C2FA" />
    <rect x="12" y="17" width="16" height="2" rx="1" fill="white" />
    <rect x="12" y="22" width="16" height="2" rx="1" fill="white" />
    <rect x="12" y="27" width="11" height="2" rx="1" fill="white" />
  </svg>
);

function computeStats(html: string, pages: number): DocumentStats {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const text = holder.textContent || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const paragraphs = Array.from(holder.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre")).filter(
    (el) => (el.textContent || "").trim() !== ""
  ).length;
  return {
    words,
    characters: text.length,
    charactersWithoutSpaces: text.replace(/\s/g, "").length,
    readingTimeMinutes: Math.max(1, Math.ceil(words / 200)),
    pages,
    paragraphs,
  };
}

function extractHeadings(html: string): DocumentHeading[] {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return Array.from(holder.querySelectorAll("h1, h2, h3")).map((el, index) => ({
    index,
    text: (el.textContent || "").trim(),
    level: Number(el.tagName[1]),
  }));
}

export const App: React.FC = () => {
  const [doc, setDoc] = useState<CoffeDocument | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [isStarred, setIsStarred] = useState(false);

  // Vista
  const [zoom, setZoom] = useState(100);
  const [readOnly, setReadOnly] = useState(false);
  const [spellcheck, setSpellcheck] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [pages, setPages] = useState(1);
  const [format, setFormat] = useState<FormatState>(DEFAULT_FORMAT);
  const [painter, setPainter] = useState<CapturedFormat | null>(null);

  // Paneles y modales
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);

  // Referencias con el estado más reciente para las tareas asíncronas
  const docRef = useRef<CoffeDocument | null>(null);
  const filePathRef = useRef<string | null>(null);
  const changeCounter = useRef(0);
  const savedCounter = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const histories = useRef<Record<string, TabHistory>>({});
  const historyTimer = useRef<number | null>(null);
  const startedRef = useRef(false);

  docRef.current = doc;
  filePathRef.current = filePath;

  const activeTab = doc ? doc.tabs.find((t) => t.id === doc.activeTabId) || doc.tabs[0] : null;
  const content = activeTab?.content ?? "";
  const title = doc?.metadata.title ?? "";

  const refreshRecents = useCallback(async () => {
    setRecents(await listRecent(APP_ID));
  }, []);

  // -------------------------------------------------------------------------
  // Guardado
  // -------------------------------------------------------------------------

  const saveNow = useCallback((): Promise<void> => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!docRef.current) return Promise.resolve();
    setSaveStatus("saving");
    saveChain.current = saveChain.current.then(async () => {
      const current = docRef.current;
      if (!current) return;
      const version = changeCounter.current;
      try {
        const path = await persistDocument(current, filePathRef.current);
        filePathRef.current = path;
        setFilePath(path);
        savedCounter.current = version;
        setSaveStatus(changeCounter.current === version ? "saved" : "dirty");
      } catch (err) {
        console.error("Error al guardar el documento:", err);
        setSaveStatus("error");
      }
    });
    return saveChain.current;
  }, []);

  /** Marca el documento como modificado y programa el autoguardado. */
  const markDirty = useCallback(() => {
    changeCounter.current += 1;
    setSaveStatus("dirty");
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveNow();
    }, 800);
  }, [saveNow]);

  const flushPendingSave = useCallback(async () => {
    if (docRef.current && changeCounter.current !== savedCounter.current) {
      await saveNow();
    }
  }, [saveNow]);

  // -------------------------------------------------------------------------
  // Historial (deshacer / rehacer) por pestaña
  // -------------------------------------------------------------------------

  const historyFor = (tabId: string, initialHtml: string): TabHistory => {
    if (!histories.current[tabId]) {
      histories.current[tabId] = { stack: [{ html: initialHtml, caret: null }], index: 0 };
    }
    return histories.current[tabId];
  };

  const commitHistory = useCallback(() => {
    if (historyTimer.current !== null) {
      window.clearTimeout(historyTimer.current);
      historyTimer.current = null;
    }
    const current = docRef.current;
    if (!current) return;
    const tab = current.tabs.find((t) => t.id === current.activeTabId);
    if (!tab) return;
    const history = historyFor(tab.id, tab.content);
    if (history.stack[history.index]?.html === tab.content) return;
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push({ html: tab.content, caret: getCaretOffset() });
    if (history.stack.length > HISTORY_LIMIT) history.stack.shift();
    history.index = history.stack.length - 1;
  }, []);

  const setTabContent = useCallback((html: string) => {
    setDoc((prev) =>
      prev
        ? {
            ...prev,
            tabs: prev.tabs.map((tab) => (tab.id === prev.activeTabId ? { ...tab, content: html } : tab)),
          }
        : prev
    );
  }, []);

  const handleContentChange = useCallback(
    (html: string) => {
      const current = docRef.current;
      if (!current) return;
      const tab = current.tabs.find((t) => t.id === current.activeTabId);
      if (!tab || tab.content === html) return;
      historyFor(tab.id, tab.content);
      setTabContent(html);
      markDirty();
      if (historyTimer.current !== null) window.clearTimeout(historyTimer.current);
      historyTimer.current = window.setTimeout(commitHistory, 400);
    },
    [commitHistory, markDirty, setTabContent]
  );

  const travelHistory = useCallback(
    (direction: -1 | 1) => {
      commitHistory();
      const current = docRef.current;
      if (!current || readOnly) return;
      const tab = current.tabs.find((t) => t.id === current.activeTabId);
      if (!tab) return;
      const history = historyFor(tab.id, tab.content);
      const target = history.index + direction;
      if (target < 0 || target >= history.stack.length) return;
      // Al deshacer, el cursor vuelve a donde estaba antes del cambio deshecho
      const caret = direction === -1 ? history.stack[history.index].caret : history.stack[target].caret;
      history.index = target;
      setTabContent(history.stack[target].html);
      markDirty();
      window.setTimeout(() => setCaretOffset(caret), 0);
    },
    [commitHistory, markDirty, readOnly, setTabContent]
  );

  const handleUndo = useCallback(() => travelHistory(-1), [travelHistory]);
  const handleRedo = useCallback(() => travelHistory(1), [travelHistory]);

  // -------------------------------------------------------------------------
  // Abrir, crear y cerrar documentos
  // -------------------------------------------------------------------------

  const loadDocument = useCallback((result: OpenResult, pinned = false) => {
    histories.current = {};
    changeCounter.current = 0;
    savedCounter.current = 0;
    docRef.current = result.document;
    filePathRef.current = result.filePath;
    setDoc(result.document);
    setFilePath(result.filePath);
    setSaveStatus("saved");
    setIsStarred(pinned);
    setShowStartScreen(false);
    setFindReplaceOpen(false);
    setFormat(DEFAULT_FORMAT);
    setPainter(null);
  }, []);

  const reportOpenError = (err: unknown) => {
    console.error("Error al abrir el documento:", err);
    void showMessage(
      "No se pudo abrir el archivo",
      err instanceof Error ? err.message : "El archivo está dañado o su formato no es compatible."
    );
  };

  const handleNewDocument = useCallback(
    async (newTitle?: string) => {
      await flushPendingSave();
      loadDocument({ document: createBlankDocument(newTitle || DEFAULT_TITLE), filePath: null });
    },
    [flushPendingSave, loadDocument]
  );

  const handleOpenDocument = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir documento");
      if (!picked) return;
      await flushPendingSave();
      const result = await importFile(picked);
      loadDocument(result);
      // Los archivos importados (Word, Markdown...) se convierten en un .cfd nuevo
      if (!result.filePath) {
        changeCounter.current += 1;
        await saveNow();
        toast(
          extensionOf(picked.name) === "cfd"
            ? "Documento abierto"
            : `«${picked.name}» se importó como documento de CoffeDoc`
        );
      }
    } catch (err) {
      reportOpenError(err);
    }
  }, [flushPendingSave, loadDocument, saveNow]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flushPendingSave();
        if (isTauri) {
          loadDocument(await openPath(entry.path), entry.is_pinned);
        } else {
          const stored = loadWebDocument(entry.id);
          if (!stored) throw new Error("El documento ya no está en el almacenamiento del navegador.");
          loadDocument({ document: stored, filePath: null }, entry.is_pinned);
        }
      } catch (err) {
        reportOpenError(err);
        void refreshRecents();
      }
    },
    [flushPendingSave, loadDocument, refreshRecents]
  );

  // Arranque: abrir el archivo indicado por el Launcher o mostrar la pantalla de inicio
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          const result = await openPath(args.file);
          loadDocument(result);
          if (!result.filePath) {
            changeCounter.current += 1;
            await saveNow();
          }
          return;
        }
        if (args.docId) {
          const stored = loadWebDocument(args.docId);
          if (stored) {
            loadDocument({ document: stored, filePath: null });
            return;
          }
        }
        if (args.payload) {
          loadDocument({ document: parseCfd(args.payload, DEFAULT_TITLE), filePath: null });
          changeCounter.current += 1;
          await saveNow();
          return;
        }
        if (args.newTitle !== null) {
          loadDocument({ document: createBlankDocument(args.newTitle || DEFAULT_TITLE), filePath: null });
          changeCounter.current += 1;
          await saveNow();
          return;
        }
      } catch (err) {
        reportOpenError(err);
      }

      let entries = await listRecent(APP_ID);
      if (entries.length === 0 && !isTauri) {
        // Recuperar el documento de versiones anteriores de CoffeDoc
        const legacy = await openLast();
        if (legacy) {
          await persistDocument(legacy.document, null);
          entries = await listRecent(APP_ID);
        }
      }
      setRecents(entries);
    })();
  }, [loadDocument, saveNow]);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  // Título de la ventana y guardado al salir
  useEffect(() => {
    void appWindow.setTitle(doc ? `${title || DEFAULT_TITLE} - CoffeDoc` : "CoffeDoc");
  }, [doc, title]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (docRef.current && changeCounter.current !== savedCounter.current) void saveNow();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveNow]);

  // -------------------------------------------------------------------------
  // Acciones del documento
  // -------------------------------------------------------------------------

  const updateDoc = useCallback(
    (mutate: (current: CoffeDocument) => CoffeDocument) => {
      setDoc((prev) => (prev ? mutate(prev) : prev));
      markDirty();
    },
    [markDirty]
  );

  const handleTitleChange = (newTitle: string) =>
    updateDoc((current) => ({ ...current, metadata: { ...current.metadata, title: newTitle } }));

  const handleApplySettings = (settings: PageSettings) =>
    updateDoc((current) => ({ ...current, settings }));

  const handleSaveAs = async () => {
    const current = docRef.current;
    if (!current) return;
    try {
      const path = await saveDocumentAs(current);
      if (path === null) return;
      if (path) {
        filePathRef.current = path;
        setFilePath(path);
        changeCounter.current += 1;
        await saveNow();
        toast("Documento guardado en la nueva ubicación");
      } else {
        toast("Copia descargada");
      }
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar el documento", "error");
    }
  };

  const handleSave = async () => {
    changeCounter.current += 1;
    await saveNow();
    toast("Documento guardado");
  };

  const handlePrint = useCallback(() => {
    commitHistory();
    window.setTimeout(() => window.print(), 50);
  }, [commitHistory]);

  const handleExport = async (exportFormat: ExportFormat) => {
    const current = docRef.current;
    if (!current) return;
    if (exportFormat === "pdf") {
      handlePrint();
      return;
    }
    try {
      const done = await exportDocument(current, exportFormat);
      if (done) toast(`Documento exportado como .${exportFormat}`);
    } catch (err) {
      console.error("Error al exportar:", err);
      toast("No se pudo exportar el documento", "error");
    }
  };

  const handleToggleStar = async () => {
    const current = docRef.current;
    if (!current) return;
    const next = !isStarred;
    setIsStarred(next);
    changeCounter.current += 1;
    await saveNow();
    await setPinned(current.metadata.id, next);
    toast(next ? "Documento fijado en el Launcher" : "Documento desfijado");
  };

  // Pestañas
  const handleSelectTab = (id: string) => {
    commitHistory();
    setDoc((prev) => (prev ? { ...prev, activeTabId: id } : prev));
  };

  const handleAddTab = () =>
    updateDoc((current) => {
      const tab = createTab(`Pestaña ${current.tabs.length + 1}`);
      return { ...current, tabs: [...current.tabs, tab], activeTabId: tab.id };
    });

  const handleRenameTab = async (id: string) => {
    const tab = docRef.current?.tabs.find((t) => t.id === id);
    if (!tab) return;
    const name = await askText({
      title: "Cambiar nombre de la pestaña",
      label: "Nombre",
      defaultValue: tab.name,
      confirmLabel: "Guardar",
    });
    if (!name?.trim()) return;
    updateDoc((current) => ({
      ...current,
      tabs: current.tabs.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)),
    }));
  };

  const handleDuplicateTab = (id: string) =>
    updateDoc((current) => {
      const index = current.tabs.findIndex((t) => t.id === id);
      if (index < 0) return current;
      const copy = createTab(`${current.tabs[index].name} (copia)`, current.tabs[index].content);
      const tabs = [...current.tabs];
      tabs.splice(index + 1, 0, copy);
      return { ...current, tabs, activeTabId: copy.id };
    });

  const handleDeleteTab = async (id: string) => {
    const current = docRef.current;
    const tab = current?.tabs.find((t) => t.id === id);
    if (!current || !tab || current.tabs.length <= 1) return;
    const ok = await askConfirm({
      title: "Eliminar pestaña",
      message: `Se eliminará «${tab.name}» con todo su contenido.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    delete histories.current[id];
    updateDoc((latest) => {
      const tabs = latest.tabs.filter((t) => t.id !== id);
      return {
        ...latest,
        tabs,
        activeTabId: latest.activeTabId === id ? tabs[0].id : latest.activeTabId,
      };
    });
  };

  const handleSelectHeading = (index: number) => {
    const element = headingElements()[index];
    if (!element) return;
    element.scrollIntoView({ block: "start", behavior: "smooth" });
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // Inserciones
  const handleInsertTable = async () => {
    if (readOnly) return;
    const values = await askForm({
      title: "Insertar tabla",
      confirmLabel: "Insertar",
      fields: [
        { name: "rows", label: "Filas", type: "number", defaultValue: "3", min: 1, max: 50 },
        { name: "cols", label: "Columnas", type: "number", defaultValue: "3", min: 1, max: 12 },
        {
          name: "header",
          label: "Primera fila",
          type: "select",
          defaultValue: "yes",
          options: [
            { value: "yes", label: "Fila de encabezado" },
            { value: "no", label: "Fila normal" },
          ],
        },
      ],
    });
    if (!values) return;
    const rows = Math.max(1, Math.min(50, Number(values.rows) || 3));
    const cols = Math.max(1, Math.min(12, Number(values.cols) || 3));
    insertHtml(buildTableHtml(rows, cols, values.header === "yes"));
  };

  const handleInsertLink = async () => {
    if (readOnly) return;
    const existing = currentLink();
    const values = await askForm({
      title: existing ? "Editar enlace" : "Insertar enlace",
      confirmLabel: existing ? "Guardar" : "Insertar",
      fields: [
        {
          name: "text",
          label: "Texto",
          defaultValue: existing?.textContent || selectedText(),
          placeholder: "Texto que se mostrará",
        },
        {
          name: "url",
          label: "Dirección (URL)",
          defaultValue: existing?.getAttribute("href") || "",
          placeholder: "https://ejemplo.com",
        },
      ],
    });
    if (!values || !values.url.trim()) return;
    applyLink(values.url, values.text.trim());
  };

  const handleInsertImageFile = async () => {
    if (readOnly) return;
    const picked = await pickOpenFile(
      [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }],
      "Insertar imagen"
    );
    if (!picked) return;
    const extension = extensionOf(picked.name);
    const mime =
      extension === "svg" ? "image/svg+xml" : extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    insertImage(`data:${mime};base64,${bytesToBase64(picked.bytes)}`, picked.name);
  };

  const handleInsertImageUrl = async () => {
    if (readOnly) return;
    const url = await askText({
      title: "Insertar imagen desde una dirección web",
      label: "Dirección de la imagen (URL)",
      placeholder: "https://ejemplo.com/imagen.png",
      confirmLabel: "Insertar",
    });
    if (url?.trim()) insertImage(url.trim());
  };

  const handleAddComment = async () => {
    if (readOnly) return;
    if (!selectedText().trim()) {
      toast("Selecciona primero el texto que quieres comentar", "info");
      return;
    }
    const comment = await askForm({
      title: "Añadir comentario",
      confirmLabel: "Comentar",
      fields: [{ name: "comment", label: "Comentario", type: "textarea" }],
    });
    if (!comment?.comment.trim()) return;
    if (!addComment(comment.comment.trim())) {
      toast("No se pudo comentar esa selección; prueba con un solo párrafo", "error");
    }
  };

  const handleEditComment = async (mark: HTMLElement) => {
    const values = await askForm({
      title: "Editar comentario",
      confirmLabel: "Guardar",
      fields: [
        { name: "comment", label: "Comentario", type: "textarea", defaultValue: mark.dataset.comment || "" },
      ],
    });
    if (values?.comment.trim()) updateComment(mark, values.comment.trim());
  };

  const handleTogglePainter = () => {
    if (painter) {
      setPainter(null);
      return;
    }
    const captured = captureFormat();
    if (!captured) {
      toast("Coloca el cursor sobre el texto cuyo formato quieres copiar", "info");
      return;
    }
    setPainter(captured);
    toast("Formato copiado: selecciona el texto de destino", "info");
  };

  const handleToggleZen = useCallback(() => {
    setZenMode((prev) => {
      void appWindow.setFullscreen(!prev);
      return !prev;
    });
  }, []);

  const handleSelectionChange = useCallback(() => {
    const state = readFormatState();
    if (state) setFormat(state);
  }, []);

  // -------------------------------------------------------------------------
  // Atajos de teclado
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "Escape") {
        if (zenMode) handleToggleZen();
        if (painter) setPainter(null);
        if (findReplaceOpen) setFindReplaceOpen(false);
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        handleToggleZen();
        return;
      }
      if (e.altKey && e.key === "/") {
        e.preventDefault();
        setCommandSearchOpen(true);
        return;
      }
      if (!mod) return;

      if (e.altKey && ["0", "1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        exec("formatBlock", e.key === "0" ? "<p>" : `<h${e.key}>`);
        return;
      }

      switch (key) {
        case "s":
          e.preventDefault();
          if (e.shiftKey) void handleSaveAs();
          else void handleSave();
          break;
        case "o":
          e.preventDefault();
          void handleOpenDocument();
          break;
        case "n":
          e.preventDefault();
          void handleNewDocument();
          break;
        case "p":
          e.preventDefault();
          handlePrint();
          break;
        case "f":
        case "h":
          e.preventDefault();
          setFindReplaceOpen(true);
          break;
        case "k":
          e.preventDefault();
          void handleInsertLink();
          break;
        case "z":
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          break;
        case "y":
          e.preventDefault();
          handleRedo();
          break;
        case "/":
          e.preventDefault();
          setHelpOpen((prev) => !prev);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // -------------------------------------------------------------------------
  // Menús
  // -------------------------------------------------------------------------

  const menus: MenuDefinition[] = [
    {
      id: "archivo",
      label: "Archivo",
      items: [
        { label: "Nuevo documento", icon: FilePlus, action: () => void handleNewDocument(), shortcut: "Ctrl+N" },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpenDocument(), shortcut: "Ctrl+O" },
        { label: "Pantalla de inicio", icon: FileText, action: () => setShowStartScreen(true) },
        { divider: true },
        { label: "Guardar", icon: Save, action: () => void handleSave(), shortcut: "Ctrl+S" },
        { label: "Guardar como…", icon: SaveAll, action: () => void handleSaveAs(), shortcut: "Ctrl+Mayús+S" },
        { label: "Descargar / Exportar…", icon: Download, action: () => setExportModalOpen(true) },
        { divider: true },
        { label: "Configuración de página…", icon: FileCog, action: () => setPageSetupOpen(true) },
        { label: "Imprimir", icon: Printer, action: handlePrint, shortcut: "Ctrl+P" },
      ],
    },
    {
      id: "editar",
      label: "Editar",
      items: [
        { label: "Deshacer", icon: Undo2, action: handleUndo, shortcut: "Ctrl+Z", disabled: readOnly },
        { label: "Rehacer", icon: Redo2, action: handleRedo, shortcut: "Ctrl+Y", disabled: readOnly },
        { divider: true },
        { label: "Cortar", action: () => exec("cut"), shortcut: "Ctrl+X", disabled: readOnly },
        { label: "Copiar", action: () => exec("copy"), shortcut: "Ctrl+C" },
        { label: "Seleccionar todo", icon: CheckSquare, action: () => exec("selectAll"), shortcut: "Ctrl+A" },
        { divider: true },
        { label: "Buscar y reemplazar", icon: Search, action: () => setFindReplaceOpen(true), shortcut: "Ctrl+F" },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        { label: "Regla", action: () => setShowRuler((prev) => !prev), checked: showRuler },
        { label: "Pestañas y esquema", action: () => setOutlineOpen((prev) => !prev), checked: outlineOpen },
        { divider: true },
        { label: "Acercar", action: () => setZoom((z) => Math.min(200, z + 10)) },
        { label: "Alejar", action: () => setZoom((z) => Math.max(50, z - 10)) },
        { label: "Tamaño real (100%)", action: () => setZoom(100) },
        { divider: true },
        { label: "Pantalla completa", icon: Maximize, action: handleToggleZen, shortcut: "F11", checked: zenMode },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        { label: "Imagen desde un archivo…", icon: ImageIcon, action: () => void handleInsertImageFile(), disabled: readOnly },
        { label: "Imagen desde una dirección web…", action: () => void handleInsertImageUrl(), disabled: readOnly },
        { label: "Tabla…", icon: Table, action: () => void handleInsertTable(), disabled: readOnly },
        { label: "Enlace…", icon: LinkIcon, action: () => void handleInsertLink(), shortcut: "Ctrl+K", disabled: readOnly },
        { label: "Comentario…", icon: MessageSquarePlus, action: () => void handleAddComment(), disabled: readOnly },
        { divider: true },
        { label: "Línea horizontal", icon: Minus, action: () => exec("insertHorizontalRule"), disabled: readOnly },
        {
          label: "Salto de página",
          icon: SeparatorHorizontal,
          action: () => insertHtml('<p class="cfd-page-break" data-page-break="1"><br></p><p><br></p>'),
          disabled: readOnly,
        },
        {
          label: "Fecha de hoy",
          icon: CalendarDays,
          action: () =>
            exec(
              "insertText",
              new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
            ),
          disabled: readOnly,
        },
      ],
    },
    {
      id: "formato",
      label: "Formato",
      items: [
        { label: "Negrita", action: () => exec("bold"), shortcut: "Ctrl+B", checked: format.bold, disabled: readOnly },
        { label: "Cursiva", action: () => exec("italic"), shortcut: "Ctrl+I", checked: format.italic, disabled: readOnly },
        { label: "Subrayado", action: () => exec("underline"), shortcut: "Ctrl+U", checked: format.underline, disabled: readOnly },
        { label: "Tachado", action: () => exec("strikeThrough"), checked: format.strikethrough, disabled: readOnly },
        { label: "Superíndice", action: () => exec("superscript"), disabled: readOnly },
        { label: "Subíndice", action: () => exec("subscript"), disabled: readOnly },
        { divider: true },
        { label: "Texto normal", action: () => exec("formatBlock", "<p>"), shortcut: "Ctrl+Alt+0", disabled: readOnly },
        { label: "Título 1", action: () => exec("formatBlock", "<h1>"), shortcut: "Ctrl+Alt+1", disabled: readOnly },
        { label: "Título 2", action: () => exec("formatBlock", "<h2>"), shortcut: "Ctrl+Alt+2", disabled: readOnly },
        { label: "Título 3", action: () => exec("formatBlock", "<h3>"), shortcut: "Ctrl+Alt+3", disabled: readOnly },
        { divider: true },
        { label: "Alinear a la izquierda", action: () => exec("justifyLeft"), disabled: readOnly },
        { label: "Centrar", action: () => exec("justifyCenter"), disabled: readOnly },
        { label: "Alinear a la derecha", action: () => exec("justifyRight"), disabled: readOnly },
        { label: "Justificar", action: () => exec("justifyFull"), disabled: readOnly },
        { divider: true },
        {
          label: "Borrar formato",
          action: () => {
            exec("removeFormat");
            exec("formatBlock", "<p>");
          },
          disabled: readOnly,
        },
      ],
    },
    {
      id: "herramientas",
      label: "Herramientas",
      items: [
        { label: "Contar palabras", icon: FileText, action: () => setWordCountOpen(true) },
        { label: "Corrector ortográfico", action: () => setSpellcheck((prev) => !prev), checked: spellcheck },
        { label: "Modo de solo lectura", action: () => setReadOnly((prev) => !prev), checked: readOnly },
        { divider: true },
        { label: "Buscar en los menús", icon: Search, action: () => setCommandSearchOpen(true), shortcut: "Alt+/" },
      ],
    },
    {
      id: "ayuda",
      label: "Ayuda",
      items: [
        { label: "Atajos de teclado", icon: Keyboard, action: () => setHelpOpen(true), shortcut: "Ctrl+/" },
        {
          label: "Acerca de CoffeDoc",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeDoc 1.4",
              "Procesador de textos de la suite CoffeWorks.\n\nLos documentos se guardan como archivos .cfd en la carpeta Documentos\\CoffeWorks y se pueden exportar a Word, Markdown, HTML, texto y PDF."
            ),
        },
        { label: "Ayuda", icon: HelpCircle, action: () => setHelpOpen(true) },
      ],
    },
  ];

  const stats = useMemo(() => computeStats(content, pages), [content, pages]);
  const headings = useMemo(() => extractHeadings(content), [content]);

  // Tamaño y márgenes de página para la impresión
  const printCss = useMemo(() => {
    if (!doc) return "";
    const dims = PAGE_DIMENSIONS[doc.settings.pageSize].mm;
    const landscape = doc.settings.orientation === "landscape";
    const marginMm = ((MARGIN_PIXELS[doc.settings.margins] / 96) * 25.4).toFixed(1);
    const size = landscape ? `${dims[1]}mm ${dims[0]}mm` : `${dims[0]}mm ${dims[1]}mm`;
    return `@page { size: ${size}; margin: ${marginMm}mm; }`;
  }, [doc]);

  return (
    <div className="cfd-app flex flex-col h-screen bg-white text-[#1f1f1f] overflow-hidden">
      <style>{printCss}</style>

      {doc && !zenMode && (
        <SuiteHeader
          logo={DocsLogo}
          logoTitle="Pantalla de inicio de CoffeDoc"
          onLogoClick={() => setShowStartScreen(true)}
          title={title}
          titlePlaceholder={DEFAULT_TITLE}
          onTitleChange={handleTitleChange}
          menus={menus}
          saveStatus={saveStatus}
          fileLocation={filePath}
          isStarred={isStarred}
          onToggleStar={() => void handleToggleStar()}
          onBeforeClose={flushPendingSave}
          actions={
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="bg-[#c2e7ff] hover:bg-[#b3dcfa] text-[#001d35] font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
              title="Exportar documento"
            >
              <ArrowUpRight size={15} />
              <span>Exportar</span>
            </button>
          }
        />
      )}

      {doc && !zenMode && (
        <GoogleDocsToolbar
          format={format}
          readOnly={readOnly}
          onSetReadOnly={setReadOnly}
          zoom={zoom}
          onZoomChange={setZoom}
          lineSpacing={doc.settings.lineSpacing}
          onSetLineSpacing={(lineSpacing) => handleApplySettings({ ...doc.settings, lineSpacing })}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPrint={handlePrint}
          spellcheck={spellcheck}
          onToggleSpellcheck={() => setSpellcheck((prev) => !prev)}
          painterActive={painter !== null}
          onTogglePainter={handleTogglePainter}
          onOpenCommandSearch={() => setCommandSearchOpen(true)}
          onInsertLink={() => void handleInsertLink()}
          onInsertImage={() => void handleInsertImageFile()}
          onInsertTable={() => void handleInsertTable()}
          onAddComment={() => void handleAddComment()}
          compact={!showRuler && !outlineOpen}
          onToggleCompact={() => {
            const expand = !showRuler && !outlineOpen;
            setShowRuler(expand);
            setOutlineOpen(expand);
          }}
        />
      )}

      {doc && !zenMode && showRuler && <Ruler zoom={zoom} settings={doc.settings} />}

      {doc && (
        <div className="flex flex-1 overflow-hidden relative">
          {!zenMode && (
            <OutlineSidebar
              isOpen={outlineOpen}
              onClose={() => setOutlineOpen(false)}
              tabs={doc.tabs}
              activeTabId={doc.activeTabId}
              onSelectTab={handleSelectTab}
              onAddTab={handleAddTab}
              onRenameTab={(id) => void handleRenameTab(id)}
              onDuplicateTab={handleDuplicateTab}
              onDeleteTab={(id) => void handleDeleteTab(id)}
              headings={headings}
              onSelectHeading={handleSelectHeading}
            />
          )}

          <DocumentCanvas
            content={content}
            onChange={handleContentChange}
            settings={doc.settings}
            zoom={zoom}
            readOnly={readOnly}
            spellcheck={spellcheck}
            onSelectionChange={handleSelectionChange}
            onPageCount={setPages}
            painterActive={painter !== null}
            onPainterApply={() => {
              if (painter) applyCapturedFormat(painter);
              setPainter(null);
            }}
            onEditLink={() => void handleInsertLink()}
            onEditComment={(mark) => void handleEditComment(mark)}
          />

          {zenMode && (
            <button
              type="button"
              onClick={handleToggleZen}
              className="absolute top-3 right-5 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-[#dadce0] shadow text-xs text-[#444746] hover:bg-white print:hidden"
              title="Salir de pantalla completa (Esc)"
            >
              <X size={13} />
              <span>Salir de pantalla completa</span>
            </button>
          )}
        </div>
      )}

      {doc && !zenMode && (
        <StatusBar
          stats={stats}
          zoom={zoom}
          onZoomChange={setZoom}
          onOpenWordCount={() => setWordCountOpen(true)}
          spellcheck={spellcheck}
          readOnly={readOnly}
        />
      )}

      {/* Vista de impresión: todas las pestañas del documento, una tras otra */}
      {doc && (
        <div className="cfd-print-view">
          {doc.tabs.map((tab) => (
            <div
              key={tab.id}
              className="cfd-content cfd-print-section"
              style={{
                lineHeight: doc.settings.lineSpacing,
                columnCount: doc.settings.columns > 1 ? doc.settings.columns : undefined,
              }}
              dangerouslySetInnerHTML={{ __html: tab.content }}
            />
          ))}
        </div>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={(exportFormat) => void handleExport(exportFormat)}
        documentTitle={title}
      />
      <FindReplaceModal
        isOpen={findReplaceOpen && doc !== null}
        onClose={() => setFindReplaceOpen(false)}
        readOnly={readOnly}
        contentVersion={`${doc?.activeTabId}:${content.length}:${changeCounter.current}`}
      />
      <WordCountModal isOpen={wordCountOpen} onClose={() => setWordCountOpen(false)} stats={stats} />
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      {doc && (
        <PageSetupModal
          isOpen={pageSetupOpen}
          onClose={() => setPageSetupOpen(false)}
          settings={doc.settings}
          onApply={handleApplySettings}
        />
      )}
      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeDoc"
          tagline="Procesador de textos • CoffeWorks"
          accent="#185abd"
          newHint="Crear documento en blanco"
          openHint="Word, Markdown, HTML, texto o .cfd"
          formats={[".cfd", ".docx", ".md", ".html", ".txt"]}
          recents={recents}
          onNew={() => void handleNewDocument()}
          onOpen={() => void handleOpenDocument()}
          onOpenRecent={(entry) => void handleOpenRecent(entry)}
          onContinue={doc ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      <DialogHost />
    </div>
  );
};
