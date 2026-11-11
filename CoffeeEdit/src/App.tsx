import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  FilePlus,
  FolderOpen,
  SaveAll,
  Upload,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Trash2,
  Play,
  Type,
  Keyboard,
  Info,
  Home,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askChoice, showMessage, toast } from "./components/Dialogs";
import { EditorView, type EditorHandle } from "./components/EditorView";
import {
  APP_ID,
  DEFAULT_TITLE,
  EXTENSION,
  OPEN_FILTERS,
  ensureExtension,
  importBlob,
  kindOf,
  mediaFromPath,
  mediaUrl,
  openPath,
  openWebEntry,
  persistProject,
  pickMediaPath,
  rememberOpened,
  type OpenedProject,
} from "./services/store";
import { newId, newProject, parseProject, serializeProject } from "./services/project";
import { probeMedia, waveform } from "./services/media";
import {
  appWindow,
  bytesToText,
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
import { invoke } from "@tauri-apps/api/core";
import { ACCENT, ACCENT_DARK, type MediaItem, type Project } from "./types";

const HISTORY_LIMIT = 120;
const AUTOSAVE_DELAY = 1500;

const EditLogo = <img src="/app-icon.png" alt="" className="w-full h-full" draggable={false} />;

interface HistoryState {
  stack: Project[];
  index: number;
  lastKey: string;
  lastTime: number;
}

export const App: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef<Project | null>(null);
  const history = useRef<HistoryState>({ stack: [], index: 0, lastKey: "", lastTime: 0 });
  const [, setTick] = useState(0);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [docId, setDocId] = useState(() => newId("ccm"));
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
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(0);
  const [editorBusy, setEditorBusy] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const startedRef = useRef(false);

  const loaded = project !== null;
  const refreshRecents = useCallback(async () => setRecents(await listRecent(APP_ID)), []);
  const reportError = (err: unknown, fallback: string) =>
    void showMessage("Algo salió mal", err instanceof Error ? err.message : String(err || fallback));

  // ---------------------------------------------------------------------------
  // Guardado automático e historial
  // ---------------------------------------------------------------------------

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const current = projectRef.current;
    if (!current) return true;
    if (savingRef.current) await savingRef.current;
    const run = (async () => {
      const { title: t, docId: id, location: loc, isStarred: pinned } = stateRef.current;
      setSaveStatus("saving");
      try {
        let target = loc;
        if (target && isTauri && !target.startsWith("web:")) target = await renameInVault(target, ensureExtension(t || DEFAULT_TITLE), id);
        const saved = await persistProject(current, t || DEFAULT_TITLE, id, target, pinned);
        setLocation(saved);
        stateRef.current.location = saved;
        setSaveStatus(projectRef.current === current ? "saved" : "dirty");
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

  const applyProject = useCallback(
    (next: Project, key = "") => {
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
      projectRef.current = next;
      setProject(next);
      setTick((t) => t + 1);
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
    projectRef.current = h.stack[target];
    setProject(h.stack[target]);
    setTick((t) => t + 1);
    scheduleSave();
  };

  // ---------------------------------------------------------------------------
  // Medios
  // ---------------------------------------------------------------------------

  /** Completa duración, tamaño, miniatura y onda de un medio. */
  const analyze = useCallback(async (item: MediaItem, url: string): Promise<MediaItem> => {
    try {
      const probe = await probeMedia(url, item.kind);
      if (probe.thumbnail) setThumbnails((prev) => ({ ...prev, [item.id]: probe.thumbnail as string }));
      if (item.kind === "audio") {
        void waveform(url).then((peaks) => peaks && setWaveforms((prev) => ({ ...prev, [item.id]: peaks })));
      }
      return { ...item, duration: probe.duration || item.duration, width: probe.width || item.width, height: probe.height || item.height };
    } catch {
      return item;
    }
  }, []);

  const resolveAll = useCallback(
    async (p: Project) => {
      const nextUrls = new Map<string, string>();
      const gone = new Set<string>();
      for (const item of p.media) {
        if (isTauri && item.path) {
          const exists = await invoke<boolean>("core_file_exists", { path: item.path }).catch(() => true);
          if (!exists) {
            gone.add(item.id);
            continue;
          }
        }
        const url = await mediaUrl(item);
        if (url) nextUrls.set(item.id, url);
        else gone.add(item.id);
      }
      setUrls(nextUrls);
      setMissing(gone);
      // Miniaturas y ondas en segundo plano
      for (const item of p.media) {
        const url = nextUrls.get(item.id);
        if (url) await analyze(item, url);
      }
    },
    [analyze]
  );

  const addMediaItems = useCallback(
    async (items: MediaItem[]) => {
      const analyzed: MediaItem[] = [];
      const nextUrls = new Map(urls);
      for (const item of items) {
        const url = await mediaUrl(item);
        if (!url) continue;
        nextUrls.set(item.id, url);
        analyzed.push(await analyze(item, url));
      }
      if (!analyzed.length || !projectRef.current) return;
      setUrls(nextUrls);
      applyProject({ ...projectRef.current, media: [...projectRef.current.media, ...analyzed] });
    },
    [analyze, applyProject, urls]
  );

  const importFiles = async (files: File[]) => {
    setImporting((n) => n + files.length);
    try {
      const items: MediaItem[] = [];
      for (const file of files) {
        const kind = kindOf(file.name, file.type);
        if (!kind) {
          toast(`${file.name}: formato no compatible`, "error");
          continue;
        }
        items.push(await importBlob(file, file.name, kind));
      }
      await addMediaItems(items);
      if (items.length) toast(items.length === 1 ? "Archivo importado" : `${items.length} archivos importados`);
    } catch (err) {
      reportError(err, "No se pudo importar.");
    } finally {
      setImporting((n) => Math.max(0, n - files.length));
    }
  };

  const handleImport = async () => {
    if (isTauri) {
      const path = await pickMediaPath();
      if (!path) return;
      const item = mediaFromPath(path);
      if (!item) {
        toast("Formato no compatible", "error");
        return;
      }
      setImporting((n) => n + 1);
      await addMediaItems([item]).finally(() => setImporting((n) => Math.max(0, n - 1)));
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "video/*,audio/*,image/*";
    input.onchange = () => {
      if (input.files?.length) void importFiles(Array.from(input.files));
    };
    input.click();
  };



  const removeMedia = (id: string) => {
    const current = projectRef.current;
    if (!current) return;
    const used = current.clips.filter((c) => c.type === "media" && c.mediaId === id).length;
    applyProject({
      ...current,
      media: current.media.filter((m) => m.id !== id),
      clips: current.clips.filter((c) => !(c.type === "media" && c.mediaId === id)),
    });
    toast(used ? `Medio quitado junto con ${used} clips (Ctrl+Z para deshacer)` : "Medio quitado de la biblioteca");
  };

  // ---------------------------------------------------------------------------
  // Abrir, crear y cerrar
  // ---------------------------------------------------------------------------

  const loadProject = useCallback(
    async (file: OpenedProject, pinned = false) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const p = file.project;
      projectRef.current = p;
      history.current = { stack: [p], index: 0, lastKey: "", lastTime: 0 };
      setProject(p);
      setTick((t) => t + 1);
      const name = stripExtension(file.name) || DEFAULT_TITLE;
      setTitle(name);
      setDocId(file.docId);
      setLocation(file.location);
      setIsStarred(pinned);
      setSaveStatus("saved");
      setThumbnails({});
      setWaveforms({});
      setShowStartScreen(false);
      stateRef.current = { title: name, docId: file.docId, location: file.location, isStarred: pinned };
      if (file.location) await rememberOpened(file);
      void resolveAll(p);
    },
    [resolveAll]
  );

  const flush = useCallback(async () => {
    if (projectRef.current && (saveTimer.current || savingRef.current)) await saveNow();
    return true;
  }, [saveNow]);

  const busy = editorBusy;

  const guardBusy = async (): Promise<boolean> => {
    if (!busy) return true;
    const choice = await askChoice({
      title: "Se está exportando un video",
      message: "Si continúas, se detendrá. ¿Quieres continuar?",
      choices: [
        { id: "cancel", label: "Cancelar" },
        { id: "go", label: "Continuar", danger: true },
      ],
    });
    return choice === "go";
  };

  /** Ejecuta `fn` si no hay nada en curso o el usuario acepta detenerlo. */
  const whenFree = (fn: () => unknown) => {
    void guardBusy().then((ok) => {
      if (ok) void fn();
    });
  };

  const handleNew = useCallback(
    async (newTitle?: string) => {
      await flush();
      await loadProject({ name: `${newTitle || DEFAULT_TITLE}.${EXTENSION}`, project: newProject(), location: null, docId: newId("ccm") });
      scheduleSave();
    },
    [flush, loadProject, scheduleSave]
  );

  const handleOpen = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir proyecto");
      if (!picked) return;
      await flush();
      await loadProject({ name: picked.name, project: parseProject(bytesToText(picked.bytes)), location: picked.path, docId: newId("ccm") });
      if (!picked.path) scheduleSave();
    } catch (err) {
      reportError(err, "No se pudo abrir el proyecto.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, loadProject, scheduleSave]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flush();
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("El proyecto ya no está en el almacenamiento del navegador.");
        await loadProject(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró el proyecto.");
        void refreshRecents();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, loadProject, refreshRecents]
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          // Un video abierto con «Abrir con» empieza un proyecto con ese archivo
          const media = mediaFromPath(args.file);
          if (media) {
            await handleNew(stripExtension(media.name));
            await addMediaItems([media]);
          } else {
            await loadProject(await openPath(args.file));
          }
          return;
        }
        if (args.docId) {
          const file = await openWebEntry(args.docId);
          if (file) {
            await loadProject(file);
            return;
          }
        }
        if (args.payload) {
          await loadProject({ name: `${DEFAULT_TITLE}.${EXTENSION}`, project: parseProject(args.payload), location: null, docId: newId("ccm") });
          scheduleSave();
          return;
        }
        if (args.newTitle !== null) {
          await handleNew(args.newTitle || DEFAULT_TITLE);
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir el proyecto.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE} - CoffeeEdit` : "CoffeeEdit");
  }, [loaded, title]);

  const handleSaveAs = async () => {
    const current = projectRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(ensureExtension(title || DEFAULT_TITLE), OPEN_FILTERS, serializeProject(current), "Guardar proyecto como");
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        setLocation(path);
        setTitle(stripExtension(name));
        stateRef.current = { ...stateRef.current, location: path, title: stripExtension(name) };
        await rememberOpened({ name, project: current, location: path, docId });
        setSaveStatus("saved");
        toast("Proyecto guardado en la nueva ubicación");
      } else {
        toast("Proyecto descargado");
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
    toast(next ? "Proyecto fijado en el Launcher" : "Proyecto desfijado");
  };

  // ---------------------------------------------------------------------------
  // Atajos globales
  // ---------------------------------------------------------------------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!loaded || showStartScreen) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const el = e.target as HTMLElement | null;
    const typing = Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
    if (e.altKey && key === "/") {
      e.preventDefault();
      setCommandSearchOpen(true);
    } else if (ctrl && key === "s") {
      e.preventDefault();
      if (e.shiftKey) void handleSaveAs();
      else void saveNow().then((ok) => ok && toast("Proyecto guardado"));
    } else if (ctrl && key === "i") {
      e.preventDefault();
      void handleImport();
    } else if (ctrl && key === "e") {
      e.preventDefault();
      editorRef.current?.openExport();
    } else if (!typing && ctrl && key === "z") {
      e.preventDefault();
      travel(e.shiftKey ? 1 : -1);
    } else if (!typing && ctrl && key === "y") {
      e.preventDefault();
      travel(1);
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
        { label: "Nuevo proyecto", icon: FilePlus, action: () => void whenFree(() => handleNew()) },
        { label: "Abrir proyecto…", icon: FolderOpen, action: () => void whenFree(() => handleOpen()) },
        { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void handleSaveAs() },
        { divider: true },
        { label: "Importar medios…", icon: Upload, shortcut: "Ctrl+I", action: () => void handleImport() },
        {
          label: "Exportar video…",
          icon: ArrowUpRight,
          shortcut: "Ctrl+E",
          action: () => {
                  editorRef.current?.openExport();
          },
        },
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
        { label: "Reproducir / pausar", icon: Play, shortcut: "Espacio", action: () => editorRef.current?.togglePlay() },
        { label: "Dividir en el cabezal", icon: Scissors, shortcut: "S", action: () => editorRef.current?.split() },
        { label: "Duplicar clip", icon: Copy, shortcut: "Ctrl+D", action: () => editorRef.current?.duplicateSelected() },
        { label: "Eliminar clip", icon: Trash2, shortcut: "Supr", action: () => editorRef.current?.deleteSelected() },
      ],
    },
    {
      id: "insert",
      label: "Insertar",
      items: [
        { label: "Título", icon: Type, action: () => (editorRef.current?.addText("title")) },
        { label: "Subtítulo", icon: Type, action: () => (editorRef.current?.addText("subtitle")) },
        { label: "Tercio inferior", icon: Type, action: () => (editorRef.current?.addText("lower")) },
        { label: "Créditos finales", icon: Type, action: () => (editorRef.current?.addText("end")) },
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
                "Espacio reproducir o pausar · ← / → fotograma a fotograma (Mayús: 1 s)",
                "S o Ctrl+B dividir en el cabezal · Supr eliminar · Ctrl+D duplicar",
                "Ctrl+I importar medios · Ctrl+E exportar video",
                "Ctrl+Z / Ctrl+Y deshacer y rehacer · Ctrl + rueda: zoom de la línea de tiempo",
                "Alt+/ buscar un comando",
              ].join("\n")
            ),
        },
        {
          label: "Acerca de CoffeeEdit",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeeEdit 1.0",
              "Editor de video de la suite CoffeeWorks.\n\nEdita con varias pistas, cortes, velocidad, filtros, textos animados y transiciones, y exporta a MP4 o WebM. Para grabar la pantalla o transmitir en directo usa CoffeeLive: sus grabaciones se abren aquí."
            ),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f1513] select-none">
      {loaded && project && (
        <>
          <SuiteHeader
            logo={EditLogo}
            logoTitle="Pantalla de inicio de CoffeeEdit"
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
            onRequestClose={guardBusy}
            onBeforeClose={async () => {
              await flush();
            }}
            actions={
              <button
                type="button"
                onClick={() => {
                              editorRef.current?.openExport();
                }}
                className="text-white font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 hover:opacity-90"
                style={{ background: ACCENT }}
                title="Exportar video (Ctrl+E)"
              >
                <ArrowUpRight size={15} />
                <span>Exportar video</span>
              </button>
            }
          />

          {importing > 0 && (
            <div className="h-7 shrink-0 flex items-center px-3 bg-[#0c1210] border-b border-[#26322e] text-[11px] text-[#9fc3b7] font-mono">
              Importando {importing}…
            </div>
          )}

          <EditorView
            ref={editorRef}
            project={project}
            title={title}
            visible
            urls={urls}
            thumbnails={thumbnails}
            waveforms={waveforms}
            missing={missing}
            onChange={applyProject}
            onImport={() => void handleImport()}
            onImportFiles={(files) => void importFiles(files)}
            onRemoveMedia={removeMedia}
            onBusyChange={setEditorBusy}
          />

          <footer className="h-6 px-3 flex items-center justify-between text-[11px] font-mono text-white shrink-0" style={{ background: ACCENT_DARK }}>
            <span>
              {project.media.length} medios · {project.clips.length} clips · {project.settings.width}×{project.settings.height} {project.settings.fps} fps
            </span>
            <span className="truncate max-w-[50%]" title={location || undefined}>
              {location && !location.startsWith("web:") ? location : isTauri ? "Sin guardar en disco" : "Guardado en el navegador"}
            </span>
          </footer>
        </>
      )}

      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeeEdit"
          tagline="Editor de video • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Crear un proyecto de video"
          openHint="Abrir un proyecto .ccm"
          formats={[`.${EXTENSION}`]}
          recents={recents}
          onNew={() => void whenFree(() => handleNew())}
          onOpen={() => void whenFree(() => handleOpen())}
          onOpenRecent={(entry) => void whenFree(() => handleOpenRecent(entry))}
          onContinue={loaded ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      <DialogHost />
    </div>
  );
};
