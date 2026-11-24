import { THREE, M, add, rbox, box, cyl, sph, canvasTex, speckle, shadows, rng, mergeStatic } from './util.js';
import { buildPortDecor } from './port.js';
import { SEA_Z, PIER } from './fair.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SKY = ['#ffb27a', '#6d8fe0'];

export function createWorld(container) {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = canvasTex(4, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, SKY[0]); gr.addColorStop(0.55, SKY[1]); gr.addColorStop(1, SKY[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.FogExp2('#e9a98a', 0.009);

  const camera = new THREE.PerspectiveCamera(mobile ? 50 : 38, innerWidth / innerHeight, 0.1, 250);
  camera.position.set(11, 9.5, 17);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(1, 1, 2);
  // Déplacement libre, comme dans un jeu de gestion :
  // clic gauche (ou 1 doigt) = glisser la carte, clic droit (ou 2 doigts) = tourner, molette/pincer = zoom vers le curseur
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 100;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.35;
  controls.screenSpacePanning = false; // on glisse sur le sol, pas vers le ciel
  controls.zoomToCursor = true;
  controls.zoomSpeed = 1.2;
  controls.rotateSpeed = 0.6;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.update();
  renderer.domElement.style.cursor = 'grab';
  controls.addEventListener('start', () => { renderer.domElement.style.cursor = 'grabbing'; });
  controls.addEventListener('end', () => { renderer.domElement.style.cursor = 'grab'; });
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  // Clavier : flèches, ZQSD ou WASD pour se déplacer (plus vite avec Maj)
  const keys = new Set();
  const KEYMAP = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    // e.code = position physique : sur un clavier AZERTY, Z/Q tombent sur KeyW/KeyA
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
    if (e.key === 'Shift') keys.add('fast');
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); if (e.key === 'Shift') keys.delete('fast'); });
  addEventListener('blur', () => keys.clear());

  // Lumières : ciel + soleil de fin d'après-midi
  const hemi = new THREE.HemisphereLight(SKY[1], '#5a4a40', 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0b8', 3.4);
  const SUN_OFFSET = new THREE.Vector3(-8, 15, 12);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 26, bottom: -26, near: 1, far: 80 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  buildDecor(scene);
  const animators = []; // décor animé (mer, bateaux, mouettes…)
  buildPortDecor(scene, animators);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // halo lumineux : seuil assez haut pour ne toucher que les vraies lumières (ampoules, néons, lampes),
  // pas les surfaces claires en plein soleil (sable, pavés) qui sinon voilent l'écran de blanc
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.45, 1.25));
  composer.addPass(new OutputPass());
  let useComposer = true;

  const tmp = new THREE.Vector3();
  // Direction de vue par défaut (caméra → cible), utilisée pour les recadrages
  const VIEW_OFFSET = new THREE.Vector3(10, 8.5, 15);
  let tween = null;
  controls.addEventListener('start', () => { tween = null; }); // le joueur reprend la main

  const world = {
    renderer, scene, camera, controls, mobile,
    quality: 'high',
    /** Un recadrage automatique est en cours (la caméra glisse vers une zone). */
    get busy() { return !!tween; },

    /** Recadre la caméra sur les camions dont on donne les positions X (camions + files + tables). */
    frameStands(xs, animate = true) {
      const min = new THREE.Vector3(Math.min(...xs) - 3.8, 0, -1.5);
      const max = new THREE.Vector3(Math.max(...xs) + 4.6, 4, 7.5);
      this.frameBox(min, max, animate, xs.length);
    },

    /**
     * Recadre la caméra pour qu'une boîte (min → max) tienne entièrement à l'écran, bien centrée.
     * On projette les 8 coins de la boîte : la distance est ajustée pour qu'ils rentrent tous,
     * puis la cible est déplacée pour que la boîte soit au milieu de l'écran.
     * n : plus il est grand, plus on regarde de face (rangée de camions, halle du marché).
     */
    frameBox(min, max, animate = true, n = 1) {
      if (!Number.isFinite(camera.aspect) || camera.aspect <= 0) return; // fenêtre de taille nulle : pas de recadrage
      const dir = new THREE.Vector3(VIEW_OFFSET.x - 2.6 * (n - 1), VIEW_OFFSET.y + 0.6 * (n - 1), VIEW_OFFSET.z).normalize(); // cible → caméra
      const corners = [];
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z));
      const cam = camera.clone();
      const p = new THREE.Vector3();
      const bounds = (t, d) => {
        cam.position.copy(t).addScaledVector(dir, d);
        cam.lookAt(t);
        cam.updateMatrixWorld();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const c of corners) { p.copy(c).project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        return { x0, x1, y0, y1 };
      };
      // marges : un peu d'air sur les côtés, et de la place pour l'argent (en haut) et les boutons pub (en bas)
      const MX = 0.88, MY = 0.72;
      const target = new THREE.Vector3((min.x + max.x) / 2, 1, (min.z + max.z) / 2);
      const right = new THREE.Vector3().crossVectors(dir.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
      const fwd = new THREE.Vector3(-dir.x, 0, -dir.z).normalize(); // vers le fond de l'écran
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      let dist = VIEW_OFFSET.length();
      for (let it = 0; it < 4; it++) {
        // plus petite distance pour laquelle la boîte entre dans l'écran
        let lo = 6, hi = controls.maxDistance;
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2, b = bounds(target, mid);
          if (b.x1 - b.x0 <= 2 * MX && b.y1 - b.y0 <= 2 * MY) hi = mid; else lo = mid;
        }
        dist = hi;
        // recentrer : décaler la cible pour amener le centre de la boîte au centre de l'écran
        const b = bounds(target, dist);
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2 + 0.03; // léger décalage vers le haut (boutons en bas)
        target.addScaledVector(right, cx * dist * tanV * camera.aspect);
        target.addScaledVector(fwd, cy * dist * tanV * 1.3);
      }
      target.x = THREE.MathUtils.clamp(target.x, -110, 95);
      target.z = THREE.MathUtils.clamp(target.z, -12, 128);
      target.y = 1;
      const pos = target.clone().addScaledVector(dir, dist);

      if (![pos.x, pos.y, pos.z, target.x, target.z].every(Number.isFinite)) return; // sécurité : jamais de caméra invalide
      if (!animate) { camera.position.copy(pos); controls.target.copy(target); controls.update(); tween = null; return; }
      tween = {
        t: 0, dur: 1.6,
        fromPos: camera.position.clone(), fromTgt: controls.target.clone(),
        toPos: pos, toTgt: target,
      };
    },

    /** Ambiance jour (0) → nuit (1) sur toute la ville : soleil, ciel, brouillard. */
    setNight(n) {
      if (Math.abs(n - (this._night ?? 0)) < 0.005 && this._night !== undefined) return;
      this._night = n;
      const lerp = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), n);
      sun.intensity = 3.4 * (1 - 0.85 * n);
      hemi.intensity = 0.7 * (1 - 0.6 * n);
      // l'éclairage d'ambiance (reflets) garde la scène claire : on baisse l'exposition générale,
      // les ampoules et néons (lumineux par eux-mêmes) ressortent alors dans la nuit
      renderer.toneMappingExposure = 1.05 * (1 - 0.6 * n);
      hemi.color.copy(lerp(SKY[1], '#2a3a7a'));
      scene.fog.color.copy(lerp('#e9a98a', '#1a1f3a'));
      const img = scene.background.image, g = img.getContext('2d');
      const gr = g.createLinearGradient(0, img.height, 0, 0);
      gr.addColorStop(0, '#' + lerp(SKY[0], '#3a2a5a').getHexString());
      gr.addColorStop(0.55, '#' + lerp(SKY[1], '#0b1433').getHexString());
      gr.addColorStop(1, '#' + lerp(SKY[1], '#070b22').getHexString());
      g.fillStyle = gr; g.fillRect(0, 0, img.width, img.height);
      scene.background.needsUpdate = true;
    },

    /** Anime le décor (mer, bateaux, mouettes…). */
    animate(dt) { for (const f of animators) f(dt); },

    /** Avance l'animation de recadrage. */
    updateCamera(dt) {
      // déplacement au clavier, relatif à la direction de la caméra (vitesse selon le zoom)
      if (keys.has('f') || keys.has('b') || keys.has('l') || keys.has('r')) {
        tween = null;
        const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const mv = new THREE.Vector3()
          .addScaledVector(fwd, (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0))
          .addScaledVector(right, (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0));
        if (mv.lengthSq() > 0) {
          const speed = (6 + camera.position.distanceTo(controls.target) * 0.45) * (keys.has('fast') ? 2.2 : 1);
          mv.normalize().multiplyScalar(speed * Math.min(dt, 0.05));
          camera.position.add(mv); controls.target.add(mv);
        }
      }
      if (!tween) return;
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2; // easeInOutCubic
      camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
      controls.target.lerpVectors(tween.fromTgt, tween.toTgt, k);
      if (tween.t >= 1) tween = null;
    },
    /** Mobile ou PC lent : moins de pixels, pas de halo lumineux, ombres réduites, clients sans ombre. */
    setQuality(q) {
      if (q === this.quality) return;
      this.quality = q;
      const low = q === 'low';
      useComposer = !low;
      renderer.setPixelRatio(low ? 1 : Math.min(2, devicePixelRatio));
      renderer.setSize(innerWidth, innerHeight);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(innerWidth, innerHeight);
      const size = low ? 1024 : 2048;
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      sun.shadow.radius = low ? 1 : 3;
      this.onQuality && this.onQuality(q);
    },
    render() {
      // Limite le déplacement de la caméra à la zone de jeu
      // on reste au-dessus de la carte (du phare du port aux chaises volantes, de la rue à la grande roue) :
      // caméra et cible sont décalées ensemble, la vue ne pivote pas quand on bute sur le bord
      const t = controls.target;
      const cx = THREE.MathUtils.clamp(t.x, -110, 95) - t.x, cz = THREE.MathUtils.clamp(t.z, -12, 128) - t.z;
      if (cx || cz) { t.x += cx; t.z += cz; camera.position.x += cx; camera.position.z += cz; }
      camera.position.y += 1 - t.y; t.y = 1; // le glissement reste au niveau du sol
      controls.update();
      // le soleil suit la caméra : les ombres restent nettes là où l'on regarde (parking ou marché)
      sun.target.position.copy(controls.target);
      sun.position.copy(controls.target).add(SUN_OFFSET);
      sun.target.updateMatrixWorld();
      // brouillard plus léger quand la caméra recule (sinon tout est délavé avec 4 camions)
      scene.fog.density = THREE.MathUtils.clamp(0.009 * 20 / camera.position.distanceTo(controls.target), 0.003, 0.009);
      useComposer ? composer.render() : renderer.render(scene, camera);
    },
    /** Position écran (px) d'un point 3D. */
    toScreen(v) {
      tmp.copy(v).project(camera);
      return { x: (tmp.x + 1) / 2 * innerWidth, y: (1 - tmp.y) / 2 * innerHeight, visible: tmp.z < 1 };
    },
    resize() {
      // fenêtre masquée ou de taille nulle (onglet caché, iframe de portail en cours de chargement) : on ne touche à rien
      if (!innerWidth || !innerHeight) return;
      camera.fov = innerWidth < 760 ? 50 : 38;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
    },
  };
  if (mobile) world.setQuality('low');
  addEventListener('resize', world.resize);
  return world;
}

