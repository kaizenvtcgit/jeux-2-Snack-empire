import { THREE, M, add, cyl, sph, rbox, canvasTex } from './util.js';
import * as E from './economy.js';
import { queueLocal, QUEUE_ALONG } from './stand.js';
import { buildMarketHall, hallFront, setRoofFade, HALL } from './market.js';
import { ArrivalBoat } from './port.js';
import { buildFairDecor, setFairNight } from './fair.js';
import { fairPath } from './fairnav.js';
import { buildBeachDecor } from './beach.js';

/*
 * Rend les améliorations visibles dans la scène 3D :
 *  - Espace d'attente : marquage au sol, bacs à plantes et ardoise qui suivent la file (en L le long du camion).
 *  - Grill turbo : fumée de plus en plus dense à la cheminée, puis flammes (niv. 8+).
 *  - Publicité : ballons (1+), drapeaux plumes (3+, 7+), grand panneau (6+),
 *    bonhomme gonflable (10+), projecteurs dans le ciel (15+).
 *  - Recettes : chaque plat débloqué apparaît sur le comptoir.
 *  - Confettis à chaque achat.
 */

const easeOutBack = (k) => { const s = 1.70158; return 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2; };

export class UpgradeVisuals {
  constructor(world, game) {
    this.world = world;
    this.game = game;
    this.scene = world.scene;
    this.time = 0;
    this.pops = [];
    this.confetti = [];
    this.smoke = [];
    this.res = makeResources();
    this.stands = game.stands.map(() => ({ cap: 0, posts: [], rails: null, balloons: null, nBalloons: 0, flags: [], nFlags: 0, props: null, propsKey: '', smokeT: Math.random() }));
    this.global = { billboard: null, tubeman: null, lights: null, hall: null };
    this.prevKey = null;
    this.boat = new ArrivalBoat(this.scene); // bateau de l'arrivage du pêcheur (port)
    this.sync(true);
  }

