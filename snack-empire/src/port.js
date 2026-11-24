import { THREE, M, add, rbox, box, cyl, sph, canvasTex, speckle, shadows, rng, mergeStatic } from './util.js';
import { L } from './i18n.js';

/*
 * Niveau 3 : le port, à gauche du parking.
 * - buildPortDecor() : quai en bois, mer animée, phare, bateaux amarrés, voiliers, mouettes.
 * - buildPortShop(k) : une boutique du port (même encombrement qu'un camion → même file, tables, service).
 * - ArrivalBoat      : le bateau du pêcheur qui accoste pendant l'arrivage.
 */

/** Limites du port (x) et bord du quai (z) : la mer commence derrière. */
export const PORT = { x0: -89, x1: -37, quayZ: -6, deckX0: -104, deckZ1: 40 };
/** Où accoste le bateau du pêcheur (au bout du quai, à gauche des boutiques). Il n'apporte que du poisson. */
export const DOCK = new THREE.Vector3(-97, 0, -8.5);
/** Pontons flottants du bassin (x), à droite du chenal qu'emprunte le bateau du pêcheur. */
const PONTOONS = [-70, -57, -45];

export const SHOP_TYPES = [
  { name: L('FRITERIE DU PORT', 'HARBOR CHIPPY'), roof: '#2a6f97', wall: '#d9e6ec', trim: '#1d3557', produce: 'fishchips', deco: 'net' },
  { name: L('BAR À CREVETTES', 'SHRIMP SHACK'), roof: '#e76f51', wall: '#f4e3c3', trim: '#7a3b1e', produce: 'shrimp', deco: 'lampions' },
  { name: L('ÉCAILLER', 'OYSTER BAR'), roof: '#457b9d', wall: '#f1f1ea', trim: '#1d3557', produce: 'oysters', deco: 'buoy' },
  { name: L('SUSHI BAR', 'SUSHI BAR'), roof: '#1b1b1d', wall: '#f3e9d7', trim: '#b5222b', produce: 'sushi', deco: 'noren' },
  { name: L('GUINGUETTE', 'PAELLA HOUSE'), roof: '#2a9d8f', wall: '#fbf3e4', trim: '#7a5230', produce: 'paella', deco: 'lampions' },
  { name: L('GLACIER DU PHARE', 'LIGHTHOUSE CONES'), roof: '#d62828', wall: '#ffffff', trim: '#d62828', produce: 'icecream', deco: 'stripes' },
  // ajoutées à gauche de l'écailler (fond) et du glacier (devant)
  { name: L('FUMOIR À SAUMON', 'SALMON SMOKEHOUSE'), roof: '#5b4636', wall: '#e8dccb', trim: '#7a3b1e', produce: 'salmon', deco: 'chimney' },
  { name: L('BAR À COCKTAILS', 'COCKTAIL BAR'), roof: '#06d6a0', wall: '#fff6e0', trim: '#ef476f', produce: 'cocktail', deco: 'palm' },
];

