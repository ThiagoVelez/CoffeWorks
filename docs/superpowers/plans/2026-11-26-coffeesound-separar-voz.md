# CoffeeSound: separar voz y música y sacar la letra — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En CoffeeSound, separar una canción en «Voz» y «Música» (MDX-Net de UVR) y sacar la letra de la voz (Whisper small) a `.txt` y `.lrc`, sin internet.

**Architecture:** Lógica pura en TypeScript (STFT/ISTFT, troceo MDX, remuestreo, cortes por silencio, log-mel de Whisper, decodificación, `.lrc`), probada en Node; los modelos corren con onnxruntime (node en pruebas, web en un Web Worker en la app). Dos complementos de datos (`separarvoz`, `letra`) que arma `addons.yml` y entrega `coffee-core` en binario con lista blanca.

**Tech Stack:** TypeScript, React 19, onnxruntime-web 1.31.1 (wasm, 1 hilo), onnxruntime-node 1.31.1 (pruebas), Rust (coffee-core), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-26-coffeesound-separar-voz-design.md`

## Global Constraints

- Sin internet en uso: los modelos llegan solo por complementos (`separarvoz` ~65 MB, `letra` ~375 MB).
- MDX (modelo `UVR-MDX-NET-Voc_FT`, md5 de cola `77d07b2667ddf05b9e3175941b4454a0`): n_fft 7680, salto 1024, dim_f 3072, dim_t 256, compensación 1.021, 44 100 Hz estéreo, primeras 3 bandas a 0.
- Whisper (sherpa-onnx `whisper-small` int8): 16 kHz mono, 80 bandas mel, log10 recortado a max−8, (x+4)/4; relleno de 1500 cuadros; ≤ 3000 cuadros (frases ≤ 28 s); decodificación voraz con supresión de sot, no_timestamps, translate, no_speech (y eot/blank en la primera pieza).
- Todo en español en la interfaz; nada congela la ventana (Web Worker) y hay «Cancelar».
- Commits con los trailers de la sesión; versión de la suite 2.18.0.

## Review Focus

- Canción mono o a 48 kHz: se remuestrea a 44,1 kHz estéreo para separar y el resultado vuelve a la frecuencia y canales originales (prueba en Task 1).
- Canción muy corta (< 1 trozo) o muy larga (10 min): el troceo cubre todo sin perder ni duplicar muestras (prueba en Task 2).
- Silencio total o voz ausente: la letra queda vacía sin errores ni frases inventadas (prueba en Task 4).
- Frase de más de 28 s sin pausas: se parte en trozos de ≤ 28 s (prueba en Task 3).
- Cancelar a mitad: el trabajador se detiene y no se agrega nada a la sesión (prueba en Task 6, navegador).

---

### Task 1: Base de pruebas y señales (CoffeeSound/src/voz)

**Files:** Create `CoffeeSound/src/voz/senal.ts`, `senal.test.ts`; modify `CoffeeSound/package.json` (scripts `test`, devDeps `tsx`, `onnxruntime-node@1.31.1`; dep `onnxruntime-web@1.31.1`).

**Interfaces — Produces:**
- `remuestrear(x: Float32Array, de: number, a: number): Float32Array` (polifásico con ventana; sin desfase).
- `aEstereo44(canales: Float32Array[], rate: number): [Float32Array, Float32Array]` y `deEstereo44(l, r, rate, canales): Float32Array[]`.
- `stft(x: Float32Array, nFft: number, salto: number): { re: Float32Array; im: Float32Array; bandas: number; cuadros: number }` (hann periódica, center con reflejo, como torch.stft) e `istft(re, im, bandas, cuadros, nFft, salto, largo): Float32Array`.
- `leerWav(bytes): { canales: Float32Array[]; rate: number }` y `wav16(canales, rate): Uint8Array` (para pruebas y descargas).

- [ ] Pruebas: `istft(stft(x))` reconstruye una señal aleatoria con error < 1e-4; `remuestrear` 44100→16000 de un tono de 440 Hz conserva la frecuencia (cruces por cero ±1 %) y la duración (±1 muestra); `aEstereo44`/`deEstereo44` mono 48 kHz ida y vuelta conserva largo ±2 muestras.
- [ ] Ver fallar, implementar, pasar; commit «CoffeeSound: señales para separar voz».

### Task 2: Separación MDX

**Files:** Create `CoffeeSound/src/voz/separar.ts`, `separar.test.ts`, `src/voz/muestras/` (mezcla de prueba: voz sintética + acordes, 4,7 s, WAV 16 bit; voz de referencia).

**Interfaces — Produces:** `separarVoz(m: { ort: Ort; sesion: SesionOnnx }, l: Float32Array, r: Float32Array, op?: { alAvanzar?(f: number): void; cancelado?(): boolean }): Promise<{ voz: [Float32Array, Float32Array]; musica: [Float32Array, Float32Array] }>` (a 44,1 kHz). `Ort`/`SesionOnnx` como en CoffeeLatex `latexocr.ts` (copiados).

- [ ] Pruebas sin modelo (sesión simulada que devuelve la entrada ⇒ voz = mezcla·1.021, música ≈ −0.021·mezcla): largo de salida = entrada para 1 s, 7 s y 0,05 s; avance llega a 1; `cancelado` corta.
- [ ] Prueba con modelo (si `SEP_MODELOS`): SDR de la voz sobre la mezcla de muestra pasa de < 0 dB a > 12 dB.
- [ ] Ver fallar, implementar (troceo de la referencia: trim n_fft/2, gen = salto·255 − n_fft, relleno), pasar; commit.

### Task 3: Frases (cortes por silencio)

**Files:** Create `CoffeeSound/src/voz/frases.ts`, `frases.test.ts`.

**Interfaces — Produces:** `frases(voz: Float32Array, rate: number, op?: { umbralDb?: number; silencioMin?: number; maxDur?: number; minDur?: number }): { ini: number; fin: number }[]` (segundos; por defecto silencio ≥ 0,4 s bajo −40 dBFS relativo al pico, frases 0,3–28 s, 0,15 s de margen).

- [ ] Pruebas: tres ráfagas de tono separadas por 1 s de silencio ⇒ 3 frases con inicios ±0,1 s; 60 s de tono continuo ⇒ frases ≤ 28 s que cubren todo; silencio total ⇒ `[]`; ráfaga de 0,1 s ⇒ descartada.
- [ ] Ver fallar, implementar, pasar; commit.

### Task 4: Whisper (letra)

**Files:** Create `CoffeeSound/src/voz/whisper.ts`, `whisper.test.ts`, `src/voz/letra.ts`, `letra.test.ts`.

**Interfaces — Produces:**
- `melWhisper(x16k: Float32Array): { datos: Float32Array; cuadros: number }` (80 × cuadros, ya normalizado y rellenado como la referencia).
- `leerFichas(txt: string): Uint8Array[]` (tokens base64 de sherpa).
- `transcribir(m: ModelosWhisper, x16k: Float32Array, op?: { idioma?: string; cancelado?(): boolean }): Promise<{ texto: string; idioma: string; dudas: { ini: number; fin: number; prob: number }[]; probMedia: number }>` con `ModelosWhisper = { ort; codificador; decodificador; fichas: Uint8Array[]; meta: Record<string,string> }`.
- `IDIOMAS: { codigo: string; nombre: string }[]` (es, en, pt, fr, it, de y «Detectar»).
- En `letra.ts`: `interface LineaLetra { ini: number; fin: number; texto: string; dudas: {ini;fin;prob}[] }`, `aTxt(l: LineaLetra[]): string`, `aLrc(l: LineaLetra[], titulo?: string): string` (`[mm:ss.cc]`), `esAlucinacion(texto: string, probMedia: number): boolean` (vacío, < 0,35 de prob. media, o una palabra repetida ≥ 4 veces seguidas, o frases típicas de silencio como «Gracias por ver», «Subtítulos…»).
- [ ] Pruebas puras: `aLrc` da `[01:05.50]Hola` para ini 65,5; `aTxt` una línea por frase sin tiempos; `esAlucinacion("gracias gracias gracias gracias", .9)` true, `("Hola mundo", .2)` true, `("La luna brilla", .8)` false; `melWhisper` de 1 s de silencio da 80 × (100+1500) cuadros con todos los valores iguales.
- [ ] `melWhisper` comparado con `kaldi_native_fbank` sobre `muestras/voz16.wav`: error medio < 0,02 (valores de referencia guardados en `muestras/mel_ref.json`, primeras 3 bandas de 50 cuadros).
- [ ] Con modelo (si `LETRA_MODELOS`): `muestras/voz16.wav` («La luna brilla sobre el mar y yo canto mi canción», espeak-ng) ⇒ idioma `es` y el texto contiene «luna», «mar» y «canción».
- [ ] Ver fallar, implementar, pasar; commit.

### Task 5: Complementos y comando nativo

**Files:** Modify `crates/coffee-core/src/addons.rs` (catálogo `separarvoz`, `letra`), `crates/coffee-core/src/docconv.rs` (`audio_modelo(complemento, nombre)` con lista blanca + `#[tauri::command] doc_audio_modelo` → `tauri::ipc::Response`), `lib.rs` (en `editor_handler!`), `.github/workflows/addons.yml` (trabajos `separarvoz` y `letra`: descargar, SHA-256, probar con las pruebas de modelo de CoffeeSound, zip y publicar), `addons/coffee-separarvoz/README.md`, `addons/coffee-letra/README.md`.

