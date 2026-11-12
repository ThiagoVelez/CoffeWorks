# Calco vectorial (complemento de CoffeeVector y CoffeePaint)

Convierte imágenes en trazados vectoriales con
[Potrace](https://potrace.sourceforge.net) (GPL). CoffeeVector lo usa en
Objeto › Calco de imagen (blanco y negro o por colores) y CoffeePaint en
Archivo › Vectorizar dibujo.

El flujo `.github/workflows/addons.yml` arma `coffee-potrace-win64.zip` con la
compilación oficial de Potrace para Windows (o la de conda-forge) y lo prueba
con `test/muestra.bmp`.

En Linux se usa el Potrace del sistema:

```bash
sudo apt install potrace
```
