import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, ImagePlus, Images, SlidersHorizontal, Trash2 } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askConfirm, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, Modal, NumberField, STUDIO_CSS, Select, Slider, cx } from "./studio/ui";
import { pickOpenFiles, pickedFromFile, saveFileAs, type PickedFile } from "./studio/desktop";
import { makeZip } from "./studio/zip";
import { RAW_EXTENSIONS } from "./studio/raw";
import { newId } from "./studio/color";
import { CatalogPanel, DEFAULT_FILTERS, FilterBar, Grid, InfoPanel, visiblePhotos, type Filters, type Source } from "./components/Library";
import { DevelopPanel, DevelopView, Filmstrip, PresetsPanel } from "./components/Develop";
import { ACCENT, ACCENT_DARK, LABELS, type Catalog, type Edits, type Photo, type Preset } from "./types";
import { IMAGE_EXTENSIONS, importPhoto, loadOriginal, newCatalog, parseCatalog, rememberOriginal, serializeCatalog } from "./services/library";
import { BUILTIN_PRESETS as BUILTIN, DEFAULT_EDITS, histogram, renderEdits } from "./services/develop";

const store = createDocStore<Catalog>({
  appId: "coffeelens",
  extension: "clc",
  category: "Ilustración",
  defaultTitle: "Mi catálogo",
  kindLabel: "Catálogos de CoffeeLens",
  serialize: serializeCatalog,
  parse: parseCatalog,
  create: newCatalog,
});

const ALL_EXT = [...IMAGE_EXTENSIONS, ...RAW_EXTENSIONS];

