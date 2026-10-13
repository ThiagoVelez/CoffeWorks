import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Plugin para sincronización de la bóveda de documentos entre CoffeDoc y Launcher
function vaultApiPlugin(): Plugin {
  const vaultPath = path.resolve(__dirname, "data/vault.json");

  return {
    name: "vault-api-sync",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Habilitar CORS para permitir llamadas desde CoffeDoc (localhost:1421)
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.url === "/api/vault") {
          if (req.method === "GET") {
            try {
              if (fs.existsSync(vaultPath)) {
                const data = fs.readFileSync(vaultPath, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.end(data || "[]");
              } else {
                res.setHeader("Content-Type", "application/json");
                res.end("[]");
              }
            } catch (err) {
              console.error("Error al leer vault.json:", err);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Fallo al leer la bóveda" }));
            }
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", () => {
              try {
                const payload = JSON.parse(body || "{}");
                let existingDocs: Array<{
                  id: string;
                  name: string;
                  app_id: string;
                  category: string;
                  last_modified: string;
                  is_pinned: boolean;
                  path: string;
                }> = [];

                if (fs.existsSync(vaultPath)) {
                  try {
                    const current = fs.readFileSync(vaultPath, "utf-8");
                    existingDocs = JSON.parse(current || "[]");
                  } catch {
                    existingDocs = [];
                  }
                }

                if (Array.isArray(payload)) {
                  existingDocs = payload;
                } else if (payload && payload.id) {
                  const idx = existingDocs.findIndex((d) => d.id === payload.id);
                  if (idx >= 0) {
                    existingDocs[idx] = { ...existingDocs[idx], ...payload };
                  } else {
                    existingDocs.unshift(payload);
                  }
                }

                const dir = path.dirname(vaultPath);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(vaultPath, JSON.stringify(existingDocs, null, 2), "utf-8");

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, count: existingDocs.length }));
              } catch (err) {
                console.error("Error al guardar en vault.json:", err);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Payload no válido" }));
              }
            });
            return;
          }
        }

        next();
      });
    },
  };
}

// Configuración de Vite adaptada para Tauri y entorno web
export default defineConfig({
  plugins: [react(), vaultApiPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2022",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
