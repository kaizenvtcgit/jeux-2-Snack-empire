import { THREE, M, add, rbox, box, cyl, sph } from './util.js';

/*
 * Animations propres à chaque stand : une machine ou un geste qui correspond à ce qu'il vend
 * (barbe à papa qui tourne, friteuse qui bouillonne, tapis à sushis, presse à panini…).
 * Tout bouge doucement au repos et s'accélère quand le stand sert un client.
 *
 * buildStandFx(key) → { group, update(dt, t, k) } ; k = activité (0 au repos → 1 en plein service).
 * Le groupe se place derrière le comptoir, sur une petite desserte (repère local du stand).
 */

const C = (c, o = {}) => M(c, { r: 0.5, cached: true, ...o });
const steel = () => C('#c9ccd1', { r: 0.3, m: 0.7 });
const dark = () => C('#2b2d31', { r: 0.5, m: 0.4 });
const TAU = Math.PI * 2;

/** Bouffées de vapeur / fumée qui montent, grossissent puis disparaissent. */
function puffs(parent, { x = 0, y = 0.5, z = 0, n = 5, color = '#ffffff', size = 0.18, rise = 1.2, spread = 0.15, opacity = 0.55 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const list = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat);
    m.userData = { ph: i / n, dx: (Math.random() - 0.5) * spread, dz: (Math.random() - 0.5) * spread };
    m.castShadow = false; parent.add(m); list.push(m);
  }
  let clock = 0;
  return (dt, k) => {
    clock += dt * (0.35 + k * 0.6);
    for (const m of list) {
      const p = (clock + m.userData.ph) % 1;
      m.position.set(x + m.userData.dx * (1 + p * 2), y + p * rise, z + m.userData.dz * (1 + p * 2));
      m.scale.setScalar(Math.max(0.001, size * (0.4 + p) * Math.sin(Math.PI * p) * (0.5 + k * 0.5)));
    }
  };
}

/** Bulles qui remontent dans un liquide (friteuse, limonade…). */
function bubbles(parent, { x = 0, y0 = 0, y1 = 0.2, r = 0.2, n = 8, color = '#fff6d6', size = 0.025 } = {}) {
  const mat = C(color, { r: 0.2 });
  const list = [];
  for (let i = 0; i < n; i++) {
    const m = sph(1, mat, 6, 4); m.castShadow = false;
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
    m.userData = { ph: Math.random(), x: x + Math.cos(a) * d, z: Math.sin(a) * d };
    parent.add(m); list.push(m);
  }
  let clock = 0;
  return (dt, k) => {
    clock += dt * (0.6 + k * 1.6);
    for (const m of list) {
      const p = (clock + m.userData.ph) % 1;
      m.position.set(m.userData.x, y0 + (y1 - y0) * p, m.userData.z);
      m.scale.setScalar(size * (0.5 + p) * (0.4 + k * 0.6));
    }
  };
}

/** Petite desserte en inox sur laquelle repose la machine. */
function table(g, w = 0.9, d = 0.7) {
  add(box(w, 0.06, d, steel()), 0, -0.03, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.025, 0.025, 1.05, steel(), 6), sx * (w / 2 - 0.05), -0.55, sz * (d / 2 - 0.05), g);
}

