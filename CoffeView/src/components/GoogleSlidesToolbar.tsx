import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Undo2,
  Redo2,
  Printer,
  Paintbrush,
  MousePointer2,
  Type,
  Image as ImageIcon,
  Shapes,
  Minus,
  Table,
  StickyNote,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  PaintBucket,
  BringToFront,
  SendToBack,
  Trash2,
  Check,
  Square,
  Circle,
  Triangle,
  Star,
  Diamond,
  ArrowRight,
  MessageSquare,
  RectangleHorizontal,
  Palette,
} from "lucide-react";
import type { ShapeType, SlideElement, SlideLayout, SlideTheme } from "../types";
import { TEXT_TYPES } from "../types";

interface GoogleSlidesToolbarProps {
  selected: SlideElement | null;
  theme: SlideTheme;
  themes: SlideTheme[];
  zoom: number | "fit";
  onZoomChange: (zoom: number | "fit") => void;
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  painterActive: boolean;
  onTogglePainter: () => void;
  onAddSlide: (layout: SlideLayout) => void;
  onDeselect: () => void;
  onAddText: () => void;
  onPickImage: () => void;
  onAddShape: (shape: ShapeType) => void;
  onAddLine: () => void;
  onAddTable: () => void;
  onFocusNotes: () => void;
  onStyle: (patch: Partial<SlideElement>) => void;
  onArrange: (direction: "front" | "back") => void;
  onDelete: () => void;
  onSelectTheme: (id: string) => void;
  onOpenCommandSearch: () => void;
  notesVisible: boolean;
  onToggleNotes: () => void;
}

const FONTS = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New", "Hanken Grotesk"];

const LAYOUTS: Array<{ id: SlideLayout; label: string }> = [
  { id: "title", label: "Diapositiva de título" },
  { id: "title-content", label: "Título y contenido" },
  { id: "two-columns", label: "Título y dos columnas" },
  { id: "section", label: "Encabezado de sección" },
  { id: "blank", label: "En blanco" },
];

const SHAPES: Array<{ id: ShapeType; label: string; Icon: React.ComponentType<{ size?: number }> }> = [
  { id: "rectangle", label: "Rectángulo", Icon: Square },
  { id: "rounded", label: "Rectángulo redondeado", Icon: RectangleHorizontal },
  { id: "circle", label: "Elipse", Icon: Circle },
  { id: "triangle", label: "Triángulo", Icon: Triangle },
  { id: "diamond", label: "Rombo", Icon: Diamond },
  { id: "star", label: "Estrella", Icon: Star },
  { id: "arrow-right", label: "Flecha", Icon: ArrowRight },
  { id: "callout", label: "Bocadillo", Icon: MessageSquare },
];

const PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#efefef", "#f8f9fa", "#ffffff",
  "#b31412", "#ea4335", "#e37400", "#fbbc04", "#34a853", "#00acc1", "#1a73e8", "#0b3d91",
  "#9334e6", "#d01884", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3",
  "#d9d2e9", "#ead1dc", "#6f4e37", "#e08e45", "#fef7e0", "#1e140f", "#202124", "#188038",
];

type DropdownId = "layout" | "zoom" | "shape" | "font" | "color" | "fill" | "theme";

const ToolButton: React.FC<{
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, active, disabled, children }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`p-1.5 rounded-full transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${
      active ? "bg-[#d3e3fd] text-[#041e49]" : "text-[#444746] hover:bg-gray-200/70"
    }`}
  >
    {children}
  </button>
);

const Separator = () => <div className="h-4 w-px bg-gray-300 mx-0.5 shrink-0" />;

