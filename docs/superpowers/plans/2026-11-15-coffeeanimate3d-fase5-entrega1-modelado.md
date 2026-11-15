# CoffeeAnimate3D · Fase 5 · Entrega 1 (modelado de mallas): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir piezas de tipo *Malla* editables por vértices, aristas y caras, con simetría en X, suavizado Catmull–Clark, conversión de piezas existentes e importación como malla. Todo detrás del complemento de servicio `ca3d-modelado`.

**Architecture:**
- **Lógica pura y probada**, repartida en cinco archivos nuevos:
  - `mesh.ts`: datos, formas de partida y validación.
  - `meshgeo.ts`: simetría, subdivisión y geometría que se dibuja y se exporta.
  - `meshsel.ts`: selección.
  - `meshops.ts`: operaciones de edición.
  - `meshconvert.ts`: convertir piezas e importar.
- **Visor y exportación:** el visor, `gltf.ts` y `objfile.ts` usan `meshGeometry()`, así la app y el `.glb` coinciden.
- **Editor:** `App.tsx` gana el modo *Editar malla* (Tab) y el menú *Malla*. Cada operación es un único `apply()` del historial.

**Tech Stack:** TypeScript, React 19, three.js 0.186.1, `tsx --test`, validador glTF de Khronos (`/tmp/claude-0/val/v.cjs`, local), Playwright, Rust (`coffee-core::addons`).

**Spec:** `docs/superpowers/specs/2026-11-15-coffeeanimate3d-fase5-modelado-libre-design.md` (secciones «Complemento», «Formato .ca3d versión 3» y «Entrega 1»).

## Global Constraints

- **Unidades y ejes:** 16 = 1 bloque, +Y arriba, +Z delante. Los vértices son relativos al pivote de la pieza.
- **Versión de archivo:** `Model3D.version: 3`. `parseModel` acepta 1, 2 y 3. Un archivo sin mallas, abierto y guardado, solo cambia `version`.
- **Campo `mesh`:** `Part.mesh?: MeshData` es opcional. Si falta, la pieza no es una malla.
  - Decisión del plan: el diseño decía `mesh: MeshData | null`, pero escribir `null` en todas las piezas cambiaría los archivos que se guardan.
  - Una pieza no puede tener `box` y `mesh` a la vez.
- **Límite de caras:** `MAX_MESH_FACES = 20000` caras en la malla base. Una operación que lo supere lanza `Error("La malla superaría 20 000 caras")`.
- **Complemento:** `ca3d-modelado`, «Modelado libre de CoffeeAnimate3D», servicio (`executable: ""`, «Sin descarga»), `apps: ["coffeeanimate3d"]`, MIT.
  - Sin el complemento, las mallas se ven, se animan, se mueven como pieza y se exportan.
  - Lo que no se puede sin él (crear, editar, convertir, importar como malla) muestra «Activa el complemento Modelado libre» y el botón de instalar (`ensureAddon`).
- **Simetría:** la mitad modelada es `x ≥ 0`. Los vértices con `|x| < 1e-3` son del centro: se sueldan con su reflejo y su `x` queda en 0. Ningún vértice puede pasar a `x < 0` mientras `mirrorX` esté activo.
- **Orden de los modificadores:** simetría primero y subdivisión después. `subdivision` ∈ {0, 1, 2}.
- **Atajos en *Editar malla*:**

  | Tecla | Acción |
  |---|---|
  | Tab | entrar o salir |
  | 1 / 2 / 3 | vértices / aristas / caras |
  | A | todo |
  | L | conectado |
  | Alt+clic | bucle |
  | E | extruir |
  | I | insertar cara |
  | Ctrl+R | corte en bucle |
  | Ctrl+B | biselar |
  | M | unir |
  | Supr | borrar |
  | F | crear cara |
  | O | edición proporcional |
  | G / R / S | gizmo, como ahora |

  Fuera de *Editar malla*, todos los atajos siguen como hoy.
- **Lo que no puede romperse:** las 22 herramientas MCP actuales, las plantillas, el pack de piezas y los `.glb` de la versión 2, que siguen pasando el validador con 0 errores.

## Review Focus

