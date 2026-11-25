import { THREE, add, box, cyl, rbox, canvasTex } from './util.js';
import { L } from './i18n.js';

/*
 * Décor « réaliste » de l'intérieur du camion : matières dessinées (inox brossé, carrelage, bois, osier…),
 * plaque de cuisson, hotte, flacons de sauce, saucisses et pains.
 * Toutes les textures sont dessinées dans un <canvas> au chargement (aucun fichier image).
 */

const rnd = (a, b) => a + Math.random() * (b - a);
const once = (fn) => { let v; return () => v || (v = fn()); };

/* ---------------- Textures ---------------- */

/** Inox brossé : fines rayures horizontales claires et sombres. */
export const brushedTex = once(() => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#c3c8ce'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3200; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '70,76,84'},${Math.random() * 0.09})`;
    g.fillRect(Math.random() * w, Math.random() * h, rnd(30, 300), 1);
  }
  // quelques traces de doigts / d'essuyage, très légères
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rnd(20, 70);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(120,126,134,.07)'); gr.addColorStop(1, 'rgba(120,126,134,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}));

/** Carrelage métro blanc (briques décalées, joints gris). */
const tilesTex = once(() => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d6d1c7'; g.fillRect(0, 0, w, h);
  const cw = w / 4, ch = h / 8;
  for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) {
    const x = c * cw + (r % 2 ? cw / 2 : 0), y = r * ch;
    const l = 97 + Math.random() * 2.5;
    g.fillStyle = `hsl(42, 14%, ${l}%)`;
    g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
    // léger reflet en haut de chaque carreau
    const gr = g.createLinearGradient(0, y + 3, 0, y + ch - 3);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.05)');
    g.fillStyle = gr; g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
  }
}));

/** Plaque de cuisson culottée : acier noirci, marbrures, traces de graisse. */
const griddleTex = once(() => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2b2927'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rnd(15, 80);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = Math.random() < 0.5 ? '70,58,46' : '18,17,16';
    gr.addColorStop(0, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
}));

/** Bois de la planche : veines longitudinales. */
const woodTex = once(() => canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#c99a62'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const y0 = Math.random() * h, a = rnd(2, 8), f = rnd(0.005, 0.02), ph = Math.random() * 6;
    g.strokeStyle = `rgba(${Math.random() < 0.6 ? '120,78,40' : '230,190,140'},${rnd(0.08, 0.25)})`;
    g.lineWidth = rnd(0.6, 2.2);
    g.beginPath();
    for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x * f + ph) * a; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  // traces de couteau
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(90,60,30,.12)'; g.lineWidth = 0.7; const x = Math.random() * w, y = Math.random() * h, a = Math.random() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40); g.stroke(); }
}));

/** Osier tressé de la corbeille. */
const wickerTex = once(() => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#6e4a26'; g.fillRect(0, 0, w, h);
  const s = 16;
  for (let y = 0; y < h; y += s / 2) for (let x = 0; x < w; x += s) {
    const o = ((y / (s / 2)) % 2) * (s / 2);
    const gr = g.createLinearGradient(x + o, y, x + o + s, y);
    gr.addColorStop(0, '#8a5d2f'); gr.addColorStop(0.5, '#c79458'); gr.addColorStop(1, '#8a5d2f');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x + o + s / 2, y + s / 4, s / 2 - 1, s / 4 - 1, 0, 0, Math.PI * 2); g.fill();
  }
}, { rep: [3, 1] }));

/** Carton à damier rouge et blanc (barquette à hot-dog). */
const checkTex = once(() => canvasTex(128, 128, (g, w, h) => {
  const n = 8;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? '#f6f1e7' : '#c8282d'; g.fillRect(x * w / n, y * h / n, w / n, h / n); }
}));

/** Grille des filtres de hotte. */
const filterTex = once(() => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#7b8189'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3f444b'; g.lineWidth = 3;
  for (let x = -h; x < w; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke(); }
  g.strokeStyle = '#a3a9b0'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
}));

/** Marques de grill (rayures sombres en biais sur fond transparent). */
export const grillMarksTex = once(() => {
  const t = canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let x = 6; x < w; x += 26) {
      const gr = g.createLinearGradient(x, 0, x + 12, 0);
      gr.addColorStop(0, 'rgba(25,10,5,0)'); gr.addColorStop(0.5, 'rgba(25,10,5,.95)'); gr.addColorStop(1, 'rgba(25,10,5,0)');
      g.fillStyle = gr; g.save(); g.translate(x, 0); g.transform(1, 0, -0.35, 1, 0, 0); g.fillRect(0, 0, 12, h); g.restore();
    }
  });
  return t;
});

/** Fumée : tache ronde et douce. */
export const smokeTex = once(() => canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}));

/** Étiquette de flacon (texte sur bande de couleur). */
function labelTex(bg, fg, text, sub) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 38px "Arial Black", Impact, sans-serif';
    g.fillText(text, w / 4, h / 2 - 8); g.fillText(text, (w * 3) / 4, h / 2 - 8);
    g.font = '700 22px sans-serif'; g.fillText(sub, w / 4, h / 2 + 34); g.fillText(sub, (w * 3) / 4, h / 2 + 34);
  });
}

/** Ticket de commande imprimé (lignes de texte grisées). */
const ticketTex = once(() => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2a2a'; g.font = 'bold 18px monospace'; g.fillText('#' + (100 + Math.floor(Math.random() * 800)), 12, 28);
  for (let y = 48; y < h - 16; y += 18) { g.fillStyle = 'rgba(40,40,40,.55)'; g.fillRect(12, y, rnd(40, 100), 6); }
}));

/* ---------------- Matériaux ---------------- */
const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.8, ...o });
const phys = (o) => new THREE.MeshPhysicalMaterial({ envMapIntensity: 0.9, ...o });
function texRep(base, rx, ry) { const t = base.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return t; }

export const MAT = {
  steel: (rx = 2, ry = 1) => std({ map: texRep(brushedTex(), rx, ry), color: '#ffffff', metalness: 0.6, roughness: 0.42 }),
  darkSteel: () => std({ color: '#2f3237', metalness: 0.6, roughness: 0.4 }),
  tiles: (rx, ry) => std({ map: texRep(tilesTex(), rx, ry), color: '#ffffff', roughness: 0.25, metalness: 0, emissive: '#2a2824', emissiveIntensity: 0.25 }),
  ceiling: () => std({ color: '#eceae4', roughness: 0.85 }),
  floor: () => std({ color: '#3a3c40', roughness: 0.7, metalness: 0.3 }),
};

/* ---------------- Pièces de décor ---------------- */

