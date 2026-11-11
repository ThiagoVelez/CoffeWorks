import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FilePlus,
  FolderOpen,
  SaveAll,
  Home,
  Undo2,
  Redo2,
  Monitor,
  Camera,
  Image as ImageIcon,
  Images,
  Film,
  Type,
  Square,
  Radio,
  Circle,
  Camera as Shot,
  Columns2,
  Settings2,
  Keyboard,
  Info,
  BookOpen,
} from "lucide-react";
import { type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { LiveTopBar } from "./components/LiveTopBar";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askChoice, showMessage, toast } from "./components/Dialogs";
import { StudioView, type StudioHandle } from "./components/StudioView";
import {
  APP_ID,
  DEFAULT_TITLE,
  EXTENSION,
  OPEN_FILTERS,
  ensureExtension,
  openPath,
  openWebEntry,
  persistDocument,
  rememberOpened,
  type OpenedDocument,
} from "./services/store";
import { newDocument, newId, parseDocument, serializeDocument } from "./services/live";
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
import { ACCENT_DARK, HOTKEY_LABELS, type HotkeyAction, type LiveDocument } from "./types";

const HISTORY_LIMIT = 120;
const AUTOSAVE_DELAY = 1200;

interface HistoryState {
  stack: LiveDocument[];
  index: number;
  lastKey: string;
  lastTime: number;
}

