import { THREE } from './util.js';
import * as E from './economy.js';
import { L } from './i18n.js';
import { sfx, setSizzle } from './audio.js';
import { Kitchen, sideScore } from './kitchen.js';
import { buildPan, buildNeon, buildGriddle, buildHood, buildBin, buildBoard, buildTortillaStack, buildWraps, createTaco, wrapTaco, smokeTex } from './kitchen-decor.js';

/*
 * Camion n°3 : la taqueria. Même camion (deux moitiés en miroir), autre cuisine.
 *
 * Un taco :
 *   1. clic sur la pile de tortillas → une tortilla chauffe sur la plancha (jauge)
 *   2. clic sur la tortilla quand la jauge est dans le vert → elle va sur la planche
 *   3. clic sur les bacs : les garnitures du taco commandé (+ l'option du client : piment ou citron vert)
 *   4. clic sur le taco → on le plie ; re-clic → servi
 * Les cuisiniers font les mêmes gestes, chacun sur sa moitié.
 */

const C = -0.9;
// devant : papiers, planche, piment, plancha, tortillas, poubelle ; au fond : rail de 8 bacs, citron vert
const U = { wraps: 0.1, board: 0.45, piment: 0.8, grill: 1.25, stack: 1.82, bin: 2.12, lime: 2.12,
  chicken: 0.07, beef: 0.19, salad: 0.31, tomato: 0.43, onions: 0.55, cheddar: 0.67, salsa: 0.79, guac: 0.91 };
const Z = { wraps: 0.62, board: 0.7, piment: 0.62, grill: 0.82, stack: 0.76, bin: 0.7, lime: 1.02,
  chicken: 1.0, beef: 1.0, salad: 1.0, tomato: 1.0, onions: 1.0, cheddar: 1.0, salsa: 1.0, guac: 1.0 };
const ITEMS = ['chicken', 'beef', 'salad', 'tomato', 'onions', 'cheddar', 'salsa', 'guac', 'piment', 'lime'];
const PX = (k) => C - U[k];
const WARM_RATE = 1 / 4; // une tortilla est chaude en 4 s environ
const GOOD = [0.75, 1.35];
const TACO_Y = 1.503; // (juste au-dessus de la planche, dont le dessus est à 1,50)

/** Ce que demande une commande : les garnitures du taco + l'option éventuelle. */
export const tacoItems = (o) => [...E.tacoModel(o.model).need, ...o.tops];

/** Commande au hasard : un taco débloqué, parfois avec une option (piment ou citron vert). */
export function randomTacoOrder(S) {
  const models = E.TACO_MODELS.filter((m) => (S.recipes[m.id] || 0) > 0);
  const model = (models[Math.floor(Math.random() * models.length)] || E.TACO_MODELS[0]).id;
  const tops = Math.random() < 0.45 ? [E.TACO_EXTRAS[Math.floor(Math.random() * E.TACO_EXTRAS.length)].id] : [];
  return { model, tops };
}

export class TacoKitchen extends Kitchen {
  get emoji() { return '🌮'; }

  /* ---------------- Postes ---------------- */
  buildStations() {
    const g = this.group;
    this.slots = [];
    this.neon = buildNeon(g, 1.1, 2.25, 1.235, 'TACOS');
    this.halves = { [-1]: this.buildHalf(-1), [1]: this.buildHalf(1) };
    this.hit(0.34, 0.16, 0.32, PX('stack'), 1.55, Z.stack, 'tortilla', L('Tortillas', 'Tortillas'));
    this.hit(0.66, 0.16, 0.56, PX('grill'), 1.6, Z.grill, 'grill', L('Plancha', 'Griddle'));
    this.hit(0.56, 0.16, 0.36, PX('board'), 1.53, Z.board, 'board', L('Planche', 'Board'));
    for (const t of ITEMS) this.hit(0.12, 0.16, 0.17, PX(t), 1.54, Z[t], t, `${E.TACO_ITEMS[t].emoji} ${E.TACO_ITEMS[t].name}`);
    this.hit(0.3, 0.34, 0.26, PX('bin'), 1.62, Z.bin, 'trash', L('🗑️ Poubelle', '🗑️ Trash'));
    this.cookStation = new THREE.Group();
    g.add(this.cookStation);
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
    h.griddle = buildGriddle(g, X('grill'), Z.grill);
    h.hood = buildHood(g, X('grill'));
    const lamp = new THREE.SpotLight('#ffd9a8', 3, 2.2, 0.9, 0.8, 1.5);
    lamp.position.set(X('grill'), 2.48, 0.7); lamp.target.position.set(X('grill'), 1.5, 0.85);
    g.add(lamp, lamp.target);
    this.lights.push(lamp);
    buildTortillaStack(g, X('stack'), Z.stack);
    buildBoard(g, new THREE.Vector3(X('board'), 0, Z.board));
    buildWraps(g, X('wraps'), Z.wraps);
    for (const t of ITEMS) h.items[t] = buildPan(g, X(t), Z[t], t);
    buildBin(g, X('bin'), Z.bin);
    return h;
  }