  /* ---------- Synchronise la scène avec l'état du jeu (appelé 10×/s) ---------- */
  sync(first = false) {
    const S = this.game.state;
    const mk = S.up.marketing;

    this.game.stands.forEach((stand, i) => {
      const v = this.stands[i];
      const open = stand.unlocked;
      const truck = open && stand.kind === 'truck'; // ballons, drapeaux, plats : seulement les camions
      const root = stand.root;

      // Espace d'attente (camions et étals)
      const cap = open ? E.queueCap(S.up.queue) : 0;
      if (cap !== v.cap) { this.buildRails(v, root, cap, !first && v.cap > 0); v.cap = cap; }

      // Ballons
      const nb = truck && mk >= 1 ? Math.min(6, 1 + Math.floor(mk / 2)) : 0;
      if (nb !== v.nBalloons) {
        if (v.balloons) root.remove(v.balloons);
        v.balloons = nb ? this.buildBalloons(nb, i) : null;
        if (v.balloons) { root.add(v.balloons); if (!first) this.pop(v.balloons); }
        v.nBalloons = nb;
      }

      // Drapeaux plumes
      const nf = truck ? (mk >= 3 ? 1 : 0) + (mk >= 7 ? 1 : 0) : 0;
      if (nf !== v.nFlags) {
        v.flags.forEach((f) => root.remove(f));
        v.flags = [];
        const spots = [[4.7, 2.1, 'BURGERS'], [-5.0, 1.7, 'FOOD']];
        for (let k = 0; k < nf; k++) {
          const f = this.buildFlag(spots[k][2], i + k);
          f.position.set(spots[k][0], 0, spots[k][1]);
          root.add(f); v.flags.push(f);
          if (!first && k >= v.nFlags) this.pop(f);
        }
        v.nFlags = nf;
      }

      // Plats sur le comptoir
      const propsKey = truck ? E.RECIPES.filter((r) => (S.recipes[r.id] || 0) > 0).map((r) => r.id).join(',') : '';
      if (propsKey !== v.propsKey) {
        if (v.props) root.remove(v.props);
        v.props = propsKey ? this.buildProps(propsKey.split(','), first ? null : v.propsKey.split(',')) : null;
        if (v.props) root.add(v.props);
        v.propsKey = propsKey;
      }
    });

    // Niveau 2 : la halle du marché apparaît avec le premier étal, puis s'élargit vers l'avant
    // quand la 2e rangée d'étals s'ouvre
    const stalls = this.game.stands.filter((s) => s.zone === 'market' && s.unlocked);
    const hallZ1 = stalls.length ? hallFront(stalls.some((s) => s.row === 1)) : 0;
    if (hallZ1 !== this.hallZ1) {
      if (this.global.hall) this.scene.remove(this.global.hall);
      this.global.hall = hallZ1 ? buildMarketHall(hallZ1) : null;
      if (this.global.hall) { this.scene.add(this.global.hall); if (!first && !this.hallZ1) this.pop(this.global.hall); }
      this.hallZ1 = hallZ1;
    }

    // Niveau 4 : décor de la fête foraine à l'ouverture du 1er stand forain
    this.toggleGlobal('fair', this.game.fairOpen(), () => buildFairDecor(fairPath), first);
    // Niveau 5 : la plage (le quai de gauche s'efface, le sable descend jusqu'à l'eau)
    const beachOpen = this.game.beachOpen();
    this.toggleGlobal('beach', beachOpen, () => buildBeachDecor(), first);
    if (this.scene.userData.beachQuay) this.scene.userData.beachQuay.visible = !beachOpen;

    // Éléments globaux de publicité
    this.toggleGlobal('billboard', mk >= 6, () => buildBillboard(this.res), first);
    this.toggleGlobal('tubeman', mk >= 10, () => buildTubeMan(), first);
    this.toggleGlobal('lights', mk >= 15, () => buildSearchlights(), first);

    // Confettis à chaque achat
    const key = JSON.stringify([S.up, S.recipes, S.stands.map((s) => s.cooks)]);
    if (this.prevKey !== null && key !== this.prevKey) {
      for (const st of this.game.stands) if (st.unlocked) this.burst(st.counterPos().add(new THREE.Vector3(0, -0.6, 0.6)));
    }
    this.prevKey = key;
  }

  toggleGlobal(name, on, build, first) {
    const cur = this.global[name];
    if (on && !cur) { const g = build(); this.scene.add(g); this.global[name] = g; if (!first) this.pop(g); }
    else if (!on && cur) { this.scene.remove(cur); this.global[name] = null; }
  }

  pop(obj, delay = 0) {
    obj.scale.setScalar(0.001);
    this.pops.push({ obj, t: -delay });
  }

