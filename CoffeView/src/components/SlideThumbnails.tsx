import React from "react";
import { Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Slide, SlideTheme } from "../types";

interface SlideThumbnailsProps {
  slides: Slide[];
  activeSlideId: string;
  onSelectSlide: (id: string) => void;
  onAddSlide?: () => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlide: (index: number, direction: "up" | "down") => void;
  currentTheme: SlideTheme;
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  activeSlideId,
  onSelectSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  currentTheme,
}) => {
  return (
    <aside className="w-56 bg-white border-r border-[#e1dfdd] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Lista scrollable de miniaturas con numeración como en Google Slides */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;

          return (
            <div key={slide.id} className="flex items-start gap-2 group">
              {/* Número de diapositiva (1, 2, 3...) */}
              <span className="font-sans text-xs text-[#444746] font-medium w-4 pt-1 text-right shrink-0">
                {index + 1}
              </span>

              {/* Contenedor de la miniatura 16:9 */}
              <div
                onClick={() => onSelectSlide(slide.id)}
                className={`flex-1 aspect-video rounded-sm border-2 transition-all cursor-pointer relative overflow-hidden shadow-xs ${
                  isActive
                    ? "border-[#1a73e8] ring-1 ring-[#1a73e8]"
                    : "border-gray-300 hover:border-gray-400 bg-white"
                }`}
                style={{ backgroundColor: slide.background || currentTheme.slideBg }}
              >
                {/* Renderizado simplificado de elementos en la miniatura */}
                <div className="w-full h-full p-2 relative pointer-events-none">
                  {slide.elements.slice(0, 3).map((el) => {
                    if (el.type === "title") {
                      return (
                        <div
                          key={el.id}
                          className="font-bold truncate text-[8px] leading-tight"
                          style={{ color: el.color || currentTheme.titleColor }}
                        >
                          {el.content || "Haz clic para agregar un título"}
                        </div>
                      );
                    }
                    if (el.type === "subtitle" || el.type === "text") {
                      return (
                        <div
                          key={el.id}
                          className="truncate text-[6px] opacity-75 mt-0.5 leading-none"
                          style={{ color: el.color || currentTheme.textColor }}
                        >
                          {el.content.split("\n")[0] || "Haz clic para agregar un subtítulo"}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>

                {/* Acciones flotantes al pasar el cursor */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-black/60 backdrop-blur-xs p-0.5 rounded text-white">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveSlide(index, "up");
                      }}
                      title="Subir"
                      className="p-0.5 hover:bg-white/20 rounded"
                    >
                      <ArrowUp size={10} />
                    </button>
                  )}
                  {index < slides.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveSlide(index, "down");
                      }}
                      title="Bajar"
                      className="p-0.5 hover:bg-white/20 rounded"
                    >
                      <ArrowDown size={10} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateSlide(slide.id);
                    }}
                    title="Duplicar"
                    className="p-0.5 hover:bg-white/20 rounded"
                  >
                    <Copy size={10} />
                  </button>
                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSlide(slide.id);
                      }}
                      title="Eliminar"
                      className="p-0.5 hover:bg-red-500/80 rounded"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
