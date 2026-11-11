// Página del editor: el contenido del PDF (dibujado por pdf.js en un lienzo)
// y, encima, la capa de anotaciones donde se crean, seleccionan, mueven y
// redimensionan los elementos.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Annotation, PageItem, TextAnnotation, Tool, ToolStyle } from "../types";
import type { SourcePdf } from "../services/pdfEngine";
import { renderPage } from "../services/pdfEngine";
import {
  FONT_CSS,
  LINE_HEIGHT,
  TEXT_PADDING,
  boundsOf,
  displaySize,
  newId,
  translate,
  withBounds,
  type Bounds,
} from "../services/geometry";

interface PageViewProps {
  item: PageItem;
  pageNumber: number;
  sources: SourcePdf[];
  /** Píxeles CSS por punto PDF. */
  zoom: number;
  tool: Tool;
  style: ToolStyle;
  selectedId: string | null;
  editingId: string | null;
  isCurrent: boolean;
  searchBoxes: Bounds[];
  onSelect: (pageId: string, annotationId: string | null) => void;
  onSetEditing: (annotationId: string | null) => void;
  /** Sustituye las anotaciones de la página; `coalesceKey` agrupa arrastres en un paso de deshacer. */
  onChangeAnnotations: (pageId: string, update: (list: Annotation[]) => Annotation[], coalesceKey?: string) => void;
  onToolDone: () => void;
  registerElement: (pageId: string, element: HTMLDivElement | null) => void;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: Array<{ id: Handle; cursor: string; fx: number; fy: number }> = [
  { id: "nw", cursor: "nwse-resize", fx: 0, fy: 0 },
  { id: "n", cursor: "ns-resize", fx: 0.5, fy: 0 },
  { id: "ne", cursor: "nesw-resize", fx: 1, fy: 0 },
  { id: "e", cursor: "ew-resize", fx: 1, fy: 0.5 },
  { id: "se", cursor: "nwse-resize", fx: 1, fy: 1 },
  { id: "s", cursor: "ns-resize", fx: 0.5, fy: 1 },
  { id: "sw", cursor: "nesw-resize", fx: 0, fy: 1 },
  { id: "w", cursor: "ew-resize", fx: 0, fy: 0.5 },
];

type Draft =
  | { kind: "box"; tool: Tool; x0: number; y0: number; x1: number; y1: number }
  | { kind: "ink"; points: number[] };

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; original: Annotation; moved: boolean; wasSelected: boolean }
  | { kind: "resize"; id: string; handle: Handle; startX: number; startY: number; original: Annotation }
  | { kind: "endpoint"; id: string; end: 1 | 2; original: Annotation };

