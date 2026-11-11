// Lienzo de edición de la diapositiva: seleccionar, mover, redimensionar y
// editar el texto de los elementos, con guías de alineación al centro.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus, X, EyeOff } from "lucide-react";
import type { AspectRatio, Slide, SlideElement, SlideTheme } from "../types";
import { SLIDE_SIZE } from "../types";
import { ElementView, SlideView } from "./SlideView";

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  aspectRatio: AspectRatio;
  /** Porcentaje de zoom, o "fit" para ajustar la diapositiva al espacio disponible. */
  zoom: number | "fit";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  editingId: string | null;
  onSetEditing: (id: string | null) => void;
  /** `coalesceKey` agrupa los cambios continuos (arrastres) en un solo paso de deshacer. */
  onUpdateElement: (id: string, changes: Partial<SlideElement>, coalesceKey?: string) => void;
  showGrid: boolean;
  onAddSlide: () => void;
  onInitPlaceholders: () => void;
  onContextMenu: (x: number, y: number) => void;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: Array<{ id: Handle; style: React.CSSProperties; cursor: string }> = [
  { id: "nw", style: { left: -5, top: -5 }, cursor: "nwse-resize" },
  { id: "n", style: { left: "calc(50% - 5px)", top: -5 }, cursor: "ns-resize" },
  { id: "ne", style: { right: -5, top: -5 }, cursor: "nesw-resize" },
  { id: "e", style: { right: -5, top: "calc(50% - 5px)" }, cursor: "ew-resize" },
  { id: "se", style: { right: -5, bottom: -5 }, cursor: "nwse-resize" },
  { id: "s", style: { left: "calc(50% - 5px)", bottom: -5 }, cursor: "ns-resize" },
  { id: "sw", style: { left: -5, bottom: -5 }, cursor: "nesw-resize" },
  { id: "w", style: { left: -5, top: "calc(50% - 5px)" }, cursor: "ew-resize" },
];

interface DragState {
  id: string;
  handle: Handle | "move";
  startX: number;
  startY: number;
  origin: { x: number; y: number; width: number; height: number };
  moved: boolean;
  wasSelected: boolean;
}

