import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, FolderOpen, SaveAll, Home, Undo2, Redo2, Download, Keyboard, Info, Camera, CameraOff, Mic, MicOff, Circle, Square, Play, Trash2, Crosshair, ImagePlus, Pencil } from "lucide-react";
import { SuiteHeader, type MenuDefinition } from "./studio/SuiteHeader";
import { StartScreen } from "./studio/StartScreen";
import { CommandSearch } from "./studio/CommandSearch";
import { DialogHost, askText, showMessage, toast } from "./studio/Dialogs";
import { createDocStore } from "./studio/docStore";
import { useStudioDoc } from "./studio/useStudioDoc";
import { Button, Modal, STUDIO_CSS, Section, Select, Slider, Toggle, cx } from "./studio/ui";
import { isTauri, pickOpenFiles, saveFileAs } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import { newId } from "./studio/color";
import { FORMAT_LABEL, encodeGifJob, encodeWebM, encodeWithFfmpeg, extensionOf, isCancelled, needsFfmpeg, type FrameJob, type VideoFormat } from "./studio/videoExport";
import { invoke } from "@tauri-apps/api/core";
import { ACCENT, ACCENT_DARK, NEUTRAL, RIG_KEYS, TRIGGERS, TRIGGER_DURATION, type Character, type PuppetDoc, type Rig, type Take, type Trigger } from "./types";
import { CHARACTER_PRESETS, defaultScene, drawScene, packRig, rigAt, triggersAt, type ActiveTriggers } from "./puppet";
import { FaceTracker, MicLevel } from "./tracker";

const newPuppetDoc = (): PuppetDoc => ({
  version: 1,
  character: { ...CHARACTER_PRESETS[0] },
  scene: defaultScene(),
  settings: { smoothing: 0.55, lipSync: true, micGain: 1, mouseFollow: true, autoBlink: true, expressiveness: 1.1 },
  takes: [],
});

const store = createDocStore<PuppetDoc>({
  appId: "coffeepuppet",
  extension: "cpup",
  category: "Ilustración",
  defaultTitle: "Personaje sin título",
  kindLabel: "Personajes de CoffeePuppet",
  serialize: (d) => JSON.stringify({ app: "CoffeePuppet", ...d }),
  parse: (t) => {
    const raw = JSON.parse(t);
    const base = newPuppetDoc();
    return { ...base, ...raw, version: 1, character: { ...base.character, ...raw.character }, scene: { ...base.scene, ...raw.scene }, settings: { ...base.settings, ...raw.settings }, takes: raw.takes || [] };
  },
  create: newPuppetDoc,
});

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((r) => {
    const fr = new FileReader();
    fr.onload = () => r(String(fr.result));
    fr.readAsDataURL(b);
  });

