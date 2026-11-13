import React, { useCallback, useEffect, useState } from "react";
import { Bot, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { isTauri, tauriBridge } from "../services/tauriBridge";
import type { McpState } from "../types";

/** Tarjeta de «Ajustes › Claude (MCP)»: deja que Claude modele y anime en CoffeeAnimate3D. */
export const McpSettings: React.FC<{ onNotify: (message: string, isError?: boolean) => void }> = ({ onNotify }) => {
  const [state, setState] = useState<McpState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (isTauri) void tauriBridge.mcpStatus().then(setState).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const run = async (task: () => Promise<McpState>, done?: string) => {
    setBusy(true);
    try {
      setState(await task());
      if (done) onNotify(done);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(await tauriBridge.mcpClientConfig());
      onNotify("Configuración copiada. Pégala en Claude Code o en Claude Desktop.");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : String(err), true);
    }
  };

  const status = !state?.enabled
    ? { text: "Desactivado", dot: "bg-[#bcaaa4]" }
    : state.connected
      ? { text: "Claude conectado", dot: "bg-[#107c41]" }
      : { text: "Esperando a Claude (abre CoffeeAnimate3D)", dot: "bg-[#f9a825]" };

  return (
    <div className="p-6 rounded-2xl bg-white border border-[#dfd3c7] flex flex-col gap-4 text-xs text-[#5c3a21]" data-mcp-settings>
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-[#6f4e37]" />
        <span className="font-display font-bold text-sm text-[#2c1b12]">Claude (MCP)</span>
        {state && (
          <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[#f4ede6] border border-[#dfd3c7]">
            <span className={`w-2 h-2 rounded-full ${status.dot}`} /> {status.text}
          </span>
        )}
      </div>
      {!isTauri ? (
        <p>La conexión con Claude funciona en la aplicación de escritorio.</p>
      ) : (
        <>
          <p>
            Permite que Claude cree, pinte y anime modelos en CoffeeAnimate3D mientras la app está abierta. Todo ocurre en tu equipo
            ({state?.url ?? "127.0.0.1"}) y protegido con una clave; cada cambio de Claude se puede deshacer con Ctrl+Z.
          </p>
          {state && !state.installed && <p className="text-[#a1621a]">Instala CoffeeAnimate3D desde Aplicaciones para usarlo.</p>}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!state?.enabled}
              disabled={busy || !state}
              onChange={(e) => void run(() => tauriBridge.mcpSetEnabled(e.target.checked))}
              className="mt-0.5"
            />
            <span>
              <span className="font-bold text-[#2c1b12] block">Permitir que Claude use CoffeeAnimate3D</span>
              Desactivado por defecto. Al apagarlo, el servidor se cierra en unos segundos.
            </span>
          </label>
          {state?.enabled && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => void copyConfig()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#eeddd0] hover:bg-[#6f4e37] hover:text-white text-[#3e2723] font-bold border border-[#dfd3c7] transition-colors"
              >
                <Copy size={14} /> Copiar configuración para Claude
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => tauriBridge.mcpRegenerateToken(), "Clave nueva generada. Vuelve a copiar la configuración en Claude.")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-[#f4ede6] text-[#3e2723] font-bold border border-[#dfd3c7] transition-colors disabled:opacity-60"
              >
                <KeyRound size={14} /> Generar una clave nueva
              </button>
              <span className="flex items-center gap-1 text-[#8d6e63]">
                <ShieldCheck size={13} /> Solo acepta conexiones de este equipo
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
