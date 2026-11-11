"""Genera los iconos de CoffeePage (morado) y CoffeeCams (verde menta) con el
mismo estilo que el resto de la suite: cuadrado redondeado de color con un
símbolo plano en blanco."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 4  # se dibuja a 4x y se reduce para suavizar los bordes
SIZE = 256 * S
WHITE = (250, 250, 250, 255)
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


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


# --- CoffeePage: cuaderno con anillas y pestañas de sección -----------------
PURPLE = (123, 31, 162, 255)
DARK_PURPLE = (74, 20, 140, 255)
LILAC = (225, 190, 231, 255)
TAB_COLORS = [(255, 202, 40, 255), (129, 212, 250, 255), (165, 214, 167, 255)]

img, d = canvas(PURPLE)
# Pestañas de sección que asoman por la derecha
for i, color in enumerate(TAB_COLORS):
    y = 72 + i * 38
    d.rounded_rectangle(box(170, y, 202, y + 28), radius=7 * S, fill=color)
# Tapa del cuaderno
d.rounded_rectangle(box(62, 48, 186, 210), radius=14 * S, fill=WHITE)
# Lomo
d.rounded_rectangle(box(62, 48, 92, 210), radius=14 * S, fill=LILAC)
d.rectangle(box(80, 48, 92, 210), fill=LILAC)
# Anillas
for y in (72, 104, 136, 168):
    d.rounded_rectangle(box(48, y, 100, y + 12), radius=6 * S, fill=DARK_PURPLE)
# Líneas de escritura
for y, length in ((84, 64), (108, 72), (132, 52), (156, 66)):
    d.rounded_rectangle(box(106, y, 106 + length, y + 8), radius=4 * S, fill=LILAC)
save(img, "CoffeePage")

# --- CoffeeCams: videocámara ------------------------------------------------
MINT = (38, 166, 128, 255)
DARK_MINT = (16, 110, 82, 255)
LIGHT_MINT = (178, 235, 214, 255)
REC = (239, 83, 80, 255)

img, d = canvas(MINT)
# Cuerpo
d.rounded_rectangle(box(44, 84, 168, 176), radius=20 * S, fill=WHITE)
# Visor lateral (triángulo)
d.polygon([(166 * S, 118 * S), (214 * S, 90 * S), (214 * S, 170 * S), (166 * S, 142 * S)], fill=WHITE)
d.rounded_rectangle(box(196, 88, 216, 172), radius=8 * S, fill=WHITE)
# Objetivo
d.ellipse(box(76, 100, 136, 160), fill=DARK_MINT)
d.ellipse(box(90, 114, 122, 146), fill=LIGHT_MINT)
d.ellipse(box(98, 120, 110, 132), fill=WHITE)
# Piloto de grabación
d.ellipse(box(146, 94, 160, 108), fill=REC)
save(img, "CoffeeCams")
