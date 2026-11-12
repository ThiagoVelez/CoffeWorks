import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  FilePlus,
  FolderOpen,
  SaveAll,
  Home,
  Upload,
  Table2,
  ClipboardList,
  PencilRuler,
  Code2,
  Blocks,
  Share2,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Database,
  Printer,
  Keyboard,
  Info,
  Plus,
  RefreshCw,
  Workflow,
  Moon,
  ArchiveRestore,
  BookOpen,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { ExportModal, type ExportOption } from "./components/ExportModal";
import { DialogHost, askConfirm, askText, showMessage, toast } from "./components/Dialogs";
import { NavPane, type Selection } from "./components/NavPane";
import { HomeView } from "./components/HomeView";
import { Datasheet } from "./components/Datasheet";
import { TableDesigner } from "./components/TableDesigner";
import { FormView } from "./components/FormView";
import { SqlView } from "./components/SqlView";
import { QueryBuilder } from "./components/QueryBuilder";
import { RelationsView } from "./components/RelationsView";
import { AssistantView } from "./components/AssistantView";
import { EtlView } from "./components/EtlView";
import { ManualDialog } from "./components/ManualDialog";
import { SpellStyles } from "./spell/useSpellCheck";
import { CoffeeDb, quoteId, templateScript } from "./services/engine";
import { explain } from "./services/doctor";
import { accessExportJson, importDesktopDb, importExcel, importMatrix, parseCsv, printHtml, reportHtml, sqlDump, toCsv, toXlsx } from "./services/io";
import {
  APP_ID,
  DEFAULT_TITLE,
  EXTENSION,
  IMPORT_FILTERS,
  OPEN_FILTERS,
  ensureExtension,
  newId,
  openPath,
  openWebEntry,
  persistDb,
  rememberOpened,
  type OpenedFile,
} from "./services/dbStore";
import {
  appWindow,
  bytesToText,
  extensionOf,
  getLaunchArgs,
  isTauri,
  listRecent,
  pickOpenFile,
  readFileBytes,
  renameInVault,
  saveFileAs,
  setPinned,
  stripExtension,
  writeFileBytes,
  addonStatus,
  installAddon,
  pickSavePath,
  runAddon,
  type RecentEntry,
} from "./services/desktop";
import { ACCENT, ACCENT_DARK, type Schema, type ViewId } from "./types";

const AUTOSAVE_DELAY = 1500;
const EMPTY_SCHEMA: Schema = { tables: [], views: [], queries: [], indexes: [] };

const EXPORT_OPTIONS: ExportOption[] = [
  { id: "xlsx", name: "Todas las tablas a Excel (.xlsx)", description: "Un libro con una hoja por tabla, con encabezados de color y columnas ajustadas.", badge: "XLSX", icon: FileSpreadsheet },
  { id: "csv", name: "Tabla actual a CSV", description: "Separado por punto y coma, listo para abrir en Excel o CoffeeCalc.", badge: "CSV", icon: FileText },
  { id: "sql", name: "Copia en script SQL", description: "Estructura y datos de toda la base como instrucciones SQL.", badge: "SQL", icon: Code2 },
  { id: "print", name: "Informe de la tabla actual", description: "Vista para imprimir o guardar como PDF.", badge: "PDF", icon: Printer },
  { id: "accdb", name: "Base de Access (.accdb)", description: "Tablas, datos, claves y relaciones para abrir en Microsoft Access. Usa el complemento «Compatibilidad con Access».", badge: "ACCDB", icon: Database },
  { id: "copy", name: "Copia de la base de datos", description: "Archivo .cdb (SQLite) que se abre en CoffeeDataBase y en cualquier herramienta SQLite.", badge: "CDB", icon: Database },
];

