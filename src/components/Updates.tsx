import React, { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw, X, ExternalLink, Loader2, CheckCircle2, DownloadCloud } from "lucide-react";
import { isTauri, tauriBridge } from "../services/tauriBridge";
import type { UpdateInfo } from "../types";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Estado de las actualizaciones: comprueba al abrir el Launcher y cada 6 horas. */
export function useUpdates() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async (manual = false) => {
    if (!isTauri) return null;
    setChecking(true);
    setError("");
    try {
      const next = await tauriBridge.updateCheck();
      setInfo(next);
      return next;
    } catch (err) {
      // Sin conexión no es un problema: se vuelve a intentar más tarde
      if (manual) setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    void tauriBridge.updateStatus().then(setInfo).catch(() => undefined);
    const first = window.setTimeout(() => void check(), 5000);
    const interval = window.setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [check]);

  const setAuto = async (enabled: boolean) => setInfo(await tauriBridge.updateSetAuto(enabled));

  return { info, checking, error, check, setAuto };
}

const formatSize = (bytes: number) => (bytes ? ` (${(bytes / 1024 / 1024).toFixed(0)} MB)` : "");

/** Aviso en la parte superior cuando hay una versión nueva descargada. */
export const UpdateBanner: React.FC<{ info: UpdateInfo | null; onError: (message: string) => void }> = ({ info, onError }) => {
  const [hidden, setHidden] = useState(false);
  const [applying, setApplying] = useState(false);
  if (!info?.ready || hidden) return null;

  const apply = async () => {
    setApplying(true);
    try {
      await tauriBridge.updateApply();
    } catch (err) {
      setApplying(false);
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div data-update-banner className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#3e2723] to-[#6f4e37] text-white shadow-md">
      <Sparkles size={20} className="text-[#ffcc80] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">CoffeeWorks {info.latest} está lista para instalarse</div>
        <div className="text-[11px] text-[#f3e3d6]">
          {info.auto_install
            ? "Se instalará sola cuando cierres el Launcher. Tus documentos y apps se conservan."
            : "Pulsa «Reiniciar y actualizar» cuando quieras. Tus documentos y apps se conservan."}
        </div>
      </div>
      {info.url && (
        <button type="button" onClick={() => void tauriBridge.openExternal(info.url)} className="flex items-center gap-1 text-[11px] font-semibold text-[#ffe0b2] hover:text-white">
          Novedades <ExternalLink size={12} />
        </button>
      )}
      <button
        type="button"
        disabled={applying}
        onClick={() => void apply()}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#3e2723] text-xs font-bold hover:bg-[#ffe0b2] disabled:opacity-60"
      >
        {applying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Reiniciar y actualizar
      </button>
      <button type="button" onClick={() => setHidden(true)} title="Más tarde" className="p-1.5 rounded-lg hover:bg-white/10">
        <X size={15} />
      </button>
    </div>
  );
};

/** Tarjeta de «Ajustes › Actualizaciones». */
export const UpdateSettings: React.FC<{
  updates: ReturnType<typeof useUpdates>;
  version: string;
  stage: string;
  onNotify: (message: string, isError?: boolean) => void;
}> = ({ updates, version, stage, onNotify }) => {
  const { info, checking, error, check, setAuto } = updates;

  const manualCheck = async () => {
    const next = await check(true);
    if (next && !next.ready) onNotify("CoffeeWorks está al día");
    if (next?.ready) onNotify(`CoffeeWorks ${next.latest} descargada${formatSize(next.size)}`);
  };

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#dfd3c7] flex flex-col gap-4 text-xs text-[#5c3a21]" data-update-settings>
      <div className="flex items-center gap-2">
        <DownloadCloud size={18} className="text-[#6f4e37]" />
        <span className="font-display font-bold text-sm text-[#2c1b12]">Actualizaciones</span>
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#f4ede6] border border-[#dfd3c7]">
          v{version} {stage}
        </span>
      </div>
      {!isTauri ? (
        <p>Las actualizaciones automáticas funcionan en la aplicación de escritorio.</p>
      ) : !info?.supported ? (
        <p>Las actualizaciones automáticas solo están disponibles en Windows.</p>
      ) : (
        <>
          <p>
            CoffeeWorks busca versiones nuevas al abrirse y cada 6 horas, las descarga en segundo plano y comprueba que el archivo no esté dañado
            antes de instalarlo. Al actualizar, las apps instaladas también se ponen al día; tus documentos no se tocan.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={info.auto_install} onChange={(e) => void setAuto(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-bold text-[#2c1b12] block">Instalar las actualizaciones automáticamente</span>
              La versión nueva se instala en silencio al cerrar el Launcher. Si lo desactivas, se descarga y tú eliges cuándo instalarla.
            </span>
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={checking}
              onClick={() => void manualCheck()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#eeddd0] hover:bg-[#6f4e37] hover:text-white text-[#3e2723] font-bold border border-[#dfd3c7] transition-colors disabled:opacity-60"
            >
              {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {checking ? "Buscando…" : "Buscar actualizaciones"}
            </button>
            {info.ready ? (
              <span className="flex items-center gap-1 text-[#107c41] font-semibold">
                <CheckCircle2 size={14} /> Versión {info.latest} descargada y lista
              </span>
            ) : (
              info.last_check > 0 && (
                <span className="font-mono text-[11px] text-[#8d6e63]">Última comprobación: {new Date(info.last_check).toLocaleString("es")}</span>
              )
            )}
          </div>
          {error && <p className="text-red-700">{error}</p>}
        </>
      )}
    </div>
  );
};