1. Modelo v2 sin mallas, abierto y guardado: solo cambia `version` (Task 1).
2. App sin el complemento abriendo un `.ca3d` con mallas: se ve, se anima y se exporta. Los botones de edición piden el complemento (Task 5 y Task 7, Playwright con `?sinComplementos`).
3. Con simetría activa, arrastrar vértices hacia `x < 0`: quedan en `x = 0`, y los del centro no se despegan (Task 3).
4. Cualquier operación sobre una malla convertida, que ya tiene UV: `uvs` sigue con la misma forma que `faces` y en [0, 1], y `validateMesh` no da avisos (Task 3 y Task 4, con un barrido de todas las operaciones).
5. Borrar todas las caras de una malla: el visor no falla y la exportación se salta esa malla (glTF no admite accessors vacíos) (Task 5).

---

### Task 1: Datos, formato v3 y formas de partida

**Files:**
- Modify: `CoffeeAnimate3D/src/types.ts`, `CoffeeAnimate3D/src/model.ts` (`parseModel`, `validateModel`, `addPart`, `copyBranch`/`mirrorPart`)
- Create: `CoffeeAnimate3D/src/mesh.ts`
- Test: `CoffeeAnimate3D/src/mesh.test.ts`

**Interfaces — Produces:**
- En `types.ts`:
  - `type SelectMode = "vertex" | "edge" | "face"`.
  - `type MeshPrimitive = "cube" | "sphere" | "cylinder" | "plane"`.
  - `interface MeshTexture { size: 32 | 64 | 128 | 256; color: string; pixels?: string }`.
  - `interface MeshData { vertices: Vec3[]; faces: number[][]; uvs: [number, number][][]; texture: MeshTexture; mirrorX: boolean; subdivision: 0 | 1 | 2; smooth: boolean; weights?: { bone: string; w: number }[][] }`.
  - `Part.mesh?: MeshData`, `Model3D.version: 3` y `MAX_MESH_FACES = 20000`.
  - Si `uvs` está vacío, la malla aún no está desplegada. Si no, cumple `uvs.length === faces.length` y `uvs[i].length === faces[i].length`.
- En `mesh.ts`:
  - `primitiveMesh(kind: MeshPrimitive, size = 16): MeshData`, centrada en el origen:
    - cubo: cada cara partida en 2×2, 24 caras y 26 vértices;
    - esfera: cubo-esfera con cada cara en 4×4, 96 caras y 98 vértices;
    - cilindro: 16 lados y tapas de 16 vértices;
    - plano: 4×4 en XZ mirando a +Y.
  - En todas: `texture: { size: 64, color: DEFAULT_COLOR }`, `uvs: []`, `mirrorX: false`, `subdivision: 0`, `smooth: false`.
  - `validateMesh(mesh: MeshData): string[]`. Devuelve en español: índices fuera de rango, cara con menos de 3 vértices o con un vértice repetido, `uvs` incoherente o fuera de [0, 1], arista usada por más de 2 caras, dos caras vecinas con orientación opuesta, demasiadas caras y, con `mirrorX`, vértices con `x < -1e-3`.
  - `meshEdges(mesh): [number, number][]`: aristas únicas, con `a < b`.
  - `cloneMesh(mesh): MeshData`.
- En `model.ts`:
  - `addMeshPart(m: Model3D, input: { name?: string; parent?: string | null; pivot?: Vec3; mesh: MeshData }): [Model3D, string]`.
  - `updateMesh(m: Model3D, id: string, mesh: MeshData): Model3D`. Lanza el primer aviso de `validateMesh`.
  - `duplicatePart` copia la malla.
  - `mirrorPart` refleja una malla: niega `x`, invierte el orden de cada cara y de sus `uvs`, y deja los pesos sin tocar.

