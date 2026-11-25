import { THREE } from './util.js';
import { Stand, SLOT_X } from './stand.js';
import { HALL, AISLE_Z, FRONT_Z, ROW2_Z } from './market.js';
import { PORT } from './port.js';
import { PROM_Z } from './fair.js';
import { fairPath, FAIR_GATE } from './fairnav.js';
import { beachPath, nearestGate } from './beach.js';
import { Customer, PEOPLE } from './people.js';
import * as E from './economy.js';
import { L } from './i18n.js';
import { randomOrder } from './kitchen.js';
import { loadSave, writeSave, clearSave } from './save.js';

const MAX_CUSTOMERS = { high: 70, low: 45 };

function defaultState() {
  return {
    money: 0,
    total: 0,
    recipes: { burger: 1 },
    up: { speed: 0, marketing: 0, queue: 0 },
    stands: SLOT_X.map((_, i) => ({ unlocked: i === 0, cooks: 1 })),
    rate: 0,
    lastSeen: Date.now(),
  };
}

/** Logique de jeu : état, clients, service, économie. */
export class Game {
  constructor(world, hooks) {
    this.world = world;
    this.hooks = hooks; // { earn(pos, amount), changed() }
    const saved = loadSave();
    this.state = Object.assign(defaultState(), saved || {});
    // champs laissés par l'essai du niveau 2 (franchise / plage) : supprimés
    for (const k of ['runTotal', 'stars', 'franchises', 'location']) delete this.state[k];
    // anciennes sauvegardes (4 camions) : on ajoute les emplacements du marché, verrouillés
    while (this.state.stands.length < SLOT_X.length) this.state.stands.push({ unlocked: false, cooks: 1 });
    // la plage (niveau 4) et la fête foraine (niveau 5) ont échangé leur place : on échange aussi leurs emplacements
    // dans les anciennes sauvegardes (18-25 : fête → 26-33 ; 26-33 : plage → 18-25), rien n'est perdu
    if (saved && !saved.levelSwap45) {
      const st = this.state.stands, oldFair = st.slice(18, 26), oldBeach = st.slice(26, 34);
      st.splice(18, 16, ...oldBeach, ...oldFair);
    }
    this.state.levelSwap45 = true;
    this.isNewPlayer = !saved;

    this.stands = SLOT_X.map((_, i) => new Stand(world.scene, i));
    this.stands.forEach((s, i) => {
      const st = this.state.stands[i];
      if (st.unlocked) s.unlock(false);
      s.setCooks(st.cooks);
    });
    this.refreshMenus();

    this.customers = [];
    PEOPLE.shadows = world.quality !== 'low';
    world.onQuality = (q) => {
      PEOPLE.shadows = q !== 'low';
      for (const c of this.customers) c.root.traverse((o) => { if (o.isMesh) o.castShadow = PEOPLE.shadows; });
    };
    this.spawnT = 0.5;
    this.boost = 0;
    this.adCooldown = { rush: 0, vip: 0, boat: 0 };
    // Arrivage du pêcheur (port) : compte à rebours avant le prochain bateau, durée restante de l'arrivage
    this.arrivalIn = 30;
    this.arrival = 0;
    this.crowd = 0; this.crowdT = 0;
    // Nuit à la fête foraine : compte à rebours avant la nuit, durée restante, et transition visuelle (0 = jour, 1 = nuit)
    this.nightIn = 60;
    this.nightLeft = 0;
    this.night = 0;
    this.nightCrowd = 0; this.nightCrowdT = 0;
    this.adCooldown.night = 0;
    // Canicule à la plage : compte à rebours, durée restante, intensité (0 → 1, pour les baigneurs)
    this.heatIn = 45;
    this.heatLeft = 0;
    this.heat = 0;
    this.heatCrowd = 0; this.heatCrowdT = 0;
    this.adCooldown.heat = 0;
    this.earnAcc = 0;
    this.rateT = 0;
    // Affluence : le nombre de clients visibles est plafonné (fluidité) ; chaque vente compte alors pour
    // la foule « réelle » qui viendrait sans plafond, pour que chaque nouveau stand augmente vraiment les revenus
    this.affluence = 1;
    this.salesAcc = 0;
    this.salesRate = 0.3;
    this.saveT = 0;
    this.time = 0;
  }

