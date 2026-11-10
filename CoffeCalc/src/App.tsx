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
  FileText,
  FileSpreadsheet,
  Sheet as SheetIcon,
  BarChart3,
  Filter,
  Shield,
  Keyboard,
  Info,
  Scissors,
  Copy,
  ClipboardPaste,
  Link as LinkIcon,
  MessageSquarePlus,
  Table2,
} from "lucide-react";
import { SuiteHeader, type MenuDefinition, type SaveStatus } from "./components/SuiteHeader";
import { GoogleSheetsToolbar, type BorderPreset } from "./components/GoogleSheetsToolbar";
import { FormulaBar } from "./components/FormulaBar";
import { SpreadsheetGrid, type CellPosition, type MoveDirection } from "./components/SpreadsheetGrid";
import { SheetTabsBar } from "./components/SheetTabsBar";
import { ExportModal, type ExportOption } from "./components/ExportModal";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { FindPanel } from "./components/FindPanel";
import { PrintSheet } from "./components/PrintSheet";
import { ContextMenu, FilterMenu, type ContextMenuItem } from "./components/FloatingMenus";
import { DialogHost, askConfirm, askForm, showMessage, toast } from "./components/Dialogs";
import {
  APP_ID,
  DEFAULT_TITLE,
  OPEN_FILTERS,
  createBlankWorkbook,
  createSampleWorkbook,
  createSheet,
  exportWorkbook,
  importFile,
  loadLegacyWorkbook,
  loadWebWorkbook,
  newId,
  openPath,
  persistWorkbook,
  saveWorkbookAs,
  usedBounds,
  type OpenResult,
} from "./services/sheetVault";
import {
  appWindow,
  extensionOf,
  getLaunchArgs,
  isTauri,
  listRecent,
  openExternal,
  pickOpenFile,
  setPinned,
  type RecentEntry,
} from "./services/desktop";
import {
  cellKey,
  colIndexToName,
  parseCellKey,
  recalcWorkbook,
  suggestedFormat,
} from "./services/formulaEngine";
import {
  applyStyle,
  boundsLabel,
  clearContents,
  copyRange,
  displayText,
  effectiveRange,
  estimateTextWidth,
  fillRange,
  filterValues,
  looksLikeHeader,
  mapRange,
  mergeAt,
  normalize,
  pasteClipboard,
  pasteText,
  removeDuplicates,
  shiftStructure,
  sortRange,
  styleOf,
  textToColumns,
  writeCell,
  type ClipboardData,
  type PasteMode,
} from "./services/sheetOps";
import type {
  Bounds,
  CellData,
  ChartType,
  ConditionKind,
  ExportFormat,
  SelectionRange,
  SelectionStats,
  Sheet,
  Workbook,
} from "./types";
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, HEADER_HEIGHT, HEADER_WIDTH } from "./types";

const HISTORY_LIMIT = 100;

const SheetsLogo = (
  <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
    <path
      d="M24.5 4H10C8.34315 4 7 5.34315 7 7V33C7 34.6569 8.34315 36 10 36H30C31.6569 36 33 34.6569 33 33V12.5L24.5 4Z"
      fill="#0F9D58"
    />
    <path d="M24 4V13H33L24 4Z" fill="#87CEAC" />
    <path d="M12 18H28V30H12V18ZM14 20V23H19V20H14ZM21 20V23H26V20H21ZM14 25V28H19V25H14ZM21 25V28H26V25H21Z" fill="white" />
  </svg>
);

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: "xlsx",
    name: "Microsoft Excel (.xlsx)",
    description: "Todas las hojas con fórmulas, formato de celdas, anchos de columna y celdas combinadas.",
    badge: "Excel",
    icon: FileSpreadsheet,
  },
  {
    id: "cfs",
    name: "Libro de CoffeCalc (.cfs)",
    description: "Copia completa del libro, incluidos gráficos, filtros y formato condicional.",
    badge: "Nativo",
    icon: SheetIcon,
  },
  {
    id: "csv",
    name: "Valores separados por comas (.csv)",
    description: "Solo los valores de la hoja activa, para importar en otros programas.",
    badge: "CSV",
    icon: FileText,
  },
  {
    id: "pdf",
    name: "Imprimir / Guardar como PDF",
    description: "Abre el diálogo de impresión; elige «Guardar como PDF» como impresora.",
    badge: "PDF",
    icon: Printer,
  },
];

const CONDITION_COLORS: Record<string, { bg: string; color: string }> = {
  green: { bg: "#d9ead3", color: "#274e13" },
  red: { bg: "#f4cccc", color: "#990000" },
  yellow: { bg: "#fff2cc", color: "#7f6000" },
  blue: { bg: "#cfe2f3", color: "#073763" },
};

const single = (cell: CellPosition): Bounds => ({ r1: cell.row, c1: cell.col, r2: cell.row, c2: cell.col });

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
};

