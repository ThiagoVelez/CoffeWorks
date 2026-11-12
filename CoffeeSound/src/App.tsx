import React, { useCallback, useEffect, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Scissors, Copy, ClipboardPaste, Keyboard, Info, Play, Pause, Square, Repeat, Circle, AudioWaveform, Rows3, Trash2, Mic, Plus, ZoomIn, ZoomOut, Maximize, Activity } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, IconButton, Modal, NumberField, STUDIO_CSS, Select, Slider, Toggle, cx } from "./studio/ui";
import { isTauri, pickOpenFiles, saveFileAs } from "./studio/desktop";
import { ensureAddon, runAddonFile } from "./studio/addons";
import { base64ToBytes } from "./studio/desktop";
import { WaveformView, fmtTime, type Range, type WaveView } from "./components/WaveformView";
import { Multitrack } from "./components/Multitrack";
import { ACCENT, ACCENT_DARK, type Asset, type Effect, type EffectKind, type Session } from "./types";
import { EFFECT_INFO, OPS, audioContext, buildChain, changeSpeed, decodeBytes, defaultEffect, encodeWav, fromBuffer, generate, getBuffer, noiseProfile, reduceNoise, renderEffects, setKeep, slice, splice, subscribe } from "./services/audio";
import { Player, assetFrom, mixdown, newSession, newTrack, parseSession, serializeSession, sessionLength, sessionTokens, newId } from "./services/session";

const store = createDocStore<Session>({
  appId: "coffeesound",
  extension: "csn",
  category: "Ilustración",
  defaultTitle: "Sesión sin título",
  kindLabel: "Sesiones de CoffeeSound",
  serialize: serializeSession,
  parse: parseSession,
  create: newSession,
});

const AUDIO_EXT = ["wav", "mp3", "ogg", "flac", "m4a", "aac", "webm", "opus"];

type DialogState =
  | { kind: "effect"; fx: Effect; target: "selection" | { track: string } }
  | { kind: "trackFx"; trackId: string }
  | { kind: "amplify" }
  | { kind: "speed" }
  | { kind: "generate" }
  | { kind: "noise" }
  | { kind: "export"; what: "file" | "mix" }
  | null;

const player = new Player();

