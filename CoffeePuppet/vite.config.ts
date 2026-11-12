import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Los archivos WebAssembly del seguimiento facial (MediaPipe) se sirven desde
// node_modules en desarrollo y se copian a /mediapipe al compilar: así la app
// funciona sin conexión a Internet.
const WASM_DIR = resolve(__dirname, "node_modules/@mediapipe/tasks-vision/wasm");

function mediapipeWasm(): Plugin {
  return {
    name: "coffee-mediapipe-wasm",
    configureServer(server) {
      server.middlewares.use("/mediapipe", (req, res, next) => {
        const name = (req.url || "").replace(/^\//, "").split("?")[0];
        if (!/^[\w.-]+\.(js|wasm)$/.test(name)) return next();
        try {
          const data = readFileSync(resolve(WASM_DIR, name));
          res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
          res.end(data);
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      for (const name of readdirSync(WASM_DIR)) this.emitFile({ type: "asset", fileName: `mediapipe/${name}`, source: readFileSync(resolve(WASM_DIR, name)) });
    },
  };
}

// Configuración de Vite para CoffeePuppet en el puerto 1439
export default defineConfig({
  plugins: [react(), mediapipeWasm()],
  clearScreen: false,
  server: {
    port: 1439,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
