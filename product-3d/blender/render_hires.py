#!/usr/bin/env python3
"""High-resolution 'ultra detail' Cycles hero render: the photo-matched
blotchy serpentine (4K maps) + polished coat + the dense copper fibre
bundle, under the master blend's studio lighting.

  python3 render_hires.py --res 3840 --samples 90 --tag ultra
"""
import os, sys, math
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_glb as X
TEX = os.path.normpath(os.path.join(HERE, "..", "textures"))
OUT = os.path.normpath(os.path.join(HERE, "..", "renders"))
SRC = os.path.join(HERE, "reference_upload.blend")

def arg(name, d):
    return sys.argv[sys.argv.index(name)+1] if name in sys.argv else d

RES = int(arg('--res', 3840))
SAMPLES = int(arg('--samples', 90))
TAG = arg('--tag', 'ultra')
VIEW = arg('--view', 'hero')     # hero | front

bpy.ops.wm.open_mainfile(filepath=SRC)
STONE = 'Single-piece variable-thickness serpentine body'
FIBER = 'Dense fine fiber bundle'

# ---- stone: fresh UV + photo-matched 4K serpentine + polished coat ----
stone = bpy.data.objects[STONE]
for o in bpy.data.objects: o.select_set(False)
stone.select_set(True); bpy.context.view_layer.objects.active = stone
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')

mat = bpy.data.materials.new('serpentine_hi'); mat.use_nodes = True
nt = mat.node_tree; nt.nodes.clear(); L = nt.links
out = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
L.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
def img(fn, cs, x, y):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(os.path.join(TEX, fn))
    n.image.colorspace_settings.name = cs; n.location = (x, y); return n
ic = img('stone_albedo_4k.png', 'sRGB', -700, 300)
L.new(ic.outputs['Color'], bsdf.inputs['Base Color'])
ir = img('stone_roughness_4k.png', 'Non-Color', -700, 0)
# lift roughness to a satin polish so the surface reflects less of the
# bright studio and the black-blotch albedo stays dominant/visible
radd = nt.nodes.new('ShaderNodeMath'); radd.operation = 'ADD'
radd.inputs[1].default_value = 0.24; radd.location = (-380, 0)
L.new(ir.outputs['Color'], radd.inputs[0])
L.new(radd.outputs['Value'], bsdf.inputs['Roughness'])
inn = img('stone_normal_4k.png', 'Non-Color', -700, -300)
nmn = nt.nodes.new('ShaderNodeNormalMap'); nmn.inputs['Strength'].default_value = 0.5
L.new(inn.outputs['Color'], nmn.inputs['Color']); L.new(nmn.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Metallic'].default_value = 0.0
# no clearcoat — it mirrors the studio and hides the pattern
if 'Coat Weight' in bsdf.inputs: bsdf.inputs['Coat Weight'].default_value = 0.0
stone.data.materials.clear(); stone.data.materials.append(mat)

# ---- fibres: keep dense, thicken as in the web export ----
cur = bpy.data.objects.get(FIBER)
if cur and cur.type == 'CURVE':
    cur.data.bevel_depth = X.FIBER_RADIUS

# ---- brighter, flatter studio lighting so the stone PATTERN reads ----
sc0 = bpy.context.scene
if sc0.world and sc0.world.use_nodes:
    bg = sc0.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs[0].default_value = (0.50, 0.52, 0.50, 1)
        bg.inputs[1].default_value = 0.7
# big soft front fill aimed at the product
_c = Vector((0, 0, 0)); _n = 0
for _o in bpy.data.objects:
    if _o.type == 'MESH' and _o.name != 'Studio floor':
        for _v in _o.bound_box: _c += _o.matrix_world @ Vector(_v); _n += 1
_c /= _n
_lt = bpy.data.lights.new('front_fill', 'AREA'); _lt.energy = 28; _lt.size = 1.1
_lo = bpy.data.objects.new('front_fill', _lt)
_lo.location = (_c.x, _c.y - 0.45, _c.z + 0.10)
_lo.rotation_euler = (math.radians(90), 0, 0)
bpy.context.collection.objects.link(_lo)

# ---- render settings ----
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
try:
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
except Exception: pass
sc.cycles.max_bounces = 8
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.compression = 20
opts = [e.identifier for e in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
sc.view_settings.view_transform = 'AgX' if 'AgX' in opts else 'Filmic'
sc.view_settings.exposure = -0.1

cam = bpy.data.objects.get('Product camera')
if VIEW == 'front':
    # centre of stone+fibres
    c = Vector((0, 0, 0)); nn = 0
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name != 'Studio floor':
            for v in o.bound_box: c += o.matrix_world @ Vector(v); nn += 1
    c /= nn
    off = cam.location - c; dist = off.length
    cam.location = (c.x, c.y - dist, c.z + dist*0.10)
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam

sc.render.filepath = os.path.join(OUT, f'ultra_{TAG}.png')
bpy.ops.render.render(write_still=True)
print('SAVED', sc.render.filepath, RES, 'px', SAMPLES, 'spp')
