import { platform } from './platform.js';

// Copie « Cuisine » du jeu : sa propre clé, pour ne jamais toucher à la partie du jeu d'origine
// (le jeu publié garde 'street-food-empire-save-v1' : ne pas la changer là-bas)
// (v2 : nouvelle mécanique tycoon + cuisine, on repart d'une partie neuve)
// Mode essai : une partie à part (clé différente), pour tout tester vite sans toucher à la vraie partie
const TEST_FLAG = 'snack-empire-cuisine-test-mode';
export const TEST_MODE = (() => { try { return localStorage.getItem(TEST_FLAG) === '1'; } catch { return false; } })();
export function setTestMode(on) { try { on ? localStorage.setItem(TEST_FLAG, '1') : localStorage.removeItem(TEST_FLAG); } catch { /* rien */ } }
const KEY = TEST_MODE ? 'snack-empire-cuisine-test' : 'snack-empire-cuisine-save-v2';

/*
 * Sur CrazyGames, la partie est enregistrée dans le compte du joueur (module « data » du SDK :
 * même progression sur tous ses appareils ; pour un invité, CrazyGames utilise le stockage du navigateur).
 * Ailleurs : stockage du navigateur (localStorage).
 */
const cloud = () => (!TEST_MODE && platform.sdk && platform.sdk.data) || null; // (l'essai reste sur ce navigateur)

export function loadSave() {
  try {
    const data = cloud();
    let s = data ? data.getItem(KEY) : localStorage.getItem(KEY);
    // première visite avec la sauvegarde dans le compte : on reprend la partie déjà jouée sur ce navigateur
    if (!s && data) {
      const local = localStorage.getItem(KEY);
      if (local) { data.setItem(KEY, local); s = local; }
    }
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function writeSave(state) {
  const json = JSON.stringify(state);
  try {
    const data = cloud();
    if (data) data.setItem(KEY, json);
    localStorage.setItem(KEY, json); // copie locale de secours
  } catch { /* stockage indisponible : on continue sans sauvegarde */ }
}

export function clearSave() {
  try {
    const data = cloud();
    if (data) data.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch { /* rien */ }
}
