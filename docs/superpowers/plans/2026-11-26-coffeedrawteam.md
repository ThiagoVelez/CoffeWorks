# CoffeeDrawTeam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva app de la suite, CoffeeDrawTeam (categoría «Equipos»): tablero infinito para trabajo en grupo con link para compartir, cursores de colores, nombres e historial.

**Architecture:** App Tauri `CoffeeDrawTeam/` (React 19 + TS + Vite) como las demás. El tablero es un documento **Yjs**; la sincronización (estrella: el anfitrión reenvía) vive en TS sobre una interfaz `Transporte`. El transporte real está en Rust (`webrtc` + presentación cifrada por relés **Nostr** públicos), porque WebKitGTK de Ubuntu 24.04 no trae WebRTC; las pruebas usan un transporte en memoria.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind 3, `yjs`, `y-protocols`, `jspdf`; Rust: Tauri 2, `webrtc` 0.21, `nostr-sdk` 0.45, `chacha20poly1305`, `hkdf`, `sha2`, `tauri-plugin-deep-link` 2, `tauri-plugin-single-instance` 2 (feature `deep-link`); pruebas `tsx --test`, `cargo test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-coffeedrawteam-design.md`

## Global Constraints

- Interfaz y textos en español; estilo, tema claro/oscuro e iconos como el resto de la suite (`shared/theme`, `shared/studio`).
- Puerto de desarrollo **1443**; identificador `com.coffeeworks.coffeedrawteam`; categoría **«Equipos»**; color **`#f08c2e`**; extensión **`.cdteam`**; esquema **`coffeedrawteam://unirse/<sala>#<clave>`**.
- Sala y clave aleatorias de **128 bits** (base64url sin relleno, 22 caracteres).
- Máximo **10 personas** por tablero; paleta de **12 colores**; historial: agrupar ediciones de la misma persona sobre el mismo elemento en **30 s**, tope **5000** líneas.
- Imágenes reducidas a **2048 px** de lado y **1,5 MB**.
- Presencia (cursores) como máximo **20 envíos por segundo**; no se guarda.
- Topología en **estrella**: los invitados solo aceptan datos del anfitrión.
- Los relés Nostr solo ven datos cifrados con una clave derivada de la clave del link.
- Los invitados no guardan el tablero salvo «Guardar una copia».
- Licencias de dependencias solo MIT/Apache/BSD; añadirlas a los avisos de terceros si la suite los lista.
- Sin identificadores de modelo en commits; commits con los trailers de la sesión.

## Review Focus

- Dos personas editan el mismo elemento a la vez → ambos cambios se fusionan y nadie pierde texto (Task 4, prueba `ediciones simultáneas`).
- El anfitrión cierra la app con invitados dentro → los invitados ven «El anfitrión cerró el tablero» y no pueden seguir editando una copia que luego se pierda en silencio (Task 4, prueba `anfitrión se va`).
- Un expulsado intenta volver con el link viejo → no entra (Task 4, prueba `expulsar rota el link`; Task 5, prueba `clave vieja rechazada`).
- Un invitado manda un cambio falsificado a nombre de otro → el historial muestra su nombre real (Task 4, prueba `nombre lo pone el anfitrión`).
- Link pegado con espacios, saltos de línea o texto alrededor (como llega de WhatsApp) → se reconoce (Task 3, prueba `leerLink tolera texto alrededor`).

---

### Task 1: Estructura de la app