/** Murs, plafond, fenêtre, plan de travail et meubles bas. */
export function buildRoomDecor(g) {
  // (intérieur symétrique autour du milieu de la fenêtre, x = -0,9 : deux moitiés identiques)
  // (murs 2 à 3 cm à l'intérieur de la carrosserie : s'ils la touchent, les deux surfaces se mélangent en points blancs vues de dehors)
  const X0 = -3.17, X1 = 1.37, Z0 = -1.12, Z1 = 1.11, F = 0.75, C = 2.97;
  const W0 = -2.45, W1 = 0.65, S0 = 1.525, S1 = 2.9; // ouverture de la fenêtre de service (grande : jusque sous le toit)
  const tile = (w, h) => MAT.tiles(w / 0.6, h / 0.6);
  add(box(X1 - X0, 0.05, Z1 - Z0, MAT.floor()), (X0 + X1) / 2, F, 0, g);
  add(box(X1 - X0, 0.05, Z1 - Z0, MAT.ceiling()), (X0 + X1) / 2, C, 0, g);
  add(box(0.05, C - F, Z1 - Z0, tile(Z1 - Z0, C - F)), X0, (F + C) / 2, 0, g);
  add(box(0.05, C - F, Z1 - Z0, tile(Z1 - Z0, C - F)), X1, (F + C) / 2, 0, g);
  // mur du fond : une seule face, tournée vers la fenêtre. Vu de dehors, on le voit derrière les cuisiniers ;
  // de l'intérieur, la caméra est derrière lui et il est invisible (elle voit sa face arrière, qui n'est pas dessinée)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, C - F), tile(X1 - X0, C - F));
  back.position.set((X0 + X1) / 2, (F + C) / 2, Z0 + 0.01);
  g.add(back);
  // mur de la fenêtre : carrelé autour de l'ouverture, inox en dessous (derrière le plan de travail)
  add(box(X1 - X0, S0 - F, 0.04, MAT.steel(5, 1)), (X0 + X1) / 2, (F + S0) / 2, Z1, g);
  add(box(X1 - X0, C - S1, 0.04, tile(X1 - X0, C - S1)), (X0 + X1) / 2, (S1 + C) / 2, Z1, g);
  add(box(W0 - X0, S1 - S0, 0.04, tile(W0 - X0, S1 - S0)), (X0 + W0) / 2, (S0 + S1) / 2, Z1, g);
  add(box(X1 - W1, S1 - S0, 0.04, tile(X1 - W1, S1 - S0)), (W1 + X1) / 2, (S0 + S1) / 2, Z1, g);
  // cadre de fenêtre en aluminium + vitre coulissante rangée sur le côté (ouverte)
  const alu = std({ color: '#aeb4bb', metalness: 0.8, roughness: 0.3 });
  for (const [w, h, x, y] of [[W1 - W0 + 0.1, 0.05, (W0 + W1) / 2, S0], [W1 - W0 + 0.1, 0.05, (W0 + W1) / 2, S1], [0.05, S1 - S0, W0, (S0 + S1) / 2], [0.05, S1 - S0, W1, (S0 + S1) / 2]]) {
    add(box(w, h, 0.12, alu), x, y, Z1, g);
  }
  add(box(W1 - W0, 0.015, 0.05, alu), (W0 + W1) / 2, S1 - 0.03, Z1 - 0.03, g); // rail de la vitre
  const glass = phys({ color: '#d8eef5', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, envMapIntensity: 1.4 });
  // deux vitres coulissantes, rangées chacune à un bout (ouvertes)
  for (const px of [W0 + 0.36, W1 - 0.36]) {
    const pane = new THREE.Group();
    add(box(0.62, S1 - S0 - 0.08, 0.008, glass), 0, 0, 0, pane);
    for (const [w, h, x, y] of [[0.64, 0.025, 0, (S1 - S0) / 2 - 0.05], [0.64, 0.025, 0, -(S1 - S0) / 2 + 0.05], [0.025, S1 - S0 - 0.08, -0.31, 0], [0.025, S1 - S0 - 0.08, 0.31, 0]]) add(box(w, h, 0.02, alu), x, y, 0, pane);
    pane.position.set(px, (S0 + S1) / 2, Z1 - 0.045);
    pane.traverse((o) => { if (o.isMesh && o.material === glass) o.userData.noShadow = true; });
    g.add(pane);
  }

  // plan de travail (inox brossé, rebord arrondi) + crédence + meubles bas avec portes et poignées
  add(rbox(X1 - X0 - 0.1, 0.05, 0.74, 0.015, MAT.steel(6, 1)), (X0 + X1) / 2, 1.445, 0.79, g);
  add(box(X1 - X0 - 0.1, 0.025, 0.03, MAT.steel(6, 0.1)), (X0 + X1) / 2, 1.46, 0.43, g); // rebord avant
  const doorM = MAT.steel(1, 1), gap = std({ color: '#1d1f23', roughness: 0.8 });
  add(box(X1 - X0 - 0.1, 0.66, 0.6, gap), (X0 + X1) / 2, 1.08, 0.82, g);
  const handleM = std({ color: '#d9dde2', metalness: 0.9, roughness: 0.2 });
  for (let x = X0 + 0.05; x < X1 - 0.3; x += 0.62) {
    add(box(0.6, 0.6, 0.02, doorM), x + 0.31, 1.08, 0.51, g);
    add(cyl(0.008, 0.008, 0.36, handleM, 10), x + (Math.round((x - X0) / 0.62) % 2 ? 0.08 : 0.54), 1.25, 0.49, g).rotation.set(0, 0, 0);
  }
  add(box(X1 - X0 - 0.1, 0.08, 0.02, std({ color: '#15171a', roughness: 0.9 })), (X0 + X1) / 2, 0.79, 0.53, g); // plinthe

  // tablette extérieure (où l'on pose les commandes, côté clients)
  add(rbox(3.6, 0.05, 0.5, 0.015, MAT.steel(5, 1)), -0.9, 1.49, 1.45, g);

  // néon LED encastré au plafond
  add(box(2.4, 0.03, 0.18, std({ color: '#ffffff', emissive: '#fff6e6', emissiveIntensity: 1.3 })), -0.8, 2.975, 0.15, g);
  add(box(2.46, 0.02, 0.24, alu), -0.8, 2.985, 0.15, g);
}

/** Hotte d'aspiration au-dessus de la plaque, avec filtres et lampe. */
export function buildHood(g, x) {
  const hood = new THREE.Group();
  const steel = MAT.steel(1.5, 1);
  // caisson trapézoïdal : un grand bloc + un chanfrein vers le mur
  add(box(0.86, 0.22, 0.62, steel), 0, 0.11, 0, hood);
  const skirt = add(box(0.86, 0.06, 0.62, steel), 0, -0.03, 0, hood);
  skirt.scale.set(1, 1, 1);
  add(box(0.8, 0.01, 0.56, std({ map: filterTex(), metalness: 0.7, roughness: 0.5 })), 0, -0.065, 0, hood);
  add(box(0.06, 0.012, 0.03, std({ color: '#fff2d6', emissive: '#ffe2b0', emissiveIntensity: 1.2 })), 0.3, -0.07, -0.2, hood);
  add(box(0.06, 0.012, 0.03, std({ color: '#fff2d6', emissive: '#ffe2b0', emissiveIntensity: 1.2 })), -0.3, -0.07, -0.2, hood);
  add(box(0.22, 0.3, 0.2, steel), 0, 0.37, -0.05, hood); // conduit vers le toit
  hood.position.set(x, 2.56, 0.82);
  g.add(hood);
  return hood;
}

/** Plaque de cuisson (« plancha ») : caisson inox, plaque noircie, rigole à graisse, dosseret et boutons. */
export function buildGriddle(g, x, z) {
  const grp = new THREE.Group();
  const steel = MAT.steel(1, 1);
  add(box(0.66, 0.1, 0.56, steel), 0, 0.05, 0, grp);
  add(box(0.62, 0.014, 0.5, std({ map: griddleTex(), color: '#ffffff', metalness: 0.25, roughness: 0.48, envMapIntensity: 0.4 })), 0, 0.107, 0.01, grp);
  // dosseret et joues anti-éclaboussures
  // (le joueur est côté -z : dosseret côté fenêtre, boutons et rigole côté joueur)
  add(box(0.66, 0.1, 0.012, steel), 0, 0.15, 0.274, grp);
  for (const s of [-1, 1]) {
    // joues basses et biseautées (plus hautes au fond qu'à l'avant)
    const cheek = add(box(0.012, 0.05, 0.56, steel), s * 0.324, 0.13, 0, grp);
    cheek.rotation.x = -0.06;
  }
  // rigole à graisse à l'avant
  add(box(0.6, 0.012, 0.03, std({ color: '#1b1a19', metalness: 0.4, roughness: 0.5 })), 0, 0.1, -0.262, grp);
  // boutons de réglage (bakélite noire, repère blanc) en façade
  const knobM = std({ color: '#151515', roughness: 0.35 }), markM = std({ color: '#f2f2f2', roughness: 0.5 });
  for (const dx of [-0.2, 0, 0.2]) {
    const k = add(cyl(0.024, 0.026, 0.025, knobM, 20), dx, 0.05, -0.293, grp); k.rotation.x = Math.PI / 2;
    add(box(0.004, 0.018, 0.004, markM), dx, 0.058, -0.306, grp).rotation.z = rnd(-0.8, 0.8);
  }
  // petite flamme bleue de la veilleuse (visible sous le bord)
  add(box(0.03, 0.006, 0.01, std({ color: '#7fb0ff', emissive: '#3d7bff', emissiveIntensity: 2 })), 0.26, 0.012, -0.29, grp);
  grp.position.set(x, 1.47, z);
  g.add(grp);
  // pince et spatule posées à côté
  const tongM = std({ color: '#d3d7dc', metalness: 0.9, roughness: 0.25 });
  const tongs = new THREE.Group();
  for (const s of [-1, 1]) { const arm = add(box(0.26, 0.006, 0.014, tongM), 0, 0, s * 0.012, tongs); arm.rotation.y = s * 0.05; }
  add(box(0.06, 0.012, 0.03, std({ color: '#1f1f1f', roughness: 0.6 })), -0.12, 0, 0, tongs);
  tongs.position.set(x - 0.06, 1.485, 0.47); tongs.rotation.y = 0.15;
  g.add(tongs);
  return grp;
}

