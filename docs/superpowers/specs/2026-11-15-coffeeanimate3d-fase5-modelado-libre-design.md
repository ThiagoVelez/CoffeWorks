# CoffeeAnimate3D · Fase 5 — Modelado libre (diseño)

Fecha: 2026-11-15 · Estado: pendiente de aprobación del usuario

## Para qué

El usuario quiere crear **criaturas y personajes de formas orgánicas para SurvivalForest**
(un lobo, un venado, una persona: formas redondeadas en vez de cajas) y que la herramienta
**sirva también para otros proyectos**, fuera del estilo de bloques.

Hoy CoffeeAnimate3D solo hace piezas rígidas (cubo, cilindro, esfera, rampa, plano), cada
una con 6 caras pintables de 32×32, y cada pieza es un hueso que se mueve entera. Con eso
no se puede hacer un cuerpo continuo que se doble en el codo o el cuello.

Éxito: el usuario parte de una forma básica, modela medio cuerpo de un animal con simetría,
lo suaviza, lo pinta directamente sobre el modelo, le pone huesos, lo anima en la línea de
tiempo que ya conoce y lo exporta a `.glb`. Ese `.glb` se ve doblándose bien en
SurvivalForest (Bevy) y en cualquier visor glTF (Blender, three.js).

## Decisiones del usuario

- **Malla que se dobla con los huesos (piel / *skinning*)**, no mallas rígidas.
  Una malla con todo el peso en un solo hueso se mueve rígida, así que lo rígido queda
  incluido.
- **Textura de píxeles pintada sobre el modelo**: despliegue automático de la malla en un
  mapa de textura y pintura directa en 3D con los pinceles de siempre, a 32, 64, 128 o
  256 px. Rellenar caras enteras de un color (estilo low-poly) también está.
- **Cómo construirlo: lo decide Claude** («haz lo que mejor pienses para la app»).

## Enfoques considerados

- **A. Dentro de CoffeeAnimate3D, como complemento de servicio «Modelado libre»
  (elegido, decisión de Claude).** Un tipo de pieza nuevo, *Malla*, con su modo de
  edición. Reutiliza huesos, línea de tiempo, curvas, poses, historial, exportación y MCP.
  Es lo que ya decía el diseño v2: el código va en la app y el Launcher solo lo activa.
- **B. App aparte («CoffeeSculpt»).** Separa el código, pero obliga a pasar el modelo entre
  dos apps en cada cambio y a repetir huesos, pintura y exportación. Descartado.
- **C. Blender como complemento externo.** El más potente, pero pesa cientos de MB, saca
  al usuario de la app y no encaja con la suite ligera. Descartado.

## Objetivos

1. Piezas de tipo **Malla** con edición de vértices, aristas y caras, simetría en X y
   suavizado.
2. **Textura** propia por malla, desplegada automáticamente y pintable sobre el modelo y en
   una vista 2D.
3. **Piel**: la malla se deforma con los huesos (las piezas existentes), con pesos
   automáticos y pincel de influencia; se anima con lo que ya existe.
4. **Exportación** `.glb` con piel (pasa el validador de Khronos con 0 errores) y `.obj`
   en reposo.
5. **MCP**: Claude puede crear y editar mallas, desplegarlas, pintarlas y ponerles pesos.

## No objetivos

