// Dibujo de los nodos como SVG. El mismo código pinta el lienzo y genera
// las exportaciones (SVG, PNG y PDF), así lo que se ve es lo que se exporta.

import React from "react";
import type { Page, Paint, UNode, UxDocument } from "../types";
import { findComponent, wrapText } from "./model";

export interface RenderContext {
  doc: UxDocument;
  page: Page;
  /** Prefijo de los identificadores de <defs> (para que no choquen). */
  prefix: string;
  /** Nodos que no se dibujan (por ejemplo, el texto que se está editando). */
  hidden?: Set<string>;
  /** Cambios de una instancia sobre los hijos de su componente. */
  overrides?: UNode["overrides"];
  /** Marca los elementos con data-node-id (para el lienzo). */
  interactive?: boolean;
  /** Identificador al que pertenecen los elementos (las instancias se seleccionan enteras). */
  owner?: string;
  depth?: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function paintDef(paint: Paint, id: string): React.ReactNode {
  if (paint.type === "linear") {
    const a = rad(paint.angle - 90);
    const x = Math.cos(a) / 2;
    const y = Math.sin(a) / 2;
    return (
      <linearGradient key={id} id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
        <stop offset="0" stopColor={paint.color} stopOpacity={paint.opacity} />
        <stop offset="1" stopColor={paint.color2} stopOpacity={paint.opacity} />
      </linearGradient>
    );
  }
  if (paint.type === "radial") {
    return (
      <radialGradient key={id} id={id} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={paint.color} stopOpacity={paint.opacity} />
        <stop offset="1" stopColor={paint.color2} stopOpacity={paint.opacity} />
      </radialGradient>
    );
  }
  return null;
}

/** Atributos de relleno (y la definición del degradado, si la hay). */
function fillProps(paint: Paint | null, id: string): { props: Record<string, string | number>; def: React.ReactNode } {
  if (!paint) return { props: { fill: "none" }, def: null };
  if (paint.type === "solid") return { props: { fill: paint.color, fillOpacity: paint.opacity }, def: null };
  return { props: { fill: `url(#${id})` }, def: paintDef(paint, id) };
}

function strokeProps(n: UNode): Record<string, string | number> {
  if (!n.stroke || n.stroke.width <= 0) return {};
  return {
    stroke: n.stroke.color,
    strokeOpacity: n.stroke.opacity,
    strokeWidth: n.stroke.width,
    ...(n.stroke.dash ? { strokeDasharray: `${n.stroke.width * 3} ${n.stroke.width * 2}` } : {}),
  };
}

function filterDef(n: UNode, id: string): React.ReactNode {
  if (!n.shadow && !n.blur) return null;
  const s = n.shadow;
  return (
    <filter key={id} id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
      {s && !s.inner && <feDropShadow dx={s.x} dy={s.y} stdDeviation={s.blur / 2} floodColor={s.color} floodOpacity={s.opacity} />}
      {s && s.inner && (
        <>
          <feFlood floodColor={s.color} floodOpacity={s.opacity} result="flood" />
          <feComposite in="flood" in2="SourceAlpha" operator="out" result="inverse" />
          <feOffset dx={s.x} dy={s.y} in="inverse" result="offset" />
          <feGaussianBlur stdDeviation={s.blur / 2} in="offset" result="blurred" />
          <feComposite operator="in" in="blurred" in2="SourceAlpha" result="shadow" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shadow" />
          </feMerge>
        </>
      )}
      {n.blur > 0 && <feGaussianBlur stdDeviation={n.blur / 2} />}
    </filter>
  );
}

export function polygonPoints(n: UNode): string {
  const sides = Math.max(3, n.sides || 3);
  const pts: string[] = [];
  const count = n.type === "star" ? sides * 2 : sides;
  for (let i = 0; i < count; i++) {
    const a = rad(-90 + (360 * i) / count);
    const r = n.type === "star" && i % 2 === 1 ? n.innerRatio ?? 0.45 : 1;
    pts.push(`${(n.w / 2 + (n.w / 2) * r * Math.cos(a)).toFixed(2)},${(n.h / 2 + (n.h / 2) * r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function pathData(n: UNode): string {
  const pts = n.points || [];
  if (!pts.length) return "";
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${(px * n.w).toFixed(2)} ${(py * n.h).toFixed(2)}`).join(" ");
  return n.closed ? `${d} Z` : d;
}

function textNode(n: UNode, ctx: RenderContext, fillId: string): { el: React.ReactNode; def: React.ReactNode } {
  const font = n.font!;
  const text = ctx.overrides?.[n.id]?.text ?? n.text ?? "";
  const lines = wrapText(text, font, font.autoSize === "width" ? null : n.w);
  const lineH = font.size * font.lineHeight;
  const total = lines.length * lineH;
  const top = font.valign === "middle" ? (n.h - total) / 2 : font.valign === "bottom" ? n.h - total : 0;
  const x = font.align === "center" ? n.w / 2 : font.align === "right" ? n.w : 0;
  const anchor = font.align === "center" ? "middle" : font.align === "right" ? "end" : "start";
  const paint = ctx.overrides?.[n.id]?.fill !== undefined ? ctx.overrides[n.id].fill! : n.fill;
  const { props, def } = fillProps(paint, fillId);
  const decoration = [font.underline && "underline", font.strike && "line-through"].filter(Boolean).join(" ") || undefined;
  return {
    def,
    el: (
      <text
        x={x}
        fontFamily={`'${font.family}', 'Segoe UI', sans-serif`}
        fontSize={font.size}
        fontWeight={font.weight}
        fontStyle={font.italic ? "italic" : undefined}
        letterSpacing={font.letterSpacing || undefined}
        textDecoration={decoration}
        textAnchor={anchor}
        xmlSpace="preserve"
        {...props}
        {...strokeProps(n)}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} y={top + i * lineH + (lineH - font.size) / 2 + font.size * 0.82}>
            {line || " "}
          </tspan>
        ))}
      </text>
    ),
  };
}