/** Barquette de saucisses crues : plastique blanc, film transparent à moitié retiré. */
export function buildPack(g, p, sausageGeo) {
  const tray = rbox(0.36, 0.045, 0.27, 0.012, std({ color: '#f5f5f2', roughness: 0.35 }));
  add(tray, p.x, p.y + 0.0, p.z, g);
  add(box(0.32, 0.004, 0.23, std({ color: '#f2e6e3', roughness: 0.9 })), p.x, p.y + 0.024, p.z, g); // buvard
  const raw = phys({ color: '#e7958c', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(sausageGeo, raw);
    s.position.set(p.x, p.y + 0.055, p.z - 0.09 + k * 0.06);
    s.rotation.y = rnd(-0.05, 0.05);
    g.add(s);
  }
  // film plastique replié
  const film = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), phys({ color: '#ffffff', transparent: true, opacity: 0.18, roughness: 0.1, side: THREE.DoubleSide }));
  film.position.set(p.x, p.y + 0.11, p.z - 0.17); film.rotation.x = -0.7;
  film.userData.noShadow = true;
  g.add(film);
}

/** Planche à découper en bois (avec rigole). */
export function buildBoard(g, p) {
  const b = rbox(0.54, 0.03, 0.34, 0.012, std({ map: woodTex(), color: '#ffffff', roughness: 0.75 }));
  add(b, p.x, 1.485, p.z, g);
}

/** Corbeille en osier, garnie d'un papier, avec des pains. */
export function buildBasket(g, p, makeBun) {
  const w = std({ map: wickerTex(), color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.11, 32, 1, true), w);
  add(wall, p.x, p.y + 0.03, p.z, g);
  add(cyl(0.15, 0.15, 0.01, w, 32), p.x, p.y - 0.02, p.z, g);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 40), std({ color: '#8a5d2f', roughness: 0.9 })), p.x, p.y + 0.085, p.z, g).rotation.x = Math.PI / 2;
  const paper = new THREE.Mesh(new THREE.CircleGeometry(0.2, 6), std({ color: '#f4ecd8', roughness: 0.95, side: THREE.DoubleSide }));
  paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.3;
  add(paper, p.x, p.y + 0.0, p.z, g);
  for (let k = 0; k < 4; k++) {
    const b = makeBun();
    b.position.set(p.x - 0.07 + (k % 2) * 0.1, p.y + 0.01 + (k > 1 ? 0.045 : 0), p.z - 0.06 + (k % 3) * 0.05);
    b.rotation.set(rnd(-0.1, 0.1), 0.4 + k * 0.55, rnd(-0.1, 0.1));
    b.scale.setScalar(0.92);
    g.add(b);
  }
}

/** Flacon souple (ketchup / moutarde) : corps tourné, étiquette, embout. */
export function buildBottle(g, x, z, color, name) {
  const b = new THREE.Group();
  const prof = [[0, 0], [0.04, 0], [0.045, 0.01], [0.046, 0.17], [0.04, 0.195], [0.02, 0.215], [0.016, 0.22]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.Mesh(new THREE.LatheGeometry(prof, 32), phys({ color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 })), 0, 0, 0, b);
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.0468, 0.0468, 0.085, 32, 1, true), std({ map: labelTex('#ffffff', color, name, L('SQUEEZE', 'SQUEEZE')), roughness: 0.6 }));
  add(lbl, 0, 0.09, 0, b);
  const capM = std({ color: color === '#c1121f' ? '#f1f1ea' : '#c1121f', roughness: 0.4 });
  add(cyl(0.018, 0.02, 0.03, capM, 20), 0, 0.232, 0, b);
  add(cyl(0.004, 0.014, 0.05, capM, 16), 0, 0.27, 0, b);
  b.position.set(x, 1.47, z);
  g.add(b);
  return b;
}

/** Bac gastro (1/6) en inox rempli d'oignons émincés. */
export function buildOnionPan(g, x, z) {
  const steel = MAT.steel(1, 1);
  const W = 0.18, D = 0.16, H = 0.07, t = 0.006;
  const pan = new THREE.Group();
  add(box(W, t, D, steel), 0, 0, 0, pan);
  add(box(W, H, t, steel), 0, H / 2, -D / 2, pan); add(box(W, H, t, steel), 0, H / 2, D / 2, pan);
  add(box(t, H, D, steel), -W / 2, H / 2, 0, pan); add(box(t, H, D, steel), W / 2, H / 2, 0, pan);
  for (const [w, d, x, z] of [[W + 0.024, 0.012, 0, -D / 2], [W + 0.024, 0.012, 0, D / 2], [0.012, D, -W / 2, 0], [0.012, D, W / 2, 0]]) add(box(w, 0.006, d, steel), x, H, z, pan); // rebord
  const onionM = phys({ color: '#efe7cf', roughness: 0.3, clearcoat: 0.3, transmission: 0, sheen: 0.3 });
  const piece = new THREE.BoxGeometry(0.016, 0.008, 0.016);
  const inst = new THREE.InstancedMesh(piece, onionM, 90);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 90; i++) {
    e.set(rnd(-0.6, 0.6), rnd(0, 3), rnd(-0.6, 0.6)); q.setFromEuler(e);
    m.compose(new THREE.Vector3(rnd(-W / 2 + 0.015, W / 2 - 0.015), H - 0.02 + rnd(0, 0.014), rnd(-D / 2 + 0.015, D / 2 - 0.015)), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m);
  }
  pan.add(inst);
  add(box(W - 0.01, 0.01, D - 0.01, std({ color: '#e5dcc2', roughness: 0.5 })), 0, H - 0.028, 0, pan); // fond d'oignons
  pan.position.set(x, 1.47, z);
  g.add(pan);
}

/** Poubelle inox à pédale. */
export function buildBin(g, x, z) {
  const bin = new THREE.Group();
  const steel = MAT.steel(2, 1);
  add(cyl(0.12, 0.11, 0.24, steel, 32), 0, 0.12, 0, bin);
  const lid = add(new THREE.Mesh(new THREE.SphereGeometry(0.122, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel), 0, 0.24, 0, bin);
  lid.scale.y = 0.25;
  add(box(0.08, 0.012, 0.05, MAT.darkSteel()), 0, 0.01, 0.13, bin); // pédale
  add(cyl(0.122, 0.122, 0.012, MAT.darkSteel(), 32), 0, 0.006, 0, bin);
  bin.position.set(x, 1.47, z);
  g.add(bin);
}

/** Accessoires : rail à tickets, essuie-tout, extincteur, épices, gobelets, distributeur de serviettes, sonnette. */
export function buildProps(g) {
  const steel = MAT.steel(1, 1);
  // rail à tickets au-dessus de la fenêtre (côté cuisine) avec deux bons de commande
  add(box(1.6, 0.03, 0.04, steel), -0.9, 2.86, 1.1, g);
  for (const [x, r] of [[-1.35, 0.06], [-0.55, -0.04]]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.16), std({ map: ticketTex(), roughness: 0.9, side: THREE.DoubleSide }));
    t.position.set(x, 2.77, 1.085); t.rotation.set(0, Math.PI, r);
    g.add(t);
  }
  // de chaque côté de la fenêtre (en miroir) : dérouleur d'essuie-tout, étagère à épices, extincteur au mur du bout
  for (const d of [-1, 1]) {
    const x = -0.9 + d * 1.92;
    add(box(0.3, 0.02, 0.1, steel), x, 2.0, 1.08, g);
    const roll = add(cyl(0.055, 0.055, 0.24, std({ color: '#f7f5ef', roughness: 0.95 }), 28), x, 1.93, 1.06, g); roll.rotation.z = Math.PI / 2;
    add(box(0.6, 0.02, 0.12, steel), x, 2.3, 1.08, g);
    ['#b23a1e', '#d4a017', '#5b7d2a', '#7a4b2a', '#ece3cf'].forEach((c, k) => {
      const sx = x - 0.22 + k * 0.11;
      add(cyl(0.025, 0.025, 0.1, phys({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05 }), 16), sx, 2.36, 1.08, g);
      add(cyl(0.022, 0.022, 0.07, std({ color: c, roughness: 0.9 }), 16), sx, 2.35, 1.08, g);
      add(cyl(0.026, 0.026, 0.02, std({ color: '#2b2b2b', roughness: 0.5 }), 16), sx, 2.42, 1.08, g);
    });
  }
  // extincteur rouge sur son support
  const ext = new THREE.Group();
  add(cyl(0.055, 0.055, 0.34, std({ color: '#c3161c', roughness: 0.35, metalness: 0.2 }), 24), 0, 0.17, 0, ext);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#c3161c', roughness: 0.35 })), 0, 0.34, 0, ext);
  add(cyl(0.015, 0.02, 0.05, std({ color: '#222', roughness: 0.5 }), 12), 0, 0.39, 0, ext);
  add(box(0.08, 0.015, 0.02, std({ color: '#222', roughness: 0.5 })), 0.03, 0.41, 0, ext);
  add(box(0.06, 0.08, 0.003, std({ color: '#ffffff', roughness: 0.8 })), 0, 0.2, 0.055, ext);
  ext.position.set(1.32, 1.2, -0.3); // (au mur, au bout du camion)
  g.add(ext);
  const ext2 = ext.clone(); ext2.position.set(-3.12, 1.2, -0.3); g.add(ext2);
  // tablette extérieure : distributeur de serviettes, pile de gobelets et sonnette
  const napkin = new THREE.Group();
  add(rbox(0.14, 0.12, 0.1, 0.01, std({ color: '#d9dde2', metalness: 0.85, roughness: 0.25 })), 0, 0.06, 0, napkin);
  add(box(0.1, 0.03, 0.005, std({ color: '#ffffff', roughness: 0.95 })), 0, 0.07, 0.052, napkin);
  napkin.position.set(0.35, 1.515, 1.48); g.add(napkin);
  for (let k = 0; k < 6; k++) add(cyl(0.04, 0.03, 0.1, std({ color: '#f6f1e7', roughness: 0.7 }), 20), -1.75, 1.565 + k * 0.012, 1.5, g);
  add(cyl(0.05, 0.06, 0.02, steel, 20), -2.1, 1.525, 1.4, g);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#d9b26f', roughness: 0.25, metalness: 0.9 })), -2.1, 1.535, 1.4, g);
}

