import { THREE } from './util.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCharacter } from './character.js';

/** Modèles 3D faits dans Blender (scripts dans tools/blender/). */
export const MODELS = { truck: null, truckOpen: null, customer: null };

/** Emplacements de la palette des clients (1 texel par matériau Blender). */
export const PALETTE_SLOTS = ['Skin', 'Shirt', 'Pants', 'Shoes', 'Hair', 'CapColor', 'EyeWhite', 'Pupil', 'Mouth', 'Sole', 'Accent', 'Belt'];
export const HAIR_STYLES = ['HairShort', 'HairLong', 'HairBun', 'HairCurly'];
const CUSTOMER_PARTS = ['Body', 'LegL', 'LegR', 'ShinL', 'ShinR', 'ArmL', 'ArmR', 'ForearmL', 'ForearmR', ...HAIR_STYLES, 'Cap'];

/** Charge les modèles ; onProgress(0 → 1) suit le téléchargement (barre de l'écran de chargement). */
export async function loadModels(onProgress = () => {}) {
  const loader = new GLTFLoader();
  const url = (f) => new URL('models/' + f, document.baseURI).href;
  const done = [0, 0], size = [0, 0];
  const track = (k) => (e) => { if (e.total) { done[k] = e.loaded; size[k] = e.total; } const t = size[0] + size[1]; if (t) onProgress(Math.min(1, (done[0] + done[1]) / t)); };
  // personnages : modèle Blender (tools/blender/people.py) ; en secours, le modèle construit dans le jeu (character.js)
  // (camion n°1 : version creuse, fenêtre ouverte sur la cuisine où l'on voit travailler les cuisiniers)
  const [truck, people, open] = await Promise.all([loader.loadAsync(url('food_truck.glb'), track(0)), loader.loadAsync(url('people.glb'), track(1)).catch(() => null), loader.loadAsync(url('food_truck_open.glb')).catch(() => null)]);
  onProgress(1);
  MODELS.truck = truck.scene;
  MODELS.truckOpen = open ? open.scene : null;
  MODELS.customer = bakeCustomer(people ? people.scene : buildCharacter());
}

/**
 * Fusionne chaque partie du client en une seule géométrie dont les UV pointent
 * vers une case de palette : un client = 1 matériau = ~6 appels de dessin.
 */
function bakeCustomer(scene) {
  const out = new THREE.Group();
  const n = PALETTE_SLOTS.length;
  for (const name of CUSTOMER_PARTS) {
    const node = scene.getObjectByName(name);
    if (!node) { if (name.startsWith('Hair')) continue; throw new Error('Partie manquante dans le modèle des personnages : ' + name); }
    const meshes = node.isMesh ? [node] : node.children.filter((c) => c.isMesh);
    const geos = meshes.map((m) => {
      const g = new THREE.BufferGeometry();
      g.setIndex(m.geometry.index.clone());
      g.setAttribute('position', m.geometry.attributes.position.clone());
      g.setAttribute('normal', m.geometry.attributes.normal.clone());
      const slot = Math.max(0, PALETTE_SLOTS.indexOf(m.material.name));
      const count = g.attributes.position.count;
      const uv = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) { uv[i * 2] = (slot + 0.5) / n; uv[i * 2 + 1] = 0.5; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      return g;
    });
    const part = new THREE.Mesh(mergeGeometries(geos), null);
    part.name = name;
    part.position.copy(node.position);
    // jambes : version « assise », genou plié (la jambe d'origine est droite, sans articulation)
    // (les genoux sont de vraies articulations : plus besoin d'une jambe « assise » pliée à l'avance)
    out.add(part);
  }
  return out;
}

/**
 * Plie le genou d'une jambe (repère de la hanche, jambe vers le bas) : tout ce qui est sous le genou
 * tourne autour de l'axe du genou, avec une transition douce pour que la jambe reste d'un seul tenant.
 * Avec la cuisse levée à l'horizontale (rotation x ≈ -1,4), le mollet redescend alors à la verticale.
 */
function bendKnee(geo, angle = 1.45) {
  const g = geo.clone();
  g.computeBoundingBox();
  const top = g.boundingBox.max.y, bottom = g.boundingBox.min.y;
  const kneeY = top + (bottom - top) * 0.5, band = 0.07;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), axis = new THREE.Vector3(1, 0, 0);
  const knee = new THREE.Vector3(0, kneeY, -0.02);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.smoothstep(kneeY + band - v.y, 0, 2 * band); // 0 au-dessus du genou, 1 en dessous
    if (t <= 0) continue;
    q.setFromAxisAngle(axis, angle * t);
    v.sub(knee).applyQuaternion(q).add(knee);
    pos.setXYZ(i, v.x, v.y, v.z);
    n.fromBufferAttribute(nor, i).applyQuaternion(q);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}
