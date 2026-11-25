import { THREE, add } from './util.js';
import * as E from './economy.js';
import { L } from './i18n.js';
import { sfx, setSizzle } from './audio.js';
import { Kitchen, makeCook, sideScore } from './kitchen.js';
import { buildPan, buildNeon, buildPizzaOven, buildDoughTray, buildRoundBoard, buildCutter, buildPizzaBoxes, buildFlour, buildHood, buildBin, createPizza, smokeTex } from './kitchen-decor.js';

/*
 * Camion n°2 : la pizzeria. Même camion (deux moitiés en miroir) que les hot-dogs, autre cuisine.
 *
 * Une pizza :
 *   1. clic sur le bac de pâte → une boule de pâte sur la planche
 *   2. clic sur la pâte (3 fois) → on l'étale
 *   3. clic sur les bacs : sauce, mozzarella, puis les ingrédients de la pizza commandée (+ l'option du client)
 *   4. clic sur le four → la pizza cuit ; la jauge monte ; re-clic → on la sort (dans le vert !)
 *   5. clic sur la roulette → on la coupe
 *   6. clic sur la pizza → servie
 * Les cuisiniers font les mêmes gestes, chacun sur sa moitié.
 */

const C = -0.9;
// devant : cartons, planche ronde, roulette, four, pâte, poubelle ; au fond : rail de 8 bacs, farine
const U = { boxes: 0.1, board: 0.42, cutter: 0.78, oven: 1.25, dough: 1.82, bin: 2.12, flour: 2.12,
  sauce: 0.07, mozza: 0.19, basil: 0.31, ham: 0.43, mushrooms: 0.55, cheeses: 0.67, olives: 0.79, oregano: 0.91 };
const Z = { boxes: 0.62, board: 0.72, cutter: 0.62, oven: 0.82, dough: 0.74, bin: 0.7, flour: 1.02,
  sauce: 1.0, mozza: 1.0, basil: 1.0, ham: 1.0, mushrooms: 1.0, cheeses: 1.0, olives: 1.0, oregano: 1.0 };
const ITEMS = ['sauce', 'mozza', 'basil', 'ham', 'mushrooms', 'cheeses', 'olives', 'oregano'];
const PX = (k) => C - U[k];
const BAKE_RATE = 1 / 6; // une pizza est cuite en 6 s environ
const GOOD = [0.75, 1.35];
const PIZZA_Y = 1.497;

/** Ce que demande une commande : les ingrédients de la pizza + l'option éventuelle. */
export const pizzaItems = (o) => [...E.pizzaModel(o.model).need, ...o.tops];

/** Commande au hasard : une pizza débloquée, parfois avec une option (olives ou origan). */
export function randomPizzaOrder(S) {
  const models = E.PIZZA_MODELS.filter((m) => (S.recipes[m.id] || 0) > 0);
  const model = (models[Math.floor(Math.random() * models.length)] || E.PIZZA_MODELS[0]).id;
  const tops = Math.random() < 0.45 ? [E.PIZZA_EXTRAS[Math.floor(Math.random() * E.PIZZA_EXTRAS.length)].id] : [];
  return { model, tops };
}

export class PizzaKitchen extends Kitchen {
  get emoji() { return '🍕'; }

