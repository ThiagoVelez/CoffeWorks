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
  Group,
  Ungroup,
  Frame,
  Diamond,
  Rows3,
  BringToFront,
  SendToBack,
  ZoomIn,
  ZoomOut,
  Maximize,
  Play,
  Upload,
  Image as ImageIcon,
  Keyboard,
  Info,
  BookOpen,
  Lock,
  EyeOff,
  Link2,
} from "lucide-react";
import { type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askChoice, showMessage, toast } from "./components/Dialogs";
import { TopBar } from "./components/TopBar";
import { Canvas, type CanvasHandle, type Viewport } from "./components/Canvas";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel, type RightTab } from "./components/RightPanel";
import { PresentView } from "./components/PresentView";
import { ExportDialog, type ExportRequest } from "./components/ExportDialog";
import { APP_ID, DEFAULT_TITLE, EXTENSION, OPEN_FILTERS, ensureExtension, openPath, openWebEntry, persistDocument, rememberOpened, type OpenedDocument } from "./services/store";
import {
  DEFAULT_LAYOUT,
  absoluteBox,
  applyLayouts,
  cloneSubtrees,
  currentPage,
  deleteNodes,
  detachInstance,
  duplicate,
  findComponent,
  groupNodes,
  insertNodes,
  makeComponent,
  makeInstance,
  makeNode,
  newDocument,
  newId,
  newPage,
  parentMap,
  parseDocument,
  reorder,
  serializeDocument,
  topFrames,
  topLevelOnly,
  ungroup,
  unionBox,
  updateNodes,
  withPage,
} from "./services/model";
import { KITS, buildSpec } from "./services/kits";
import { exportBox, exportHtml, exportHtmlSingle, exportPdf, exportRaster, exportSvg, nodeCss, cssText } from "./services/exporters";
import { makeZip, type ZipEntry } from "./services/zip";
import { appWindow, bytesToText, getLaunchArgs, isTauri, listRecent, pickOpenFile, renameInVault, saveFileAs, setPinned, stripExtension, type RecentEntry } from "./services/desktop";
import { ACCENT_DARK, DEVICES, PLATFORM_LABEL, isContainer, type Page, type Platform, type Tool, type UNode, type UxDocument } from "./types";

const HISTORY_LIMIT = 150;
const AUTOSAVE_DELAY = 1200;
const IMAGE_FILTERS = [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }];

interface HistoryState {
  stack: UxDocument[];
  index: number;
  lastKey: string;
  lastTime: number;
}

const bytesToDataUrl = (bytes: Uint8Array, name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "png";
  const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }));
  });
};

const imageSize = (src: string) =>
  new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 200 });
    img.onerror = () => resolve({ w: 300, h: 200 });
    img.src = src;
  });

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "_").trim() || "diseño";

