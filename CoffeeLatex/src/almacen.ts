// Documentos de CoffeeLatex: un archivo .tex o .md, sin formato propio, en la Bóveda (o en
// IndexedDB en el navegador), con recientes compartidos con el Launcher y guardado automático.

import { useCallback, useEffect, useRef, useState } from "react";
import { createDocStore, type OpenedDocument } from "./studio/docStore";
import { extensionOf, getLaunchArgs, isTauri, listRecent, pickOpenFile, saveFileAs, setPinned, stripExtension, type PickedFile, type RecentEntry } from "./studio/desktop";
import type { SaveStatus } from "./studio/SuiteHeader";
import { showMessage } from "./studio/Dialogs";
import type { Modo } from "./editor/insertar";
import { PLANTILLAS } from "./editor/plantillas";

export const APP_ID = "coffeelatex";

const base = { appId: APP_ID, category: "Office", serialize: (t: string) => t, parse: (t: string) => t };
export const STORES = {
  latex: createDocStore<string>({ ...base, extension: "tex", defaultTitle: "Documento", kindLabel: "Documento LaTeX", create: () => PLANTILLAS.find((p) => p.id === "blanco")!.contenido }),
  markdown: createDocStore<string>({ ...base, extension: "md", defaultTitle: "Notas", kindLabel: "Documento Markdown", create: () => PLANTILLAS.find((p) => p.id === "md-blanco")!.contenido }),
};

export const EXTENSIONES = ["tex", "md", "markdown", "txt"];

export function modoDe(nombre: string): Modo {
  return ["md", "markdown"].includes(extensionOf(nombre)) ? "markdown" : "latex";
}

