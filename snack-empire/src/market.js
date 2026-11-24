import { THREE, M, add, rbox, box, cyl, sph, canvasTex, shadows, mergeStatic } from './util.js';
import { L } from './i18n.js';

/*
 * Niveau 2 : le marché couvert.
 * - buildMarketHall() : grande halle en fonte verte et verre, à droite du parking.
 * - buildStall(k)     : un étal (boulangerie, fromagerie, primeur) avec le même encombrement
 *                       qu'un camion, pour réutiliser la file, les tables et le service.
 */

export const HALL = { x0: 29, x1: 65, z0: -4, z1: 11.5, h: 6.5, peak: 9.6 };

/** Rangée de devant (étals 4 à 6) : décalée vers l'avant, avec une allée entre les deux rangées. */
export const ROW2_Z = 19;
/** Allée centrale (entre le fond des files de la 1re rangée et l'arrière de la 2e rangée). */
export const AISLE_Z = 14.4;
/** Promenade devant la halle, par où arrivent et repartent les clients de la rangée de devant. */
export const FRONT_Z = 33;

/** Bord avant de la halle : elle s'élargit vers l'avant quand la 2e rangée est ouverte. */
export function hallFront(hasRow2) { return hasRow2 ? ROW2_Z + HALL.z1 : HALL.z1; }

export const STALL_TYPES = [
  { name: L('BOULANGERIE', 'BAKERY'), awning: '#c0392b', board: '#5a2f1c', produce: 'bread' },
  { name: L('FROMAGERIE', 'CHEESE SHOP'), awning: '#e9a23b', board: '#2f4a3f', produce: 'cheese' },
  { name: L('PRIMEUR', 'GREENGROCER'), awning: '#2a9d8f', board: '#22302a', produce: 'fruit' },
  { name: L('POISSONNERIE', 'FISHMONGER'), awning: '#2a6f97', board: '#1d3557', produce: 'fish' },
  { name: L('CHARCUTERIE', 'DELI'), awning: '#8d1b2c', board: '#3d1f1a', produce: 'charcuterie' },
  { name: L('PÂTISSERIE', 'PASTRY SHOP'), awning: '#e57aa5', board: '#5a2d47', produce: 'pastry' },
];

