import { THREE, M, add, rbox, cyl, sph, canvasTex, shadows } from './util.js';
import { RECIPES, MARKET_RECIPES, MARKET_FIRST, PORT_FIRST, FAIR_FIRST, BEACH_FIRST, zoneOf } from './economy.js';
import { MODELS } from './models.js';
import { buildStall, ROW2_Z, STALL_TYPES } from './market.js';
import { buildPortShop, SHOP_TYPES } from './port.js';
import { buildFairStand, FAIR_SLOTS, FAIR_TYPES } from './fair.js';
import { buildBeachHut, BEACH_SLOTS, BEACH_TYPES } from './beach.js';
import { buildStandFx } from './standfx.js';
import { rigChefs, STAND_ACTION } from './chefanim.js';
import { makeBun, makeTray, sausageGeometry } from './kitchen-decor.js';

// 4 camions sur le parking, 6 étals dans le marché couvert (à droite), 8 boutiques au port (à gauche).
// Marché et port : une rangée du fond (z = 0) et une rangée devant (z = ROW2_Z), séparées par une allée.
// (port : les 2 dernières boutiques sont à gauche de l'écailler (fond) et du glacier (devant))
// Fête foraine et plage : stands éparpillés, chacun dans son sens (voir fair.js, beach.js).
export const SLOT_X = [0, 11, -11, 22, 36, 47, 58, 36, 47, 58, -48, -59, -70, -48, -59, -70, -81, -81, ...BEACH_SLOTS.map((s) => s.x), ...FAIR_SLOTS.map((s) => s.x)];
export const SLOT_Z = [0, 0, 0, 0, 0, 0, 0, ROW2_Z, ROW2_Z, ROW2_Z, 0, 0, 0, ROW2_Z, ROW2_Z, ROW2_Z, 0, ROW2_Z, ...BEACH_SLOTS.map((s) => s.z), ...FAIR_SLOTS.map((s) => s.z)];
/** Rangée : 0 = rangée du fond (accès par l'allée derrière la file), 1 = rangée de devant. */
export const SLOT_ROW = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, ...BEACH_SLOTS.map(() => 0), ...FAIR_SLOTS.map(() => 0)];
/** Orientation de l'emplacement (0 = comptoir tourné vers la caméra). Les stands forains font face à l'allée. */
export const SLOT_YAW = [...Array(18).fill(0), ...BEACH_SLOTS.map((s) => s.yaw), ...FAIR_SLOTS.map((s) => s.yaw)];

/** Nombre de places qui longent le camion avant que la file ne tourne vers le parking. */
export const QUEUE_ALONG = 4;
/** Position locale (par rapport au stand) de la place i, sans décalage. */
export function queueLocal(i) {
  if (i < QUEUE_ALONG) return { x: -0.9 - i * 0.8, z: 2.7 };
  return { x: -0.9 - (QUEUE_ALONG - 1) * 0.8 - 0.45, z: 2.7 + (i - QUEUE_ALONG + 1) * 0.8 };
}
const BODY_COLORS = ['#e63946', '#1f9aa6', '#f4a62a', '#8a5cd6'];
const AWNING_COLORS = ['#1f9aa6', '#e63946', '#2a6f97', '#f4a62a'];

