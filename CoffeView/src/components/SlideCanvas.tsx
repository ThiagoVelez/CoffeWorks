import React, { useRef, useState } from "react";
import type { Slide, SlideElement, SlideTheme } from "../types";

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  theme,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Manejo de clic en el fondo de la diapositiva para deseleccionar
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectElement(null);
      setEditingId(null);
    }
  };

  return (
    <div
      className="flex-1 bg-[#4a4744] overflow-auto flex items-center justify-center p-8 select-none relative"
      onClick={handleCanvasClick}
    >
      {/* Contenedor principal de la Diapositiva 16:9 */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ backgroundColor: slide.background || theme.slideBg }}
        className="w-[960px] h-[540px] max-w-full aspect-video rounded-sm relative slide-canvas-shadow overflow-hidden transition-colors shrink-0"
      >
        {/* Elementos dentro de la Diapositiva */}
        {slide.elements.map((el) => {
          const isSelected = el.id === selectedElementId;
          const isEditing = el.id === editingId;

          return (
            <div
              key={el.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
                setEditingId(el.id);
              }}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                color: el.color || (el.type === "title" ? theme.titleColor : theme.textColor),
                backgroundColor: el.bg || (el.type === "shape" ? theme.accentColor : "transparent"),
                textAlign: el.align || "left",
                fontWeight: el.fontWeight || (el.type === "title" ? "bold" : "normal"),
                fontStyle: el.fontStyle || "normal",
                textDecoration: el.underline ? "underline" : "none",
                fontSize: `${el.fontSize || (el.type === "title" ? 36 : 18)}px`,
              }}
              className={`absolute flex flex-col justify-center p-2 rounded-xs cursor-move transition-shadow ${
                isSelected
                  ? "outline-2 outline-dashed outline-[#c43e1c] ring-1 ring-white/50"
                  : "hover:outline-1 hover:outline-dashed hover:outline-gray-400"
              }`}
            >
              {/* Modo de edición de texto */}
              {isEditing ? (
                <textarea
                  value={el.content}
                  onChange={(e) => onUpdateElement(el.id, { content: e.target.value })}
                  onBlur={() => setEditingId(null)}
                  autoFocus
                  className="w-full h-full bg-transparent text-inherit font-inherit resize-none focus:outline-none border-none p-0 select-text"
                  style={{ textAlign: el.align || "left" }}
                />
              ) : (
                <div
                  className="w-full h-full whitespace-pre-wrap leading-snug break-words overflow-hidden pointer-events-none"
                  style={{ textAlign: el.align || "left" }}
                >
                  {el.content || (
                    <span className="opacity-40 italic">Haga doble clic para editar...</span>
                  )}
                </div>
              )}

              {/* Tiradores visuales de PowerPoint en las esquinas cuando está seleccionado */}
              {isSelected && !isEditing && (
                <>
                  <div className="element-handle -top-1 -left-1" />
                  <div className="element-handle -top-1 -right-1" />
                  <div className="element-handle -bottom-1 -left-1" />
                  <div className="element-handle -bottom-1 -right-1" />
                </>
              )}
            </div>
          );
        })}

        {/* Indicador de número de diapositiva en la esquina inferior */}
        <div
          style={{ color: theme.textColor }}
          className="absolute bottom-2 right-4 font-mono text-[10px] opacity-40 select-none pointer-events-none"
        >
          {slide.slideNumber}
        </div>
      </div>
    </div>
  );
};