const textStyle = (annotation: TextAnnotation): React.CSSProperties => ({
  fontFamily: FONT_CSS[annotation.font],
  fontSize: annotation.fontSize,
  fontWeight: annotation.bold ? 700 : 400,
  fontStyle: annotation.italic ? "italic" : "normal",
  color: annotation.color,
  textAlign: annotation.align,
  lineHeight: LINE_HEIGHT,
  padding: TEXT_PADDING,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

export const PageView: React.FC<PageViewProps> = ({
  item,
  pageNumber,
  sources,
  zoom,
  tool,
  style,
  selectedId,
  editingId,
  isCurrent,
  searchBoxes,
  onSelect,
  onSetEditing,
  onChangeAnnotations,
  onToolDone,
  registerElement,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [renderError, setRenderError] = useState(false);
  const size = displaySize(item);

  useEffect(() => {
    registerElement(item.id, wrapperRef.current);
    return () => registerElement(item.id, null);
  }, [item.id, registerElement]);

  // Solo se dibujan las páginas que están cerca de la zona visible
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "800px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rotationKey = item.baseRotation + item.rotation;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    const scale = zoom * Math.min(2, window.devicePixelRatio || 1);
    // Breve espera para no redibujar en cada paso del zoom
    let job: ReturnType<typeof renderPage> | null = null;
    const timer = window.setTimeout(() => {
      job = renderPage(sources, item, canvas, scale);
      job.promise.then(() => setRenderError(false)).catch((err) => {
        console.error("No se pudo dibujar la página:", err);
        setRenderError(true);
      });
    }, 60);
    return () => {
      window.clearTimeout(timer);
      job?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, zoom, rotationKey, item.source, item.index, sources]);

  // --- Coordenadas ----------------------------------------------------------

  const pointFromEvent = (e: { clientX: number; clientY: number }) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(size.width, (e.clientX - rect.left) / zoom)),
      y: Math.max(0, Math.min(size.height, (e.clientY - rect.top) / zoom)),
    };
  };

  const update = (id: string, next: Annotation, key?: string) =>
    onChangeAnnotations(item.id, (list) => list.map((a) => (a.id === id ? next : a)), key);

  // --- Arrastres sobre anotaciones existentes -------------------------------

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = pointFromEvent(e);
      if (drag.kind === "move") {
        const dx = point.x - drag.startX;
        const dy = point.y - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) * zoom < 3) return;
        drag.moved = true;
        update(drag.id, translate(drag.original, dx, dy), `move-${drag.id}`);
      } else if (drag.kind === "resize") {
        const b = boundsOf(drag.original);
        let { x, y, w, h } = b;
        const dx = point.x - drag.startX;
        const dy = point.y - drag.startY;
        if (drag.handle.includes("e")) w = Math.max(4, b.w + dx);
        if (drag.handle.includes("s")) h = Math.max(4, b.h + dy);
        if (drag.handle.includes("w")) {
          w = Math.max(4, b.w - dx);
          x = b.x + b.w - w;
        }
        if (drag.handle.includes("n")) {
          h = Math.max(4, b.h - dy);
          y = b.y + b.h - h;
        }
        // Las imágenes conservan su proporción al tirar de una esquina
        if (drag.original.type === "image" && drag.handle.length === 2 && b.h > 0) {
          const ratio = b.w / b.h;
          const newH = w / ratio;
          if (drag.handle.includes("n")) y = b.y + b.h - newH;
          h = newH;
        }
        update(drag.id, withBounds(drag.original, { x, y, w, h }), `resize-${drag.id}`);
      } else if (drag.original.type === "line" || drag.original.type === "arrow") {
        const changes = drag.end === 1 ? { x1: point.x, y1: point.y } : { x2: point.x, y2: point.y };
        update(drag.id, { ...drag.original, ...changes }, `endpoint-${drag.id}`);
      }
    };
    const handleUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      // Un clic (sin arrastrar) sobre un texto ya seleccionado lo pone en edición
      if (drag?.kind === "move" && !drag.moved && drag.original.type === "text" && drag.wasSelected) {
        onSetEditing(drag.id);
      }
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  });

  const startMove = (e: React.PointerEvent, annotation: Annotation) => {
    if (e.button !== 0) return;
    if (tool !== "select" && !(tool === "text" && annotation.type === "text")) return;
    e.stopPropagation();
    e.preventDefault();
    const point = pointFromEvent(e);
    const wasSelected = selectedId === annotation.id;
    onSelect(item.id, annotation.id);
    if (tool === "text" && annotation.type === "text") {
      onSetEditing(annotation.id);
      return;
    }
    if (editingId && editingId !== annotation.id) onSetEditing(null);
    dragRef.current = { kind: "move", id: annotation.id, startX: point.x, startY: point.y, original: annotation, moved: false, wasSelected };
  };

  // --- Creación de anotaciones nuevas ---------------------------------------

  const handleBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const point = pointFromEvent(e);
    if (editingId) onSetEditing(null);

    if (tool === "select") {
      onSelect(item.id, null);
      return;
    }
    e.preventDefault();
    if (tool === "text") {
      const id = newId("ann");
      const annotation: TextAnnotation = {
        id,
        type: "text",
        x: point.x,
        y: Math.max(0, point.y - style.fontSize * 0.6),
        w: Math.min(260, size.width - point.x),
        h: style.fontSize * LINE_HEIGHT + TEXT_PADDING * 2,
        text: "",
        fontSize: style.fontSize,
        font: style.font,
        bold: style.bold,
        italic: style.italic,
        color: style.color,
        align: "left",
      };
      onChangeAnnotations(item.id, (list) => [...list, annotation]);
      onSelect(item.id, id);
      onSetEditing(id);
      onToolDone();
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (tool === "ink") setDraft({ kind: "ink", points: [point.x, point.y] });
    else setDraft({ kind: "box", tool, x0: point.x, y0: point.y, x1: point.x, y1: point.y });
  };

  const handleDraftMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const point = pointFromEvent(e);
    if (draft.kind === "ink") {
      const last = draft.points.length;
      // Se ignoran movimientos diminutos para no crear trazos enormes
      if (Math.hypot(point.x - draft.points[last - 2], point.y - draft.points[last - 1]) < 1.2 / zoom) return;
      setDraft({ kind: "ink", points: [...draft.points, point.x, point.y] });
    } else {
      setDraft({ ...draft, x1: point.x, y1: point.y });
    }
  };

  const handleDraftUp = () => {
    if (!draft) return;
    const current = draft;
    setDraft(null);
    const created: Annotation[] = [];

    if (current.kind === "ink") {
      if (current.points.length >= 4) {
        created.push({ id: newId("ann"), type: "ink", points: current.points, color: style.color, strokeWidth: style.strokeWidth });
      }
    } else {
      const x = Math.min(current.x0, current.x1);
      const y = Math.min(current.y0, current.y1);
      let w = Math.abs(current.x1 - current.x0);
      let h = Math.abs(current.y1 - current.y0);
      const tiny = w < 3 && h < 3;
      switch (current.tool) {
        case "line":
        case "arrow":
          if (!tiny) {
            created.push({
              id: newId("ann"),
              type: current.tool,
              x1: current.x0,
              y1: current.y0,
              x2: current.x1,
              y2: current.y1,
              color: style.color,
              strokeWidth: style.strokeWidth,
            });
          }
          break;
        case "rect":
        case "ellipse":
          if (tiny) {
            w = 120;
            h = 80;
          }
          created.push({ id: newId("ann"), type: current.tool, x, y, w, h, color: style.color, fill: style.fill, strokeWidth: style.strokeWidth });
          break;
        case "highlight":
          if (!tiny) created.push({ id: newId("ann"), type: "highlight", x, y, w, h, color: style.highlight, fill: null, strokeWidth: 0 });
          break;
        case "whiteout":
          if (!tiny) created.push({ id: newId("ann"), type: "whiteout", x, y, w, h, color: "#ffffff", fill: "#ffffff", strokeWidth: 0 });
          break;
        case "replace": {
          if (tiny) break;
          // Tapar el texto original y escribir el nuevo encima
          const fontSize = Math.max(6, Math.min(72, Math.round((h - TEXT_PADDING * 2) / LINE_HEIGHT)));
          created.push({ id: newId("ann"), type: "whiteout", x, y, w, h, color: "#ffffff", fill: "#ffffff", strokeWidth: 0 });
          created.push({
            id: newId("ann"),
            type: "text",
            x,
            y,
            w: Math.max(w, 40),
            h,
            text: "",
            fontSize,
            font: style.font,
            bold: style.bold,
            italic: style.italic,
            color: style.color,
            align: "left",
          });
          break;
        }
      }
    }

    if (created.length === 0) return;
    onChangeAnnotations(item.id, (list) => [...list, ...created]);
    const last = created[created.length - 1];
    onSelect(item.id, last.id);
    if (last.type === "text") onSetEditing(last.id);
    onToolDone();
  };

  // --- Dibujo ---------------------------------------------------------------

  const interactive = tool === "select";
  const svgElement = (annotation: Annotation) => {
    const selectable = interactive ? { onPointerDown: (e: React.PointerEvent) => startMove(e, annotation), style: { cursor: "move", pointerEvents: "all" as const } } : {};
    switch (annotation.type) {
      case "highlight":
        return (
          <rect key={annotation.id} x={annotation.x} y={annotation.y} width={annotation.w} height={annotation.h} fill={annotation.color} opacity={0.4} style={{ mixBlendMode: "multiply", ...(selectable.style || {}) }} onPointerDown={selectable.onPointerDown} />
        );
      case "whiteout":
        return <rect key={annotation.id} x={annotation.x} y={annotation.y} width={annotation.w} height={annotation.h} fill={annotation.fill || "#ffffff"} {...selectable} />;
      case "rect":
        return (
          <rect
            key={annotation.id}
            x={annotation.x}
            y={annotation.y}
            width={annotation.w}
            height={annotation.h}
            fill={annotation.fill || "transparent"}
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth}
            {...selectable}
          />
        );
      case "ellipse":
        return (
          <ellipse
            key={annotation.id}
            cx={annotation.x + annotation.w / 2}
            cy={annotation.y + annotation.h / 2}
            rx={annotation.w / 2}
            ry={annotation.h / 2}
            fill={annotation.fill || "transparent"}
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth}
            {...selectable}
          />
        );
      case "line":
      case "arrow": {
        const angle = Math.atan2(annotation.y2 - annotation.y1, annotation.x2 - annotation.x1);
        const head = Math.max(8, annotation.strokeWidth * 4);
        const tips = [Math.PI * 0.82, -Math.PI * 0.82].map((offset) => [
          annotation.x2 + head * Math.cos(angle + offset),
          annotation.y2 + head * Math.sin(angle + offset),
        ]);
        return (
          <g key={annotation.id} {...selectable}>
            <line x1={annotation.x1} y1={annotation.y1} x2={annotation.x2} y2={annotation.y2} stroke="transparent" strokeWidth={Math.max(10, annotation.strokeWidth + 8)} />
            <line x1={annotation.x1} y1={annotation.y1} x2={annotation.x2} y2={annotation.y2} stroke={annotation.color} strokeWidth={annotation.strokeWidth} strokeLinecap="round" />
            {annotation.type === "arrow" &&
              tips.map(([tx, ty], i) => (
                <line key={i} x1={annotation.x2} y1={annotation.y2} x2={tx} y2={ty} stroke={annotation.color} strokeWidth={annotation.strokeWidth} strokeLinecap="round" />
              ))}
          </g>
        );
      }
      case "ink": {
        const points = [];
        for (let i = 0; i < annotation.points.length; i += 2) points.push(`${annotation.points[i]},${annotation.points[i + 1]}`);
        return (
          <g key={annotation.id} {...selectable}>
            <polyline points={points.join(" ")} fill="none" stroke="transparent" strokeWidth={Math.max(10, annotation.strokeWidth + 8)} />
            <polyline points={points.join(" ")} fill="none" stroke={annotation.color} strokeWidth={annotation.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      }
      default:
        return null;
    }
  };

  const selected = item.annotations.find((a) => a.id === selectedId) || null;
  const handleSize = 9 / zoom;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={wrapperRef}
        data-page-id={item.id}
        className={`relative bg-white shadow-[0_1px_3px_rgba(60,64,67,0.3),0_4px_12px_rgba(60,64,67,0.12)] ${
          isCurrent ? "outline outline-2 outline-[#c62828]/40" : ""
        }`}
        style={{ width: size.width * zoom, height: size.height * zoom }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {renderError && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#b3261e] bg-white/80">
            No se pudo mostrar esta página
          </div>
        )}

        <div
          ref={overlayRef}
          className="absolute left-0 top-0 origin-top-left select-none"
          style={{
            width: size.width,
            height: size.height,
            transform: `scale(${zoom})`,
            cursor: tool === "select" ? "default" : tool === "text" ? "text" : "crosshair",
            touchAction: "none",
          }}
          onPointerDown={handleBackgroundDown}
          onPointerMove={handleDraftMove}
          onPointerUp={handleDraftUp}
        >
          <svg className="absolute inset-0 overflow-visible" width={size.width} height={size.height} style={{ pointerEvents: "none" }}>
            {item.annotations.map(svgElement)}
            {searchBoxes.map((box, i) => (
              <rect key={`search-${i}`} x={box.x - 1} y={box.y - 1} width={box.w + 2} height={box.h + 2} fill="#ff9800" opacity={0.35} />
            ))}
            {draft?.kind === "ink" && (
              <polyline
                points={draft.points.reduce<string[]>((acc, v, i) => (i % 2 === 0 ? [...acc, `${v},${draft.points[i + 1]}`] : acc), []).join(" ")}
                fill="none"
                stroke={style.color}
                strokeWidth={style.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {draft?.kind === "box" &&
              (draft.tool === "line" || draft.tool === "arrow" ? (
                <line x1={draft.x0} y1={draft.y0} x2={draft.x1} y2={draft.y1} stroke={style.color} strokeWidth={style.strokeWidth} strokeLinecap="round" />
              ) : (
                <rect
                  x={Math.min(draft.x0, draft.x1)}
                  y={Math.min(draft.y0, draft.y1)}
                  width={Math.abs(draft.x1 - draft.x0)}
                  height={Math.abs(draft.y1 - draft.y0)}
                  fill={draft.tool === "highlight" ? style.highlight : draft.tool === "whiteout" || draft.tool === "replace" ? "#ffffff" : style.fill || "transparent"}
                  opacity={draft.tool === "highlight" ? 0.4 : 1}
                  stroke={draft.tool === "whiteout" || draft.tool === "replace" ? "#9aa0a6" : draft.tool === "highlight" ? "none" : style.color}
                  strokeDasharray={draft.tool === "whiteout" || draft.tool === "replace" ? "4 3" : undefined}
                  strokeWidth={draft.tool === "rect" ? style.strokeWidth : 1 / zoom}
                  rx={draft.tool === "ellipse" ? Math.abs(draft.x1 - draft.x0) / 2 : 0}
                  ry={draft.tool === "ellipse" ? Math.abs(draft.y1 - draft.y0) / 2 : 0}
                />
              ))}
          </svg>

          {/* Textos e imágenes */}
          {item.annotations.map((annotation) => {
            if (annotation.type === "image") {
              return (
                <img
                  key={annotation.id}
                  src={annotation.dataUrl}
                  alt=""
                  draggable={false}
                  onPointerDown={(e) => startMove(e, annotation)}
                  className="absolute select-none"
                  style={{
                    left: annotation.x,
                    top: annotation.y,
                    width: annotation.w,
                    height: annotation.h,
                    cursor: interactive ? "move" : undefined,
                    pointerEvents: interactive ? "auto" : "none",
                  }}
                />
              );
            }
            if (annotation.type !== "text") return null;
            const editing = editingId === annotation.id;
            return editing ? (
              <TextEditor
                key={annotation.id}
                annotation={annotation}
                onChange={(next) => update(annotation.id, next, `text-${annotation.id}`)}
                onFinish={() => {
                  onSetEditing(null);
                  if (!annotation.text.trim()) {
                    onChangeAnnotations(item.id, (list) => list.filter((a) => a.id !== annotation.id));
                    onSelect(item.id, null);
                  }
                }}
              />
            ) : (
              <div
                key={annotation.id}
                onPointerDown={(e) => startMove(e, annotation)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelect(item.id, annotation.id);
                  onSetEditing(annotation.id);
                }}
                className="absolute overflow-hidden"
                style={{
                  left: annotation.x,
                  top: annotation.y,
                  width: annotation.w,
                  height: annotation.h,
                  ...textStyle(annotation),
                  cursor: interactive ? "move" : tool === "text" ? "text" : undefined,
                  pointerEvents: interactive || tool === "text" ? "auto" : "none",
                }}
              >
                {annotation.text}
              </div>
            );
          })}

          {/* Selección y tiradores */}
          {selected && editingId !== selected.id && (() => {
            if (selected.type === "line" || selected.type === "arrow") {
              return ([1, 2] as const).map((end) => (
                <div
                  key={end}
                  className="absolute bg-white border border-[#1a73e8] rounded-full"
                  style={{
                    left: (end === 1 ? selected.x1 : selected.x2) - handleSize / 2,
                    top: (end === 1 ? selected.y1 : selected.y2) - handleSize / 2,
                    width: handleSize,
                    height: handleSize,
                    borderWidth: 1.5 / zoom,
                    cursor: "crosshair",
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    dragRef.current = { kind: "endpoint", id: selected.id, end, original: selected };
                  }}
                />
              ));
            }
            const b = boundsOf(selected);
            return (
              <>
                <div
                  className="absolute pointer-events-none"
                  style={{ left: b.x - 2 / zoom, top: b.y - 2 / zoom, width: b.w + 4 / zoom, height: b.h + 4 / zoom, border: `${1.5 / zoom}px solid #1a73e8` }}
                />
                {HANDLES.map((handle) => (
                  <div
                    key={handle.id}
                    className="absolute bg-white border-[#1a73e8]"
                    style={{
                      left: b.x + b.w * handle.fx - handleSize / 2,
                      top: b.y + b.h * handle.fy - handleSize / 2,
                      width: handleSize,
                      height: handleSize,
                      borderWidth: 1.5 / zoom,
                      borderStyle: "solid",
                      cursor: handle.cursor,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const point = pointFromEvent(e);
                      dragRef.current = { kind: "resize", id: selected.id, handle: handle.id, startX: point.x, startY: point.y, original: selected };
                    }}
                  />
                ))}
              </>
            );
          })()}
        </div>
      </div>
      <span className="text-[11px] text-[#5f6368] font-mono">{pageNumber}</span>
    </div>
  );
};

/** Cuadro de edición de texto: crece en alto según se escribe. */
const TextEditor: React.FC<{
  annotation: TextAnnotation;
  onChange: (next: TextAnnotation) => void;
  onFinish: () => void;
}> = ({ annotation, onChange, onFinish }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    const end = element.value.length;
    element.setSelectionRange(end, end);
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    const needed = element.scrollHeight;
    element.style.height = "";
    if (Math.abs(needed - annotation.h) > 0.5 && needed > annotation.h) onChange({ ...annotation, h: needed });
  }, [annotation, onChange]);

  return (
    <textarea
      ref={ref}
      value={annotation.text}
      spellCheck
      placeholder="Escribe aquí"
      onChange={(e) => onChange({ ...annotation, text: e.target.value })}
      onBlur={onFinish}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
      }}
      className="absolute resize-none bg-white/60 outline outline-1 outline-dashed outline-[#1a73e8] border-0 select-text overflow-hidden placeholder:text-[#9aa0a6]"
      style={{
        left: annotation.x,
        top: annotation.y,
        width: annotation.w,
        height: annotation.h,
        ...textStyle(annotation),
      }}
    />
  );
};
