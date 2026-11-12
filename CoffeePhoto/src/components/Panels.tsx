// Barras y paneles de CoffeePhoto: herramientas, opciones de la herramienta,
// color, capas y propiedades de la capa activa.

import React, { useMemo } from "react";
import {
  Move,
  Square,
  Circle,
  Lasso,
  Spline,
  Wand2,
  Crop,
  Pipette,
  Bandage,
  Brush,
  Pencil,
  Stamp,
  Eraser,
  Blend,
  PaintBucket,
  Sun,
  Moon,
  Droplet,
  Type,
  Shapes,
  Hand,
  ZoomIn,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Copy,
  SlidersHorizontal,
  ArrowLeftRight,
  ImagePlus,
  Link2,
  FolderInput,
} from "lucide-react";
import type { AdjustLayer, BrushSettings, Layer, PhotoDoc, TextLayer, Tool, ToolOptions } from "../types";
import { BLEND_MODES } from "../types";
import { ColorPicker, ColorSwatch, IconButton, NumberField, Section, Select, Slider, Toggle, cx, DEFAULT_SWATCHES } from "../studio/ui";
import { thumbnail } from "../services/model";
import { ADJUST_LABELS } from "../services/adjust";
import { getCanvas } from "../services/pixels";

const ACC = "#e8452c";

export const TOOLS: Array<{ id: Tool; label: string; key: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "move", label: "Mover", key: "V", icon: Move },
  { id: "marquee", label: "Marco rectangular", key: "M", icon: Square },
  { id: "ellipseSelect", label: "Marco elíptico", key: "M", icon: Circle },
  { id: "lasso", label: "Lazo", key: "L", icon: Lasso },
  { id: "polyLasso", label: "Lazo poligonal", key: "L", icon: Spline },
  { id: "wand", label: "Varita mágica", key: "W", icon: Wand2 },
  { id: "crop", label: "Recortar", key: "C", icon: Crop },
  { id: "eyedropper", label: "Cuentagotas", key: "I", icon: Pipette },
  { id: "heal", label: "Pincel corrector puntual", key: "J", icon: Bandage },
  { id: "brush", label: "Pincel", key: "B", icon: Brush },
  { id: "pencil", label: "Lápiz", key: "B", icon: Pencil },
  { id: "clone", label: "Tampón de clonar", key: "S", icon: Stamp },
  { id: "eraser", label: "Borrador", key: "E", icon: Eraser },
  { id: "gradient", label: "Degradado", key: "G", icon: Blend },
  { id: "bucket", label: "Bote de pintura", key: "G", icon: PaintBucket },
  { id: "blurTool", label: "Desenfocar", key: "R", icon: Droplet },
  { id: "dodge", label: "Sobreexponer", key: "O", icon: Sun },
  { id: "burn", label: "Subexponer", key: "O", icon: Moon },
  { id: "text", label: "Texto", key: "T", icon: Type },
  { id: "shape", label: "Formas", key: "U", icon: Shapes },
  { id: "hand", label: "Mano", key: "H", icon: Hand },
  { id: "zoom", label: "Zoom", key: "Z", icon: ZoomIn },
];

export const ToolBar: React.FC<{
  tool: Tool;
  onTool: (t: Tool) => void;
  fg: string;
  bg: string;
  onFg: (c: string) => void;
  onBg: (c: string) => void;
  onSwap: () => void;
  onReset: () => void;
  editMask: boolean;
}> = ({ tool, onTool, fg, bg, onFg, onBg, onSwap, onReset, editMask }) => (
  <div className="w-[52px] shrink-0 bg-[#202023] border-r border-black/50 flex flex-col items-center py-2 gap-0.5 overflow-y-auto" data-toolbar>
    {TOOLS.map((t) => (
      <IconButton key={t.id} icon={t.icon} title={`${t.label} (${t.key})`} active={tool === t.id} onClick={() => onTool(t.id)} accent={ACC} data-tool={t.id} />
    ))}
    <div className="relative w-10 h-10 mt-2 shrink-0">
      <div className="absolute right-0 bottom-0">
        <ColorSwatch color={bg} onChange={(c) => onBg(c)} title="Color de fondo" size={22} showAlpha={false} />
      </div>
      <div className="absolute left-0 top-0 z-10">
        <ColorSwatch color={fg} onChange={(c) => onFg(c)} title="Color frontal" size={22} showAlpha={false} />
      </div>
    </div>
    <div className="flex gap-1 mt-1">
      <button type="button" title="Intercambiar colores (X)" onClick={onSwap} className="text-[#b9b9c0] hover:text-white">
        <ArrowLeftRight size={12} />
      </button>
      <button type="button" title="Colores predeterminados (D)" onClick={onReset} className="w-3 h-3 border border-white bg-black mt-0.5" />
    </div>
    {editMask && <span className="mt-2 text-[9px] text-center text-[#ffb4a6] leading-tight px-1">Editando máscara</span>}
  </div>
);