export const App: React.FC = () => {
  const [doc, setDoc] = useState<LiveDocument | null>(null);
  const docRef = useRef<LiveDocument | null>(null);
  const history = useRef<HistoryState>({ stack: [], index: 0, lastKey: "", lastTime: 0 });
  const [, setTick] = useState(0);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [docId, setDocId] = useState(() => newId("clv"));
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
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState({ recording: false, streaming: false });
  const studioRef = useRef<StudioHandle>(null);
  const startedRef = useRef(false);

  const loaded = doc !== null;
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
    (next: LiveDocument, key = "") => {
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
      docRef.current = next;
      setDoc(next);
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
    docRef.current = h.stack[target];
    setDoc(h.stack[target]);
    setTick((t) => t + 1);
    scheduleSave();
  };

  // ---------------------------------------------------------------------------
  // Abrir, crear y cerrar
  // ---------------------------------------------------------------------------

  const loadDoc = useCallback(async (file: OpenedDocument, pinned = false) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    docRef.current = file.doc;
    history.current = { stack: [file.doc], index: 0, lastKey: "", lastTime: 0 };
    setDoc(file.doc);
    setTick((t) => t + 1);
    const name = stripExtension(file.name) || DEFAULT_TITLE;
    setTitle(name);
    setDocId(file.docId);
    setLocation(file.location);
    setIsStarred(pinned);
    setSaveStatus("saved");
    setShowStartScreen(false);
    stateRef.current = { title: name, docId: file.docId, location: file.location, isStarred: pinned };
    if (file.location) await rememberOpened(file);
  }, []);

  const flush = useCallback(async () => {
    if (docRef.current && (saveTimer.current || savingRef.current)) await saveNow();
    return true;
  }, [saveNow]);

  const guardBusy = useCallback(async (): Promise<boolean> => {
    if (!busy || docRef.current?.settings.general.confirmExit === false) return true;
    const choice = await askChoice({
      title: "Hay una grabación o transmisión en curso",
      message: "Si continúas, se detendrá. ¿Quieres continuar?",
      choices: [
        { id: "cancel", label: "Cancelar" },
        { id: "go", label: "Continuar", danger: true },
      ],
    });
    return choice === "go";
  }, [busy]);

  const whenFree = (fn: () => unknown) => {
    void guardBusy().then((ok) => {
      if (ok) void fn();
    });
  };

  const handleNew = useCallback(
    async (newTitle?: string) => {
      await flush();
      await loadDoc({ name: `${newTitle || DEFAULT_TITLE}.${EXTENSION}`, doc: newDocument(), location: null, docId: newId("clv") });
      scheduleSave();
    },
    [flush, loadDoc, scheduleSave]
  );

  const handleOpen = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir colección de escenas");
      if (!picked) return;
      await flush();
      await loadDoc({ name: picked.name, doc: parseDocument(bytesToText(picked.bytes)), location: picked.path, docId: newId("clv") });
      if (!picked.path) scheduleSave();
    } catch (err) {
      reportError(err, "No se pudo abrir la colección.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, loadDoc, scheduleSave]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flush();
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("La colección ya no está en el almacenamiento del navegador.");
        await loadDoc(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró la colección.");
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
          // Plantilla del Launcher en el modo web
          await loadDoc({ name: `${DEFAULT_TITLE}.${EXTENSION}`, doc: parseDocument(args.payload), location: null, docId: newId("clv") });
          return;
        }
        if (args.newTitle !== null) {
          await handleNew(args.newTitle || DEFAULT_TITLE);
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir la colección.");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE} - CoffeeLive` : "CoffeeLive");
  }, [loaded, title]);

  const handleSaveAs = async () => {
    const current = docRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(ensureExtension(title || DEFAULT_TITLE), OPEN_FILTERS, serializeDocument(current), "Guardar colección como");
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        setLocation(path);
        setTitle(stripExtension(name));
        stateRef.current = { ...stateRef.current, location: path, title: stripExtension(name) };
        await rememberOpened({ name, doc: current, location: path, docId });
        setSaveStatus("saved");
        toast("Colección guardada en la nueva ubicación");
      } else {
        toast("Colección descargada");
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
    toast(next ? "Colección fijada en el Launcher" : "Colección desfijada");
  };

  // ---------------------------------------------------------------------------
  // Atajos de la ventana
  // ---------------------------------------------------------------------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!loaded || showStartScreen || document.querySelector("[data-modal-open]")) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const el = e.target as HTMLElement | null;
    const typing = Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
    if (e.altKey && key === "/") {
      e.preventDefault();
      setCommandSearchOpen(true);
    } else if (ctrl && !e.shiftKey && key === "s") {
      e.preventDefault();
      void saveNow().then((ok) => ok && toast("Colección guardada"));
    } else if (ctrl && key === ",") {
      e.preventDefault();
      studioRef.current?.openSettings();
    } else if (!typing && ctrl && !e.shiftKey && key === "z") {
      e.preventDefault();
      travel(-1);
    } else if (!typing && ctrl && !e.shiftKey && key === "y") {
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
  const hk = (action: HotkeyAction) => doc?.settings.hotkeys[action] || undefined;
  const showGuide = () =>
    void showMessage(
              "Guía rápida",
              [
                "1. Añade fuentes a la escena: pantalla o ventana, cámara, imágenes, videos, textos o colores.",
                "2. Colócalas arrastrándolas en el lienzo; el tirador de la esquina cambia el tamaño.",
                "3. En Filtros: corrección de color, recorte y croma (pantalla verde).",
                "4. Crea más escenas (por ejemplo «Pausa») y cambia entre ellas con una transición.",
                "5. Configura la plataforma y la clave en Ajustes › Transmisión.",
                "6. Pulsa «Iniciar transmisión» o «Iniciar grabación».",
                "",
                "Atajos actuales:",
                ...(Object.keys(HOTKEY_LABELS) as HotkeyAction[])
                  .filter((a) => doc?.settings.hotkeys[a])
                  .map((a) => `${doc?.settings.hotkeys[a]}: ${HOTKEY_LABELS[a]}`),
              ].join("\n")
            );

  const menus: MenuDefinition[] = [
    {
      id: "file",
      label: "Archivo",
      items: [
        { label: "Nueva colección de escenas", icon: FilePlus, action: () => whenFree(() => handleNew()) },
        { label: "Abrir colección…", icon: FolderOpen, action: () => whenFree(() => handleOpen()) },
        { label: "Guardar como…", icon: SaveAll, action: () => void handleSaveAs() },
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
      ],
    },
    {
      id: "sources",
      label: "Fuentes",
      items: [
        { label: "Pantalla o ventana", icon: Monitor, action: () => studioRef.current?.addSource("screen") },
        { label: "Cámara", icon: Camera, action: () => studioRef.current?.addSource("camera") },
        { label: "Imagen", icon: ImageIcon, action: () => studioRef.current?.addSource("image") },
        { label: "Presentación de imágenes", icon: Images, action: () => studioRef.current?.addSource("slideshow") },
        { label: "Video o audio del disco", icon: Film, action: () => studioRef.current?.addSource("media") },
        { label: "Texto", icon: Type, action: () => studioRef.current?.addSource("text") },
        { label: "Color", icon: Square, action: () => studioRef.current?.addSource("color") },
      ],
    },
    {
      id: "controls",
      label: "Controles",
      items: [
        { label: "Iniciar / detener transmisión", icon: Radio, shortcut: hk("toggleStreaming"), action: () => studioRef.current?.toggleStreaming() },
        { label: "Iniciar / detener grabación", icon: Circle, shortcut: hk("toggleRecording"), action: () => studioRef.current?.toggleRecording() },
        { label: "Captura de la salida", icon: Shot, shortcut: hk("screenshot"), action: () => studioRef.current?.screenshot() },
        { divider: true },
        { label: "Modo estudio", icon: Columns2, checked: doc?.settings.general.studioMode, action: () => studioRef.current?.toggleStudioMode() },
      ],
    },
    {
      id: "settings",
      label: "Ajustes",
      items: [
        { label: "Ajustes…", icon: Settings2, shortcut: "Ctrl+,", action: () => studioRef.current?.openSettings("general") },
        { divider: true },
        { label: "Transmisión", action: () => studioRef.current?.openSettings("stream") },
        { label: "Salida (codificador y grabación)", action: () => studioRef.current?.openSettings("output") },
        { label: "Audio", action: () => studioRef.current?.openSettings("audio") },
        { label: "Video", action: () => studioRef.current?.openSettings("video") },
        { label: "Atajos de teclado", icon: Keyboard, action: () => studioRef.current?.openSettings("hotkeys") },
      ],
    },
    {
      id: "help",
      label: "Ayuda",
      items: [
        { label: "Guía rápida", icon: BookOpen, action: showGuide },
        {
          label: "Acerca de CoffeeLive",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeeLive 1.0",
              "Grabación de pantalla y transmisión en directo de la suite CoffeeWorks.\n\nEscenas y fuentes, filtros, croma, transiciones, modo estudio, mezclador con filtros de micrófono, codificación por hardware, reconexión automática y atajos globales. Las grabaciones se editan en CoffeeEdit."
            ),
        },
      ],
    },
  ];

  
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#120c09] select-none">
      {loaded && doc && (
        <>
          <LiveTopBar
            title={title}
            placeholder={DEFAULT_TITLE}
            onTitleChange={(next) => {
              setTitle(next);
              stateRef.current.title = next;
              scheduleSave();
            }}
            menus={menus}
            saveStatus={saveStatus}
            isStarred={isStarred}
            onToggleStar={() => void handleToggleStar()}
            onLogoClick={() => setShowStartScreen(true)}
            onSettings={() => studioRef.current?.openSettings("general")}
            onHelp={showGuide}
            live={liveStatus}
            onRequestClose={guardBusy}
            onBeforeClose={async () => {
              await flush();
            }}
          />
          <StudioView ref={studioRef} doc={doc} onChange={applyDoc} onBusyChange={setBusy} onLiveChange={setLiveStatus} />
        </>
      )}

      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeeLive"
          tagline="Grabación y transmisión en directo • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Crear una colección de escenas"
          openHint="Abrir una colección .clv"
          formats={[`.${EXTENSION}`]}
          recents={recents}
          onNew={() => whenFree(() => handleNew())}
          onOpen={() => whenFree(() => handleOpen())}
          onOpenRecent={(entry) => whenFree(() => handleOpenRecent(entry))}
          onContinue={loaded ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      <DialogHost />
    </div>
  );
};
