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
  Eraser,
  FileText,
  FilePlus,
  Save,
  Download,
  Printer,
  ChevronDown,
  Plus,
  SpellCheck,
  Maximize2,
  Sun,
  Moon,
  Keyboard,
  Info,
  Check,
} from "lucide-react";
import type { DocumentTheme } from "../types";

export type RibbonTab = "inicio" | "insertar" | "disposicion" | "revisar" | "vista" | "ayuda";

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

  const textColors = [
    { name: "Negro / Oscuro", color: "#111111" },
    { name: "Caramelo Office", color: "#e08e45" },
    { name: "Azul Clásico", color: "#2563eb" },
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
    onExecuteCommand("fontSize", next <= 10 ? "2" : next <= 12 ? "3" : next <= 16 ? "4" : next <= 24 ? "5" : "6");
  };

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    onExecuteCommand("fontName", font);
  };

  const isLight = theme === "paper-white";

  return (
    <div
      className={`border-b flex flex-col select-none relative z-40 shadow-sm transition-colors ${
        isLight
          ? "bg-[#ffffff] border-[#d2d0ce] text-[#323130]"
          : "bg-[#231f1d] border-[#3d3836] text-[#eae0dd]"
      }`}
    >
      {/* 1. FILA DE PESTAÑAS DE LA CINTA (RIBBON TABS DE MICROSOFT WORD) */}
      <div
        className={`flex items-center px-2 pt-1 border-b gap-0.5 text-xs transition-colors ${
          isLight
            ? "bg-[#f3f2f1] border-[#e1dfdd]"
            : "bg-[#1a1715] border-[#35302d]"
        }`}
      >
        {/* Pestaña ARCHIVO (Estilo botón distintivo de Microsoft Word azul) */}
        <div className="relative mr-1.5">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-4 py-1.5 rounded-t bg-[#185abd] text-white font-bold hover:bg-[#104896] transition-colors flex items-center gap-1 shadow-sm"
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
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
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
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
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
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
              >
                <span className="flex items-center gap-2.5">
                  <Download size={15} className="text-[#185abd]" />
                  Exportar / Guardar como...
                </span>
                <span className="font-mono text-[10px] text-outline">.cfd, .md</span>
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-surface-container text-on-surface hover:text-primary transition-colors text-xs"
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

        {/* Pestañas estándar de Microsoft Word */}
        {(
          [
            { id: "inicio", label: "Inicio" },
            { id: "insertar", label: "Insertar" },
            { id: "disposicion", label: "Disposición" },
            { id: "revisar", label: "Revisar" },
            { id: "vista", label: "Vista" },
            { id: "ayuda", label: "Ayuda" },
          ] as Array<{ id: RibbonTab; label: string }>
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
              className={`px-3.5 py-1.5 font-medium transition-colors text-xs ${
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

      {/* 2. CUERPO DE LA CINTA RIBBON (RIBBON CONTAINER CON GRUPOS VERTICALES TIPO OFFICE) */}
      <div
        className={`h-24 px-3 py-1 flex items-stretch gap-2 overflow-x-auto transition-colors ${
          isLight
            ? "bg-[#ffffff] text-[#201f1e]"
            : "bg-[#231f1d] text-[#eae0dd]"
        }`}
      >
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* GRUPO 1: PORTAPAPELES */}
            <div
              className={`flex flex-col justify-between pr-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1">
                {/* Botón grande Pegar */}
                <button
                  type="button"
                  onClick={() => onExecuteCommand("paste")}
                  title="Pegar (Ctrl + V)"
                  className={`flex flex-col items-center justify-center p-1.5 rounded transition-colors w-12 h-16 border ${
                    isLight
                      ? "hover:bg-[#f3f2f1] text-[#201f1e] border-transparent hover:border-[#d2d0ce]"
                      : "hover:bg-surface-container-high text-on-surface border-transparent hover:border-outline-variant/30"
                  }`}
                >
                  <Clipboard size={22} className={`${isLight ? "text-[#185abd]" : "text-primary"} mb-0.5`} />
                  <span className="text-[10px] leading-tight font-medium">Pegar</span>
                </button>

                {/* Columna Cortar, Copiar, Copiar formato */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("cut")}
                    title="Cortar (Ctrl + X)"
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
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
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
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
                    onClick={() => alert("Formato copiado")}
                    title="Copiar formato"
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
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
              <span
                className={`font-mono text-[9px] text-center tracking-wider uppercase font-semibold ${
                  isLight ? "text-[#605e5c]" : "text-outline/80"
                }`}
              >
                Portapapeles
              </span>
            </div>

            {/* GRUPO 2: FUENTE */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                {/* Fila superior: Tipografía, Tamaño numérico, Borrar formato */}
                <div className="flex items-center gap-1">
                  <select
                    value={fontFamily}
                    onChange={(e) => handleFontChange(e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded border font-medium w-36 shadow-sm focus:outline-none transition-colors ${
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

                  {/* Selector numérico de tamaño */}
                  <select
                    value={fontSize}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFontSize(val);
                      onExecuteCommand("fontSize", val <= 10 ? "2" : val <= 12 ? "3" : val <= 16 ? "4" : val <= 24 ? "5" : "6");
                    }}
                    className={`text-xs px-1.5 py-0.5 rounded border font-medium w-14 shadow-sm focus:outline-none transition-colors ${
                      isLight
                        ? "bg-white text-[#201f1e] border-[#d2d0ce] focus:border-[#185abd]"
                        : "bg-[#1a1715] text-on-surface border-outline-variant/40 focus:border-primary"
                    }`}
                  >
                    {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((sz) => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => changeFontSize(1)}
                    title="Aumentar tamaño de fuente"
                    className={`p-1 rounded transition-colors ${
                      isLight ? "hover:bg-[#f3f2f1] text-[#323130]" : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                    }`}
                  >
                    <Plus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeFontSize(-1)}
                    title="Disminuir tamaño de fuente"
                    className={`p-1 rounded transition-colors ${
                      isLight ? "hover:bg-[#f3f2f1] text-[#323130]" : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                    }`}
                  >
                    <Minus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("removeFormat")}
                    title="Borrar todo el formato"
                    className={`p-1 rounded transition-colors ${
                      isLight ? "hover:bg-[#f3f2f1] text-[#323130] hover:text-red-600" : "hover:bg-surface-container-high text-outline hover:text-error"
                    }`}
                  >
                    <Eraser size={13} />
                  </button>
                </div>

                {/* Fila inferior: Negrita, Cursiva, Subrayado, Tachado, Sub/Super, Colores */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("bold")}
                    title="Negrita (Ctrl + B)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface font-bold text-xs"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("italic")}
                    title="Cursiva (Ctrl + I)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface italic text-xs"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("underline")}
                    title="Subrayado (Ctrl + U)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface underline text-xs"
                  >
                    <Underline size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("strikeThrough")}
                    title="Tachado"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <Strikethrough size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("subscript")}
                    title="Subíndice"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <Subscript size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("superscript")}
                    title="Superíndice"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <Superscript size={13} />
                  </button>

                  <div className="h-4 w-px bg-outline-variant/30 mx-1" />

                  {/* Resaltador */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setHighlightOpen(!highlightOpen);
                        setTextColorOpen(false);
                      }}
                      title="Color de resaltado del texto"
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-surface-container-high text-outline hover:text-primary text-xs"
                    >
                      <Highlighter size={13} />
                      <ChevronDown size={9} />
                    </button>
                    {highlightOpen && (
                      <div className="absolute left-0 mt-1 w-44 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-1.5 z-50">
                        {highlightColors.map((hc) => (
                          <button
                            key={hc.color}
                            type="button"
                            onClick={() => {
                              onExecuteCommand("hiliteColor", hc.color);
                              setHighlightOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface-container text-left text-on-surface"
                          >
                            <div className="w-3.5 h-3.5 rounded border border-outline-variant/40" style={{ background: hc.color }} />
                            <span>{hc.name}</span>
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
                        setHighlightOpen(false);
                      }}
                      title="Color de fuente"
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                    >
                      <Palette size={13} />
                      <ChevronDown size={9} />
                    </button>
                    {textColorOpen && (
                      <div className="absolute left-0 mt-1 w-44 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-1.5 z-50">
                        {textColors.map((tc) => (
                          <button
                            key={tc.color}
                            type="button"
                            onClick={() => {
                              onExecuteCommand("foreColor", tc.color);
                              setTextColorOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface-container text-left text-on-surface"
                          >
                            <div className="w-3.5 h-3.5 rounded-full border border-outline-variant/40" style={{ background: tc.color }} />
                            <span>{tc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Fuente
              </span>
            </div>

            {/* GRUPO 3: PÁRRAFO */}
            <div className="flex flex-col justify-between px-2 border-r border-[#3a3430]">
              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                {/* Fila superior: Viñetas, Numeración, Tareas, Sangría */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("insertUnorderedList")}
                    title="Viñetas"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <List size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("insertOrderedList")}
                    title="Numeración"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <ListOrdered size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onExecuteCommand(
                        "insertHTML",
                        "<ul class='checklist'><li><input type='checkbox'> Tarea</li></ul><p></p>"
                      )
                    }
                    title="Lista de tareas (Checklist)"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <CheckSquare size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("outdent")}
                    title="Disminuir sangría"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <Outdent size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("indent")}
                    title="Aumentar sangría"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <Indent size={14} />
                  </button>
                </div>

                {/* Fila inferior: Alineaciones e Interlineado */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyLeft")}
                    title="Alinear a la izquierda"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <AlignLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyCenter")}
                    title="Centrar"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <AlignCenter size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyRight")}
                    title="Alinear a la derecha"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <AlignRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteCommand("justifyFull")}
                    title="Justificar"
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                  >
                    <AlignJustify size={14} />
                  </button>

                  {/* Interlineado desplegable */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLineSpacingOpen(!lineSpacingOpen)}
                      title={`Espaciado entre líneas (${lineSpacing})`}
                      className="px-1 py-0.5 flex items-center gap-0.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface text-xs"
                    >
                      <span className="font-mono text-[10px]">{lineSpacing}</span>
                      <ChevronDown size={9} />
                    </button>
                    {lineSpacingOpen && (
                      <div className="absolute left-0 mt-1 w-32 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-1 z-50">
                        {["1.0", "1.15", "1.5", "2.0"].map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => {
                              onSetLineSpacing(sp);
                              setLineSpacingOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-surface-container text-xs text-on-surface"
                          >
                            <span>{sp}</span>
                            {lineSpacing === sp && <Check size={12} className="text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Párrafo
              </span>
            </div>

            {/* GRUPO 4: GALERÍA DE ESTILOS DE WORD (TARJETAS VISUALES) */}
            <div
              className={`flex flex-col justify-between px-2.5 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1">
                {[
                  { tag: "p", title: "Normal", preview: "AaBbCc", sub: "Texto normal" },
                  { tag: "h1", title: "Título 1", preview: "AaBbCc", sub: "Título 1 (H1)" },
                  { tag: "h2", title: "Título 2", preview: "AaBbCc", sub: "Título 2 (H2)" },
                  { tag: "h3", title: "Título 3", preview: "AaBbCc", sub: "Título 3 (H3)" },
                  { tag: "blockquote", title: "Cita", preview: "AaBbCc", sub: "Cita destacada" },
                ].map((st) => (
                  <button
                    key={st.tag}
                    type="button"
                    onClick={() => onExecuteCommand("formatBlock", st.tag)}
                    className={`flex flex-col items-center justify-center px-2 py-1 rounded transition-all w-16 h-16 group ${
                      isLight
                        ? "bg-white hover:bg-[#f3f2f1] border border-[#d2d0ce] hover:border-[#185abd] shadow-sm"
                        : "bg-[#1c1917] hover:bg-[#2b2522] border border-[#3d3836] hover:border-primary"
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${
                        st.tag === "h1"
                          ? isLight ? "text-[#185abd] text-sm font-bold" : "text-primary text-sm font-bold"
                          : st.tag === "h2"
                          ? isLight ? "text-[#2b579a] font-bold" : "text-tertiary font-bold"
                          : isLight ? "text-[#201f1e]" : "text-on-surface"
                      }`}
                    >
                      {st.preview}
                    </span>
                    <span
                      className={`text-[9px] truncate max-w-full transition-colors ${
                        isLight ? "text-[#605e5c] group-hover:text-[#185abd]" : "text-outline group-hover:text-primary"
                      }`}
                    >
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
              <span
                className={`font-mono text-[9px] text-center tracking-wider uppercase font-semibold ${
                  isLight ? "text-[#605e5c]" : "text-outline/80"
                }`}
              >
                Estilos
              </span>
            </div>

            {/* GRUPO 5: EDICIÓN */}
            <div className="flex flex-col justify-between pl-2">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <button
                  type="button"
                  onClick={onOpenFindReplace}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
                    isLight
                      ? "hover:bg-[#f3f2f1] text-[#323130] hover:text-[#185abd]"
                      : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                  }`}
                >
                  <Search size={13} className={isLight ? "text-[#185abd]" : "text-primary"} />
                  <span>Buscar</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenFindReplace}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
                    isLight
                      ? "hover:bg-[#f3f2f1] text-[#323130] hover:text-[#185abd]"
                      : "hover:bg-surface-container-high text-outline hover:text-on-surface"
                  }`}
                >
                  <Replace size={13} className={isLight ? "text-[#2b579a]" : "text-tertiary"} />
                  <span>Reemplazar</span>
                </button>
              </div>
              <span
                className={`font-mono text-[9px] text-center tracking-wider uppercase font-semibold ${
                  isLight ? "text-[#605e5c]" : "text-outline/80"
                }`}
              >
                Edición
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <>
            {/* GRUPO TABLAS */}
            <div className="flex flex-col justify-between pr-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onInsertTable}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-surface-container-high text-on-surface w-16 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <TableIcon size={24} className="text-primary mb-1" />
                  <span className="text-[10px] font-medium">Tabla</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Tablas
              </span>
            </div>

            {/* GRUPO ILUSTRACIONES */}
            <div className="flex flex-col justify-between px-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onInsertImage}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-surface-container-high text-on-surface w-16 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <ImageIcon size={24} className="text-tertiary mb-1" />
                  <span className="text-[10px] font-medium">Imágenes</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Ilustraciones
              </span>
            </div>

            {/* GRUPO VÍNCULOS */}
            <div className="flex flex-col justify-between px-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onInsertLink}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-surface-container-high text-on-surface w-16 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <Link2 size={24} className="text-secondary mb-1" />
                  <span className="text-[10px] font-medium">Vínculo</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Vínculos
              </span>
            </div>

            {/* GRUPO TEXTO & ELEMENTOS */}
            <div className="flex flex-col justify-between px-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => onExecuteCommand("insertHorizontalRule")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-surface-container-high text-on-surface w-16 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <Minus size={22} className="text-outline mb-1" />
                  <span className="text-[10px] font-medium">Separador</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExecuteCommand("formatBlock", "blockquote")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-surface-container-high text-on-surface w-16 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <FileText size={22} className="text-primary mb-1" />
                  <span className="text-[10px] font-medium">Cita bloque</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Texto
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISPOSICIÓN ===================== */}
        {activeTab === "disposicion" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between gap-3 text-outline">
                    <span>Márgenes:</span>
                    <span className="text-on-surface font-semibold">Normal (2.5 cm)</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-outline">
                    <span>Orientación:</span>
                    <span className="text-on-surface font-semibold">Vertical</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-outline">
                    <span>Tamaño de papel:</span>
                    <span className="text-primary font-semibold">A4 (21 x 29.7 cm)</span>
                  </div>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Configurar Página
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: REVISAR ===================== */}
        {activeTab === "revisar" && (
          <>
            <div
              className={`flex flex-col justify-between pr-3 border-r ${
                isLight ? "border-[#e1dfdd]" : "border-[#3a3430]"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onOpenWordCount}
                  className={`flex flex-col items-center justify-center p-2 rounded w-20 h-16 border transition-colors ${
                    isLight
                      ? "hover:bg-[#f3f2f1] text-[#201f1e] border-transparent hover:border-[#d2d0ce]"
                      : "hover:bg-surface-container-high text-on-surface border-transparent hover:border-outline-variant/30"
                  }`}
                >
                  <FileText size={22} className={`${isLight ? "text-[#185abd]" : "text-primary"} mb-1`} />
                  <span className="text-[10px] font-medium text-center leading-tight">Contar palabras</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Corrector gramatical y ortográfico en español activo")}
                  className={`flex flex-col items-center justify-center p-2 rounded w-20 h-16 border transition-colors ${
                    isLight
                      ? "hover:bg-[#f3f2f1] text-[#201f1e] border-transparent hover:border-[#d2d0ce]"
                      : "hover:bg-surface-container-high text-on-surface border-transparent hover:border-outline-variant/30"
                  }`}
                >
                  <SpellCheck size={22} className={`${isLight ? "text-[#107c41]" : "text-tertiary"} mb-1`} />
                  <span className="text-[10px] font-medium text-center leading-tight">Ortografía</span>
                </button>
              </div>
              <span
                className={`font-mono text-[9px] text-center tracking-wider uppercase font-semibold ${
                  isLight ? "text-[#605e5c]" : "text-outline/80"
                }`}
              >
                Revisión
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-surface-container-high text-on-surface w-20 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  {theme === "dark-espresso" ? (
                    <Sun size={22} className="text-primary mb-1" />
                  ) : (
                    <Moon size={22} className="text-primary mb-1" />
                  )}
                  <span className="text-[10px] font-medium text-center leading-tight">
                    {theme === "dark-espresso" ? "Modo Papel" : "Modo Oscuro"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onToggleZenMode}
                  className={`flex flex-col items-center justify-center p-2 rounded text-on-surface w-20 h-16 border transition-colors ${
                    zenMode
                      ? "bg-primary-container text-on-primary-container border-primary"
                      : "hover:bg-surface-container-high border-transparent"
                  }`}
                >
                  <Maximize2 size={22} className="mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Modo Zen</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Vistas
              </span>
            </div>

            <div className="flex flex-col justify-between px-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-3 flex-1 items-center text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-outline hover:text-on-surface">
                  <input
                    type="checkbox"
                    checked={showRuler}
                    onChange={onToggleRuler}
                    className="accent-primary"
                  />
                  <span>Regla horizontal</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-outline hover:text-on-surface">
                  <input
                    type="checkbox"
                    checked={outlineOpen}
                    onChange={onToggleOutline}
                    className="accent-primary"
                  />
                  <span>Panel de navegación</span>
                </label>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Mostrar
              </span>
            </div>

            <div className="flex flex-col justify-between px-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                {[75, 100, 125].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onZoomChange(z)}
                    className={`px-2.5 py-1.5 rounded text-xs font-mono font-medium ${
                      zoom === z
                        ? "bg-primary-container text-on-primary-container font-bold"
                        : "hover:bg-surface-container-high text-outline"
                    }`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Zoom
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: AYUDA ===================== */}
        {activeTab === "ayuda" && (
          <>
            <div className="flex flex-col justify-between pr-3 border-r border-[#3a3430]">
              <div className="flex items-center gap-2 flex-1 items-center">
                <button
                  type="button"
                  onClick={onOpenHelp}
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-surface-container-high text-on-surface w-20 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <Keyboard size={22} className="text-primary mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "CoffeDoc v1.4 Pro\nProcesador de textos de arquitectura abierta de CoffeWorks.\nCompatible con formatos .cfd, .md y exportación PDF."
                    )
                  }
                  className="flex flex-col items-center justify-center p-2 rounded hover:bg-surface-container-high text-on-surface w-20 h-16 border border-transparent hover:border-outline-variant/30"
                >
                  <Info size={22} className="text-outline mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Acerca de</span>
                </button>
              </div>
              <span className="font-mono text-[9px] text-center text-outline/80 tracking-wider uppercase font-semibold">
                Ayuda
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
