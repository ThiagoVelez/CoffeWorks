# CoffeeDrawTeam — diseño

Fecha: 2026-11-26 · Estado: borrador para aprobación del usuario

## Para qué

Un **tablero virtual infinito** para trabajar solo o en grupo: notas, diagramas, texto,
imágenes y dibujo a mano. Lo usan, sobre todo, **grupos de compañeros del colegio** para
trabajos en grupo y **lluvias de ideas**, cada uno desde su casa.

Éxito: creo un tablero, pulso «Compartir», mando el link por WhatsApp, mis compañeros lo
abren en su CoffeeDrawTeam, escriben su nombre y en segundos estamos editando el mismo
tablero, viendo el cursor de cada uno con su nombre y color, y con un historial de quién
hizo qué y cuándo.

Es la primera app de una categoría nueva del Launcher: **«Equipos»** (apps para trabajar en
grupo).

## Objetivos

- Tablero infinito con zoom y desplazamiento, solo o en grupo, con el mismo archivo.
- Elementos: notas adhesivas, texto, formas, conectores (diagramas), dibujo a mano alzada,
  imágenes.
- Compartir con un **link** que genera la app; quien lo recibe necesita la app instalada.
- Edición en **tiempo real** con **cursores de colores** y el nombre de cada persona.
- **Nombre obligatorio** al entrar a un tablero ajeno (se recuerda para la próxima vez).
- **Historial**: quién hizo qué y cuándo; clic en una línea → el tablero va a ese elemento.
- Quien crea el tablero (el **anfitrión**) puede **expulsar** a alguien y **cambiar el link**.

## No objetivos (por ahora)

- Que los demás editen cuando el anfitrión tiene la app cerrada (decidido: el tablero vive
  en el equipo de quien lo creó; si cierra, los demás ven «El anfitrión cerró el tablero» y
  vuelven a entrar cuando lo abra).
- Servidor propio, cuentas de usuario o guardado en la nube.
- Abrir el tablero desde el navegador sin la app.
- Chat, voz o video (el grupo ya usa WhatsApp o una llamada).
- Permisos finos (solo ver / comentar). Todos los invitados editan.

## Anti-objetivos (sería un fracaso aunque «funcione»)

- Que dos personas editando a la vez se pisen o pierdan trabajo.
- Que unirse sea complicado para un estudiante (más de pegar el link y escribir el nombre).
- Que el contenido del tablero pase sin cifrar por servidores de terceros.
- Que el tablero de un estudiante quede guardado en equipos ajenos sin que él lo sepa
  (los invitados no guardan copia salvo que la pidan con «Guardar una copia»).

## Enfoques considerados

- **A. Conexión directa (WebRTC) presentada por servicios públicos gratuitos** — *elegido
  por el usuario.* Los equipos se encuentran mediante servidores públicos existentes (relés
  Nostr, con trackers de BitTorrent como respaldo) y luego hablan directo y cifrado. Sin
  cuentas ni costos. Riesgos: dependemos de servicios de terceros y en redes muy cerradas
  (~1 de cada 10) la conexión directa puede fallar.
- **B. Igual que A con un servidor propio pequeño** (p. ej. Cloudflare Workers) — más fiable
  y admite un relé TURN para redes cerradas, pero el usuario tendría que crear y mantener una
  cuenta. Queda como **plan de respaldo**: la capa de conexión se aísla para poder cambiar a
  B sin tocar el resto de la app.
- **C. El equipo del anfitrión como servidor con un túnel** — descartado: depende de un
  servicio de túneles, tarda en abrirse y expone el equipo a internet.

## Cómo funciona

### Conexión

- Biblioteca **Trystero** (MIT) para WebRTC con presentación vía relés Nostr públicos
  (BitTorrent como respaldo si Nostr falla). La sala se cifra con la contraseña del link, así
  que los relés solo ven datos cifrados.
