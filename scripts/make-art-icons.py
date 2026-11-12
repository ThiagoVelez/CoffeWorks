"""Genera los iconos de la categoría Ilustración, con degradados cálidos:

- CoffeePhoto: capas apiladas con una foto (naranja → carmesí).
- CoffeeVector: trazado Bézier con nodos y manejador (amarillo → naranja).
- CoffeePaint: pincel con una pincelada (rosa → mandarina).
- CoffeeLens: diafragma de cámara (ámbar → terracota).
- CoffeeMotion: fotogramas clave sobre una línea de tiempo (morado → naranja).
- CoffeeSound: forma de onda (rojo → dorado).
- CoffeeEncoder: flechas de conversión alrededor de un fotograma (cobre → vino).
- CoffeeAnimate: pelota que rebota con estela (coral → amarillo).
- CoffeePuppet: cara de marioneta con puntos de control (rosa → salmón).
"""

import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 4
SIZE = 256 * S
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
WHITE = (255, 255, 255, 255)


def p(x, y):
    return (x * S, y * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def gradient_canvas(c0, c1):
    """Cuadrado redondeado con degradado diagonal (de arriba a la izquierda hacia abajo a la derecha)."""
    grad = Image.new("RGBA", (SIZE, SIZE))
    px = grad.load()
    for y in range(0, SIZE, 2):
        for x in range(0, SIZE, 2):
            t = min(1.0, max(0.0, (x + y) / (2 * SIZE)))
            col = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)) + (255,)
            px[x, y] = col
            if x + 1 < SIZE:
                px[x + 1, y] = col
            if y + 1 < SIZE:
                px[x, y + 1] = col
                if x + 1 < SIZE:
                    px[x + 1, y + 1] = col
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box(16, 16, 241, 241), radius=48 * S, fill=255)
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    # Brillo suave en la parte superior
    shine = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(shine).ellipse(box(-40, -150, 300, 110), fill=(255, 255, 255, 34))
    shine_mask = Image.new("L", (SIZE, SIZE), 0)
    shine_mask.paste(mask, (0, 0))
    img = Image.alpha_composite(img, Image.composite(shine, Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)), shine_mask))
    return img, ImageDraw.Draw(img)


def save(img, name):
    icon = img.resize((256, 256), Image.LANCZOS)
    out = ROOT / "CoffeeWorks_Icon"
    icon.save(out / f"{name}.ico", sizes=SIZES)
    icon.save(out / f"{name}.png")
    shutil.copy(out / f"{name}.ico", ROOT / "public" / "icons" / f"{name}.ico")
    app = ROOT / name
    if app.is_dir():
        (app / "public").mkdir(exist_ok=True)
        shutil.copy(out / f"{name}.ico", app / "public" / "app-icon.ico")
        icon.save(app / "public" / "app-icon.png")
        icons = app / "src-tauri" / "icons"
        icons.mkdir(parents=True, exist_ok=True)
        shutil.copy(out / f"{name}.ico", icons / "icon.ico")
        icon.save(icons / "icon.png")
    print("Icono creado:", name)


def bezier(p0, p1, p2, p3, steps=80):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        pts.append(p(x, y))
    return pts


def thick_line(d, pts, width, fill=WHITE):
    d.line(pts, fill=fill, width=width * S, joint="curve")
    for q in (pts[0], pts[-1]):
        r = width * S / 2
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=fill)


# --- CoffeePhoto: capas apiladas con una foto -----------------------------------
img, d = gradient_canvas((255, 159, 67), (224, 49, 77))
d.rounded_rectangle(box(70, 54, 206, 168), radius=16 * S, outline=(255, 255, 255, 150), width=9 * S)
d.rounded_rectangle(box(50, 84, 186, 198), radius=16 * S, fill=WHITE)
# Foto: montañas y sol en la capa delantera
d.polygon([p(62, 186), p(102, 134), p(128, 166), p(146, 146), p(174, 186)], fill=(232, 68, 74, 255))
d.ellipse(box(140, 100, 164, 124), fill=(255, 159, 67, 255))
save(img, "CoffeePhoto")

