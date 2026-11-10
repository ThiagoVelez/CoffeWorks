import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Undo2,
  Redo2,
  Printer,
  Paintbrush,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  PaintBucket,
  Grid3x3,
  TableCellsMerge,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  WrapText,
  Link,
  MessageSquarePlus,
  BarChart3,
  Filter,
  Sigma,
  Check,
} from "lucide-react";
import type { CellData, CellFormat } from "../types";

export type BorderPreset = "all" | "outer" | "bottom" | "none";

interface GoogleSheetsToolbarProps {
  /** Celda activa: su formato se refleja en los botones. */
  active: CellData | undefined;
  readOnly: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  painterActive: boolean;
  onTogglePainter: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onStyle: (patch: Partial<CellData>) => void;
  onToggle: (key: "bold" | "italic" | "underline" | "strike" | "wrapText") => void;
  onDecimals: (delta: number) => void;
  onBorders: (preset: BorderPreset) => void;
  onMerge: () => void;
  isMerged: boolean;
  onInsertLink: () => void;
  onInsertNote: () => void;
  onInsertChart: () => void;
  onToggleFilter: () => void;
  isFilterActive: boolean;
  onInsertFunction: (name: string) => void;
  onOpenCommandSearch: () => void;
  showFormulaBar: boolean;
  onToggleFormulaBar: () => void;
}

const FONTS = ["Arial", "Calibri", "Cambria", "Georgia", "Times New Roman", "Verdana", "Courier New", "Hanken Grotesk"];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

const FORMATS: Array<{ format: CellFormat; label: string; sample: string }> = [
  { format: "general", label: "Automático", sample: "" },
  { format: "text", label: "Texto sin formato", sample: "" },
  { format: "number", label: "Número", sample: "1.000,12" },
  { format: "percent", label: "Porcentaje", sample: "10,12%" },
  { format: "currency", label: "Moneda", sample: "$ 1.000" },
  { format: "date", label: "Fecha", sample: "26/09/2026" },
];

const CURRENCIES = [
  { code: "COP", label: "Peso colombiano ($)" },
  { code: "USD", label: "Dólar (US$)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "MXN", label: "Peso mexicano" },
];

export const PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff",
  "#9900ff", "#ff00ff", "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3",
  "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc", "#cc4125", "#e06666", "#f6b26b", "#ffd966",
  "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0", "#107c41", "#0e6b37",
  "#dff6dd", "#1a73e8", "#d3e3fd", "#b3261e", "#fce8e6", "#f9a825", "#fff8e1", "#6f4e37",
];

type DropdownId = "zoom" | "format" | "font" | "size" | "color" | "fill" | "borders" | "align" | "valign" | "functions";

const ToolButton: React.FC<{
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, active, disabled, children }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`p-1.5 rounded-full transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${
      active ? "bg-[#c2e7ff] text-[#001d35]" : "text-[#444746] hover:bg-gray-200/70"
    }`}
  >
    {children}
  </button>
);

const Separator = () => <div className="h-4 w-px bg-gray-300 mx-0.5 shrink-0" />;

