import { THREE, M, add, rbox, box, cyl, sph, canvasTex, speckle, shadows, rng, mergeStatic } from './util.js';
import { L } from './i18n.js';

/*
 * Niveau 5 : la fête foraine, devant le marché couvert.
 * - buildFairDecor() : terrain, grande roue, carrousel, guirlandes, arche d'entrée (apparaît à l'ouverture).
 * - buildFairStand(k) : un stand forain (même encombrement qu'un camion → même file, tables, service).
 * - FAIR_BULBS : les ampoules de la fête, qui brillent plus fort la nuit.
 */

/*
 * Disposition : on entre par l'arche depuis la promenade du marché (z ≈ 34,6). Les stands sont
 * éparpillés sur le terrain, chacun tourné dans son sens, comme dans une vraie fête ; les clients
 * se faufilent entre eux (voir fairnav.js). Au bout du terrain, un ponton en bois s'avance sur l'eau
 * jusqu'à la grande roue. Manèges : auto-tamponneuses, carrousel, chaises volantes.
 */
export const ENTRY_X = 47;
export const PROM_Z = 34.6;
export const FAIR = { x0: 11, x1: 112, z0: 36, z1: 88 };
/** Montagne russe, sur l'extension à droite du terrain (zone interdite aux promeneurs : COASTER_AREA). */
export const COASTER = new THREE.Vector3(97, 0, 63);
export const COASTER_AREA = [COASTER.x - 14.5, COASTER.x + 12, COASTER.z - 18, COASTER.z + 20];
/** Bord de mer devant la ville (quai) et ponton vers la grande roue. */
export const SEA_Z = 88;
const PX = 47;
export const PIER = { x0: PX - 3, x1: PX + 3, z0: SEA_Z, z1: 111, px0: PX - 10, px1: PX + 10, pz1: 127, y: 0.3 };
export const WHEEL = new THREE.Vector3(PX, PIER.y, 120);
export const CAROUSEL = new THREE.Vector3(26, 0, 78);
export const BUMPERS = new THREE.Vector3(22, 0, 50);
export const SWINGER = new THREE.Vector3(72, 0, 47);
export const BOOTH = new THREE.Vector3(56, 0, 37.2);
/**
 * 8 emplacements éparpillés (tirés au hasard une fois pour toutes, sans chevauchement :
 * baraque, tables, file d'attente). Du plus proche de l'entrée au plus loin.
 */
export const FAIR_SLOTS = [
  { x: 38.9, z: 42.4, yaw: -1.46 }, { x: 48.8, z: 50.1, yaw: 0.13 }, { x: 38.4, z: 56.9, yaw: -1.14 }, { x: 41, z: 69.3, yaw: 0.19 },
  { x: 71.9, z: 59.1, yaw: -1.14 }, { x: 55.5, z: 71.5, yaw: 1.38 }, { x: 21.1, z: 63.4, yaw: 0.04 }, { x: 74.8, z: 72, yaw: 0.01 },
];
/** Position monde d'un point local d'un emplacement (même convention que Stand.toWorld). */
export function slotWorld(s, lx, lz) {
  const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return new THREE.Vector3(s.x + lx * c + lz * n, 0, s.z - lx * n + lz * c);
}
/** Mâts des guirlandes : deux derrière chaque stand. */
export const FAIR_MASTS = FAIR_SLOTS.flatMap((s, i) => [slotWorld(s, -3.0, -1.65), slotWorld(s, 2.0, -1.65)].map((p) => Object.assign(p, { slot: i })));

export const FAIR_TYPES = [
  { name: L('BARBE À PAPA', 'COTTON CANDY'), a: '#ff8fc7', b: '#ffffff', produce: 'cotton' },
  { name: L("POMMES D'AMOUR", 'CANDY APPLES'), a: '#d62828', b: '#ffffff', produce: 'apple' },
  { name: L('CHURROS', 'CHURROS'), a: '#f77f00', b: '#fff3b0', produce: 'churros' },
  { name: L('GAUFRES', 'WAFFLES'), a: '#f4c21d', b: '#7a4a1e', produce: 'waffle' },
  { name: L('POPCORN', 'POPCORN'), a: '#e63946', b: '#ffffff', produce: 'popcorn' },
  { name: L('HOT-DOGS GÉANTS', 'GIANT HOT DOGS'), a: '#2a6f97', b: '#ffd166', produce: 'hotdog' },
  { name: L('BEIGNETS', 'DONUTS'), a: '#9b5de5', b: '#ffffff', produce: 'donut' },
  { name: L('LIMONADE', 'LEMONADE'), a: '#ffd60a', b: '#06d6a0', produce: 'lemonade' },
];

/** Ampoules de la fête : plus lumineuses la nuit (voir setFairNight). */
export const FAIR_BULBS = new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffc56a', emissiveIntensity: 1.5, roughness: 0.3 });
const BULB_COLORS = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#ffffff'].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, roughness: 0.3 }));
export function setFairNight(n) {
  FAIR_BULBS.emissiveIntensity = 1.5 + n * 7;
  BULB_COLORS.forEach((m) => { m.emissiveIntensity = 1.2 + n * 6; });
}

/* ======================= Décor de la fête ======================= */
/**
 * pathFn(from, to) : trajet des clients (voir fairnav.js), pour user la pelouse là où ils marchent.
 * (passé en paramètre pour éviter une dépendance circulaire fair.js ↔ fairnav.js)
 */