# --- CoffeeVector: trazado Bézier con nodos y manejador --------------------------
img, d = gradient_canvas((255, 212, 59), (255, 112, 0))
curve = bezier((56, 186), (70, 70), (180, 60), (200, 120))
thick_line(d, curve, 13)
# Manejador
d.line([p(118, 76), p(206, 52)], fill=(255, 255, 255, 220), width=5 * S)
for cx_, cy_ in ((206, 52),):
    d.ellipse(box(cx_ - 11, cy_ - 11, cx_ + 11, cy_ + 11), fill=WHITE)
# Nodos cuadrados
for cx_, cy_ in ((56, 186), (200, 120)):
    d.rectangle(box(cx_ - 15, cy_ - 15, cx_ + 15, cy_ + 15), fill=(255, 112, 0, 255), outline=WHITE, width=7 * S)
d.rectangle(box(118 - 15, 76 - 15, 118 + 15, 76 + 15), fill=WHITE)
# Punto de una forma geométrica
d.polygon([p(132, 200), p(160, 152), p(188, 200)], fill=(255, 255, 255, 200))
save(img, "CoffeeVector")

# --- CoffeePaint: pincel con una pincelada ---------------------------------------
img, d = gradient_canvas((255, 107, 157), (255, 146, 43))
# Pincelada
stroke = bezier((44, 196), (88, 150), (130, 214), (176, 168), 90)
for i, q in enumerate(stroke):
    r = (6 + 12 * math.sin(math.pi * i / (len(stroke) - 1))) * S
    d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=WHITE)
# Pincel (mango, virola y punta) en diagonal
ang = math.radians(-50)
def rot(x, y, ox=150, oy=126):
    return p(ox + x * math.cos(ang) - y * math.sin(ang), oy + x * math.sin(ang) + y * math.cos(ang))
d.polygon([rot(10, -9), rot(92, -6), rot(92, 6), rot(10, 9)], fill=WHITE)
d.polygon([rot(-14, -12), rot(12, -12), rot(12, 12), rot(-14, 12)], fill=(255, 225, 225, 255))
d.polygon([rot(-14, -12), rot(-48, 0), rot(-14, 12)], fill=(150, 30, 70, 255))
save(img, "CoffeePaint")

# --- CoffeeLens: diafragma de cámara ----------------------------------------------
img, d = gradient_canvas((249, 199, 79), (217, 72, 15))
cx, cy, R = 128, 128, 84
d.ellipse(box(cx - R, cy - R, cx + R, cy + R), fill=WHITE)
inner = 30
for k in range(6):
    a0 = math.radians(k * 60 + 15)
    a1 = math.radians(k * 60 + 75)
    pts = [
        p(cx + inner * math.cos(a0), cy + inner * math.sin(a0)),
        p(cx + (R - 4) * math.cos(a0 - 0.35), cy + (R - 4) * math.sin(a0 - 0.35)),
        p(cx + (R - 4) * math.cos(a1 - 0.35), cy + (R - 4) * math.sin(a1 - 0.35)),
        p(cx + inner * math.cos(a1), cy + inner * math.sin(a1)),
    ]
    shade = (217, 72, 15, 255) if k % 2 == 0 else (238, 120, 40, 255)
    d.polygon(pts, fill=shade)
    d.line(pts[:2], fill=WHITE, width=4 * S)
d.ellipse(box(cx - inner + 2, cy - inner + 2, cx + inner - 2, cy + inner - 2), fill=(90, 28, 6, 255))
d.ellipse(box(cx - 12, cy - 16, cx + 2, cy - 2), fill=(255, 255, 255, 170))
save(img, "CoffeeLens")


