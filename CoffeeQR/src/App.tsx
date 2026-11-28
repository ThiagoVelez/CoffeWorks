// CoffeeQR: códigos QR llamativos (formas, colores, adornos, marco) que se siguen leyendo, con
// semáforo de lectura y descargas PNG con o sin fondo, SVG, PDF y hoja de stickers.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileImage, FileType2, Image as ImageIcon, LayoutGrid, Redo2, Sparkles, Stamp, Undo2, Upload, X } from "lucide-react";
import { ACENTO, docNuevo, store, type DocQR } from "./documento";
import { aTexto, consejoEnlace, TIPOS, vacio, type Contenido, type TipoContenido } from "./qr/contenido";
import { CENTROS_POR_MARCO, centroValido, colorDe, dibujarSvg, FORMAS, OJOS_CENTRO, OJOS_MARCO, type Diseno, type Dibujo, type Relleno } from "./qr/dibujo";
import { TEMAS } from "./qr/adornos";
import { PLANTILLAS, type Plantilla } from "./qr/plantillas";
import { evaluar, type Evaluacion } from "./qr/lectura";
import { aPng, logoDesdeArchivo, probarLectura } from "./qr/navegador";
import { cabenEnA4, hojaStickers, nombreArchivo, pdfQr } from "./qr/exportar";
import { useStudioDoc } from "./studio/useStudioDoc";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { DialogHost, askConfirm, showMessage, toast } from "./studio/Dialogs";
import { appWindow, saveFileAs } from "./studio/desktop";
import { ThemeSwitch } from "./theme/ThemeSwitch";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
const PESTANAS = ["Contenido", "Estilo", "Colores", "Adornos", "Marco"] as const;
type Pestana = (typeof PESTANAS)[number];
const TAMANOS_PX = [512, 1024, 2048, 4096];

