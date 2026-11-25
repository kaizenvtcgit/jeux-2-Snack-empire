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
  const X0 = -3.2, X1 = 1.95, Z0 = -1.15, Z1 = 1.17, F = 0.75, C = 3.0;
  const W0 = -2.45, W1 = 0.65, S0 = 1.525, S1 = 2.575; // ouverture de la fenêtre de service
  const tile = (w, h) => MAT.tiles(w / 0.6, h / 0.6);
  add(box(X1 - X0, 0.05, Z1 - Z0, MAT.floor()), (X0 + X1) / 2, F, 0, g);
  add(box(X1 - X0, 0.05, Z1 - Z0, MAT.ceiling()), (X0 + X1) / 2, C, 0, g);
  add(box(0.05, C - F, Z1 - Z0, tile(Z1 - Z0, C - F)), X0, (F + C) / 2, 0, g);
  add(box(0.05, C - F, Z1 - Z0, tile(Z1 - Z0, C - F)), X1, (F + C) / 2, 0, g);
  // (pas de mur du fond : la caméra se tient au fond du camion, juste derrière)
  // mur de la fenêtre : carrelé autour de l'ouverture, inox en dessous (derrière le plan de travail)
  add(box(X1 - X0, S0 - F, 0.06, MAT.steel(5, 1)), (X0 + X1) / 2, (F + S0) / 2, Z1, g);
  add(box(X1 - X0, C - S1, 0.06, tile(X1 - X0, C - S1)), (X0 + X1) / 2, (S1 + C) / 2, Z1, g);
  add(box(W0 - X0, S1 - S0, 0.06, tile(W0 - X0, S1 - S0)), (X0 + W0) / 2, (S0 + S1) / 2, Z1, g);
  add(box(X1 - W1, S1 - S0, 0.06, tile(X1 - W1, S1 - S0)), (W1 + X1) / 2, (S0 + S1) / 2, Z1, g);
  // cadre de fenêtre en aluminium + vitre coulissante rangée sur le côté (ouverte)
  const alu = std({ color: '#aeb4bb', metalness: 0.8, roughness: 0.3 });
  for (const [w, h, x, y] of [[W1 - W0 + 0.1, 0.05, (W0 + W1) / 2, S0], [W1 - W0 + 0.1, 0.05, (W0 + W1) / 2, S1], [0.05, S1 - S0, W0, (S0 + S1) / 2], [0.05, S1 - S0, W1, (S0 + S1) / 2]]) {
    add(box(w, h, 0.12, alu), x, y, Z1, g);
  }
  add(box(W1 - W0, 0.015, 0.05, alu), (W0 + W1) / 2, S1 - 0.03, Z1 - 0.03, g); // rail de la vitre
  const glass = phys({ color: '#d8eef5', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, envMapIntensity: 1.4 });
  const pane = new THREE.Group();
  add(box(0.62, S1 - S0 - 0.08, 0.008, glass), 0, 0, 0, pane);
  for (const [w, h, x, y] of [[0.64, 0.025, 0, (S1 - S0) / 2 - 0.05], [0.64, 0.025, 0, -(S1 - S0) / 2 + 0.05], [0.025, S1 - S0 - 0.08, -0.31, 0], [0.025, S1 - S0 - 0.08, 0.31, 0]]) add(box(w, h, 0.02, alu), x, y, 0, pane);
  pane.position.set(W0 + 0.36, (S0 + S1) / 2, Z1 - 0.045);
  pane.traverse((o) => { if (o.isMesh && o.material === glass) o.userData.noShadow = true; });
  g.add(pane);

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
  add(box(1.6, 0.03, 0.04, steel), -0.9, 2.66, 1.1, g);
  for (const [x, r] of [[-1.35, 0.06], [-0.55, -0.04]]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.16), std({ map: ticketTex(), roughness: 0.9, side: THREE.DoubleSide }));
    t.position.set(x, 2.57, 1.085); t.rotation.set(0, Math.PI, r);
    g.add(t);
  }
  // dérouleur d'essuie-tout (mur à gauche de la fenêtre)
  add(box(0.3, 0.02, 0.1, steel), 1.05, 2.05, 1.08, g);
  const roll = add(cyl(0.055, 0.055, 0.24, std({ color: '#f7f5ef', roughness: 0.95 }), 28), 1.05, 1.98, 1.06, g); roll.rotation.z = Math.PI / 2;
  // extincteur rouge sur son support
  const ext = new THREE.Group();
  add(cyl(0.055, 0.055, 0.34, std({ color: '#c3161c', roughness: 0.35, metalness: 0.2 }), 24), 0, 0.17, 0, ext);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#c3161c', roughness: 0.35 })), 0, 0.34, 0, ext);
  add(cyl(0.015, 0.02, 0.05, std({ color: '#222', roughness: 0.5 }), 12), 0, 0.39, 0, ext);
  add(box(0.08, 0.015, 0.02, std({ color: '#222', roughness: 0.5 })), 0.03, 0.41, 0, ext);
  add(box(0.06, 0.08, 0.003, std({ color: '#ffffff', roughness: 0.8 })), 0, 0.2, 0.055, ext);
  ext.position.set(1.86, 1.2, -0.3); // (au mur, au bout du camion)
  g.add(ext);
  // étagère à épices (mur à droite de la fenêtre)
  add(box(0.6, 0.02, 0.12, steel), -2.8, 2.15, 1.08, g);
  const spiceCols = ['#b23a1e', '#d4a017', '#5b7d2a', '#7a4b2a', '#ece3cf'];
  spiceCols.forEach((c, k) => {
    const x = -3.02 + k * 0.11;
    add(cyl(0.025, 0.025, 0.1, phys({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05 }), 16), x, 2.21, 1.08, g);
    add(cyl(0.022, 0.022, 0.07, std({ color: c, roughness: 0.9 }), 16), x, 2.2, 1.08, g);
    add(cyl(0.026, 0.026, 0.02, std({ color: '#2b2b2b', roughness: 0.5 }), 16), x, 2.27, 1.08, g);
  });
  // tablette extérieure : distributeur de serviettes, pile de gobelets et sonnette
  const napkin = new THREE.Group();
  add(rbox(0.14, 0.12, 0.1, 0.01, std({ color: '#d9dde2', metalness: 0.85, roughness: 0.25 })), 0, 0.06, 0, napkin);
  add(box(0.1, 0.03, 0.005, std({ color: '#ffffff', roughness: 0.95 })), 0, 0.07, 0.052, napkin);
  napkin.position.set(0.35, 1.515, 1.48); g.add(napkin);
  for (let k = 0; k < 6; k++) add(cyl(0.04, 0.03, 0.1, std({ color: '#f6f1e7', roughness: 0.7 }), 20), -1.75, 1.565 + k * 0.012, 1.5, g);
  add(cyl(0.05, 0.06, 0.02, steel, 20), -2.1, 1.525, 1.4, g);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#d9b26f', roughness: 0.25, metalness: 0.9 })), -2.1, 1.535, 1.4, g);
  // pile de barquettes à hot-dog en carton à damier (à côté de la planche)
  for (let k = 0; k < 5; k++) {
    const t = makeTray(); t.position.set(-0.3, 1.47 + k * 0.012, 0.64); t.rotation.y = rnd(-0.05, 0.05); t.scale.setScalar(0.85);
    g.add(t);
  }
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
