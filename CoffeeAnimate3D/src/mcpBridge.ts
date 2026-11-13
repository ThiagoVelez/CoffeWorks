// Puente entre el servidor MCP (Rust, en el backend de la app) y la ventana: recibe
// cada llamada de Claude, la ejecuta sobre el modelo abierto y devuelve el resultado.
// Fuera de la app de escritorio no hace nada.

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./studio/desktop";
import { runTool, type Content } from "./mcp";
import { exportGlb } from "./gltf";
import type { Model3D, Vec3 } from "./types";
import type { ViewAngle } from "./viewport";

export type McpStatus = "off" | "listening" | "connected";

interface McpInfo {
  enabled: boolean;
  running: boolean;
  address: string;
  connected: boolean;
  error: string | null;
}

interface Options {
  getModel: () => Model3D | null;
  apply: (m: Model3D) => void;
  capture: (angle: ViewAngle | Vec3 | undefined, w: number, h: number) => string | null;
  select: (id: string | null) => void;
  setAnimation: (id: string, time: number) => void;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function useMcpBridge(options: Options): { status: McpStatus; address: string } {
  const [info, setInfo] = useState<McpInfo | null>(null);
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (!isTauri) return;
    let alive = true;
    const poll = async () => {
      try {
        const i = await invoke<McpInfo>("mcp_info");
        if (alive) setInfo(i);
      } catch {
        /* sin servidor MCP */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    const unlisten = listen<{ id: number; name: string; arguments: Record<string, unknown> }>("mcp-call", async (event) => {
      const { id, name, arguments: args } = event.payload;
      let content: Content[] = [];
      let isError = false;
      try {
        const model = opts.current.getModel();
        if (!model) throw new Error("No hay ningún modelo abierto en CoffeeAnimate3D. Abre o crea uno.");
        const r = runTool(model, name, args ?? {});
        content = r.content;
        isError = !!r.isError;
        if (r.model) opts.current.apply(r.model);
        if (r.select !== undefined) opts.current.select(r.select);
        if (r.needs && "preview" in r.needs) {
          const p = r.needs.preview;
          if (p.animation) opts.current.setAnimation(p.animation, p.time ?? 0);
          await nextFrame();
          const url = opts.current.capture(p.direction ?? p.angle ?? "isométrica", 640, 480);
          if (!url) throw new Error("No se pudo capturar la vista.");
          content = [{ type: "image", data: url.split(",")[1], mimeType: "image/png" }];
        } else if (r.needs && "export" in r.needs) {
          const path = await invoke<string>("mcp_save_export", { fileName: r.needs.export, data: toBase64(exportGlb(opts.current.getModel()!)) });
          content = [{ type: "text", text: `Exportado a ${path}` }];
        }
      } catch (e) {
        content = [{ type: "text", text: e instanceof Error ? e.message : String(e) }];
        isError = true;
      }
      await invoke("mcp_reply", { id, result: { content, isError } }).catch(() => undefined);
    });
    return () => {
      alive = false;
      window.clearInterval(timer);
      void unlisten.then((f) => f());
    };
  }, []);

  if (!info || !info.running) return { status: "off", address: info?.address ?? "" };
  return { status: info.connected ? "connected" : "listening", address: info.address };
}