/** Barquette à hot-dog en carton à damier. */
export function makeTray() {
  const m = std({ map: checkTex(), roughness: 0.85, side: THREE.DoubleSide });
  const t = new THREE.Group();
  const L0 = 0.27, W = 0.09, H = 0.035;
  add(box(L0, 0.003, W, m), 0, 0.0015, 0, t);
  for (const s of [-1, 1]) {
    const wall = add(box(L0, H, 0.003, m), 0, H / 2, s * (W / 2 + 0.006), t); wall.rotation.x = s * 0.35;
    const end = add(box(0.003, H, W, m), s * (L0 / 2 + 0.006), H / 2, 0, t); end.rotation.z = -s * 0.35;
  }
  return t;
}

/* ---------------- Aliments ---------------- */

/** Saucisse légèrement courbée (le long de x), bouts arrondis. */
export function sausageGeometry() {
  const geo = new THREE.CapsuleGeometry(0.03, 0.2, 8, 20);
  geo.rotateZ(Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + 0.55 * x * x); }
  geo.computeVertexNormals();
  return geo;
}

/** Pain à hot-dog : base dorée + deux lèvres ouvertes, mie claire visible au milieu. */
export function makeBun() {
  const g = new THREE.Group();
  const crust = phys({ color: '#c4833f', roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color('#ffd9a0') });
  const crumb = std({ color: '#f1ddb1', roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.2, 8, 20), crust);
  base.rotation.z = Math.PI / 2; base.scale.set(0.6, 1, 1.15);
  add(base, 0, 0.028, 0, g);
  for (const s of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 8, 20), crust);
    lip.rotation.set(s * 0.35, 0, Math.PI / 2); lip.scale.set(1, 1, 0.75);
    add(lip, 0, 0.055, s * 0.033, g);
  }
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 6, 16), crumb), 0, 0.05, 0, g).rotation.z = Math.PI / 2;
  return g;
}

/* ---------------- Équipement du camion à hot-dogs (s'affiche quand on l'achète) ---------------- */

const PAN_CONTENT = {
  chicken: { color: '#e2c08a', shape: 'dice' },
  beef: { color: '#6a3a22', shape: 'dice' },
  salad: { color: '#7fbf4a', shape: 'leaf' },
  tomato: { color: '#d8402e', shape: 'dice' },
  cheddar: { color: '#f2a516', shape: 'dice' },
  salsa: { color: '#c23a24', shape: 'stew' },
  guac: { color: '#8fbf3a', shape: 'stew' },
  piment: { color: '#b0201a', shape: 'dice' },
  lime: { color: '#9ccf3a', shape: 'disc' },
  sauce: { color: '#b3231a', shape: 'stew' },
  mozza: { color: '#f4f1e6', shape: 'dice' },
  basil: { color: '#3f7f2a', shape: 'leaf' },
  ham: { color: '#e79a8e', shape: 'slice' },
  mushrooms: { color: '#d9c4a0', shape: 'disc' },
  cheeses: { color: '#f2c14e', shape: 'dice' },
  olives: { color: '#262420', shape: 'ring' },
  oregano: { color: '#5d7a2e', shape: 'dice' },
  onions: { color: '#efe7cf', shape: 'dice' },
  friedonions: { color: '#a86a2a', shape: 'dice' },
  pickles: { color: '#6f9a3a', shape: 'disc' },
  jalapenos: { color: '#3f8a2a', shape: 'ring' },
  cheese: { color: '#f2a516', shape: 'slice' },
  chili: { color: '#7a2a14', shape: 'stew' },
  bacon: { color: '#a8452c', shape: 'strip' },
};

/** Bac gastro en inox (rail de garnitures) avec son contenu. */
export function buildPan(g, x, z, kind) {
  const steel = MAT.steel(1, 1);
  const W = 0.115, D = 0.16, H = 0.07, t = 0.005;
  const pan = new THREE.Group();
  add(box(W, t, D, steel), 0, 0, 0, pan);
  add(box(W, H, t, steel), 0, H / 2, -D / 2, pan); add(box(W, H, t, steel), 0, H / 2, D / 2, pan);
  add(box(t, H, D, steel), -W / 2, H / 2, 0, pan); add(box(t, H, D, steel), W / 2, H / 2, 0, pan);
  const c = PAN_CONTENT[kind];
  const m = phys({ color: c.color, roughness: kind === 'chili' ? 0.25 : 0.5, clearcoat: kind === 'chili' || kind === 'pickles' ? 0.6 : 0.1 });
  add(box(W - 0.01, 0.01, D - 0.01, m), 0, H - 0.025, 0, pan); // fond de garniture
  const n = { dice: 40, disc: 14, ring: 14, slice: 6, stew: 0, strip: 7, leaf: 12 }[c.shape];
  if (c.shape === 'stew') {
    // chili : surface brillante bombée + louche
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m), 0, H - 0.03, 0, pan).scale.set(0.9, 0.25, 1.25);
    const ladle = new THREE.Group();
    add(cyl(0.004, 0.004, 0.2, std({ color: '#c9ced4', metalness: 0.9, roughness: 0.25 }), 8), 0, 0.1, 0, ladle);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ color: '#c9ced4', metalness: 0.9, roughness: 0.25 })), 0, 0, 0, ladle);
    ladle.position.set(0.02, H - 0.02, 0.03); ladle.rotation.set(-0.5, 0, 0.3);
    pan.add(ladle);
  }
  for (let i = 0; i < n; i++) {
    let piece;
    if (c.shape === 'dice') piece = box(0.014, 0.008, 0.014, m);
    else if (c.shape === 'disc') piece = cyl(0.016, 0.016, 0.005, m, 12);
    else if (c.shape === 'ring') piece = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), m);
    else if (c.shape === 'slice') piece = box(0.085, 0.004, 0.085, m);
    else if (c.shape === 'leaf') { piece = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), m); piece.scale.set(1, 0.25, 0.6); }
    else piece = box(0.09, 0.005, 0.02, m);
    piece.position.set(rnd(-W / 2 + 0.02, W / 2 - 0.02) * (c.shape === 'slice' || c.shape === 'strip' ? 0.2 : 1), H - 0.018 + (c.shape === 'slice' ? i * 0.005 : rnd(0, 0.01)), rnd(-D / 2 + 0.02, D / 2 - 0.02) * (c.shape === 'slice' ? 0.2 : 1));
    piece.rotation.set(c.shape === 'ring' ? Math.PI / 2 : rnd(-0.3, 0.3), rnd(0, 3), 0);
    pan.add(piece);
  }
  pan.position.set(x, 1.47, z);
  g.add(pan);
  return pan;
}