  /* ---------- Gains hors-ligne ---------- */
  offlineGain() {
    if (this.isNewPlayer) return null;
    const away = Math.min(E.OFFLINE_MAX_S, (Date.now() - this.state.lastSeen) / 1000);
    if (away < 60 || this.state.rate <= 0) return null;
    return { seconds: away, amount: Math.floor(this.state.rate * E.OFFLINE_RATIO * away) };
  }

  addMoney(n) {
    this.state.money += n;
    this.state.total += n;
    this.hooks.changed();
  }

  /* ---------- Achats ---------- */
  spend(cost) {
    if (this.state.money < cost) return false;
    this.state.money -= cost;
    return true;
  }

  buyRecipe(id) {
    const r = E.allRecipes().find((x) => x.id === id);
    const lvl = this.state.recipes[id] || 0;
    const cost = lvl === 0 ? r.unlock : E.recipeUpCost(r, lvl);
    if (!this.spend(cost)) return;
    this.state.recipes[id] = lvl + 1;
    if (lvl === 0) this.refreshMenus();
    this.save(); this.hooks.changed();
  }

  buyUpgrade(key) {
    const u = E.UPGRADES[key];
    const lvl = this.state.up[key];
    if (lvl >= u.max || !this.spend(E.upgradeCost(u, lvl))) return;
    this.state.up[key] = lvl + 1;
    this.save(); this.hooks.changed();
  }

  buyStand(i) {
    if (this.state.stands[i].unlocked || !this.spend(E.STAND_COST[i])) return false;
    this.state.stands[i].unlocked = true;
    // ouverture d'une zone (marché, port) : sa première recette est offerte
    const zone = E.zoneOf(i);
    if (i === zone.first && !this.state.recipes[zone.recipes[0].id]) {
      this.state.recipes[zone.recipes[0].id] = 1;
      this.refreshMenus();
    }
    this.stands[i].unlock(true);
    this.stands[i].setMenu(this.state.recipes);
    this.save(); this.hooks.changed();
    return true;
  }

  hireCook(i) {
    const st = this.state.stands[i];
    if (!st.unlocked || st.cooks >= E.MAX_COOKS || !this.spend(E.COOK_COST[i][st.cooks])) return;
    st.cooks += 1;
    this.stands[i].setCooks(st.cooks);
    this.save(); this.hooks.changed();
  }

  /** Prochain stand verrouillé (un seul est proposé à la fois). */
  nextLockedStand() { return this.state.stands.findIndex((s) => !s.unlocked); }

  /* ---------- Bonus des pubs récompensées ---------- */
  startRush() { this.boost = E.BOOST_SECONDS; this.adCooldown.rush = E.AD_COOLDOWN; this.hooks.changed(); }
  vipGain() { return Math.max(50, Math.floor(this.state.rate * 120)); }
  claimVip() {
    const amount = this.vipGain();
    this.addMoney(amount);
    this.adCooldown.vip = E.AD_COOLDOWN;
    this.hooks.earn(this.stands[0].counterPos(), amount);
  }

  /* ---------- Arrivage du pêcheur (port) ---------- */
  portOpen() { return !!this.state.stands[E.PORT_FIRST]?.unlocked; }
  /** Un bateau accoste : ventes du port ×3 pendant 30 s et une foule descend sur le quai. */
  startArrival() {
    this.arrival = E.ARRIVAL_SECONDS;
    this.arrivalIn = E.ARRIVAL_EVERY;
    this.crowd = E.ARRIVAL_CROWD; this.crowdT = 1.5; // le temps que le bateau accoste
    this.hooks.toast && this.hooks.toast(L('⛵ Arrivage du pêcheur ! Poisson frais : les ventes du port valent ×3 pendant 30 s, les clients accourent de la ville', '⛵ The fishing boat is in! Fresh fish: harbor sales ×3 for 30 s, customers rush in from town'));
  }
  /** Pub récompensée : faire venir un bateau tout de suite. */
  callBoat() { if (this.arrival > 0) return; this.startArrival(); this.adCooldown.boat = 90; }

