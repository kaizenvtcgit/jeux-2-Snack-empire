"""
Client articulé pour Snack Empire (Blender 4.5).

Le personnage regarde vers -Y (devient +Z dans Three.js).
Nœuds utilisés par le jeu :
  Body (tronc + tête), LegL / LegR (pivot à la hanche), ArmL / ArmR (pivot à l'épaule),
  HairShort / HairLong / Cap (coiffures, une seule visible à la fois).
Matériaux recolorés par le jeu : Skin, Shirt, Pants, Shoes, Hair, CapColor.
"""
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

OUT = globals().get('OUT_PATH', '')

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials):
    for d in list(coll):
        coll.remove(d)
scene = bpy.context.scene

def lin(h):
    h = h.lstrip('#')
    return [(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))]

MATS = {}
def mat(name, color, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*lin(color), 1)
    MATS[name] = m

mat('Skin', '#e8b48a', 0.55)
mat('Shirt', '#457b9d', 0.85)
mat('Pants', '#2b3040', 0.85)
mat('Shoes', '#f2f2f2', 0.5)
mat('Hair', '#3a2616', 0.7)
mat('CapColor', '#e63946', 0.7)
mat('EyeWhite', '#f8f8f4', 0.3)
mat('Pupil', '#1a1a22', 0.2)
mat('Mouth', '#9a4a42', 0.6)
mat('Sole', '#3a3a3a', 0.8)

def link(o):
    scene.collection.objects.link(o)
    return o

def set_mat(o, name):
    o.data.materials.clear()
    o.data.materials.append(MATS[name])
    for p in o.data.polygons:
        p.use_smooth = True
    return o

