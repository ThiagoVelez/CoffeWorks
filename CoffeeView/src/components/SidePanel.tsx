// Barra lateral derecha de CoffeeView con los paneles de diapositiva, imagen,
// contenido multimedia, biblioteca de cargas, ensayo de intervalos y
// transformaciones rápidas.

import React, { useEffect, useState } from "react";
import {
  Presentation,
  Image as ImageIcon,
  Film,
  Upload,
  Timer,
  Sparkles,
  X,
  LayoutTemplate,
  Palette,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  FolderOpen,
  Link as LinkIcon,
  List,
  AlignCenter,
  Contrast,
  SunMoon,
  Type,
  Check,
} from "lucide-react";
import type { MediaAsset, Slide, SlideLayout, SlideTheme, SlideTransition } from "../types";

export type TransformKind = "bullets" | "align" | "contrast" | "invert" | "title";

type PanelTab = "diapositiva" | "imagen" | "multimedia" | "cargas" | "ensayo" | "transformar";

interface SidePanelProps {
  slide: Slide;
  slides: Slide[];
  theme: SlideTheme;
  assets: MediaAsset[];
  autoAdvance: boolean;
  onChangeLayout: (layout: SlideLayout) => void;
  onSetBackground: (color: string | undefined, applyToAll: boolean) => void;
  onSetTransition: (transition: SlideTransition, applyToAll: boolean) => void;
  onToggleHidden: () => void;
  onPickImage: () => void;
  onAddImage: (source: string) => void;
  onPickVideo: () => void;
  onAddVideo: (source: string) => void;
  onUploadAssets: () => void;
  onRemoveAsset: (id: string) => void;
  onTransform: (kind: TransformKind) => void;
  onSaveTimings: (timings: Record<string, number>) => void;
  onClearTimings: () => void;
  onToggleAutoAdvance: () => void;
}

const TABS: Array<{ id: PanelTab; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: "diapositiva", label: "Diapositiva", Icon: Presentation },
  { id: "imagen", label: "Imagen", Icon: ImageIcon },
  { id: "multimedia", label: "Contenido multimedia", Icon: Film },
  { id: "cargas", label: "Cargas", Icon: Upload },
  { id: "ensayo", label: "Ensayar", Icon: Timer },
  { id: "transformar", label: "Transformar", Icon: Sparkles },
];

const LAYOUTS: Array<{ id: SlideLayout; label: string }> = [
  { id: "title", label: "Título" },
  { id: "title-content", label: "Título y contenido" },
  { id: "two-columns", label: "Dos columnas" },
  { id: "section", label: "Encabezado de sección" },
  { id: "blank", label: "En blanco" },
];

const BACKGROUNDS = [
  "#ffffff", "#f8f9fa", "#e8eaed", "#fce8e6", "#fef7e0", "#e6f4ea", "#e8f0fe", "#f3e8fd",
  "#202124", "#1e140f", "#0b3d91", "#0d652d", "#b31412", "#e37400", "#6f4e37", "#4a148c",
];

