// Complemento «IA generativa»: relleno generativo y generar imagen con un
// servicio compatible con la API de imágenes de OpenAI (/images/edits y
// /images/generations). La clave la pone el usuario y solo se guarda en este
// equipo.

import { ctx2d, newCanvas } from "./pixels";
import { dataUrlToCanvas } from "./io";

export const ADDON_ID = "aigen";

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const KEY = "coffeephoto_ai";

export function loadAiSettings(): AiSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { baseUrl: raw.baseUrl || "https://api.openai.com/v1", apiKey: raw.apiKey || "", model: raw.model || "gpt-image-1" };
  } catch {
    return { baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-image-1" };
  }
}

export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento */
  }
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/png"));

async function readImage(json: { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } }): Promise<HTMLCanvasElement> {
  const item = json.data?.[0];
  if (!item) throw new Error(json.error?.message || "El servicio no devolvió ninguna imagen.");
  return dataUrlToCanvas(item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url!);
}

async function call(s: AiSettings, path: string, body: FormData | string): Promise<HTMLCanvasElement> {
  if (!s.apiKey) throw new Error("Falta la clave de API. Configúrala en Edición › Configurar IA generativa.");
  const res = await fetch(`${s.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.apiKey}`, ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}) },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `El servicio respondió con el error ${res.status}.`);
  return readImage(json);
}

/**
 * Relleno generativo: rellena la selección según la descripción. Devuelve un
 * lienzo del tamaño del documento con el resultado dentro de la selección.
 */
export async function generativeFill(s: AiSettings, image: HTMLCanvasElement, selection: HTMLCanvasElement, bounds: { x: number; y: number; w: number; h: number }, prompt: string): Promise<HTMLCanvasElement> {
  const W = image.width;
  const H = image.height;
  // Recorte cuadrado con contexto alrededor de la selección
  const side = Math.min(Math.max(W, H), Math.max(256, Math.round(Math.max(bounds.w, bounds.h) * 1.6)));
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const sx = Math.round(Math.min(Math.max(0, cx - side / 2), Math.max(0, W - side)));
  const sy = Math.round(Math.min(Math.max(0, cy - side / 2), Math.max(0, H - side)));
  const sw = Math.min(side, W);
  const sh = Math.min(side, H);
  const N = 1024;
  const crop = newCanvas(N, N);
  ctx2d(crop).drawImage(image, sx, sy, sw, sh, 0, 0, N, N);
  // Máscara: transparente donde hay que generar
  const mask = newCanvas(N, N);
  const mg = ctx2d(mask);
  mg.fillStyle = "#000";
  mg.fillRect(0, 0, N, N);
  mg.globalCompositeOperation = "destination-out";
  mg.drawImage(selection, sx, sy, sw, sh, 0, 0, N, N);
  const form = new FormData();
  form.append("model", s.model);
  form.append("prompt", prompt || "Rellena la zona de forma natural, continuando el fondo");
  form.append("image", await toBlob(crop), "image.png");
  form.append("mask", await toBlob(mask), "mask.png");
  form.append("n", "1");
  form.append("size", "1024x1024");
  const result = await call(s, "/images/edits", form);
  const out = newCanvas(W, H);
  const g = ctx2d(out);
  g.drawImage(result, 0, 0, result.width, result.height, sx, sy, sw, sh);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(selection, 0, 0);
  return out;
}

/** Genera una imagen nueva a partir de una descripción. */
export async function generateImage(s: AiSettings, prompt: string, size: "1024x1024" | "1536x1024" | "1024x1536"): Promise<HTMLCanvasElement> {
  return call(s, "/images/generations", JSON.stringify({ model: s.model, prompt, n: 1, size }));
}
