# Letra de canciones (complemento de CoffeeSound)

[Whisper](https://github.com/openai/whisper) «small» multilingüe (MIT, OpenAI), exportado a ONNX
con pesos int8 por [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache 2.0):

- `small-encoder.int8.onnx` y `small-decoder.int8.onnx`: el modelo;
- `small-tokens.txt`: el vocabulario.

CoffeeSound corta la voz en frases y transcribe cada una dentro de la app con onnxruntime-web,
sin internet; el resultado se guarda como `.txt` o `.lrc` (letra con tiempos).

El flujo `.github/workflows/addons.yml` descarga la versión `asr-models` de sherpa-onnx, comprueba
las huellas SHA-256, prueba con `CoffeeSound/src/voz/whisper.test.ts` (una frase en español) y
arma `coffee-letra.zip`, el mismo en Windows y Linux.
