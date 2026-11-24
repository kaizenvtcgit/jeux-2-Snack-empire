import { THREE, M, add, box, cyl, sph } from './util.js';

/*
 * Les vendeurs travaillent : chacun reçoit deux bras, un ustensile dans la main droite
 * (spatule, couteau, louche, cuillère à glace, shaker…) et un geste propre à son stand
 * (retourner les steaks, trancher, remuer, plonger le panier dans la friteuse, secouer le shaker…).
 * Ils travaillent tout le temps, plus vite et plus franchement quand le stand sert un client.
 *
 * Repère d'un vendeur : il regarde vers +z (le comptoir). Rotation x négative d'un bras = bras levé vers l'avant.
 */

const C = (c, o = {}) => M(c, { r: 0.5, cached: true, ...o });
const steel = () => C('#d0d3d8', { r: 0.3, m: 0.7 });
const wood = () => C('#a8733f', { r: 0.8 });
const TAU = Math.PI * 2;
const RAISE = 0.35; // bras levés un peu plus haut que la pose « naturelle »

/* ---------- Ustensiles (tenus dans la main, pointant dans le prolongement du bras : -y) ---------- */
const TOOLS = {
  spatula: (h) => { add(cyl(0.012, 0.012, 0.26, wood(), 6), 0, -0.13, 0, h); add(box(0.12, 0.13, 0.01, steel()), 0, -0.31, 0.02, h); },
  knife: (h) => { add(box(0.03, 0.08, 0.03, C('#222222')), 0, -0.05, 0, h); add(box(0.012, 0.24, 0.05, steel()), 0, -0.2, 0.01, h); },
  ladle: (h) => { add(cyl(0.01, 0.01, 0.32, steel(), 6), 0, -0.16, 0, h); add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, TAU, 0, Math.PI / 2), steel()), 0, -0.33, 0, h).rotation.x = Math.PI; },
  scoop: (h) => { add(cyl(0.015, 0.015, 0.16, C('#e63946'), 6), 0, -0.08, 0, h); add(sph(0.045, steel(), 10, 6), 0, -0.19, 0, h); add(sph(0.05, C('#ffd1dc'), 10, 6), 0, -0.22, 0.03, h); },
  shaker: (h) => { add(cyl(0.05, 0.04, 0.2, steel(), 12), 0, -0.08, 0.03, h); add(cyl(0.03, 0.05, 0.07, steel(), 12), 0, -0.21, 0.03, h); },
  basket: (h) => {
    add(cyl(0.012, 0.012, 0.25, C('#222222'), 6), 0, -0.12, 0, h);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.14), new THREE.MeshStandardMaterial({ color: '#c9ccd1', wireframe: true }));
    b.position.set(0, -0.3, 0.03); h.add(b);
    add(box(0.16, 0.06, 0.1, C('#e9b872')), 0, -0.31, 0.03, h);
  },
  tongs: (h) => { for (const s of [-1, 1]) { const a = box(0.012, 0.26, 0.012, steel()); a.position.set(s * 0.02, -0.13, 0); a.rotation.z = s * 0.08; h.add(a); } },
  stick: (h) => { add(cyl(0.01, 0.01, 0.4, C('#ffffff'), 6), 0, -0.18, 0, h); const c = sph(0.13, C('#ffb3d9', { r: 1 }), 12, 8); c.scale.set(1, 1.2, 1); c.position.y = -0.38; h.add(c); },
  apple: (h) => { add(cyl(0.008, 0.008, 0.22, wood(), 6), 0, -0.1, 0, h); add(sph(0.07, C('#c1121f', { cc: true }), 10, 8), 0, -0.25, 0, h); },
  jug: (h) => { add(cyl(0.07, 0.06, 0.2, C('#ffffff', { transparent: true, opacity: 0.5 }), 12), 0, -0.1, 0.06, h); add(cyl(0.06, 0.06, 0.14, C('#ffe066', { r: 0.2 }), 12), 0, -0.12, 0.06, h); },
  fruit: (h) => { add(sph(0.06, C('#ff7f11'), 10, 8), 0, -0.06, 0.02, h); },
  roll: (h) => { const r = cyl(0.04, 0.04, 0.22, C('#1b4332', { r: 0.6 }), 10); r.rotation.z = Math.PI / 2; r.position.set(0.06, -0.06, 0.02); h.add(r); },
  dough: (h) => { const d = sph(0.08, C('#f3e2c3', { r: 0.9 }), 10, 8); d.scale.set(1.3, 0.6, 1); d.position.set(0.05, -0.05, 0.03); h.add(d); },
  piping: (h) => { const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 10), C('#ffffff')); p.position.set(0, -0.12, 0.02); p.rotation.x = Math.PI; h.add(p); },
  fish: (h) => { const f = sph(0.06, C('#f08a5d'), 10, 8); f.scale.set(0.7, 2.4, 0.35); f.position.y = -0.18; h.add(f); },
  cup: (h) => { add(cyl(0.045, 0.035, 0.1, C('#ffffff'), 10), 0, -0.05, 0.03, h); },
  cone: (h) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 8), C('#d9a55b', { r: 0.8 })); c.position.set(0, -0.02, 0.04); c.rotation.x = Math.PI; h.add(c); add(sph(0.04, C('#fff1e6'), 8, 6), 0, 0.05, 0.04, h); },
  plate: (h) => { add(cyl(0.12, 0.1, 0.015, C('#ffffff'), 16), 0, -0.04, 0.06, h); add(cyl(0.06, 0.06, 0.04, C('#d99a4e'), 12), 0, -0.01, 0.06, h); },
  bag: (h) => { add(box(0.12, 0.16, 0.07, C('#f4e3c3', { r: 0.9 })), 0, -0.1, 0.03, h); },
  none: () => {},
};

