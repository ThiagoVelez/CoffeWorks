"""Icono de CoffeeLatex: una hoja blanca con una integral y «F = ma», sobre un cuadrado
redondeado azul petróleo. Escribe CoffeeWorks_Icon/CoffeeLatex.{ico,png} y lo copia al
Launcher y a la app.

Uso: python3 scripts/make-latex-icon.py
"""

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
S = 4
SIZE = 256 * S
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF_ITALIC = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def fuente(ruta, tam):
    try:
        return ImageFont.truetype(ruta, tam * S)
    except OSError:
        return ImageFont.truetype(SERIF, tam * S)


img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

# Fondo: degradado azul petróleo (#13788c → #0d5e6f → #0a4b59)
fondo = Image.new("RGBA", (SIZE, SIZE))
fd = ImageDraw.Draw(fondo)
for y in range(SIZE):
    t = y / SIZE
    c = (int(0x13 + (0x0A - 0x13) * t), int(0x78 + (0x4B - 0x78) * t), int(0x8C + (0x59 - 0x8C) * t), 255)
    fd.line([(0, y), (SIZE, y)], fill=c)
mascara = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mascara).rounded_rectangle(box(8, 8, 248, 248), radius=52 * S, fill=255)
img.paste(fondo, (0, 0), mascara)

d = ImageDraw.Draw(img)

# Sombra y hoja con la esquina doblada
sombra = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(sombra).polygon([(x * S, y * S) for x, y in [(66, 46), (168, 46), (202, 80), (202, 222), (66, 222)]], fill=(0, 30, 38, 70))
img.alpha_composite(sombra, (3 * S, 5 * S))
d = ImageDraw.Draw(img)
hoja = [(62, 40), (166, 40), (198, 72), (198, 216), (62, 216)]
d.polygon([(x * S, y * S) for x, y in hoja], fill=(255, 255, 255, 255))
d.polygon([(x * S, y * S) for x, y in [(166, 40), (198, 72), (166, 72)]], fill=(190, 226, 233, 255))

# Integral
d.text((130 * S, 96 * S), "∫", font=fuente(SERIF_ITALIC, 74), fill=(13, 94, 111, 255), anchor="mm")

# F = ma
f_b = fuente(SERIF_BOLD, 26)
f_r = fuente(SERIF, 26)
y = 172 * S
partes = [("F", f_b, (13, 94, 111, 255)), (" = ", f_r, (232, 125, 40, 255)), ("ma", f_r, (13, 94, 111, 255))]
ancho = sum(d.textlength(t, font=f) for t, f, _ in partes)
x = 130 * S - ancho / 2
for t, f, c in partes:
    d.text((x, y), t, font=f, fill=c, anchor="ls")
    x += d.textlength(t, font=f)

# Renglón
d.rounded_rectangle(box(84, 190, 176, 195), radius=2 * S, fill=(168, 200, 208, 255))

icon = img.resize((256, 256), Image.LANCZOS)
out = ROOT / "CoffeeWorks_Icon"
icon.save(out / "CoffeeLatex.ico", sizes=SIZES)
icon.save(out / "CoffeeLatex.png")
shutil.copy(out / "CoffeeLatex.ico", ROOT / "public" / "icons" / "CoffeeLatex.ico")
app = ROOT / "CoffeeLatex"
shutil.copy(out / "CoffeeLatex.ico", app / "public" / "app-icon.ico")
icon.save(app / "public" / "app-icon.png")
shutil.copy(out / "CoffeeLatex.ico", app / "src-tauri" / "icons" / "icon.ico")
icon.save(app / "src-tauri" / "icons" / "icon.png")
print("Icono creado: CoffeeLatex")
