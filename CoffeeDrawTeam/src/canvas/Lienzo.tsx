// Lienzo infinito del tablero: herramientas, selección, mover, redimensionar, texto,
// dibujo, conectores, imágenes, cursores ajenos y minimapa.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Y from "yjs";
import {
  actualizar, agregar, borrar, imagenesDe, listar, nuevoId, obtener, zMaximo,
  type Elemento, type Extremo, type NotaColor,
} from "../board/model";
import { reducirImagen } from "../board/imagenes";
import { ElementoSVG, Marcadores, ACENTO } from "./render";
import { ajustarTodo, aTablero, zoomEn, type Camara, type Caja, type Punto } from "./vista";
import { cajaDe, elementosEnRect, redimensionar, type Asa } from "./seleccion";
import { simplificar, trazoTocado } from "./trazos";
import { Minimapa } from "./Minimapa";

export type Herramienta = "seleccionar" | "mano" | "nota" | "texto" | "forma" | "conector" | "lapiz" | "marcador" | "borrador";
export type FormaTipo = "rect" | "elipse" | "rombo" | "flecha";

export interface OpcionesDibujo {
  notaColor: NotaColor;
  formaTipo: FormaTipo;
  trazoColor: string;
  grosor: number;
}

export interface CursorAjeno {
  id: string;
  nombre: string;
  color: string;
  x: number;
  y: number;
  seleccion: string[];
  quieto: boolean;
}

interface Props {
  doc: Y.Doc;
  /** Origen de los cambios locales (para deshacer y para el historial). */
  origen: string;
  autor: string;
  soloLectura: boolean;
  undo: Y.UndoManager;
  herramienta: Herramienta;
  setHerramienta: (h: Herramienta) => void;
  opciones: OpcionesDibujo;
  seleccion: string[];
  setSeleccion: (ids: string[]) => void;
  irA?: { id: string; n: number } | null;
  seguir?: Punto | null;
  cursores?: CursorAjeno[];
  alMoverPuntero?: (p: Punto) => void;
  alAviso?: (texto: string) => void;
}

type Arrastre =
  | { tipo: "pan"; inicio: Punto; cam: Camara }
  | { tipo: "mover"; inicio: Punto; pos: Map<string, Punto> }
  | { tipo: "asa"; asa: Asa; inicio: Punto; el: Elemento }
  | { tipo: "rect"; inicio: Punto; fin: Punto }
  | { tipo: "forma"; inicio: Punto; fin: Punto }
  | { tipo: "conector"; desde: Extremo; inicio: Punto; fin: Punto }
  | { tipo: "trazo"; puntos: number[] }
  | { tipo: "borrar" };

const ASAS: Asa[] = ["no", "n", "ne", "e", "se", "s", "so", "o"];
const CURSOR_ASA: Record<Asa, string> = { n: "ns-resize", s: "ns-resize", e: "ew-resize", o: "ew-resize", ne: "nesw-resize", so: "nesw-resize", no: "nwse-resize", se: "nwse-resize" };
const ESTILO_EDICION = "w-full h-full resize-none bg-transparent outline-none p-2 text-[#2c1b12] font-medium";

function posAsa(c: Caja, a: Asa): Punto {
  const x = a.includes("o") ? c.x : a.includes("e") ? c.x + c.w : c.x + c.w / 2;
  const y = a === "n" || a === "ne" || a === "no" ? c.y : a.includes("s") ? c.y + c.h : c.y + c.h / 2;
  return { x, y };
}