const TRANSITIONS: Array<{ id: SlideTransition; label: string }> = [
  { id: "none", label: "Ninguna" },
  { id: "fade", label: "Desvanecer" },
  { id: "push", label: "Empujar" },
  { id: "wipe", label: "Barrido" },
  { id: "zoom", label: "Zoom" },
];

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export const SidePanel: React.FC<SidePanelProps> = ({
  slide,
  slides,
  theme,
  assets,
  autoAdvance,
  onChangeLayout,
  onSetBackground,
  onSetTransition,
  onToggleHidden,
  onPickImage,
  onAddImage,
  onPickVideo,
  onAddVideo,
  onUploadAssets,
  onRemoveAsset,
  onTransform,
  onSaveTimings,
  onClearTimings,
  onToggleAutoAdvance,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isTiming, setIsTiming] = useState(false);
  const [timings, setTimings] = useState<Record<string, number>>({});

  // Cronómetro del ensayo: el tiempo se atribuye a la diapositiva que se está viendo
  useEffect(() => {
    if (!isTiming) return;
    const timer = window.setInterval(() => {
      setTimings((prev) => ({ ...prev, [slide.id]: (prev[slide.id] || 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTiming, slide.id]);

  const totalTimed = Object.values(timings).reduce((a, b) => a + b, 0);
  const savedTotal = slides.reduce((total, s) => total + (s.duration || 0), 0);
  const background = slide.background || theme.slideBg;

  const sectionTitle = "font-semibold text-[#1f1f1f] flex items-center gap-1.5";
  const primaryButton =
    "flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold transition-colors disabled:opacity-40";
  const secondaryButton =
    "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-[#1f1f1f] font-medium transition-colors disabled:opacity-40";
  const inputClass =
    "flex-1 min-w-0 border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1a73e8] select-text";

  return (
    <>
      {activeTab && (
        <aside className="w-80 bg-white border-l border-[#e1dfdd] flex flex-col h-full shadow-lg z-20 select-none shrink-0 text-[#1f1f1f] print:hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-xs font-semibold uppercase tracking-wide">
              {TABS.find((tab) => tab.id === activeTab)?.label}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full"
              title="Cerrar panel"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 text-xs text-[#444746]">
            {activeTab === "diapositiva" && (
              <>
                <div className="flex flex-col gap-2">
                  <span className={sectionTitle}>
                    <LayoutTemplate size={14} className="text-[#1a73e8]" /> Diseño de la diapositiva
                  </span>
                  <p className="text-[11px] text-[#747775]">Cambiar el diseño sustituye los marcadores vacíos y conserva el contenido.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {LAYOUTS.map((layout) => (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => onChangeLayout(layout.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          slide.layout === layout.id
                            ? "border-[#1a73e8] bg-blue-50/60 font-semibold text-[#1a73e8]"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {layout.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className={sectionTitle}>
                    <Palette size={14} className="text-[#1a73e8]" /> Fondo
                  </span>
                  <div className="grid grid-cols-8 gap-1.5">
                    {BACKGROUNDS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        onClick={() => onSetBackground(color, false)}
                        style={{ backgroundColor: color }}
                        className={`w-7 h-7 rounded-md border ${
                          background.toLowerCase() === color ? "border-[#1a73e8] ring-2 ring-[#1a73e8]/30" : "border-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(background) ? background : "#ffffff"}
                      onChange={(e) => onSetBackground(e.target.value, false)}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                      title="Color personalizado"
                    />
                    <span className="font-mono uppercase">{background}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onSetBackground(background, true)} className={`${secondaryButton} flex-1`}>
                      Aplicar a todas
                    </button>
                    <button type="button" onClick={() => onSetBackground(undefined, false)} className={`${secondaryButton} flex-1`}>
                      Usar el del tema
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className={sectionTitle}>
                    <Sparkles size={14} className="text-[#1a73e8]" /> Transición de entrada
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {TRANSITIONS.map((transition) => (
                      <button
                        key={transition.id}
                        type="button"
                        onClick={() => onSetTransition(transition.id, false)}
                        className={`px-2 py-1.5 rounded-lg border transition-all ${
                          slide.transition === transition.id
                            ? "border-[#1a73e8] bg-blue-50/60 font-semibold text-[#1a73e8]"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {transition.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => onSetTransition(slide.transition, true)} className={secondaryButton}>
                    Aplicar esta transición a todas
                  </button>
                </div>

                <div className="border-t pt-4">
                  <button type="button" onClick={onToggleHidden} className={`${secondaryButton} w-full`}>
                    {slide.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    {slide.hidden ? "Mostrar en la presentación" : "Ocultar en la presentación"}
                  </button>
                </div>
              </>
            )}

            {activeTab === "imagen" && (
              <>
                <button type="button" onClick={onPickImage} className={primaryButton}>
                  <FolderOpen size={14} /> Elegir una imagen del equipo
                </button>
                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className={sectionTitle}>
                    <LinkIcon size={14} className="text-[#1a73e8]" /> Desde una dirección web
                  </span>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!imageUrl.trim()) return;
                      onAddImage(imageUrl.trim());
                      setImageUrl("");
                    }}
                  >
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/imagen.png"
                      className={inputClass}
                    />
                    <button type="submit" className={secondaryButton} disabled={!imageUrl.trim()}>
                      Insertar
                    </button>
                  </form>
                  <p className="text-[11px] text-[#747775]">
                    Las imágenes del equipo se guardan dentro de la presentación; las de una dirección web necesitan conexión para verse.
                  </p>
                </div>
              </>
            )}

            {activeTab === "multimedia" && (
              <>
                <button type="button" onClick={onPickVideo} className={primaryButton}>
                  <FolderOpen size={14} /> Elegir un vídeo del equipo
                </button>
                <p className="text-[11px] text-[#747775] -mt-3">Formatos MP4 o WebM de hasta 25 MB; se incrusta en la presentación.</p>
                <div className="flex flex-col gap-2 border-t pt-4">
                  <span className={sectionTitle}>
                    <LinkIcon size={14} className="text-[#1a73e8]" /> Desde una dirección web
                  </span>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!videoUrl.trim()) return;
                      onAddVideo(videoUrl.trim());
                      setVideoUrl("");
                    }}
                  >
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Enlace a un .mp4 o a YouTube"
                      className={inputClass}
                    />
                    <button type="submit" className={secondaryButton} disabled={!videoUrl.trim()}>
                      Insertar
                    </button>
                  </form>
                  <p className="text-[11px] text-[#747775]">El vídeo se reproduce durante la presentación.</p>
                </div>
              </>
            )}

            {activeTab === "cargas" && (
              <>
                <button type="button" onClick={onUploadAssets} className={primaryButton}>
                  <Upload size={14} /> Subir imágenes a la biblioteca
                </button>
                {assets.length === 0 ? (
                  <p className="text-[11px] text-[#747775] text-center py-6">
                    La biblioteca está vacía. Sube logotipos o imágenes que vayas a reutilizar en varias diapositivas.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {assets.map((asset) => (
                      <div key={asset.id} className="group relative border border-gray-200 rounded-lg overflow-hidden bg-[#f8f9fa]">
                        <button
                          type="button"
                          title={`Insertar ${asset.name}`}
                          onClick={() => onAddImage(asset.dataUrl)}
                          className="block w-full aspect-video"
                        >
                          <img src={asset.dataUrl} alt={asset.name} className="w-full h-full object-contain" />
                        </button>
                        <div className="px-1.5 py-1 text-[10px] truncate border-t border-gray-200 bg-white">{asset.name}</div>
                        <button
                          type="button"
                          title="Quitar de la biblioteca"
                          onClick={() => onRemoveAsset(asset.id)}
                          className="absolute top-1 right-1 p-1 rounded bg-white/95 border border-gray-300 text-[#b3261e] opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "ensayo" && (
              <>
                <p className="text-[11px] text-[#747775]">
                  Ensaya la presentación: pon en marcha el cronómetro y recorre las diapositivas. El tiempo dedicado a cada una se puede guardar
                  para que la presentación avance sola.
                </p>
                <div className="rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-3">
                  <span className="font-mono text-3xl font-semibold text-[#1f1f1f]">{formatTime(totalTimed)}</span>
                  <span className="text-[11px]">
                    Esta diapositiva: <strong>{formatTime(timings[slide.id] || 0)}</strong>
                  </span>
                  <div className="flex gap-2 w-full">
                    <button type="button" onClick={() => setIsTiming((value) => !value)} className={`${primaryButton} flex-1`}>
                      {isTiming ? <Pause size={14} /> : <Play size={14} />}
                      {isTiming ? "Pausar" : totalTimed > 0 ? "Continuar" : "Empezar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTiming(false);
                        setTimings({});
                      }}
                      className={secondaryButton}
                      title="Poner a cero"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={totalTimed === 0}
                  onClick={() => {
                    setIsTiming(false);
                    onSaveTimings(timings);
                    setTimings({});
                  }}
                  className={secondaryButton}
                >
                  <Check size={14} /> Guardar los intervalos ensayados
                </button>

                <div className="border-t pt-4 flex flex-col gap-2">
                  <span className={sectionTitle}>
                    <Timer size={14} className="text-[#1a73e8]" /> Intervalos guardados
                  </span>
                  {savedTotal === 0 ? (
                    <p className="text-[11px] text-[#747775]">Todavía no hay intervalos guardados.</p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                        {slides.map((s, index) => (
                          <div key={s.id} className="flex justify-between font-mono text-[11px]">
                            <span>Diapositiva {index + 1}</span>
                            <span>{s.duration ? formatTime(s.duration) : "—"}</span>
                          </div>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={autoAdvance} onChange={onToggleAutoAdvance} />
                        <span>Avanzar automáticamente al presentar</span>
                      </label>
                      <button type="button" onClick={onClearTimings} className={secondaryButton}>
                        <Trash2 size={13} /> Borrar los intervalos
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {activeTab === "transformar" && (
              <>
                <p className="text-[11px] text-[#747775]">Ajustes rápidos sobre la diapositiva actual. Se pueden deshacer con Ctrl+Z.</p>
                {(
                  [
                    ["bullets", "Convertir el texto en viñetas", "Añade una viñeta a cada línea de los cuadros de texto.", List],
                    ["align", "Ordenar y centrar el contenido", "Recoloca el título y los textos en una composición centrada.", AlignCenter],
                    ["contrast", "Mejorar el contraste", "Elige colores de texto legibles sobre el fondo actual.", Contrast],
                    ["invert", "Invertir claro / oscuro", "Cambia entre fondo claro y oscuro con el texto a juego.", SunMoon],
                    ["title", "Destacar el título", "Agranda el título y le aplica el color de acento del tema.", Type],
                  ] as Array<[TransformKind, string, string, React.ComponentType<{ size?: number; className?: string }>]>
                ).map(([kind, label, hint, Icon]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onTransform(kind)}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#1a73e8] hover:bg-blue-50/40 text-left transition-all"
                  >
                    <Icon size={16} className="text-[#1a73e8] shrink-0 mt-0.5" />
                    <span className="flex flex-col">
                      <span className="font-semibold text-[#1f1f1f]">{label}</span>
                      <span className="text-[11px] text-[#747775]">{hint}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>
      )}

      {/* Carril de pestañas */}
      <nav className="w-20 bg-white border-l border-[#e1dfdd] flex flex-col items-center py-3 gap-1 shrink-0 select-none print:hidden">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(activeTab === id ? null : id)}
            className={`w-[72px] flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] leading-tight text-center transition-colors ${
              activeTab === id ? "bg-[#d3e3fd] text-[#0b57d0] font-semibold" : "text-[#444746] hover:bg-[#f0f4f9]"
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "ensayo" && isTiming && <span className="w-1.5 h-1.5 rounded-full bg-[#ea4335] animate-pulse" />}
          </button>
        ))}
      </nav>
    </>
  );
};
