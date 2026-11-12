// Controles de interfaz comunes de las apps de Ilustración (tema oscuro):
// paneles, secciones, campos numéricos, deslizadores, selector de color…

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "./color";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/** Botón de icono de las barras de herramientas. */
export const IconButton: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
  className?: string;
  accent?: string;
  "data-tool"?: string;
}> = ({ icon: Icon, title, active, disabled, onClick, size = 16, className, accent = "#ff8a3d", ...rest }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}
    data-tool={rest["data-tool"]}
    className={cx(
      "w-8 h-8 flex items-center justify-center rounded-md transition-colors disabled:opacity-30",
      active ? "text-white" : "text-[#b9b9c0] hover:bg-white/10 hover:text-white",
      className
    )}
    style={active ? { backgroundColor: accent } : undefined}
  >
    <Icon size={size} />
  </button>
);

/** Sección plegable de un panel lateral. */
export const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; right?: React.ReactNode }> = ({ title, children, defaultOpen = true, right }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-black/40">
      <div className="flex items-center justify-between px-3 h-8">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad] hover:text-white">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
        </button>
        {right}
      </div>
      {open && <div className="px-3 pb-3 flex flex-col gap-2">{children}</div>}
    </div>
  );
};

export const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cx("text-[11px] text-[#9a9aa2] shrink-0", className)}>{children}</span>
);

/** Campo numérico que también se ajusta arrastrando sobre su etiqueta. */
export const NumberField: React.FC<{
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  title?: string;
}> = ({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, suffix, className, title }) => {
  const [text, setText] = useState(String(round(value)));
  useEffect(() => setText(String(round(value))), [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const commit = () => {
    const v = parseFloat(text.replace(",", "."));
    if (Number.isFinite(v)) onChange(clamp(v));
    else setText(String(round(value)));
  };
  const drag = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const start = value;
    const move = (ev: PointerEvent) => onChange(clamp(round(start + Math.round((ev.clientX - startX) / 2) * step)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <label className={cx("flex items-center gap-1 bg-[#141416] border border-black/50 rounded h-6 px-1.5 min-w-0", className)} title={title}>
      {label && (
        <span onPointerDown={drag} className="text-[10px] text-[#8b8b93] cursor-ew-resize select-none shrink-0">
          {label}
        </span>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(round(value + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1))));
          }
        }}
        className="w-full min-w-0 bg-transparent text-[11px] text-[#e4e4e8] outline-none font-mono"
      />
      {suffix && <span className="text-[10px] text-[#6f6f77]">{suffix}</span>}
    </label>
  );
};

const round = (v: number) => Math.round(v * 100) / 100;

/** Deslizador con valor numérico (ajustes de imagen, opacidad…). */
export const Slider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  /** Degradado de fondo de la pista (temperatura, matiz…). */
  track?: string;
  "data-name"?: string;
}> = ({ label, value, onChange, onCommit, min, max, step = 1, suffix, track, ...rest }) => (
  <div className="flex flex-col gap-0.5" data-slider={rest["data-name"] || label}>
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#b9b9c0]" onDoubleClick={() => onChange(min < 0 ? 0 : min)} title="Doble clic para restablecer">
        {label}
      </span>
      <input
        type="number"
        value={round(value)}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        onBlur={onCommit}
        className="w-14 bg-transparent text-right text-[11px] text-[#e4e4e8] font-mono outline-none"
      />
      {suffix && <span className="text-[10px] text-[#6f6f77] -ml-1">{suffix}</span>}
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      className="studio-range w-full"
      style={track ? ({ "--track": track } as React.CSSProperties) : undefined}
    />
  </div>
);

