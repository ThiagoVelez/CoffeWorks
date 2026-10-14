import React, { useState } from "react";
import {
  FilePlus,
  Play,
  Type,
  Square,
  Circle,
  ArrowRight,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Copy,
  Trash2,
  Maximize2,
  MessageSquare,
  ChevronDown,
  Layout,
  Star,
  Save,
  Share2,
  ArrowDownRight,
  Presentation,
  Sparkles,
  PenTool,
  Pencil,
  Eraser,
  Layers,
  Clock,
  ShieldCheck,
  Globe,
  HelpCircle,
  Eye,
  Grid,
  Monitor,
  Printer,
  Scissors,
  Paintbrush,
  Clipboard,
} from "lucide-react";
import type {
  PowerPointRibbonTab,
  SlideLayout,
  SlideTheme,
  SlideTransition,
  ShapeType,
} from "../types";
import { SLIDE_THEMES } from "../services/presentationVault";

interface PowerPointRibbonProps {
  activeTab: PowerPointRibbonTab;
  onSelectTab: (tab: PowerPointRibbonTab) => void;
  onNewPresentation: () => void;
  onSave: () => void;
  onOpenExport: () => void;
  onStartPresentation: () => void;
  onAddSlide: (layout: SlideLayout) => void;
  onDeleteSlide: () => void;
  onDuplicateSlide: () => void;
  onAddText: () => void;
  onAddShape: (shape: ShapeType) => void;
  currentTheme: SlideTheme;
  onSelectTheme: (theme: SlideTheme) => void;
  currentTransition: SlideTransition;
  onSelectTransition: (transition: SlideTransition) => void;
  selectedElementId: string | null;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onSetAlign: (align: "left" | "center" | "right" | "justify") => void;
  onDeleteElement: () => void;
  showNotes: boolean;
  onToggleNotes: () => void;
}

// Componente para la base de cada grupo con etiqueta centrada e iniciador de diálogo ↘
const RibbonGroupFooter: React.FC<{
  label: string;
  onOpenDialog?: () => void;
  dialogTitle?: string;
}> = ({ label, onOpenDialog, dialogTitle }) => (
  <div className="flex items-center justify-between mt-auto pt-0.5 px-0.5 border-t border-transparent select-none">
    <span className="flex-1 font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#6e5852] truncate">
      {label}
    </span>
    {onOpenDialog && (
      <button
        type="button"
        onClick={onOpenDialog}
        title={dialogTitle || `Configuración avanzada de ${label}`}
        className="w-3.5 h-3.5 -mr-0.5 flex items-center justify-center rounded transition-colors text-[9px] text-[#6e5852] hover:text-[#c43e1c] hover:bg-[#fbe7e1] cursor-pointer"
      >
        <ArrowDownRight size={10} strokeWidth={2.5} />
      </button>
    )}
  </div>
);