  /* ---------- Espace d'attente (style food truck) ----------
   * Marquage « COMMANDEZ ICI » peint au sol, empreintes de pas peintes à chaque place,
   * bacs à plantes en bois côté extérieur de la file (un de plus tous les 2 niveaux),
   * olivier en pot au coin et ardoise « La file c'est par ici » au bout.
   */
  buildRails(v, root, cap, animate) {
    if (v.rails) root.remove(v.rails);
    v.rails = null;
    if (!cap) { v.cap = 0; return; }
    const R = this.res;
    const g = new THREE.Group();
    const oldCap = v.cap || 0;
    const delay = (k) => (k - oldCap) * 0.07;

    // « COMMANDEZ ICI » devant la fenêtre
    const order = new THREE.Mesh(R.decalPlane, R.orderDecal);
    order.rotation.x = -Math.PI / 2;
    order.scale.set(2.0, 0.62, 1);
    order.position.set(-0.9, 0.013, 1.95);
    order.receiveShadow = true;
    g.add(order);

    for (let k = 0; k < cap; k++) {
      // empreintes de pas peintes
      const p = queueLocal(k), yaw = k === 0 ? Math.PI : Math.atan2(queueLocal(k - 1).x - p.x, queueLocal(k - 1).z - p.z);
      const feet = new THREE.Mesh(R.decalPlane, R.feetDecal);
      feet.rotation.set(-Math.PI / 2, 0, yaw + Math.PI);
      feet.scale.setScalar(0.5);
      feet.position.set(p.x, 0.012, p.z);
      feet.receiveShadow = true;
      g.add(feet);
      if (animate && k >= oldCap) this.pop(feet, delay(k));

      // un bac à plantes toutes les 2 places, côté extérieur
      if (k % 2 === 1) {
        const pl = this.buildPlanter(k);
        if (k < QUEUE_ALONG) { pl.position.set(p.x + 0.4, 0, p.z + 0.75); pl.rotation.y = 0; }
        else { pl.position.set(p.x - 0.78, 0, p.z - 0.4); pl.rotation.y = Math.PI / 2; }
        g.add(pl);
        if (animate && k >= oldCap) this.pop(pl, delay(k));
      }
    }

    // olivier en pot au coin, quand la file tourne
    if (cap > QUEUE_ALONG) {
      const c = queueLocal(QUEUE_ALONG - 1);
      const tree = this.buildPottedTree();
      tree.position.set(c.x - 1.0, 0, c.z - 0.75); // coin extérieur du « L », hors du passage
      g.add(tree);
      if (animate && oldCap <= QUEUE_ALONG) this.pop(tree, delay(QUEUE_ALONG));
    }

    root.add(g);
    v.rails = g;
  }

  buildPlanter(k) {
    const R = this.res;
    const g = new THREE.Group();
    add(rbox(0.95, 0.42, 0.42, 0.03, R.wood), 0, 0.21, 0, g);
    for (let i = 0; i < 4; i++) add(new THREE.Mesh(R.plankLine, R.woodDark), 0, 0.08 + i * 0.1, 0.212, g);
    add(new THREE.Mesh(R.soil, R.soilM), 0, 0.415, 0, g);
    const bushes = [[-0.3, 0.17], [-0.05, 0.21], [0.22, 0.18], [0.36, 0.13]];
    bushes.forEach(([x, r], i) => add(sph(r, R.leaf[(i + k) % R.leaf.length], 14, 10), x, 0.45 + r * 0.6, (i % 2 ? 0.04 : -0.04), g));
    for (let i = 0; i < 6; i++) add(sph(0.03, R.flowers[(i + k) % R.flowers.length], 6, 4), -0.36 + i * 0.14, 0.62 + Math.sin(i * 2 + k) * 0.06, Math.cos(i * 3) * 0.1, g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  buildPottedTree() {
    const R = this.res;
    const g = new THREE.Group();
    add(cyl(0.28, 0.22, 0.5, R.terracotta, 20), 0, 0.25, 0, g);
    add(cyl(0.26, 0.26, 0.03, R.soilM, 20), 0, 0.49, 0, g);
    add(cyl(0.035, 0.05, 1.1, R.woodDark, 8), 0, 1.0, 0, g);
    for (const [x, y, z, r] of [[0, 1.65, 0, 0.36], [0.22, 1.5, 0.1, 0.25], [-0.2, 1.55, -0.08, 0.27], [0.05, 1.9, 0.05, 0.24]]) add(sph(r, R.leaf[1], 14, 10), x, y, z, g);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }


  /* ---------- Ballons ---------- */
  buildBalloons(n, seed) {
    const g = new THREE.Group();
    const colors = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#9b5de5'];
    for (let k = 0; k < n; k++) {
      const pivot = new THREE.Group();
      const h = 1.1 + (k % 3) * 0.35;
      const mat = M(colors[(k + seed) % colors.length], { r: 0.25, cc: true, cached: true });
      const b = new THREE.Mesh(this.res.balloon, mat);
      b.position.y = h; b.castShadow = true;
      pivot.add(b);
      add(new THREE.Mesh(this.res.knot, mat), 0, h - 0.27, 0, pivot);
      const str = new THREE.Mesh(this.res.string, this.res.stringM);
      str.scale.y = h - 0.25; str.position.y = (h - 0.25) / 2;
      pivot.add(str);
      pivot.position.set((k - (n - 1) / 2) * 0.12, 0, 0);
      pivot.rotation.z = (k - (n - 1) / 2) * 0.16;
      pivot.userData = { phase: k * 1.7, baseZ: pivot.rotation.z };
      g.add(pivot);
    }
    g.position.set(-3.2, 3.1, 1.0); // accroché au coin arrière du toit
    g.userData.balloons = true;
    return g;
  }

  /* ---------- Drapeau plume ---------- */
  buildFlag(text, k) {
    const colors = [['#e63946', '#ffd23f'], ['#1f9aa6', '#ffffff'], ['#f4a62a', '#1b1a24'], ['#8a5cd6', '#ffd23f']][k % 4];
    const tex = canvasTex(128, 512, (g, w, h) => {
      g.fillStyle = colors[0]; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2);
      g.fillStyle = colors[1]; g.font = '900 76px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 0, 4); g.restore();
    });
    const geo = new THREE.PlaneGeometry(0.62, 2.3, 1, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, Math.sin((y + 1.15) * 1.3) * 0.08 * (pos.getX(i) + 0.31)); }
    geo.computeVertexNormals();
    const f = new THREE.Group();
    add(cyl(0.025, 0.03, 3.3, this.res.chrome, 10), 0, 1.65, 0, f);
    const banner = new THREE.Mesh(geo, M('#ffffff', { map: tex, r: 0.8 }));
    banner.material.side = THREE.DoubleSide;
    banner.position.set(0.33, 2.05, 0);
    banner.castShadow = true;
    f.add(banner);
    f.userData = { flag: banner, phase: k };
    f.rotation.y = -0.6;
    return f;
  }