**Interfaces — Produces:** comando `doc_audio_modelo(complemento: "separarvoz" | "letra", nombre: string) -> ArrayBuffer`; nombres: `voc_ft.onnx` | `small-encoder.int8.onnx`, `small-decoder.int8.onnx`, `small-tokens.txt`. `doc_herramientas` añade `separarvoz: bool`, `letra: bool`.

- [ ] Prueba Rust `audio_solo_entrega_sus_archivos` (rutas con `..`, absolutas, nombres de otro complemento ⇒ «no permitido»).
- [ ] Ver fallar, implementar, `cargo test -p coffee-core`; commit.

### Task 6: Trabajador e interfaz en CoffeeSound

**Files:** Create `CoffeeSound/src/voz/trabajador.ts`, `motor.ts`, `PanelVoz.tsx`; modify `CoffeeSound/src/App.tsx` (menú Efectos: «Separar voz y música…», «Sacar la letra…»), `CoffeeSound/vite.config.ts` (servir `/modelos-voz/` desde `VOZ_MODELOS` solo en desarrollo), `CoffeeSound/e2e/voz.mjs`, `package.json` (`e2e`).

**Interfaces — Consumes:** Tasks 1–5. `addAsset(buf, name, open)` de App; `newTrack`, `Clip` de la sesión.