- [ ] **Step 1: Escribir las pruebas que fallan** en `mesh.test.ts`:
  - `v2 sin mallas → guardar solo cambia version`: `parseModel` de un modelo v2 de las plantillas; `serializeModel` del resultado es igual al original salvo `"version":3`.
  - `primitivas válidas y con los conteos del plan`: para cada forma, `validateMesh` da `[]`. El cubo tiene 26 vértices y 24 caras; la esfera, 98 y 96.
  - `primitivas cerradas miran hacia fuera`: en cubo, esfera y cilindro, `(v1−v0)×(v2−v0) · (centroide − origen) > 0` en todas las caras.
  - `validateMesh detecta`: un índice roto, una cara de 2 vértices, `uvs` de otra longitud, una arista con 3 caras, una cara volteada y `x < 0` con `mirrorX`. Cada caso da al menos un aviso.
  - `parseModel conserva mesh`, y `validateModel` marca «tiene caja y malla» cuando una pieza tiene las dos.
  - `addMeshPart` y `updateMesh` rechazan con el texto del primer aviso.
  - `mirrorPart de una malla`: los vértices quedan con `x` negado, `validateMesh` da `[]` y la orientación es hacia fuera.
- [ ] **Step 2: Comprobar que fallan.** Ejecutar `cd CoffeeAnimate3D && npx tsx --test src/mesh.test.ts`. Debe fallar con «Cannot find module './mesh'».
- [ ] **Step 3: Implementar.**
  - `parseModel`: acepta `version` 3 y lee `mesh` de forma defensiva: números finitos, `texture.size` permitido o 64, y `subdivision` limitado a 0–2.
  - Si una pieza trae `box` y `mesh`, conserva `box` y descarta `mesh`.
  - `newModel` y las plantillas pasan a `version: 3`.
  - `tsc` marcará los literales `version: 2`; cambiarlos a 3.
- [ ] **Step 4: Comprobar.** `npx tsx --test src/*.test.ts` debe pasar entero (todas las pruebas anteriores también) y `npx tsc --noEmit` no debe dar errores.
- [ ] **Step 5: Commit** «CoffeeAnimate3D: piezas de malla y formato 3».

### Task 2: Simetría, subdivisión y geometría que se dibuja

**Files:**
- Create: `CoffeeAnimate3D/src/meshgeo.ts`
- Test: `CoffeeAnimate3D/src/meshgeo.test.ts`

**Interfaces:**
- **Consumes:** `MeshData`, `validateMesh` y `meshEdges` (Task 1).
- **Produces:**
  - `mirrorMesh(mesh: MeshData): { vertices: Vec3[]; faces: number[][]; uvs: [number, number][][]; source: number[] }`.
    - `source[i]` es el vértice de la malla base del que sale el vértice `i`.
    - Los vértices del centro se comparten: no se duplican.
    - Las caras reflejadas van en orden inverso y reutilizan las `uvs`.
    - Sin `mirrorX`, devuelve la malla tal cual.
  - `subdivideOnce(v: Vec3[], f: number[][], uv: [number, number][][]): { vertices; faces; uvs }`.
    - Catmull–Clark, con las reglas de borde: las aristas y vértices de borde usan la media del borde.
    - Las UV se interpolan de forma bilineal dentro de cada cara.
    - Solo devuelve cuadriláteros.
  - `meshGeometry(mesh: MeshData, scale = 1): { positions: number[]; normals: number[]; uvs: number[]; indices: number[]; faceOf: number[] }`.
    - Aplica la simetría y luego `subdivision` veces `subdivideOnce`.
    - Triangula en abanico.
    - Con `smooth` usa normales por posición; si no, normales planas por cara, con los vértices partidos.
    - `faceOf[t]` es la cara de la malla base de la que sale el triángulo `t`; las reflejadas apuntan a la cara de origen.
    - Si la malla no está desplegada, las UV salen todas a (0, 0).

- [ ] **Step 1: Escribir las pruebas que fallan** en `meshgeo.test.ts`:
  - `cubo 8v/6c subdividido`: con nivel 1 da 26 vértices y 24 caras; con nivel 2, 98 vértices y 96 caras. Todas las caras son cuadriláteros y `validateMesh` da `[]`.
  - `la subdivisión encoge hacia dentro`: después de un nivel, todos los vértices de un cubo de lado 16 quedan dentro de la caja y alguno queda a más de 1 unidad de la superficie original.
  - `media malla con simetría queda cerrada`: un medio cubo abierto en `x = 0` (5 caras) con `mirrorX` da 12 vértices sin repetidos (ningún par a menos de 1e-6). Cada arista tiene 2 caras y todas las caras miran hacia fuera.
  - `faceOf`: tiene tantos elementos como triángulos y cada valor está entre 0 y `faces.length`. Con `mirrorX`, cada cara de origen aparece el doble de veces que sin él.
  - `normales unitarias`.
  - `UV en [0, 1]` en una malla con `uvs`.
  - `sin desplegar da UV (0, 0)`.
