#!/usr/bin/env python3
"""
Phase 3 — bake the uploaded master blend to an optimised, web-ready GLB.

  - stone: bake procedural serpentine -> baseColor / roughness / normal
           textures, rebuild as a glTF-native Principled material
  - fibers: reduce strand count for real-time, convert curves -> mesh,
            bake the root->tip gradient into vertex colours (COLOR_0),
            single lightweight material
  - logo:  keep the packed photographed decal, export with alpha mask
  - export selected product meshes as .glb with Draco compression

Run:  python3 export_glb.py
"""
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.normpath(os.path.join(HERE, "..", "textures"))
WEB = os.path.normpath(os.path.join(HERE, "..", "web"))
os.makedirs(TEX, exist_ok=True)
os.makedirs(WEB, exist_ok=True)

SRC = os.path.join(HERE, "reference_upload.blend")
STONE = "Single-piece variable-thickness serpentine body"
FIBER = "Dense fine fiber bundle"
BED = "Recessed bristle mounting bed"
LOGO = "Original mioren logo decal"

KEEP_FIBER_FRACTION = 1.0          # keep every strand: maximum density
FIBER_RADIUS = 0.0040              # thicken strands (master 2.5mm) to kill
                                   # sub-pixel aliasing and fill the bundle
WEB_TEX = 1024                     # downscale serpentine maps for the GLB


def only_select(obj):
    for o in bpy.data.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def assign_stone_material():
    """Fresh even UV unwrap + glTF-native serpentine material from the
    numpy PBR maps (baking the object-space procedural streaked badly)."""
    stone = bpy.data.objects[STONE]
    only_select(stone)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    mat = bpy.data.materials.new("serpentine_web")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    L = nt.links
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    def web_resize(fname):
        """Save a downscaled web copy of the map to keep the GLB small."""
        from PIL import Image
        src = os.path.join(TEX, fname)
        out = os.path.join(TEX, "web_" + fname)
        im = Image.open(src)
        if im.width > WEB_TEX:
            im = im.resize((WEB_TEX, WEB_TEX), Image.LANCZOS)
        im.save(out)
        return out

    def img_node(fname, cs, x):
        nd = nt.nodes.new("ShaderNodeTexImage")
        nd.image = bpy.data.images.load(web_resize(fname))
        nd.image.colorspace_settings.name = cs
        nd.location = (x, 0)
        return nd

    ic = img_node("stone_albedo.png", 'sRGB', -600)
    L.new(ic.outputs["Color"], bsdf.inputs["Base Color"])
    ir = img_node("stone_roughness.png", 'Non-Color', -600)
    ir.location = (-600, -300)
    L.new(ir.outputs["Color"], bsdf.inputs["Roughness"])
    inn = img_node("stone_normal.png", 'Non-Color', -600)
    inn.location = (-600, -600)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.6
    L.new(inn.outputs["Color"], nm.inputs["Color"])
    L.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Metallic"].default_value = 0.0

    stone.data.materials.clear()
    stone.data.materials.append(mat)
    print("stone: fresh UV + serpentine PBR material assigned")


def shape_fiber_cut(cur):
    """Reshape the fibre bundle to match the product photo: the lower edge
    is cut into rounded 'beaded' tufts with a pronounced central arch gap
    and a slight diagonal tilt. Each NURBS strand is shortened toward its
    root (the point nearest the stone) by a per-strand factor that depends
    on the strand's X position; strands that fall inside a gap are removed
    so the openings actually show through."""
    import math
    splines = cur.data.splines

    def spline_pts(s):
        return s.points if s.type == 'NURBS' else s.bezier_points

    # bundle X extent from each strand's root (highest point = nearest stone)
    roots = []
    for s in splines:
        pts = spline_pts(s)
        rp = max(pts, key=lambda p: p.co.z)
        roots.append((s, rp.co.x, rp.co.z))
    xs = [r[1] for r in roots]
    xmin, xmax = min(xs), max(xs)
    span = max(xmax - xmin, 1e-6)

    NT = 8.0                                   # number of tufts (from photo)
    to_remove = []
    for s, rx, rz in roots:
        xn = (rx - xmin) / span                # 0..1 across the width
        local = (xn * NT) % 1.0
        lobe = math.sqrt(max(0.0, 1.0 - (2*local - 1)**2))   # rounded tuft
        tuft = 0.84 + 0.16 * lobe              # SHALLOW rounded scallops
        d = (xn - 0.5) / 0.11
        # central dome: fibres are CUT SHORT (not removed) so the bottom
        # edge arches up and the space beneath shows through
        arch = 1.0 - 0.60 * math.exp(-d * d)
        tilt = 1.0 + 0.05 * (xn - 0.5)         # slight diagonal cut
        f = max(0.28, min(1.10, tuft * arch * tilt))
        pts = spline_pts(s)
        for p in pts:                          # shorten toward the root
            p.co.z = rz - (rz - p.co.z) * f
    print("fibre cut: shallow rounded tufts + short-cut central arch")


