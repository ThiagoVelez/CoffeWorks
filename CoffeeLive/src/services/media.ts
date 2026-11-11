// Utilidades multimedia: analizar archivos, reloj en segundo plano y formatos
// de grabación.


// ---------------------------------------------------------------------------
// Reloj que sigue funcionando con la ventana minimizada
// ---------------------------------------------------------------------------

const TICKER_SOURCE = `let id=null;onmessage=(e)=>{if(id!==null)clearInterval(id);id=null;if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};`;

/**
 * Los temporizadores de la página se ralentizan cuando la ventana está oculta;
 * los de un Worker no. Se usa para grabar, transmitir y exportar.
 */
export class Ticker {
  private worker: Worker | null = null;
  private url: string | null = null;

  start(intervalMs: number, callback: () => void) {
    this.stop();
    this.url = URL.createObjectURL(new Blob([TICKER_SOURCE], { type: "text/javascript" }));
    this.worker = new Worker(this.url);
    this.worker.onmessage = callback;
    this.worker.postMessage(intervalMs);
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

/**
 * Mantiene la página activa mientras se graba o transmite (evita que el
 * sistema la suspenda con la ventana minimizada).
 */
export function holdAwake(): () => void {
  let release: () => void = () => undefined;
  const locks = (navigator as Navigator & { locks?: { request: (name: string, cb: () => Promise<void>) => Promise<void> } }).locks;
  if (locks) {
    const done = new Promise<void>((resolve) => (release = resolve));
    void locks.request("coffeecams-activo", () => done).catch(() => undefined);
  }
  return () => release();
}

// ---------------------------------------------------------------------------
// Formatos de grabación
// ---------------------------------------------------------------------------

export interface RecordingFormat {
  mime: string;
  extension: "mp4" | "webm";
  label: string;
}

const CANDIDATES: RecordingFormat[] = [
  { mime: "video/mp4;codecs=avc1.640028,mp4a.40.2", extension: "mp4", label: "MP4 (H.264 + AAC)" },
  { mime: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4", label: "MP4 (H.264 + AAC)" },
  { mime: "video/mp4;codecs=avc1,opus", extension: "mp4", label: "MP4 (H.264)" },
  { mime: "video/mp4", extension: "mp4", label: "MP4" },
  { mime: "video/webm;codecs=vp9,opus", extension: "webm", label: "WebM (VP9)" },
  { mime: "video/webm;codecs=vp8,opus", extension: "webm", label: "WebM (VP8)" },
  { mime: "video/webm", extension: "webm", label: "WebM" },
];

const supported = (mime: string) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime);

/** Mejor formato para guardar archivos (MP4 si el sistema lo permite). */
export function recordingFormat(prefer: "mp4" | "webm" = "mp4"): RecordingFormat | null {
  const ordered = prefer === "webm" ? [...CANDIDATES.filter((c) => c.extension === "webm"), ...CANDIDATES] : CANDIDATES;
  return ordered.find((c) => supported(c.mime)) || null;
}

export const canRecordMp4 = () => CANDIDATES.some((c) => c.extension === "mp4" && supported(c.mime));

/** Formato para enviar a ffmpeg durante la transmisión (contenedor por flujo). */
export function streamingMime(): string {
  return ["video/webm;codecs=h264,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(supported) || "video/webm";
}
