// Diálogos de CoffeePhoto: ajustes (con vista previa), filtros, documento
// nuevo, tamaño de imagen y de lienzo, exportar e IA generativa.

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AdjustKind, Adjustment } from "../types";
import { ADJUST_LABELS, FILTER_DEFAULTS, FILTER_LABELS, curveLut, defaultAdjustment, type FilterKind, type FilterParams } from "../services/adjust";
import { Button, ColorSwatch, Modal, NumberField, Select, Slider, Toggle } from "../studio/ui";
import type { AiSettings } from "../services/ai";
import type { ExportFormat } from "../services/io";

const ACC = "#e8452c";

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

export const AdjustDialog: React.FC<{
  initial: Adjustment;
  histogram: Uint32Array | null;
  asLayer: boolean;
  onPreview: (a: Adjustment) => void;
  onApply: (a: Adjustment) => void;
  onCancel: () => void;
}> = ({ initial, histogram, asLayer, onPreview, onApply, onCancel }) => {
  const [adj, setAdj] = useState<Adjustment>(initial);
  const p = adj.params;
  const set = (k: string, v: number | string | number[]) => setAdj((a) => ({ ...a, params: { ...a.params, [k]: v } }));
  useEffect(() => {
    const id = window.setTimeout(() => onPreview(adj), 40);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adj]);
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
  const slider = (k: string, label: string, min: number, max: number, step = 1, track?: string) => <Slider key={k} label={label} value={num(k)} min={min} max={max} step={step} onChange={(v) => set(k, v)} track={track} data-name={k} />;
  let body: React.ReactNode = null;
  switch (adj.kind) {
    case "brightness":
      body = [slider("brightness", "Brillo", -150, 150), slider("contrast", "Contraste", -100, 100)];
      break;
    case "levels":
      body = (
        <>
          <Histogram data={histogram} />
          {slider("inBlack", "Entrada: negros", 0, 253)}
          {slider("gamma", "Entrada: medios (gamma)", 0.1, 9.99, 0.01)}
          {slider("inWhite", "Entrada: blancos", 2, 255)}
          {slider("outBlack", "Salida: negros", 0, 255)}
          {slider("outWhite", "Salida: blancos", 0, 255)}
        </>
      );
      break;
    case "curves":
      body = <CurvesEditor params={p} onChange={(k, v) => set(k, v)} histogram={histogram} />;
      break;
    case "hsl":
      body = (
        <>
          {slider("hue", "Tono", -180, 180, 1, "linear-gradient(to right,#0ff,#00f,#f0f,#f00,#ff0,#0f0,#0ff)")}
          {slider("saturation", "Saturación", -100, 100, 1, "linear-gradient(to right,#888,#f33)")}
          {slider("lightness", "Luminosidad", -100, 100, 1, "linear-gradient(to right,#000,#fff)")}
          <Toggle checked={num("colorize") > 0} onChange={(v) => set("colorize", v ? 1 : 0)} label="Colorear" accent={ACC} />
        </>
      );
      break;
    case "colorBalance":
      body = [
        slider("cyanRed", "Cian ↔ Rojo", -100, 100, 1, "linear-gradient(to right,#0ff,#f00)"),
        slider("magentaGreen", "Magenta ↔ Verde", -100, 100, 1, "linear-gradient(to right,#f0f,#0f0)"),
        slider("yellowBlue", "Amarillo ↔ Azul", -100, 100, 1, "linear-gradient(to right,#ff0,#00f)"),
      ];
      break;
    case "exposure":
      body = [slider("exposure", "Exposición", -5, 5, 0.01), slider("offset", "Desplazamiento", -0.5, 0.5, 0.005), slider("gamma", "Corrección gamma", 0.1, 9.99, 0.01)];
      break;
    case "vibrance":
      body = [slider("vibrance", "Intensidad", -100, 100), slider("saturation", "Saturación", -100, 100)];
      break;
    case "blackWhite":
      body = (
        <>
          {slider("reds", "Rojos", -200, 300)}
          {slider("greens", "Verdes", -200, 300)}
          {slider("blues", "Azules", -200, 300)}
          <div className="flex items-center gap-3">
            <Toggle checked={num("tint") > 0} onChange={(v) => set("tint", v ? 1 : 0)} label="Matiz" accent={ACC} />
            <ColorSwatch color={(p.tintColor as string) || "#e1b77c"} onChange={(c) => set("tintColor", c)} showAlpha={false} />
          </div>
        </>
      );
      break;
    case "photoFilter":
      body = (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#b9b9c0]">Color</span>
            <ColorSwatch color={(p.color as string) || "#ec8a00"} onChange={(c) => set("color", c)} showAlpha={false} />
            <Select
              value=""
              onChange={(v) => v && set("color", v)}
              options={[
                { value: "", label: "Filtros predefinidos…" },
                { value: "#ec8a00", label: "Filtro cálido (85)" },
                { value: "#006dff", label: "Filtro frío (80)" },
                { value: "#ff5d00", label: "Naranja" },
                { value: "#e82b00", label: "Rojo" },
                { value: "#19c919", label: "Verde" },
                { value: "#e2a85a", label: "Sepia" },
              ]}
            />
          </div>
          {slider("density", "Densidad", 1, 100)}
        </>
      );
      break;
    case "invert":
      body = <span className="text-[#b9b9c0]">Invierte los colores de la imagen.</span>;
      break;
    case "threshold":
      body = (
        <>
          <Histogram data={histogram} />
          {slider("level", "Nivel de umbral", 1, 255)}
        </>
      );
      break;
    case "posterize":
      body = slider("levels", "Niveles", 2, 64);
      break;
    case "gradientMap":
      body = (
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#b9b9c0]">Sombras</span>
          <ColorSwatch color={(p.from as string) || "#000000"} onChange={(c) => set("from", c)} showAlpha={false} />
          <span className="text-[11px] text-[#b9b9c0]">Luces</span>
          <ColorSwatch color={(p.to as string) || "#ffffff"} onChange={(c) => set("to", c)} showAlpha={false} />
        </div>
      );
      break;
  }
  return (
    <Modal
      title={`${ADJUST_LABELS[adj.kind]}${asLayer ? " (capa de ajuste)" : ""}`}
      onClose={onCancel}
      width={380}
      footer={
        <>
          <Button onClick={() => setAdj(defaultAdjustment(adj.kind))}>Restablecer</Button>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onApply(adj)}>
            Aceptar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5" data-adjust-dialog={adj.kind}>
        {body}
      </div>
    </Modal>
  );
};

