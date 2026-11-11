"""Genera los iconos de CoffeeDataBase (rojo rubí, cilindro de datos),
CoffeeEdit (verde menta, tijeras y cámara) y CoffeeLive (naranja, señal en
directo) con el estilo de la suite: cuadrado redondeado con símbolo blanco."""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
S = 4
SIZE = 256 * S
WHITE = (250, 250, 250, 255)
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def p(x, y):
    return (x * S, y * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def canvas(color):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box(16, 16, 241, 241), radius=48 * S, fill=color)
    return img, d


def save(img, name):
    icon = img.resize((256, 256), Image.LANCZOS)
    out = ROOT / "CoffeeWorks_Icon" / f"{name}.ico"
    icon.save(out, sizes=SIZES)
    icon.save(ROOT / "CoffeeWorks_Icon" / f"{name}.png")
    print("Icono creado en", out)


# --- CoffeeDataBase: cilindro de datos con tres discos ----------------------
RUBY = (155, 17, 30, 255)
RUBY_DARK = (110, 10, 22, 255)
ROSE = (248, 187, 197, 255)
img, d = canvas(RUBY)
cx, top, w, ry, seg = 128, 64, 82, 20, 40
for i in range(3):
    y = top + i * seg
    # Cuerpo de cada disco
    d.rectangle(box(cx - w, y, cx + w, y + seg - 6), fill=WHITE)
    d.ellipse(box(cx - w, y + seg - 6 - ry, cx + w, y + seg - 6 + ry), fill=WHITE)
    d.ellipse(box(cx - w, y - ry, cx + w, y + ry), fill=WHITE if i else ROSE)
    if i:
        d.arc(box(cx - w, y - ry, cx + w, y + ry), 0, 180, fill=RUBY_DARK, width=6 * S)
# Tapa superior con su borde
d.ellipse(box(cx - w, top - ry, cx + w, top + ry), fill=ROSE, outline=WHITE, width=6 * S)
# Puntos de "registros" en cada disco
for i in range(3):
    y = top + i * seg + 20
    d.ellipse(box(cx + w - 30, y - 6, cx + w - 18, y + 6), fill=RUBY)
save(img, "CoffeeDataBase")

# --- CoffeeEdit: tijeras abiertas sobre una cámara --------------------------
MINT = (38, 166, 128, 255)
MINT_DARK = (16, 110, 82, 255)
img, d = canvas(MINT)
# Cámara pequeña (abajo a la derecha)
d.rounded_rectangle(box(118, 132, 194, 192), radius=12 * S, fill=WHITE)
d.polygon([p(192, 152), p(222, 136), p(222, 188), p(192, 172)], fill=WHITE)
d.ellipse(box(140, 146, 172, 178), fill=MINT_DARK)
d.ellipse(box(150, 156, 162, 168), fill=(178, 235, 214, 255))
# Tijeras (arriba a la izquierda), hojas cruzadas
pivot = (96, 100)
for angle in (-35, 35):
    a = math.radians(angle - 90)
    tip = (pivot[0] + math.cos(a) * 66, pivot[1] + math.sin(a) * 66)
    perp = (math.cos(a + math.pi / 2) * 11, math.sin(a + math.pi / 2) * 11)
    d.polygon(
        [p(pivot[0] + perp[0], pivot[1] + perp[1]), p(*tip), p(pivot[0] - perp[0], pivot[1] - perp[1])],
        fill=WHITE,
    )
    # Mango (anillo)
    b = math.radians(angle + 90)
    ring = (pivot[0] + math.cos(b) * 42, pivot[1] + math.sin(b) * 42)
    d.line([p(*pivot), p(pivot[0] + math.cos(b) * 26, pivot[1] + math.sin(b) * 26)], fill=WHITE, width=12 * S)
    d.ellipse(box(ring[0] - 18, ring[1] - 18, ring[0] + 18, ring[1] + 18), outline=WHITE, width=9 * S)
d.ellipse(box(pivot[0] - 7, pivot[1] - 7, pivot[0] + 7, pivot[1] + 7), fill=MINT_DARK)
save(img, "CoffeeEdit")

# --- CoffeeLive: punto en directo con ondas -----------------------------------
ORANGE = (239, 108, 0, 255)
img, d = canvas(ORANGE)
cx, cy = 128, 112
d.ellipse(box(cx - 22, cy - 22, cx + 22, cy + 22), fill=WHITE)
for r, width in ((52, 13), (84, 13)):
    for start in (140, -40):
        d.arc(box(cx - r, cy - r, cx + r, cy + r), start, start + 80, fill=WHITE, width=width * S)
# Etiqueta LIVE
d.rounded_rectangle(box(80, 186, 176, 222), radius=10 * S, fill=WHITE)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26 * S)
bbox = d.textbbox((0, 0), "LIVE", font=font)
d.text((128 * S - (bbox[2] - bbox[0]) / 2 - bbox[0], 204 * S - (bbox[3] - bbox[1]) / 2 - bbox[1]), "LIVE", font=font, fill=ORANGE)
save(img, "CoffeeLive")
