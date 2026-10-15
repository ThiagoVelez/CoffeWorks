import React, { useState, useEffect } from "react";
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
  X,
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
  onChangeSlideLayout?: (layout: SlideLayout) => void;
  onSetSlideBackground?: (color: string, applyToAll?: boolean) => void;
  currentSlideBackground?: string;
  onAddText: () => void;
  onAddShape: (shape: ShapeType) => void;
  onInsertImage: () => void;
  currentTheme: SlideTheme;
  onSelectTheme: (themeId: string) => void;
  currentTransition: SlideTransition;
  onSelectTransition: (tr: SlideTransition) => void;
  onApplyTransitionToAll?: (tr: SlideTransition) => void;
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
  onChangeSlideLayout,
  onSetSlideBackground,
  currentSlideBackground,
  onAddText,
  onAddShape,
  onInsertImage,
  currentTheme,
  onSelectTheme,
  currentTransition,
  onSelectTransition,
  onApplyTransitionToAll,
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
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [selectedBgColor, setSelectedBgColor] = useState(
    currentSlideBackground || currentTheme.slideBg
  );

  useEffect(() => {
    setSelectedBgColor(currentSlideBackground || currentTheme.slideBg);
  }, [currentSlideBackground, currentTheme.slideBg]);

  return (
    <div className="w-full px-4 py-1 flex items-center justify-between select-none bg-white">
      {/* Contenedor tipo píldora flotante de Google Slides sin saltos de línea */}
      <div className="bg-[#edf2fa] rounded-full px-2.5 py-1 flex items-center gap-0.5 shadow-xs text-[#444746] text-xs flex-nowrap overflow-x-auto max-w-full">
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

        {/* 5. Botones contextuales completamente programados de Google Slides: Fondo, Diseño, Tema, Transición */}
        {/* Fondo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBgModalOpen(true)}
            className="px-2 py-0.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs whitespace-nowrap transition-colors"
            title="Cambiar fondo de diapositiva"
          >
            Fondo
          </button>
        </div>

        {/* Diseño */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLayoutOpen(!layoutOpen)}
            className="px-2 py-0.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs whitespace-nowrap transition-colors"
            title="Aplicar diseño a la diapositiva actual"
          >
            Diseño
          </button>
          {layoutOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl py-2 z-50 min-w-[200px] text-[#1f1f1f]">
              <div className="px-3 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Diseños disponibles
              </div>
              {[
                {
                  id: "title",
                  label: "Diapositiva de título",
                  preview: (
                    <div className="w-8 h-5 border border-gray-300 rounded-xs flex flex-col items-center justify-center gap-0.5 bg-gray-50 p-0.5">
                      <div className="w-5 h-1 bg-gray-700 rounded-xs" />
                      <div className="w-3 h-0.5 bg-gray-400 rounded-xs" />
                    </div>
                  ),
                },
                {
                  id: "title-content",
                  label: "Título y contenido",
                  preview: (
                    <div className="w-8 h-5 border border-gray-300 rounded-xs flex flex-col gap-0.5 bg-gray-50 p-0.5">
                      <div className="w-6 h-1 bg-gray-700 rounded-xs" />
                      <div className="w-6 h-2.5 bg-gray-300 rounded-xs" />
                    </div>
                  ),
                },
                {
                  id: "two-columns",
                  label: "Dos columnas",
                  preview: (
                    <div className="w-8 h-5 border border-gray-300 rounded-xs flex flex-col gap-0.5 bg-gray-50 p-0.5">
                      <div className="w-6 h-1 bg-gray-700 rounded-xs" />
                      <div className="flex gap-0.5 flex-1">
                        <div className="flex-1 bg-gray-300 rounded-xs" />
                        <div className="flex-1 bg-gray-300 rounded-xs" />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "blank",
                  label: "En blanco",
                  preview: (
                    <div className="w-8 h-5 border border-gray-300 rounded-xs bg-white" />
                  ),
                },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    onChangeSlideLayout?.(l.id as SlideLayout);
                    setLayoutOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  {l.preview}
                  <span className="font-medium">{l.label}</span>
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
            className="px-2 py-0.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs whitespace-nowrap transition-colors"
            title="Cambiar tema de la presentación"
          >
            Tema
          </button>
          {themeOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 z-50 min-w-[220px] text-[#1f1f1f]">
              <div className="px-2 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Temas de presentación
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {SLIDE_THEMES.map((th) => {
                  const isActive = currentTheme.id === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        onSelectTheme(th.id);
                        setThemeOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2.5 cursor-pointer ${
                        isActive
                          ? "border-[#1a73e8] bg-blue-50/50 ring-1 ring-[#1a73e8]"
                          : "border-gray-200 hover:border-gray-300 hover:bg-[#f0f4f9]"
                      }`}
                    >
                      {/* Miniatura del tema */}
                      <div
                        style={{ backgroundColor: th.slideBg }}
                        className="w-10 h-7 rounded-sm border border-gray-300 shadow-2xs flex flex-col justify-center px-1 shrink-0"
                      >
                        <div
                          style={{ color: th.titleColor }}
                          className="text-[7px] font-bold leading-none truncate"
                        >
                          Aa
                        </div>
                        <div
                          style={{ backgroundColor: th.accentColor }}
                          className="h-0.5 w-4 mt-0.5 rounded-full"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#1f1f1f] truncate">
                          {th.name}
                        </div>
                      </div>

                      {isActive && <Check size={14} className="text-[#1a73e8] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Transición */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTransitionOpen(!transitionOpen)}
            className="px-2 py-0.5 rounded-full hover:bg-gray-200/70 text-[#444746] font-medium text-xs whitespace-nowrap transition-colors"
            title="Transición de diapositiva"
          >
            Transición
          </button>
          {transitionOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-50 min-w-[210px] text-[#1f1f1f]">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Transición de diapositiva
              </div>
              <div className="flex flex-col gap-1">
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
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs hover:bg-[#f0f4f9] flex items-center justify-between transition-colors cursor-pointer ${
                      currentTransition === tr.id
                        ? "font-bold text-[#1a73e8] bg-blue-50"
                        : "text-[#1f1f1f]"
                    }`}
                  >
                    <span>{tr.label}</span>
                    {currentTransition === tr.id && <Check size={14} />}
                  </button>
                ))}
              </div>

              {/* Botón Aplicar a todas las diapositivas */}
              <button
                type="button"
                onClick={() => {
                  onApplyTransitionToAll?.(currentTransition);
                  setTransitionOpen(false);
                }}
                className="w-full mt-2.5 pt-2 border-t border-gray-200 text-center text-xs font-semibold text-[#1a73e8] hover:text-[#1557b0] hover:underline cursor-pointer py-1"
              >
                Aplicar a todas las diapositivas
              </button>
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

      {/* Modal flotante de Fondo */}
      {bgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-96 p-5 flex flex-col gap-4 text-[#1f1f1f] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-semibold text-sm text-[#1f1f1f]">Fondo de diapositiva</h3>
              <button
                type="button"
                onClick={() => setBgModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Muestra de color y selector libre */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#444746]">Color de fondo:</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={selectedBgColor}
                  onChange={(e) => setSelectedBgColor(e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer border border-gray-300 p-0.5"
                  title="Elegir color personalizado"
                />
                <span className="text-xs font-mono font-medium text-[#444746] uppercase">
                  {selectedBgColor}
                </span>
              </div>

              {/* Paleta rápida de 16 colores */}
              <div className="grid grid-cols-8 gap-1.5 mt-2">
                {[
                  "#ffffff",
                  "#f8f9fa",
                  "#e8eaed",
                  "#dadce0",
                  "#fce8e6",
                  "#fef7e0",
                  "#e6f4ea",
                  "#e8f0fe",
                  "#202124",
                  "#1e140f",
                  "#2b2523",
                  "#3c4043",
                  "#ea4335",
                  "#fbbc04",
                  "#34a853",
                  "#1a73e8",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedBgColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border border-gray-300 transition-transform hover:scale-110 shadow-2xs cursor-pointer ${
                      selectedBgColor.toLowerCase() === c.toLowerCase()
                        ? "ring-2 ring-[#1a73e8] scale-110"
                        : ""
                    }`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="flex items-center justify-between pt-3 border-t mt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBgColor(currentTheme.slideBg);
                  onSetSlideBackground?.(currentTheme.slideBg, false);
                }}
                className="px-3 py-1.5 text-xs text-[#1a73e8] hover:bg-blue-50 rounded-lg font-medium transition-colors"
              >
                Restablecer
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSetSlideBackground?.(selectedBgColor, true);
                    setBgModalOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-[#1f1f1f] rounded-lg font-medium transition-colors"
                  title="Aplicar a todas las diapositivas"
                >
                  Agregar al tema
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSetSlideBackground?.(selectedBgColor, false);
                    setBgModalOpen(false);
                  }}
                  className="px-4 py-1.5 text-xs bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg font-medium shadow-xs transition-colors"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
