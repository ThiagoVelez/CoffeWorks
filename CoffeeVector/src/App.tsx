import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Scissors, Copy, ClipboardPaste, Group, Ungroup, Keyboard, Info, ZoomIn, ZoomOut, Maximize, Grid3x3, ScanLine, Image as ImageIcon } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, showMessage, toast } from "./studio/Dialogs";
import { createDocStore, downloadBlob } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, Modal, NumberField, STUDIO_CSS, Select, Slider, Toggle } from "./studio/ui";
import { extensionOf, isTauri, pickOpenFile, saveFileAs } from "./studio/desktop";
import { makeZip } from "./studio/zip";
import { traceImage, type TraceOptions } from "./studio/trace";
import { Canvas, type CanvasHandle, type NodeRef, type ShapeOptions, type View } from "./components/Canvas";
import { AlignPanel, ArtboardsPanel, LayersPanel, PropertiesPanel, TOOLS, ToolBar } from "./components/Panels";
import { ACCENT, ACCENT_DARK, type Artboard, type Bounds, type Paint, type PathObj, type StrokeStyle, type Tool, type VDoc, type VObject } from "./types";
import { arrange, artboard, cloneObject, findObject, group, mapObjects, newDocument, parseDocument, removeObjects, selectionBounds, serializeDocument, ungroup } from "./services/model";
import { boundsCenter, flipObject, objectBounds, rotateObject, scaleObject, simplify, smoothNodes, translateObject, flatten } from "./services/geom";
import { exportSvg, imageObject, importSvg } from "./services/svg";
import { exportPdf, exportRaster } from "./services/exporters";
import { pathfinder, type PathfinderOp } from "./services/pathfinder";

const store = createDocStore<VDoc>({
  appId: "coffeevector",
  extension: "cvc",
  category: "Ilustración",
  defaultTitle: "Ilustración sin título",
  kindLabel: "Ilustraciones de CoffeeVector",
  serialize: serializeDocument,
  parse: parseDocument,
  create: () => newDocument(),
});

const FONTS = ["Hanken Grotesk", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS", "Impact", "Segoe UI", "JetBrains Mono"];

const PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: "Logotipo (1000 × 1000)", w: 1000, h: 1000 },
  { label: "Publicación de Instagram (1080 × 1080)", w: 1080, h: 1080 },
  { label: "Historia (1080 × 1920)", w: 1080, h: 1920 },
  { label: "Carta (816 × 1056)", w: 816, h: 1056 },
  { label: "A4 (794 × 1123)", w: 794, h: 1123 },
  { label: "Cartel A3 (1123 × 1587)", w: 1123, h: 1587 },
  { label: "Tarjeta de visita (1050 × 600)", w: 1050, h: 600 },
  { label: "Icono (512 × 512)", w: 512, h: 512 },
  { label: "Web (1440 × 900)", w: 1440, h: 900 },
  { label: "Presentación (1920 × 1080)", w: 1920, h: 1080 },
];

type DialogState = { kind: "new" } | { kind: "export" } | { kind: "trace"; img: HTMLCanvasElement; name: string } | null;

const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

async function fileToDataUrl(bytes: Uint8Array, name: string): Promise<string> {
  const ext = extensionOf(name);
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }));
  });
}

async function dataUrlSize(url: string): Promise<{ w: number; h: number; img: HTMLImageElement }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { w: img.naturalWidth, h: img.naturalHeight, img };
}

