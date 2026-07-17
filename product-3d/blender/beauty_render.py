#!/usr/bin/env python3
"""Photorealistic Cycles product 'photo' of the mioren brusher under the
studio lighting stored in the master blend."""
import os, sys, math
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "renders"))
os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(HERE, "reference_upload.blend")

bpy.ops.wm.open_mainfile(filepath=SRC)

# apply the photo-matched tuft + central-arch fibre cut to the master curve
import export_glb as X
cur = bpy.data.objects.get('Dense fine fiber bundle')
if cur and cur.type == 'CURVE':
    X.shape_fiber_cut(cur)
    cur.data.bevel_depth = X.FIBER_RADIUS

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = int(sys.argv[sys.argv.index('--samples')+1]) if '--samples' in sys.argv else 110
try:
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
sc.render.resolution_x = 1280
sc.render.resolution_y = 1280
sc.render.resolution_percentage = 100
sc.render.film_transparent = False
# filmic-ish tone
opts = [e.identifier for e in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
sc.view_settings.view_transform = 'AgX' if 'AgX' in opts else 'Filmic'
sc.view_settings.look = 'None'

cam = bpy.data.objects.get('Product camera')
if cam:
    sc.camera = cam

tag = sys.argv[sys.argv.index('--tag')+1] if '--tag' in sys.argv else 'beauty'
sc.render.filepath = os.path.join(OUT, f'photo_{tag}.png')
bpy.ops.render.render(write_still=True)
print('SAVED', sc.render.filepath)