const BrushOptions: React.FC<{ s: BrushSettings; onChange: (s: BrushSettings) => void; hardness?: boolean }> = ({ s, onChange, hardness = true }) => (
  <>
    <NumberField label="Tamaño" value={s.size} min={1} max={1000} onChange={(v) => onChange({ ...s, size: v })} suffix="px" className="w-28" />
    {hardness && <NumberField label="Dureza" value={s.hardness} min={0} max={100} onChange={(v) => onChange({ ...s, hardness: v })} suffix="%" className="w-24" />}
    <NumberField label="Opacidad" value={s.opacity} min={1} max={100} onChange={(v) => onChange({ ...s, opacity: v })} suffix="%" className="w-28" />
    <NumberField label="Flujo" value={s.flow} min={1} max={100} onChange={(v) => onChange({ ...s, flow: v })} suffix="%" className="w-24" />
    <Toggle checked={s.pressure} onChange={(v) => onChange({ ...s, pressure: v })} label="Presión" accent={ACC} />
  </>
);

export const OptionsBar: React.FC<{ tool: Tool; opts: ToolOptions; onOpts: (o: ToolOptions) => void; extra?: React.ReactNode }> = ({ tool, opts, onOpts, extra }) => {
  const set = (patch: Partial<ToolOptions>) => onOpts({ ...opts, ...patch });
  const selectModes = (
    <Select
      value={opts.selectMode}
      onChange={(v) => set({ selectMode: v as ToolOptions["selectMode"] })}
      options={[
        { value: "new", label: "Nueva selección" },
        { value: "add", label: "Añadir (Mayús)" },
        { value: "subtract", label: "Restar (Alt)" },
        { value: "intersect", label: "Intersecar" },
      ]}
    />
  );
  let content: React.ReactNode = null;
  switch (tool) {
    case "brush":
    case "pencil":
      content = <BrushOptions s={opts.brush} onChange={(brush) => set({ brush })} hardness={tool === "brush"} />;
      break;
    case "eraser":
      content = <BrushOptions s={opts.eraser} onChange={(eraser) => set({ eraser })} />;
      break;
    case "clone":
      content = (
        <>
          <BrushOptions s={opts.clone} onChange={(clone) => set({ clone })} />
          <Toggle checked={opts.sampleAll} onChange={(v) => set({ sampleAll: v })} label="Todas las capas" accent={ACC} />
          <span className="text-[11px] text-[#8b8b93]">Alt + clic: origen</span>
        </>
      );
      break;
    case "heal":
      content = (
        <>
          <NumberField label="Tamaño" value={opts.heal.size} min={1} max={500} onChange={(v) => set({ heal: { ...opts.heal, size: v } })} suffix="px" className="w-28" />
          <span className="text-[11px] text-[#8b8b93]">Pinta sobre la imperfección: se rellena con lo de alrededor</span>
        </>
      );
      break;
    case "dodge":
    case "burn":
      content = (
        <>
          <NumberField label="Tamaño" value={opts.tone.size} min={1} max={1000} onChange={(v) => set({ tone: { ...opts.tone, size: v } })} suffix="px" className="w-28" />
          <Select
            value={opts.tone.range}
            onChange={(v) => set({ tone: { ...opts.tone, range: v as ToolOptions["tone"]["range"] } })}
            options={[
              { value: "shadows", label: "Sombras" },
              { value: "midtones", label: "Medios tonos" },
              { value: "highlights", label: "Iluminaciones" },
            ]}
          />
          <NumberField label="Exposición" value={opts.tone.opacity} min={1} max={100} onChange={(v) => set({ tone: { ...opts.tone, opacity: v } })} suffix="%" className="w-28" />
        </>
      );
      break;
    case "blurTool":
      content = <BrushOptions s={opts.blur} onChange={(blur) => set({ blur })} />;
      break;
    case "marquee":
    case "ellipseSelect":
    case "lasso":
    case "polyLasso":
      content = (
        <>
          {selectModes}
          <NumberField label="Calar" value={opts.feather} min={0} max={250} onChange={(v) => set({ feather: v })} suffix="px" className="w-24" />
        </>
      );
      break;
    case "wand":
      content = (
        <>
          {selectModes}
          <NumberField label="Tolerancia" value={opts.wandTolerance} min={0} max={255} onChange={(v) => set({ wandTolerance: v })} className="w-28" />
          <Toggle checked={opts.wandContiguous} onChange={(v) => set({ wandContiguous: v })} label="Contiguo" accent={ACC} />
          <Toggle checked={opts.sampleAll} onChange={(v) => set({ sampleAll: v })} label="Todas las capas" accent={ACC} />
        </>
      );
      break;
    case "bucket":
      content = (
        <>
          <NumberField label="Tolerancia" value={opts.bucketTolerance} min={0} max={255} onChange={(v) => set({ bucketTolerance: v })} className="w-28" />
          <Toggle checked={opts.sampleAll} onChange={(v) => set({ sampleAll: v })} label="Todas las capas" accent={ACC} />
        </>
      );
      break;
    case "gradient":
      content = (
        <>
          <Select value={opts.gradientType} onChange={(v) => set({ gradientType: v as ToolOptions["gradientType"] })} options={[{ value: "linear", label: "Lineal" }, { value: "radial", label: "Radial" }]} />
          <Select value={opts.gradientMode} onChange={(v) => set({ gradientMode: v as ToolOptions["gradientMode"] })} options={[{ value: "fgbg", label: "Frontal a fondo" }, { value: "fgTransparent", label: "Frontal a transparente" }]} />
        </>
      );
      break;
    case "shape":
      content = (
        <>
          <Select
            value={opts.shape}
            onChange={(v) => set({ shape: v as ToolOptions["shape"] })}
            options={[
              { value: "rect", label: "Rectángulo" },
              { value: "roundRect", label: "Rectángulo redondeado" },
              { value: "ellipse", label: "Elipse" },
              { value: "line", label: "Línea" },
            ]}
          />
          <Toggle checked={opts.shapeFill} onChange={(v) => set({ shapeFill: v })} label="Relleno (color frontal)" accent={ACC} />
          <NumberField label="Trazo" value={opts.shapeStroke} min={0} max={200} onChange={(v) => set({ shapeStroke: v })} suffix="px" className="w-24" />
          {opts.shape === "roundRect" && <NumberField label="Radio" value={opts.cornerRadius} min={0} max={500} onChange={(v) => set({ cornerRadius: v })} className="w-24" />}
        </>
      );
      break;
    case "crop":
      content = <span className="text-[11px] text-[#8b8b93]">Arrastra para marcar el área; ajusta los tiradores y pulsa Intro (o doble clic) para recortar.</span>;
      break;
    case "text":
      content = <span className="text-[11px] text-[#8b8b93]">Haz clic para escribir; el estilo se cambia en Propiedades.</span>;
      break;
    case "eyedropper":
      content = (
        <>
          <Toggle checked={opts.sampleAll} onChange={(v) => set({ sampleAll: v })} label="Todas las capas" accent={ACC} />
          <span className="text-[11px] text-[#8b8b93]">Alt + clic: color de fondo</span>
        </>
      );
      break;
    case "move":
      content = <span className="text-[11px] text-[#8b8b93]">Arrastra la capa o la selección. Ctrl+T: transformación libre.</span>;
      break;
    default:
      content = null;
  }
  return (
    <div className="h-9 shrink-0 bg-[#26262a] border-b border-black/50 flex items-center gap-3 px-3 overflow-x-auto" data-options-bar>
      <span className="text-[11px] font-semibold text-white whitespace-nowrap">{TOOLS.find((t) => t.id === tool)?.label}</span>
      <div className="w-px h-5 bg-white/10" />
      <div className="flex items-center gap-3 whitespace-nowrap">{content}</div>
      <div className="flex-1" />
      {extra}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panel derecho
// ---------------------------------------------------------------------------

export const ColorPanel: React.FC<{ fg: string; onFg: (c: string) => void }> = ({ fg, onFg }) => (
  <Section title="Color">
    <ColorPicker color={fg} onChange={(c) => onFg(c)} showAlpha={false} swatches={DEFAULT_SWATCHES} />
  </Section>
);

export const LayersPanel: React.FC<{
  doc: PhotoDoc;
  version: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Layer>, key?: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (id: string, to: number) => void;
  onAddMask: () => void;
  onAdjustMenu: () => void;
  onMaskClick: (id: string) => void;
  onLoadSelection: (id: string) => void;
  onImport: () => void;
  editMask: boolean;
}> = ({ doc, version, onSelect, onUpdate, onAdd, onDuplicate, onDelete, onMove, onAddMask, onAdjustMenu, onMaskClick, onLoadSelection, onImport, editMask }) => {
  const active = doc.layers.find((l) => l.id === doc.activeId);
  const thumbs = useMemo(() => {
    const m = new Map<string, { img: string; mask: string | null }>();
    for (const l of doc.layers) m.set(l.id, { img: thumbnail(doc, l), mask: l.mask && getCanvas(l.mask) ? getCanvas(l.mask)!.toDataURL() : null });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, version]);
  const [drag, setDrag] = React.useState<string | null>(null);
  return (
    <Section title="Capas">
      {active && (
        <div className="flex items-center gap-2">
          <Select value={active.blend} onChange={(v) => onUpdate(active.id, { blend: v as Layer["blend"] })} options={BLEND_MODES} className="flex-1" title="Modo de fusión" />
          <NumberField label="Opac." value={Math.round(active.opacity * 100)} min={0} max={100} onChange={(v) => onUpdate(active.id, { opacity: v / 100 }, `op-${active.id}`)} suffix="%" className="w-20" />
        </div>
      )}
      <div className="flex flex-col-reverse gap-0.5 max-h-[300px] overflow-y-auto" data-layers>
        {doc.layers.map((l, idx) => {
          const t = thumbs.get(l.id);
          const isActive = l.id === doc.activeId;
          return (
            <div
              key={l.id}
              draggable
              onDragStart={() => setDrag(l.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag && drag !== l.id) onMove(drag, idx);
                setDrag(null);
              }}
              onClick={() => onSelect(l.id)}
              data-layer={l.name}
              className={cx("flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer group", isActive ? "bg-[#e8452c]/30" : "hover:bg-white/5")}
            >
              <button
                type="button"
                title={l.visible ? "Ocultar" : "Mostrar"}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(l.id, { visible: !l.visible });
                }}
                className="text-[#b9b9c0] hover:text-white"
              >
                {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              {l.kind === "adjust" ? (
                <span className="w-8 h-8 rounded bg-[#34343a] flex items-center justify-center text-[#ffb4a6]" title={ADJUST_LABELS[(l as AdjustLayer).adjust.kind]}>
                  <SlidersHorizontal size={14} />
                </span>
              ) : l.kind === "text" ? (
                <span className="w-8 h-8 rounded bg-[#34343a] flex items-center justify-center text-white font-bold" title="Capa de texto">
                  T
                </span>
              ) : (
                <img
                  src={t?.img}
                  alt=""
                  className={cx("w-8 h-8 object-contain checker rounded-sm border", isActive && !editMask ? "border-white" : "border-transparent")}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.stopPropagation();
                      onLoadSelection(l.id);
                    }
                  }}
                  title="Ctrl + clic: cargar como selección"
                />
              )}
              {l.mask && (
                <>
                  <Link2 size={10} className="text-[#6f6f77]" />
                  <img
                    src={t?.mask || ""}
                    alt=""
                    title="Máscara de capa (clic: editar; Mayús + clic: desactivar)"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) onUpdate(l.id, { maskEnabled: l.maskEnabled === false });
                      else onMaskClick(l.id);
                    }}
                    className={cx("w-8 h-8 object-contain bg-white rounded-sm border", isActive && editMask ? "border-[#ffb4a6]" : "border-transparent", l.maskEnabled === false && "opacity-30")}
                  />
                </>
              )}
              <input
                value={l.name}
                onChange={(e) => onUpdate(l.id, { name: e.target.value }, `name-${l.id}`)}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => onSelect(l.id)}
                className="flex-1 min-w-0 bg-transparent text-[12px] text-[#e4e4e8] outline-none truncate"
              />
              <button
                type="button"
                title={l.locked ? "Desbloquear" : "Bloquear"}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(l.id, { locked: !l.locked });
                }}
                className={cx("hover:text-white", l.locked ? "text-[#ffb4a6]" : "text-[#6f6f77] opacity-0 group-hover:opacity-100")}
              >
                {l.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-0.5 border-t border-black/40 pt-1">
        <IconButton icon={FolderInput} title="Colocar imagen como capa" onClick={onImport} size={14} />
        <IconButton icon={SlidersHorizontal} title="Nueva capa de ajuste" onClick={onAdjustMenu} size={14} />
        <IconButton icon={ImagePlus} title="Añadir máscara de capa" onClick={onAddMask} size={14} />
        <IconButton icon={Copy} title="Duplicar capa (Ctrl+J)" onClick={onDuplicate} size={14} />
        <IconButton icon={Plus} title="Nueva capa (Ctrl+Mayús+N)" onClick={onAdd} size={14} />
        <IconButton icon={Trash2} title="Eliminar capa" onClick={onDelete} size={14} disabled={doc.layers.length < 2} />
      </div>
      <span className="hidden">{version}</span>
    </Section>
  );
};

