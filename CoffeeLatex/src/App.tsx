// CoffeeLatex: documentos científicos y técnicos en LaTeX y Markdown, con vista previa en vivo.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ChevronDown, Download, FileDown, FileType2, FolderOpen, Home, Printer, Redo2, Save, Undo2, X } from "lucide-react";
import { useDocumento } from "./almacen";
import { Inicio } from "./Inicio";
import { BarraInsertar, BARRA_CSS } from "./Barra";
import { Editor, EDITOR_CSS, segmentosDeProsa, type EditorApi } from "./editor/Editor";
import { plantillaPara, type Boton } from "./editor/insertar";
import type { Plantilla } from "./editor/plantillas";
import { latexToHtml } from "./preview/latex";
import { markdownToHtml } from "./preview/markdown";
import { HOJA_CSS } from "./exportar/exportar";
import { exportarHtml } from "./exportar/exportarHtml";
import { texErrors, type ErrorTex } from "./exportar/errores";
import { compilarPdf, convertir, ErrorDeCompilacion, herramientas, type Hacia } from "./native";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { DialogHost, showMessage, toast } from "./studio/Dialogs";
import { ensureAddon } from "./studio/addons";
import { appWindow, isTauri, openExternal, pickOpenFile, readFileBytes, saveFileAs, writeFileBytes } from "./studio/desktop";
import { SpellIndicator, SpellStyles, useSpellCheck } from "./spell/useSpellCheck";
import { ThemeSwitch } from "./theme/ThemeSwitch";

const IMAGENES = ["png", "jpg", "jpeg", "pdf", "svg", "gif", "webp"];