/*
 * Gestes. Chaque geste donne, pour un instant de travail w (en tours) et une ampleur a :
 * r / l = [rotation x, rotation z] des bras droit / gauche ; lean = penché vers l'avant ; bob = petit saut ; turn = tête/corps.
 */
const pulse = (w, at = 0.15) => { const p = w % 1; return p < at ? Math.sin(p / at * Math.PI) : 0; };
const ACTIONS = {
  // retourner les steaks / la crêpe : la spatule bascule d'un coup sec
  flip: { tools: ['spatula', 'plate'], f: 0.8, pose: (w, a) => ({ r: [-1.25 - 0.6 * a * pulse(w, 0.25), 0.1], l: [-0.9, -0.15], lean: 0.08 }) },
  // trancher : le couteau monte et descend
  chop: { tools: ['knife', 'none'], f: 1.6, pose: (w, a) => ({ r: [-1.15 + 0.35 * a * Math.abs(Math.sin(w * Math.PI)), 0.12], l: [-1.0, -0.25], lean: 0.12 }) },
  // remuer : la louche décrit des cercles
  stir: { tools: ['ladle', 'none'], f: 0.6, pose: (w, a) => ({ r: [-1.2 + 0.18 * a * Math.sin(w * TAU), 0.1 + 0.28 * a * Math.cos(w * TAU)], l: [-0.35, -0.1], lean: 0.1 }) },
  // servir une glace : on plonge la cuillère, on la remonte et on garnit le cornet
  scoop: { tools: ['scoop', 'cone'], f: 0.5, pose: (w, a) => { const p = w % 1; return { r: [p < 0.5 ? -0.9 - 0.4 * a * Math.sin(p * 2 * Math.PI) : -1.4, p < 0.5 ? 0.2 : -0.05], l: [-1.3, -0.1], lean: p < 0.5 ? 0.18 * a : 0.02 }; } },
  // secouer le shaker / le blender au-dessus de l'épaule
  shake: { tools: ['shaker', 'none'], f: 2.6, pose: (w, a) => { const s = Math.sin(w * TAU); return { r: [-2.3 + 0.25 * a * s, 0.15], l: [-2.1 + 0.25 * a * s, -0.35], bob: 0.03 * a * Math.abs(s) }; } },
  // pétrir / dresser : les deux mains appuient tour à tour
  knead: { tools: ['dough', 'none'], f: 0.9, pose: (w, a) => ({ r: [-1.05 + 0.25 * a * Math.sin(w * TAU), 0.15], l: [-1.05 + 0.25 * a * Math.sin(w * TAU + Math.PI), -0.15], lean: 0.18 + 0.05 * Math.sin(w * TAU) }) },
  pipe: { tools: ['piping', 'none'], f: 0.7, pose: (w, a) => ({ r: [-1.3 + 0.1 * a * Math.sin(w * TAU), 0.2 * a * Math.cos(w * TAU)], l: [-1.15, -0.2], lean: 0.12 }) },
  // plonger le panier dans la friteuse puis le secouer
  dip: { tools: ['basket', 'none'], f: 0.45, pose: (w, a) => { const p = w % 1; const up = p < 0.7 ? 0 : Math.sin((p - 0.7) / 0.3 * Math.PI); return { r: [-0.95 - 0.55 * a * up + (up > 0.6 ? 0.06 * Math.sin(w * 60) : 0), 0.15], l: [-0.4, -0.1], lean: 0.08 }; } },
  // retourner les brochettes / saucisses avec la pince
  turn: { tools: ['tongs', 'none'], f: 0.9, pose: (w, a) => ({ r: [-1.15 + 0.15 * a * pulse(w, 0.4), 0.3 * a * Math.sin(w * TAU)], l: [-0.5, -0.1], lean: 0.1 }) },
  // verser : le pichet s'incline au-dessus du gobelet
  pour: { tools: ['jug', 'cup'], f: 0.4, pose: (w, a) => { const p = w % 1; const tilt = p < 0.6 ? Math.sin(p / 0.6 * Math.PI) : 0; return { r: [-1.45 - 0.2 * a * tilt, 0.2 + 0.5 * a * tilt], l: [-1.2, -0.1] }; } },
  // rouler les makis
  roll: { tools: ['roll', 'none'], f: 1.1, pose: (w, a) => ({ r: [-1.1 + 0.15 * a * Math.sin(w * TAU), 0.12], l: [-1.1 + 0.15 * a * Math.sin(w * TAU), -0.12], lean: 0.15 }) },
  // enrouler la barbe à papa autour du bâton, au-dessus de la cuve
  twirl: { tools: ['stick', 'none'], f: 0.7, pose: (w, a) => ({ r: [-1.35 + 0.2 * a * Math.sin(w * TAU), 0.35 * a * Math.cos(w * TAU)], l: [-0.3, -0.1], turn: 0.25 }) },
  // tremper la pomme dans le caramel et la faire tourner
  dipapple: { tools: ['apple', 'none'], f: 0.45, pose: (w, a) => { const p = w % 1; return { r: [-1.0 - 0.5 * a * Math.sin(p * Math.PI), 0.1 + 0.15 * Math.sin(w * 12)], l: [-0.4, -0.1], lean: 0.1 }; } },
  // le primeur choisit un fruit dans la cagette et le met dans le sac
  pick: { tools: ['fruit', 'bag'], f: 0.5, pose: (w, a) => { const p = w % 1; return { r: [p < 0.5 ? -0.6 - 0.2 * a * Math.sin(p * 2 * Math.PI) : -1.3, p < 0.5 ? 0.35 : -0.15], l: [-1.1, -0.15], lean: p < 0.5 ? 0.25 * a : 0 }; } },
  // le fumoir : on accroche / décroche les saumons, bras levé
  hang: { tools: ['fish', 'none'], f: 0.35, pose: (w, a) => ({ r: [-2.3 - 0.3 * a * Math.sin(w * TAU), 0.15], l: [-0.6, -0.1], bob: 0.02 * Math.abs(Math.sin(w * TAU)) }) },
};

