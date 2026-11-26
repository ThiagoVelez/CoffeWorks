# Separar voz y música (complemento de CoffeeSound)

Modelo `UVR-MDX-NET-Voc_FT` (MDX-Net) del proyecto
[Ultimate Vocal Remover](https://github.com/Anjok07/ultimatevocalremovergui) (MIT), publicado en
su repositorio de modelos. Estima la voz de una canción; CoffeeSound la resta de la mezcla para
obtener la música. Se ejecuta dentro de la app con onnxruntime-web, sin internet.

Parámetros (los de UVR para este modelo): n_fft 7680, salto 1024, 3072 bandas, 256 cuadros,
compensación 1,021, 44,1 kHz estéreo.

El flujo `.github/workflows/addons.yml` descarga `voc_ft.onnx`, comprueba su huella SHA-256, lo
prueba con `CoffeeSound/src/voz/separar.test.ts` (mezcla de muestra: la voz debe salir con más de
12 dB de relación señal/distorsión) y arma `coffee-separarvoz.zip`, el mismo en Windows y Linux.
