import React, { useRef, useEffect } from "react";
import type { CellData, SelectionRange } from "../types";
import {
  colIndexToName,
  parseCellKey,
  formatCellValue,
} from "../services/formulaEngine";

interface SpreadsheetGridProps {
  data: Record<string, CellData>;
  colWidths?: Record<string, number>;
  activeCellKey: string;
  selectionRange: SelectionRange | null;
  onSelectCell: (key: string) => void;
  onRangeSelect: (range: SelectionRange, anchorKey: string) => void;
  onClearSelection: () => void;
  isEditing: boolean;
  editingValue: string;
  onChangeEditingValue: (val: string) => void;
  onStartEditing: () => void;
  onCommitEditing: (moveToNext?: "down" | "right" | "none") => void;
  onCancelEditing: () => void;
  showGridlines: boolean;
  zoom: number;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  data,
  colWidths,
  activeCellKey,
  selectionRange,
  onSelectCell,
  onRangeSelect,
  onClearSelection,
  isEditing,
  editingValue,
  onChangeEditingValue,
  onStartEditing,
  onCommitEditing,
  onCancelEditing,
  showGridlines,
  zoom,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const anchorCoordsRef = useRef<{ col: number; row: number } | null>(null);

  const parsedActive = parseCellKey(activeCellKey) || { col: 0, row: 0, colName: "A", rowNum: 1 };

  // Cantidad dinámica de columnas y filas según los datos presentes
  const { totalCols, totalRows } = React.useMemo(() => {
    let maxColIdx = 25; // Al menos hasta la Z (26 columnas)
    let maxRowIdx = 99; // Al menos 100 filas

    for (const key of Object.keys(data)) {
      const parsed = parseCellKey(key);
      if (parsed) {
        if (parsed.col > maxColIdx) maxColIdx = parsed.col;
        if (parsed.row > maxRowIdx) maxRowIdx = parsed.row;
      }
    }

    return {
      totalCols: Math.max(26, maxColIdx + 5),
      totalRows: Math.max(100, maxRowIdx + 20),
    };
  }, [data]);

  // Referencias para auto-scroll continuo al arrastrar
  const scrollAnimRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Autoenfocar el input cuando entra en modo de edición
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const getColWidth = (colIdx: number): number => {
    const colName = colIndexToName(colIdx);
    if (colWidths && colWidths[colName]) {
      return colWidths[colName];
    }
    return colIdx === 0 ? 200 : 120;
  };

  // Auxiliares para resolver columna y fila por offsets en píxeles dentro del lienzo
  const getColAtOffset = (x: number): number => {
    let currentX = x - 48; // Restar cabecera de filas a la izquierda (48px)
    if (currentX <= 0) return 0;
    for (let c = 0; c < totalCols; c++) {
      const w = getColWidth(c);
      if (currentX < w) return c;
      currentX -= w;
    }
    return totalCols - 1;
  };

  const getRowAtOffset = (y: number): number => {
    const offset = y - 24; // Restar cabecera de columnas superior (24px)
    if (offset <= 0) return 0;
    const rowIndex = Math.floor(offset / 24);
    return Math.min(totalRows - 1, Math.max(0, rowIndex));
  };

  const updateRangeFromMouseCoords = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !anchorCoordsRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const container = containerRef.current;

    // Coordenada virtual proyectada sobre el contenido scrolleable
    const clampedMouseX = Math.min(rect.right, Math.max(rect.left, clientX));
    const clampedMouseY = Math.min(rect.bottom, Math.max(rect.top, clientY));

    const contentX = container.scrollLeft + (clampedMouseX - rect.left);
    const contentY = container.scrollTop + (clampedMouseY - rect.top);

    const targetCol = getColAtOffset(contentX);
    const targetRow = getRowAtOffset(contentY);

    const anchor = anchorCoordsRef.current;
    const anchorKey = `${colIndexToName(anchor.col)}${anchor.row + 1}`;

