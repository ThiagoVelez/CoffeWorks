import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite para CoffeeDrawTeam en el puerto 1443
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1443,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
});
