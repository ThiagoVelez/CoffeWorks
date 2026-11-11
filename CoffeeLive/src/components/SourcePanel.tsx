// Panel lateral con las propiedades y los filtros de la fuente seleccionada.

import React, { useState } from "react";
import { Trash2, Maximize, CornerDownRight, FlipHorizontal, FlipVertical, RotateCcw, Image as ImageIcon, Lock, Unlock, X } from "lucide-react";
import type { StudioSource } from "../types";
import { DEFAULT_FILTERS, SOURCE_LABEL } from "../services/live";

interface SourcePanelProps {
  source: StudioSource;
  active: boolean;
  cameras: MediaDeviceInfo[];
  onChange: (patch: Partial<StudioSource>, key?: string) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onRemove: () => void;
  onFit: (mode: "full" | "corner" | "center") => void;
  onPickImage: () => void;
  onAddSlides: () => void;
  onPickMedia: () => void;
  onClose: () => void;
}

const field = "w-full h-8 px-2 text-[12px] rounded-md bg-[#201713] border border-[#3a2b23] text-[#f5e9df] outline-none focus:border-[#ff9d4d]";
const small = "h-7 px-2 rounded-md text-[11px] font-semibold flex items-center gap-1.5 bg-[#2c201a] hover:bg-[#3a2a21] text-[#f0dccb] disabled:opacity-40";

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}) => (
  <label className="flex flex-col gap-1 text-[12px]">
    <span className="flex justify-between text-[#d9bfae]">
      <span>{label}</span>
      <span className="font-mono text-[11px] text-[#f5e9df]">
        {value}
        {unit}
      </span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#ff8a2a]" />
  </label>
);

