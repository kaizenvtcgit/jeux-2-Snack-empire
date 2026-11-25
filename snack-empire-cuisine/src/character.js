import { THREE } from './util.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * Personnage (clients et cuisinier), construit ici au lieu du modèle Blender customer.glb :
 * même articulation que l'ancien modèle (mêmes noms et mêmes pivots), donc les animations de marche,
 * de file d'attente et de repas assis restent valables.
 *
 *   Body           tronc, cou, tête, visage (pivot au sol)
 *   LegL / LegR    cuisse, pivot à la hanche (±0,082 ; 0,92)
 *   ShinL / ShinR  jambe et chaussure, pivot au genou (±0,082 ; 0,46)
 *   ArmL / ArmR    manche et bras, pivot à l'épaule (±0,2 ; 1,42)
 *   ForearmL / ForearmR   avant-bras et main, pivot au coude (±0,2 ; 1,13)
 *   HairShort / HairLong / Cap   coiffures (une seule visible à la fois)
 *
 * Le personnage regarde vers +z. Chaque morceau porte le nom de son « emplacement de couleur »
 * (Skin, Shirt, Pants…) : le jeu en fait une seule texture-palette par client (voir models.js).
 */

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Surface de révolution autour de l'axe vertical : pts = [[rayon, y], …] de haut en bas ou de bas en haut. */
function lathe(pts, seg = 20) {
  const prof = pts.map(([r, y]) => new THREE.Vector2(r, y));
  if (prof[0].y > prof[prof.length - 1].y) prof.reverse();
  // couture du tour placée à l'arrière, puis soudée (sinon une ligne d'ombre coupe le visage en deux)
  let g = new THREE.LatheGeometry(prof, seg, Math.PI);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  return g;
}

/** Applique position / rotation / échelle directement à la géométrie (le jeu ignore la transformation des morceaux). */
function xf(geo, { p = V(0, 0, 0), r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(...s));
  geo.applyMatrix4(m);
  return geo;
}

const sphere = (r, ws = 18, hs = 12, phi0 = 0, phiL = Math.PI * 2, th0 = 0, thL = Math.PI) => new THREE.SphereGeometry(r, ws, hs, phi0, phiL, th0, thL);
const capsule = (r, len, cs = 4, rs = 10) => new THREE.CapsuleGeometry(r, len, cs, rs);

/** Un nœud (groupe placé au pivot) contenant des morceaux colorés. */
function node(name, pos = V(0, 0, 0)) {
  const g = new THREE.Group();
  g.name = name;
  g.position.copy(pos);
  return g;
}
function piece(parent, slot, geo) {
  const mat = new THREE.MeshStandardMaterial();
  mat.name = slot;
  parent.add(new THREE.Mesh(geo, mat));
}