- Separar: diálogo con progreso y «Cancelar»; al terminar «Abrir la voz», «Abrir la música», «Poner en dos pistas» (dos pistas nuevas con un clip cada una en t=0).
- Letra: panel con idioma («Detectar» por defecto), progreso por frase, líneas `[mm:ss]` editables, dudosas en amarillo, clic en el tiempo reproduce la frase, «Guardar .txt», «Guardar .lrc». Si no hay voz separada, separa primero (si está `separarvoz`) o transcribe la mezcla avisando que será menos preciso.
- Sin complemento: aviso con «Instalar» (`ensureAddon`).
- [ ] e2e (Playwright, con `VOZ_MODELOS`): abrir `muestras/mezcla.wav`, separar ⇒ aparecen dos recursos; «Poner en dos pistas» ⇒ 2 pistas; sacar la letra ⇒ contiene «luna»; descargar `.lrc` empieza por `[00:`; «Cancelar» durante la separación no agrega recursos. Sin modelos ⇒ ofrece instalar.
- [ ] `npm run build`, `npm test`, e2e; commit.

### Task 7: Integración

**Files:** `README.md`, `addons/README.md`, `.github/workflows/build-linux.yml` (pruebas de CoffeeSound), `node scripts/version.mjs 2.18.0 alpha`, `cargo update -w --offline`, `make-theme`.

- [ ] Comprobar: `npm test` (CoffeeSound, CoffeeLatex), `cargo test -p coffee-core -p coffeesound`, `sync-shared --check`, `make-theme --check`, build del Launcher; commit, push; actualizar el PR abierto.
