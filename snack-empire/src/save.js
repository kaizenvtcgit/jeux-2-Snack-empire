// (clé gardée de l'ancien nom « Street Food Empire » : la changer effacerait les parties des joueurs)
const KEY = 'street-food-empire-save-v1';

export function loadSave() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function writeSave(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible : on continue sans sauvegarde */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* rien */ }
}
