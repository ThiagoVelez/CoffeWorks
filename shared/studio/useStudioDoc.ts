// Ciclo de vida de un documento en las apps de Ilustración: abrir (archivo,
// recientes, plantilla del Launcher), crear, deshacer/rehacer, autoguardado y
// "Guardar como". Cada app solo aporta su modelo y su interfaz.

import { useCallback, useEffect, useRef, useState } from "react";
import { appWindow, extensionOf, getLaunchArgs, isTauri, listRecent, pickOpenFile, renameInVault, saveFileAs, setPinned, stripExtension, type PickedFile, type RecentEntry } from "./desktop";
import type { createDocStore, OpenedDocument } from "./docStore";
import type { SaveStatus } from "./SuiteHeader";
import { showMessage, toast } from "./Dialogs";

type Store<T> = ReturnType<typeof createDocStore<T>>;

interface Options<T> {
  appName: string;
  /** Otros formatos que se pueden abrir (se convierten en un documento nuevo). */
  importExtensions?: string[];
  importFile?: (file: PickedFile) => Promise<T | null>;
  /** Tras abrir o crear un documento (ajustar la vista, etc.). */
  onLoaded?: (doc: T) => void;
  historyLimit?: number;
  autosaveMs?: number;
}

export function useStudioDoc<T>(store: Store<T>, options: Options<T>) {
  const [doc, setDoc] = useState<T | null>(null);
  const [title, setTitleState] = useState(store.defaultTitle);
  const [docId, setDocId] = useState(store.newDocId());
  const [location, setLocation] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isStarred, setIsStarred] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [, force] = useState(0);

  const docRef = useRef<T | null>(null);
  const meta = useRef({ title: store.defaultTitle, docId, location: null as string | null, pinned: false });
  const history = useRef<{ stack: T[]; index: number; lastKey: string; lastTime: number }>({ stack: [], index: -1, lastKey: "", lastTime: 0 });
  const saveTimer = useRef<number | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const opts = useRef(options);
  opts.current = options;
  const limit = options.historyLimit ?? 60;

  const save = useCallback(async () => {
    const current = docRef.current;
    if (!current) return;
    setSaveStatus("saving");
    const m = meta.current;
    const run = (async () => {
      try {
        const path = await store.persist(current, m.title || store.defaultTitle, m.docId, m.location, m.pinned);
        if (path !== m.location) {
          meta.current.location = path;
          setLocation(path);
        }
        setSaveStatus(docRef.current === current ? "saved" : "dirty");
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
      }
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [store]);

  const scheduleSave = useCallback(() => {
    setSaveStatus("dirty");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void save();
    }, opts.current.autosaveMs ?? 1200);
  }, [save]);

  const flush = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await save();
    } else if (saving.current) await saving.current;
  }, [save]);

  /** Aplica un cambio. Los cambios con la misma clave seguidos se agrupan en un paso de deshacer. */
  const apply = useCallback(
    (next: T, coalesceKey = "") => {
      const h = history.current;
      const now = Date.now();
      if (coalesceKey && coalesceKey === h.lastKey && now - h.lastTime < 1500 && h.index > 0) {
        h.stack[h.index] = next;
      } else {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(next);
        if (h.stack.length > limit) h.stack.shift();
        h.index = h.stack.length - 1;
      }
      h.lastKey = coalesceKey;
      h.lastTime = now;
      docRef.current = next;
      setDoc(next);
      scheduleSave();
    },
    [limit, scheduleSave]
  );

  const travel = useCallback(
    (dir: -1 | 1) => {
      const h = history.current;
      const target = h.index + dir;
      if (target < 0 || target >= h.stack.length) return;
      h.index = target;
      h.lastKey = "";
      docRef.current = h.stack[target];
      setDoc(h.stack[target]);
      scheduleSave();
    },
    [scheduleSave]
  );

  const load = useCallback(
    async (file: OpenedDocument<T>, pinned = false) => {
      await flush();
      docRef.current = file.doc;
      history.current = { stack: [file.doc], index: 0, lastKey: "", lastTime: 0 };
      const t = stripExtension(file.name) || store.defaultTitle;
      meta.current = { title: t, docId: file.docId, location: file.location, pinned };
      setDoc(file.doc);
      setTitleState(t);
      setDocId(file.docId);
      setLocation(file.location);
      setIsStarred(pinned);
      setSaveStatus("saved");
      setShowStart(false);
      force((n) => n + 1);
      opts.current.onLoaded?.(file.doc);
      if (file.location) void store.remember(file);
    },
    [flush, store]
  );

  const reportError = (err: unknown, fallback: string) => {
    console.error(err);
    void showMessage("No se pudo completar la acción", err instanceof Error && err.message ? err.message : fallback);
  };

  const newDocument = useCallback(
    async (name?: string, initial?: T) => {
      const id = store.newDocId();
      await load({ name: `${name || store.defaultTitle}.${store.extension}`, doc: initial ?? store.create(), location: null, docId: id });
      // Se guarda enseguida para que aparezca en los recientes del Launcher
      void save();
    },
    [load, save, store]
  );

  const open = useCallback(async () => {
    try {
      const exts = [store.extension, ...(opts.current.importExtensions || [])];
      const file = await pickOpenFile([{ name: `Archivos de ${opts.current.appName}`, extensions: exts }], `Abrir en ${opts.current.appName}`);
      if (!file) return;
      await openPicked(file);
    } catch (err) {
      reportError(err, "No se pudo abrir el archivo.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const openPicked = async (file: PickedFile) => {
    const ext = extensionOf(file.name);
    if (ext === store.extension) {
      const text = new TextDecoder().decode(file.bytes);
      await load({ name: file.name, doc: text.trim() ? store.parse(text) : store.create(), location: file.path, docId: store.newDocId() });
      return;
    }
    const imported = await opts.current.importFile?.(file);
    if (!imported) {
      await showMessage("Formato no compatible", `${opts.current.appName} no puede abrir «${file.name}».`);
      return;
    }
    await newDocument(stripExtension(file.name), imported);
  };

  const openRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        if (entry.path.startsWith("web:")) {
          const file = await store.openWebEntry(entry.path.slice(4));
          if (file) await load(file, entry.is_pinned);
          else await showMessage("No se encontró", "El documento ya no está disponible.");
        } else await load(await store.openPath(entry.path, entry.id), entry.is_pinned);
      } catch (err) {
        reportError(err, "No se pudo abrir el documento.");
      }
    },
    [load, store]
  );

  const refreshRecents = useCallback(async () => setRecents(await listRecent(store.appId)), [store]);

  // Argumentos de arranque (archivo, documento nuevo o plantilla del Launcher)
  useEffect(() => {
    void (async () => {
      try {
        const args = await getLaunchArgs();
        if (args.file) {
          await load(await store.openPath(args.file));
          return;
        }
        if (args.docId) {
          const file = await store.openWebEntry(args.docId);
          if (file) {
            await load(file);
            return;
          }
        }
        if (args.payload) {
          await newDocument(store.defaultTitle, store.parse(args.payload));
          return;
        }
        if (args.newTitle !== null) {
          await newDocument(args.newTitle || store.defaultTitle);
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir el documento.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStart) void refreshRecents();
  }, [showStart, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(doc ? `${title || store.defaultTitle} - ${options.appName}` : options.appName);
  }, [doc, title, store.defaultTitle, options.appName]);

  // Guardar antes de cerrar la pestaña (modo navegador)
  useEffect(() => {
    const handler = () => {
      if (saveTimer.current) void flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  const setTitle = useCallback(
    (next: string) => {
      setTitleState(next);
      meta.current.title = next;
      // En la bóveda el archivo se renombra con el título
      const loc = meta.current.location;
      if (isTauri && loc && !loc.startsWith("web:")) {
        void renameInVault(loc, store.ensureExtension(next), meta.current.docId)
          .then((path) => {
            meta.current.location = path;
            setLocation(path);
          })
          .catch(() => undefined);
      }
      scheduleSave();
    },
    [scheduleSave, store]
  );

  const saveAs = useCallback(async () => {
    const current = docRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(store.ensureExtension(meta.current.title), store.OPEN_FILTERS, store.serialize(current), "Guardar como");
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        meta.current.location = path;
        meta.current.title = stripExtension(name);
        setLocation(path);
        setTitleState(stripExtension(name));
        await store.remember({ name, doc: current, location: path, docId: meta.current.docId });
        setSaveStatus("saved");
        toast("Guardado en la nueva ubicación");
      } else toast("Archivo descargado");
    } catch (err) {
      reportError(err, "No se pudo guardar.");
    }
  }, [store]);

  const toggleStar = useCallback(async () => {
    const next = !meta.current.pinned;
    meta.current.pinned = next;
    setIsStarred(next);
    if (meta.current.location) await setPinned(meta.current.docId, next);
    toast(next ? "Fijado en el Launcher" : "Quitado de fijados");
  }, []);

  const h = history.current;
  return {
    doc,
    docRef,
    loaded: doc !== null,
    title,
    setTitle,
    docId,
    location,
    saveStatus,
    isStarred,
    toggleStar,
    apply,
    undo: () => travel(-1),
    redo: () => travel(1),
    canUndo: h.index > 0,
    canRedo: h.index < h.stack.length - 1,
    newDocument,
    open,
    openPicked,
    openRecent,
    recents,
    showStart,
    setShowStart,
    flush,
    saveAs,
  };
}
