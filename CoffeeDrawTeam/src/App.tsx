// CoffeeDrawTeam: tablero para trabajar en grupo (o solo) con notas, diagramas, texto,
// imágenes y dibujo. Se comparte con un link; cada persona tiene su cursor de color.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, Copy, Download, History, Maximize2, Minus, Share2, X } from "lucide-react";
import { crearTablero, elementosDe, imagenesDe, listar, metaDe } from "./board/model";
import { aplicarPlantilla, PLANTILLAS, type PlantillaId } from "./board/templates";
import { crearSala, type Sala } from "./board/link";
import { cargarPerfil, guardarPerfil, type Persona } from "./board/personas";
import { Lienzo, useElegirImagen, type Herramienta, type OpcionesDibujo } from "./canvas/Lienzo";
import type { Punto } from "./canvas/vista";
import { BarraHerramientas } from "./canvas/BarraHerramientas";
import { Inspector } from "./canvas/Inspector";
import { DialogoCompartir, DialogoPerfil, DialogoUnirse } from "./equipo/Dialogos";
import { EstadoConexion, etiquetaRed, PanelHistorial, PanelPersonas } from "./equipo/Paneles";
import { useSesion } from "./equipo/useSesion";
import { Inicio } from "./archivo/Inicio";
import { miId, recordarUnido, store, tablerosUnidos, type Unido } from "./archivo/almacen";
import { exportarPDF, exportarPNG } from "./archivo/exportar";
import { downloadBlob } from "./studio/docStore";
import { appWindow, getLaunchArgs, isTauri, saveFileAs, type RecentEntry } from "./studio/desktop";

interface Tablero {
  doc: Y.Doc;
  titulo: string;
  docId: string;
  location: string | null;
  /** Mío (lo guardo y soy anfitrión al compartir) o de otra persona (invitado). */
  propio: boolean;
  link: Sala | null;
  /** Llave secreta del anfitrión (solo en tableros propios compartidos desde la app de escritorio). */
  secreto: string | null;
}

const OPCIONES: OpcionesDibujo = { notaColor: "amarillo", formaTipo: "rect", trazoColor: "#2c1b12", grosor: 4 };
const AUTOGUARDADO_MS = 3000;

function nombreDelTablero(doc: Y.Doc, porDefecto: string): string {
  const n = metaDe(doc).get("nombre");
  return typeof n === "string" && n.trim() ? n : porDefecto;
}

