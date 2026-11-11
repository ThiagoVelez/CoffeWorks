import React, { useMemo, useRef } from "react";
import { BarChart3, LineChart, PieChart, AreaChart, X, GripHorizontal } from "lucide-react";
import type { ChartConfig, ChartType, Sheet } from "../types";
import { cellKey, formatCellValue } from "../services/formulaEngine";
import { boundsLabel } from "../services/sheetOps";

interface ChartCardProps {
  chart: ChartConfig;
  sheet: Sheet;
  /** Factor de zoom de la hoja (para convertir el arrastre a coordenadas de hoja). */
  scale: number;
  onChange: (changes: { x?: number; y?: number; width?: number; height?: number; type?: string }) => void;
  onRemove: () => void;
}

export const CHART_COLORS = ["#107c41", "#1a73e8", "#f9ab00", "#d93025", "#9334e6", "#00acc1", "#e8710a", "#5f6368"];

interface Series {
  name: string;
  values: number[];
}

export interface ChartData {
  labels: string[];
  series: Series[];
}

/**
 * Interpreta el rango del gráfico: si la primera columna es de texto se usa
 * como etiquetas y, si la primera fila es de texto, como nombres de las series.
 */
export function chartDataOf(sheet: Sheet, chart: ChartConfig): ChartData {
  const { r1, c1, r2, c2 } = chart.range;
  const at = (c: number, r: number) => sheet.data[cellKey(c, r)];
  const isText = (c: number, r: number) => typeof at(c, r)?.computed === "string" && at(c, r)?.computed !== "";

  let labelColumn = false;
  for (let r = r1; r <= r2; r++) if (isText(c1, r)) labelColumn = true;
  if (c1 === c2) labelColumn = false;
  let headerRow = false;
  for (let c = c1 + (labelColumn ? 1 : 0); c <= c2; c++) if (isText(c, r1)) headerRow = true;
  if (r1 === r2) headerRow = false;

  const firstRow = r1 + (headerRow ? 1 : 0);
  const firstCol = c1 + (labelColumn ? 1 : 0);
  const labels: string[] = [];
  for (let r = firstRow; r <= r2; r++) {
    labels.push(labelColumn ? formatCellValue(at(c1, r)?.computed, at(c1, r)) || String(r + 1) : String(r - firstRow + 1));
  }
  const series: Series[] = [];
  for (let c = firstCol; c <= c2; c++) {
    const values: number[] = [];
    let hasNumbers = false;
    for (let r = firstRow; r <= r2; r++) {
      const value = at(c, r)?.computed;
      if (typeof value === "number") hasNumbers = true;
      values.push(typeof value === "number" ? value : 0);
    }
    // Las columnas sin ningún número (notas, textos) no forman una serie
    if (!hasNumbers) continue;
    series.push({
      name: headerRow ? String(at(c, r1)?.computed ?? "") || `Serie ${c - firstCol + 1}` : `Serie ${c - firstCol + 1}`,
      values,
    });
  }
  return { labels, series };
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString("es-ES", { maximumFractionDigits: 1 })} mil M`;
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e4) return `${(value / 1e3).toLocaleString("es-ES", { maximumFractionDigits: 1 })} k`;
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/** Límites "redondos" del eje de valores. */
function niceScale(min: number, max: number): { min: number; max: number; step: number } {
  if (min === max) max = min + 1;
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  const rough = (high - low) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) || rough;
  return { min: Math.floor(low / step) * step, max: Math.ceil(high / step) * step, step };
}

/** Dibujo SVG del gráfico (también se usa en la vista de impresión). */
export const ChartSvg: React.FC<{ type: ChartType; data: ChartData; width: number; height: number }> = ({
  type,
  data,
  width,
  height,
}) => {
  const { labels, series } = data;
  if (series.length === 0 || labels.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-[#747775]" style={{ width, height }}>
        Selecciona un rango con números para ver el gráfico
      </div>
    );
  }

  if (type === "pie") {
    const values = series[0].values.map((v) => Math.max(0, v));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const radius = Math.min(width * 0.32, height * 0.42);
    const cx = radius + 16;
    const cy = height / 2;
    let angle = -Math.PI / 2;
    return (
      <svg width={width} height={height} className="block">
        {values.map((value, i) => {
          const sweep = (value / total) * Math.PI * 2;
          const start = angle;
          angle += sweep;
          if (sweep <= 0) return null;
          const color = CHART_COLORS[i % CHART_COLORS.length];
          if (sweep >= Math.PI * 2 - 1e-6) {
            return <circle key={i} cx={cx} cy={cy} r={radius} fill={color} />;
          }
          const x1 = cx + radius * Math.cos(start);
          const y1 = cy + radius * Math.sin(start);
          const x2 = cx + radius * Math.cos(angle);
          const y2 = cy + radius * Math.sin(angle);
          return (
            <path
              key={i}
              d={`M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`}
              fill={color}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}
        {labels.slice(0, 10).map((label, i) => (
          <g key={i} transform={`translate(${cx + radius + 20}, ${24 + i * 18})`}>
            <rect width={10} height={10} rx={2} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            <text x={16} y={9} fontSize={11} fill="#444746">
              {label.length > 18 ? `${label.slice(0, 17)}…` : label} · {((values[i] / total) * 100).toFixed(1)}%
            </text>
          </g>
        ))}
      </svg>
    );
  }

  const all = series.flatMap((s) => s.values);
  const scale = niceScale(Math.min(...all), Math.max(...all));
  const padding = { left: 56, right: 12, top: 10, bottom: series.length > 1 ? 44 : 26 };
  const plotWidth = Math.max(10, width - padding.left - padding.right);
  const plotHeight = Math.max(10, height - padding.top - padding.bottom);
  const yOf = (value: number) => padding.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
  const band = plotWidth / labels.length;
  const ticks: number[] = [];
  for (let v = scale.min; v <= scale.max + scale.step / 2; v += scale.step) ticks.push(v);
  const labelEvery = Math.ceil(labels.length / Math.max(1, Math.floor(plotWidth / 60)));

  return (
    <svg width={width} height={height} className="block">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={padding.left} x2={padding.left + plotWidth} y1={yOf(tick)} y2={yOf(tick)} stroke={tick === 0 ? "#9aa0a6" : "#e8eaed"} />
          <text x={padding.left - 6} y={yOf(tick) + 3} fontSize={10} textAnchor="end" fill="#5f6368">
            {compact(tick)}
          </text>
        </g>
      ))}

      {type === "bar" &&
        series.map((s, si) => {
          const barWidth = (band * 0.72) / series.length;
          return s.values.map((value, i) => {
            const x = padding.left + i * band + band * 0.14 + si * barWidth;
            const y = Math.min(yOf(value), yOf(0));
            return (
              <rect
                key={`${si}-${i}`}
                x={x}
                y={y}
                width={Math.max(1, barWidth - 1)}
                height={Math.max(1, Math.abs(yOf(value) - yOf(0)))}
                fill={CHART_COLORS[si % CHART_COLORS.length]}
                rx={1.5}
              >
                <title>{`${s.name} · ${labels[i]}: ${value.toLocaleString("es-ES")}`}</title>
              </rect>
            );
          });
        })}

      {(type === "line" || type === "area") &&
        series.map((s, si) => {
          const color = CHART_COLORS[si % CHART_COLORS.length];
          const points = s.values.map((value, i) => [padding.left + i * band + band / 2, yOf(value)] as const);
          const line = points.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <g key={si}>
              {type === "area" && points.length > 1 && (
                <polygon
                  points={`${points[0][0]},${yOf(0)} ${line} ${points[points.length - 1][0]},${yOf(0)}`}
                  fill={color}
                  opacity={0.18}
                />
              )}
              <polyline points={line} fill="none" stroke={color} strokeWidth={2} />
              {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={3} fill={color} stroke="#ffffff" strokeWidth={1}>
                  <title>{`${s.name} · ${labels[i]}: ${s.values[i].toLocaleString("es-ES")}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

      {labels.map((label, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            x={padding.left + i * band + band / 2}
            y={padding.top + plotHeight + 14}
            fontSize={10}
            textAnchor="middle"
            fill="#5f6368"
          >
            {label.length > 12 ? `${label.slice(0, 11)}…` : label}
          </text>
        ) : null
      )}

      {series.length > 1 &&
        series.map((s, si) => (
          <g key={si} transform={`translate(${padding.left + si * Math.min(130, plotWidth / series.length)}, ${height - 14})`}>
            <rect width={10} height={10} rx={2} fill={CHART_COLORS[si % CHART_COLORS.length]} />
            <text x={14} y={9} fontSize={10} fill="#444746">
              {s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name}
            </text>
          </g>
        ))}
    </svg>
  );
};

