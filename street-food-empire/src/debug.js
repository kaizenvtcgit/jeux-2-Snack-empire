import * as E from './economy.js';

/**
 * Panneau de test : visible uniquement en développement (npm run dev)
 * ou avec « ?debug » dans l'adresse. Les joueurs ne le voient jamais.
 */
export const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

export function initDebug(game, ui, world) {
  const state = { speed: 1 };
  if (!DEBUG) return state;

  const panel = document.createElement('div');
  panel.id = 'debug';
  panel.innerHTML = `
    <button class="dbg-toggle">🛠️ Test</button>
    <div class="dbg-body">
      <div class="dbg-title">Argent</div>
      <div class="dbg-row">
        <button data-d="money:1e4">+10 k</button><button data-d="money:1e6">+1 M</button>
        <button data-d="money:1e8">+100 M</button><button data-d="money:1e10">+10 Md</button>
      </div>
      <div class="dbg-title">Vitesse du temps</div>
      <div class="dbg-row" id="dbg-speed">
        <button data-d="speed:1">×1</button><button data-d="speed:5">×5</button><button data-d="speed:20">×20</button>
      </div>
      <div class="dbg-title">Raccourcis</div>
      <div class="dbg-row col">
        <button data-d="trucks">🚚 Ouvrir les 4 camions</button>
        <button data-d="market">🏛️ Ouvrir le marché + ses 6 étals</button>
        <button data-d="port">⚓ Ouvrir le port + ses 8 boutiques</button>
        <button data-d="boat">⛵ Arrivage du pêcheur maintenant</button>
        <button data-d="fair">🎡 Ouvrir la fête + ses 8 stands</button>
        <button data-d="night">🌙 Nuit à la fête maintenant</button>
        <button data-d="beach">🏖️ Ouvrir la plage + ses 8 paillotes</button>
        <button data-d="heat">☀️ Canicule maintenant</button>
        <button data-d="recipes">🍔 Toutes les recettes niv. 10</button>
        <button data-d="upgrades">⚡ Améliorations niv. 10</button>
        <button data-d="cooks">👨‍🍳 Équipes complètes</button>
        <button data-d="offline">⏰ Simuler 2 h d'absence</button>
      </div>
      <div class="dbg-note">Visible seulement en test. Les achats faits ici sont sauvegardés : « Recommencer à zéro » (⚙️) pour repartir de rien.</div>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelector('.dbg-toggle').addEventListener('click', () => panel.classList.toggle('open'));

  const S = game.state;
  const openStand = (i) => {
    if (S.stands[i].unlocked) return;
    S.money += E.STAND_COST[i];
    game.buyStand(i);
  };
  const refreshSpeed = () => panel.querySelectorAll('#dbg-speed button').forEach((b) => b.classList.toggle('on', b.dataset.d === `speed:${state.speed}`));

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const [cmd, arg] = b.dataset.d.split(':');
    if (cmd === 'money') game.addMoney(+arg);
    if (cmd === 'speed') { state.speed = +arg; refreshSpeed(); }
    if (cmd === 'trucks') { for (let i = 1; i < E.MARKET_FIRST; i++) openStand(i); ui.setZone('parking'); }
    if (cmd === 'market') {
      for (let i = 1; i < E.PORT_FIRST; i++) openStand(i);
      ui.setZone('market');
    }
    if (cmd === 'port') {
      for (let i = 1; i < E.FAIR_FIRST; i++) openStand(i);
      ui.setZone('port');
    }
    if (cmd === 'fair') {
      for (let i = 1; i < E.BEACH_FIRST; i++) openStand(i);
      ui.setZone('fair');
    }
    if (cmd === 'beach') {
      for (let i = 1; i < S.stands.length; i++) openStand(i);
      ui.setZone('beach');
    }
    if (cmd === 'heat' && game.beachOpen()) { game.startHeat(); ui.setZone('beach'); }
    if (cmd === 'night' && game.fairOpen()) { game.startNight(); ui.setZone('fair'); }
    if (cmd === 'boat' && game.portOpen()) { game.startArrival(); ui.setZone('port'); }
    if (cmd === 'recipes') {
      for (const Z of E.ZONES) if (S.stands[Z.first].unlocked) for (const r of Z.recipes) S.recipes[r.id] = Math.max(S.recipes[r.id] || 0, 10);
      game.refreshMenus();
    }
    if (cmd === 'upgrades') for (const k in S.up) S.up[k] = Math.max(S.up[k], Math.min(10, E.UPGRADES[k].max));
    if (cmd === 'cooks') S.stands.forEach((st, i) => { if (st.unlocked) { st.cooks = E.MAX_COOKS; game.stands[i].setCooks(E.MAX_COOKS); } });
    if (cmd === 'offline') {
      S.rate = Math.max(S.rate, 50);
      S.lastSeen = Date.now() - 2 * 3600 * 1000;
      game.isNewPlayer = false;
      const gain = game.offlineGain();
      if (gain) ui.offline(gain, (amount) => game.addMoney(amount));
    }
    game.save();
    ui.refresh();
  });
  refreshSpeed();
  return state;
}