/* ---------- Les machines, une par spécialité ---------- */
const FX = {
  /* Camions : grosse enseigne qui tourne sur le toit */
  truck3: (g) => rooftop(g, (s) => { // burger
    add(cyl(0.45, 0.5, 0.25, C('#d99a4e'), 20), 0, 0, 0, s);
    add(cyl(0.52, 0.52, 0.08, C('#3fa34d'), 20), 0, 0.16, 0, s);
    add(cyl(0.5, 0.5, 0.18, C('#5a2f1c', { r: 0.8 }), 20), 0, 0.29, 0, s);
    add(cyl(0.52, 0.52, 0.05, C('#ffc300'), 20), 0, 0.4, 0, s);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, TAU, 0, Math.PI / 2), C('#e3a55a')), 0, 0.43, 0, s);
  }),
  truck1: (g) => rooftop(g, (s) => { // pizza (camion n°2) : une grande pizza dressée, avec une part qui dépasse
    const p = new THREE.Group();
    add(cyl(0.6, 0.6, 0.08, C('#d9984a'), 32), 0, 0, 0, p);
    add(cyl(0.53, 0.53, 0.09, C('#c0392b'), 32), 0, 0.005, 0, p);
    for (let i = 0; i < 9; i++) add(cyl(0.07, 0.07, 0.1, C('#f6f2e4'), 12), Math.cos(i * 0.7) * 0.32, 0.01, Math.sin(i * 0.7) * 0.32, p);
    for (let i = 0; i < 6; i++) add(cyl(0.05, 0.05, 0.1, C('#9b2d20'), 12), Math.cos(i * 1.05 + 0.4) * 0.18, 0.012, Math.sin(i * 1.05 + 0.4) * 0.18, p);
    p.rotation.x = Math.PI / 2 - 0.2; p.position.y = 0.6;
    s.add(p);
  }),
  truck2: (g) => rooftop(g, (s) => { // tacos
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.45, 20, 1, true, 0, Math.PI), C('#f2c14e', { r: 0.7 }));
    shell.material.side = THREE.DoubleSide; shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; shell.position.y = 0.45; s.add(shell);
    add(box(0.12, 0.25, 0.8, C('#3fa34d')), 0, 0.35, 0, s);
    add(box(0.14, 0.18, 0.75, C('#a8402a')), 0, 0.3, 0, s);
  }),
  truck0: (g) => rooftop(g, (s) => { // hot-dog (camion n°1)
    const bun = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 14), C('#d99a4e')); bun.rotation.z = Math.PI / 2; bun.position.y = 0.25; s.add(bun);
    const saus = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.2, 6, 14), C('#a8402a', { r: 0.4 })); saus.rotation.z = Math.PI / 2; saus.position.y = 0.42; s.add(saus);
    for (let i = 0; i < 5; i++) add(sph(0.05, C('#ffd60a'), 6, 4), -0.4 + i * 0.2, 0.56, Math.sin(i) * 0.05, s);
  }),

  /* Marché */
  'market-bread': (g) => { // four à pain : la gueule rougeoie, la chaleur s'échappe
    table(g);
    add(rbox(0.8, 0.55, 0.6, 0.08, C('#b5523b', { r: 0.9 })), 0, 0.28, 0, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, TAU, 0, Math.PI / 2), C('#b5523b', { r: 0.9 })), 0, 0.55, 0, g).scale.set(1, 0.6, 0.75);
    const mouth = add(box(0.36, 0.22, 0.02, new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 1.5 })), 0, 0.27, 0.31, g);
    const steam = puffs(g, { y: 0.75, z: 0.1, color: '#e9e2d6', size: 0.16 });
    return (dt, t, k) => { mouth.material.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.4 + k; steam(dt, k); };
  },
  'market-cheese': (g) => { // grosse meule qui tourne, couteau qui coupe
    table(g);
    const wheel = add(cyl(0.34, 0.34, 0.24, C('#f2c14e', { r: 0.6 }), 24), 0, 0.12, 0, g);
    const knife = new THREE.Group(); add(box(0.04, 0.02, 0.4, steel()), 0, 0, 0, knife); add(box(0.05, 0.05, 0.14, dark()), 0, 0, -0.26, knife);
    knife.position.set(0.12, 0.45, 0.1); g.add(knife);
    return (dt, t, k) => { wheel.rotation.y += dt * (0.3 + k * 1.2); knife.position.y = 0.3 + Math.abs(Math.sin(t * (2 + k * 6))) * 0.18; };
  },
  'market-fruit': (g) => blender(g, '#ff6b6b'),
  'market-fish': (g) => { // un poisson qui frétille sur la glace
    table(g);
    add(box(0.8, 0.08, 0.55, C('#e8f4f8', { r: 0.2 })), 0, 0.04, 0, g);
    const fish = new THREE.Group();
    const body = sph(0.12, C('#8fa9b8', { r: 0.25, m: 0.4 }), 12, 8); body.scale.set(2.4, 0.8, 0.6); fish.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), C('#8fa9b8', { r: 0.25, m: 0.4 })); tail.rotation.z = Math.PI / 2; tail.position.x = -0.34; fish.add(tail);
    fish.position.y = 0.18; g.add(fish);
    return (dt, t, k) => {
      const p = (t * (0.5 + k)) % 3;
      fish.position.y = 0.18 + (p < 0.6 ? Math.sin(p / 0.6 * Math.PI) * 0.35 : 0);
      fish.rotation.x = p < 0.6 ? p / 0.6 * TAU : 0;
      tail.rotation.y = Math.sin(t * 14) * 0.5;
    };
  },
  'market-charcuterie': (g) => { // trancheuse dont la lame tourne + saucissons qui se balancent
    table(g);
    add(rbox(0.6, 0.25, 0.45, 0.05, C('#d62828')), 0, 0.12, 0, g);
    const blade = add(cyl(0.22, 0.22, 0.03, steel(), 24), -0.05, 0.38, 0.05, g); blade.rotation.x = Math.PI / 2;
    const ham = add(cyl(0.12, 0.12, 0.3, C('#c96b6b')), 0.2, 0.36, 0.05, g); ham.rotation.z = Math.PI / 2;
    const hang = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Group(); s.position.set(-0.3 + i * 0.3, 1.5, -0.1);
      add(cyl(0.006, 0.006, 0.3, dark(), 4), 0, -0.15, 0, s);
      add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 6, 10), C('#6b2d2d', { r: 0.7 })), 0, -0.5, 0, s);
      g.add(s); hang.push(s);
    }
    return (dt, t, k) => { blade.rotation.y += dt * (2 + k * 18); ham.position.x = 0.2 + Math.sin(t * (1 + k * 4)) * 0.08; hang.forEach((s, i) => { s.rotation.z = Math.sin(t * 1.6 + i) * 0.15; }); };
  },
  'market-pastry': (g) => { // gâteau sur un présentoir tournant
    table(g);
    add(cyl(0.05, 0.08, 0.2, C('#ffffff'), 10), 0, 0.1, 0, g);
    const top = new THREE.Group(); top.position.y = 0.2; g.add(top);
    add(cyl(0.3, 0.3, 0.03, C('#ffffff'), 24), 0, 0, 0, top);
    add(cyl(0.24, 0.24, 0.2, C('#f7c5d3', { r: 0.6 }), 24), 0, 0.12, 0, top);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; add(sph(0.035, C('#c1121f', { cc: true }), 8, 6), Math.cos(a) * 0.18, 0.25, Math.sin(a) * 0.18, top); }
    const cherry = add(sph(0.05, C('#c1121f', { cc: true }), 10, 8), 0, 0.27, 0, top);
    return (dt, t, k) => { top.rotation.y += dt * (0.5 + k); cherry.position.y = 0.27 + Math.abs(Math.sin(t * 4)) * 0.05 * (0.3 + k); };
  },

  /* Port */
  'port-fishchips': (g) => fryer(g, '#e9b872'),
  'port-shrimp': (g) => skewerGrill(g, '#f4845f'),
  'port-oysters': (g) => { // huîtres qui s'ouvrent et se referment
    table(g);
    add(cyl(0.38, 0.38, 0.05, steel(), 24), 0, 0.03, 0, g);
    add(cyl(0.34, 0.34, 0.04, C('#e8f4f8', { r: 0.2 }), 24), 0, 0.06, 0, g);
    const lids = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU, x = Math.cos(a) * 0.2, z = Math.sin(a) * 0.2;
      const low = sph(0.08, C('#8d8478', { r: 0.9 }), 10, 6); low.scale.set(1.2, 0.35, 0.9); low.position.set(x, 0.1, z); g.add(low);
      add(sph(0.05, C('#e9e2cf', { r: 0.3 }), 8, 6), x, 0.12, z, g).scale.set(1.2, 0.3, 0.9);
      const lid = new THREE.Group(); lid.position.set(x - 0.08, 0.12, z); lid.rotation.y = -a;
      const shell = sph(0.08, C('#9a9184', { r: 0.9 }), 10, 6); shell.scale.set(1.2, 0.3, 0.9); shell.position.x = 0.08; lid.add(shell);
      g.add(lid); lids.push(lid);
    }
    return (dt, t, k) => lids.forEach((l, i) => { l.rotation.z = Math.max(0, Math.sin(t * (1 + k * 2) + i * 1.3)) * 0.9; });
  },
  'port-sushi': (g) => { // petit tapis roulant à sushis
    table(g, 1.2, 0.7);
    const path = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 32), dark()); path.rotation.x = Math.PI / 2; path.scale.set(1.5, 1, 1); path.position.y = 0.06; g.add(path);
    const plates = [];
    const fishCols = ['#ff7f50', '#f1faee', '#e63946', '#ffb4a2'];
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Group();
      add(cyl(0.07, 0.06, 0.02, C(i % 2 ? '#2a6f97' : '#e63946'), 14), 0, 0, 0, p);
      add(rbox(0.09, 0.04, 0.05, 0.015, C('#ffffff', { r: 0.8 })), 0, 0.03, 0, p);
      add(box(0.1, 0.015, 0.055, C(fishCols[i % 4])), 0, 0.055, 0, p);
      g.add(p); plates.push({ p, a: i / 8 * TAU });
    }
    let off = 0;
    return (dt, t, k) => { off += dt * (0.25 + k * 0.6); for (const q of plates) { const a = q.a + off; q.p.position.set(Math.cos(a) * 0.48, 0.12, Math.sin(a) * 0.32); } };
  },
  'port-paella': (g) => { // grande poêle à paella, cuillère qui remue, vapeur
    table(g, 1.0, 0.8);
    add(cyl(0.16, 0.2, 0.18, dark(), 12), 0, 0.09, 0, g);
    add(cyl(0.42, 0.38, 0.06, dark(), 28), 0, 0.21, 0, g);
    add(cyl(0.38, 0.38, 0.03, C('#f2b134', { r: 0.8 }), 28), 0, 0.24, 0, g);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; add(sph(0.045, C(i % 2 ? '#f4845f' : '#3a5a40'), 8, 6), Math.cos(a) * 0.24, 0.27, Math.sin(a) * 0.24, g); }
    const spoon = new THREE.Group(); add(cyl(0.015, 0.015, 0.6, C('#a8733f'), 6), 0, 0.3, 0, spoon); spoon.rotation.z = 0.5; g.add(spoon);
    const steam = puffs(g, { y: 0.35, color: '#ffffff', size: 0.17, spread: 0.4 });
    return (dt, t, k) => { const a = t * (0.8 + k * 2.5); spoon.position.set(Math.cos(a) * 0.18, 0.1, Math.sin(a) * 0.18); spoon.rotation.y = -a; steam(dt, k); };
  },
  'port-icecream': (g) => softServe(g, '#fff1e6', true),
  'port-salmon': (g) => { // fumoir : saumons suspendus qui se balancent, fumée épaisse
    table(g);
    add(rbox(0.7, 0.8, 0.5, 0.05, C('#5b4636', { r: 0.9 })), 0, 0.4, 0, g);
    const hang = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Group(); s.position.set(-0.4 + i * 0.4, 1.55, 0.15);
      add(cyl(0.005, 0.005, 0.25, dark(), 4), 0, -0.12, 0, s);
      const f = sph(0.1, C('#f08a5d', { r: 0.5 }), 10, 8); f.scale.set(0.7, 2.2, 0.35); f.position.y = -0.45; s.add(f);
      g.add(s); hang.push(s);
    }
    const smoke = puffs(g, { y: 0.85, color: '#9a9590', size: 0.22, rise: 1.8, opacity: 0.45 });
    return (dt, t, k) => { hang.forEach((s, i) => { s.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.12; }); smoke(dt, 0.5 + k * 0.5); };
  },
  'port-cocktail': (g) => shaker(g, '#ef476f'),

  /* Fête foraine */
  'fair-cotton': (g) => { // machine à barbe à papa : la cuve tourne, le nuage rose gonfle
    table(g);
    add(cyl(0.2, 0.25, 0.3, C('#ff8fc7'), 16), 0, 0.15, 0, g);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.25, 24, 1, true), C('#ffffff', { transparent: true, opacity: 0.45 }));
    bowl.material.side = THREE.DoubleSide; bowl.position.y = 0.42; g.add(bowl);
    const head = add(cyl(0.06, 0.06, 0.12, steel(), 10), 0, 0.36, 0, g);
    const cloud = sph(0.25, C('#ffb3d9', { r: 1 }), 14, 10); cloud.position.y = 0.48; g.add(cloud);
    const stick = add(cyl(0.012, 0.012, 0.5, C('#ffffff'), 6), 0.18, 0.55, 0, g); stick.rotation.z = 0.6;
    return (dt, t, k) => { head.rotation.y += dt * (8 + k * 20); cloud.rotation.y += dt * (2 + k * 6); const s = 0.6 + ((t * (0.15 + k * 0.3)) % 1) * 0.6; cloud.scale.set(s, s * 0.8, s); };
  },
  'fair-apple': (g) => { // pomme trempée dans le caramel rouge
    table(g);
    add(cyl(0.22, 0.2, 0.25, steel(), 16), 0, 0.13, 0, g);
    add(cyl(0.19, 0.19, 0.02, C('#c1121f', { cc: true }), 16), 0, 0.24, 0, g);
    const apple = new THREE.Group(); add(sph(0.1, C('#d62828', { cc: true }), 12, 8), 0, 0, 0, apple); add(cyl(0.01, 0.01, 0.35, C('#a8733f'), 6), 0, 0.2, 0, apple);
    g.add(apple);
    return (dt, t, k) => { const p = (t * (0.3 + k * 0.7)) % 1; apple.position.set(0, 0.28 + Math.abs(Math.cos(p * Math.PI)) * 0.3, 0); apple.rotation.y = t * 3; };
  },
  'fair-churros': (g) => fryer(g, '#d98a3a', true),
  'fair-waffle': (g) => press(g, '#d9a14e', true),
  'fair-popcorn': (g) => { // machine à popcorn : les grains sautent dans la vitrine
    table(g);
    add(box(0.6, 0.06, 0.45, C('#e63946')), 0, 0.03, 0, g);
    const glass = box(0.58, 0.55, 0.43, C('#ffffff', { transparent: true, opacity: 0.25, r: 0.1 })); glass.position.y = 0.34; g.add(glass);
    add(box(0.6, 0.08, 0.45, C('#e63946')), 0, 0.65, 0, g);
    add(cyl(0.1, 0.1, 0.06, steel(), 12), 0, 0.55, 0, g);
    add(box(0.54, 0.08, 0.39, C('#fff3c4', { r: 0.9 })), 0, 0.1, 0, g);
    const kernels = [];
    for (let i = 0; i < 14; i++) { const m = sph(0.03, C('#fffbe6', { r: 0.9 }), 6, 4); m.userData = { x: (Math.random() - 0.5) * 0.45, z: (Math.random() - 0.5) * 0.3, ph: Math.random() }; g.add(m); kernels.push(m); }
    return (dt, t, k) => kernels.forEach((m) => { const p = (t * (0.8 + k * 2) + m.userData.ph) % 1; m.position.set(m.userData.x, 0.16 + Math.sin(p * Math.PI) * 0.38, m.userData.z); });
  },
  'fair-hotdog': (g) => { // grill à rouleaux : les saucisses tournent
    table(g);
    add(box(0.7, 0.12, 0.5, steel()), 0, 0.06, 0, g);
    const rolls = [];
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.5, 4, 8), C('#a8402a', { r: 0.35 })); s.rotation.z = Math.PI / 2; s.position.set(0, 0.17, -0.18 + i * 0.09); g.add(s); rolls.push(s); }
    const steam = puffs(g, { y: 0.25, size: 0.12, spread: 0.4, opacity: 0.4 });
    return (dt, t, k) => { rolls.forEach((s) => { s.rotation.x += dt * (2 + k * 5); }); steam(dt, k); };
  },
  'fair-donut': (g) => { // beignets qui glissent dans l'huile et se retournent
    table(g, 1.0, 0.6);
    add(box(0.9, 0.16, 0.45, steel()), 0, 0.08, 0, g);
    add(box(0.84, 0.02, 0.39, C('#c98a3a', { r: 0.15 })), 0, 0.15, 0, g);
    const ds = [];
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.035, 8, 14), C('#d9a14e', { r: 0.6 })); d.rotation.x = Math.PI / 2; g.add(d); ds.push({ d, ph: i / 4 }); }
    const bub = bubbles(g, { y0: 0.15, y1: 0.19, r: 0.3, color: '#f3d9a4' });
    return (dt, t, k) => { for (const q of ds) { const p = (t * (0.12 + k * 0.25) + q.ph) % 1; q.d.position.set(-0.38 + p * 0.76, 0.17, 0); q.d.rotation.x = Math.PI / 2 + (p > 0.5 ? Math.min(1, (p - 0.5) * 8) * Math.PI : 0); } bub(dt, k); };
  },
  'fair-lemonade': (g) => { // fontaine à limonade : citrons qui tournent, bulles
    table(g);
    add(cyl(0.22, 0.22, 0.06, steel(), 16), 0, 0.03, 0, g);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 20, 1, true), C('#ffffff', { transparent: true, opacity: 0.3, r: 0.05 }));
    jar.material.side = THREE.DoubleSide; jar.position.y = 0.34; g.add(jar);
    add(cyl(0.2, 0.2, 0.45, C('#fff3a0', { transparent: true, opacity: 0.75, r: 0.1 }), 20), 0, 0.29, 0, g);
    const stir = new THREE.Group(); stir.position.y = 0.3; g.add(stir);
    for (let i = 0; i < 4; i++) { const l = add(cyl(0.07, 0.07, 0.015, C('#ffd60a'), 12), Math.cos(i * 1.6) * 0.11, (i - 1.5) * 0.08, Math.sin(i * 1.6) * 0.11, stir); l.rotation.x = 1.2; }
    const bub = bubbles(g, { y0: 0.08, y1: 0.5, r: 0.16, color: '#ffffff', size: 0.02 });
    return (dt, t, k) => { stir.rotation.y += dt * (0.8 + k * 3); bub(dt, k); };
  },

  /* Plage */
  'beach-icecream': (g) => softServe(g, '#ff8fab', false),
  'beach-granita': (g) => { // machine à granité : deux cuves où tournent les vis
    table(g);
    add(box(0.7, 0.2, 0.4, steel()), 0, 0.1, 0, g);
    const augers = [];
    [['#4cc9f0', -0.17], ['#ff4d6d', 0.17]].forEach(([col, x]) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16, 1, true), C('#ffffff', { transparent: true, opacity: 0.3 }));
      tank.material.side = THREE.DoubleSide; tank.position.set(x, 0.42, 0); g.add(tank);
      add(cyl(0.14, 0.14, 0.32, C(col, { transparent: true, opacity: 0.8, r: 0.2 }), 16), x, 0.38, 0, g);
      const aug = new THREE.Group(); aug.position.set(x, 0.4, 0);
      for (let i = 0; i < 6; i++) { const b = box(0.2, 0.015, 0.04, C('#ffffff')); b.position.y = -0.15 + i * 0.06; b.rotation.y = i * 0.8; aug.add(b); }
      g.add(aug); augers.push(aug);
    });
    return (dt, t, k) => augers.forEach((a, i) => { a.rotation.y += dt * (1 + k * 4) * (i ? -1 : 1); });
  },
  'beach-watermelon': (g) => { // le couteau tranche la pastèque
    table(g);
    add(box(0.7, 0.04, 0.45, C('#a07a52', { r: 0.8 })), 0, 0.02, 0, g);
    const melon = sph(0.2, C('#2d6a4f', { r: 0.35 }), 16, 12); melon.scale.set(1.3, 0.9, 1); melon.position.set(-0.08, 0.18, 0); g.add(melon);
    const knife = new THREE.Group(); add(box(0.3, 0.08, 0.01, steel()), 0, 0, 0, knife); add(box(0.12, 0.04, 0.03, dark()), 0.2, 0.02, 0, knife);
    g.add(knife);
    return (dt, t, k) => { const p = (t * (0.6 + k * 1.6)) % 1; knife.position.set(0.2, 0.25 + Math.abs(Math.sin(p * Math.PI)) * 0.25, 0); knife.rotation.z = -0.3 + Math.sin(p * Math.PI) * 0.4; };
  },
  'beach-crepe': (g) => { // la crêpe saute dans la poêle
    table(g);
    add(cyl(0.3, 0.3, 0.05, dark(), 24), 0, 0.03, 0, g);
    const crepe = add(cyl(0.26, 0.26, 0.012, C('#e9b872', { r: 0.7 }), 24), 0, 0.07, 0, g);
    const steam = puffs(g, { y: 0.15, size: 0.12, spread: 0.3, opacity: 0.35 });
    return (dt, t, k) => { const p = (t * (0.25 + k * 0.4)) % 1; const j = p > 0.8 ? (p - 0.8) / 0.2 : 0; crepe.position.y = 0.07 + Math.sin(j * Math.PI) * 0.4; crepe.rotation.x = j * Math.PI; steam(dt, k); };
  },
  'beach-shrimp': (g) => fryer(g, '#f4845f'),
  'beach-panini': (g) => press(g, '#d4a373', false),
  'beach-coconut': (g) => { // machette qui ouvre la noix de coco
    table(g);
    add(cyl(0.2, 0.22, 0.12, C('#7a5532', { r: 0.9 }), 16), 0, 0.06, 0, g);
    const nut = add(sph(0.13, C('#6b4226', { r: 0.95 }), 12, 10), 0, 0.23, 0, g);
    const machete = new THREE.Group(); add(box(0.4, 0.1, 0.012, steel()), -0.2, 0, 0, machete); add(box(0.14, 0.05, 0.035, dark()), 0.06, 0, 0, machete);
    machete.position.set(0.25, 0.35, 0); g.add(machete);
    return (dt, t, k) => { const p = (t * (0.5 + k * 1.5)) % 1; machete.rotation.z = -0.9 + Math.abs(Math.sin(p * Math.PI)) * 1.2; nut.scale.setScalar(p < 0.1 ? 0.92 : 1); };
  },
  'beach-smoothie': (g) => blender(g, '#9d4edd'),
};

