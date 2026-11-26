# CoffeeSound: separar voz y música, y sacar la letra

Fecha: 2026-11-26 · Estado: propuesto (enfoque A elegido por el usuario: «Sí, vamos con la A»).

## Para qué

El usuario quiere, en CoffeeSound, **separar una canción en voz y música** y, como función extra, **sacar la letra de lo que se canta y guardarla en un documento de texto**. No dijo el uso concreto; encaja con practicar o cantar encima (karaoke), remezclar y transcribir canciones.

**Éxito:** abre una canción, pulsa «Separar voz y música», obtiene dos audios limpios («Voz» y «Música») que puede escuchar, editar o llevar a la multipista; pulsa «Sacar la letra», revisa el texto en pantalla y lo descarga como `.txt` (y `.lrc` con tiempos).

## Objetivos

- Separar voz y acompañamiento con calidad de herramienta dedicada, en el equipo, sin internet ni cuentas.
- Dos audios nuevos en la sesión (recursos «<canción> — Voz» y «<canción> — Música»), y la opción de ponerlos en dos pistas de la multipista, alineados.
- Letra: transcripción de la voz separada, por frases, en el idioma de la canción (detectado o elegido: español, inglés, portugués, francés…).
- Revisar y corregir la letra en pantalla antes de guardarla; escuchar cada frase con un clic.
- Guardar como **texto (.txt)** y **letra con tiempos (.lrc)**.

## No objetivos

- Separar en más partes (batería, bajo…): solo voz / música.
- Letras sincronizadas palabra por palabra o subtítulos de video.
- Buscar la letra en internet.

## Anti-objetivos

- Que la letra invente con seguridad: las palabras dudosas se marcan, como en «Desde foto».
- Que la ventana se congele mientras trabaja: todo corre en un Web Worker, con progreso y «Cancelar».
- Que haga falta instalar algo para usar el resto de CoffeeSound.

## Enfoques considerados

- Separación: **modelo MDX-Net de UVR dentro de la app** (elegido, la única opción sensata); restar canales sin IA se descartó porque deja voz y coros.
- Letra:
  - **A. Whisper dentro de la app con onnxruntime-web (elegido).** Mismo motor que «Desde foto», funciona igual en Windows y Linux y se puede probar de punta a punta. Más lento que nativo (1–3 min por canción de 3 min).
  - B. Whisper como programa nativo (sherpa-onnx): 2–4 veces más rápido, pero una pieza nativa por sistema que no se puede probar aquí.
  - Un servicio en internet quedó fuera (cuentas, costo y privacidad, como en el resto de la suite).

## Cómo funciona

### Complementos (catálogo en `coffee-core/src/addons.rs`, armados por `addons.yml`)

- `separarvoz` «Separar voz y música» (~65 MB): `UVR-MDX-NET-Voc_FT.onnx` de la versión `all_public_uvr_models` del repositorio de modelos de UVR (descargable desde GitHub), con su huella SHA-256 y su licencia. Complemento de datos, el mismo zip en Windows y Linux.
- `letra` «Letra de canciones» (~250 MB): Whisper **small** multilingüe en ONNX con pesos int8, de `sherpa-onnx` (`asr-models`: `small-encoder.int8.onnx`, `small-decoder.int8.onnx`, `small-tokens.txt`), licencias MIT (Whisper) y Apache-2.0 (sherpa-onnx).
- Los modelos se entregan a la app en binario con un comando nativo con lista blanca (como `doc_ocr_modelo`).

### Separación (MDX-Net)

- Audio a 44,1 kHz estéreo (se remuestrea si hace falta), en trozos con solapamiento.
- STFT (n_fft 7680, salto 1024, 3072 bandas, 256 cuadros por trozo, como en UVR), el modelo estima el espectro de la voz, ISTFT, y la música = original − voz.
- Corre en un Web Worker con onnxruntime-web (wasm). Progreso por trozos y «Cancelar».

### Letra (Whisper)

- Sobre la voz separada (si no la hay, se separa primero).
- Frases: se cortan donde la voz calla (energía bajo un umbral durante ≥ 0,4 s; frases de 1 a 28 s). Cada frase es una línea de la letra con su tiempo de inicio: eso da el `.lrc`.
- Cada frase: espectrograma log-mel de Whisper (80 bandas, 16 kHz), codificador y decodificador con decodificación voraz, idioma detectado en la primera frase o elegido por la persona.
- Palabras de baja probabilidad (< 50 %) marcadas como dudosas; se descartan frases que Whisper «alucina» en silencios (texto repetido o probabilidad media muy baja).

### Pantalla

- Menú **Efectos › Separar voz y música…** y **Efectos › Sacar la letra…** (en el editor de forma de onda, sobre el audio abierto).
- Diálogo de separación: barra de progreso; al terminar, botones «Abrir la voz», «Abrir la música» y «Poner en dos pistas».
- Panel de la letra: una línea por frase con su tiempo (`[01:23]`), editable; clic en el tiempo reproduce esa frase; dudosas en amarillo; «Guardar .txt» y «Guardar .lrc». Idioma: «Detectar» (por defecto) o uno de la lista.
- Sin el complemento, el botón explica qué instalar y lleva a instalarlo (como en las demás apps).

## Pruebas

- Lógica pura (Node): STFT/ISTFT (reconstrucción exacta), remuestreo, cortes por silencio, espectrograma log-mel comparado con valores de referencia, decodificación de piezas de Whisper, `.lrc`/`.txt`.
- Con los modelos reales (si `SEP_MODELOS` / `LETRA_MODELOS` apuntan a ellos; el CI de complementos sí): una mezcla de prueba (voz sintética + música) separada con mejora medible de la relación voz/música; una frase hablada de muestra transcrita con las palabras esperadas.
- Navegador (Playwright): separar una canción corta, poner en dos pistas, sacar la letra y descargar `.txt` y `.lrc`.

## Lo que queda a criterio de quien construye

- Tamaños de trozo y solapamiento, umbrales de silencio y de duda, textos y detalle visual dentro del estilo de CoffeeSound.
- Si el remuestreo y la STFT van en el trabajador o en el hilo principal (sin congelar la ventana).
