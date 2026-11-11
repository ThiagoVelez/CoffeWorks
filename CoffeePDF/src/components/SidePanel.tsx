import React, { useState } from "react";
import { SlidersHorizontal, Search, ClipboardList, Trash2, Copy, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Highlighter, X } from "lucide-react";
import type { Annotation, FontFamily, FormField, Tool, ToolStyle } from "../types";
import type { TextMatch } from "../services/pdfEngine";

export type PanelTab = "props" | "search" | "form";

interface SidePanelProps {
  tab: PanelTab | null;
  onTabChange: (tab: PanelTab | null) => void;
  tool: Tool;
  style: ToolStyle;
  onStyleChange: (patch: Partial<ToolStyle>) => void;
  selected: Annotation | null;
  onUpdateSelected: (patch: Partial<Annotation>) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  // Búsqueda
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  searching: boolean;
  matches: TextMatch[];
  onGoToMatch: (match: TextMatch) => void;
  onHighlightMatches: () => void;
  onClearSearch: () => void;
  // Formularios
  fields: FormField[];
  formValues: Record<string, string | boolean>;
  onFieldChange: (key: string, value: string | boolean) => void;
  flattenForms: boolean;
  onToggleFlatten: () => void;
}

const COLORS = ["#000000", "#444746", "#c62828", "#e65100", "#f9a825", "#2e7d32", "#1565c0", "#6a1b9a", "#ffffff"];
const HIGHLIGHTS = ["#fff176", "#a5d6a7", "#81d4fa", "#f48fb1", "#ffcc80"];

const TOOL_NAMES: Record<Tool, string> = {
  select: "Seleccionar",
  text: "Texto",
  replace: "Reemplazar texto",
  highlight: "Resaltador",
  whiteout: "Corrector (tapar)",
  rect: "Rectángulo",
  ellipse: "Elipse",
  line: "Línea",
  arrow: "Flecha",
  ink: "Dibujo a mano",
};

const label = "text-[11px] font-semibold text-[#444746] uppercase tracking-wide";

const Swatches: React.FC<{ colors: string[]; value: string | null; onPick: (color: string) => void; allowNone?: boolean; onNone?: () => void }> = ({
  colors,
  value,
  onPick,
  allowNone,
  onNone,
}) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    {allowNone && (
      <button
        type="button"
        title="Sin color"
        onClick={onNone}
        className={`w-6 h-6 rounded-full border bg-white relative overflow-hidden ${value === null ? "ring-2 ring-[#c62828]" : "border-gray-300"}`}
      >
        <span className="absolute left-1/2 top-0 bottom-0 w-px bg-[#c62828] rotate-45" />
      </button>
    )}
    {colors.map((color) => (
      <button
        key={color}
        type="button"
        title={color}
        onClick={() => onPick(color)}
        style={{ backgroundColor: color }}
        className={`w-6 h-6 rounded-full border ${value?.toLowerCase() === color ? "ring-2 ring-[#c62828] ring-offset-1" : "border-gray-300"}`}
      />
    ))}
    <input
      type="color"
      title="Otro color"
      value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
      onChange={(e) => onPick(e.target.value)}
      className="w-7 h-7 p-0.5 border border-gray-300 rounded cursor-pointer bg-white"
    />
  </div>
);

