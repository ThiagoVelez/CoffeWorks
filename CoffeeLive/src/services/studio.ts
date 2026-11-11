// Motor de CoffeeLive: captura fuentes (pantalla, cámara, imágenes, videos,
// textos), compone las escenas con sus filtros en un lienzo, hace las
// transiciones entre escenas y mezcla el audio. La salida (video + audio) es
// lo que se graba y se transmite.

import type { Scene, StudioSource, TransitionKind } from "../types";
import { Ticker } from "./media";

interface LiveSource {
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  image: HTMLImageElement | null;
  images: HTMLImageElement[];
  url: string | null;
}

export interface Channel {
  id: string;
  label: string;
  kind: "mic" | "desktop" | "media";
  volume: number; // 0-2
  muted: boolean;
  monitor: boolean;
}

interface ChannelNodes extends Channel {
  input: GainNode; // entrada (ganancia previa)
  compressor: DynamicsCompressorNode;
  gate: GainNode;
  output: GainNode; // volumen y silencio
  analyser: AnalyserNode;
  preAnalyser: AnalyserNode;
  sources: Map<string, AudioNode>;
  gateOpenUntil: number;
}

export interface Stats {
  fps: number;
  renderMs: number;
  dropped: number;
  frames: number;
}

interface TransitionState {
  from: string;
  to: string;
  start: number;
  duration: number;
  kind: TransitionKind;
}

const CHROMA_MAX = 960; // ancho máximo para el croma (rendimiento)

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x00ff00;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toCbCr = (r: number, g: number, b: number): [number, number] => [
  128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
  128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
];

export class LiveEngine {
  readonly program: HTMLCanvasElement;
  readonly preview: HTMLCanvasElement;
  private output: HTMLCanvasElement;
  private pctx: CanvasRenderingContext2D;
  private vctx: CanvasRenderingContext2D;
  private octx: CanvasRenderingContext2D;
  private bufferA: HTMLCanvasElement;
  private bufferB: HTMLCanvasElement;
  private chroma: HTMLCanvasElement;
  private scenes: Scene[] = [];
  programId = "";
  previewId = "";
  studioMode = false;
  private transition: TransitionState | null = null;
  private live = new Map<string, LiveSource>();
  private ticker = new Ticker();
  private holder: HTMLDivElement;
  private audio: AudioContext | null = null;
  private mix: MediaStreamAudioDestinationNode | null = null;
  private channels = new Map<string, ChannelNodes>();
  private micStream: MediaStream | null = null;
  private outStream: MediaStream | null = null;
  private levelBuffer = new Float32Array(1024);
  private lastTick = 0;
  private frameCount = 0;
  private fpsWindowStart = 0;
  sampleRate = 48000;
  fps = 30;
  pushToTalk = false;
  private pttPressed = false;
  gate = { enabled: false, thresholdDb: -45 };
  stats: Stats = { fps: 0, renderMs: 0, dropped: 0, frames: 0 };
  onSourceEnded: ((id: string) => void) | null = null;
  onChannelsChanged: (() => void) | null = null;
  onTransitionEnd: (() => void) | null = null;

  constructor() {
    const make = (alpha = false) => {
      const c = document.createElement("canvas");
      c.width = 1920;
      c.height = 1080;
      return [c, c.getContext("2d", { alpha }) as CanvasRenderingContext2D] as const;
    };
    [this.program, this.pctx] = make();
    [this.preview, this.vctx] = make();
    [this.output, this.octx] = make();
    this.bufferA = make()[0];
    this.bufferB = make()[0];
    this.chroma = document.createElement("canvas");
    this.holder = document.createElement("div");
    this.holder.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(this.holder);
  }

  // -------------------------------------------------------------------------
  // Configuración
  // -------------------------------------------------------------------------

  setResolution(baseW: number, baseH: number, outW: number, outH: number) {
    for (const c of [this.program, this.preview, this.bufferA, this.bufferB]) {
      if (c.width !== baseW || c.height !== baseH) {
        c.width = baseW;
        c.height = baseH;
      }
    }
    const w = Math.round(outW / 2) * 2;
    const h = Math.round(outH / 2) * 2;
    if (this.output.width !== w || this.output.height !== h) {
      this.output.width = w;
      this.output.height = h;
    }
  }