- [ ] **Step 2: Comprobar que fallan.** Ejecutar `npx tsx --test src/meshgeo.test.ts`.
- [ ] **Step 3: Implementar.** Catmull–Clark sobre una tabla de aristas (`"a,b"` → caras):
  - punto de cara: la media;
  - punto de arista: (extremos + puntos de cara) / 4 si la arista es interior, y el punto medio si es de borde;
  - vértice interior: (F + 2R + (n−3)P) / n;
  - vértice de borde: (6P + vecinos de borde) / 8.
- [ ] **Step 4: Comprobar.** Las pruebas pasan y `tsc` no da errores.
- [ ] **Step 5: Commit** «CoffeeAnimate3D: simetría y suavizado de mallas».

### Task 3: Selección y operaciones de edición

**Files:**
- Create: `CoffeeAnimate3D/src/meshsel.ts`, `CoffeeAnimate3D/src/meshops.ts`
- Test: `CoffeeAnimate3D/src/meshops.test.ts`

**Interfaces:**
- **Consumes:** Task 1 y Task 2.
- **Produces:**
  - En `meshsel.ts`, la selección se guarda **por vértices**: una cara está seleccionada si lo están todos sus vértices, y una arista si lo están sus dos extremos.
    - `selectedFaces(mesh, verts: number[]): number[]`.
    - `selectedEdges(mesh, verts): [number, number][]`.
    - `edgeLoop(mesh, a: number, b: number): number[]`: sigue el bucle a través de vértices de 4 aristas y para en polos o bordes.
    - `edgeRing(mesh, a, b): [number, number][]`: aristas opuestas a través de cuadriláteros (la usa el corte en bucle).
    - `linked(mesh, verts): number[]`.
    - `selectionCenter(mesh, verts): Vec3`.
    - `proportional(mesh, verts, radius: number): Map<number, number>`: peso 1 en los seleccionados y caída suave `1 − smoothstep(d / radius)` en los demás. Sin radio, solo los seleccionados.
  - En `meshops.ts`, todas las funciones devuelven una `MeshData` nueva y válida.
    - Si la malla está desplegada, las caras nuevas reciben UV interpoladas.
    - Si una operación supera el límite, lanza el error de las restricciones.
    - **Transformar:**
      - `moveVertices(mesh, w: Map<number, number>, delta: Vec3)`.
      - `rotateVertices(mesh, w, quat: [number, number, number, number], center: Vec3)`.
      - `scaleVertices(mesh, w, factor: Vec3, center: Vec3)`.
      - Con `mirrorX`, los vértices del centro conservan `x = 0` y el resto no baja de 0.
    - **Operaciones** (las que crean geometría devuelven también qué queda seleccionado):
      - `extrude(mesh, verts, distance = 4): { mesh; verts: number[] }`: región de las caras seleccionadas, a lo largo de su normal media. Si no hay caras pero sí aristas de borde, las extruye hacia fuera. Devuelve los vértices nuevos.
      - `inset(mesh, verts, amount = 2): { mesh; verts }`: una región por cada grupo de caras conectadas.
      - `loopCut(mesh, a: number, b: number, t = 0.5): { mesh; verts }`.
      - `bevel(mesh, verts, width = 2): { mesh; verts }`.
        - Un solo segmento.
        - Las aristas tienen que formar cadenas o bucles, con cada vértice en 2 aristas seleccionadas como mucho. Si no, lanza `Error("Biselar: selecciona aristas en hilera (cadenas o bucles)")`.
      - `mergeVertices(mesh, verts, how: "center" | "distance", dist = 0.5): Mesh`: quita las caras que quedan degeneradas.
      - `deleteSelection(mesh, verts, what: SelectMode): Mesh`: borra según el modo y quita los vértices sueltos.
      - `fillFace(mesh, verts): Mesh`.
        - Si los vértices forman un bucle de borde, crea la cara en el orden del bucle.
        - Si son 3 o 4 vértices, los ordena por ángulo.
        - La orientación sigue a la de sus vecinas.
        - Si no se puede, lanza `Error("Crear cara: selecciona 3 o 4 vértices o un borde cerrado")`.
      - `subdivideFaces(mesh, verts): Mesh`: los cuadriláteros seleccionados pasan a 4. Las caras vecinas ganan el vértice del punto medio, así que siguen bien conectadas.
      - `relax(mesh, verts, strength = 0.5): Mesh`: suaviza las posiciones hacia la media de los vecinos; los vértices de borde y los del centro no se mueven.
      - `flipFaces(mesh, verts): Mesh`.
      - `recalcNormals(mesh): Mesh`: orientación coherente recorriendo vecinas y, después, hacia fuera según el volumen con signo de cada parte conectada.
      - `applyMirror(mesh): Mesh`: deja `mirrorX` en `false`.
      - `applySubdivision(mesh): Mesh`: deja `subdivision` en 0.

