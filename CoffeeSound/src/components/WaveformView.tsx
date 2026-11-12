// Editor de forma de onda: forma de onda o espectro de frecuencias, regla de
// tiempo, selección, cursor y zoom.

import React, { useEffect, useRef, useState } from "react";
import { peaks, spectrogram } from "../services/audio";
import type { Marker } from "../types";

export interface Range {
  a: number;
  b: number;
}

export interface WaveView {
  /** Primer segundo visible. */
  start: number;
  /** Segundos visibles. */
  span: number;
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
};

export const WaveformView: React.FC<{
  buffer: AudioBuffer;
  view: WaveView;
  setView: (v: WaveView) => void;
  selection: Range | null;
  setSelection: (r: Range | null) => void;
  cursor: number;
  setCursor: (t: number) => void;
  playhead: number | null;
  spectral: boolean;
  markers: Marker[];
}> = ({ buffer, view, setView, selection, setSelection, cursor, setCursor, playhead, spectral, markers }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 300 });
  const drag = useRef<{ x0: number; t0: number } | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const RULER = 22;
  const tx = (t: number) => ((t - view.start) / view.span) * size.w;
  const toT = (x: number) => Math.max(0, Math.min(buffer.duration, view.start + (x / size.w) * view.span));

  // Dibujo
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#141417";
    g.fillRect(0, 0, size.w, size.h);
    const H = size.h - RULER;
    const chans = buffer.numberOfChannels;
    const laneH = H / chans;
    const a = view.start;
    const b = Math.min(buffer.duration, view.start + view.span);
    const cols = Math.max(1, Math.round(tx(b) - tx(a)));
    // Selección (fondo)
    if (selection) {
      g.fillStyle = "rgba(255,169,77,0.18)";
      g.fillRect(tx(selection.a), RULER, tx(selection.b) - tx(selection.a), H);
    }
    if (spectral) {
      const spec = spectrogram(buffer, a, b, Math.min(cols, 900), 1024);
      const colW = cols / spec.length;
      const bins = spec[0]?.length || 1;
      const img = g.createImageData(Math.max(1, spec.length), Math.round(H));
      for (let x = 0; x < spec.length; x++)
        for (let y = 0; y < img.height; y++) {
          // Escala logarítmica de frecuencias
          const f = Math.pow(1 - y / img.height, 2.2);
          const v = spec[x][Math.min(bins - 1, Math.floor(f * bins))];
          const i = (y * img.width + x) * 4;
          img.data[i] = Math.min(255, v * 2.4 * 255);
          img.data[i + 1] = Math.max(0, Math.min(255, (v - 0.35) * 2.2 * 255));
          img.data[i + 2] = Math.max(0, Math.min(255, (v - 0.15) * 1.2 * 255 * (1 - v)));
          img.data[i + 3] = 255;
        }
      const tmp = document.createElement("canvas");
      tmp.width = img.width;
      tmp.height = img.height;
      tmp.getContext("2d")!.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(tmp, tx(a), RULER, spec.length * colW, H);
    } else
      for (let ch = 0; ch < chans; ch++) {
        const mid = RULER + laneH * ch + laneH / 2;
        g.strokeStyle = "#26262c";
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(size.w, mid);
        g.stroke();
        const pk = peaks(buffer, ch, a, b, cols);
        g.fillStyle = "#ffa94d";
        const x0 = tx(a);
        for (let x = 0; x < pk.length; x++) {
          const [mn, mx] = pk[x];
          const y1 = mid - mx * (laneH / 2 - 4);
          const y2 = mid - mn * (laneH / 2 - 4);
          g.fillRect(x0 + x, y1, 1, Math.max(1, y2 - y1));
        }
        if (ch) {
          g.fillStyle = "#2b2b31";
          g.fillRect(0, RULER + laneH * ch, size.w, 1);
        }
        g.fillStyle = "#6f6f77";
        g.font = "10px sans-serif";
        g.fillText(chans === 2 ? (ch ? "D" : "I") : "", 4, RULER + laneH * ch + 12);
      }
    // Regla
    g.fillStyle = "#1c1c20";
    g.fillRect(0, 0, size.w, RULER);
    const steps = [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => (s / view.span) * size.w > 70) || 600;
    g.fillStyle = "#9a9aa2";
    g.strokeStyle = "#3a3a40";
    g.font = "10px monospace";
    for (let t = Math.ceil(view.start / step) * step; t < view.start + view.span; t += step) {
      const x = Math.round(tx(t)) + 0.5;
      g.beginPath();
      g.moveTo(x, RULER - 6);
      g.lineTo(x, RULER);
      g.stroke();
      g.fillText(step < 1 ? t.toFixed(step < 0.01 ? 3 : 2) : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`, x + 3, 13);
    }
    // Marcadores
    for (const m of markers) {
      const x = tx(m.time);
      if (x < 0 || x > size.w) continue;
      g.fillStyle = "#ff6b6b";
      g.fillRect(x, 0, 1, size.h);
      g.fillText(m.name, x + 3, RULER + 12);
    }
    // Bordes de la selección, cursor y cabezal
    if (selection) {
      g.fillStyle = "#ffa94d";
      g.fillRect(tx(selection.a), RULER, 1, H);
      g.fillRect(tx(selection.b), RULER, 1, H);
    }
    g.fillStyle = "#ffd43b";
    g.fillRect(Math.round(tx(cursor)), 0, 1, size.h);
    if (playhead !== null) {
      g.fillStyle = "#ffffff";
      g.fillRect(Math.round(tx(playhead)), 0, 1.5, size.h);
    }
  }, [buffer, view, selection, cursor, playhead, spectral, size, markers]);

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const r = canvasRef.current!.getBoundingClientRect();
    const t = toT(e.clientX - r.left);
    if (e.shiftKey && selection) {
      const keepA = Math.abs(t - selection.a) > Math.abs(t - selection.b);
      setSelection(keepA ? { a: selection.a, b: t } : { a: t, b: selection.b });
      drag.current = { x0: e.clientX, t0: keepA ? selection.a : selection.b };
      return;
    }
    drag.current = { x0: e.clientX, t0: t };
    setCursor(t);
    setSelection(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = canvasRef.current!.getBoundingClientRect();
    const t = toT(e.clientX - r.left);
    if (Math.abs(e.clientX - d.x0) > 2) setSelection({ a: Math.min(d.t0, t), b: Math.max(d.t0, t) });
  };
  const onUp = () => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const k = e.deltaY > 0 ? 1.25 : 0.8;
      const t = toT(e.clientX - r.left);
      const span = Math.max(0.005, Math.min(buffer.duration, view.span * k));
      const start = Math.max(0, Math.min(buffer.duration - span, t - ((t - view.start) / view.span) * span));
      setView({ start, span });
    } else {
      const start = Math.max(0, Math.min(buffer.duration - view.span, view.start + (e.deltaX / size.w) * view.span));
      setView({ ...view, start });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" data-waveform>
      <div ref={hostRef} className="flex-1 min-h-0 relative">
        <canvas ref={canvasRef} style={{ width: size.w, height: size.h, cursor: "text" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel} />
      </div>
      {/* Vista general y barra de desplazamiento */}
      <input
        type="range"
        min={0}
        max={Math.max(0, buffer.duration - view.span)}
        step={0.001}
        value={view.start}
        onChange={(e) => setView({ ...view, start: Number(e.target.value) })}
        className="studio-range w-full"
        title="Desplazar"
      />
    </div>
  );
};