export const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  title?: string;
}> = ({ value, onChange, options, className, title }) => (
  <select
    value={value}
    title={title}
    onChange={(e) => onChange(e.target.value)}
    className={cx("bg-[#141416] border border-black/50 rounded h-6 px-1 text-[11px] text-[#e4e4e8] outline-none min-w-0", className)}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; accent?: string }> = ({ checked, onChange, label, accent = "#ff8a3d" }) => (
  <label
    className="flex items-center gap-2 text-[11px] text-[#c9c9cf] cursor-pointer select-none"
    onClick={(e) => {
      e.preventDefault();
      onChange(!checked);
    }}
    role="switch"
    aria-checked={checked}
  >
    <span
      className="w-7 h-4 rounded-full relative transition-colors"
      style={{ backgroundColor: checked ? accent : "#3a3a40" }}
    >
      <span className={cx("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", checked ? "left-3.5" : "left-0.5")} />
    </span>
    {label}
  </label>
);

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  accent?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}> = ({ children, onClick, primary, accent = "#ff8a3d", disabled, className, title }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={cx(
      "h-7 px-3 rounded-md text-[12px] font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5",
      primary ? "text-white hover:brightness-110" : "bg-[#34343a] text-[#e4e4e8] hover:bg-[#404047]",
      className
    )}
    style={primary ? { backgroundColor: accent } : undefined}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Selector de color (saturación/valor, matiz, opacidad y hexadecimal)
// ---------------------------------------------------------------------------

export const ColorPicker: React.FC<{
  color: string;
  alpha?: number;
  onChange: (hex: string, alpha: number) => void;
  showAlpha?: boolean;
  swatches?: string[];
}> = ({ color, alpha = 1, onChange, showAlpha = true, swatches }) => {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(color)));
  const lastHex = useRef(color);
  useEffect(() => {
    if (color.toLowerCase() !== lastHex.current.toLowerCase()) {
      lastHex.current = color;
      const next = rgbToHsv(hexToRgb(color));
      setHsv((h) => (next.s === 0 || next.v === 0 ? { ...next, h: h.h } : next));
    }
  }, [color]);
  const emit = (h: { h: number; s: number; v: number }, a = alpha) => {
    setHsv(h);
    const hex = rgbToHex(hsvToRgb(h));
    lastHex.current = hex;
    onChange(hex, a);
  };
  const dragIn = (e: React.PointerEvent, fn: (x: number, y: number) => void) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const at = (ev: { clientX: number; clientY: number }) => fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    at(e);
    const move = (ev: PointerEvent) => at(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const hue = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const [hexText, setHexText] = useState(color);
  useEffect(() => setHexText(color), [color]);
  return (
    <div className="flex flex-col gap-2" data-color-picker>
      <div
        className="relative h-28 rounded cursor-crosshair"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hue})` }}
        onPointerDown={(e) => dragIn(e, (x, y) => emit({ h: hsv.h, s: x, v: 1 - y }))}
      >
        <span
          className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <div
        className="relative h-3 rounded cursor-pointer"
        style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
        onPointerDown={(e) => dragIn(e, (x) => emit({ ...hsv, h: x * 360 }))}
      >
        <span className="absolute top-[-2px] w-1.5 h-4 -ml-[3px] rounded-sm bg-white shadow pointer-events-none" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      {showAlpha && (
        <div
          className="relative h-3 rounded cursor-pointer checker"
          onPointerDown={(e) => dragIn(e, (x) => onChange(color, Math.round(x * 100) / 100))}
        >
          <div className="absolute inset-0 rounded" style={{ background: `linear-gradient(to right, transparent, ${color})` }} />
          <span className="absolute top-[-2px] w-1.5 h-4 -ml-[3px] rounded-sm bg-white shadow pointer-events-none" style={{ left: `${alpha * 100}%` }} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded border border-black/50 checker relative overflow-hidden">
          <span className="absolute inset-0" style={{ backgroundColor: color, opacity: alpha }} />
        </span>
        <input
          value={hexText}
          onChange={(e) => setHexText(e.target.value)}
          onBlur={() => {
            const v = hexText.trim().startsWith("#") ? hexText.trim() : `#${hexText.trim()}`;
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(rgbToHex(hexToRgb(v)), alpha);
            else setHexText(color);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="flex-1 bg-[#141416] border border-black/50 rounded h-6 px-1.5 text-[11px] font-mono text-[#e4e4e8] outline-none"
          data-hex-input
        />
        {showAlpha && <span className="text-[11px] text-[#9a9aa2] font-mono w-9 text-right">{Math.round(alpha * 100)}%</span>}
      </div>
      {swatches && (
        <div className="grid grid-cols-10 gap-1">
          {swatches.map((s) => (
            <button key={s} type="button" title={s} onClick={() => onChange(s, alpha)} className="h-4 rounded-sm border border-black/40" style={{ backgroundColor: s }} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Muestra de color que abre el selector en una ventana flotante. */
export const ColorSwatch: React.FC<{ color: string; alpha?: number; onChange: (hex: string, alpha: number) => void; title?: string; size?: number; showAlpha?: boolean }> = ({
  color,
  alpha = 1,
  onChange,
  title,
  size = 24,
  showAlpha,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen(!open)}
        className="rounded border border-black/60 checker relative overflow-hidden block"
        style={{ width: size, height: size }}
      >
        <span className="absolute inset-0" style={{ backgroundColor: color, opacity: alpha }} />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-56 p-2 rounded-lg bg-[#2a2a2f] border border-black/60 shadow-2xl">
          <ColorPicker color={color} alpha={alpha} onChange={onChange} showAlpha={showAlpha} swatches={DEFAULT_SWATCHES} />
        </div>
      )}
    </div>
  );
};

export const DEFAULT_SWATCHES = [
  "#000000", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8", "#ffffff", "#7f1d1d", "#dc2626", "#f97316", "#fbbf24",
  "#facc15", "#a3e635", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
];

/** Ventana modal oscura con título, contenido y botones. */
export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }> = ({ title, onClose, children, footer, width = 420 }) => {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" data-modal-open onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#26262b] border border-black/60 rounded-xl shadow-2xl text-[#e4e4e8] max-h-[90vh] flex flex-col" style={{ width }}>
        <div className="px-4 h-11 flex items-center border-b border-black/40 font-semibold text-sm shrink-0">{title}</div>
        <div className="p-4 overflow-y-auto flex flex-col gap-3 text-[12px]">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-black/40 flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

/** Estilos comunes (tablero de transparencia, deslizadores). */
export const STUDIO_CSS = `
.checker{background-color:#fff;background-image:linear-gradient(45deg,#d4d4d8 25%,transparent 25%),linear-gradient(-45deg,#d4d4d8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d4d4d8 75%),linear-gradient(-45deg,transparent 75%,#d4d4d8 75%);background-size:10px 10px;background-position:0 0,0 5px,5px -5px,-5px 0}
.studio-range{-webkit-appearance:none;appearance:none;height:14px;background:transparent;cursor:pointer}
.studio-range::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--track,#4a4a52)}
.studio-range::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:#e4e4e8;margin-top:-4px;border:1px solid #111}
.studio-range::-moz-range-track{height:3px;border-radius:2px;background:var(--track,#4a4a52)}
.studio-range::-moz-range-thumb{width:11px;height:11px;border-radius:50%;background:#e4e4e8;border:1px solid #111}
`;