export const App: React.FC = () => {
  const sd = useStudioDoc<Session>(store, {
    appName: "CoffeeSound",
    importExtensions: AUDIO_EXT,
    importFile: async (file) => {
      const buf = await decodeBytes(file.bytes);
      const s = newSession();
      const a = assetFrom(buf, file.name);
      return { ...s, assets: [a], activeAsset: a.id };
    },
    historyLimit: 40,
  });
  const session = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = useCallback((next: Session, key = "") => sd.apply(next, key), [sd]);
  useEffect(() => {
    setKeep(() => new Set(sd.docRef.current ? sessionTokens(sd.docRef.current) : []));
  }, [sd.docRef]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const off = subscribe(() => setVersion((v) => v + 1));
    return () => void off();
  }, []);

  const [view, setView] = useState<WaveView>({ start: 0, span: 10 });
  const [selection, setSelection] = useState<Range | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [spectral, setSpectral] = useState(false);
  const [mtZoom, setMtZoom] = useState(40);
  const [mtScroll, setMtScroll] = useState(0);
  const [mtHead, setMtHead] = useState(0);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ level: number; time: number } | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const clipboard = useRef<AudioBuffer | null>(null);
  const noise = useRef<Float32Array[] | null>(null);
  const recorder = useRef<{ stop: () => Promise<AudioBuffer | null> } | null>(null);

  const asset = session?.assets.find((a) => a.id === session.activeAsset) || null;
  const buffer = getBuffer(asset?.data);
  const mode = session?.mode || "waveform";

  // Vista ajustada al abrir otro archivo
  useEffect(() => {
    if (buffer) setView({ start: 0, span: Math.max(0.05, buffer.duration) });
    setSelection(null);
    setCursor(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, !!buffer]);

  // Cabezal durante la reproducción
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const p = player.position();
      if (mode === "waveform") setPlayhead(p);
      else setMtHead(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, mode]);

  // ------------------------------------------------------------------------
  // Recursos
  // ------------------------------------------------------------------------

  const setAssetBuffer = (id: string, buf: AudioBuffer, key = "") => {
    const s = cur();
    apply({ ...s, assets: s.assets.map((a) => (a.id === id ? { ...a, data: fromBuffer(buf), duration: buf.duration, channels: buf.numberOfChannels, sampleRate: buf.sampleRate } : a)) }, key);
  };

  const addAsset = (buf: AudioBuffer, name: string, open = true) => {
    const a = assetFrom(buf, name);
    const s = cur();
    apply({ ...s, assets: [...s.assets, a], activeAsset: open ? a.id : s.activeAsset });
    return a;
  };

  const importFiles = async () => {
    const files = await pickOpenFiles([{ name: "Audio", extensions: AUDIO_EXT }], "Importar audio");
    if (!files.length) return;
    if (!sd.docRef.current) await sd.newDocument();
    setBusy("Importando…");
    try {
      for (const f of files) addAsset(await decodeBytes(f.bytes), f.name);
    } catch (err) {
      await showMessage("No se pudo importar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const removeAsset = (id: string) => {
    const s = cur();
    const used = s.tracks.some((t) => t.clips.some((c) => c.assetId === id));
    apply({ ...s, assets: s.assets.filter((a) => a.id !== id), activeAsset: s.activeAsset === id ? s.assets.find((a) => a.id !== id)?.id || null : s.activeAsset, tracks: used ? s.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.assetId !== id) })) : s.tracks });
  };

  // ------------------------------------------------------------------------
  // Transporte
  // ------------------------------------------------------------------------

  const stop = () => {
    player.stop();
    setPlaying(false);
    setPlayhead(null);
  };

  const togglePlay = () => {
    if (playing) {
      const p = player.position();
      stop();
      if (mode === "multitrack") setMtHead(p);
      return;
    }
    if (mode === "waveform") {
      if (!buffer) return;
      const a = selection ? selection.a : cursor;
      const b = selection ? selection.b : buffer.duration;
      player.playBuffer(buffer, a, b, loop && !!selection, () => {
        setPlaying(false);
        setPlayhead(null);
      });
    } else {
      if (!session) return;
      player.playSession(session, mtHead, () => setPlaying(false));
    }
    setPlaying(true);
  };

  // ------------------------------------------------------------------------
  // Edición de forma de onda
  // ------------------------------------------------------------------------

  const range = (): Range | null => (buffer ? selection || { a: 0, b: buffer.duration } : null);

  const edit = (fn: (b: AudioBuffer, r: Range) => AudioBuffer, label: string, keepSel = true) => {
    const r = range();
    if (!buffer || !asset || !r) return;
    stop();
    const out = fn(buffer, r);
    setAssetBuffer(asset.id, out);
    if (!keepSel) setSelection(null);
    toast(label);
  };

  const copy = () => {
    if (!buffer || !selection) return;
    clipboard.current = slice(buffer, selection.a, selection.b);
    toast("Copiado");
  };
  const cut = () => {
    if (!selection) return;
    copy();
    edit((b, r) => splice(b, r.a, r.b, null), "Cortado", false);
    setCursor(selection.a);
  };
  const del = () => {
    if (!selection) return;
    edit((b, r) => splice(b, r.a, r.b, null), "Eliminado", false);
    setCursor(selection.a);
  };
  const paste = () => {
    if (!clipboard.current) return;
    if (!buffer || !asset) {
      addAsset(clipboard.current, "Pegado");
      return;
    }
    const at = selection ? selection.a : cursor;
    const to = selection ? selection.b : cursor;
    const len = clipboard.current.duration;
    edit((b) => splice(b, at, to, clipboard.current), "Pegado", false);
    setSelection({ a: at, b: at + len });
  };
  const cropToSelection = () => {
    if (!selection) return;
    edit((b, r) => slice(b, r.a, r.b), "Recortado", false);
    setCursor(0);
  };
  const insertSilence = async () => {
    const v = await askText({ title: "Insertar silencio", label: "Segundos", defaultValue: "1" });
    const sec = Number(v);
    if (!buffer || !sec) return;
    edit((b) => splice(b, cursor, cursor, generate("silence", sec, b.sampleRate, b.numberOfChannels)), "Silencio insertado");
  };

  const applyEffect = async (fx: Effect) => {
    const r = range();
    if (!buffer || !asset || !r) return;
    stop();
    setBusy("Aplicando efecto…");
    try {
      const part = slice(buffer, r.a, r.b);
      const whole = r.a <= 0.0001 && r.b >= buffer.duration - 0.0001;
      // En el archivo completo se conserva la cola de reverberación o eco
      const tail = whole ? (fx.kind === "reverb" ? fx.params.size : fx.kind === "delay" ? (fx.params.time / 1000) * 4 : 0) : 0;
      let processed = await renderEffects(part, [fx], tail);
      if (!whole) processed = slice(processed, 0, part.duration);
      setAssetBuffer(asset.id, splice(buffer, r.a, r.b, processed));
      toast(`${EFFECT_INFO[fx.kind].label} aplicado`);
    } finally {
      setBusy(null);
    }
  };

  /** Escucha la selección a través del efecto sin aplicarlo. */
  const previewEffect = (fx: Effect | null) => {
    stop();
    if (!fx || !buffer) return;
    const r = range()!;
    const c = audioContext();
    void c.resume();
    const src = c.createBufferSource();
    src.buffer = buffer;
    buildChain(c, src, [fx]).connect(c.destination);
    src.loop = true;
    src.loopStart = r.a;
    src.loopEnd = r.b;
    src.start(0, r.a);
    setPlaying(true);
    const stopFn = () => {
      try {
        src.stop();
      } catch {
        /* parado */
      }
      setPlaying(false);
    };
    previewStop.current = stopFn;
  };
  const previewStop = useRef<(() => void) | null>(null);
  const endPreview = () => {
    previewStop.current?.();
    previewStop.current = null;
  };

  // ------------------------------------------------------------------------
  // Grabación
  // ------------------------------------------------------------------------

  const startRecording = async () => {
    if (recording) {
      const rec = recorder.current;
      recorder.current = null;
      setRecording(null);
      const buf = await rec?.stop();
      if (!buf) return;
      if (!sd.docRef.current) await sd.newDocument();
      if (mode === "waveform" && buffer && asset) {
        setAssetBuffer(asset.id, splice(buffer, cursor, cursor, buf));
        setSelection({ a: cursor, b: cursor + buf.duration });
      } else if (mode === "multitrack") {
        const a = addAsset(buf, `Grabación ${new Date().toLocaleTimeString()}`, false);
        const s = cur();
        const track = s.tracks[0];
        apply({ ...s, tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, clips: [...t.clips, { id: newId("cl"), assetId: a.id, start: mtHead, offset: 0, duration: buf.duration, gain: 0, fadeIn: 0, fadeOut: 0 }] } : t)) });
      } else addAsset(buf, `Grabación ${new Date().toLocaleTimeString()}`);
      toast("Grabación añadida");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const c = audioContext();
      await c.resume();
      const source = c.createMediaStreamSource(stream);
      const analyser = c.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.start();
      const t0 = performance.now();
      const data = new Float32Array(1024);
      let raf = 0;
      const meter = () => {
        analyser.getFloatTimeDomainData(data);
        let m = 0;
        for (const v of data) m = Math.max(m, Math.abs(v));
        setRecording({ level: m, time: (performance.now() - t0) / 1000 });
        raf = requestAnimationFrame(meter);
      };
      meter();
      recorder.current = {
        stop: () =>
          new Promise((resolve) => {
            cancelAnimationFrame(raf);
            mr.onstop = async () => {
              stream.getTracks().forEach((t) => t.stop());
              source.disconnect();
              try {
                resolve(await decodeBytes(new Uint8Array(await new Blob(chunks).arrayBuffer())));
              } catch {
                resolve(null);
              }
            };
            mr.stop();
          }),
      };
    } catch (err) {
      await showMessage("No se pudo usar el micrófono", err instanceof Error ? err.message : String(err));
    }
  };

  // ------------------------------------------------------------------------
  // Multipista
  // ------------------------------------------------------------------------

  const addToMultitrack = () => {
    if (!asset) return;
    const s = cur();
    const track = s.tracks.find((t) => !t.clips.length) || s.tracks[0];
    const start = mtHead;
    apply({ ...s, mode: "multitrack", tracks: s.tracks.map((t) => (t.id === track.id ? { ...t, clips: [...t.clips, { id: newId("cl"), assetId: asset.id, start, offset: 0, duration: asset.duration, gain: 0, fadeIn: 0, fadeOut: 0 }] } : t)) });
  };

  const splitClip = () => {
    const s = cur();
    const t = s.tracks.find((tr) => tr.clips.some((c) => c.id === selectedClip));
    const c = t?.clips.find((x) => x.id === selectedClip);
    if (!t || !c || mtHead <= c.start + 0.01 || mtHead >= c.start + c.duration - 0.01) return toast("Coloca el cabezal dentro del clip seleccionado", "info");
    const d = mtHead - c.start;
    const left = { ...c, duration: d, fadeOut: 0 };
    const right = { ...c, id: newId("cl"), start: mtHead, offset: c.offset + d, duration: c.duration - d, fadeIn: 0 };
    apply({ ...s, tracks: s.tracks.map((x) => (x.id === t.id ? { ...x, clips: [...x.clips.filter((y) => y.id !== c.id), left, right] } : x)) });
  };

  const deleteClip = () => {
    const s = cur();
    apply({ ...s, tracks: s.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selectedClip) })) });
    setSelectedClip(null);
  };

  const patchSelectedClip = (patch: Partial<{ gain: number; fadeIn: number; fadeOut: number }>, key: string) => {
    const s = cur();
    apply({ ...s, tracks: s.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === selectedClip ? { ...c, ...patch } : c)) })) }, key);
  };

  const mixToFile = async () => {
    const s = cur();
    if (!sessionLength(s)) return toast("La multipista está vacía", "info");
    setBusy("Mezclando…");
    try {
      const buf = await mixdown(s);
      const a = assetFrom(buf, `Mezcla ${new Date().toLocaleTimeString()}`);
      apply({ ...cur(), assets: [...cur().assets, a], activeAsset: a.id, mode: "waveform" });
      toast("Mezcla creada como archivo nuevo");
    } finally {
      setBusy(null);
    }
  };

  // ------------------------------------------------------------------------
  // Exportar
  // ------------------------------------------------------------------------

  const doExport = async (what: "file" | "mix", format: "wav16" | "wav24" | "mp3" | "ogg" | "flac", rangeOnly: boolean) => {
    setDialog(null);
    setBusy("Exportando…");
    try {
      let buf: AudioBuffer | null;
      if (what === "mix") buf = await mixdown(cur());
      else buf = buffer && rangeOnly && selection ? slice(buffer, selection.a, selection.b) : buffer;
      if (!buf) return;
      const wav = encodeWav(buf, format === "wav24" ? 24 : 16);
      const base = (what === "mix" ? sd.title : asset?.name.replace(/\.[^.]+$/, "")) || "Audio";
      if (format.startsWith("wav")) {
        const path = await saveFileAs(`${base}.wav`, [{ name: "WAV", extensions: ["wav"] }], wav, "Exportar audio");
        if (path !== null) toast("Exportado");
        return;
      }
      // MP3, OGG y FLAC con el complemento FFmpeg
      if (!isTauri) return void showMessage("Formato con FFmpeg", "MP3, OGG y FLAC se exportan con el complemento «Motor de video FFmpeg» en la aplicación de escritorio. En el navegador exporta a WAV.");
      if (!(await ensureAddon("ffmpeg", "CoffeeSound"))) return;
      const args = format === "mp3" ? ["-b:a", "192k", "-f", "mp3"] : format === "ogg" ? ["-c:a", "libvorbis", "-q:a", "6", "-f", "ogg"] : ["-f", "flac"];
      const out = await runAddonFile("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", "{input}", ...args, "{output}"], wav, "wav");
      const path = await saveFileAs(`${base}.${format}`, [{ name: format.toUpperCase(), extensions: [format] }], base64ToBytes(out), "Exportar audio");
      if (path !== null) toast("Exportado");
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
      if (!sd.docRef.current || sd.showStart || dialog || document.querySelector("[data-modal-open]")) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        return togglePlay();
      }
      if (mod) {
        const map: Record<string, () => void> = {
          z: () => (e.shiftKey ? sd.redo() : sd.undo()),
          y: () => sd.redo(),
          s: () => (e.shiftKey ? void sd.saveAs() : void sd.flush().then(() => toast("Guardado"))),
          o: () => void sd.open(),
          i: () => void importFiles(),
          c: copy,
          x: cut,
          v: paste,
          a: () => buffer && setSelection({ a: 0, b: buffer.duration }),
          t: cropToSelection,
          k: () => setCommandOpen(true),
          e: () => setDialog({ kind: "export", what: mode === "multitrack" ? "mix" : "file" }),
        };
        const fn = map[k];
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") return mode === "waveform" ? del() : deleteClip();
      if (e.key === "Home") return mode === "waveform" ? setCursor(0) : setMtHead(0);
      if (k === "8") return setMode(mode === "waveform" ? "multitrack" : "waveform");
      if (k === "r" && e.shiftKey) return void startRecording();
      if (k === "l") return setLoop(!loop);
      if (k === "s" && mode === "multitrack") return splitClip();
      if (k === "=" || k === "+") return zoom(0.7);
      if (k === "-") return zoom(1.4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const zoom = (k: number) => {
    if (mode === "multitrack") return setMtZoom(Math.max(5, Math.min(400, mtZoom / k)));
    if (!buffer) return;
    const c = playhead ?? cursor;
    const span = Math.max(0.005, Math.min(buffer.duration, view.span * k));
    setView({ span, start: Math.max(0, Math.min(buffer.duration - span, c - span / 2)) });
  };

  const setMode = (m: Session["mode"]) => {
    stop();
    apply({ ...cur(), mode: m }, "mode");
  };

  // ------------------------------------------------------------------------
  // Menús
  // ------------------------------------------------------------------------

  const fxItems = (Object.keys(EFFECT_INFO) as EffectKind[]).map((k) => ({ label: `${EFFECT_INFO[k].label}…`, action: () => buffer && setDialog({ kind: "effect", fx: defaultEffect(k), target: "selection" }), disabled: !buffer }));

  const menus: MenuDefinition[] = session
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Sesión nueva", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir sesión o audio…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { label: "Importar audio…", shortcut: "Ctrl+I", action: () => void importFiles() },
            { divider: true },
            { label: "Guardar sesión", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar sesión como…", icon: SaveAll, action: () => void sd.saveAs() },
            { label: "Exportar archivo…", icon: Download, shortcut: "Ctrl+E", action: () => setDialog({ kind: "export", what: "file" }), disabled: !buffer },
            { label: "Exportar mezcla de la multipista…", action: () => setDialog({ kind: "export", what: "mix" }) },
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
            { label: "Cortar", icon: Scissors, shortcut: "Ctrl+X", action: cut, disabled: !selection },
            { label: "Copiar", icon: Copy, shortcut: "Ctrl+C", action: copy, disabled: !selection },
            { label: "Pegar", icon: ClipboardPaste, shortcut: "Ctrl+V", action: paste },
            { label: "Eliminar", icon: Trash2, shortcut: "Supr", action: del, disabled: !selection },
            { label: "Recortar a la selección", shortcut: "Ctrl+T", action: cropToSelection, disabled: !selection },
            { label: "Seleccionar todo", shortcut: "Ctrl+A", action: () => buffer && setSelection({ a: 0, b: buffer.duration }) },
            { divider: true },
            { label: "Insertar silencio…", action: () => void insertSilence(), disabled: !buffer },
            { label: "Añadir marcador en el cursor", action: () => apply({ ...cur(), markers: [...cur().markers, { id: newId("mk"), time: cursor, name: `M${cur().markers.length + 1}` }] }) },
          ],
        },
        {
          id: "effects",
          label: "Efectos",
          items: [
            { label: "Amplificar…", action: () => setDialog({ kind: "amplify" }), disabled: !buffer },
            { label: "Normalizar (−1 dB)", action: () => edit((b, r) => OPS.normalize(b, r.a, r.b, -1), "Normalizado"), disabled: !buffer },
            { label: "Fundido de entrada", action: () => edit((b, r) => OPS.fadeIn(b, r.a, r.b), "Fundido de entrada"), disabled: !selection },
            { label: "Fundido de salida", action: () => edit((b, r) => OPS.fadeOut(b, r.a, r.b), "Fundido de salida"), disabled: !selection },
            { label: "Silenciar", action: () => edit((b, r) => OPS.silence(b, r.a, r.b), "Silenciado"), disabled: !selection },
            { label: "Invertir fase", action: () => edit((b, r) => OPS.invert(b, r.a, r.b), "Fase invertida"), disabled: !buffer },
            { label: "Invertir (al revés)", action: () => edit((b, r) => OPS.reverse(b, r.a, r.b), "Invertido"), disabled: !buffer },
            { label: "Eliminar desplazamiento de continua", action: () => edit((b, r) => OPS.dcOffset(b, r.a, r.b), "Continua eliminada"), disabled: !buffer },
            { label: "Cambiar velocidad…", action: () => setDialog({ kind: "speed" }), disabled: !buffer },
            { label: "Convertir a mono", action: () => edit((b) => OPS.channels(b, 1), "Convertido a mono"), disabled: !buffer || buffer.numberOfChannels === 1 },
            { label: "Convertir a estéreo", action: () => edit((b) => OPS.channels(b, 2), "Convertido a estéreo"), disabled: !buffer || buffer.numberOfChannels === 2 },
            { divider: true },
            { label: "Reducción de ruido…", action: () => setDialog({ kind: "noise" }), disabled: !buffer },
            { divider: true },
            ...fxItems,
          ],
        },
        {
          id: "generate",
          label: "Generar",
          items: [{ label: "Silencio, tono o ruido…", action: () => setDialog({ kind: "generate" }) }],
        },
        {
          id: "multitrack",
          label: "Multipista",
          items: [
            { label: "Añadir pista", icon: Plus, action: () => apply({ ...cur(), tracks: [...cur().tracks, newTrack(cur().tracks.length)] }) },
            { label: "Añadir el archivo abierto a la multipista", action: addToMultitrack, disabled: !asset },
            { label: "Dividir clip en el cabezal", shortcut: "S", action: splitClip, disabled: !selectedClip },
            { label: "Eliminar clip", action: deleteClip, disabled: !selectedClip },
            { label: "Eliminar la última pista", action: () => cur().tracks.length > 1 && apply({ ...cur(), tracks: cur().tracks.slice(0, -1) }) },
            { divider: true },
            { label: "Mezclar en un archivo nuevo", action: () => void mixToFile() },
          ],
        },
        {
          id: "view",
          label: "Vista",
          items: [
            { label: "Editor de forma de onda", icon: AudioWaveform, checked: mode === "waveform", action: () => setMode("waveform") },
            { label: "Multipista", icon: Rows3, checked: mode === "multitrack", action: () => setMode("multitrack") },
            { label: "Espectro de frecuencias", icon: Activity, checked: spectral, action: () => setSpectral(!spectral) },
            { divider: true },
            { label: "Acercar", icon: ZoomIn, shortcut: "+", action: () => zoom(0.7) },
            { label: "Alejar", icon: ZoomOut, shortcut: "-", action: () => zoom(1.4) },
            { label: "Ver todo", icon: Maximize, action: () => buffer && setView({ start: 0, span: buffer.duration }) },
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
                  "Espacio reproducir/parar · L bucle · Mayús+R grabar · Inicio volver al principio · 8 cambiar de vista.\n\nForma de onda: arrastra para seleccionar (Mayús amplía la selección) · Ctrl+X/C/V cortar, copiar y pegar · Supr eliminar · Ctrl+T recortar a la selección · Ctrl+A todo · rueda: zoom.\n\nMultipista: arrastra clips entre pistas, tira de sus bordes para recortarlos · S dividir · Supr eliminar clip · Ctrl+rueda: zoom."
                ),
            },
            { label: "Acerca de CoffeeSound", icon: Info, action: () => void showMessage("CoffeeSound", "Edición, mezcla y restauración de audio de la suite CoffeeWorks: editor de forma de onda y espectro, multipista con efectos por pista, reducción de ruido, grabación y exportación a WAV (y MP3, OGG y FLAC con FFmpeg).") },
          ],
        },
      ]
    : [];

  const selClip = session?.tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClip) || null;
  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeesound">
      <style>{STUDIO_CSS}</style>
      {session && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Sesión sin título"
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
                  <button type="button" onClick={() => setMode("waveform")} className={cx("px-3 h-7 rounded text-[12px] flex items-center gap-1", mode === "waveform" ? "bg-[#e67700] text-white" : "text-[#c9c9cf]")}>
                    <AudioWaveform size={13} /> Forma de onda
                  </button>
                  <button type="button" onClick={() => setMode("multitrack")} className={cx("px-3 h-7 rounded text-[12px] flex items-center gap-1", mode === "multitrack" ? "bg-[#e67700] text-white" : "text-[#c9c9cf]")}>
                    <Rows3 size={13} /> Multipista
                  </button>
                </div>
                <Button primary accent={ACCENT} onClick={() => setDialog({ kind: "export", what: mode === "multitrack" ? "mix" : "file" })}>
                  <Download size={13} /> Exportar
                </Button>
              </div>
            }
          />
          <div className="flex-1 flex min-h-0">
            <FilesPanel
              assets={session.assets}
              active={session.activeAsset}
              onOpen={(id) => {
                stop();
                apply({ ...cur(), activeAsset: id, mode: "waveform" }, "open");
              }}
              onRemove={removeAsset}
              onImport={() => void importFiles()}
              onRename={(id, name) => apply({ ...cur(), assets: cur().assets.map((a) => (a.id === id ? { ...a, name } : a)) }, `rn-${id}`)}
            />
            <div className="flex-1 flex flex-col min-w-0">
              {mode === "waveform" ? (
                buffer && asset ? (
                  <WaveformView buffer={buffer} view={view} setView={setView} selection={selection} setSelection={setSelection} cursor={cursor} setCursor={setCursor} playhead={playhead} spectral={spectral} markers={session.markers} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#8b8b93]">
                    <AudioWaveform size={42} />
                    <span>Importa un archivo de audio, graba o genera un tono para empezar.</span>
                    <div className="flex gap-2">
                      <Button primary accent={ACCENT} onClick={() => void importFiles()}>
                        Importar audio…
                      </Button>
                      <Button onClick={() => void startRecording()}>
                        <Mic size={13} /> Grabar
                      </Button>
                      <Button onClick={() => setDialog({ kind: "generate" })}>Generar…</Button>
                    </div>
                  </div>
                )
              ) : (
                <Multitrack
                  session={session}
                  onChange={apply}
                  pxPerSec={mtZoom}
                  setPxPerSec={setMtZoom}
                  scroll={mtScroll}
                  setScroll={setMtScroll}
                  playhead={mtHead}
                  setPlayhead={(t) => {
                    if (playing) stop();
                    setMtHead(t);
                  }}
                  selectedClip={selectedClip}
                  setSelectedClip={setSelectedClip}
                  onTrackFx={(id) => setDialog({ kind: "trackFx", trackId: id })}
                  onDropAsset={(assetId, trackId, time) => {
                    const a = cur().assets.find((x) => x.id === assetId);
                    if (!a) return;
                    apply({ ...cur(), tracks: cur().tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, { id: newId("cl"), assetId, start: time, offset: 0, duration: a.duration, gain: 0, fadeIn: 0, fadeOut: 0 }] } : t)) });
                  }}
                  version={version}
                />
              )}
              {/* Transporte */}
              <div className="h-12 shrink-0 bg-[#1c1c1f] border-t border-black/50 flex items-center gap-2 px-3" data-transport>
                <IconButton icon={Square} title="Detener" onClick={() => (stop(), mode === "waveform" ? setCursor(selection?.a ?? 0) : setMtHead(0))} />
                <IconButton icon={playing ? Pause : Play} title="Reproducir / pausar (Espacio)" onClick={togglePlay} active={playing} accent={ACCENT} data-tool="play" />
                <IconButton icon={Repeat} title="Bucle de la selección (L)" active={loop} onClick={() => setLoop(!loop)} accent={ACCENT} />
                <IconButton icon={Circle} title="Grabar (Mayús+R)" onClick={() => void startRecording()} active={!!recording} accent="#e03131" data-tool="record" />
                <span className="font-mono text-[18px] text-[#ffd8a8] w-36 text-center" data-time>
                  {fmtTime(recording ? recording.time : mode === "waveform" ? playhead ?? cursor : mtHead)}
                </span>
                {recording && (
                  <div className="w-40 h-2 bg-[#2a2a2f] rounded overflow-hidden" title="Nivel de entrada">
                    <div className="h-full bg-gradient-to-r from-[#51cf66] via-[#ffd43b] to-[#ff6b6b]" style={{ width: `${Math.min(100, recording.level * 100)}%` }} />
                  </div>
                )}
                {mode === "waveform" && selection && (
                  <span className="text-[11px] text-[#9a9aa2] font-mono" data-selection>
                    Selección {fmtTime(selection.a)} → {fmtTime(selection.b)} ({(selection.b - selection.a).toFixed(3)} s)
                  </span>
                )}
                {mode === "multitrack" && selClip && (
                  <div className="flex items-center gap-2 text-[11px]" data-clip-props>
                    <NumberField label="Ganancia" value={selClip.gain} min={-40} max={24} step={0.5} onChange={(v) => patchSelectedClip({ gain: v }, "gain")} suffix="dB" className="w-28" />
                    <NumberField label="Entrada" value={selClip.fadeIn} min={0} max={selClip.duration} step={0.1} onChange={(v) => patchSelectedClip({ fadeIn: v }, "fi")} suffix="s" className="w-24" />
                    <NumberField label="Salida" value={selClip.fadeOut} min={0} max={selClip.duration} step={0.1} onChange={(v) => patchSelectedClip({ fadeOut: v }, "fo")} suffix="s" className="w-24" />
                  </div>
                )}
                <div className="flex-1" />
                {mode === "multitrack" && (
                  <label className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
                    Maestro
                    <input type="range" min={-30} max={6} step={0.5} value={session.masterVolume} onChange={(e) => apply({ ...cur(), masterVolume: Number(e.target.value) }, "master")} className="studio-range w-28" />
                    <span className="font-mono w-10">{session.masterVolume.toFixed(1)}</span>
                  </label>
                )}
                {buffer && mode === "waveform" && (
                  <span className="text-[11px] text-[#6f6f77] font-mono">
                    {buffer.sampleRate} Hz · {buffer.numberOfChannels === 2 ? "estéreo" : "mono"} · {fmtTime(buffer.duration)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {dialog?.kind === "effect" && (
        <EffectDialog
          fx={dialog.fx}
          onPreview={(fx) => (fx ? previewEffect(fx) : endPreview())}
          onCancel={() => {
            endPreview();
            setDialog(null);
          }}
          onApply={(fx) => {
            endPreview();
            setDialog(null);
            void applyEffect(fx);
          }}
        />
      )}
      {dialog?.kind === "trackFx" && session && (
        <TrackFxDialog
          track={session.tracks.find((t) => t.id === dialog.trackId)!}
          onChange={(effects) => apply({ ...cur(), tracks: cur().tracks.map((t) => (t.id === dialog.trackId ? { ...t, effects } : t)) }, `fx-${dialog.trackId}`)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "amplify" && (
        <ValueDialog title="Amplificar" label="Ganancia" unit="dB" min={-40} max={40} step={0.5} def={3} onCancel={() => setDialog(null)} onApply={(v) => (setDialog(null), edit((b, r) => OPS.amplify(b, r.a, r.b, v), `Amplificado ${v} dB`))} />
      )}
      {dialog?.kind === "speed" && (
        <ValueDialog
          title="Cambiar velocidad (y tono)"
          label="Velocidad"
          unit="%"
          min={25}
          max={400}
          step={1}
          def={100}
          onCancel={() => setDialog(null)}
          onApply={async (v) => {
            setDialog(null);
            const r = range();
            if (!buffer || !asset || !r) return;
            const part = await changeSpeed(slice(buffer, r.a, r.b), v / 100);
            setAssetBuffer(asset.id, splice(buffer, r.a, r.b, part));
            setSelection(null);
          }}
        />
      )}
      {dialog?.kind === "generate" && (
        <GenerateDialog
          onCancel={() => setDialog(null)}
          onApply={async (kind, sec, freq, db) => {
            setDialog(null);
            if (!sd.docRef.current) await sd.newDocument();
            const rate = buffer?.sampleRate || 48000;
            const ch = buffer?.numberOfChannels || 2;
            const g = generate(kind, sec, rate, ch, freq, db);
            if (buffer && asset && mode === "waveform") {
              setAssetBuffer(asset.id, splice(buffer, cursor, cursor, g));
              setSelection({ a: cursor, b: cursor + sec });
            } else addAsset(g, kind === "tone" ? `Tono ${freq} Hz` : kind === "silence" ? "Silencio" : "Ruido");
          }}
        />
      )}
      {dialog?.kind === "noise" && (
        <NoiseDialog
          hasProfile={!!noise.current}
          hasSelection={!!selection}
          onCapture={() => {
            if (!buffer || !selection) return;
            noise.current = noiseProfile(buffer, selection.a, selection.b);
            toast("Perfil de ruido capturado");
            setDialog({ kind: "noise" });
          }}
          onCancel={() => setDialog(null)}
          onApply={(amount, sens) => {
            setDialog(null);
            const r = range();
            if (!buffer || !asset || !r || !noise.current) return;
            setBusy("Reduciendo el ruido…");
            window.setTimeout(() => {
              try {
                setAssetBuffer(asset.id, reduceNoise(buffer, noise.current!, r.a, r.b, amount, sens));
                toast("Ruido reducido");
              } finally {
                setBusy(null);
              }
            }, 30);
          }}
        />
      )}
      {dialog?.kind === "export" && <ExportDialog what={dialog.what} hasSelection={!!selection} onCancel={() => setDialog(null)} onExport={(f, r) => void doExport(dialog.what, f, r)} />}

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
          appName="CoffeeSound"
          tagline="Edición, mezcla y restauración de audio • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Sesión nueva: importa, graba o genera audio"
          openHint="Abrir una sesión .csn o un audio (WAV, MP3, OGG, FLAC…)"
          formats={[".csn", ".wav", ".mp3", ".ogg", ".flac"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={session ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Paneles y diálogos
// ---------------------------------------------------------------------------

const FilesPanel: React.FC<{ assets: Asset[]; active: string | null; onOpen: (id: string) => void; onRemove: (id: string) => void; onImport: () => void; onRename: (id: string, name: string) => void }> = ({ assets, active, onOpen, onRemove, onImport, onRename }) => (
  <aside className="w-[220px] shrink-0 bg-[#202023] border-r border-black/50 flex flex-col" data-files>
    <div className="px-3 h-9 flex items-center justify-between border-b border-black/40">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Archivos</span>
      <button type="button" title="Importar audio" onClick={onImport} className="text-[#b9b9c0] hover:text-white">
        <Plus size={14} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-1">
      {assets.length === 0 && <span className="text-[11px] text-[#6f6f77] p-2 block">Aún no hay audio.</span>}
      {assets.map((a) => (
        <div
          key={a.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/coffee-asset", a.id)}
          onClick={() => onOpen(a.id)}
          className={cx("group px-2 py-1.5 rounded cursor-pointer", a.id === active ? "bg-[#e67700]/30" : "hover:bg-white/5")}
          data-asset={a.name}
        >
          <div className="flex items-center gap-1">
            <AudioWaveform size={12} className="text-[#ffa94d] shrink-0" />
            <input value={a.name} onChange={(e) => onRename(a.id, e.target.value)} onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0 bg-transparent text-[12px] outline-none truncate" />
            <button type="button" title="Quitar" onClick={(e) => (e.stopPropagation(), onRemove(a.id))} className="opacity-0 group-hover:opacity-100 text-[#8b8b93] hover:text-white">
              <Trash2 size={11} />
            </button>
          </div>
          <span className="text-[10px] text-[#6f6f77] font-mono">
            {fmtTime(a.duration)} · {a.channels === 2 ? "estéreo" : "mono"} · {a.sampleRate / 1000} kHz
          </span>
        </div>
      ))}
    </div>
    <span className="text-[10px] text-[#6f6f77] p-2 border-t border-black/40">Arrastra un archivo a una pista de la multipista.</span>
  </aside>
);

const EffectParams: React.FC<{ fx: Effect; onChange: (fx: Effect) => void }> = ({ fx, onChange }) => (
  <>
    {EFFECT_INFO[fx.kind].params.map((p) => (
      <Slider key={p.key} label={p.label} value={fx.params[p.key]} min={p.min} max={p.max} step={p.step || 1} suffix={p.unit} onChange={(v) => onChange({ ...fx, params: { ...fx.params, [p.key]: v } })} data-name={p.key} />
    ))}
  </>
);

const EffectDialog: React.FC<{ fx: Effect; onApply: (fx: Effect) => void; onCancel: () => void; onPreview: (fx: Effect | null) => void }> = ({ fx: initial, onApply, onCancel, onPreview }) => {
  const [fx, setFx] = useState(initial);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    if (previewing) onPreview(fx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx]);
  return (
    <Modal
      title={EFFECT_INFO[fx.kind].label}
      onClose={onCancel}
      width={380}
      footer={
        <>
          <Button
            onClick={() => {
              const next = !previewing;
              setPreviewing(next);
              onPreview(next ? fx : null);
            }}
          >
            {previewing ? <Pause size={12} /> : <Play size={12} />} {previewing ? "Detener" : "Escuchar"}
          </Button>
          <div className="flex-1" />
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACCENT} onClick={() => onApply(fx)}>
            Aplicar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5" data-effect-dialog={fx.kind}>
        <EffectParams fx={fx} onChange={setFx} />
        <span className="text-[#8b8b93]">Se aplica a la selección (o a todo el archivo si no hay selección).</span>
      </div>
    </Modal>
  );
};

const TrackFxDialog: React.FC<{ track: { name: string; effects: Effect[] }; onChange: (fx: Effect[]) => void; onClose: () => void }> = ({ track, onChange, onClose }) => {
  const [add, setAdd] = useState<EffectKind>("eq");
  return (
    <Modal title={`Efectos de «${track.name}»`} onClose={onClose} width={420} footer={<Button primary accent={ACCENT} onClick={onClose}>Listo</Button>}>
      <span className="text-[#8b8b93]">Se aplican en tiempo real al reproducir y al mezclar, sin modificar el audio.</span>
      {track.effects.map((fx, i) => (
        <div key={fx.id} className="bg-[#1d1d21] rounded p-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Toggle checked={fx.enabled} onChange={(v) => onChange(track.effects.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} label={EFFECT_INFO[fx.kind].label} accent={ACCENT} />
            <div className="flex-1" />
            <button type="button" onClick={() => onChange(track.effects.filter((_, j) => j !== i))} className="text-[#8b8b93] hover:text-white" title="Quitar">
              <Trash2 size={12} />
            </button>
          </div>
          <EffectParams fx={fx} onChange={(n) => onChange(track.effects.map((x, j) => (j === i ? n : x)))} />
        </div>
      ))}
      <div className="flex gap-2">
        <Select value={add} onChange={(v) => setAdd(v as EffectKind)} options={(Object.keys(EFFECT_INFO) as EffectKind[]).map((k) => ({ value: k, label: EFFECT_INFO[k].label }))} className="flex-1" />
        <Button onClick={() => onChange([...track.effects, defaultEffect(add)])}>
          <Plus size={12} /> Añadir
        </Button>
      </div>
    </Modal>
  );
};

const ValueDialog: React.FC<{ title: string; label: string; unit: string; min: number; max: number; step: number; def: number; onApply: (v: number) => void; onCancel: () => void }> = ({ title, label, unit, min, max, step, def, onApply, onCancel }) => {
  const [v, setV] = useState(def);
  return (
    <Modal title={title} onClose={onCancel} width={340} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onApply(v)}>Aplicar</Button></>}>
      <Slider label={label} value={v} min={min} max={max} step={step} suffix={unit} onChange={setV} />
    </Modal>
  );
};

const GenerateDialog: React.FC<{ onApply: (kind: "silence" | "tone" | "noise" | "pink", sec: number, freq: number, db: number) => void; onCancel: () => void }> = ({ onApply, onCancel }) => {
  const [kind, setKind] = useState<"silence" | "tone" | "noise" | "pink">("tone");
  const [sec, setSec] = useState(3);
  const [freq, setFreq] = useState(440);
  const [db, setDb] = useState(-12);
  return (
    <Modal title="Generar" onClose={onCancel} width={340} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onApply(kind, sec, freq, db)}>Generar</Button></>}>
      <Select value={kind} onChange={(v) => setKind(v as typeof kind)} options={[{ value: "tone", label: "Tono (onda senoidal)" }, { value: "silence", label: "Silencio" }, { value: "noise", label: "Ruido blanco" }, { value: "pink", label: "Ruido rosa" }]} />
      <Slider label="Duración" value={sec} min={0.1} max={120} step={0.1} suffix="s" onChange={setSec} />
      {kind === "tone" && <Slider label="Frecuencia" value={freq} min={20} max={20000} suffix="Hz" onChange={setFreq} />}
      {kind !== "silence" && <Slider label="Volumen" value={db} min={-60} max={0} suffix="dB" onChange={setDb} />}
    </Modal>
  );
};

const NoiseDialog: React.FC<{ hasProfile: boolean; hasSelection: boolean; onCapture: () => void; onApply: (amount: number, sensitivity: number) => void; onCancel: () => void }> = ({ hasProfile, hasSelection, onCapture, onApply, onCancel }) => {
  const [amount, setAmount] = useState(80);
  const [sens, setSens] = useState(1.5);
  return (
    <Modal
      title="Reducción de ruido"
      onClose={onCancel}
      width={400}
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button primary accent={ACCENT} disabled={!hasProfile} onClick={() => onApply(amount, sens)}>
            Reducir ruido
          </Button>
        </>
      }
    >
      <ol className="list-decimal pl-4 text-[#c9c9cf] flex flex-col gap-1">
        <li>Selecciona un trozo donde solo se oiga el ruido (sin voz ni música) y captura el perfil.</li>
        <li>Selecciona lo que quieras limpiar (o nada, para todo el archivo) y pulsa «Reducir ruido».</li>
      </ol>
      <Button onClick={onCapture} disabled={!hasSelection}>
        {hasProfile ? "Volver a capturar el perfil" : "Capturar perfil de ruido"}
      </Button>
      {hasProfile && <span className="text-[#8ce99a]">Perfil de ruido listo.</span>}
      <Slider label="Reducción" value={amount} min={10} max={100} suffix="%" onChange={setAmount} />
      <Slider label="Sensibilidad" value={sens} min={1} max={4} step={0.1} onChange={setSens} />
    </Modal>
  );
};

const ExportDialog: React.FC<{ what: "file" | "mix"; hasSelection: boolean; onExport: (f: "wav16" | "wav24" | "mp3" | "ogg" | "flac", rangeOnly: boolean) => void; onCancel: () => void }> = ({ what, hasSelection, onExport, onCancel }) => {
  const [f, setF] = useState<"wav16" | "wav24" | "mp3" | "ogg" | "flac">("wav16");
  const [rangeOnly, setRangeOnly] = useState(false);
  return (
    <Modal title={what === "mix" ? "Exportar la mezcla" : "Exportar el archivo"} onClose={onCancel} width={360} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onExport(f, rangeOnly)}>Exportar</Button></>}>
      <Select
        value={f}
        onChange={(v) => setF(v as typeof f)}
        options={[
          { value: "wav16", label: "WAV 16 bits" },
          { value: "wav24", label: "WAV 24 bits" },
          { value: "mp3", label: "MP3 192 kbps (FFmpeg)" },
          { value: "ogg", label: "OGG Vorbis (FFmpeg)" },
          { value: "flac", label: "FLAC sin pérdida (FFmpeg)" },
        ]}
      />
      {what === "file" && hasSelection && <Toggle checked={rangeOnly} onChange={setRangeOnly} label="Solo la selección" accent={ACCENT} />}
    </Modal>
  );
};