export const App: React.FC = () => {
  const sd = useStudioDoc<PuppetDoc>(store, { appName: "CoffeePuppet", historyLimit: 40 });
  const doc = sd.doc;
  const cur = () => sd.docRef.current!;
  const apply = (next: PuppetDoc, key = "") => sd.apply(next, key);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camPreview = useRef<HTMLCanvasElement>(null);
  const tracker = useMemo(() => new FaceTracker(), []);
  const mic = useMemo(() => new MicLevel(), []);
  const [camOn, setCamOn] = useState(false);
  const [camLoading, setCamLoading] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [faceFound, setFaceFound] = useState(false);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState<{ start: number } | null>(null);
  const [playingTake, setPlayingTake] = useState<string | null>(null);
  const [exportTake, setExportTake] = useState<Take | null>(null);
  const [exporting, setExporting] = useState<{ fraction: number; label: string } | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const cancelExport = useRef(false);

  const rig = useRef<Rig>({ ...NEUTRAL });
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const bodyTarget = useRef(0);
  const keysDown = useRef(new Set<string>());
  const liveEvents = useRef<{ t: number; trigger: Trigger }[]>([]);
  const blink = useRef({ next: performance.now() + 2500, until: 0 });
  const recFrames = useRef<{ t: number; r: number[] }[]>([]);
  const recEvents = useRef<{ t: number; trigger: Trigger }[]>([]);
  const recAudio = useRef<{ rec: MediaRecorder; chunks: Blob[] } | null>(null);
  const playback = useRef<{ take: Take; start: number; audio: HTMLAudioElement | null } | null>(null);
  const bgImage = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const src = doc?.scene.image;
    if (!src) {
      bgImage.current = null;
      return;
    }
    const img = new Image();
    img.src = src;
    bgImage.current = img;
  }, [doc?.scene.image]);

  const fire = (trigger: Trigger) => {
    const now = performance.now() / 1000;
    liveEvents.current = [...liveEvents.current.filter((e) => now - e.t < TRIGGER_DURATION), { t: now, trigger }];
    if (recording) recEvents.current.push({ t: (performance.now() - recording.start) / 1000, trigger });
  };

  // ------------------------------------------------------------------------
  // Bucle principal: entradas → rig → dibujo
  // ------------------------------------------------------------------------

  useEffect(() => {
    if (!doc) return;
    let raf = 0;
    let lastUi = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const d = sd.docRef.current;
      const c = canvasRef.current;
      if (!d || !c) return;
      const now = performance.now();
      let r: Rig;
      let tr: ActiveTriggers;
      const pb = playback.current;
      if (pb) {
        const t = (now - pb.start) / 1000;
        if (t > pb.take.duration + 0.2) {
          playback.current = null;
          pb.audio?.pause();
          setPlayingTake(null);
        }
        r = rigAt(pb.take, t);
        tr = triggersAt(pb.take.events, t);
      } else {
        const target: Rig = { ...rig.current, eyeL: 1, eyeR: 1 };
        const s = d.settings;
        let face: Partial<Rig> | null = null;
        if (tracker.running) face = tracker.read(s.expressiveness);
        if (face) Object.assign(target, face);
        else {
          // Sin cámara: la cabeza mira al ratón y los ojos parpadean solos
          const m = mouse.current;
          if (s.mouseFollow && m) {
            target.turn = m.x * 0.8;
            target.nod = m.y * 0.5;
            target.lookX = m.x;
            target.lookY = m.y;
            target.tilt = -m.x * 6;
          } else {
            target.turn = 0;
            target.nod = 0;
            target.lookX = 0;
            target.lookY = 0;
            target.tilt = 0;
          }
          target.headX = 0;
          target.headY = 0;
          target.browL = target.browR = 0;
          target.smile = 0.25;
          target.mouthOpen = 0;
          if (s.autoBlink) {
            const b = blink.current;
            if (now > b.next) {
              b.until = now + 140;
              b.next = now + 2200 + Math.random() * 3200;
            }
            if (now < b.until) target.eyeL = target.eyeR = 0;
          }
        }
        if (mic.running && s.lipSync) {
          const lv = mic.level(s.micGain);
          target.mouthOpen = Math.max(target.mouthOpen, lv);
          if (now - lastUi > 80) setLevel(lv);
        }
        // Caminar con las flechas
        const k = keysDown.current;
        if (k.has("ArrowLeft")) bodyTarget.current = Math.max(-1, bodyTarget.current - 0.012);
        if (k.has("ArrowRight")) bodyTarget.current = Math.min(1, bodyTarget.current + 0.012);
        target.bodyX = bodyTarget.current;
        // Suavizado (los ojos y la boca más rápidos)
        const a = 1 - d.settings.smoothing;
        const next = { ...rig.current };
        for (const key of RIG_KEYS) {
          const fast = key === "eyeL" || key === "eyeR" || key === "mouthOpen";
          const f = fast ? Math.min(1, a * 2.2) : a;
          next[key] = rig.current[key] + (target[key] - rig.current[key]) * f;
        }
        rig.current = next;
        r = next;
        const tnow = now / 1000;
        tr = triggersAt(liveEvents.current, tnow);
        if (recording) recFrames.current.push({ t: (now - recording.start) / 1000, r: packRig(next) });
      }
      // Dibujo
      const W = d.scene.width;
      const H = d.scene.height;
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const g = c.getContext("2d")!;
      drawScene(g, d, r, tr, now / 1000, bgImage.current);
      // Vista previa de la cámara
      const pv = camPreview.current;
      const v = tracker.videoElement;
      if (pv && v) {
        const pg = pv.getContext("2d")!;
        pg.save();
        pg.scale(-1, 1);
        pg.drawImage(v, -pv.width, 0, pv.width, pv.height);
        pg.restore();
      }
      if (now - lastUi > 120) {
        lastUi = now;
        setFaceFound(tracker.found);
        if (recording) setElapsed((now - recording.start) / 1000);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!doc, recording]);

  // Ratón sobre el escenario
  const onStageMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouse.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
  };

  // ------------------------------------------------------------------------
  // Cámara, micrófono y grabación
  // ------------------------------------------------------------------------

  const toggleCamera = async () => {
    if (camOn) {
      tracker.stop();
      setCamOn(false);
      return;
    }
    setCamLoading(true);
    try {
      await tracker.start();
      setCamOn(true);
      toast("Cámara activa: mira al frente y pulsa «Calibrar»", "info");
    } catch (err) {
      tracker.stop();
      await showMessage("No se pudo usar la cámara", `${err instanceof Error ? err.message : String(err)}\n\nSin cámara, el personaje mira al ratón, parpadea solo y mueve la boca con el micrófono.`);
    } finally {
      setCamLoading(false);
    }
  };

  const toggleMic = async () => {
    if (micOn) {
      mic.stop();
      setMicOn(false);
      setLevel(0);
      return;
    }
    try {
      await mic.start();
      setMicOn(true);
    } catch (err) {
      await showMessage("No se pudo usar el micrófono", err instanceof Error ? err.message : String(err));
    }
  };

  const startRecording = () => {
    if (recording) return;
    stopPlayback();
    recFrames.current = [];
    recEvents.current = [];
    recAudio.current = null;
    if (mic.stream) {
      try {
        const rec = new MediaRecorder(mic.stream);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.start(250);
        recAudio.current = { rec, chunks };
      } catch {
        recAudio.current = null;
      }
    }
    setElapsed(0);
    setRecording({ start: performance.now() });
  };

  const stopRecording = async () => {
    if (!recording) return;
    const duration = (performance.now() - recording.start) / 1000;
    setRecording(null);
    let audio: string | null = null;
    const ra = recAudio.current;
    if (ra) {
      await new Promise<void>((r) => {
        ra.rec.onstop = () => r();
        ra.rec.stop();
      });
      if (ra.chunks.length) audio = await blobToDataUrl(new Blob(ra.chunks, { type: ra.rec.mimeType || "audio/webm" }));
    }
    const d = cur();
    const take: Take = { id: newId("take"), name: `Toma ${d.takes.length + 1}`, duration, frames: recFrames.current, events: recEvents.current, audio, createdAt: Date.now() };
    apply({ ...d, takes: [take, ...d.takes] });
    toast(`${take.name} grabada (${duration.toFixed(1)} s)`);
  };

  const playTake = (t: Take) => {
    stopPlayback();
    const audio = t.audio ? new Audio(t.audio) : null;
    void audio?.play().catch(() => undefined);
    playback.current = { take: t, start: performance.now(), audio };
    setPlayingTake(t.id);
  };
  const stopPlayback = () => {
    playback.current?.audio?.pause();
    playback.current = null;
    setPlayingTake(null);
  };

  // ------------------------------------------------------------------------
  // Exportar una toma
  // ------------------------------------------------------------------------

  const runExport = async (take: Take, format: VideoFormat, scale: number) => {
    setExportTake(null);
    const d = cur();
    const fps = 30;
    const frames = Math.max(1, Math.round(take.duration * fps));
    const name = `${sd.title || d.character.name} - ${take.name}.${extensionOf(format)}`;
    let target: string | null = null;
    if (needsFfmpeg(format)) {
      if (!isTauri) return void showMessage("Necesita FFmpeg", "MP4, MOV y el GIF de alta calidad se exportan desde la aplicación de escritorio con el complemento FFmpeg. En el navegador, exporta a WebM o GIF.");
      if (!(await ensureAddon("ffmpeg", "CoffeePuppet"))) return;
      target = await invoke<string | null>("core_pick_save", { title: "Exportar video", defaultName: name, filters: [{ name: FORMAT_LABEL[format], extensions: [extensionOf(format)] }] });
      if (!target) return;
    }
    cancelExport.current = false;
    setExporting({ fraction: 0, label: "Preparando" });
    try {
      let audio: AudioBuffer | null = null;
      if (take.audio && format !== "gif" && format !== "gif-ffmpeg" && format !== "png") {
        try {
          const ctx = new AudioContext();
          audio = await ctx.decodeAudioData(await (await fetch(take.audio)).arrayBuffer());
          void ctx.close();
        } catch {
          audio = null;
        }
      }
      const W = Math.round(d.scene.width * scale);
      const H = Math.round(d.scene.height * scale);
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d")!;
      const job: FrameJob = {
        width: W,
        height: H,
        fps,
        frames,
        audio,
        cancelled: () => cancelExport.current,
        onProgress: (fraction, label) => setExporting({ fraction, label }),
        render: (i) => {
          const t = i / fps;
          g.setTransform(scale, 0, 0, scale, 0, 0);
          drawScene(g, d, rigAt(take, t), triggersAt(take.events, t), t, bgImage.current);
          return c;
        },
      };
      if (format === "webm") await saveFileAs(name, [{ name: "WebM", extensions: ["webm"] }], await encodeWebM(job), "Exportar video");
      else if (format === "gif") await saveFileAs(name, [{ name: "GIF", extensions: ["gif"] }], await encodeGifJob(job, Math.min(W, 720)), "Exportar GIF");
      else if (format === "png") return void showMessage("Formato no disponible", "Para CoffeePuppet exporta a video o GIF.");
      else await encodeWithFfmpeg(job, format, target!);
      toast("Video exportado");
    } catch (err) {
      if (isCancelled(err)) toast("Exportación cancelada", "info");
      else await showMessage("No se pudo exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };

  // ------------------------------------------------------------------------
  // Teclado
  // ------------------------------------------------------------------------

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!sd.docRef.current || sd.showStart || exportTake || exporting || document.querySelector("[data-modal-open]")) return;
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = e.key.toLowerCase();
        if (k === "z") return e.preventDefault(), e.shiftKey ? sd.redo() : sd.undo();
        if (k === "s") return e.preventDefault(), void sd.flush().then(() => toast("Guardado"));
        if (k === "o") return e.preventDefault(), void sd.open();
        if (k === "k") return e.preventDefault(), setCommandOpen(true);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        keysDown.current.add(e.key);
        return;
      }
      const t = TRIGGERS.find((x) => x.key === e.key);
      if (t) return fire(t.id);
      if (e.key.toLowerCase() === "r") return recording ? void stopRecording() : startRecording();
      if (e.key.toLowerCase() === "c") return tracker.calibrate();
      if (e.key === "Escape") return stopPlayback();
    };
    const up = (e: KeyboardEvent) => keysDown.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  useEffect(() => () => {
    tracker.stop();
    mic.stop();
  }, [tracker, mic]);

  const setChar = (patch: Partial<Character>, key = "") => apply({ ...cur(), character: { ...cur().character, ...patch } }, key);
  const setScene = (patch: Partial<PuppetDoc["scene"]>, key = "") => apply({ ...cur(), scene: { ...cur().scene, ...patch } }, key);
  const setSettings = (patch: Partial<PuppetDoc["settings"]>, key = "") => apply({ ...cur(), settings: { ...cur().settings, ...patch } }, key);

  const importBackground = async () => {
    const [f] = await pickOpenFiles([{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "webp"] }], "Fondo de la escena");
    if (!f) return;
    const ext = f.name.split(".").pop()!.toLowerCase();
    setScene({ image: await blobToDataUrl(new Blob([f.bytes as BlobPart], { type: ext === "jpg" ? "image/jpeg" : `image/${ext}` })) });
  };

  const menus: MenuDefinition[] = doc
    ? [
        {
          id: "file",
          label: "Archivo",
          items: [
            { label: "Personaje nuevo", icon: FilePlus, action: () => void sd.newDocument() },
            { label: "Abrir…", icon: FolderOpen, shortcut: "Ctrl+O", action: () => void sd.open() },
            { divider: true },
            { label: "Guardar", shortcut: "Ctrl+S", action: () => void sd.flush().then(() => toast("Guardado")) },
            { label: "Guardar como…", icon: SaveAll, action: () => void sd.saveAs() },
            { label: "Exportar la última toma…", icon: Download, action: () => doc.takes[0] && setExportTake(doc.takes[0]), disabled: !doc.takes.length },
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
          ],
        },
        {
          id: "perform",
          label: "Actuación",
          items: [
            { label: camOn ? "Apagar la cámara" : "Encender la cámara", icon: camOn ? CameraOff : Camera, action: () => void toggleCamera() },
            { label: micOn ? "Apagar el micrófono" : "Encender el micrófono", icon: micOn ? MicOff : Mic, action: () => void toggleMic() },
            { label: "Calibrar la postura neutra", icon: Crosshair, shortcut: "C", action: () => tracker.calibrate(), disabled: !camOn },
            { divider: true },
            { label: recording ? "Detener la grabación" : "Grabar una toma", icon: recording ? Square : Circle, shortcut: "R", action: () => (recording ? void stopRecording() : startRecording()) },
            { divider: true },
            ...TRIGGERS.map((t) => ({ label: `${t.emoji} ${t.label}`, shortcut: t.key, action: () => fire(t.id) })),
          ],
        },
        {
          id: "help",
          label: "Ayuda",
          items: [
            {
              label: "Cómo actuar",
              icon: Keyboard,
              action: () =>
                void showMessage(
                  "Cómo actuar con CoffeePuppet",
                  "1. Enciende la cámara: el personaje copia tu cabeza, ojos, cejas, boca y parpadeo. Mira al frente y pulsa «Calibrar» (C).\n2. Enciende el micrófono para que la boca siga tu voz y para grabarla en las tomas.\n3. Usa las teclas 1–9 para gestos (saludar, saltar, sorpresa, corazones...) y las flechas ← → para moverte por la escena.\n4. Pulsa R para grabar una toma y otra vez R para terminar. Desde la lista de tomas puedes verlas y exportarlas a video.\n\nSin cámara, el personaje mira al ratón y parpadea solo. Todo se procesa en tu equipo: la imagen de la cámara no sale de él."
                ),
            },
            { label: "Acerca de CoffeePuppet", icon: Info, action: () => void showMessage("CoffeePuppet", "Animación de personajes en tiempo real de la suite CoffeeWorks: seguimiento facial con la cámara (sin Internet), sincronización de labios con el micrófono, gestos con el teclado, grabación de tomas con voz y exportación a video.") },
          ],
        },
      ]
    : [];

  const logo = <img src="/app-icon.png" alt="" className="w-8 h-8" />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-[#e4e4e8]" data-app="coffeepuppet">
      <style>{STUDIO_CSS}</style>
      {doc && (
        <>
          <SuiteHeader
            logo={logo}
            logoTitle="Pantalla de inicio"
            onLogoClick={() => sd.setShowStart(true)}
            title={sd.title}
            titlePlaceholder="Personaje sin título"
            onTitleChange={sd.setTitle}
            menus={menus}
            saveStatus={sd.saveStatus}
            fileLocation={sd.location}
            isStarred={sd.isStarred}
            onToggleStar={() => void sd.toggleStar()}
            onBeforeClose={sd.flush}
            actions={
              <div className="flex items-center gap-2">
                {recording ? (
                  <Button primary accent="#e03131" onClick={() => void stopRecording()} data-action="stop-rec">
                    <Square size={12} /> Detener · {elapsed.toFixed(1)} s
                  </Button>
                ) : (
                  <Button primary accent={ACCENT} onClick={startRecording} data-action="record">
                    <Circle size={12} fill="currentColor" /> Grabar (R)
                  </Button>
                )}
              </div>
            }
          />
          <div className="flex-1 flex min-h-0">
            {/* Izquierda: personaje, escena y ajustes */}
            <aside className="w-[280px] shrink-0 bg-[#202023] border-r border-black/50 overflow-y-auto" data-left>
              <Section title="Personaje">
                <div className="grid grid-cols-5 gap-1">
                  {CHARACTER_PRESETS.map((pr) => (
                    <button key={pr.name} type="button" onClick={() => setChar({ ...pr })} className={cx("rounded p-1 text-[10px] border", doc.character.name === pr.name ? "border-[#d6336c] bg-[#d6336c]/20" : "border-white/10 hover:bg-white/5")} data-preset={pr.name} title={pr.name}>
                      <PresetThumb c={pr} />
                      {pr.name}
                    </button>
                  ))}
                </div>
                <input value={doc.character.name} onChange={(e) => setChar({ name: e.target.value }, "name")} onKeyDown={(e) => e.stopPropagation()} className="bg-[#141416] rounded px-2 h-7 text-[12px]" />
                <Select value={doc.character.style} onChange={(v) => setChar({ style: v as Character["style"] })} options={[{ value: "coffee", label: "Taza de café" }, { value: "person", label: "Persona" }, { value: "robot", label: "Robot" }, { value: "cat", label: "Gato" }]} />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-[#9a9aa2]">
                  {(
                    [
                      ["skin", doc.character.style === "coffee" ? "Taza" : doc.character.style === "robot" ? "Metal" : doc.character.style === "cat" ? "Pelaje" : "Piel"],
                      ["hair", doc.character.style === "robot" ? "Antena" : "Pelo"],
                      ["eyes", "Ojos"],
                      ["shirt", doc.character.style === "coffee" ? "Franja" : "Ropa"],
                    ] as [keyof Character, string][]
                  ).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="color" value={String(doc.character[k])} onChange={(e) => setChar({ [k]: e.target.value } as Partial<Character>, `c-${k}`)} className="w-7 h-6 bg-transparent" />
                      {label}
                    </label>
                  ))}
                </div>
                {doc.character.style === "person" && <Select value={doc.character.hairStyle} onChange={(v) => setChar({ hairStyle: v as Character["hairStyle"] })} options={[{ value: "short", label: "Pelo corto" }, { value: "long", label: "Pelo largo" }, { value: "curly", label: "Pelo rizado" }, { value: "bun", label: "Moño" }, { value: "bald", label: "Sin pelo" }]} />}
                <Select value={doc.character.accessory} onChange={(v) => setChar({ accessory: v as Character["accessory"] })} options={[{ value: "none", label: "Sin accesorio" }, { value: "glasses", label: "Gafas" }, { value: "hat", label: "Sombrero" }, { value: "bow", label: "Lazo" }, { value: "headphones", label: "Auriculares" }, { value: "crown", label: "Corona" }]} />
                <Toggle checked={doc.character.cheeks} onChange={(v) => setChar({ cheeks: v })} label="Mejillas sonrosadas" accent={ACCENT} />
              </Section>
              <Section title="Escena">
                <div className="flex items-center gap-2 text-[11px] text-[#9a9aa2]">
                  <input type="color" value={doc.scene.background} onChange={(e) => setScene({ background: e.target.value, image: null }, "bg")} className="w-7 h-6 bg-transparent" />
                  <Toggle checked={doc.scene.gradient} onChange={(v) => setScene({ gradient: v })} label="Degradado" accent={ACCENT} />
                  {doc.scene.gradient && <input type="color" value={doc.scene.background2} onChange={(e) => setScene({ background2: e.target.value }, "bg2")} className="w-7 h-6 bg-transparent" />}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void importBackground()}>
                    <ImagePlus size={12} /> Imagen de fondo
                  </Button>
                  {doc.scene.image && <Button onClick={() => setScene({ image: null })}>Quitar</Button>}
                </div>
                <Select value={`${doc.scene.width}x${doc.scene.height}`} onChange={(v) => {
                  const [w, h] = v.split("x").map(Number);
                  setScene({ width: w, height: h });
                }} options={[{ value: "1920x1080", label: "Horizontal 16:9 (1920×1080)" }, { value: "1080x1920", label: "Vertical 9:16 (1080×1920)" }, { value: "1080x1080", label: "Cuadrado (1080×1080)" }, { value: "1280x720", label: "HD 720p" }]} />
                <Slider label="Tamaño del personaje" value={Math.round(doc.scene.scale * 100)} min={40} max={180} suffix="%" onChange={(v) => setScene({ scale: v / 100 }, "scale")} />
                <Slider label="Altura del suelo" value={Math.round(doc.scene.floor * 100)} min={50} max={100} suffix="%" onChange={(v) => setScene({ floor: v / 100 }, "floor")} />
              </Section>
              <Section title="Seguimiento" defaultOpen={false}>
                <Slider label="Suavizado" value={Math.round(doc.settings.smoothing * 100)} min={0} max={90} suffix="%" onChange={(v) => setSettings({ smoothing: v / 100 }, "smooth")} />
                <Slider label="Expresividad" value={Math.round(doc.settings.expressiveness * 100)} min={50} max={200} suffix="%" onChange={(v) => setSettings({ expressiveness: v / 100 }, "expr")} />
                <Toggle checked={doc.settings.lipSync} onChange={(v) => setSettings({ lipSync: v })} label="Boca con el micrófono" accent={ACCENT} />
                <Slider label="Sensibilidad del micrófono" value={Math.round(doc.settings.micGain * 100)} min={20} max={400} suffix="%" onChange={(v) => setSettings({ micGain: v / 100 }, "gain")} />
                <Toggle checked={doc.settings.mouseFollow} onChange={(v) => setSettings({ mouseFollow: v })} label="Sin cámara, mirar al ratón" accent={ACCENT} />
                <Toggle checked={doc.settings.autoBlink} onChange={(v) => setSettings({ autoBlink: v })} label="Sin cámara, parpadeo automático" accent={ACCENT} />
              </Section>
            </aside>
            {/* Centro */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 min-h-0 flex items-center justify-center p-4 relative" onPointerMove={onStageMove} onPointerLeave={() => (mouse.current = null)}>
                <canvas ref={canvasRef} className="max-w-full max-h-full rounded-lg shadow-2xl" style={{ aspectRatio: `${doc.scene.width} / ${doc.scene.height}` }} data-stage />
                {recording && (
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1 text-[12px]" data-rec>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b6b] animate-pulse" /> Grabando {elapsed.toFixed(1)} s
                  </div>
                )}
                {playingTake && (
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1 text-[12px]">
                    <Play size={12} /> Reproduciendo la toma · Esc para salir
                  </div>
                )}
              </div>
              <div className="h-14 shrink-0 border-t border-black/50 bg-[#1e1e21] flex items-center gap-1.5 px-3 overflow-x-auto" data-triggers>
                {TRIGGERS.map((t) => (
                  <button key={t.id} type="button" onClick={() => fire(t.id)} className="flex flex-col items-center px-2 py-1 rounded hover:bg-white/10 min-w-[64px]" title={`${t.label} (tecla ${t.key})`} data-trigger={t.id}>
                    <span className="text-[18px] leading-none">{t.emoji}</span>
                    <span className="text-[10px] text-[#9a9aa2]">
                      {t.key} · {t.label}
                    </span>
                  </button>
                ))}
                <span className="ml-auto text-[11px] text-[#6f6f77] whitespace-nowrap">← → moverse</span>
              </div>
            </div>
            {/* Derecha: entradas y tomas */}
            <aside className="w-[260px] shrink-0 bg-[#202023] border-l border-black/50 flex flex-col min-h-0" data-right>
              <Section title="Entradas">
                <div className="relative rounded overflow-hidden bg-black/60 aspect-[4/3] flex items-center justify-center">
                  {camOn ? <canvas ref={camPreview} width={240} height={180} className="w-full h-full" /> : <span className="text-[11px] text-[#6f6f77] px-3 text-center">Cámara apagada: el personaje mira al ratón</span>}
                  {camOn && <span className={cx("absolute bottom-1 left-1 text-[10px] rounded px-1.5", faceFound ? "bg-[#2b8a3e]" : "bg-[#c92a2a]")}>{faceFound ? "Cara detectada" : "Buscando la cara…"}</span>}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void toggleCamera()} disabled={camLoading} data-action="camera">
                    {camOn ? <CameraOff size={12} /> : <Camera size={12} />} {camLoading ? "Cargando…" : camOn ? "Apagar" : "Cámara"}
                  </Button>
                  <Button onClick={() => tracker.calibrate()} disabled={!camOn} title="Mira al frente y pulsa (C)">
                    <Crosshair size={12} /> Calibrar
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => void toggleMic()} data-action="mic">
                    {micOn ? <MicOff size={12} /> : <Mic size={12} />} {micOn ? "Apagar" : "Micrófono"}
                  </Button>
                  <div className="flex-1 h-2 bg-[#141416] rounded overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#51cf66] via-[#fcc419] to-[#ff6b6b]" style={{ width: `${level * 100}%` }} />
                  </div>
                </div>
              </Section>
              <div className="px-3 h-8 flex items-center border-y border-black/40 text-[11px] font-semibold uppercase tracking-wide text-[#a5a5ad]">Tomas ({doc.takes.length})</div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5" data-takes>
                {!doc.takes.length && <span className="text-[11px] text-[#6f6f77] p-1">Pulsa «Grabar» (R) para guardar tu actuación con la voz.</span>}
                {doc.takes.map((t) => (
                  <div key={t.id} className={cx("rounded p-2 bg-[#1b1b1f] text-[12px]", playingTake === t.id && "ring-1 ring-[#d6336c]")} data-take={t.name}>
                    <div className="flex items-center gap-1">
                      <span className="flex-1 truncate font-medium">{t.name}</span>
                      <button type="button" title="Cambiar nombre" onClick={async () => {
                        const n = await askText({ title: "Nombre de la toma", label: "Nombre", defaultValue: t.name });
                        if (n) apply({ ...cur(), takes: cur().takes.map((x) => (x.id === t.id ? { ...x, name: n } : x)) });
                      }} className="text-[#9a9aa2] hover:text-white">
                        <Pencil size={11} />
                      </button>
                      <button type="button" title="Borrar" onClick={() => apply({ ...cur(), takes: cur().takes.filter((x) => x.id !== t.id) })} className="text-[#9a9aa2] hover:text-white">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="text-[10px] text-[#7d7d85]">
                      {t.duration.toFixed(1)} s · {t.events.length} gestos · {t.audio ? "con voz" : "sin voz"}
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      <Button onClick={() => (playingTake === t.id ? stopPlayback() : playTake(t))}>{playingTake === t.id ? <Square size={11} /> : <Play size={11} />} {playingTake === t.id ? "Parar" : "Ver"}</Button>
                      <Button onClick={() => setExportTake(t)}>
                        <Download size={11} /> Exportar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
      {exportTake && <ExportDialog take={exportTake} onCancel={() => setExportTake(null)} onExport={(f, s) => void runExport(exportTake, f, s)} />}
      {exporting && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center" data-exporting>
          <div className="bg-[#26262b] rounded-xl px-6 py-5 w-[380px] shadow-2xl flex flex-col gap-3">
            <div className="text-sm font-semibold">Exportando…</div>
            <div className="h-2 bg-[#141416] rounded overflow-hidden">
              <div className="h-full" style={{ width: `${exporting.fraction * 100}%`, background: ACCENT }} />
            </div>
            <div className="text-[12px] text-[#9a9aa2]">{exporting.label}</div>
            <Button onClick={() => (cancelExport.current = true)}>Cancelar</Button>
          </div>
        </div>
      )}
      <CommandSearch isOpen={commandOpen} onClose={() => setCommandOpen(false)} menus={menus} />
      {sd.showStart && (
        <StartScreen
          appName="CoffeePuppet"
          tagline="Animación de personajes en tiempo real • CoffeeWorks"
          accent={ACCENT_DARK}
          newHint="Personaje nuevo listo para actuar con tu cámara"
          openHint="Abrir un personaje .cpup con sus tomas"
          formats={[".cpup"]}
          recents={sd.recents}
          onNew={() => void sd.newDocument()}
          onOpen={() => void sd.open()}
          onOpenRecent={(e) => void sd.openRecent(e)}
          onContinue={doc ? () => sd.setShowStart(false) : undefined}
          currentTitle={sd.title}
        />
      )}
      <DialogHost />
    </div>
  );
};

