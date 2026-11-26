import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Solo en desarrollo: con OCR_MODELOS=/carpeta, sirve los modelos de «Desde foto» en
 * /modelos-ocr/ para probar en el navegador (en la app los entrega el complemento).
 */
function modelosOcr(): Plugin {
  const dir = process.env.OCR_MODELOS;
  const permitidos = new Set(["encoder.onnx", "decoder.onnx", "image_resizer.onnx", "tokenizer.json"]);
  return {
    name: "modelos-ocr",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/modelos-ocr", (req, res, next) => {
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

// Configuración de Vite para CoffeeLatex en el puerto 1444
export default defineConfig({
  plugins: [react(), modelosOcr()],
  clearScreen: false,
  server: {
    port: 1444,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
