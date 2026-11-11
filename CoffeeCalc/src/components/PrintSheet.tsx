import React from "react";
import type { Sheet } from "../types";
import { DEFAULT_COL_WIDTH } from "../types";
import { cellKey, colIndexToName, formatCellValue } from "../services/formulaEngine";
import { conditionalStyles, hiddenRows, mergeAt } from "../services/sheetOps";
import { usedBounds } from "../services/sheetVault";
import { ChartSvg, chartDataOf } from "./ChartCard";

/** Versión imprimible de la hoja activa: una tabla con el área usada y sus gráficos. */
export const PrintSheet: React.FC<{ sheet: Sheet; title: string; showGridlines: boolean }> = ({
  sheet,
  title,
  showGridlines,
}) => {
  const bounds = usedBounds(sheet);
  const hidden = hiddenRows(sheet);
  const conditional = conditionalStyles(sheet);
  const rows: number[] = [];
  const cols: number[] = [];
  if (bounds) {
    for (let r = 0; r <= bounds.r2; r++) if (!hidden.has(r)) rows.push(r);
    for (let c = 0; c <= bounds.c2; c++) cols.push(c);
  }
  const border = showGridlines ? "1px solid #c4c7c5" : "none";

  return (
    <div className="calc-print-view">
      <h1 style={{ fontSize: "13pt", fontWeight: 700, margin: "0 0 8pt" }}>
        {title} — {sheet.name}
      </h1>
      {bounds ? (
        <table style={{ borderCollapse: "collapse", fontSize: "9pt", fontFamily: "Arial, sans-serif" }}>
          <colgroup>
            {cols.map((c) => (
              <col key={c} style={{ width: sheet.colWidths?.[colIndexToName(c)] || DEFAULT_COL_WIDTH }} />
            ))}
          </colgroup>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                {cols.map((c) => {
                  const merge = mergeAt(sheet, c, r);
                  if (merge && (merge.c1 !== c || merge.r1 !== r)) return null;
                  const key = cellKey(c, r);
                  const cell = sheet.data[key];
                  const extra = conditional.get(key);
                  const numeric = typeof cell?.computed === "number";
                  return (
                    <td
                      key={c}
                      colSpan={merge ? merge.c2 - merge.c1 + 1 : undefined}
                      rowSpan={merge ? merge.r2 - merge.r1 + 1 : undefined}
                      style={{
                        border,
                        borderTop: cell?.borders?.top ? "1px solid #000" : border,
                        borderBottom: cell?.borders?.bottom ? "1px solid #000" : border,
                        borderLeft: cell?.borders?.left ? "1px solid #000" : border,
                        borderRight: cell?.borders?.right ? "1px solid #000" : border,
                        padding: "2pt 4pt",
                        backgroundColor: extra?.bg || cell?.bg,
                        color: extra?.color || cell?.color,
                        fontWeight: cell?.bold ? 700 : undefined,
                        fontStyle: cell?.italic ? "italic" : undefined,
                        textDecoration: cell?.underline ? "underline" : cell?.strike ? "line-through" : undefined,
                        textAlign: cell?.align || (numeric ? "right" : "left"),
                        fontFamily: cell?.fontFamily,
                        fontSize: cell?.fontSize ? `${cell.fontSize * 0.9}pt` : undefined,
                        whiteSpace: cell?.wrapText ? "pre-wrap" : "nowrap",
                        verticalAlign: cell?.valign || "bottom",
                      }}
                    >
                      {cell ? formatCellValue(cell.computed, cell) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: "10pt" }}>La hoja está vacía.</p>
      )}

      {(sheet.charts || []).map((chart) => (
        <div key={chart.id} style={{ marginTop: "14pt", breakInside: "avoid" }}>
          <div style={{ fontSize: "10pt", fontWeight: 700, marginBottom: "4pt" }}>{chart.title}</div>
          <ChartSvg type={chart.type} data={chartDataOf(sheet, chart)} width={560} height={280} />
        </div>
      ))}
    </div>
  );
};
