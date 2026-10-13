import React, { useState } from "react";
import {
  Clipboard,
  Scissors,
  Copy,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Palette,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  DollarSign,
  Percent,
  Sigma,
  FileSpreadsheet,
  FilePlus,
  Save,
  Download,
  Upload,
  Printer,
  ChevronDown,
  Plus,
  Table as TableIcon,
  BarChart2,
  PieChart,
  LineChart,
  ArrowUpDown,
  Trash2,
  HelpCircle,
  Binary,
} from "lucide-react";
import type { ExcelRibbonTab, CellFormat } from "../types";

interface ExcelRibbonProps {
  onNewWorkbook: () => void;
  onSave: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onPrint: () => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onSetAlign: (align: "left" | "center" | "right") => void;
  onSetFormat: (format: CellFormat) => void;
  onSetBgColor: (color: string) => void;
  onSetTextColor: (color: string) => void;
  onInsertAutoSum: () => void;
  onInsertAverage: () => void;
  onInsertCount: () => void;
  onInsertMax: () => void;
  onInsertMin: () => void;
  onClearCell: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  showGridlines: boolean;
  onToggleGridlines: () => void;
  showFormulaBar: boolean;
  onToggleFormulaBar: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export const ExcelRibbon: React.FC<ExcelRibbonProps> = ({
  onNewWorkbook,
  onSave,
  onOpenExport,
  onOpenImport,
  onPrint,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onSetAlign,
  onSetFormat,
  onSetBgColor,
  onSetTextColor,
  onInsertAutoSum,
  onInsertAverage,
  onInsertCount,
  onInsertMax,
  onInsertMin,
  onClearCell,
  onSortAsc,
  onSortDesc,
  showGridlines,
  onToggleGridlines,
  showFormulaBar,
  onToggleFormulaBar,
  zoom,
  onZoomChange,
}) => {
  const [activeTab, setActiveTab] = useState<ExcelRibbonTab>("inicio");
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fillColorOpen, setFillColorOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [autoSumMenuOpen, setAutoSumMenuOpen] = useState(false);

  // Paleta de colores temáticos de Microsoft Excel
  const themeColors = [
    { name: "Sin relleno", color: "transparent" },
    { name: "Verde Excel", color: "#dff6dd" },
    { name: "Verde Intenso", color: "#107c41" },
    { name: "Amarillo Suave", color: "#fff2cc" },
    { name: "Naranja Claro", color: "#fce4d6" },
    { name: "Azul Suave", color: "#ddebf7" },
    { name: "Gris Claro", color: "#f2f2f2" },
    { name: "Caramelo Café", color: "#eeddd0" },
  ];

  const fontColors = [
    { name: "Automático / Negro", color: "#000000" },
    { name: "Blanco", color: "#ffffff" },
    { name: "Verde Oscuro", color: "#0e6b37" },
    { name: "Rojo Alerta", color: "#c00000" },
    { name: "Azul Marino", color: "#1f4e78" },
    { name: "Gris", color: "#595959" },
  ];

  return (
    <div className="bg-[#f3f2f1] text-[#201f1e] flex flex-col select-none border-b border-[#d2d0ce] shadow-xs relative z-40">
      {/* 1. FILA DE PESTAÑAS RIBBON (Estilo Microsoft Excel) */}
      <div className="flex items-center px-2 pt-1 border-b border-[#e1dfdd] gap-0.5 text-xs bg-[#f3f2f1]">
        {/* Pestaña ARCHIVO (Botón verde distintivo de Excel) */}
        <div className="relative mr-1.5">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-4 py-1.5 rounded-t bg-[#107c41] text-white font-bold hover:bg-[#0e6b37] transition-colors flex items-center gap-1 shadow-xs"
          >
            <span>Archivo</span>
            <ChevronDown size={11} />
          </button>

          {/* Menú Backstage de Archivo */}
          {fileMenuOpen && (
            <div
              className="absolute left-0 mt-1 w-64 rounded-xl border border-[#d2d0ce] bg-white text-[#201f1e] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 font-sans"
              onClick={() => setFileMenuOpen(false)}
            >
              <button
                type="button"
                onClick={onNewWorkbook}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-left transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus size={15} className="text-[#107c41]" />
                  Nuevo libro en blanco
                </span>
                <span className="font-mono text-[10px] text-gray-500">Ctrl+N</span>
              </button>

              <button
                type="button"
                onClick={onSave}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-left transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <Save size={15} className="text-[#107c41]" />
                  Guardar libro
                </span>
                <span className="font-mono text-[10px] text-gray-500">Ctrl+S</span>
              </button>

              <button
                type="button"
                onClick={onOpenImport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-left transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <Upload size={15} className="text-[#6f4e37]" />
                  Importar CSV / Datos
                </span>
                <span className="font-mono text-[10px] text-gray-500">.csv</span>
              </button>

              <button
                type="button"
                onClick={onOpenExport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-left transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={15} className="text-[#107c41]" />
                  Exportar CSV / Descargar
                </span>
                <span className="font-mono text-[10px] text-gray-500">.csv, .cfs</span>
              </button>

              <div className="h-px bg-gray-200 my-1" />

              <button
                type="button"
                onClick={onPrint}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-left transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <Printer size={15} className="text-gray-600" />
                  Imprimir cuadrícula
                </span>
                <span className="font-mono text-[10px] text-gray-500">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

        {/* Pestañas estándar de Excel */}
        {(
          [
            { id: "inicio", label: "Inicio" },
            { id: "insertar", label: "Insertar" },
            { id: "disposicion", label: "Disposición de página" },
            { id: "formulas", label: "Fórmulas" },
            { id: "datos", label: "Datos" },
            { id: "revisar", label: "Revisar" },
            { id: "vista", label: "Vista" },
            { id: "ayuda", label: "Ayuda" },
          ] as Array<{ id: ExcelRibbonTab; label: string }>
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setFileMenuOpen(false);
              }}
              className={`px-3 py-1.5 font-medium transition-colors text-xs ${
                isActive
                  ? "border-b-[3px] border-[#107c41] text-[#107c41] font-bold bg-white"
                  : "border-b-[3px] border-transparent text-[#605e5c] hover:text-[#201f1e] hover:bg-[#edebe9]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. CUERPO DE LA CINTA RIBBON */}
      <div className="h-24 px-3 py-1 flex items-stretch gap-2 overflow-x-auto bg-white text-[#201f1e]">
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* GRUPO 1: PORTAPAPELES */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => alert("Pegar contenido (Ctrl + V)")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] text-[#201f1e] w-12 h-16 border border-transparent hover:border-[#d2d0ce] transition-colors"
                >
                  <Clipboard size={22} className="text-[#107c41] mb-0.5" />
                  <span className="text-[10px] leading-tight font-medium">Pegar</span>
                </button>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => alert("Cortar celda (Ctrl + X)")}
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] hover:text-[#107c41] transition-colors"
                  >
                    <Scissors size={12} />
                    <span>Cortar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Copiar celda (Ctrl + C)")}
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] hover:text-[#107c41] transition-colors"
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Copiar formato")}
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] hover:text-[#107c41] transition-colors"
                  >
                    <Paintbrush size={12} />
                    <span>Copiar formato</span>
                  </button>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Portapapeles
              </span>
            </div>

            {/* GRUPO 2: FUENTE */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                {/* Fila superior: Tipografía y tamaño */}
                <div className="flex items-center gap-1">
                  <select className="text-xs px-2 py-0.5 rounded border border-[#d2d0ce] font-medium w-32 shadow-xs bg-white focus:outline-none focus:border-[#107c41]">
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="Segoe UI">Segoe UI</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                  </select>
                  <select className="text-xs px-1.5 py-0.5 rounded border border-[#d2d0ce] font-medium w-14 shadow-xs bg-white focus:outline-none focus:border-[#107c41]">
                    {[9, 10, 11, 12, 14, 16, 18, 20].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Fila inferior: Negrita, Cursiva, Subrayado, Relleno, Color */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={onToggleBold}
                    title="Negrita (Ctrl + B)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#201f1e] font-bold text-xs"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleItalic}
                    title="Cursiva (Ctrl + I)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#201f1e] italic text-xs"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleUnderline}
                    title="Subrayado (Ctrl + U)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#201f1e] underline text-xs"
                  >
                    <Underline size={13} />
                  </button>

                  <div className="h-4 w-px bg-gray-300 mx-1" />

                  {/* Color de relleno de celda */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setFillColorOpen(!fillColorOpen);
                        setTextColorOpen(false);
                      }}
                      title="Color de relleno"
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-[#f3f2f1] text-[#201f1e] text-xs"
                    >
                      <PaintBucket size={13} className="text-[#107c41]" />
                      <ChevronDown size={9} />
                    </button>
                    {fillColorOpen && (
                      <div className="absolute left-0 mt-1 w-44 rounded-xl bg-white border border-[#d2d0ce] shadow-2xl p-1.5 z-50">
                        {themeColors.map((tc) => (
                          <button
                            key={tc.color}
                            type="button"
                            onClick={() => {
                              onSetBgColor(tc.color);
                              setFillColorOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[#f3f2f1] text-left"
                          >
                            <div className="w-3.5 h-3.5 rounded border border-gray-300" style={{ background: tc.color }} />
                            <span>{tc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Color de fuente */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setTextColorOpen(!textColorOpen);
                        setFillColorOpen(false);
                      }}
                      title="Color de fuente"
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-[#f3f2f1] text-[#201f1e] text-xs"
                    >
                      <Palette size={13} className="text-[#c00000]" />
                      <ChevronDown size={9} />
                    </button>
                    {textColorOpen && (
                      <div className="absolute left-0 mt-1 w-44 rounded-xl bg-white border border-[#d2d0ce] shadow-2xl p-1.5 z-50">
                        {fontColors.map((fc) => (
                          <button
                            key={fc.color}
                            type="button"
                            onClick={() => {
                              onSetTextColor(fc.color);
                              setTextColorOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-[#f3f2f1] text-left"
                          >
                            <div className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ background: fc.color }} />
                            <span>{fc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Fuente
              </span>
            </div>

            {/* GRUPO 3: ALINEACIÓN */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1 flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => onSetAlign("left")}
                  title="Alinear a la izquierda"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#201f1e]"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("center")}
                  title="Centrar"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#201f1e]"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("right")}
                  title="Alinear a la derecha"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#201f1e]"
                >
                  <AlignRight size={14} />
                </button>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Alineación
              </span>
            </div>

            {/* GRUPO 4: NÚMERO / FORMATO */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                <div className="flex items-center gap-1">
                  <select
                    onChange={(e) => onSetFormat(e.target.value as CellFormat)}
                    className="text-xs px-2 py-0.5 rounded border border-[#d2d0ce] font-medium w-28 bg-white focus:outline-none focus:border-[#107c41]"
                  >
                    <option value="general">General</option>
                    <option value="currency">Moneda ($)</option>
                    <option value="percent">Porcentaje (%)</option>
                    <option value="number">Número</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSetFormat("currency")}
                    title="Formato de número de contabilidad ($)"
                    className="px-1.5 py-0.5 rounded hover:bg-[#f3f2f1] font-bold text-xs text-[#107c41] flex items-center gap-0.5"
                  >
                    <DollarSign size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetFormat("percent")}
                    title="Estilo porcentual (%)"
                    className="px-1.5 py-0.5 rounded hover:bg-[#f3f2f1] font-bold text-xs text-[#201f1e] flex items-center gap-0.5"
                  >
                    <Percent size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetFormat("number")}
                    title="Estilo de millares"
                    className="px-1.5 py-0.5 rounded hover:bg-[#f3f2f1] font-bold text-xs text-[#201f1e]"
                  >
                    ,00
                  </button>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Número
              </span>
            </div>

            {/* GRUPO 5: EDICIÓN & AUTOSUMA */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1">
                {/* Botón Autosuma */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={onInsertAutoSum}
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] text-[#201f1e] w-14 h-16 border border-transparent hover:border-[#d2d0ce] transition-colors"
                  >
                    <Sigma size={22} className="text-[#107c41] mb-0.5" />
                    <span className="text-[10px] leading-tight font-bold">Autosuma</span>
                  </button>
                </div>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoSumMenuOpen(!autoSumMenuOpen);
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] text-[#107c41] font-semibold"
                  >
                    <span>Funciones</span>
                    <ChevronDown size={11} />
                  </button>
                  {autoSumMenuOpen && (
                    <div className="absolute top-16 mt-1 w-36 bg-white border border-[#d2d0ce] rounded-xl shadow-xl py-1 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          onInsertAutoSum();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 text-xs hover:bg-[#f3f2f1]"
                      >
                        Suma (=SUMA)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertAverage();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 text-xs hover:bg-[#f3f2f1]"
                      >
                        Promedio (=PROMEDIO)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertCount();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 text-xs hover:bg-[#f3f2f1]"
                      >
                        Contar números
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertMax();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 text-xs hover:bg-[#f3f2f1]"
                      >
                        Máximo (=MAX)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertMin();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 text-xs hover:bg-[#f3f2f1]"
                      >
                        Mínimo (=MIN)
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onSortAsc}
                    title="Ordenar de menor a mayor (A-Z)"
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] text-gray-700"
                  >
                    <ArrowUpDown size={12} />
                    <span>Ordenar A-Z</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClearCell}
                    title="Borrar contenido de la celda"
                    className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] text-red-600"
                  >
                    <Trash2 size={12} />
                    <span>Borrar todo</span>
                  </button>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Modificar
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => alert("Insertar tabla con formato")}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-16 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <TableIcon size={22} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium">Tabla</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Tablas
              </span>
            </div>

            <div className="flex flex-col justify-between px-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => alert("Insertar gráfico de barras")}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-16 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <BarChart2 size={22} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium">Columnas</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Insertar gráfico de líneas")}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-16 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <LineChart size={22} className="text-[#1f4e78] mb-1" />
                  <span className="text-[10px] font-medium">Líneas</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Insertar gráfico circular")}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-16 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <PieChart size={22} className="text-[#e08e45] mb-1" />
                  <span className="text-[10px] font-medium">Circular</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Gráficos
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: FÓRMULAS ===================== */}
        {activeTab === "formulas" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={onInsertAutoSum}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <Sigma size={22} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-bold text-center leading-tight">SUMA</span>
                </button>
                <button
                  type="button"
                  onClick={onInsertAverage}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <Binary size={22} className="text-[#1f4e78] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">PROMEDIO</span>
                </button>
                <button
                  type="button"
                  onClick={onInsertCount}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <Plus size={22} className="text-[#6f4e37] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">CONTAR</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Biblioteca de funciones
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DATOS ===================== */}
        {activeTab === "datos" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-24 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <Upload size={22} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Importar CSV</span>
                </button>
                <button
                  type="button"
                  onClick={onSortAsc}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <ArrowUpDown size={22} className="text-[#201f1e] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ordenar A-Z</span>
                </button>
                <button
                  type="button"
                  onClick={onSortDesc}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <ArrowUpDown size={22} className="text-[#201f1e] mb-1 rotate-180" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ordenar Z-A</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Ordenar y filtrar
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-4 flex-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#107c41]">
                  <input
                    type="checkbox"
                    checked={showGridlines}
                    onChange={onToggleGridlines}
                    className="accent-[#107c41]"
                  />
                  <span>Líneas de cuadrícula</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#107c41]">
                  <input
                    type="checkbox"
                    checked={showFormulaBar}
                    onChange={onToggleFormulaBar}
                    className="accent-[#107c41]"
                  />
                  <span>Barra de fórmulas</span>
                </label>
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Mostrar
              </span>
            </div>

            <div className="flex flex-col justify-between px-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1">
                {[75, 100, 125, 150].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onZoomChange(z)}
                    className={`px-2.5 py-1.5 rounded text-xs font-mono font-medium ${
                      zoom === z
                        ? "bg-[#dff6dd] text-[#0e6b37] font-bold border border-[#107c41]"
                        : "hover:bg-[#f3f2f1] text-[#605e5c]"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Zoom
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: AYUDA ===================== */}
        {activeTab === "ayuda" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "Atajos de CoffeCalc:\n• Flechas del teclado: Desplazarse por celdas\n• Enter: Bajar y confirmar\n• Tab: Siguiente columna\n• F2: Editar fórmula in-place\n• Ctrl + S: Guardar en bóveda local\n• Fórmulas soportadas: =SUMA(A1:A5), =PROMEDIO(B1:B10), =MAX(), =MIN(), =A1+B1"
                    )
                  }
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <HelpCircle size={22} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "CoffeCalc v1.0 Enterprise\nHoja de cálculo de arquitectura abierta de CoffeWorks.\nCompatible con formatos .cfs, .csv y expresiones de Microsoft Excel."
                    )
                  }
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#f3f2f1] w-20 h-16 border border-transparent hover:border-[#d2d0ce]"
                >
                  <FileSpreadsheet size={22} className="text-[#6f4e37] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Acerca de</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-[#605e5c] uppercase font-semibold">
                Ayuda
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
