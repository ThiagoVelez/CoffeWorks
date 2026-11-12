import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Play,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  Download,
  Printer,
  Undo2,
  Redo2,
  FileText,
  Presentation as PresentationIcon,
  Globe,
  Search,
  Keyboard,
  Info,
  Scissors,
  Copy,
  ClipboardPaste,
  Trash2,
  Image as ImageIcon,
  Type,
  Table,
  Plus,
  EyeOff,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { GoogleSlidesToolbar } from "./components/GoogleSlidesToolbar";
import { SlideThumbnails } from "./components/SlideThumbnails";
import { SlideCanvas } from "./components/SlideCanvas";
import { SlideView } from "./components/SlideView";
import { SidePanel, type TransformKind } from "./components/SidePanel";
import { SpeakerNotes } from "./components/SpeakerNotes";
import { SpellIndicator, SpellStyles, useSpellCheck, type SpellSegment } from "./spell/useSpellCheck";
import { PresentationMode } from "./components/PresentationMode";
import { ExportModal, type ExportOption } from "./components/ExportModal";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askConfirm, askForm, showMessage, toast } from "./components/Dialogs";
import {
  APP_ID,
  DEFAULT_TITLE,
  OPEN_FILTERS,
  SLIDE_THEMES,
  createBlankPresentation,
  createSlide,
  elementsForLayout,
  exportPresentation,
  importFile,
  isDarkColor,
  loadLegacyPresentation,
  loadWebPresentation,
  newId,
  openPath,
  parseCsl,
  persistPresentation,
  savePresentationAs,
  themeById,
  type OpenResult,
} from "./services/presentationVault";
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
import type {
  ExportFormat,
  Presentation,
  ShapeType,
  Slide,
  SlideElement,
  SlideLayout,
  SlideTransition,
} from "./types";
import { SLIDE_SIZE, TEXT_TYPES } from "./types";

const HISTORY_LIMIT = 100;

const SlidesLogo = (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <path
      d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
      fill="#F4B400"
    />
    <path d="M24 4V13H33L24 4Z" fill="#FADA80" />
    <path d="M12 18H28V29H12V18ZM14 20V27H26V20H14Z" fill="white" />
  </svg>
);

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "pptx",
    name: "Microsoft PowerPoint (.pptx)",
    description: "Diapositivas con textos, formas, imágenes, tablas, fondos y notas del orador.",
    badge: "PowerPoint",
    icon: PresentationIcon,
  },
  {
    id: "csl",
    name: "Presentación de CoffeeView (.csl)",
    description: "Copia completa de la presentación, con transiciones, intervalos y biblioteca de imágenes.",
    badge: "Nativo",
    icon: FileText,
  },
  {
    id: "html",
    name: "Página web (.html)",
    description: "Archivo autónomo que se abre en cualquier navegador y se recorre con las flechas.",
    badge: "Web",
    icon: Globe,
  },
  {
    id: "pdf",
    name: "Imprimir / Guardar como PDF",
    description: "Una diapositiva por página; elige «Guardar como PDF» como impresora.",
    badge: "PDF",
    icon: Printer,
  },
];

const IMAGE_FILTERS = [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] }];
const VIDEO_FILTERS = [{ name: "Vídeos", extensions: ["mp4", "webm", "ogg"] }];
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const mimeOf = (name: string) => {
  const extension = extensionOf(name);
  if (extension === "svg") return "image/svg+xml";
  if (extension === "jpg") return "image/jpeg";
  if (["mp4", "webm", "ogg"].includes(extension)) return `video/${extension}`;
  return `image/${extension}`;
};

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
};

const STYLE_KEYS: Array<keyof SlideElement> = [
  "fontSize", "fontFamily", "fontWeight", "fontStyle", "underline", "align", "valign", "color", "bg", "borderColor", "borderWidth",
];

