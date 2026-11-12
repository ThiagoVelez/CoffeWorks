// Dibujo de figuras y conexiones en SVG (lienzo y exportación).

import React from "react";
import type { Cardinality, DEdge, DNode, Diagram } from "../types";
import { FONT, LINE, MONO, PAD, compartments, memberText, textWidth } from "./model";

type Pt = { x: number; y: number };

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

const ROUND = new Set(["usecase", "erAttribute", "initial", "final", "flowFinal", "connector", "providedInterface", "history"]);
const DIAMOND = new Set(["decision", "erRelationship", "choice"]);
export const LIFELINES = new Set(["lifeline", "actorLifeline"]);

export const center = (n: DNode): Pt => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

/** Punto del borde de la figura en la dirección de otro punto. */
export function boundary(n: DNode, toward: Pt): Pt {
  const c = center(n);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const rx = n.w / 2;
  const ry = n.h / 2;
  if (n.type === "actor") {
    // El actor se conecta a su silueta, no a la caja con el nombre
    const s = Math.min(Math.abs(rx / (dx || 1e-9)), Math.abs(ry / (dy || 1e-9)));
    return { x: c.x + dx * s * 0.75, y: c.y + dy * s * 0.8 };
  }
  if (ROUND.has(n.type)) {
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return { x: c.x + dx * t, y: c.y + dy * t };
  }
  if (DIAMOND.has(n.type)) {
    const t = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
    return { x: c.x + dx * t, y: c.y + dy * t };
  }
  const t = Math.min(Math.abs(rx / (dx || 1e-9)), Math.abs(ry / (dy || 1e-9)));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Puntos del recorrido de una conexión. */
export function edgePoints(d: Diagram, e: DEdge): Pt[] {
  const s = d.nodes[e.source];
  const t = d.nodes[e.target];
  if (!s || !t) return [];
  // Mensajes de secuencia: horizontales a la altura del mensaje
  if (e.y !== undefined && (LIFELINES.has(s.type) || s.type === "activation") && (LIFELINES.has(t.type) || t.type === "activation")) {
    const sx = s.type === "activation" ? (center(t).x > center(s).x ? s.x + s.w : s.x) : center(s).x;
    if (s.id === t.id || Math.abs(center(s).x - center(t).x) < 2) {
      const x = s.type === "activation" ? s.x + s.w : center(s).x;
      return [
        { x, y: e.y },
        { x: x + 46, y: e.y },
        { x: x + 46, y: e.y + 26 },
        { x, y: e.y + 26 },
      ];
    }
    let tx = t.type === "activation" ? (center(s).x < center(t).x ? t.x : t.x + t.w) : center(t).x;
    // Mensaje de creación: llega a la cabecera del participante creado
    if (e.kind === "createMessage" && LIFELINES.has(t.type)) tx = center(s).x < center(t).x ? t.x : t.x + t.w;
    return [
      { x: sx, y: e.y },
      { x: tx, y: e.y },
    ];
  }
  if (s.id === t.id) {
    const x = s.x + s.w;
    const y = s.y + Math.min(30, s.h / 3);
    return [
      { x, y },
      { x: x + 34, y },
      { x: x + 34, y: y + 30 },
      { x, y: y + 30 },
    ];
  }
  const cs = center(s);
  const ct = center(t);
  if (e.routing === "orthogonal" && !ROUND.has(s.type) && !ROUND.has(t.type)) {
    const overlapX = Math.min(s.x + s.w, t.x + t.w) - Math.max(s.x, t.x);
    const overlapY = Math.min(s.y + s.h, t.y + t.h) - Math.max(s.y, t.y);
    if (overlapX > 20) {
      // Una encima de otra: línea vertical recta
      const x = Math.max(s.x, t.x) + overlapX / 2;
      return ct.y > cs.y
        ? [
            { x, y: s.y + s.h },
            { x, y: t.y },
          ]
        : [
            { x, y: s.y },
            { x, y: t.y + t.h },
          ];
    }
    if (overlapY > 20) {
      const y = Math.max(s.y, t.y) + overlapY / 2;
      return ct.x > cs.x
        ? [
            { x: s.x + s.w, y },
            { x: t.x, y },
          ]
        : [
            { x: s.x, y },
            { x: t.x + t.w, y },
          ];
    }
    const vertical = Math.abs(ct.y - cs.y) > Math.abs(ct.x - cs.x);
    if (vertical) {
      const sy = ct.y > cs.y ? s.y + s.h : s.y;
      const ty = ct.y > cs.y ? t.y : t.y + t.h;
      const my = (sy + ty) / 2;
      return [
        { x: cs.x, y: sy },
        { x: cs.x, y: my },
        { x: ct.x, y: my },
        { x: ct.x, y: ty },
      ];
    }
    const sx = ct.x > cs.x ? s.x + s.w : s.x;
    const tx = ct.x > cs.x ? t.x : t.x + t.w;
    const mx = (sx + tx) / 2;
    return [
      { x: sx, y: cs.y },
      { x: mx, y: cs.y },
      { x: mx, y: ct.y },
      { x: tx, y: ct.y },
    ];
  }
  return [boundary(s, ct), boundary(t, cs)];
}

export function pointsToPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** Punto a mitad de recorrido (para la etiqueta central). */
export function midpoint(pts: Pt[]): Pt {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (half <= seg && seg > 0) {
      const t = half / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    half -= seg;
  }
  return pts[0] || { x: 0, y: 0 };
}

/** Distancia de un punto a una polilínea (para seleccionar conexiones). */
export function distanceToPath(p: Pt, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))));
  }
  return best;
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function wrap(text: string, width: number, size = 13, weight = 400): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const cand = line ? `${line} ${word}` : word;
      if (line && textWidth(cand, size, weight) > width) {
        out.push(line);
        line = word;
      } else line = cand;
    }
    out.push(line);
  }
  return out;
}

