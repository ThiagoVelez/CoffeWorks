// Panel de propiedades: ajustes del clip seleccionado (velocidad, volumen,
// fundidos, posición, filtros, texto...) o del proyecto si no hay selección.

import React from "react";
import { RotateCcw, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2, Copy, Scissors } from "lucide-react";
import type { Clip, MediaClip, MediaItem, ProjectSettings, TextAnimation, TextClip } from "../types";
import { DEFAULT_ADJUST, DEFAULT_TRANSFORM, FILTER_PRESETS, formatTime, maxDuration } from "../services/project";

interface InspectorProps {
  clip: Clip | null;
  media: MediaItem | undefined;
  settings: ProjectSettings;
  onClip: (clip: Clip, key?: string) => void;
  onSettings: (settings: ProjectSettings) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
}

const FONTS = ["Hanken Grotesk", "Arial", "Georgia", "Impact", "Verdana", "Trebuchet MS", "Courier New", "Comic Sans MS", "Times New Roman"];
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: "none", label: "Ninguna" },
  { id: "fade", label: "Fundido" },
  { id: "slide", label: "Deslizar hacia arriba" },
  { id: "pop", label: "Rebote" },
  { id: "typewriter", label: "Máquina de escribir" },
];
const RESOLUTIONS = [
  { label: "Horizontal 1080p (16:9)", width: 1920, height: 1080 },
  { label: "Horizontal 720p (16:9)", width: 1280, height: 720 },
  { label: "Vertical (9:16) · Reels, TikTok, Shorts", width: 1080, height: 1920 },
  { label: "Cuadrado (1:1)", width: 1080, height: 1080 },
  { label: "4K (16:9)", width: 3840, height: 2160 },
];

const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
  <div className="px-3.5 py-3 border-b border-[#232e2b]">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8fb5a8]">{title}</span>
      {action}
    </div>
    <div className="flex flex-col gap-2.5">{children}</div>
  </div>
);

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, format, onChange }) => (
  <label className="flex flex-col gap-1 text-[12px]">
    <span className="flex justify-between text-[#b9d3ca]">
      <span>{label}</span>
      <span className="font-mono text-[11px] text-[#e8f3ef]">{format ? format(value) : value}</span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#4fd1a5]" />
  </label>
);

const field = "w-full h-8 px-2 text-[12px] rounded-md bg-[#1b2422] border border-[#33413d] text-[#e8f3ef] outline-none focus:border-[#4fd1a5]";
const iconBtn = (active: boolean) =>
  `h-8 w-8 flex items-center justify-center rounded-md border ${active ? "bg-[#26a680] border-[#26a680] text-white" : "border-[#33413d] hover:bg-[#22302b]"}`;

