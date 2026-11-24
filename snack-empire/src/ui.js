import { fmt, fmtDuration } from './util.js';
import * as E from './economy.js';
import { ads } from './ads.js';
import { audio } from './audio.js';
import { THREE } from './util.js';
import { HALL, hallFront } from './market.js';
import { PORT, SHOP_TYPES } from './port.js';
import { FAIR, FAIR_TYPES, WHEEL } from './fair.js';
import { STALL_TYPES } from './market.js';
import { BEACH, BEACH_TYPES } from './beach.js';

const $ = (sel) => document.querySelector(sel);
/** Pastille d'événement : texte complet (ordinateur) et version courte (téléphone). */
function setPill(el, long, short) {
  const html = `<span class="l">${long}</span><span class="s">${short}</span>`;
  if (el.innerHTML !== html) el.innerHTML = html;
}
const ZONE_KEY = 'street-food-empire-zone';
const SHOP_KEY = 'street-food-empire-shop-collapsed';
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** Interface HTML par-dessus la scène 3D. */
export class UI {
  constructor(world) {
    this.world = world;
    this.floats = [];
    this.tab = 'recipes';
    this.cards = new Map();
    this.layer = $('#overlay');
    // zone affichée (niveau) : retenue d'une visite à l'autre, sur cet appareil seulement
    this.zone = 'parking';
    try { const z = localStorage.getItem(ZONE_KEY); if (E.zoneById(z)) this.zone = z; } catch { /* stockage indisponible */ }
  }

  /* ---------- Zones (niveaux) ---------- */
  zoneOpen(id) { return !!this.game.state.stands[E.zoneById(id).first]?.unlocked; }
  marketOpen() { return this.zoneOpen('market'); }
  /** Index des emplacements d'une zone. */
  zoneStands(id) {
    const z = E.zoneById(id);
    return Array.from({ length: z.count }, (_, k) => z.first + k);
  }

  /**
   * Affiche une zone : la caméra glisse dessus et la boutique montre ses recettes et ses stands.
   * frame = false : la caméra y est déjà (le joueur s'y est rendu lui-même), on ne la recadre pas.
   */
  setZone(zone, animate = true, frame = true) {
    const g = this.game;
    const Z = E.zoneById(zone);
    if (!this.zoneOpen(zone)) {
      const prev = E.ZONES[E.ZONES.indexOf(Z) - 1];
      const prevDone = this.zoneStands(prev.id).every((i) => g.state.stands[i].unlocked);
      const label = { market: 'le marché', port: 'le port', fair: 'la fête foraine', beach: 'la plage' }[zone];
      const need = { market: 'les 4 camions', port: 'les 6 étals du marché', beach: 'les 8 boutiques du port', fair: 'les 8 paillotes de la plage' }[zone];
      this.toast(prevDone
        ? `🔒 ${label[0].toUpperCase() + label.slice(1)} s'achète sur son emplacement : ${fmt(E.STAND_COST[Z.first])} $`
        : `🔒 Ouvre d'abord ${need} pour débloquer ${label}`);
      if (!prevDone) return;
      // montrer l'emplacement à acheter
      const s = g.stands[Z.first];
      this.world.frameBox(new THREE.Vector3(s.x - 8, 0, s.z - 4), new THREE.Vector3(s.x + 8, 4, s.z + 8), animate, 1);
      return;
    }
    this.zone = zone;
    try { localStorage.setItem(ZONE_KEY, zone); } catch { /* rien */ }
    const next = g.nextLockedStand();
    if (!frame) {
      // pas de recadrage : on garde la vue choisie par le joueur
    } else if (zone === 'market') {
      // toute la halle (qui s'élargit vers l'avant avec la 2e rangée), toit compris,
      // + l'emplacement du prochain étal s'il est devant
      const stalls = this.zoneStands('market').filter((i) => g.stands[i].unlocked);
      let front = hallFront(stalls.some((i) => g.stands[i].row === 1));
      if (E.zoneOf(next)?.id === 'market') front = Math.max(front, g.stands[next].z + 4);
      this.world.frameBox(new THREE.Vector3(HALL.x0, 0, HALL.z0), new THREE.Vector3(HALL.x1, HALL.peak, front), animate, 3);
    } else if (zone === 'fair') {
      // toute la fête : stands, carrousel (à gauche) et grande roue (à droite)
      // toute la fête, de l'arche jusqu'à la grande roue au bout du ponton
      this.world.frameBox(new THREE.Vector3(FAIR.x0, 0, FAIR.z0 - 2), new THREE.Vector3(FAIR.x1, 6, WHEEL.z + 4), animate, 3);
    } else if (zone === 'beach') {
      // toute la plage, des planches jusqu'aux parasols au bord de l'eau
      this.world.frameBox(new THREE.Vector3(BEACH.x0, 0, BEACH.z0), new THREE.Vector3(BEACH.x1, 5, 100), animate, 3);
    } else if (zone === 'port') {
      // le quai, les boutiques ouvertes (+ la prochaine) et le bord de l'eau
      const open = this.zoneStands('port').filter((i) => g.stands[i].unlocked || i === next);
      const front = Math.max(...open.map((i) => g.stands[i].z)) + 9;
      // (avec le bassin, ses pontons et la criée à gauche)
      this.world.frameBox(new THREE.Vector3(PORT.deckX0 + 2, 0, PORT.quayZ - 18), new THREE.Vector3(PORT.x1, 4, front), animate, 3);
    } else {
      this.world.frameStands(this.zoneStands('parking').filter((i) => g.stands[i].unlocked).map((i) => g.stands[i].x), animate);
    }
    document.querySelectorAll('#zones button').forEach((b) => b.classList.toggle('on', b.dataset.zone === zone));
    $('[data-tab=recipes]').innerHTML = { parking: '🍔 Recettes', market: '🥐 Recettes', port: '🐟 Recettes', fair: '🍭 Recettes', beach: '🍦 Recettes' }[zone];
    $('[data-tab=stands]').innerHTML = { parking: '🚚 Stands', market: '🧺 Étals', port: '⚓ Boutiques', fair: '🎪 Stands', beach: '🛖 Paillotes' }[zone];
    this.rebuildShop();
  }