  has() { return true; }

  /** Équipement : cuisson rapide = hotte plus grosse (sur les deux plans de travail) ; enseigne « TACOS » dehors. */
  refreshEquipment() {
    const eq = this.game.state.tc.eq, key = JSON.stringify(eq);
    if (key === this.equipKey) return;
    this.equipKey = key;
    for (const d of [-1, 1]) this.halves[d].hood.scale.set(1 + 0.12 * eq.speed, 1 + 0.2 * eq.speed, 1 + 0.08 * eq.speed);
    this.neon.visible = eq.sign > 0;
    this.neon.userData.mat.emissiveIntensity = 0.9 + 0.7 * eq.sign;
  }

  /* ---------------- Le joueur ---------------- */
  act(action) {
    if (this.full()) { this.say(L('👨‍🍳👨‍🍳 Équipe au complet : tes 2 cuisiniers occupent tout le camion !', '👨‍🍳👨‍🍳 Full team: your 2 cooks are using the whole truck!')); sfx.nope(); return; }
    const t = this.tc;
    switch (action) {
      case 'tortilla': return this.addTortilla();
      case 'grill': return t && t.stage === 'warm' ? this.toBoard() : this.addTortilla();
      case 'board': case 'taco':
        if (!t) return this.say(L('Prends une tortilla (la pile, à droite)', 'Grab a tortilla (the stack, on the right)'));
        if (t.stage === 'warm') return this.toBoard();
        if (t.stage === 'board') return this.foldTaco();
        if (t.stage === 'folded') return this.serve();
        return undefined;
      case 'trash': return this.trash();
      default:
        if (ITEMS.includes(action)) return this.addItem(action);
    }
    return undefined;
  }

  addTortilla() {
    if (this.tc) { this.say(L('Un taco à la fois !', 'One taco at a time!')); sfx.nope(); return; }
    const taco = createTaco();
    taco.group.position.set(PX('grill'), 1.585, Z.grill);
    this.group.add(taco.group);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hitbox.position.set(PX('grill'), 1.62, Z.grill);
    hitbox.userData = { action: 'taco', ref: true, label: L('🌮 Le taco', '🌮 The taco') };
    this.group.add(hitbox);
    const gauge = document.createElement('div');
    gauge.className = 'kg';
    gauge.innerHTML = '<i class="kg-good"></i><b></b>';
    this.gauges.appendChild(gauge);
    this.tc = { taco, hitbox, gauge, stage: 'warm', warm: 0, items: new Set() };
    this.dog = { hitbox }; // (les clics visent le taco en priorité)
    sfx.click();
  }

  toBoard() {
    const t = this.tc;
    t.stage = 'board';
    t.taco.group.position.set(PX('board'), TACO_Y, Z.board);
    t.hitbox.position.set(PX('board'), TACO_Y + 0.04, Z.board);
    t.gauge.remove(); t.gauge = null;
    sfx.click();
  }

  addItem(it) {
    const t = this.tc;
    if (!t || t.stage !== 'board') { this.say(t && t.stage === 'warm' ? L('Pose d\'abord la tortilla chaude sur la planche (clique dessus)', 'Put the warm tortilla on the board first (click it)') : t ? L('Le taco est déjà plié', 'The taco is already folded') : L("D'abord une tortilla chaude !", 'Warm tortilla first!')); sfx.nope(); return; }
    if (t.items.has(it)) return;
    t.items.add(it);
    t.taco.add(it);
    sfx.click();
  }

  foldTaco() {
    const t = this.tc;
    if (!t.items.size) { this.say(L('Garnis le taco avant de le plier', 'Fill the taco before folding it')); sfx.nope(); return; }
    t.stage = 'folded';
    t.taco.fold();
    sfx.click();
  }

  trash() {
    const t = this.tc;
    if (!t) { this.say(L('Rien à jeter', 'Nothing to throw away')); return; }
    this.group.remove(t.taco.group, t.hitbox);
    if (t.gauge) t.gauge.remove();
    this.tc = null; this.dog = null;
    sfx.nope();
  }