/** Chauffe-pains : petite vitrine inox chauffée (lueur orange), pains à l'intérieur. */
export function buildWarmer(g, x, z, makeBun) {
  const w = new THREE.Group();
  const steel = MAT.steel(1, 1);
  add(rbox(0.3, 0.22, 0.26, 0.015, steel), 0, 0.11, 0, w);
  add(box(0.26, 0.17, 0.005, phys({ color: '#ffe2b8', transparent: true, opacity: 0.25, roughness: 0.05 })), 0, 0.12, 0.131, w).userData.noShadow = true;
  add(box(0.26, 0.01, 0.22, std({ color: '#ff8a3a', emissive: '#ff6a1a', emissiveIntensity: 1.2 })), 0, 0.2, 0, w); // résistance
  for (let k = 0; k < 3; k++) { const b = makeBun(); b.scale.setScalar(0.8); b.position.set(0, 0.04 + k * 0.05, 0); b.rotation.y = Math.PI / 2 + k * 0.1; w.add(b); }
  w.position.set(x, 1.47, z);
  g.add(w);
  return w;
}

/** Distributeur de sauces : trois flacons à pompe fixés au mur. */
export function buildDispenser(g, x, y, z) {
  const d = new THREE.Group();
  const steel = MAT.steel(1, 1);
  add(box(0.36, 0.02, 0.14, steel), 0, 0, 0, d);
  add(box(0.36, 0.3, 0.02, steel), 0, 0.15, -0.06, d);
  ['#c1121f', '#e8b400', '#f1e6c8'].forEach((c, k) => {
    const xx = -0.11 + k * 0.11;
    add(cyl(0.035, 0.035, 0.18, phys({ color: c, roughness: 0.3, clearcoat: 0.6 }), 16), xx, 0.1, 0, d);
    add(cyl(0.012, 0.012, 0.05, std({ color: '#222', roughness: 0.5 }), 10), xx, 0.215, 0, d);
    add(box(0.05, 0.012, 0.02, std({ color: '#222', roughness: 0.5 })), xx, 0.245, 0.015, d);
  });
  d.position.set(x, y, z);
  g.add(d);
  return d;
}

/** Enseigne néon « HOT-DOGS » sur la carrosserie (dehors), de plus en plus lumineuse avec les niveaux. */
export function buildNeon(g, x, y, z, text = 'HOT-DOGS') {
  const tex = canvasTex(512, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = '900 92px "Arial Black", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ff2d8a'; c.shadowBlur = 30; c.fillStyle = '#ffd1ea'; c.fillText(text, w / 2, h / 2 + 4, w - 20);
    c.shadowBlur = 0; c.lineWidth = 6; c.strokeStyle = '#ff5fb0'; c.strokeText(text, w / 2, h / 2 + 4, w - 20);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.6, transparent: true, alphaTest: 0.05, roughness: 0.4 });
  const n = new THREE.Group();
  add(box(0.92, 0.32, 0.02, std({ color: '#1b1a24', roughness: 0.6 })), 0, 0, -0.012, n);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.28), mat);
  face.position.z = 0.001; n.add(face);
  n.userData.mat = mat;
  n.position.set(x, y, z);
  g.add(n);
  return n;
}

/** Saucisse géante (modèle « hot-dog géant ») : même forme, plus longue et plus épaisse. */
export function giantSausageGeometry() {
  const g = sausageGeometry();
  g.scale(1.4, 1.2, 1.2);
  return g;
}


/* ---------------- La pizzeria (camion n°2) ---------------- */

/* ----- Pizza : textures et formes partagées ----- */

/** Pâte : beige avec de petites traces de farine et des bulles. */
const doughTex = once(() => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '190,160,120'},${rnd(0.08, 0.25)})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(0.5, 2.2), 0, 7); g.fill(); }
}));
/** Croûte cuite : taches « léopard » brun foncé (transparent ailleurs), seulement sur le bord. */
const charTex = once(() => canvasTex(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * w, y = rnd(0.28, 0.72) * h, r = rnd(2, 9);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(45,22,10,.95)'); gr.addColorStop(0.6, 'rgba(90,45,18,.55)'); gr.addColorStop(1, 'rgba(120,60,20,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // dorure générale du bord
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0.22, 'rgba(150,80,25,0)'); lg.addColorStop(0.45, 'rgba(150,80,25,.35)'); lg.addColorStop(0.55, 'rgba(150,80,25,.35)'); lg.addColorStop(0.78, 'rgba(150,80,25,0)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
}));
/** Sauce tomate : rouge avec des morceaux de tomate plus sombres, des reflets d'huile et des herbes. */
const sauceTex = once(() => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b3261a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? `rgba(120,15,10,${rnd(0.2, 0.5)})` : `rgba(230,80,40,${rnd(0.15, 0.4)})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(2, 7), rnd(1.5, 5), Math.random() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(40,70,20,${rnd(0.4, 0.8)})`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 2.5), rnd(1, 2.5)); }
}));
/** Cercle irrégulier (bord de sauce, tranche de jambon…). */
function wobblyShape(r, n = 40, amp = 0.06, sx = 1, sz = 1) {
  const s = new THREE.Shape(), ph = Math.random() * 6, ph2 = Math.random() * 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + amp * (Math.sin(a * 3 + ph) * 0.6 + Math.sin(a * 7 + ph2) * 0.4);
    const x = Math.cos(a) * r * k * sx, y = Math.sin(a) * r * k * sz;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}
/** Forme plate posée à plat (ShapeGeometry tournée vers le haut). */
const flatShape = (shape, mat) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat); m.rotation.x = -Math.PI / 2; return m; };
/** Petit « pâté » bosselé (fromage, viande hachée…). */
function lump(size, mat, flat = 0.4, detail = 1) {
  // (bosses calculées à partir de la direction : un même sommet partagé par plusieurs faces bouge pareil, pas de trous)
  const geo = new THREE.IcosahedronGeometry(size, detail), p = geo.attributes.position, s = [rnd(2, 5), rnd(2, 5), rnd(0, 6)];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / size, y = p.getY(i) / size, z = p.getZ(i) / size;
    const k = 1 + 0.16 * Math.sin(x * s[0] + s[2]) * Math.cos(z * s[1] - s[2]) + 0.08 * Math.sin(y * 4 + x * 3);
    p.setXYZ(i, x * size * k, y * size * k * flat, z * size * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}
/** Tranche de champignon vue de dessus : chapeau arrondi + pied. */
const mushroomShape = once(() => {
  const s = new THREE.Shape();
  s.moveTo(-0.018, 0); s.quadraticCurveTo(-0.019, 0.016, 0, 0.018); s.quadraticCurveTo(0.019, 0.016, 0.018, 0);
  s.lineTo(0.006, 0); s.lineTo(0.0065, -0.014); s.quadraticCurveTo(0, -0.017, -0.0065, -0.014); s.lineTo(-0.006, 0); s.lineTo(-0.018, 0);
  return s;
});
/** Feuille (basilic) : ovale pointu, nervure au milieu. */
const leafShape = once(() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.018); s.quadraticCurveTo(0.014, -0.006, 0, 0.02); s.quadraticCurveTo(-0.014, -0.006, 0, -0.018);
  return s;
});

/**
 * Une pizza qui se prépare : boule de pâte → pâte étalée (bord gonflé) → sauce, fromage, garnitures → cuisson
 * (la croûte dore et se tache de brun, le fromage fond) → découpe en 6 parts.
 * Renvoie { group, setStretch(k), add(item), setBake(v), cut() }.
 */
