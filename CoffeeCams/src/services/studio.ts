// Motor del estudio (grabar y transmitir): captura pantalla y cámara, compone
// la escena en un lienzo y mezcla micrófono y audio del sistema. La salida
// (video del lienzo + audio mezclado) se graba o se envía a la transmisión.

import type { Scene, StudioSource } from "../types";
import { Ticker } from "./media";

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

interface LiveSource {
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  image: HTMLImageElement | null;
}

interface AudioChannel {
  gain: GainNode;
  analyser: AnalyserNode;
  stream: MediaStream | null;
  node: MediaStreamAudioSourceNode | null;
  volume: number;
  muted: boolean;
}

export type ChannelId = "mic" | "system";

export class StudioEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scene: Scene | null = null;
  private live = new Map<string, LiveSource>();
  private ticker = new Ticker();
  private audio: AudioContext | null = null;
  private mix: MediaStreamAudioDestinationNode | null = null;
  private channels = new Map<ChannelId, AudioChannel>();
  private output: MediaStream | null = null;
  private holder: HTMLDivElement;
  private levelBuffer = new Float32Array(1024);
  fps = 30;
  /** Se llama cuando una captura termina sola (p. ej. el usuario deja de compartir). */
  onSourceEnded: ((id: string) => void) | null = null;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = DESIGN_W;
    this.canvas.height = DESIGN_H;
    this.ctx = this.canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    this.holder = document.createElement("div");
    this.holder.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(this.holder);
  }

  start(fps = 30) {
    this.fps = fps;
    this.ticker.start(1000 / fps, () => this.draw());
    this.draw();
  }

  /** Deja de componer (el estudio no se ve y no hay nada en curso). */
  pause() {
    this.ticker.stop();
  }

  /** Cambia la resolución de salida (720p o 1080p). */
  setHeight(height: 720 | 1080) {
    const width = height === 720 ? 1280 : 1920;
    if (this.canvas.width !== width) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  dispose() {
    this.ticker.stop();
    this.live.forEach((_, id) => this.deactivate(id));
    this.channels.forEach((c) => c.stream?.getTracks().forEach((t) => t.stop()));
    this.output?.getTracks().forEach((t) => t.stop());
    this.holder.remove();
    void this.audio?.close();
  }

  setScene(scene: Scene) {
    this.scene = scene;
    // Las imágenes se cargan solas; las capturas se activan a petición
    for (const source of scene.sources) {
      if (source.kind === "image" && source.src) {
        const current = this.live.get(source.id);
        if (!current?.image || current.image.src !== source.src) {
          const image = new Image();
          image.src = source.src;
          this.live.set(source.id, { stream: null, video: null, image });
        }
      }
    }
  }

  isActive(id: string) {
    return Boolean(this.live.get(id)?.stream || this.live.get(id)?.image);
  }

  // -------------------------------------------------------------------------
  // Audio
  // -------------------------------------------------------------------------

  private ensureAudio(): AudioContext {
    if (!this.audio) {
      this.audio = new AudioContext();
      this.mix = this.audio.createMediaStreamDestination();
      for (const id of ["mic", "system"] as ChannelId[]) {
        const gain = this.audio.createGain();
        const analyser = this.audio.createAnalyser();
        analyser.fftSize = 1024;
        gain.connect(analyser);
        gain.connect(this.mix);
        this.channels.set(id, { gain, analyser, stream: null, node: null, volume: 1, muted: false });
      }
    }
    if (this.audio.state === "suspended") void this.audio.resume();
    return this.audio;
  }

  private connectChannel(id: ChannelId, stream: MediaStream | null) {
    const audio = this.ensureAudio();
    const channel = this.channels.get(id) as AudioChannel;
    channel.node?.disconnect();
    if (id === "mic") channel.stream?.getTracks().forEach((t) => t.stop());
    channel.stream = stream;
    channel.node = stream && stream.getAudioTracks().length ? audio.createMediaStreamSource(stream) : null;
    channel.node?.connect(channel.gain);
  }

  async setMic(deviceId: string | null): Promise<void> {
    if (deviceId === null) {
      this.connectChannel("mic", null);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.connectChannel("mic", stream);
  }

  hasChannel(id: ChannelId) {
    return Boolean(this.channels.get(id)?.node);
  }

  setVolume(id: ChannelId, volume: number, muted: boolean) {
    this.ensureAudio();
    const channel = this.channels.get(id) as AudioChannel;
    channel.volume = volume;
    channel.muted = muted;
    channel.gain.gain.value = muted ? 0 : volume;
  }

  /** Nivel actual de un canal (0-1) para los vúmetros. */
  level(id: ChannelId): number {
    const channel = this.channels.get(id);
    if (!channel?.node) return 0;
    const buffer = this.levelBuffer;
    channel.analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    const rms = Math.sqrt(sum / buffer.length);
    const db = 20 * Math.log10(rms || 1e-6);
    return Math.max(0, Math.min(1, (db + 60) / 60));
  }

  // -------------------------------------------------------------------------
  // Fuentes de video
  // -------------------------------------------------------------------------

  private attachVideo(id: string, stream: MediaStream): HTMLVideoElement {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    this.holder.appendChild(video);
    void video.play().catch(() => undefined);
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      this.deactivate(id);
      this.onSourceEnded?.(id);
    });
    return video;
  }

  async activate(source: StudioSource): Promise<void> {
    this.ensureAudio();
    this.deactivate(source.id);
    if (source.kind === "screen") {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: this.fps, max: 60 } },
        audio: true,
      });
      const video = this.attachVideo(source.id, stream);
      this.live.set(source.id, { stream, video, image: null });
      // El audio del sistema (si se compartió) va a su propio canal
      if (stream.getAudioTracks().length) this.connectChannel("system", new MediaStream(stream.getAudioTracks()));
      return;
    }
    if (source.kind === "camera") {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: source.deviceId ? { exact: source.deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: this.fps },
        },
        audio: false,
      });
      const video = this.attachVideo(source.id, stream);
      this.live.set(source.id, { stream, video, image: null });
    }
  }

  deactivate(id: string) {
    const live = this.live.get(id);
    if (!live) return;
    if (live.stream) {
      // Si esta captura aportaba el audio del sistema, se retira
      const system = this.channels.get("system");
      if (system?.stream && live.stream.getAudioTracks().some((t) => system.stream?.getAudioTracks().includes(t))) {
        this.connectChannel("system", null);
      }
      live.stream.getTracks().forEach((t) => t.stop());
    }
    live.video?.remove();
    this.live.delete(id);
  }

  /** Tamaño real del video de una fuente activa (para ajustar proporciones). */
  sourceSize(id: string): { width: number; height: number } | null {
    const live = this.live.get(id);
    if (live?.video?.videoWidth) return { width: live.video.videoWidth, height: live.video.videoHeight };
    if (live?.image?.naturalWidth) return { width: live.image.naturalWidth, height: live.image.naturalHeight };
    return null;
  }

  // -------------------------------------------------------------------------
  // Composición
  // -------------------------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const k = W / DESIGN_W;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (!this.scene) return;
    // El primero de la lista queda encima (como en las apps de streaming)
    for (const source of [...this.scene.sources].reverse()) {
      if (!source.visible) continue;
      const x = source.x * k;
      const y = source.y * k;
      const w = source.w * k;
      const h = source.h * k;
      const live = this.live.get(source.id);
      ctx.save();
      if (source.round) {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.clip();
      }
      if ((source.kind === "screen" || source.kind === "camera") && live?.video && live.video.readyState >= 2) {
        const vw = live.video.videoWidth;
        const vh = live.video.videoHeight;
        // Pantalla: se ve entera; cámara: rellena el marco
        const scale = source.kind === "screen" ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        if (source.kind === "camera") {
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
        }
        ctx.drawImage(live.video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      } else if (source.kind === "image" && live?.image?.complete && live.image.naturalWidth) {
        ctx.drawImage(live.image, x, y, w, h);
      } else if (source.kind === "color") {
        ctx.fillStyle = source.color || "#26a680";
        ctx.fillRect(x, y, w, h);
      } else if (source.kind === "text" && source.text) {
        const size = (source.size || 64) * k;
        ctx.font = `700 ${size}px "Hanken Grotesk", "Segoe UI", sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(2, size * 0.09);
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        const lines = source.text.split("\n");
        lines.forEach((line, i) => {
          const ly = y + h / 2 + (i - (lines.length - 1) / 2) * size * 1.2;
          ctx.strokeText(line, x + w / 2, ly);
          ctx.fillStyle = source.color || "#ffffff";
          ctx.fillText(line, x + w / 2, ly);
        });
      }
      ctx.restore();
    }
  }

  /** Video del lienzo + audio mezclado: lo que se graba y se transmite. */
  outputStream(): MediaStream {
    if (!this.output) {
      this.ensureAudio();
      const video = this.canvas.captureStream(this.fps);
      this.output = new MediaStream([...video.getVideoTracks(), ...(this.mix as MediaStreamAudioDestinationNode).stream.getAudioTracks()]);
    }
    return this.output;
  }
}
