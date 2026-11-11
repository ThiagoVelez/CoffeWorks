"""Genera el icono de CoffeePDF (CoffeeWorks_Icon/CoffeePDF.ico) con el mismo
estilo que el resto de la suite: cuadrado redondeado de color con una hoja
blanca y un símbolo plano."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
S = 4  # se dibuja a 4x y se reduce para suavizar los bordes
SIZE = 256 * S

RED = (198, 40, 40, 255)
DARK_RED = (142, 24, 24, 255)
PAGE = (250, 250, 250, 255)
FOLD = (224, 224, 224, 255)
LINE = (189, 189, 189, 255)
PEN = (255, 205, 210, 255)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Fondo: cuadrado redondeado (mismo margen y radio que los demás iconos)
d.rounded_rectangle(box(16, 16, 241, 241), radius=48 * S, fill=RED)

# Hoja con la esquina doblada
x0, y0, x1, y1, fold = 66, 50, 190, 214, 34
d.rounded_rectangle(box(x0, y0, x1, y1), radius=10 * S, fill=PAGE)
d.polygon([(x1 * S - fold * S, y0 * S), (x1 * S + 1, y0 * S), (x1 * S + 1, y0 * S + fold * S)], fill=RED)
d.polygon([(x1 * S - fold * S, y0 * S), (x1 * S, y0 * S + fold * S), (x1 * S - fold * S, y0 * S + fold * S)], fill=FOLD)

# Líneas de texto
for y, length in ((82, 70), (100, 92), (118, 80)):
    d.rounded_rectangle(box(x0 + 18, y, x0 + 18 + length, y + 8), radius=4 * S, fill=LINE)

# Etiqueta "PDF"
d.rounded_rectangle(box(50, 140, 206, 192), radius=10 * S, fill=DARK_RED)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40 * S)
text = "PDF"
bbox = d.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((128 * S) - tw / 2 - bbox[0], (166 * S) - th / 2 - bbox[1]), text, font=font, fill=PAGE)

# Trazo de lápiz bajo la etiqueta (edición)
d.rounded_rectangle(box(x0 + 18, 199, x0 + 64, 205), radius=3 * S, fill=PEN)

icon = img.resize((256, 256), Image.LANCZOS)
out = ROOT / "CoffeeWorks_Icon" / "CoffeePDF.ico"
icon.save(out, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
icon.save(ROOT / "CoffeeWorks_Icon" / "CoffeePDF.png")
print("Icono creado en", out)