/* ======================= Décor ======================= */
export function buildPortDecor(scene, animators) {
  const rand = rng(11);
  const deco = new THREE.Group();
  const { deckX0, x1, quayZ, deckZ1 } = PORT;

  // Quai pavé (vieux pavés de granit, joints sombres)
  const cobble = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5d5a55'; g.fillRect(0, 0, w, h);
    const sz = 32;
    for (let y = 0; y < h; y += sz) for (let x = -((y / sz) % 2) * sz / 2; x < w; x += sz) {
      const l = 52 + rand() * 18, hue = 30 + rand() * 15;
      g.fillStyle = `hsl(${hue}, ${8 + rand() * 8}%, ${l}%)`;
      g.beginPath(); g.roundRect(x + 2, y + 2, sz - 4, sz - 4, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(x + 4, y + 3, sz - 10, 6, 3); g.fill();
    }
    speckle(g, w, h, 5000, 0.12, rand);
  }, { rep: [(x1 + 1 - deckX0) / 5, (deckZ1 - quayZ) / 5] });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(x1 + 1 - deckX0, deckZ1 - quayZ), M('#ffffff', { map: cobble, r: 0.8 }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set((deckX0 + x1 + 1) / 2, 0.02, (quayZ + deckZ1) / 2);
  deck.receiveShadow = true;
  scene.add(deck);

  // Murs de quai en pierre sur les trois côtés qui donnent sur l'eau, bordure en granit clair
  const stone = M('#8d8a82', { r: 0.9, cached: true });
  const granite = M('#c8c2b6', { r: 0.75, cached: true });
  const W = x1 + 1 - deckX0, cx = (deckX0 + x1 + 1) / 2, D = deckZ1 - quayZ, cz = (quayZ + deckZ1) / 2;
  add(box(W, 1.6, 0.8, stone), cx, -0.75, quayZ - 0.3, deco);           // fond (bassin)
  add(box(0.8, 1.6, D, stone), deckX0 - 0.3, -0.75, cz, deco);           // côté gauche
  add(box(W - 8, 1.6, 0.8, stone), cx - 4, -0.75, deckZ1 + 0.3, deco);   // devant
  add(box(W, 0.14, 0.9, granite), cx, 0.07, quayZ + 0.35, deco);
  add(box(0.9, 0.14, D, granite), deckX0 + 0.35, 0.07, cz, deco);
  add(box(W - 8, 0.14, 0.9, granite), cx - 4, 0.07, deckZ1 - 0.35, deco);
  // bande jaune de sécurité le long du bassin
  add(box(W - 2, 0.01, 0.12, M('#f4c21d', { r: 0.6, cached: true })), cx, 0.035, quayZ + 1.0, deco);

  // Bittes d'amarrage tout le long des quais
  const iron = M('#2b2d31', { r: 0.5, m: 0.6, cached: true });
  const bollard = (x, z) => {
    add(cyl(0.16, 0.2, 0.5, iron, 12), x, 0.37, z, deco);
    add(cyl(0.24, 0.24, 0.08, iron, 12), x, 0.65, z, deco);
  };
  for (let x = deckX0 + 4; x < x1; x += 7) bollard(x, quayZ + 0.4);
  for (let z = quayZ + 6; z < deckZ1; z += 7) bollard(deckX0 + 0.4, z);
  for (let x = deckX0 + 5; x < x1 - 9; x += 8) bollard(x, deckZ1 - 0.4);
  // Bouées de sauvetage sur leur support
  const ringM = M('#ff6b35', { r: 0.5, cached: true });
  const lifeRing = (x, z, ry) => {
    const g = new THREE.Group();
    add(box(0.08, 1.4, 0.08, M('#e9e6dc', { r: 0.6, cached: true })), 0, 0.7, 0, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 20), ringM); ring.position.set(0, 1.05, 0.08); g.add(ring);
    g.position.set(x, 0.05, z); g.rotation.y = ry; deco.add(g);
  };
  lifeRing(-45, quayZ + 0.9, Math.PI); lifeRing(-86, quayZ + 0.9, Math.PI); lifeRing(deckX0 + 0.9, 20, -Math.PI / 2); lifeRing(-70, deckZ1 - 0.9, 0);
  // Échelles de quai
  for (const x of [-51, -92]) {
    for (const s of [-0.25, 0.25]) add(box(0.06, 1.6, 0.06, iron), x + s, -0.4, quayZ - 0.72, deco);
    for (let k = 0; k < 4; k++) add(box(0.5, 0.04, 0.04, iron), x, -0.9 + k * 0.35, quayZ - 0.72, deco);
  }

  // Digue en enrochement qui ferme le bassin, phare au bout
  const rockM = M('#77736b', { r: 0.95, cached: true });
  const rockM2 = M('#8f8a80', { r: 0.95, cached: true });
  const jetty = [[deckX0 - 3, quayZ - 1], [deckX0 - 3, -32], [-80, -32]];
  for (let s = 0; s < jetty.length - 1; s++) {
    const [ax, az] = jetty[s], [bx, bz] = jetty[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= len; d += 1.3) {
      const px = ax + (bx - ax) * d / len, pz = az + (bz - az) * d / len;
      for (const off of [-1.6, 0, 1.6]) {
        const r = 0.9 + rand() * 0.6;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rand() < 0.5 ? rockM : rockM2);
        const nx = bz - az ? off : 0, nz = bx - ax ? off : 0;
        rock.position.set(px + nx + (rand() - 0.5) * 0.6, -0.4 + (off ? -0.2 : 0.15) + rand() * 0.2, pz + nz + (rand() - 0.5) * 0.6);
        rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        deco.add(rock);
      }
    }
    // chemin bétonné sur le dessus
    const top = box(Math.abs(bx - ax) + 1.6, 0.25, Math.abs(bz - az) + 1.6, M('#b9b3a6', { r: 0.9, cached: true }));
    top.position.set((ax + bx) / 2, 0.55, (az + bz) / 2); deco.add(top);
  }
  add(cyl(3.2, 3.8, 1.8, stone, 24), -80, -0.1, -32, deco);

  // Caisses, tonneaux, casiers à homards le long du quai
  const crate = M('#b58450', { r: 0.8, cached: true });
  const barrel = M('#7a5230', { r: 0.8, cached: true });
  for (let x = deckX0 + 6; x < x1 - 2; x += 9 + rand() * 4) {
    const z = quayZ + 1.4 + rand() * 0.8;
    add(rbox(0.8, 0.6, 0.8, 0.03, crate), x, 0.3, z, deco);
    if (rand() < 0.6) add(rbox(0.7, 0.5, 0.7, 0.03, crate), x + 0.1, 0.85, z, deco).rotation.y = 0.3;
    add(cyl(0.3, 0.32, 0.8, barrel, 14), x + 1.2, 0.4, z + 0.2, deco);
  }

  // Lampadaires de quai
  const lampM = M('#fff0c0', { emissive: '#ffc56a', ei: 3, r: 0.3 });
  for (let x = deckX0 + 8; x < x1; x += 14) {
    add(cyl(0.06, 0.09, 3.6, iron, 10), x, 1.8, quayZ + 0.9, deco);
    add(sph(0.2, lampM, 12, 8), x, 3.7, quayZ + 0.9, deco);
  }

  // Panneau « PORT DE PÊCHE »
  const signTex = canvasTex(1024, 220, (c, w, h) => {
    c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f1faee'; c.lineWidth = 10; c.strokeRect(12, 12, w - 24, h - 24);
    c.fillStyle = '#f1faee'; c.font = '900 92px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(L('⚓ PORT DE PÊCHE', '⚓ FISHING HARBOR'), w / 2, h / 2 + 6);
  });
  for (const x of [-66, -58]) add(cyl(0.1, 0.12, 4.2, M('#6e4a2a', { r: 0.8, cached: true }), 10), x, 2.1, quayZ + 1.2, deco);
  add(rbox(9, 1.9, 0.18, 0.05, M('#ffffff', { map: signTex, r: 0.6 })), -62, 4.0, quayZ + 1.2, deco);

  // Phare au bout de la digue
  const lighthouse = new THREE.Group();
  const stripes = canvasTex(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#d62828'; c.fillRect(0, i * h / 8, w, h / 8); } });
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.6, 11, 24), M('#ffffff', { map: stripes, r: 0.6 })), 0, 6.1, 0, lighthouse);
  add(cyl(1.35, 1.35, 0.25, iron, 24), 0, 11.7, 0, lighthouse);
  add(cyl(0.95, 0.95, 1.4, M('#fff7d6', { emissive: '#ffe08a', ei: 2.5, r: 0.2 }), 20), 0, 12.5, 0, lighthouse);
  add(new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 20), M('#d62828', { r: 0.5, cached: true })), 0, 13.8, 0, lighthouse);
  lighthouse.position.set(-80, 0.8, -32);
  deco.add(lighthouse);
  // petit feu vert de l'autre côté de l'entrée du port
  add(cyl(0.9, 1.1, 1.2, stone, 16), -40, -0.1, -32, deco);
  add(cyl(0.25, 0.3, 3.2, M('#2a9d55', { r: 0.5, cached: true }), 12), -40, 2.0, -32, deco);
  add(sph(0.3, M('#9dffb0', { emissive: '#3dff6e', ei: 2.5, r: 0.3 }), 12, 8), -40, 3.75, -32, deco);

  // Pontons flottants dans le bassin (les bateaux y sont amarrés)
  const pontM = M('#a07a52', { r: 0.85, cached: true });
  const floatM = M('#e9e6dc', { r: 0.6, cached: true });
  for (const px of PONTOONS) {
    add(box(2.2, 0.2, 12, pontM), px, 0.05, quayZ - 6.3, deco);
    for (let z = quayZ - 1.5; z > quayZ - 12.5; z -= 3) for (const s of [-0.9, 0.9]) add(box(0.5, 0.4, 1.4, floatM), px + s, -0.25, z, deco);
    for (let z = quayZ - 2; z > quayZ - 13; z -= 4.5) add(cyl(0.14, 0.14, 2.6, M('#6b4a2b', { r: 0.9, cached: true }), 8), px + 1.25, 0.2, z, deco);
    add(box(1.6, 0.08, 2.4, pontM), px, 0.25, quayZ - 0.6, deco).rotation.x = 0.12; // passerelle
  }

  // La criée (halle où l'on vend le poisson à la sortie des bateaux)
  const hall = new THREE.Group();
  const corr = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#dfe6e9'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(0,0,0,0.09)'; c.fillRect(x, 0, 3, h); } }, { rep: [4, 1] });
  const hallWall = M('#ffffff', { map: corr, r: 0.6 });
  add(box(11, 5, 15, hallWall), 0, 2.5, 0, hall);
  for (const s of [-1, 1]) { const r = box(6.4, 0.2, 15.6, M('#2a6f97', { r: 0.5, cached: true })); r.position.set(s * 2.9, 5.85, 0); r.rotation.z = -s * 0.32; hall.add(r); }
  // grandes portes côté quai (vers les boutiques) et côté bassin
  for (const z of [-4.5, 0, 4.5]) add(box(0.1, 3.4, 3.2, M('#9aa5ab', { r: 0.4, m: 0.5, cached: true })), 5.52, 1.7, z, hall);
  add(box(4, 3.4, 0.1, M('#9aa5ab', { r: 0.4, m: 0.5, cached: true })), 0, 1.7, -7.52, hall);
  const criee = canvasTex(512, 120, (c, w, h) => {
    c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = '900 76px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L('LA CRIÉE', 'FISH MARKET'), w / 2, h / 2 + 4);
  });
  const crieeSign = box(0.12, 1.1, 5.2, M('#ffffff', { map: criee, r: 0.5 })); crieeSign.position.set(5.6, 4.3, 0); crieeSign.rotation.y = 0; hall.add(crieeSign);
  hall.position.set(-97, 0, 12);
  deco.add(hall);
  // Caisses de poisson empilées devant la criée
  const fishCrate = M('#2a9d8f', { r: 0.55, cached: true }), iceM = M('#f1faee', { r: 0.3, cached: true });
  for (let i = 0; i < 9; i++) {
    const x = -90.5 + (i % 3) * 0.75, z = 6 + Math.floor(i / 3) * 4 + rand();
    for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
      add(rbox(0.7, 0.32, 0.5, 0.03, fishCrate), x, 0.18 + k * 0.33, z, deco);
      add(box(0.6, 0.04, 0.4, iceM), x, 0.33 + k * 0.33, z, deco);
    }
  }

  // Grue de quai, près de l'endroit où accoste le bateau du pêcheur
  const craneM = M('#f4c21d', { r: 0.5, m: 0.3, cached: true });
  const crane = new THREE.Group();
  add(cyl(0.9, 1.1, 0.6, iron, 16), 0, 0.3, 0, crane);
  add(box(0.7, 7, 0.7, craneM), 0, 3.8, 0, crane);
  add(rbox(1.6, 1.4, 1.6, 0.1, craneM), 0, 7.6, 0.3, crane);
  const jib = box(0.45, 0.45, 8, craneM); jib.position.set(0, 8.6, -3.2); jib.rotation.x = -0.3; crane.add(jib);
  add(cyl(0.02, 0.02, 5.5, iron, 4), 0, 7.1, -6.8, crane);
  add(box(0.4, 0.3, 0.2, iron), 0, 4.3, -6.8, crane);
  crane.position.set(-100, 0, -2.5);
  deco.add(crane);

  // Filets qui sèchent sur leurs perches, casiers à homards, tas de filets, bateau au sec sur ses cales
  const netTex = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#2d6a4f'; c.lineWidth = 2;
    for (let i = 0; i <= w; i += 10) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i - 20, h); c.stroke(); c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 20, h); c.stroke(); }
  }, { rep: [3, 1] });
  const netM = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 });
  for (const z of [28, 34]) {
    for (const dx of [-4, 0, 4]) add(cyl(0.07, 0.08, 2.8, M('#6b4a2b', { r: 0.9, cached: true }), 8), -97 + dx, 1.4, z, deco);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.0, 8, 1), netM);
    const p = net.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - Math.sin(((p.getX(i) + 4) / 4) * Math.PI) ** 2 * 0.35);
    net.position.set(-97, 1.6, z); deco.add(net);
  }
  const potM = M('#d4a373', { r: 0.8, cached: true });
  for (let i = 0; i < 10; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10, 1, false, 0, Math.PI), potM);
    pot.rotation.set(0, 0, Math.PI / 2); pot.position.set(-102 + (i % 4) * 0.8, 0.38 + Math.floor(i / 4) * 0.4, 2 + (i % 2) * 0.1); deco.add(pot);
  }
  for (const [x, z, c] of [[-92, 37.5, '#e76f51'], [-101.5, 37, '#2d6a4f'], [-102, 31, '#ffb703']]) {
    const pile = sph(0.9, M(c, { r: 0.95, cached: true }), 12, 8); pile.scale.set(1.2, 0.45, 0.9); add(pile, x, 0.3, z, deco);
  }
  const dry = fishingBoat('#ef476f');
  dry.position.set(-96, 1.0, 21.5 + 2); dry.rotation.y = 0.05; dry.rotation.z = 0.06;
  for (const dx of [-1.6, 0, 1.6]) add(box(0.4, 1.0, 1.2, M('#6b4a2b', { r: 0.9, cached: true })), -96 + dx, 0.5, 23.5, deco);
  deco.add(dry);

  shadows(deco);
  scene.add(mergeStatic(deco));

  /* ---------- Éléments animés ---------- */
  // Mer : tout ce qui est à gauche du parking et derrière le quai
  const seaTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b8fb3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 110; i++) {
      const y = rand() * h, x = rand() * w, l = 30 + rand() * 80;
      g.strokeStyle = `rgba(255,255,255,${0.06 + rand() * 0.16})`; g.lineWidth = 2 + rand() * 2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 6, x + l, y); g.stroke();
    }
  }, { rep: [60, 60] });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.12, metalness: 0.1, envMapIntensity: 1 }));
  sea.rotation.x = -Math.PI / 2;
  // une seule grande mer sous toute la ville : visible à gauche du port et devant la ville (z > 88)
  sea.position.set(0, -0.35, 0);
  sea.receiveShadow = true;
  scene.add(sea);

  // Bateaux amarrés de part et d'autre des pontons (ils tanguent), et quelques barques le long du quai devant
  const moored = [];
  const hulls = ['#e63946', '#2a9d8f', '#f4a261', '#1d3557', '#ffffff', '#ef476f'];
  PONTOONS.forEach((px, i) => {
    for (const [side, z, kind] of [[-1, -10, i % 2], [1, -9, (i + 1) % 2], [-1, -16, 1], [1, -15.5, 0]]) {
      if ((i + z) % 3 === 0 && kind) continue; // quelques places libres
      const b = kind ? fishingBoat(hulls[(i * 2 + (side > 0)) % hulls.length]) : sailboat(['#ffffff', '#f1faee', '#ffd166'][i % 3]);
      b.rotation.y = Math.PI / 2 + (side > 0 ? Math.PI : 0);
      b.position.set(px + side * (kind ? 2.35 : 1.85), kind ? -0.1 : -0.2, z);
      b.userData.phase = rand() * 6; b.userData.y0 = b.position.y;
      scene.add(b);
      moored.push(b);
    }
  });
  for (let i = 0; i < 3; i++) {
    const b = rowboat(['#4cc9f0', '#e76f51', '#ffd166'][i]);
    b.position.set(-96 + i * 16, -0.25, deckZ1 + 1.6); b.rotation.y = 0.1 * (i - 1);
    b.userData.phase = rand() * 6; b.userData.y0 = -0.25;
    scene.add(b); moored.push(b);
  }
  // Voiliers au large
  const sails = [];
  for (let i = 0; i < 4; i++) {
    const s = sailboat(['#ffffff', '#ef476f', '#ffd166', '#118ab2'][i]);
    s.position.set(-140 + i * 30, -0.2, -40 - rand() * 30);
    s.userData = { phase: rand() * 10, speed: 0.6 + rand() * 0.6 };
    scene.add(s);
    sails.push(s);
  }
  // Mouettes qui tournent au-dessus du port
  const gulls = [];
  const gullM = M('#ffffff', { r: 0.6, cached: true });
  for (let i = 0; i < 6; i++) {
    const gull = new THREE.Group();
    for (const s of [-1, 1]) { const wing = box(0.5, 0.03, 0.16, gullM); wing.position.x = s * 0.25; gull.add(wing); }
    add(sph(0.08, gullM, 8, 6), 0, 0, 0, gull).scale.set(1, 0.8, 1.8);
    gull.userData = { r: 6 + rand() * 10, h: 7 + rand() * 4, sp: 0.3 + rand() * 0.3, ph: rand() * 6, cx: -60 + rand() * 20, cz: -8 + rand() * 12 };
    scene.add(gull);
    gulls.push(gull);
  }

  let t = 0;
  animators.push((dt) => {
    t += dt;
    seaTex.offset.set(t * 0.003, t * 0.008);
    for (const b of moored) { b.position.y = b.userData.y0 + Math.sin(t * 1.1 + b.userData.phase) * 0.06; b.rotation.z = Math.sin(t * 0.9 + b.userData.phase) * 0.03; }
    for (const s of sails) {
      s.position.x += dt * s.userData.speed;
      if (s.position.x > -40) s.position.x = -200;
      s.position.y = -0.2 + Math.sin(t * 1.2 + s.userData.phase) * 0.1;
    }
    for (const g of gulls) {
      const u = g.userData, a = t * u.sp + u.ph;
      g.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 2 + u.ph) * 0.4, u.cz + Math.sin(a) * u.r);
      g.rotation.y = -a;
      g.children[0].rotation.z = Math.sin(t * 8 + u.ph) * 0.4;
      g.children[1].rotation.z = -Math.sin(t * 8 + u.ph) * 0.4;
    }
  });
}

