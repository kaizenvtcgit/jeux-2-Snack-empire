/*
 * Tutoriel des nouveaux joueurs : une bulle explique quoi faire et un anneau lumineux entoure le bouton à toucher.
 * On passe à l'étape suivante dès que l'action est faite (pas besoin de cliquer « suivant »).
 * L'étape en cours est gardée dans la sauvegarde (state.tuto) ; les anciennes parties ne le voient pas.
 */
const DONE = 99;

export function initTutorial(ui, game) {
  const S = game.state;
  if (S.tuto === undefined) S.tuto = game.isNewPlayer ? 0 : DONE;
  if (S.tuto >= DONE) return { frame() {} };

  const bubble = document.createElement('div');
  bubble.id = 'tuto';
  bubble.innerHTML = '<div class="tuto-step"></div><div class="tuto-text"></div><div class="tuto-row"><button class="tuto-ok"></button><button class="tuto-skip">Passer le tutoriel</button></div>';
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
      text: '<b>Bienvenue dans Snack Empire !</b> 🍔<br>Les clients font la queue devant ton camion : chaque burger vendu te rapporte de l\'argent.',
      ok: 'C\'est parti !',
      target: () => document.querySelector('.pill.money'),
    },
    {
      text: '<b>Améliore ton burger</b> : il se vendra plus cher.<br><small>Pas assez d\'argent ? Attends quelques ventes.</small>',
      prep: () => shopOn('recipes'),
      target: () => card('r-burger'),
      done: () => (S.recipes.burger || 0) >= 2,
    },
    {
      text: '<b>Débloque les frites</b> 🍟 : une nouvelle recette à la carte, qui rapporte plus.',
      prep: () => shopOn('recipes'),
      target: () => card('r-fries'),
      done: () => (S.recipes.fries || 0) >= 1,
    },
    {
      text: '<b>Ouvre un deuxième camion</b> 🚚 : touche l\'emplacement indiqué. Deux files de clients, deux fois plus de ventes !',
      // la caméra recule pour montrer le camion et l'emplacement du suivant
      prep: () => { if (ui.zone !== 'parking') ui.setZone('parking'); ui.world.frameStands([game.stands[0].x, game.stands[1].x]); },
      target: () => { const p = ui.plotBtns[1]; return p && p.style.display !== 'none' ? p : null; },
      done: () => S.stands[1].unlocked,
    },
    {
      text: '<b>Embauche un cuisinier</b> 👨‍🍳 : ton camion servira plus vite.',
      prep: () => shopOn('stands'),
      target: () => card('s-0') || card('s-1'),
      done: () => S.stands.some((s) => s.cooks >= 2),
    },
    {
      text: '<b>Les améliorations</b> ⚡ aident tous tes stands : cuisson plus rapide, publicité (plus de clients), file d\'attente plus longue. Achètes-en une !',
      prep: () => shopOn('upgrades'),
      target: () => card('u-speed'),
      done: () => S.up.speed + S.up.marketing + S.up.queue >= 1,
    },
    {
      text: '<b>Bravo, ton empire est lancé !</b> 🎉<br>Ouvre les 4 camions pour débloquer le <b>marché couvert</b> (niveau 2). Et pense aux bonus 📺 !',
      ok: 'Super !',
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
    $b('.tuto-step').textContent = `Astuce ${i + 1} / ${STEPS.length}`;
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
