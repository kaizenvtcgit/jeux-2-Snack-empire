import * as E from './economy.js';
import { TEST_MODE, setTestMode } from './save.js';
import { clearSave } from './save.js';

/*
 * Mode essai : partie séparée (la vraie partie n'est jamais touchée) + panneau de raccourcis
 * pour tout tester vite : argent, camions, cuisiniers, recettes, clients, vitesse du jeu.
 * On l'active dans ⚙️ Réglages → « 🧪 Mode essai ».
 */
export function initTestMode(game, ui, kitchens) {
  // bouton dans les réglages (entrer / quitter le mode essai)
  const reset = document.getElementById('reset-btn');
  const sw = document.createElement('button');
  sw.id = 'test-switch';
  sw.textContent = TEST_MODE ? '🚪 Quitter le mode essai' : '🧪 Mode essai';
  sw.addEventListener('click', () => {
    game.save();
    setTestMode(!TEST_MODE);
    game.resetting = true; // (on ne réécrit plus rien en partant)
    location.reload();
  });
  reset.before(sw);
  game.speed = 1;
  if (!TEST_MODE) return;

  const S = game.state;
  // nouvelle partie d'essai : pas de tutoriel, de l'argent pour commencer
  if (game.isNewPlayer) { S.tuto = 99; game.addMoney(100000); }

  const say = (t) => ui.toast(t);
  const kitchenTrucks = [0, 1, 2].filter((i) => i < E.OPEN_STANDS);
  const actions = [
    ['💰 +10 000 $', () => game.addMoney(10000)],
    ['💰 +1 million $', () => game.addMoney(1e6)],
    ['🚚 Ouvrir tous les camions', () => {
      for (const i of kitchenTrucks) if (!S.stands[i].unlocked) { game.addMoney(E.STAND_COST[i] || 0); game.buyStand(i); }
      say('🚚 Tous les camions sont ouverts');
    }],
    ['👨‍🍳 +1 cuisinier partout', () => {
      for (const i of kitchenTrucks) { const st = S.stands[i]; if (st.unlocked && st.cooks < E.maxCooks(i)) { game.addMoney(E.COOK_COST[i][st.cooks]); game.hireCook(i); } }
    }],
    ['🙅 Renvoyer les cuisiniers', () => {
      for (const k of kitchens) for (const m of k.crew || []) if (m.job) { k.dropJob(m.job, true); m.job = null; }
      for (const i of kitchenTrucks) { S.stands[i].cooks = 0; game.stands[i].jobs = []; game.stands[i].setCooks(0); }
      game.save(); game.hooks.changed(); say('Plus aucun cuisinier : à toi de cuisiner !');
    }],
    ['📖 Débloquer tous les menus', () => {
      for (const i of kitchenTrucks) for (const m of E.truckModels(i)) if (!S.recipes[m.id]) S.recipes[m.id] = 1;
      game.refreshMenus(); game.save(); game.hooks.changed(); say('📖 Toutes les recettes sont débloquées');
    }],
    ['🔧 Équipement au maximum', () => {
      for (const i of kitchenTrucks) { const eq = E.truckState(S, i).eq; for (const k of Object.keys(E.EQUIPMENT)) eq[k] = E.EQUIPMENT[k].costs.length; }
      game.save(); game.hooks.changed(); say('🔧 Équipement au maximum dans les 3 camions');
    }],
    ['⭐ +10 étoiles', () => { S.stars = (S.stars || 0) + 10; game.hooks.changed(); }],
    ['👥 Vague de clients', () => {
      const open = game.stands.filter((s) => s.unlocked);
      for (const s of open) if (E.isKitchenTruck(s.index)) for (let j = 0; j < 4; j++) game.spawn(open, { stand: s });
      say('👥 Des clients arrivent !');
    }],
  ];

  const btn = document.createElement('button');
  btn.id = 'test-btn'; btn.textContent = '🧪'; btn.title = 'Mode essai';
  const panel = document.createElement('div');
  panel.id = 'test-panel';
  panel.innerHTML = '<div class="tp-title">🧪 Mode essai <small>partie séparée : ta vraie partie n\'est pas touchée</small></div>';
  for (const [label, fn] of actions) {
    const b = document.createElement('button'); b.textContent = label;
    b.addEventListener('click', () => { try { fn(); ui.refresh && ui.refresh(); } catch (e) { console.error(e); } });
    panel.append(b);
  }
  // vitesse du jeu
  const speed = document.createElement('div'); speed.className = 'tp-speed';
  speed.innerHTML = '<span>⏩ Vitesse</span>';
  for (const v of [1, 3, 10]) {
    const b = document.createElement('button'); b.textContent = `×${v}`; b.dataset.v = v;
    b.addEventListener('click', () => { game.speed = v; speed.querySelectorAll('button').forEach((x) => x.classList.toggle('on', +x.dataset.v === v)); });
    if (v === 1) b.classList.add('on');
    speed.append(b);
  }
  panel.append(speed);
  const wipe = document.createElement('button'); wipe.className = 'tp-wipe'; wipe.textContent = '♻️ Recommencer l\'essai';
  wipe.addEventListener('click', () => { game.resetting = true; clearSave(); location.reload(); });
  panel.append(wipe);
  btn.addEventListener('click', () => { panel.classList.toggle('show'); document.getElementById('settings').classList.remove('show'); });
  document.getElementById('settings-btn').addEventListener('click', () => panel.classList.remove('show'));
  const badge = document.createElement('div'); badge.id = 'test-badge'; badge.textContent = '🧪 MODE ESSAI';
  document.body.append(btn, panel, badge);
}