  /* ---------- Nuit à la fête foraine ---------- */
  fairOpen() { return !!this.state.stands[E.FAIR_FIRST]?.unlocked; }
  /** La nuit tombe : la fête s'illumine, ses ventes valent ×3, des visiteurs arrivent de la ville. */
  startNight() {
    this.nightLeft = E.NIGHT_SECONDS;
    this.nightIn = E.DAY_SECONDS;
    this.nightCrowd = E.NIGHT_CROWD; this.nightCrowdT = 2;
    this.hooks.toast && this.hooks.toast(L('🌙 La nuit tombe : la fête foraine s\'illumine ! Ventes de la fête ×3, les visiteurs arrivent de la ville', '🌙 Night falls and the fair lights up! Fair sales ×3, visitors pour in from town'));
  }
  /** Pub récompensée : faire tomber la nuit tout de suite. */
  callNight() { if (this.nightLeft > 0) return; this.startNight(); this.adCooldown.night = 90; }

  /* ---------- Canicule à la plage ---------- */
  beachOpen() { return !!this.state.stands[E.BEACH_FIRST]?.unlocked; }
  /** Le soleil tape : les ventes de la plage valent ×3 et les baigneurs affluent. */
  startHeat() {
    this.heatLeft = E.HEAT_SECONDS;
    this.heatIn = E.HEAT_EVERY;
    this.heatCrowd = E.HEAT_CROWD; this.heatCrowdT = 1;
    this.hooks.toast && this.hooks.toast(L('☀️ Canicule ! Tout le monde file à la plage : ventes de la plage ×3, les baigneurs affluent', '☀️ Heatwave! Everyone heads to the beach: beach sales ×3, swimmers flock in'));
  }
  /** Pub récompensée : déclencher la canicule tout de suite. */
  callHeat() { if (this.heatLeft > 0) return; this.startHeat(); this.adCooldown.heat = 90; }

  refreshMenus() { this.stands.forEach((s) => s.setMenu(this.state.recipes)); }

  /* ---------- Simulation ---------- */
  update(dt) {
    this.time += dt;
    const S = this.state;
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt);
    for (const k in this.adCooldown) this.adCooldown[k] = Math.max(0, this.adCooldown[k] - dt);

    const open = this.stands.filter((s) => s.unlocked);

    // Nuit à la fête foraine
    if (this.fairOpen()) {
      if (this.nightLeft > 0) this.nightLeft = Math.max(0, this.nightLeft - dt);
      else { this.nightIn -= dt; if (this.nightIn <= 0) this.startNight(); }
      if (this.nightCrowd > 0) {
        this.nightCrowdT -= dt;
        if (this.nightCrowdT <= 0) {
          this.nightCrowdT = 0.5; this.nightCrowd -= 1;
          if (this.customers.length < MAX_CUSTOMERS[this.world.quality] + 10) this.spawn(open, { zone: 'fair' });
        }
      }
    }
    // transition douce jour ↔ nuit (environ 3 secondes)
    const nightTarget = this.nightLeft > 0 ? 1 : 0;
    this.night += (nightTarget - this.night) * Math.min(1, dt * 0.9);

