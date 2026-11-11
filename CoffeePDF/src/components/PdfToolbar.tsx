import React from "react";
import {
  Search,
  Undo2,
  Redo2,
  Printer,
  MousePointer2,
  Type,
  Replace,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  PenLine,
  Image as ImageIcon,
  Signature,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Tool } from "../types";

interface PdfToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onPrint: () => void;
  onInsertImage: () => void;
  onSignature: () => void;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onRotate: (clockwise: boolean) => void;
  pageNumber: number;
  pageCount: number;
  onGoToPage: (page: number) => void;
  onOpenCommandSearch: () => void;
}

const TOOLS: Array<{ id: Tool; title: string; Icon: React.ComponentType<{ size?: number }>; shortcut: string }> = [
  { id: "select", title: "Seleccionar y mover", Icon: MousePointer2, shortcut: "V" },
  { id: "text", title: "Añadir texto", Icon: Type, shortcut: "T" },
  { id: "replace", title: "Reemplazar texto: tapa lo que hay y escribe encima", Icon: Replace, shortcut: "R" },
  { id: "highlight", title: "Resaltar", Icon: Highlighter, shortcut: "H" },
  { id: "whiteout", title: "Corrector: tapar con blanco", Icon: Eraser, shortcut: "W" },
  { id: "rect", title: "Rectángulo", Icon: Square, shortcut: "" },
  { id: "ellipse", title: "Elipse", Icon: Circle, shortcut: "" },
  { id: "line", title: "Línea", Icon: Minus, shortcut: "L" },
  { id: "arrow", title: "Flecha", Icon: MoveUpRight, shortcut: "A" },
  { id: "ink", title: "Dibujo a mano alzada", Icon: PenLine, shortcut: "D" },
];

const Button: React.FC<{ title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }> = ({
  title,
  onClick,
  active,
  disabled,
  children,
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`p-1.5 rounded-full transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${
      active ? "bg-[#fce8e6] text-[#c62828]" : "text-[#444746] hover:bg-gray-200/70"
    }`}
  >
    {children}
  </button>
);

const Separator = () => <div className="h-4 w-px bg-gray-300 mx-0.5 shrink-0" />;

export const PdfToolbar: React.FC<PdfToolbarProps> = (props) => (
  <div className="w-full px-4 py-1 flex items-center select-none bg-white print:hidden">
    <div className="bg-[#edf2fa] rounded-full px-3 py-1 flex items-center gap-1 shadow-xs text-[#444746] text-xs flex-wrap max-w-full">
      <button
        type="button"
        onClick={props.onOpenCommandSearch}
        className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs shadow-xs mr-1"
        title="Buscar en los menús (Alt+/)"
      >
        <Search size={14} />
        <span className="font-medium text-[11px]">Menús</span>
      </button>

      <Button title="Deshacer (Ctrl+Z)" onClick={props.onUndo} disabled={!props.canUndo}>
        <Undo2 size={15} />
      </Button>
      <Button title="Rehacer (Ctrl+Y)" onClick={props.onRedo} disabled={!props.canRedo}>
        <Redo2 size={15} />
      </Button>
      <Button title="Imprimir (Ctrl+P)" onClick={props.onPrint}>
        <Printer size={15} />
      </Button>

      <Separator />

      {TOOLS.map(({ id, title, Icon, shortcut }) => (
        <Button key={id} title={shortcut ? `${title} (${shortcut})` : title} onClick={() => props.onToolChange(id)} active={props.tool === id}>
          <Icon size={15} />
        </Button>
      ))}
      <Button title="Insertar imagen" onClick={props.onInsertImage}>
        <ImageIcon size={15} />
      </Button>
      <Button title="Firmar: dibuja o escribe tu firma" onClick={props.onSignature}>
        <Signature size={15} />
      </Button>

      <Separator />

      <Button title="Girar la página a la izquierda" onClick={() => props.onRotate(false)}>
        <RotateCcw size={15} />
      </Button>
      <Button title="Girar la página a la derecha" onClick={() => props.onRotate(true)}>
        <RotateCw size={15} />
      </Button>

      <Separator />

      <Button title="Alejar (Ctrl+-)" onClick={props.onZoomOut}>
        <ZoomOut size={15} />
      </Button>
      <button
        type="button"
        onClick={props.onZoomFit}
        title="Ajustar al ancho"
        className="px-1.5 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium min-w-[52px]"
      >
        {props.zoomLabel}
      </button>
      <Button title="Acercar (Ctrl++)" onClick={props.onZoomIn}>
        <ZoomIn size={15} />
      </Button>

      <Separator />

      <Button title="Página anterior" onClick={() => props.onGoToPage(props.pageNumber - 1)} disabled={props.pageNumber <= 1}>
        <ChevronLeft size={15} />
      </Button>
      <span className="flex items-center gap-1 text-xs">
        <input
          type="number"
          min={1}
          max={props.pageCount}
          value={props.pageNumber}
          title="Ir a la página"
          onChange={(e) => props.onGoToPage(Number(e.target.value))}
          className="w-10 text-center border border-[#c4c7c5] rounded py-0.5 bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-[#5f6368]">de {props.pageCount}</span>
      </span>
      <Button title="Página siguiente" onClick={() => props.onGoToPage(props.pageNumber + 1)} disabled={props.pageNumber >= props.pageCount}>
        <ChevronRight size={15} />
      </Button>
    </div>
  </div>
);
