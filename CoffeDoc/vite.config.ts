import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite para CoffeDoc en puerto 1421
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
