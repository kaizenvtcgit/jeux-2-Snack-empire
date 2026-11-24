import { THREE } from './util.js';
import { createNav } from './nav.js';
import { FAIR, FAIR_SLOTS, FAIR_MASTS, BUMPERS, CAROUSEL, SWINGER, BOOTH, ENTRY_X, SEA_Z, COASTER_AREA } from './fair.js';

/** Fête foraine : trajets entre les stands et les manèges (voir nav.js). */

/** Point juste après l'arche, côté fête : tout le monde entre et sort par là. */
export const FAIR_GATE = new THREE.Vector3(ENTRY_X, 0, 38);

const nav = createNav({
  x0: FAIR.x0 - 1, x1: FAIR.x1 + 1, z0: 33, z1: SEA_Z,
  slots: FAIR_SLOTS,
  circles: [
    { x: CAROUSEL.x, z: CAROUSEL.z, r: 4.6 },
    { x: SWINGER.x, z: SWINGER.z, r: 3.6 },
    { x: BOOTH.x, z: BOOTH.z, r: 1.3 },
    ...FAIR_MASTS.map((m) => ({ x: m.x, z: m.z, r: 0.15 })),
    ...[-6, 6].map((sx) => ({ x: ENTRY_X + sx, z: FAIR.z0, r: 0.4 })), // piliers de l'arche
  ],
  rects: [[BUMPERS.x - 5.8, BUMPERS.x + 5.8, BUMPERS.z - 4.2, BUMPERS.z + 4.2], COASTER_AREA], // auto-tamponneuses, montagne russe
  // barrières et bord de mer ; seule l'arche permet d'entrer depuis la promenade
  blocked: (x, z) => x < FAIR.x0 + 0.4 || x > FAIR.x1 - 0.4 || z > SEA_Z - 1.4
    || (z > FAIR.z0 - 0.5 && z < FAIR.z0 + 0.5 && Math.abs(x - ENTRY_X) > 5.4),
});

export const fairPath = (from, to) => nav.path(from, to);
export const fairFree = (p) => nav.free(p);