- **Topología en estrella**: los invitados solo aceptan datos del anfitrión; el anfitrión
  reenvía los cambios de cada uno a los demás. Así expulsar funciona de verdad y hay una sola
  copia que manda (la del anfitrión).
- **Link**: `coffeedrawteam://unirse/<sala>#<clave>` (sala y clave aleatorias de 128 bits).
  La app registra el esquema, así que donde el sistema lo permite un clic abre la app; si
  no (p. ej. WhatsApp no lo vuelve clicable), en la app hay «Unirse a un tablero» con un
  campo para pegar el link. El diálogo «Compartir» tiene «Copiar link» y el aviso «Tus
  compañeros necesitan CoffeeWorks con CoffeeDrawTeam».
- **Cambiar el link** genera sala y clave nuevas; los conectados siguen dentro (el anfitrión
  los pasa a la sala nueva), el link viejo deja de servir.
- **Expulsar** corta a esa persona, rota el link (para que no vuelva con el viejo) y lo
  anota en el historial.
- Estados visibles: «Conectando…», «Conectado (n personas)», «No se pudo conectar — tu red
  puede estar bloqueando la conexión directa» (con «Reintentar»), «El anfitrión cerró el
  tablero».
- **Riesgo a comprobar primero (Linux)**: la vista web de Tauri en Linux (WebKitGTK 2.52)
  puede venir sin WebRTC. La primera tarea del plan lo comprueba en Debian/Ubuntu; si falta,
  en Linux la conexión se hace en el lado nativo (Rust, crate `webrtc`) con la misma
  interfaz `Conexion`. En Windows (WebView2) WebRTC está disponible.

### Sincronización

- **Yjs** (MIT): el tablero es un documento Yjs (elementos, orden, historial). Los cambios
  simultáneos se fusionan sin conflictos y sin perder trabajo.
- Deshacer/rehacer por persona (`Y.UndoManager` con origen local): cada uno deshace solo lo
  suyo.
- Cursores y selección de cada persona van por un canal aparte de «presencia» (no se
  guardan), unas 20 veces por segundo como máximo.
- Imágenes: se reducen a un máximo de 2048 px de lado y 1,5 MB y se envían en trozos; las
  más grandes se avisan y se reducen.

### Personas, nombres y colores

- La primera vez que se abre la app pide **nombre** (obligatorio) y propone un **color** de
  una paleta de 12 colores con buen contraste; se pueden cambiar en Ajustes de la app.
- Al unirse a un tablero se confirma el nombre (prellenado). Si el color ya lo usa otra
  persona en esa sala, se le asigna el siguiente libre solo para esa sala.
- El anfitrión mantiene la lista de personas (id de conexión → nombre y color); el historial
  usa esa lista, así nadie aparece con el nombre de otro.
- Entrar no requiere aprobación del anfitrión: el link con su clave es el permiso; si se
  filtra, el anfitrión expulsa y cambia el link.
- Máximo **10 personas** a la vez por tablero (el anfitrión reenvía a todos; un grupo del
  colegio suele ser de 3 a 6). La persona 11 ve «El tablero está lleno».
- Panel de personas: avatares con inicial y color; clic → la vista sigue el cursor de esa
  persona; el anfitrión ve «Expulsar».

### Historial

- Lista en un panel lateral, más reciente arriba: color, nombre, acción y hora
  («Sofía añadió una nota «Ideas para la feria» · 15:32»).
- Acciones registradas: entró / salió / fue expulsado; añadió, editó, movió, borró
  (notas, texto, formas, conectores, imágenes, trazos); cambió el link.
- Las ediciones seguidas de la misma persona sobre el mismo elemento en menos de 30 s se
  agrupan en una sola línea (escribir una nota no genera 50 líneas).
- Clic en una línea → el tablero se centra en ese elemento y lo resalta (si se borró, se
  indica «ya no existe»).
- Filtro por persona. Se guarda con el tablero (máximo 5000 líneas; las más viejas se
  descartan).

### Herramientas del tablero

