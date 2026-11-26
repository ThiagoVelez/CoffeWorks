# Fórmulas desde foto (complemento de CoffeeLatex)

Modelos libres para pasar fotos de fórmulas a LaTeX en CoffeeLatex («Desde foto»).
Son los modelos de [pix2tex / LaTeX-OCR](https://github.com/lukas-blecher/LaTeX-OCR)
(MIT, Lukas Blecher) exportados a ONNX por
[RapidLaTeXOCR](https://github.com/RapidAI/RapidLaTeXOCR) (MIT, RapidAI):

- `image_resizer.onnx`: elige el tamaño con el que se lee mejor la fórmula;
- `encoder.onnx` y `decoder.onnx`: leen la imagen y escriben el LaTeX pieza a pieza;
- `tokenizer.json`: el vocabulario de piezas.

CoffeeLatex los ejecuta dentro de la app con onnxruntime-web, sin internet y sin
programas nativos. El flujo `.github/workflows/addons.yml` descarga los archivos,
comprueba sus huellas SHA-256, los prueba con `CoffeeLatex/src/foto/latexocr.test.ts`
(fórmulas de muestra) y arma `coffee-latexocr.zip`. Es el mismo paquete en Windows y Linux.
