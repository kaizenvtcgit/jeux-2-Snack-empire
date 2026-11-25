import { THREE, M, add, rbox, box, cyl, sph, canvasTex, speckle, rng, mergeStatic } from './util.js';
import { L } from './i18n.js';
import { createNav } from './nav.js';

/*
 * Niveau 4 : la plage, à gauche de la fête foraine, entre la promenade et la mer.
 * On descend de la promenade sur un chemin de planches, puis on marche dans le sable jusqu'aux paillotes,
 * éparpillées face à la mer. Parasols, serviettes et poste de secours au bord de l'eau, baigneurs dans la mer.
 * - buildBeachDecor() : le décor (apparaît à l'ouverture) ; update(dt, t, canicule) anime l'eau et les baigneurs.
 * - buildBeachHut(k) : une paillote (même encombrement qu'un camion → même file, tables, service).
 */
export const BEACH = { x0: -37, x1: 10, z0: 36, z1: 93 };
/** Sable plat jusqu'ici (au-delà, il descend dans la mer). */
const FLAT = { x0: -37, x1: 10, z0: 36, z1: 100 };
const SLOPE = 8; // largeur de la pente du sable vers l'eau

/** 8 paillotes éparpillées (tirées au hasard une fois pour toutes, sans chevauchement), face à la mer. */
export const BEACH_SLOTS = [
  { x: 0.7, z: 44.3, yaw: -0.11 }, { x: -13, z: 45.3, yaw: -0.13 }, { x: -2, z: 61, yaw: 0.5 }, { x: -15.9, z: 63.4, yaw: 0.45 },
  { x: -29.8, z: 46.7, yaw: -0.02 }, { x: -29.6, z: 62.7, yaw: 0.05 }, { x: -3.1, z: 77.3, yaw: -0.34 }, { x: -24.1, z: 78.1, yaw: 0.41 },
];
const PALMS = [-30, -19, -8, 3].map((x) => new THREE.Vector3(x, 0, 41.6));
/** Passages entre les palmiers, du chemin de planches vers le sable. */
export const BEACH_GATES = [-24.5, -13.5, -2.5, 6.5].map((x) => new THREE.Vector3(x, 0, 39.5));
const SIGN_X = -13.5;

export const BEACH_TYPES = [
  { name: L('GLACES', 'ICE CREAM'), a: '#ff8fab', b: '#fff1e6', produce: 'icecream' },
  { name: L('GRANITÉS', 'SLUSHIES'), a: '#4cc9f0', b: '#ffffff', produce: 'granita' },
  { name: L('PASTÈQUE', 'WATERMELON'), a: '#2a9d8f', b: '#ff6b6b', produce: 'watermelon' },
  { name: L('CRÊPES', 'CREPES'), a: '#f4a261', b: '#fff3d6', produce: 'crepe' },
  { name: L('CREVETTES', 'SHRIMP'), a: '#e76f51', b: '#fff3d6', produce: 'shrimp' },
  { name: L('PANINIS', 'PANINIS'), a: '#bc6c25', b: '#fefae0', produce: 'panini' },
  { name: L('NOIX DE COCO', 'COCONUTS'), a: '#6b4226', b: '#f1faee', produce: 'coconut' },
  { name: L('SMOOTHIES', 'SMOOTHIES'), a: '#9d4edd', b: '#ffd166', produce: 'smoothie' },
];

/* ======================= Trajets sur la plage ======================= */
const nav = createNav({
  x0: BEACH.x0, x1: BEACH.x1, z0: 38, z1: BEACH.z1,
  slots: BEACH_SLOTS,
  circles: [...PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.6 })), ...[-3, 3].map((s) => ({ x: SIGN_X + s, z: 37.2, r: 0.3 }))],
});
export const beachPath = (from, to) => nav.path(from, to);
export const beachFree = (p) => nav.free(p);
/** Passage le plus proche d'un point (pour entrer sur la plage ou en ressortir). */
export const nearestGate = (p) => BEACH_GATES.reduce((a, b) => (a.distanceToSquared(p) < b.distanceToSquared(p) ? a : b));

