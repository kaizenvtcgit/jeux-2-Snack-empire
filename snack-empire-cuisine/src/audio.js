/*
 * Sons du jeu, entièrement synthétisés (Web Audio) : aucun fichier à charger, aucun droit d'auteur.
 * - effets : vente (pièce), achat, ouverture d'un stand, arrivage (corne de bateau), nuit (carillon), canicule…
 * - ambiances selon la zone regardée : foule, vagues et mouettes au port et à la plage, boîte à musique à la fête
 * - musique de fond douce, en boucle
 * Le son ne démarre qu'après le premier clic / toucher (règle des navigateurs) et se coupe
 * quand l'onglet est caché ou pendant une publicité.
 */
const PREF_KEY = 'street-food-empire-audio';

let ctx = null, master, sfxBus, musicBus, ambBus, noiseBuf;
const prefs = { sfx: true, music: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch { /* rien */ }
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* rien */ } };

let muted = false;      // pub en cours, onglet caché
let lastCoin = 0, coinCount = 0;

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.connect(master);
  // bruit blanc (pour les vagues, la foule, la friture…)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyPrefs();
  startAmbience();
  startMusic();
}

function applyPrefs() {
  if (!ctx) return;
  const t = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(prefs.sfx && !muted ? 1 : 0, t, 0.05);
  ambBus.gain.setTargetAtTime(prefs.sfx && !muted ? 1 : 0, t, 0.3);
  musicBus.gain.setTargetAtTime(prefs.music && !muted ? 1 : 0, t, 0.3);
}

/* ---------- petites briques ---------- */
function tone(freq, { type = 'sine', at = 0, dur = 0.2, vol = 0.2, attack = 0.005, glide = 0, bus = sfxBus } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise({ at = 0, dur = 0.3, vol = 0.2, type = 'bandpass', freq = 1000, q = 1, bus = sfxBus } = {}) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const ready = () => ctx && ctx.state === 'running';

/* ---------- effets ---------- */
export const sfx = {
  /** Une vente : petite pièce (limité à quelques sons par seconde quand tout le monde achète en même temps). */
  coin(big = false) {
    if (!ready()) return;
    const now = performance.now();
    if (now - lastCoin > 1000) coinCount = 0;
    if (now - lastCoin < 90 || coinCount > 6) return;
    lastCoin = now; coinCount++;
    const p = 1 + (Math.random() - 0.5) * 0.08;
    tone(1318 * p, { type: 'triangle', dur: 0.12, vol: big ? 0.16 : 0.09 });
    tone(1976 * p, { type: 'triangle', at: 0.06, dur: 0.22, vol: big ? 0.14 : 0.08 });
  },
  /** Achat (recette, amélioration, vendeur) : petit arpège joyeux. */
  buy() {
    if (!ready()) return;
    [523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, dur: 0.18, vol: 0.13 }));
  },
  /** Nouveau stand / nouvelle zone : fanfare. */
  unlock() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'square', at: i * 0.09, dur: 0.25, vol: 0.07 }));
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: 0.36, dur: 0.7, vol: 0.06 + i * 0.005 }));
    noise({ at: 0.36, dur: 0.6, vol: 0.05, type: 'highpass', freq: 6000 }); // cymbale
  },
  /** Bouton, onglet. */
  click() { if (ready()) tone(880, { type: 'sine', dur: 0.05, vol: 0.06 }); },
  /** Refus (pas assez d'argent). */
  nope() { if (ready()) tone(220, { type: 'square', dur: 0.15, vol: 0.05, glide: 0.8 }); },
  /** Arrivage du pêcheur : corne de brume. */
  horn() {
    if (!ready()) return;
    for (const [f, v] of [[110, 0.16], [165, 0.08], [220, 0.05]]) tone(f, { type: 'sawtooth', dur: 1.8, vol: v, attack: 0.15 });
    tone(110, { type: 'sawtooth', at: 2.0, dur: 1.2, vol: 0.12, attack: 0.1 });
  },
  /** La nuit tombe sur la fête : carillon. */
  night() {
    if (!ready()) return;
    [1568, 1319, 1175, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'sine', at: i * 0.16, dur: 1.2, vol: 0.07 }));
  },
  /** Canicule : grésillement + petite mélodie estivale. */
  heat() {
    if (!ready()) return;
    noise({ dur: 1.2, vol: 0.05, type: 'highpass', freq: 3000 });
    [659, 784, 988, 1175].forEach((f, i) => tone(f, { type: 'triangle', at: 0.1 + i * 0.1, dur: 0.3, vol: 0.09 }));
  },
  /** Gros gain (hors ligne, livraison VIP). */
  jackpot() {
    if (!ready()) return;
    for (let i = 0; i < 8; i++) tone(1200 + i * 120, { type: 'triangle', at: i * 0.05, dur: 0.2, vol: 0.07 });
  },
};

/* ---------- ambiances (selon la zone regardée) ---------- */
const amb = {};
function loopNoise(type, freq, q) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(ambBus); s.start();
  return { g, f };
}
function startAmbience() {
  amb.crowd = loopNoise('bandpass', 700, 0.8);   // brouhaha
  amb.waves = loopNoise('lowpass', 500, 0.3);    // ressac
  amb.fry = loopNoise('highpass', 4500, 0.5);    // grésillement des cuisines
  amb.target = { crowd: 0.05, waves: 0, fry: 0.01, gulls: 0, fairMusic: 0 };
  amb.next = { gull: 2, box: 0 };
}

