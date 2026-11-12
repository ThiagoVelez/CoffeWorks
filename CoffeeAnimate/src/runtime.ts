// Motor de CoffeeAnimate: dibujo de fotogramas (con interpolación) y
// reproductor interactivo. Todo está dentro de una sola función sin
// dependencias porque su código se copia tal cual en la exportación HTML5.

import type { AnimDoc, El, Keyframe, Timeline, Xform, Action } from "./types";

export interface Runtime {
  /** Elementos visibles de una capa en un fotograma (ya interpolados). */
  frameElements(kfs: Keyframe[], frame: number): El[];
  /** Dibuja una línea de tiempo en un fotograma. */
  drawTimeline(g: CanvasRenderingContext2D, doc: AnimDoc, tl: Timeline, frame: number, opts?: DrawOpts): void;
  drawElement(g: CanvasRenderingContext2D, doc: AnimDoc, el: El, frame: number, opts?: DrawOpts): void;
  elementBounds(doc: AnimDoc, el: El): { x: number; y: number; w: number; h: number };
  matrixOf(t: Xform): DOMMatrix;
  createPlayer(canvas: HTMLCanvasElement, doc: AnimDoc): Player;
}

export interface DrawOpts {
  outlineLayers?: Set<string>;
  hiddenLayers?: Set<string>;
  /** Estado de los botones: id del elemento → "up" | "over" | "down". */
  buttonState?: Map<string, "up" | "over" | "down">;
  /** Fotograma propio de cada clip de película (reproductor). */
  clipFrames?: Map<string, number>;
  /** Para los clics: se rellena con las zonas de los botones. */
  hits?: { el: El; m: DOMMatrix; bounds: { x: number; y: number; w: number; h: number } }[];
  editorTime?: boolean;
}

export interface Player {
  play(): void;
  stop(): void;
  goto(frame: number, play: boolean): void;
  frame(): number;
  destroy(): void;
}

