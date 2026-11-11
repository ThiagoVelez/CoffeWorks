import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Configuración de Vite para CoffeeDataBase en el puerto 1428
export default defineConfig({
  // El lector de bases .accdb/.mdb usa módulos de Node (Buffer, stream...)
  plugins: [react(), nodePolyfills({ include: ["buffer", "stream", "util", "events", "process", "string_decoder", "crypto"], globals: { Buffer: true, process: true } })],
  clearScreen: false,
  server: {
    port: 1428,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
