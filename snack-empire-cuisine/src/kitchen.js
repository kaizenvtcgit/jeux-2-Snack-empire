import { THREE, M, add, rbox, box, cyl, sph, money } from './util.js';
import * as E from './economy.js';
import { L } from './i18n.js';
import { sfx } from './audio.js';

/*
 * Cuisine : le joueur entre dans le camion n°1 et prépare lui-même les hot-dogs.
 *
 * Déroulement d'un hot-dog :
 *   1. clic sur la barquette de saucisses → une saucisse crue se pose sur le grill
 *   2. la face du dessous cuit : clic sur la saucisse pour la retourner quand la jauge est dans le vert
 *   3. clic sur la corbeille de pains → un pain se pose sur la planche
 *   4. clic sur la saucisse (déjà retournée) → elle va dans le pain
 *   5. clic sur ketchup / moutarde / oignons selon la commande du client
 *   6. clic sur le hot-dog → servi ! Le prix dépend de la cuisson et du respect de la commande.
 *
 * Pendant ce temps, les autres stands continuent de vendre tout seuls ; ce camion-ci attend le joueur.
 * Tout est construit dans le repère du stand (comptoir/fenêtre vers +z, fenêtre centrée en x = -0,9).
 */

const COOK_RATE = 1 / 5; // une face est cuite en 5 s environ
const GOOD = [0.75, 1.35]; // cuisson parfaite (jauge dans le vert)
const BURNT = 1.7; // au-delà : brûlée
const TOPPINGS = ['ketchup', 'mustard', 'onions'];
export const TOPPING_NAMES = {
  ketchup: () => L('ketchup', 'ketchup'),
  mustard: () => L('moutarde', 'mustard'),
  onions: () => L('oignons', 'onions'),
};
const TOPPING_EMOJI = { ketchup: '🍅', mustard: '🟡', onions: '🧅' };
const GRILL_SLOTS = [0.66, 0.82, 0.98]; // z des saucisses sur le grill
const GRILL_X = 0.15;
const BOARD = new THREE.Vector3(-0.72, 1.5, 0.82);

/** Commande au hasard : au moins une garniture. */
export function randomOrder() {
  let set;
  do set = TOPPINGS.filter(() => Math.random() < 0.5); while (!set.length);
  return set;
}

/** Note de cuisson d'une face (0 → 1). */
function sideScore(v) {
  if (v < 0.5) return 0;
  if (v < GOOD[0]) return 0.6;
  if (v <= GOOD[1]) return 1;
  if (v <= BURNT) return 0.6;
  return 0.1;
}

/** Couleur d'une face selon sa cuisson : rose cru → doré → brun → noir. */
const RAW = new THREE.Color('#e9968f'), DONE = new THREE.Color('#a4512a'), DARK = new THREE.Color('#5a2614'), BURN = new THREE.Color('#1c1210');
function cookColor(v, out) {
  if (v < 1) return out.copy(RAW).lerp(DONE, Math.max(0, v));
  if (v < BURNT) return out.copy(DONE).lerp(DARK, (v - 1) / (BURNT - 1));
  return out.copy(DARK).lerp(BURN, Math.min(1, (v - BURNT) / 0.4));
}

export class Kitchen {
  constructor(world, game, ui, stand) {
    this.world = world; this.game = game; this.ui = ui; this.stand = stand;
    this.active = false;
    this.sausages = []; // sur le grill
    this.dog = null; // hot-dog en préparation sur la planche
    this.flying = []; // hot-dogs servis, en vol vers le client
    this.camX = -0.72;
    this.hover = null;
    this.lastDrag = 0;

    this.group = new THREE.Group();
    this.group.visible = false;
    stand.root.add(this.group);
    this.clickables = [];
    this.buildRoom();
    this.buildStations();

    this.ray = new THREE.Raycaster();
    this.ptr = new THREE.Vector2();
    this.buildUI();
    this.bindInput();
  }

