import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Undo2,
  Redo2,
  Printer,
  SpellCheck,
  Paintbrush,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Link,
  MessageSquarePlus,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentDecrease,
  IndentIncrease,
  RemoveFormatting,
  Pencil,
  Eye,
  Check,
  Table,
} from "lucide-react";
import type { FormatState } from "../types";
import { applyFontSize, exec } from "../services/editor";

interface GoogleDocsToolbarProps {
  format: FormatState;
  readOnly: boolean;
  onSetReadOnly: (readOnly: boolean) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  lineSpacing: string;
  onSetLineSpacing: (spacing: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPrint: () => void;
  spellcheck: boolean;
  onToggleSpellcheck: () => void;
  painterActive: boolean;
  onTogglePainter: () => void;
  onOpenCommandSearch: () => void;
  onInsertLink: () => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onAddComment: () => void;
  compact: boolean;
  onToggleCompact: () => void;
}

const FONTS = [
  "Arial",
  "Calibri",
  "Cambria",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
  "Hanken Grotesk",
  "JetBrains Mono",
];

const BLOCK_STYLES: Array<{ tag: string; label: string; className: string }> = [
  { tag: "p", label: "Texto normal", className: "text-xs" },
  { tag: "h1", label: "Título 1", className: "text-lg font-bold" },
  { tag: "h2", label: "Título 2", className: "text-base font-bold" },
  { tag: "h3", label: "Título 3", className: "text-sm font-bold text-[#434343]" },
  { tag: "blockquote", label: "Cita", className: "text-xs italic text-[#5f6368]" },
  { tag: "pre", label: "Código", className: "text-xs font-mono" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

export const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#efefef", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff",
  "#9900ff", "#ff00ff", "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3",
  "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc", "#a61c00", "#cc0000", "#e69138", "#f1c232",
  "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79", "#5b0f00", "#660000",
  "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130",
];

const HIGHLIGHT_COLORS = [
  "#fff59d", "#ffe082", "#ffccbc", "#f8bbd0", "#e1bee7", "#c5cae9", "#b3e5fc", "#b2dfdb",
  "#c8e6c9", "#dcedc8", "#f0f4c3", "#d7ccc8", "#ffffff", "#eeeeee", "#bdbdbd", "#fdd835",
];

type DropdownId = "zoom" | "style" | "font" | "size" | "color" | "highlight" | "align" | "spacing" | "mode";

/** Botón de la barra que no roba el foco al editor. */
const ToolButton: React.FC<{
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ title, onClick, active, disabled, children, className = "" }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`p-1.5 rounded-full transition-colors disabled:opacity-35 disabled:hover:bg-transparent ${
      active ? "bg-[#d3e3fd] text-[#041e49]" : "text-[#444746] hover:bg-gray-200/70"
    } ${className}`}
  >
    {children}
  </button>
);

const Separator = () => <div className="h-4 w-px bg-gray-300 mx-0.5 shrink-0" />;

