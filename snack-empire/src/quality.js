/**
 * Qualité graphique : « auto » (par défaut), « high » ou « low ».
 * En auto, on mesure les images/seconde après le chargement : sous 45 i/s, on passe en qualité basse.
 */
const KEY = 'street-food-empire-quality';
const WARMUP_S = 3;
const SAMPLE_S = 4;
const MIN_FPS = 45;

export function initQuality(world) {
  let pref = 'auto';
  try { pref = localStorage.getItem(KEY) || 'auto'; } catch { /* stockage indisponible */ }

  const state = { pref, t: 0, frames: 0, measured: null };
  const apply = () => {
    if (state.pref === 'high') world.setQuality('high');
    else if (state.pref === 'low') world.setQuality('low');
    else world.setQuality(world.mobile || (state.measured !== null && state.measured < MIN_FPS) ? 'low' : 'high');
  };
  apply();

  return {
    get pref() { return state.pref; },
    get measured() { return state.measured; },
    setPref(p) {
      state.pref = p;
      try { localStorage.setItem(KEY, p); } catch { /* rien */ }
      apply();
    },
    /** À appeler à chaque image avec le temps réel écoulé (non plafonné). */
    tick(realDt) {
      if (state.measured !== null || state.pref !== 'auto' || document.hidden) return;
      state.t += realDt;
      if (state.t < WARMUP_S) return;
      state.frames += 1;
      if (state.t >= WARMUP_S + SAMPLE_S) {
        state.measured = state.frames / SAMPLE_S;
        apply();
      }
    },
  };
}
