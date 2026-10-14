import React, { useState } from "react";
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
  Columns,
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
} from "lucide-react";
import type { DocumentTheme } from "../types";

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
}

// Componente para la base de cada grupo con etiqueta centrada e iniciador de diálogo ↘
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
}) => {
  const [activeTab, setActiveTab] = useState<RibbonTab>("inicio");
  const [fileMenuOpen, setFileMenuOpen] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<string>("Calibri");
  const [fontSize, setFontSize] = useState<number>(11);
  const [textColorOpen, setTextColorOpen] = useState<boolean>(false);
  const [highlightOpen, setHighlightOpen] = useState<boolean>(false);
  const [lineSpacingOpen, setLineSpacingOpen] = useState<boolean>(false);

  // Estados interactivos para las herramientas específicas
  const [activeDrawingTool, setActiveDrawingTool] = useState<string>("select");
  const [activeThemeName, setActiveThemeName] = useState<string>("Office");
  const [margins, setMargins] = useState<string>("Normal (2.5 cm)");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [paperSize, setPaperSize] = useState<string>("A4 (21 x 29.7 cm)");
  const [columnsCount, setColumnsCount] = useState<number>(1);
  const [indentLeft, setIndentLeft] = useState<number>(0);
  const [indentRight, setIndentRight] = useState<number>(0);
  const [spaceBefore, setSpaceBefore] = useState<number>(0);
  const [spaceAfter, setSpaceAfter] = useState<number>(8);
  const [citationStyle, setCitationStyle] = useState<string>("APA 7ma Edición");

  const textColors = [
    { name: "Negro / Oscuro", color: "#111111" },
    { name: "Azul Microsoft Office", color: "#185abd" },
    { name: "Caramelo Elegante", color: "#e08e45" },
    { name: "Verde Bosque", color: "#16a34a" },
    { name: "Rojo Carmesí", color: "#dc2626" },
    { name: "Gris Suave", color: "#6b7280" },
  ];

  const highlightColors = [
    { name: "Sin color", color: "transparent" },
    { name: "Amarillo Fluorescente", color: "#fef08a" },
    { name: "Verde Menta", color: "#bbf7d0" },
    { name: "Celeste Cielo", color: "#bae6fd" },
    { name: "Ámbar Cálido", color: "#fed7aa" },
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
      {/* 1. FILA DE PESTAÑAS DE LA CINTA (RIBBON TABS DE MICROSOFT WORD) */}
      <div
        className={`flex items-center px-2 pt-1 border-b gap-0.5 text-xs transition-colors overflow-x-auto ${
          isLight ? "bg-[#f3f2f1] border-[#e1dfdd]" : "bg-[#1a1715] border-[#35302d]"
        }`}
      >
        {/* Pestaña ARCHIVO (Estilo botón distintivo de Microsoft Word azul) */}
        <div className="relative mr-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-4 py-1.5 rounded-t bg-[#185abd] text-white font-bold hover:bg-[#104896] transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <span>Archivo</span>
            <ChevronDown size={11} />
          </button>

          {/* Menú desplegable Backstage de Archivo */}
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
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus size={15} className="text-[#185abd]" />
                  Nuevo documento
                </span>
                <span className="font-mono text-[10px] text-outline">Ctrl+N</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Save size={15} className="text-emerald-600" />
                  Guardar
                </span>
                <span className="font-mono text-[10px] text-outline">Ctrl+S</span>
              </button>
              <div className="h-px bg-outline-variant/20 my-1" />
              <button
                type="button"
                onClick={onOpenExport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={15} className="text-[#185abd]" />
                  Exportar / Guardar como...
                </span>
                <span className="font-mono text-[10px] text-outline">.cfd, .docx, .md</span>
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Printer size={15} className="text-outline" />
                  Imprimir / PDF
                </span>
                <span className="font-mono text-[10px] text-outline">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

        {/* Pestañas estándar y avanzadas de la Suite */}
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

      {/* 2. CUERPO DE LA CINTA RIBBON (RIBBON CONTAINER CON GRUPOS VERTICALES E INICIADORES ↘) */}
      <div
        className={`h-25 px-2.5 py-1 flex items-stretch gap-2 overflow-x-auto transition-colors ${
          isLight ? "bg-[#ffffff] text-[#201f1e]" : "bg-[#231f1d] text-[#eae0dd]"
        }`}
      >
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* GRUPO 1: PORTAPAPELES */}
            <div
              className={`flex flex-col justify-between pr-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => onExecuteCommand("paste")}
                  title="Pegar (Ctrl + V)"
                  className={`flex flex-col items-center justify-center p-1 rounded transition-colors w-12 h-15 border cursor-pointer ${
                    isLight
                      ? "hover:bg-[#f3f2f1] text-[#201f1e] border-transparent hover:border-[#d2d0ce]"
                      : "hover:bg-surface-container-high text-on-surface border-transparent hover:border-outline-variant/30"
                  }`}
                >
                  <Clipboard size={20} className={`${isLight ? "text-[#185abd]" : "text-primary"} mb-0.5`} />
                  <span className="text-[10px] leading-tight font-medium">Pegar</span>
                </button>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("cut")}
                    title="Cortar (Ctrl + X)"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                      isLight
                        ? "hover:bg-[#f3f2f1] text-[#323130] hover:text-[#185abd]"
                        : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                    }`}
                  >
                    <Scissors size={12} />
                    <span>Cortar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("copy")}
                    title="Copiar (Ctrl + C)"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                      isLight
                        ? "hover:bg-[#f3f2f1] text-[#323130] hover:text-[#185abd]"
                        : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                    }`}
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Formato copiado. Aplica en cualquier selección.")}
                    title="Copiar formato"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                      isLight
                        ? "hover:bg-[#f3f2f1] text-[#323130] hover:text-[#185abd]"
                        : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                    }`}
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
                  notifyAdvancedDialog("Portapapeles", "Opciones del historial del portapapeles y pegado especial.")
                }
              />
            </div>

            {/* GRUPO 2: FUENTE */}
            <div
              className={`flex flex-col justify-between px-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-1">
                  <select
                    value={fontFamily}
                    onChange={(e) => handleFontChange(e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded border font-medium w-34 shadow-2xs focus:outline-none transition-colors ${
                      isLight
                        ? "bg-white text-[#201f1e] border-[#d2d0ce] focus:border-[#185abd]"
                        : "bg-[#1a1715] text-on-surface border-outline-variant/40 focus:border-primary"
                    }`}
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Hanken Grotesk">Hanken Grotesk</option>
                    <option value="Inter">Inter</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Arial">Arial</option>
                  </select>

                  <div className="flex items-center border rounded px-1 gap-1">
                    <span className="font-mono text-xs w-5 text-center">{fontSize}</span>
                    <button
                      type="button"
                      onClick={() => changeFontSize(1)}
                      className="hover:text-primary font-bold px-0.5 cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
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
                    onClick={() => onExecuteCommand("bold")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 font-bold cursor-pointer"
                    title="Negrita (Ctrl + B)"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("italic")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 italic cursor-pointer"
                    title="Cursiva (Ctrl + I)"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("underline")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 underline cursor-pointer"
                    title="Subrayado (Ctrl + U)"
                  >
                    <Underline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("strikeThrough")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                    title="Tachado"
                  >
                    <Strikethrough size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("subscript")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                    title="Subíndice"
                  >
                    <Subscript size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("superscript")}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                    title="Superíndice"
                  >
                    <Superscript size={13} />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTextColorOpen(!textColorOpen)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-[#185abd] cursor-pointer"
                      title="Color de fuente"
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
                              onExecuteCommand("foreColor", tc.color);
                              setTextColorOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-black/20"
                              style={{ backgroundColor: tc.color }}
                            />
                            <span>{tc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setHighlightOpen(!highlightOpen)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-amber-500 cursor-pointer"
                      title="Color de resaltado"
                    >
                      <Highlighter size={13} />
                    </button>
                    {highlightOpen && (
                      <div className="absolute left-0 mt-1 w-40 rounded-lg bg-white border border-[#d2d0ce] shadow-xl p-1.5 z-50">
                        {highlightColors.map((hc) => (
                          <button
                            key={hc.name}
                            type="button"
                            onClick={() => {
                              onExecuteCommand("hiliteColor", hc.color);
                              setHighlightOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded text-left cursor-pointer"
                          >
                            <span
                              className="w-3 h-3 rounded border border-black/20"
                              style={{ backgroundColor: hc.color }}
                            />
                            <span>{hc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <RibbonGroupFooter
                label="Fuente"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Fuente", "Configuraciones tipográficas avanzadas, ligaduras OpenType y espaciado entre caracteres.")
                }
              />
            </div>

            {/* GRUPO 3: PÁRRAFO */}
            <div
              className={`flex flex-col justify-between px-2 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("insertUnorderedList")}
                    title="Viñetas"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <List size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("insertOrderedList")}
                    title="Numeración"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <ListOrdered size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onExecuteCommand(
                        "insertHTML",
                        "<ul class='checklist'><li><input type='checkbox'> Tarea completada</li></ul><p></p>"
                      )
                    }
                    title="Lista de tareas (Checklist)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <CheckSquare size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("outdent")}
                    title="Disminuir sangría"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <Outdent size={13} />
                  </button>
                  <button
                    type="button"
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
                    onClick={() => onExecuteCommand("justifyLeft")}
                    title="Alinear a la izquierda"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyCenter")}
                    title="Centrar"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignCenter size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyRight")}
                    title="Alinear a la derecha"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyFull")}
                    title="Justificar"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 cursor-pointer"
                  >
                    <AlignJustify size={13} />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLineSpacingOpen(!lineSpacingOpen)}
                      title={`Espaciado entre líneas (${lineSpacing})`}
                      className="px-1 py-0.5 flex items-center gap-0.5 rounded hover:bg-black/5 text-xs cursor-pointer"
                    >
                      <span className="font-mono text-[10px]">{lineSpacing}</span>
                      <ChevronDown size={9} />
                    </button>
                    {lineSpacingOpen && (
                      <div className="absolute left-0 mt-1 w-28 rounded-lg bg-white border border-[#d2d0ce] shadow-xl p-1 z-50">
                        {["1.0", "1.15", "1.5", "2.0"].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              onSetLineSpacing(s);
                              setLineSpacingOpen(false);
                            }}
                            className="w-full px-2 py-1 text-xs hover:bg-[#f3f2f1] rounded flex items-center justify-between text-left cursor-pointer"
                          >
                            <span>{s}</span>
                            {lineSpacing === s && <Check size={11} className="text-[#185abd]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <RibbonGroupFooter
                label="Párrafo"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Párrafo", "Alineación, sangría milimétrica, espaciado anterior/posterior y saltos de línea.")
                }
              />
            </div>

            {/* GRUPO 4: ESTILOS */}
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
                  notifyAdvancedDialog("Estilos", "Inspector de estilos, jerarquía CSS y creación de nuevos estilos de párrafo.")
                }
              />
            </div>

            {/* GRUPO 5: EDICIÓN */}
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
                onOpenDialog={() =>
                  notifyAdvancedDialog("Edición", "Búsqueda avanzada con expresiones regulares y comodines.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <>
            {/* GRUPO TABLAS */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onInsertTable}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <TableIcon size={22} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Tabla</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Tablas"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Tablas", "Insertar cuadrículas personalizadas, filas, columnas y estilos de celda.")
                }
              />
            </div>

            {/* GRUPO ILUSTRACIONES */}
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
                  <ImageIcon size={22} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium">Imágenes</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Modelos 3D e iconos vectoriales integrados.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Sparkles size={22} className="text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium">Iconos</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Ilustraciones"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Ilustraciones", "Opciones de ajuste de forma, sombras y efectos de imagen.")
                }
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
                  <Link2 size={22} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Vínculo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHTML", "<a name='marcador'></a>")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Bookmark size={22} className="text-indigo-600 mb-1" />
                  <span className="text-[10px] font-medium">Marcador</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Vínculos"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Vínculos", "Administrador de hipervínculos internos y referencias cruzadas.")
                }
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
                  <Minus size={22} className="text-stone-500 mb-1" />
                  <span className="text-[10px] font-medium">Separador</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("formatBlock", "blockquote")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <FileText size={22} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Cita bloque</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHTML", "&copy; 2026 CoffeWorks Suite")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-14 h-15 border border-transparent cursor-pointer"
                >
                  <Type size={22} className="text-purple-600 mb-1" />
                  <span className="text-[10px] font-medium">Símbolo</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Texto y Símbolos"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Texto y Símbolos", "Cuadros de texto flotantes, letra capital y caracteres especiales.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DIBUJAR ===================== */}
        {activeTab === "dibujar" && (
          <>
            {/* GRUPO HERRAMIENTAS DE DIBUJO */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pen")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer transition-colors ${
                    activeDrawingTool === "pen"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <PenTool size={22} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium">Bolígrafo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pencil")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer transition-colors ${
                    activeDrawingTool === "pencil"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Pencil size={22} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium">Lápiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("marker")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer transition-colors ${
                    activeDrawingTool === "marker"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Highlighter size={22} className="text-amber-500 mb-1" />
                  <span className="text-[10px] font-medium">Marcador</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("eraser")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer transition-colors ${
                    activeDrawingTool === "eraser"
                      ? "bg-[#185abd]/10 border-[#185abd] text-[#185abd]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <Eraser size={22} className="text-rose-500 mb-1" />
                  <span className="text-[10px] font-medium">Borrador</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Herramientas de dibujo"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Dibujo", "Grosor del trazo, sensibilidad a la presión y paleta de tinta digital.")
                }
              />
            </div>

            {/* GRUPO CONVERSIÓN */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Entrada de lápiz a texto digital activada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Type size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Lápiz a texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Reconocimiento de formas geométricas activo")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Sparkles size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Lápiz a forma</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Conversión"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Conversión de trazos", "Configuración del motor OCR y suavizado de curvas Bézier.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISEÑO ===================== */}
        {activeTab === "diseno" && (
          <>
            {/* GRUPO FORMATO DEL DOCUMENTO */}
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
                onOpenDialog={() =>
                  notifyAdvancedDialog("Temas del Documento", "Paletas de colores HSL, tipografías primarias y secundarias.")
                }
              />
            </div>

            {/* GRUPO FONDO DE PÁGINA */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    const watermark = prompt("Texto de la marca de agua:", "CONFIDENCIAL");
                    if (watermark) {
                      onExecuteCommand(
                        "insertHTML",
                        `<div style="opacity: 0.12; font-size: 42px; font-weight: bold; text-align: center; letter-spacing: 6px; margin: 20px 0; user-select: none;">${watermark}</div>`
                      );
                    }
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Stamp size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Marca de agua</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Color de página personalizado establecido")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Droplet size={20} className="text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Color de página</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Bordes de página aplicados al diseño actual")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Layers size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Bordes</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Fondo de página"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Fondo y Bordes", "Efectos de relleno, textura, tramado y margen de borde.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISPOSICIÓN ===================== */}
        {activeTab === "disposicion" && (
          <>
            {/* GRUPO CONFIGURAR PÁGINA */}
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
                onOpenDialog={() =>
                  notifyAdvancedDialog("Configurar Página", "Márgenes simétricos, encabezados diferentes en páginas pares/impares y tamaño personalizado.")
                }
              />
            </div>

            {/* GRUPO PÁRRAFO (CONTROL MILIMÉTRICO) */}
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
                onOpenDialog={() =>
                  notifyAdvancedDialog("Párrafo", "Control de líneas viudas/huérfanas y mantener con el siguiente.")
                }
              />
            </div>

            {/* GRUPO ORGANIZAR */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Ajuste de texto: En línea con el texto, Cuadrado o Detrás del texto.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-16 h-15 border border-transparent cursor-pointer"
                >
                  <Columns size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ajustar texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Capas: Traer al frente o Enviar al fondo.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-16 h-15 border border-transparent cursor-pointer"
                >
                  <Layers size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Organizar</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Organizar"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Organizar", "Panel de selección y alineación milimétrica de objetos flotantes.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: REFERENCIAS ===================== */}
        {activeTab === "referencias" && (
          <>
            {/* GRUPO TABLA DE CONTENIDO */}
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
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-20 h-15 border border-transparent cursor-pointer"
                >
                  <BookOpen size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Tabla de contenido</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Tabla de contenido"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Tabla de contenido", "Estilos de tabla, niveles de título a mostrar y caracteres de relleno.")
                }
              />
            </div>

            {/* GRUPO NOTAS AL PIE */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    onExecuteCommand("insertHTML", "<sup>[1]</sup>");
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Quote size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Nota al pie</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onExecuteCommand("insertHTML", "<sup>[i]</sup>");
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Quote size={20} className="text-amber-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Nota al final</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Notas al pie"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Notas al pie", "Formato de número, reiniciar en cada página o sección continua.")
                }
              />
            </div>

            {/* GRUPO CITAS Y BIBLIOGRAFÍA */}
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
                      <option value="APA 7ma Edición">APA 7ma Edición</option>
                      <option value="IEEE">IEEE</option>
                      <option value="Chicago">Chicago</option>
                      <option value="MLA">MLA</option>
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
                    className="px-2 py-1 rounded bg-[#185abd] text-white font-medium text-xs hover:bg-[#104896] transition-colors cursor-pointer"
                  >
                    Insertar bibliografía
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Citas y bibliografía"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Citas y Bibliografía", "Administrador de fuentes bibliográficas maestras y lista actual.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: CORRESPONDENCIA ===================== */}
        {activeTab === "correspondencia" && (
          <>
            {/* GRUPO INICIAR COMBINACIÓN */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Asistente para combinación de correspondencia iniciado")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-20 h-15 border border-transparent cursor-pointer"
                >
                  <Send size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Iniciar combinación</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Conectado con lista de destinatarios de CoffeCalc (.xlsx)")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-20 h-15 border border-transparent cursor-pointer"
                >
                  <Users size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Destinatarios</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Iniciar combinación"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Correspondencia", "Configurar origen de datos SQL, CSV o libro de Excel.")
                }
              />
            </div>

            {/* GRUPO ESCRIBIR E INSERTAR CAMPOS */}
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
                    className="px-2 py-1.5 rounded bg-black/5 hover:bg-[#185abd]/10 hover:text-[#185abd] text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    {field}
                  </button>
                ))}
              </div>
              <RibbonGroupFooter
                label="Escribir e insertar campos"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Campos Combinados", "Reglas dinámicas Si... Entonces... Sino, y asignación de campos.")
                }
              />
            </div>

            {/* GRUPO FINALIZAR */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Generando documentos individuales personalizados para todos los destinatarios.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded bg-[#185abd] text-white hover:bg-[#104896] w-20 h-15 shadow-xs cursor-pointer"
                >
                  <Check size={20} className="mb-1" />
                  <span className="text-[10px] font-bold text-center leading-tight">Finalizar y combinar</span>
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
            {/* GRUPO REVISIÓN */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onOpenWordCount}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <FileText size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Contar palabras</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Revisión ortográfica y gramatical completa: Cero errores encontrados.")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <SpellCheck size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ortografía</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Revisión"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Ortografía", "Diccionario personalizado, omitir palabras en mayúsculas y corrección automática.")
                }
              />
            </div>

            {/* GRUPO IDIOMA */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Traducción inteligente al inglés activada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Languages size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Traducir</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Idioma activo: Español (Alfabetización internacional)")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Globe size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Idioma</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Idioma"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Idioma", "Preferencias de idioma de edición, visualización e instalación de paquetes.")
                }
              />
            </div>

            {/* GRUPO COMENTARIOS */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    const comment = prompt("Nuevo comentario para la selección:");
                    if (comment) {
                      onExecuteCommand(
                        "insertHTML",
                        `<span style="background-color: #fef08a; border-bottom: 2px solid #eab308; cursor: pointer;" title="Comentario: ${comment}">${window.getSelection()?.toString() || "Nota"}</span>`
                      );
                    }
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <MessageSquare size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Nuevo comentario</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Comentarios"
                isLight={isLight}
              />
            </div>

            {/* GRUPO PROTEGER */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Restricción de edición activada con contraseña maestra")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <ShieldCheck size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Proteger</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Proteger"
                isLight={isLight}
                onOpenDialog={() =>
                  notifyAdvancedDialog("Protección", "Restringir formato, restringir edición solo a comentarios o solo lectura.")
                }
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <>
            {/* GRUPO VISTAS */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  {theme === "dark-espresso" ? (
                    <Sun size={20} className="text-amber-500 mb-1" />
                  ) : (
                    <Moon size={20} className="text-[#185abd] mb-1" />
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
                  <Maximize2 size={20} className="mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Modo Zen</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Vistas"
                isLight={isLight}
              />
            </div>

            {/* GRUPO MOSTRAR */}
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

            {/* GRUPO ZOOM */}
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
                onOpenDialog={() =>
                  notifyAdvancedDialog("Zoom", "Ajustar al ancho de página, ver varias páginas o porcentaje libre.")
                }
              />
            </div>

            {/* GRUPO VENTANA */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Split size={20} className="text-[#185abd] mb-1" />
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
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Keyboard size={20} className="text-[#185abd] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "CoffeDoc Suite 2026\nProcesador de textos profesional con arquitectura Ribbon de Office.\nCompatible con .cfd, .docx y Markdown."
                    )
                  }
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-black/5 w-18 h-15 border border-transparent cursor-pointer"
                >
                  <Info size={20} className="text-stone-500 mb-1" />
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
