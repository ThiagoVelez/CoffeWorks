// Lienzo de una página: notas de texto que se colocan en cualquier punto,
// imágenes y tinta. Las coordenadas del modelo son píxeles de la página sin
// zoom; el zoom se aplica con una transformación CSS.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GripHorizontal, Trash2, Copy } from "lucide-react";
import type { Block, ImageBlock, InkStyle, Page, Stroke, TextBlock, Tool } from "../types";
import { PAGE_MIN_HEIGHT, PAGE_WIDTH, formatDate, newId, pageExtent, strokePath } from "../services/notebook";

interface PageCanvasProps {
  page: Page;
  tool: Tool;
  ink: InkStyle;
  zoom: number;
  accent: string;
  selectedId: string | null;
  autoFocusId: string | null;
  onSelect: (id: string | null) => void;
  /** Cambia la página. `key` agrupa cambios seguidos en un solo paso de deshacer. */
  onChange: (page: Page, key?: string) => void;
  onTitleChange: (title: string) => void;
  /** Una nota recién creada que debe recibir el foco. */
  onCreateBlock: (id: string) => void;
  onEditorFocused: (id: string) => void;
  onPasteImage: (src: string, x: number, y: number) => void;
}

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number; moved: boolean }
  | { kind: "resize-text"; id: string; startX: number; origWidth: number }
  | { kind: "resize-image"; id: string; startX: number; origWidth: number; origHeight: number };

const MIN_TEXT_WIDTH = 120;

const isEmptyHtml = (html: string) => {
  if (/<(img|table|hr)/i.test(html) || /cp-tag/.test(html)) return false;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;| /g, " ").trim() === "";
};

// ---------------------------------------------------------------------------
// Bloque de texto editable
// ---------------------------------------------------------------------------

interface TextViewProps {
  block: TextBlock;
  selected: boolean;
  interactive: boolean;
  autoFocus: boolean;
  accent: string;
  onInput: (html: string) => void;
  onFocus: () => void;
  onBlur: (html: string) => void;
  onStartDrag: (e: React.PointerEvent, kind: "move" | "resize-text") => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const TextView: React.FC<TextViewProps> = ({
  block,
  selected,
  interactive,
  autoFocus,
  accent,
  onInput,
  onFocus,
  onBlur,
  onStartDrag,
  onDelete,
  onDuplicate,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // El HTML solo se escribe cuando cambia desde fuera (deshacer, abrir...),
  // nunca mientras se teclea, para no mover el cursor.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== block.html) el.innerHTML = block.html;
  }, [block.html]);

