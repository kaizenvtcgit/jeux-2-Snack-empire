"""
Personnages de Snack Empire (Blender 4.5) — clients et cuisinier.

Lancer :  blender -b --python tools/blender/people.py -- public/models/people.glb

Formes organiques : chaque membre est un « squelette » de points avec un rayon (modificateur Skin),
lissé (Subdivision). La tête est une sphère sculptée par calcul (mâchoire, pommettes, orbites),
avec nez, oreilles, paupières, lèvres et sourcils.

Même articulation que l'ancien modèle (le jeu anime ces pièces) — coordonnées du JEU (y vers le haut, +z vers l'avant) :
  Body                 tronc, cou, tête, visage (pivot au sol)
  LegL / LegR          cuisse, pivot à la hanche (±0,082 ; 0,92)
  ShinL / ShinR        jambe + chaussure, pivot au genou (±0,082 ; 0,46)
  ArmL / ArmR          manche + bras, pivot à l'épaule (±0,2 ; 1,42)
  ForearmL / ForearmR  avant-bras + main, pivot au coude (±0,2 ; 1,13)
  HairShort / HairLong / HairBun / HairCurly / Cap   coiffures (une seule visible, la casquette va avec HairShort)
Chaque matériau porte le nom d'une case de la palette du jeu (Skin, Shirt, Pants, Shoes, Hair, CapColor,
EyeWhite, Pupil, Mouth, Sole, Accent, Belt) : le jeu les recolore par client.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else ''
DEBUG = '--debug' in argv

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.materials):
    for d in list(coll):
        coll.remove(d)
scene = bpy.context.scene

# ---------- repère : on écrit tout en coordonnées du jeu ----------
def B(x, y, z):
    """Jeu (x, y haut, z avant) → Blender (x, -z, y) : le personnage regarde vers -Y, devient +Z dans Three.js."""
    return Vector((x, -z, y))

# ---------- matériaux (couleurs de prévisualisation ; le jeu les remplace) ----------
def lin(h):
    h = h.lstrip('#')
    return [(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))]
MATS = {}
for name, col in [('Skin', '#e8b48a'), ('Shirt', '#457b9d'), ('Pants', '#2b3040'), ('Shoes', '#f2f2f2'), ('Hair', '#3a2616'),
                  ('CapColor', '#e63946'), ('EyeWhite', '#f8f8f4'), ('Pupil', '#2a1d16'), ('Mouth', '#a8564d'), ('Sole', '#3a3a3a'),
                  ('Accent', '#f1f1ea'), ('Belt', '#3b2a20')]:
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*lin(col), 1)
    MATS[name] = m

def link(o):
    scene.collection.objects.link(o)
    return o

def finish(o, mat, smooth=True):
    o.data.materials.clear()
    o.data.materials.append(MATS[mat])
    for p in o.data.polygons:
        p.use_smooth = smooth
    return o

def bake(o, subsurf=1):
    """Applique les modificateurs (Skin, Subdivision…) : le maillage final remplace l'original."""
    if subsurf:
        o.modifiers.new('Sub', 'SUBSURF').levels = subsurf
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    old = o.data
    o.data = me
    bpy.data.meshes.remove(old)
    return o

