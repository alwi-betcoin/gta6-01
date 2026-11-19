// The player on foot: Dario "Dash" Kane, a stylised low-poly figure built from boxes with a
// swinging walk cycle, a raised-arm pistol pose and a punch swing. The controller walks him
// with WASD relative to the camera, sprints, jumps, and keeps him out of buildings with the
// same circle-vs-AABB rule the cars use.

import * as THREE from '../vendor/three.module.min.js';
import { PLAYER } from './config.js';

const SKIN = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
const SHIRT = new THREE.MeshLambertMaterial({ color: 0x0f7f7a });
const SHORTS = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
const HAIR = new THREE.MeshLambertMaterial({ color: 0x241a12 });
const GUN = new THREE.MeshLambertMaterial({ color: 0x22242a });

/** Push a circle (x, z, radius) out of every AABB it overlaps; returns the deepest push. */
export function resolveCircle(colliders, pos, radius) {
  let deepest = 0;
  for (const c of colliders) {
    if (pos.x < c.x0 - radius || pos.x > c.x1 + radius || pos.z < c.z0 - radius || pos.z > c.z1 + radius) continue;
    const nx = Math.max(c.x0, Math.min(c.x1, pos.x));
    const nz = Math.max(c.z0, Math.min(c.z1, pos.z));
    let dx = pos.x - nx;
    let dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 0.0001) {
      dx = pos.x - (c.x0 + c.x1) / 2;
      dz = pos.z - (c.z0 + c.z1) / 2;
      if (Math.abs(dx) > Math.abs(dz)) pos.x = dx > 0 ? c.x1 + radius : c.x0 - radius;
      else pos.z = dz > 0 ? c.z1 + radius : c.z0 - radius;
      deepest = radius;
    } else {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (radius - d);
      pos.z += (dz / d) * (radius - d);
      deepest = Math.max(deepest, radius - d);
    }
  }
  return deepest;
}

/** Build the figure: a group facing +z, with limb pivots in userData for the walk cycle. */
export function buildCharacterMesh() {
  const group = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const legGeo = new THREE.BoxGeometry(0.21, 0.78, 0.24);
  const legL = new THREE.Group();
  legL.position.set(-0.14, 0.8, 0);
  const legR = new THREE.Group();
  legR.position.set(0.14, 0.8, 0);
  add(legGeo, SHORTS, 0, -0.36, 0, legL);
  add(legGeo, SHORTS, 0, -0.36, 0, legR);
  group.add(legL, legR);
  add(new THREE.BoxGeometry(0.54, 0.62, 0.3), SHIRT, 0, 1.12, 0);
  add(new THREE.BoxGeometry(0.56, 0.14, 0.32), SHORTS, 0, 0.78, 0);
  const armGeo = new THREE.BoxGeometry(0.17, 0.68, 0.2);
  const armL = new THREE.Group();
  armL.position.set(-0.36, 1.38, 0);
  const armR = new THREE.Group();
  armR.position.set(0.36, 1.38, 0);
  add(armGeo, SKIN, 0, -0.3, 0, armL);
  add(armGeo, SKIN, 0, -0.3, 0, armR);
  group.add(armL, armR);
  const pistol = add(new THREE.BoxGeometry(0.09, 0.14, 0.34), GUN, 0, -0.62, 0.14, armR);
  pistol.visible = false;
  add(new THREE.BoxGeometry(0.34, 0.36, 0.34), SKIN, 0, 1.66, 0);
  add(new THREE.BoxGeometry(0.37, 0.12, 0.37), HAIR, 0, 1.86, 0);
  add(new THREE.BoxGeometry(0.37, 0.05, 0.2), HAIR, 0, 1.8, 0.24);
  group.userData = { legL, legR, armL, armR, pistol };
  return group;
}

/** Dario in the world: pose, health, weapon and the on-foot controller. */
export class Player {
  constructor(scene) {
    this.group = buildCharacterMesh();
    scene.add(this.group);
    this.pos = this.group.position;
    this.pos.set(150, 0, 306);
    this.heading = Math.PI;
    this.velY = 0;
    this.grounded = true;
    this.health = PLAYER.maxHealth;
    this.weapon = 'fists';
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.lastHurtAt = -99;
    this.speedNow = 0;
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  /** Show or hide the pistol in the right hand. */
  setWeapon(weapon) {
    this.weapon = weapon;
    this.group.userData.pistol.visible = weapon === 'pistol';
  }

  /**
   * Walk. `move` is a world-space direction { x, z } (already camera-relative, length ≤ 1),
   * `sprint` and `jump` are booleans. Colliders keep him out of buildings and props.
   */
  step(dt, move, sprint, jump, colliders) {
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const moving = Math.hypot(move.x, move.z) > 0.05;
    if (moving) {
      const target = Math.atan2(move.x, move.z);
      let diff = target - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 12);
      this.pos.x += move.x * speed * dt;
      this.pos.z += move.z * speed * dt;
      this.speedNow = speed;
    } else {
      this.speedNow = 0;
    }
    if (jump && this.grounded) {
      this.velY = 5.4;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.velY -= 15 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.velY = 0;
        this.grounded = true;
      }
    }
    resolveCircle(colliders, this.pos, PLAYER.radius);
    this.pos.x = Math.max(-26, Math.min(336, this.pos.x));
    this.pos.z = Math.max(-26, Math.min(352, this.pos.z));

    // Walk cycle: legs and arms swing against each other; the gun arm stays up when drawn.
    this.walkPhase += dt * (this.speedNow > 0 ? this.speedNow * 1.9 : 0);
    const swing = Math.sin(this.walkPhase) * (this.speedNow > 0 ? 0.62 : 0);
    const u = this.group.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = this.weapon === 'pistol' ? -0.5 : -swing * 0.8;
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      u.armR.rotation.x = -1.9 + Math.sin((this.punchTimer / 0.28) * Math.PI) * 0.7;
    } else if (this.weapon === 'pistol') {
      u.armR.rotation.x = -Math.PI / 2 + 0.06;
    } else {
      u.armR.rotation.x = swing * 0.8;
    }
    this.group.rotation.y = this.heading;
  }

  /** Start the punch swing (combat times the hit to the middle of it). */
  punch() {
    this.punchTimer = 0.28;
  }

  /** Muzzle world position for tracers and flashes when the pistol fires. */
  muzzlePoint(out) {
    const f = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    out.set(this.pos.x + f.x * 0.55, 1.32, this.pos.z + f.z * 0.55);
    return out;
  }
}