  /* ---------------- Postes ---------------- */
  buildStations() {
    const g = this.group;
    this.slots = [];
    this.neon = buildNeon(g, 1.1, 2.25, 1.235, 'PIZZA');
    this.halves = { [-1]: this.buildHalf(-1), [1]: this.buildHalf(1) };
    // zones cliquables (moitié du joueur)
    this.hit(0.4, 0.2, 0.3, PX('dough'), 1.55, Z.dough, 'dough', L('Pâte à pizza', 'Pizza dough'));
    this.hit(0.42, 0.14, 0.42, PX('board'), 1.53, Z.board, 'board', L('Planche', 'Board'));
    this.hit(0.52, 0.38, 0.5, PX('oven'), 1.65, Z.oven, 'oven', L('Four', 'Oven'));
    this.hit(0.14, 0.1, 0.18, PX('cutter'), 1.52, Z.cutter, 'cut', L('🔪 Roulette', '🔪 Pizza cutter'));
    for (const t of ITEMS) this.hit(0.12, 0.16, 0.17, PX(t), 1.54, Z[t], t, `${E.PIZZA_ITEMS[t].emoji} ${E.PIZZA_ITEMS[t].name}`);
    this.hit(0.3, 0.34, 0.26, PX('bin'), 1.62, Z.bin, 'trash', L('🗑️ Poubelle', '🗑️ Trash'));
    // ce que préparent les cuisiniers
    this.cookStation = new THREE.Group();
    g.add(this.cookStation);
    // fumée (réserve de petits nuages)
    this.smoke = [];
    for (let k = 0; k < 28; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), color: '#d9d6d0', transparent: true, opacity: 0, depthWrite: false }));
      sp.visible = false; g.add(sp);
      this.smoke.push({ sp, life: 0, max: 1 });
    }
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      const skip = o.userData.noShadow || (o.material && o.material.opacity === 0);
      o.castShadow = !skip; o.receiveShadow = !skip;
    });
  }

  buildHalf(d) {
    const g = this.group, X = (k) => C + d * U[k], h = { items: {} };
    h.oven = buildPizzaOven(g, X('oven'), Z.oven);
    h.hood = buildHood(g, X('oven'));
    const lamp = new THREE.SpotLight('#ffd9a8', 3, 2.2, 0.9, 0.8, 1.5);
    lamp.position.set(X('oven'), 2.48, 0.7); lamp.target.position.set(X('oven'), 1.5, 0.85);
    g.add(lamp, lamp.target);
    this.lights.push(lamp);
    buildDoughTray(g, X('dough'), Z.dough);
    buildRoundBoard(g, X('board'), Z.board);
    buildCutter(g, X('cutter'), Z.cutter);
    buildPizzaBoxes(g, X('boxes'), Z.boxes, 4);
    buildFlour(g, X('flour'), Z.flour);
    for (const t of ITEMS) h.items[t] = buildPan(g, X(t), Z[t], t);
    buildBin(g, X('bin'), Z.bin);
    return h;
  }

  has() { return true; }

  /** Équipement : cuisson rapide = four plus chaud (sur les deux plans de travail) ; enseigne « PIZZA » dehors. */
  refreshEquipment() {
    const eq = this.game.state.pz.eq, key = JSON.stringify(eq);
    if (key === this.equipKey) return;
    this.equipKey = key;
    for (const d of [-1, 1]) {
      const h = this.halves[d];
      h.oven.userData.glow.emissiveIntensity = 1.2 + 0.6 * eq.speed;
      h.hood.scale.set(1 + 0.12 * eq.speed, 1 + 0.2 * eq.speed, 1 + 0.08 * eq.speed);
    }
    this.neon.visible = eq.sign > 0;
    this.neon.userData.mat.emissiveIntensity = 0.9 + 0.7 * eq.sign;
  }

  /* ---------------- Le joueur ---------------- */
  act(action) {
    if (this.full()) { this.say(L('👨‍🍳👨‍🍳 Équipe au complet : tes 2 cuisiniers occupent tout le camion !', '👨‍🍳👨‍🍳 Full team: your 2 cooks are using the whole truck!')); sfx.nope(); return; }
    const p = this.pz;
    switch (action) {
      case 'dough': return this.addDough();
      case 'board': case 'pizza':
        if (!p) return this.addDough();
        if (p.stage === 'dough') return this.stretch();
        if (p.stage === 'out') return this.serve();
        if (p.stage === 'oven') return this.ovenToggle();
        return this.say(L('Ajoute les ingrédients, puis mets-la au four', 'Add the toppings, then put it in the oven'));
      case 'oven': return this.ovenToggle();
      case 'cut': return this.cutPizza();
      case 'trash': return this.trash();
      default:
        if (ITEMS.includes(action)) return this.addItem(action);
    }
  }

  addDough() {
    if (this.pz) { this.say(L('Une pizza à la fois !', 'One pizza at a time!')); sfx.nope(); return; }
    const pizza = createPizza();
    pizza.group.position.set(PX('board'), PIZZA_Y, Z.board);
    this.group.add(pizza.group);
    const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hitbox.position.copy(pizza.group.position); hitbox.position.y += 0.04;
    hitbox.userData = { action: 'pizza', ref: true, label: L('🍕 La pizza', '🍕 The pizza') };
    this.group.add(hitbox);
    this.pz = { pizza, hitbox, stage: 'dough', stretch: 0, items: new Set(), bake: 0, cut: false };
    this.dog = { hitbox }; // (pour que les clics visent la pizza en priorité)
    sfx.click();
  }

  stretch() {
    const p = this.pz;
    p.stretch += 1;
    p.pizza.setStretch(p.stretch / 3);
    if (p.stretch >= 3) p.stage = 'stretched';
    sfx.click();
  }

  addItem(t) {
    const p = this.pz;
    if (!p || p.stage !== 'stretched') { this.say(p && p.stage === 'dough' ? L("Étale d'abord la pâte (clique dessus)", 'Stretch the dough first (click it)') : L("D'abord une pâte étalée !", 'Stretched dough first!')); sfx.nope(); return; }
    if (p.items.has(t)) return;
    p.items.add(t);
    p.pizza.add(t);
    sfx.click();
  }

  ovenToggle() {
    const p = this.pz;
    const OX = PX('oven');
    if (p && p.stage === 'stretched') {
      if (!p.items.size) { this.say(L('Mets au moins la sauce et la mozzarella !', 'Add at least sauce and mozzarella!')); sfx.nope(); return; }
      p.stage = 'oven';
      p.pizza.group.position.set(OX, 1.545, Z.oven);
      p.hitbox.position.set(OX, 1.58, Z.oven);
      p.gauge = document.createElement('div');
      p.gauge.className = 'kg';
      p.gauge.innerHTML = '<i class="kg-good"></i><b></b>';
      this.gauges.appendChild(p.gauge);
      sfx.click();
      return;
    }
    if (p && p.stage === 'oven') {
      p.stage = 'out';
      p.pizza.group.position.set(PX('board'), PIZZA_Y, Z.board);
      p.hitbox.position.set(PX('board'), PIZZA_Y + 0.04, Z.board);
      p.gauge.remove(); p.gauge = null;
      sfx.click();
      return;
    }
    this.say(L('Le four attend une pizza garnie', 'The oven is waiting for a topped pizza'));
  }

  cutPizza() {
    const p = this.pz;
    if (!p || p.stage !== 'out') { this.say(L('On coupe la pizza une fois sortie du four', 'Cut the pizza once it is out of the oven')); sfx.nope(); return; }
    if (p.cut) return;
    p.cut = true; p.pizza.cut();
    sfx.click();
  }

  trash() {
    const p = this.pz;
    if (!p) { this.say(L('Rien à jeter', 'Nothing to throw away')); return; }
    this.group.remove(p.pizza.group, p.hitbox);
    if (p.gauge) p.gauge.remove();
    this.pz = null; this.dog = null;
    sfx.nope();
  }

  serve() {
    const p = this.pz;
    const c = this.customer();
    if (!c) { this.say(L("Personne n'attend au comptoir pour l'instant", 'Nobody is waiting at the counter yet')); sfx.nope(); return; }
    // note : cuisson + ingrédients demandés (rien de plus) + découpe
    const cook = sideScore(p.bake);
    const want = new Set(pizzaItems(c.order));
    let wrong = 0;
    for (const t of ITEMS) if (want.has(t) !== p.items.has(t)) wrong += 1;
    if (!p.cut) wrong += 1;
    const q = 0.5 * cook + 0.5 * Math.max(0, 1 - wrong * 0.34);
    const stars = q > 0.85 ? 3 : q > 0.55 ? 2 : 1;
    let why = '';
    if (cook < 0.6) why = p.bake > GOOD[1] ? L(' (trop cuite)', ' (overcooked)') : L(' (pas assez cuite)', ' (undercooked)');
    else if (!p.cut) why = L(' (pas coupée)', ' (not sliced)');
    else if (wrong) why = L(' (mauvais ingrédients)', ' (wrong toppings)');
    this.game.serveManual(this.stand, q, c);
    this.ui.toast(`${stars === 3 ? '😍' : stars === 2 ? '🙂' : '😖'} ${'⭐'.repeat(stars)}${why}`);
    this.group.remove(p.hitbox);
    this.flying.push({ group: p.pizza.group, from: p.pizza.group.position.clone(), to: this.stand.root.worldToLocal(c.headPos().add(new THREE.Vector3(0, -0.5, 0))), t: 0 });
    this.pz = null; this.dog = null;
  }

  /** Cuisson de la pizza du joueur (jauge au-dessus du four, fumée, grésillement). */
  updatePlayer(dt) {
    const p = this.pz, w = this.world;
    if (p && p.stage === 'oven') {
      p.bake += BAKE_RATE * (1 + 0.15 * this.game.state.pz.eq.speed) * dt;
      p.pizza.setBake(p.bake);
      const s = w.toScreen(this.stand.root.localToWorld(new THREE.Vector3(PX('oven'), 1.9, Z.oven)));
      p.gauge.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      p.gauge.querySelector('b').style.left = `${Math.min(100, (p.bake / 2) * 100)}%`;
      p.gauge.classList.toggle('ok', p.bake >= GOOD[0] && p.bake <= GOOD[1]);
      p.gauge.classList.toggle('burn', p.bake > GOOD[1]);
      p.puffT = (p.puffT || 0) - dt;
      if (p.puffT <= 0) { p.puffT = p.bake > GOOD[1] ? 0.12 : 0.4; this.puff(PX('oven'), Z.oven - 0.2, p.bake > 1.7); }
    }
    setSizzle(Math.min(1, ((p && p.stage === 'oven' ? 1 : 0) + this.stand.cooks) / 2));
  }

  orderHtml(c) {
    const m = E.pizzaModel(c.order.model);
    return `${m.emoji} ${m.name} : ${pizzaItems(c.order).map((t) => `${E.PIZZA_ITEMS[t].emoji} ${E.PIZZA_ITEMS[t].name.toLowerCase()}`).join(' + ')}`;
  }

  nextStep() {
    const p = this.pz, c = this.customer();
    if (!p) return [L('👉 Clique sur le bac de pâte pour prendre une boule', '👉 Click the dough tray to grab a dough ball'), PX('dough')];
    if (p.stage === 'dough') return [L(`👉 Clique sur la pâte pour l'étaler (${p.stretch}/3)`, `👉 Click the dough to stretch it (${p.stretch}/3)`), PX('board')];
    if (p.stage === 'stretched') {
      const missing = c ? pizzaItems(c.order).filter((t) => !p.items.has(t)) : [];
      if (missing.length) return [L(`👉 Ajoute : ${missing.map((t) => E.PIZZA_ITEMS[t].name.toLowerCase()).join(', ')}`, `👉 Add: ${missing.map((t) => E.PIZZA_ITEMS[t].name.toLowerCase()).join(', ')}`), PX('mozza')];
      return [L('👉 Clique sur le four pour enfourner', '👉 Click the oven to bake it'), PX('oven')];
    }
    if (p.stage === 'oven') return p.bake >= GOOD[0] ? [L('👉 Jauge dans le vert : clique sur le four pour la sortir !', '👉 Gauge in the green: click the oven to take it out!'), PX('oven')] : [L('⏳ Ça cuit… attends que la jauge soit dans le vert', '⏳ Baking… wait for the gauge to hit the green'), PX('oven')];
    if (!p.cut) return [L('👉 Coupe-la avec la roulette', '👉 Slice it with the cutter'), PX('cutter')];
    return [c ? L('👉 Clique sur la pizza pour la servir', '👉 Click the pizza to serve it') : L('👉 La pizza est prête : attends un client', '👉 The pizza is ready: wait for a customer'), PX('board')];
  }

  /* ---------------- Aides (barre d'ingrédients, étiquettes) ---------------- */
  ingredients() { return ITEMS.map((k) => ({ key: k, emoji: E.PIZZA_ITEMS[k].emoji, name: E.PIZZA_ITEMS[k].name })); }
  prepState() {
    const p = this.pz, c = this.customer();
    return { added: p ? p.items : new Set(), need: c ? pizzaItems(c.order) : [], ready: !!(p && p.stage === 'stretched') };
  }
  itemObj(k) { return this.halves[-1].items[k]; }

  /* ---------------- Les cuisiniers ---------------- */
  updateMember(m, sj, dt) {
    const d = m.d, half = this.halves[d];
    const OX = C + d * U.oven, BX = C + d * U.board, KX = (k) => C + d * U[k];
    if (sj && (!m.job || m.job.c !== sj.c)) {
      if (m.job) this.dropJob(m.job, m.job.c.state === 'queue');
      const o = sj.c.order || { model: 'margherita', tops: [] };
      m.job = { c: sj.c, order: o, items: pizzaItems(o) };
    }
    if (m.job && (!sj || sj.c !== m.job.c)) { this.dropJob(m.job, m.job.c.state === 'queue'); m.job = null; }
    const job = m.job, c = m.c, pos = c.root.position;
    const AT_O = OX + d * 0.1, AT_B = BX + d * 0.05, AT_W = C + d * 0.3;
    let goal = AT_O, lookX = OX, lookZ = Z.oven, work = 'idle';
    const hand = () => new THREE.Vector3(pos.x + Math.sin(c.yaw) * 0.36, 1.56, pos.z + Math.cos(c.yaw) * 0.36);
    const near = (x) => Math.abs(pos.x - x) < 0.06;
    if (job) {
      const p = sj && sj.duration > 0 ? 1 - sj.timer / sj.duration : 1;
      const ord = job.items;
      // étapes : pâte sur la planche → étaler → garnir → enfourner → cuisson → sortir → couper → servir
      if (p < 0.22) { goal = AT_B; lookX = BX; lookZ = Z.board; work = p < 0.08 ? 'bun' : 'stretch'; }
      else if (p < 0.42) {
        goal = AT_B; work = 'sauce';
        const cur = ord[Math.min(ord.length - 1, Math.floor(((p - 0.22) / 0.2) * ord.length))];
        lookX = cur ? KX(cur) : BX; lookZ = cur ? Z[cur] : Z.board;
      } else if (p < 0.5) { goal = AT_O; work = 'carry'; }
      else if (p < 0.76) { goal = AT_O; work = 'oven'; }
      else if (p < 0.82) { goal = AT_B; lookX = BX; lookZ = Z.board; work = 'carry'; }
      else if (p < 0.9) { goal = AT_B; lookX = KX('cutter'); lookZ = Z.board; work = 'cut'; }
      else { goal = AT_W; lookX = C + d * 0.25; lookZ = 1.45; work = 'hand'; }
      // la pâte arrive sur la planche
      if (!job.pz && near(AT_B) && p >= 0.04) {
        job.pz = createPizza();
        job.pz.group.position.set(BX, PIZZA_Y, Z.board);
        this.cookStation.add(job.pz.group);
        job.dog = job.pz.group; // (dropJob envoie job.dog au client)
      }
      if (job.pz) {
        job.pz.setStretch(Math.min(1, Math.max(0, (p - 0.08) / 0.14)));
        // garnitures, une par une
        if (p >= 0.22) {
          const idx = Math.min(ord.length, Math.floor(((p - 0.22) / 0.2) * ord.length) + 1);
          job.done = job.done || new Set();
          for (let k = 0; k < idx; k++) if (!job.done.has(ord[k])) { job.done.add(ord[k]); job.pz.add(ord[k]); }
        }
        // portée jusqu'au four, cuisson, retour sur la planche, découpe, puis à la fenêtre
        if (p >= 0.42 && p < 0.5) { job.carried = true; job.pz.group.position.copy(hand()); }
        else if (p >= 0.5 && p < 0.76) {
          job.carried = false;
          job.pz.group.position.set(OX, 1.545, Z.oven);
          job.pz.setBake((p - 0.5) / 0.26);
          this.cookPuffT = (this.cookPuffT || 0) - dt;
          if (this.cookPuffT <= 0) { this.cookPuffT = 0.4; this.puff(OX, Z.oven - 0.2, false); }
        } else if (p >= 0.76 && p < 0.82) { job.carried = true; job.pz.group.position.copy(hand()); }
        else if (p >= 0.82 && p < 0.9) { job.carried = false; job.pz.group.position.set(BX, PIZZA_Y, Z.board); if (p > 0.86 && !job.cut) { job.cut = true; job.pz.cut(); } }
        else if (p >= 0.9) { const h = hand(); job.pz.group.position.lerp(new THREE.Vector3(h.x, 1.52, Math.min(1.42, h.z + 0.25)), Math.min(1, dt * 10)); }
      }
    }
    void half;
    this.moveCook(m, dt, goal, lookX, lookZ, work, job && (job.carried || work === 'hand'));
  }
}

export { makeCook };