let zone = 'parking', night = 0, heat = 0, camDist = 30;
/** Appelée à chaque image : la zone regardée, la nuit (0-1), la canicule (0-1), la distance de la caméra. */
export function setScene(z, n, h, d) { zone = z; night = n; heat = h; camDist = d; }

let ambClock = 0;
function updateAmbience(dt) {
  if (!ready()) return;
  ambClock += dt;
  const near = Math.max(0.35, Math.min(1, 40 / Math.max(10, camDist))); // plus fort quand on est près
  const T = {
    parking: { crowd: 0.05, waves: 0, fry: 0.012, gulls: 0, fairMusic: 0 },
    market: { crowd: 0.07, waves: 0, fry: 0.004, gulls: 0, fairMusic: 0 },
    port: { crowd: 0.04, waves: 0.08, fry: 0.006, gulls: 1, fairMusic: 0 },
    fair: { crowd: 0.07, waves: 0.015, fry: 0.006, gulls: 0, fairMusic: 1 },
    beach: { crowd: 0.035 + heat * 0.03, waves: 0.12, fry: 0.003, gulls: 0.5, fairMusic: 0.15 },
  }[zone] || {};
  const t = ctx.currentTime;
  // le ressac monte et descend comme des vagues
  const swell = 0.55 + 0.45 * Math.sin(ambClock * 0.9) * Math.sin(ambClock * 0.37 + 1);
  amb.crowd.g.gain.setTargetAtTime((T.crowd || 0) * near, t, 0.8);
  amb.waves.g.gain.setTargetAtTime((T.waves || 0) * swell * near, t, 0.4);
  amb.waves.f.frequency.setTargetAtTime(350 + swell * 500, t, 0.4);
  amb.fry.g.gain.setTargetAtTime((T.fry || 0) * near, t, 0.8);
  // mouettes de temps en temps
  amb.next.gull -= dt;
  if (amb.next.gull <= 0) {
    amb.next.gull = 3 + Math.random() * 6;
    if ((T.gulls || 0) > Math.random()) {
      const v = 0.035 * near;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(1400 + Math.random() * 400, { type: 'sine', at: i * 0.22, dur: 0.2, vol: v, glide: 0.7, bus: ambBus });
    }
  }
  // boîte à musique de la fête foraine (plus présente la nuit)
  if ((T.fairMusic || 0) > 0) {
    amb.next.box -= dt;
    if (amb.next.box <= 0) {
      amb.next.box = 0.22;
      const MEL = [784, 988, 1175, 988, 784, 659, 784, 0, 880, 1047, 1319, 1047, 880, 784, 880, 0];
      const f = MEL[amb.boxStep = ((amb.boxStep || 0) + 1) % MEL.length];
      if (f) tone(f, { type: 'sine', dur: 0.35, vol: 0.03 * T.fairMusic * near * (1 + night), bus: ambBus });
    }
  }
}

/* ---------- musique de fond (douce, en boucle) ---------- */
let musicNext = 0, musicStep = 0;
const BPM = 96, STEP = 60 / BPM / 2; // croches
// progression I – vi – IV – V (do majeur), accords en arpège + basse
const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
const BASS = [131, 110, 87, 98];
function startMusic() { musicNext = ctx.currentTime + 0.3; }
function updateMusic() {
  if (!ready()) return;
  while (musicNext < ctx.currentTime + 0.25) {
    const bar = Math.floor(musicStep / 8) % 4, s = musicStep % 8;
    const ch = CHORDS[bar];
    const at = musicNext - ctx.currentTime;
    if (s === 0 || s === 4) tone(BASS[bar], { type: 'triangle', at, dur: STEP * 3.5, vol: 0.07, bus: musicBus });
    const note = ch[[0, 1, 2, 1, 0, 2, 1, 2][s]] * 2;
    tone(note, { type: 'sine', at, dur: STEP * 1.8, vol: 0.035, bus: musicBus });
    if (s === 2 || s === 6) noise({ at, dur: 0.05, vol: 0.012, type: 'highpass', freq: 7000, bus: musicBus }); // charleston discret
    musicNext += STEP; musicStep++;
  }
}

/* ---------- cycle de vie ---------- */
export const audio = {
  init,
  get sfxOn() { return prefs.sfx; },
  get musicOn() { return prefs.music; },
  setSfx(on) { prefs.sfx = on; savePrefs(); applyPrefs(); },
  setMusic(on) { prefs.music = on; savePrefs(); applyPrefs(); },
  /** Coupe tout (pub en cours, onglet caché) sans toucher aux réglages du joueur. */
  setMuted(m) { if (m === muted) return; muted = m; applyPrefs(); },
  update(dt) { if (!ctx) return; updateAmbience(dt); updateMusic(); },
};

// Le son démarre au premier geste du joueur (règle des navigateurs) ; coupé quand l'onglet est caché
const unlock = () => { init(); if (ctx && ctx.state === 'suspended' && !document.hidden) ctx.resume(); };
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('touchend', unlock, { capture: true }); // iPhone : le son ne démarre que sur un toucher terminé
addEventListener('click', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});
