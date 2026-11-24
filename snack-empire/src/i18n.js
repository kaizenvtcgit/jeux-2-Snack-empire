/*
 * Langue du jeu : anglais par défaut (exigé par CrazyGames), français si le navigateur du joueur est en français.
 * Le joueur peut changer dans les réglages (⚙️) : le choix est retenu et le jeu se recharge
 * (les enseignes peintes sur les stands sont dessinées au chargement).
 *
 * Utilisation : L('Texte en français', 'English text') — chaque texte porte ses deux versions, côte à côte.
 */
const KEY = 'snack-empire-lang';

export const LANG = (() => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* stockage indisponible */ }
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
})();

export const L = (fr, en) => (LANG === 'fr' ? fr : en);

/** Change la langue (retenue sur cet appareil) et recharge le jeu. */
export function setLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch { /* rien */ }
  location.reload();
}

document.documentElement.lang = LANG;
