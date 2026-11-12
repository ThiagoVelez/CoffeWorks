// Multipista de CoffeeSound: cabeceras de pista (volumen, panorama, silencio,
// solo y efectos) y línea de tiempo con clips que se mueven, recortan y dividen.

import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Headphones, SlidersHorizontal } from "lucide-react";
import type { Clip, Session, Track } from "../types";
import { getBuffer, peaks } from "../services/audio";
import { cx } from "../studio/ui";

const HEADER = 230;
const ROW = 92;
const RULER = 24;

export const Multitrack: React.FC<{
  session: Session;
  onChange: (s: Session, key?: string) => void;
  pxPerSec: number;
  setPxPerSec: (v: number) => void;
  scroll: number;
  setScroll: (v: number) => void;
  playhead: number;
  setPlayhead: (t: number) => void;
  selectedClip: string | null;
  setSelectedClip: (id: string | null) => void;
  onTrackFx: (trackId: string) => void;
  onDropAsset: (assetId: string, trackId: string, time: number) => void;
  version: number;
}> = ({ session, onChange, pxPerSec, setPxPerSec, scroll, setScroll, playhead, setPlayhead, selectedClip, setSelectedClip, onTrackFx, onDropAsset, version }) => {
  const laneRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = laneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const toX = (t: number) => (t - scroll) * pxPerSec;
  const toT = (x: number) => Math.max(0, scroll + x / pxPerSec);
  const snap = (t: number) => {
    // Imán: inicios y finales de los demás clips y el cabezal
    const pts = [playhead, ...session.tracks.flatMap((tr) => tr.clips.flatMap((c) => [c.start, c.start + c.duration]))];
    for (const p of pts) if (Math.abs(p - t) * pxPerSec < 8) return p;
    return t;
  };

  const patchTrack = (id: string, patch: Partial<Track>, key?: string) => onChange({ ...session, tracks: session.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }, key);
  const patchClip = (id: string, patch: Partial<Clip>, key?: string, toTrack?: string) => {
    const clip = session.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    if (!clip) return;
    const next = { ...clip, ...patch };
    onChange(
      {
        ...session,
        tracks: session.tracks.map((t) => {
          const without = t.clips.filter((c) => c.id !== id);
          const owner = toTrack ? t.id === toTrack : t.clips.some((c) => c.id === id);
          return { ...t, clips: owner ? [...without, next] : without };
        }),
      },
      key
    );
  };

  const dragClip = (e: React.PointerEvent, clip: Clip, mode: "move" | "left" | "right") => {
    e.stopPropagation();
    setSelectedClip(clip.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...clip };
    const asset = session.assets.find((a) => a.id === clip.assetId);
    const maxLen = asset?.duration ?? clip.duration;
    const move = (ev: PointerEvent) => {
      const dt = (ev.clientX - sx) / pxPerSec;
      if (mode === "move") {
        const rows = Math.round((ev.clientY - sy) / ROW);
        const idx = session.tracks.findIndex((t) => t.clips.some((c) => c.id === clip.id));
        const target = session.tracks[Math.max(0, Math.min(session.tracks.length - 1, idx + rows))];
        patchClip(clip.id, { start: Math.max(0, snap(o.start + dt)) }, "clip-move", target.id);
      } else if (mode === "left") {
        const d = Math.max(-o.offset, Math.min(o.duration - 0.05, snap(o.start + dt) - o.start));
        patchClip(clip.id, { start: o.start + d, offset: o.offset + d, duration: o.duration - d }, "clip-trim");
      } else {
        const end = Math.min(o.start + (maxLen - o.offset), Math.max(o.start + 0.05, snap(o.start + o.duration + dt)));
        patchClip(clip.id, { duration: end - o.start }, "clip-trim");
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const total = Math.max(60, ...session.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration + 10)));
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  const step = steps.find((s) => s * pxPerSec > 60) || 120;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#141417]" data-multitrack>
      <div className="flex shrink-0" style={{ height: RULER }}>
        <div style={{ width: HEADER }} className="shrink-0 bg-[#1c1c20] border-r border-black/50 flex items-center px-2 gap-2 text-[11px] text-[#9a9aa2]">
          Zoom
          <input type="range" min={5} max={400} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} className="studio-range flex-1" />
        </div>
        <div
          className="flex-1 relative bg-[#1c1c20] overflow-hidden cursor-pointer"
          onPointerDown={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setPlayhead(toT(e.clientX - r.left));
          }}
        >
          {Array.from({ length: Math.ceil(width / pxPerSec / step) + 2 }, (_, i) => {
            const t = Math.floor(scroll / step) * step + i * step;
            return (
              <span key={t} className="absolute top-0 h-full border-l border-[#3a3a40] text-[10px] text-[#9a9aa2] font-mono pl-1" style={{ left: toX(t) }}>
                {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
                {step < 1 ? `.${Math.round((t % 1) * 10)}` : ""}
              </span>
            );
          })}
        </div>
      </div>
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) setPxPerSec(Math.max(5, Math.min(400, pxPerSec * (e.deltaY > 0 ? 0.85 : 1.18))));
          else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) setScroll(Math.max(0, Math.min(total, scroll + (e.deltaX || e.deltaY) / pxPerSec)));
        }}
      >
        {session.tracks.map((t) => (
          <div key={t.id} className="flex border-b border-black/50" style={{ height: ROW }} data-track={t.name}>
            <div style={{ width: HEADER }} className="shrink-0 bg-[#202023] border-r border-black/50 p-2 flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="w-2 h-5 rounded-sm" style={{ backgroundColor: t.color }} />
                <input value={t.name} onChange={(e) => patchTrack(t.id, { name: e.target.value }, `name-${t.id}`)} className="flex-1 min-w-0 bg-transparent text-[12px] outline-none" />
                <button type="button" title="Silenciar (M)" onClick={() => patchTrack(t.id, { mute: !t.mute })} className={cx("w-6 h-5 rounded text-[10px] font-bold", t.mute ? "bg-[#4dabf7] text-black" : "bg-[#34343a] text-[#c9c9cf]")}>
                  {t.mute ? <VolumeX size={11} className="mx-auto" /> : "M"}
                </button>
                <button type="button" title="Solo (S)" onClick={() => patchTrack(t.id, { solo: !t.solo })} className={cx("w-6 h-5 rounded text-[10px] font-bold", t.solo ? "bg-[#ffd43b] text-black" : "bg-[#34343a] text-[#c9c9cf]")}>
                  {t.solo ? <Headphones size={11} className="mx-auto" /> : "S"}
                </button>
                <button type="button" title="Efectos de la pista" onClick={() => onTrackFx(t.id)} className={cx("w-6 h-5 rounded flex items-center justify-center", t.effects.length ? "bg-[#e67700] text-white" : "bg-[#34343a] text-[#c9c9cf]")}>
                  <SlidersHorizontal size={11} />
                </button>
              </div>
              <label className="flex items-center gap-1 text-[10px] text-[#9a9aa2]">
                <Volume2 size={11} />
                <input type="range" min={-40} max={12} step={0.5} value={t.volume} onChange={(e) => patchTrack(t.id, { volume: Number(e.target.value) }, `vol-${t.id}`)} className="studio-range flex-1" data-volume />
                <span className="w-10 text-right font-mono">{t.volume > 0 ? "+" : ""}{t.volume.toFixed(1)}</span>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-[#9a9aa2]">
                <span className="w-3">P</span>
                <input type="range" min={-1} max={1} step={0.05} value={t.pan} onChange={(e) => patchTrack(t.id, { pan: Number(e.target.value) }, `pan-${t.id}`)} onDoubleClick={() => patchTrack(t.id, { pan: 0 })} className="studio-range flex-1" />
                <span className="w-10 text-right font-mono">{t.pan === 0 ? "C" : `${t.pan < 0 ? "I" : "D"}${Math.round(Math.abs(t.pan) * 100)}`}</span>
              </label>
            </div>
            <div
              ref={t === session.tracks[0] ? laneRef : undefined}
              className="flex-1 relative overflow-hidden"
              data-lane={t.name}
              onPointerDown={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setPlayhead(toT(e.clientX - r.left));
                setSelectedClip(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/coffee-asset");
                if (!id) return;
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onDropAsset(id, t.id, snap(toT(e.clientX - r.left)));
              }}
            >
              {t.clips.map((c) => (
                <ClipView key={c.id} clip={c} session={session} color={t.color} x={toX(c.start)} w={c.duration * pxPerSec} selected={c.id === selectedClip} onDrag={(e, m) => dragClip(e, c, m)} version={version} />
              ))}
            </div>
          </div>
        ))}
        <div className="absolute top-0 bottom-0 w-px bg-white pointer-events-none" style={{ left: HEADER + toX(playhead) }} data-playhead />
      </div>
      <input type="range" min={0} max={total} step={0.01} value={scroll} onChange={(e) => setScroll(Number(e.target.value))} className="studio-range w-full shrink-0" title="Desplazar" />
    </div>
  );
};

