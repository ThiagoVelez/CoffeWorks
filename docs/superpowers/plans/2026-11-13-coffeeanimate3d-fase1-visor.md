# CoffeeAnimate3D 2 · Fase 1 (manejo del visor) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modo Escalar, cubo de vista, selección múltiple con grupos, ajuste a la cuadrícula y medir en CoffeeAnimate3D, también accesibles por MCP donde aplica.

**Architecture:** La lógica nueva va en funciones puras con pruebas (`model.ts`, `snap.ts`, `viewcube.ts`); el visor (`viewport.ts`) solo dibuja, recoge el ratón y emite eventos; `App.tsx` pasa de una selección a una lista y aplica los cambios con `apply()` (historial). Esta fase no cambia el formato `.ca3d`.

**Tech Stack:** TypeScript, React 19, three.js 0.186.1 (`TransformControls`, `OrbitControls`), `tsx --test`, Playwright para comprobar la interfaz.

**Spec:** `docs/superpowers/specs/2026-11-13-coffeeanimate3d-v2-design.md` (sección «Fase 1»).

## Global Constraints

- Unidades: 16 = 1 bloque; +Y arriba; +Z delante. Tamaño mínimo de caja: 1 unidad.
- Todo cambio del modelo pasa por `apply(next, key)` → se deshace con Ctrl+Z.
- Las 15 herramientas MCP actuales no cambian de comportamiento; solo se añaden herramientas y parámetros opcionales.
- Textos de la interfaz en español; tema oscuro; acento `#ff8a3d`.
- Atajos fijados por el spec: S escalar, M medir, Ctrl+A todo, Ctrl+G agrupar, Ctrl+Mayús+G desagrupar, Supr borrar, Mayús+clic añadir/quitar de la selección.
- Ajuste: opciones Libre / 1 px = 0,5 u / 1 u / ½ bloque = 8 u / 1 bloque = 16 u; giro en pasos de 15° (Ctrl alterna); preferencia guardada en `localStorage` (`ca3d.snap`), no en el documento.
- Cubo de vista ~110 px, arriba a la derecha; rótulos *Frente, Detrás, Izq., Der., Arriba, Abajo*; giro animado ~300 ms; botón «casa» → vista isométrica.
- Cada tarea termina con `npm test` y `npx tsc --noEmit` en verde dentro de `CoffeeAnimate3D/`.

## Review Focus

1. Agrupar piezas con padres distintos → error claro «Solo se pueden agrupar piezas con el mismo padre» y el modelo no cambia (prueba en Task 1).
2. Seleccionar un padre y su hijo y mover/escalar → el hijo no se transforma dos veces (`topLevel`, prueba en Task 1).
3. Arrastrar el asa de escala más allá del pivote (factor ≤ 0) → la caja queda en el mínimo de 1 unidad, nunca invertida (prueba en Task 2).
4. Desagrupar un grupo girado → se rechaza con mensaje, sin cambios; desagrupar un grupo con pistas de animación → sus pistas se borran y Ctrl+Z las recupera (pruebas en Task 1 y Task 6).
5. Clic en «Arriba»/«Abajo» del cubo de vista → la cámara no da un giro brusco ni produce NaN (dirección con épsilon en Z, prueba en Task 3).

---

### Task 1: Funciones de selección múltiple y grupos

**Files:**
- Modify: `CoffeeAnimate3D/src/model.ts`
- Test: `CoffeeAnimate3D/src/model.test.ts`

**Interfaces:**
- Produces:
  - `topLevel(m: Model3D, ids: string[]): string[]` — quita los ids que descienden de otro id de la lista; conserva el orden.
  - `sameParent(m: Model3D, ids: string[]): boolean`
  - `translateParts(m: Model3D, ids: string[], delta: Vec3): Model3D` — suma `delta` al pivote de cada id de `topLevel`.
  - `rotateParts(m: Model3D, ids: string[], axis: 0 | 1 | 2, deg: number, center: Vec3): Model3D` — gira el pivote de cada pieza alrededor de `center` (espacio del padre) y suma `deg` a `rotation[axis]`.
  - `scaleParts(m: Model3D, ids: string[], factor: Vec3, center: Vec3): Model3D` — escala `box.from`/`box.size` (mínimo 1 por eje) y la distancia de cada pivote a `center`.
  - `groupParts(m: Model3D, ids: string[], name?: string): [Model3D, string]` — pieza nueva `box: null`, nombre por defecto «Grupo», mismo padre que las piezas, pivote = media de sus pivotes redondeada a 0,5; los pivotes de las piezas pasan a ser relativos al grupo.
  - `ungroup(m: Model3D, groupId: string): Model3D` — los hijos suben al padre del grupo con `pivot + pivot del grupo`; borra el grupo y sus pistas.

