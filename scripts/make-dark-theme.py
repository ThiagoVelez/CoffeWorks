"""Genera CoffeeDataBase/src/dark.css: el tema oscuro. Recorre las clases de
color de Tailwind usadas en la interfaz y define su equivalente oscuro (los
fondos claros pasan a oscuros, los textos oscuros a claros); el rojo rubí de la
marca se mantiene."""

import colorsys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "CoffeeDataBase" / "src"
KEEP = {"9b111e", "6e0a16", "c0392b", "c99a1e", "2e7d32", "1d6fa5", "b5651d", "b71c1c", "b26a00", "ff8a2a"}
PATTERN = re.compile(r"((?:hover|focus|focus-within|group-hover|disabled|placeholder):)?(bg|text|border|ring|from|to)-\[#([0-9a-fA-F]{6})\]")


def hls(hex_color):
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)


def to_hex(h, l, s):
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l)), max(0, min(1, s)))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def dark_bg(hex_color):
    h, l, s = hls(hex_color)
    if l < 0.45:
        return None  # ya es oscuro (botones, insignias)
    return to_hex(h, 0.07 + (1 - l) * 0.55, s * 0.35)


def dark_text(hex_color):
    h, l, s = hls(hex_color)
    if l > 0.6:
        return None
    return to_hex(h, 0.93 - l * 0.45, s * 0.4)


def dark_border(hex_color):
    h, l, s = hls(hex_color)
    return to_hex(h, 0.2 + (1 - l) * 0.25, s * 0.3)


def esc(cls):
    return re.sub(r"([:\[\]#])", r"\\\1", cls)


found = set()
for path in ROOT.rglob("*.tsx"):
    for m in PATTERN.finditer(path.read_text(encoding="utf-8")):
        found.add((m.group(1) or "", m.group(2), m.group(3).lower()))

rules = []
for variant, kind, color in sorted(found):
    if color in KEEP:
        # El rojo de la marca, como texto, se aclara para leerse sobre oscuro
        if kind == "text" and color in {"9b111e", "6e0a16", "c0392b"}:
            rules.append(f"html.dark .{esc(variant + kind + '-[#' + color + ']')} {{ color: #f2939c !important; }}")
        continue
    value = {"bg": dark_bg, "from": dark_bg, "to": dark_bg, "text": dark_text}.get(kind, dark_border)(color)
    if value is None:
        continue
    cls = f"{variant}{kind}-[#{color}]"
    pseudo = {"hover:": ":hover", "focus:": ":focus", "focus-within:": ":focus-within", "disabled:": ":disabled", "placeholder:": "::placeholder"}.get(variant, "")
    selector = f"html.dark .{esc(cls)}{pseudo}"
    if variant == "group-hover:":
        selector = f"html.dark .group:hover .{esc(cls)}"
    prop = {"bg": "background-color", "text": "color", "border": "border-color", "ring": "--tw-ring-color", "from": "--tw-gradient-from", "to": "--tw-gradient-to"}[kind]
    rules.append(f"{selector} {{ {prop}: {value} !important; }}")

header = """/* Tema oscuro de CoffeeDataBase (generado por scripts/make-dark-theme.py). */
html.dark body { background: #151011; color: #f1e5e6; }
html.dark .bg-white { background-color: #1d1617 !important; }
html.dark .hover\\:bg-white:hover { background-color: #241b1c !important; }
html.dark .bg-black\\/40 { background-color: rgba(0, 0, 0, 0.65) !important; }
html.dark .text-gray-500, html.dark .text-gray-600, html.dark .text-gray-700 { color: #c9b8ba !important; }
html.dark .border-gray-200, html.dark .border-gray-300 { border-color: #3a2c2e !important; }
html.dark .bg-gray-50, html.dark .bg-gray-100, html.dark .hover\\:bg-gray-100:hover { background-color: #241b1c !important; }
html.dark input, html.dark select, html.dark textarea { background-color: #211819; color: #f1e5e6; }
html.dark input::placeholder, html.dark textarea::placeholder { color: #8f7a7d; }
html.dark ::-webkit-scrollbar-thumb { background: #4a3a3c; border: 2px solid transparent; background-clip: content-box; }
html.dark .shadow-sm, html.dark .shadow-md, html.dark .shadow-xl, html.dark .shadow-2xl { box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45) !important; }
"""
out = ROOT / "dark.css"
out.write_text(header + "\n".join(rules) + "\n", encoding="utf-8")
print(f"{len(rules)} reglas en {out}")