/** Miniatura dibujada del personaje predefinido. */
const PresetThumb: React.FC<{ c: Character }> = ({ c }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, cv.width, cv.height);
    const doc: PuppetDoc = { ...newPuppetDoc(), character: c, scene: { ...defaultScene(), width: 120, height: 120, gradient: false, background: "#2a2a2f", floor: 1.55, scale: 1.6 } };
    drawScene(g, doc, { ...NEUTRAL }, {}, 0);
  }, [c]);
  return <canvas ref={ref} width={120} height={120} className="w-full rounded" />;
};

const ExportDialog: React.FC<{ take: Take; onExport: (f: VideoFormat, scale: number) => void; onCancel: () => void }> = ({ take, onExport, onCancel }) => {
  const [format, setFormat] = useState<VideoFormat>(isTauri ? "mp4" : "webm");
  const [scale, setScale] = useState(1);
  const formats = (Object.keys(FORMAT_LABEL) as VideoFormat[]).filter((f) => f !== "png");
  return (
    <Modal title={`Exportar «${take.name}»`} onClose={onCancel} width={400} footer={<><Button onClick={onCancel}>Cancelar</Button><Button primary accent={ACCENT} onClick={() => onExport(format, scale)}>Exportar</Button></>}>
      <Select value={format} onChange={(v) => setFormat(v as VideoFormat)} options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))} data-name="format" />
      <Select value={String(scale)} onChange={(v) => setScale(Number(v))} options={[{ value: "1", label: "Tamaño completo" }, { value: "0.5", label: "Mitad" }]} />
      {needsFfmpeg(format) && !isTauri && <span className="text-[11px] text-[#ffa94d]">Este formato necesita la aplicación de escritorio con FFmpeg.</span>}
      <span className="text-[11px] text-[#8b8b93]">
        {take.duration.toFixed(1)} s a 30 fps {take.audio ? "· con la voz grabada" : ""}
      </span>
    </Modal>
  );
};
