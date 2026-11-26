# Conversor de documentos (complemento de CoffeeLatex y CoffeeConvert)

Convierte LaTeX y Markdown a Word (.docx), OpenDocument (.odt), HTML y entre sí
con [Pandoc](https://pandoc.org) (GPL-2.0), conservando las fórmulas.

El flujo `.github/workflows/addons.yml` arma `coffee-pandoc-win64.zip` con la
versión oficial de Pandoc para Windows y la prueba con
`../coffee-latex/test/muestra.tex`.

En Linux se usa el Pandoc del sistema:

```bash
sudo apt install pandoc
```