- [ ] **Step 1: Escribir las pruebas (fallan)**

```ts
test("topLevel quita descendientes", () => {
  let m = newModel(); let a, b, c;
  [m, a] = addPart(m, { name: "A" });
  [m, b] = addPart(m, { name: "B", parent: a });
  [m, c] = addPart(m, { name: "C" });
  assert.deepEqual(topLevel(m, [b, a, c]), [a, c]);
});
test("groupParts conserva la posición en el mundo", () => {
  let m = newModel(); let a, b, g;
  [m, a] = addPart(m, { name: "A", pivot: [0, 0, 0] });
  [m, b] = addPart(m, { name: "B", pivot: [8, 4, 0] });
  [m, g] = groupParts(m, [a, b]);
  assert.deepEqual(findPart(m, g).pivot, [4, 2, 0]);
  assert.equal(findPart(m, g).box, null);
  assert.deepEqual(findPart(m, a).pivot, [-4, -2, 0]);
  assert.equal(findPart(m, b).parent, g);
});
test("groupParts rechaza padres distintos sin cambiar nada", () => {
  let m = newModel(); let a, b, c;
  [m, a] = addPart(m, { name: "A" });
  [m, b] = addPart(m, { name: "B", parent: a });
  [m, c] = addPart(m, { name: "C" });
  assert.throws(() => groupParts(m, [b, c]), /mismo padre/);
});
test("ungroup devuelve los hijos y rechaza grupos girados", () => {
  let m = newModel(); let a, g;
  [m, a] = addPart(m, { name: "A", pivot: [2, 0, 0] });
  [m, g] = groupParts(m, [a]);
  const back = ungroup(m, g);
  assert.deepEqual(findPart(back, a).pivot, [2, 0, 0]);
  assert.equal(back.parts.length, 1);
  const turned = updatePart(m, g, { rotation: [0, 30, 0] });
  assert.throws(() => ungroup(turned, g), /giro del grupo/);
});
test("scaleParts nunca deja tamaños menores que 1", () => {
  let m = newModel(); let a;
  [m, a] = addPart(m, { name: "A", box: { from: [0, 0, 0], size: [4, 4, 4] } });
  const s = scaleParts(m, [a], [0, -2, 0.5], [0, 0, 0]);
  assert.deepEqual(findPart(s, a).box!.size, [1, 1, 2]);
});
test("translateParts mueve una vez padre e hijo seleccionados", () => {
  let m = newModel(); let a, b;
  [m, a] = addPart(m, { name: "A" });
  [m, b] = addPart(m, { name: "B", parent: a, pivot: [1, 0, 0] });
  const t = translateParts(m, [a, b], [0, 4, 0]);
  assert.deepEqual(findPart(t, a).pivot, [0, 4, 0]);
  assert.deepEqual(findPart(t, b).pivot, [1, 0, 0]);
});
test("rotateParts gira pivotes alrededor del centro", () => {
  let m = newModel(); let a;
  [m, a] = addPart(m, { name: "A", pivot: [4, 0, 0] });
  const r = rotateParts(m, [a], 1, 90, [0, 0, 0]);
  assert.deepEqual(findPart(r, a).pivot.map((v) => Math.round(v * 100) / 100), [0, 0, -4]);
  assert.equal(findPart(r, a).rotation[1], 90);
});
```

- [ ] **Step 2: `npm test` → fallan por funciones inexistentes.**
- [ ] **Step 3: Implementar las seis funciones en `model.ts`** (`groupParts` y `ungroup` lanzan `Error("Solo se pueden agrupar piezas con el mismo padre")` y `Error("Pon a 0 el giro del grupo antes de desagrupar")`; `ungroup` exige `box === null`: «Solo se pueden desagrupar grupos»).
- [ ] **Step 4: `npm test` y `npx tsc --noEmit` → verde.**
- [ ] **Step 5: Commit** `CoffeeAnimate3D: grupos y transformación de varias piezas`.

