import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite para CoffeCams en el puerto 1426
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1426,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