def skin(name, pts, edges, mat, subsurf=1):
    """Forme organique : pts = [(x, y, z, rayon_x, rayon_z)] en coordonnées du jeu, edges = liaisons."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(*p[:3]) for p in pts], edges, [])
    o = link(bpy.data.objects.new(name, me))
    mod = o.modifiers.new('Skin', 'SKIN')
    mod.use_smooth_shade = True
    mod.branch_smoothing = 0.6
    d = me.skin_vertices[0].data
    k = 1.12 if subsurf else 1.0  # (le lissage rétrécit la forme d'environ 10 % : on compense)
    for i, p in enumerate(pts):
        d[i].radius = (p[3] * k, (p[4] if len(p) > 4 else p[3]) * k)
    d[0].use_root = True
    bake(o, subsurf)
    if DEBUG:
        dm = o.dimensions
        print(f'   {name}: largeur {dm.x:.3f} profondeur {dm.y:.3f} (rayons demandés {pts[len(pts)//2][3]:.3f})')
    return finish(o, mat)

def chain(n):
    return [(i, i + 1) for i in range(n - 1)]

def ellipsoid(name, c, r, mat, seg=20, rings=14, subsurf=0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
    for v in bm.verts:
        x, y, z = v.co.x * r[0], v.co.z * r[1], -v.co.y * r[2]  # sphère Blender → axes du jeu
        v.co = Vector((x, y, z))
    rx, ry, rz = rot
    M = (Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rx, 3, 'X') @ Matrix.Rotation(rz, 3, 'Z'))
    for v in bm.verts:
        g = M @ v.co
        v.co = B(c[0] + g.x, c[1] + g.y, c[2] + g.z)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me))
    if subsurf:
        bake(o, subsurf)
    return finish(o, mat)

def torus(name, c, R, r, mat, sy=1.0, sz=1.0, tilt=0.0, seg=22):
    bm = bmesh.new()
    pts = []
    for i in range(seg):
        a = i / seg * math.tau
        for j in range(6):
            b = j / 6 * math.tau
            x = (R + r * math.cos(b)) * math.cos(a)
            z = (R + r * math.cos(b)) * math.sin(a) * sz
            y = r * math.sin(b) * sy
            y += z * math.sin(tilt)
            pts.append(bm.verts.new(B(c[0] + x, c[1] + y, c[2] + z)))
    for i in range(seg):
        for j in range(6):
            a = pts[i * 6 + j]; b = pts[i * 6 + (j + 1) % 6]
            cc = pts[((i + 1) % seg) * 6 + (j + 1) % 6]; d = pts[((i + 1) % seg) * 6 + j]
            bm.faces.new((a, b, cc, d))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    return finish(link(bpy.data.objects.new(name, me)), mat)

def join(name, objs, pivot):
    if name == 'Body':
        print('   détail :', ', '.join(f"{o.name} {sum(len(p.vertices) - 2 for p in o.data.polygons)}" for o in objs))
    """Réunit des morceaux en une pièce du personnage, origine (pivot d'articulation) en coordonnées du jeu."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    p = B(*pivot)
    o.data.transform(Matrix.Translation(-p))
    o.location = p
    return o

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

# =====================================================================
# TÊTE (centre du crâne : y = 1,645)
# =====================================================================
HY = 1.645
def build_head():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=22, radius=1)
    eyes = [(-0.036, 0.012), (0.036, 0.012)]
    for v in bm.verts:
        x, y, z = v.co.x, v.co.z, -v.co.y           # sphère unité, axes du jeu
        rx, ry, rz = 0.094, 0.116, 0.104
        X, Y, Z = x * rx, y * ry, z * rz
        # mâchoire : le bas du visage se resserre, le menton avance un peu
        low = smoothstep(0.0, -1.0, y)
        X *= 1 - 0.30 * low ** 1.3
        if z > 0:
            Z *= 1 - 0.12 * low
            Z += 0.012 * smoothstep(-0.55, -0.95, y) * smoothstep(0.3, 0.9, z)
        else:
            Z *= 1 - 0.25 * low                      # nuque
        # arrière du crâne un peu plus marqué, front légèrement aplati
        if z < 0 and y > -0.2:
            Z *= 1.06
        if z > 0.6 and y > 0.25:
            Z *= 0.97
        # pommettes
        for sx in (-1, 1):
            d = (X - sx * 0.058) ** 2 + (Y + 0.008) ** 2 + (Z - 0.07) ** 2
            k = math.exp(-d / 0.0009)
            X += sx * 0.006 * k; Z += 0.003 * k
        # orbites : léger creux à l'emplacement des yeux
        for ex, ey in eyes:
            d = (X - ex) ** 2 + (Y - ey) ** 2
            if Z > 0:
                Z -= 0.008 * math.exp(-d / 0.00035)
        # côtés un peu plus plats (tempes)
        if abs(y) < 0.5:
            X *= 0.985
        v.co = B(X, HY + Y, Z)
    me = bpy.data.meshes.new('Head')
    bm.to_mesh(me); bm.free()
    head = finish(link(bpy.data.objects.new('Head', me)), 'Skin')
    parts = [head]
    # nez : arête, bout, ailes (forme lisse)
    parts.append(skin('Nose', [(0, HY + 0.035, 0.097, 0.009, 0.007), (0, HY + 0.008, 0.108, 0.011, 0.009), (0, HY - 0.012, 0.117, 0.014, 0.012),
                               (-0.013, HY - 0.016, 0.106, 0.009), (0.013, HY - 0.016, 0.106, 0.009)],
                      [(0, 1), (1, 2), (2, 3), (2, 4)], 'Skin', 1))
    # oreilles
    for sx in (-1, 1):
        parts.append(ellipsoid('Ear', (sx * 0.093, HY - 0.002, -0.006), (0.012, 0.03, 0.02), 'Skin', 12, 10, 0, rot=(0, sx * 0.35, 0)))
        parts.append(ellipsoid('EarIn', (sx * 0.1, HY - 0.002, -0.004), (0.004, 0.018, 0.011), 'Mouth', 10, 8, 0, rot=(0, sx * 0.35, 0)))
    # yeux : blanc, iris foncé, paupière supérieure (peau) qui recouvre le haut de l'œil
    for ex, ey in eyes:
        parts.append(ellipsoid('EyeW', (ex, HY + ey, 0.083), (0.0155, 0.0125, 0.01), 'EyeWhite', 12, 8))
        parts.append(ellipsoid('Iris', (ex * 0.97, HY + ey - 0.0005, 0.0925), (0.0078, 0.0082, 0.0035), 'Pupil', 10, 6))
        lid = ellipsoid('Lid', (ex, HY + ey + 0.004, 0.0838), (0.0172, 0.0105, 0.0112), 'Skin', 12, 8, rot=(0.35, 0, 0))
        parts.append(lid)
        # sourcil : petite courbe de poils
        sx = 1 if ex > 0 else -1
        parts.append(skin('Brow', [(ex - sx * 0.016, HY + ey + 0.026, 0.094, 0.0045, 0.003), (ex, HY + ey + 0.031, 0.099, 0.005, 0.0035), (ex + sx * 0.017, HY + ey + 0.027, 0.093, 0.0035, 0.0025)],
                          chain(3), 'Hair', 1))
    # lèvres : supérieure et inférieure, légèrement arquées
    parts.append(skin('LipU', [(-0.022, HY - 0.052, 0.088, 0.004), (0, HY - 0.049, 0.097, 0.0058, 0.005), (0.022, HY - 0.052, 0.088, 0.004)], chain(3), 'Mouth', 1))
    parts.append(skin('LipL', [(-0.018, HY - 0.058, 0.088, 0.004), (0, HY - 0.061, 0.095, 0.0065, 0.0055), (0.018, HY - 0.058, 0.088, 0.004)], chain(3), 'Mouth', 1))
    return parts

