// Paneles de CoffeeVector: herramientas, transformar, apariencia (relleno y
// trazo con degradados), texto, alinear, buscatrazos, capas y mesas.

import React, { useState } from "react";
import {
  MousePointer2,
  MousePointer,
  PenTool,
  Pencil,
  Spline,
  Square,
  RectangleHorizontal,
  Circle,
  Hexagon,
  Star,
  Minus,
  Type,
  Pipette,
  LayoutTemplate,
  Hand,
  ZoomIn,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Combine,
  SquareMinus,
  SquaresIntersect,
  SquaresExclude,
  Plus,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import type { Artboard, Bounds, GradientStop, Paint, StrokeStyle, TextObj, Tool, VDoc, VObject } from "../types";
import { ColorSwatch, IconButton, NumberField, Section, Select, Toggle, cx, Button } from "../studio/ui";
import type { PathfinderOp } from "../services/pathfinder";

const ACC = "#e8590c";

export const TOOLS: Array<{ id: Tool; label: string; key: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "select", label: "Selección", key: "V", icon: MousePointer2 },
  { id: "direct", label: "Selección directa", key: "A", icon: MousePointer },
  { id: "pen", label: "Pluma", key: "P", icon: PenTool },
  { id: "convert", label: "Convertir punto de ancla", key: "Mayús+C", icon: Spline },
  { id: "pencil", label: "Lápiz", key: "N", icon: Pencil },
  { id: "rect", label: "Rectángulo", key: "M", icon: Square },
  { id: "roundRect", label: "Rectángulo redondeado", key: "", icon: RectangleHorizontal },
  { id: "ellipse", label: "Elipse", key: "L", icon: Circle },
  { id: "polygon", label: "Polígono", key: "", icon: Hexagon },
  { id: "star", label: "Estrella", key: "", icon: Star },
  { id: "line", label: "Segmento de línea", key: "\\", icon: Minus },
  { id: "text", label: "Texto", key: "T", icon: Type },
  { id: "eyedropper", label: "Cuentagotas", key: "I", icon: Pipette },
  { id: "artboard", label: "Mesa de trabajo", key: "Mayús+O", icon: LayoutTemplate },
  { id: "hand", label: "Mano", key: "H", icon: Hand },
  { id: "zoom", label: "Zoom", key: "Z", icon: ZoomIn },
];

const paintColor = (p: Paint | null) => (p ? (p.type === "solid" ? p.color : p.stops[0]?.color || "#000000") : "#ffffff");