const VIEWS: { id: ViewId; label: string; icon: React.ComponentType<{ size?: number }>; needsTable?: boolean }[] = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "datasheet", label: "Hoja de datos", icon: Table2, needsTable: true },
  { id: "form", label: "Formulario", icon: ClipboardList, needsTable: true },
  { id: "design", label: "Diseño", icon: PencilRuler, needsTable: true },
  { id: "sql", label: "Consulta SQL", icon: Code2 },
  { id: "builder", label: "Diseñador de consultas", icon: Blocks },
  { id: "etl", label: "ETL", icon: Workflow },
  { id: "relations", label: "Relaciones", icon: Share2 },
  { id: "assistant", label: "Asistente", icon: Sparkles },
];

const DbLogo = <img src="/app-icon.png" alt="" className="w-full h-full" draggable={false} />;

export const App: React.FC = () => {
  const dbRef = useRef<CoffeeDb | null>(null);
  const [schema, setSchema] = useState<Schema>(EMPTY_SCHEMA);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [docId, setDocId] = useState(() => newId("cdb"));
  const [location, setLocation] = useState<string | null>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<number | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const stateRef = useRef({ title, docId, location, isStarred });
  stateRef.current = { title, docId, location, isStarred };

  const [view, setView] = useState<ViewId>("home");
  const [selection, setSelection] = useState<Selection>(null);
  const [newTable, setNewTable] = useState(false);
  const [sqlInit, setSqlInit] = useState<{ sql: string; name: string | null; nonce: number }>({ sql: "", name: null, nonce: 0 });
  const [pendingRelation, setPendingRelation] = useState<{ child: string; column: string; parent: string } | null>(null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("coffeedatabase_dark") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("coffeedatabase_dark", dark ? "1" : "0");
    } catch {
      // Sin almacenamiento
    }
  }, [dark]);
  const startedRef = useRef(false);

  const db = dbRef.current;
  const currentTable = selection?.kind === "table" ? schema.tables.find((t) => t.name === selection.name) || null : null;
  const refreshRecents = useCallback(async () => setRecents(await listRecent(APP_ID)), []);
  const reportError = (err: unknown, fallback = "Algo salió mal") => void showMessage(fallback, explain(err));

  // ---------------------------------------------------------------------------
  // Guardado automático
  // ---------------------------------------------------------------------------

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const current = dbRef.current;
    if (!current) return true;
    if (savingRef.current) await savingRef.current;
    const run = (async () => {
      const { title: t, docId: id, location: loc, isStarred: pinned } = stateRef.current;
      setSaveStatus("saving");
      try {
        let target = loc;
        if (target && isTauri && !target.startsWith("web:")) target = await renameInVault(target, ensureExtension(t || DEFAULT_TITLE, target), id);
        const saved = await persistDb(current.export(), t || DEFAULT_TITLE, id, target, pinned);
        setLocation(saved);
        stateRef.current.location = saved;
        setSaveStatus("saved");
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

  const scheduleSaveRef = useRef(scheduleSave);
  scheduleSaveRef.current = scheduleSave;

  /** Se llama después de cualquier cambio en la base. */
  const changed = useCallback(() => {
    const current = dbRef.current;
    if (!current) return;
    setSchema(current.schema());
    setVersion((v) => v + 1);
    scheduleSave();
  }, [scheduleSave]);

  const refreshSchema = () => {
    if (dbRef.current) setSchema(dbRef.current.schema());
    setVersion((v) => v + 1);
  };

  // ---------------------------------------------------------------------------
  // Abrir, crear e importar
  // ---------------------------------------------------------------------------

  const loadDb = useCallback(async (file: OpenedFile, pinned = false) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    // Las plantillas del Launcher llegan como script SQL y se convierten en SQLite al guardar
    const script = templateScript(file.bytes);
    const next = script ? await CoffeeDb.fromScript(script) : await CoffeeDb.open(file.bytes);
    dbRef.current?.close();
    dbRef.current = next;
    const sc = next.schema();
    setSchema(sc);
    setVersion((v) => v + 1);
    const name = stripExtension(file.name) || DEFAULT_TITLE;
    setTitle(name);
    setDocId(file.docId);
    setLocation(file.location);
    setIsStarred(pinned);
    setSaveStatus("saved");
    setSelection(sc.tables[0] ? { kind: "table", name: sc.tables[0].name } : null);
    setView("home");
    setNewTable(false);
    setLoaded(true);
    setShowStartScreen(false);
    stateRef.current = { title: name, docId: file.docId, location: file.location, isStarred: pinned };
    if (file.location) await rememberOpened(file);
    if (script) scheduleSaveRef.current();
  }, []);

  const flush = useCallback(async () => {
    if (dbRef.current && (saveTimer.current || savingRef.current)) await saveNow();
    return true;
  }, [saveNow]);

  const handleNew = useCallback(
    async (newTitle?: string) => {
      await flush();
      await loadDb({ name: `${newTitle || DEFAULT_TITLE}.${EXTENSION}`, bytes: new Uint8Array(), location: null, docId: newId("cdb") });
      scheduleSave();
    },
    [flush, loadDb, scheduleSave]
  );

  const handleOpen = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir base de datos");
      if (!picked) return;
      await flush();
      await loadDb({ name: picked.name, bytes: picked.bytes, location: picked.path, docId: newId("cdb") });
      if (!picked.path) scheduleSave();
    } catch (err) {
      reportError(err, "No se pudo abrir la base de datos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, loadDb, scheduleSave]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flush();
        const file = isTauri ? await openPath(entry.path, entry.id) : await openWebEntry(entry.id);
        if (!file) throw new Error("La base ya no está en el almacenamiento del navegador.");
        await loadDb(file, entry.is_pinned);
      } catch (err) {
        reportError(err, "No se encontró la base de datos");
        void refreshRecents();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flush, loadDb, refreshRecents]
  );

  /** Importa un archivo (por contenido) en la base abierta. */
  const importBytes = async (name: string, bytes: Uint8Array) => {
    const current = dbRef.current;
    if (!current) return;
    const ext = extensionOf(name);
    setBusy("Importando…");
    try {
      let results: { table: string; rows: number }[] = [];
      if (ext === "accdb" || ext === "mdb") results = await importDesktopDb(current, bytes);
      else if (["xlsx", "xls", "ods"].includes(ext)) results = importExcel(current, bytes);
      else if (ext === "sql") {
        current.query(bytesToText(bytes));
        results = [];
      } else results = [importMatrix(current, name, parseCsv(bytesToText(bytes)))];
      changed();
      if (results.length) {
        setSelection({ kind: "table", name: results[0].table });
        setView("datasheet");
        toast(results.length === 1 ? `Tabla «${results[0].table}» importada (${results[0].rows} registros)` : `${results.length} tablas importadas`);
      } else toast("Script ejecutado");
    } catch (err) {
      reportError(err, "No se pudo importar");
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (kind: keyof typeof IMPORT_FILTERS) => {
    const picked = await pickOpenFile(IMPORT_FILTERS[kind], "Importar");
    if (picked) await importBytes(picked.name, picked.bytes);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          const ext = extensionOf(args.file);
          if (["accdb", "mdb", "xlsx", "xls", "csv"].includes(ext)) {
            // «Abrir con»: una base nueva con los datos del archivo
            await handleNew(stripExtension(args.file.split(/[\\/]/).pop() || DEFAULT_TITLE));
            await importBytes(args.file, await readFileBytes(args.file));
          } else {
            await loadDb(await openPath(args.file));
          }
          return;
        }
        if (args.docId) {
          const file = await openWebEntry(args.docId);
          if (file) {
            await loadDb(file);
            return;
          }
        }
        if (args.payload) {
          // Plantilla del Launcher en el modo web
          const bytes = new TextEncoder().encode(args.payload);
          const name = args.payload.split("\n")[0].split(":").slice(1).join(":").trim() || DEFAULT_TITLE;
          await loadDb({ name: `${name}.${EXTENSION}`, bytes, location: null, docId: newId("cdb") });
          return;
        }
        if (args.newTitle !== null) {
          await handleNew(args.newTitle || DEFAULT_TITLE);
          return;
        }
      } catch (err) {
        reportError(err, "No se pudo abrir la base de datos");
      }
      await refreshRecents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(loaded ? `${title || DEFAULT_TITLE} - CoffeeDataBase` : "CoffeeDataBase");
  }, [loaded, title]);

  const handleSaveAs = async () => {
    const current = dbRef.current;
    if (!current) return;
    try {
      const path = await saveFileAs(ensureExtension(title || DEFAULT_TITLE, null), [{ name: "Base de datos de CoffeeDataBase", extensions: [EXTENSION] }], current.export(), "Guardar base de datos como");
      if (path === null) return;
      if (path) {
        const name = path.split(/[\\/]/).pop() || "";
        setLocation(path);
        setTitle(stripExtension(name));
        stateRef.current = { ...stateRef.current, location: path, title: stripExtension(name) };
        await rememberOpened({ name, bytes: new Uint8Array(), location: path, docId });
        setSaveStatus("saved");
        toast("Base guardada en la nueva ubicación");
      } else toast("Base de datos descargada");
    } catch (err) {
      reportError(err, "No se pudo guardar");
    }
  };

  /** Copia con fecha y hora en Documentos\CoffeeWorks\Copias de seguridad. */
  const handleBackup = async () => {
    const current = dbRef.current;
    if (!current) return;
    const d = new Date();
    const p = (n: number) => n.toString().padStart(2, "0");
    const name = `${title || DEFAULT_TITLE} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.${EXTENSION}`.replace(/[<>:"/\\|?*]/g, "-");
    try {
      if (isTauri) {
        const vault = await invoke<string>("core_vault_dir");
        const sep = vault.includes("\\") ? "\\" : "/";
        const path = `${vault}${sep}Copias de seguridad${sep}${name}`;
        await writeFileBytes(path, current.export());
        toast("Copia de seguridad creada en Documentos\\CoffeeWorks\\Copias de seguridad");
      } else {
        await saveFileAs(name, [{ name: "Base de datos", extensions: [EXTENSION] }], current.export(), "Copia de seguridad");
        toast("Copia de seguridad descargada");
      }
    } catch (err) {
      reportError(err, "No se pudo crear la copia");
    }
  };

  const handleToggleStar = async () => {
    const next = !isStarred;
    setIsStarred(next);
    stateRef.current.isStarred = next;
    if (location) await setPinned(docId, next);
    toast(next ? "Base fijada en el Launcher" : "Base desfijada");
  };

  // ---------------------------------------------------------------------------
  // Objetos
  // ---------------------------------------------------------------------------

  const openSql = (sql: string, name: string | null = null) => {
    setSqlInit({ sql, name, nonce: Date.now() });
    setView("sql");
  };

  const selectObject = (sel: Selection) => {
    setSelection(sel);
    setNewTable(false);
    if (!sel) return;
    if (sel.kind === "query") {
      const q = schema.queries.find((x) => x.name === sel.name);
      openSql(q?.sql || "", sel.name);
    } else if (sel.kind === "view") {
      openSql(`SELECT * FROM ${quoteId(sel.name)} LIMIT 500;`);
    } else if (view === "home" || view === "sql" || view === "builder" || view === "assistant" || view === "relations") {
      setView("datasheet");
    }
  };

  const saveQuery = async (sql: string, name: string | null) => {
    const current = dbRef.current;
    if (!current || !sql.trim()) return;
    const finalName = name || (await askText({ title: "Guardar consulta", label: "Nombre de la consulta", defaultValue: `Consulta ${schema.queries.length + 1}` }));
    if (!finalName?.trim()) return;
    current.saveQuery(finalName.trim(), sql);
    changed();
    setSelection({ kind: "query", name: finalName.trim() });
    setSqlInit((prev) => ({ ...prev, sql, name: finalName.trim() }));
    toast("Consulta guardada");
  };

  const renameObject = async (kind: "table" | "query", name: string) => {
    const current = dbRef.current;
    if (!current) return;
    const next = await askText({ title: kind === "table" ? "Cambiar el nombre de la tabla" : "Cambiar el nombre de la consulta", label: "Nombre nuevo", defaultValue: name });
    if (!next?.trim() || next.trim() === name) return;
    try {
      if (kind === "table") current.renameTable(name, next.trim());
      else {
        const q = current.queries().find((x) => x.name === name);
        current.deleteQuery(name);
        current.saveQuery(next.trim(), q?.sql || "");
      }
      changed();
      setSelection({ kind, name: next.trim() });
    } catch (err) {
      reportError(err, "No se pudo cambiar el nombre");
    }
  };

  const deleteObject = async (kind: "table" | "query" | "view", name: string) => {
    const current = dbRef.current;
    if (!current) return;
    const label = kind === "table" ? "la tabla" : kind === "query" ? "la consulta" : "la vista";
    const ok = await askConfirm({
      title: `Eliminar ${label}`,
      message: kind === "table" ? `Se eliminarán «${name}» y todos sus registros. No se puede deshacer.` : `¿Eliminar ${label} «${name}»?`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      if (kind === "table") current.dropTable(name);
      else if (kind === "query") current.deleteQuery(name);
      else current.run(`DROP VIEW ${quoteId(name)}`);
      changed();
      if (selection?.name === name) {
        setSelection(null);
        setView("home");
      }
    } catch (err) {
      reportError(err, "No se pudo eliminar");
    }
  };

  const startNewTable = () => {
    setNewTable(true);
    setSelection(null);
    setView("design");
  };

  // ---------------------------------------------------------------------------
  // Exportar
  // ---------------------------------------------------------------------------

  const exportRows = async (columns: string[], rows: unknown[][], kind: "csv" | "xlsx" | "print", name: string) => {
    try {
      if (kind === "print") {
        printHtml(reportHtml(name, columns, rows, title));
        return;
      }
      const path =
        kind === "csv"
          ? await saveFileAs(`${name}.csv`, [{ name: "CSV", extensions: ["csv"] }], toCsv(columns, rows), "Exportar a CSV")
          : await saveFileAs(`${name}.xlsx`, [{ name: "Libro de Excel", extensions: ["xlsx"] }], toXlsx([{ name, columns, rows }]), "Exportar a Excel");
      if (path !== null) toast("Exportado");
    } catch (err) {
      reportError(err, "No se pudo exportar");
    }
  };

  /** Exporta a Access con el complemento; si falta, ofrece instalarlo. */
  const exportAccess = async (current: CoffeeDb, base: string) => {
    const addon = await addonStatus("accdb");
    if (!addon) throw new Error("Exportar a Access solo está disponible en la aplicación de escritorio.");
    if (!current.schema().tables.length) throw new Error("La base no tiene tablas.");
    if (!addon.installed) {
      if (!addon.can_install) throw new Error(addon.manual_hint);
      const ok = await askConfirm({
        title: "Complemento necesario",
        message: `Para guardar en formato Access necesitas el complemento «${addon.name}» (${addon.download_size}). Se descarga una sola vez y también puedes gestionarlo en el Launcher › Complementos. ¿Instalarlo ahora?`,
        confirmLabel: "Instalar",
      });
      if (!ok) return;
      toast("Descargando el complemento…");
      await installAddon("accdb");
      toast("Complemento instalado");
    }
    const path = await pickSavePath(
      `${base}.accdb`,
      [
        { name: "Base de datos de Access", extensions: ["accdb"] },
        { name: "Access 2000-2003", extensions: ["mdb"] },
      ],
      "Exportar a Access"
    );
    if (!path) return;
    await runAddon("accdb", ["export", "{input}", path], accessExportJson(current));
    toast("Exportado a Access");
  };

  const handleExport = async (id: string) => {
    setExportOpen(false);
    const current = dbRef.current;
    if (!current) return;
    const base = title || DEFAULT_TITLE;
    try {
      if (id === "xlsx") {
        const sheets = schema.tables.map((t) => {
          const r = current.query(`SELECT * FROM ${quoteId(t.name)}`, [], Number.MAX_SAFE_INTEGER);
          return { name: t.name, columns: r.columns, rows: r.rows };
        });
        if (!sheets.length) throw new Error("La base no tiene tablas.");
        const path = await saveFileAs(`${base}.xlsx`, [{ name: "Libro de Excel", extensions: ["xlsx"] }], toXlsx(sheets), "Exportar a Excel");
        if (path !== null) toast("Exportado a Excel");
      } else if (id === "csv" || id === "print") {
        if (!currentTable) throw new Error("Selecciona una tabla en el panel de la izquierda.");
        const r = current.query(`SELECT * FROM ${quoteId(currentTable.name)}`, [], Number.MAX_SAFE_INTEGER);
        await exportRows(r.columns, r.rows, id === "csv" ? "csv" : "print", currentTable.name);
      } else if (id === "sql") {
        const path = await saveFileAs(`${base}.sql`, [{ name: "Script SQL", extensions: ["sql"] }], sqlDump(current), "Exportar script SQL");
        if (path !== null) toast("Script SQL exportado");
      } else if (id === "accdb") {
        await exportAccess(current, base);
      } else if (id === "copy") {
        const path = await saveFileAs(`${base} (copia).${EXTENSION}`, [{ name: "Base de datos", extensions: [EXTENSION] }], current.export(), "Guardar copia");
        if (path !== null) toast("Copia guardada");
      }
    } catch (err) {
      reportError(err, "No se pudo exportar");
    }
  };

  // ---------------------------------------------------------------------------
  // Atajos y menús
  // ---------------------------------------------------------------------------

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    if (!loaded || showStartScreen) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.altKey && key === "/") {
      e.preventDefault();
      setCommandSearchOpen(true);
    } else if (ctrl && key === "s") {
      e.preventDefault();
      if (e.shiftKey) void handleSaveAs();
      else void saveNow().then((ok) => ok && toast("Base de datos guardada"));
    } else if (ctrl && key === "k") {
      e.preventDefault();
      setCommandSearchOpen(true);
    } else if (e.key === "F1") {
      e.preventDefault();
      setManualOpen(true);
    } else if (e.key === "F5") {
      e.preventDefault();
      refreshSchema();
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const menus: MenuDefinition[] = [
    {
      id: "file",
      label: "Archivo",
      items: [
        { label: "Nueva base de datos", icon: FilePlus, action: () => void handleNew() },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpen() },
        { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void handleSaveAs() },
        { label: "Copia de seguridad", icon: ArchiveRestore, action: () => void handleBackup() },
        { divider: true },
        { label: "Exportar…", icon: ArrowUpRight, action: () => setExportOpen(true) },
        { divider: true },
        { label: "Pantalla de inicio", icon: Home, action: () => setShowStartScreen(true) },
      ],
    },
    {
      id: "create",
      label: "Crear",
      items: [
        { label: "Tabla", icon: Plus, action: startNewTable },
        { label: "Consulta SQL", icon: Code2, action: () => openSql("") },
        { label: "Consulta con el diseñador", icon: Blocks, action: () => setView("builder") },
        { label: "Relación", icon: Share2, action: () => setView("relations") },
        { label: "Desde una plantilla…", icon: Sparkles, action: () => setView("assistant") },
      ],
    },
    {
      id: "import",
      label: "Datos externos",
      items: [
        { label: "Importar Excel (.xlsx)…", icon: FileSpreadsheet, action: () => void handleImport("excel") },
        { label: "Importar CSV…", icon: FileText, action: () => void handleImport("csv") },
        { label: "Importar base .accdb / .mdb…", icon: Database, action: () => void handleImport("desktop") },
        { label: "Ejecutar script SQL…", icon: Code2, action: () => void handleImport("sql") },
        { divider: true },
        { label: "Exportar…", icon: ArrowUpRight, action: () => setExportOpen(true) },
      ],
    },
    {
      id: "view",
      label: "Ver",
      items: [
        ...VIEWS.map((v) => ({ label: v.label, icon: v.icon, checked: view === v.id, disabled: v.needsTable && !currentTable, action: () => setView(v.id) })),
        { divider: true as const },
        { label: "Actualizar", icon: RefreshCw, shortcut: "F5", action: refreshSchema },
        { label: "Tema oscuro", icon: Moon, checked: dark, action: () => setDark((v) => !v) },
      ],
    },
    {
      id: "help",
      label: "Ayuda",
      items: [
        { label: "Manual de usuario", icon: BookOpen, shortcut: "F1", action: () => setManualOpen(true) },
        {
          label: "Primeros pasos",
          icon: Keyboard,
          action: () =>
            void showMessage(
              "Primeros pasos",
              [
                "1. Crea una tabla (Crear › Tabla) o usa una plantilla del Asistente.",
                "2. En Diseño defines los campos y su tipo; la llave marca la clave principal.",
                "3. En Hoja de datos añades y editas registros; Formulario los muestra de uno en uno.",
                "4. En Relaciones unes las tablas (por ejemplo, pedidos → clientes).",
                "5. Consulta SQL o el Diseñador de consultas sacan la información que necesitas.",
                "",
                "Ctrl+S guardar · F5 actualizar · Ctrl+K buscar un comando · F1 manual. La base se guarda sola.",
              ].join("\n")
            ),
        },
        {
          label: "Acerca de CoffeeDataBase",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeeDataBase 1.0",
              "Bases de datos de escritorio de la suite CoffeeWorks, sobre SQLite.\n\nTablas, hoja de datos, formularios, consultas SQL y visuales, relaciones con diagrama, asistente con plantillas y datos de prueba, e importación de Excel, CSV y archivos .accdb/.mdb."
            ),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {loaded && db && (
        <>
          <SuiteHeader
            logo={DbLogo}
            logoTitle="Pantalla de inicio de CoffeeDataBase"
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
                className="text-white font-semibold text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5 hover:opacity-90"
                style={{ background: ACCENT }}
              >
                <ArrowUpRight size={15} />
                <span>Exportar</span>
              </button>
            }
          />

          <div className="h-10 shrink-0 flex items-center gap-0.5 px-2 border-b border-[#ead9db] bg-[#fdf7f7] overflow-x-auto">
            {VIEWS.map((v) => {
              const disabled = v.needsTable && !currentTable && !(v.id === "design" && newTable);
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  data-view={v.id}
                  disabled={disabled}
                  onClick={() => {
                    setNewTable(false);
                    setView(v.id);
                  }}
                  className={`h-8 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-35 ${
                    view === v.id ? "text-white" : "text-[#5a3a3e] hover:bg-[#f6e6e8]"
                  }`}
                  style={view === v.id ? { background: ACCENT } : undefined}
                >
                  <Icon size={14} /> {v.label}
                </button>
              );
            })}
            <div className="flex-1" />
            <button type="button" onClick={() => void handleImport("excel")} className="h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 text-[#5a3a3e] hover:bg-[#f6e6e8] whitespace-nowrap" data-import>
              <Upload size={14} /> Importar
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <NavPane
              schema={schema}
              selection={selection}
              onSelect={selectObject}
              onNewTable={startNewTable}
              onNewQuery={() => openSql("")}
              onDesign={(name) => {
                setSelection({ kind: "table", name });
                setNewTable(false);
                setView("design");
              }}
              onRename={(kind, name) => void renameObject(kind, name)}
              onDelete={(kind, name) => void deleteObject(kind, name)}
            />
            <main className="flex-1 flex flex-col overflow-hidden">
              {view === "home" && (
                <HomeView
                  schema={schema}
                  sizeBytes={db.sizeBytes()}
                  onNewTable={startNewTable}
                  onImport={() => void handleImport("excel")}
                  onAssistant={() => setView("assistant")}
                  onSql={() => openSql("")}
                  onRelations={() => setView("relations")}
                  onOpenTable={(name) => {
                    setSelection({ kind: "table", name });
                    setView("datasheet");
                  }}
                />
              )}
              {view === "datasheet" && currentTable && <Datasheet db={db} table={currentTable} version={version} onChanged={changed} />}
              {view === "form" && currentTable && <FormView db={db} table={currentTable} version={version} onChanged={changed} />}
              {view === "design" && (newTable || currentTable) && (
                <TableDesigner
                  db={db}
                  table={newTable ? null : currentTable}
                  onSaved={(name) => {
                    changed();
                    setNewTable(false);
                    setSelection({ kind: "table", name });
                  }}
                />
              )}
              {view === "sql" && (
                <SqlView
                  key={sqlInit.nonce}
                  db={db}
                  schema={schema}
                  initialSql={sqlInit.sql}
                  queryName={sqlInit.name}
                  onExecuted={(dataChanged) => (dataChanged ? changed() : undefined)}
                  onSave={(sql, name) => void saveQuery(sql, name)}
                  onExport={(c, r, k, n) => void exportRows(c, r, k, n)}
                />
              )}
              {view === "etl" && (
                <EtlView db={db} schema={schema} version={version} onChanged={changed} onExport={(c, r, n) => void exportRows(c, r, "xlsx", n)} />
              )}
              {view === "builder" && <QueryBuilder db={db} schema={schema} onSave={(sql) => void saveQuery(sql, null)} onOpenSql={(sql) => openSql(sql)} />}
              {view === "relations" && (
                <RelationsView db={db} schema={schema} onChanged={changed} pending={pendingRelation} onPendingHandled={() => setPendingRelation(null)} />
              )}
              {view === "assistant" && (
                <AssistantView
                  db={db}
                  schema={schema}
                  version={version}
                  onChanged={changed}
                  onRelationship={(fix) => {
                    setPendingRelation(fix);
                    setView("relations");
                  }}
                />
              )}
            </main>
          </div>

          <footer className="h-6 px-3 flex items-center justify-between text-[11px] font-mono text-white shrink-0" style={{ background: ACCENT }}>
            <span>
              {schema.tables.length} tablas · {schema.tables.reduce((s, t) => s + t.rowCount, 0).toLocaleString("es")} registros · SQLite
            </span>
            <span className="truncate max-w-[50%]" title={location || undefined}>
              {location && !location.startsWith("web:") ? location : isTauri ? "Sin guardar en disco" : "Guardado en el navegador"}
            </span>
          </footer>
        </>
      )}

      {busy && (
        <div className="fixed inset-0 z-[99980] bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl px-5 py-3 text-[13px] flex items-center gap-2">
            <RefreshCw size={15} className="animate-spin text-[#9b111e]" /> {busy}
          </div>
        </div>
      )}

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} title="Exportar" fileTitle={title || DEFAULT_TITLE} options={EXPORT_OPTIONS} onExport={(id) => void handleExport(id)} />
      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeeDataBase"
          tagline="Bases de datos • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Crear una base de datos vacía"
          openHint="Abrir .cdb, .db o .sqlite"
          formats={[".cdb", ".db", ".sqlite"]}
          recents={recents}
          onNew={() => void handleNew()}
          onOpen={() => void handleOpen()}
          onOpenRecent={(entry) => void handleOpenRecent(entry)}
          onContinue={loaded ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      {manualOpen && <ManualDialog onClose={() => setManualOpen(false)} />}
      <SpellStyles />
      <DialogHost />
    </div>
  );
};
