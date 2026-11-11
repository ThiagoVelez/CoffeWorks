import React, { useEffect, useRef, useState } from "react";
import { X, Eraser, PenLine, Type } from "lucide-react";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Devuelve la firma como PNG transparente y su tamaño en píxeles. */
  onInsert: (dataUrl: string, width: number, height: number) => void;
}

const COLORS = ["#000000", "#0d47a1", "#1565c0"];
const SCRIPT_FONTS = ["'Segoe Script', 'Brush Script MT', cursive", "'Lucida Handwriting', 'Comic Sans MS', cursive", "Georgia, serif"];

/** Recorta el lienzo al área dibujada para que la firma no lleve márgenes. */
function trimCanvas(source: HTMLCanvasElement): { dataUrl: string; width: number; height: number } | null {
  const ctx = source.getContext("2d");
  if (!ctx) return null;
  const { width, height } = source;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")?.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return { dataUrl: out.toDataURL("image/png"), width: out.width, height: out.height };
}

/** Ventana para crear una firma dibujándola o escribiéndola. */
export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onInsert }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [color, setColor] = useState(COLORS[0]);
  const [typed, setTyped] = useState("");
  const [fontIndex, setFontIndex] = useState(0);
  const [empty, setEmpty] = useState(true);

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };

  useEffect(() => {
    if (isOpen) {
      clear();
      setTyped("");
    }
  }, [isOpen, mode]);

  // Firma escrita: se dibuja el texto en el lienzo con la fuente elegida
  useEffect(() => {
    if (!isOpen || mode !== "type") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!typed.trim()) {
      setEmpty(true);
      return;
    }
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 110;
    do {
      ctx.font = `${size}px ${SCRIPT_FONTS[fontIndex]}`;
      size -= 4;
    } while (ctx.measureText(typed).width > canvas.width - 60 && size > 20);
    ctx.fillText(typed, canvas.width / 2, canvas.height / 2);
    setEmpty(false);
  }, [isOpen, mode, typed, fontIndex, color]);

  if (!isOpen) return null;

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const trimmed = trimCanvas(canvas);
    if (!trimmed) return;
    onInsert(trimmed.dataUrl, trimmed.width, trimmed.height);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[999960] bg-black/40 flex items-center justify-center p-4 select-none print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-5 flex flex-col gap-4 text-[#1f1f1f]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Firma</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-[#444746]" title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(
            [
              ["draw", "Dibujar", PenLine],
              ["type", "Escribir", Type],
            ] as const
          ).map(([id, text, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                mode === id ? "bg-[#fce8e6] text-[#c62828]" : "text-[#444746] hover:bg-gray-100"
              }`}
            >
              <Icon size={14} />
              {text}
            </button>
          ))}
          <div className="flex-1" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-[#c62828]" : ""}`}
            />
          ))}
        </div>

        {mode === "type" && (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Escribe tu nombre"
              className="flex-1 border border-[#c4c7c5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c62828] select-text"
            />
            <select
              value={fontIndex}
              onChange={(e) => setFontIndex(Number(e.target.value))}
              className="border border-[#c4c7c5] rounded-lg px-2 text-sm bg-white"
            >
              <option value={0}>Caligráfica</option>
              <option value={1}>Manuscrita</option>
              <option value={2}>Clásica</option>
            </select>
          </div>
        )}

        <div className="relative border border-dashed border-[#bdc1c6] rounded-xl bg-[#fafafa]">
          <canvas
            ref={canvasRef}
            width={1000}
            height={320}
            className="w-full h-auto touch-none"
            style={{ cursor: mode === "draw" ? "crosshair" : "default" }}
            onPointerDown={(e) => {
              if (mode !== "draw") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drawingRef.current = true;
              lastRef.current = point(e);
            }}
            onPointerMove={(e) => {
              if (!drawingRef.current || !lastRef.current) return;
              const ctx = e.currentTarget.getContext("2d");
              if (!ctx) return;
              const next = point(e);
              ctx.strokeStyle = color;
              ctx.lineWidth = 5;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.beginPath();
              ctx.moveTo(lastRef.current.x, lastRef.current.y);
              ctx.lineTo(next.x, next.y);
              ctx.stroke();
              lastRef.current = next;
              setEmpty(false);
            }}
            onPointerUp={() => {
              drawingRef.current = false;
              lastRef.current = null;
            }}
          />
          {mode === "draw" && empty && (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-[#9aa0a6] pointer-events-none">
              Dibuja tu firma aquí con el ratón o el lápiz
            </span>
          )}
          <div className="absolute left-6 right-6 bottom-10 h-px bg-[#dadce0] pointer-events-none" />
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={clear} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[#444746] hover:bg-gray-100">
            <Eraser size={14} /> Borrar
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#c62828] hover:bg-[#fce8e6]">
              Cancelar
            </button>
            <button
              type="button"
              disabled={empty}
              onClick={handleInsert}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#c62828] hover:bg-[#a51f1f] disabled:opacity-40"
            >
              Insertar firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
