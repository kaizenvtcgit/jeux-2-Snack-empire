import { THREE, M, add, rbox, box, cyl, sph, money } from './util.js';
import * as E from './economy.js';
import { buildRoomDecor, buildHood, buildProps, buildGriddle, buildPack, buildBoard, buildBasket, buildBottle, buildOnionPan, buildBin, sausageGeometry, makeBun, makeTray, grillMarksTex, smokeTex } from './kitchen-decor.js';
import { L } from './i18n.js';
import { sfx, setSizzle } from './audio.js';
import { Customer } from './people.js';
import { PALETTE_SLOTS } from './models.js';

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
/*
 * Le camion est partagé en deux moitiés identiques, en miroir autour du milieu de la fenêtre (x = C) :
 * le joueur à droite de l'écran (x < C), le cuisinier embauché à gauche (x > C).
 * Chaque poste est placé à une distance U du milieu (vers le mur du bout) et à une profondeur Z sur le plan de travail.
 */
const C = -0.9;
const U = { grill: 1.25, pack: 1.82, bin: 2.12, board: 0.52, basket: 0.4, ketchup: 0.68, mustard: 0.8, onions: 0.12, trays: 0.12 };
const Z = { grill: 0.82, pack: 0.8, bin: 0.8, board: 0.7, basket: 1.0, ketchup: 1.02, mustard: 1.02, onions: 1.0, trays: 0.62 };
const PX = (k) => C - U[k]; // moitié du joueur
const KX = (k) => C + U[k]; // moitié du cuisinier
const GRILL_X = PX('grill');
const BOARD = new THREE.Vector3(PX('board'), 1.5, Z.board);
const COOK_GX = KX('grill'); // plaque du cuisinier
const COOK_BX = KX('board'); // planche du cuisinier
const CAM_X0 = C - 0.45; // la caméra part un peu de ton côté : ta moitié en entier, le cuisinier de biais à gauche
const SAUS_Y = 1.616; // hauteur d'une saucisse posée sur la plaque
/** Marques de grill visibles selon la cuisson de la face du dessus. */
const markOpacity = (v) => THREE.MathUtils.clamp((v - 0.45) * 1.6, 0, 0.85);

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
    this.camX = CAM_X0;
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
    buildRoomDecor(g);
    buildProps(g);
    // Lumières : spot au plafond (ombres douces sur le plan de travail), lampe chaude sous la hotte, appoint côté joueur
    const spot = new THREE.SpotLight('#fff1dc', 9, 6, 1.05, 0.65, 1.4);
    spot.position.set(C, 2.9, 0.25);
    spot.target.position.set(C, 1.45, 0.85);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.015; spot.shadow.radius = 4;
    spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 4;
    g.add(spot, spot.target);
    const fill = new THREE.PointLight('#e8eeff', 1.1, 5, 1.8);
    fill.position.set(C, 2.3, -0.7);
    g.add(fill);
  }

  /** Une zone cliquable (boîte invisible un peu plus grande que l'objet, plus facile à viser). */
  hit(w, h, d, x, y, z, action, label) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z);
    m.userData = { action, label, noShadow: true };
    this.group.add(m);
    this.clickables.push(m);
    return m;
  }

  /* ---------------- Postes de travail ---------------- */
  buildStations() {
    const g = this.group;
    this.sausageGeo = sausageGeometry();

    // Deux installations identiques, en miroir : celle du joueur (à droite) et celle du cuisinier (à gauche)
    const mine = this.buildHalf(-1), cooks = this.buildHalf(1);
    this.ketchup = mine.ketchup; this.mustard = mine.mustard;
    this.cookKetchup = cooks.ketchup; this.cookMustard = cooks.mustard;

    // zones cliquables (moitié du joueur)
    this.hit(0.66, 0.16, 0.56, GRILL_X, 1.6, Z.grill, 'grill', L('Plaque de cuisson', 'Griddle'));
    this.hit(0.4, 0.2, 0.32, PX('pack'), 1.55, Z.pack, 'pack', L('Saucisses crues', 'Raw sausages'));
    this.hit(0.56, 0.2, 0.36, BOARD.x, 1.56, BOARD.z, 'board', L('Planche', 'Board'));
    this.hit(0.34, 0.22, 0.34, PX('basket'), 1.55, Z.basket, 'bun', L('Pains', 'Buns'));
    this.hit(0.12, 0.34, 0.16, PX('ketchup'), 1.62, Z.ketchup, 'ketchup', '🍅 Ketchup');
    this.hit(0.12, 0.34, 0.16, PX('mustard'), 1.62, Z.mustard, 'mustard', L('🟡 Moutarde', '🟡 Mustard'));
    this.hit(0.24, 0.16, 0.24, PX('onions'), 1.54, Z.onions, 'onions', L('🧅 Oignons', '🧅 Onions'));
    this.hit(0.3, 0.34, 0.3, PX('bin'), 1.62, Z.bin, 'trash', L('🗑️ Poubelle', '🗑️ Trash'));

    // ce que prépare le cuisinier (saucisse, hot-dog en cours) : visible seulement s'il y a un cuisinier
    this.cookStation = new THREE.Group();
    g.add(this.cookStation);
    this.cookJob = null;
    this.cookStation.visible = false;

    // Fumée au-dessus de la plaque (réserve de petits nuages réutilisés)
    this.smoke = [];
    for (let k = 0; k < 28; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), color: '#d9d6d0', transparent: true, opacity: 0, depthWrite: false }));
      sp.visible = false; g.add(sp);
      this.smoke.push({ sp, life: 0, max: 1 });
    }
    this.smokeT = 0;

    // ombres : tout le décor en projette et en reçoit, sauf les zones cliquables, les vitres et le film plastique
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      const skip = o.userData.noShadow || (o.material && o.material.opacity === 0);
      o.castShadow = !skip; o.receiveShadow = !skip;
    });
  }

  /** Une moitié du camion : plaque et hotte, saucisses, planche, pains, sauces, oignons, poubelle, barquettes. d = -1 (joueur) ou 1 (cuisinier). */
  buildHalf(d) {
    const g = this.group, X = (k) => C + d * U[k];
    buildGriddle(g, X('grill'), Z.grill);
    buildHood(g, X('grill'));
    const lamp = new THREE.SpotLight('#ffd9a8', 3, 2.2, 0.9, 0.8, 1.5);
    lamp.position.set(X('grill'), 2.48, 0.7); lamp.target.position.set(X('grill'), 1.5, 0.85);
    g.add(lamp, lamp.target);
    buildPack(g, new THREE.Vector3(X('pack'), 1.47, Z.pack), this.sausageGeo);
    buildBoard(g, new THREE.Vector3(X('board'), 0, Z.board));
    const basket = new THREE.Group();
    buildBasket(basket, new THREE.Vector3(0, 0, 0), makeBun);
    basket.position.set(X('basket'), 1.49, Z.basket); basket.scale.setScalar(0.8);
    g.add(basket);
    const ketchup = buildBottle(g, X('ketchup'), Z.ketchup, '#c1121f', 'KETCHUP');
    const mustard = buildBottle(g, X('mustard'), Z.mustard, '#e8b400', L('MOUTARDE', 'MUSTARD'));
    buildOnionPan(g, X('onions'), Z.onions);
    buildBin(g, X('bin'), Z.bin);
    for (let k = 0; k < 5; k++) {
      const t = makeTray(); t.position.set(X('trays'), 1.47 + k * 0.012, Z.trays); t.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.1; t.scale.setScalar(0.8);
      g.add(t);
    }
    return { ketchup, mustard };
  }

  /** Lance un petit nuage de fumée au-dessus d'une saucisse (plus sombre si elle brûle). */
  puff(x, z, dark) {
    const p = this.smoke.find((q) => q.life <= 0);
    if (!p) return;
    p.life = p.max = 1.6 + Math.random() * 1.2;
    p.sp.visible = true;
    p.sp.position.set(x + (Math.random() - 0.5) * 0.2, 1.63, z + (Math.random() - 0.5) * 0.05);
    p.vx = (Math.random() - 0.5) * 0.05; p.vz = -0.02 + (Math.random() - 0.5) * 0.04;
    p.sp.material.color.set(dark ? '#5a5552' : '#e6e3de');
    p.peak = dark ? 0.75 : 0.45;
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
        if (down.moved) this.camX = THREE.MathUtils.clamp(down.camX + dx / innerWidth * 2.6, C - 1.3, C + 1.3);
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
    if (this.stand.serving && this.stand.cooks === 0) this.stand.serving = null;
    // cuisinier embauché : on le voit travailler à son poste, au bout du plan de travail
    const hasCook = this.stand.cooks > 0;
    if (hasCook && !this.cook) this.cook = makeCook(this.world.scene, this.group);
    if (this.cook) this.cook.floor.visible = hasCook;
    this.cookStation.visible = hasCook;
    document.body.classList.add('in-kitchen');
    this.camX = CAM_X0;
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
    setSizzle(0);
    if (this.cookJob) { this.dropJob(this.cookJob, true); this.cookJob = null; }
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
    // boyau brillant (vernis) dont la couleur suit la cuisson, + marques de grill qui apparaissent en cuisant
    const mat = new THREE.MeshPhysicalMaterial({ color: RAW.clone(), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.9 });
    const mesh = new THREE.Mesh(this.sausageGeo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    const marks = new THREE.Mesh(this.sausageGeo, new THREE.MeshStandardMaterial({ map: grillMarksTex(), transparent: true, opacity: 0, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
    marks.scale.setScalar(1.015);
    mesh.add(marks);
    const s = { slot: free, sides: [0, 0], down: 0, flips: 0, flipT: 1, mesh, mat, marks };
    mesh.position.set(GRILL_X, SAUS_Y, GRILL_SLOTS[free]);
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
      s.mat.dispose(); s.marks.material.dispose();
      this.removeSausage(s);
      this.say(L('🔥 Carbonisée… à la poubelle !', '🔥 Charred… into the trash!'));
      sfx.nope();
      return;
    }
    // déjà retournée une fois et un pain attend : la saucisse va dans le pain
    if (s.flips > 0 && this.dog && !this.dog.sausage) {
      this.removeSausage(s);
      s.mesh.rotation.set(0, 0, 0);
      cookColor((s.sides[0] + s.sides[1]) / 2, s.mat.color); // dans le pain : couleur moyenne des deux faces
      s.marks.material.opacity = markOpacity(Math.max(s.sides[0], s.sides[1]));
      this.dog.sausage = s;
      this.dog.group.add(s.mesh);
      s.mesh.position.set(0, 0.078, 0);
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
    // le pain est posé dans une barquette en carton, sur la planche
    const group = new THREE.Group();
    group.add(makeTray());
    const bun = makeBun();
    bun.position.y = 0.004;
    group.add(bun);
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.position.set(BOARD.x, 1.502, BOARD.z);
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
    this.dog.group.add(toppingObj(t));
    if (t !== 'onions') (t === 'ketchup' ? this.ketchup : this.mustard).userData.squeeze = 1;
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
    // (s'il y a un cuisinier, il sert le client au comptoir : le joueur s'occupe du suivant)
    return this.stand.queue.find((c) => c !== this.stand.serving && c.state === 'queue' && c.arrived && c.order) || null;
  }

  /* ---------------- Le cuisinier embauché ---------------- */
  /**
   * Il prépare pour de vrai la commande du client qu'il sert : saucisse sur la plaque, retournement,
   * pain sur la planche, saucisse dans le pain, garnitures demandées, puis il tend le hot-dog par la fenêtre.
   * Les étapes suivent l'avancement du service (le jeu encaisse la vente quand le minuteur arrive au bout).
   */
  updateCook(dt) {
    const st = this.stand, c = this.cook, t = performance.now() / 1000;
    const sv = st.serving;
    // nouveau client pris en charge
    if (sv && (!this.cookJob || this.cookJob.c !== sv)) {
      if (this.cookJob) this.dropJob(this.cookJob, true);
      this.cookJob = { c: sv, order: sv.order || ['ketchup'], stage: 0 };
    }
    // vente encaissée : le hot-dog part vers le client
    if (this.cookJob && this.cookJob.c !== sv) { this.dropJob(this.cookJob, false); this.cookJob = null; }

    const job = this.cookJob;
    // Il se déplace le long du plan de travail entre sa plaque, sa planche et la fenêtre (x où il se tient)
    const AT_G = COOK_GX + 0.1, AT_B = COOK_BX + 0.05, AT_W = C + 0.3, STAND_Z = 0.15;
    let goal = AT_G, lookX = COOK_GX, lookZ = Z.grill, work = 'idle';
    const pos = c.root.position;
    const hand = () => new THREE.Vector3(pos.x + Math.sin(c.yaw) * 0.36, 1.56, pos.z + Math.cos(c.yaw) * 0.36);
    if (job) {
      const p = st.duration > 0 ? 1 - st.timer / st.duration : 0;
      const ord = job.order;
      const near = (x) => Math.abs(pos.x - x) < 0.06;
      // étapes : saucisse sur la plaque → retournement → pain sur la planche → retour à la plaque →
      // saucisse portée jusqu'au pain → garnitures → il apporte le hot-dog à la fenêtre
      if (p < 0.47) { goal = AT_G; work = p < 0.08 ? 'fridge' : p > 0.42 ? 'flip' : 'grill'; }
      else if (p < 0.6) { goal = AT_B; lookX = COOK_BX; lookZ = Z.board; work = 'bun'; }
      else if (p < 0.7) { goal = AT_G; work = 'grill'; }
      else if (p < 0.8) { goal = AT_B; lookX = COOK_BX; lookZ = Z.board; work = 'carry'; }
      else if (p < 0.9) { goal = AT_B; lookX = COOK_BX; lookZ = Z.board; work = 'sauce'; }
      else { goal = AT_W; lookX = C + 0.25; lookZ = 1.45; work = 'hand'; }
      // 1. la saucisse sort du frigo (sous le plan) et va sur la plaque
      if (p >= 0.08 && !job.saus && near(AT_G)) {
        const m = new THREE.Mesh(this.sausageGeo, new THREE.MeshPhysicalMaterial({ color: RAW.clone(), roughness: 0.42, clearcoat: 0.55, envMapIntensity: 0.9 }));
        const marks = new THREE.Mesh(this.sausageGeo, new THREE.MeshStandardMaterial({ map: grillMarksTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
        marks.scale.setScalar(1.015); m.add(marks);
        m.position.set(COOK_GX, SAUS_Y, 0.8);
        m.castShadow = true;
        this.cookStation.add(m);
        job.saus = m; job.marks = marks; job.t0 = p;
      }
      // 2. cuisson sur la plaque, retournement
      if (job.saus && !job.carried && job.saus.parent === this.cookStation) {
        const t0 = job.t0 || 0.08;
        const sideA = THREE.MathUtils.clamp((p - t0) / 0.34, 0, 1.05);
        const flipK = THREE.MathUtils.clamp((p - 0.42) / 0.05, 0, 1);
        job.saus.rotation.x = flipK * Math.PI;
        job.saus.position.y = SAUS_Y + Math.sin(flipK * Math.PI) * 0.06;
        cookColor(flipK < 0.5 ? 0 : sideA, job.saus.material.color);
        job.marks.material.opacity = flipK < 0.5 ? 0 : markOpacity(sideA);
        this.cookPuffT = (this.cookPuffT || 0) - dt;
        if (this.cookPuffT <= 0) { this.cookPuffT = 0.3; this.puff(COOK_GX, 0.8, false); }
      }
      // 3. pain posé sur la planche (une fois devant la planche)
      if (p >= 0.5 && !job.dog && near(AT_B)) {
        const dog = new THREE.Group();
        dog.add(makeTray());
        const bun = makeBun(); bun.position.y = 0.004; dog.add(bun);
        dog.position.set(COOK_BX, 1.502, Z.board);
        dog.rotation.y = 0;
        dog.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.cookStation.add(dog);
        job.dog = dog;
      }
      // 4. il prend la saucisse cuite et l'apporte jusqu'au pain
      if (job.saus && job.dog && p >= 0.7 && job.saus.parent === this.cookStation && (job.carried || near(AT_G))) {
        job.carried = true;
        cookColor(1, job.saus.material.color); job.marks.material.opacity = markOpacity(1);
        job.saus.rotation.set(0, 0, 0);
        job.saus.position.copy(hand());
        if (near(AT_B) && p >= 0.75) {
          this.cookStation.remove(job.saus);
          job.saus.position.set(0, 0.078, 0);
          job.dog.add(job.saus);
        }
      }
      // 5. garnitures de la commande, une par une
      if (p >= 0.8 && p < 0.9 && job.dog && near(AT_B)) {
        const n = ord.length, idx = Math.min(n - 1, Math.floor(((p - 0.8) / 0.1) * n));
        job.done = job.done || new Set();
        for (let k = 0; k <= idx; k++) {
          const tp = ord[k];
          if (!job.done.has(tp)) {
            job.done.add(tp);
            job.dog.add(toppingObj(tp));
            if (tp !== 'onions') (tp === 'ketchup' ? this.cookKetchup : this.cookMustard).userData.squeeze = 1;
          }
        }
      }
      // 6. il porte le hot-dog jusqu'à la fenêtre et le tend au client
      if (p >= 0.9 && job.dog) {
        const h = hand();
        job.dog.position.lerp(new THREE.Vector3(h.x, 1.52, Math.min(1.42, h.z + 0.25)), Math.min(1, dt * 10));
      }
    }
    // déplacement (il marche avec ses jambes), puis orientation
    const dx = goal - pos.x;
    const moving = Math.abs(dx) > 0.03;
    const speed = 1.7;
    if (moving) pos.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    pos.z = STAND_Z;
    c.v = moving ? speed : 0;
    const want = moving ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.atan2(lookX - pos.x, lookZ - pos.z);
    let dy = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
    c.yaw += dy * Math.min(1, dt * 9);
    c.root.rotation.y = c.yaw;
    c.animate(dt, moving);
    // gestes au poste (les jambes restent celles de l'animation)
    if (!moving) {
      const e = Math.min(1, dt * 8);
      const P = {
        idle: [-0.6 + Math.sin(t * 4) * 0.08, -0.7, -0.2, -0.3, 0.03],
        fridge: [-0.25, -0.2, -0.15, -0.2, 0.35],
        grill: [-0.95 + Math.sin(t * 6) * 0.07, -0.75, -0.55, -0.6, 0.08],
        flip: [-1.3, -0.3, -0.55, -0.6, 0.08],
        bun: [-1.0, -0.7, -1.0, -0.7, 0.1],
        carry: [-1.0, -0.6, -0.4, -0.4, 0.06],
        sauce: [-1.15 + Math.sin(t * 9) * 0.07, -0.6, -1.0, -0.7, 0.1],
        hand: [-1.45, -0.15, -1.2, -0.3, 0.04],
      }[work];
      c.arms[0].rotation.x += (P[0] - c.arms[0].rotation.x) * e;
      c.forearms[0].rotation.x += (P[1] - c.forearms[0].rotation.x) * e;
      c.arms[1].rotation.x += (P[2] - c.arms[1].rotation.x) * e;
      c.forearms[1].rotation.x += (P[3] - c.forearms[1].rotation.x) * e;
      c.body.rotation.x += (P[4] - c.body.rotation.x) * e;
    } else if (job && (job.carried || work === 'hand')) {
      // en marchant avec quelque chose dans les mains : bras devant
      c.arms[0].rotation.x = -1.0; c.forearms[0].rotation.x = -0.6;
    }
    for (const b of [this.cookKetchup, this.cookMustard]) {
      const q = b.userData.squeeze || 0;
      b.scale.set(1 + q * 0.12, 1 - q * 0.1, 1 + q * 0.12);
      b.userData.squeeze = Math.max(0, q - dt * 3);
    }
  }

  /** Fin d'une commande du cuisinier : le hot-dog vole jusqu'au client (vente faite), ou disparaît (abandon). */
  dropJob(job, abandoned) {
    if (job.saus && job.saus.parent === this.cookStation) this.cookStation.remove(job.saus);
    if (!job.dog) return;
    if (abandoned || !job.c) { this.cookStation.remove(job.dog); return; }
    const to = this.stand.root.worldToLocal(job.c.headPos().add(new THREE.Vector3(0, -0.5, 0)));
    const from = job.dog.position.clone();
    this.cookStation.remove(job.dog);
    this.group.add(job.dog);
    this.flying.push({ group: job.dog, from, to, t: 0 });
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
    this.game.serveManual(this.stand, q, c);
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
    // (debout au fond du camion : on voit tout le plan de travail, le cuisinier et la rue)
    const fov = narrow ? 64 : 60;
    const pos = this.stand.root.localToWorld(new THREE.Vector3(this.camX, 2.5, -1.5));
    const target = this.stand.root.localToWorld(new THREE.Vector3(this.camX + 0.05, 1.5, 1.35));
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
      s.mesh.position.y = SAUS_Y + Math.sin(s.flipT * Math.PI) * 0.06;
      s.mesh.rotation.x = (s.flips - 1 + s.flipT) * Math.PI;
      cookColor(s.sides[1 - s.down], tmp); // on voit la face du dessus
      s.mat.color.copy(tmp);
      s.marks.material.opacity = markOpacity(s.sides[1 - s.down]);
      // fumée : un peu tout le temps, beaucoup si ça brûle
      const burning = s.sides[s.down] > GOOD[1];
      s.puffT = (s.puffT || 0) - dt;
      if (s.puffT <= 0) { s.puffT = burning ? 0.1 : 0.3; this.puff(GRILL_X, GRILL_SLOTS[s.slot], s.sides[s.down] > BURNT); }
      // jauge de la face qui cuit (au-dessus de la saucisse)
      const p = w.toScreen(this.stand.root.localToWorld(new THREE.Vector3(GRILL_X, 1.72, GRILL_SLOTS[s.slot])));
      const v = s.sides[s.down];
      s.gauge.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      s.gauge.querySelector('b').style.left = `${Math.min(100, (v / 2) * 100)}%`;
      s.gauge.classList.toggle('ok', v >= GOOD[0] && v <= GOOD[1]);
      s.gauge.classList.toggle('burn', v > GOOD[1]);
    }
    if (this.cook && this.cook.floor.visible) this.updateCook(dt);

    // nuages de fumée : montent vers la hotte, grossissent et s'effacent
    for (const p of this.smoke) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = 1 - p.life / p.max;
      p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt;
      p.sp.position.y = Math.min(2.5, p.sp.position.y + dt * (0.35 - k * 0.15));
      p.sp.scale.setScalar(0.12 + k * 0.5);
      p.sp.material.opacity = p.peak * Math.min(1, k * 5) * (1 - k);
      if (p.life <= 0) p.sp.visible = false;
    }
    setSizzle(Math.min(1, (this.sausages.length + (this.cookStation.visible ? 1 : 0)) / 2));
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
      ? `<b>${L('Commande', 'Order')}</b><span>🌭 ${L('Hot-dog', 'Hot dog')} + ${c.order.map((t) => `${TOPPING_EMOJI[t]} ${TOPPING_NAMES[t]()}`).join(' + ')}</span><em>${money(this.game.orderPrice(c.order))}</em>`
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
      if (missing.length) return [L(`👉 Ajoute : ${missing.map((t) => TOPPING_NAMES[t]()).join(', ')}`, `👉 Add: ${missing.map((t) => TOPPING_NAMES[t]()).join(', ')}`), PX('mustard')];
      return [c ? L('👉 Clique sur le hot-dog pour le servir', '👉 Click the hot dog to serve it') : L('👉 Le hot-dog est prêt : attends un client', '👉 The hot dog is ready: wait for a customer'), BOARD.x];
    }
    if (!this.sausages.length) return [L('👉 Clique sur les saucisses crues pour en mettre une sur le grill', '👉 Click the raw sausages to put one on the grill'), PX('pack')];
    const ready = this.sausages.find((s) => s.flips > 0 && s.sides[s.down] >= GOOD[0]);
    if (ready && !this.dog) return [L('👉 Clique sur la corbeille de pains', '👉 Click the bread basket'), PX('basket')];
    if (ready && this.dog) return [L('👉 Clique sur la saucisse cuite pour la mettre dans le pain', '👉 Click the cooked sausage to put it in the bun'), (GRILL_X + BOARD.x) / 2];
    if (s0.flips === 0 && s0.sides[0] >= GOOD[0]) return [L('👉 Jauge dans le vert : clique sur la saucisse pour la retourner !', '👉 Gauge in the green: click the sausage to flip it!'), GRILL_X];
    if (!this.dog) return [L('👉 Pendant que ça cuit, prends un pain dans la corbeille', '👉 While it cooks, grab a bun from the basket'), PX('basket')];
    return [L('⏳ Ça grille… attends que la jauge soit dans le vert', '⏳ Sizzling… wait for the gauge to hit the green'), GRILL_X];
  }
}

/**
 * Le cuisinier embauché : un personnage du jeu en tenue (veste et tablier blancs, toque),
 * debout devant son poste au bout du plan de travail.
 */
function makeCook(scene, parent) {
  const c = new Customer(scene, new THREE.Vector3());
  scene.remove(c.root);
  // (le personnage s'anime comme un client, au niveau du sol : on le pose sur le plancher du camion)
  const floor = new THREE.Group();
  floor.position.y = 0.75;
  floor.add(c.root);
  parent.add(floor);
  c.floor = floor;
  const data = c.texture.image.data;
  const paint = (slot, hex) => { const i = PALETTE_SLOTS.indexOf(slot) * 4, v = parseInt(hex.slice(1), 16); data[i] = (v >> 16) & 255; data[i + 1] = (v >> 8) & 255; data[i + 2] = v & 255; };
  paint('Shirt', '#f4f3ee'); paint('Accent', '#d8d8d2'); paint('Pants', '#2b2d33'); paint('Shoes', '#1f1f22'); paint('CapColor', '#f4f3ee');
  c.texture.needsUpdate = true;
  c.root.position.set(COOK_GX + 0.1, 0, 0.15);
  // toque de chef + tablier, placés d'après la forme du corps (repère du buste, avant = +z)
  const g = c.body.geometry;
  g.computeBoundingBox();
  const top = g.boundingBox.max.y;
  const white = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.85 });
  const hat = new THREE.Group();
  add(cyl(0.1, 0.095, 0.05, white, 24), 0, 0, 0, hat);
  add(cyl(0.11, 0.09, 0.12, white, 24), 0, 0.08, 0, hat);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), white), 0, 0.15, 0, hat).scale.set(1, 0.55, 1);
  hat.position.set(0, top - 0.05, -0.005);
  c.body.add(hat); // (la toque suit la tête)
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.012), white);
  apron.position.set(0, 0.98, 0.118);
  apron.rotation.x = 0.06;
  c.body.add(apron);
  c.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  c.state = 'cook';
  return c;
}

/** Garniture posée sur un hot-dog : filet de sauce en zigzag, ou oignons émincés. */
function toppingObj(t) {
  if (t === 'onions') {
    const g = new THREE.Group();
    const m = M('#f3ecd8', { r: 0.6, cached: true });
    for (let k = 0; k < 22; k++) add(box(0.016, 0.008, 0.016, m), (Math.random() - 0.5) * 0.2, 0.112, (Math.random() - 0.5) * 0.03, g).rotation.y = Math.random() * 3;
    return g;
  }
  const pts = [];
  const off = t === 'ketchup' ? 0 : 0.6;
  for (let k = 0; k <= 24; k++) { const x = -0.11 + k * 0.22 / 24; pts.push(new THREE.Vector3(x, 0.108 + (t === 'mustard' ? 0.004 : 0), Math.sin(k * 0.9 + off) * 0.018)); }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0065, 8), new THREE.MeshPhysicalMaterial({ color: t === 'ketchup' ? '#a50f16' : '#e2a800', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 }));
}

