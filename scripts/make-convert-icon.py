"""Icono de CoffeeConvert: una hoja con dos flechas que se cruzan (convertir), sobre un
cuadrado redondeado verde azulado. Escribe CoffeeWorks_Icon/CoffeeConvert.{ico,png} y lo
copia al Launcher y a la app.

Uso: python3 scripts/make-convert-icon.py
"""

import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 4
SIZE = 256 * S
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def p(x, y):
    return (x * S, y * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


grad = Image.new("RGBA", (SIZE, SIZE))
px = grad.load()
top, bottom = (32, 178, 170), (11, 105, 112)
for y in range(SIZE):
    t = y / (SIZE - 1)
    c = tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,)
    for x in range(SIZE):
        px[x, y] = c
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle(box(16, 16, 240, 240), radius=52 * S, fill=255)
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)

# Hoja con la esquina doblada
d.polygon([p(72, 50), p(158, 50), p(188, 80), p(188, 206), p(72, 206)], fill=(255, 255, 255, 255))
d.polygon([p(158, 50), p(158, 80), p(188, 80)], fill=(196, 230, 228, 255))
# Dos flechas que se cruzan (convertir)
teal = (15, 139, 141, 255)
d.line([p(96, 112), p(162, 112)], fill=teal, width=12 * S)
d.polygon([p(158, 96), p(176, 112), p(158, 128)], fill=teal)
d.line([p(98, 158), p(164, 158)], fill=(240, 138, 61, 255), width=12 * S)
d.polygon([p(102, 142), p(84, 158), p(102, 174)], fill=(240, 138, 61, 255))

icon = img.resize((256, 256), Image.LANCZOS)
out = ROOT / "CoffeeWorks_Icon"
icon.save(out / "CoffeeConvert.ico", sizes=SIZES)
icon.save(out / "CoffeeConvert.png")
shutil.copy(out / "CoffeeConvert.ico", ROOT / "public" / "icons" / "CoffeeConvert.ico")
app = ROOT / "CoffeeConvert"
shutil.copy(out / "CoffeeConvert.ico", app / "public" / "app-icon.ico")
icon.save(app / "public" / "app-icon.png")
shutil.copy(out / "CoffeeConvert.ico", app / "src-tauri" / "icons" / "icon.ico")
icon.save(app / "src-tauri" / "icons" / "icon.png")
print("Icono creado: CoffeeConvert")
