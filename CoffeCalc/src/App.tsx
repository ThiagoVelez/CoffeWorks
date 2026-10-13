import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TitleBar } from "./components/TitleBar";
import { ExcelRibbon } from "./components/ExcelRibbon";
import { FormulaBar } from "./components/FormulaBar";
import { SpreadsheetGrid } from "./components/SpreadsheetGrid";
import { SheetTabsBar } from "./components/SheetTabsBar";
import { ExportModal } from "./components/ExportModal";
import { ImportModal } from "./components/ImportModal";
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

  // Vistas y zoom
  const [showGridlines, setShowGridlines] = useState<boolean>(true);
  const [showFormulaBar, setShowFormulaBar] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);

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
        next[key] = {
          ...cell,
          computed: computeCellValue(cell.raw, next),
        };
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
  };

  const handleRangeSelect = (range: SelectionRange, anchorKey: string) => {
    setSelectionRange(range);
    setActiveCellKey(anchorKey);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none">
      {/* 1. Barra de título estilo Excel */}
      <TitleBar
        title={metadata.title}
        onTitleChange={(title) => setMetadata((m) => ({ ...m, title }))}
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={() => setExportModalOpen(true)}
        isSaving={isSaving}
      />

      {/* 2. Cinta Ribbon completa de Excel */}
      <ExcelRibbon
        onNewWorkbook={() => {
          if (confirm("¿Crear un nuevo libro en blanco?")) {
            localStorage.removeItem("coffecalc_active_workbook");
            window.location.reload();
          }
        }}
        onSave={handleSave}
        onOpenExport={() => setExportModalOpen(true)}
        onOpenImport={() => setImportModalOpen(true)}
        onPrint={() => window.print()}
        onToggleBold={handleToggleBold}
        onToggleItalic={handleToggleItalic}
        onToggleUnderline={handleToggleUnderline}
        onSetAlign={handleSetAlign}
        onSetFormat={handleSetFormat}
        onSetBgColor={handleSetBgColor}
        onSetTextColor={handleSetTextColor}
        onInsertAutoSum={handleInsertAutoSum}
        onInsertAverage={handleInsertAverage}
        onInsertCount={handleInsertCount}
        onInsertMax={handleInsertMax}
        onInsertMin={handleInsertMin}
        onClearCell={handleClearSelection}
        onSortAsc={() => handleSort(true)}
        onSortDesc={() => handleSort(false)}
        showGridlines={showGridlines}
        onToggleGridlines={() => setShowGridlines(!showGridlines)}
        showFormulaBar={showFormulaBar}
        onToggleFormulaBar={() => setShowFormulaBar(!showFormulaBar)}
        zoom={zoom}
        onZoomChange={setZoom}
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
      />
    </div>
  );
};
