import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite para CoffeView (PowerPoint de CoffeWorks) en el puerto 1423
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1423,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