const TYPE_BUTTONS: Array<{ type: ChartType; title: string; Icon: React.ComponentType<{ size?: number }> }> = [
  { type: "bar", title: "Columnas", Icon: BarChart3 },
  { type: "line", title: "Líneas", Icon: LineChart },
  { type: "area", title: "Áreas", Icon: AreaChart },
  { type: "pie", title: "Circular", Icon: PieChart },
];

/** Tarjeta flotante con un gráfico: se puede mover, redimensionar y cambiar de tipo. */
export const ChartCard: React.FC<ChartCardProps> = ({ chart, sheet, scale, onChange, onRemove }) => {
  const data = useMemo(() => chartDataOf(sheet, chart), [sheet, chart]);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; resize: boolean } | null>(null);

  const beginDrag = (e: React.MouseEvent, resize: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: resize ? chart.width : chart.x,
      originY: resize ? chart.height : chart.y,
      resize,
    };
    const handleMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / scale;
      const dy = (event.clientY - drag.startY) / scale;
      if (drag.resize) {
        onChange({ width: Math.max(260, Math.round(drag.originX + dx)), height: Math.max(180, Math.round(drag.originY + dy)) });
      } else {
        onChange({ x: Math.max(48, Math.round(drag.originX + dx)), y: Math.max(24, Math.round(drag.originY + dy)) });
      }
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      className="absolute z-[9] bg-white rounded-lg shadow-lg border border-[#dadce0] flex flex-col cursor-default"
      style={{ left: chart.x, top: chart.y, width: chart.width, height: chart.height }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between gap-2 px-2 py-1 border-b border-[#e8eaed] cursor-move bg-[#f8f9fa] rounded-t-lg"
        onMouseDown={(e) => beginDrag(e, false)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal size={13} className="text-[#9aa0a6] shrink-0" />
          <span className="text-xs font-semibold text-[#1f1f1f] truncate">{chart.title}</span>
          <span className="text-[10px] font-mono text-[#747775] shrink-0">{boundsLabel(chart.range)}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {TYPE_BUTTONS.map(({ type, title, Icon }) => (
            <button
              key={type}
              type="button"
              title={title}
              onClick={() => onChange({ type })}
              className={`p-1 rounded ${chart.type === type ? "bg-[#d3e3fd] text-[#0b57d0]" : "text-[#5f6368] hover:bg-[#e8eaed]"}`}
            >
              <Icon size={13} />
            </button>
          ))}
          <button
            type="button"
            title="Eliminar gráfico"
            onClick={onRemove}
            className="p-1 rounded text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#b3261e] ml-1"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-1">
        <ChartSvg type={chart.type} data={data} width={chart.width - 10} height={chart.height - 40} />
      </div>
      <div
        title="Cambiar tamaño"
        className="absolute right-0 bottom-0 w-3.5 h-3.5 cursor-nwse-resize"
        onMouseDown={(e) => beginDrag(e, true)}
      >
        <div className="absolute right-1 bottom-1 w-2 h-2 border-r-2 border-b-2 border-[#9aa0a6]" />
      </div>
    </div>
  );
};
