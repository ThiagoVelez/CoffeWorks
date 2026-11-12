// Paneles de CoffeePaint: herramientas, pinceles, color y capas.

import React, { useMemo, useState } from "react";
import { Brush, Hand, Pipette, PaintBucket, Eraser, Fingerprint, Move, Eye, EyeOff, Lock, Unlock, Plus, Copy, Trash2, Merge, LockKeyhole } from "lucide-react";
import type { PaintDoc, PaintLayer, Tool } from "../types";
import { BRUSHES, type BrushDef } from "../services/brushes";
import { thumbnail } from "../services/model";
import { ColorPicker, IconButton, NumberField, Section, Select, Slider, cx } from "../studio/ui";

const ACC = "#e64980";

export const TOOLS: Array<{ id: Tool; label: string; key: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "brush", label: "Pincel", key: "B", icon: Brush },
  { id: "smudge", label: "Difuminar", key: "S", icon: Fingerprint },
  { id: "eraser", label: "Borrador", key: "E", icon: Eraser },
  { id: "fill", label: "Relleno", key: "G", icon: PaintBucket },
  { id: "eyedropper", label: "Cuentagotas", key: "I", icon: Pipette },
  { id: "move", label: "Mover capa (Mayús: escalar · Alt: girar)", key: "V", icon: Move },
  { id: "hand", label: "Mano", key: "H", icon: Hand },
];

export const ToolBar: React.FC<{ tool: Tool; onTool: (t: Tool) => void; color: string; recent: string[]; onColor: (c: string) => void }> = ({ tool, onTool, color, recent, onColor }) => (
  <div className="w-[52px] shrink-0 bg-[#202023] border-r border-black/50 flex flex-col items-center py-2 gap-1" data-toolbar>
    {TOOLS.map((t) => (
      <IconButton key={t.id} icon={t.icon} title={`${t.label} (${t.key})`} active={tool === t.id} onClick={() => onTool(t.id)} accent={ACC} data-tool={t.id} />
    ))}
    <div className="w-8 h-8 rounded-full border-2 border-white/80 mt-3 shadow" style={{ backgroundColor: color }} title="Color actual" />
    <div className="flex flex-col gap-1 mt-1">
      {recent.slice(0, 6).map((c) => (
        <button key={c} type="button" title={c} onClick={() => onColor(c)} className="w-5 h-5 rounded-full border border-black/50" style={{ backgroundColor: c }} />
      ))}
    </div>
  </div>
);

/** Muestra del trazo de un pincel. */
const BrushPreview: React.FC<{ b: BrushDef; active: boolean }> = ({ b, active }) => {
  const style = useMemo(() => {
    const w = Math.max(2, Math.min(10, b.size / 4));
    return { height: w, opacity: b.opacity * (b.flow < 0.3 ? 0.6 : 1), filter: b.hardness < 0.4 ? "blur(1.5px)" : undefined, borderRadius: b.flat ? 1 : 9 };
  }, [b]);
  return (
    <div className={cx("w-full h-4 flex items-center px-1")}>
      <div className="w-full" style={{ ...style, background: active ? "#fff" : "#c9c9cf", maskImage: b.grain ? "repeating-linear-gradient(90deg,#000 0 2px,rgba(0,0,0,0.6) 2px 3px)" : undefined }} />
    </div>
  );
};

