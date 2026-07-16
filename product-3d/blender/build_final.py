#!/usr/bin/env python3
"""
Phase 2 + 3 for the mioren brusher.

Reuses the dimensionally-validated geometry builders from gen_product.py,
then adds:
  - a procedural polished-serpentine stone material (opaque, subtle veins,
    speckle, independent colour / roughness / bump masks)
  - a dense synthetic fibre brush built from alpha hair cards
  - a gold "mioren" surface decal
  - Cycles close-up validation renders  (--phase 2)
  - bake procedural maps + export optimised GLB  (--phase 3)

Run:  python3 build_final.py --phase 2
      python3 build_final.py --phase 3
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_product as G          # noqa: E402

CM = G.CM
TEX = os.path.normpath(os.path.join(HERE, "..", "textures"))
RENDER = os.path.normpath(os.path.join(HERE, "..", "renders"))
WEB = os.path.normpath(os.path.join(HERE, "..", "web"))
for d in (TEX, RENDER, WEB):
    os.makedirs(d, exist_ok=True)


# ---------------------------------------------------------------------------
# Serpentine stone material — procedural, opaque, independent masks
# ---------------------------------------------------------------------------
def stone_material():
    mat = bpy.data.materials.new("serpentine")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    n = nt.nodes
    L = nt.links

    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    out.location = (900, 0)
    bsdf.location = (560, 0)
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    texco = n.new("ShaderNodeTexCoord")
    texco.location = (-1300, 0)

    # ---- base green + large tonal blotching (mask A) ----
    nA = n.new("ShaderNodeTexNoise")          # big soft clouds
    nA.location = (-1050, 300)
    nA.inputs["Scale"].default_value = 3.2
    nA.inputs["Detail"].default_value = 4.0
    nA.inputs["Roughness"].default_value = 0.6
    L.new(texco.outputs["Object"], nA.inputs["Vector"])

    rampA = n.new("ShaderNodeValToRGB")
    rampA.location = (-780, 300)
    rampA.color_ramp.elements[0].position = 0.30
    rampA.color_ramp.elements[0].color = (0.020, 0.032, 0.024, 1)   # near-black green
    rampA.color_ramp.elements[1].position = 0.78
    rampA.color_ramp.elements[1].color = (0.070, 0.098, 0.072, 1)   # dark sage
    L.new(nA.outputs["Fac"], rampA.inputs["Fac"])

    # ---- fine irregular veins (mask B) — different pattern ----
    nB = n.new("ShaderNodeTexNoise")
    nB.location = (-1050, -20)
    nB.inputs["Scale"].default_value = 8.5
    nB.inputs["Detail"].default_value = 8.0
    nB.inputs["Roughness"].default_value = 0.75
    if "Distortion" in nB.inputs:
        nB.inputs["Distortion"].default_value = 1.4
    L.new(texco.outputs["Object"], nB.inputs["Vector"])

    veinRamp = n.new("ShaderNodeValToRGB")
    veinRamp.location = (-780, -20)
    # thin band -> vein only where noise crosses a narrow range
    veinRamp.color_ramp.interpolation = 'B_SPLINE'
    e = veinRamp.color_ramp.elements
    e[0].position = 0.40
    e[0].color = (0, 0, 0, 1)
    e[1].position = 0.50
    e[1].color = (1, 1, 1, 1)
    veinRamp.color_ramp.elements.new(0.60)
    veinRamp.color_ramp.elements[2].color = (0, 0, 0, 1)
    L.new(nB.outputs["Fac"], veinRamp.inputs["Fac"])

    veinColor = n.new("ShaderNodeMixRGB")
    veinColor.location = (-500, 150)
    veinColor.blend_type = 'MIX'
    veinColor.inputs["Fac"].default_value = 0.5
    veinColor.inputs["Color2"].default_value = (0.12, 0.15, 0.11, 1)  # low-contrast vein
    L.new(rampA.outputs["Color"], veinColor.inputs["Color1"])
    veinStrength = n.new("ShaderNodeMath")
    veinStrength.location = (-640, 60)
    veinStrength.operation = 'MULTIPLY'
    veinStrength.inputs[1].default_value = 0.45      # keep veins subtle
    L.new(veinRamp.outputs["Color"], veinStrength.inputs[0])
    L.new(veinStrength.outputs["Value"], veinColor.inputs["Fac"])

    # ---- mineral speckle (mask C) — voronoi, darkens tiny spots ----
    nC = n.new("ShaderNodeTexVoronoi")
    nC.location = (-1050, -340)
    nC.inputs["Scale"].default_value = 60.0
    L.new(texco.outputs["Object"], nC.inputs["Vector"])
    speckRamp = n.new("ShaderNodeValToRGB")
    speckRamp.location = (-780, -340)
    speckRamp.color_ramp.elements[0].position = 0.0
    speckRamp.color_ramp.elements[0].color = (0, 0, 0, 1)
    speckRamp.color_ramp.elements[1].position = 0.08
    speckRamp.color_ramp.elements[1].color = (1, 1, 1, 1)
    L.new(nC.outputs["Distance"], speckRamp.inputs["Fac"])

    # speckle darkens tiny mineral spots (multiply toward a darker shade)
    speckMix = n.new("ShaderNodeMixRGB")
    speckMix.location = (-250, 100)
    speckMix.blend_type = 'MIX'
    speckMix.inputs["Fac"].default_value = 0.18
    speckMix.inputs["Color2"].default_value = (0.015, 0.022, 0.016, 1)
    L.new(veinColor.outputs["Color"], speckMix.inputs["Color1"])
    # invert so the small voronoi cores (not the gaps) become the spots
    speckInv = n.new("ShaderNodeInvert")
    speckInv.location = (-500, -340)
    L.new(speckRamp.outputs["Color"], speckInv.inputs["Color"])
    L.new(speckInv.outputs["Color"], speckMix.inputs["Fac"])
    L.new(speckMix.outputs["Color"], bsdf.inputs["Base Color"])

    # ---- roughness variation (mask D) — its own pattern ----
    nD = n.new("ShaderNodeTexNoise")
    nD.location = (-1050, -640)
    nD.inputs["Scale"].default_value = 14.0
    nD.inputs["Detail"].default_value = 3.0
    L.new(texco.outputs["Object"], nD.inputs["Vector"])
    roughRamp = n.new("ShaderNodeMapRange")
    roughRamp.location = (-500, -560)
    roughRamp.inputs["To Min"].default_value = 0.28
    roughRamp.inputs["To Max"].default_value = 0.42
    L.new(nD.outputs["Fac"], roughRamp.inputs["Value"])
    L.new(roughRamp.outputs["Result"], bsdf.inputs["Roughness"])

    # ---- subtle bump (mask E) — combine two scales ----
    nE = n.new("ShaderNodeTexNoise")
    nE.location = (-1050, -940)
    nE.inputs["Scale"].default_value = 22.0
    nE.inputs["Detail"].default_value = 6.0
    L.new(texco.outputs["Object"], nE.inputs["Vector"])
    bump = n.new("ShaderNodeBump")
    bump.location = (250, -400)
    bump.inputs["Strength"].default_value = 0.06
    bump.inputs["Distance"].default_value = 0.002
    L.new(nE.outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    bsdf.inputs["Metallic"].default_value = 0.0
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.5
    return mat


def gold_logo_material():
    mat = bpy.data.materials.new("logo_gold")
    mat.use_nodes = True
    mat.blend_method = 'CLIP' if hasattr(mat, 'blend_method') else mat.blend_method
    nt = mat.node_tree
    n = nt.nodes
    L = nt.links
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    trans = n.new("ShaderNodeBsdfTransparent")
    mix = n.new("ShaderNodeMixShader")
    img = n.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(TEX, "logo_mioren.png"))
    img.image.colorspace_settings.name = 'sRGB'
    out.location = (600, 0)
    mix.location = (400, 0)
    bsdf.location = (150, -150)
    trans.location = (150, 120)
    img.location = (-250, 0)
    bsdf.inputs["Base Color"].default_value = (0.79, 0.62, 0.29, 1)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.35
    L.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(img.outputs["Alpha"], mix.inputs["Fac"])
    L.new(trans.outputs["BSDF"], mix.inputs[1])
    L.new(bsdf.outputs["BSDF"], mix.inputs[2])
    L.new(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def fiber_material():
    mat = bpy.data.materials.new("fibers")
    mat.use_nodes = True
    nt = mat.node_tree
    n = nt.nodes
    L = nt.links
    n.clear()
    out = n.new("ShaderNodeOutputMaterial")
    bsdf = n.new("ShaderNodeBsdfPrincipled")
    img = n.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.join(TEX, "hair_card.png"))
    img.image.colorspace_settings.name = 'sRGB'
    out.location = (500, 0)
    bsdf.location = (200, 0)
    img.location = (-200, 0)
    L.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.4
    if hasattr(mat, "blend_method"):
        mat.blend_method = 'CLIP'
        mat.alpha_threshold = 0.5
    if hasattr(mat, "show_transparent_back"):
        mat.show_transparent_back = True
    mat.use_backface_culling = False
    return mat


# ---------------------------------------------------------------------------
# Fibre brush from alpha hair cards
# ---------------------------------------------------------------------------
def build_fibers():
    x0, x1 = -3.35, 3.05
    ncol = 46
    depth_rows = 4
    height = 2.0                   # cm
    verts, faces, uvs = [], [], []
    rnd = __import__("random").Random(11)

    def scallop(fx):
        return 0.16 * abs(math.sin(fx * math.pi * 9.0))

    for ci in range(ncol):
        fx = ci / (ncol - 1)
        x = x0 + (x1 - x0) * fx
        root_z = G.bottom_edge_z(x) + 0.35        # seated inside the stone
        cut = height - scallop(fx)                # segmented lower edge
        for di in range(depth_rows):
            fy = (di + 0.5) / depth_rows
            y = (fy - 0.5) * 2.0 * 0.85            # spread across ~1.7 cm depth
            for rot_i in range(3):                 # crossed cards for volume
                ang = rot_i * math.pi / 3 + rnd.uniform(-0.15, 0.15)
                cw = 0.42                          # card width (cm)
                lean_x = rnd.uniform(-0.18, 0.18)
                lean_y = rnd.uniform(-0.12, 0.12)
                jz = rnd.uniform(-0.05, 0.05)
                L_here = cut + rnd.uniform(-0.12, 0.06)
                base = len(verts)
                segs = 5
                for s in range(segs + 1):
                    t = s / segs
                    # slight forward/back bend + taper
                    zz = root_z - t * L_here + jz
                    bend = (t * t) * 0.18
                    hw = (cw / 2) * (1.0 - 0.35 * t)
                    dx = math.cos(ang) * hw
                    dy = math.sin(ang) * hw
                    ox = x + lean_x * t
                    oy = y + lean_y * t + bend
                    verts.append((( ox - dx) * CM, (oy - dy) * CM, zz * CM))
                    verts.append((( ox + dx) * CM, (oy + dy) * CM, zz * CM))
                    uvs.append((0.0, t)); uvs.append((1.0, t))
                for s in range(segs):
                    a = base + s * 2
                    faces.append((a, a + 1, a + 3, a + 2))

    me = bpy.data.meshes.new("fibers")
    me.from_pydata(verts, [], faces)
    me.update()
    # UVs
    uvl = me.uv_layers.new(name="UVMap")
    li = 0
    for poly in me.polygons:
        for vi in poly.vertices:
            uvl.data[li].uv = uvs[vi]
            li += 1
    ob = bpy.data.objects.new("fibers", me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(fiber_material())
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def build_logo_decal(stone):
    """Small conformed plane carrying the gold wordmark, on the front face,
    below the groove — matching the reference position."""
    w, h = 3.4, 1.7                   # cm  (logo footprint)
    cx, cz = -0.2, 2.35               # cm  centre on the body
    me = bpy.data.meshes.new("logo")
    verts = [((cx - w/2) * CM, 0, (cz - h/2) * CM),
             ((cx + w/2) * CM, 0, (cz - h/2) * CM),
             ((cx + w/2) * CM, 0, (cz + h/2) * CM),
             ((cx - w/2) * CM, 0, (cz + h/2) * CM)]
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    uvl = me.uv_layers.new(name="UVMap")
    for i, uv in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uvl.data[i].uv = uv
    ob = bpy.data.objects.new("logo", me)
    bpy.context.collection.objects.link(ob)
    # subdivide then shrinkwrap onto the stone front, tiny offset out
    bpy.context.view_layer.objects.active = ob
    sub = ob.modifiers.new("sub", 'SUBSURF'); sub.subdivision_type = 'SIMPLE'
    sub.levels = sub.render_levels = 4
    sw = ob.modifiers.new("sw", 'SHRINKWRAP')
    sw.target = stone
    sw.wrap_method = 'PROJECT'
    sw.use_project_z = True
    sw.use_negative_direction = True
    sw.use_positive_direction = True
    sw.project_limit = 0.1
    sw.offset = 0.02 * CM
    bpy.ops.object.modifier_apply(modifier="sub")
    bpy.ops.object.modifier_apply(modifier="sw")
    ob.data.materials.append(gold_logo_material())
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def assemble():
    G.reset_scene()
    stone = G.build_stone()
    stone.data.materials.clear()
    stone.data.materials.append(stone_material())
    fibers = build_fibers()
    logo = build_logo_decal(stone)
    return stone, fibers, logo


def _area(name, energy, size, loc, rot):
    lt = bpy.data.lights.new(name, 'AREA')
    lt.energy = energy
    lt.size = size
    ob = bpy.data.objects.new(name, lt)
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.collection.objects.link(ob)
    return ob


def studio(floor=True):
    sc = bpy.context.scene
    # soft even studio world (values proven by the exposure probe) ...
    world = bpy.data.worlds.new("studio")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.58, 0.60, 0.59, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    # ... a key SUN for crisp form (sun energy is scene-scale independent)
    key = bpy.data.objects.new("key", bpy.data.lights.new("key", 'SUN'))
    key.data.energy = 3.0
    key.data.angle = math.radians(6)
    key.rotation_euler = (math.radians(52), 0, math.radians(24))
    bpy.context.collection.objects.link(key)
    _area("fill", 12, 0.8, (-0.34, -0.26, 0.16),
          (math.radians(66), 0, math.radians(-46)))
    _area("rim",  22, 0.35, (0.10, 0.36, 0.34),
          (math.radians(-118), 0, math.radians(10)))
    # front fill aimed straight at the fibre bundle so the roots read
    _area("fiberfill", 16, 0.5, (0.0, -0.34, -0.10),
          (math.radians(86), 0, 0))
    if floor:
        bpy.ops.mesh.primitive_plane_add(size=1.2, location=(0, 0.15, -0.0205))
        fl = bpy.context.active_object
        fl.name = "floor"
        m = bpy.data.materials.new("floor")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.82, 0.82, 0.82, 1)
        b.inputs["Roughness"].default_value = 0.6
        fl.data.materials.append(m)


def cycles(res=1200, samples=160):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = sc.render.resolution_y = res
    opts = [e.identifier for e in
            sc.view_settings.bl_rna.properties['view_transform'].enum_items]
    sc.view_settings.view_transform = 'Filmic' if 'Filmic' in opts else 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.0
    return sc


def cam_persp(name, dist, az, el, center_z=0.028, focal=95):
    c = Vector((0, 0, center_z))
    loc = (c.x + dist*math.cos(el)*math.sin(az),
           c.y - dist*math.cos(el)*math.cos(az),
           c.z + dist*math.sin(el))
    rot = (math.radians(90) - el, 0, az)
    return G.add_camera(name, loc, rot, focal=focal)


def phase2():
    assemble()
    studio()
    sc = cycles(1200, 170)
    shots = {
        "hero":      (0.40, math.radians(-32), math.radians(16)),
        "stone_cu":  (0.20, math.radians(-10), math.radians(6)),
        "fiber_cu":  (0.16, math.radians(-18), math.radians(-24)),
        "logo_cu":   (0.14, math.radians(-4),  math.radians(2)),
    }
    for name, (d, az, el) in shots.items():
        cam = cam_persp("cam_" + name, d, az, el)
        sc.camera = cam
        sc.render.filepath = os.path.join(RENDER, f"final_{name}.png")
        bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(
        filepath=os.path.join(HERE, "mioren_brusher.blend"))
    print("PHASE 2 COMPLETE")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int, default=2)
    args, _ = ap.parse_known_args()
    if args.phase == 2:
        phase2()
