import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  FilePlus,
  FolderOpen,
  SaveAll,
  Printer,
  FileText,
  FileCode,
  BookOpen,
  Search,
  Keyboard,
  Info,
  X,
  FolderPlus,
  FilePlus2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Pen,
  Type,
  Highlighter,
  Eraser,
  Image as ImageIcon,
  Table,
  CalendarClock,
  SquareCheck,
  Trash2,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { ExportModal, type ExportOption } from "./components/ExportModal";
import { DialogHost, askConfirm, askText, showMessage, toast } from "./components/Dialogs";
import { NotebookNav } from "./components/NotebookNav";
import { PageCanvas } from "./components/PageCanvas";
import { SpellIndicator, SpellStyles, useSpellCheck } from "./spell/useSpellCheck";
import { Ribbon, type TagKind } from "./components/Ribbon";
import {
  APP_ID,
  DEFAULT_TITLE,
  EXTENSION,
  IMAGE_FILTERS,
  OPEN_FILTERS,
  ensureExtension,
  openPath,
  openWebEntry,
  persistNotebook,
  rememberOpened,
  type OpenedNotebook,
} from "./services/pageStore";
import {
  fold,
  newId,
  newNotebook,
  newPage,
  newSection,
  pageExtent,
  pageToMarkdown,
  pagesToHtmlDocument,
  parseNotebook,
  searchNotebook,
  serializeNotebook,
  type SearchHit,
} from "./services/notebook";
import {
  appWindow,
  bytesToBase64,
  bytesToText,
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
import { ACCENT, ACCENT_DARK, type Block, type ImageBlock, type InkStyle, type Notebook, type Page, type PaperStyle, type Tool } from "./types";
import { toggleTheme } from "./theme/theme";

const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY = 1200;

const PageLogo = (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <rect x="4" y="3" width="32" height="34" rx="5" fill="#7B1FA2" />
    <rect x="11" y="7" width="21" height="26" rx="2.5" fill="white" />
    <rect x="11" y="7" width="6" height="26" fill="#E1BEE7" />
    {[11, 17, 23, 29].map((y) => (
      <rect key={y} x="7.5" y={y - 1} width="8" height="2.4" rx="1.2" fill="#4A148C" />
    ))}
    <rect x="19.5" y="13" width="9" height="2" rx="1" fill="#CE93D8" />
    <rect x="19.5" y="18" width="10" height="2" rx="1" fill="#CE93D8" />
    <rect x="19.5" y="23" width="7" height="2" rx="1" fill="#CE93D8" />
  </svg>
);

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "print",
    name: "Imprimir o guardar como PDF",
    description: "Imprime la página actual; elige «Microsoft Print to PDF» para crear un PDF.",
    badge: "PDF",
    icon: Printer,
  },
  {
    id: "page-html",
    name: "Página como HTML",
    description: "La página actual con su texto, imágenes y dibujos, lista para abrir en el navegador.",
    badge: "HTML",
    icon: FileCode,
  },
  {
    id: "section-html",
    name: "Sección completa como HTML",
    description: "Todas las páginas de la sección actual en un solo archivo.",
    badge: "HTML",
    icon: BookOpen,
  },
  {
    id: "notebook-html",
    name: "Cuaderno completo como HTML",
    description: "Todas las secciones y páginas del cuaderno.",
    badge: "HTML",
    icon: BookOpen,
  },
  {
    id: "page-md",
    name: "Página como Markdown (.md)",
    description: "Texto, listas y tareas en Markdown.",
    badge: "MD",
    icon: FileText,
  },
];

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

const TAG_HTML: Record<TagKind, string> = {
  todo: '<span class="cp-tag" data-tag="todo" data-checked="false" contenteditable="false"></span>&nbsp;',
  important: '<span class="cp-tag" data-tag="important" contenteditable="false"></span>&nbsp;',
  question: '<span class="cp-tag" data-tag="question" contenteditable="false"></span>&nbsp;',
  idea: '<span class="cp-tag" data-tag="idea" contenteditable="false"></span>&nbsp;',
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
};

const imageSize = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 320, height: img.naturalHeight || 240 });
    img.onerror = () => resolve({ width: 320, height: 240 });
    img.src = src;
  });

interface HistoryState {
  stack: Notebook[];
  index: number;
  lastKey: string;
  lastTime: number;
}

