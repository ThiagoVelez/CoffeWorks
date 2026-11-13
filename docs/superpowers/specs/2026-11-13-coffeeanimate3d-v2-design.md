# CoffeeAnimate3D 2 — diseño

Fecha: 2026-11-13 · Estado: pendiente de aprobación

## Para qué

CoffeeAnimate3D (app 21, Ilustración, `.ca3d`) hace modelos de cubos con texturas de
32×32, huesos y animación, y Claude puede usarla por MCP. Se queda corta para hacer
criaturas, objetos y escenas más ricas para SurvivalForest. El usuario quiere que
«haga más, como un Blender», **sin perder el estilo de bloques**. El modelado libre
tipo Blender (vértices, extruir, biselar) irá más adelante como complemento.

Éxito: con la app se modela, pinta y anima una criatura del juego más rápido y con
formas que hoy no se pueden hacer (patas redondas, ojos esféricos, tejados en rampa),
girando la cámara con el cubo de vista y escalando con el ratón; y todo lo nuevo
también lo puede hacer Claude por MCP.

## Objetivos, no objetivos y antiobjetivos

**Objetivos** (por fases, una PR por fase, el usuario prueba cada una antes de seguir):

1. Manejo del visor: modo Escalar, cubo de vista, selección múltiple y grupos, ajuste
   a la cuadrícula, medir.
2. Formas nuevas: cilindro, esfera, rampa y plano, pintables a 32×32.
3. Animación y archivos: curvas, copiar/pegar poses (también reflejadas), papel
   cebolla 3D, importar `.glb`/`.obj`, exportar `.obj`.
4. Complementos: *Render* (luces, sombras, imagen grande, vuelta 360°) y *Pack de
   piezas* (árboles, rocas, muebles, bloques).
5. Modelado libre (B) como complemento: **se diseña aparte** cuando se llegue.

**No objetivos:** materiales realistas (PBR), esculpir, física o simulación, partículas,
texturas de más de 32×32.

**Antiobjetivos** (aunque funcione, sería un fracaso):
- Abrir un `.ca3d` existente y que cambie o se pierda algo.
- Un `.glb` exportado que no pase el validador de Khronos o que el juego vea distinto.
- Que algo nuevo no se pueda deshacer con Ctrl+Z.
- Que un complemento ejecute código descargado dentro de la app.
- Romper o cambiar las 15 herramientas MCP actuales (solo se añaden o amplían con
  parámetros opcionales).

## Restricciones

- Pila actual: Tauri 2, React 19, TS, three.js 0.186.1 (`OrbitControls`,
  `TransformControls`), pruebas con `tsx --test`. Siempre en tema oscuro (Ilustración).
- Funciona en WebView2 (Windows) y WebKitGTK (Linux).
- Unidades: 16 = 1 bloque, +Y arriba, +Z delante. Texturas 32×32 RGBA por cara.
- Toda edición pasa por `apply(next, key)` de `useStudioDoc` (historial y Ctrl+Z).
- Las funciones puras viven en `model.ts` / `geometry.ts` / `gltf.ts` con pruebas
  (TDD: prueba roja → verde). La interfaz se comprueba con Playwright.
- Complementos con el catálogo de `coffee-core::addons` y `shared/studio/addons.ts`.

## Enfoques considerados

- **A. Seguir con cubos, más potente (elegido por el usuario).** Mantiene el estilo
  del juego y el formato; cada mejora sirve enseguida.
- **B. Modelado libre como Blender.** Para cualquier forma, pero es casi otra app y
  rompe el estilo de bloques. Queda como complemento futuro (fase 5).

Para los complementos con funciones (*Render*, *Modelado libre*): **el código va
dentro de la app y el Launcher solo lo activa** (complemento «de servicio», como el
OCR). Alternativa descartada: descargar módulos JS y cargarlos en la ventana, porque
tendrían acceso a los archivos y a los comandos nativos sin control. Los complementos
de datos (*Pack de piezas*) sí se descargan. *(Decisión de Claude, revisada por el
usuario.)*

