# Compatibilidad para equipos antiguos (CoffeePuppet)

Complemento de datos para CoffeePuppet. Contiene la versión del motor de
seguimiento facial de MediaPipe (`@mediapipe/tasks-vision`) compilada sin
instrucciones SIMD, para procesadores muy antiguos.

CoffeePuppet incluye solo la versión con SIMD, que funciona en cualquier
procesador de los últimos diez años. Si el equipo no la admite, CoffeePuppet
ofrece instalar este complemento y lo carga desde la carpeta de complementos.

- `vision_wasm_nosimd_internal.js`
- `vision_wasm_nosimd_internal.wasm`

Licencia: Apache 2.0 (Google, proyecto MediaPipe).