export function coffeeAnimateRuntime(): Runtime {
  const images: Record<string, HTMLImageElement> = {};

  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  const hex = (c: string) => {
    const h = c.replace("#", "");
    const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
  };
  const mixColor = (a: string | null | undefined, b: string | null | undefined, u: number) => {
    if (!a || !b) return u < 0.5 ? a : b;
    const x = hex(a);
    const y = hex(b);
    return "#" + [0, 1, 2].map((i) => Math.round(lerp(x[i], y[i], u)).toString(16).padStart(2, "0")).join("");
  };

  /** Suavizado al estilo de Animate: −100 acelera, +100 frena. */
  const easeU = (u: number, ease: number) => {
    const k = Math.max(-100, Math.min(100, ease)) / 100;
    return u * (1 + k * (1 - u));
  };

  function interpolate(a: El, b: El, u: number, spin: number): El {
    const t = {
      x: lerp(a.t.x, b.t.x, u),
      y: lerp(a.t.y, b.t.y, u),
      sx: lerp(a.t.sx, b.t.sx, u),
      sy: lerp(a.t.sy, b.t.sy, u),
      rot: lerp(a.t.rot, b.t.rot + spin * 360, u),
    };
    const out: El = { ...a, t, alpha: lerp(a.alpha, b.alpha, u) };
    if (a.w !== undefined && b.w !== undefined) out.w = lerp(a.w, b.w, u);
    if (a.h !== undefined && b.h !== undefined) out.h = lerp(a.h, b.h, u);
    if (a.size !== undefined && b.size !== undefined) out.size = lerp(a.size, b.size, u);
    if (a.strokeWidth !== undefined && b.strokeWidth !== undefined) out.strokeWidth = lerp(a.strokeWidth, b.strokeWidth, u);
    out.fill = mixColor(a.fill, b.fill, u) as string | null;
    out.stroke = mixColor(a.stroke, b.stroke, u) as string;
    // Interpolación de forma: mismo número de puntos
    if (a.points && b.points && a.points.length === b.points.length) out.points = a.points.map((p, i) => [lerp(p[0], b.points![i][0], u), lerp(p[1], b.points![i][1], u)] as [number, number]);
    if (a.tint || b.tint) {
      const ta = a.tint || { color: (b.tint as { color: string }).color, amount: 0 };
      const tb = b.tint || { color: ta.color, amount: 0 };
      out.tint = { color: mixColor(ta.color, tb.color, u) as string, amount: lerp(ta.amount, tb.amount, u) };
    }
    return out;
  }

  function keyAt(kfs: Keyframe[], frame: number): number {
    let i = -1;
    for (let k = 0; k < kfs.length; k++) if (kfs[k].frame <= frame) i = k;
    return i;
  }

  function frameElements(kfs: Keyframe[], frame: number): El[] {
    const i = keyAt(kfs, frame);
    if (i < 0) return [];
    const k = kfs[i];
    const next = kfs[i + 1];
    if (k.tween !== "classic" || !next || frame === k.frame) return k.elements;
    const u = easeU((frame - k.frame) / (next.frame - k.frame), k.ease);
    return k.elements.map((e) => {
      const m = next.elements.find((x) => x.id === e.id);
      return m ? interpolate(e, m, u, k.spin) : e;
    });
  }

  const matrixOf = (t: Xform) => new DOMMatrix().translate(t.x, t.y).rotate(t.rot).scale(t.sx, t.sy);

  function pathOf(el: El): Path2D {
    const p = new Path2D();
    const pts = el.points || [];
    if (!pts.length) return p;
    p.moveTo(pts[0][0], pts[0][1]);
    if (pts.length < 3) pts.slice(1).forEach((q) => p.lineTo(q[0], q[1]));
    else {
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      const last = pts[pts.length - 1];
      p.lineTo(last[0], last[1]);
    }
    if (el.closed) p.closePath();
    return p;
  }

  function symbolOf(doc: AnimDoc, id?: string) {
    return doc.symbols.find((s) => s.id === id);
  }

  function elementBounds(doc: AnimDoc, el: El): { x: number; y: number; w: number; h: number } {
    if (el.kind === "rect" || el.kind === "ellipse") return { x: -(el.w || 0) / 2, y: -(el.h || 0) / 2, w: el.w || 0, h: el.h || 0 };
    if (el.kind === "path") {
      const pts = el.points || [[0, 0]];
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const pad = (el.strokeWidth || 0) / 2;
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }
    if (el.kind === "text") {
      const lines = (el.text || "").split("\n");
      const size = el.size || 32;
      const w = Math.max(...lines.map((l) => l.length)) * size * 0.55;
      return { x: 0, y: -size * 0.85, w: Math.max(10, w), h: size * 1.2 * lines.length };
    }
    if (el.kind === "image") {
      const img = doc.images.find((i) => i.id === el.imageId);
      return { x: 0, y: 0, w: img ? img.width : 10, h: img ? img.height : 10 };
    }
    if (el.kind === "instance") {
      const s = symbolOf(doc, el.symbolId);
      if (!s) return { x: -10, y: -10, w: 20, h: 20 };
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const l of s.timeline.layers)
        for (const k of l.keyframes)
          for (const e of k.elements) {
            const b = elementBounds(doc, e);
            const m = matrixOf(e.t);
            for (const [px, py] of [
              [b.x, b.y],
              [b.x + b.w, b.y],
              [b.x, b.y + b.h],
              [b.x + b.w, b.y + b.h],
            ]) {
              const q = m.transformPoint(new DOMPoint(px, py));
              x0 = Math.min(x0, q.x);
              y0 = Math.min(y0, q.y);
              x1 = Math.max(x1, q.x);
              y1 = Math.max(y1, q.y);
            }
          }
      return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: -10, y: -10, w: 20, h: 20 };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  function drawElement(g: CanvasRenderingContext2D, doc: AnimDoc, el: El, frame: number, opts: DrawOpts = {}, depth = 0, outline = false) {
    g.save();
    const m = matrixOf(el.t);
    g.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    g.globalAlpha *= Math.max(0, Math.min(1, el.alpha));
    const tinted = el.tint && el.tint.amount > 0.001 && !outline;
    if (tinted) {
      // Tinte: se dibuja aparte y se colorea encima
      const ctm = g.getTransform();
      const c = document.createElement("canvas");
      c.width = g.canvas.width;
      c.height = g.canvas.height;
      const cg = c.getContext("2d")!;
      cg.setTransform(ctm);
      drawElement(cg, doc, { ...el, t: { x: 0, y: 0, sx: 1, sy: 1, rot: 0 }, alpha: 1, tint: null }, frame, opts, depth + 1);
      cg.setTransform(1, 0, 0, 1, 0, 0);
      cg.globalCompositeOperation = "source-atop";
      cg.globalAlpha = el.tint!.amount;
      cg.fillStyle = el.tint!.color;
      cg.fillRect(0, 0, c.width, c.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(c, 0, 0);
      g.restore();
      return;
    }
    if (outline) {
      g.strokeStyle = "#4dabf7";
      g.lineWidth = 1 / Math.max(0.01, Math.hypot(m.a, m.b));
    }
    switch (el.kind) {
      case "path": {
        const p = pathOf(el);
        if (el.fill && el.closed && !outline) {
          g.fillStyle = el.fill;
          g.fill(p);
        }
        if (outline || (el.stroke && (el.strokeWidth || 0) > 0)) {
          if (!outline) {
            g.strokeStyle = el.stroke!;
            g.lineWidth = el.strokeWidth || 1;
          }
          g.lineCap = "round";
          g.lineJoin = "round";
          g.stroke(p);
        }
        break;
      }
      case "rect":
      case "ellipse": {
        const w = el.w || 0;
        const h = el.h || 0;
        const p = new Path2D();
        if (el.kind === "rect") {
          const r = Math.min(el.radius || 0, w / 2, h / 2);
          if (r > 0 && p.roundRect) p.roundRect(-w / 2, -h / 2, w, h, r);
          else p.rect(-w / 2, -h / 2, w, h);
        } else p.ellipse(0, 0, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2);
        if (el.fill && !outline) {
          g.fillStyle = el.fill;
          g.fill(p);
        }
        if (outline || (el.stroke && (el.strokeWidth || 0) > 0)) {
          if (!outline) {
            g.strokeStyle = el.stroke!;
            g.lineWidth = el.strokeWidth || 1;
          }
          g.stroke(p);
        }
        break;
      }
      case "text": {
        const size = el.size || 32;
        g.font = `${el.bold ? 700 : 400} ${size}px ${el.font || "sans-serif"}`;
        g.textBaseline = "alphabetic";
        const lines = (el.text || "").split("\n");
        lines.forEach((ln, i) => {
          if (outline) g.strokeText(ln, 0, i * size * 1.2);
          else {
            g.fillStyle = el.fill || "#000";
            g.fillText(ln, 0, i * size * 1.2);
          }
        });
        break;
      }
      case "image": {
        const a = doc.images.find((i) => i.id === el.imageId);
        if (!a) break;
        let img = images[a.id];
        if (!img) {
          img = new Image();
          img.src = a.data;
          images[a.id] = img;
        }
        if (outline) g.strokeRect(0, 0, a.width, a.height);
        else if (img.complete && img.naturalWidth) g.drawImage(img, 0, 0, a.width, a.height);
        break;
      }
      case "instance": {
        const s = symbolOf(doc, el.symbolId);
        if (!s || depth > 10) break;
        let f = 0;
        if (s.type === "button") {
          const st = (opts.buttonState && opts.buttonState.get(el.id)) || "up";
          f = st === "down" ? 2 : st === "over" ? 1 : 0;
          if (opts.hits) opts.hits.push({ el, m: g.getTransform(), bounds: elementBounds(doc, el) });
        } else if (s.type === "movieclip") {
          f = opts.clipFrames ? opts.clipFrames.get(el.id) ?? 0 : opts.editorTime ? 0 : frame % Math.max(1, s.timeline.length);
          if (opts.editorTime) f = frame % Math.max(1, s.timeline.length);
        } else {
          const len = Math.max(1, s.timeline.length);
          const start = el.firstFrame || 0;
          f = el.loop === "single" ? start : el.loop === "once" ? Math.min(len - 1, start + frame) : (start + frame) % len;
        }
        // En los botones el fotograma «Zona activa» (3) no se ve
        drawTimeline(g, doc, s.timeline, s.type === "button" ? Math.min(f, 2) : f, opts, depth + 1, outline);
        break;
      }
    }
    g.restore();
  }

  function drawTimeline(g: CanvasRenderingContext2D, doc: AnimDoc, tl: Timeline, frame: number, opts: DrawOpts = {}, depth = 0, forceOutline = false) {
    for (let i = tl.layers.length - 1; i >= 0; i--) {
      const l = tl.layers[i];
      if (!l.visible || (opts.hiddenLayers && opts.hiddenLayers.has(l.id))) continue;
      const outline = forceOutline || l.outline || !!(opts.outlineLayers && opts.outlineLayers.has(l.id));
      for (const el of frameElements(l.keyframes, frame)) drawElement(g, doc, el, frame, opts, depth, outline);
    }
  }

  function createPlayer(canvas: HTMLCanvasElement, doc: AnimDoc): Player {
    const g = canvas.getContext("2d")!;
    let frame = 0;
    let playing = true;
    let timer = 0;
    const buttonState = new Map<string, "up" | "over" | "down">();
    const clipFrames = new Map<string, number>();
    let hits: NonNullable<DrawOpts["hits"]> = [];
    const len = Math.max(1, doc.main.length);
    const labels: Record<string, number> = {};
    doc.main.layers.forEach((l) => l.keyframes.forEach((k) => k.label && (labels[k.label] = k.frame)));

    const scriptAt = (f: number) => doc.main.layers.some((l) => l.keyframes.some((k) => k.frame === f && k.script === "stop"));

    function render() {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth || doc.width;
      const H = canvas.clientHeight || doc.height;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const k = Math.min(W / doc.width, H / doc.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#000";
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.setTransform(dpr * k, 0, 0, dpr * k, ((W - doc.width * k) / 2) * dpr, ((H - doc.height * k) / 2) * dpr);
      g.fillStyle = doc.background;
      g.fillRect(0, 0, doc.width, doc.height);
      g.save();
      g.beginPath();
      g.rect(0, 0, doc.width, doc.height);
      g.clip();
      hits = [];
      drawTimeline(g, doc, doc.main, frame, { buttonState, clipFrames, hits });
      g.restore();
    }

    function advanceClips(tl: Timeline) {
      for (const l of tl.layers)
        for (const k of l.keyframes)
          for (const e of k.elements)
            if (e.kind === "instance") {
              const s = symbolOf(doc, e.symbolId);
              if (s && s.type === "movieclip") {
                clipFrames.set(e.id, ((clipFrames.get(e.id) ?? -1) + 1) % Math.max(1, s.timeline.length));
                advanceClips(s.timeline);
              }
            }
    }

    function tick() {
      advanceClips(doc.main);
      if (playing) {
        frame = (frame + 1) % len;
        if (scriptAt(frame)) playing = false;
      }
      render();
    }

    function hitAt(px: number, py: number) {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (px - r.left) * dpr;
      const y = (py - r.top) * dpr;
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i];
        const q = h.m.inverse().transformPoint(new DOMPoint(x, y));
        if (q.x >= h.bounds.x && q.x <= h.bounds.x + h.bounds.w && q.y >= h.bounds.y && q.y <= h.bounds.y + h.bounds.h) return h.el;
      }
      return null;
    }

    function run(a: Action) {
      if (a.type === "play") playing = true;
      else if (a.type === "stop") playing = false;
      else if (a.type === "gotoAndPlay" || a.type === "gotoAndStop") {
        frame = Math.max(0, Math.min(len - 1, a.frame));
        playing = a.type === "gotoAndPlay";
      } else if (a.type === "next") frame = Math.min(len - 1, frame + 1);
      else if (a.type === "prev") frame = Math.max(0, frame - 1);
      else if (a.type === "url" && /^https?:\/\//.test(a.url)) window.open(a.url, "_blank", "noopener");
      render();
    }

    let over: El | null = null;
    const onMove = (e: PointerEvent) => {
      const h = hitAt(e.clientX, e.clientY);
      if (h !== over) {
        if (over) buttonState.set(over.id, "up");
        if (h) buttonState.set(h.id, "over");
        over = h;
        canvas.style.cursor = h ? "pointer" : "default";
        render();
      }
    };
    const onDown = (e: PointerEvent) => {
      const h = hitAt(e.clientX, e.clientY);
      if (h) {
        buttonState.set(h.id, "down");
        render();
      }
    };
    const onUp = (e: PointerEvent) => {
      const h = hitAt(e.clientX, e.clientY);
      buttonState.forEach((v, k) => v === "down" && buttonState.set(k, h && h.id === k ? "over" : "up"));
      if (h && h.action) run(h.action);
      else render();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    if (scriptAt(0)) playing = false;
    render();
    timer = window.setInterval(tick, 1000 / doc.fps);
    return {
      play: () => (playing = true),
      stop: () => (playing = false),
      goto: (f, p) => run({ type: p ? "gotoAndPlay" : "gotoAndStop", frame: f }),
      frame: () => frame,
      destroy: () => {
        window.clearInterval(timer);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
      },
    };
  }

  return { frameElements, drawTimeline: (g, doc, tl, frame, opts) => drawTimeline(g, doc, tl, frame, opts), drawElement: (g, doc, el, frame, opts) => drawElement(g, doc, el, frame, opts), elementBounds, matrixOf, createPlayer };
}

export const runtime = coffeeAnimateRuntime();

/** Página HTML5 independiente con el reproductor y la animación. */
export function exportHtml(doc: AnimDoc, title: string): string {
  const safeTitle = title.replace(/[<>&]/g, "");
  const data = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>html,body{margin:0;height:100%;background:#111}canvas{display:block;width:100vw;height:100vh}</style>
</head><body><canvas id="stage" aria-label="${safeTitle}"></canvas>
<script>
const DOC = ${data};
const coffeeAnimateRuntime = ${coffeeAnimateRuntime.toString()};
const player = coffeeAnimateRuntime().createPlayer(document.getElementById("stage"), DOC);
window.coffeePlayer = player;
</script>
<!-- Hecho con CoffeeAnimate (CoffeeWorks) -->
</body></html>`;
}
