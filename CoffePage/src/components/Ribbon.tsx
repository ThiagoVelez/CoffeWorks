// Cinta de opciones de CoffePage: Inicio, Insertar, Dibujar y Ver.
// Los botones de formato no roban el foco (onMouseDown con preventDefault)
// para que el texto seleccionado siga seleccionado.

import React, { useState } from "react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
  Highlighter,
  Baseline,
  SquareCheck,
  Star,
  HelpCircle,
  Lightbulb,
  Image as ImageIcon,
  Table,
  CalendarClock,
  Link2,
  Minus,
  Pen,
  MousePointer2,
  Type,
  ZoomIn,
  ZoomOut,
  Search,
  Subscript,
  Superscript,
  IndentIncrease,
  IndentDecrease,
  RemoveFormatting,
  Heading1,
  Heading2,
  Pilcrow,
  Paperclip,
} from "lucide-react";
import type { InkStyle, PaperStyle, Tool } from "../types";

export type TagKind = "todo" | "important" | "question" | "idea";

interface RibbonProps {
  accent: string;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  ink: InkStyle;
  onInkChange: (patch: Partial<InkStyle>) => void;
  paper: PaperStyle;
  onPaperChange: (paper: PaperStyle) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExec: (command: string, value?: string) => void;
  onFontSize: (px: number) => void;
  onBlockStyle: (tag: "p" | "h1" | "h2") => void;
  onTag: (tag: TagKind) => void;
  onInsertImage: () => void;
  onInsertFile: () => void;
  onInsertTable: () => void;
  onInsertDate: () => void;
  onInsertLink: () => void;
  onOpenSearch: () => void;
  onOpenCommands: () => void;
}

type TabId = "home" | "insert" | "draw" | "view";

const FONTS = ["Hanken Grotesk", "Calibri", "Arial", "Georgia", "Times New Roman", "Verdana", "Courier New", "Comic Sans MS"];
const SIZES = [10, 11, 12, 14, 15, 16, 18, 20, 24, 28, 32, 40];
const TEXT_COLORS = ["#1f1f1f", "#7b1fa2", "#1565c0", "#2e7d32", "#c62828", "#ef6c00", "#6d4c41", "#757575"];
const HIGHLIGHTS = ["#fff59d", "#a5d6a7", "#81d4fa", "#f48fb1", "#ffcc80", "#e1bee7"];
const PEN_COLORS = ["#1f1f1f", "#7b1fa2", "#1565c0", "#2e7d32", "#c62828", "#ef6c00"];
const HL_COLORS = ["#ffeb3b", "#76ff03", "#00e5ff", "#ff4081", "#ff9100"];

const keep = (e: React.MouseEvent) => e.preventDefault();

const Btn: React.FC<{
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  accent: string;
  children: React.ReactNode;
  label?: string;
}> = ({ title, onClick, active, disabled, accent, children, label }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={keep}
    onClick={onClick}
    className={`h-8 ${label ? "px-2 gap-1.5" : "w-8"} flex items-center justify-center rounded-md text-[12px] transition-colors disabled:opacity-35 ${
      active ? "text-white" : "text-[#3c3c3c] hover:bg-[#f1e8f6]"
    }`}
    style={active ? { background: accent } : undefined}
  >
    {children}
    {label && <span className="font-medium">{label}</span>}
  </button>
);

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col items-center px-2 border-r border-[#ede6f2] last:border-r-0">
    <div className="flex items-center gap-0.5 h-9">{children}</div>
    <span className="text-[10px] text-[#8a7f92] leading-none pb-0.5">{label}</span>
  </div>
);

const Swatches: React.FC<{ colors: string[]; value?: string; onPick: (c: string) => void; title: string }> = ({ colors, value, onPick, title }) => (
  <div className="flex items-center gap-1 px-1" title={title}>
    {colors.map((c) => (
      <button
        key={c}
        type="button"
        onMouseDown={keep}
        onClick={() => onPick(c)}
        className={`w-4 h-4 rounded-full border ${value === c ? "ring-2 ring-offset-1 ring-[#7b1fa2] border-white" : "border-black/15"}`}
        style={{ background: c }}
        title={c}
      />
    ))}
  </div>
);