export const GoogleSheetsToolbar: React.FC<GoogleSheetsToolbarProps> = ({
  active,
  readOnly,
  onUndo,
  onRedo,
  onPrint,
  painterActive,
  onTogglePainter,
  zoom,
  onZoomChange,
  onStyle,
  onToggle,
  onDecimals,
  onBorders,
  onMerge,
  isMerged,
  onInsertLink,
  onInsertNote,
  onInsertChart,
  onToggleFilter,
  isFilterActive,
  onInsertFunction,
  onOpenCommandSearch,
  showFormulaBar,
  onToggleFormulaBar,
}) => {
  const [open, setOpen] = useState<DropdownId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = (id: DropdownId) => setOpen((current) => (current === id ? null : id));
  const apply = (patch: Partial<CellData>) => {
    setOpen(null);
    onStyle(patch);
  };

  const fontSize = active?.fontSize || 10;
  const fontFamily = active?.fontFamily || "Predeterminada";
  const format = active?.format || "general";
  const align = active?.align;
  const AlignIcon = align === "center" ? AlignCenter : align === "right" ? AlignRight : AlignLeft;
  const VAlignIcon =
    active?.valign === "top"
      ? AlignVerticalJustifyStart
      : active?.valign === "middle"
      ? AlignVerticalJustifyCenter
      : AlignVerticalJustifyEnd;

  const dropdownClass =
    "absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50";
  const optionClass = (selected: boolean) =>
    `w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] flex items-center justify-between gap-4 ${
      selected ? "text-[#0F9D58] font-semibold" : "text-[#444746]"
    }`;

  const colorGrid = (onPick: (color: string) => void, clearLabel: string, onClear: () => void) => (
    <div className={`${dropdownClass} p-2 w-[196px]`}>
      <div className="grid grid-cols-8 gap-1">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(color)}
            style={{ backgroundColor: color }}
            className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-[11px] text-[#444746]">
        <button type="button" onClick={onClear} className="hover:text-[#0b57d0]">
          {clearLabel}
        </button>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span>Otro</span>
          <input
            type="color"
            onChange={(e) => onPick(e.target.value)}
            className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="w-full px-4 py-1 flex items-center justify-between select-none bg-white print:hidden"
    >
      <div className="bg-[#edf2fa] rounded-full px-3 py-1 flex items-center gap-1 shadow-xs text-[#444746] text-xs flex-wrap max-w-full">
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs text-[#444746] shadow-xs cursor-pointer mr-1"
          title="Buscar en los menús (Alt+/)"
        >
          <Search size={14} />
          <span className="font-medium text-[11px]">Menús</span>
        </button>

        <ToolButton title="Deshacer (Ctrl+Z)" onClick={onUndo} disabled={readOnly}>
          <Undo2 size={15} />
        </ToolButton>
        <ToolButton title="Rehacer (Ctrl+Y)" onClick={onRedo} disabled={readOnly}>
          <Redo2 size={15} />
        </ToolButton>
        <ToolButton title="Imprimir (Ctrl+P)" onClick={onPrint}>
          <Printer size={15} />
        </ToolButton>
        <ToolButton
          title="Copiar formato: pulsa y después selecciona las celdas de destino"
          onClick={onTogglePainter}
          active={painterActive}
          disabled={readOnly}
        >
          <Paintbrush size={15} />
        </ToolButton>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggle("zoom")}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium cursor-pointer"
            title="Zoom"
          >
            <span>{zoom}%</span>
            <ChevronDown size={12} />
          </button>
          {open === "zoom" && (
            <div className={`${dropdownClass} min-w-[90px]`}>
              {[50, 75, 90, 100, 125, 150, 200].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    onZoomChange(z);
                    setOpen(null);
                  }}
                  className={optionClass(zoom === z)}
                >
                  <span>{z}%</span>
                  {zoom === z && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Formatos numéricos */}
        <ToolButton title="Formato de moneda" onClick={() => apply({ format: "currency" })} active={format === "currency"} disabled={readOnly}>
          <span className="font-semibold text-[13px] leading-none w-[15px] inline-block">$</span>
        </ToolButton>
        <ToolButton title="Formato de porcentaje" onClick={() => apply({ format: "percent" })} active={format === "percent"} disabled={readOnly}>
          <span className="font-semibold text-[13px] leading-none w-[15px] inline-block">%</span>
        </ToolButton>
        <ToolButton title="Quitar un decimal" onClick={() => onDecimals(-1)} disabled={readOnly}>
          <span className="font-mono text-[11px] font-semibold leading-none">.0</span>
        </ToolButton>
        <ToolButton title="Añadir un decimal" onClick={() => onDecimals(1)} disabled={readOnly}>
          <span className="font-mono text-[11px] font-semibold leading-none">.00</span>
        </ToolButton>

        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => toggle("format")}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium cursor-pointer disabled:opacity-35"
            title="Más formatos"
          >
            <span>123</span>
            <ChevronDown size={12} />
          </button>
          {open === "format" && (
            <div className={`${dropdownClass} min-w-[230px]`}>
              {FORMATS.map((item) => (
                <button key={item.format} type="button" onClick={() => apply({ format: item.format })} className={optionClass(format === item.format)}>
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] text-[#747775]">{item.sample}</span>
                </button>
              ))}
              <div className="h-px bg-gray-200 my-1" />
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[#747775] font-semibold">Moneda</div>
              {CURRENCIES.map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => apply({ format: "currency", currency: currency.code })}
                  className={optionClass(format === "currency" && (active?.currency || "COP") === currency.code)}
                >
                  <span>{currency.label}</span>
                  <span className="font-mono text-[10px] text-[#747775]">{currency.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Fuente */}
        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => toggle("font")}
            className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium cursor-pointer w-[96px] disabled:opacity-35"
            title="Fuente"
          >
            <span className="truncate">{fontFamily}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>
          {open === "font" && (
            <div className={`${dropdownClass} min-w-[180px]`}>
              <button type="button" onClick={() => apply({ fontFamily: undefined })} className={optionClass(!active?.fontFamily)}>
                <span>Predeterminada</span>
              </button>
              {FONTS.map((font) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => apply({ fontFamily: font })}
                  style={{ fontFamily: font }}
                  className={optionClass(active?.fontFamily === font)}
                >
                  <span>{font}</span>
                  {active?.fontFamily === font && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center relative">
          <ToolButton title="Reducir tamaño de fuente" disabled={readOnly} onClick={() => onStyle({ fontSize: Math.max(6, fontSize - 1) })}>
            <Minus size={12} />
          </ToolButton>
          <button
            type="button"
            disabled={readOnly}
            title="Tamaño de fuente"
            onClick={() => toggle("size")}
            className="w-8 text-center text-xs font-medium text-[#1f1f1f] border border-[#c4c7c5] rounded py-0.5 hover:bg-white disabled:opacity-35"
          >
            {fontSize}
          </button>
          <ToolButton title="Aumentar tamaño de fuente" disabled={readOnly} onClick={() => onStyle({ fontSize: Math.min(72, fontSize + 1) })}>
            <Plus size={12} />
          </ToolButton>
          {open === "size" && (
            <div className={`${dropdownClass} left-6 min-w-[56px] max-h-64 overflow-y-auto`}>
              {FONT_SIZES.map((size) => (
                <button key={size} type="button" onClick={() => apply({ fontSize: size })} className={`${optionClass(fontSize === size)} justify-center`}>
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <ToolButton title="Negrita (Ctrl+B)" onClick={() => onToggle("bold")} active={Boolean(active?.bold)} disabled={readOnly}>
          <Bold size={15} />
        </ToolButton>
        <ToolButton title="Cursiva (Ctrl+I)" onClick={() => onToggle("italic")} active={Boolean(active?.italic)} disabled={readOnly}>
          <Italic size={15} />
        </ToolButton>
        <ToolButton title="Subrayado (Ctrl+U)" onClick={() => onToggle("underline")} active={Boolean(active?.underline)} disabled={readOnly}>
          <Underline size={15} />
        </ToolButton>
        <ToolButton title="Tachado" onClick={() => onToggle("strike")} active={Boolean(active?.strike)} disabled={readOnly}>
          <Strikethrough size={15} />
        </ToolButton>

        <div className="relative">
          <ToolButton title="Color del texto" onClick={() => toggle("color")} disabled={readOnly}>
            <span className="flex flex-col items-center w-[15px]">
              <span className="font-bold text-xs leading-none">A</span>
              <span className="w-3.5 h-[3px] rounded-full mt-0.5" style={{ backgroundColor: active?.color || "#1f1f1f" }} />
            </span>
          </ToolButton>
          {open === "color" &&
            colorGrid(
              (color) => apply({ color }),
              "Color automático",
              () => apply({ color: undefined })
            )}
        </div>

        <div className="relative">
          <ToolButton title="Color de relleno" onClick={() => toggle("fill")} disabled={readOnly}>
            <span className="flex flex-col items-center w-[15px]">
              <PaintBucket size={13} />
              <span
                className="w-3.5 h-[3px] rounded-full mt-px border border-black/10"
                style={{ backgroundColor: active?.bg || "#ffffff" }}
              />
            </span>
          </ToolButton>
          {open === "fill" &&
            colorGrid(
              (bg) => apply({ bg }),
              "Sin relleno",
              () => apply({ bg: undefined })
            )}
        </div>

        <div className="relative">
          <ToolButton title="Bordes" onClick={() => toggle("borders")} disabled={readOnly}>
            <Grid3x3 size={15} />
          </ToolButton>
          {open === "borders" && (
            <div className={`${dropdownClass} min-w-[170px]`}>
              {(
                [
                  ["all", "Todos los bordes"],
                  ["outer", "Borde exterior"],
                  ["bottom", "Borde inferior"],
                  ["none", "Sin bordes"],
                ] as Array<[BorderPreset, string]>
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    onBorders(preset);
                  }}
                  className={optionClass(false)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolButton
          title={isMerged ? "Separar celdas" : "Combinar celdas"}
          onClick={onMerge}
          active={isMerged}
          disabled={readOnly}
        >
          <TableCellsMerge size={15} />
        </ToolButton>

        <Separator />

        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => toggle("align")}
            className="p-1.5 rounded-full hover:bg-gray-200/70 transition-colors flex items-center gap-0.5 disabled:opacity-35"
            title="Alineación horizontal"
          >
            <AlignIcon size={15} />
            <ChevronDown size={11} />
          </button>
          {open === "align" && (
            <div className={`${dropdownClass} !p-1 flex items-center gap-1`}>
              {(
                [
                  ["left", "Izquierda", AlignLeft],
                  ["center", "Centro", AlignCenter],
                  ["right", "Derecha", AlignRight],
                ] as const
              ).map(([value, title, Icon]) => (
                <ToolButton key={value} title={title} active={align === value} onClick={() => apply({ align: value })}>
                  <Icon size={14} />
                </ToolButton>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => toggle("valign")}
            className="p-1.5 rounded-full hover:bg-gray-200/70 transition-colors flex items-center gap-0.5 disabled:opacity-35"
            title="Alineación vertical"
          >
            <VAlignIcon size={15} />
            <ChevronDown size={11} />
          </button>
          {open === "valign" && (
            <div className={`${dropdownClass} !p-1 flex items-center gap-1`}>
              {(
                [
                  ["top", "Arriba", AlignVerticalJustifyStart],
                  ["middle", "Centro", AlignVerticalJustifyCenter],
                  ["bottom", "Abajo", AlignVerticalJustifyEnd],
                ] as const
              ).map(([value, title, Icon]) => (
                <ToolButton
                  key={value}
                  title={title}
                  active={(active?.valign || "bottom") === value}
                  onClick={() => apply({ valign: value })}
                >
                  <Icon size={14} />
                </ToolButton>
              ))}
            </div>
          )}
        </div>

        <ToolButton title="Ajustar texto a la celda" onClick={() => onToggle("wrapText")} active={Boolean(active?.wrapText)} disabled={readOnly}>
          <WrapText size={15} />
        </ToolButton>

        <Separator />

        <ToolButton title="Insertar enlace (Ctrl+K)" onClick={onInsertLink} active={Boolean(active?.link)} disabled={readOnly}>
          <Link size={15} />
        </ToolButton>
        <ToolButton title="Añadir o editar un comentario" onClick={onInsertNote} active={Boolean(active?.note)} disabled={readOnly}>
          <MessageSquarePlus size={15} />
        </ToolButton>
        <ToolButton title="Insertar gráfico" onClick={onInsertChart} disabled={readOnly}>
          <BarChart3 size={15} />
        </ToolButton>
        <ToolButton title={isFilterActive ? "Quitar el filtro" : "Crear un filtro"} onClick={onToggleFilter} active={isFilterActive}>
          <Filter size={15} />
        </ToolButton>

        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => toggle("functions")}
            className="p-1.5 rounded-full hover:bg-gray-200/70 transition-colors flex items-center gap-0.5 disabled:opacity-35"
            title="Funciones"
          >
            <Sigma size={15} />
            <ChevronDown size={11} />
          </button>
          {open === "functions" && (
            <div className={`${dropdownClass} left-auto right-0 min-w-[150px]`}>
              {["SUMA", "PROMEDIO", "CONTAR", "MAX", "MIN"].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    onInsertFunction(name);
                  }}
                  className={optionClass(false)}
                >
                  <span className="font-mono">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleFormulaBar}
        className="p-1.5 rounded-full hover:bg-gray-100 text-[#444746] transition-colors shrink-0 ml-2"
        title={showFormulaBar ? "Ocultar la barra de fórmulas" : "Mostrar la barra de fórmulas"}
      >
        {showFormulaBar ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
    </div>
  );
};
