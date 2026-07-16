#!/usr/bin/env python3
"""
mioren 2-in-1 Contour Brusher — Blender generation script.

Phase 1: dimensionally accurate clay geometry + orthographic validation
renders. Run with the `bpy` Python module (or inside Blender):

    python3 gen_product.py --phase 1

Real-world dimensions (from the measured product photos):
  - stone body width (front view):            8.0 cm
  - stone body height (front view):           7.0 cm
  - upper raised section, left edge -> notch: 5.0 cm
  - brush fibre height below the stone:       2.0 cm
  - main body thickness (side view):          2.5 cm
  - upper projection thickness (side view):   1.0 cm
  - brush section thickness (side view):      2.0 cm

Orientation: matches the measured reference photo — brush fibres hang
below the stone (-Z), front face toward -Y, X to the right.
Units: metres internally (1 cm = 0.01 m); scene displays centimetres.
"""

import argparse
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

CM = 0.01
HERE = os.path.dirname(os.path.abspath(__file__))
RENDER_DIR = os.path.normpath(os.path.join(HERE, "..", "renders"))
os.makedirs(RENDER_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# Front silhouette (cm), traced from the measured reference photo.
# Closed Catmull-Rom loop, counter-clockwise, starting bottom-left.
# X: right, Z: up. Brush hangs below Z=0..0.2 region.
# ----------------------------------------------------------------------------
SILHOUETTE = [
    (-3.85, 1.05),   # bottom-left end of the stone
    (-2.60, 0.42),
    (-0.80, 0.02),   # lowest point of the bottom edge
    ( 1.00, 0.12),
    ( 2.60, 0.55),
    ( 3.55, 0.95),   # bottom-right end
    ( 4.05, 1.70),   # lower-right extension, outer edge   -> right extreme
    ( 3.95, 2.55),
    ( 3.75, 3.20),
    ( 3.25, 3.95),   # right knob, outer shoulder
    ( 2.55, 4.30),   # right knob, top
    ( 2.00, 4.10),   # knob left side, descending into the notch
    ( 1.48, 3.60),   # notch bottom (deep U)
    ( 0.97, 4.52),   # notch left wall (concave) — 5cm datum point
    ( 0.62, 5.00),   # fin right edge, slightly concave
    ( 0.42, 5.90),
    ( 0.28, 6.55),   # fin top right shoulder
    (-0.35, 7.02),   # fin rounded top, curled to the right -> top extreme
    (-1.05, 6.75),
    (-1.75, 6.10),   # fin left edge: long continuous sweep
    (-2.40, 5.20),
    (-3.00, 4.15),
    (-3.55, 3.10),   # body left edge — one continuous convex curve
    (-3.95, 2.10),   # left extreme
]

# thickness profile: smooth continuous wedge — 2.5 cm body tapering to
# the 1.0 cm upper projection (checked at z=1.5 and z=6.0)
def thickness_cm(z_cm):
    t_body, t_fin = 2.5, 1.0
    z0, z1 = 1.8, 5.8
    if z_cm <= z0:
        return t_body
    if z_cm >= z1:
        return t_fin
    u = (z_cm - z0) / (z1 - z0)
    u = u * u * (3 - 2 * u)          # smoothstep
    return t_body + (t_fin - t_body) * u


# backward sweep of the upper projection (side-view S curve, cm)
def bend_cm(z_cm):
    z0, z1 = 3.2, 7.0
    if z_cm <= z0:
        return 0.0
    u = min(1.0, (z_cm - z0) / (z1 - z0))
    u = u * u * (3 - 2 * u)
    return 0.55 * u


def catmull_closed(points, samples_per_seg=14):
    """Sample a closed Catmull-Rom spline through `points`."""
    n = len(points)
    out = []
    for i in range(n):
        p0 = Vector(points[(i - 1) % n])
        p1 = Vector(points[i])
        p2 = Vector(points[(i + 1) % n])
        p3 = Vector(points[(i + 2) % n])
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return out


def catmull_open(points, samples_per_seg=12):
    n = len(points)
    out = []
    for i in range(n - 1):
        p0 = Vector(points[max(i - 1, 0)])
        p1 = Vector(points[i])
        p2 = Vector(points[i + 1])
        p3 = Vector(points[min(i + 2, n - 1)])
        for s in range(samples_per_seg):
            t = s / samples_per_seg
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(Vector(points[-1]))
    return out


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.length_unit = 'CENTIMETERS'
    return sc


def mesh_from_outline(name, outline_cm, thickness_fn, bevel_cm=0.24):
    """Filled front profile, solidified along Y with a per-vertex
    thickness profile, rim beveled. Returns the object."""
    pts = [(p.x * CM, p.y * CM) for p in outline_cm]

    # triangulated fill (handles the concave notch correctly)
    polys = [[Vector((x, y, 0)) for x, y in pts]]
    tris = tessellate_polygon([[Vector((x, y)) for x, y in pts]])

    me = bpy.data.meshes.new(name)
    verts3 = [(x, 0.0, y) for x, y in pts]
    me.from_pydata(verts3, [], [list(t) for t in tris])
    me.update()

    # densify the sheet so grooves/doming can be carved by displacement
    bm = bmesh.new()
    bm.from_mesh(me)
    for _ in range(6):
        long_edges = [e for e in bm.edges if e.calc_length() > 0.0022]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1)
        bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()

    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)

    # vertex group encoding thickness / max_thickness
    t_max = 2.5
    vg = ob.vertex_groups.new(name="thickness")
    for i, v in enumerate(me.vertices):
        w = thickness_fn(v.co.z / CM) / t_max
        vg.add([i], w, 'REPLACE')

    solid = ob.modifiers.new("solidify", 'SOLIDIFY')
    solid.thickness = t_max * CM
    solid.offset = 0.0
    solid.use_even_offset = True
    solid.vertex_group = "thickness"
    solid.thickness_vertex_group = 0.0   # weight 0 -> zero thickness

    bev = ob.modifiers.new("bevel", 'BEVEL')
    bev.width = bevel_cm * CM
    bev.segments = 4
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(35)

    bpy.context.view_layer.objects.active = ob
    for m in ("solidify", "bevel"):
        bpy.ops.object.modifier_apply(modifier=m)

    for p in ob.data.polygons:
        p.use_smooth = True
    if hasattr(ob.data, "use_auto_smooth"):
        ob.data.use_auto_smooth = True
        ob.data.auto_smooth_angle = math.radians(45)
    else:
        with bpy.context.temp_override(object=ob, active_object=ob,
                                       selected_editable_objects=[ob]):
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(45))
    return ob