/* ======================= Bateau de l'arrivage ======================= */
export class ArrivalBoat {
  constructor(scene) {
    this.boat = fishingBoat('#1d3557', true);
    this.boat.visible = false;
    scene.add(this.boat);
    this.phase = 'away'; this.t = 0;
    // du large, il entre dans le bassin entre le phare et le feu vert, puis rejoint son quai (à gauche des pontons)
    this.route = [new THREE.Vector3(-62, -0.1, -80), new THREE.Vector3(-62, -0.1, -28), DOCK.clone().setY(-0.1)];
    const segs = this.route.slice(1).map((p, i) => p.distanceTo(this.route[i]));
    this.total = segs.reduce((a, b) => a + b, 0);
    this.segs = segs;
  }
  /** Position et cap le long de la route, k de 0 (au large) à 1 (à quai). */
  at(k) {
    let d = k * this.total;
    for (let i = 0; i < this.segs.length; i++) {
      if (d <= this.segs[i] || i === this.segs.length - 1) {
        const a = this.route[i], b = this.route[i + 1];
        return { p: a.clone().lerp(b, Math.min(1, d / this.segs[i])), yaw: Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2 };
      }
      d -= this.segs[i];
    }
  }
  /** active : l'arrivage est en cours (le bateau doit être à quai). */
  update(dt, active, time) {
    const b = this.boat;
    if (active && (this.phase === 'away' || this.phase === 'leaving')) { this.phase = 'arriving'; this.t = 0; b.visible = true; }
    if (!active && (this.phase === 'docked' || this.phase === 'arriving')) { this.phase = 'leaving'; this.t = 0; }
    if (this.phase === 'arriving' || this.phase === 'leaving') {
      this.t = Math.min(1, this.t + dt / 7);
      const k = this.t < 0.5 ? 2 * this.t * this.t : 1 - (-2 * this.t + 2) ** 2 / 2;
      const { p, yaw } = this.at(this.phase === 'arriving' ? k : 1 - k);
      b.position.copy(p);
      b.rotation.y = yaw + (this.phase === 'leaving' ? Math.PI : 0);
      if (this.t >= 1) { this.phase = this.phase === 'arriving' ? 'docked' : 'away'; if (this.phase === 'away') b.visible = false; }
    }
    if (this.phase === 'docked') b.rotation.y = 0;
    b.position.y = -0.1 + Math.sin(time * 1.3) * 0.07;
  }
}