export const TextProperties: React.FC<{ layer: TextLayer; onChange: (patch: Partial<TextLayer>, key?: string) => void; fonts: string[] }> = ({ layer, onChange, fonts }) => {
  const s = layer.textStyle;
  const set = (patch: Partial<TextLayer["textStyle"]>, key?: string) => onChange({ textStyle: { ...s, ...patch }, name: (patch.text ?? s.text).slice(0, 24) || "Texto" }, key);
  return (
    <Section title="Texto">
      <textarea
        value={s.text}
        onChange={(e) => set({ text: e.target.value }, `text-${layer.id}`)}
        rows={3}
        className="bg-[#141416] border border-black/50 rounded p-1.5 text-[12px] text-[#e4e4e8] outline-none resize-y"
        data-text-input
      />
      <Select value={s.font} onChange={(v) => set({ font: v })} options={fonts.map((f) => ({ value: f, label: f }))} />
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="Tamaño" value={s.size} min={4} max={1000} onChange={(v) => set({ size: v }, `size-${layer.id}`)} suffix="px" />
        <NumberField label="Interl." value={s.lineHeight} min={0.6} max={4} step={0.05} onChange={(v) => set({ lineHeight: v }, `lh-${layer.id}`)} />
        <NumberField label="Espaciado" value={s.letterSpacing} min={-20} max={200} onChange={(v) => set({ letterSpacing: v }, `ls-${layer.id}`)} />
        <NumberField label="Ancho" value={layer.width} min={0} max={20000} onChange={(v) => onChange({ width: v }, `w-${layer.id}`)} title="0 = sin ajuste de línea" />
        <NumberField label="Giro" value={layer.rotation} min={-360} max={360} onChange={(v) => onChange({ rotation: v }, `r-${layer.id}`)} suffix="°" />
        <Select value={s.align} onChange={(v) => set({ align: v as TextLayer["textStyle"]["align"] })} options={[{ value: "left", label: "Izquierda" }, { value: "center", label: "Centro" }, { value: "right", label: "Derecha" }]} />
      </div>
      <div className="flex items-center gap-3">
        <ColorSwatch color={s.color} onChange={(c) => set({ color: c })} title="Color del texto" showAlpha={false} />
        <Toggle checked={s.bold} onChange={(v) => set({ bold: v })} label="Negrita" accent={ACC} />
        <Toggle checked={s.italic} onChange={(v) => set({ italic: v })} label="Cursiva" accent={ACC} />
      </div>
      <div className="flex items-center gap-3">
        <Toggle checked={s.shadow} onChange={(v) => set({ shadow: v })} label="Sombra" accent={ACC} />
        <NumberField label="Contorno" value={s.stroke} min={0} max={60} onChange={(v) => set({ stroke: v }, `st-${layer.id}`)} className="w-24" />
        <ColorSwatch color={s.strokeColor} onChange={(c) => set({ strokeColor: c })} title="Color del contorno" showAlpha={false} size={20} />
      </div>
    </Section>
  );
};

