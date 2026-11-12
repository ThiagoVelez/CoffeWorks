// Plantillas de la categoría Ilustración (CoffeePhoto, CoffeeVector y
// CoffeePaint). Las imágenes de fondo se dibujan al crear la plantilla.

/** Imagen dibujada al vuelo: JPG para fondos opacos (pesan mucho menos) y PNG si hay transparencia. */
const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, opaque = false): string => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return opaque ? c.toDataURL("image/jpeg", 0.9) : c.toDataURL("image/png");
};

const linear = (g: CanvasRenderingContext2D, w: number, h: number, stops: string[], vertical = false) => {
  const grad = vertical ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, h);
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
};

let n = 0;
const id = (p: string) => `${p}${(++n).toString(36)}${Date.now().toString(36)}`;

// ---------------------------------------------------------------------------
// CoffeePhoto (.cph)
// ---------------------------------------------------------------------------

const pLayer = (name: string, extra: Record<string, unknown>) => ({ id: id("ly"), name, visible: true, locked: false, opacity: 1, blend: "source-over", ...extra });
const pText = (text: string, x: number, y: number, style: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  pLayer(text.slice(0, 24), { kind: "text", x, y, width: 0, rotation: 0, textStyle: { text, font: "Hanken Grotesk", size: 72, color: "#ffffff", bold: true, italic: false, align: "left", lineHeight: 1.1, letterSpacing: 0, shadow: false, stroke: 0, strokeColor: "#000000", ...style }, ...extra });

const photoDoc = (w: number, h: number, layers: Array<Record<string, unknown>>) => JSON.stringify({ app: "CoffeePhoto", version: 1, width: w, height: h, dpi: 72, layers, activeId: layers[layers.length - 1].id });

function phPost(): string {
  const W = 1080;
  const bg = canvas(W, W, (g) => {
    linear(g, W, W, ["#ff9f43", "#ff6b6b", "#c44569"]);
    g.globalAlpha = 0.18;
    g.fillStyle = "#fff";
    for (const [x, y, r] of [[860, 180, 260], [140, 920, 200], [980, 900, 120]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }, true);
  const badge = canvas(W, W, (g) => {
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.roundRect(90, 760, 420, 110, 55);
    g.fill();
  });
  return photoDoc(W, W, [
    pLayer("Fondo", { kind: "raster", data: bg }),
    pText("OFERTA\nESPECIAL", 90, 150, { size: 130, lineHeight: 1 }, { style: { dropShadow: { color: "#000000", opacity: 0.25, distance: 8, angle: 120, blur: 16 } } }),
    pText("-30 %", 90, 450, { size: 230, color: "#fff4d6" }),
    pLayer("Botón", { kind: "raster", data: badge }),
    pText("Compra ya", 150, 788, { size: 54, color: "#c44569" }),
    pText("Solo este fin de semana · tutienda.com", 90, 960, { size: 34, bold: false }),
  ]);
}

function phThumbnail(): string {
  const W = 1280;
  const H = 720;
  const bg = canvas(W, H, (g) => {
    linear(g, W, H, ["#1e1b4b", "#7c3aed", "#f97316"]);
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 2;
    for (let x = -H; x < W; x += 40) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + H, 0);
      g.stroke();
    }
  }, true);
  const shape = canvas(W, H, (g) => {
    g.fillStyle = "#facc15";
    g.beginPath();
    g.arc(1010, 360, 230, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1e1b4b";
    g.font = "bold 150px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("?", 1010, 370);
  });
  const tag = canvas(W, H, (g) => {
    g.fillStyle = "#ef4444";
    g.beginPath();
    g.roundRect(70, 70, 260, 80, 16);
    g.fill();
  });
  return photoDoc(W, H, [
    pLayer("Fondo", { kind: "raster", data: bg }),
    pLayer("Círculo", { kind: "raster", data: shape }),
    pLayer("Etiqueta", { kind: "raster", data: tag }),
    pText("NUEVO", 108, 82, { size: 56 }),
    pText("CÓMO HACER\nTU PRIMERA APP", 70, 220, { size: 104, stroke: 8, strokeColor: "#1e1b4b", lineHeight: 1.05 }),
    pText("en 10 minutos", 76, 480, { size: 64, color: "#facc15", italic: true }),
  ]);
}

function phCollage(): string {
  const W = 1080;
  const H = 1350;
  const frames = canvas(W, H, (g) => {
    g.fillStyle = "#f5efe6";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#d8cbbb";
    const boxes = [
      [60, 220, 600, 520],
      [690, 220, 330, 245],
      [690, 495, 330, 245],
      [60, 770, 330, 480],
      [420, 770, 600, 480],
    ];
    g.font = "28px sans-serif";
    g.textAlign = "center";
    for (const [x, y, w, h] of boxes) {
      g.fillStyle = "#d8cbbb";
      g.fillRect(x, y, w, h);
      g.fillStyle = "#8a7a68";
      g.fillText("Coloca tu foto", x + w / 2, y + h / 2);
    }
  }, true);
  return photoDoc(W, H, [
    pLayer("Marco del collage", { kind: "raster", data: frames }),
    pText("Nuestro verano", 60, 70, { size: 96, color: "#3d2e22", font: "Georgia", bold: false, italic: true }),
    pText("2026 · recuerdos", 64, 180, { size: 30, color: "#8a7a68", bold: false }),
  ]);
}

// ---------------------------------------------------------------------------
// CoffeeVector (.cvc)
// ---------------------------------------------------------------------------

const K = 0.5522847498;
const vBase = (name: string) => ({ id: id("ob"), name, visible: true, locked: false, opacity: 1, blend: "normal" });
const solid = (color: string, opacity = 1) => ({ type: "solid", color, opacity });
const grad = (stops: string[], angle = 90) => ({ type: "linear", angle, stops: stops.map((c, i) => ({ offset: i / (stops.length - 1), color: c, opacity: 1 })) });
const pathV = (name: string, nodes: unknown[], fill: unknown, stroke: unknown = null, closed = true) => ({ ...vBase(name), type: "path", subpaths: [{ nodes, closed }], fill, stroke, fillRule: "nonzero" });
const rectV = (name: string, x: number, y: number, w: number, h: number, fill: unknown, r = 0, stroke: unknown = null) => {
  if (!r) return pathV(name, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], fill, stroke);
  const k = r * K;
  return pathV(
    name,
    [
      { x: x + r, y, hin: { x: x + r - k, y } },
      { x: x + w - r, y, hout: { x: x + w - r + k, y } },
      { x: x + w, y: y + r, hin: { x: x + w, y: y + r - k } },
      { x: x + w, y: y + h - r, hout: { x: x + w, y: y + h - r + k } },
      { x: x + w - r, y: y + h, hin: { x: x + w - r + k, y: y + h } },
      { x: x + r, y: y + h, hout: { x: x + r - k, y: y + h } },
      { x, y: y + h - r, hin: { x, y: y + h - r + k } },
      { x, y: y + r, hout: { x, y: y + r - k } },
    ],
    fill,
    stroke
  );
};
const circleV = (name: string, cx: number, cy: number, r: number, fill: unknown, stroke: unknown = null) => {
  const k = r * K;
  return pathV(
    name,
    [
      { x: cx, y: cy - r, hin: { x: cx - k, y: cy - r }, hout: { x: cx + k, y: cy - r } },
      { x: cx + r, y: cy, hin: { x: cx + r, y: cy - k }, hout: { x: cx + r, y: cy + k } },
      { x: cx, y: cy + r, hin: { x: cx + k, y: cy + r }, hout: { x: cx - k, y: cy + r } },
      { x: cx - r, y: cy, hin: { x: cx - r, y: cy + k }, hout: { x: cx - r, y: cy - k } },
    ],
    fill,
    stroke
  );
};
const starV = (name: string, cx: number, cy: number, r: number, fill: unknown) =>
  pathV(
    name,
    Array.from({ length: 10 }, (_, i) => {
      const a = ((-90 + 36 * i) * Math.PI) / 180;
      const rr = i % 2 ? r * 0.45 : r;
      return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
    }),
    fill
  );
const textV = (text: string, x: number, y: number, size: number, color: string, extra: Record<string, unknown> = {}) => ({ ...vBase(text.slice(0, 24)), type: "text", x, y, text, font: "Hanken Grotesk", size, weight: 700, italic: false, align: "middle", letterSpacing: 0, lineHeight: 1.2, rotation: 0, fill: solid(color), stroke: null, ...extra });
const board = (name: string, x: number, y: number, w: number, h: number, background: string | null = "#ffffff") => ({ id: id("ab"), name, x, y, w, h, background });
const vectorDoc = (artboards: unknown[], objects: unknown[]) => JSON.stringify({ app: "CoffeeVector", version: 1, artboards, objects, swatches: [] });

function vcLogo(): string {
  return vectorDoc(
    [board("Logotipo", 0, 0, 1000, 1000)],
    [
      circleV("Emblema", 500, 400, 230, grad(["#ffb300", "#ff6d00", "#e8364d"], 60)),
      circleV("Anillo", 500, 400, 260, null, { color: "#ff6d00", opacity: 1, width: 10, cap: "round", join: "round", dash: [2, 18] }),
      starV("Estrella", 500, 400, 120, solid("#ffffff")),
      textV("TU MARCA", 500, 800, 104, "#2b1d14", { letterSpacing: 8 }),
      textV("ESLOGAN DE LA EMPRESA", 500, 870, 34, "#8a6f5a", { weight: 500, letterSpacing: 6 }),
    ]
  );
}

function vcCard(): string {
  return vectorDoc(
    [board("Anverso", 0, 0, 1050, 600), board("Reverso", 1130, 0, 1050, 600, "#1f2937")],
    [
      rectV("Franja", 0, 0, 1050, 120, grad(["#ff7a00", "#e8364d"], 0)),
      circleV("Logo", 140, 330, 80, grad(["#ff7a00", "#e8364d"], 45)),
      textV("Ana Torres", 600, 300, 72, "#1f2937"),
      textV("Diseñadora gráfica", 600, 360, 34, "#e8590c", { weight: 500 }),
      textV("+34 600 000 000 · ana@estudio.com · estudio.com", 525, 520, 26, "#6b7280", { weight: 400 }),
      circleV("Logo reverso", 1655, 260, 110, grad(["#ff7a00", "#e8364d"], 45)),
      textV("ESTUDIO", 1655, 460, 64, "#ffffff", { letterSpacing: 10 }),
    ]
  );
}

function vcPoster(): string {
  const W = 1123;
  const H = 1587;
  return vectorDoc(
    [board("Cartel", 0, 0, W, H, "#fff7ed")],
    [
      circleV("Sol", W / 2, 560, 360, grad(["#ffd43b", "#ff922b", "#f03e3e"], 90)),
      rectV("Horizonte", 0, 760, W, 827, solid("#1d3557")),
      pathV("Montaña", [{ x: 0, y: 900 }, { x: 300, y: 640 }, { x: 560, y: 860 }, { x: 820, y: 600 }, { x: W, y: 880 }, { x: W, y: 1000 }, { x: 0, y: 1000 }], solid("#457b9d")),
      textV("FESTIVAL", W / 2, 1180, 150, "#fff7ed", { letterSpacing: 12 }),
      textV("DE VERANO", W / 2, 1290, 96, "#ffd43b", { letterSpacing: 8 }),
      textV("12 · 13 · 14 DE JULIO", W / 2, 1420, 44, "#fff7ed", { weight: 500, letterSpacing: 4 }),
    ]
  );
}

// ---------------------------------------------------------------------------
// CoffeePaint (.cpt)
// ---------------------------------------------------------------------------

const paintLayer = (name: string, data: string | null, extra: Record<string, unknown> = {}) => ({ id: id("ly"), name, data: data || "", visible: true, opacity: 1, blend: "source-over", locked: false, alphaLock: false, ...extra });
const paintDoc = (w: number, h: number, paper: string, paperColor: string, layers: Array<Record<string, unknown>>) => JSON.stringify({ app: "CoffeePaint", version: 1, width: w, height: h, paper, paperColor, layers, activeId: layers[layers.length - 1].id });

function ptSketch(): string {
  const W = 2048;
  const H = 1536;
  const guides = canvas(W, H, (g) => {
    g.strokeStyle = "rgba(70,110,200,0.35)";
    g.lineWidth = 2;
    const vp = [W / 2, H * 0.45];
    for (let k = 0; k <= 16; k++) {
      g.beginPath();
      g.moveTo(vp[0], vp[1]);
      const a = (k / 16) * Math.PI * 2;
      g.lineTo(vp[0] + Math.cos(a) * W, vp[1] + Math.sin(a) * W);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, vp[1]);
    g.lineTo(W, vp[1]);
    g.strokeStyle = "rgba(220,60,60,0.5)";
    g.stroke();
  });
  return paintDoc(W, H, "sketch", "#fbf8f2", [paintLayer("Guías de perspectiva", guides, { opacity: 0.7, locked: true }), paintLayer("Boceto", null, { opacity: 0.6 }), paintLayer("Tinta", null), paintLayer("Color", null, { blend: "multiply" })]);
}

function ptComic(): string {
  const W = 1800;
  const H = 2700;
  const panels = canvas(W, H, (g) => {
    g.strokeStyle = "#111";
    g.lineWidth = 10;
    const m = 90;
    const gap = 40;
    const rows = [
      [[m, m, W - 2 * m, 700]],
      [
        [m, m + 700 + gap, (W - 2 * m - gap) * 0.55, 800],
        [m + (W - 2 * m - gap) * 0.55 + gap, m + 700 + gap, (W - 2 * m - gap) * 0.45, 800],
      ],
      [
        [m, m + 1540 + 2 * gap, (W - 2 * m - 2 * gap) / 3, 900],
        [m + (W - 2 * m - 2 * gap) / 3 + gap, m + 1540 + 2 * gap, (W - 2 * m - 2 * gap) / 3, 900],
        [m + 2 * ((W - 2 * m - 2 * gap) / 3 + gap), m + 1540 + 2 * gap, (W - 2 * m - 2 * gap) / 3, 900],
      ],
    ];
    for (const row of rows) for (const [x, y, w, h] of row) g.strokeRect(x, y, w, h);
  });
  return paintDoc(W, H, "smooth", "#ffffff", [paintLayer("Lápiz", null, { opacity: 0.5 }), paintLayer("Viñetas", panels, { locked: true }), paintLayer("Tinta", null), paintLayer("Color plano", null, { blend: "multiply" })]);
}

function ptMandala(): string {
  const W = 2048;
  const guides = canvas(W, W, (g) => {
    g.strokeStyle = "rgba(230,73,128,0.35)";
    g.lineWidth = 2;
    for (let r = 120; r < W / 2; r += 140) {
      g.beginPath();
      g.arc(W / 2, W / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
  });
  return paintDoc(W, W, "watercolor", "#fffaf2", [paintLayer("Círculos guía", guides, { opacity: 0.6, locked: true }), paintLayer("Mandala", null), paintLayer("Acuarela", null, { blend: "multiply" })]);
}

export const PHOTO_TEMPLATES: Record<string, () => string> = { "ph-post-oferta": phPost, "ph-miniatura-youtube": phThumbnail, "ph-collage": phCollage };
export const VECTOR_TEMPLATES: Record<string, () => string> = { "vc-logotipo": vcLogo, "vc-tarjeta-visita": vcCard, "vc-cartel": vcPoster };
export const PAINT_TEMPLATES: Record<string, () => string> = { "pt-boceto-perspectiva": ptSketch, "pt-pagina-comic": ptComic, "pt-mandala": ptMandala };