  /* ---------- Plats sur le comptoir ---------- */
  buildProps(ids, before) {
    const g = new THREE.Group();
    const spots = { fries: -1.2, tacos: -0.85, hotdog: -0.48, bubble: -0.15 };
    for (const id of ids) {
      if (!(id in spots)) continue;
      const p = PROP_BUILDERS[id]();
      p.position.set(spots[id], 1.53, 1.5);
      p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(p);
      if (before && !before.includes(id)) this.pop(p);
    }
    return g;
  }

  /* ---------- Confettis ---------- */
  burst(pos) {
    if (this.confetti.length > 240) return;
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(this.res.confettiGeo, this.res.confettiMats[i % this.res.confettiMats.length]);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
      m.userData = { v: new THREE.Vector3(Math.cos(a) * s * 0.5, 3 + Math.random() * 3, Math.sin(a) * s * 0.5), spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), life: 1.6 + Math.random() * 0.6 };
      this.scene.add(m);
      this.confetti.push(m);
    }
  }

  /* ---------- Animation (chaque image) ---------- */
  update(dt) {
    this.time += dt;
    const t = this.time;
    const S = this.game.state;

    // Bateau du pêcheur : accoste pendant l'arrivage, repart ensuite
    this.boat.update(dt, this.game.arrival > 0, t);
    // Fête foraine : décor (grande roue, carrousel) qui tourne, et ambiance de nuit sur toute la ville
    const fair = this.global.fair;
    if (fair) fair.userData.update(dt, t);
    const beach = this.global.beach;
    if (beach) beach.userData.update(dt, t, this.game.heat);
    this.world.setNight(this.game.night);
    setFairNight(this.game.night);

    // Toit du marché : il s'efface en douceur quand la caméra regarde le marché
    const hall = this.global.hall;
    if (hall) {
      const lookingAtMarket = this.world.controls.target.x > HALL.x0 - 2; // (le port est à gauche, x < 0)
      const cur = hall.userData.roof.fade;
      const next = THREE.MathUtils.clamp(cur + (lookingAtMarket ? 1 : -1) * dt * 2.5, 0, 1);
      if (next !== cur) setRoofFade(hall, next);
    }

    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt * 2.2;
      if (p.t <= 0) continue;
      const k = Math.min(1, p.t);
      p.obj.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      if (k >= 1) this.pops.splice(i, 1);
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i], u = c.userData;
      u.life -= dt;
      u.v.y -= 9 * dt; u.v.multiplyScalar(1 - dt * 1.2);
      if (c.position.y < 0.02) { c.position.y = 0.02; u.v.set(0, 0, 0); }
      c.position.addScaledVector(u.v, dt);
      c.rotation.x += u.spin.x * dt; c.rotation.y += u.spin.y * dt; c.rotation.z += u.spin.z * dt;
      if (u.life <= 0) { this.scene.remove(c); this.confetti.splice(i, 1); }
    }

    // Fumée / flammes (grill turbo)
    const speed = S.up.speed;
    const rate = 0.7 + speed * 0.3;
    this.game.stands.forEach((stand, i) => {
      if (!stand.unlocked || stand.kind !== 'truck') return; // pas de cheminée sur les étals
      const v = this.stands[i];
      v.smokeT -= dt * rate * (stand.serving ? 1.6 : 0.6);
      if (v.smokeT <= 0) {
        v.smokeT = 1;
        this.emitSmoke(new THREE.Vector3(stand.x - 2.6, 4.25, -0.75), speed);
      }
      if (v.balloons) for (const p of v.balloons.children) p.rotation.z = p.userData.baseZ + Math.sin(t * 1.3 + p.userData.phase) * 0.08, p.rotation.x = Math.sin(t * 0.9 + p.userData.phase) * 0.07;
      for (const f of v.flags) f.userData.flag.rotation.y = Math.sin(t * 2 + f.userData.phase) * 0.18;
    });
    this.updateFlames(speed >= 8);

    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i], u = s.userData;
      u.age += dt;
      const k = u.age / u.life;
      if (k >= 1) { this.scene.remove(s); s.material.dispose(); this.smoke.splice(i, 1); continue; }
      s.position.y += dt * u.rise;
      s.position.x += dt * u.drift;
      s.scale.setScalar(u.size * (0.5 + k * 2.2));
      s.material.opacity = u.alpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    }

    // Bonhomme gonflable
    const tm = this.global.tubeman;
    if (tm) {
      tm.userData.segs.forEach((seg, k) => {
        seg.rotation.z = Math.sin(t * 5.5 - k * 0.9) * (0.18 + k * 0.04);
        seg.rotation.x = Math.sin(t * 3.7 - k * 0.7) * 0.12;
      });
      tm.userData.arms.forEach((a, k) => { a.rotation.z = (k ? -1 : 1) * (1.1 + Math.sin(t * 7 + k * 2) * 0.7); });
    }
    // Projecteurs
    const lights = this.global.lights;
    if (lights) lights.children.forEach((l, k) => { l.userData.beam.rotation.z = Math.sin(t * 0.5 + k * 2) * 0.45; l.userData.beam.rotation.x = Math.cos(t * 0.37 + k) * 0.25; });
  }

  emitSmoke(pos, speed) {
    if (this.smoke.length > 120) return;
    const mat = new THREE.SpriteMaterial({ map: this.res.puff, color: speed >= 8 ? '#fff1e0' : '#f4f2ee', transparent: true, depthWrite: false, opacity: 0, fog: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.1));
    s.material.rotation = Math.random() * Math.PI * 2;
    s.userData = { age: 0, life: 2.4 + Math.random(), rise: 0.7 + speed * 0.03, drift: 0.15 + Math.random() * 0.35, size: 0.8 + Math.min(1, speed / 20) * 0.8, alpha: 0.6 + Math.min(0.3, speed * 0.02) };
    this.scene.add(s);
    this.smoke.push(s);
  }

  updateFlames(on) {
    this.game.stands.forEach((stand, i) => {
      const v = this.stands[i];
      if (on && stand.unlocked && stand.kind === 'truck' && !v.flame) {
        v.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.res.flame, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        v.flame.position.set(-2.6, 4.3, -0.75);
        stand.root.add(v.flame);
      } else if ((!on || !stand.unlocked) && v.flame) { stand.root.remove(v.flame); v.flame = null; }
      if (v.flame) { const f = 0.8 + Math.sin(this.time * 23 + i) * 0.1 + Math.random() * 0.1; v.flame.scale.set(f, f * 1.6, 1); }
    });
  }
}