const SNAP = 0.8;

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  theme,
  aspectRatio,
  zoom,
  selectedId,
  onSelect,
  editingId,
  onSetEditing,
  onUpdateElement,
  showGrid,
  onAddSlide,
  onInitPlaceholders,
  onContextMenu,
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [available, setAvailable] = useState({ width: 900, height: 520 });
  const [guides, setGuides] = useState<{ vertical: boolean; horizontal: boolean }>({ vertical: false, horizontal: false });
  const [showPill, setShowPill] = useState(true);

  const size = SLIDE_SIZE[aspectRatio];

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setAvailable({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitWidth = Math.max(240, Math.min(available.width - 72, (available.height - 110) * (size.width / size.height)));
  const width = zoom === "fit" ? fitWidth : (size.width * zoom) / 100;
  const scale = width / size.width;

  // Arrastre para mover y redimensionar
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ((e.clientX - drag.startX) / (size.width * scale)) * 100;
      const dy = ((e.clientY - drag.startY) / (size.height * scale)) * 100;
      if (!drag.moved && Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 4) return;
      drag.moved = true;

      const o = drag.origin;
      let { x, y, width: w, height: h } = o;
      const round = (value: number) => Math.round(value * 100) / 100;

      if (drag.handle === "move") {
        x = o.x + dx;
        y = o.y + dy;
        // Ajuste magnético al centro y a los bordes de la diapositiva
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const snapVertical = Math.abs(centerX - 50) < SNAP;
        const snapHorizontal = Math.abs(centerY - 50) < SNAP;
        if (snapVertical) x = 50 - w / 2;
        else if (Math.abs(x) < SNAP) x = 0;
        else if (Math.abs(x + w - 100) < SNAP) x = 100 - w;
        if (snapHorizontal) y = 50 - h / 2;
        else if (Math.abs(y) < SNAP) y = 0;
        else if (Math.abs(y + h - 100) < SNAP) y = 100 - h;
        setGuides({ vertical: snapVertical, horizontal: snapHorizontal });
      } else {
        const minimum = 1.5;
        if (drag.handle.includes("e")) w = Math.max(minimum, o.width + dx);
        if (drag.handle.includes("s")) h = Math.max(minimum, o.height + dy);
        if (drag.handle.includes("w")) {
          w = Math.max(minimum, o.width - dx);
          x = o.x + o.width - w;
        }
        if (drag.handle.includes("n")) {
          h = Math.max(minimum, o.height - dy);
          y = o.y + o.height - h;
        }
        // Con Mayús se conserva la proporción al tirar de una esquina
        if (e.shiftKey && drag.handle.length === 2 && o.height > 0) {
          const ratio = (o.width * size.width) / (o.height * size.height);
          const adjusted = ((w * size.width) / ratio / size.height);
          if (drag.handle.includes("n")) y = o.y + o.height - adjusted;
          h = adjusted;
        }
      }
      onUpdateElement(
        drag.id,
        { x: round(x), y: round(y), width: round(w), height: round(h) },
        `drag-${drag.id}-${drag.handle}`
      );
    };

    const handleUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setGuides({ vertical: false, horizontal: false });
      if (!drag || drag.moved || drag.handle !== "move") return;
      // Un clic sobre un elemento ya seleccionado entra a editar su texto
      const element = slide.elements.find((el) => el.id === drag.id);
      if (drag.wasSelected && element && ["title", "subtitle", "text", "shape"].includes(element.type)) {
        onSetEditing(drag.id);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  });

  const beginDrag = (e: React.MouseEvent, element: SlideElement, handle: Handle | "move") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingId && editingId !== element.id) onSetEditing(null);
    dragRef.current = {
      id: element.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: element.x, y: element.y, width: element.width, height: element.height },
      moved: false,
      wasSelected: selectedId === element.id,
    };
    onSelect(element.id);
  };

  const renderElement = (element: SlideElement) => {
    const selected = element.id === selectedId;
    const editing = element.id === editingId;
    return (
      <div
        key={element.id}
        data-element-id={element.id}
        className={`absolute ${editing ? "cursor-text" : "cursor-move"} ${
          selected ? "" : "hover:outline hover:outline-1 hover:outline-dashed hover:outline-[#9aa0a6]"
        }`}
        style={{
          left: `${element.x}%`,
          top: `${element.y}%`,
          width: `${element.width}%`,
          height: `${element.height}%`,
          outline: selected ? `${Math.max(1.5, 2 / scale)}px solid #1a73e8` : undefined,
          zIndex: selected ? 5 : undefined,
        }}
        onMouseDown={(e) => {
          if (!editing) beginDrag(e, element, "move");
          else e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (element.type !== "image" && element.type !== "video" && element.type !== "line") {
            onSelect(element.id);
            onSetEditing(element.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(element.id);
          onContextMenu(e.clientX, e.clientY);
        }}
      >
        <ElementView
          element={element}
          theme={theme}
          showPlaceholders
          editing={editing}
          onChangeContent={(content) => onUpdateElement(element.id, { content }, `text-${element.id}`)}
          onChangeCell={(row, col, value) => {
            const rows = (element.rows || []).map((line) => [...line]);
            if (rows[row]) rows[row][col] = value;
            onUpdateElement(element.id, { rows }, `cell-${element.id}-${row}-${col}`);
          }}
          onFinishEditing={() => onSetEditing(null)}
        />

        {selected && !editing &&
          HANDLES.map((handle) => (
            <div
              key={handle.id}
              className="absolute bg-white border border-[#1a73e8] rounded-[1px] z-10"
              style={{
                ...handle.style,
                width: 10,
                height: 10,
                cursor: handle.cursor,
                transform: `scale(${1 / scale})`,
              }}
              onMouseDown={(e) => beginDrag(e, element, handle.id)}
            />
          ))}
      </div>
    );
  };

  // Marcas de la regla (la diapositiva equivale a 25,4 cm de ancho)
  const horizontalMarks = Array.from({ length: 26 }, (_, i) => i);
  const verticalMarks = Array.from({ length: Math.round((25.4 * size.height) / size.width) + 1 }, (_, i) => i);
  const centimeter = width / 25.4;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#f8fafd]">
      <div
        ref={areaRef}
        className="flex-1 overflow-auto select-none relative"
        onMouseDown={() => {
          onSelect(null);
          onSetEditing(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY);
        }}
      >
        <div className="min-w-fit min-h-full flex flex-col items-center justify-center py-6 px-9">
          <div className="relative">
            {/* Reglas horizontal y vertical alineadas con la diapositiva */}
            <div className="absolute -top-5 left-0 h-4 text-[8px] font-mono text-[#747775] pointer-events-none" style={{ width }}>
              {horizontalMarks.map((cm) => (
                <div key={cm} className="absolute bottom-0 flex flex-col items-center -translate-x-1/2" style={{ left: cm * centimeter }}>
                  <span className="leading-none">{cm % 2 === 0 && cm > 0 ? cm : ""}</span>
                  <div className={`w-px bg-[#bdc1c6] ${cm % 2 === 0 ? "h-1.5" : "h-1"}`} />
                </div>
              ))}
            </div>
            <div className="absolute top-0 -left-5 w-4 text-[8px] font-mono text-[#747775] pointer-events-none" style={{ height: size.height * scale }}>
              {verticalMarks.map((cm) => (
                <div key={cm} className="absolute right-0 flex items-center gap-0.5 -translate-y-1/2" style={{ top: cm * centimeter }}>
                  <span className="leading-none">{cm % 2 === 0 && cm > 0 ? cm : ""}</span>
                  <div className={`h-px bg-[#bdc1c6] ${cm % 2 === 0 ? "w-1.5" : "w-1"}`} />
                </div>
              ))}
            </div>

            <SlideView
              slide={slide}
              theme={theme}
              aspectRatio={aspectRatio}
              width={width}
              showPlaceholders
              renderElement={renderElement}
              className="shadow-[0_2px_6px_rgba(60,64,67,0.15),0_8px_24px_rgba(60,64,67,0.12)] border border-[#dadce0] !overflow-visible"
            >
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px)",
                    backgroundSize: "48px 48px",
                  }}
                />
              )}
              {guides.vertical && <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#ea4335] pointer-events-none z-20" />}
              {guides.horizontal && <div className="absolute left-0 right-0 top-1/2 h-px bg-[#ea4335] pointer-events-none z-20" />}

              {slide.hidden && (
                <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded bg-black/60 text-white text-[11px] font-mono flex items-center gap-1.5 pointer-events-none">
                  <EyeOff size={12} />
                  <span>Oculta en la presentación</span>
                </div>
              )}

              {slide.elements.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={onInitPlaceholders}
                    className="border border-dashed border-[#bdc1c6] hover:border-[#1a73e8] hover:bg-[#e8f0fe]/40 px-10 py-5 rounded text-2xl font-bold text-[#9aa0a6] hover:text-[#1a73e8] transition-colors"
                  >
                    Haz clic para agregar un título
                  </button>
                  <span className="text-sm text-[#9aa0a6]">
                    o inserta texto, imágenes, formas y tablas desde la barra de herramientas
                  </span>
                </div>
              )}
            </SlideView>
          </div>

          {showPill && (
            <div
              className="mt-5 flex items-center gap-2 bg-[#edf2fa] hover:bg-[#e2e8f0] text-xs font-medium px-4 py-1.5 rounded-full border border-gray-200/60 transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={onAddSlide} className="flex items-center gap-1.5 text-[#1a73e8] hover:text-[#1557b0]">
                <Plus size={15} />
                <span>Crear una diapositiva</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPill(false)}
                className="ml-1 p-0.5 hover:bg-gray-300/60 rounded-full text-gray-500"
                title="Ocultar este botón"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
