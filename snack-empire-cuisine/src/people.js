import { THREE } from './util.js';
import { MODELS, PALETTE_SLOTS } from './models.js';

const SKINS = ['#f1c7a0', '#c98e62', '#8d5a3b', '#e8b48a', '#f6d2b5', '#a8714d', '#5e3a26'];
const SHIRTS = ['#f4a262', '#457b9d', '#9b5de5', '#2a9d8f', '#e9c46a', '#ef476f', '#6a994e', '#f28482', '#f1f1ea', '#3d405b'];
const PANTS = ['#2b3040', '#3a3f4a', '#4a3b30', '#1f3550', '#55565c', '#7a6a55', '#2f4a3a'];
const SHOES = ['#f2f2f2', '#1f1f22', '#8a5a34', '#d94a3a', '#3a6ea5'];
const HAIR = ['#2b1d14', '#5a3a22', '#141414', '#c98a3a', '#7a2e1d', '#d8c7a0', '#8a8a88'];
const FIXED = { EyeWhite: '#f8f8f4', Pupil: '#2a1d16', Mouth: '#a8564d', Sole: '#3a3a3a', Belt: '#3b2a20' };
const ACCENTS = ['#f1f1ea', '#2b3040', '#e9c46a', '#e63946', '#2a9d8f', '#ffffff'];
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
    const colors = { Skin: pick(SKINS), Shirt: pick(SHIRTS), Pants: pick(PANTS), Shoes: pick(SHOES), Hair: pick(HAIR), CapColor: pick(SHIRTS), Accent: pick(ACCENTS) };
    this.texture = paletteTexture(colors);
    // (une lueur de la couleur elle-même adoucit les zones à l'ombre : menton, dessous des bras)
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.72, envMapIntensity: 0.7, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 0.12 });

    // coiffure : courte, longue, ou casquette
    // (coiffures disponibles dans le modèle : courts, longs, chignon, bouclés ; casquette = cheveux courts dessous)
    const styles = tpl.children.map((p) => p.name).filter((n) => n.startsWith('Hair'));
    const r = Math.random();
    const hair = r < 0.18 ? 'Cap' : styles[Math.floor(Math.random() * styles.length)];
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
    // squelette : genoux sous les cuisses, avant-bras sous les bras ; bras et coiffure suivent le buste
    const attach = (child, parent) => { if (!child || !parent) return; root.remove(child); child.position.sub(parent.position); parent.add(child); };
    this.body = parts.Body;
    for (const n of ['ArmL', 'ArmR', 'HairShort', 'HairLong', 'Cap']) attach(parts[n], this.body);
    attach(parts.ShinL, parts.LegL); attach(parts.ShinR, parts.LegR);
    attach(parts.ForearmL, parts.ArmL); attach(parts.ForearmR, parts.ArmR);
    this.legs = [parts.LegL, parts.LegR];
    this.shins = [parts.ShinL, parts.ShinR];
    this.arms = [parts.ArmL, parts.ArmR];
    this.forearms = [parts.ForearmL, parts.ForearmR];
    this.walkK = 0; // 0 = à l'arrêt, 1 = en marche (transition en douceur)

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
  }
  standUp() {
    this.seated = false;
    this.root.position.y = 0;
    for (const o of [...this.legs, ...this.shins, ...this.arms, ...this.forearms]) o.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
  }

  update(dt) {
    const p = this.root.position;
    if (this.seated) {
      // assis sur la chaise : jambes à l'horizontale sous la table, porte la nourriture à la bouche
      const s = this.root.scale.x;
      p.y = 0.5 - 0.92 * s;
      // cuisses à l'horizontale, jambes qui retombent sous la chaise (genoux pliés)
      this.legs[0].rotation.x = this.legs[1].rotation.x = -1.45;
      this.shins[0].rotation.x = this.shins[1].rotation.x = 1.4;
      this.phase += dt * 1.6;
      // une main porte la nourriture à la bouche (le coude se plie), l'autre reste posée sur la table
      const bite = Math.max(0, Math.sin(this.phase)) ** 2;
      this.arms[0].rotation.x = -0.55 - bite * 0.35;
      this.forearms[0].rotation.x = -1.0 - bite * 1.1;
      this.arms[1].rotation.x = -0.45;
      this.forearms[1].rotation.x = -1.0;
      this.arms[0].rotation.z = 0.05; this.arms[1].rotation.z = -0.05;
      this.body.rotation.x = 0.06 + bite * 0.04; // se penche un peu vers son assiette
      this.body.rotation.y = this.body.rotation.z = 0;
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
    this.animate(dt, moving);
  }

  /**
   * Mouvements du corps.
   * Marche : chaque jambe a son cycle (la cuisse avance, le genou se plie pendant que le pied passe en avant,
   * puis se tend pour se poser), les bras se balancent à l'opposé avec le coude un peu plié,
   * le buste monte et descend deux fois par cycle et tourne légèrement avec les épaules.
   * À l'arrêt : respiration, poids du corps qui passe d'une jambe à l'autre, bras détendus.
   * On passe de l'un à l'autre en douceur (pas d'arrêt net).
   */
  animate(dt, moving) {
    this.walkK += ((moving ? 1 : 0) - this.walkK) * Math.min(1, dt * 6);
    const w = this.walkK, rest = 1 - w;
    // cadence : suit la vitesse (une foulée par tour de phase)
    this.phase += dt * (moving ? Math.max(this.v, 0.8) * 3.4 : 0);
    const f = this.phase, time = this.t + this.phase0;
    const stride = Math.min(1, 0.55 + this.v * 0.2); // foulée plus ample quand on marche vite
    for (let k = 0; k < 2; k++) {
      const a = f + k * Math.PI;
      const shift = rest * Math.sin(time * 0.45) * (k ? -1 : 1); // à l'arrêt : appui sur une jambe puis l'autre
      this.legs[k].rotation.x = w * 0.48 * stride * Math.sin(a) - rest * 0.02;
      this.shins[k].rotation.x = w * (0.08 + 0.85 * stride * Math.max(0, -Math.cos(a))) + rest * (0.03 + Math.max(0, shift) * 0.08);
      this.legs[k].rotation.z = rest * (k ? -0.03 : 0.03);
      // bras : à l'opposé de la jambe du même côté, coude plus plié quand le bras passe devant
      this.arms[k].rotation.x = -w * 0.4 * stride * Math.sin(a) + rest * 0.03 * Math.sin(time * 0.8 + k);
      this.forearms[k].rotation.x = -(0.15 + w * 0.35 * Math.max(0, Math.sin(a)) + rest * 0.04);
      this.arms[k].rotation.z = (k ? -1 : 1) * (0.05 + rest * 0.02 * Math.sin(time * 1.6));
    }
    // buste : rebond, rotation des épaules, légère inclinaison vers l'avant en marchant ; respiration au repos
    this.root.position.y = w * 0.028 * (1 + Math.cos(2 * f)) / 2;
    this.body.rotation.y = w * 0.08 * Math.sin(f);
    this.body.rotation.x = w * 0.035;
    this.body.rotation.z = rest * 0.018 * Math.sin(time * 0.45);
    this.body.scale.y = 1 + rest * 0.006 * Math.sin(time * 1.7);
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