/** Un emplacement de stand : verrouillé (contour en pointillés) ou food truck actif. */
export class Stand {
  constructor(scene, index) {
    this.index = index;
    this.x = SLOT_X[index];
    this.z = SLOT_Z[index];
    const zone = zoneOf(index);
    /** Zone : 'parking' (camions), 'market' (étals) ou 'port' (boutiques). */
    this.zone = zone.id;
    /** Modèle : camion, ou « étal » au sens large (étal du marché, boutique du port). */
    this.kind = index >= MARKET_FIRST ? 'stall' : 'truck';
    /** Rangée (marché, port) : 0 = fond (on y accède par l'allée), 1 = devant. */
    this.row = SLOT_ROW[index];
    this.recipes = zone.recipes;
    this.unlocked = false;
    this.cooks = 1;
    this.queue = [];
    this.incoming = 0; // clients en route vers le bout de la file
    this.serving = null;
    this.recipe = null;
    this.timer = 0;
    this.duration = 1;
    this.pop = 1;

    this.yaw = SLOT_YAW[index];
    this.cosY = Math.cos(this.yaw); this.sinY = Math.sin(this.yaw);
    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.yaw;
    scene.add(this.root);

    this.plot = buildPlot();
    this.root.add(this.plot);

    // « truck » = le modèle de l'emplacement : camion ou étal du marché
    this.truck = this.zone === 'beach' ? buildBeachHut(index - BEACH_FIRST, zone.recipes)
      : this.zone === 'fair' ? buildFairStand(index - FAIR_FIRST, zone.recipes)
      : this.zone === 'port' ? buildPortShop(index - PORT_FIRST, zone.recipes)
      : this.zone === 'market' ? buildStall(index - MARKET_FIRST, MARKET_RECIPES)
        : buildTruck(index);
    this.truck.group.visible = false;

    // Animation propre au stand (machine ou geste selon ce qu'il vend)
    const produce = { market: STALL_TYPES, port: SHOP_TYPES, fair: FAIR_TYPES, beach: BEACH_TYPES }[this.zone]?.[index - zone.first]?.produce;
    const fxKey = this.zone === 'parking' ? 'truck' + index : `${this.zone}-${produce}`;
    this.fx = buildStandFx(fxKey);
    // les vendeurs ont des bras et font les gestes de leur métier
    this.chefAnim = rigChefs(this.truck.chefs, STAND_ACTION[fxKey], this.zone === 'parking' ? -0.25 : undefined); // (camion : comptoir plus bas)
    this.fxK = 0;
    if (this.fx) {
      if (this.fx.rooftop) {
        // sur le toit du camion
        this.truck.group.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(this.truck.group);
        this.fx.group.position.set((bb.min.x + bb.max.x) / 2, bb.max.y + 0.55, (bb.min.z + bb.max.z) / 2 - 0.3);
      } else if (this.zone === 'market') this.fx.group.position.set(2.45, 1.1, 0.2); // desserte à côté de l'étal (derrière : étagères)
      else this.fx.group.position.set(1.15, 1.1, -0.45); // desserte derrière le comptoir, à droite des vendeurs
      this.truck.group.add(this.fx.group);
    }
    this.root.add(this.truck.group);

    // Coin repas (apparaît avec le camion)
    this.seats = [];
    this.truck.group.add(buildDining(this.seats, this));
  }

  /** Point local (repère de l'emplacement, comptoir vers +z) → point du monde (tient compte de l'orientation). */
  toWorld(lx, lz, y = 0) {
    return new THREE.Vector3(this.x + lx * this.cosY + lz * this.sinY, y, this.z - lx * this.sinY + lz * this.cosY);
  }
  /** Direction locale → direction du monde. */
  dirWorld(dx, dz) {
    return new THREE.Vector3(dx * this.cosY + dz * this.sinY, 0, -dx * this.sinY + dz * this.cosY);
  }

