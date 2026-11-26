// «Desde foto»: la foto de una hoja de apuntes pasa a LaTeX editable. Los renglones se detectan
// solos (y se pueden marcar como texto o fórmula, quitar o dibujar a mano); las fórmulas las lee
// pix2tex (complemento «latexocr») y el texto, Tesseract (complemento «pdfcheck»). Lo dudoso
// queda en amarillo con sugerencias del diccionario de física y matemáticas.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, ArrowRight, Camera, Check, ImagePlus, Loader2, RotateCw, Sigma, Type, X } from "lucide-react";
import { desdeRgba, recortar, type Gris } from "./imagen";
import { segmentarRenglones, type Caja } from "./segmentar";
import { ajustarDudas, ensamblar, pareceFormula, revisarFormula, sugerencias, textoDeTsv, type Aviso, type Linea } from "./corrector";
import { hayModelos, MotorFormulas } from "./motor";
import type { Duda } from "./tokens";
import type { Modo } from "../editor/insertar";
import { latexToHtml } from "../preview/latex";
import { markdownToHtml } from "../preview/markdown";
import { bytesToBase64, isTauri } from "../studio/desktop";
import { ensureAddon } from "../studio/addons";
import * as ortografia from "../spell/engine";

const LADO_MAX = 1800;

interface Renglon {
  id: number;
  caja: Caja;
  tipo: "texto" | "formula";
  /** El tipo lo eligió la persona: no se adivina. */
  fijo?: boolean;
  estado: "pendiente" | "leyendo" | "listo" | "error";
  resultado?: { texto: string; dudas: Duda[] };
  error?: string;
}

interface Props {
  modo: Modo;
  onInsertar: (texto: string) => void;
  onCerrar: () => void;
}

async function grisDeArchivo(f: Blob): Promise<{ gris: Gris; url: string }> {
  const bmp = await createImageBitmap(f);
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * escala)), h = Math.max(1, Math.round(bmp.height * escala));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const gris = desdeRgba(ctx.getImageData(0, 0, w, h).data, w, h);
  return { gris, url: c.toDataURL("image/jpeg", 0.9) };
}

