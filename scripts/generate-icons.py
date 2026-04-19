"""Generate icon files (ico, png, svg) for SceneTodo using Pillow."""
import os
from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(SCRIPT_DIR, "..", "src-tauri", "icons")
PUBLIC_DIR = os.path.join(SCRIPT_DIR, "..", "public")

BASE = (55, 48, 163)    # #3730A3
LIGHT = (129, 140, 248)  # #818CF8


def make_gradient(size, base, light):
    """Create a vertical gradient image."""
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    for y in range(size[1]):
        t = y / max(size[1] - 1, 1)
        c = tuple(int(base[i] + (light[i] - base[i]) * t) for i in range(3)) + (255,)
        ImageDraw.Draw(img).line([(0, y), (size[0] - 1, y)], fill=c)
    return img


def draw_logo(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 20

    # Single centered card: 15x14, placed at (2.5, 3) → center at (10, 10)
    cw, ch = int(15 * s), int(14 * s)
    cr = int(3 * s)
    card = make_gradient((cw, ch), BASE, LIGHT)
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (cw - 1, ch - 1)], radius=cr, fill=255)
    card.putalpha(mask)
    img.paste(card, (int(2.5 * s), int(3 * s)), card)

    # Checkmark — centered within the card
    d = ImageDraw.Draw(img)
    lw = max(int(2.2 * s), 1)
    p1 = (int(6.5 * s), int(10.5 * s))
    p2 = (int(9 * s), int(13 * s))
    p3 = (int(14 * s), int(7.5 * s))
    d.line([p1, p2], fill=(255, 255, 255), width=lw)
    d.line([p2, p3], fill=(255, 255, 255), width=lw)

    return img


# SVG favicon
svg = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#3730A3"/>
      <stop offset="100%" stop-color="#818CF8"/>
    </linearGradient>
  </defs>
  <rect x="64" y="77" width="384" height="358" rx="77" fill="url(#g)"/>
  <path d="M166 269 L230 333 L346 192" stroke="white" stroke-width="56" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>"""

os.makedirs(PUBLIC_DIR, exist_ok=True)
with open(os.path.join(PUBLIC_DIR, "logo.svg"), "w") as f:
    f.write(svg)

# PNG
big = draw_logo(256)
big.save(os.path.join(ICONS_DIR, "icon.png"))

# ICO
sizes = [16, 32, 48, 256]
big.save(
    os.path.join(ICONS_DIR, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in sizes],
)

# Verify
sample = big.getpixel((10, 10))
center = big.getpixel((128, 128))
print(f"Background (10,10): {sample} -> transparent: {sample[3] == 0}")
print(f"Center (128,128): {center} -> opaque: {center[3] > 0}")
print("Generated: icon.ico, icon.png, logo.svg")