    // Canicule à la plage
    if (this.beachOpen()) {
      if (this.heatLeft > 0) this.heatLeft = Math.max(0, this.heatLeft - dt);
      else { this.heatIn -= dt; if (this.heatIn <= 0) this.startHeat(); }
      if (this.heatCrowd > 0) {
        this.heatCrowdT -= dt;
        if (this.heatCrowdT <= 0) {
          this.heatCrowdT = 0.5; this.heatCrowd -= 1;
          if (this.customers.length < MAX_CUSTOMERS[this.world.quality] + 10) this.spawn(open, { zone: 'beach' });
        }
      }
    }
    this.heat += ((this.heatLeft > 0 ? 1 : 0) - this.heat) * Math.min(1, dt * 0.6);

    // Arrivage du pêcheur
    if (this.portOpen()) {
      if (this.arrival > 0) this.arrival = Math.max(0, this.arrival - dt);
      else { this.arrivalIn -= dt; if (this.arrivalIn <= 0) this.startArrival(); }
      if (this.crowd > 0) {
        this.crowdT -= dt;
        if (this.crowdT <= 0) {
          this.crowdT = 0.45; this.crowd -= 1;
          // la nouvelle de l'arrivage attire les gens de la ville : ils arrivent par l'entrée du port, côté ville
          const fromCity = new THREE.Vector3(PORT.x1 + 7 + Math.random() * 5, 0, 13 + Math.random() * 3);
          if (this.customers.length < MAX_CUSTOMERS[this.world.quality] + 10) this.spawn(open, { zone: 'port', start: fromCity });
        }
      }
    }

