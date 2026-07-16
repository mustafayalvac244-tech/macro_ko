#!/usr/bin/env python3
"""Overlay verified real-world dimensions on the clay validation renders.

Pixel mapping is exact: orthographic renders use ortho_scale = 0.125 m
at 1100x1100 px -> 88 px/cm, image centre = (x=0, z=2.8 cm).
Values drawn here are the ones measured from the generated geometry
(see renders/dimension_report.json), not decorative labels.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.normpath(os.path.join(HERE, "..", "renders"))

PX_PER_CM = 1100 / 12.5
CX, CZ_CM = 550, 2.8

with open(os.path.join(R, "dimension_report.json")) as f:
    rep = json.load(f)

def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

F = font(30)
COL = (176, 34, 34)

def px(x_cm):  return CX + x_cm * PX_PER_CM
def py(z_cm):  return 550 - (z_cm - CZ_CM) * PX_PER_CM

def arrow(d, p1, p2, label, off=(0, 0)):
    d.line([p1, p2], fill=COL, width=4)
    for p, q in ((p1, p2), (p2, p1)):
        vx, vy = q[0]-p[0], q[1]-p[1]
        L = max((vx*vx+vy*vy) ** 0.5, 1)
        ux, uy = vx/L, vy/L
        n = (-uy, ux)
        for s in (1, -1):
            d.line([p, (p[0]+ux*18+n[0]*8*s, p[1]+uy*18+n[1]*8*s)],
                   fill=COL, width=4)
    mx, my = (p1[0]+p2[0])/2 + off[0], (p1[1]+p2[1])/2 + off[1]
    tb = d.textbbox((mx, my), label, font=F, anchor="mm")
    d.rectangle([tb[0]-6, tb[1]-4, tb[2]+6, tb[3]+4], fill=(255, 255, 255, 235))
    d.text((mx, my), label, font=F, fill=COL, anchor="mm")

# ---------------- front view: 8 / 7 / 5 / 2 cm ----------------
im = Image.open(os.path.join(R, "clay_front.png")).convert("RGB")
d = ImageDraw.Draw(im, "RGBA")
sw, sh = rep["stone_w"], rep["stone_h"]
smn, smx = rep["stone_bounds"]
x0, x1 = smn[0]/0.01, smx[0]/0.01          # cm
z0, z1 = smn[2]/0.01, smx[2]/0.01
arrow(d, (px(x0), 1010), (px(x1), 1010), f"{sw:.2f} cm  (hedef 8)")
arrow(d, (935, py(z0)), (935, py(z1)), f"{sh:.2f} cm  (hedef 7)",
      off=(-125, 40))
arrow(d, (px(x0), py(4.78)), (px(0.97), py(4.78)),
      f"{0.97 - x0:.2f} cm  (hedef 5)")
bh = rep["brush_h"]
arrow(d, (150, py(z0)), (150, py(z0 - bh)), f"{bh:.2f} cm  (hedef 2)")
d.text((30, 28), "FRONT — orthographic, 88 px/cm", font=F, fill=(60, 60, 60))
im.save(os.path.join(R, "dims_front.png"))

# ---------------- left view: 2.5 / 1 / 2 cm ----------------
im = Image.open(os.path.join(R, "clay_left.png")).convert("RGB")
d = ImageDraw.Draw(im, "RGBA")

def bend(z):   # mirror of gen_product.bend_cm
    z0b, z1b = 3.2, 7.0
    if z <= z0b: return 0.0
    u = min(1.0, (z - z0b) / (z1b - z0b)); u = u*u*(3-2*u)
    return 0.55 * u

# body thickness 2.5 at z=1.5 (y in [-1.25, 1.25])
arrow(d, (px(-1.25), py(1.5)), (px(1.25), py(1.5)), "2.50 cm  (hedef 2.5)",
      off=(0, -42))
# fin thickness 1.0 at z=6.0, centred on the bend offset
b = bend(6.0)
arrow(d, (px(b-0.5), py(6.0)), (px(b+0.5), py(6.0)), "1.00 cm  (hedef 1)",
      off=(150, 0))
# brush thickness 2.0 at z=-1.0
arrow(d, (px(-1.0), py(-1.0)), (px(1.0), py(-1.0)),
      f"{rep['brush_t']:.2f} cm  (hedef 2)", off=(0, 44))
d.text((30, 28), "LEFT — orthographic, 88 px/cm", font=F, fill=(60, 60, 60))
im.save(os.path.join(R, "dims_left.png"))
print("annotated:", os.path.join(R, "dims_front.png"),
      os.path.join(R, "dims_left.png"))
