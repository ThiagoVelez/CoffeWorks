import React, { useState, useRef } from "react";
import {
  Clipboard,
  Scissors,
  Copy,
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Highlighter,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Outdent,
  Indent,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  Minus,
  Search,
  Replace,
  FileText,
  FilePlus,
  Save,
  Download,
  Printer,
  ChevronDown,
  SpellCheck,
  Maximize2,
  Sun,
  Moon,
  Keyboard,
  Info,
  Check,
  ArrowDownRight,
  PenTool,
  Pencil,
  Eraser,
  Sparkles,
  Layers,
  Droplet,
  Stamp,
  BookOpen,
  Quote,
  Bookmark,
  Languages,
  MessageSquare,
  ShieldCheck,
  Split,
  Users,
  Send,
  Type,
  Globe,
  Square,
  Circle,
  ArrowRight,
  Star,
  Triangle,
} from "lucide-react";
import type { DocumentTheme } from "../types";
import { PortalMenu } from "./PortalMenu";

export type RibbonTab =
  | "inicio"
  | "insertar"
  | "dibujar"
  | "diseno"
  | "disposicion"
  | "referencias"
  | "correspondencia"
  | "revisar"
  | "vista"
  | "ayuda";

interface WordRibbonProps {
  onExecuteCommand: (command: string, value?: string) => void;
  onNewDocument: () => void;
  onSave: () => void;
  onOpenExport: () => void;
  onPrint: () => void;
  onInsertTable: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onOpenFindReplace: () => void;
  onOpenWordCount: () => void;
  onOpenHelp: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  theme: DocumentTheme;
  onToggleTheme: () => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  lineSpacing: string;
  onSetLineSpacing: (spacing: string) => void;
  margins?: string;
  onSetMargins?: (margins: string) => void;
  columnsCount?: number;
  onSetColumnsCount?: (cols: number) => void;
  watermark?: string;
  onSetWatermark?: (watermark: string) => void;
}

const RibbonGroupFooter: React.FC<{
  label: string;
  onOpenDialog?: () => void;
  dialogTitle?: string;
  isLight: boolean;
}> = ({ label, onOpenDialog, dialogTitle, isLight }) => (
  <div className="flex items-center justify-between mt-auto pt-0.5 px-0.5 border-t border-transparent select-none">
    <span
      className={`flex-1 font-mono text-[9px] text-center tracking-wider uppercase font-semibold truncate ${
        isLight ? "text-[#605e5c]" : "text-outline/80"
      }`}
    >
      {label}
    </span>
    {onOpenDialog && (
      <button
        type="button"
        onClick={onOpenDialog}
        title={dialogTitle || `Configuración avanzada de ${label}`}
        className={`w-3.5 h-3.5 -mr-0.5 flex items-center justify-center rounded transition-colors text-[9px] cursor-pointer ${
          isLight
            ? "text-[#605e5c] hover:text-[#185abd] hover:bg-[#edebe9]"
            : "text-outline/80 hover:text-primary hover:bg-[#2b2522]"
        }`}
      >
        <ArrowDownRight size={10} strokeWidth={2.5} />
      </button>
    )}
  </div>
);