export const App: React.FC = () => {
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [isStarred, setIsStarred] = useState(false);

  const [activeCell, setActiveCell] = useState<CellPosition>({ col: 0, row: 0 });
  const [selection, setSelection] = useState<Bounds>({ r1: 0, c1: 0, r2: 0, c2: 0 });
  const [editing, setEditing] = useState<{ value: string; inCell: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [painter, setPainter] = useState<Partial<CellData> | null>(null);

  const [zoom, setZoom] = useState(100);
  const [showGridlines, setShowGridlines] = useState(true);
  const [showFormulaBar, setShowFormulaBar] = useState(true);
  const [showFormulas, setShowFormulas] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [filterMenu, setFilterMenu] = useState<{ col: number; x: number; y: number } | null>(null);

  const workbookRef = useRef<Workbook | null>(null);
  const filePathRef = useRef<string | null>(null);
  const changeCounter = useRef(0);
  const savedCounter = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const history = useRef<{ stack: Sheet[][]; index: number; lastKey: string; lastTime: number }>({
    stack: [],
    index: -1,
    lastKey: "",
    lastTime: 0,
  });
  const startedRef = useRef(false);

  workbookRef.current = workbook;
  filePathRef.current = filePath;

  const sheets = workbook?.sheets || [];
  const sheet = sheets.find((s) => s.id === workbook?.activeSheetId) || sheets[0];
  const title = workbook?.metadata.title ?? "";
  const readOnly = Boolean(sheet?.isProtected);
  const activeKey = cellKey(activeCell.col, activeCell.row);
  const activeData = sheet?.data[activeKey];

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
    if (!workbookRef.current) return Promise.resolve();
    setSaveStatus("saving");
    saveChain.current = saveChain.current.then(async () => {
      const current = workbookRef.current;
      if (!current) return;
      const version = changeCounter.current;
      try {
        const path = await persistWorkbook(current, filePathRef.current);
        filePathRef.current = path;
        setFilePath(path);
        savedCounter.current = version;
        setSaveStatus(changeCounter.current === version ? "saved" : "dirty");
      } catch (err) {
        console.error("Error al guardar el libro:", err);
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
    if (workbookRef.current && changeCounter.current !== savedCounter.current) await saveNow();
  }, [saveNow]);

  // -------------------------------------------------------------------------
  // Modificación del libro e historial
  // -------------------------------------------------------------------------

  /**
   * Aplica un nuevo conjunto de hojas: recalcula las fórmulas, lo registra en
   * el historial y programa el guardado. Las acciones continuas (arrastrar un
   * borde, mover un gráfico) comparten `coalesceKey` para ocupar un solo paso.
   */
  const applySheets = useCallback(
    (nextSheets: Sheet[], coalesceKey = "") => {
      const current = workbookRef.current;
      if (!current) return;
      const recalculated = recalcWorkbook(nextSheets);
      const next = { ...current, sheets: recalculated };
      workbookRef.current = next;
      setWorkbook(next);

      const h = history.current;
      const now = Date.now();
      if (coalesceKey && h.lastKey === coalesceKey && now - h.lastTime < 1500 && h.index === h.stack.length - 1) {
        h.stack[h.index] = recalculated;
      } else {
        h.stack = h.stack.slice(0, h.index + 1);
        h.stack.push(recalculated);
        if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
        h.index = h.stack.length - 1;
      }
      h.lastKey = coalesceKey;
      h.lastTime = now;
      markDirty();
    },
    [markDirty]
  );

  const updateSheet = useCallback(
    (mutate: (current: Sheet) => Sheet, coalesceKey = "") => {
      const current = workbookRef.current;
      if (!current) return;
      const activeId = current.activeSheetId;
      applySheets(
        current.sheets.map((s) => (s.id === activeId ? mutate(s) : s)),
        coalesceKey
      );
    },
    [applySheets]
  );

  const travelHistory = useCallback(
    (direction: -1 | 1) => {
      const h = history.current;
      const current = workbookRef.current;
      const target = h.index + direction;
      if (!current || target < 0 || target >= h.stack.length) return;
      h.index = target;
      h.lastKey = "";
      const restored = h.stack[target];
      const activeSheetId = restored.some((s) => s.id === current.activeSheetId)
        ? current.activeSheetId
        : restored[0].id;
      const next = { ...current, sheets: restored, activeSheetId };
      workbookRef.current = next;
      setWorkbook(next);
      setEditing(null);
      markDirty();
    },
    [markDirty]
  );

  const handleUndo = useCallback(() => travelHistory(-1), [travelHistory]);
  const handleRedo = useCallback(() => travelHistory(1), [travelHistory]);

  // -------------------------------------------------------------------------
  // Abrir, crear y guardar libros
  // -------------------------------------------------------------------------

  const loadWorkbook = useCallback((result: OpenResult, pinned = false) => {
    history.current = { stack: [result.workbook.sheets], index: 0, lastKey: "", lastTime: 0 };
    changeCounter.current = 0;
    savedCounter.current = 0;
    workbookRef.current = result.workbook;
    filePathRef.current = result.filePath;
    setWorkbook(result.workbook);
    setFilePath(result.filePath);
    setSaveStatus("saved");
    setIsStarred(pinned);
    setShowStartScreen(false);
    setActiveCell({ col: 0, row: 0 });
    setSelection({ r1: 0, c1: 0, r2: 0, c2: 0 });
    setEditing(null);
    setClipboard(null);
    setPainter(null);
    setFindOpen(false);
  }, []);

  const reportOpenError = (err: unknown) => {
    console.error("Error al abrir el libro:", err);
    void showMessage(
      "No se pudo abrir el archivo",
      err instanceof Error ? err.message : "El archivo está dañado o su formato no es compatible."
    );
  };

  const handleNewWorkbook = useCallback(
    async (newTitle?: string) => {
      await flushPendingSave();
      loadWorkbook({ workbook: createBlankWorkbook(newTitle || DEFAULT_TITLE), filePath: null });
    },
    [flushPendingSave, loadWorkbook]
  );

  const handleOpenWorkbook = useCallback(async () => {
    try {
      const picked = await pickOpenFile(OPEN_FILTERS, "Abrir hoja de cálculo");
      if (!picked) return;
      await flushPendingSave();
      const result = await importFile(picked);
      loadWorkbook(result);
      if (!result.filePath) {
        changeCounter.current += 1;
        await saveNow();
        if (extensionOf(picked.name) !== "cfs") toast(`«${picked.name}» se importó como libro de CoffeCalc`);
      }
    } catch (err) {
      reportOpenError(err);
    }
  }, [flushPendingSave, loadWorkbook, saveNow]);

  const handleOpenRecent = useCallback(
    async (entry: RecentEntry) => {
      try {
        await flushPendingSave();
        if (isTauri) {
          loadWorkbook(await openPath(entry.path), entry.is_pinned);
        } else {
          const stored = loadWebWorkbook(entry.id);
          if (!stored) throw new Error("El libro ya no está en el almacenamiento del navegador.");
          loadWorkbook({ workbook: stored, filePath: null }, entry.is_pinned);
        }
      } catch (err) {
        reportOpenError(err);
        void refreshRecents();
      }
    },
    [flushPendingSave, loadWorkbook, refreshRecents]
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const args = await getLaunchArgs();
      try {
        if (args.file) {
          const result = await openPath(args.file);
          loadWorkbook(result);
          if (!result.filePath) {
            changeCounter.current += 1;
            await saveNow();
          }
          return;
        }
        if (args.docId) {
          const stored = loadWebWorkbook(args.docId);
          if (stored) {
            loadWorkbook({ workbook: stored, filePath: null });
            return;
          }
        }
        if (args.newTitle !== null) {
          loadWorkbook({ workbook: createBlankWorkbook(args.newTitle || DEFAULT_TITLE), filePath: null });
          changeCounter.current += 1;
          await saveNow();
          return;
        }
      } catch (err) {
        reportOpenError(err);
      }

      let entries = await listRecent(APP_ID);
      if (entries.length === 0 && !isTauri) {
        const legacy = loadLegacyWorkbook();
        if (legacy) {
          await persistWorkbook(legacy, null);
          entries = await listRecent(APP_ID);
        }
      }
      setRecents(entries);
    })();
  }, [loadWorkbook, saveNow]);

  useEffect(() => {
    if (showStartScreen) void refreshRecents();
  }, [showStartScreen, refreshRecents]);

  useEffect(() => {
    void appWindow.setTitle(workbook ? `${title || DEFAULT_TITLE} - CoffeCalc` : "CoffeCalc");
  }, [workbook, title]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (workbookRef.current && changeCounter.current !== savedCounter.current) void saveNow();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveNow]);

  const handleTitleChange = (newTitle: string) => {
    setWorkbook((prev) => (prev ? { ...prev, metadata: { ...prev.metadata, title: newTitle } } : prev));
    markDirty();
  };

  const handleSave = async () => {
    changeCounter.current += 1;
    await saveNow();
    toast("Libro guardado");
  };

  const handleSaveAs = async () => {
    const current = workbookRef.current;
    if (!current) return;
    try {
      const path = await saveWorkbookAs(current);
      if (path === null) return;
      if (path) {
        filePathRef.current = path;
        setFilePath(path);
        changeCounter.current += 1;
        await saveNow();
        toast("Libro guardado en la nueva ubicación");
      } else {
        toast("Copia descargada");
      }
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar el libro", "error");
    }
  };

  const handlePrint = useCallback(() => {
    setEditing(null);
    window.setTimeout(() => window.print(), 50);
  }, []);

  const handleExport = async (format: string) => {
    const current = workbookRef.current;
    if (!current) return;
    if (format === "pdf") {
      handlePrint();
      return;
    }
    try {
      const done = await exportWorkbook(current, format as Exclude<ExportFormat, "pdf">);
      if (done) toast(`Libro exportado como .${format}`);
    } catch (err) {
      console.error("Error al exportar:", err);
      toast("No se pudo exportar el libro", "error");
    }
  };

  const handleToggleStar = async () => {
    const current = workbookRef.current;
    if (!current) return;
    const next = !isStarred;
    setIsStarred(next);
    changeCounter.current += 1;
    await saveNow();
    await setPinned(current.metadata.id, next);
    toast(next ? "Libro fijado en el Launcher" : "Libro desfijado");
  };

  // -------------------------------------------------------------------------
  // Selección y edición de celdas
  // -------------------------------------------------------------------------

  const guardProtected = () => {
    if (!readOnly) return false;
    toast("La hoja está protegida. Desactiva la protección para modificarla.", "info");
    return true;
  };

  const handleSelect = useCallback(
    (range: SelectionRange, active: CellPosition) => {
      const bounds = normalize(range);
      setSelection(bounds);
      setActiveCell(active);
      // Copiar formato: se aplica sobre la siguiente selección
      if (painter) {
        updateSheet((current) => applyStyle(current, bounds, painter));
        setPainter(null);
      }
    },
    [painter, updateSheet]
  );

  const selectCell = (col: number, row: number) => {
    const target = { col: Math.max(0, col), row: Math.max(0, row) };
    setActiveCell(target);
    setSelection(single(target));
  };

  const startEdit = (initial?: string, inCell = true) => {
    if (!sheet || guardProtected()) return;
    setEditing({ value: initial ?? activeData?.raw ?? "", inCell });
  };

  const commitEdit = (move: MoveDirection) => {
    if (!editing || !sheet) return;
    let value = editing.value;
    if (value.startsWith("=")) {
      // Cerrar los paréntesis que falten, como hace Excel
      const missing = (value.match(/\(/g) || []).length - (value.match(/\)/g) || []).length;
      if (missing > 0) value += ")".repeat(missing);
    }
    const key = activeKey;
    const previous = sheet.data[key];
    setEditing(null);
    if ((previous?.raw ?? "") !== value) {
      updateSheet((current) => {
        const data = { ...current.data };
        const next = writeCell(data[key], value);
        if (value.startsWith("=") && (!next.format || next.format === "general")) {
          const suggested = suggestedFormat(value);
          if (suggested) next.format = suggested;
        }
        if (value === "" && Object.keys(next).length === 1) delete data[key];
        else data[key] = next;
        return { ...current, data };
      });
    }
    const merge = mergeAt(sheet, activeCell.col, activeCell.row);
    const bottom = merge ? merge.r2 : activeCell.row;
    const right = merge ? merge.c2 : activeCell.col;
    if (move === "down") selectCell(activeCell.col, bottom + 1);
    else if (move === "up") selectCell(activeCell.col, activeCell.row - 1);
    else if (move === "right") selectCell(right + 1, activeCell.row);
    else if (move === "left") selectCell(activeCell.col - 1, activeCell.row);
  };

  const cancelEdit = () => setEditing(null);

  const handleClear = () => {
    if (!sheet || guardProtected()) return;
    updateSheet((current) => clearContents(current, selection));
  };

  // -------------------------------------------------------------------------
  // Formato
  // -------------------------------------------------------------------------

  const handleStyle = (patch: Partial<CellData>) => {
    if (!sheet || guardProtected()) return;
    updateSheet((current) =>
      mapRange(current, selection, (cell) => {
        const next: CellData = { ...cell };
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete (next as unknown as Record<string, unknown>)[key];
          else (next as unknown as Record<string, unknown>)[key] = value;
        }
        if (patch.format && patch.format !== "currency") delete next.currency;
        if (patch.format) delete next.decimals;
        return next;
      })
    );
  };

  const handleToggle = (key: "bold" | "italic" | "underline" | "strike" | "wrapText") => {
    if (!sheet || guardProtected()) return;
    const enable = !activeData?.[key];
    updateSheet((current) => {
      let next = mapRange(current, selection, (cell) => ({ ...cell, [key]: enable }));
      if (key === "wrapText" && enable) {
        // Al ajustar el texto se da a cada fila el alto que necesita
        const heights = { ...(next.rowHeights || {}) };
        for (let r = selection.r1; r <= Math.min(selection.r2, selection.r1 + 500); r++) {
          let lines = 1;
          for (let c = selection.c1; c <= Math.min(selection.c2, selection.c1 + 60); c++) {
            const cell = next.data[cellKey(c, r)];
            if (!cell?.raw) continue;
            const width = next.colWidths?.[colIndexToName(c)] || DEFAULT_COL_WIDTH;
            lines = Math.max(lines, Math.ceil(estimateTextWidth(cell) / Math.max(20, width - 12)));
          }
          if (lines > 1) heights[r] = Math.max(heights[r] || 0, lines * 17 + 7);
        }
        next = { ...next, rowHeights: heights };
      }
      return next;
    });
  };

  const handleDecimals = (delta: number) => {
    if (!sheet || guardProtected()) return;
    updateSheet((current) =>
      mapRange(current, selection, (cell) => {
        if (typeof cell.computed !== "number") return cell;
        const base =
          cell.decimals ??
          (cell.format === "number" ? 2 : cell.format === "currency" && (cell.currency || "COP") !== "COP" ? 2 : 0);
        const format = !cell.format || cell.format === "general" ? "number" : cell.format;
        return { ...cell, format, decimals: Math.max(0, Math.min(10, base + delta)) };
      })
    );
  };

  const handleBorders = (preset: BorderPreset) => {
    if (!sheet || guardProtected()) return;
    updateSheet((current) =>
      mapRange(current, selection, (cell, col, row) => {
        if (preset === "none") {
          const { borders: _borders, ...rest } = cell;
          return rest.raw === "" && Object.keys(rest).length === 1 ? null : rest;
        }
        const borders =
          preset === "all"
            ? { top: true, bottom: true, left: true, right: true }
            : preset === "bottom"
            ? { ...(cell.borders || {}), bottom: row === selection.r2 || cell.borders?.bottom }
            : {
                ...(cell.borders || {}),
                top: row === selection.r1 || cell.borders?.top,
                bottom: row === selection.r2 || cell.borders?.bottom,
                left: col === selection.c1 || cell.borders?.left,
                right: col === selection.c2 || cell.borders?.right,
              };
        const hasAny = Object.values(borders).some(Boolean);
        return hasAny ? { ...cell, borders } : cell;
      })
    );
  };

  const activeMerge = sheet ? mergeAt(sheet, activeCell.col, activeCell.row) : null;

  const handleMerge = () => {
    if (!sheet || guardProtected()) return;
    if (activeMerge) {
      updateSheet((current) => ({
        ...current,
        merges: (current.merges || []).filter((m) => m !== mergeAt(current, activeCell.col, activeCell.row)),
      }));
      return;
    }
    if (selection.r1 === selection.r2 && selection.c1 === selection.c2) {
      toast("Selecciona varias celdas para combinarlas", "info");
      return;
    }
    updateSheet((current) => {
      const anchorKey = cellKey(selection.c1, selection.r1);
      // Se conserva el primer contenido que haya en el rango
      let keep: CellData | undefined = current.data[anchorKey];
      const data = { ...current.data };
      for (let r = selection.r1; r <= selection.r2; r++) {
        for (let c = selection.c1; c <= selection.c2; c++) {
          const key = cellKey(c, r);
          if (!keep?.raw && data[key]?.raw) keep = data[key];
          if (key !== anchorKey) delete data[key];
        }
      }
      data[anchorKey] = { ...(keep || { raw: "" }), align: keep?.align || "center", valign: keep?.valign || "middle" };
      const merges = (current.merges || []).filter(
        (m) => m.r2 < selection.r1 || m.r1 > selection.r2 || m.c2 < selection.c1 || m.c1 > selection.c2
      );
      return { ...current, data, merges: [...merges, { ...selection }] };
    });
    setActiveCell({ col: selection.c1, row: selection.r1 });
  };

  const handleTogglePainter = () => {
    if (painter) {
      setPainter(null);
      return;
    }
    if (guardProtected()) return;
    setPainter(styleOf(activeData));
    toast("Formato copiado: selecciona las celdas de destino", "info");
  };

  const handleConditionalFormatting = async () => {
    if (!sheet || guardProtected()) return;
    const range = effectiveRange(sheet, selection);
    const values = await askForm({
      title: "Formato condicional",
      message: `Se aplicará al rango ${boundsLabel(range)}.`,
      confirmLabel: "Aplicar regla",
      fields: [
        {
          name: "kind",
          label: "Resaltar las celdas cuyo valor…",
          type: "select",
          defaultValue: "gt",
          options: [
            { value: "gt", label: "Es mayor que" },
            { value: "lt", label: "Es menor que" },
            { value: "eq", label: "Es igual a" },
            { value: "neq", label: "Es distinto de" },
            { value: "between", label: "Está entre (valor y segundo valor)" },
            { value: "contains", label: "Contiene el texto" },
            { value: "duplicate", label: "Está duplicado" },
            { value: "top", label: "Está entre los N mayores" },
          ],
        },
        { name: "value", label: "Valor", defaultValue: "0" },
        { name: "value2", label: "Segundo valor (solo para «está entre»)", defaultValue: "" },
        {
          name: "color",
          label: "Formato",
          type: "select",
          defaultValue: "green",
          options: [
            { value: "green", label: "Relleno verde" },
            { value: "red", label: "Relleno rojo" },
            { value: "yellow", label: "Relleno amarillo" },
            { value: "blue", label: "Relleno azul" },
          ],
        },
      ],
    });
    if (!values) return;
    const colors = CONDITION_COLORS[values.color] || CONDITION_COLORS.green;
    updateSheet((current) => ({
      ...current,
      conditional: [
        ...(current.conditional || []),
        { id: newId("rule"), range, kind: values.kind as ConditionKind, value: values.value, value2: values.value2, ...colors },
      ],
    }));
    toast("Regla de formato condicional añadida");
  };

  const handleClearConditional = () => {
    if (!sheet?.conditional?.length) {
      toast("Esta hoja no tiene reglas de formato condicional", "info");
      return;
    }
    updateSheet((current) => ({ ...current, conditional: [] }));
    toast("Reglas de formato condicional eliminadas");
  };

  const handleFormatAsTable = () => {
    if (!sheet || guardProtected()) return;
    const range = effectiveRange(sheet, selection);
    if (range.r1 === range.r2) {
      toast("Selecciona el rango de datos que quieres convertir en tabla", "info");
      return;
    }
    updateSheet((current) => {
      const styled = mapRange(current, range, (cell, _col, row) => {
        const borders = { top: true, bottom: true, left: true, right: true };
        if (row === range.r1) return { ...cell, bold: true, bg: "#107c41", color: "#ffffff", borders };
        return { ...cell, bg: (row - range.r1) % 2 === 0 ? "#eaf5ee" : "#ffffff", borders };
      });
      return { ...styled, filter: { range, excluded: {} } };
    });
  };

  // -------------------------------------------------------------------------
  // Estructura: filas, columnas y hojas
  // -------------------------------------------------------------------------

  const handleInsert = (axis: "row" | "col", after: boolean) => {
    if (!sheet || guardProtected()) return;
    const index = axis === "row" ? (after ? selection.r2 + 1 : selection.r1) : after ? selection.c2 + 1 : selection.c1;
    updateSheet((current) => shiftStructure(current, axis, index, 1));
  };

  const handleDelete = (axis: "row" | "col") => {
    if (!sheet || guardProtected()) return;
    const [from, to] = axis === "row" ? [selection.r1, selection.r2] : [selection.c1, selection.c2];
    const count = Math.min(to - from + 1, 500);
    updateSheet((current) => {
      let next = current;
      for (let i = 0; i < count; i++) next = shiftStructure(next, axis, from, -1);
      return next;
    });
    selectCell(axis === "col" ? from : activeCell.col, axis === "row" ? from : activeCell.row);
  };

  const handleResizeColumn = (col: number, width: number) =>
    updateSheet(
      (current) => ({ ...current, colWidths: { ...(current.colWidths || {}), [colIndexToName(col)]: width } }),
      `col-width-${col}`
    );

  const handleAutoFitColumn = (col: number) =>
    updateSheet((current) => {
      let width = 48;
      for (const [key, cell] of Object.entries(current.data)) {
        const parsed = parseCellKey(key);
        if (parsed?.col === col && !mergeAt(current, col, parsed.row)) width = Math.max(width, estimateTextWidth(cell));
      }
      return { ...current, colWidths: { ...(current.colWidths || {}), [colIndexToName(col)]: Math.min(480, width) } };
    });

  const handleResizeRow = (row: number, height: number) =>
    updateSheet((current) => ({ ...current, rowHeights: { ...(current.rowHeights || {}), [row]: height } }), `row-height-${row}`);

  const setFrozen = (rows: number, cols: number) => {
    updateSheet((current) => ({ ...current, frozenRows: rows, frozenCols: cols }));
  };

  const selectSheet = (id: string) => {
    if (editing) commitEdit("none");
    setWorkbook((prev) => (prev ? { ...prev, activeSheetId: id } : prev));
    setActiveCell({ col: 0, row: 0 });
    setSelection({ r1: 0, c1: 0, r2: 0, c2: 0 });
    markDirty();
  };

  const uniqueSheetName = (base: string, existing: Sheet[]) => {
    const names = new Set(existing.map((s) => s.name.toLocaleLowerCase()));
    if (!names.has(base.toLocaleLowerCase())) return base;
    for (let i = 2; ; i++) {
      const candidate = `${base} (${i})`;
      if (!names.has(candidate.toLocaleLowerCase())) return candidate;
    }
  };

  const handleAddSheet = () => {
    const current = workbookRef.current;
    if (!current) return;
    let number = current.sheets.length + 1;
    while (current.sheets.some((s) => s.name === `Hoja${number}`)) number++;
    const fresh = createSheet(`Hoja${number}`);
    applySheets([...current.sheets, fresh]);
    setWorkbook((prev) => (prev ? { ...prev, activeSheetId: fresh.id } : prev));
    selectCell(0, 0);
  };

  const handleRenameSheet = (id: string, name: string) => {
    const current = workbookRef.current;
    const target = current?.sheets.find((s) => s.id === id);
    if (!current || !target) return;
    const clean = name.replace(/[!'[\]:*?/\\]/g, "").trim().slice(0, 31);
    if (!clean || clean === target.name) return;
    if (current.sheets.some((s) => s.id !== id && s.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      toast("Ya existe una hoja con ese nombre", "error");
      return;
    }
    // Actualizar las fórmulas de otras hojas que la mencionan
    const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z0-9_'])'?${escaped}'?!`, "gi");
    const reference = /^[A-Za-z0-9_]+$/.test(clean) ? clean : `'${clean}'`;
    applySheets(
      current.sheets.map((s) => {
        const data: Record<string, CellData> = {};
        for (const [key, cell] of Object.entries(s.data)) {
          data[key] = cell.raw?.startsWith("=") ? { ...cell, raw: cell.raw.replace(pattern, `$1${reference}!`) } : cell;
        }
        return s.id === id ? { ...s, name: clean, data } : { ...s, data };
      })
    );
  };

  const handleDuplicateSheet = (id: string) => {
    const current = workbookRef.current;
    const index = current?.sheets.findIndex((s) => s.id === id) ?? -1;
    if (!current || index < 0) return;
    const source = current.sheets[index];
    const copy: Sheet = {
      ...source,
      id: newId("sheet"),
      name: uniqueSheetName(`${source.name} (copia)`, current.sheets),
      charts: (source.charts || []).map((chart) => ({ ...chart, id: newId("chart") })),
    };
    const next = [...current.sheets];
    next.splice(index + 1, 0, copy);
    applySheets(next);
    setWorkbook((prev) => (prev ? { ...prev, activeSheetId: copy.id } : prev));
  };

  const handleDeleteSheet = async (id: string) => {
    const current = workbookRef.current;
    const target = current?.sheets.find((s) => s.id === id);
    if (!current || !target || current.sheets.length <= 1) return;
    const ok = await askConfirm({
      title: "Eliminar hoja",
      message: `Se eliminará «${target.name}» con todo su contenido.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    const latest = workbookRef.current;
    if (!latest) return;
    const remaining = latest.sheets.filter((s) => s.id !== id);
    if (latest.activeSheetId === id) {
      const next = { ...latest, activeSheetId: remaining[0].id };
      workbookRef.current = next;
      setWorkbook(next);
      selectCell(0, 0);
    }
    applySheets(remaining);
  };

  const handleMoveSheet = (id: string, direction: -1 | 1) => {
    const current = workbookRef.current;
    const index = current?.sheets.findIndex((s) => s.id === id) ?? -1;
    if (!current || index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= current.sheets.length) return;
    const next = [...current.sheets];
    [next[index], next[target]] = [next[target], next[index]];
    applySheets(next);
  };

  // -------------------------------------------------------------------------
  // Portapapeles y relleno
  // -------------------------------------------------------------------------

  const copySelection = (cut: boolean): ClipboardData | null => {
    if (!sheet) return null;
    if (cut && guardProtected()) return null;
    // En selecciones de fila o columna completa basta con el área usada
    const used = usedBounds(sheet);
    const bounds: Bounds = {
      ...selection,
      r2: Math.min(selection.r2, Math.max(selection.r1, used?.r2 ?? selection.r1)),
      c2: Math.min(selection.c2, Math.max(selection.c1, used?.c2 ?? selection.c1)),
    };
    const clip = copyRange(sheet, bounds, cut);
    setClipboard(clip);
    return clip;
  };

  const pasteInto = (text: string | null, mode: PasteMode = "all") => {
    if (!sheet || guardProtected()) return;
    const normalized = (text || "").replace(/\r\n?/g, "\n").replace(/\n$/, "");
    const useInternal = clipboard && (text === null || normalized === clipboard.text);
    if (useInternal && clipboard) {
      const sourceSheet = workbookRef.current?.sheets.find((s) => s.id === clipboard.sheetId);
      let pastedBounds: Bounds | null = null;
      const current = workbookRef.current;
      if (!current) return;
      const nextSheets = current.sheets.map((s) => {
        if (s.id === sheet.id) {
          const result = pasteClipboard(s, clipboard, selection, mode);
          pastedBounds = result.bounds;
          return result.sheet;
        }
        // Al mover entre hojas, el origen se vacía en su hoja
        if (clipboard.cut && mode === "all" && sourceSheet && s.id === sourceSheet.id) {
          return clearRangeCompletely(s, {
            r1: clipboard.origin.row,
            c1: clipboard.origin.col,
            r2: clipboard.origin.row + clipboard.cells.length - 1,
            c2: clipboard.origin.col + (clipboard.cells[0]?.length || 1) - 1,
          });
        }
        return s;
      });
      applySheets(nextSheets);
      if (pastedBounds) setSelection(pastedBounds);
      if (clipboard.cut) setClipboard(null);
      return;
    }
    if (!normalized) return;
    let pasted: Bounds | null = null;
    updateSheet((current) => {
      const result = pasteText(current, normalized, activeCell.col, activeCell.row);
      pasted = result.bounds;
      return result.sheet;
    });
    if (pasted) setSelection(pasted);
  };

  const clearRangeCompletely = (target: Sheet, bounds: Bounds): Sheet => mapRange(target, bounds, () => null);

  const handleMenuCopy = (cut: boolean) => {
    const clip = copySelection(cut);
    if (clip) navigator.clipboard?.writeText(clip.text).catch(() => undefined);
  };

  const handleMenuPaste = async (mode: PasteMode = "all") => {
    if (mode !== "all") {
      if (!clipboard) {
        toast("Copia primero unas celdas", "info");
        return;
      }
      pasteInto(null, mode);
      return;
    }
    let text: string | null = null;
    try {
      text = (await navigator.clipboard?.readText()) ?? null;
    } catch {
      text = null;
    }
    if (text === null && !clipboard) {
      toast("Usa Ctrl+V para pegar desde otras aplicaciones", "info");
      return;
    }
    pasteInto(text);
  };

  // Eventos nativos de copiar, cortar y pegar sobre la cuadrícula
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent, cut: boolean) => {
      if (isTypingTarget(e.target) || !workbookRef.current || showStartScreen) return;
      const clip = copySelection(cut);
      if (!clip) return;
      e.clipboardData?.setData("text/plain", clip.text);
      e.preventDefault();
    };
    const onCopy = (e: ClipboardEvent) => handleCopy(e, false);
    const onCut = (e: ClipboardEvent) => handleCopy(e, true);
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || !workbookRef.current || showStartScreen) return;
      e.preventDefault();
      pasteInto(e.clipboardData?.getData("text/plain") ?? null);
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  });

  const handleFill = (source: Bounds, target: Bounds) => {
    if (guardProtected()) return;
    updateSheet((current) => fillRange(current, source, target));
    setSelection(target);
  };

  const fillFromFirst = (direction: "down" | "right") => {
    if (!sheet || guardProtected()) return;
    if (direction === "down" && selection.r2 > selection.r1) {
      handleFill({ ...selection, r2: selection.r1 }, selection);
    } else if (direction === "right" && selection.c2 > selection.c1) {
      handleFill({ ...selection, c2: selection.c1 }, selection);
    }
  };

  // -------------------------------------------------------------------------
  // Datos: ordenar, filtrar, gráficos, funciones
  // -------------------------------------------------------------------------

  const handleSort = (ascending: boolean, column = activeCell.col) => {
    if (!sheet || guardProtected()) return;
    const range = sheet.filter?.range || effectiveRange(sheet, selection);
    if (range.r1 === range.r2) {
      toast("No hay datos que ordenar alrededor de la celda activa", "info");
      return;
    }
    const sortColumn = Math.max(range.c1, Math.min(range.c2, column));
    const hasHeader = sheet.filter ? true : looksLikeHeader(sheet, range);
    updateSheet((current) => sortRange(current, range, sortColumn, ascending, hasHeader));
    toast(`Rango ${boundsLabel(range)} ordenado por la columna ${colIndexToName(sortColumn)}`);
  };

  const handleToggleFilter = () => {
    if (!sheet) return;
    if (sheet.filter) {
      updateSheet((current) => ({ ...current, filter: null }));
      return;
    }
    const range = effectiveRange(sheet, selection);
    if (range.r1 === range.r2) {
      toast("Selecciona una tabla con encabezados para crear el filtro", "info");
      return;
    }
    updateSheet((current) => ({ ...current, filter: { range, excluded: {} } }));
  };

  const handleRemoveDuplicates = () => {
    if (!sheet || guardProtected()) return;
    const range = effectiveRange(sheet, selection);
    let removed = 0;
    updateSheet((current) => {
      const result = removeDuplicates(current, range, looksLikeHeader(current, range));
      removed = result.removed;
      return result.sheet;
    });
    toast(removed === 0 ? "No se encontraron filas duplicadas" : `${removed} filas duplicadas eliminadas`, removed ? "success" : "info");
  };

  const handleTextToColumns = async () => {
    if (!sheet || guardProtected()) return;
    const values = await askForm({
      title: "Texto en columnas",
      message: `Divide el texto de la columna ${colIndexToName(selection.c1)} en columnas contiguas.`,
      confirmLabel: "Dividir",
      fields: [
        {
          name: "delimiter",
          label: "Separador",
          type: "select",
          defaultValue: ",",
          options: [
            { value: ",", label: "Coma (,)" },
            { value: ";", label: "Punto y coma (;)" },
            { value: " ", label: "Espacio" },
            { value: "\t", label: "Tabulador" },
            { value: "|", label: "Barra vertical (|)" },
            { value: "-", label: "Guion (-)" },
          ],
        },
      ],
    });
    if (!values) return;
    const range = selection.r1 === selection.r2 ? { ...effectiveRange(sheet, selection), c1: selection.c1, c2: selection.c1 } : selection;
    let columns = 1;
    updateSheet((current) => {
      const result = textToColumns(current, range, values.delimiter);
      columns = result.columns;
      return result.sheet;
    });
    toast(columns > 1 ? `Texto dividido en ${columns} columnas` : "No se encontró el separador en las celdas", columns > 1 ? "success" : "info");
  };

  const handleInsertChart = (type: ChartType = "bar") => {
    if (!sheet || guardProtected()) return;
    const range = effectiveRange(sheet, selection);
    let x = HEADER_WIDTH + 24;
    for (let c = 0; c <= range.c2; c++) x += sheet.colWidths?.[colIndexToName(c)] || DEFAULT_COL_WIDTH;
    const count = sheet.charts?.length || 0;
    updateSheet((current) => ({
      ...current,
      charts: [
        ...(current.charts || []),
        {
          id: newId("chart"),
          type,
          title: `Gráfico ${count + 1}`,
          range,
          x: x + count * 24,
          y: HEADER_HEIGHT + range.r1 * DEFAULT_ROW_HEIGHT + 12 + count * 24,
          width: 480,
          height: 300,
        },
      ],
    }));
  };

  const handleInsertFunction = (name: string) => {
    if (!sheet || guardProtected()) return;
    if (editing) {
      setEditing({ ...editing, value: `${editing.value}${editing.value.startsWith("=") ? "" : "="}${name}(` });
      return;
    }
    const aggregate = ["SUMA", "PROMEDIO", "CONTAR", "MAX", "MIN"].includes(name);
    // Con un rango seleccionado, el resultado se escribe justo debajo
    if (aggregate && (selection.r1 !== selection.r2 || selection.c1 !== selection.c2)) {
      const below = selection.r2 + 1;
      updateSheet((current) => {
        const data = { ...current.data };
        for (let c = selection.c1; c <= selection.c2; c++) {
          const formula = `=${name}(${cellKey(c, selection.r1)}:${cellKey(c, selection.r2)})`;
          const reference = data[cellKey(c, selection.r2)];
          data[cellKey(c, below)] = { ...styleOf(reference), ...writeCell(data[cellKey(c, below)], formula), bold: true };
        }
        return { ...current, data };
      });
      selectCell(selection.c1, below);
      return;
    }
    // Con una sola celda, se propone el bloque de números de encima o de la izquierda
    let suggestion = `=${name}(`;
    if (aggregate) {
      const numeric = (c: number, r: number) => typeof sheet.data[cellKey(c, r)]?.computed === "number";
      let top = activeCell.row;
      while (top > 0 && numeric(activeCell.col, top - 1)) top--;
      let left = activeCell.col;
      while (left > 0 && numeric(left - 1, activeCell.row)) left--;
      if (top < activeCell.row) {
        suggestion = `=${name}(${cellKey(activeCell.col, top)}:${cellKey(activeCell.col, activeCell.row - 1)})`;
      } else if (left < activeCell.col) {
        suggestion = `=${name}(${cellKey(left, activeCell.row)}:${cellKey(activeCell.col - 1, activeCell.row)})`;
      }
    }
    setEditing({ value: suggestion, inCell: true });
  };

  const handleInsertLink = async () => {
    if (!sheet || guardProtected()) return;
    const values = await askForm({
      title: activeData?.link ? "Editar enlace" : "Insertar enlace",
      confirmLabel: "Guardar",
      fields: [
        { name: "text", label: "Texto de la celda", defaultValue: activeData?.raw || "" },
        { name: "url", label: "Dirección (URL); déjala vacía para quitar el enlace", defaultValue: activeData?.link || "", placeholder: "https://ejemplo.com" },
      ],
    });
    if (!values) return;
    let url = values.url.trim();
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
    updateSheet((current) => {
      const data = { ...current.data };
      const next = writeCell(data[activeKey], values.text || url);
      if (url) next.link = url;
      else delete next.link;
      data[activeKey] = next;
      return { ...current, data };
    });
  };

  const handleInsertNote = async () => {
    if (!sheet || guardProtected()) return;
    const values = await askForm({
      title: activeData?.note ? "Editar comentario" : "Añadir comentario",
      message: `Celda ${activeKey}. Deja el texto vacío para quitar el comentario.`,
      confirmLabel: "Guardar",
      fields: [{ name: "note", label: "Comentario", type: "textarea", defaultValue: activeData?.note || "" }],
    });
    if (!values) return;
    updateSheet((current) => {
      const data = { ...current.data };
      const next: CellData = { ...(data[activeKey] || { raw: "" }) };
      if (values.note.trim()) next.note = values.note.trim();
      else delete next.note;
      if (next.raw === "" && Object.keys(next).length === 1) delete data[activeKey];
      else data[activeKey] = next;
      return { ...current, data };
    });
  };

  const handleNavigate = (reference: string) => {
    const [first, second] = reference.split(":");
    const start = parseCellKey(first || "");
    const end = second ? parseCellKey(second) : start;
    if (!start || !end) {
      toast("Escribe una celda (B5) o un rango (A1:C10)", "info");
      return;
    }
    if (editing) commitEdit("none");
    setActiveCell({ col: start.col, row: start.row });
    setSelection(normalize({ startCol: start.col, startRow: start.row, endCol: end.col, endRow: end.row }));
  };

  // Buscar y reemplazar
  const matchingCells = (query: string, matchCase: boolean): CellPosition[] => {
    if (!sheet) return [];
    const needle = matchCase ? query : query.toLocaleLowerCase();
    const found: CellPosition[] = [];
    for (const [key, cell] of Object.entries(sheet.data)) {
      const parsed = parseCellKey(key);
      if (!parsed) continue;
      const haystack = `${displayText(cell)}\n${cell.raw}`;
      if ((matchCase ? haystack : haystack.toLocaleLowerCase()).includes(needle)) {
        found.push({ col: parsed.col, row: parsed.row });
      }
    }
    return found.sort((a, b) => a.row - b.row || a.col - b.col);
  };

  const handleFindNext = (query: string, matchCase: boolean) => {
    const found = matchingCells(query, matchCase);
    if (found.length > 0) {
      const next =
        found.find((cell) => cell.row > activeCell.row || (cell.row === activeCell.row && cell.col > activeCell.col)) || found[0];
      selectCell(next.col, next.row);
    }
    return found.length;
  };

  const handleReplaceAll = (query: string, replacement: string, matchCase: boolean) => {
    if (guardProtected()) return 0;
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "g" : "gi");
    let changed = 0;
    updateSheet((current) => {
      const data = { ...current.data };
      for (const [key, cell] of Object.entries(data)) {
        if (!cell.raw) continue;
        const next = cell.raw.replace(pattern, () => replacement);
        if (next !== cell.raw) {
          data[key] = writeCell(cell, next);
          changed++;
        }
      }
      return { ...current, data };
    });
    return changed;
  };

  // -------------------------------------------------------------------------
  // Atajos de teclado
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!workbookRef.current || showStartScreen) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const typing = isTypingTarget(e.target);

      if (e.altKey && e.key === "/") {
        e.preventDefault();
        setCommandSearchOpen(true);
        return;
      }
      if (e.key === "Escape" && !typing) {
        setClipboard(null);
        setPainter(null);
        return;
      }
      if (!mod) return;

      if (key === "s") {
        e.preventDefault();
        if (editing) commitEdit("none");
        if (e.shiftKey) void handleSaveAs();
        else void handleSave();
        return;
      }
      if (typing) return;

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
        case "b":
          e.preventDefault();
          handleToggle("bold");
          break;
        case "i":
          e.preventDefault();
          handleToggle("italic");
          break;
        case "u":
          e.preventDefault();
          handleToggle("underline");
          break;
        case "a":
          e.preventDefault();
          if (sheet) {
            const used = usedBounds(sheet);
            setSelection({ r1: 0, c1: 0, r2: Math.max(99, used?.r2 ?? 0), c2: Math.max(25, used?.c2 ?? 0) });
          }
          break;
        case "d":
          e.preventDefault();
          fillFromFirst("down");
          break;
        case "r":
          e.preventDefault();
          fillFromFirst("right");
          break;
        case "o":
          e.preventDefault();
          void handleOpenWorkbook();
          break;
        case "n":
          e.preventDefault();
          void handleNewWorkbook();
          break;
        case "p":
          e.preventDefault();
          handlePrint();
          break;
        case "f":
        case "h":
          e.preventDefault();
          setFindOpen(true);
          break;
        case "k":
          e.preventDefault();
          void handleInsertLink();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // -------------------------------------------------------------------------
  // Estadísticas de la selección
  // -------------------------------------------------------------------------

  const stats: SelectionStats = useMemo(() => {
    const result = { count: 0, numericCount: 0, sum: 0, average: 0, min: 0, max: 0 };
    if (!sheet) return result;
    const numbers: number[] = [];
    const cells = (selection.r2 - selection.r1 + 1) * (selection.c2 - selection.c1 + 1);
    const visit = (cell: CellData | undefined) => {
      if (!cell || cell.computed === null || cell.computed === undefined || cell.computed === "") return;
      result.count++;
      if (typeof cell.computed === "number") numbers.push(cell.computed);
    };
    if (cells > 5000) {
      // Selecciones enormes (filas o columnas completas): se recorren solo las celdas con datos
      for (const [key, cell] of Object.entries(sheet.data)) {
        const parsed = parseCellKey(key);
        if (parsed && parsed.row >= selection.r1 && parsed.row <= selection.r2 && parsed.col >= selection.c1 && parsed.col <= selection.c2) {
          visit(cell);
        }
      }
    } else {
      for (let r = selection.r1; r <= selection.r2; r++) {
        for (let c = selection.c1; c <= selection.c2; c++) visit(sheet.data[cellKey(c, r)]);
      }
    }
    if (numbers.length > 0) {
      result.numericCount = numbers.length;
      result.sum = numbers.reduce((a, b) => a + b, 0);
      result.average = result.sum / numbers.length;
      result.min = Math.min(...numbers);
      result.max = Math.max(...numbers);
    }
    return result;
  }, [sheet, selection]);

  // -------------------------------------------------------------------------
  // Menús
  // -------------------------------------------------------------------------

  const menus: MenuDefinition[] = [
    {
      id: "archivo",
      label: "Archivo",
      items: [
        { label: "Nuevo libro", icon: FilePlus, action: () => void handleNewWorkbook(), shortcut: "Ctrl+N" },
        { label: "Abrir…", icon: FolderOpen, action: () => void handleOpenWorkbook(), shortcut: "Ctrl+O" },
        { label: "Pantalla de inicio", icon: FileText, action: () => setShowStartScreen(true) },
        { divider: true },
        { label: "Guardar", icon: Save, action: () => void handleSave(), shortcut: "Ctrl+S" },
        { label: "Guardar como…", icon: SaveAll, action: () => void handleSaveAs(), shortcut: "Ctrl+Mayús+S" },
        { label: "Descargar / Exportar…", icon: Download, action: () => setExportModalOpen(true) },
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
        { label: "Cortar", icon: Scissors, action: () => handleMenuCopy(true), shortcut: "Ctrl+X" },
        { label: "Copiar", icon: Copy, action: () => handleMenuCopy(false), shortcut: "Ctrl+C" },
        { label: "Pegar", icon: ClipboardPaste, action: () => void handleMenuPaste(), shortcut: "Ctrl+V" },
        { label: "Pegar solo los valores", action: () => void handleMenuPaste("values") },
        { label: "Pegar solo el formato", action: () => void handleMenuPaste("format") },
        { divider: true },
        { label: "Rellenar hacia abajo", action: () => fillFromFirst("down"), shortcut: "Ctrl+D" },
        { label: "Rellenar hacia la derecha", action: () => fillFromFirst("right"), shortcut: "Ctrl+R" },
        { label: "Borrar el contenido", action: handleClear, shortcut: "Supr" },
        { divider: true },
        { label: "Buscar y reemplazar", icon: Search, action: () => setFindOpen(true), shortcut: "Ctrl+F" },
        {
          label: "Seleccionar todo",
          icon: CheckSquare,
          action: () => {
            const used = sheet ? usedBounds(sheet) : null;
            setSelection({ r1: 0, c1: 0, r2: Math.max(99, used?.r2 ?? 0), c2: Math.max(25, used?.c2 ?? 0) });
          },
          shortcut: "Ctrl+A",
        },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        { label: "Líneas de cuadrícula", action: () => setShowGridlines((v) => !v), checked: showGridlines },
        { label: "Barra de fórmulas", action: () => setShowFormulaBar((v) => !v), checked: showFormulaBar },
        { label: "Mostrar las fórmulas en las celdas", action: () => setShowFormulas((v) => !v), checked: showFormulas },
        { divider: true },
        { label: "Inmovilizar la fila superior", action: () => setFrozen(1, sheet?.frozenCols || 0), checked: sheet?.frozenRows === 1 },
        { label: "Inmovilizar la primera columna", action: () => setFrozen(sheet?.frozenRows || 0, 1), checked: sheet?.frozenCols === 1 },
        {
          label: `Inmovilizar hasta la celda ${activeKey}`,
          action: () => setFrozen(activeCell.row, activeCell.col),
          disabled: activeCell.row === 0 && activeCell.col === 0,
        },
        {
          label: "Movilizar paneles",
          action: () => setFrozen(0, 0),
          disabled: !sheet?.frozenRows && !sheet?.frozenCols,
        },
        { divider: true },
        { label: "Acercar", action: () => setZoom((z) => Math.min(200, z + 10)) },
        { label: "Alejar", action: () => setZoom((z) => Math.max(50, z - 10)) },
        { label: "Tamaño real (100%)", action: () => setZoom(100) },
      ],
    },
    {
      id: "insertar",
      label: "Insertar",
      items: [
        { label: "Fila encima", action: () => handleInsert("row", false) },
        { label: "Fila debajo", action: () => handleInsert("row", true) },
        { label: "Columna a la izquierda", action: () => handleInsert("col", false) },
        { label: "Columna a la derecha", action: () => handleInsert("col", true) },
        { divider: true },
        { label: "Eliminar las filas seleccionadas", action: () => handleDelete("row") },
        { label: "Eliminar las columnas seleccionadas", action: () => handleDelete("col") },
        { divider: true },
        { label: "Gráfico de columnas", icon: BarChart3, action: () => handleInsertChart("bar") },
        { label: "Gráfico de líneas", action: () => handleInsertChart("line") },
        { label: "Gráfico de áreas", action: () => handleInsertChart("area") },
        { label: "Gráfico circular", action: () => handleInsertChart("pie") },
        { divider: true },
        { label: "Enlace…", icon: LinkIcon, action: () => void handleInsertLink(), shortcut: "Ctrl+K" },
        { label: "Comentario…", icon: MessageSquarePlus, action: () => void handleInsertNote() },
        { label: "Hoja nueva", action: handleAddSheet },
        { divider: true },
        { label: "Función SUMA", action: () => handleInsertFunction("SUMA") },
        { label: "Función PROMEDIO", action: () => handleInsertFunction("PROMEDIO") },
        { label: "Función CONTAR", action: () => handleInsertFunction("CONTAR") },
        { label: "Función MAX", action: () => handleInsertFunction("MAX") },
        { label: "Función MIN", action: () => handleInsertFunction("MIN") },
        { label: "Función SI", action: () => handleInsertFunction("SI") },
        { label: "Función BUSCARV", action: () => handleInsertFunction("BUSCARV") },
      ],
    },
    {
      id: "formato",
      label: "Formato",
      items: [
        { label: "Negrita", action: () => handleToggle("bold"), shortcut: "Ctrl+B", checked: Boolean(activeData?.bold) },
        { label: "Cursiva", action: () => handleToggle("italic"), shortcut: "Ctrl+I", checked: Boolean(activeData?.italic) },
        { label: "Subrayado", action: () => handleToggle("underline"), shortcut: "Ctrl+U", checked: Boolean(activeData?.underline) },
        { label: "Tachado", action: () => handleToggle("strike"), checked: Boolean(activeData?.strike) },
        { divider: true },
        { label: "Número", action: () => handleStyle({ format: "number" }) },
        { label: "Moneda", action: () => handleStyle({ format: "currency" }) },
        { label: "Porcentaje", action: () => handleStyle({ format: "percent" }) },
        { label: "Fecha", action: () => handleStyle({ format: "date" }) },
        { label: "Texto sin formato", action: () => handleStyle({ format: "text" }) },
        { label: "Automático", action: () => handleStyle({ format: "general" }) },
        { divider: true },
        { label: activeMerge ? "Separar celdas" : "Combinar celdas", action: handleMerge },
        { label: "Ajustar texto", action: () => handleToggle("wrapText"), checked: Boolean(activeData?.wrapText) },
        { divider: true },
        { label: "Formato condicional…", action: () => void handleConditionalFormatting() },
        { label: "Borrar reglas de formato condicional", action: handleClearConditional },
        { label: "Dar formato como tabla", icon: Table2, action: handleFormatAsTable },
        {
          label: "Borrar formato",
          action: () => {
            if (guardProtected()) return;
            updateSheet((current) => applyStyle(current, selection, {}));
          },
        },
      ],
    },
    {
      id: "datos",
      label: "Datos",
      items: [
        { label: "Ordenar de A a Z", action: () => handleSort(true) },
        { label: "Ordenar de Z a A", action: () => handleSort(false) },
        { divider: true },
        { label: sheet?.filter ? "Quitar el filtro" : "Crear un filtro", icon: Filter, action: handleToggleFilter },
        { label: "Texto en columnas…", action: () => void handleTextToColumns() },
        { label: "Quitar duplicados", action: handleRemoveDuplicates },
        { divider: true },
        {
          label: "Proteger hoja (solo lectura)",
          icon: Shield,
          action: () => {
            setEditing(null);
            updateSheet((current) => ({ ...current, isProtected: !current.isProtected }));
          },
          checked: readOnly,
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
                "Intro o F2 · editar la celda",
                "Tab / Intro · confirmar y avanzar",
                "Flechas · moverse  |  Mayús+flechas · ampliar la selección",
                "Ctrl+flechas · saltar al borde de los datos",
                "Ctrl+C / X / V · copiar, cortar y pegar",
                "Ctrl+D / Ctrl+R · rellenar hacia abajo / derecha",
                "Ctrl+B / I / U · negrita, cursiva y subrayado",
                "Ctrl+Z / Y · deshacer y rehacer",
                "Ctrl+F · buscar y reemplazar  |  Ctrl+K · enlace",
                "Ctrl+S · guardar  |  Ctrl+P · imprimir",
                "Supr · borrar el contenido  |  Alt+/ · buscar en los menús",
              ].join("\n")
            ),
        },
        {
          label: "Abrir el libro de ejemplo",
          action: async () => {
            await flushPendingSave();
            loadWorkbook({ workbook: createSampleWorkbook(), filePath: null });
          },
        },
        {
          label: "Acerca de CoffeCalc",
          icon: Info,
          action: () =>
            void showMessage(
              "CoffeCalc 1.0",
              "Hoja de cálculo de la suite CoffeWorks.\n\nLos libros se guardan como archivos .cfs en la carpeta Documentos\\CoffeWorks y se pueden exportar a Excel, CSV y PDF."
            ),
        },
      ],
    },
  ];

  const contextItems: ContextMenuItem[] = [
    { label: "Cortar", action: () => handleMenuCopy(true), shortcut: "Ctrl+X" },
    { label: "Copiar", action: () => handleMenuCopy(false), shortcut: "Ctrl+C" },
    { label: "Pegar", action: () => void handleMenuPaste(), shortcut: "Ctrl+V" },
    { label: "Pegar solo los valores", action: () => void handleMenuPaste("values"), disabled: !clipboard },
    { label: "Pegar solo el formato", action: () => void handleMenuPaste("format"), disabled: !clipboard },
    { divider: true, label: "" },
    { label: "Insertar fila encima", action: () => handleInsert("row", false) },
    { label: "Insertar fila debajo", action: () => handleInsert("row", true) },
    { label: "Insertar columna a la izquierda", action: () => handleInsert("col", false) },
    { label: "Insertar columna a la derecha", action: () => handleInsert("col", true) },
    { label: "Eliminar filas", action: () => handleDelete("row"), danger: true },
    { label: "Eliminar columnas", action: () => handleDelete("col"), danger: true },
    { divider: true, label: "" },
    { label: "Borrar el contenido", action: handleClear, shortcut: "Supr" },
    { label: "Ordenar de A a Z", action: () => handleSort(true) },
    { label: "Ordenar de Z a A", action: () => handleSort(false) },
    { divider: true, label: "" },
    { label: activeData?.note ? "Editar comentario…" : "Añadir comentario…", action: () => void handleInsertNote() },
    { label: activeData?.link ? "Editar enlace…" : "Insertar enlace…", action: () => void handleInsertLink() },
    { label: "Insertar gráfico", action: () => handleInsertChart("bar") },
  ];

  const formulaValue = editing ? editing.value : activeData?.raw ?? "";

  return (
    <div className="calc-app flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {workbook && sheet && (
        <>
          <SuiteHeader
            logo={SheetsLogo}
            logoTitle="Pantalla de inicio de CoffeCalc"
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
                title="Exportar libro"
              >
                <ArrowUpRight size={15} />
                <span>Exportar</span>
              </button>
            }
          />

          <GoogleSheetsToolbar
            active={activeData}
            readOnly={readOnly}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onPrint={handlePrint}
            painterActive={painter !== null}
            onTogglePainter={handleTogglePainter}
            zoom={zoom}
            onZoomChange={setZoom}
            onStyle={handleStyle}
            onToggle={handleToggle}
            onDecimals={handleDecimals}
            onBorders={handleBorders}
            onMerge={handleMerge}
            isMerged={Boolean(activeMerge)}
            onInsertLink={() => void handleInsertLink()}
            onInsertNote={() => void handleInsertNote()}
            onInsertChart={() => handleInsertChart("bar")}
            onToggleFilter={handleToggleFilter}
            isFilterActive={Boolean(sheet.filter)}
            onInsertFunction={handleInsertFunction}
            onOpenCommandSearch={() => setCommandSearchOpen(true)}
            showFormulaBar={showFormulaBar}
            onToggleFormulaBar={() => setShowFormulaBar((v) => !v)}
          />

          {showFormulaBar && (
            <FormulaBar
              selectionLabel={boundsLabel(activeMerge && selection.r1 === activeMerge.r1 && selection.c1 === activeMerge.c1 && selection.r2 === activeMerge.r2 && selection.c2 === activeMerge.c2 ? single(activeCell) : selection)}
              onNavigate={handleNavigate}
              value={formulaValue}
              isEditing={editing !== null}
              readOnly={readOnly}
              onFocusEdit={() => {
                if (!editing && !readOnly) setEditing({ value: activeData?.raw ?? "", inCell: false });
              }}
              onChange={(value) => setEditing({ value, inCell: false })}
              onCommit={() => commitEdit("down")}
              onCancel={cancelEdit}
              onInsertFunction={handleInsertFunction}
            />
          )}

          <SpreadsheetGrid
            sheet={sheet}
            activeCell={activeCell}
            selection={selection}
            onSelect={handleSelect}
            editingValue={editing ? editing.value : null}
            editingInCell={editing ? editing.inCell : true}
            onStartEdit={(initial) => startEdit(initial)}
            onEditChange={(value) => setEditing((prev) => ({ value, inCell: prev?.inCell ?? true }))}
            onCommitEdit={commitEdit}
            onCancelEdit={cancelEdit}
            onClear={handleClear}
            onFill={handleFill}
            onResizeColumn={handleResizeColumn}
            onAutoFitColumn={handleAutoFitColumn}
            onResizeRow={handleResizeRow}
            onContextMenu={(x, y) => setContextMenu({ x, y })}
            onOpenFilter={(col, anchor) => setFilterMenu({ col, x: anchor.left, y: anchor.bottom + 4 })}
            onOpenLink={(url) => void openExternal(url)}
            onUpdateChart={(id, changes) =>
              updateSheet(
                (current) => ({
                  ...current,
                  charts: (current.charts || []).map((chart) =>
                    chart.id === id ? { ...chart, ...changes, type: (changes.type as ChartType) || chart.type } : chart
                  ),
                }),
                `chart-${id}`
              )
            }
            onRemoveChart={(id) =>
              updateSheet((current) => ({ ...current, charts: (current.charts || []).filter((chart) => chart.id !== id) }))
            }
            clipboardBounds={
              clipboard && clipboard.sheetId === sheet.id
                ? {
                    r1: clipboard.origin.row,
                    c1: clipboard.origin.col,
                    r2: clipboard.origin.row + clipboard.cells.length - 1,
                    c2: clipboard.origin.col + (clipboard.cells[0]?.length || 1) - 1,
                  }
                : null
            }
            showGridlines={showGridlines}
            showFormulas={showFormulas}
            zoom={zoom}
          />

          <SheetTabsBar
            sheets={sheets}
            activeSheetId={sheet.id}
            onSelectSheet={selectSheet}
            onAddSheet={handleAddSheet}
            onRenameSheet={handleRenameSheet}
            onDuplicateSheet={handleDuplicateSheet}
            onDeleteSheet={(id) => void handleDeleteSheet(id)}
            onMoveSheet={handleMoveSheet}
            isEditing={editing !== null}
            stats={stats}
            zoom={zoom}
            onZoomChange={setZoom}
          />

          <PrintSheet sheet={sheet} title={title || DEFAULT_TITLE} showGridlines={showGridlines} />
        </>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextItems} onClose={() => setContextMenu(null)} />
      )}

      {filterMenu && sheet?.filter && (
        <FilterMenu
          x={filterMenu.x}
          y={filterMenu.y}
          columnName={colIndexToName(filterMenu.col)}
          values={filterValues(sheet, filterMenu.col)}
          excluded={sheet.filter.excluded[filterMenu.col] || []}
          onClose={() => setFilterMenu(null)}
          onSort={(ascending) => {
            setFilterMenu(null);
            handleSort(ascending, filterMenu.col);
          }}
          onApply={(excluded) =>
            updateSheet((current) =>
              current.filter
                ? { ...current, filter: { ...current.filter, excluded: { ...current.filter.excluded, [filterMenu.col]: excluded } } }
                : current
            )
          }
        />
      )}

      <FindPanel
        isOpen={findOpen && workbook !== null}
        onClose={() => setFindOpen(false)}
        readOnly={readOnly}
        onFindNext={handleFindNext}
        onReplaceAll={handleReplaceAll}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Exportar libro"
        fileTitle={title || DEFAULT_TITLE}
        options={EXPORT_OPTIONS}
        onExport={(format) => void handleExport(format)}
      />
      <CommandSearch isOpen={commandSearchOpen} onClose={() => setCommandSearchOpen(false)} menus={menus} />

      {showStartScreen && (
        <StartScreen
          appName="CoffeCalc"
          tagline="Hoja de cálculo • CoffeWorks"
          accent="#107c41"
          newHint="Crear libro en blanco"
          openHint="Excel, CSV o .cfs"
          formats={[".cfs", ".xlsx", ".xls", ".csv"]}
          recents={recents}
          onNew={() => void handleNewWorkbook()}
          onOpen={() => void handleOpenWorkbook()}
          onOpenRecent={(entry) => void handleOpenRecent(entry)}
          onContinue={workbook ? () => setShowStartScreen(false) : undefined}
          currentTitle={title || DEFAULT_TITLE}
        />
      )}

      <DialogHost />
    </div>
  );
};