  /** Une chaise libre de ce stand, ou null. */
  freeSeat() {
    const free = this.seats.filter((s) => !s.taken);
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  unlock(animate) {
    this.unlocked = true;
    this.plot.visible = false;
    this.truck.group.visible = true;
    this.pop = animate ? 0 : 1;
  }

  setCooks(n) {
    this.cooks = n;
    // (camion n°1 : ce sont les vrais cuisiniers de la cuisine qu'on voit par la fenêtre)
    this.truck.chefs.forEach((c, i) => { c.visible = i < n && this.index !== 0; });
  }

  setMenu(levels) { this.truck.drawMenu(levels); }

  /**
   * Position (monde) de la place n°i dans la file.
   * La file longe le camion (vers l'arrière), puis tourne et s'éloigne vers le parking : un « L ».
   * Un léger décalage par place évite l'effet « rangée militaire ».
   */
  queuePos(i) {
    const p = queueLocal(i);
    return this.toWorld(p.x + Math.sin(i * 12.9) * 0.12, p.z + Math.cos(i * 7.3) * 0.12);
  }
  /** Direction dans laquelle la file se prolonge après la place i (par où arrivent les clients). */
  queueBack(i) {
    const a = queueLocal(i), b = queueLocal(i + 1);
    return this.dirWorld(b.x - a.x, b.z - a.z).normalize();
  }
  /** Orientation d'un client à la place i : vers la fenêtre, ou vers la personne devant lui. */
  queueYaw(i) {
    if (i === 0) return Math.PI + this.yaw;
    const a = queueLocal(i), b = queueLocal(i - 1);
    return Math.atan2(b.x - a.x, b.z - a.z) + this.yaw;
  }
  /** Point au-dessus du comptoir (bulle de commande). */
  counterPos() { return this.toWorld(-0.9, 1.6, 3.25); }
  /** Centre de l'emplacement (étiquette de prix). */
  plotPos() { return this.toWorld(0.3, 0, 0.6); }

  update(dt, t) {
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 1.6);
      const k = this.pop, s = 1.70158;
      const e = 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2; // easeOutBack
      this.truck.group.scale.setScalar(Math.max(0.001, e));
    }
    // les cuisiniers s'agitent pendant la préparation (et se tournent de temps en temps vers la machine)
    this.truck.chefs.forEach((c, i) => {
      c.position.y = this.serving ? Math.abs(Math.sin(t * 9 + i)) * 0.06 : 0;
    });
    // (vendeurs et machines ne s'animent que si le stand est assez près de la caméra : économise le téléphone)
    if (this.unlocked && this.near !== false) this.chefAnim(dt, t, this.fxK);
    if (this.fx && this.unlocked && this.near !== false) {
      this.fxK += ((this.serving ? 1 : 0) - this.fxK) * Math.min(1, dt * 3);
      this.fx.update(dt, t, this.fxK);
    }
  }
}

/** Tables bistro (position locale) entre ce camion et le stand suivant. */
const TABLES = [[5.5, 4.3], [5.5, 6.9]];

function buildDining(seats, stand) {
  const g = new THREE.Group();
  const wood = M('#a8733f', { r: 0.7, cached: true });
  const metal = M('#2b2d31', { r: 0.45, m: 0.7, cached: true });
  const plateM = M('#f7f4ec', { r: 0.35, cached: true });
  const bun = M('#d99a4e', { r: 0.55, cached: true });
  const meat = M('#5a2f1c', { r: 0.7, cached: true });
  const cup = M('#e63946', { r: 0.5, cached: true });

  for (const [tx, tz] of TABLES) {
    // table ronde
    add(cyl(0.38, 0.38, 0.04, wood, 28), tx, 0.75, tz, g);
    add(cyl(0.03, 0.03, 0.73, metal, 10), tx, 0.37, tz, g);
    add(cyl(0.22, 0.24, 0.03, metal, 20), tx, 0.015, tz, g);
    // deux chaises face à face
    for (const s of [-1, 1]) {
      const chair = new THREE.Group();
      add(rbox(0.4, 0.05, 0.4, 0.02, wood), 0, 0.45, 0, chair);
      add(rbox(0.4, 0.42, 0.04, 0.02, wood), 0, 0.68, -0.19, chair);
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) add(cyl(0.015, 0.015, 0.44, metal, 6), lx, 0.22, lz, chair);
      const cx = tx + s * 0.62;
      const yaw = Math.atan2(-s, 0); // la chaise regarde la table
      chair.position.set(cx, 0, tz);
      chair.rotation.y = yaw;
      g.add(chair);

      // assiette + burger + boisson, visibles quand quelqu'un mange
      const food = new THREE.Group();
      add(cyl(0.13, 0.11, 0.015, plateM, 20), 0, 0, 0, food);
      if (stand.index === 0) {
        // camion à hot-dogs : un hot-dog dans sa barquette
        const dog = new THREE.Group();
        dog.add(makeTray());
        const b2 = makeBun(); b2.position.y = 0.004; dog.add(b2);
        const sg = new THREE.Mesh(sausageGeometry(), M('#9c4a26', { r: 0.4, cached: true })); sg.position.y = 0.078; dog.add(sg);
        dog.scale.setScalar(0.75); dog.position.y = 0.01;
        food.add(dog);
      } else {
        add(cyl(0.07, 0.07, 0.03, bun, 16), 0, 0.022, 0, food);
        add(cyl(0.075, 0.075, 0.025, meat, 16), 0, 0.048, 0, food);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bun), 0, 0.06, 0, food);
      }
      add(cyl(0.035, 0.028, 0.12, cup, 12), 0.1, 0.06, 0.1, food);
      food.position.set(tx + s * 0.2, 0.78, tz);
      food.visible = false;
      g.add(food);

      // positions dans le monde (l'emplacement peut être tourné) : chaise, puis « derrière la chaise »
      // (côté extérieur), et « sortie » (un pas vers l'avant du stand pour repartir)
      seats.push({
        pos: stand.toWorld(cx, tz),
        behind: stand.toWorld(cx + s * 0.65, tz),
        out: stand.toWorld(cx + s * 0.65, tz + 0.9),
        yaw: yaw + stand.yaw, food, taken: null,
      });
    }
  }
  shadows(g);
  return g;
}