export function buildFairDecor(pathFn = null) {
  const rand = rng(23);
  const root = new THREE.Group();
  const stat = new THREE.Group();
  const { x0, x1, z0, z1 } = FAIR;

  // Terrain de fête : pelouse un peu usée, avec des chemins de terre là où les gens marchent le plus
  const PPM = 28; // pixels par mètre
  const lawn = canvasTex(Math.round((x1 - x0) * PPM), Math.round((z1 - z0) * PPM), (g, w, h) => {
    const P = (x, z) => [(x - x0) * PPM, (z - z0) * PPM];
    // herbe : fond vert, taches plus claires / plus sèches, brins
    g.fillStyle = '#5f8a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const r = (2 + rand() * 6) * PPM, x = rand() * w, y = rand() * h;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = rand() < 0.5 ? '120,160,70' : rand() < 0.5 ? '80,120,50' : '150,150,80';
      gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 90000; i++) {
      const x = rand() * w, y = rand() * h, l = 3 + rand() * 6;
      g.strokeStyle = rand() < 0.5 ? 'rgba(40,80,25,0.35)' : 'rgba(160,200,100,0.3)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 3, y - l); g.stroke();
    }
    // terre piétinée : traits épais et irréguliers, bord adouci (plusieurs passages de plus en plus fins)
    const trail = (pts, width) => {
      if (pts.length < 2) return;
      for (const [k, a] of [[1.5, 0.18], [1.15, 0.35], [0.8, 0.6]]) {
        g.strokeStyle = `rgba(150,118,76,${a})`; g.lineWidth = width * k * PPM; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        pts.forEach((p, i) => { const [px, py] = P(p.x + (rand() - 0.5) * 0.4, p.z + (rand() - 0.5) * 0.4); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.stroke();
      }
    };
    const patch = (x, z, r, a = 0.7) => {
      const [px, py] = P(x, z), R = r * PPM;
      const gr = g.createRadialGradient(px, py, R * 0.3, px, py, R);
      gr.addColorStop(0, `rgba(150,118,76,${a})`); gr.addColorStop(1, 'rgba(150,118,76,0)');
      g.fillStyle = gr; g.fillRect(px - R, py - R, 2 * R, 2 * R);
    };
    const ringPatch = (c, r0, r1) => { for (let a = 0; a < Math.PI * 2; a += 0.35) patch(c.x + Math.cos(a) * (r0 + r1) / 2, c.z + Math.sin(a) * (r0 + r1) / 2, (r1 - r0) / 1.4 + 1, 0.45); };
    // entrée sous l'arche
    patch(ENTRY_X, z0 + 3, 7, 0.85);
    // de l'arche jusqu'à chaque stand, puis le long de sa file et jusqu'à ses tables
    const gate = new THREE.Vector3(ENTRY_X, 0, 38);
    FAIR_SLOTS.forEach((s) => {
      const approach = slotWorld(s, -3.75, 11.5);
      const route = pathFn ? [gate, ...pathFn(gate, approach)] : [gate, approach];
      trail(route, 2.2);
      trail([approach, slotWorld(s, -3.75, 4), slotWorld(s, -1, 2.9)], 1.6); // la file
      trail([slotWorld(s, 0.6, 3.6), slotWorld(s, 3.6, 3.6), slotWorld(s, 5.5, 5.6)], 1.4); // vers les tables
      patch(slotWorld(s, 5.5, 5.6).x, slotWorld(s, 5.5, 5.6).z, 2.6, 0.55);
      patch(slotWorld(s, -1, 3).x, slotWorld(s, -1, 3).z, 2.4, 0.6); // devant le comptoir
    });
    // autour des manèges (les gens regardent, font la queue)
    ringPatch(CAROUSEL, 4.4, 7);
    ringPatch(SWINGER, 3.6, 7);
    patch(BUMPERS.x, BUMPERS.z + 5, 3.5, 0.6);
    patch(BUMPERS.x - 6.5, BUMPERS.z, 2.5, 0.45);
    // bout du terrain, vers le ponton
    patch((PIER.x0 + PIER.x1) / 2, z1 - 2, 5, 0.7);
    // chemin jusqu'à la gare de la montagne russe, et piétinement devant son entrée
    const coasterIn = new THREE.Vector3(COASTER_AREA[0] - 1.2, 0, COASTER.z + 9);
    trail(pathFn ? [gate, ...pathFn(gate, coasterIn)] : [gate, coasterIn], 2.4);
    patch(coasterIn.x, coasterIn.z, 3.2, 0.75);
    // quelques confettis et tickets tombés par terre
    const cols = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#ffffff'];
    for (let i = 0; i < 1400; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(rand() * w, rand() * h, 3, 2); }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M('#ffffff', { map: lawn, r: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
  ground.receiveShadow = true;
  root.add(ground);

  // Guirlandes d'ampoules colorées tendues d'un mât à l'autre (derrière les stands), en toile d'araignée
  const poleM = M('#3a3a3a', { r: 0.5, m: 0.6, cached: true });
  const wireM = M('#1f1f1f', { r: 0.8, cached: true });
  const garland = (a, b, k0, sag = 1.2) => {
    const pts = [];
    for (let s = 0; s <= 32; s++) { const t = s / 32; const q = new THREE.Vector3().lerpVectors(a, b, t); q.y -= Math.sin(Math.PI * t) * sag; pts.push(q); }
    stat.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.014, 5), wireM));
    for (let s = 1; s < 32; s += 1) { const bulb = sph(0.1, BULB_COLORS[(s + k0) % BULB_COLORS.length], 8, 6); bulb.position.copy(pts[s]); bulb.position.y -= 0.09; bulb.userData.noShadow = true; stat.add(bulb); }
  };
  const mastH = 7;
  for (const m of FAIR_MASTS) {
    add(cyl(0.09, 0.12, mastH, poleM, 10), m.x, mastH / 2, m.z, stat);
    add(sph(0.22, FAIR_BULBS, 10, 8), m.x, mastH + 0.1, m.z, stat).userData.noShadow = true;
  }
  // chaque mât est relié à ses 2 plus proches voisins d'un autre stand (et aux mâts de son propre stand)
  const links = new Set();
  FAIR_MASTS.forEach((m, i) => {
    const near = FAIR_MASTS.map((o, j) => ({ j, d: o.distanceTo(m), o })).filter((e) => e.o.slot !== m.slot && e.d < 26).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const e of near) links.add(Math.min(i, e.j) + ':' + Math.max(i, e.j));
    if (i % 2 === 0) links.add(i + ':' + (i + 1));
  });
  [...links].forEach((key, k) => {
    const [a, b] = key.split(':').map(Number);
    const A = FAIR_MASTS[a], Bm = FAIR_MASTS[b];
    garland(new THREE.Vector3(A.x, mastH - 0.3, A.z), new THREE.Vector3(Bm.x, mastH - 0.3, Bm.z), k, Math.min(2, 0.4 + A.distanceTo(Bm) * 0.07));
  });

  // Barrières rayées autour du terrain (côtés et fond, en laissant l'entrée et le ponton libres)
  const fenceA = M('#e63946', { r: 0.6, cached: true }), fenceB = M('#ffffff', { r: 0.6, cached: true });
  const fenceRun = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 2);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2;
      const seg = rbox(len / n - 0.1, 0.9, 0.08, 0.03, k % 2 ? fenceA : fenceB);
      seg.position.set(cx, 0.55, cz); seg.rotation.y = Math.atan2(-(bz - az), bx - ax); stat.add(seg);
    }
  };
  fenceRun(x0, z0, x0, z1 - 0.5);
  fenceRun(x1, z0, x1, z1 - 0.5);

  // Petite cabine à tickets à l'entrée
  const booth = new THREE.Group();
  add(rbox(1.8, 2.2, 1.6, 0.06, M('#ffd166', { r: 0.6, cached: true })), 0, 1.1, 0, booth);
  add(rbox(1.2, 0.7, 0.05, 0.02, M('#2b3a55', { r: 0.2, cached: true })), 0, 1.5, 0.8, booth);
  add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 4), M('#e63946', { r: 0.6, cached: true })), 0, 2.7, 0, booth).rotation.y = Math.PI / 4;
  booth.position.copy(BOOTH);
  stat.add(booth);

  // Arche d'entrée « FÊTE FORAINE » côté marché, au début de l'allée
  const archTex = canvasTex(1024, 200, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff5d8f'); gr.addColorStop(0.5, '#ffd166'); gr.addColorStop(1, '#4cc9f0');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#3a2a60'; c.lineWidth = 10; c.font = '900 120px "Arial Black", Impact, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(L('FÊTE FORAINE', 'FUN FAIR'), w / 2, h / 2 + 6); c.fillText(L('FÊTE FORAINE', 'FUN FAIR'), w / 2, h / 2 + 6);
  });
  const archX = ENTRY_X, archZ = z0;
  for (const s of [-1, 1]) {
    add(cyl(0.3, 0.35, 7, M('#3a2a60', { r: 0.5, cached: true }), 14), archX + s * 6, 3.5, archZ, stat);
    add(sph(0.45, FAIR_BULBS, 12, 8), archX + s * 6, 7.2, archZ, stat).userData.noShadow = true;
  }
  add(rbox(13, 1.9, 0.3, 0.1, M('#ffffff', { map: archTex, emap: archTex, emissive: '#ffffff', ei: 0.4, r: 0.5 })), archX, 6.3, archZ, stat);
  for (let i = 0; i < 14; i++) { const b = sph(0.12, BULB_COLORS[i % BULB_COLORS.length], 8, 6); b.position.set(archX - 6.2 + i * 0.95, 7.35, archZ + 0.18); b.userData.noShadow = true; stat.add(b); }

  buildPier(stat);

  stat.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.noShadow; o.receiveShadow = true; } });
  root.add(mergeStatic(stat));

  // Grande roue (tourne), au bout du ponton
  const wheel = buildFerrisWheel();
  wheel.root.position.copy(WHEEL);
  root.add(wheel.root);
  // Carrousel (tourne, les chevaux montent et descendent)
  const carousel = buildCarousel();
  carousel.root.position.copy(CAROUSEL);
  root.add(carousel.root);
  // Auto-tamponneuses (les voitures tournent sur la piste)
  const bumpers = buildBumperCars();
  bumpers.root.position.copy(BUMPERS);
  root.add(bumpers.root);
  // Chaises volantes (les sièges s'écartent en tournant)
  const swinger = buildSwinger();
  swinger.root.position.copy(SWINGER);
  root.add(swinger.root);
  // Montagne russe (le train fait le tour, monte la côte, dévale les descentes)
  const coaster = buildCoaster();
  coaster.root.position.copy(COASTER);
  root.add(coaster.root);

  root.userData.update = (dt, t) => { wheel.update(dt, t); carousel.update(dt, t); bumpers.update(dt, t); swinger.update(dt, t); coaster.update(dt, t); };
  return root;
}

