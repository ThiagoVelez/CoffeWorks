# Revisión del PDF original (complemento de CoffeePDF)

CoffeePDF revisa la ortografía de los textos que agrega el usuario. Este
complemento añade la revisión del texto que ya trae el PDF:

- **Páginas con texto digital:** el texto se lee con pdf.js dentro de la app.
- **Páginas escaneadas:** el texto se reconoce con [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
  (licencia Apache 2.0) en español e inglés.

Las faltas se suman al indicador de la barra inferior y se corrigen con clic
derecho: la palabra original se tapa y la corrección se escribe encima, con un
tamaño de letra parecido.

## Paquete

El flujo `.github/workflows/addons.yml` arma `coffee-pdfcheck-win64.zip` en
Windows con:

- `tesseract.exe` y sus DLL (paquete de conda-forge, sin instalador);
- `spa.traineddata` y `eng.traineddata` (modelos *fast* de tessdata).

Todo va en la misma carpeta: CoffeeWorks define `TESSDATA_PREFIX` al ejecutarlo.
El Launcher lo descarga de la versión `addons` del repositorio a
`%LOCALAPPDATA%\CoffeeWorks\Addons\pdfcheck`.

En Linux se usa el Tesseract del sistema:

```bash
sudo apt install tesseract-ocr tesseract-ocr-spa
```

`test/muestra.png` es la imagen con la que el CI comprueba el paquete.
