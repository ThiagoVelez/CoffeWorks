import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import type { Slide, SlideTheme } from "../types";

interface PresentationModeProps {
  slides: Slide[];
  initialSlideIndex?: number;
  theme: SlideTheme;
  onExit: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  slides,
  initialSlideIndex = 0,
  theme,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const currentSlide = slides[currentIndex] || slides[0];

  // Temporizador de presentación transcurrido
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Controles de teclado en modo presentación
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter" || e.key === "PageDown") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, slides.length]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center select-none overflow-hidden cursor-default">
      {/* Contenedor de la diapositiva proyectada en 16:9 con transicion SMIL activa */}
      <div
        key={`${currentSlide.id}_${currentIndex}`}
        style={{ backgroundColor: currentSlide.background || theme.slideBg }}
        className={`w-[96vw] max-w-[177.77vh] aspect-video relative rounded shadow-2xl overflow-hidden ${
          currentSlide.transition === "fade"
            ? "transition-slide-fade"
            : currentSlide.transition === "push"
            ? "transition-slide-push"
            : currentSlide.transition === "wipe"
            ? "transition-slide-wipe"
            : currentSlide.transition === "zoom"
            ? "transition-slide-zoom"
            : ""
        }`}
      >
        {currentSlide.elements.map((el) => (
          <div
            key={el.id}
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
              fontSize: `${(el.fontSize || (el.type === "title" ? 36 : 18)) * 1.5}px`,
            }}
            className="absolute flex flex-col justify-center p-4 break-words leading-snug"
          >
            <div
              className="w-full h-full whitespace-pre-wrap"
              style={{ textAlign: el.align || "left" }}
            >
              {el.content}
            </div>
          </div>
        ))}
      </div>

      {/* Barra de control flotante inferior */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/80 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 shadow-2xl flex items-center gap-4 text-xs font-mono">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          title="Anterior (Flecha izquierda)"
          className="p-1.5 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="font-bold">
          {currentIndex + 1} / {slides.length}
        </span>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === slides.length - 1}
          title="Siguiente (Espacio / Flecha derecha)"
          className="p-1.5 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} />
        </button>

        <div className="h-4 w-px bg-white/20" />

        {/* Cronómetro en vivo */}
        <div className="flex items-center gap-1.5 text-white/80">
          <Clock size={13} />
          <span>{formatTime(secondsElapsed)}</span>
        </div>

        <div className="h-4 w-px bg-white/20" />

        {/* Salir */}
        <button
          type="button"
          onClick={onExit}
          title="Salir de la presentación (Escape)"
          className="p-1.5 hover:bg-red-600 rounded-full transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