def lathe(name, rings, material, seg=18):
    """Surface de révolution : rings = [(z, rx, ry, cx, cy), ...] de bas en haut."""
    bm = bmesh.new()
    loops = []
    for r in rings:
        z, rx, ry = r[:3]
        cx = r[3] if len(r) > 3 else 0.0
        cy = r[4] if len(r) > 4 else 0.0
        loops.append([bm.verts.new((cx + rx * math.cos(2 * math.pi * i / seg), cy + ry * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)])
    for a, b in zip(loops, loops[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    bm.faces.new(list(reversed(loops[0])))
    bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return set_mat(link(bpy.data.objects.new(name, me)), material)

def sphere(name, r, loc, material, scale=(1, 1, 1), seg=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return set_mat(o, material)

def rcube(name, size, loc, material, bevel=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    set_mat(o, material)
    m = o.modifiers.new('Bevel', 'BEVEL')
    m.width = bevel
    m.segments = 3
    apply(o)
    return o

def apply(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def cut(o, size, loc):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    c = bpy.context.active_object
    c.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('Cut', 'BOOLEAN')
    m.object = c
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    apply(o)
    bpy.data.objects.remove(c, do_unlink=True)

def join(name, objs, pivot=(0, 0, 0)):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    # origine = pivot d'articulation
    o.data.transform(Matrix.Translation(-Vector(pivot)))
    o.location = pivot
    for p in o.data.polygons:
        p.use_smooth = True
    return o

HEAD_Z = 1.64

# ---------- Tronc + tête ----------
torso = lathe('Torso', [
    (0.95, 0.155, 0.1), (1.02, 0.15, 0.098), (1.1, 0.142, 0.094), (1.2, 0.158, 0.102),
    (1.3, 0.172, 0.108), (1.38, 0.178, 0.104), (1.43, 0.16, 0.095), (1.47, 0.09, 0.07), (1.49, 0.05, 0.05),
], 'Shirt')
collar = lathe('Collar', [(1.45, 0.06, 0.058), (1.49, 0.065, 0.062), (1.5, 0.05, 0.05)], 'Shirt')
pelvis = lathe('Pelvis', [(0.82, 0.13, 0.09), (0.88, 0.156, 0.102), (0.97, 0.158, 0.104), (1.0, 0.155, 0.102)], 'Pants')
neck = lathe('Neck', [(1.44, 0.048, 0.046), (1.56, 0.046, 0.044)], 'Skin', seg=14)
head = sphere('Head', 0.115, (0, 0, HEAD_Z), 'Skin', scale=(0.95, 1.0, 1.15), seg=28, rings=18)
nose = sphere('Nose', 0.022, (0, -0.112, HEAD_Z - 0.01), 'Skin', scale=(0.8, 1, 1.2), seg=12, rings=8)
ears = [sphere(f'Ear{s}', 0.03, (s * 0.108, 0.0, HEAD_Z), 'Skin', scale=(0.45, 0.8, 1.1), seg=12, rings=8) for s in (-1, 1)]
eyes = []
for s in (-1, 1):
    eyes.append(sphere(f'Eye{s}', 0.019, (s * 0.04, -0.096, HEAD_Z + 0.025), 'EyeWhite', seg=12, rings=8))
    eyes.append(sphere(f'Pupil{s}', 0.0105, (s * 0.04, -0.113, HEAD_Z + 0.025), 'Pupil', seg=10, rings=6))
    eyes.append(rcube(f'Brow{s}', (0.04, 0.012, 0.01), (s * 0.042, -0.106, HEAD_Z + 0.058), 'Hair', bevel=0.004))
mouth = sphere('Mouth', 0.024, (0, -0.104, HEAD_Z - 0.05), 'Mouth', scale=(1.1, 0.35, 0.35), seg=12, rings=6)
body = join('Body', [torso, collar, pelvis, neck, head, nose, mouth] + ears + eyes)

# ---------- Jambes (pivot hanche) ----------
for side, sx in (('L', 1), ('R', -1)):
    cx = sx * 0.082
    leg = lathe('Leg' + side, [
        (0.09, 0.052, 0.054, cx), (0.2, 0.056, 0.058, cx), (0.35, 0.064, 0.066, cx), (0.48, 0.066, 0.068, cx),
        (0.6, 0.076, 0.078, cx), (0.75, 0.086, 0.088, cx), (0.88, 0.09, 0.092, cx), (0.97, 0.075, 0.075, cx),
    ], 'Pants')
    shoe = rcube('Shoe' + side, (0.105, 0.25, 0.085), (cx, -0.035, 0.055), 'Shoes', bevel=0.035)
    sole = rcube('Sole' + side, (0.11, 0.255, 0.025), (cx, -0.035, 0.0125), 'Sole', bevel=0.01)
    join('Leg' + side, [leg, shoe, sole], pivot=(cx, 0, 0.92))

# ---------- Bras (pivot épaule) ----------
for side, sx in (('L', 1), ('R', -1)):
    def X(v): return sx * v
    sleeve = lathe('Sleeve' + side, [
        (1.18, 0.048, 0.048, X(0.232)), (1.22, 0.05, 0.05, X(0.228)), (1.32, 0.05, 0.05, X(0.212)),
        (1.4, 0.05, 0.052, X(0.19)), (1.45, 0.035, 0.035, X(0.175)),
    ], 'Shirt', seg=16)
    fore = lathe('Fore' + side, [
        (0.97, 0.033, 0.033, X(0.245)), (1.08, 0.038, 0.038, X(0.24)), (1.2, 0.043, 0.043, X(0.232)),
    ], 'Skin', seg=14)
    hand = sphere('Hand' + side, 0.042, (X(0.247), -0.005, 0.925), 'Skin', scale=(0.7, 0.95, 1.25), seg=14, rings=10)
    join('Arm' + side, [sleeve, fore, hand], pivot=(X(0.2), 0, 1.42))

# ---------- Coiffures ----------
hs = sphere('HairShort', 0.124, (0, 0.006, HEAD_Z + 0.012), 'Hair', scale=(0.97, 1.02, 1.12), seg=28, rings=18)
cut(hs, (0.5, 0.5, 0.3), (0, 0, HEAD_Z - 0.12))           # bas
cut(hs, (0.5, 0.2, 0.2), (0, -0.16, HEAD_Z - 0.02))        # visage
cut(hs, (0.06, 0.3, 0.1), (0.13, -0.02, HEAD_Z - 0.03))    # oreilles
cut(hs, (0.06, 0.3, 0.1), (-0.13, -0.02, HEAD_Z - 0.03))
join('HairShort', [hs])

hl = sphere('HairLongTop', 0.126, (0, 0.008, HEAD_Z + 0.014), 'Hair', scale=(0.99, 1.03, 1.13), seg=28, rings=18)
cut(hl, (0.5, 0.5, 0.3), (0, 0, HEAD_Z - 0.17))
cut(hl, (0.5, 0.2, 0.22), (0, -0.165, HEAD_Z - 0.03))
back = lathe('HairLongBack', [
    (HEAD_Z - 0.21, 0.1, 0.045, 0, 0.065), (HEAD_Z - 0.12, 0.12, 0.06, 0, 0.06), (HEAD_Z - 0.02, 0.125, 0.07, 0, 0.04),
], 'Hair')
join('HairLong', [hl, back])

cap = sphere('CapTop', 0.128, (0, 0.006, HEAD_Z + 0.02), 'CapColor', scale=(0.98, 1.03, 1.0), seg=28, rings=18)
cut(cap, (0.5, 0.5, 0.3), (0, 0, HEAD_Z - 0.1))
bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.1, depth=0.012, location=(0, -0.13, HEAD_Z + 0.055))
visor = bpy.context.active_object
visor.scale = (1.0, 0.75, 1)
bpy.ops.object.transform_apply(scale=True)
set_mat(visor, 'CapColor')
cut(visor, (0.4, 0.2, 0.1), (0, 0.02, HEAD_Z + 0.055))
nub = sphere('CapNub', 0.014, (0, 0.006, HEAD_Z + 0.148), 'CapColor', seg=10, rings=6)
join('Cap', [cap, visor, nub])

names = ['Body', 'LegL', 'LegR', 'ArmL', 'ArmR', 'HairShort', 'HairLong', 'Cap']
tris = 0
for n in names:
    o = bpy.data.objects[n]
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
print('triangles (all parts):', tris)

if OUT:
    bpy.ops.object.select_all(action='DESELECT')
    for n in names:
        bpy.data.objects[n].select_set(True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print('exported', os.path.getsize(OUT))
