import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Scissors, Copy, ClipboardPaste, Wand2, Sparkles, Keyboard, Info, ZoomIn, ZoomOut, Maximize, Grid3x3 } from "lucide-react";
import { SuiteHeader, type MenuDefinition, type MenuEntry } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, STUDIO_CSS } from "./studio/ui";
import { extensionOf, pickOpenFile, saveFileAs } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import { RAW_EXTENSIONS, decodeRaw, isRaw } from "./studio/raw";
import { Canvas, type CanvasActions, type CanvasHandle, type TransformState, type View } from "./components/Canvas";
import { ColorPanel, LayerStyleProperties, LayersPanel, OptionsBar, TOOLS, TextProperties, ToolBar } from "./components/Panels";
import { ADJUST_MENU, AdjustDialog, AiPromptDialog, AiSettingsDialog, ExportDialog, FilterDialog, NewDocDialog, SizeDialog } from "./components/PhotoDialogs";
import { ACCENT, ACCENT_DARK, type AdjustKind, type Adjustment, type Layer, type PhotoDoc, type TextLayer, type Tool, type ToolOptions } from "./types";
import { activeLayer, adjustLayer, blankRaster, compose, docFromCanvas, layerCanvas, newDocument, parseDocument, rasterLayer, serializeDocument, textLayer, tokensOf, updateLayer } from "./services/model";
import { ctx2d, fromCanvas, getCanvas, newCanvas, setKeep, subscribe } from "./services/pixels";
import { ADJUST_LABELS, FILTER_LABELS, adjustCanvas, applyFilter, defaultAdjustment, histogram, type FilterKind, type FilterParams } from "./services/adjust";
import { alphaToMask, featherMask, growMask, invertMask, makeSelection, maskBounds, mergeInSelection, rectMask, type Selection } from "./services/selection";
import { contentAwareFill } from "./services/inpaint";
import { IMAGE_EXTENSIONS, bytesToCanvas, exportDocument, type ExportFormat } from "./services/io";
import { ADDON_ID as AI_ADDON, generateImage, generativeFill, loadAiSettings, saveAiSettings } from "./services/ai";

const store = createDocStore<PhotoDoc>({
  appId: "coffeephoto",
  extension: "cph",
  category: "Ilustración",
  defaultTitle: "Imagen sin título",
  kindLabel: "Imágenes de CoffeePhoto",
  serialize: serializeDocument,
  parse: parseDocument,
  create: () => newDocument(),
});

const DEFAULT_OPTS: ToolOptions = {
  brush: { size: 30, hardness: 80, opacity: 100, flow: 100, pressure: true },
  eraser: { size: 40, hardness: 90, opacity: 100, flow: 100, pressure: false },
  clone: { size: 40, hardness: 60, opacity: 100, flow: 100, pressure: false },
  heal: { size: 30, hardness: 70, opacity: 100, flow: 100, pressure: false },
  tone: { size: 60, hardness: 30, opacity: 40, flow: 100, pressure: false, range: "midtones" },
  blur: { size: 50, hardness: 40, opacity: 100, flow: 60, pressure: false },
  selectMode: "new",
  feather: 0,
  wandTolerance: 32,
  wandContiguous: true,
  sampleAll: false,
  bucketTolerance: 32,
  gradientType: "linear",
  gradientMode: "fgbg",
  shape: "rect",
  shapeFill: true,
  shapeStroke: 0,
  cornerRadius: 24,
};