async function pngDe(g: Gris): Promise<Uint8Array> {
  const c = document.createElement("canvas");
  c.width = g.ancho;
  c.height = g.alto;
  const ctx = c.getContext("2d")!;
  const d = ctx.createImageData(g.ancho, g.alto);
  for (let i = 0; i < g.datos.length; i++) d.data.set([g.datos[i], g.datos[i], g.datos[i], 255], i * 4);
  ctx.putImageData(d, 0, 0);
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function leerTexto(g: Gris): Promise<{ texto: string; dudas: Duda[]; confianza: number }> {
  const tsv = await invoke<string>("core_addon_run_file", { id: "pdfcheck", args: ["{input}", "stdout", "-l", "spa+eng", "--psm", "7", "tsv"], data: bytesToBase64(await pngDe(g)), extension: "png" });
  return textoDeTsv(tsv);
}

/** Bloques de fórmula del resultado (para revisar llaves y comandos). */
function avisosDe(texto: string): Aviso[] {
  const out: Aviso[] = [];
  for (const m of texto.matchAll(/\\\[\n?([\s\S]*?)\n?\\\]|\$\$\n?([\s\S]*?)\n?\$\$/g)) {
    const cuerpo = m[1] ?? m[2] ?? "";
    const base = m.index! + m[0].indexOf(cuerpo);
    for (const a of revisarFormula(cuerpo)) out.push({ ...a, ini: a.ini + base, fin: a.fin + base });
  }
  return out;
}

export const DesdeFoto: React.FC<Props> = ({ modo, onInsertar, onCerrar }) => {
  const [foto, setFoto] = useState<{ gris: Gris; url: string } | null>(null);
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [herramientas, setHerramientas] = useState<{ ocr: boolean; tesseract: boolean } | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [dudas, setDudas] = useState<Duda[]>([]);
  const [activa, setActiva] = useState<number | null>(null);
  const [opciones, setOpciones] = useState<string[]>([]);
  const [editado, setEditado] = useState(false);
  const [dibujo, setDibujo] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const motor = useRef<MotorFormulas | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const idSig = useRef(1);
  const trabajando = useRef(false);

  useEffect(() => {
    void (async () => {
      if (isTauri) {
        try {
          const h = await invoke<{ ocr: boolean; tesseract: boolean }>("doc_herramientas");
          setHerramientas({ ocr: h.ocr, tesseract: h.tesseract });
          return;
        } catch { /* sigue abajo */ }
      }
      setHerramientas({ ocr: await hayModelos(), tesseract: false });
    })();
    return () => motor.current?.cerrar();
  }, []);

  // Pegar una imagen (Ctrl+V)
  useEffect(() => {
    const pegar = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) { e.preventDefault(); void abrir(f); }
    };
    window.addEventListener("paste", pegar);
    return () => window.removeEventListener("paste", pegar);
  });

  const abrir = async (f: Blob) => {
    try {
      const r = await grisDeArchivo(f);
      setFoto(r);
      const cajas = segmentarRenglones(r.gris);
      setRenglones(cajas.map((caja) => ({ id: idSig.current++, caja, tipo: "formula", estado: "pendiente" })));
      setTexto("");
      setDudas([]);
      setEditado(false);
      setEstado(cajas.length ? null : "No se encontraron renglones: dibuja con el ratón un recuadro sobre cada fórmula.");
    } catch {
      setEstado("No se pudo abrir la imagen.");
    }
  };

  const instalarModelos = async () => {
    if (await ensureAddon("latexocr", "CoffeeLatex")) setHerramientas((h) => ({ ocr: true, tesseract: h?.tesseract ?? false }));
  };

  /** Recalcula el resultado a partir de los renglones (si no se editó a mano). */
  const armar = useCallback((lista: Renglon[]) => {
    const lineas: Linea[] = lista
      .filter((r) => r.resultado)
      .sort((a, b) => a.caja.y - b.caja.y)
      .map((r) => ({ tipo: r.tipo, texto: r.resultado!.texto, dudas: r.resultado!.dudas }));
    const res = ensamblar(lineas, modo);
    setTexto(res.texto);
    setDudas(res.dudas);
    setActiva(null);
  }, [modo]);

  const leerRenglon = async (r: Renglon, g: Gris): Promise<Renglon> => {
    const recorte = recortar(g, r.caja.x, r.caja.y, r.caja.ancho, r.caja.alto);
    let tipo = r.tipo;
    if (herramientas?.tesseract && !r.fijo) {
      // Primero como texto: si parece una fórmula, se lee con el reconocedor de fórmulas.
      const t = await leerTexto(recorte);
      if (!pareceFormula(t.texto, t.confianza)) return { ...r, tipo: "texto", estado: "listo", resultado: { texto: t.texto, dudas: t.dudas } };
      tipo = "formula";
    }
    if (tipo === "texto") {
      if (!herramientas?.tesseract) return { ...r, tipo, estado: "error", error: "Para leer texto instala «Revisión del PDF original» (Tesseract)." };
      const t = await leerTexto(recorte);
      return { ...r, tipo, estado: "listo", resultado: { texto: t.texto, dudas: t.dudas } };
    }
    if (!motor.current) motor.current = new MotorFormulas();
    await motor.current.cargar((t) => setEstado(t));
    const f = await motor.current.reconocer(recorte);
    return { ...r, tipo, estado: "listo", resultado: { texto: f.latex, dudas: f.dudas } };
  };

  const reconocer = (solo?: number) => reconocerCon(renglones, solo);

  const reconocerCon = async (base: Renglon[], solo?: number) => {
    if (!foto || trabajando.current) return;
    if (editado && !window.confirm("Volver a reconocer reemplaza los cambios que hiciste en el texto. ¿Seguir?")) return;
    trabajando.current = true;
    let lista = base.map((r) => (solo === undefined || r.id === solo ? { ...r, estado: "pendiente" as const, resultado: undefined } : r));
    if (solo !== undefined) lista = lista.map((r) => (r.id === solo ? { ...r, estado: "leyendo" as const } : r));
    setRenglones(lista);
    try {
      const orden = [...lista].sort((a, b) => a.caja.y - b.caja.y).filter((r) => solo === undefined || r.id === solo);
      for (const [i, r] of orden.entries()) {
        setEstado(`Leyendo el renglón ${i + 1} de ${orden.length}…`);
        lista = lista.map((x) => (x.id === r.id ? { ...x, estado: "leyendo" } : x));
        setRenglones(lista);
        let hecho: Renglon;
        try {
          hecho = await leerRenglon(r, foto.gris);
        } catch (e) {
          hecho = { ...r, estado: "error", error: String((e as Error).message ?? e) };
        }
        lista = lista.map((x) => (x.id === r.id ? hecho : x));
        setRenglones(lista);
        armar(lista);
      }
      setEditado(false);
      setEstado(null);
    } catch (e) {
      setEstado(String((e as Error).message ?? e));
    } finally {
      trabajando.current = false;
    }
  };

  const cambiarTipo = (id: number) => {
    const antes = renglones.find((r) => r.id === id);
    const lista = renglones.map((r) => (r.id === id ? { ...r, tipo: r.tipo === "texto" ? ("formula" as const) : ("texto" as const), fijo: true } : r));
    setRenglones(lista);
    // Si ya estaba leído, se lee otra vez con el tipo nuevo.
    if (antes?.estado === "listo" || antes?.estado === "error") setTimeout(() => void reconocerCon(lista, id), 0);
  };

  const quitar = (id: number) => {
    const lista = renglones.filter((r) => r.id !== id);
    setRenglones(lista);
    if (!editado) armar(lista);
  };

  // Dibujar un recuadro a mano sobre la foto
  const punto = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    const k = foto!.gris.ancho / r.width;
    return { x: Math.max(0, Math.min(foto!.gris.ancho, (e.clientX - r.left) * k)), y: Math.max(0, Math.min(foto!.gris.alto, (e.clientY - r.top) * k)) };
  };
  const finDibujo = () => {
    if (!dibujo) return;
    const x = Math.round(Math.min(dibujo.x0, dibujo.x1)), y = Math.round(Math.min(dibujo.y0, dibujo.y1));
    const ancho = Math.round(Math.abs(dibujo.x1 - dibujo.x0)), alto = Math.round(Math.abs(dibujo.y1 - dibujo.y0));
    setDibujo(null);
    if (ancho < 12 || alto < 8) return;
    setRenglones((l) => [...l, { id: idSig.current++, caja: { x, y, ancho, alto }, tipo: "formula", fijo: true, estado: "pendiente" }]);
    setEstado(null);
  };

  // ---------- Texto resultante con sus dudas ----------

  const editar = (nuevo: string) => {
    setDudas((d) => ajustarDudas(texto, nuevo, d));
    setTexto(nuevo);
    setEditado(true);
    setActiva(null);
  };

  const avisos = useMemo(() => avisosDe(texto), [texto]);

  const irA = async (i: number) => {
    const d = dudas[i];
    if (!d) return;
    setActiva(i);
    area.current?.focus();
    area.current?.setSelectionRange(d.ini, d.fin);
    const trozo = texto.slice(d.ini, d.fin);
    const enFormula = avisosEnFormula(texto, d.ini);
    let lista = enFormula ? sugerencias(trozo, d.alternativas) : [...d.alternativas];
    if (!enFormula && /^\p{L}+$/u.test(trozo)) {
      try {
        lista = [...lista, ...(await ortografia.suggest(trozo))].filter((s, j, l) => l.indexOf(s) === j && s !== trozo);
      } catch { /* sin diccionario */ }
    }
    setOpciones(lista.slice(0, 8));
  };

  const aplicar = (s: string) => {
    if (activa === null) return;
    const d = dudas[activa];
    const nuevo = texto.slice(0, d.ini) + s + texto.slice(d.fin);
    const resto = dudas.filter((_, j) => j !== activa);
    setDudas(ajustarDudas(texto, nuevo, resto));
    setTexto(nuevo);
    setEditado(true);
    setActiva(null);
    setOpciones([]);
  };

  const ignorar = () => {
    if (activa === null) return;
    setDudas((d) => d.filter((_, j) => j !== activa));
    setActiva(null);
    setOpciones([]);
  };

  const siguiente = () => {
    if (!dudas.length) return;
    const cursor = area.current?.selectionEnd ?? 0;
    const orden = dudas.map((d, i) => ({ d, i })).sort((a, b) => a.d.ini - b.d.ini);
    const sig = orden.find((x) => x.d.ini >= cursor && x.i !== activa) ?? orden[0];
    void irA(sig.i);
  };

  // Capa con las dudas (amarillo) y los avisos (naranja) bajo el textarea
  const marcas = useMemo(() => {
    const todas = [
      ...dudas.map((d, i) => ({ ini: d.ini, fin: d.fin, clase: i === activa ? "duda activa" : "duda" })),
      ...avisos.map((a) => ({ ini: a.ini, fin: a.fin, clase: "aviso" })),
    ].sort((a, b) => a.ini - b.ini);
    const out: React.ReactNode[] = [];
    let i = 0;
    for (const [k, m] of todas.entries()) {
      if (m.ini < i) continue;
      out.push(texto.slice(i, m.ini));
      out.push(<mark key={k} className={m.clase}>{texto.slice(m.ini, m.fin)}</mark>);
      i = m.fin;
    }
    out.push(texto.slice(i) + "\n");
    return out;
  }, [texto, dudas, avisos, activa]);

  const vista = useMemo(() => {
    if (!texto.trim()) return "";
    const doc = modo === "latex" ? latexToHtml(texto).html : markdownToHtml(texto);
    return doc;
  }, [texto, modo]);

  const pendientes = renglones.filter((r) => r.estado === "pendiente").length;
  const leyendo = renglones.some((r) => r.estado === "leyendo");

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f3f7f8] dark:bg-[#11171a] text-[#14323a] dark:text-[#d6e1e4]" role="dialog" aria-label="Desde foto" data-testid="desde-foto">
      <style>{`
.foto-texto{font-family:'JetBrains Mono',Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;margin:0;box-sizing:border-box}
.foto-capa{color:transparent;pointer-events:none}
.foto-capa mark{color:transparent;border-radius:2px}
.foto-capa mark.duda{background:#ffe58f}
.foto-capa mark.duda.activa{background:#ffc53d;box-shadow:0 0 0 2px #fa8c16}
.foto-capa mark.aviso{background:transparent;text-decoration:underline wavy #fa541c;text-decoration-thickness:1.5px}
:root[data-theme="dark"] .foto-capa mark.duda{background:#6b5310}
:root[data-theme="dark"] .foto-capa mark.duda.activa{background:#8f6b0b}
`}</style>
      <header className="h-11 shrink-0 bg-[#0d5e6f] text-white flex items-center gap-3 px-3">
        <Camera size={17} />
        <span className="font-semibold text-[14px]">Desde foto</span>
        <span className="text-[12px] opacity-80 hidden md:inline">Fotos de tus apuntes → {modo === "latex" ? "LaTeX" : "Markdown"} editable</span>
        <div className="ml-auto flex items-center gap-2">
          {foto && (
            <button type="button" onClick={() => input.current?.click()} className="h-7 px-2.5 rounded-md text-[12.5px] hover:bg-white/15 flex items-center gap-1.5"><ImagePlus size={14} /> Otra foto</button>
          )}
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="w-8 h-8 rounded-md hover:bg-white/15 flex items-center justify-center"><X size={16} /></button>
        </div>
      </header>
      <input ref={input} type="file" accept="image/*" className="hidden" data-testid="foto-archivo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void abrir(f); }} />

      {herramientas && !herramientas.ocr && (
        <div className="shrink-0 px-4 py-2.5 bg-[#fff7e6] dark:bg-[#2b2111] border-b border-[#ffd591] dark:border-[#594214] text-[13px] flex items-center gap-3">
          <AlertTriangle size={15} className="text-[#d46b08] shrink-0" />
          <span>Para leer fórmulas hace falta el complemento <b>«Fórmulas desde foto»</b> (~165 MB, se descarga una vez y funciona sin internet).</span>
          <button type="button" onClick={() => void instalarModelos()} className="ml-auto h-7 px-3 rounded-md bg-[#0d5e6f] text-white text-[12.5px] font-semibold shrink-0">Instalar</button>
        </div>
      )}

      {!foto ? (
        <div
          className="flex-1 flex items-center justify-center p-8"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/")); if (f) void abrir(f); }}
        >
          <button type="button" onClick={() => input.current?.click()} className="w-[520px] max-w-full rounded-2xl border-2 border-dashed border-[#a9c4cb] dark:border-[#2f4249] bg-white dark:bg-[#172024] p-10 text-center hover:border-[#0d5e6f]">
            <ImagePlus size={40} className="mx-auto text-[#0d5e6f] mb-3" />
            <div className="font-semibold text-[16px]">Elige o arrastra la foto de tus apuntes</div>
            <div className="text-[13px] text-[#5c7178] mt-1.5">También puedes pegarla con Ctrl+V. Funciona mejor con buena luz, la hoja derecha y letra clara; una fórmula por renglón.</div>
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-2">
          {/* Foto con los renglones */}
          <div className="min-h-0 flex flex-col border-r border-[#d5e0e3] dark:border-[#263236]">
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 text-[12.5px] border-b border-[#dbe5e8] dark:border-[#263236] bg-white dark:bg-[#151c1f]">
              <span className="text-[#5c7178]">{renglones.length} renglones · clic en la etiqueta para cambiar Texto/Fórmula · arrastra para marcar una zona</span>
              <button type="button" disabled={!renglones.length || leyendo || !herramientas?.ocr} onClick={() => void reconocer()} className="ml-auto h-8 px-3.5 rounded-md bg-[#0d5e6f] disabled:opacity-50 text-white font-semibold flex items-center gap-1.5" data-testid="reconocer">
                {leyendo ? <Loader2 size={14} className="animate-spin" /> : <Sigma size={14} />} {texto ? "Volver a reconocer" : "Reconocer"}
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 bg-[#e6edef] dark:bg-[#0d1214]">
              <div className="relative inline-block select-none touch-none" onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const p = punto(e); setDibujo({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }} onPointerMove={(e) => dibujo && setDibujo({ ...dibujo, x1: punto(e).x, y1: punto(e).y })} onPointerUp={finDibujo}>
                <img ref={imgRef} src={foto.url} alt="Foto de los apuntes" className="max-w-full block shadow" draggable={false} />
                {renglones.map((r) => {
                  const k = 100 / foto.gris.ancho, kv = 100 / foto.gris.alto;
                  const color = r.estado === "error" ? "#cf1322" : r.tipo === "formula" ? "#9b3d8a" : "#0d5e6f";
                  return (
                    <div key={r.id} className="absolute border-2 rounded-sm" style={{ left: `${r.caja.x * k}%`, top: `${r.caja.y * kv}%`, width: `${r.caja.ancho * k}%`, height: `${r.caja.alto * kv}%`, borderColor: color, background: r.estado === "leyendo" ? "rgba(250,173,20,.18)" : "transparent" }} data-renglon={r.tipo}>
                      <div className="absolute -top-[22px] left-0 flex gap-0.5">
                        <button type="button" title="Cambiar entre texto y fórmula" onClick={() => cambiarTipo(r.id)} className="h-5 px-1.5 rounded text-[10.5px] font-bold text-white flex items-center gap-1" style={{ background: color }}>
                          {r.estado === "leyendo" ? <Loader2 size={10} className="animate-spin" /> : r.estado === "listo" ? <Check size={10} /> : r.tipo === "formula" ? <Sigma size={10} /> : <Type size={10} />}
                          {r.tipo === "formula" ? "Fórmula" : "Texto"}
                        </button>
                        <button type="button" aria-label="Quitar renglón" onClick={() => quitar(r.id)} className="h-5 w-5 rounded text-white flex items-center justify-center" style={{ background: color }}><X size={10} /></button>
                      </div>
                      {r.error && <div className="absolute left-0 top-full mt-0.5 text-[10.5px] bg-[#cf1322] text-white px-1.5 rounded max-w-[260px]">{r.error}</div>}
                    </div>
                  );
                })}
                {dibujo && (
                  <div className="absolute border-2 border-dashed border-[#fa8c16]" style={{ left: `${(Math.min(dibujo.x0, dibujo.x1) / foto.gris.ancho) * 100}%`, top: `${(Math.min(dibujo.y0, dibujo.y1) / foto.gris.alto) * 100}%`, width: `${(Math.abs(dibujo.x1 - dibujo.x0) / foto.gris.ancho) * 100}%`, height: `${(Math.abs(dibujo.y1 - dibujo.y0) / foto.gris.alto) * 100}%` }} />
                )}
              </div>
            </div>
          </div>

          {/* Resultado editable, dudas y vista previa */}
          <div className="min-h-0 flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 text-[12.5px] border-b border-[#dbe5e8] dark:border-[#263236] bg-white dark:bg-[#151c1f]">
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#ffe58f]" /> {dudas.length} {dudas.length === 1 ? "duda" : "dudas"}</span>
              {avisos.length > 0 && <span className="text-[#d4380d]">· {avisos.length} {avisos.length === 1 ? "aviso" : "avisos"}</span>}
              <button type="button" disabled={!dudas.length} onClick={siguiente} className="ml-auto h-7 px-2.5 rounded-md border border-[#c9dade] dark:border-[#2f4148] disabled:opacity-40 flex items-center gap-1" data-testid="siguiente-duda">Siguiente duda <ArrowRight size={13} /></button>
            </div>
            <div className="relative flex-[3] min-h-0 overflow-auto bg-white dark:bg-[#151c1f]">
              <div className="relative min-h-full">
                <div ref={capa} className="foto-texto foto-capa" aria-hidden>{marcas}</div>
                <textarea ref={area} value={texto} onChange={(e) => editar(e.target.value)} spellCheck={false} placeholder={pendientes ? "Pulsa «Reconocer» para leer la foto." : ""} aria-label="Resultado reconocido" className="foto-texto absolute inset-0 w-full h-full resize-none bg-transparent outline-none text-inherit" />
              </div>
            </div>
            {activa !== null && dudas[activa] && (
              <div className="shrink-0 border-t border-[#ffd591] bg-[#fffbe6] dark:bg-[#2b2111] px-3 py-2 text-[12.5px]" data-testid="sugerencias">
                <div className="flex items-center gap-2 mb-1.5">
                  <span>¿«<b className="font-mono">{texto.slice(dudas[activa].ini, dudas[activa].fin)}</b>»? Confianza {Math.round(dudas[activa].prob * 100)} %</span>
                  <button type="button" onClick={ignorar} className="ml-auto underline">Está bien así</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opciones.length ? opciones.map((s) => (
                    <button key={s} type="button" onClick={() => aplicar(s)} className="h-7 px-2 rounded-md bg-white dark:bg-[#1b2427] border border-[#ffd591] font-mono hover:border-[#fa8c16]" data-sugerencia={s}>{s || "(quitar)"}</button>
                  )) : <span className="text-[#8c8c8c]">Sin sugerencias: corrígelo en el texto.</span>}
                </div>
              </div>
            )}
            {avisos.length > 0 && (
              <div className="shrink-0 max-h-20 overflow-auto border-t border-[#ffbb96] bg-[#fff2e8] dark:bg-[#2b1611] px-3 py-1.5 text-[12px]">
                {avisos.map((a, i) => (
                  <button key={i} type="button" onClick={() => { area.current?.focus(); area.current?.setSelectionRange(a.ini, a.fin); }} className="block hover:underline text-left">{a.mensaje}</button>
                ))}
              </div>
            )}
            <div className="flex-[2] min-h-0 overflow-auto border-t border-[#dbe5e8] dark:border-[#263236] bg-[#e3eaec] dark:bg-[#0c1113] p-3">
              <div className="hoja bg-white rounded shadow-sm p-4 min-h-full text-[#111]" data-testid="foto-vista" dangerouslySetInnerHTML={{ __html: vista || '<p style="color:#8b979c">Aquí se verá el resultado.</p>' }} />
            </div>
            <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-[#dbe5e8] dark:border-[#263236] bg-white dark:bg-[#151c1f]">
              {estado && <span className="text-[12.5px] text-[#0d5e6f] flex items-center gap-1.5">{leyendo && <Loader2 size={13} className="animate-spin" />}{estado}</span>}
              <button type="button" onClick={() => void reconocer()} disabled={!texto || leyendo} className="h-8 px-3 rounded-md border border-[#c9dade] dark:border-[#2f4148] text-[13px] disabled:opacity-40 flex items-center gap-1.5 ml-auto" title="Leer otra vez todos los renglones"><RotateCw size={13} /> Leer otra vez</button>
              <button type="button" disabled={!texto.trim()} onClick={() => onInsertar(texto)} className="h-8 px-4 rounded-md bg-[#0d5e6f] disabled:opacity-50 text-white text-[13px] font-semibold">Insertar en el documento</button>
            </div>
          </div>
        </div>
      )}
      {!foto && estado && <div className="px-4 pb-4 text-center text-[13px] text-[#d4380d]">{estado}</div>}
    </div>
  );
};

/** Si una posición del resultado cae dentro de un bloque de fórmula. */
function avisosEnFormula(texto: string, pos: number): boolean {
  for (const m of texto.matchAll(/\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g)) if (pos >= m.index! && pos < m.index! + m[0].length) return true;
  return false;
}