- [ ] **Step 1: Escribir las pruebas que fallan** en `meshops.test.ts`, con un ayudante `ok(m)` que comprueba `validateMesh(m)` igual a `[]`:
  - `extrude` en la cara de arriba del cubo de 24 caras: suma 4 caras laterales por cada arista de borde de la región, y los vértices devueltos están 4 unidades más arriba.
  - `inset`: una cara pasa a ser 5 (la del centro y 4 alrededor).
  - `loopCut` en el cubo: suma 8 caras y un bucle de 8 vértices nuevos.
  - `bevel` en una arista del cubo de 6 caras da 7 caras. Con 3 aristas en un vértice lanza el error de las restricciones.
  - `mergeVertices "center"` de los 4 vértices de una cara: la cara desaparece y la malla sigue válida.
  - `deleteSelection`: con las caras borra solo esas caras y deja los vértices compartidos; con los vértices borra también las caras que los usan.
  - `fillFace` cierra el agujero de borrar una cara y la nueva cara mira hacia fuera.
  - `subdivideFaces` de una cara: queda en 4 y las vecinas ganan vértices; siempre `ok`.
  - `relax` acerca un pico de la esfera a la media.
  - `recalcNormals` deja hacia fuera un cubo con 3 caras volteadas.
  - `applyMirror` del medio cubo da el cubo cerrado, con `mirrorX` en `false`.
  - `simetría`: con `mirrorX`, `moveVertices` con `delta [-50, 0, 0]` deja `x = 0` en los vértices movidos y los del centro siguen en 0.
  - `límite`: subdividir una malla de 19 990 caras lanza «La malla superaría 20 000 caras».
  - `barrido con UV`: a una malla con `uvs` (un cubo con UV hechas a mano) se le aplica cada operación; el resultado es `ok`, con `uvs` coherente y en [0, 1].
  - `edgeLoop` del cubo de 24 caras recorre 8 vértices, y `linked` de un vértice da la malla entera.
- [ ] **Step 2: Comprobar que fallan.** Ejecutar `npx tsx --test src/meshops.test.ts`.
- [ ] **Step 3: Implementar** `meshsel.ts` y `meshops.ts`. Las ayudas internas de la tabla de aristas y del reindexado se comparten con `meshgeo.ts`.
- [ ] **Step 4: Comprobar.** Pasan todas las pruebas y `tsc` no da errores.
- [ ] **Step 5: Commit** «CoffeeAnimate3D: operaciones de edición de mallas».

### Task 4: Convertir en malla e importar como malla

**Files:**
- Create: `CoffeeAnimate3D/src/meshconvert.ts`
- Test: `CoffeeAnimate3D/src/meshconvert.test.ts`