# --- CoffeeMotion: fotogramas clave sobre una línea de tiempo ------------------
img, d = gradient_canvas((174, 62, 201), (255, 146, 43))
d.rounded_rectangle(box(40, 70, 216, 120), radius=12 * S, fill=(70, 20, 90, 110))
d.rounded_rectangle(box(40, 140, 216, 190), radius=12 * S, fill=(70, 20, 90, 110))
d.line([p(40, 205), p(216, 205)], fill=WHITE, width=5 * S)
for cx_, cy_ in ((74, 95), (150, 95), (110, 165), (190, 165)):
    d.polygon([p(cx_, cy_ - 19), p(cx_ + 19, cy_), p(cx_, cy_ + 19), p(cx_ - 19, cy_)], fill=WHITE)
d.line([p(132, 52), p(132, 218)], fill=(255, 230, 120, 255), width=6 * S)
d.polygon([p(120, 44), p(144, 44), p(132, 60)], fill=(255, 230, 120, 255))
save(img, "CoffeeMotion")

# --- CoffeeSound: forma de onda --------------------------------------------------
img, d = gradient_canvas((250, 82, 82), (252, 196, 25))
heights = [20, 46, 84, 60, 110, 70, 132, 88, 54, 100, 64, 36, 18]
for i, hh in enumerate(heights):
    x = 44 + i * 14
    d.rounded_rectangle(box(x, 128 - hh / 2, x + 8, 128 + hh / 2), radius=4 * S, fill=WHITE)
save(img, "CoffeeSound")

# --- CoffeeEncoder: flechas de conversión alrededor de un fotograma ------------
img, d = gradient_canvas((217, 92, 15), (134, 46, 90))
d.rounded_rectangle(box(88, 96, 168, 160), radius=8 * S, fill=WHITE)
d.polygon([p(118, 112), p(144, 128), p(118, 144)], fill=(186, 72, 50, 255))
d.arc(box(50, 50, 206, 206), start=200, end=340, fill=WHITE, width=12 * S)
d.polygon([p(196, 74), p(214, 112), p(176, 106)], fill=WHITE)
d.arc(box(50, 50, 206, 206), start=20, end=160, fill=WHITE, width=12 * S)
d.polygon([p(60, 182), p(42, 144), p(80, 150)], fill=WHITE)
save(img, "CoffeeEncoder")

# --- CoffeeAnimate: pelota que rebota con estela ----------------------------------
img, d = gradient_canvas((255, 107, 107), (255, 212, 59))
d.line([p(40, 196), p(216, 196)], fill=(255, 255, 255, 200), width=5 * S)
for i, (x, y, r, a) in enumerate([(62, 96, 10, 90), (88, 140, 13, 130), (112, 180, 15, 170)]):
    d.ellipse(box(x - r, y - r, x + r, y + r), fill=(255, 255, 255, a))
d.ellipse(box(146, 82, 206, 142), fill=WHITE)
d.arc(box(112, 60, 230, 230), start=200, end=260, fill=(255, 255, 255, 160), width=4 * S)
save(img, "CoffeeAnimate")

# --- CoffeePuppet: cara de marioneta con puntos de control -----------------------
img, d = gradient_canvas((247, 131, 172), (255, 135, 87))
d.ellipse(box(62, 62, 194, 200), fill=WHITE)
d.ellipse(box(94, 106, 114, 126), fill=(232, 89, 120, 255))
d.ellipse(box(142, 106, 162, 126), fill=(232, 89, 120, 255))
d.arc(box(98, 120, 158, 176), start=20, end=160, fill=(232, 89, 120, 255), width=7 * S)
for x, y in ((128, 40), (40, 128), (216, 128)):
    d.line([p(128, 128), p(x, y)], fill=(255, 255, 255, 150), width=3 * S)
    d.ellipse(box(x - 9, y - 9, x + 9, y + 9), fill=WHITE)
save(img, "CoffeePuppet")