/** Dibuja un nodo (y sus hijos) en coordenadas de su padre. */
export function renderNode(id: string, ctx: RenderContext): React.ReactNode {
  const n = ctx.page.nodes[id];
  if (!n || ctx.hidden?.has(id)) return null;
  const visible = ctx.overrides?.[id]?.visible ?? n.visible;
  if (!visible) return null;
  const key = `${ctx.prefix}${id}`;
  const fillId = `${key}-p`;
  const filterId = `${key}-f`;
  const clipId = `${key}-c`;
  const defs: React.ReactNode[] = [];
  const filter = filterDef(n, filterId);
  if (filter) defs.push(filter);
  const paint = ctx.overrides?.[id]?.fill !== undefined ? ctx.overrides[id].fill! : n.fill;
  const owner = ctx.owner ?? id;
  let body: React.ReactNode = null;

  switch (n.type) {
    case "frame":
    case "component":
    case "group": {
      const { props, def } = fillProps(paint, fillId);
      if (def) defs.push(def);
      const clip = (n.type !== "group" && n.clip) || false;
      if (clip) defs.push(
        <clipPath key={clipId} id={clipId}>
          <rect width={n.w} height={n.h} rx={n.radius} />
        </clipPath>
      );
      const childCtx = { ...ctx, depth: (ctx.depth || 0) + 1 };
      body = (
        <>
          {n.type !== "group" && <rect width={n.w} height={n.h} rx={n.radius} {...props} {...strokeProps(n)} />}
          <g clipPath={clip ? `url(#${clipId})` : undefined}>{(n.children || []).map((c) => <React.Fragment key={c}>{renderNode(c, childCtx)}</React.Fragment>)}</g>
        </>
      );
      break;
    }
    case "instance": {
      const found = n.componentId ? findComponent(ctx.doc, n.componentId) : null;
      if (!found) {
        body = (
          <>
            <rect width={n.w} height={n.h} fill="#fdecea" stroke="#d93025" strokeDasharray="4 3" />
            <text x={6} y={16} fontSize={11} fill="#d93025" fontFamily="sans-serif">
              Componente no encontrado
            </text>
          </>
        );
        break;
      }
      const comp = found.node;
      const { props, def } = fillProps(n.fill ?? comp.fill, fillId);
      if (def) defs.push(def);
      defs.push(
        <clipPath key={clipId} id={clipId}>
          <rect width={n.w} height={n.h} rx={n.radius || comp.radius} />
        </clipPath>
      );
      const inner: RenderContext = { ...ctx, page: found.page, overrides: n.overrides, owner: ctx.owner ?? id, prefix: `${key}-`, depth: (ctx.depth || 0) + 1 };
      body = (
        <>
          <rect width={n.w} height={n.h} rx={n.radius || comp.radius} {...props} {...(n.stroke ? strokeProps(n) : strokeProps(comp))} />
          <g clipPath={comp.clip ? `url(#${clipId})` : undefined}>{(comp.children || []).map((c) => <React.Fragment key={c}>{renderNode(c, inner)}</React.Fragment>)}</g>
        </>
      );
      break;
    }
    case "rect": {
      const { props, def } = fillProps(paint, fillId);
      if (def) defs.push(def);
      body = <rect width={Math.max(0, n.w)} height={Math.max(0, n.h)} rx={n.radius} {...props} {...strokeProps(n)} />;
      break;
    }
    case "ellipse": {
      const { props, def } = fillProps(paint, fillId);
      if (def) defs.push(def);
      body = <ellipse cx={n.w / 2} cy={n.h / 2} rx={Math.max(0, n.w / 2)} ry={Math.max(0, n.h / 2)} {...props} {...strokeProps(n)} />;
      break;
    }
    case "polygon":
    case "star": {
      const { props, def } = fillProps(paint, fillId);
      if (def) defs.push(def);
      body = <polygon points={polygonPoints(n)} strokeLinejoin="round" {...props} {...strokeProps(n)} />;
      break;
    }
    case "line": {
      const color = n.stroke?.color || "#1e1e1e";
      const sw = n.stroke?.width || 1;
      const markerId = `${key}-m`;
      if (n.arrowEnd || n.arrowStart)
        defs.push(
          <marker key={markerId} id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={Math.max(4, 12 / Math.sqrt(sw))} markerHeight={Math.max(4, 12 / Math.sqrt(sw))} orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={color} />
          </marker>
        );
      body = (
        <>
          {/* Zona de clic más ancha que la línea */}
          {ctx.interactive && <line x1={0} y1={0} x2={n.w} y2={n.h} stroke="transparent" strokeWidth={Math.max(10, sw + 8)} />}
          <line
            x1={0}
            y1={0}
            x2={n.w}
            y2={n.h}
            strokeLinecap="round"
            {...strokeProps(n)}
            markerEnd={n.arrowEnd ? `url(#${markerId})` : undefined}
            markerStart={n.arrowStart ? `url(#${markerId})` : undefined}
          />
        </>
      );
      break;
    }
    case "path": {
      const { props, def } = fillProps(n.closed ? paint : null, fillId);
      if (def) defs.push(def);
      body = (
        <>
          {ctx.interactive && <path d={pathData(n)} fill="none" stroke="transparent" strokeWidth={Math.max(10, (n.stroke?.width || 1) + 8)} />}
          <path d={pathData(n)} strokeLinecap="round" strokeLinejoin="round" {...props} {...strokeProps(n)} />
        </>
      );
      break;
    }
    case "text": {
      const { el, def } = textNode(n, ctx, fillId);
      if (def) defs.push(def);
      body = (
        <>
          {ctx.interactive && <rect width={n.w} height={n.h} fill="transparent" />}
          {el}
        </>
      );
      break;
    }
    case "image": {
      if (n.radius > 0)
        defs.push(
          <clipPath key={clipId} id={clipId}>
            <rect width={n.w} height={n.h} rx={n.radius} />
          </clipPath>
        );
      const ratio = n.fit === "contain" ? "xMidYMid meet" : n.fit === "fill" ? "none" : "xMidYMid slice";
      body = n.src ? (
        <>
          <image href={n.src} width={n.w} height={n.h} preserveAspectRatio={ratio} clipPath={n.radius > 0 ? `url(#${clipId})` : undefined} />
          {n.stroke && <rect width={n.w} height={n.h} rx={n.radius} fill="none" {...strokeProps(n)} />}
        </>
      ) : (
        <>
          <rect width={n.w} height={n.h} rx={n.radius} fill="#e8e8e8" {...strokeProps(n)} />
          <path d={`M${n.w * 0.3} ${n.h * 0.68} L${n.w * 0.45} ${n.h * 0.45} L${n.w * 0.58} ${n.h * 0.6} L${n.w * 0.66} ${n.h * 0.52} L${n.w * 0.74} ${n.h * 0.68} Z`} fill="#bdbdbd" />
          <circle cx={n.w * 0.62} cy={n.h * 0.36} r={Math.min(n.w, n.h) * 0.06} fill="#bdbdbd" />
        </>
      );
      break;
    }
  }

  const transform = `translate(${n.x} ${n.y})${n.rotation ? ` rotate(${n.rotation} ${n.w / 2} ${n.h / 2})` : ""}`;
  return (
    <g
      transform={transform}
      opacity={n.opacity < 1 ? n.opacity : undefined}
      filter={filter ? `url(#${filterId})` : undefined}
      data-node-id={ctx.interactive ? owner : undefined}
      data-inner-id={ctx.interactive && ctx.owner ? id : undefined}
    >
      {defs.length > 0 && <defs>{defs}</defs>}
      {body}
    </g>
  );
}