export const ToolBar: React.FC<{
  tool: Tool;
  onTool: (t: Tool) => void;
  fill: Paint | null;
  stroke: StrokeStyle | null;
  onFill: (p: Paint | null) => void;
  onStroke: (s: StrokeStyle | null) => void;
}> = ({ tool, onTool, fill, stroke, onFill, onStroke }) => (
  <div className="w-[52px] shrink-0 bg-[#202023] border-r border-black/50 flex flex-col items-center py-2 gap-0.5 overflow-y-auto" data-toolbar>
    {TOOLS.map((t) => (
      <IconButton key={t.id} icon={t.icon} title={`${t.label}${t.key ? ` (${t.key})` : ""}`} active={tool === t.id} onClick={() => onTool(t.id)} accent={ACC} data-tool={t.id} />
    ))}
    <div className="relative w-10 h-10 mt-2 shrink-0" title="Relleno y trazo">
      <div className="absolute right-0 bottom-0">
        <div className="relative">
          <ColorSwatch color={stroke?.color || "#ffffff"} onChange={(c) => onStroke({ ...(stroke || { opacity: 1, width: 2, cap: "round", join: "round", dash: [] }), color: c })} title="Trazo" size={22} showAlpha={false} />
          {!stroke && <span className="absolute inset-0 pointer-events-none border-t-2 border-red-500 rotate-45 origin-center top-1/2" />}
        </div>
      </div>
      <div className="absolute left-0 top-0 z-10">
        <ColorSwatch color={paintColor(fill)} onChange={(c) => onFill({ type: "solid", color: c, opacity: 1 })} title="Relleno" size={22} showAlpha={false} />
      </div>
    </div>
    <div className="flex gap-1 mt-1">
      <button type="button" title="Intercambiar relleno y trazo (Mayús+X)" className="text-[#b9b9c0] hover:text-white" onClick={() => {
        const f = fill?.type === "solid" ? fill.color : null;
        onFill(stroke ? { type: "solid", color: stroke.color, opacity: stroke.opacity } : null);
        onStroke(f ? { ...(stroke || { opacity: 1, width: 2, cap: "round", join: "round", dash: [] }), color: f } : null);
      }}>
        <ArrowLeftRight size={12} />
      </button>
      <button type="button" title="Sin relleno" className="w-3 h-3 border border-white relative overflow-hidden mt-0.5" onClick={() => onFill(null)}>
        <span className="absolute inset-0 border-t border-red-500 rotate-45 top-1/2" />
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Pintura (sólido o degradado)
// ---------------------------------------------------------------------------

export const PaintEditor: React.FC<{ paint: Paint | null; onChange: (p: Paint | null) => void; label: string }> = ({ paint, onChange, label }) => {
  const kind = paint ? paint.type : "none";
  const stops: GradientStop[] = paint && paint.type !== "solid" ? paint.stops : [
    { offset: 0, color: paint?.type === "solid" ? paint.color : "#ff7a00", opacity: 1 },
    { offset: 1, color: "#e8364d", opacity: 1 },
  ];
  const setKind = (k: string) => {
    if (k === "none") onChange(null);
    else if (k === "solid") onChange({ type: "solid", color: paintColor(paint), opacity: 1 });
    else if (k === "linear") onChange({ type: "linear", stops, angle: paint?.type === "linear" ? paint.angle : 0 });
    else onChange({ type: "radial", stops, cx: 0.5, cy: 0.5, r: 0.5 });
  };
  return (
    <div className="flex flex-col gap-1.5" data-paint={label}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#b9b9c0] w-12">{label}</span>
        <Select
          value={kind}
          onChange={setKind}
          options={[
            { value: "none", label: "Ninguno" },
            { value: "solid", label: "Color" },
            { value: "linear", label: "Degradado lineal" },
            { value: "radial", label: "Degradado radial" },
          ]}
          className="flex-1"
        />
        {paint?.type === "solid" && <ColorSwatch color={paint.color} alpha={paint.opacity} onChange={(c, a) => onChange({ type: "solid", color: c, opacity: a })} showAlpha />}
      </div>
      {paint && paint.type !== "solid" && (
        <div className="flex flex-col gap-1.5 pl-2">
          <div className="h-3 rounded checker relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${paint.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(",")})` }} />
          </div>
          {paint.stops.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <ColorSwatch color={s.color} alpha={s.opacity} onChange={(c, a) => onChange({ ...paint, stops: paint.stops.map((x, j) => (j === i ? { ...x, color: c, opacity: a } : x)) } as Paint)} size={18} showAlpha />
              <NumberField label="Pos." value={Math.round(s.offset * 100)} min={0} max={100} onChange={(v) => onChange({ ...paint, stops: paint.stops.map((x, j) => (j === i ? { ...x, offset: v / 100 } : x)) } as Paint)} suffix="%" className="flex-1" />
              <button type="button" disabled={paint.stops.length < 3} onClick={() => onChange({ ...paint, stops: paint.stops.filter((_, j) => j !== i) } as Paint)} className="text-[#8b8b93] hover:text-white disabled:opacity-30" title="Quitar parada">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button onClick={() => onChange({ ...paint, stops: [...paint.stops, { offset: 0.5, color: "#ffffff", opacity: 1 }].sort((a, b) => a.offset - b.offset) } as Paint)}>
              <Plus size={12} /> Parada
            </Button>
            {paint.type === "linear" && <NumberField label="Ángulo" value={paint.angle} min={-360} max={360} onChange={(v) => onChange({ ...paint, angle: v })} suffix="°" className="flex-1" />}
          </div>
        </div>
      )}
    </div>
  );
};

export const StrokeEditor: React.FC<{ stroke: StrokeStyle | null; onChange: (s: StrokeStyle | null) => void }> = ({ stroke, onChange }) => (
  <div className="flex flex-col gap-1.5" data-stroke-editor>
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#b9b9c0] w-12">Trazo</span>
      <Toggle checked={!!stroke} onChange={(v) => onChange(v ? { color: "#1f1f1f", opacity: 1, width: 2, cap: "round", join: "round", dash: [] } : null)} label="" accent={ACC} />
      {stroke && <ColorSwatch color={stroke.color} alpha={stroke.opacity} onChange={(c, a) => onChange({ ...stroke, color: c, opacity: a })} showAlpha />}
      {stroke && <NumberField label="Grosor" value={stroke.width} min={0} max={500} step={0.5} onChange={(v) => onChange({ ...stroke, width: v })} className="flex-1" />}
    </div>
    {stroke && (
      <div className="grid grid-cols-3 gap-1.5 pl-2">
        <Select value={stroke.cap} onChange={(v) => onChange({ ...stroke, cap: v as StrokeStyle["cap"] })} options={[{ value: "butt", label: "Extremo plano" }, { value: "round", label: "Redondo" }, { value: "square", label: "Cuadrado" }]} title="Extremos" />
        <Select value={stroke.join} onChange={(v) => onChange({ ...stroke, join: v as StrokeStyle["join"] })} options={[{ value: "miter", label: "Esquina en punta" }, { value: "round", label: "Redondeada" }, { value: "bevel", label: "Biselada" }]} title="Esquinas" />
        <Select
          value={stroke.dash.join(",")}
          onChange={(v) => onChange({ ...stroke, dash: v ? v.split(",").map(Number) : [] })}
          options={[{ value: "", label: "Continua" }, { value: "8,6", label: "Discontinua" }, { value: "2,4", label: "Punteada" }, { value: "16,6,4,6", label: "Raya-punto" }]}
          title="Línea"
        />
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Panel de propiedades
// ---------------------------------------------------------------------------

export const PropertiesPanel: React.FC<{
  box: Bounds | null;
  single: VObject | null;
  count: number;
  onBox: (b: Bounds) => void;
  onRotate: (deg: number) => void;
  onPatch: (patch: Partial<VObject>, key?: string) => void;
  onFill: (p: Paint | null) => void;
  onStroke: (s: StrokeStyle | null) => void;
  fill: Paint | null;
  stroke: StrokeStyle | null;
  fonts: string[];
}> = ({ box, single, count, onBox, onRotate, onPatch, onFill, onStroke, fill, stroke, fonts }) => {
  const [rot, setRot] = useState(0);
  return (
    <>
      {box && (
        <Section title={count > 1 ? `Transformar (${count} objetos)` : "Transformar"}>
          <div className="grid grid-cols-2 gap-1.5" data-transform>
            <NumberField label="X" value={Math.round(box.x * 10) / 10} onChange={(v) => onBox({ ...box, x: v })} />
            <NumberField label="Y" value={Math.round(box.y * 10) / 10} onChange={(v) => onBox({ ...box, y: v })} />
            <NumberField label="An" value={Math.round(box.w * 10) / 10} min={0.1} onChange={(v) => onBox({ ...box, w: v })} />
            <NumberField label="Al" value={Math.round(box.h * 10) / 10} min={0.1} onChange={(v) => onBox({ ...box, h: v })} />
            <NumberField label="Girar" value={rot} min={-360} max={360} onChange={setRot} suffix="°" />
            <Button onClick={() => rot && (onRotate(rot), setRot(0))}>Aplicar giro</Button>
          </div>
          {single && (
            <div className="flex items-center gap-2">
              <NumberField label="Opac." value={Math.round(single.opacity * 100)} min={0} max={100} onChange={(v) => onPatch({ opacity: v / 100 }, "op")} suffix="%" className="w-24" />
              <Select
                value={single.blend}
                onChange={(v) => onPatch({ blend: v })}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "multiply", label: "Multiplicar" },
                  { value: "screen", label: "Trama" },
                  { value: "overlay", label: "Superponer" },
                  { value: "darken", label: "Oscurecer" },
                  { value: "lighten", label: "Aclarar" },
                  { value: "color-dodge", label: "Sobreexponer color" },
                  { value: "color-burn", label: "Subexponer color" },
                  { value: "difference", label: "Diferencia" },
                  { value: "hue", label: "Tono" },
                  { value: "color", label: "Color" },
                  { value: "luminosity", label: "Luminosidad" },
                ]}
                className="flex-1"
              />
            </div>
          )}
        </Section>
      )}
      <Section title={box ? "Apariencia" : "Apariencia (objetos nuevos)"}>
        <PaintEditor paint={fill} onChange={onFill} label="Relleno" />
        <StrokeEditor stroke={stroke} onChange={onStroke} />
        {single?.type === "path" && (
          <Select value={single.fillRule} onChange={(v) => onPatch({ fillRule: v } as Partial<VObject>)} options={[{ value: "nonzero", label: "Relleno: distinto de cero" }, { value: "evenodd", label: "Relleno: par-impar (huecos)" }]} />
        )}
      </Section>
      {single?.type === "text" && <TextPanel t={single} fonts={fonts} onPatch={onPatch} />}
    </>
  );
};

const TextPanel: React.FC<{ t: TextObj; fonts: string[]; onPatch: (patch: Partial<VObject>, key?: string) => void }> = ({ t, fonts, onPatch }) => (
  <Section title="Carácter">
    <Select value={t.font} onChange={(v) => onPatch({ font: v } as Partial<VObject>)} options={fonts.map((f) => ({ value: f, label: f }))} />
    <div className="grid grid-cols-2 gap-1.5">
      <NumberField label="Tamaño" value={t.size} min={1} max={2000} onChange={(v) => onPatch({ size: v } as Partial<VObject>, "size")} suffix="px" />
      <Select value={String(t.weight)} onChange={(v) => onPatch({ weight: Number(v) } as Partial<VObject>)} options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: { 300: "Ligera", 400: "Normal", 500: "Media", 600: "Seminegrita", 700: "Negrita", 800: "Extra negrita", 900: "Black" }[w]! }))} />
      <NumberField label="Interl." value={t.lineHeight} min={0.5} max={4} step={0.05} onChange={(v) => onPatch({ lineHeight: v } as Partial<VObject>, "lh")} />
      <NumberField label="Espac." value={t.letterSpacing} min={-50} max={500} onChange={(v) => onPatch({ letterSpacing: v } as Partial<VObject>, "ls")} />
      <Select value={t.align} onChange={(v) => onPatch({ align: v } as Partial<VObject>)} options={[{ value: "start", label: "Izquierda" }, { value: "middle", label: "Centro" }, { value: "end", label: "Derecha" }]} />
      <Toggle checked={t.italic} onChange={(v) => onPatch({ italic: v } as Partial<VObject>)} label="Cursiva" accent={ACC} />
    </div>
    <span className="text-[10px] text-[#8b8b93]">Doble clic sobre el texto para editarlo.</span>
  </Section>
);

