/*
 * Tutoriel des nouveaux joueurs : une bulle explique quoi faire et un anneau lumineux entoure le bouton à toucher.
 * On passe à l'étape suivante dès que l'action est faite (pas besoin de cliquer « suivant »).
 * L'étape en cours est gardée dans la sauvegarde (state.tuto) ; les anciennes parties ne le voient pas.
 */
import { L } from './i18n.js';

const DONE = 99;

export function initTutorial(ui, game) {
  const S = game.state;
  if (S.tuto === undefined) S.tuto = game.isNewPlayer ? 0 : DONE;
  if (S.tuto >= DONE) return { frame() {} };

  const bubble = document.createElement('div');
  bubble.id = 'tuto';
  bubble.innerHTML = '<div class="tuto-step"></div><div class="tuto-text"></div><div class="tuto-row"><button class="tuto-ok"></button><button class="tuto-skip">' + L('Passer le tutoriel', 'Skip tutorial') + '</button></div>';
  const ring = document.createElement('div');
  ring.id = 'tuto-ring';
  document.body.append(ring, bubble);
  const $b = (s) => bubble.querySelector(s);

  const card = (id) => ui.cards.get(id)?.querySelector('button') || null;
  const inShop = (elx) => !!elx && !!elx.closest('#shop');
  const phone = () => matchMedia('(max-width: 900px)').matches;
  /** Prépare la boutique : bonne zone, bon onglet, liste dépliée. */
  const shopOn = (tab) => {
    if (ui.zone !== 'parking') ui.setZone('parking');
    if (ui.tab !== tab) ui.selectTab(tab);
    document.getElementById('shop').classList.remove('collapsed');
  };

  const STEPS = [
    {
      text: L('<b>Bienvenue dans Snack Empire !</b> 🌭<br>Ton camion n\'a pas encore de cuisinier : les clients attendent ! Entre dans le camion et prépare toi-même un hot-dog.', '<b>Welcome to Snack Empire!</b> 🌭<br>Your truck has no cook yet, so customers are waiting! Step into the truck and make a hot dog yourself.'),
      prep: () => { if (ui.zone !== 'parking') ui.setZone('parking'); },
      target: () => document.getElementById('kitchen-btn'),
      done: () => (S.handServed || 0) >= 1,
    },
    {
      text: L('<b>Embauche ton premier cuisinier</b> 👨‍🍳 : il servira les clients tout seul, même quand tu n\'es pas dans le camion.<br><small>Pas assez d\'argent ? Sers encore quelques hot-dogs.</small>', '<b>Hire your first cook</b> 👨‍🍳: they will serve customers on their own, even when you are not in the truck.<br><small>Not enough money? Serve a few more hot dogs.</small>'),
      prep: () => shopOn('stands'),
      target: () => card('s-0'),
      done: () => S.stands[0].cooks >= 1,
    },
    {
      text: L('<b>Améliore ton hot-dog</b> : il se vendra plus cher (même ceux que tu prépares toi-même).<br><small>Pas assez d\'argent ? Attends quelques ventes.</small>', '<b>Upgrade your hot dog</b>: it will sell for more (even the ones you make yourself).<br><small>Not enough money? Wait for a few sales.</small>'),
      prep: () => shopOn('recipes'),
      target: () => card('r-hotdog'),
      done: () => (S.recipes.hotdog || 0) >= 2,
    },
    {
      text: L('<b>Débloque le cheese-dog</b> 🧀 : un nouveau hot-dog à la carte, plus cher. Les clients vont le commander !', '<b>Unlock the cheese dog</b> 🧀: a new hot dog on the menu that sells for more. Customers will order it!'),
      prep: () => shopOn('recipes'),
      target: () => card('r-cheesedog'),
      done: () => (S.recipes.cheesedog || 0) >= 1,
    },
    {
      text: L('<b>Embauche un 2e cuisinier</b> 👨‍🍳👨‍🍳 : il prend l\'autre moitié du camion, deux commandes se préparent à la fois.', '<b>Hire a 2nd cook</b> 👨‍🍳👨‍🍳: they take the other half of the truck, two orders get made at once.'),
      prep: () => shopOn('stands'),
      target: () => card('s-0'),
      done: () => S.stands[0].cooks >= 2,
    },
    {
      text: L('<b>Équipe ton camion</b> ⚡ : la cuisson rapide accélère tout le monde, l\'enseigne attire plus de clients.', '<b>Equip your truck</b> ⚡: fast cooking speeds everyone up, the neon sign brings more customers.'),
      prep: () => shopOn('upgrades'),
      target: () => card('e-speed'),
      done: () => S.hd.eq.speed + S.hd.eq.counter + S.hd.eq.sign >= 1,
    },
    {
      text: L('<b>Bravo, ton camion tourne tout seul !</b> 🎉<br>Chaque client servi te donne des ⭐. Cuisine toi-même pour gagner 3× plus et viser 3 étoiles. 100 ⭐ ouvriront la suite !', '<b>Well done, your truck runs on its own!</b> 🎉<br>Every customer served gives you ⭐. Cook yourself to earn 3× more and aim for 3 stars. 100 ⭐ will unlock what comes next!'),
      ok: L('Super !', 'Great!'),
      target: () => null,
    },
  ];

  let shown = -1;
  const finish = () => { S.tuto = DONE; bubble.remove(); ring.remove(); game.save(); };
  $b('.tuto-skip').addEventListener('click', finish);
  $b('.tuto-ok').addEventListener('click', () => { S.tuto++; if (S.tuto >= STEPS.length) finish(); });

  function show(i) {
    const st = STEPS[i];
    shown = i;
    $b('.tuto-step').textContent = `${L('Astuce', 'Tip')} ${i + 1} / ${STEPS.length}`;
    $b('.tuto-text').innerHTML = st.text;
    $b('.tuto-ok').textContent = st.ok || '';
    $b('.tuto-ok').style.display = st.ok ? '' : 'none';
    st.prep?.();
  }

  return {
    frame() {
      if (S.tuto >= STEPS.length) { if (bubble.isConnected) finish(); return; }
      const i = S.tuto, st = STEPS[i];
      if (st.done?.()) { S.tuto++; game.save(); return; }
      if (i !== shown) show(i);
      // cible : sur téléphone, si le bouton est dans la boutique fermée, on montre d'abord le bouton « Boutique »
      let t = st.target();
      const closedShop = phone() && inShop(t) && !document.body.classList.contains('shop-open');
      if (closedShop) t = document.getElementById('shop-toggle');
      $b('.tuto-text').classList.toggle('hint', closedShop);
      const r = t && t.getBoundingClientRect();
      if (r && r.width) {
        ring.style.display = 'block';
        ring.style.left = `${r.left - 6}px`; ring.style.top = `${r.top - 6}px`;
        ring.style.width = `${r.width + 12}px`; ring.style.height = `${r.height + 12}px`;
      } else ring.style.display = 'none';
      // placement de la bulle : à gauche de la boutique (ordinateur), sinon au-dessus / en dessous de la cible
      const W = innerWidth, H = innerHeight, bw = bubble.offsetWidth, bh = bubble.offsetHeight;
      let x, y;
      if (r && r.width && inShop(t) && !phone()) { x = document.getElementById('shop').getBoundingClientRect().left - bw - 16; y = r.top + r.height / 2 - bh / 2; }
      else if (r && r.width && inShop(t)) { x = W / 2 - bw / 2; y = document.getElementById('shop').getBoundingClientRect().top - bh - 10; } // téléphone : au-dessus du panneau
      else if (r && r.width) { x = r.left + r.width / 2 - bw / 2; y = r.top > H / 2 ? r.top - bh - 18 : r.bottom + 18; }
      else { x = W / 2 - bw / 2; y = H * 0.3; }
      bubble.style.left = `${Math.max(10, Math.min(W - bw - 10, x))}px`;
      bubble.style.top = `${Math.max(10, Math.min(H - bh - 10, y))}px`;
    },
  };
}
