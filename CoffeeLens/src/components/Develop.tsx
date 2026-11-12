// Módulo Revelar de CoffeeLens: vista previa, recorte y paneles de ajustes.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Crop as CropIcon, RotateCw, FlipHorizontal2, SplitSquareHorizontal, Wand2, RotateCcw, Copy, ClipboardPaste, Save } from "lucide-react";
import type { Catalog, Crop, Edits, Photo, Preset } from "../types";
import { BUILTIN_PRESETS, DEFAULT_EDITS, HSL_COLORS, HSL_NAMES, autoTone, cropped, curveLut, develop, histogram, orient } from "../services/develop";
import { loadOriginal } from "../services/library";
import { Button, IconButton, Section, Select, Slider, Toggle, cx } from "../studio/ui";

const ACC = "#d9480f";

export const DevelopView: React.FC<{
  photo: Photo;
  edits: Edits;
  onEdits: (e: Edits, key?: string) => void;
  cropMode: boolean;
  setCropMode: (v: boolean) => void;
  before: boolean;
  onHistogram: (h: ReturnType<typeof histogram> | null) => void;
}> = ({ photo, edits, onEdits, cropMode, setCropMode, before, onHistogram }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [original, setOriginal] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const working = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Original reducido para trabajar con fluidez (1800 px)
  useEffect(() => {
    let alive = true;
    setOriginal(null);
    setError(null);
    loadOriginal(photo)
      .then((c) => {
        if (!alive) return;
        const k = Math.min(1, 1800 / Math.max(c.width, c.height));
        const w = document.createElement("canvas");
        w.width = Math.round(c.width * k);
        w.height = Math.round(c.height * k);
        const g = w.getContext("2d")!;
        g.imageSmoothingQuality = "high";
        g.drawImage(c, 0, 0, w.width, w.height);
        working.current = w;
        setOriginal(w);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [photo.id, photo.path, photo.data]);

  // Revelado de la vista previa (sin bloquear los deslizadores)
  useEffect(() => {
    if (!original) return;
    const id = requestAnimationFrame(() => {
      const oriented = orient(original, edits);
      const src = cropMode ? oriented : cropped(oriented, edits.crop);
      const k = original.width / Math.max(1, photo.width);
      const out = before ? src : develop(src, { ...edits, crop: null }, k);
      setPreview(out);
      onHistogram(histogram(out));
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, edits, before, cropMode]);

  // Encaje en la vista
  const fit = useMemo(() => {
    if (!preview) return null;
    const k = Math.min((size.w - 40) / preview.width, (size.h - 40) / preview.height);
    const w = preview.width * k;
    const h = preview.height * k;
    return { k, w, h, x: (size.w - w) / 2, y: (size.h - h) / 2 };
  }, [preview, size]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !preview || !fit) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(fit.w * dpr);
    c.height = Math.round(fit.h * dpr);
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(preview, 0, 0, c.width, c.height);
  }, [preview, fit]);

  return (
    <div ref={hostRef} className="relative flex-1 min-w-0 bg-[#1a1a1d] overflow-hidden" data-develop-view>
      {error && <div className="absolute inset-0 flex items-center justify-center text-[#ff8787] text-sm p-6 text-center">{error}</div>}
      {!preview && !error && <div className="absolute inset-0 flex items-center justify-center text-[#8b8b93] text-sm">Cargando la foto…</div>}
      {fit && (
        <>
          <canvas ref={canvasRef} style={{ position: "absolute", left: fit.x, top: fit.y, width: fit.w, height: fit.h }} data-preview />
          {cropMode && <CropOverlay fit={fit} crop={edits.crop || { x: 0, y: 0, w: 1, h: 1, angle: 0 }} onChange={(c, key) => onEdits({ ...edits, crop: c }, key)} onDone={() => setCropMode(false)} />}
          {before && <span className="absolute top-3 left-3 bg-black/70 text-white text-[11px] px-2 py-1 rounded">Antes</span>}
        </>
      )}
    </div>
  );
};

const CropOverlay: React.FC<{ fit: { x: number; y: number; w: number; h: number }; crop: Crop; onChange: (c: Crop, key?: string) => void; onDone: () => void }> = ({ fit, crop, onChange, onDone }) => {
  const drag = (handle: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...crop };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / fit.w;
      const dy = (ev.clientY - sy) / fit.h;
      let { x, y, w, h } = o;
      if (handle === "move") {
        x = Math.min(1 - w, Math.max(0, o.x + dx));
        y = Math.min(1 - h, Math.max(0, o.y + dy));
      } else {
        if (handle.includes("w")) {
          x = Math.min(o.x + o.w - 0.05, Math.max(0, o.x + dx));
          w = o.w - (x - o.x);
        }
        if (handle.includes("e")) w = Math.min(1 - o.x, Math.max(0.05, o.w + dx));
        if (handle.includes("n")) {
          y = Math.min(o.y + o.h - 0.05, Math.max(0, o.y + dy));
          h = o.h - (y - o.y);
        }
        if (handle.includes("s")) h = Math.min(1 - o.y, Math.max(0.05, o.h + dy));
      }
      onChange({ ...o, x, y, w, h }, "crop");
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const r = { left: fit.x + crop.x * fit.w, top: fit.y + crop.y * fit.h, width: crop.w * fit.w, height: crop.h * fit.h };
  return (
    <div className="absolute inset-0" onDoubleClick={onDone} data-crop>
      <div className="absolute border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move" style={{ ...r, transform: `rotate(${-crop.angle}deg)` }} onPointerDown={drag("move")}>
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="border border-white/25" />
          ))}
        </div>
        {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
          <div
            key={h}
            onPointerDown={drag(h)}
            className="absolute w-3 h-3 bg-white border border-black/50"
            style={{
              left: h.includes("w") ? -6 : h.includes("e") ? "calc(100% - 6px)" : "calc(50% - 6px)",
              top: h.includes("n") ? -6 : h.includes("s") ? "calc(100% - 6px)" : "calc(50% - 6px)",
              cursor: `${h}-resize`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Paneles de ajustes
// ---------------------------------------------------------------------------

const Histogram: React.FC<{ h: ReturnType<typeof histogram> | null }> = ({ h }) => {
  const paths = useMemo(() => {
    if (!h) return null;
    const max = Math.max(1, ...[h.r, h.g, h.b].flatMap((a) => Array.from(a).slice(3, 252)));
    const mk = (a: Uint32Array) => `M0,80 ${Array.from(a, (v, i) => `L${i},${80 - Math.min(80, (v / max) * 76)}`).join(" ")} L255,80 Z`;
    return { r: mk(h.r), g: mk(h.g), b: mk(h.b) };
  }, [h]);
  return (
    <svg viewBox="0 0 256 80" className="w-full h-20 bg-[#141416] rounded" preserveAspectRatio="none" data-histogram>
      {paths && (
        <g style={{ mixBlendMode: "screen" }}>
          <path d={paths.r} fill="rgba(255,70,70,0.7)" />
          <path d={paths.g} fill="rgba(70,220,90,0.7)" />
          <path d={paths.b} fill="rgba(80,140,255,0.7)" />
        </g>
      )}
    </svg>
  );
};

const CurveEditor: React.FC<{ points: number[]; onChange: (p: number[]) => void }> = ({ points, onChange }) => {
  const ref = useRef<SVGSVGElement>(null);
  const lut = useMemo(() => curveLut(points), [points]);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < points.length; i += 2) pairs.push([points[i], points[i + 1]]);
  const toVal = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(Math.min(255, Math.max(0, ((e.clientX - r.left) / r.width) * 255))), Math.round(Math.min(255, Math.max(0, 255 - ((e.clientY - r.top) / r.height) * 255)))] as [number, number];
  };
  const dragPoint = (i: number) => {
    const move = (ev: PointerEvent) => {
      const next = [...pairs];
      next[i] = toVal(ev);
      onChange(next.sort((a, b) => a[0] - b[0]).flat());
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <svg
      ref={ref}
      viewBox="0 0 256 256"
      className="w-full aspect-square bg-[#141416] rounded cursor-crosshair"
      data-curve
      onPointerDown={(e) => {
        if ((e.target as Element).tagName === "circle") return;
        const v = toVal(e);
        const next = [...pairs, v].sort((a, b) => a[0] - b[0]);
        onChange(next.flat());
        dragPoint(next.findIndex((q) => q[0] === v[0] && q[1] === v[1]));
      }}
    >
      {[64, 128, 192].map((v) => (
        <g key={v} stroke="#2a2a2f">
          <line x1={v} y1={0} x2={v} y2={256} />
          <line x1={0} y1={v} x2={256} y2={v} />
        </g>
      ))}
      <polyline points={Array.from(lut, (v, i) => `${i},${255 - v * 255}`).join(" ")} fill="none" stroke="#e4e4e8" strokeWidth={1.5} />
      {pairs.map(([x, y], i) => (
        <circle key={i} cx={x} cy={255 - y} r={5} fill="#141416" stroke="#e4e4e8" strokeWidth={1.5} onPointerDown={(e) => { e.stopPropagation(); dragPoint(i); }} onDoubleClick={() => pairs.length > 2 && onChange(pairs.filter((_, j) => j !== i).flat())} />
      ))}
    </svg>
  );
};

export const DevelopPanel: React.FC<{
  edits: Edits;
  onEdits: (e: Edits, key?: string) => void;
  hist: ReturnType<typeof histogram> | null;
  photo: Photo;
  cropMode: boolean;
  setCropMode: (v: boolean) => void;
  before: boolean;
  setBefore: (v: boolean) => void;
}> = ({ edits, onEdits, hist, photo, cropMode, setCropMode, before, setBefore }) => {
  const [hslTab, setHslTab] = useState<"hslHue" | "hslSat" | "hslLum">("hslSat");
  const set = <K extends keyof Edits>(k: K, v: Edits[K]) => onEdits({ ...edits, [k]: v }, String(k));
  const s = (k: keyof Edits, label: string, min: number, max: number, step = 1, track?: string) => (
    <Slider key={k} label={label} value={edits[k] as number} min={min} max={max} step={step} onChange={(v) => set(k, v as never)} track={track} data-name={k} />
  );
  const ex = photo.exif;
  return (
    <aside className="w-[300px] shrink-0 bg-[#202023] border-l border-black/50 overflow-y-auto" data-develop-panel>
      <div className="p-3 border-b border-black/40 flex flex-col gap-2">
        <Histogram h={hist} />
        <span className="text-[10px] text-[#8b8b93] text-center">{[ex.iso ? `ISO ${ex.iso}` : "", ex.focal, ex.aperture, ex.shutter].filter(Boolean).join("   ") || `${photo.width} × ${photo.height}`}</span>
        <div className="flex items-center justify-center gap-1">
          <IconButton icon={CropIcon} title="Recortar y enderezar (R)" active={cropMode} onClick={() => setCropMode(!cropMode)} accent={ACC} />
          <IconButton icon={RotateCw} title="Girar 90°" onClick={() => set("rotate", (((edits.rotate + 90) % 360) as Edits["rotate"]))} />
          <IconButton icon={FlipHorizontal2} title="Voltear" onClick={() => set("flip", !edits.flip)} />
          <IconButton icon={SplitSquareHorizontal} title="Antes y después (\\)" active={before} onClick={() => setBefore(!before)} accent={ACC} />
        </div>
        {cropMode && (
          <div className="flex flex-col gap-2" data-crop-panel>
            <Select
              value=""
              onChange={(v) => {
                if (!v) return;
                const [a, b] = v.split(":").map(Number);
                const ratio = a / b;
                const swap = edits.rotate === 90 || edits.rotate === 270;
                const iw = swap ? photo.height : photo.width;
                const ih = swap ? photo.width : photo.height;
                const imgRatio = iw / ih;
                let w = 1;
                let h = 1;
                if (ratio > imgRatio) h = imgRatio / ratio;
                else w = ratio / imgRatio;
                onEdits({ ...edits, crop: { x: (1 - w) / 2, y: (1 - h) / 2, w, h, angle: edits.crop?.angle || 0 } });
              }}
              options={[{ value: "", label: "Proporción…" }, { value: "1:1", label: "1 : 1 (cuadrado)" }, { value: "4:5", label: "4 : 5 (Instagram)" }, { value: "3:2", label: "3 : 2" }, { value: "4:3", label: "4 : 3" }, { value: "16:9", label: "16 : 9" }, { value: "9:16", label: "9 : 16 (historia)" }, { value: "2:3", label: "2 : 3 (retrato)" }]}
            />
            <Slider label="Enderezar" value={edits.crop?.angle || 0} min={-45} max={45} step={0.1} onChange={(v) => onEdits({ ...edits, crop: { ...(edits.crop || { x: 0, y: 0, w: 1, h: 1 }), angle: v } }, "angle")} suffix="°" />
            <div className="flex gap-2">
              <Button onClick={() => onEdits({ ...edits, crop: null })}>Restablecer</Button>
              <Button primary accent={ACC} onClick={() => setCropMode(false)}>
                Listo
              </Button>
            </div>
          </div>
        )}
      </div>
      <Section title="Básicos">
        <div className="flex items-center justify-between">
          <Toggle checked={edits.bw} onChange={(v) => set("bw", v)} label="Blanco y negro" accent={ACC} />
          <Button
            onClick={() => {
              void loadOriginal(photo).then((c) => {
                const k = Math.min(1, 600 / Math.max(c.width, c.height));
                const small = document.createElement("canvas");
                small.width = Math.round(c.width * k);
                small.height = Math.round(c.height * k);
                small.getContext("2d")!.drawImage(c, 0, 0, small.width, small.height);
                onEdits({ ...edits, ...autoTone(small) });
              });
            }}
            title="Ajuste automático"
          >
            <Wand2 size={12} /> Auto
          </Button>
        </div>
        <span className="text-[10px] text-[#6f6f77] uppercase">Balance de blancos</span>
        {s("temp", "Temperatura", -100, 100, 1, "linear-gradient(to right,#4a90e2,#e0e0e0,#f5a623)")}
        {s("tint", "Matiz", -100, 100, 1, "linear-gradient(to right,#3cb44b,#e0e0e0,#d63fd6)")}
        <span className="text-[10px] text-[#6f6f77] uppercase">Tono</span>
        {s("exposure", "Exposición", -5, 5, 0.01)}
        {s("contrast", "Contraste", -100, 100)}
        {s("highlights", "Iluminaciones", -100, 100)}
        {s("shadows", "Sombras", -100, 100)}
        {s("whites", "Blancos", -100, 100)}
        {s("blacks", "Negros", -100, 100)}
        <span className="text-[10px] text-[#6f6f77] uppercase">Presencia</span>
        {s("texture", "Textura", -100, 100)}
        {s("clarity", "Claridad", -100, 100)}
        {s("dehaze", "Eliminar neblina", -100, 100)}
        {s("vibrance", "Intensidad", -100, 100)}
        {s("saturation", "Saturación", -100, 100)}
      </Section>
      <Section title="Curva de tonos" defaultOpen={false}>
        <CurveEditor points={edits.curve} onChange={(p) => set("curve", p)} />
        <Select
          value=""
          onChange={(v) => v && set("curve", v.split(",").map(Number))}
          options={[{ value: "", label: "Curva predefinida…" }, { value: "0,0,255,255", label: "Lineal" }, { value: "0,0,64,52,192,206,255,255", label: "Contraste medio" }, { value: "0,0,64,44,192,214,255,255", label: "Contraste fuerte" }, { value: "0,30,128,134,255,235", label: "Mate (desvaído)" }]}
        />
      </Section>
      <Section title="Mezcla de color (HSL)" defaultOpen={false}>
        <div className="flex gap-1">
          {(["hslHue", "hslSat", "hslLum"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setHslTab(k)} className={cx("flex-1 h-6 rounded text-[11px]", hslTab === k ? "bg-[#d9480f] text-white" : "bg-[#34343a] text-[#c9c9cf]")}>
              {k === "hslHue" ? "Tono" : k === "hslSat" ? "Saturación" : "Luminancia"}
            </button>
          ))}
        </div>
        {HSL_NAMES.map((n, i) => (
          <Slider
            key={n}
            label={n}
            value={edits[hslTab][i]}
            min={-100}
            max={100}
            onChange={(v) => set(hslTab, edits[hslTab].map((x, j) => (j === i ? v : x)))}
            track={`linear-gradient(to right, #444, ${HSL_COLORS[i]})`}
            data-name={`${hslTab}-${i}`}
          />
        ))}
      </Section>
      <Section title="Virado" defaultOpen={false}>
        {s("splitHighlightHue", "Tono de las luces", 0, 360, 1, "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)")}
        {s("splitHighlightSat", "Saturación de las luces", 0, 100)}
        {s("splitShadowHue", "Tono de las sombras", 0, 360, 1, "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)")}
        {s("splitShadowSat", "Saturación de las sombras", 0, 100)}
      </Section>
      <Section title="Detalle" defaultOpen={false}>
        {s("sharpen", "Enfoque", 0, 150)}
        {s("noise", "Reducción de ruido", 0, 100)}
      </Section>
      <Section title="Efectos" defaultOpen={false}>
        {s("vignette", "Viñeta", -100, 100)}
        {s("grain", "Grano", 0, 100)}
      </Section>
      <div className="p-3">
        <Button onClick={() => onEdits({ ...DEFAULT_EDITS })} className="w-full">
          <RotateCcw size={12} /> Restablecer todo
        </Button>
      </div>
    </aside>
  );
};

export const PresetsPanel: React.FC<{
  cat: Catalog;
  onApply: (p: Preset) => void;
  onSave: () => void;
  onDelete: (p: Preset) => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onHover: (p: Preset | null) => void;
}> = ({ cat, onApply, onSave, onDelete, onCopy, onPaste, canPaste, onHover }) => {
  const all = [...BUILTIN_PRESETS, ...cat.presets.map((p) => ({ ...p, group: "Mis ajustes" }))];
  const groups = [...new Set(all.map((p) => p.group))];
  return (
    <aside className="w-[210px] shrink-0 bg-[#202023] border-r border-black/50 overflow-y-auto" data-presets>
      <Section title="Ajustes preestablecidos">
        {groups.map((g) => (
          <div key={g} className="flex flex-col">
            <span className="text-[10px] uppercase text-[#6f6f77] mt-1">{g}</span>
            {all
              .filter((p) => p.group === g)
              .map((p) => (
                <div key={p.id} className="group flex items-center">
                  <button type="button" onClick={() => onApply(p)} onMouseEnter={() => onHover(p)} onMouseLeave={() => onHover(null)} className="flex-1 text-left text-[12px] px-2 h-6 rounded hover:bg-white/10 truncate" data-preset={p.name}>
                    {p.name}
                  </button>
                  {g === "Mis ajustes" && (
                    <button type="button" onClick={() => onDelete(p)} className="opacity-0 group-hover:opacity-100 text-[#8b8b93] hover:text-white px-1" title="Eliminar">
                      ×
                    </button>
                  )}
                </div>
              ))}
          </div>
        ))}
        <Button onClick={onSave}>
          <Save size={12} /> Guardar los ajustes actuales…
        </Button>
      </Section>
      <Section title="Copiar ajustes">
        <div className="flex gap-1">
          <Button onClick={onCopy} title="Copiar ajustes (Ctrl+Mayús+C)">
            <Copy size={12} /> Copiar
          </Button>
          <Button onClick={onPaste} disabled={!canPaste} title="Pegar a las fotos seleccionadas (Ctrl+Mayús+V)">
            <ClipboardPaste size={12} /> Pegar
          </Button>
        </div>
      </Section>
    </aside>
  );
};

export const Filmstrip: React.FC<{ photos: Photo[]; active: string; selected: string[]; onPick: (id: string, e: React.MouseEvent) => void }> = ({ photos, active, selected, onPick }) => (
  <div className="h-[84px] shrink-0 bg-[#1c1c1f] border-t border-black/50 flex items-center gap-1.5 px-2 overflow-x-auto" data-filmstrip>
    {photos.map((p) => (
      <button key={p.id} type="button" onClick={(e) => onPick(p.id, e)} className={cx("h-[68px] shrink-0 rounded overflow-hidden border-2", p.id === active ? "border-[#d9480f]" : selected.includes(p.id) ? "border-white/40" : "border-transparent")} title={p.name}>
        <img src={p.preview || p.thumb} alt="" className="h-full object-contain" draggable={false} />
      </button>
    ))}
  </div>
);
