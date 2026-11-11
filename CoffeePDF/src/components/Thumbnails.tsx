import React, { useEffect, useRef, useState } from "react";
import { RotateCw, RotateCcw, Copy, Trash2, Plus } from "lucide-react";
import type { PageItem } from "../types";
import type { SourcePdf } from "../services/pdfEngine";
import { renderPage } from "../services/pdfEngine";
import { displaySize } from "../services/geometry";

interface ThumbnailsProps {
  pages: PageItem[];
  sources: SourcePdf[];
  currentId: string | null;
  selected: Set<string>;
  onSelect: (id: string, mode: "single" | "toggle" | "range") => void;
  onRotate: (ids: string[], clockwise: boolean) => void;
  onDuplicate: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onMove: (id: string, toIndex: number) => void;
  onAddBlank: () => void;
}

const THUMB_WIDTH = 132;

const Thumb: React.FC<{ item: PageItem; sources: SourcePdf[] }> = ({ item, sources }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const size = displaySize(item);
  const scale = THUMB_WIDTH / size.width;

  useEffect(() => {
    const element = holderRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "300px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rotationKey = item.baseRotation + item.rotation;
  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const job = renderPage(sources, item, canvasRef.current, scale * Math.min(2, window.devicePixelRatio || 1));
    job.promise.catch(() => undefined);
    return job.cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, rotationKey, item.source, item.index, sources]);

  // Las anotaciones se insinúan con una marca para saber qué páginas tienen cambios
  return (
    <div ref={holderRef} className="relative bg-white" style={{ width: THUMB_WIDTH, height: size.height * scale }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {item.annotations.length > 0 && (
        <span
          className="absolute top-1 left-1 w-2 h-2 rounded-full bg-[#c62828]"
          title={`${item.annotations.length} ${item.annotations.length === 1 ? "anotación" : "anotaciones"}`}
        />
      )}
    </div>
  );
};

/** Barra lateral con las miniaturas de las páginas. */
export const Thumbnails: React.FC<ThumbnailsProps> = ({
  pages,
  sources,
  currentId,
  selected,
  onSelect,
  onRotate,
  onDuplicate,
  onDelete,
  onMove,
  onAddBlank,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // La miniatura de la página actual siempre está a la vista
  useEffect(() => {
    if (!currentId) return;
    listRef.current?.querySelector(`[data-thumb="${currentId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const finishDrag = () => {
    if (dragId && dropIndex !== null) onMove(dragId, dropIndex);
    setDragId(null);
    setDropIndex(null);
  };

  return (
    <aside className="w-48 bg-white border-r border-[#e1dfdd] flex flex-col shrink-0 select-none print:hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#efefef]">
        <span className="text-xs font-semibold text-[#444746]">
          {pages.length} {pages.length === 1 ? "página" : "páginas"}
        </span>
        <button
          type="button"
          onClick={onAddBlank}
          title="Insertar una página en blanco después de la actual"
          className="p-1 rounded hover:bg-[#f0f4f9] text-[#444746]"
        >
          <Plus size={15} />
        </button>
      </div>
      {selected.size > 1 && (
        <div className="px-3 py-1.5 text-[11px] text-[#0b57d0] bg-[#e8f0fe] border-b border-[#d3e3fd]">
          {selected.size} páginas seleccionadas
        </div>
      )}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-3">
        {pages.map((page, index) => {
          const isSelected = selected.has(page.id);
          const targets = isSelected ? [...selected] : [page.id];
          return (
            <div
              key={page.id}
              data-thumb={page.id}
              draggable
              onDragStart={(e) => {
                setDragId(page.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", page.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setDropIndex(index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
              }}
              onDrop={(e) => {
                e.preventDefault();
                finishDrag();
              }}
              onDragEnd={finishDrag}
              className={`group relative flex flex-col items-center gap-1 ${dragId === page.id ? "opacity-40" : ""}`}
            >
              {dropIndex === index && dragId && dragId !== page.id && (
                <div className="absolute -top-2 left-0 right-0 h-0.5 bg-[#c62828] rounded-full" />
              )}
              {dropIndex === index + 1 && index === pages.length - 1 && dragId && (
                <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#c62828] rounded-full" />
              )}
              <div
                onClick={(e) => onSelect(page.id, e.shiftKey ? "range" : e.ctrlKey || e.metaKey ? "toggle" : "single")}
                className={`relative cursor-pointer border-2 transition-colors ${
                  isSelected ? "border-[#c62828]" : page.id === currentId ? "border-[#f4b4b4]" : "border-transparent hover:border-[#dadce0]"
                } shadow-sm`}
              >
                <Thumb item={page} sources={sources} />
                <div className="absolute top-1 right-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {[
                    { title: "Girar a la derecha", Icon: RotateCw, action: () => onRotate(targets, true) },
                    { title: "Girar a la izquierda", Icon: RotateCcw, action: () => onRotate(targets, false) },
                    { title: "Duplicar", Icon: Copy, action: () => onDuplicate(targets) },
                    { title: "Eliminar", Icon: Trash2, action: () => onDelete(targets), disabled: pages.length <= targets.length },
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
                      className="p-1 rounded bg-white/95 border border-gray-300 text-[#444746] hover:text-[#c62828] disabled:opacity-40 shadow-sm"
                    >
                      <Icon size={11} />
                    </button>
                  ))}
                </div>
              </div>
              <span className={`text-[11px] font-mono ${page.id === currentId ? "text-[#c62828] font-bold" : "text-[#5f6368]"}`}>
                {index + 1}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
