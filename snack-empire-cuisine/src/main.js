import './style.css';
import { createWorld } from './world.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { ads } from './ads.js';
import { loadModels } from './models.js';
import { initQuality } from './quality.js';
import { UpgradeVisuals } from './visuals.js';
import { audio, sfx, setScene } from './audio.js';
import { initTutorial } from './tutorial.js';
import { platform, initPlatform, gameReady } from './platform.js';
import { Kitchen } from './kitchen.js';

// Écran de chargement : la barre suit le téléchargement des modèles, puis la construction de la ville
const ldFill = document.getElementById('ld-fill');
const setLoad = (k) => { if (ldFill) ldFill.style.width = `${Math.round(3 + k * 97)}%`; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
// (le SDK CrazyGames s'initialise pendant le téléchargement : la sauvegarde du joueur en dépend)
await Promise.all([initPlatform(), loadModels((k) => setLoad(k * 0.65))]);
setLoad(0.7); await nextFrame();
const world = createWorld(document.getElementById('app'));
setLoad(0.85); await nextFrame();
const ui = new UI(world);
const game = new Game(world, {
  earn: (pos, amount, emoji) => { ui.earn(pos, amount, emoji); sfx.coin(game && game.boost > 0); },
  changed: () => {},
  toast: (text) => ui.toast(text),
  stars: (pos, n) => ui.floatText(pos, '⭐'.repeat(n)),
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
// Cuisine : on entre dans le camion n°1 pour préparer soi-même les hot-dogs
const kitchen = new Kitchen(world, game, ui, game.stands[0]);

const gain = game.offlineGain();
if (gain) ui.offline(gain, (amount) => { game.addMoney(amount); sfx.jackpot(); ui.toast(`💰 +${amount.toLocaleString('fr-FR')} $`); });
// (nouveau joueur : le tutoriel prend le relais)
const tuto = initTutorial(ui, game);

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
  if (!ads.active) game.update(dt);
  visuals.update(dt);
  kitchen.update(ads.active ? 0 : dt);
  world.updateCamera(dt);
  world.animate(dt);
  ui.frame(dt);
  tuto.frame();
  // sons : ambiance de la zone regardée, coupés pendant une pub
  audio.setMuted(ads.playing || platform.muteAudio); // son coupé pendant une pub, ou si CrazyGames le demande
  setScene(ui.zone, game.night, game.heat, world.camera.position.distanceTo(world.controls.target));
  audio.update(dt);
  hudT += dt;
  if (hudT > 0.1) { hudT = 0; ui.refresh(); visuals.sync(); }
  world.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// fin du chargement : la barre se remplit, puis l'écran s'efface en fondu (visible au moins ~1,2 s pour voir le logo)
setLoad(1);
gameReady(); // CrazyGames : fin du chargement, début de la partie
const ld = document.getElementById('loading');
setTimeout(() => { ld.classList.add('done'); setTimeout(() => ld.remove(), 700); }, Math.max(350, 1200 - performance.now()));
// Accès console pour les tests : window.sfe.game.addMoney(100000)
window.sfe = { game, world, ui, quality, visuals, audio, sfx, kitchen };
