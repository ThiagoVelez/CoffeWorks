import React, { useEffect, useMemo, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, Plus, Search, Star, Trash2, ChevronRight, MoreHorizontal, FileText, Table2, LayoutTemplate, RotateCcw, Maximize2, Minimize2, Image as ImageIcon, Smile, Printer, FileDown, Copy } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./components/SuiteHeader";
import { StartScreen } from "./components/StartScreen";
import { CommandSearch } from "./components/CommandSearch";
import { DialogHost, askConfirm, showMessage, toast } from "./components/Dialogs";
import { createDocStore } from "./services/docStore";
import { useStudioDoc } from "./services/useDoc";
import { pickOpenFiles, saveFileAs } from "./services/desktop";
import { makeZip } from "./services/zip";
import { BlockEditor } from "./components/BlockEditor";
import { DatabaseView } from "./components/DatabaseView";
import { breadcrumb, childrenOf, descendants, markdownToBlocks, newPage, newWorkspace, pageToMarkdown, parseWorkspace, search, serializeWorkspace, TEMPLATES, block } from "./services/model";
import { toggleTheme } from "./theme/theme";
import { ACCENT_DARK, COVERS, type Page, type Workspace } from "./types";

const store = createDocStore<Workspace>({
  appId: "coffeebooks",
  extension: "cbk",
  category: "Notas",
  defaultTitle: "Mi espacio",
  kindLabel: "Espacios de CoffeeBooks",
  serialize: serializeWorkspace,
  parse: parseWorkspace,
  create: newWorkspace,
});

const EMOJIS = ["📄", "📝", "📚", "📔", "🗂️", "✅", "🚀", "💡", "🎯", "📌", "🗓️", "☕", "🌱", "⭐", "🔥", "🎨", "🧭", "🏠", "💼", "🎓", "🧪", "📊", "🛒", "✈️", "🎵", "❤️", "🧩", "⚙️", "📖", "🗒️"];

