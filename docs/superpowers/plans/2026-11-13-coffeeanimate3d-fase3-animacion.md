# CoffeeAnimate3D 2 · Fase 3 (animación y archivos) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curvas, copiar/pegar poses (también reflejadas), papel cebolla, exportar `.obj` e importar `.glb`/`.obj` (propios exactos, ajenos como referencia), también por MCP.

**Architecture:** Lógica pura y probada en `model.ts` (suavizados, poses, mover claves), `objfile.ts` (exportar/leer OBJ) y `gltf.ts` (modelo en `asset.extras`, leer GLB). El visor dibuja fantasmas y la malla de referencia; `App.tsx` añade la vista de curvas y los menús.

**Tech Stack:** TypeScript, three.js 0.186.1, `tsx --test`, validador glTF de Khronos (local), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-coffeeanimate3d-v2-design.md` («Fase 3»).

## Global Constraints

- Suavizados: `linear`, `smooth`, `step`, más `ease-in` y `ease-out`.
- Copiar pose: Ctrl+Mayús+C; pegar: Ctrl+Mayús+V; pegar reflejada: Ctrl+Mayús+B (menú «Pegar pose reflejada»). La reflejada cambia izquierda↔derecha con `mirrorName` y niega `pos.x`, `rot.y`, `rot.z`.
- OBJ: ZIP con `.obj`, `.mtl` y el atlas `.png`, en bloques (÷16), sin animación.
- `.glb` exportado lleva el `.ca3d` completo en `asset.extras.ca3d` (texto) y sigue pasando el validador con 0 errores.
- Referencia: malla gris semitransparente, no editable ni exportable, ocultable; se guarda en `Model3D.reference` (opcional) si sus datos ocupan ≤ 10 MB; si no, se avisa y no se guarda.
- MCP: `copy_pose`, `paste_pose` (`mirrored`), `export_obj`; las 17 herramientas existentes no cambian.

## Review Focus

1. Pegar una pose reflejada en un modelo sin pareja «derecha» para una pieza «izquierda» → esa pieza se salta, las demás se pegan, y se avisa cuántas (Task 2).
2. Importar un `.glb` propio → el modelo vuelve igual (`serializeModel` idéntico) (Task 4).
3. Importar un `.obj` con caras de 4+ vértices, índices negativos o `v/vt/vn` → triangulado correcto (Task 3).
4. Arrastrar una clave en la vista de curvas sobre el tiempo de otra clave de la misma pieza → se fusionan, no hay dos claves con el mismo `t` (Task 1).
5. Un `.ca3d` con referencia se abre, se guarda y la referencia no aparece en el `.glb` ni en el `.obj` exportados (Task 4).

---

### Task 1: Suavizados nuevos y mover claves

**Files:** `src/types.ts`, `src/model.ts`; Test `src/anim.test.ts`.
**Produces:** `Ease` añade `"ease-in" | "ease-out"`; `moveKeyframe(m, animId, partId, t, patch: { t?: number; channel?: { kind: "pos" | "rot" | "scale"; axis: 0 | 1 | 2; value: number } }): Model3D` (fusiona si cae sobre otra clave; `t` se limita a [0, length]).
- [ ] Pruebas: ease-in a mitad < 0,5 del recorrido, ease-out > 0,5; mover tiempo y valor; fusión; `parseModel` acepta los suavizados nuevos.
- [ ] Implementar, verde, commit.

### Task 2: Poses

**Files:** `src/model.ts`; Test `src/anim.test.ts`.
**Produces:** `type PoseClip = { name: string; pose: Pose }[]`; `copyPose(m, animId, t, ids): PoseClip`; `pastePose(m, animId, t, clip, mirrored: boolean, ease: Ease): { model: Model3D; pasted: number; skipped: string[] }` (empareja por nombre; reflejada usa `mirrorName`).
- [ ] Pruebas: copiar/pegar en otro instante; reflejada a la pareja con ejes negados; pieza sin pareja se salta y se informa.
- [ ] Implementar, verde, commit.

### Task 3: OBJ

**Files:** Create `src/objfile.ts`; Test `src/objfile.test.ts`.
**Produces:** `exportObj(m: Model3D, baseName: string): { obj: string; mtl: string; png: Uint8Array }` (posiciones en mundo con el reposo, UV del atlas, `mtllib`/`usemtl`, nombre `o` por pieza); `parseObj(text: string): RefMesh` con `RefMesh = { positions: number[]; indices: number[] }`.
- [ ] Pruebas: número de `v`/`vt`/`f` = geometría de las formas; lectura con quads, índices negativos y `v/vt/vn`.
- [ ] Implementar, verde, commit.

### Task 4: GLB de ida y vuelta y referencia

**Files:** `src/gltf.ts`, `src/types.ts`, `src/model.ts`; Test `src/gltf.test.ts`.
**Produces:** `exportGlb` escribe `asset.extras.ca3d`; `importGlb(bytes): { model: Model3D } | { reference: RefMesh }` (lee posiciones e índices con las transformaciones de los nodos); `Model3D.reference?: { name: string; positions: string; indices: string }` (base64 de Float32/Uint32), `setReference(m, name, mesh) / clearReference(m)` con el límite de 10 MB (`Error("La referencia es demasiado grande (más de 10 MB)")`).
- [ ] Pruebas: ida y vuelta exacta; GLB ajeno → referencia con los triángulos esperados; límite; `parseModel` conserva la referencia; validador Khronos 0 errores con extras.
- [ ] Implementar, verde, commit.

### Task 5: Visor y editor

**Files:** `src/viewport.ts`, `src/App.tsx`.
- [ ] Visor: `setOnion(poses: Map<string, Pose>[] | null)` (fantasmas translúcidos), `setReference(mesh: RefMesh | null, visible: boolean)`.
- [ ] Editor: botón «Curvas» en la línea de tiempo (gráfica de la pieza principal, un color por eje, arrastrar claves → `moveKeyframe`), suavizados nuevos en el selector, botón papel cebolla, Copiar/Pegar/Pegar reflejada pose (menú Animación y atajos), Archivo › Importar (.glb/.obj) y Exportar a OBJ (.zip), Ver › Mostrar referencia / Quitar referencia.
- [ ] Playwright: pegar reflejada, curvas visibles, papel cebolla, importar un `.obj` de prueba como referencia.

### Task 6: MCP y cierre

**Files:** `src/mcp.ts`, `src/mcp-tools.json`, `src/mcp.test.ts`, `src/mcpBridge.ts`, `README.md`.
- [ ] Pruebas MCP: `copy_pose`+`paste_pose` (`mirrored`), `export_obj` devuelve `needs.exportObj`; 20 herramientas.
- [ ] Implementar (el puente guarda el ZIP en Exportaciones con `mcp_save_export`, que pasa a aceptar `.zip`).
- [ ] README; verificación completa; commit.
