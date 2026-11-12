import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, Play, Pause, MousePointer2, Hand, Brush, Pencil, Minus, Square, Circle, Type, PaintBucket, Eraser, Pipette, Plus, Trash2, Eye, EyeOff, Lock, Unlock, Layers as LayersIcon, Film, MousePointerClick, Shapes, Image as ImageIcon, ChevronRight, MonitorPlay, Copy } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, IconButton, Modal, NumberField, STUDIO_CSS, Section, Select, Slider, Toggle, cx } from "./studio/ui";
import { isTauri, pickOpenFiles, saveFileAs } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import { newId } from "./studio/color";
import { FORMAT_LABEL, encodeGifJob, encodePngSequence, encodeWebM, encodeWithFfmpeg, extensionOf, isCancelled, needsFfmpeg, type FrameJob, type VideoFormat } from "./studio/videoExport";
import { invoke } from "@tauri-apps/api/core";
import { ACCENT, ACCENT_DARK, type ALayer, type Action, type AnimDoc, type El, type SymbolDef, type Timeline } from "./types";
import { runtime, exportHtml } from "./runtime";
import { clearKeyframe, createTween, editableKey, insertFrame, insertKeyframe, keyIndexAt, makeSymbol, newDoc, newLayer, parseDoc, removeFrame, sampleDoc, serializeDoc, simplify, timelineOf, withTimeline } from "./model";

const store = createDocStore<AnimDoc>({
  appId: "coffeeanimate",
  extension: "can",
  category: "Ilustración",
  defaultTitle: "Animación sin título",
  kindLabel: "Animaciones de CoffeeAnimate",
  serialize: serializeDoc,
  parse: parseDoc,
  create: newDoc,
});

type Tool = "select" | "brush" | "pencil" | "line" | "rect" | "oval" | "text" | "bucket" | "eraser" | "dropper" | "hand";
type Sel = { layer: string; id: string }[];
type Dialog = { kind: "symbol" } | { kind: "doc" } | { kind: "export" } | { kind: "test" } | null;

const TOOLS: { id: Tool; icon: React.ComponentType<{ size?: number }>; label: string; key: string }[] = [
  { id: "select", icon: MousePointer2, label: "Selección", key: "v" },
  { id: "brush", icon: Brush, label: "Pincel", key: "b" },
  { id: "pencil", icon: Pencil, label: "Lápiz", key: "y" },
  { id: "line", icon: Minus, label: "Línea", key: "n" },
  { id: "rect", icon: Square, label: "Rectángulo", key: "r" },
  { id: "oval", icon: Circle, label: "Óvalo", key: "o" },
  { id: "text", icon: Type, label: "Texto", key: "t" },
  { id: "bucket", icon: PaintBucket, label: "Bote de pintura", key: "k" },
  { id: "eraser", icon: Eraser, label: "Borrador (borra trazos)", key: "e" },
  { id: "dropper", icon: Pipette, label: "Cuentagotas", key: "i" },
  { id: "hand", icon: Hand, label: "Mano", key: "h" },
];

const CELL = 13;