/* ======================= Une boutique du port ======================= */
export function buildPortShop(k, recipes) {
  const T = SHOP_TYPES[k % SHOP_TYPES.length];
  const group = new THREE.Group();
  const wood = M('#8a5a34', { r: 0.8, cached: true });
  const woodLight = M('#d2a56d', { r: 0.6, cached: true });
  const wall = M(T.wall, { r: 0.8, cached: true });
  const trim = M(T.trim, { r: 0.6, cached: true });
  const roof = M(T.roof, { r: 0.6, cached: true });

  // Cabane : murs arrière et côtés, toit à deux pans, grande ouverture en façade
  add(rbox(5.0, 2.8, 0.15, 0.03, wall), -0.6, 1.4, -0.95, group);
  for (const sx of [-3.05, 1.85]) add(rbox(0.15, 2.8, 2.0, 0.03, wall), sx, 1.4, 0.0, group);
  for (const s of [-1, 1]) {
    const pan = rbox(5.6, 0.12, 1.75, 0.03, roof);
    pan.position.set(-0.6, 3.15, s * 0.62); pan.rotation.x = s * 0.42; group.add(pan);
  }
  add(box(5.7, 0.14, 0.14, trim), -0.6, 3.5, 0, group); // faîtage
  // Comptoir
  const front = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = T.trim; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 36) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x, 0, 3, h); }
    c.fillStyle = '#ffffff'; c.font = `bold ${T.name.length > 12 ? 40 : 52}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(T.name, w / 2, h / 2 + 2);
  });
  add(rbox(4.8, 1.1, 0.9, 0.04, M('#ffffff', { map: front, r: 0.7 })), -0.6, 0.55, 0.95, group);
  add(rbox(5.0, 0.08, 1.1, 0.02, woodLight), -0.6, 1.14, 1.0, group);
  // Enseigne sur le toit
  const signTex = canvasTex(512, 96, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = T.trim; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = T.trim; c.font = `900 ${T.name.length > 12 ? 40 : 54}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(T.name, w / 2, h / 2 + 2);
  });
  add(rbox(3.8, 0.65, 0.1, 0.02, M('#ffffff', { map: signTex, r: 0.6 })), -0.6, 3.95, 0.7, group);

  // Produits sur le comptoir
  const disp = new THREE.Group();
  fillPortProduce(disp, T.produce);
  disp.position.set(-0.6, 1.18, 1.0);
  group.add(disp);

  // Décoration propre à chaque boutique
  if (T.deco === 'net') {
    const netTex = canvasTex(128, 128, (c, w) => { c.clearRect(0, 0, w, w); c.strokeStyle = 'rgba(70,60,40,.9)'; c.lineWidth = 2; for (let i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, w); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), M('#ffffff', { map: netTex, transparent: true, r: 0.9 }));
    net.material.side = THREE.DoubleSide; net.material.alphaTest = 0.3;
    net.position.set(-3.14, 1.8, 0.2); net.rotation.y = -Math.PI / 2; group.add(net);
  }
  if (T.deco === 'buoy' || T.deco === 'net') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 10, 24), M('#e63946', { r: 0.5, cached: true }));
    ring.position.set(1.94, 1.9, 0.3); ring.rotation.y = Math.PI / 2; group.add(ring);
  }
  if (T.deco === 'lampions') {
    const cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'];
    for (let i = 0; i < 7; i++) {
      const l = sph(0.13, M(cols[i % 4], { emissive: cols[i % 4], ei: 0.8, r: 0.4, cached: true }), 10, 8);
      l.scale.y = 1.25; add(l, -2.9 + i * 0.75, 2.55 - Math.sin(i / 6 * Math.PI) * 0.15, 1.45, group);
    }
  }
  if (T.deco === 'noren') {
    for (let i = 0; i < 4; i++) add(rbox(0.7, 0.6, 0.02, 0.01, M('#b5222b', { r: 0.8, cached: true })), -2.15 + i * 0.95, 2.4, 1.0, group);
  }
  if (T.deco === 'chimney') {
    // cheminée du fumoir, avec un petit panache de fumée figé
    add(rbox(0.5, 1.4, 0.5, 0.04, M('#8d8a82', { r: 0.9, cached: true })), 0.9, 3.7, -0.4, group);
    const smokeM = M('#d9d9d9', { r: 1, transparent: true, opacity: 0.55, cached: true });
    for (let i = 0; i < 3; i++) add(sph(0.25 + i * 0.1, smokeM, 10, 8), 1.0 + i * 0.25, 4.65 + i * 0.4, -0.4, group);
    for (let i = 0; i < 3; i++) { const f = sph(0.09, M('#f28c5a', { r: 0.6, cached: true }), 8, 6); f.scale.set(1, 3, 0.4); add(f, -2.6 + i * 0.25, 2.3, 0.2, group); } // saumons suspendus
  }
  if (T.deco === 'palm') {
    // parasol en paille et petit palmier en pot
    add(cyl(0.04, 0.04, 2.6, M('#a8733f', { cached: true }), 8), 2.6, 1.3, 1.6, group);
    const thatch = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.6, 14, 1, true), M('#d9b26b', { r: 0.95, cached: true }));
    thatch.material.side = THREE.DoubleSide; thatch.position.set(2.6, 2.75, 1.6); group.add(thatch);
    add(cyl(0.25, 0.2, 0.4, M('#c4673d', { r: 0.8, cached: true }), 14), -3.5, 0.2, 1.3, group);
    for (let i = 0; i < 5; i++) { const leaf = sph(0.35, M('#3f9a46', { r: 0.8, cached: true }), 10, 6); leaf.scale.set(1.6, 0.25, 0.5); leaf.rotation.y = i * 1.25; leaf.position.set(-3.5, 1.0, 1.3); group.add(leaf); }
  }
  if (T.deco === 'stripes') {
    for (let i = 0; i < 8; i++) add(box(0.6, 0.18, 0.04, M(i % 2 ? '#ffffff' : '#d62828', { cached: true })), -2.7 + i * 0.6, 2.75, 1.02, group);
  }

  // Vendeurs (1 à 3), marinière
  const shirt = M('#f1faee', { r: 0.8, cached: true });
  const stripe = M('#1d3557', { r: 0.8, cached: true });
  const chefs = [-1.85, -0.9, 0.05].map((cx, i) => {
    const c = new THREE.Group();
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 16), shirt), 0, 1.05, 0, c);
    for (let s = 0; s < 3; s++) add(cyl(0.225, 0.225, 0.04, stripe, 16), 0, 1.0 + s * 0.14, 0, c);
    add(sph(0.17, M(['#e0ac80', '#a8714d', '#f1c7a0'][i], { cached: true })), 0, 1.6, 0, c);
    add(cyl(0.19, 0.19, 0.1, M('#1d3557', { r: 0.7, cached: true }), 16), 0, 1.74, 0, c); // bonnet de marin
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
    c.fillStyle = '#1d2a33'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b88a52'; c.lineWidth = 18; c.strokeRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 38px Georgia, serif'; c.fillText(L('PORT', 'HARBOR'), w / 2, 62);
    c.textAlign = 'left'; c.font = '22px "Segoe UI Emoji", "Segoe UI", sans-serif';
    recipes.filter((r) => (levels[r.id] || 0) > 0).forEach((r, i) => { c.fillStyle = '#f4f1e8'; c.fillText(`${r.emoji} ${r.name}`, 16, 110 + i * 38); });
    menuTex.needsUpdate = true;
  }

  shadows(group);
  return { group, chefs, drawMenu };
}