  serve() {
    const t = this.tc;
    const c = this.customer();
    if (!c) { this.say(L("Personne n'attend au comptoir pour l'instant", 'Nobody is waiting at the counter yet')); sfx.nope(); return; }
    // note : tortilla bien chaude + garnitures demandées (rien de plus)
    const warm = sideScore(t.warm);
    const want = new Set(tacoItems(c.order));
    let wrong = 0;
    for (const it of ITEMS) if (want.has(it) !== t.items.has(it)) wrong += 1;
    const q = 0.5 * warm + 0.5 * Math.max(0, 1 - wrong * 0.34);
    const stars = q > 0.85 ? 3 : q > 0.55 ? 2 : 1;
    let why = '';
    if (warm < 0.6) why = t.warm > GOOD[1] ? L(' (tortilla brûlée)', ' (burnt tortilla)') : L(' (tortilla froide)', ' (cold tortilla)');
    else if (wrong) why = L(' (mauvaises garnitures)', ' (wrong fillings)');
    this.game.serveManual(this.stand, q, c);
    this.ui.toast(`${stars === 3 ? '😍' : stars === 2 ? '🙂' : '😖'} ${'⭐'.repeat(stars)}${why}`);
    this.group.remove(t.hitbox);
    wrapTaco(t.taco); // emballé dans son papier, puis il part
    this.flying.push({ group: t.taco.group, from: t.taco.group.position.clone(), to: this.stand.root.worldToLocal(c.headPos().add(new THREE.Vector3(0, -0.5, 0))), t: 0, wait: 0.3 });
    this.tc = null; this.dog = null;
  }

  /** La tortilla du joueur chauffe sur la plancha (jauge, fumée, grésillement). */
  updatePlayer(dt) {
    const t = this.tc, w = this.world;
    if (t && t.stage === 'warm') {
      t.warm += WARM_RATE * (1 + 0.15 * this.game.state.tc.eq.speed) * dt;
      t.taco.setWarm(t.warm);
      const s = w.toScreen(this.stand.root.localToWorld(new THREE.Vector3(PX('grill'), 1.75, Z.grill)));
      t.gauge.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      t.gauge.querySelector('b').style.left = `${Math.min(100, (t.warm / 2) * 100)}%`;
      t.gauge.classList.toggle('ok', t.warm >= GOOD[0] && t.warm <= GOOD[1]);
      t.gauge.classList.toggle('burn', t.warm > GOOD[1]);
      t.puffT = (t.puffT || 0) - dt;
      if (t.puffT <= 0) { t.puffT = t.warm > GOOD[1] ? 0.12 : 0.45; this.puff(PX('grill'), Z.grill, t.warm > 1.7); }
    }
    setSizzle(Math.min(1, ((t && t.stage === 'warm' ? 1 : 0) + this.stand.cooks) / 2));
  }

  orderHtml(c) {
    const m = E.tacoModel(c.order.model);
    return `${m.emoji} ${m.name} : ${tacoItems(c.order).map((it) => `${E.TACO_ITEMS[it].emoji} ${E.TACO_ITEMS[it].name.toLowerCase()}`).join(' + ')}`;
  }

  nextStep() {
    const t = this.tc, c = this.customer();
    if (!t) return [L('👉 Clique sur la pile de tortillas pour en chauffer une', '👉 Click the tortilla stack to warm one up'), PX('stack')];
    if (t.stage === 'warm') return t.warm >= GOOD[0] ? [L('👉 Jauge dans le vert : clique sur la tortilla pour la poser sur la planche', '👉 Gauge in the green: click the tortilla to move it to the board'), PX('grill')] : [L('⏳ La tortilla chauffe… attends que la jauge soit dans le vert', '⏳ Warming… wait for the gauge to hit the green'), PX('grill')];
    if (t.stage === 'board') {
      const missing = c ? tacoItems(c.order).filter((it) => !t.items.has(it)) : [];
      if (missing.length) return [L(`👉 Ajoute : ${missing.map((it) => E.TACO_ITEMS[it].name.toLowerCase()).join(', ')}`, `👉 Add: ${missing.map((it) => E.TACO_ITEMS[it].name.toLowerCase()).join(', ')}`), PX('tomato')];
      return [L('👉 Clique sur le taco pour le plier', '👉 Click the taco to fold it'), PX('board')];
    }
    return [c ? L('👉 Clique sur le taco pour le servir', '👉 Click the taco to serve it') : L('👉 Le taco est prêt : attends un client', '👉 The taco is ready: wait for a customer'), PX('board')];
  }