/* ---------- Ressources partagées ---------- */
function makeResources() {
  const puff = canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const flame = canvasTex(64, 96, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.6, h * 0.55);
    gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(0.3, 'rgba(255,170,40,.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const queueSign = M('#ffffff', { r: 0.5, map: canvasTex(256, 150, (g, w, h) => {
    g.fillStyle = '#1b1a24'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffd23f'; g.font = 'bold 40px "Segoe UI", sans-serif'; g.textAlign = 'center';
    g.fillText('FILE', w / 2, 62); g.fillText("D'ATTENTE", w / 2, 110);
  }) });
  // Peinture au sol : « COMMANDEZ ICI » + flèche, et empreintes de pas
  const orderDecal = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9,
    map: canvasTex(512, 160, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,210,63,.92)';
      g.font = '900 68px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('COMMANDEZ ICI', w / 2, 112);
      // flèche vers la fenêtre du camion (haut de la texture = côté camion)
      g.beginPath(); g.moveTo(w / 2 - 34, 52); g.lineTo(w / 2 + 34, 52); g.lineTo(w / 2, 10); g.closePath(); g.fill();
    }) });
  const feetDecal = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9,
    map: canvasTex(128, 128, (g, w) => {
      g.clearRect(0, 0, w, w);
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (const x of [42, 86]) {
        g.beginPath(); g.ellipse(x, 58, 13, 26, 0, 0, Math.PI * 2); g.fill();     // semelle
        g.beginPath(); g.ellipse(x, 96, 10, 12, 0, 0, Math.PI * 2); g.fill();     // talon
      }
    }) });
  const plankLine = new THREE.BoxGeometry(0.93, 0.012, 0.01);
  const soil = new THREE.BoxGeometry(0.88, 0.02, 0.35);

  const confettiMats =['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#ffffff', '#f78c6b'].map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  const balloon = new THREE.SphereGeometry(0.22, 24, 16); balloon.scale(1, 1.18, 1);
  return {
    puff, flame, queueSign, confettiMats, orderDecal, feetDecal, plankLine, soil,
    decalPlane: new THREE.PlaneGeometry(1, 1),
    wood: M('#b07a45', { r: 0.8, cached: true }),
    woodDark: M('#6e4a2a', { r: 0.85, cached: true }),
    soilM: M('#3b2a1e', { r: 1, cached: true }),
    terracotta: M('#c4673d', { r: 0.85, cached: true }),
    leaf: [M('#4f9a48', { r: 0.9, cached: true }), M('#5e8f3a', { r: 0.9, cached: true }), M('#3f7f4a', { r: 0.9, cached: true })],
    flowers: [M('#ff7aa8', { r: 0.6, cached: true }), M('#ffd23f', { r: 0.6, cached: true }), M('#ffffff', { r: 0.6, cached: true }), M('#b48cff', { r: 0.6, cached: true })],
    confettiGeo: new THREE.PlaneGeometry(0.09, 0.055),
    post: new THREE.CylinderGeometry(0.028, 0.028, 0.9, 12),
    postBase: new THREE.CylinderGeometry(0.15, 0.17, 0.04, 20),
    postTop: new THREE.SphereGeometry(0.05, 14, 10),
    balloon,
    knot: new THREE.ConeGeometry(0.035, 0.06, 10),
    string: new THREE.CylinderGeometry(0.004, 0.004, 1, 4),
    stringM: M('#f4f4f4', { r: 0.6, cached: true }),
    chrome: M('#d8dde2', { r: 0.18, m: 1, cached: true }),
    gold: M('#d4a637', { r: 0.25, m: 1, cached: true }),
    velvet: M('#9b1b30', { r: 0.75, cached: true }),
  };
}