export const GoogleDocsToolbar: React.FC<GoogleDocsToolbarProps> = ({
  format,
  readOnly,
  onSetReadOnly,
  zoom,
  onZoomChange,
  lineSpacing,
  onSetLineSpacing,
  onUndo,
  onRedo,
  onPrint,
  spellcheck,
  onToggleSpellcheck,
  painterActive,
  onTogglePainter,
  onOpenCommandSearch,
  onInsertLink,
  onInsertImage,
  onInsertTable,
  onAddComment,
  compact,
  onToggleCompact,
}) => {
  const [open, setOpen] = useState<DropdownId | null>(null);
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const [lastHighlight, setLastHighlight] = useState("#fff59d");
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
  const run = (command: string, value?: string) => {
    setOpen(null);
    exec(command, value);
  };

  const setFontSize = (points: number) => {
    const clamped = Math.max(6, Math.min(400, Math.round(points * 2) / 2));
    setSizeDraft(null);
    setOpen(null);
    applyFontSize(clamped);
  };

  const blockLabel = BLOCK_STYLES.find((s) => s.tag === format.block)?.label || "Texto normal";
  const AlignIcon =
    format.align === "center"
      ? AlignCenter
      : format.align === "right"
      ? AlignRight
      : format.align === "justify"
      ? AlignJustify
      : AlignLeft;

  const dropdownClass =
    "absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50";
  const optionClass = (selected: boolean) =>
    `w-full text-left px-3 py-1.5 hover:bg-[#f0f4f9] flex items-center justify-between gap-3 ${
      selected ? "text-[#0b57d0]" : "text-[#444746]"
    }`;

  return (
    <div
      ref={rootRef}
      className="w-full px-4 py-1 flex items-center justify-between select-none bg-white print:hidden"
    >
      <div
        className="bg-[#edf2fa] rounded-full px-3 py-1 flex items-center gap-1 shadow-xs text-[#444746] text-xs flex-wrap max-w-full"
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onOpenCommandSearch}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs text-[#444746] shadow-xs cursor-pointer mr-1"
          title="Buscar en los menús (Alt+/)"
        >
          <Search size={14} className="text-[#444746]" />
          <span className="font-medium text-[11px]">Menús</span>
        </button>

        <ToolButton title="Deshacer (Ctrl+Z)" onClick={onUndo} disabled={readOnly}>
          <Undo2 size={15} />
        </ToolButton>
        <ToolButton title="Rehacer (Ctrl+Y)" onClick={onRedo} disabled={readOnly}>
          <Redo2 size={15} />
        </ToolButton>
        <ToolButton title="Imprimir (Ctrl+P)" onClick={onPrint}>
          <Printer size={15} />
        </ToolButton>
        <ToolButton
          title={spellcheck ? "Desactivar el corrector ortográfico" : "Activar el corrector ortográfico"}
          onClick={onToggleSpellcheck}
          active={spellcheck}
        >
          <SpellCheck size={15} />
        </ToolButton>
        <ToolButton
          title="Copiar formato: pulsa y después selecciona el texto de destino"
          onClick={onTogglePainter}
          active={painterActive}
          disabled={readOnly}
        >
          <Paintbrush size={15} />
        </ToolButton>

        {/* Zoom */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("zoom")}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer"
            title="Zoom"
          >
            <span>{zoom}%</span>
            <ChevronDown size={12} />
          </button>
          {open === "zoom" && (
            <div className={`${dropdownClass} min-w-[90px]`}>
              {[50, 75, 90, 100, 125, 150, 200].map((z) => (
                <button
                  key={z}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onZoomChange(z);
                    setOpen(null);
                  }}
                  className={`${optionClass(zoom === z)} text-xs py-1`}
                >
                  <span>{z}%</span>
                  {zoom === z && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Estilo de párrafo */}
        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("style")}
            className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer w-[112px] disabled:opacity-35"
            title="Estilo de párrafo"
          >
            <span className="truncate">{blockLabel}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>
          {open === "style" && (
            <div className={`${dropdownClass} min-w-[190px]`}>
              {BLOCK_STYLES.map((style) => (
                <button
                  key={style.tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run("formatBlock", `<${style.tag}>`)}
                  className={optionClass(format.block === style.tag)}
                >
                  <span className={style.className}>{style.label}</span>
                  {format.block === style.tag && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fuente */}
        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("font")}
            className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-full hover:bg-gray-200/70 text-[#444746] text-xs font-medium cursor-pointer w-[104px] disabled:opacity-35"
            title="Fuente"
          >
            <span className="truncate">{format.fontFamily || "Arial"}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>
          {open === "font" && (
            <div className={`${dropdownClass} min-w-[180px] max-h-72 overflow-y-auto`}>
              {FONTS.map((font) => (
                <button
                  key={font}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run("fontName", font)}
                  style={{ fontFamily: font }}
                  className={`${optionClass(format.fontFamily === font)} text-xs`}
                >
                  <span>{font}</span>
                  {format.fontFamily === font && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Tamaño de fuente */}
        <div className="flex items-center relative">
          <ToolButton
            title="Reducir tamaño de fuente"
            disabled={readOnly}
            onClick={() => setFontSize(format.fontSize - 1)}
            className="!p-1"
          >
            <Minus size={12} />
          </ToolButton>
          <input
            type="text"
            inputMode="decimal"
            disabled={readOnly}
            title="Tamaño de fuente"
            value={sizeDraft ?? String(format.fontSize)}
            onFocus={() => setOpen("size")}
            onChange={(e) => setSizeDraft(e.target.value.replace(/[^\d.,]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const value = Number((sizeDraft ?? "").replace(",", "."));
                if (value > 0) setFontSize(value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={() => setSizeDraft(null)}
            className="w-8 text-center text-xs font-medium text-[#1f1f1f] bg-transparent border border-[#c4c7c5] rounded px-0.5 py-0.5 outline-none focus:border-[#0b57d0] disabled:opacity-35"
          />
          <ToolButton
            title="Aumentar tamaño de fuente"
            disabled={readOnly}
            onClick={() => setFontSize(format.fontSize + 1)}
            className="!p-1"
          >
            <Plus size={12} />
          </ToolButton>
          {open === "size" && (
            <div className={`${dropdownClass} left-5 min-w-[56px] max-h-64 overflow-y-auto`}>
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFontSize(size)}
                  className={`${optionClass(format.fontSize === size)} text-xs py-1 justify-center`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <ToolButton title="Negrita (Ctrl+B)" onClick={() => run("bold")} active={format.bold} disabled={readOnly}>
          <Bold size={15} />
        </ToolButton>
        <ToolButton title="Cursiva (Ctrl+I)" onClick={() => run("italic")} active={format.italic} disabled={readOnly}>
          <Italic size={15} />
        </ToolButton>
        <ToolButton title="Subrayado (Ctrl+U)" onClick={() => run("underline")} active={format.underline} disabled={readOnly}>
          <Underline size={15} />
        </ToolButton>
        <ToolButton
          title="Tachado"
          onClick={() => run("strikeThrough")}
          active={format.strikethrough}
          disabled={readOnly}
        >
          <Strikethrough size={15} />
        </ToolButton>

        {/* Color de texto */}
        <div className="relative">
          <ToolButton title="Color del texto" onClick={() => toggle("color")} disabled={readOnly}>
            <span className="flex flex-col items-center w-[15px]">
              <span className="font-bold text-xs leading-none">A</span>
              <span className="w-3.5 h-[3px] rounded-full mt-0.5" style={{ backgroundColor: format.textColor }} />
            </span>
          </ToolButton>
          {open === "color" && (
            <div className={`${dropdownClass} p-2 w-[196px]`}>
              <div className="grid grid-cols-8 gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run("foreColor", color)}
                    style={{ backgroundColor: color }}
                    className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 text-[11px] text-[#444746] cursor-pointer">
                <input
                  type="color"
                  defaultValue={format.textColor.startsWith("#") ? format.textColor : "#000000"}
                  onChange={(e) => exec("foreColor", e.target.value)}
                  className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
                />
                <span>Color personalizado</span>
              </label>
            </div>
          )}
        </div>

        {/* Resaltado */}
        <div className="relative">
          <ToolButton title="Color de resaltado" onClick={() => toggle("highlight")} disabled={readOnly}>
            <span className="flex flex-col items-center w-[15px]">
              <Highlighter size={13} />
              <span className="w-3.5 h-[3px] rounded-full mt-px" style={{ backgroundColor: lastHighlight }} />
            </span>
          </ToolButton>
          {open === "highlight" && (
            <div className={`${dropdownClass} p-2 w-[196px]`}>
              <div className="grid grid-cols-8 gap-1">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLastHighlight(color);
                      run("hiliteColor", color);
                    }}
                    style={{ backgroundColor: color }}
                    className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                  />
                ))}
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run("hiliteColor", "transparent")}
                className="w-full mt-2 pt-2 border-t border-gray-200 text-[11px] text-left text-[#444746] hover:text-[#0b57d0]"
              >
                Sin resaltado
              </button>
            </div>
          )}
        </div>

        <Separator />

        <ToolButton title="Insertar enlace (Ctrl+K)" onClick={onInsertLink} disabled={readOnly}>
          <Link size={15} />
        </ToolButton>
        <ToolButton title="Añadir comentario a la selección" onClick={onAddComment} disabled={readOnly}>
          <MessageSquarePlus size={15} />
        </ToolButton>
        <ToolButton title="Insertar imagen" onClick={onInsertImage} disabled={readOnly}>
          <ImageIcon size={15} />
        </ToolButton>
        <ToolButton title="Insertar tabla" onClick={onInsertTable} disabled={readOnly}>
          <Table size={15} />
        </ToolButton>

        <Separator />

        {/* Alineación */}
        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("align")}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5 disabled:opacity-35"
            title="Alinear"
          >
            <AlignIcon size={15} />
            <ChevronDown size={11} />
          </button>
          {open === "align" && (
            <div className={`${dropdownClass} !p-1 flex items-center gap-1`}>
              {(
                [
                  ["justifyLeft", "left", "Alinear a la izquierda", AlignLeft],
                  ["justifyCenter", "center", "Centrar", AlignCenter],
                  ["justifyRight", "right", "Alinear a la derecha", AlignRight],
                  ["justifyFull", "justify", "Justificar", AlignJustify],
                ] as const
              ).map(([command, value, title, Icon]) => (
                <ToolButton
                  key={command}
                  title={title}
                  active={format.align === value}
                  onClick={() => run(command)}
                  className="!rounded"
                >
                  <Icon size={14} />
                </ToolButton>
              ))}
            </div>
          )}
        </div>

        {/* Interlineado */}
        <div className="relative">
          <button
            type="button"
            disabled={readOnly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggle("spacing")}
            className="p-1.5 rounded-full hover:bg-gray-200/70 text-[#444746] transition-colors flex items-center gap-0.5 disabled:opacity-35"
            title="Interlineado del documento"
          >
            <span className="text-[11px] font-mono font-medium">{lineSpacing}</span>
            <ChevronDown size={11} />
          </button>
          {open === "spacing" && (
            <div className={`${dropdownClass} min-w-[120px]`}>
              {[
                ["1.0", "Sencillo"],
                ["1.15", "1,15"],
                ["1.5", "1,5"],
                ["2.0", "Doble"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSetLineSpacing(value);
                    setOpen(null);
                  }}
                  className={`${optionClass(lineSpacing === value)} text-xs py-1`}
                >
                  <span>{label}</span>
                  {lineSpacing === value && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <ToolButton
          title="Lista con viñetas"
          onClick={() => run("insertUnorderedList")}
          active={format.unorderedList}
          disabled={readOnly}
        >
          <List size={15} />
        </ToolButton>
        <ToolButton
          title="Lista numerada"
          onClick={() => run("insertOrderedList")}
          active={format.orderedList}
          disabled={readOnly}
        >
          <ListOrdered size={15} />
        </ToolButton>
        <ToolButton title="Reducir sangría" onClick={() => run("outdent")} disabled={readOnly}>
          <IndentDecrease size={15} />
        </ToolButton>
        <ToolButton title="Aumentar sangría" onClick={() => run("indent")} disabled={readOnly}>
          <IndentIncrease size={15} />
        </ToolButton>
        <ToolButton
          title="Borrar formato"
          disabled={readOnly}
          onClick={() => {
            run("removeFormat");
            exec("formatBlock", "<p>");
          }}
        >
          <RemoveFormatting size={15} />
        </ToolButton>
      </div>

      {/* Modo de edición y vista compacta */}
      <div className="flex items-center gap-1 shrink-0 ml-2 relative">
        <button
          type="button"
          onClick={() => setOpen((current) => (current === "mode" ? null : "mode"))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#edf2fa] text-[#444746] font-medium text-xs transition-colors"
          title="Modo del documento"
        >
          {readOnly ? (
            <Eye size={14} className="text-[#1a73e8]" />
          ) : (
            <Pencil size={14} className="text-[#1a73e8]" />
          )}
          <span>{readOnly ? "Lectura" : "Edición"}</span>
          <ChevronDown size={12} />
        </button>
        {open === "mode" && (
          <div className="absolute right-8 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[230px]">
            {[
              { value: false, label: "Edición", hint: "Modificar el documento", Icon: Pencil },
              { value: true, label: "Lectura", hint: "Ver sin riesgo de cambios", Icon: Eye },
            ].map(({ value, label, hint, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onSetReadOnly(value);
                  setOpen(null);
                }}
                className={`${optionClass(readOnly === value)} text-xs`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} />
                  <span className="flex flex-col">
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] text-[#747775]">{hint}</span>
                  </span>
                </span>
                {readOnly === value && <Check size={12} />}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCompact}
          className="p-1.5 rounded-full hover:bg-gray-100 text-[#444746] transition-colors"
          title={compact ? "Mostrar la regla y el esquema" : "Vista compacta: ocultar la regla y el esquema"}
        >
          {compact ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
    </div>
  );
};
