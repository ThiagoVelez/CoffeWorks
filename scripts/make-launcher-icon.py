"""Genera el logo de CoffeeWorks (CoffeeWorks_Icon/CoffeeWorks.ico y .png):
una taza de café vista desde arriba, con arte latte en forma de corazón,
sobre un cuadrado redondeado con degradado de caramelo a espresso."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
S = 4
SIZE = 256 * S


def box(cx, cy, r):
    return [(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S]


def gradient(size, top_left, bottom_right):
    """Degradado diagonal."""
    base = Image.new("RGBA", (size, size))
    px = base.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(top_left, bottom_right)) + (255,)
    return base


def build(size_px=SIZE):
    small = 256
    grad = gradient(small, (226, 150, 82), (74, 38, 22)).resize((size_px, size_px), Image.BICUBIC)
    mask = Image.new("L", (size_px, size_px), 0)
    ImageDraw.Draw(mask).rounded_rectangle([16 * S, 16 * S, 240 * S, 240 * S], radius=58 * S, fill=255)
    img = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)

    # Brillo suave en la parte superior
    shine = Image.new("L", (size_px, size_px), 0)
    ImageDraw.Draw(shine).ellipse([-40 * S, -150 * S, 300 * S, 120 * S], fill=60)
    shine = ImageChops.multiply(shine.filter(ImageFilter.GaussianBlur(30 * S)), mask)
    img = Image.composite(Image.new("RGBA", img.size, (255, 255, 255, 255)), img, shine)

    cx, cy = 120, 128
    # Sombra del platillo
    shadow = Image.new("L", (size_px, size_px), 0)
    ImageDraw.Draw(shadow).ellipse(box(cx + 6, cy + 10, 82), fill=120)
    shadow = shadow.filter(ImageFilter.GaussianBlur(10 * S))
    img = Image.composite(Image.new("RGBA", img.size, (40, 18, 8, 255)), img, ImageChops.multiply(shadow, mask))

    d = ImageDraw.Draw(img)
    # Platillo
    d.ellipse(box(cx, cy, 80), fill=(251, 244, 234, 255))
    d.ellipse(box(cx, cy, 68), fill=(240, 228, 212, 255))
    # Asa de la taza (a la derecha, vista desde arriba)
    d.rounded_rectangle([(cx + 40) * S, (cy - 11) * S, (cx + 84) * S, (cy + 11) * S], radius=11 * S, fill=(255, 255, 255, 255))
    d.rounded_rectangle([(cx + 58) * S, (cy - 4) * S, (cx + 76) * S, (cy + 4) * S], radius=4 * S, fill=(240, 228, 212, 255))
    # Taza
    d.ellipse(box(cx, cy, 58), fill=(255, 255, 255, 255))
    d.ellipse(box(cx, cy, 49), fill=(111, 63, 34, 255))
    # Crema alrededor del café
    d.ellipse(box(cx, cy, 49), outline=(166, 104, 60, 255), width=4 * S)

    # Corazón de arte latte
    heart = Image.new("L", (size_px, size_px), 0)
    h = ImageDraw.Draw(heart)
    r = 15
    h.ellipse(box(cx - 13, cy - 8, r), fill=255)
    h.ellipse(box(cx + 13, cy - 8, r), fill=255)
    h.polygon([((cx - 27) * S, (cy - 2) * S), ((cx + 27) * S, (cy - 2) * S), (cx * S, (cy + 30) * S)], fill=255)
    heart = heart.filter(ImageFilter.GaussianBlur(0.6 * S))
    img = Image.composite(Image.new("RGBA", img.size, (246, 230, 208, 255)), img, heart)
    return img


icon = build().resize((256, 256), Image.LANCZOS)
out_dir = ROOT / "CoffeeWorks_Icon"
icon.save(out_dir / "CoffeeWorks.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
icon.save(out_dir / "CoffeeWorks.png")
print("Logo creado en", out_dir / "CoffeeWorks.ico")