/* ---------- Plats ---------- */
const PROP_BUILDERS = {
  fries() {
    const g = new THREE.Group();
    add(cyl(0.11, 0.075, 0.2, M('#d62828', { r: 0.6, cached: true }), 16), 0, 0.1, 0, g);
    const fry = M('#f6c445', { r: 0.6, cached: true });
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.16, 0.022), fry);
      const a = i * 0.7;
      s.position.set(Math.cos(a) * 0.05, 0.24, Math.sin(a) * 0.05);
      s.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25);
      g.add(s);
    }
    return g;
  },
  tacos() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 20, 1, false, 0, Math.PI), M('#e9b44c', { r: 0.6, cached: true }));
    shell.rotation.set(0, 0, Math.PI / 2); shell.position.y = 0.0;
    shell.rotation.x = Math.PI / 2;
    const holder = new THREE.Group(); holder.add(shell); holder.rotation.z = Math.PI; holder.position.y = 0.14;
    g.add(holder);
    add(cyl(0.12, 0.12, 0.05, M('#5aa832', { r: 0.7, cached: true }), 14), 0, 0.16, 0, g).rotation.x = Math.PI / 2;
    add(sph(0.035, M('#d62828', { cached: true }), 8, 6), 0.05, 0.2, 0, g);
    add(sph(0.035, M('#d62828', { cached: true }), 8, 6), -0.05, 0.19, 0, g);
    return g;
  },
  hotdog() {
    const g = new THREE.Group();
    const bun = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 6, 12), M('#d99a4e', { r: 0.55, cached: true }));
    bun.rotation.z = Math.PI / 2; bun.scale.set(1, 1, 1.3); bun.position.y = 0.05; g.add(bun);
    const saus = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.26, 6, 10), M('#a8402a', { r: 0.4, cached: true }));
    saus.rotation.z = Math.PI / 2; saus.position.y = 0.09; g.add(saus);
    const mus = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.2, 4, 6), M('#f4c21d', { r: 0.4, cached: true }));
    mus.rotation.z = Math.PI / 2; mus.position.y = 0.12; g.add(mus);
    return g;
  },
  bubble() {
    const g = new THREE.Group();
    const cup = cyl(0.07, 0.055, 0.24, M('#f1e3f3', { r: 0.15, cc: true, cached: true, transparent: true, opacity: 0.85 }), 18);
    cup.position.y = 0.12; g.add(cup);
    add(cyl(0.065, 0.05, 0.16, M('#c79bd6', { r: 0.4, cached: true }), 16), 0, 0.09, 0, g);
    for (let i = 0; i < 6; i++) add(sph(0.014, M('#2a1a12', { r: 0.2, cached: true }), 8, 6), Math.cos(i) * 0.03, 0.03, Math.sin(i) * 0.03, g);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffffff', { r: 0.2, cached: true, transparent: true, opacity: 0.6 }));
    lid.position.y = 0.24; g.add(lid);
    const straw = cyl(0.01, 0.01, 0.28, M('#ef476f', { r: 0.4, cached: true }), 8);
    straw.position.set(0.02, 0.34, 0); straw.rotation.z = -0.15; g.add(straw);
    return g;
  },
};