export const App: React.FC = () => {
  const canvasRef = useRef<CanvasHandle>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<string[]>([]);
  const [nodes, setNodes] = useState<NodeRef[]>([]);
  const [activeArtboard, setActiveArtboard] = useState<string | null>(null);
  const [defFill, setDefFill] = useState<Paint | null>({ type: "solid", color: "#ff7a00", opacity: 1 });
  const [defStroke, setDefStroke] = useState<StrokeStyle | null>(null);
  const [shapeOpts, setShapeOpts] = useState<ShapeOptions>({ sides: 6, points: 5, radius: 24 });
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [toArtboard, setToArtboard] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const clipboard = useRef<VObject[]>([]);

  const sd = useStudioDoc<VDoc>(store, {
    appName: "CoffeeVector",
    importExtensions: ["svg", ...imageExts],
    importFile: async (file) => {
      const ext = extensionOf(file.name);
      if (ext === "svg") {
        const { objects, width, height } = importSvg(new TextDecoder().decode(file.bytes));
        return { version: 1, artboards: [artboard("Mesa de trabajo 1", 0, 0, width, height)], objects, swatches: [] };
      }
      if (imageExts.includes(ext)) {
        const url = await fileToDataUrl(file.bytes, file.name);
        const { w, h } = await dataUrlSize(url);
        return { version: 1, artboards: [artboard("Mesa de trabajo 1", 0, 0, w, h)], objects: [imageObject(url, 0, 0, w, h)], swatches: [] };
      }
      return null;
    },
    onLoaded: (d) => {
      setSelection([]);
      setNodes([]);
      setActiveArtboard(d.artboards[0]?.id || null);
      window.setTimeout(() => canvasRef.current?.fit(d.artboards[0]), 40);
    },
    historyLimit: 100,
  });
  const doc = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = useCallback((next: VDoc, key = "") => sd.apply(next, key), [sd]);

  // La selección solo contiene objetos que existen
  useEffect(() => {
    if (!doc) return;
    const valid = selection.filter((id) => findObject(doc.objects, id));
    if (valid.length !== selection.length) setSelection(valid);
    if (activeArtboard && !doc.artboards.some((a) => a.id === activeArtboard)) setActiveArtboard(doc.artboards[0]?.id || null);
  }, [doc, selection, activeArtboard]);

  const selObjects = useMemo(() => (doc ? (selection.map((id) => findObject(doc.objects, id)).filter(Boolean) as VObject[]) : []), [doc, selection]);
  const single = selObjects.length === 1 ? selObjects[0] : null;
  const box = doc ? selectionBounds(doc, selection) : null;
  const shownFill = single && (single.type === "path" || single.type === "text") ? single.fill : defFill;
  const shownStroke = single && (single.type === "path" || single.type === "text") ? single.stroke : defStroke;

  // ------------------------------------------------------------------------
  // Operaciones
  // ------------------------------------------------------------------------

  const replaceSel = (fn: (o: VObject) => VObject, key = "") => {
    const d = cur();
    const ids = new Set(selection);
    apply({ ...d, objects: mapObjects(d.objects, (o) => (ids.has(o.id) ? fn(o) : o)) }, key);
  };

  const setFill = (p: Paint | null) => {
    if (selObjects.length) replaceSel((o) => (o.type === "path" || o.type === "text" ? { ...o, fill: p } : o.type === "group" ? { ...o, children: o.children.map((c) => (c.type === "path" || c.type === "text" ? { ...c, fill: p } : c)) } : o), "fill");
    setDefFill(p);
  };
  const setStroke = (s: StrokeStyle | null) => {
    if (selObjects.length) replaceSel((o) => (o.type === "path" || o.type === "text" ? { ...o, stroke: s } : o.type === "group" ? { ...o, children: o.children.map((c) => (c.type === "path" || c.type === "text" ? { ...c, stroke: s } : c)) } : o), "stroke");
    setDefStroke(s);
  };

  const patchObject = (id: string, patch: Partial<VObject>, key?: string) => {
    const d = cur();
    apply({ ...d, objects: mapObjects(d.objects, (o) => (o.id === id ? ({ ...o, ...patch } as VObject) : o)) }, key);
  };

  const setBox = (to: Bounds) => {
    if (!box) return;
    replaceSel((o) => scaleObject(o, box, to), "box");
  };

  const rotateSel = (deg: number) => {
    if (!box) return;
    const c = boundsCenter(box);
    replaceSel((o) => rotateObject(o, c, deg));
  };

  const flipSel = (h: boolean) => {
    if (!box) return;
    const c = boundsCenter(box);
    replaceSel((o) => flipObject(o, c, h));
  };

  const deleteSel = () => {
    if (!selection.length) return;
    if (tool === "direct" && nodes.length) {
      // Borra nodos sueltos
      const d = cur();
      const byObj = new Map<string, NodeRef[]>();
      nodes.forEach((n) => byObj.set(n.id, [...(byObj.get(n.id) || []), n]));
      apply({
        ...d,
        objects: mapObjects(d.objects, (o) => {
          const refs = byObj.get(o.id);
          if (!refs || o.type !== "path") return o;
          const subpaths = o.subpaths.map((sp, si) => ({ ...sp, nodes: sp.nodes.filter((_, ni) => !refs.some((r) => r.sub === si && r.node === ni)) })).filter((sp) => sp.nodes.length > 1);
          return subpaths.length ? { ...o, subpaths } : null;
        }),
      });
      setNodes([]);
      return;
    }
    apply(removeObjects(cur(), new Set(selection)));
    setSelection([]);
  };

  const copySel = (cut = false) => {
    clipboard.current = selObjects.map((o) => JSON.parse(JSON.stringify(o)));
    // También como SVG en el portapapeles del sistema
    try {
      void navigator.clipboard?.writeText(exportSvg({ ...cur(), objects: clipboard.current }, null, true));
    } catch {
      /* sin permiso */
    }
    if (cut) deleteSel();
  };

  const paste = (inPlace = false) => {
    if (!clipboard.current.length) return;
    const copies = clipboard.current.map((o) => (inPlace ? cloneObject(o) : translateObject(cloneObject(o), 20, 20)));
    const d = cur();
    apply({ ...d, objects: [...d.objects, ...copies] });
    setSelection(copies.map((c) => c.id));
    if (!inPlace) clipboard.current = copies.map((o) => JSON.parse(JSON.stringify(o)));
  };

  const duplicate = () => {
    if (!selObjects.length) return;
    const copies = selObjects.map((o) => translateObject(cloneObject(o), 20, 20));
    const d = cur();
    apply({ ...d, objects: [...d.objects, ...copies] });
    setSelection(copies.map((c) => c.id));
  };

  const doGroup = (clip = false) => {
    const r = group(cur(), selection, clip);
    if (!r) return toast(clip ? "Selecciona la forma de recorte (encima) y los objetos" : "Selecciona objetos para agrupar", "info");
    apply(r.doc);
    setSelection([r.id]);
  };

  const doUngroup = () => {
    const r = ungroup(cur(), selection);
    apply(r.doc);
    setSelection(r.ids);
  };

  const doArrange = (how: "front" | "forward" | "backward" | "back") => apply(arrange(cur(), selection, how));

  const align = (k: string) => {
    const d = cur();
    const target = toArtboard || selObjects.length === 1 ? d.artboards.find((a) => a.id === activeArtboard) || d.artboards[0] : box;
    if (!target || !selObjects.length) return;
    const items = selObjects.map((o) => ({ o, b: objectBounds(o)! })).filter((x) => x.b);
    const moves = new Map<string, VObject>();
    if (k === "hdist" || k === "vdist") {
      if (items.length < 3) return toast("Selecciona al menos tres objetos para distribuir", "info");
      const horiz = k === "hdist";
      const sorted = [...items].sort((a, b) => (horiz ? a.b.x - b.b.x : a.b.y - b.b.y));
      const total = sorted.reduce((s, x) => s + (horiz ? x.b.w : x.b.h), 0);
      const first = sorted[0].b;
      const last = sorted[sorted.length - 1].b;
      const span = horiz ? last.x + last.w - first.x : last.y + last.h - first.y;
      const gap = (span - total) / (sorted.length - 1);
      let pos = horiz ? first.x : first.y;
      for (const x of sorted) {
        moves.set(x.o.id, translateObject(x.o, horiz ? pos - x.b.x : 0, horiz ? 0 : pos - x.b.y));
        pos += (horiz ? x.b.w : x.b.h) + gap;
      }
    } else
      for (const { o, b } of items) {
        let dx = 0;
        let dy = 0;
        if (k === "left") dx = target.x - b.x;
        if (k === "right") dx = target.x + target.w - b.x - b.w;
        if (k === "hcenter") dx = target.x + target.w / 2 - b.x - b.w / 2;
        if (k === "top") dy = target.y - b.y;
        if (k === "bottom") dy = target.y + target.h - b.y - b.h;
        if (k === "vcenter") dy = target.y + target.h / 2 - b.y - b.h / 2;
        moves.set(o.id, translateObject(o, dx, dy));
      }
    apply({ ...d, objects: d.objects.map((o) => moves.get(o.id) || o) });
  };

  const doPathfinder = (op: PathfinderOp) => {
    const d = cur();
    const objs = d.objects.filter((o) => selection.includes(o.id));
    const res = pathfinder(objs, op);
    if (!res) return toast("Selecciona al menos dos trazados", "info");
    const idx = Math.max(...objs.map((o) => d.objects.indexOf(o)));
    const objects = d.objects.filter((o) => !selection.includes(o.id));
    objects.splice(idx - objs.length + 1, 0, res);
    apply({ ...d, objects });
    setSelection([res.id]);
  };

  const joinPaths = () => {
    const paths = selObjects.filter((o): o is PathObj => o.type === "path");
    if (!paths.length) return;
    if (paths.length === 1) {
      // Cerrar el trazado abierto
      replaceSel((o) => (o.type === "path" ? { ...o, subpaths: o.subpaths.map((s) => ({ ...s, closed: true })) } : o));
      return;
    }
    const [a, b] = paths;
    const sa = a.subpaths[a.subpaths.length - 1];
    const sb = b.subpaths[0];
    const joined = { ...a, subpaths: [...a.subpaths.slice(0, -1), { closed: false, nodes: [...sa.nodes, ...sb.nodes] }, ...b.subpaths.slice(1)] };
    const d = cur();
    apply({ ...d, objects: mapObjects(d.objects, (o) => (o.id === a.id ? joined : o.id === b.id ? null : o)) });
    setSelection([a.id]);
  };

  const simplifyPaths = () =>
    replaceSel((o) =>
      o.type !== "path"
        ? o
        : {
            ...o,
            subpaths: o.subpaths.map((sp) => {
              const pts = simplify(flatten(sp, 0.5), 1.5);
              const nodesS = sp.closed ? pts.slice(0, -1) : pts;
              return nodesS.length > 2 ? { closed: sp.closed, nodes: smoothNodes(nodesS, sp.closed) } : sp;
            }),
          }
    );

  const reversePaths = () => replaceSel((o) => (o.type !== "path" ? o : { ...o, subpaths: o.subpaths.map((sp) => ({ ...sp, nodes: [...sp.nodes].reverse().map((n) => ({ ...n, hin: n.hout, hout: n.hin })) })) }));

  const selectAll = () => setSelection(cur().objects.filter((o) => o.visible && !o.locked).map((o) => o.id));

  // ------------------------------------------------------------------------
  // Archivo
  // ------------------------------------------------------------------------

  const placeImage = async () => {
    const file = await pickOpenFile([{ name: "Imágenes y SVG", extensions: [...imageExts, "svg"] }], "Colocar");
    if (!file) return;
    const d = cur();
    const ab = d.artboards.find((a) => a.id === activeArtboard) || d.artboards[0];
    if (extensionOf(file.name) === "svg") {
      const { objects, width, height } = importSvg(new TextDecoder().decode(file.bytes));
      const k = Math.min(1, (ab.w * 0.8) / width, (ab.h * 0.8) / height);
      const from = { x: 0, y: 0, w: width, h: height };
      const to = { x: ab.x + (ab.w - width * k) / 2, y: ab.y + (ab.h - height * k) / 2, w: width * k, h: height * k };
      const g: VObject = { id: `ob${Date.now().toString(36)}`, type: "group", name: file.name, visible: true, locked: false, opacity: 1, blend: "normal", clip: false, children: objects.map((o) => scaleObject(o, from, to)) };
      apply({ ...d, objects: [...d.objects, g] });
      setSelection([g.id]);
      return;
    }
    const url = await fileToDataUrl(file.bytes, file.name);
    const { w, h } = await dataUrlSize(url);
    const k = Math.min(1, (ab.w * 0.8) / w, (ab.h * 0.8) / h);
    const img = imageObject(url, ab.x + (ab.w - w * k) / 2, ab.y + (ab.h - h * k) / 2, w * k, h * k);
    apply({ ...d, objects: [...d.objects, img] });
    setSelection([img.id]);
  };

  const startTrace = async () => {
    // Calcar la imagen seleccionada o una nueva
    let url: string | null = single?.type === "image" ? single.href : null;
    let name = "Calco";
    if (!url) {
      const file = await pickOpenFile([{ name: "Imágenes", extensions: imageExts }], "Imagen para calcar");
      if (!file) return;
      url = await fileToDataUrl(file.bytes, file.name);
      name = file.name.replace(/\.[^.]+$/, "");
    }
    const { w, h, img } = await dataUrlSize(url);
    const k = Math.min(1, 1600 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    setDialog({ kind: "trace", img: c, name });
  };

  const runTrace = async (img: HTMLCanvasElement, name: string, o: TraceOptions) => {
    setDialog(null);
    setBusy("Calcando la imagen…");
    try {
      const svgs = await traceImage(img, o, "CoffeeVector");
      if (!svgs) return;
      const objects = svgs.flatMap((s) => importSvg(s).objects);
      const d = cur();
      const ab = d.artboards.find((a) => a.id === activeArtboard) || d.artboards[0];
      const kk = Math.min((ab.w * 0.9) / img.width, (ab.h * 0.9) / img.height);
      const from = { x: 0, y: 0, w: img.width, h: img.height };
      const to = { x: ab.x + (ab.w - img.width * kk) / 2, y: ab.y + (ab.h - img.height * kk) / 2, w: img.width * kk, h: img.height * kk };
      const g: VObject = { id: `ob${Date.now().toString(36)}`, type: "group", name: `Calco: ${name}`, visible: true, locked: false, opacity: 1, blend: "normal", clip: false, children: objects.map((x) => scaleObject(x, from, to)) };
      apply({ ...d, objects: [...d.objects.filter((x) => !(single?.type === "image" && x.id === single.id)), g] });
      setSelection([g.id]);
      toast(`Calco listo: ${objects.length} trazados`);
    } catch (err) {
      await showMessage("No se pudo calcar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const doExport = async (format: "svg" | "png" | "jpg" | "pdf", scope: "active" | "all", scale: number, transparent: boolean) => {
    setDialog(null);
    const d = cur();
    const boards = scope === "all" ? d.artboards : [d.artboards.find((a) => a.id === activeArtboard) || d.artboards[0]];
    const base = sd.title || "Ilustración";
    setBusy("Exportando…");
    try {
      let blob: Blob;
      let name: string;
      if (format === "pdf") {
        blob = await exportPdf(d, boards);
        name = `${base}.pdf`;
      } else {
        const files = await Promise.all(
          boards.map(async (ab) => ({ name: `${boards.length > 1 ? `${base} - ${ab.name}` : base}.${format}`, blob: format === "svg" ? new Blob([exportSvg(d, ab, transparent)], { type: "image/svg+xml" }) : await exportRaster(d, ab, format, scale, transparent) }))
        );
        if (files.length === 1) {
          blob = files[0].blob;
          name = files[0].name;
        } else {
          blob = makeZip(await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) }))));
          name = `${base}.zip`;
        }
      }
      const ext = name.split(".").pop()!;
      const path = await saveFileAs(name, [{ name: ext.toUpperCase(), extensions: [ext] }], blob, "Exportar");
      if (path !== null) toast("Exportado");
    } catch (err) {
      await showMessage("No se pudo exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------------------------
  // Teclado
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
          n: () => setDialog({ kind: "new" }),
          a: selectAll,
          c: () => copySel(),
          x: () => copySel(true),
          v: () => paste(e.shiftKey),
          d: duplicate,
          g: () => (e.shiftKey ? doUngroup() : doGroup()),
          "7": () => (e.altKey ? doUngroup() : doGroup(true)),
          j: joinPaths,
          "]": () => doArrange(e.shiftKey ? "front" : "forward"),
          "[": () => doArrange(e.shiftKey ? "back" : "backward"),
          "0": () => canvasRef.current?.fit(),
          "=": () => canvasRef.current?.zoomBy(1.25),
          "+": () => canvasRef.current?.zoomBy(1.25),
          "-": () => canvasRef.current?.zoomBy(0.8),
          e: () => setDialog({ kind: "export" }),
          k: () => setCommandOpen(true),
        };
        const fn = map[k];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSel();
        return;
      }
      if (e.key.startsWith("Arrow") && selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        replaceSel((o) => translateObject(o, dx, dy), "nudge");
        return;
      }
      if (e.key === "Escape") {
        setSelection([]);
        setNodes([]);
        return;
      }
      if (e.shiftKey && k === "x") {
        const f = shownFill?.type === "solid" ? shownFill.color : null;
        setFill(shownStroke ? { type: "solid", color: shownStroke.color, opacity: 1 } : null);
        setStroke(f ? { ...(shownStroke || { opacity: 1, width: 2, cap: "round", join: "round", dash: [] }), color: f } : null);
        return;
      }
      if (e.shiftKey && k === "c") return setTool("convert");
      if (e.shiftKey && k === "o") return setTool("artboard");
      const t = TOOLS.find((x) => x.key.toLowerCase() === k);
      if (t) setTool(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------------
  // Menús
  // ------------------------------------------------------------------------

  const menus: MenuDefinition[] = doc
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Nuevo…", icon: FilePlus, shortcut: "Ctrl+N", action: () => setDialog({ kind: "new" }) },
            { label: "Abrir… (CVC, SVG o imagen)", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { label: "Colocar imagen o SVG…", icon: ImageIcon, action: () => void placeImage() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void sd.saveAs() },
            { label: "Exportar…", icon: Download, shortcut: "Ctrl+E", action: () => setDialog({ kind: "export" }) },
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
            { label: "Cortar", icon: Scissors, shortcut: "Ctrl+X", action: () => copySel(true) },
            { label: "Copiar", icon: Copy, shortcut: "Ctrl+C", action: () => copySel() },
            { label: "Pegar", icon: ClipboardPaste, shortcut: "Ctrl+V", action: () => paste() },
            { label: "Pegar en el mismo sitio", shortcut: "Ctrl+Mayús+V", action: () => paste(true) },
            { label: "Duplicar", shortcut: "Ctrl+D", action: duplicate },
            { label: "Eliminar", shortcut: "Supr", action: deleteSel },
            { divider: true },
            { label: "Seleccionar todo", shortcut: "Ctrl+A", action: selectAll },
            { label: "Deseleccionar", shortcut: "Esc", action: () => setSelection([]) },
          ],
        },
        {
          id: "object",
          label: "Objeto",
          items: [
            { label: "Agrupar", icon: Group, shortcut: "Ctrl+G", action: () => doGroup() },
            { label: "Desagrupar", icon: Ungroup, shortcut: "Ctrl+Mayús+G", action: doUngroup },
            { label: "Crear máscara de recorte", shortcut: "Ctrl+7", action: () => doGroup(true) },
            { label: "Soltar máscara de recorte", shortcut: "Ctrl+Alt+7", action: doUngroup },
            { divider: true },
            { label: "Traer al frente", shortcut: "Ctrl+Mayús+]", action: () => doArrange("front") },
            { label: "Hacia delante", shortcut: "Ctrl+]", action: () => doArrange("forward") },
            { label: "Hacia atrás", shortcut: "Ctrl+[", action: () => doArrange("backward") },
            { label: "Enviar al fondo", shortcut: "Ctrl+Mayús+[", action: () => doArrange("back") },
            { divider: true },
            { label: "Girar 90°", action: () => rotateSel(90) },
            { label: "Reflejar horizontalmente", action: () => flipSel(true) },
            { label: "Reflejar verticalmente", action: () => flipSel(false) },
            { divider: true },
            { label: "Trazado: unir / cerrar", shortcut: "Ctrl+J", action: joinPaths },
            { label: "Trazado: invertir dirección", action: reversePaths },
            { label: "Trazado: simplificar", action: simplifyPaths },
            { divider: true },
            { label: "Calco de imagen (complemento)…", icon: ScanLine, action: () => void startTrace() },
            { divider: true },
            { label: "Bloquear selección", action: () => replaceSel((o) => ({ ...o, locked: true })) },
            { label: "Desbloquear todo", action: () => apply({ ...cur(), objects: mapObjects(cur().objects, (o) => (o.locked ? { ...o, locked: false } : o)) }) },
            { label: "Ocultar selección", action: () => replaceSel((o) => ({ ...o, visible: false })) },
            { label: "Mostrar todo", action: () => apply({ ...cur(), objects: mapObjects(cur().objects, (o) => (o.visible ? o : { ...o, visible: true })) }) },
          ],
        },
        {
          id: "view",
          label: "Vista",
          items: [
            { label: "Acercar", icon: ZoomIn, shortcut: "Ctrl++", action: () => canvasRef.current?.zoomBy(1.25) },
            { label: "Alejar", icon: ZoomOut, shortcut: "Ctrl+-", action: () => canvasRef.current?.zoomBy(0.8) },
            { label: "Ajustar mesa de trabajo", icon: Maximize, shortcut: "Ctrl+0", action: () => canvasRef.current?.fit() },
            { label: "Ver todas las mesas", action: () => canvasRef.current?.fit(selectionBoundsAll(cur().artboards)) },
            { label: "Cuadrícula", icon: Grid3x3, checked: showGrid, action: () => setShowGrid(!showGrid) },
            { label: "Ajustar a píxeles", checked: snap, action: () => setSnap(!snap) },
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
                  "V selección · A selección directa · P pluma · Mayús+C convertir ancla · N lápiz · M rectángulo · L elipse · \\ línea · T texto · I cuentagotas · Mayús+O mesa de trabajo · H mano · Z zoom.\n\nArrastrar con Alt: duplicar · Mayús: proporciones / 45° · Flechas: mover (Mayús ×10) · Mayús+X: intercambiar relleno y trazo.\n\nCtrl+G agrupar · Ctrl+Mayús+G desagrupar · Ctrl+7 máscara de recorte · Ctrl+J unir trazados · Ctrl+D duplicar · Ctrl+]/[ orden · Ctrl+0 ajustar · Ctrl+E exportar.\n\nPluma: clic = esquina, arrastrar = curva, clic en el primer nodo = cerrar, Intro = terminar; clic en un segmento añade un nodo y en un nodo lo quita."
                ),
            },
            { label: "Acerca de CoffeeVector", icon: Info, action: () => void showMessage("CoffeeVector", "Gráficos vectoriales e ilustración de la suite CoffeeWorks: pluma Bézier, formas, buscatrazos, degradados, texto, mesas de trabajo, calco de imagen (complemento) y exportación a SVG, PNG, JPG y PDF vectorial.") },
          ],
        },
      ]
    : [];

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;
  const showShapeOpts = tool === "polygon" || tool === "star" || tool === "roundRect";

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeevector">
      <style>{STUDIO_CSS}</style>
      {doc && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Ilustración sin título"
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
          <div className="h-9 shrink-0 bg-[#26262a] border-b border-black/50 flex items-center gap-3 px-3 text-[11px]" data-options-bar>
            <span className="font-semibold text-white">{TOOLS.find((t) => t.id === tool)?.label}</span>
            <div className="w-px h-5 bg-white/10" />
            {showShapeOpts && tool === "polygon" && <NumberField label="Lados" value={shapeOpts.sides} min={3} max={40} onChange={(v) => setShapeOpts({ ...shapeOpts, sides: v })} className="w-24" />}
            {showShapeOpts && tool === "star" && <NumberField label="Puntas" value={shapeOpts.points} min={3} max={40} onChange={(v) => setShapeOpts({ ...shapeOpts, points: v })} className="w-24" />}
            {showShapeOpts && tool === "roundRect" && <NumberField label="Radio" value={shapeOpts.radius} min={0} max={500} onChange={(v) => setShapeOpts({ ...shapeOpts, radius: v })} className="w-24" />}
            {tool === "pen" && <span className="text-[#8b8b93]">Clic: esquina · arrastrar: curva · clic en un segmento seleccionado: añadir nodo · en un nodo: quitarlo</span>}
            {tool === "direct" && <span className="text-[#8b8b93]">Arrastra nodos y manejadores (Alt rompe la simetría). Supr borra los nodos seleccionados.</span>}
            {tool === "select" && <span className="text-[#8b8b93]">Arrastra para mover (Alt duplica), los tiradores escalan y junto a las esquinas se gira.</span>}
            {tool === "eyedropper" && <span className="text-[#8b8b93]">Clic en un objeto para copiar su relleno y trazo a la selección.</span>}
            {tool === "artboard" && <span className="text-[#8b8b93]">Arrastra en vacío para crear una mesa; arrastra una mesa para moverla.</span>}
            <div className="flex-1" />
            <span className="text-[#8b8b93] font-mono">{Math.round(view.zoom * 100)} %</span>
          </div>
          <div className="flex-1 flex min-h-0">
            <ToolBar tool={tool} onTool={setTool} fill={shownFill} stroke={shownStroke} onFill={setFill} onStroke={setStroke} />
            <Canvas
              ref={canvasRef}
              doc={doc}
              tool={tool}
              setTool={setTool}
              view={view}
              setView={setView}
              selection={selection}
              setSelection={setSelection}
              nodes={nodes}
              setNodes={setNodes}
              activeArtboard={activeArtboard}
              setActiveArtboard={setActiveArtboard}
              fill={defFill}
              stroke={defStroke}
              shapeOpts={shapeOpts}
              onChange={apply}
              onEyedropper={(o) => {
                if (o.type !== "path" && o.type !== "text") return;
                if (selObjects.length) {
                  replaceSel((x) => (x.type === "path" || x.type === "text" ? { ...x, fill: o.fill, stroke: o.stroke } : x));
                }
                setDefFill(o.fill);
                setDefStroke(o.stroke);
              }}
              showGrid={showGrid}
              snap={snap}
            />
            <aside className="w-[290px] shrink-0 bg-[#202023] border-l border-black/50 overflow-y-auto" data-right-panel>
              <PropertiesPanel
                box={box}
                single={single}
                count={selObjects.length}
                onBox={setBox}
                onRotate={rotateSel}
                onPatch={(patch, key) => single && patchObject(single.id, patch, key)}
                onFill={setFill}
                onStroke={setStroke}
                fill={shownFill}
                stroke={shownStroke}
                fonts={FONTS}
              />
              {selObjects.length > 0 && <AlignPanel onAlign={align} onPathfinder={doPathfinder} toArtboard={toArtboard} setToArtboard={setToArtboard} />}
              <LayersPanel
                doc={doc}
                selection={selection}
                onSelect={(ids, add) => setSelection(add ? [...new Set([...selection, ...ids])] : ids)}
                onPatch={patchObject}
                onReorder={(id, to) => {
                  const d = cur();
                  const objects = [...d.objects];
                  const from = objects.findIndex((o) => o.id === id);
                  const [o] = objects.splice(from, 1);
                  objects.splice(to, 0, o);
                  apply({ ...d, objects });
                }}
              />
              <ArtboardsPanel
                doc={doc}
                active={activeArtboard}
                onActive={(id) => {
                  setActiveArtboard(id);
                  canvasRef.current?.fit(doc.artboards.find((a) => a.id === id));
                }}
                onPatch={(id, patch) => apply({ ...cur(), artboards: cur().artboards.map((a) => (a.id === id ? { ...a, ...patch } : a)) }, `ab-${id}`)}
                onDelete={(id) => apply({ ...cur(), artboards: cur().artboards.filter((a) => a.id !== id) })}
                onAdd={() => {
                  const d = cur();
                  const last = d.artboards[d.artboards.length - 1];
                  const ab = artboard(`Mesa de trabajo ${d.artboards.length + 1}`, last.x + last.w + 80, last.y, last.w, last.h);
                  apply({ ...d, artboards: [...d.artboards, ab] });
                  setActiveArtboard(ab.id);
                  canvasRef.current?.fit(ab);
                }}
              />
            </aside>
          </div>
        </>
      )}

      {dialog?.kind === "new" && <NewDialog onCancel={() => setDialog(null)} onCreate={(w, h, name) => (setDialog(null), void sd.newDocument(name, newDocument(w, h)))} />}
      {dialog?.kind === "export" && doc && <ExportDialog multi={doc.artboards.length > 1} onCancel={() => setDialog(null)} onExport={(f, s, sc, t) => void doExport(f, s, sc, t)} />}
      {dialog?.kind === "trace" && <TraceDialog img={dialog.img} onCancel={() => setDialog(null)} onRun={(o) => void runTrace(dialog.img, dialog.name, o)} />}

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
          appName="CoffeeVector"
          tagline="Gráficos vectoriales e ilustración • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Logotipo, cartel, tarjeta o icono"
          openHint="Abrir un .cvc, un SVG o una imagen"
          formats={[".cvc", ".svg", ".png", ".jpg"]}
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