/** Ponton en bois sur pilotis, du quai jusqu'à la plateforme de la grande roue. */
function buildPier(stat) {
  const { x0, x1, z0, z1, px0, px1, pz1, y } = PIER;
  const plank = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a0764c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#94693f' : '#a87d52'; g.fillRect(0, i * h / 8, w, h / 8 - 3); g.fillStyle = '#5b3e22'; g.fillRect(0, (i + 1) * h / 8 - 3, w, 3); }
  }, { rep: [1, 1] });
  const deckM = (wx, wz) => { const t = plank.clone(); t.needsUpdate = true; t.repeat.set(wx / 3, wz / 3); return M('#ffffff', { map: t, r: 0.85 }); };
  // passerelle
  add(box(x1 - x0, 0.3, z1 - z0, deckM(x1 - x0, z1 - z0)), (x0 + x1) / 2, y - 0.15, (z0 + z1) / 2, stat);
  // plateforme de la grande roue
  add(box(px1 - px0, 0.3, pz1 - z1, deckM(px1 - px0, pz1 - z1)), (px0 + px1) / 2, y - 0.15, (z1 + pz1) / 2, stat);
  // pilotis
  const pileM = M('#5b4430', { r: 0.9, cached: true });
  for (let z = z0 + 3; z < z1; z += 4) for (const x of [x0 + 0.3, x1 - 0.3]) add(cyl(0.22, 0.25, 2.4, pileM, 8), x, y - 1.3, z, stat);
  for (let z = z1; z <= pz1; z += 4) for (let x = px0 + 0.4; x <= px1; x += 4.8) add(cyl(0.25, 0.28, 2.4, pileM, 8), x, y - 1.3, z, stat);
  // garde-corps blancs
  const railM = M('#f6f1e6', { r: 0.6, cached: true });
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), along = Math.abs(bx - ax) > Math.abs(bz - az);
    add(box(along ? len : 0.1, 0.1, along ? 0.1 : len, railM), (ax + bx) / 2, y + 1.0, (az + bz) / 2, stat);
    add(box(along ? len : 0.06, 0.06, along ? 0.06 : len, railM), (ax + bx) / 2, y + 0.55, (az + bz) / 2, stat);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) add(box(0.1, 1.0, 0.1, railM), ax + (bx - ax) * k / n, y + 0.5, az + (bz - az) * k / n, stat);
  };
  rail(x0, z0 + 0.6, x0, z1); rail(x1, z0 + 0.6, x1, z1);
  rail(px0, z1, x0, z1); rail(x1, z1, px1, z1);
  rail(px0, z1, px0, pz1); rail(px1, z1, px1, pz1); rail(px0, pz1, px1, pz1);
  // réverbères à globe le long du ponton
  const lampM = M('#2b2b33', { r: 0.4, m: 0.7, cached: true });
  const lamp = (x, z) => {
    add(cyl(0.06, 0.09, 3.4, lampM, 8), x, y + 1.7, z, stat);
    add(sph(0.26, FAIR_BULBS, 12, 8), x, y + 3.55, z, stat).userData.noShadow = true;
  };
  for (let z = z0 + 4; z < z1; z += 7) { lamp(x0 + 0.25, z); lamp(x1 - 0.25, z); }
  for (const [lx, lz] of [[px0 + 0.4, z1 + 0.4], [px1 - 0.4, z1 + 0.4], [px0 + 0.4, pz1 - 0.4], [px1 - 0.4, pz1 - 0.4]]) lamp(lx, lz);
  // guirlande au-dessus de la passerelle (de lampadaire en lampadaire)
  for (let z = z0 + 4; z + 7 < z1; z += 7) for (const x of [x0 + 0.25, x1 - 0.25]) {
    const pts = [];
    for (let s = 0; s <= 12; s++) { const t = s / 12; pts.push(new THREE.Vector3(x, y + 3.3 - Math.sin(Math.PI * t) * 0.5, z + 7 * t)); }
    for (let s = 1; s < 12; s++) { const b = sph(0.08, BULB_COLORS[s % BULB_COLORS.length], 6, 4); b.position.copy(pts[s]); b.userData.noShadow = true; stat.add(b); }
  }
  // cabine de la grande roue et bancs sur la plateforme
  const kiosk = new THREE.Group();
  add(rbox(2.2, 2.3, 1.8, 0.06, M('#4cc9f0', { r: 0.6, cached: true })), 0, 1.15, 0, kiosk);
  add(new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.0, 4), M('#ffffff', { r: 0.6, cached: true })), 0, 2.8, 0, kiosk).rotation.y = Math.PI / 4;
  kiosk.position.set(px0 + 3, y, z1 + 3);
  stat.add(kiosk);
  const benchM = M('#7a4a2a', { r: 0.8, cached: true });
  for (const bx of [px1 - 3.5, px0 + 3.5]) {
    add(box(2.2, 0.08, 0.5, benchM), bx, y + 0.5, pz1 - 1.4, stat);
    add(box(2.2, 0.5, 0.08, benchM), bx, y + 0.8, pz1 - 1.15, stat);
  }
}

