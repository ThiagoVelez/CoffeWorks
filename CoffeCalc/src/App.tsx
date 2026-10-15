import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GoogleSheetsHeader } from "./components/GoogleSheetsHeader";
import { GoogleSheetsToolbar } from "./components/GoogleSheetsToolbar";
import { FormulaBar } from "./components/FormulaBar";
import { SpreadsheetGrid } from "./components/SpreadsheetGrid";
import { SheetTabsBar } from "./components/SheetTabsBar";
import { ExportModal } from "./components/ExportModal";
import { ImportModal } from "./components/ImportModal";
import { StartScreen } from "./components/StartScreen";
import { sheetVault } from "./services/sheetVault";
import {
  computeCellValue,
  parseCellKey,
  colIndexToName,
} from "./services/formulaEngine";
import type {
  Sheet,
  WorkbookMetadata,
  CellData,
  CellFormat,
  SelectionStats,
  SelectionRange,
  ChartConfig,
} from "./types";

export const App: React.FC = () => {
  const [metadata, setMetadata] = useState<WorkbookMetadata>({
    id: "cfs_1",
    title: "Libro1",
    author: "Usuario CoffeWorks",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>("sheet_1");
  const [activeCellKey, setActiveCellKey] = useState<string>("A5");
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingValue, setEditingValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showStartScreen, setShowStartScreen] = useState<boolean>(true);

  // Vistas y zoom
  const [showGridlines, setShowGridlines] = useState<boolean>(true);
  const [showFormulaBar, setShowFormulaBar] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);

  // Estados para portapapeles y formato
  const [clipboardCells, setClipboardCells] = useState<Record<string, CellData> | null>(null);
  const [isCutOperation, setIsCutOperation] = useState<boolean>(false);
  const [clipboardAnchor, setClipboardAnchor] = useState<{ col: number; row: number } | null>(null);
  const [cellFormatPainter, setCellFormatPainter] = useState<Partial<CellData> | null>(null);
  const [isFormatPainterActive, setIsFormatPainterActive] = useState<boolean>(false);

  // Estados de herramientas avanzadas
  const [showRawFormulas, setShowRawFormulas] = useState<boolean>(false);
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [isFrozenPanes, setIsFrozenPanes] = useState<boolean>(false);
  const [isSheetProtected, setIsSheetProtected] = useState<boolean>(false);
  const [activeChart, setActiveChart] = useState<ChartConfig | null>(null);

  // Modales
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);

  // Historial para Deshacer / Rehacer
  const [history, setHistory] = useState<Sheet[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Carga inicial
  useEffect(() => {
    const loaded = sheetVault.loadWorkbook();
    setMetadata(loaded.metadata);
    setSheets(loaded.sheets);
    setActiveSheetId(loaded.activeSheetId || loaded.sheets[0]?.id || "sheet_1");
    setHistory([loaded.sheets]);
    setHistoryIndex(0);
  }, []);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) || sheets[0] || {
    id: "sheet_1",
    name: "Hoja1",
    data: {},
  };

  // Sincronizar el valor editable cuando cambia la celda activa
  useEffect(() => {
    const cell = activeSheet.data[activeCellKey];
    setEditingValue(cell ? cell.raw : "");
    setIsEditing(false);
  }, [activeCellKey, activeSheetId]);

  // Recalcular todas las celdas dependientes con fórmulas
  const recalculateSheetData = useCallback((data: Record<string, CellData>): Record<string, CellData> => {
    const next: Record<string, CellData> = { ...data };
    for (const [key, cell] of Object.entries(next)) {
      if (cell.raw && cell.raw.startsWith("=")) {
        const computed = computeCellValue(cell.raw, next);
        // Si el motor local da error de evaluación pero la celda ya traía un valor computado válido de Excel, preservarlo
        if (
          (computed === "#¡VALOR!" || computed === "#¡ERROR!" || computed === cell.raw) &&
          cell.computed !== undefined &&
          cell.computed !== null &&
          cell.computed !== "" &&
          cell.computed !== "#¡VALOR!"
        ) {
          next[key] = cell;
        } else {
          next[key] = {
            ...cell,
            computed,
          };
        }
      }
    }
    return next;
  }, []);

  // Guardar y registrar en historial
  const updateActiveSheetData = useCallback(
    (newSheetData: Record<string, CellData>) => {
      const recalculated = recalculateSheetData(newSheetData);
      setSheets((prevSheets) => {
        const nextSheets = prevSheets.map((s) =>
          s.id === activeSheetId ? { ...s, data: recalculated } : s
        );

        // Guardar persistencia
        sheetVault.saveWorkbook(metadata, nextSheets, activeSheetId);

        // Registrar en historial
        setHistory((prev) => {
          const trimmed = prev.slice(0, historyIndex + 1);
          return [...trimmed, nextSheets];
        });
        setHistoryIndex((prev) => prev + 1);

        return nextSheets;
      });
    },
    [activeSheetId, metadata, historyIndex, recalculateSheetData]
  );

  // Manejo de edición in-place
  const handleStartEditing = () => {
    const cell = activeSheet.data[activeCellKey];
    setEditingValue(cell ? cell.raw : "");
    setIsEditing(true);
  };

  const handleCommitEditing = (moveToNext?: "down" | "right" | "none") => {
    setIsEditing(false);
    const existing = activeSheet.data[activeCellKey] || { raw: "" };
    const trimmed = editingValue.trim();

    const updatedCell: CellData = {
      ...existing,
      raw: trimmed,
      computed: computeCellValue(trimmed, activeSheet.data),
      align:
        existing.align ||
        (!isNaN(Number(trimmed)) && !trimmed.startsWith("=") ? "right" : "left"),
    };

    const nextData = {
      ...activeSheet.data,
      [activeCellKey]: updatedCell,
    };

    updateActiveSheetData(nextData);

    // Mover a la siguiente celda si corresponde
    if (moveToNext === "down") {
      const parsed = parseCellKey(activeCellKey);
      if (parsed && parsed.rowNum < 100) {
        setActiveCellKey(`${parsed.colName}${parsed.rowNum + 1}`);
      }
    } else if (moveToNext === "right") {
      const parsed = parseCellKey(activeCellKey);
      if (parsed && parsed.col < 25) {
        const nextColName = colIndexToName(parsed.col + 1);
        setActiveCellKey(`${nextColName}${parsed.rowNum}`);
      }
    }
  };

  const handleCancelEditing = () => {
    const cell = activeSheet.data[activeCellKey];
    setEditingValue(cell ? cell.raw : "");
    setIsEditing(false);
  };

  // Modificadores de formato aplicados a la celda activa o a todo el rango seleccionado
  const modifySelectedCells = (updater: (prev: CellData) => CellData) => {
    const nextData = { ...activeSheet.data };

    if (selectionRange) {
      const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
      const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);
      const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
      const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);

      for (let c = minCol; c <= maxCol; c++) {
        const colName = colIndexToName(c);
        for (let r = minRow; r <= maxRow; r++) {
          const key = `${colName}${r + 1}`;
          const current = nextData[key] || { raw: "" };
          nextData[key] = updater(current);
        }
      }
    } else {
      const current = nextData[activeCellKey] || { raw: "" };
      nextData[activeCellKey] = updater(current);
    }

    updateActiveSheetData(nextData);
  };

  const handleToggleBold = () => {
    modifySelectedCells((c) => ({ ...c, bold: !c.bold }));
  };

  const handleToggleItalic = () => {
    modifySelectedCells((c) => ({ ...c, italic: !c.italic }));
  };

  const handleToggleUnderline = () => {
    modifySelectedCells((c) => ({ ...c, underline: !c.underline }));
  };

  const handleSetAlign = (align: "left" | "center" | "right") => {
    modifySelectedCells((c) => ({ ...c, align }));
  };

  const handleSetFormat = (format: CellFormat) => {
    modifySelectedCells((c) => ({ ...c, format }));
  };

  const handleSetBgColor = (bg: string) => {
    modifySelectedCells((c) => ({ ...c, bg }));
  };

  const handleSetTextColor = (color: string) => {
    modifySelectedCells((c) => ({ ...c, color }));
  };

  const handleSetFontFamily = (fontFamily: string) => {
    modifySelectedCells((c) => ({ ...c, fontFamily }));
  };

  const handleSetFontSize = (fontSize: number) => {
    modifySelectedCells((c) => ({ ...c, fontSize }));
  };

  // Portapapeles (Copiar, Cortar, Pegar, Copiar formato)
  const handleCopy = () => {
    const copied: Record<string, CellData> = {};
    const parsedAnchor = parseCellKey(activeCellKey) || { col: 0, row: 0 };
    const minCol = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : parsedAnchor.col;
    const maxCol = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : parsedAnchor.col;
    const minRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : parsedAnchor.row;
    const maxRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : parsedAnchor.row;

    for (let c = minCol; c <= maxCol; c++) {
      const colName = colIndexToName(c);
      for (let r = minRow; r <= maxRow; r++) {
        const key = `${colName}${r + 1}`;
        if (activeSheet.data[key]) {
          copied[`${c - minCol}_${r - minRow}`] = activeSheet.data[key];
        }
      }
    }
    setClipboardCells(copied);
    setIsCutOperation(false);
    setClipboardAnchor({ col: minCol, row: minRow });
  };

  const handleCut = () => {
    handleCopy();
    setIsCutOperation(true);
  };

  const handlePaste = () => {
    if (!clipboardCells) return;
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;

    const nextData = { ...activeSheet.data };
    if (isCutOperation && clipboardAnchor) {
      for (const [offsetKey] of Object.entries(clipboardCells)) {
        const [dc, dr] = offsetKey.split("_").map(Number);
        const origColName = colIndexToName(clipboardAnchor.col + dc);
        const origKey = `${origColName}${clipboardAnchor.row + dr + 1}`;
        delete nextData[origKey];
      }
      setIsCutOperation(false);
    }

    for (const [offsetKey, cell] of Object.entries(clipboardCells)) {
      const [dc, dr] = offsetKey.split("_").map(Number);
      const targetCol = parsed.col + dc;
      const targetRow = parsed.row + dr + 1;
      const targetKey = `${colIndexToName(targetCol)}${targetRow}`;
      nextData[targetKey] = { ...cell };
    }

    updateActiveSheetData(nextData);
  };

  const handleFormatPainter = () => {
    const cell = activeSheet.data[activeCellKey];
    if (cell) {
      setCellFormatPainter({
        bold: cell.bold,
        italic: cell.italic,
        underline: cell.underline,
        align: cell.align,
        color: cell.color,
        bg: cell.bg,
        format: cell.format,
        fontFamily: cell.fontFamily,
        fontSize: cell.fontSize,
        borders: cell.borders,
        wrapText: cell.wrapText,
      });
      setIsFormatPainterActive(true);
    }
  };

  // Bordes, ajuste de texto y combinación
  const handleToggleBorders = () => {
    modifySelectedCells((c) => {
      const hasBorders = !!c.borders?.top;
      return {
        ...c,
        borders: hasBorders ? undefined : { top: true, bottom: true, left: true, right: true },
      };
    });
  };

  const handleToggleWrapText = () => {
    modifySelectedCells((c) => ({
      ...c,
      wrapText: !c.wrapText,
    }));
  };

  const handleMergeAndCenter = () => {
    const parsedAnchor = parseCellKey(activeCellKey);
    if (!parsedAnchor || !selectionRange) {
      modifySelectedCells((c) => ({ ...c, align: "center" }));
      return;
    }

    const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);
    const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);

    const mergedValues: string[] = [];
    const nextData = { ...activeSheet.data };

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const colName = colIndexToName(c);
        const key = `${colName}${r + 1}`;
        const cell = nextData[key];
        if (cell && cell.raw) {
          mergedValues.push(cell.raw);
        }
        delete nextData[key];
      }
    }

    const topColName = colIndexToName(minCol);
    const topKey = `${topColName}${minRow + 1}`;
    nextData[topKey] = {
      raw: mergedValues.join(" "),
      align: "center",
      bold: true,
    };

    updateActiveSheetData(nextData);
    setActiveCellKey(topKey);
  };

  const handleAdjustDecimals = (delta: number) => {
    modifySelectedCells((c) => {
      const currentDec = c.decimals ?? 2;
      const nextDec = Math.max(0, Math.min(6, currentDec + delta));
      return {
        ...c,
        decimals: nextDec,
        format: "number",
      };
    });
  };

  const handleConditionalFormatting = () => {
    modifySelectedCells((c) => {
      const num = Number(c.computed !== undefined && c.computed !== null ? c.computed : c.raw);
      if (isNaN(num)) return c;
      if (num >= 0) {
        return {
          ...c,
          bg: "#dcfce7",
          color: "#15803d",
          bold: true,
        };
      }
      return {
        ...c,
        bg: "#fee2e2",
        color: "#b91c1c",
        bold: true,
      };
    });
  };

  const handleFormatAsTable = () => {
    const parsedAnchor = parseCellKey(activeCellKey) || { col: 0, row: 0 };
    const minCol = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : parsedAnchor.col;
    const maxCol = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : Math.min(parsedAnchor.col + 4, 15);
    const minRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : parsedAnchor.row;
    const maxRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : Math.min(parsedAnchor.row + 8, 50);

    const nextData = { ...activeSheet.data };
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const colName = colIndexToName(c);
        const key = `${colName}${r + 1}`;
        const current = nextData[key] || { raw: r === minRow ? `Columna ${c + 1}` : "" };

        if (r === minRow) {
          nextData[key] = {
            ...current,
            bg: "#107c41",
            color: "#ffffff",
            bold: true,
            align: "center",
            borders: { top: true, bottom: true, left: true, right: true },
          };
        } else {
          const isEven = (r - minRow) % 2 === 0;
          nextData[key] = {
            ...current,
            bg: isEven ? "#f9fafb" : "#ffffff",
            borders: { bottom: true, right: true },
          };
        }
      }
    }
    updateActiveSheetData(nextData);
    setIsFilterActive(true);
  };

  const handleInsertRowOrCol = (type: "row" | "col") => {
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;
    const nextData: Record<string, CellData> = {};

    for (const [key, cell] of Object.entries(activeSheet.data)) {
      const p = parseCellKey(key);
      if (!p) continue;
      if (type === "row") {
        if (p.row >= parsed.row) {
          nextData[`${p.colName}${p.rowNum + 1}`] = cell;
        } else {
          nextData[key] = cell;
        }
      } else {
        if (p.col >= parsed.col) {
          nextData[`${colIndexToName(p.col + 1)}${p.rowNum}`] = cell;
        } else {
          nextData[key] = cell;
        }
      }
    }
    updateActiveSheetData(nextData);
  };

  const handleDeleteRowOrCol = (type: "row" | "col") => {
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;
    const nextData: Record<string, CellData> = {};

    for (const [key, cell] of Object.entries(activeSheet.data)) {
      const p = parseCellKey(key);
      if (!p) continue;
      if (type === "row") {
        if (p.row === parsed.row) continue;
        if (p.row > parsed.row) {
          nextData[`${p.colName}${p.rowNum - 1}`] = cell;
        } else {
          nextData[key] = cell;
        }
      } else {
        if (p.col === parsed.col) continue;
        if (p.col > parsed.col) {
          nextData[`${colIndexToName(p.col - 1)}${p.rowNum}`] = cell;
        } else {
          nextData[key] = cell;
        }
      }
    }
    updateActiveSheetData(nextData);
  };

  const handleInsertChart = (chartType: "bar" | "line" | "pie") => {
    const parsedAnchor = parseCellKey(activeCellKey) || { col: 0, row: 0 };
    const minCol = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : parsedAnchor.col;
    const maxCol = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : parsedAnchor.col;
    const minRow = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : parsedAnchor.row;
    const maxRow = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : Math.min(parsedAnchor.row + 5, 50);

    const dataPoints: Array<{ label: string; value: number }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const colName = colIndexToName(c);
        const cell = activeSheet.data[`${colName}${r + 1}`];
        if (cell) {
          const val = cell.computed !== undefined && cell.computed !== null ? cell.computed : cell.raw;
          const num = Number(val);
          if (!isNaN(num) && val !== "") {
            dataPoints.push({
              label: `${colName}${r + 1}`,
              value: num,
            });
          }
        }
      }
    }

    if (dataPoints.length === 0) {
      dataPoints.push(
        { label: "Q1", value: 120 },
        { label: "Q2", value: 240 },
        { label: "Q3", value: 180 },
        { label: "Q4", value: 310 }
      );
    }

    setActiveChart({
      type: chartType,
      title: `Gráfico ${chartType === "bar" ? "de Columnas" : chartType === "line" ? "de Líneas" : "Circular"} (${activeSheet.name})`,
      data: dataPoints.slice(0, 8),
    });
  };

  const handleTextToColumns = () => {
    const nextData = { ...activeSheet.data };
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;

    const cell = nextData[activeCellKey];
    if (cell && cell.raw) {
      const parts = cell.raw.split(/[,;\t|]+/);
      if (parts.length > 1) {
        parts.forEach((part, idx) => {
          const targetColName = colIndexToName(parsed.col + idx);
          nextData[`${targetColName}${parsed.rowNum}`] = {
            raw: part.trim(),
          };
        });
        updateActiveSheetData(nextData);
      }
    }
  };

  const handleRemoveDuplicates = () => {
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;
    const colName = parsed.colName;

    const seenValues = new Set<string>();
    const nextData = { ...activeSheet.data };

    for (let r = 1; r <= 100; r++) {
      const key = `${colName}${r}`;
      const cell = nextData[key];
      if (cell && cell.raw) {
        if (seenValues.has(cell.raw)) {
          delete nextData[key];
        } else {
          seenValues.add(cell.raw);
        }
      }
    }
    updateActiveSheetData(nextData);
  };

  const handleSpellCheck = () => {
    modifySelectedCells((c) => ({
      ...c,
      color: "#107c41",
    }));
  };

  // Funciones de inserción de fórmulas
  const insertFormulaTemplate = (template: string) => {
    setEditingValue(template);
    setIsEditing(true);
  };

  const handleInsertAutoSum = () => {
    // Busca celdas superiores con números
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;
    if (parsed.rowNum > 1) {
      const formula = `=SUMA(${parsed.colName}1:${parsed.colName}${parsed.rowNum - 1})`;
      setEditingValue(formula);
      const existing = activeSheet.data[activeCellKey] || { raw: "" };
      const nextData = {
        ...activeSheet.data,
        [activeCellKey]: {
          ...existing,
          raw: formula,
          bold: true,
          computed: computeCellValue(formula, activeSheet.data),
        },
      };
      updateActiveSheetData(nextData);
    }
  };

  const handleInsertAverage = () => insertFormulaTemplate("=PROMEDIO(");
  const handleInsertCount = () => insertFormulaTemplate("=CONTAR(");
  const handleInsertMax = () => insertFormulaTemplate("=MAX(");
  const handleInsertMin = () => insertFormulaTemplate("=MIN(");

  // Borrar contenido del rango seleccionado o celda activa (tecla Supr / Backspace o botón)
  const handleClearSelection = useCallback(() => {
    const nextData = { ...activeSheet.data };

    if (selectionRange) {
      const minCol = Math.min(selectionRange.startCol, selectionRange.endCol);
      const maxCol = Math.max(selectionRange.startCol, selectionRange.endCol);
      const minRow = Math.min(selectionRange.startRow, selectionRange.endRow);
      const maxRow = Math.max(selectionRange.startRow, selectionRange.endRow);

      for (let c = minCol; c <= maxCol; c++) {
        const colName = colIndexToName(c);
        for (let r = minRow; r <= maxRow; r++) {
          const key = `${colName}${r + 1}`;
          delete nextData[key];
        }
      }
    } else {
      delete nextData[activeCellKey];
    }

    updateActiveSheetData(nextData);
    setEditingValue("");
    setIsEditing(false);
  }, [activeSheet.data, selectionRange, activeCellKey, updateActiveSheetData]);

  // Atajo de teclado global para Suprimir / Borrar en cualquier parte de la cuadrícula
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isInput) return;
      if (isEditing) return;
      if (exportModalOpen || importModalOpen) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleClearSelection();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isEditing, exportModalOpen, importModalOpen, handleClearSelection]);

  // Ordenamiento de datos
  const handleSort = (ascending: boolean) => {
    const parsed = parseCellKey(activeCellKey);
    if (!parsed) return;
    const colName = parsed.colName;

    // Recopilar valores de esa columna
    const entries: Array<{ row: number; val: string | number; cell: CellData }> = [];
    for (let r = 1; r <= 100; r++) {
      const k = `${colName}${r}`;
      if (activeSheet.data[k]) {
        const c = activeSheet.data[k];
        entries.push({
          row: r,
          val: c.computed !== undefined && c.computed !== null ? c.computed : c.raw,
          cell: c,
        });
      }
    }

    if (entries.length === 0) return;

    entries.sort((a, b) => {
      const numA = Number(a.val);
      const numB = Number(b.val);
      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      return ascending
        ? String(a.val).localeCompare(String(b.val))
        : String(b.val).localeCompare(String(a.val));
    });

    const nextData = { ...activeSheet.data };
    entries.forEach((item, idx) => {
      const targetKey = `${colName}${idx + 5}`; // ubica desde fila 5 en adelante
      nextData[targetKey] = item.cell;
    });

    updateActiveSheetData(nextData);
  };

  // Guardado manual
  const handleSave = () => {
    setIsSaving(true);
    sheetVault.saveWorkbook(metadata, sheets, activeSheetId);
    setTimeout(() => {
      setIsSaving(false);
    }, 600);
  };

  // Deshacer / Rehacer
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setSheets(history[targetIndex]);
      sheetVault.saveWorkbook(metadata, history[targetIndex], activeSheetId);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setSheets(history[targetIndex]);
      sheetVault.saveWorkbook(metadata, history[targetIndex], activeSheetId);
    }
  };

  // Gestión de hojas
  const handleAddSheet = () => {
    const nextNum = sheets.length + 1;
    const newSheet: Sheet = {
      id: `sheet_${Date.now()}`,
      name: `Hoja${nextNum}`,
      data: {},
    };
    const nextSheets = [...sheets, newSheet];
    setSheets(nextSheets);
    setActiveSheetId(newSheet.id);
    sheetVault.saveWorkbook(metadata, nextSheets, newSheet.id);
  };

  const handleRenameSheet = (id: string, newName: string) => {
    const nextSheets = sheets.map((s) => (s.id === id ? { ...s, name: newName } : s));
    setSheets(nextSheets);
    sheetVault.saveWorkbook(metadata, nextSheets, activeSheetId);
  };

  // Cálculo de estadísticas en vivo de la celda activa o rango
  const stats: SelectionStats = useMemo(() => {
    let count = 0;
    let numericCount = 0;
    let sum = 0;
    const nums: number[] = [];

    const parsedAnchor = parseCellKey(activeCellKey);
    const minCol = selectionRange
      ? Math.min(selectionRange.startCol, selectionRange.endCol)
      : parsedAnchor?.col ?? 0;
    const maxCol = selectionRange
      ? Math.max(selectionRange.startCol, selectionRange.endCol)
      : parsedAnchor?.col ?? 0;
    const minRow = selectionRange
      ? Math.min(selectionRange.startRow, selectionRange.endRow)
      : parsedAnchor?.row ?? 0;
    const maxRow = selectionRange
      ? Math.max(selectionRange.startRow, selectionRange.endRow)
      : parsedAnchor?.row ?? 0;

    for (let c = minCol; c <= maxCol; c++) {
      const colName = colIndexToName(c);
      for (let r = minRow; r <= maxRow; r++) {
        const key = `${colName}${r + 1}`;
        const cell = activeSheet.data[key];
        if (cell && (cell.raw !== "" || cell.computed !== undefined)) {
          count++;
          const val = cell.computed !== undefined && cell.computed !== null ? cell.computed : cell.raw;
          const num = Number(val);
          if (!isNaN(num) && val !== "") {
            numericCount++;
            sum += num;
            nums.push(num);
          }
        }
      }
    }

    const average = numericCount > 0 ? Number((sum / numericCount).toFixed(4)) : 0;
    const min = nums.length > 0 ? Math.min(...nums) : 0;
    const max = nums.length > 0 ? Math.max(...nums) : 0;

    return {
      count,
      numericCount,
      sum,
      average,
      min,
      max,
    };
  }, [activeSheet.data, activeCellKey, selectionRange]);

  const handleSelectCell = (key: string) => {
    setActiveCellKey(key);
    const parsed = parseCellKey(key);
    if (parsed) {
      setSelectionRange({
        startCol: parsed.col,
        startRow: parsed.row,
        endCol: parsed.col,
        endRow: parsed.row,
      });
    }

    if (isFormatPainterActive && cellFormatPainter) {
      modifySelectedCells((c) => ({
        ...c,
        ...cellFormatPainter,
      }));
      setIsFormatPainterActive(false);
      setCellFormatPainter(null);
    }
  };

  const handleRangeSelect = (range: SelectionRange, anchorKey: string) => {
    setSelectionRange(range);
    setActiveCellKey(anchorKey);
  };

  const handleStartNewWorkbook = () => {
    const blankSheet: Sheet = {
      id: "sheet_1",
      name: "Hoja1",
      data: {},
      colWidths: {},
    };
    const newMeta: WorkbookMetadata = {
      id: `cfs_${Date.now()}`,
      title: "Libro en Blanco",
      author: "Usuario CoffeWorks",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMetadata(newMeta);
    setSheets([blankSheet]);
    setActiveSheetId("sheet_1");
    setHistory([[blankSheet]]);
    setHistoryIndex(0);
    sheetVault.saveWorkbook(newMeta, [blankSheet], "sheet_1");
    setShowStartScreen(false);
  };

  const handleStartOpenWorkbook = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const filename = file.name;

      // 1. Si es archivo nativo de CoffeWorks (.cfs) o JSON
      if (filename.endsWith(".cfs") || filename.endsWith(".json")) {
        const text = new TextDecoder().decode(buffer);
        try {
          const parsed = JSON.parse(text);
          if (parsed.sheets && parsed.sheets.length > 0) {
            setMetadata(parsed.metadata || metadata);
            setSheets(parsed.sheets);
            setActiveSheetId(parsed.activeSheetId || parsed.sheets[0].id);
            setHistory([parsed.sheets]);
            setHistoryIndex(0);
            sheetVault.saveWorkbook(parsed.metadata || metadata, parsed.sheets, parsed.activeSheetId || parsed.sheets[0].id);
            setShowStartScreen(false);
            return;
          }
        } catch {
          // Continuar con otros formatos
        }
      }

      // 2. Si es archivo binario de Excel (.xlsx, .xls) - Carga de libro completo multi-pestaña
      if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
        const importedWb = sheetVault.importFullWorkbook(buffer, filename);
        if (importedWb.sheets && importedWb.sheets.length > 0) {
          setMetadata(importedWb.metadata);
          setSheets(importedWb.sheets);
          setActiveSheetId(importedWb.activeSheetId);
          setHistory([importedWb.sheets]);
          setHistoryIndex(0);
          sheetVault.saveWorkbook(importedWb.metadata, importedWb.sheets, importedWb.activeSheetId);
          setShowStartScreen(false);
          return;
        }
      }

      // 3. Si es archivo delimitado por comas (.csv)
      if (filename.endsWith(".csv")) {
        const text = new TextDecoder().decode(buffer);
        const importedData = sheetVault.importFromCSV(text);
        const importedSheet: Sheet = {
          id: `sheet_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          data: importedData,
          colWidths: {},
        };
        const newMeta: WorkbookMetadata = {
          id: `cfs_${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ""),
          author: "Usuario CoffeWorks",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setMetadata(newMeta);
        setSheets([importedSheet]);
        setActiveSheetId(importedSheet.id);
        setHistory([[importedSheet]]);
        setHistoryIndex(0);
        sheetVault.saveWorkbook(newMeta, [importedSheet], importedSheet.id);
        setShowStartScreen(false);
        return;
      }

      // 4. Fallback genérico para otros formatos
      const importedData = sheetVault.importSpreadsheetFile(buffer, filename);
      const importedSheet: Sheet = {
        id: `sheet_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        data: importedData,
        colWidths: {},
      };
      const newMeta: WorkbookMetadata = {
        id: `cfs_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        author: "Usuario CoffeWorks",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMetadata(newMeta);
      setSheets([importedSheet]);
      setActiveSheetId(importedSheet.id);
      setHistory([[importedSheet]]);
      setHistoryIndex(0);
      sheetVault.saveWorkbook(newMeta, [importedSheet], importedSheet.id);
      setShowStartScreen(false);
    } catch (err) {
      console.error("Error al abrir archivo en CoffeCalc:", err);
      alert("No se pudo leer el archivo de hoja de cálculo.");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {/* 1. Encabezado oficial estilo Google Sheets */}
      <GoogleSheetsHeader
        title={metadata.title}
        onTitleChange={(newTitle: string) => setMetadata((m) => ({ ...m, title: newTitle }))}
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={() => setExportModalOpen(true)}
        onImport={() => setImportModalOpen(true)}
        onNewWorkbook={handleStartNewWorkbook}
        onPrint={() => window.print()}
        isSaving={isSaving}
        showGridlines={showGridlines}
        onToggleGridlines={() => setShowGridlines(!showGridlines)}
        showFormulaBar={showFormulaBar}
        onToggleFormulaBar={() => setShowFormulaBar(!showFormulaBar)}
        isSheetProtected={isSheetProtected}
        onToggleProtectSheet={() => setIsSheetProtected(!isSheetProtected)}
        isFilterActive={isFilterActive}
        onToggleFilter={() => setIsFilterActive(!isFilterActive)}
        onInsertChart={() => handleInsertChart("bar")}
        onSpellCheck={handleSpellCheck}
        onSortAsc={() => handleSort(true)}
        onSortDesc={() => handleSort(false)}
        onInsertRowOrCol={handleInsertRowOrCol}
        onDeleteRowOrCol={handleDeleteRowOrCol}
        onCut={handleCut}
        onPaste={handlePaste}
        onToggleRawFormulas={() => setShowRawFormulas(!showRawFormulas)}
        onToggleFreezePanes={() => setIsFrozenPanes(!isFrozenPanes)}
        onConditionalFormatting={handleConditionalFormatting}
        onFormatAsTable={handleFormatAsTable}
        onTextToColumns={handleTextToColumns}
        onRemoveDuplicates={handleRemoveDuplicates}
        onInsertAverage={handleInsertAverage}
        onInsertCount={handleInsertCount}
        onInsertMax={handleInsertMax}
        onInsertMin={handleInsertMin}
      />

      {/* 2. Barra de herramientas flotante en forma de píldora estilo Google Sheets */}
      <GoogleSheetsToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPrint={() => window.print()}
        onFormatPainter={handleFormatPainter}
        isFormatPainterActive={isFormatPainterActive}
        zoom={zoom}
        onZoomChange={setZoom}
        onSetFormat={handleSetFormat}
        onSetFontFamily={handleSetFontFamily}
        onSetFontSize={handleSetFontSize}
        onToggleBold={handleToggleBold}
        onToggleItalic={handleToggleItalic}
        onToggleUnderline={handleToggleUnderline}
        onSetTextColor={handleSetTextColor}
        onSetBgColor={handleSetBgColor}
        onToggleBorders={handleToggleBorders}
        onMergeAndCenter={handleMergeAndCenter}
        onSetAlign={handleSetAlign}
        onToggleWrapText={handleToggleWrapText}
        onInsertChart={() => handleInsertChart("bar")}
        onToggleFilter={() => setIsFilterActive(!isFilterActive)}
        isFilterActive={isFilterActive}
        onInsertAutoSum={handleInsertAutoSum}
        onAdjustDecimals={handleAdjustDecimals}
      />

      {/* 3. Barra de Fórmulas fx */}
      {showFormulaBar && (
        <FormulaBar
          activeCellKey={activeCellKey}
          onNavigateToCell={(key) => setActiveCellKey(key)}
          formulaValue={editingValue}
          onChangeFormula={(val) => {
            setEditingValue(val);
            if (!isEditing) setIsEditing(true);
          }}
          onCommitFormula={() => handleCommitEditing("down")}
          onCancelFormula={handleCancelEditing}
          onInsertFunction={(fn) => {
            insertFormulaTemplate(`=${fn}(`);
          }}
        />
      )}

      {/* 4. Cuadrícula de Celdas (Spreadsheet Grid) */}
      <SpreadsheetGrid
        data={activeSheet.data}
        colWidths={activeSheet.colWidths}
        activeCellKey={activeCellKey}
        selectionRange={selectionRange}
        onSelectCell={handleSelectCell}
        onRangeSelect={handleRangeSelect}
        onClearSelection={handleClearSelection}
        isEditing={isEditing}
        editingValue={editingValue}
        onChangeEditingValue={setEditingValue}
        onStartEditing={handleStartEditing}
        onCommitEditing={handleCommitEditing}
        onCancelEditing={handleCancelEditing}
        showGridlines={showGridlines}
        zoom={zoom}
        showRawFormulas={showRawFormulas}
        isFilterActive={isFilterActive}
        isSheetProtected={isSheetProtected}
        chartConfig={activeChart}
        onCloseChart={() => setActiveChart(null)}
      />

      {/* 5. Barra inferior de Hojas y Barra de Estado */}
      <SheetTabsBar
        sheets={sheets}
        activeSheetId={activeSheetId}
        onSelectSheet={setActiveSheetId}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        isEditing={isEditing}
        stats={stats}
        zoom={zoom}
        onZoomChange={setZoom}
      />

      {/* Modales */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        metadata={metadata}
        activeSheet={activeSheet}
        sheets={sheets}
      />

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onApplyImport={(imported) => {
          updateActiveSheetData({
            ...activeSheet.data,
            ...imported,
          });
        }}
        onImportWorkbook={(importedWb) => {
          setMetadata(importedWb.metadata);
          setSheets(importedWb.sheets);
          setActiveSheetId(importedWb.activeSheetId);
          setHistory([importedWb.sheets]);
          setHistoryIndex(0);
          sheetVault.saveWorkbook(importedWb.metadata, importedWb.sheets, importedWb.activeSheetId);
        }}
      />

      {/* Pantalla de inicio con botones grandes: Nuevo archivo y Abrir archivo */}
      {showStartScreen && (
        <StartScreen
          onNewWorkbook={handleStartNewWorkbook}
          onOpenWorkbook={handleStartOpenWorkbook}
          onContinueCurrent={() => setShowStartScreen(false)}
          hasExistingWorkbook={sheets.length > 0}
          currentTitle={metadata.title}
        />
      )}
    </div>
  );
};