/** Paleta desplegable (color de texto y resaltado). */
const ColorDrop: React.FC<{ title: string; icon: React.ReactNode; colors: string[]; onPick: (c: string) => void; extra?: React.ReactNode }> = ({
  title,
  icon,
  colors,
  onPick,
  extra,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title={title}
        onMouseDown={keep}
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-9 flex items-center justify-center rounded-md text-[#3c3c3c] hover:bg-[#f1e8f6]"
      >
        {icon}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={keep} onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-9 left-0 bg-white border rounded-lg shadow-xl p-2 flex flex-wrap gap-1.5 w-[132px]">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={keep}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                className="w-6 h-6 rounded border border-black/10"
                style={{ background: c }}
                title={c}
              />
            ))}
            {extra && (
              <div className="w-full pt-1" onClick={() => setOpen(false)}>
                {extra}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const Ribbon: React.FC<RibbonProps> = (props) => {
  const { accent, tool, onToolChange, ink, onInkChange, onExec } = props;
  const [tab, setTab] = useState<TabId>("home");
  const tabs: { id: TabId; label: string }[] = [
    { id: "home", label: "Inicio" },
    { id: "insert", label: "Insertar" },
    { id: "draw", label: "Dibujar" },
    { id: "view", label: "Ver" },
  ];

  const selectClass =
    "h-7 text-[12px] border border-[#ddd3e4] rounded-md px-1.5 bg-white text-[#1f1f1f] outline-none focus:border-[#7b1fa2]";

  return (
    <div data-ribbon className="bg-white border-b border-[#e8e0ee] select-none shrink-0">
      <div className="flex items-center gap-1 px-3 pt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onMouseDown={keep}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1 text-[13px] border-b-2 transition-colors ${
              tab === t.id ? "font-semibold" : "border-transparent text-[#5f5f5f] hover:text-[#1f1f1f]"
            }`}
            style={tab === t.id ? { borderColor: accent, color: accent } : undefined}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={props.onOpenSearch}
          className="flex items-center gap-1.5 text-[12px] text-[#5f5f5f] hover:text-[#1f1f1f] px-2 py-1 rounded hover:bg-[#f7f1fa]"
          title="Buscar en el cuaderno (Ctrl+F)"
        >
          <Search size={14} /> Buscar
        </button>
        <button
          type="button"
          onClick={props.onOpenCommands}
          className="text-[12px] text-[#5f5f5f] hover:text-[#1f1f1f] px-2 py-1 rounded hover:bg-[#f7f1fa]"
          title="Buscar un comando (Alt+/)"
        >
          Comandos
        </button>
      </div>

      <div className="flex items-stretch px-2 pb-1 pt-0.5 overflow-x-auto">
        <Group label="Deshacer">
          <Btn accent={accent} title="Deshacer (Ctrl+Z)" onClick={props.onUndo} disabled={!props.canUndo}>
            <Undo2 size={16} />
          </Btn>
          <Btn accent={accent} title="Rehacer (Ctrl+Y)" onClick={props.onRedo} disabled={!props.canRedo}>
            <Redo2 size={16} />
          </Btn>
        </Group>

        {tab === "home" && (
          <>
            <Group label="Fuente">
              <select
                className={`${selectClass} w-[130px]`}
                defaultValue=""
                title="Fuente"
                onChange={(e) => {
                  if (e.target.value) onExec("fontName", e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Fuente
                </option>
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClass} w-[62px] ml-1`}
                defaultValue=""
                title="Tamaño"
                onChange={(e) => {
                  if (e.target.value) props.onFontSize(Number(e.target.value));
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Tam.
                </option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Group>
            <Group label="Formato">
              <Btn accent={accent} title="Negrita (Ctrl+B)" onClick={() => onExec("bold")}>
                <Bold size={15} />
              </Btn>
              <Btn accent={accent} title="Cursiva (Ctrl+I)" onClick={() => onExec("italic")}>
                <Italic size={15} />
              </Btn>
              <Btn accent={accent} title="Subrayado (Ctrl+U)" onClick={() => onExec("underline")}>
                <Underline size={15} />
              </Btn>
              <Btn accent={accent} title="Tachado" onClick={() => onExec("strikeThrough")}>
                <Strikethrough size={15} />
              </Btn>
              <Btn accent={accent} title="Subíndice" onClick={() => onExec("subscript")}>
                <Subscript size={15} />
              </Btn>
              <Btn accent={accent} title="Superíndice" onClick={() => onExec("superscript")}>
                <Superscript size={15} />
              </Btn>
              <ColorDrop
                title="Color del texto"
                icon={<Baseline size={16} />}
                colors={TEXT_COLORS}
                onPick={(c) => onExec("foreColor", c)}
              />
              <ColorDrop
                title="Color de resaltado"
                icon={<Highlighter size={16} />}
                colors={HIGHLIGHTS}
                onPick={(c) => onExec("hiliteColor", c)}
                extra={
                  <button
                    type="button"
                    onMouseDown={keep}
                    onClick={() => onExec("hiliteColor", "transparent")}
                    className="w-full text-[11px] text-[#5f6368] hover:text-[#1f1f1f] text-left"
                  >
                    Sin resaltado
                  </button>
                }
              />
              <Btn accent={accent} title="Borrar formato" onClick={() => onExec("removeFormat")}>
                <RemoveFormatting size={15} />
              </Btn>
            </Group>
            <Group label="Párrafo">
              <Btn accent={accent} title="Viñetas" onClick={() => onExec("insertUnorderedList")}>
                <List size={16} />
              </Btn>
              <Btn accent={accent} title="Numeración" onClick={() => onExec("insertOrderedList")}>
                <ListOrdered size={16} />
              </Btn>
              <Btn accent={accent} title="Reducir sangría (Mayús+Tab)" onClick={() => onExec("outdent")}>
                <IndentDecrease size={16} />
              </Btn>
              <Btn accent={accent} title="Aumentar sangría (Tab)" onClick={() => onExec("indent")}>
                <IndentIncrease size={16} />
              </Btn>
              <Btn accent={accent} title="Alinear a la izquierda" onClick={() => onExec("justifyLeft")}>
                <AlignLeft size={16} />
              </Btn>
              <Btn accent={accent} title="Centrar" onClick={() => onExec("justifyCenter")}>
                <AlignCenter size={16} />
              </Btn>
              <Btn accent={accent} title="Alinear a la derecha" onClick={() => onExec("justifyRight")}>
                <AlignRight size={16} />
              </Btn>
            </Group>
            <Group label="Estilos">
              <Btn accent={accent} title="Título 1" onClick={() => props.onBlockStyle("h1")}>
                <Heading1 size={16} />
              </Btn>
              <Btn accent={accent} title="Título 2" onClick={() => props.onBlockStyle("h2")}>
                <Heading2 size={16} />
              </Btn>
              <Btn accent={accent} title="Texto normal" onClick={() => props.onBlockStyle("p")}>
                <Pilcrow size={16} />
              </Btn>
            </Group>
            <Group label="Etiquetas">
              <Btn accent={accent} title="Tarea pendiente (Ctrl+1)" onClick={() => props.onTag("todo")} label="Tarea">
                <SquareCheck size={15} />
              </Btn>
              <Btn accent={accent} title="Importante (Ctrl+2)" onClick={() => props.onTag("important")}>
                <Star size={15} className="text-[#f4b400]" />
              </Btn>
              <Btn accent={accent} title="Pregunta (Ctrl+3)" onClick={() => props.onTag("question")}>
                <HelpCircle size={15} className="text-[#7b1fa2]" />
              </Btn>
              <Btn accent={accent} title="Idea (Ctrl+4)" onClick={() => props.onTag("idea")}>
                <Lightbulb size={15} className="text-[#ef6c00]" />
              </Btn>
            </Group>
          </>
        )}

        {tab === "insert" && (
          <>
            <Group label="Insertar">
              <Btn accent={accent} title="Imagen desde un archivo" onClick={props.onInsertImage} label="Imagen">
                <ImageIcon size={16} />
              </Btn>
              <Btn accent={accent} title="Tabla de 3 × 3" onClick={props.onInsertTable} label="Tabla">
                <Table size={16} />
              </Btn>
              <Btn accent={accent} title="Fecha y hora actuales" onClick={props.onInsertDate} label="Fecha y hora">
                <CalendarClock size={16} />
              </Btn>
              <Btn accent={accent} title="Vínculo" onClick={props.onInsertLink} label="Vínculo">
                <Link2 size={16} />
              </Btn>
              <Btn accent={accent} title="Línea horizontal" onClick={() => onExec("insertHorizontalRule")} label="Línea">
                <Minus size={16} />
              </Btn>
              <Btn accent={accent} title="Adjuntar el texto de un archivo (.txt, .md)" onClick={props.onInsertFile} label="Texto de archivo">
                <Paperclip size={16} />
              </Btn>
            </Group>
            <Group label="Etiquetas">
              <Btn accent={accent} title="Tarea pendiente" onClick={() => props.onTag("todo")} label="Lista de tareas">
                <SquareCheck size={15} />
              </Btn>
            </Group>
          </>
        )}

        {tab === "draw" && (
          <>
            <Group label="Herramientas">
              <Btn accent={accent} title="Escribir: haz clic en la página para crear una nota" onClick={() => onToolChange("type")} active={tool === "type"} label="Escribir">
                <Type size={16} />
              </Btn>
              <Btn accent={accent} title="Seleccionar y mover sin crear notas" onClick={() => onToolChange("select")} active={tool === "select"} label="Seleccionar">
                <MousePointer2 size={16} />
              </Btn>
              <Btn accent={accent} title="Bolígrafo" onClick={() => onToolChange("pen")} active={tool === "pen"} label="Bolígrafo">
                <Pen size={16} />
              </Btn>
              <Btn accent={accent} title="Marcador" onClick={() => onToolChange("highlighter")} active={tool === "highlighter"} label="Marcador">
                <Highlighter size={16} />
              </Btn>
              <Btn accent={accent} title="Borrador de trazos" onClick={() => onToolChange("eraser")} active={tool === "eraser"} label="Borrador">
                <Eraser size={16} />
              </Btn>
            </Group>
            <Group label="Bolígrafo">
              <Swatches colors={PEN_COLORS} value={ink.penColor} title="Color del bolígrafo" onPick={(c) => onInkChange({ penColor: c })} />
              <select
                className={`${selectClass} w-[64px]`}
                value={ink.penWidth}
                title="Grosor del bolígrafo"
                onChange={(e) => onInkChange({ penWidth: Number(e.target.value) })}
              >
                {[1.5, 2.5, 4, 6, 9].map((w) => (
                  <option key={w} value={w}>
                    {w} px
                  </option>
                ))}
              </select>
            </Group>
            <Group label="Marcador">
              <Swatches colors={HL_COLORS} value={ink.highlighterColor} title="Color del marcador" onPick={(c) => onInkChange({ highlighterColor: c })} />
              <select
                className={`${selectClass} w-[64px]`}
                value={ink.highlighterWidth}
                title="Grosor del marcador"
                onChange={(e) => onInkChange({ highlighterWidth: Number(e.target.value) })}
              >
                {[10, 16, 24].map((w) => (
                  <option key={w} value={w}>
                    {w} px
                  </option>
                ))}
              </select>
            </Group>
          </>
        )}

        {tab === "view" && (
          <>
            <Group label="Papel">
              {(
                [
                  ["blank", "Liso"],
                  ["lines", "Rayado"],
                  ["grid", "Cuadriculado"],
                ] as [PaperStyle, string][]
              ).map(([id, label]) => (
                <Btn key={id} accent={accent} title={`Papel ${label.toLowerCase()}`} onClick={() => props.onPaperChange(id)} active={props.paper === id} label={label}>
                  <span />
                </Btn>
              ))}
            </Group>
            <Group label="Zoom">
              <Btn accent={accent} title="Alejar (Ctrl+−)" onClick={() => props.onZoom(Math.max(0.5, Math.round((props.zoom - 0.1) * 10) / 10))}>
                <ZoomOut size={16} />
              </Btn>
              <button
                type="button"
                onClick={() => props.onZoom(1)}
                className="h-8 px-2 text-[12px] font-mono text-[#3c3c3c] hover:bg-[#f1e8f6] rounded-md"
                title="Restablecer al 100 % (Ctrl+0)"
              >
                {Math.round(props.zoom * 100)}%
              </button>
              <Btn accent={accent} title="Acercar (Ctrl++)" onClick={() => props.onZoom(Math.min(2, Math.round((props.zoom + 0.1) * 10) / 10))}>
                <ZoomIn size={16} />
              </Btn>
            </Group>
          </>
        )}
      </div>
    </div>
  );
};