/* ======================= Décor de la plage ======================= */
export function buildBeachDecor() {
  const rand = rng(77);
  const root = new THREE.Group();
  const stat = new THREE.Group();

  // Sable : plat, puis pente douce qui plonge sous la mer (couleur plus sombre là où il est mouillé)
  const sandTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 16000, 0.16, rand);
    for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(160,120,70,0.12)'; g.beginPath(); g.ellipse(rand() * w, rand() * h, 6 + rand() * 10, 2 + rand() * 3, rand() * 3, 0, 7); g.fill(); }
  }, { rep: [16, 18] });
  const X0 = FLAT.x0 - SLOPE - 2, X1 = FLAT.x1 + SLOPE + 2, Z0 = FLAT.z0, Z1 = FLAT.z1 + SLOPE + 2;
  const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, Math.round(X1 - X0), Math.round(Z1 - Z0));
  geo.rotateX(-Math.PI / 2);
  geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, cols = [];
  const dry = new THREE.Color('#e3c690'), wet = new THREE.Color('#ad8a5a'), under = new THREE.Color('#8fb5a0');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const dx = Math.max(FLAT.x0 - x, x - FLAT.x1, 0), dz = Math.max(z - FLAT.z1, 0);
    const d = Math.hypot(dx, dz) + (Math.sin(x * 0.35) + Math.sin(z * 0.5)) * 0.4 * Math.min(1, Math.hypot(dx, dz)); // rivage un peu irrégulier
    const t = Math.min(1, Math.max(0, d / SLOPE));
    pos.setY(i, 0.02 - t * 0.9);
    const c = t < 0.25 ? dry.clone().lerp(wet, t / 0.25) : wet.clone().lerp(under, (t - 0.25) / 0.75);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const sand = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 0.95 }));
  sand.receiveShadow = true;
  root.add(sand);

  // Écume qui va et vient le long du rivage
  const foamM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, fog: true });
  const wl = 3.4; // distance du bord plat où le sable passe sous l'eau
  const foams = [
    [FLAT.x0 - wl - 1, FLAT.x1 + wl + 1, FLAT.z1 + wl, 'z'],
    [FLAT.z0 + 4, FLAT.z1 + wl, FLAT.x0 - wl, 'x'],
    [88, FLAT.z1 + wl, FLAT.x1 + wl, 'x'],
  ].map(([a, b, c, axis]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(axis === 'z' ? b - a : 0.9, axis === 'z' ? 0.9 : b - a), foamM);
    m.rotation.x = -Math.PI / 2;
    m.position.set(axis === 'z' ? (a + b) / 2 : c, -0.31, axis === 'z' ? c : (a + b) / 2);
    m.userData = { axis, base: c };
    root.add(m);
    return m;
  });

  // Chemin de planches le long de la promenade
  const plank = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b08457'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#a3774b' : '#bb8f61'; g.fillRect(i * w / 8, 0, w / 8 - 3, h); g.fillStyle = '#6b4a2b'; g.fillRect((i + 1) * w / 8 - 3, 0, 3, h); }
  }, { rep: [16, 1.4] });
  add(box(FLAT.x1 - FLAT.x0 - 1, 0.1, 4.2, M('#ffffff', { map: plank, r: 0.85 })), (FLAT.x0 + FLAT.x1) / 2, 0.05, 38.7, stat);

  // Panneau « PLAGE » au-dessus du passage central
  const signTex = canvasTex(1024, 220, (c, w, h) => {
    c.fillStyle = '#2a9d8f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffd166'; for (let x = 0; x < w; x += 80) { c.beginPath(); c.arc(x + 40, h, 34, Math.PI, 0); c.fill(); }
    c.fillStyle = '#ffffff'; c.strokeStyle = '#1d3557'; c.lineWidth = 12; c.font = '900 130px "Arial Black", Impact, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText(L('LA PLAGE', 'THE BEACH'), w / 2, h / 2 - 6); c.fillText(L('LA PLAGE', 'THE BEACH'), w / 2, h / 2 - 6);
  });
  const woodM = M('#8a5a34', { r: 0.8, cached: true });
  for (const s of [-3, 3]) add(cyl(0.16, 0.2, 4.6, woodM, 10), SIGN_X + s, 2.3, 37.2, stat);
  add(rbox(7.2, 1.5, 0.2, 0.06, M('#ffffff', { map: signTex, r: 0.6 })), SIGN_X, 4.0, 37.2, stat);

  // Palmiers le long des planches
  const trunkM = M('#9c7b55', { r: 0.9, cached: true }), leafM = M('#3f8f3a', { r: 0.7, cached: true });
  for (const p of [...PALMS, new THREE.Vector3(-35, 0, 70), new THREE.Vector3(8.5, 0, 92), new THREE.Vector3(-34, 0, 90)]) {
    const lean = (rand() - 0.5) * 0.5, h = 6 + rand() * 1.5;
    let top = new THREE.Vector3(p.x, 0, p.z);
    for (let i = 0; i < 6; i++) {
      const seg = cyl(0.17 - i * 0.012, 0.2 - i * 0.012, h / 6 + 0.05, trunkM, 10);
      const nx = top.x + Math.sin(lean) * (h / 6) * (i / 5), nz = top.z + (i / 5) * 0.15;
      seg.position.set((top.x + nx) / 2, top.y + h / 12, (top.z + nz) / 2); seg.rotation.z = -lean * (i / 5);
      stat.add(seg);
      top = new THREE.Vector3(nx, top.y + h / 6, nz);
    }
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + rand() * 0.3;
      const leaf = box(2.6, 0.04, 0.55, leafM);
      leaf.geometry.translate(1.3, 0, 0);
      leaf.position.copy(top); leaf.rotation.set(0, -a, -0.35 - rand() * 0.25);
      stat.add(leaf);
    }
    for (let k = 0; k < 3; k++) add(sph(0.18, M('#6b4a2b', { r: 0.7, cached: true }), 10, 8), top.x + Math.cos(k * 2) * 0.25, top.y - 0.25, top.z + Math.sin(k * 2) * 0.25, stat);
  }

  // Parasols, serviettes et transats au bord de l'eau
  const poleM = M('#f1f1f1', { r: 0.5, cached: true });
  const pal = [['#e63946', '#ffffff'], ['#1d7fd8', '#ffffff'], ['#ffd166', '#f77f00'], ['#06d6a0', '#ffffff'], ['#ff8fab', '#ffffff']];
  const umbrellaMats = pal.map(([a, b]) => M('#ffffff', { map: canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect(i * w / 8, 0, w / 8, h); } }), r: 0.7 }));
  const towelMats = ['#e63946', '#4cc9f0', '#ffd166', '#9b5de5', '#06d6a0', '#ff8fab'].map((c) => M(c, { r: 0.9, cached: true }));
  for (let x = FLAT.x0 + 3; x < FLAT.x1 - 1; x += 4.2 + rand() * 1.6) {
    for (const row of [0, 1]) {
      if (rand() < 0.25) continue;
      const ux = x + (rand() - 0.5) * 1.5 + row * 2, uz = 94.5 + row * 3.4 + (rand() - 0.5) * 1.2;
      if (ux > FLAT.x1 - 1) continue;
      const tilt = (rand() - 0.5) * 0.25;
      const um = new THREE.Group();
      add(cyl(0.035, 0.035, 2.4, poleM, 8), 0, 1.2, 0, um);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.55, 8, 1, true), umbrellaMats[Math.floor(rand() * umbrellaMats.length)]);
      canopy.material.side = THREE.DoubleSide; canopy.position.y = 2.35; um.add(canopy);
      um.position.set(ux, 0, uz); um.rotation.set(tilt, rand() * 6, tilt * 0.6);
      stat.add(um);
      const towel = box(0.9, 0.02, 1.8, towelMats[Math.floor(rand() * towelMats.length)]);
      towel.position.set(ux + 0.9, 0.03, uz + 0.4); towel.rotation.y = (rand() - 0.5) * 0.5; stat.add(towel);
      if (rand() < 0.4) {
        // transat
        const ch = new THREE.Group();
        add(box(0.6, 0.06, 1.2, woodM), 0, 0.3, 0, ch);
        const back = box(0.6, 0.06, 0.8, towelMats[Math.floor(rand() * towelMats.length)]); back.position.set(0, 0.55, -0.75); back.rotation.x = 0.7; ch.add(back);
        ch.position.set(ux - 1.0, 0, uz + 0.3); ch.rotation.y = Math.PI + (rand() - 0.5) * 0.6; stat.add(ch);
      }
    }
  }

  // Poste de secours sur pilotis + drapeau
  const tower = new THREE.Group();
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) add(cyl(0.07, 0.07, 2.6, M('#f1f1f1', { r: 0.6, cached: true }), 8), sx, 1.3, sz, tower);
  add(rbox(2.2, 1.5, 2.0, 0.06, M('#e63946', { r: 0.6, cached: true })), 0, 3.3, 0, tower);
  add(rbox(1.4, 0.6, 0.06, 0.02, M('#cde8f6', { r: 0.1, cached: true })), 0, 3.5, 1.01, tower);
  add(new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.8, 4), M('#ffffff', { r: 0.6, cached: true })), 0, 4.45, 0, tower).rotation.y = Math.PI / 4;
  add(cyl(0.03, 0.03, 2.2, poleM, 6), 1.0, 5.4, 0, tower);
  add(box(0.8, 0.5, 0.02, M('#2ec4b6', { r: 0.7, cached: true })), 1.42, 6.2, 0, tower);
  const ramp = box(0.8, 0.06, 3.4, woodM); ramp.position.set(0, 1.3, -2.4); ramp.rotation.x = -0.75; tower.add(ramp);
  tower.position.set(-13, 0, 97);
  stat.add(tower);

  stat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(mergeStatic(stat));

  // Baigneurs (plus nombreux pendant la canicule) et une bouée
  const skin = ['#f1c7a0', '#c98e62', '#8d5a3b', '#e8b48a'].map((c) => M(c, { r: 0.6, cached: true }));
  const caps = ['#e63946', '#ffd166', '#4cc9f0', '#ffffff', '#06d6a0'].map((c) => M(c, { r: 0.5, cached: true }));
  const swimmers = [];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    add(sph(0.16, skin[i % skin.length], 12, 8), 0, 0.12, 0, g);
    if (i % 3 === 0) add(new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), caps[i % caps.length]), 0, 0.14, 0, g);
    add(rbox(0.5, 0.14, 0.24, 0.06, skin[i % skin.length]), 0, -0.08, 0, g);
    // position : devant la plage ou sur son flanc gauche
    const front = i % 3 !== 0;
    const base = front ? new THREE.Vector3(FLAT.x0 + 2 + rand() * (FLAT.x1 - FLAT.x0), -0.35, FLAT.z1 + 7 + rand() * 9)
      : new THREE.Vector3(FLAT.x0 - 7 - rand() * 7, -0.35, 55 + rand() * 40);
    g.position.copy(base);
    g.userData = { base, ph: rand() * 6, sp: 0.2 + rand() * 0.3, order: rand() };
    root.add(g);
    swimmers.push(g);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 10, 24), M('#ff6b6b', { r: 0.4, cached: true }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(-6, -0.3, 108); root.add(ring);

  root.userData.update = (dt, t, heat = 0) => {
    for (const f of foams) {
      const k = (Math.sin(t * 0.8) + 1) / 2;
      f.material.opacity = 0.25 + k * 0.4;
      const off = (k - 0.5) * 1.2;
      if (f.userData.axis === 'z') f.position.z = f.userData.base + off;
      else f.position.x = f.userData.base + (f.userData.base < 0 ? -off : off);
    }
    const shown = 6 + heat * 12;
    for (const s of swimmers) {
      const u = s.userData;
      s.visible = u.order * 18 < shown;
      s.position.set(u.base.x + Math.sin(t * u.sp + u.ph) * 1.5, -0.35 + Math.sin(t * 2 + u.ph) * 0.06, u.base.z + Math.cos(t * u.sp * 0.7 + u.ph) * 1.0);
      s.rotation.y = t * u.sp + u.ph;
    }
    ring.position.y = -0.3 + Math.sin(t * 1.7) * 0.05;
    ring.rotation.z = t * 0.2;
  };
  return root;
}