export const AlignPanel: React.FC<{ onAlign: (k: string) => void; onPathfinder: (op: PathfinderOp) => void; toArtboard: boolean; setToArtboard: (v: boolean) => void }> = ({ onAlign, onPathfinder, toArtboard, setToArtboard }) => (
  <Section title="Alinear y buscatrazos">
    <div className="flex flex-wrap gap-0.5" data-align>
      <IconButton icon={AlignStartVertical} title="Alinear a la izquierda" onClick={() => onAlign("left")} size={15} />
      <IconButton icon={AlignCenterVertical} title="Centrar horizontalmente" onClick={() => onAlign("hcenter")} size={15} />
      <IconButton icon={AlignEndVertical} title="Alinear a la derecha" onClick={() => onAlign("right")} size={15} />
      <IconButton icon={AlignStartHorizontal} title="Alinear arriba" onClick={() => onAlign("top")} size={15} />
      <IconButton icon={AlignCenterHorizontal} title="Centrar verticalmente" onClick={() => onAlign("vcenter")} size={15} />
      <IconButton icon={AlignEndHorizontal} title="Alinear abajo" onClick={() => onAlign("bottom")} size={15} />
      <IconButton icon={AlignHorizontalSpaceAround} title="Distribuir horizontalmente" onClick={() => onAlign("hdist")} size={15} />
      <IconButton icon={AlignVerticalSpaceAround} title="Distribuir verticalmente" onClick={() => onAlign("vdist")} size={15} />
    </div>
    <Toggle checked={toArtboard} onChange={setToArtboard} label="Alinear a la mesa de trabajo" accent={ACC} />
    <div className="flex gap-0.5" data-pathfinder>
      <IconButton icon={Combine} title="Unir" onClick={() => onPathfinder("unite")} size={15} />
      <IconButton icon={SquareMinus} title="Menos frente" onClick={() => onPathfinder("minusFront")} size={15} />
      <IconButton icon={SquaresIntersect} title="Intersecar" onClick={() => onPathfinder("intersect")} size={15} />
      <IconButton icon={SquaresExclude} title="Excluir superposición" onClick={() => onPathfinder("exclude")} size={15} />
    </div>
  </Section>
);

