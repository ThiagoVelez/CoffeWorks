import React, { useRef, useState } from "react";
import {
  Plus,
  X,
  Presentation,
  Image as ImageIcon,
  Film,
  Upload,
  Video,
  Sparkles,
} from "lucide-react";
import type { Slide, SlideElement, SlideTheme } from "../types";

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<SlideElement>) => void;
  aspectRatio?: "16:9" | "4:3";
  showGridlines?: boolean;
  onAddSlide?: () => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  theme,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  aspectRatio = "16:9",
  showGridlines = false,
  onAddSlide,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPill, setShowPill] = useState(true);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectElement(null);
      setEditingId(null);
    }
  };

  const isWide = aspectRatio === "16:9";

  // Marcas de centímetros para la regla horizontal (1 a 25 cm)
  const hMarks = Array.from({ length: 26 }, (_, i) => i + 1);
  // Marcas de centímetros para la regla vertical (1 a 14 cm)
  const vMarks = Array.from({ length: 14 }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f0f4f9] relative">
      {/* Regla Vertical a la izquierda */}
      <div className="w-5 bg-white border-r border-[#e1dfdd] select-none flex flex-col justify-around py-8 items-end pr-1 text-[8px] text-[#747775] font-mono">
        {vMarks.map((m) => (
          <div key={m} className="flex items-center gap-0.5">
            <span>{m % 2 === 0 ? m : ""}</span>
            <div className={`h-px bg-gray-300 ${m % 2 === 0 ? "w-2" : "w-1"}`} />
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Regla Horizontal superior */}
        <div className="h-5 bg-white border-b border-[#e1dfdd] select-none flex justify-around px-12 items-end pb-0.5 text-[8px] text-[#747775] font-mono">
          {hMarks.map((m) => (
            <div key={m} className="flex flex-col items-center">
              <span>{m % 2 === 0 ? m : ""}</span>
              <div className={`w-px bg-gray-300 ${m % 2 === 0 ? "h-2" : "h-1"}`} />
            </div>
          ))}
        </div>

        {/* Área del lienzo central */}
        <div
          className="flex-1 overflow-auto flex flex-col items-center justify-center p-8 select-none relative"
          onClick={handleCanvasClick}
        >
          {/* Contenedor principal de la Diapositiva 16:9 de Google Slides */}
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              backgroundColor: slide.background || theme.slideBg,
              backgroundImage: showGridlines
                ? "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)"
                : undefined,
              backgroundSize: showGridlines ? "24px 24px" : undefined,
            }}
            className={`${
              isWide ? "w-[960px] h-[540px] aspect-video" : "w-[720px] h-[540px] aspect-[4/3]"
            } max-w-full rounded-xs relative shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] border border-gray-200/60 overflow-hidden transition-all shrink-0 bg-white`}
          >
            {/* Banner de diapositiva oculta */}
            {slide.hidden && (
              <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tracking-wider">
                Oculta de la proyección
              </div>
            )}

            {/* Elementos dentro de la Diapositiva */}
            {slide.elements.length === 0 ? (
              /* Plantilla por defecto con los textos exactos de Google Slides */
              <div className="w-full h-full flex flex-col items-center justify-center p-12 gap-6 pointer-events-none">
                <div className="border border-dashed border-gray-300 hover:border-[#1a73e8] p-6 w-full max-w-2xl text-center rounded">
                  <h1 className="text-4xl font-bold text-[#1f1f1f] tracking-tight">
                    Haz clic para agregar un título
                  </h1>
                </div>
                <div className="border border-dashed border-gray-300 hover:border-[#1a73e8] p-4 w-full max-w-xl text-center rounded">
                  <p className="text-lg text-[#444746] font-normal">
                    Haz clic para agregar un subtítulo
                  </p>
                </div>
              </div>
            ) : (
              slide.elements.map((el) => {
                const isSelected = el.id === selectedElementId;
                const isEditing = el.id === editingId;

                const defaultPlaceholder =
                  el.type === "title"
                    ? "Haz clic para agregar un título"
                    : el.type === "subtitle"
                    ? "Haz clic para agregar un subtítulo"
                    : "Haz clic para escribir texto...";

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
                      textAlign: el.align || "center",
                      fontWeight: el.fontWeight || (el.type === "title" ? "bold" : "normal"),
                      fontStyle: el.fontStyle || "normal",
                      textDecoration: el.underline ? "underline" : "none",
                      fontSize: `${el.fontSize || (el.type === "title" ? 42 : 20)}px`,
                      fontFamily: el.fontFamily || "Arial, sans-serif",
                      borderRadius:
                        el.shapeType === "circle"
                          ? "50%"
                          : el.shapeType === "rounded"
                          ? "16px"
                          : undefined,
                    }}
                    className={`absolute flex flex-col justify-center p-3 rounded-xs cursor-move transition-shadow ${
                      isSelected
                        ? "outline-2 outline-solid outline-[#1a73e8] ring-1 ring-white/50"
                        : "hover:outline-1 hover:outline-dashed hover:outline-gray-300"
                    }`}
                  >
                    {el.type === "image" ? (
                      <div className="w-full h-full flex items-center justify-center overflow-hidden rounded">
                        {el.content && (el.content.startsWith("http") || el.content.startsWith("data:")) ? (
                          <img
                            src={el.content}
                            alt="Diapositiva"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center p-2 text-gray-500 bg-gray-50">
                            <span className="text-xs font-semibold">{el.content || "Imagen"}</span>
                          </div>
                        )}
                      </div>
                    ) : isEditing ? (
                      <textarea
                        value={el.content}
                        onChange={(e) => onUpdateElement(el.id, { content: e.target.value })}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                        className="w-full h-full bg-transparent text-inherit font-inherit resize-none focus:outline-none border-none p-0 select-text"
                        style={{ textAlign: el.align || "center" }}
                      />
                    ) : (
                      <div
                        className="w-full h-full whitespace-pre-wrap leading-tight break-words overflow-hidden pointer-events-none flex items-center justify-center"
                        style={{ textAlign: el.align || "center" }}
                      >
                        {el.content || (
                          <span className="text-gray-400 font-normal">{defaultPlaceholder}</span>
                        )}
                      </div>
                    )}

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
              })
            )}

            <div
              style={{ color: theme.textColor }}
              className="absolute bottom-2 right-4 font-mono text-[10px] opacity-40 select-none pointer-events-none"
            >
              {slide.slideNumber}
            </div>
          </div>

          {/* Botón flotante inferior verbatim de Google Slides: '+ Crear una diapositiva' */}
          {showPill && (
            <div className="mt-4 flex items-center gap-1.5 bg-[#edf2fa] hover:bg-[#e1dfdd] text-[#1f1f1f] text-xs font-medium px-4 py-1.5 rounded-full shadow-xs border border-gray-200/60 transition-colors z-20">
              <button
                type="button"
                onClick={() => onAddSlide?.()}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} className="text-[#1a73e8]" />
                <span>Crear una diapositiva</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPill(false)}
                className="ml-2 p-0.5 hover:bg-gray-300/60 rounded-full text-gray-500"
                title="Cerrar sugerencia"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Riel de acciones vertical lateral derecho de Google Slides */}
      <aside className="w-20 bg-white border-l border-[#e1dfdd] flex flex-col items-center py-4 gap-5 select-none shrink-0 text-[#444746]">
        {[
          { label: "Diapositiva", icon: Presentation },
          { label: "Imagen", icon: ImageIcon },
          { label: "Contenido multimedia", icon: Film },
          { label: "Cargas", icon: Upload },
          { label: "Grabar", icon: Video },
          { label: "Transformar", icon: Sparkles },
        ].map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              type="button"
              className="flex flex-col items-center gap-1 hover:text-[#1a73e8] transition-colors group cursor-pointer w-full px-1"
              title={action.label}
            >
              <div className="p-2 rounded-full group-hover:bg-[#f0f4f9] transition-colors">
                <Icon size={18} />
              </div>
              <span className="text-[10px] text-center leading-tight line-clamp-2 text-[#444746] group-hover:text-[#1a73e8]">
                {action.label}
              </span>
            </button>
          );
        })}
      </aside>
    </div>
  );
};
