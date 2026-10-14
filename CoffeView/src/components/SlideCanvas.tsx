import React, { useRef, useState } from "react";
import type { Slide, SlideElement, SlideTheme } from "../types";

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  aspectRatio?: "16:9" | "4:3";
  showGridlines?: boolean;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  theme,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  aspectRatio = "16:9",
  showGridlines = false,
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

  const isWide = aspectRatio === "16:9";

  return (
    <div
      className="flex-1 bg-[#4a4744] overflow-auto flex items-center justify-center p-8 select-none relative"
      onClick={handleCanvasClick}
    >
      {/* Contenedor principal de la Diapositiva 16:9 o 4:3 */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          backgroundColor: slide.background || theme.slideBg,
          backgroundImage: showGridlines
            ? "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)"
            : undefined,
          backgroundSize: showGridlines ? "24px 24px" : undefined,
        }}
        className={`${
          isWide ? "w-[960px] h-[540px] aspect-video" : "w-[720px] h-[540px] aspect-[4/3]"
        } max-w-full rounded-sm relative slide-canvas-shadow overflow-hidden transition-all shrink-0`}
      >
        {/* Banner de diapositiva oculta */}
        {slide.hidden && (
          <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tracking-wider">
            Oculta de la proyección
          </div>
        )}

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
                fontFamily: el.fontFamily || undefined,
                borderRadius:
                  el.shapeType === "circle"
                    ? "50%"
                    : el.shapeType === "rounded"
                    ? "16px"
                    : el.shapeType === "callout"
                    ? "16px 16px 16px 0px"
                    : undefined,
                clipPath:
                  el.shapeType === "triangle"
                    ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                    : el.shapeType === "diamond"
                    ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
                    : el.shapeType === "arrow-right"
                    ? "polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%)"
                    : el.shapeType === "star"
                    ? "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"
                    : undefined,
              }}
              className={`absolute flex flex-col justify-center p-2 rounded-xs cursor-move transition-shadow ${
                isSelected
                  ? "outline-2 outline-dashed outline-[#c43e1c] ring-1 ring-white/50"
                  : "hover:outline-1 hover:outline-dashed hover:outline-gray-400"
              }`}
            >
              {/* Elemento de tipo Imagen */}
              {el.type === "image" ? (
                <div className="w-full h-full flex items-center justify-center overflow-hidden rounded">
                  {el.content && (el.content.startsWith("http") || el.content.startsWith("data:")) ? (
                    <img
                      src={el.content}
                      alt="Diapositiva"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-stone-400/50 rounded flex flex-col items-center justify-center p-2 text-stone-500 bg-stone-100/50">
                      <span className="text-xs font-semibold">{el.content || "Imagen"}</span>
                    </div>
                  )}
                </div>
              ) : el.type === "table" ? (
                /* Elemento de tipo Tabla */
                <div className="w-full h-full overflow-hidden flex flex-col">
                  {isEditing ? (
                    <textarea
                      value={el.content}
                      onChange={(e) => onUpdateElement(el.id, { content: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      className="w-full h-full bg-white/90 text-xs font-mono p-1 border rounded"
                      placeholder="Fila 1 Col 1, Fila 1 Col 2&#10;Fila 2 Col 1, Fila 2 Col 2"
                    />
                  ) : (
                    <table className="w-full h-full border-collapse text-xs select-none">
                      <tbody>
                        {el.content.split("\n").filter(Boolean).map((row, rIdx) => (
                          <tr key={`r_${rIdx}`} className={rIdx === 0 ? "font-bold bg-black/5" : ""}>
                            {row.split(",").map((cell, cIdx) => (
                              <td
                                key={`c_${cIdx}`}
                                className="border border-stone-300 p-1.5 text-center truncate"
                              >
                                {cell.trim()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : isEditing ? (
                /* Modo de edición de texto general */
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
