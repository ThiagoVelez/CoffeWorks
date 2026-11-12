// Línea de tiempo: capas con su duración, propiedades animables con
// cronómetro, fotogramas clave, expresiones y área de trabajo.

import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, Timer, Diamond, ChevronLeft, Equal, Type, Square, Image as ImageIcon, Film, Music, Layers, Crosshair, SlidersHorizontal, Shapes } from "lucide-react";
import type { BlendMode, Comp, Keyframe, Layer, MatteMode, Prop, Vec } from "../types";
import { exprError, fmtTimecode, isAnimated, keyedValue, setAt, toggleKeyAt, toggleStopwatch } from "../services/anim";
import { layerProps, type PropRef } from "../services/props";
import { cx } from "../studio/ui";

export interface KeyRef {
  layer: string;
  path: string;
  id: string;
}

interface Props {
  comp: Comp;
  time: number;
  setTime: (t: number) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  onLayer: (id: string, fn: (l: Layer) => Layer, key?: string) => void;
  onComp: (fn: (c: Comp) => Comp, key?: string) => void;
  selectedKeys: KeyRef[];
  setSelectedKeys: (k: KeyRef[]) => void;
  onEditKey: (k: KeyRef) => void;
  pxPerSec: number;
  setPxPerSec: (v: number) => void;
}

const ROW = 26;
const LEFT = 470;

const TYPE_ICON: Record<Layer["type"], React.ComponentType<{ size?: number; className?: string }>> = {
  shape: Shapes,
  text: Type,
  image: ImageIcon,
  video: Film,
  audio: Music,
  solid: Square,
  null: Crosshair,
  precomp: Layers,
  adjustment: SlidersHorizontal,
};

export const BLEND_LABEL: Record<BlendMode, string> = {
  normal: "Normal",
  multiply: "Multiplicar",
  screen: "Trama",
  overlay: "Superponer",
  darken: "Oscurecer",
  lighten: "Aclarar",
  "color-dodge": "Sobreexponer color",
  "color-burn": "Subexponer color",
  "hard-light": "Luz fuerte",
  "soft-light": "Luz suave",
  difference: "Diferencia",
  exclusion: "Exclusión",
  hue: "Tono",
  saturation: "Saturación",
  color: "Color",
  luminosity: "Luminosidad",
  add: "Añadir",
};

export const MATTE_LABEL: Record<MatteMode, string> = {
  none: "Sin mate",
  alpha: "Mate alfa",
  alphaInverted: "Mate alfa invertido",
  luma: "Mate de luminancia",
  lumaInverted: "Luminancia invertida",
};

/** Número que se cambia arrastrando (como en After Effects) o escribiendo. */
export const Scrub: React.FC<{ value: number; onChange: (v: number, final: boolean) => void; step?: number; min?: number; max?: number; unit?: string; color?: string; title?: string }> = ({ value, onChange, step = 1, min, max, unit, color = "#74c0fc", title }) => {
  const [edit, setEdit] = useState<string | null>(null);
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const clamp = (v: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v));
  if (edit !== null)
    return (
      <input
        autoFocus
        value={edit}
        onChange={(e) => setEdit(e.target.value)}
        onBlur={() => {
          const n = Number(edit.replace(",", "."));
          if (isFinite(n)) onChange(clamp(n), true);
          setEdit(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEdit(null);
          e.stopPropagation();
        }}
        className="w-14 bg-[#111] text-[11px] font-mono px-1 rounded outline-none"
      />
    );
  return (
    <span
      title={title}
      className="cursor-ew-resize font-mono text-[11px] select-none hover:underline"
      style={{ color }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 2) d.moved = true;
        if (d.moved) onChange(clamp(Math.round((d.v + dx * step * (e.shiftKey ? 10 : e.ctrlKey ? 0.1 : 1)) * 100) / 100), false);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) setEdit(String(+value.toFixed(2)));
        else if (d) onChange(value, true);
      }}
    >
      {+value.toFixed(step < 1 ? 2 : 1)}
      {unit ? <span className="text-[#6f6f77] ml-0.5">{unit}</span> : null}
    </span>
  );
};