  setScenes(scenes: Scene[]) {
    this.scenes = scenes;
    if (!scenes.some((s) => s.id === this.programId)) this.programId = scenes[0]?.id || "";
    if (!scenes.some((s) => s.id === this.previewId)) this.previewId = this.programId;
    // Las imágenes y presentaciones se cargan solas
    for (const scene of scenes) {
      for (const source of scene.sources) {
        if (source.kind === "image" && source.src) {
          const current = this.live.get(source.id);
          if (current?.image?.src !== source.src) {
            const image = new Image();
            image.src = source.src;
            this.live.set(source.id, { stream: null, video: null, image, images: [], url: null });
          }
        }
        if (source.kind === "slideshow") {
          const srcs = source.srcs || [];
          const current = this.live.get(source.id);
          if (!current || current.images.map((i) => i.src).join("|") !== srcs.join("|")) {
            const images = srcs.map((src) => {
              const image = new Image();
              image.src = src;
              return image;
            });
            this.live.set(source.id, { stream: null, video: null, image: null, images, url: null });
          }
        }
      }
    }
  }

  start(fps: number) {
    this.fps = fps;
    this.lastTick = performance.now();
    this.fpsWindowStart = this.lastTick;
    this.ticker.start(1000 / fps, () => this.tick());
  }

  pause() {
    this.ticker.stop();
  }

  dispose() {
    this.ticker.stop();
    [...this.live.keys()].forEach((id) => this.deactivate(id));
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.outStream?.getTracks().forEach((t) => t.stop());
    this.holder.remove();
    void this.audio?.close();
  }

  // -------------------------------------------------------------------------
  // Escenas y transiciones
  // -------------------------------------------------------------------------

  /** Pasa una escena al programa (lo que se emite) con la transición elegida. */
  transitionTo(sceneId: string, kind: TransitionKind, durationMs: number) {
    if (sceneId === this.programId) return;
    if (kind === "cut" || durationMs <= 0) {
      this.programId = sceneId;
      this.transition = null;
      this.onTransitionEnd?.();
      return;
    }
    this.transition = { from: this.programId, to: sceneId, start: performance.now(), duration: durationMs, kind };
    this.programId = sceneId;
  }

  get transitioning() {
    return this.transition !== null;
  }

  // -------------------------------------------------------------------------
  // Audio
  // -------------------------------------------------------------------------

  private ensureAudio(): AudioContext {
    if (!this.audio) {
      try {
        this.audio = new AudioContext({ sampleRate: this.sampleRate });
      } catch {
        this.audio = new AudioContext();
      }
      this.mix = this.audio.createMediaStreamDestination();
      this.mix.channelCount = 2;
    }
    if (this.audio.state === "suspended") void this.audio.resume();
    return this.audio;
  }

  private channel(id: string, label: string, kind: Channel["kind"]): ChannelNodes {
    const existing = this.channels.get(id);
    if (existing) return existing;
    const audio = this.ensureAudio();
    const input = audio.createGain();
    const preAnalyser = audio.createAnalyser();
    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 4;
    const gate = audio.createGain();
    const output = audio.createGain();
    const analyser = audio.createAnalyser();
    preAnalyser.fftSize = 1024;
    analyser.fftSize = 1024;
    input.connect(preAnalyser);
    input.connect(gate);
    gate.connect(output);
    output.connect(analyser);
    output.connect(this.mix as MediaStreamAudioDestinationNode);
    const nodes: ChannelNodes = {
      id,
      label,
      kind,
      volume: 1,
      muted: false,
      monitor: false,
      input,
      compressor,
      gate,
      output,
      analyser,
      preAnalyser,
      sources: new Map(),
      gateOpenUntil: 0,
    };
    this.channels.set(id, nodes);
    this.onChannelsChanged?.();
    return nodes;
  }

  private dropChannel(id: string) {
    const ch = this.channels.get(id);
    if (!ch) return;
    ch.sources.forEach((node) => node.disconnect());
    ch.output.disconnect();
    this.channels.delete(id);
    this.onChannelsChanged?.();
  }

