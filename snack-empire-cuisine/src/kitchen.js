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
const GRILL_X = 0.15;
const BOARD = new THREE.Vector3(-0.72, 1.5, 0.82);
const COOK_X = 1.75; // le cuisinier se tient au bout du camion, à gauche de son poste (on le voit travailler de côté)
const COOK_GX = 1.07; // sa plaque
const COOK_BX = 1.5; // sa planche (et ses sauces derrière)
const CAM_X0 = 0; // position de départ de la caméra le long du plan de travail
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
    buildHood(g, GRILL_X);
    buildProps(g);
    // Lumières : spot au plafond (ombres douces sur le plan de travail), lampe chaude sous la hotte, appoint côté joueur
    const spot = new THREE.SpotLight('#fff1dc', 9, 6, 1.05, 0.65, 1.4);
    spot.position.set(-0.75, 2.9, 0.25);
    spot.target.position.set(-0.75, 1.45, 0.85);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.015; spot.shadow.radius = 4;
    spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 4;
    g.add(spot, spot.target);
    const hoodLamp = new THREE.SpotLight('#ffd9a8', 3, 2.2, 0.9, 0.8, 1.5);
    hoodLamp.position.set(GRILL_X, 2.48, 0.7);
    hoodLamp.target.position.set(GRILL_X, 1.5, 0.85);
    g.add(hoodLamp, hoodLamp.target);
    const fill = new THREE.PointLight('#e8eeff', 1.1, 5, 1.8);
    fill.position.set(-0.8, 2.3, -0.7);
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

    // Plaque de cuisson
    buildGriddle(g, GRILL_X, 0.82);
    this.hit(0.66, 0.16, 0.56, GRILL_X, 1.6, 0.82, 'grill', L('Plaque de cuisson', 'Griddle'));

    // Barquette de saucisses crues
    const PACK = new THREE.Vector3(0.66, 1.47, 0.8);
    buildPack(g, PACK, this.sausageGeo);
    this.hit(0.4, 0.2, 0.32, PACK.x, PACK.y + 0.08, PACK.z, 'pack', L('Saucisses crues', 'Raw sausages'));

    // Planche à découper
    buildBoard(g, BOARD);
    this.hit(0.56, 0.2, 0.36, BOARD.x, 1.56, BOARD.z, 'board', L('Planche', 'Board'));

    // Corbeille de pains
    const BASKET = new THREE.Vector3(-1.25, 1.49, 0.8);
    buildBasket(g, BASKET, makeBun);
    this.hit(0.4, 0.22, 0.4, BASKET.x, BASKET.y + 0.06, BASKET.z, 'bun', L('Pains', 'Buns'));

    // Sauces et oignons
    this.ketchup = buildBottle(g, -1.58, 0.86, '#c1121f', 'KETCHUP');
    this.mustard = buildBottle(g, -1.73, 0.86, '#e8b400', L('MOUTARDE', 'MUSTARD'));
    this.hit(0.13, 0.34, 0.16, -1.58, 1.62, 0.86, 'ketchup', '🍅 Ketchup');
    this.hit(0.13, 0.34, 0.16, -1.73, 1.62, 0.86, 'mustard', L('🟡 Moutarde', '🟡 Mustard'));
    buildOnionPan(g, -1.95, 0.82);
    this.hit(0.24, 0.16, 0.24, -1.95, 1.54, 0.82, 'onions', L('🧅 Oignons', '🧅 Onions'));

    // Poubelle
    buildBin(g, -2.22, 0.8);
    this.hit(0.3, 0.34, 0.3, -2.22, 1.62, 0.8, 'trash', L('🗑️ Poubelle', '🗑️ Trash'));

    // Poste du cuisinier embauché (bout du plan de travail) : petite plaque, planche, sauces et oignons
    this.cookStation = new THREE.Group();
    g.add(this.cookStation);
    const mini = buildGriddle(this.cookStation, COOK_GX, 0.82);
    mini.scale.x = 0.62;
    buildBoard(this.cookStation, new THREE.Vector3(COOK_BX, 0, 0.7));
    this.cookStation.children[this.cookStation.children.length - 1].scale.set(0.55, 1, 0.65);
    this.cookKetchup = buildBottle(this.cookStation, COOK_BX - 0.1, 0.99, '#c1121f', 'KETCHUP');
    this.cookMustard = buildBottle(this.cookStation, COOK_BX + 0.02, 0.99, '#e8b400', L('MOUTARDE', 'MUSTARD'));
    for (const b of [this.cookKetchup, this.cookMustard]) b.scale.setScalar(0.8);
    add(cyl(0.045, 0.04, 0.05, new THREE.MeshPhysicalMaterial({ color: '#2a6f97', roughness: 0.3, clearcoat: 0.6 }), 20), COOK_BX + 0.13, 1.495, 0.99, this.cookStation);
    const onionM = M('#efe7cf', { r: 0.4, cached: true });
    for (let k = 0; k < 10; k++) add(box(0.014, 0.008, 0.014, onionM), COOK_BX + 0.13 + (Math.random() - 0.5) * 0.05, 1.522, 0.99 + (Math.random() - 0.5) * 0.05, this.cookStation);
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
        if (down.moved) this.camX = THREE.MathUtils.clamp(down.camX + dx / innerWidth * 2.6, -1.9, 1.1);
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
    if (this.cook) this.cook.root.visible = hasCook;
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
    // (regard : 0 = vers la fenêtre de face ; négatif = vers la droite de l'écran, où sont sa plaque et sa planche)
    const G = -0.95, B = -0.5, W = -0.85;
    let look = G, armR = -0.9, armL = -0.8, reachZ = 0; // pose par défaut : face à sa plaque
    if (!job) {
      // en attente : il racle sa plaque avec la spatule et jette un œil vers la fenêtre
      look = G + Math.sin(t * 0.5) * 0.1 + (Math.sin(t * 0.23) > 0.8 ? 0.4 : 0);
      armR = -1.05 + Math.sin(t * 5) * 0.12;
    } else {
      const p = st.duration > 0 ? 1 - st.timer / st.duration : 0;
      const ord = job.order;
      // 1. saucisse sortie du frigo (sous le plan) et posée sur la plaque
      if (p < 0.1) { look = -0.7; armR = -0.3 - p * 6; reachZ = 0.3; }
      if (p >= 0.08 && !job.saus) {
        const m = new THREE.Mesh(this.sausageGeo, new THREE.MeshPhysicalMaterial({ color: RAW.clone(), roughness: 0.42, clearcoat: 0.55, envMapIntensity: 0.9 }));
        const marks = new THREE.Mesh(this.sausageGeo, new THREE.MeshStandardMaterial({ map: grillMarksTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
        marks.scale.setScalar(1.015); m.add(marks);
        m.position.set(COOK_GX, SAUS_Y, 0.8);
        m.castShadow = true;
        this.cookStation.add(m);
        job.saus = m; job.marks = marks;
      }
      // 2. cuisson, retournement à mi-chemin
      if (job.saus && p < 0.7) {
        const sideA = THREE.MathUtils.clamp((p - 0.08) / 0.34, 0, 1.05), sideB = THREE.MathUtils.clamp((p - 0.46) / 0.24, 0, 1.05);
        const flipK = THREE.MathUtils.clamp((p - 0.42) / 0.05, 0, 1);
        job.saus.rotation.x = flipK * Math.PI;
        job.saus.position.y = SAUS_Y + Math.sin(flipK * Math.PI) * 0.06;
        cookColor(flipK < 0.5 ? 0 : sideA, job.saus.material.color); // on voit la face du dessus
        job.marks.material.opacity = flipK < 0.5 ? 0 : markOpacity(sideA);
        if (p >= 0.1) { look = G; armR = -1.15 + (p > 0.4 && p < 0.48 ? -0.35 : Math.sin(t * 6) * 0.06); }
        this.cookPuffT = (this.cookPuffT || 0) - dt;
        if (this.cookPuffT <= 0) { this.cookPuffT = 0.3; this.puff(COOK_GX, 0.8, false); }
        void sideB;
      }
      // 3. pain sur la planche
      if (p >= 0.52 && !job.dog) {
        const dog = new THREE.Group();
        dog.add(makeTray());
        const bun = makeBun(); bun.position.y = 0.004; dog.add(bun);
        dog.position.set(COOK_BX, 1.502, 0.7);
        dog.scale.setScalar(0.9);
        dog.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.cookStation.add(dog);
        job.dog = dog;
      }
      if (p >= 0.5 && p < 0.56) { look = B; armL = -1.2; }
      // 4. la saucisse passe de la plaque au pain
      if (job.saus && p >= 0.7 && job.saus.parent !== job.dog) {
        const k = THREE.MathUtils.clamp((p - 0.7) / 0.05, 0, 1);
        job.saus.position.set(THREE.MathUtils.lerp(COOK_GX, COOK_BX, k), SAUS_Y + Math.sin(k * Math.PI) * 0.15, THREE.MathUtils.lerp(0.8, 0.7, k));
        job.saus.rotation.x = Math.PI;
        look = THREE.MathUtils.lerp(G, B, k); armR = -1.3;
        if (k >= 1) {
          cookColor(1, job.saus.material.color); job.marks.material.opacity = markOpacity(1);
          this.cookStation.remove(job.saus);
          job.saus.position.set(0, 0.078, 0); job.saus.rotation.set(0, 0, 0);
          job.dog.add(job.saus);
        }
      }
      // 5. garnitures de la commande, une par une
      if (p >= 0.75 && p < 0.9) {
        const n = ord.length, idx = Math.min(n - 1, Math.floor(((p - 0.75) / 0.15) * n));
        look = B; armR = -1.35 + Math.sin(t * 9) * 0.08; armL = -1.0;
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
      // 6. il se tourne vers la fenêtre et tend le hot-dog
      if (p >= 0.9 && job.dog) {
        const k = THREE.MathUtils.clamp((p - 0.9) / 0.1, 0, 1);
        look = THREE.MathUtils.lerp(B, W, k); armR = -1.4; armL = -1.4;
        job.dog.position.set(THREE.MathUtils.lerp(COOK_BX, 0.9, k), 1.502 + Math.sin(k * Math.PI) * 0.12, THREE.MathUtils.lerp(0.7, 1.42, k));
      }
    }
    // pose (en douceur)
    const e = Math.min(1, dt * 8);
    c.root.rotation.y += (look - c.root.rotation.y) * e;
    c.arms[0].rotation.x += (armR - c.arms[0].rotation.x) * e;
    c.arms[1].rotation.x += (armL - c.arms[1].rotation.x) * e;
    c.arms[0].rotation.z = 0.1 + reachZ * 0.3; c.arms[1].rotation.z = -0.15;
    c.root.position.y = 0.75 + (job ? Math.abs(Math.sin(t * 4)) * 0.008 : 0);
    for (const b of [this.cookKetchup, this.cookMustard]) {
      const q = b.userData.squeeze || 0;
      b.scale.set(0.8 * (1 + q * 0.12), 0.8 * (1 - q * 0.1), 0.8 * (1 + q * 0.12));
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
    if (this.cook && this.cook.root.visible) this.updateCook(dt);

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

/**
 * Le cuisinier embauché : un personnage du jeu en tenue (veste et tablier blancs, toque),
 * debout devant son poste au bout du plan de travail.
 */
function makeCook(scene, parent) {
  const c = new Customer(scene, new THREE.Vector3());
  scene.remove(c.root);
  parent.add(c.root);
  const data = c.texture.image.data;
  const paint = (slot, hex) => { const i = PALETTE_SLOTS.indexOf(slot) * 4, v = parseInt(hex.slice(1), 16); data[i] = (v >> 16) & 255; data[i + 1] = (v >> 8) & 255; data[i + 2] = v & 255; };
  paint('Shirt', '#f4f3ee'); paint('Accent', '#d8d8d2'); paint('Pants', '#2b2d33'); paint('Shoes', '#1f1f22'); paint('CapColor', '#f4f3ee');
  c.texture.needsUpdate = true;
  c.root.position.set(COOK_X, 0.75, 0.2);
  c.root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(c.root);
  const top = bb.max.y - 0.75, front = bb.max.z - 0.25;
  // toque de chef + tablier
  const white = new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.85 });
  const s = 1 / c.root.scale.x; // (le personnage est légèrement agrandi ou réduit : on compense)
  const hat = new THREE.Group();
  add(cyl(0.1, 0.095, 0.05, white, 24), 0, 0, 0, hat);
  add(cyl(0.11, 0.09, 0.12, white, 24), 0, 0.08, 0, hat);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), white), 0, 0.15, 0, hat).scale.set(1, 0.55, 1);
  hat.position.set(0, (top - 0.06) * s, 0);
  c.root.add(hat);
  const apron = add(box(0.3, 0.55, 0.012, white), 0, (top * 0.42) * s, (front - 0.01) * s, c.root);
  apron.rotation.x = 0.05;
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