const Histogram: React.FC<{ data: Uint32Array | null }> = ({ data }) => {
  const path = useMemo(() => {
    if (!data) return "";
    const max = Math.max(1, ...Array.from(data).slice(2, 254));
    let d = "M0,64";
    for (let i = 0; i < 256; i++) d += ` L${i},${64 - Math.min(64, (data[i] / max) * 64)}`;
    return `${d} L255,64 Z`;
  }, [data]);
  return (
    <svg viewBox="0 0 256 64" className="w-full h-16 bg-[#141416] rounded" preserveAspectRatio="none">
      <path d={path} fill="#8b8b93" />
    </svg>
  );
};

const CurvesEditor: React.FC<{ params: Adjustment["params"]; onChange: (k: string, v: number[]) => void; histogram: Uint32Array | null }> = ({ params, onChange, histogram }) => {
  const [channel, setChannel] = useState<"rgb" | "r" | "g" | "b">("rgb");
  const pts = (params[channel] as number[]) || [0, 0, 255, 255];
  const svgRef = useRef<SVGSVGElement>(null);
  const lut = useMemo(() => curveLut(pts), [pts]);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < pts.length; i += 2) pairs.push([pts[i], pts[i + 1]]);
  const toVal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [Math.round(Math.min(255, Math.max(0, ((e.clientX - r.left) / r.width) * 255))), Math.round(Math.min(255, Math.max(0, 255 - ((e.clientY - r.top) / r.height) * 255)))];
  };
  const startDrag = (index: number) => {
    const move = (ev: PointerEvent) => {
      const [x, y] = toVal(ev);
      const next = [...pairs];
      next[index] = [x, y];
      onChange(channel, next.sort((a, b) => a[0] - b[0]).flat());
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const color = channel === "r" ? "#ff6b6b" : channel === "g" ? "#51cf66" : channel === "b" ? "#4dabf7" : "#e4e4e8";
  return (
    <div className="flex flex-col gap-2" data-curves>
      <Select value={channel} onChange={(v) => setChannel(v as typeof channel)} options={[{ value: "rgb", label: "RGB" }, { value: "r", label: "Rojo" }, { value: "g", label: "Verde" }, { value: "b", label: "Azul" }]} />
      <svg
        ref={svgRef}
        viewBox="0 0 256 256"
        className="w-full aspect-square bg-[#141416] rounded cursor-crosshair"
        onPointerDown={(e) => {
          if ((e.target as Element).tagName === "circle") return;
          const [x, y] = toVal(e);
          const next = [...pairs, [x, y] as [number, number]].sort((a, b) => a[0] - b[0]);
          onChange(channel, next.flat());
          startDrag(next.findIndex((q) => q[0] === x && q[1] === y));
        }}
        data-curves-svg
      >
        {histogram && <Histo data={histogram} />}
        {[64, 128, 192].map((v) => (
          <g key={v} stroke="#2e2e33">
            <line x1={v} y1={0} x2={v} y2={256} />
            <line x1={0} y1={v} x2={256} y2={v} />
          </g>
        ))}
        <line x1={0} y1={256} x2={256} y2={0} stroke="#3a3a40" />
        <polyline points={Array.from(lut, (v, i) => `${i},${255 - v}`).join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
        {pairs.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={255 - y}
            r={5}
            fill="#141416"
            stroke={color}
            strokeWidth={1.5}
            onPointerDown={(e) => {
              e.stopPropagation();
              startDrag(i);
            }}
            onDoubleClick={() => pairs.length > 2 && onChange(channel, pairs.filter((_, j) => j !== i).flat())}
          />
        ))}
      </svg>
      <span className="text-[10px] text-[#8b8b93]">Clic para añadir un punto; arrastra para moverlo; doble clic para quitarlo.</span>
    </div>
  );
};

