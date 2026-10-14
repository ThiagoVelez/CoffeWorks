import React, { useState, useRef } from "react";
import { PortalMenu } from "./PortalMenu";
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
  onSetFontFamily?: (font: string) => void;
  onSetFontSize?: (size: number) => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onFormatPainter?: () => void;
  isFormatPainterActive?: boolean;
  onToggleBorders?: () => void;
  onToggleWrapText?: () => void;
  onMergeAndCenter?: () => void;
  onAdjustDecimals?: (delta: number) => void;
  onConditionalFormatting?: () => void;
  onFormatAsTable?: () => void;
  onInsertRowOrCol?: (type: "row" | "col") => void;
  onDeleteRowOrCol?: (type: "row" | "col") => void;
  onInsertChart?: (chartType: "bar" | "line" | "pie") => void;
  onToggleRawFormulas?: () => void;
  showRawFormulas?: boolean;
  onToggleFilter?: () => void;
  isFilterActive?: boolean;
  onTextToColumns?: () => void;
  onRemoveDuplicates?: () => void;
  onToggleFreezePanes?: () => void;
  isFrozenPanes?: boolean;
  onSpellCheck?: () => void;
  onToggleProtectSheet?: () => void;
  isSheetProtected?: boolean;
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
  onSetFontFamily,
  onSetFontSize,
  onCut,
  onCopy,
  onPaste,
  onFormatPainter,
  isFormatPainterActive = false,
  onToggleBorders,
  onToggleWrapText,
  onMergeAndCenter,
  onAdjustDecimals,
  onConditionalFormatting,
  onFormatAsTable,
  onInsertRowOrCol,
  onDeleteRowOrCol,
  onInsertChart,
  onToggleRawFormulas,
  showRawFormulas = false,
  onToggleFilter,
  isFilterActive = false,
  onTextToColumns,
  onRemoveDuplicates,
  onToggleFreezePanes,
  isFrozenPanes = false,
  onSpellCheck,
  onToggleProtectSheet,
  isSheetProtected = false,
}) => {
  const [activeTab, setActiveTab] = useState<ExcelRibbonTab>("inicio");
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fillColorOpen, setFillColorOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [autoSumMenuOpen, setAutoSumMenuOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [currentFormat, setCurrentFormat] = useState<string>("General");
  const [currentFont, setCurrentFont] = useState<string>("Calibri");
  const [currentFontSize, setCurrentFontSize] = useState<number>(11);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);

  // Referencias para popovers anclados con PortalMenu
  const fillButtonRef = useRef<HTMLButtonElement>(null);
  const textButtonRef = useRef<HTMLButtonElement>(null);
  const formatButtonRef = useRef<HTMLButtonElement>(null);
  const autoSumButtonRef = useRef<HTMLButtonElement>(null);
  const fontButtonRef = useRef<HTMLButtonElement>(null);

  // Estados interactivos para herramientas avanzadas de Excel
  const [activeDrawingTool, setActiveDrawingTool] = useState<string>("select");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [paperSize, setPaperSize] = useState<string>("A4 (21 x 29.7 cm)");
  const [margins, setMargins] = useState<string>("Normal");
  const [printAreaDefined, setPrintAreaDefined] = useState<boolean>(false);

  const fontLibraries = [
    { name: "Calibri", family: "Calibri, Carlito, sans-serif" },
    { name: "Arial", family: "Arial, Helvetica, sans-serif" },
    { name: "Segoe UI", family: "'Segoe UI', Roboto, sans-serif" },
    { name: "Consolas", family: "Consolas, 'Courier New', monospace" },
    { name: "Times New Roman", family: "'Times New Roman', Times, serif" },
    { name: "Georgia", family: "Georgia, serif" },
    { name: "Inter", family: "Inter, sans-serif" },
    { name: "Roboto", family: "Roboto, sans-serif" },
    { name: "Fira Code", family: "'Fira Code', monospace" },
    { name: "Trebuchet MS", family: "'Trebuchet MS', sans-serif" },
    { name: "Verdana", family: "Verdana, Geneva, sans-serif" },
    { name: "Garamond", family: "Garamond, serif" },
  ];

  const themeColors = [
    { name: "Sin relleno", color: "transparent" },
    { name: "Negro Carbón", color: "#111827" },
    { name: "Gris Grafito", color: "#4b5563" },
    { name: "Blanco Puro", color: "#ffffff" },
    { name: "Verde Excel", color: "#107c41" },
    { name: "Verde Menta", color: "#bbf7d0" },
    { name: "Celeste Suave", color: "#bae6fd" },
    { name: "Azul Marino", color: "#1e40af" },
    { name: "Amarillo Suave", color: "#fef08a" },
    { name: "Naranja Melocotón", color: "#fed7aa" },
    { name: "Rojo Tenue", color: "#fecaca" },
    { name: "Rojo Carmesí", color: "#dc2626" },
    { name: "Púrpura", color: "#7c3aed" },
  ];

  const textColors = [
    { name: "Automático (Negro)", color: "#111111" },
    { name: "Gris Grafito", color: "#4b5563" },
    { name: "Blanco", color: "#ffffff" },
    { name: "Verde Office", color: "#107c41" },
    { name: "Azul Marino", color: "#1e40af" },
    { name: "Rojo Carmesí", color: "#dc2626" },
    { name: "Naranja", color: "#ea580c" },
    { name: "Púrpura", color: "#7c3aed" },
  ];

  const [dialogState, setDialogState] = useState<{ title: string; msg: string } | null>(null);

  const notifyAdvancedDialog = (title: string, msg: string) => {
    setDialogState({ title, msg });
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
                  onClick={onPaste}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#f3f2f1] w-12 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                  title="Pegar (Ctrl+V)"
                >
                  <Clipboard size={20} className="text-[#107c41] mb-0.5" />
                  <span className="text-[10px] font-medium">Pegar</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={onCut}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Cortar (Ctrl+X)"
                  >
                    <Scissors size={12} />
                    <span>Cortar</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCopy}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Copiar (Ctrl+C)"
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={onFormatPainter}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                      isFormatPainterActive
                        ? "bg-[#107c41]/15 text-[#107c41] font-bold border border-[#107c41]/30"
                        : "hover:bg-[#f3f2f1]"
                    }`}
                    title="Copiar formato"
                  >
                    <Paintbrush size={12} className={isFormatPainterActive ? "text-[#107c41]" : ""} />
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
                  <div className="relative">
                    <button
                      ref={fontButtonRef}
                      type="button"
                      onClick={() => setFontMenuOpen(!fontMenuOpen)}
                      className="text-xs px-2 py-0.5 rounded border border-[#d2d0ce] font-medium w-28 bg-white flex items-center justify-between cursor-pointer hover:border-[#107c41]"
                      title="Familia tipográfica"
                    >
                      <span className="truncate">{currentFont}</span>
                      <ChevronDown size={11} className="text-stone-500 shrink-0 ml-1" />
                    </button>
                    <PortalMenu
                      isOpen={fontMenuOpen}
                      onClose={() => setFontMenuOpen(false)}
                      triggerRef={fontButtonRef}
                      width={180}
                    >
                      <div className="px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-[#e1dfdd]">
                        Fuentes disponibles
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1 max-h-48 overflow-y-auto">
                        {fontLibraries.map((f) => (
                          <button
                            key={f.name}
                            type="button"
                            onClick={() => {
                              setCurrentFont(f.name);
                              if (onSetFontFamily) onSetFontFamily(f.family);
                              setFontMenuOpen(false);
                            }}
                            className={`w-full px-2.5 py-1 text-xs text-left rounded hover:bg-[#e1f3e7] hover:text-[#107c41] cursor-pointer flex items-center justify-between ${
                              currentFont === f.name ? "bg-[#e1f3e7] font-bold text-[#107c41]" : ""
                            }`}
                            style={{ fontFamily: f.family }}
                          >
                            <span>{f.name}</span>
                          </button>
                        ))}
                      </div>
                    </PortalMenu>
                  </div>

                  <select
                    className="text-xs px-1 py-0.5 rounded border border-[#d2d0ce] font-medium w-12 bg-white text-center cursor-pointer"
                    value={currentFontSize}
                    onChange={(e) => {
                      const sz = Number(e.target.value);
                      setCurrentFontSize(sz);
                      if (onSetFontSize) onSetFontSize(sz);
                    }}
                    title="Tamaño de fuente"
                  >
                    {[9, 10, 11, 12, 14, 16, 18, 20, 24].map((s) => (
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
                    onClick={onToggleBorders}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] cursor-pointer"
                    title="Bordes de cuadrícula"
                  >
                    <Grid size={13} />
                  </button>

                  {/* Relleno de celda con PortalMenu para evitar recortes */}
                  <div>
                    <button
                      ref={fillButtonRef}
                      type="button"
                      onClick={() => setFillColorOpen(!fillColorOpen)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#107c41] cursor-pointer"
                      title="Color de relleno"
                    >
                      <PaintBucket size={13} />
                    </button>
                    <PortalMenu
                      isOpen={fillColorOpen}
                      onClose={() => setFillColorOpen(false)}
                      triggerRef={fillButtonRef}
                      width={180}
                    >
                      <div className="px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-[#e1dfdd]">
                        Color de relleno
                      </div>
                      <div className="grid grid-cols-1 gap-0.5 mt-1">
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
                              className="w-3.5 h-3.5 rounded border border-black/20 shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </PortalMenu>
                  </div>

                  {/* Color de texto con PortalMenu para evitar recortes */}
                  <div>
                    <button
                      ref={textButtonRef}
                      type="button"
                      onClick={() => setTextColorOpen(!textColorOpen)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#dc2626] cursor-pointer"
                      title="Color de texto"
                    >
                      <Palette size={13} />
                    </button>
                    <PortalMenu
                      isOpen={textColorOpen}
                      onClose={() => setTextColorOpen(false)}
                      triggerRef={textButtonRef}
                      width={180}
                    >
                      <div className="px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-[#e1dfdd]">
                        Color de fuente
                      </div>
                      <div className="grid grid-cols-1 gap-0.5 mt-1">
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
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                              style={{ backgroundColor: tc.color }}
                            />
                            <span className="truncate">{tc.name}</span>
                          </button>
                        ))}
                      </div>
                    </PortalMenu>
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
                    onClick={onToggleWrapText}
                    className="px-1.5 py-0.5 rounded bg-black/5 hover:bg-black/10 font-medium cursor-pointer"
                    title="Ajustar texto automáticamente"
                  >
                    Ajustar texto
                  </button>
                  <button
                    type="button"
                    onClick={onMergeAndCenter}
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
                <div>
                  <button
                    ref={formatButtonRef}
                    type="button"
                    onClick={() => setFormatMenuOpen(!formatMenuOpen)}
                    className="w-34 px-2 py-0.5 text-xs rounded border border-[#d2d0ce] bg-white flex items-center justify-between font-medium cursor-pointer hover:border-[#107c41]"
                  >
                    <span>{currentFormat}</span>
                    <ChevronDown size={11} className="text-stone-500" />
                  </button>
                  <PortalMenu
                    isOpen={formatMenuOpen}
                    onClose={() => setFormatMenuOpen(false)}
                    triggerRef={formatButtonRef}
                    width={180}
                  >
                    <div className="px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-[#e1dfdd]">
                      Formato numérico
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
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
                          className={`w-full px-2 py-1 text-xs hover:bg-[#e1f3e7] hover:text-[#107c41] rounded text-left cursor-pointer ${
                            currentFormat === item.label ? "bg-[#e1f3e7] font-semibold text-[#107c41]" : ""
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </PortalMenu>
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
                    onClick={() => onAdjustDecimals && onAdjustDecimals(1)}
                    className="px-1 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] font-mono text-[10px] cursor-pointer"
                    title="Aumentar decimales"
                  >
                    .00
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdjustDecimals && onAdjustDecimals(-1)}
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
                  onClick={onConditionalFormatting}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <Sliders size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Formato condicional</span>
                </button>
                <button
                  type="button"
                  onClick={onFormatAsTable}
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
                  onClick={() => onInsertRowOrCol && onInsertRowOrCol("row")}
                  className="px-2 py-0.5 rounded text-[11px] bg-black/5 hover:bg-[#e1f3e7] hover:text-[#107c41] font-medium text-left cursor-pointer"
                >
                  + Insertar celdas
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRowOrCol && onDeleteRowOrCol("row")}
                  className="px-2 py-0.5 rounded text-[11px] bg-black/5 hover:bg-rose-50 hover:text-rose-600 font-medium text-left cursor-pointer"
                >
                  - Eliminar celdas
                </button>
                <button
                  type="button"
                  onClick={onToggleWrapText}
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
                {/* Menú de Autosuma con PortalMenu */}
                <div>
                  <button
                    ref={autoSumButtonRef}
                    type="button"
                    onClick={() => setAutoSumMenuOpen(!autoSumMenuOpen)}
                    className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                  >
                    <Sigma size={20} className="text-[#107c41] mb-0.5" />
                    <span className="text-[10px] font-bold">Autosuma</span>
                  </button>
                  <PortalMenu
                    isOpen={autoSumMenuOpen}
                    onClose={() => setAutoSumMenuOpen(false)}
                    triggerRef={autoSumButtonRef}
                    width={160}
                  >
                    <div className="px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-[#e1dfdd]">
                      Funciones rápidas
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onInsertAutoSum();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#e1f3e7] hover:text-[#107c41] rounded text-left font-bold cursor-pointer"
                      >
                        SUMA
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertAverage();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#e1f3e7] hover:text-[#107c41] rounded text-left cursor-pointer"
                      >
                        PROMEDIO
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertCount();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#e1f3e7] hover:text-[#107c41] rounded text-left cursor-pointer"
                      >
                        CONTAR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertMax();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#e1f3e7] hover:text-[#107c41] rounded text-left cursor-pointer"
                      >
                        MAX
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onInsertMin();
                          setAutoSumMenuOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#e1f3e7] hover:text-[#107c41] rounded text-left cursor-pointer"
                      >
                        MIN
                      </button>
                    </div>
                  </PortalMenu>
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
                  onClick={onFormatAsTable}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <TableIcon size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={onFormatAsTable}
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
                  onClick={() => onInsertChart && onInsertChart("bar")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <BarChart2 size={20} className="text-blue-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Columnas</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInsertChart && onInsertChart("line")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <LineChart size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Líneas</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInsertChart && onInsertChart("pie")}
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
                  onClick={() => onInsertChart && onInsertChart("bar")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <Sparkles size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ilustraciones</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleWrapText}
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
                  onClick={onInsertAutoSum}
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
                  onClick={onInsertAutoSum}
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
                    onClick={onInsertAverage}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] text-left cursor-pointer"
                  >
                    Financieras
                  </button>
                  <button
                    type="button"
                    onClick={onInsertCount}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] text-left cursor-pointer"
                  >
                    Lógicas
                  </button>
                  <button
                    type="button"
                    onClick={onInsertMax}
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
                  onClick={onSortAsc}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] font-medium text-left cursor-pointer"
                >
                  Administrador de nombres
                </button>
                <button
                  type="button"
                  onClick={onSortDesc}
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
                  onClick={onToggleRawFormulas}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Binary size={18} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Rastrear precedentes</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleRawFormulas}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-18 h-15 cursor-pointer transition-colors ${
                    showRawFormulas
                      ? "bg-[#107c41]/15 text-[#107c41] font-bold border border-[#107c41]/30"
                      : "hover:bg-[#f3f2f1] text-stone-700"
                  }`}
                >
                  <Eye size={18} className="text-blue-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Mostrar fórmulas</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleRawFormulas}
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
                  onClick={onSortAsc}
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
                  onClick={onToggleFilter}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer transition-colors ${
                    isFilterActive ? "bg-[#107c41] text-white border-[#0e6b37]" : "hover:bg-[#f3f2f1] border-transparent"
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
                  onClick={onTextToColumns}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] text-[11px] text-left cursor-pointer"
                >
                  Texto en columnas
                </button>
                <button
                  type="button"
                  onClick={onTextToColumns}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] text-[11px] text-left cursor-pointer"
                >
                  Relleno rápido
                </button>
                <button
                  type="button"
                  onClick={onRemoveDuplicates}
                  className="px-2 py-1 rounded bg-black/5 hover:bg-[#f3f2f1] text-[11px] text-left cursor-pointer"
                >
                  Quitar duplicados
                </button>
                <button
                  type="button"
                  onClick={onConditionalFormatting}
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
                  onClick={onSortAsc}
                  className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                >
                  Agrupar
                </button>
                <button
                  type="button"
                  onClick={onSortDesc}
                  className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#f3f2f1] text-xs font-medium cursor-pointer"
                >
                  Desagrupar
                </button>
                <button
                  type="button"
                  onClick={onInsertAutoSum}
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
                  onClick={onSpellCheck}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <ShieldCheck size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ortografía</span>
                </button>
                <button
                  type="button"
                  onClick={onSpellCheck}
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
                  onClick={onToggleWrapText}
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
                  onClick={onToggleProtectSheet}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-18 h-15 cursor-pointer transition-colors ${
                    isSheetProtected
                      ? "bg-amber-100 border border-amber-300 text-amber-900 font-bold"
                      : "hover:bg-[#f3f2f1] text-emerald-700"
                  }`}
                >
                  <ShieldCheck size={20} className="text-emerald-700 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {isSheetProtected ? "Desproteger" : "Proteger hoja"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onToggleProtectSheet}
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
                  onClick={onToggleGridlines}
                  className="flex flex-col items-center justify-center p-1.5 rounded bg-[#107c41]/10 text-[#107c41] font-bold w-16 h-15 cursor-pointer"
                >
                  <Grid size={20} className="mb-1" />
                  <span className="text-[10px]">Normal</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleGridlines}
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
                  onClick={onToggleFreezePanes}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-20 h-15 cursor-pointer transition-colors ${
                    isFrozenPanes
                      ? "bg-[#107c41]/15 text-[#107c41] font-bold border border-[#107c41]/30"
                      : "hover:bg-[#f3f2f1] text-stone-700"
                  }`}
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
                  onClick={() =>
                    notifyAdvancedDialog(
                      "Atajos de CoffeCalc",
                      "Ctrl+S: Guardar libro\nCtrl+N: Nuevo libro\nCtrl+P: Imprimir vista\nF2: Activar edición de celda\nCtrl+B: Alternar negrita\nCtrl+I: Alternar cursiva\nCtrl+U: Alternar subrayado"
                    )
                  }
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <HelpCircle size={20} className="text-[#107c41] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    notifyAdvancedDialog(
                      "Acerca de CoffeCalc",
                      "CoffeCalc Suite 2026\nMotor de Hoja de Cálculo Matricial Avanzado y Fórmulas.\nTotalmente compatible con Microsoft Excel (.xlsx), .cfs y CSV."
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

      {/* Diálogo emergente estilizado para configuración y ayuda de CoffeCalc */}
      {dialogState && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#107c41] px-4 py-2.5 flex items-center justify-between text-white">
              <span className="font-semibold text-xs tracking-wide">{dialogState.title}</span>
              <button
                type="button"
                onClick={() => setDialogState(null)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 text-xs text-stone-700 whitespace-pre-line leading-relaxed">
              {dialogState.msg}
            </div>
            <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setDialogState(null)}
                className="px-4 py-1.5 bg-[#107c41] text-white rounded text-xs font-medium hover:bg-[#0e6b37] transition-colors cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
