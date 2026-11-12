// Sección Games: juegos de CoffeeWorks (instalar, jugar, actualizar y
// desinstalar) y, para cada uno, sus Mods, TexturePacks y Shaders.

import React, { useCallback, useEffect, useState } from "react";
import { Gamepad2, Puzzle, Palette, Sparkles, Rocket, ShieldCheck, Download, Cpu, Play, RefreshCw, Trash2, Loader2, Check } from "lucide-react";
import { CONTENT_INFO, GAMES, type GameContentKind, type GameEntry } from "../services/games";
import { isTauri, tauriBridge, type GameStatus } from "../services/tauriBridge";

type Tab = "games" | GameContentKind;

const TABS: { id: Tab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "games", label: "Juegos", icon: Gamepad2 },
  { id: "mods", label: "Mods", icon: Puzzle },
  { id: "texturepacks", label: "TexturePacks", icon: Palette },
  { id: "shaders", label: "Shaders", icon: Sparkles },
];

const ComingSoon: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="relative overflow-hidden rounded-3xl border border-[#dfd3c7] bg-gradient-to-br from-[#2c1b12] via-[#4a2c1d] to-[#7a3e1d] text-white p-10 flex flex-col items-center text-center gap-4" data-coming-soon>
    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#ff922b]/20 blur-2xl" />
    <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-[#e8590c]/20 blur-2xl" />
    <div className="relative w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
      <Rocket size={30} className="text-[#ffc078]" />
    </div>
    <span className="relative font-mono text-[11px] uppercase tracking-[0.25em] text-[#ffc078]">Próximamente</span>
    <h2 className="relative font-display text-2xl font-bold">{title}</h2>
    <p className="relative max-w-xl text-sm text-white/80 leading-relaxed">{text}</p>
  </div>
);

const mb = (bytes: number | null | undefined) => (bytes ? `${(bytes / 1048576).toFixed(0)} MB` : null);

