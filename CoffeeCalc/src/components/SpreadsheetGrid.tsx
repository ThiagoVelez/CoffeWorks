// Cuadrícula de CoffeeCalc.
//
// Dibuja solo las filas y columnas visibles (ventana virtual) con posición
// absoluta, de modo que la hoja puede crecer sin penalizar el rendimiento.
// Las cabeceras y los paneles inmovilizados son capas "sticky" que comparten
// el mismo sistema de coordenadas que la capa principal.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Filter, ShieldAlert } from "lucide-react";
import type { Bounds, CellData, SelectionRange, Sheet } from "../types";
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, HEADER_HEIGHT, HEADER_WIDTH } from "../types";
import { cellKey, colIndexToName, formatCellValue, isErrorValue } from "../services/formulaEngine";
import { boundsContain, conditionalStyles, hiddenRows, mergeAt } from "../services/sheetOps";
import { ChartCard } from "./ChartCard";

export interface CellPosition {
  col: number;
  row: number;
}

export type MoveDirection = "up" | "down" | "left" | "right" | "none";

interface SpreadsheetGridProps {
  sheet: Sheet;
  activeCell: CellPosition;
  selection: Bounds;
  onSelect: (range: SelectionRange, active: CellPosition) => void;
  /** Texto en edición, o `null` si no se está editando. */
  editingValue: string | null;
  /** La edición se hace en la celda (true) o en la barra de fórmulas (false). */
  editingInCell: boolean;
  onStartEdit: (initial?: string) => void;
  onEditChange: (value: string) => void;
  onCommitEdit: (move: MoveDirection) => void;
  onCancelEdit: () => void;
  onClear: () => void;
  onFill: (source: Bounds, target: Bounds) => void;
  onResizeColumn: (col: number, width: number) => void;
  onAutoFitColumn: (col: number) => void;
  onResizeRow: (row: number, height: number) => void;
  onContextMenu: (x: number, y: number) => void;
  onOpenFilter: (col: number, anchor: DOMRect) => void;
  onOpenLink: (url: string) => void;
  onUpdateChart: (id: string, changes: { x?: number; y?: number; width?: number; height?: number; type?: string; title?: string }) => void;
  onRemoveChart: (id: string) => void;
  /** Rango copiado o cortado (se dibuja con borde discontinuo). */
  clipboardBounds: Bounds | null;
  showGridlines: boolean;
  showFormulas: boolean;
  zoom: number;
}

const MIN_ROWS = 100;
const MIN_COLS = 26;