def bottom_edge_z(x_cm):
    """Z (cm) of the stone's bottom edge at X (cm) — sampled silhouette."""
    seg = [p for p in catmull_closed(SILHOUETTE, 10) if p.y < 1.6]
    best, bz = None, 0.0
    for p in seg:
        d = abs(p.x - x_cm)
        if best is None or d < best:
            best, bz = d, p.y
    return bz


def offset_inward(path, dist_cm):
    """Offset an open 2D path inward (to its left side) by dist."""
    out = []
    n = len(path)
    for i, p in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, n - 1)]
        d = (b - a)
        if d.length < 1e-9:
            d = Vector((1, 0))
        d.normalize()
        nrm = Vector((d.y, -d.x))          # inward normal for a CCW rim path
        out.append(p + nrm * dist_cm)
    return out


def make_groove_tube(name, path_cm, y_m, radius_m):
    """Circle swept along `path_cm` (XZ plane) at constant Y."""
    ring = 10
    verts, faces = [], []
    for i, p in enumerate(path_cm):
        # local frame in XZ
        a = path_cm[max(i - 1, 0)]
        b = path_cm[min(i + 1, len(path_cm) - 1)]
        t = (b - a)
        t = Vector((t.x, 0, t.y))
        if t.length < 1e-9:
            t = Vector((1, 0, 0))
        t.normalize()
        n1 = Vector((0, 1, 0))
        n2 = t.cross(n1)
        c = Vector((p.x * CM, y_m, p.y * CM))
        for k in range(ring):
            ang = 2 * math.pi * k / ring
            verts.append(c + (n1 * math.cos(ang) + n2 * math.sin(ang)) * radius_m)
    for i in range(len(path_cm) - 1):
        for k in range(ring):
            k2 = (k + 1) % ring
            a = i * ring + k
            b = i * ring + k2
            faces.append([a, b, b + ring, a + ring])
    # end caps -> closed manifold volume for the EXACT boolean solver
    n_last = (len(path_cm) - 1) * ring
    faces.append(list(range(ring - 1, -1, -1)))
    faces.append(list(range(n_last, n_last + ring)))

    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)

    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    return ob


def smooth_path(path, passes=3):
    pts = list(path)
    for _ in range(passes):
        pts = [pts[0]] + [ (pts[i-1] + pts[i]*2 + pts[i+1]) * 0.25
                           for i in range(1, len(pts)-1) ] + [pts[-1]]
    return pts