export const PowerPointRibbon: React.FC<PowerPointRibbonProps> = ({
  activeTab,
  onSelectTab,
  onNewPresentation,
  onSave,
  onOpenExport,
  onStartPresentation,
  onAddSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onAddText,
  onAddShape,
  currentTheme,
  onSelectTheme,
  currentTransition,
  onSelectTransition,
  selectedElementId,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onSetAlign,
  onDeleteElement,
  showNotes,
  onToggleNotes,
}) => {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);

  // Estados interactivos para herramientas avanzadas de PowerPoint
  const [activeDrawingTool, setActiveDrawingTool] = useState<string>("select");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3">("16:9");
  const [transitionDuration, setTransitionDuration] = useState<number>(1.0);
  const [advanceOnClick, setAdvanceOnClick] = useState<boolean>(true);
  const [advanceAfterSeconds, setAdvanceAfterSeconds] = useState<number>(5);
  const [selectedAnimation, setSelectedAnimation] = useState<string>("none");
  const [animationTiming, setAnimationTiming] = useState<string>("onclick");

  const notifyAdvancedDialog = (title: string, msg: string) => {
    alert(`[Cuadro de Diálogo PowerPoint - ${title}]\n${msg}`);
  };

  const tabs: Array<{ id: PowerPointRibbonTab; label: string }> = [
    { id: "inicio", label: "Inicio" },
    { id: "insertar", label: "Insertar" },
    { id: "dibujo", label: "Dibujo" },
    { id: "diseno", label: "Diseño" },
    { id: "transiciones", label: "Transiciones" },
    { id: "animaciones", label: "Animaciones" },
    { id: "presentacion", label: "Presentación con diapositivas" },
    { id: "revisar", label: "Revisar" },
    { id: "vista", label: "Vista" },
    { id: "ayuda", label: "Ayuda" },
  ];

  return (
    <div className="bg-white border-b border-[#d2d0ce] select-none text-xs flex flex-col z-40 text-[#201f1e] shadow-2xs">
      {/* 1. Barra de Pestañas de PowerPoint */}
      <div className="flex items-center px-2 pt-1 border-b border-[#e1dfdd] bg-[#f3f2f1] gap-0.5 text-xs overflow-x-auto">
        {/* Pestaña fija Archivo en color rojo Microsoft PowerPoint */}
        <div className="relative mr-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="px-4 py-1.5 rounded-t bg-[#c43e1c] text-white font-bold hover:bg-[#a83214] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
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
                onClick={onNewPresentation}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#c43e1c] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FilePlus size={15} className="text-[#c43e1c]" />
                  Nueva presentación
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+N</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#c43e1c] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Save size={15} className="text-[#c43e1c]" />
                  Guardar presentación
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+S</span>
              </button>
              <button
                type="button"
                onClick={onOpenExport}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#c43e1c] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Share2 size={15} className="text-[#c43e1c]" />
                  Exportar / Guardar como...
                </span>
                <span className="font-mono text-[10px] text-stone-400">.pptx, .csl</span>
              </button>
              <div className="h-px bg-[#e1dfdd] my-1" />
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#f3f2f1] text-[#201f1e] hover:text-[#c43e1c] transition-colors text-xs cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Printer size={15} className="text-stone-500" />
                  Imprimir diapositivas
                </span>
                <span className="font-mono text-[10px] text-stone-400">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

        {/* Pestañas estándar */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onSelectTab(tab.id);
                setFileMenuOpen(false);
              }}
              className={`px-3.5 py-1.5 font-medium transition-colors text-xs whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-b-[3px] border-[#c43e1c] text-[#c43e1c] font-bold bg-white"
                  : "border-b-[3px] border-transparent text-[#605e5c] hover:text-[#201f1e] hover:bg-[#edebe9]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. Área de Herramientas de la Cinta Ribbon con grupos e iniciadores ↘ */}
      <div className="h-25 px-2.5 py-1 flex items-stretch gap-2 overflow-x-auto bg-white text-[#201f1e]">
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* GRUPO DIAPOSITIVAS (EXCLUSIVO DE POWERPOINT) */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 relative items-center">
                <button
                  type="button"
                  onClick={() => onAddSlide("title-content")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                  title="Nueva Diapositiva (Ctrl+M)"
                >
                  <FilePlus size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-bold">Nueva</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                    title="Diseño de diapositiva"
                  >
                    <Layout size={20} className="text-stone-600 mb-1" />
                    <span className="text-[10px] font-medium flex items-center gap-0.5">
                      <span>Diseño</span>
                      <ChevronDown size={9} />
                    </span>
                  </button>

                  {layoutMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-[#d2d0ce] rounded-xl shadow-2xl py-1 z-50">
                      {[
                        { id: "title" as SlideLayout, label: "Diapositiva de título" },
                        { id: "title-content" as SlideLayout, label: "Título y objetos" },
                        { id: "two-columns" as SlideLayout, label: "Dos objetos" },
                        { id: "blank" as SlideLayout, label: "En blanco" },
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            onAddSlide(l.id);
                            setLayoutMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#f3f2f1] text-xs cursor-pointer"
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={onDuplicateSlide}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                    title="Duplicar diapositiva activa"
                  >
                    <Copy size={12} />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteSlide}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-rose-50 text-rose-600 cursor-pointer"
                    title="Eliminar diapositiva activa"
                  >
                    <Trash2 size={12} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Diapositivas"
                onOpenDialog={() => notifyAdvancedDialog("Diapositivas", "Administrador de patrones de diapositivas y secciones.")}
              />
            </div>

            {/* GRUPO PORTAPAPELES */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Pegar objeto o texto en diapositiva")}
                  className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#f3f2f1] w-12 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <Clipboard size={20} className="text-[#c43e1c] mb-0.5" />
                  <span className="text-[10px] font-medium">Pegar</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => alert("Cortar objeto")}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                  >
                    <Scissors size={12} />
                    <span>Cortar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Copiar objeto")}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Copiar formato")}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-[#f3f2f1] cursor-pointer"
                  >
                    <Paintbrush size={12} />
                    <span>Copiar formato</span>
                  </button>
                </div>
              </div>
              <RibbonGroupFooter label="Portapapeles" />
            </div>

            {/* GRUPO FUENTE */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex flex-col gap-1 flex-1 justify-center">
                <div className="flex items-center gap-1">
                  <select
                    className="text-xs px-2 py-0.5 rounded border border-[#d2d0ce] font-medium w-28 bg-white"
                    defaultValue="Segoe UI"
                  >
                    <option value="Segoe UI">Segoe UI</option>
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                  <select
                    className="text-xs px-1 py-0.5 rounded border border-[#d2d0ce] font-medium w-12 bg-white text-center"
                    defaultValue="24"
                  >
                    {[12, 14, 18, 24, 32, 40, 48, 64].map((s) => (
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
                    disabled={!selectedElementId}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer font-bold"
                    title="Negrita"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleItalic}
                    disabled={!selectedElementId}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer italic"
                    title="Cursiva"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={onToggleUnderline}
                    disabled={!selectedElementId}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer underline"
                    title="Subrayado"
                  >
                    <Underline size={13} />
                  </button>
                </div>
              </div>
              <RibbonGroupFooter
                label="Fuente"
                onOpenDialog={() => notifyAdvancedDialog("Fuente", "Sombra de texto, espaciado entre caracteres y mayúsculas/minúsculas.")}
              />
            </div>

            {/* GRUPO PÁRRAFO */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-0.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => onSetAlign("left")}
                  disabled={!selectedElementId}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer"
                  title="Alinear a la izquierda"
                >
                  <AlignLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("center")}
                  disabled={!selectedElementId}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer"
                  title="Centrar"
                >
                  <AlignCenter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("right")}
                  disabled={!selectedElementId}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer"
                  title="Alinear a la derecha"
                >
                  <AlignRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("justify")}
                  disabled={!selectedElementId}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f3f2f1] disabled:opacity-30 cursor-pointer"
                  title="Justificar"
                >
                  <AlignJustify size={13} />
                </button>
              </div>
              <RibbonGroupFooter
                label="Párrafo"
                onOpenDialog={() => notifyAdvancedDialog("Párrafo", "Interlineado en puntos, sangría y columnas dentro del cuadro de texto.")}
              />
            </div>

            {/* GRUPO DIBUJO / FORMAS */}
            <div className="flex flex-col justify-between px-2 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center relative">
                <button
                  type="button"
                  onClick={onAddText}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                  title="Insertar Cuadro de Texto"
                >
                  <Type size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium">Texto</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                    title="Insertar Forma Geométrica"
                  >
                    <Square size={20} className="text-stone-600 mb-1" />
                    <span className="text-[10px] font-medium flex items-center gap-0.5">
                      <span>Formas</span>
                      <ChevronDown size={9} />
                    </span>
                  </button>

                  {shapesMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 bg-white border border-[#d2d0ce] rounded-xl shadow-2xl p-2 z-50 grid grid-cols-2 gap-1 w-36">
                      <button
                        type="button"
                        onClick={() => {
                          onAddShape("rectangle");
                          setShapesMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                      >
                        <Square size={14} />
                        <span>Rectángulo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddShape("circle");
                          setShapesMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                      >
                        <Circle size={14} />
                        <span>Círculo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddShape("arrow-right");
                          setShapesMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                      >
                        <ArrowRight size={14} />
                        <span>Flecha</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddShape("star");
                          setShapesMenuOpen(false);
                        }}
                        className="flex items-center gap-1.5 p-1.5 hover:bg-[#f3f2f1] rounded text-xs cursor-pointer"
                      >
                        <Star size={14} />
                        <span>Estrella</span>
                      </button>
                    </div>
                  )}
                </div>

                {selectedElementId && (
                  <button
                    type="button"
                    onClick={onDeleteElement}
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-rose-50 text-rose-600 w-14 h-15 cursor-pointer"
                    title="Eliminar elemento seleccionado"
                  >
                    <Trash2 size={18} className="mb-1" />
                    <span className="text-[10px]">Eliminar</span>
                  </button>
                )}
              </div>
              <RibbonGroupFooter
                label="Dibujo"
                onOpenDialog={() => notifyAdvancedDialog("Formato de Forma", "Relleno con textura o degradado, sombra 3D e iluminación.")}
              />
            </div>

            {/* GRUPO PRESENTAR */}
            <div className="flex flex-col justify-between pl-1">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onStartPresentation}
                  className="flex flex-col items-center justify-center p-1.5 rounded bg-[#c43e1c] hover:bg-[#a93217] text-white w-20 h-15 shadow-2xs font-bold cursor-pointer"
                  title="Presentar a pantalla completa (F5)"
                >
                  <Play size={20} className="mb-0.5 fill-current" />
                  <span className="text-[10px] text-center leading-tight">Presentar</span>
                </button>
              </div>
              <RibbonGroupFooter label="Proyección" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <>
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Cuadrícula de datos estilo Excel incrustada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 cursor-pointer"
                >
                  <Grid size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium">Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Cargar imagen desde disco")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-14 h-15 cursor-pointer"
                >
                  <ImageIcon size={20} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-medium">Imágenes</span>
                </button>
                <button
                  type="button"
                  onClick={onAddText}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-16 h-15 cursor-pointer"
                >
                  <Type size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Cuadro de texto</span>
                </button>
              </div>
              <RibbonGroupFooter label="Objetos e Ilustraciones" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DIBUJO ===================== */}
        {activeTab === "dibujo" && (
          <>
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pen")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "pen"
                      ? "bg-[#c43e1c]/10 border-[#c43e1c] text-[#c43e1c]"
                      : "hover:bg-black/5 border-transparent"
                  }`}
                >
                  <PenTool size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium">Bolígrafo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawingTool("pencil")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-14 h-15 border cursor-pointer ${
                    activeDrawingTool === "pencil"
                      ? "bg-[#c43e1c]/10 border-[#c43e1c] text-[#c43e1c]"
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
                      ? "bg-[#c43e1c]/10 border-[#c43e1c] text-[#c43e1c]"
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
                  onClick={() => alert("Conversión de trazos a formas geométricas activada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Sparkles size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Lápiz a forma</span>
                </button>
              </div>
              <RibbonGroupFooter label="Conversión" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: DISEÑO ===================== */}
        {activeTab === "diseno" && (
          <>
            {/* GRUPO TEMAS */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-2 flex-1 items-center">
                {SLIDE_THEMES.map((theme) => {
                  const isSelected = currentTheme.id === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onSelectTheme(theme)}
                      className={`flex flex-col items-center p-1.5 rounded border transition-all cursor-pointer ${
                        isSelected
                          ? "border-[#c43e1c] bg-[#c43e1c]/10 shadow-xs"
                          : "border-[#d2d0ce] hover:border-stone-400 bg-white"
                      }`}
                    >
                      <div
                        className="w-16 h-10 rounded border border-stone-300 flex flex-col justify-center items-center shadow-2xs"
                        style={{ backgroundColor: theme.slideBg }}
                      >
                        <span
                          className="font-bold text-[9px]"
                          style={{ color: theme.titleColor }}
                        >
                          {theme.name.split(" ")[0]}
                        </span>
                        <div
                          className="w-8 h-1 rounded-full mt-1"
                          style={{ backgroundColor: theme.accentColor }}
                        />
                      </div>
                      <span className="text-[9px] mt-1 font-medium text-stone-600 truncate max-w-[64px]">
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <RibbonGroupFooter label="Temas y Variantes" />
            </div>

            {/* GRUPO PERSONALIZAR (TAMAÑO 16:9 / 4:3 Y FONDO) */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-2 flex-1 items-center text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-stone-500 text-[10px]">Tamaño de diapositiva:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setAspectRatio("16:9")}
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                        aspectRatio === "16:9"
                          ? "bg-[#c43e1c] text-white font-bold"
                          : "bg-black/5"
                      }`}
                    >
                      Panorámica (16:9)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectRatio("4:3")}
                      className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                        aspectRatio === "4:3"
                          ? "bg-[#c43e1c] text-white font-bold"
                          : "bg-black/5"
                      }`}
                    >
                      Estándar (4:3)
                    </button>
                  </div>
                </div>
              </div>
              <RibbonGroupFooter
                label="Personalizar"
                onOpenDialog={() => notifyAdvancedDialog("Formato de Fondo", "Relleno degradado, patrón de trama y ocultar gráficos del fondo.")}
              />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: TRANSICIONES ===================== */}
        {activeTab === "transiciones" && (
          <>
            {/* GRUPO GALERÍA DE TRANSICIONES */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                {[
                  { id: "none" as SlideTransition, label: "Ninguna" },
                  { id: "fade" as SlideTransition, label: "Desvanecer" },
                  { id: "push" as SlideTransition, label: "Empuje" },
                  { id: "wipe" as SlideTransition, label: "Barrido" },
                  { id: "zoom" as SlideTransition, label: "Zoom" },
                ].map((tr) => {
                  const isSelected = currentTransition === tr.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => onSelectTransition(tr.id)}
                      className={`flex flex-col items-center justify-center p-1.5 rounded w-16 h-15 border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#c43e1c]/10 border-[#c43e1c] text-[#c43e1c] font-bold"
                          : "border-[#d2d0ce] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      <Layers size={18} className="mb-0.5" />
                      <span className="text-[10px] text-center">{tr.label}</span>
                    </button>
                  );
                })}
              </div>
              <RibbonGroupFooter label="Transición a esta diapositiva" />
            </div>

            {/* GRUPO INTERVALOS */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-3 flex-1 items-center text-xs">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-stone-500" />
                    <span>Duración:</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="10"
                      value={transitionDuration}
                      onChange={(e) => setTransitionDuration(Number(e.target.value))}
                      className="w-12 border rounded px-1 py-0.5 text-xs bg-white"
                    />
                    <span>seg</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert(`Transición ${currentTransition} aplicada a todas las diapositivas`)}
                    className="px-2 py-0.5 rounded bg-black/5 hover:bg-black/10 font-medium text-left cursor-pointer"
                  >
                    Aplicar a todas
                  </button>
                </div>

                <div className="flex flex-col gap-1 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advanceOnClick}
                      onChange={(e) => setAdvanceOnClick(e.target.checked)}
                      className="accent-[#c43e1c]"
                    />
                    <span>Al hacer clic</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span>Después de:</span>
                    <input
                      type="number"
                      min="1"
                      value={advanceAfterSeconds}
                      onChange={(e) => setAdvanceAfterSeconds(Number(e.target.value))}
                      className="w-10 border rounded px-1 py-0.5 text-xs bg-white"
                    />
                    <span>s</span>
                  </div>
                </div>
              </div>
              <RibbonGroupFooter label="Intervalos" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: ANIMACIONES ===================== */}
        {activeTab === "animaciones" && (
          <>
            {/* GRUPO ANIMACIÓN POR COLORES: ENTRADA (VERDE), ÉNFASIS (AMARILLO), SALIDA (ROJO) */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                {/* Entradas (Verdes) */}
                <button
                  type="button"
                  onClick={() => setSelectedAnimation("entrada-desvanecer")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-16 h-15 border transition-all cursor-pointer ${
                    selectedAnimation === "entrada-desvanecer"
                      ? "bg-emerald-50 border-emerald-600 text-emerald-800 font-bold"
                      : "border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <Sparkles size={18} className="text-emerald-600 mb-0.5" />
                  <span className="text-[10px] text-center leading-tight">Desvanecer (Entrada)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAnimation("entrada-zoom")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-16 h-15 border transition-all cursor-pointer ${
                    selectedAnimation === "entrada-zoom"
                      ? "bg-emerald-50 border-emerald-600 text-emerald-800 font-bold"
                      : "border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <Maximize2 size={18} className="text-emerald-600 mb-0.5" />
                  <span className="text-[10px] text-center leading-tight">Zoom (Entrada)</span>
                </button>

                {/* Énfasis (Amarillo) */}
                <button
                  type="button"
                  onClick={() => setSelectedAnimation("enfasis-girar")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-16 h-15 border transition-all cursor-pointer ${
                    selectedAnimation === "enfasis-girar"
                      ? "bg-amber-50 border-amber-500 text-amber-800 font-bold"
                      : "border-amber-200 hover:bg-amber-50/50"
                  }`}
                >
                  <Star size={18} className="text-amber-500 mb-0.5" />
                  <span className="text-[10px] text-center leading-tight">Girar (Énfasis)</span>
                </button>

                {/* Salida (Rojo) */}
                <button
                  type="button"
                  onClick={() => setSelectedAnimation("salida-desvanecer")}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-16 h-15 border transition-all cursor-pointer ${
                    selectedAnimation === "salida-desvanecer"
                      ? "bg-rose-50 border-rose-500 text-rose-800 font-bold"
                      : "border-rose-200 hover:bg-rose-50/50"
                  }`}
                >
                  <Trash2 size={18} className="text-rose-500 mb-0.5" />
                  <span className="text-[10px] text-center leading-tight">Desvanecer (Salida)</span>
                </button>
              </div>
              <RibbonGroupFooter
                label="Animación"
                onOpenDialog={() => notifyAdvancedDialog("Animaciones", "Trayectorias de desplazamiento personalizadas y curvas de aceleración.")}
              />
            </div>

            {/* GRUPO ANIMACIÓN AVANZADA E INTERVALOS */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-2 flex-1 items-center text-xs">
                <button
                  type="button"
                  onClick={() => alert("Panel de animación lateral abierto")}
                  className="px-2 py-1.5 rounded bg-black/5 hover:bg-black/10 font-medium cursor-pointer"
                >
                  Panel de animación
                </button>
                <div className="flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span>Inicio:</span>
                    <select
                      value={animationTiming}
                      onChange={(e) => setAnimationTiming(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs bg-white cursor-pointer"
                    >
                      <option value="onclick">Al hacer clic</option>
                      <option value="withprevious">Con la anterior</option>
                      <option value="afterprevious">Después de la anterior</option>
                    </select>
                  </div>
                </div>
              </div>
              <RibbonGroupFooter label="Intervalos" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: PRESENTACIÓN CON DIAPOSITIVAS ===================== */}
        {activeTab === "presentacion" && (
          <>
            {/* GRUPO INICIAR PRESENTACIÓN */}
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onStartPresentation}
                  className="flex flex-col items-center justify-center p-1.5 rounded bg-[#c43e1c] hover:bg-[#a93217] text-white w-20 h-15 shadow-2xs font-bold cursor-pointer"
                >
                  <Play size={20} className="mb-0.5 fill-current" />
                  <span className="text-[10px] text-center leading-tight">Desde el principio (F5)</span>
                </button>
                <button
                  type="button"
                  onClick={onStartPresentation}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-20 h-15 border border-transparent hover:border-[#d2d0ce] cursor-pointer"
                >
                  <Presentation size={20} className="text-[#c43e1c] mb-0.5" />
                  <span className="text-[10px] text-center leading-tight">Desde la actual (Shift+F5)</span>
                </button>
              </div>
              <RibbonGroupFooter label="Iniciar presentación" />
            </div>

            {/* GRUPO CONFIGURAR */}
            <div className="flex flex-col justify-between px-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Diapositiva actual oculta de la proyección")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Eye size={18} className="text-stone-600 mb-1" />
                  <span className="text-[10px] text-center leading-tight">Ocultar diapositiva</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Ensayo de intervalos con temporizador en pantalla")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Clock size={18} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] text-center leading-tight">Ensayar intervalos</span>
                </button>
              </div>
              <RibbonGroupFooter label="Configurar" />
            </div>

            {/* GRUPO MONITORES */}
            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => alert("Vista Moderador activada: Presentación en proyector y notas en tu pantalla")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-20 h-15 cursor-pointer"
                >
                  <Monitor size={18} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] text-center leading-tight">Vista Moderador</span>
                </button>
              </div>
              <RibbonGroupFooter label="Monitores" />
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
                  onClick={() => alert("Comprobación ortográfica completada")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <ShieldCheck size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Ortografía</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Traducción inteligente de diapositiva")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Globe size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Traducir</span>
                </button>
              </div>
              <RibbonGroupFooter label="Revisión e Idioma" />
            </div>

            <div className="flex flex-col justify-between px-2.5">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    const com = prompt("Comentario para la diapositiva:");
                    if (com) alert(`Comentario guardado: ${com}`);
                  }}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-20 h-15 cursor-pointer"
                >
                  <MessageSquare size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Nuevo comentario</span>
                </button>
              </div>
              <RibbonGroupFooter label="Comentarios" />
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <>
            <div className="flex flex-col justify-between pr-2.5 border-r border-[#e1dfdd]">
              <div className="flex items-center gap-1.5 flex-1 items-center">
                <button
                  type="button"
                  onClick={onToggleNotes}
                  className={`flex flex-col items-center justify-center p-1.5 rounded w-18 h-15 border transition-colors cursor-pointer ${
                    showNotes
                      ? "bg-[#c43e1c]/10 border-[#c43e1c] text-[#c43e1c] font-bold"
                      : "border-transparent hover:bg-[#f3f2f1]"
                  }`}
                >
                  <MessageSquare size={20} className="mb-1" />
                  <span className="text-[10px] text-center leading-tight">Notas del orador</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert("Cuadrícula y guías de alineación magnética visibles")}
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Grid size={20} className="text-stone-600 mb-1" />
                  <span className="text-[10px] text-center leading-tight">Guías y regla</span>
                </button>
              </div>
              <RibbonGroupFooter label="Vistas y Mostrar" />
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
                    alert("Atajos de CoffeView:\nF5: Presentar desde el inicio\nShift+F5: Presentar diapositiva actual\nCtrl+M: Nueva diapositiva\nEscape: Salir de presentación")
                  }
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <HelpCircle size={20} className="text-[#c43e1c] mb-1" />
                  <span className="text-[10px] font-medium text-center leading-tight">Atajos</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    alert("CoffeView Suite 2026\nHerramienta de diseño y proyección de diapositivas 16:9.\nCompatible con Microsoft PowerPoint (.pptx), .csl y JSON.")
                  }
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#f3f2f1] w-18 h-15 cursor-pointer"
                >
                  <Presentation size={20} className="text-stone-500 mb-1" />
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