/** Devuelve el índice del tramo que contiene `offset` en un vector de acumulados. */
function locate(offsets: number[], offset: number): number {
  let low = 0;
  let high = offsets.length - 2;
  if (offset <= 0) return 0;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (offsets[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

interface CellBoxProps {
  cell: CellData;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  conditional?: { bg: string; color: string };
  spans: boolean;
  /** Clave del corrector ortográfico (solo textos escritos a mano). */
  spellKey?: string;
}

/** Celda con contenido o formato. Las celdas vacías no se dibujan. */
const CellBox = React.memo(function CellBox({
  cell,
  left,
  top,
  width,
  height,
  text,
  conditional,
  spans,
  spellKey,
}: CellBoxProps) {
  const isNumber = typeof cell.computed === "number";
  const isError = isErrorValue(cell.computed);
  const align = cell.align || (isNumber ? "right" : typeof cell.computed === "boolean" || isError ? "center" : "left");
  const background = conditional?.bg || cell.bg || (spans ? "#ffffff" : undefined);
  const color = conditional?.color || cell.color || (cell.link ? "#0b57d0" : isError ? "#b3261e" : undefined);
  const decorations = [cell.underline || cell.link ? "underline" : "", cell.strike ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      title={cell.note || undefined}
      style={{
        left,
        top,
        width: width - 1,
        height: height - 1,
        backgroundColor: background,
        color,
        fontWeight: cell.bold ? 700 : undefined,
        fontStyle: cell.italic ? "italic" : undefined,
        textDecoration: decorations || undefined,
        fontFamily: cell.fontFamily || undefined,
        fontSize: cell.fontSize ? `${cell.fontSize}pt` : undefined,
        justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        alignItems: cell.valign === "top" ? "flex-start" : cell.valign === "middle" ? "center" : "flex-end",
        textAlign: align,
        borderTop: cell.borders?.top ? "1px solid #1f1f1f" : undefined,
        borderBottom: cell.borders?.bottom ? "1px solid #1f1f1f" : undefined,
        borderLeft: cell.borders?.left ? "1px solid #1f1f1f" : undefined,
        borderRight: cell.borders?.right ? "1px solid #1f1f1f" : undefined,
        zIndex: spans ? 1 : undefined,
      }}
      className="absolute flex px-1.5 pb-[3px] text-xs leading-[1.25] overflow-hidden pointer-events-none box-border"
    >
      <span className={cell.wrapText ? "whitespace-pre-wrap break-words w-full" : "whitespace-nowrap"} data-spell-key={spellKey}>
        {text}
      </span>
      {cell.note && (
        <span className="absolute top-0 right-0 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-[#f9a825]" />
      )}
    </div>
  );
});

type DragMode =
  | { kind: "select"; anchor: CellPosition; axis: "cells" | "cols" | "rows" }
  | { kind: "fill"; target: Bounds }
  | { kind: "col-resize"; col: number; startX: number; startWidth: number }
  | { kind: "row-resize"; row: number; startY: number; startHeight: number };

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  sheet,
  activeCell,
  selection,
  onSelect,
  editingValue,
  editingInCell,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onClear,
  onFill,
  onResizeColumn,
  onAutoFitColumn,
  onResizeRow,
  onContextMenu,
  onOpenFilter,
  onOpenLink,
  onUpdateChart,
  onRemoveChart,
  clipboardBounds,
  showGridlines,
  showFormulas,
  zoom,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState({ left: 0, top: 0, width: 1200, height: 700 });
  const [fillTarget, setFillTarget] = useState<Bounds | null>(null);
  const scale = zoom / 100;
  const isEditing = editingValue !== null;
  const isProtected = Boolean(sheet.isProtected);
  const frozenRows = sheet.frozenRows || 0;
  const frozenCols = sheet.frozenCols || 0;

  // --- Geometría de la hoja -------------------------------------------------

  const { totalRows, totalCols } = useMemo(() => {
    let maxRow = 0;
    let maxCol = 0;
    for (const key of Object.keys(sheet.data)) {
      const match = /^([A-Z]+)([0-9]+)$/.exec(key);
      if (!match) continue;
      const row = Number(match[2]) - 1;
      let col = 0;
      for (let i = 0; i < match[1].length; i++) col = col * 26 + (match[1].charCodeAt(i) - 64);
      col -= 1;
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }
    return {
      totalRows: Math.max(MIN_ROWS, maxRow + 40, activeCell.row + 30, selection.r2 + 2),
      totalCols: Math.max(MIN_COLS, maxCol + 8, activeCell.col + 6, selection.c2 + 2),
    };
  }, [sheet.data, activeCell.row, activeCell.col, selection.r2, selection.c2]);

  const hidden = useMemo(() => hiddenRows(sheet), [sheet]);
  const conditional = useMemo(() => conditionalStyles(sheet), [sheet]);

  const colOffsets = useMemo(() => {
    const offsets = [0];
    for (let c = 0; c < totalCols; c++) {
      offsets.push(offsets[c] + (sheet.colWidths?.[colIndexToName(c)] || DEFAULT_COL_WIDTH));
    }
    return offsets;
  }, [sheet.colWidths, totalCols]);

  const rowOffsets = useMemo(() => {
    const offsets = [0];
    for (let r = 0; r < totalRows; r++) {
      offsets.push(offsets[r] + (hidden.has(r) ? 0 : sheet.rowHeights?.[r] || DEFAULT_ROW_HEIGHT));
    }
    return offsets;
  }, [sheet.rowHeights, totalRows, hidden]);

  const totalWidth = HEADER_WIDTH + colOffsets[totalCols];
  const totalHeight = HEADER_HEIGHT + rowOffsets[totalRows];
  const frozenWidth = colOffsets[Math.min(frozenCols, totalCols)];
  const frozenHeight = rowOffsets[Math.min(frozenRows, totalRows)];

  const cellX = (col: number) => HEADER_WIDTH + colOffsets[Math.min(col, totalCols)];
  const cellY = (row: number) => HEADER_HEIGHT + rowOffsets[Math.min(row, totalRows)];
  const colWidth = (col: number) => colOffsets[col + 1] - colOffsets[col];
  const rowHeight = (row: number) => rowOffsets[row + 1] - rowOffsets[row];

  const rectOf = (b: Bounds) => ({
    left: cellX(b.c1),
    top: cellY(b.r1),
    width: cellX(b.c2 + 1) - cellX(b.c1),
    height: cellY(b.r2 + 1) - cellY(b.r1),
  });

  // --- Ventana visible ------------------------------------------------------

  const readViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport((prev) => {
      const next = {
        left: el.scrollLeft / scale,
        top: el.scrollTop / scale,
        width: el.clientWidth / scale,
        height: el.clientHeight / scale,
      };
      return prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
        ? prev
        : next;
    });
  }, [scale]);

  useLayoutEffect(() => {
    readViewport();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(readViewport);
    observer.observe(el);
    return () => observer.disconnect();
  }, [readViewport]);

  const firstRow = locate(rowOffsets, viewport.top);
  const lastRow = Math.min(totalRows - 1, locate(rowOffsets, viewport.top + viewport.height) + 1);
  const firstCol = locate(colOffsets, viewport.left);
  const lastCol = Math.min(totalCols - 1, locate(colOffsets, viewport.left + viewport.width) + 1);

  const range = (from: number, to: number) => {
    const out: number[] = [];
    for (let i = from; i <= to; i++) out.push(i);
    return out;
  };
  const visibleRows = range(firstRow, lastRow).filter((r) => !hidden.has(r));
  const visibleCols = range(firstCol, lastCol);
  const frozenRowList = range(0, Math.min(frozenRows, totalRows) - 1).filter((r) => !hidden.has(r));
  const frozenColList = range(0, Math.min(frozenCols, totalCols) - 1);

  // --- Posición del puntero a celda -----------------------------------------

  const hitTest = (clientX: number, clientY: number) => {
    const el = scrollRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vx = (clientX - rect.left) / scale;
    const vy = (clientY - rect.top) / scale;
    const inRowHeader = vx < HEADER_WIDTH;
    const inColHeader = vy < HEADER_HEIGHT;
    const x = vx < HEADER_WIDTH + frozenWidth ? vx : vx + el.scrollLeft / scale;
    const y = vy < HEADER_HEIGHT + frozenHeight ? vy : vy + el.scrollTop / scale;
    const col = Math.min(totalCols - 1, locate(colOffsets, Math.max(0, x - HEADER_WIDTH)));
    let row = Math.min(totalRows - 1, locate(rowOffsets, Math.max(0, y - HEADER_HEIGHT)));
    while (hidden.has(row) && row < totalRows - 1) row++;
    return { col, row, inRowHeader, inColHeader };
  };

  /** Celda ancla de una combinación (o la propia celda si no está combinada). */
  const anchorOf = (col: number, row: number): CellPosition => {
    const merge = mergeAt(sheet, col, row);
    return merge ? { col: merge.c1, row: merge.r1 } : { col, row };
  };

  const selectCells = (anchor: CellPosition, focus: CellPosition) => {
    let bounds: Bounds = {
      r1: Math.min(anchor.row, focus.row),
      c1: Math.min(anchor.col, focus.col),
      r2: Math.max(anchor.row, focus.row),
      c2: Math.max(anchor.col, focus.col),
    };
    // Ampliar la selección para abarcar las combinaciones que toca
    let grew = true;
    while (grew) {
      grew = false;
      for (const merge of sheet.merges || []) {
        const overlaps = merge.r1 <= bounds.r2 && merge.r2 >= bounds.r1 && merge.c1 <= bounds.c2 && merge.c2 >= bounds.c1;
        if (overlaps && (merge.r1 < bounds.r1 || merge.r2 > bounds.r2 || merge.c1 < bounds.c1 || merge.c2 > bounds.c2)) {
          bounds = {
            r1: Math.min(bounds.r1, merge.r1),
            c1: Math.min(bounds.c1, merge.c1),
            r2: Math.max(bounds.r2, merge.r2),
            c2: Math.max(bounds.c2, merge.c2),
          };
          grew = true;
        }
      }
    }
    onSelect({ startRow: bounds.r1, startCol: bounds.c1, endRow: bounds.r2, endCol: bounds.c2 }, anchorOf(anchor.col, anchor.row));
  };

  // --- Ratón ----------------------------------------------------------------

  const applyDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "col-resize") {
      onResizeColumn(drag.col, Math.max(24, Math.round(drag.startWidth + (clientX - drag.startX) / scale)));
      return;
    }
    if (drag.kind === "row-resize") {
      onResizeRow(drag.row, Math.max(16, Math.round(drag.startHeight + (clientY - drag.startY) / scale)));
      return;
    }
    const hit = hitTest(clientX, clientY);
    if (!hit) return;
    if (drag.kind === "select") {
      if (drag.axis === "cols") {
        onSelect(
          { startRow: 0, endRow: totalRows - 1, startCol: Math.min(drag.anchor.col, hit.col), endCol: Math.max(drag.anchor.col, hit.col) },
          { col: drag.anchor.col, row: 0 }
        );
      } else if (drag.axis === "rows") {
        onSelect(
          { startCol: 0, endCol: totalCols - 1, startRow: Math.min(drag.anchor.row, hit.row), endRow: Math.max(drag.anchor.row, hit.row) },
          { col: 0, row: drag.anchor.row }
        );
      } else {
        selectCells(drag.anchor, { col: hit.col, row: hit.row });
      }
      return;
    }
    // Relleno: se extiende en el eje donde más se aleja el puntero
    const below = hit.row - selection.r2;
    const above = selection.r1 - hit.row;
    const right = hit.col - selection.c2;
    const left = selection.c1 - hit.col;
    const vertical = Math.max(below, above);
    const horizontal = Math.max(right, left);
    let target: Bounds = selection;
    if (vertical > 0 && vertical >= horizontal) {
      target = below > 0 ? { ...selection, r2: hit.row } : { ...selection, r1: hit.row };
    } else if (horizontal > 0) {
      target = right > 0 ? { ...selection, c2: hit.col } : { ...selection, c1: hit.col };
    }
    drag.target = target;
    setFillTarget(target);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      pointerRef.current = { x: e.clientX, y: e.clientY };
      applyDrag(e.clientX, e.clientY);
    };
    const handleUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      pointerRef.current = null;
      if (drag?.kind === "fill") {
        setFillTarget(null);
        const t = drag.target;
        if (t.r1 !== selection.r1 || t.r2 !== selection.r2 || t.c1 !== selection.c1 || t.c2 !== selection.c2) {
          onFill(selection, t);
        }
      }
    };
    // Desplazamiento automático al arrastrar cerca de los bordes
    const timer = window.setInterval(() => {
      const drag = dragRef.current;
      const pointer = pointerRef.current;
      const el = scrollRef.current;
      if (!drag || !pointer || !el || drag.kind === "col-resize" || drag.kind === "row-resize") return;
      const rect = el.getBoundingClientRect();
      const edge = 28;
      let dx = 0;
      let dy = 0;
      if (pointer.x > rect.right - edge) dx = 24;
      else if (pointer.x < rect.left + HEADER_WIDTH * scale + edge) dx = -24;
      if (pointer.y > rect.bottom - edge) dy = 24;
      else if (pointer.y < rect.top + HEADER_HEIGHT * scale + edge) dy = -24;
      if (dx || dy) {
        el.scrollLeft += dx;
        el.scrollTop += dy;
        applyDrag(pointer.x, pointer.y);
      }
    }, 60);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  });

  /** Al escribir una fórmula, un clic en otra celda inserta su referencia. */
  const canPickReference = () =>
    isEditing && editingValue !== null && /^=/.test(editingValue) && /[=+\-*/^&(,;:<>]\s*$/.test(editingValue);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    if (e.button === 2) {
      if (!hit.inRowHeader && !hit.inColHeader && !boundsContain(selection, hit.col, hit.row)) {
        if (isEditing) onCommitEdit("none");
        selectCells({ col: hit.col, row: hit.row }, { col: hit.col, row: hit.row });
      }
      return;
    }

    if (hit.inRowHeader && hit.inColHeader) {
      if (isEditing) onCommitEdit("none");
      onSelect({ startRow: 0, startCol: 0, endRow: totalRows - 1, endCol: totalCols - 1 }, { col: 0, row: 0 });
      scrollRef.current?.focus();
      return;
    }

    if (canPickReference() && !hit.inRowHeader && !hit.inColHeader) {
      e.preventDefault();
      onEditChange(editingValue + cellKey(hit.col, hit.row));
      window.setTimeout(() => editorRef.current?.focus(), 0);
      return;
    }

    if (isEditing) onCommitEdit("none");
    scrollRef.current?.focus();
    pointerRef.current = { x: e.clientX, y: e.clientY };

    if (hit.inColHeader) {
      const anchorCol = e.shiftKey ? activeCell.col : hit.col;
      dragRef.current = { kind: "select", anchor: { col: anchorCol, row: 0 }, axis: "cols" };
      onSelect(
        { startRow: 0, endRow: totalRows - 1, startCol: Math.min(anchorCol, hit.col), endCol: Math.max(anchorCol, hit.col) },
        { col: anchorCol, row: 0 }
      );
      return;
    }
    if (hit.inRowHeader) {
      const anchorRow = e.shiftKey ? activeCell.row : hit.row;
      dragRef.current = { kind: "select", anchor: { col: 0, row: anchorRow }, axis: "rows" };
      onSelect(
        { startCol: 0, endCol: totalCols - 1, startRow: Math.min(anchorRow, hit.row), endRow: Math.max(anchorRow, hit.row) },
        { col: 0, row: anchorRow }
      );
      return;
    }

    const cell = sheet.data[cellKey(hit.col, hit.row)];
    if (cell?.link && (e.ctrlKey || e.metaKey)) {
      onOpenLink(cell.link);
      return;
    }
    const anchor = e.shiftKey ? activeCell : { col: hit.col, row: hit.row };
    dragRef.current = { kind: "select", anchor, axis: "cells" };
    selectCells(anchor, { col: hit.col, row: hit.row });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit || hit.inRowHeader || hit.inColHeader || isProtected || isEditing) return;
    onStartEdit();
  };

  // --- Teclado --------------------------------------------------------------

  const moveTo = (col: number, row: number, extend: boolean) => {
    const target = {
      col: Math.max(0, Math.min(totalCols - 1, col)),
      row: Math.max(0, Math.min(totalRows - 1, row)),
    };
    if (extend) {
      // El extremo opuesto a la celda activa es el que se desplaza
      selectCells(activeCell, target);
    } else {
      selectCells(target, target);
    }
  };

  /** Salto de Ctrl+flecha: hasta el borde del bloque de datos. */
  const jump = (dCol: number, dRow: number, from: CellPosition): CellPosition => {
    const filled = (c: number, r: number) => Boolean(sheet.data[cellKey(c, r)]?.raw);
    let { col, row } = from;
    const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < totalCols && r < totalRows;
    const startFilled = filled(col, row) && inside(col + dCol, row + dRow) && filled(col + dCol, row + dRow);
    for (;;) {
      const nextCol = col + dCol;
      const nextRow = row + dRow;
      if (!inside(nextCol, nextRow)) break;
      if (startFilled) {
        if (!filled(nextCol, nextRow)) break;
      } else if (filled(nextCol, nextRow)) {
        col = nextCol;
        row = nextRow;
        break;
      }
      col = nextCol;
      row = nextRow;
    }
    return { col, row };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;
    const mod = e.ctrlKey || e.metaKey;
    // El extremo móvil de la selección (para ampliar con Mayús)
    const focus: CellPosition = {
      col: activeCell.col === selection.c1 ? selection.c2 : selection.c1,
      row: activeCell.row === selection.r1 ? selection.r2 : selection.r1,
    };
    const origin = e.shiftKey ? focus : activeCell;
    const step = (dCol: number, dRow: number) => {
      e.preventDefault();
      if (mod) {
        const target = jump(dCol, dRow, origin);
        moveTo(target.col, target.row, e.shiftKey);
        return;
      }
      let col = origin.col + dCol;
      let row = origin.row + dRow;
      // Saltar las celdas cubiertas por una combinación y las filas filtradas
      const merge = mergeAt(sheet, origin.col, origin.row);
      if (merge && !e.shiftKey) {
        if (dCol > 0) col = merge.c2 + 1;
        if (dCol < 0) col = merge.c1 - 1;
        if (dRow > 0) row = merge.r2 + 1;
        if (dRow < 0) row = merge.r1 - 1;
      }
      while (dRow !== 0 && hidden.has(row) && row > 0 && row < totalRows - 1) row += dRow;
      moveTo(col, row, e.shiftKey);
    };

    switch (e.key) {
      case "ArrowUp": return step(0, -1);
      case "ArrowDown": return step(0, 1);
      case "ArrowLeft": return step(-1, 0);
      case "ArrowRight": return step(1, 0);
      case "Tab":
        e.preventDefault();
        moveTo(activeCell.col + (e.shiftKey ? -1 : 1), activeCell.row, false);
        return;
      case "Home":
        e.preventDefault();
        moveTo(0, mod ? 0 : activeCell.row, e.shiftKey);
        return;
      case "PageDown":
      case "PageUp": {
        e.preventDefault();
        const page = Math.max(1, Math.floor(viewport.height / DEFAULT_ROW_HEIGHT) - 2);
        moveTo(origin.col, origin.row + (e.key === "PageDown" ? page : -page), e.shiftKey);
        return;
      }
      case "Enter":
      case "F2":
        e.preventDefault();
        if (!isProtected) onStartEdit();
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (!isProtected) onClear();
        return;
    }
    if (e.key.length === 1 && !mod && !e.altKey && !isProtected) {
      e.preventDefault();
      onStartEdit(e.key);
    }
  };

  // Mantener visible la celda activa al navegar con el teclado
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || dragRef.current) return;
    const left = cellX(activeCell.col) * scale;
    const right = cellX(activeCell.col + 1) * scale;
    const top = cellY(activeCell.row) * scale;
    const bottom = cellY(activeCell.row + 1) * scale;
    const minX = el.scrollLeft + (HEADER_WIDTH + frozenWidth) * scale;
    const minY = el.scrollTop + (HEADER_HEIGHT + frozenHeight) * scale;
    if (activeCell.col >= frozenCols) {
      if (left < minX) el.scrollLeft -= minX - left;
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 2;
    }
    if (activeCell.row >= frozenRows) {
      if (top < minY) el.scrollTop -= minY - top;
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight + 2;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCell.col, activeCell.row, sheet.id]);

  // Al terminar de editar, el teclado vuelve a la cuadrícula
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !isEditing) scrollRef.current?.focus({ preventScroll: true });
    wasEditing.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && editingInCell && editorRef.current) {
      const input = editorRef.current;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingInCell]);

  // --- Dibujo ---------------------------------------------------------------

  const activeMerge = mergeAt(sheet, activeCell.col, activeCell.row);
  const activeBounds: Bounds = activeMerge || { r1: activeCell.row, c1: activeCell.col, r2: activeCell.row, c2: activeCell.col };
  const isMulti = selection.r1 !== selection.r2 || selection.c1 !== selection.c2;
  const filter = sheet.filter;

  const coveredByMerge = (col: number, row: number) => {
    const merge = mergeAt(sheet, col, row);
    return merge ? merge.c1 !== col || merge.r1 !== row : false;
  };

  const renderCells = (rows: number[], cols: number[]) => {
    const boxes: React.ReactNode[] = [];
    const seenMerges = new Set<string>();
    for (const row of rows) {
      for (const col of cols) {
        const merge = mergeAt(sheet, col, row);
        const anchorCol = merge ? merge.c1 : col;
        const anchorRow = merge ? merge.r1 : row;
        const key = cellKey(anchorCol, anchorRow);
        if (merge) {
          if (seenMerges.has(key)) continue;
          seenMerges.add(key);
        }
        const cell = sheet.data[key];
        if (!cell && !merge) continue;
        const data = cell || { raw: "" };
        const text = showFormulas && data.raw ? data.raw : formatCellValue(data.computed, data);

        let width = merge ? cellX(merge.c2 + 1) - cellX(merge.c1) : colWidth(col);
        const height = merge ? cellY(merge.r2 + 1) - cellY(merge.r1) : rowHeight(row);
        let spans = Boolean(merge);

        // El texto largo invade las celdas vacías de su derecha, como en Excel
        const overflows =
          !merge && !data.wrapText && typeof data.computed === "string" && (data.align || "left") === "left" && text.length * 6.5 > width;
        if (overflows) {
          let next = col + 1;
          let needed = text.length * 6.6 + 12;
          while (needed > width && next < totalCols && !sheet.data[cellKey(next, row)] && !coveredByMerge(next, row) && next - col < 12) {
            width += colWidth(next);
            next++;
            spans = true;
          }
        }

        boxes.push(
          <CellBox
            key={key}
            cell={data}
            left={cellX(anchorCol)}
            top={cellY(anchorRow)}
            width={width}
            height={height}
            text={text}
            conditional={conditional.get(key)}
            spans={spans}
            spellKey={!showFormulas && typeof data.computed === "string" && data.raw && !data.raw.startsWith("=") && text === data.raw ? `${sheet.id}!${key}` : undefined}
          />
        );
      }
    }
    return boxes;
  };

  const renderGridlines = (rows: number[], cols: number[]) =>
    showGridlines && (
      <>
        {rows.map((row) => (
          <div
            key={`h${row}`}
            className="absolute h-px bg-[#e1e3e6] pointer-events-none"
            style={{ left: HEADER_WIDTH, top: cellY(row + 1) - 1, width: colOffsets[totalCols] }}
          />
        ))}
        {cols.map((col) => (
          <div
            key={`v${col}`}
            className="absolute w-px bg-[#e1e3e6] pointer-events-none"
            style={{ left: cellX(col + 1) - 1, top: HEADER_HEIGHT, height: rowOffsets[totalRows] }}
          />
        ))}
      </>
    );

  const renderOverlays = (withEditor: boolean) => {
    const selectionRect = rectOf(selection);
    const activeRect = rectOf(activeBounds);
    return (
      <>
        {isMulti && (
          <div
            className="absolute bg-[#1a73e8]/10 border border-[#1a73e8] pointer-events-none z-[3]"
            style={selectionRect}
          />
        )}
        <div
          className="absolute border-2 border-[#1a73e8] pointer-events-none z-[4]"
          style={{ left: activeRect.left - 1, top: activeRect.top - 1, width: activeRect.width + 1, height: activeRect.height + 1 }}
        />
        {clipboardBounds && (
          <div
            className="absolute border-2 border-dashed border-[#188038] pointer-events-none z-[4]"
            style={rectOf(clipboardBounds)}
          />
        )}
        {fillTarget && (
          <div className="absolute border border-dashed border-[#5f6368] pointer-events-none z-[4]" style={rectOf(fillTarget)} />
        )}
        {!isEditing && !isProtected && (
          <div
            className="absolute w-[7px] h-[7px] bg-[#1a73e8] border border-white cursor-crosshair z-[6]"
            style={{ left: selectionRect.left + selectionRect.width - 4, top: selectionRect.top + selectionRect.height - 4 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dragRef.current = { kind: "fill", target: selection };
              pointerRef.current = { x: e.clientX, y: e.clientY };
            }}
          />
        )}

        {/* Botones del filtro sobre la fila de encabezados */}
        {filter &&
          range(filter.range.c1, filter.range.c2).map((col) => {
            const active = (filter.excluded[col] || []).length > 0;
            return (
              <button
                key={`f${col}`}
                type="button"
                title="Filtrar y ordenar esta columna"
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onClick={(e) => onOpenFilter(col, e.currentTarget.getBoundingClientRect())}
                className={`absolute z-[6] w-4 h-4 rounded flex items-center justify-center border ${
                  active ? "bg-[#188038] text-white border-[#188038]" : "bg-white text-[#444746] border-[#c4c7c5] hover:bg-[#e8eaed]"
                }`}
                style={{ left: cellX(col + 1) - 20, top: cellY(filter.range.r1) + (rowHeight(filter.range.r1) - 16) / 2 }}
              >
                <Filter size={9} />
              </button>
            );
          })}

        {/* Editor dentro de la celda */}
        {isEditing && withEditor && (
          editingInCell ? (
            <input
              ref={editorRef}
              type="text"
              value={editingValue ?? ""}
              spellCheck={false}
              onChange={(e) => onEditChange(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitEdit(e.shiftKey ? "up" : "down");
                } else if (e.key === "Tab") {
                  e.preventDefault();
                  onCommitEdit(e.shiftKey ? "left" : "right");
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
              className="absolute z-[8] bg-white text-[#1f1f1f] text-xs px-1.5 outline-none border-2 border-[#1a73e8] shadow-md select-text box-border"
              style={{
                left: activeRect.left - 1,
                top: activeRect.top - 1,
                height: activeRect.height + 1,
                width: Math.max(activeRect.width + 1, Math.min(600, (editingValue?.length || 0) * 7.2 + 24)),
              }}
            />
          ) : (
            <div
              className="absolute z-[8] bg-white text-[#1f1f1f] text-xs px-1.5 flex items-center border-2 border-[#1a73e8] whitespace-nowrap overflow-hidden pointer-events-none box-border"
              style={{ left: activeRect.left - 1, top: activeRect.top - 1, height: activeRect.height + 1, minWidth: activeRect.width + 1 }}
            >
              {editingValue}
            </div>
          )
        )}
      </>
    );
  };

  const columnHeaders = (cols: number[]) =>
    cols.map((col) => {
      const selected = col >= selection.c1 && col <= selection.c2;
      return (
        <React.Fragment key={col}>
          <div
            style={{ left: cellX(col), top: 0, width: colWidth(col), height: HEADER_HEIGHT }}
            className={`absolute flex items-center justify-center font-mono text-[11px] font-semibold border-r border-b border-[#c8c6c4] box-border ${
              selected ? "bg-[#d3e3fd] text-[#0b57d0]" : "bg-[#f3f2f1] text-[#595959]"
            }`}
          >
            {colIndexToName(col)}
          </div>
          <div
            title="Arrastra para cambiar el ancho; doble clic para ajustarlo al contenido"
            style={{ left: cellX(col + 1) - 3, top: 0, width: 6, height: HEADER_HEIGHT }}
            className="absolute cursor-col-resize z-[7] hover:bg-[#1a73e8]/40"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dragRef.current = { kind: "col-resize", col, startX: e.clientX, startWidth: colWidth(col) };
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onAutoFitColumn(col);
            }}
          />
        </React.Fragment>
      );
    });

  const rowHeaders = (rows: number[]) =>
    rows.map((row) => {
      const selected = row >= selection.r1 && row <= selection.r2;
      const filteredNearby = hidden.has(row + 1) || hidden.has(row - 1);
      return (
        <React.Fragment key={row}>
          <div
            style={{ left: 0, top: cellY(row), width: HEADER_WIDTH, height: rowHeight(row) }}
            className={`absolute flex items-center justify-center font-mono text-[11px] font-semibold border-r border-b border-[#c8c6c4] box-border ${
              selected ? "bg-[#d3e3fd] text-[#0b57d0]" : filteredNearby ? "bg-[#e6f4ea] text-[#188038]" : "bg-[#f8f9fa] text-[#595959]"
            }`}
          >
            {row + 1}
          </div>
          <div
            style={{ left: 0, top: cellY(row + 1) - 3, width: HEADER_WIDTH, height: 6 }}
            className="absolute cursor-row-resize z-[7] hover:bg-[#1a73e8]/40"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              dragRef.current = { kind: "row-resize", row, startY: e.clientY, startHeight: rowHeight(row) };
            }}
          />
        </React.Fragment>
      );
    });

  // Capa donde se coloca el editor: la que contiene la celda activa
  const editorLayer =
    activeCell.row < frozenRows && activeCell.col < frozenCols
      ? "corner"
      : activeCell.row < frozenRows
      ? "top"
      : activeCell.col < frozenCols
      ? "left"
      : "main";

  const frozenLine = "#9aa0a6";

  return (
    <div className="flex-1 flex flex-col min-h-0 relative print:hidden">
      {isProtected && (
        <div className="bg-amber-50 border-b border-amber-300 px-3 py-1 flex items-center gap-2 text-xs text-amber-900 shrink-0">
          <ShieldAlert size={14} className="text-amber-700" />
          <span className="font-semibold">Hoja protegida: solo lectura.</span>
          <span>Desactiva la protección en Datos › Proteger hoja para editarla.</span>
        </div>
      )}

      <div
        ref={scrollRef}
        tabIndex={0}
        onScroll={readViewport}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY);
        }}
        className="flex-1 overflow-auto bg-white select-none focus:outline-none relative cursor-cell"
      >
        <div style={{ zoom: scale, width: totalWidth, height: totalHeight }}>
          {/* Capa superior: cabeceras de columna y filas inmovilizadas */}
          <div className="sticky top-0 h-0 z-30">
            <div
              className="absolute left-0 top-0 overflow-hidden bg-white"
              style={{
                width: totalWidth,
                height: HEADER_HEIGHT + frozenHeight,
                borderBottom: frozenRows > 0 ? `2px solid ${frozenLine}` : undefined,
              }}
            >
              {frozenRows > 0 && (
                <>
                  {renderGridlines(frozenRowList, visibleCols)}
                  {renderCells(frozenRowList, visibleCols)}
                  {renderOverlays(editorLayer === "top")}
                </>
              )}
              {columnHeaders(visibleCols)}
            </div>

            {/* Esquina: intersección de cabeceras y paneles inmovilizados */}
            <div className="sticky left-0 w-0 h-0 z-10">
              <div
                className="absolute left-0 top-0 overflow-hidden bg-white"
                style={{
                  width: HEADER_WIDTH + frozenWidth,
                  height: HEADER_HEIGHT + frozenHeight,
                  borderRight: frozenCols > 0 ? `2px solid ${frozenLine}` : undefined,
                  borderBottom: frozenRows > 0 ? `2px solid ${frozenLine}` : undefined,
                }}
              >
                {frozenRows > 0 && frozenCols > 0 && (
                  <>
                    {renderGridlines(frozenRowList, frozenColList)}
                    {renderCells(frozenRowList, frozenColList)}
                    {renderOverlays(editorLayer === "corner")}
                  </>
                )}
                {columnHeaders(frozenColList)}
                {rowHeaders(frozenRowList)}
                <div
                  title="Seleccionar toda la hoja (Ctrl+A)"
                  className="absolute left-0 top-0 bg-[#f3f2f1] border-r border-b border-[#c8c6c4] flex items-end justify-end p-0.5 box-border"
                  style={{ width: HEADER_WIDTH, height: HEADER_HEIGHT }}
                >
                  <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-[#8a8886] opacity-60" />
                </div>
              </div>
            </div>
          </div>

          {/* Capa izquierda: cabeceras de fila y columnas inmovilizadas */}
          <div className="sticky left-0 w-0 h-0 z-20">
            <div
              className="absolute left-0 top-0 overflow-hidden bg-white"
              style={{
                width: HEADER_WIDTH + frozenWidth,
                height: totalHeight,
                borderRight: frozenCols > 0 ? `2px solid ${frozenLine}` : undefined,
              }}
            >
              {frozenCols > 0 && (
                <>
                  {renderGridlines(visibleRows, frozenColList)}
                  {renderCells(visibleRows, frozenColList)}
                  {renderOverlays(editorLayer === "left")}
                </>
              )}
              {rowHeaders(visibleRows)}
            </div>
          </div>

          {/* Capa principal */}
          <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
            {renderGridlines(visibleRows, visibleCols)}
            {renderCells(visibleRows, visibleCols)}
            {renderOverlays(editorLayer === "main")}
            {(sheet.charts || []).map((chart) => (
              <ChartCard
                key={chart.id}
                chart={chart}
                sheet={sheet}
                scale={scale}
                onChange={(changes) => onUpdateChart(chart.id, changes)}
                onRemove={() => onRemoveChart(chart.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