const ClipView: React.FC<{ clip: Clip; session: Session; color: string; x: number; w: number; selected: boolean; onDrag: (e: React.PointerEvent, mode: "move" | "left" | "right") => void; version: number }> = ({ clip, session, color, x, w, selected, onDrag, version }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const asset = session.assets.find((a) => a.id === clip.assetId);
  useEffect(() => {
    const c = ref.current;
    const buf = getBuffer(asset?.data);
    if (!c || !buf || w < 2) return;
    const W = Math.min(4000, Math.round(w));
    c.width = W;
    c.height = ROW - 26;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, W, c.height);
    const pk = peaks(buf, 0, clip.offset, clip.offset + clip.duration, W);
    g.fillStyle = "rgba(255,255,255,0.75)";
    const mid = c.height / 2;
    pk.forEach(([mn, mx], i) => g.fillRect(i, mid - mx * mid, 1, Math.max(1, (mx - mn) * mid)));
  }, [asset?.data, clip.offset, clip.duration, w, version]);
  if (x + w < 0 || x > 10000) return null;
  return (
    <div
      className={cx("absolute top-1 bottom-1 rounded-md overflow-hidden border", selected ? "border-white" : "border-black/40")}
      style={{ left: x, width: Math.max(2, w), backgroundColor: `${color}66` }}
      onPointerDown={(e) => onDrag(e, "move")}
      data-clip={asset?.name}
    >
      <div className="h-4 px-1 text-[10px] text-white truncate" style={{ backgroundColor: color }}>
        {asset?.name || "Falta el audio"}
        {clip.gain ? ` · ${clip.gain > 0 ? "+" : ""}${clip.gain} dB` : ""}
      </div>
      <canvas ref={ref} className="w-full" style={{ height: ROW - 26 }} />
      {clip.fadeIn > 0 && <div className="absolute top-4 left-0 h-full bg-gradient-to-r from-black/50 to-transparent pointer-events-none" style={{ width: (clip.fadeIn / clip.duration) * w }} />}
      {clip.fadeOut > 0 && <div className="absolute top-4 right-0 h-full bg-gradient-to-l from-black/50 to-transparent pointer-events-none" style={{ width: (clip.fadeOut / clip.duration) * w }} />}
      <div className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize hover:bg-white/40" onPointerDown={(e) => onDrag(e, "left")} />
      <div className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-white/40" onPointerDown={(e) => onDrag(e, "right")} />
    </div>
  );
};