/** Piste d'auto-tamponneuses couverte. */
function buildBumperCars() {
  const root = new THREE.Group();
  const W = 11, D = 8;
  add(rbox(W, 0.3, D, 0.08, M('#3a3f4a', { r: 0.35, m: 0.3, cached: true })), 0, 0.15, 0, root);
  add(rbox(W + 0.3, 0.45, 0.25, 0.08, M('#ffd166', { r: 0.5, cached: true })), 0, 0.4, D / 2, root);
  add(rbox(W + 0.3, 0.45, 0.25, 0.08, M('#ffd166', { r: 0.5, cached: true })), 0, 0.4, -D / 2, root);
  add(rbox(0.25, 0.45, D, 0.08, M('#ffd166', { r: 0.5, cached: true })), -W / 2, 0.4, 0, root);
  add(rbox(0.25, 0.45, D, 0.08, M('#ffd166', { r: 0.5, cached: true })), W / 2, 0.4, 0, root);
  const steel = M('#d8d8d8', { r: 0.35, m: 0.7, cached: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.12, 0.12, 4.2, steel, 8), sx * (W / 2 - 0.2), 2.4, sz * (D / 2 - 0.2), root);
  // toit à bandes + fronton lumineux
  const stripes = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#4361ee'; c.fillRect(i * w / 16, 0, w / 16, h); } });
  add(rbox(W + 0.6, 0.25, D + 0.6, 0.06, M('#ffffff', { map: stripes, r: 0.6 })), 0, 4.55, 0, root);
  const sign = canvasTex(512, 96, (c, w, h) => {
    c.fillStyle = '#3a2a60'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd166'; c.font = '900 56px "Arial Black", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(L('AUTOS TAMPONNEUSES', 'BUMPER CARS'), w / 2, h / 2 + 4);
  });
  add(rbox(9, 0.9, 0.12, 0.04, M('#ffffff', { map: sign, emap: sign, emissive: '#ffffff', ei: 0.5, r: 0.5 })), 0, 5.15, D / 2 + 0.3, root);
  for (let i = 0; i < 16; i++) add(sph(0.09, BULB_COLORS[i % BULB_COLORS.length], 6, 4), -W / 2 + 0.3 + i * (W - 0.6) / 15, 4.38, D / 2 + 0.32, root);
  // voitures
  const cols = ['#e63946', '#06d6a0', '#ffd166', '#4cc9f0', '#ff8fc7', '#9b5de5'];
  const cars = cols.map((c, i) => {
    const car = new THREE.Group();
    add(rbox(1.3, 0.45, 0.9, 0.18, M(c, { r: 0.3, m: 0.2, cc: true, cached: true })), 0, 0.5, 0, car);
    add(rbox(1.45, 0.18, 1.05, 0.08, M('#222222', { r: 0.8, cached: true })), 0, 0.35, 0, car);
    add(cyl(0.025, 0.025, 3.4, steel, 6), -0.45, 2.3, 0, car);
    add(sph(0.16, M(['#e0ac80', '#a8714d', '#f1c7a0'][i % 3], { cached: true })), 0.05, 1.05, 0, car);
    root.add(car);
    return { car, ph: i / cols.length * Math.PI * 2, r: 2 + (i % 3) * 0.9 };
  });
  root.traverse((o) => { if (o.isMesh) { o.castShadow = !BULB_COLORS.includes(o.material); o.receiveShadow = true; } });
  return {
    root,
    update(dt, t) {
      for (const c of cars) {
        const a = t * 0.6 + c.ph;
        const x = Math.cos(a) * c.r * 1.5 + Math.sin(t * 1.3 + c.ph) * 0.4, z = Math.sin(a * 1.3) * c.r * 0.9;
        const dx = -Math.sin(a) * 1.5, dz = Math.cos(a * 1.3) * 1.17;
        c.car.position.set(THREE.MathUtils.clamp(x, -4.5, 4.5), 0, THREE.MathUtils.clamp(z, -3.2, 3.2));
        c.car.rotation.y = Math.atan2(-dz, dx);
      }
    },
  };
}

/**
 * Petite montagne russe : circuit fermé avec une côte de lancement, une grande descente, des virages et des bosses.
 * Le train (3 wagons) accélère dans les descentes, ralentit en montant, s'arrête un instant en gare.
 */