### Task 2: Escalar y ajuste a la cuadrícula (funciones)

**Files:**
- Create: `CoffeeAnimate3D/src/snap.ts`, `CoffeeAnimate3D/src/snap.test.ts`
- Modify: `CoffeeAnimate3D/src/model.ts`, `CoffeeAnimate3D/src/model.test.ts`

**Interfaces:**
- Produces:
  - `type SnapStep = 0 | 0.5 | 1 | 8 | 16` y `SNAP_OPTIONS: { step: SnapStep; label: string }[]` con rótulos «Libre», «1 px», «1 u», «½ bloque», «1 bloque».
  - `snapValue(v: number, step: SnapStep): number` (0 = sin ajuste) y `snapVec(v: Vec3, step: SnapStep): Vec3`.
  - `loadSnap(): { step: SnapStep; rotate: boolean }` / `saveSnap(s)` sobre `localStorage["ca3d.snap"]`, por defecto `{ step: 1, rotate: true }`, tolerante a errores de `localStorage`.
  - `resizeBox(m: Model3D, id: string, size: Vec3, anchor: "pivot" | "center"): Model3D` — `"pivot"` escala `from` en la misma proporción (el pivote queda fijo, como el gizmo); `"center"` mantiene el centro de la caja (botones −/+). Tamaños < 1 → 1.

- [ ] **Step 1: Pruebas**

```ts
test("snapValue", () => {
  assert.equal(snapValue(7.3, 8), 8); assert.equal(snapValue(7.3, 0.5), 7.5); assert.equal(snapValue(7.3, 0), 7.3);
});
test("resizeBox desde el pivote y desde el centro", () => {
  let m = newModel(); let a;
  [m, a] = addPart(m, { name: "A", box: { from: [-2, 0, -2], size: [4, 8, 4] } });
  assert.deepEqual(findPart(resizeBox(m, a, [8, 8, 4], "pivot"), a).box!.from, [-4, 0, -2]);
  assert.deepEqual(findPart(resizeBox(m, a, [4, 16, 4], "center"), a).box!.from, [-2, -4, -2]);
  assert.deepEqual(findPart(resizeBox(m, a, [0, -3, 4], "center"), a).box!.size, [1, 1, 4]);
});
test("loadSnap sin localStorage devuelve el valor por defecto", () => {
  assert.deepEqual(loadSnap(), { step: 1, rotate: true });
});
```

- [ ] **Step 2: `npm test` → fallan.**
- [ ] **Step 3: Implementar `snap.ts` y `resizeBox`.**
- [ ] **Step 4: `npm test` y `tsc` → verde.**
- [ ] **Step 5: Commit** `CoffeeAnimate3D: escalar cajas y ajuste a la cuadrícula`.

### Task 3: Cubo de vista (datos y dirección)

**Files:**
- Create: `CoffeeAnimate3D/src/viewcube.ts`, `CoffeeAnimate3D/src/viewcube.test.ts`

**Interfaces:**
- Produces:
  - `interface CubeRegion { id: string; kind: "face" | "edge" | "corner"; dir: Vec3; label?: string }`
  - `VIEWCUBE_REGIONS: CubeRegion[]` — 26 regiones: 6 caras (dir con un eje ±1, `label` = «Frente» +Z, «Detrás» −Z, «Der.» +X, «Izq.» −X, «Arriba» +Y, «Abajo» −Y), 12 aristas (dos ejes ±1), 8 esquinas (tres ejes ±1).
  - `cameraDir(dir: Vec3): Vec3` — normaliza; si es paralela a Y, añade 0.001 en Z antes de normalizar.
  - `class ViewCube { constructor(host: HTMLElement, opts: { onPick(dir: Vec3): void; onHome(): void }); sync(cameraQuaternion: THREE.Quaternion): void; dispose(): void }` — canvas propio de 110×110 px con su `WebGLRenderer` (alpha), cámara ortográfica, cubo blanco con rótulos (`CanvasTexture`), 26 objetos de selección con `userData.dir`, resaltado al pasar el ratón, botón «casa» (HTML) debajo. Arrastrar sobre el cubo: no hace falta en esta fase si complica; clic es lo obligatorio.

- [ ] **Step 1: Pruebas**

