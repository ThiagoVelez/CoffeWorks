import React, { useCallback, useEffect, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, ZoomIn, ZoomOut, Maximize, RotateCcw, RotateCw, ScanLine, ImagePlus, FlipHorizontal2 } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, ColorSwatch, IconButton, Modal, NumberField, STUDIO_CSS, Select } from "./studio/ui";
import { extensionOf, pickOpenFile, saveFileAs } from "./studio/desktop";
import { makeZip } from "./studio/zip";
import { traceImage } from "./studio/trace";
import { Canvas, type CanvasHandle, type View } from "./components/Canvas";
import { BrushPanel, ColorPanel, LayersPanel, TOOLS, ToolBar } from "./components/Panels";
import { ACCENT, ACCENT_DARK, type PaintDoc, type Paper, type Symmetry, type Tool } from "./types";
import { activeLayer, blankLayer, compose, docFromImage, newDocument, parseDocument, serializeDocument, tokensOf, updateLayer } from "./services/model";
import { ctx2d, fromCanvas, getCanvas, newCanvas, setKeep, subscribe } from "./services/pixels";
import { BRUSHES, type BrushDef } from "./services/brushes";

const store = createDocStore<PaintDoc>({
  appId: "coffeepaint",
  extension: "cpt",
  category: "Ilustración",
  defaultTitle: "Pintura sin título",
  kindLabel: "Pinturas de CoffeePaint",
  serialize: serializeDocument,
  parse: parseDocument,
  create: () => newDocument(),
});

const SWATCHES = ["#1b1b1f", "#5c4033", "#8d5524", "#c68642", "#f1c27d", "#ffdbac", "#ffffff", "#d7263d", "#f46036", "#f9c80e", "#7cb518", "#2e86ab", "#1b998b", "#5f0f40", "#9a031e", "#e64980", "#7048e8", "#4dabf7", "#a3e635", "#fde68a"];

const PRESETS: Array<{ label: string; w: number; h: number }> = [
  { label: "Pantalla (1920 × 1080)", w: 1920, h: 1080 },
  { label: "Cuadrado (2048 × 2048)", w: 2048, h: 2048 },
  { label: "Vertical (1536 × 2048)", w: 1536, h: 2048 },
  { label: "A4 a 150 ppp (1240 × 1754)", w: 1240, h: 1754 },
  { label: "A4 a 300 ppp (2480 × 3508)", w: 2480, h: 3508 },
  { label: "Página de cómic (1800 × 2700)", w: 1800, h: 2700 },
  { label: "Fondo de pantalla del móvil (1170 × 2532)", w: 1170, h: 2532 },
];

const PAPERS: Array<{ value: Paper; label: string }> = [
  { value: "sketch", label: "Papel de boceto" },
  { value: "watercolor", label: "Papel de acuarela" },
  { value: "canvas", label: "Lienzo" },
  { value: "smooth", label: "Liso" },
];

type DialogState = { kind: "new" } | { kind: "canvas" } | { kind: "export" } | null;

