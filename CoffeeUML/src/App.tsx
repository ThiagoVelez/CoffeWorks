import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FilePlus,
  FolderOpen,
  SaveAll,
  Home,
  Undo2,
  Redo2,
  Copy,
  Scissors,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  LayoutGrid,
  Code2,
  Image as ImageIcon,
  FileImage,
  FileText,
  Database,
  Info,
  Keyboard,
  BookOpen,
  Grid3x3,
  BringToFront,
  SendToBack,
  MousePointer2,
  Plus,
  Upload,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askChoice, showMessage, toast } from "./components/Dialogs";
import { Canvas, type CanvasHandle, type CanvasTool, type Viewport } from "./components/Canvas";
import { Explorer } from "./components/Explorer";
import { Properties } from "./components/Properties";
import { CodeDialog, NewDiagramDialog } from "./components/Dialogs2";
import { APP_ID, DEFAULT_TITLE, EXTENSION, OPEN_FILTERS, ensureExtension, openPath, openWebEntry, persistDocument, rememberOpened, type OpenedDocument } from "./services/store";
import { addEdge, addNodes, cloneItems, currentDiagram, newDiagram, newDocument, newId, parseDocument, removeItems, reorder, serializeDocument, updateNodes, withDiagram } from "./services/model";
import { autoLayout } from "./services/layout";
import { diagramPng, diagramSvg, diagramsPdf } from "./services/exporters";
import { importSql } from "./services/codegen";
import { appWindow, bytesToText, getLaunchArgs, isTauri, listRecent, pickOpenFile, renameInVault, saveFileAs, setPinned, stripExtension, type RecentEntry } from "./services/desktop";
import { ACCENT, kindInfo, type DEdge, type DNode, type Diagram, type DiagramDocument, type DiagramKind } from "./types";

const HISTORY_LIMIT = 150;
const AUTOSAVE_DELAY = 1200;

interface HistoryState {
  stack: DiagramDocument[];
  index: number;
  lastKey: string;
  lastTime: number;
}

const DiagramLogo = <img src="/app-icon.png" alt="" className="w-full h-full" draggable={false} />;