```ts
test("26 regiones, direcciones únicas", () => {
  assert.equal(VIEWCUBE_REGIONS.length, 26);
  assert.equal(new Set(VIEWCUBE_REGIONS.map((r) => r.dir.join())).size, 26);
  assert.equal(VIEWCUBE_REGIONS.filter((r) => r.kind === "face").length, 6);
  assert.equal(VIEWCUBE_REGIONS.find((r) => r.label === "Frente")!.dir.join(), "0,0,1");
});
test("cameraDir no es paralela a Y ni da NaN", () => {
  const d = cameraDir([0, 1, 0]);
  assert.ok(d[2] > 0 && d.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
});
```

- [ ] **Step 2: fallan.** **Step 3: implementar `VIEWCUBE_REGIONS`, `cameraDir` y la clase `ViewCube`.** **Step 4: verde.**
- [ ] **Step 5: Commit** `CoffeeAnimate3D: cubo de vista`.

### Task 4: Visor — escalar, varias piezas, ajuste, medir y cubo de vista

**Files:**
- Modify: `CoffeeAnimate3D/src/viewport.ts`

**Interfaces:**
- Consumes: `cameraDir`, `ViewCube` (Task 3); `SnapStep` (Task 2).
- Produces (cambios en `Viewport`):
  - `type GizmoMode = "translate" | "rotate" | "scale"`.
  - `ViewportEvents.onSelect(id: string | null, additive: boolean)`; nuevo `onSelectRect(ids: string[], additive: boolean)`; `onTransform` pasa a `onTransform(change: { ids: string[]; delta?: Vec3; rotate?: { axis: 0|1|2; deg: number; center: Vec3 }; scale?: { factor: Vec3; center: Vec3 }; pivot?: Vec3; rotation?: Vec3 })` (los dos últimos solo para una pieza, como ahora); nuevo `onMeasure(distance: number | null)`.
  - `select(ids: string[])` (sustituye a `select(id)`); con varias piezas el gizmo se engancha a un objeto auxiliar en el centro de su caja común y solo aparece si `sameParent`; si no, sin gizmo.
  - Con una pieza en modo `scale` y vista *Modelar*, el gizmo se engancha a la **malla** (escala desde el pivote sin afectar a los hijos); en *Animar*, al grupo.
  - `setSnap(step: SnapStep, rotate: boolean)` → `setTranslationSnap`, `setScaleSnap`, `setRotationSnap(15°)`.
  - `setTool(tool: "select" | "measure")`; en `measure` dos clics sobre superficies dibujan una línea naranja y llaman a `onMeasure(dist)`; Esc o cambiar de herramienta → `onMeasure(null)`.
  - `lookFrom(dir: Vec3, animate = true)` — gira la cámara alrededor del objetivo manteniendo la distancia (~300 ms); `frame(angle | Vec3)` acepta también una dirección.
  - Mayús+arrastre en vacío dibuja un rectángulo (div superpuesto) y emite `onSelectRect` con las piezas cuyo centro proyectado cae dentro.

- [ ] **Step 1: Implementar** según la lista.
- [ ] **Step 2: `npx tsc --noEmit`** → fallará en `App.tsx` por las firmas nuevas; se arregla en Task 5 (hacer ambos en el mismo commit si se prefiere).
- [ ] **Step 3: Commit junto con Task 5.**

### Task 5: Editor — selección múltiple, escala, ajuste, medir y cubo de vista

**Files:**
- Modify: `CoffeeAnimate3D/src/App.tsx`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: estado `selection: string[]` (la última es la principal; `sel = selection.at(-1) ?? null` para el código existente).

- [ ] **Step 1: Implementar:**
  - Árbol y visor: clic selecciona una; Mayús+clic añade/quita; Ctrl+A todo; Esc limpia.
  - `onTransform` → `translateParts` / `rotateParts` / `scaleParts` / `resizeBox(..., "pivot")` / `updatePart`; en *Animar* el escalado crea fotograma clave con `scale`.
  - Botón y tecla S «Escalar»; barra con el selector de ajuste (`SNAP_OPTIONS`, guardado con `saveSnap`) y el botón Medir (M) que muestra la distancia «2,5 bloques (40 u)» (coma decimal).
  - Propiedades: con una pieza, botones −/+ de 1 bloque y ½ bloque por eje (`resizeBox(..., "center")`); con varias, «N piezas seleccionadas», posición/giro comunes (vacío si difieren; escribir aplica `translateParts`/valor a todas) y botones Agrupar, Desagrupar (si la principal es un grupo), Borrar.
  - Ctrl+G / Ctrl+Mayús+G / Supr; los errores de `groupParts`/`ungroup` se muestran con `toast`.
  - Cubo de vista montado en el visor (`onPick` → `vp.lookFrom(dir)`, `onHome` → `vp.frame("isométrica")`), sincronizado en cada fotograma.
  - Menú Ayuda › atajos: añadir los nuevos.