const Histo: React.FC<{ data: Uint32Array }> = ({ data }) => {
  const max = Math.max(1, ...Array.from(data).slice(2, 254));
  return <polygon points={`0,256 ${Array.from(data, (v, i) => `${i},${256 - Math.min(256, (v / max) * 200)}`).join(" ")} 255,256`} fill="#26262b" />;
};

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export const FilterDialog: React.FC<{ kind: FilterKind; onPreview: (p: FilterParams) => void; onApply: (p: FilterParams) => void; onCancel: () => void }> = ({ kind, onPreview, onApply, onCancel }) => {
  const [p, setP] = useState<FilterParams>(FILTER_DEFAULTS[kind] || {});
  useEffect(() => {
    const id = window.setTimeout(() => onPreview(p), 120);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);
  const s = (k: keyof FilterParams, label: string, min: number, max: number, step = 1) => (
    <Slider key={k} label={label} value={(p[k] as number) ?? 0} min={min} max={max} step={step} onChange={(v) => setP({ ...p, [k]: v })} data-name={k} />
  );
  const fields: Partial<Record<FilterKind, React.ReactNode>> = {
    gaussian: s("radius", "Radio", 0.5, 100, 0.5),
    motion: [s("angle", "Ángulo", -180, 180), s("distance", "Distancia", 1, 200)],
    unsharp: [s("amount", "Cantidad", 1, 500), s("radius", "Radio", 0.5, 50, 0.5), s("threshold", "Umbral", 0, 255)],
    noise: [s("amount", "Cantidad", 1, 100), <Toggle key="m" checked={p.mono !== false} onChange={(v) => setP({ ...p, mono: v })} label="Monocromático" accent={ACC} />],
    denoise: s("radius", "Intensidad", 1, 3),
    pixelate: s("size", "Tamaño de celda", 2, 200),
    vignette: [s("amount", "Cantidad", 0, 100), s("size", "Tamaño", 10, 100)],
    oil: [s("radius", "Radio", 1, 8), s("size", "Niveles", 4, 40)],
  };
  return (
    <Modal
      title={FILTER_LABELS[kind].replace("…", "")}
      onClose={onCancel}
      width={340}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onApply(p)}>
            Aceptar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5" data-filter-dialog={kind}>
        {fields[kind]}
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Documento nuevo, tamaño de imagen y de lienzo
// ---------------------------------------------------------------------------

export const PRESETS: Array<{ label: string; w: number; h: number; dpi?: number }> = [
  { label: "Full HD (1920 × 1080)", w: 1920, h: 1080 },
  { label: "4K UHD (3840 × 2160)", w: 3840, h: 2160 },
  { label: "Publicación de Instagram (1080 × 1080)", w: 1080, h: 1080 },
  { label: "Historia / Reel (1080 × 1920)", w: 1080, h: 1920 },
  { label: "Miniatura de YouTube (1280 × 720)", w: 1280, h: 720 },
  { label: "Portada de Facebook (1640 × 624)", w: 1640, h: 624 },
  { label: "Carta (8,5 × 11 in, 300 ppp)", w: 2550, h: 3300, dpi: 300 },
  { label: "A4 (210 × 297 mm, 300 ppp)", w: 2480, h: 3508, dpi: 300 },
  { label: "Foto 10 × 15 cm (300 ppp)", w: 1181, h: 1772, dpi: 300 },
  { label: "Icono (512 × 512)", w: 512, h: 512 },
];

export const NewDocDialog: React.FC<{ onCreate: (w: number, h: number, dpi: number, bg: string | null, name: string) => void; onCancel: () => void }> = ({ onCreate, onCancel }) => {
  const [w, setW] = useState(1920);
  const [h, setH] = useState(1080);
  const [dpi, setDpi] = useState(72);
  const [bg, setBg] = useState<"white" | "black" | "transparent" | "custom">("white");
  const [custom, setCustom] = useState("#f4e9dc");
  const [name, setName] = useState("Sin título");
  return (
    <Modal
      title="Documento nuevo"
      onClose={onCancel}
      width={440}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onCreate(w, h, dpi, bg === "white" ? "#ffffff" : bg === "black" ? "#000000" : bg === "custom" ? custom : null, name)}>
            Crear
          </Button>
        </>
      }
    >
      <input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#141416] border border-black/50 rounded h-7 px-2 text-[13px] outline-none" data-new-name />
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setW(p.w);
              setH(p.h);
              setDpi(p.dpi || 72);
            }}
            className={`text-left px-2 py-1.5 rounded text-[11px] ${w === p.w && h === p.h ? "bg-[#e8452c]/30 text-white" : "bg-[#1d1d21] text-[#c9c9cf] hover:bg-white/10"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Ancho" value={w} min={1} max={12000} onChange={setW} suffix="px" />
        <NumberField label="Alto" value={h} min={1} max={12000} onChange={setH} suffix="px" />
        <NumberField label="Resol." value={dpi} min={36} max={1200} onChange={setDpi} suffix="ppp" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#b9b9c0]">Fondo</span>
        <Select
          value={bg}
          onChange={(v) => setBg(v as typeof bg)}
          options={[
            { value: "white", label: "Blanco" },
            { value: "black", label: "Negro" },
            { value: "transparent", label: "Transparente" },
            { value: "custom", label: "Color…" },
          ]}
        />
        {bg === "custom" && <ColorSwatch color={custom} onChange={setCustom} showAlpha={false} />}
      </div>
    </Modal>
  );
};

export const SizeDialog: React.FC<{
  mode: "image" | "canvas";
  width: number;
  height: number;
  dpi: number;
  onApply: (w: number, h: number, extra: { dpi: number; anchor: string; resample: boolean }) => void;
  onCancel: () => void;
}> = ({ mode, width, height, dpi, onApply, onCancel }) => {
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [lock, setLock] = useState(true);
  const [res, setRes] = useState(dpi);
  const [anchor, setAnchor] = useState("c");
  const ratio = width / height;
  return (
    <Modal
      title={mode === "image" ? "Tamaño de imagen" : "Tamaño de lienzo"}
      onClose={onCancel}
      width={360}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onApply(Math.round(w), Math.round(h), { dpi: res, anchor, resample: true })}>
            Aceptar
          </Button>
        </>
      }
    >
      <span className="text-[#8b8b93]">
        Actual: {width} × {height} px
      </span>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Ancho" value={w} min={1} max={16000} onChange={(v) => { setW(v); if (lock) setH(Math.round(v / ratio)); }} suffix="px" />
        <NumberField label="Alto" value={h} min={1} max={16000} onChange={(v) => { setH(v); if (lock) setW(Math.round(v * ratio)); }} suffix="px" />
      </div>
      <Toggle checked={lock} onChange={setLock} label="Mantener proporciones" accent={ACC} />
      {mode === "image" && <NumberField label="Resolución" value={res} min={36} max={1200} onChange={setRes} suffix="ppp" className="w-40" />}
      {mode === "canvas" && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#b9b9c0]">Ancla</span>
          <div className="grid grid-cols-3 gap-0.5">
            {["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"].map((a) => (
              <button key={a} type="button" onClick={() => setAnchor(a)} className={`w-5 h-5 rounded-sm ${anchor === a ? "bg-[#e8452c]" : "bg-[#34343a] hover:bg-[#404047]"}`} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------

export const ExportDialog: React.FC<{ width: number; height: number; onExport: (f: ExportFormat, o: { quality: number; scale: number; background: string }) => void; onCancel: () => void }> = ({ width, height, onExport, onCancel }) => {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(100);
  const [bg, setBg] = useState("#ffffff");
  return (
    <Modal
      title="Exportar"
      onClose={onCancel}
      width={380}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onExport(format, { quality: quality / 100, scale: scale / 100, background: bg })}>
            Exportar
          </Button>
        </>
      }
    >
      <Select
        value={format}
        onChange={(v) => setFormat(v as ExportFormat)}
        options={[
          { value: "png", label: "PNG (con transparencia)" },
          { value: "jpg", label: "JPG" },
          { value: "webp", label: "WebP" },
          { value: "pdf", label: "PDF" },
          { value: "layers", label: "Capas como PNG (ZIP)" },
        ]}
      />
      {(format === "jpg" || format === "webp" || format === "pdf") && <Slider label="Calidad" value={quality} min={10} max={100} onChange={setQuality} suffix="%" />}
      {format !== "layers" && (
        <>
          <Slider label="Escala" value={scale} min={5} max={400} onChange={setScale} suffix="%" />
          <span className="text-[#8b8b93]">
            {Math.round((width * scale) / 100)} × {Math.round((height * scale) / 100)} px
          </span>
        </>
      )}
      {(format === "jpg" || format === "pdf") && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#b9b9c0]">Fondo de las zonas transparentes</span>
          <ColorSwatch color={bg} onChange={setBg} showAlpha={false} />
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// IA generativa
// ---------------------------------------------------------------------------

export const AiSettingsDialog: React.FC<{ settings: AiSettings; onSave: (s: AiSettings) => void; onCancel: () => void }> = ({ settings, onSave, onCancel }) => {
  const [s, setS] = useState(settings);
  const field = (k: keyof AiSettings, label: string, type = "text") => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[#b9b9c0]">{label}</span>
      <input type={type} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="bg-[#141416] border border-black/50 rounded h-7 px-2 text-[12px] outline-none font-mono" data-ai-field={k} />
    </label>
  );
  return (
    <Modal
      title="Configurar IA generativa"
      onClose={onCancel}
      width={420}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onSave(s)}>
            Guardar
          </Button>
        </>
      }
    >
      <span className="text-[#b9b9c0] leading-relaxed">Funciona con cualquier servicio compatible con la API de imágenes de OpenAI. La clave solo se guarda en este equipo.</span>
      {field("baseUrl", "Dirección del servicio")}
      {field("model", "Modelo")}
      {field("apiKey", "Clave de API", "password")}
    </Modal>
  );
};

export const AiPromptDialog: React.FC<{ mode: "fill" | "generate"; onRun: (prompt: string, size: "1024x1024" | "1536x1024" | "1024x1536") => void; onCancel: () => void; onSettings: () => void }> = ({ mode, onRun, onCancel, onSettings }) => {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<"1024x1024" | "1536x1024" | "1024x1536">("1024x1024");
  return (
    <Modal
      title={mode === "fill" ? "Relleno generativo" : "Generar imagen"}
      onClose={onCancel}
      width={440}
      footer={
        <>
          <Button onClick={onSettings}>Configurar…</Button>
          <div className="flex-1" />
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACC} onClick={() => onRun(prompt, size)} disabled={mode === "generate" && !prompt.trim()}>
            Generar
          </Button>
        </>
      }
    >
      <span className="text-[#b9b9c0]">{mode === "fill" ? "Describe qué quieres en la zona seleccionada. Déjalo vacío para quitar lo que hay y continuar el fondo." : "Describe la imagen; se añadirá como una capa nueva."}</span>
      <textarea autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="bg-[#141416] border border-black/50 rounded p-2 text-[12px] outline-none resize-none" placeholder={mode === "fill" ? "Un globo rojo en el cielo" : "Una taza de café humeante sobre una mesa de madera, luz de la mañana"} />
      {mode === "generate" && (
        <Select value={size} onChange={(v) => setSize(v as typeof size)} options={[{ value: "1024x1024", label: "Cuadrada (1024 × 1024)" }, { value: "1536x1024", label: "Horizontal (1536 × 1024)" }, { value: "1024x1536", label: "Vertical (1024 × 1536)" }]} />
      )}
    </Modal>
  );
};

export const ADJUST_MENU: AdjustKind[] = ["brightness", "levels", "curves", "exposure", "vibrance", "hsl", "colorBalance", "blackWhite", "photoFilter", "invert", "posterize", "threshold", "gradientMap"];