export const App: React.FC = () => {
  // Cuaderno
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const notebookRef = useRef<Notebook | null>(null);
  const history = useRef<HistoryState>({ stack: [], index: 0, lastKey: "", lastTime: 0 });
  const [, setHistoryTick] = useState(0);
  const [sectionId, setSectionId] = useState("");
  const [pageId, setPageId] = useState("");

  // Archivo
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [docId, setDocId] = useState(() => newId("cpg"));
  const [location, setLocation] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<number | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);

  // Interfaz
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [tool, setTool] = useState<Tool>("type");
  const [ink, setInk] = useState<InkStyle>({ penColor: "#1f1f1f", penWidth: 2.5, highlighterColor: "#ffeb3b", highlighterWidth: 16 });
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const startedRef = useRef(false);
  const pendingCommand = useRef<(() => void) | null>(null);
  const savedSelection = useRef<{ editorId: string; range: Range } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loaded = notebook !== null;
  const section = notebook?.sections.find((s) => s.id === sectionId) || notebook?.sections[0] || null;
  const page = section?.pages.find((p) => p.id === pageId) || section?.pages[0] || null;
  // Corrector ortográfico de la página abierta
  const spell = useSpellCheck({ mode: "dom", root: () => scrollRef.current, watch: page?.id });

  const refreshRecents = useCallback(async () => setRecents(await listRecent(APP_ID)), []);

  const reportError = (err: unknown, fallback: string) =>
    void showMessage("Algo salió mal", err instanceof Error ? err.message : String(err || fallback));

  // ---------------------------------------------------------------------------
  // Guardado automático
  // ---------------------------------------------------------------------------

  const stateRef = useRef({ title, docId, location, isStarred });
  stateRef.current = { title, docId, location, isStarred };

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const current = notebookRef.current;
    if (!current) return true;
    if (savingRef.current) await savingRef.current;
    const run = (async () => {
      const { title: t, docId: id, location: loc, isStarred: pinned } = stateRef.current;
      setSaveStatus("saving");
      try {
        let target = loc;
        if (target && isTauri && !target.startsWith("web:")) {
          target = await renameInVault(target, ensureExtension(t || DEFAULT_TITLE), id);
        }
        const saved = await persistNotebook(current, t || DEFAULT_TITLE, id, target, pinned);
        setLocation(saved);
        stateRef.current.location = saved;
        // Si hubo cambios mientras se guardaba, se vuelve a programar
        setSaveStatus(notebookRef.current === current ? "saved" : "dirty");
        return true;
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
        toast(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`, "error");
        return false;
      }
    })();
    savingRef.current = run;
    const result = await run;
    savingRef.current = null;
    return result;
  }, []);

  const scheduleSave = useCallback(() => {
    setSaveStatus("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void saveNow();
    }, AUTOSAVE_DELAY);
  }, [saveNow]);

  // ---------------------------------------------------------------------------
  // Historial
  // ---------------------------------------------------------------------------

  const applyNotebook = useCallback(
    (next: Notebook, key = "") => {
      const h = history.current;
      const now = Date.now();
      if (key && key === h.lastKey && now - h.lastTime < 1500 && h.index === h.stack.length - 1) {
        h.stack[h.index] = next;
      } else {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(next);
        if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
        h.index = h.stack.length - 1;
      }
      h.lastKey = key;
      h.lastTime = now;
      notebookRef.current = next;
      setNotebook(next);
      setHistoryTick((t) => t + 1);
      scheduleSave();
    },
    [scheduleSave]
  );

  const travel = (delta: number) => {
    const h = history.current;
    const target = h.index + delta;
    if (target < 0 || target >= h.stack.length) return;
    h.index = target;
    h.lastKey = "";
    const next = h.stack[target];
    notebookRef.current = next;
    setNotebook(next);
    setHistoryTick((t) => t + 1);
    setSelectedId(null);
    // Si la sección o la página visibles ya no existen, se vuelve a la primera
    const sec = next.sections.find((s) => s.id === sectionId) || next.sections[0];
    setSectionId(sec.id);
    if (!sec.pages.some((p) => p.id === pageId)) setPageId(sec.pages[0].id);
    scheduleSave();
  };
  const handleUndo = () => travel(-1);
  const handleRedo = () => travel(1);

  // ---------------------------------------------------------------------------
  // Abrir, crear y cerrar
  // ---------------------------------------------------------------------------

  const loadNotebook = useCallback(
    async (file: OpenedNotebook, pinned = false) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const nb = file.notebook;
      notebookRef.current = nb;
      history.current = { stack: [nb], index: 0, lastKey: "", lastTime: 0 };
      setNotebook(nb);
      setHistoryTick((t) => t + 1);
      setSectionId(nb.sections[0].id);
      setPageId(nb.sections[0].pages[0].id);
      setTitle(stripExtension(file.name) || DEFAULT_TITLE);
      setDocId(file.docId);
      setLocation(file.location);
      setIsStarred(pinned);
      setSaveStatus("saved");
      setSelectedId(null);
      setSearchQuery("");
      setTool("type");
      setShowStartScreen(false);
      stateRef.current = { title: stripExtension(file.name) || DEFAULT_TITLE, docId: file.docId, location: file.location, isStarred: pinned };
      if (file.location) await rememberOpened(file);
    },
    []
  );

  /** Antes de cambiar de cuaderno se guarda lo pendiente (no hay nada que descartar). */
  const flush = useCallback(async () => {
    if (notebookRef.current && (saveTimer.current || savingRef.current)) await saveNow();
    return true;
  }, [saveNow]);

  const handleNew = useCallback(
    async (newTitle?: string) => {
      await flush();
      const nb = newNotebook();
      await loadNotebook({ name: `${newTitle || DEFAULT_TITLE}.${EXTENSION}`, notebook: nb, location: null, docId: newId("cpg") });
      // Los cuadernos nuevos se guardan enseguida para que aparezcan en el Launcher
      scheduleSave();
    },
    [flush, loadNotebook, scheduleSave]
  );

  const handleOpen = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir cuaderno");
      if (!picked) return;
      await flush();
      const nb = parseNotebook(bytesToText(picked.bytes));
      await loadNotebook({ name: picked.name, notebook: nb, location: picked.path, docId: newId("cpg") });
      if (!picked.path) scheduleSave();
    } catch (err) {
      reportError(err, "No se pudo abrir el cuaderno.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, loadNotebook, scheduleSave]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flush();
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("El cuaderno ya no está en el almacenamiento del navegador.");
        await loadNotebook(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró el cuaderno.");
        void refreshRecents();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, loadNotebook, refreshRecents]
  );

  // Arranque: archivo indicado por el Launcher o por el Explorador de Windows
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          await loadNotebook(await openPath(args.file));
          return;
        }
        if (args.docId) {
          const file = await openWebEntry(args.docId);
          if (file) {
            await loadNotebook(file);
            return;
          }
        }
        if (args.payload) {
          const nb = parseNotebook(args.payload);
          await loadNotebook({ name: `${DEFAULT_TITLE}.${EXTENSION}`, notebook: nb, location: null, docId: newId("cpg") });
          scheduleSave();
          return;
        }
        if (args.newTitle !== null) {
          await handleNew(args.newTitle || DEFAULT_TITLE);
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir el cuaderno.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE} - CoffeePage` : "CoffeePage");
  }, [loaded, title]);

  // Guardar antes de cerrar la pestaña del navegador
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveTimer.current) {
        void saveNow();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveNow]);

  const handleSaveAs = async () => {
    const current = notebookRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(
        ensureExtension(title || DEFAULT_TITLE),
        OPEN_FILTERS,
        serializeNotebook(current),
        "Guardar cuaderno como"
      );
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        setLocation(path);
        setTitle(stripExtension(name));
        stateRef.current = { ...stateRef.current, location: path, title: stripExtension(name) };
        await rememberOpened({ name, notebook: current, location: path, docId });
        setSaveStatus("saved");
        toast("Cuaderno guardado en la nueva ubicación");
      } else {
        toast("Cuaderno descargado");
      }
    } catch (err) {
      reportError(err, "No se pudo guardar.");
    }
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    stateRef.current.isStarred = next;
    if (location) await setPinned(docId, next);
    toast(next ? "Cuaderno fijado en el Launcher" : "Cuaderno desfijado");
  };

  // ---------------------------------------------------------------------------
  // Secciones y páginas
  // ---------------------------------------------------------------------------

  const mapSections = (fn: (sections: Notebook["sections"]) => Notebook["sections"], key = "") => {
    const current = notebookRef.current;
    if (!current) return;
    applyNotebook({ ...current, sections: fn(current.sections) }, key);
  };

  const updatePage = useCallback(
    (next: Page, key = "") => {
      const current = notebookRef.current;
      if (!current) return;
      const stamped = { ...next, updatedAt: Date.now() };
      applyNotebook(
        {
          ...current,
          sections: current.sections.map((s) =>
            s.pages.some((p) => p.id === next.id) ? { ...s, pages: s.pages.map((p) => (p.id === next.id ? stamped : p)) } : s
          ),
        },
        key
      );
    },
    [applyNotebook]
  );

  const goToPage = (secId: string, pgId: string) => {
    setSectionId(secId);
    setPageId(pgId);
    setSelectedId(null);
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  };

  const addSection = async () => {
    const current = notebookRef.current;
    if (!current) return;
    const name = await askText({ title: "Nueva sección", label: "Nombre de la sección", defaultValue: `Sección ${current.sections.length + 1}` });
    if (!name?.trim()) return;
    const sec = newSection(name.trim(), current.sections.length);
    applyNotebook({ ...current, sections: [...current.sections, sec] });
    goToPage(sec.id, sec.pages[0].id);
  };

  const renameSection = async (id: string) => {
    const sec = notebookRef.current?.sections.find((s) => s.id === id);
    if (!sec) return;
    const name = await askText({ title: "Cambiar el nombre de la sección", label: "Nombre", defaultValue: sec.name });
    if (!name?.trim()) return;
    mapSections((list) => list.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)));
  };

  const deleteSection = async (id: string) => {
    const current = notebookRef.current;
    const sec = current?.sections.find((s) => s.id === id);
    if (!current || !sec || current.sections.length <= 1) return;
    const ok = await askConfirm({
      title: "Eliminar la sección",
      message: `Se eliminará «${sec.name}» con sus ${sec.pages.length} páginas. Puedes recuperarla con Deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    const remaining = current.sections.filter((s) => s.id !== id);
    applyNotebook({ ...current, sections: remaining });
    if (id === section?.id) goToPage(remaining[0].id, remaining[0].pages[0].id);
  };

  const moveSection = (id: string, toIndex: number) =>
    mapSections((list) => {
      const from = list.findIndex((s) => s.id === id);
      if (from < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex > from ? toIndex - 1 : toIndex, 0, moved);
      return next;
    });

  const addPage = (afterId?: string, level: 0 | 1 = 0) => {
    if (!section) return;
    const created = newPage("", level, page?.paper || "blank");
    mapSections((list) =>
      list.map((s) => {
        if (s.id !== section.id) return s;
        const index = afterId ? s.pages.findIndex((p) => p.id === afterId) : s.pages.length - 1;
        const pages = [...s.pages];
        pages.splice(index + 1, 0, created);
        return { ...s, pages };
      })
    );
    goToPage(section.id, created.id);
    window.setTimeout(() => document.querySelector<HTMLInputElement>("[data-page-title]")?.focus(), 30);
  };

  const duplicatePage = (id: string) => {
    if (!section) return;
    const original = section.pages.find((p) => p.id === id);
    if (!original) return;
    const copy: Page = {
      ...original,
      id: newId("page"),
      title: original.title ? `${original.title} (copia)` : "",
      createdAt: Date.now(),
      blocks: original.blocks.map((b) => ({ ...b, id: newId("blk") }) as Block),
      strokes: original.strokes.map((s) => ({ ...s, id: newId("ink") })),
    };
    mapSections((list) =>
      list.map((s) => {
        if (s.id !== section.id) return s;
        const pages = [...s.pages];
        pages.splice(pages.findIndex((p) => p.id === id) + 1, 0, copy);
        return { ...s, pages };
      })
    );
    goToPage(section.id, copy.id);
  };

  const deletePage = async (id: string) => {
    if (!section || section.pages.length <= 1) return;
    const target = section.pages.find((p) => p.id === id);
    if (!target) return;
    if (target.blocks.length > 0 || target.strokes.length > 0) {
      const ok = await askConfirm({
        title: "Eliminar la página",
        message: `¿Eliminar «${target.title || "Página sin título"}»? Puedes recuperarla con Deshacer.`,
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!ok) return;
    }
    const index = section.pages.findIndex((p) => p.id === id);
    const remaining = section.pages.filter((p) => p.id !== id);
    mapSections((list) => list.map((s) => (s.id === section.id ? { ...s, pages: remaining } : s)));
    if (id === page?.id) goToPage(section.id, remaining[Math.max(0, index - 1)].id);
  };

  const setPageLevel = (id: string, level: 0 | 1) =>
    mapSections((list) => list.map((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? { ...p, level } : p)) })));

  const movePage = (id: string, toIndex: number) => {
    if (!section) return;
    mapSections((list) =>
      list.map((s) => {
        if (s.id !== section.id) return s;
        const from = s.pages.findIndex((p) => p.id === id);
        if (from < 0) return s;
        const pages = [...s.pages];
        const [moved] = pages.splice(from, 1);
        pages.splice(toIndex > from ? toIndex - 1 : toIndex, 0, moved);
        if (pages[0].level === 1) pages[0] = { ...pages[0], level: 0 };
        return { ...s, pages };
      })
    );
  };

  const movePageToSection = (id: string, targetSectionId: string) => {
    const current = notebookRef.current;
    if (!current) return;
    const from = current.sections.find((s) => s.pages.some((p) => p.id === id));
    if (!from || from.id === targetSectionId) return;
    if (from.pages.length <= 1) {
      toast("Una sección necesita al menos una página", "info");
      return;
    }
    const moving = { ...from.pages.find((p) => p.id === id)!, level: 0 as const };
    applyNotebook({
      ...current,
      sections: current.sections.map((s) => {
        if (s.id === from.id) return { ...s, pages: s.pages.filter((p) => p.id !== id) };
        if (s.id === targetSectionId) return { ...s, pages: [...s.pages, moving] };
        return s;
      }),
    });
    const target = current.sections.find((s) => s.id === targetSectionId);
    toast(`Página movida a «${target?.name}»`);
    if (id === page?.id) goToPage(targetSectionId, id);
  };

  // ---------------------------------------------------------------------------
  // Edición de texto
  // ---------------------------------------------------------------------------

  // Se recuerda la última selección dentro de una nota para que los menús
  // desplegables (fuente, tamaño) puedan aplicar formato aunque roben el foco.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode;
      const editor = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>("[data-editor]");
      if (editor?.dataset.editor) savedSelection.current = { editorId: editor.dataset.editor, range: sel.getRangeAt(0).cloneRange() };
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  /** Ejecuta `fn` con una nota enfocada; si no hay ninguna, crea una nueva. */
  const withEditor = (fn: (editor: HTMLElement) => void) => {
    const active = document.activeElement as HTMLElement | null;
    if (active?.dataset.editor) {
      fn(active);
      return;
    }
    // La selección guardada solo vale si el foco lo tomó un control de la cinta
    // (fuente, tamaño); si el usuario salió de la nota, se crea una nueva.
    const saved = active?.closest("[data-ribbon]") ? savedSelection.current : null;
    const editor = saved ? document.querySelector<HTMLElement>(`[data-editor="${saved.editorId}"]`) : null;
    if (saved && editor) {
      editor.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved.range);
      fn(editor);
      return;
    }
    if (!page) return;
    const { height } = pageExtent(page);
    const block: Block = { id: newId("blk"), kind: "text", x: 48, y: page.blocks.length ? height + 32 : 24, width: 560, html: "" };
    pendingCommand.current = () => {
      const el = document.querySelector<HTMLElement>(`[data-editor="${block.id}"]`);
      if (el) fn(el);
    };
    updatePage({ ...page, blocks: [...page.blocks, block] }, `create-${block.id}`);
    setAutoFocusId(block.id);
  };

  const notifyInput = (editor: HTMLElement) => editor.dispatchEvent(new Event("input", { bubbles: true }));

  const exec = (command: string, value?: string) =>
    withEditor((editor) => {
      document.execCommand("styleWithCSS", false, command === "hiliteColor" || command === "foreColor" ? "true" : "false");
      document.execCommand(command, false, value);
      notifyInput(editor);
    });

  const setFontSize = (px: number) =>
    withEditor((editor) => {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("fontSize", false, "7");
      editor.querySelectorAll('font[size="7"]').forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = `${px}px`;
        span.innerHTML = font.innerHTML;
        font.replaceWith(span);
      });
      notifyInput(editor);
    });

  const insertHtml = (html: string) =>
    withEditor((editor) => {
      document.execCommand("insertHTML", false, html);
      notifyInput(editor);
    });

  const insertTag = (tag: TagKind) => insertHtml(TAG_HTML[tag]);

  const insertTable = () =>
    insertHtml(
      `<table><tbody>${Array.from({ length: 3 }, () => `<tr>${Array.from({ length: 3 }, () => "<td>&nbsp;</td>").join("")}</tr>`).join("")}</tbody></table><p><br></p>`
    );

  const insertDate = () => {
    const now = new Date();
    insertHtml(
      `${now.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}, ${now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}&nbsp;`
    );
  };

  const insertLink = async () => {
    const sel = window.getSelection();
    const selectedText = sel && !sel.isCollapsed ? sel.toString() : "";
    const saved = savedSelection.current;
    const active = document.activeElement as HTMLElement | null;
    const editorId = active?.dataset.editor || null;
    const url = await askText({ title: "Insertar vínculo", label: "Dirección (URL)", defaultValue: "https://" });
    if (!url || url === "https://") return;
    const safe = url.replace(/"/g, "%22");
    const text = (selectedText || url).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    const html = `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>&nbsp;`;
    // El diálogo se llevó el foco: se vuelve a la nota y a la selección de antes
    const editor = editorId ? document.querySelector<HTMLElement>(`[data-editor="${editorId}"]`) : null;
    if (editor && saved && saved.editorId === editorId) {
      editor.focus();
      const sel2 = window.getSelection();
      sel2?.removeAllRanges();
      sel2?.addRange(saved.range);
      document.execCommand("insertHTML", false, html);
      notifyInput(editor);
      return;
    }
    insertHtml(html);
  };

  const placeImage = useCallback(
    async (src: string, x?: number, y?: number) => {
      if (!page) return;
      const natural = await imageSize(src);
      const width = Math.min(natural.width, 640);
      const height = Math.round((natural.height / natural.width) * width);
      const { height: extentHeight } = pageExtent(page);
      const block: ImageBlock = {
        id: newId("blk"),
        kind: "image",
        x: Math.round(x ?? 48),
        y: Math.round(y ?? (page.blocks.length ? extentHeight + 32 : 24)),
        width,
        height,
        src,
      };
      updatePage({ ...page, blocks: [...page.blocks, block] });
      setSelectedId(block.id);
      setTool((t) => (t === "type" || t === "select" ? t : "select"));
    },
    [page, updatePage]
  );

  const handleInsertImage = async () => {
    try {
      const picked = await pickOpenFile(IMAGE_FILTERS, "Insertar imagen");
      if (!picked) return;
      const mime = MIME[extensionOf(picked.name)] || "image/png";
      await placeImage(`data:${mime};base64,${bytesToBase64(picked.bytes)}`);
    } catch (err) {
      reportError(err, "No se pudo insertar la imagen.");
    }
  };

  const handleInsertFile = async () => {
    try {
      const picked = await pickOpenFile([{ name: "Texto", extensions: ["txt", "md", "csv", "log"] }], "Insertar texto de un archivo");
      if (!picked) return;
      const text = bytesToText(picked.bytes);
      const escaped = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
      insertHtml(`<p><b>${picked.name}</b></p>${escaped.split(/\r?\n/).map((line) => `<div>${line || "<br>"}</div>`).join("")}`);
    } catch (err) {
      reportError(err, "No se pudo leer el archivo.");
    }
  };

  const deleteSelected = () => {
    if (!page || !selectedId) return;
    updatePage({ ...page, blocks: page.blocks.filter((b) => b.id !== selectedId) });
    setSelectedId(null);
  };

  // ---------------------------------------------------------------------------
  // Búsqueda
  // ---------------------------------------------------------------------------

  const hits: SearchHit[] = useMemo(
    () => (notebook && searchOpen && searchQuery.trim() ? searchNotebook(notebook, searchQuery) : []),
    [notebook, searchOpen, searchQuery]
  );

  // Resalta las coincidencias en la página visible (CSS Custom Highlight API)
  useEffect(() => {
    const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightCtor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!registry || !HighlightCtor) return;
    registry.delete("cp-search");
    const needle = fold(searchQuery.trim());
    if (!searchOpen || !needle) return;
    const timer = window.setTimeout(() => {
      const ranges: Range[] = [];
      document.querySelectorAll<HTMLElement>("[data-editor]").forEach((editor) => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = fold(node.textContent || "");
          let at = text.indexOf(needle);
          while (at >= 0) {
            const range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, Math.min(at + needle.length, (node.textContent || "").length));
            ranges.push(range);
            at = text.indexOf(needle, at + needle.length);
          }
        }
      });
      if (ranges.length) registry.set("cp-search", new HighlightCtor(...ranges));
      ranges[0]?.startContainer.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [searchOpen, searchQuery, pageId, notebook]);

  const openSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.select(), 20);
  };

  // ---------------------------------------------------------------------------
  // Exportar e imprimir
  // ---------------------------------------------------------------------------

  const printPages = (pages: Page[]) => {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(pagesToHtmlDocument(title || DEFAULT_TITLE, pages));
    doc.close();
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1500);
    }, 250);
  };

  const handleExport = async (id: string) => {
    setExportOpen(false);
    const current = notebookRef.current;
    if (!current || !page || !section) return;
    const base = title || DEFAULT_TITLE;
    try {
      let result: string | null = null;
      if (id === "print") {
        printPages([page]);
        return;
      }
      if (id === "page-html") {
        result = await saveFileAs(`${page.title || base}.html`, [{ name: "Página web", extensions: ["html"] }], pagesToHtmlDocument(page.title || base, [page]), "Exportar página");
      } else if (id === "section-html") {
        result = await saveFileAs(`${section.name}.html`, [{ name: "Página web", extensions: ["html"] }], pagesToHtmlDocument(section.name, section.pages), "Exportar sección");
      } else if (id === "notebook-html") {
        const pages = current.sections.flatMap((s) => s.pages.map((p) => ({ ...p, title: `${s.name} › ${p.title || "Página sin título"}` })));
        result = await saveFileAs(`${base}.html`, [{ name: "Página web", extensions: ["html"] }], pagesToHtmlDocument(base, pages), "Exportar cuaderno");
      } else if (id === "page-md") {
        result = await saveFileAs(`${page.title || base}.md`, [{ name: "Markdown", extensions: ["md"] }], pageToMarkdown(page), "Exportar como Markdown");
      }
      if (result !== null) toast(result ? "Exportado correctamente" : "Archivo descargado");
    } catch (err) {
      reportError(err, "No se pudo exportar.");
    }
  };

  // ---------------------------------------------------------------------------
  // Atajos de teclado
  // ---------------------------------------------------------------------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!loaded || showStartScreen) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const typing = isTypingTarget(e.target);
    const key = e.key.toLowerCase();
    if (e.altKey && key === "/") {
      e.preventDefault();
      setCommandSearchOpen(true);
      return;
    }
    if (ctrl && key === "s") {
      e.preventDefault();
      if (e.shiftKey) void handleSaveAs();
      else void saveNow().then((ok) => ok && toast("Cuaderno guardado"));
      return;
    }
    if (ctrl && key === "f") {
      e.preventDefault();
      openSearch();
      return;
    }
    if (ctrl && key === "p") {
      e.preventDefault();
      if (page) printPages([page]);
      return;
    }
    if (ctrl && key === "n") {
      e.preventDefault();
      if (e.shiftKey) void addSection();
      else addPage(page?.id);
      return;
    }
    if (ctrl && ["1", "2", "3", "4"].includes(key)) {
      e.preventDefault();
      insertTag((["todo", "important", "question", "idea"] as TagKind[])[Number(key) - 1]);
      return;
    }
    if (ctrl && (key === "=" || key === "+")) {
      e.preventDefault();
      setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10));
      return;
    }
    if (ctrl && key === "-") {
      e.preventDefault();
      setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10));
      return;
    }
    if (ctrl && key === "0") {
      e.preventDefault();
      setZoom(1);
      return;
    }
    if (typing) return; // dentro de una nota, deshacer y suprimir son del texto
    if (ctrl && key === "z") {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }
    if (ctrl && key === "y") {
      e.preventDefault();
      handleRedo();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (e.key === "Escape") {
      setSelectedId(null);
      if (tool !== "type") setTool("type");
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Menús
  // ---------------------------------------------------------------------------

  const canUndo = history.current.index > 0;
  const canRedo = history.current.index < history.current.stack.length - 1;

  const menus: MenuDefinition[] = [
    {
      id: "file",
      label: "Archivo",
      items: [
        { label: "Nuevo cuaderno", icon: FilePlus, action: () => void handleNew() },
        { label: "Abrir cuaderno…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void handleOpen() },
        { divider: true },
        { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void handleSaveAs() },
        { label: "Exportar…", icon: ArrowUpRight, action: () => setExportOpen(true) },
        { label: "Imprimir la página", icon: Printer, shortcut: "Ctrl+P", action: () => page && printPages([page]) },
        { divider: true },
        { label: "Pantalla de inicio", icon: BookOpen, action: () => setShowStartScreen(true) },
      ],
    },
    {
      id: "edit",
      label: "Editar",
      items: [
        { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: handleUndo, disabled: !canUndo },
        { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Y", action: handleRedo, disabled: !canRedo },
        { divider: true },
        { label: "Buscar en el cuaderno", icon: Search, shortcut: "Ctrl+F", action: openSearch },
        { label: "Eliminar el elemento seleccionado", icon: Trash2, shortcut: "Supr", action: deleteSelected, disabled: !selectedId },
      ],
    },
    {
      id: "notebook",
      label: "Cuaderno",
      items: [
        { label: "Nueva página", icon: FilePlus2, shortcut: "Ctrl+N", action: () => addPage(page?.id) },
        { label: "Nueva subpágina", icon: FilePlus2, action: () => addPage(page?.id, 1) },
        { label: "Nueva sección", icon: FolderPlus, shortcut: "Ctrl+Mayús+N", action: () => void addSection() },
        { divider: true },
        { label: "Duplicar la página", action: () => page && duplicatePage(page.id) },
        { label: "Eliminar la página", icon: Trash2, action: () => page && void deletePage(page.id), disabled: (section?.pages.length || 0) <= 1 },
      ],
    },
    {
      id: "insert",
      label: "Insertar",
      items: [
        { label: "Imagen…", icon: ImageIcon, action: () => void handleInsertImage() },
        { label: "Tabla", icon: Table, action: insertTable },
        { label: "Fecha y hora", icon: CalendarClock, action: insertDate },
        { label: "Tarea pendiente", icon: SquareCheck, shortcut: "Ctrl+1", action: () => insertTag("todo") },
        { label: "Vínculo…", action: () => void insertLink() },
      ],
    },
    {
      id: "draw",
      label: "Dibujar",
      items: [
        { label: "Escribir", icon: Type, checked: tool === "type", action: () => setTool("type") },
        { label: "Bolígrafo", icon: Pen, checked: tool === "pen", action: () => setTool("pen") },
        { label: "Marcador", icon: Highlighter, checked: tool === "highlighter", action: () => setTool("highlighter") },
        { label: "Borrador", icon: Eraser, checked: tool === "eraser", action: () => setTool("eraser") },
        { divider: true },
        {
          label: "Borrar todos los dibujos de la página",
          icon: Trash2,
          disabled: !page?.strokes.length,
          action: () => page && updatePage({ ...page, strokes: [] }),
        },
      ],
    },
    {
      id: "view",
      label: "Ver",
      items: [
        { label: "Modo oscuro / claro", action: () => void toggleTheme() },
        { label: "Acercar", icon: ZoomIn, shortcut: "Ctrl++", action: () => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10)) },
        { label: "Alejar", icon: ZoomOut, shortcut: "Ctrl+-", action: () => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10)) },
        { label: "Tamaño real", shortcut: "Ctrl+0", action: () => setZoom(1) },
        { divider: true },
        ...(["blank", "lines", "grid"] as PaperStyle[]).map((paper) => ({
          label: paper === "blank" ? "Papel liso" : paper === "lines" ? "Papel rayado" : "Papel cuadriculado",
          checked: page?.paper === paper,
          action: () => page && updatePage({ ...page, paper }),
        })),
      ],
    },
    {
      id: "help",
      label: "Ayuda",
      items: [
        {
          label: "Atajos de teclado",
          icon: Keyboard,
          action: () =>
            void showMessage(
              "Atajos de teclado",
              [
                "Clic en la página: nueva nota en ese punto",
                "Ctrl+N nueva página · Ctrl+Mayús+N nueva sección",
                "Ctrl+B / I / U negrita, cursiva, subrayado · Tab / Mayús+Tab sangría",
                "Ctrl+1 tarea · Ctrl+2 importante · Ctrl+3 pregunta · Ctrl+4 idea",
                "Ctrl+F buscar en todo el cuaderno · Alt+/ buscar un comando",
                "Ctrl+Z / Ctrl+Y deshacer y rehacer · Supr eliminar la imagen o nota seleccionada",
                "Ctrl+ +/− zoom · Ctrl+0 tamaño real · Ctrl+P imprimir",
                "El cuaderno se guarda solo mientras escribes.",
              ].join("\n")
            ),
        },
        {
          label: "Acerca de CoffeePage",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeePage 1.0",
              "Cuaderno digital de la suite CoffeeWorks.\n\nOrganiza tus notas en secciones y páginas, escribe en cualquier parte de la página, dibuja a mano, pega imágenes, marca tareas y busca en todo el cuaderno. Todo se guarda automáticamente en un archivo .cpg."
            ),
        },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // Interfaz
  // ---------------------------------------------------------------------------

  const totalPages = notebook?.sections.reduce((sum, s) => sum + s.pages.length, 0) || 0;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {loaded && notebook && section && page && (
        <>
          <SuiteHeader
            logo={PageLogo}
            logoTitle="Pantalla de inicio de CoffeePage"
            onLogoClick={() => setShowStartScreen(true)}
            title={title}
            titlePlaceholder={DEFAULT_TITLE}
            onTitleChange={(next) => {
              setTitle(next);
              stateRef.current.title = next;
              scheduleSave();
            }}
            menus={menus}
            saveStatus={saveStatus}
            fileLocation={location && !location.startsWith("web:") ? location : null}
            isStarred={isStarred}
            onToggleStar={() => void handleToggleStar()}
            onBeforeClose={async () => {
              await flush();
            }}
            actions={
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="text-white font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all hover:opacity-90"
                style={{ background: ACCENT }}
                title="Exportar o imprimir"
              >
                <ArrowUpRight size={15} />
                <span>Exportar</span>
              </button>
            }
          />

          <Ribbon
            accent={ACCENT}
            tool={tool}
            onToolChange={(next) => {
              setTool(next);
              setSelectedId(null);
            }}
            ink={ink}
            onInkChange={(patch) => setInk((prev) => ({ ...prev, ...patch }))}
            paper={page.paper}
            onPaperChange={(paper) => updatePage({ ...page, paper })}
            zoom={zoom}
            onZoom={setZoom}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onExec={exec}
            onFontSize={setFontSize}
            onBlockStyle={(tag) => exec("formatBlock", tag)}
            onTag={insertTag}
            onInsertImage={() => void handleInsertImage()}
            onInsertFile={() => void handleInsertFile()}
            onInsertTable={insertTable}
            onInsertDate={insertDate}
            onInsertLink={() => void insertLink()}
            onOpenSearch={openSearch}
            onOpenCommands={() => setCommandSearchOpen(true)}
          />

          <div className="flex-1 flex overflow-hidden">
            <NotebookNav
              sections={notebook.sections}
              sectionId={section.id}
              pageId={page.id}
              accent={ACCENT}
              onSelectSection={(id) => {
                const sec = notebook.sections.find((s) => s.id === id);
                if (sec) goToPage(sec.id, sec.pages[0].id);
              }}
              onSelectPage={(id) => goToPage(section.id, id)}
              onAddSection={() => void addSection()}
              onRenameSection={(id) => void renameSection(id)}
              onRecolorSection={(id, color) => mapSections((list) => list.map((s) => (s.id === id ? { ...s, color } : s)))}
              onDeleteSection={(id) => void deleteSection(id)}
              onMoveSection={moveSection}
              onAddPage={addPage}
              onDuplicatePage={duplicatePage}
              onDeletePage={(id) => void deletePage(id)}
              onSetPageLevel={setPageLevel}
              onMovePage={movePage}
              onMovePageToSection={movePageToSection}
            />

            <main ref={scrollRef} className="flex-1 overflow-auto bg-white relative select-text">
              <PageCanvas
                key={page.id}
                page={page}
                tool={tool}
                ink={ink}
                zoom={zoom}
                accent={ACCENT}
                selectedId={selectedId}
                autoFocusId={autoFocusId}
                onSelect={setSelectedId}
                onChange={updatePage}
                onTitleChange={(next) => updatePage({ ...page, title: next }, `title-${page.id}`)}
                onCreateBlock={setAutoFocusId}
                onEditorFocused={(id) => {
                  if (id === autoFocusId) setAutoFocusId(null);
                  const pending = pendingCommand.current;
                  if (pending) {
                    pendingCommand.current = null;
                    window.setTimeout(pending, 0);
                  }
                }}
                onPasteImage={(src, x, y) => void placeImage(src, x, y)}
              />
            </main>

            {searchOpen && (
              <aside className="w-72 shrink-0 border-l border-[#e8e0ee] bg-[#fcfafd] flex flex-col">
                <div className="h-10 px-3 flex items-center justify-between border-b border-[#ece4f1]">
                  <span className="text-[13px] font-semibold text-[#1f1f1f]">Buscar en el cuaderno</span>
                  <button
                    type="button"
                    title="Cerrar"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="p-1 rounded hover:bg-[#efe3f5] text-[#5f6368]"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 border border-[#ddd3e4] rounded-lg px-2.5 py-1.5 bg-white focus-within:border-[#7b1fa2]">
                    <Search size={14} className="text-[#7a7a7a]" />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && hits[0]) goToPage(hits[0].sectionId, hits[0].pageId);
                        if (e.key === "Escape") setSearchOpen(false);
                      }}
                      placeholder="Palabras a buscar"
                      className="flex-1 text-[13px] outline-none bg-transparent"
                    />
                  </div>
                  <div className="text-[11px] text-[#7a7a7a] mt-2">
                    {searchQuery.trim()
                      ? `${hits.length} ${hits.length === 1 ? "página coincide" : "páginas coinciden"}`
                      : `Busca en ${totalPages} páginas de ${notebook.sections.length} secciones`}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-3">
                  {hits.map((hit) => (
                    <button
                      key={hit.pageId}
                      type="button"
                      onClick={() => goToPage(hit.sectionId, hit.pageId)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg mb-1 hover:bg-[#f3e5f5] ${hit.pageId === page.id ? "bg-[#f3e5f5]" : ""}`}
                    >
                      <div className="text-[13px] font-semibold text-[#1f1f1f] truncate">{hit.pageTitle}</div>
                      <div className="text-[11px] text-[#7b1fa2] truncate">{hit.sectionName}</div>
                      <div className="text-[12px] text-[#5f5f5f] line-clamp-2 mt-0.5">{hit.snippet}</div>
                    </button>
                  ))}
                </div>
              </aside>
            )}
          </div>

          <footer
            className="h-7 px-3 flex items-center justify-between text-[11px] font-mono select-none text-white shrink-0"
            style={{ background: ACCENT }}
          >
            <span>
              {section.name} · Página {section.pages.findIndex((p) => p.id === page.id) + 1} de {section.pages.length} · {page.blocks.length}{" "}
              {page.blocks.length === 1 ? "elemento" : "elementos"}
              {page.strokes.length > 0 ? ` · ${page.strokes.length} trazos` : ""}
            </span>
            <span className="flex items-center gap-3 min-w-0">
            <SpellIndicator spell={spell} tone="dark" className="font-sans shrink-0" />
            <span className="truncate" title={location || undefined}>
              {location && !location.startsWith("web:") ? location : isTauri ? "Sin guardar en disco" : "Guardado en el navegador"}
            </span>
            </span>
          </footer>
        </>
      )}

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Exportar"
        fileTitle={page?.title || title || DEFAULT_TITLE}
        options={EXPORT_OPTIONS}
        onExport={(id) => void handleExport(id)}
      />
      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeePage"
          tagline="Cuaderno digital • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Crear un cuaderno nuevo"
          openHint="Abrir un cuaderno .cpg"
          formats={[`.${EXTENSION}`]}
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
