import { THREE } from './util.js';
import { MODELS, PALETTE_SLOTS } from './models.js';

const SKINS = ['#f1c7a0', '#c98e62', '#8d5a3b', '#e8b48a', '#f6d2b5', '#a8714d', '#5e3a26'];
const SHIRTS = ['#f4a262', '#457b9d', '#9b5de5', '#2a9d8f', '#e9c46a', '#ef476f', '#6a994e', '#f28482', '#f1f1ea', '#3d405b'];
const PANTS = ['#2b3040', '#3a3f4a', '#4a3b30', '#1f3550', '#55565c', '#7a6a55', '#2f4a3a'];
const SHOES = ['#f2f2f2', '#1f1f22', '#8a5a34', '#d94a3a', '#3a6ea5'];
const HAIR = ['#2b1d14', '#5a3a22', '#141414', '#c98a3a', '#7a2e1d', '#d8c7a0', '#8a8a88'];
const FIXED = { EyeWhite: '#f8f8f4', Pupil: '#1a1a22', Mouth: '#9a4a42', Sole: '#3a3a3a' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** Réglage global : les clients projettent-ils une ombre ? (désactivé en qualité basse) */
export const PEOPLE = { shadows: true };

/** Petite texture N×1 : une couleur par matériau du modèle Blender. */
function paletteTexture(colors) {
  const n = PALETTE_SLOTS.length;
  const data = new Uint8Array(n * 4);
  PALETTE_SLOTS.forEach((slot, i) => {
    const hex = parseInt((colors[slot] || FIXED[slot] || '#ff00ff').slice(1), 16); // octets sRGB
    data.set([(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255], i * 4);
  });
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Un client qui marche le long d'une liste de points. */
export class Customer {
  constructor(scene, pos) {
    const tpl = MODELS.customer;
    const root = new THREE.Group();
    const colors = { Skin: pick(SKINS), Shirt: pick(SHIRTS), Pants: pick(PANTS), Shoes: pick(SHOES), Hair: pick(HAIR), CapColor: pick(SHIRTS) };
    this.texture = paletteTexture(colors);
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.72, envMapIntensity: 0.7 });

    // coiffure : courte, longue, ou casquette
    const r = Math.random();
    const hair = r < 0.45 ? 'HairShort' : r < 0.8 ? 'HairLong' : 'Cap';
    const parts = {};
    for (const p of tpl.children) {
      if (p.name.startsWith('Hair') || p.name === 'Cap') {
        if (p.name !== hair && !(hair === 'Cap' && p.name === 'HairShort')) continue;
      }
      const m = new THREE.Mesh(p.geometry, this.material);
      m.position.copy(p.position);
      m.castShadow = PEOPLE.shadows;
      m.name = p.name;
      if (p.userData.seated) m.userData = { standGeo: p.geometry, sitGeo: p.userData.seated }; // jambe droite / genou plié
      root.add(m);
      parts[p.name] = m;
    }
    this.legs = [parts.LegL, parts.LegR];
    this.arms = [parts.ArmL, parts.ArmR];

    root.position.copy(pos);
    root.scale.setScalar(0.92 + Math.random() * 0.16);
    scene.add(root);

    this.root = root;
    this.scene = scene;
    this.path = [];
    this.speed = 2.1 + Math.random() * 0.9;
    this.v = 0;          // vitesse actuelle (accélère / ralentit en douceur)
    this.head = 0;       // cap de marche
    this.side = (Math.random() - 0.5) * 0.7; // écart personnel sur les points de passage (pas de file indienne)
    this.t = 0; this.phase0 = Math.random() * 6;
    this.pause = 0; this.pauseYaw = 0;
    this.phase = Math.random() * 10;
    this.yaw = 0;
    this.faceYaw = null;
    this.glance = 0;
    this.glanceT = Math.random() * 3;
    this.seated = false;
    this.lastIdx = Infinity; // dernière place de la file atteinte (Infinity = pas encore entré)
    this.state = 'new';
  }

  get pos() { return this.root.position; }
  get arrived() { return this.path.length === 0; }

  /** Suit une liste de points. Un point peut porter .qi (numéro de place dans la file) : en le passant, on le mémorise. */
  go(...points) {
    this.path = points.map((p) => { const v = p.clone(); if (p.qi !== undefined) v.qi = p.qi; return v; });
    this.faceYaw = null;
    this.head = this.yaw; // repart dans la direction où il regarde
  }
  face(yaw) { this.faceYaw = yaw; }

  /** S'asseoir (orienté vers yaw) / se relever. */
  sit(yaw) {
    this.seated = true; this.yaw = yaw; this.root.rotation.y = yaw; this.faceYaw = yaw;
    this.legs.forEach((l) => { if (l.userData.sitGeo) l.geometry = l.userData.sitGeo; }); // genoux pliés
  }
  standUp() {
    this.seated = false;
    this.root.position.y = 0;
    this.legs.forEach((l) => { if (l.userData.standGeo) l.geometry = l.userData.standGeo; });
    this.legs.forEach((l) => { l.rotation.x = 0; });
    this.arms.forEach((a) => { a.rotation.x = 0; });
  }

  update(dt) {
    const p = this.root.position;
    if (this.seated) {
      // assis sur la chaise : jambes à l'horizontale sous la table, porte la nourriture à la bouche
      const s = this.root.scale.x;
      p.y = 0.5 - 0.92 * s;
      this.legs[0].rotation.x = this.legs[1].rotation.x = -1.4;
      this.phase += dt * 2.2;
      this.arms[0].rotation.x = -0.75 - Math.max(0, Math.sin(this.phase)) * 0.9;
      this.arms[1].rotation.x = -0.65;
      this.arms[0].rotation.z = this.arms[1].rotation.z = 0;
      return;
    }
    let moving = false;
    this.t += dt;
    if (this.pause > 0) {
      // petite flânerie : il s'arrête un instant et regarde autour de lui
      this.pause -= dt;
      this.v = 0;
      this.turnTo(this.pauseYaw, dt * 0.5);
    } else if (this.path.length && !this.hold) {
      const tgt = this.path[0];
      // Les points « précis » (places dans la file, chaise, comptoir, dernier point) sont atteints exactement.
      // Les points de passage sont juste « frôlés » : on prend le virage en douceur, chacun avec son propre écart.
      const precise = this.path.length <= 2 || tgt.qi !== undefined || this.path[1].qi !== undefined;
      if (!precise && !tgt.off) {
        const ddx = tgt.x - p.x, ddz = tgt.z - p.z, d0 = Math.hypot(ddx, ddz) || 1;
        tgt.off = true;
        tgt.x += (-ddz / d0) * this.side; tgt.z += (ddx / d0) * this.side;
      }
      const dx = tgt.x - p.x, dz = tgt.z - p.z;
      const dist = Math.hypot(dx, dz);
      // vitesse : démarre et s'arrête en douceur, varie un peu d'un pas à l'autre
      const end = this.path.length === 1 ? Math.min(1, 0.35 + dist / 1.2) : 1;
      const want = this.speed * (1 + Math.sin(this.t * 0.7 + this.phase0) * 0.07) * end;
      this.v += (want - this.v) * Math.min(1, dt * 3);
      const step = Math.max(0.2 * this.speed, this.v) * dt;
      if (precise) {
        if (dist <= step) {
          p.x = tgt.x; p.z = tgt.z;
          if (tgt.qi !== undefined) this.lastIdx = tgt.qi;
          this.path.shift();
        } else { p.x += (dx / dist) * step; p.z += (dz / dist) * step; }
        this.head = Math.atan2(dx, dz);
      } else {
        // pilotage : le cap tourne progressivement vers le point (trajectoire en courbe)
        const want = Math.atan2(dx, dz);
        let d = Math.atan2(Math.sin(want - this.head), Math.cos(want - this.head));
        const maxTurn = 4.5 * dt;
        this.head += Math.max(-maxTurn, Math.min(maxTurn, d));
        const slow = Math.abs(d) > 1.2 ? 0.45 : 1; // virage serré : on ralentit
        p.x += Math.sin(this.head) * step * slow; p.z += Math.cos(this.head) * step * slow;
        if (dist < 0.55 + step) {
          this.path.shift();
          // en repartant, il arrive qu'on flâne un instant
          if ((this.state === 'leaving' || this.state === 'passing') && Math.random() < 0.1) {
            this.pause = 0.6 + Math.random() * 1.4;
            this.pauseYaw = this.head + (Math.random() - 0.5) * 2.4;
          }
        }
      }
      if (dist > 0.01) this.turnTo(this.head, dt * 0.8);
      moving = true;
    } else if (this.faceYaw !== null) {
      // en attendant : regarde de temps en temps autour de lui
      this.glanceT -= dt;
      if (this.glanceT <= 0) {
        this.glanceT = 1.5 + Math.random() * 4;
        this.glance = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 1.6;
      }
      this.turnTo(this.faceYaw + this.glance, dt * 0.4);
    }
    this.phase += dt * (moving ? Math.max(this.v, 0.8) * 3.4 : 1.2);
    const swing = moving ? Math.sin(this.phase) * 0.6 : 0;
    this.legs[0].rotation.x = swing; this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.75; this.arms[1].rotation.x = swing * 0.75;
    // à l'arrêt : légère respiration / balancement
    const idle = moving ? 0 : Math.sin(this.phase) * 0.04;
    this.arms[0].rotation.z = idle * 0.5; this.arms[1].rotation.z = -idle * 0.5;
    p.y = moving ? Math.abs(Math.cos(this.phase)) * 0.045 : 0;
  }

  turnTo(target, dt) {
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 10);
    this.root.rotation.y = this.yaw;
  }

  /** Position au-dessus de la tête (texte flottant). */
  headPos() { return this.root.position.clone().add(new THREE.Vector3(0, 2.1, 0)); }

  dispose() {
    this.scene.remove(this.root);
    this.material.dispose();
    this.texture.dispose();
  }
}
