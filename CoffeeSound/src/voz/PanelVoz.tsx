// Diálogos de la voz en CoffeeSound: «Separar voz y música» y «Sacar la letra».

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Music2, Play } from "lucide-react";
import { Button, Modal, Select } from "../studio/ui";
import { ensureAddon } from "../studio/addons";
import { saveFileAs } from "../studio/desktop";
import { makeBuffer } from "../services/audio";
import { ACCENT } from "../types";
import { aEstereo44, aMono16, deEstereo44 } from "./senal";
import { frases } from "./frases";
import { aLrc, aPalabras, aTxt, esAlucinacion, tiempoCorto, type LineaLetra } from "./letra";
import { IDIOMAS } from "./whisper";
import { Cancelado, complementosVoz, MotorVoz } from "./motor";

const canalesDe = (b: AudioBuffer) => Array.from({ length: b.numberOfChannels }, (_, c) => Float32Array.from(b.getChannelData(c)));
const bufferDe = (canales: Float32Array[], rate: number) => {
  const b = makeBuffer(canales.length, canales[0].length, rate);
  canales.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  return b;
};
const sinExt = (n: string) => n.replace(/\.[^.]+$/, "");

/** Un motor por pestaña: los modelos se cargan una sola vez. */
let motorCompartido: MotorVoz | null = null;
const motor = () => (motorCompartido ??= new MotorVoz());

const Barra: React.FC<{ fraccion: number; texto: string }> = ({ fraccion, texto }) => (
  <div className="flex flex-col gap-1.5" data-testid="progreso-voz">
    <div className="flex items-center gap-2 text-[#c9c9cf]"><Loader2 size={13} className="animate-spin" /> {texto}</div>
    <div className="h-2 rounded-full bg-[#1b1b1f] overflow-hidden"><div className="h-full transition-[width]" style={{ width: `${Math.round(fraccion * 100)}%`, background: ACCENT }} /></div>
  </div>
);

const Falta: React.FC<{ nombre: string; tam: string; onInstalar: () => void }> = ({ nombre, tam, onInstalar }) => (
  <div className="rounded-lg bg-[#3a2c14] border border-[#6b4f1d] p-3 flex flex-col gap-2 text-[#f5d9a8]">
    <div className="flex items-center gap-2"><AlertTriangle size={14} /> Hace falta el complemento <b>«{nombre}»</b> ({tam}). Se descarga una vez y funciona sin internet.</div>
    <Button primary accent={ACCENT} onClick={onInstalar} className="self-start">Instalar</Button>
  </div>
);

/** Separa la canción en voz y música a la frecuencia y canales originales. */
async function separarBuffer(b: AudioBuffer, avance: (f: number) => void, señal: AbortSignal, alCargar: (t: string) => void) {
  const [l, r] = aEstereo44(canalesDe(b), b.sampleRate);
  const { voz, musica } = await motor().separar(l, r, avance, señal, alCargar);
  return {
    voz: bufferDe(deEstereo44(voz[0], voz[1], b.sampleRate, b.numberOfChannels), b.sampleRate),
    musica: bufferDe(deEstereo44(musica[0], musica[1], b.sampleRate, b.numberOfChannels), b.sampleRate),
  };
}

// ---------------------------------------------------------------------------