function fillPortProduce(g, kind) {
  if (kind === 'fishchips') {
    for (let i = 0; i < 4; i++) {
      const x = -1.6 + i * 0.6;
      add(cyl(0.12, 0.07, 0.24, M('#f1faee', { r: 0.6, cached: true }), 14), x, 0.12, 0, g);
      const fish = sph(0.08, M('#d9a14e', { r: 0.6, cached: true }), 10, 8); fish.scale.set(1, 0.7, 2); add(fish, x, 0.27, 0, g);
    }
  } else if (kind === 'shrimp') {
    for (let i = 0; i < 6; i++) {
      add(cyl(0.008, 0.008, 0.6, M('#a8733f', { cached: true }), 4), -1.6 + i * 0.45, 0.05, 0, g).rotation.z = Math.PI / 2;
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.025, 6, 10, Math.PI * 1.4), M('#ff8a5c', { r: 0.5, cached: true }));
        s.position.set(-1.8 + i * 0.45 + k * 0.12, 0.06, 0); g.add(s);
      }
    }
  } else if (kind === 'oysters') {
    add(rbox(3.0, 0.08, 0.6, 0.03, M('#eef6fb', { r: 0.25, cached: true })), -0.2, 0.04, 0, g);
    for (let i = 0; i < 14; i++) {
      const o = sph(0.07, M('#8d8a82', { r: 0.7, cached: true }), 10, 6); o.scale.set(1.3, 0.35, 1); add(o, -1.6 + (i % 7) * 0.45, 0.1, -0.12 + Math.floor(i / 7) * 0.25, g);
    }
    add(sph(0.06, M('#ffd23f', { cached: true }), 8, 6), 1.3, 0.1, 0, g);
  } else if (kind === 'sushi') {
    for (let p = 0; p < 2; p++) {
      add(rbox(1.0, 0.04, 0.4, 0.01, M('#1b1b1d', { r: 0.3, cached: true })), -1.3 + p * 1.4, 0.02, 0, g);
      for (let i = 0; i < 6; i++) {
        add(cyl(0.05, 0.05, 0.06, M('#1f2d1f', { r: 0.6, cached: true }), 10), -1.7 + p * 1.4 + i * 0.16, 0.07, -0.08, g);
        add(cyl(0.035, 0.035, 0.065, M('#f6f1e7', { r: 0.6, cached: true }), 10), -1.7 + p * 1.4 + i * 0.16, 0.072, -0.08, g);
        add(rbox(0.12, 0.05, 0.06, 0.02, M(i % 2 ? '#ff8a5c' : '#f6f1e7', { r: 0.4, cached: true })), -1.7 + p * 1.4 + i * 0.16, 0.07, 0.1, g);
      }
    }
  } else if (kind === 'paella') {
    add(cyl(0.6, 0.55, 0.08, M('#2b2d31', { r: 0.4, m: 0.6, cached: true }), 28), -0.6, 0.05, 0, g);
    add(cyl(0.56, 0.56, 0.03, M('#f2b632', { r: 0.6, cached: true }), 28), -0.6, 0.09, 0, g);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(sph(0.05, M(i % 2 ? '#ff8a5c' : '#2a9d8f', { r: 0.5, cached: true }), 8, 6), -0.6 + Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35, g); }
    add(cyl(0.12, 0.1, 0.25, M('#f1faee', { r: 0.4, cached: true }), 14), 1.0, 0.13, 0, g);
  } else if (kind === 'salmon') {
    // planches de saumon fumé tranché
    for (let p = 0; p < 3; p++) {
      add(rbox(0.8, 0.04, 0.4, 0.01, M('#a8733f', { r: 0.8, cached: true })), -1.5 + p * 1.0, 0.02, 0, g);
      for (let i = 0; i < 5; i++) {
        const s = rbox(0.13, 0.025, 0.3, 0.01, M(i % 2 ? '#f28c5a' : '#f6a77a', { r: 0.5, cached: true }));
        s.rotation.y = 0.2; add(s, -1.78 + p * 1.0 + i * 0.14, 0.055, 0, g);
      }
    }
  } else if (kind === 'cocktail') {
    // verres colorés avec paille et rondelle de fruit
    const cols = ['#ff6f91', '#ffd166', '#06d6a0', '#f78c6b', '#9b5de5', '#4cc9f0'];
    for (let i = 0; i < 6; i++) {
      const x = -1.8 + i * 0.5;
      add(cyl(0.08, 0.05, 0.26, M('#ffffff', { r: 0.05, transparent: true, opacity: 0.4, cached: true }), 14), x, 0.13, 0, g);
      add(cyl(0.075, 0.048, 0.2, M(cols[i], { r: 0.3, cached: true }), 14), x, 0.11, 0, g);
      add(sph(0.04, M('#ffd23f', { r: 0.4, cached: true }), 8, 6), x + 0.07, 0.27, 0, g);
      const straw = cyl(0.008, 0.008, 0.25, M('#ffffff', { cached: true }), 6); straw.position.set(x - 0.02, 0.32, 0); straw.rotation.z = 0.25; g.add(straw);
    }
  } else if (kind === 'icecream') {
    const cols = ['#ffb3c6', '#fff3b0', '#b9fbc0', '#a0c4ff', '#cdb4db', '#ffd6a5'];
    for (let i = 0; i < 6; i++) {
      add(rbox(0.4, 0.14, 0.35, 0.03, M('#d8dde2', { r: 0.2, m: 0.8, cached: true })), -1.8 + i * 0.5, 0.07, 0, g);
      add(sph(0.14, M(cols[i], { r: 0.6, cached: true }), 12, 8), -1.8 + i * 0.5, 0.16, 0, g).scale.y = 0.6;
    }
  }
}