    onRangeSelect(
      {
        startCol: anchor.col,
        startRow: anchor.row,
        endCol: targetCol,
        endRow: targetRow,
      },
      anchorKey
    );
  };

  // Ciclo continuo de auto-scroll mientras se sostiene el clic arrastrando
  useEffect(() => {
    const autoScrollLoop = () => {
      if (isDraggingRef.current && containerRef.current) {
        const { x, y } = scrollSpeedRef.current;
        if (x !== 0 || y !== 0) {
          containerRef.current.scrollLeft += x;
          containerRef.current.scrollTop += y;

          if (lastMousePosRef.current) {
            updateRangeFromMouseCoords(
              lastMousePosRef.current.x,
              lastMousePosRef.current.y
            );
          }
        }
      }
      scrollAnimRef.current = requestAnimationFrame(autoScrollLoop);
    };

    scrollAnimRef.current = requestAnimationFrame(autoScrollLoop);
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  // Manejo global de movimiento y liberación del ratón durante el arrastre
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      const rect = containerRef.current.getBoundingClientRect();
      const edgeThreshold = 45;

      let speedX = 0;
      let speedY = 0;

      // Desplazamiento horizontal automático al acercarse al borde o sobrepasarlo
      if (e.clientX > rect.right - edgeThreshold) {
        speedX = Math.min(30, Math.max(8, (e.clientX - (rect.right - edgeThreshold)) * 0.4));
      } else if (e.clientX < rect.left + edgeThreshold) {
        speedX = -Math.min(30, Math.max(8, ((rect.left + edgeThreshold) - e.clientX) * 0.4));
      }

      // Desplazamiento vertical automático al acercarse al borde o sobrepasarlo
      if (e.clientY > rect.bottom - edgeThreshold) {
        speedY = Math.min(25, Math.max(6, (e.clientY - (rect.bottom - edgeThreshold)) * 0.4));
      } else if (e.clientY < rect.top + edgeThreshold) {
        speedY = -Math.min(25, Math.max(6, ((rect.top + edgeThreshold) - e.clientY) * 0.4));
      }

      scrollSpeedRef.current = { x: speedX, y: speedY };

      // Actualizar rango según la posición actual del cursor
      updateRangeFromMouseCoords(e.clientX, e.clientY);
    };

    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      scrollSpeedRef.current = { x: 0, y: 0 };
    };

    const handleWheel = () => {
      if (isDraggingRef.current && lastMousePosRef.current) {
        updateRangeFromMouseCoords(
          lastMousePosRef.current.x,
          lastMousePosRef.current.y
        );
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Inicio de arrastre con clic sostenido
  const handleCellMouseDown = (colIdx: number, rowIdx: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Solo clic izquierdo
    const cellKey = `${colIndexToName(colIdx)}${rowIdx + 1}`;

    isDraggingRef.current = true;
    anchorCoordsRef.current = { col: colIdx, row: rowIdx };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // Enfocar el contenedor para recibir atajos de teclado inmediatos
    containerRef.current?.focus();

    onRangeSelect(
      {
        startCol: colIdx,
        startRow: rowIdx,
        endCol: colIdx,
        endRow: rowIdx,
      },
      cellKey
    );
  };

  // Movimiento mientras se mantiene presionado el clic
  const handleCellMouseEnter = (colIdx: number, rowIdx: number) => {
    if (!isDraggingRef.current || !anchorCoordsRef.current) return;
    const anchor = anchorCoordsRef.current;
    const anchorKey = `${colIndexToName(anchor.col)}${anchor.row + 1}`;

    onRangeSelect(
      {
        startCol: anchor.col,
        startRow: anchor.row,
        endCol: colIdx,
        endRow: rowIdx,
      },
      anchorKey
    );
  };

  // Límites del rango seleccionado
  const minCol = selectionRange
    ? Math.min(selectionRange.startCol, selectionRange.endCol)
    : parsedActive.col;
  const maxCol = selectionRange
    ? Math.max(selectionRange.startCol, selectionRange.endCol)
    : parsedActive.col;
  const minRow = selectionRange
    ? Math.min(selectionRange.startRow, selectionRange.endRow)
    : parsedActive.row;
  const maxRow = selectionRange
    ? Math.max(selectionRange.startRow, selectionRange.endRow)
    : parsedActive.row;

  const isMultiCellRange = selectionRange && (minCol !== maxCol || minRow !== maxRow);

  // Manejo de atajos de teclado globales sobre la cuadrícula de Excel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === "Enter") {
        e.preventDefault();
        onCommitEditing(e.shiftKey ? "none" : "down");
      } else if (e.key === "Tab") {
        e.preventDefault();
        onCommitEditing("right");
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancelEditing();
      }
      return;
    }

    // Seleccionar todo con Ctrl+A o Cmd+A
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      onRangeSelect(
        {
          startCol: 0,
          startRow: 0,
          endCol: totalCols - 1,
          endRow: totalRows - 1,
        },
        "A1"
      );
      return;
    }

    // Borrado / Suprimir de rango o celda activa
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onClearSelection();
      return;
    }

    // Navegación cuando no está editando
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (parsedActive.row > 0) {
        onSelectCell(`${parsedActive.colName}${parsedActive.row}`);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (parsedActive.row < totalRows - 1) {
        onSelectCell(`${parsedActive.colName}${parsedActive.row + 2}`);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (parsedActive.col > 0) {
        const prevColName = colIndexToName(parsedActive.col - 1);
        onSelectCell(`${prevColName}${parsedActive.rowNum}`);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (parsedActive.col < totalCols - 1) {
        const nextColName = colIndexToName(parsedActive.col + 1);
        onSelectCell(`${nextColName}${parsedActive.rowNum}`);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      onStartEditing();
    } else if (e.key === "F2") {
      e.preventDefault();
      onStartEditing();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Escribir directamente sobre la celda activa (como en Excel)
      onChangeEditingValue(e.key);
      onStartEditing();
    }
  };

  const scale = zoom / 100;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-auto bg-white select-none focus:outline-none relative"
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
      }}
    >
      <div className="inline-block min-w-full">
        {/* FILA DE ENCABEZADOS DE COLUMNA (A, B, C...) */}
        <div className="flex sticky top-0 z-30 bg-[#f3f2f1] border-b border-[#c8c6c4]">
          {/* Esquina superior izquierda de Excel (Selector Total) */}
          <button
            type="button"
            onClick={() => {
              containerRef.current?.focus();
              onRangeSelect(
                {
                  startCol: 0,
                  startRow: 0,
                  endCol: totalCols - 1,
                  endRow: totalRows - 1,
                },
                "A1"
              );
            }}
            title="Seleccionar toda la hoja (Ctrl+A)"
            className="w-12 h-6 bg-[#f3f2f1] border-r border-[#c8c6c4] flex items-center justify-center shrink-0 sticky left-0 z-40 hover:bg-[#edebe9] cursor-pointer transition-colors"
          >
            <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-[#8a8886] opacity-60" />
          </button>

          {/* Letras de columna */}
          {Array.from({ length: totalCols }).map((_, colIdx) => {
            const colName = colIndexToName(colIdx);
            const isColInSelection = colIdx >= minCol && colIdx <= maxCol;
            const w = getColWidth(colIdx);

            return (
              <div
                key={colName}
                style={{ width: `${w}px` }}
                className={`h-6 flex items-center justify-center font-mono text-[11px] font-semibold border-r border-[#c8c6c4] shrink-0 transition-colors ${
                  isColInSelection
                    ? "bg-[#dff6dd] text-[#0e6b37] border-b-2 border-b-[#107c41]"
                    : "text-[#595959] hover:bg-[#edebe9]"
                }`}
              >
                {colName}
              </div>
            );
          })}
        </div>

        {/* FILAS DE DATOS DE LA CUADRÍCULA */}
        {Array.from({ length: totalRows }).map((_, rowIdx) => {
          const rowNum = rowIdx + 1;
          const isRowInSelection = rowIdx >= minRow && rowIdx <= maxRow;

          return (
            <div key={rowNum} className="flex">
              {/* Encabezado numérico de fila (1, 2, 3...) */}
              <div
                className={`w-12 h-6 flex items-center justify-center font-mono text-[11px] font-semibold border-r border-b border-[#c8c6c4] shrink-0 sticky left-0 z-20 transition-colors ${
                  isRowInSelection
                    ? "bg-[#dff6dd] text-[#0e6b37] border-r-2 border-r-[#107c41]"
                    : "bg-[#f3f2f1] text-[#595959] hover:bg-[#edebe9]"
                }`}
              >
                {rowNum}
              </div>

              {/* Celdas de la fila */}
              {Array.from({ length: totalCols }).map((_, colIdx) => {
                const colName = colIndexToName(colIdx);
                const cellKey = `${colName}${rowNum}`;
                const cell = data[cellKey];
                const isActive = cellKey === activeCellKey;

                // Verificación de si la celda está dentro del rango seleccionado
                const inRange =
                  colIdx >= minCol && colIdx <= maxCol && rowIdx >= minRow && rowIdx <= maxRow;

                // Bordes exteriores del área seleccionada
                const isTopEdge = inRange && rowIdx === minRow;
                const isBottomEdge = inRange && rowIdx === maxRow;
                const isLeftEdge = inRange && colIdx === minCol;
                const isRightEdge = inRange && colIdx === maxCol;

                const displayValue = cell
                  ? formatCellValue(cell.computed !== undefined ? cell.computed : cell.raw, cell.format)
                  : "";

                const cellWidth = `${getColWidth(colIdx)}px`;

                return (
                  <div
                    key={cellKey}
                    style={{
                      width: cellWidth,
                      backgroundColor: cell?.bg || undefined,
                      color: cell?.color || undefined,
                      fontWeight: cell?.bold ? "700" : undefined,
                      fontStyle: cell?.italic ? "italic" : undefined,
                      textDecoration: cell?.underline ? "underline" : undefined,
                      textAlign: cell?.align || (typeof cell?.computed === "number" ? "right" : "left"),
                    }}
                    onMouseDown={(e) => handleCellMouseDown(colIdx, rowIdx, e)}
                    onMouseEnter={() => handleCellMouseEnter(colIdx, rowIdx)}
                    onDoubleClick={() => {
                      onSelectCell(cellKey);
                      onStartEditing();
                    }}
                    className={`h-6 px-1.5 flex items-center text-xs relative shrink-0 transition-colors ${
                      showGridlines ? "border-r border-b border-[#e1dfdd]" : ""
                    } ${
                      isActive && !isMultiCellRange
                        ? "excel-cell-active bg-white"
                        : inRange
                        ? "bg-[#107c41]/10"
                        : "hover:bg-[#fbf9f6]"
                    } ${
                      isMultiCellRange && inRange
                        ? `${isTopEdge ? "border-t-2 border-t-[#107c41] -mt-[1px]" : ""} ${
                            isBottomEdge ? "border-b-2 border-b-[#107c41]" : ""
                          } ${isLeftEdge ? "border-l-2 border-l-[#107c41] -ml-[1px]" : ""} ${
                            isRightEdge ? "border-r-2 border-r-[#107c41]" : ""
                          }`
                        : ""
                    }`}
                  >
                    {/* Renderizado de celda o input en edición */}
                    {isActive && isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingValue}
                        onChange={(e) => onChangeEditingValue(e.target.value)}
                        onBlur={() => onCommitEditing("none")}
                        className="w-full h-full bg-white text-[#201f1e] font-sans text-xs focus:outline-none border-none p-0 select-text"
                        style={{ textAlign: cell?.align || "left" }}
                      />
                    ) : (
                      <span className="truncate w-full font-sans leading-none pointer-events-none">
                        {displayValue}
                      </span>
                    )}

                    {/* Tirador de autollenado de Excel en la esquina inferior derecha del rango */}
                    {((isActive && !isMultiCellRange) ||
                      (isMultiCellRange && isBottomEdge && isRightEdge)) &&
                      !isEditing && <div className="excel-fill-handle" />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