## Diseño

### Formato `.ca3d` versión 2

- `Model3D.version` pasa a `2`. `parseModel` acepta `1` y lo migra (todas las piezas
  quedan con `shape: "box"`); `serializeModel` siempre escribe `2`. Un `.ca3d` v1
  abierto y guardado solo cambia `version` y añade `shape`.
- `Box` gana `shape: "box" | "cylinder" | "sphere" | "ramp" | "plane"`. Se conservan
  `from`, `size` y las **6 caras** con su textura; cada forma decide cómo usa cada cara
  (ver «Formas»). Así el pintor, las herramientas MCP y el atlas no cambian.
- Un grupo es una pieza con `box: null` (ya existe en el modelo): agrupar = crear una
  pieza vacía con el pivote en el centro de la selección y colgar de ella las piezas.

### Fase 1 — Manejo del visor

- **Escalar (S)**: tercer modo del gizmo (`TransformControls` en `"scale"`), con asas
  por eje y central. En *Modelar* cambia `box.size` (redondeado a la cuadrícula, mínimo
  1 unidad) manteniendo fija la cara opuesta al asa arrastrada; con Alt escala desde
  el centro. En *Animar* escribe la `scale` del fotograma clave. Panel de
  propiedades con botones −/+ de 1 bloque y ½ bloque.
- **Cubo de vista** (esquina superior derecha del visor, ~110 px): escena three.js
  propia con un cubo blanco de caras rotuladas *Frente, Detrás, Izq., Der., Arriba,
  Abajo*, que gira con la cámara. Clic en cara, arista (12) o esquina (8) → la cámara
  gira animada (~300 ms) hacia esa dirección alrededor del objetivo actual. Resalta lo
  que hay bajo el ratón. Botón «casa» para la vista isométrica inicial. Arrastrar el
  cubo gira la cámara como el visor.
- **Selección múltiple**: Mayús+clic en el visor o en el árbol añade/quita; arrastrar
  en vacío con Mayús hace rectángulo. El gizmo actúa sobre todas (mover, girar,
  escalar respecto al centro común). Propiedades muestra lo común y «varios valores».
  Atajos: Ctrl+A todo, Ctrl+G agrupar, Ctrl+Mayús+G desagrupar, Supr borra todas.
- **Ajuste a la cuadrícula**: selector en la barra (Libre / 1 px = 0,5 u / 1 u / ½
  bloque / 1 bloque) para mover, escalar y pivotes; giro con pasos de 15° (Ctrl
  alterna). Preferencia de la app, no del documento.
- **Medir (M)**: clic en dos puntos de superficies → línea con la distancia en
  bloques y unidades; Esc la quita. No se guarda en el documento.
- MCP: `group_parts` (lista de piezas → grupo nuevo) y `ungroup`; `preview` acepta
  además las vistas de aristas y esquinas del cubo de vista.

### Fase 2 — Formas nuevas

Todas se pintan cara a cara como los cubos; la geometría sale de `geometry.ts`
(pura y probada) y la usan el visor y `gltf.ts`.

| Forma | Caras usadas | Geometría |
| :--- | :--- | :--- |
| Cilindro (eje Y) | `py` tapa, `ny` base; el lateral se reparte en 4 cuartos: `pz`, `px`, `nz`, `nx` | 16 lados (4 por cuarto); elíptico si X≠Z |
| Esfera | las 6, proyección «cubo-esfera» | cada cara del cubo subdividida 4×4 y normalizada; elipsoide según `size` |
| Rampa | `ny` base, `nz` respaldo, `py` la pendiente (sube hacia −Z), `px`/`nx` triángulos | 5 caras planas |
| Plano | solo `py`, visible por las dos caras | 1 cuadrado en el centro de la altura |