export const App: React.FC = () => {
  const sd = useStudioDoc<Catalog>(store, { appName: "CoffeeLens", historyLimit: 80, autosaveMs: 1500 });
  const cat = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = useCallback((next: Catalog, key = "") => sd.apply(next, key), [sd]);

  const [mode, setMode] = useState<"library" | "develop">("library");
  const [source, setSource] = useState<Source>({ kind: "all" });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [thumb, setThumb] = useState(170);
  const [cropMode, setCropMode] = useState(false);
  const [before, setBefore] = useState(false);
  const [hist, setHist] = useState<ReturnType<typeof histogram> | null>(null);
  const [hoverPreset, setHoverPreset] = useState<Preset | null>(null);
  const [copied, setCopied] = useState<Edits | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const dragPhoto = useRef<string | null>(null);

  const list = useMemo(() => (cat ? visiblePhotos(cat, source, filters) : []), [cat, source, filters]);
  const activePhoto = cat?.photos.find((p) => p.id === active) || null;

  useEffect(() => {
    if (!cat) return;
    if (active && !cat.photos.some((p) => p.id === active)) setActive(null);
    if (!active && list.length) setActive(list[0].id);
  }, [cat, list, active]);

  // ------------------------------------------------------------------------
  // Fotos
  // ------------------------------------------------------------------------

  const patchPhotos = (ids: string[], patch: (p: Photo) => Partial<Photo>, key = "") => {
    const c = cur();
    const set = new Set(ids);
    apply({ ...c, photos: c.photos.map((p) => (set.has(p.id) ? { ...p, ...patch(p) } : p)) }, key);
  };

  const targetIds = () => (selected.length ? selected : active ? [active] : []);

  const importFiles = async (files: PickedFile[]) => {
    const valid = files.filter((f) => ALL_EXT.includes(f.name.split(".").pop()?.toLowerCase() || ""));
    if (!valid.length) return;
    setBusy(`Importando ${valid.length} foto${valid.length === 1 ? "" : "s"}…`);
    const added: Photo[] = [];
    try {
      for (const f of valid) {
        try {
          const { photo, full } = await importPhoto(f);
          rememberOriginal(photo.id, full);
          added.push(photo);
        } catch (err) {
          toast(`No se pudo importar ${f.name}: ${err instanceof Error ? err.message : err}`, "error");
        }
      }
      if (added.length) {
        const c = cur();
        let collections = c.collections;
        if (source.kind === "collection") collections = collections.map((x) => (x.id === source.id ? { ...x, photos: [...x.photos, ...added.map((p) => p.id)] } : x));
        apply({ ...c, photos: [...c.photos, ...added], collections });
        setSelected(added.map((p) => p.id));
        setActive(added[0].id);
        toast(`${added.length} foto${added.length === 1 ? "" : "s"} importada${added.length === 1 ? "" : "s"}`);
      }
    } finally {
      setBusy(null);
    }
  };

  const importDialog = async () => {
    if (!cat) await sd.newDocument();
    const files = await pickOpenFiles([{ name: "Fotos", extensions: ALL_EXT }], "Importar fotos");
    await importFiles(files);
  };

  // Arrastrar fotos a la ventana
  useEffect(() => {
    const over = (e: DragEvent) => e.dataTransfer?.types.includes("Files") && e.preventDefault();
    const drop = async (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      if (!sd.docRef.current) await sd.newDocument();
      await importFiles(await Promise.all([...e.dataTransfer.files].map(pickedFromFile)));
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  });

  const removePhotos = async () => {
    const ids = targetIds();
    if (!ids.length) return;
    const ok = await askConfirm({ title: "Quitar del catálogo", message: `¿Quitar ${ids.length} foto${ids.length === 1 ? "" : "s"} del catálogo? Los archivos originales no se borran.`, confirmLabel: "Quitar", danger: true });
    if (!ok) return;
    const c = cur();
    const set = new Set(ids);
    apply({ ...c, photos: c.photos.filter((p) => !set.has(p.id)), collections: c.collections.map((x) => ({ ...x, photos: x.photos.filter((id) => !set.has(id)) })) });
    setSelected([]);
  };

  const select = (id: string, e: React.MouseEvent) => {
    setActive(id);
    if (e.ctrlKey || e.metaKey) setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else if (e.shiftKey && active) {
      const a = list.findIndex((p) => p.id === active);
      const b = list.findIndex((p) => p.id === id);
      setSelected(list.slice(Math.min(a, b), Math.max(a, b) + 1).map((p) => p.id));
    } else setSelected([id]);
  };

  // ------------------------------------------------------------------------
  // Revelado
  // ------------------------------------------------------------------------

  const setEdits = (e: Edits, key = "") => {
    if (!activePhoto) return;
    patchPhotos([activePhoto.id], () => ({ edits: e }), key ? `edit-${key}` : "");
  };

  // Miniatura revelada (con retardo para no frenar los deslizadores)
  const previewTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!activePhoto) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    const photo = activePhoto;
    previewTimer.current = window.setTimeout(async () => {
      const img = new Image();
      img.src = photo.thumb;
      await img.decode().catch(() => undefined);
      const isDef = JSON.stringify(photo.edits) === JSON.stringify(DEFAULT_EDITS);
      const preview = isDef ? undefined : renderEdits(img, { ...photo.edits, sharpen: 0, grain: 0 }).toDataURL("image/jpeg", 0.8);
      if (preview !== photo.preview) {
        const c = cur();
        // Sin entrada en el historial: solo cambia la miniatura
        sd.docRef.current = { ...c, photos: c.photos.map((p) => (p.id === photo.id ? { ...p, preview } : p)) };
        apply(sd.docRef.current, `thumb-${photo.id}`);
      }
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhoto?.id, JSON.stringify(activePhoto?.edits)]);

  const applyPreset = (p: Preset) => {
    const ids = mode === "develop" && activePhoto ? [activePhoto.id] : targetIds();
    patchPhotos(ids, (ph) => ({ edits: { ...DEFAULT_EDITS, ...p.edits, crop: ph.edits.crop, rotate: ph.edits.rotate, flip: ph.edits.flip } }));
    toast(`Ajuste «${p.name}» aplicado${ids.length > 1 ? ` a ${ids.length} fotos` : ""}`);
  };

  const savePreset = async () => {
    if (!activePhoto) return;
    const name = await askText({ title: "Guardar ajuste preestablecido", label: "Nombre", defaultValue: "Mi ajuste" });
    if (!name) return;
    const { crop: _c, rotate: _r, flip: _f, ...rest } = activePhoto.edits;
    void _c;
    void _r;
    void _f;
    apply({ ...cur(), presets: [...cur().presets, { id: newId("pr"), name, group: "Mis ajustes", edits: rest }] });
    toast("Ajuste guardado");
  };

  const copySettings = () => {
    if (!activePhoto) return;
    setCopied(activePhoto.edits);
    toast("Ajustes copiados");
  };
  const pasteSettings = () => {
    if (!copied) return;
    const ids = targetIds();
    patchPhotos(ids, (p) => ({ edits: { ...copied, crop: p.edits.crop } }));
    toast(`Ajustes pegados en ${ids.length} foto${ids.length === 1 ? "" : "s"}`);
  };

  const shownEdits = activePhoto ? (hoverPreset ? { ...DEFAULT_EDITS, ...hoverPreset.edits, crop: activePhoto.edits.crop, rotate: activePhoto.edits.rotate, flip: activePhoto.edits.flip } : activePhoto.edits) : DEFAULT_EDITS;

  // ------------------------------------------------------------------------
  // Exportar
  // ------------------------------------------------------------------------

  const doExport = async (opts: { format: "jpg" | "png" | "webp"; quality: number; longEdge: number; naming: "original" | "sequence"; prefix: string }) => {
    setExporting(false);
    const ids = targetIds();
    const photos = cur().photos.filter((p) => ids.includes(p.id));
    if (!photos.length) return;
    setBusy(`Exportando ${photos.length} foto${photos.length === 1 ? "" : "s"}…`);
    try {
      const entries: Array<{ name: string; data: Uint8Array }> = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        setBusy(`Exportando ${i + 1} de ${photos.length}…`);
        const original = await loadOriginal(p);
        const out = renderEdits(original, p.edits, opts.longEdge || 0);
        const type = opts.format === "jpg" ? "image/jpeg" : `image/${opts.format}`;
        const blob = await new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b!), type, opts.quality / 100));
        const base = opts.naming === "sequence" ? `${opts.prefix || "Foto"}-${String(i + 1).padStart(3, "0")}` : p.name.replace(/\.[^.]+$/, "");
        entries.push({ name: `${base}.${opts.format}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      const single = entries.length === 1;
      const blob = single ? new Blob([entries[0].data as BlobPart]) : makeZip(entries);
      const name = single ? entries[0].name : `${sd.title || "Fotos"} (${entries.length}).zip`;
      const ext = name.split(".").pop()!;
      const path = await saveFileAs(name, [{ name: ext.toUpperCase(), extensions: [ext] }], blob, "Exportar fotos");
      if (path !== null) toast(single ? "Foto exportada" : `${entries.length} fotos exportadas`);
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
      if (!sd.docRef.current || sd.showStart || exporting || document.querySelector("[data-modal-open]")) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod) {
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? sd.redo() : sd.undo()),
          y: () => sd.redo(),
          s: () => void sd.flush().then(() => toast("Catálogo guardado")),
          i: () => void importDialog(),
          a: () => setSelected(list.map((p) => p.id)),
          e: () => setExporting(true),
          c: () => e.shiftKey && copySettings(),
          v: () => e.shiftKey && pasteSettings(),
          k: () => setCommandOpen(true),
        };
        const fn = map[k];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      const ids = targetIds();
      if (/^[0-5]$/.test(k)) return patchPhotos(ids, () => ({ rating: Number(k) }));
      if (/^[6-9]$/.test(k)) return patchPhotos(ids, (p) => ({ label: p.label === LABELS[Number(k) - 6].id ? null : LABELS[Number(k) - 6].id }));
      if (k === "p") return patchPhotos(ids, () => ({ flag: "pick" }));
      if (k === "x") return patchPhotos(ids, () => ({ flag: "reject" }));
      if (k === "u") return patchPhotos(ids, () => ({ flag: null }));
      if (k === "g") return setMode("library");
      if (k === "d" && activePhoto) return setMode("develop");
      if (k === "r" && mode === "develop") return setCropMode(!cropMode);
      if (k === "\\") return setBefore(!before);
      if (e.key === "Enter" && mode === "library" && activePhoto) return setMode("develop");
      if (e.key === "Escape" && mode === "develop") return cropMode ? setCropMode(false) : setMode("library");
      if (e.key === "Delete") return void removePhotos();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const i = list.findIndex((p) => p.id === active);
        const n = list[Math.max(0, Math.min(list.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))];
        if (n) {
          setActive(n.id);
          setSelected([n.id]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------------
  // Menús
  // ------------------------------------------------------------------------

  const menus: MenuDefinition[] = cat
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Importar fotos…", icon: ImagePlus, shortcut: "Ctrl+I", action: () => void importDialog() },
            { label: "Exportar…", icon: Download, shortcut: "Ctrl+E", action: () => setExporting(true), disabled: !targetIds().length },
            { divider: true },
            { label: "Catálogo nuevo", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir catálogo…", icon: FolderOpen, action: () => void sd.open() },
            { label: "Guardar catálogo como…", icon: SaveAll, action: () => void sd.saveAs() },
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
            { label: "Seleccionar todas", shortcut: "Ctrl+A", action: () => setSelected(list.map((p) => p.id)) },
            { label: "Quitar del catálogo", icon: Trash2, shortcut: "Supr", action: () => void removePhotos() },
          ],
        },
        {
          id: "photo",
          label: "Foto",
          items: [
            { label: "Seleccionar (bandera)", shortcut: "P", action: () => patchPhotos(targetIds(), () => ({ flag: "pick" })) },
            { label: "Rechazar", shortcut: "X", action: () => patchPhotos(targetIds(), () => ({ flag: "reject" })) },
            { label: "Quitar bandera", shortcut: "U", action: () => patchPhotos(targetIds(), () => ({ flag: null })) },
            { divider: true },
            ...[0, 1, 2, 3, 4, 5].map((n) => ({ label: n ? `${"★".repeat(n)}` : "Sin estrellas", shortcut: String(n), action: () => patchPhotos(targetIds(), () => ({ rating: n })) })),
            { divider: true },
            { label: "Copiar ajustes", shortcut: "Ctrl+Mayús+C", action: copySettings, disabled: !activePhoto },
            { label: "Pegar ajustes", shortcut: "Ctrl+Mayús+V", action: pasteSettings, disabled: !copied },
            { label: "Restablecer ajustes", action: () => patchPhotos(targetIds(), () => ({ edits: { ...DEFAULT_EDITS } })) },
          ],
        },
        {
          id: "view",
          label: "Vista",
          items: [
            { label: "Biblioteca", icon: Images, shortcut: "G", checked: mode === "library", action: () => setMode("library") },
            { label: "Revelar", icon: SlidersHorizontal, shortcut: "D", checked: mode === "develop", action: () => activePhoto && setMode("develop") },
            { label: "Antes y después", shortcut: "\\", checked: before, action: () => setBefore(!before) },
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
                  "G biblioteca · D revelar · Intro abrir en revelar · Esc volver · ← → foto anterior/siguiente.\n\n0-5 estrellas · 6-9 etiquetas de color · P seleccionar · X rechazar · U quitar bandera · Supr quitar del catálogo.\n\nR recortar y enderezar · \\ antes y después · Ctrl+Mayús+C/V copiar y pegar ajustes · Ctrl+I importar · Ctrl+E exportar."
                ),
            },
            { label: "Acerca de CoffeeLens", icon: Info, action: () => void showMessage("CoffeeLens", "Organiza y revela fotografías de la suite CoffeeWorks: catálogo con estrellas, banderas, etiquetas y colecciones; revelado no destructivo (luz, color, curva, HSL, virado, detalle, efectos, recorte); ajustes preestablecidos y exportación por lotes. Con el complemento «Revelado RAW» abre los RAW de casi cualquier cámara.") },
          ],
        },
      ]
    : [];

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeelens">
      <style>{STUDIO_CSS}</style>
      {cat && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Mi catálogo"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <div className="flex items-center gap-1">
                <div className="flex bg-[#141416] rounded-md p-0.5" data-modes>
                  {(["library", "develop"] as const).map((m) => (
                    <button key={m} type="button" disabled={m === "develop" && !activePhoto} onClick={() => setMode(m)} className={cx("px-3 h-7 rounded text-[12px] disabled:opacity-40", mode === m ? "bg-[#d9480f] text-white" : "text-[#c9c9cf] hover:text-white")}>
                      {m === "library" ? "Biblioteca" : "Revelar"}
                    </button>
                  ))}
                </div>
                <Button primary accent={ACCENT} onClick={() => setExporting(true)} disabled={!targetIds().length}>
                  <Download size={13} /> Exportar
                </Button>
              </div>
            }
          />
          {mode === "library" ? (
            <div className="flex-1 flex min-h-0">
              <CatalogPanel
                cat={cat}
                source={source}
                onSource={setSource}
                onImport={() => void importDialog()}
                onAddCollection={async () => {
                  const name = await askText({ title: "Colección nueva", label: "Nombre", defaultValue: "Vacaciones" });
                  if (!name) return;
                  const c = { id: newId("co"), name, photos: selected };
                  apply({ ...cur(), collections: [...cur().collections, c] });
                  setSource({ kind: "collection", id: c.id });
                }}
                onRenameCollection={async (c) => {
                  const name = await askText({ title: "Cambiar nombre", label: "Nombre", defaultValue: c.name });
                  if (name) apply({ ...cur(), collections: cur().collections.map((x) => (x.id === c.id ? { ...x, name } : x)) });
                }}
                onDeleteCollection={(c) => {
                  apply({ ...cur(), collections: cur().collections.filter((x) => x.id !== c.id) });
                  if (source.kind === "collection" && source.id === c.id) setSource({ kind: "all" });
                }}
                onDropToCollection={(id) => {
                  const ids = dragPhoto.current && !selected.includes(dragPhoto.current) ? [dragPhoto.current] : selected;
                  apply({ ...cur(), collections: cur().collections.map((x) => (x.id === id ? { ...x, photos: [...new Set([...x.photos, ...ids])] } : x)) });
                  toast(`${ids.length} foto${ids.length === 1 ? "" : "s"} añadida${ids.length === 1 ? "" : "s"} a la colección`);
                }}
              />
              <div className="flex-1 flex flex-col min-w-0">
                <FilterBar f={filters} onChange={setFilters} count={list.length} total={cat.photos.length} thumb={thumb} onThumb={setThumb} />
                <Grid
                  photos={list}
                  selected={selected}
                  active={active}
                  thumb={thumb}
                  onSelect={select}
                  onOpen={(id) => {
                    setActive(id);
                    setSelected([id]);
                    setMode("develop");
                  }}
                  onDragStart={(id) => (dragPhoto.current = id)}
                  onRating={(id, v) => patchPhotos([id], () => ({ rating: v }))}
                />
              </div>
              <aside className="w-[280px] shrink-0 bg-[#202023] border-l border-black/50 overflow-y-auto" data-right-panel>
                <InfoPanel photo={activePhoto} count={selected.length} onPatch={(patch) => patchPhotos(targetIds(), () => patch, "meta")} />
                <PresetsQuick onApply={applyPreset} disabled={!targetIds().length} />
              </aside>
            </div>
          ) : (
            activePhoto && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 flex min-h-0">
                  <PresetsPanel
                    cat={cat}
                    onApply={applyPreset}
                    onSave={() => void savePreset()}
                    onDelete={(p) => apply({ ...cur(), presets: cur().presets.filter((x) => x.id !== p.id) })}
                    onCopy={copySettings}
                    onPaste={pasteSettings}
                    canPaste={!!copied}
                    onHover={setHoverPreset}
                  />
                  <DevelopView photo={activePhoto} edits={shownEdits} onEdits={setEdits} cropMode={cropMode} setCropMode={setCropMode} before={before} onHistogram={setHist} />
                  <DevelopPanel edits={activePhoto.edits} onEdits={setEdits} hist={hist} photo={activePhoto} cropMode={cropMode} setCropMode={setCropMode} before={before} setBefore={setBefore} />
                </div>
                <Filmstrip photos={list} active={activePhoto.id} selected={selected} onPick={select} />
              </div>
            )
          )}
        </>
      )}

      {exporting && <ExportDialog count={targetIds().length} onCancel={() => setExporting(false)} onExport={(o) => void doExport(o)} />}
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
          appName="CoffeeLens"
          tagline="Revelado y organización de fotografías • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Catálogo nuevo para importar tus fotos"
          openHint="Abrir un catálogo .clc"
          formats={[".clc", "JPG", "PNG", "RAW"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={cat ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};

const PresetsQuick: React.FC<{ onApply: (p: Preset) => void; disabled: boolean }> = ({ onApply, disabled }) => {
  const [id, setId] = useState("");
  return (
    <div className="p-3 border-b border-black/40 flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Revelado rápido</span>
      <div className="flex gap-2">
        <Select value={id} onChange={setId} options={[{ value: "", label: "Ajuste preestablecido…" }, ...BUILTIN.map((p) => ({ value: p.id, label: p.name }))]} className="flex-1" />
        <Button disabled={disabled || !id} onClick={() => onApply(BUILTIN.find((p) => p.id === id)!)}>
          Aplicar
        </Button>
      </div>
    </div>
  );
};


const ExportDialog: React.FC<{ count: number; onExport: (o: { format: "jpg" | "png" | "webp"; quality: number; longEdge: number; naming: "original" | "sequence"; prefix: string }) => void; onCancel: () => void }> = ({ count, onExport, onCancel }) => {
  const [format, setFormat] = useState<"jpg" | "png" | "webp">("jpg");
  const [quality, setQuality] = useState(90);
  const [resize, setResize] = useState(false);
  const [longEdge, setLongEdge] = useState(2048);
  const [naming, setNaming] = useState<"original" | "sequence">("original");
  const [prefix, setPrefix] = useState("Foto");
  return (
    <Modal title={`Exportar ${count} foto${count === 1 ? "" : "s"}`} onClose={onCancel} width={400} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onExport({ format, quality, longEdge: resize ? longEdge : 0, naming, prefix })}>Exportar</Button></>}>
      <Select value={format} onChange={(v) => setFormat(v as typeof format)} options={[{ value: "jpg", label: "JPG" }, { value: "png", label: "PNG" }, { value: "webp", label: "WebP" }]} />
      {format !== "png" && <Slider label="Calidad" value={quality} min={30} max={100} onChange={setQuality} suffix="%" />}
      <label className="flex items-center gap-2 text-[12px]">
        <input type="checkbox" checked={resize} onChange={(e) => setResize(e.target.checked)} /> Cambiar el tamaño
      </label>
      {resize && (
        <div className="flex items-center gap-2">
          <Select value={String(longEdge)} onChange={(v) => setLongEdge(Number(v))} options={[1080, 1600, 2048, 3000, 4096].map((v) => ({ value: String(v), label: `Lado largo: ${v} px` }))} />
          <NumberField label="px" value={longEdge} min={200} max={12000} onChange={setLongEdge} className="w-24" />
        </div>
      )}
      <Select value={naming} onChange={(v) => setNaming(v as typeof naming)} options={[{ value: "original", label: "Nombre original" }, { value: "sequence", label: "Nombre y número" }]} />
      {naming === "sequence" && <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="bg-[#141416] border border-black/50 rounded h-7 px-2 text-[12px] outline-none" />}
      {count > 1 && <span className="text-[#8b8b93]">Varias fotos se guardan juntas en un archivo ZIP.</span>}
    </Modal>
  );
};