/* ---------- La halle ---------- */
export function buildMarketHall(z1 = HALL.z1) {
  const { x0, x1, z0, h, peak } = HALL;
  const zm = (z0 + z1) / 2;
  const g = new THREE.Group();
  const iron = M('#2f5446', { r: 0.45, m: 0.6, cached: true });
  const stone = M('#d8d0c0', { r: 0.8, cached: true });
  // Toit (charpente, verre, lanternes) : matériaux à part, qui peuvent s'effacer quand on regarde le marché
  const roofIron = new THREE.MeshStandardMaterial({ color: '#2f5446', roughness: 0.45, metalness: 0.6, transparent: true, envMapIntensity: 0.7 });

  // Sol en pavés
  const tiles = canvasTex(256, 256, (c, w) => {
    c.fillStyle = '#cfc5b3'; c.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 32) for (let x = 0; x < w; x += 32) {
      c.fillStyle = `rgba(0,0,0,${0.03 + ((x * 7 + y * 13) % 5) * 0.015})`; c.fillRect(x + 1, y + 1, 30, 30);
    }
    c.strokeStyle = 'rgba(90,80,60,.35)'; c.lineWidth = 2;
    for (let i = 0; i <= w; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, w); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
  }, { rep: [(x1 - x0) / 3, (z1 - z0) / 3] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M('#ffffff', { map: tiles, r: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((x0 + x1) / 2, 0.015, zm);
  floor.receiveShadow = true;
  g.add(floor);

  // Colonnes, poutres et fermes de toit
  const xs = [];
  for (let x = x0; x <= x1 + 0.01; x += 6) xs.push(x);
  for (const x of xs) {
    for (const z of [z0, z1]) {
      add(rbox(0.6, 0.4, 0.6, 0.05, stone), x, 0.2, z, g);              // socle en pierre
      add(cyl(0.16, 0.2, h - 0.4, iron, 14), x, 0.2 + (h - 0.4) / 2, z, g);
      add(cyl(0.32, 0.18, 0.3, iron, 14), x, h - 0.1, z, g);            // chapiteau
      // petites consoles décoratives
      for (const s of [-1, 1]) { const b = box(0.08, 0.9, 0.08, iron); b.position.set(x + s * 0.35, h - 0.45, z); b.rotation.z = s * 0.7; g.add(b); }
    }
    // ferme : deux arbalétriers + entrait
    const half = (z1 - z0) / 2, rise = peak - h, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const s of [-1, 1]) {
      const raf = box(0.18, 0.3, len, roofIron);
      raf.position.set(x, h + rise / 2, zm + s * half / 2);
      raf.rotation.x = s * ang;
      g.add(raf);
    }
    add(box(0.08, 0.08, z1 - z0, roofIron), x, h + 0.2, zm, g);
    add(box(0.08, rise, 0.08, roofIron), x, h + rise / 2, zm, g); // poinçon
  }
  // poutres longitudinales : celles du bord restent, le faîtage fait partie du toit
  for (const [y, z] of [[h + 0.05, z0], [h + 0.05, z1]]) add(box(x1 - x0 + 0.6, 0.25, 0.25, iron), (x0 + x1) / 2, y, z, g);
  add(box(x1 - x0 + 0.6, 0.25, 0.25, roofIron), (x0 + x1) / 2, peak, zm, g);

  // Toit vitré (verre légèrement teinté, ne projette pas d'ombre) + pannes
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8ef', transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1 });
  const half = (z1 - z0) / 2, rise = peak - h, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const s of [-1, 1]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.6, len), glass);
    pane.rotation.x = -Math.PI / 2 + s * ang;
    pane.position.set((x0 + x1) / 2, h + rise / 2 + 0.16, zm + s * half / 2);
    pane.userData.noShadow = true;
    g.add(pane);
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const p = box(x1 - x0 + 0.6, 0.06, 0.06, roofIron);
      p.position.set((x0 + x1) / 2, h + rise * (1 - t) + 0.16, zm + s * half * t);
      g.add(p);
    }
  }

  // Grande enseigne au-dessus de l'entrée
  const signTex = canvasTex(1024, 160, (c, w, hh) => {
    c.fillStyle = '#2f5446'; c.fillRect(0, 0, w, hh);
    c.strokeStyle = '#e6c873'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, hh - 20);
    c.fillStyle = '#f3e7c6'; c.font = '900 92px Georgia, "Times New Roman", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(L('MARCHÉ COUVERT', 'COVERED MARKET'), w / 2, hh / 2 + 4);
  });
  add(rbox(9, 1.4, 0.15, 0.04, M('#ffffff', { map: signTex, r: 0.5 })), (x0 + x1) / 2, h + 1.0, z1 + 0.2, g);

  // Lanternes suspendues sous le faîtage
  const lampM = new THREE.MeshStandardMaterial({ color: '#ffe7b0', emissive: '#ffc067', emissiveIntensity: 3, roughness: 0.3, transparent: true });
  for (let x = x0 + 3; x < x1; x += 6) {
    add(cyl(0.01, 0.01, 2.0, roofIron, 4), x, peak - 1.0, zm, g);
    add(cyl(0.25, 0.12, 0.3, roofIron, 12), x, peak - 2.05, zm, g);
    add(sph(0.16, lampM, 12, 8), x, peak - 2.25, zm, g);
  }

  // le toit ne projette pas d'ombre (sinon il quadrille le sol de la halle)
  const roofMats = [roofIron, glass, lampM];
  g.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.noShadow && o !== floor && !roofMats.includes(o.material); o.receiveShadow = true; } });
  // géométrie recentrée sur le milieu de la halle : l'animation d'apparition grandit sur place
  const merged = mergeStatic(g);
  const cx = (x0 + x1) / 2;
  merged.children.forEach((m) => m.geometry.translate(-cx, 0, -zm));
  merged.position.set(cx, 0, zm);
  merged.userData.roof = { iron: roofIron, glass, lamp: lampM, fade: 0 };
  return merged;
}

