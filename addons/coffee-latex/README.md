# Motor LaTeX (complemento de CoffeeLatex y CoffeeConvert)

Compila documentos LaTeX a PDF con [Tectonic](https://tectonic-typesetting.github.io)
(MIT). La primera vez que compila descarga de internet los paquetes de LaTeX que
el documento usa; después funciona sin conexión.

El flujo `.github/workflows/addons.yml` arma `coffee-latex-win64.zip` con la
versión oficial de Tectonic para Windows y la prueba compilando `test/muestra.tex`.

En Linux se usa TeX Live (XeLaTeX) del sistema:

```bash
sudo apt install texlive-xetex texlive-lang-spanish texlive-science
```
