import { THREE } from './util.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Modèles 3D faits dans Blender (scripts dans tools/blender/). */
export const MODELS = { truck: null, customer: null };

/** Emplacements de la palette des clients (1 texel par matériau Blender). */
export const PALETTE_SLOTS = ['Skin', 'Shirt', 'Pants', 'Shoes', 'Hair', 'CapColor', 'EyeWhite', 'Pupil', 'Mouth', 'Sole'];
const CUSTOMER_PARTS = ['Body', 'LegL', 'LegR', 'ArmL', 'ArmR', 'HairShort', 'HairLong', 'Cap'];

export async function loadModels() {
  const loader = new GLTFLoader();
  const url = (f) => new URL('models/' + f, document.baseURI).href;
  const [truck, customer] = await Promise.all([loader.loadAsync(url('food_truck.glb')), loader.loadAsync(url('customer.glb'))]);
  MODELS.truck = truck.scene;
  MODELS.customer = bakeCustomer(customer.scene);
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
    if (!node) throw new Error('Partie manquante dans customer.glb : ' + name);
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
    out.add(part);
  }
  return out;
}