function buildDecor(scene) {
  const rand = rng(42);
  const deco = new THREE.Group();
  scene.add(deco);

  // Sol : asphalte
  const asphalt = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5e626b'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, 0.18, rand);
  }, { rep: [14, 14] });
  // la ville s'étend vers la droite pour accueillir le marché couvert (x ≈ 30 à 65)
  // la ville s'arrête au bord de l'eau à gauche (x = -37) : au-delà, c'est le port et la mer
  // (s'étend loin vers l'avant pour la fête foraine, devant le marché)
  // (et s'arrête au bord de mer devant, à z = SEA_Z : un quai avec garde-corps, ouvert sur le ponton)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(227, SEA_Z + 175), M('#ffffff', { map: asphalt, r: 0.85 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(76.5, 0, (SEA_Z - 175) / 2); ground.receiveShadow = true;
  asphalt.repeat.set(25, 25 * (SEA_Z + 175) / 227);
  scene.add(ground);

  // Quai du bord de mer : mur de pierre, dalles claires et garde-corps (ouverture pour le ponton)
  // (la partie à gauche de x = 10 disparaît quand la plage ouvre : le sable descend alors jusqu'à l'eau)
  const wallM = M('#9d978c', { r: 0.9 }), slabM = M('#cfc6b4', { r: 0.9 });
  const railM = M('#2f3b4a', { r: 0.45, m: 0.6 });
  const beachQuay = new THREE.Group();
  const quay = (xa, xb, parent) => {
    add(box(xb - xa, 1.3, 0.9, wallM), (xa + xb) / 2, -0.6, SEA_Z + 0.45, parent);
    add(box(xb - xa, 0.12, 2.4, slabM), (xa + xb) / 2, 0.06, SEA_Z - 1.2, parent);
  };
  const quayRail = (xa, xb, parent) => {
    add(box(xb - xa, 0.08, 0.08, railM), (xa + xb) / 2, 1.05, SEA_Z - 0.2, parent);
    add(box(xb - xa, 0.05, 0.05, railM), (xa + xb) / 2, 0.6, SEA_Z - 0.2, parent);
    for (let x = xa; x <= xb + 0.01; x += 2.5) add(box(0.08, 1.05, 0.08, railM), x, 0.53, SEA_Z - 0.2, parent);
  };
  quay(-37, 10, beachQuay); quay(10, 190, deco);
  quayRail(-36.5, 9.9, beachQuay);
  quayRail(10.1, PIER.x0 - 0.1, deco);
  quayRail(PIER.x1 + 0.1, 150, deco);
  shadows(beachQuay);
  const beachQuayMerged = mergeStatic(beachQuay);
  scene.add(beachQuayMerged);
  scene.userData.beachQuay = beachQuayMerged;

  // Places de parking à l'avant
  const lineM = M('#e9e6dc', { r: 0.7 });
  for (let i = -8; i <= 8; i++) add(box(0.14, 0.012, 3.6, lineM), i * 3, 0.006, 17.5, deco);
  add(box(51, 0.012, 0.14, lineM), 0, 0.006, 15.7, deco);

  // Trottoir + bordure
  add(rbox(227, 0.25, 4.5, 0.06, M('#c9c2b4', { r: 0.9 })), 76.5, 0.125, -9.5, deco);
  add(rbox(227, 0.28, 0.35, 0.08, M('#b8b2a6', { r: 0.8 })), 76.5, 0.14, -7.2, deco);

  // Immeubles
  const colors = ['#d9805f', '#e8c27a', '#6f9fd8', '#b57fb8', '#7fbf9a', '#e39a8c'];
  let x = -37;
  let i = 0;
  while (x < 150) {
    const w = 6 + rand() * 3.5, h = 7 + rand() * 10;
    const tex = canvasTex(256, 512, (g, cw, ch) => {
      g.fillStyle = colors[i % colors.length]; g.fillRect(0, 0, cw, ch);
      for (let y = 24; y < ch - 30; y += 62) for (let xx = 22; xx < cw - 30; xx += 56) {
        g.fillStyle = rand() < 0.25 ? '#ffd38a' : '#3c4a66';
        g.fillRect(xx, y, 34, 44);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(xx - 3, y + 44, 40, 5);
      }
    });
    add(box(w, h, 5, M('#ffffff', { map: tex, r: 0.85 })), x + w / 2, h / 2, -14.5, deco);
    add(box(w + 0.3, 0.35, 5.3, M('#efe7da', { r: 0.8, cached: true })), x + w / 2, h + 0.2, -14.5, deco);
    x += w + 0.4; i++;
  }

  // Arbres le long du trottoir
  const trunkM = M('#6b4a33', { r: 0.95 });
  const leafM = M('#4f9a48', { r: 0.9 });
  for (let tx = -34; tx <= 133; tx += 11) {
    const s = 0.9 + rand() * 0.35;
    const t = new THREE.Group();
    add(cyl(0.16 * s, 0.22 * s, 2.2 * s, trunkM, 20), 0, 1.1 * s, 0, t);
    for (const [a, b, c, r] of [[0, 2.7, 0, 1.1], [0.7, 2.4, 0.3, 0.8], [-0.6, 2.5, -0.2, 0.85], [0.1, 3.3, -0.1, 0.8]]) {
      add(sph(r * s, leafM, 28, 18), a * s, b * s, c * s, t);
    }
    t.position.set(tx + rand() * 2, 0, -9 - rand() * 1.2);
    deco.add(t);
  }

  // Coin repas : tables + parasols, entre les stands
  const tableColors = ['#e76f51', '#2a9d8f', '#e9c46a', '#9b5de5'];
  [[-5, -4.6], [5, -4.6], [15, -4.6], [-15, -4.6], [25, -4.6]].forEach(([tx, tz], k) => deco.add(table(tx, tz, tableColors[k % 4])));

  // Guirlandes lumineuses le long du trottoir
  const bulbM = M('#fff0c0', { emissive: '#ffc56a', ei: 4, r: 0.3 });
  const wireM = M('#1f1f1f', { r: 0.8 });
  const poleM = M('#3a3a3a', { r: 0.5, m: 0.6 });
  const poles = [-30, -20, -10, 0, 10, 20, 30]; // (s'arrêtent avant le port)
  poles.forEach((px) => add(cyl(0.06, 0.08, 4.2, poleM, 12), px, 2.1, -6.6, deco));
  for (let k = 0; k < poles.length - 1; k++) {
    const a = new THREE.Vector3(poles[k], 4.1, -6.6), b = new THREE.Vector3(poles[k + 1], 4.1, -6.6);
    const pts = [];
    for (let s = 0; s <= 30; s++) {
      const t = s / 30; const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(Math.PI * t) * 0.8; pts.push(p);
    }
    deco.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.012, 5), wireM));
    for (let s = 1; s < 30; s += 2) {
      const bulb = sph(0.07, bulbM, 12, 8); bulb.position.copy(pts[s]); bulb.position.y -= 0.08; deco.add(bulb);
    }
  }

  // Poubelles
  const binM = M('#3a7d44', { r: 0.5, m: 0.2 });
  for (const bx of [-25, -8, 8, 25]) {
    add(cyl(0.3, 0.27, 0.9, binM, 28), bx, 0.45, -6.2, deco);
    add(cyl(0.33, 0.33, 0.08, binM, 28), bx, 0.92, -6.2, deco);
  }

  shadows(deco);
  ground.castShadow = false;
  // les ampoules et les fils ne projettent pas d'ombre
  deco.traverse((o) => { if (o.isMesh && (o.material === bulbM || o.material === wireM)) o.castShadow = false; });

  scene.remove(deco);
  scene.add(mergeStatic(deco));
}

