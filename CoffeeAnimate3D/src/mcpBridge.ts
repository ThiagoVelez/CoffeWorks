// Puente entre el servidor MCP (Rust, en el backend de la app) y la ventana: recibe
// cada llamada de Claude, la ejecuta sobre el modelo abierto y devuelve el resultado.
// Fuera de la app de escritorio no hace nada.

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./studio/desktop";
import { runTool, type Content } from "./mcp";
import { exportGlb } from "./gltf";
import { exportObj, objFileBase } from "./objfile";
import { makeZip } from "./studio/zip";
import type { Model3D, Vec3 } from "./types";
import type { ViewAngle, Viewport } from "./viewport";
import { addonReady, loadPiece, loadPieceIndex } from "./addonsLib";
import { insertPiece } from "./model";
import { DEFAULT_RENDER, RenderSession } from "./render";

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
  viewport: () => Viewport | null;
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
        } else if (r.needs && "insertPiece" in r.needs) {
          if (!(await addonReady("ca3d-piezas"))) throw new Error("El complemento «Pack de piezas para CoffeeAnimate3D» no está instalado. Instálalo en el Launcher de CoffeeWorks › Complementos.");
          const wanted = r.needs.insertPiece.toLowerCase();
          const index = (await loadPieceIndex()) ?? [];
          const entry = index.find((p) => p.name.toLowerCase() === wanted) ?? index.find((p) => p.name.toLowerCase().includes(wanted));
          if (!entry) throw new Error(`No hay ninguna pieza «${r.needs.insertPiece}». Piezas: ${index.map((p) => p.name).join(", ")}`);
          const [next, id] = insertPiece(opts.current.getModel()!, await loadPiece(entry), entry.name);
          opts.current.apply(next);
          opts.current.select(id);
          content = [{ type: "text", text: `Pieza «${entry.name}» insertada como grupo (id ${id}). Muévela con update_part (pivot).` }];
        } else if (r.needs && "render" in r.needs) {
          if (!(await addonReady("ca3d-render"))) throw new Error("El complemento «Render de CoffeeAnimate3D» no está activado. Actívalo en el Launcher de CoffeeWorks › Complementos.");
          const vp = opts.current.viewport();
          if (!vp) throw new Error("No se pudo usar el visor.");
          const q = r.needs.render;
          await nextFrame();
          const session = new RenderSession(vp, { ...DEFAULT_RENDER, width: q.width, height: q.height, transparent: q.transparent, angle: q.direction ?? q.angle });
          const small = document.createElement("canvas");
          let bytes: Uint8Array;
          try {
            const big = session.render();
            bytes = new Uint8Array(await (await new Promise<Blob>((ok) => big.toBlob((b) => ok(b!), "image/png"))).arrayBuffer());
            small.width = 640;
            small.height = Math.round((640 * q.height) / q.width);
            small.getContext("2d")!.drawImage(big, 0, 0, small.width, small.height);
          } finally {
            session.dispose();
          }
          const path = await invoke<string>("mcp_save_export", { fileName: `render-${Date.now()}.png`, data: toBase64(bytes) });
          content = [
            { type: "text", text: `Render ${q.width}×${q.height} guardado en ${path}` },
            { type: "image", data: small.toDataURL("image/png").split(",")[1], mimeType: "image/png" },
          ];
        } else if (r.needs && "exportObj" in r.needs) {
          const base = objFileBase(r.needs.exportObj);
          const { obj, mtl, png } = exportObj(opts.current.getModel()!, base);
          const zip = new Uint8Array(await makeZip([{ name: `${base}.obj`, data: obj }, { name: `${base}.mtl`, data: mtl }, { name: `${base}.png`, data: png }]).arrayBuffer());
          const path = await invoke<string>("mcp_save_export", { fileName: `${base}-obj.zip`, data: toBase64(zip) });
          content = [{ type: "text", text: `Exportado a ${path} (.obj, .mtl y la textura .png)` }];
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
