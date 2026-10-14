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
  Printer,
  ChevronDown,
  Table as TableIcon,
  BarChart2,
  PieChart,
  LineChart,
  ArrowUpDown,
  Trash2,
  HelpCircle,
  Binary,
  ArrowDownRight,
  Grid,
  Filter,
  Layers,
  Sparkles,
  PenTool,
  Pencil,
  Eraser,
  Split,
  Eye,
  Sliders,
  Type,
  ShieldCheck,
  MessageSquare,
  Globe,
  Database,
  Calculator,
  RefreshCw,
  FolderOpen,
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

// Componente para la base de cada grupo con etiqueta centrada e iniciador de diálogo ↘
const RibbonGroupFooter: React.FC<{
  label: string;
  onOpenDialog?: () => void;
  dialogTitle?: string;
}> = ({ label, onOpenDialog, dialogTitle }) => (
  <div className="flex items-center justify-between mt-auto pt-0.5 px-0.5 border-t border-transparent select-none">
    <span className="flex-1 font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#5a6b5c] truncate">
      {label}
    </span>
    {onOpenDialog && (
      <button
        type="button"
        onClick={onOpenDialog}
        title={dialogTitle || `Configuración avanzada de ${label}`}
        className="w-3.5 h-3.5 -mr-0.5 flex items-center justify-center rounded transition-colors text-[9px] text-[#5a6b5c] hover:text-[#107c41] hover:bg-[#e1f3e7] cursor-pointer"
      >
        <ArrowDownRight size={10} strokeWidth={2.5} />
      </button>
    )}
  </div>
);

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
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [currentFormat, setCurrentFormat] = useState<string>("General");

  // Estados interactivos para herramientas avanzadas de Excel
  const [activeDrawingTool, setActiveDrawingTool] = useState<string>("select");
  const [filterActive, setFilterActive] = useState<boolean>(false);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [paperSize, setPaperSize] = useState<string>("A4 (21 x 29.7 cm)");
  const [margins, setMargins] = useState<string>("Normal");
  const [printAreaDefined, setPrintAreaDefined] = useState<boolean>(false);

  const themeColors = [
    { name: "Sin relleno", color: "transparent" },
    { name: "Amarillo Suave", color: "#fef08a" },
    { name: "Verde Excel", color: "#bbf7d0" },
    { name: "Celeste Suave", color: "#bae6fd" },
    { name: "Naranja Melocotón", color: "#fed7aa" },
    { name: "Gris Platino", color: "#e5e7eb" },
    { name: "Rojo Tenue", color: "#fecaca" },
  ];

  const textColors = [
    { name: "Automático (Negro)", color: "#111111" },
    { name: "Verde Office", color: "#107c41" },
    { name: "Azul Marino", color: "#1e40af" },
    { name: "Rojo Oscuro", color: "#991b1b" },
    { name: "Gris Grafito", color: "#4b5563" },
  ];

  const notifyAdvancedDialog = (title: string, msg: string) => {
    alert(`[Cuadro de Diálogo Excel - ${title}]\n${msg}`);
  };

  const tabs: Array<{ id: ExcelRibbonTab; label: string }> = [
    { id: "inicio", label: "Inicio" },
    { id: "insertar", label: "Insertar" },
    { id: "dibujar", label: "Dibujar" },
    { id: "disposicion", label: "Disposición de página" },
    { id: "formulas", label: "Fórmulas" },
    { id: "datos", label: "Datos" },
    { id: "revisar", label: "Revisar" },
    { id: "vista", label: "Vista" },
    { id: "ayuda", label: "Ayuda" },
  ];

  return (
    <div className="border-b border-[#d2d0ce] bg-white flex flex-col select-none relative z-40 text-[#201f1e] shadow-2xs">
      {/* 1. FILA DE PESTAÑAS DE LA CINTA EXCEL */}
      <div className="flex items-center px-2 pt-1 border-b border-[#e1dfdd] bg-[#f3f2f1] gap-0.5 text-xs overflow-x-auto">
        {/* Pestaña ARCHIVO (Estilo botón distintivo verde de Microsoft Excel) */}
        <div className="relative mr-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-4 py-1.5 rounded-t bg-[#107c41] text-white font-bold hover:bg-[#0e6b37] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <span>Archivo</span>
            <ChevronDown size={11} />
          </button>

          {/* Menú Backstage de Archivo */}
          {fileMenuOpen && (
            <div
              className="absolute left-0 mt-1 w-64 rounded-xl border border-[#d2d0ce] bg-white shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 font-sans"
              onClick={() => setFileMenuOpen(false)}
            >
              <button
                type="button"
                onClick={onNewWorkbook}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#107c41] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus size={15} className="text-[#107c41]" />
                  Nuevo libro en blanco
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+N</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#107c41] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Save size={15} className="text-[#107c41]" />
                  Guardar
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+S</span>
              </button>
              <button
                type="button"
                onClick={onOpenImport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#107c41] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FolderOpen size={15} className="text-[#107c41]" />
                  Abrir / Importar...
                </span>
                <span className="font-mono text-[10px] text-stone-400">.xlsx, .csv</span>
              </button>
              <div className="h-px bg-[#e1dfdd] my-1" />
              <button
                type="button"
                onClick={onOpenExport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#107c41] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={15} className="text-[#107c41]" />
                  Exportar / Guardar como...
                </span>
                <span className="font-mono text-[10px] text-stone-400">.xlsx, .cfs</span>
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#107c41] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Printer size={15} className="text-stone-500" />
                  Imprimir libro
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

        {/* Pestañas de la cinta */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setFileMenuOpen(false);
              }}
              className={`px-3.5 py-1.5 font-medium transition-colors text-xs whitespace-nowrap cursor-pointer ${
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

      {/* 2. CUERPO DE LA CINTA RIBBON CON GRUPOS VERTICALES E INICIADORES ↘ */}
      <div className="h-25 px-2.5 py-1 flex items-stretch gap-2 overflow-x-auto bg-white text-[#201f1e]">
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* GRUPO PORTAPAPELES */}
            <div className="flex flex-col justify-between pr-2 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => alert("Pegar contenido en celda activa")}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#f3f2f1] w-12 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                  title="Pegar (Ctrl+V)"
                >
                  <Clipboard size={20} className="text-[#107c41] mb-0.5" />
                  <span className="text-[10px] font-medium">Pegar</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => alert("Cortar celda")}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Cortar (Ctrl+X)"
                  >
                    <Scissors size={12} />
                    <span>Cortar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Copiar celda")}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Copiar (Ctrl+C)"
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Copiar formato de celda")}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Copiar formato"
                  >
                    <Paintbrush size={12} />
                    <span>Copiar formato</span>
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Portapapeles"
                onOpenDialog={() => notifyAdvancedDialog("Portapapeles", "Historial de pegado y pegado de solo fórmulas o solo valores.")}
              />
            </div>

            {/* GRUPO FUENTE */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-1">
                  <select
                    className="text-xs px-2 py-0.5 rounded border border-[#d2d0ce] font-medium w-28 bg-white"
                    defaultValue="Calibri"
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="Segoe UI">Segoe UI</option>
                    <option value="Consolas">Consolas</option>
                  </select>
                  <select
                    className="text-xs px-1 py-0.5 rounded border border-[#d2d0ce] font-medium w-12 bg-white text-center"
                    defaultValue="11"
                  >
                    {[9, 10, 11, 12, 14, 16, 18, 20].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={onToggleBold}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-bold cursor-pointer"
                    title="Negrita (Ctrl + B)"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleItalic}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] italic cursor-pointer"
                    title="Cursiva (Ctrl + I)"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleUnderline}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] underline cursor-pointer"
                    title="Subrayado (Ctrl + U)"
                  >
                    <Underline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Bordes de celda aplicados (Todos los bordes)")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] cursor-pointer"
                    title="Bordes de cuadrícula"
                  >
                    <Grid size={13} />
                  </button>

                  {/* Relleno de celda */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setFillColorOpen(!fillColorOpen)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#107c41] cursor-pointer"
                      title="Color de relleno"
                    >
                      <PaintBucket size={13} />
                    </button>
                    {fillColorOpen && (
                      <div className="absolute left-0 mt-1 w-36 rounded-lg bg-white border border-[#d2d0ce] shadow-xl p-1.5 z-50">
                        {themeColors.map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => {
                              onSetBgColor(c.color);
                              setFillColorOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                          >
                            <span
                              className="w-3.5 h-3.5 rounded border border-black/20"
                              style={{ backgroundColor: c.color }}
                            />
                            <span>{c.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Color de texto */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTextColorOpen(!textColorOpen)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#dc2626] cursor-pointer"
                      title="Color de texto"
                    >
                      <Palette size={13} />
                    </button>
                    {textColorOpen && (
                      <div className="absolute left-0 mt-1 w-36 rounded-lg bg-white border border-[#d2d0ce] shadow-xl p-1.5 z-50">
                        {textColors.map((tc) => (
                          <button
                            key={tc.color}
                            type="button"
                            onClick={() => {
                              onSetTextColor(tc.color);
                              setTextColorOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20"
                              style={{ backgroundColor: tc.color }}
                            />
                            <span>{tc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <RibbonGroupFooter
                label="Fuente"
                onOpenDialog={() => notifyAdvancedDialog("Fuente", "Efectos tipográficos de celda, superíndice y subrayado contable.")}
              />
            </div>

            {/* GRUPO ALINEACIÓN */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onSetAlign("left")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] cursor-pointer"
                    title="Alinear a la izquierda"
                  >
                    <AlignLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAlign("center")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] cursor-pointer"
                    title="Centrar horizontalmente"
                  >
                    <AlignCenter size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAlign("right")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] cursor-pointer"
                    title="Alinear a la derecha"
                  >
                    <AlignRight size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => alert("Ajustar texto en celda activado")}
                    className="px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 font-medium cursor-pointer"
                    title="Ajustar texto automáticamente"
                  >
                    Ajustar texto
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Combinar y centrar rango de celdas")}
                    className="px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 font-medium cursor-pointer"
                    title="Combinar celdas seleccionadas"
                  >
                    Combinar
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Alineación"
                onOpenDialog={() => notifyAdvancedDialog("Alineación", "Orientación en grados del texto, sangría y alineación vertical.")}
              />
            </div>

            {/* GRUPO NÚMERO (EXCLUSIVO DE EXCEL) */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFormatMenuOpen(!formatMenuOpen)}
                    className="w-34 px-2 py-0.5 text-xs rounded border border-[#d2d0ce] bg-white flex items-center justify-between font-medium cursor-pointer"
                  >
                    <span>{currentFormat}</span>
                    <ChevronDown size={11} className="text-stone-500" />
                  </button>
                  {formatMenuOpen && (
                    <div className="absolute left-0 mt-1 w-36 rounded-lg bg-white border border-[#d2d0ce] shadow-xl p-1 z-50">
                      {[
                        { label: "General", val: "general" as CellFormat },
                        { label: "Moneda ($)", val: "currency" as CellFormat },
                        { label: "Porcentaje (%)", val: "percent" as CellFormat },
                        { label: "Número (1.234,00)", val: "number" as CellFormat },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            onSetFormat(item.val);
                            setCurrentFormat(item.label);
                            setFormatMenuOpen(false);
                          }}
                          className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => onSetFormat("currency")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-bold text-[#107c41] cursor-pointer"
                    title="Formato de moneda ($)"
                  >
                    <DollarSign size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetFormat("percent")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-bold cursor-pointer"
                    title="Formato de porcentaje (%)"
                  >
                    <Percent size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetFormat("number")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-mono font-bold cursor-pointer"
                    title="Estilo millares (,)"
                  >
                    ,
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Aumentar decimales")}
                    className="px-1 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-mono text-[10px] cursor-pointer"
                    title="Aumentar decimales"
                  >
                    .00
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Disminuir decimales")}
                    className="px-1 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-mono text-[10px] cursor-pointer"
                    title="Disminuir decimales"
                  >
                    .0
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Número"
                onOpenDialog={() => notifyAdvancedDialog("Formato de Celdas", "Categorías de fecha personalizada, hora, científica y texto puro.")}
              />
            </div>

            {/* GRUPO ESTILOS (EXCLUSIVO DE EXCEL) */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Formato Condicional: Resaltar reglas de celdas mayores que, menores que o barras de datos.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <Sliders size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Formato condicional</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Dar formato como tabla matricial con filtros automáticos")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <TableIcon size={20} className="text-stone-700 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Dar formato como tabla</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Estilos"
                onOpenDialog={() => notifyAdvancedDialog("Estilos de celda", "Crear nuevo estilo de tabla o esquema de colores empresarial.")}
              />
            </div>

            {/* GRUPO CELDAS (EXCLUSIVO DE EXCEL) */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => alert("Fila o columna insertada en la selección")}
                  className="px-2 py-0.5 rounded text-[11px] bg-black/5 hover:bg-[#e1f3e7] hover:text-[#107c41] font-medium text-left cursor-pointer"
                >
                  + Insertar celdas
                </button>
                <button
                  type="button"
                  onClick={() => alert("Fila o columna eliminada")}
                  className="px-2 py-0.5 rounded text-[11px] bg-black/5 hover:bg-rose-50 hover:text-rose-600 font-medium text-left cursor-pointer"
                >
                  - Eliminar celdas
                </button>
                <button
                  type="button"
                  onClick={() => alert("Ajuste de alto de fila (24px) y ancho de columna (110px)")}
                  className="px-2 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] text-stone-600 font-medium text-left cursor-pointer"
                >
                  Formato de celda
                </button>
              </div>
              <RibbonGroupFooter
                label="Celdas"
                onOpenDialog={() => notifyAdvancedDialog("Celdas", "Bloquear celdas, ocultar fórmulas y ajustar tamaño milimétrico.")}
              />
            </div>

            {/* GRUPO EDICIÓN */}
            <div className="flex flex-col justify-between pl-1">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                {/* Menú de Autosuma */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAutoSumMenuOpen(!autoSumMenuOpen)}
                    className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                  >
                    <Sigma size={20} className="text-[#107c41] mb-0.5" />
                    <span className="text-[10px] font-bold">Autosuma</span>
                  </button>
                  {autoSumMenuOpen && (
                    <div className="absolute left-0 mt-1 w-32 rounded-lg bg-white border border-[#d2d0ce] shadow-xl p-1 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          onInsertAutoSum();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left font-bold cursor-pointer"
                      >
                        SUMA
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertAverage();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                      >
                        PROMEDIO
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertCount();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                      >
                        CONTAR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertMax();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                      >
                        MAX
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertMin();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                      >
                        MIN
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={onSortAsc}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Ordenar de menor a mayor (A-Z)"
                  >
                    <ArrowUpDown size={12} className="text-[#107c41]" />
                    <span>Ordenar A-Z</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClearCell}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-rose-50 text-rose-600 cursor-pointer"
                    title="Borrar contenido de la celda"
                  >
                    <Trash2 size={12} />
                    <span>Borrar</span>
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Edición"
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <>
            {/* GRUPO TABLAS */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Tabla de base de datos relacional insertada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <TableIcon size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Tabla dinámica para resumen multidimensional")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Database size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Tabla dinámica</span>
                </button>
              </div>
              <RibbonGroupFooter label="Tablas" />
            </div>

            {/* GRUPO GRÁFICOS */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Gráfico de Columnas generado con los datos seleccionados")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <BarChart2 size={20} className="text-blue-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Columnas</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Gráfico de Líneas temporales generado")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <LineChart size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Líneas</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Gráfico Circular de distribución generado")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <PieChart size={20} className="text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Circular</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Gráficos"
                onOpenDialog={() => notifyAdvancedDialog("Gráficos", "Selector de series de datos, ejes secundarios y tipos combinados.")}
              />
            </div>

            {/* GRUPO ILUSTRACIONES & TEXTO */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Ilustraciones e imágenes incrustadas en hoja")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <Sparkles size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ilustraciones</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Cuadro de texto flotante")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <Type size={20} className="text-stone-700 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Texto</span>
                </button>
              </div>
              <RibbonGroupFooter label="Texto e Ilustraciones" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DIBUJAR ===================== */}
        {activeTab === "dibujar" && (
          <>
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pen")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "pen"
                      ? "bg-[#107c41]/10 border-[#107c41] text-[#107c41]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <PenTool size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium">Bolígrafo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pencil")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "pencil"
                      ? "bg-[#107c41]/10 border-[#107c41] text-[#107c41]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Pencil size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium">Lápiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("eraser")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "eraser"
                      ? "bg-[#107c41]/10 border-[#107c41] text-[#107c41]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Eraser size={20} className="text-rose-600 mb-1" />
                  <span className="text-[10px] font-medium">Borrador</span>
                </button>
              </div>
              <RibbonGroupFooter label="Herramientas de dibujo" />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Entrada de lápiz a ecuación matemática")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-20 h-15 cursor-pointer"
                >
                  <Calculator size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Lápiz a fórmula</span>
                </button>
              </div>
              <RibbonGroupFooter label="Conversión" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISPOSICIÓN DE PÁGINA ===================== */}
        {activeTab === "disposicion" && (
          <>
            {/* GRUPO CONFIGURAR PÁGINA */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-3 flex-1 items-center text-xs">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 w-16">Márgenes:</span>
                    <select
                      value={margins}
                      onChange={(e) => setMargins(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs bg-white cursor-pointer"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Estrecho">Estrecho</option>
                      <option value="Ancho">Ancho</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 w-16">Orientación:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOrientation("vertical")}
                        className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                          orientation === "vertical"
                            ? "bg-[#107c41] text-white font-bold"
                            : "bg-black/5"
                        }`}
                      >
                        Vertical
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrientation("horizontal")}
                        className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                          orientation === "horizontal"
                            ? "bg-[#107c41] text-white font-bold"
                            : "bg-black/5"
                        }`}
                      >
                        Horizontal
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 w-14">Tamaño:</span>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs bg-white cursor-pointer"
                    >
                      <option value="A4 (21 x 29.7 cm)">A4</option>
                      <option value="Carta">Carta (Letter)</option>
                      <option value="Oficio">Oficio (Legal)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintAreaDefined(!printAreaDefined);
                      alert(
                        printAreaDefined
                          ? "Área de impresión borrada."
                          : "Área de impresión establecida en el rango activo."
                      );
                    }}
                    className={`px-2 py-0.5 rounded text-xs text-left cursor-pointer font-medium ${
                      printAreaDefined ? "bg-[#107c41] text-white" : "bg-black/5 hover:bg-black/10"
                    }`}
                  >
                    Área de impresión: {printAreaDefined ? "Fijada" : "Hoja entera"}
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Configurar Página"
                onOpenDialog={() => notifyAdvancedDialog("Configurar Página", "Repetir filas superiores como títulos en cada página impresa.")}
              />
            </div>

            {/* GRUPO AJUSTAR ÁREA DE IMPRESIÓN */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500">Ancho:</span>
                  <span className="font-semibold">Automático</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500">Alto:</span>
                  <span className="font-semibold">Automático</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500">Escala:</span>
                  <span className="font-semibold font-mono">100%</span>
                </div>
              </div>
              <RibbonGroupFooter
                label="Ajustar área"
                onOpenDialog={() => notifyAdvancedDialog("Ajuste de Escala", "Forzar ajuste a exactamente 1 página de ancho por 1 de alto.")}
              />
            </div>

            {/* GRUPO OPCIONES DE LA HOJA */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex flex-col gap-1.5 flex-1 justify-center text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGridlines}
                    onChange={onToggleGridlines}
                    className="accent-[#107c41]"
                  />
                  <span>Líneas de división</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFormulaBar}
                    onChange={onToggleFormulaBar}
                    className="accent-[#107c41]"
                  />
                  <span>Barra de fórmulas</span>
                </label>
              </div>
              <RibbonGroupFooter label="Opciones de la hoja" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: FÓRMULAS ===================== */}
        {activeTab === "formulas" && (
          <>
            {/* GRUPO BIBLIOTECA DE FUNCIONES */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Asistente de inserción de función fx: Selecciona una función matricial")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <span className="font-serif italic font-bold text-lg text-[#107c41]">fx</span>
                  <span className="text-[10px] font-bold">Insertar función</span>
                </button>

                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={onInsertAutoSum}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] font-bold text-left cursor-pointer"
                  >
                    Σ Autosuma
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Funciones Financieras: PAGO, VF, VA, TASA")}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] text-left cursor-pointer"
                  >
                    Financieras
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Funciones Lógicas: SI, Y, O, SI.ERROR")}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] text-left cursor-pointer"
                  >
                    Lógicas
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Funciones de Texto: CONCATENAR, MAYUSC, EXTRAE")}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] text-left cursor-pointer"
                  >
                    Texto
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Biblioteca de funciones"
                onOpenDialog={() => notifyAdvancedDialog("Biblioteca de Funciones", "Catálogo completo clasificado por categorías de cálculo.")}
              />
            </div>

            {/* GRUPO NOMBRES DEFINIDOS */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center text-xs">
                <button
                  type="button"
                  onClick={() => alert("Administrador de Nombres: Crear alias para rangos ej. 'Ventas2025' = Hoja1!$B$2:$B$50")}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] font-medium text-left cursor-pointer"
                >
                  Administrador de nombres
                </button>
                <button
                  type="button"
                  onClick={() => alert("Asignar nombre rápido a selección")}
                  className="px-2 py-1 rounded hover:bg-[#f3f2f1] text-stone-600 text-left cursor-pointer"
                >
                  Asignar nombre...
                </button>
              </div>
              <RibbonGroupFooter label="Nombres definidos" />
            </div>

            {/* GRUPO AUDITORÍA DE FÓRMULAS */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Rastreador de precedentes: Dibuja flechas hacia las celdas que alimentan esta fórmula")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Binary size={18} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Rastrear precedentes</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Mostrar fórmulas en todas las celdas (Ctrl + `)")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Eye size={18} className="text-blue-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Mostrar fórmulas</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Evaluar fórmula paso a paso")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Calculator size={18} className="text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Evaluar fórmula</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Auditoría de fórmulas"
                onOpenDialog={() => notifyAdvancedDialog("Auditoría", "Ventana de inspección y comprobación de errores matemáticos #DIV/0!, #VALOR!.")}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DATOS ===================== */}
        {activeTab === "datos" && (
          <>
            {/* GRUPO OBTENER Y TRANSFORMAR */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Database size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Desde texto/CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Conectar a base de datos externa vía Power Query")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <RefreshCw size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Actualizar todo</span>
                </button>
              </div>
              <RibbonGroupFooter label="Obtener y transformar" />
            </div>

            {/* GRUPO ORDENAR Y FILTRAR */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onSortAsc}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 cursor-pointer"
                >
                  <ArrowUpDown size={18} className="text-[#107c41] mb-0.5" />
                  <span className="text-[10px] font-bold">A-Z</span>
                </button>
                <button
                  type="button"
                  onClick={onSortDesc}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 cursor-pointer"
                >
                  <ArrowUpDown size={18} className="text-[#107c41] mb-0.5" />
                  <span className="text-[10px] font-bold">Z-A</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterActive(!filterActive);
                    alert(filterActive ? "Filtros automáticos desactivados." : "Embudos de filtro activados en los encabezados.");
                  }}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    filterActive ? "bg-[#107c41] text-white border-[#0e6b37]" : "hover:bg-[#f3f2f1] border-transparent"
                  }`}
                >
                  <Filter size={18} className="mb-0.5" />
                  <span className="text-[10px] font-bold">Filtro</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Ordenar y filtrar"
                onOpenDialog={() => notifyAdvancedDialog("Filtros Avanzados", "Criterios múltiples de ordenamiento por más de 3 niveles.")}
              />
            </div>

            {/* GRUPO HERRAMIENTAS DE DATOS */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="grid grid-cols-2 gap-1 flex-1 items-center text-xs">
                <button
                  type="button"
                  onClick={() => alert("Asistente de Texto en Columnas: Separar por comas, punto y coma o tabulación")}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] text-[11px] text-left cursor-pointer"
                >
                  Texto en columnas
                </button>
                <button
                  type="button"
                  onClick={() => alert("Relleno rápido (Flash Fill) activado para detectar patrones")}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] text-[11px] text-left cursor-pointer"
                >
                  Relleno rápido
                </button>
                <button
                  type="button"
                  onClick={() => alert("Quitar duplicados en el rango seleccionado")}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] text-[11px] text-left cursor-pointer"
                >
                  Quitar duplicados
                </button>
                <button
                  type="button"
                  onClick={() => alert("Validación de datos: Restringir a lista desplegable o números enteros")}
                  className="px-2 py-1 rounded bg-[#107c41]/10 text-[#107c41] font-bold text-[11px] text-left cursor-pointer"
                >
                  Validación de datos
                </button>
              </div>
              <RibbonGroupFooter
                label="Herramientas de datos"
                onOpenDialog={() => notifyAdvancedDialog("Herramientas de Datos", "Análisis de hipótesis y Buscar objetivo matemático.")}
              />
            </div>

            {/* GRUPO ESQUEMA */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Agrupar filas o columnas")}
                  className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                >
                  Agrupar
                </button>
                <button
                  type="button"
                  onClick={() => alert("Desagrupar selección")}
                  className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                >
                  Desagrupar
                </button>
                <button
                  type="button"
                  onClick={() => alert("Subtotal automático insertado")}
                  className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                >
                  Subtotal
                </button>
              </div>
              <RibbonGroupFooter label="Esquema" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: REVISAR ===================== */}
        {activeTab === "revisar" && (
          <>
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Revisión ortográfica de la hoja completada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <ShieldCheck size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ortografía</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Sinónimos y diccionario en español activo")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Globe size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Sinónimos</span>
                </button>
              </div>
              <RibbonGroupFooter label="Revisión" />
            </div>

            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    const comment = prompt("Nuevo comentario para la celda:");
                    if (comment) alert(`Comentario guardado en celda: ${comment}`);
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-20 h-15 cursor-pointer"
                >
                  <MessageSquare size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Nuevo comentario</span>
                </button>
              </div>
              <RibbonGroupFooter label="Comentarios" />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Proteger hoja de cálculo con contraseña")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <ShieldCheck size={20} className="text-emerald-700 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Proteger hoja</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Proteger estructura del libro")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <ShieldCheck size={20} className="text-amber-700 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Proteger libro</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Proteger"
                onOpenDialog={() => notifyAdvancedDialog("Protección de Libro", "Contraseña de apertura, permisos de edición de celdas no bloqueadas.")}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <>
            {/* GRUPO VISTAS DE LIBRO */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Vista Normal de Hoja")}
                  className="flex flex-col items-center justify-center p-1.5 rounded bg-[#107c41]/10 text-[#107c41] font-bold w-16 h-15 cursor-pointer"
                >
                  <Grid size={20} className="mb-1" />
                  <span className="text-[10px]">Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Ver saltos de página de impresión")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Split size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] text-center leading-tight">Ver saltos de página</span>
                </button>
              </div>
              <RibbonGroupFooter label="Vistas de libro" />
            </div>

            {/* GRUPO MOSTRAR */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1.5 flex-1 justify-center text-xs">
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
              <RibbonGroupFooter label="Mostrar" />
            </div>

            {/* GRUPO ZOOM */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1 flex-1 items-center">
                {[75, 100, 125, 150].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onZoomChange(z)}
                    className={`px-2 py-1 rounded text-xs font-mono font-medium cursor-pointer ${
                      zoom === z
                        ? "bg-[#107c41] text-white font-bold"
                        : "hover:bg-black/5 text-stone-600"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
              <RibbonGroupFooter
                label="Zoom"
                onOpenDialog={() => notifyAdvancedDialog("Zoom", "Ajustar al 100% o ampliar a la selección activa.")}
              />
            </div>

            {/* GRUPO VENTANA */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Inmovilizar fila superior y primera columna para mantener encabezados siempre a la vista")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-20 h-15 cursor-pointer"
                >
                  <Layers size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Inmovilizar paneles</span>
                </button>
              </div>
              <RibbonGroupFooter label="Ventana" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: AYUDA ===================== */}
        {activeTab === "ayuda" && (
          <>
            <div className="flex flex-col justify-between pr-3">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Atajos de CoffeCalc:\nCtrl+S: Guardar\nCtrl+N: Nuevo libro\nCtrl+P: Imprimir\nF2: Editar celda")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <HelpCircle size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "CoffeCalc Suite 2026\nHoja de Cálculo Matricial y Motor de Fórmulas Avanzadas.\nCompatible con Microsoft Excel (.xlsx), .cfs y CSV."
                    )
                  }
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <FileSpreadsheet size={20} className="text-stone-500 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Acerca de</span>
                </button>
              </div>
              <RibbonGroupFooter label="Ayuda" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