function table(x, z, c) {
  const g = new THREE.Group();
  const wood = M('#a8733f', { r: 0.7, cached: true });
  const metal = M('#2f2f33', { r: 0.4, m: 0.8, cached: true });
  add(cyl(0.65, 0.65, 0.07, wood, 40), 0, 0.78, 0, g);
  add(cyl(0.04, 0.04, 0.78, metal, 12), 0, 0.39, 0, g);
  add(cyl(0.3, 0.32, 0.04, metal, 24), 0, 0.02, 0, g);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.4;
    add(cyl(0.2, 0.2, 0.06, wood, 24), Math.cos(a) * 1.05, 0.48, Math.sin(a) * 1.05, g);
    add(cyl(0.03, 0.03, 0.46, metal, 10), Math.cos(a) * 1.05, 0.24, Math.sin(a) * 1.05, g);
  }
  add(cyl(0.025, 0.025, 2.3, metal, 10), 0, 1.6, 0, g);
  const um = canvasTex(512, 64, (gg, w, h) => {
    for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#ffffff' : c; gg.fillRect(i * w / 8, 0, w / 8, h); }
  });
  const u = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.55, 40, 1, true), M('#ffffff', { map: um, r: 0.85 }));
  u.material.side = THREE.DoubleSide;
  add(u, 0, 2.6, 0, g);
  g.position.set(x, 0, z);
  return g;
}