function buildCoaster() {
  const root = new THREE.Group();
  const stat = new THREE.Group();
  // tracé (repère local), dans le sens de la marche ; le premier tronçon est la gare
  const P = [
    [-10, 1.4, 13], [-10, 1.4, 7], [-10, 3.2, 1], [-10, 7.2, -6], [-9.5, 9.2, -11], [-7, 9.6, -15], [-2.5, 8.6, -16.5],
    [2.5, 4.5, -15.5], [6.5, 1.3, -12], [9, 1.6, -6], [9.6, 5.2, -1], [9, 2.2, 4], [7, 3.6, 9], [4, 6.2, 14],
    [0, 6, 17], [-4, 3.6, 18], [-8, 2, 17],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(P, true, 'centripetal');
  const N = 600;
  const pts = curve.getSpacedPoints(N), tans = pts.map((_, i) => curve.getTangentAt(i / N));
  const len = curve.getLength();
  const up = new THREE.Vector3(0, 1, 0);
  // rails : deux tubes de part et d'autre de l'axe, traverses, et une poutre centrale
  const railM = M('#e63946', { r: 0.35, m: 0.5, cached: true });
  const tieM = M('#2b2d31', { r: 0.5, m: 0.4, cached: true });
  const postM = M('#f1f1f1', { r: 0.4, m: 0.3, cached: true });
  const side = (i) => new THREE.Vector3().crossVectors(tans[i], up).normalize();
  for (const s of [-0.42, 0.42]) {
    const off = pts.slice(0, N).map((p, i) => p.clone().addScaledVector(side(i), s));
    stat.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(off, true), N, 0.06, 6, true), railM));
  }
  stat.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, N).map((p) => p.clone().add(new THREE.Vector3(0, -0.22, 0))), true), N, 0.1, 6, true), tieM));
  for (let i = 0; i < N; i += 4) {
    const tie = box(1.0, 0.06, 0.12, tieM); tie.position.copy(pts[i]).add(new THREE.Vector3(0, -0.08, 0));
    tie.lookAt(pts[i].clone().add(tans[i]).add(new THREE.Vector3(0, -0.08, 0))); stat.add(tie);
  }
  // pylônes blancs sous la voie
  for (let i = 0; i < N; i += 12) {
    const p = pts[i];
    if (p.y < 0.9) continue;
    add(cyl(0.1, 0.13, p.y - 0.25, postM, 8), p.x, (p.y - 0.25) / 2, p.z, stat);
    if (p.y > 4) { const br = box(0.06, 0.06, Math.min(3, p.y * 0.5), postM); br.position.set(p.x, p.y * 0.45, p.z); br.rotation.x = 0.7; stat.add(br); }
  }
  // gare : quai, toit, enseigne, escalier côté fête
  const st = new THREE.Group();
  add(box(3.2, 1.0, 9, M('#8a5a34', { r: 0.8, cached: true })), 0, 0.5, 0, st);
  for (const [x, z] of [[-1.4, -4.2], [-1.4, 4.2], [1.4, -4.2], [1.4, 4.2]]) add(cyl(0.08, 0.08, 3.4, postM, 8), x, 2.7, z, st);
  const roofT = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e63946'; c.fillRect(i * w / 10, 0, w / 10, h); } });
  add(box(4.2, 0.2, 10, M('#ffffff', { map: roofT, r: 0.6 })), 0.4, 4.45, 0, st);
  const signT = canvasTex(1024, 200, (c, w, h) => {
    c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd166'; c.font = '900 84px "Arial Black", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(L('GRAND HUIT', 'ROLLER COASTER'), w / 2, h / 2 + 6);
  });
  const sign = box(0.15, 1.4, 7, M('#ffffff', { map: signT, emap: signT, emissive: '#ffffff', ei: 0.5, r: 0.5 })); sign.position.set(-1.7, 5.3, 0); sign.rotation.y = 0; st.add(sign);
  for (let k = 0; k < 4; k++) add(box(0.8, 0.22, 1.0, M('#a0764c', { r: 0.8, cached: true })), -2.0, 0.11 + k * 0.24, 4.2 - k * 0.9, st);
  st.position.set(-12.2, 0, 10);
  stat.add(st);
  // clôture rouge et blanche autour du manège (ouverte devant l'escalier de la gare)
  const fA = M('#e63946', { r: 0.6, cached: true }), fB = M('#ffffff', { r: 0.6, cached: true });
  const [ax0, ax1, az0, az1] = [-14.5, 12, -18, 20];
  const run = (xa, za, xb, zb) => { const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.floor(L / 2)); for (let k = 0; k < n; k++) { const t0 = (k + 0.5) / n; const seg = box(L / n - 0.1, 0.9, 0.08, k % 2 ? fA : fB); seg.position.set(xa + (xb - xa) * t0, 0.55, za + (zb - za) * t0); seg.rotation.y = Math.atan2(-(zb - za), xb - xa); stat.add(seg); } };
  run(ax0, az0, ax1, az0); run(ax1, az0, ax1, az1); run(ax1, az1, ax0, az1); run(ax0, az1, ax0, 15.5); run(ax0, 12.5, ax0, az0);
  stat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(mergeStatic(stat));

  // le train
  const carCols = ['#ffd166', '#4cc9f0', '#06d6a0'];
  const skins = ['#f1c7a0', '#c98e62', '#8d5a3b', '#e8b48a'];
  const cars = carCols.map((col, k) => {
    const car = new THREE.Group();
    add(rbox(0.95, 0.5, 1.4, 0.15, M(col, { r: 0.35, cc: true, cached: true })), 0, 0.3, 0, car);
    add(rbox(0.97, 0.12, 1.42, 0.05, M('#2b2d31', { r: 0.5, cached: true })), 0, 0.06, 0, car);
    if (k === 0) add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 4), M(col, { r: 0.35, cached: true })), 0, 0.35, 0.85, car).rotation.set(Math.PI / 2, Math.PI / 4, 0);
    const arms = [];
    for (const sx of [-0.22, 0.22]) {
      add(sph(0.14, M(skins[(k * 2 + (sx > 0)) % 4], { r: 0.6, cached: true }), 10, 8), sx, 0.82, -0.1, car);
      add(cyl(0.11, 0.13, 0.35, M(['#e63946', '#1d3557', '#ffffff', '#9b5de5'][(k + (sx > 0)) % 4], { r: 0.7, cached: true }), 8), sx, 0.6, -0.1, car);
      for (const ax of [-0.12, 0.12]) { const a = new THREE.Group(); a.position.set(sx + ax, 0.72, -0.1); add(cyl(0.035, 0.035, 0.4, M(skins[k % 4], { cached: true }), 6), 0, 0.2, 0, a); car.add(a); arms.push(a); }
    }
    car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(car);
    return { car, arms };
  });
  const GAP = 1.55 / len; // espacement des wagons (en fraction du tour)
  const hTop = Math.max(...P.map((p) => p.y));
  const liftEnd = 4 / P.length, stationEnd = 1 / P.length; // la côte va du 2e au 5e point
  let u = 0.02, dwell = 0;
  const tmp = new THREE.Vector3(), rot = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
  return {
    root,
    update(dt) {
      // pas de temps invalide (rechargement, onglet en arrière-plan) : on ne bouge pas, et on ne se bloque jamais
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      if (!Number.isFinite(u)) u = 0.02;
      const h = curve.getPointAt(u).y;
      let v;
      if (u < stationEnd) v = dwell > 0 ? 0 : 2.2;           // en gare (arrêt pour embarquer)
      else if (u < liftEnd) v = 2.6;                      // la côte, tirée par la chaîne
      else v = 3 + Math.sqrt(2 * 9.8 * Math.max(0, hTop - h)) * 0.85; // ensuite, la gravité
      if (dwell > 0) dwell -= dt;
      const before = u;
      u = (u + v * dt / len) % 1;
      if (before > 0.9 && u < 0.1) dwell = 2.5; // retour en gare
      cars.forEach((c, k) => {
        const uk = (u - k * GAP + 1) % 1;
        const p = curve.getPointAt(uk);
        c.car.position.copy(p).add(tmp.set(0, 0.05, 0));
        // orientation dans le repère de la montagne russe (lookAt travaillerait en coordonnées du monde) :
        // l'avant du wagon (+z) suit la tangente de la voie, montées et descentes comprises
        const tan = curve.getTangentAt(uk);
        rot.lookAt(tmp.copy(p).add(tan), p, UP);
        c.car.quaternion.setFromRotationMatrix(rot);
        // bras levés dans les descentes rapides
        const fast = v > 7 ? 1 : 0;
        c.arms.forEach((a, j) => { a.rotation.z = (fast ? 0 : 1.1) * (j % 2 ? -1 : 1) * 0.9; a.rotation.x = fast ? -0.2 : 0.6; });
      });
    },
  };
}

