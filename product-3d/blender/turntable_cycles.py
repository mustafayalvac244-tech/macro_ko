#!/usr/bin/env python3
"""Cycles turntable: orbit the Product camera around the brusher and render
N frames under the studio lighting. Frames -> renders/turn/f####.png."""
import os, math
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.normpath(os.path.join(HERE, "..", "renders", "turn"))
os.makedirs(OUTDIR, exist_ok=True)
SRC = os.path.join(HERE, "reference_upload.blend")

N = 30
RES = 600
SAMPLES = 16

bpy.ops.wm.open_mainfile(filepath=SRC)

import export_glb as X
_cur = bpy.data.objects.get('Dense fine fiber bundle')
if _cur and _cur.type == 'CURVE':
    X.shape_fiber_cut(_cur); _cur.data.bevel_depth = X.FIBER_RADIUS

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
try:
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.film_transparent = False
opts = [e.identifier for e in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
sc.view_settings.view_transform = 'AgX' if 'AgX' in opts else 'Filmic'

# object centre (stone + fibres)
stone = bpy.data.objects['Single-piece variable-thickness serpentine body']
c = Vector((0, 0, 0)); nn = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name != 'Studio floor':
        bb = [o.matrix_world @ Vector(v) for v in o.bound_box]
        for p in bb: c += p; nn += 1
c /= nn

cam = bpy.data.objects.get('Product camera')
sc.camera = cam
# current radius/elevation of the camera relative to centre
off = cam.location - c
radius = math.hypot(off.x, off.y)
elev = off.z

import mathutils
for i in range(N):
    ang = (i / N) * 2 * math.pi
    cam.location = (c.x + radius * math.sin(ang),
                    c.y - radius * math.cos(ang),
                    c.z + elev)
    # aim at centre
    dirv = (c - cam.location)
    cam.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUTDIR, f"f{i:04d}.png")
    bpy.ops.render.render(write_still=True)
    print("frame", i)
print("TURNTABLE DONE", OUTDIR)
