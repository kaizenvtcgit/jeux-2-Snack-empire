import './style.css';
import { createWorld } from './world.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { ads } from './ads.js';
import { loadModels } from './models.js';
import { initQuality } from './quality.js';
import { UpgradeVisuals } from './visuals.js';
import { initDebug } from './debug.js';
import { audio, sfx, setScene } from './audio.js';

await loadModels();
const world = createWorld(document.getElementById('app'));
const ui = new UI(world);
const game = new Game(world, {
  earn: (pos, amount, emoji) => { ui.earn(pos, amount, emoji); sfx.coin(game && game.boost > 0); },
  changed: () => {},
  toast: (text) => ui.toast(text),
});
const visuals = new UpgradeVisuals(world, game);

// Sons : achats réussis / refusés, nouveaux stands, événements
const withSound = (name, ok = sfx.buy) => {
  const fn = game[name].bind(game);
  game[name] = (...args) => {
    const before = game.state.money;
    const r = fn(...args);
    if (game.state.money < before) ok(); else sfx.nope();
    return r;
  };
};
withSound('buyRecipe'); withSound('buyUpgrade'); withSound('hireCook'); withSound('buyStand', sfx.unlock);
for (const [name, play] of [['startArrival', sfx.horn], ['startNight', sfx.night], ['startHeat', sfx.heat], ['claimVip', sfx.jackpot]]) {
  const fn = game[name].bind(game);
  game[name] = (...args) => { play(); return fn(...args); };
}
// petit « clic » sur les boutons de l'interface (pas sur les boutons d'achat, qui ont leur propre son)
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.closest('.card') && !b.closest('.plot-btn')) sfx.click(); });
const quality = initQuality(world);
ui.bind(game, quality);
const debug = initDebug(game, ui, world); // panneau de test (développement uniquement)

const gain = game.offlineGain();
if (gain) ui.offline(gain, (amount) => { game.addMoney(amount); sfx.jackpot(); ui.toast(`💰 +${amount.toLocaleString('fr-FR')} $`); });
else if (game.isNewPlayer) ui.welcome();

// Sauvegarde à la fermeture / mise en arrière-plan
const persist = () => { if (!game.resetting) game.save(); };
addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

let last = performance.now();
let hudT = 0;
function loop(now) {
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.1, realDt);
  last = now;
  quality.tick(realDt);
  // en test, le temps peut être accéléré (plusieurs pas de simulation par image)
  if (!ads.active) for (let k = 0; k < debug.speed; k++) game.update(dt);
  visuals.update(dt);
  world.updateCamera(dt);
  world.animate(dt);
  ui.frame(dt);
  // sons : ambiance de la zone regardée, coupés pendant une pub
  audio.setMuted(!!ads.active);
  setScene(ui.zone, game.night, game.heat, world.camera.position.distanceTo(world.controls.target));
  audio.update(dt);
  hudT += dt;
  if (hudT > 0.1) { hudT = 0; ui.refresh(); visuals.sync(); }
  world.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.getElementById('loading').remove();
// Accès console pour les tests : window.sfe.game.addMoney(100000)
window.sfe = { game, world, ui, quality, visuals, audio, sfx };
