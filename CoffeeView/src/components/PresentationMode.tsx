import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Clock, StickyNote } from "lucide-react";
import type { AspectRatio, Slide, SlideTheme } from "../types";
import { SLIDE_SIZE } from "../types";
import { SlideView } from "./SlideView";
import { appWindow } from "../services/desktop";

interface PresentationModeProps {
  slides: Slide[];
  startSlideId: string;
  theme: SlideTheme;
  aspectRatio: AspectRatio;
  /** Avanzar solo con los intervalos ensayados de cada diapositiva. */
  autoAdvance: boolean;
  onExit: (lastSlideId: string) => void;
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

/** Proyección a pantalla completa con transiciones, notas y temporizador. */
export const PresentationMode: React.FC<PresentationModeProps> = ({
  slides,
  startSlideId,
  theme,
  aspectRatio,
  autoAdvance,
  onExit,
}) => {
  // Las diapositivas ocultas no se proyectan
  const visible = useMemo(() => {
    const shown = slides.filter((slide) => !slide.hidden);
    return shown.length > 0 ? shown : slides;
  }, [slides]);

  const [index, setIndex] = useState(() => {
    const start = visible.findIndex((slide) => slide.id === startSlideId);
    if (start >= 0) return start;
    // Si se empezó desde una diapositiva oculta, se usa la siguiente visible
    const original = slides.findIndex((slide) => slide.id === startSlideId);
    const next = visible.findIndex((slide) => slides.indexOf(slide) > original);
    return Math.max(0, next);
  });
  const [finished, setFinished] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [controlsVisible, setControlsVisible] = useState(true);

  const current = visible[Math.min(index, visible.length - 1)];
  const size = SLIDE_SIZE[aspectRatio];

  const exit = useCallback(() => onExit(current.id), [current.id, onExit]);

  const next = useCallback(() => {
    if (finished) {
      exit();
    } else if (index >= visible.length - 1) {
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  }, [exit, finished, index, visible.length]);

  const previous = useCallback(() => {
    if (finished) setFinished(false);
    else setIndex(Math.max(0, index - 1));
  }, [finished, index]);

  useEffect(() => {
    void appWindow.setFullscreen(true);
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearInterval(timer);
      void appWindow.setFullscreen(false);
    };
  }, []);

  // Avance automático con los intervalos ensayados
  useEffect(() => {
    if (!autoAdvance || finished || blackout || !current.duration) return;
    const timer = window.setTimeout(next, current.duration * 1000);
    return () => window.clearTimeout(timer);
  }, [autoAdvance, blackout, current, finished, next]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          exit();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "Enter":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          previous();
          break;
        case "Home":
          setFinished(false);
          setIndex(0);
          break;
        case "End":
          setFinished(false);
          setIndex(visible.length - 1);
          break;
        case "b":
        case "B":
        case ".":
          setBlackout((value) => !value);
          break;
        case "n":
        case "N":
          setShowNotes((value) => !value);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [exit, next, previous, visible.length]);

  // Los controles se ocultan tras unos segundos sin mover el ratón
  useEffect(() => {
    if (!controlsVisible) return;
    const timer = window.setTimeout(() => setControlsVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [controlsVisible, index]);

  const notesHeight = showNotes ? 150 : 0;
  const width = Math.min(viewport.width, (viewport.height - notesHeight) * (size.width / size.height));

  return (
    <div
      className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center select-none print:hidden"
      style={{ cursor: controlsVisible ? "default" : "none" }}
      onMouseMove={() => setControlsVisible(true)}
    >
      <div className="flex-1 flex items-center justify-center w-full min-h-0" onClick={next}>
        {blackout ? null : finished ? (
          <div className="text-center text-white/80">
            <p className="text-2xl font-semibold">Fin de la presentación</p>
            <p className="text-sm mt-2 text-white/50">Haz clic o pulsa Esc para salir</p>
          </div>
        ) : (
          <div key={current.id} className={`slide-transition-${current.transition}`}>
            <SlideView slide={current} theme={theme} aspectRatio={aspectRatio} width={width} interactive />
          </div>
        )}
      </div>

      {showNotes && (
        <div className="w-full bg-[#1f1f1f] text-white/90 px-8 py-4 text-sm leading-relaxed overflow-y-auto whitespace-pre-wrap" style={{ height: notesHeight }}>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Notas del orador</div>
          {current.notes || <span className="text-white/40">Esta diapositiva no tiene notas.</span>}
        </div>
      )}

      <div
        className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#202124]/90 text-white rounded-full px-2 py-1 text-xs shadow-xl transition-opacity ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ bottom: notesHeight + 16 }}
      >
        <button type="button" onClick={previous} title="Anterior (←)" className="p-1.5 rounded-full hover:bg-white/15">
          <ChevronLeft size={16} />
        </button>
        <span className="font-mono px-1 min-w-[52px] text-center">
          {finished ? visible.length : index + 1} / {visible.length}
        </span>
        <button type="button" onClick={next} title="Siguiente (→)" className="p-1.5 rounded-full hover:bg-white/15">
          <ChevronRight size={16} />
        </button>
        <span className="w-px h-4 bg-white/20 mx-1" />
        <span className="flex items-center gap-1 font-mono px-1" title="Tiempo transcurrido">
          <Clock size={13} /> {formatTime(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => setShowNotes((value) => !value)}
          title="Notas del orador (N)"
          className={`p-1.5 rounded-full hover:bg-white/15 ${showNotes ? "bg-white/20" : ""}`}
        >
          <StickyNote size={15} />
        </button>
        <button type="button" onClick={exit} title="Salir (Esc)" className="p-1.5 rounded-full hover:bg-white/15">
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