  bind(game, quality) {
    this.game = game;
    this.quality = quality;
    document.querySelectorAll('#quality-seg button').forEach((b) => b.addEventListener('click', () => {
      quality.setPref(b.dataset.q);
      this.refreshQuality();
    }));

    // Bulles de commande + étiquettes des emplacements
    this.bubbles = game.stands.map(() => {
      const b = el('div', 'order', '<span class="emoji"></span><div class="bar"><i></i></div>');
      this.layer.appendChild(b);
      return b;
    });
    this.plotBtns = game.stands.map((s, i) => {
      const b = el('button', 'plot-btn');
      b.addEventListener('click', () => this.buyStand(i));
      this.layer.appendChild(b);
      return b;
    });

    // Onglets
    // Onglets de la boutique : un clic sur l'onglet déjà ouvert replie la liste, un autre clic la rouvre
    document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
      const shop = $('#shop');
      if (b.dataset.tab === this.tab) {
        shop.classList.toggle('collapsed');
      } else this.selectTab(b.dataset.tab);
      try { localStorage.setItem(SHOP_KEY, shop.classList.contains('collapsed') ? '1' : '0'); } catch { /* rien */ }
    }));
    try { if (localStorage.getItem(SHOP_KEY) === '1') $('#shop').classList.add('collapsed'); } catch { /* rien */ }
    $('#shop-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn || btn.disabled) return;
      const [act, arg] = btn.dataset.act.split(':');
      if (act === 'recipe') game.buyRecipe(arg);
      if (act === 'up') game.buyUpgrade(arg);
      if (act === 'cook') game.hireCook(+arg);
      if (act === 'stand') this.buyStand(+arg);
      this.refresh();
    });
    $('#shop-toggle').addEventListener('click', () => {
      document.body.classList.toggle('shop-open'); document.body.classList.remove('ads-open');
      $('#shop').classList.remove('collapsed'); // sur téléphone, la boutique s'ouvre toujours dépliée
    });
    // téléphone : les pubs sont rangées derrière un seul bouton « 📺 Bonus »
    $('#ad-toggle').addEventListener('click', () => { document.body.classList.toggle('ads-open'); document.body.classList.remove('shop-open'); });
    document.querySelectorAll('#ad-bar button:not(#ad-toggle)').forEach((b) => b.addEventListener('click', () => document.body.classList.remove('ads-open')));

    // Pubs récompensées
    $('#ad-rush').addEventListener('click', async () => {
      if (game.adCooldown.rush > 0 || game.boost > 0) return;
      if (await ads.rewarded()) game.startRush();
    });
    $('#ad-vip').addEventListener('click', async () => {
      if (game.adCooldown.vip > 0) return;
      if (await ads.rewarded()) game.claimVip();
    });
    $('#ad-night').addEventListener('click', async () => {
      if (game.adCooldown.night > 0 || game.nightLeft > 0) return;
      if (await ads.rewarded()) { game.callNight(); this.setZone('fair'); }
    });
    $('#ad-heat').addEventListener('click', async () => {
      if (game.adCooldown.heat > 0 || game.heatLeft > 0) return;
      if (await ads.rewarded()) { game.callHeat(); this.setZone('beach'); }
    });
    $('#ad-boat').addEventListener('click', async () => {
      if (game.adCooldown.boat > 0 || game.arrival > 0) return;
      if (await ads.rewarded()) { game.callBoat(); this.setZone('port'); }
    });

    // Son : effets / musique (réglages) et bouton « couper le son »
    const refreshSound = () => {
      document.querySelectorAll('#sound-seg button').forEach((b) => b.classList.toggle('on', b.dataset.s === 'sfx' ? audio.sfxOn : audio.musicOn));
      $('#mute-btn').textContent = audio.sfxOn || audio.musicOn ? '🔊' : '🔇';
    };
    document.querySelectorAll('#sound-seg button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.s === 'sfx') audio.setSfx(!audio.sfxOn); else audio.setMusic(!audio.musicOn);
      refreshSound();
    }));
    $('#mute-btn').addEventListener('click', () => {
      const on = !(audio.sfxOn || audio.musicOn);
      audio.setSfx(on); audio.setMusic(on); refreshSound();
    });
    refreshSound();

    // Réglages
    $('#settings-btn').addEventListener('click', () => { $('#settings').classList.toggle('show'); this.refreshQuality(); });
    // Pas de confirm() natif : il est bloqué dans les iframes des portails de jeux.
    $('#reset-btn').addEventListener('click', async () => {
      $('#settings').classList.remove('show');
      const ok = await this.ask('Recommencer à zéro ?', 'Toute ta progression (argent, recettes, stands) sera effacée. Impossible de revenir en arrière.', 'Tout effacer', 'Annuler');
      if (ok) game.reset();
    });

    // Onglets de zone à gauche
    document.querySelectorAll('#zones button').forEach((b) => b.addEventListener('click', () => this.setZone(b.dataset.zone)));
    if (!this.zoneOpen(this.zone)) this.zone = 'parking';
    this.setZone(this.zone, false);
    this.refresh();
  }

  refreshQuality() {
    const q = this.quality;
    document.querySelectorAll('#quality-seg button').forEach((b) => b.classList.toggle('on', b.dataset.q === q.pref));
    const cur = this.world.quality === 'low' ? 'basse' : 'haute';
    $('#quality-note').textContent = q.pref === 'auto'
      ? (q.measured === null ? `Mesure en cours… (actuellement : ${cur})` : `${Math.round(q.measured)} i/s mesurées → qualité ${cur}`)
      : `Qualité ${cur}`;
  }

  async buyStand(i) {
    if (this.game.buyStand(i)) {
      const zone = E.zoneOf(i).id;
      this.toast(
        i === E.MARKET_FIRST ? '🏛️ Niveau 2 : le marché couvert ouvre ses portes ! (onglet « Marché » à gauche)'
          : i === E.PORT_FIRST ? '⚓ Niveau 3 : bienvenue au port ! Guette l\'arrivage du pêcheur ⛵'
            : i === E.BEACH_FIRST ? '🏖️ Niveau 4 : la plage ouvre ! Guette la canicule ☀️'
            : i === E.FAIR_FIRST ? '🎡 Niveau 5 : la fête foraine ouvre ! Attends la nuit 🌙'
              : zone === 'market' ? '🧺 Nouvel étal ouvert !'
                : zone === 'port' ? '⚓ Nouvelle boutique ouverte !'
                  : zone === 'fair' ? '🎪 Nouveau stand forain !'
                  : zone === 'beach' ? '🛖 Nouvelle paillote sur la plage !'
                    : '🎉 Nouveau stand ouvert !');
      this.setZone(zone);
      // laisser le joueur admirer son nouveau camion avant la pub
      await new Promise((r) => setTimeout(r, 2200));
      await ads.midgame();
    }
  }

  /* ---------- Boutique ---------- */
  shopModel() {
    const g = this.game, S = g.state, money = S.money, out = [];
    if (this.tab === 'recipes') {
      let lockedShown = false;
      for (const r of E.zoneById(this.zone).recipes) {
        const lvl = S.recipes[r.id] || 0;
        if (lvl === 0) {
          if (lockedShown) continue; // une seule recette verrouillée visible à la fois
          lockedShown = true;
          out.push({ id: 'r-' + r.id, emoji: r.emoji, title: `${r.name}`, sub: `Nouvelle recette · ${fmt(E.recipePrice(r, 1))} $ la vente`, label: `Débloquer<br>${fmt(r.unlock)} $`, cost: r.unlock, act: 'recipe:' + r.id, locked: true });
        } else {
          const cost = E.recipeUpCost(r, lvl);
          const next = (lvl + 1) % 10 === 0 ? ' · prochain niv. ×2 !' : '';
          out.push({ id: 'r-' + r.id, emoji: r.emoji, title: `${r.name} <b>niv. ${lvl}</b>`, sub: `${fmt(E.recipePrice(r, lvl))} $ → ${fmt(E.recipePrice(r, lvl + 1))} $${next}`, label: `${fmt(cost)} $`, cost, act: 'recipe:' + r.id });
        }
      }
    } else if (this.tab === 'upgrades') {
      const subs = {
        speed: (l) => `Préparation : ${E.prepTime(l).toFixed(2).replace('.', ',')} s`,
        marketing: (l) => `Un client toutes les ${E.spawnInterval(l, 1).toFixed(2).replace('.', ',')} s`,
        queue: (l) => `File d'attente : ${E.queueCap(l)} places`,
      };
      for (const [k, u] of Object.entries(E.UPGRADES)) {
        const lvl = S.up[k], max = lvl >= u.max, cost = E.upgradeCost(u, lvl);
        out.push({ id: 'u-' + k, emoji: u.emoji, title: `${u.name} <b>niv. ${lvl}</b>`, sub: subs[k](lvl), label: max ? 'MAX' : `${fmt(cost)} $`, cost: max ? Infinity : cost, act: 'up:' + k });
      }
    } else {
      const inZone = (i) => E.zoneOf(i).id === this.zone;
      const nameOf = (i) => {
        const z = E.zoneOf(i).id;
        if (z === 'market') return STALL_TYPES[i - E.MARKET_FIRST].name.toLowerCase().replace(/^./, (c) => c.toUpperCase());
        if (z === 'port') return SHOP_TYPES[i - E.PORT_FIRST].name.toLowerCase().replace(/^./, (c) => c.toUpperCase());
        if (z === 'fair') return FAIR_TYPES[i - E.FAIR_FIRST].name.toLowerCase().replace(/^./, (c) => c.toUpperCase());
        if (z === 'beach') return 'Paillote ' + BEACH_TYPES[i - E.BEACH_FIRST].name.toLowerCase();
        return `Stand n°${i + 1}`;
      };
      S.stands.forEach((st, i) => {
        if (st.unlocked && inZone(i)) {
          const z = E.zoneOf(i).id;
          const max = st.cooks >= E.MAX_COOKS, cost = max ? Infinity : E.COOK_COST[i][st.cooks];
          const who = z === 'parking' ? 'cuisiniers' : 'vendeurs';
          out.push({ id: 's-' + i, emoji: { parking: '👨‍🍳', market: '🧑‍🌾', port: '🧑‍✈️', fair: '🤹', beach: '🏄' }[z], title: `${nameOf(i)} <b>${st.cooks}/${E.MAX_COOKS} ${who}</b>`, sub: max ? 'Équipe complète' : `Service ×${E.COOK_FACTOR[st.cooks]} plus rapide`, label: max ? 'MAX' : `Embaucher<br>${fmt(cost)} $`, cost, act: 'cook:' + i });
        }
      });
      const n = g.nextLockedStand();
      // prochain emplacement à acheter : affiché dans sa zone ; l'ouverture de la zone suivante se voit aussi
      // depuis la zone précédente (le marché depuis les camions, le port depuis le marché)
      const nz = n >= 0 ? E.zoneOf(n) : null;
      const opensNext = nz && n === nz.first && E.ZONES[E.ZONES.indexOf(nz) - 1]?.id === this.zone;
      if (n >= 0 && (inZone(n) || opensNext)) {
        const cost = E.STAND_COST[n];
        const card = n === E.MARKET_FIRST ? { emoji: '🏛️', title: 'Marché couvert <b>niveau 2</b>', sub: 'Nouvelle zone : 6 étals + 7 nouvelles recettes' }
          : n === E.PORT_FIRST ? { emoji: '⚓', title: 'Le port <b>niveau 3</b>', sub: 'Nouvelle zone : 8 boutiques, 9 recettes, arrivages ×3' }
            : n === E.BEACH_FIRST ? { emoji: '🏖️', title: 'La plage <b>niveau 4</b>', sub: 'Nouvelle zone : 8 paillotes, 8 recettes, canicules ×3' }
            : n === E.FAIR_FIRST ? { emoji: '🎡', title: 'Fête foraine <b>niveau 5</b>', sub: 'Nouvelle zone : 8 stands, 8 recettes, nuits ×3' }
              : nz.id === 'market' ? { emoji: '🧺', title: nameOf(n), sub: 'Un nouvel étal dans le marché' }
                : nz.id === 'port' ? { emoji: '⚓', title: nameOf(n), sub: 'Une nouvelle boutique sur le quai' }
                  : nz.id === 'fair' ? { emoji: '🎪', title: nameOf(n), sub: 'Un nouveau stand à la fête' }
                  : nz.id === 'beach' ? { emoji: '🛖', title: nameOf(n), sub: 'Une nouvelle paillote sur la plage' }
                    : { emoji: '🚚', title: nameOf(n), sub: 'Une nouvelle file de clients' };
        out.push({ id: 'n-' + n, ...card, label: `Ouvrir<br>${fmt(cost)} $`, cost, act: 'stand:' + n, locked: true });
      }
    }
    for (const c of out) c.disabled = c.cost > money;
    return out;
  }

  rebuildShop() {
    const list = $('#shop-list');
    list.innerHTML = '';
    this.cards.clear();
    for (const c of this.shopModel()) {
      const card = el('div', 'card' + (c.locked ? ' locked' : ''),
        `<div class="ic">${c.emoji}</div><div class="t"><div class="tt"></div><small></small></div><button data-act="${c.act}"></button>`);
      list.appendChild(card);
      this.cards.set(c.id, card);
    }
    this.shopKey = '';
    this.updateShop(true);
  }

  updateShop(force) {
    const model = this.shopModel();
    const key = model.map((c) => c.id).join('|');
    if (!force && key !== [...this.cards.keys()].join('|')) { this.rebuildShop(); return; }
    for (const c of model) {
      const card = this.cards.get(c.id);
      if (!card) continue;
      const tt = card.querySelector('.tt'), sm = card.querySelector('small'), b = card.querySelector('button');
      if (tt.innerHTML !== c.title) tt.innerHTML = c.title;
      if (sm.innerHTML !== c.sub) sm.innerHTML = c.sub;
      if (b.innerHTML !== c.label) b.innerHTML = c.label;
      b.disabled = c.disabled;
    }
    // pastille « achat possible » sur les onglets
    const S = this.game.state;
    const canBuy = (list) => list.some((r) => { const l = S.recipes[r.id] || 0; return S.money >= (l ? E.recipeUpCost(r, l) : r.unlock) && (l || r === list.find((x) => !(S.recipes[x.id] > 0))); });
    const canRecipe = canBuy(E.zoneById(this.zone).recipes);
    // pastilles sur les onglets de zone : « il y a quelque chose à acheter là-bas »
    const canStaff = (lo, hi) => S.stands.some((st, i) => i >= lo && i < hi && st.unlocked && st.cooks < E.MAX_COOKS && S.money >= E.COOK_COST[i][st.cooks]);
    const nl = this.game.nextLockedStand();
    const zoneCan = {};
    E.ZONES.forEach((Z, k) => {
      const open = this.zoneOpen(Z.id);
      const nextIn = nl >= 0 && E.zoneOf(nl) === Z && S.money >= E.STAND_COST[nl];
      const opensNext = nl >= 0 && E.ZONES[k + 1] && nl === E.ZONES[k + 1].first && S.money >= E.STAND_COST[nl];
      zoneCan[Z.id] = open && (canBuy(Z.recipes) || canStaff(Z.first, Z.first + Z.count) || nextIn || opensNext);
    });
    document.querySelectorAll('#zones button').forEach((b) => {
      const z = b.dataset.zone;
      b.classList.toggle('locked', !this.zoneOpen(z));
      b.classList.toggle('dot', z !== this.zone && zoneCan[z]);
    });
    const canUp = Object.entries(E.UPGRADES).some(([k, u]) => S.up[k] < u.max && S.money >= E.upgradeCost(u, S.up[k]));
    const Zc = E.zoneById(this.zone), kc = E.ZONES.indexOf(Zc);
    const canStand = canStaff(Zc.first, Zc.first + Zc.count)
      || (nl >= 0 && (E.zoneOf(nl) === Zc || (E.ZONES[kc + 1] && nl === E.ZONES[kc + 1].first)) && S.money >= E.STAND_COST[nl]);
    document.querySelector('[data-tab=recipes]').classList.toggle('dot', canRecipe);
    document.querySelector('[data-tab=upgrades]').classList.toggle('dot', canUp);
    document.querySelector('[data-tab=stands]').classList.toggle('dot', canStand);
  }

  /* ---------- HUD (10 fois par seconde) ---------- */
  refresh() {
    const g = this.game, S = g.state;
    $('#money').textContent = fmt(S.money);
    $('#rate').textContent = `+${fmt(S.rate)} $/s`;
    const rush = $('#ad-rush');
    if (g.boost > 0) { rush.disabled = true; rush.innerHTML = `🔥 Coup de feu ×2 · ${fmtDuration(g.boost)}`; rush.classList.add('active'); }
    else { rush.classList.remove('active'); rush.disabled = g.adCooldown.rush > 0; rush.innerHTML = g.adCooldown.rush > 0 ? `📺 Coup de feu · ${Math.ceil(g.adCooldown.rush)} s` : '📺 Coup de feu ×2 (3 min)'; }
    const vip = $('#ad-vip');
    vip.disabled = g.adCooldown.vip > 0;
    vip.innerHTML = g.adCooldown.vip > 0 ? `📺 Livraison VIP · ${Math.ceil(g.adCooldown.vip)} s` : `📺 Livraison VIP +${fmt(g.vipGain())} $`;
    $('#boost-badge').classList.toggle('show', g.boost > 0);
    // pastille sur « 📺 Bonus » quand une pub est disponible
    $('#ad-toggle').classList.toggle('dot', [...document.querySelectorAll('#ad-bar button:not(#ad-toggle)')].some((b) => b.style.display !== 'none' && !b.disabled));

    // Port : arrivage en cours / prochain bateau, et pub « faire venir un bateau »
    const portOpen = g.portOpen();
    const pp = $('#port-pill');
    pp.classList.toggle('show', portOpen);
    pp.classList.toggle('hot', g.arrival > 0);
    if (portOpen) {
      const s = Math.ceil(g.arrival > 0 ? g.arrival : g.arrivalIn);
      const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setPill(pp, g.arrival > 0 ? `⛵ Arrivage ! Port ×${E.ARRIVAL_MULT} · ${s} s` : `⛵ Prochain bateau ${mmss}`, g.arrival > 0 ? `⛵ ×${E.ARRIVAL_MULT} ${s}s` : `⛵ ${mmss}`);
    }
    // Fête foraine : nuit en cours / prochaine nuit, et pub « faire tomber la nuit »
    const fairOpen = g.fairOpen();
    const np = $('#night-pill');
    np.classList.toggle('show', fairOpen);
    np.classList.toggle('hot', g.nightLeft > 0);
    if (fairOpen) {
      const s = Math.ceil(g.nightLeft > 0 ? g.nightLeft : g.nightIn);
      const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setPill(np, g.nightLeft > 0 ? `🌙 Nuit à la fête ! ×${E.NIGHT_MULT} · ${s} s` : `🌙 Nuit dans ${mmss}`, g.nightLeft > 0 ? `🌙 ×${E.NIGHT_MULT} ${s}s` : `🌙 ${mmss}`);
    }
    const nb = $('#ad-night');
    nb.style.display = fairOpen ? '' : 'none';
    nb.disabled = g.adCooldown.night > 0 || g.nightLeft > 0;
    nb.innerHTML = g.nightLeft > 0 ? '🌙 C\'est la nuit' : g.adCooldown.night > 0 ? `📺 Nuit · ${Math.ceil(g.adCooldown.night)} s` : '📺 Faire tomber la nuit';

    // Plage : canicule en cours / prochaine canicule, et pub « déclencher la canicule »
    const beachOpen = g.beachOpen();
    const hp = $('#heat-pill');
    hp.classList.toggle('show', beachOpen);
    hp.classList.toggle('hot', g.heatLeft > 0);
    if (beachOpen) {
      const s = Math.ceil(g.heatLeft > 0 ? g.heatLeft : g.heatIn);
      const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setPill(hp, g.heatLeft > 0 ? `☀️ Canicule ! Plage ×${E.HEAT_MULT} · ${s} s` : `☀️ Canicule dans ${mmss}`, g.heatLeft > 0 ? `☀️ ×${E.HEAT_MULT} ${s}s` : `☀️ ${mmss}`);
    }
    const hb = $('#ad-heat');
    hb.style.display = beachOpen ? '' : 'none';
    hb.disabled = g.adCooldown.heat > 0 || g.heatLeft > 0;
    hb.innerHTML = g.heatLeft > 0 ? '☀️ Canicule en cours' : g.adCooldown.heat > 0 ? `📺 Canicule · ${Math.ceil(g.adCooldown.heat)} s` : '📺 Déclencher la canicule';

    const boat = $('#ad-boat');
    boat.style.display = portOpen ? '' : 'none';
    boat.disabled = g.adCooldown.boat > 0 || g.arrival > 0;
    boat.innerHTML = g.arrival > 0 ? '⛵ Bateau à quai' : g.adCooldown.boat > 0 ? `📺 Bateau · ${Math.ceil(g.adCooldown.boat)} s` : '📺 Faire venir un bateau';
    this.updateShop(false);
  }

  /** Zone que regarde la caméra (d'après le point visé au sol). */
  zoneAt(x, z) {
    if (x < -37) return 'port';                 // à gauche de la ville : le port
    if (z > 36) return x < 10 ? 'beach' : 'fair'; // devant la promenade : la plage, puis la fête
    if (x > 27) return 'market';                // à droite : le marché couvert
    return 'parking';
  }

  /**
   * Quand le joueur se déplace lui-même jusqu'à une autre zone, le menu de gauche et la boutique suivent.
   * (Pas pendant un recadrage automatique, et seulement vers une zone déjà ouverte.)
   */
  followCamera(dt) {
    if (this.world.busy) { this.zoneT = 0; return; }
    const t = this.world.controls.target;
    const z = this.zoneAt(t.x, t.z);
    if (z === this.zone || !this.zoneOpen(z)) { this.zoneT = 0; return; }
    this.zoneT = (this.zoneT || 0) + dt;
    if (this.zoneT > 0.35) { this.zoneT = 0; this.setZone(z, false, false); }
  }

  /* ---------- Éléments attachés à la 3D (chaque image) ---------- */
  frame(dt) {
    const g = this.game, w = this.world;
    this.followCamera(dt);
    g.stands.forEach((s, i) => {
      const b = this.bubbles[i];
      if (s.unlocked && s.serving) {
        const p = w.toScreen(s.counterPos());
        b.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        b.querySelector('.emoji').textContent = s.recipe.emoji;
        b.querySelector('i').style.width = `${(1 - s.timer / s.duration) * 100}%`;
        b.style.display = p.visible ? '' : 'none';
      } else b.style.display = 'none';

      const pb = this.plotBtns[i];
      if (!s.unlocked && i === g.nextLockedStand()) {
        const p = w.toScreen(s.plotPos());
        const cost = E.STAND_COST[i];
        const zid = E.zoneOf(i).id;
        const what = i === E.MARKET_FIRST ? '🏛️ Marché couvert' : i === E.PORT_FIRST ? '⚓ Le port' : i === E.FAIR_FIRST ? '🎡 Fête foraine' : i === E.BEACH_FIRST ? '🏖️ La plage'
          : zid === 'market' ? '🔒 Nouvel étal' : zid === 'port' ? '🔒 Nouvelle boutique' : zid === 'beach' ? '🔒 Nouvelle paillote' : '🔒 Nouveau stand';
        const html = `<span class="pb">${what}<br><b>${fmt(cost)} $</b></span>`;
        if (pb.innerHTML !== html) pb.innerHTML = html;
        pb.classList.toggle('can', g.state.money >= cost);
        pb.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        pb.style.display = p.visible ? '' : 'none';
      } else pb.style.display = 'none';
    });

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      const k = f.t / 1.4;
      if (k >= 1) { f.el.remove(); this.floats.splice(i, 1); continue; }
      const pos = f.pos.clone(); pos.y += k * 1.2;
      const p = w.toScreen(pos);
      f.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${0.8 + Math.min(1, k * 6) * 0.25})`;
      f.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }
  }

  earn(pos, amount, emoji) {
    if (this.floats.length > 40) return;
    const f = el('div', 'float', `${emoji ? emoji + ' ' : ''}+${fmt(amount)} $`);
    if (this.game.boost > 0) f.classList.add('boost');
    this.layer.appendChild(f);
    this.floats.push({ el: f, pos: pos.clone(), t: 0 });
  }

  toast(text) {
    const t = el('div', 'toast', text);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  offline(gain, onClaim) {
    const m = el('div', 'modal', `<div class="modal-box">
      <h2>Bon retour, patron ! 👋</h2>
      <p>Pendant ton absence (${fmtDuration(gain.seconds)}), tes stands ont gagné :</p>
      <div class="big">${fmt(gain.amount)} $</div>
      <div class="row"><button class="ghost" data-x="1">Récupérer</button><button class="gold" data-x="2">📺 Récupérer ×2</button></div>
    </div>`);
    document.body.appendChild(m);
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-x]');
      if (!b) return;
      m.remove();
      let mult = 1;
      if (b.dataset.x === '2' && await ads.rewarded()) mult = 2;
      onClaim(gain.amount * mult);
    });
  }

  /** Fenêtre de confirmation dans le jeu. Résout true si le joueur confirme. */
  ask(title, text, yes, no) {
    return new Promise((resolve) => {
      const m = el('div', 'modal', `<div class="modal-box">
        <h2></h2><p></p>
        <div class="row"><button class="ghost" data-x="0"></button><button class="danger" data-x="1"></button></div>
      </div>`);
      m.querySelector('h2').textContent = title;
      m.querySelector('p').textContent = text;
      m.querySelector('[data-x="0"]').textContent = no;
      m.querySelector('[data-x="1"]').textContent = yes;
      document.body.appendChild(m);
      m.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-x]');
        if (!b && e.target !== m) return;
        m.remove();
        resolve(!!b && b.dataset.x === '1');
      });
    });
  }

  /** Ouvre un onglet de la boutique (recettes, améliorations, stands) et déplie la liste. */
  selectTab(tab) {
    this.tab = tab;
    $('#shop').classList.remove('collapsed');
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
    this.rebuildShop();
  }

  welcome() {
    this.toast('🍔 Sers tes premiers clients et achète des améliorations !');
  }
}
