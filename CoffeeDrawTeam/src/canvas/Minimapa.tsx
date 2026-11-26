// Minimapa: vista pequeña de todo el tablero con el recuadro de lo que se ve.

import type { Elemento, NotaColor } from "../board/model";
import { NOTA_COLORES } from "../board/model";
import { unirCajas, type Camara, type Punto } from "./vista";

const W = 180, H = 120;

export function Minimapa({ elementos, cam, tam, alIr }: { elementos: Elemento[]; cam: Camara; tam: { w: number; h: number }; alIr: (p: Punto) => void }) {
  const vista = { x: cam.x, y: cam.y, w: tam.w / cam.zoom, h: tam.h / cam.zoom };
  const todo = unirCajas([vista, ...elementos.filter((e) => e.kind !== "conector").map(({ x, y, w, h }) => ({ x, y, w, h }))])!;
  const esc = Math.min(W / todo.w, H / todo.h);
  const ox = (W - todo.w * esc) / 2 - todo.x * esc, oy = (H - todo.h * esc) / 2 - todo.y * esc;
  const ir = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    alIr({ x: (e.clientX - r.left - ox) / esc, y: (e.clientY - r.top - oy) / esc });
  };
  return (
    <svg width={W} height={H} className="rounded-xl bg-white/90 border border-[#e8dfd8] shadow-sm cursor-pointer" onPointerDown={ir} aria-label="Minimapa" data-minimapa>
      {elementos.map((e) =>
        e.kind === "conector" ? null : (
          <rect key={e.id} x={e.x * esc + ox} y={e.y * esc + oy} width={Math.max(1.5, e.w * esc)} height={Math.max(1.5, e.h * esc)}
            fill={e.kind === "nota" ? NOTA_COLORES[e.color as NotaColor] : e.kind === "trazo" ? e.color : "#d6c7b8"} />
        ),
      )}
      <rect x={vista.x * esc + ox} y={vista.y * esc + oy} width={vista.w * esc} height={vista.h * esc} fill="rgba(240,140,46,0.1)" stroke="#f08c2e" strokeWidth={1.5} />
    </svg>
  );
}