export const App: React.FC = () => {
  const canvasRef = useRef<CanvasHandle>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1, rot: 0 });
  const [tool, setTool] = useState<Tool>("brush");
  const [brush, setBrush] = useState<BrushDef>(BRUSHES.find((b) => b.id === "ink")!);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [opacity, setOpacity] = useState(1);
  const [smoothing, setSmoothing] = useState(brush.smoothing);
  const [color, setColorState] = useState("#1b1b1f");
  const [recent, setRecent] = useState<string[]>(["#1b1b1f"]);
  const [symmetry, setSymmetry] = useState<Symmetry>("none");
  const [radial, setRadial] = useState(6);
  const [penOnly, setPenOnly] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pixelVersion, setPixelVersion] = useState(0);

  const sd = useStudioDoc<PaintDoc>(store, {
    appName: "CoffeePaint",
    importExtensions: ["png", "jpg", "jpeg", "webp"],
    importFile: async (file) => {
      const ext = extensionOf(file.name);
      const bmp = await createImageBitmap(new Blob([file.bytes as BlobPart], { type: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}` }));
      const c = newCanvas(bmp.width, bmp.height);
      ctx2d(c).drawImage(bmp, 0, 0);
      return docFromImage(c);
    },
    onLoaded: () => window.setTimeout(() => canvasRef.current?.fit(), 40),
    historyLimit: 40,
  });
  const doc = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = useCallback((next: PaintDoc, key = "") => sd.apply(next, key), [sd]);
  useEffect(() => setKeep(() => new Set(sd.docRef.current ? tokensOf(sd.docRef.current) : [])), [sd.docRef]);
  useEffect(() => subscribe(() => setPixelVersion((v) => v + 1)), []);

  const toolBrush = tool === "eraser" ? "eraser" : tool === "smudge" ? "smudge" : brush.id;
  const size = sizes[toolBrush] ?? (tool === "eraser" ? 40 : tool === "smudge" ? 40 : brush.size);
  const setSize = (v: number) => setSizes((s) => ({ ...s, [toolBrush]: Math.max(1, Math.min(400, Math.round(v))) }));

  const setColor = (c: string) => {
    setColorState(c);
    setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 10));
  };

  // ------------------------------------------------------------------------
  // Capas
  // ------------------------------------------------------------------------

  const commit = (layerId: string, canvas: HTMLCanvasElement) => apply(updateLayer(cur(), layerId, { data: fromCanvas(canvas) }));

  const addLayer = () => {
    const d = cur();
    const l = blankLayer(d.width, d.height, `Capa ${d.layers.length + 1}`);
    const idx = d.layers.findIndex((x) => x.id === d.activeId);
    const layers = [...d.layers];
    layers.splice(idx + 1, 0, l);
    apply({ ...d, layers, activeId: l.id });
  };

  const duplicateLayer = () => {
    const d = cur();
    const a = activeLayer(d);
    const l = { ...a, id: `${a.id}c${Date.now().toString(36)}`, name: `${a.name} copia` };
    const idx = d.layers.indexOf(a);
    const layers = [...d.layers];
    layers.splice(idx + 1, 0, l);
    apply({ ...d, layers, activeId: l.id });
  };

  const deleteLayer = () => {
    const d = cur();
    if (d.layers.length < 2) return;
    const idx = d.layers.findIndex((l) => l.id === d.activeId);
    const layers = d.layers.filter((l) => l.id !== d.activeId);
    apply({ ...d, layers, activeId: layers[Math.max(0, idx - 1)].id });
  };

  const mergeDown = () => {
    const d = cur();
    const i = d.layers.findIndex((l) => l.id === d.activeId);
    if (i < 1) return;
    const lower = d.layers[i - 1];
    const merged = compose({ ...d, layers: [{ ...lower, opacity: 1, blend: "source-over" }, d.layers[i]] }, { paper: false });
    const layers = [...d.layers];
    layers.splice(i - 1, 2, { ...lower, data: fromCanvas(merged) });
    apply({ ...d, layers, activeId: lower.id });
  };

  const moveLayer = (id: string, to: number) => {
    const d = cur();
    const layers = [...d.layers];
    const from = layers.findIndex((l) => l.id === id);
    const [l] = layers.splice(from, 1);
    layers.splice(to, 0, l);
    apply({ ...d, layers });
  };

  const clearLayer = () => {
    const d = cur();
    commit(d.activeId, newCanvas(d.width, d.height));
  };

  const fillLayer = () => {
    const d = cur();
    const a = activeLayer(d);
    const c = newCanvas(d.width, d.height);
    const g = ctx2d(c);
    const src = getCanvas(a.data);
    if (src) g.drawImage(src, 0, 0);
    g.globalCompositeOperation = a.alphaLock ? "source-atop" : "source-over";
    g.fillStyle = color;
    g.fillRect(0, 0, d.width, d.height);
    commit(a.id, c);
  };

  const flipLayer = (h: boolean) => {
    const d = cur();
    const a = activeLayer(d);
    const src = getCanvas(a.data);
    if (!src) return;
    const c = newCanvas(d.width, d.height);
    const g = ctx2d(c);
    g.translate(h ? d.width : 0, h ? 0 : d.height);
    g.scale(h ? -1 : 1, h ? 1 : -1);
    g.drawImage(src, 0, 0);
    commit(a.id, c);
  };

  const importLayer = async () => {
    const file = await pickOpenFile([{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] }], "Importar imagen como capa");
    if (!file) return;
    const ext = extensionOf(file.name);
    const bmp = await createImageBitmap(new Blob([file.bytes as BlobPart], { type: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}` }));
    const d = cur();
    const k = Math.min(1, d.width / bmp.width, d.height / bmp.height);
    const c = newCanvas(d.width, d.height);
    ctx2d(c).drawImage(bmp, (d.width - bmp.width * k) / 2, (d.height - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    const l = { ...blankLayer(d.width, d.height, file.name.replace(/\.[^.]+$/, "")), data: fromCanvas(c), opacity: 0.6 };
    const layers = [...d.layers];
    layers.splice(layers.findIndex((x) => x.id === d.activeId) + 1, 0, l);
    apply({ ...d, layers, activeId: l.id });
    toast("Imagen importada como referencia (opacidad 60 %)", "info");
  };

  // ------------------------------------------------------------------------
  // Exportar
  // ------------------------------------------------------------------------

  const runBusy = async (msg: string, fn: () => Promise<void>) => {
    setBusy(msg);
    try {
      await fn();
    } catch (err) {
      await showMessage("No se pudo completar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const blobOf = (c: HTMLCanvasElement, type: string) => new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), type, 0.92));

  const doExport = (format: "png" | "png-transparent" | "jpg" | "layers") =>
    runBusy("Exportando…", async () => {
      setDialog(null);
      const d = cur();
      const base = sd.title || "Pintura";
      let blob: Blob;
      let name: string;
      if (format === "layers") {
        const entries = await Promise.all(
          d.layers.map(async (l, i) => ({ name: `${String(i + 1).padStart(2, "0")} ${l.name}.png`, data: new Uint8Array(await (await blobOf(getCanvas(l.data) || newCanvas(1, 1), "image/png")).arrayBuffer()) }))
        );
        entries.push({ name: "Imagen completa.png", data: new Uint8Array(await (await blobOf(compose(d), "image/png")).arrayBuffer()) });
        blob = makeZip(entries);
        name = `${base} (capas).zip`;
      } else {
        blob = await blobOf(compose(d, { paper: format !== "png-transparent" }), format === "jpg" ? "image/jpeg" : "image/png");
        name = `${base}.${format === "jpg" ? "jpg" : "png"}`;
      }
      const ext = name.split(".").pop()!;
      const path = await saveFileAs(name, [{ name: ext.toUpperCase(), extensions: [ext] }], blob, "Exportar");
      if (path !== null) toast("Exportado");
    });

  const vectorize = () =>
    runBusy("Vectorizando el dibujo…", async () => {
      const d = cur();
      const img = compose(d, { paper: false });
      // El calco funciona sobre fondo blanco
      const c = newCanvas(d.width, d.height);
      const g = ctx2d(c);
      g.fillStyle = "#fff";
      g.fillRect(0, 0, d.width, d.height);
      g.drawImage(img, 0, 0);
      const svgs = await traceImage(c, { mode: "color", threshold: 128, colors: 8, noise: 6, smooth: 1 }, "CoffeePaint");
      if (!svgs) return;
      const bodies = svgs.map((s) => s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""));
      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}">${bodies.join("\n")}</svg>`;
      const path = await saveFileAs(`${sd.title || "Pintura"}.svg`, [{ name: "SVG", extensions: ["svg"] }], svg, "Guardar dibujo vectorizado");
      if (path !== null) toast("Dibujo vectorizado: ábrelo en CoffeeVector para editarlo");
    });

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
          n: () => (e.shiftKey ? addLayer() : setDialog({ kind: "new" })),
          j: duplicateLayer,
          e: mergeDown,
          "0": () => canvasRef.current?.fit(),
          "=": () => canvasRef.current?.zoomBy(1.25),
          "+": () => canvasRef.current?.zoomBy(1.25),
          "-": () => canvasRef.current?.zoomBy(0.8),
          k: () => setCommandOpen(true),
        };
        const fn = map[k];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (k === "[" || k === "]") return setSize(size * (k === "]" ? 1.15 : 1 / 1.15) + (k === "]" ? 1 : -1));
      if (e.key === "Delete") return clearLayer();
      if (k === "r") return canvasRef.current?.rotateBy(e.shiftKey ? -15 : 15);
      if (k === "0") return canvasRef.current?.resetRotation();
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
            { label: "Abrir…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { label: "Importar imagen como capa…", icon: ImagePlus, action: () => void importLayer() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, shortcut: "Ctrl+Mayús+S", action: () => void sd.saveAs() },
            { label: "Exportar…", icon: Download, action: () => setDialog({ kind: "export" }) },
            { label: "Vectorizar dibujo (complemento)…", icon: ScanLine, action: () => void vectorize() },
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
            { label: "Rellenar capa con el color", action: fillLayer },
            { label: "Borrar capa", shortcut: "Supr", action: clearLayer },
            { label: "Voltear capa horizontalmente", icon: FlipHorizontal2, action: () => flipLayer(true) },
            { label: "Voltear capa verticalmente", action: () => flipLayer(false) },
          ],
        },
        {
          id: "layer",
          label: "Capa",
          items: [
            { label: "Nueva capa", shortcut: "Ctrl+Mayús+N", action: addLayer },
            { label: "Duplicar capa", shortcut: "Ctrl+J", action: duplicateLayer },
            { label: "Eliminar capa", action: deleteLayer, disabled: doc.layers.length < 2 },
            { label: "Combinar hacia abajo", shortcut: "Ctrl+E", action: mergeDown },
            { divider: true },
            { label: "Bloquear transparencia", checked: activeLayer(doc).alphaLock, action: () => apply(updateLayer(cur(), cur().activeId, { alphaLock: !activeLayer(cur()).alphaLock })) },
          ],
        },
        {
          id: "canvas",
          label: "Lienzo",
          items: [
            { label: "Papel y tamaño…", action: () => setDialog({ kind: "canvas" }) },
            { divider: true },
            { label: "Simetría: ninguna", checked: symmetry === "none", action: () => setSymmetry("none") },
            { label: "Simetría vertical", checked: symmetry === "vertical", action: () => setSymmetry("vertical") },
            { label: "Simetría horizontal", checked: symmetry === "horizontal", action: () => setSymmetry("horizontal") },
            { label: "Simetría en cuatro", checked: symmetry === "quad", action: () => setSymmetry("quad") },
            { label: "Simetría radial (mandala)", checked: symmetry === "radial", action: () => setSymmetry("radial") },
          ],
        },
        {
          id: "view",
          label: "Vista",
          items: [
            { label: "Acercar", icon: ZoomIn, shortcut: "Ctrl++", action: () => canvasRef.current?.zoomBy(1.25) },
            { label: "Alejar", icon: ZoomOut, shortcut: "Ctrl+-", action: () => canvasRef.current?.zoomBy(0.8) },
            { label: "Ajustar a la pantalla", icon: Maximize, shortcut: "Ctrl+0", action: () => canvasRef.current?.fit() },
            { label: "Girar la vista a la izquierda", icon: RotateCcw, shortcut: "Mayús+R", action: () => canvasRef.current?.rotateBy(-15) },
            { label: "Girar la vista a la derecha", icon: RotateCw, shortcut: "R", action: () => canvasRef.current?.rotateBy(15) },
            { label: "Restablecer giro", shortcut: "0", action: () => canvasRef.current?.resetRotation() },
            { label: "Dibujar solo con lápiz (los dedos mueven la vista)", checked: penOnly, action: () => setPenOnly(!penOnly) },
            { label: "Buscar comandos…", shortcut: "Ctrl+K", action: () => setCommandOpen(true) },
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Atajos y gestos",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Atajos y gestos",
                  "B pincel · S difuminar · E borrador · G relleno · I cuentagotas · V mover capa · H mano (o Espacio).\n\n[ y ] tamaño del pincel · R / Mayús+R girar la vista · 0 restablecer giro · Alt + rueda: girar · rueda: zoom · Supr: borrar la capa.\n\nCon pantalla táctil: dos dedos para mover, ampliar y girar el lienzo. El lápiz responde a la presión."
                ),
            },
            { label: "Acerca de CoffeePaint", icon: Info, action: () => void showMessage("CoffeePaint", "Pintura y dibujo digital de la suite CoffeeWorks: pinceles con presión y grano de papel (lápiz, carboncillo, pastel, tinta, caligrafía, marcador, acuarela con bordes húmedos, óleo con mezcla de color, aerógrafo), difuminar, simetría, capas y lienzo giratorio.") },
          ],
        },
      ]
    : [];

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeepaint">
      <style>{STUDIO_CSS}</style>
      {doc && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Pintura sin título"
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
          <div className="flex-1 flex min-h-0">
            <ToolBar tool={tool} onTool={setTool} color={color} recent={recent} onColor={setColor} />
            <div className="flex-1 flex flex-col min-w-0">
              <Canvas
                ref={canvasRef}
                doc={doc}
                tool={tool}
                brush={brush}
                size={size}
                opacity={opacity}
                smoothing={smoothing}
                color={color}
                symmetry={symmetry}
                radial={radial}
                penOnly={penOnly}
                fillTolerance={24}
                view={view}
                setView={setView}
                onCommit={commit}
                onPick={(c) => {
                  setColor(c);
                  setTool("brush");
                }}
                onToast={(m) => toast(m, "info")}
              />
              <div className="h-10 shrink-0 bg-[#1c1c1f] border-t border-black/50 flex items-center gap-3 px-3 text-[11px]" data-status>
                <IconButton icon={Undo2} title="Deshacer (Ctrl+Z)" onClick={sd.undo} disabled={!sd.canUndo} />
                <IconButton icon={Redo2} title="Rehacer" onClick={sd.redo} disabled={!sd.canRedo} />
                <div className="w-px h-5 bg-white/10" />
                <Select
                  value={symmetry}
                  onChange={(v) => setSymmetry(v as Symmetry)}
                  options={[
                    { value: "none", label: "Sin simetría" },
                    { value: "vertical", label: "Simetría vertical" },
                    { value: "horizontal", label: "Simetría horizontal" },
                    { value: "quad", label: "Simetría en cuatro" },
                    { value: "radial", label: "Mandala (radial)" },
                  ]}
                  title="Simetría"
                />
                {symmetry === "radial" && <NumberField label="Ejes" value={radial} min={2} max={24} onChange={setRadial} className="w-20" />}
                <div className="flex-1" />
                <IconButton icon={RotateCcw} title="Girar la vista a la izquierda" onClick={() => canvasRef.current?.rotateBy(-15)} />
                <span className="font-mono text-[#9a9aa2] w-10 text-center" data-rotation>
                  {Math.round(((view.rot % 360) + 360) % 360)}°
                </span>
                <IconButton icon={RotateCw} title="Girar la vista a la derecha" onClick={() => canvasRef.current?.rotateBy(15)} />
                <IconButton icon={Maximize} title="Ajustar (Ctrl+0)" onClick={() => canvasRef.current?.fit()} />
                <span className="font-mono text-[#9a9aa2]" data-zoom>
                  {Math.round(view.zoom * 100)} %
                </span>
                <span className="font-mono text-[#6f6f77]">
                  {doc.width} × {doc.height}
                </span>
              </div>
            </div>
            <aside className="w-[280px] shrink-0 bg-[#202023] border-l border-black/50 overflow-y-auto" data-right-panel>
              <ColorPanel color={color} onColor={setColor} swatches={SWATCHES} />
              <BrushPanel
                brushId={tool === "brush" ? brush.id : ""}
                onBrush={(b) => {
                  setBrush(b);
                  setSmoothing(b.smoothing);
                  setOpacity(b.opacity);
                  setTool("brush");
                }}
                size={size}
                onSize={setSize}
                opacity={opacity}
                onOpacity={setOpacity}
                smoothing={smoothing}
                onSmoothing={setSmoothing}
              />
              <LayersPanel
                doc={doc}
                version={pixelVersion}
                onSelect={(id) => id !== doc.activeId && apply({ ...cur(), activeId: id }, "select")}
                onPatch={(id, patch, key) => apply(updateLayer(cur(), id, patch), key)}
                onAdd={addLayer}
                onDuplicate={duplicateLayer}
                onDelete={deleteLayer}
                onMerge={mergeDown}
                onMove={moveLayer}
              />
            </aside>
          </div>
        </>
      )}

      {dialog?.kind === "new" && (
        <NewDialog
          onCancel={() => setDialog(null)}
          onCreate={(w, h, paper, pc, name) => {
            setDialog(null);
            void sd.newDocument(name, newDocument(w, h, paper, pc));
          }}
        />
      )}
      {dialog?.kind === "canvas" && doc && (
        <CanvasDialog
          doc={doc}
          onCancel={() => setDialog(null)}
          onApply={(paper, pc) => {
            setDialog(null);
            apply({ ...cur(), paper, paperColor: pc });
          }}
        />
      )}
      {dialog?.kind === "export" && (
        <Modal title="Exportar" onClose={() => setDialog(null)} width={360}>
          <div className="flex flex-col gap-2" data-export>
            <Button onClick={() => void doExport("png")}>PNG con el papel</Button>
            <Button onClick={() => void doExport("png-transparent")}>PNG transparente (sin papel)</Button>
            <Button onClick={() => void doExport("jpg")}>JPG</Button>
            <Button onClick={() => void doExport("layers")}>Capas como PNG (ZIP)</Button>
            <Button onClick={() => void vectorize()}>SVG vectorizado (complemento «Calco vectorial»)</Button>
          </div>
        </Modal>
      )}
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
          appName="CoffeePaint"
          tagline="Pintura y dibujo digital • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Lienzo con papel de boceto, acuarela o lienzo"
          openHint="Abrir una pintura .cpt o una imagen"
          formats={[".cpt", ".png", ".jpg"]}
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

