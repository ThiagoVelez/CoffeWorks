import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite para CoffeCalc en el puerto 1422
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
