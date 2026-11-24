/*
 * Plateforme de publication : CrazyGames (SDK v3, chargé par index.html).
 * - sur crazygames.com : pubs, sauvegarde dans le compte du joueur, événements de partie ;
 * - sur localhost : le SDK tourne en mode « local » (fausses pubs affichées par CrazyGames) pour tester ;
 * - ailleurs, ou si le SDK n'a pas pu être chargé (hors ligne, bloqueur) : le jeu tourne sans pubs.
 */
export const platform = {
  /** Le SDK CrazyGames, ou null s'il n'est pas utilisable. */
  sdk: null,
  /** 'crazygames' | 'local' | 'disabled' | 'none' */
  env: 'none',
  /** Un bloqueur de publicités a été détecté. */
  adblock: false,
  /** Réglage « son coupé » de CrazyGames (prioritaire sur nos boutons de son). */
  muteAudio: false,
  onMuteChange: null,
};

/** Appel protégé au SDK (ne casse jamais le jeu). */
export function sdkCall(fn) {
  if (!platform.sdk) return undefined;
  try { return fn(platform.sdk); } catch (e) { console.warn('[CrazyGames]', e); return undefined; }
}

/** À attendre pendant l'écran de chargement, avant de créer la partie (la sauvegarde en dépend). */
export async function initPlatform() {
  const SDK = window.CrazyGames && window.CrazyGames.SDK;
  if (!SDK) return platform;
  try {
    await SDK.init();
  } catch (e) {
    console.warn('[CrazyGames] SDK indisponible', e);
    return platform;
  }
  platform.env = SDK.environment;
  if (platform.env !== 'crazygames' && platform.env !== 'local') return platform; // 'disabled' : autre site
  platform.sdk = SDK;
  sdkCall((s) => s.game.loadingStart());
  try { platform.adblock = !!(await SDK.ad.hasAdblock()); } catch { /* inconnu : on tente quand même */ }
  sdkCall((s) => {
    platform.muteAudio = !!(s.game.settings && s.game.settings.muteAudio);
    s.game.addSettingsChangeListener((settings) => {
      platform.muteAudio = !!settings.muteAudio;
      if (platform.onMuteChange) platform.onMuteChange(platform.muteAudio);
    });
  });
  return platform;
}

/** Fin du chargement : la partie commence (mesure du temps de chargement par CrazyGames). */
export function gameReady() {
  sdkCall((s) => s.game.loadingStop());
  sdkCall((s) => s.game.gameplayStart());
}

/** Moment fort (nouveau niveau ouvert) : petite fête sur le site CrazyGames. */
export function happytime() { sdkCall((s) => s.game.happytime()); }