**Files:**
- Create: `CoffeeDrawTeam/` (copiando la estructura de `CoffeeConvert/`: `index.html`, `package.json` con nombre `coffeedrawteam`, `vite.config.ts` con puerto 1443, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src-tauri/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json,src/main.rs,icons/}`)
- Modify: `Cargo.toml` (miembro `CoffeeDrawTeam/src-tauri`), `scripts/sync-shared.mjs` (añadir `CoffeeDrawTeam` a los grupos `theme` y `studio`)

**Interfaces:**
- Produces: paquete npm `coffeedrawteam` con scripts `dev`, `build`, `test` (`tsx --test src/**/*.test.ts`); crate `coffeedrawteam` con bin `CoffeeDrawTeam`.

- [ ] **Step 1:** Crear la estructura; `App.tsx` muestra solo la pantalla de inicio vacía con el título «CoffeeDrawTeam». Dependencias npm: `yjs`, `y-protocols`, `jspdf`, `lucide-react` y las de la plantilla; dev: `tsx`, `@types/node`.
- [ ] **Step 2:** Ejecutar `node scripts/sync-shared.mjs` y `node scripts/sync-shared.mjs --check`. Esperado: sin «Desactualizado».
- [ ] **Step 3:** Ejecutar `cd CoffeeDrawTeam && npm install && npm run build` y `cargo check -p coffeedrawteam`. Esperado: ambos sin errores.
- [ ] **Step 4:** Commit `CoffeeDrawTeam: estructura de la app`.

---

### Task 2: Modelo del tablero y plantillas

**Files:**
- Create: `CoffeeDrawTeam/src/board/model.ts`, `CoffeeDrawTeam/src/board/templates.ts`
- Test: `CoffeeDrawTeam/src/board/model.test.ts`, `CoffeeDrawTeam/src/board/templates.test.ts`

**Interfaces:**
- Produces (`model.ts`):
  - `type NotaColor = "amarillo"|"rosa"|"verde"|"azul"|"naranja"|"lila"`
  - `type Elemento = Nota | Texto | Forma | Conector | Trazo | Imagen`, todos con `{ id: string; kind; x: number; y: number; w: number; h: number; z: number; autor: string }`; `Nota {kind:"nota"; color: NotaColor; texto: string}`, `Texto {kind:"texto"; texto; tam: number; negrita: boolean; color: string}`, `Forma {kind:"forma"; forma:"rect"|"elipse"|"rombo"|"flecha"; relleno: string; borde: string; texto: string}`, `Conector {kind:"conector"; desde: Extremo; hasta: Extremo; estilo:"recto"|"codo"; flecha: boolean; color: string}` con `Extremo = {id: string} | {x: number; y: number}`, `Trazo {kind:"trazo"; puntos: number[]; grosor: number; color: string; marcador: boolean}`, `Imagen {kind:"imagen"; imagenId: string}`.
  - `crearTablero(): Y.Doc` con `getMap("elementos")` (`Y.Map<Y.Map<unknown>>`), `getArray("historial")`, `getMap("imagenes")` (`Uint8Array`), `getMap("meta")`.
  - `agregar(doc, el: Elemento, origen: unknown): void`, `actualizar(doc, id, cambios: Partial<Elemento>, origen): void`, `borrar(doc, ids: string[], origen): void` (también borra conectores cuyos extremos apuntan a esos ids), `listar(doc): Elemento[]` ordenado por `z`, `alFrente(doc, ids, origen)`, `nuevoId(): string`.
  - `extremoPos(doc, e: Extremo): {x,y}` (centro del elemento o el punto).
- Produces (`templates.ts`): `type PlantillaId = "blanco"|"lluvia"|"mapa"|"proscontras"|"kanban"`, `aplicarPlantilla(doc, id: PlantillaId, autor: string): void`, `PLANTILLAS: {id: PlantillaId; nombre: string}[]`.

- [ ] **Step 1: Pruebas** — `agregar y listar ordena por z`; `actualizar texto de una nota` (texto cambia, resto igual); `borrar quita conectores colgantes` (nota A, nota B, conector A→B; borrar A ⇒ quedan solo B); `alFrente pone el z más alto`; `cada plantilla crea elementos` (`blanco` 0 elementos; `lluvia` ≥ 1 nota central + 6 notas; `kanban` 3 formas con textos «Por hacer», «Haciendo», «Hecho»; `proscontras` textos «Pros» y «Contras»; `mapa` ≥ 1 forma central y conectores).
- [ ] **Step 2:** `npm test` → FALLA (módulo no existe).
- [ ] **Step 3:** Implementar. Cada elemento es un `Y.Map` (claves = propiedades) para que cambios en propiedades distintas se fusionen; `texto` como string (último en escribir gana por propiedad, suficiente para notas cortas).
- [ ] **Step 4:** `npm test` → PASA.
- [ ] **Step 5:** Commit `CoffeeDrawTeam: modelo del tablero y plantillas`.

---

### Task 3: Personas, historial, links e imágenes

**Files:**
- Create: `CoffeeDrawTeam/src/board/personas.ts`, `history.ts`, `link.ts`, `imagenes.ts`
- Test: `personas.test.ts`, `history.test.ts`, `link.test.ts`, `imagenes.test.ts` (misma carpeta)

**Interfaces:**
- `personas.ts`: `interface Persona { id: string; nombre: string; color: string }`; `PALETA: string[]` (12 colores con contraste ≥ 3:1 sobre blanco y sobre `#1e1e1e`); `colorLibre(preferido: string, usados: string[]): string`; `cargarPerfil(): {nombre: string; color: string} | null`, `guardarPerfil(p)` (localStorage `coffeedrawteam_perfil`, con try/catch); `nombreValido(n: string): string | null` (recorta, 1–24 caracteres, si no `null`).
- `history.ts`: `type Accion = "entro"|"salio"|"expulsado"|"agrego"|"edito"|"movio"|"borro"|"cambioLink"`; `interface Entrada { personaId: string; accion: Accion; kind?: Elemento["kind"]; elementoId?: string; detalle?: string; t: number }`; `registrar(doc, e: Entrada): void`; `entradas(doc, filtroPersona?: string): Entrada[]` (más reciente primero); `describir(e: Entrada, nombreDe: (id) => string): string`.
- `link.ts`: `crearSala(): {sala: string; clave: string}`; `aLink(s): string`; `leerLink(texto: string): {sala: string; clave: string} | null`.
- `imagenes.ts`: `reducirImagen(datos: Blob): Promise<{bytes: Uint8Array; w: number; h: number; tipo: "image/png"|"image/jpeg"|"image/webp"}>`; `planReduccion(w: number, h: number, bytes: number): {w: number; h: number; recodificar: boolean}` (pura).

