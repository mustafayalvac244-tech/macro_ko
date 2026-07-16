#!/usr/bin/env python3
"""Generate the image textures the model needs:
  - logo_mioren.png : transparent gold wordmark + bee emblem (decal)
  - hair_card.png   : RGBA strip of fine synthetic fibres (dark root ->
                      warm light tip) with a soft alpha mask, for hair cards
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.normpath(os.path.join(HERE, "..", "textures"))
os.makedirs(TEX, exist_ok=True)


def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def make_logo():
    W, H = 1024, 512
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    gold = (196, 158, 84, 255)
    # emblem: minimalist bee — rounded body + two little wings, line art
    cx, cy = W // 2, 168
    d.ellipse([cx - 26, cy - 20, cx + 26, cy + 44], outline=gold, width=9)
    # wings
    d.arc([cx - 74, cy - 46, cx - 6, cy + 20], 300, 80, fill=gold, width=9)
    d.arc([cx + 6, cy - 46, cx + 74, cy + 20], 100, 240, fill=gold, width=9)
    # body stripes
    for yy in (cy + 2, cy + 18):
        d.line([cx - 20, yy, cx + 20, yy], fill=gold, width=7)
    # wordmark
    f = font(150)
    txt = "mioren"
    tb = d.textbbox((0, 0), txt, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((W - tw) // 2 - tb[0], 300 - tb[1]), txt, font=f, fill=gold)
    im.save(os.path.join(TEX, "logo_mioren.png"))
    print("logo ->", os.path.join(TEX, "logo_mioren.png"))


def make_hair_card():
    """A vertical strip of many fine fibres. Root (bottom) dark brown ->
    tip (top) warm light brown. Alpha tapers the strand edges so cards
    read as loose hair, not a solid ribbon."""
    W, H = 512, 512
    rgb = Image.new("RGB", (W, H), (0, 0, 0))
    alpha = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(rgb)
    da = ImageDraw.Draw(alpha)
    rnd = random.Random(7)

    def lerp(a, b, t):
        return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

    root = (58, 34, 14)
    mid = (150, 92, 40)
    tip = (214, 150, 86)

    n = 230
    for i in range(n):
        x = (i + 0.5) / n * W + rnd.uniform(-1.2, 1.2)
        sway = rnd.uniform(-10, 10)
        w = rnd.uniform(1.1, 2.6)
        # brightness variation per strand
        k = rnd.uniform(0.82, 1.12)
        segs = 24
        pts = []
        for s in range(segs + 1):
            t = s / segs
            px = x + sway * (t ** 1.6)
            py = H - t * H
            pts.append((px, py, t))
        for s in range(segs):
            x0, y0, t0 = pts[s]
            x1, y1, t1 = pts[s + 1]
            if t0 < 0.5:
                col = lerp(root, mid, t0 / 0.5)
            else:
                col = lerp(mid, tip, (t0 - 0.5) / 0.5)
            col = tuple(min(255, int(c * k)) for c in col)
            dr.line([(x0, y0), (x1, y1)], fill=col, width=int(round(w)))
            # alpha: strand fades slightly toward the very tip
            a = int(235 * (1.0 - 0.35 * max(0, t0 - 0.7) / 0.3))
            da.line([(x0, y0), (x1, y1)], fill=a, width=int(round(w)))

    rgb = rgb.filter(ImageFilter.GaussianBlur(0.4))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.5))
    out = Image.merge("RGBA", (*rgb.split(), alpha))
    out.save(os.path.join(TEX, "hair_card.png"))
    print("hair ->", os.path.join(TEX, "hair_card.png"))


if __name__ == "__main__":
    make_logo()
    make_hair_card()
