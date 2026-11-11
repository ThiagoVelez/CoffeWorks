// Ajustes de la transmisión en directo: servicio, clave y calidad. Comprueba
// que ffmpeg está disponible y, si no, ofrece descargarlo.

import React, { useEffect, useState } from "react";
import { X, Radio, Eye, EyeOff, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { StreamService, StreamSettings } from "../types";
import { ACCENT, STREAM_SERVERS } from "../types";
import { isTauri, openExternal } from "../services/desktop";
import { ffmpegInstall, ffmpegStatus, type FfmpegStatus } from "../services/store";

interface StreamDialogProps {
  settings: StreamSettings;
  initialKey: string;
  onChange: (settings: StreamSettings) => void;
  onClose: () => void;
  onStart: (key: string) => void;
}

const QUALITY = [
  { id: "720-30", label: "720p · 30 fps", height: 720 as const, fps: 30, kbps: 2500, hint: "Conexiones de subida de 4 Mbps o más" },
  { id: "1080-30", label: "1080p · 30 fps", height: 1080 as const, fps: 30, kbps: 4500, hint: "Recomendado: subida de 7 Mbps o más" },
  { id: "1080-60", label: "1080p · 60 fps", height: 1080 as const, fps: 60, kbps: 6000, hint: "Juegos: subida de 10 Mbps o más" },
];

export const StreamDialog: React.FC<StreamDialogProps> = ({ settings, initialKey, onChange, onClose, onStart }) => {
  const [key, setKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<FfmpegStatus | null>(null);
  const [checking, setChecking] = useState(isTauri);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isTauri) return;
    ffmpegStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)))
      .finally(() => setChecking(false));
  }, []);

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

  const setService = (service: StreamService) =>
    onChange({ ...settings, service, server: service === "custom" ? (settings.service === "custom" ? settings.server : "rtmp://") : STREAM_SERVERS[service].server });

  const quality = QUALITY.find((q) => q.height === settings.height && q.fps === settings.fps) || QUALITY[1];
  const ready = isTauri && status?.available && key.trim().length > 0 && /^(rtmps?|srt):\/\//.test(settings.server);
  const field = "w-full h-9 px-3 text-[13px] rounded-lg border border-[#d5e4de] outline-none focus:border-[#26a680] bg-white";

  return (
    <div className="fixed inset-0 z-[99990] bg-black/50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[520px] max-w-full bg-white rounded-2xl shadow-2xl text-[#1f2b27] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e6efeb]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: ACCENT }}>
              <Radio size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">Transmitir en directo</h2>
              <p className="text-[12px] text-[#5f7a71]">Lo que ves en el estudio se emite en la plataforma que elijas.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#eef5f2]" title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <span className="text-[12px] font-semibold text-[#3d5550]">Plataforma</span>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {(["twitch", "youtube", "facebook", "custom"] as StreamService[]).map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => setService(service)}
                  className={`h-9 rounded-lg text-[12px] font-semibold border ${
                    settings.service === service ? "text-white border-transparent" : "border-[#d5e4de] hover:bg-[#f2f8f6]"
                  }`}
                  style={settings.service === service ? { background: ACCENT } : undefined}
                >
                  {service === "custom" ? "Personalizado" : STREAM_SERVERS[service].label}
                </button>
              ))}
            </div>
            {settings.service !== "custom" && <p className="text-[11px] text-[#5f7a71] mt-1.5">{STREAM_SERVERS[settings.service].help}</p>}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#3d5550]">Servidor</span>
            <input
              className={field}
              value={settings.server}
              readOnly={settings.service !== "custom"}
              onChange={(e) => onChange({ ...settings, server: e.target.value })}
              placeholder="rtmp://servidor/app"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#3d5550]">Clave de transmisión</span>
            <div className="relative">
              <input
                className={`${field} pr-10`}
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Pega aquí tu clave"
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-2 text-[#5f7a71]" title={showKey ? "Ocultar" : "Mostrar"}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="text-[11px] text-[#5f7a71]">La clave no se guarda en el proyecto ni se comparte con nadie más.</span>
          </label>

          <div>
            <span className="text-[12px] font-semibold text-[#3d5550]">Calidad</span>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {QUALITY.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onChange({ ...settings, height: q.height, fps: q.fps, videoKbps: q.kbps })}
                  className={`py-2 rounded-lg text-[12px] border ${quality.id === q.id ? "border-[#26a680] bg-[#e3f6ef] font-semibold" : "border-[#d5e4de] hover:bg-[#f2f8f6]"}`}
                >
                  {q.label}
                  <span className="block text-[10px] text-[#5f7a71] font-normal">{q.kbps} kbps</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#5f7a71] mt-1.5">{quality.hint}</p>
          </div>

          {/* Componente de transmisión (ffmpeg) */}
          <div className="rounded-xl border border-[#e0ece7] bg-[#f7fbf9] px-3.5 py-3 text-[12px]">
            {!isTauri ? (
              <div className="flex items-start gap-2 text-[#7a5a12]">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                La transmisión en directo solo está disponible en la aplicación de escritorio. Aquí puedes grabar y editar.
              </div>
            ) : checking ? (
              <div className="flex items-center gap-2 text-[#5f7a71]">
                <Loader2 size={14} className="animate-spin" /> Comprobando el componente de transmisión…
              </div>
            ) : status?.available ? (
              <div className="flex items-start gap-2 text-[#1d6b52]">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                <span>
                  Componente de transmisión listo
                  <span className="block text-[11px] text-[#5f7a71]">
                    Codificador: {status.encoder === "libx264" ? "x264" : status.encoder === "h264_mf" ? "hardware de Windows" : "copia directa"}
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2 text-[#7a5a12]">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  Para transmitir, CoffeeCams necesita descargar su componente de transmisión (ffmpeg, unos 90 MB, una sola vez).
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
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[#e6efeb] bg-[#fafcfb]">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[#eef5f2]">
            Cerrar
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onStart(key.trim())}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-2 disabled:opacity-40"
            style={{ background: "#d32f2f" }}
          >
            <Radio size={15} /> Iniciar transmisión
          </button>
        </div>
      </div>
    </div>
  );
};