/* ---------- Grand panneau publicitaire ---------- */
function buildBillboard(R) {
  const g = new THREE.Group();
  const steel = M('#4a4d52', { r: 0.5, m: 0.7, cached: true });
  for (const x of [-2.4, 2.4]) add(cyl(0.12, 0.14, 5.2, steel, 12), x, 2.6, 0, g);
  add(rbox(7.2, 2.9, 0.25, 0.06, steel), 0, 6.1, -0.05, g);
  const tex = canvasTex(1024, 400, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e63946'); gr.addColorStop(1, '#f4a62a');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(80 + i * 90, 360, 60, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#ffffff'; c.textAlign = 'center';
    c.font = '900 96px "Arial Black", Impact, sans-serif'; c.fillText('STREET FOOD', w / 2, 140);
    c.fillStyle = '#ffd23f'; c.fillText('EMPIRE', w / 2, 245);
    c.fillStyle = '#ffffff'; c.font = 'bold 44px "Segoe UI Emoji", "Segoe UI", sans-serif'; c.fillText('🍔 Les meilleurs burgers de la ville ! 🍟', w / 2, 330);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 2.65), M('#ffffff', { map: tex, emap: tex, emissive: '#ffffff', ei: 0.35, r: 0.6 }));
  face.position.set(0, 6.1, 0.08); g.add(face);
  // petites lampes au-dessus
  const lampM = M('#fff6c8', { emissive: '#fff1b0', ei: 3, cached: true });
  for (const x of [-2.4, 0, 2.4]) {
    add(cyl(0.03, 0.03, 0.6, steel, 8), x, 7.7, 0.3, g).rotation.x = 1.0;
    add(sph(0.1, lampM, 12, 8), x, 7.55, 0.55, g);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(5.5, 0, -11.2);
  return g;
}

