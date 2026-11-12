// Seguimiento de la cara con la cámara (MediaPipe Face Landmarker, incluido
// en la app: no necesita Internet) y del micrófono para mover la boca.

import { invoke } from "@tauri-apps/api/core";
import { readFileBytes, isTauri } from "./studio/desktop";
import { ensureAddon } from "./studio/addons";
import type { Rig } from "./types";

type Landmarker = {
  detectForVideo: (v: HTMLVideoElement, ts: number) => {
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
    facialTransformationMatrixes?: { data: number[] }[];
  };
  close: () => void;
};

export class FaceTracker {
  private landmarker: Landmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private lastTs = -1;
  /** Postura neutra (calibración). */
  neutral = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0 };
  last: { yaw: number; pitch: number; roll: number; x: number; y: number } | null = null;
  found = false;

  get videoElement() {
    return this.video;
  }

  async start(): Promise<void> {
    const vision = await import("@mediapipe/tasks-vision");
    const base = new URL("mediapipe", document.baseURI).href.replace(/\/$/, "");
    let files: Awaited<ReturnType<typeof vision.FilesetResolver.forVisionTasks>>;
    if ((await vision.FilesetResolver.isSimdSupported()) || import.meta.env.DEV) files = await vision.FilesetResolver.forVisionTasks(base);
    else files = await compatFileset();
    const opts = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: new URL("models/face_landmarker.task", document.baseURI).href, delegate },
      runningMode: "VIDEO" as const,
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    try {
      this.landmarker = (await vision.FaceLandmarker.createFromOptions(files, opts("GPU"))) as unknown as Landmarker;
    } catch {
      this.landmarker = (await vision.FaceLandmarker.createFromOptions(files, opts("CPU"))) as unknown as Landmarker;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.srcObject = this.stream;
    await v.play();
    this.video = v;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.found = false;
  }

  get running() {
    return !!this.landmarker && !!this.video;
  }

  calibrate() {
    if (this.last) this.neutral = { ...this.last };
  }

  /** Lee la cara y devuelve los parámetros (o null si no hay cara). */
  read(expressiveness: number): Partial<Rig> | null {
    const v = this.video;
    if (!this.landmarker || !v || v.readyState < 2) return null;
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const res = this.landmarker.detectForVideo(v, ts);
    const bs = res.faceBlendshapes?.[0]?.categories;
    const m = res.facialTransformationMatrixes?.[0]?.data;
    if (!bs || !m) {
      this.found = false;
      return null;
    }
    this.found = true;
    const s: Record<string, number> = {};
    for (const c of bs) s[c.categoryName] = c.score;
    // Matriz 4×4 en orden de columnas
    const yaw = Math.asin(Math.max(-1, Math.min(1, -m[2])));
    const pitch = Math.atan2(m[6], m[10]);
    const roll = Math.atan2(m[1], m[0]);
    const pose = { yaw, pitch, roll, x: m[12], y: m[13] };
    this.last = pose;
    const n = this.neutral;
    const e = expressiveness;
    const amp = (v: number) => Math.max(0, Math.min(1, v));
    // Vista en espejo: lo que haces con tu lado derecho se ve a la derecha
    return {
      turn: Math.max(-1, Math.min(1, -(yaw - n.yaw) * 2.2)),
      nod: Math.max(-1, Math.min(1, (pitch - n.pitch) * 2.5)),
      tilt: Math.max(-35, Math.min(35, (-(roll - n.roll) * 180) / Math.PI)),
      headX: Math.max(-1, Math.min(1, -(pose.x - n.x) / 12)),
      headY: Math.max(-1, Math.min(1, -(pose.y - n.y) / 10)),
      eyeL: amp(1 - (s.eyeBlinkLeft || 0) * 1.35 * e + (s.eyeWideLeft || 0) * 0.4),
      eyeR: amp(1 - (s.eyeBlinkRight || 0) * 1.35 * e + (s.eyeWideRight || 0) * 0.4),
      lookX: Math.max(-1, Math.min(1, ((s.eyeLookOutLeft || 0) - (s.eyeLookInLeft || 0) + (s.eyeLookInRight || 0) - (s.eyeLookOutRight || 0)) * -1.2)),
      lookY: Math.max(-1, Math.min(1, ((s.eyeLookDownLeft || 0) + (s.eyeLookDownRight || 0) - (s.eyeLookUpLeft || 0) - (s.eyeLookUpRight || 0)) * 0.9)),
      browL: Math.max(-1, Math.min(1, ((s.browOuterUpLeft || 0) * 0.8 + (s.browInnerUp || 0) * 0.6 - (s.browDownLeft || 0) * 1.2) * e)),
      browR: Math.max(-1, Math.min(1, ((s.browOuterUpRight || 0) * 0.8 + (s.browInnerUp || 0) * 0.6 - (s.browDownRight || 0) * 1.2) * e)),
      mouthOpen: amp(((s.jawOpen || 0) * 1.5 + (s.mouthFunnel || 0) * 0.3) * e),
      smile: Math.max(-1, Math.min(1, (((s.mouthSmileLeft || 0) + (s.mouthSmileRight || 0)) / 2 - ((s.mouthFrownLeft || 0) + (s.mouthFrownRight || 0)) / 2) * 1.4 * e + 0.1)),
    };
  }
}

/**
 * Motor para procesadores sin SIMD: viene en el complemento
 * «Compatibilidad para equipos antiguos» y se carga desde su carpeta.
 */
async function compatFileset(): Promise<{ wasmLoaderPath: string; wasmBinaryPath: string }> {
  const fail = () => new Error("Este equipo necesita el complemento «Compatibilidad para equipos antiguos» para el seguimiento facial. Sin cámara, el personaje sigue el ratón y la voz.");
  if (!isTauri || !(await ensureAddon("puppetcompat", "CoffeePuppet"))) throw fail();
  const dir = await invoke<string | null>("core_addon_dir", { id: "puppetcompat" });
  if (!dir) throw fail();
  const sep = dir.includes("\\") ? "\\" : "/";
  const url = async (name: string, type: string) => URL.createObjectURL(new Blob([(await readFileBytes(`${dir}${sep}${name}`)) as BlobPart], { type }));
  return {
    wasmLoaderPath: await url("vision_wasm_nosimd_internal.js", "text/javascript"),
    wasmBinaryPath: await url("vision_wasm_nosimd_internal.wasm", "application/wasm"),
  };
}

/** Nivel del micrófono para mover la boca. */
export class MicLevel {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data = new Float32Array(1024);
  stream: MediaStream | null = null;

  async start(): Promise<MediaStream> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);
    return this.stream;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
  }

  get running() {
    return !!this.analyser;
  }

  /** 0..1 */
  level(gain: number): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.data);
    let sum = 0;
    for (const v of this.data) sum += v * v;
    const rms = Math.sqrt(sum / this.data.length);
    return Math.max(0, Math.min(1, (rms - 0.012) * 9 * gain));
  }
}