export const App: React.FC = () => {
  const sd = useStudioDoc<AnimDoc>(store, { appName: "CoffeeAnimate", historyLimit: 80 });
  const doc = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = (next: AnimDoc, key = "") => sd.apply(next, key);

  const [editing, setEditing] = useState<string | null>(null);
  const [frame, setFrameState] = useState(0);
  const frameRef = useRef(0);
  const setFrame = (f: number) => {
    frameRef.current = f;
    setFrameState(f);
  };
  const [layerId, setLayerId] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>([]);
  const [tool, setTool] = useState<Tool>("brush");
  const [stroke, setStroke] = useState("#1f1f24");
  const [fill, setFill] = useState("#ff922b");
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [fillOn, setFillOn] = useState(true);
  const [onion, setOnion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [exporting, setExporting] = useState<{ fraction: number; label: string } | null>(null);
  const cancelExport = useRef(false);

  const tl = doc ? timelineOf(doc, editing) : null;
  const layer = tl ? tl.layers.find((l) => l.id === layerId) || tl.layers[0] : null;
  useEffect(() => {
    if (tl && (!layerId || !tl.layers.some((l) => l.id === layerId))) setLayerId(tl.layers[0]?.id || null);
  }, [tl, layerId]);
  useEffect(() => {
    setSel([]);
    setFrame(0);
  }, [editing, sd.docId]);

  // ------------------------------------------------------------------------
  // Edición de la línea de tiempo
  // ------------------------------------------------------------------------

  const setTl = (next: Timeline, key = "") => apply(withTimeline(cur(), editing, next), key);
  const curTl = () => timelineOf(cur(), editing);
  const patchLayer = (id: string, fn: (l: ALayer) => ALayer, key = "") => {
    const t = curTl();
    setTl({ ...t, layers: t.layers.map((l) => (l.id === id ? fn(l) : l)) }, key);
  };

  /** Cambia los elementos de la clave que se edita en el fotograma actual. */
  const editElements = (fn: (els: El[]) => El[], key = "", lid = layer?.id) => {
    const t = curTl();
    const l = t.layers.find((x) => x.id === lid);
    if (!l) return;
    if (l.locked) return toast("La capa está bloqueada", "info");
    const { layer: l2, index } = editableKey(l, frameRef.current);
    const k = l2.keyframes[index];
    const nl = { ...l2, keyframes: l2.keyframes.map((x, i) => (i === index ? { ...k, elements: fn(k.elements) } : x)) };
    setTl({ ...t, length: Math.max(t.length, frameRef.current + 1), layers: t.layers.map((x) => (x.id === l.id ? nl : x)) }, key);
  };

  const visibleEls = (l: ALayer) => runtime.frameElements(l.keyframes, frame);

  const addLayer = () => {
    const t = curTl();
    const l = newLayer(`Capa ${t.layers.length + 1}`);
    const idx = Math.max(0, t.layers.findIndex((x) => x.id === layer?.id));
    const layers = t.layers.slice();
    layers.splice(idx, 0, l);
    setTl({ ...t, layers });
    setLayerId(l.id);
  };
  const deleteLayer = () => {
    const t = curTl();
    if (t.layers.length <= 1 || !layer) return;
    setTl({ ...t, layers: t.layers.filter((l) => l.id !== layer.id) });
  };

  const keyCmd = (kind: "key" | "blank" | "clear" | "frame" | "unframe" | "tween" | "untween") => {
    const t = curTl();
    if (!layer) return;
    const f = frameRef.current;
    if (kind === "frame") return setTl(insertFrame(t, layer.id, f));
    if (kind === "unframe") return setTl(removeFrame(t, layer.id, f));
    if (kind === "tween") {
      const r = createTween(layer, f, t);
      return setTl({ length: r.length, layers: t.layers.map((l) => (l.id === layer.id ? r.layer : l)) });
    }
    if (kind === "untween") return patchLayer(layer.id, (l) => ({ ...l, keyframes: l.keyframes.map((k, i) => (i === keyIndexAt(l, f) ? { ...k, tween: "none" } : k)) }));
    const nl = kind === "clear" ? clearKeyframe(layer, f) : insertKeyframe(layer, f, kind === "blank");
    setTl({ length: Math.max(t.length, f + 1), layers: t.layers.map((l) => (l.id === layer.id ? nl : l)) });
  };

  const selectedEls = (): { layer: ALayer; el: El }[] => {
    const t = curTl();
    return sel.map((s) => {
      const l = t.layers.find((x) => x.id === s.layer);
      const el = l && runtime.frameElements(l.keyframes, frameRef.current).find((e) => e.id === s.id);
      return l && el ? { layer: l, el } : null;
    }).filter(Boolean) as { layer: ALayer; el: El }[];
  };

  const patchSelected = (fn: (e: El) => El, key = "") => {
    const byLayer = new Map<string, string[]>();
    sel.forEach((s) => byLayer.set(s.layer, [...(byLayer.get(s.layer) || []), s.id]));
    // Una sola entrada en el historial aunque sean varias capas
    let t = curTl();
    byLayer.forEach((ids, lid) => {
      const l = t.layers.find((x) => x.id === lid);
      if (!l || l.locked) return;
      const { layer: l2, index } = editableKey(l, frameRef.current);
      const k = l2.keyframes[index];
      const nl = { ...l2, keyframes: l2.keyframes.map((x, i) => (i === index ? { ...k, elements: k.elements.map((e) => (ids.includes(e.id) ? fn(e) : e)) } : x)) };
      t = { ...t, layers: t.layers.map((x) => (x.id === lid ? nl : x)) };
    });
    setTl(t, key);
  };

  const deleteSelected = () => {
    const ids = new Set(sel.map((s) => s.id));
    const t0 = curTl();
    let t = t0;
    new Set(sel.map((s) => s.layer)).forEach((lid) => {
      const l = t.layers.find((x) => x.id === lid);
      if (!l) return;
      const { layer: l2, index } = editableKey(l, frameRef.current);
      t = { ...t, layers: t.layers.map((x) => (x.id === lid ? { ...l2, keyframes: l2.keyframes.map((k, i) => (i === index ? { ...k, elements: k.elements.filter((e) => !ids.has(e.id)) } : k)) } : x)) };
    });
    setTl(t);
    setSel([]);
  };

  const convertToSymbol = async (name: string, type: SymbolDef["type"]) => {
    setDialog(null);
    const items = selectedEls();
    if (!items.length) return;
    const lid = items[0].layer.id;
    const els = items.filter((x) => x.layer.id === lid).map((x) => x.el);
    const { symbol, instance } = makeSymbol(cur(), els, name, type);
    const ids = new Set(els.map((e) => e.id));
    apply({ ...cur(), symbols: [...cur().symbols, symbol] });
    editElements((list) => [...list.filter((e) => !ids.has(e.id)), instance]);
    setSel([{ layer: lid, id: instance.id }]);
    toast(`Símbolo «${name}» creado`);
  };

  // ------------------------------------------------------------------------
  // Reproducción en el editor
  // ------------------------------------------------------------------------

  useEffect(() => {
    if (!playing || !doc || !tl) return;
    const id = window.setInterval(() => {
      const len = timelineOf(cur(), editing).length;
      const n = frameRef.current + 1;
      if (n >= len) {
        if (!loop) {
          setPlaying(false);
          return;
        }
        setFrame(0);
      } else setFrame(n);
    }, 1000 / doc.fps);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loop, editing, doc?.fps]);

  // ------------------------------------------------------------------------
  // Importar y exportar
  // ------------------------------------------------------------------------

  const importImage = async () => {
    const files = await pickOpenFiles([{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }], "Importar imagen");
    for (const f of files) {
      const ext = f.name.split(".").pop()!.toLowerCase();
      const data = await new Promise<string>((r) => {
        const fr = new FileReader();
        fr.onload = () => r(String(fr.result));
        fr.readAsDataURL(new Blob([f.bytes as BlobPart], { type: ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}` }));
      });
      const img = new Image();
      await new Promise<void>((r) => {
        img.onload = () => r();
        img.onerror = () => r();
        img.src = data;
      });
      const asset = { id: newId("img"), name: f.name, data, width: img.naturalWidth || 256, height: img.naturalHeight || 256 };
      apply({ ...cur(), images: [...cur().images, asset] });
      const k = Math.min(1, (cur().width * 0.6) / asset.width, (cur().height * 0.6) / asset.height);
      editElements((els) => [...els, { id: newId("el"), kind: "image", imageId: asset.id, t: { x: (cur().width - asset.width * k) / 2, y: (cur().height - asset.height * k) / 2, sx: k, sy: k, rot: 0 }, alpha: 1 }]);
    }
  };

  const renderFrameCanvas = (f: number, scale: number, transparent: boolean): HTMLCanvasElement => {
    const d = cur();
    const c = document.createElement("canvas");
    c.width = Math.round(d.width * scale);
    c.height = Math.round(d.height * scale);
    const g = c.getContext("2d")!;
    g.scale(scale, scale);
    if (!transparent) {
      g.fillStyle = d.background;
      g.fillRect(0, 0, d.width, d.height);
    }
    runtime.drawTimeline(g, d, d.main, f, { editorTime: true });
    return c;
  };

  const runExport = async (format: VideoFormat | "html", scale: number, transparent: boolean) => {
    setDialog(null);
    setPlaying(false);
    const d = cur();
    const base = sd.title || "Animación";
    if (format === "html") {
      await saveFileAs(`${base}.html`, [{ name: "Página HTML5", extensions: ["html"] }], exportHtml(d, base), "Exportar HTML5");
      return toast("HTML5 exportado: ábrelo en cualquier navegador");
    }
    const name = `${base}.${extensionOf(format)}`;
    let target: string | null = null;
    if (needsFfmpeg(format)) {
      if (!isTauri) return void showMessage("Necesita FFmpeg", "MP4, MOV y el GIF de alta calidad se exportan desde la aplicación de escritorio con el complemento «Motor de video FFmpeg». En el navegador, exporta a WebM, GIF, PNG o HTML5.");
      if (!(await ensureAddon("ffmpeg", "CoffeeAnimate"))) return;
      target = await invoke<string | null>("core_pick_save", { title: "Exportar video", defaultName: name, filters: [{ name: FORMAT_LABEL[format], extensions: [extensionOf(format)] }] });
      if (!target) return;
    }
    cancelExport.current = false;
    setExporting({ fraction: 0, label: "Preparando" });
    try {
      const job: FrameJob = {
        width: Math.round(d.width * scale),
        height: Math.round(d.height * scale),
        fps: d.fps,
        frames: Math.max(1, d.main.length),
        alpha: transparent,
        cancelled: () => cancelExport.current,
        onProgress: (fraction, label) => setExporting({ fraction, label }),
        render: (i) => renderFrameCanvas(i, scale, transparent),
      };
      if (format === "webm") await saveFileAs(name, [{ name: "WebM", extensions: ["webm"] }], await encodeWebM(job), "Exportar video");
      else if (format === "gif") await saveFileAs(name, [{ name: "GIF", extensions: ["gif"] }], await encodeGifJob(job, Math.min(job.width, 960)), "Exportar GIF");
      else if (format === "png") await saveFileAs(name, [{ name: "ZIP", extensions: ["zip"] }], await encodePngSequence(job, base.replace(/[^\w-]+/g, "_")), "Exportar secuencia PNG");
      else await encodeWithFfmpeg(job, format, target!);
      toast("Exportación terminada");
    } catch (err) {
      if (isCancelled(err)) toast("Exportación cancelada", "info");
      else await showMessage("No se pudo exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };

  // ------------------------------------------------------------------------
  // Teclado
  // ------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sd.docRef.current || sd.showStart || dialog || exporting || document.querySelector("[data-modal-open]")) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod) {
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? sd.redo() : sd.undo()),
          y: () => sd.redo(),
          s: () => (e.shiftKey ? void sd.saveAs() : void sd.flush().then(() => toast("Guardado"))),
          o: () => void sd.open(),
          enter: () => setDialog({ kind: "test" }),
          d: () => {
            const items = selectedEls();
            const copies = items.map((x) => ({ layer: x.layer.id, el: { ...structuredClone(x.el), id: newId("el"), t: { ...x.el.t, x: x.el.t.x + 20, y: x.el.t.y + 20 } } }));
            copies.forEach((c) => editElements((els) => [...els, c.el], "", c.layer));
            setSel(copies.map((c) => ({ layer: c.layer, id: c.el.id })));
          },
          a: () => layer && setSel(visibleEls(layer).map((el) => ({ layer: layer.id, id: el.id }))),
          k: () => setCommandOpen(true),
          i: () => void importImage(),
        };
        const fn = map[k];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (e.key === "F5") return e.preventDefault(), keyCmd(e.shiftKey ? "unframe" : "frame");
      if (e.key === "F6") return e.preventDefault(), keyCmd(e.shiftKey ? "clear" : "key");
      if (e.key === "F7") return e.preventDefault(), keyCmd("blank");
      if (e.key === "F8") return e.preventDefault(), sel.length && setDialog({ kind: "symbol" });
      if (e.key === "Enter") return setPlaying((p) => !p);
      if (e.key === ",") return setFrame(Math.max(0, frameRef.current - 1));
      if (e.key === ".") return tl && setFrame(Math.min(tl.length - 1, frameRef.current + 1));
      if (e.key === "Delete" || e.key === "Backspace") return deleteSelected();
      if (e.key === "Escape") return editing ? setEditing(null) : setSel([]);
      if (e.key.startsWith("Arrow") && sel.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        return patchSelected((el) => ({ ...el, t: { ...el.t, x: el.t.x + dx, y: el.t.y + dy } }), "nudge");
      }
      const t = TOOLS.find((x) => x.key === k);
      if (t) setTool(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const menus: MenuDefinition[] = doc
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Animación nueva", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { label: "Importar imagen…", icon: ImageIcon, shortcut: "Ctrl+I", action: () => void importImage() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, action: () => void sd.saveAs() },
            { label: "Exportar (HTML5, video, GIF, PNG)…", icon: Download, action: () => setDialog({ kind: "export" }) },
            { divider: true },
            { label: "Abrir el ejemplo: pelota que rebota", action: () => apply(sampleDoc()) },
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
            { label: "Duplicar", icon: Copy, shortcut: "Ctrl+D", action: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", ctrlKey: true })), disabled: !sel.length },
            { label: "Eliminar", icon: Trash2, shortcut: "Supr", action: deleteSelected, disabled: !sel.length },
            { label: "Seleccionar todo en la capa", shortcut: "Ctrl+A", action: () => layer && setSel(visibleEls(layer).map((el) => ({ layer: layer.id, id: el.id }))) },
          ],
        },
        {
          id: "insert",
          label: "Insertar",
          items: [
            { label: "Fotograma", shortcut: "F5", action: () => keyCmd("frame") },
            { label: "Quitar fotograma", shortcut: "Mayús+F5", action: () => keyCmd("unframe") },
            { label: "Fotograma clave", shortcut: "F6", action: () => keyCmd("key") },
            { label: "Fotograma clave vacío", shortcut: "F7", action: () => keyCmd("blank") },
            { label: "Borrar fotograma clave", shortcut: "Mayús+F6", action: () => keyCmd("clear") },
            { divider: true },
            { label: "Crear interpolación clásica", action: () => keyCmd("tween") },
            { label: "Quitar interpolación", action: () => keyCmd("untween") },
            { divider: true },
            { label: "Capa nueva", icon: LayersIcon, action: addLayer },
            { label: "Convertir en símbolo…", shortcut: "F8", action: () => setDialog({ kind: "symbol" }), disabled: !sel.length },
          ],
        },
        {
          id: "control",
          label: "Control",
          items: [
            { label: playing ? "Detener" : "Reproducir", icon: playing ? Pause : Play, shortcut: "Intro", action: () => setPlaying(!playing) },
            { label: "Repetir la reproducción", checked: loop, action: () => setLoop(!loop) },
            { label: "Papel cebolla", checked: onion, action: () => setOnion(!onion) },
            { divider: true },
            { label: "Probar película (con botones)", icon: MonitorPlay, shortcut: "Ctrl+Intro", action: () => setDialog({ kind: "test" }) },
          ],
        },
        {
          id: "modify",
          label: "Modificar",
          items: [
            { label: "Documento…", action: () => setDialog({ kind: "doc" }) },
            { label: "Voltear horizontalmente", action: () => patchSelected((e) => ({ ...e, t: { ...e.t, sx: -e.t.sx } })), disabled: !sel.length },
            { label: "Voltear verticalmente", action: () => patchSelected((e) => ({ ...e, t: { ...e.t, sy: -e.t.sy } })), disabled: !sel.length },
            { label: "Traer al frente", action: () => editElements((els) => [...els.filter((e) => !sel.some((s) => s.id === e.id)), ...els.filter((e) => sel.some((s) => s.id === e.id))]), disabled: !sel.length },
            { label: "Enviar al fondo", action: () => editElements((els) => [...els.filter((e) => sel.some((s) => s.id === e.id)), ...els.filter((e) => !sel.some((s) => s.id === e.id))]), disabled: !sel.length },
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Cómo animar",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Cómo animar en CoffeeAnimate",
                  "Cuadro a cuadro: dibuja, pulsa F6 (o F7 para un cuadro vacío) en el siguiente fotograma y vuelve a dibujar. Activa el papel cebolla para ver los cuadros vecinos.\n\nInterpolación clásica: pon el contenido en una clave, crea otra más adelante (F6), mueve o transforma el objeto y elige «Crear interpolación clásica». Si los trazos tienen los mismos puntos, también se interpola la forma.\n\nSímbolos (F8): gráficos, clips de película (animación propia en bucle) y botones (Reposo, Sobre, Presionado, Zona activa) con acciones al hacer clic. Doble clic en una instancia para editar el símbolo; Esc vuelve a la escena.\n\nAtajos: Intro reproducir · , y . fotograma anterior y siguiente · F5/Mayús+F5 fotogramas · F6/F7/Mayús+F6 claves · Ctrl+Intro probar · V B Y N R O T K E I H herramientas."
                ),
            },
            { label: "Acerca de CoffeeAnimate", icon: Info, action: () => void showMessage("CoffeeAnimate", "Animación 2D interactiva de la suite CoffeeWorks: dibujo vectorial, cuadro a cuadro, interpolación clásica y de forma, papel cebolla, símbolos y botones con acciones, y exportación a HTML5, video, GIF y secuencia PNG.") },
          ],
        },
      ]
    : [];

  const editingSymbol = doc && editing ? doc.symbols.find((s) => s.id === editing) : null;
  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;
  const selItems = doc ? selectedEls() : [];
  const curKey = layer ? layer.keyframes[keyIndexAt(layer, frame)] : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeeanimate">
      <style>{STUDIO_CSS}</style>
      {doc && tl && layer && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Animación sin título"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <div className="flex gap-2">
                <Button onClick={() => setDialog({ kind: "test" })}>
                  <MonitorPlay size={13} /> Probar
                </Button>
                <Button primary accent={ACCENT} onClick={() => setDialog({ kind: "export" })}>
                  <Download size={13} /> Exportar
                </Button>
              </div>
            }
          />
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex min-h-0">
              {/* Herramientas */}
              <div className="w-11 shrink-0 bg-[#1e1e21] border-r border-black/50 flex flex-col items-center gap-0.5 py-2" data-tools>
                {TOOLS.map((t) => (
                  <IconButton key={t.id} icon={t.icon} title={`${t.label} (${t.key.toUpperCase()})`} active={tool === t.id} accent={ACCENT} onClick={() => setTool(t.id)} data-tool={t.id} />
                ))}
                <div className="h-px w-6 bg-white/10 my-1" />
                <label title="Color del trazo" className="relative w-7 h-7 rounded border-2 border-white/30 cursor-pointer" style={{ background: stroke }}>
                  <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} className="opacity-0 absolute inset-0 cursor-pointer" data-stroke />
                </label>
                <label title="Color de relleno" className="relative w-7 h-7 rounded cursor-pointer mt-1" style={{ background: fillOn ? fill : "transparent", border: fillOn ? "none" : "2px dashed #666" }}>
                  <input type="color" value={fill} onChange={(e) => (setFill(e.target.value), setFillOn(true))} className="opacity-0 absolute inset-0 cursor-pointer" data-fill />
                </label>
                <button type="button" onClick={() => setFillOn(!fillOn)} className="text-[9px] text-[#9a9aa2] hover:text-white mt-0.5" title="Con o sin relleno">
                  {fillOn ? "relleno" : "sin rell."}
                </button>
              </div>
              <div className="flex-1 flex flex-col min-w-0">
                <div className="h-8 shrink-0 flex items-center gap-2 px-3 bg-[#1e1e21] border-b border-black/50 text-[12px]">
                  <button type="button" onClick={() => setEditing(null)} className={cx("hover:text-white", editing ? "text-[#9a9aa2]" : "text-white font-semibold")}>
                    Escena 1
                  </button>
                  {editingSymbol && (
                    <>
                      <ChevronRight size={12} className="text-[#6f6f77]" />
                      <span className="font-semibold" data-breadcrumb>
                        {editingSymbol.name}
                      </span>
                    </>
                  )}
                  <div className="flex-1" />
                  <span className="text-[#9a9aa2]">Grosor</span>
                  <input type="range" min={1} max={60} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="studio-range w-24" />
                  <span className="font-mono w-6">{strokeWidth}</span>
                </div>
                <Stage
                  doc={doc}
                  tl={tl}
                  frame={frame}
                  editing={editing}
                  layer={layer}
                  tool={tool}
                  sel={sel}
                  setSel={setSel}
                  onion={onion}
                  style={{ stroke, fill: fillOn ? fill : null, strokeWidth }}
                  onAdd={(el) => {
                    editElements((els) => [...els, el]);
                    if (el.kind === "text") setSel([{ layer: layer.id, id: el.id }]);
                  }}
                  onPatch={patchSelected}
                  onPatchOne={(lid, id, fn, key) => editElements((els) => els.map((e) => (e.id === id ? fn(e) : e)), key, lid)}
                  onErase={(lid, ids) => editElements((els) => els.filter((e) => !ids.includes(e.id)), "erase", lid)}
                  onPick={(c) => (setFill(c), setFillOn(true), toast(`Color ${c}`, "info"))}
                  onEnterSymbol={(id) => setEditing(id)}
                />
              </div>
              {/* Panel derecho */}
              <aside className="w-[280px] shrink-0 bg-[#202023] border-l border-black/50 flex flex-col min-h-0 overflow-y-auto" data-properties>
                <PropsPanel
                  doc={doc}
                  items={selItems}
                  keyframe={curKey || null}
                  onPatch={patchSelected}
                  onKey={(patch) => {
                    const i = keyIndexAt(layer, frame);
                    if (i >= 0) patchLayer(layer.id, (l) => ({ ...l, keyframes: l.keyframes.map((k, j) => (j === i ? { ...k, ...patch } : k)) }), "kprops");
                  }}
                  onSymbol={(id, patch) => apply({ ...cur(), symbols: cur().symbols.map((s) => (s.id === id ? { ...s, ...patch } : s)) })}
                />
                <Library
                  doc={doc}
                  onEdit={(id) => setEditing(id)}
                  onPlace={(s) => {
                    const el: El = { id: newId("el"), kind: "instance", symbolId: s.id, t: { x: doc.width / 2, y: doc.height / 2, sx: 1, sy: 1, rot: 0 }, alpha: 1, loop: "loop", firstFrame: 0, action: null };
                    editElements((els) => [...els, el]);
                    setSel([{ layer: layer.id, id: el.id }]);
                  }}
                  onDelete={(id) => apply({ ...cur(), symbols: cur().symbols.filter((s) => s.id !== id) })}
                  onRename={async (s) => {
                    const n = await askText({ title: "Cambiar nombre", label: "Nombre", defaultValue: s.name });
                    if (n) apply({ ...cur(), symbols: cur().symbols.map((x) => (x.id === s.id ? { ...x, name: n } : x)) });
                  }}
                />
              </aside>
            </div>
            <TimelinePanel
              tl={tl}
              frame={frame}
              setFrame={(f) => {
                setPlaying(false);
                setFrame(f);
              }}
              layerId={layer.id}
              setLayerId={setLayerId}
              onLayer={patchLayer}
              onAddLayer={addLayer}
              onDeleteLayer={deleteLayer}
              onCmd={keyCmd}
              playing={playing}
              setPlaying={setPlaying}
              onion={onion}
              setOnion={setOnion}
              fps={doc.fps}
              onReorder={(from, to) => {
                const t = curTl();
                const layers = t.layers.slice();
                const [m] = layers.splice(from, 1);
                layers.splice(to, 0, m);
                setTl({ ...t, layers });
              }}
            />
          </div>
        </>
      )}

      {dialog?.kind === "symbol" && <SymbolDialog onCancel={() => setDialog(null)} onOk={(n, t) => void convertToSymbol(n, t)} count={doc?.symbols.length || 0} />}
      {dialog?.kind === "doc" && doc && <DocDialog doc={doc} onCancel={() => setDialog(null)} onOk={(p) => (setDialog(null), apply({ ...cur(), ...p }))} />}
      {dialog?.kind === "export" && doc && <ExportDialog doc={doc} onCancel={() => setDialog(null)} onExport={(f, s, t) => void runExport(f, s, t)} />}
      {dialog?.kind === "test" && doc && <TestMovie doc={doc} onClose={() => setDialog(null)} />}
      {exporting && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center" data-exporting>
          <div className="bg-[#26262b] rounded-xl px-6 py-5 w-[380px] shadow-2xl flex flex-col gap-3">
            <div className="text-sm font-semibold">Exportando…</div>
            <div className="h-2 bg-[#141416] rounded overflow-hidden">
              <div className="h-full" style={{ width: `${exporting.fraction * 100}%`, background: ACCENT }} />
            </div>
            <div className="text-[12px] text-[#9a9aa2] flex justify-between">
              <span>{exporting.label}</span>
              <span>{Math.round(exporting.fraction * 100)} %</span>
            </div>
            <Button onClick={() => (cancelExport.current = true)}>Cancelar</Button>
          </div>
        </div>
      )}
      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />
      {sd.showStart && (
        <StartScreen
          appName="CoffeeAnimate"
          tagline="Animación 2D interactiva • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Animación nueva de 1280×720 a 24 fps"
          openHint="Abrir una animación .can"
          formats={[".can"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
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

// ---------------------------------------------------------------------------
// Escenario
// ---------------------------------------------------------------------------

interface StageProps {
  doc: AnimDoc;
  tl: Timeline;
  frame: number;
  editing: string | null;
  layer: ALayer;
  tool: Tool;
  sel: Sel;
  setSel: (s: Sel) => void;
  onion: boolean;
  style: { stroke: string; fill: string | null; strokeWidth: number };
  onAdd: (el: El) => void;
  onPatch: (fn: (e: El) => El, key?: string) => void;
  onPatchOne: (layer: string, id: string, fn: (e: El) => El, key?: string) => void;
  onErase: (layer: string, ids: string[]) => void;
  onPick: (color: string) => void;
  onEnterSymbol: (id: string) => void;
}

const Stage: React.FC<StageProps> = (p) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState({ zoom: 0.6, x: 0, y: 0 });
  const drag = useRef<
    | { kind: "draw"; pts: [number, number][] }
    | { kind: "shape"; a: [number, number]; b: [number, number] }
    | { kind: "move"; start: [number, number]; orig: Map<string, El>; key: string }
    | { kind: "scale"; center: [number, number]; d0: number; orig: Map<string, El>; key: string }
    | { kind: "rotate"; center: [number, number]; a0: number; orig: Map<string, El>; key: string }
    | { kind: "pan"; start: [number, number]; orig: { x: number; y: number } }
    | { kind: "erase" }
    | null
  >(null);
  const [, redraw] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const fit = useCallback(() => {
    const zoom = Math.min((size.w - 60) / p.doc.width, (size.h - 60) / p.doc.height);
    // En un símbolo el origen (0,0) va al centro
    if (p.editing) setView({ zoom: Math.max(0.2, zoom), x: size.w / 2, y: size.h / 2 });
    else setView({ zoom, x: (size.w - p.doc.width * zoom) / 2, y: (size.h - p.doc.height * zoom) / 2 });
  }, [size, p.doc.width, p.doc.height, p.editing]);
  useEffect(fit, [fit]);

  const toDoc = (cx: number, cy: number): [number, number] => [(cx - view.x) / view.zoom, (cy - view.y) / view.zoom];

  const elMatrix = (el: El) => runtime.matrixOf(el.t);
  const boundsScreen = (el: El) => {
    const b = runtime.elementBounds(p.doc, el);
    const m = new DOMMatrix().translate(view.x, view.y).scale(view.zoom).multiply(elMatrix(el));
    return [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x + b.w, b.y + b.h],
      [b.x, b.y + b.h],
    ].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
  };

  // Dibujo
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#2a2a2e";
    g.fillRect(0, 0, size.w, size.h);
    g.save();
    g.translate(view.x, view.y);
    g.scale(view.zoom, view.zoom);
    if (!p.editing) {
      g.fillStyle = p.doc.background;
      g.shadowColor = "rgba(0,0,0,0.5)";
      g.shadowBlur = 20;
      g.fillRect(0, 0, p.doc.width, p.doc.height);
      g.shadowBlur = 0;
    } else {
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1 / view.zoom;
      g.beginPath();
      g.moveTo(-12, 0);
      g.lineTo(12, 0);
      g.moveTo(0, -12);
      g.lineTo(0, 12);
      g.stroke();
    }
    // Papel cebolla
    if (p.onion) {
      for (const [d, color] of [
        [-2, "#4dabf7"],
        [-1, "#4dabf7"],
        [1, "#69db7c"],
        [2, "#69db7c"],
      ] as [number, string][]) {
        const f = p.frame + d;
        if (f < 0 || f >= p.tl.length) continue;
        g.save();
        g.globalAlpha = Math.abs(d) === 1 ? 0.3 : 0.15;
        for (const l of [...p.tl.layers].reverse()) {
          if (!l.visible) continue;
          for (const el of runtime.frameElements(l.keyframes, f)) runtime.drawElement(g, p.doc, { ...el, tint: { color, amount: 0.6 } }, f);
        }
        g.restore();
      }
    }
    runtime.drawTimeline(g, p.doc, p.tl, p.frame, { editorTime: true });
    // Trazo en curso
    const d = drag.current;
    if (d?.kind === "draw" && d.pts.length > 1) {
      g.strokeStyle = p.tool === "pencil" ? p.style.stroke : p.style.fill || p.style.stroke;
      g.lineWidth = p.tool === "pencil" ? Math.max(1, p.style.strokeWidth / 3) : p.style.strokeWidth;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      d.pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      g.stroke();
    } else if (d?.kind === "shape") {
      g.strokeStyle = p.style.stroke;
      g.lineWidth = Math.max(1, p.style.strokeWidth);
      const [a, b] = [d.a, d.b];
      g.beginPath();
      if (p.tool === "line") {
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
      } else if (p.tool === "rect") g.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    // Selección
    for (const s of p.sel) {
      const l = p.tl.layers.find((x) => x.id === s.layer);
      const el = l && runtime.frameElements(l.keyframes, p.frame).find((e) => e.id === s.id);
      if (!el) continue;
      const pts = boundsScreen(el);
      g.strokeStyle = "#4dabf7";
      g.lineWidth = 1.5;
      g.beginPath();
      pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.closePath();
      g.stroke();
      if (p.sel.length === 1 && p.tool === "select") {
        g.fillStyle = "#fff";
        pts.forEach((q) => g.fillRect(q.x - 4, q.y - 4, 8, 8));
        const top = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 - 22 };
        g.beginPath();
        g.arc(top.x, top.y, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

  const hit = (pt: [number, number]): { layer: string; el: El } | null => {
    for (const l of p.tl.layers) {
      if (!l.visible || l.locked) continue;
      const els = runtime.frameElements(l.keyframes, p.frame);
      for (let i = els.length - 1; i >= 0; i--) {
        const el = els[i];
        const b = runtime.elementBounds(p.doc, el);
        const q = elMatrix(el).inverse().transformPoint(new DOMPoint(pt[0], pt[1]));
        const pad = 4 / view.zoom;
        if (q.x >= b.x - pad && q.x <= b.x + b.w + pad && q.y >= b.y - pad && q.y <= b.y + b.h + pad) return { layer: l.id, el };
      }
    }
    return null;
  };

  const selMap = () => {
    const m = new Map<string, El>();
    for (const s of p.sel) {
      const l = p.tl.layers.find((x) => x.id === s.layer);
      const el = l && runtime.frameElements(l.keyframes, p.frame).find((e) => e.id === s.id);
      if (el) m.set(el.id, el);
    }
    return m;
  };

  const onDown = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const pt = toDoc(sx, sy);
    (e.target as Element).setPointerCapture(e.pointerId);
    if (p.tool === "hand" || e.button === 1) {
      drag.current = { kind: "pan", start: [sx, sy], orig: { x: view.x, y: view.y } };
      return;
    }
    if (p.tool === "brush" || p.tool === "pencil") {
      if (p.layer.locked) return toast("La capa está bloqueada", "info");
      drag.current = { kind: "draw", pts: [pt] };
      return;
    }
    if (p.tool === "line" || p.tool === "rect" || p.tool === "oval") {
      drag.current = { kind: "shape", a: pt, b: pt };
      return;
    }
    if (p.tool === "text") {
      p.onAdd({ id: newId("el"), kind: "text", t: { x: pt[0], y: pt[1], sx: 1, sy: 1, rot: 0 }, alpha: 1, text: "Texto", size: 48, font: "Hanken Grotesk, sans-serif", fill: p.style.stroke, bold: true });
      window.setTimeout(() => (document.querySelector("[data-el-text]") as HTMLTextAreaElement | null)?.select(), 80);
      return;
    }
    const h = hit(pt);
    if (p.tool === "bucket") {
      if (h && (h.el.kind === "path" || h.el.kind === "rect" || h.el.kind === "ellipse" || h.el.kind === "text")) p.onPatchOne(h.layer, h.el.id, (x) => ({ ...x, fill: p.style.fill || "#000000", closed: x.kind === "path" ? true : x.closed }));
      return;
    }
    if (p.tool === "dropper") {
      if (h) p.onPick(h.el.fill || h.el.stroke || "#000000");
      return;
    }
    if (p.tool === "eraser") {
      if (h) p.onErase(h.layer, [h.el.id]);
      drag.current = { kind: "erase" };
      return;
    }
    // Selección: asas
    if (p.sel.length === 1) {
      const m = selMap();
      const el = [...m.values()][0];
      if (el) {
        const pts = boundsScreen(el);
        const top = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 - 22 };
        const c = toDoc((pts[0].x + pts[2].x) / 2, (pts[0].y + pts[2].y) / 2);
        if (Math.hypot(sx - top.x, sy - top.y) < 8) {
          drag.current = { kind: "rotate", center: c, a0: Math.atan2(pt[1] - c[1], pt[0] - c[0]), orig: m, key: `rot-${Date.now()}` };
          return;
        }
        if (pts.some((q) => Math.hypot(sx - q.x, sy - q.y) < 8)) {
          drag.current = { kind: "scale", center: c, d0: Math.hypot(pt[0] - c[0], pt[1] - c[1]) || 1, orig: m, key: `sc-${Date.now()}` };
          return;
        }
      }
    }
    if (h) {
      const already = p.sel.some((s) => s.id === h.el.id);
      const next = e.shiftKey ? (already ? p.sel.filter((s) => s.id !== h.el.id) : [...p.sel, { layer: h.layer, id: h.el.id }]) : already ? p.sel : [{ layer: h.layer, id: h.el.id }];
      p.setSel(next);
      const orig = new Map<string, El>();
      for (const s of next) {
        const l = p.tl.layers.find((x) => x.id === s.layer);
        const el = l && runtime.frameElements(l.keyframes, p.frame).find((x) => x.id === s.id);
        if (el) orig.set(el.id, el);
      }
      drag.current = { kind: "move", start: pt, orig, key: `mv-${Date.now()}` };
    } else p.setSel([]);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const pt = toDoc(sx, sy);
    if (d.kind === "pan") setView({ ...view, x: d.orig.x + sx - d.start[0], y: d.orig.y + sy - d.start[1] });
    else if (d.kind === "draw") {
      d.pts.push(pt);
      redraw((n) => n + 1);
    } else if (d.kind === "shape") {
      d.b = e.shiftKey && p.tool !== "line" ? [d.a[0] + Math.sign(pt[0] - d.a[0]) * Math.max(Math.abs(pt[0] - d.a[0]), Math.abs(pt[1] - d.a[1])), d.a[1] + Math.sign(pt[1] - d.a[1]) * Math.max(Math.abs(pt[0] - d.a[0]), Math.abs(pt[1] - d.a[1]))] : pt;
      redraw((n) => n + 1);
    } else if (d.kind === "move") {
      const dx = pt[0] - d.start[0];
      const dy = pt[1] - d.start[1];
      p.onPatch((el) => {
        const o = d.orig.get(el.id);
        return o ? { ...el, t: { ...el.t, x: o.t.x + dx, y: o.t.y + dy } } : el;
      }, d.key);
    } else if (d.kind === "scale") {
      const k = Math.hypot(pt[0] - d.center[0], pt[1] - d.center[1]) / d.d0;
      p.onPatch((el) => {
        const o = d.orig.get(el.id);
        if (!o) return el;
        // Escala alrededor del centro de la caja
        const nx = d.center[0] + (o.t.x - d.center[0]) * k;
        const ny = d.center[1] + (o.t.y - d.center[1]) * k;
        return { ...el, t: { ...el.t, x: nx, y: ny, sx: o.t.sx * k, sy: o.t.sy * k } };
      }, d.key);
    } else if (d.kind === "rotate") {
      let da = ((Math.atan2(pt[1] - d.center[1], pt[0] - d.center[0]) - d.a0) * 180) / Math.PI;
      if (e.shiftKey) da = Math.round(da / 15) * 15;
      const rad = (da * Math.PI) / 180;
      p.onPatch((el) => {
        const o = d.orig.get(el.id);
        if (!o) return el;
        const rx = o.t.x - d.center[0];
        const ry = o.t.y - d.center[1];
        return { ...el, t: { ...el.t, x: d.center[0] + rx * Math.cos(rad) - ry * Math.sin(rad), y: d.center[1] + rx * Math.sin(rad) + ry * Math.cos(rad), rot: o.t.rot + da } };
      }, d.key);
    } else if (d.kind === "erase") {
      const h = hit(pt);
      if (h) p.onErase(h.layer, [h.el.id]);
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "draw" && d.pts.length > 1) {
      const pts = simplify(d.pts, 1.2 / view.zoom);
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const first = pts[0];
      const last = pts[pts.length - 1];
      const closed = pts.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 14 / view.zoom;
      const brush = p.tool === "brush";
      p.onAdd({
        id: newId("el"),
        kind: "path",
        t: { x: cx, y: cy, sx: 1, sy: 1, rot: 0 },
        alpha: 1,
        points: pts.map((q) => [q[0] - cx, q[1] - cy]),
        closed,
        stroke: brush ? p.style.fill || p.style.stroke : p.style.stroke,
        strokeWidth: brush ? p.style.strokeWidth : Math.max(1, p.style.strokeWidth / 3),
        fill: closed ? p.style.fill : null,
      });
    } else if (d.kind === "shape") {
      const [a, b] = [d.a, d.b];
      const w = Math.abs(b[0] - a[0]);
      const h = Math.abs(b[1] - a[1]);
      if (p.tool === "line") {
        if (Math.hypot(w, h) < 3) return;
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        p.onAdd({ id: newId("el"), kind: "path", t: { x: cx, y: cy, sx: 1, sy: 1, rot: 0 }, alpha: 1, points: [[a[0] - cx, a[1] - cy], [b[0] - cx, b[1] - cy]], closed: false, stroke: p.style.stroke, strokeWidth: p.style.strokeWidth, fill: null });
      } else {
        if (w < 3 || h < 3) return;
        p.onAdd({ id: newId("el"), kind: p.tool === "rect" ? "rect" : "ellipse", t: { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, sx: 1, sy: 1, rot: 0 }, alpha: 1, w, h, stroke: p.style.stroke, strokeWidth: Math.max(0, p.style.strokeWidth / 2), fill: p.style.fill });
      }
    }
    redraw((n) => n + 1);
  };

  const onDouble = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const h = hit(toDoc(e.clientX - r.left, e.clientY - r.top));
    if (h?.el.kind === "instance" && h.el.symbolId) p.onEnterSymbol(h.el.symbolId);
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const zoom = Math.max(0.05, Math.min(10, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    setView({ zoom, x: sx - ((sx - view.x) / view.zoom) * zoom, y: sy - ((sy - view.y) / view.zoom) * zoom });
  };

  return (
    <div ref={hostRef} className="flex-1 min-h-0 relative" data-stage>
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h, cursor: p.tool === "hand" ? "grab" : p.tool === "select" ? "default" : "crosshair" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDouble} onWheel={onWheel} />
      <button type="button" onClick={fit} className="absolute bottom-2 right-2 text-[11px] bg-black/50 rounded px-2 py-0.5 text-[#c9c9cf] hover:text-white">
        {Math.round(view.zoom * 100)} %
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------

const TimelinePanel: React.FC<{
  tl: Timeline;
  frame: number;
  setFrame: (f: number) => void;
  layerId: string;
  setLayerId: (id: string) => void;
  onLayer: (id: string, fn: (l: ALayer) => ALayer, key?: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: () => void;
  onCmd: (k: "key" | "blank" | "clear" | "frame" | "unframe" | "tween" | "untween") => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  onion: boolean;
  setOnion: (v: boolean) => void;
  fps: number;
  onReorder: (from: number, to: number) => void;
}> = (p) => {
  const shown = Math.max(p.tl.length + 20, 60);
  const scrub = useRef(false);
  const pick = (e: React.PointerEvent, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    p.setFrame(Math.max(0, Math.min(shown - 1, Math.floor((e.clientX - r.left + el.scrollLeft) / CELL))));
  };
  return (
    <div className="h-[210px] shrink-0 bg-[#1a1a1d] border-t border-black/60 flex flex-col" data-timeline>
      <div className="h-8 flex items-center gap-1 px-2 border-b border-black/50 text-[11px]">
        <IconButton icon={p.playing ? Pause : Play} title="Reproducir (Intro)" active={p.playing} accent={ACCENT} onClick={() => p.setPlaying(!p.playing)} data-tool="play" />
        <span className="font-mono text-[#ffc078] w-28" data-frame>
          Fotograma {p.frame + 1} / {p.tl.length}
        </span>
        <span className="text-[#6f6f77] w-20">{(p.frame / p.fps).toFixed(2)} s</span>
        <Button onClick={() => p.onCmd("key")} title="F6">Clave</Button>
        <Button onClick={() => p.onCmd("blank")} title="F7">Clave vacía</Button>
        <Button onClick={() => p.onCmd("frame")} title="F5">+ Fotograma</Button>
        <Button onClick={() => p.onCmd("tween")}>Interpolación clásica</Button>
        <Button onClick={() => p.onCmd("clear")} title="Mayús+F6">Borrar clave</Button>
        <div className="flex-1" />
        <Toggle checked={p.onion} onChange={p.setOnion} label="Papel cebolla" accent={ACCENT} />
      </div>
      <div className="flex-1 flex min-h-0 overflow-y-auto">
        <div className="w-[230px] shrink-0 border-r border-black/50">
          <div className="h-5 flex items-center gap-1 px-2 text-[10px] text-[#8b8b93] border-b border-black/40">
            <button type="button" onClick={p.onAddLayer} title="Capa nueva" className="hover:text-white" data-add-layer>
              <Plus size={12} />
            </button>
            <button type="button" onClick={p.onDeleteLayer} title="Borrar capa" className="hover:text-white">
              <Trash2 size={11} />
            </button>
          </div>
          {p.tl.layers.map((l, i) => (
            <div
              key={l.id}
              onClick={() => p.setLayerId(l.id)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/coffee-alayer", String(i))}
              onDragOver={(e) => e.dataTransfer.types.includes("text/coffee-alayer") && e.preventDefault()}
              onDrop={(e) => {
                const from = Number(e.dataTransfer.getData("text/coffee-alayer"));
                if (isFinite(from) && from !== i) p.onReorder(from, i);
              }}
              className={cx("h-6 flex items-center gap-1.5 px-2 text-[12px] cursor-pointer border-b border-black/30", l.id === p.layerId ? "bg-[#3b2626]" : "hover:bg-white/5")}
              data-layer={l.name}
            >
              <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
              <input value={l.name} onChange={(e) => p.onLayer(l.id, (x) => ({ ...x, name: e.target.value }), "lname")} onKeyDown={(e) => e.stopPropagation()} className="flex-1 min-w-0 bg-transparent outline-none" />
              <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (x) => ({ ...x, visible: !x.visible })))} className="text-[#9a9aa2] hover:text-white">
                {l.visible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
              <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (x) => ({ ...x, locked: !x.locked })))} className="text-[#9a9aa2] hover:text-white">
                {l.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>
              <button type="button" onClick={(e) => (e.stopPropagation(), p.onLayer(l.id, (x) => ({ ...x, outline: !x.outline })))} className="w-3 h-3 rounded-sm border" style={{ borderColor: l.color, background: l.outline ? "transparent" : l.color }} title="Ver como contornos" />
            </div>
          ))}
        </div>
        <div
          className="flex-1 overflow-x-auto relative"
          onPointerDown={(e) => {
            scrub.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            pick(e, e.currentTarget);
          }}
          onPointerMove={(e) => scrub.current && pick(e, e.currentTarget)}
          onPointerUp={() => (scrub.current = false)}
          data-frames
        >
          <div style={{ width: shown * CELL }} className="relative">
            <div className="h-5 border-b border-black/40 relative text-[9px] text-[#8b8b93]">
              {Array.from({ length: Math.ceil(shown / 5) }, (_, i) => (
                <span key={i} className="absolute top-0.5" style={{ left: i * 5 * CELL + 2 }}>
                  {i * 5 + 1}
                </span>
              ))}
            </div>
            {p.tl.layers.map((l) => (
              <div key={l.id} className="h-6 relative border-b border-black/30" style={{ background: `repeating-linear-gradient(90deg, #232327 0 ${CELL - 1}px, #2c2c31 ${CELL - 1}px ${CELL}px)` }}>
                {/* Extensión de la capa */}
                <div className="absolute top-0 bottom-0 bg-white/[0.04]" style={{ left: 0, width: p.tl.length * CELL }} />
                {l.keyframes.map((k, i) => {
                  const next = l.keyframes[i + 1];
                  const end = next ? next.frame : p.tl.length;
                  return (
                    <React.Fragment key={k.frame}>
                      {k.tween === "classic" && next && <div className="absolute top-[3px] bottom-[3px] bg-[#9775fa]/40 border-y border-[#9775fa]" style={{ left: k.frame * CELL + CELL / 2, width: (next.frame - k.frame) * CELL }} />}
                      <div className="absolute top-0 bottom-0 border-r border-black/50" style={{ left: end * CELL - 1 }} />
                      <div className="absolute top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full border border-black" style={{ left: k.frame * CELL + 3, background: k.elements.length ? "#111" : "#fff" }} data-key-frame={k.frame} />
                      {k.label && (
                        <span className="absolute top-0 text-[8px] text-[#ffa94d] pointer-events-none" style={{ left: k.frame * CELL + 12 }}>
                          {k.label}
                        </span>
                      )}
                      {k.script === "stop" && (
                        <span className="absolute top-0 text-[9px] text-[#ff6b6b] font-bold pointer-events-none" style={{ left: k.frame * CELL + 1 }}>
                          a
                        </span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
            <div className="absolute top-0 bottom-0 w-px bg-[#ff6b6b] pointer-events-none" style={{ left: p.frame * CELL + CELL / 2 }}>
              <div className="absolute -top-0 -left-[6px] w-[13px] h-[14px] bg-[#ff6b6b]/80 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Propiedades y biblioteca
// ---------------------------------------------------------------------------

const PropsPanel: React.FC<{
  doc: AnimDoc;
  items: { layer: ALayer; el: El }[];
  keyframe: ReturnType<typeof Object> | null;
  onPatch: (fn: (e: El) => El, key?: string) => void;
  onKey: (patch: Partial<{ tween: "none" | "classic"; ease: number; spin: number; label: string; script: "" | "stop" }>) => void;
  onSymbol: (id: string, patch: Partial<SymbolDef>) => void;
}> = ({ doc, items, keyframe, onPatch, onKey, onSymbol }) => {
  const k = keyframe as { tween: "none" | "classic"; ease: number; spin: number; label?: string; script?: string; frame: number } | null;
  const el = items.length === 1 ? items[0].el : null;
  const sym = el?.kind === "instance" ? doc.symbols.find((s) => s.id === el.symbolId) : null;
  return (
    <>
      <div className="px-3 h-8 flex items-center border-b border-black/40 text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Propiedades</div>
      {el ? (
        <Section title={el.kind === "instance" ? `Instancia de «${sym?.name || "?"}»` : { path: "Trazo", rect: "Rectángulo", ellipse: "Óvalo", text: "Texto", image: "Imagen", instance: "Instancia" }[el.kind]}>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={Math.round(el.t.x)} onChange={(v) => onPatch((e) => ({ ...e, t: { ...e.t, x: v } }), "px")} />
            <NumberField label="Y" value={Math.round(el.t.y)} onChange={(v) => onPatch((e) => ({ ...e, t: { ...e.t, y: v } }), "py")} />
            <NumberField label="Escala X" value={Math.round(el.t.sx * 100)} suffix="%" onChange={(v) => onPatch((e) => ({ ...e, t: { ...e.t, sx: v / 100 } }), "psx")} />
            <NumberField label="Escala Y" value={Math.round(el.t.sy * 100)} suffix="%" onChange={(v) => onPatch((e) => ({ ...e, t: { ...e.t, sy: v / 100 } }), "psy")} />
            <NumberField label="Giro" value={Math.round(el.t.rot)} suffix="°" onChange={(v) => onPatch((e) => ({ ...e, t: { ...e.t, rot: v } }), "prot")} />
            <NumberField label="Alfa" value={Math.round(el.alpha * 100)} min={0} max={100} suffix="%" onChange={(v) => onPatch((e) => ({ ...e, alpha: v / 100 }), "palpha")} />
          </div>
          {el.kind !== "instance" && el.kind !== "image" && (
            <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
              Relleno <input type="color" value={(el.fill || "#000000").slice(0, 7)} onChange={(e) => onPatch((x) => ({ ...x, fill: e.target.value }), "pfill")} className="w-7 h-6 bg-transparent" />
              {el.kind !== "text" && (
                <>
                  Trazo <input type="color" value={(el.stroke || "#000000").slice(0, 7)} onChange={(e) => onPatch((x) => ({ ...x, stroke: e.target.value }), "pstroke")} className="w-7 h-6 bg-transparent" />
                  <NumberField label="" value={el.strokeWidth || 0} min={0} max={100} onChange={(v) => onPatch((x) => ({ ...x, strokeWidth: v }), "psw")} className="w-16" />
                </>
              )}
            </div>
          )}
          {el.kind === "text" && (
            <>
              <textarea value={el.text || ""} onChange={(e) => onPatch((x) => ({ ...x, text: e.target.value }), "ptext")} onKeyDown={(e) => e.stopPropagation()} rows={2} className="bg-[#141416] rounded p-2 text-[12px] outline-none" data-el-text />
              <div className="flex gap-2 items-center">
                <NumberField label="Tamaño" value={el.size || 32} min={4} max={400} onChange={(v) => onPatch((x) => ({ ...x, size: v }), "psize")} className="flex-1" />
                <Toggle checked={!!el.bold} onChange={(v) => onPatch((x) => ({ ...x, bold: v }))} label="Negrita" accent={ACCENT} />
              </div>
            </>
          )}
          <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
            Tinte <input type="color" value={el.tint?.color || "#ff0000"} onChange={(e) => onPatch((x) => ({ ...x, tint: { color: e.target.value, amount: x.tint?.amount ?? 0.5 } }), "ptint")} className="w-7 h-6 bg-transparent" />
            <input type="range" min={0} max={100} value={Math.round((el.tint?.amount || 0) * 100)} onChange={(e) => onPatch((x) => ({ ...x, tint: { color: x.tint?.color || "#ff0000", amount: Number(e.target.value) / 100 } }), "ptinta")} className="studio-range flex-1" />
          </div>
          {sym && sym.type !== "button" && (
            <Select value={sym.type} onChange={(v) => onSymbol(sym.id, { type: v as SymbolDef["type"] })} options={[{ value: "graphic", label: "Gráfico (sigue la línea de tiempo)" }, { value: "movieclip", label: "Clip de película (se anima solo)" }]} />
          )}
          {sym?.type === "graphic" && (
            <div className="flex gap-2">
              <Select value={el.loop || "loop"} onChange={(v) => onPatch((x) => ({ ...x, loop: v as El["loop"] }))} options={[{ value: "loop", label: "Bucle" }, { value: "once", label: "Reproducir una vez" }, { value: "single", label: "Fotograma único" }]} className="flex-1" />
              <NumberField label="Primero" value={(el.firstFrame || 0) + 1} min={1} max={sym.timeline.length} onChange={(v) => onPatch((x) => ({ ...x, firstFrame: v - 1 }), "pff")} className="w-24" />
            </div>
          )}
          {sym?.type === "button" && <ActionEditor action={el.action || null} onChange={(a) => onPatch((x) => ({ ...x, action: a }))} />}
        </Section>
      ) : (
        <div className="px-3 py-3 text-[11px] text-[#6f6f77]">{items.length > 1 ? `${items.length} elementos seleccionados` : "Selecciona un elemento del escenario (V) para editarlo."}</div>
      )}
      {k && (
        <Section title={`Fotograma clave ${k.frame + 1}`}>
          <Select value={k.tween} onChange={(v) => onKey({ tween: v as "none" | "classic" })} options={[{ value: "none", label: "Sin interpolación" }, { value: "classic", label: "Interpolación clásica" }]} data-name="tween" />
          {k.tween === "classic" && (
            <>
              <Slider label="Suavizado (− acelera, + frena)" value={k.ease} min={-100} max={100} onChange={(v) => onKey({ ease: v })} />
              <NumberField label="Vueltas" value={k.spin} min={-20} max={20} onChange={(v) => onKey({ spin: Math.round(v) })} />
            </>
          )}
          <label className="flex flex-col gap-1 text-[11px] text-[#9a9aa2]">
            Etiqueta
            <input value={k.label || ""} onChange={(e) => onKey({ label: e.target.value })} onKeyDown={(e) => e.stopPropagation()} className="bg-[#141416] rounded px-2 h-7 text-[12px] text-white" />
          </label>
          <Toggle checked={k.script === "stop"} onChange={(v) => onKey({ script: v ? "stop" : "" })} label="Acción: detener aquí (stop)" accent={ACCENT} />
        </Section>
      )}
    </>
  );
};

const ActionEditor: React.FC<{ action: Action | null; onChange: (a: Action | null) => void }> = ({ action, onChange }) => {
  const type = action?.type || "none";
  return (
    <div className="flex flex-col gap-2" data-action-editor>
      <Select
        value={type}
        onChange={(v) => onChange(v === "none" ? null : v === "gotoAndPlay" || v === "gotoAndStop" ? { type: v, frame: 0 } : v === "url" ? { type: "url", url: "https://" } : ({ type: v } as Action))}
        options={[
          { value: "none", label: "Al hacer clic: nada" },
          { value: "play", label: "Reproducir" },
          { value: "stop", label: "Detener" },
          { value: "next", label: "Fotograma siguiente" },
          { value: "prev", label: "Fotograma anterior" },
          { value: "gotoAndPlay", label: "Ir al fotograma y reproducir" },
          { value: "gotoAndStop", label: "Ir al fotograma y detener" },
          { value: "url", label: "Abrir una página web" },
        ]}
      />
      {action && (action.type === "gotoAndPlay" || action.type === "gotoAndStop") && <NumberField label="Fotograma" value={action.frame + 1} min={1} onChange={(v) => onChange({ ...action, frame: Math.max(0, Math.round(v) - 1) })} />}
      {action?.type === "url" && <input value={action.url} onChange={(e) => onChange({ type: "url", url: e.target.value })} onKeyDown={(e) => e.stopPropagation()} className="bg-[#141416] rounded px-2 h-7 text-[12px]" />}
    </div>
  );
};

const Library: React.FC<{ doc: AnimDoc; onEdit: (id: string) => void; onPlace: (s: SymbolDef) => void; onDelete: (id: string) => void; onRename: (s: SymbolDef) => void }> = ({ doc, onEdit, onPlace, onDelete, onRename }) => (
  <div className="border-t border-black/50" data-library>
    <div className="px-3 h-8 flex items-center text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Biblioteca</div>
    {!doc.symbols.length && <div className="px-3 pb-3 text-[11px] text-[#6f6f77]">Selecciona dibujos y pulsa F8 para crear símbolos reutilizables.</div>}
    {doc.symbols.map((s) => {
      const Icon = s.type === "button" ? MousePointerClick : s.type === "movieclip" ? Film : Shapes;
      return (
        <div key={s.id} className="group flex items-center gap-2 px-3 py-1 text-[12px] hover:bg-white/5" onDoubleClick={() => onEdit(s.id)} data-symbol={s.name}>
          <Icon size={12} className="text-[#ff8787]" />
          <span className="flex-1 truncate" onClick={() => onRename(s)}>
            {s.name}
          </span>
          <span className="text-[10px] text-[#6f6f77]">{s.type === "button" ? "botón" : s.type === "movieclip" ? "clip" : "gráfico"}</span>
          <button type="button" onClick={() => onPlace(s)} className="opacity-0 group-hover:opacity-100 text-[#9a9aa2] hover:text-white" title="Colocar en el escenario">
            <Plus size={12} />
          </button>
          <button type="button" onClick={() => onDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-[#9a9aa2] hover:text-white" title="Borrar">
            <Trash2 size={11} />
          </button>
        </div>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

const SymbolDialog: React.FC<{ onOk: (name: string, type: SymbolDef["type"]) => void; onCancel: () => void; count: number }> = ({ onOk, onCancel, count }) => {
  const [name, setName] = useState(`Símbolo ${count + 1}`);
  const [type, setType] = useState<SymbolDef["type"]>("graphic");
  return (
    <Modal title="Convertir en símbolo" onClose={onCancel} width={360} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onOk(name || "Símbolo", type)}>Aceptar</Button></>}>
      <label className="flex flex-col gap-1 text-[11px] text-[#9a9aa2]">
        Nombre
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="bg-[#141416] rounded px-2 h-7 text-[12px] text-white" data-symbol-name />
      </label>
      <Select value={type} onChange={(v) => setType(v as SymbolDef["type"])} options={[{ value: "graphic", label: "Gráfico" }, { value: "movieclip", label: "Clip de película" }, { value: "button", label: "Botón" }]} data-name="symbol-type" />
    </Modal>
  );
};

const DocDialog: React.FC<{ doc: AnimDoc; onOk: (p: Partial<AnimDoc>) => void; onCancel: () => void }> = ({ doc, onOk, onCancel }) => {
  const [w, setW] = useState(doc.width);
  const [h, setH] = useState(doc.height);
  const [fps, setFps] = useState(doc.fps);
  const [bg, setBg] = useState(doc.background);
  return (
    <Modal title="Ajustes del documento" onClose={onCancel} width={360} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onOk({ width: w, height: h, fps, background: bg })}>Aceptar</Button></>}>
      <div className="flex gap-2">
        <NumberField label="Ancho" value={w} min={16} max={4096} onChange={(v) => setW(Math.round(v))} className="flex-1" />
        <NumberField label="Alto" value={h} min={16} max={4096} onChange={(v) => setH(Math.round(v))} className="flex-1" />
      </div>
      <Select value={String(fps)} onChange={(v) => setFps(Number(v))} options={[8, 12, 15, 24, 25, 30, 60].map((f) => ({ value: String(f), label: `${f} fps` }))} />
      <label className="flex items-center gap-2 text-[12px]">
        Color de fondo <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-8 h-6 bg-transparent" />
      </label>
    </Modal>
  );
};

const ExportDialog: React.FC<{ doc: AnimDoc; onExport: (f: VideoFormat | "html", scale: number, transparent: boolean) => void; onCancel: () => void }> = ({ doc, onExport, onCancel }) => {
  const [format, setFormat] = useState<VideoFormat | "html">("html");
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(false);
  const options = [{ value: "html", label: "HTML5 interactivo (página web con botones)" }, ...(Object.keys(FORMAT_LABEL) as VideoFormat[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))];
  return (
    <Modal title="Exportar" onClose={onCancel} width={420} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onExport(format, scale, transparent)}>Exportar</Button></>}>
      <Select value={format} onChange={(v) => setFormat(v as VideoFormat | "html")} options={options} data-name="format" />
      {format !== "html" && (
        <>
          <Select value={String(scale)} onChange={(v) => setScale(Number(v))} options={[{ value: "1", label: `Tamaño completo (${doc.width}×${doc.height})` }, { value: "0.5", label: "Mitad" }, { value: "2", label: "Doble" }]} />
          {(format === "gif" || format === "png" || format === "mov" || format === "gif-ffmpeg") && <Toggle checked={transparent} onChange={setTransparent} label="Fondo transparente" accent={ACCENT} />}
        </>
      )}
      {needsFfmpeg(format as VideoFormat) && !isTauri && <span className="text-[11px] text-[#ffa94d]">Este formato necesita la aplicación de escritorio con FFmpeg.</span>}
      <span className="text-[11px] text-[#8b8b93]">
        {doc.main.length} fotogramas · {(doc.main.length / doc.fps).toFixed(2)} s a {doc.fps} fps
      </span>
    </Modal>
  );
};

const TestMovie: React.FC<{ doc: AnimDoc; onClose: () => void }> = ({ doc, onClose }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const player = useMemo(() => ({ current: null as ReturnType<typeof runtime.createPlayer> | null }), []);
  useEffect(() => {
    if (!ref.current) return;
    player.current = runtime.createPlayer(ref.current, doc);
    return () => player.current?.destroy();
  }, [doc, player]);
  const w = Math.min(window.innerWidth * 0.8, (window.innerHeight * 0.7 * doc.width) / doc.height);
  return (
    <Modal title="Probar película" onClose={onClose} width={w + 40} footer={<Button primary accent={ACCENT} onClick={onClose}>Cerrar</Button>}>
      <canvas ref={ref} style={{ width: w, height: (w * doc.height) / doc.width }} className="rounded" data-test-canvas />
      <span className="text-[11px] text-[#8b8b93]">Así se verá la exportación HTML5: los botones responden al ratón.</span>
    </Modal>
  );
};

