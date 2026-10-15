import React, { useState } from "react";
import {
  Search,
  Plus,
  Undo2,
  Redo2,
  Printer,
  Paintbrush,
  ChevronDown,
  ChevronUp,
  MousePointer,
  Type,
  Image as ImageIcon,
  Square,
  Minus,
  Check,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Table as TableIcon,
  MessageSquarePlus,
} from "lucide-react";
import type { SlideTheme, SlideTransition, SlideLayout, ShapeType } from "../types";
import { SLIDE_THEMES } from "../services/presentationVault";

interface GoogleSlidesToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  onFormatPainter: () => void;
  isFormatPainterActive: boolean;
  onAddSlide: (layout?: SlideLayout) => void;
  onAddText: () => void;
  onAddShape: (shape: ShapeType) => void;
  onInsertImage: () => void;
  currentTheme: SlideTheme;
  onSelectTheme: (themeId: string) => void;
  currentTransition: SlideTransition;
  onSelectTransition: (tr: SlideTransition) => void;
  selectedElementId?: string | null;
  onToggleBold?: () => void;
  onToggleItalic?: () => void;
  onToggleUnderline?: () => void;
  onSetAlign?: (align: "left" | "center" | "right" | "justify") => void;
  onSetFontSize?: (size: number) => void;
  onSetFontFamily?: (font: string) => void;
  onDeleteElement?: () => void;
  onAddComment?: () => void;
  onAddTable?: () => void;
}