def apply_bend(ob):
    """Backward sweep of the fin (side-view S curve)."""
    for v in ob.data.vertices:
        v.co.y += bend_cm(v.co.z / CM) * CM
    ob.data.update()


def build_stone():
    outline = catmull_closed(SILHOUETTE, 14)
    stone = mesh_from_outline("stone", outline, thickness_cm)

    # ---- carved groove: bottom arc continuing up the fin's left edge ----
    # silhouette portion: from bottom-right end, along the bottom, around
    # the left cap and up the fin's left edge (CCW order of SILHOUETTE).
    part = SILHOUETTE[0:6]                      # bottom edge
    lead = SILHOUETTE[-3:]                      # left cap into fin left edge
    grove_ctrl = [lead[-1]] if False else None
    path_pts = [( 3.55, 0.95), ( 2.60, 0.55), ( 1.00, 0.12), (-0.80, 0.02),
                (-2.60, 0.42), (-3.85, 1.05), (-3.95, 2.30), (-3.45, 3.30),
                (-2.95, 4.40), (-2.35, 5.45), (-1.60, 6.35)]
    path = catmull_open([Vector(p) for p in path_pts], 12)
    inner = smooth_path(offset_inward(path, 0.85), 4)   # 8.5 mm in from the edge

    apply_bend(stone)                            # fin sweeps backward

    carve_groove(stone, inner, depth_cm=0.085, sigma_cm=0.13)
    return stone


def carve_groove(ob, path_cm, depth_cm, sigma_cm):
    """Displace face vertices near `path_cm` inward along Y — a shallow
    integrated channel on both faces (no booleans: robust and smooth)."""
    import numpy as np
    px = np.array([p.x for p in path_cm])
    pz = np.array([p.y for p in path_cm])
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(n, 3)
    x_cm = co[:, 0] / CM
    y_cm = co[:, 1] / CM
    z_cm = co[:, 2] / CM

    # distance (cm) from each vertex to the groove polyline, in XZ
    d = np.full(n, 1e9)
    for i in range(len(px)):
        d = np.minimum(d, np.hypot(x_cm - px[i], z_cm - pz[i]))

    # only vertices lying on the front/back faces (not the rim)
    t_half = np.array([thickness_cm(z) / 2 for z in z_cm])
    bend = np.array([bend_cm(z) for z in z_cm])
    y_local = y_cm - bend
    on_face = np.abs(np.abs(y_local) - t_half) < 0.10   # within 1 mm of face
    fall = np.exp(-(d / sigma_cm) ** 2)
    disp = depth_cm * fall * on_face * np.sign(y_local)
    co[:, 1] -= disp * CM
    me.vertices.foreach_set("co", co.reshape(-1))
    me.update()


def build_brush_clay():
    """Phase-1 simplified brush: curved slab, 2 cm tall, 2 cm thick,
    scalloped bottom edge matching the segmented cut in the photo."""
    x0, x1 = -3.35, 3.05
    n = 120
    top, bot = [], []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        zt = bottom_edge_z(x) + 0.55            # seated inside the stone
        scal = 0.16 * abs(math.sin((i / n) * math.pi * 9.0))
        zb = bottom_edge_z(x) - 2.0 + scal
        top.append(Vector((x, zt)))
        bot.append(Vector((x, zb)))
    outline = top + bot[::-1]
    ob = mesh_from_outline("brush_clay", outline, lambda z: 2.0, bevel_cm=0.30)
    return ob


def clay_material(ob, gray=0.55):
    mat = bpy.data.materials.new("clay")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (gray, gray, gray, 1)
    bsdf.inputs["Roughness"].default_value = 0.65
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def setup_world_and_lights():
    sc = bpy.context.scene
    world = bpy.data.worlds.new("studio")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.72, 0.72, 0.72, 1)
    bg.inputs[1].default_value = 0.55

    key = bpy.data.objects.new("key", bpy.data.lights.new("key", 'AREA'))
    key.data.energy = 18
    key.data.size = 0.5
    key.location = (0.18, -0.30, 0.35)
    key.rotation_euler = (math.radians(50), 0, math.radians(28))
    bpy.context.collection.objects.link(key)

    fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", 'AREA'))
    fill.data.energy = 6
    fill.data.size = 0.6
    fill.location = (-0.30, -0.25, 0.15)
    fill.rotation_euler = (math.radians(65), 0, math.radians(-45))
    bpy.context.collection.objects.link(fill)


