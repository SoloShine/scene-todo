"""Generate icon files (ico, png, svg) for SceneTodo."""
import os, math
from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(SCRIPT_DIR, "..", "src-tauri", "icons")
PUBLIC_DIR = os.path.join(SCRIPT_DIR, "..", "public")

# Theme gradient colors (indigo)
BASE = (83, 65, 194)    # #5341C2
LIGHT = (139, 126, 220) # #8B7EDC


def lerp_color(t):
    return tuple(int(BASE[i] + (LIGHT[i] - BASE[i]) * t) for i in range(3))


def rounded_rect(draw, xy, r, color):
    x0, y0, x1, y1 = xy
    w, h = x1 - x0, y1 - y0
    draw.rounded_rectangle(xy, radius=r, fill=color)


def draw_logo(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Gradient background for each card using alpha blending
    # We draw onto a temp image then paste with alpha

    s = size / 20  # scale from 20x20 viewBox

    cards = [
        (3.5, 5, 0.25),   # bottom
        (2.5, 3.5, 0.5),  # middle
        (1.5, 2, 1.0),    # top
    ]

    for x_off, y_off, alpha in cards:
        cx = int(x_off * s)
        cy = int(y_off * s)
        cw = int(13 * s)
        ch = int(11 * s)
        cr = int(2.5 * s)

        # Create gradient-filled card
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        card_draw = ImageDraw.Draw(card)

        for row in range(ch):
            t = row / max(ch - 1, 1)
            c = lerp_color(t) + (int(255 * alpha),)
            card_draw.rounded_rectangle(
                [(0, row), (cw - 1, row)],
                radius=0,
                fill=c,
            )
        # Mask with rounded rect
        mask = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (cw - 1, ch - 1)], radius=cr, fill=255)
        card.putalpha(mask)

        img.paste(card, (cx, cy), card)

    # Checkmark
    d = ImageDraw.Draw(img)
    lw = max(int(1.8 * s), 1)
    p1 = (int(5.5 * s), int(8 * s))
    p2 = (int(8 * s), int(10.5 * s))
    p3 = (int(13 * s), int(5.5 * s))
    d.line([p1, p2], fill=(255, 255, 255, 255), width=lw)
    d.line([p2, p3], fill=(255, 255, 255, 255), width=lw)

    return img


# Generate SVG favicon
svg_content = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5341C2"/>
      <stop offset="100%" stop-color="#8B7EDC"/>
    </linearGradient>
  </defs>
  <rect x="90" y="128" width="333" height="282" rx="64" fill="url(#g)" opacity="0.25"/>
  <rect x="64" y="90" width="333" height="282" rx="64" fill="url(#g)" opacity="0.5"/>
  <rect x="38" y="51" width="333" height="282" rx="64" fill="url(#g)"/>
  <path d="M141 205 L205 269 L371 141" stroke="white" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>"""

os.makedirs(PUBLIC_DIR, exist_ok=True)
svg_path = os.path.join(PUBLIC_DIR, "logo.svg")
with open(svg_path, "w") as f:
    f.write(svg_content)
print(f"SVG: {svg_path}")

# Generate PNG (256x256)
big = draw_logo(256)
png_path = os.path.join(ICONS_DIR, "icon.png")
big.save(png_path)
print(f"PNG: {png_path}")

# Generate ICO (16, 32, 48, 256)
ico_sizes = [16, 32, 48, 256]
imgs = [draw_logo(s) for s in ico_sizes]
ico_path = os.path.join(ICONS_DIR, "icon.ico")
imgs[0].save(ico_path, format="ICO", sizes=[(s, s) for s in ico_sizes], append_images=imgs[1:])
print(f"ICO: {ico_path}")