const carpetaDe = (ruta: string) => ruta.replace(/[\\/][^\\/]*$/, "");
const sep = (ruta: string) => (ruta.includes("\\") ? "\\" : "/");
const nombreSeguro = (t: string) => t.replace(/[\\/:*?"<>|]+/g, "_").trim() || "documento";

/** Rutas relativas que usa \includegraphics. */
function imagenesDe(tex: string): string[] {
  const out = new Set<string>();
  for (const m of tex.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) out.add(m[1].replace(/^"|"$/g, "").trim());
  return [...out].filter((r) => r && !/^([a-zA-Z]:|[\\/])/.test(r) && !r.split(/[\\/]/).includes(".."));
}

const bytesDeTexto = (t: string) => new TextEncoder().encode(t);

export const App: React.FC = () => {
  const d = useDocumento();
  const [verInicio, setVerInicio] = useState(true);
  const editor = useRef<EditorApi>(null);
  const [vista, setVista] = useState<{ html: string }>({ html: "" });
  const [errores, setErrores] = useState<ErrorTex[] | null>(null);
  const [registro, setRegistro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [menuExportar, setMenuExportar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [imagenes, setImagenes] = useState<Record<string, string>>({});
  const hoja = useRef<HTMLDivElement>(null);

  const doc = d.doc;
  const modo = doc?.modo ?? "latex";
  const texto = doc?.texto ?? "";

  useEffect(() => {
    if (doc) setVerInicio(false);
  }, [doc?.modo, d.ubicacion, d.titulo, !!doc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void appWindow.setTitle(doc && !verInicio ? `${d.titulo} — CoffeeLatex` : "CoffeeLatex");
  }, [d.titulo, doc, verInicio]);

  // Vista previa unos 300 ms después de dejar de escribir; al cambiar de documento, enseguida.
  const docVisto = useRef("");
  useEffect(() => {
    if (!doc) return;
    const id = `${modo}|${d.ubicacion}|${d.titulo}`;
    const inmediata = docVisto.current !== id;
    docVisto.current = id;
    const pintar = () => setVista({ html: modo === "latex" ? latexToHtml(texto).html : markdownToHtml(texto) });
    if (inmediata) {
      pintar();
      return;
    }
    const t = window.setTimeout(pintar, 300);
    return () => window.clearTimeout(t);
  }, [texto, modo, !!doc, d.ubicacion, d.titulo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Imágenes de las figuras: se leen de la carpeta del documento.
  useEffect(() => {
    if (!isTauri || !d.ubicacion || d.ubicacion.startsWith("web:")) return;
    const faltan = imagenesDe(texto).filter((r) => !(r in imagenes));
    if (!faltan.length) return;
    const dir = carpetaDe(d.ubicacion);
    void Promise.all(faltan.map(async (r) => {
      try {
        const b = await readFileBytes(`${dir}${sep(dir)}${r.replace(/\//g, sep(dir))}`);
        const ext = r.split(".").pop()!.toLowerCase();
        const tipo = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
        return [r, URL.createObjectURL(new Blob([b as BlobPart], { type: tipo }))] as const;
      } catch {
        return [r, ""] as const;
      }
    })).then((pares) => setImagenes((v) => ({ ...v, ...Object.fromEntries(pares) })));
  }, [texto, d.ubicacion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    hoja.current?.querySelectorAll<HTMLImageElement>("img.figura[data-src]").forEach((img) => {
      const src = imagenes[img.dataset.src!];
      if (src) img.src = src;
    });
  }, [vista, imagenes]);

  // Corrector: solo la prosa (sin comandos ni fórmulas).
  const segmentos = useMemo(() => (doc ? segmentosDeProsa(texto, modo) : []), [texto, modo, !!doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const spell = useSpellCheck({
    mode: "model",
    segments: segmentos,
    onReveal: (e) => {
      const ini = Number(e.key.slice(1)) + e.start;
      editor.current?.irA(ini, ini + (e.end - e.start));
    },
    onReplace: (e, r) => {
      const ini = Number(e.key.slice(1));
      editor.current?.reemplazar(ini + e.start, ini + e.end, r);
    },
  });

  const elegirPlantilla = (p: Plantilla) => void d.nuevo(p.modo, p.contenido, p.id.startsWith("md") ? "Notas" : p.nombre.replace(/ \(.*\)$/, ""));

  const insertarBoton = useCallback(async (b: Boton) => {
    if (b.id === "figura" && modo === "latex" && isTauri && d.ubicacion && !d.ubicacion.startsWith("web:")) {
      const f = await pickOpenFile([{ name: "Imágenes", extensions: IMAGENES }], "Elegir la imagen de la figura");
      if (!f) return;
      const carpeta = `${nombreSeguro(d.titulo)}-imagenes`;
      const rel = `${carpeta}/${nombreSeguro(f.name)}`;
      const dir = carpetaDe(d.ubicacion);
      await writeFileBytes(`${dir}${sep(dir)}${carpeta}${sep(dir)}${nombreSeguro(f.name)}`, f.bytes);
      editor.current?.insertar(b.latex.replace("▮", rel).replace("\\caption{}", "\\caption{▮}"));
      return;
    }
    editor.current?.insertar(plantillaPara(b, modo, editor.current.enFormula()));
  }, [modo, d.ubicacion, d.titulo]);

  const insertarSimbolo = (tex: string) => {
    const dentro = editor.current?.enFormula() ?? false;
    editor.current?.insertar(dentro ? `${tex}▮` : `$${tex}$▮`);
  };

  // ---------- Exportar ----------

  const nombreBase = nombreSeguro(d.titulo);

  const archivosDeFiguras = async () => {
    if (!isTauri || !d.ubicacion || d.ubicacion.startsWith("web:")) return [];
    const dir = carpetaDe(d.ubicacion);
    const out: { nombre: string; datos: Uint8Array }[] = [];
    for (const r of imagenesDe(texto)) {
      try {
        out.push({ nombre: r, datos: await readFileBytes(`${dir}${sep(dir)}${r.replace(/\//g, sep(dir))}`) });
      } catch { /* el compilador avisará del archivo que falta */ }
    }
    return out;
  };

  const trabajo = async (etiqueta: string, f: () => Promise<void>) => {
    setOcupado(etiqueta);
    setMenuExportar(false);
    try {
      await f();
    } catch (e) {
      await showMessage("No se pudo exportar", e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  const necesita = async (id: "latex" | "pandoc") => {
    const h = await herramientas();
    if (id === "latex" ? h.latex : h.pandoc) return true;
    return ensureAddon(id, "CoffeeLatex");
  };

  const exportarPdf = () => trabajo("Creando el PDF…", async () => {
    if (!doc) return;
    let tex = texto;
    if (modo === "markdown") {
      const h = await herramientas();
      if (!h.pandoc || !h.latex) {
        // Sin complementos: se imprime la vista previa (el sistema permite guardarla como PDF).
        toast("Sin los complementos Pandoc y Motor LaTeX se imprime la vista previa.", "info");
        window.print();
        return;
      }
      tex = new TextDecoder().decode(await convertir(bytesDeTexto(texto), "markdown", "latex"));
    } else if (!(await necesita("latex"))) return;
    try {
      const pdf = await compilarPdf(tex, await archivosDeFiguras());
      setErrores(null);
      const ruta = await saveFileAs(`${nombreBase}.pdf`, [{ name: "PDF", extensions: ["pdf"] }], pdf, "Guardar el PDF");
      if (ruta !== null) toast("PDF listo");
    } catch (e) {
      if (e instanceof ErrorDeCompilacion) {
        const lista = texErrors(e.registro);
        setRegistro(e.registro);
        setErrores(lista.length ? lista : [{ linea: null, mensaje: e.message }]);
        return;
      }
      throw e;
    }
  });

  const exportarConPandoc = (hacia: Hacia, ext: string, nombre: string) => trabajo(`Exportando a ${nombre}…`, async () => {
    if (!(await necesita("pandoc"))) return;
    const salida = await convertir(bytesDeTexto(texto), modo, hacia);
    const ruta = await saveFileAs(`${nombreBase}.${ext}`, [{ name: nombre, extensions: [ext] }], salida, `Exportar a ${nombre}`);
    if (ruta !== null) toast(`Exportado a ${nombre}`);
  });

  const exportarHtmlArchivo = () => trabajo("Exportando a HTML…", async () => {
    const cuerpo = hoja.current?.innerHTML ?? vista.html;
    const html = exportarHtml(d.titulo, cuerpo.replace(/ src="blob:[^"]*"/g, ""));
    const ruta = await saveFileAs(`${nombreBase}.html`, [{ name: "Página web", extensions: ["html"] }], html, "Exportar a HTML");
    if (ruta !== null) toast("Exportado a HTML");
  });

  const exportarFuente = () => trabajo("Guardando…", async () => {
    const ext = modo === "latex" ? "tex" : "md";
    const ruta = await saveFileAs(`${nombreBase}.${ext}`, [{ name: modo === "latex" ? "LaTeX" : "Markdown", extensions: [ext] }], texto, "Guardar una copia");
    if (ruta !== null) toast("Copia guardada");
  });

  const desdeFoto = () => setAviso("«Desde foto» llega en la próxima versión: convertirá la foto de tus notas a mano en LaTeX, con un corrector de física y matemáticas para las dudas.");

  // ---------- Atajos ----------

  const tecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "s") {
      e.preventDefault();
      if (e.shiftKey) void d.guardarComo();
      else void d.vaciar().then(() => d.guardar()).then(() => toast("Guardado"));
    } else if (k === "b") {
      e.preventDefault();
      editor.current?.insertar(modo === "latex" ? "\\textbf{§▮}" : "**§▮**");
    } else if (k === "i") {
      e.preventDefault();
      editor.current?.insertar(modo === "latex" ? "\\emph{§▮}" : "*§▮*");
    } else if (k === "m") {
      e.preventDefault();
      editor.current?.insertar(e.shiftKey ? (modo === "latex" ? "\\[\n  §▮\n\\]" : "$$\n§▮\n$$") : "$§▮$");
    }
  };

  const menus: MenuDefinition[] = [
    {
      id: "archivo", label: "Archivo", items: [
        { label: "Inicio y plantillas", icon: Home, action: () => (void d.refrescarRecientes(), setVerInicio(true)) },
        { label: "Abrir…", icon: FolderOpen, action: () => void d.abrir() },
        { label: "Guardar", icon: Save, shortcut: "Ctrl+S", action: () => void d.guardar() },
        { label: "Guardar como…", shortcut: "Ctrl+Shift+S", action: () => void d.guardarComo() },
        { divider: true },
        { label: "Exportar a PDF", icon: FileDown, action: () => void exportarPdf() },
        { label: "Exportar a HTML", action: () => void exportarHtmlArchivo() },
        { label: "Exportar a Word (.docx)", action: () => void exportarConPandoc("docx", "docx", "Word") },
        { label: "Exportar a OpenDocument (.odt)", action: () => void exportarConPandoc("odt", "odt", "OpenDocument") },
        { label: modo === "latex" ? "Exportar a Markdown" : "Exportar a LaTeX", action: () => void (modo === "latex" ? exportarConPandoc("markdown", "md", "Markdown") : exportarConPandoc("latex", "tex", "LaTeX")) },
        { divider: true },
        { label: "Imprimir la vista previa", icon: Printer, shortcut: "Ctrl+P", action: () => window.print() },
      ],
    },
    {
      id: "editar", label: "Editar", items: [
        { label: "Deshacer", icon: Undo2, shortcut: "Ctrl+Z", action: () => (editor.current?.foco(), document.execCommand("undo")) },
        { label: "Rehacer", icon: Redo2, shortcut: "Ctrl+Y", action: () => (editor.current?.foco(), document.execCommand("redo")) },
        { divider: true },
        { label: "Negrita", shortcut: "Ctrl+B", action: () => editor.current?.insertar(modo === "latex" ? "\\textbf{§▮}" : "**§▮**") },
        { label: "Cursiva", shortcut: "Ctrl+I", action: () => editor.current?.insertar(modo === "latex" ? "\\emph{§▮}" : "*§▮*") },
        { label: "Fórmula en línea", shortcut: "Ctrl+M", action: () => editor.current?.insertar("$§▮$") },
        { label: "Fórmula aparte", shortcut: "Ctrl+Shift+M", action: () => editor.current?.insertar(modo === "latex" ? "\\[\n  §▮\n\\]" : "$$\n§▮\n$$") },
      ],
    },
  ];

  if (!doc || verInicio) {
    return (
      <>
        <Inicio
          recientes={d.recientes}
          onPlantilla={elegirPlantilla}
          onAbrir={() => void d.abrir()}
          onReciente={(r) => void d.abrirReciente(r)}
          onContinuar={doc ? () => setVerInicio(false) : undefined}
          tituloActual={d.titulo}
        />
        <DialogHost />
      </>
    );
  }

  const palabras = (texto.replace(/\\[A-Za-z]+|[{}$\\%]/g, " ").match(/\p{L}+/gu) ?? []).length;

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#11171a] text-[#14323a] dark:text-[#d6e1e4]">
      <style>{`${EDITOR_CSS}${BARRA_CSS}${HOJA_CSS}
.vista{background:#e3eaec}
:root[data-theme="dark"] .vista{background:#0c1113}
.vista .hoja{background:#fff;max-width:21cm;min-height:27cm;margin:24px auto;padding:2.2cm 2.2cm;box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 24px rgba(0,0,0,.08);user-select:text}
.vista .hoja img.figura:not([src]){display:inline-block;min-width:160px;min-height:70px;border:1px dashed #b8c6ca;padding:10px;color:#7a8b90;font-size:12px}
@media print{body *{visibility:hidden}.vista,.vista *{visibility:visible}.vista{position:absolute;inset:0;background:#fff;overflow:visible}.vista .hoja{box-shadow:none;margin:0;padding:0;min-height:0;max-width:none}}
`}</style>
      <SpellStyles />
      <SuiteHeader
        logo={<img src="/app-icon.png" alt="" className="w-5 h-5 rounded" />}
        logoTitle="Inicio de CoffeeLatex"
        onLogoClick={() => (void d.refrescarRecientes(), setVerInicio(true))}
        title={d.titulo}
        titlePlaceholder="Documento"
        onTitleChange={d.setTitulo}
        menus={menus}
        saveStatus={d.estado}
        fileLocation={d.ubicacion}
        isStarred={d.fijado}
        onToggleStar={() => void d.alternarFijado()}
        onBeforeClose={d.vaciar}
        actions={
          <div className="flex items-center gap-1.5">
            <span data-testid="modo" className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-white/15 tracking-wide">{modo === "latex" ? "LaTeX" : "Markdown"}</span>
            <ThemeSwitch compact />
            <button type="button" onClick={desdeFoto} className="h-7 px-2.5 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-white/15">
              <Camera size={14} /> Desde foto
            </button>
            <div className="relative">
              <button type="button" onClick={() => setMenuExportar((v) => !v)} className="h-7 px-2.5 rounded-md text-[12.5px] font-medium flex items-center gap-1 hover:bg-white/15">
                <Download size={14} /> Exportar… <ChevronDown size={12} />
              </button>
              {menuExportar && (
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg bg-white dark:bg-[#1b2427] text-[#14323a] dark:text-[#d6e1e4] border border-[#d5e0e3] dark:border-[#2c383c] shadow-xl py-1 text-[13px]" onMouseLeave={() => setMenuExportar(false)}>
                  {[
                    { t: "PDF", f: exportarPdf, n: "Motor LaTeX" },
                    { t: "HTML (página web)", f: exportarHtmlArchivo },
                    { t: "Word (.docx)", f: () => exportarConPandoc("docx", "docx", "Word"), n: "Pandoc" },
                    { t: "OpenDocument (.odt)", f: () => exportarConPandoc("odt", "odt", "OpenDocument"), n: "Pandoc" },
                    modo === "latex" ? { t: "Markdown (.md)", f: () => exportarConPandoc("markdown", "md", "Markdown"), n: "Pandoc" } : { t: "LaTeX (.tex)", f: () => exportarConPandoc("latex", "tex", "LaTeX"), n: "Pandoc" },
                    { t: modo === "latex" ? "Copia .tex" : "Copia .md", f: exportarFuente },
                  ].map((o) => (
                    <button key={o.t} type="button" onClick={() => void o.f()} className="w-full text-left px-3 py-1.5 hover:bg-[#eef5f6] dark:hover:bg-[#243034] flex items-center">
                      {o.t}
                      {o.n && <span className="ml-auto text-[10.5px] text-[#7a8b90]">{o.n}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => void exportarPdf()} className="h-7 px-3 rounded-md bg-white text-[#0d5e6f] text-[12.5px] font-bold flex items-center gap-1.5 hover:bg-[#e6f3f5]">
              <FileType2 size={14} /> PDF
            </button>
          </div>
        }
      />
      <BarraInsertar modo={modo} onBoton={(b) => void insertarBoton(b)} onSimbolo={insertarSimbolo} />
      <div className="flex-1 min-h-0 flex">
        <div className="w-1/2 min-w-0 border-r border-[#dbe5e8] dark:border-[#263236] flex flex-col">
          <div className="flex-1 min-h-0">
            <Editor ref={editor} texto={texto} modo={modo} onCambio={d.cambiar} onTecla={tecla} segmentos={segmentos} />
          </div>
          {errores && (
            <div className="max-h-48 overflow-auto border-t border-[#f0c7c0] bg-[#fff6f4] dark:bg-[#2a1816] dark:border-[#5a2a24] text-[13px]" data-testid="errores">
              <div className="sticky top-0 flex items-center gap-2 px-3 py-1.5 bg-[#fdebe7] dark:bg-[#351d1a] font-semibold text-[#a33a2a] dark:text-[#f0a59a]">
                <AlertTriangle size={14} /> El PDF no se pudo crear: {errores.length} {errores.length === 1 ? "error" : "errores"}
                <button type="button" className="ml-auto text-[12px] font-medium underline" onClick={() => void showMessage("Registro del compilador", registro.slice(-6000) || "(vacío)")}>Ver registro</button>
                <button type="button" aria-label="Cerrar" onClick={() => setErrores(null)} className="p-0.5 rounded hover:bg-black/5"><X size={14} /></button>
              </div>
              {errores.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 border-t border-[#f6dcd6] dark:border-[#40221e]">
                  <span className="font-mono text-[12px] text-[#a33a2a] w-16 shrink-0">{e.linea ? `línea ${e.linea}` : "—"}</span>
                  <span className="flex-1">{e.mensaje}</span>
                  {e.linea && <button type="button" onClick={() => editor.current?.irALinea(e.linea!)} className="text-[12px] font-semibold text-[#0d5e6f] dark:text-[#5fc4d6] hover:underline">Ir a la línea</button>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-1/2 min-w-0 overflow-auto vista" data-testid="vista">
          <div
            ref={hoja}
            className="hoja"
            dangerouslySetInnerHTML={{ __html: vista.html }}
            onClick={(e) => {
              // Los enlaces nunca cambian la ventana de la app: se abren en el navegador del sistema.
              const a = (e.target as HTMLElement).closest("a");
              if (!a) return;
              e.preventDefault();
              const href = a.getAttribute("href") ?? "";
              if (/^(https?|mailto):/i.test(href)) void openExternal(href);
            }}
          />
        </div>
      </div>
      <footer className="h-7 shrink-0 flex items-center gap-4 px-3 border-t border-[#dbe5e8] dark:border-[#263236] bg-[#f4f8f9] dark:bg-[#182024] text-[11.5px] text-[#4d646b] dark:text-[#93a7ad]">
        <span>{modo === "latex" ? "LaTeX" : "Markdown"}</span>
        <span>{palabras} palabras</span>
        {ocupado && <span className="text-[#0d5e6f] font-semibold">{ocupado}</span>}
        <div className="ml-auto"><SpellIndicator spell={spell} /></div>
      </footer>
      {aviso && (
        <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center" onMouseDown={() => setAviso(null)}>
          <div className="w-[420px] rounded-xl bg-white dark:bg-[#1b2427] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Desde foto">
            <div className="flex items-center gap-2 font-semibold text-[15px] mb-2"><Camera size={17} className="text-[#0d5e6f]" /> Desde foto</div>
            <p className="text-[13.5px] leading-relaxed text-[#3d5359] dark:text-[#b5c6cb]">{aviso}</p>
            <div className="mt-4 flex justify-end"><button type="button" onClick={() => setAviso(null)} className="h-8 px-4 rounded-md bg-[#0d5e6f] text-white text-[13px] font-semibold">Entendido</button></div>
          </div>
        </div>
      )}
      {spell.menu}
      <DialogHost />
    </div>
  );
};