def add_camera(name, loc, rot, ortho_scale=None, focal=85):
    cam = bpy.data.cameras.new(name)
    if ortho_scale:
        cam.type = 'ORTHO'
        cam.ortho_scale = ortho_scale
    else:
        cam.lens = focal
    ob = bpy.data.objects.new(name, cam)
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.collection.objects.link(ob)
    return ob


def render_views(prefix, center_z=0.028, span=0.125):
    """Six orthographic views + one 3/4 perspective."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 96
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = sc.render.resolution_y = 1100
    sc.render.film_transparent = False

    c = Vector((0.0, 0.0, center_z))
    D = 0.8
    views = {
        "front":  ((c.x, c.y - D, c.z), (math.radians(90), 0, 0)),
        "back":   ((c.x, c.y + D, c.z), (math.radians(90), 0, math.radians(180))),
        "left":   ((c.x - D, c.y, c.z), (math.radians(90), 0, math.radians(-90))),
        "right":  ((c.x + D, c.y, c.z), (math.radians(90), 0, math.radians(90))),
        "top":    ((c.x, c.y, c.z + D), (0, 0, 0)),
        "bottom": ((c.x, c.y, c.z - D), (math.radians(180), 0, 0)),
    }
    for name, (loc, rot) in views.items():
        cam = add_camera("cam_" + name, loc, rot, ortho_scale=span)
        sc.camera = cam
        sc.render.filepath = os.path.join(RENDER_DIR, f"{prefix}_{name}.png")
        bpy.ops.render.render(write_still=True)

    # three-quarter perspective, ~85 mm product-photography look
    dist = 0.42
    az, el = math.radians(-35), math.radians(18)
    loc = (c.x + dist * math.cos(el) * math.sin(az),
           c.y - dist * math.cos(el) * math.cos(az),
           c.z + dist * math.sin(el))
    rot = (math.radians(90) - el, 0, az)
    cam = add_camera("cam_34", loc, rot, focal=85)
    sc.camera = cam
    sc.render.filepath = os.path.join(RENDER_DIR, f"{prefix}_three_quarter.png")
    bpy.ops.render.render(write_still=True)


def report_dimensions(stone, brush):
    def dims(ob):
        xs = [ (ob.matrix_world @ v.co) for v in ob.data.vertices ]
        mn = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
        mx = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
        return mn, mx
    smn, smx = dims(stone)
    bmn, bmx = dims(brush)
    print("=== GEOMETRY DIMENSION REPORT (cm) ===")
    print(f"stone width  X: {(smx.x - smn.x)/CM:6.2f}  (target 8.0)")
    print(f"stone height Z: {(smx.z - smn.z)/CM:6.2f}  (target 7.0)")
    print(f"body thickness Y (at z=1.5cm): "
          f"{thickness_cm(1.5):6.2f}  (target 2.5)")
    print(f"fin thickness Y (at z=6.0cm): "
          f"{thickness_cm(6.0):6.2f}  (target 1.0)")
    # 5 cm datum: left extreme to notch inner wall
    left_x = smn.x / CM
    notch_x = 0.97          # notch inner wall (SILHOUETTE datum point)
    print(f"upper section left->notch: {notch_x - left_x:6.2f}  (target 5.0)")
    print(f"brush height below stone: {(smn.z - bmn.z)/CM:6.2f}  (target 2.0)")
    print(f"brush thickness Y: {(bmx.y - bmn.y)/CM:6.2f}  (target 2.0)")
    return {
        "stone_w": (smx.x - smn.x)/CM, "stone_h": (smx.z - smn.z)/CM,
        "brush_h": (smn.z - bmn.z)/CM, "brush_t": (bmx.y - bmn.y)/CM,
        "stone_bounds": [list(smn), list(smx)],
        "brush_bounds": [list(bmn), list(bmx)],
    }


def phase1():
    reset_scene()
    stone = build_stone()
    brush = build_brush_clay()
    clay_material(stone, 0.55)
    clay_material(brush, 0.45)
    setup_world_and_lights()
    stats = report_dimensions(stone, brush)
    render_views("clay")
    bpy.ops.wm.save_as_mainfile(
        filepath=os.path.join(HERE, "mioren_brusher.blend"))
    import json
    with open(os.path.join(RENDER_DIR, "dimension_report.json"), "w") as f:
        json.dump(stats, f, indent=2)
    print("PHASE 1 COMPLETE")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int, default=1)
    args, _ = ap.parse_known_args()
    if args.phase == 1:
        phase1()