/** Si un texto sin extensión parece LaTeX o Markdown. */
export function adivinarModo(texto: string): Modo {
  return /\\documentclass|\\begin\{document\}|\\section\{/.test(texto) ? "latex" : "markdown";
}

export interface Documento {
  modo: Modo;
  texto: string;
}

export function useDocumento() {
  const [doc, setDoc] = useState<Documento | null>(null);
  const [titulo, setTituloState] = useState("Documento");
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [estado, setEstado] = useState<SaveStatus>("saved");
  const [fijado, setFijado] = useState(false);
  const [recientes, setRecientes] = useState<RecentEntry[]>([]);
  const meta = useRef({ titulo: "Documento", docId: STORES.latex.newDocId(), ubicacion: null as string | null, fijado: false });
  const docRef = useRef<Documento | null>(null);
  const timer = useRef<number | null>(null);
  const guardando = useRef<Promise<void> | null>(null);

  const guardar = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    setEstado("saving");
    const m = meta.current;
    const run = (async () => {
      try {
        const ruta = await STORES[d.modo].persist(d.texto, m.titulo, m.docId, m.ubicacion, m.fijado);
        if (ruta !== m.ubicacion) {
          meta.current.ubicacion = ruta;
          setUbicacion(ruta);
        }
        setEstado(docRef.current === d ? "saved" : "dirty");
      } catch (e) {
        console.error(e);
        setEstado("error");
      }
    })();
    guardando.current = run;
    await run;
    guardando.current = null;
  }, []);

  const vaciar = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
      await guardar();
    } else if (guardando.current) await guardando.current;
  }, [guardar]);

  const cambiar = useCallback((texto: string) => {
    if (!docRef.current) return;
    const d = { ...docRef.current, texto };
    docRef.current = d;
    setDoc(d);
    setEstado("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void guardar();
    }, 1200);
  }, [guardar]);

  const cargar = useCallback(async (f: OpenedDocument<string>, modo: Modo, pin = false) => {
    await vaciar();
    const d = { modo, texto: f.doc };
    docRef.current = d;
    const t = stripExtension(f.name) || STORES[modo].defaultTitle;
    meta.current = { titulo: t, docId: f.docId, ubicacion: f.location, fijado: pin };
    setDoc(d);
    setTituloState(t);
    setUbicacion(f.location);
    setFijado(pin);
    setEstado("saved");
    if (f.location) void STORES[modo].remember(f);
  }, [vaciar]);

  const nuevo = useCallback(async (modo: Modo, texto: string, nombre?: string) => {
    const s = STORES[modo];
    await cargar({ name: `${nombre || s.defaultTitle}.${s.extension}`, doc: texto, location: null, docId: s.newDocId() }, modo);
    void guardar();
  }, [cargar, guardar]);

  const abrirElegido = useCallback(async (f: PickedFile) => {
    const texto = new TextDecoder().decode(f.bytes);
    const modo = modoDe(f.name);
    if (extensionOf(f.name) === STORES[modo].extension && f.path) {
      await cargar({ name: f.name, doc: texto, location: f.path, docId: STORES[modo].newDocId() }, modo);
    } else {
      // .markdown, .txt o del navegador: se abre como documento nuevo con su contenido.
      await nuevo(modo, texto, stripExtension(f.name));
    }
  }, [cargar, nuevo]);

  const abrir = useCallback(async () => {
    try {
      const f = await pickOpenFile([{ name: "LaTeX y Markdown", extensions: EXTENSIONES }], "Abrir en CoffeeLatex");
      if (f) await abrirElegido(f);
    } catch (e) {
      await showMessage("No se pudo abrir", String(e));
    }
  }, [abrirElegido]);

  const abrirReciente = useCallback(async (r: RecentEntry) => {
    const modo = modoDe(r.name || r.path);
    try {
      if (r.path.startsWith("web:")) {
        const f = await STORES[modo].openWebEntry(r.path.slice(4));
        if (f) await cargar(f, modo, r.is_pinned);
        else await showMessage("No se encontró", "El documento ya no está disponible.");
      } else await cargar(await STORES[modo].openPath(r.path, r.id), modo, r.is_pinned);
    } catch (e) {
      await showMessage("No se pudo abrir el documento", String(e));
    }
  }, [cargar]);

  const refrescarRecientes = useCallback(async () => setRecientes(await listRecent(APP_ID)), []);

  const setTitulo = useCallback((t: string) => {
    meta.current.titulo = t;
    setTituloState(t);
    if (docRef.current) cambiar(docRef.current.texto);
  }, [cambiar]);

  const guardarComo = useCallback(async () => {
    const d = docRef.current;
    if (!d) return;
    const s = STORES[d.modo];
    const ruta = await saveFileAs(s.ensureExtension(meta.current.titulo), [{ name: s.kindLabel, extensions: [s.extension] }], d.texto);
    if (ruta && isTauri) {
      meta.current.ubicacion = ruta;
      meta.current.docId = s.newDocId();
      setUbicacion(ruta);
      await guardar();
    }
  }, [guardar]);

  const alternarFijado = useCallback(async () => {
    const v = !meta.current.fijado;
    meta.current.fijado = v;
    setFijado(v);
    await setPinned(meta.current.docId, v);
  }, []);

  // Al iniciar: archivo de «Abrir con», plantilla del Launcher o documento del navegador.
  useEffect(() => {
    void (async () => {
      await refrescarRecientes();
      const a = await getLaunchArgs();
      if (a.file) {
        const modo = modoDe(a.file);
        try {
          await cargar(await STORES[modo].openPath(a.file), modo);
        } catch (e) {
          await showMessage("No se pudo abrir", String(e));
        }
      } else if (a.docId) {
        for (const modo of ["latex", "markdown"] as const) {
          const f = await STORES[modo].openWebEntry(a.docId);
          if (f) { await cargar(f, modo); break; }
        }
      } else if (a.payload) {
        let modo: Modo = adivinarModo(a.payload);
        let texto = a.payload;
        try {
          const j = JSON.parse(a.payload) as { modo?: Modo; texto?: string; plantilla?: string };
          const p = PLANTILLAS.find((x) => x.id === j.plantilla);
          if (p) { modo = p.modo; texto = p.contenido; }
          else if (typeof j.texto === "string") { texto = j.texto; modo = j.modo ?? adivinarModo(j.texto); }
        } catch { /* texto plano */ }
        await nuevo(modo, texto, a.newTitle ?? undefined);
      } else if (a.newTitle) {
        await nuevo("latex", STORES.latex.create(), a.newTitle);
      }
    })();
  }, [cargar, nuevo, refrescarRecientes]);

  useEffect(() => {
    const salir = () => void vaciar();
    window.addEventListener("beforeunload", salir);
    return () => window.removeEventListener("beforeunload", salir);
  }, [vaciar]);

  return { doc, titulo, setTitulo, ubicacion, estado, fijado, alternarFijado, recientes, refrescarRecientes, cambiar, nuevo, abrir, abrirElegido, abrirReciente, guardar, guardarComo, vaciar, cerrar: () => setDoc(null) };
}

export type DocumentoState = ReturnType<typeof useDocumento>;
