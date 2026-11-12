// SVG en CoffeeVector: dibujo de los objetos (en el lienzo y al exportar) e
// importación de archivos SVG (trazados con arcos, formas, texto, imágenes,
// grupos, transformaciones y degradados sencillos).

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Artboard, GroupObj, Paint, PathNode, PathObj, Pt, StrokeStyle, Subpath, TextObj, VDoc, VObject } from "../types";
import { pathD } from "./geom";
import { newId, solid } from "./model";

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

function gradientDef(id: string, p: Paint): React.ReactNode {
  if (p.type === "linear") {
    const a = (p.angle * Math.PI) / 180;
    const dx = Math.cos(a) / 2;
    const dy = Math.sin(a) / 2;
    return (
      <linearGradient key={id} id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
        {p.stops.map((s, i) => (
          <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
        ))}
      </linearGradient>
    );
  }
  if (p.type === "radial")
    return (
      <radialGradient key={id} id={id} cx={p.cx} cy={p.cy} r={p.r}>
        {p.stops.map((s, i) => (
          <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
        ))}
      </radialGradient>
    );
  return null;
}

const paintAttrs = (p: Paint | null, gid: string): { fill: string; fillOpacity?: number } =>
  !p ? { fill: "none" } : p.type === "solid" ? { fill: p.color, fillOpacity: p.opacity } : { fill: `url(#${gid})` };

const strokeAttrs = (s: StrokeStyle | null): React.SVGProps<SVGPathElement> =>
  s && s.width > 0
    ? { stroke: s.color, strokeOpacity: s.opacity, strokeWidth: s.width, strokeLinecap: s.cap, strokeLinejoin: s.join, strokeDasharray: s.dash.length ? s.dash.join(" ") : undefined }
    : { stroke: "none" };

const blendStyle = (o: VObject): React.CSSProperties | undefined => (o.blend && o.blend !== "normal" ? { mixBlendMode: o.blend as React.CSSProperties["mixBlendMode"] } : undefined);

export const ObjectSvg: React.FC<{ o: VObject; hit?: boolean; prefix?: string }> = ({ o, hit, prefix = "" }) => {
  if (!o.visible) return null;
  const gid = `${prefix}g-${o.id}`;
  const common = { "data-oid": hit ? o.id : undefined, opacity: o.opacity < 1 ? o.opacity : undefined, style: blendStyle(o) };
  switch (o.type) {
    case "path": {
      const d = pathD(o.subpaths);
      return (
        <g {...common}>
          {o.fill && o.fill.type !== "solid" && <defs>{gradientDef(gid, o.fill)}</defs>}
          <path d={d} {...paintAttrs(o.fill, gid)} fillRule={o.fillRule} {...strokeAttrs(o.stroke)} />
          {hit && <path d={d} fill="none" stroke="transparent" strokeWidth={10} style={{ pointerEvents: "stroke" }} vectorEffect="non-scaling-stroke" />}
        </g>
      );
    }
    case "text": {
      const lines = o.text.split("\n");
      return (
        <g {...common}>
          {o.fill && o.fill.type !== "solid" && <defs>{gradientDef(gid, o.fill)}</defs>}
          <text
            x={o.x}
            y={o.y}
            fontFamily={`'${o.font}', sans-serif`}
            fontSize={o.size}
            fontWeight={o.weight}
            fontStyle={o.italic ? "italic" : "normal"}
            textAnchor={o.align}
            letterSpacing={o.letterSpacing || undefined}
            transform={o.rotation ? `rotate(${o.rotation} ${o.x} ${o.y})` : undefined}
            {...paintAttrs(o.fill, gid)}
            {...(strokeAttrs(o.stroke) as unknown as React.SVGProps<SVGTextElement>)}
            style={{ whiteSpace: "pre", paintOrder: "stroke" }}
          >
            {lines.map((l, i) => (
              <tspan key={i} x={o.x} dy={i ? o.size * o.lineHeight : 0}>
                {l || " "}
              </tspan>
            ))}
          </text>
        </g>
      );
    }
    case "image":
      return (
        <g {...common}>
          <image href={o.href} x={o.x} y={o.y} width={o.w} height={o.h} preserveAspectRatio="none" transform={o.rotation ? `rotate(${o.rotation} ${o.x + o.w / 2} ${o.y + o.h / 2})` : undefined} />
        </g>
      );
    case "group": {
      if (o.clip && o.children.length) {
        const [mask, ...rest] = o.children;
        const cid = `${prefix}clip-${o.id}`;
        return (
          <g {...common}>
            <defs>
              <clipPath id={cid}>{mask.type === "path" ? <path d={pathD(mask.subpaths)} /> : <ObjectSvg o={mask} prefix={prefix} />}</clipPath>
            </defs>
            <g clipPath={`url(#${cid})`}>
              {rest.map((c) => (
                <ObjectSvg key={c.id} o={c} prefix={prefix} />
              ))}
            </g>
          </g>
        );
      }
      return (
        <g {...common}>
          {o.children.map((c) => (
            <ObjectSvg key={c.id} o={c} prefix={prefix} />
          ))}
        </g>
      );
    }
  }
};