  /* ---------------- Décor : l'intérieur du camion ---------------- */
  buildRoom() {
    const g = this.group;
    const wall = M('#e4e7ea', { r: 0.55, m: 0.15 });
    const steel = M('#c9ced4', { r: 0.28, m: 0.85 });
    const floorM = M('#3b3f46', { r: 0.8 });
    const dark = M('#2b2e33', { r: 0.5, m: 0.5 });
    const X0 = -3.2, X1 = 1.95, Z0 = -1.15, Z1 = 1.17, F = 0.75, C = 3.0;
    const W0 = -2.45, W1 = 0.65, S0 = 1.525, S1 = 2.575; // ouverture de la fenêtre de service
    add(box(X1 - X0, 0.05, Z1 - Z0, floorM), (X0 + X1) / 2, F, 0, g);
    add(box(X1 - X0, 0.05, Z1 - Z0, wall), (X0 + X1) / 2, C, 0, g);
    add(box(0.05, C - F, Z1 - Z0, wall), X0, (F + C) / 2, 0, g);
    add(box(0.05, C - F, Z1 - Z0, wall), X1, (F + C) / 2, 0, g);
    add(box(X1 - X0, C - F, 0.05, wall), (X0 + X1) / 2, (F + C) / 2, Z0, g);
    // mur de la fenêtre : 4 morceaux autour de l'ouverture
    add(box(X1 - X0, S0 - F, 0.06, wall), (X0 + X1) / 2, (F + S0) / 2, Z1, g);
    add(box(X1 - X0, C - S1, 0.06, wall), (X0 + X1) / 2, (S1 + C) / 2, Z1, g);
    add(box(W0 - X0, S1 - S0, 0.06, wall), (X0 + W0) / 2, (S0 + S1) / 2, Z1, g);
    add(box(X1 - W1, S1 - S0, 0.06, wall), (W1 + X1) / 2, (S0 + S1) / 2, Z1, g);
    // cadre chromé de la fenêtre
    for (const [w, h, x, y] of [[W1 - W0 + 0.08, 0.04, (W0 + W1) / 2, S0], [W1 - W0 + 0.08, 0.04, (W0 + W1) / 2, S1], [0.04, S1 - S0, W0, (S0 + S1) / 2], [0.04, S1 - S0, W1, (S0 + S1) / 2]]) {
      add(box(w, h, 0.1, steel), x, y, Z1, g);
    }
    // plan de travail en inox + meubles bas
    add(rbox(X1 - X0 - 0.1, 0.06, 0.72, 0.02, steel), (X0 + X1) / 2, 1.44, 0.8, g);
    add(box(X1 - X0 - 0.1, 0.66, 0.66, M('#9aa3ad', { r: 0.4, m: 0.6 })), (X0 + X1) / 2, 1.08, 0.82, g);
    for (let x = X0 + 0.5; x < X1; x += 0.8) add(box(0.25, 0.025, 0.03, dark), x, 1.3, 0.48, g); // poignées des placards
    // crédence carrelée sous la fenêtre (entre plan et ouverture)
    // tablette extérieure (le comptoir où l'on pose les commandes, côté clients)
    add(rbox(3.6, 0.07, 0.55, 0.02, steel), -0.9, 1.49, 1.45, g);
    // étagère haute avec bocaux (mur du fond, côté gauche et droit de la fenêtre)
    add(box(0.7, 0.03, 0.22, steel), -2.85, 2.3, 1.02, g);
    add(box(1.1, 0.03, 0.22, steel), 1.3, 2.3, 1.02, g);
    const jarCols = ['#e63946', '#f4a62a', '#7fbf9a', '#d9b26f'];
    for (let k = 0; k < 4; k++) add(cyl(0.06, 0.06, 0.16, M(jarCols[k], { r: 0.3, transparent: true, opacity: 0.85, cached: true }), 16), 0.9 + k * 0.25, 2.4, 1.02, g);
    // hotte au-dessus du grill
    const hood = rbox(0.85, 0.3, 0.55, 0.03, steel);
    add(hood, GRILL_X, 2.72, 0.82, g);
    add(box(0.75, 0.02, 0.45, dark), GRILL_X, 2.565, 0.82, g);
    // néon au plafond + lumière chaude de la cuisine
    add(box(2.6, 0.04, 0.12, M('#ffffff', { emissive: '#fff4dc', ei: 2.5 })), -0.9, 2.96, 0.0, g);
    const light = new THREE.PointLight('#ffe6c4', 6, 7, 1.6);
    light.position.set(-0.9, 2.75, 0.1);
    g.add(light);
    const fill = new THREE.PointLight('#ffffff', 2.5, 5, 1.8);
    fill.position.set(-1.1, 2.4, -0.6);
    g.add(fill);
    // l'intérieur ne projette pas d'ombre (sinon le soleil ne passe plus par la fenêtre)
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  }