/* ---------- Bonhomme gonflable ---------- */
function buildTubeMan() {
  const g = new THREE.Group();
  const body = M('#ff3b3b', { r: 0.4, cc: true, cached: true });
  const stripe = M('#ffd23f', { r: 0.4, cc: true, cached: true });
  add(rbox(0.7, 0.5, 0.7, 0.08, M('#2b2d31', { r: 0.6, m: 0.4, cached: true })), 0, 0.25, 0, g);
  const segs = [];
  let parent = g, y = 0.5;
  for (let k = 0; k < 6; k++) {
    const seg = new THREE.Group();
    seg.position.y = k === 0 ? y : 0.55;
    add(cyl(0.2, 0.22, 0.56, k % 2 ? stripe : body, 18), 0, 0.28, 0, seg);
    parent.add(seg);
    segs.push(seg);
    parent = seg;
  }
  // tête : yeux et bouche
  const head = segs[5];
  add(sph(0.2, body, 18, 12), 0, 0.56, 0, head);
  for (const s of [-1, 1]) {
    add(sph(0.06, M('#ffffff', { r: 0.3, cached: true }), 10, 8), s * 0.08, 0.6, 0.16, head);
    add(sph(0.03, M('#111', { r: 0.3, cached: true }), 8, 6), s * 0.08, 0.6, 0.21, head);
  }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group();
    add(cyl(0.07, 0.08, 1.1, stripe, 10), 0, 0.55, 0, a);
    a.position.set(s * 0.18, 0.3, 0);
    segs[3].add(a);
    return a;
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { segs, arms };
  g.position.set(2.2, 0, -5.6); // derrière le 1er camion, côté trottoir (loin des files et des tables)
  return g;
}

/* ---------- Projecteurs ---------- */
function buildSearchlights() {
  const g = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(1.4, 34, 24, 1, true);
  beamGeo.translate(0, -17, 0); beamGeo.rotateX(Math.PI); // sommet à l'origine, vers le haut
  const beamM = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  for (const [x, z] of [[-9, -6.4], [16, -6.4]]) {
    const l = new THREE.Group();
    add(cyl(0.35, 0.45, 0.5, M('#2b2d31', { r: 0.5, m: 0.6, cached: true }), 16), 0, 0.25, 0, l);
    const beam = new THREE.Group();
    add(cyl(0.3, 0.3, 0.5, M('#c9cdd2', { r: 0.3, m: 0.8, cached: true }), 16), 0, 0.2, 0, beam);
    add(new THREE.Mesh(beamGeo, beamM), 0, 0.4, 0, beam);
    beam.position.y = 0.6;
    l.add(beam);
    l.userData.beam = beam;
    l.position.set(x, 0.25, z);
    g.add(l);
  }
  return g;
}