export function createPizza(r = 0.15) {
  const group = new THREE.Group();
  const doughM = phys({ color: '#f1dcae', map: doughTex(), side: THREE.DoubleSide, roughness: 0.85, sheen: 0.4, sheenColor: new THREE.Color('#fff3da') });
  const ball = lump(0.06, doughM, 0.62, 3);
  ball.position.y = 0.035; group.add(ball);
  // pâte étalée : profil tourné (centre fin, bord gonflé et irrégulier)
  const prof = [[0, 0.006], [0.84, 0.007], [0.9, 0.014], [0.95, 0.026], [1.0, 0.03], [1.05, 0.025], [1.08, 0.013], [1.075, 0.002], [0.9, 0], [0, 0]];
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * r, y)), 56);
  const p = geo.attributes.position, ph = [Math.random() * 6, Math.random() * 6];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
    if (d < 0.8 * r) continue;
    const a = Math.atan2(z, x), k = 1 + 0.025 * Math.sin(a * 5 + ph[0]) + 0.015 * Math.sin(a * 11 + ph[1]);
    p.setXYZ(i, x * k, p.getY(i) * (1 + 0.25 * Math.sin(a * 4 + ph[1])), z * k);
  }
  geo.computeVertexNormals();
  const base = new THREE.Group(); group.add(base);
  base.add(new THREE.Mesh(geo, doughM));
  const charM = std({ map: charTex(), side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9 });
  base.add(new THREE.Mesh(geo, charM));
  const layers = new THREE.Group(); layers.position.y = 0.007; group.add(layers);
  // découpe : 3 fines lignes (6 parts), visibles seulement sur la pizza
  const cuts = new THREE.Group(); cuts.visible = false; group.add(cuts);
  const cutM = std({ color: '#5b2a12', transparent: true, opacity: 0.55, roughness: 1, depthWrite: false });
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(2 * r * 0.96, 0.0035), cutM); c.rotation.x = -Math.PI / 2; c.rotation.z = (k * Math.PI) / 3; c.position.y = 0.034; cuts.add(c); }
  const melt = []; // fromages : { mesh, mat, s } (fondent à la cuisson)
  const sauceMats = [];
  const R = (k = 0.78) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * k; return [Math.cos(a) * d, Math.sin(a) * d]; };
  const scatter = (n, make, y) => { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const m = make(i); const [x, z] = R(); m.position.set(x, y + Math.random() * 0.002, z); m.rotation.y = Math.random() * 6; g.add(m); } layers.add(g); return g; };
  let level = 0; // chaque garniture se pose un peu au-dessus de la précédente
  const api = {
    group, r,
    setStretch(k) {
      ball.visible = k < 1; base.visible = k > 0;
      ball.scale.set(1 + k * 0.6, 1 - k * 0.7, 1 + k * 0.6);
      const s = Math.max(0.05, k); base.scale.set(s, 0.5 + 0.5 * s, s);
    },
    add(t) {
      level += 0.0015;
      const y = level;
      if (t === 'sauce') {
        const m = new THREE.Mesh(new THREE.ShapeGeometry(wobblyShape(r * 0.86, 48, 0.035)), phys({ map: sauceTex(), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4 }));
        m.rotation.x = -Math.PI / 2; m.position.y = y; layers.add(m); sauceMats.push(m.material); return;
      }
      if (t === 'mozza' || t === 'cheeses') {
        const cols = t === 'mozza' ? ['#f7f3e6'] : ['#f6efd8', '#f2c14e', '#e8a33a'];
        const n = t === 'mozza' ? 10 : 15;
        scatter(n, (i) => {
          const mat = phys({ color: cols[i % cols.length], roughness: 0.42, clearcoat: 0.35, sheen: 0.3 });
          const s = t === 'mozza' ? rnd(0.018, 0.026) : rnd(0.011, 0.017);
          const m = lump(s, mat, 0.45); melt.push({ mesh: m, mat, base: mat.color.clone() }); return m;
        }, y + 0.004);
        return;
      }
      if (t === 'basil') {
        const mat = phys({ color: '#2f7a26', roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide });
        scatter(5, () => { const l = flatShape(leafShape(), mat); l.rotation.z = Math.random() * 6; l.scale.setScalar(rnd(0.9, 1.25)); return l; }, y + 0.016);
        return;
      }
      if (t === 'ham') {
        const mat = phys({ color: '#e48f86', roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffd2c8'), side: THREE.DoubleSide });
        const fat = std({ color: '#f6dcd2', roughness: 0.6, side: THREE.DoubleSide });
        scatter(6, () => {
          const g = new THREE.Group(), sh = wobblyShape(0.019, 20, 0.12, 1.3, 0.9);
          const top = flatShape(sh, mat); top.position.y = 0.001; g.add(top);
          const rim = flatShape(sh, fat); rim.scale.setScalar(1.12); g.add(rim);
          g.rotation.x = rnd(-0.12, 0.12); return g;
        }, y + 0.012);
        return;
      }
      if (t === 'mushrooms') {
        const mat = std({ color: '#e3d2b2', roughness: 0.7, side: THREE.DoubleSide }), edge = std({ color: '#8a6a48', roughness: 0.8, side: THREE.DoubleSide });
        scatter(7, () => { const g = new THREE.Group(); const a = flatShape(mushroomShape(), mat); a.position.y = 0.0008; g.add(a); const b = flatShape(mushroomShape(), edge); b.scale.setScalar(1.12); g.add(b); g.scale.setScalar(rnd(0.9, 1.15)); return g; }, y + 0.013);
        return;
      }
      if (t === 'olives') {
        const mat = phys({ color: '#1f1d1a', roughness: 0.25, clearcoat: 0.8 });
        scatter(8, () => { const o = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0042, 8, 16), mat); o.rotation.x = Math.PI / 2; return o; }, y + 0.016);
        return;
      }
      if (t === 'oregano') { const mat = std({ color: '#4f6d24', roughness: 0.9 }); scatter(40, () => box(rnd(0.002, 0.004), 0.0015, rnd(0.002, 0.004), mat), y + 0.018); }
    },
    setBake(v) {
      // pâte pâle → dorée (taches brunes sur le bord) → brûlée ; le fromage fond, s'étale et dore par endroits
      const k = Math.max(0, Math.min(1, v)), b = Math.max(0, v - 1.2);
      doughM.color.copy(new THREE.Color('#f1dcae').lerp(new THREE.Color('#e0a35a'), k).lerp(new THREE.Color('#3a2414'), Math.min(1, b * 1.6)));
      charM.opacity = Math.min(1, k * 0.9 + b);
      for (const m of sauceMats) m.color.copy(new THREE.Color('#ffffff').lerp(new THREE.Color('#9a6a5a'), Math.min(1, k * 0.25 + b)));
      for (const c of melt) {
        c.mesh.scale.set(1 + k * 0.7, 1 - k * 0.55, 1 + k * 0.7);
        c.mat.color.copy(c.base).lerp(new THREE.Color('#f0c86a'), k * 0.18).lerp(new THREE.Color('#5a3418'), Math.min(1, b * 1.2));
      }
    },
    cut() { cuts.visible = true; },
  };
  api.setStretch(0);
  return api;
}

/** Four à pizza posé sur le plan de travail : caisson inox, ouverture côté cuisinier, intérieur qui rougeoie, sole en pierre. */
export function buildPizzaOven(g, x, z) {
  const o = new THREE.Group();
  const steel = MAT.steel(1, 1), dark = std({ color: '#26231f', roughness: 0.7 });
  add(rbox(0.5, 0.06, 0.48, 0.015, steel), 0, 0.03, 0, o);                // socle
  add(rbox(0.5, 0.05, 0.48, 0.015, steel), 0, 0.33, 0, o);                // toit
  add(box(0.5, 0.26, 0.02, steel), 0, 0.18, 0.23, o);                     // fond (côté fenêtre)
  for (const sx of [-1, 1]) add(box(0.02, 0.26, 0.48, steel), sx * 0.24, 0.18, 0, o);
  add(box(0.46, 0.012, 0.44, std({ color: '#8a6a52', roughness: 0.95 })), 0, 0.066, 0, o); // sole en pierre
  const glowM = std({ color: '#ff8a3a', emissive: '#ff5a10', emissiveIntensity: 1.2 });
  add(box(0.44, 0.01, 0.4, glowM), 0, 0.3, 0, o);                         // résistance du haut
  add(box(0.5, 0.05, 0.02, dark), 0, 0.31, -0.24, o);                     // bandeau avant
  add(cyl(0.012, 0.012, 0.03, std({ color: '#111', roughness: 0.4 }), 10), 0.18, 0.31, -0.255, o).rotation.x = Math.PI / 2;
  add(box(0.04, 0.012, 0.006, std({ color: '#ff3a2a', emissive: '#ff2a1a', emissiveIntensity: 2 })), -0.16, 0.31, -0.252, o); // voyant
  o.position.set(x, 1.47, z);
  g.add(o);
  o.userData.glow = glowM;
  return o;
}

/** Bac de boules de pâte. */
export function buildDoughTray(g, x, z) {
  const t = new THREE.Group();
  add(rbox(0.36, 0.05, 0.26, 0.012, std({ color: '#e9e4d8', roughness: 0.45 })), 0, 0.025, 0, t);
  const m = phys({ color: '#f1dcae', roughness: 0.8, sheen: 0.3 });
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), m); b.scale.y = 0.6; b.position.set(-0.11 + (k % 3) * 0.11, 0.075, -0.06 + Math.floor(k / 3) * 0.12); t.add(b); }
  // farine saupoudrée
  add(box(0.32, 0.002, 0.22, std({ color: '#fbfaf5', roughness: 1, transparent: true, opacity: 0.55 })), 0, 0.052, 0, t);
  t.position.set(x, 1.47, z);
  g.add(t);
  return t;
}