**Interfaces:**
- **Consumes:** `shapeGeometry` (`geometry.ts`), `facePixels`, `RefMesh` y `parseObj` (`objfile.ts`), y `importGlb` (`gltf.ts`).
- **Produces:**
  - `joinTriangles(v: Vec3[], tris: number[][], maxAngleDeg = 1): number[][]`: une parejas de triángulos casi en el mismo plano que forman un cuadrilátero convexo.
  - `boxToMesh(box: Box): MeshData`: suelda las posiciones de `shapeGeometry` y junta triángulos.
    - La textura es de 128 px. La cara `FACES[i]` ocupa la celda de 32×32 en `(i % 4, ⌊i / 4⌋)`.
    - La UV de cada esquina es la UV de la forma escalada a su celda.
    - Los píxeles de cada cara se copian a su celda, así que la malla se ve igual que la pieza.
  - `convertPartToMesh(m: Model3D, id: string): Model3D`: la pieza pierde `box` y gana `mesh`; conserva el id, el nombre, el pivote, los hijos y las animaciones.
  - `refToMesh(ref: RefMesh): MeshData`.
    - Suelda con una tolerancia de 1e-4 × la diagonal y junta triángulos.
    - Solo geometría: `uvs` vacío y el color por defecto.
    - Si pasa del límite, lanza el error de las restricciones.
    - Con `recalcNormals` aplicado.

- [ ] **Step 1: Escribir las pruebas que fallan:**
  - `boxToMesh de un cubo`: 8 vértices y 6 caras de 4, válido. El píxel (5, 7) de `pz`, pintado de rojo, se lee rojo en la textura, en la posición de la celda de `pz` más (5, 7).
  - `boxToMesh` del cilindro, la esfera, la rampa y el plano: todos válidos, con UV en [0, 1].
  - `convertPartToMesh` conserva el id, las pistas de animación y los hijos.
  - `refToMesh` de un OBJ con un cuadrilátero, índices negativos y `v/vt/vn`: da un cuadrilátero válido.
  - `refToMesh` de un GLB ajeno (el de `importglb.test.ts`): es válido y tiene los mismos triángulos.
  - Más de 20 000 caras lanza el error.
- [ ] **Step 2: Comprobar que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Comprobar.** Pasan todas las pruebas y `tsc` no da errores.
- [ ] **Step 5: Commit** «CoffeeAnimate3D: convertir en malla e importar como malla».

### Task 5: Exportación, MCP y complemento

**Files:**
- Modify:
  - `CoffeeAnimate3D/src/gltf.ts`, `CoffeeAnimate3D/src/objfile.ts`, `CoffeeAnimate3D/src/mcp.ts`, `CoffeeAnimate3D/src/addonsLib.ts`;
  - `crates/coffee-core/src/addons.rs`, `src/services/tauriBridge.ts` (catálogo web).
- Test: `CoffeeAnimate3D/src/meshexport.test.ts`, `CoffeeAnimate3D/src/mcp.test.ts`.

**Interfaces — Produces:**
- `exportGlb`:
  - Cada pieza con malla visible y al menos un triángulo exporta su `meshGeometry(mesh, 1/16)`.
  - Si tiene `uvs`, usa su propia imagen y material: PNG de `size`×`size` con la textura. Si no, un material de color `baseColorFactor` sin `TEXCOORD_0`.
  - El `.ca3d` completo sigue en `asset.extras.ca3d`.
- `importGlb` de un `.glb` propio devuelve las mallas idénticas.
- `exportObj`: incluye las mallas en reposo, con los modificadores aplicados. Las texturas de malla van como PNG aparte (`<nombre>_<pieza>.png`), con su `newmtl`. Cambia el retorno a `{ obj; mtl; pngs: { name: string; data: Uint8Array }[] }` y se adapta quien lo llama en `App.tsx` y en `mcpBridge.ts`.
- MCP:
  - `describe` añade, en las piezas de malla, `mesh: { vertices, faces, mirrorX, subdivision, smooth, unwrapped }`.
  - `update_part` sobre una malla con `shape`/`from`/`size`/`color` lanza `«<nombre>» es una malla: edítala en el modo Editar malla`. El pivote y la rotación sí se pueden cambiar.
  - Siguen siendo 22 herramientas.
- `addonsLib.ts`:
  - `canModel(): Promise<boolean>`, que equivale a `ensureAddon("ca3d-modelado", "CoffeeAnimate3D")`.
  - `addonReady` acepta `"ca3d-modelado"`.
  - En el navegador de desarrollo, el complemento cuenta como instalado salvo que la URL tenga `?sinComplementos`. Ese caso es para las pruebas.