  /* ---------------- Aides (barre d'ingrédients, étiquettes) ---------------- */
  ingredients() { return ITEMS.map((k) => ({ key: k, emoji: E.TACO_ITEMS[k].emoji, name: E.TACO_ITEMS[k].name })); }
  prepState() {
    const p = this.tc, c = this.customer();
    return { added: p ? p.items : new Set(), need: c ? tacoItems(c.order) : [], ready: !!(p && p.stage === 'board') };
  }
  itemObj(k) { return this.halves[-1].items[k]; }

  /* ---------------- Les cuisiniers ---------------- */
  updateMember(m, sj, dt) {
    const d = m.d;
    const GX = C + d * U.grill, BX = C + d * U.board, KX = (k) => C + d * U[k];
    if (sj && (!m.job || m.job.c !== sj.c)) {
      if (m.job) this.dropJob(m.job, m.job.c.state === 'queue');
      const o = sj.c.order || { model: 'tacochicken', tops: [] };
      m.job = { c: sj.c, order: o, items: tacoItems(o) };
    }
    if (m.job && (!sj || sj.c !== m.job.c)) { this.dropJob(m.job, m.job.c.state === 'queue'); m.job = null; }
    const job = m.job, c = m.c, pos = c.root.position;
    const AT_G = GX + d * 0.1, AT_B = BX + d * 0.05, AT_W = C + d * 0.3;
    let goal = AT_G, lookX = GX, lookZ = Z.grill, work = 'idle';
    const hand = () => new THREE.Vector3(pos.x + Math.sin(c.yaw) * 0.36, 1.56, pos.z + Math.cos(c.yaw) * 0.36);
    const near = (x) => Math.abs(pos.x - x) < 0.06;
    if (job) {
      const p = sj && sj.duration > 0 ? 1 - sj.timer / sj.duration : 1;
      const ord = job.items;
      // étapes : tortilla sur la plancha → chauffe (retournée) → portée sur la planche → garnitures → pliage → fenêtre
      if (p < 0.32) { goal = AT_G; work = p < 0.06 ? 'fridge' : p > 0.2 && p < 0.24 ? 'flip' : 'grill'; }
      else if (p < 0.38) { goal = AT_B; lookX = BX; lookZ = Z.board; work = 'carry'; }
      else if (p < 0.72) {
        goal = AT_B; work = 'sauce';
        const cur = ord[Math.min(ord.length - 1, Math.floor(((p - 0.38) / 0.34) * ord.length))];
        lookX = cur ? KX(cur) : BX; lookZ = cur ? Z[cur] : Z.board;
      } else if (p < 0.88) { goal = AT_B; lookX = BX; lookZ = Z.board; work = 'bun'; }
      else { goal = AT_W; lookX = C + d * 0.25; lookZ = 1.45; work = 'hand'; }
      // la tortilla arrive sur la plancha
      if (!job.tc && near(AT_G) && p >= 0.05) {
        job.tc = createTaco();
        job.tc.group.position.set(GX, 1.585, Z.grill);
        this.cookStation.add(job.tc.group);
        job.dog = job.tc.group; // (dropJob envoie job.dog au client)
      }
      if (job.tc) {
        if (p < 0.32) {
          job.tc.setWarm(Math.min(1, (p - 0.05) / 0.27));
          job.tc.group.rotation.x = p > 0.2 && p < 0.24 ? ((p - 0.2) / 0.04) * Math.PI * 2 : 0; // retournée d'un geste
          this.cookPuffT = (this.cookPuffT || 0) - dt;
          if (this.cookPuffT <= 0) { this.cookPuffT = 0.45; this.puff(GX, Z.grill, false); }
        } else if (p < 0.38) { job.carried = true; job.tc.group.rotation.x = 0; job.tc.group.position.copy(hand()); }
        else if (p < 0.88) {
          job.carried = false;
          job.tc.group.position.set(BX, TACO_Y, Z.board);
          const idx = Math.min(ord.length, Math.floor(((p - 0.38) / 0.34) * ord.length) + 1);
          job.done = job.done || new Set();
          for (let k = 0; k < idx; k++) if (!job.done.has(ord[k])) { job.done.add(ord[k]); job.tc.add(ord[k]); }
          if (p >= 0.78 && !job.tc.folded) job.tc.fold();
        } else { if (!job.tc.paper) wrapTaco(job.tc); const h = hand(); job.tc.group.position.lerp(new THREE.Vector3(h.x, 1.52, Math.min(1.42, h.z + 0.25)), Math.min(1, dt * 10)); }
      }
    }
    this.moveCook(m, dt, goal, lookX, lookZ, work, job && (job.carried || work === 'hand'));
  }
}