export const Inspector: React.FC<InspectorProps> = ({ clip, media, settings, onClip, onSettings, onDelete, onDuplicate, onSplit }) => {
  if (!clip) {
    const resolution = RESOLUTIONS.find((r) => r.width === settings.width && r.height === settings.height);
    return (
      <div className="text-[#e8f3ef]">
        <Section title="Proyecto">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-[#b9d3ca]">Formato del video</span>
            <select
              className={field}
              value={resolution ? `${resolution.width}x${resolution.height}` : "custom"}
              onChange={(e) => {
                const r = RESOLUTIONS.find((x) => `${x.width}x${x.height}` === e.target.value);
                if (r) onSettings({ ...settings, width: r.width, height: r.height });
              }}
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.label} value={`${r.width}x${r.height}`}>
                  {r.label}
                </option>
              ))}
              {!resolution && <option value="custom">{`${settings.width} × ${settings.height}`}</option>}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-[#b9d3ca]">Fotogramas por segundo</span>
            <select className={field} value={settings.fps} onChange={(e) => onSettings({ ...settings, fps: Number(e.target.value) })}>
              {[24, 25, 30, 50, 60].map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between text-[12px]">
            <span className="text-[#b9d3ca]">Color de fondo</span>
            <input type="color" value={settings.background} onChange={(e) => onSettings({ ...settings, background: e.target.value })} className="h-8 w-12 bg-transparent rounded" />
          </label>
        </Section>
        <div className="px-4 py-4 text-[12px] text-[#7d9a90] leading-relaxed">
          Selecciona un clip en la línea de tiempo para cambiar su velocidad, volumen, filtros, posición o texto.
          <br />
          <br />
          <b className="text-[#b9d3ca]">Atajos:</b> Espacio reproducir · S dividir · Supr eliminar · Ctrl+D duplicar · ←/→ fotograma a fotograma.
        </div>
      </div>
    );
  }

  const set = (patch: Partial<Clip>, key = "props") => onClip({ ...clip, ...patch } as Clip, `${key}-${clip.id}`);
  const fades = (
    <Section title="Transiciones">
      <Slider label="Fundido de entrada" value={clip.fadeIn} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => set({ fadeIn: v }, "fadein")} />
      <Slider label="Fundido de salida" value={clip.fadeOut} min={0} max={Math.min(5, clip.duration / 2)} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => set({ fadeOut: v }, "fadeout")} />
    </Section>
  );

  const header = (
    <div className="px-3.5 py-3 border-b border-[#232e2b] flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate text-white">{clip.type === "text" ? "Texto" : media?.name || "Medio"}</div>
        <div className="text-[11px] font-mono text-[#8fb5a8]">
          {formatTime(clip.start, true)} → {formatTime(clip.start + clip.duration, true)} ({clip.duration.toFixed(1)} s)
        </div>
      </div>
      <button type="button" title="Dividir en el cabezal (S)" onClick={onSplit} className="p-1.5 rounded-md hover:bg-[#22302b]">
        <Scissors size={14} />
      </button>
      <button type="button" title="Duplicar (Ctrl+D)" onClick={onDuplicate} className="p-1.5 rounded-md hover:bg-[#22302b]">
        <Copy size={14} />
      </button>
      <button type="button" title="Eliminar (Supr)" onClick={onDelete} className="p-1.5 rounded-md hover:bg-[#3a2323] text-[#ef9a9a]">
        <Trash2 size={14} />
      </button>
    </div>
  );

  if (clip.type === "text") {
    const t = clip as TextClip;
    return (
      <div className="text-[#e8f3ef]">
        {header}
        <Section title="Texto">
          <textarea className={`${field} h-20 py-1.5 resize-none`} value={t.text} onChange={(e) => set({ text: e.target.value }, "text")} />
          <div className="flex gap-2">
            <select className={`${field} flex-1`} value={t.font} onChange={(e) => set({ font: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <input type="number" min={12} max={400} className={`${field} w-20`} value={t.size} onChange={(e) => set({ size: Number(e.target.value) || 48 }, "size")} />
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" title="Negrita" className={iconBtn(t.bold)} onClick={() => set({ bold: !t.bold })}>
              <Bold size={14} />
            </button>
            <button type="button" title="Cursiva" className={iconBtn(t.italic)} onClick={() => set({ italic: !t.italic })}>
              <Italic size={14} />
            </button>
            <div className="w-px h-6 bg-[#33413d] mx-0.5" />
            {(
              [
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["right", AlignRight],
              ] as const
            ).map(([align, Icon]) => (
              <button key={align} type="button" className={iconBtn(t.align === align)} onClick={() => set({ align })}>
                <Icon size={14} />
              </button>
            ))}
            <input type="color" title="Color del texto" value={t.color} onChange={(e) => set({ color: e.target.value }, "color")} className="h-8 w-10 ml-auto bg-transparent rounded" />
          </div>
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={t.outline} onChange={(e) => set({ outline: e.target.checked })} /> Contorno
          </label>
          <label className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={t.background !== null} onChange={(e) => set({ background: e.target.checked ? "rgba(0,0,0,0.6)" : null })} /> Fondo
            {t.background !== null && (
              <input
                type="color"
                value={t.background.startsWith("#") ? t.background : "#000000"}
                onChange={(e) => set({ background: e.target.value }, "bg")}
                className="h-7 w-10 ml-auto bg-transparent rounded"
              />
            )}
          </label>
        </Section>
        <Section title="Animación">
          <select className={field} value={t.animation} onChange={(e) => set({ animation: e.target.value as TextAnimation })}>
            {ANIMATIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Section>
        <Section title="Posición" action={<span className="text-[10px] text-[#7d9a90]">o arrástralo en la vista previa</span>}>
          <Slider label="Horizontal" value={t.x} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ x: v }, "x")} />
          <Slider label="Vertical" value={t.y} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ y: v }, "y")} />
          <div className="flex gap-1.5">
            {[
              ["Arriba", 0.15],
              ["Centro", 0.5],
              ["Abajo", 0.85],
            ].map(([label, y]) => (
              <button key={label} type="button" className="flex-1 h-7 rounded-md text-[11px] border border-[#33413d] hover:bg-[#22302b]" onClick={() => set({ x: 0.5, y: y as number })}>
                {label}
              </button>
            ))}
          </div>
        </Section>
        {fades}
      </div>
    );
  }

  const m = clip as MediaClip;
  const isAudio = media?.kind === "audio";
  const isImage = media?.kind === "image";
  return (
    <div className="text-[#e8f3ef]">
      {header}
      {!isImage && (
        <Section title="Velocidad y audio">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-[#b9d3ca]">Velocidad</span>
            <div className="grid grid-cols-4 gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`h-7 rounded-md text-[11px] border ${m.speed === s ? "bg-[#26a680] border-[#26a680] text-white" : "border-[#33413d] hover:bg-[#22302b]"}`}
                  onClick={() => {
                    // La duración en la línea de tiempo cambia con la velocidad
                    const sourceSpan = m.duration * m.speed;
                    const duration = Math.min(sourceSpan / s, maxDuration({ ...m, speed: s }, media));
                    onClip({ ...m, speed: s, duration, fadeIn: Math.min(m.fadeIn, duration / 2), fadeOut: Math.min(m.fadeOut, duration / 2) }, `speed-${m.id}`);
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </label>
          <Slider label="Volumen" value={m.volume} min={0} max={2} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ volume: v }, "volume")} />
        </Section>
      )}
      {!isAudio && (
        <>
          <Section
            title="Encuadre"
            action={
              <button type="button" title="Restablecer" className="text-[#8fb5a8] hover:text-white" onClick={() => set({ transform: { ...DEFAULT_TRANSFORM }, fit: "contain" })}>
                <RotateCcw size={12} />
              </button>
            }
          >
            <div className="flex gap-1.5">
              {(
                [
                  ["contain", "Ajustar"],
                  ["cover", "Rellenar"],
                ] as const
              ).map(([fit, label]) => (
                <button
                  key={fit}
                  type="button"
                  onClick={() => set({ fit })}
                  className={`flex-1 h-7 rounded-md text-[11px] border ${m.fit === fit ? "bg-[#26a680] border-[#26a680] text-white" : "border-[#33413d] hover:bg-[#22302b]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Slider label="Escala" value={m.transform.scale} min={0.1} max={4} step={0.01} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ transform: { ...m.transform, scale: v } }, "scale")} />
            <Slider label="Horizontal" value={m.transform.x} min={-1} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ transform: { ...m.transform, x: v } }, "tx")} />
            <Slider label="Vertical" value={m.transform.y} min={-1} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}`} onChange={(v) => set({ transform: { ...m.transform, y: v } }, "ty")} />
            <Slider label="Rotación" value={m.transform.rotation} min={-180} max={180} step={1} format={(v) => `${v}°`} onChange={(v) => set({ transform: { ...m.transform, rotation: v } }, "rot")} />
            <Slider label="Opacidad" value={m.transform.opacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ transform: { ...m.transform, opacity: v } }, "opacity")} />
          </Section>
          <Section
            title="Filtros"
            action={
              <button type="button" title="Quitar filtros" className="text-[#8fb5a8] hover:text-white" onClick={() => set({ adjust: { ...DEFAULT_ADJUST } })}>
                <RotateCcw size={12} />
              </button>
            }
          >
            <div className="grid grid-cols-4 gap-1">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => set({ adjust: { ...DEFAULT_ADJUST, ...preset.adjust } })}
                  className="h-7 rounded-md text-[10px] border border-[#33413d] hover:bg-[#22302b] truncate px-1"
                  title={preset.name}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <Slider label="Brillo" value={m.adjust.brightness} min={0} max={200} step={1} format={(v) => `${v}`} onChange={(v) => set({ adjust: { ...m.adjust, brightness: v } }, "bright")} />
            <Slider label="Contraste" value={m.adjust.contrast} min={0} max={200} step={1} format={(v) => `${v}`} onChange={(v) => set({ adjust: { ...m.adjust, contrast: v } }, "contrast")} />
            <Slider label="Saturación" value={m.adjust.saturation} min={0} max={300} step={1} format={(v) => `${v}`} onChange={(v) => set({ adjust: { ...m.adjust, saturation: v } }, "sat")} />
            <Slider label="Tono" value={m.adjust.hue} min={-180} max={180} step={1} format={(v) => `${v}°`} onChange={(v) => set({ adjust: { ...m.adjust, hue: v } }, "hue")} />
            <Slider label="Desenfoque" value={m.adjust.blur} min={0} max={20} step={0.5} format={(v) => `${v} px`} onChange={(v) => set({ adjust: { ...m.adjust, blur: v } }, "blur")} />
          </Section>
        </>
      )}
      {fades}
    </div>
  );
};