- El catálogo de Rust y el web llevan la entrada `ca3d-modelado`, con el texto de las restricciones y una descripción de lo que añade.

- [ ] **Step 1: Escribir las pruebas que fallan** en `meshexport.test.ts`:
  - Un modelo con cubo, malla con UV, malla sin UV y malla con simetría y subdivisión 1: `exportGlb` da tantos triángulos como la suma de `meshGeometry` más las formas. El `.glb` volcado con `SF_GLB_DIR` pasa `node /tmp/claude-0/val/v.cjs` con 0 errores (comprobación manual, anotada en el commit).
  - Ida y vuelta: `importGlb(exportGlb(m))` da el mismo `serializeModel`.
  - Una malla sin caras: la exportación no falla y esa pieza queda como nodo sin `mesh`.
  - `exportObj`: el número de `f` coincide con los triángulos de las mallas más los de las formas, y hay un PNG por malla con UV.
  - En `mcp.test.ts`: `get_model` describe la malla; `update_part` con `size` sobre una malla da el error de arriba; siguen siendo 22 herramientas.
  - `cargo test -p coffee-core` pasa y la prueba del catálogo cubre el id nuevo.
- [ ] **Step 2: Comprobar que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Comprobar.**
  - `npx tsx --test src/*.test.ts` y `npx tsc --noEmit` pasan.
  - `cargo test -p coffee-core` pasa.
  - El validador de Khronos da 0 errores en el `.glb` de la prueba y en los de las plantillas.
- [ ] **Step 5: Commit** «CoffeeAnimate3D: exportar mallas, MCP y complemento Modelado libre».

### Task 6: Visor (mallas y modo de edición)

**Files:**
- Modify: `CoffeeAnimate3D/src/viewport.ts`

**Interfaces:**
- **Consumes:** `meshGeometry` (Task 2) y `moveVertices`, `rotateVertices` y `scaleVertices` (Task 3).
- **Produces:**
  - Las piezas con malla se dibujan con `meshGeometry`.
    - El material lleva un `DataTexture` de `size`×`size` con filtro *nearest*, o el color de la textura si no hay UV.
    - Las mallas no intervienen al pintar: `onPaint` las ignora hasta la Entrega 2.
  - `setMeshEdit(edit: { partId: string; mode: SelectMode; verts: number[]; proportional: number | null } | null): void`. Dibuja encima, sin pasar por el picking normal:
    - los vértices de la malla base como puntos (los seleccionados en `ACCENT`);
    - las aristas de la malla base como líneas;
    - las caras seleccionadas teñidas;
    - la mitad reflejada y la subdivisión, solo en la malla sombreada;
    - un círculo del radio proporcional.
  - Eventos nuevos en `ViewportEvents`:
    - `onMeshPick(hit: { vert?: number; edge?: [number, number]; face?: number; shift: boolean; alt: boolean } | null)`. El vértice es el más cercano en pantalla a menos de 10 px; la arista, la más cercana a menos de 8 px; la cara se saca del rayo con `faceOf`. Se busca según el modo.
    - `onMeshBox(verts: number[], shift: boolean)`: arrastrar en vacío dibuja un rectángulo; solo cuentan los vértices visibles.
    - `onMeshTransform(change: { delta?: Vec3; rotate?: { quat: [number, number, number, number]; center: Vec3 }; scale?: { factor: Vec3; center: Vec3 } })`.
  - El gizmo se pone en `selectionCenter`. Mientras se arrastra, la vista previa aplica en local las funciones de la Task 3 con los pesos proporcionales. Al soltar, envía un único `onMeshTransform`.

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Comprobar.** `npx tsc --noEmit` no da errores. La prueba de interfaz va en la Task 7.
- [ ] **Step 3: Commit** «CoffeeAnimate3D: visor de mallas y modo de edición».

### Task 7: Editor (menús, atajos y propiedades)

**Files:**
- Modify: `CoffeeAnimate3D/src/App.tsx`, `CoffeeAnimate3D/src/panels.tsx`
- Test: Playwright, con un script en el scratchpad contra `npm run dev` (puerto de la app).

**Interfaces — Consumes:** todo lo anterior.

