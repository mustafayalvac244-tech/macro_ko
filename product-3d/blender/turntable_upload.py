#!/usr/bin/env python3
"""360 turntable of an uploaded .blend (adds studio camera + lights if the
file has none). Frames -> renders/turn_up/f####.png"""
import os, sys, math
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "renders", "turn_up"))
os.makedirs(OUT, exist_ok=True)

BLEND = sys.argv[sys.argv.index('--blend')+1] if '--blend' in sys.argv else os.path.join(HERE, 'upload_web.blend')
N = int(sys.argv[sys.argv.index('--frames')+1]) if '--frames' in sys.argv else 36
RES = int(sys.argv[sys.argv.index('--res')+1]) if '--res' in sys.argv else 800
SAMPLES = int(sys.argv[sys.argv.index('--samples')+1]) if '--samples' in sys.argv else 24

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
try:
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
sc.render.resolution_x = sc.render.resolution_y = RES
opts = [e.identifier for e in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
sc.view_settings.view_transform = 'AgX' if 'AgX' in opts else 'Filmic'

# --- bounds of the product meshes ---
c = Vector((0, 0, 0)); mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3); nn = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and 'floor' not in o.name.lower():
        for v in o.bound_box:
            w = o.matrix_world @ Vector(v)
            c += w; nn += 1
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
c /= nn
radius = (mx - mn).length / 2
print('center', c, 'radius', radius)

# --- world + 3-point lights (only if the scene lacks lights) ---
has_light = any(o.type == 'LIGHT' for o in bpy.data.objects)
if not sc.world:
    sc.world = bpy.data.worlds.new('w')
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes.get('Background')
if bg:
    bg.inputs[0].default_value = (0.5, 0.52, 0.5, 1); bg.inputs[1].default_value = 0.8
def area(name, e, size, loc, rot):
    lt = bpy.data.lights.new(name, 'AREA'); lt.energy = e; lt.size = size
    ob = bpy.data.objects.new(name, lt); ob.location = loc; ob.rotation_euler = rot
    bpy.context.collection.objects.link(ob)
if not has_light:
    d = radius
    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))
    key.data.energy = 3.0; key.data.angle = math.radians(6)
    key.rotation_euler = (math.radians(52), 0, math.radians(24))
    bpy.context.collection.objects.link(key)
    area('fill', 40, d*1.2, (c.x - d*1.6, c.y - d*1.4, c.z + d*0.6), (math.radians(66), 0, math.radians(-46)))
    area('rim', 60, d*0.9, (c.x + d*0.4, c.y + d*1.6, c.z + d*1.2), (math.radians(-118), 0, math.radians(10)))

# --- ground plane for a soft contact shadow ---
bpy.ops.mesh.primitive_plane_add(size=radius*20, location=(c.x, c.y, mn.z))
fl = bpy.context.active_object; m = bpy.data.materials.new('floor'); m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.82,0.82,0.82,1)
m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.6
fl.data.materials.append(m)

# --- camera ---
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 85
cam_data.sensor_width = 36.0
cam = bpy.data.objects.new('cam', cam_data); bpy.context.collection.objects.link(cam)
sc.camera = cam
fov = 2 * math.atan(cam_data.sensor_width / (2 * cam_data.lens))
dist = radius / math.sin(fov / 2) * 1.06        # fit the whole product
elev0 = math.radians(14)

for i in range(N):
    ang = (i / N) * 2 * math.pi
    el = elev0 + math.radians(5) * math.sin(i / N * math.pi * 2)
    cam.location = (c.x + dist*math.cos(el)*math.sin(ang),
                    c.y - dist*math.cos(el)*math.cos(ang),
                    c.z + dist*math.sin(el))
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'f{i:04d}.png')
    bpy.ops.render.render(write_still=True)
    if i % 6 == 0: print('frame', i)
print('TURNTABLE DONE', OUT)
