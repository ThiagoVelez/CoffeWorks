import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Solo en desarrollo: con VOZ_MODELOS=/carpeta, sirve los modelos de «Separar voz y música» y
 * «Letra de canciones» en /modelos-voz/ para probar en el navegador (en la app los entregan
 * los complementos).
 */
function modelosVoz(): Plugin {
  const dir = process.env.VOZ_MODELOS;
  const permitidos = new Set(["voc_ft.onnx", "small-encoder.int8.onnx", "small-decoder.int8.onnx", "small-tokens.txt"]);
  return {
    name: "modelos-voz",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/modelos-voz", (req, res, next) => {
        const nombre = (req.url ?? "").replace(/^\//, "").split("?")[0];
        const ruta = dir && permitidos.has(nombre) ? join(dir, nombre) : "";
        if (!ruta || !existsSync(ruta)) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", String(statSync(ruta).size));
        if (req.method === "HEAD") return res.end();
        createReadStream(ruta).pipe(res);
      });
    },
  };
}

// Configuración de Vite para CoffeeSound en el puerto 1436
export default defineConfig({
  plugins: [react(), modelosVoz()],
  clearScreen: false,
  server: {
    port: 1436,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