/** Planche ronde en bois pour étaler et couper la pizza. */
export function buildRoundBoard(g, x, z) {
  const b = add(cyl(0.2, 0.2, 0.025, std({ map: woodTex(), color: '#ffffff', roughness: 0.75 }), 40), x, 1.482, z, g);
  return b;
}

/** Roulette à pizza. */
export function buildCutter(g, x, z) {
  const c = new THREE.Group();
  add(cyl(0.012, 0.012, 0.12, std({ color: '#c1121f', roughness: 0.5 }), 12), 0, 0.012, -0.06, c).rotation.x = Math.PI / 2;
  const wheel = add(cyl(0.035, 0.035, 0.004, std({ color: '#d3d7dc', metalness: 0.9, roughness: 0.2 }), 28), 0, 0.036, 0.03, c);
  wheel.rotation.z = Math.PI / 2;
  c.position.set(x, 1.47, z); c.rotation.y = 0.4;
  g.add(c);
  return c;
}

/** Pile de cartons à pizza. */
export function buildPizzaBoxes(g, x, z, n = 6) {
  const m = std({ color: '#c9a273', roughness: 0.9 }), top = std({ color: '#d93a2b', roughness: 0.8 });
  for (let k = 0; k < n; k++) add(box(0.2, 0.03, 0.2, k === n - 1 ? top : m), x, 1.486 + k * 0.031, z, g).rotation.y = (Math.random() - 0.5) * 0.1;
}

/** Sac de farine (décor). */
export function buildFlour(g, x, z) {
  const s = add(rbox(0.2, 0.28, 0.14, 0.04, std({ color: '#efe8d6', roughness: 0.95 })), x, 1.61, z, g);
  add(box(0.12, 0.06, 0.002, std({ color: '#2a6f97', roughness: 0.8 })), x, 1.63, z - 0.071, g);
  return s;
}


/* ---------------- La taqueria (camion n°3) ---------------- */

/** Tortilla : crème avec de petits grains de maïs. */
const tortTex = once(() => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '200,170,110' : '255,250,235'},${rnd(0.1, 0.3)})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(0.6, 2), 0, 7); g.fill(); }
}));
/** Tortilla chauffée : taches grillées (transparent ailleurs). */
const toastTex = once(() => canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rnd(3, 12);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(80,40,12,.85)'); gr.addColorStop(0.5, 'rgba(140,80,30,.45)'); gr.addColorStop(1, 'rgba(160,100,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
}));
/** Disque en grille polaire (pour pouvoir le plier). */
function polarDisc(r, rings = 10, seg = 48) {
  const pos = [], uv = [], idx = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) for (let j = 0; j < seg; j++) {
    const a = (j / seg) * Math.PI * 2, d = (i / rings) * r;
    pos.push(Math.cos(a) * d, 0, Math.sin(a) * d); uv.push(0.5 + Math.cos(a) * d / (2 * r), 0.5 + Math.sin(a) * d / (2 * r));
  }
  const at = (i, j) => (i === 0 ? 0 : 1 + (i - 1) * seg + (j % seg));
  for (let j = 0; j < seg; j++) idx.push(0, at(1, j + 1), at(1, j));
  for (let i = 1; i < rings; i++) for (let j = 0; j < seg; j++) idx.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.userData.flat = Float32Array.from(pos);
  geo.computeVertexNormals();
  return geo;
}
/**
 * Coupe d'un taco plié : fond arrondi étroit (rayon RS) puis bords presque droits qui s'écartent un peu.
 * s = distance depuis le milieu de la tortilla (le long de la tortilla) → [écart z, hauteur y].
 */
const TACO_A0 = 0.9 * Math.PI / 2;
function tacoProfile(s, RS) {
  const a = Math.abs(s), sg = Math.sign(s) || 1, s0 = RS * TACO_A0;
  if (a <= s0) { const t = a / RS; return [sg * RS * Math.sin(t), RS * (1 - Math.cos(t))]; }
  return [sg * (RS * Math.sin(TACO_A0) + (a - s0) * Math.cos(TACO_A0)), RS * (1 - Math.cos(TACO_A0)) + (a - s0) * Math.sin(TACO_A0)];
}
/** Demi-largeur de l'intérieur du taco à la hauteur y. */
function tacoHalf(y, RS) {
  const yA = RS * (1 - Math.cos(TACO_A0));
  if (y <= yA) return RS * Math.sin(Math.acos(1 - Math.max(0, y) / RS));
  return RS * Math.sin(TACO_A0) + (y - yA) / Math.tan(TACO_A0);
}
/** Plie le disque autour de l'axe X : k = 0 à plat, k = 1 en taco. */
function bendDisc(geo, r, k) {
  const p = geo.attributes.position, f = geo.userData.flat, RS = r * 0.2;
  for (let i = 0; i < p.count; i++) {
    const x = f[i * 3], z = f[i * 3 + 2], [zf, yf] = tacoProfile(z, RS);
    p.setXYZ(i, x, yf * k, z + (zf - z) * k);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

/**
 * Un taco qui se prépare : tortilla qu'on chauffe (elle dore et se tache), garnitures posées au milieu,
 * puis pliage en « U » : la garniture se tasse au fond et dépasse un peu en haut.
 * Renvoie { group, setWarm(v), add(item), fold(), folded }.
 */
export function createTaco(r = 0.11) {
  const group = new THREE.Group();
  const geo = polarDisc(r);
  const tortM = phys({ color: '#f0deb0', map: tortTex(), roughness: 0.85, sheen: 0.35, sheenColor: new THREE.Color('#fff2d0'), side: THREE.DoubleSide });
  const toastM = std({ map: toastTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9, side: THREE.DoubleSide });
  const shell = new THREE.Group(); shell.position.y = 0.002; group.add(shell);
  shell.add(new THREE.Mesh(geo, tortM)); shell.add(new THREE.Mesh(geo, toastM));
  const fill = new THREE.Group(); group.add(fill);
  const pieces = []; // { m, flat: [x,y,z], layer }
  let layer = 0;
  const put = (m, x, z, h = 0) => { m.position.set(x, 0.006 + layer * 0.002 + h, z); pieces.push({ m, flat: [x, m.position.y, z], layer, h, j: Math.random() * 0.9 }); fill.add(m); };
  const strip = () => [(Math.random() - 0.5) * r * 1.45, (Math.random() - 0.5) * r * 0.5];
  const many = (n, make) => { for (let i = 0; i < n; i++) { const m = make(i); const [x, z] = strip(); m.rotation.y = Math.random() * 6; put(m, x, z, Math.random() * 0.003); } };
  let foldK = 0, foldTo = 0, lastT = 0;
  const applyFold = (k) => {
    bendDisc(geo, r, k);
    const RS = r * 0.2, top = Math.max(1, layer);
    for (const p of pieces) {
      // dans le « U » : la garniture se range en couches (la première au fond, la dernière en haut),
      // sans dépasser les bords de la tortilla (plus bas vers les extrémités du taco)
      const xF = p.flat[0] * 0.82;
      const wall = tacoProfile(Math.sqrt(Math.max(0, r * r - xF * xF)), RS)[1];
      const yF = Math.min(0.008 + ((p.layer - p.j) / top) * wall * 1.02 + p.h, wall + 0.012); // la garniture dépasse un peu
      const half = tacoHalf(yF, RS) * 0.72;
      const zF = THREE.MathUtils.clamp(p.flat[2] / (r * 0.25), -1, 1) * half;
      p.m.position.set(p.flat[0] + (xF - p.flat[0]) * k, p.flat[1] + (yF - p.flat[1]) * k, p.flat[2] + (zF - p.flat[2]) * k);
    }
  };
  // le pliage s'anime tout seul (≈ 0,35 s) dès que fold() est appelé
  shell.children[0].onBeforeRender = () => {
    const t = performance.now() / 1000, dt = lastT ? Math.min(0.1, t - lastT) : 0; lastT = t;
    if (foldK === foldTo) return;
    foldK = Math.min(foldTo, foldK + dt / 0.35);
    applyFold(foldK);
  };
  const api = {
    group, r, folded: false,
    setWarm(v) {
      const k = Math.max(0, Math.min(1, v)), b = Math.max(0, v - 1.3);
      tortM.color.copy(new THREE.Color('#f0deb0').lerp(new THREE.Color('#e6bd7a'), k).lerp(new THREE.Color('#3a2414'), Math.min(1, b * 1.5)));
      toastM.opacity = Math.min(1, k * 0.85 + b);
    },
    add(t) {
      layer += 1;
      if (t === 'chicken') { const mats = ['#d9a865', '#c98f4c', '#e6c08a'].map((c) => phys({ color: c, roughness: 0.6, sheen: 0.3 })); many(11, (i) => { const m = rbox(rnd(0.022, 0.03), 0.008, rnd(0.008, 0.011), 0.003, mats[i % 3]); return m; }); return; }
      if (t === 'beef') { const mats = ['#5e321d', '#6e3d24', '#4a2716'].map((c) => std({ color: c, roughness: 0.75 })); many(16, (i) => lump(rnd(0.006, 0.009), mats[i % 3], 0.7, 0)); return; }
      if (t === 'salad') { const mats = ['#7cc24a', '#a3d867', '#5fa83a'].map((c) => std({ color: c, roughness: 0.6 })); many(16, (i) => box(rnd(0.022, 0.034), 0.002, 0.004, mats[i % 3])); return; }
      if (t === 'tomato') { const mat = phys({ color: '#d3362a', roughness: 0.35, clearcoat: 0.5 }); many(10, () => rbox(0.009, 0.008, 0.009, 0.002, mat)); return; }
      if (t === 'onions') { const mat = phys({ color: '#f3eedf', roughness: 0.3, transmission: 0.2, clearcoat: 0.4 }); many(12, () => rbox(0.007, 0.005, 0.007, 0.0015, mat)); return; }
      if (t === 'cheddar') { const mats = ['#f2a516', '#f7bd3a'].map((c) => std({ color: c, roughness: 0.5 })); many(18, (i) => box(rnd(0.018, 0.026), 0.0025, 0.003, mats[i % 2])); return; }
      if (t === 'piment') { const mat = phys({ color: '#c01e14', roughness: 0.3, clearcoat: 0.6 }); many(7, () => { const o = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0022, 6, 14), mat); o.rotation.x = Math.PI / 2; return o; }); return; }
      if (t === 'salsa' || t === 'guac') {
        const mat = phys({ color: t === 'salsa' ? '#c2361f' : '#86b83a', roughness: 0.3, clearcoat: 0.6 });
        for (let i = 0; i < 5; i++) { const m = lump(rnd(0.009, 0.013), mat, 0.45, 1); put(m, (i - 2) * r * 0.32 + rnd(-0.01, 0.01), rnd(-0.01, 0.01), 0.002); }
        return;
      }
      if (t === 'lime') {
        const g = new THREE.Group();
        const peel = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10, 0, Math.PI, 0, Math.PI / 2), std({ color: '#5f9e2a', roughness: 0.5, side: THREE.DoubleSide }));
        const flesh = new THREE.Mesh(new THREE.CircleGeometry(0.0155, 14, 0, Math.PI), phys({ color: '#d8ee8a', roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide }));
        flesh.rotation.x = -Math.PI / 2; g.add(peel, flesh); g.rotation.z = Math.PI / 2; g.rotation.y = 0.4;
        put(g, r * 0.62, 0, 0.004);
      }
    },
    fold() { api.folded = true; foldTo = 1; if (!lastT) { foldK = 1; applyFold(1); } },
  };
  return api;
}

