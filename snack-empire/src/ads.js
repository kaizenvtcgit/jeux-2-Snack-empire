import { platform, sdkCall } from './platform.js';

/*
 * Publicités, via le SDK CrazyGames.
 * Règles CrazyGames respectées ici :
 * - le jeu est mis en pause et l'écran bloqué (petit message) dès la demande de pub, jusqu'à sa fin ou son échec ;
 * - le son n'est coupé que quand la pub démarre vraiment (ads.playing) ;
 * - pub récompensée : la récompense n'est donnée que si la pub a été regardée jusqu'au bout ;
 * - pas de SDK (autre site, bloqueur, hors ligne) : pas de pubs, les boutons de bonus sont masqués.
 */
export const ads = {
  /** Une pub est demandée ou en cours : le jeu est en pause. */
  active: false,
  /** La pub est réellement à l'écran : le son est coupé. */
  playing: false,
  /** Code de la dernière erreur ('unfilled', 'adCooldown', 'adblock', 'adsDisabled'…). */
  lastError: null,

  /** Les pubs sont-elles possibles ? (sinon on masque les boutons de bonus) */
  get available() { return !!platform.sdk && !platform.adblock; },
  /** Un bloqueur de pubs empêche les bonus. */
  get blocked() { return !!platform.sdk && platform.adblock; },

  /** Pub récompensée : résout true seulement si le joueur l'a regardée jusqu'au bout. */
  rewarded() { return request('rewarded'); },
  /** Pub de mi-partie : seulement aux grands moments (ouverture d'un nouveau niveau). */
  midgame() { return request('midgame'); },
};

let blocker = null;
function block(on) {
  if (on && !blocker) {
    blocker = document.createElement('div');
    blocker.className = 'ad-wait';
    blocker.innerHTML = '<div class="ad-wait-box"><div class="ad-spin"></div>Publicité…</div>';
    document.body.appendChild(blocker);
  } else if (!on && blocker) { blocker.remove(); blocker = null; }
}

function request(type) {
  if (!ads.available || ads.active) return Promise.resolve(false);
  ads.active = true;
  ads.lastError = null;
  block(true);
  sdkCall((s) => s.game.gameplayStop());
  return new Promise((resolve) => {
    let finished = false, startTimer;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(startTimer);
      ads.active = false; ads.playing = false;
      block(false);
      sdkCall((s) => s.game.gameplayStart());
      resolve(ok);
    };
    // sécurité : si la pub ne démarre jamais (aucune réponse), on rend la main au joueur
    startTimer = setTimeout(() => { if (!ads.playing) { ads.lastError = 'timeout'; done(false); } }, 10000);
    try {
      platform.sdk.ad.requestAd(type, {
        adStarted: () => { ads.playing = true; clearTimeout(startTimer); },
        adFinished: () => done(true),
        adError: (error) => { ads.lastError = (error && error.code) || 'other'; done(false); },
      });
    } catch (e) {
      ads.lastError = 'other';
      done(false);
    }
  });
}