export function buildCharacter() {
  const root = new THREE.Group();

  /* ---------- Tronc, cou, tête ---------- */
  const body = node('Body');
  // bassin et ceinture
  piece(body, 'Pants', xf(lathe([[0.05, 0.875], [0.13, 0.9], [0.152, 0.95], [0.148, 1.0]]), { s: [1, 1, 0.66] }));
  piece(body, 'Belt', xf(new THREE.TorusGeometry(0.149, 0.013, 6, 28), { p: V(0, 1.0, 0), r: [Math.PI / 2, 0, 0], s: [1, 0.66, 1] }));
  piece(body, 'Belt', xf(new THREE.BoxGeometry(0.035, 0.028, 0.01), { p: V(0, 1.0, 0.1) }));
  // buste (chemise / t-shirt) : un peu cintré, épaules arrondies
  piece(body, 'Shirt', xf(lathe([[0.146, 0.99], [0.144, 1.08], [0.152, 1.18], [0.165, 1.29], [0.168, 1.36], [0.15, 1.42], [0.1, 1.455], [0.05, 1.47]], 24), { s: [1, 1, 0.62] }));
  // col (couleur d'accent)
  piece(body, 'Accent', xf(new THREE.TorusGeometry(0.052, 0.013, 6, 20), { p: V(0, 1.455, 0.006), r: [Math.PI / 2 - 0.25, 0, 0], s: [1, 0.85, 1] }));
  // cou
  piece(body, 'Skin', xf(new THREE.CylinderGeometry(0.041, 0.046, 0.12, 14), { p: V(0, 1.49, 0) }));
  // crâne + mâchoire (menton), oreilles, nez
  // tête d'un seul tenant (forme d'œuf : mâchoire plus étroite que le crâne), pour éviter les raccords
  piece(body, 'Skin', xf(lathe([[0.001, 1.518], [0.042, 1.524], [0.066, 1.538], [0.083, 1.565], [0.094, 1.6], [0.101, 1.645], [0.1, 1.69], [0.09, 1.725], [0.065, 1.752], [0.03, 1.766], [0.001, 1.769]], 28), { p: V(0, 0, 0.004), s: [1, 1, 1.07] }));
  for (const sx of [-1, 1]) {
    piece(body, 'Skin', xf(sphere(0.026, 12, 10), { p: V(sx * 0.099, 1.632, -0.005), s: [0.45, 1, 0.75] }));
  }
  piece(body, 'Skin', xf(sphere(0.018, 14, 10), { p: V(0, 1.612, 0.104), s: [0.75, 1.25, 1.0], r: [-0.25, 0, 0] }));
  // yeux (blanc + pupille), sourcils, bouche
  for (const sx of [-1, 1]) {
    // (posés à fleur du visage : la tête mesure 0,107 vers l'avant à hauteur des yeux)
    piece(body, 'EyeWhite', xf(sphere(0.0165, 16, 12), { p: V(sx * 0.038, 1.65, 0.098), s: [1.05, 0.8, 0.6] }));
    piece(body, 'Pupil', xf(sphere(0.0095, 12, 10), { p: V(sx * 0.037, 1.649, 0.1062), s: [1, 1, 0.45] }));
    piece(body, 'Hair', xf(capsule(0.006, 0.03, 3, 6), { p: V(sx * 0.04, 1.682, 0.104), r: [0, 0, Math.PI / 2 + sx * 0.12] }));
  }
  piece(body, 'Mouth', xf(capsule(0.007, 0.028, 3, 8), { p: V(0, 1.572, 0.093), r: [0, 0, Math.PI / 2], s: [1, 1, 0.8] }));
  root.add(body);

  /* ---------- Jambes : cuisse (pivot à la hanche) + jambe et chaussure (pivot au genou) ---------- */
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const thigh = node('Leg' + side, V(sx * 0.082, 0.92, 0));
    piece(thigh, 'Pants', lathe([[0.088, 0.04], [0.084, -0.08], [0.073, -0.3], [0.062, -0.44], [0.058, -0.48]]));
    piece(thigh, 'Pants', xf(sphere(0.059, 14, 10), { p: V(0, -0.46, 0) }));
    root.add(thigh);
    const shin = node('Shin' + side, V(sx * 0.082, 0.46, 0)); // genou
    piece(shin, 'Pants', lathe([[0.058, 0.02], [0.059, -0.07], [0.054, -0.24], [0.05, -0.37], [0.052, -0.385]]));
    piece(shin, 'Shoes', xf(sphere(0.05, 16, 10), { p: V(0, -0.418, 0.035), s: [1, 0.78, 2.35] }));
    piece(shin, 'Shoes', xf(new THREE.CylinderGeometry(0.044, 0.05, 0.05, 14), { p: V(0, -0.39, -0.005) }));
    piece(shin, 'Sole', xf(new THREE.BoxGeometry(0.1, 0.018, 0.25), { p: V(0, -0.451, 0.035) }));
    root.add(shin);
  }

  /* ---------- Bras : manche et bras (pivot à l'épaule) + avant-bras et main (pivot au coude) ---------- */
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const arm = node('Arm' + side, V(sx * 0.2, 1.42, 0)); // (pivot identique à l'ancien modèle)
    // manche : dessus arrondi (épaule), un peu plus large en bas
    piece(arm, 'Shirt', lathe([[0.012, 0.045], [0.04, 0.036], [0.054, 0.012], [0.058, -0.04], [0.057, -0.13], [0.058, -0.17]]));
    piece(arm, 'Skin', lathe([[0.043, -0.15], [0.041, -0.22], [0.037, -0.29]], 16));
    piece(arm, 'Skin', xf(sphere(0.037, 14, 10), { p: V(0, -0.29, 0) }));
    root.add(arm);
    const fore = node('Forearm' + side, V(sx * 0.2, 1.13, 0)); // coude
    piece(fore, 'Skin', lathe([[0.037, 0.0], [0.036, -0.07], [0.03, -0.21], [0.027, -0.235]], 16));
    // main : paume aplatie (tournée vers le corps), quatre doigts légèrement repliés, pouce vers l'avant
    piece(fore, 'Skin', xf(sphere(0.03, 14, 10), { p: V(0, -0.275, 0.006), s: [0.62, 1.2, 1.12] }));
    for (let k = 0; k < 4; k++) {
      const z = 0.026 - k * 0.0135;
      piece(fore, 'Skin', xf(capsule(0.0078, 0.032 - Math.abs(k - 1.5) * 0.004, 3, 6), { p: V(-sx * 0.002, -0.328, z), r: [0.15, 0, sx * 0.08] }));
    }
    piece(fore, 'Skin', xf(capsule(0.0085, 0.026, 3, 6), { p: V(-sx * 0.012, -0.276, 0.042), r: [0.7, 0, -sx * 0.3] }));
    root.add(fore);
  }

  /* ---------- Coiffures ---------- */
  // cheveux courts : calotte qui descend plus bas à l'arrière
  const short = node('HairShort');
  // (calotte inclinée : bord à 1,70 m sur le front, vers 1,60 m dans la nuque ; nettement plus grande que le crâne)
  piece(short, 'Hair', xf(sphere(0.11, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.533), { p: V(0, 1.665, -0.006), r: [-0.41, 0, 0], s: [1.05, 1.2, 1.1] }));
  for (const sx of [-1, 1]) piece(short, 'Hair', xf(sphere(0.03, 10, 8), { p: V(sx * 0.095, 1.665, -0.02), s: [0.5, 1.2, 1] }));
  root.add(short);
  // cheveux longs : même calotte + chevelure dans le dos et sur les côtés
  const long = node('HairLong');
  piece(long, 'Hair', xf(sphere(0.112, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.533), { p: V(0, 1.665, -0.006), r: [-0.41, 0, 0], s: [1.07, 1.2, 1.12] }));
  piece(long, 'Hair', xf(lathe([[0.105, 1.68], [0.112, 1.6], [0.105, 1.5], [0.09, 1.4], [0.06, 1.36]], 20), { p: V(0, 0, -0.035), s: [1, 1, 0.75] }));
  for (const sx of [-1, 1]) piece(long, 'Hair', xf(capsule(0.03, 0.14, 4, 8), { p: V(sx * 0.09, 1.56, 0.01), r: [0.1, 0, sx * 0.08] }));
  root.add(long);
  // casquette : calotte, visière, bouton
  const cap = node('Cap');
  piece(cap, 'CapColor', xf(sphere(0.115, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: V(0, 1.675, -0.004), r: [-0.12, 0, 0], s: [1.04, 1.0, 1.08] }));
  piece(cap, 'CapColor', xf(new THREE.CylinderGeometry(0.085, 0.085, 0.008, 20, 1, false, -Math.PI / 2, Math.PI), { p: V(0, 1.68, 0.095), r: [0.12, 0, 0], s: [1, 1, 1.15] }));
  piece(cap, 'CapColor', xf(sphere(0.012, 8, 6), { p: V(0, 1.788, -0.014) }));
  root.add(cap);

  return root;
}