export const App: React.FC = () => {
  const sd = useStudioDoc<DocQR>(store, { appName: "CoffeeQR", autosaveMs: 1000 });
  const doc = sd.doc;
  const [pestana, setPestana] = useState<Pestana>("Contenido");
  const [verPlantillas, setVerPlantillas] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    void appWindow.setTitle(doc && !sd.showStart ? `${sd.title} — CoffeeQR` : "CoffeeQR");
  }, [sd.title, doc, sd.showStart]);

  const cambiar = (p: Partial<DocQR>, clave = "") => doc && sd.apply({ ...doc, ...p }, clave);
  const disenar = (p: Partial<Diseno>, clave = "") => doc && cambiar({ diseno: { ...doc.diseno, ...p } }, clave);

  const texto = doc ? aTexto(doc.contenido) : "";
  const dibujo = useMemo<{ d: Dibujo | null; error: string | null }>(() => {
    if (!doc || !texto) return { d: null, error: null };
    try {
      return { d: dibujarSvg(texto, doc.diseno), error: null };
    } catch (e) {
      return { d: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [doc, texto]);

  // Semáforo: tras cada cambio (con una pausa corta), se lee el QR dibujado como lo haría un celular.
  const [semaforo, setSemaforo] = useState<Evaluacion | null>(null);
  const turno = useRef(0);
  useEffect(() => {
    setSemaforo(null);
    if (!dibujo.d || !doc) return;
    const mio = ++turno.current;
    const t = window.setTimeout(() => {
      void probarLectura(dibujo.d!, texto).then((l) => {
        if (mio === turno.current) setSemaforo(evaluar(l, doc.diseno));
      }).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(t);
  }, [dibujo.d, texto]); // eslint-disable-line react-hooks/exhaustive-deps

  const usarPlantilla = (p: Plantilla) => {
    setVerPlantillas(false);
    if (doc && !sd.showStart) {
      // Sobre el QR abierto: cambia el diseño y conserva lo que ya lleva si es del mismo tipo.
      cambiar({ diseno: { ...p.diseno, marco: { ...p.diseno.marco } }, contenido: aTexto(doc.contenido) ? doc.contenido : p.contenido });
      toast(`Plantilla «${p.nombre}» aplicada`);
    } else void sd.newDocument(p.id === "simple" ? undefined : p.nombre, docNuevo(p.contenido, p.diseno));
  };

  // ---------- Descargas ----------

  const nombre = sd.title || "codigo-qr";
  const antesDeDescargar = async () => {
    if (!dibujo.d) {
      await showMessage("Aún no hay QR", dibujo.error ?? "Escribe primero lo que llevará el código.");
      return false;
    }
    if (semaforo?.nivel === "rojo") {
      return askConfirm({ title: "Este QR puede no leerse", message: `${semaforo.motivos.join("\n")}\n\n¿Descargarlo de todos modos?`, confirmLabel: "Descargar igual", danger: true });
    }
    return true;
  };
  const trabajo = async (etiqueta: string, f: () => Promise<void>) => {
    if (!(await antesDeDescargar())) return;
    setOcupado(etiqueta);
    try {
      await f();
    } catch (e) {
      await showMessage("No se pudo descargar", e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };
  const guardar = async (datos: Uint8Array | string, ext: string, tipo: string) => {
    const ruta = await saveFileAs(nombreArchivo(nombre, ext), [{ name: tipo, extensions: [ext] }], datos, `Guardar ${tipo}`);
    if (ruta !== null) toast(`${tipo} listo`);
  };
  const dibujoSinFondo = () => dibujarSvg(texto, { ...doc!.diseno, fondo: null });
  const pngConFondo = () => (doc!.diseno.fondo ? dibujo.d! : dibujarSvg(texto, { ...doc!.diseno, fondo: "#ffffff" }));

  const descargarPng = (conFondo: boolean) => trabajo("Creando el PNG…", async () => {
    await guardar(await aPng(conFondo ? pngConFondo() : dibujoSinFondo(), doc!.descarga.px), "png", conFondo ? "PNG" : "PNG sin fondo");
  });
  const descargarSvg = () => trabajo("Creando el SVG…", async () => guardar(dibujo.d!.svg, "svg", "SVG"));
  const descargarPdf = () => trabajo("Creando el PDF…", async () => guardar(await pdfQr(await aPng(pngConFondo(), 2048), doc!.descarga.cm), "pdf", "PDF"));
  const descargarStickers = () => trabajo("Creando la hoja de stickers…", async () => {
    const { columnas } = cabenEnA4(doc!.descarga.cm, doc!.descarga.margenMm);
    if (!columnas) throw new Error(`Un QR de ${doc!.descarga.cm} cm no cabe en una hoja A4.`);
    await guardar(await hojaStickers(await aPng(pngConFondo(), 1024), doc!.descarga.cm, doc!.descarga.margenMm), "pdf", "Hoja de stickers");
  });

  const menus: MenuDefinition[] = doc
    ? [
        {
          id: "archivo",
          label: "Archivo",
          items: [
            { label: "Nuevo QR…", icon: LayoutGrid, action: () => setVerPlantillas(true), shortcut: "Ctrl+N" },
            { label: "Abrir…", action: () => void sd.open(), shortcut: "Ctrl+O" },
            { label: "Guardar como…", action: () => void sd.saveAs() },
            { divider: true },
            { label: "Descargar PNG", icon: FileImage, action: () => void descargarPng(true) },
            { label: "Descargar PNG sin fondo", action: () => void descargarPng(false) },
            { label: "Descargar SVG", action: () => void descargarSvg() },
            { label: "Descargar PDF", icon: FileType2, action: () => void descargarPdf() },
            { label: "Hoja de stickers (PDF)", icon: Stamp, action: () => void descargarStickers() },
          ],
        },
        {
          id: "editar",
          label: "Editar",
          items: [
            { label: "Deshacer", icon: Undo2, action: sd.undo, shortcut: "Ctrl+Z", disabled: !sd.canUndo },
            { label: "Rehacer", icon: Redo2, action: sd.redo, shortcut: "Ctrl+Y", disabled: !sd.canRedo },
            { divider: true },
            { label: "Plantillas por negocio…", icon: Sparkles, action: () => setVerPlantillas(true) },
          ],
        },
      ]
    : [];

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || sd.showStart) return;
      const k = e.key.toLowerCase();
      const enCampo = (e.target as HTMLElement)?.matches?.("input, textarea");
      if (k === "z" && !enCampo) { e.preventDefault(); e.shiftKey ? sd.redo() : sd.undo(); }
      else if (k === "y" && !enCampo) { e.preventDefault(); sd.redo(); }
      else if (k === "n") { e.preventDefault(); setVerPlantillas(true); }
      else if (k === "o") { e.preventDefault(); void sd.open(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [sd]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f7f6fb] text-[#24213a]" data-app="coffeeqr">
      {doc && (
        <>
          <SuiteHeader
            logo={<img src="/app-icon.png" alt="" className="w-8 h-8" />}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Mi código QR"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <div className="flex items-center gap-1.5">
                <ThemeSwitch compact />
                <button type="button" onClick={() => setVerPlantillas(true)} className="h-7 px-2.5 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 hover:bg-white/15">
                  <Sparkles size={14} /> Plantillas
                </button>
                <button type="button" onClick={() => void descargarPng(true)} className="h-7 px-3 rounded-md bg-white text-[#5f3dc4] text-[12.5px] font-bold flex items-center gap-1.5 hover:bg-[#f0ebff]">
                  <Download size={14} /> PNG
                </button>
              </div>
            }
          />
          <div className="flex-1 min-h-0 flex">
            <aside className="w-[340px] shrink-0 border-r border-[#e3dff0] bg-white flex flex-col" data-testid="panel">
              <nav className="flex border-b border-[#e3dff0] px-2 pt-2 gap-1 shrink-0">
                {PESTANAS.map((p) => (
                  <button key={p} type="button" onClick={() => setPestana(p)} className={cx("px-2.5 py-1.5 text-[12.5px] font-semibold rounded-t-md border-b-2 -mb-px", pestana === p ? "border-[#5f3dc4] text-[#5f3dc4]" : "border-transparent text-[#6c6788] hover:text-[#24213a]")}>
                    {p}
                  </button>
                ))}
              </nav>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[13px]">
                {pestana === "Contenido" && <PanelContenido c={doc.contenido} onCambio={(c) => cambiar({ contenido: c }, "contenido")} />}
                {pestana === "Estilo" && <PanelEstilo d={doc.diseno} onCambio={disenar} />}
                {pestana === "Colores" && <PanelColores d={doc.diseno} onCambio={disenar} />}
                {pestana === "Adornos" && <PanelAdornos d={doc.diseno} onCambio={disenar} />}
                {pestana === "Marco" && <PanelMarco d={doc.diseno} onCambio={disenar} />}
              </div>
            </aside>

            <main className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4 p-6 overflow-auto" data-testid="vista">
              {dibujo.d ? (
                <div
                  data-paper
                  data-testid="qr"
                  className={cx("rounded-2xl shadow-lg p-5", doc.diseno.fondo ? "bg-white" : "cuadros")}
                  style={{ width: "min(62vh, 100%)", maxWidth: 520 }}
                  dangerouslySetInnerHTML={{ __html: dibujo.d.svg.replace(/ width="[^"]*" height="[^"]*"/, ' width="100%"') }}
                />
              ) : (
                <div className="w-[min(62vh,100%)] max-w-[520px] aspect-square rounded-2xl border-2 border-dashed border-[#cfc8ea] flex items-center justify-center text-center p-8 text-[#6c6788]" data-testid="sin-qr">
                  {dibujo.error ?? "Escribe en «Contenido» lo que llevará tu QR: un enlace, tu Wi-Fi, tu contacto…"}
                </div>
              )}
              <Semaforo ev={dibujo.d ? semaforo : null} />
            </main>

            <aside className="w-[260px] shrink-0 border-l border-[#e3dff0] bg-white p-4 flex flex-col gap-4 text-[13px] overflow-y-auto" data-testid="descargas">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-[#6c6788]">Descargar</h2>
              <Campo etiqueta="Tamaño del PNG">
                <select value={doc.descarga.px} onChange={(e) => cambiar({ descarga: { ...doc.descarga, px: Number(e.target.value) } })} className="campo">
                  {TAMANOS_PX.map((px) => <option key={px} value={px}>{px} × {px} px</option>)}
                </select>
              </Campo>
              <Boton primario onClick={() => void descargarPng(true)} icono={<FileImage size={15} />}>PNG con fondo</Boton>
              <Boton onClick={() => void descargarPng(false)} icono={<ImageIcon size={15} />}>PNG sin fondo</Boton>
              <Boton onClick={() => void descargarSvg()} icono={<FileType2 size={15} />}>SVG (para imprenta)</Boton>
              <hr className="border-[#eeeaf7]" />
              <Campo etiqueta={`Tamaño impreso: ${doc.descarga.cm} cm`}>
                <input type="range" min={2} max={18} step={0.5} value={doc.descarga.cm} onChange={(e) => cambiar({ descarga: { ...doc.descarga, cm: Number(e.target.value) } }, "cm")} />
              </Campo>
              <Boton onClick={() => void descargarPdf()} icono={<FileType2 size={15} />}>PDF para imprimir</Boton>
              <Boton onClick={() => void descargarStickers()} icono={<Stamp size={15} />}>Hoja de stickers</Boton>
              <p className="text-[11.5px] text-[#6c6788] -mt-2">
                {(() => {
                  const { columnas, filas } = cabenEnA4(doc.descarga.cm, doc.descarga.margenMm);
                  return columnas ? `${columnas * filas} stickers por hoja A4 (${columnas} × ${filas}).` : "A ese tamaño no cabe en una hoja A4.";
                })()}
              </p>
              {ocupado && <p className="text-[#5f3dc4] font-semibold">{ocupado}</p>}
            </aside>
          </div>
        </>
      )}

      {verPlantillas && <Plantillas onElegir={usarPlantilla} onCerrar={() => setVerPlantillas(false)} />}
      {sd.showStart && (
        <StartScreen
          appName="CoffeeQR"
          tagline="Códigos QR llamativos que se leen • CoffeeWorks"
          accent={ACENTO}
          newHint="Elige una plantilla para tu negocio"
          openHint="Abrir un QR .cqr"
          formats={[".cqr", "PNG", "SVG", "PDF"]}
          recents={sd.recents}
          onNew={() => setVerPlantillas(true)}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={doc ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <style>{CSS}</style>
      <DialogHost />
    </div>
  );
};

const CSS = `
.campo { width: 100%; height: 32px; border: 1px solid #d9d4ea; border-radius: 8px; padding: 0 10px; background: #fff; font-size: 13px; }
textarea.campo { height: auto; padding: 8px 10px; resize: vertical; }
.campo:focus { outline: 2px solid #5f3dc433; border-color: #5f3dc4; }
.cuadros { background-color: #fff; background-image: linear-gradient(45deg, #ece9f5 25%, transparent 25%), linear-gradient(-45deg, #ece9f5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ece9f5 75%), linear-gradient(-45deg, transparent 75%, #ece9f5 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0; }
[data-testid="qr"] svg { display: block; }
`;

// ---------- Piezas pequeñas ----------

/** Campo con su etiqueta. Con `grupo` (botones, no un control) no se usa <label>: daría su nombre a cada botón. */
const Campo: React.FC<{ etiqueta: string; children: React.ReactNode; ayuda?: string; grupo?: boolean }> = ({ etiqueta, children, ayuda, grupo }) => {
  const Tag = grupo ? "div" : "label";
  return (
    <Tag className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[#4a4566]">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-[11.5px] text-[#6c6788]">{ayuda}</span>}
    </Tag>
  );
};

const Boton: React.FC<{ onClick: () => void; children: React.ReactNode; icono?: React.ReactNode; primario?: boolean }> = ({ onClick, children, icono, primario }) => (
  <button type="button" onClick={onClick} className={cx("h-9 rounded-lg px-3 flex items-center gap-2 font-semibold text-[13px] border", primario ? "bg-[#5f3dc4] text-white border-[#5f3dc4] hover:bg-[#4c2fa3]" : "bg-white text-[#3b3561] border-[#d9d4ea] hover:border-[#5f3dc4] hover:text-[#5f3dc4]")}>
    {icono}
    {children}
  </button>
);

function Opciones<T extends string>({ valor, opciones, onCambio, nombre }: { valor: T; opciones: { id: T; nombre: string }[]; onCambio: (v: T) => void; nombre: string }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} onClick={() => onCambio(o.id)} className={cx("min-h-8 px-2 py-1 rounded-lg border text-[12px] font-medium leading-tight", valor === o.id ? "border-[#5f3dc4] bg-[#f0ebff] text-[#5f3dc4]" : "border-[#e3dff0] hover:border-[#bdb3e6]")}>
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

const Color: React.FC<{ etiqueta: string; valor: string; onCambio: (v: string) => void }> = ({ etiqueta, valor, onCambio }) => (
  <label className="flex items-center gap-2">
    <input type="color" value={valor} onChange={(e) => onCambio(e.target.value)} aria-label={etiqueta} className="w-9 h-9 rounded-lg border border-[#d9d4ea] p-0.5 bg-white cursor-pointer" />
    <span className="text-[12.5px]">{etiqueta}</span>
    <input value={valor} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && onCambio(e.target.value)} className="campo !w-24 !h-8 font-mono text-[12px] ml-auto" aria-label={`${etiqueta} (hex)`} />
  </label>
);

const Interruptor: React.FC<{ valor: boolean; onCambio: (v: boolean) => void; etiqueta: string }> = ({ valor, onCambio, etiqueta }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={valor} onChange={(e) => onCambio(e.target.checked)} className="w-4 h-4 accent-[#5f3dc4]" />
    <span>{etiqueta}</span>
  </label>
);

const Semaforo: React.FC<{ ev: Evaluacion | null }> = ({ ev }) => {
  if (!ev) return <div className="h-9 text-[12.5px] text-[#6c6788]" data-testid="semaforo" data-nivel="">Comprobando la lectura…</div>;
  const estilo = { verde: ["#2b8a3e", "#ebfbee", "Se lee bien"], amarillo: ["#b35c00", "#fff4e6", "Se lee, con cuidado"], rojo: ["#c92a2a", "#fff5f5", "Puede no leerse"] }[ev.nivel];
  return (
    <div className="max-w-[520px] w-full rounded-xl px-4 py-2.5 text-[12.5px] border" style={{ color: estilo[0], background: estilo[1], borderColor: `${estilo[0]}40` }} data-testid="semaforo" data-nivel={ev.nivel}>
      <div className="flex items-center gap-2 font-bold">
        <span className="flex gap-1">
          {(["rojo", "amarillo", "verde"] as const).map((n) => (
            <span key={n} className="w-3 h-3 rounded-full" style={{ background: n === ev.nivel ? estilo[0] : "#d6d3df" }} />
          ))}
        </span>
        {estilo[2]}
      </div>
      {ev.motivos.length > 0 && <ul className="mt-1 list-disc pl-5 font-medium">{ev.motivos.map((m) => <li key={m}>{m}</li>)}</ul>}
    </div>
  );
};

// ---------- Paneles ----------

const PanelContenido: React.FC<{ c: Contenido; onCambio: (c: Contenido) => void }> = ({ c, onCambio }) => {
  const set = <K extends string>(k: K, v: unknown) => onCambio({ ...c, [k]: v } as Contenido);
  const txt = (k: string, etiqueta: string, ph = "", ayuda?: string, area = false) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda} key={k}>
      {area ? (
        <textarea rows={4} className="campo" placeholder={ph} value={String((c as unknown as Record<string, unknown>)[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="campo" placeholder={ph} value={String((c as unknown as Record<string, unknown>)[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
      )}
    </Campo>
  );
  const ayuda = TIPOS.find((t) => t.tipo === c.tipo)?.ayuda;
  return (
    <>
      <Campo etiqueta="¿Qué llevará tu QR?" ayuda={ayuda}>
        <select className="campo" value={c.tipo} onChange={(e) => onCambio(vacio(e.target.value as TipoContenido))} aria-label="Tipo de contenido">
          {TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.nombre}</option>)}
        </select>
      </Campo>
      {(c.tipo === "enlace" || c.tipo === "archivo") && (
        <>
          {txt("url", c.tipo === "enlace" ? "Enlace" : "Enlace de la imagen o el PDF", c.tipo === "enlace" ? "mitienda.com" : "https://drive.google.com/file/d/…")}
          {c.tipo === "archivo" && (
            <div className="rounded-lg bg-[#f6f3ff] border border-[#e3dbff] p-3 text-[12px] leading-relaxed text-[#3b3561]">
              Un QR no puede guardar una imagen: lleva el enlace a donde está. Sube tu menú o tu foto a Google Drive, a tu web o a Instagram y pega aquí el enlace.
            </div>
          )}
          {consejoEnlace(c.url) && <p className="text-[12px] text-[#b35c00] font-medium" data-testid="consejo">{consejoEnlace(c.url)}</p>}
        </>
      )}
      {c.tipo === "texto" && txt("texto", "Texto", "Hola…", undefined, true)}
      {c.tipo === "wifi" && (
        <>
          {txt("red", "Nombre de la red (SSID)", "Cafe-Clientes")}
          <Campo etiqueta="Seguridad">
            <select className="campo" value={c.seguridad} onChange={(e) => set("seguridad", e.target.value)}>
              <option value="WPA">WPA/WPA2/WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">Sin clave</option>
            </select>
          </Campo>
          {c.seguridad !== "nopass" && txt("clave", "Clave")}
          <Interruptor valor={c.oculta} onCambio={(v) => set("oculta", v)} etiqueta="Red oculta" />
        </>
      )}
      {c.tipo === "contacto" && (
        <>
          {txt("nombre", "Nombre")}
          {txt("apellido", "Apellido")}
          {txt("telefono", "Teléfono", "+57 300 000 0000")}
          {txt("correo", "Correo")}
          {txt("empresa", "Empresa")}
          {txt("web", "Web")}
          {txt("direccion", "Dirección")}
        </>
      )}
      {c.tipo === "whatsapp" && (<>{txt("numero", "Número con indicativo", "+57 300 000 0000")}{txt("mensaje", "Mensaje ya escrito", "Hola, quiero…", undefined, true)}</>)}
      {c.tipo === "correo" && (<>{txt("correo", "Correo")}{txt("asunto", "Asunto")}{txt("cuerpo", "Mensaje", "", undefined, true)}</>)}
      {c.tipo === "telefono" && txt("numero", "Número", "+57 300 000 0000")}
      {c.tipo === "sms" && (<>{txt("numero", "Número")}{txt("mensaje", "Mensaje", "", undefined, true)}</>)}
      {c.tipo === "ubicacion" && (
        <>
          <Campo etiqueta="Latitud"><input className="campo" type="number" step="any" value={c.lat} onChange={(e) => set("lat", Number(e.target.value))} /></Campo>
          <Campo etiqueta="Longitud" ayuda="En Google Maps: clic derecho en el lugar y copia los números."><input className="campo" type="number" step="any" value={c.lng} onChange={(e) => set("lng", Number(e.target.value))} /></Campo>
        </>
      )}
    </>
  );
};

type Cambio = (p: Partial<Diseno>, clave?: string) => void;

const PanelEstilo: React.FC<{ d: Diseno; onCambio: Cambio }> = ({ d, onCambio }) => {
  const centros = OJOS_CENTRO.filter((o) => o.id in CENTROS_POR_MARCO[d.ojoMarco]);
  return (
    <>
      <Campo grupo etiqueta="Forma de los puntos"><Opciones nombre="Forma de los puntos" valor={d.modulo} opciones={FORMAS} onCambio={(modulo) => onCambio({ modulo })} /></Campo>
      <Campo grupo etiqueta="Esquinas: marco"><Opciones nombre="Esquinas: marco" valor={d.ojoMarco} opciones={OJOS_MARCO} onCambio={(ojoMarco) => onCambio({ ojoMarco, ojoCentro: centroValido(ojoMarco, d.ojoCentro) })} /></Campo>
      <Campo grupo etiqueta="Esquinas: centro" ayuda="Solo se ofrecen los centros que se leen bien con ese marco."><Opciones nombre="Esquinas: centro" valor={centroValido(d.ojoMarco, d.ojoCentro)} opciones={centros} onCambio={(ojoCentro) => onCambio({ ojoCentro })} /></Campo>
      <Campo etiqueta={`Margen: ${d.margen} módulos`} ayuda="El espacio en blanco alrededor ayuda a leerlo (4 es lo recomendado).">
        <input type="range" min={2} max={8} value={d.margen} onChange={(e) => onCambio({ margen: Number(e.target.value) }, "margen")} />
      </Campo>
    </>
  );
};

const PanelColores: React.FC<{ d: Diseno; onCambio: Cambio }> = ({ d, onCambio }) => {
  const tipo = typeof d.color === "string" ? "solido" : d.color.tipo;
  const c1 = colorDe(d.color);
  const c2 = typeof d.color === "string" ? "#1864ab" : d.color.colores[1];
  const relleno = (t: string, a = c1, b = c2): Relleno => (t === "solido" ? a : t === "radial" ? { tipo: "radial", colores: [a, b] } : { tipo: "lineal", colores: [a, b], angulo: typeof d.color !== "string" && d.color.tipo === "lineal" ? d.color.angulo : 45 });
  return (
    <>
      <Campo grupo etiqueta="Color de los puntos">
        <Opciones nombre="Tipo de color" valor={tipo} opciones={[{ id: "solido", nombre: "Un color" }, { id: "lineal", nombre: "Degradado" }, { id: "radial", nombre: "Radial" }]} onCambio={(t) => onCambio({ color: relleno(t) })} />
      </Campo>
      <Color etiqueta={tipo === "solido" ? "Color" : "Color 1"} valor={c1} onCambio={(v) => onCambio({ color: relleno(tipo, v, c2) }, "color")} />
      {tipo !== "solido" && <Color etiqueta="Color 2" valor={c2} onCambio={(v) => onCambio({ color: relleno(tipo, c1, v) }, "color")} />}
      {typeof d.color !== "string" && d.color.tipo === "lineal" && (
        <Campo etiqueta={`Ángulo: ${d.color.angulo}°`}>
          <input type="range" min={0} max={360} step={15} value={d.color.angulo} onChange={(e) => onCambio({ color: { tipo: "lineal", colores: [c1, c2], angulo: Number(e.target.value) } }, "angulo")} />
        </Campo>
      )}
      <Interruptor valor={!!d.colorOjos} onCambio={(v) => onCambio({ colorOjos: v ? c1 : undefined })} etiqueta="Otro color para las esquinas" />
      {d.colorOjos && <Color etiqueta="Esquinas" valor={d.colorOjos} onCambio={(v) => onCambio({ colorOjos: v }, "ojos")} />}
      <hr className="border-[#eeeaf7]" />
      <Interruptor valor={d.fondo !== null} onCambio={(v) => onCambio({ fondo: v ? "#ffffff" : null })} etiqueta="Con fondo" />
      {d.fondo !== null && <Color etiqueta="Fondo" valor={d.fondo} onCambio={(v) => onCambio({ fondo: v }, "fondo")} />}
      <p className="text-[11.5px] text-[#6c6788]">Consejo: puntos oscuros sobre fondo claro. Al revés, muchos celulares no lo leen.</p>
    </>
  );
};

const PanelAdornos: React.FC<{ d: Diseno; onCambio: Cambio }> = ({ d, onCambio }) => {
  const archivo = useRef<HTMLInputElement>(null);
  return (
    <>
      <Campo grupo etiqueta="Tema" ayuda="Dibujos para tu negocio: en el centro y alrededor, sin tapar lo que se lee.">
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => onCambio({ tema: null })} className={cx("h-16 rounded-lg border text-[11.5px]", !d.tema ? "border-[#5f3dc4] bg-[#f0ebff]" : "border-[#e3dff0]")}>Ninguno</button>
          {TEMAS.map((t) => (
            <button key={t.id} type="button" aria-label={t.nombre} onClick={() => onCambio({ tema: t.id, adornoCentro: d.tema ? d.adornoCentro : true, adornoBorde: d.tema ? d.adornoBorde : true, color: d.tema || typeof d.color !== "string" || d.color !== "#000000" ? d.color : t.color })} className={cx("h-16 rounded-lg border flex flex-col items-center justify-center gap-1 text-[11.5px]", d.tema === t.id ? "border-[#5f3dc4] bg-[#f0ebff]" : "border-[#e3dff0] hover:border-[#bdb3e6]")}>
              <svg viewBox="0 0 24 24" width="24" height="24" style={{ color: t.color }} dangerouslySetInnerHTML={{ __html: t.icono }} />
              {t.nombre}
            </button>
          ))}
        </div>
      </Campo>
      {d.tema && (
        <>
          <Interruptor valor={d.adornoCentro} onCambio={(v) => onCambio({ adornoCentro: v })} etiqueta="Dibujo en el centro" />
          <Interruptor valor={d.adornoBorde} onCambio={(v) => onCambio({ adornoBorde: v })} etiqueta="Dibujos alrededor" />
        </>
      )}
      <hr className="border-[#eeeaf7]" />
      <Campo grupo etiqueta="Tu logo en el centro" ayuda="Ocupa como máximo el 15 % del QR para que se siga leyendo.">
        <div className="flex gap-2">
          <button type="button" onClick={() => archivo.current?.click()} className="h-9 px-3 rounded-lg border border-[#d9d4ea] flex items-center gap-2 font-semibold hover:border-[#5f3dc4]"><Upload size={14} /> {d.logo ? "Cambiar logo" : "Elegir imagen"}</button>
          {d.logo && <button type="button" onClick={() => onCambio({ logo: null })} className="h-9 px-3 rounded-lg border border-[#d9d4ea] hover:border-[#c92a2a]" aria-label="Quitar logo"><X size={14} /></button>}
        </div>
        <input ref={archivo} type="file" accept="image/*" hidden data-testid="logo" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void logoDesdeArchivo(f).then((logo) => onCambio({ logo })).catch((err) => void showMessage("Logo", String(err instanceof Error ? err.message : err)));
        }} />
      </Campo>
      {(d.logo || (d.tema && d.adornoCentro)) && (
        <Campo etiqueta={`Tamaño del centro: ${Math.round((d.tamanoCentro ?? 0.3) * 100)} % del lado`}>
          <input type="range" min={0.2} max={0.38} step={0.02} value={d.tamanoCentro ?? 0.3} onChange={(e) => onCambio({ tamanoCentro: Number(e.target.value) }, "centro")} />
        </Campo>
      )}
    </>
  );
};

const TEXTOS_MARCO = ["Escanéame", "Ver el menú", "Wi-Fi gratis", "Síguenos", "Paga aquí", "Guarda mi contacto"];

const PanelMarco: React.FC<{ d: Diseno; onCambio: Cambio }> = ({ d, onCambio }) => (
  <>
    <Campo grupo etiqueta="Estilo"><Opciones nombre="Estilo del marco" valor={d.marco.estilo} opciones={[{ id: "ninguno", nombre: "Sin marco" }, { id: "abajo", nombre: "Marco" }, { id: "burbuja", nombre: "Burbuja" }]} onCambio={(estilo) => onCambio({ marco: { ...d.marco, estilo, texto: d.marco.texto || "Escanéame" } })} /></Campo>
    {d.marco.estilo !== "ninguno" && (
      <>
        <Campo etiqueta="Texto">
          <input className="campo" maxLength={40} value={d.marco.texto} onChange={(e) => onCambio({ marco: { ...d.marco, texto: e.target.value } }, "marco")} />
        </Campo>
        <div className="flex flex-wrap gap-1.5">
          {TEXTOS_MARCO.map((t) => <button key={t} type="button" onClick={() => onCambio({ marco: { ...d.marco, texto: t } })} className="px-2 py-1 rounded-full border border-[#e3dff0] text-[11.5px] hover:border-[#5f3dc4]">{t}</button>)}
        </div>
        <Color etiqueta="Color del marco" valor={d.marco.color} onCambio={(v) => onCambio({ marco: { ...d.marco, color: v } }, "marcoColor")} />
      </>
    )}
  </>
);

const Plantillas: React.FC<{ onElegir: (p: Plantilla) => void; onCerrar: () => void }> = ({ onElegir, onCerrar }) => {
  const vistas = useMemo(() => PLANTILLAS.map((p) => ({ p, svg: dibujarSvg(aTexto(p.contenido) || "https://coffeeworks.app", p.diseno).svg })), []);
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-6" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[920px] max-h-full flex flex-col" role="dialog" aria-label="Plantillas por negocio">
        <header className="flex items-center px-5 py-3 border-b border-[#eeeaf7]">
          <h2 className="font-bold text-[15px]">¿Para qué es tu QR?</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto p-1 rounded hover:bg-[#f0ebff]"><X size={16} /></button>
        </header>
        <div className="overflow-y-auto p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {vistas.map(({ p, svg }) => (
            <button key={p.id} type="button" onClick={() => onElegir(p)} data-plantilla={p.id} className="rounded-xl border border-[#e3dff0] hover:border-[#5f3dc4] hover:shadow-md p-2.5 flex flex-col gap-2 text-left transition">
              <div data-paper className="w-full aspect-square rounded-lg bg-[#faf9fd] flex items-center justify-center p-1.5 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
              <span className="font-semibold text-[12.5px] leading-tight">{p.nombre}</span>
              <span className="text-[11px] text-[#6c6788] leading-snug">{p.descripcion}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