  useEffect(() => {
    if (!autoFocus || !editorRef.current) return;
    const el = editorRef.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [autoFocus]);

  const active = focused || selected;

  return (
    <div
      data-block={block.id}
      className="absolute group"
      style={{ left: block.x, top: block.y, width: block.width, pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Barra superior para mover la nota */}
      <div
        className={`absolute -top-[14px] left-0 right-0 h-[14px] rounded-t flex items-center justify-between px-1 cursor-move transition-opacity ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ background: active ? accent : "#d7cfe0" }}
        onPointerDown={(e) => {
          e.preventDefault();
          onStartDrag(e, "move");
        }}
        title="Arrastra para mover la nota"
      >
        <GripHorizontal size={11} className="text-white" />
        {active && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              title="Duplicar la nota"
              className="text-white/90 hover:text-white"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDuplicate}
            >
              <Copy size={10} />
            </button>
            <button
              type="button"
              title="Eliminar la nota"
              className="text-white/90 hover:text-white"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onDelete}
            >
              <Trash2 size={10} />
            </button>
          </span>
        )}
      </div>
      <div
        ref={editorRef}
        data-editor={block.id}
        contentEditable={interactive}
        suppressContentEditableWarning
        spellCheck={false}
        className={`cp-editor min-h-[24px] px-2 py-1 outline-none text-[15px] leading-[1.45] text-[#1f1f1f] select-text rounded-b ${
          active ? "ring-1" : "group-hover:ring-1 ring-[#e1d5ea]"
        }`}
        style={active ? ({ "--tw-ring-color": accent } as React.CSSProperties) : undefined}
        onFocus={() => {
          setFocused(true);
          onFocus();
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur(e.currentTarget.innerHTML);
        }}
        onInput={(e) => onInput(e.currentTarget.innerHTML)}
        onClick={(e) => {
          // Las etiquetas "Tarea pendiente" se marcan con un clic
          const tag = (e.target as HTMLElement).closest<HTMLElement>('.cp-tag[data-tag="todo"]');
          if (tag && editorRef.current) {
            tag.dataset.checked = tag.dataset.checked === "true" ? "false" : "true";
            onInput(editorRef.current.innerHTML);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
          if (e.key === "Tab") {
            e.preventDefault();
            document.execCommand(e.shiftKey ? "outdent" : "indent");
          }
        }}
      />
      {/* Tirador para cambiar el ancho */}
      <div
        className={`absolute top-0 -right-1.5 w-3 h-full cursor-ew-resize ${active ? "" : "hidden group-hover:block"}`}
        onPointerDown={(e) => {
          e.preventDefault();
          onStartDrag(e, "resize-text");
        }}
        title="Arrastra para cambiar el ancho"
      >
        <div className="mx-auto w-[3px] h-6 mt-1 rounded-full" style={{ background: accent }} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Imagen
// ---------------------------------------------------------------------------

const ImageView: React.FC<{
  block: ImageBlock;
  selected: boolean;
  interactive: boolean;
  accent: string;
  onStartDrag: (e: React.PointerEvent, kind: "move" | "resize-image") => void;
  onDelete: () => void;
}> = ({ block, selected, interactive, accent, onStartDrag, onDelete }) => (
  <div
    data-block={block.id}
    className="absolute"
    style={{
      left: block.x,
      top: block.y,
      width: block.width,
      height: block.height,
      pointerEvents: interactive ? "auto" : "none",
      outline: selected ? `2px solid ${accent}` : undefined,
      outlineOffset: 2,
    }}
    onPointerDown={(e) => {
      e.stopPropagation();
      e.preventDefault();
      onStartDrag(e, "move");
    }}
  >
    <img src={block.src} alt="" draggable={false} className="w-full h-full object-fill cursor-move" />
    {selected && (
      <>
        <button
          type="button"
          title="Eliminar la imagen"
          className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white border shadow flex items-center justify-center text-[#5f6368] hover:text-red-600"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
        >
          <Trash2 size={12} />
        </button>
        <div
          className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm border-2 border-white cursor-nwse-resize"
          style={{ background: accent }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onStartDrag(e, "resize-image");
          }}
        />
      </>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Lienzo
// ---------------------------------------------------------------------------

const distanceToSegment = (px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const strokeHit = (stroke: Stroke, x: number, y: number, radius: number) => {
  const pts = stroke.points;
  const reach = radius + stroke.width / 2;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= reach;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distanceToSegment(x, y, pts[i], pts[i + 1]) <= reach) return true;
  }
  return false;
};

export const PageCanvas: React.FC<PageCanvasProps> = ({
  page,
  tool,
  ink,
  zoom,
  accent,
  selectedId,
  autoFocusId,
  onSelect,
  onChange,
  onTitleChange,
  onCreateBlock,
  onEditorFocused,
  onPasteImage,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const dragRef = useRef<DragState | null>(null);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);

  const extent = useMemo(() => pageExtent(page), [page]);
  const width = Math.max(PAGE_WIDTH, extent.width + 400);
  const height = Math.max(PAGE_MIN_HEIGHT, extent.height + 500);
  const inking = tool === "pen" || tool === "highlighter" || tool === "eraser";

  const toLocal = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return [0, 0];
      return [Math.round(((clientX - rect.left) / zoom) * 10) / 10, Math.round(((clientY - rect.top) / zoom) * 10) / 10];
    },
    [zoom]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<TextBlock> | Partial<ImageBlock>, key?: string) => {
      const current = pageRef.current;
      onChange(
        { ...current, blocks: current.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) },
        key
      );
    },
    [onChange]
  );

  const removeBlock = useCallback(
    (id: string) => {
      const current = pageRef.current;
      onChange({ ...current, blocks: current.blocks.filter((b) => b.id !== id) });
      onSelect(null);
    },
    [onChange, onSelect]
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const current = pageRef.current;
      const original = current.blocks.find((b) => b.id === id);
      if (!original) return;
      const copy = { ...original, id: newId("blk"), x: original.x + 24, y: original.y + 24 } as Block;
      onChange({ ...current, blocks: [...current.blocks, copy] });
      onSelect(copy.id);
    },
    [onChange, onSelect]
  );

  // Arrastres (mover y redimensionar) con eventos globales
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const block = pageRef.current.blocks.find((b) => b.id === drag.id);
      if (!block) return;
      if (drag.kind === "move") {
        const dx = (e.clientX - drag.startX) / zoom;
        const dy = (e.clientY - drag.startY) / zoom;
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true;
        updateBlock(drag.id, { x: Math.max(0, Math.round(drag.origX + dx)), y: Math.max(0, Math.round(drag.origY + dy)) }, `move-${drag.id}`);
      } else if (drag.kind === "resize-text") {
        const dx = (e.clientX - drag.startX) / zoom;
        updateBlock(drag.id, { width: Math.max(MIN_TEXT_WIDTH, Math.round(drag.origWidth + dx)) }, `resize-${drag.id}`);
      } else {
        const dx = (e.clientX - drag.startX) / zoom;
        const ratio = drag.origHeight / drag.origWidth;
        const w = Math.max(24, Math.round(drag.origWidth + dx));
        updateBlock(drag.id, { width: w, height: Math.round(w * ratio) }, `resize-${drag.id}`);
      }
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [zoom, updateBlock]);

  const startDrag = (block: Block) => (e: React.PointerEvent, kind: "move" | "resize-text" | "resize-image") => {
    onSelect(block.id);
    if (kind === "move") {
      dragRef.current = { kind, id: block.id, startX: e.clientX, startY: e.clientY, origX: block.x, origY: block.y, moved: false };
    } else if (kind === "resize-text") {
      dragRef.current = { kind, id: block.id, startX: e.clientX, origWidth: block.width };
    } else if (block.kind === "image") {
      dragRef.current = { kind, id: block.id, startX: e.clientX, origWidth: block.width, origHeight: block.height };
    }
  };

  // Clic en una zona vacía: nueva nota en ese punto
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (inking || e.button !== 0) return;
    onSelect(null);
    const active = document.activeElement as HTMLElement | null;
    // Si había una nota en edición, el primer clic solo la cierra
    if (active?.dataset.editor) {
      active.blur();
      return;
    }
    if (active && active.tagName === "INPUT") active.blur();
    if (tool !== "type") return;
    e.preventDefault();
    const [x, y] = toLocal(e.clientX, e.clientY);
    const block: TextBlock = { id: newId("blk"), kind: "text", x: Math.max(0, x - 8), y: Math.max(0, y - 12), width: 480, html: "" };
    const current = pageRef.current;
    onChange({ ...current, blocks: [...current.blocks, block] }, `create-${block.id}`);
    onCreateBlock(block.id);
  };

  // ---- Tinta -------------------------------------------------------------
  const eraseAt = (x: number, y: number) => {
    const current = pageRef.current;
    const remaining = current.strokes.filter((s) => !strokeHit(s, x, y, 6));
    if (remaining.length !== current.strokes.length) onChange({ ...current, strokes: remaining }, "erase");
  };

  const handleInkDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // El lienzo toma el foco para que Ctrl+Z deshaga el trazo y no el texto
    (document.activeElement as HTMLElement | null)?.blur?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = toLocal(e.clientX, e.clientY);
    if (tool === "eraser") {
      erasingRef.current = true;
      eraseAt(...point);
      return;
    }
    const highlighter = tool === "highlighter";
    const stroke: Stroke = {
      id: newId("ink"),
      tool: highlighter ? "highlighter" : "pen",
      color: highlighter ? ink.highlighterColor : ink.penColor,
      width: highlighter ? ink.highlighterWidth : ink.penWidth,
      points: [point],
    };
    draftRef.current = stroke;
    setDraft(stroke);
  };

  const handleInkMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const point = toLocal(e.clientX, e.clientY);
    if (erasingRef.current) {
      eraseAt(...point);
      return;
    }
    const stroke = draftRef.current;
    if (!stroke) return;
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 1.5) return;
    const next = { ...stroke, points: [...stroke.points, point] };
    draftRef.current = next;
    setDraft(next);
  };

  const handleInkUp = () => {
    erasingRef.current = false;
    const stroke = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!stroke) return;
    const current = pageRef.current;
    onChange({ ...current, strokes: [...current.strokes, stroke] });
  };

  // ---- Pegar y soltar imágenes -------------------------------------------
  const readImage = (file: File, x: number, y: number) => {
    const reader = new FileReader();
    reader.onload = () => onPasteImage(String(reader.result), x, y);
    reader.readAsDataURL(file);
  };

  const paperStyle: React.CSSProperties =
    page.paper === "lines"
      ? { backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #d6e4f0 27px, #d6e4f0 28px)" }
      : page.paper === "grid"
        ? {
            backgroundImage:
              "linear-gradient(#e3e9f0 1px, transparent 1px), linear-gradient(90deg, #e3e9f0 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }
        : {};

  const cursor = tool === "type" ? "text" : tool === "eraser" ? "cell" : inking ? "crosshair" : "default";

  return (
    <div className="relative" style={{ width: width * zoom, height: (height + 120) * zoom }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width, transform: `scale(${zoom})` }}
        onPaste={(e) => {
          const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
          if (!file) return;
          e.preventDefault();
          const active = pageRef.current.blocks.find((b) => b.id === selectedId);
          readImage(file, active ? active.x : 60, active ? active.y + 60 : 60);
        }}
      >
        {/* Título y fecha, como en un cuaderno */}
        <div className="px-12 pt-8 pb-3">
          <input
            data-page-title
            value={page.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título de la página"
            className="w-[720px] max-w-full text-[28px] font-semibold text-[#1f1f1f] bg-transparent border-b border-[#e0d6e8] focus:border-[#7b1fa2] outline-none pb-1 select-text"
          />
          <div className="mt-1.5 text-xs text-[#6b6b6b]">{formatDate(page.createdAt)}</div>
        </div>

        <div
          ref={canvasRef}
          data-canvas
          className="relative"
          style={{ width, height, cursor, ...paperStyle }}
          onPointerDown={handleCanvasPointerDown}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
          }}
          onDrop={(e) => {
            const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
            if (!file) return;
            e.preventDefault();
            const [x, y] = toLocal(e.clientX, e.clientY);
            readImage(file, x, y);
          }}
        >
          {page.blocks.map((block) =>
            block.kind === "text" ? (
              <TextView
                key={block.id}
                block={block}
                selected={selectedId === block.id}
                interactive={!inking}
                autoFocus={autoFocusId === block.id}
                accent={accent}
                onInput={(html) => updateBlock(block.id, { html }, `text-${block.id}`)}
                onFocus={() => {
                  onSelect(block.id);
                  onEditorFocused(block.id);
                }}
                onBlur={(html) => {
                  if (isEmptyHtml(html)) {
                    const current = pageRef.current;
                    onChange({ ...current, blocks: current.blocks.filter((b) => b.id !== block.id) }, `create-${block.id}`);
                  }
                }}
                onStartDrag={startDrag(block)}
                onDelete={() => removeBlock(block.id)}
                onDuplicate={() => duplicateBlock(block.id)}
              />
            ) : (
              <ImageView
                key={block.id}
                block={block}
                selected={selectedId === block.id}
                interactive={!inking}
                accent={accent}
                onStartDrag={startDrag(block)}
                onDelete={() => removeBlock(block.id)}
              />
            )
          )}

          <svg
            className="absolute inset-0"
            width={width}
            height={height}
            style={{ pointerEvents: inking ? "auto" : "none", cursor, touchAction: "none" }}
            onPointerDown={handleInkDown}
            onPointerMove={handleInkMove}
            onPointerUp={handleInkUp}
            onPointerCancel={handleInkUp}
          >
            {[...page.strokes, ...(draft ? [draft] : [])].map((stroke) => (
              <path
                key={stroke.id}
                d={strokePath(stroke.points)}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeOpacity={stroke.tool === "highlighter" ? 0.35 : 1}
                fill="none"
                strokeLinecap={stroke.tool === "highlighter" ? "square" : "round"}
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};
