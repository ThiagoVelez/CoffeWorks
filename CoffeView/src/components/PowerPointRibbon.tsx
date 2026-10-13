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
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);

  const tabs: Array<{ id: PowerPointRibbonTab; label: string }> = [
    { id: "inicio", label: "Inicio" },
    { id: "insertar", label: "Insertar" },
    { id: "dibujo", label: "Dibujo" },
    { id: "diseno", label: "Diseño" },
    { id: "transiciones", label: "Transiciones" },
    { id: "animaciones", label: "Animaciones" },
    { id: "presentacion", label: "Presentación con diapositivas" },
    { id: "vista", label: "Vista" },
  ];

  return (
    <div className="bg-[#f3f2f1] border-b border-[#d2d0ce] select-none text-xs flex flex-col z-40">
      {/* 1. Barra de Pestañas de PowerPoint */}
      <div className="flex items-center px-2 pt-0.5 border-b border-[#e1dfdd] bg-[#fbf9f6]">
        {/* Pestaña fija Archivo en color rojo/vino PowerPoint y accesos rápidos */}
        <div className="flex items-center gap-1 mr-1">
          <button
            type="button"
            onClick={onNewPresentation}
            title="Nueva Presentación"
            className="px-3.5 py-1.5 font-bold text-white bg-[#c43e1c] hover:bg-[#a93217] transition-colors rounded-t text-xs tracking-wide"
          >
            Archivo
          </button>
          <button
            type="button"
            onClick={onSave}
            title="Guardar en bóveda local (Ctrl+S)"
            className="p-1.5 text-gray-700 hover:text-[#c43e1c] hover:bg-[#edebe9] rounded transition-colors"
          >
            <Save size={14} />
          </button>
          <button
            type="button"
            onClick={onOpenExport}
            title="Exportar diapositivas"
            className="p-1.5 text-gray-700 hover:text-[#c43e1c] hover:bg-[#edebe9] rounded transition-colors"
          >
            <Share2 size={14} />
          </button>
        </div>

        {/* Pestañas estándar */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-3 py-1.5 text-xs transition-colors rounded-t ${
                isActive
                  ? "bg-[#f3f2f1] text-[#c43e1c] font-bold border-t-2 border-[#c43e1c] shadow-xs"
                  : "text-[#323130] hover:bg-[#edebe9]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. Área de Herramientas de la Cinta Ribbon */}
      <div className="h-20 px-3 py-1 flex items-center gap-4 overflow-x-auto bg-[#f3f2f1]">
        {/* ===================== PESTAÑA: INICIO ===================== */}
        {activeTab === "inicio" && (
          <>
            {/* Grupo: Diapositivas */}
            <div className="flex flex-col justify-between pr-3 border-r border-[#d2d0ce] h-full">
              <div className="flex items-center gap-1.5 flex-1 relative">
                {/* Botón Nueva Diapositiva con dropdown de diseños */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
                    title="Agregar nueva diapositiva"
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#edebe9] text-[#201f1e] text-[11px] font-medium"
                  >
                    <FilePlus size={20} className="text-[#c43e1c]" />
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span>Nueva diapositiva</span>
                      <ChevronDown size={11} />
                    </div>
                  </button>

                  {/* Menú de diseños de diapositiva */}
                  {layoutMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-[#d2d0ce] p-1.5 z-50">
                      <span className="text-[10px] font-bold text-[#605e5c] px-2 py-1 block uppercase">
                        Diseño de diapositiva
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onAddSlide("title");
                          setLayoutMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
                      >
                        <Layout size={14} className="text-[#c43e1c]" />
                        <span>Diapositiva de Título</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddSlide("title-content");
                          setLayoutMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
                      >
                        <Layout size={14} className="text-[#c43e1c]" />
                        <span>Título y Objetos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddSlide("two-columns");
                          setLayoutMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
                      >
                        <Layout size={14} className="text-[#c43e1c]" />
                        <span>Dos Columnas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddSlide("blank");
                          setLayoutMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
                      >
                        <Layout size={14} className="text-[#c43e1c]" />
                        <span>En Blanco</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Duplicar / Eliminar Diapositiva */}
                <div className="flex flex-col gap-1 border-l border-[#e1dfdd] pl-1.5">
                  <button
                    type="button"
                    onClick={onDuplicateSlide}
                    title="Duplicar diapositiva seleccionada"
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#edebe9] text-[11px] text-[#323130]"
                  >
                    <Copy size={13} />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteSlide}
                    title="Eliminar diapositiva seleccionada"
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#edebe9] text-[11px] text-red-600"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Diapositivas
              </span>
            </div>

            {/* Grupo: Fuente y Formato */}
            <div className="flex flex-col justify-between pr-3 border-r border-[#d2d0ce] h-full">
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={onToggleBold}
                  title="Negrita (Ctrl + B)"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={onToggleItalic}
                  title="Cursiva (Ctrl + I)"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={onToggleUnderline}
                  title="Subrayado (Ctrl + U)"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <Underline size={14} />
                </button>

                <div className="h-4 w-px bg-[#d2d0ce] mx-1" />

                <button
                  type="button"
                  onClick={() => onSetAlign("left")}
                  title="Alinear a la izquierda"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("center")}
                  title="Centrar"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("right")}
                  title="Alinear a la derecha"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <AlignRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetAlign("justify")}
                  title="Justificar"
                  className="p-1.5 rounded hover:bg-[#edebe9] text-[#323130]"
                >
                  <AlignJustify size={14} />
                </button>
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Fuente y Párrafo
              </span>
            </div>

            {/* Grupo: Dibujo y Formas */}
            <div className="flex flex-col justify-between pr-3 border-r border-[#d2d0ce] h-full">
              <div className="flex items-center gap-1.5 flex-1 relative">
                {/* Cuadro de texto */}
                <button
                  type="button"
                  onClick={onAddText}
                  title="Insertar nuevo cuadro de texto"
                  className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#edebe9] text-[11px] font-medium"
                >
                  <Type size={18} className="text-[#c43e1c]" />
                  <span className="mt-0.5">Texto</span>
                </button>

                {/* Formas */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShapesMenuOpen(!shapesMenuOpen)}
                    title="Insertar formas geométricas"
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#edebe9] text-[11px] font-medium"
                  >
                    <Square size={18} className="text-[#c43e1c]" />
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span>Formas</span>
                      <ChevronDown size={11} />
                    </div>
                  </button>

                  {shapesMenuOpen && (
                    <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-[#d2d0ce] p-1.5 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          onAddShape("rectangle");
                          setShapesMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
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
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
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
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
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
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#f3f2f1] text-xs flex items-center gap-2"
                      >
                        <Star size={14} />
                        <span>Estrella</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Eliminar elemento seleccionado */}
                {selectedElementId && (
                  <button
                    type="button"
                    onClick={onDeleteElement}
                    title="Eliminar elemento seleccionado (Supr)"
                    className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-red-50 text-red-600 text-[11px] font-medium"
                  >
                    <Trash2 size={18} />
                    <span className="mt-0.5">Borrar</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-[9px] text-center tracking-wider uppercase font-semibold text-[#605e5c]">
                Dibujo
              </span>
            </div>
          </>
        )}

        {/* ===================== PESTAÑA: INSERTAR ===================== */}
        {activeTab === "insertar" && (
          <div className="flex items-center gap-3 h-full">
            <button
              type="button"
              onClick={() => onAddSlide("title-content")}
              className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#edebe9] text-[11px]"
            >
              <FilePlus size={20} className="text-[#c43e1c]" />
              <span>Diapositiva</span>
            </button>
            <button
              type="button"
              onClick={onAddText}
              className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#edebe9] text-[11px]"
            >
              <Type size={20} className="text-[#c43e1c]" />
              <span>Cuadro de Texto</span>
            </button>
            <button
              type="button"
              onClick={() => onAddShape("rectangle")}
              className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#edebe9] text-[11px]"
            >
              <Square size={20} className="text-[#c43e1c]" />
              <span>Formas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const url = prompt("Ingrese la URL de la imagen:");
                if (url) {
                  // Agregar elemento imagen
                }
              }}
              className="flex flex-col items-center justify-center p-2 rounded hover:bg-[#edebe9] text-[11px]"
            >
              <ImageIcon size={20} className="text-[#c43e1c]" />
              <span>Imágenes</span>
            </button>
          </div>
        )}

        {/* ===================== PESTAÑA: DISEÑO ===================== */}
        {activeTab === "diseno" && (
          <div className="flex items-center gap-4 h-full">
            <span className="font-bold text-xs text-[#201f1e] mr-2">Temas de Diapositiva:</span>
            {SLIDE_THEMES.map((th) => {
              const isCurrent = currentTheme.id === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => onSelectTheme(th)}
                  className={`flex flex-col items-center p-1.5 rounded-lg border-2 transition-all ${
                    isCurrent
                      ? "border-[#c43e1c] shadow-md scale-105"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <div
                    style={{ backgroundColor: th.slideBg }}
                    className="w-16 h-10 rounded border border-gray-400 shadow-xs flex items-center justify-center p-1"
                  >
                    <div
                      style={{ backgroundColor: th.accentColor }}
                      className="w-8 h-2 rounded-xs"
                    />
                  </div>
                  <span className="text-[10px] font-medium mt-1 truncate max-w-[70px]">
                    {th.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ===================== PESTAÑA: TRANSICIONES ===================== */}
        {activeTab === "transiciones" && (
          <div className="flex items-center gap-2 h-full">
            <span className="font-bold text-xs text-[#201f1e] mr-2">Efecto entre diapositivas:</span>
            {(
              [
                { id: "none", label: "Ninguna" },
                { id: "fade", label: "Desvanecer" },
                { id: "push", label: "Empujar" },
                { id: "wipe", label: "Barrido" },
                { id: "zoom", label: "Zoom" },
              ] as Array<{ id: SlideTransition; label: string }>
            ).map((tr) => {
              const isSelected = currentTransition === tr.id;
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => onSelectTransition(tr.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    isSelected
                      ? "bg-[#c43e1c] text-white border-[#a93217] shadow-xs"
                      : "bg-white text-[#323130] border-[#d2d0ce] hover:bg-[#edebe9]"
                  }`}
                >
                  {tr.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ===================== PESTAÑA: PRESENTACIÓN ===================== */}
        {activeTab === "presentacion" && (
          <div className="flex items-center gap-3 h-full">
            <button
              type="button"
              onClick={onStartPresentation}
              className="flex items-center gap-2 px-4 py-2 bg-[#c43e1c] hover:bg-[#a93217] text-white font-bold rounded-lg shadow-sm text-xs transition-transform active:scale-95"
            >
              <Play size={16} fill="currentColor" />
              <span>Desde el principio (F5)</span>
            </button>
            <button
              type="button"
              onClick={onStartPresentation}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#edebe9] text-[#201f1e] border border-[#d2d0ce] font-medium rounded-lg text-xs"
            >
              <Maximize2 size={14} />
              <span>Desde la diapositiva actual</span>
            </button>
          </div>
        )}

        {/* ===================== PESTAÑA: VISTA ===================== */}
        {activeTab === "vista" && (
          <div className="flex items-center gap-3 h-full">
            <button
              type="button"
              onClick={onToggleNotes}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                showNotes
                  ? "bg-[#c43e1c] text-white border-[#a93217]"
                  : "bg-white text-[#323130] border-[#d2d0ce] hover:bg-[#edebe9]"
              }`}
            >
              <MessageSquare size={14} />
              <span>Notas del orador</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