export const DialogoSeparar: React.FC<{
  buffer: AudioBuffer;
  nombre: string;
  onListo: (voz: AudioBuffer, musica: AudioBuffer, que: "voz" | "musica" | "pistas") => void;
  onCerrar: () => void;
}> = ({ buffer, nombre, onListo, onCerrar }) => {
  const [hay, setHay] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<{ f: number; t: string } | null>(null);
  const [res, setRes] = useState<{ voz: AudioBuffer; musica: AudioBuffer } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const control = useRef<AbortController | null>(null);

  useEffect(() => void complementosVoz().then((c) => setHay(c.separarvoz)), []);
  useEffect(() => () => control.current?.abort(), []);

  const empezar = async () => {
    setError(null);
    const c = new AbortController();
    control.current = c;
    setEstado({ f: 0, t: "Preparando…" });
    try {
      const r = await separarBuffer(buffer, (f) => setEstado({ f, t: `Separando… ${Math.round(f * 100)} %` }), c.signal, (t) => setEstado({ f: 0, t }));
      setRes(r);
    } catch (e) {
      if (!(e instanceof Cancelado)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEstado(null);
      control.current = null;
    }
  };

  const cancelar = () => {
    if (control.current) { control.current.abort(); return; }
    onCerrar();
  };

  return (
    <Modal
      title="Separar voz y música"
      onClose={cancelar}
      width={440}
      footer={
        res ? (
          <>
            <Button onClick={() => onListo(res.voz, res.musica, "musica")}>Abrir la música</Button>
            <Button onClick={() => onListo(res.voz, res.musica, "voz")}>Abrir la voz</Button>
            <Button primary accent={ACCENT} onClick={() => onListo(res.voz, res.musica, "pistas")}>Poner en dos pistas</Button>
          </>
        ) : (
          <>
            <Button onClick={cancelar}>Cancelar</Button>
            <Button primary accent={ACCENT} disabled={!hay || !!estado} onClick={() => void empezar()}>Separar</Button>
          </>
        )
      }
    >
      <p className="text-[#c9c9cf]">Divide «{sinExt(nombre)}» en dos audios nuevos: <b>la voz</b> y <b>la música</b>. El original no cambia. Una canción de 3 minutos tarda unos minutos.</p>
      {hay === false && <Falta nombre="Separar voz y música" tam="~65 MB" onInstalar={() => void ensureAddon("separarvoz", "CoffeeSound").then((ok) => ok && setHay(true))} />}
      {estado && <Barra fraccion={estado.f} texto={estado.t} />}
      {res && <div className="text-[#8ce99a] flex items-center gap-2" data-testid="separado"><Music2 size={14} /> Listo: «{sinExt(nombre)} — Voz» y «{sinExt(nombre)} — Música».</div>}
      {error && <div className="text-[#ff8787]">{error}</div>}
    </Modal>
  );
};

// ---------------------------------------------------------------------------

export const DialogoLetra: React.FC<{
  buffer: AudioBuffer;
  nombre: string;
  /** Si el audio abierto ya es una voz separada. */
  esVoz: boolean;
  onReproducir: (ini: number, fin: number) => void;
  onCerrar: () => void;
}> = ({ buffer, nombre, esVoz, onReproducir, onCerrar }) => {
  const [hay, setHay] = useState<{ separarvoz: boolean; letra: boolean } | null>(null);
  const [idioma, setIdioma] = useState("");
  const [estado, setEstado] = useState<{ f: number; t: string } | null>(null);
  const [lineas, setLineas] = useState<LineaLetra[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const control = useRef<AbortController | null>(null);

  useEffect(() => void complementosVoz().then(setHay), []);
  useEffect(() => () => control.current?.abort(), []);

  const empezar = async () => {
    setError(null);
    setAviso(null);
    const c = new AbortController();
    control.current = c;
    try {
      // 1. La voz: la del archivo si ya está separada; si no, se separa (o se avisa).
      let voz = buffer;
      if (!esVoz) {
        if (hay?.separarvoz) {
          setEstado({ f: 0, t: "Separando la voz…" });
          voz = (await separarBuffer(buffer, (f) => setEstado({ f: f * 0.4, t: `Separando la voz… ${Math.round(f * 100)} %` }), c.signal, (t) => setEstado({ f: 0, t }))).voz;
        } else setAviso("Sin «Separar voz y música» la letra se saca con la música encima y saldrá menos precisa.");
      }
      // 2. Frases y transcripción
      const x16 = aMono16(canalesDe(voz), voz.sampleRate);
      const fr = frases(x16, 16000);
      const base = esVoz || !hay?.separarvoz ? 0 : 0.4;
      const out: LineaLetra[] = [];
      let lang = idioma;
      setLineas([]);
      for (const [i, f] of fr.entries()) {
        if (c.signal.aborted) throw new Cancelado();
        setEstado({ f: base + ((1 - base) * i) / Math.max(1, fr.length), t: `Escuchando la frase ${i + 1} de ${fr.length}…` });
        const trozo = x16.subarray(Math.floor(f.ini * 16000), Math.ceil(f.fin * 16000));
        const t = await motor().transcribir(Float32Array.from(trozo), lang || undefined, c.signal, (txt) => setEstado({ f: base, t: txt }));
        if (!lang && t.idioma) lang = t.idioma; // la primera frase fija el idioma de las demás
        if (esAlucinacion(t.texto, t.probMedia)) continue;
        out.push({ ini: f.ini, fin: f.fin, texto: t.texto, dudas: aPalabras(t.texto, t.dudas) });
        setLineas([...out]);
      }
      if (!fr.length) setAviso("No se oye voz en este audio.");
      if (lang && !idioma) setIdioma(lang);
    } catch (e) {
      if (!(e instanceof Cancelado)) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEstado(null);
      control.current = null;
    }
  };

  const guardar = async (ext: "txt" | "lrc") => {
    if (!lineas) return;
    const texto = ext === "txt" ? aTxt(lineas) : aLrc(lineas, sinExt(nombre).replace(/ — Voz$/, ""));
    await saveFileAs(`${sinExt(nombre).replace(/ — Voz$/, "")} (letra).${ext}`, [{ name: ext === "txt" ? "Texto" : "Letra con tiempos (LRC)", extensions: [ext] }], new TextEncoder().encode(texto), "Guardar la letra");
  };

  const cambiar = (i: number, texto: string) => setLineas((l) => l && l.map((x, j) => (j === i ? { ...x, texto, dudas: [] } : x)));
  const listo = !!lineas && !estado;
  const instalar = async (id: "letra" | "separarvoz") => {
    if (await ensureAddon(id, "CoffeeSound")) setHay((h) => ({ separarvoz: h?.separarvoz ?? false, letra: h?.letra ?? false, [id]: true }));
  };

  return (
    <Modal
      title="Sacar la letra"
      onClose={() => (control.current ? control.current.abort() : onCerrar())}
      width={560}
      footer={
        <>
          <Button onClick={() => (control.current ? control.current.abort() : onCerrar())}>{control.current ? "Cancelar" : "Cerrar"}</Button>
          {listo && lineas!.length > 0 && (
            <>
              <Button onClick={() => void guardar("lrc")}>Guardar .lrc</Button>
              <Button primary accent={ACCENT} onClick={() => void guardar("txt")}>Guardar .txt</Button>
            </>
          )}
          {!lineas && <Button primary accent={ACCENT} disabled={!hay?.letra || !!estado} onClick={() => void empezar()}>Sacar la letra</Button>}
        </>
      }
    >
      {!lineas && (
        <>
          <p className="text-[#c9c9cf]">Escucha {esVoz ? "la voz" : "la canción"} y escribe la letra frase por frase, con su tiempo. {esVoz || !hay?.separarvoz ? "" : "Primero separa la voz de la música para entenderla mejor."}</p>
          <Select value={idioma} onChange={setIdioma} options={IDIOMAS.map((i) => ({ value: i.codigo, label: i.codigo ? i.nombre : "Idioma: detectar" }))} />
        </>
      )}
      {hay && !hay.letra && <Falta nombre="Letra de canciones" tam="~375 MB" onInstalar={() => void instalar("letra")} />}
      {hay && hay.letra && !hay.separarvoz && !esVoz && !lineas && (
        <div className="text-[#c9c9cf] text-[11.5px]">Consejo: con el complemento «Separar voz y música» la letra sale más precisa. <button type="button" className="underline" onClick={() => void instalar("separarvoz")}>Instalarlo</button></div>
      )}
      {estado && <Barra fraccion={estado.f} texto={estado.t} />}
      {aviso && <div className="text-[#ffd8a8]">{aviso}</div>}
      {error && <div className="text-[#ff8787]">{error}</div>}
      {lineas && (
        <div className="flex flex-col gap-1.5" data-testid="letra">
          {lineas.length === 0 && !estado && <div className="text-[#a1a1aa]">No se encontró letra.</div>}
          {lineas.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <button type="button" title="Escuchar esta frase" onClick={() => onReproducir(l.ini, l.fin)} className="h-7 px-1.5 rounded bg-[#34343a] hover:bg-[#404047] text-[11px] font-mono flex items-center gap-1 shrink-0 text-[#c9c9cf]">
                <Play size={10} /> {tiempoCorto(l.ini)}
              </button>
              <div className="flex-1 min-w-0">
                <input value={l.texto} onChange={(e) => cambiar(i, e.target.value)} aria-label={`Línea ${i + 1}`} className="w-full h-7 px-2 rounded bg-[#1b1b1f] border text-[12.5px] text-[#e4e4e8] outline-none focus:border-[#e67700]" style={{ borderColor: l.dudas.length ? "#b8860b" : "#3a3a40" }} />
                {l.dudas.length > 0 && <div className="text-[11px] text-[#ffd43b] mt-0.5">Revisa: {l.dudas.map((d) => `«${l.texto.slice(d.ini, d.fin)}»`).join(", ")}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};