# =====================================================================
# TRONC
# =====================================================================
def build_body():
    parts = []
    # buste (chemise) : bassin → taille → poitrine → épaules → base du cou
    shirt = skin('Torso', [(0, 0.95, 0.0, 0.14, 0.096), (0, 1.0, 0.0, 0.146, 0.1), (0, 1.08, 0.004, 0.142, 0.098), (0, 1.2, 0.01, 0.152, 0.105),
                           (0, 1.3, 0.008, 0.164, 0.11), (0, 1.39, 0.0, 0.168, 0.1), (0, 1.445, -0.004, 0.12, 0.08), (0, 1.47, -0.004, 0.055, 0.05)],
                 chain(8), 'Shirt', 2)
    parts.append(shirt)
    # bassin (pantalon)
    # (le bassin englobe le haut des cuisses : pas de bord visible quand les jambes bougent)
    parts.append(skin('Hips', [(0, 0.8, 0.0, 0.15, 0.1), (0, 0.87, 0.0, 0.172, 0.112), (0, 0.95, 0.0, 0.158, 0.106), (0, 1.0, 0.0, 0.142, 0.096)], chain(4), 'Pants', 2))
    # ceinture + boucle, col (accent)
    parts.append(torus('Belt', (0, 0.995, 0.0), 0.146, 0.012, 'Belt', sz=0.68))
    b = ellipsoid('Buckle', (0, 1.0, 0.1), (0.018, 0.013, 0.005), 'Accent', 10, 8)
    parts.append(b)
    parts.append(torus('Collar', (0, 1.458, 0.006), 0.047, 0.011, 'Accent', sz=0.92, tilt=0.35))
    # cou
    parts.append(skin('Neck', [(0, 1.44, -0.004, 0.044, 0.042), (0, 1.53, 0.0, 0.041, 0.04), (0, 1.58, 0.01, 0.04, 0.038)], chain(3), 'Skin', 1))
    parts += build_head()
    return join('Body', parts, (0, 0, 0))

