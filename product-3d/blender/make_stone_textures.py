#!/usr/bin/env python3
"""
Generate realistic, tileable polished-serpentine PBR textures with numpy:
  stone_albedo.png, stone_roughness.png, stone_normal.png  (2048, seamless)

Serpentine look: opaque dark grey-green base, irregular darker mineral
vein network, low-contrast mottling, fine speckle. No bright scribbles,
no oversized marble lines. Colour / roughness / normal driven by
different combinations of the masks so nothing looks like one pattern.
"""
import os
import numpy as np
from PIL import Image

TEX = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    "..", "textures"))
os.makedirs(TEX, exist_ok=True)
N = 2048
rng = np.random.default_rng(20260716)


def value_noise(size, cells, seed):
    """Seamless bilinear value noise on a periodic grid."""
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    # tile by wrapping indices
    xs = np.linspace(0, cells, size, endpoint=False)
    x0 = np.floor(xs).astype(int) % cells
    x1 = (x0 + 1) % cells
    fx = xs - np.floor(xs)
    gx = fx * fx * (3 - 2 * fx)
    # rows
    top = g[x0][:, x0] * (1 - gx)[None, :] + g[x0][:, x1] * gx[None, :]
    bot = g[x1][:, x0] * (1 - gx)[None, :] + g[x1][:, x1] * gx[None, :]
    out = top * (1 - gx)[:, None] + bot * gx[:, None]
    return out


def fbm(size, base_cells, octaves, seed, gain=0.5, lac=2.0):
    total = np.zeros((size, size))
    amp, cells, norm = 1.0, base_cells, 0.0
    for o in range(octaves):
        total += amp * value_noise(size, int(cells), seed + o * 17)
        norm += amp
        amp *= gain
        cells *= lac
    return total / norm


def normalize01(a):
    return (a - a.min()) / (a.ptp() + 1e-9)


print("generating serpentine masks…")
mottle = normalize01(fbm(N, 4, 6, 1))            # large tonal drift
grain = normalize01(fbm(N, 40, 4, 2))            # medium grain
fine = normalize01(fbm(N, 220, 3, 3))            # fine speckle

# vein network: ridged noise -> thin dark filaments
rid = fbm(N, 7, 5, 4)
rid = np.abs(2 * normalize01(rid) - 1)           # crease at mid-level
veins = np.clip(1.0 - rid * 6.0, 0, 1)           # sharp thin lines
veins *= (0.4 + 0.6 * mottle)                     # veins fade in/out naturally
veins2 = np.clip(1.0 - np.abs(2 * normalize01(fbm(N, 15, 4, 9)) - 1) * 9, 0, 1)
veins = np.clip(veins + 0.5 * veins2, 0, 1)

# ---- albedo (linear-ish sRGB values) ----
deep = np.array([0.045, 0.070, 0.050])           # deep green
mid = np.array([0.090, 0.120, 0.088])            # mid sage
veincol = np.array([0.018, 0.030, 0.022])        # near-black vein
base = deep[None, None, :] + (mid - deep)[None, None, :] * \
    (0.35 * mottle + 0.4 * grain)[:, :, None]
base = base * (1.0 - 0.10 * fine)[:, :, None]     # speckle darkening
albedo = base * (1.0 - veins[:, :, None] * 0.85) + \
    veincol[None, None, :] * (veins[:, :, None] * 0.85)
albedo = np.clip(albedo, 0, 1)
# to sRGB gamma
albedo_srgb = np.clip(albedo, 0, 1) ** (1 / 2.2)
Image.fromarray((albedo_srgb * 255).astype(np.uint8)).save(
    os.path.join(TEX, "stone_albedo.png"))

# ---- roughness: polished 0.28..0.42, veins a touch rougher ----
rough = 0.30 + 0.06 * normalize01(grain * 0.6 + fine * 0.4) + 0.08 * veins
rough = np.clip(rough, 0.26, 0.46)
Image.fromarray((rough * 255).astype(np.uint8)).save(
    os.path.join(TEX, "stone_roughness.png"))

# ---- normal from a height field (veins recessed, subtle grain relief) ----
height = 0.6 * grain + 0.4 * mottle - 0.8 * veins
height = normalize01(height)
gy, gx = np.gradient(height.astype(np.float64))
strength = 2.2
nx = -gx * strength
ny = -gy * strength
nz = np.ones_like(height)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
normal_img = ((normal * 0.5 + 0.5) * 255).astype(np.uint8)
Image.fromarray(normal_img).save(os.path.join(TEX, "stone_normal.png"))

print("wrote stone_albedo / stone_roughness / stone_normal (2048) ->", TEX)