export const WordRibbon: React.FC<WordRibbonProps> = ({
  onExecuteCommand,
  onNewDocument,
  onSave,
  onOpenExport,
  onPrint,
  onInsertTable,
  onInsertLink,
  onInsertImage,
  onOpenFindReplace,
  onOpenWordCount,
  onOpenHelp,
  zenMode,
  onToggleZenMode,
  showRuler,
  onToggleRuler,
  outlineOpen,
  onToggleOutline,
  theme,
  onToggleTheme,
  zoom,
  onZoomChange,
  lineSpacing,
  onSetLineSpacing,
  margins: externalMargins,
  onSetMargins,
  columnsCount: externalColumnsCount,
  onSetColumnsCount,
  watermark,
  onSetWatermark,
}) => {
  const [activeTab, setActiveTab] = useState<RibbonTab>("inicio");
  const [fileMenuOpen, setFileMenuOpen] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<string>("Calibri");
  const [fontSize, setFontSize] = useState<number>(11);

  // Estados y Refs para los menús desplegables con PortalMenu (sin recorte)
  const [textColorOpen, setTextColorOpen] = useState<boolean>(false);
  const textColorBtnRef = useRef<HTMLButtonElement>(null);

  const [highlightOpen, setHighlightOpen] = useState<boolean>(false);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);

  const [lineSpacingOpen, setLineSpacingOpen] = useState<boolean>(false);
  const lineSpacingBtnRef = useRef<HTMLButtonElement>(null);

  const [shapesMenuOpen, setShapesMenuOpen] = useState<boolean>(false);
  const shapesBtnRef = useRef<HTMLButtonElement>(null);

  const [tableMenuOpen, setTableMenuOpen] = useState<boolean>(false);
  const tableBtnRef = useRef<HTMLButtonElement>(null);

  const [activeDrawingTool, setActiveDrawingTool] = useState<string>("select");
  const [activeThemeName, setActiveThemeName] = useState<string>("Office");
  const [localMargins, setLocalMargins] = useState<string>("Normal (2.5 cm)");
  const margins = externalMargins || localMargins;
  const setMargins = (val: string) => {
    setLocalMargins(val);
    if (onSetMargins) onSetMargins(val);
  };
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [paperSize, setPaperSize] = useState<string>("A4 (21 x 29.7 cm)");
  const [localColumnsCount, setLocalColumnsCount] = useState<number>(1);
  const columnsCount = externalColumnsCount !== undefined ? externalColumnsCount : localColumnsCount;
  const setColumnsCount = (cols: number) => {
    setLocalColumnsCount(cols);
    if (onSetColumnsCount) onSetColumnsCount(cols);
  };
  const [indentLeft, setIndentLeft] = useState<number>(0);
  const [indentRight, setIndentRight] = useState<number>(0);
  const [spaceBefore, setSpaceBefore] = useState<number>(0);
  const [spaceAfter, setSpaceAfter] = useState<number>(8);
  const [citationStyle, setCitationStyle] = useState<string>("APA 7ma Edición");

  // Paleta completa de colores de texto estilo Office
  const textColors = [
    { name: "Automático (Negro)", color: "#111111" },
    { name: "Azul Microsoft Word", color: "#185abd" },
    { name: "Azul Marino Oscuro", color: "#103f7a" },
    { name: "Verde Esmeralda", color: "#107c41" },
    { name: "Rojo Carmesí", color: "#dc2626" },
    { name: "Naranja Ámbar", color: "#d97706" },
    { name: "Púrpura Imperial", color: "#7c3aed" },
    { name: "Gris Oscuro", color: "#4b5563" },
    { name: "Gris Claro", color: "#9ca3af" },
  ];

  // Paleta de resaltado
  const highlightColors = [
    { name: "Sin color", color: "transparent" },
    { name: "Amarillo Fluorescente", color: "#fef08a" },
    { name: "Verde Menta", color: "#bbf7d0" },
    { name: "Celeste Cielo", color: "#bae6fd" },
    { name: "Rosa Chicle", color: "#fbcfe8" },
    { name: "Lavanda Suave", color: "#e9d5ff" },
    { name: "Ámbar Cálido", color: "#fed7aa" },
  ];

  // Catálogo completo de fuentes tipográficas
  const fontLibraries = [
    { name: "Calibri", family: "Calibri, sans-serif" },
    { name: "Segoe UI", family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
    { name: "Arial", family: "Arial, Helvetica, sans-serif" },
    { name: "Times New Roman", family: "'Times New Roman', Times, serif" },
    { name: "Georgia", family: "Georgia, serif" },
    { name: "Garamond", family: "Garamond, serif" },
    { name: "Palatino", family: "'Palatino Linotype', Book Antiqua, Palatino, serif" },
    { name: "Verdana", family: "Verdana, Geneva, Tahoma, sans-serif" },
    { name: "Trebuchet MS", family: "'Trebuchet MS', Helvetica, sans-serif" },
    { name: "Hanken Grotesk", family: "'Hanken Grotesk', sans-serif" },
    { name: "Inter", family: "Inter, sans-serif" },
    { name: "JetBrains Mono", family: "'JetBrains Mono', monospace" },
    { name: "Courier New", family: "'Courier New', Courier, monospace" },
    { name: "Impact", family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
  ];

  const changeFontSize = (delta: number) => {
    const next = Math.max(8, Math.min(72, fontSize + delta));
    setFontSize(next);
    onExecuteCommand(
      "fontSize",
      next <= 10 ? "2" : next <= 12 ? "3" : next <= 16 ? "4" : next <= 24 ? "5" : "6"
    );
  };

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    onExecuteCommand("fontName", font);
  };

  // Función robusta para insertar listas ordenadas y evitar problemas de foco
  const handleInsertOrderedList = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
      onExecuteCommand(
        "insertHTML",
        "<ol><li>Primer elemento</li><li>Segundo elemento</li><li>Tercer elemento</li></ol><p></p>"
      );
    } else {
      onExecuteCommand("insertOrderedList");
    }
  };

  // Función robusta para insertar viñetas
  const handleInsertUnorderedList = (e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
      onExecuteCommand(
        "insertHTML",
        "<ul><li>Elemento principal</li><li>Elemento secundario</li></ul><p></p>"
      );
    } else {
      onExecuteCommand("insertUnorderedList");
    }
  };

  // Inserción de formas y figuras geométricas en el documento
  const handleInsertShape = (shapeType: string) => {
    setShapesMenuOpen(false);
    let html = "";
    if (shapeType === "rectangle") {
      html = `<div style="display:inline-block; margin:8px; border:2px solid #185abd; background:#e8f1fc; width:130px; height:65px; border-radius:4px; text-align:center; line-height:65px; color:#185abd; font-size:12px; font-weight:600; user-select:none;">Rectángulo</div>`;
    } else if (shapeType === "rounded") {
      html = `<div style="display:inline-block; margin:8px; border:2px solid #185abd; background:#e8f1fc; width:130px; height:65px; border-radius:24px; text-align:center; line-height:65px; color:#185abd; font-size:12px; font-weight:600; user-select:none;">Redondeado</div>`;
    } else if (shapeType === "circle") {
      html = `<div style="display:inline-block; margin:8px; border:2px solid #107c41; background:#e1f3e7; width:75px; height:75px; border-radius:50%; text-align:center; line-height:75px; color:#107c41; font-size:12px; font-weight:600; user-select:none;">Círculo</div>`;
    } else if (shapeType === "triangle") {
      html = `<svg width="80" height="70" viewBox="0 0 80 70" style="display:inline-block; margin:8px; vertical-align:middle;"><polygon points="40,5 75,65 5,65" fill="#fef08a" stroke="#ca8a04" stroke-width="2" /></svg>`;
    } else if (shapeType === "arrow-right") {
      html = `<svg width="100" height="40" viewBox="0 0 100 40" style="display:inline-block; margin:8px; vertical-align:middle;"><path d="M5,14 L65,14 L65,4 L95,20 L65,36 L65,26 L5,26 Z" fill="#185abd" stroke="#0e4594" stroke-width="1.5" /></svg>`;
    } else if (shapeType === "star") {
      html = `<svg width="70" height="70" viewBox="0 0 100 100" style="display:inline-block; margin:8px; vertical-align:middle;"><polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="#f59e0b" stroke="#d97706" stroke-width="2" /></svg>`;
    } else if (shapeType === "callout") {
      html = `<div style="display:inline-block; margin:8px; background:#f3f2f1; border:2px solid #605e5c; border-radius:8px; padding:8px 14px; font-size:12px; color:#323130;">Mensaje o llamada de atención</div>`;
    }
    onExecuteCommand("insertHTML", html + "&nbsp;");
  };

  // Inserción de tabla interactiva con filas y columnas personalizadas
  const handleInsertGridTable = (rows: number, cols: number, styleName: "azul" | "verde" | "clasica" = "azul") => {
    setTableMenuOpen(false);
    const thBg = styleName === "azul" ? "#185abd" : styleName === "verde" ? "#107c41" : "#f3f2f1";
    const thColor = styleName === "clasica" ? "#201f1e" : "#ffffff";
    let html = `<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;"><thead><tr>`;
    for (let c = 1; c <= cols; c++) {
      html += `<th style="background:${thBg}; color:${thColor}; border:1px solid #d2d0ce; padding:8px 12px; text-align:left; font-weight:600;">Encabezado ${c}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (let r = 1; r <= rows; r++) {
      const bg = r % 2 === 0 ? "#fbf9f6" : "#ffffff";
      html += `<tr style="background:${bg};">`;
      for (let c = 1; c <= cols; c++) {
        html += `<td style="border:1px solid #d2d0ce; padding:8px 12px;">Fila ${r}, Celda ${c}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table><p></p>`;
    onExecuteCommand("insertHTML", html);
    if (onInsertTable) onInsertTable();
  };

  const notifyAdvancedDialog = (title: string, msg: string) => {
    alert(`[Cuadro de Diálogo - ${title}]\n${msg}`);
  };

  const isLight = theme === "paper-white";

  const tabs: Array<{ id: RibbonTab; label: string }> = [
    { id: "inicio", label: "Inicio" },
    { id: "insertar", label: "Insertar" },
    { id: "dibujar", label: "Dibujar" },
    { id: "diseno", label: "Diseño" },
    { id: "disposicion", label: "Disposición" },
    { id: "referencias", label: "Referencias" },
    { id: "correspondencia", label: "Correspondencia" },
    { id: "revisar", label: "Revisar" },
    { id: "vista", label: "Vista" },
    { id: "ayuda", label: "Ayuda" },
  ];

  return (
    <div
      className={`border-b flex flex-col select-none relative z-40 shadow-xs transition-colors ${
        isLight
          ? "bg-[#ffffff] border-[#d2d0ce] text-[#323130]"
          : "bg-[#231f1d] border-[#3d3836] text-[#eae0dd]"
      }`}
    >
      {/* 1. FILA DE PESTAÑAS DE LA CINTA */}
      <div
        className={`flex items-center px-2 pt-1 border-b gap-0.5 text-xs transition-colors overflow-x-auto ${
          isLight ? "bg-[#f3f2f1] border-[#e1dfdd]" : "bg-[#1a1715] border-[#35302d]"
        }`}
      >
        <div className="relative mr-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-4 py-1.5 rounded-t bg-[#185abd] text-white font-bold hover:bg-[#104896] transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <span>Archivo</span>
            <ChevronDown size={11} />
          </button>

          {fileMenuOpen && (
            <div
              className={`absolute left-0 mt-1 w-64 rounded-xl border shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 font-sans ${
                isLight
                  ? "bg-white border-[#d2d0ce] text-[#201f1e]"
                  : "bg-surface-container-high border-outline-variant/40 text-on-surface"
              }`}
              onClick={() => setFileMenuOpen(false)}
            >
              <button
                type="button"
                onClick={onNewDocument}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus size={15} className="text-[#185abd]" />
                  Nuevo documento
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+N</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Save size={15} className="text-emerald-600" />
                  Guardar
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+S</span>
              </button>
              <div className="h-px bg-stone-200 my-1" />
              <button
                type="button"
                onClick={onOpenExport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={15} className="text-[#185abd]" />
                  Exportar / Guardar como...
                </span>
                <span className="font-mono text-[10px] text-stone-400">.docx, .cfd</span>
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Printer size={15} className="text-stone-500" />
                  Imprimir / PDF
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

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
              className={`px-3 py-1.5 font-medium transition-colors text-xs whitespace-nowrap cursor-pointer ${
                isActive
                  ? isLight
                    ? "border-b-[3px] border-[#185abd] text-[#185abd] font-bold bg-[#ffffff]"
                    : "border-b-2 border-primary text-primary font-bold bg-[#231f1d]"
                  : isLight
                  ? "border-b-[3px] border-transparent text-[#605e5c] hover:text-[#201f1e] hover:bg-[#edebe9]"
                  : "border-b-2 border-transparent text-outline hover:text-on-surface hover:bg-[#201c1a]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. CUERPO DE LA CINTA RIBBON */}
      <div
        className={`h-25 px-2.5 py-1 flex items-stretch gap-2 overflow-x-auto transition-colors ${
          isLight ? "bg-[#ffffff] text-[#201f1e]" : "bg-[#231f1d] text-[#eae0dd]"
        }`}
      >
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* GRUPO PORTAPAPELES */}
            <div
              className={`flex flex-col justify-between pr-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onExecuteCommand("paste")}
                  title="Pegar (Ctrl + V)"
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-black/5 w-12 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <Clipboard size={20} className={`${isLight ? "text-[#185abd]" : "text-primary"} mb-0.5`} />
                  <span className="text-[10px] leading-tight font-medium">Pegar</span>
                </button>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("cut")}
                    title="Cortar (Ctrl + X)"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-black/5 cursor-pointer"
                  >
                    <Scissors size={12} />
                    <span>Cortar</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("copy")}
                    title="Copiar (Ctrl + C)"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-black/5 cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => alert("Formato copiado. Aplica sobre el texto deseado.")}
                    title="Copiar formato"
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-black/5 cursor-pointer"
                  >
                    <Paintbrush size={12} />
                    <span>Copiar formato</span>
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Portapapeles"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Portapapeles", "Historial de pegado y pegado sin formato.")
                }
              />
            </div>

            {/* GRUPO FUENTE */}
            <div
              className={`flex flex-col justify-between px-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-1">
                  {/* Selector con catálogo enriquecido de fuentes */}
                  <select
                    value={fontFamily}
                    onChange={(e) => handleFontChange(e.target.value)}
                    className="text-xs px-2 py-0.5 rounded border border-[#d2d0ce] font-medium w-36 bg-white cursor-pointer"
                  >
                    {fontLibraries.map((f) => (
                      <option key={f.name} value={f.name} style={{ fontFamily: f.family }}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center border rounded px-1 gap-1">
                    <span className="font-mono text-xs w-5 text-center">{fontSize}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => changeFontSize(1)}
                      className="hover:text-primary font-bold px-0.5 cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => changeFontSize(-1)}
                      className="hover:text-primary font-bold px-0.5 cursor-pointer"
                    >
                      -
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("bold")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 font-bold cursor-pointer"
                    title="Negrita (Ctrl + B)"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("italic")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 italic cursor-pointer"
                    title="Cursiva (Ctrl + I)"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("underline")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 underline cursor-pointer"
                    title="Subrayado (Ctrl + U)"
                  >
                    <Underline size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("strikeThrough")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                    title="Tachado"
                  >
                    <Strikethrough size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("subscript")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                    title="Subíndice"
                  >
                    <Subscript size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("superscript")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                    title="Superíndice"
                  >
                    <Superscript size={13} />
                  </button>

                  {/* Color de fuente con PortalMenu flotante (libre de recortes) */}
                  <button
                    ref={textColorBtnRef}
                    type="button"
                    onClick={() => setTextColorOpen(!textColorOpen)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-[#185abd] cursor-pointer"
                    title="Color de fuente"
                  >
                    <Palette size={13} />
                  </button>
                  <PortalMenu
                    isOpen={textColorOpen}
                    onClose={() => setTextColorOpen(false)}
                    triggerRef={textColorBtnRef}
                    width={180}
                  >
                    <div className="px-2 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b pb-1 mb-1">
                      Colores del tema
                    </div>
                    {textColors.map((tc) => (
                      <button
                        key={tc.color}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onExecuteCommand("foreColor", tc.color);
                          setTextColorOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: tc.color }}
                        />
                        <span className="truncate">{tc.name}</span>
                      </button>
                    ))}
                  </PortalMenu>

                  {/* Color de resaltado con PortalMenu */}
                  <button
                    ref={highlightBtnRef}
                    type="button"
                    onClick={() => setHighlightOpen(!highlightOpen)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-amber-500 cursor-pointer"
                    title="Color de resaltado"
                  >
                    <Highlighter size={13} />
                  </button>
                  <PortalMenu
                    isOpen={highlightOpen}
                    onClose={() => setHighlightOpen(false)}
                    triggerRef={highlightBtnRef}
                    width={190}
                  >
                    <div className="px-2 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b pb-1 mb-1">
                      Color de resaltado de texto
                    </div>
                    {highlightColors.map((hc) => (
                      <button
                        key={hc.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onExecuteCommand("hiliteColor", hc.color);
                          setHighlightOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded border border-black/20 shrink-0"
                          style={{ backgroundColor: hc.color }}
                        />
                        <span className="truncate">{hc.name}</span>
                      </button>
                    ))}
                  </PortalMenu>
                </div>
              </div>
              <RibbonGroupFooter
                label="Fuente"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Fuente", "Configuraciones tipográficas avanzadas y ligaduras OpenType.")
                }
              />
            </div>

            {/* GRUPO PÁRRAFO (CON REPARACIÓN DE LISTAS 1. 2. 3. Y VIÑETAS) */}
            <div
              className={`flex flex-col justify-between px-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-0.5">
                  {/* Botón Viñetas */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInsertUnorderedList}
                    title="Viñetas con puntos"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <List size={13} />
                  </button>

                  {/* Botón Lista numerada 1. 2. 3. (Reparado) */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInsertOrderedList}
                    title="Numeración (1. 2. 3.)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <ListOrdered size={13} />
                  </button>

                  {/* Botón Lista de tareas con casillas */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      onExecuteCommand(
                        "insertHTML",
                        "<ul style='list-style:none; padding-left:0.5rem;'><li><input type='checkbox' checked style='margin-right:8px;' /> Tarea completada</li><li><input type='checkbox' style='margin-right:8px;' /> Tarea pendiente</li></ul><p></p>"
                      )
                    }
                    title="Lista de tareas (Checklist)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <CheckSquare size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("outdent")}
                    title="Disminuir sangría"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <Outdent size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("indent")}
                    title="Aumentar sangría"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <Indent size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("justifyLeft")}
                    title="Alinear a la izquierda"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("justifyCenter")}
                    title="Centrar"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignCenter size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("justifyRight")}
                    title="Alinear a la derecha"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignRight size={13} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("justifyFull")}
                    title="Justificar"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignJustify size={13} />
                  </button>

                  {/* Interlineado con PortalMenu */}
                  <button
                    ref={lineSpacingBtnRef}
                    type="button"
                    onClick={() => setLineSpacingOpen(!lineSpacingOpen)}
                    title={`Espaciado entre líneas (${lineSpacing})`}
                    className="px-1 py-0.5 flex items-center gap-0.5 rounded hover:bg-black/5 text-xs cursor-pointer"
                  >
                    <span className="font-mono text-[10px]">{lineSpacing}</span>
                    <ChevronDown size={9} />
                  </button>
                  <PortalMenu
                    isOpen={lineSpacingOpen}
                    onClose={() => setLineSpacingOpen(false)}
                    triggerRef={lineSpacingBtnRef}
                    width={130}
                  >
                    {["1.0", "1.15", "1.5", "2.0", "2.5", "3.0"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          onSetLineSpacing(s);
                          setLineSpacingOpen(false);
                        }}
                        className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded flex items-center justify-between text-left cursor-pointer"
                      >
                        <span>{s} líneas</span>
                        {lineSpacing === s && <Check size={11} className="text-[#185abd]" />}
                      </button>
                    ))}
                  </PortalMenu>
                </div>
              </div>
              <RibbonGroupFooter
                label="Párrafo"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Párrafo", "Alineación, espaciado anterior y posterior en puntos.")
                }
              />
            </div>

            {/* GRUPO ESTILOS */}
            <div
              className={`flex flex-col justify-between px-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1 flex-1 items-center">
                {[
                  { tag: "p", title: "Normal", preview: "AaBbCc" },
                  { tag: "h1", title: "Título 1", preview: "AaBbCc" },
                  { tag: "h2", title: "Título 2", preview: "AaBbCc" },
                  { tag: "h3", title: "Título 3", preview: "AaBbCc" },
                  { tag: "blockquote", title: "Cita", preview: "AaBbCc" },
                ].map((st) => (
                  <button
                    key={st.tag}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onExecuteCommand("formatBlock", st.tag)}
                    className={`flex flex-col items-center justify-center px-1.5 py-1 rounded transition-all w-14 h-15 group border cursor-pointer ${
                      isLight
                        ? "bg-white hover:bg-[#f3f2f1] border-[#d2d0ce] hover:border-[#185abd]"
                        : "bg-[#1c1917] hover:bg-[#2b2522] border-[#3d3836] hover:border-primary"
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${
                        st.tag === "h1"
                          ? "text-[#185abd] text-sm font-bold"
                          : st.tag === "h2"
                          ? "text-[#2b579a] font-bold"
                          : "text-inherit"
                      }`}
                    >
                      {st.preview}
                    </span>
                    <span className="text-[9px] truncate max-w-full text-stone-500">
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
              <RibbonGroupFooter
                label="Estilos"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Estilos", "Creación y administración de estilos CSS.")
                }
              />
            </div>

            {/* GRUPO EDICIÓN */}
            <div className="flex flex-col justify-between pl-1">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <button
                  type="button"
                  onClick={onOpenFindReplace}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] hover:bg-black/5 cursor-pointer"
                >
                  <Search size={13} className="text-[#185abd]" />
                  <span>Buscar</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenFindReplace}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] hover:bg-black/5 cursor-pointer"
                >
                  <Replace size={13} className="text-[#2b579a]" />
                  <span>Reemplazar</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Edición"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <>
            {/* GRUPO TABLAS CON MENÚ DE PLANTILLAS DE TABLA */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  ref={tableBtnRef}
                  type="button"
                  onClick={() => setTableMenuOpen(!tableMenuOpen)}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-16 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <TableIcon size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium flex items-center gap-0.5">
                    <span>Tabla</span>
                    <ChevronDown size={8} />
                  </span>
                </button>

                <PortalMenu
                  isOpen={tableMenuOpen}
                  onClose={() => setTableMenuOpen(false)}
                  triggerRef={tableBtnRef}
                  width={220}
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b pb-1 mb-1">
                    Insertar tabla rápida
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1">
                    <button
                      type="button"
                      onClick={() => handleInsertGridTable(2, 2, "azul")}
                      className="px-2 py-1.5 text-xs bg-black/5 hover:bg-[#185abd]/10 hover:text-[#185abd] rounded font-medium text-left cursor-pointer"
                    >
                      Tabla 2 x 2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertGridTable(3, 3, "azul")}
                      className="px-2 py-1.5 text-xs bg-black/5 hover:bg-[#185abd]/10 hover:text-[#185abd] rounded font-medium text-left cursor-pointer"
                    >
                      Tabla 3 x 3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertGridTable(4, 3, "verde")}
                      className="px-2 py-1.5 text-xs bg-black/5 hover:bg-[#107c41]/10 hover:text-[#107c41] rounded font-medium text-left cursor-pointer"
                    >
                      Tabla 4 x 3
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertGridTable(5, 4, "clasica")}
                      className="px-2 py-1.5 text-xs bg-black/5 hover:bg-black/10 rounded font-medium text-left cursor-pointer"
                    >
                      Tabla 5 x 4
                    </button>
                  </div>
                </PortalMenu>
              </div>
              <RibbonGroupFooter
                label="Tablas"
                isLight={isLight}
              />
            </div>

            {/* GRUPO ILUSTRACIONES & FORMAS GEOMÉTRICAS */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onInsertImage}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <ImageIcon size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium">Imágenes</span>
                </button>

                {/* Librería de formas y figuras geométricas */}
                <button
                  ref={shapesBtnRef}
                  type="button"
                  onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <Square size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium flex items-center gap-0.5">
                    <span>Formas</span>
                    <ChevronDown size={8} />
                  </span>
                </button>

                <PortalMenu
                  isOpen={shapesMenuOpen}
                  onClose={() => setShapesMenuOpen(false)}
                  triggerRef={shapesBtnRef}
                  width={250}
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b pb-1 mb-1">
                    Librería de formas geométricas
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1">
                    <button
                      type="button"
                      onClick={() => handleInsertShape("rectangle")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <Square size={14} className="text-[#185abd]" />
                      <span>Rectángulo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertShape("rounded")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <Square size={14} className="text-[#185abd] rounded-md" />
                      <span>Redondeado</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertShape("circle")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <Circle size={14} className="text-[#107c41]" />
                      <span>Círculo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertShape("triangle")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <Triangle size={14} className="text-amber-500" />
                      <span>Triángulo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertShape("arrow-right")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <ArrowRight size={14} className="text-blue-600" />
                      <span>Flecha</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertShape("star")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <Star size={14} className="text-amber-400" />
                      <span>Estrella</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertShape("callout")}
                      className="flex items-center gap-2 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                    >
                      <MessageSquare size={14} className="text-purple-600" />
                      <span>Bocadillo</span>
                    </button>
                  </div>
                </PortalMenu>
              </div>
              <RibbonGroupFooter
                label="Ilustraciones"
                isLight={isLight}
              />
            </div>

            {/* GRUPO VÍNCULOS */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onInsertLink}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Link2 size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Vínculo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHTML", "<a name='marcador'></a>")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Bookmark size={20} className="text-indigo-600 mb-1" />
                  <span className="text-[10px] font-medium">Marcador</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Vínculos"
                isLight={isLight}
              />
            </div>

            {/* GRUPO TEXTO & SÍMBOLOS */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHorizontalRule")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Minus size={20} className="text-stone-500 mb-1" />
                  <span className="text-[10px] font-medium">Separador</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("formatBlock", "blockquote")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <FileText size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Cita bloque</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHTML", "&copy; 2026 CoffeWorks Suite ")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Type size={20} className="text-purple-600 mb-1" />
                  <span className="text-[10px] font-medium">Símbolo</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Texto y Símbolos"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DIBUJAR ===================== */}
        {activeTab === "dibujar" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pen")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "pen"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <PenTool size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Bolígrafo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pencil")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "pencil"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Pencil size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium">Lápiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("marker")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "marker"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Highlighter size={20} className="text-amber-500 mb-1" />
                  <span className="text-[10px] font-medium">Marcador</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("eraser")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "eraser"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Eraser size={20} className="text-rose-500 mb-1" />
                  <span className="text-[10px] font-medium">Borrador</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Herramientas de dibujo"
                isLight={isLight}
              />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Entrada de lápiz a texto digital activada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Type size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Lápiz a texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Reconocimiento de formas geométricas activo")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Sparkles size={18} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Lápiz a forma</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Conversión"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISEÑO ===================== */}
        {activeTab === "diseno" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                {["Office", "Integral", "Faceta", "Orgánico"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveThemeName(t)}
                    className={`flex flex-col items-center justify-center px-2 py-1 rounded w-16 h-15 border transition-all cursor-pointer ${
                      activeThemeName === t
                        ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd] font-bold"
                        : "hover:bg-black/5 border-[#d2d0ce]"
                    }`}
                  >
                    <Layers size={18} className="mb-0.5 text-[#185abd]" />
                    <span className="text-[10px]">{t}</span>
                  </button>
                ))}
              </div>
              <RibbonGroupFooter
                label="Formato del documento"
                isLight={isLight}
              />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    const nextWatermark = prompt("Texto de la marca de agua:", watermark || "CONFIDENCIAL");
                    if (nextWatermark !== null) {
                      if (onSetWatermark) onSetWatermark(nextWatermark);
                    }
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Stamp size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Marca de agua</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Color de página personalizado establecido")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Droplet size={18} className="text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Color de página</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Fondo de página"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISPOSICIÓN ===================== */}
        {activeTab === "disposicion" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 items-center">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 w-16">Márgenes:</span>
                    <select
                      value={margins}
                      onChange={(e) => setMargins(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs bg-transparent cursor-pointer"
                    >
                      <option value="Normal (2.5 cm)">Normal (2.5 cm)</option>
                      <option value="Estrecho (1.27 cm)">Estrecho (1.27 cm)</option>
                      <option value="Moderado (1.9 cm)">Moderado (1.9 cm)</option>
                      <option value="Ancho (5.0 cm)">Ancho (5.0 cm)</option>
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
                            ? "bg-[#185abd] text-white font-bold"
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
                            ? "bg-[#185abd] text-white font-bold"
                            : "bg-black/5"
                        }`}
                      >
                        Horizontal
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 w-14">Tamaño:</span>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs bg-transparent cursor-pointer"
                    >
                      <option value="A4 (21 x 29.7 cm)">A4 (21 x 29.7 cm)</option>
                      <option value="Carta (21.59 x 27.94 cm)">Carta (Letter)</option>
                      <option value="Oficio (21.59 x 35.56 cm)">Oficio (Legal)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 w-14">Columnas:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setColumnsCount(col)}
                          className={`w-6 h-5 rounded text-xs flex items-center justify-center cursor-pointer ${
                            columnsCount === col
                              ? "bg-[#185abd] text-white font-bold"
                              : "bg-black/5"
                          }`}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <RibbonGroupFooter
                label="Configurar Página"
                isLight={isLight}
              />
            </div>

            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 items-center text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-semibold text-stone-500">Sangría</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500">Izq:</span>
                    <input
                      type="number"
                      value={indentLeft}
                      onChange={(e) => setIndentLeft(Number(e.target.value))}
                      className="w-12 border rounded px-1 py-0.5 text-xs bg-transparent"
                    />
                    <span className="text-[10px]">cm</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500">Der:</span>
                    <input
                      type="number"
                      value={indentRight}
                      onChange={(e) => setIndentRight(Number(e.target.value))}
                      className="w-12 border rounded px-1 py-0.5 text-xs bg-transparent"
                    />
                    <span className="text-[10px]">cm</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-semibold text-stone-500">Espaciado</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500">Ant:</span>
                    <input
                      type="number"
                      value={spaceBefore}
                      onChange={(e) => setSpaceBefore(Number(e.target.value))}
                      className="w-12 border rounded px-1 py-0.5 text-xs bg-transparent"
                    />
                    <span className="text-[10px]">pto</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500">Post:</span>
                    <input
                      type="number"
                      value={spaceAfter}
                      onChange={(e) => setSpaceAfter(Number(e.target.value))}
                      className="w-12 border rounded px-1 py-0.5 text-xs bg-transparent"
                    />
                    <span className="text-[10px]">pto</span>
                  </div>
                </div>
              </div>
              <RibbonGroupFooter
                label="Párrafo"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: REFERENCIAS ===================== */}
        {activeTab === "referencias" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    onExecuteCommand(
                      "insertHTML",
                      `<div class="toc-container" style="border: 1px solid #185abd; border-radius: 8px; padding: 14px; background: #f8fbff; margin: 16px 0;">
                        <h3 style="color: #185abd; margin-top: 0; font-size: 16px;">Índice de Contenido General</h3>
                        <p style="margin: 4px 0;">1. Introducción y Fundamentos .................................... Pág. 1</p>
                        <p style="margin: 4px 0;">2. Metodología de Implementación ............................ Pág. 2</p>
                        <p style="margin: 4px 0;">3. Resultados y Conclusiones ................................. Pág. 4</p>
                      </div><p></p>`
                    );
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-20 h-15 cursor-pointer"
                >
                  <BookOpen size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Tabla de contenido</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Tabla de contenido"
                isLight={isLight}
              />
            </div>

            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHTML", "<sup>[1]</sup>")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Quote size={18} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Nota al pie</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Notas al pie"
                isLight={isLight}
              />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-2 flex-1 items-center">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Estilo:</span>
                    <select
                      value={citationStyle}
                      onChange={(e) => setCitationStyle(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs bg-transparent cursor-pointer"
                    >
                      <option value="APA 7ma Edición">APA 7ma</option>
                      <option value="IEEE">IEEE</option>
                      <option value="Chicago">Chicago</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onExecuteCommand(
                        "insertHTML",
                        `<div class="bibliography" style="margin-top: 20px; font-size: 13px; line-height: 1.6;">
                          <h4 style="color: #185abd; font-size: 15px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Referencias Bibliográficas (${citationStyle})</h4>
                          <p style="padding-left: 24px; text-indent: -24px;">Smith, J. & Doe, A. (2025). <em>Avances en procesamiento de documentos en la nube</em>. Journal of Digital Productivity, 12(3), 45-60.</p>
                        </div><p></p>`
                      );
                    }}
                    className="px-2 py-1 rounded bg-[#185abd] text-white font-medium text-xs hover:bg-[#104896] cursor-pointer"
                  >
                    Insertar bibliografía
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Citas y bibliografía"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: CORRESPONDENCIA ===================== */}
        {activeTab === "correspondencia" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Asistente para combinación de correspondencia iniciado")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-20 h-15 cursor-pointer"
                >
                  <Send size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Iniciar combinación</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Conectado con lista de destinatarios de CoffeCalc (.xlsx)")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-20 h-15 cursor-pointer"
                >
                  <Users size={18} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Destinatarios</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Iniciar combinación"
                isLight={isLight}
              />
            </div>

            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1 flex-1 items-center">
                {["«Nombre»", "«Apellido»", "«Cargo»", "«Empresa»"].map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => onExecuteCommand("insertHTML", `<strong>${field}</strong> `)}
                    className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#185abd]/10 hover:text-[#185abd] text-xs font-mono font-bold cursor-pointer"
                  >
                    {field}
                  </button>
                ))}
              </div>
              <RibbonGroupFooter
                label="Escribir e insertar campos"
                isLight={isLight}
              />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Generando documentos individuales personalizados para todos los destinatarios.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded bg-[#185abd] text-white hover:bg-[#104896] w-20 h-15 shadow-xs cursor-pointer font-bold"
                >
                  <Check size={18} className="mb-1" />
                  <span className="text-[10px] text-center leading-tight">Finalizar y combinar</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Finalizar"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: REVISAR ===================== */}
        {activeTab === "revisar" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onOpenWordCount}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <FileText size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Contar palabras</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Revisión ortográfica y gramatical completa: Cero errores encontrados.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <SpellCheck size={18} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ortografía</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Revisión"
                isLight={isLight}
              />
            </div>

            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Traducción inteligente al inglés activada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Languages size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Traducir</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Idioma activo: Español (Alfabetización internacional)")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Globe size={18} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Idioma</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Idioma"
                isLight={isLight}
              />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Restricción de edición activada con contraseña")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <ShieldCheck size={18} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Proteger</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Proteger"
                isLight={isLight}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <>
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  {theme === "dark-espresso" ? (
                    <Sun size={18} className="text-amber-500 mb-1" />
                  ) : (
                    <Moon size={18} className="text-[#185abd] mb-1" />
                  )}
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {theme === "dark-espresso" ? "Modo Papel" : "Modo Oscuro"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onToggleZenMode}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-18 h-15 border cursor-pointer transition-colors ${
                    zenMode
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Maximize2 size={18} className="mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Modo Zen</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Vistas"
                isLight={isLight}
              />
            </div>

            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 items-center text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#185abd]">
                  <input
                    type="checkbox"
                    checked={showRuler}
                    onChange={onToggleRuler}
                    className="accent-[#185abd]"
                  />
                  <span>Regla horizontal</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#185abd]">
                  <input
                    type="checkbox"
                    checked={outlineOpen}
                    onChange={onToggleOutline}
                    className="accent-[#185abd]"
                  />
                  <span>Panel de navegación</span>
                </label>
              </div>
              <RibbonGroupFooter
                label="Mostrar"
                isLight={isLight}
              />
            </div>

            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1 flex-1 items-center">
                {[75, 100, 125, 150].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onZoomChange(z)}
                    className={`px-2 py-1 rounded text-xs font-mono font-medium cursor-pointer ${
                      zoom === z
                        ? "bg-[#185abd] text-white font-bold"
                        : "hover:bg-black/5 text-stone-600"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
              <RibbonGroupFooter
                label="Zoom"
                isLight={isLight}
              />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Split size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Dividir ventana</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Ventana"
                isLight={isLight}
              />
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
                  onClick={onOpenHelp}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Keyboard size={18} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "CoffeDoc Suite 2026\nProcesador de textos profesional con arquitectura Ribbon de Office.\nCompatible con .cfd, .docx y Markdown."
                    )
                  }
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 cursor-pointer"
                >
                  <Info size={18} className="text-stone-500 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Acerca de</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Ayuda"
                isLight={isLight}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