  channelList(): Channel[] {
    return [...this.channels.values()].map(({ id, label, kind, volume, muted, monitor }) => ({ id, label, kind, volume, muted, monitor }));
  }

  setChannel(id: string, patch: Partial<Pick<Channel, "volume" | "muted" | "monitor">>) {
    const ch = this.channels.get(id);
    if (!ch) return;
    Object.assign(ch, patch);
    this.applyVolume(ch);
    if (patch.monitor !== undefined && this.audio) {
      try {
        if (patch.monitor) ch.output.connect(this.audio.destination);
        else ch.output.disconnect(this.audio.destination);
      } catch {
        // Ya estaba (des)conectado
      }
    }
  }

  private applyVolume(ch: ChannelNodes) {
    const pttMute = ch.kind === "mic" && this.pushToTalk && !this.pttPressed;
    ch.output.gain.value = ch.muted || pttMute ? 0 : ch.volume;
  }

  setPushToTalk(enabled: boolean) {
    this.pushToTalk = enabled;
    this.channels.forEach((ch) => this.applyVolume(ch));
  }

  setPushToTalkPressed(pressed: boolean) {
    this.pttPressed = pressed;
    this.channels.forEach((ch) => this.applyVolume(ch));
  }

  /** Filtros del micrófono: ganancia, compresor y puerta de ruido. */
  setMicFilters(gainDb: number, compressor: boolean, gate: boolean, thresholdDb: number) {
    this.gate = { enabled: gate, thresholdDb };
    const ch = this.channels.get("mic");
    if (!ch) return;
    ch.input.gain.value = Math.pow(10, gainDb / 20);
    // Se rehace la cadena: entrada → (compresor) → puerta → volumen
    ch.input.disconnect();
    ch.compressor.disconnect();
    ch.input.connect(ch.preAnalyser);
    if (compressor) {
      ch.input.connect(ch.compressor);
      ch.compressor.connect(ch.gate);
    } else {
      ch.input.connect(ch.gate);
    }
    if (!gate) ch.gate.gain.value = 1;
  }

