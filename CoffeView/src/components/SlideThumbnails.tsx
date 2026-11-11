import React, { useState } from "react";
import { Copy, Trash2, EyeOff, Eye, Plus } from "lucide-react";
import type { AspectRatio, Slide, SlideTheme } from "../types";
import { SlideView } from "./SlideView";

interface SlideThumbnailsProps {
  slides: Slide[];
  activeSlideId: string;
  theme: SlideTheme;
  aspectRatio: AspectRatio;
  /** Tira lateral o cuadrícula con todas las diapositivas. */
  mode: "strip" | "grid";
  onSelectSlide: (id: string) => void;
  onOpenSlide?: (id: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onToggleHidden: (id: string) => void;
  /** Mueve una diapositiva a la posición indicada (arrastrar y soltar). */
  onReorder: (id: string, toIndex: number) => void;
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  activeSlideId,
  theme,
  aspectRatio,
  mode,
  onSelectSlide,
  onOpenSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onToggleHidden,
  onReorder,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const grid = mode === "grid";
  const thumbWidth = grid ? 232 : 168;

  const finishDrag = () => {
    if (dragId !== null && dropIndex !== null) onReorder(dragId, dropIndex);
    setDragId(null);
    setDropIndex(null);
  };

  const items = slides.map((slide, index) => {
    const isActive = slide.id === activeSlideId;
    return (
      <div
        key={slide.id}
        draggable
        onDragStart={(e) => {
          setDragId(slide.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", slide.id);
        }}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const after = grid ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
          setDropIndex(index + (after ? 1 : 0));
        }}
        onDrop={(e) => {
          e.preventDefault();
          finishDrag();
        }}
        onDragEnd={finishDrag}
        className={`flex items-start gap-2 group relative ${dragId === slide.id ? "opacity-40" : ""}`}
      >
        {dropIndex === index && dragId && dragId !== slide.id && (
          <div className={`absolute bg-[#1a73e8] rounded-full z-10 ${grid ? "-left-2 top-0 bottom-0 w-0.5" : "left-6 right-0 -top-1.5 h-0.5"}`} />
        )}
        {dropIndex === index + 1 && index === slides.length - 1 && dragId && (
          <div className={`absolute bg-[#1a73e8] rounded-full z-10 ${grid ? "-right-2 top-0 bottom-0 w-0.5" : "left-6 right-0 -bottom-1.5 h-0.5"}`} />
        )}

        <span className="font-sans text-xs text-[#444746] font-medium w-4 pt-1 text-right shrink-0">{index + 1}</span>

        <div
          onClick={() => onSelectSlide(slide.id)}
          onDoubleClick={() => onOpenSlide?.(slide.id)}
          title={grid ? "Doble clic para editar esta diapositiva" : undefined}
          className={`rounded-sm border-2 transition-all cursor-pointer relative overflow-hidden ${
            isActive ? "border-[#1a73e8] ring-1 ring-[#1a73e8]" : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <SlideView slide={slide} theme={theme} aspectRatio={aspectRatio} width={thumbWidth} className={slide.hidden ? "opacity-40" : ""} />
          {slide.hidden && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <EyeOff size={22} className="text-[#444746]" />
            </div>
          )}

          <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {[
              { title: slide.hidden ? "Mostrar en la presentación" : "Ocultar en la presentación", Icon: slide.hidden ? Eye : EyeOff, action: () => onToggleHidden(slide.id) },
              { title: "Duplicar diapositiva", Icon: Copy, action: () => onDuplicateSlide(slide.id) },
              { title: "Eliminar diapositiva", Icon: Trash2, action: () => onDeleteSlide(slide.id), disabled: slides.length <= 1 },
            ].map(({ title, Icon, action, disabled }) => (
              <button
                key={title}
                type="button"
                title={title}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  action();
                }}
                className="p-1 rounded bg-white/95 border border-gray-300 text-[#444746] hover:bg-[#e8f0fe] hover:text-[#0b57d0] disabled:opacity-40 shadow-sm"
              >
                <Icon size={11} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  });

  if (grid) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f8fafd] p-6 select-none print:hidden">
        <div className="flex flex-wrap gap-x-5 gap-y-6">
          {items}
          <button
            type="button"
            onClick={onAddSlide}
            style={{ width: thumbWidth + 24 }}
            className="ml-6 aspect-video rounded-sm border-2 border-dashed border-gray-300 hover:border-[#1a73e8] text-[#747775] hover:text-[#1a73e8] flex flex-col items-center justify-center gap-1 text-xs transition-colors"
          >
            <Plus size={20} />
            Nueva diapositiva
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-56 bg-white border-r border-[#e1dfdd] flex flex-col shrink-0 select-none overflow-hidden print:hidden">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">{items}</div>
    </aside>
  );
};
