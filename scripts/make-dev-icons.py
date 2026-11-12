"""Genera los iconos de la categoría Desarrollador:
CoffeeUI/UX (fondo amarillo, pluma vectorial con curva y nodos) y
CoffeeUML (verde viridian, tres clases UML conectadas)."""

import math
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


def canvas(color):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box(16, 16, 241, 241), radius=48 * S, fill=color)
    return img, d


def save(img, name, app_dir):
    icon = img.resize((256, 256), Image.LANCZOS)
    icon.save(ROOT / "CoffeeWorks_Icon" / f"{name}.ico", sizes=SIZES)
    icon.save(ROOT / "CoffeeWorks_Icon" / f"{name}.png")
    shutil.copy(ROOT / "CoffeeWorks_Icon" / f"{name}.ico", ROOT / "public" / "icons" / f"{name}.ico")
    if (ROOT / app_dir).is_dir():
        (ROOT / app_dir / "public").mkdir(exist_ok=True)
        shutil.copy(ROOT / "CoffeeWorks_Icon" / f"{name}.ico", ROOT / app_dir / "public" / "app-icon.ico")
        icon.save(ROOT / app_dir / "public" / "app-icon.png")
        icons = ROOT / app_dir / "src-tauri" / "icons"
        icons.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / "CoffeeWorks_Icon" / f"{name}.ico", icons / "icon.ico")
        icon.save(icons / "icon.png")
    print("Icono creado:", name)


def bezier(p0, p1, p2, p3, steps=60):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        out.append(p(x, y))
    return out


# --- CoffeeUI/UX: pluma vectorial con curva Bézier y nodos ---------------------
YELLOW = (255, 196, 0, 255)
INK = (43, 33, 0, 255)
CREAM = (255, 246, 214, 255)
img, d = canvas(YELLOW)
# Marco de mesa de trabajo (esquinas)
for (x, y, dx, dy) in [(46, 46, 1, 1), (210, 46, -1, 1), (46, 210, 1, -1), (210, 210, -1, -1)]:
    d.line([p(x, y), p(x + 26 * dx, y)], fill=INK, width=7 * S)
    d.line([p(x, y), p(x, y + 26 * dy)], fill=INK, width=7 * S)
# Curva Bézier con tiradores
d.line(bezier((62, 178), (78, 92), (150, 70), (196, 88)), fill=INK, width=8 * S, joint="curve")
d.line([p(62, 178), p(78, 120)], fill=INK, width=3 * S)
d.line([p(196, 88), p(150, 70)], fill=INK, width=3 * S)
for (x, y) in [(78, 120), (150, 70)]:
    d.ellipse(box(x - 8, y - 8, x + 8, y + 8), fill=CREAM, outline=INK, width=3 * S)
for (x, y) in [(62, 178), (196, 88)]:
    d.rectangle(box(x - 11, y - 11, x + 11, y + 11), fill=CREAM, outline=INK, width=4 * S)
# Plumilla (pen tool)
cx, cy = 150, 150
nib = [p(cx, cy - 34), p(cx + 30, cy + 10), p(cx + 18, cy + 46), p(cx - 18, cy + 46), p(cx - 30, cy + 10)]
d.polygon(nib, fill=INK)
d.line([p(cx, cy - 24), p(cx, cy + 14)], fill=YELLOW, width=5 * S)
d.ellipse(box(cx - 7, cy + 10, cx + 7, cy + 24), fill=YELLOW)
d.rectangle(box(cx - 20, cy + 50, cx + 20, cy + 64), fill=INK)
save(img, "CoffeeUIUX", "CoffeeUIUX")

# --- CoffeeUML: tres clases UML conectadas (fondo verde viridian) --------------------------------
NAVY = (64, 130, 109, 255)  # viridian #40826D
CYAN = (199, 247, 226, 255)
WHITE = (250, 250, 250, 255)
PALE = (200, 230, 240, 255)
img, d = canvas(NAVY)


def uml_class(x0, y0, x1, y1):
    d.rounded_rectangle(box(x0, y0, x1, y1), radius=6 * S, fill=WHITE)
    d.rectangle(box(x0, y0 + 20, x1, y0 + 24), fill=NAVY)
    for k, yy in enumerate(range(y0 + 32, y1 - 6, 12)):
        d.rectangle(box(x0 + 8, yy, x1 - 8 - (k % 2) * 14, yy + 4), fill=PALE)


# Conectores (detrás)
d.line([p(128, 96), p(128, 132)], fill=CYAN, width=6 * S)
d.line([p(76, 132), p(180, 132)], fill=CYAN, width=6 * S)
d.line([p(76, 132), p(76, 150)], fill=CYAN, width=6 * S)
d.line([p(180, 132), p(180, 150)], fill=CYAN, width=6 * S)
# Triángulo de herencia
d.polygon([p(128, 84), p(116, 104), p(140, 104)], fill=NAVY, outline=CYAN)
d.polygon([p(128, 88), p(119, 102), p(137, 102)], fill=NAVY)
d.line([p(116, 104), p(140, 104), p(128, 84), p(116, 104)], fill=CYAN, width=4 * S)
uml_class(90, 40, 166, 84)
uml_class(36, 150, 116, 212)
uml_class(140, 150, 220, 212)
save(img, "CoffeeUML", "CoffeeUML")