const selectionBoundsAll = (boards: Artboard[]): Bounds => {
  const x0 = Math.min(...boards.map((a) => a.x));
  const y0 = Math.min(...boards.map((a) => a.y));
  const x1 = Math.max(...boards.map((a) => a.x + a.w));
  const y1 = Math.max(...boards.map((a) => a.y + a.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const NewDialog: React.FC<{ onCreate: (w: number, h: number, name: string) => void; onCancel: () => void }> = ({ onCreate, onCancel }) => {
  const [w, setW] = useState(1000);
  const [h, setH] = useState(1000);
  const [name, setName] = useState("Sin título");
  return (
    <Modal title="Documento nuevo" onClose={onCancel} width={440} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onCreate(w, h, name)}>Crear</Button></>}>
      <input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#141416] border border-black/50 rounded h-7 px-2 text-[13px] outline-none" />
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => (setW(p.w), setH(p.h))} className={`text-left px-2 py-1.5 rounded text-[11px] ${w === p.w && h === p.h ? "bg-[#e8590c]/30 text-white" : "bg-[#1d1d21] text-[#c9c9cf] hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Ancho" value={w} min={1} max={20000} onChange={setW} suffix="px" />
        <NumberField label="Alto" value={h} min={1} max={20000} onChange={setH} suffix="px" />
      </div>
    </Modal>
  );
};

const ExportDialog: React.FC<{ multi: boolean; onExport: (f: "svg" | "png" | "jpg" | "pdf", scope: "active" | "all", scale: number, transparent: boolean) => void; onCancel: () => void }> = ({ multi, onExport, onCancel }) => {
  const [format, setFormat] = useState<"svg" | "png" | "jpg" | "pdf">("svg");
  const [scope, setScope] = useState<"active" | "all">("active");
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  return (
    <Modal title="Exportar" onClose={onCancel} width={380} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onExport(format, scope, scale, transparent)}>Exportar</Button></>}>
      <Select value={format} onChange={(v) => setFormat(v as typeof format)} options={[{ value: "svg", label: "SVG (vectorial)" }, { value: "pdf", label: "PDF (vectorial)" }, { value: "png", label: "PNG" }, { value: "jpg", label: "JPG" }]} />
      {multi && <Select value={scope} onChange={(v) => setScope(v as typeof scope)} options={[{ value: "active", label: "Mesa de trabajo activa" }, { value: "all", label: "Todas las mesas de trabajo" }]} />}
      {(format === "png" || format === "jpg") && <Slider label="Escala" value={scale} min={0.25} max={8} step={0.25} onChange={setScale} suffix="×" />}
      {(format === "png" || format === "svg") && <Toggle checked={transparent} onChange={setTransparent} label="Fondo transparente" accent={ACCENT} />}
    </Modal>
  );
};

const TraceDialog: React.FC<{ img: HTMLCanvasElement; onRun: (o: TraceOptions) => void; onCancel: () => void }> = ({ img, onRun, onCancel }) => {
  const [o, setO] = useState<TraceOptions>({ mode: "bw", threshold: 128, colors: 6, noise: 4, smooth: 1 });
  const preview = useMemo(() => img.toDataURL(), [img]);
  return (
    <Modal title="Calco de imagen" onClose={onCancel} width={420} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onRun(o)}>Calcar</Button></>}>
      <img src={preview} alt="" className="max-h-40 object-contain checker rounded" />
      <Select value={o.mode} onChange={(v) => setO({ ...o, mode: v as TraceOptions["mode"] })} options={[{ value: "bw", label: "Blanco y negro (logotipos, dibujos)" }, { value: "color", label: "Color (ilustraciones, fotos)" }]} />
      {o.mode === "bw" ? <Slider label="Umbral" value={o.threshold} min={1} max={254} onChange={(v) => setO({ ...o, threshold: v })} /> : <Slider label="Colores" value={o.colors} min={2} max={16} onChange={(v) => setO({ ...o, colors: v })} />}
      <Slider label="Ignorar manchas menores de" value={o.noise} min={0} max={100} onChange={(v) => setO({ ...o, noise: v })} suffix="px" />
      <Slider label="Suavizado de esquinas" value={o.smooth} min={0} max={1.33} step={0.01} onChange={(v) => setO({ ...o, smooth: v })} />
      {!isTauri && <span className="text-[#ffc09f]">El calco usa el complemento «Calco vectorial», disponible en la aplicación de escritorio.</span>}
    </Modal>
  );
};

export { downloadBlob };