/** Chaises volantes : mât central, couronne qui tourne, sièges qui s'écartent. */
function buildSwinger() {
  const root = new THREE.Group();
  const gold = M('#d4a637', { r: 0.3, m: 0.8, cached: true });
  add(cyl(3.2, 3.4, 0.4, M('#3a2a60', { r: 0.6, cached: true }), 28), 0, 0.2, 0, root);
  add(cyl(0.35, 0.45, 7.5, gold, 14), 0, 3.95, 0, root);
  const spin = new THREE.Group(); spin.position.y = 7.4; root.add(spin);
  const stripes = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#ffd166' : '#06d6a0'; c.fillRect(i * w / 16, 0, w / 16, h); } });
  const crown = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.4, 28, 1, true), M('#ffffff', { map: stripes, r: 0.6 }));
  crown.material.side = THREE.DoubleSide; crown.position.y = 0.6; spin.add(crown);
  add(sph(0.3, gold, 10, 8), 0, 1.4, 0, spin);
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; add(sph(0.09, BULB_COLORS[k % BULB_COLORS.length], 6, 4), Math.cos(a) * 3.5, -0.05, Math.sin(a) * 3.5, spin); }
  const chainM = M('#bbbbbb', { r: 0.4, m: 0.8, cached: true });
  const seatCols = ['#e63946', '#4cc9f0', '#ffd166', '#06d6a0'];
  const seats = [];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const arm = new THREE.Group(); arm.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); arm.rotation.y = -a; spin.add(arm);
    const hang = new THREE.Group(); arm.add(hang);
    add(cyl(0.015, 0.015, 3.6, chainM, 4), 0, -1.8, 0, hang);
    add(rbox(0.5, 0.1, 0.5, 0.04, M(seatCols[k % 4], { r: 0.5, cached: true })), 0, -3.65, 0, hang);
    add(rbox(0.5, 0.45, 0.06, 0.03, M(seatCols[k % 4], { r: 0.5, cached: true })), 0, -3.45, -0.24, hang);
    seats.push(hang);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = !BULB_COLORS.includes(o.material); o.receiveShadow = true; } });
  let speed = 0;
  return {
    root,
    update(dt, t) {
      // cycle : accélère, tourne, ralentit, pause
      const ph = t % 20;
      const target = ph < 14 ? 1.3 : 0;
      speed += (target - speed) * Math.min(1, dt * 0.6);
      spin.rotation.y += dt * speed;
      const tilt = Math.min(0.75, speed * 0.55);
      for (const s of seats) s.rotation.z = tilt; // s'écartent vers l'extérieur
    },
  };
}

function buildFerrisWheel() {
  const root = new THREE.Group();
  const steel = M('#f1f1ea', { r: 0.35, m: 0.6, cached: true });
  const R = 9, H = 11;
  // pieds en A
  for (const z of [-1.4, 1.4]) for (const s of [-1, 1]) {
    const leg = cyl(0.18, 0.22, Math.hypot(H, 5), steel, 10);
    leg.position.set(s * 2.5, H / 2, z); leg.rotation.z = s * Math.atan2(5, H) * -1; root.add(leg);
  }
  add(rbox(6.5, 0.4, 3.6, 0.1, M('#3a2a60', { r: 0.6, cached: true })), 0, 0.2, 0, root);
  // roue qui tourne
  const spin = new THREE.Group(); spin.position.y = H; root.add(spin);
  for (const z of [-1.1, 1.1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 8, 64), steel); rim.position.z = z; spin.add(rim);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const sp = box(0.08, R, 0.08, steel); sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, z); sp.rotation.z = a - Math.PI / 2; spin.add(sp); }
  }
  add(cyl(0.45, 0.45, 2.8, steel, 16), 0, 0, 0, spin).rotation.x = Math.PI / 2;
  // ampoules sur la jante
  for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; add(sph(0.13, BULB_COLORS[k % BULB_COLORS.length], 8, 6), Math.cos(a) * R, Math.sin(a) * R, 1.25, spin); }
  // nacelles (restent à l'horizontale)
  const cabins = [];
  const cabCols = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5', '#f77f00'];
  for (let k = 0; k < 12; k++) {
    const c = new THREE.Group();
    add(rbox(1.3, 1.0, 1.3, 0.2, M(cabCols[k % cabCols.length], { r: 0.5, cached: true })), 0, -0.8, 0, c);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.5, 4), M('#ffffff', { r: 0.5, cached: true })), 0, 0, 0, c).rotation.y = Math.PI / 4;
    spin.add(c);
    cabins.push({ c, a: k / 12 * Math.PI * 2 });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    root,
    update(dt) {
      spin.rotation.z -= dt * 0.12;
      for (const { c, a } of cabins) { const ang = a; c.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0); c.rotation.z = -spin.rotation.z; }
    },
  };
}