/** SVG de una mesa de trabajo (o de todo el documento si `ab` es null). */
export function exportSvg(doc: VDoc, ab: Artboard | null, transparent = false): string {
  const box = ab || docBox(doc);
  const markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={box.w} height={box.h} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
      {ab?.background && !transparent && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={ab.background} />}
      {doc.objects.map((o) => (
        <ObjectSvg key={o.id} o={o} prefix="e" />
      ))}
    </svg>
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Creado con CoffeeVector -->\n${markup}`;
}

export function docBox(doc: VDoc) {
  const xs = doc.artboards.flatMap((a) => [a.x, a.x + a.w]);
  const ys = doc.artboards.flatMap((a) => [a.y, a.y + a.h]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// ---------------------------------------------------------------------------
// Importar SVG
// ---------------------------------------------------------------------------

type M = [number, number, number, number, number, number];
const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const apply = (m: M, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
const scaleOf = (m: M) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

function parseTransform(s: string | null): M {
  let m: M = ID;
  if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(s))) {
    const v = r[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let t: M = ID;
    switch (r[1]) {
      case "matrix":
        t = v.slice(0, 6) as M;
        break;
      case "translate":
        t = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
        break;
      case "scale":
        t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
        break;
      case "rotate": {
        const a = ((v[0] || 0) * Math.PI) / 180;
        const c = Math.cos(a);
        const sn = Math.sin(a);
        t = [c, sn, -sn, c, 0, 0];
        if (v.length > 2) t = mul(mul([1, 0, 0, 1, v[1], v[2]], t), [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case "skewX":
        t = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        t = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = mul(m, t);
  }
  return m;
}

/** Convierte un arco elíptico de SVG en curvas cúbicas. */
function arcToCubics(p0: Pt, rx: number, ry: number, phi: number, large: boolean, sweep: boolean, p: Pt): Array<[Pt, Pt, Pt]> {
  if (!rx || !ry) return [[p0, p, p]];
  const sinP = Math.sin((phi * Math.PI) / 180);
  const cosP = Math.cos((phi * Math.PI) / 180);
  const dx = (p0.x - p.x) / 2;
  const dy = (p0.y - p.y) / 2;
  const x1 = cosP * dx + sinP * dy;
  const y1 = -sinP * dx + cosP * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cx1 = (co * rx * y1) / ry;
  const cy1 = (-co * ry * x1) / rx;
  const cx = cosP * cx1 - sinP * cy1 + (p0.x + p.x) / 2;
  const cy = sinP * cx1 + cosP * cy1 + (p0.y + p.y) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  let t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= Math.PI * 2;
  if (sweep && dt < 0) dt += Math.PI * 2;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const out: Array<[Pt, Pt, Pt]> = [];
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (t: number) => ({ x: cx + rx * Math.cos(t) * cosP - ry * Math.sin(t) * sinP, y: cy + rx * Math.cos(t) * sinP + ry * Math.sin(t) * cosP });
  const der = (t: number) => ({ x: -rx * Math.sin(t) * cosP - ry * Math.cos(t) * sinP, y: -rx * Math.sin(t) * sinP + ry * Math.cos(t) * cosP });
  for (let i = 0; i < segs; i++) {
    const a = t1;
    const b = t1 + step;
    const pa = pt(a);
    const pb = pt(b);
    const da = der(a);
    const db = der(b);
    out.push([{ x: pa.x + k * da.x, y: pa.y + k * da.y }, { x: pb.x - k * db.x, y: pb.y - k * db.y }, pb]);
    t1 = b;
  }
  out[out.length - 1][2] = p;
  return out;
}

/** Lee el atributo "d" de un trazado SVG. */
export function parsePathD(d: string): Subpath[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const subs: Subpath[] = [];
  let cur: Subpath | null = null;
  let i = 0;
  let cmd = "";
  let pos: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let lastCtrl: Pt | null = null;
  let lastQ: Pt | null = null;
  const num = () => Number(tokens[i++]);
  const last = () => cur!.nodes[cur!.nodes.length - 1];
  const addCubic = (c1: Pt, c2: Pt, p: Pt) => {
    last().hout = c1;
    cur!.nodes.push({ x: p.x, y: p.y, hin: c2 });
    pos = p;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const R = (p: Pt) => (rel ? { x: pos.x + p.x, y: pos.y + p.y } : p);
    switch (cmd.toUpperCase()) {
      case "M": {
        const p = R({ x: num(), y: num() });
        cur = { nodes: [{ x: p.x, y: p.y }], closed: false };
        subs.push(cur);
        pos = start = p;
        cmd = rel ? "l" : "L";
        lastCtrl = lastQ = null;
        break;
      }
      case "L": {
        const p = R({ x: num(), y: num() });
        cur!.nodes.push({ x: p.x, y: p.y });
        pos = p;
        lastCtrl = lastQ = null;
        break;
      }
      case "H": {
        const v = num();
        pos = { x: rel ? pos.x + v : v, y: pos.y };
        cur!.nodes.push({ ...pos });
        lastCtrl = lastQ = null;
        break;
      }
      case "V": {
        const v = num();
        pos = { x: pos.x, y: rel ? pos.y + v : v };
        cur!.nodes.push({ ...pos });
        lastCtrl = lastQ = null;
        break;
      }
      case "C": {
        const c1 = R({ x: num(), y: num() });
        const c2 = R({ x: num(), y: num() });
        const p = R({ x: num(), y: num() });
        addCubic(c1, c2, p);
        lastCtrl = c2;
        lastQ = null;
        break;
      }
      case "S": {
        const c1 = lastCtrl ? { x: 2 * pos.x - lastCtrl.x, y: 2 * pos.y - lastCtrl.y } : { ...pos };
        const c2 = R({ x: num(), y: num() });
        const p = R({ x: num(), y: num() });
        addCubic(c1, c2, p);
        lastCtrl = c2;
        lastQ = null;
        break;
      }
      case "Q":
      case "T": {
        const q: Pt = cmd.toUpperCase() === "Q" ? R({ x: num(), y: num() }) : lastQ ? { x: 2 * pos.x - lastQ.x, y: 2 * pos.y - lastQ.y } : { ...pos };
        const p = R({ x: num(), y: num() });
        const p0 = pos;
        addCubic({ x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) }, { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) }, p);
        lastQ = q;
        lastCtrl = null;
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const phi = num();
        const large = num() !== 0;
        const sweep = num() !== 0;
        const p = R({ x: num(), y: num() });
        for (const [c1, c2, q] of arcToCubics(pos, rx, ry, phi, large, sweep, p)) addCubic(c1, c2, q);
        lastCtrl = lastQ = null;
        break;
      }
      case "Z": {
        if (cur) {
          // Si el último nodo coincide con el primero, se fusionan
          const f = cur.nodes[0];
          const l = last();
          if (cur.nodes.length > 1 && Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) {
            f.hin = l.hin;
            cur.nodes.pop();
          }
          cur.closed = true;
        }
        pos = start;
        lastCtrl = lastQ = null;
        // Un nuevo dibujo sin M empieza en el inicio
        if (i < tokens.length && !/[mM]/.test(tokens[i]) && /[a-zA-Z]/.test(tokens[i])) {
          cur = { nodes: [{ ...start }], closed: false };
          subs.push(cur);
        }
        break;
      }
      default:
        i++;
    }
  }
  return subs.filter((s) => s.nodes.length > 0);
}

function style(el: Element, inherited: Record<string, string>): Record<string, string> {
  const out = { ...inherited };
  for (const k of ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "fill-rule", "font-size", "font-family", "font-weight", "font-style", "text-anchor", "display", "visibility"]) {
    const v = el.getAttribute(k);
    if (v !== null) out[k] = v;
  }
  const inline = el.getAttribute("style");
  if (inline)
    for (const part of inline.split(";")) {
      const [k, v] = part.split(":").map((x) => x?.trim());
      if (k && v) out[k] = v;
    }
  if (el.getAttribute("opacity") === null) delete out.opacity;
  return out;
}

function colorOf(v: string | undefined): string | null {
  if (!v || v === "none" || v === "transparent") return null;
  if (v.startsWith("#")) return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v.slice(0, 7);
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = "#000";
  c.fillStyle = v;
  return typeof c.fillStyle === "string" && c.fillStyle.startsWith("#") ? c.fillStyle : "#000000";
}

/** Importa un archivo SVG como objetos de CoffeeVector. */
export function importSvg(text: string): { objects: VObject[]; width: number; height: number } {
  const dom = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = dom.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg") throw new Error("El archivo no es un SVG válido.");
  const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const width = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute("width") || "1000");
  const height = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute("height") || "1000");
  const root: M = vb.length === 4 ? [1, 0, 0, 1, -vb[0], -vb[1]] : ID;
  const grads = new Map<string, Paint>();
  dom.querySelectorAll("linearGradient,radialGradient").forEach((g) => {
    const stops = [...g.querySelectorAll("stop")].map((s) => {
      const st = style(s, {});
      return { offset: parseFloat(s.getAttribute("offset") || "0") / (s.getAttribute("offset")?.includes("%") ? 100 : 1), color: colorOf(s.getAttribute("stop-color") || st["stop-color"]) || "#000000", opacity: parseFloat(s.getAttribute("stop-opacity") || st["stop-opacity"] || "1") };
    });
    if (stops.length) grads.set(g.id, g.nodeName === "radialGradient" ? { type: "radial", stops, cx: 0.5, cy: 0.5, r: 0.5 } : { type: "linear", stops, angle: 0 });
  });
  const paintOf = (v: string | undefined, op: string | undefined): Paint | null => {
    if (!v) return null;
    const m = v.match(/url\(#([^)]+)\)/);
    if (m) return grads.get(m[1]) || null;
    const c = colorOf(v);
    return c ? solid(c, parseFloat(op || "1")) : null;
  };
  const objects: VObject[] = [];
  const walk = (el: Element, m: M, st: Record<string, string>, into: VObject[]) => {
    const s = style(el, st);
    if (s.display === "none" || s.visibility === "hidden") return;
    const mm = mul(m, parseTransform(el.getAttribute("transform")));
    const tag = el.nodeName.toLowerCase();
    const base = { id: newId("ob"), visible: true, locked: false, opacity: parseFloat(s.opacity || "1"), blend: "normal" };
    const fill = s.fill === undefined ? solid("#000000") : paintOf(s.fill, s["fill-opacity"]);
    const sw = parseFloat(s["stroke-width"] || "1") * scaleOf(mm);
    const strokeC = colorOf(s.stroke);
    const stroke: StrokeStyle | null = strokeC ? { color: strokeC, opacity: parseFloat(s["stroke-opacity"] || "1"), width: sw, cap: (s["stroke-linecap"] as StrokeStyle["cap"]) || "butt", join: (s["stroke-linejoin"] as StrokeStyle["join"]) || "miter", dash: [] } : null;
    const pathFrom = (subs: Subpath[], name: string) => {
      const mapped = subs.map((sp) => ({ ...sp, nodes: sp.nodes.map((n): PathNode => ({ ...apply(mm, n), hin: n.hin ? apply(mm, n.hin) : null, hout: n.hout ? apply(mm, n.hout) : null })) }));
      into.push({ ...base, type: "path", name, subpaths: mapped, fill, stroke, fillRule: s["fill-rule"] === "evenodd" ? "evenodd" : "nonzero" } as PathObj);
    };
    const n = (a: string) => parseFloat(el.getAttribute(a) || "0");
    switch (tag) {
      case "svg":
      case "g":
      case "a": {
        const kids: VObject[] = [];
        for (const c of el.children) walk(c, mm, s, kids);
        if (tag === "g" && kids.length > 1) into.push({ ...base, type: "group", name: el.getAttribute("id") || "Grupo", children: kids, clip: false } as GroupObj);
        else into.push(...kids);
        return;
      }
      case "path":
        return pathFrom(parsePathD(el.getAttribute("d") || ""), el.getAttribute("id") || "Trazado");
      case "rect": {
        const x = n("x");
        const y = n("y");
        const w = n("width");
        const h = n("height");
        const r = n("rx") || n("ry");
        const k = 0.5522847498 * r;
        const d = r ? `M${x + r} ${y} H${x + w - r} C${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r} V${y + h - r} C${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h} H${x + r} C${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r} V${y + r} C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} Z` : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
        return pathFrom(parsePathD(d), "Rectángulo");
      }
      case "circle":
      case "ellipse": {
        const cx = n("cx");
        const cy = n("cy");
        const rx = tag === "circle" ? n("r") : n("rx");
        const ry = tag === "circle" ? n("r") : n("ry");
        return pathFrom(parsePathD(`M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`), "Elipse");
      }
      case "line":
        return pathFrom(parsePathD(`M${n("x1")} ${n("y1")} L${n("x2")} ${n("y2")}`), "Línea");
      case "polyline":
      case "polygon": {
        const pts = (el.getAttribute("points") || "").trim();
        if (!pts) return;
        return pathFrom(parsePathD(`M${pts}${tag === "polygon" ? " Z" : ""}`), tag === "polygon" ? "Polígono" : "Polilínea");
      }
      case "text": {
        const p = apply(mm, { x: n("x"), y: n("y") });
        const content = [...el.childNodes].map((c) => c.textContent || "").join("\n").trim();
        if (!content) return;
        into.push({
          ...base,
          type: "text",
          name: content.slice(0, 24),
          x: p.x,
          y: p.y,
          text: content,
          font: (s["font-family"] || "Hanken Grotesk").split(",")[0].replace(/['"]/g, "").trim(),
          size: parseFloat(s["font-size"] || "16") * scaleOf(mm),
          weight: s["font-weight"] === "bold" ? 700 : parseInt(s["font-weight"] || "400", 10) || 400,
          italic: s["font-style"] === "italic",
          align: (s["text-anchor"] as TextObj["align"]) || "start",
          letterSpacing: 0,
          lineHeight: 1.2,
          rotation: 0,
          fill,
          stroke,
        } as TextObj);
        return;
      }
      case "image": {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href") || "";
        const p = apply(mm, { x: n("x"), y: n("y") });
        const k = scaleOf(mm);
        into.push({ ...base, type: "image", name: "Imagen", x: p.x, y: p.y, w: n("width") * k, h: n("height") * k, rotation: 0, href } as VObject);
        return;
      }
      default:
        return;
    }
  };
  walk(svg, root, {}, objects);
  return { objects, width: Math.round(width) || 1000, height: Math.round(height) || 1000 };
}

export const imageObject = (href: string, x: number, y: number, w: number, h: number): VObject => ({ id: newId("ob"), type: "image", name: "Imagen", visible: true, locked: false, opacity: 1, blend: "normal", x, y, w, h, rotation: 0, href });
