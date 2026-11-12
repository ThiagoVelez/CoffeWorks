// Paneles laterales: Proyecto, Efectos y ajustes, Propiedades de la capa.

import React, { useState } from "react";
import { Film, Image as ImageIcon, Music, Layers, Plus, Search, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Sparkles, Wand2 } from "lucide-react";
import type { Asset, Comp, EffectKind, Layer, Project, Vec } from "../types";
import { ACCENT } from "../types";
import { ANIM_PRESETS, EFFECTS, TITLE_TEMPLATES } from "../services/model";
import { keyedValue, setAt } from "../services/anim";
import { Scrub } from "./Timeline";
import { Section, Select, Toggle, cx } from "../studio/ui";

export const ProjectPanel: React.FC<{
  project: Project;
  onOpenComp: (id: string) => void;
  onNewComp: () => void;
  onImport: () => void;
  onAddToComp: (asset: Asset) => void;
  onRemoveAsset: (id: string) => void;
  onRemoveComp: (id: string) => void;
  onCompSettings: (id: string) => void;
  onNestComp: (id: string) => void;
}> = ({ project, onOpenComp, onNewComp, onImport, onAddToComp, onRemoveAsset, onRemoveComp, onCompSettings, onNestComp }) => (
  <div className="flex flex-col min-h-0" data-project>
    <div className="px-3 h-8 flex items-center justify-between border-b border-black/40">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Proyecto</span>
      <div className="flex gap-1">
        <button type="button" title="Importar archivo" onClick={onImport} className="text-[#b9b9c0] hover:text-white">
          <Plus size={14} />
        </button>
        <button type="button" title="Nueva composición" onClick={onNewComp} className="text-[#b9b9c0] hover:text-white">
          <Layers size={13} />
        </button>
      </div>
    </div>
    <div className="overflow-y-auto p-1 text-[12px]">
      {project.comps.map((c) => (
        <div
          key={c.id}
          className={cx("group flex items-center gap-2 px-2 py-1 rounded cursor-pointer", c.id === project.activeComp ? "bg-[#c2367f]/25" : "hover:bg-white/5")}
          onClick={() => onOpenComp(c.id)}
          onDoubleClick={() => onCompSettings(c.id)}
          data-comp={c.name}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/coffee-comp", c.id)}
        >
          <Layers size={12} className="text-[#ff8fab]" />
          <span className="flex-1 truncate">{c.name}</span>
          <span className="text-[10px] text-[#6f6f77]">
            {c.width}×{c.height}
          </span>
          <button type="button" title="Anidar en la composición activa" onClick={(e) => (e.stopPropagation(), onNestComp(c.id))} className="opacity-0 group-hover:opacity-100 text-[#9a9aa2] hover:text-white">
            <Plus size={11} />
          </button>
          {project.comps.length > 1 && (
            <button type="button" title="Borrar" onClick={(e) => (e.stopPropagation(), onRemoveComp(c.id))} className="opacity-0 group-hover:opacity-100 text-[#9a9aa2] hover:text-white">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}
      {project.assets.map((a) => {
        const Icon = a.kind === "image" ? ImageIcon : a.kind === "video" ? Film : Music;
        return (
          <div key={a.id} className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer" onDoubleClick={() => onAddToComp(a)} draggable onDragStart={(e) => e.dataTransfer.setData("text/coffee-asset", a.id)} title="Doble clic o arrastra al visor para añadirlo" data-asset={a.name}>
            <Icon size={12} className="text-[#ffa94d]" />
            <span className="flex-1 truncate">{a.name}</span>
            <span className="text-[10px] text-[#6f6f77]">{a.kind === "audio" ? `${a.duration.toFixed(1)} s` : `${a.width}×${a.height}`}</span>
            <button type="button" title="Añadir a la composición" onClick={() => onAddToComp(a)} className="opacity-0 group-hover:opacity-100 text-[#9a9aa2] hover:text-white">
              <Plus size={11} />
            </button>
            <button type="button" title="Quitar del proyecto" onClick={() => onRemoveAsset(a.id)} className="opacity-0 group-hover:opacity-100 text-[#9a9aa2] hover:text-white">
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
      {!project.assets.length && <div className="px-2 py-2 text-[11px] text-[#6f6f77]">Importa imágenes, videos o audio con «+» o arrastrándolos a la ventana.</div>}
    </div>
  </div>
);

export const EffectsPanel: React.FC<{ onEffect: (k: EffectKind) => void; onPreset: (id: string) => void; onTemplate: (id: string) => void; hasLayer: boolean }> = ({ onEffect, onPreset, onTemplate, hasLayer }) => {
  const [q, setQ] = useState("");
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const groups = new Map<string, EffectKind[]>();
  (Object.keys(EFFECTS) as EffectKind[]).forEach((k) => match(EFFECTS[k].label) && groups.set(EFFECTS[k].group, [...(groups.get(EFFECTS[k].group) || []), k]));
  const presetGroups = new Map<string, typeof ANIM_PRESETS>();
  ANIM_PRESETS.forEach((p) => match(p.name) && presetGroups.set(p.group, [...(presetGroups.get(p.group) || []), p]));
  return (
    <div className="flex flex-col min-h-0" data-effects>
      <div className="px-3 h-8 flex items-center border-b border-black/40">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Efectos y ajustes</span>
      </div>
      <label className="flex items-center gap-2 bg-[#141416] rounded px-2 h-7 m-2">
        <Search size={12} className="text-[#8b8b93]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Buscar efecto o animación" className="flex-1 bg-transparent outline-none text-[12px]" data-fx-search />
      </label>
      <div className="overflow-y-auto px-1 pb-2 text-[12px]">
        {!hasLayer && <div className="px-2 pb-2 text-[11px] text-[#ffa94d]">Selecciona una capa para aplicar efectos y animaciones.</div>}
        <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-[#8b8b93]">Animaciones</div>
        {[...presetGroups].map(([g, list]) => (
          <div key={g}>
            <div className="px-2 pt-1 text-[11px] text-[#c9c9cf] font-semibold">{g}</div>
            {list.map((p) => (
              <button key={p.id} type="button" disabled={!hasLayer} onDoubleClick={() => onPreset(p.id)} onClick={(e) => e.detail === 1 && undefined} className="w-full text-left flex items-center gap-2 pl-4 pr-2 py-1 rounded hover:bg-white/5 disabled:opacity-40" data-anim={p.name} title="Doble clic: aplicar en el cabezal">
                <Wand2 size={11} className="text-[#ff8fab]" /> {p.name}
              </button>
            ))}
          </div>
        ))}
        <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-[#8b8b93]">Efectos</div>
        {[...groups].map(([g, list]) => (
          <div key={g}>
            <div className="px-2 pt-1 text-[11px] text-[#c9c9cf] font-semibold">{g}</div>
            {list.map((k) => (
              <button key={k} type="button" disabled={!hasLayer} onDoubleClick={() => onEffect(k)} className="w-full text-left flex items-center gap-2 pl-4 pr-2 py-1 rounded hover:bg-white/5 disabled:opacity-40" data-fx={EFFECTS[k].label} title="Doble clic: aplicar">
                <Sparkles size={11} className="text-[#ffa94d]" /> {EFFECTS[k].label}
              </button>
            ))}
          </div>
        ))}
        <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-[#8b8b93]">Plantillas de títulos</div>
        {TITLE_TEMPLATES.filter((t) => match(t.name)).map((t) => (
          <button key={t.id} type="button" onDoubleClick={() => onTemplate(t.id)} className="w-full text-left flex flex-col pl-4 pr-2 py-1 rounded hover:bg-white/5" data-template={t.name} title="Doble clic: crear como composición nueva">
            <span>{t.name}</span>
            <span className="text-[10px] text-[#7d7d85]">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const FONTS = ["Hanken Grotesk", "Georgia", "Times New Roman", "Arial", "Verdana", "Trebuchet MS", "Courier New", "Impact", "Comic Sans MS", "JetBrains Mono"];

export const PropertiesPanel: React.FC<{
  comp: Comp;
  layer: Layer | null;
  time: number;
  onLayer: (fn: (l: Layer) => Layer, key?: string) => void;
}> = ({ comp, layer: l, time, onLayer }) => {
  if (!l)
    return (
      <div className="p-4 text-[12px] text-[#6f6f77]" data-properties>
        Selecciona una capa para ver sus propiedades. Haz doble clic en una composición del Proyecto para cambiar su tamaño, duración y fotogramas.
      </div>
    );
  const setNum = <K extends "inPoint" | "outPoint">(k: K, v: number) => onLayer((x) => ({ ...x, [k]: v }), k);
  return (
    <div className="flex flex-col min-h-0 overflow-y-auto" data-properties>
      <div className="px-3 py-2 border-b border-black/40">
        <input value={l.name} onChange={(e) => onLayer((x) => ({ ...x, name: e.target.value }), "name")} onKeyDown={(e) => e.stopPropagation()} className="w-full bg-transparent text-[13px] font-semibold outline-none" data-layer-name />
        <div className="text-[10px] text-[#8b8b93] flex gap-3 mt-1">
          <span>
            Entrada <Scrub value={l.inPoint} step={1 / comp.fps} onChange={(v) => setNum("inPoint", Math.max(0, Math.min(l.outPoint - 1 / comp.fps, v)))} unit="s" />
          </span>
          <span>
            Salida <Scrub value={l.outPoint} step={1 / comp.fps} onChange={(v) => setNum("outPoint", Math.max(l.inPoint + 1 / comp.fps, v))} unit="s" />
          </span>
        </div>
      </div>
      {l.text && (
        <Section title="Texto">
          <textarea
            value={keyedValue(l.text.text, time)}
            onChange={(e) => onLayer((x) => ({ ...x, name: e.target.value.split("\n")[0].slice(0, 30) || "Texto", text: { ...x.text!, text: setAt(x.text!.text, time, e.target.value) } }), "text")}
            onKeyDown={(e) => e.stopPropagation()}
            rows={3}
            className="w-full bg-[#141416] rounded p-2 text-[12px] outline-none resize-y"
            data-text-input
          />
          <Select value={l.text.font} onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, font: v } }))} options={FONTS.map((f) => ({ value: f, label: f }))} />
          <div className="flex gap-2">
            <Select value={String(l.text.weight)} onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, weight: Number(v) } }))} options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: `Peso ${w}` }))} className="flex-1" />
            <Select value={l.text.align} onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, align: v as "left" | "center" | "right" } }))} options={[{ value: "left", label: "Izquierda" }, { value: "center", label: "Centro" }, { value: "right", label: "Derecha" }]} className="flex-1" />
          </div>
          <Toggle checked={l.text.italic} onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, italic: v } }))} label="Cursiva" accent={ACCENT} />
          <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
            Contorno
            <input type="color" value={l.text.stroke} onChange={(e) => onLayer((x) => ({ ...x, text: { ...x.text!, stroke: e.target.value } }))} className="w-6 h-5 bg-transparent" />
            <Scrub value={l.text.strokeWidth} min={0} max={40} onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, strokeWidth: v } }), "tsw")} unit="px" />
            <span className="ml-auto">Interlineado</span>
            <Scrub value={l.text.lineHeight} step={0.05} min={0.6} max={3} onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, lineHeight: v } }), "lh")} />
          </div>
          <Select
            value={l.text.animator}
            onChange={(v) => onLayer((x) => ({ ...x, text: { ...x.text!, animator: v as NonNullable<Layer["text"]>["animator"] } }))}
            options={[
              { value: "none", label: "Animador de texto: ninguno" },
              { value: "typewriter", label: "Máquina de escribir" },
              { value: "fadeChars", label: "Letras que aparecen" },
              { value: "slideChars", label: "Letras que suben" },
              { value: "scaleChars", label: "Letras que crecen" },
              { value: "blurChars", label: "Desde el desenfoque" },
              { value: "wave", label: "Ola continua" },
            ]}
          />
          {l.text.animator !== "none" && l.text.animator !== "wave" && <span className="text-[10px] text-[#6f6f77]">Anima «Animador: avance» (0 → 100 %) en la línea de tiempo.</span>}
        </Section>
      )}
      {l.shape && (
        <Section title="Forma">
          {(l.shape.kind === "star" || l.shape.kind === "polygon") && (
            <div className="flex items-center gap-3 text-[11px] text-[#9a9aa2]">
              Puntas <Scrub value={l.shape.points} min={3} max={40} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, points: Math.round(v) } }), "pts")} />
              {l.shape.kind === "star" && (
                <>
                  Radio interior <Scrub value={l.shape.innerRatio} step={0.01} min={0.05} max={1} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, innerRatio: v } }), "inner")} />
                </>
              )}
            </div>
          )}
          <Toggle checked={l.shape.fillOn} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, fillOn: v } }))} label="Relleno" accent={ACCENT} />
          {l.shape.fillOn && (
            <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
              <input type="color" value={keyedValue(l.shape.fill, time).slice(0, 7)} onChange={(e) => onLayer((x) => ({ ...x, shape: { ...x.shape!, fill: setAt(x.shape!.fill, time, e.target.value) } }), "fill")} className="w-7 h-6 bg-transparent" data-fill />
              <Toggle checked={l.shape.gradient.on} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, gradient: { ...x.shape!.gradient, on: v } } }))} label="Degradado" accent={ACCENT} />
              {l.shape.gradient.on && <input type="color" value={l.shape.gradient.to.slice(0, 7)} onChange={(e) => onLayer((x) => ({ ...x, shape: { ...x.shape!, gradient: { ...x.shape!.gradient, to: e.target.value } } }), "gto")} className="w-7 h-6 bg-transparent" />}
            </div>
          )}
          {l.shape.fillOn && l.shape.gradient.on && (
            <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
              Ángulo <Scrub value={l.shape.gradient.angle} min={-180} max={180} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, gradient: { ...x.shape!.gradient, angle: v } } }), "gang")} unit="°" />
              <Toggle checked={l.shape.gradient.radial} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, gradient: { ...x.shape!.gradient, radial: v } } }))} label="Radial" accent={ACCENT} />
            </div>
          )}
          <Toggle checked={l.shape.strokeOn} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, strokeOn: v } }))} label="Trazo" accent={ACCENT} />
          {l.shape.strokeOn && (
            <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
              <input type="color" value={keyedValue(l.shape.stroke, time).slice(0, 7)} onChange={(e) => onLayer((x) => ({ ...x, shape: { ...x.shape!, stroke: setAt(x.shape!.stroke, time, e.target.value) } }), "stroke")} className="w-7 h-6 bg-transparent" />
              Grosor <Scrub value={keyedValue(l.shape.strokeWidth, time)} min={0} max={200} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, strokeWidth: setAt(x.shape!.strokeWidth, time, v) } }), "sw")} unit="px" />
              Guiones <Scrub value={l.shape.dash} min={0} max={200} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, dash: v } }), "dash")} />
            </div>
          )}
          {l.shape.kind === "path" && <Toggle checked={l.shape.closed} onChange={(v) => onLayer((x) => ({ ...x, shape: { ...x.shape!, closed: v } }))} label="Trazado cerrado" accent={ACCENT} />}
        </Section>
      )}
      {l.color && (
        <Section title="Sólido">
          <input type="color" value={keyedValue(l.color, time).slice(0, 7)} onChange={(e) => onLayer((x) => ({ ...x, color: setAt(x.color!, time, e.target.value) }), "solid")} className="w-10 h-7 bg-transparent" />
        </Section>
      )}
      {(l.type === "video" || l.type === "audio" || l.type === "precomp") && (
        <Section title="Tiempo">
          <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
            Velocidad <Scrub value={l.timeStretch || 100} min={10} max={1000} onChange={(v) => onLayer((x) => ({ ...x, timeStretch: v }), "stretch")} unit="%" />
            Empieza en <Scrub value={l.startTime} step={1 / comp.fps} onChange={(v) => onLayer((x) => ({ ...x, startTime: v }), "st")} unit="s" />
          </div>
        </Section>
      )}
      <Section title="Efectos" right={<span className="text-[10px] text-[#6f6f77]">{l.effects.length}</span>}>
        {!l.effects.length && <span className="text-[11px] text-[#6f6f77]">Sin efectos. Haz doble clic en uno del panel «Efectos y ajustes».</span>}
        {l.effects.map((fx, i) => (
          <div key={fx.id} className="bg-[#1b1b1f] rounded p-2 flex flex-col gap-1.5" data-effect={EFFECTS[fx.kind].label}>
            <div className="flex items-center gap-1 text-[12px]">
              <button type="button" onClick={() => onLayer((x) => ({ ...x, effects: x.effects.map((e) => (e.id === fx.id ? { ...e, enabled: !e.enabled } : e)) }))} className="text-[#9a9aa2] hover:text-white" title="Activar o desactivar">
                {fx.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <span className="flex-1 font-medium">{EFFECTS[fx.kind].label}</span>
              <button type="button" disabled={i === 0} onClick={() => onLayer((x) => ({ ...x, effects: move(x.effects, i, i - 1) }))} className="text-[#9a9aa2] hover:text-white disabled:opacity-30">
                <ChevronUp size={12} />
              </button>
              <button type="button" disabled={i === l.effects.length - 1} onClick={() => onLayer((x) => ({ ...x, effects: move(x.effects, i, i + 1) }))} className="text-[#9a9aa2] hover:text-white disabled:opacity-30">
                <ChevronDown size={12} />
              </button>
              <button type="button" onClick={() => onLayer((x) => ({ ...x, effects: x.effects.filter((e) => e.id !== fx.id) }))} className="text-[#9a9aa2] hover:text-white" title="Quitar">
                <Trash2 size={12} />
              </button>
            </div>
            {EFFECTS[fx.kind].params.map((info) => {
              const prop = fx.params[info.key];
              const v = keyedValue(prop as never, time) as number | string;
              return (
                <div key={info.key} className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
                  <span className="flex-1">{info.label}</span>
                  {info.type === "color" ? (
                    <input type="color" value={String(v).slice(0, 7)} onChange={(e) => onLayer((x) => ({ ...x, effects: x.effects.map((ef) => (ef.id === fx.id ? { ...ef, params: { ...ef.params, [info.key]: setAt(ef.params[info.key] as never, time, e.target.value as never) } } : ef)) }), `fx-${fx.id}-${info.key}`)} className="w-6 h-5 bg-transparent" />
                  ) : (
                    <Scrub value={Number(v)} min={info.min} max={info.max} unit={info.unit} onChange={(n) => onLayer((x) => ({ ...x, effects: x.effects.map((ef) => (ef.id === fx.id ? { ...ef, params: { ...ef.params, [info.key]: setAt(ef.params[info.key] as never, time, n as never) } } : ef)) }), `fx-${fx.id}-${info.key}`)} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Section>
      {l.masks.length > 0 && (
        <Section title="Máscaras">
          {l.masks.map((m) => (
            <div key={m.id} className="bg-[#1b1b1f] rounded p-2 flex flex-col gap-1.5 text-[11px]" data-mask={m.name}>
              <div className="flex items-center gap-2">
                <span className="flex-1 font-medium text-[12px]">{m.name}</span>
                <button type="button" onClick={() => onLayer((x) => ({ ...x, masks: x.masks.filter((y) => y.id !== m.id) }))} className="text-[#9a9aa2] hover:text-white" title="Quitar">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex gap-2">
                <Select value={m.mode} onChange={(v) => onLayer((x) => ({ ...x, masks: x.masks.map((y) => (y.id === m.id ? { ...y, mode: v as typeof m.mode } : y)) }))} options={[{ value: "add", label: "Sumar" }, { value: "subtract", label: "Restar" }, { value: "intersect", label: "Intersecar" }]} className="flex-1" />
                <Toggle checked={m.inverted} onChange={(v) => onLayer((x) => ({ ...x, masks: x.masks.map((y) => (y.id === m.id ? { ...y, inverted: v } : y)) }))} label="Invertida" accent={ACCENT} />
              </div>
              <div className="flex items-center gap-2 text-[#9a9aa2]">
                Desvanecer <Scrub value={keyedValue(m.feather, time)} min={0} max={500} onChange={(v) => onLayer((x) => ({ ...x, masks: x.masks.map((y) => (y.id === m.id ? { ...y, feather: setAt(y.feather, time, v) } : y)) }), `mf-${m.id}`)} unit="px" />
              </div>
            </div>
          ))}
        </Section>
      )}
      <Section title="Opciones" defaultOpen={false}>
        <Toggle checked={l.motionBlur} onChange={(v) => onLayer((x) => ({ ...x, motionBlur: v }))} label="Desenfoque de movimiento" accent={ACCENT} />
        {l.volume && (
          <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
            Volumen <Scrub value={keyedValue(l.volume, time)} min={-60} max={12} onChange={(v) => onLayer((x) => ({ ...x, volume: setAt(x.volume!, time, v) }), "vol")} unit="dB" />
          </div>
        )}
        <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
          Etiqueta
          {["#e8590c", "#f59f00", "#d6336c", "#ae3ec9", "#4dabf7", "#20c997", "#94d82d", "#868e96"].map((c) => (
            <button key={c} type="button" onClick={() => onLayer((x) => ({ ...x, label: c }))} className={cx("w-4 h-4 rounded-sm", l.label === c && "ring-2 ring-white")} style={{ background: c }} />
          ))}
        </div>
      </Section>
    </div>
  );
};

function move<T>(arr: T[], from: number, to: number): T[] {
  const a = arr.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

export const centerOf = (c: Comp): Vec => [c.width / 2, c.height / 2];