export const App: React.FC = () => {
  const [perfil, setPerfil] = useState(cargarPerfil);
  const [editarPerfil, setEditarPerfil] = useState(false);
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [herramienta, setHerramienta] = useState<Herramienta>("seleccionar");
  const [opciones, setOpciones] = useState(OPCIONES);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [irA, setIrA] = useState<{ id: string; n: number } | null>(null);
  const [historial, setHistorial] = useState(false);
  const [compartir, setCompartir] = useState(false);
  const [unirse, setUnirse] = useState<string | null>(null);
  const [siguiendo, setSiguiendo] = useState<string | null>(null);
  const [exportar, setExportar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, setVersion] = useState(0);
  const sesion = useSesion();
  const ultimoPuntero = useRef<Punto>({ x: 0, y: 0 });
  const guardado = useRef<number | null>(null);

  const yo: Persona | null = useMemo(() => (perfil ? { id: miId(), nombre: perfil.nombre, color: perfil.color } : null), [perfil]);
  const origen = tablero?.propio ? yo?.id ?? "local" : "local";

  const avisar = useCallback((t: string) => {
    setAviso(t);
    setTimeout(() => setAviso((a) => (a === t ? null : a)), 3500);
  }, []);

  // ---- Guardar ----
  const guardar = useCallback(async (t: Tablero) => {
    if (!t.propio) return;
    const conocidas = (metaDe(t.doc).get("personas") as Record<string, { nombre: string; color: string }>) ?? {};
    const personas = Object.entries(conocidas).map(([id, p]) => ({ id, ...p }));
    try {
      const location = await store.persist({ doc: t.doc, meta: { nombre: t.titulo, link: t.link ?? undefined, secreto: t.secreto ?? undefined, personas } }, t.titulo, t.docId, t.location);
      if (location !== t.location) setTablero((x) => (x && x.docId === t.docId ? { ...x, location } : x));
    } catch {
      avisar("No se pudo guardar el tablero");
    }
  }, [avisar]);

  // El temporizador lee el tablero de este momento (nombre, link y ubicación al día).
  const actual = useRef<Tablero | null>(null);
  actual.current = tablero;
  const docActual = tablero?.propio ? tablero.doc : null;
  useEffect(() => {
    if (!docActual) return;
    const guardarAhora = () => {
      if (actual.current?.doc === docActual) void guardar(actual.current);
    };
    const alCambiar = () => {
      if (guardado.current) clearTimeout(guardado.current);
      guardado.current = window.setTimeout(guardarAhora, AUTOGUARDADO_MS);
    };
    docActual.on("update", alCambiar);
    window.addEventListener("beforeunload", guardarAhora);
    return () => {
      docActual.off("update", alCambiar);
      window.removeEventListener("beforeunload", guardarAhora);
      if (guardado.current) {
        clearTimeout(guardado.current);
        guardado.current = null;
        guardarAhora();
      }
    };
  }, [docActual, guardar]);

  // Redibujar la barra cuando cambian el nombre o las personas del tablero.
  useEffect(() => {
    if (!tablero) return;
    const f = () => setVersion((v) => v + 1);
    metaDe(tablero.doc).observe(f);
    return () => metaDe(tablero.doc).unobserve(f);
  }, [tablero]);

  const docTablero = tablero?.doc ?? null;
  const undo = useMemo(
    () => (docTablero ? new Y.UndoManager([elementosDe(docTablero), imagenesDe(docTablero)], { trackedOrigins: new Set([origen]) }) : null),
    [docTablero, origen],
  );
  useEffect(() => () => undo?.destroy(), [undo]);

  // ---- Abrir y crear ----
  const abrirTablero = useCallback(async (t: Tablero) => {
    sesion.cerrar();
    setSeleccion([]);
    setHistorial(false);
    setSiguiendo(null);
    setTablero(t);
    if (t.propio && t.link && yo) await sesion.anfitrion(t.doc, yo, t.link, t.secreto);
  }, [sesion, yo]);

  const nuevo = useCallback((plantilla: PlantillaId, titulo?: string) => {
    if (!yo) return;
    const doc = crearTablero();
    const nombre = titulo ?? (plantilla === "blanco" ? "Tablero sin título" : PLANTILLAS.find((p) => p.id === plantilla)!.nombre);
    metaDe(doc).set("nombre", nombre);
    aplicarPlantilla(doc, plantilla, yo.id);
    const t: Tablero = { doc, titulo: nombre, docId: store.newDocId(), location: null, propio: true, link: null, secreto: null };
    void abrirTablero(t);
    void guardar(t);
  }, [yo, abrirTablero, guardar]);

  const abrirArchivo = useCallback(async (abrir: () => Promise<{ doc: { doc: Y.Doc; meta: { nombre: string; link?: Sala; secreto?: string } }; docId: string; location: string | null } | null>) => {
    try {
      const a = await abrir();
      if (!a) return;
      const titulo = a.doc.meta.nombre || nombreDelTablero(a.doc.doc, "Tablero sin título");
      await abrirTablero({ doc: a.doc.doc, titulo, docId: a.docId, location: a.location, propio: true, link: a.doc.meta.link ?? null, secreto: a.doc.meta.secreto ?? null });
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se pudo abrir el tablero");
    }
  }, [abrirTablero, avisar]);

  const abrirReciente = (r: RecentEntry) =>
    abrirArchivo(() => (r.path.startsWith("web:") ? store.openWebEntry(r.path.slice(4)) : store.openPath(r.path, r.id)));

  const entrar = useCallback(async (sala: Sala, quien: { nombre: string; color: string }) => {
    const doc = crearTablero();
    const t: Tablero = { doc, titulo: "Tablero compartido", docId: store.newDocId(), location: null, propio: false, link: sala, secreto: null };
    sesion.cerrar();
    setSeleccion([]);
    setTablero(t);
    setUnirse(null);
    recordarUnido({ nombre: tablerosUnidos().find((u) => u.link.sala === sala.sala)?.nombre ?? "Tablero compartido", link: sala, fecha: Date.now() });
    await sesion.invitado(doc, quien, sala);
  }, [sesion]);

  // El nombre del tablero ajeno llega con el tablero: se recuerda para «Tableros a los que me uní».
  const tituloVisible = tablero ? (tablero.propio ? tablero.titulo : nombreDelTablero(tablero.doc, tablero.titulo)) : "";
  useEffect(() => {
    if (tablero && !tablero.propio && tablero.link && tituloVisible !== "Tablero compartido")
      recordarUnido({ nombre: tituloVisible, link: sesion.estado.link ?? tablero.link, fecha: Date.now() });
  }, [tablero, tituloVisible, sesion.estado.link]);

  // Archivo o tablero nuevo pedido por el Launcher
  useEffect(() => {
    if (!perfil) return;
    let hecho = false;
    void getLaunchArgs().then(async (args) => {
      if (hecho) return;
      const enlace = isTauri ? await invoke<string | null>("enlace_inicial").catch(() => null) : null;
      if (enlace || args.file?.startsWith("coffeedrawteam://")) setUnirse(enlace ?? args.file);
      else if (args.file) void abrirArchivo(() => store.openPath(args.file!));
      else if (args.docId) void abrirArchivo(() => store.openWebEntry(args.docId!));
      else if (args.newTitle) nuevo("blanco", args.newTitle);
      const link = new URLSearchParams(window.location.search).get("unirse");
      if (link) setUnirse(link);
    });
    // Link abierto con la app ya abierta
    const quitar = isTauri ? listen<string>("enlace", (e) => setUnirse(e.payload)) : null;
    return () => {
      hecho = true;
      void quitar?.then((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!perfil]);

  // ---- Acciones del tablero ----
  const salir = async () => {
    if (tablero) await guardar(tablero);
    sesion.cerrar();
    setTablero(null);
  };

  const empezarACompartir = async () => {
    if (!tablero || !yo) return;
    let link = tablero.link;
    let secreto = tablero.secreto;
    if (!link) {
      link = crearSala();
      // En la app de escritorio, el anfitrión firma sus respuestas: la llave pública va en el link.
      if (isTauri) {
        try {
          const k = await invoke<{ secreto: string; publica: string }>("red_nueva_llave");
          secreto = k.secreto;
          link = { ...link, llave: k.publica };
        } catch {
          /* sin llave: el link funciona igual, sin la comprobación extra */
        }
      }
      const t = { ...tablero, link, secreto };
      setTablero(t);
      void guardar(t);
    }
    setCompartir(true);
    if (sesion.estado.modo !== "anfitrion") await sesion.anfitrion(tablero.doc, yo, link, secreto);
  };

  // El link cambia al expulsar o al pedir uno nuevo: se guarda en el archivo.
  useEffect(() => {
    const l = sesion.estado.link;
    if (tablero?.propio && l && l.sala !== tablero.link?.sala) {
      const t = { ...tablero, link: l };
      setTablero(t);
      void guardar(t);
    }
  }, [sesion.estado.link, tablero, guardar]);

  const guardarCopia = () => {
    if (!tablero) return;
    const doc = crearTablero();
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(tablero.doc));
    const titulo = `${tituloVisible} (copia)`;
    metaDe(doc).set("nombre", titulo);
    const t: Tablero = { doc, titulo, docId: store.newDocId(), location: null, propio: true, link: null, secreto: null };
    const conectado = !tablero.propio && !sesion.estado.fin;
    // Mientras se está dentro del tablero compartido, la copia se guarda sin salir de él.
    if (conectado) void guardar(t);
    else {
      void abrirTablero(t);
      void guardar(t);
    }
    avisar("Copia guardada en Mis tableros");
  };

  // Cerrar la ventana: guardar, avisar a los invitados («El anfitrión cerró el tablero») y salir.
  const cerrarVentana = async () => {
    if (tablero) await guardar(tablero);
    sesion.cerrar();
    await new Promise((r) => setTimeout(r, 500));
    await appWindow.close();
  };
  const controles = isTauri && (
    <div className="flex items-center gap-0.5 ml-1" data-controles-ventana>
      <button type="button" aria-label="Minimizar" className="w-9 h-9 rounded-lg hover:bg-[#f3ece4] flex items-center justify-center" onClick={() => void appWindow.minimize()}><Minus size={16} /></button>
      <button type="button" aria-label="Maximizar" className="w-9 h-9 rounded-lg hover:bg-[#f3ece4] flex items-center justify-center" onClick={() => void appWindow.toggleMaximize()}><Maximize2 size={14} /></button>
      <button type="button" aria-label="Cerrar" className="w-9 h-9 rounded-lg hover:bg-[#e81123] hover:text-white flex items-center justify-center" onClick={() => void cerrarVentana()}><X size={16} /></button>
    </div>
  );

  const reintentar = () => {
    if (!tablero || !yo) return;
    if (tablero.propio && tablero.link) void sesion.anfitrion(tablero.doc, yo, tablero.link, tablero.secreto);
    else if (!tablero.propio && tablero.link && perfil) void sesion.invitado(tablero.doc, perfil, sesion.estado.link ?? tablero.link);
  };

  const hacerExportacion = async (formato: "png" | "pdf", soloSeleccion: boolean) => {
    if (!tablero) return;
    setExportar(false);
    try {
      const ids = soloSeleccion ? seleccion : undefined;
      const blob = formato === "png" ? await exportarPNG(tablero.doc, ids) : await exportarPDF(tablero.doc, ids);
      const nombre = `${tituloVisible}.${formato}`;
      if (isTauri) await saveFileAs(nombre, [{ name: formato.toUpperCase(), extensions: [formato] }], blob, "Exportar tablero");
      else downloadBlob(blob, nombre);
    } catch {
      avisar("No se pudo exportar el tablero");
    }
  };

  const insertar = useElegirImagen((f) => window.dispatchEvent(new CustomEvent("cdt-insertar-imagen", { detail: f })));

  // ---- Presencia ----
  const alMoverPuntero = useCallback((p: Punto) => {
    ultimoPuntero.current = p;
    sesion.presencia({ x: p.x, y: p.y, seleccion });
  }, [sesion, seleccion]);
  useEffect(() => {
    sesion.presencia({ ...ultimoPuntero.current, seleccion });
  }, [seleccion, sesion]);

  const cursorSeguido = siguiendo ? sesion.estado.cursores.find((c) => c.id === siguiendo) : undefined;
  const seguir = useMemo(() => (cursorSeguido ? { x: cursorSeguido.x, y: cursorSeguido.y } : null), [cursorSeguido?.x, cursorSeguido?.y]);

  // ---- Pantallas ----
  if (!perfil || editarPerfil) {
    return (
      <div className="h-full w-full bg-[#faf7f2]">
        <DialogoPerfil
          inicial={perfil ?? undefined}
          alCerrar={perfil ? () => setEditarPerfil(false) : undefined}
          alGuardar={(p) => { guardarPerfil(p); setPerfil(p); setEditarPerfil(false); }}
        />
      </div>
    );
  }

  const soloLectura = !!sesion.estado.fin || (!tablero?.propio && sesion.estado.red?.tipo !== "conectado");
  const estadoRed = etiquetaRed(sesion.estado);

  return (
    <div className="h-full w-full flex flex-col bg-[#faf7f2] text-[#2c1b12]">
      {!tablero && isTauri && (
        <div className="h-10 shrink-0 flex items-center justify-end px-2 bg-[#faf7f2]" data-tauri-drag-region>{controles}</div>
      )}
      {!tablero ? (
        <Inicio
          perfil={perfil}
          alNuevo={(p) => nuevo(p)}
          alAbrir={(r) => void abrirReciente(r)}
          alUnirse={() => setUnirse("")}
          alVolver={(u: Unido) => void entrar(u.link, perfil)}
          alPerfil={() => setEditarPerfil(true)}
        />
      ) : (
        <>
          <header className="h-14 shrink-0 flex items-center gap-3 px-3 bg-white border-b border-[#e8dfd8]" data-tauri-drag-region>
            <button type="button" className="w-9 h-9 rounded-lg hover:bg-[#f3ece4] flex items-center justify-center" onClick={() => void salir()} aria-label="Volver al inicio" title="Volver al inicio">
              <ArrowLeft size={18} />
            </button>
            <img src="/app-icon.png" alt="" className="w-7 h-7" draggable={false} />
            {tablero.propio ? (
              <input
                className="font-display font-bold text-base bg-transparent outline-none rounded-lg px-2 h-9 hover:bg-[#faf7f2] focus:bg-[#faf7f2] min-w-0 w-64"
                value={tablero.titulo}
                aria-label="Nombre del tablero"
                onChange={(e) => { setTablero({ ...tablero, titulo: e.target.value }); metaDe(tablero.doc).set("nombre", e.target.value); }}
              />
            ) : (
              <span className="font-display font-bold text-base px-2 truncate">{tituloVisible}</span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sesion.estado.modo === "solo" ? "bg-[#f3ece4] text-[#8d6e63]" : sesion.estado.red?.tipo === "conectado" && !sesion.estado.fin ? "bg-[#e3f5e1] text-[#2e7d32]" : "bg-[#fff1e0] text-[#a8541a]"}`} data-estado-red>
              {estadoRed}
            </span>
            <div className="flex-1" />
            <PanelPersonas
              personas={sesion.estado.personas}
              miId={sesion.estado.miId}
              esAnfitrion={sesion.estado.modo === "anfitrion"}
              siguiendo={siguiendo}
              alSeguir={setSiguiendo}
              alExpulsar={(p) => { if (window.confirm(`¿Sacar a ${p.nombre} del tablero? El link cambiará para que no pueda volver a entrar.`)) void sesion.expulsar(p.id).catch((e) => avisar(e instanceof Error ? e.message : "No se pudo cambiar el link")); }}
            />
            <button type="button" className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-semibold ${historial ? "bg-[#f3ece4]" : "hover:bg-[#f3ece4]"}`} onClick={() => setHistorial(!historial)} aria-pressed={historial}>
              <History size={16} /> Historial
            </button>
            <div className="relative">
              <button type="button" className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-semibold hover:bg-[#f3ece4]" onClick={() => setExportar(!exportar)}>
                <Download size={16} /> Exportar
              </button>
              {exportar && (
                <div className="absolute right-0 top-11 z-30 w-56 rounded-2xl bg-white border border-[#e8dfd8] shadow-xl p-1.5 flex flex-col text-sm">
                  {(["png", "pdf"] as const).flatMap((f) => [
                    <button key={f} type="button" className="text-left px-3 py-2 rounded-lg hover:bg-[#faf7f2]" onClick={() => void hacerExportacion(f, false)}>Todo el tablero ({f.toUpperCase()})</button>,
                    seleccion.length > 0 && <button key={`${f}-s`} type="button" className="text-left px-3 py-2 rounded-lg hover:bg-[#faf7f2]" onClick={() => void hacerExportacion(f, true)}>Lo seleccionado ({f.toUpperCase()})</button>,
                  ])}
                </div>
              )}
            </div>
            {tablero.propio ? (
              <button type="button" className="h-9 px-4 rounded-xl bg-[#f08c2e] text-white flex items-center gap-1.5 text-sm font-semibold hover:bg-[#d97a1f]" onClick={() => void empezarACompartir()}>
                <Share2 size={16} /> Compartir
              </button>
            ) : (
              <button type="button" className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-semibold hover:bg-[#f3ece4]" onClick={guardarCopia}>
                <Copy size={16} /> Guardar una copia
              </button>
            )}
            {controles}
          </header>

          <main className="relative flex-1 min-h-0">
            {undo && (
              <Lienzo
                key={tablero.docId}
                doc={tablero.doc}
                origen={origen}
                autor={sesion.estado.miId ?? yo!.id}
                soloLectura={soloLectura}
                undo={undo}
                herramienta={herramienta}
                setHerramienta={setHerramienta}
                opciones={opciones}
                seleccion={seleccion}
                setSeleccion={setSeleccion}
                irA={irA}
                seguir={seguir}
                cursores={sesion.estado.cursores}
                alMoverPuntero={alMoverPuntero}
                alAviso={avisar}
              />
            )}
            <BarraHerramientas herramienta={herramienta} setHerramienta={setHerramienta} opciones={opciones} setOpciones={setOpciones} alImagen={insertar} soloLectura={soloLectura} />
            {!soloLectura && <Inspector doc={tablero.doc} seleccion={seleccion} elementos={listar(tablero.doc)} origen={origen} alBorrar={() => setSeleccion([])} />}
            {historial && <PanelHistorial doc={tablero.doc} yoId={sesion.estado.miId ?? yo?.id ?? null} alCerrar={() => setHistorial(false)} alIr={(id) => setIrA({ id, n: Date.now() })} />}
            <EstadoConexion estado={sesion.estado} alReintentar={reintentar} alGuardarCopia={guardarCopia} alSalir={() => void salir()} />
            {!tablero.propio && sesion.estado.red?.tipo === "conectando" && !sesion.estado.fin && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-5 py-3 rounded-2xl bg-white border border-[#e8dfd8] shadow-lg text-sm font-semibold">Conectando con el anfitrión…</div>
              </div>
            )}
          </main>
        </>
      )}

      {unirse !== null && (
        <DialogoUnirse perfil={perfil} linkInicial={unirse} alCerrar={() => setUnirse(null)} alUnirse={(sala, quien) => void entrar(sala, quien)} />
      )}
      {compartir && tablero?.link && (
        <DialogoCompartir link={sesion.estado.link ?? tablero.link} alCerrar={() => setCompartir(false)} alCambiarLink={() => sesion.cambiarLink().catch((e) => avisar(e instanceof Error ? e.message : "No se pudo cambiar el link"))} />
      )}
      {aviso && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#2c1b12] text-white text-sm shadow-xl" role="status">{aviso}</div>
      )}
    </div>
  );
};
