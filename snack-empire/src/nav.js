import { THREE } from './util.js';

/*
 * Chemins des clients dans les zones où les stands sont éparpillés (fête foraine, plage) :
 * A* sur une grille de 0,5 m qui contourne baraques, tables, files d'attente et décor.
 * La grille est fixe (les emplacements ne bougent pas) : construite au premier besoin, chemins en cache.
 */
const CELL = 0.5;
const R = 0.4; // rayon d'un client (marge)

// Zones occupées d'un stand, en coordonnées locales [lx0, lx1, lz0, lz1]
const STAND_RECTS = [
  [-3.4, 2.4, -1.4, 1.7],   // baraque + comptoir
  [2.0, 3.2, 1.7, 2.9],     // ardoise du menu
  [3.9, 7.1, 3.6, 7.6],     // tables et chaises
  [-4.6, -0.3, 1.9, 3.6],   // file (le long du comptoir) et ses jardinières
  [-4.6, -2.9, 1.9, 10.0],  // file (qui repart vers l'avant)
];

/**
 * cfg : { x0, x1, z0, z1 : limites de la grille,
 *         slots : [{x, z, yaw}], circles : [{x, z, r}], rects : [[x0, x1, z0, z1]],
 *         blocked(x, z) : obstacle supplémentaire (barrières…) }
 */
export function createNav(cfg) {
  const X0 = cfg.x0, Z0 = cfg.z0;
  const NX = Math.ceil((cfg.x1 - X0) / CELL), NZ = Math.ceil((cfg.z1 - Z0) / CELL);
  let grid = null;

  function build() {
    grid = new Uint8Array(NX * NZ);
    const block = (test) => {
      for (let i = 0; i < NX; i++) for (let k = 0; k < NZ; k++) {
        const x = X0 + (i + 0.5) * CELL, z = Z0 + (k + 0.5) * CELL;
        if (test(x, z)) grid[k * NX + i] = 1;
      }
    };
    for (const s of cfg.slots) {
      const c = Math.cos(s.yaw), n = Math.sin(s.yaw);
      block((x, z) => {
        const dx = x - s.x, dz = z - s.z;
        const lx = dx * c - dz * n, lz = dx * n + dz * c; // repère local du stand
        return STAND_RECTS.some(([a, b, d, e]) => lx > a - R && lx < b + R && lz > d - R && lz < e + R);
      });
    }
    for (const p of cfg.circles || []) block((x, z) => Math.hypot(x - p.x, z - p.z) < p.r + R);
    for (const [a, b, d, e] of cfg.rects || []) block((x, z) => x > a - R && x < b + R && z > d - R && z < e + R);
    if (cfg.blocked) block(cfg.blocked);
    // bords de la grille
    block((x, z) => x < X0 + R || x > cfg.x1 - R || z > cfg.z1 - R);
  }

  const idx = (p) => [Math.floor((p.x - X0) / CELL), Math.floor((p.z - Z0) / CELL)];
  const free = (i, k) => i >= 0 && k >= 0 && i < NX && k < NZ && !grid[k * NX + i];
  const center = (i, k) => new THREE.Vector3(X0 + (i + 0.5) * CELL, 0, Z0 + (k + 0.5) * CELL);

  /** Case libre la plus proche (départ ou arrivée dans une zone occupée : sa propre table, sa file…). */
  function nearestFree(i, k) {
    if (free(i, k)) return [i, k];
    for (let r = 1; r < 14; r++) for (let di = -r; di <= r; di++) for (const dk of [-r, r]) {
      if (free(i + di, k + dk)) return [i + di, k + dk];
      if (free(i + dk, k + di)) return [i + dk, k + di];
    }
    return [i, k];
  }

  /** Ligne droite sans obstacle entre deux cases ? */
  function clear(a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) + 1;
    for (let s = 0; s <= n; s++) {
      const i = Math.round(a[0] + (b[0] - a[0]) * s / n), k = Math.round(a[1] + (b[1] - a[1]) * s / n);
      if (!free(i, k)) return false;
    }
    return true;
  }

  function astar(from, to) {
    const s = nearestFree(...idx(from)), g = nearestFree(...idx(to));
    const N = NX * NZ, si = s[1] * NX + s[0], gi = g[1] * NX + g[0];
    const cost = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const h = (i) => Math.hypot(i % NX - g[0], Math.floor(i / NX) - g[1]);
    const heap = [];
    const push = (e) => { heap.push(e); let j = heap.length - 1; while (j > 0) { const p = (j - 1) >> 1; if (heap[p][0] <= e[0]) break; heap[j] = heap[p]; j = p; } heap[j] = e; };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let j = 0; for (;;) { let c = 2 * j + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[j] = heap[c]; j = c; } heap[j] = last; } return top; };
    cost[si] = 0; push([h(si), si]);
    while (heap.length) {
      const [, cur] = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === gi) break;
      const ci = cur % NX, ck = Math.floor(cur / NX);
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue;
        const ni = ci + di, nk = ck + dk;
        if (!free(ni, nk)) continue;
        if (di && dk && (!free(ci + di, ck) || !free(ci, ck + dk))) continue; // pas de coin coupé
        const nidx = nk * NX + ni, nc = cost[cur] + (di && dk ? 1.414 : 1);
        if (nc < cost[nidx]) { cost[nidx] = nc; prev[nidx] = cur; push([nc + h(nidx), nidx]); }
      }
    }
    if (prev[gi] === -1 && gi !== si) return []; // pas de chemin (ne devrait pas arriver) : ligne droite
    const cells = [];
    for (let c = gi; c !== -1; c = prev[c]) cells.push([c % NX, Math.floor(c / NX)]);
    cells.reverse();
    // lissage : on ne garde que les virages nécessaires
    const out = [cells[0]];
    let a = cells[0];
    for (let j = 2; j < cells.length; j++) if (!clear(a, cells[j])) { a = cells[j - 1]; out.push(a); }
    out.push(cells[cells.length - 1]);
    return out.map(([i, k]) => center(i, k)).filter((p, j, arr) => !(j === 0 && p.distanceTo(from) < 0.6) && !(j === arr.length - 1 && p.distanceTo(to) < 0.6));
  }

  const cache = new Map();
  return {
    /** Trajet de « from » à « to » (points intermédiaires + « to »), en contournant les obstacles. */
    path(from, to) {
      if (!grid) build();
      const key = `${from.x.toFixed(1)},${from.z.toFixed(1)}>${to.x.toFixed(1)},${to.z.toFixed(1)}`;
      let pts = cache.get(key);
      if (!pts) {
        pts = astar(from, to);
        if (cache.size > 4000) cache.clear();
        cache.set(key, pts);
      }
      return [...pts.map((p) => p.clone()), to.clone()];
    },
    /** Pour les tests : la case d'un point est-elle libre ? */
    free(p) { if (!grid) build(); return free(...idx(p)); },
  };
}
