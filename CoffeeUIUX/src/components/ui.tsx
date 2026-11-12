// Controles compactos para los paneles (campos numéricos, colores, listas).

import React, { useEffect, useState } from "react";

export const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode; dataId?: string }> = ({ title, action, children, dataId }) => (
  <section className="px-3 py-3 border-b border-[#e6e6e6]" data-section={dataId}>
    <div className="flex items-center justify-between mb-2 min-h-[20px]">
      <h3 className="text-[11px] font-semibold text-[#1e1e1e]">{title}</h3>
      {action}
    </div>
    <div className="flex flex-col gap-2">{children}</div>
  </section>
);

/** Campo numérico: Intro o salir lo aplica; ↑/↓ suman 1 (Mayús: 10). */
export const NumberField: React.FC<{
  label?: string;
  value: number | "";
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  title?: string;
  className?: string;
  dataField?: string;
}> = ({ label, value, onChange, min, max, step = 1, suffix, title, className = "", dataField }) => {
  const [text, setText] = useState(value === "" ? "" : String(round(value)));
  useEffect(() => setText(value === "" ? "" : String(round(value))), [value]);
  const commit = (raw: string) => {
    const v = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(v)) {
      setText(value === "" ? "" : String(round(value)));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
    onChange(clamped);
  };
  return (
    <label title={title} className={`flex items-center h-7 rounded-md bg-[#f5f5f5] hover:bg-[#efefef] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#0d99ff] px-2 gap-1 min-w-0 ${className}`}>
      {label && <span className="text-[10.5px] text-[#8a8a8a] shrink-0 w-3.5 text-center select-none">{label}</span>}
      <input
        data-field={dataField}
        value={text}
        placeholder={value === "" ? "Mixto" : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const base = Number(text) || 0;
            const next = base + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            setText(String(round(next)));
            commit(String(next));
          }
          e.stopPropagation();
        }}
        className="flex-1 min-w-0 bg-transparent outline-none text-[11.5px] text-[#1e1e1e]"
      />
      {suffix && <span className="text-[10.5px] text-[#8a8a8a] shrink-0">{suffix}</span>}
    </label>
  );
};

const round = (v: number) => Math.round(v * 100) / 100;

const HEX = /^#?[0-9a-f]{6}$/i;

/** Muestra de color con selector nativo y campo hexadecimal. */
export const ColorField: React.FC<{ value: string; onChange: (hex: string) => void; opacity?: number; onOpacity?: (o: number) => void; dataField?: string }> = ({ value, onChange, opacity, onOpacity, dataField }) => {
  const [text, setText] = useState(value.replace("#", "").toUpperCase());
  useEffect(() => setText(value.replace("#", "").toUpperCase()), [value]);
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="flex items-center h-7 rounded-md bg-[#f5f5f5] hover:bg-[#efefef] px-1.5 gap-1.5 flex-1 min-w-0">
        <label className="relative w-4 h-4 rounded-sm border border-black/10 shrink-0 cursor-pointer overflow-hidden" style={{ background: value }}>
          <input type="color" value={value.length === 7 ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <input
          data-field={dataField}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => (HEX.test(text) ? onChange(`#${text.replace("#", "").toLowerCase()}`) : setText(value.replace("#", "").toUpperCase()))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[11.5px] font-mono uppercase"
        />
      </div>
      {onOpacity && opacity !== undefined && (
        <NumberField value={Math.round(opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => onOpacity(v / 100)} className="w-[62px] shrink-0" />
      )}
    </div>
  );
};

export const SelectField: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string; dataField?: string; title?: string }> = ({
  value,
  onChange,
  options,
  className = "",
  dataField,
  title,
}) => (
  <select
    data-field={dataField}
    title={title}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => e.stopPropagation()}
    className={`h-7 rounded-md bg-[#f5f5f5] hover:bg-[#efefef] px-1.5 text-[11.5px] outline-none focus:ring-1 focus:ring-[#0d99ff] min-w-0 ${className}`}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const IconToggle: React.FC<{ active?: boolean; onClick: () => void; title: string; children: React.ReactNode; dataId?: string }> = ({ active, onClick, title, children, dataId }) => (
  <button
    type="button"
    title={title}
    data-btn={dataId}
    onClick={onClick}
    className={`h-7 min-w-7 px-1.5 rounded-md flex items-center justify-center text-[#333] ${active ? "bg-[#e5f4ff] text-[#0d99ff]" : "hover:bg-[#f0f0f0]"}`}
  >
    {children}
  </button>
);

export const SmallButton: React.FC<{ onClick: () => void; children: React.ReactNode; title?: string; dataId?: string; primary?: boolean; className?: string }> = ({ onClick, children, title, dataId, primary, className = "" }) => (
  <button
    type="button"
    title={title}
    data-btn={dataId}
    onClick={onClick}
    className={`h-7 px-2.5 rounded-md text-[11.5px] font-semibold flex items-center justify-center gap-1.5 ${primary ? "bg-[#0d99ff] text-white hover:bg-[#0a85e0]" : "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#1e1e1e]"} ${className}`}
  >
    {children}
  </button>
);