export const App: React.FC = () => {
  const sd = useStudioDoc<Workspace>(store, {
    appName: "CoffeeBooks",
    importExtensions: ["md", "markdown", "txt"],
    importFile: async (file) => {
      const w = newWorkspace();
      const text = new TextDecoder().decode(file.bytes);
      const p = newPage(null, file.name.replace(/\.[^.]+$/, ""));
      p.blocks = markdownToBlocks(text);
      return { ...w, pages: [p] };
    },
    historyLimit: 100,
  });
  const ws = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = (next: Workspace, key = "") => sd.apply(next, key);

  const [pageId, setPageId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [iconPicker, setIconPicker] = useState(false);

  // Página activa válida
  useEffect(() => {
    if (!ws) return;
    if (!pageId || !ws.pages.some((p) => p.id === pageId)) setPageId(childrenOf(ws, null)[0]?.id || ws.pages[0]?.id || null);
  }, [ws, pageId]);
  useEffect(() => setPageId(null), [sd.docId]);

  const page = ws?.pages.find((p) => p.id === pageId) || null;

  const patchPage = (id: string, fn: (p: Page) => Page, key = "") => {
    const w = cur();
    apply({ ...w, pages: w.pages.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)) }, key);
  };

  const addPage = (parentId: string | null, kind: Page["kind"] = "page", open = true): string => {
    const p = newPage(parentId, "", kind);
    const w = cur();
    apply({ ...w, pages: [...w.pages, p].map((x) => (x.id === parentId ? { ...x, expanded: true } : x)) });
    if (open) setPageId(p.id);
    return p.id;
  };

  const addTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const p = t.build(null);
    apply({ ...cur(), pages: [...cur().pages, p] });
    setPageId(p.id);
    setTemplatesOpen(false);
    toast(`Plantilla «${t.name}» añadida`);
  };

  const deletePage = (id: string) => {
    const w = cur();
    const ids = new Set([id, ...descendants(w, id)]);
    const removed = w.pages.filter((p) => ids.has(p.id));
    apply({ ...w, pages: w.pages.filter((p) => !ids.has(p.id)), favorites: w.favorites.filter((f) => !ids.has(f)), trash: [...removed, ...w.trash].slice(0, 200) });
    toast(`«${removed[0]?.title || "Sin título"}» se movió a la papelera`, "info");
  };

  const duplicatePage = (id: string) => {
    const w = cur();
    const src = w.pages.find((p) => p.id === id);
    if (!src) return;
    const copy: Page = { ...structuredClone(src), id: newPage(null).id, title: `${src.title || "Sin título"} (copia)`, createdAt: Date.now(), updatedAt: Date.now() };
    apply({ ...w, pages: [...w.pages, copy] });
    setPageId(copy.id);
  };

  const restore = (id: string) => {
    const w = cur();
    const p = w.trash.find((x) => x.id === id);
    if (!p) return;
    // Si el padre ya no existe, vuelve a la raíz
    const restored = w.trash.filter((x) => x.id === id || descendantsIn(w.trash, id).includes(x.id)).map((x) => (x.id === id && x.parentId && !w.pages.some((y) => y.id === x.parentId) ? { ...x, parentId: null } : x));
    const ids = new Set(restored.map((x) => x.id));
    apply({ ...w, pages: [...w.pages, ...restored], trash: w.trash.filter((x) => !ids.has(x.id)) });
    setPageId(id);
  };

  const toggleFavorite = (id: string) => {
    const w = cur();
    apply({ ...w, favorites: w.favorites.includes(id) ? w.favorites.filter((f) => f !== id) : [...w.favorites, id] });
  };

  // ------------------------------------------------------------------------
  // Exportar
  // ------------------------------------------------------------------------

  const exportMarkdown = async () => {
    if (!page || !ws) return;
    await saveFileAs(`${page.title || "Sin título"}.md`, [{ name: "Markdown", extensions: ["md"] }], pageToMarkdown(page, ws), "Exportar a Markdown");
  };

  const exportAll = async () => {
    if (!ws) return;
    const entries = ws.pages.map((p) => {
      const path = breadcrumb(ws, p.id)
        .map((x) => (x.title || "Sin título").replace(/[\\/:*?"<>|]+/g, "-"))
        .join("/");
      return { name: `${path}.md`, data: pageToMarkdown(p, ws) };
    });
    const blob = makeZip(entries);
    await saveFileAs(`${sd.title || "Mi espacio"}.zip`, [{ name: "ZIP", extensions: ["zip"] }], blob, "Exportar el espacio");
  };

  const importMarkdown = async () => {
    const files = await pickOpenFiles([{ name: "Markdown o texto", extensions: ["md", "markdown", "txt"] }], "Importar páginas");
    if (!files.length) return;
    const w = cur();
    const pages = files.map((f) => {
      const p = newPage(page?.id || null, f.name.replace(/\.[^.]+$/, ""));
      p.blocks = markdownToBlocks(new TextDecoder().decode(f.bytes));
      return p;
    });
    apply({ ...w, pages: [...w.pages, ...pages] });
    setPageId(pages[0].id);
    toast(pages.length === 1 ? "Página importada" : `${pages.length} páginas importadas`);
  };

  // ------------------------------------------------------------------------
  // Teclado
  // ------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sd.docRef.current || sd.showStart) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") {
        setFindOpen(false);
        setTemplatesOpen(false);
        setTrashOpen(false);
      }
      if (!mod) return;
      const inEditor = (e.target as HTMLElement)?.closest?.("[contenteditable],input,textarea");
      const map: Record<string, () => void> = {
        p: () => setFindOpen(true),
        s: () => (e.shiftKey ? void sd.saveAs() : void sd.flush().then(() => toast("Guardado"))),
        o: () => void sd.open(),
        n: () => void addPage(null),
        "/": () => setCommandOpen(true),
      };
      if (!inEditor) {
        map.z = () => (e.shiftKey ? sd.redo() : sd.undo());
        map.y = () => sd.redo();
      } else if (k === "z" || k === "y") {
        // Deshacer del espacio de trabajo (los cambios de texto se agrupan por bloque)
        e.preventDefault();
        if (k === "y" || e.shiftKey) sd.redo();
        else sd.undo();
        return;
      }
      const fn = map[k];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const menus: MenuDefinition[] = ws
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Espacio nuevo", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir espacio…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, action: () => void sd.saveAs() },
            { divider: true },
            { label: "Importar Markdown…", icon: FileDown, action: () => void importMarkdown() },
            { label: "Exportar la página a Markdown…", icon: Download, action: () => void exportMarkdown(), disabled: !page },
            { label: "Exportar todo el espacio (ZIP)…", action: () => void exportAll() },
            { label: "Imprimir o guardar en PDF…", icon: Printer, action: () => window.print(), disabled: !page },
            { divider: true },
            { label: "Pantalla de inicio", icon: Home, action: () => sd.setShowStart(true) },
          ],
        },
        {
          id: "edit",
          label: "Editar",
          items: [
            { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: sd.undo, disabled: !sd.canUndo },
            { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Mayús+Z", action: sd.redo, disabled: !sd.canRedo },
            { divider: true },
            { label: "Buscar en el espacio…", icon: Search, shortcut: "Ctrl+P", action: () => setFindOpen(true) },
          ],
        },
        {
          id: "insert",
          label: "Insertar",
          items: [
            { label: "Página nueva", icon: FileText, shortcut: "Ctrl+N", action: () => void addPage(null) },
            { label: "Subpágina de esta página", action: () => page && void addPage(page.id), disabled: !page },
            { label: "Base de datos nueva", icon: Table2, action: () => void addPage(null, "database") },
            { label: "Desde una plantilla…", icon: LayoutTemplate, action: () => setTemplatesOpen(true) },
          ],
        },
        {
          id: "view",
          label: "Ver",
          items: [
            { label: "Modo oscuro / claro", action: () => void toggleTheme() },
            { label: page?.fullWidth ? "Ancho normal" : "Ancho completo", icon: page?.fullWidth ? Minimize2 : Maximize2, action: () => page && patchPage(page.id, (p) => ({ ...p, fullWidth: !p.fullWidth })), disabled: !page },
            { label: "Papelera", icon: Trash2, action: () => setTrashOpen(true) },
            { label: "Buscar comandos…", shortcut: "Ctrl+/", action: () => setCommandOpen(true) },
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Atajos y comandos",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Cómo escribir en CoffeeBooks",
                  "Escribe «/» en una línea para elegir un bloque: títulos, listas, tareas, desplegables, avisos, citas, código, tablas, imágenes, subpáginas y separadores.\n\nAtajos de Markdown al principio de una línea: # ## ### títulos · - lista · 1. numerada · [] tarea · > desplegable · \" cita · ``` código · --- separador.\n\nCtrl+B negrita · Ctrl+I cursiva · Ctrl+U subrayado · Ctrl+Mayús+X tachado · Ctrl+E código · Ctrl+K enlace.\nIntro bloque nuevo · Retroceso al inicio une con el anterior · ↑/↓ entre bloques · arrastra el asa ⋮⋮ para mover.\n\nCtrl+P buscar · Ctrl+N página nueva · Ctrl+S guardar · Ctrl+/ comandos."
                ),
            },
            { label: "Acerca de CoffeeBooks", icon: Info, action: () => void showMessage("CoffeeBooks", "Notas, wikis y bases de datos de la suite CoffeeWorks: páginas anidadas hechas de bloques, bases de datos con vistas de tabla, tablero, lista y calendario, plantillas y exportación a Markdown y PDF. Todo se guarda en tu equipo.") },
          ],
        },
      ]
    : [];

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-[#37352f]" data-app="coffeebooks">
      {ws && (
        <>
          <div className="print:hidden">
            <SuiteHeader
              logo={logo}
              logoTitle="Pantalla de inicio de CoffeeBooks"
              onLogoClick={() => sd.setShowStart(true)}
              title={sd.title}
              titlePlaceholder="Mi espacio"
              onTitleChange={sd.setTitle}
              menus={menus}
              saveStatus={sd.saveStatus}
              fileLocation={sd.location}
              isStarred={sd.isStarred}
              onToggleStar={() => void sd.toggleStar()}
              onBeforeClose={sd.flush}
              actions={
                <button type="button" onClick={() => setTemplatesOpen(true)} className="h-8 px-3 rounded-md text-[13px] font-medium bg-[#2f2f2f] text-white hover:bg-black flex items-center gap-1.5">
                  <LayoutTemplate size={14} /> Plantillas
                </button>
              }
            />
          </div>
          <div className="flex-1 flex min-h-0">
            {/* Barra lateral */}
            <aside className="w-64 shrink-0 bg-[#f7f7f5] border-r border-[#ededeb] flex flex-col min-h-0 print:hidden" data-sidebar>
              <div className="p-2 flex flex-col gap-0.5">
                <button type="button" onClick={() => setFindOpen(true)} className="flex items-center gap-2 px-2 py-1 rounded text-[14px] text-[#5f5e5b] hover:bg-[#ebebea]">
                  <Search size={15} /> Buscar <span className="ml-auto text-[11px] text-[#9b9a97]">Ctrl+P</span>
                </button>
                <button type="button" onClick={() => setTemplatesOpen(true)} className="flex items-center gap-2 px-2 py-1 rounded text-[14px] text-[#5f5e5b] hover:bg-[#ebebea]">
                  <LayoutTemplate size={15} /> Plantillas
                </button>
                <button type="button" onClick={() => setTrashOpen(true)} className="flex items-center gap-2 px-2 py-1 rounded text-[14px] text-[#5f5e5b] hover:bg-[#ebebea]">
                  <Trash2 size={15} /> Papelera {ws.trash.length > 0 && <span className="ml-auto text-[11px] text-[#9b9a97]">{ws.trash.length}</span>}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {ws.favorites.length > 0 && (
                  <>
                    <div className="px-2 pt-3 pb-1 text-[12px] font-medium text-[#9b9a97]">Favoritos</div>
                    {ws.favorites
                      .map((id) => ws.pages.find((p) => p.id === id))
                      .filter(Boolean)
                      .map((p) => (
                        <button key={p!.id} type="button" onClick={() => setPageId(p!.id)} className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[14px] text-left ${p!.id === pageId ? "bg-[#ebebea] font-medium" : "hover:bg-[#ebebea]"}`}>
                          <span>{p!.icon}</span>
                          <span className="truncate">{p!.title || "Sin título"}</span>
                        </button>
                      ))}
                  </>
                )}
                <div className="px-2 pt-3 pb-1 text-[12px] font-medium text-[#9b9a97] flex items-center">
                  Páginas
                  <button type="button" title="Página nueva" onClick={() => void addPage(null)} className="ml-auto p-0.5 rounded hover:bg-[#e3e3e1]" data-new-page>
                    <Plus size={14} />
                  </button>
                </div>
                {childrenOf(ws, null).map((p) => (
                  <TreeItem key={p.id} p={p} ws={ws} depth={0} activeId={pageId} onOpen={setPageId} onAdd={(id) => void addPage(id)} onToggle={(id) => patchPage(id, (x) => ({ ...x, expanded: !x.expanded }), "expand")} menuFor={menuFor} setMenuFor={setMenuFor} onDelete={deletePage} onDuplicate={duplicatePage} onFavorite={toggleFavorite} />
                ))}
                <button type="button" onClick={() => void addPage(null)} className="w-full flex items-center gap-2 px-2 py-1 mt-1 rounded text-[14px] text-[#9b9a97] hover:bg-[#ebebea]">
                  <Plus size={14} /> Añadir una página
                </button>
                <button type="button" onClick={() => void addPage(null, "database")} className="w-full flex items-center gap-2 px-2 py-1 rounded text-[14px] text-[#9b9a97] hover:bg-[#ebebea]" data-new-db>
                  <Table2 size={14} /> Base de datos nueva
                </button>
              </div>
            </aside>

            {/* Página */}
            <main className="flex-1 overflow-y-auto min-w-0" data-page-view>
              {page ? (
                <PageView
                  key={page.id}
                  page={page}
                  ws={ws}
                  onPatch={(fn, key) => patchPage(page.id, fn, key)}
                  onOpen={setPageId}
                  onAddSubpage={() => addPage(page.id, "page", false)}
                  favorite={ws.favorites.includes(page.id)}
                  onFavorite={() => toggleFavorite(page.id)}
                  iconPicker={iconPicker}
                  setIconPicker={setIconPicker}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-[#9b9a97]">
                  <FileText size={40} />
                  <span>No hay páginas. Crea la primera.</span>
                  <button type="button" onClick={() => void addPage(null)} className="px-3 py-1.5 rounded bg-[#2f2f2f] text-white text-[14px]">
                    Página nueva
                  </button>
                </div>
              )}
            </main>
          </div>
        </>
      )}

      {findOpen && ws && <QuickFind ws={ws} onClose={() => setFindOpen(false)} onPick={(id) => (setPageId(id), setFindOpen(false))} />}
      {templatesOpen && (
        <Overlay onClose={() => setTemplatesOpen(false)} title="Plantillas">
          <div className="grid grid-cols-2 gap-3" data-templates>
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => addTemplate(t.id)} className="text-left rounded-lg border border-[#e9e9e7] p-4 hover:bg-[#f7f6f3] flex gap-3" data-template={t.name}>
                <span className="text-[28px] leading-none">{t.icon}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[14px]">{t.name}</span>
                  <span className="text-[12px] text-[#787774]">{t.description}</span>
                </span>
              </button>
            ))}
          </div>
        </Overlay>
      )}
      {trashOpen && ws && (
        <Overlay onClose={() => setTrashOpen(false)} title="Papelera">
          {!ws.trash.length && <div className="text-[14px] text-[#9b9a97]">La papelera está vacía.</div>}
          <div className="flex flex-col gap-1">
            {ws.trash
              .filter((p) => !ws.trash.some((x) => x.id === p.parentId))
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#f7f6f3] text-[14px]">
                  <span>{p.icon}</span>
                  <span className="flex-1 truncate">{p.title || "Sin título"}</span>
                  <button type="button" onClick={() => restore(p.id)} className="flex items-center gap-1 text-[12px] text-[#787774] hover:text-[#37352f]" data-restore>
                    <RotateCcw size={13} /> Restaurar
                  </button>
                </div>
              ))}
          </div>
          {ws.trash.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                if (await askConfirm({ title: "Vaciar la papelera", message: "Las páginas de la papelera se borrarán para siempre.", confirmLabel: "Vaciar" })) apply({ ...cur(), trash: [] });
              }}
              className="mt-3 text-[13px] text-[#d44c47] hover:underline"
            >
              Vaciar la papelera
            </button>
          )}
        </Overlay>
      )}
      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />
      {sd.showStart && (
        <StartScreen
          appName="CoffeeBooks"
          tagline="Notas, wikis y bases de datos • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Crear un espacio de trabajo nuevo"
          openHint="Abrir un espacio .cbk o importar Markdown"
          formats={[".cbk", ".md"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={ws ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};

function descendantsIn(pages: Page[], id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => pages.filter((p) => p.parentId === pid).forEach((c) => (out.push(c.id), walk(c.id)));
  walk(id);
  return out;
}

// ---------------------------------------------------------------------------
// Árbol de páginas
// ---------------------------------------------------------------------------

const TreeItem: React.FC<{
  p: Page;
  ws: Workspace;
  depth: number;
  activeId: string | null;
  onOpen: (id: string) => void;
  onAdd: (id: string) => void;
  onToggle: (id: string) => void;
  menuFor: string | null;
  setMenuFor: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onFavorite: (id: string) => void;
}> = (props) => {
  const { p, ws, depth, activeId } = props;
  const kids = childrenOf(ws, p.id);
  return (
    <div>
      <div className={`group relative flex items-center gap-1 pr-1 rounded text-[14px] ${p.id === activeId ? "bg-[#ebebea] font-medium" : "hover:bg-[#ebebea]"}`} style={{ paddingLeft: 4 + depth * 14 }} data-tree={p.title || "Sin título"}>
        <button type="button" onClick={() => props.onToggle(p.id)} className="p-0.5 rounded hover:bg-[#dededc] text-[#9b9a97]" title={p.expanded ? "Contraer" : "Expandir"}>
          <ChevronRight size={13} className={`transition-transform ${p.expanded && kids.length ? "rotate-90" : ""} ${kids.length ? "" : "opacity-40"}`} />
        </button>
        <button type="button" onClick={() => props.onOpen(p.id)} className="flex-1 min-w-0 flex items-center gap-1.5 py-1 text-left">
          <span>{p.icon}</span>
          <span className="truncate">{p.title || "Sin título"}</span>
        </button>
        <button type="button" title="Más" onClick={() => props.setMenuFor(props.menuFor === p.id ? null : p.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#dededc] text-[#9b9a97]">
          <MoreHorizontal size={14} />
        </button>
        <button type="button" title="Añadir una subpágina" onClick={() => props.onAdd(p.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#dededc] text-[#9b9a97]" data-add-sub>
          <Plus size={14} />
        </button>
        {props.menuFor === p.id && (
          <div className="absolute right-0 top-7 z-30 w-48 rounded-lg bg-white shadow-[0_8px_30px_rgba(15,15,15,0.18)] border border-[#e9e9e7] py-1 text-[13px] font-normal" onMouseLeave={() => props.setMenuFor(null)}>
            <button type="button" onClick={() => (props.setMenuFor(null), props.onFavorite(p.id))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f1f1ef]">
              <Star size={13} /> {ws.favorites.includes(p.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
            </button>
            <button type="button" onClick={() => (props.setMenuFor(null), props.onDuplicate(p.id))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f1f1ef]">
              <Copy size={13} /> Duplicar
            </button>
            <button type="button" onClick={() => (props.setMenuFor(null), props.onDelete(p.id))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f1f1ef] text-[#d44c47]">
              <Trash2 size={13} /> Mover a la papelera
            </button>
          </div>
        )}
      </div>
      {p.expanded && kids.map((k) => <TreeItem key={k.id} {...props} p={k} depth={depth + 1} />)}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const PageView: React.FC<{
  page: Page;
  ws: Workspace;
  onPatch: (fn: (p: Page) => Page, key?: string) => void;
  onOpen: (id: string) => void;
  onAddSubpage: () => string;
  favorite: boolean;
  onFavorite: () => void;
  iconPicker: boolean;
  setIconPicker: (v: boolean) => void;
}> = ({ page, ws, onPatch, onOpen, onAddSubpage, favorite, onFavorite, iconPicker, setIconPicker }) => {
  const crumbs = useMemo(() => breadcrumb(ws, page.id), [ws, page.id]);
  const width = page.fullWidth ? "max-w-none px-16" : "max-w-[720px] px-6";
  return (
    <div className="pb-24">
      <div className="h-11 flex items-center gap-1 px-4 text-[14px] text-[#5f5e5b] print:hidden">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.id}>
            {i > 0 && <span className="text-[#c7c6c4]">/</span>}
            <button type="button" onClick={() => onOpen(c.id)} className="px-1 rounded hover:bg-[#ebebea] truncate max-w-[180px]">
              {c.icon} {c.title || "Sin título"}
            </button>
          </React.Fragment>
        ))}
        <div className="flex-1" />
        <span className="text-[12px] text-[#9b9a97] mr-2">Editado {new Date(page.updatedAt).toLocaleString()}</span>
        <button type="button" onClick={onFavorite} title={favorite ? "Quitar de favoritos" : "Añadir a favoritos"} className="p-1 rounded hover:bg-[#ebebea]">
          <Star size={16} fill={favorite ? "#f5c518" : "none"} className={favorite ? "text-[#f5c518]" : ""} />
        </button>
      </div>
      {page.cover && <div className="h-48 w-full" style={{ background: COVERS[page.cover] }} data-cover />}
      <div className={`mx-auto ${width}`}>
        <div className={`group ${page.cover ? "-mt-10" : "mt-8"}`}>
          <div className="relative">
            <button type="button" onClick={() => setIconPicker(!iconPicker)} className="text-[64px] leading-none rounded-lg hover:bg-[#ebebea] p-1" title="Cambiar el icono" data-page-icon>
              {page.icon}
            </button>
            {iconPicker && (
              <div className="absolute z-30 top-full left-0 mt-1 w-80 rounded-lg bg-white shadow-[0_8px_30px_rgba(15,15,15,0.18)] border border-[#e9e9e7] p-2 grid grid-cols-10 gap-1" onMouseLeave={() => setIconPicker(false)}>
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => (onPatch((p) => ({ ...p, icon: e })), setIconPicker(false))} className="text-[20px] rounded hover:bg-[#f1f1ef]">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 text-[13px] text-[#9b9a97] mt-1 print:hidden">
            <button type="button" onClick={() => setIconPicker(true)} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#ebebea]">
              <Smile size={14} /> Icono
            </button>
            <button type="button" onClick={() => {
              const keys = Object.keys(COVERS);
              onPatch((p) => ({ ...p, cover: p.cover ? keys[(keys.indexOf(p.cover) + 1) % keys.length] : keys[Math.floor(Math.random() * keys.length)] }));
            }} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#ebebea]" data-cover-btn>
              <ImageIcon size={14} /> {page.cover ? "Cambiar portada" : "Añadir portada"}
            </button>
            {page.cover && (
              <button type="button" onClick={() => onPatch((p) => ({ ...p, cover: null }))} className="px-1.5 py-0.5 rounded hover:bg-[#ebebea]">
                Quitar portada
              </button>
            )}
          </div>
        </div>
        <input
          value={page.title}
          onChange={(e) => onPatch((p) => ({ ...p, title: e.target.value }), "title")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && page.kind === "page") {
              e.preventDefault();
              const first = document.querySelector("[data-block-text]") as HTMLElement | null;
              first?.focus();
            }
          }}
          placeholder="Sin título"
          className="w-full text-[40px] font-bold outline-none bg-transparent placeholder:text-[#e1e1e0] mt-2 mb-4"
          data-page-title
        />
        {page.kind === "database" && page.db ? (
          <DatabaseView db={page.db} onChange={(db, key) => onPatch((p) => ({ ...p, db }), key)} workspace={ws} onOpenPage={onOpen} />
        ) : (
          <div className="pl-12 -ml-12 text-[16px] leading-[1.6]">
            <BlockEditor
              blocks={page.blocks.length ? page.blocks : [block()]}
              onChange={(blocks, key) => onPatch((p) => ({ ...p, blocks }), key)}
              workspace={ws}
              onOpenPage={onOpen}
              onCreateSubpage={onAddSubpage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Búsqueda rápida y ventanas
// ---------------------------------------------------------------------------

const QuickFind: React.FC<{ ws: Workspace; onPick: (id: string) => void; onClose: () => void }> = ({ ws, onPick, onClose }) => {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const results = useMemo(() => search(ws, q), [ws, q]);
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-24" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-quick-find>
      <div className="w-[600px] max-w-[92vw] rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-[#e9e9e7]">
          <Search size={18} className="text-[#9b9a97]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setSel(0))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(results.length - 1, s + 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              if (e.key === "Enter" && results[sel]) onPick(results[sel].page.id);
              if (e.key === "Escape") onClose();
            }}
            placeholder={`Buscar en ${ws.name}…`}
            className="flex-1 h-12 outline-none text-[16px] bg-transparent"
            data-find-input
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto py-1">
          {!results.length && <div className="px-4 py-6 text-center text-[14px] text-[#9b9a97]">Sin resultados</div>}
          {results.map((r, i) => (
            <button key={r.page.id} type="button" onClick={() => onPick(r.page.id)} onMouseEnter={() => setSel(i)} className={`w-full text-left px-4 py-2 flex flex-col ${i === sel ? "bg-[#f1f1ef]" : ""}`} data-result={r.page.title}>
              <span className="text-[14px]">
                {r.page.icon} {r.page.title || "Sin título"}
              </span>
              {r.snippet && <span className="text-[12px] text-[#9b9a97] truncate">…{r.snippet}…</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Overlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()} data-modal-open>
    <div className="w-[640px] max-w-[92vw] max-h-[80vh] overflow-y-auto rounded-xl bg-white shadow-2xl p-6">
      <div className="flex items-center mb-4">
        <h2 className="text-[18px] font-semibold flex-1">{title}</h2>
        <button type="button" onClick={onClose} className="text-[13px] text-[#9b9a97] hover:text-[#37352f]">
          Cerrar
        </button>
      </div>
      {children}
    </div>
  </div>
);