export const SidePanel: React.FC<SidePanelProps> = (props) => {
  const { tab, onTabChange, tool, style, onStyleChange, selected, onUpdateSelected } = props;
  const [fieldFilter, setFieldFilter] = useState("");

  // Lo que se edita: el elemento seleccionado o, si no hay, la herramienta activa
  const kind = selected ? selected.type : tool;
  const isText = kind === "text" || kind === "replace";
  const hasStroke = ["rect", "ellipse", "line", "arrow", "ink"].includes(kind);
  const hasFill = kind === "rect" || kind === "ellipse";
  const isHighlight = kind === "highlight";

  const value = <K extends keyof ToolStyle>(key: K, fromSelected?: unknown): ToolStyle[K] =>
    (selected && fromSelected !== undefined ? fromSelected : style[key]) as ToolStyle[K];

  const set = (patch: Partial<ToolStyle>, annotationPatch?: Partial<Annotation>) => {
    if (selected) onUpdateSelected(annotationPatch ?? (patch as Partial<Annotation>));
    else onStyleChange(patch);
  };

  const color = selected && "color" in selected ? selected.color : isHighlight ? style.highlight : style.color;
  const tabs: Array<{ id: PanelTab; title: string; Icon: React.ComponentType<{ size?: number }> }> = [
    { id: "props", title: "Propiedades", Icon: SlidersHorizontal },
    { id: "search", title: "Buscar texto", Icon: Search },
    { id: "form", title: "Formulario", Icon: ClipboardList },
  ];

  const visibleFields = props.fields.filter((field) => field.name.toLowerCase().includes(fieldFilter.trim().toLowerCase()));

  return (
    <>
      {tab && (
        <aside className="w-72 bg-white border-l border-[#e1dfdd] flex flex-col shrink-0 select-none text-[#1f1f1f] print:hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#efefef]">
            <h2 className="text-xs font-semibold uppercase tracking-wide">{tabs.find((t) => t.id === tab)?.title}</h2>
            <button type="button" onClick={() => onTabChange(null)} className="p-1 rounded-full hover:bg-gray-100 text-[#444746]" title="Cerrar panel">
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
            {tab === "props" && (
              <>
                <p className="text-[11px] text-[#5f6368]">
                  {selected ? "Elemento seleccionado" : `Herramienta: ${TOOL_NAMES[tool]}. Los nuevos elementos usarán estos valores.`}
                </p>

                {(isText || hasStroke || isHighlight) && (
                  <div className="flex flex-col gap-2">
                    <span className={label}>{isHighlight ? "Color del resaltado" : "Color"}</span>
                    <Swatches
                      colors={isHighlight ? HIGHLIGHTS : COLORS}
                      value={color}
                      onPick={(next) => set(isHighlight ? { highlight: next } : { color: next }, { color: next } as Partial<Annotation>)}
                    />
                  </div>
                )}

                {hasFill && (
                  <div className="flex flex-col gap-2">
                    <span className={label}>Relleno</span>
                    <Swatches
                      colors={COLORS}
                      value={selected && "fill" in selected ? selected.fill : style.fill}
                      allowNone
                      onNone={() => set({ fill: null }, { fill: null } as Partial<Annotation>)}
                      onPick={(next) => set({ fill: next }, { fill: next } as Partial<Annotation>)}
                    />
                  </div>
                )}

                {hasStroke && (
                  <label className="flex flex-col gap-2">
                    <span className={label}>
                      Grosor: {value("strokeWidth", selected && "strokeWidth" in selected ? selected.strokeWidth : undefined)} pt
                    </span>
                    <input
                      type="range"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={value("strokeWidth", selected && "strokeWidth" in selected ? selected.strokeWidth : undefined)}
                      onChange={(e) => set({ strokeWidth: Number(e.target.value) }, { strokeWidth: Number(e.target.value) } as Partial<Annotation>)}
                    />
                  </label>
                )}

                {isText && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className={label}>Fuente</span>
                        <select
                          value={selected?.type === "text" ? selected.font : style.font}
                          onChange={(e) => set({ font: e.target.value as FontFamily }, { font: e.target.value } as Partial<Annotation>)}
                          className="border border-[#c4c7c5] rounded px-2 py-1 bg-white"
                        >
                          <option value="Helvetica">Helvetica / Arial</option>
                          <option value="Times">Times</option>
                          <option value="Courier">Courier</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={label}>Tamaño</span>
                        <input
                          type="number"
                          min={4}
                          max={200}
                          value={selected?.type === "text" ? selected.fontSize : style.fontSize}
                          onChange={(e) => {
                            const size = Math.max(4, Math.min(200, Number(e.target.value) || 12));
                            set({ fontSize: size }, { fontSize: size } as Partial<Annotation>);
                          }}
                          className="border border-[#c4c7c5] rounded px-2 py-1"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ["bold", "Negrita", Bold],
                          ["italic", "Cursiva", Italic],
                        ] as const
                      ).map(([key, title, Icon]) => {
                        const active = selected?.type === "text" ? selected[key] : style[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            title={title}
                            onClick={() => set({ [key]: !active }, { [key]: !active } as Partial<Annotation>)}
                            className={`p-1.5 rounded ${active ? "bg-[#fce8e6] text-[#c62828]" : "hover:bg-gray-100 text-[#444746]"}`}
                          >
                            <Icon size={15} />
                          </button>
                        );
                      })}
                      {selected?.type === "text" &&
                        (
                          [
                            ["left", "Izquierda", AlignLeft],
                            ["center", "Centro", AlignCenter],
                            ["right", "Derecha", AlignRight],
                          ] as const
                        ).map(([align, title, Icon]) => (
                          <button
                            key={align}
                            type="button"
                            title={`Alinear: ${title}`}
                            onClick={() => onUpdateSelected({ align } as Partial<Annotation>)}
                            className={`p-1.5 rounded ${selected.align === align ? "bg-[#fce8e6] text-[#c62828]" : "hover:bg-gray-100 text-[#444746]"}`}
                          >
                            <Icon size={15} />
                          </button>
                        ))}
                    </div>
                  </>
                )}

                {kind === "whiteout" && (
                  <p className="text-[11px] text-[#5f6368] leading-relaxed">
                    El corrector tapa el contenido con un recuadro blanco. Combínalo con un texto para corregir lo que dice el PDF, o usa
                    la herramienta «Reemplazar texto», que hace las dos cosas a la vez.
                  </p>
                )}
                {kind === "select" && !selected && (
                  <p className="text-[11px] text-[#5f6368] leading-relaxed">
                    Haz clic en una anotación para seleccionarla. Puedes moverla arrastrando, cambiar su tamaño con los tiradores y
                    borrarla con Supr. Doble clic en un texto para editarlo.
                  </p>
                )}

                {selected && (
                  <div className="flex gap-2 pt-2 border-t border-[#efefef]">
                    <button
                      type="button"
                      onClick={props.onDuplicateSelected}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#c4c7c5] hover:bg-gray-50"
                    >
                      <Copy size={13} /> Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={props.onDeleteSelected}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f2b8b5] text-[#b3261e] hover:bg-[#fce8e6]"
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                )}
              </>
            )}

            {tab === "search" && (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    props.onSearch();
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    value={props.searchQuery}
                    onChange={(e) => props.onSearchQueryChange(e.target.value)}
                    placeholder="Texto a buscar…"
                    className="flex-1 min-w-0 border border-[#c4c7c5] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c62828] select-text"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#c62828] hover:bg-[#a51f1f] text-white font-semibold">
                    Buscar
                  </button>
                </form>
                {props.searching && <p className="text-[#5f6368]">Buscando…</p>}
                {!props.searching && props.matches.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#5f6368]">
                      {props.matches.length} {props.matches.length === 1 ? "coincidencia" : "coincidencias"}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={props.onHighlightMatches}
                        title="Añadir un resaltado sobre todas las coincidencias"
                        className="flex items-center gap-1 px-2 py-1 rounded border border-[#c4c7c5] hover:bg-gray-50"
                      >
                        <Highlighter size={12} /> Resaltar
                      </button>
                      <button type="button" onClick={props.onClearSearch} className="px-2 py-1 rounded border border-[#c4c7c5] hover:bg-gray-50">
                        Limpiar
                      </button>
                    </div>
                  </div>
                )}
                {!props.searching && props.searchQuery && props.matches.length === 0 && (
                  <p className="text-[#5f6368] leading-relaxed">
                    Sin resultados. Si el PDF es un documento escaneado (una imagen), no contiene texto que se pueda buscar.
                  </p>
                )}
                <div className="flex flex-col gap-1">
                  {props.matches.slice(0, 300).map((match, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => props.onGoToMatch(match)}
                      className="text-left px-2.5 py-2 rounded-lg hover:bg-[#fce8e6] border border-transparent hover:border-[#f4b4b4]"
                    >
                      <span className="text-[10px] font-semibold text-[#c62828]">Página {match.pageNumber}</span>
                      <span className="block text-[#444746] truncate">{match.snippet}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === "form" && (
              <>
                {props.fields.length === 0 ? (
                  <p className="text-[#5f6368] leading-relaxed">
                    Este PDF no tiene campos de formulario rellenables. Para completar un formulario impreso, usa la herramienta Texto y
                    escribe sobre la página.
                  </p>
                ) : (
                  <>
                    {props.fields.length > 8 && (
                      <input
                        type="text"
                        value={fieldFilter}
                        onChange={(e) => setFieldFilter(e.target.value)}
                        placeholder="Filtrar campos…"
                        className="border border-[#c4c7c5] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c62828] select-text"
                      />
                    )}
                    {visibleFields.map((field) => {
                      const current = props.formValues[field.key] ?? field.initial;
                      return (
                        <label key={field.key} className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold text-[#444746] break-all">{field.name}</span>
                          {field.kind === "checkbox" ? (
                            <input
                              type="checkbox"
                              disabled={field.readOnly}
                              checked={Boolean(current)}
                              onChange={(e) => props.onFieldChange(field.key, e.target.checked)}
                              className="self-start w-4 h-4"
                            />
                          ) : field.kind === "text" ? (
                            <input
                              type="text"
                              disabled={field.readOnly}
                              value={String(current)}
                              onChange={(e) => props.onFieldChange(field.key, e.target.value)}
                              className="border border-[#c4c7c5] rounded px-2 py-1 select-text disabled:bg-gray-100"
                            />
                          ) : (
                            <select
                              disabled={field.readOnly}
                              value={String(current)}
                              onChange={(e) => props.onFieldChange(field.key, e.target.value)}
                              className="border border-[#c4c7c5] rounded px-2 py-1 bg-white disabled:bg-gray-100"
                            >
                              <option value="">(sin elegir)</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                      );
                    })}
                    <label className="flex items-start gap-2 pt-3 border-t border-[#efefef] cursor-pointer">
                      <input type="checkbox" checked={props.flattenForms} onChange={props.onToggleFlatten} className="mt-0.5" />
                      <span className="text-[11px] text-[#444746] leading-relaxed">
                        Aplanar el formulario al guardar (los valores quedan fijos y ya no se pueden editar).
                      </span>
                    </label>
                    <p className="text-[11px] text-[#5f6368] leading-relaxed">
                      Los valores se escriben en el PDF al guardar; la vista previa muestra los valores originales hasta entonces.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      )}

      <nav className="w-14 bg-white border-l border-[#e1dfdd] flex flex-col items-center py-3 gap-1 shrink-0 select-none print:hidden">
        {tabs.map(({ id, title, Icon }) => (
          <button
            key={id}
            type="button"
            title={title}
            onClick={() => onTabChange(tab === id ? null : id)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg relative ${
              tab === id ? "bg-[#fce8e6] text-[#c62828]" : "text-[#444746] hover:bg-[#f0f4f9]"
            }`}
          >
            <Icon size={18} />
            {id === "form" && props.fields.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#c62828]" />}
          </button>
        ))}
      </nav>
    </>
  );
};