/**
 * Efface plus ou moins le toit de la halle : fade = 0 (toit visible) → 1 (toit presque invisible).
 * Utilisé quand la caméra regarde le marché, pour bien voir les étals en dessous.
 */
export function setRoofFade(hall, fade) {
  const r = hall.userData.roof;
  if (!r) return;
  r.fade = fade;
  r.iron.opacity = 1 - 0.9 * fade;
  r.iron.depthWrite = fade < 0.3;
  r.glass.opacity = 0.22 * (1 - fade) + 0.02 * fade;
  r.lamp.opacity = 1 - 0.85 * fade;
  r.lamp.depthWrite = fade < 0.3;
  hall.children.forEach((m) => { if (m.material === r.glass) m.visible = fade < 0.98; }); // verre retiré quand il est effacé
}

/* ---------- Un étal ---------- */
export function buildStall(k, recipes) {
  const T = STALL_TYPES[k % STALL_TYPES.length];
  const group = new THREE.Group();
  const wood = M('#a8733f', { r: 0.75, cached: true });
  const woodLight = M('#d2a56d', { r: 0.6, cached: true });
  const woodDark = M('#6e4a2a', { r: 0.85, cached: true });

  // Comptoir en bois peint (même place que la fenêtre d'un camion : centre x = -0.9)
  const front = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = T.board; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 40) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x, 0, 3, h); }
    c.fillStyle = '#f3e7c6'; c.font = 'bold 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(T.name, w / 2, h / 2 + 2);
  });
  add(rbox(4.6, 1.1, 1.0, 0.04, M('#ffffff', { map: front, r: 0.7 })), -0.6, 0.55, 0.9, group);
  add(rbox(4.8, 0.08, 1.2, 0.02, woodLight), -0.6, 1.14, 0.95, group);

  // Étalage : trois cagettes inclinées remplies de produits
  for (const [i, cx] of [-2.2, -0.6, 1.0].entries()) {
    const crate = new THREE.Group();
    add(rbox(1.3, 0.22, 0.7, 0.02, wood), 0, 0.11, 0, crate);
    fillProduce(crate, T.produce, i);
    crate.position.set(cx, 1.18, 0.9);
    crate.rotation.x = 0.28;
    group.add(crate);
  }

  // Fond d'étal : étagères avec bocaux / produits
  add(rbox(4.8, 2.4, 0.15, 0.03, woodDark), -0.6, 1.2, -0.85, group);
  const jarColors = ['#e9c46a', '#e76f51', '#f4a261', '#2a9d8f', '#ffffff'];
  for (const y of [1.45, 1.95]) {
    add(rbox(4.6, 0.05, 0.35, 0.01, woodLight), -0.6, y, -0.65, group);
    for (let j = 0; j < 9; j++) add(cyl(0.08, 0.08, 0.2, M(jarColors[(j + (y > 1.6 ? 2 : 0)) % jarColors.length], { r: 0.3, cached: true }), 12), -2.6 + j * 0.5, y + 0.13, -0.65, group);
  }

  // Poteaux + auvent rayé incliné + lambrequin
  for (const [px, pz] of [[-2.95, -0.9], [1.75, -0.9], [-2.95, 1.45], [1.75, 1.45]]) add(cyl(0.06, 0.06, 2.9, wood, 10), px, 1.45, pz, group);
  const stripes = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? '#f6efe0' : T.awning; c.fillRect(i * w / 14, 0, w / 14, h); } });
  const awning = rbox(5.2, 0.05, 2.9, 0.02, M('#ffffff', { map: stripes, r: 0.85 }));
  awning.rotation.x = 0.16;
  add(awning, -0.6, 2.95, 0.3, group);
  const val = canvasTex(512, 64, (c, w, h) => {
    for (let i = 0; i < 14; i++) {
      c.fillStyle = i % 2 ? '#f6efe0' : T.awning;
      c.beginPath(); c.moveTo(i * w / 14, 0); c.lineTo((i + 1) * w / 14, 0); c.lineTo((i + 1) * w / 14, h * 0.5);
      c.arc((i + 0.5) * w / 14, h * 0.5, w / 28, 0, Math.PI); c.closePath(); c.fill();
    }
  });
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.32), M('#ffffff', { map: val, transparent: true, r: 0.85 }));
  valance.material.side = THREE.DoubleSide; valance.material.alphaTest = 0.5;
  add(valance, -0.6, 2.6, 1.75, group);

  // Enseigne en bois au-dessus
  const signTex = canvasTex(512, 96, (c, w, h) => {
    c.fillStyle = '#f3e7c6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = T.board; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = T.board; c.font = '900 56px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(T.name, w / 2, h / 2 + 2);
  });
  add(rbox(3.4, 0.6, 0.08, 0.02, M('#ffffff', { map: signTex, r: 0.6 })), -0.6, 3.55, 1.2, group);
  add(cyl(0.03, 0.03, 0.5, woodDark, 6), -1.9, 3.2, 1.2, group);
  add(cyl(0.03, 0.03, 0.5, woodDark, 6), 0.7, 3.2, 1.2, group);

  // Vendeurs (1 à 3) derrière le comptoir, tablier aux couleurs de l'étal
  const apron = M(T.awning, { r: 0.8, cached: true });
  const shirt = M('#f6efe0', { r: 0.8, cached: true });
  const chefs = [-1.85, -0.9, 0.05].map((cx, i) => {
    const c = new THREE.Group();
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 16), shirt), 0, 1.05, 0, c);
    add(rbox(0.4, 0.5, 0.06, 0.02, apron), 0, 0.95, 0.2, c);
    add(sph(0.17, M(['#e0ac80', '#a8714d', '#f1c7a0'][i], { cached: true })), 0, 1.6, 0, c);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), apron), 0, 1.66, 0, c); // béret
    c.position.set(cx, 0, 0.05);
    group.add(c);
    return c;
  });

  // Ardoise du menu
  const menuCanvas = document.createElement('canvas');
  menuCanvas.width = 256; menuCanvas.height = 360;
  const menuTex = new THREE.CanvasTexture(menuCanvas);
  menuTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group();
  const pA = rbox(0.9, 1.25, 0.06, 0.03, M('#ffffff', { map: menuTex, r: 0.8 })); pA.rotation.x = -0.18; add(pA, 0, 0.62, 0.08, board);
  const pB = rbox(0.9, 1.25, 0.06, 0.03, woodDark); pB.rotation.x = 0.18; add(pB, 0, 0.62, -0.08, board);
  board.position.set(2.6, 0, 2.3); board.rotation.y = -0.6;
  group.add(board);

  function drawMenu(levels) {
    const c = menuCanvas.getContext('2d'), w = 256, h = 360;
    c.fillStyle = '#22302a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b88a52'; c.lineWidth = 18; c.strokeRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 40px Georgia, serif'; c.fillText(L('MARCHÉ', 'MARKET'), w / 2, 66);
    c.textAlign = 'left'; c.font = '26px "Segoe UI Emoji", "Segoe UI", sans-serif';
    recipes.filter((r) => (levels[r.id] || 0) > 0).forEach((r, i) => { c.fillStyle = '#f4f1e8'; c.fillText(`${r.emoji} ${r.name}`, 18, 122 + i * 46); });
    menuTex.needsUpdate = true;
  }

  shadows(group);
  return { group, chefs, drawMenu };
}

