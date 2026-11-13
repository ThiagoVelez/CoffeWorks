# CoffeeAnimate3D 2 · Fase 4 (complementos) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complementos *Render* (luces, sombras, oclusión ambiental, imagen grande y vuelta 360°) y *Pack de piezas* (≥ 20 piezas listas para insertar), también por MCP.

**Architecture:** *Render* es un complemento de servicio (`executable: ""`): el código va en la app y el Launcher solo lo activa; `render.ts` monta la escena con sombras y `SSAOPass` sobre el modelo del visor. *Pack de piezas* es un complemento de datos: `src/pieces.ts` describe las piezas con las funciones del modelo, `scripts/make-pieces.ts` las escribe en `addons/coffee-ca3d-piezas/` (`piezas.json` + `.ca3d`, ids deterministas) y el flujo *Complementos* las publica en la versión `addons`; la app lee el índice con `core_addon_dir`.

**Tech Stack:** TypeScript, three.js 0.186.1 (`EffectComposer`, `RenderPass`, `SSAOPass`, `OutputPass`), `tsx --test`, Rust (`coffee-core::addons`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-13-coffeeanimate3d-v2-design.md` («Fase 4»).

## Global Constraints

- Ids de complemento: `ca3d-render` (servicio, «Sin descarga») y `ca3d-piezas` (datos, archivo de comprobación `piezas.json`, descarga `releases/download/addons/coffee-ca3d-piezas.zip`), ambos con `apps: ["coffeeanimate3d"]`, en el catálogo de Rust y en el del navegador.
- Render: sol y cielo, sombras, oclusión ambiental, fondo de color o transparente, tamaños 1280×720, 1920×1080 y 3840×2160; vuelta 360° a WebM (o GIF si no hay WebCodecs). Sin el complemento, el menú ofrece instalarlo (`ensureAddon`).
- Pack: ≥ 20 piezas coherentes con los biomas del juego (árboles, rocas, setas, plantas, muebles, bloques); insertar = grupo nuevo con el nombre de la pieza en la raíz, sin animaciones.
- MCP: `insert_piece` (`name`) y `render` (`size`, `transparent`, `angle`/`direction`); ambos devuelven `needs` y la app comprueba el complemento.

## Review Focus

1. Insertar una pieza dos veces → ids distintos y el modelo valida (Task 1).
2. Archivos del pack desactualizados respecto a `pieces.ts` → la prueba lo detecta (Task 1).
3. Render con fondo transparente → PNG con alfa (Task 3, Playwright).
4. Complemento no instalado y Claude pide `render`/`insert_piece` → error claro que dice cómo activarlo (Task 4).
5. Render de 3840×2160 no deja el visor con otro tamaño ni la cámara movida (Task 3).

---

### Task 1: Piezas
**Files:** Create `src/pieces.ts`, `scripts/make-pieces.ts`, `addons/coffee-ca3d-piezas/{piezas.json,*.ca3d,README.md}`; Modify `src/model.ts`; Test `src/pieces.test.ts`.
**Produces:** `PIECES: { file: string; name: string; category: string; make: () => Model3D }[]`; `normalizeIds(m): Model3D`; `insertPiece(m, piece: Model3D, name: string): [Model3D, string]`.
- [ ] Pruebas (≥ 20, nombres únicos, validan, archivos al día, insertar dos veces) → implementar → generar → verde → commit.

### Task 2: Catálogo y CI
**Files:** `crates/coffee-core/src/addons.rs`, `src/services/tauriBridge.ts`, `.github/workflows/addons.yml`.
- [ ] Entradas de los dos complementos; job `ca3dpiezas` que comprime `addons/coffee-ca3d-piezas` y lo publica; `cargo test -p coffee-core`; commit.

### Task 3: Render y panel de piezas en la app
**Files:** Create `src/render.ts`; Modify `src/App.tsx`, `src/viewport.ts`.
- [ ] `renderImage(vp, opts): Promise<HTMLCanvasElement>` y `turntableJob(vp, opts): FrameJob`; diálogo *Ver › Render…*; panel *Piezas* (lista por categoría, insertar).
- [ ] Playwright (con el complemento simulado en el navegador): render PNG con alfa; tamaño del visor intacto; insertar una pieza desde un índice local.

### Task 4: MCP y cierre
**Files:** `src/mcp.ts`, `src/mcp-tools.json`, `src/mcp.test.ts`, `src/mcpBridge.ts`, `README.md`.
- [ ] Pruebas MCP (`needs` de las dos herramientas, 22 herramientas) → implementar → README → verificación completa → commit.