def reduce_and_bake_fibers():
    cur = bpy.data.objects[FIBER]
    spl = cur.data.splines
    n = len(spl)
    # evenly keep a fraction of strands (works for any 0<f<=1)
    keep_per20 = max(1, round(KEEP_FIBER_FRACTION * 20))
    if keep_per20 < 20:
        to_remove = [s for i, s in enumerate(spl) if (i % 20) >= keep_per20]
        for s in to_remove:
            spl.remove(s)
    # NOTE: the tuft/central-arch reshape (shape_fiber_cut) was reverted per
    # user preference for the fuller, dense bundle — keep every strand at
    # its natural length. Call shape_fiber_cut(cur) here to re-enable it.
    # thicken every strand so it always covers >1px (no aliasing sparkle)
    cur.data.bevel_depth = FIBER_RADIUS
    if '--light-fibers' in sys.argv:          # smaller tubes for the
        cur.data.bevel_resolution = 0         # uncompressed standalone GLB
        cur.data.resolution_u = 1             # (keeps full strand density)
    print("fibers kept:", len(cur.data.splines), "of", n,
          "| radius", FIBER_RADIUS)

    only_select(cur)
    bpy.ops.object.convert(target='MESH')
    me = cur.data
    print("fiber mesh:", len(me.vertices), "verts", len(me.polygons), "tris")

    # per-strand tints — bright saturated copper so the warm diffuse
    # dominates the white specular on the thin cylinders (linear values)
    tints = {
        0: (0.46, 0.150, 0.040),    # copper
        1: (0.36, 0.110, 0.028),    # dark auburn
        2: (0.56, 0.200, 0.058),    # warm chestnut
    }
    root = (0.120, 0.045, 0.016)    # dark warm root, shared

    zs = [v.co.z for v in me.vertices]
    zmax, zmin = max(zs), min(zs)
    span = max(zmax - zmin, 1e-6)

    ca = me.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')
    li = 0
    for poly in me.polygons:
        tip = tints.get(poly.material_index, tints[0])
        for vi in poly.vertices:
            z = me.vertices[vi].co.z
            t = (z - zmin) / span            # 0 root(bottom/tip) .. 1 top(root)
            # strands hang down: top = root(dark), bottom = tip(warm)
            f = 1.0 - t
            col = [root[k] + (tip[k] - root[k]) * (f ** 0.6) for k in range(3)]
            # ambient occlusion: interior of the bundle sits in shadow, the
            # very roots where fibres pack under the stone are darkest
            ao = 0.5 + 0.5 * (f ** 0.7)
            col = tuple(c * ao for c in col)
            ca.data[li].color = (col[0], col[1], col[2], 1.0)
            li += 1

    # single lightweight material driven by vertex colour
    for m in list(me.materials):
        pass
    me.materials.clear()
    mat = bpy.data.materials.new("fibers_web")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    catt = nt.nodes.new("ShaderNodeVertexColor")
    catt.layer_name = "Col"
    nt.links.new(catt.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.5
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.35
    me.materials.append(mat)
    print("fiber vertex colours + web material assigned")


def fix_logo():
    logo = bpy.data.objects.get(LOGO)
    if not logo:
        return
    mat = logo.data.materials[0]
    nt = mat.node_tree
    img = next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if img and bsdf and not bsdf.inputs["Alpha"].is_linked:
        nt.links.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    if hasattr(mat, "blend_method"):
        mat.blend_method = 'BLEND'
    # glTF alpha mode
    try:
        mat.surface_render_method = 'BLENDED'
    except Exception:
        pass


def export():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    assign_stone_material()
    reduce_and_bake_fibers()
    fix_logo()

    # select only the product parts
    for o in bpy.data.objects:
        o.select_set(False)
    exported = []
    for name in (STONE, FIBER, BED, LOGO):
        o = bpy.data.objects.get(name)
        if o:
            o.select_set(True)
            exported.append(name)
    print("exporting:", exported)

    draco = '--no-draco' not in sys.argv
    out_name = "mioren_brusher.glb" if draco else "mioren_brusher_standalone.glb"
    out = os.path.join(WEB, out_name)
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_vertex_color='MATERIAL',
        export_materials='EXPORT',
    )
    print("GLB size (KB):", round(os.path.getsize(out) / 1024, 1),
          "| draco:", draco, "->", out_name)
    print("EXPORT COMPLETE ->", out)


if __name__ == "__main__":
    export()
