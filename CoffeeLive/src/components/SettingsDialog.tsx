// Ajustes de CoffeeLive, por pestañas como en las apps de streaming:
// General, Transmisión, Salida, Audio, Video y Atajos.

import React, { useEffect, useState } from "react";
import {
  X,
  Settings2,
  Radio,
  HardDrive,
  Volume2,
  Monitor,
  Keyboard,
  Eye,
  EyeOff,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  RotateCcw,
} from "lucide-react";
import type { HotkeyAction, LiveSettings, StreamService, X264Preset } from "../types";
import { ACCENT, HOTKEY_LABELS, STREAM_SERVERS } from "../types";
import { DEFAULT_HOTKEYS } from "../services/live";
import { isTauri, openExternal } from "../services/desktop";
import { ffmpegInstall, ffmpegStatus, pickFolder, videosDir, type FfmpegStatus } from "../services/store";
import { canRecordMp4 } from "../services/media";
import { comboFromEvent } from "../services/hotkeys";

export type SettingsTab = "general" | "stream" | "output" | "audio" | "video" | "hotkeys";

interface SettingsDialogProps {
  settings: LiveSettings;
  streamKey: string;
  live: boolean;
  mics: MediaDeviceInfo[];
  initialTab?: SettingsTab;
  onChange: (settings: LiveSettings) => void;
  onStreamKey: (key: string) => void;
  onClose: () => void;
}

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "stream", label: "Transmisión", icon: Radio },
  { id: "output", label: "Salida", icon: HardDrive },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "video", label: "Video", icon: Monitor },
  { id: "hotkeys", label: "Atajos", icon: Keyboard },
];

const RESOLUTIONS: [number, number, string][] = [
  [3840, 2160, "3840 × 2160 (4K)"],
  [2560, 1440, "2560 × 1440 (1440p)"],
  [1920, 1080, "1920 × 1080 (1080p)"],
  [1600, 900, "1600 × 900"],
  [1280, 720, "1280 × 720 (720p)"],
  [852, 480, "852 × 480 (480p)"],
  [1080, 1920, "1080 × 1920 (vertical)"],
  [720, 1280, "720 × 1280 (vertical)"],
];

const field = "w-full h-9 px-3 text-[13px] rounded-lg border border-[#e3d6cc] outline-none focus:border-[#ef6c00] bg-white";
const label = "text-[12px] font-semibold text-[#5a4335]";