- [ ] **Step 1: Pruebas**
  - `colorLibre devuelve el preferido si nadie lo usa` y `el siguiente de la paleta si está usado`; con los 12 usados devuelve el preferido.
  - `nombreValido` : `"  Sofía "`→`"Sofía"`, `""`→`null`, 25 caracteres→`null`.
  - `registrar agrupa ediciones en 30 s` (dos `edito` de la misma persona y elemento con t=0 y t=29 000 ⇒ 1 entrada con t=29 000; con t=31 000 ⇒ 2); `no agrupa personas distintas`; `tope 5000` (5001 registros ⇒ 5000, se descarta el más viejo); `filtra por persona`; `describir` : `{accion:"agrego", kind:"nota", detalle:"Ideas"}` ⇒ `"Sofía añadió una nota «Ideas»"`.
  - `aLink y leerLink ida y vuelta`; `leerLink tolera texto alrededor` (`"únete: coffeedrawteam://unirse/AAA…#BBB… \n"` ⇒ sala y clave); `leerLink rechaza basura` (`"hola"` ⇒ `null`; sala de longitud ≠ 22 ⇒ `null`).
  - `planReduccion` : 4000×3000 ⇒ 2048×1536 y `recodificar` true; 800×600 con 200 KB ⇒ igual y false; 800×600 con 3 MB ⇒ `recodificar` true.
- [ ] **Step 2:** `npm test` → FALLA.
- [ ] **Step 3:** Implementar. Sala y clave con `crypto.getRandomValues(new Uint8Array(16))` en base64url. `reducirImagen` usa `createImageBitmap` + `OffscreenCanvas`; JPEG calidad 0,85 bajando de 0,1 en 0,1 hasta ≤ 1,5 MB (PNG con transparencia se mantiene PNG y solo se escala).
- [ ] **Step 4:** `npm test` → PASA.
- [ ] **Step 5:** Commit `CoffeeDrawTeam: personas, historial, links e imágenes`.

---