/* ---------- Bateaux ---------- */
function fishingBoat(color, big = false) {
  const g = new THREE.Group();
  const s = big ? 1.3 : 1;
  const hull = rbox(5 * s, 1.2 * s, 1.9 * s, 0.4 * s, M(color, { r: 0.5, cached: true }));
  hull.position.y = 0.3 * s; g.add(hull);
  add(rbox(5 * s, 0.18 * s, 1.95 * s, 0.05, M('#f1faee', { r: 0.5, cached: true })), 0, 0.85 * s, 0, g);
  add(rbox(1.5 * s, 1.1 * s, 1.3 * s, 0.1, M('#f1faee', { r: 0.6, cached: true })), -0.9 * s, 1.5 * s, 0, g); // cabine
  add(rbox(1.0 * s, 0.4 * s, 1.36 * s, 0.05, M('#1d2a36', { r: 0.1, cached: true })), -0.9 * s, 1.7 * s, 0, g);
  add(cyl(0.06 * s, 0.06 * s, 3.2 * s, M('#a8733f', { r: 0.7, cached: true }), 8), 1.0 * s, 2.5 * s, 0, g);
  const boom = cyl(0.04 * s, 0.04 * s, 2.2 * s, M('#a8733f', { r: 0.7, cached: true }), 6); boom.rotation.z = 1.0; boom.position.set(1.7 * s, 2.4 * s, 0); g.add(boom);
  if (big) {
    // caisses de poisson sur le pont
    for (let i = 0; i < 3; i++) add(rbox(0.6, 0.3, 0.5, 0.03, M('#2a9d8f', { r: 0.6, cached: true })), 0.6 + i * 0.65, 1.15, 0.3 * (i % 2 ? 1 : -1), g);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function rowboat(color) {
  const g = new THREE.Group();
  add(rbox(2.6, 0.5, 1.1, 0.22, M(color, { r: 0.5, cached: true })), 0, 0.15, 0, g);
  add(rbox(2.4, 0.08, 0.95, 0.04, M('#a07a52', { r: 0.8, cached: true })), 0, 0.33, 0, g);
  for (const x of [-0.5, 0.5]) add(box(0.25, 0.06, 0.95, M('#6b4a2b', { r: 0.8, cached: true })), x, 0.42, 0, g);
  const oar = cyl(0.03, 0.03, 2.2, M('#d4a373', { r: 0.8, cached: true }), 6); oar.rotation.set(0, 0.2, Math.PI / 2 - 0.1); oar.position.set(0.1, 0.45, 0.2); g.add(oar);
  return g;
}

function sailboat(sailColor) {
  const g = new THREE.Group();
  add(rbox(3.2, 0.6, 1.1, 0.25, M('#ffffff', { r: 0.4, cached: true })), 0, 0.2, 0, g);
  add(cyl(0.05, 0.05, 4.2, M('#d8dde2', { r: 0.3, cached: true }), 8), 0.2, 2.6, 0, g);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.8, 0); sh.lineTo(0, 3.6); sh.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), M(sailColor, { r: 0.8, cached: true }));
  sail.material.side = THREE.DoubleSide; sail.position.set(0.25, 0.75, 0); g.add(sail);
  return g;
}