export const LayerStyleProperties: React.FC<{ layer: Layer; onChange: (patch: Partial<Layer>, key?: string) => void }> = ({ layer, onChange }) => {
  const st = layer.style || {};
  const set = (patch: Partial<NonNullable<Layer["style"]>>, key?: string) => onChange({ style: { ...st, ...patch } }, key);
  return (
    <Section title="Estilo de capa" defaultOpen={!!(st.dropShadow || st.stroke || st.outerGlow)}>
      <Toggle checked={!!st.dropShadow} onChange={(v) => set({ dropShadow: v ? { color: "#000000", opacity: 0.6, distance: 10, angle: 135, blur: 12 } : undefined })} label="Sombra paralela" accent={ACC} />
      {st.dropShadow && (
        <div className="grid grid-cols-2 gap-1.5 pl-2">
          <NumberField label="Dist." value={st.dropShadow.distance} min={0} max={500} onChange={(v) => set({ dropShadow: { ...st.dropShadow!, distance: v } }, "ds-d")} />
          <NumberField label="Ángulo" value={st.dropShadow.angle} min={-180} max={360} onChange={(v) => set({ dropShadow: { ...st.dropShadow!, angle: v } }, "ds-a")} />
          <NumberField label="Desenf." value={st.dropShadow.blur} min={0} max={250} onChange={(v) => set({ dropShadow: { ...st.dropShadow!, blur: v } }, "ds-b")} />
          <NumberField label="Opac." value={Math.round(st.dropShadow.opacity * 100)} min={0} max={100} onChange={(v) => set({ dropShadow: { ...st.dropShadow!, opacity: v / 100 } }, "ds-o")} />
          <ColorSwatch color={st.dropShadow.color} onChange={(c) => set({ dropShadow: { ...st.dropShadow!, color: c } })} showAlpha={false} size={20} />
        </div>
      )}
      <Toggle checked={!!st.stroke} onChange={(v) => set({ stroke: v ? { color: "#ffffff", size: 4 } : undefined })} label="Trazo" accent={ACC} />
      {st.stroke && (
        <div className="flex items-center gap-2 pl-2">
          <NumberField label="Tamaño" value={st.stroke.size} min={1} max={100} onChange={(v) => set({ stroke: { ...st.stroke!, size: v } }, "st-s")} className="w-24" />
          <ColorSwatch color={st.stroke.color} onChange={(c) => set({ stroke: { ...st.stroke!, color: c } })} showAlpha={false} size={20} />
        </div>
      )}
      <Toggle checked={!!st.outerGlow} onChange={(v) => set({ outerGlow: v ? { color: "#ffd27a", opacity: 0.8, size: 20 } : undefined })} label="Resplandor exterior" accent={ACC} />
      {st.outerGlow && (
        <div className="flex items-center gap-2 pl-2">
          <NumberField label="Tamaño" value={st.outerGlow.size} min={1} max={250} onChange={(v) => set({ outerGlow: { ...st.outerGlow!, size: v } }, "og-s")} className="w-24" />
          <ColorSwatch color={st.outerGlow.color} onChange={(c) => set({ outerGlow: { ...st.outerGlow!, color: c } })} showAlpha={false} size={20} />
        </div>
      )}
    </Section>
  );
};

export { Slider };