### Task 4: Sesión compartida (sincronización en estrella)

**Files:**
- Create: `CoffeeDrawTeam/src/sync/transporte.ts`, `protocolo.ts`, `sesion.ts`, `transporteMemoria.ts`
- Test: `CoffeeDrawTeam/src/sync/sesion.test.ts`

**Interfaces:**
- `transporte.ts`:
  ```ts
  export interface Transporte {
    enviar(destino: string | "todos", datos: Uint8Array): void;
    alRecibir(cb: (origen: string, datos: Uint8Array) => void): void;
    alEntrar(cb: (peer: string) => void): void;
    alSalir(cb: (peer: string) => void): void;
    alEstado(cb: (e: EstadoRed) => void): void;
    cortar(peer: string): void;
    cambiarSala(sala: string, clave: string): Promise<void>;
    cerrar(): void;
  }
  export type EstadoRed = { tipo: "conectando" } | { tipo: "conectado" } | { tipo: "error"; mensaje: string } | { tipo: "cerrado" };
  ```
- `protocolo.ts`: mensajes con un byte de tipo: `SYNC` (y-protocols sync step 1/2 y update), `PRESENCIA` (JSON `{x,y,seleccion: string[]}`), `HOLA` (JSON `{nombre, color}`), `ROSTER` (JSON `Persona[]`), `EXPULSADO`, `LLENO`, `CERRADO`, `NUEVA_SALA` (JSON `{sala, clave}`); `codificar(tipo, cuerpo)`, `decodificar(bytes): {tipo, cuerpo} | null` (bytes inválidos ⇒ `null`, nunca excepción).
- `sesion.ts`:
  - `class SesionAnfitrion { constructor(doc: Y.Doc, t: Transporte, yo: Persona, link: {sala, clave}); personas(): Persona[]; expulsar(id: string): Promise<{sala, clave}>; cambiarLink(): Promise<{sala, clave}>; presencia(p): void; alCambio(cb: () => void): void; cerrar(): void }`
  - `class SesionInvitado { constructor(doc: Y.Doc, t: Transporte, yo: {nombre, color}); personas(): Persona[]; presencia(p): void; alCambio(cb); alFin(cb: (motivo: "cerrado"|"expulsado"|"lleno") => void): void; cerrar(): void }`
  - `presenciaDe(id): {x,y,seleccion} | undefined` en ambas.
  - El anfitrión: asigna `Persona.id` = id del peer, aplica `colorLibre`, reenvía updates Yjs a los demás invitados, registra en el historial `entro`/`salio`/`expulsado`/`cambioLink`, rechaza la persona 11 con `LLENO`. Las entradas del historial de un invitado las escribe el anfitrión al aplicar su update, con el `personaId` del peer que lo envió (origen del update = peer).
  - El invitado ignora todo lo que no venga del anfitrión (primer peer con el que habla el transporte nativo; en el transporte en memoria, el `anfitrion` declarado).

- [ ] **Step 1: Pruebas** (con `crearRedMemoria()` de `transporteMemoria.ts`, que crea transportes enlazados en memoria con entrega asíncrona):
  - `invitado recibe el tablero al entrar` (anfitrión con 3 notas ⇒ invitado ve 3).
  - `ediciones simultáneas` (dos invitados editan propiedades distintas del mismo elemento y añaden notas a la vez ⇒ los 3 documentos quedan iguales con todo).
  - `nombre lo pone el anfitrión` (invitado B añade una nota; la entrada del historial tiene `personaId` = id de B aunque el update diga otro autor).
  - `colores sin repetir` (dos invitados piden el mismo color ⇒ colores distintos).
  - `lleno a los 10` (anfitrión + 9 invitados entran; el 10.º invitado recibe `alFin("lleno")`).
  - `expulsar rota el link` (expulsar ⇒ el expulsado recibe `alFin("expulsado")`, los demás reciben `NUEVA_SALA` y siguen sincronizados, `cambiarSala` fue llamado con una sala distinta).
  - `anfitrión se va` (anfitrión `cerrar()` ⇒ cada invitado recibe `alFin("cerrado")` y su doc deja de aceptar cambios locales: `sesion.activa === false`).
  - `invitado ignora a otros invitados` (un invitado envía SYNC directamente a otro ⇒ no se aplica).
  - `bytes basura no rompen` (enviar `Uint8Array([255,1,2])` ⇒ sin excepción).
  - `presencia limitada a 20 por segundo` (100 llamadas a `presencia` en 1 s con reloj falso ⇒ ≤ 20 mensajes).