/** Geste de chaque stand (mêmes clés que les machines : 'truck0', 'fair-cotton'…). */
export const STAND_ACTION = {
  truck0: 'flip', truck1: 'dip', truck2: 'chop', truck3: 'turn',
  'market-bread': 'knead', 'market-cheese': 'chop', 'market-fruit': 'pick', 'market-fish': 'chop', 'market-charcuterie': 'chop', 'market-pastry': 'pipe',
  'port-fishchips': 'dip', 'port-shrimp': 'turn', 'port-oysters': 'chop', 'port-sushi': 'roll', 'port-paella': 'stir', 'port-icecream': 'scoop', 'port-salmon': 'hang', 'port-cocktail': 'shake',
  'fair-cotton': 'twirl', 'fair-apple': 'dipapple', 'fair-churros': 'dip', 'fair-waffle': 'flip', 'fair-popcorn': 'scoop', 'fair-hotdog': 'turn', 'fair-donut': 'dip', 'fair-lemonade': 'pour',
  'beach-icecream': 'scoop', 'beach-granita': 'pour', 'beach-watermelon': 'chop', 'beach-crepe': 'flip', 'beach-shrimp': 'dip', 'beach-panini': 'flip', 'beach-coconut': 'chop', 'beach-smoothie': 'shake',
};

/** Ajoute des bras + ustensiles aux vendeurs et renvoie la fonction d'animation update(dt, t, k). */
export function rigChefs(chefs, actionName, raise = RAISE) {
  const A = ACTIONS[actionName] || ACTIONS.flip;
  const rigs = chefs.map((c, i) => {
    const body = c.children.find((o) => o.isMesh && o.geometry.type === 'CapsuleGeometry');
    const head = c.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry' && o.position.y > (body ? body.position.y : 0));
    const by = body ? body.position.y : 1.05;
    const sleeve = body ? body.material : C('#ffffff');
    const skin = head ? head.material : C('#e0ac80');
    const shY = by + 0.3;
    const arms = [1, -1].map((s, side) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.27, shY, 0.02);
      add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 8), sleeve), 0, -0.2, 0, sh);
      const hand = new THREE.Group(); hand.position.y = -0.44; sh.add(hand);
      add(sph(0.055, skin, 10, 8), 0, 0, 0, hand);
      (TOOLS[A.tools[side]] || TOOLS.none)(hand);
      sh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      c.add(sh);
      return sh;
    });
    return { c, arms, head, headY: head ? head.position.y : 0, ph: i * 0.37 + Math.random() * 0.2, w: Math.random() };
  });
  return (dt, t, k) => {
    const speed = 0.55 + 0.75 * k, amp = 0.65 + 0.35 * k;
    for (const r of rigs) {
      if (!r.c.visible) continue;
      r.w += dt * A.f * speed;
      const p = A.pose(r.w + r.ph, amp);
      // on travaille au-dessus du comptoir (sinon les mains restent cachées derrière)
      const up = (x) => (x > -2 ? x - raise : x);
      r.arms[0].rotation.set(up(p.r[0]), 0, p.r[1]);
      r.arms[1].rotation.set(up(p.l[0]), 0, p.l[1]);
      r.c.rotation.x = p.lean || 0;
      r.c.rotation.y = (p.turn || 0) * Math.sin(t * 0.7 + r.ph) + Math.sin(t * 0.3 + r.ph * 5) * 0.08;
      if (p.bob) r.c.position.y = p.bob;
    }
  };
}