export const BrushPanel: React.FC<{
  brushId: string;
  onBrush: (b: BrushDef) => void;
  size: number;
  onSize: (v: number) => void;
  opacity: number;
  onOpacity: (v: number) => void;
  smoothing: number;
  onSmoothing: (v: number) => void;
}> = ({ brushId, onBrush, size, onSize, opacity, onOpacity, smoothing, onSmoothing }) => {
  const groups = [...new Set(BRUSHES.map((b) => b.group))];
  return (
    <Section title="Pinceles">
      <div className="flex flex-col gap-2" data-brushes>
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-[#6f6f77]">{g}</span>
            <div className="grid grid-cols-2 gap-1">
              {BRUSHES.filter((b) => b.group === g).map((b) => (
                <button key={b.id} type="button" onClick={() => onBrush(b)} data-brush={b.id} className={cx("rounded px-1.5 py-1 text-left text-[11px] flex flex-col gap-0.5", b.id === brushId ? "bg-[#e64980]/40 text-white" : "bg-[#1d1d21] text-[#c9c9cf] hover:bg-white/10")}>
                  {b.name}
                  <BrushPreview b={b} active={b.id === brushId} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Slider label="Tamaño" value={size} min={1} max={400} onChange={onSize} suffix="px" data-name="size" />
      <Slider label="Opacidad" value={Math.round(opacity * 100)} min={1} max={100} onChange={(v) => onOpacity(v / 100)} suffix="%" data-name="opacity" />
      <Slider label="Suavizado del trazo" value={Math.round(smoothing * 100)} min={0} max={95} onChange={(v) => onSmoothing(v / 100)} suffix="%" data-name="smoothing" />
    </Section>
  );
};

export const ColorPanel: React.FC<{ color: string; onColor: (c: string) => void; swatches: string[] }> = ({ color, onColor, swatches }) => (
  <Section title="Color">
    <ColorPicker color={color} onChange={(c) => onColor(c)} showAlpha={false} swatches={swatches} />
  </Section>
);

const BLENDS: Array<{ value: PaintLayer["blend"]; label: string }> = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiplicar" },
  { value: "screen", label: "Trama" },
  { value: "overlay", label: "Superponer" },
  { value: "soft-light", label: "Luz suave" },
  { value: "hard-light", label: "Luz fuerte" },
  { value: "darken", label: "Oscurecer" },
  { value: "lighten", label: "Aclarar" },
  { value: "color-dodge", label: "Sobreexponer" },
  { value: "color-burn", label: "Subexponer" },
  { value: "difference", label: "Diferencia" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosidad" },
];

export const LayersPanel: React.FC<{
  doc: PaintDoc;
  version: number;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<PaintLayer>, key?: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMerge: () => void;
  onMove: (id: string, to: number) => void;
}> = ({ doc, version, onSelect, onPatch, onAdd, onDuplicate, onDelete, onMerge, onMove }) => {
  const active = doc.layers.find((l) => l.id === doc.activeId);
  const thumbs = useMemo(() => new Map(doc.layers.map((l) => [l.id, thumbnail(doc, l)])), [doc, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [drag, setDrag] = useState<string | null>(null);
  return (
    <Section title="Capas">
      {active && (
        <div className="flex items-center gap-2">
          <Select value={active.blend} onChange={(v) => onPatch(active.id, { blend: v as PaintLayer["blend"] })} options={BLENDS} className="flex-1" />
          <NumberField label="Opac." value={Math.round(active.opacity * 100)} min={0} max={100} onChange={(v) => onPatch(active.id, { opacity: v / 100 }, `op-${active.id}`)} suffix="%" className="w-20" />
        </div>
      )}
      <div className="flex flex-col-reverse gap-0.5 max-h-[280px] overflow-y-auto" data-layers>
        {doc.layers.map((l, idx) => (
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
            className={cx("flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer group", l.id === doc.activeId ? "bg-[#e64980]/30" : "hover:bg-white/5")}
          >
            <button type="button" onClick={(e) => { e.stopPropagation(); onPatch(l.id, { visible: !l.visible }); }} className="text-[#b9b9c0] hover:text-white" title={l.visible ? "Ocultar" : "Mostrar"}>
              {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <img src={thumbs.get(l.id)} alt="" className="w-9 h-9 object-contain rounded-sm" style={{ backgroundColor: doc.paperColor }} />
            <input value={l.name} onChange={(e) => onPatch(l.id, { name: e.target.value }, `name-${l.id}`)} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0 bg-transparent text-[12px] outline-none truncate" />
            <button type="button" title={l.alphaLock ? "Desbloquear transparencia" : "Bloquear transparencia (pintar solo sobre lo dibujado)"} onClick={(e) => { e.stopPropagation(); onPatch(l.id, { alphaLock: !l.alphaLock }); }} className={cx("hover:text-white", l.alphaLock ? "text-[#ffa8c5]" : "text-[#6f6f77] opacity-0 group-hover:opacity-100")}>
              <LockKeyhole size={12} />
            </button>
            <button type="button" title={l.locked ? "Desbloquear" : "Bloquear"} onClick={(e) => { e.stopPropagation(); onPatch(l.id, { locked: !l.locked }); }} className={cx("hover:text-white", l.locked ? "text-[#ffa8c5]" : "text-[#6f6f77] opacity-0 group-hover:opacity-100")}>
              {l.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-0.5 border-t border-black/40 pt-1">
        <IconButton icon={Merge} title="Combinar hacia abajo" onClick={onMerge} size={14} />
        <IconButton icon={Copy} title="Duplicar capa" onClick={onDuplicate} size={14} />
        <IconButton icon={Plus} title="Nueva capa" onClick={onAdd} size={14} />
        <IconButton icon={Trash2} title="Eliminar capa" onClick={onDelete} size={14} disabled={doc.layers.length < 2} />
      </div>
    </Section>
  );
};