- [ ] **Step 2:** `npm test` → FALLA.
- [ ] **Step 3:** Implementar con `y-protocols/sync` (`writeSyncStep1`, `readSyncMessage`) y `doc.on("update", (u, origen) => …)` reenviando a todos menos al origen.
- [ ] **Step 4:** `npm test` → PASA.
- [ ] **Step 5:** Commit `CoffeeDrawTeam: sesión compartida en estrella`.

---

### Task 5: Red nativa (Rust): WebRTC + presentación cifrada por Nostr

**Files:**
- Create: `CoffeeDrawTeam/src-tauri/src/red/mod.rs`, `cifrado.rs`, `senal.rs`, `par.rs`
- Modify: `CoffeeDrawTeam/src-tauri/src/main.rs`, `CoffeeDrawTeam/src-tauri/Cargo.toml`
- Create: `CoffeeDrawTeam/src/sync/transporteNativo.ts`

**Interfaces:**
- `cifrado.rs`: `pub struct ClaveSala([u8; 32])`; `ClaveSala::desde_link(clave_b64: &str) -> Result<Self, String>` (HKDF-SHA256, info `b"coffeedrawteam/senal/v1"`); `fn sellar(&self, texto: &[u8]) -> Vec<u8>` (XChaCha20-Poly1305, nonce aleatorio de 24 bytes al inicio); `fn abrir(&self, datos: &[u8]) -> Option<Vec<u8>>`; `pub fn etiqueta_sala(sala: &str) -> String` (hex de SHA-256 de `"coffeedrawteam:" + sala`; es lo único en claro en el relé).
- `senal.rs`: `#[async_trait] pub trait Senalizacion: Send + Sync { async fn publicar(&self, msg: Vec<u8>) -> Result<(), String>; async fn recibir(&self) -> Option<Vec<u8>>; }`; `RelesNostr::conectar(etiqueta: &str) -> Result<Self, String>` (eventos efímeros kind 25050 con etiqueta `t` = `etiqueta_sala`, claves Nostr desechables por sesión, relés: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`, `wss://nostr.mom`); `SenalMemoria::par() -> (SenalMemoria, SenalMemoria)` para pruebas. Mensajes de señal (JSON sellado): `{de, para, tipo: "anfitrion"|"oferta"|"respuesta"|"candidato", sdp?, candidato?}`.
- `par.rs`: `pub struct Nodo` con `Nodo::anfitrion(senal, clave) / Nodo::invitado(senal, clave)`, `enviar(peer: Option<&str>, datos: Vec<u8>)`, `cortar(peer)`, `eventos() -> mpsc::Receiver<EventoRed>` con `enum EventoRed { Entra(String), Sale(String), Dato(String, Vec<u8>), Estado(String, Option<String>) }`. Un canal de datos ordenado y fiable por invitado; STUN `stun:stun.l.google.com:19302` y `stun:stun.cloudflare.com:3478`. Los invitados solo abren conexión con el anfitrión (estrella).
- Comandos Tauri: `red_anfitrion(sala, clave)`, `red_unirse(sala, clave)`, `red_enviar(destino: Option<String>, datos: String /*base64*/)`, `red_cortar(peer)`, `red_cambiar_sala(sala, clave)`, `red_cerrar()`. Eventos: `red:entra {peer}`, `red:sale {peer}`, `red:dato {peer, datos}`, `red:estado {estado: "conectando"|"conectado"|"error"|"cerrado", mensaje?}`.
- `transporteNativo.ts`: `crearTransporteNativo(modo: "anfitrion"|"invitado", sala, clave): Promise<Transporte>` sobre esos comandos y eventos.

- [ ] **Step 1: Pruebas Rust** (`cargo test -p coffeedrawteam`): `sellar_y_abrir`; `abrir_rechaza_alterado` (cambiar un byte ⇒ `None`); `clave_vieja_rechazada` (sellado con clave A, abierto con B ⇒ `None`); `etiqueta_no_revela_sala` (la etiqueta no contiene la sala); `dos_nodos_hablan` (con `SenalMemoria::par()`, anfitrión e invitado en localhost sin STUN intercambian 3 mensajes, incluido uno de 1 MB, y llega `Entra`/`Sale`).
- [ ] **Step 2:** `cargo test -p coffeedrawteam` → FALLA.
- [ ] **Step 3:** Implementar. Dependencias: `webrtc = "0.21"`, `nostr-sdk = "0.45"`, `chacha20poly1305 = "0.10"`, `hkdf = "0.12"`, `sha2 = "0.10"`, `tokio` (features `sync`, `rt`, `macros`), `async-trait`, `rand`, `serde`, `serde_json`, `base64`. Mensajes de más de 16 KB se trocean (cabecera `id, parte, total`) y se reensamblan.
- [ ] **Step 4:** `cargo test -p coffeedrawteam` y `cargo clippy -p coffeedrawteam -- -D warnings` → PASA.
- [ ] **Step 5: Prueba manual de humo** con dos procesos en la misma máquina y relés reales: `cargo run -p coffeedrawteam -- --probar-red` (modo oculto que crea una sala, se une a sí mismo como invitado y escribe `red OK` o el error). Esperado: `red OK` en < 20 s.
- [ ] **Step 6:** Commit `CoffeeDrawTeam: red nativa (WebRTC y presentación por Nostr)`.

---

### Task 6: Lienzo y herramientas básicas

**Files:**
- Create: `CoffeeDrawTeam/src/canvas/Lienzo.tsx`, `vista.ts` (cámara: pan/zoom), `seleccion.ts`, `render.tsx` (SVG por elemento), `Minimapa.tsx`, `BarraHerramientas.tsx`, `Inspector.tsx`
- Test: `CoffeeDrawTeam/src/canvas/vista.test.ts`, `seleccion.test.ts`

**Interfaces:**
- Consumes: `model.ts`, `templates.ts` (Task 2).
- `vista.ts`: `interface Camara {x: number; y: number; zoom: number}`; `aPantalla(c, p)`, `aTablero(c, p)`, `zoomEn(c, factor, punto): Camara` (zoom limitado a 0,1–4), `ajustarTodo(cajas, ancho, alto): Camara`.
- `seleccion.ts`: `elementosEnRect(els, rect): string[]`, `cajaDe(els, ids)`, `redimensionar(el, asa, delta, mantenerProporcion): Partial<Elemento>`.
- `Lienzo` props: `{doc: Y.Doc; yo: Persona; soloLectura: boolean; undo: Y.UndoManager; alSeleccionar(ids: string[]): void; irA?: string /*id a centrar y resaltar*/}`.
- Herramientas y atajos del spec: V, H/espacio, N (6 colores), T, R (rect, elipse, rombo, flecha), zoom 10 %–400 %, minimapa, «ajustar todo». Deshacer/rehacer con `Y.UndoManager` que solo rastrea el origen local (Ctrl+Z / Ctrl+Shift+Z).

- [ ] **Step 1: Pruebas** — `aTablero(aPantalla(p)) === p`; `zoomEn mantiene fijo el punto bajo el ratón`; `zoom no baja de 0,1 ni sube de 4`; `ajustarTodo encuadra todas las cajas con margen`; `elementosEnRect solo los contenidos`; `redimensionar con Shift mantiene proporción`.
- [ ] **Step 2:** `npm test` → FALLA. **Step 3:** Implementar. **Step 4:** `npm test` → PASA; `npm run build` sin errores.
- [ ] **Step 5:** Commit `CoffeeDrawTeam: lienzo, notas, texto y formas`.

---

### Task 7: Conectores, dibujo a mano e imágenes

**Files:**
- Create: `CoffeeDrawTeam/src/canvas/conectores.ts`, `trazos.ts`
- Modify: `Lienzo.tsx`, `render.tsx`, `BarraHerramientas.tsx`
- Test: `conectores.test.ts`, `trazos.test.ts`

**Interfaces:**
- `conectores.ts`: `rutaConector(doc, c: Conector): {puntos: number[]}` (recto: 2 puntos en el borde de cada elemento; codo: 3–4 puntos ortogonales).
- `trazos.ts`: `simplificar(puntos: number[], tolerancia: number): number[]` (Ramer–Douglas–Peucker); `trazoTocado(t: Trazo, p, radio): boolean` (para el borrador).
- Herramientas: C (conector; soltar sobre un elemento lo engancha), P (lápiz) y marcador (semitransparente, más grueso), E (borrador de trazos), imagen (botón, pegar Ctrl+V, soltar archivos) usando `reducirImagen` y guardando bytes en `doc.getMap("imagenes")`.

- [ ] **Step 1: Pruebas** — `conector sigue al elemento movido` (mover A cambia la ruta); `conector recto sale del borde, no del centro`; `simplificar reduce puntos colineales`; `borrador toca un trazo cercano y no uno lejano`.
- [ ] **Step 2–4:** FALLA → implementar → PASA (`npm test`, `npm run build`).
- [ ] **Step 5:** Commit `CoffeeDrawTeam: conectores, dibujo a mano e imágenes`.

---

### Task 8: Trabajo en grupo: compartir, unirse, personas, cursores e historial

**Files:**
- Create: `CoffeeDrawTeam/src/equipo/Compartir.tsx`, `Unirse.tsx`, `Perfil.tsx`, `PanelPersonas.tsx`, `Cursores.tsx`, `PanelHistorial.tsx`, `EstadoConexion.tsx`, `useSesion.ts`
- Modify: `CoffeeDrawTeam/src/App.tsx`

**Interfaces:**
- Consumes: `SesionAnfitrion`, `SesionInvitado` (Task 4), `crearTransporteNativo` (Task 5), `personas.ts`, `history.ts`, `link.ts` (Task 3), `Lienzo` prop `irA` (Task 6).
- `useSesion(doc, modo, link?)`: `{estado: EstadoRed; personas: Persona[]; presencias: Map<string, {x,y,seleccion}>; compartir(): Promise<string /*link*/>; expulsar(id); cambiarLink(); fin?: "cerrado"|"expulsado"|"lleno"}`.
- Textos fijos del spec: «Conectando…», «Conectado (n personas)», «No se pudo conectar — tu red puede estar bloqueando la conexión directa» + «Reintentar», «El anfitrión cerró el tablero», «El tablero está lleno», «Tus compañeros necesitan CoffeeWorks con CoffeeDrawTeam».
- Primer uso: `Perfil` obligatorio (nombre válido y color). Unirse: pide confirmar el nombre (prellenado). Panel de personas: avatares con inicial y color; clic = seguir el cursor; «Expulsar» solo para el anfitrión. Cursores ajenos: flecha con etiqueta del nombre, se oculta tras 5 s quieta. Historial: lista con color, nombre, acción y hora (`HH:MM`), filtro por persona; clic ⇒ `irA` (si el elemento no existe, «ya no existe»).
- Durante pruebas e2e, `?red=memoria` en la URL usa `crearRedMemoria` con `BroadcastChannel` entre ventanas en lugar del transporte nativo.

- [ ] **Step 1:** Implementar los componentes y conectarlos en `App.tsx`.
- [ ] **Step 2:** `npm run build` sin errores; `npm test` sigue en verde.
- [ ] **Step 3:** Commit `CoffeeDrawTeam: compartir, personas, cursores e historial`.

---

### Task 9: Archivos, inicio y exportación

**Files:**
- Create: `CoffeeDrawTeam/src/archivo/formato.ts`, `exportar.ts`, `Inicio.tsx`
- Test: `CoffeeDrawTeam/src/archivo/formato.test.ts`

**Interfaces:**
- `formato.ts`: `serializar(doc: Y.Doc, meta: {nombre: string; link?: {sala, clave}; personas: Persona[]}): Uint8Array` (cabecera `CDTEAM1` + JSON de meta + estado Yjs); `deserializar(bytes): {doc: Y.Doc; meta} ` (lanza `Error("Archivo de CoffeeDrawTeam dañado")` si la cabecera o el contenido no son válidos).
- Store con `createDocStore` / `useStudioDoc` de `shared/studio` (extensión `cdteam`, autoguardado 3 s tras un cambio y al cerrar; solo el anfitrión).
- `Inicio.tsx`: «Nuevo tablero» con las plantillas, «Unirse a un tablero», «Mis tableros» (recientes de la Bóveda), «Tableros a los que me uní» (localStorage `coffeedrawteam_unidos`: `{nombre, link, fecha}[]`, máx. 20).
- Invitado: «Guardar una copia» crea un documento propio nuevo, sin link, con el contenido actual.
- `exportar.ts`: `exportarPNG(doc, ids?: string[]): Promise<Blob>`, `exportarPDF(doc, ids?): Promise<Blob>` (página del tamaño del contenido, `jspdf`).

- [ ] **Step 1: Pruebas** — `serializar y deserializar ida y vuelta` (elementos, historial e imágenes iguales); `archivo dañado lanza el mensaje`; `meta conserva link y personas`.
- [ ] **Step 2–4:** FALLA → implementar → PASA.
- [ ] **Step 5:** Commit `CoffeeDrawTeam: archivos, inicio y exportación`.

---

### Task 10: Integración en la suite y prueba de extremo a extremo

**Files:**
- Modify: `src-tauri/src/apps.rs` (entrada `coffeedrawteam`, categoría «Equipos», `file_type: ("cdteam", "Tablero de CoffeeDrawTeam")`, `claim_default: true`), `src/components/AppGrid.tsx`, `src/services/tauriBridge.ts`, `vite.config.ts`, `scripts/dev.mjs`, `scripts/build.mjs`, `.github/workflows/build-windows.yml`, `.github/workflows/build-linux.yml`, `installer/CoffeeWorks.iss` (registrar el esquema `coffeedrawteam`), `README.md`
- Create: `CoffeeWorks_Icon/CoffeeDrawTeam.*` e iconos de la app (tres notas adhesivas superpuestas con un cursor, mandarina `#f08c2e`), `CoffeeDrawTeam/e2e/equipo.spec.ts`
- Modify: `CoffeeDrawTeam/src-tauri/tauri.conf.json` + `main.rs` (plugins `deep-link` con esquema `coffeedrawteam` y `single-instance` con feature `deep-link`, que reenvía el link a la ventana abierta)

- [ ] **Step 1: Prueba e2e** (Playwright, dos páginas con `?red=memoria`): A crea tablero «Feria» y comparte; B pega el link, escribe «Sofía», entra; B añade una nota «Ideas» ⇒ A la ve; A ve el cursor de B con «Sofía»; el historial de A muestra «Sofía añadió una nota «Ideas»»; clic en esa línea centra la nota; A expulsa a B ⇒ B ve el aviso de expulsión.
- [ ] **Step 2:** `npx playwright test --trace off` en `CoffeeDrawTeam` → PASA.
- [ ] **Step 3:** Integrar en la suite como CoffeeConvert (commit `1f1a4de` como referencia). Versión con `node scripts/version.mjs 2.15.0 alpha` y `cargo update -w --offline`.
- [ ] **Step 4:** Verificar: `npm run build` (Launcher), `cd CoffeeDrawTeam && npm test && npm run build`, `cargo clippy --workspace -- -D warnings`, `node scripts/sync-shared.mjs --check`. En el Launcher (navegador) aparece la categoría «Equipos» con CoffeeDrawTeam.
- [ ] **Step 5:** `git checkout -- data/vault.json`; commit `CoffeeDrawTeam en la suite, README y versión 2.15.0`; push y PR.
