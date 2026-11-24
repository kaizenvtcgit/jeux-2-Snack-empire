"""
Food truck détaillé pour Street Food Empire.
Exécuté dans Blender (4.5) : construit le modèle puis l'exporte en GLB.

Repères : Blender Z = haut. Le côté de service (fenêtre) est en -Y,
ce qui devient +Z dans Three.js après l'export glTF (Y-up).
Les noms des matériaux sont utilisés par le jeu :
  Body (recoloré par stand), Awning (texture rayée), SignFace (enseigne).
"""
import bpy, bmesh, math, os

OUT = globals().get('OUT_PATH', '')

# ---------- Remise à zéro ----------
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials):
    for d in list(coll):
        coll.remove(d)
scene = bpy.context.scene

# ---------- Matériaux ----------
def lin(h):
    h = h.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out

MATS = {}
def mat(name, color, rough=0.5, metal=0.0, coat=0.0, emit=None, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.1
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    m.diffuse_color = (*lin(color), 1)
    MATS[name] = m
    return m

mat('Body', '#e63946', 0.32, 0.15, coat=1.0)
mat('Trim', '#f1e6cf', 0.4, 0.0, coat=0.5)
mat('Chrome', '#e4e8ec', 0.12, 1.0)
mat('Steel', '#b9bec4', 0.32, 1.0)
mat('DarkMetal', '#2b2d31', 0.45, 0.6)
mat('Rubber', '#1b1b1d', 0.85)
mat('Glass', '#1d2a36', 0.04, 0.3)
mat('Headlight', '#fff6c8', 0.2, emit='#fff1b0', strength=3)
mat('Taillight', '#c4121b', 0.25, emit='#ff2020', strength=1.2)
mat('Amber', '#ff9a1f', 0.25, emit='#ff8a00', strength=0.8)
mat('InteriorLight', '#ffe2b0', 0.4, emit='#ffc070', strength=4)
mat('InteriorWall', '#d8c8a8', 0.6)
mat('Food', '#8a4a24', 0.6)
mat('Bun', '#d99a4e', 0.55)
mat('Plastic', '#e8e2d6', 0.5)
mat('Red', '#d9342b', 0.45)
mat('Yellow', '#f4c21d', 0.45)
mat('Propane', '#f2f2f0', 0.35, 0.2)
mat('Plate', '#f7f4e8', 0.5)
mat('SignFace', '#ffd23f', 0.4, emit='#ffffff', strength=1)
mat('SignFrame', '#1b1a24', 0.4, 0.5)
mat('Awning', '#ffffff', 0.85)

# ---------- Aides ----------
def finish(o, material, bevel=0.0, seg=3, smooth=True):
    if material:
        o.data.materials.clear()
        o.data.materials.append(MATS[material])
    if bevel:
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = seg
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o

def apply_mods(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def cube(name, size, loc, material, bevel=0.0, seg=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, material, bevel, seg)

AX = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}
def cyl(name, r, depth, loc, material, axis='Z', verts=32, bevel=0.0, seg=3, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=AX[axis])
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=AX[axis])
    o = bpy.context.active_object
    o.name = name
    return finish(o, material, bevel, seg)

def cut(target, cutter, keep=False):
    apply_mods(target)
    m = target.modifiers.new('Cut', 'BOOLEAN')
    m.object = cutter
    m.operation = 'DIFFERENCE'
    m.solver = 'EXACT'
    apply_mods(target)
    if not keep:
        bpy.data.objects.remove(cutter, do_unlink=True)

def cutter_cube(size, loc):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return o

def wheel_wells(target):
    for x in (-2.3, 3.0):
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.63, depth=3.2, location=(x, 0, 0.5), rotation=AX['Y'])
        cut(target, bpy.context.active_object)

parts = []
def P(o):
    parts.append(o)
    return o

# ---------- Carrosserie ----------
body = P(cube('Body', (5.4, 2.4, 2.5), (-0.6, 0, 1.85), 'Body', bevel=0.14, seg=4))
cut(body, cutter_cube((3.1, 1.0, 1.05), (-0.9, -1.2, 2.05)))   # fenêtre de service (renfoncement)
wheel_wells(body)