/* ---------- Machines partagées ---------- */
function rooftop(g, build) {
  const s = new THREE.Group(); build(s); s.scale.setScalar(1.1); g.add(s);
  add(cyl(0.04, 0.04, 0.5, steel(), 8), 0, -0.25, 0, g);
  // (la vitesse suit l'activité en douceur, et l'enseigne flotte sur une phase qui avance toute seule :
  //  sinon elle sautait à chaque client servi)
  let spd = 0, ph = 0;
  return (dt, t, k) => {
    spd += (k - spd) * Math.min(1, dt * 1.5);
    s.rotation.y += dt * (0.6 + spd * 1.2);
    ph += dt * (1.6 + spd * 1.2);
    s.position.y = 0.05 + Math.sin(ph) * 0.05;
  };
}
function blender(g, col) { // blender : le mélange tourbillonne, la machine vibre
  table(g);
  const base = add(rbox(0.26, 0.2, 0.26, 0.04, dark()), 0, 0.1, 0, g);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.4, 16, 1, true), C('#ffffff', { transparent: true, opacity: 0.3 }));
  jar.material.side = THREE.DoubleSide; jar.position.y = 0.4; g.add(jar);
  const mix = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16, 1, true), C(col, { r: 0.4 })); mix.rotation.x = Math.PI; mix.position.y = 0.37; g.add(mix);
  add(cyl(0.15, 0.15, 0.04, dark(), 16), 0, 0.62, 0, g);
  return (dt, t, k) => { mix.rotation.y += dt * (2 + k * 25); mix.scale.y = 1 + Math.sin(t * 9) * 0.08 * k; base.position.x = Math.sin(t * 60) * 0.006 * k; jar.position.x = base.position.x; };
}
function fryer(g, col, spiral = false) { // friteuse : le panier plonge et ressort, l'huile bouillonne
  table(g);
  add(box(0.6, 0.3, 0.45, steel()), 0, 0.15, 0, g);
  add(box(0.52, 0.02, 0.37, C('#c98a3a', { r: 0.1 })), 0, 0.29, 0, g);
  const basket = new THREE.Group();
  const wire = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.28), new THREE.MeshStandardMaterial({ color: '#c9ccd1', wireframe: true }));
  basket.add(wire);
  add(cyl(0.015, 0.015, 0.35, dark(), 6), 0.32, 0.1, 0, basket).rotation.z = -1.0;
  if (spiral) { for (let i = 0; i < 10; i++) { const a = i * 0.9; add(sph(0.035, C(col), 6, 4), Math.cos(a) * 0.12 * (1 - i / 12), -0.03, Math.sin(a) * 0.08, basket); } }
  else for (let i = 0; i < 8; i++) add(box(0.04, 0.04, 0.16, C(col)), -0.14 + (i % 4) * 0.09, -0.04 + Math.floor(i / 4) * 0.04, (i % 2) * 0.05, basket).rotation.y = i;
  g.add(basket);
  const bub = bubbles(g, { y0: 0.29, y1: 0.33, r: 0.22, color: '#ffe8b0' });
  const steam = puffs(g, { y: 0.35, size: 0.13, spread: 0.3, opacity: 0.35 });
  return (dt, t, k) => { const p = (t * (0.2 + k * 0.35)) % 1; basket.position.y = p < 0.7 ? 0.3 : 0.3 + Math.sin((p - 0.7) / 0.3 * Math.PI) * 0.25; bub(dt, 0.4 + k); steam(dt, k); };
}
function press(g, col, waffle) { // gaufrier / presse à panini : le couvercle s'ouvre et se ferme
  table(g);
  add(box(0.5, 0.1, 0.4, dark()), 0, 0.05, 0, g);
  add(box(0.36, 0.03, 0.26, C(col, { r: 0.7 })), 0, 0.115, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, 0.12, -0.2);
  add(box(0.5, 0.08, 0.4, dark()), 0, 0.04, 0.2, lid);
  add(cyl(0.02, 0.02, 0.3, C(waffle ? '#e63946' : '#bc6c25'), 6), 0, 0.1, 0.42, lid).rotation.z = Math.PI / 2;
  g.add(lid);
  const steam = puffs(g, { y: 0.2, size: 0.12, spread: 0.25, opacity: 0.4 });
  return (dt, t, k) => { const p = (t * (0.25 + k * 0.4)) % 1; lid.rotation.x = p < 0.65 ? 0 : -Math.sin((p - 0.65) / 0.35 * Math.PI) * 1.1; steam(dt, p < 0.65 ? k : 0); };
}
function softServe(g, col, roofCone) { // machine à glace : la crème sort en tourbillon
  table(g);
  add(rbox(0.4, 0.55, 0.35, 0.05, C('#f1f1f1')), 0, 0.28, -0.05, g);
  add(cyl(0.03, 0.04, 0.08, steel(), 8), 0, 0.5, 0.17, g);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), C('#d9a55b', { r: 0.8 })); cone.rotation.x = Math.PI; g.add(cone);
  const swirl = new THREE.Group(); g.add(swirl);
  for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.TorusGeometry(0.05 - i * 0.01, 0.025, 6, 12), C(col, { r: 0.6 })), 0, i * 0.035, 0, swirl).rotation.x = Math.PI / 2;
  let big = null;
  if (roofCone) {
    big = new THREE.Group(); big.position.set(-1.6, 2.9, 0.9);
    const bc = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), C('#d9a55b', { r: 0.8 })); bc.rotation.x = Math.PI; big.add(bc);
    add(sph(0.25, C('#ff8fab'), 14, 10), 0, 0.35, 0, big); add(sph(0.2, C('#fff1e6'), 14, 10), 0, 0.58, 0, big);
    g.add(big);
  }
  return (dt, t, k) => {
    const p = (t * (0.25 + k * 0.4)) % 1;
    cone.position.set(0, 0.28, 0.2); swirl.position.set(0, 0.37, 0.2);
    swirl.scale.setScalar(Math.max(0.01, Math.min(1, p * 1.4)));
    swirl.rotation.y += dt * 6;
    if (big) { big.rotation.y += dt * (0.5 + k); }
  };
}
function skewerGrill(g, col) { // grill : les brochettes tournent, la fumée monte
  table(g);
  add(box(0.7, 0.18, 0.4, dark()), 0, 0.09, 0, g);
  add(box(0.62, 0.02, 0.32, new THREE.MeshStandardMaterial({ color: '#ff5a1f', emissive: '#ff3c00', emissiveIntensity: 1.2 })), 0, 0.18, 0, g);
  const sk = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group(); s.position.set(0, 0.26, -0.12 + i * 0.08);
    add(cyl(0.006, 0.006, 0.7, steel(), 4), 0, 0, 0, s).rotation.z = Math.PI / 2;
    for (let j = 0; j < 4; j++) add(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.016, 6, 10, Math.PI * 1.3), C(col)), -0.18 + j * 0.12, 0, 0, s).rotation.y = Math.PI / 2;
    g.add(s); sk.push(s);
  }
  const smoke = puffs(g, { y: 0.35, color: '#b8b3ad', size: 0.16, spread: 0.45, opacity: 0.4 });
  return (dt, t, k) => { sk.forEach((s, i) => { s.rotation.x += dt * (0.8 + k * 3) * (i % 2 ? 1 : -1); }); smoke(dt, 0.4 + k * 0.6); };
}
function shaker(g, col) { // shaker à cocktails qui s'agite
  table(g);
  for (let i = 0; i < 3; i++) {
    add(cyl(0.05, 0.035, 0.14, C(['#ffd166', '#ef476f', '#06d6a0'][i], { transparent: true, opacity: 0.85 }), 10), -0.25 + i * 0.12, 0.07, 0.15, g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.04, 8), C(col)), -0.25 + i * 0.12, 0.2, 0.15, g);
  }
  const sh = new THREE.Group(); add(cyl(0.06, 0.05, 0.22, steel(), 12), 0, 0, 0, sh); add(cyl(0.04, 0.06, 0.08, steel(), 12), 0, 0.15, 0, sh);
  g.add(sh);
  return (dt, t, k) => { const a = k > 0.2 ? Math.sin(t * 22) : Math.sin(t * 2) * 0.2; sh.position.set(0.2 + a * 0.05, 0.35 + a * 0.1 * (0.3 + k), -0.05); sh.rotation.z = a * 0.4; };
}

/** Machine animée d'un stand (clé : 'truck0'…'truck3', ou « zone-spécialité » comme 'fair-cotton'). */
export function buildStandFx(key) {
  const make = FX[key];
  if (!make) return null;
  const group = new THREE.Group();
  const update = make(group);
  group.traverse((o) => { if (o.isMesh && o.castShadow !== false && !(o.material.transparent)) { o.castShadow = true; o.receiveShadow = true; } });
  return { group, update, rooftop: key.startsWith('truck') };
}
