# Revelado RAW (complemento de CoffeeLens y CoffeePhoto)

Abre las fotos RAW de casi cualquier cámara (CR2, CR3, NEF, ARW, DNG, RAF,
ORF, RW2…) con `dcraw_emu` de [LibRaw](https://www.libraw.org) (LGPL 2.1 /
CDDL). CoffeeWorks lo ejecuta con el balance de blancos de la cámara, espacio
de color sRGB e interpolación AHD, y recibe una imagen PPM que revela en
CoffeeLens o retoca en CoffeePhoto.

El flujo `.github/workflows/addons.yml` arma `coffee-raw-win64.zip` con la
compilación oficial de LibRaw para Windows (o la de conda-forge si no está
disponible) y lo publica en la versión `addons`.

En Linux se usa el LibRaw del sistema:

```bash
sudo apt install libraw-bin
```
