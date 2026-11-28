"""Icono de CoffeeQR: una tarjeta blanca con un QR de esquinas redondas y puntos, y una hoja verde,
sobre un cuadrado redondeado violeta índigo. Escribe CoffeeWorks_Icon/CoffeeQR.{ico,png} y lo copia
al Launcher y a la app.

Uso: python3 scripts/make-qr-icon.py
"""

import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 4
SIZE = 256 * S
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
VIOLETA = (95, 61, 196, 255)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

# Fondo: degradado violeta índigo (#7950f2 → #5f3dc4 → #4527a0)
fondo = Image.new("RGBA", (SIZE, SIZE))
fd = ImageDraw.Draw(fondo)
for y in range(SIZE):
    t = y / SIZE
    c = (int(0x79 + (0x45 - 0x79) * t), int(0x50 + (0x27 - 0x50) * t), int(0xF2 + (0xA0 - 0xF2) * t), 255)
    fd.line([(0, y), (SIZE, y)], fill=c)
mascara = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mascara).rounded_rectangle(box(8, 8, 248, 248), radius=52 * S, fill=255)
img.paste(fondo, (0, 0), mascara)

# Tarjeta blanca con sombra
sombra = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(sombra).rounded_rectangle(box(44, 44, 212, 212), radius=30 * S, fill=(30, 10, 80, 80))
img.alpha_composite(sombra, (3 * S, 6 * S))
d = ImageDraw.Draw(img)
d.rounded_rectangle(box(42, 42, 214, 214), radius=30 * S, fill=(255, 255, 255, 255))

# QR: 3 ojos redondeados y puntos (cuadrícula de 13 × 13 entre 60 y 196)
M = 60
P = 136 / 13


def celda(f, c):
    return M + c * P, M + f * P


def ojo(f, c):
    x, y = celda(f, c)
    s = 3 * P
    d.rounded_rectangle(box(x, y, x + s, y + s), radius=11 * S, fill=VIOLETA)
    d.rounded_rectangle(box(x + P * 0.55, y + P * 0.55, x + s - P * 0.55, y + s - P * 0.55), radius=7 * S, fill=(255, 255, 255, 255))
    d.ellipse(box(x + P * 1.05, y + P * 1.05, x + s - P * 1.05, y + s - P * 1.05), fill=VIOLETA)


for f, c in [(0, 0), (0, 10), (10, 0)]:
    ojo(f, c)

random.seed(7)
for f in range(13):
    for c in range(13):
        en_ojo = (f < 4 and c < 4) or (f < 4 and c > 8) or (f > 8 and c < 4)
        hoja = f > 7 and c > 7
        if en_ojo or hoja or random.random() < 0.45:
            continue
        x, y = celda(f, c)
        r = P * 0.4
        d.ellipse(box(x + P / 2 - r, y + P / 2 - r, x + P / 2 + r, y + P / 2 + r), fill=VIOLETA)

# Hoja verde en la esquina libre
hoja = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
hd = ImageDraw.Draw(hoja)
cx, cy = 172, 172
hd.ellipse(box(cx - 28, cy - 15, cx + 28, cy + 15), fill=(47, 158, 68, 255))
hd.line([(cx - 26) * S, cy * S, (cx + 24) * S, cy * S], fill=(216, 245, 162, 255), width=3 * S)
for k in (-12, 0, 12):
    hd.line([(cx + k) * S, cy * S, (cx + k + 8) * S, (cy - 8) * S], fill=(216, 245, 162, 255), width=2 * S)
    hd.line([(cx + k) * S, cy * S, (cx + k + 8) * S, (cy + 8) * S], fill=(216, 245, 162, 255), width=2 * S)
hoja = hoja.rotate(40, resample=Image.BICUBIC, center=(cx * S, cy * S))
img.alpha_composite(hoja)

icon = img.resize((256, 256), Image.LANCZOS)
out = ROOT / "CoffeeWorks_Icon"
icon.save(out / "CoffeeQR.ico", sizes=SIZES)
icon.save(out / "CoffeeQR.png")
shutil.copy(out / "CoffeeQR.ico", ROOT / "public" / "icons" / "CoffeeQR.ico")
app = ROOT / "CoffeeQR"
shutil.copy(out / "CoffeeQR.ico", app / "public" / "app-icon.ico")
icon.save(app / "public" / "app-icon.png")
shutil.copy(out / "CoffeeQR.ico", app / "src-tauri" / "icons" / "icon.ico")
icon.save(app / "src-tauri" / "icons" / "icon.png")
print("Icono creado: CoffeeQR")
