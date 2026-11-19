// Pedestrians: Port Solano's walkers — low-poly people strolling the pavements in both
// directions, crossing at corners, and fleeing with a "!" over their heads when shots ring
// out, a car mounts the kerb or a friend goes down. The hurt ones drop, lie still a while,
// then scramble up and run. Nobody here is a Rockstar character; they are all Solano locals.

import * as THREE from '../vendor/three.module.min.js';
import { STREET_LINES } from './config.js';
import { headingFor, randomSidewalkPoint, sidewalkCoordinate } from './city-layout.js';
import { resolveCircle } from './player-character.js';
import { alertTexture } from './textures.js';
import { pick, range } from './random.js';

const SKIN_TONES = [0xc98a5e, 0x8a5a3b, 0xe8b48c, 0x6e4530];
const SHIRTS = [0xff5da2, 0x39d0ff, 0xffc93f, 0x7dff6a, 0xf2f2f2, 0xff7847, 0xc792ff, 0x2a6fb5];
const PANTS = [0x2c3e50, 0xe8dcc0, 0x704214, 0x3a3f45, 0x7a2e35];

/** Build one walker (facing +z) with swinging limbs and an alert sprite in userData. */
export function buildPedMesh(rnd) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rnd, SKIN_TONES) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rnd, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rnd, PANTS) });
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const legGeo = new THREE.BoxGeometry(0.19, 0.72, 0.22);
  const legL = new THREE.Group();
  legL.position.set(-0.12, 0.74, 0);
  const legR = new THREE.Group();
  legR.position.set(0.12, 0.74, 0);
  add(legGeo, pants, 0, -0.34, 0, legL);
  add(legGeo, pants, 0, -0.34, 0, legR);
  group.add(legL, legR);
  add(new THREE.BoxGeometry(0.48, 0.58, 0.27), shirt, 0, 1.04, 0);
  const armGeo = new THREE.BoxGeometry(0.15, 0.62, 0.18);
  const armL = new THREE.Group();
  armL.position.set(-0.32, 1.28, 0);
  const armR = new THREE.Group();
  armR.position.set(0.32, 1.28, 0);
  add(armGeo, skin, 0, -0.27, 0, armL);
  add(armGeo, skin, 0, -0.27, 0, armR);
  group.add(armL, armR);
  add(new THREE.BoxGeometry(0.31, 0.33, 0.31), skin, 0, 1.52, 0);
  if (rnd() < 0.45) add(new THREE.BoxGeometry(0.34, 0.1, 0.34), shirt, 0, 1.7, 0); // a cap in shirt colour
  const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), transparent: true, depthWrite: false }));
  alert.position.set(0, 2.15, 0);
  alert.scale.setScalar(0.62);
  alert.visible = false;
  group.add(alert);
  group.userData = { legL, legR, armL, armR, alert };
  return group;
}