    // Arrivée de clients
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = E.spawnInterval(S.up.marketing, open.length) * (0.7 + Math.random() * 0.6);
      if (this.customers.length < MAX_CUSTOMERS[this.world.quality]) this.spawn(open);
    }

    // Service à chaque stand
    const cap = E.queueCap(S.up.queue);
    // animations des vendeurs : seulement pour les stands proches de ce que regarde la caméra
    const cam = this.world.controls.target, camD = this.world.camera.position.distanceTo(cam);
    const near = (this.world.quality === 'low' ? 1.1 : 1.8) * camD + 12;
    for (const stand of open) {
      stand.near = Math.hypot(stand.x - cam.x, stand.z - cam.z) < near;
      stand.update(dt, this.time);
      const front = stand.queue[0];
      if (stand.manual) {
        // cuisine : c'est le joueur qui sert ; le client au comptoir passe sa commande
        if (front && front.state === 'queue' && front.arrived && !front.order) front.order = randomOrder();
      } else if (!stand.serving && front && front.state === 'queue' && front.arrived) {
        const menu = stand.recipes.filter((r) => (S.recipes[r.id] || 0) > 0); // camion ou étal du marché
        stand.recipe = menu[Math.floor(Math.random() * menu.length)];
        stand.serving = front;
        stand.duration = stand.timer = E.serviceTime(S.up.speed, stand.cooks);
      }
      if (stand.serving && !stand.manual) {
        stand.timer -= dt;
        if (stand.timer <= 0) this.finishOrder(stand);
      }
      // si la file a rétréci (amélioration), rien à faire ; si elle déborde, les derniers partent
      while (stand.queue.length > cap + 1) this.leave(stand.queue.pop(), stand);
      stand.queue.forEach((q, i) => {
        // chaque client arrivé à sa place regarde vers le camion / la personne devant lui
        if (q.arrived && q.faceYaw === null) q.face(stand.queueYaw(i));
        // pas de dépassement : si on rattrape la personne de devant qui marche encore, on attend derrière elle
        const ahead = stand.queue[i - 1];
        q.hold = !!ahead && !q.arrived && !ahead.arrived && q.pos.distanceTo(ahead.pos) < 0.75;
      });
    }
    for (const s of this.stands) if (!s.unlocked) s.update(dt, this.time);

    // Déplacements
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.update(dt);
      if (c.state === 'approach' && c.arrived) this.joinQueue(c);
      else if (c.state === 'toSeat' && c.arrived) {
        c.state = 'eating';
        c.sit(c.seat.yaw);
        c.seat.food.visible = true;
        c.eatT = 7 + Math.random() * 7;
      } else if (c.state === 'eating') {
        c.eatT -= dt;
        if (c.eatT <= 0) this.leaveSeat(c);
      }
      if ((c.state === 'leaving' || c.state === 'passing') && c.arrived) {
        c.dispose();
        this.customers.splice(i, 1);
      }
    }

    // Revenu moyen par seconde (moyenne glissante) + sauvegarde
    this.rateT += dt;
    if (this.rateT >= 1) {
      S.rate = S.rate * 0.92 + (this.earnAcc / this.rateT) * 0.08;
      // ventes réellement faites (moyenne glissante) et demande théorique des stands ouverts
      this.salesRate = this.salesRate * 0.9 + (this.salesAcc / this.rateT) * 0.1;
      this.salesAcc = 0;
      this.affluence = this.computeAffluence(open);
      this.earnAcc = 0; this.rateT = 0;
    }
    this.saveT += dt;
    if (this.saveT > 5) { this.saveT = 0; this.save(); }
  }

  /** opts.zone : ne viser que les stands d'une zone ; opts.start : point d'apparition imposé (ex. le quai). */
  spawn(open, opts = {}) {
    const side = Math.random() < 0.5 ? -1 : 1;
    // apparaissent juste hors champ, près des stands ouverts — toujours côté ville :
    // à gauche, la ville s'arrête à l'entrée du port (au-delà, c'est le quai puis la mer)
    const leftEdge = Math.max(Math.min(...open.map((s) => s.x)) - 16, PORT.x1 + 8);
    const rightEdge = Math.max(...open.map((s) => s.x)) + 16;
    const edge = side < 0 ? leftEdge : rightEdge;
    const start = opts.start ? opts.start.clone() : new THREE.Vector3(edge, 0, 13 + Math.random() * 3);
    const c = new Customer(this.world.scene, start);
    this.customers.push(c);

    const cap = E.queueCap(this.state.up.queue);
    // le client choisit le stand le moins chargé (avec une préférence pour le plus proche de son entrée)
    let best = null;
    for (const s of open) {
      if (opts.zone && s.zone !== opts.zone) continue;
      const load = s.queue.length + s.incoming; // les clients en route comptent déjà
      if (load >= cap) continue;
      const score = load + Math.abs(s.x - start.x) * 0.02;
      if (!best || score < best.score) best = { s, score };
    }
    if (!best) {
      // toutes les files sont pleines : il passe son chemin
      c.state = 'passing';
      c.go(new THREE.Vector3(-side * 36, 0, start.z + 1));
      return;
    }
    // Le client marche jusqu'au bout du chemin marqué. Sa place dans la file ne lui est attribuée
    // qu'en y arrivant : premier arrivé, premier servi (personne ne double personne).
    const stand = best.s;
    stand.incoming += 1;
    c.state = 'approach';
    c.stand = stand;
    c.entryIdx = cap;
    const entrance = stand.queuePos(cap);
    const approach = entrance.clone().addScaledVector(stand.queueBack(cap), 2.5).add(stand.dirWorld(0, 1.0));
    // marché : on rejoint d'abord l'allée (rangée du fond) ou la promenade devant la halle (rangée de devant)
    const lane = this.laneZ(stand);
    // (depuis le quai ou la rangée de devant : on rejoint d'abord le couloir en ligne droite, puis on le suit)
    // (rangée de devant, fête foraine, ou départ imposé : on rejoint d'abord le couloir en ligne droite, puis on le suit)
    if (stand.zone === 'fair') {
      // fête foraine : par la promenade jusqu'à l'arche, puis on se faufile entre les stands et les manèges
      const ax = this.gateX();
      c.go(new THREE.Vector3(start.x, 0, lane), new THREE.Vector3(ax, 0, lane), new THREE.Vector3(ax, 0, FAIR_GATE.z), ...fairPath(FAIR_GATE, approach), entrance);
      return;
    }
    if (stand.zone === 'beach') {
      // plage : par la promenade, on descend sur les planches entre deux palmiers, puis on traverse le sable
      const g = nearestGate(approach), gx = g.x + (Math.random() - 0.5) * 1.6;
      c.go(new THREE.Vector3(start.x, 0, lane), new THREE.Vector3(gx, 0, lane), new THREE.Vector3(gx, 0, g.z), ...beachPath(g, approach), entrance);
      return;
    }
    const via = stand.kind !== 'stall' ? []
      : stand.row === 1 || opts.start ? [new THREE.Vector3(start.x, 0, lane), new THREE.Vector3(approach.x, 0, lane)]
        : [new THREE.Vector3(approach.x, 0, lane)];
    c.go(...via, approach, entrance);
  }

  /**
   * « Couloir » où circulent les clients d'un stand pour arriver et repartir (z) :
   * parking devant les camions, allée entre les deux rangées, ou promenade devant la rangée de devant.
   * (Marché et port : allée à z ≈ 14,4, promenade à z ≈ 33 ; fête foraine : pareil, décalé de 42.)
   */
  laneZ(stand) {
    if (stand.zone === 'fair' || stand.zone === 'beach') return PROM_Z + (Math.random() - 0.5) * 1.0; // promenade devant le marché
    if (stand.kind !== 'stall') return 13.5 + Math.random() * 2.5;
    if (stand.row === 1) return stand.z + (FRONT_Z - ROW2_Z) + Math.random() * 1.5;
    return stand.z + AISLE_Z + (Math.random() - 0.5) * 1.2;
  }

  /** Après le passage par le couloir du stand : sortie de l'écran par un côté. */
  exitVia(stand, x, lane) {
    const side = Math.random() < 0.5 ? -1 : 1;
    if (stand.zone === 'port') {
      // au port, on repart toujours vers la ville (jamais vers le bout du quai et la mer)
      // (par le couloir du parking : devant le port, c'est maintenant la plage)
      const gate = PORT.x1 + 6 + Math.random() * 3, pz = 13.5 + Math.random() * 2.5;
      return [new THREE.Vector3(gate, 0, lane), new THREE.Vector3(gate + 2, 0, pz), new THREE.Vector3(gate + 32, 0, pz)];
    }
    if (stand.zone === 'fair') {
      // fête foraine (après fairExit) : on ressort par l'arche et on rentre en ville par la promenade
      const ax = this.gateX();
      return [new THREE.Vector3(ax, 0, FAIR_GATE.z), new THREE.Vector3(ax, 0, lane), new THREE.Vector3(side < 0 ? -10 : 100, 0, lane)];
    }
    if (stand.zone === 'beach') {
      // plage (après zoneExit) : on remonte sur la promenade, puis on rentre en ville (vers le parking ou vers la fête)
      const gx = x + (Math.random() - 0.5) * 1.6;
      return side < 0 ? [new THREE.Vector3(gx, 0, lane), new THREE.Vector3(-34, 0, lane), new THREE.Vector3(-34, 0, 10)]
        : [new THREE.Vector3(gx, 0, lane), new THREE.Vector3(100, 0, lane)];
    }
    if (stand.kind === 'stall' && stand.row === 0) {
      // on remonte l'allée jusqu'au bout de la halle, puis on s'en va
      const B = HALL;
      const ex = side < 0 ? B.x0 - 4 : B.x1 + 4;
      return [new THREE.Vector3(ex, 0, lane), new THREE.Vector3(ex + side * 22, 0, lane + 1)];
    }
    return [new THREE.Vector3(x + side * 26, 0, lane + 1)];
  }

  /** Passage sous l'arche de la fête (un peu de variété pour ne pas marcher en file indienne). */
  gateX() { return FAIR_GATE.x + (Math.random() - 0.5) * 3; }
  /** Fête foraine : trajet d'un point jusqu'à l'arche (en contournant tout), puis retour en ville. */
  /** Fête foraine et plage : trajet d'un point jusqu'à la sortie (en contournant tout), puis retour en ville. */
  zoneExit(stand, from, lane) {
    if (stand.zone === 'beach') { const g = nearestGate(from); return [...beachPath(from, g), ...this.exitVia(stand, g.x, lane)]; }
    return [...fairPath(from, FAIR_GATE), ...this.exitVia(stand, from.x, lane)];
  }

  /** Le client atteint le bout de la file : il prend la dernière place et remonte le chemin. */
  joinQueue(c) {
    const stand = c.stand;
    stand.incoming -= 1;
    c.state = 'queue';
    stand.queue.push(c);
    c.lastIdx = c.entryIdx; // il est au bout du chemin (tel qu'il était quand il est parti)
    c.go(...this.queueRoute(c, stand, stand.queue.length - 1));
  }

  /**
   * Chemin le long de la file, de la dernière place atteinte par le client jusqu'à la place « target ».
   * Chaque point porte son numéro de place (qi) pour savoir où en est le client.
   */
  queueRoute(c, stand, target) {
    const pts = [];
    const tag = (j) => { const v = stand.queuePos(j); v.qi = j; return v; };
    if (c.lastIdx <= target) pts.push(tag(target));
    else for (let j = Math.min(c.lastIdx - 1, E.queueCap(this.state.up.queue)); j >= target; j--) pts.push(tag(j));
    return pts;
  }

  /**
   * Affluence (≥ 1) : clients « théoriques » par seconde / ventes réellement faites.
   * Chaque stand attire 1 / (3,2 × 0,9^publicité) clients par seconde, dans la limite de ce qu'il sait servir
   * (vitesse de cuisson × équipe). Tant que le plafond de clients visibles n'est pas atteint, l'affluence reste à 1.
   */
  computeAffluence(open) {
    const S = this.state;
    const demand = 1 / (3.2 * 0.9 ** S.up.marketing);
    let theo = 0;
    for (const s of open) theo += Math.min(demand, 1 / E.serviceTime(S.up.speed, s.cooks));
    const target = Math.max(1, theo / Math.max(0.3, this.salesRate));
    return this.affluence + (Math.min(target, 400) - this.affluence) * 0.15; // évolue en douceur
  }

  /**
   * Cuisine : prix d'un hot-dog fait à la main (q = qualité 0 → 1).
   * Base : 4 × la meilleure recette des camions, puis affluence et bonus Rush, comme une vente normale.
   */
  manualPrice(q) {
    const best = Math.max(...E.RECIPES.filter((r) => (this.state.recipes[r.id] || 0) > 0).map((r) => E.recipePrice(r, this.state.recipes[r.id])));
    return best * 4 * (0.25 + 0.75 * q) * this.affluence * (this.boost > 0 ? 2 : 1);
  }

  /** Cuisine : le joueur sert le client au comptoir. */
  serveManual(stand, q) {
    const c = stand.queue[0];
    if (!c) return 0;
    stand.serving = c;
    const amount = this.manualPrice(q);
    this.finishOrder(stand, amount);
    return amount;
  }

  finishOrder(stand, manualAmount) {
    const c = stand.serving;
    this.salesAcc += 1;
    if (manualAmount !== undefined) {
      c.order = null;
      this.addMoney(manualAmount);
      this.earnAcc += manualAmount;
      this.hooks.earn(c.headPos(), manualAmount, '🌭');
      this.afterOrder(stand, c);
      return;
    }
    const lvl = this.state.recipes[stand.recipe.id];
    const amount = E.recipePrice(stand.recipe, lvl)
      * this.affluence
      * (this.boost > 0 ? 2 : 1)
      * (stand.zone === 'port' && this.arrival > 0 ? E.ARRIVAL_MULT : 1) // arrivage du pêcheur
      * (stand.zone === 'fair' && this.nightLeft > 0 ? E.NIGHT_MULT : 1) // nuit à la fête foraine
      * (stand.zone === 'beach' && this.heatLeft > 0 ? E.HEAT_MULT : 1); // canicule à la plage
    this.addMoney(amount);
    this.earnAcc += amount;
    this.hooks.earn(c.headPos(), amount, stand.recipe.emoji);
    this.afterOrder(stand, c);
  }

  /** Après une vente : le client va s'asseoir ou repart, la file avance. */
  afterOrder(stand, c) {
    stand.serving = null;
    stand.queue.shift();
    // une partie des clients s'installe à une table pour manger, les autres repartent avec leur plat
    const seat = Math.random() < 0.65 ? stand.freeSeat() : null;
    if (seat) this.goSit(c, stand, seat);
    else this.leave(c, stand, true);
    // tout le monde avance d'une place, en suivant le chemin de la file
    stand.queue.forEach((q, i) => {
      if (q.state !== 'queue') return;
      const approach = q.path.filter((p) => p.qi === undefined); // point d'approche pas encore atteint
      q.go(...approach, ...this.queueRoute(q, stand, i));
    });
  }

  goSit(c, stand, seat) {
    seat.taken = c;
    c.seat = seat;
    c.state = 'toSeat';
    const p = c.pos;
    c.go(p.clone().add(stand.dirWorld(1.5, 0.9)), stand.toWorld(3.6, 3.6), seat.behind, seat.pos);
    c.stand = stand;
  }

  /** Le client a fini de manger : il se lève, libère la chaise et s'en va. */
  leaveSeat(c) {
    const seat = c.seat;
    c.standUp();
    seat.food.visible = false;
    seat.taken = null;
    c.seat = null;
    c.state = 'leaving';
    const lane = this.laneZ(c.stand);
    if (c.stand.zone === 'fair' || c.stand.zone === 'beach') {
      // on se faufile jusqu'à la sortie (arche de la fête, planches de la plage)
      c.go(seat.behind, seat.out, ...this.zoneExit(c.stand, seat.out, lane));
      return;
    }
    c.go(seat.behind, seat.out, new THREE.Vector3(seat.pos.x - 1.3, 0, lane), ...this.exitVia(c.stand, seat.pos.x, lane));
  }

  /** served = client qui vient d'être servi (part vers l'avant du camion) ; sinon il quitte le bout de la file. */
  leave(c, stand, served = false) {
    if (!c) return;
    if (stand.serving === c) stand.serving = null;
    c.state = 'leaving';
    const p = c.pos;
    const lane = this.laneZ(stand); // parking, allée du marché ou promenade devant la halle
    if (stand.zone === 'fair' || stand.zone === 'beach') {
      // fête, plage : on s'écarte du comptoir (ou du bout de la file), on rejoint la grande allée et on remonte vers l'arche
      const a = served ? p.clone().add(stand.dirWorld(1.5, 0.9)) : p.clone().addScaledVector(stand.queueBack(Math.max(0, stand.queue.length)), 1.5);
      c.go(a, ...this.zoneExit(stand, a, lane));
      return;
    }
    if (served) {
      // s'écarte vers l'avant du comptoir, rejoint son couloir, puis sort par un côté
      c.go(new THREE.Vector3(p.x + 1.5, 0, p.z + 0.9), new THREE.Vector3(p.x + 2.0, 0, lane), ...this.exitVia(stand, p.x, lane));
    } else {
      const back = stand.queueBack(Math.max(0, stand.queue.length));
      c.go(p.clone().addScaledVector(back, 1.5), new THREE.Vector3(p.x + 3, 0, lane), ...this.exitVia(stand, p.x, lane));
    }
  }

  save() {
    if (this.resetting) return; // ne jamais réécrire l'ancienne partie pendant une remise à zéro
    this.state.lastSeen = Date.now();
    writeSave(this.state);
  }

  reset() {
    this.resetting = true;
    clearSave();
    location.reload();
  }
}