const FONTS = ["Hanken Grotesk", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS", "Impact", "Comic Sans MS", "Segoe UI"];

type DialogState =
  | { kind: "new" }
  | { kind: "adjust"; adj: Adjustment; asLayer: boolean; layerId: string | null }
  | { kind: "filter"; filter: FilterKind }
  | { kind: "size"; mode: "image" | "canvas" }
  | { kind: "export" }
  | { kind: "aiSettings" }
  | { kind: "aiPrompt"; mode: "fill" | "generate" }
  | null;

export const App: React.FC = () => {
  const canvasRef = useRef<CanvasHandle>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const sd = useStudioDoc<PhotoDoc>(store, {
    appName: "CoffeePhoto",
    importExtensions: [...IMAGE_EXTENSIONS, ...RAW_EXTENSIONS],
    importFile: async (file) => {
      const ext = extensionOf(file.name);
      if (isRaw(file.name)) {
        const c = await decodeRaw(file.bytes, file.name, "CoffeePhoto");
        return c ? docFromCanvas(c) : null;
      }
      if (!IMAGE_EXTENSIONS.includes(ext)) return null;
      return docFromCanvas(await bytesToCanvas(file.bytes, file.name));
    },
    onLoaded: () => {
      setSelection(null);
      setTransform(null);
      setEditMask(false);
      window.setTimeout(() => canvasRef.current?.fit(), 30);
    },
    historyLimit: 50,
  });
  const doc = sd.doc;
  const [tool, setTool] = useState<Tool>("brush");
  const [opts, setOpts] = useState<ToolOptions>(DEFAULT_OPTS);
  const [fg, setFg] = useState("#e8452c");
  const [bg, setBg] = useState("#ffffff");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editMask, setEditMask] = useState(false);
  const [transform, setTransform] = useState<TransformState | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [previewOverride, setPreviewOverride] = useState<{ id: string; canvas: HTMLCanvasElement } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PhotoDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [pixelVersion, setPixelVersion] = useState(0);
  const clipboard = useRef<HTMLCanvasElement | null>(null);

  // Las fichas en uso no se liberan
  useEffect(() => setKeep(() => new Set(sd.docRef.current ? tokensOf(sd.docRef.current) : [])), [sd.docRef]);
  useEffect(() => subscribe(() => setPixelVersion((v) => v + 1)), []);

  const shown = previewDoc || doc;

  // Al cambiar el tamaño del documento (recortar, deshacer…) se vuelve a encuadrar
  const docSize = doc ? `${doc.width}x${doc.height}` : "";
  useEffect(() => {
    if (docSize) window.setTimeout(() => canvasRef.current?.fit(), 20);
  }, [docSize]);
  const active = doc ? activeLayer(doc) : null;

  // ------------------------------------------------------------------------
  // Cambios del documento
  // ------------------------------------------------------------------------

  const apply = useCallback((next: PhotoDoc, key = "") => sd.apply(next, key), [sd]);
  const cur = () => sd.docRef.current!;

  const commitPixels = useCallback(
    (layerId: string, canvas: HTMLCanvasElement, target: "pixels" | "mask", _label: string) => {
      const d = sd.docRef.current;
      if (!d) return;
      const token = fromCanvas(canvas);
      apply(updateLayer(d, layerId, target === "mask" ? { mask: token, maskEnabled: true } : ({ data: token } as Partial<Layer>)));
    },
    [apply, sd.docRef]
  );

  const insertLayer = (layer: Layer, d = cur()) => {
    const idx = d.layers.findIndex((l) => l.id === d.activeId);
    const layers = [...d.layers];
    layers.splice(idx + 1, 0, layer);
    apply({ ...d, layers, activeId: layer.id });
  };

  const addPixelLayer = (canvas: HTMLCanvasElement, name: string) => insertLayer(rasterLayer(name, fromCanvas(canvas)));

  const updateLayerProp = (id: string, patch: Partial<Layer>, key?: string) => apply(updateLayer(cur(), id, patch), key);

  const actions: CanvasActions = {
    commitPixels,
    addPixelLayer,
    updateLayer: updateLayerProp,
    setSelection,
    pickColor: (hex, background) => (background ? setBg(hex) : setFg(hex)),
    applyCrop: (r) => resizeCanvas(r.w, r.h, -r.x, -r.y),
    addText: (x, y) => {
      const l = textLayer(Math.round(x), Math.round(y), { color: fg, size: Math.max(16, Math.round(cur().width / 24)) });
      insertLayer(l);
      window.setTimeout(() => (document.querySelector("[data-text-input]") as HTMLTextAreaElement | null)?.select(), 60);
    },
    editText: (id) => {
      apply({ ...cur(), activeId: id }, "select");
      window.setTimeout(() => (document.querySelector("[data-text-input]") as HTMLTextAreaElement | null)?.focus(), 60);
    },
    toast: (m) => toast(m, "info"),
    setTransform,
    busy: setBusy,
  };

  // ------------------------------------------------------------------------
  // Utilidades de píxeles
  // ------------------------------------------------------------------------

  const activeRaster = (warn = true): { layer: Extract<Layer, { kind: "raster" }>; canvas: HTMLCanvasElement } | null => {
    const l = activeLayer(cur());
    if (l.kind !== "raster") {
      if (warn) toast(l.kind === "text" ? "Rasteriza la capa de texto (menú Capa) para editar sus píxeles" : "Selecciona una capa de píxeles", "info");
      return null;
    }
    if (l.locked) {
      if (warn) toast("La capa está bloqueada", "info");
      return null;
    }
    const c = getCanvas(l.data);
    return c ? { layer: l, canvas: c } : null;
  };

  /** Recorta un lienzo con la selección o devuelve el lienzo entero. */
  const selected = (c: HTMLCanvasElement) => {
    if (!selection) return c;
    const out = newCanvas(c.width, c.height);
    const g = ctx2d(out);
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(selection.mask, 0, 0);
    return out;
  };

  /** Aplica un procesamiento a la capa activa (solo dentro de la selección, si la hay). */
  const processActive = (fn: (c: HTMLCanvasElement) => HTMLCanvasElement, label: string) => {
    const a = activeRaster();
    if (!a) return;
    commitPixels(a.layer.id, mergeInSelection(a.canvas, fn(a.canvas), selection), "pixels", label);
  };

  // ------------------------------------------------------------------------
  // Documento: tamaño, lienzo, rotación
  // ------------------------------------------------------------------------

  const transformDoc = (w: number, h: number, draw: (g: CanvasRenderingContext2D, src: HTMLCanvasElement) => void, mapText: (l: TextLayer) => Partial<TextLayer>, extra: Partial<PhotoDoc> = {}) => {
    const d = cur();
    const remap = (token: string | null | undefined, fillWhite = false) => {
      if (!token) return token;
      const src = getCanvas(token);
      const c = newCanvas(w, h);
      const g = ctx2d(c);
      if (fillWhite) {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
      }
      if (src) draw(g, src);
      return fromCanvas(c);
    };
    const layers = d.layers.map((l): Layer => {
      const mask = remap(l.mask, true);
      if (l.kind === "raster") return { ...l, data: remap(l.data)!, mask };
      if (l.kind === "text") return { ...l, ...mapText(l), mask };
      return { ...l, mask };
    });
    apply({ ...d, ...extra, width: w, height: h, layers });
    setSelection(null);
  };

  const resizeCanvas = (w: number, h: number, ox: number, oy: number) =>
    transformDoc(w, h, (g, src) => g.drawImage(src, ox, oy), (l) => ({ x: l.x + ox, y: l.y + oy }));

  const resizeImage = (w: number, h: number, dpi: number) => {
    const d = cur();
    const kx = w / d.width;
    const ky = h / d.height;
    transformDoc(
      w,
      h,
      (g, src) => {
        g.imageSmoothingQuality = "high";
        g.drawImage(src, 0, 0, w, h);
      },
      (l) => ({ x: l.x * kx, y: l.y * ky, width: l.width * kx, textStyle: { ...l.textStyle, size: l.textStyle.size * Math.min(kx, ky) } }),
      { dpi }
    );
  };

  const rotateDoc = (deg: 90 | -90 | 180) => {
    const d = cur();
    const w = deg === 180 ? d.width : d.height;
    const h = deg === 180 ? d.height : d.width;
    transformDoc(
      w,
      h,
      (g, src) => {
        g.translate(w / 2, h / 2);
        g.rotate((deg * Math.PI) / 180);
        g.drawImage(src, -src.width / 2, -src.height / 2);
      },
      (l) => {
        const cx = l.x - d.width / 2;
        const cy = l.y - d.height / 2;
        const a = (deg * Math.PI) / 180;
        return { x: w / 2 + cx * Math.cos(a) - cy * Math.sin(a), y: h / 2 + cx * Math.sin(a) + cy * Math.cos(a), rotation: l.rotation + deg };
      }
    );
  };

  const flipDoc = (horizontal: boolean) => {
    const d = cur();
    transformDoc(
      d.width,
      d.height,
      (g, src) => {
        g.translate(horizontal ? d.width : 0, horizontal ? 0 : d.height);
        g.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
        g.drawImage(src, 0, 0);
      },
      (l) => (horizontal ? { x: d.width - l.x - 100 } : { y: d.height - l.y - l.textStyle.size })
    );
  };

  const flipLayer = (horizontal: boolean) =>
    processActive((c) => {
      const out = newCanvas(c.width, c.height);
      const g = ctx2d(out);
      const b = selection?.bounds || { x: 0, y: 0, w: c.width, h: c.height };
      g.translate(horizontal ? b.x * 2 + b.w : 0, horizontal ? 0 : b.y * 2 + b.h);
      g.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
      g.drawImage(c, 0, 0);
      return out;
    }, "Voltear");

  const trimTransparent = () => {
    const full = compose(cur());
    const b = maskBounds(alphaToMask(full));
    if (!b) return toast("La imagen está vacía", "info");
    resizeCanvas(b.w, b.h, -b.x, -b.y);
  };

  // ------------------------------------------------------------------------
  // Capas
  // ------------------------------------------------------------------------

  const newLayer = () => {
    const d = cur();
    insertLayer(rasterLayer(`Capa ${d.layers.length + 1}`, blankRaster(d.width, d.height)));
  };

  const duplicateLayer = () => {
    const d = cur();
    const l = activeLayer(d);
    insertLayer({ ...l, id: `${l.id}c${Date.now().toString(36)}`, name: `${l.name} copia` } as Layer);
  };

  const deleteLayer = () => {
    const d = cur();
    if (d.layers.length < 2) return;
    const idx = d.layers.findIndex((l) => l.id === d.activeId);
    const layers = d.layers.filter((l) => l.id !== d.activeId);
    apply({ ...d, layers, activeId: layers[Math.max(0, idx - 1)].id });
    setEditMask(false);
  };

  const moveLayer = (id: string, to: number) => {
    const d = cur();
    const from = d.layers.findIndex((l) => l.id === id);
    if (from < 0) return;
    const layers = [...d.layers];
    const [l] = layers.splice(from, 1);
    layers.splice(Math.max(0, Math.min(layers.length, to)), 0, l);
    apply({ ...d, layers });
  };

  const arrange = (dir: "up" | "down" | "top" | "bottom") => {
    const d = cur();
    const i = d.layers.findIndex((l) => l.id === d.activeId);
    moveLayer(d.activeId, dir === "up" ? i + 1 : dir === "down" ? i - 1 : dir === "top" ? d.layers.length : 0);
  };

  const rasterize = (id = cur().activeId) => {
    const d = cur();
    const l = d.layers.find((x) => x.id === id);
    if (!l || l.kind === "raster") return;
    if (l.kind === "adjust") return toast("Las capas de ajuste no tienen píxeles: combínalas hacia abajo", "info");
    const c = layerCanvas(d, { ...l, mask: null, style: undefined });
    if (!c) return;
    apply(updateLayer(d, id, { kind: "raster", data: fromCanvas(c) } as unknown as Partial<Layer>));
  };

  const mergeDown = () => {
    const d = cur();
    const i = d.layers.findIndex((l) => l.id === d.activeId);
    if (i < 1) return;
    const lower = d.layers[i - 1];
    const upper = d.layers[i];
    const merged = compose({ ...d, layers: [{ ...lower, opacity: 1, blend: "source-over" } as Layer, upper] });
    const layer: Layer = { ...rasterLayer(lower.name, fromCanvas(merged)), opacity: lower.opacity, blend: lower.blend };
    const layers = [...d.layers];
    layers.splice(i - 1, 2, layer);
    apply({ ...d, layers, activeId: layer.id });
  };

  const mergeVisible = () => {
    const d = cur();
    const merged = rasterLayer("Combinada", fromCanvas(compose(d)));
    apply({ ...d, layers: [...d.layers.filter((l) => !l.visible), merged], activeId: merged.id });
  };

  const flatten = () => {
    const d = cur();
    const c = newCanvas(d.width, d.height);
    const g = ctx2d(c);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, d.width, d.height);
    g.drawImage(compose(d), 0, 0);
    const l = rasterLayer("Fondo", fromCanvas(c));
    apply({ ...d, layers: [l], activeId: l.id });
    setEditMask(false);
  };

  const addMask = (fromSelection: boolean) => {
    const d = cur();
    const l = activeLayer(d);
    const c = newCanvas(d.width, d.height);
    const g = ctx2d(c);
    g.fillStyle = fromSelection && selection ? "#000" : "#fff";
    g.fillRect(0, 0, d.width, d.height);
    if (fromSelection && selection) {
      const white = newCanvas(d.width, d.height);
      const wg = ctx2d(white);
      wg.drawImage(selection.mask, 0, 0);
      wg.globalCompositeOperation = "source-in";
      wg.fillStyle = "#fff";
      wg.fillRect(0, 0, d.width, d.height);
      g.drawImage(white, 0, 0);
    }
    apply(updateLayer(d, l.id, { mask: fromCanvas(c), maskEnabled: true }));
    setSelection(null);
    setEditMask(true);
    toast("Máscara añadida: pinta en negro para ocultar y en blanco para mostrar", "info");
  };

  const applyMask = () => {
    const d = cur();
    const l = activeLayer(d);
    if (!l.mask) return;
    if (l.kind !== "raster") return apply(updateLayer(d, l.id, { mask: null }));
    const c = layerCanvas(d, { ...l, style: undefined });
    if (c) apply(updateLayer(d, l.id, { data: fromCanvas(c), mask: null } as Partial<Layer>));
    setEditMask(false);
  };

  const loadSelectionFrom = (id: string) => {
    const d = cur();
    const l = d.layers.find((x) => x.id === id);
    if (!l) return;
    const c = layerCanvas(d, l);
    if (c) setSelection(makeSelection(alphaToMask(c)));
  };

  // ------------------------------------------------------------------------
  // Portapapeles
  // ------------------------------------------------------------------------

  const copy = (merged: boolean, cut = false) => {
    const d = cur();
    const src = merged ? compose(d) : activeRaster()?.canvas;
    if (!src) return;
    const part = selected(src);
    const b = selection?.bounds || { x: 0, y: 0, w: d.width, h: d.height };
    const c = newCanvas(b.w, b.h);
    ctx2d(c).drawImage(part, -b.x, -b.y);
    clipboard.current = c;
    c.toBlob((blob) => {
      if (blob && navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") void navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).catch(() => undefined);
    });
    if (cut && !merged) clearSelection();
    toast(cut ? "Cortado" : "Copiado");
  };

  const pasteCanvas = (c: HTMLCanvasElement, name = "Pegado") => {
    const d = cur();
    const out = newCanvas(d.width, d.height);
    const at = selection?.bounds;
    const x = at ? at.x : Math.round((d.width - c.width) / 2);
    const y = at ? at.y : Math.round((d.height - c.height) / 2);
    ctx2d(out).drawImage(c, x, y);
    addPixelLayer(out, name);
    setTool("move");
  };

  const paste = async () => {
    try {
      if (navigator.clipboard && "read" in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith("image/"));
          if (type) {
            const blob = await item.getType(type);
            pasteCanvas(await bytesToCanvas(new Uint8Array(await blob.arrayBuffer()), "pegado.png"));
            return;
          }
        }
      }
    } catch {
      /* sin permiso: se usa el portapapeles interno */
    }
    if (clipboard.current) pasteCanvas(clipboard.current);
  };

  // Pegar imágenes con Ctrl+V desde otras aplicaciones
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!sd.docRef.current || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      void file.arrayBuffer().then((buf) => bytesToCanvas(new Uint8Array(buf), file.name).then((c) => pasteCanvas(c)));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const clearSelection = () => {
    const a = activeRaster();
    if (!a) return;
    const c = newCanvas(a.canvas.width, a.canvas.height);
    const g = ctx2d(c);
    g.drawImage(a.canvas, 0, 0);
    g.globalCompositeOperation = "destination-out";
    if (selection) g.drawImage(selection.mask, 0, 0);
    else g.fillRect(0, 0, c.width, c.height);
    commitPixels(a.layer.id, c, "pixels", "Borrar");
  };

  const fillSelection = (color: string) => {
    const d = cur();
    if (editMask) {
      const l = activeLayer(d);
      const base = newCanvas(d.width, d.height);
      const g = ctx2d(base);
      const m = getCanvas(l.mask);
      if (m) g.drawImage(m, 0, 0);
      const fill = rectMask(d.width, d.height, { x: 0, y: 0, w: d.width, h: d.height }, false);
      const fg2 = ctx2d(fill);
      fg2.globalCompositeOperation = "source-in";
      fg2.fillStyle = color;
      fg2.fillRect(0, 0, d.width, d.height);
      commitPixels(l.id, mergeInSelection(base, fill, selection), "mask", "Rellenar");
      return;
    }
    processActive((c) => {
      const out = newCanvas(c.width, c.height);
      const g = ctx2d(out);
      g.drawImage(c, 0, 0);
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      return out;
    }, "Rellenar");
  };

  // ------------------------------------------------------------------------
  // Relleno según el contenido e IA
  // ------------------------------------------------------------------------

  const runBusy = (msg: string, fn: () => void | Promise<void>) => {
    setBusy(msg);
    window.setTimeout(async () => {
      try {
        await fn();
      } catch (err) {
        await showMessage("No se pudo completar", err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    }, 30);
  };

  const contentAware = () => {
    if (!selection) return void showMessage("Relleno según el contenido", "Primero selecciona lo que quieres quitar (por ejemplo, con el lazo).");
    const a = activeRaster();
    if (!a) return;
    runBusy("Rellenando según el contenido…", () => {
      const grown = growMask(selection.mask, 3);
      commitPixels(a.layer.id, contentAwareFill(a.canvas, featherMask(grown, 2)), "pixels", "Relleno según el contenido");
      setSelection(null);
    });
  };

  const aiStart = async (mode: "fill" | "generate") => {
    if (mode === "fill" && !selection) return void showMessage("Relleno generativo", "Primero selecciona la zona que quieres rellenar.");
    if (!(await ensureAddon(AI_ADDON, "CoffeePhoto"))) return;
    if (!loadAiSettings().apiKey) {
      setDialog({ kind: "aiSettings" });
      toast("Configura el servicio de IA para continuar", "info");
      return;
    }
    setDialog({ kind: "aiPrompt", mode });
  };

  const aiRun = (mode: "fill" | "generate", prompt: string, size: "1024x1024" | "1536x1024" | "1024x1536") => {
    setDialog(null);
    runBusy(mode === "fill" ? "Generando el relleno…" : "Generando la imagen…", async () => {
      const s = loadAiSettings();
      const d = cur();
      if (mode === "fill" && selection) {
        const res = await generativeFill(s, compose(d), selection.mask, selection.bounds, prompt);
        addPixelLayer(res, prompt ? `IA: ${prompt.slice(0, 20)}` : "Relleno generativo");
        setSelection(null);
      } else {
        const img = await generateImage(s, prompt, size);
        const c = newCanvas(d.width, d.height);
        const k = Math.min(d.width / img.width, d.height / img.height);
        ctx2d(c).drawImage(img, (d.width - img.width * k) / 2, (d.height - img.height * k) / 2, img.width * k, img.height * k);
        addPixelLayer(c, `IA: ${prompt.slice(0, 20)}`);
      }
      toast("Listo: se añadió como una capa nueva");
    });
  };

  // ------------------------------------------------------------------------
  // Ajustes y filtros (con vista previa)
  // ------------------------------------------------------------------------

  const openAdjust = (kind: AdjustKind, asLayer: boolean) => {
    if (!asLayer && !activeRaster()) return;
    setDialog({ kind: "adjust", adj: defaultAdjustment(kind), asLayer, layerId: null });
  };

  const editAdjustLayer = (id: string) => {
    const l = cur().layers.find((x) => x.id === id);
    if (l?.kind === "adjust") setDialog({ kind: "adjust", adj: l.adjust, asLayer: true, layerId: id });
  };

  const adjustPreview = (adj: Adjustment) => {
    if (dialog?.kind !== "adjust") return;
    const d = cur();
    if (dialog.asLayer) {
      if (dialog.layerId) setPreviewDoc(updateLayer(d, dialog.layerId, { adjust: adj } as Partial<Layer>));
      else {
        const idx = d.layers.findIndex((l) => l.id === d.activeId);
        const layers = [...d.layers];
        layers.splice(idx + 1, 0, adjustLayer("vista previa", adj));
        setPreviewDoc({ ...d, layers });
      }
    } else {
      const a = activeRaster(false);
      if (a) setPreviewOverride({ id: a.layer.id, canvas: mergeInSelection(a.canvas, adjustCanvas(a.canvas, adj), selection) });
    }
  };

  const adjustApply = (adj: Adjustment) => {
    if (dialog?.kind !== "adjust") return;
    setPreviewDoc(null);
    setPreviewOverride(null);
    const d = cur();
    if (dialog.asLayer) {
      if (dialog.layerId) apply(updateLayer(d, dialog.layerId, { adjust: adj } as Partial<Layer>));
      else {
        const l = adjustLayer(ADJUST_LABELS[adj.kind], adj);
        if (selection) {
          // La selección se convierte en la máscara de la capa de ajuste
          const m = newCanvas(d.width, d.height);
          const g = ctx2d(m);
          g.fillStyle = "#000";
          g.fillRect(0, 0, d.width, d.height);
          const sel = alphaToMask(selection.mask);
          g.drawImage(sel, 0, 0);
          l.mask = fromCanvas(m);
          setSelection(null);
        }
        insertLayer(l, d);
      }
    } else processActive((c) => adjustCanvas(c, adj), ADJUST_LABELS[adj.kind]);
    setDialog(null);
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewOverride(null);
    setDialog(null);
  };

  const runFilter = (kind: FilterKind) => {
    if (!activeRaster()) return;
    if (kind === "sharpen" || kind === "emboss" || kind === "edges") return runBusy("Aplicando filtro…", () => processActive((c) => applyFilter(c, kind), FILTER_LABELS[kind]));
    setDialog({ kind: "filter", filter: kind });
  };

  const filterPreview = (kind: FilterKind, p: FilterParams) => {
    const a = activeRaster(false);
    if (!a) return;
    // Los filtros lentos se previsualizan solo si la imagen es pequeña
    if ((kind === "denoise" || kind === "oil") && a.canvas.width * a.canvas.height > 1_500_000) return;
    setPreviewOverride({ id: a.layer.id, canvas: mergeInSelection(a.canvas, applyFilter(a.canvas, kind, p), selection) });
  };

  // ------------------------------------------------------------------------
  // Transformación libre
  // ------------------------------------------------------------------------

  const startTransform = () => {
    const a = activeRaster();
    if (!a) return;
    const d = cur();
    let source = a.canvas;
    let rest: HTMLCanvasElement | null = null;
    if (selection) {
      source = selected(a.canvas);
      rest = newCanvas(d.width, d.height);
      const g = ctx2d(rest);
      g.drawImage(a.canvas, 0, 0);
      g.globalCompositeOperation = "destination-out";
      g.drawImage(selection.mask, 0, 0);
    }
    const box = maskBounds(alphaToMask(source));
    if (!box) return toast("La capa está vacía", "info");
    setTransform({ layerId: a.layer.id, source, rest, box, tx: 0, ty: 0, sx: 1, sy: 1, angle: 0 });
    setTool("move");
    toast("Arrastra los tiradores; fuera del cuadro, gira. Intro aplica, Esc cancela.", "info");
  };

  // ------------------------------------------------------------------------
  // Archivo
  // ------------------------------------------------------------------------

  const placeImage = async () => {
    const file = await pickOpenFile([{ name: "Imágenes", extensions: [...IMAGE_EXTENSIONS, ...RAW_EXTENSIONS] }], "Colocar imagen");
    if (!file) return;
    try {
      const c = isRaw(file.name) ? await decodeRaw(file.bytes, file.name, "CoffeePhoto") : await bytesToCanvas(file.bytes, file.name);
      if (!c) return;
      const d = cur();
      const k = Math.min(1, d.width / c.width, d.height / c.height);
      const fitC = newCanvas(Math.round(c.width * k), Math.round(c.height * k));
      ctx2d(fitC).drawImage(c, 0, 0, fitC.width, fitC.height);
      pasteCanvas(fitC, file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      await showMessage("No se pudo abrir la imagen", err instanceof Error ? err.message : String(err));
    }
  };

  const doExport = async (format: ExportFormat, o: { quality: number; scale: number; background: string }) => {
    setDialog(null);
    runBusy("Exportando…", async () => {
      const blob = await exportDocument(cur(), format, o);
      const ext = format === "layers" ? "zip" : format;
      const names: Record<string, string> = { png: "Imagen PNG", jpg: "Imagen JPG", webp: "Imagen WebP", pdf: "Documento PDF", zip: "Archivo ZIP" };
      const path = await saveFileAs(`${sd.title || "Imagen"}.${ext}`, [{ name: names[ext], extensions: [ext] }], blob, "Exportar");
      if (path !== null) toast("Exportado");
    });
  };

  // ------------------------------------------------------------------------
  // Selección
  // ------------------------------------------------------------------------

  const selectAll = () => {
    const d = cur();
    setSelection(makeSelection(rectMask(d.width, d.height, { x: 0, y: 0, w: d.width, h: d.height }, false)));
  };

  const modifySelection = async (kind: "feather" | "grow" | "shrink") => {
    if (!selection) return;
    const v = await askText({ title: kind === "feather" ? "Calar selección" : kind === "grow" ? "Expandir selección" : "Contraer selección", label: "Píxeles", defaultValue: kind === "feather" ? "10" : "5" });
    const n = Number(v);
    if (!v || !Number.isFinite(n) || n <= 0) return;
    const m = kind === "feather" ? featherMask(selection.mask, n) : growMask(selection.mask, kind === "grow" ? n : -n);
    setSelection(makeSelection(m));
  };

  // ------------------------------------------------------------------------
  // Atajos de teclado
  // ------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sd.docRef.current || sd.showStart || dialog || document.querySelector("[data-modal-open]")) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod) {
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? sd.redo() : sd.undo()),
          y: () => sd.redo(),
          s: () => (e.shiftKey ? void sd.saveAs() : void sd.flush().then(() => toast("Guardado"))),
          o: () => void sd.open(),
          n: () => (e.shiftKey ? newLayer() : setDialog({ kind: "new" })),
          a: selectAll,
          d: () => setSelection(null),
          i: () => (e.shiftKey ? setSelection(makeSelection(invertMask(selection?.mask || null, cur().width, cur().height))) : openAdjust("invert", false)),
          j: duplicateLayer,
          e: () => (e.shiftKey ? mergeVisible() : mergeDown()),
          t: startTransform,
          c: () => copy(e.shiftKey),
          x: () => copy(false, true),
          v: () => void paste(),
          l: () => openAdjust("levels", false),
          m: () => openAdjust("curves", false),
          u: () => openAdjust("hsl", false),
          "0": () => canvasRef.current?.fit(),
          "1": () => canvasRef.current?.actual(),
          "=": () => canvasRef.current?.zoomBy(1.25),
          "+": () => canvasRef.current?.zoomBy(1.25),
          "-": () => canvasRef.current?.zoomBy(0.8),
          k: () => setCommandOpen(true),
        };
        if (e.shiftKey && k === "e" && e.altKey) return;
        const fn = map[k];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (e.altKey) fillSelection(fg);
        else clearSelection();
        return;
      }
      if (e.shiftKey && e.key === "F5") return contentAware();
      if (k === "x") return setFg(bg), setBg(fg);
      if (k === "d") return setFg("#000000"), setBg("#ffffff");
      if (k === "[" || k === "]") {
        const delta = k === "]" ? 1.15 : 1 / 1.15;
        const key = tool === "eraser" ? "eraser" : tool === "clone" ? "clone" : tool === "heal" ? "heal" : tool === "dodge" || tool === "burn" ? "tone" : tool === "blurTool" ? "blur" : "brush";
        setOpts((o) => ({ ...o, [key]: { ...o[key], size: Math.max(1, Math.min(1000, Math.round(o[key].size * delta + (k === "]" ? 1 : -1)))) } }));
        return;
      }
      const sameKey = TOOLS.filter((t) => t.key.toLowerCase() === k);
      if (sameKey.length) {
        const i = sameKey.findIndex((t) => t.id === tool);
        setTool(sameKey[e.shiftKey ? (i + 1) % sameKey.length : i >= 0 ? i : 0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------------
  // Menús
  // ------------------------------------------------------------------------

  const menus: MenuDefinition[] = useMemo(() => {
    if (!doc) return [];
    const adjItems = (asLayer: boolean): MenuEntry[] => ADJUST_MENU.map((k) => ({ label: `${asLayer ? "Capa de ajuste: " : ""}${ADJUST_LABELS[k]}…`, action: () => openAdjust(k, asLayer) }));
    return [
      {
        id: "file",
        label: "Archivo",
        items: [
          { label: "Nuevo…", icon: FilePlus, shortcut: "Ctrl+N", action: () => setDialog({ kind: "new" }) },
          { label: "Abrir…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
          { label: "Colocar imagen como capa…", action: () => void placeImage() },
          { divider: true },
          { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
          { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void sd.saveAs() },
          { label: "Exportar…", icon: Download, shortcut: "Ctrl+Mayús+E", action: () => setDialog({ kind: "export" }) },
          { divider: true },
          { label: "Pantalla de inicio", icon: Home, action: () => sd.setShowStart(true) },
        ],
      },
      {
        id: "edit",
        label: "Edición",
        items: [
          { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: sd.undo, disabled: !sd.canUndo },
          { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Mayús+Z", action: sd.redo, disabled: !sd.canRedo },
          { divider: true },
          { label: "Cortar", icon: Scissors, shortcut: "Ctrl+X", action: () => copy(false, true) },
          { label: "Copiar", icon: Copy, shortcut: "Ctrl+C", action: () => copy(false) },
          { label: "Copiar combinado", shortcut: "Ctrl+Mayús+C", action: () => copy(true) },
          { label: "Pegar", icon: ClipboardPaste, shortcut: "Ctrl+V", action: () => void paste() },
          { label: "Borrar", shortcut: "Supr", action: clearSelection },
          { divider: true },
          { label: "Rellenar con el color frontal", shortcut: "Alt+Supr", action: () => fillSelection(fg) },
          { label: "Rellenar con el color de fondo", action: () => fillSelection(bg) },
          { label: "Relleno según el contenido", icon: Wand2, shortcut: "Mayús+F5", action: contentAware },
          { divider: true },
          { label: "Relleno generativo (IA)…", icon: Sparkles, action: () => void aiStart("fill") },
          { label: "Generar imagen (IA)…", icon: Sparkles, action: () => void aiStart("generate") },
          { label: "Configurar IA generativa…", action: () => setDialog({ kind: "aiSettings" }) },
          { divider: true },
          { label: "Transformación libre", shortcut: "Ctrl+T", action: startTransform },
          { label: "Voltear capa horizontalmente", action: () => flipLayer(true) },
          { label: "Voltear capa verticalmente", action: () => flipLayer(false) },
        ],
      },
      {
        id: "image",
        label: "Imagen",
        items: [
          ...adjItems(false),
          { divider: true },
          { label: "Tamaño de imagen…", action: () => setDialog({ kind: "size", mode: "image" }) },
          { label: "Tamaño de lienzo…", action: () => setDialog({ kind: "size", mode: "canvas" }) },
          { label: "Girar 90° a la derecha", action: () => rotateDoc(90) },
          { label: "Girar 90° a la izquierda", action: () => rotateDoc(-90) },
          { label: "Girar 180°", action: () => rotateDoc(180) },
          { label: "Voltear lienzo horizontalmente", action: () => flipDoc(true) },
          { label: "Voltear lienzo verticalmente", action: () => flipDoc(false) },
          { divider: true },
          { label: "Recortar a la selección", action: () => selection && resizeCanvas(selection.bounds.w, selection.bounds.h, -selection.bounds.x, -selection.bounds.y), disabled: !selection },
          { label: "Quitar bordes transparentes", action: trimTransparent },
        ],
      },
      {
        id: "layer",
        label: "Capa",
        items: [
          { label: "Nueva capa", shortcut: "Ctrl+Mayús+N", action: newLayer },
          { label: "Duplicar capa", shortcut: "Ctrl+J", action: duplicateLayer },
          { label: "Eliminar capa", action: deleteLayer, disabled: doc.layers.length < 2 },
          { divider: true },
          ...adjItems(true),
          { divider: true },
          { label: "Añadir máscara (mostrar todo)", action: () => addMask(false) },
          { label: "Añadir máscara desde la selección", action: () => addMask(true), disabled: !selection },
          { label: editMask ? "Editar la capa (no la máscara)" : "Editar la máscara", action: () => setEditMask(!editMask), disabled: !active?.mask, checked: editMask },
          { label: "Aplicar máscara", action: applyMask, disabled: !active?.mask },
          { label: "Eliminar máscara", action: () => (updateLayerProp(cur().activeId, { mask: null }), setEditMask(false)), disabled: !active?.mask },
          { divider: true },
          { label: "Rasterizar capa", action: () => rasterize(), disabled: active?.kind !== "text" },
          { label: "Combinar hacia abajo", shortcut: "Ctrl+E", action: mergeDown },
          { label: "Combinar visibles", shortcut: "Ctrl+Mayús+E", action: mergeVisible },
          { label: "Acoplar imagen", action: flatten },
          { divider: true },
          { label: "Traer al frente", action: () => arrange("top") },
          { label: "Subir", action: () => arrange("up") },
          { label: "Bajar", action: () => arrange("down") },
          { label: "Enviar al fondo", action: () => arrange("bottom") },
        ],
      },
      {
        id: "select",
        label: "Selección",
        items: [
          { label: "Todo", shortcut: "Ctrl+A", action: selectAll },
          { label: "Deseleccionar", shortcut: "Ctrl+D", action: () => setSelection(null) },
          { label: "Invertir", shortcut: "Ctrl+Mayús+I", action: () => setSelection(makeSelection(invertMask(selection?.mask || null, doc.width, doc.height))) },
          { divider: true },
          { label: "Calar…", action: () => void modifySelection("feather"), disabled: !selection },
          { label: "Expandir…", action: () => void modifySelection("grow"), disabled: !selection },
          { label: "Contraer…", action: () => void modifySelection("shrink"), disabled: !selection },
          { label: "Cargar desde la capa", action: () => loadSelectionFrom(doc.activeId) },
        ],
      },
      {
        id: "filter",
        label: "Filtro",
        items: (Object.keys(FILTER_LABELS) as FilterKind[]).map((k) => ({ label: FILTER_LABELS[k], action: () => runFilter(k) })),
      },
      {
        id: "view",
        label: "Vista",
        items: [
          { label: "Acercar", icon: ZoomIn, shortcut: "Ctrl++", action: () => canvasRef.current?.zoomBy(1.25) },
          { label: "Alejar", icon: ZoomOut, shortcut: "Ctrl+-", action: () => canvasRef.current?.zoomBy(0.8) },
          { label: "Ajustar a la pantalla", icon: Maximize, shortcut: "Ctrl+0", action: () => canvasRef.current?.fit() },
          { label: "Tamaño real (100 %)", shortcut: "Ctrl+1", action: () => canvasRef.current?.actual() },
          { label: "Cuadrícula", icon: Grid3x3, checked: showGrid, action: () => setShowGrid(!showGrid) },
          { label: "Buscar comandos…", shortcut: "Ctrl+K", action: () => setCommandOpen(true) },
        ],
      },
      {
        id: "help",
        label: "Ayuda",
        items: [
          {
            label: "Atajos de teclado",
            icon: Keyboard,
            action: () =>
              void showMessage(
                "Atajos de teclado",
                "Herramientas: V mover · M marco · L lazo · W varita · C recortar · I cuentagotas · J corrector · B pincel/lápiz · S tampón · E borrador · G degradado/bote · R desenfocar · O sobreexponer/subexponer · T texto · U formas · H mano · Z zoom (Mayús+tecla alterna).\n\n[ y ] tamaño del pincel · X intercambiar colores · D colores por defecto · Espacio: mano · Supr: borrar · Alt+Supr: rellenar · Mayús+F5: relleno según el contenido.\n\nCtrl+T transformar · Ctrl+J duplicar capa · Ctrl+E combinar · Ctrl+A/D seleccionar todo/nada · Ctrl+Mayús+I invertir · Ctrl+L niveles · Ctrl+M curvas · Ctrl+U tono/saturación · Ctrl+I invertir colores · Ctrl+0 ajustar · Ctrl+1 100 %."
              ),
          },
          { label: "Acerca de CoffeePhoto", icon: Info, action: () => void showMessage("CoffeePhoto", "Edición de imágenes y retoque fotográfico de la suite CoffeeWorks: capas, máscaras, selecciones, pinceles, ajustes, filtros, texto, relleno según el contenido e IA generativa (complemento).") },
        ],
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, selection, editMask, showGrid, fg, bg, sd.canUndo, sd.canRedo, active]);

  // ------------------------------------------------------------------------
  // Interfaz
  // ------------------------------------------------------------------------

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeephoto">
      <style>{STUDIO_CSS}</style>
      {doc && shown && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Imagen sin título"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <Button primary accent={ACCENT} onClick={() => setDialog({ kind: "export" })}>
                <Download size={13} /> Exportar
              </Button>
            }
          />
          <OptionsBar
            tool={tool}
            opts={opts}
            onOpts={setOpts}
            extra={
              transform ? (
                <div className="flex gap-2">
                  <Button onClick={() => setTransform(null)}>Cancelar</Button>
                  <Button primary accent={ACCENT} onClick={() => canvasRef.current?.applyTransform()}>
                    Aplicar transformación
                  </Button>
                </div>
              ) : null
            }
          />
          <div className="flex-1 flex min-h-0">
            <ToolBar
              tool={tool}
              onTool={setTool}
              fg={fg}
              bg={bg}
              onFg={setFg}
              onBg={setBg}
              onSwap={() => {
                setFg(bg);
                setBg(fg);
              }}
              onReset={() => {
                setFg("#000000");
                setBg("#ffffff");
              }}
              editMask={editMask}
            />
            <Canvas
              ref={canvasRef}
              doc={shown}
              selection={selection}
              tool={tool}
              opts={opts}
              fg={fg}
              bg={bg}
              view={view}
              setView={setView}
              actions={actions}
              editMask={editMask}
              transform={transform}
              editingText={null}
              showGrid={showGrid}
              previewOverride={previewOverride}
            />
            <aside className="w-[280px] shrink-0 bg-[#202023] border-l border-black/50 overflow-y-auto" data-right-panel>
              <ColorPanel fg={fg} onFg={setFg} />
              {active?.kind === "text" && <TextProperties layer={active} onChange={(patch, key) => updateLayerProp(active.id, patch, key)} fonts={FONTS} />}
              {active?.kind === "adjust" && (
                <div className="px-3 py-2 border-b border-black/40 flex items-center justify-between">
                  <span className="text-[12px]">{ADJUST_LABELS[active.adjust.kind]}</span>
                  <Button onClick={() => editAdjustLayer(active.id)}>Editar ajuste…</Button>
                </div>
              )}
              {active && active.kind !== "adjust" && <LayerStyleProperties layer={active} onChange={(patch, key) => updateLayerProp(active.id, patch, key)} />}
              <LayersPanel
                doc={doc}
                version={pixelVersion}
                onSelect={(id) => {
                  if (id !== doc.activeId) {
                    apply({ ...cur(), activeId: id }, "select");
                    setEditMask(false);
                  }
                  const l = doc.layers.find((x) => x.id === id);
                  if (l?.kind === "adjust" && id === doc.activeId) editAdjustLayer(id);
                }}
                onUpdate={updateLayerProp}
                onAdd={newLayer}
                onDuplicate={duplicateLayer}
                onDelete={deleteLayer}
                onMove={moveLayer}
                onAddMask={() => addMask(!!selection)}
                onAdjustMenu={() => openAdjust("brightness", true)}
                onMaskClick={(id) => {
                  if (id !== doc.activeId) apply({ ...cur(), activeId: id }, "select");
                  setEditMask(true);
                }}
                onLoadSelection={loadSelectionFrom}
                onImport={() => void placeImage()}
                editMask={editMask}
              />
            </aside>
          </div>
          <footer className="h-6 shrink-0 bg-[#1c1c1f] border-t border-black/50 flex items-center gap-4 px-3 text-[11px] text-[#9a9aa2] font-mono" data-status>
            <span>{Math.round(view.zoom * 100)} %</span>
            <span>
              {doc.width} × {doc.height} px · {doc.dpi} ppp
            </span>
            <span>{doc.layers.length} capas</span>
            {selection && (
              <span>
                Selección: {selection.bounds.w} × {selection.bounds.h}
              </span>
            )}
            <span className="flex-1" />
            {editMask && <span className="text-[#ffb4a6]">Editando máscara de «{active?.name}»</span>}
          </footer>
        </>
      )}

      {dialog?.kind === "new" && (
        <NewDocDialog
          onCancel={() => setDialog(null)}
          onCreate={(w, h, dpi, bgc, name) => {
            setDialog(null);
            const d = newDocument(w, h, bgc);
            void sd.newDocument(name, { ...d, dpi });
          }}
        />
      )}
      {dialog?.kind === "adjust" && doc && (
        <AdjustDialog
          initial={dialog.adj}
          asLayer={dialog.asLayer}
          histogram={histogram(ctx2d(compose(doc)).getImageData(0, 0, doc.width, doc.height))}
          onPreview={adjustPreview}
          onApply={adjustApply}
          onCancel={closePreview}
        />
      )}
      {dialog?.kind === "filter" && (
        <FilterDialog
          kind={dialog.filter}
          onPreview={(p) => filterPreview(dialog.filter, p)}
          onApply={(p) => {
            const k = dialog.filter;
            closePreview();
            runBusy("Aplicando filtro…", () => processActive((c) => applyFilter(c, k, p), FILTER_LABELS[k]));
          }}
          onCancel={closePreview}
        />
      )}
      {dialog?.kind === "size" && doc && (
        <SizeDialog
          mode={dialog.mode}
          width={doc.width}
          height={doc.height}
          dpi={doc.dpi}
          onCancel={() => setDialog(null)}
          onApply={(w, h, x) => {
            setDialog(null);
            if (dialog.mode === "image") resizeImage(w, h, x.dpi);
            else {
              const ax = x.anchor.includes("w") ? 0 : x.anchor.includes("e") ? w - doc.width : (w - doc.width) / 2;
              const ay = x.anchor.includes("n") ? 0 : x.anchor.includes("s") ? h - doc.height : (h - doc.height) / 2;
              resizeCanvas(w, h, Math.round(ax), Math.round(ay));
            }
          }}
        />
      )}
      {dialog?.kind === "export" && doc && <ExportDialog width={doc.width} height={doc.height} onCancel={() => setDialog(null)} onExport={(f, o) => void doExport(f, o)} />}
      {dialog?.kind === "aiSettings" && (
        <AiSettingsDialog
          settings={loadAiSettings()}
          onCancel={() => setDialog(null)}
          onSave={(s) => {
            saveAiSettings(s);
            setDialog(null);
            toast("Configuración de IA guardada");
          }}
        />
      )}
      {dialog?.kind === "aiPrompt" && <AiPromptDialog mode={dialog.mode} onCancel={() => setDialog(null)} onSettings={() => setDialog({ kind: "aiSettings" })} onRun={(p, s) => aiRun(dialog.mode, p, s)} />}

      {busy && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center" data-busy>
          <div className="bg-[#26262b] rounded-lg px-5 py-3 text-sm shadow-2xl flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {busy}
          </div>
        </div>
      )}

      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />

      {sd.showStart && (
        <StartScreen
          appName="CoffeePhoto"
          tagline="Edición de imágenes y retoque fotográfico • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Lienzo en blanco o tamaño para redes"
          openHint="Abrir una imagen (PNG, JPG, WebP, RAW) o un .cph"
          formats={[".cph", ".png", ".jpg", ".webp", "RAW"]}
          recents={sd.recents}
          onNew={() => setDialog({ kind: "new" })}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={doc ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};