/** Remplit une cagette selon le type d'étal. */
function fillProduce(crate, kind, seed) {
  if (kind === 'bread') {
    const crust = M('#c98a3f', { r: 0.6, cached: true });
    const dark = M('#a5652a', { r: 0.6, cached: true });
    for (let i = 0; i < 5; i++) {
      const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 6, 10), i % 2 ? crust : dark);
      loaf.rotation.z = Math.PI / 2; loaf.rotation.y = (i - 2) * 0.08;
      loaf.position.set(0, 0.28, -0.25 + i * 0.12); crate.add(loaf);
    }
    for (let i = 0; i < 4; i++) {
      const cr = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.045, 8, 12, Math.PI * 1.3), crust);
      cr.rotation.x = -Math.PI / 2; cr.position.set(-0.45 + i * 0.3, 0.3, 0.22); crate.add(cr);
    }
  } else if (kind === 'cheese') {
    const yellow = M('#f2c94c', { r: 0.6, cached: true });
    const rind = M('#d9a441', { r: 0.7, cached: true });
    for (let i = 0; i < 3; i++) add(cyl(0.2, 0.2, 0.12, i === 1 ? rind : yellow, 20), -0.38 + i * 0.38, 0.29, -0.08, crate);
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20, 1, false, 0, Math.PI / 3), yellow);
    wedge.position.set(0.2, 0.29, 0.2); crate.add(wedge);
    for (let i = 0; i < 3; i++) add(sph(0.08, M('#f7f4ec', { r: 0.5, cached: true }), 10, 8), -0.45 + i * 0.2, 0.29, 0.22, crate);
  } else if (kind === 'fish') {
    // poissons argentés posés sur de la glace pilée
    add(rbox(1.2, 0.08, 0.6, 0.03, M('#eef6fb', { r: 0.25, cached: true })), 0, 0.24, 0, crate);
    const scale = M('#aab7c4', { r: 0.25, m: 0.6, cached: true });
    const pink = M('#f4a3a3', { r: 0.5, cached: true });
    for (let i = 0; i < 5; i++) {
      const fish = new THREE.Group();
      const body = sph(0.06, i === 2 ? pink : scale, 12, 8); body.scale.set(3.2, 0.9, 1); fish.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), i === 2 ? pink : scale);
      tail.rotation.z = Math.PI / 2; tail.position.x = -0.24; fish.add(tail);
      fish.position.set(0, 0.32, -0.22 + i * 0.11); fish.rotation.y = (i % 2 ? 0.15 : -0.15);
      crate.add(fish);
    }
    add(sph(0.05, M('#ffd23f', { r: 0.4, cached: true }), 8, 6), 0.5, 0.31, 0.2, crate); // citrons
    add(sph(0.05, M('#ffd23f', { r: 0.4, cached: true }), 8, 6), 0.42, 0.31, 0.25, crate);
  } else if (kind === 'charcuterie') {
    const saus = M('#7a2e22', { r: 0.6, cached: true });
    const ham = M('#c8665a', { r: 0.6, cached: true });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 6, 10), saus);
      s.rotation.z = Math.PI / 2; s.position.set(0, 0.28, -0.24 + i * 0.12); crate.add(s);
    }
    const j = sph(0.16, ham, 14, 10); j.scale.set(1.5, 0.8, 1); j.position.set(0.35, 0.33, 0.12); crate.add(j);
    add(cyl(0.12, 0.12, 0.04, M('#f0c2b8', { r: 0.6, cached: true }), 16), -0.35, 0.32, 0.15, crate); // tranches
  } else if (kind === 'pastry') {
    const dough = M('#e8b86a', { r: 0.6, cached: true });
    for (let i = 0; i < 2; i++) {
      add(cyl(0.2, 0.18, 0.06, dough, 20), -0.33 + i * 0.66, 0.27, -0.05, crate);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(sph(0.035, M('#e63946', { r: 0.4, cached: true }), 8, 6), -0.33 + i * 0.66 + Math.cos(a) * 0.12, 0.31, -0.05 + Math.sin(a) * 0.12, crate); }
    }
    const mac = ['#f7a1c4', '#b5e48c', '#ffd166', '#a0c4ff', '#cdb4db'];
    for (let k = 0; k < 10; k++) {
      const m = M(mac[k % mac.length], { r: 0.5, cached: true });
      add(cyl(0.045, 0.045, 0.05, m, 12), -0.45 + (k % 5) * 0.22, 0.27, 0.2 + Math.floor(k / 5) * 0.0, crate);
    }
  } else {
    const colors = [['#e63946', '#d62828'], ['#f4a261', '#f77f00'], ['#8ac926', '#6a994e']][seed % 3];
    for (let i = 0; i < 24; i++) {
      add(sph(0.075, M(colors[i % 2], { r: 0.45, cached: true }), 10, 8), -0.52 + (i % 8) * 0.15, 0.27 + (i % 3 === 0 ? 0.04 : 0), -0.2 + Math.floor(i / 8) * 0.17, crate);
    }
  }
}
