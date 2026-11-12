// Presentación del prototipo: muestra un marco a pantalla completa y sigue
// los enlaces al hacer clic, con transiciones.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, RotateCcw, MousePointerClick } from "lucide-react";
import type { Page, Transition, UxDocument } from "../types";
import { parentMap, topFrames } from "../services/model";
import { renderNode } from "../services/render";

interface Props {
  doc: UxDocument;
  page: Page;
  startId: string | null;
  onClose: () => void;
}

const ANIM: Record<Transition, [string, string]> = {
  instant: ["", ""],
  dissolve: ["cux-fade-in", "cux-fade-out"],
  "slide-left": ["cux-from-right", ""],
  "slide-right": ["cux-from-left", ""],
  "slide-up": ["cux-from-bottom", ""],
  "slide-down": ["cux-from-top", ""],
  "push-left": ["cux-from-right", "cux-to-left"],
  "push-right": ["cux-from-left", "cux-to-right"],
};

export const PresentView: React.FC<Props> = ({ doc, page, startId, onClose }) => {
  const frames = topFrames(page);
  const first = startId && page.nodes[startId] ? startId : page.startFrame && page.nodes[page.startFrame] ? page.startFrame : frames[0]?.id;
  const [current, setCurrent] = useState<string | undefined>(first);
  const [previous, setPrevious] = useState<{ id: string; anim: string } | null>(null);
  const [enter, setEnter] = useState({ anim: "", duration: 300, key: 0 });
  const [hints, setHints] = useState(false);
  const historyRef = useRef<string[]>([]);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const parents = useMemo(() => parentMap(page), [page]);

  useEffect(() => {
    const r = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  const go = (target: string, transition: Transition, duration: number, back = false) => {
    if (!current || !page.nodes[target]) return;
    if (!back) historyRef.current.push(current);
    const [inAnim, outAnim] = ANIM[transition];
    setPrevious(outAnim ? { id: current, anim: outAnim } : null);
    setEnter({ anim: inAnim, duration, key: Date.now() });
    setCurrent(target);
    window.setTimeout(() => setPrevious(null), duration);
  };

  const goBack = () => {
    const prev = historyRef.current.pop();
    if (prev) go(prev, "dissolve", 200, true);
  };

  const step = (delta: number) => {
    const i = frames.findIndex((f) => f.id === current);
    const next = frames[i + delta];
    if (next) go(next.id, delta > 0 ? "slide-left" : "slide-right", 250);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Backspace") goBack();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });

  if (!current || !page.nodes[current]) {
    return (
      <div className="fixed inset-0 z-[90000] bg-[#1e1e1e] text-white flex flex-col items-center justify-center gap-3" data-present>
        <p>La página no tiene marcos para presentar.</p>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-[#0d99ff]">
          Cerrar
        </button>
      </div>
    );
  }

  const frame = page.nodes[current];
  const scale = Math.min(1, (size.w - 80) / frame.w, (size.h - 110) / frame.h);

  const onClick = (e: React.MouseEvent) => {
    let el = (e.target as Element).closest("[data-node-id], [data-inner-id]");
    // Se busca el enlace en la capa pulsada o en sus contenedores
    while (el) {
      const id = el.getAttribute("data-inner-id") || el.getAttribute("data-node-id");
      const n = id ? page.nodes[id] : null;
      if (n?.link) {
        if (n.link.target === "back") goBack();
        else go(n.link.target, n.link.transition, n.link.duration);
        return;
      }
      let parent = id ? parents.get(id) : null;
      while (parent && !page.nodes[parent]?.link) parent = parents.get(parent) ?? null;
      if (parent && page.nodes[parent]?.link) {
        const link = page.nodes[parent].link!;
        if (link.target === "back") goBack();
        else go(link.target, link.transition, link.duration);
        return;
      }
      el = el.parentElement?.closest("[data-node-id]") || null;
    }
    // Clic fuera de una zona enlazada: se señalan las zonas que sí lo son
    setHints(true);
    window.setTimeout(() => setHints(false), 700);
  };

  const screen = (id: string, anim: string, duration: number, key: string | number) => {
    const n = page.nodes[id];
    const ctx = { doc, page: { ...page, nodes: { ...page.nodes, [id]: { ...n, x: 0, y: 0 } } }, prefix: `p${key}-`, interactive: true };
    return (
      <div
        key={key}
        className={`absolute inset-0 ${anim}`}
        style={{ animationDuration: `${duration}ms` }}
      >
        <svg width={n.w * scale} height={n.h * scale} viewBox={`0 0 ${n.w} ${n.h}`} className="block">
          {renderNode(id, ctx)}
          {hints &&
            Object.values(page.nodes)
              .filter((x) => x.link)
              .map((x) => {
                let ax = 0;
                let ay = 0;
                let cur: string | null | undefined = x.id;
                let inside = false;
                while (cur) {
                  if (cur === id) {
                    inside = true;
                    break;
                  }
                  ax += page.nodes[cur].x;
                  ay += page.nodes[cur].y;
                  cur = parents.get(cur);
                }
                return inside ? <rect key={x.id} x={ax} y={ay} width={x.w} height={x.h} fill="rgba(13,153,255,0.25)" stroke="#0d99ff" strokeWidth={2 / scale} rx={4} pointerEvents="none" /> : null;
              })}
        </svg>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[90000] bg-[#1e1e1e] flex flex-col select-none" data-present>
      <style>{`
        @keyframes cux-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cux-fade-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes cux-from-right { from { transform: translateX(100%) } to { transform: none } }
        @keyframes cux-from-left { from { transform: translateX(-100%) } to { transform: none } }
        @keyframes cux-from-bottom { from { transform: translateY(100%) } to { transform: none } }
        @keyframes cux-from-top { from { transform: translateY(-100%) } to { transform: none } }
        @keyframes cux-to-left { from { transform: none } to { transform: translateX(-100%) } }
        @keyframes cux-to-right { from { transform: none } to { transform: translateX(100%) } }
        .cux-fade-in { animation: cux-fade-in ease both } .cux-fade-out { animation: cux-fade-out ease both }
        .cux-from-right { animation: cux-from-right ease-out both } .cux-from-left { animation: cux-from-left ease-out both }
        .cux-from-bottom { animation: cux-from-bottom ease-out both } .cux-from-top { animation: cux-from-top ease-out both }
        .cux-to-left { animation: cux-to-left ease-out both } .cux-to-right { animation: cux-to-right ease-out both }
      `}</style>
      <div className="h-12 flex items-center gap-2 px-4 text-white shrink-0">
        <span className="text-[13px] font-semibold">{frame.name}</span>
        <span className="text-[11px] text-[#9a9a9a]">
          {frames.findIndex((f) => f.id === current) + 1} / {frames.length}
        </span>
        <div className="flex-1" />
        <span className="text-[11px] text-[#9a9a9a] flex items-center gap-1">
          <MousePointerClick size={13} /> Haz clic en los elementos enlazados · ← → cambia de pantalla
        </span>
        <button type="button" title="Volver al inicio" onClick={() => first && go(first, "dissolve", 200)} className="w-8 h-8 rounded-md hover:bg-[#333] flex items-center justify-center">
          <RotateCcw size={15} />
        </button>
        <button type="button" title="Anterior" onClick={() => step(-1)} className="w-8 h-8 rounded-md hover:bg-[#333] flex items-center justify-center">
          <ChevronLeft size={17} />
        </button>
        <button type="button" title="Siguiente" onClick={() => step(1)} className="w-8 h-8 rounded-md hover:bg-[#333] flex items-center justify-center">
          <ChevronRight size={17} />
        </button>
        <button type="button" data-btn="close-present" title="Cerrar (Esc)" onClick={onClose} className="w-8 h-8 rounded-md hover:bg-[#333] flex items-center justify-center">
          <X size={17} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center pb-6">
        <div
          data-present-screen
          onClick={onClick}
          className="relative overflow-hidden shadow-2xl"
          style={{ width: frame.w * scale, height: frame.h * scale, borderRadius: frame.device && /iphone|android/.test(frame.device) ? 28 * scale : 4, cursor: "pointer" }}
        >
          {previous && screen(previous.id, previous.anim, enter.duration, `prev-${enter.key}`)}
          {screen(current, enter.anim, enter.duration, enter.key)}
        </div>
      </div>
    </div>
  );
};