function buildPlot() {
  const tex = canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 12; g.setLineDash([34, 22]);
    g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 36); g.stroke();
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.6), M('#ffffff', { map: tex, transparent: true, emissive: '#ffffff', emap: tex, ei: 0.6 }));
  m.material.alphaTest = 0.3;
  m.rotation.x = -Math.PI / 2;
  m.position.set(0.4, 0.02, 0);
  return m;
}

/** Textures dessinées dans le jeu (appliquées sur les UV du modèle glTF → flipY = false). */
function gltfTex(w, h, draw) {
  const t = canvasTex(w, h, draw);
  t.flipY = false;
  return t;
}

function buildTruck(index) {
  const group = new THREE.Group();
  const ac = AWNING_COLORS[index];

  const stripes = gltfTex(512, 64, (g, w, h) => {
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f4efe2' : ac; g.fillRect(i * w / 16, 0, w / 16, h); }
  });
  const signTex = gltfTex(1024, 200, (g, w, h) => {
    g.fillStyle = '#1b1a24'; g.fillRect(0, 0, w, h);
    g.font = '900 128px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff8a00'; g.shadowBlur = 28; g.fillStyle = '#ffd23f';
    g.fillText('SNACK EMPIRE', w / 2, h / 2 + 6);
    g.shadowBlur = 0; g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
  });

  // Copie du modèle Blender, avec des matériaux propres à ce stand
  const model = (index === 0 && MODELS.truckOpen ? MODELS.truckOpen : MODELS.truck).clone(true);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const name = o.material.name;
    o.userData.part = name; // (cuisine : on cache la carrosserie quand le joueur est dans le camion)
    if (name === 'Body') {
      o.material = o.material.clone();
      o.material.color.set(BODY_COLORS[index]);
    } else if (name === 'Awning') {
      o.material = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.7 });
    } else if (name === 'SignFace') {
      o.material = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.4 });
    }
    if (o.material.envMapIntensity !== undefined) o.material.envMapIntensity = 0.7;
  });
  group.add(model);

  // Camion n°1 (camion à hot-dogs) : on retire les burgers et les steaks du modèle, et on pose des hot-dogs sur le comptoir
  if (index === 0) {
    model.traverse((o) => { if (o.isMesh && (o.userData.part === 'Bun' || o.userData.part === 'Food')) o.visible = false; });
    for (const [x, rot] of [[-2.1, 0.25], [-1.65, -0.15]]) {
      const dog = new THREE.Group();
      dog.add(makeTray());
      const bun = makeBun(); bun.position.y = 0.004; dog.add(bun);
      const saus = new THREE.Mesh(sausageGeometry(), new THREE.MeshPhysicalMaterial({ color: '#9c4a26', roughness: 0.4, clearcoat: 0.55 }));
      saus.position.y = 0.078; dog.add(saus);
      const pts = [];
      for (let k = 0; k <= 24; k++) pts.push(new THREE.Vector3(-0.11 + k * 0.22 / 24, 0.108, Math.sin(k * 0.9) * 0.018));
      dog.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0065, 8), new THREE.MeshPhysicalMaterial({ color: x < -2 ? '#a50f16' : '#e2a800', roughness: 0.25, clearcoat: 0.8 })));
      dog.scale.setScalar(1.25);
      dog.position.set(x, 1.525, 1.48);
      dog.rotation.y = rot;
      dog.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.part = 'CounterDog'; } }); // (cachés quand on est dans le camion)
      group.add(dog);
    }
  }

  // Lambrequin festonné au bord de l'auvent
  const valance = canvasTex(512, 64, (g, w, h) => {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : ac;
      g.beginPath(); g.moveTo(i * w / 16, 0); g.lineTo((i + 1) * w / 16, 0); g.lineTo((i + 1) * w / 16, h * 0.5);
      g.arc((i + 0.5) * w / 16, h * 0.5, w / 32, 0, Math.PI); g.closePath(); g.fill();
    }
  });
  const val = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.3), M('#ffffff', { map: valance, transparent: true, r: 0.85 }));
  val.material.side = THREE.DoubleSide; val.material.alphaTest = 0.5;
  val.userData.part = 'Valance';
  add(val, -0.9, index === 0 ? 2.41 : 2.21, 2.46, group); // (camion n°1 : grande fenêtre, auvent plus haut)

  // Cuisiniers (1 à 3 visibles dans la fenêtre)
  const chefM = M('#ffffff', { r: 0.8, cached: true });
  const chefs = [-1.85, -0.9, 0.05].map((cx, i) => {
    const c = new THREE.Group();
    add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 6, 18), chefM), 0, 1.85, 0, c);
    add(sph(0.18, M(['#e0ac80', '#a8714d', '#f1c7a0'][i], { cached: true })), 0, 2.3, 0, c);
    add(cyl(0.15, 0.17, 0.2, chefM, 20), 0, 2.5, 0, c);
    add(sph(0.17, chefM), 0, 2.6, 0, c);
    c.position.set(cx, 0, 1.0);
    group.add(c);
    return c;
  });

  // Ardoise menu (redessinée quand une recette est débloquée)
  const menuCanvas = document.createElement('canvas');
  menuCanvas.width = 256; menuCanvas.height = 360;
  const menuTex = new THREE.CanvasTexture(menuCanvas);
  menuTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group();
  const pA = rbox(0.9, 1.25, 0.06, 0.03, M('#ffffff', { map: menuTex, r: 0.8 })); pA.rotation.x = -0.18; add(pA, 0, 0.62, 0.08, board);
  const pB = rbox(0.9, 1.25, 0.06, 0.03, M('#8a5a34', { r: 0.8, cached: true })); pB.rotation.x = 0.18; add(pB, 0, 0.62, -0.08, board);
  board.position.set(2.6, 0, 2.3); board.rotation.y = -0.6;
  group.add(board);

  function drawMenu(levels) {
    const g = menuCanvas.getContext('2d'), w = 256, h = 360;
    g.fillStyle = '#22302a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b88a52'; g.lineWidth = 18; g.strokeRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 44px "Segoe UI", sans-serif'; g.fillText('MENU', w / 2, 70);
    g.textAlign = 'left'; g.font = '30px "Segoe UI Emoji", "Segoe UI", sans-serif';
    RECIPES.filter((r) => (levels[r.id] || 0) > 0).forEach((r, i) => {
      g.fillStyle = '#f4f1e8'; g.fillText(`${r.emoji} ${r.name}`, 26, 128 + i * 48);
    });
    menuTex.needsUpdate = true;
  }

  shadows(board); chefs.forEach((c) => shadows(c));
  return { group, chefs, drawMenu };
}