/** Pile de tortillas (dans un panier en tissu). */
export function buildTortillaStack(g, x, z) {
  const t = new THREE.Group();
  add(cyl(0.15, 0.14, 0.05, std({ color: '#c8282d', roughness: 0.9 }), 28), 0, 0.025, 0, t);
  const m = phys({ color: '#f0deb0', roughness: 0.85, sheen: 0.3 });
  for (let k = 0; k < 8; k++) add(cyl(0.11, 0.11, 0.005, m, 32), (Math.random() - 0.5) * 0.01, 0.05 + k * 0.006, (Math.random() - 0.5) * 0.01, t);
  t.position.set(x, 1.47, z);
  g.add(t);
  return t;
}

/** Pile de papiers d'emballage à damier (pour servir les tacos). */
export function buildWraps(g, x, z) {
  for (let k = 0; k < 6; k++) { const p = add(box(0.18, 0.003, 0.18, std({ map: checkTex(), roughness: 0.9 })), x, 1.472 + k * 0.004, z, g); p.rotation.y = (Math.random() - 0.5) * 0.3; }
}

/* ---------------- Emballages ---------------- */

/** Carton à pizza : kraft avec fibres ; le dessus du couvercle est imprimé. */
const kraftTex = once(() => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c9a273'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,85,45' : '230,200,150'},${rnd(0.08, 0.22)})`; g.lineWidth = rnd(0.4, 1.2); const x = Math.random() * w, y = Math.random() * h, a = rnd(-0.3, 0.3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * rnd(4, 14), y + Math.sin(a) * rnd(4, 14)); g.stroke(); }
}));
const lidTex = once(() => { const t = canvasTex(256, 256, (g, w, h) => {
  g.drawImage(kraftTex().image, 0, 0, w, h);
  g.strokeStyle = '#b3261a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#b3261a'; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, 7); g.fill();
  g.fillStyle = '#fff4e0'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PIZZA', w / 2, h / 2 - 12); g.font = 'bold 15px system-ui, sans-serif'; g.fillText('SNACK EMPIRE', w / 2, h / 2 + 18);
  g.font = '22px system-ui, sans-serif'; g.fillText('🍕', w / 2, 44);
}); t.center.set(0.5, 0.5); t.rotation = Math.PI; return t; }); // (à l'endroit vu depuis la cuisine)

/**
 * Met la pizza dans son carton (le carton fait partie de pizza.group : il part avec elle).
 * open = true : couvercle levé (pizza posée sur une table ou au comptoir) ; sinon il se referme en ~0,4 s.
 */
export function packPizza(pz, { open = false } = {}) {
  if (pz.box) return pz.box;
  const r = pz.r, s = r * 2.35, h = Math.max(0.034, r * 0.3), T = 0.004;
  const kraft = std({ map: kraftTex(), roughness: 0.9 }), inside = std({ color: '#e8dcc6', roughness: 0.95 });
  const b = new THREE.Group(); b.position.y = -0.004;
  add(box(s, T, s, inside), 0, 0, 0, b);
  for (const [w, d, x, z] of [[s, T, 0, s / 2], [s, T, 0, -s / 2], [T, s, s / 2, 0], [T, s, -s / 2, 0]]) add(box(w, h, d, kraft), x, h / 2, z, b);
  // couvercle : charnière au fond (côté fenêtre), il se rabat vers l'avant
  const hinge = new THREE.Group(); hinge.position.set(0, h, s / 2); b.add(hinge);
  const lid = add(box(s, T, s, [kraft, kraft, std({ map: lidTex(), roughness: 0.85 }), inside, kraft, kraft]), 0, 0, -s / 2, hinge);
  add(box(s, h * 0.7, T, kraft), 0, -h * 0.35, -s, hinge); // rabat avant
  const OPEN = 1.95;
  hinge.rotation.x = OPEN;
  if (!open) {
    let t0 = 0;
    lid.onBeforeRender = () => {
      const t = performance.now() / 1000; if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / 0.4);
      hinge.rotation.x = OPEN * (1 - k * k * (3 - 2 * k));
    };
  }
  b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  pz.group.add(b);
  pz.box = b;
  return b;
}

/** Papier à carreaux enroulé autour du bas du taco (il fait partie de taco.group). */
export function wrapTaco(tc) {
  if (tc.paper) return tc.paper;
  const r = tc.r, RS = r * 0.2 * 1.15, sMax = r * 0.62, NX = 6, NS = 16, X = r * 0.92;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NS; j++) {
    const x = -X + (2 * X * i) / NX, sv = -sMax + (2 * sMax * j) / NS, [z, y] = tacoProfile(sv, RS);
    pos.push(x, y - 0.002, z * 1.06); uv.push(i / NX * 1.5, j / NS * 1.5);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, c = a + NS + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const tex = checkTex().clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  const paper = new THREE.Mesh(geo, std({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
  paper.castShadow = true;
  // le papier s'enroule (petite animation)
  let t0 = 0;
  paper.scale.set(1, 0.01, 1);
  paper.onBeforeRender = () => {
    const t = performance.now() / 1000; if (!t0) t0 = t;
    const k = Math.min(1, (t - t0) / 0.25); paper.scale.y = Math.max(0.01, k);
    if (k >= 1) paper.onBeforeRender = () => {};
  };
  tc.group.add(paper);
  tc.paper = paper;
  return paper;
}