# =====================================================================
# JAMBES
# =====================================================================
def build_legs():
    out = []
    for side, sx in (('L', 1), ('R', -1)):
        x = sx * 0.082
        thigh = skin('Thigh', [(x, 0.9, 0.0, 0.062), (x, 0.8, 0.006, 0.078), (x, 0.66, 0.004, 0.074), (x, 0.5, 0.0, 0.061), (x, 0.43, 0.0, 0.058)], chain(5), 'Pants', 1)
        out.append(join('Leg' + side, [thigh], (x, 0.92, 0)))
        shin = skin('ShinP', [(x, 0.53, 0.0, 0.058), (x, 0.46, 0.0, 0.06), (x, 0.4, -0.006, 0.059), (x, 0.3, -0.01, 0.058), (x, 0.17, -0.004, 0.05), (x, 0.085, 0.0, 0.053)], chain(6), 'Pants', 1)
        # chaussure : talon → cou-de-pied → pointe, semelle plate en dessous
        shoe = skin('Shoe', [(x, 0.055, -0.04, 0.045, 0.04), (x, 0.065, 0.02, 0.05, 0.045), (x, 0.048, 0.085, 0.046, 0.03), (x, 0.04, 0.125, 0.038, 0.022)], chain(4), 'Shoes', 1)
        sole = skin('Sole', [(x, 0.012, -0.055, 0.047, 0.012), (x, 0.012, 0.04, 0.052, 0.012), (x, 0.012, 0.13, 0.04, 0.01)], chain(3), 'Sole', 1)
        out.append(join('Shin' + side, [shin, shoe, sole], (x, 0.46, 0)))
    return out

# =====================================================================
# BRAS ET MAINS
# =====================================================================
def build_arms():
    out = []
    for side, sx in (('L', 1), ('R', -1)):
        x = sx * 0.2
        sleeve = skin('Sleeve', [(x - sx * 0.01, 1.455, 0.0, 0.05), (x, 1.41, 0.0, 0.062), (x, 1.33, 0.0, 0.06), (x, 1.27, 0.0, 0.058)], chain(4), 'Shirt', 1)
        upper = skin('Upper', [(x, 1.32, 0.0, 0.044), (x, 1.2, 0.0, 0.041), (x, 1.13, 0.0, 0.038), (x, 1.095, 0.0, 0.035)], chain(4), 'Skin', 1)
        out.append(join('Arm' + side, [sleeve, upper], (x, 1.42, 0)))
        fore = skin('Fore', [(x, 1.17, 0.0, 0.035), (x, 1.13, 0.0, 0.038), (x, 1.06, 0.006, 0.037, 0.034), (x, 0.96, 0.004, 0.03, 0.026), (x, 0.9, 0.0, 0.025, 0.02)], chain(5), 'Skin', 1)
        # main : poignet, paume (aplatie, tournée vers le corps), 4 doigts en 3 phalanges un peu repliés, pouce vers l'avant
        pts = [(x, 0.9, 0.0, 0.022, 0.018), (x, 0.865, 0.004, 0.014, 0.034), (x, 0.83, 0.006, 0.013, 0.036)]
        edges = [(0, 1), (1, 2)]
        for k in range(4):
            z = 0.026 - k * 0.0165
            ln = 1.0 - abs(k - 1.2) * 0.12
            base = len(pts)
            pts += [(x - sx * 0.001, 0.805, z, 0.0085), (x - sx * 0.004, 0.78 - 0.002 * ln, z + 0.001, 0.0078),
                    (x - sx * 0.009, 0.757 - 0.01 * ln, z + 0.002, 0.0072), (x - sx * 0.014, 0.74 - 0.014 * ln, z + 0.002, 0.0066)]
            edges += [(2, base), (base, base + 1), (base + 1, base + 2), (base + 2, base + 3)]
        tb = len(pts)
        pts += [(x - sx * 0.006, 0.86, 0.03, 0.011), (x - sx * 0.012, 0.835, 0.048, 0.0095), (x - sx * 0.016, 0.815, 0.058, 0.0085)]
        edges += [(1, tb), (tb, tb + 1), (tb + 1, tb + 2)]
        hand = skin('Hand', pts, edges, 'Skin', 1)
        out.append(join('Forearm' + side, [fore, hand], (x, 1.13, 0)))
    return out

