#!/usr/bin/env python3
"""
Realistic polished-serpentine PBR textures (albedo / roughness / normal),
2048px, tuned to MATCH the real product photo's pattern:

  - dark grey-green base
  - broad, soft-edged BLACK mottled blotches clustered like clouds
    (the "siyahlıklar" in the reference) with grainy, ragged edges
  - lighter grey-green marbled wisps weaving between the blotches
  - fine mineral speckle

No thin spider-web vein network (that was wrong); the dominant feature is
soft black cloud blotches, exactly as in the photo.
"""
import os
import sys
import numpy as np
from PIL import Image

TEX = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    "..", "textures"))
os.makedirs(TEX, exist_ok=True)
# resolution + filename suffix via CLI:  python3 make_stone_textures.py 4096 _4k
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2048
SUF = sys.argv[2] if len(sys.argv) > 2 else ""


def value_noise(size, cells, seed):
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    xs = np.linspace(0, cells, size, endpoint=False)
    x0 = np.floor(xs).astype(int) % cells
    x1 = (x0 + 1) % cells
    fx = xs - np.floor(xs)
    gx = fx * fx * (3 - 2 * fx)
    top = g[x0][:, x0] * (1 - gx)[None, :] + g[x0][:, x1] * gx[None, :]
    bot = g[x1][:, x0] * (1 - gx)[None, :] + g[x1][:, x1] * gx[None, :]
    return top * (1 - gx)[:, None] + bot * gx[:, None]


def fbm(size, base_cells, octaves, seed, gain=0.5, lac=2.0):
    total = np.zeros((size, size)); amp = 1.0; cells = base_cells; norm = 0.0
    for o in range(octaves):
        total += amp * value_noise(size, int(cells), seed + o * 17)
        norm += amp; amp *= gain; cells *= lac
    return total / norm


def nrm(a):
    return (a - a.min()) / (a.ptp() + 1e-9)


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


print("generating serpentine (blotchy clouds, photo-matched)…")
# --- cloud masks that decide where the black blotches sit ---
cloud_big = nrm(fbm(N, 4, 4, 11))       # large cloud regions
cloud_med = nrm(fbm(N, 9, 4, 23))       # medium clumps inside
cloud = nrm(0.62 * cloud_big + 0.38 * cloud_med)
edge_grain = nrm(fbm(N, 70, 3, 31))     # ragged, grainy blotch edges
fine = nrm(fbm(N, 240, 3, 43))          # fine speckle
micro = nrm(fbm(N, 700, 2, 71))         # micro grain (8k detail)
mottle = nrm(fbm(N, 16, 4, 5))          # base tonal variation
wisp = nrm(fbm(N, 22, 4, 61))           # lighter marbled streaks
sub_blot = nrm(fbm(N, 130, 3, 97))      # fine secondary black flecks/clusters

# black blotches: dark where cloud is low; ragged edges via grain; ~45% cover
dark = smooth(0.40, 0.66, (0.60 - cloud) * 1.6 + 0.5)
dark = np.clip(dark * (0.72 + 0.42 * edge_grain), 0, 1)
dark = np.clip(dark + 0.20 * smooth(0.7, 1.0, fine) * (dark > 0.15), 0, 1)
# fine secondary dark specks sprinkled through the mid-tone (visible on zoom)
dark = np.clip(dark + 0.5 * smooth(0.80, 0.98, sub_blot) * (1 - dark), 0, 1)

# lighter marbled wisps only in the non-dark areas
wisp_streak = smooth(0.62, 0.9, wisp) * (1 - dark)

# --- colours (desaturated dark grey-green, from the photo) ---
base_green = np.array([0.060, 0.082, 0.060])   # grey-green mid
light_green = np.array([0.120, 0.145, 0.108])  # lighter marbled
black = np.array([0.010, 0.018, 0.014])        # near-black blotch

alb = base_green[None, None, :] + (light_green - base_green)[None, None, :] \
    * (0.55 * mottle)[:, :, None]
alb = alb * (1 - wisp_streak[:, :, None] * 0.0) \
    + light_green[None, None, :] * (wisp_streak[:, :, None] * 0.45)
alb = alb * (1 - dark[:, :, None]) + black[None, None, :] * dark[:, :, None]
alb = alb * (1.0 - 0.14 * fine)[:, :, None]     # fine speckle darkening
alb = alb * (1.0 - 0.06 * micro)[:, :, None]    # micro grain (holds at 8k)
# a few tiny bright mineral flecks
fleck = (fine > 0.985).astype(float)
alb = alb + fleck[:, :, None] * np.array([0.05, 0.06, 0.045])[None, None, :]
alb = np.clip(alb, 0, 1)

Image.fromarray((np.clip(alb, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)).save(
    os.path.join(TEX, f"stone_albedo{SUF}.png"))

# --- roughness: polished; black mineral a touch less glossy; micro polish ---
rough = 0.30 + 0.05 * mottle + 0.07 * dark + 0.03 * fine + 0.025 * micro
rough = np.clip(rough, 0.26, 0.45)
Image.fromarray((rough * 255).astype(np.uint8)).save(
    os.path.join(TEX, f"stone_roughness{SUF}.png"))

# --- normal: gentle relief (blotches sunken) + fine + micro detail ---
height = nrm(0.5 * mottle + 0.10 * fine + 0.06 * micro - 0.35 * dark)
gy, gx = np.gradient(height.astype(np.float64))
s = 1.8 * (N / 2048.0)                           # keep slope scale-consistent
nx, ny, nz = -gx * s, -gy * s, np.ones_like(height)
ln = np.sqrt(nx * nx + ny * ny + nz * nz)
normal = np.stack([nx / ln, ny / ln, nz / ln], -1)
Image.fromarray(((normal * 0.5 + 0.5) * 255).astype(np.uint8)).save(
    os.path.join(TEX, f"stone_normal{SUF}.png"))

print(f"wrote photo-matched serpentine maps ({N}px{SUF}) ->", TEX)
