import React, { useState } from "react";
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
  Strikethrough,
  PaintBucket,
  Grid,
  Merge,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  WrapText,
  Link,
  MessageSquarePlus,
  BarChart3,
  Filter,
  Sigma,
  Check,
} from "lucide-react";
import type { CellFormat } from "../types";

interface GoogleSheetsToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  onFormatPainter: () => void;
  isFormatPainterActive: boolean;
  zoom: number;
  onZoomChange: (z: number) => void;
  onSetFormat: (format: CellFormat) => void;
  onSetFontFamily: (font: string) => void;
  onSetFontSize: (size: number) => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onSetTextColor: (color: string) => void;
  onSetBgColor: (color: string) => void;
  onToggleBorders: () => void;
  onMergeAndCenter: () => void;
  onSetAlign: (align: "left" | "center" | "right") => void;
  onToggleWrapText: () => void;
  onInsertChart: () => void;
  onToggleFilter: () => void;
  isFilterActive: boolean;
  onInsertAutoSum: () => void;
  onAdjustDecimals: (delta: number) => void;
}

export const GoogleSheetsToolbar: React.FC<GoogleSheetsToolbarProps> = ({
  onUndo,
  onRedo,
  onPrint,
  onFormatPainter,
  isFormatPainterActive,
  zoom,
  onZoomChange,
  onSetFormat,
  onSetFontFamily,
  onSetFontSize,
  onToggleBold,
  onToggleItalic,
  onSetTextColor,
  onSetBgColor,
  onToggleBorders,
  onMergeAndCenter,
  onSetAlign,
  onToggleWrapText,
  onInsertChart,
  onToggleFilter,
  isFilterActive,
  onInsertAutoSum,
  onAdjustDecimals,
}) => {
  const [fontSize, setFontSize] = useState<number>(10);
  const [fontFamily, setFontFamily] = useState<string>("Predet...");

  // Estados de dropdowns
  const [zoomOpen, setZoomOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [fnOpen, setFnOpen] = useState(false);

  const handleFontSizeChange = (delta: number) => {
    const next = Math.max(6, Math.min(48, fontSize + delta));
    setFontSize(next);
    onSetFontSize(next);
  };

  const handleFontSelect = (f: string) => {
    setFontFamily(f);
    setFontOpen(false);
    onSetFontFamily(f === "Predet..." ? "Arial" : f);
  };

  return (
    <div className="w-full px-4 py-1 flex items-center justify-between select-none bg-white">
      {/* Contenedor tipo píldora flotante de Google Sheets */}
      <div className="bg-[#edf2fa] rounded-full px-3 py-1 flex items-center gap-1 shadow-xs text-[#444746] text-xs flex-wrap max-w-full">
        {/* 1. Botón de búsqueda de menús (Menús) */}
        <button
          type="button"
          onClick={() => {}}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs text-[#444746] shadow-xs cursor-pointer mr-1"
          title="Buscar en los menús (Alt+/)"
        >
          <Search size={14} className="text-[#444746]" />
          <span className="font-medium text-[11px]">Menús</span>
        </button>

        {/* 2. Acciones de historial e impresión */}
        <button
          type="button"
          onClick={onUndo}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>

        <button
          type="button"
          onClick={onRedo}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Rehacer (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Imprimir (Ctrl+P)"
        >
          <Printer size={15} />
        </button>

        <button
          type="button"
          onClick={onFormatPainter}
          className={`p-1.5 rounded-full transition-colors ${
            isFormatPainterActive
              ? "bg-[#c2e7ff] text-[#001d35]"
              : "hover:bg-gray-200/70 text-[#444746]"
          }`}
          title="Copiar formato"
        >
          <Paintbrush size={15} />
        </button>

        {/* 3. Selector de Zoom */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setZoomOpen(!zoomOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer"
            title="Zoom"
          >
            <span>{zoom}%</span>
            <ChevronDown size={12} />
          </button>
          {zoomOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[90px]">
              {[50, 75, 90, 100, 125, 150, 200].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    onZoomChange(z);
                    setZoomOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    zoom === z ? "font-bold text-[#0F9D58]" : "text-[#444746]"
                  }`}
                >
                  <span>{z}%</span>
                  {zoom === z && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 4. Formatos numéricos rápidos de Google Sheets: $, %, .0, .00, 123 */}
        <button
          type="button"
          onClick={() => onSetFormat("currency")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-bold text-xs"
          title="Formatear como moneda ($)"
        >
          $
        </button>

        <button
          type="button"
          onClick={() => onSetFormat("percent")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-bold text-xs"
          title="Formatear como porcentaje (%)"
        >
          %
        </button>

        <button
          type="button"
          onClick={() => onAdjustDecimals(-1)}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-mono text-[11px] font-bold"
          title="Reducir decimales (.0)"
        >
          .0
        </button>

        <button
          type="button"
          onClick={() => onAdjustDecimals(1)}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-mono text-[11px] font-bold"
          title="Aumentar decimales (.00)"
        >
          .00
        </button>

        {/* Más formatos (123) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFormatOpen(!formatOpen)}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] font-mono font-bold text-xs"
            title="Más formatos (123)"
          >
            <span>123</span>
            <ChevronDown size={11} />
          </button>
          {formatOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
              {[
                { id: "text", label: "Texto sin formato" },
                { id: "number", label: "Número" },
                { id: "currency", label: "Moneda ($)" },
                { id: "percent", label: "Porcentaje (%)" },
                { id: "date", label: "Fecha" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onSetFormat(f.id as CellFormat);
                    setFormatOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f]"
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 5. Selector de Fuente */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFontOpen(!fontOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer max-w-[90px] truncate"
            title="Fuente"
          >
            <span className="truncate">{fontFamily}</span>
            <ChevronDown size={11} />
          </button>
          {fontOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
              {["Predet...", "Arial", "Roboto", "Georgia", "JetBrains Mono"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFontSelect(f)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f]"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 6. Tamaño de fuente: [-] 10 [+] */}
        <div className="flex items-center bg-transparent rounded-full px-1">
          <button
            type="button"
            onClick={() => handleFontSizeChange(-1)}
            className="p-1 rounded-full hover:bg-gray-200/70 text-[#444746]"
            title="Reducir tamaño"
          >
            <Minus size={12} />
          </button>
          <span className="w-6 text-center text-xs font-medium text-[#1f1f1f]">
            {fontSize}
          </span>
          <button
            type="button"
            onClick={() => handleFontSizeChange(1)}
            className="p-1 rounded-full hover:bg-gray-200/70 text-[#444746]"
            title="Aumentar tamaño"
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 7. Estilos de texto: B, I, S, Color texto, Color relleno */}
        <button
          type="button"
          onClick={onToggleBold}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Negrita (Ctrl+B)"
        >
          <Bold size={15} />
        </button>

        <button
          type="button"
          onClick={onToggleItalic}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Cursiva (Ctrl+I)"
        >
          <Italic size={15} />
        </button>

        <button
          type="button"
          onClick={() => {}}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Tachado"
        >
          <Strikethrough size={15} />
        </button>

        <button
          type="button"
          onClick={() => {
            const color = window.prompt("Color de texto (ej: #0f9d58 o #000000):", "#0f9d58");
            if (color) onSetTextColor(color);
          }}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex flex-col items-center"
          title="Color de texto"
        >
          <span className="font-bold text-xs leading-none">A</span>
          <span className="w-3 h-0.5 bg-[#1f1f1f] rounded-full mt-0.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            const color = window.prompt("Color de relleno de celda (ej: #dff6dd o #fef3c7):", "#dff6dd");
            if (color) onSetBgColor(color);
          }}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Color de relleno"
        >
          <PaintBucket size={15} />
        </button>

        {/* 8. Bordes y Combinar celdas */}
        <button
          type="button"
          onClick={onToggleBorders}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Bordes"
        >
          <Grid size={15} />
        </button>

        <button
          type="button"
          onClick={onMergeAndCenter}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Combinar celdas"
        >
          <Merge size={15} />
        </button>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 9. Alineación horizontal y vertical */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAlignOpen(!alignOpen)}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5"
            title="Alineación horizontal"
          >
            <AlignLeft size={15} />
            <ChevronDown size={11} />
          </button>
          {alignOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-50 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSetAlign("left");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Izquierda"
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetAlign("center");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Centro"
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetAlign("right");
                  setAlignOpen(false);
                }}
                className="p-1.5 rounded hover:bg-gray-100"
                title="Derecha"
              >
                <AlignRight size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Alineación vertical"
        >
          <AlignVerticalJustifyCenter size={15} />
        </button>

        <button
          type="button"
          onClick={onToggleWrapText}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Ajuste de texto"
        >
          <WrapText size={15} />
        </button>

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 10. Enlace, Comentario, Gráfico, Filtro, Funciones */}
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Introduce un enlace URL:");
            if (url) alert(`Enlace ${url} vinculado a la celda.`);
          }}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Insertar enlace (Ctrl+K)"
        >
          <Link size={15} />
        </button>

        <button
          type="button"
          onClick={() => alert("Comentario añadido a la celda seleccionada.")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Añadir comentario"
        >
          <MessageSquarePlus size={15} />
        </button>

        <button
          type="button"
          onClick={onInsertChart}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Insertar gráfico"
        >
          <BarChart3 size={15} />
        </button>

        <button
          type="button"
          onClick={onToggleFilter}
          className={`p-1.5 rounded-full transition-colors ${
            isFilterActive ? "bg-[#c2e7ff] text-[#001d35]" : "hover:bg-gray-200/70 text-[#444746]"
          }`}
          title="Crear un filtro"
        >
          <Filter size={15} />
        </button>

        {/* Funciones (Sigma Σ) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFnOpen(!fnOpen)}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5 font-bold"
            title="Funciones (Σ)"
          >
            <Sigma size={15} />
            <ChevronDown size={11} />
          </button>
          {fnOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[130px]">
              {["SUMA", "PROMEDIO", "CONTAR", "MAX", "MIN"].map((fn) => (
                <button
                  key={fn}
                  type="button"
                  onClick={() => {
                    onInsertAutoSum();
                    setFnOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] font-mono font-bold"
                >
                  ={fn}()
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Flecha colapsar */}
      <button
        type="button"
        className="p-1.5 rounded-full hover:bg-gray-100 text-[#444746] transition-colors ml-2 shrink-0"
        title="Ocultar menús"
      >
        <ChevronUp size={15} />
      </button>
    </div>
  );
};
