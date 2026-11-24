import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };
import { LANG } from './i18n.js';

/**
 * Fusionne tous les objets immobiles d'un groupe en un seul maillage par matériau
 * (des centaines d'appels de dessin deviennent une vingtaine).
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    groups.get(key).geos.push(g);
  });
  const out = new THREE.Group();
  for (const { mat, cast, recv, geos } of groups.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = cast; m.receiveShadow = recv;
    out.add(m);
  }
  return out;
}

/** Générateur pseudo-aléatoire déterministe (le décor est identique à chaque partie). */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, { srgb = true, rep = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

export function speckle(g, w, h, n, alpha, rand = Math.random) {
  for (let i = 0; i < n; i++) {
    const s = rand() * 2.5 + 0.5;
    g.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rand() * alpha})`;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

function col(c) {
  const k = new THREE.Color(c);
  const h = {}; k.getHSL(h); k.setHSL(h.h, Math.min(1, h.s * 1.05), h.l);
  return k;
}

const cache = new Map();
/**
 * Matériau PBR du style « semi-réaliste ».
 * Options : r (rugosité), m (métal), cc (vernis), map, emissive, emap, ei, transparent, opacity, cached.
 */
export function M(c, o = {}) {
  const key = o.cached ? c + JSON.stringify({ ...o, map: undefined }) : null;
  if (key && cache.has(key)) return cache.get(key);
  const Mat = o.cc ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat({
    color: col(c), roughness: o.r ?? 0.6, metalness: o.m ?? 0, map: o.map || null,
    emissive: o.emissive ? col(o.emissive) : 0x000000, emissiveMap: o.emap || null,
    emissiveIntensity: o.ei ?? 1, envMapIntensity: 0.7,
    transparent: !!o.transparent, opacity: o.opacity ?? 1,
  });
  if (o.cc) { m.clearcoat = 0.6; m.clearcoatRoughness = 0.12; }
  if (key) cache.set(key, m);
  return m;
}

export const add = (mesh, x = 0, y = 0, z = 0, parent) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
export const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, r), mat);
export const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
export const cyl = (rt, rb, h, mat, seg = 40) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
export const sph = (r, mat, ws = 36, hs = 24) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);

export function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

/** Formatage des montants : 950 · 12 480 · 1,25 M · 3,4 Md … */
// (anglais : échelle courte des jeux idle — M, B, T, Qa, Qi…)
const SUFFIX = LANG === 'fr'
  ? ['', '', ' M', ' Md', ' B', ' Bd', ' T', ' Td', ' Qa', ' Qd', ' Qi', ' Qid', ' Sx', ' Sxd']
  : ['', '', ' M', ' B', ' T', ' Qa', ' Qi', ' Sx', ' Sp', ' Oc', ' No', ' Dc', ' Ud', ' Dd'];
const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-US';
/** Une somme d'argent : « 12 M $ » en français, « $12 M » en anglais. */
export const money = (n) => (LANG === 'fr' ? `${fmt(n)} $` : `$${fmt(n)}`);
/** Un nombre à virgule : « 2,58 » / « 2.58 ». */
export const dec = (x, d = 2) => (LANG === 'fr' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1e6) return n.toLocaleString(LOCALE).replace(/ | /g, ' ');
  const e = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / 10 ** (e * 3);
  return v.toLocaleString(LOCALE, { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 }) + SUFFIX[e];
}

export function fmtDuration(s) {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min`;
  return `${s} s`;
}
