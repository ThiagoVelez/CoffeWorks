// Línea de tiempo: pistas, clips, regla y cabezal. Los clips se mueven
// arrastrándolos (también entre pistas del mismo tipo) y se recortan por los
// bordes; todo se ajusta a los bordes de otros clips y al cabezal.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Volume2, VolumeX, Lock, Unlock, Film, Type, Music, Plus, Trash2 } from "lucide-react";
import type { Clip, MediaClip, MediaItem, Project, Track, TrackKind } from "../types";
import { MIN_CLIP, clipEnd, formatTime, maxDuration, overlaps } from "../services/project";

export const MEDIA_DRAG_TYPE = "application/x-coffeeedit-media";

interface TimelineProps {
  project: Project;
  time: number;
  pxPerSec: number;
  selectedId: string | null;
  thumbnails: Record<string, string>;
  waveforms: Record<string, number[]>;
  onSeek: (t: number) => void;
  onSelect: (id: string | null) => void;
  onChange: (project: Project, key?: string) => void;
  onDropMedia: (mediaId: string, trackId: string, start: number) => void;
  onZoom: (pxPerSec: number) => void;
  onAddTrack: (kind: TrackKind) => void;
  onDeleteTrack: (id: string) => void;
}

const LANE_HEIGHT: Record<TrackKind, number> = { video: 62, text: 38, audio: 48 };
const HEADER_W = 168;
const SNAP_PX = 8;

const trackAccepts = (track: Track, clip: Clip, media?: MediaItem) => {
  if (clip.type === "text") return track.kind === "text";
  if (media?.kind === "audio") return track.kind === "audio";
  return track.kind === "video";
};

const clipColor = (clip: Clip, media?: MediaItem) =>
  clip.type === "text" ? "#7e57c2" : media?.kind === "audio" ? "#2f6fa8" : media?.kind === "image" ? "#3f7f9a" : "#21876a";

type Drag =
  | { kind: "move"; clipId: string; startX: number; orig: Clip; offsetSec: number }
  | { kind: "trim-left" | "trim-right"; clipId: string; startX: number; orig: Clip };