/** Tarjeta de un juego con su estado y sus acciones. */
const GameCard: React.FC<{ game: GameEntry }> = ({ game }) => {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [busy, setBusy] = useState<null | "install" | "uninstall" | "launch">(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (online: boolean) => {
    try {
      const st = await tauriBridge.gameStatus(game.id, online);
      if (st) setStatus((prev) => ({ ...st, latest: st.latest ?? prev?.latest ?? null, stage: st.stage ?? prev?.stage ?? null, size: st.size ?? prev?.size ?? null }));
    } catch (e) {
      setMessage(String(e));
    }
  }, [game.id]);

  useEffect(() => {
    void refresh(false).then(() => refresh(true));
  }, [refresh]);

  const run = async (kind: "install" | "uninstall" | "launch") => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "install") {
        setStatus(await tauriBridge.installGame(game.id));
        setMessage(`${game.name} está listo para jugar.`);
      } else if (kind === "uninstall") {
        await tauriBridge.uninstallGame(game.id);
        await refresh(false);
        setMessage(`${game.name} se desinstaló.`);
      } else {
        await tauriBridge.launchGame(game.id);
      }
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(null);
    }
  };

  const installed = status?.installed ?? null;
  const version = status?.latest ?? installed ?? game.version;
  const size = mb(status?.size) ?? game.size;
  const btn = "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] rounded-3xl overflow-hidden border border-[#dfd3c7] bg-white shadow-sm" data-game={game.name}>
      <div className="relative min-h-[220px]" style={{ background: `linear-gradient(135deg, ${game.cover[0]}, ${game.cover[1]})` }}>
        {game.image && <img src={game.image} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
        <div className="absolute left-5 bottom-4 text-white">
          <div className="font-display text-3xl font-bold drop-shadow">{game.name}</div>
          <div className="text-sm text-white/90 drop-shadow">{game.tagline}</div>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#6f4e37]">
          <span className="px-2 py-0.5 rounded-full bg-[#eeddd0] border border-[#dfd3c7]">{game.genre}</span>
          <span className="px-2 py-0.5 rounded-full bg-[#eeddd0] border border-[#dfd3c7]">v{version}</span>
          {status?.stage && <span className="px-2 py-0.5 rounded-full bg-[#fff3d6] border border-[#f0d9a8]">{status.stage}</span>}
          <span className="px-2 py-0.5 rounded-full bg-[#eeddd0] border border-[#dfd3c7]">{size}</span>
          {installed && (
            <span className="px-2 py-0.5 rounded-full bg-[#e3f2e1] border border-[#bfe0ba] text-[#2e6b2a] flex items-center gap-1">
              <Check size={11} /> Instalado (v{installed})
            </span>
          )}
        </div>
        <p className="text-xs text-[#5c3a21] leading-relaxed">{game.description}</p>
        <ul className="text-xs text-[#5c3a21] grid grid-cols-1 sm:grid-cols-2 gap-1">
          {game.features.map((f) => (
            <li key={f} className="flex gap-1.5">
              <span className="text-[#6f4e37]">•</span>
              {f}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
          {!isTauri ? (
            <span className="text-xs text-[#8d6e63]">Instálalo desde la app de escritorio de CoffeeWorks.</span>
          ) : installed ? (
            <>
              <button type="button" disabled={!!busy} onClick={() => void run("launch")} className={`${btn} bg-[#2e7d32] hover:bg-[#256628] text-white`} data-game-play>
                {busy === "launch" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Jugar
              </button>
              {status?.update_available && (
                <button type="button" disabled={!!busy} onClick={() => void run("install")} className={`${btn} bg-[#6f4e37] hover:bg-[#5c3a21] text-white`}>
                  {busy === "install" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualizar a v{status.latest}
                </button>
              )}
              <button type="button" disabled={!!busy} onClick={() => void run("uninstall")} className={`${btn} text-[#8d5b4c] hover:bg-[#f3eae1]`}>
                {busy === "uninstall" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Desinstalar
              </button>
            </>
          ) : (
            <button type="button" disabled={!!busy || !!status?.error} onClick={() => void run("install")} className={`${btn} bg-[#6f4e37] hover:bg-[#5c3a21] text-white`} data-game-install>
              {busy === "install" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy === "install" ? "Descargando e instalando…" : `Instalar (${size})`}
            </button>
          )}
        </div>
        {(message || status?.error) && <p className="text-[11px] text-[#8d5b4c]">{message || status?.error}</p>}
      </div>
    </div>
  );
};

export const GamesView: React.FC = () => {
  const [tab, setTab] = useState<Tab>("games");
  const [gameId, setGameId] = useState<string | null>(GAMES[0]?.id ?? null);
  const game = GAMES.find((g) => g.id === gameId) || null;

  return (
    <div className="flex flex-col gap-6" data-games>
      <div className="flex items-center gap-3">
        <Gamepad2 size={26} className="text-[#6f4e37]" />
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-bold text-[#2c1b12]">CoffeeWorks Games</h1>
          <span className="text-xs text-[#795548]">Juegos originales hechos en Rust, con Mods, TexturePacks y Shaders para cada uno.</span>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-[#6f4e37] text-white border-[#6f4e37]" : "bg-white text-[#5c3a21] border-[#dfd3c7] hover:bg-[#f3eae1]"}`}
              data-games-tab={t.id}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
        {tab !== "games" && GAMES.length > 0 && (
          <select value={gameId || ""} onChange={(e) => setGameId(e.target.value)} className="ml-auto h-9 rounded-xl border border-[#dfd3c7] bg-white px-3 text-xs text-[#3e2723]" title="Juego">
            {GAMES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "games" &&
        (GAMES.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GAMES.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        ) : (
          <ComingSoon title="Los juegos de CoffeeWorks están en camino" text="Aquí aparecerán los juegos originales de CoffeeWorks, hechos en Rust para que sean rápidos y ligeros. Cada juego se descarga aparte, solo si lo quieres, y tendrá su propia sección de Mods, TexturePacks y Shaders." />
        ))}

      {tab !== "games" &&
        (game && game.content[tab].length ? (
          <div className="flex flex-col gap-3">
            {game.content[tab].map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-[#dfd3c7] bg-white p-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#2c1b12]">{c.name}</div>
                  <div className="text-xs text-[#795548]">{c.description}</div>
                  <div className="font-mono text-[10px] text-[#8d6e63]">
                    {c.author} · v{c.version} · para {game.name} {c.gameVersion}+ · {c.size}
                  </div>
                </div>
                <button type="button" disabled className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6f4e37] text-white text-xs font-semibold disabled:opacity-50">
                  <Download size={14} /> Instalar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <ComingSoon
            title={`${CONTENT_INFO[tab].label} ${game ? `para ${game.name}` : "para los juegos de CoffeeWorks"}`}
            text={`${CONTENT_INFO[tab].description} ${CONTENT_INFO[tab].detail}`}
          />
        ))}

      {/* Cómo funcionará */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(CONTENT_INFO) as GameContentKind[]).map((k) => {
          const Icon = k === "mods" ? Puzzle : k === "texturepacks" ? Palette : Sparkles;
          return (
            <div key={k} className="rounded-2xl border border-[#dfd3c7] bg-white p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-[#2c1b12]">
                <Icon size={16} className="text-[#6f4e37]" />
                {CONTENT_INFO[k].label}
              </div>
              <p className="text-xs text-[#5c3a21] leading-relaxed">{CONTENT_INFO[k].description}</p>
              <p className="text-[11px] text-[#8d6e63] leading-relaxed flex gap-1.5">
                {k === "mods" ? <ShieldCheck size={13} className="shrink-0 mt-0.5" /> : <Cpu size={13} className="shrink-0 mt-0.5" />}
                {CONTENT_INFO[k].detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