const kindLabel = (o: VObject) => (o.type === "path" ? "Trazado" : o.type === "text" ? "Texto" : o.type === "image" ? "Imagen" : o.clip ? "Recorte" : "Grupo");

export const LayersPanel: React.FC<{
  doc: VDoc;
  selection: string[];
  onSelect: (ids: string[], add: boolean) => void;
  onPatch: (id: string, patch: Partial<VObject>, key?: string) => void;
  onReorder: (id: string, to: number) => void;
}> = ({ doc, selection, onSelect, onPatch, onReorder }) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<string | null>(null);
  const row = (o: VObject, depth: number, idx: number): React.ReactNode => (
    <React.Fragment key={o.id}>
      <div
        draggable={depth === 0}
        onDragStart={() => setDrag(o.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (drag && drag !== o.id) onReorder(drag, idx);
          setDrag(null);
        }}
        onClick={(e) => onSelect([o.id], e.shiftKey)}
        data-layer={o.name}
        className={cx("flex items-center gap-1 px-1 h-7 rounded cursor-pointer group", selection.includes(o.id) ? "bg-[#e8590c]/30" : "hover:bg-white/5")}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        {o.type === "group" ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); const n = new Set(open); n.has(o.id) ? n.delete(o.id) : n.add(o.id); setOpen(n); }} className="text-[#8b8b93]">
            {open.has(o.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onPatch(o.id, { visible: !o.visible }); }} className="text-[#b9b9c0] hover:text-white" title={o.visible ? "Ocultar" : "Mostrar"}>
          {o.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <input value={o.name} onChange={(e) => onPatch(o.id, { name: e.target.value }, `name-${o.id}`)} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0 bg-transparent text-[12px] outline-none truncate" />
        <span className="text-[10px] text-[#6f6f77]">{kindLabel(o)}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onPatch(o.id, { locked: !o.locked }); }} className={cx("hover:text-white", o.locked ? "text-[#ffc09f]" : "text-[#6f6f77] opacity-0 group-hover:opacity-100")} title={o.locked ? "Desbloquear" : "Bloquear"}>
          {o.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
      </div>
      {o.type === "group" && open.has(o.id) && [...o.children].reverse().map((c) => row(c, depth + 1, -1))}
    </React.Fragment>
  );
  return (
    <Section title={`Capas (${doc.objects.length})`}>
      <div className="flex flex-col max-h-[260px] overflow-y-auto" data-layers>
        {doc.objects.length === 0 && <span className="text-[11px] text-[#6f6f77]">Aún no hay objetos.</span>}
        {[...doc.objects].map((o, i) => ({ o, i })).reverse().map(({ o, i }) => row(o, 0, i))}
      </div>
    </Section>
  );
};