export const Timeline: React.FC<TimelineProps> = ({
  project,
  time,
  pxPerSec,
  selectedId,
  thumbnails,
  waveforms,
  onSeek,
  onSelect,
  onChange,
  onDropMedia,
  onZoom,
  onAddTrack,
  onDeleteTrack,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const dragRef = useRef<Drag | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [dropHint, setDropHint] = useState<{ trackId: string; start: number } | null>(null);
  const mediaMap = useMemo(() => new Map(project.media.map((m) => [m.id, m])), [project.media]);

  const duration = project.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
  const width = Math.max(duration + 20, 60) * pxPerSec;

  // Paso de la regla según el zoom
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pxPerSec >= 70) || 600;

  const secAt = (clientX: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left + el.scrollLeft) / pxPerSec);
  };

  /** Ajusta `t` al borde más cercano (otros clips, cabezal, inicio). */
  const snap = (t: number, ignoreId: string) => {
    const threshold = SNAP_PX / pxPerSec;
    let best = t;
    let bestDist = threshold;
    const candidates = [0, time];
    for (const c of projectRef.current.clips) {
      if (c.id === ignoreId) continue;
      candidates.push(c.start, clipEnd(c));
    }
    for (const c of candidates) {
      const d = Math.abs(c - t);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  };

  const laneAt = (clientX: number, clientY: number): Track | null => {
    const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-lane]");
    const id = el?.dataset.lane;
    return projectRef.current.tracks.find((t) => t.id === id) || null;
  };

  const updateClip = (clip: Clip, key: string) => {
    const current = projectRef.current;
    onChange({ ...current, clips: current.clips.map((c) => (c.id === clip.id ? clip : c)) }, key);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const current = projectRef.current;
      const clip = current.clips.find((c) => c.id === drag.clipId);
      if (!clip) return;
      const media = clip.type === "media" ? mediaMap.get(clip.mediaId) : undefined;
      const dt = (e.clientX - drag.startX) / pxPerSec;
      if (drag.kind === "move") {
        let start = Math.max(0, drag.orig.start + dt);
        // Se ajusta el borde izquierdo o el derecho, el que quede más cerca
        const snappedStart = snap(start, clip.id);
        const snappedEnd = snap(start + clip.duration, clip.id) - clip.duration;
        if (Math.abs(snappedStart - start) <= Math.abs(snappedEnd - start)) start = snappedStart;
        else start = Math.max(0, snappedEnd);
        let trackId = clip.trackId;
        const lane = laneAt(e.clientX, e.clientY);
        if (lane && lane.id !== clip.trackId && !lane.locked && trackAccepts(lane, clip, media)) trackId = lane.id;
        if (overlaps(current.clips, trackId, start, clip.duration, clip.id)) return;
        updateClip({ ...clip, start, trackId } as Clip, `move-${clip.id}`);
        return;
      }
      if (drag.kind === "trim-right") {
        let end = snap(drag.orig.start + drag.orig.duration + dt, clip.id);
        const limit = clip.type === "media" ? maxDuration(clip as MediaClip, media) : 3600;
        let duration = Math.min(limit, Math.max(MIN_CLIP, end - clip.start));
        if (overlaps(current.clips, clip.trackId, clip.start, duration, clip.id)) {
          const next = current.clips
            .filter((c) => c.trackId === clip.trackId && c.id !== clip.id && c.start >= clip.start)
            .sort((a, b) => a.start - b.start)[0];
          if (!next) return;
          duration = Math.max(MIN_CLIP, next.start - clip.start);
          end = clip.start + duration;
        }
        updateClip({ ...clip, duration, fadeOut: Math.min(clip.fadeOut, duration / 2) } as Clip, `trim-${clip.id}`);
        return;
      }
      // Recorte por la izquierda: cambia el inicio y el punto de entrada
      const orig = drag.orig;
      let start = snap(orig.start + dt, clip.id);
      const end = clipEnd(orig);
      start = Math.min(start, end - MIN_CLIP);
      start = Math.max(0, start);
      if (orig.type === "media" && media?.kind !== "image") {
        const minStart = orig.start - orig.in / orig.speed; // no antes del principio del archivo
        start = Math.max(start, minStart);
      }
      const prev = current.clips
        .filter((c) => c.trackId === clip.trackId && c.id !== clip.id && clipEnd(c) <= orig.start + 1e-6)
        .sort((a, b) => clipEnd(b) - clipEnd(a))[0];
      if (prev) start = Math.max(start, clipEnd(prev));
      const shift = start - orig.start;
      const next = { ...orig, start, duration: end - start } as Clip;
      if (next.type === "media" && orig.type === "media") next.in = Math.max(0, orig.in + shift * orig.speed);
      next.fadeIn = Math.min(next.fadeIn, next.duration / 2);
      updateClip(next, `trim-${clip.id}`);
    };
    const up = () => {
      dragRef.current = null;
      setScrubbing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerSec, mediaMap, time]);

  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => onSeek(secAt(e.clientX));
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing, pxPerSec]);

  // El cabezal se mantiene a la vista durante la reproducción
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrubbing || dragRef.current) return;
    const x = time * pxPerSec;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 80);
  }, [time, pxPerSec, scrubbing]);

  const startDrag = (e: React.PointerEvent, clip: Clip, kind: Drag["kind"]) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSelect(clip.id);
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;
    e.preventDefault();
    dragRef.current =
      kind === "move"
        ? { kind, clipId: clip.id, startX: e.clientX, orig: clip, offsetSec: secAt(e.clientX) - clip.start }
        : { kind, clipId: clip.id, startX: e.clientX, orig: clip };
  };

  const patchTrack = (id: string, patch: Partial<Track>) =>
    onChange({ ...project, tracks: project.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  const ticks: number[] = [];
  for (let t = 0; t * pxPerSec < width; t += step) ticks.push(t);

  const KindIcon = { video: Film, text: Type, audio: Music };

  return (
    <div className="flex flex-col h-full bg-[#141a18] text-[#dbeae4] select-none">
      <div className="flex-1 flex overflow-hidden">
        {/* Cabeceras de pista */}
        <div className="shrink-0 border-r border-[#26322e] bg-[#161d1b]" style={{ width: HEADER_W }}>
          <div className="h-7 border-b border-[#26322e] flex items-center gap-1 px-2">
            {(["video", "text", "audio"] as TrackKind[]).map((kind) => {
              const Icon = KindIcon[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  title={`Añadir pista de ${kind === "video" ? "video" : kind === "text" ? "texto" : "audio"}`}
                  onClick={() => onAddTrack(kind)}
                  className="h-5 px-1.5 rounded text-[10px] flex items-center gap-0.5 bg-[#22302b] hover:bg-[#2b3d37]"
                >
                  <Plus size={10} />
                  <Icon size={11} />
                </button>
              );
            })}
          </div>
          {project.tracks.map((track) => {
            const Icon = KindIcon[track.kind];
            return (
              <div
                key={track.id}
                className="group border-b border-[#222c29] flex items-center gap-1.5 px-2 text-[11px]"
                style={{ height: LANE_HEIGHT[track.kind] }}
              >
                <Icon size={13} className="text-[#7fc9b0] shrink-0" />
                <span className="flex-1 truncate">{track.name}</span>
                {track.kind !== "audio" && (
                  <button type="button" title={track.hidden ? "Mostrar pista" : "Ocultar pista"} onClick={() => patchTrack(track.id, { hidden: !track.hidden })}>
                    {track.hidden ? <EyeOff size={12} className="text-[#e57373]" /> : <Eye size={12} />}
                  </button>
                )}
                {track.kind !== "text" && (
                  <button type="button" title={track.muted ? "Activar sonido" : "Silenciar pista"} onClick={() => patchTrack(track.id, { muted: !track.muted })}>
                    {track.muted ? <VolumeX size={12} className="text-[#e57373]" /> : <Volume2 size={12} />}
                  </button>
                )}
                <button type="button" title={track.locked ? "Desbloquear" : "Bloquear"} onClick={() => patchTrack(track.id, { locked: !track.locked })}>
                  {track.locked ? <Lock size={12} className="text-[#ffca28]" /> : <Unlock size={12} className="opacity-60" />}
                </button>
                <button
                  type="button"
                  title="Eliminar pista"
                  className="opacity-0 group-hover:opacity-100 text-[#9ab] hover:text-red-400"
                  onClick={() => onDeleteTrack(track.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Regla y carriles */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              onZoom(Math.min(400, Math.max(4, pxPerSec * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
            }
          }}
        >
          <div className="relative" style={{ width }}>
            <div
              data-ruler
              className="h-7 border-b border-[#26322e] relative cursor-text bg-[#18201e]"
              onPointerDown={(e) => {
                onSeek(secAt(e.clientX));
                setScrubbing(true);
              }}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l border-[#33423d]" style={{ left: t * pxPerSec }}>
                  <span className="absolute left-1 top-1 text-[10px] font-mono text-[#8fb5a8]">{formatTime(t)}</span>
                </div>
              ))}
            </div>

            {project.tracks.map((track) => (
              <div
                key={track.id}
                data-lane={track.id}
                className={`relative border-b border-[#222c29] ${track.locked ? "bg-[#161c1a]" : "bg-[#121816]"}`}
                style={{ height: LANE_HEIGHT[track.kind] }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  onSelect(null);
                  onSeek(secAt(e.clientX));
                  setScrubbing(true);
                }}
                onDragOver={(e) => {
                  if (!Array.from(e.dataTransfer.types).includes(MEDIA_DRAG_TYPE) || track.locked) return;
                  e.preventDefault();
                  setDropHint({ trackId: track.id, start: snap(secAt(e.clientX), "") });
                }}
                onDragLeave={() => setDropHint(null)}
                onDrop={(e) => {
                  const mediaId = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
                  setDropHint(null);
                  if (!mediaId) return;
                  e.preventDefault();
                  onDropMedia(mediaId, track.id, snap(secAt(e.clientX), ""));
                }}
              >
                {dropHint?.trackId === track.id && (
                  <div className="absolute top-1 bottom-1 w-0.5 bg-[#4fd1a5] z-10" style={{ left: dropHint.start * pxPerSec }} />
                )}
                {project.clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => {
                    const media = clip.type === "media" ? mediaMap.get(clip.mediaId) : undefined;
                    const selected = clip.id === selectedId;
                    const thumb = media ? thumbnails[media.id] : undefined;
                    const wave = media ? waveforms[media.id] : undefined;
                    const label = clip.type === "text" ? clip.text.split("\n")[0] || "Texto" : media?.name || "Medio";
                    const w = Math.max(4, clip.duration * pxPerSec);
                    return (
                      <div
                        key={clip.id}
                        data-clip={clip.id}
                        className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-grab active:cursor-grabbing ${
                          selected ? "ring-2 ring-white z-10" : "ring-1 ring-black/30"
                        } ${track.hidden ? "opacity-50" : ""}`}
                        style={{ left: clip.start * pxPerSec, width: w, background: clipColor(clip, media) }}
                        onPointerDown={(e) => startDrag(e, clip, "move")}
                        title={`${label} · ${formatTime(clip.duration)}`}
                      >
                        {thumb && media?.kind !== "audio" && (
                          <div
                            className="absolute inset-0 opacity-70"
                            style={{ backgroundImage: `url(${thumb})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }}
                          />
                        )}
                        {wave && (
                          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${wave.length} 100`}>
                            {(() => {
                              // Solo la parte del archivo que usa el clip
                              const m = clip as MediaClip;
                              const total = media?.duration || 1;
                              const from = Math.floor((m.in / total) * wave.length);
                              const to = Math.ceil(((m.in + m.duration * m.speed) / total) * wave.length);
                              const slice = wave.slice(from, Math.max(from + 1, to));
                              const pts = slice.map((v, i) => `${(i / slice.length) * wave.length},${50 - v * 46}`).join(" ");
                              const back = slice
                                .map((v, i) => `${(i / slice.length) * wave.length},${50 + v * 46}`)
                                .reverse()
                                .join(" ");
                              return <polygon points={`${pts} ${back}`} fill="rgba(255,255,255,0.45)" />;
                            })()}
                          </svg>
                        )}
                        {/* Fundidos */}
                        {clip.fadeIn > 0 && (
                          <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/50 to-transparent" style={{ width: clip.fadeIn * pxPerSec }} />
                        )}
                        {clip.fadeOut > 0 && (
                          <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black/50 to-transparent" style={{ width: clip.fadeOut * pxPerSec }} />
                        )}
                        <div className="relative px-2 pt-0.5 text-[10px] font-semibold text-white truncate drop-shadow">
                          {label}
                          {clip.type === "media" && clip.speed !== 1 ? ` · ${clip.speed}x` : ""}
                        </div>
                        {/* Tiradores de recorte */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40"
                          onPointerDown={(e) => startDrag(e, clip, "trim-left")}
                          title="Recortar el inicio"
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40"
                          onPointerDown={(e) => startDrag(e, clip, "trim-right")}
                          title="Recortar el final"
                        />
                      </div>
                    );
                  })}
              </div>
            ))}

            {/* Cabezal */}
            <div className="absolute top-0 bottom-0 w-px bg-[#ff5252] pointer-events-none z-20" style={{ left: time * pxPerSec }}>
              <div className="absolute -top-0 -left-[5px] w-[11px] h-3 bg-[#ff5252]" style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