- Seleccionar / mover (V), mano (H o espacio).
- **Nota adhesiva** (N) con 6 colores, texto con ajuste automático de tamaño.
- **Texto** (T) con tamaño, negrita y color.
- **Formas** (R): rectángulo, elipse, rombo, flecha de bloque; con texto dentro.
- **Conector** (C): línea recta o en codo entre elementos, con o sin flecha; sigue a los
  elementos al moverlos.
- **Lápiz** (P) y **marcador** con grosor y color; **borrador** de trazos (E).
- **Imagen**: insertar, pegar o arrastrar archivos.
- **Plantillas para empezar**: en blanco, lluvia de ideas (idea central y notas
  alrededor), mapa mental, pros y contras, Kanban (por hacer / haciendo / hecho).
- Zoom 10 %–400 %, minimapa, «ajustar todo a la vista».
- Exportar a **PNG** y **PDF** (todo o lo seleccionado).

### Archivos y guardado

- Los tableros propios se guardan en la Bóveda de la suite como los demás documentos
  (`useStudioDoc`/`docStore`), con extensión **`.cdteam`**: estado Yjs + metadatos
  (nombre, fecha, link actual, lista de personas que han entrado).
- Autoguardado del anfitrión cada pocos segundos tras un cambio y al cerrar.
- Los invitados no guardan nada por defecto; «Guardar una copia» crea un tablero propio
  nuevo (sin compartir) con el contenido actual.
- Tableros recientes en la pantalla de inicio: «Mis tableros» y «Tableros a los que me
  uní» (estos solo guardan nombre y link para volver a entrar).

## Integración en la suite

- App Tauri nueva `CoffeeDrawTeam/` (puerto de desarrollo **1443**), React 19 + TypeScript
  + Vite como las demás, con `shared/studio` y `shared/theme` (tema claro/oscuro).
- Catálogo (`src-tauri/src/apps.rs`): categoría **«Equipos»** (nueva; el Launcher crea la
  categoría sola a partir del catálogo), color propio **naranja mandarina `#f08c2e`**,
  icono propio (tres notas adhesivas superpuestas con un cursor), tipo de archivo `.cdteam`.
- Esquema `coffeedrawteam://` registrado por el instalador (Windows) y el `.deb` (Linux).
- Instalador, CI de Windows y Linux, `scripts/dev.mjs`, `build.mjs`, README y versión de la
  suite como cualquier app nueva.

## Pruebas

- Lógica pura con `tsx --test`: modelo del tablero, agrupación del historial, asignación de
  colores, links (crear y leer), reducción de imágenes, plantillas.
- Sincronización: dos y tres documentos Yjs conectados por un canal falso en memoria
  (ediciones simultáneas, expulsar, cambiar link, anfitrión que se va).
- Playwright con dos ventanas en la misma máquina (canal local), para cursores, nombres e
  historial.
- Prueba manual de conexión real entre dos equipos en redes distintas antes de publicar.

## Lo que queda a criterio de quien construye

- Detalles visuales (dentro del estilo de la suite), atajos secundarios y textos de ayuda.
- Lista concreta de relés Nostr públicos (varios, con reintento) y trackers de respaldo.
- Cómo se dibujan los cursores ajenos (flecha con etiqueta del nombre, que se oculta tras
  unos segundos sin moverse).

## Decisiones tomadas por Claude (para revisar)

- Topología en estrella (para que expulsar funcione y el anfitrión tenga la copia que manda).
- Link con esquema propio + campo «pegar link» como camino seguro.
- Sin sala de espera: el link basta para entrar.
- Máximo 10 personas por tablero.
- Paleta de 12 colores; color libre por sala si hay choque.
- Agrupar ediciones de 30 s en el historial; tope de 5000 líneas.
- Imágenes reducidas a 2048 px / 1,5 MB.
- Plantillas de lluvia de ideas, mapa mental, pros y contras y Kanban.
- Color mandarina `#f08c2e` y extensión `.cdteam`.