export const Timeline: React.FC<Props> = (p) => {
  const { comp, time } = p;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [width, setWidth] = useState(600);
  const [exprOpen, setExprOpen] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<number | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - LEFT));
    ro.observe(el);
    setWidth(el.clientWidth - LEFT);
    return () => ro.disconnect();
  }, []);

  const pps = p.pxPerSec;
  const toX = (t: number) => (t - scroll) * pps;
  const toT = (x: number) => Math.max(0, Math.min(comp.duration, x / pps + scroll));
  const snap = (t: number) => Math.round(t * comp.fps) / comp.fps;

  // Arrastres en el área de la derecha
  const drag = useRef<
    | { kind: "time" }
    | { kind: "bar"; id: string; mode: "move" | "in" | "out"; x0: number; l: Layer }
    | { kind: "keys"; x0: number; orig: { ref: KeyRef; t: number }[] }
    | { kind: "work"; edge: "in" | "out" | "move"; x0: number; a: number; b: number }
    | null
  >(null);

  const startTime = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { kind: "time" };
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    p.setTime(snap(toT(e.clientX - r.left)));
  };
  const moveAny = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const host = bodyRef.current!.getBoundingClientRect();
    const x = e.clientX - host.left - LEFT;
    if (d.kind === "time") p.setTime(snap(toT(x)));
    else if (d.kind === "bar") {
      const dt = snap((e.clientX - d.x0) / pps);
      const l = d.l;
      p.onLayer(
        d.id,
        (cur) =>
          d.mode === "move"
            ? { ...cur, inPoint: l.inPoint + dt, outPoint: l.outPoint + dt, startTime: l.startTime + dt, ...shiftKeys(l, dt) }
            : d.mode === "in"
            ? { ...cur, inPoint: Math.min(l.outPoint - 1 / comp.fps, Math.max(l.type === "video" || l.type === "audio" || l.type === "precomp" ? l.startTime : -Infinity, l.inPoint + dt)) }
            : { ...cur, outPoint: Math.max(l.inPoint + 1 / comp.fps, l.outPoint + dt) },
        `bar-${d.id}`
      );
    } else if (d.kind === "keys") {
      const dt = snap((e.clientX - d.x0) / pps);
      const byLayer = new Map<string, { ref: KeyRef; t: number }[]>();
      d.orig.forEach((o) => byLayer.set(o.ref.layer, [...(byLayer.get(o.ref.layer) || []), o]));
      byLayer.forEach((list, layerId) =>
        p.onLayer(
          layerId,
          (l) => {
            let next = l;
            for (const o of list) {
              const ref = layerProps(next).find((x) => x.path === o.ref.path);
              if (!ref) continue;
              const prop = ref.get(next);
              const keys = (prop.keys || []).map((k) => (k.id === o.ref.id ? { ...k, t: Math.max(0, Math.min(comp.duration, o.t + dt)) } : k)).sort((a, b) => a.t - b.t);
              next = ref.set(next, { ...prop, keys });
            }
            return next;
          },
          "keys-drag"
        )
      );
    } else if (d.kind === "work") {
      const dt = snap((e.clientX - d.x0) / pps);
      p.onComp(
        (c) =>
          d.edge === "in"
            ? { ...c, workIn: Math.max(0, Math.min(d.b - 1 / c.fps, d.a + dt)) }
            : d.edge === "out"
            ? { ...c, workOut: Math.min(c.duration, Math.max(d.a + 1 / c.fps, d.b + dt)) }
            : { ...c, workIn: Math.max(0, Math.min(c.duration - (d.b - d.a), d.a + dt)), workOut: Math.max(d.b - d.a, Math.min(c.duration, d.b + dt)) },
        "work"
      );
    }
  };
  const endAny = () => {
    drag.current = null;
  };

  const isKeySel = (l: Layer, path: string, k: Keyframe<unknown>) => p.selectedKeys.some((s) => s.layer === l.id && s.path === path && s.id === k.id);

  const setValue = (l: Layer, ref: PropRef, v: unknown, key: string) => {
    p.onLayer(l.id, (cur) => ref.set(cur, setAt(ref.get(cur), time, v)), key);
  };

  const ticks = () => {
    const out: React.ReactNode[] = [];
    const steps = [1 / comp.fps, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
    const step = steps.find((s) => s * pps > 60) || 120;
    for (let t = Math.ceil(scroll / step) * step; t < scroll + width / pps; t += step) {
      out.push(
        <div key={t} className="absolute top-0 h-full border-l border-white/15 text-[10px] text-[#8b8b93] pl-1 pointer-events-none" style={{ left: toX(t) }}>
          {step < 1 ? fmtTimecode(t, comp.fps) : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`}
        </div>
      );
    }
    return out;
  };

  const renderProp = (l: Layer, ref: PropRef) => {
    const prop = ref.get(l);
    const animated = isAnimated(prop);
    const value = keyedValue(prop, time);
    const keys = prop.keys || [];
    const onKey = keys.some((k) => Math.abs(k.t - time) < 0.5 / comp.fps);
    const prev = [...keys].reverse().find((k) => k.t < time - 1e-4);
    const next = keys.find((k) => k.t > time + 1e-4);
    const exprKey = `${l.id}.${ref.path}`;
    const err = prop.expr ? exprError(prop.expr) : null;
    return (
      <React.Fragment key={ref.path}>
        <div className="flex" style={{ height: ROW }} data-prop={ref.label}>
          <div className="flex items-center gap-1 pl-12 pr-2 border-r border-black/50 bg-[#1e1e22] text-[11px]" style={{ width: LEFT }}>
            <button type="button" title="Cronómetro: animar esta propiedad" onClick={() => p.onLayer(l.id, (cur) => ref.set(cur, toggleStopwatch(ref.get(cur), time)))} className={cx("p-0.5", animated ? "text-[#ffa94d]" : "text-[#6f6f77] hover:text-white")} data-stopwatch>
              <Timer size={12} />
            </button>
            {animated && (
              <span className="flex items-center">
                <button type="button" disabled={!prev} onClick={() => prev && p.setTime(prev.t)} className="text-[#9a9aa2] hover:text-white disabled:opacity-30" title="Clave anterior">
                  <ChevronLeft size={11} />
                </button>
                <button type="button" onClick={() => p.onLayer(l.id, (cur) => ref.set(cur, toggleKeyAt(ref.get(cur), time)))} className={onKey ? "text-[#ffa94d]" : "text-[#9a9aa2] hover:text-white"} title="Añadir o quitar clave aquí">
                  <Diamond size={10} fill={onKey ? "currentColor" : "none"} />
                </button>
                <button type="button" disabled={!next} onClick={() => next && p.setTime(next.t)} className="text-[#9a9aa2] hover:text-white disabled:opacity-30" title="Clave siguiente">
                  <ChevronRight size={11} />
                </button>
              </span>
            )}
            <button type="button" title={prop.expr ? `Expresión: ${prop.expr}` : "Añadir una expresión"} onClick={() => setExprOpen(exprOpen === exprKey ? null : exprKey)} className={cx("p-0.5", prop.expr ? (err ? "text-[#ff6b6b]" : "text-[#69db7c]") : "text-[#55555c] hover:text-white")} data-expr-toggle>
              <Equal size={11} />
            </button>
            <span className="text-[#c9c9cf] truncate flex-1">{ref.label}</span>
            <PropEditor refInfo={ref} value={value} onChange={(v, final) => setValue(l, ref, v, final ? "" : `edit-${l.id}-${ref.path}`)} />
          </div>
          <div className="relative flex-1" onPointerDown={startTime}>
            {keys.map((k) => (
              <div
                key={k.id}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer"
                style={{ left: toX(k.t) }}
                title={`${fmtTimecode(k.t, comp.fps)} · doble clic: suavizado`}
                data-key={`${ref.label}@${k.t.toFixed(2)}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture(e.pointerId);
                  const ref0 = { layer: l.id, path: ref.path, id: k.id };
                  const sel = isKeySel(l, ref.path, k) ? p.selectedKeys : e.shiftKey ? [...p.selectedKeys, ref0] : [ref0];
                  p.setSelectedKeys(sel);
                  const orig = sel
                    .map((s) => {
                      const ly = comp.layers.find((x) => x.id === s.layer);
                      const pr = ly && layerProps(ly).find((x) => x.path === s.path);
                      const kk = pr?.get(ly!).keys?.find((x) => x.id === s.id);
                      return kk ? { ref: s, t: kk.t } : null;
                    })
                    .filter(Boolean) as { ref: KeyRef; t: number }[];
                  drag.current = { kind: "keys", x0: e.clientX, orig };
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  p.onEditKey({ layer: l.id, path: ref.path, id: k.id });
                }}
              >
                <KeyGlyph ease={k.ease} selected={isKeySel(l, ref.path, k)} />
              </div>
            ))}
          </div>
        </div>
        {exprOpen === exprKey && (
          <div className="flex bg-[#17171a]" style={{ minHeight: ROW + 6 }}>
            <div className="flex items-center gap-2 pl-12 pr-2 py-1 border-r border-black/50" style={{ width: LEFT }}>
              <input
                autoFocus
                defaultValue={prop.expr || ""}
                placeholder="p. ej. wiggle(2, 30) · value + time * 90 · loopOut()"
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                onBlur={(e) => {
                  const expr = e.target.value.trim();
                  p.onLayer(l.id, (cur) => ref.set(cur, { ...ref.get(cur), expr: expr || undefined }));
                }}
                className={cx("flex-1 bg-[#0e0e10] rounded px-2 h-6 font-mono text-[11px] outline-none border", err ? "border-[#ff6b6b]" : "border-transparent")}
                data-expr
              />
            </div>
            <div className="flex-1 text-[10px] text-[#ff8787] px-2 flex items-center">{err}</div>
          </div>
        )}
      </React.Fragment>
    );
  };

  const work = { a: toX(comp.workIn), b: toX(comp.workOut) };

  return (
    <div className="h-full flex flex-col bg-[#1a1a1d] text-[#e4e4e8] select-none" onPointerMove={moveAny} onPointerUp={endAny} data-timeline>
      {/* Cabecera: código de tiempo, zoom y regla */}
      <div className="flex border-b border-black/60" style={{ height: 34 }}>
        <div className="flex items-center gap-3 px-3 border-r border-black/50" style={{ width: LEFT }}>
          <span className="font-mono text-[15px] text-[#ffc078]" data-timecode>
            {fmtTimecode(time, comp.fps)}
          </span>
          <span className="text-[10px] text-[#6f6f77]">
            {comp.fps} fps · {comp.width}×{comp.height}
          </span>
          <div className="flex-1" />
          <input type="range" min={20} max={600} value={pps} onChange={(e) => p.setPxPerSec(Number(e.target.value))} className="studio-range w-24" title="Zoom de la línea de tiempo" />
        </div>
        <div className="relative flex-1 overflow-hidden cursor-pointer bg-[#202024]" onPointerDown={startTime} onWheel={(e) => setScroll(Math.max(0, Math.min(comp.duration - 0.5, scroll + e.deltaY / pps / 2)))} data-ruler>
          {ticks()}
          {/* Área de trabajo */}
          <div className="absolute bottom-0 h-[7px] bg-[#c2367f]/60 cursor-grab" style={{ left: work.a, width: Math.max(4, work.b - work.a) }} onPointerDown={(e) => (e.stopPropagation(), (e.target as Element).setPointerCapture(e.pointerId), (drag.current = { kind: "work", edge: "move", x0: e.clientX, a: comp.workIn, b: comp.workOut }))} title="Área de trabajo (lo que se reproduce y se exporta)">
            <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-[#e64980] cursor-ew-resize" onPointerDown={(e) => (e.stopPropagation(), (e.target as Element).setPointerCapture(e.pointerId), (drag.current = { kind: "work", edge: "in", x0: e.clientX, a: comp.workIn, b: comp.workOut }))} />
            <div className="absolute right-0 top-0 bottom-0 w-[6px] bg-[#e64980] cursor-ew-resize" onPointerDown={(e) => (e.stopPropagation(), (e.target as Element).setPointerCapture(e.pointerId), (drag.current = { kind: "work", edge: "out", x0: e.clientX, a: comp.workIn, b: comp.workOut }))} />
          </div>
          <div className="absolute top-0 bottom-0 w-px bg-[#4dabf7] pointer-events-none" style={{ left: toX(time) }}>
            <div className="absolute -top-0 -left-[5px] w-[11px] h-[10px] bg-[#4dabf7]" style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
          </div>
        </div>
      </div>
      {/* Capas */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto overflow-x-hidden relative" onWheel={(e) => e.shiftKey && setScroll(Math.max(0, Math.min(comp.duration - 0.5, scroll + e.deltaY / pps / 2)))}>
        {comp.layers.length === 0 && <div className="p-4 text-[12px] text-[#6f6f77]">La composición está vacía. Añade capas desde el menú «Capa», arrastra recursos del panel Proyecto o dibuja con las herramientas.</div>}
        {comp.layers.map((l, i) => {
          const Icon = TYPE_ICON[l.type];
          const sel = p.selected.includes(l.id);
          return (
            <div key={l.id} data-layer={l.name}>
              <div
                className={cx("flex border-b border-black/40", sel ? "bg-[#3a2a36]" : "bg-[#222226]", dragRow === i && "outline outline-1 outline-[#e64980]")}
                style={{ height: ROW + 2 }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("text/coffee-layer")) {
                    e.preventDefault();
                    setDragRow(i);
                  }
                }}
                onDragLeave={() => setDragRow(null)}
                onDrop={(e) => {
                  setDragRow(null);
                  const from = Number(e.dataTransfer.getData("text/coffee-layer"));
                  if (!isFinite(from) || from === i) return;
                  p.onComp((c) => {
                    const layers = c.layers.slice();
                    const [m] = layers.splice(from, 1);
                    layers.splice(i, 0, m);
                    return { ...c, layers };
                  });
                }}
              >
                <div
                  className="flex items-center gap-1.5 px-2 border-r border-black/50 text-[12px]"
                  style={{ width: LEFT }}
                  onClick={(e) => p.setSelected(e.shiftKey ? (sel ? p.selected.filter((x) => x !== l.id) : [...p.selected, l.id]) : [l.id])}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/coffee-layer", String(i))}
                >
                  <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (c) => ({ ...c, visible: !c.visible })))} className="text-[#9a9aa2] hover:text-white" title="Visible">
                    {l.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (c) => ({ ...c, solo: !c.solo })))} className={cx("w-3.5 h-3.5 rounded-full border text-[8px] leading-none", l.solo ? "bg-[#ffd43b] border-[#ffd43b] text-black" : "border-[#55555c] text-transparent")} title="Solo">
                    •
                  </button>
                  <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (c) => ({ ...c, locked: !c.locked })))} className="text-[#6f6f77] hover:text-white" title="Bloquear">
                    {l.locked ? <Lock size={11} /> : <Unlock size={11} />}
                  </button>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: l.label }} />
                  <span className="text-[10px] text-[#6f6f77] w-4 text-right">{i + 1}</span>
                  <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (c) => ({ ...c, expanded: !c.expanded })))} className="text-[#9a9aa2] hover:text-white" data-twirl>
                    {l.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  <Icon size={12} className="text-[#ff8fab] shrink-0" />
                  <span className="truncate flex-1" title={l.name}>
                    {l.name}
                  </span>
                  <select value={l.blend} onClick={(e) => e.stopPropagation()} onChange={(e) => p.onLayer(l.id, (c) => ({ ...c, blend: e.target.value as BlendMode }))} className="bg-[#18181b] rounded text-[10px] h-5 w-[78px]" title="Modo de fusión">
                    {Object.entries(BLEND_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select value={l.matte} onClick={(e) => e.stopPropagation()} onChange={(e) => p.onLayer(l.id, (c) => ({ ...c, matte: e.target.value as MatteMode }))} disabled={i === 0} className="bg-[#18181b] rounded text-[10px] h-5 w-[66px]" title="Mate de seguimiento (usa la capa de encima)">
                    {Object.entries(MATTE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select value={l.parent || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => p.onLayer(l.id, (c) => ({ ...c, parent: e.target.value || null }))} className="bg-[#18181b] rounded text-[10px] h-5 w-[68px]" title="Primario (la capa sigue a otra)">
                    <option value="">Ninguno</option>
                    {comp.layers
                      .filter((x) => x.id !== l.id && x.parent !== l.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {comp.layers.indexOf(x) + 1}. {x.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="relative flex-1" onPointerDown={startTime}>
                  <div
                    className="absolute top-[4px] bottom-[4px] rounded-sm cursor-grab"
                    style={{ left: toX(l.inPoint), width: Math.max(3, (l.outPoint - l.inPoint) * pps), background: `${l.label}${sel ? "cc" : "77"}` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture(e.pointerId);
                      p.setSelected([l.id]);
                      drag.current = { kind: "bar", id: l.id, mode: "move", x0: e.clientX, l };
                    }}
                    data-bar
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize hover:bg-white/40" onPointerDown={(e) => (e.stopPropagation(), (e.target as Element).setPointerCapture(e.pointerId), (drag.current = { kind: "bar", id: l.id, mode: "in", x0: e.clientX, l }))} />
                    <div className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize hover:bg-white/40" onPointerDown={(e) => (e.stopPropagation(), (e.target as Element).setPointerCapture(e.pointerId), (drag.current = { kind: "bar", id: l.id, mode: "out", x0: e.clientX, l }))} />
                  </div>
                </div>
              </div>
              {l.expanded && layerProps(l).map((ref, j, all) => (
                <React.Fragment key={ref.path}>
                  {(j === 0 || all[j - 1].group !== ref.group) && (
                    <div className="flex text-[10px] uppercase tracking-wide text-[#8b8b93]" style={{ height: 20 }}>
                      <div className="pl-9 flex items-center border-r border-black/50 bg-[#1e1e22]" style={{ width: LEFT }}>
                        {ref.group}
                      </div>
                      <div className="flex-1" />
                    </div>
                  )}
                  {renderProp(l, ref)}
                </React.Fragment>
              ))}
            </div>
          );
        })}
        {/* Cabezal */}
        <div className="absolute top-0 bottom-0 w-px bg-[#4dabf7] pointer-events-none" style={{ left: LEFT + toX(time) }} />
      </div>
    </div>
  );
};

/** Desplaza todas las claves de la capa (al mover la barra). */
function shiftKeys(l: Layer, dt: number): Partial<Layer> {
  const sh = <T,>(pr: Prop<T>): Prop<T> => (pr.keys ? { ...pr, keys: pr.keys.map((k) => ({ ...k, t: k.t + dt })) } : pr);
  let next: Layer = l;
  for (const ref of layerProps(l)) next = ref.set(next, sh(ref.get(next)));
  return { transform: next.transform, shape: next.shape, text: next.text, effects: next.effects, masks: next.masks, color: next.color, volume: next.volume };
}

const KeyGlyph: React.FC<{ ease: Keyframe<unknown>["ease"]; selected: boolean }> = ({ ease, selected }) => {
  const fill = selected ? "#ffd43b" : "#c9c9cf";
  if (ease === "hold") return <div style={{ width: 9, height: 9, background: fill }} />;
  if (ease === "linear") return <div style={{ width: 9, height: 9, background: fill, transform: "rotate(45deg)" }} />;
  return <div style={{ width: 10, height: 10, background: fill, borderRadius: 5 }} />;
};

/** Editor del valor de una propiedad en la línea de tiempo. */
const PropEditor: React.FC<{ refInfo: PropRef; value: unknown; onChange: (v: unknown, final: boolean) => void }> = ({ refInfo, value, onChange }) => {
  const r = refInfo;
  if (r.kind === "num") return <Scrub value={Number(value)} onChange={(v, f) => onChange(v, f)} unit={r.unit} min={r.min} max={r.max} step={r.step ?? 1} />;
  if (r.kind === "vec") {
    const v = value as Vec;
    return (
      <span className="flex gap-1.5">
        <Scrub value={v[0]} onChange={(x, f) => onChange([x, v[1]], f)} unit={r.unit} />
        <Scrub value={v[1]} onChange={(y, f) => onChange([v[0], y], f)} unit={r.unit} />
      </span>
    );
  }
  if (r.kind === "rect") {
    const v = value as [number, number, number, number];
    return (
      <span className="flex gap-1">
        {v.map((n, i) => (
          <Scrub key={i} value={n} onChange={(x, f) => onChange(v.map((y, j) => (j === i ? x : y)), f)} />
        ))}
      </span>
    );
  }
  if (r.kind === "color")
    return (
      <input type="color" value={String(value).slice(0, 7)} onChange={(e) => onChange(e.target.value, true)} className="w-6 h-4 bg-transparent border-0 p-0 cursor-pointer" />
    );
  return <input value={String(value)} onChange={(e) => onChange(e.target.value, false)} onKeyDown={(e) => e.stopPropagation()} className="w-28 bg-[#111] text-[11px] px-1 rounded outline-none" />;
};