function buildCarousel() {
  const root = new THREE.Group();
  const gold = M('#d4a637', { r: 0.3, m: 0.8, cached: true });
  add(cyl(4.2, 4.4, 0.5, M('#3a2a60', { r: 0.6, cached: true }), 32), 0, 0.25, 0, root);
  const spin = new THREE.Group(); root.add(spin);
  add(cyl(4.0, 4.0, 0.15, M('#f6efe0', { r: 0.6, cached: true }), 32), 0, 0.55, 0, spin);
  add(cyl(0.5, 0.5, 4.5, gold, 16), 0, 2.8, 0, spin);
  // toit rayé
  const stripes = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e63946'; c.fillRect(i * w / 16, 0, w / 16, h); } });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.8, 32, 1, true), M('#ffffff', { map: stripes, r: 0.6 }));
  roof.material.side = THREE.DoubleSide; roof.position.y = 5.6; spin.add(roof);
  add(sph(0.35, gold, 12, 8), 0, 6.6, 0, spin);
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; add(sph(0.1, BULB_COLORS[k % BULB_COLORS.length], 8, 6), Math.cos(a) * 4.55, 4.7, Math.sin(a) * 4.55, spin); }
  // chevaux sur leurs barres
  const horses = [];
  const horseCols = ['#ffffff', '#f4c21d', '#c98a3a', '#ff8fc7'];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    const h = new THREE.Group();
    const body = sph(0.4, M(horseCols[k % 4], { r: 0.5, cached: true }), 12, 8); body.scale.set(1.6, 0.8, 0.7); h.add(body);
    add(sph(0.22, M(horseCols[k % 4], { r: 0.5, cached: true }), 10, 8), 0.65, 0.35, 0, h).scale.set(1.3, 0.8, 0.7);
    for (const lx of [-0.35, 0.35]) for (const lz of [-0.15, 0.15]) add(cyl(0.05, 0.05, 0.55, M(horseCols[k % 4], { cached: true }), 6), lx, -0.4, lz, h);
    add(cyl(0.04, 0.04, 4.2, gold, 8), 0, 0.6, 0, h);
    h.position.set(Math.cos(a) * 3, 1.6, Math.sin(a) * 3);
    h.rotation.y = -a + Math.PI / 2;
    spin.add(h);
    horses.push({ h, ph: k });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    root,
    update(dt, t) {
      spin.rotation.y += dt * 0.5;
      for (const { h, ph } of horses) h.position.y = 1.6 + Math.sin(t * 2.2 + ph) * 0.35;
    },
  };
}