export const GoogleSlidesToolbar: React.FC<GoogleSlidesToolbarProps> = ({
  selected,
  theme,
  themes,
  zoom,
  onZoomChange,
  onUndo,
  onRedo,
  onPrint,
  painterActive,
  onTogglePainter,
  onAddSlide,
  onDeselect,
  onAddText,
  onPickImage,
  onAddShape,
  onAddLine,
  onAddTable,
  onFocusNotes,
  onStyle,
  onArrange,
  onDelete,
  onSelectTheme,
  onOpenCommandSearch,
  notesVisible,
  onToggleNotes,
}) => {
  const [open, setOpen] = useState<DropdownId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = (id: DropdownId) => setOpen((current) => (current === id ? null : id));
  const apply = (patch: Partial<SlideElement>) => {
    setOpen(null);
    onStyle(patch);
  };

  const hasText = Boolean(selected && (TEXT_TYPES.includes(selected.type) || selected.type === "table"));
  const canFill = Boolean(selected && selected.type !== "image" && selected.type !== "video" && selected.type !== "line");
  const fontSize = selected?.fontSize || (selected?.type === "title" ? 40 : 20);
  const isBold = selected ? (selected.fontWeight || (selected.type === "title" ? "bold" : "normal")) === "bold" : false;
  const align = selected?.align || "center";
  const valign = selected?.valign || "middle";

  const dropdownClass = "absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50";
  const optionClass = (isSelected: boolean) =>
    `w-full text-left px-3 py-1.5 text-xs hover:bg-[#f0f4f9] flex items-center justify-between gap-4 ${
      isSelected ? "text-[#0b57d0] font-semibold" : "text-[#444746]"
    }`;

  const colorGrid = (onPick: (color: string) => void, clearLabel: string, onClear: () => void) => (
    <div className={`${dropdownClass} p-2 w-[196px]`}>
      <div className="grid grid-cols-8 gap-1">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onPick(color)}
            style={{ backgroundColor: color }}
            className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-[11px] text-[#444746]">
        <button type="button" onClick={onClear} className="hover:text-[#0b57d0]">
          {clearLabel}
        </button>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span>Otro</span>
          <input type="color" onChange={(e) => onPick(e.target.value)} className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer" />
        </label>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="w-full px-4 py-1 flex items-center justify-between select-none bg-white print:hidden">
      <div className="bg-[#edf2fa] rounded-full px-3 py-1 flex items-center gap-1 shadow-xs text-[#444746] text-xs flex-wrap max-w-full">
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs shadow-xs cursor-pointer mr-1"
          title="Buscar en los menús (Alt+/)"
        >
          <Search size={14} />
          <span className="font-medium text-[11px]">Menús</span>
        </button>

        {/* Nueva diapositiva */}
        <div className="relative flex items-center">
          <ToolButton title="Nueva diapositiva (Ctrl+M)" onClick={() => onAddSlide("title-content")}>
            <Plus size={15} />
          </ToolButton>
          <button
            type="button"
            title="Nueva diapositiva con diseño"
            onClick={() => toggle("layout")}
            className="p-1 rounded-full hover:bg-gray-200/70"
          >
            <ChevronDown size={11} />
          </button>
          {open === "layout" && (
            <div className={`${dropdownClass} min-w-[200px]`}>
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    onAddSlide(layout.id);
                  }}
                  className={optionClass(false)}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolButton title="Deshacer (Ctrl+Z)" onClick={onUndo}>
          <Undo2 size={15} />
        </ToolButton>
        <ToolButton title="Rehacer (Ctrl+Y)" onClick={onRedo}>
          <Redo2 size={15} />
        </ToolButton>
        <ToolButton title="Imprimir (Ctrl+P)" onClick={onPrint}>
          <Printer size={15} />
        </ToolButton>
        <ToolButton
          title="Copiar formato: selecciona un elemento, pulsa y después haz clic en el de destino"
          onClick={onTogglePainter}
          active={painterActive}
          disabled={!selected && !painterActive}
        >
          <Paintbrush size={15} />
        </ToolButton>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggle("zoom")}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium cursor-pointer"
            title="Zoom"
          >
            <span>{zoom === "fit" ? "Ajustar" : `${zoom}%`}</span>
            <ChevronDown size={12} />
          </button>
          {open === "zoom" && (
            <div className={`${dropdownClass} min-w-[110px]`}>
              {(["fit", 50, 75, 100, 125, 150, 200] as Array<number | "fit">).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onZoomChange(value);
                    setOpen(null);
                  }}
                  className={optionClass(zoom === value)}
                >
                  <span>{value === "fit" ? "Ajustar" : `${value}%`}</span>
                  {zoom === value && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <ToolButton title="Seleccionar: quitar la selección actual (Esc)" onClick={onDeselect} active={!selected}>
          <MousePointer2 size={15} />
        </ToolButton>
        <ToolButton title="Cuadro de texto" onClick={onAddText}>
          <Type size={15} />
        </ToolButton>
        <ToolButton title="Insertar imagen" onClick={onPickImage}>
          <ImageIcon size={15} />
        </ToolButton>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggle("shape")}
            className="p-1.5 rounded-full hover:bg-gray-200/70 transition-colors flex items-center gap-0.5"
            title="Forma"
          >
            <Shapes size={15} />
            <ChevronDown size={11} />
          </button>
          {open === "shape" && (
            <div className={`${dropdownClass} p-1.5 grid grid-cols-4 gap-1 w-[160px]`}>
              {SHAPES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => {
                    setOpen(null);
                    onAddShape(id);
                  }}
                  className="p-2 rounded hover:bg-[#e8f0fe] text-[#444746] hover:text-[#0b57d0] flex items-center justify-center"
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolButton title="Línea" onClick={onAddLine}>
          <Minus size={15} />
        </ToolButton>
        <ToolButton title="Insertar tabla" onClick={onAddTable}>
          <Table size={15} />
        </ToolButton>
        <ToolButton title="Notas del orador" onClick={onFocusNotes}>
          <StickyNote size={15} />
        </ToolButton>

        {/* Formato del elemento seleccionado */}
        {selected && (
          <>
            <Separator />
            {hasText && (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggle("font")}
                    className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium cursor-pointer w-[104px]"
                    title="Fuente"
                  >
                    <span className="truncate">{selected.fontFamily || theme.fontFamily}</span>
                    <ChevronDown size={12} className="shrink-0" />
                  </button>
                  {open === "font" && (
                    <div className={`${dropdownClass} min-w-[180px]`}>
                      {FONTS.map((font) => (
                        <button
                          key={font}
                          type="button"
                          onClick={() => apply({ fontFamily: font })}
                          style={{ fontFamily: font }}
                          className={optionClass((selected.fontFamily || theme.fontFamily) === font)}
                        >
                          {font}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center">
                  <ToolButton title="Reducir tamaño" onClick={() => onStyle({ fontSize: Math.max(8, fontSize - 2) })}>
                    <Minus size={12} />
                  </ToolButton>
                  <input
                    type="number"
                    title="Tamaño de fuente"
                    min={8}
                    max={200}
                    value={fontSize}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (value >= 8 && value <= 200) onStyle({ fontSize: value });
                    }}
                    className="w-10 text-center text-xs font-medium text-[#1f1f1f] bg-transparent border border-[#c4c7c5] rounded py-0.5 outline-none focus:border-[#0b57d0] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <ToolButton title="Aumentar tamaño" onClick={() => onStyle({ fontSize: Math.min(200, fontSize + 2) })}>
                    <Plus size={12} />
                  </ToolButton>
                </div>

                <ToolButton title="Negrita (Ctrl+B)" active={isBold} onClick={() => onStyle({ fontWeight: isBold ? "normal" : "bold" })}>
                  <Bold size={15} />
                </ToolButton>
                <ToolButton
                  title="Cursiva (Ctrl+I)"
                  active={selected.fontStyle === "italic"}
                  onClick={() => onStyle({ fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}
                >
                  <Italic size={15} />
                </ToolButton>
                <ToolButton title="Subrayado (Ctrl+U)" active={Boolean(selected.underline)} onClick={() => onStyle({ underline: !selected.underline })}>
                  <Underline size={15} />
                </ToolButton>

                <div className="relative">
                  <ToolButton title="Color del texto" onClick={() => toggle("color")}>
                    <span className="flex flex-col items-center w-[15px]">
                      <span className="font-bold text-xs leading-none">A</span>
                      <span className="w-3.5 h-[3px] rounded-full mt-0.5" style={{ backgroundColor: selected.color || theme.textColor }} />
                    </span>
                  </ToolButton>
                  {open === "color" && colorGrid((color) => apply({ color }), "Color del tema", () => apply({ color: undefined }))}
                </div>
              </>
            )}

            {selected.type === "line" && (
              <div className="relative">
                <ToolButton title="Color de la línea" onClick={() => toggle("color")}>
                  <Palette size={15} />
                </ToolButton>
                {open === "color" && colorGrid((color) => apply({ color }), "Color del tema", () => apply({ color: undefined }))}
              </div>
            )}

            {canFill && (
              <div className="relative">
                <ToolButton title="Color de relleno" onClick={() => toggle("fill")}>
                  <span className="flex flex-col items-center w-[15px]">
                    <PaintBucket size={13} />
                    <span className="w-3.5 h-[3px] rounded-full mt-px border border-black/10" style={{ backgroundColor: selected.bg || "#ffffff" }} />
                  </span>
                </ToolButton>
                {open === "fill" &&
                  colorGrid(
                    (bg) => apply({ bg }),
                    selected.type === "shape" ? "Color del tema" : "Sin relleno",
                    () => apply({ bg: undefined })
                  )}
              </div>
            )}

            {hasText && selected.type !== "table" && (
              <>
                {(
                  [
                    ["left", "Alinear a la izquierda", AlignLeft],
                    ["center", "Centrar", AlignCenter],
                    ["right", "Alinear a la derecha", AlignRight],
                  ] as const
                ).map(([value, title, Icon]) => (
                  <ToolButton key={value} title={title} active={align === value} onClick={() => onStyle({ align: value })}>
                    <Icon size={15} />
                  </ToolButton>
                ))}
                {(
                  [
                    ["top", "Texto arriba", AlignVerticalJustifyStart],
                    ["middle", "Texto en el centro", AlignVerticalJustifyCenter],
                    ["bottom", "Texto abajo", AlignVerticalJustifyEnd],
                  ] as const
                ).map(([value, title, Icon]) => (
                  <ToolButton key={value} title={title} active={valign === value} onClick={() => onStyle({ valign: value })}>
                    <Icon size={15} />
                  </ToolButton>
                ))}
              </>
            )}

            <ToolButton title="Traer al frente" onClick={() => onArrange("front")}>
              <BringToFront size={15} />
            </ToolButton>
            <ToolButton title="Enviar al fondo" onClick={() => onArrange("back")}>
              <SendToBack size={15} />
            </ToolButton>
            <ToolButton title="Eliminar el elemento (Supr)" onClick={onDelete}>
              <Trash2 size={15} />
            </ToolButton>
          </>
        )}

        <Separator />

        {/* Tema de la presentación */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggle("theme")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-xs font-medium cursor-pointer"
            title="Tema de la presentación"
          >
            <span>Tema</span>
            <ChevronDown size={12} />
          </button>
          {open === "theme" && (
            <div className={`${dropdownClass} left-auto right-0 p-2 w-[250px] grid grid-cols-2 gap-2`}>
              {themes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOpen(null);
                    onSelectTheme(item.id);
                  }}
                  className={`rounded-lg border-2 overflow-hidden text-left ${
                    item.id === theme.id ? "border-[#1a73e8]" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <div className="h-14 px-2 py-1.5 flex flex-col justify-center" style={{ backgroundColor: item.slideBg, fontFamily: item.fontFamily }}>
                    <span className="text-[11px] font-bold leading-tight" style={{ color: item.titleColor }}>
                      Título
                    </span>
                    <span className="text-[9px]" style={{ color: item.textColor }}>
                      Texto de ejemplo
                    </span>
                    <span className="w-8 h-1 rounded-full mt-1" style={{ backgroundColor: item.accentColor }} />
                  </div>
                  <div className="px-2 py-1 text-[10px] text-[#444746] bg-white border-t border-gray-200 truncate">{item.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleNotes}
        className="p-1.5 rounded-full hover:bg-gray-100 text-[#444746] transition-colors shrink-0 ml-2"
        title={notesVisible ? "Ocultar las notas del orador" : "Mostrar las notas del orador"}
      >
        {notesVisible ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
    </div>
  );
};
