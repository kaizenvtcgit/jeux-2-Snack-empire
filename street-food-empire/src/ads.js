/**
 * Adaptateur de publicités.
 * En développement : simulation (compte à rebours de 3 s).
 * À la publication : brancher ici le SDK CrazyGames ou Poki (même interface).
 */
export const ads = {
  active: false,

  /** Pub récompensée : résout true si le joueur a regardé jusqu'au bout. */
  rewarded() { return simulate('Publicité récompensée'); },

  /** Pub intercalaire (uniquement aux grandes étapes, ex. nouveau stand). */
  midgame() { return simulate('Publicité'); },
};

function simulate(label) {
  ads.active = true;
  return new Promise((resolve) => {
    const o = document.createElement('div');
    o.className = 'ad-sim';
    o.innerHTML = `<div class="ad-box"><div class="ad-label">${label}</div><div class="ad-sub">(simulation — la vraie pub s'affichera ici)</div><div class="ad-count">3</div></div>`;
    document.body.appendChild(o);
    let n = 3;
    const iv = setInterval(() => {
      n -= 1;
      o.querySelector('.ad-count').textContent = String(n);
      if (n <= 0) {
        clearInterval(iv);
        o.remove();
        ads.active = false;
        resolve(true);
      }
    }, 1000);
  });
}