cab = P(cube('Cab', (1.9, 2.3, 1.95), (2.95, 0, 1.55), 'Body', bevel=0.3, seg=5))
wheel_wells(cab)

skirt = P(cube('Skirt', (5.46, 2.46, 0.42), (-0.6, 0, 0.9), 'Trim', bevel=0.06))
wheel_wells(skirt)
cabtrim = P(cube('CabTrim', (1.96, 2.36, 0.3), (2.95, 0, 0.88), 'Trim', bevel=0.06))
wheel_wells(cabtrim)
# liseré chromé au-dessus du bas de caisse
P(cube('TrimLine', (5.48, 2.48, 0.04), (-0.6, 0, 1.13), 'Chrome', bevel=0.015))

# Intérieur sombre des passages de roue
for x in (-2.3, 3.0):
    P(cyl(f'WellLiner{x}', 0.62, 2.2, (x, 0, 0.5), 'DarkMetal', axis='Y', verts=40))

# ---------- Cabine ----------
P(cube('Windshield', (0.06, 1.9, 0.8), (3.92, 0, 1.98), 'Glass', bevel=0.03))
P(cube('WindshieldFrame', (0.05, 2.0, 0.9), (3.9, 0, 1.98), 'DarkMetal', bevel=0.03))
for s in (-1, 1):
    P(cube(f'SideWin{s}', (0.95, 0.06, 0.62), (3.2, s * 1.16, 2.02), 'Glass', bevel=0.03))
    P(cube(f'DoorSeamF{s}', (0.02, 0.02, 1.35), (3.72, s * 1.155, 1.55), 'DarkMetal'))
    P(cube(f'DoorSeamB{s}', (0.02, 0.02, 1.35), (2.42, s * 1.155, 1.55), 'DarkMetal'))
    P(cube(f'Handle{s}', (0.22, 0.05, 0.05), (2.65, s * 1.18, 1.62), 'Chrome', bevel=0.015))
    # rétroviseur
    P(cyl(f'MirrorArm{s}', 0.025, 0.35, (3.78, s * 1.3, 2.05), 'DarkMetal', axis='Y', verts=10))
    P(cube(f'Mirror{s}', (0.08, 0.14, 0.3), (3.78, s * 1.48, 2.05), 'DarkMetal', bevel=0.03))
    # clignotant
    P(cube(f'Blinker{s}', (0.05, 0.1, 0.07), (3.86, s * 1.05, 1.42), 'Amber', bevel=0.015))

# Calandre + phares + pare-chocs + plaque
P(cube('Grille', (0.05, 1.15, 0.36), (3.9, 0, 1.15), 'DarkMetal', bevel=0.02))
for k in range(4):
    P(cube(f'Slat{k}', (0.03, 1.1, 0.03), (3.93, 0, 1.03 + k * 0.08), 'Chrome'))
for s in (-1, 1):
    P(cyl(f'HeadRing{s}', 0.2, 0.06, (3.9, s * 0.82, 1.2), 'Chrome', axis='X', verts=32))
    P(cyl(f'Headlight{s}', 0.165, 0.07, (3.92, s * 0.82, 1.2), 'Headlight', axis='X', verts=32))
P(cube('BumperF', (0.26, 2.42, 0.22), (3.98, 0, 0.75), 'Chrome', bevel=0.07, seg=4))
P(cube('BumperR', (0.22, 2.42, 0.2), (-3.36, 0, 0.75), 'Chrome', bevel=0.06, seg=4))
P(cube('PlateF', (0.02, 0.5, 0.14), (4.12, 0, 0.75), 'Plate', bevel=0.01))

# ---------- Arrière ----------
P(cube('RearSeam', (0.02, 0.02, 2.0), (-3.31, 0, 1.95), 'DarkMetal'))
for s in (-1, 1):
    P(cube(f'Taillight{s}', (0.05, 0.16, 0.32), (-3.31, s * 1.0, 1.35), 'Taillight', bevel=0.02))
    P(cube(f'RearHandle{s}', (0.04, 0.05, 0.22), (-3.32, s * 0.12, 1.9), 'Chrome', bevel=0.01))