export const App: React.FC = () => {
  const [doc, setDoc] = useState<UxDocument | null>(null);
  const docRef = useRef<UxDocument | null>(null);
  const history = useRef<HistoryState>({ stack: [], index: 0, lastKey: "", lastTime: 0 });
  const [, setTick] = useState(0);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [docId, setDocId] = useState(() => newId("cux"));
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
  const [tool, setTool] = useState<Tool>("move");
  const [rightTab, setRightTab] = useState<RightTab>("design");
  const [viewport, setViewport] = useState<Viewport>({ x: 120, y: 80, zoom: 1 });
  const viewports = useRef(new Map<string, Viewport>());
  const [presenting, setPresenting] = useState<string | null | false>(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<CanvasHandle>(null);
  const clipboard = useRef<{ nodes: UNode[]; roots: string[] } | null>(null);
  const startedRef = useRef(false);

  const loaded = doc !== null;
  const page = doc ? currentPage(doc) : null;
  const refreshRecents = useCallback(async () => setRecents(await listRecent(APP_ID)), []);
  const reportError = (err: unknown, fallback: string) => void showMessage("Algo salió mal", err instanceof Error ? err.message : String(err || fallback));

  // ---------------------------------------------------------------------------
  // Guardado automático e historial
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
    (next: UxDocument, key = "") => {
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

  const applyPage = useCallback(
    (next: Page, key = "") => {
      const d = docRef.current;
      if (d) applyDoc(withPage(d, next), key);
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
    const pg = currentPage(h.stack[target]);
    setSelection((s) => s.filter((id) => pg.nodes[id]));
    setTick((t) => t + 1);
    scheduleSave();
  };

  // ---------------------------------------------------------------------------
  // Abrir, crear
  // ---------------------------------------------------------------------------

  const fitInitial = (d: UxDocument) => {
    viewports.current.clear();
    window.setTimeout(() => {
      const pg = currentPage(d);
      canvasRef.current?.zoomTo(unionBox(pg.children.map((id) => absoluteBox(pg, id))));
    }, 30);
  };

  const loadDoc = useCallback(async (file: OpenedDocument, pinned = false) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    docRef.current = file.doc;
    history.current = { stack: [file.doc], index: 0, lastKey: "", lastTime: 0 };
    setDoc(file.doc);
    setSelection([]);
    setTool("move");
    setTick((t) => t + 1);
    const name = stripExtension(file.name) || DEFAULT_TITLE;
    setTitle(name);
    setDocId(file.docId);
    setLocation(file.location);
    setIsStarred(pinned);
    setSaveStatus("saved");
    setShowStartScreen(false);
    stateRef.current = { title: name, docId: file.docId, location: file.location, isStarred: pinned };
    fitInitial(file.doc);
    if (file.location) await rememberOpened(file);
  }, []);

  const flush = useCallback(async () => {
    if (docRef.current && (saveTimer.current || savingRef.current)) await saveNow();
    return true;
  }, [saveNow]);

  const handleNew = useCallback(
    async (newTitle?: string, platform?: Platform) => {
      let p = platform;
      if (!p) {
        const choice = await askChoice({
          title: "Nuevo diseño",
          message: "¿Para qué vas a diseñar? Se crea la primera pantalla con el tamaño adecuado y la biblioteca muestra sus elementos.",
          choices: [
            { id: "mobile", label: "📱 App móvil" },
            { id: "desktop", label: "🖥 App de escritorio" },
            { id: "web", label: "🌐 Página web" },
          ],
        });
        if (!choice) return;
        p = choice as Platform;
      }
      await flush();
      await loadDoc({ name: `${newTitle || DEFAULT_TITLE}.${EXTENSION}`, doc: newDocument(p), location: null, docId: newId("cux") });
      scheduleSave();
    },
    [flush, loadDoc, scheduleSave]
  );

  const handleOpen = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir diseño");
      if (!picked) return;
      await flush();
      await loadDoc({ name: picked.name, doc: parseDocument(bytesToText(picked.bytes)), location: picked.path, docId: newId("cux") });
      if (!picked.path) scheduleSave();
    } catch (err) {
      reportError(err, "No se pudo abrir el diseño.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, loadDoc, scheduleSave]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flush();
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("El diseño ya no está en el almacenamiento del navegador.");
        await loadDoc(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró el diseño.");
        void refreshRecents();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, loadDoc, refreshRecents]
  );

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
          await loadDoc({ name: `${DEFAULT_TITLE}.${EXTENSION}`, doc: parseDocument(args.payload), location: null, docId: newId("cux") });
          return;
        }
        if (args.newTitle !== null) {
          await handleNew(args.newTitle || DEFAULT_TITLE);
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir el diseño.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE} - CoffeeUI/UX` : "CoffeeUI/UX");
  }, [loaded, title]);

  const handleSaveAs = async () => {
    const current = docRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(ensureExtension(title || DEFAULT_TITLE), OPEN_FILTERS, serializeDocument(current), "Guardar diseño como");
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        setLocation(path);
        setTitle(stripExtension(name));
        stateRef.current = { ...stateRef.current, location: path, title: stripExtension(name) };
        await rememberOpened({ name, doc: current, location: path, docId });
        setSaveStatus("saved");
        toast("Diseño guardado en la nueva ubicación");
      } else toast("Diseño descargado");
    } catch (err) {
      reportError(err, "No se pudo guardar.");
    }
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    stateRef.current.isStarred = next;
    if (location) await setPinned(docId, next);
    toast(next ? "Diseño fijado en el Launcher" : "Diseño desfijado");
  };

  // ---------------------------------------------------------------------------
  // Páginas y vista
  // ---------------------------------------------------------------------------

  const switchPage = (id: string) => {
    const d = docRef.current;
    if (!d || id === d.currentPage) return;
    viewports.current.set(d.currentPage, viewport);
    applyDoc({ ...d, currentPage: id }, "page-switch");
    setSelection([]);
    const saved = viewports.current.get(id);
    if (saved) setViewport(saved);
    else
      window.setTimeout(() => {
        const pg = currentPage(docRef.current!);
        canvasRef.current?.zoomTo(unionBox(pg.children.map((c) => absoluteBox(pg, c))));
      }, 20);
  };

  const addPage = () => {
    const d = docRef.current;
    if (!d) return;
    const pg = newPage(`Página ${d.pages.length + 1}`);
    viewports.current.set(d.currentPage, viewport);
    applyDoc({ ...d, pages: [...d.pages, pg], currentPage: pg.id });
    setSelection([]);
    setViewport({ x: 120, y: 80, zoom: 1 });
  };

  const deletePage = async (id: string) => {
    const d = docRef.current;
    if (!d || d.pages.length < 2) return;
    const choice = await askChoice({ title: "Eliminar página", message: `¿Eliminar «${d.pages.find((p) => p.id === id)?.name}» y todo su contenido?`, choices: [{ id: "no", label: "Cancelar" }, { id: "yes", label: "Eliminar", danger: true }] });
    if (choice !== "yes") return;
    const pages = d.pages.filter((p) => p.id !== id);
    applyDoc({ ...d, pages, currentPage: d.currentPage === id ? pages[0].id : d.currentPage });
    setSelection([]);
  };

  const zoom = (action: "in" | "out" | "100" | "fit" | "selection") => {
    if (!page) return;
    if (action === "in") canvasRef.current?.zoomBy(1.25);
    else if (action === "out") canvasRef.current?.zoomBy(0.8);
    else if (action === "100") {
      const c = canvasRef.current?.center();
      if (c) setViewport((v) => ({ zoom: 1, x: v.x + (c.x * v.zoom - c.x), y: v.y + (c.y * v.zoom - c.y) }));
    } else if (action === "fit") canvasRef.current?.zoomTo(unionBox(page.children.map((id) => absoluteBox(page, id))));
    else canvasRef.current?.zoomTo(unionBox(selection.filter((id) => page.nodes[id]).map((id) => absoluteBox(page, id))));
  };

  const zoomToNode = (id: string) => {
    if (page?.nodes[id]) canvasRef.current?.zoomTo(absoluteBox(page, id));
  };

  // ---------------------------------------------------------------------------
  // Insertar
  // ---------------------------------------------------------------------------

  /** Contenedor donde se insertan los elementos nuevos: el marco seleccionado o el de la selección. */
  const insertionParent = (pg: Page): string | null => {
    const parents = parentMap(pg);
    const first = selection.find((id) => pg.nodes[id]);
    if (!first) return null;
    const n = pg.nodes[first];
    if (n.type === "frame" || n.type === "component") return first;
    let p = parents.get(first) ?? null;
    while (p && !(pg.nodes[p].type === "frame" || pg.nodes[p].type === "component")) p = parents.get(p) ?? null;
    return p;
  };

  const placeNodes = (created: UNode[], root: string, at: { x: number; y: number } | null, parent: string | null, dock?: "top" | "bottom" | "left") => {
    if (!page) return;
    // Primero se calcula su diseño automático para conocer su tamaño real
    const laid = applyLayouts({ ...page, nodes: Object.fromEntries(created.map((n) => [n.id, n])), children: [root] });
    created = created.map((n) => ({ ...laid.nodes[n.id] }));
    const r = created.find((n) => n.id === root)!;
    const parents = parentMap(page);
    let x: number;
    let y: number;
    if (at) {
      const base = parent ? absoluteBox(page, parent, parents) : { x: 0, y: 0 };
      x = at.x - base.x - r.w / 2;
      y = at.y - base.y - r.h / 2;
    } else if (parent) {
      const pn = page.nodes[parent];
      const kids = (pn.children || []).map((c) => page.nodes[c]).filter((k) => k?.visible);
      // Las barras se pegan a su borde, ocupando todo el ancho de la pantalla
      if (dock === "top" || dock === "bottom" || dock === "left") {
        if (dock !== "left" && r.sizing.w === "fixed" && r.w > pn.w * 0.6) r.w = pn.w;
        if (dock === "left") r.h = pn.h;
        // Barras ya pegadas arriba y abajo (una debajo de otra)
        const wide = kids.filter((k) => k.w > pn.w * 0.6);
        let topEdge = 0;
        for (const k of [...wide].sort((a, b) => a.y - b.y)) if (k.y <= topEdge + 1) topEdge = Math.max(topEdge, k.y + k.h);
        let bottomEdge = pn.h;
        for (const k of [...wide].sort((a, b) => b.y + b.h - (a.y + a.h))) if (k.y + k.h >= bottomEdge - 1 && k.y > topEdge) bottomEdge = Math.min(bottomEdge, k.y);
        x = 0;
        y = dock === "bottom" ? bottomEdge - r.h : topEdge;
        if (dock === "left") r.h = Math.max(40, bottomEdge - topEdge);
      } else {
        // Debajo del último elemento, centrado (o al centro si no cabe)
        const docked = kids.filter((k) => k.w > pn.w * 0.6 && k.y + k.h > pn.h - 4);
        const limit = docked.length ? Math.min(...docked.map((k) => k.y)) : pn.h;
        const flow = kids.filter((k) => !docked.includes(k));
        const below = flow.length ? Math.max(...flow.map((k) => k.y + k.h)) + 16 : 24;
        x = Math.max(0, (pn.w - r.w) / 2);
        y = below + r.h <= limit ? below : Math.max(0, (pn.h - r.h) / 2);
      }
    } else {
      const c = canvasRef.current?.center() || { x: 0, y: 0 };
      x = c.x - r.w / 2;
      y = c.y - r.h / 2;
    }
    r.x = Math.round(x);
    r.y = Math.round(y);
    applyPage(insertNodes(page, created, parent, [root]), `insert-${root}`);
    setSelection([root]);
    setTool("move");
  };

  const insertKit = (kitId: string, at: { x: number; y: number } | null = null, parent?: string | null) => {
    const kit = KITS.find((k) => k.id === kitId);
    if (!kit || !page) return;
    const { nodes, root } = buildSpec(kit.build());
    placeNodes(nodes, root, at, parent === undefined ? insertionParent(page) : parent, kit.dock);
  };

  const insertComponent = (componentId: string, at: { x: number; y: number } | null = null, parent?: string | null) => {
    const d = docRef.current;
    if (!d || !page) return;
    const inst = makeInstance(d, componentId, 0, 0);
    if (!inst) return;
    placeNodes([inst], inst.id, at, parent === undefined ? insertionParent(page) : parent);
  };

  const insertDevice = (deviceId: string) => {
    const d = DEVICES.find((x) => x.id === deviceId);
    if (!d || !page) return;
    const frames = topFrames(page);
    const right = frames.length ? Math.max(...frames.map((f) => f.x + f.w)) + 80 : 0;
    const top = frames.length ? Math.min(...frames.map((f) => f.y)) : 0;
    const frame = makeNode("frame", { name: d.name, x: right, y: top, w: d.w, h: d.h, device: d.id });
    applyPage(insertNodes(page, [frame], null, [frame.id]));
    setSelection([frame.id]);
    setTool("move");
    window.setTimeout(() => canvasRef.current?.zoomTo({ x: frame.x, y: frame.y, w: frame.w, h: frame.h }), 20);
  };

  const insertImage = async (src: string, name: string, at: { x: number; y: number } | null = null, parent?: string | null) => {
    if (!page) return;
    const size = await imageSize(src);
    const scale = Math.min(1, 600 / Math.max(size.w, size.h));
    const node = makeNode("image", { name: stripExtension(name) || "Imagen", src, w: Math.round(size.w * scale), h: Math.round(size.h * scale), fill: null });
    placeNodes([node], node.id, at, parent === undefined ? insertionParent(page) : parent);
  };

  const pickImage = async () => {
    try {
      const picked = await pickOpenFile(IMAGE_FILTERS, "Elegir imagen");
      if (!picked || !page) return;
      const src = await bytesToDataUrl(picked.bytes, picked.name);
      const sel = selection.length === 1 ? page.nodes[selection[0]] : null;
      if (sel?.type === "image") applyPage(updateNodes(page, { [sel.id]: { src, fill: null } }));
      else if (sel && (sel.type === "rect" || sel.type === "ellipse")) {
        // Convertir la forma en imagen manteniendo su caja
        applyPage(updateNodes(page, { [sel.id]: { type: "image", src, fill: null, fit: "cover", radius: sel.type === "ellipse" ? Math.min(sel.w, sel.h) / 2 : sel.radius } }));
      } else await insertImage(src, picked.name);
    } catch (err) {
      reportError(err, "No se pudo abrir la imagen.");
    }
  };

  const onDropItem = async (data: DataTransfer, at: { x: number; y: number }, parent: string | null) => {
    const kit = data.getData("application/x-kit");
    const comp = data.getData("application/x-component");
    if (kit) insertKit(kit, at, parent);
    else if (comp) insertComponent(comp, at, parent);
    else if (data.files.length) {
      for (const file of Array.from(data.files)) {
        if (file.type.startsWith("image/")) {
          const src = await bytesToDataUrl(new Uint8Array(await file.arrayBuffer()), file.name);
          await insertImage(src, file.name, at, parent);
        } else if (file.name.toLowerCase().endsWith(`.${EXTENSION}`)) {
          await loadDoc({ name: file.name, doc: parseDocument(await file.text()), location: null, docId: newId("cux") });
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Edición
  // ---------------------------------------------------------------------------

  const sel = () => (page ? selection.filter((id) => page.nodes[id]) : []);

  const deleteSelection = () => {
    if (!page || !selection.length) return;
    applyPage(deleteNodes(page, selection));
    setSelection([]);
  };

  const duplicateSelection = () => {
    if (!page || !selection.length) return;
    const r = duplicate(page, sel());
    applyPage(r.page);
    setSelection(r.ids);
  };

  const copySelection = (cut = false) => {
    if (!page || !selection.length) return;
    const ids = topLevelOnly(page, sel());
    const parents = parentMap(page);
    // Se guardan con su posición absoluta para pegarlos en cualquier sitio
    const { nodes, roots } = cloneSubtrees(page, ids);
    for (const [i, id] of ids.entries()) {
      const abs = absoluteBox(page, id, parents);
      const root = nodes.find((n) => n.id === roots[i])!;
      root.x = abs.x;
      root.y = abs.y;
    }
    // Las instancias necesitan su componente: se conserva la referencia
    clipboard.current = { nodes, roots };
    try {
      void navigator.clipboard?.writeText(`coffeeuiux:${JSON.stringify({ nodes, roots })}`);
    } catch {
      // Sin acceso al portapapeles del sistema: queda la copia interna
    }
    if (cut) deleteSelection();
    toast(cut ? "Cortado" : "Copiado", "info");
  };

  const pasteNodes = (clip: { nodes: UNode[]; roots: string[] }) => {
    if (!page) return;
    const temp: Page = { ...page, nodes: Object.fromEntries(clip.nodes.map((n) => [n.id, n])), children: clip.roots };
    const { nodes, roots } = cloneSubtrees(temp, clip.roots);
    const parent = insertionParent(page);
    const base = parent ? absoluteBox(page, parent) : { x: 0, y: 0 };
    const parentNode = parent ? page.nodes[parent] : null;
    const inLayout = !!parentNode?.layout && parentNode.layout.mode !== "none";
    for (const r of roots) {
      const n = nodes.find((x) => x.id === r)!;
      // Si el original sigue en el mismo sitio, la copia se desplaza un poco
      const overlap = Object.values(page.nodes).some((o) => o.name === n.name && Math.abs(absoluteBox(page, o.id).x - n.x) < 1 && Math.abs(absoluteBox(page, o.id).y - n.y) < 1);
      n.x = Math.round(n.x - base.x + (overlap ? 16 : 0));
      n.y = Math.round(n.y - base.y + (overlap ? 16 : 0));
      if (parent && !inLayout && parentNode && (n.x > parentNode.w || n.y > parentNode.h || n.x + n.w < 0 || n.y + n.h < 0)) {
        n.x = Math.round((parentNode.w - n.w) / 2);
        n.y = Math.round((parentNode.h - n.h) / 2);
      }
    }
    applyPage(insertNodes(page, nodes, parent, roots));
    setSelection(roots);
  };

  const pasteFromSystem = async (e?: ClipboardEvent) => {
    const files = e?.clipboardData?.files;
    if (files && files.length) {
      for (const file of Array.from(files))
        if (file.type.startsWith("image/")) await insertImage(await bytesToDataUrl(new Uint8Array(await file.arrayBuffer()), file.name || "imagen.png"), file.name || "Imagen");
      return;
    }
    const text = e?.clipboardData?.getData("text/plain") || "";
    if (text.startsWith("coffeeuiux:")) {
      try {
        pasteNodes(JSON.parse(text.slice(11)));
        return;
      } catch {
        // texto dañado: se usa la copia interna
      }
    }
    if (clipboard.current) pasteNodes(clipboard.current);
    else if (text && page) {
      const node = makeNode("text", { text: text.slice(0, 2000) });
      placeNodes([node], node.id, null, insertionParent(page));
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!loaded || showStartScreen || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
      e.preventDefault();
      void pasteFromSystem(e);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const groupSelection = (type: "group" | "frame" = "group") => {
    if (!page || !selection.length) return;
    const r = groupNodes(page, sel(), type);
    if (r.id) {
      applyPage(r.page);
      setSelection([r.id]);
    }
  };

  const ungroupSelection = () => {
    if (!page || !selection.length) return;
    const r = ungroup(page, sel());
    applyPage(r.page);
    setSelection(r.ids);
  };

  /** Mayús+A: añade diseño automático al marco o envuelve la selección en uno. */
  const autoLayout = () => {
    if (!page || !selection.length) return;
    const ids = sel();
    const one = ids.length === 1 ? page.nodes[ids[0]] : null;
    if (one && (one.type === "frame" || one.type === "component")) {
      applyPage(updateNodes(page, { [one.id]: { layout: { ...(one.layout || DEFAULT_LAYOUT), mode: one.layout?.mode === "none" || !one.layout ? "column" : "none" } } }));
      return;
    }
    const r = groupNodes(page, ids, "frame");
    if (!r.id) return;
    const frame = r.page.nodes[r.id];
    const kids = (frame.children || []).map((c) => r.page.nodes[c]);
    const horizontal = kids.length > 1 && Math.max(...kids.map((k) => k.x)) - Math.min(...kids.map((k) => k.x)) > Math.max(...kids.map((k) => k.y)) - Math.min(...kids.map((k) => k.y));
    const sorted = [...(frame.children || [])].sort((a, b) => (horizontal ? r.page.nodes[a].x - r.page.nodes[b].x : r.page.nodes[a].y - r.page.nodes[b].y));
    const nodes = { ...r.page.nodes, [r.id]: { ...frame, name: "Diseño automático", children: sorted, layout: { ...DEFAULT_LAYOUT, mode: horizontal ? "row" : "column", padding: { top: 0, right: 0, bottom: 0, left: 0 } }, sizing: { w: "hug", h: "hug" } } } as Page["nodes"];
    applyPage(updateNodes({ ...r.page, nodes }, {}));
    setSelection([r.id]);
  };

  const makeComponentFromSelection = () => {
    if (!page) return;
    const ids = sel();
    if (!ids.length) return;
    let pg = page;
    let id = ids[0];
    if (ids.length > 1) {
      const g = groupNodes(page, ids, "frame");
      if (!g.id) return;
      pg = g.page;
      id = g.id;
    }
    const r = makeComponent(pg, id);
    applyPage(r.page);
    setSelection([r.id]);
    toast("Componente creado: arrástralo desde Recursos para usarlo");
  };

  const createInstanceOfSelected = () => {
    const d = docRef.current;
    if (!d || !page || selection.length !== 1) return;
    const comp = page.nodes[selection[0]];
    if (comp?.type !== "component") return;
    const parents = parentMap(page);
    const abs = absoluteBox(page, comp.id, parents);
    const inst = makeInstance(d, comp.id, abs.x + abs.w + 40, abs.y);
    if (!inst) return;
    applyPage(insertNodes(page, [inst], null, [inst.id]));
    setSelection([inst.id]);
  };

  const gotoComponent = () => {
    const d = docRef.current;
    if (!d || !page || selection.length !== 1) return;
    const inst = page.nodes[selection[0]];
    const found = inst?.componentId ? findComponent(d, inst.componentId) : null;
    if (!found) return;
    if (found.page.id !== d.currentPage) switchPage(found.page.id);
    window.setTimeout(() => {
      setSelection([found.node.id]);
      canvasRef.current?.zoomTo(absoluteBox(found.page, found.node.id));
    }, 40);
  };

  const nudge = (dx: number, dy: number) => {
    if (!page || !selection.length) return;
    const patches: Record<string, Partial<UNode>> = {};
    for (const id of topLevelOnly(page, sel())) patches[id] = { x: page.nodes[id].x + dx, y: page.nodes[id].y + dy };
    applyPage(updateNodes(page, patches), "nudge");
  };

  const toggleProp = (prop: "locked" | "visible") => {
    if (!page || !selection.length) return;
    const patches: Record<string, Partial<UNode>> = {};
    const value = !page.nodes[selection[0]][prop];
    for (const id of sel()) patches[id] = { [prop]: value };
    applyPage(updateNodes(page, patches));
  };

  // ---------------------------------------------------------------------------
  // Exportar
  // ---------------------------------------------------------------------------

  const saveBlob = async (blob: Blob, name: string, ext: string, label: string) => {
    const path = await saveFileAs(name, [{ name: label, extensions: [ext] }], blob, "Exportar");
    if (path !== null) toast(path ? "Exportación guardada" : "Exportación descargada");
  };

  const doExport = async ({ scope, format, scale }: ExportRequest) => {
    const d = docRef.current;
    if (!d || !page) return;
    try {
      const targets = scope === "selection" ? topLevelOnly(page, sel()) : topFrames(page).map((f) => f.id);
      if (!targets.length) throw new Error("No hay nada que exportar. Selecciona capas o crea marcos.");
      const base = safeName(scope === "selection" && targets.length === 1 ? page.nodes[targets[0]].name : title || DEFAULT_TITLE);
      if (format === "pdf") {
        const frames = targets.filter((id) => isContainer(page.nodes[id]) || page.nodes[id].type === "instance");
        const blob = frames.length ? await exportPdf(d, page, frames) : await exportPdf(d, page, targets);
        await saveBlob(blob, `${base}.pdf`, "pdf", "Documento PDF");
        return;
      }
      if (format === "html") {
        const frames = targets.filter((id) => isContainer(page.nodes[id]) || page.nodes[id].type === "instance");
        if (!frames.length) throw new Error("Para exportar HTML selecciona un marco.");
        if (frames.length === 1) {
          const { html, css } = exportHtml(d, page, frames[0]);
          await saveBlob(makeZip([{ name: "index.html", data: html }, { name: "styles.css", data: css }]), `${safeName(page.nodes[frames[0]].name)}.zip`, "zip", "Archivo ZIP");
        } else {
          const entries: ZipEntry[] = [];
          for (const id of frames) {
            const { html, css } = exportHtml(d, page, id);
            const folder = safeName(page.nodes[id].name);
            entries.push({ name: `${folder}/index.html`, data: html }, { name: `${folder}/styles.css`, data: css });
          }
          await saveBlob(makeZip(entries), `${base}.zip`, "zip", "Archivo ZIP");
        }
        return;
      }
      const files: { name: string; data: Uint8Array }[] = [];
      for (const id of targets) {
        const name = safeName(page.nodes[id].name);
        if (format === "svg") files.push({ name: `${name}.svg`, data: new TextEncoder().encode(await exportSvg(d, page, [id], null)) });
        else {
          const blob = await exportRaster(d, page, [id], scale, format, null);
          files.push({ name: `${name}${scale !== 1 ? `@${scale}x` : ""}.${format === "jpeg" ? "jpg" : "png"}`, data: new Uint8Array(await blob.arrayBuffer()) });
        }
      }
      if (files.length === 1) {
        const ext = format === "jpeg" ? "jpg" : format;
        await saveBlob(new Blob([files[0].data as BlobPart]), files[0].name, ext, format.toUpperCase());
      } else {
        // Nombres repetidos: se numeran
        const seen = new Map<string, number>();
        const entries = files.map((f) => {
          const count = seen.get(f.name) || 0;
          seen.set(f.name, count + 1);
          return { name: count ? f.name.replace(/(\.\w+)$/, ` (${count + 1})$1`) : f.name, data: f.data };
        });
        await saveBlob(makeZip(entries), `${base}.zip`, "zip", "Archivo ZIP");
      }
    } catch (err) {
      reportError(err, "No se pudo exportar.");
    }
  };

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      await showMessage("Copia este texto", text);
    }
  };

  const panelAction = (action: Parameters<React.ComponentProps<typeof RightPanel>["onAction"]>[0]) => {
    const d = docRef.current;
    if (!d || !page) return;
    const single = selection.length === 1 ? page.nodes[selection[0]] : null;
    switch (action) {
      case "component":
        makeComponentFromSelection();
        break;
      case "instance":
        createInstanceOfSelected();
        break;
      case "detach":
        if (single) applyPage(detachInstance(d, page, single.id));
        break;
      case "goto-component":
        gotoComponent();
        break;
      case "image":
        void pickImage();
        break;
      case "present":
        setPresenting(page.startFrame || null);
        break;
      case "export":
        setExporting(true);
        break;
      case "copy-css":
        if (single) void copyText(cssText(nodeCss(single, false, !parentMap(page).get(single.id))), "CSS copiado");
        break;
      case "copy-html":
        if (single) void copyText(exportHtmlSingle(d, page, single.id), "HTML copiado (con el CSS incluido)");
        break;
      case "export-html":
        if (single) void doExport({ scope: "selection", format: "html", scale: 1 });
        break;
    }
  };

  // ---------------------------------------------------------------------------
  // Atajos
  // ---------------------------------------------------------------------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!loaded || showStartScreen || presenting !== false || document.querySelector("[data-modal-open]")) return;
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
      else void saveNow().then((ok) => ok && toast("Diseño guardado"));
    } else if (ctrl && key === "z") {
      handled();
      travel(e.shiftKey ? 1 : -1);
    } else if (ctrl && key === "y") {
      handled();
      travel(1);
    } else if (ctrl && key === "d") {
      handled();
      duplicateSelection();
    } else if (ctrl && key === "c") {
      handled();
      copySelection();
    } else if (ctrl && key === "x") {
      handled();
      copySelection(true);
    } else if (ctrl && key === "a") {
      handled();
      if (page) {
        const parents = parentMap(page);
        const parent = selection.length ? parents.get(selection[0]) ?? null : null;
        setSelection((parent ? page.nodes[parent].children || [] : page.children).filter((id) => !page.nodes[id].locked));
      }
    } else if (ctrl && e.altKey && key === "g") {
      handled();
      groupSelection("frame");
    } else if (ctrl && e.shiftKey && key === "g") {
      handled();
      ungroupSelection();
    } else if (ctrl && key === "g") {
      handled();
      groupSelection();
    } else if (ctrl && e.altKey && key === "k") {
      handled();
      makeComponentFromSelection();
    } else if (ctrl && e.shiftKey && key === "k") {
      handled();
      void pickImage();
    } else if (ctrl && e.shiftKey && key === "e") {
      handled();
      setExporting(true);
    } else if (ctrl && e.altKey && key === "enter") {
      handled();
      setPresenting(page?.startFrame || null);
    } else if (ctrl && e.shiftKey && key === "l") {
      handled();
      toggleProp("locked");
    } else if (ctrl && e.shiftKey && key === "h") {
      handled();
      toggleProp("visible");
    } else if (ctrl && key === "]") {
      handled();
      if (page) applyPage(reorder(page, sel(), e.shiftKey ? "front" : "forward"));
    } else if (ctrl && key === "[") {
      handled();
      if (page) applyPage(reorder(page, sel(), e.shiftKey ? "back" : "backward"));
    } else if (ctrl && (key === "=" || key === "+")) {
      handled();
      zoom("in");
    } else if (ctrl && key === "-") {
      handled();
      zoom("out");
    } else if (ctrl && key === "0") {
      handled();
      zoom("100");
    } else if (e.shiftKey && key === "!") {
      handled();
      zoom("fit");
    } else if (e.shiftKey && e.code === "Digit1") {
      handled();
      zoom("fit");
    } else if (e.shiftKey && e.code === "Digit2") {
      handled();
      zoom("selection");
    } else if (e.shiftKey && key === "a") {
      handled();
      autoLayout();
    } else if (key === "delete" || key === "backspace") {
      handled();
      deleteSelection();
    } else if (key === "escape") {
      if (tool !== "move") setTool("move");
      else if (page && selection.length) {
        const parent = parentMap(page).get(selection[0]);
        setSelection(parent ? [parent] : []);
      }
    } else if (key === "enter" && page && selection.length === 1) {
      handled();
      const n = page.nodes[selection[0]];
      if (n.type === "text") canvasRef.current?.editText(n.id);
      else if (n.children?.length) setSelection([...n.children]);
    } else if (key.startsWith("arrow")) {
      handled();
      const step = e.shiftKey ? 10 : 1;
      nudge(key === "arrowleft" ? -step : key === "arrowright" ? step : 0, key === "arrowup" ? -step : key === "arrowdown" ? step : 0);
    } else if (!ctrl && !e.altKey) {
      const map: Record<string, Tool> = { v: "move", h: "hand", f: "frame", a: "frame", r: "rect", o: "ellipse", t: "text", p: e.shiftKey ? "pencil" : "pen", l: e.shiftKey ? "arrow" : "line" };
      if (map[key]) {
        handled();
        setTool(map[key]);
      }
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
  const has = selection.length > 0;

  const showShortcuts = () =>
    void showMessage(
      "Atajos de teclado",
      [
        "Herramientas: V mover · H mano · F marco · R rectángulo · O elipse · L línea · Mayús+L flecha · P pluma · Mayús+P lápiz · T texto",
        "Espacio + arrastrar o rueda: desplazarse · Ctrl + rueda: zoom",
        "Ctrl+Z / Ctrl+Y: deshacer y rehacer · Supr: eliminar · Ctrl+D: duplicar",
        "Ctrl+C / Ctrl+X / Ctrl+V: copiar, cortar y pegar (también imágenes)",
        "Ctrl+G: agrupar · Ctrl+Mayús+G: desagrupar · Ctrl+Alt+G: envolver en un marco",
        "Mayús+A: diseño automático · Ctrl+Alt+K: crear componente",
        "Flechas: mover 1 px (Mayús: 10 px) · Alt + arrastrar: duplicar · Mayús: mantener proporción",
        "Ctrl+] / Ctrl+[: traer adelante / enviar atrás (con Mayús: al frente / al fondo)",
        "Ctrl+0: 100% · Mayús+1: ver todo · Mayús+2: ver la selección",
        "Doble clic: entrar en un grupo o editar un texto · Ctrl+clic: seleccionar la capa más interna",
        "Ctrl+Alt+Intro: presentar el prototipo · Ctrl+Mayús+E: exportar · Alt+/: buscar un comando",
      ].join("\n")
    );

  const menus: MenuDefinition[] = [
    {
      id: "file",
      label: "Archivo",
      items: [
        { label: "Nuevo diseño", icon: FilePlus, action: () => void handleNew() },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpen() },
        { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void handleSaveAs() },
        { label: "Exportar…", icon: Upload, shortcut: "Ctrl+Mayús+E", action: () => setExporting(true) },
        { label: isStarred ? "Desfijar del Launcher" : "Fijar en el Launcher", action: () => void handleToggleStar() },
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
        { label: "Copiar", icon: Copy, shortcut: "Ctrl+C", action: () => copySelection(), disabled: !has },
        { label: "Cortar", icon: Scissors, shortcut: "Ctrl+X", action: () => copySelection(true), disabled: !has },
        { label: "Pegar", icon: ClipboardPaste, shortcut: "Ctrl+V", action: () => void pasteFromSystem(), disabled: !clipboard.current },
        { label: "Duplicar", icon: CopyPlus, shortcut: "Ctrl+D", action: duplicateSelection, disabled: !has },
        { label: "Eliminar", icon: Trash2, shortcut: "Supr", action: deleteSelection, disabled: !has },
      ],
    },
    {
      id: "object",
      label: "Objeto",
      items: [
        { label: "Agrupar", icon: Group, shortcut: "Ctrl+G", action: () => groupSelection(), disabled: !has },
        { label: "Desagrupar", icon: Ungroup, shortcut: "Ctrl+Mayús+G", action: ungroupSelection, disabled: !has },
        { label: "Envolver en un marco", icon: Frame, shortcut: "Ctrl+Alt+G", action: () => groupSelection("frame"), disabled: !has },
        { label: "Diseño automático", icon: Rows3, shortcut: "Mayús+A", action: autoLayout, disabled: !has },
        { label: "Crear componente", icon: Diamond, shortcut: "Ctrl+Alt+K", action: makeComponentFromSelection, disabled: !has },
        { divider: true },
        { label: "Traer al frente", icon: BringToFront, shortcut: "Ctrl+Mayús+]", action: () => page && applyPage(reorder(page, sel(), "front")), disabled: !has },
        { label: "Enviar al fondo", icon: SendToBack, shortcut: "Ctrl+Mayús+[", action: () => page && applyPage(reorder(page, sel(), "back")), disabled: !has },
        { label: "Bloquear / desbloquear", icon: Lock, shortcut: "Ctrl+Mayús+L", action: () => toggleProp("locked"), disabled: !has },
        { label: "Mostrar / ocultar", icon: EyeOff, shortcut: "Ctrl+Mayús+H", action: () => toggleProp("visible"), disabled: !has },
      ],
    },
    {
      id: "insert",
      label: "Insertar",
      items: [
        { label: "Imagen…", icon: ImageIcon, shortcut: "Ctrl+Mayús+K", action: () => void pickImage() },
        ...(["mobile", "desktop", "web"] as Platform[]).map((p) => ({
          label: `Pantalla ${PLATFORM_LABEL[p].toLowerCase()}`,
          icon: Frame,
          action: () => insertDevice(p === "mobile" ? "iphone-15" : p === "desktop" ? "desktop-app" : "web-1440"),
        })),
      ],
    },
    {
      id: "view",
      label: "Ver",
      items: [
        { label: "Acercar", icon: ZoomIn, shortcut: "Ctrl +", action: () => zoom("in") },
        { label: "Alejar", icon: ZoomOut, shortcut: "Ctrl −", action: () => zoom("out") },
        { label: "Zoom al 100%", shortcut: "Ctrl+0", action: () => zoom("100") },
        { label: "Ver todo", icon: Maximize, shortcut: "Mayús+1", action: () => zoom("fit") },
        { label: "Ver la selección", shortcut: "Mayús+2", action: () => zoom("selection"), disabled: !has },
        { divider: true },
        { label: "Mostrar enlaces del prototipo", icon: Link2, checked: rightTab === "prototype", action: () => setRightTab(rightTab === "prototype" ? "design" : "prototype") },
        { label: "Presentar el prototipo", icon: Play, shortcut: "Ctrl+Alt+Intro", action: () => setPresenting(page?.startFrame || null) },
      ],
    },
    {
      id: "help",
      label: "Ayuda",
      items: [
        { label: "Atajos de teclado", icon: Keyboard, action: showShortcuts },
        {
          label: "Guía rápida",
          icon: BookOpen,
          action: () =>
            void showMessage(
              "Guía rápida",
              [
                "1. Crea pantallas con la herramienta Marco (F) o elige un tamaño de móvil, tableta, escritorio o web en la flecha junto a ella.",
                "2. Dibuja formas, textos e imágenes, o arrastra elementos listos desde Recursos (barras, botones, tarjetas, formularios…).",
                "3. Selecciona varias capas y pulsa Mayús+A para ordenarlas con diseño automático: crecen y se alinean solas.",
                "4. Convierte lo que repitas en componente (Ctrl+Alt+K); sus instancias se actualizan al cambiarlo.",
                "5. En Prototipo, elige a qué pantalla lleva cada botón y pulsa Presentar para probarlo.",
                "6. Exporta a PNG, SVG o PDF, o pasa el diseño a código HTML/CSS desde la pestaña Código.",
              ].join("\n")
            ),
        },
        {
          label: "Acerca de CoffeeUI/UX",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeeUI/UX 1.0",
              "Diseño de interfaces y prototipos de la suite CoffeeWorks.\n\nMarcos con tamaños de móvil, tableta, escritorio y web; formas, trazados, textos e imágenes; diseño automático; componentes e instancias; kits de interfaz; prototipos navegables con transiciones; y exportación a PNG, JPG, SVG, PDF y HTML/CSS."
            ),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f5f5f5] select-none">
      {loaded && doc && page && (
        <>
          <TopBar
            title={title}
            onTitle={(next) => {
              setTitle(next);
              stateRef.current.title = next;
              scheduleSave();
            }}
            menus={menus}
            saveStatus={saveStatus}
            tool={tool}
            onTool={setTool}
            onDevice={insertDevice}
            onImage={() => void pickImage()}
            zoom={viewport.zoom}
            onZoom={zoom}
            onPresent={() => setPresenting(page.startFrame || null)}
            onExport={() => setExporting(true)}
            onLogo={() => setShowStartScreen(true)}
            onBeforeClose={async () => {
              await flush();
            }}
          />
          <div className="flex-1 flex min-h-0">
            <LeftPanel
              doc={doc}
              page={page}
              selection={selection}
              onSelect={setSelection}
              onPage={applyPage}
              onDoc={applyDoc}
              onSwitchPage={switchPage}
              onAddPage={addPage}
              onDeletePage={(id) => void deletePage(id)}
              onInsertKit={(id) => insertKit(id)}
              onInsertComponent={(id) => insertComponent(id)}
              onZoomTo={zoomToNode}
            />
            <Canvas
              ref={canvasRef}
              doc={doc}
              page={page}
              selection={selection}
              onSelect={setSelection}
              tool={tool}
              onToolDone={() => setTool("move")}
              viewport={viewport}
              onViewport={setViewport}
              onChange={applyPage}
              onDropItem={(data, at, parent) => void onDropItem(data, at, parent)}
              showLinks={rightTab === "prototype"}
            />
            <RightPanel doc={doc} page={page} selection={selection} tab={rightTab} onTab={setRightTab} onPage={applyPage} onDoc={applyDoc} onSelect={setSelection} onAction={panelAction} />
          </div>
        </>
      )}

      {presenting !== false && doc && page && <PresentView doc={doc} page={page} startId={presenting} onClose={() => setPresenting(false)} />}
      {exporting && page && <ExportDialog hasSelection={selection.length > 0} frameCount={topFrames(page).length} onClose={() => setExporting(false)} onExport={doExport} />}

      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeeUI/UX"
          tagline="Diseño de interfaces y prototipos • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Diseñar una app móvil, de escritorio o una web"
          openHint="Abrir un diseño .cux"
          formats={[`.${EXTENSION}`]}
          recents={recents}
          onNew={() => void handleNew()}
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

// Para las pruebas automáticas
export { exportBox };
