# CoffeeAnimate3D 2 · Fase 2 (formas nuevas) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cilindro, esfera, rampa y plano, pintables cara a cara a 32×32 como los cubos, en el visor, la exportación glTF y el MCP.

**Architecture:** `Box` gana `shape`; una función pura `shapeGeometry(box)` en `geometry.ts` produce posiciones, normales, UV y grupos por cara para cada forma, y la usan el visor y `gltf.ts`. La UV de cada vértice se obtiene proyectándolo sobre el marco de la cara del cubo que le corresponde, así que el píxel (x, y) de una cara es el mismo en todas las formas. Formato `.ca3d` versión 2 con migración desde la 1.

**Tech Stack:** TypeScript, three.js 0.186.1, `tsx --test`, validador glTF de Khronos (`/tmp/claude-0/val/v.cjs`, local), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-coffeeanimate3d-v2-design.md` («Formato .ca3d versión 2» y «Fase 2»).

## Global Constraints

- `shape: "box" | "cylinder" | "sphere" | "ramp" | "plane"`, por defecto `"box"`; se conservan `from`, `size` y las 6 caras.
- `version: 2` al guardar; `parseModel` acepta 1 y 2 (la 1 queda con `shape: "box"` en todas las cajas); otras versiones → error actual.
- Caras usadas: caja y esfera, las 6; cilindro, las 6 (`py` tapa, `ny` base, lateral en 4 cuartos `pz`, `px`, `nz`, `nx`); rampa `ny`, `nz`, `py` (pendiente que sube hacia −Z), `px`, `nx`; plano solo `py`, visible por las dos caras.
- Cilindro de 16 lados (4 por cuarto); esfera «cubo-esfera» con cada cara subdividida 4×4.
- Las 17 herramientas MCP no cambian salvo `shape` opcional en `add_part` y `update_part`.
- `.glb` exportado con 0 errores en el validador de Khronos.

## Review Focus

1. Abrir un `.ca3d` v1 y guardarlo → solo cambia `version` y aparece `shape: "box"` (prueba en Task 1).
2. Cambiar la forma de una pieza ya pintada → los píxeles pintados de las caras se conservan (Task 1).
3. Pintar sobre el lateral del cilindro o la esfera → el píxel tocado es el que se ve en la exportación (misma UV en visor y glTF; Task 2 comprueba UV en [0,1] y por cara).
4. Triángulos con la cara hacia fuera en todas las formas cerradas (si no, se ven agujeros como ya pasó con la caja; Task 2).
5. Reflejar (M) un cilindro o rampa → la copia tiene la misma forma (Task 1).

---

### Task 1: Formato v2 y campo `shape`

**Files:** Modify `src/types.ts`, `src/model.ts`, `src/mcp.ts`, `src/mcp-tools.json`; Test `src/shapes.test.ts`.

**Interfaces — Produces:**
- `type Shape = "box" | "cylinder" | "sphere" | "ramp" | "plane"`, `SHAPES: Shape[]`, `SHAPE_LABEL: Record<Shape, string>` («Cubo», «Cilindro», «Esfera», «Rampa», «Plano»), `SHAPE_FACES: Record<Shape, FaceName[]>`.
- `Box.shape: Shape`; `Model3D.version: 2`; `BoxInput.shape?: Shape`.

- [ ] Pruebas: v1 → v2 con `shape: "box"`; `serializeModel` escribe 2; `updatePart(..., { box: { shape: "sphere" } })` conserva `pixels`; `mirrorPart` copia la forma; `add_part` por MCP con `shape: "cylinder"`; `shape` inválido → error MCP «shape debe ser box, cylinder, sphere, ramp o plane»; `validateModel` marca formas desconocidas.
- [ ] Implementar; `npm test` y `tsc` en verde; commit.

### Task 2: Geometría de las formas

**Files:** Modify `src/geometry.ts`; Test `src/geometry.test.ts`.

**Interfaces — Produces:** `shapeGeometry(box: Box, scale = 1): { positions: number[]; normals: number[]; uvs: number[]; indices: number[]; groups: { face: FaceName; start: number; count: number }[] }` (índices de triángulos; `groups` en orden de `FACES`, solo caras usadas).

- [ ] Pruebas para cada forma: todas las posiciones dentro de la caja; normales unitarias; UV en [0,1]; solo aparecen las caras de `SHAPE_FACES`; en las formas cerradas cada triángulo mira hacia fuera (producto vectorial · (centroide − centro de la caja) > 0); la caja da lo mismo que `faceCorners` (24 vértices); cilindro con 16 segmentos laterales; el plano tiene sus dos caras.
- [ ] Implementar (UV por proyección sobre el marco TL/TR/BL de la cara: `u = (p−TL)·(TR−TL)/|TR−TL|²`, `v = (p−TL)·(BL−TL)/|BL−TL|²`); verde; commit.

### Task 3: Visor, exportación y editor

**Files:** Modify `src/viewport.ts`, `src/gltf.ts`, `src/gltf.test.ts`, `src/App.tsx`.

- [ ] Prueba (gltf): exportar un modelo con las 5 formas → GLB válido según `parseGlb` de las pruebas actuales y número de triángulos = suma de `shapeGeometry`; además pasar el validador de Khronos a mano (`node /tmp/claude-0/val/v.cjs` sobre el `.glb` volcado con `SF_GLB_DIR`) → 0 errores.
- [ ] Visor y glTF usan `shapeGeometry`.
- [ ] Editor: botones Añadir Cubo, Cilindro, Esfera, Rampa, Plano y Hueso; selector «Forma» en la sección Caja; la lista de caras (rellenar) solo muestra `SHAPE_FACES`; ayuda actualizada.
- [ ] Playwright: añadir las 4 formas nuevas, pintar un píxel en la esfera (cambia `pixels`), captura para revisar.
- [ ] README; commit.