export function Lienzo(p: Props) {
  const { doc, origen, autor, soloLectura, undo, herramienta, opciones, seleccion, setSeleccion } = p;
  const svgRef = useRef<SVGSVGElement>(null);
  const [tam, setTam] = useState({ w: 1200, h: 800 });
  const [cam, setCam] = useState<Camara>({ x: -600, y: -400, zoom: 1 });
  const [, setVersion] = useState(0);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [espacio, setEspacio] = useState(false);
  const ajustado = useRef(false);

  // Volver a dibujar cuando cambia el tablero (propio o ajeno).
  useEffect(() => {
    const f = () => setVersion((v) => v + 1);
    doc.on("update", f);
    return () => doc.off("update", f);
  }, [doc]);

  const elementos = listar(doc);

  // URLs de las imágenes
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const mapa = imagenesDe(doc);
    let actuales = new Map<string, string>();
    const rehacer = () => {
      const nuevas = new Map<string, string>();
      mapa.forEach((bytes, id) => {
        nuevas.set(id, actuales.get(id) ?? URL.createObjectURL(new Blob([bytes.slice()])));
      });
      for (const [id, u] of actuales) if (!nuevas.has(id)) URL.revokeObjectURL(u);
      actuales = nuevas;
      setUrls(nuevas);
    };
    rehacer();
    mapa.observe(rehacer);
    return () => {
      mapa.unobserve(rehacer);
      for (const u of actuales.values()) URL.revokeObjectURL(u);
    };
  }, [doc]);

  // Tamaño del lienzo
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setTam({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Encuadre inicial
  useEffect(() => {
    if (ajustado.current || tam.w < 50) return;
    ajustado.current = true;
    setCam(ajustarTodo(elementos.map(({ x, y, w, h }) => ({ x, y, w, h })), tam.w, tam.h));
  }, [tam, elementos]);

  // Ir a un elemento (desde el historial)
  useEffect(() => {
    if (!p.irA) return;
    const el = obtener(doc, p.irA.id);
    if (!el) return;
    const zoom = Math.max(cam.zoom, 0.8);
    setCam({ zoom, x: el.x + el.w / 2 - tam.w / 2 / zoom, y: el.y + el.h / 2 - tam.h / 2 / zoom });
    setResaltado(el.id);
    const t = setTimeout(() => setResaltado(null), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.irA]);

  // Seguir el cursor de otra persona
  useEffect(() => {
    if (!p.seguir) return;
    setCam((c) => ({ ...c, x: p.seguir!.x - tam.w / 2 / c.zoom, y: p.seguir!.y - tam.h / 2 / c.zoom }));
  }, [p.seguir, tam]);

  const puntoDe = useCallback(
    (e: { clientX: number; clientY: number }): Punto => {
      const r = svgRef.current!.getBoundingClientRect();
      return aTablero(cam, { x: e.clientX - r.left, y: e.clientY - r.top });
    },
    [cam],
  );

  const ajustarVista = () => setCam(ajustarTodo(elementos.map(({ x, y, w, h }) => ({ x, y, w, h })), tam.w, tam.h));
  const zoomCentro = (f: number) => setCam((c) => zoomEn(c, f, { x: tam.w / 2, y: tam.h / 2 }));

  // ---- Imágenes ----
  const insertarImagen = useCallback(
    async (blob: Blob, en?: Punto) => {
      if (soloLectura) return;
      try {
        const img = await reducirImagen(blob);
        const imagenId = nuevoId();
        const escala = Math.min(1, 480 / Math.max(img.w, img.h));
        const w = img.w * escala, h = img.h * escala;
        const centro = en ?? aTablero(cam, { x: tam.w / 2, y: tam.h / 2 });
        const id = nuevoId();
        doc.transact(() => {
          imagenesDe(doc).set(imagenId, img.bytes);
          agregar(doc, { id, kind: "imagen", imagenId, x: centro.x - w / 2, y: centro.y - h / 2, w, h, z: zMaximo(doc) + 1, autor }, origen);
        }, origen);
        setSeleccion([id]);
      } catch {
        p.alAviso?.("No se pudo abrir esa imagen");
      }
    },
    [cam, tam, doc, origen, autor, soloLectura, setSeleccion, p],
  );

  useEffect(() => {
    const pegar = (e: ClipboardEvent) => {
      if (editando || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
      for (const it of e.clipboardData?.items ?? []) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            void insertarImagen(f);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", pegar);
    return () => window.removeEventListener("paste", pegar);
  }, [insertarImagen, editando]);

  // ---- Teclado ----
  useEffect(() => {
    const abajo = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.("input,textarea,select,[contenteditable=true]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") { setEspacio(true); e.preventDefault(); return; }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (!soloLectura) (e.shiftKey ? undo.redo() : undo.undo());
        return;
      }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); if (!soloLectura) undo.redo(); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); setSeleccion(elementos.map((x) => x.id)); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && seleccion.length && !soloLectura) {
        e.preventDefault();
        borrar(doc, seleccion, origen);
        setSeleccion([]);
        return;
      }
      if (e.key === "Escape") { setSeleccion([]); p.setHerramienta("seleccionar"); return; }
      if (mod || e.altKey) return;
      const atajos: Record<string, Herramienta> = { v: "seleccionar", h: "mano", n: "nota", t: "texto", r: "forma", c: "conector", p: "lapiz", m: "marcador", e: "borrador" };
      const h = atajos[e.key.toLowerCase()];
      if (h) p.setHerramienta(h);
    };
    const arriba = (e: KeyboardEvent) => { if (e.code === "Space") setEspacio(false); };
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    return () => { window.removeEventListener("keydown", abajo); window.removeEventListener("keyup", arriba); };
  }, [doc, elementos, seleccion, setSeleccion, origen, undo, soloLectura, p]);

  // ---- Ratón ----
  const elementoBajo = (e: { target: EventTarget | null }): Elemento | undefined => {
    const id = (e.target as Element)?.closest?.("[data-el]")?.getAttribute("data-el");
    return id ? elementos.find((x) => x.id === id) : undefined;
  };

  const crear = (el: Elemento, editar = false) => {
    agregar(doc, el, origen);
    setSeleccion([el.id]);
    if (editar) setEditando(el.id);
    p.setHerramienta("seleccionar");
  };

  const alBajar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || herramienta === "mano" || espacio) {
      setArrastre({ tipo: "pan", inicio: { x: e.clientX, y: e.clientY }, cam });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    setEditando(null);
    const pt = puntoDe(e);
    const bajo = elementoBajo(e);
    const z = zMaximo(doc) + 1;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);

    if (soloLectura || herramienta === "seleccionar") {
      const asa = (e.target as Element).getAttribute?.("data-asa") as Asa | null;
      if (asa && seleccion.length === 1 && !soloLectura) {
        const el = elementos.find((x) => x.id === seleccion[0]);
        if (el) setArrastre({ tipo: "asa", asa, inicio: pt, el });
        return;
      }
      if (bajo) {
        let sel = seleccion;
        if (e.shiftKey) sel = seleccion.includes(bajo.id) ? seleccion.filter((i) => i !== bajo.id) : [...seleccion, bajo.id];
        else if (!seleccion.includes(bajo.id)) sel = [bajo.id];
        setSeleccion(sel);
        if (!soloLectura) {
          const pos = new Map<string, Punto>();
          for (const el of elementos) if (sel.includes(el.id) && el.kind !== "conector") pos.set(el.id, { x: el.x, y: el.y });
          setArrastre({ tipo: "mover", inicio: pt, pos });
        }
      } else {
        if (!e.shiftKey) setSeleccion([]);
        setArrastre({ tipo: "rect", inicio: pt, fin: pt });
      }
      return;
    }
    switch (herramienta) {
      case "nota":
        crear({ id: nuevoId(), kind: "nota", x: pt.x - 90, y: pt.y - 80, w: 180, h: 160, z, autor, color: opciones.notaColor, texto: "" }, true);
        break;
      case "texto":
        crear({ id: nuevoId(), kind: "texto", x: pt.x, y: pt.y - 18, w: 260, h: 44, z, autor, texto: "", tam: 24, negrita: false, color: "#2c1b12" }, true);
        break;
      case "forma":
        setArrastre({ tipo: "forma", inicio: pt, fin: pt });
        break;
      case "conector": {
        const desde: Extremo = bajo && bajo.kind !== "conector" && bajo.kind !== "trazo" ? { id: bajo.id } : { x: pt.x, y: pt.y };
        setArrastre({ tipo: "conector", desde, inicio: pt, fin: pt });
        break;
      }
      case "lapiz":
      case "marcador":
        setArrastre({ tipo: "trazo", puntos: [pt.x, pt.y] });
        break;
      case "borrador":
        setArrastre({ tipo: "borrar" });
        borrarTrazosEn(pt);
        break;
    }
  };

  const borrarTrazosEn = (pt: Punto) => {
    const tocados = elementos.filter((x) => x.kind === "trazo" && trazoTocado(x, pt, 8 / cam.zoom)).map((x) => x.id);
    if (tocados.length) borrar(doc, tocados, origen);
  };

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = puntoDe(e);
    p.alMoverPuntero?.(pt);
    if (!arrastre) return;
    switch (arrastre.tipo) {
      case "pan":
        setCam({ ...arrastre.cam, x: arrastre.cam.x - (e.clientX - arrastre.inicio.x) / cam.zoom, y: arrastre.cam.y - (e.clientY - arrastre.inicio.y) / cam.zoom });
        break;
      case "mover": {
        const dx = pt.x - arrastre.inicio.x, dy = pt.y - arrastre.inicio.y;
        doc.transact(() => {
          for (const [id, o] of arrastre.pos) actualizar(doc, id, { x: o.x + dx, y: o.y + dy }, origen);
        }, origen);
        break;
      }
      case "asa": {
        const caja = redimensionar(arrastre.el, arrastre.asa, { dx: pt.x - arrastre.inicio.x, dy: pt.y - arrastre.inicio.y }, e.shiftKey !== (arrastre.el.kind === "imagen"));
        actualizar(doc, arrastre.el.id, caja, origen);
        break;
      }
      case "rect":
      case "forma":
      case "conector":
        setArrastre({ ...arrastre, fin: pt });
        break;
      case "trazo":
        setArrastre({ tipo: "trazo", puntos: [...arrastre.puntos, pt.x, pt.y] });
        break;
      case "borrar":
        borrarTrazosEn(pt);
        break;
    }
  };

  const alSubir = (e: React.PointerEvent<SVGSVGElement>) => {
    const a = arrastre;
    setArrastre(null);
    if (!a) return;
    const z = zMaximo(doc) + 1;
    if (a.tipo === "rect") {
      const r = { x: a.inicio.x, y: a.inicio.y, w: a.fin.x - a.inicio.x, h: a.fin.y - a.inicio.y };
      if (Math.abs(r.w) > 3 || Math.abs(r.h) > 3) {
        const dentro = elementosEnRect(elementos, r);
        setSeleccion(e.shiftKey ? [...new Set([...seleccion, ...dentro])] : dentro);
      }
    } else if (a.tipo === "forma") {
      let { x, y } = a.inicio;
      let w = a.fin.x - a.inicio.x, h = a.fin.y - a.inicio.y;
      if (Math.abs(w) < 8 && Math.abs(h) < 8) { w = 160; h = 100; x -= 80; y -= 50; }
      if (w < 0) { x += w; w = -w; }
      if (h < 0) { y += h; h = -h; }
      crear({ id: nuevoId(), kind: "forma", forma: opciones.formaTipo, x, y, w: Math.max(20, w), h: Math.max(20, h), z, autor, relleno: "#ffffff", borde: "#6f4e37", texto: "" });
    } else if (a.tipo === "conector") {
      const bajo = elementoBajo(e);
      const hasta: Extremo = bajo && bajo.kind !== "conector" && bajo.kind !== "trazo" ? { id: bajo.id } : { x: a.fin.x, y: a.fin.y };
      const mismo = "id" in a.desde && "id" in hasta && a.desde.id === hasta.id;
      const corto = Math.hypot(a.fin.x - a.inicio.x, a.fin.y - a.inicio.y) < 10;
      if (!mismo && !corto) crear({ id: nuevoId(), kind: "conector", x: 0, y: 0, w: 0, h: 0, z, autor, desde: a.desde, hasta, estilo: "recto", flecha: true, color: "#6f4e37" });
    } else if (a.tipo === "trazo") {
      const pts = simplificar(a.puntos, 0.8 / cam.zoom);
      const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const marcador = herramienta === "marcador";
      agregar(doc, {
        id: nuevoId(), kind: "trazo", x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, z, autor,
        puntos: pts.map((v, i) => (i % 2 === 0 ? v - x0 : v - y0)), grosor: marcador ? opciones.grosor * 4 : opciones.grosor,
        color: opciones.trazoColor, marcador,
      }, origen);
    }
  };

  const alRueda = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      setCam((c) => zoomEn(c, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }));
    } else {
      setCam((c) => ({ ...c, x: c.x + e.deltaX / c.zoom, y: c.y + e.deltaY / c.zoom }));
    }
  };

  const alDobleClic = (e: React.MouseEvent) => {
    if (soloLectura) return;
    const bajo = elementoBajo(e);
    if (bajo && (bajo.kind === "nota" || bajo.kind === "texto" || bajo.kind === "forma")) {
      setSeleccion([bajo.id]);
      setEditando(bajo.id);
    } else if (!bajo && herramienta === "seleccionar") {
      const pt = puntoDe(e);
      crear({ id: nuevoId(), kind: "nota", x: pt.x - 90, y: pt.y - 80, w: 180, h: 160, z: zMaximo(doc) + 1, autor, color: opciones.notaColor, texto: "" }, true);
    }
  };

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    const pt = puntoDe(e);
    const archivos = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    archivos.forEach((f, i) => void insertarImagen(f, { x: pt.x + i * 30, y: pt.y + i * 30 }));
  };

  // ---- Dibujo ----
  const caja = seleccion.length ? cajaDe(elementos, seleccion) : null;
  const unico = seleccion.length === 1 ? elementos.find((x) => x.id === seleccion[0]) : undefined;
  const editable = editando ? elementos.find((x) => x.id === editando) : undefined;
  const coloresConector = useMemo(() => elementos.filter((x) => x.kind === "conector").map((x) => (x.kind === "conector" ? x.color : "")), [elementos]);
  const cursor = espacio || herramienta === "mano" ? (arrastre?.tipo === "pan" ? "grabbing" : "grab") : herramienta === "seleccionar" ? "default" : "crosshair";
  const grosorLinea = 1.5 / cam.zoom;
  const transform = `scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;
  const seleccionAjena = (p.cursores ?? []).flatMap((c) => c.seleccion.map((id) => ({ id, color: c.color })));

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#faf7f2]" onDragOver={(e) => e.preventDefault()} onDrop={alSoltar}>
      <svg
        ref={svgRef}
        className="w-full h-full block touch-none"
        style={{ cursor }}
        data-lienzo
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSubir}
        onPointerCancel={() => setArrastre(null)}
        onWheel={alRueda}
        onDoubleClick={alDobleClic}
      >
        <defs>
          <pattern id="puntos" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill="#d9cbbd" />
          </pattern>
        </defs>
        <Marcadores colores={coloresConector} />
        <g transform={transform}>
          <rect x={cam.x} y={cam.y} width={tam.w / cam.zoom} height={tam.h / cam.zoom} fill={cam.zoom > 0.35 ? "url(#puntos)" : "transparent"} pointerEvents="none" />
          {elementos.map((el) => (
            <ElementoSVG key={el.id} el={el} doc={doc} urlImagen={el.kind === "imagen" ? urls.get(el.imagenId) : undefined} ocultarTexto={el.id === editando} />
          ))}

          {/* Selección de otras personas */}
          {seleccionAjena.map(({ id, color }) => {
            const k = cajaDe(elementos, [id]);
            return k && <rect key={`${id}-${color}`} x={k.x - 4} y={k.y - 4} width={k.w + 8} height={k.h + 8} fill="none" stroke={color} strokeWidth={grosorLinea * 1.5} strokeDasharray={`${6 / cam.zoom} ${4 / cam.zoom}`} pointerEvents="none" />;
          })}

          {resaltado && (() => {
            const k = cajaDe(elementos, [resaltado]);
            return k && <rect x={k.x - 8} y={k.y - 8} width={k.w + 16} height={k.h + 16} rx={10} fill="none" stroke={ACENTO} strokeWidth={4 / cam.zoom} className="animate-pulse" pointerEvents="none" />;
          })()}

          {caja && (
            <rect x={caja.x - 3} y={caja.y - 3} width={caja.w + 6} height={caja.h + 6} fill="none" stroke={ACENTO} strokeWidth={grosorLinea} pointerEvents="none" />
          )}
          {unico && !soloLectura && unico.kind !== "conector" && unico.kind !== "trazo" && caja &&
            ASAS.map((a) => {
              const q = posAsa(caja, a);
              const s = 9 / cam.zoom;
              return <rect key={a} data-asa={a} x={q.x - s / 2} y={q.y - s / 2} width={s} height={s} fill="#fff" stroke={ACENTO} strokeWidth={grosorLinea} style={{ cursor: CURSOR_ASA[a] }} />;
            })}

          {arrastre?.tipo === "rect" && (
            <rect
              x={Math.min(arrastre.inicio.x, arrastre.fin.x)} y={Math.min(arrastre.inicio.y, arrastre.fin.y)}
              width={Math.abs(arrastre.fin.x - arrastre.inicio.x)} height={Math.abs(arrastre.fin.y - arrastre.inicio.y)}
              fill="rgba(240,140,46,0.08)" stroke={ACENTO} strokeWidth={grosorLinea} strokeDasharray={`${4 / cam.zoom}`} pointerEvents="none"
            />
          )}
          {arrastre?.tipo === "forma" && (
            <rect
              x={Math.min(arrastre.inicio.x, arrastre.fin.x)} y={Math.min(arrastre.inicio.y, arrastre.fin.y)}
              width={Math.abs(arrastre.fin.x - arrastre.inicio.x)} height={Math.abs(arrastre.fin.y - arrastre.inicio.y)}
              fill="rgba(255,255,255,0.6)" stroke="#6f4e37" strokeWidth={grosorLinea} pointerEvents="none"
            />
          )}
          {arrastre?.tipo === "conector" && (
            <line x1={arrastre.inicio.x} y1={arrastre.inicio.y} x2={arrastre.fin.x} y2={arrastre.fin.y} stroke="#6f4e37" strokeWidth={2.5} strokeDasharray="6 4" pointerEvents="none" />
          )}
          {arrastre?.tipo === "trazo" && (
            <polyline
              points={arrastre.puntos.join(" ")}
              stroke={opciones.trazoColor}
              strokeOpacity={herramienta === "marcador" ? 0.45 : 1}
              strokeWidth={herramienta === "marcador" ? opciones.grosor * 4 : opciones.grosor}
              fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"
            />
          )}

          {editable && (editable.kind === "nota" || editable.kind === "texto" || editable.kind === "forma") && (
            <foreignObject x={editable.x} y={editable.y} width={editable.w} height={editable.h}>
              <textarea
                autoFocus
                aria-label="Texto"
                className={ESTILO_EDICION}
                style={{ fontSize: editable.kind === "texto" ? editable.tam : 18, fontWeight: editable.kind === "texto" && editable.negrita ? 700 : 500, textAlign: editable.kind === "texto" ? "left" : "center" }}
                value={editable.texto}
                onChange={(e) => actualizar(doc, editable.id, { texto: e.target.value }, origen)}
                onBlur={() => setEditando(null)}
                onKeyDown={(e) => { if (e.key === "Escape") setEditando(null); e.stopPropagation(); }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </foreignObject>
          )}

          {/* Cursores de otras personas */}
          {(p.cursores ?? []).map((c) => (
            <g key={c.id} transform={`translate(${c.x} ${c.y}) scale(${1 / cam.zoom})`} pointerEvents="none" data-cursor={c.nombre} style={{ transition: "transform 80ms linear" }}>
              <path d="M0 0 L0 17 L4.5 13 L8 20 L11 18.6 L7.6 11.8 L13 11.5 Z" fill={c.color} stroke="#fff" strokeWidth={1.2} />
              {!c.quieto && (
                <g transform="translate(14 18)">
                  <rect rx={5} width={c.nombre.length * 7.4 + 14} height={20} fill={c.color} />
                  <text x={7} y={14} fontSize={12} fontWeight={600} fill="#fff" fontFamily="'Hanken Grotesk', sans-serif">{c.nombre}</text>
                </g>
              )}
            </g>
          ))}
        </g>
      </svg>

      <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
        <Minimapa elementos={elementos} cam={cam} tam={tam} alIr={(pt) => setCam((c) => ({ ...c, x: pt.x - tam.w / 2 / c.zoom, y: pt.y - tam.h / 2 / c.zoom }))} />
        <div className="flex items-center gap-1 rounded-xl bg-white border border-[#e8dfd8] shadow-sm px-1 py-1 text-xs text-[#5c3a21]">
          <button type="button" className="w-7 h-7 rounded-lg hover:bg-[#f3ece4]" title="Alejar" onClick={() => zoomCentro(1 / 1.25)}>−</button>
          <span className="w-12 text-center font-mono" data-zoom>{Math.round(cam.zoom * 100)} %</span>
          <button type="button" className="w-7 h-7 rounded-lg hover:bg-[#f3ece4]" title="Acercar" onClick={() => zoomCentro(1.25)}>+</button>
          <button type="button" className="px-2 h-7 rounded-lg hover:bg-[#f3ece4]" title="Ajustar todo a la vista" onClick={ajustarVista}>Ajustar</button>
        </div>
      </div>
    </div>
  );
}

/** Botón para insertar imágenes desde un archivo. */
export function useElegirImagen(alElegir: (f: File) => void) {
  return () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.multiple = true;
    input.onchange = () => [...(input.files ?? [])].forEach(alElegir);
    input.click();
  };
}