const T: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; weight?: number; anchor?: "start" | "middle" | "end"; italic?: boolean; underline?: boolean; color?: string; mono?: boolean }> = ({
  x,
  y,
  children,
  size = 13,
  weight = 400,
  anchor = "start",
  italic,
  underline,
  color = "#1b2733",
  mono,
}) => (
  <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor} fontStyle={italic ? "italic" : undefined} textDecoration={underline ? "underline" : undefined} fill={color} fontFamily={mono ? MONO : FONT} dominantBaseline="middle">
    {children}
  </text>
);

function CenteredLines({ n, lines, size = 13, weight = 500, dy = 0 }: { n: DNode; lines: string[]; size?: number; weight?: number; dy?: number }) {
  const lh = size * 1.3;
  const top = n.h / 2 - ((lines.length - 1) * lh) / 2 + dy;
  return (
    <>
      {lines.map((l, i) => (
        <T key={i} x={n.w / 2} y={top + i * lh} anchor="middle" size={size} weight={weight} color={n.textColor}>
          {l}
        </T>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Figuras
// ---------------------------------------------------------------------------

function ClassShape({ n }: { n: DNode }) {
  const c = compartments(n);
  const sw = 1.4;
  const lines: React.ReactNode[] = [];
  let y = c.header + PAD / 2 + LINE / 2;
  const attrs = n.type === "enum" ? n.literals.map((l) => ({ text: l, m: null })) : n.attributes.map((m) => ({ text: memberText(m, "attr", n), m }));
  for (const [i, a] of attrs.entries()) {
    lines.push(
      <T key={`a${i}`} x={10} y={y} size={12.5} underline={!!a.m?.isStatic} color={n.textColor}>
        {a.text}
      </T>
    );
    y += LINE;
  }
  y = c.header + c.attrH + PAD / 2 + LINE / 2;
  if (n.type === "class" || n.type === "interface")
    for (const [i, m] of n.operations.entries()) {
      lines.push(
        <T key={`o${i}`} x={10} y={y} size={12.5} italic={m.isAbstract || n.type === "interface"} underline={m.isStatic} color={n.textColor}>
          {memberText(m, "op", n)}
        </T>
      );
      y += LINE;
    }
  return (
    <>
      <rect width={n.w} height={n.h} fill={n.fill} stroke={n.stroke} strokeWidth={sw} rx={2} />
      <rect width={n.w} height={c.header} fill={n.type === "interface" ? "#e3f3e8" : n.type === "enum" ? "#efe5fb" : "#fdf3d0"} stroke={n.stroke} strokeWidth={sw} rx={2} />
      {c.stereo > 0 && (
        <T x={n.w / 2} y={13} anchor="middle" size={11} color="#5b6b7b">
          «{n.stereotype}»
        </T>
      )}
      <T x={n.w / 2} y={c.header / 2 + (c.stereo ? 7 : 0)} anchor="middle" size={14} weight={700} italic={n.isAbstract} underline={n.type === "object"} color={n.textColor}>
        {n.name}
      </T>
      {(n.type === "class" || n.type === "interface") && <line x1={0} x2={n.w} y1={c.header + c.attrH} y2={c.header + c.attrH} stroke={n.stroke} strokeWidth={sw} />}
      {lines}
    </>
  );
}

function EntityShape({ n }: { n: DNode }) {
  const c = compartments(n);
  return (
    <>
      <rect width={n.w} height={n.h} fill={n.fill} stroke={n.stroke} strokeWidth={1.4} rx={6} />
      <path d={`M0 6 Q0 0 6 0 H${n.w - 6} Q${n.w} 0 ${n.w} 6 V${c.header} H0 Z`} fill="#1e3a5f" />
      <T x={n.w / 2} y={c.header / 2} anchor="middle" size={14} weight={700} color="#ffffff">
        {n.name}
      </T>
      {n.attributes.map((m, i) => {
        const y = c.header + PAD / 2 + LINE / 2 + i * LINE;
        return (
          <g key={m.id}>
            {i > 0 && <line x1={8} x2={n.w - 8} y1={y - LINE / 2} y2={y - LINE / 2} stroke="#eef1f5" />}
            {(m.pk || m.fk) && (
              <T x={10} y={y} size={10} weight={700} color={m.pk ? "#b7791f" : "#2f80ed"} mono>
                {m.pk ? "PK" : "FK"}
              </T>
            )}
            {m.pk && m.fk && (
              <T x={28} y={y} size={10} weight={700} color="#2f80ed" mono>
                FK
              </T>
            )}
            <T x={m.pk && m.fk ? 50 : 34} y={y} size={12.5} weight={m.pk ? 700 : 400} underline={m.pk} color={n.textColor}>
              {m.name}
            </T>
            <T x={n.w - 10} y={y} anchor="end" size={11.5} color="#6b7b8b" mono>
              {m.type}
              {!m.nullable && !m.pk ? " NN" : ""}
              {m.unique ? " UQ" : ""}
            </T>
          </g>
        );
      })}
    </>
  );
}

function StateShape({ n }: { n: DNode }) {
  const c = compartments(n);
  const compact = !n.attributes.length;
  return (
    <>
      <rect width={n.w} height={n.h} rx={14} fill={n.fill} stroke={n.stroke} strokeWidth={1.4} />
      {compact && !n.autoSize && n.h > 90 ? (
        <>
          <T x={12} y={16} weight={700} color={n.textColor}>
            {n.name}
          </T>
          <line x1={0} x2={n.w} y1={30} y2={30} stroke={n.stroke} />
        </>
      ) : compact ? (
        <CenteredLines n={n} lines={[n.name]} weight={700} />
      ) : (
        <>
          <T x={n.w / 2} y={c.header / 2 + 2} anchor="middle" weight={700} color={n.textColor}>
            {n.name}
          </T>
          <line x1={0} x2={n.w} y1={c.header} y2={c.header} stroke={n.stroke} />
          {n.attributes.map((m, i) => (
            <T key={m.id} x={10} y={c.header + PAD / 2 + LINE / 2 + i * LINE} size={12} color={n.textColor}>
              {m.name}
            </T>
          ))}
        </>
      )}
    </>
  );
}

function StickFigure({ w, color, top = 0 }: { w: number; color: string; top?: number }) {
  const cx = w / 2;
  return (
    <g stroke={color} strokeWidth={2} fill="#ffffff" strokeLinecap="round">
      <circle cx={cx} cy={top + 11} r={10} />
      <line x1={cx} y1={top + 21} x2={cx} y2={top + 46} />
      <line x1={cx - 16} y1={top + 30} x2={cx + 16} y2={top + 30} />
      <line x1={cx} y1={top + 46} x2={cx - 13} y2={top + 64} />
      <line x1={cx} y1={top + 46} x2={cx + 13} y2={top + 64} />
    </g>
  );
}

export function NodeShape({ n }: { n: DNode }) {
  const sw = 1.4;
  const s = n.stroke;
  const f = n.fill;
  const name = (dy = 0, weight = 600) => <CenteredLines n={n} lines={wrap(n.name, n.w - 16, 13, weight)} weight={weight} dy={dy} />;
  switch (n.type) {
    case "class":
    case "interface":
    case "enum":
    case "object":
      return <ClassShape n={n} />;
    case "entity":
      return <EntityShape n={n} />;
    case "state":
      return <StateShape n={n} />;
    case "package": {
      const tabW = Math.min(n.w * 0.5, Math.max(70, textWidth(n.name, 12, 700) + 20));
      return (
        <>
          <path d={`M0 0 H${tabW} V20 H${n.w} V${n.h} H0 Z`} fill={f} stroke={s} strokeWidth={sw} />
          <line x1={0} x2={tabW} y1={20} y2={20} stroke={s} strokeWidth={sw} />
          <T x={10} y={11} size={12} weight={700} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    }
    case "note":
      return (
        <>
          <path d={`M0 0 H${n.w - 14} L${n.w} 14 V${n.h} H0 Z`} fill={f} stroke="#b8a24a" strokeWidth={1.2} />
          <path d={`M${n.w - 14} 0 V14 H${n.w}`} fill="none" stroke="#b8a24a" strokeWidth={1.2} />
          {wrap(n.text || n.name, n.w - 20, 12.5).map((l, i) => (
            <T key={i} x={10} y={16 + i * 17} size={12.5} color="#4a4426">
              {l}
            </T>
          ))}
        </>
      );
    case "text":
      return (
        <>
          <rect width={n.w} height={n.h} fill="transparent" />
          {wrap(n.name, n.w, 14).map((l, i) => (
            <T key={i} x={0} y={12 + i * 18} size={14} color={n.textColor}>
              {l}
            </T>
          ))}
        </>
      );
    case "actor":
      return (
        <>
          <rect width={n.w} height={n.h} fill="transparent" />
          <StickFigure w={n.w} color={s} />
          <T x={n.w / 2} y={n.h - 8} anchor="middle" size={13} weight={600} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "usecase":
      return (
        <>
          <ellipse cx={n.w / 2} cy={n.h / 2} rx={n.w / 2} ry={n.h / 2} fill={f} stroke={s} strokeWidth={sw} />
          {name()}
        </>
      );
    case "system":
      return (
        <>
          <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />
          <T x={n.w / 2} y={18} anchor="middle" size={14} weight={700} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "lifeline":
    case "actorLifeline": {
      const head = n.type === "actorLifeline" ? 86 : 42;
      return (
        <>
          <rect width={n.w} height={n.h} fill="transparent" />
          <line x1={n.w / 2} x2={n.w / 2} y1={head} y2={n.h} stroke={s} strokeWidth={1.3} strokeDasharray="6 5" />
          {n.type === "lifeline" ? (
            <>
              <rect width={n.w} height={head} rx={3} fill={f} stroke={s} strokeWidth={sw} />
              <T x={n.w / 2} y={head / 2} anchor="middle" weight={700} underline={n.name.includes(":")} color={n.textColor}>
                {n.name}
              </T>
            </>
          ) : (
            <>
              <StickFigure w={n.w} color={s} />
              <T x={n.w / 2} y={76} anchor="middle" weight={700} color={n.textColor}>
                {n.name}
              </T>
            </>
          )}
        </>
      );
    }
    case "activation":
      return <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />;
    case "fragment": {
      const label = (n.operator || "alt").toUpperCase() === n.operator ? n.operator : n.operator || "alt";
      const lw = Math.max(46, textWidth(label || "", 12, 700) + 22);
      return (
        <>
          <rect width={n.w} height={n.h} fill="rgba(47,128,237,0.03)" stroke={s} strokeWidth={sw} />
          <path d={`M0 0 H${lw} V14 L${lw - 10} 24 H0 Z`} fill="#e7eef7" stroke={s} strokeWidth={sw} />
          <T x={8} y={12} size={12} weight={700} color={n.textColor}>
            {label}
          </T>
          <T x={lw + 10} y={12} size={12} color="#5b6b7b">
            {n.text}
          </T>
        </>
      );
    }
    case "initial":
      return <circle cx={n.w / 2} cy={n.h / 2} r={Math.min(n.w, n.h) / 2} fill={f} />;
    case "final":
      return (
        <>
          <circle cx={n.w / 2} cy={n.h / 2} r={Math.min(n.w, n.h) / 2 - 1} fill="#ffffff" stroke={f} strokeWidth={2} />
          <circle cx={n.w / 2} cy={n.h / 2} r={Math.min(n.w, n.h) / 2 - 6} fill={f} />
        </>
      );
    case "flowFinal": {
      const r = Math.min(n.w, n.h) / 2 - 1;
      const k = r * 0.7;
      return (
        <>
          <circle cx={n.w / 2} cy={n.h / 2} r={r} fill={f} stroke={s} strokeWidth={1.6} />
          <path d={`M${n.w / 2 - k} ${n.h / 2 - k} L${n.w / 2 + k} ${n.h / 2 + k} M${n.w / 2 + k} ${n.h / 2 - k} L${n.w / 2 - k} ${n.h / 2 + k}`} stroke={s} strokeWidth={1.6} />
        </>
      );
    }
    case "action":
      return (
        <>
          <rect width={n.w} height={n.h} rx={14} fill={f} stroke={s} strokeWidth={sw} />
          {name()}
        </>
      );
    case "decision":
    case "choice":
    case "erRelationship":
      return (
        <>
          <path d={`M${n.w / 2} 0 L${n.w} ${n.h / 2} L${n.w / 2} ${n.h} L0 ${n.h / 2} Z`} fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
          {n.name && <CenteredLines n={n} lines={wrap(n.name, n.w * 0.6, 12.5, 600)} size={12.5} weight={600} />}
        </>
      );
    case "fork":
      return <rect width={n.w} height={n.h} rx={2} fill={f} />;
    case "objectNode":
    case "process":
      return (
        <>
          <rect width={n.w} height={n.h} rx={n.type === "process" ? 4 : 0} fill={f} stroke={s} strokeWidth={sw} />
          {name(0, n.type === "objectNode" ? 500 : 600)}
          {n.type === "objectNode" && <line x1={n.w / 2 - textWidth(n.name, 13, 500) / 2} x2={n.w / 2 + textWidth(n.name, 13, 500) / 2} y1={n.h / 2 + 9} y2={n.h / 2 + 9} stroke={n.textColor} />}
        </>
      );
    case "swimlane":
      return n.horizontal ? (
        <>
          <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />
          <rect width={32} height={n.h} fill="#e7eef7" stroke={s} strokeWidth={sw} />
          <text x={16} y={n.h / 2} fontSize={13} fontWeight={700} fill={n.textColor} fontFamily={FONT} textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 16 ${n.h / 2})`}>
            {n.name}
          </text>
        </>
      ) : (
        <>
          <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />
          <rect width={n.w} height={32} fill="#e7eef7" stroke={s} strokeWidth={sw} />
          <T x={n.w / 2} y={16} anchor="middle" weight={700} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "sendSignal":
      return (
        <>
          <path d={`M0 0 H${n.w - 20} L${n.w} ${n.h / 2} L${n.w - 20} ${n.h} H0 Z`} fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
          {name(0)}
        </>
      );
    case "receiveSignal":
      return (
        <>
          <path d={`M0 0 H${n.w} V${n.h} H0 L20 ${n.h / 2} Z`} fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
          {name(0)}
        </>
      );
    case "history":
      return (
        <>
          <circle cx={n.w / 2} cy={n.h / 2} r={Math.min(n.w, n.h) / 2 - 1} fill={f} stroke={s} strokeWidth={sw} />
          <T x={n.w / 2} y={n.h / 2 + 1} anchor="middle" weight={700} color={n.textColor}>
            {n.name || "H"}
          </T>
        </>
      );
    case "component":
      return (
        <>
          <rect width={n.w} height={n.h} rx={3} fill={f} stroke={s} strokeWidth={sw} />
          <g transform={`translate(${n.w - 28} 8)`} fill="#ffffff" stroke={s} strokeWidth={1.2}>
            <rect x={4} y={0} width={16} height={20} />
            <rect x={0} y={4} width={8} height={4} />
            <rect x={0} y={12} width={8} height={4} />
          </g>
          {n.stereotype && (
            <T x={n.w / 2} y={n.h / 2 - 9} anchor="middle" size={11} color="#5b6b7b">
              «{n.stereotype}»
            </T>
          )}
          <T x={n.w / 2} y={n.h / 2 + (n.stereotype ? 8 : 0)} anchor="middle" weight={700} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "providedInterface":
      return (
        <>
          <circle cx={n.w / 2} cy={n.h / 2} r={Math.min(n.w, n.h) / 2 - 1} fill={f} stroke={s} strokeWidth={1.6} />
          <T x={n.w / 2} y={n.h + 12} anchor="middle" size={12} weight={600} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "node":
    case "device": {
      const d = 14;
      return (
        <>
          <path d={`M0 ${d} L${d} 0 H${n.w} V${n.h - d} L${n.w - d} ${n.h} H0 Z`} fill="#dfe8f2" stroke={s} strokeWidth={sw} strokeLinejoin="round" />
          <rect x={0} y={d} width={n.w - d} height={n.h - d} fill={f} stroke={s} strokeWidth={sw} />
          <path d={`M${n.w - d} ${d} L${n.w} 0`} stroke={s} strokeWidth={sw} />
          {n.stereotype && (
            <T x={(n.w - d) / 2} y={d + 16} anchor="middle" size={11} color="#5b6b7b">
              «{n.stereotype}»
            </T>
          )}
          <T x={(n.w - d) / 2} y={d + (n.stereotype ? 34 : (n.h - d) / 2)} anchor="middle" weight={700} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    }
    case "artifact":
      return (
        <>
          <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />
          <path d={`M${n.w - 22} 6 H${n.w - 12} L${n.w - 8} 10 V24 H${n.w - 22} Z M${n.w - 12} 6 V10 H${n.w - 8}`} fill="#ffffff" stroke={s} strokeWidth={1} />
          <T x={n.w / 2} y={n.h / 2 - 8} anchor="middle" size={11} color="#5b6b7b">
            «{n.stereotype || "artifact"}»
          </T>
          <T x={n.w / 2} y={n.h / 2 + 9} anchor="middle" weight={700} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "erEntity":
    case "erWeakEntity":
      return (
        <>
          <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />
          {n.type === "erWeakEntity" && <rect x={4} y={4} width={n.w - 8} height={n.h - 8} fill="none" stroke={s} strokeWidth={sw} />}
          {name(0, 700)}
        </>
      );
    case "erAttribute":
      return (
        <>
          <ellipse cx={n.w / 2} cy={n.h / 2} rx={n.w / 2} ry={n.h / 2} fill={f} stroke={s} strokeWidth={sw} />
          <T x={n.w / 2} y={n.h / 2} anchor="middle" size={12.5} underline={n.isAbstract} weight={n.isAbstract ? 700 : 500} color={n.textColor}>
            {n.name}
          </T>
        </>
      );
    case "terminator":
    case "topic":
      return (
        <>
          <rect width={n.w} height={n.h} rx={n.h / 2} fill={f} stroke={s} strokeWidth={n.type === "topic" ? 2 : sw} />
          {name(0, 700)}
        </>
      );
    case "subtopic":
      return (
        <>
          <rect width={n.w} height={n.h} rx={10} fill={f} stroke="#64a0d8" strokeWidth={1.4} />
          {name(0, 600)}
        </>
      );
    case "io":
      return (
        <>
          <path d={`M18 0 H${n.w} L${n.w - 18} ${n.h} H0 Z`} fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
          {name()}
        </>
      );
    case "document":
      return (
        <>
          <path d={`M0 0 H${n.w} V${n.h - 12} C${n.w * 0.75} ${n.h - 26} ${n.w * 0.25} ${n.h + 4} 0 ${n.h - 10} Z`} fill={f} stroke={s} strokeWidth={sw} />
          {name(-6)}
        </>
      );
    case "database": {
      const ry = Math.min(14, n.h / 6);
      return (
        <>
          <path d={`M0 ${ry} V${n.h - ry} A${n.w / 2} ${ry} 0 0 0 ${n.w} ${n.h - ry} V${ry}`} fill={f} stroke={s} strokeWidth={sw} />
          <ellipse cx={n.w / 2} cy={ry} rx={n.w / 2} ry={ry} fill={f} stroke={s} strokeWidth={sw} />
          {name(ry / 2)}
        </>
      );
    }
    case "subprocess":
      return (
        <>
          <rect width={n.w} height={n.h} fill={f} stroke={s} strokeWidth={sw} />
          <line x1={10} x2={10} y1={0} y2={n.h} stroke={s} strokeWidth={sw} />
          <line x1={n.w - 10} x2={n.w - 10} y1={0} y2={n.h} stroke={s} strokeWidth={sw} />
          {name()}
        </>
      );
    case "connector":
      return (
        <>
          <circle cx={n.w / 2} cy={n.h / 2} r={Math.min(n.w, n.h) / 2 - 1} fill={f} stroke={s} strokeWidth={sw} />
          {name(0, 700)}
        </>
      );
  }
  return <rect width={n.w} height={n.h} fill={f} stroke={s} />;
}

// ---------------------------------------------------------------------------
// Conexiones
// ---------------------------------------------------------------------------

const DASHED = new Set(["realization", "dependency", "include", "extend", "reply", "anchor", "createMessage"]);

function endMarker(kind: string, tip: Pt, from: Pt, color: string, key: string, atSource: boolean): React.ReactNode {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const rot = (dx: number, dy: number) => ({ x: tip.x + dx * Math.cos(a) - dy * Math.sin(a), y: tip.y + dx * Math.sin(a) + dy * Math.cos(a) });
  const poly = (pts: [number, number][]) => pts.map(([x, y]) => rot(x, y)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  if (atSource) {
    if (kind === "aggregation" || kind === "composition") return <polygon key={key} points={poly([[0, 0], [-10, -6], [-20, 0], [-10, 6]])} fill={kind === "composition" ? color : "#ffffff"} stroke={color} strokeWidth={1.3} />;
    return null;
  }
  switch (kind) {
    case "generalization":
    case "realization":
      return <polygon key={key} points={poly([[0, 0], [-15, -8], [-15, 8]])} fill="#ffffff" stroke={color} strokeWidth={1.3} />;
    case "message":
    case "flow":
      return <polygon key={key} points={poly([[0, 0], [-11, -5.5], [-11, 5.5]])} fill={color} stroke={color} strokeWidth={1} />;
    case "directed":
    case "dependency":
    case "include":
    case "extend":
    case "asyncMessage":
    case "reply":
    case "createMessage":
      return <polyline key={key} points={poly([[-11, -6], [0, 0], [-11, 6]])} fill="none" stroke={color} strokeWidth={1.4} />;
  }
  return null;
}

/** Notación de pata de gallo en un extremo (tip: punto sobre la figura). */
function crowFoot(card: Cardinality, tip: Pt, from: Pt, color: string, key: string): React.ReactNode {
  if (!card) return null;
  const a = Math.atan2(from.y - tip.y, from.x - tip.x);
  const p = (d: number, off: number) => ({ x: tip.x + d * Math.cos(a) - off * Math.sin(a), y: tip.y + d * Math.sin(a) + off * Math.cos(a) });
  const line = (p0: Pt, p1: Pt, k: string) => <line key={k} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={1.4} />;
  const out: React.ReactNode[] = [];
  const many = card.endsWith("*");
  const optional = card.startsWith("0");
  if (many) {
    out.push(line(p(14, 0), p(0, -8), "c1"), line(p(14, 0), p(0, 8), "c2"), line(p(14, 0), p(0, 0), "c3"));
  } else out.push(line(p(8, -7), p(8, 7), "b1"));
  if (optional) {
    const c = p(many ? 21 : 16, 0);
    out.push(<circle key="o" cx={c.x} cy={c.y} r={4.5} fill="#ffffff" stroke={color} strokeWidth={1.4} />);
  } else out.push(line(p(many ? 18 : 13, -7), p(many ? 18 : 13, 7), "b2"));
  return <g key={key}>{out}</g>;
}

export function EdgeShape({ d, e, selected }: { d: Diagram; e: DEdge; selected?: boolean }) {
  const pts = edgePoints(d, e);
  if (pts.length < 2) return null;
  const color = selected ? "#2f80ed" : e.color;
  const path = pointsToPath(pts);
  const mid = midpoint(pts);
  const first = pts[0];
  const second = pts[1];
  const last = pts[pts.length - 1];
  const before = pts[pts.length - 2];
  const label = (p: Pt, ref: Pt, text: string, k: string, alignEnd = false) => {
    if (!text) return null;
    const a = Math.atan2(ref.y - p.y, ref.x - p.x);
    // Se coloca junto al extremo, desplazado a un lado de la línea
    const x = p.x + Math.cos(a) * 18 - Math.sin(a) * 12;
    const y = p.y + Math.sin(a) * 18 + Math.cos(a) * 12;
    return (
      <text key={k} x={x} y={y} fontSize={11.5} fill="#33475b" fontFamily={FONT} textAnchor={alignEnd ? "end" : "middle"} dominantBaseline="middle">
        {text}
      </text>
    );
  };
  const midLabel = e.label || (e.kind === "erRelation" ? "" : "");
  return (
    <g data-edge={e.id}>
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
      <path d={path} fill="none" stroke={color} strokeWidth={selected ? 2 : 1.4} strokeDasharray={DASHED.has(e.kind) ? "6 4" : undefined} strokeLinejoin="round" />
      {endMarker(e.kind, last, before, color, "t", false)}
      {endMarker(e.kind, first, second, color, "s", true)}
      {e.kind === "erRelation" && crowFoot(e.sourceCard, first, second, color, "cs")}
      {e.kind === "erRelation" && crowFoot(e.targetCard, last, before, color, "ct")}
      {midLabel && (
        <g>
          <rect x={mid.x - textWidth(midLabel, 12) / 2 - 4} y={mid.y - 19} width={textWidth(midLabel, 12) + 8} height={16} rx={3} fill="#ffffff" opacity={0.85} />
          <text x={mid.x} y={mid.y - 11} fontSize={12} fill={color} fontFamily={FONT} textAnchor="middle" dominantBaseline="middle" fontStyle={e.kind === "include" || e.kind === "extend" ? "italic" : undefined}>
            {midLabel}
          </text>
        </g>
      )}
      {label(first, second, e.sourceLabel, "sl")}
      {label(last, before, e.targetLabel, "tl")}
    </g>
  );
}

/** Dibuja el diagrama completo (figuras y conexiones). */
export function DiagramSvgContent({ d, selection, hidden }: { d: Diagram; selection?: Set<string>; hidden?: Set<string> }) {
  const containers = d.order.filter((id) => ["system", "swimlane", "package", "fragment"].includes(d.nodes[id]?.type));
  const rest = d.order.filter((id) => !containers.includes(id));
  const drawNode = (id: string) => {
    const n = d.nodes[id];
    if (!n || hidden?.has(id)) return null;
    return (
      <g key={id} data-node={id} transform={`translate(${n.x} ${n.y})`}>
        <NodeShape n={n} />
      </g>
    );
  };
  return (
    <>
      {containers.map(drawNode)}
      {/* Las líneas de vida van debajo de los mensajes */}
      {rest.filter((id) => LIFELINES.has(d.nodes[id]?.type)).map(drawNode)}
      {Object.values(d.edges).map((e) => (
        <EdgeShape key={e.id} d={d} e={e} selected={selection?.has(e.id)} />
      ))}
      {rest.filter((id) => !LIFELINES.has(d.nodes[id]?.type)).map(drawNode)}
    </>
  );
}