- [ ] **Step 2: `npx tsc --noEmit` y `npm test` → verde.**
- [ ] **Step 3: Comprobación con Playwright** (script en el scratchpad, `vite` en el puerto 1441, plantilla Cuadrúpedo):
  - Mayús+clic en dos patas → «2 piezas seleccionadas»; Ctrl+G → aparece «Grupo» en el árbol; Ctrl+Z → desaparece.
  - S + botón «+1 bloque» en Y de una pieza → su tamaño Y sube 16.
  - Clic en la cara «Frente» del cubo de vista → la cámara queda en +Z (`camera.position.z > |x|`), sin NaN.
  - Medir entre dos puntos → aparece el texto con «bloques».
  - Captura de pantalla para revisar visualmente el cubo de vista.
- [ ] **Step 4: Commit** `CoffeeAnimate3D: selección múltiple, escalar, ajuste, medir y cubo de vista`.

### Task 6: Herramientas MCP de la fase

**Files:**
- Modify: `CoffeeAnimate3D/src/mcp-tools.json`, `CoffeeAnimate3D/src/mcp.ts`, `CoffeeAnimate3D/src/mcp.test.ts`, `CoffeeAnimate3D/src/mcpBridge.ts`

**Interfaces:**
- Consumes: `groupParts`, `ungroup` (Task 1); `cameraDir` (Task 3); `Viewport.frame(dir)` (Task 4).
- Produces: herramientas `group_parts { parts: string[]; name?: string }` → `select` al grupo; `ungroup { part: string }`; `preview` acepta `direction: [x, y, z]` opcional (gana a `angle`), que `mcpBridge` pasa a `capture`.

- [ ] **Step 1: Pruebas**

```ts
test("group_parts y ungroup por nombre", () => {
  let m = runTool(TEMPLATE_MODEL, "group_parts", { parts: ["pata delantera izquierda", "pata delantera derecha"], name: "Delanteras" }).model!;
  assert.ok(m.parts.some((p) => p.name === "Delanteras"));
  const r = runTool(m, "ungroup", { part: "Delanteras" });
  assert.ok(!r.model!.parts.some((p) => p.name === "Delanteras"));
});
test("ungroup de un grupo con pistas las borra (Ctrl+Z las recupera en la app)", () => { /* grupo con keyframe en una animación → tras ungroup no queda la pista */ });
test("las 15 herramientas originales siguen en la lista", () => { /* TOOL_NAMES incluye las 15 + group_parts + ungroup = 17 */ });
```

(`TEMPLATE_MODEL` = `TEMPLATES["cuadrúpedo"]()`; usa los nombres reales de las patas de la plantilla.)

- [ ] **Step 2: fallan.** **Step 3: implementar.** **Step 4: verde** (`npm test`; además `cargo test -p coffeeanimate3d` porque `mcp_server.rs` incluye `mcp-tools.json`).
- [ ] **Step 5: Commit** `CoffeeAnimate3D: herramientas MCP para grupos y vistas`.

### Task 7: Cierre de la fase

**Files:**
- Modify: `README.md` (sección CoffeeAnimate3D y lista de herramientas MCP), versión con `node scripts/version.mjs 2.12.0`, `Cargo.lock`.

- [ ] **Step 1:** README: Escalar, cubo de vista, selección múltiple y grupos, ajuste, medir; `group_parts`, `ungroup`, `preview.direction`.
- [ ] **Step 2:** `node scripts/version.mjs 2.12.0`, `cargo check --workspace`, cambiar `2.11.1` → `2.12.0` en README.
- [ ] **Step 3:** Verificación completa: `npm test` y `npm run build` en `CoffeeAnimate3D`; `npm run build` en la raíz; `cargo test -p coffee-core -p coffeeworks-launcher -p coffeeanimate3d`; `node scripts/sync-shared.mjs --check`; `node scripts/make-theme.mjs --check`.
- [ ] **Step 4:** Commit y push; preguntar al usuario antes de abrir el PR.