/* ======================= Une paillote ======================= */
export function buildBeachHut(k, recipes) {
  const T = BEACH_TYPES[k % BEACH_TYPES.length];
  const group = new THREE.Group();
  const wood = M('#c49a6c', { r: 0.85, cached: true });
  const dark = M('#7a5532', { r: 0.85, cached: true });
  const ca = M(T.a, { r: 0.6, cached: true });

  // Poteaux en bambou, murs en planches claires
  for (const [px, pz] of [[-3.05, -0.95], [1.85, -0.95], [-3.05, 1.0], [1.85, 1.0]]) add(cyl(0.09, 0.1, 2.7, dark, 10), px, 1.35, pz, group);
  add(rbox(4.9, 2.5, 0.12, 0.02, wood), -0.6, 1.25, -0.95, group);
  for (const sx of [-3.05, 1.85]) add(rbox(0.12, 1.2, 1.9, 0.02, wood), sx, 0.6, 0.02, group);
  // Toit de paille (avec frange)
  const thatch = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#d6b36a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,85,40' : '250,225,160'},0.45)`; c.lineWidth = 1 + Math.random(); const x = Math.random() * w, y = Math.random() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 3, y + 10 + Math.random() * 14); c.stroke(); }
  });
  const roofM = M('#ffffff', { map: thatch, r: 0.95 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.7, 4, 1, true), roofM);
  roof.material.side = THREE.DoubleSide; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.66);
  roof.position.set(-0.6, 3.5, 0.05); group.add(roof);
  const fringe = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.6, 0.35, 4, 1, true), roofM);
  fringe.rotation.y = Math.PI / 4; fringe.scale.set(1, 1, 0.66); fringe.position.set(-0.6, 2.55, 0.05); group.add(fringe);

  // Comptoir en planches, avec le nom de la paillote peint en grand sur la devanture (bien visible de loin)
  const front = canvasTex(1024, 240, (c, w, h) => {
    // planches de bois clair
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#c49a6c' : '#b98d5e'; c.fillRect(0, i * h / 6, w, h / 6); c.fillStyle = 'rgba(80,50,20,0.35)'; c.fillRect(0, (i + 1) * h / 6 - 3, w, 3); }
    // bandeau coloré aux couleurs de la paillote, avec des vagues en bas
    c.fillStyle = T.a; c.fillRect(30, 26, w - 60, h - 52);
    c.fillStyle = T.b; for (let x = 30; x < w - 30; x += 48) { c.beginPath(); c.arc(x + 24, h - 26, 22, Math.PI, 0); c.fill(); }
    c.strokeStyle = '#3a2412'; c.lineWidth = 6; c.strokeRect(30, 26, w - 60, h - 52);
    // le nom
    c.font = `900 ${T.name.length > 9 ? 92 : 108}px "Arial Black", Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 14; c.strokeStyle = '#3a2412'; c.strokeText(T.name, w / 2, h / 2 - 8);
    c.fillStyle = '#ffffff'; c.fillText(T.name, w / 2, h / 2 - 8);
  });
  add(rbox(4.8, 1.1, 0.9, 0.04, M('#ffffff', { map: front, r: 0.75 })), -0.6, 0.55, 0.95, group);
  add(rbox(5.0, 0.08, 1.1, 0.02, dark), -0.6, 1.14, 1.0, group);
  // Torches tiki et planche de surf contre le côté
  for (const tx of [-3.35, 2.15]) {
    add(cyl(0.05, 0.06, 1.9, dark, 8), tx, 0.95, 1.35, group);
    add(cyl(0.12, 0.08, 0.25, M('#3a2a1a', { r: 0.8, cached: true }), 10), tx, 1.95, 1.35, group);
    add(sph(0.12, M('#ffb347', { emissive: '#ff8c1a', ei: 2.2, r: 0.4, cached: true }), 8, 6), tx, 2.15, 1.35, group).userData.noShadow = true;
  }
  const board = rbox(0.55, 2.2, 0.08, 0.04, M(T.b, { r: 0.35, cc: true, cached: true }));
  board.position.set(2.15, 1.1, -0.45); board.rotation.set(0, 0.3, -0.18); group.add(board);
  add(box(0.06, 2.0, 0.09, ca), 2.15, 1.1, -0.45, group).rotation.set(0, 0.3, -0.18);

  // Produits sur le comptoir
  const disp = new THREE.Group();
  fillBeachProduce(disp, T.produce);
  disp.position.set(-0.6, 1.18, 1.0);
  group.add(disp);

  // Vendeurs en chemise hawaïenne et casquette
  const shirtM = M(T.a, { r: 0.8, cached: true });
  const capM = M(T.b, { r: 0.6, cached: true });
  const chefs = [-1.85, -0.9, 0.05].map((cx, i) => {
    const c = new THREE.Group();
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 16), shirtM), 0, 1.05, 0, c);
    add(sph(0.17, M(['#e0ac80', '#a8714d', '#f1c7a0'][i], { cached: true })), 0, 1.6, 0, c);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM), 0, 1.66, 0, c);
    add(box(0.2, 0.02, 0.16, capM), 0, 1.68, 0.2, c);
    c.position.set(cx, 0, 0.05);
    group.add(c);
    return c;
  });

  // Ardoise du menu
  const menuCanvas = document.createElement('canvas');
  menuCanvas.width = 256; menuCanvas.height = 380;
  const menuTex = new THREE.CanvasTexture(menuCanvas);
  menuTex.colorSpace = THREE.SRGBColorSpace;
  const boardA = new THREE.Group();
  const pA = rbox(0.9, 1.25, 0.06, 0.03, M('#ffffff', { map: menuTex, r: 0.8 })); pA.rotation.x = -0.18; add(pA, 0, 0.62, 0.08, boardA);
  const pB = rbox(0.9, 1.25, 0.06, 0.03, dark); pB.rotation.x = 0.18; add(pB, 0, 0.62, -0.08, boardA);
  boardA.position.set(2.6, 0, 2.3); boardA.rotation.y = -0.6;
  group.add(boardA);
  function drawMenu(levels) {
    const c = menuCanvas.getContext('2d'), w = 256, h = 380;
    c.fillStyle = '#1d3557'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffd166'; c.lineWidth = 14; c.strokeRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 36px "Arial Black", sans-serif'; c.fillText(L('PLAGE', 'BEACH'), w / 2, 60);
    c.textAlign = 'left'; c.font = '22px "Segoe UI Emoji", "Segoe UI", sans-serif';
    recipes.filter((r) => (levels[r.id] || 0) > 0).forEach((r, i) => { c.fillStyle = '#f4f1e8'; c.fillText(`${r.emoji} ${r.name}`, 14, 104 + i * 34); });
    menuTex.needsUpdate = true;
  }

  group.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.noShadow; o.receiveShadow = true; } });
  return { group, chefs, drawMenu };
}

function fillBeachProduce(g, kind) {
  const C = (c, o = {}) => M(c, { r: 0.5, cached: true, ...o });
  if (kind === 'icecream') {
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 10), C('#d9a55b', { r: 0.8 })); cone.rotation.x = Math.PI; add(cone, -1.6 + i * 0.7, 0.11, 0, g);
      add(sph(0.085, C(['#ff8fab', '#fff1e6', '#7a4a2b', '#a7e8bd', '#ffd166'][i]), 12, 8), -1.6 + i * 0.7, 0.26, 0, g);
    }
  } else if (kind === 'granita') {
    for (let i = 0; i < 6; i++) {
      add(cyl(0.08, 0.06, 0.2, C('#ffffff', { transparent: true, opacity: 0.7 }), 12), -1.6 + i * 0.6, 0.1, 0, g);
      add(sph(0.08, C(['#ff4d6d', '#4cc9f0', '#80ed99'][i % 3], { r: 0.3 }), 10, 8), -1.6 + i * 0.6, 0.21, 0, g);
    }
  } else if (kind === 'watermelon') {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16, 1, false, 0, Math.PI / 2.4), C('#ff4d6d'));
      s.rotation.x = Math.PI / 2; s.position.set(-1.6 + i * 0.6, 0.12, 0); g.add(s);
    }
    add(sph(0.3, C('#2d6a4f', { r: 0.35 }), 16, 12), 1.5, 0.3, 0, g).scale.set(1.2, 1, 1);
  } else if (kind === 'crepe') {
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), C('#e9b872', { r: 0.7 })); c.rotation.set(Math.PI / 2, 0, 0); add(c, -1.5 + i * 0.8, 0.08, 0, g); }
    add(cyl(0.35, 0.35, 0.05, C('#333333', { m: 0.6 }), 24), 1.3, 0.03, 0, g);
  } else if (kind === 'shrimp') {
    for (let i = 0; i < 4; i++) {
      add(cyl(0.12, 0.09, 0.16, C('#ffffff'), 12), -1.5 + i * 0.8, 0.08, 0, g);
      for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.02, 6, 10, Math.PI * 1.3), C('#f4845f')); s.position.set(-1.53 + i * 0.8 + (k % 2) * 0.06, 0.2, (k - 1.5) * 0.03); g.add(s); }
    }
  } else if (kind === 'panini') {
    for (let i = 0; i < 4; i++) {
      add(rbox(0.36, 0.08, 0.2, 0.03, C('#d4a373', { r: 0.7 })), -1.5 + i * 0.8, 0.05, 0, g);
      add(box(0.36, 0.02, 0.2, C('#e63946')), -1.5 + i * 0.8, 0.1, 0, g);
      add(rbox(0.36, 0.07, 0.2, 0.03, C('#d4a373', { r: 0.7 })), -1.5 + i * 0.8, 0.14, 0, g);
    }
  } else if (kind === 'coconut') {
    for (let i = 0; i < 5; i++) {
      add(sph(0.14, C('#6b4226', { r: 0.9 }), 12, 10), -1.6 + i * 0.7, 0.14, 0, g);
      add(cyl(0.01, 0.01, 0.3, C(['#ff4d6d', '#ffd166', '#4cc9f0'][i % 3]), 6), -1.58 + i * 0.7, 0.32, 0, g).rotation.z = 0.3;
    }
  } else if (kind === 'smoothie') {
    for (let i = 0; i < 6; i++) {
      add(cyl(0.07, 0.055, 0.24, C(['#ff8fab', '#ffd166', '#9d4edd', '#80ed99'][i % 4], { r: 0.25 }), 12), -1.6 + i * 0.6, 0.12, 0, g);
      add(cyl(0.008, 0.008, 0.22, C('#ffffff'), 6), -1.58 + i * 0.6, 0.3, 0, g).rotation.z = 0.2;
    }
    add(cyl(0.18, 0.16, 0.45, C('#cccccc', { m: 0.5 }), 16), 1.5, 0.22, 0, g);
  }
}