- **Estado:** `meshEdit: { partId; mode: SelectMode; verts: number[] } | null` y `propRadius: number | null`.
  - Tab entra en *Editar malla* si la pieza seleccionada es una malla y `canModel()` es verdadero. Tab o cambiar de modo (Pintar o Animar) sale.
- **Atajos de las restricciones**, solo dentro de *Editar malla*:
  - 1, 2 y 3 cambian el modo de selección en vez de Modelar, Pintar y Animar.
  - F crea una cara en vez de encajar.
  - M une vértices en vez de reflejar.
- **Menús:**
  - *Añadir › Malla: Cubo / Esfera / Cilindro / Plano*.
  - *Edición › Convertir en malla*, si la pieza tiene caja.
  - *Archivo › Importar como malla editable (.glb u .obj)…*.
  - Un menú *Malla*, solo en *Editar malla*, con todas las operaciones, sus atajos y *Aplicar simetría* / *Aplicar suavizado*.
- **Panel de propiedades** de una pieza de malla:
  - Vértices y caras.
  - Casillas *Simetría en X* y *Sombreado suave*.
  - Selector *Suavizado* 0, 1 o 2.
  - Campos *Distancia de extruir* (4) y *Grosor de insertar y biselar* (2).
  - Interruptor *Edición proporcional* (O) con su radio (8).
- Cada operación y cada arrastre terminado es un único `apply(next)`. Si una operación lanza un error, se muestra un aviso con su texto y no se aplica nada.
- **Sin el complemento:** el menú y los botones de malla llaman a `canModel()`, que ya muestra el diálogo de instalación; si la respuesta es no, no se hace nada. Tab sobre una malla tampoco hace nada.
- **Ayuda (F1):** una sección *Modelado libre* con los atajos.

- [ ] **Step 1: Implementar.**
- [ ] **Step 2: Playwright.** Con capturas a deviceScaleFactor 1 en el scratchpad, el guion es:
  1. Añadir una malla Cubo.
  2. Tab y luego 3; clic en la cara de arriba; E.
     - Esperado: el panel pasa de 24 a 28 caras.
  3. Ctrl+Z.
     - Esperado: vuelve a 24.
  4. Activar *Simetría en X* y *Suavizado 1*; arrastrar con el gizmo un vértice hacia `−X`.
     - Esperado: su `x` queda en 0, comprobado con `get_model`/estado.
  5. Convertir una pieza pintada de una plantilla en malla.
     - Esperado: la captura se ve igual.
  6. Importar como malla un `.obj` de prueba.
  7. Exportar `.glb`.
     - Esperado: se descarga.
  8. Con `?sinComplementos`, abrir el modelo guardado con mallas.
     - Esperado: se ve; Tab no entra; *Añadir › Malla* muestra el diálogo del complemento.
- [ ] **Step 3: Comprobar.** `npm test`, `npx tsc --noEmit` y `npm run build` pasan en `CoffeeAnimate3D`.
- [ ] **Step 4: Commit** «CoffeeAnimate3D: editor de mallas (Editar malla, menús y propiedades)».

### Task 8: Cierre

**Files:** `README.md` (sección CoffeeAnimate3D y complementos) y la versión.

- [ ] **Step 1:** Añadir al README:
  - Modelado libre: qué hace, sus atajos y que es un complemento.
  - La entrada del complemento en la lista.
- [ ] **Step 2:** Actualizar la versión de la suite.
  - `node scripts/version.mjs 2.14.0`
  - `cargo check --workspace`
  - `sed -i 's/2\.13\.0/2.14.0/g' README.md`
- [ ] **Step 3:** Verificación completa. Todo debe pasar:
  - En la raíz: `npx tsc --noEmit` y `npm run build`.
  - En `CoffeeAnimate3D`: `npm test` y `npm run build`.
  - `cargo test -p coffee-core -p coffeeworks-launcher -p coffeeanimate3d`.
  - `node scripts/sync-shared.mjs --check`.
- [ ] **Step 4:** Revisión final de toda la rama con un subagente revisor. Corregir lo que encuentre empezando por una prueba roja.
- [ ] **Step 5:** `git checkout -- data/vault.json`, commit «CoffeeAnimate3D 2.14.0: modelado libre (entrega 1)», push y PR a `main`.