  async setMic(
    deviceId: string | null,
    constraints: { echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean; channels: number }
  ): Promise<void> {
    const ch = this.channels.get("mic");
    ch?.sources.forEach((node) => node.disconnect());
    ch?.sources.clear();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    if (deviceId === null) {
      this.dropChannel("mic");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: constraints.echoCancellation,
        noiseSuppression: constraints.noiseSuppression,
        autoGainControl: constraints.autoGainControl,
        channelCount: constraints.channels,
      },
    });
    this.micStream = stream;
    const audio = this.ensureAudio();
    const channel = this.channel("mic", "Micrófono", "mic");
    const node = audio.createMediaStreamSource(stream);
    node.connect(channel.input);
    channel.sources.set("mic", node);
  }

  /** Nivel actual de un canal (0-1) para los vúmetros. */
  level(id: string): number {
    const ch = this.channels.get(id);
    if (!ch || ch.sources.size === 0) return 0;
    return this.measure(ch.analyser);
  }

  private measure(analyser: AnalyserNode): number {
    analyser.getFloatTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (let i = 0; i < this.levelBuffer.length; i++) sum += this.levelBuffer[i] * this.levelBuffer[i];
    const db = 20 * Math.log10(Math.sqrt(sum / this.levelBuffer.length) || 1e-6);
    return Math.max(0, Math.min(1, (db + 60) / 60));
  }

  private updateGate(now: number) {
    const ch = this.channels.get("mic");
    if (!ch || !this.gate.enabled) return;
    const level = this.measure(ch.preAnalyser) * 60 - 60; // dB aproximados
    if (level > this.gate.thresholdDb) ch.gateOpenUntil = now + 200;
    const target = now < ch.gateOpenUntil ? 1 : 0;
    ch.gate.gain.setTargetAtTime(target, (this.audio as AudioContext).currentTime, target ? 0.01 : 0.08);
  }

  // -------------------------------------------------------------------------
  // Fuentes
  // -------------------------------------------------------------------------

  isActive(id: string) {
    const live = this.live.get(id);
    return Boolean(live?.stream || live?.video || live?.image || live?.images.length);
  }

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

  async activate(source: StudioSource, options: { desktopAudio: boolean; mediaUrl?: string | null }): Promise<void> {
    this.ensureAudio();
    this.deactivate(source.id);
    if (source.kind === "screen") {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: this.fps, max: 60 } },
        audio: options.desktopAudio,
      });
      const video = this.attachVideo(source.id, stream);
      this.live.set(source.id, { stream, video, image: null, images: [], url: null });
      if (stream.getAudioTracks().length) {
        const audio = this.ensureAudio();
        const channel = this.channel("desktop", "Audio del escritorio", "desktop");
        const node = audio.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        node.connect(channel.input);
        channel.sources.set(source.id, node);
      }
      return;
    }
    if (source.kind === "camera") {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: source.deviceId ? { exact: source.deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: this.fps },
        },
        audio: false,
      });
      const video = this.attachVideo(source.id, stream);
      this.live.set(source.id, { stream, video, image: null, images: [], url: null });
      return;
    }
    if (source.kind === "media" && options.mediaUrl) {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.loop = source.loop !== false;
      video.playsInline = true;
      video.src = options.mediaUrl;
      this.holder.appendChild(video);
      await video.play().catch(() => undefined);
      this.live.set(source.id, { stream: null, video, image: null, images: [], url: options.mediaUrl });
      try {
        const audio = this.ensureAudio();
        const channel = this.channel(`media:${source.id}`, source.name, "media");
        const node = audio.createMediaElementSource(video);
        node.connect(channel.input);
        channel.sources.set(source.id, node);
      } catch {
        // Sin audio
      }
    }
  }

  deactivate(id: string) {
    const live = this.live.get(id);
    if (!live) return;
    live.stream?.getTracks().forEach((t) => t.stop());
    if (live.video) {
      live.video.pause();
      live.video.srcObject = null;
      live.video.removeAttribute("src");
      live.video.remove();
    }
    const desktop = this.channels.get("desktop");
    const node = desktop?.sources.get(id);
    if (desktop && node) {
      node.disconnect();
      desktop.sources.delete(id);
      if (desktop.sources.size === 0) this.dropChannel("desktop");
    }
    this.dropChannel(`media:${id}`);
    this.live.delete(id);
  }

  sourceSize(id: string): { width: number; height: number } | null {
    const live = this.live.get(id);
    if (live?.video?.videoWidth) return { width: live.video.videoWidth, height: live.video.videoHeight };
    if (live?.image?.naturalWidth) return { width: live.image.naturalWidth, height: live.image.naturalHeight };
    return null;
  }

  // -------------------------------------------------------------------------
  // Composición
  // -------------------------------------------------------------------------

  private tick() {
    const now = performance.now();
    const expected = 1000 / this.fps;
    const elapsed = now - this.lastTick;
    if (this.stats.frames > 0 && elapsed > expected * 1.6) this.stats.dropped += Math.round(elapsed / expected) - 1;
    this.lastTick = now;
    this.updateGate(now);
    const t0 = performance.now();
    this.render(now);
    this.stats.renderMs = this.stats.renderMs * 0.9 + (performance.now() - t0) * 0.1;
    this.stats.frames++;
    this.frameCount++;
    if (now - this.fpsWindowStart >= 1000) {
      this.stats.fps = (this.frameCount * 1000) / (now - this.fpsWindowStart);
      this.frameCount = 0;
      this.fpsWindowStart = now;
    }
  }

  render(now = performance.now()) {
    const W = this.program.width;
    const H = this.program.height;
    const t = this.transition;
    if (t) {
      const p = Math.min(1, (now - t.start) / t.duration);
      const a = this.bufferA.getContext("2d") as CanvasRenderingContext2D;
      const b = this.bufferB.getContext("2d") as CanvasRenderingContext2D;
      this.drawScene(a, this.scene(t.from), now);
      this.drawScene(b, this.scene(t.to), now);
      const ctx = this.pctx;
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      if (t.kind === "fade") {
        ctx.drawImage(this.bufferA, 0, 0);
        ctx.globalAlpha = ease;
        ctx.drawImage(this.bufferB, 0, 0);
      } else if (t.kind === "slide") {
        ctx.drawImage(this.bufferA, -ease * W, 0);
        ctx.drawImage(this.bufferB, (1 - ease) * W, 0);
      } else if (t.kind === "swipe") {
        ctx.drawImage(this.bufferA, 0, 0);
        ctx.drawImage(this.bufferB, (1 - ease) * W, 0);
      } else {
        // zoom: la escena anterior se acerca y se desvanece
        const s = 1 + ease * 0.5;
        ctx.globalAlpha = 1 - ease;
        ctx.drawImage(this.bufferA, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s);
        ctx.globalAlpha = ease;
        ctx.drawImage(this.bufferB, 0, 0);
      }
      ctx.restore();
      if (p >= 1) {
        this.transition = null;
        this.onTransitionEnd?.();
      }
    } else {
      this.drawScene(this.pctx, this.scene(this.programId), now);
    }
    if (this.studioMode) this.drawScene(this.vctx, this.scene(this.previewId), now);
    if (this.output.width !== W || this.output.height !== H) {
      this.octx.imageSmoothingQuality = "high";
      this.octx.drawImage(this.program, 0, 0, this.output.width, this.output.height);
    }
  }

  private scene(id: string): Scene | undefined {
    return this.scenes.find((s) => s.id === id);
  }

  private drawScene(ctx: CanvasRenderingContext2D, scene: Scene | undefined, now: number) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (!scene) return;
    // El primero de la lista queda encima
    for (let i = scene.sources.length - 1; i >= 0; i--) {
      const source = scene.sources[i];
      if (source.visible) this.drawSource(ctx, source, now);
    }
  }

  private drawSource(ctx: CanvasRenderingContext2D, source: StudioSource, now: number) {
    const { x, y, w, h } = source;
    if (w <= 0 || h <= 0) return;
    const f = source.filters;
    const live = this.live.get(source.id);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (source.rotation) ctx.rotate((source.rotation * Math.PI) / 180);
    if (source.flipH || source.flipV) ctx.scale(source.flipH ? -1 : 1, source.flipV ? -1 : 1);
    // Recorte de la forma (círculo o esquinas redondeadas)
    if (source.round) {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.beginPath();
      if (source.radius > 0) ctx.roundRect(-w / 2, -h / 2, w, h, source.radius);
      else ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, f.opacity / 100));
    const filter = [
      f.brightness !== 100 ? `brightness(${f.brightness}%)` : "",
      f.contrast !== 100 ? `contrast(${f.contrast}%)` : "",
      f.saturation !== 100 ? `saturate(${f.saturation}%)` : "",
      f.hue ? `hue-rotate(${f.hue}deg)` : "",
      f.blur ? `blur(${f.blur}px)` : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (filter) ctx.filter = filter;

    let el: CanvasImageSource | null = null;
    let nw = 0;
    let nh = 0;
    if (live?.video && live.video.readyState >= 2) {
      el = live.video;
      nw = live.video.videoWidth;
      nh = live.video.videoHeight;
    } else if (live?.image?.complete && live.image.naturalWidth) {
      el = live.image;
      nw = live.image.naturalWidth;
      nh = live.image.naturalHeight;
    } else if (source.kind === "slideshow" && live?.images.length) {
      const index = Math.floor(now / 1000 / Math.max(1, source.interval || 5)) % live.images.length;
      const img = live.images[index];
      if (img.complete && img.naturalWidth) {
        el = img;
        nw = img.naturalWidth;
        nh = img.naturalHeight;
      }
    }

    if (el && nw && nh) {
      const sx = Math.min(nw - 1, Math.max(0, f.crop.left));
      const sy = Math.min(nh - 1, Math.max(0, f.crop.top));
      const sw = Math.max(1, nw - sx - Math.max(0, f.crop.right));
      const sh = Math.max(1, nh - sy - Math.max(0, f.crop.bottom));
      let dw = w;
      let dh = h;
      if (source.fit === "contain" || source.fit === "cover") {
        const scale = source.fit === "contain" ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
        dw = sw * scale;
        dh = sh * scale;
      }
      if (f.chroma.enabled) {
        const keyed = this.keyed(el, sx, sy, sw, sh, dw, dh, f.chroma);
        ctx.drawImage(keyed, 0, 0, keyed.width, keyed.height, -dw / 2, -dh / 2, dw, dh);
      } else {
        ctx.drawImage(el, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
      }
    } else if (source.kind === "color") {
      ctx.fillStyle = source.color || "#000";
      ctx.fillRect(-w / 2, -h / 2, w, h);
    } else if (source.kind === "text" && source.text) {
      this.drawText(ctx, source, w, h);
    }
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D, s: StudioSource, w: number, h: number) {
    const size = s.size || 64;
    ctx.font = `${s.bold === false ? 400 : 700} ${size}px "${s.font || "Hanken Grotesk"}", "Segoe UI", sans-serif`;
    ctx.textBaseline = "middle";
    const align = s.align || "center";
    ctx.textAlign = align;
    if (s.background) {
      ctx.fillStyle = s.background;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    const lines = s.text?.split("\n") || [];
    const ax = align === "center" ? 0 : align === "left" ? -w / 2 + size * 0.3 : w / 2 - size * 0.3;
    lines.forEach((line, i) => {
      const ly = (i - (lines.length - 1) / 2) * size * 1.2;
      if (s.outline !== false) {
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(2, size * 0.09);
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line, ax, ly);
      }
      ctx.fillStyle = s.color || "#fff";
      ctx.fillText(line, ax, ly);
    });
  }

  /** Quita el color de fondo (pantalla verde o azul). */
  private keyed(
    el: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dw: number,
    dh: number,
    chroma: StudioSource["filters"]["chroma"]
  ): HTMLCanvasElement {
    const scale = Math.min(1, CHROMA_MAX / dw);
    const cw = Math.max(1, Math.round(dw * scale));
    const ch = Math.max(1, Math.round(dh * scale));
    if (this.chroma.width !== cw || this.chroma.height !== ch) {
      this.chroma.width = cw;
      this.chroma.height = ch;
    }
    const ctx = this.chroma.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(el, sx, sy, sw, sh, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch);
    const px = data.data;
    const [kr, kg, kb] = hexToRgb(chroma.color);
    const [kcb, kcr] = toCbCr(kr, kg, kb);
    const similarity = (chroma.similarity / 100) * 120;
    const smooth = Math.max(1, (chroma.smoothness / 100) * 80);
    for (let i = 0; i < px.length; i += 4) {
      const [cb, cr] = toCbCr(px[i], px[i + 1], px[i + 2]);
      const dist = Math.hypot(cb - kcb, cr - kcr);
      if (dist < similarity) {
        px[i + 3] = 0;
      } else if (dist < similarity + smooth) {
        px[i + 3] = Math.round(((dist - similarity) / smooth) * px[i + 3]);
        // Reduce el reflejo del color de fondo en los bordes
        if (kg > kr && kg > kb) px[i + 1] = Math.min(px[i + 1], Math.max(px[i], px[i + 2]));
        else if (kb > kr && kb > kg) px[i + 2] = Math.min(px[i + 2], Math.max(px[i], px[i + 1]));
      }
    }
    ctx.putImageData(data, 0, 0);
    return this.chroma;
  }

  /** Video de la salida + audio mezclado: lo que se graba y se transmite. */
  outputStream(): MediaStream {
    if (!this.outStream) {
      this.ensureAudio();
      const scaled = this.output.width !== this.program.width || this.output.height !== this.program.height;
      const video = (scaled ? this.output : this.program).captureStream(this.fps);
      this.outStream = new MediaStream([...video.getVideoTracks(), ...(this.mix as MediaStreamAudioDestinationNode).stream.getAudioTracks()]);
    }
    return this.outStream;
  }

  /** Descarta la salida para que se vuelva a crear con la resolución nueva. */
  resetOutput() {
    this.outStream?.getVideoTracks().forEach((t) => t.stop());
    this.outStream = null;
  }

  /** Captura PNG del programa. */
  screenshot(): Promise<Blob | null> {
    return new Promise((resolve) => this.program.toBlob((blob) => resolve(blob), "image/png"));
  }
}
