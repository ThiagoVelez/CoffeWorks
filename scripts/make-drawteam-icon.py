"""Icono de CoffeeDrawTeam: tres notas adhesivas superpuestas y un cursor, sobre un
cuadrado redondeado mandarina. Escribe CoffeeWorks_Icon/CoffeeDrawTeam.{ico,png} y lo
copia al Launcher y a la app.

Uso: python3 scripts/make-drawteam-icon.py
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
top, bottom = (248, 166, 76), (214, 110, 24)
for y in range(SIZE):
    t = y / (SIZE - 1)
    c = tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,)
    for x in range(SIZE):
        px[x, y] = c
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle(box(16, 16, 240, 240), radius=52 * S, fill=255)
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
img.paste(grad, (0, 0), mask)

# Tres notas adhesivas, cada una un poco girada, con sombra suave
def nota(cx, cy, lado, angulo, color):
    capa = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    dc = ImageDraw.Draw(capa)
    h = lado / 2
    dc.rounded_rectangle(box(cx - h + 4, cy - h + 6, cx + h + 4, cy + h + 6), radius=8 * S, fill=(90, 40, 0, 70))
    dc.rounded_rectangle(box(cx - h, cy - h, cx + h, cy + h), radius=8 * S, fill=color)
    raya = tuple(int(c * 0.8) for c in color[:3]) + (255,)
    dc.line([p(cx - h + 16, cy - h + 26), p(cx + h - 18, cy - h + 26)], fill=raya, width=5 * S)
    dc.line([p(cx - h + 16, cy - h + 42), p(cx + h - 30, cy - h + 42)], fill=raya, width=5 * S)
    return capa.rotate(angulo, resample=Image.BICUBIC, center=p(cx, cy))

for capa in (
    nota(98, 96, 86, 8, (196, 226, 255, 255)),
    nota(160, 104, 86, -7, (255, 201, 222, 255)),
    nota(118, 152, 92, 3, (255, 243, 163, 255)),
):
    img.alpha_composite(capa)

# Cursor
d = ImageDraw.Draw(img)
cur = [(150, 140), (150, 212), (167, 196), (180, 224), (193, 218), (180, 190), (204, 189)]
d.polygon([p(x + 3, y + 4) for x, y in cur], fill=(60, 25, 0, 90))
d.polygon([p(x, y) for x, y in cur], fill=(44, 27, 18, 255), outline=(255, 255, 255, 255), width=5 * S)

icon = img.resize((256, 256), Image.LANCZOS)
out = ROOT / "CoffeeWorks_Icon"
icon.save(out / "CoffeeDrawTeam.ico", sizes=SIZES)
icon.save(out / "CoffeeDrawTeam.png")
shutil.copy(out / "CoffeeDrawTeam.ico", ROOT / "public" / "icons" / "CoffeeDrawTeam.ico")
app = ROOT / "CoffeeDrawTeam"
shutil.copy(out / "CoffeeDrawTeam.ico", app / "public" / "app-icon.ico")
icon.save(app / "public" / "app-icon.png")
shutil.copy(out / "CoffeeDrawTeam.ico", app / "src-tauri" / "icons" / "icon.ico")
icon.save(app / "src-tauri" / "icons" / "icon.png")
print("Icono creado: CoffeeDrawTeam")
