// Dibujo SVG de cada elemento del tablero.

import type * as Y from "yjs";
import { NOTA_COLORES, type Elemento } from "../board/model";
import { rutaConector } from "./conectores";

export const ACENTO = "#f08c2e";

function tamTexto(texto: string, w: number, h: number): number {
  // Letra que cabe en la nota: baja con el largo del texto.
  const largo = Math.max(1, texto.length);
  const porArea = Math.sqrt((w * h) / largo) * 0.9;
  return Math.max(11, Math.min(28, porArea));
}

function TextoDentro({ el, texto, tam, color = "#2c1b12", negrita = false, centrado = true }: { el: Elemento; texto: string; tam: number; color?: string; negrita?: boolean; centrado?: boolean }) {
  return (
    <foreignObject x={el.x} y={el.y} width={Math.max(1, el.w)} height={Math.max(1, el.h)} style={{ pointerEvents: "none" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: centrado ? "center" : "flex-start",
          justifyContent: centrado ? "center" : "flex-start",
          textAlign: centrado ? "center" : "left",
          padding: centrado ? 10 : 2,
          boxSizing: "border-box",
          fontSize: tam,
          lineHeight: 1.2,
          fontWeight: negrita ? 700 : 500,
          color,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          overflow: "hidden",
          fontFamily: "'Hanken Grotesk', sans-serif",
        }}
      >
        {texto}
      </div>
    </foreignObject>
  );
}

function puntosATexto(p: number[], dx = 0, dy = 0): string {
  let s = "";
  for (let i = 0; i + 1 < p.length; i += 2) s += `${i ? "L" : "M"}${p[i] + dx} ${p[i + 1] + dy}`;
  return s;
}

export function ElementoSVG({ el, doc, urlImagen, ocultarTexto }: { el: Elemento; doc: Y.Doc; urlImagen?: string; ocultarTexto?: boolean }) {
  switch (el.kind) {
    case "nota":
      return (
        <g data-el={el.id}>
          <rect x={el.x + 3} y={el.y + 5} width={el.w} height={el.h} rx={6} fill="rgba(0,0,0,0.12)" />
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6} fill={NOTA_COLORES[el.color] ?? NOTA_COLORES.amarillo} />
          {!ocultarTexto && <TextoDentro el={el} texto={el.texto} tam={tamTexto(el.texto, el.w, el.h)} />}
        </g>
      );
    case "texto":
      return (
        <g data-el={el.id}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" />
          {!ocultarTexto && <TextoDentro el={el} texto={el.texto || " "} tam={el.tam} color={el.color} negrita={el.negrita} centrado={false} />}
        </g>
      );
    case "forma": {
      const { x, y, w, h } = el;
      const comun = { fill: el.relleno, stroke: el.borde, strokeWidth: 2 };
      const figura =
        el.forma === "elipse" ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...comun} /> :
        el.forma === "rombo" ? <polygon points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} {...comun} /> :
        el.forma === "flecha" ? (
          <polygon points={`${x},${y + h * 0.3} ${x + w * 0.65},${y + h * 0.3} ${x + w * 0.65},${y} ${x + w},${y + h / 2} ${x + w * 0.65},${y + h} ${x + w * 0.65},${y + h * 0.7} ${x},${y + h * 0.7}`} {...comun} />
        ) : <rect x={x} y={y} width={w} height={h} rx={8} {...comun} />;
      return (
        <g data-el={el.id}>
          {figura}
          {!ocultarTexto && el.texto && <TextoDentro el={el} texto={el.texto} tam={Math.min(22, tamTexto(el.texto, w, h))} />}
        </g>
      );
    }
    case "conector": {
      const { puntos } = rutaConector(doc, el);
      const d = puntosATexto(puntos);
      return (
        <g data-el={el.id}>
          <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
          <path d={d} stroke={el.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" markerEnd={el.flecha ? `url(#flecha-${el.color.replace("#", "")})` : undefined} />
        </g>
      );
    }
    case "trazo":
      return (
        <g data-el={el.id}>
          <path
            d={puntosATexto(el.puntos, el.x, el.y)}
            stroke={el.color}
            strokeWidth={el.grosor}
            strokeOpacity={el.marcador ? 0.45 : 1}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {el.puntos.length === 2 && <circle cx={el.x + el.puntos[0]} cy={el.y + el.puntos[1]} r={el.grosor / 2} fill={el.color} />}
        </g>
      );
    case "imagen":
      return (
        <g data-el={el.id}>
          {urlImagen ? (
            <image href={urlImagen} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="none" />
          ) : (
            <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="#efe6dd" stroke="#d6c7b8" strokeDasharray="6 4" />
          )}
        </g>
      );
  }
}

/** Puntas de flecha para cada color de conector usado. */
export function Marcadores({ colores }: { colores: string[] }) {
  return (
    <defs>
      {[...new Set(colores)].map((c) => (
        <marker key={c} id={`flecha-${c.replace("#", "")}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}