  /** Une zone cliquable (boîte invisible un peu plus grande que l'objet, plus facile à viser). */
  hit(w, h, d, x, y, z, action, label) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z);
    m.userData = { action, label };
    this.group.add(m);
    this.clickables.push(m);
    return m;
  }

  /* ---------------- Postes de travail ---------------- */
  buildStations() {
    const g = this.group;
    const dark = M('#24262a', { r: 0.45, m: 0.6 });
    const steel = M('#c9ced4', { r: 0.28, m: 0.85 });

    // Grill : plaque + barreaux + boutons
    add(rbox(0.62, 0.08, 0.55, 0.02, dark), GRILL_X, 1.51, 0.82, g);
    const barM = M('#4a4d52', { r: 0.35, m: 0.8 });
    for (let k = 0; k < 9; k++) add(box(0.56, 0.012, 0.012, barM), GRILL_X, 1.556, 0.6 + k * 0.055, g);
    const glow = add(box(0.54, 0.01, 0.48, M('#ff5a1f', { emissive: '#ff3a00', ei: 1.6 })), GRILL_X, 1.548, 0.82, g);
    this.glow = glow;
    for (const dx of [-0.18, 0, 0.18]) add(cyl(0.025, 0.025, 0.03, M('#e0e0e0', { r: 0.3, cached: true }), 14), GRILL_X + dx, 1.5, 0.545, g).rotation.x = Math.PI / 2;
    this.hit(0.66, 0.16, 0.56, GRILL_X, 1.6, 0.82, 'grill', L('Grill', 'Grill'));

    // Barquette de saucisses crues
    const PACK = new THREE.Vector3(0.75, 1.5, 0.8);
    add(rbox(0.34, 0.06, 0.26, 0.015, M('#f2f2ee', { r: 0.4 })), PACK.x, PACK.y, PACK.z, g);
    const rawM = M('#e9968f', { r: 0.45 });
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 6, 12), rawM);
      s.rotation.z = Math.PI / 2;
      add(s, PACK.x, PACK.y + 0.06, PACK.z - 0.09 + k * 0.06, g);
    }
    this.hit(0.4, 0.2, 0.32, PACK.x, PACK.y + 0.06, PACK.z, 'pack', L('Saucisses', 'Sausages'));

    // Planche à découper
    add(rbox(0.52, 0.035, 0.32, 0.012, M('#c58a4c', { r: 0.7 })), BOARD.x, 1.485, BOARD.z, g);
    this.hit(0.56, 0.2, 0.36, BOARD.x, 1.56, BOARD.z, 'board', L('Planche', 'Board'));

    // Corbeille de pains
    const BASKET = new THREE.Vector3(-1.25, 1.5, 0.8);
    add(cyl(0.17, 0.14, 0.1, M('#a8733f', { r: 0.85 }), 24), BASKET.x, BASKET.y + 0.02, BASKET.z, g);
    for (let k = 0; k < 3; k++) {
      const b = makeBun();
      b.position.set(BASKET.x - 0.06 + k * 0.06, BASKET.y + 0.08 + (k % 2) * 0.02, BASKET.z - 0.05 + k * 0.05);
      b.rotation.y = 0.6 + k * 0.5;
      b.scale.setScalar(0.85);
      g.add(b);
    }
    this.hit(0.38, 0.22, 0.38, BASKET.x, BASKET.y + 0.06, BASKET.z, 'bun', L('Pains', 'Buns'));

    // Sauces et oignons
    const bottle = (color, cap, x) => {
      const b = new THREE.Group();
      add(cyl(0.042, 0.046, 0.2, M(color, { r: 0.35, cc: true }), 20), 0, 0.1, 0, b);
      add(cyl(0.02, 0.042, 0.05, M(color, { r: 0.35 }), 20), 0, 0.225, 0, b);
      add(cyl(0.008, 0.018, 0.05, M(cap, { r: 0.4 }), 12), 0, 0.27, 0, b);
      b.position.set(x, 1.47, 0.86);
      g.add(b);
      return b;
    };
    this.ketchup = bottle('#d62828', '#f1f1ea', -1.58);
    this.mustard = bottle('#f2c600', '#e63946', -1.73);
    this.hit(0.13, 0.34, 0.16, -1.58, 1.62, 0.86, 'ketchup', '🍅 Ketchup');
    this.hit(0.13, 0.34, 0.16, -1.73, 1.62, 0.86, 'mustard', L('🟡 Moutarde', '🟡 Mustard'));
    // bol d'oignons
    add(cyl(0.11, 0.08, 0.07, M('#2a6f97', { r: 0.3, cc: true }), 24), -1.95, 1.505, 0.82, g);
    const onionM = M('#f3ecd8', { r: 0.6, cached: true });
    for (let k = 0; k < 14; k++) add(box(0.025, 0.015, 0.025, onionM), -1.95 + (Math.random() - 0.5) * 0.14, 1.545, 0.82 + (Math.random() - 0.5) * 0.14, g);
    this.hit(0.24, 0.16, 0.24, -1.95, 1.54, 0.82, 'onions', L('🧅 Oignons', '🧅 Onions'));

    // Poubelle à pédale (sur le comptoir, à droite)
    const bin = new THREE.Group();
    add(cyl(0.12, 0.1, 0.24, M('#5b6470', { r: 0.4, m: 0.6 }), 24), 0, 0.12, 0, bin);
    add(cyl(0.125, 0.125, 0.02, steel, 24), 0, 0.25, 0, bin);
    bin.position.set(-2.22, 1.47, 0.8);
    g.add(bin);
    this.hit(0.3, 0.34, 0.3, -2.22, 1.62, 0.8, 'trash', L('🗑️ Poubelle', '🗑️ Trash'));

    // Petite sonnette sur la tablette extérieure (décor)
    add(cyl(0.05, 0.06, 0.02, steel, 20), -2.1, 1.535, 1.4, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#d9b26f', { r: 0.25, m: 0.9 })), -2.1, 1.545, 1.4, g);

    this.group.traverse((o) => { if (o.isMesh && o.material.opacity !== 0) { o.castShadow = false; o.receiveShadow = true; } });
  }

  /* ---------------- Interface (HTML) ---------------- */
  buildUI() {
    const mk = (tag, id, html = '') => { const e = document.createElement(tag); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
    this.enterBtn = mk('button', 'kitchen-btn', `👨‍🍳 ${L('Cuisiner', 'Cook')}<small>${L('Entrer dans le camion 1', 'Step into truck 1')}</small>`);
    this.exitBtn = mk('button', 'kitchen-exit', `⬅ ${L('Sortir', 'Exit')}`);
    this.ticket = mk('div', 'kitchen-ticket');
    this.hint = mk('div', 'kitchen-hint');
    this.label = mk('div', 'kitchen-label');
    this.gauges = mk('div', 'kitchen-gauges');
    this.enterBtn.addEventListener('click', () => this.enter());
    this.exitBtn.addEventListener('click', () => this.exit());
    addEventListener('keydown', (e) => { if (this.active && e.key === 'Escape') this.exit(); });
  }

  /** Le bouton « Cuisiner » n'apparaît que sur le parking (niveau 1). */
  syncButton() {
    const show = !this.active && this.ui.zone === 'parking' && this.stand.unlocked;
    this.enterBtn.classList.toggle('show', show);
  }

  /* ---------------- Souris / doigt ---------------- */
  bindInput() {
    const el = this.world.renderer.domElement;
    let down = null;
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.ptr, this.world.camera);
      const targets = [...this.clickables, ...this.sausages.map((s) => s.hitbox), ...(this.dog ? [this.dog.hitbox] : [])];
      const hits = this.ray.intersectObjects(targets, false);
      // les saucisses et le hot-dog passent avant le grill et la planche sur lesquels ils sont posés
      const h = hits.find((x) => x.object.userData.ref || x.object.userData.action === 'dog') || hits[0];
      return h ? h.object : null;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      down = { x: e.clientX, y: e.clientY, camX: this.camX, moved: false };
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (down) {
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 8) down.moved = true;
        // glisser sur le côté : on se déplace le long du plan de travail (utile sur téléphone)
        if (down.moved) this.lastDrag = performance.now();
        if (down.moved) this.camX = THREE.MathUtils.clamp(down.camX + dx / innerWidth * 2.2, -1.9, 0.45);
      }
      const o = pick(e);
      this.setHover(o, e);
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.active || !down) return;
      const wasDrag = down.moved;
      down = null;
      if (wasDrag) return;
      const o = pick(e);
      if (o) this.act(o.userData.action, o.userData.ref);
    });
    el.addEventListener('pointerleave', () => { down = null; this.setHover(null); });
  }

  setHover(o, e) {
    this.hover = o;
    this.world.renderer.domElement.style.cursor = this.active ? (o ? 'pointer' : 'ew-resize') : 'grab';
    if (o && e && o.userData.label) {
      this.label.textContent = o.userData.label;
      this.label.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 10}px)`;
      this.label.classList.add('show');
    } else this.label.classList.remove('show');
  }

  /* ---------------- Entrer / sortir ---------------- */
  enter() {
    if (this.active) return;
    const w = this.world;
    this.active = true;
    this.saved = { pos: w.camera.position.clone(), target: w.controls.target.clone(), fov: w.camera.fov };
    w.controls.enabled = false;
    // on cache la carrosserie du camion (on est dedans) : seuls l'auvent et l'ardoise restent visibles
    this.stand.truck.group.traverse((o) => {
      if (o.isMesh && o.userData.part && o.userData.part !== 'Awning') { o.userData.wasVisible = o.visible; o.visible = false; }
    });
    this.stand.truck.chefs.forEach((c) => { c.userData.wasVisible = c.visible; c.visible = false; });
    this.group.visible = true;
    this.stand.manual = true;
    if (this.stand.serving) { this.stand.serving = null; } // le vendeur s'efface : c'est toi qui sers
    document.body.classList.add('in-kitchen');
    this.camX = -0.72;
    this.anim = 0; // petite entrée en douceur
    this.from = { pos: w.camera.position.clone(), target: w.controls.target.clone() };
    w.fixed = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: w.camera.fov };
    sfx.click();
    this.syncButton();
  }

  exit() {
    if (!this.active) return;
    const w = this.world;
    this.active = false;
    w.fixed = null;
    w.camera.fov = this.saved.fov; w.camera.updateProjectionMatrix();
    w.camera.position.copy(this.saved.pos);
    w.controls.target.copy(this.saved.target);
    w.controls.enabled = true;
    w.controls.update();
    this.stand.truck.group.traverse((o) => { if (o.isMesh && o.userData.part && o.userData.wasVisible !== undefined) o.visible = o.userData.wasVisible; });
    this.stand.truck.chefs.forEach((c) => { c.visible = c.userData.wasVisible; });
    this.group.visible = false;
    this.stand.manual = false;
    for (const q of this.stand.queue) q.order = null;
    document.body.classList.remove('in-kitchen');
    this.setHover(null);
    this.gauges.innerHTML = '';
    sfx.click();
    this.syncButton();
  }

  /* ---------------- Actions ---------------- */
  act(action, ref) {
    switch (action) {
      case 'pack': return this.addSausage();
      case 'grill': return this.addSausage();
      case 'sausage': return this.clickSausage(ref);
      case 'bun': case 'board': return this.addBun();
      case 'ketchup': case 'mustard': case 'onions': return this.addTopping(action);
      case 'dog': return this.serve();
      case 'trash': return this.trash();
      default:
    }
  }

  addSausage() {
    const free = GRILL_SLOTS.findIndex((_, i) => !this.sausages.some((s) => s.slot === i));
    if (free < 0) { this.say(L('Le grill est plein !', 'The grill is full!')); sfx.nope(); return; }
    const mat = new THREE.MeshStandardMaterial({ color: RAW.clone(), roughness: 0.45, envMapIntensity: 0.7 });
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.22, 6, 14), mat);
    mesh.rotation.z = Math.PI / 2;
    const s = { slot: free, sides: [0, 0], down: 0, flips: 0, flipT: 1, mesh, mat };
    mesh.position.set(GRILL_X, 1.6, GRILL_SLOTS[free]);
    this.group.add(mesh);
    s.hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    s.hitbox.userData = { action: 'sausage', ref: s, label: L('Saucisse : clic = retourner', 'Sausage: click = flip') };
    s.hitbox.position.copy(mesh.position);
    this.group.add(s.hitbox);
    s.gauge = document.createElement('div');
    s.gauge.className = 'kg';
    s.gauge.innerHTML = '<i class="kg-good"></i><b></b>';
    this.gauges.appendChild(s.gauge);
    this.sausages.push(s);
    sfx.click();
  }

  removeSausage(s) {
    this.group.remove(s.mesh, s.hitbox);
    s.gauge.remove();
    this.sausages.splice(this.sausages.indexOf(s), 1);
  }

  clickSausage(s) {
    if (Math.max(...s.sides) > BURNT + 0.3) {
      // carbonisée : direction la poubelle
      s.mesh.geometry.dispose(); s.mat.dispose();
      this.removeSausage(s);
      this.say(L('🔥 Carbonisée… à la poubelle !', '🔥 Charred… into the trash!'));
      sfx.nope();
      return;
    }
    // déjà retournée une fois et un pain attend : la saucisse va dans le pain
    if (s.flips > 0 && this.dog && !this.dog.sausage) {
      this.removeSausage(s);
      s.mesh.rotation.set(0, 0, Math.PI / 2);
      cookColor((s.sides[0] + s.sides[1]) / 2, s.mat.color); // dans le pain : couleur moyenne des deux faces
      this.dog.sausage = s;
      this.dog.group.add(s.mesh);
      s.mesh.position.set(0, 0.055, 0);
      sfx.click();
      return;
    }
    // sinon on la retourne
    s.down = 1 - s.down;
    s.flips += 1;
    s.flipT = 0;
    sfx.click();
  }

  addBun() {
    if (this.dog) {
      if (!this.dog.sausage) this.say(L('Pose une saucisse cuite dans le pain (clic sur la saucisse du grill)', 'Put a cooked sausage in the bun (click the sausage on the grill)'));
      return;
    }
    const group = new THREE.Group();
    const bun = makeBun();
    group.add(bun);
    group.position.set(BOARD.x, 1.505, BOARD.z);
    this.group.add(group);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hitbox.position.set(BOARD.x, 1.56, BOARD.z);
    hitbox.userData = { action: 'dog', label: L('🌭 Servir le hot-dog', '🌭 Serve the hot dog') };
    this.group.add(hitbox);
    this.dog = { group, hitbox, sausage: null, toppings: new Set() };
    sfx.click();
  }

  addTopping(t) {
    if (!this.dog || !this.dog.sausage) { this.say(L("D'abord un pain et une saucisse !", 'Bun and sausage first!')); sfx.nope(); return; }
    if (this.dog.toppings.has(t)) return;
    this.dog.toppings.add(t);
    const g = this.dog.group;
    if (t === 'onions') {
      const m = M('#f3ecd8', { r: 0.6, cached: true });
      for (let k = 0; k < 10; k++) add(box(0.022, 0.012, 0.022, m), (Math.random() - 0.5) * 0.2, 0.1, (Math.random() - 0.5) * 0.03, g);
    } else {
      // filet de sauce en zigzag sur la saucisse
      const pts = [];
      const off = t === 'ketchup' ? 0 : 0.6;
      for (let k = 0; k <= 24; k++) { const x = -0.11 + k * 0.22 / 24; pts.push(new THREE.Vector3(x, 0.092 + (t === 'mustard' ? 0.004 : 0), Math.sin(k * 0.9 + off) * 0.018)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.007, 6), M(t === 'ketchup' ? '#c1121f' : '#f2c600', { r: 0.3, cached: true }));
      g.add(tube);
      const bottle = t === 'ketchup' ? this.ketchup : this.mustard;
      bottle.userData.squeeze = 1;
    }
    sfx.click();
  }

  trash() {
    if (!this.dog) { this.say(L('Rien à jeter sur la planche', 'Nothing to throw away on the board')); return; }
    this.group.remove(this.dog.group, this.dog.hitbox);
    this.dog = null;
    sfx.nope();
  }

  /** Le client au comptoir (s'il est arrivé et a passé commande). */
  customer() {
    const c = this.stand.queue[0];
    return c && c.state === 'queue' && c.arrived && c.order ? c : null;
  }

  serve() {
    const d = this.dog;
    if (!d) return;
    if (!d.sausage) { this.say(L('Il manque la saucisse !', 'The sausage is missing!')); sfx.nope(); return; }
    const c = this.customer();
    if (!c) { this.say(L("Personne n'attend au comptoir pour l'instant", 'Nobody is waiting at the counter yet')); sfx.nope(); return; }
    // note : cuisson des deux faces + garnitures demandées
    const cook = (sideScore(d.sausage.sides[0]) + sideScore(d.sausage.sides[1])) / 2;
    const want = new Set(c.order);
    let wrong = 0;
    for (const t of TOPPINGS) if (want.has(t) !== d.toppings.has(t)) wrong += 1;
    const tops = Math.max(0, 1 - wrong * 0.34);
    const q = 0.5 * cook + 0.5 * tops;
    const stars = q > 0.85 ? 3 : q > 0.55 ? 2 : 1;
    const face = stars === 3 ? '😍' : stars === 2 ? '🙂' : '😖';
    let why = '';
    if (cook < 0.6) why = Math.max(...d.sausage.sides) > GOOD[1] ? L(' (trop cuite)', ' (overcooked)') : L(' (pas assez cuite)', ' (undercooked)');
    else if (wrong) why = L(' (mauvaises garnitures)', ' (wrong toppings)');
    this.game.serveManual(this.stand, q);
    this.ui.toast(`${face} ${'⭐'.repeat(stars)}${why}`);
    // premier cuisinier à portée de main : on le signale une fois
    const S = this.game.state, cost = E.COOK_COST[0][0];
    if (this.stand.index === 0 && S.stands[0].cooks === 0 && S.money >= cost && !this.cookTip) {
      this.cookTip = true;
      setTimeout(() => this.ui.toast(L(`👨‍🍳 Tu as de quoi embaucher un cuisinier (${money(cost)}) : sors du camion → Boutique → Stands`, `👨‍🍳 You can afford a cook (${money(cost)}): exit the truck → Shop → Stands`)), 1400);
    }
    // le hot-dog s'envole vers le client
    this.group.remove(d.hitbox);
    this.flying.push({ group: d.group, from: d.group.position.clone(), to: this.stand.root.worldToLocal(c.headPos().add(new THREE.Vector3(0, -0.5, 0))), t: 0 });
    this.dog = null;
  }

  say(text) {
    this.hintMsg = text; this.hintT = 2.6;
  }

  /* ---------------- Chaque image ---------------- */
  update(dt) {
    this.syncButton();
    if (!this.active) return;
    const w = this.world;
    // caméra : debout derrière le plan de travail, on regarde le comptoir et la rue
    const narrow = innerWidth / innerHeight < 1.1;
    const fov = narrow ? 68 : 56;
    const camZ = narrow ? -1.05 : -0.95;
    const pos = this.stand.root.localToWorld(new THREE.Vector3(this.camX, 2.4, camZ));
    const target = this.stand.root.localToWorld(new THREE.Vector3(this.camX + 0.05, 1.55, 1.4));
    this.anim = Math.min(1, this.anim + dt / 0.9);
    const k = 1 - (1 - this.anim) ** 3;
    w.fixed.pos.lerpVectors(this.from.pos, pos, k);
    w.fixed.target.lerpVectors(this.from.target, target, k);
    w.fixed.fov = fov;

    // cuisson
    const tmp = new THREE.Color();
    for (const s of this.sausages) {
      s.sides[s.down] += COOK_RATE * dt;
      s.flipT = Math.min(1, s.flipT + dt / 0.25);
      // retournement : demi-tour autour de l'axe de la saucisse, avec un petit saut
      s.mesh.position.y = 1.6 + Math.sin(s.flipT * Math.PI) * 0.06;
      s.mesh.rotation.x = (s.flips - 1 + s.flipT) * Math.PI;
      cookColor(s.sides[1 - s.down], tmp); // on voit la face du dessus
      s.mat.color.copy(tmp);
      // jauge de la face qui cuit (au-dessus de la saucisse)
      const p = w.toScreen(this.stand.root.localToWorld(new THREE.Vector3(GRILL_X, 1.72, GRILL_SLOTS[s.slot])));
      const v = s.sides[s.down];
      s.gauge.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      s.gauge.querySelector('b').style.left = `${Math.min(100, (v / 2) * 100)}%`;
      s.gauge.classList.toggle('ok', v >= GOOD[0] && v <= GOOD[1]);
      s.gauge.classList.toggle('burn', v > GOOD[1]);
    }
    this.glow.material.emissiveIntensity = 1.2 + Math.sin(performance.now() / 300) * 0.3;
    for (const b of [this.ketchup, this.mustard]) {
      const q = b.userData.squeeze || 0;
      b.scale.set(1 + q * 0.12, 1 - q * 0.1, 1 + q * 0.12);
      b.userData.squeeze = Math.max(0, q - dt * 4);
    }
    // hot-dogs servis : vol jusqu'au client puis disparition
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t = Math.min(1, f.t + dt / 0.45);
      f.group.position.lerpVectors(f.from, f.to, f.t);
      f.group.position.y += Math.sin(f.t * Math.PI) * 0.35;
      f.group.scale.setScalar(1 - f.t * 0.5);
      if (f.t >= 1) { this.group.remove(f.group); this.flying.splice(i, 1); }
    }

    // commande du client et conseil du moment
    const c = this.customer();
    this.ticket.innerHTML = c
      ? `<b>${L('Commande', 'Order')}</b><span>🌭 ${L('Hot-dog', 'Hot dog')} + ${c.order.map((t) => `${TOPPING_EMOJI[t]} ${TOPPING_NAMES[t]()}`).join(' + ')}</span>`
      : `<b>${L('Commande', 'Order')}</b><span class="wait">${L('En attente d’un client…', 'Waiting for a customer…')}</span>`;
    this.ticket.classList.toggle('new', !!c && c !== this.lastCustomer);
    this.lastCustomer = c;
    if (this.hintT > 0) { this.hintT -= dt; this.hint.textContent = this.hintMsg; this.hint.classList.add('warn'); return; }
    this.hint.classList.remove('warn');
    const [text, focus] = this.nextStep();
    this.hint.textContent = text;
    // écran étroit (téléphone) : la caméra glisse toute seule vers le poste utile, sauf si le joueur vient de glisser lui-même
    if (narrow && performance.now() - this.lastDrag > 2500) this.camX += (focus - this.camX) * Math.min(1, dt * 2.5);
  }

  /** Conseil : la prochaine chose à faire. */
  nextStep() {
    const s0 = this.sausages[0];
    if (this.dog && this.dog.sausage) {
      const c = this.customer();
      const missing = c ? c.order.filter((t) => !this.dog.toppings.has(t)) : [];
      if (missing.length) return [L(`👉 Ajoute : ${missing.map((t) => TOPPING_NAMES[t]()).join(', ')}`, `👉 Add: ${missing.map((t) => TOPPING_NAMES[t]()).join(', ')}`), -1.65];
      return [c ? L('👉 Clique sur le hot-dog pour le servir', '👉 Click the hot dog to serve it') : L('👉 Le hot-dog est prêt : attends un client', '👉 The hot dog is ready: wait for a customer'), BOARD.x];
    }
    if (!this.sausages.length) return [L('👉 Clique sur les saucisses crues pour en mettre une sur le grill', '👉 Click the raw sausages to put one on the grill'), GRILL_X + 0.25];
    const ready = this.sausages.find((s) => s.flips > 0 && s.sides[s.down] >= GOOD[0]);
    if (ready && !this.dog) return [L('👉 Clique sur la corbeille de pains', '👉 Click the bread basket'), -1.1];
    if (ready && this.dog) return [L('👉 Clique sur la saucisse cuite pour la mettre dans le pain', '👉 Click the cooked sausage to put it in the bun'), -0.3];
    if (s0.flips === 0 && s0.sides[0] >= GOOD[0]) return [L('👉 Jauge dans le vert : clique sur la saucisse pour la retourner !', '👉 Gauge in the green: click the sausage to flip it!'), GRILL_X];
    if (!this.dog) return [L('👉 Pendant que ça cuit, prends un pain dans la corbeille', '👉 While it cooks, grab a bun from the basket'), -1.1];
    return [L('⏳ Ça grille… attends que la jauge soit dans le vert', '⏳ Sizzling… wait for the gauge to hit the green'), GRILL_X];
  }
}

/** Pain à hot-dog (ouvert sur le dessus). */
function makeBun() {
  const g = new THREE.Group();
  const bunM = M('#d99a4e', { r: 0.6, cached: true });
  const crumbM = M('#f3dcb0', { r: 0.8, cached: true });
  for (const s of [-1, 1]) {
    const half = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 6, 12), bunM);
    half.rotation.z = Math.PI / 2;
    half.scale.set(1, 1, 0.8);
    add(half, 0, 0.04, s * 0.03, g);
  }
  add(box(0.22, 0.01, 0.04, crumbM), 0, 0.03, 0, g);
  return g;
}
