"""Genera el logo de CoffeeWorks (CoffeeWorks_Icon/CoffeeWorks.ico y .png) a partir de
CoffeeWorks_Icon/CoffeeWorks-original.jpg: taza de café con un anillo naranja sobre un
cuadrado redondeado café. Quita el fondo blanco de alrededor y copia el icono al
Launcher (public/icons y src-tauri/icons).

Uso: python3 scripts/make-launcher-icon.py
"""

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "CoffeeWorks_Icon" / "CoffeeWorks-original.jpg"
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def build() -> Image.Image:
    img = Image.open(SRC).convert("RGBA")
    side = max(img.size)
    square = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    square = square.resize((256, 256), Image.LANCZOS)
    # Fondo blanco → transparente: relleno desde las cuatro esquinas.
    mask = Image.new("L", square.size, 0)
    rgb = square.convert("RGB")
    for corner in [(0, 0), (255, 0), (0, 255), (255, 255)]:
        ImageDraw.floodfill(rgb, corner, (255, 0, 255), thresh=40)
    px = rgb.load()
    m = mask.load()
    for y in range(256):
        for x in range(256):
            m[x, y] = 0 if px[x, y] == (255, 0, 255) else 255
    # Recorte con la forma del icono: el cuadrado redondeado que delimita el borde café
    # (así no quedan restos del brillo claro del fondo).
    dark = [(x, y) for y in range(256) for x in range(256) if min(px[x, y]) < 170 and px[x, y] != (255, 0, 255)]
    x0, y0 = min(p[0] for p in dark), min(p[1] for p in dark)
    x1, y1 = max(p[0] for p in dark), max(p[1] for p in dark)
    shape = Image.new("L", square.size, 0)
    ImageDraw.Draw(shape).rounded_rectangle([x0, y0, x1, y1], radius=int((x1 - x0) * 0.2), fill=255)
    mask = Image.composite(mask, Image.new("L", square.size, 0), shape)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    square.putalpha(mask)
    return square


icon = build()
out = ROOT / "CoffeeWorks_Icon"
icon.save(out / "CoffeeWorks.ico", sizes=SIZES)
icon.save(out / "CoffeeWorks.png")
shutil.copy(out / "CoffeeWorks.ico", ROOT / "public" / "icons" / "CoffeeWorks.ico")
shutil.copy(out / "CoffeeWorks.png", ROOT / "public" / "icons" / "CoffeeWorks.png")
shutil.copy(out / "CoffeeWorks.ico", ROOT / "src-tauri" / "icons" / "icon.ico")
shutil.copy(out / "CoffeeWorks.png", ROOT / "src-tauri" / "icons" / "icon.png")
print("Icono del Launcher creado")