/** One walker and its little state machine: walk, flee, down. */
export class Pedestrian {
  constructor(scene, rnd) {
    this.group = buildPedMesh(rnd);
    scene.add(this.group);
    this.group.userData.ped = this;
    this.pos = this.group.position;
    this.heading = 0;
    this.health = 100;
    this.mode = 'walk';
    this.speed = range(rnd, 1.25, 2.05);
    this.phase = range(rnd, 0, 6);
    this.axis = 'x';
    this.dir = 1;
    this.line = 60;
    this.side = 1;
    this.fleeFrom = { x: 0, z: 0 };
    this.fleeTime = 0;
    this.downTime = 0;
    this.decidedAt = null;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  /** Place on a pavement with a coherent walking state. */
  placeOnSidewalk(rnd, point) {
    this.pos.set(point.x, 0, point.z);
    const nearX = STREET_LINES.reduce((a, b) => (Math.abs(b - point.x) < Math.abs(a - point.x) ? b : a));
    const nearZ = STREET_LINES.reduce((a, b) => (Math.abs(b - point.z) < Math.abs(a - point.z) ? b : a));
    if (Math.abs(point.x - nearX) < Math.abs(point.z - nearZ)) {
      this.axis = 'z';
      this.line = nearX;
      this.side = point.x > nearX ? 1 : -1;
    } else {
      this.axis = 'x';
      this.line = nearZ;
      this.side = point.z > nearZ ? 1 : -1;
    }
    this.dir = rnd() < 0.5 ? 1 : -1;
    this.heading = headingFor(this.axis, this.dir);
    this.mode = 'walk';
    this.health = 100;
    this.group.rotation.set(0, this.heading, 0);
    this.group.userData.alert.visible = false;
  }

  /** Take damage from a threat at (fromX, fromZ): drop, or run. Returns what happened. */
  hurt(damage, fromX, fromZ) {
    this.health -= damage;
    if (this.health <= 0) {
      this.mode = 'down';
      this.downTime = range(Math.random, 7, 11);
      this.group.userData.alert.visible = false;
      return 'down';
    }
    this.flee(fromX, fromZ);
    return 'flee';
  }

  /** Run from a frightening point. */
  flee(fromX, fromZ) {
    if (this.mode === 'down') return;
    this.mode = 'flee';
    this.fleeFrom = { x: fromX, z: fromZ };
    this.fleeTime = range(Math.random, 2.4, 4.2);
    this.group.userData.alert.visible = true;
  }

  step(dt, colliders) {
    const u = this.group.userData;
    if (this.mode === 'down') {
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.28;
      this.downTime -= dt;
      if (this.downTime <= 0) {
        this.group.rotation.x = 0;
        this.group.position.y = 0;
        this.health = 55;
        this.flee(this.pos.x + 4, this.pos.z + 4);
      }
      return;
    }
    let speed = 0;
    if (this.mode === 'flee') {
      this.fleeTime -= dt;
      const dx = this.pos.x - this.fleeFrom.x;
      const dz = this.pos.z - this.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      const target = Math.atan2(dx / d, dz / d);
      this.heading += wrapDelta(target - this.heading) * Math.min(1, dt * 8);
      speed = 4.3;
      if (this.fleeTime <= 0) {
        this.mode = 'walk';
        u.alert.visible = false;
        this.placeOnSidewalk(Math.random, { x: this.pos.x, z: this.pos.z });
        return;
      }
    } else {
      // Walk the pavement: steer to the walking line, turn at junctions sometimes.
      const cross = sidewalkCoordinate(this.line, this.side);
      const along = this.axis === 'x' ? this.pos.x : this.pos.z;
      let junction = null;
      for (const line of STREET_LINES) {
        const d = (line - along) * this.dir;
        if (d > 0.5 && (junction === null || d < junction.d)) junction = { line, d };
      }
      if (junction && junction.d < 2.2 && this.decidedAt !== junction.line) {
        this.decidedAt = junction.line;
        if (Math.random() < 0.45) {
          // Turn onto the crossing street's pavement.
          const oldAxis = this.axis;
          this.axis = oldAxis === 'x' ? 'z' : 'x';
          this.line = junction.line;
          this.side = Math.random() < 0.5 ? 1 : -1;
          this.dir = Math.random() < 0.5 ? 1 : -1;
        }
      }
      if (junction && junction.d > 4) this.decidedAt = null;
      const ahead = 3.2;
      const tx = this.axis === 'x' ? this.pos.x + this.dir * ahead : cross;
      const tz = this.axis === 'x' ? cross : this.pos.z + this.dir * ahead;
      const target = Math.atan2(tx - this.pos.x, tz - this.pos.z);
      this.heading += wrapDelta(target - this.heading) * Math.min(1, dt * 6);
      speed = this.speed;
    }
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    resolveCircle(colliders, this.pos, 0.4);
    this.pos.x = Math.max(-24, Math.min(334, this.pos.x));
    this.pos.z = Math.max(-24, Math.min(350, this.pos.z));
    this.phase += dt * speed * 3.4;
    const swing = Math.sin(this.phase) * (this.mode === 'flee' ? 0.85 : 0.55);
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    this.group.rotation.y = this.heading;
  }
}

/** Wrap an angle to [-PI, PI]. */
function wrapDelta(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class PedestrianManager {
  constructor(scene, rnd, colliders, count = 22) {
    this.scene = scene;
    this.rnd = rnd;
    this.colliders = colliders;
    this.peds = [];
    for (let i = 0; i < count; i += 1) {
      const ped = new Pedestrian(scene, rnd);
      ped.placeOnSidewalk(rnd, randomSidewalkPoint(rnd, { x: 150, z: 200 }, 150));
      this.peds.push(ped);
    }
  }

  /** Frighten every walker within `radius` of (x, z). */
  panicAt(x, z, radius = 17) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.flee(x, z);
    }
  }

  /** The nearest standing walker within `range` of a point, or null. */
  nearest(x, z, range) {
    let best = null;
    let bestD = range;
    for (const ped of this.peds) {
      if (ped.mode === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  update(dt, playerPos) {
    for (const ped of this.peds) {
      // Keep the crowd near Dario: far walkers reappear on nearer pavements.
      if (Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z) > 175 && ped.mode !== 'down') {
        ped.placeOnSidewalk(this.rnd, randomSidewalkPoint(this.rnd, playerPos, 120));
      }
      ped.step(dt, this.colliders);
    }
  }
}