export const SourcePanel: React.FC<SourcePanelProps> = ({
  source,
  active,
  cameras,
  onChange,
  onActivate,
  onDeactivate,
  onRemove,
  onFit,
  onPickImage,
  onAddSlides,
  onPickMedia,
  onClose,
}) => {
  const [tab, setTab] = useState<"props" | "filters">("props");
  const f = source.filters;
  const setFilters = (patch: Partial<StudioSource["filters"]>, key = "filters") => onChange({ filters: { ...f, ...patch } }, `${key}-${source.id}`);
  const capture = source.kind === "screen" || source.kind === "camera";
  const visual = source.kind !== "text" && source.kind !== "color";

  return (
    <aside className="w-80 shrink-0 border-l border-[#33261f] bg-[#18110e] flex flex-col overflow-hidden text-[#f5e9df]">
      <div className="h-9 px-3 flex items-center justify-between border-b border-[#33261f]">
        <span className="text-[12px] font-semibold truncate">{source.name}</span>
        <button type="button" title="Cerrar" onClick={onClose} className="p-1 rounded hover:bg-[#2c201a]">
          <X size={14} />
        </button>
      </div>
      <div className="flex border-b border-[#33261f]">
        {(
          [
            ["props", "Propiedades"],
            ["filters", "Filtros"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 h-9 text-[12px] font-semibold border-b-2 ${tab === id ? "border-[#ff8a2a] text-white" : "border-transparent text-[#b79a87] hover:text-white"}`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 text-[12px]">
        {tab === "props" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[#d9bfae]">Nombre</span>
              <input className={field} value={source.name} onChange={(e) => onChange({ name: e.target.value }, `name-${source.id}`)} />
            </label>
            <div className="text-[11px] text-[#9c7f6d]">Tipo: {SOURCE_LABEL[source.kind]}</div>

            {capture && (
              <div className="flex gap-1.5 flex-wrap">
                {active ? (
                  <>
                    <button type="button" className={small} onClick={onDeactivate}>
                      Detener captura
                    </button>
                    {source.kind === "screen" && (
                      <button type="button" className={small} onClick={onActivate} title="Elegir otra pantalla o ventana">
                        Cambiar pantalla o ventana
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" className={small} onClick={onActivate}>
                    {source.kind === "screen" ? "Capturar pantalla o ventana" : "Activar cámara"}
                  </button>
                )}
              </div>
            )}

            {source.kind === "camera" && (
              <label className="flex flex-col gap-1">
                <span className="text-[#d9bfae]">Dispositivo</span>
                <select className={field} value={source.deviceId || ""} onChange={(e) => onChange({ deviceId: e.target.value || undefined })}>
                  <option value="">Cámara predeterminada</option>
                  {cameras.map((c, i) => (
                    <option key={c.deviceId || i} value={c.deviceId}>
                      {c.label || `Cámara ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {source.kind === "image" && (
              <button type="button" className={small} onClick={onPickImage}>
                <ImageIcon size={12} /> Cambiar imagen
              </button>
            )}

            {source.kind === "slideshow" && (
              <>
                <div className="flex items-center gap-2">
                  <button type="button" className={small} onClick={onAddSlides}>
                    <ImageIcon size={12} /> Añadir imágenes
                  </button>
                  <span className="text-[#9c7f6d]">{source.srcs?.length || 0} imágenes</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(source.srcs || []).map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} alt="" className="w-full aspect-video object-cover rounded" />
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] opacity-0 group-hover:opacity-100"
                        onClick={() => onChange({ srcs: (source.srcs || []).filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <Slider label="Cambiar cada" value={source.interval || 5} min={1} max={60} unit=" s" onChange={(v) => onChange({ interval: v }, `interval-${source.id}`)} />
              </>
            )}

            {source.kind === "media" && (
              <>
                <div className="text-[11px] text-[#d9bfae] break-all">{source.path || "Sin archivo"}</div>
                <div className="flex gap-1.5">
                  <button type="button" className={small} onClick={onPickMedia}>
                    Elegir archivo
                  </button>
                  {source.path && (
                    <button type="button" className={small} onClick={onActivate}>
                      Reiniciar
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={source.loop !== false} onChange={(e) => onChange({ loop: e.target.checked })} className="accent-[#ff8a2a]" /> Repetir en bucle
                </label>
              </>
            )}

            {source.kind === "text" && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-[#d9bfae]">Texto</span>
                  <textarea className={`${field} h-16 py-1.5 resize-none`} value={source.text || ""} onChange={(e) => onChange({ text: e.target.value }, `text-${source.id}`)} />
                </label>
                <div className="flex gap-2">
                  <select className={`${field} flex-1`} value={source.font || "Hanken Grotesk"} onChange={(e) => onChange({ font: e.target.value })}>
                    {["Hanken Grotesk", "Arial", "Impact", "Georgia", "Verdana", "Trebuchet MS", "Courier New", "Comic Sans MS"].map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <input type="number" min={10} max={400} className={`${field} w-16`} value={source.size || 64} onChange={(e) => onChange({ size: Number(e.target.value) || 64 }, `size-${source.id}`)} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5">
                    Color <input type="color" value={source.color || "#ffffff"} onChange={(e) => onChange({ color: e.target.value }, `color-${source.id}`)} className="h-7 w-9 bg-transparent" />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={source.bold !== false} onChange={(e) => onChange({ bold: e.target.checked })} className="accent-[#ff8a2a]" /> Negrita
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={source.outline !== false} onChange={(e) => onChange({ outline: e.target.checked })} className="accent-[#ff8a2a]" /> Contorno
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={Boolean(source.background)}
                      onChange={(e) => onChange({ background: e.target.checked ? "#000000" : null })}
                      className="accent-[#ff8a2a]"
                    />
                    Fondo
                  </label>
                  {source.background && (
                    <input type="color" value={source.background} onChange={(e) => onChange({ background: e.target.value }, `bg-${source.id}`)} className="h-7 w-9 bg-transparent" />
                  )}
                  <select className={`${field} w-28 ml-auto`} value={source.align || "center"} onChange={(e) => onChange({ align: e.target.value as "left" | "center" | "right" })}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </div>
              </>
            )}

            {source.kind === "color" && (
              <label className="flex items-center gap-2">
                Color <input type="color" value={source.color || "#000000"} onChange={(e) => onChange({ color: e.target.value }, `color-${source.id}`)} className="h-8 w-12 bg-transparent" />
              </label>
            )}

            <div className="border-t border-[#33261f] pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#c89a7a] mb-2">Posición y tamaño</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-[#d9bfae] uppercase">{k === "w" ? "Ancho" : k === "h" ? "Alto" : k}</span>
                    <input type="number" className={`${field} px-1.5`} value={Math.round(source[k])} onChange={(e) => onChange({ [k]: Number(e.target.value) || 0 }, `${k}-${source.id}`)} />
                  </label>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <button type="button" className={small} onClick={() => onFit("full")}>
                  <Maximize size={12} /> Pantalla completa
                </button>
                <button type="button" className={small} onClick={() => onFit("corner")}>
                  <CornerDownRight size={12} /> Esquina
                </button>
                <button type="button" className={small} onClick={() => onFit("center")}>
                  Centrar
                </button>
              </div>
              <div className="mt-2">
                <Slider label="Rotación" value={source.rotation} min={-180} max={180} unit="°" onChange={(v) => onChange({ rotation: v }, `rot-${source.id}`)} />
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <button type="button" className={`${small} ${source.flipH ? "!bg-[#ff8a2a] !text-black" : ""}`} onClick={() => onChange({ flipH: !source.flipH })}>
                  <FlipHorizontal size={12} /> Voltear H
                </button>
                <button type="button" className={`${small} ${source.flipV ? "!bg-[#ff8a2a] !text-black" : ""}`} onClick={() => onChange({ flipV: !source.flipV })}>
                  <FlipVertical size={12} /> Voltear V
                </button>
                <button type="button" className={small} onClick={() => onChange({ locked: !source.locked })}>
                  {source.locked ? <Lock size={12} /> : <Unlock size={12} />} {source.locked ? "Bloqueada" : "Bloquear"}
                </button>
              </div>
              {visual && (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[#d9bfae]">Ajuste</span>
                    <select className={field} value={source.fit} onChange={(e) => onChange({ fit: e.target.value as StudioSource["fit"] })}>
                      <option value="contain">Ajustar (se ve entero)</option>
                      <option value="cover">Rellenar (recorta lo que sobra)</option>
                      <option value="stretch">Estirar</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={source.round} onChange={(e) => onChange({ round: e.target.checked })} className="accent-[#ff8a2a]" /> Círculo
                </label>
                {!source.round && (
                  <div className="flex-1">
                    <Slider label="Esquinas redondeadas" value={source.radius} min={0} max={200} unit=" px" onChange={(v) => onChange({ radius: v }, `radius-${source.id}`)} />
                  </div>
                )}
              </div>
            </div>

            <button type="button" className={`${small} text-red-300 hover:text-red-200 self-start mt-1`} onClick={onRemove}>
              <Trash2 size={12} /> Eliminar fuente
            </button>
          </>
        )}

        {tab === "filters" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#c89a7a]">Corrección de color</span>
              <button
                type="button"
                title="Restablecer filtros"
                className="text-[#c89a7a] hover:text-white"
                onClick={() => onChange({ filters: structuredClone(DEFAULT_FILTERS) })}
              >
                <RotateCcw size={13} />
              </button>
            </div>
            <Slider label="Brillo" value={f.brightness} min={0} max={200} unit="%" onChange={(v) => setFilters({ brightness: v }, "bright")} />
            <Slider label="Contraste" value={f.contrast} min={0} max={200} unit="%" onChange={(v) => setFilters({ contrast: v }, "contrast")} />
            <Slider label="Saturación" value={f.saturation} min={0} max={300} unit="%" onChange={(v) => setFilters({ saturation: v }, "sat")} />
            <Slider label="Tono" value={f.hue} min={-180} max={180} unit="°" onChange={(v) => setFilters({ hue: v }, "hue")} />
            <Slider label="Opacidad" value={f.opacity} min={0} max={100} unit="%" onChange={(v) => setFilters({ opacity: v }, "opacity")} />
            <Slider label="Desenfoque" value={f.blur} min={0} max={30} step={0.5} unit=" px" onChange={(v) => setFilters({ blur: v }, "blur")} />

            {visual && (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#c89a7a] mt-2">Recortar</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["left", "top", "right", "bottom"] as const).map((side) => (
                    <label key={side} className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-[#d9bfae]">{{ left: "Izquierda", top: "Arriba", right: "Derecha", bottom: "Abajo" }[side]} (px)</span>
                      <input
                        type="number"
                        min={0}
                        className={field}
                        value={f.crop[side]}
                        onChange={(e) => setFilters({ crop: { ...f.crop, [side]: Math.max(0, Number(e.target.value) || 0) } }, `crop-${side}`)}
                      />
                    </label>
                  ))}
                </div>

                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#c89a7a] mt-2">Croma (pantalla verde)</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.chroma.enabled} onChange={(e) => setFilters({ chroma: { ...f.chroma, enabled: e.target.checked } })} className="accent-[#ff8a2a]" />
                  Quitar el fondo de color
                </label>
                {f.chroma.enabled && (
                  <>
                    <div className="flex items-center gap-2">
                      {[
                        ["#00ff00", "Verde"],
                        ["#0000ff", "Azul"],
                        ["#ff00ff", "Magenta"],
                      ].map(([color, text]) => (
                        <button
                          key={color}
                          type="button"
                          className={`${small} ${f.chroma.color === color ? "!bg-[#ff8a2a] !text-black" : ""}`}
                          onClick={() => setFilters({ chroma: { ...f.chroma, color } })}
                        >
                          {text}
                        </button>
                      ))}
                      <input type="color" value={f.chroma.color} onChange={(e) => setFilters({ chroma: { ...f.chroma, color: e.target.value } }, "chroma-color")} className="h-7 w-9 bg-transparent" />
                    </div>
                    <Slider label="Similitud" value={f.chroma.similarity} min={1} max={100} onChange={(v) => setFilters({ chroma: { ...f.chroma, similarity: v } }, "chroma-sim")} />
                    <Slider label="Suavizado" value={f.chroma.smoothness} min={1} max={100} onChange={(v) => setFilters({ chroma: { ...f.chroma, smoothness: v } }, "chroma-smooth")} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