/* ======================= Un stand forain ======================= */
export function buildFairStand(k, recipes) {
  const T = FAIR_TYPES[k % FAIR_TYPES.length];
  const group = new THREE.Group();
  const wood = M('#8a5a34', { r: 0.8, cached: true });
  const ca = M(T.a, { r: 0.55, cached: true });
  const cb = M(T.b, { r: 0.55, cached: true });

  // Baraque : fond + côtés aux couleurs du stand
  add(rbox(5.0, 2.6, 0.15, 0.03, ca), -0.6, 1.3, -0.95, group);
  for (const sx of [-3.05, 1.85]) add(rbox(0.15, 2.6, 2.0, 0.03, cb), sx, 1.3, 0.0, group);
  // Toit en pointe rayé (style chapiteau)
  const stripes = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? T.b : T.a; c.fillRect(i * w / 12, 0, w / 12, h); } });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4, 1, true), M('#ffffff', { map: stripes, r: 0.6 }));
  roof.material.side = THREE.DoubleSide; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.62);
  roof.position.set(-0.6, 3.4, 0.1); group.add(roof);
  add(sph(0.18, M('#ffd23f', { r: 0.4, cached: true }), 10, 8), -0.6, 4.3, 0.1, group);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.01, 3), cb), -0.6, 4.6, 0.1, group);
  // petit fanion au sommet
  const flag = box(0.5, 0.3, 0.02, ca); flag.position.set(-0.35, 4.75, 0.1); group.add(flag);
  add(cyl(0.02, 0.02, 0.8, wood, 6), -0.6, 4.6, 0.1, group);

  // Comptoir avec le nom
  const front = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = T.a; c.fillRect(0, 0, w, h);
    c.fillStyle = T.b; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 32, 14);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#3a2a60'; c.lineWidth = 6;
    c.font = `900 ${T.name.length > 12 ? 40 : 50}px "Arial Black", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeText(T.name, w / 2, h / 2 + 8); c.fillText(T.name, w / 2, h / 2 + 8);
  });
  add(rbox(4.8, 1.1, 0.9, 0.04, M('#ffffff', { map: front, r: 0.7 })), -0.6, 0.55, 0.95, group);
  add(rbox(5.0, 0.08, 1.1, 0.02, M('#f6efe0', { r: 0.5, cached: true })), -0.6, 1.14, 1.0, group);
  // Ampoules sur le bord du toit
  for (let i = 0; i < 9; i++) { const b = sph(0.09, BULB_COLORS[(i + k) % BULB_COLORS.length], 8, 6); b.position.set(-2.95 + i * 0.6, 2.62, 1.05); group.add(b); }

  // Produits sur le comptoir
  const disp = new THREE.Group();
  fillFairProduce(disp, T.produce);
  disp.position.set(-0.6, 1.18, 1.0);
  group.add(disp);

  // Forains (1 à 3) en gilet rayé et canotier
  const shirt = M('#ffffff', { r: 0.8, cached: true });
  const vest = M(T.a, { r: 0.7, cached: true });
  const straw = M('#e9c46a', { r: 0.8, cached: true });
  const chefs = [-1.85, -0.9, 0.05].map((cx, i) => {
    const c = new THREE.Group();
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 16), shirt), 0, 1.05, 0, c);
    add(rbox(0.46, 0.5, 0.3, 0.06, vest), 0, 1.1, 0.03, c);
    add(sph(0.17, M(['#e0ac80', '#a8714d', '#f1c7a0'][i], { cached: true })), 0, 1.6, 0, c);
    add(cyl(0.28, 0.28, 0.03, straw, 18), 0, 1.72, 0, c); // canotier
    add(cyl(0.17, 0.17, 0.12, straw, 18), 0, 1.79, 0, c);
    c.position.set(cx, 0, 0.05);
    group.add(c);
    return c;
  });

  // Ardoise du menu
  const menuCanvas = document.createElement('canvas');
  menuCanvas.width = 256; menuCanvas.height = 380;
  const menuTex = new THREE.CanvasTexture(menuCanvas);
  menuTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group();
  const pA = rbox(0.9, 1.25, 0.06, 0.03, M('#ffffff', { map: menuTex, r: 0.8 })); pA.rotation.x = -0.18; add(pA, 0, 0.62, 0.08, board);
  const pB = rbox(0.9, 1.25, 0.06, 0.03, wood); pB.rotation.x = 0.18; add(pB, 0, 0.62, -0.08, board);
  board.position.set(2.6, 0, 2.3); board.rotation.y = -0.6;
  group.add(board);
  function drawMenu(levels) {
    const c = menuCanvas.getContext('2d'), w = 256, h = 380;
    c.fillStyle = '#2a1e3d'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffd166'; c.lineWidth = 14; c.strokeRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 36px "Arial Black", sans-serif'; c.fillText(L('FÊTE', 'FAIR'), w / 2, 60);
    c.textAlign = 'left'; c.font = '22px "Segoe UI Emoji", "Segoe UI", sans-serif';
    recipes.filter((r) => (levels[r.id] || 0) > 0).forEach((r, i) => { c.fillStyle = '#f4f1e8'; c.fillText(`${r.emoji} ${r.name}`, 14, 104 + i * 34); });
    menuTex.needsUpdate = true;
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = !BULB_COLORS.includes(o.material); o.receiveShadow = true; } });
  return { group, chefs, drawMenu };
}

function fillFairProduce(g, kind) {
  if (kind === 'cotton') {
    for (let i = 0; i < 5; i++) {
      add(cyl(0.012, 0.012, 0.35, M('#ffffff', { cached: true }), 6), -1.6 + i * 0.7, 0.17, 0, g);
      const cloud = sph(0.22, M(i % 2 ? '#ff8fc7' : '#a0c4ff', { r: 0.9, cached: true }), 12, 8); cloud.scale.set(1, 1.15, 1); add(cloud, -1.6 + i * 0.7, 0.5, 0, g);
    }
  } else if (kind === 'apple') {
    for (let i = 0; i < 8; i++) {
      add(sph(0.1, M('#c1121f', { r: 0.15, cc: true, cached: true }), 12, 8), -1.7 + i * 0.4, 0.1, 0, g);
      add(cyl(0.008, 0.008, 0.25, M('#a8733f', { cached: true }), 4), -1.7 + i * 0.4, 0.3, 0, g);
    }
  } else if (kind === 'churros') {
    for (let i = 0; i < 4; i++) {
      add(cyl(0.1, 0.07, 0.2, M('#ffffff', { cached: true }), 12), -1.5 + i * 0.8, 0.1, 0, g);
      for (let k = 0; k < 4; k++) { const c = cyl(0.02, 0.02, 0.35, M('#d98a3a', { r: 0.7, cached: true }), 6); c.position.set(-1.53 + i * 0.8 + k * 0.02, 0.3, (k - 1.5) * 0.02); c.rotation.z = (k - 1.5) * 0.12; g.add(c); }
    }
  } else if (kind === 'waffle') {
    for (let i = 0; i < 4; i++) {
      add(rbox(0.32, 0.04, 0.22, 0.015, M('#d9a14e', { r: 0.6, cached: true })), -1.5 + i * 0.8, 0.03, 0, g);
      add(sph(0.07, M('#ffffff', { r: 0.5, cached: true }), 10, 8), -1.45 + i * 0.8, 0.08, 0, g);
    }
  } else if (kind === 'popcorn') {
    for (let i = 0; i < 4; i++) {
      add(cyl(0.12, 0.09, 0.28, M('#e63946', { r: 0.5, cached: true }), 12), -1.5 + i * 0.8, 0.14, 0, g);
      for (let k = 0; k < 6; k++) add(sph(0.045, M('#fff3c4', { r: 0.8, cached: true }), 6, 4), -1.5 + i * 0.8 + Math.cos(k) * 0.06, 0.3 + (k % 2) * 0.04, Math.sin(k) * 0.06, g);
    }
  } else if (kind === 'hotdog') {
    for (let i = 0; i < 3; i++) {
      const bun = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 6, 10), M('#d99a4e', { r: 0.55, cached: true })); bun.rotation.z = Math.PI / 2; bun.position.set(-1.4 + i * 1.0, 0.07, 0); g.add(bun);
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.6, 6, 10), M('#a8402a', { r: 0.4, cached: true })); s.rotation.z = Math.PI / 2; s.position.set(-1.4 + i * 1.0, 0.12, 0); g.add(s);
    }
  } else if (kind === 'donut') {
    const glaze = ['#ff8fc7', '#ffffff', '#6b4a2b', '#ffd166'];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.05, 8, 16), M(glaze[i % 4], { r: 0.5, cached: true }));
      d.rotation.x = -Math.PI / 2; d.position.set(-1.7 + i * 0.4, 0.05, 0); g.add(d);
    }
  } else if (kind === 'lemonade') {
    add(cyl(0.3, 0.3, 0.6, M('#fff3b0', { r: 0.05, transparent: true, opacity: 0.6, cached: true }), 20), -1.4, 0.3, 0, g);
    for (let k = 0; k < 4; k++) add(sph(0.07, M('#ffd60a', { r: 0.5, cached: true }), 8, 6), -1.4 + Math.cos(k) * 0.12, 0.45, Math.sin(k) * 0.12, g);
    for (let i = 0; i < 5; i++) add(cyl(0.06, 0.05, 0.2, M('#fff3b0', { r: 0.1, cached: true }), 12), -0.5 + i * 0.4, 0.1, 0, g);
  }
}