# bonbonnes de gaz sur le flanc arrière (côté opposé au service)
for k, x in enumerate((-2.95, -2.6)):
    P(cyl(f'Propane{k}', 0.15, 0.62, (x, 1.36, 1.55), 'Propane', verts=24, bevel=0.06))
    P(cyl(f'PropaneValve{k}', 0.04, 0.1, (x, 1.36, 1.91), 'Chrome', verts=12))
P(cube('PropaneRack', (0.9, 0.05, 0.05), (-2.78, 1.24, 1.35), 'DarkMetal'))
P(cube('PropaneRack2', (0.9, 0.05, 0.05), (-2.78, 1.24, 1.75), 'DarkMetal'))

# ---------- Fenêtre de service ----------
frame = cube('WinFrame', (3.3, 0.08, 1.25), (-0.9, -1.22, 2.05), 'Chrome', bevel=0.02)
cut(frame, cutter_cube((3.1, 0.4, 1.05), (-0.9, -1.22, 2.05)))
P(frame)
# intérieur du camion (visible par la fenêtre)
P(cube('InteriorBack', (3.1, 0.02, 1.05), (-0.9, -0.71, 2.05), 'InteriorWall'))
P(cube('Splash', (3.1, 0.015, 0.5), (-0.9, -0.725, 1.83), 'Steel'))
P(cube('Grill', (1.0, 0.3, 0.1), (-1.85, -0.86, 1.6), 'DarkMetal', bevel=0.01))
for k in range(3):
    P(cyl(f'Patty{k}', 0.09, 0.03, (-2.15 + k * 0.28, -0.86, 1.67), 'Food', verts=16))
P(cube('Hood', (1.2, 0.36, 0.18), (-1.85, -0.88, 2.47), 'Steel', bevel=0.02))
P(cube('Shelf', (1.3, 0.16, 0.03), (0.0, -0.79, 2.25), 'Steel'))
for k, (mtl, h) in enumerate((('Red', 0.2), ('Yellow', 0.2), ('Red', 0.16), ('Plastic', 0.24), ('Yellow', 0.16))):
    P(cyl(f'Bottle{k}', 0.045, h, (-0.5 + k * 0.24, -0.79, 2.265 + h / 2), mtl, verts=12))
P(cube('LightStrip', (2.9, 0.06, 0.03), (-0.9, -1.0, 2.555), 'InteriorLight'))
# comptoir extérieur + équerres
P(cube('Counter', (3.6, 0.55, 0.07), (-0.9, -1.45, 1.49), 'Steel', bevel=0.02))
for x in (-2.4, 0.6):
    P(cube(f'Bracket{x}', (0.05, 0.4, 0.05), (x, -1.38, 1.36), 'Steel', rot=(math.radians(-35), 0, 0)))
# serviettes, ketchup, mayo, burgers sur le comptoir
P(cube('Napkins', (0.18, 0.14, 0.14), (0.45, -1.5, 1.6), 'Plastic', bevel=0.01))
P(cyl('Ketchup', 0.05, 0.2, (0.15, -1.5, 1.625), 'Red', verts=14))
P(cyl('Mustard', 0.05, 0.2, (0.02, -1.55, 1.625), 'Yellow', verts=14))
for k, x in enumerate((-2.1, -1.65)):
    P(cyl(f'BunB{k}', 0.16, 0.06, (x, -1.48, 1.555), 'Bun', verts=24, bevel=0.02))
    P(cyl(f'Meat{k}', 0.17, 0.05, (x, -1.48, 1.605), 'Food', verts=24, bevel=0.015))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.165, location=(x, -1.48, 1.63))
    top = bpy.context.active_object
    top.scale = (1, 1, 0.6)
    bpy.ops.object.transform_apply(scale=True)
    finish(top, 'Bun')
    cut(top, cutter_cube((0.5, 0.5, 0.3), (x, -1.48, 1.48)))
    P(top)