const Row: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="grid grid-cols-[200px_1fr] gap-4 items-start py-2">
    <div>
      <div className={label}>{title}</div>
      {hint && <div className="text-[11px] text-[#8a7466] mt-0.5 leading-snug">{hint}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const Check: React.FC<{ checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }> = ({ checked, onChange, children }) => (
  <label className="flex items-center gap-2 text-[13px] py-1 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#ef6c00]" />
    {children}
  </label>
);

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ settings, streamKey, live, mics, initialTab = "general", onChange, onStreamKey, onClose }) => {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<FfmpegStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState<HotkeyAction | null>(null);
  const [defaultFolder, setDefaultFolder] = useState("");

  useEffect(() => {
    if (!isTauri) return;
    setChecking(true);
    ffmpegStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)))
      .finally(() => setChecking(false));
    void videosDir().then((dir) => setDefaultFolder(dir || ""));
  }, []);

  // Captura de un atajo nuevo
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        onChange({ ...settings, hotkeys: { ...settings.hotkeys, [capturing]: "" } });
        setCapturing(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      onChange({ ...settings, hotkeys: { ...settings.hotkeys, [capturing]: combo } });
      setCapturing(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, settings, onChange]);

  const set = <K extends keyof LiveSettings>(key: K, patch: Partial<LiveSettings[K]>) =>
    onChange({ ...settings, [key]: { ...settings[key], ...patch } });

  const install = async () => {
    setInstalling(true);
    setError("");
    try {
      setStatus(await ffmpegInstall());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const s = settings;
  const encoderName = (e: string) =>
    ({ h264_nvenc: "NVIDIA NVENC", h264_qsv: "Intel Quick Sync", h264_amf: "AMD AMF", h264_mf: "Media Foundation de Windows", libx264: "x264 (procesador)" })[e] || e;

  return (
    <div data-modal-open className="fixed inset-0 z-[99990] bg-black/50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[860px] max-w-full h-[620px] max-h-full bg-white rounded-2xl shadow-2xl text-[#2b1d14] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0e5dc]">
          <h2 className="text-[15px] font-semibold">Ajustes</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#fbf1e9]" title="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <nav className="w-44 shrink-0 border-r border-[#f0e5dc] bg-[#fdf8f4] py-2">
            {TABS.map(({ id, label: text, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-left ${tab === id ? "font-semibold bg-white border-r-2" : "hover:bg-[#f8ece2]"}`}
                style={tab === id ? { borderColor: ACCENT, color: ACCENT } : undefined}
              >
                <Icon size={15} /> {text}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {live && (tab === "video" || tab === "audio" || tab === "output") && (
              <div className="mb-3 rounded-lg bg-[#fff4e5] text-[#7a4a12] text-[12px] px-3 py-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Algunos cambios se aplican al empezar la próxima grabación o transmisión.
              </div>
            )}

            {tab === "general" && (
              <>
                <Row title="Modo estudio" hint="Prepara una escena en la vista previa y pásala al directo con una transición.">
                  <Check checked={s.general.studioMode} onChange={(v) => set("general", { studioMode: v })}>
                    Mostrar vista previa y programa por separado
                  </Check>
                </Row>
                <Row title="Estadísticas">
                  <Check checked={s.general.showStats} onChange={(v) => set("general", { showStats: v })}>
                    Mostrar FPS, fotogramas perdidos y tasa de bits en la barra inferior
                  </Check>
                </Row>
                <Row title="Confirmaciones">
                  <Check checked={s.stream.confirmStart} onChange={(v) => set("stream", { confirmStart: v })}>
                    Preguntar antes de iniciar la transmisión
                  </Check>
                  <Check checked={s.stream.confirmStop} onChange={(v) => set("stream", { confirmStop: v })}>
                    Preguntar antes de detener la transmisión
                  </Check>
                  <Check checked={s.general.confirmExit} onChange={(v) => set("general", { confirmExit: v })}>
                    Avisar al cerrar si hay una grabación o transmisión en curso
                  </Check>
                </Row>
                <Row title="Transición de escenas">
                  <div className="flex gap-2">
                    <select className={field} value={s.transition.kind} onChange={(e) => set("transition", { kind: e.target.value as LiveSettings["transition"]["kind"] })}>
                      <option value="cut">Corte</option>
                      <option value="fade">Fundido</option>
                      <option value="slide">Deslizar</option>
                      <option value="swipe">Barrido</option>
                      <option value="zoom">Zoom</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={50}
                      className={`${field} w-32`}
                      value={s.transition.durationMs}
                      onChange={(e) => set("transition", { durationMs: Number(e.target.value) || 0 })}
                    />
                    <span className="self-center text-[12px] text-[#8a7466]">ms</span>
                  </div>
                </Row>
              </>
            )}

            {tab === "stream" && (
              <>
                <Row title="Servicio">
                  <div className="grid grid-cols-5 gap-1.5">
                    {(["twitch", "youtube", "facebook", "kick", "custom"] as StreamService[]).map((service) => (
                      <button
                        key={service}
                        type="button"
                        onClick={() =>
                          set("stream", {
                            service,
                            server: service === "custom" ? (s.stream.service === "custom" ? s.stream.server : "rtmp://") : STREAM_SERVERS[service].server,
                          })
                        }
                        className={`h-9 rounded-lg text-[12px] font-semibold border ${s.stream.service === service ? "text-white border-transparent" : "border-[#e3d6cc] hover:bg-[#fbf1e9]"}`}
                        style={s.stream.service === service ? { background: ACCENT } : undefined}
                      >
                        {service === "custom" ? "Otro" : STREAM_SERVERS[service].label}
                      </button>
                    ))}
                  </div>
                  {s.stream.service !== "custom" && <p className="text-[11px] text-[#8a7466] mt-1.5">{STREAM_SERVERS[s.stream.service].help}</p>}
                </Row>
                <Row title="Servidor" hint="rtmp://, rtmps:// o srt://">
                  <input className={field} value={s.stream.server} onChange={(e) => set("stream", { server: e.target.value, service: "custom" })} />
                </Row>
                <Row title="Clave de transmisión">
                  <div className="relative">
                    <input
                      className={`${field} pr-10`}
                      type={showKey ? "text" : "password"}
                      value={streamKey}
                      onChange={(e) => onStreamKey(e.target.value)}
                      placeholder="Pega aquí tu clave"
                      autoComplete="off"
                    />
                    <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-2 text-[#8a7466]" title={showKey ? "Ocultar" : "Mostrar"}>
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Check checked={s.stream.rememberKey} onChange={(v) => set("stream", { rememberKey: v })}>
                    Recordar la clave en este equipo (no se guarda en el archivo de escenas)
                  </Check>
                </Row>
                <Row title="Reconexión automática" hint="Si se corta la conexión, vuelve a conectar sola.">
                  <Check checked={s.stream.reconnect} onChange={(v) => set("stream", { reconnect: v })}>
                    Reconectar
                  </Check>
                  {s.stream.reconnect && (
                    <div className="flex items-center gap-2 text-[12px] mt-1">
                      Esperar
                      <input type="number" min={2} max={60} className={`${field} w-20`} value={s.stream.retryDelaySec} onChange={(e) => set("stream", { retryDelaySec: Number(e.target.value) || 10 })} />
                      s · como máximo
                      <input type="number" min={1} max={100} className={`${field} w-20`} value={s.stream.maxRetries} onChange={(e) => set("stream", { maxRetries: Number(e.target.value) || 20 })} />
                      intentos
                    </div>
                  )}
                </Row>
                <Row title="Grabar también">
                  <Check checked={s.stream.recordWhileStreaming} onChange={(v) => set("stream", { recordWhileStreaming: v })}>
                    Iniciar la grabación automáticamente al transmitir
                  </Check>
                </Row>
              </>
            )}

            {tab === "output" && (
              <>
                <h3 className="text-[13px] font-bold mb-1" style={{ color: ACCENT }}>
                  Transmisión
                </h3>
                <Row title="Codificador de video">
                  <select className={field} value={s.stream.encoder} onChange={(e) => set("stream", { encoder: e.target.value as LiveSettings["stream"]["encoder"] })}>
                    <option value="auto">Automático (por hardware si está disponible)</option>
                    <option value="hardware">Por hardware (tarjeta gráfica)</option>
                    <option value="x264">x264 (procesador)</option>
                  </select>
                  <div className="text-[11px] text-[#8a7466] mt-1.5">
                    {!isTauri
                      ? "Solo en la aplicación de escritorio."
                      : checking
                        ? "Comprobando los codificadores del equipo…"
                        : status?.available
                          ? `Disponibles: ${[status.hardware && encoderName(status.hardware), status.encoder === "libx264" && encoderName("libx264")].filter(Boolean).join(" · ") || "copia directa"}`
                          : "Hace falta el componente de transmisión (ffmpeg)."}
                  </div>
                </Row>
                <Row title="Control de la tasa de bits">
                  <select className={field} value={s.stream.rateControl} onChange={(e) => set("stream", { rateControl: e.target.value as "cbr" | "vbr" })}>
                    <option value="cbr">CBR · constante (recomendado para directos)</option>
                    <option value="vbr">VBR · variable</option>
                  </select>
                </Row>
                <Row title="Tasa de bits de video" hint="Twitch admite hasta 6000 kbps; YouTube, más.">
                  <div className="flex items-center gap-2">
                    <input type="number" min={500} max={50000} step={100} className={`${field} w-32`} value={s.stream.videoKbps} onChange={(e) => set("stream", { videoKbps: Number(e.target.value) || 4500 })} />
                    <span className="text-[12px] text-[#8a7466]">kbps</span>
                  </div>
                </Row>
                <Row title="Tasa de bits de audio">
                  <select className={field} value={s.stream.audioKbps} onChange={(e) => set("stream", { audioKbps: Number(e.target.value) })}>
                    {[96, 128, 160, 192, 256, 320].map((k) => (
                      <option key={k} value={k}>
                        {k} kbps
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Intervalo de fotogramas clave" hint="La mayoría de servicios piden 2 s.">
                  <select className={field} value={s.stream.keyframeSec} onChange={(e) => set("stream", { keyframeSec: Number(e.target.value) })}>
                    {[1, 2, 3, 4].map((k) => (
                      <option key={k} value={k}>
                        {k} s
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Preajuste de uso de CPU" hint="Solo x264: más rápido = menos CPU, algo menos de calidad.">
                  <select className={field} value={s.stream.preset} onChange={(e) => set("stream", { preset: e.target.value as X264Preset })}>
                    {(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium"] as X264Preset[]).map((p) => (
                      <option key={p} value={p}>
                        {p}
                        {p === "veryfast" ? " (recomendado)" : ""}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Perfil H.264">
                  <select className={field} value={s.stream.profile} onChange={(e) => set("stream", { profile: e.target.value as LiveSettings["stream"]["profile"] })}>
                    <option value="high">high</option>
                    <option value="main">main</option>
                    <option value="baseline">baseline</option>
                  </select>
                </Row>

                <h3 className="text-[13px] font-bold mt-4 mb-1" style={{ color: ACCENT }}>
                  Grabación
                </h3>
                <Row title="Carpeta de grabaciones">
                  <div className="flex gap-2">
                    <input className={field} readOnly value={s.recording.folder || defaultFolder || "Descargas del navegador"} />
                    {isTauri && (
                      <>
                        <button
                          type="button"
                          className="h-9 px-3 rounded-lg border border-[#e3d6cc] hover:bg-[#fbf1e9] text-[12px] flex items-center gap-1.5 shrink-0"
                          onClick={() => void pickFolder().then((folder) => folder && set("recording", { folder }))}
                        >
                          <FolderOpen size={14} /> Elegir
                        </button>
                        {s.recording.folder && (
                          <button type="button" title="Volver a Videos\CoffeeWorks" className="h-9 px-2 rounded-lg border border-[#e3d6cc] hover:bg-[#fbf1e9]" onClick={() => set("recording", { folder: null })}>
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </Row>
                <Row title="Nombre de los archivos" hint="%fecha% se sustituye por la fecha y la hora.">
                  <input className={field} value={s.recording.fileName} onChange={(e) => set("recording", { fileName: e.target.value })} />
                </Row>
                <Row title="Formato">
                  <select className={field} value={s.recording.format} onChange={(e) => set("recording", { format: e.target.value as "mp4" | "webm" })}>
                    <option value="mp4" disabled={!canRecordMp4()}>
                      MP4 (recomendado)
                    </option>
                    <option value="webm">WebM</option>
                  </select>
                </Row>
                <Row title="Calidad de la grabación">
                  <div className="flex items-center gap-2">
                    <select
                      className={field}
                      value={[20000, 10000, 6000, 2500].includes(s.recording.videoKbps) ? s.recording.videoKbps : "custom"}
                      onChange={(e) => e.target.value !== "custom" && set("recording", { videoKbps: Number(e.target.value) })}
                    >
                      <option value={20000}>Casi sin pérdidas · 20 Mbps</option>
                      <option value={10000}>Alta · 10 Mbps</option>
                      <option value={6000}>Media · 6 Mbps</option>
                      <option value={2500}>Archivos pequeños · 2,5 Mbps</option>
                      <option value="custom">Personalizada</option>
                    </select>
                    <input type="number" min={500} max={100000} step={500} className={`${field} w-28`} value={s.recording.videoKbps} onChange={(e) => set("recording", { videoKbps: Number(e.target.value) || 10000 })} />
                    <span className="text-[12px] text-[#8a7466]">kbps</span>
                  </div>
                </Row>
                <Row title="Audio de la grabación">
                  <select className={field} value={s.recording.audioKbps} onChange={(e) => set("recording", { audioKbps: Number(e.target.value) })}>
                    {[128, 160, 192, 256, 320].map((k) => (
                      <option key={k} value={k}>
                        {k} kbps
                      </option>
                    ))}
                  </select>
                </Row>
              </>
            )}

            {tab === "audio" && (
              <>
                <Row title="Frecuencia de muestreo" hint="Se aplica al reiniciar CoffeeLive.">
                  <select className={field} value={s.audio.sampleRate} onChange={(e) => set("audio", { sampleRate: Number(e.target.value) as 44100 | 48000 })}>
                    <option value={48000}>48 kHz</option>
                    <option value={44100}>44,1 kHz</option>
                  </select>
                </Row>
                <Row title="Canales">
                  <select className={field} value={s.audio.channels} onChange={(e) => set("audio", { channels: Number(e.target.value) as 1 | 2 })}>
                    <option value={2}>Estéreo</option>
                    <option value={1}>Mono</option>
                  </select>
                </Row>
                <Row title="Micrófono">
                  <select className={field} value={s.audio.micDevice ?? "off"} onChange={(e) => set("audio", { micDevice: e.target.value === "off" ? null : e.target.value })}>
                    <option value="off">Desactivado</option>
                    <option value="">Predeterminado del sistema</option>
                    {mics
                      .filter((m) => m.deviceId && m.deviceId !== "default")
                      .map((m, i) => (
                        <option key={m.deviceId} value={m.deviceId}>
                          {m.label || `Micrófono ${i + 1}`}
                        </option>
                      ))}
                  </select>
                </Row>
                <Row title="Audio del escritorio">
                  <Check checked={s.audio.desktopAudio} onChange={(v) => set("audio", { desktopAudio: v })}>
                    Pedir el audio del sistema al capturar la pantalla
                  </Check>
                </Row>
                <Row title="Procesado del micrófono">
                  <Check checked={s.audio.noiseSuppression} onChange={(v) => set("audio", { noiseSuppression: v })}>
                    Supresión de ruido
                  </Check>
                  <Check checked={s.audio.echoCancellation} onChange={(v) => set("audio", { echoCancellation: v })}>
                    Cancelación de eco
                  </Check>
                  <Check checked={s.audio.autoGain} onChange={(v) => set("audio", { autoGain: v })}>
                    Control automático de ganancia
                  </Check>
                  <Check checked={s.audio.compressor} onChange={(v) => set("audio", { compressor: v })}>
                    Compresor (iguala la voz)
                  </Check>
                </Row>
                <Row title="Ganancia del micrófono">
                  <div className="flex items-center gap-3">
                    <input type="range" min={-20} max={20} step={1} className="flex-1 accent-[#ef6c00]" value={s.audio.micGainDb} onChange={(e) => set("audio", { micGainDb: Number(e.target.value) })} />
                    <span className="font-mono text-[12px] w-14 text-right">{s.audio.micGainDb > 0 ? "+" : ""}{s.audio.micGainDb} dB</span>
                  </div>
                </Row>
                <Row title="Puerta de ruido" hint="Silencia el micrófono cuando no hablas.">
                  <Check checked={s.audio.noiseGate} onChange={(v) => set("audio", { noiseGate: v })}>
                    Activar
                  </Check>
                  {s.audio.noiseGate && (
                    <div className="flex items-center gap-3">
                      <span className="text-[12px]">Umbral</span>
                      <input type="range" min={-70} max={-10} step={1} className="flex-1 accent-[#ef6c00]" value={s.audio.gateThreshold} onChange={(e) => set("audio", { gateThreshold: Number(e.target.value) })} />
                      <span className="font-mono text-[12px] w-14 text-right">{s.audio.gateThreshold} dB</span>
                    </div>
                  )}
                </Row>
              </>
            )}

            {tab === "video" && (
              <>
                <Row title="Resolución base (lienzo)" hint="El tamaño en el que colocas las fuentes. Al cambiarla, las escenas se adaptan.">
                  <select
                    className={field}
                    value={`${s.video.baseWidth}x${s.video.baseHeight}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split("x").map(Number);
                      set("video", { baseWidth: w, baseHeight: h });
                    }}
                  >
                    {RESOLUTIONS.map(([w, h, text]) => (
                      <option key={text} value={`${w}x${h}`}>
                        {text}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Resolución de salida (escalada)" hint="La que se graba y se transmite.">
                  <select
                    className={field}
                    value={`${s.video.outWidth}x${s.video.outHeight}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split("x").map(Number);
                      set("video", { outWidth: w, outHeight: h });
                    }}
                  >
                    {RESOLUTIONS.filter(([w, h]) => w / h === s.video.baseWidth / s.video.baseHeight || (w === s.video.baseWidth && h === s.video.baseHeight)).map(([w, h, text]) => (
                      <option key={text} value={`${w}x${h}`}>
                        {text}
                      </option>
                    ))}
                    {!RESOLUTIONS.some(([w, h]) => w === s.video.outWidth && h === s.video.outHeight) && (
                      <option value={`${s.video.outWidth}x${s.video.outHeight}`}>
                        {s.video.outWidth} × {s.video.outHeight}
                      </option>
                    )}
                  </select>
                </Row>
                <Row title="Filtro de escalado">
                  <select className={field} value={s.video.downscale} onChange={(e) => set("video", { downscale: e.target.value as LiveSettings["video"]["downscale"] })}>
                    <option value="bilinear">Bilineal (más rápido)</option>
                    <option value="bicubic">Bicúbico (equilibrado)</option>
                    <option value="lanczos">Lanczos (más nítido)</option>
                  </select>
                </Row>
                <Row title="Fotogramas por segundo">
                  <select className={field} value={s.video.fps} onChange={(e) => set("video", { fps: Number(e.target.value) })}>
                    {[24, 25, 30, 48, 50, 60].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Row>
              </>
            )}

            {tab === "hotkeys" && (
              <>
                <p className="text-[12px] text-[#8a7466] mb-2">
                  {isTauri
                    ? "Los atajos funcionan aunque CoffeeLive esté minimizado o estés en un juego."
                    : "En el navegador los atajos solo funcionan con la pestaña activa."}{" "}
                  Pulsa «Cambiar» y luego la combinación; Supr para quitarlo.
                </p>
                {(Object.keys(HOTKEY_LABELS) as HotkeyAction[]).map((action) => (
                  <Row key={action} title={HOTKEY_LABELS[action]}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 h-9 px-3 rounded-lg border flex items-center font-mono text-[12px] ${
                          capturing === action ? "border-[#ef6c00] bg-[#fff4e5]" : "border-[#e3d6cc] bg-[#fdf8f4]"
                        }`}
                      >
                        {capturing === action ? "Pulsa la combinación…" : s.hotkeys[action] || "Sin atajo"}
                      </div>
                      <button type="button" className="h-9 px-3 rounded-lg border border-[#e3d6cc] hover:bg-[#fbf1e9] text-[12px]" onClick={() => setCapturing(action)}>
                        Cambiar
                      </button>
                    </div>
                  </Row>
                ))}
                <button
                  type="button"
                  className="mt-2 text-[12px] underline text-[#8a7466]"
                  onClick={() => onChange({ ...settings, hotkeys: { ...DEFAULT_HOTKEYS } })}
                >
                  Restablecer los atajos predeterminados
                </button>
              </>
            )}

            {(tab === "stream" || tab === "output") && (
              <div className="mt-4 rounded-xl border border-[#f0e5dc] bg-[#fdf8f4] px-3.5 py-3 text-[12px]">
                {!isTauri ? (
                  <div className="flex items-start gap-2 text-[#7a4a12]">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    La transmisión en directo solo está disponible en la aplicación de escritorio. Aquí puedes grabar.
                  </div>
                ) : checking ? (
                  <div className="flex items-center gap-2 text-[#8a7466]">
                    <Loader2 size={14} className="animate-spin" /> Comprobando el componente de transmisión…
                  </div>
                ) : status?.available ? (
                  <div className="flex items-start gap-2 text-[#1d6b52]">
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                    <span>
                      Componente de transmisión listo
                      <span className="block text-[11px] text-[#8a7466]">{status.version}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-[#7a4a12]">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      Para transmitir, CoffeeLive necesita descargar su componente de transmisión (ffmpeg, unos 90 MB, una sola vez).
                    </div>
                    {status?.can_install ? (
                      <button
                        type="button"
                        disabled={installing}
                        onClick={() => void install()}
                        className="self-start h-8 px-3 rounded-lg text-white text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
                        style={{ background: ACCENT }}
                      >
                        {installing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        {installing ? "Descargando… puede tardar unos minutos" : "Descargar componente"}
                      </button>
                    ) : (
                      <button type="button" className="self-start text-[12px] underline" onClick={() => void openExternal("https://ffmpeg.org/download.html")}>
                        Cómo instalar ffmpeg
                      </button>
                    )}
                  </div>
                )}
                {error && <p className="mt-2 text-[11px] text-red-700 whitespace-pre-line">{error}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end px-5 py-3 border-t border-[#f0e5dc] bg-[#fdf8f4]">
          <button type="button" onClick={onClose} className="h-9 px-5 rounded-lg text-[13px] font-semibold text-white" style={{ background: ACCENT }}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