const NewDialog: React.FC<{ onCreate: (w: number, h: number, paper: Paper, color: string, name: string) => void; onCancel: () => void }> = ({ onCreate, onCancel }) => {
  const [w, setW] = useState(2048);
  const [h, setH] = useState(1536);
  const [paper, setPaper] = useState<Paper>("sketch");
  const [pc, setPc] = useState("#fbf8f2");
  const [name, setName] = useState("Sin título");
  return (
    <Modal title="Lienzo nuevo" onClose={onCancel} width={440} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onCreate(w, h, paper, pc, name)}>Crear</Button></>}>
      <input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#141416] border border-black/50 rounded h-7 px-2 text-[13px] outline-none" />
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => (setW(p.w), setH(p.h))} className={`text-left px-2 py-1.5 rounded text-[11px] ${w === p.w && h === p.h ? "bg-[#e64980]/30 text-white" : "bg-[#1d1d21] text-[#c9c9cf] hover:bg-white/10"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Ancho" value={w} min={64} max={8000} onChange={setW} suffix="px" />
        <NumberField label="Alto" value={h} min={64} max={8000} onChange={setH} suffix="px" />
      </div>
      <div className="flex items-center gap-2">
        <Select value={paper} onChange={(v) => setPaper(v as Paper)} options={PAPERS} className="flex-1" />
        <ColorSwatch color={pc} onChange={setPc} showAlpha={false} title="Color del papel" />
      </div>
    </Modal>
  );
};

const CanvasDialog: React.FC<{ doc: PaintDoc; onApply: (paper: Paper, color: string) => void; onCancel: () => void }> = ({ doc, onApply, onCancel }) => {
  const [paper, setPaper] = useState<Paper>(doc.paper);
  const [pc, setPc] = useState(doc.paperColor);
  return (
    <Modal title="Papel" onClose={onCancel} width={360} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onApply(paper, pc)}>Aplicar</Button></>}>
      <div className="flex items-center gap-2">
        <Select value={paper} onChange={(v) => setPaper(v as Paper)} options={PAPERS} className="flex-1" />
        <ColorSwatch color={pc} onChange={setPc} showAlpha={false} title="Color del papel" />
      </div>
      <span className="text-[#8b8b93]">
        Tamaño: {doc.width} × {doc.height} px
      </span>
    </Modal>
  );
};