# ---------- Auvent en tissu (UV 0..1 → texture rayée dans le jeu) ----------
bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=6, size=1, location=(0, 0, 0))
awn = bpy.context.active_object
awn.name = 'Awning'
me = awn.data
for v in me.vertices:
    u = v.co.x + 0.5          # 0..1 le long du camion
    t = v.co.y + 0.5          # 0 = charnière, 1 = bord libre
    x = -0.9 + (u - 0.5) * 3.8
    y = -1.22 - t * 1.25
    z = 2.78 - t * 0.42 - math.sin(math.pi * t) * 0.05 - math.sin(math.pi * u) * 0.04 * t
    v.co = (x, y, z)
finish(awn, 'Awning')
sol = awn.modifiers.new('Solid', 'SOLIDIFY')
sol.thickness = 0.02
apply_mods(awn)
P(awn)
for x in (-2.75, 0.95):
    # bras de soutien : du flanc (y=-1.22, z=1.75) jusqu'au bord de l'auvent (y=-2.45, z=2.34)
    rod = cyl(f'AwnRod{x}', 0.018, 1.364, (x, -1.835, 2.045), 'Chrome', verts=10)
    rod.rotation_euler = (math.radians(64.4), 0, 0)
    P(rod)

# ---------- Enseigne sur le toit ----------
P(cube('SignFrame', (3.95, 0.16, 0.9), (-0.7, -0.35, 3.58), 'SignFrame', bevel=0.04))
bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.7, -0.432, 3.58), rotation=(math.pi / 2, 0, 0))
face = bpy.context.active_object
face.name = 'SignFace'
face.scale = (3.75, 0.72, 1)
bpy.ops.object.transform_apply(scale=True)
P(finish(face, 'SignFace', smooth=False))
for x in (-2.2, 0.8):
    P(cyl(f'SignPost{x}', 0.045, 0.45, (x, -0.35, 3.1), 'Chrome', verts=12))
# toit : extracteur, cheminée, climatiseur, galerie
P(cube('RoofVent', (0.8, 0.8, 0.28), (-2.5, 0.4, 3.22), 'Steel', bevel=0.05))
P(cyl('Chimney', 0.12, 0.6, (-2.6, 0.75, 3.55), 'Steel', verts=20))
P(cyl('ChimneyCap', 0.2, 0.1, (-2.6, 0.75, 3.9), 'Steel', verts=20, r2=0.05))
P(cube('AC', (0.9, 0.7, 0.3), (1.0, 0.45, 3.24), 'Plastic', bevel=0.06))
for k in range(5):
    P(cube(f'ACSlat{k}', (0.6, 0.02, 0.02), (1.0, 0.09, 3.14 + k * 0.045), 'DarkMetal'))

# ---------- Roues ----------
def wheel(name, x, s):
    tire = cyl(name, 0.5, 0.36, (x, s * 1.12, 0.5), 'Rubber', axis='Y', verts=48, bevel=0.09, seg=4)
    apply_mods(tire)
    rim = cyl(name + 'Rim', 0.3, 0.37, (x, s * 1.12, 0.5), 'Chrome', axis='Y', verts=40, bevel=0.03)
    hub = cyl(name + 'Hub', 0.1, 0.42, (x, s * 1.12, 0.5), 'DarkMetal', axis='Y', verts=20, bevel=0.02)
    out = [tire, rim, hub]
    for k in range(6):
        a = k * math.pi / 3
        out.append(cube(f'{name}Nut{k}', (0.035, 0.03, 0.035), (x + math.cos(a) * 0.17, s * 1.31, 0.5 + math.sin(a) * 0.17), 'Steel'))
    return out
for x in (-2.3, 3.0):
    for s in (-1, 1):
        for o in wheel(f'Wheel{x}{s}', x, s):
            P(o)

# ---------- Fusion + export ----------
for o in parts:
    if o.name in bpy.data.objects:
        apply_mods(o)
bpy.ops.object.select_all(action='DESELECT')
alive = [o for o in parts if o.name in bpy.data.objects]
for o in alive:
    o.select_set(True)
bpy.context.view_layer.objects.active = alive[0]
bpy.ops.object.join()
truck = bpy.context.active_object
truck.name = 'FoodTruck'
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

tris = sum(len(p.vertices) - 2 for p in truck.data.polygons)
print('triangles:', tris, 'materials:', len(truck.data.materials))

if OUT:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print('exported', OUT, os.path.getsize(OUT))