export const ArtboardsPanel: React.FC<{ doc: VDoc; active: string | null; onActive: (id: string) => void; onPatch: (id: string, patch: Partial<Artboard>) => void; onDelete: (id: string) => void; onAdd: () => void }> = ({ doc, active, onActive, onPatch, onDelete, onAdd }) => {
  const ab = doc.artboards.find((a) => a.id === active) || doc.artboards[0];
  return (
    <Section title="Mesas de trabajo" defaultOpen={false}>
      <div className="flex flex-col gap-0.5">
        {doc.artboards.map((a) => (
          <div key={a.id} onClick={() => onActive(a.id)} className={cx("flex items-center gap-2 px-1.5 h-7 rounded cursor-pointer", a.id === ab?.id ? "bg-[#e8590c]/30" : "hover:bg-white/5")} data-artboard={a.name}>
            <input value={a.name} onChange={(e) => onPatch(a.id, { name: e.target.value })} className="flex-1 min-w-0 bg-transparent text-[12px] outline-none" />
            <span className="text-[10px] text-[#8b8b93] font-mono">
              {a.w}×{a.h}
            </span>
            <button type="button" disabled={doc.artboards.length < 2} onClick={(e) => { e.stopPropagation(); onDelete(a.id); }} className="text-[#8b8b93] hover:text-white disabled:opacity-30">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
      {ab && (
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="An" value={ab.w} min={1} onChange={(v) => onPatch(ab.id, { w: v })} />
          <NumberField label="Al" value={ab.h} min={1} onChange={(v) => onPatch(ab.id, { h: v })} />
          <div className="flex items-center gap-2 col-span-2">
            <span className="text-[11px] text-[#b9b9c0]">Fondo</span>
            <ColorSwatch color={ab.background || "#ffffff"} onChange={(c) => onPatch(ab.id, { background: c })} showAlpha={false} size={20} />
            <Toggle checked={!ab.background} onChange={(v) => onPatch(ab.id, { background: v ? null : "#ffffff" })} label="Transparente" accent={ACC} />
          </div>
        </div>
      )}
      <Button onClick={onAdd}>
        <Plus size={12} /> Nueva mesa
      </Button>
    </Section>
  );
};