export const GoogleSlidesToolbar: React.FC<GoogleSlidesToolbarProps> = ({
  onUndo,
  onRedo,
  onPrint,
  onFormatPainter,
  isFormatPainterActive,
  onAddSlide,
  onAddText,
  onAddShape,
  onInsertImage,
  currentTheme,
  onSelectTheme,
  currentTransition,
  onSelectTransition,
  selectedElementId,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onSetAlign,
  onSetFontSize,
  onSetFontFamily,
  onDeleteElement,
  onAddComment,
  onAddTable,
}) => {
  const [zoom, setZoom] = useState(100);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [newSlideOpen, setNewSlideOpen] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  return (
    <div className="w-full px-4 py-1 flex items-center justify-between select-none bg-white">
      {/* Contenedor tipo píldora flotante de Google Slides */}
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

        {/* 2. Botón Nueva diapositiva con desplegable (+) */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => onAddSlide("title-content")}
            className="p-1.5 rounded-l-full hover:bg-gray-200/70 text-[#444746] transition-colors"
            title="Nueva diapositiva con diseño actual (Ctrl+M)"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            onClick={() => setNewSlideOpen(!newSlideOpen)}
            className="p-1.5 rounded-r-full hover:bg-gray-200/70 text-[#444746] transition-colors"
            title="Diseño para nueva diapositiva"
          >
            <ChevronDown size={11} />
          </button>

          {newSlideOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 z-50 min-w-[160px]">
              {[
                { id: "title", label: "Diapositiva de título" },
                { id: "title-content", label: "Título y contenido" },
                { id: "section-header", label: "Encabezado de sección" },
                { id: "two-column", label: "Dos columnas" },
                { id: "blank", label: "En blanco" },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onAddSlide(l.id as SlideLayout);
                    setNewSlideOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f]"
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Deshacer, Rehacer, Imprimir, Copiar formato */}
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

        {/* Zoom */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setZoomOpen(!zoomOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer"
            title="Zoom"
          >
            <span>{zoom}%</span>
            <ChevronDown size={11} />
          </button>
          {zoomOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[85px]">
              {[50, 75, 100, 125, 150].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    setZoom(z);
                    setZoomOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    zoom === z ? "font-bold text-[#F4B400]" : "text-[#444746]"
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

        {/* 4. Herramientas de Lienzo: Flecha, Cuadro de texto, Imagen, Formas, Línea */}
        <button
          type="button"
          className="p-1.5 rounded-full bg-white text-[#1a73e8] shadow-xs"
          title="Seleccionar (Flecha)"
        >
          <MousePointer size={15} />
        </button>

        <button
          type="button"
          onClick={onAddText}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Cuadro de texto"
        >
          <Type size={15} />
        </button>

        <button
          type="button"
          onClick={onInsertImage}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Insertar imagen"
        >
          <ImageIcon size={15} />
        </button>

        {/* Formas */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShapeOpen(!shapeOpen)}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5"
            title="Forma"
          >
            <Square size={15} />
            <ChevronDown size={11} />
          </button>
          {shapeOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[130px]">
              {[
                { id: "rectangle", label: "Rectángulo" },
                { id: "rounded", label: "Rectángulo redondeado" },
                { id: "circle", label: "Círculo / Óvalo" },
                { id: "callout", label: "Bocadillo de llamada" },
                { id: "star", label: "Estrella" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onAddShape(s.id as ShapeType);
                    setShapeOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAddShape("rectangle")}
          className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
          title="Línea"
        >
          <Minus size={15} />
        </button>

        {onAddTable && (
          <button
            type="button"
            onClick={onAddTable}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
            title="Insertar tabla"
          >
            <TableIcon size={15} />
          </button>
        )}

        {onAddComment && (
          <button
            type="button"
            onClick={onAddComment}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
            title="Agregar comentario"
          >
            <MessageSquarePlus size={15} />
          </button>
        )}

        {/* Herramientas de texto si hay un elemento activo */}
        {selectedElementId && (
          <>
            <div className="h-4 w-px bg-gray-300 mx-0.5" />

            {/* Selector de fuente */}
            <select
              defaultValue="Arial"
              onChange={(e) => onSetFontFamily?.(e.target.value)}
              className="bg-transparent text-xs text-[#444746] font-medium px-1 py-0.5 rounded hover:bg-gray-200/70 cursor-pointer outline-none"
              title="Fuente"
            >
              <option value="Arial">Arial</option>
              <option value="Roboto">Roboto</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>

            {/* Selector de tamaño */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onSetFontSize?.(18)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200/70 text-[10px] font-bold"
                title="Reducir tamaño"
              >
                -
              </button>
              <span className="px-1 text-[11px] font-medium">18</span>
              <button
                type="button"
                onClick={() => onSetFontSize?.(24)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200/70 text-[10px] font-bold"
                title="Aumentar tamaño"
              >
                +
              </button>
            </div>

            {/* Negrita, Cursiva, Subrayado */}
            <button
              type="button"
              onClick={onToggleBold}
              className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
              title="Negrita (Ctrl+B)"
            >
              <Bold size={14} />
            </button>

            <button
              type="button"
              onClick={onToggleItalic}
              className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
              title="Cursiva (Ctrl+I)"
            >
              <Italic size={14} />
            </button>

            <button
              type="button"
              onClick={onToggleUnderline}
              className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors"
              title="Subrayado (Ctrl+U)"
            >
              <Underline size={14} />
            </button>

            {/* Alineación */}
            <button
              type="button"
              onClick={() => onSetAlign?.("left")}
              className="p-1 rounded hover:bg-gray-200/70 text-[#444746]"
              title="Alinear a la izquierda"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSetAlign?.("center")}
              className="p-1 rounded hover:bg-gray-200/70 text-[#444746]"
              title="Centrar"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              onClick={() => onSetAlign?.("right")}
              className="p-1 rounded hover:bg-gray-200/70 text-[#444746]"
              title="Alinear a la derecha"
            >
              <AlignRight size={14} />
            </button>

            {/* Eliminar elemento */}
            <button
              type="button"
              onClick={onDeleteElement}
              className="p-1.5 rounded-full hover:bg-red-100 text-red-600 transition-colors ml-1"
              title="Eliminar elemento seleccionado (Supr)"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}

        <div className="h-4 w-px bg-gray-300 mx-0.5" />

        {/* 5. Botones contextuales verbatim de Google Slides: Fondo, Diseño, Tema, Transición */}
        <button
          type="button"
          onClick={() => {
            const color = window.prompt("Color de fondo de diapositiva (ej: #ffffff o #f0f4f9):", "#ffffff");
            if (color) alert(`Fondo de diapositiva cambiado a ${color}`);
          }}
          className="px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs transition-colors"
          title="Cambiar fondo"
        >
          Fondo
        </button>

        {/* Diseño */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayoutOpen(!layoutOpen)}
            className="px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs transition-colors"
            title="Aplicar diseño"
          >
            Diseño
          </button>
          {layoutOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[150px]">
              {[
                { id: "title", label: "Diapositiva de título" },
                { id: "title-content", label: "Título y contenido" },
                { id: "section-header", label: "Encabezado de sección" },
                { id: "blank", label: "En blanco" },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onAddSlide(l.id as SlideLayout);
                    setLayoutOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f]"
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tema */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setThemeOpen(!themeOpen)}
            className="px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs transition-colors"
            title="Cambiar tema"
          >
            Tema
          </button>
          {themeOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[160px]">
              {SLIDE_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(th.id);
                    setThemeOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    currentTheme.id === th.id ? "font-bold text-[#F4B400]" : "text-[#1f1f1f]"
                  }`}
                >
                  <span>{th.name}</span>
                  {currentTheme.id === th.id && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transición */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTransitionOpen(!transitionOpen)}
            className="px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs transition-colors"
            title="Transición de diapositiva"
          >
            Transición
          </button>
          {transitionOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
              {[
                { id: "none", label: "Sin transición" },
                { id: "fade", label: "Disolver" },
                { id: "slide-left", label: "Deslizar izquierda" },
                { id: "zoom", label: "Zoom" },
                { id: "flip", label: "Voltear" },
              ].map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => {
                    onSelectTransition(tr.id as SlideTransition);
                    setTransitionOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] flex items-center justify-between ${
                    currentTransition === tr.id ? "font-bold text-[#F4B400]" : "text-[#1f1f1f]"
                  }`}
                >
                  <span>{tr.label}</span>
                  {currentTransition === tr.id && <Check size={12} />}
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