export const App: React.FC = () => {
  const [doc, setDoc] = useState<DiagramDocument | null>(null);
  const docRef = useRef<DiagramDocument | null>(null);
  const history = useRef<HistoryState>({ stack: [], index: 0, lastKey: "", lastTime: 0 });
  const [, setTick] = useState(0);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [docId, setDocId] = useState(() => newId("cuml"));
  const [location, setLocation] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<number | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const stateRef = useRef({ title, docId, location, isStarred });
  stateRef.current = { title, docId, location, isStarred };

  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<CanvasTool>({ mode: "select" });
  const [viewport, setViewport] = useState<Viewport>({ x: 60, y: 60, zoom: 1 });
  const viewports = useRef(new Map<string, Viewport>());
  const [snap, setSnap] = useState(true);
  const [newDialog, setNewDialog] = useState<"document" | "diagram" | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const canvasRef = useRef<CanvasHandle>(null);
  const clipboard = useRef<{ nodes: DNode[]; edges: DEdge[] } | null>(null);
  const startedRef = useRef(false);

  const loaded = doc !== null;
  const diagram = doc ? currentDiagram(doc) : null;
  const refreshRecents = useCallback(async () => setRecents(await listRecent(APP_ID)), []);
  const reportError = (err: unknown, fallback: string) => void showMessage("Algo salió mal", err instanceof Error ? err.message : String(err || fallback));

  // ---------------------------------------------------------------------------
  // Guardado e historial
  // ---------------------------------------------------------------------------

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const current = docRef.current;
    if (!current) return true;
    if (savingRef.current) await savingRef.current;
    const run = (async () => {
      const { title: t, docId: id, location: loc, isStarred: pinned } = stateRef.current;
      setSaveStatus("saving");
      try {
        let target = loc;
        if (target && isTauri && !target.startsWith("web:")) target = await renameInVault(target, ensureExtension(t || DEFAULT_TITLE), id);
        const saved = await persistDocument(current, t || DEFAULT_TITLE, id, target, pinned);
        setLocation(saved);
        stateRef.current.location = saved;
        setSaveStatus(docRef.current === current ? "saved" : "dirty");
        return true;
      } catch (err) {
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

  const applyDoc = useCallback(
    (next: DiagramDocument, key = "") => {
      const h = history.current;
      const now = Date.now();
      if (key && key === h.lastKey && now - h.lastTime < 4000 && h.index === h.stack.length - 1) h.stack[h.index] = next;
      else {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(next);
        if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
        h.index = h.stack.length - 1;
      }
      h.lastKey = key;
      h.lastTime = now;
      docRef.current = next;
      setDoc(next);
      setTick((t) => t + 1);
      scheduleSave();
    },
    [scheduleSave]
  );

  const applyDiagram = useCallback(
    (d: Diagram, key = "") => {
      const current = docRef.current;
      if (current) applyDoc(withDiagram(current, d), key);
    },
    [applyDoc]
  );

  const travel = (delta: number) => {
    const h = history.current;
    const target = h.index + delta;
    if (target < 0 || target >= h.stack.length) return;
    h.index = target;
    h.lastKey = "";
    docRef.current = h.stack[target];
    setDoc(h.stack[target]);
    const d = currentDiagram(h.stack[target]);
    setSelection((s) => s.filter((id) => d.nodes[id] || d.edges[id]));
    setTick((t) => t + 1);
    scheduleSave();
  };

  // ---------------------------------------------------------------------------
  // Abrir y crear
  // ---------------------------------------------------------------------------

  const fitSoon = () => window.setTimeout(() => canvasRef.current?.fit(), 40);

  const loadDoc = useCallback(async (file: OpenedDocument, pinned = false) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    docRef.current = file.doc;
    history.current = { stack: [file.doc], index: 0, lastKey: "", lastTime: 0 };
    setDoc(file.doc);
    setSelection([]);
    setTool({ mode: "select" });
    setTick((t) => t + 1);
    const name = stripExtension(file.name) || DEFAULT_TITLE;
    setTitle(name);
    setDocId(file.docId);
    setLocation(file.location);
    setIsStarred(pinned);
    setSaveStatus("saved");
    setShowStartScreen(false);
    stateRef.current = { title: name, docId: file.docId, location: file.location, isStarred: pinned };
    viewports.current.clear();
    if (Object.keys(currentDiagram(file.doc).nodes).length) fitSoon();
    else setViewport({ x: 60, y: 60, zoom: 1 });
    if (file.location) await rememberOpened(file);
  }, []);

  const flush = useCallback(async () => {
    if (docRef.current && (saveTimer.current || savingRef.current)) await saveNow();
    return true;
  }, [saveNow]);

  const createDocument = async (kind: DiagramKind, newTitle?: string) => {
    await flush();
    await loadDoc({ name: `${newTitle || DEFAULT_TITLE}.${EXTENSION}`, doc: newDocument(kind), location: null, docId: newId("cuml") });
    scheduleSave();
  };

  const handleOpen = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir modelo");
      if (!picked) return;
      await flush();
      await loadDoc({ name: picked.name, doc: parseDocument(bytesToText(picked.bytes)), location: picked.path, docId: newId("cuml") });
      if (!picked.path) scheduleSave();
    } catch (err) {
      reportError(err, "No se pudo abrir el modelo.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, loadDoc, scheduleSave]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flush();
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("El modelo ya no está en el almacenamiento del navegador.");
        await loadDoc(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró el modelo.");
        void refreshRecents();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, loadDoc, refreshRecents]
  );

  const pendingTitle = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          await loadDoc(await openPath(args.file));
          return;
        }
        if (args.docId) {
          const file = await openWebEntry(args.docId);
          if (file) {
            await loadDoc(file);
            return;
          }
        }
        if (args.payload) {
          await loadDoc({ name: `${DEFAULT_TITLE}.${EXTENSION}`, doc: parseDocument(args.payload), location: null, docId: newId("cuml") });
          return;
        }
        if (args.newTitle !== null) {
          pendingTitle.current = args.newTitle || DEFAULT_TITLE;
          setNewDialog("document");
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir el modelo.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE} - CoffeeUML` : "CoffeeUML");
  }, [loaded, title]);

  const handleSaveAs = async () => {
    const current = docRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(ensureExtension(title || DEFAULT_TITLE), OPEN_FILTERS, serializeDocument(current), "Guardar modelo como");
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        setLocation(path);
        setTitle(stripExtension(name));
        stateRef.current = { ...stateRef.current, location: path, title: stripExtension(name) };
        await rememberOpened({ name, doc: current, location: path, docId });
        setSaveStatus("saved");
        toast("Modelo guardado en la nueva ubicación");
      } else toast("Modelo descargado");
    } catch (err) {
      reportError(err, "No se pudo guardar.");
    }
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    stateRef.current.isStarred = next;
    if (location) await setPinned(docId, next);
    toast(next ? "Modelo fijado en el Launcher" : "Modelo desfijado");
  };

  // ---------------------------------------------------------------------------
  // Diagramas
  // ---------------------------------------------------------------------------

  const switchDiagram = (id: string) => {
    const current = docRef.current;
    if (!current || id === current.current) return;
    viewports.current.set(current.current, viewport);
    applyDoc({ ...current, current: id }, "switch");
    setSelection([]);
    setTool({ mode: "select" });
    const saved = viewports.current.get(id);
    if (saved) setViewport(saved);
    else fitSoon();
  };

  const addDiagram = (kind: DiagramKind) => {
    const current = docRef.current;
    if (!current) return;
    const d = newDiagram(kind);
    viewports.current.set(current.current, viewport);
    applyDoc({ ...current, diagrams: [...current.diagrams, d], current: d.id });
    setSelection([]);
    setViewport({ x: 60, y: 60, zoom: 1 });
  };

  const deleteDiagram = async (id: string) => {
    const current = docRef.current;
    if (!current || current.diagrams.length < 2) return;
    const d = current.diagrams.find((x) => x.id === id);
    const choice = await askChoice({ title: "Eliminar diagrama", message: `¿Eliminar «${d?.name}» y todo su contenido?`, choices: [{ id: "no", label: "Cancelar" }, { id: "yes", label: "Eliminar", danger: true }] });
    if (choice !== "yes") return;
    const diagrams = current.diagrams.filter((x) => x.id !== id);
    applyDoc({ ...current, diagrams, current: current.current === id ? diagrams[0].id : current.current });
    setSelection([]);
  };

  const duplicateDiagram = (id: string) => {
    const current = docRef.current;
    const d = current?.diagrams.find((x) => x.id === id);
    if (!current || !d) return;
    const { nodes, edges } = cloneItems(d, Object.keys(d.nodes), 0, 0);
    let copy = addNodes(newDiagram(d.kind, `${d.name} (copia)`), nodes);
    for (const e of edges) copy = addEdge(copy, e);
    applyDoc({ ...current, diagrams: [...current.diagrams, copy], current: copy.id });
  };

  // ---------------------------------------------------------------------------
  // Edición
  // ---------------------------------------------------------------------------

  const deleteSelection = () => {
    if (!diagram || !selection.length) return;
    applyDiagram(removeItems(diagram, selection));
    setSelection([]);
  };

  const copySelection = (cut = false) => {
    if (!diagram) return;
    const ids = selection.filter((id) => diagram.nodes[id]);
    if (!ids.length) return;
    clipboard.current = cloneItems(diagram, ids, 0, 0);
    if (cut) deleteSelection();
    toast(cut ? "Cortado" : "Copiado", "info");
  };

  const paste = () => {
    if (!diagram || !clipboard.current) return;
    const temp: Diagram = { ...diagram, nodes: Object.fromEntries(clipboard.current.nodes.map((n) => [n.id, n])), edges: Object.fromEntries(clipboard.current.edges.map((e) => [e.id, e])), order: clipboard.current.nodes.map((n) => n.id) };
    const { nodes, edges } = cloneItems(temp, Object.keys(temp.nodes), 30, 30);
    let next = addNodes(diagram, nodes);
    for (const e of edges) next = addEdge(next, e);
    applyDiagram(next);
    setSelection([...nodes.map((n) => n.id), ...edges.map((e) => e.id)]);
    clipboard.current = { nodes, edges };
  };

  const duplicateSelection = () => {
    if (!diagram) return;
    const ids = selection.filter((id) => diagram.nodes[id]);
    if (!ids.length) return;
    const { nodes, edges } = cloneItems(diagram, ids);
    let next = addNodes(diagram, nodes);
    for (const e of edges) next = addEdge(next, e);
    applyDiagram(next);
    setSelection([...nodes.map((n) => n.id), ...edges.map((e) => e.id)]);
  };

  const runAutoLayout = () => {
    if (!diagram) return;
    applyDiagram(autoLayout(diagram));
    fitSoon();
  };

  const nudge = (dx: number, dy: number) => {
    if (!diagram) return;
    const patches: Record<string, Partial<DNode>> = {};
    for (const id of selection) if (diagram.nodes[id]) patches[id] = { x: diagram.nodes[id].x + dx, y: diagram.nodes[id].y + dy };
    if (Object.keys(patches).length) applyDiagram(updateNodes(diagram, patches), "nudge");
  };

  // ---------------------------------------------------------------------------
  // Exportar e importar
  // ---------------------------------------------------------------------------

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "_").trim() || "diagrama";

  const exportAs = async (format: "png" | "svg" | "pdf") => {
    if (!doc || !diagram) return;
    try {
      const ids = selection.filter((id) => diagram.nodes[id]);
      if (format === "pdf") {
        const choice = doc.diagrams.length > 1 ? await askChoice({ title: "Exportar a PDF", message: "¿Qué quieres exportar?", choices: [{ id: "one", label: "Este diagrama" }, { id: "all", label: `Todos (${doc.diagrams.length})`, primary: true }] }) : "one";
        if (!choice) return;
        const blob = await diagramsPdf(choice === "all" ? doc.diagrams : [diagram]);
        const path = await saveFileAs(`${safe(choice === "all" ? title : diagram.name)}.pdf`, [{ name: "PDF", extensions: ["pdf"] }], blob, "Exportar a PDF");
        if (path !== null) toast("PDF exportado");
        return;
      }
      if (format === "svg") {
        const { svg } = await diagramSvg(diagram, ids);
        const path = await saveFileAs(`${safe(diagram.name)}.svg`, [{ name: "Imagen SVG", extensions: ["svg"] }], svg, "Exportar a SVG");
        if (path !== null) toast("SVG exportado");
        return;
      }
      const blob = await diagramPng(diagram, 2, ids);
      const path = await saveFileAs(`${safe(diagram.name)}.png`, [{ name: "Imagen PNG", extensions: ["png"] }], blob, "Exportar a PNG");
      if (path !== null) toast("PNG exportado");
    } catch (err) {
      reportError(err, "No se pudo exportar.");
    }
  };

  const importSqlFile = async () => {
    const current = docRef.current;
    if (!current) return;
    try {
      const picked = await pickOpenFile([{ name: "Script SQL", extensions: ["sql", "txt"] }], "Importar script SQL");
      if (!picked) return;
      let target = currentDiagram(current);
      let next = current;
      if (target.kind !== "er") {
        target = newDiagram("er", `Modelo de ${stripExtension(picked.name)}`);
        next = { ...current, diagrams: [...current.diagrams, target], current: target.id };
      }
      const { diagram: d, tables } = importSql(target, bytesToText(picked.bytes));
      if (!tables) throw new Error("El archivo no contiene sentencias CREATE TABLE.");
      applyDoc(withDiagram(next, d));
      setSelection([]);
      fitSoon();
      toast(`${tables} tablas importadas`);
    } catch (err) {
      reportError(err, "No se pudo importar el script.");
    }
  };

  const saveCode = async (text: string, name: string, ext: string, label: string) => {
    try {
      const path = await saveFileAs(`${safe(name)}.${ext}`, [{ name: label, extensions: [ext] }], text, "Guardar código");
      if (path !== null) toast("Código guardado");
    } catch (err) {
      reportError(err, "No se pudo guardar.");
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado al portapapeles");
    } catch {
      await showMessage("Copia este texto", text);
    }
  };

  // ---------------------------------------------------------------------------
  // Atajos
  // ---------------------------------------------------------------------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!loaded || showStartScreen || document.querySelector("[data-modal-open]")) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const handled = () => e.preventDefault();
    if (e.altKey && key === "/") {
      handled();
      setCommandSearchOpen(true);
    } else if (ctrl && key === "s") {
      handled();
      if (e.shiftKey) void handleSaveAs();
      else void saveNow().then((ok) => ok && toast("Modelo guardado"));
    } else if (ctrl && key === "z") {
      handled();
      travel(e.shiftKey ? 1 : -1);
    } else if (ctrl && key === "y") {
      handled();
      travel(1);
    } else if (ctrl && key === "c") {
      handled();
      copySelection();
    } else if (ctrl && key === "x") {
      handled();
      copySelection(true);
    } else if (ctrl && key === "v") {
      handled();
      paste();
    } else if (ctrl && key === "d") {
      handled();
      duplicateSelection();
    } else if (ctrl && key === "a") {
      handled();
      if (diagram) setSelection([...Object.keys(diagram.nodes), ...Object.keys(diagram.edges)]);
    } else if (ctrl && e.shiftKey && key === "l") {
      handled();
      runAutoLayout();
    } else if (ctrl && e.shiftKey && key === "g") {
      handled();
      setCodeOpen(true);
    } else if (ctrl && (key === "=" || key === "+")) {
      handled();
      canvasRef.current?.zoomBy(1.2);
    } else if (ctrl && key === "-") {
      handled();
      canvasRef.current?.zoomBy(1 / 1.2);
    } else if (ctrl && key === "0") {
      handled();
      canvasRef.current?.fit();
    } else if (key === "delete" || key === "backspace") {
      handled();
      deleteSelection();
    } else if (key === "escape") {
      setTool({ mode: "select" });
      setSelection([]);
    } else if (key === "f2" && selection.length === 1) {
      handled();
      canvasRef.current?.editName(selection[0]);
    } else if (key === "v" && !ctrl) {
      setTool({ mode: "select" });
    } else if (key.startsWith("arrow")) {
      handled();
      const s = e.shiftKey ? 10 : 1;
      nudge(key === "arrowleft" ? -s : key === "arrowright" ? s : 0, key === "arrowup" ? -s : key === "arrowdown" ? s : 0);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---------------------------------------------------------------------------
  // Menús
  // ---------------------------------------------------------------------------

  const canUndo = history.current.index > 0;
  const canRedo = history.current.index < history.current.stack.length - 1;
  const has = selection.length > 0;

  const menus: MenuDefinition[] = [
    {
      id: "file",
      label: "Archivo",
      items: [
        { label: "Nuevo modelo…", icon: FilePlus, action: () => setNewDialog("document") },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpen() },
        { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void handleSaveAs() },
        { divider: true },
        { label: "Importar script SQL (crea tablas)…", icon: Database, action: () => void importSqlFile() },
        { label: "Exportar a PNG", icon: FileImage, action: () => void exportAs("png") },
        { label: "Exportar a SVG", icon: ImageIcon, action: () => void exportAs("svg") },
        { label: "Exportar a PDF", icon: FileText, action: () => void exportAs("pdf") },
        { divider: true },
        { label: "Pantalla de inicio", icon: Home, action: () => setShowStartScreen(true) },
      ],
    },
    {
      id: "edit",
      label: "Editar",
      items: [
        { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: () => travel(-1), disabled: !canUndo },
        { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Y", action: () => travel(1), disabled: !canRedo },
        { divider: true },
        { label: "Cortar", icon: Scissors, shortcut: "Ctrl+X", action: () => copySelection(true), disabled: !has },
        { label: "Copiar", icon: Copy, shortcut: "Ctrl+C", action: () => copySelection(), disabled: !has },
        { label: "Pegar", icon: ClipboardPaste, shortcut: "Ctrl+V", action: paste, disabled: !clipboard.current },
        { label: "Duplicar", icon: CopyPlus, shortcut: "Ctrl+D", action: duplicateSelection, disabled: !has },
        { label: "Eliminar", icon: Trash2, shortcut: "Supr", action: deleteSelection, disabled: !has },
        { divider: true },
        { label: "Traer al frente", icon: BringToFront, action: () => diagram && applyDiagram(reorder(diagram, selection, true)), disabled: !has },
        { label: "Enviar al fondo", icon: SendToBack, action: () => diagram && applyDiagram(reorder(diagram, selection, false)), disabled: !has },
      ],
    },
    {
      id: "model",
      label: "Modelo",
      items: [
        { label: "Nuevo diagrama…", icon: Plus, action: () => setNewDialog("diagram") },
        { label: "Organizar automáticamente", icon: LayoutGrid, shortcut: "Ctrl+Mayús+L", action: runAutoLayout },
        { label: "Generar código…", icon: Code2, shortcut: "Ctrl+Mayús+G", action: () => setCodeOpen(true) },
      ],
    },
    {
      id: "view",
      label: "Ver",
      items: [
        { label: "Acercar", icon: ZoomIn, shortcut: "Ctrl +", action: () => canvasRef.current?.zoomBy(1.2) },
        { label: "Alejar", icon: ZoomOut, shortcut: "Ctrl −", action: () => canvasRef.current?.zoomBy(1 / 1.2) },
        { label: "Ver todo el diagrama", icon: Maximize, shortcut: "Ctrl+0", action: () => canvasRef.current?.fit() },
        { label: "Ajustar a la cuadrícula", icon: Grid3x3, checked: snap, action: () => setSnap((s) => !s) },
      ],
    },
    {
      id: "help",
      label: "Ayuda",
      items: [
        {
          label: "Guía rápida",
          icon: BookOpen,
          action: () =>
            void showMessage(
              "Guía rápida",
              [
                "1. Un modelo reúne varios diagramas: añádelos con + en el panel Modelo (clases, casos de uso, secuencia, actividad, estados, componentes, despliegue, entidad-relación, flujo y mapas mentales).",
                "2. Elige una figura en la paleta y haz clic en el lienzo. Con Mayús puedes colocar varias.",
                "3. Para conectar: arrastra el círculo azul de una figura hasta otra, o elige el tipo de conexión en la paleta.",
                "4. Doble clic sobre un nombre, un atributo o una operación para editarlo en el propio diagrama. En el panel derecho están todos los detalles (tipos, visibilidad, claves, multiplicidades…).",
                "5. En los diagramas de secuencia, arrastra los mensajes hacia arriba o abajo para ordenarlos.",
                "6. Modelo › Generar código crea Java, C#, TypeScript, Python, SQL, Mermaid o PlantUML. Archivo › Importar SQL convierte un script en un modelo entidad-relación.",
              ].join("\n")
            ),
        },
        {
          label: "Atajos de teclado",
          icon: Keyboard,
          action: () =>
            void showMessage(
              "Atajos",
              "V: seleccionar · Esc: cancelar · F2 o doble clic: renombrar\nSupr: eliminar · Ctrl+D: duplicar · Ctrl+C / X / V: copiar, cortar, pegar\nCtrl+Z / Ctrl+Y: deshacer / rehacer · Flechas: mover (Mayús: 10)\nCtrl+0: ver todo · Ctrl + rueda: zoom · Espacio + arrastrar: mover la vista\nCtrl+Mayús+L: organizar · Ctrl+Mayús+G: generar código · Alt+/: buscar comando"
            ),
        },
        {
          label: "Acerca de CoffeeUML",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeeUML 1.0",
              "Modelado UML y diagramas de la suite CoffeeWorks.\n\nDiagramas de clases, objetos, paquetes, componentes, despliegue, casos de uso, secuencia, actividad y estados; modelos entidad-relación (pata de gallo y Chen), diagramas de flujo y mapas mentales. Genera código y SQL, importa scripts SQL y exporta a PNG, SVG y PDF."
            ),
        },
      ],
    },
  ];

  const toolbarBtn = "h-8 px-2.5 rounded-md text-[12px] flex items-center gap-1.5 text-[#2e6b58] hover:bg-[#e3f1ec]";

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f8fb] select-none">
      {loaded && doc && diagram && (
        <>
          <SuiteHeader
            logo={DiagramLogo}
            logoTitle="CoffeeUML"
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
            fileLocation={location}
            isStarred={isStarred}
            onToggleStar={() => void handleToggleStar()}
            onBeforeClose={async () => {
              await flush();
            }}
            actions={
              <button type="button" data-btn="export" onClick={() => void exportAs("png")} className="h-8 px-3 rounded-full text-[12px] font-semibold text-white flex items-center gap-1.5" style={{ background: ACCENT }}>
                <Upload size={14} /> Exportar
              </button>
            }
          />
          <div className="h-10 shrink-0 bg-white border-b border-[#e1e6ed] flex items-center gap-1 px-2" data-toolbar>
            <button type="button" className={`${toolbarBtn} ${tool.mode === "select" ? "bg-[#e3f1ec] font-semibold" : ""}`} onClick={() => setTool({ mode: "select" })} title="Seleccionar (V)">
              <MousePointer2 size={15} />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => travel(-1)} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
              <Undo2 size={15} />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => travel(1)} disabled={!canRedo} title="Rehacer (Ctrl+Y)">
              <Redo2 size={15} />
            </button>
            <div className="w-px h-5 bg-[#e1e6ed] mx-1" />
            <button type="button" className={toolbarBtn} onClick={() => canvasRef.current?.zoomBy(1 / 1.2)} title="Alejar">
              <ZoomOut size={15} />
            </button>
            <span className="text-[11.5px] font-mono text-[#5b6b7b] w-11 text-center">{Math.round(viewport.zoom * 100)}%</span>
            <button type="button" className={toolbarBtn} onClick={() => canvasRef.current?.zoomBy(1.2)} title="Acercar">
              <ZoomIn size={15} />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => canvasRef.current?.fit()} title="Ver todo (Ctrl+0)">
              <Maximize size={15} />
            </button>
            <button type="button" className={`${toolbarBtn} ${snap ? "bg-[#e3f1ec]" : ""}`} onClick={() => setSnap((s) => !s)} title="Ajustar a la cuadrícula">
              <Grid3x3 size={15} />
            </button>
            <div className="w-px h-5 bg-[#e1e6ed] mx-1" />
            <button type="button" className={toolbarBtn} data-btn="layout-top" onClick={runAutoLayout} title="Organizar automáticamente (Ctrl+Mayús+L)">
              <LayoutGrid size={15} /> Organizar
            </button>
            <button type="button" className={toolbarBtn} data-btn="code-top" onClick={() => setCodeOpen(true)} title="Generar código (Ctrl+Mayús+G)">
              <Code2 size={15} /> Código
            </button>
            <button type="button" className={toolbarBtn} onClick={() => void importSqlFile()} title="Importar un script SQL como modelo entidad-relación">
              <Database size={15} /> Importar SQL
            </button>
            <div className="flex-1" />
            <span className="text-[12px] text-[#5b6b7b] pr-2">{kindInfo(diagram.kind).label}</span>
          </div>
          <div className="flex-1 flex min-h-0">
            <Explorer
              doc={doc}
              selection={selection}
              tool={tool}
              onTool={setTool}
              onSelect={setSelection}
              onSwitch={switchDiagram}
              onAddDiagram={() => setNewDialog("diagram")}
              onRename={(id, name) => applyDoc({ ...doc, diagrams: doc.diagrams.map((d) => (d.id === id ? { ...d, name } : d)) })}
              onDelete={(id) => void deleteDiagram(id)}
              onDuplicate={duplicateDiagram}
            />
            <Canvas
              ref={canvasRef}
              diagram={diagram}
              selection={selection}
              onSelect={setSelection}
              tool={tool}
              onToolDone={() => setTool({ mode: "select" })}
              viewport={viewport}
              onViewport={setViewport}
              onChange={applyDiagram}
              snap={snap}
            />
            <Properties diagram={diagram} selection={selection} onChange={applyDiagram} onAutoLayout={runAutoLayout} onCode={() => setCodeOpen(true)} />
          </div>
        </>
      )}

      {newDialog && (
        <NewDiagramDialog
          title={newDialog === "document" ? "Nuevo modelo: elige el primer diagrama" : "Nuevo diagrama"}
          onClose={() => setNewDialog(null)}
          onPick={(kind) => {
            const which = newDialog;
            setNewDialog(null);
            if (which === "document" || !docRef.current) void createDocument(kind, pendingTitle.current);
            else addDiagram(kind);
            pendingTitle.current = undefined;
          }}
        />
      )}
      {codeOpen && diagram && <CodeDialog diagram={diagram} onClose={() => setCodeOpen(false)} onSave={(t, n, x, l) => void saveCode(t, n, x, l)} onCopy={(t) => void copyText(t)} />}

      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeeUML"
          tagline="Modelado UML y diagramas • CoffeeWorks"
          accent={ACCENT}
          newHint="Crear un modelo con diagramas UML, ER o de flujo"
          openHint="Abrir un modelo .cuml"
          formats={[`.${EXTENSION}`]}
          recents={recents}
          onNew={() => setNewDialog("document")}
          onOpen={() => void handleOpen()}
          onOpenRecent={(entry) => void handleOpenRecent(entry)}
          onContinue={loaded ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      <DialogHost />
    </div>
  );
};