export const App: React.FC = () => {
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [isStarred, setIsStarred] = useState(false);

  const [activeSlideId, setActiveSlideId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<SlideElement | null>(null);
  const [painter, setPainter] = useState<Partial<SlideElement> | null>(null);

  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [showGrid, setShowGrid] = useState(false);
  const [notesVisible, setNotesVisible] = useState(true);
  const [stripVisible, setStripVisible] = useState(true);
  const [gridView, setGridView] = useState(false);
  const [presentingFrom, setPresentingFrom] = useState<string | null>(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const presentationRef = useRef<Presentation | null>(null);
  const filePathRef = useRef<string | null>(null);
  const changeCounter = useRef(0);
  const savedCounter = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const history = useRef<{ stack: Slide[][]; index: number; lastKey: string; lastTime: number }>({
    stack: [],
    index: -1,
    lastKey: "",
    lastTime: 0,
  });
  const startedRef = useRef(false);

  presentationRef.current = presentation;
  filePathRef.current = filePath;

  const slides = presentation?.slides || [];
  const activeSlide = slides.find((slide) => slide.id === activeSlideId) || slides[0];

  // -------------------------------------------------------------------------
  // Corrector ortográfico: textos, tablas y notas de todas las diapositivas
  // -------------------------------------------------------------------------

  const spellSegments: SpellSegment[] = slides.flatMap((slide, i) => [
    ...slide.elements.flatMap((el) =>
      el.type === "table"
        ? (el.rows || []).flatMap((row, r) => row.map((cell, c) => ({ key: `${el.id}#${r}.${c}`, text: cell, label: `Diapositiva ${i + 1}` })))
        : el.type === "image" || el.type === "video" || el.type === "line"
          ? []
          : [{ key: el.id, text: el.content, label: `Diapositiva ${i + 1}` }]
    ),
    ...(slide.notes ? [{ key: `notes:${slide.id}`, text: slide.notes, label: `Notas de la diapositiva ${i + 1}` }] : []),
  ]);

  const findSpellTarget = (key: string) => {
    if (key.startsWith("notes:")) return { slide: slides.find((s) => s.id === key.slice(6)), element: null as SlideElement | null, cell: null as [number, number] | null };
    const [elId, cellPart] = key.split("#");
    const slide = slides.find((s) => s.elements.some((el) => el.id === elId));
    const element = slide?.elements.find((el) => el.id === elId) || null;
    const cell = cellPart ? (cellPart.split(".").map(Number) as [number, number]) : null;
    return { slide, element, cell };
  };

  const spell = useSpellCheck({
    mode: "model",
    segments: spellSegments,
    onReveal: (err) => {
      const { slide, element } = findSpellTarget(err.key);
      if (!slide) return;
      setGridView(false);
      setActiveSlideId(slide.id);
      setEditingId(null);
      if (element) setSelectedId(element.id);
      else {
        setNotesVisible(true);
        window.setTimeout(() => {
          const notes = document.getElementById("speaker-notes") as HTMLTextAreaElement | null;
          notes?.focus();
          notes?.setSelectionRange(err.start, err.end);
        }, 60);
      }
    },
    onReplace: (err, replacement) => {
      const current = presentationRef.current;
      const { slide, element, cell } = findSpellTarget(err.key);
      if (!current || !slide) return;
      const fix = (text: string) => text.slice(0, err.start) + replacement + text.slice(err.end);
      applySlides(
        current.slides.map((s) => {
          if (s.id !== slide.id) return s;
          if (!element) return { ...s, notes: fix(s.notes) };
          return {
            ...s,
            elements: s.elements.map((el) => {
              if (el.id !== element.id) return el;
              if (cell && el.rows) return { ...el, rows: el.rows.map((row, r) => (r === cell[0] ? row.map((v, c) => (c === cell[1] ? fix(v) : v)) : row)) };
              return { ...el, content: fix(el.content) };
            }),
          };
        })
      );
    },
  });
  const activeIndex = activeSlide ? slides.indexOf(activeSlide) : 0;
  const selected = activeSlide?.elements.find((el) => el.id === selectedId) || null;
  const theme = themeById(presentation?.metadata.themeId || "theme_light");
  const aspectRatio = presentation?.metadata.aspectRatio || "16:9";
  const title = presentation?.metadata.title ?? "";

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
    if (!presentationRef.current) return Promise.resolve();
    setSaveStatus("saving");
    saveChain.current = saveChain.current.then(async () => {
      const current = presentationRef.current;
      if (!current) return;
      const version = changeCounter.current;
      try {
        const path = await persistPresentation(current, filePathRef.current);
        filePathRef.current = path;
        setFilePath(path);
        savedCounter.current = version;
        setSaveStatus(changeCounter.current === version ? "saved" : "dirty");
      } catch (err) {
        console.error("Error al guardar la presentación:", err);
        setSaveStatus("error");
      }
    });
    return saveChain.current;
  }, []);

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
    if (presentationRef.current && changeCounter.current !== savedCounter.current) await saveNow();
  }, [saveNow]);

  // -------------------------------------------------------------------------
  // Modificación de las diapositivas e historial
  // -------------------------------------------------------------------------

  const applySlides = useCallback(
    (nextSlides: Slide[], coalesceKey = "") => {
      const current = presentationRef.current;
      if (!current) return;
      const next = { ...current, slides: nextSlides };
      presentationRef.current = next;
      setPresentation(next);

      const h = history.current;
      const now = Date.now();
      if (coalesceKey && h.lastKey === coalesceKey && now - h.lastTime < 1500 && h.index === h.stack.length - 1) {
        h.stack[h.index] = nextSlides;
      } else {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(nextSlides);
        if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
        h.index = h.stack.length - 1;
      }
      h.lastKey = coalesceKey;
      h.lastTime = now;
      markDirty();
    },
    [markDirty]
  );

  const updateActiveSlide = useCallback(
    (mutate: (slide: Slide) => Slide, coalesceKey = "") => {
      const current = presentationRef.current;
      if (!current) return;
      applySlides(
        current.slides.map((slide) => (slide.id === activeSlideId ? mutate(slide) : slide)),
        coalesceKey
      );
    },
    [activeSlideId, applySlides]
  );

  const updateMetadata = (changes: Partial<Presentation["metadata"]>) => {
    setPresentation((prev) => (prev ? { ...prev, metadata: { ...prev.metadata, ...changes } } : prev));
    markDirty();
  };

  const travelHistory = useCallback(
    (direction: -1 | 1) => {
      const h = history.current;
      const current = presentationRef.current;
      const target = h.index + direction;
      if (!current || target < 0 || target >= h.stack.length) return;
      h.index = target;
      h.lastKey = "";
      const restored = h.stack[target];
      const next = { ...current, slides: restored };
      presentationRef.current = next;
      setPresentation(next);
      setEditingId(null);
      setSelectedId(null);
      setActiveSlideId((id) => (restored.some((slide) => slide.id === id) ? id : restored[0].id));
      markDirty();
    },
    [markDirty]
  );

  const handleUndo = useCallback(() => travelHistory(-1), [travelHistory]);
  const handleRedo = useCallback(() => travelHistory(1), [travelHistory]);

  // -------------------------------------------------------------------------
  // Abrir, crear y guardar presentaciones
  // -------------------------------------------------------------------------

  const loadPresentation = useCallback((result: OpenResult, pinned = false) => {
    history.current = { stack: [result.presentation.slides], index: 0, lastKey: "", lastTime: 0 };
    changeCounter.current = 0;
    savedCounter.current = 0;
    presentationRef.current = result.presentation;
    filePathRef.current = result.filePath;
    setPresentation(result.presentation);
    setFilePath(result.filePath);
    setSaveStatus("saved");
    setIsStarred(pinned);
    setShowStartScreen(false);
    setActiveSlideId(result.presentation.slides[0].id);
    setSelectedId(null);
    setEditingId(null);
    setGridView(false);
    setClipboard(null);
    setPainter(null);
  }, []);

  const reportOpenError = (err: unknown) => {
    console.error("Error al abrir la presentación:", err);
    void showMessage(
      "No se pudo abrir el archivo",
      err instanceof Error ? err.message : "El archivo está dañado o su formato no es compatible."
    );
  };

  const handleNewPresentation = useCallback(
    async (newTitle?: string) => {
      await flushPendingSave();
      loadPresentation({ presentation: createBlankPresentation(newTitle || DEFAULT_TITLE), filePath: null });
    },
    [flushPendingSave, loadPresentation]
  );

  const handleOpenPresentation = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir presentación");
      if (!picked) return;
      await flushPendingSave();
      const result = await importFile(picked);
      loadPresentation(result);
      if (!result.filePath) {
        changeCounter.current += 1;
        await saveNow();
        if (extensionOf(picked.name) !== "csl") toast(`«${picked.name}» se importó como presentación de CoffeeView`);
      }
    } catch (err) {
      reportOpenError(err);
    }
  }, [flushPendingSave, loadPresentation, saveNow]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flushPendingSave();
        if (isTauri) {
          loadPresentation(await openPath(entry.path), entry.is_pinned);
        } else {
          const stored = loadWebPresentation(entry.id);
          if (!stored) throw new Error("La presentación ya no está en el almacenamiento del navegador.");
          loadPresentation({ presentation: stored, filePath: null }, entry.is_pinned);
        }
      } catch (err) {
        reportOpenError(err);
        void refreshRecents();
      }
    },
    [flushPendingSave, loadPresentation, refreshRecents]
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          const result = await openPath(args.file);
          loadPresentation(result);
          if (!result.filePath) {
            changeCounter.current += 1;
            await saveNow();
          }
          return;
        }
        if (args.docId) {
          const stored = loadWebPresentation(args.docId);
          if (stored) {
            loadPresentation({ presentation: stored, filePath: null });
            return;
          }
        }
        if (args.payload) {
          loadPresentation({ presentation: parseCsl(args.payload, DEFAULT_TITLE), filePath: null });
          changeCounter.current += 1;
          await saveNow();
          return;
        }
        if (args.newTitle !== null) {
          loadPresentation({ presentation: createBlankPresentation(args.newTitle || DEFAULT_TITLE), filePath: null });
          changeCounter.current += 1;
          await saveNow();
          return;
        }
      } catch (err) {
        reportOpenError(err);
      }

      let entries = await listRecent(APP_ID);
      if (entries.length === 0 && !isTauri) {
        const legacy = loadLegacyPresentation();
        if (legacy) {
          await persistPresentation(legacy, null);
          entries = await listRecent(APP_ID);
        }
      }
      setRecents(entries);
    })();
  }, [loadPresentation, saveNow]);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(presentation ? `${title || DEFAULT_TITLE} - CoffeeView` : "CoffeeView");
  }, [presentation, title]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (presentationRef.current && changeCounter.current !== savedCounter.current) void saveNow();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveNow]);

  const handleSave = async () => {
    changeCounter.current += 1;
    await saveNow();
    toast("Presentación guardada");
  };

  const handleSaveAs = async () => {
    const current = presentationRef.current;
    if (!current) return;
    try {
      const path = await savePresentationAs(current);
      if (path === null) return;
      if (path) {
        filePathRef.current = path;
        setFilePath(path);
        changeCounter.current += 1;
        await saveNow();
        toast("Presentación guardada en la nueva ubicación");
      } else {
        toast("Copia descargada");
      }
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar la presentación", "error");
    }
  };

  const handlePrint = useCallback(() => {
    setEditingId(null);
    window.setTimeout(() => window.print(), 50);
  }, []);

  const handleExport = async (format: string) => {
    const current = presentationRef.current;
    if (!current) return;
    if (format === "pdf") {
      handlePrint();
      return;
    }
    try {
      const done = await exportPresentation(current, format as Exclude<ExportFormat, "pdf">);
      if (done) toast(`Presentación exportada como .${format}`);
    } catch (err) {
      console.error("Error al exportar:", err);
      toast("No se pudo exportar la presentación", "error");
    }
  };

  const handleToggleStar = async () => {
    const current = presentationRef.current;
    if (!current) return;
    const next = !isStarred;
    setIsStarred(next);
    changeCounter.current += 1;
    await saveNow();
    await setPinned(current.metadata.id, next);
    toast(next ? "Presentación fijada en el Launcher" : "Presentación desfijada");
  };

  // -------------------------------------------------------------------------
  // Diapositivas
  // -------------------------------------------------------------------------

  const selectSlide = (id: string) => {
    setActiveSlideId(id);
    setSelectedId(null);
    setEditingId(null);
  };

  const handleAddSlide = (layout: SlideLayout = "title-content") => {
    const current = presentationRef.current;
    if (!current) return;
    const index = current.slides.findIndex((slide) => slide.id === activeSlideId);
    // La nueva diapositiva hereda el fondo personalizado de la actual
    const fresh = createSlide(layout, current.slides[index]?.background);
    const next = [...current.slides];
    next.splice(index + 1, 0, fresh);
    applySlides(next);
    selectSlide(fresh.id);
    setGridView(false);
  };

  const handleDuplicateSlide = (id: string = activeSlideId) => {
    const current = presentationRef.current;
    const index = current?.slides.findIndex((slide) => slide.id === id) ?? -1;
    if (!current || index < 0) return;
    const source = current.slides[index];
    const copy: Slide = {
      ...source,
      id: newId("slide"),
      elements: source.elements.map((el) => ({ ...el, id: newId("el") })),
    };
    const next = [...current.slides];
    next.splice(index + 1, 0, copy);
    applySlides(next);
    selectSlide(copy.id);
  };

  const handleDeleteSlide = (id: string = activeSlideId) => {
    const current = presentationRef.current;
    if (!current || current.slides.length <= 1) {
      toast("La presentación debe tener al menos una diapositiva", "info");
      return;
    }
    const index = current.slides.findIndex((slide) => slide.id === id);
    const next = current.slides.filter((slide) => slide.id !== id);
    applySlides(next);
    if (id === activeSlideId) selectSlide(next[Math.min(index, next.length - 1)].id);
  };

  const handleToggleHidden = (id: string = activeSlideId) => {
    const current = presentationRef.current;
    if (!current) return;
    applySlides(current.slides.map((slide) => (slide.id === id ? { ...slide, hidden: !slide.hidden } : slide)));
  };

  const handleReorder = (id: string, toIndex: number) => {
    const current = presentationRef.current;
    const from = current?.slides.findIndex((slide) => slide.id === id) ?? -1;
    if (!current || from < 0) return;
    const next = [...current.slides];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex > from ? toIndex - 1 : toIndex, 0, moved);
    if (next.some((slide, index) => slide !== current.slides[index])) applySlides(next);
  };

  const moveActiveSlide = (delta: -1 | 1) => {
    const target = activeIndex + delta;
    if (target < 0 || target >= slides.length) return;
    handleReorder(activeSlideId, delta === 1 ? target + 1 : target);
  };

  /** Cambia el diseño conservando los textos ya escritos y el resto de elementos. */
  const handleChangeLayout = (layout: SlideLayout) =>
    updateActiveSlide((slide) => {
      const texts = slide.elements.filter((el) => ["title", "subtitle", "text"].includes(el.type) && el.content);
      const others = slide.elements.filter((el) => !["title", "subtitle", "text"].includes(el.type));
      const pool = [...texts];
      const placed = elementsForLayout(layout).map((placeholder) => {
        // Primero se busca un texto del mismo tipo; si no hay, cualquiera que quede
        let index = pool.findIndex((el) => el.type === placeholder.type);
        if (index < 0 && placeholder.type !== "title") index = pool.findIndex((el) => el.type !== "title");
        if (index < 0) return placeholder;
        const [source] = pool.splice(index, 1);
        return { ...placeholder, content: source.content, color: source.color, fontFamily: source.fontFamily };
      });
      return { ...slide, layout, elements: [...placed, ...pool, ...others] };
    });

  const handleSetBackground = (color: string | undefined, applyToAll: boolean) => {
    const current = presentationRef.current;
    if (!current) return;
    applySlides(
      current.slides.map((slide) => (applyToAll || slide.id === activeSlideId ? { ...slide, background: color } : slide)),
      applyToAll ? "" : `background-${activeSlideId}`
    );
  };

  const handleSetTransition = (transition: SlideTransition, applyToAll: boolean) => {
    const current = presentationRef.current;
    if (!current) return;
    applySlides(current.slides.map((slide) => (applyToAll || slide.id === activeSlideId ? { ...slide, transition } : slide)));
    if (applyToAll) toast("Transición aplicada a todas las diapositivas");
  };

  const handleChangeNotes = (notes: string) =>
    updateActiveSlide((slide) => ({ ...slide, notes }), `notes-${activeSlideId}`);

  // -------------------------------------------------------------------------
  // Elementos
  // -------------------------------------------------------------------------

  const handleUpdateElement = useCallback(
    (id: string, changes: Partial<SlideElement>, coalesceKey = "") => {
      updateActiveSlide(
        (slide) => ({
          ...slide,
          elements: slide.elements.map((el) => {
            if (el.id !== id) return el;
            const next = { ...el, ...changes };
            for (const [key, value] of Object.entries(changes)) {
              if (value === undefined) delete (next as unknown as Record<string, unknown>)[key];
            }
            return next;
          }),
        }),
        coalesceKey
      );
    },
    [updateActiveSlide]
  );

  const addElement = (element: SlideElement) => {
    updateActiveSlide((slide) => ({ ...slide, elements: [...slide.elements, element] }));
    setSelectedId(element.id);
    setEditingId(null);
    setGridView(false);
  };

  const handleAddText = () =>
    addElement({
      id: newId("el"),
      type: "text",
      x: 25,
      y: 40,
      width: 50,
      height: 16,
      content: "",
      fontSize: 22,
      align: "center",
    });

  const handleAddShape = (shape: ShapeType) =>
    addElement({
      id: newId("el"),
      type: "shape",
      shapeType: shape,
      x: 38,
      y: 32,
      width: 24,
      height: aspectRatio === "16:9" ? 34 : 26,
      content: "",
      fontSize: 20,
      align: "center",
    });

  const handleAddLine = () =>
    addElement({
      id: newId("el"),
      type: "line",
      x: 30,
      y: 50,
      width: 40,
      height: 0.6,
      content: "",
      borderWidth: 3,
    });

  const handleAddTable = async () => {
    const values = await askForm({
      title: "Insertar tabla",
      confirmLabel: "Insertar",
      fields: [
        { name: "rows", label: "Filas", type: "number", defaultValue: "4", min: 1, max: 12 },
        { name: "cols", label: "Columnas", type: "number", defaultValue: "3", min: 1, max: 8 },
      ],
    });
    if (!values) return;
    const rowCount = Math.max(1, Math.min(12, Number(values.rows) || 4));
    const colCount = Math.max(1, Math.min(8, Number(values.cols) || 3));
    const rows = Array.from({ length: rowCount }, (_, r) =>
      Array.from({ length: colCount }, (_, c) => (r === 0 ? `Columna ${c + 1}` : ""))
    );
    addElement({
      id: newId("el"),
      type: "table",
      x: 15,
      y: 28,
      width: 70,
      height: Math.min(60, rowCount * 9),
      content: "",
      rows,
      fontSize: 16,
    });
  };

  /** Inserta una imagen ajustando su caja a la proporción real. */
  const handleAddImage = (source: string) => {
    const size = SLIDE_SIZE[aspectRatio];
    const place = (naturalWidth: number, naturalHeight: number) => {
      let width = 44;
      let height = ((width / 100) * size.width * (naturalHeight / naturalWidth) * 100) / size.height;
      if (height > 70) {
        height = 70;
        width = ((height / 100) * size.height * (naturalWidth / naturalHeight) * 100) / size.width;
      }
      addElement({
        id: newId("el"),
        type: "image",
        x: (100 - width) / 2,
        y: (100 - height) / 2,
        width,
        height,
        content: source,
      });
    };
    const probe = new Image();
    probe.onload = () => place(probe.naturalWidth || 4, probe.naturalHeight || 3);
    probe.onerror = () => {
      toast("No se pudo cargar la imagen", "error");
    };
    probe.src = source;
  };

  const handlePickImage = async () => {
    const picked = await pickOpenFile(IMAGE_FILTERS, "Insertar imagen");
    if (picked) handleAddImage(`data:${mimeOf(picked.name)};base64,${bytesToBase64(picked.bytes)}`);
  };

  const handleAddVideo = (source: string) =>
    addElement({ id: newId("el"), type: "video", x: 20, y: 18, width: 60, height: 64, content: source });

  const handlePickVideo = async () => {
    const picked = await pickOpenFile(VIDEO_FILTERS, "Insertar vídeo");
    if (!picked) return;
    if (picked.bytes.length > MAX_VIDEO_BYTES) {
      void showMessage(
        "El vídeo es demasiado grande",
        "Solo se pueden incrustar vídeos de hasta 25 MB. Para vídeos mayores, usa una dirección web."
      );
      return;
    }
    handleAddVideo(`data:${mimeOf(picked.name)};base64,${bytesToBase64(picked.bytes)}`);
  };

  const handleUploadAssets = async () => {
    const picked = await pickOpenFile(IMAGE_FILTERS, "Subir imagen a la biblioteca");
    if (!picked) return;
    const asset = { id: newId("asset"), name: picked.name, dataUrl: `data:${mimeOf(picked.name)};base64,${bytesToBase64(picked.bytes)}` };
    setPresentation((prev) => (prev ? { ...prev, assets: [asset, ...prev.assets] } : prev));
    markDirty();
  };

  const handleRemoveAsset = (id: string) => {
    setPresentation((prev) => (prev ? { ...prev, assets: prev.assets.filter((asset) => asset.id !== id) } : prev));
    markDirty();
  };

  const handleDeleteElement = () => {
    if (!selectedId) return;
    updateActiveSlide((slide) => ({ ...slide, elements: slide.elements.filter((el) => el.id !== selectedId) }));
    setSelectedId(null);
    setEditingId(null);
  };

  const handleStyle = (patch: Partial<SlideElement>) => {
    if (selectedId) handleUpdateElement(selectedId, patch, `style-${selectedId}-${Object.keys(patch).join("-")}`);
  };

  const handleArrange = (direction: "front" | "back") => {
    if (!selectedId) return;
    updateActiveSlide((slide) => {
      const element = slide.elements.find((el) => el.id === selectedId);
      if (!element) return slide;
      const rest = slide.elements.filter((el) => el.id !== selectedId);
      return { ...slide, elements: direction === "front" ? [...rest, element] : [element, ...rest] };
    });
  };

  const handleCopyElement = (cut = false) => {
    if (!selected) return;
    setClipboard(selected);
    if (cut) handleDeleteElement();
  };

  const handlePasteElement = () => {
    if (!clipboard) return;
    addElement({
      ...clipboard,
      id: newId("el"),
      x: Math.min(100 - clipboard.width, clipboard.x + 3),
      y: Math.min(100 - clipboard.height, clipboard.y + 3),
    });
  };

  const handleDuplicateElement = () => {
    if (!selected) return;
    addElement({ ...selected, id: newId("el"), x: Math.min(95, selected.x + 3), y: Math.min(95, selected.y + 3) });
  };

  /** Selecciona un elemento; si hay un formato copiado, se lo aplica. */
  const handleSelectElement = (id: string | null) => {
    setSelectedId(id);
    if (id && painter) {
      handleUpdateElement(id, painter);
      setPainter(null);
    }
  };

  const handleTogglePainter = () => {
    if (painter) {
      setPainter(null);
      return;
    }
    if (!selected) return;
    const style: Partial<SlideElement> = {};
    for (const key of STYLE_KEYS) {
      if (selected[key] !== undefined) (style as Record<string, unknown>)[key] = selected[key];
    }
    setPainter(style);
    toast("Formato copiado: haz clic en el elemento de destino", "info");
  };

  const handleInitPlaceholders = () => {
    const elements = elementsForLayout("title");
    updateActiveSlide((slide) => ({ ...slide, layout: "title", elements }));
    setSelectedId(elements[0].id);
    setEditingId(elements[0].id);
  };

  const handleTransform = (kind: TransformKind) =>
    updateActiveSlide((slide) => {
      const background = slide.background || theme.slideBg;
      const dark = isDarkColor(background);
      switch (kind) {
        case "bullets":
          return {
            ...slide,
            elements: slide.elements.map((el) =>
              (el.type === "text" || el.type === "subtitle") && el.content
                ? {
                    ...el,
                    align: "left" as const,
                    content: el.content
                      .split("\n")
                      .filter((line) => line.trim())
                      .map((line) => (line.trim().startsWith("•") ? line.trim() : `• ${line.trim()}`))
                      .join("\n"),
                  }
                : el
            ),
          };
        case "align": {
          let offset = 0;
          return {
            ...slide,
            elements: slide.elements.map((el) => {
              if (el.type === "title") return { ...el, x: 8, y: 8, width: 84, height: 16, align: "center" as const };
              if (el.type === "subtitle" || el.type === "text") {
                const placed = { ...el, x: 12, y: 30 + offset, width: 76, height: 22, align: "center" as const };
                offset += 24;
                return placed;
              }
              return el;
            }),
          };
        }
        case "contrast":
          return {
            ...slide,
            elements: slide.elements.map((el) =>
              ["title", "subtitle", "text", "table"].includes(el.type) && !el.bg
                ? { ...el, color: el.type === "title" ? (dark ? "#ffffff" : "#1f1f1f") : dark ? "#e8eaed" : "#3c4043" }
                : el
            ),
          };
        case "invert": {
          const nextBackground = dark ? "#ffffff" : "#202124";
          return {
            ...slide,
            background: nextBackground,
            elements: slide.elements.map((el) =>
              ["title", "subtitle", "text", "table", "line"].includes(el.type) && !el.bg
                ? { ...el, color: el.type === "title" ? (dark ? "#1f1f1f" : "#ffffff") : dark ? "#444746" : "#e8eaed" }
                : el
            ),
          };
        }
        case "title":
          return {
            ...slide,
            elements: slide.elements.map((el) =>
              el.type === "title"
                ? { ...el, fontSize: Math.max(el.fontSize || 40, 52), fontWeight: "bold" as const, color: theme.accentColor }
                : el
            ),
          };
      }
    });

  const handleSaveTimings = (timings: Record<string, number>) => {
    const current = presentationRef.current;
    if (!current) return;
    applySlides(current.slides.map((slide) => (timings[slide.id] ? { ...slide, duration: timings[slide.id] } : slide)));
    toast("Intervalos guardados");
  };

  const handleClearTimings = () => {
    const current = presentationRef.current;
    if (!current) return;
    applySlides(current.slides.map(({ duration: _duration, ...slide }) => slide));
    updateMetadata({ autoAdvance: false });
  };

  const startPresentation = (fromCurrent: boolean) => {
    if (slides.length === 0) return;
    setEditingId(null);
    setSelectedId(null);
    setPresentingFrom(fromCurrent ? activeSlideId : slides[0].id);
  };

  const focusNotes = () => {
    setNotesVisible(true);
    window.setTimeout(() => document.getElementById("speaker-notes")?.focus(), 30);
  };

  const confirmNew = async () => {
    const ok = await askConfirm({
      title: "Nueva presentación",
      message: "La presentación actual se guardará y se abrirá una nueva en blanco.",
      confirmLabel: "Crear",
    });
    if (ok) void handleNewPresentation();
  };

  // -------------------------------------------------------------------------
  // Atajos de teclado y portapapeles
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentationRef.current || showStartScreen || presentingFrom) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const typing = isTypingTarget(e.target);

      if (e.key === "F5") {
        e.preventDefault();
        startPresentation(e.shiftKey);
        return;
      }
      if (e.altKey && e.key === "/") {
        e.preventDefault();
        setCommandSearchOpen(true);
        return;
      }
      if (mod && key === "s") {
        e.preventDefault();
        if (e.shiftKey) void handleSaveAs();
        else void handleSave();
        return;
      }
      if (typing) return;

      if (e.key === "Escape") {
        setSelectedId(null);
        setPainter(null);
        setContextMenu(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleDeleteElement();
        return;
      }
      if (e.key === "PageDown" || e.key === "PageUp") {
        e.preventDefault();
        const target = slides[activeIndex + (e.key === "PageDown" ? 1 : -1)];
        if (target) selectSlide(target.id);
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (selected) {
          // Mover el elemento seleccionado (Mayús: pasos más grandes)
          const step = e.shiftKey ? 2 : 0.5;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          handleUpdateElement(selected.id, { x: selected.x + dx, y: selected.y + dy }, `nudge-${selected.id}`);
        } else {
          const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
          const target = slides[activeIndex + delta];
          if (target) selectSlide(target.id);
        }
        return;
      }
      if (e.key === "Enter" && selected && (TEXT_TYPES.includes(selected.type) || selected.type === "table")) {
        e.preventDefault();
        setEditingId(selected.id);
        return;
      }
      if (e.key === "Tab" && activeSlide && activeSlide.elements.length > 0) {
        e.preventDefault();
        const index = activeSlide.elements.findIndex((el) => el.id === selectedId);
        const next = activeSlide.elements[(index + (e.shiftKey ? -1 : 1) + activeSlide.elements.length) % activeSlide.elements.length];
        setSelectedId(next.id);
        return;
      }
      if (!mod) return;

      switch (key) {
        case "z":
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          break;
        case "y":
          e.preventDefault();
          handleRedo();
          break;
        case "c":
          if (selected) {
            e.preventDefault();
            handleCopyElement(false);
          }
          break;
        case "x":
          if (selected) {
            e.preventDefault();
            handleCopyElement(true);
          }
          break;
        case "d":
          e.preventDefault();
          if (selected) handleDuplicateElement();
          else handleDuplicateSlide();
          break;
        case "m":
          e.preventDefault();
          handleAddSlide("title-content");
          break;
        case "b":
          if (selected) {
            e.preventDefault();
            const bold = (selected.fontWeight || (selected.type === "title" ? "bold" : "normal")) === "bold";
            handleStyle({ fontWeight: bold ? "normal" : "bold" });
          }
          break;
        case "i":
          if (selected) {
            e.preventDefault();
            handleStyle({ fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" });
          }
          break;
        case "u":
          if (selected) {
            e.preventDefault();
            handleStyle({ underline: !selected.underline });
          }
          break;
        case "o":
          e.preventDefault();
          void handleOpenPresentation();
          break;
        case "n":
          e.preventDefault();
          void handleNewPresentation();
          break;
        case "p":
          e.preventDefault();
          handlePrint();
          break;
      }
    };

    // Pegar: una imagen del portapapeles del sistema o el elemento copiado
    const handlePaste = (e: ClipboardEvent) => {
      if (!presentationRef.current || showStartScreen || presentingFrom || isTypingTarget(e.target)) return;
      const file = Array.from(e.clipboardData?.files || []).find((item) => item.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => handleAddImage(String(reader.result));
        reader.readAsDataURL(file);
        return;
      }
      if (clipboard) {
        e.preventDefault();
        handlePasteElement();
        return;
      }
      const text = e.clipboardData?.getData("text/plain");
      if (text?.trim()) {
        e.preventDefault();
        addElement({ id: newId("el"), type: "text", x: 20, y: 35, width: 60, height: 30, content: text.trim(), fontSize: 20, align: "left", valign: "top" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePaste);
    };
  });

  // -------------------------------------------------------------------------
  // Menús
  // -------------------------------------------------------------------------

  const noSelection = !selected;
  const menus: MenuDefinition[] = [
    {
      id: "archivo",
      label: "Archivo",
      items: [
        { label: "Nueva presentación", icon: FilePlus, action: () => void confirmNew(), shortcut: "Ctrl+N" },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpenPresentation(), shortcut: "Ctrl+O" },
        { label: "Pantalla de inicio", icon: FileText, action: () => setShowStartScreen(true) },
        { divider: true },
        { label: "Guardar", icon: Save, action: () => void handleSave(), shortcut: "Ctrl+S" },
        { label: "Guardar como…", icon: SaveAll, action: () => void handleSaveAs(), shortcut: "Ctrl+Mayús+S" },
        { label: "Descargar / Exportar…", icon: Download, action: () => setExportModalOpen(true) },
        { divider: true },
        {
          label: "Formato panorámico (16:9)",
          action: () => updateMetadata({ aspectRatio: "16:9" }),
          checked: aspectRatio === "16:9",
        },
        { label: "Formato estándar (4:3)", action: () => updateMetadata({ aspectRatio: "4:3" }), checked: aspectRatio === "4:3" },
        { divider: true },
        { label: "Imprimir", icon: Printer, action: handlePrint, shortcut: "Ctrl+P" },
      ],
    },
    {
      id: "editar",
      label: "Editar",
      items: [
        { label: "Deshacer", icon: Undo2, action: handleUndo, shortcut: "Ctrl+Z" },
        { label: "Rehacer", icon: Redo2, action: handleRedo, shortcut: "Ctrl+Y" },
        { divider: true },
        { label: "Cortar", icon: Scissors, action: () => handleCopyElement(true), shortcut: "Ctrl+X", disabled: noSelection },
        { label: "Copiar", icon: Copy, action: () => handleCopyElement(false), shortcut: "Ctrl+C", disabled: noSelection },
        { label: "Pegar", icon: ClipboardPaste, action: handlePasteElement, shortcut: "Ctrl+V", disabled: !clipboard },
        { label: "Duplicar", action: handleDuplicateElement, shortcut: "Ctrl+D", disabled: noSelection },
        { label: "Eliminar", icon: Trash2, action: handleDeleteElement, shortcut: "Supr", disabled: noSelection },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        { label: "Presentar desde el principio", icon: Play, action: () => startPresentation(false), shortcut: "F5" },
        { label: "Presentar desde la diapositiva actual", action: () => startPresentation(true), shortcut: "Mayús+F5" },
        { divider: true },
        { label: "Vista de cuadrícula", action: () => setGridView((value) => !value), checked: gridView },
        { label: "Tira de diapositivas", action: () => setStripVisible((value) => !value), checked: stripVisible },
        { label: "Notas del orador", action: () => setNotesVisible((value) => !value), checked: notesVisible },
        { label: "Cuadrícula de guía", action: () => setShowGrid((value) => !value), checked: showGrid },
        { divider: true },
        { label: "Ajustar a la ventana", action: () => setZoom("fit"), checked: zoom === "fit" },
        { label: "Zoom 100%", action: () => setZoom(100), checked: zoom === 100 },
        { label: "Zoom 150%", action: () => setZoom(150), checked: zoom === 150 },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        { label: "Cuadro de texto", icon: Type, action: handleAddText },
        { label: "Imagen desde el equipo…", icon: ImageIcon, action: () => void handlePickImage() },
        { label: "Vídeo desde el equipo…", action: () => void handlePickVideo() },
        { label: "Tabla…", icon: Table, action: () => void handleAddTable() },
        { label: "Línea", action: handleAddLine },
        { divider: true },
        { label: "Rectángulo", action: () => handleAddShape("rectangle") },
        { label: "Rectángulo redondeado", action: () => handleAddShape("rounded") },
        { label: "Elipse", action: () => handleAddShape("circle") },
        { label: "Triángulo", action: () => handleAddShape("triangle") },
        { label: "Rombo", action: () => handleAddShape("diamond") },
        { label: "Estrella", action: () => handleAddShape("star") },
        { label: "Flecha", action: () => handleAddShape("arrow-right") },
        { label: "Bocadillo", action: () => handleAddShape("callout") },
        { divider: true },
        { label: "Diapositiva nueva", icon: Plus, action: () => handleAddSlide("title-content"), shortcut: "Ctrl+M" },
      ],
    },
    {
      id: "formato",
      label: "Formato",
      items: [
        {
          label: "Negrita",
          action: () => handleStyle({ fontWeight: selected?.fontWeight === "bold" ? "normal" : "bold" }),
          shortcut: "Ctrl+B",
          disabled: noSelection,
        },
        {
          label: "Cursiva",
          action: () => handleStyle({ fontStyle: selected?.fontStyle === "italic" ? "normal" : "italic" }),
          shortcut: "Ctrl+I",
          disabled: noSelection,
        },
        { label: "Subrayado", action: () => handleStyle({ underline: !selected?.underline }), shortcut: "Ctrl+U", disabled: noSelection },
        { divider: true },
        { label: "Alinear texto a la izquierda", action: () => handleStyle({ align: "left" }), disabled: noSelection },
        { label: "Centrar texto", action: () => handleStyle({ align: "center" }), disabled: noSelection },
        { label: "Alinear texto a la derecha", action: () => handleStyle({ align: "right" }), disabled: noSelection },
        { divider: true },
        {
          label: "Borde del elemento",
          action: () => handleStyle({ borderWidth: selected?.borderWidth ? undefined : 2, borderColor: selected?.borderColor || "#1f1f1f" }),
          checked: Boolean(selected?.borderWidth),
          disabled: noSelection || selected?.type === "image" || selected?.type === "video" || selected?.type === "line",
        },
        {
          label: "Quitar el formato del texto",
          action: () =>
            handleStyle({ fontSize: undefined, fontFamily: undefined, fontWeight: undefined, fontStyle: undefined, underline: undefined, color: undefined }),
          disabled: noSelection,
        },
      ],
    },
    {
      id: "diapositiva",
      label: "Diapositiva",
      items: [
        { label: "Diapositiva nueva", icon: Plus, action: () => handleAddSlide("title-content"), shortcut: "Ctrl+M" },
        { label: "Duplicar diapositiva", icon: Copy, action: () => handleDuplicateSlide() },
        { label: "Eliminar diapositiva", icon: Trash2, action: () => handleDeleteSlide(), disabled: slides.length <= 1 },
        {
          label: "Ocultar en la presentación",
          icon: EyeOff,
          action: () => handleToggleHidden(),
          checked: Boolean(activeSlide?.hidden),
        },
        { divider: true },
        { label: "Mover hacia arriba", action: () => moveActiveSlide(-1), disabled: activeIndex === 0 },
        { label: "Mover hacia abajo", action: () => moveActiveSlide(1), disabled: activeIndex >= slides.length - 1 },
        { divider: true },
        { label: "Diseño: título", action: () => handleChangeLayout("title") },
        { label: "Diseño: título y contenido", action: () => handleChangeLayout("title-content") },
        { label: "Diseño: dos columnas", action: () => handleChangeLayout("two-columns") },
        { label: "Diseño: encabezado de sección", action: () => handleChangeLayout("section") },
        { label: "Diseño: en blanco", action: () => handleChangeLayout("blank") },
      ],
    },
    {
      id: "organizar",
      label: "Organizar",
      items: [
        { label: "Traer al frente", action: () => handleArrange("front"), disabled: noSelection },
        { label: "Enviar al fondo", action: () => handleArrange("back"), disabled: noSelection },
        { divider: true },
        {
          label: "Centrar horizontalmente",
          action: () => selected && handleUpdateElement(selected.id, { x: (100 - selected.width) / 2 }),
          disabled: noSelection,
        },
        {
          label: "Centrar verticalmente",
          action: () => selected && handleUpdateElement(selected.id, { y: (100 - selected.height) / 2 }),
          disabled: noSelection,
        },
        {
          label: "Ajustar al ancho de la diapositiva",
          action: () => selected && handleUpdateElement(selected.id, { x: 0, width: 100 }),
          disabled: noSelection,
        },
        { divider: true },
        {
          label: "Voltear la línea",
          action: () => handleStyle({ flip: !selected?.flip }),
          disabled: selected?.type !== "line",
        },
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
                "F5 · presentar desde el principio  |  Mayús+F5 · desde la actual",
                "Ctrl+M · diapositiva nueva  |  Ctrl+D · duplicar",
                "Clic sobre un elemento seleccionado o Intro · editar su texto",
                "Flechas · mover el elemento (Mayús: pasos grandes)",
                "Tab · seleccionar el siguiente elemento  |  Supr · eliminar",
                "Av Pág / Re Pág · cambiar de diapositiva",
                "Ctrl+C / X / V · copiar, cortar y pegar  |  Ctrl+Z / Y · deshacer y rehacer",
                "Ctrl+B / I / U · negrita, cursiva y subrayado",
                "Ctrl+S · guardar  |  Ctrl+P · imprimir  |  Alt+/ · buscar en los menús",
                "Al presentar: → siguiente, ← anterior, N notas, B pantalla en negro, Esc salir",
              ].join("\n")
            ),
        },
        {
          label: "Acerca de CoffeeView",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeeView 1.0",
              "Presentaciones de la suite CoffeeWorks.\n\nLas presentaciones se guardan como archivos .csl en la carpeta Documentos\\CoffeeWorks y se pueden exportar a PowerPoint, HTML y PDF."
            ),
        },
      ],
    },
  ];

  const size = SLIDE_SIZE[aspectRatio];
  const printCss = `@media print { @page { size: ${size.width}px ${size.height}px; margin: 0; } }`;

  const contextItems: Array<{ label: string; action: () => void; disabled?: boolean; danger?: boolean } | "divider"> = selected
    ? [
        { label: "Cortar", action: () => handleCopyElement(true) },
        { label: "Copiar", action: () => handleCopyElement(false) },
        { label: "Duplicar", action: handleDuplicateElement },
        "divider",
        { label: "Traer al frente", action: () => handleArrange("front") },
        { label: "Enviar al fondo", action: () => handleArrange("back") },
        "divider",
        { label: "Eliminar", action: handleDeleteElement, danger: true },
      ]
    : [
        { label: "Pegar", action: handlePasteElement, disabled: !clipboard },
        "divider",
        { label: "Diapositiva nueva", action: () => handleAddSlide("title-content") },
        { label: "Duplicar diapositiva", action: () => handleDuplicateSlide() },
        { label: activeSlide?.hidden ? "Mostrar en la presentación" : "Ocultar en la presentación", action: () => handleToggleHidden() },
        { label: "Eliminar diapositiva", action: () => handleDeleteSlide(), danger: true, disabled: slides.length <= 1 },
      ];

  return (
    <div className="view-app flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      <style>{printCss}</style>

      {presentation && activeSlide && (
        <>
          <SuiteHeader
            logo={SlidesLogo}
            logoTitle="Pantalla de inicio de CoffeeView"
            onLogoClick={() => setShowStartScreen(true)}
            title={title}
            titlePlaceholder={DEFAULT_TITLE}
            onTitleChange={(newTitle) => updateMetadata({ title: newTitle })}
            menus={menus}
            saveStatus={saveStatus}
            fileLocation={filePath}
            isStarred={isStarred}
            onToggleStar={() => void handleToggleStar()}
            onBeforeClose={flushPendingSave}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => startPresentation(true)}
                  className="bg-white hover:bg-[#f0f4f9] text-[#1f1f1f] border border-[#c4c7c5] font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                  title="Presentar desde la diapositiva actual (Mayús+F5)"
                >
                  <Play size={13} className="fill-current" />
                  <span>Presentación de diapositivas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportModalOpen(true)}
                  className="bg-[#c2e7ff] hover:bg-[#b3dcfa] text-[#001d35] font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                  title="Exportar presentación"
                >
                  <ArrowUpRight size={15} />
                  <span>Exportar</span>
                </button>
              </>
            }
          />

          <GoogleSlidesToolbar
            selected={selected}
            theme={theme}
            themes={SLIDE_THEMES}
            zoom={zoom}
            onZoomChange={setZoom}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onPrint={handlePrint}
            painterActive={painter !== null}
            onTogglePainter={handleTogglePainter}
            onAddSlide={handleAddSlide}
            onDeselect={() => {
              setSelectedId(null);
              setEditingId(null);
            }}
            onAddText={handleAddText}
            onPickImage={() => void handlePickImage()}
            onAddShape={handleAddShape}
            onAddLine={handleAddLine}
            onAddTable={() => void handleAddTable()}
            onFocusNotes={focusNotes}
            onStyle={handleStyle}
            onArrange={handleArrange}
            onDelete={handleDeleteElement}
            onSelectTheme={(id) => updateMetadata({ themeId: id })}
            onOpenCommandSearch={() => setCommandSearchOpen(true)}
            notesVisible={notesVisible}
            onToggleNotes={() => setNotesVisible((value) => !value)}
          />

          <div className="flex-1 flex overflow-hidden print:hidden">
            {gridView ? (
              <SlideThumbnails
                mode="grid"
                slides={slides}
                activeSlideId={activeSlide.id}
                theme={theme}
                aspectRatio={aspectRatio}
                onSelectSlide={selectSlide}
                onOpenSlide={(id) => {
                  selectSlide(id);
                  setGridView(false);
                }}
                onAddSlide={() => handleAddSlide("title-content")}
                onDuplicateSlide={handleDuplicateSlide}
                onDeleteSlide={handleDeleteSlide}
                onToggleHidden={handleToggleHidden}
                onReorder={handleReorder}
              />
            ) : (
              <>
                {stripVisible && (
                  <SlideThumbnails
                    mode="strip"
                    slides={slides}
                    activeSlideId={activeSlide.id}
                    theme={theme}
                    aspectRatio={aspectRatio}
                    onSelectSlide={selectSlide}
                    onAddSlide={() => handleAddSlide("title-content")}
                    onDuplicateSlide={handleDuplicateSlide}
                    onDeleteSlide={handleDeleteSlide}
                    onToggleHidden={handleToggleHidden}
                    onReorder={handleReorder}
                  />
                )}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                  <SlideCanvas
                    slide={activeSlide}
                    theme={theme}
                    aspectRatio={aspectRatio}
                    zoom={zoom}
                    selectedId={selectedId}
                    onSelect={handleSelectElement}
                    editingId={editingId}
                    onSetEditing={setEditingId}
                    onUpdateElement={handleUpdateElement}
                    showGrid={showGrid}
                    onAddSlide={() => handleAddSlide("title-content")}
                    onInitPlaceholders={handleInitPlaceholders}
                    onContextMenu={(x, y) => setContextMenu({ x, y })}
                  />
                  {notesVisible && (
                    <SpeakerNotes
                      spellKey={`notes:${activeSlide.id}`}
                      notes={activeSlide.notes}
                      onChangeNotes={handleChangeNotes}
                      gridView={gridView}
                      onToggleGridView={() => setGridView((value) => !value)}
                      stripVisible={stripVisible}
                      onToggleStrip={() => setStripVisible((value) => !value)}
                    />
                  )}
                </div>
                <SidePanel
                  slide={activeSlide}
                  slides={slides}
                  theme={theme}
                  assets={presentation.assets}
                  autoAdvance={Boolean(presentation.metadata.autoAdvance)}
                  onChangeLayout={handleChangeLayout}
                  onSetBackground={handleSetBackground}
                  onSetTransition={handleSetTransition}
                  onToggleHidden={() => handleToggleHidden()}
                  onPickImage={() => void handlePickImage()}
                  onAddImage={handleAddImage}
                  onPickVideo={() => void handlePickVideo()}
                  onAddVideo={handleAddVideo}
                  onUploadAssets={() => void handleUploadAssets()}
                  onRemoveAsset={handleRemoveAsset}
                  onTransform={handleTransform}
                  onSaveTimings={handleSaveTimings}
                  onClearTimings={handleClearTimings}
                  onToggleAutoAdvance={() => updateMetadata({ autoAdvance: !presentation.metadata.autoAdvance })}
                />
              </>
            )}
          </div>

          {/* Vista de impresión: una diapositiva por página */}
          <div className="view-print">
            {slides
              .filter((slide) => !slide.hidden)
              .map((slide) => (
                <div key={slide.id} className="view-print-page">
                  <SlideView slide={slide} theme={theme} aspectRatio={aspectRatio} width={size.width} />
                </div>
              ))}
          </div>
        </>
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[999960]" onMouseDown={() => setContextMenu(null)} onContextMenu={(e) => e.preventDefault()} />
          <div
            className="fixed z-[999970] bg-white border border-gray-200 rounded-lg shadow-2xl py-1.5 min-w-[210px] print:hidden"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 230), top: Math.min(contextMenu.y, window.innerHeight - 260) }}
          >
            {contextItems.map((item, index) =>
              item === "divider" ? (
                <div key={index} className="h-px bg-gray-200 my-1" />
              ) : (
                <button
                  key={index}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setContextMenu(null);
                    item.action();
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] disabled:opacity-40 disabled:hover:bg-transparent ${
                    item.danger ? "text-[#b3261e]" : "text-[#1f1f1f]"
                  }`}
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        </>
      )}

      {presentingFrom && presentation && (
        <PresentationMode
          slides={slides}
          startSlideId={presentingFrom}
          theme={theme}
          aspectRatio={aspectRatio}
          autoAdvance={Boolean(presentation.metadata.autoAdvance)}
          onExit={(lastSlideId) => {
            setPresentingFrom(null);
            selectSlide(lastSlideId);
          }}
        />
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Exportar presentación"
        fileTitle={title || DEFAULT_TITLE}
        options={EXPORT_OPTIONS}
        onExport={(format) => void handleExport(format)}
      />
      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {presentation && activeSlide && !presentingFrom && (
        <footer className="h-7 px-3 flex items-center justify-between text-[11px] select-none shrink-0 text-white print:hidden" style={{ background: "#c43e1c" }} data-view-status>
          <span className="font-mono">
            Diapositiva {slides.findIndex((s) => s.id === activeSlide.id) + 1} de {slides.length}
          </span>
          <SpellIndicator spell={spell} tone="dark" />
        </footer>
      )}
      {spell.menu}
      <SpellStyles />

      {showStartScreen && (
        <StartScreen
          appName="CoffeeView"
          tagline="Presentaciones • CoffeeWorks"
          accent="#c43e1c"
          newHint="Crear presentación en blanco"
          openHint="PowerPoint (.pptx) o .csl"
          formats={[".csl", ".pptx"]}
          recents={recents}
          onNew={() => void handleNewPresentation()}
          onOpen={() => void handleOpenPresentation()}
          onOpenRecent={(entry) => void handleOpenRecent(entry)}
          onContinue={presentation ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      <DialogHost />
    </div>
  );
};