- El selector de cara del pintor solo ofrece las caras que la forma usa.
- `mirrorPart` refleja también la forma (rampa y cuartos de cilindro).
- Botones «Añadir» en el árbol: Cubo, Cilindro, Esfera, Rampa, Plano, Grupo.
- MCP: `add_part` y `update_part` aceptan `shape` opcional (por defecto `box`).

### Fase 3 — Animación y archivos

- **Curvas**: vista alternativa de la línea de tiempo con las curvas de pos/rot/escala
  de la pieza seleccionada (un color por eje). Arrastrar un punto cambia tiempo y
  valor; los suavizados ganan `ease-in` y `ease-out` además de los actuales.
- **Copiar / pegar pose** (Ctrl+Mayús+C / V): copia la pose actual de las piezas
  seleccionadas y la pega como fotograma clave en el tiempo actual. **Pegar
  reflejada** cambia izquierda↔derecha por el nombre (`mirrorName`) y niega los ejes
  que corresponden: sirve para hacer la segunda mitad de un paso.
- **Papel cebolla 3D**: fantasmas translúcidos del fotograma clave anterior y el
  siguiente (activable, en *Animar*).
- **Exportar `.obj`**: ZIP con `.obj`, `.mtl` y el atlas `.png` (`makeZip`), en
  bloques. Sin animación (OBJ no la admite).
- **Importar**:
  - `.glb` hecho por CoffeeAnimate3D: al exportar se guarda el modelo `.ca3d` completo
    en `extras` del glTF; al importarlo vuelve exacto (ida y vuelta).
  - Cualquier otro `.glb` u `.obj`: se carga como **referencia** (malla gris
    semitransparente, no editable, no se exporta, se puede ocultar) para calcar
    encima con cubos. Se guarda en el documento como referencia opcional (tamaño
    máximo 10 MB; si es mayor se avisa y no se guarda).
- MCP: `copy_pose`/`paste_pose` (con `mirrored`) y `export_obj`.

### Fase 4 — Complementos

Se añaden al catálogo de `coffee-core::addons` con `apps: ["coffeeanimate3d"]`:

- **Render** (`ca3d-render`, de servicio, 0 MB): menú *Ver › Render…* con luz de sol
  y cielo, sombras, oclusión ambiental (SSAO de los ejemplos de three.js), fondo de
  color o transparente, tamaño hasta 3840×2160 y **vuelta 360°** a WebM/GIF
  (`webm.ts`, `gif.ts`). Sin el complemento, el menú ofrece instalarlo
  (`ensureAddon`).
- **Pack de piezas** (`ca3d-piezas`, de datos): ZIP de `.ca3d` (árboles, rocas,
  setas, muebles, bloques del juego) que se publica en la release `addons`, generado
  en CI desde `CoffeeAnimate3D/pieces/*.ca3d`. Panel *Piezas* para insertar una como
  grupo en el modelo abierto.
- MCP: `render` (si el complemento está activado) y `insert_piece`.

### Fase 5 — Modelado libre

Fuera de este diseño. Se brainstormea cuando las fases 1–4 estén hechas.

## Lo que decide quien construye

- Colores, iconos y textos exactos de la interfaz, dentro del estilo oscuro actual.
- Cómo dividir cada fase en commits y qué pruebas exactas escribir (siempre con
  pruebas de las funciones puras y una comprobación con Playwright por fase).
- Detalles del cubo de vista (tipografía de los rótulos, colores de resaltado).
- Las piezas concretas del pack (mínimo 20, coherentes con los biomas del juego).

## Decisiones de Claude marcadas para revisar

- Formas nuevas reutilizan las 6 caras existentes (no hay texturas nuevas por forma).
- Importar cualquier `.glb`/`.obj` ajeno solo como referencia para calcar, no como
  piezas editables (convertir mallas libres a cubos perdería la forma).
- El modelo completo viaja dentro del `.glb` exportado para poder reimportarlo.
- El ajuste a la cuadrícula es una preferencia de la app, no del documento.