# =====================================================================
# COIFFURES
# =====================================================================
def hair_shell(name, scale=1.0, front=0.05, back=-0.07, volume=1.0, tufts=0):
    """Calotte de cheveux : ellipsoïde un peu plus grand que la tête, coupé par un plan incliné
    (bord haut sur le front, bas dans la nuque), trou rebouché à l'intérieur de la tête."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=36, v_segments=22, radius=1)
    rx, ry, rz = 0.1 * scale * volume, 0.124 * scale * volume, 0.112 * scale * volume
    kill = []
    for v in bm.verts:
        x, y, z = v.co.x, v.co.z, -v.co.y
        X, Y, Z = x * rx, y * ry, z * rz
        if z < 0:
            Z *= 1.04
        # limite des cheveux : sur le front à `front`, dans la nuque à `back`, sur les côtés au-dessus des oreilles
        lim = back + (front - back) * max(0.0, min(1.0, z * 0.5 + 0.5)) ** 1.4
        if abs(x) > 0.75 and z > -0.3:
            lim = max(lim, 0.015)
        if Y < lim:
            kill.append(v)
        # mèches : petites bosses régulières
        if tufts and Y > lim:
            n = math.sin(x * 23 + z * 7) * math.sin(y * 19 + x * 5) * math.sin(z * 17 + y * 3)
            k = 1 + tufts * n
            X *= k; Y = Y * (1 + tufts * 0.5 * n); Z *= k
        v.co = B(X, HY + 0.006 + Y, -0.004 + Z)
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    edges = [e for e in bm.edges if e.is_boundary]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me))
    return finish(o, 'Hair')

def build_hair():
    out = []
    # courts : calotte + mèche sur le front (coiffée sur le côté)
    short = hair_shell('Short', front=0.058, back=-0.05, tufts=0.025)
    fringe = skin('Fringe', [(0.05, HY + 0.085, 0.07, 0.022, 0.014), (0.0, HY + 0.09, 0.086, 0.024, 0.014), (-0.05, HY + 0.075, 0.075, 0.016, 0.01)], chain(3), 'Hair', 1)
    out.append(join('HairShort', [short, fringe], (0, 0, 0)))
    # longs : calotte + chevelure qui tombe dans le dos et sur les épaules, mèches de chaque côté du visage
    shell = hair_shell('LongTop', front=0.06, back=-0.1, volume=1.03)
    backh = skin('LongBack', [(0, HY + 0.05, -0.06, 0.1, 0.06), (0, HY - 0.07, -0.075, 0.105, 0.05), (0, HY - 0.2, -0.07, 0.1, 0.04), (0, HY - 0.27, -0.06, 0.08, 0.03)], chain(4), 'Hair', 1)
    locks = [skin('Lock', [(sx * 0.088, HY + 0.04, 0.02, 0.024, 0.03), (sx * 0.095, HY - 0.06, 0.012, 0.022, 0.028), (sx * 0.1, HY - 0.16, 0.0, 0.016, 0.02)], chain(3), 'Hair', 1) for sx in (-1, 1)]
    out.append(join('HairLong', [shell, backh] + locks, (0, 0, 0)))
    # chignon : calotte lisse + boule en haut à l'arrière
    bshell = hair_shell('BunTop', front=0.062, back=-0.06)
    bun = ellipsoid('Bun', (0, HY + 0.1, -0.085), (0.048, 0.044, 0.048), 'Hair', 18, 12, 1)
    out.append(join('HairBun', [bshell, bun], (0, 0, 0)))
    # bouclés : calotte bombée et bosselée
    curly = hair_shell('Curly', front=0.045, back=-0.07, volume=1.12, tufts=0.06)
    out.append(join('HairCurly', [curly], (0, 0, 0)))
    # casquette : calotte, visière, bouton (avec les cheveux courts dessous)
    dome = hair_shell('CapDome', scale=1.06, front=0.035, back=0.0, volume=1.0)
    finish(dome, 'CapColor')
    brim = skin('Brim', [(0, HY + 0.045, 0.1, 0.085, 0.006), (0, HY + 0.04, 0.165, 0.075, 0.005)], chain(2), 'CapColor', 1)
    btn = ellipsoid('Btn', (0, HY + 0.14, -0.005), (0.012, 0.008, 0.012), 'CapColor', 10, 8)
    out.append(join('Cap', [dome, brim, btn], (0, 0, 0)))
    return out

# =====================================================================
parts = [build_body()] + build_legs() + build_arms() + build_hair()
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts)
print('triangles:', tris)
for o in parts:
    print(' ', o.name, sum(len(p.vertices) - 2 for p in o.data.polygons))

if OUT:
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_texcoords=False, export_materials='EXPORT')
    print('exported', OUT, os.path.getsize(OUT))