- Escultura con topología dinámica (tipo ZBrush/Sculpt mode), booleanas, retopología.
- Cinemática inversa (IK), formas clave (*shape keys*/*blend shapes*) y animación facial.
- Mapas de normales, materiales PBR, varias capas UV o varias texturas por malla.
- Importar animaciones o pieles de archivos ajenos.

## Anti-objetivos (sería un fracaso aunque funcione)

- Romper cualquier `.ca3d` existente, sus animaciones o las 22 herramientas MCP actuales.
- Que un `.ca3d` con mallas no se vea, no se anime o no se exporte en un equipo **sin** el
  complemento: el complemento solo habilita **editar** mallas.
- Que la app base se vuelva lenta o confusa para quien solo usa cubos.
- Un `.glb` que en Blender o Bevy se vea distinto de como se ve en la app.

## Restricciones (del proyecto)

- TypeScript, React 19, three.js 0.186.1, `tsx --test`, Playwright. Tema oscuro.
- Funciona en WebView2 (Windows) y WebKitGTK (Linux): nada que dependa de WebGPU.
- Unidades: 16 = 1 bloque, +Y arriba, +Z delante.
- Toda edición pasa por `apply(next, key)` de `useStudioDoc` (historial y Ctrl+Z).
- Funciones puras con pruebas (TDD) en módulos aparte; la interfaz se comprueba con
  Playwright en cada entrega.
- Complemento en el catálogo de `coffee-core::addons` y en el del navegador
  (`src/services/tauriBridge.ts`), como `ca3d-render`.

## Diseño

### Complemento

- Id `ca3d-modelado`, nombre «Modelado libre de CoffeeAnimate3D», `executable: ""`
  (servicio, «Sin descarga»), `apps: ["coffeeanimate3d"]`, licencia MIT.
- Sin el complemento: las mallas se ven, se animan, se exportan y se pueden mover/girar como
  pieza; los botones de crear y editar mallas, desplegar, pintar sobre malla y pesos
  muestran «Activa el complemento Modelado libre» con el botón de instalar (`ensureAddon`,
  como Render). Las herramientas MCP de mallas devuelven `needs` igual que `render`.

### Formato `.ca3d` versión 3

- `Model3D.version` pasa a `3`. `parseModel` acepta 1, 2 y 3; un archivo sin mallas
  abierto y guardado solo cambia `version`.
- `Part` gana `mesh: MeshData | null` (exclusivo con `box`: una pieza tiene caja, malla o
  ninguna —grupo/hueso—). `validateModel` marca piezas con las dos.
- `MeshData`:
  - `vertices: Vec3[]` relativos al pivote de la pieza.
  - `faces: number[][]` (polígonos de 3 o más vértices, en sentido antihorario visto desde
    fuera; las herramientas trabajan sobre todo con cuadriláteros).
  - `uvs: number[][]` por esquina de cara (mismo orden que `faces`), en [0, 1];
    vacío hasta el primer despliegue.
  - `texture: { size: 32 | 64 | 128 | 256; color: string; pixels?: string }`
    (RGBA en base64, como `FaceTex`).
  - `mirrorX: boolean` (modificador de simetría, ver abajo), `subdivision: 0 | 1 | 2`,
    `smooth: boolean` (sombreado suave).
  - `weights?: { bone: string; w: number }[][]` por vértice, máximo 4, suma 1; sin pesos,
    la malla es rígida y sigue a su propia pieza.
- Límite: 20 000 caras en la malla base; por encima, las operaciones que la superarían se
  rechazan con un aviso.

### Entrega 1 — Modelado

- **Crear**: *Añadir › Malla* con forma de partida (cubo subdividido, esfera de cuadriláteros,
  cilindro, plano) y *Convertir en malla* para una pieza existente (cubo, cilindro, esfera,
  rampa o plano), que conserva su forma y su pintura (los píxeles de cada cara pasan a la
  textura de la malla).
- **Importar como malla editable**: `.obj` y `.glb` ajenos pueden entrar como malla
  (geometría, sin textura), además de como referencia (decisión de Claude: hace la
  herramienta útil para otros proyectos).
- **Modo Editar malla** (Tab sobre una malla, en el modo Modelar): selección de vértices
  (1), aristas (2) y caras (3); clic, Mayús+clic, selección por rectángulo, bucle
  (Alt+clic), todo (A), conectado (L).
- **Transformar** la selección con el gizmo existente (mover, girar, escalar) y
  **edición proporcional** (O) con radio ajustable, para modelar formas orgánicas.
- **Operaciones**: extruir (E), insertar cara (I), corte en bucle (Ctrl+R), biselar
  aristas (Ctrl+B), unir vértices (M: al centro o por distancia), borrar (Supr), crear cara
  (F), subdividir la selección, relajar (suavizar posiciones), invertir y recalcular
  normales.
- **Simetría en X** (modificador): se modela la mitad con `x ≥ 0`; la otra mitad se genera
  al mostrar y exportar, soldando los vértices sobre `x = 0`. Los vértices del centro no
  pueden cruzar al otro lado. Comparte UV con la mitad modelada (se pinta una vez, sale en
  los dos lados). *Aplicar simetría* la vuelve geometría real.
- **Suavizado**: subdivisión Catmull–Clark de nivel 0, 1 o 2 aplicada al mostrar y
  exportar (no destructiva), y sombreado suave. *Aplicar* la convierte en malla real.
- Orden de modificadores fijo: simetría → subdivisión.

### Entrega 2 — Textura

- **Desplegar** (UV automático) con **xatlas** compilado a WASM (librería MIT; el paquete
  concreto lo elige quien construye). Si la topología cambia después de pintar, la app
  ofrece volver a desplegar **conservando la pintura** (re-proyecta la textura vieja sobre
  la nueva UV).
- **Pintar sobre el modelo**: el rayo del ratón da la cara y el punto, y de ahí el píxel.
  Herramientas: lápiz (1–8 px), borrador (al color base), relleno de cara, relleno de isla,
  cuentagotas. Con simetría activa se pinta en los dos lados a la vez.
- **Vista UV 2D** (panel): la textura con los contornos de las islas; se puede pintar ahí
  también.
- Resolución 32/64/128/256 por malla; cambiarla re-muestrea la pintura (vecino más
  cercano). Exportar e importar la textura como PNG.

### Entrega 3 — Esqueleto

- Los **huesos son las piezas** que ya existen (también cubos y grupos). En las propiedades
  de la malla, *Deformar con huesos* elige qué piezas la afectan.
- **Pesos automáticos** (calculados por distancia a los segmentos de hueso y suavizados
  sobre la malla; el método exacto lo decide quien construye) y **pincel de influencia**
  (sumar, restar, suavizar; radio y fuerza), con mapa de calor del hueso elegido.
- **Pesos con simetría** (decisión de Claude): los pesos se guardan solo en la mitad
  modelada. La mitad generada usa, para cada hueso, su **pareja por nombre**
  (`mirrorName`: «Pata delantera izquierda» ↔ «… derecha»); si el hueso no tiene pareja
  (columna, cabeza, cola) usa el mismo hueso. Los vértices del centro (`x = 0`) reparten el
  peso de un hueso con pareja a medias entre los dos. La app avisa de los huesos laterales
  sin pareja y ofrece crearla con *Reflejar* (M), que ya existe.
- **La pieza de la malla** (decisión de Claude) actúa como una articulación más: se puede
  mover, girar y animar, y los vértices sin pesos (o con peso en ella) la siguen. Al
  exportar, la geometría con piel va en un nodo propio sin transformación en la raíz
  (como pide glTF), y la pieza sigue siendo un nodo-articulación con sus hijos, así que se ve
  igual en la app, en Blender y en Bevy.
- La deformación usa la **pose de reposo** del modelo como pose de unión. En el modo Animar
  la malla se ve deformada; las claves, curvas, poses, papel cebolla y Render funcionan sin
  cambios.
- **Exportación**:
  - `.glb` con `skin` (articulaciones = nodos de las piezas, `inverseBindMatrices`,
    `JOINTS_0`, `WEIGHTS_0`), textura propia por malla, 0 errores en el validador, y el
    `.ca3d` completo en `asset.extras.ca3d` como ahora (ida y vuelta exacta).
  - `.obj` con la malla en reposo (con simetría y subdivisión aplicadas).
- **Plantilla nueva**: una criatura orgánica de ejemplo (decisión de Claude: un zorro
  low-poly con huesos y una animación de andar) para empezar sin partir de cero.

### Entrega 4 — MCP

- Herramientas nuevas (todas comprueban el complemento con `needs`): `add_mesh` (forma de
  partida), `mesh_info` (vértices, caras, modificadores, si está desplegada),
  `edit_mesh` (operación + selección por índices: mover, extruir, insertar, corte en bucle,
  biselar, unir, borrar), `set_mesh_modifiers`, `unwrap_mesh`, `paint_mesh` (píxeles en UV
  o rellenar caras), `auto_weights`, `set_weights`.
- Las 22 herramientas actuales no cambian (salvo aceptar una pieza de malla donde tenga
  sentido, p. ej. `update_part` para moverla).

### Rendimiento

- Mallas base de hasta ~5 000 caras deben editarse con fluidez (60 fps al mover la
  selección en un equipo modesto); la subdivisión se recalcula al soltar, no en cada
  movimiento, si hace falta.

## Entregas

Cada entrega es un PR propio, con pruebas, README y versión nueva de la suite:

1. Modelado (con el formato v3 y el complemento).
2. Textura.
3. Esqueleto, exportación con piel y plantilla.
4. MCP.

## Lo que decide quien construye

- Estructura interna de la malla en memoria (p. ej. medio-arista) y en qué módulos se
  reparte (`mesh.ts`, `meshops.ts`, `subdiv.ts`, `uv.ts`, `skin.ts`…).
- Si la deformación se hace en CPU (función pura probada) o con `SkinnedMesh` de three.js,
  siempre que se vea igual que el `.glb`.
- El paquete de xatlas y cómo se carga el WASM.
- Algoritmo de pesos automáticos y de re-proyección de textura.
- Atajos menores, iconos, textos y disposición de paneles dentro del estilo actual.
- Pruebas exactas (siempre: invariantes de malla —caras orientadas, sin índices rotos—,
  conteos de subdivisión, simetría, UV en [0,1], deformación, validador glTF).

## Decisiones de Claude marcadas para revisar

- Todo dentro de CoffeeAnimate3D como complemento de servicio (enfoque A).
- Importar `.obj`/`.glb` ajenos también como malla editable (solo geometría).
- Simetría y subdivisión como modificadores no destructivos, en ese orden fijo.
- Una sola textura por malla; la simetría comparte UV entre los dos lados.
- Plantilla de ejemplo: un zorro low-poly con animación de andar.
- Sin escultura, IK ni formas clave en esta fase.
- Pesos de la mitad reflejada por pareja de nombre (`mirrorName`); los huesos sin pareja
  se comparten.
- La pieza de la malla es una articulación más; la geometría con piel va en un nodo raíz
  sin transformación al exportar.
- «Se ve bien en SurvivalForest» se comprueba en este repo con el validador de Khronos y
  el cargador glTF de three.js (piel y animación). Cargar las criaturas en el juego (Bevy)
  es trabajo de SurvivalForest y va con sus etapas 2–5, no en esta fase.
