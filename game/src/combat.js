// Combat: Dario's fists and pistol, and the people who shoot back. The pistol is hitscan
// from the camera's centre (where the crosshair sits): a raycast over the shootable groups
// — pedestrians, cars, cruisers — with a tracer and muzzle flash whatever it hits. Enemy
// fire (police at high heat, Cordero guards) is timer-and-chance based, drawn as tracers
// from their position so the player can see where shots come from and take cover by moving.

import * as THREE from '../vendor/three.module.min.js';
import { PLAYER } from './config.js';
import { buildPedMesh } from './pedestrians.js';
import { range } from './random.js';

const _ray = new THREE.Raycaster();
const _centre = new THREE.Vector2(0, 0);
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

/** Walk up from a hit mesh to the object that owns it (a Car or Pedestrian in userData). */
function ownerOf(object) {
  let node = object;
  while (node) {
    if (node.userData && (node.userData.car || node.userData.ped || node.userData.shooter)) return node;
    node = node.parent;
  }
  return null;
}

export class Combat {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.fireCooldown = 0;
    this.punchCooldown = 0;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
  }

  /**
   * A punch: the nearest walker in front of Dario within range takes it. Returns
   * { ped } on a hit, { car } when he dents a car instead, or null for thin air.
   */
  punch(player, peds, cars) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.34;
    player.punch();
    this.audio.punch();
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let best = null;
    let bestD = PLAYER.punchRange;
    for (const ped of peds) {
      if (ped.mode === 'down') continue;
      const dx = ped.x - player.x;
      const dz = ped.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD && dx * fx + dz * fz > 0.1) {
        best = ped;
        bestD = d;
      }
    }
    if (best) return { ped: best };
    for (const car of cars) {
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < PLAYER.punchRange + car.radius) {
        car.damage(2.5);
        return { car };
      }
    }
    return null;
  }

  /**
   * Fire the pistol. `groups` are the scene groups whose children are shootable; their
   * owners carry userData.car / userData.ped. Returns a hit description or null.
   */
  shoot(player, camera, groups) {
    if (this.fireCooldown > 0) return null;
    this.fireCooldown = 0.21;
    this.audio.shot();
    player.muzzlePoint(_muzzle);
    this.effects.muzzle(_muzzle);
    _ray.setFromCamera(_centre, camera);
    _ray.far = 90;
    const hits = _ray.intersectObjects(groups, true);
    let end = null;
    let owner = null;
    for (const hit of hits) {
      owner = ownerOf(hit.object);
      end = hit.point;
      if (owner || hit.object.isMesh) break;
    }
    if (!end) {
      end = _ray.ray.at(70, new THREE.Vector3());
      owner = null;
    }
    this.effects.tracer(_muzzle, end);
    if (!owner) return { point: end, owner: null };
    if (owner.userData.ped) return { point: end, owner: 'ped', ped: owner.userData.ped };
    if (owner.userData.shooter) return { point: end, owner: 'shooter', shooter: owner.userData.shooter };
    if (owner.userData.car) return { point: end, owner: 'car', car: owner.userData.car };
    return { point: end, owner: null };
  }

  /**
   * An enemy shot at Dario from `fromPos`: draws the tracer, plays the crack at a volume
   * by distance, and reports whether it lands (chance falls with range and player speed).
   */
  enemyShoot(fromPos, playerPos, playerSpeed, dist) {
    this.audio.enemyShot();
    _from.set(fromPos.x, 1.35, fromPos.z);
    const spread = 0.7 + playerSpeed * 0.05;
    _to.set(
      playerPos.x + (Math.random() - 0.5) * spread,
      1.1 + (Math.random() - 0.5) * 0.4,
      playerPos.z + (Math.random() - 0.5) * spread,
    );
    this.effects.tracer(_from, _to);
    this.effects.muzzle(_from);
    const chance = Math.max(0.06, 0.52 - dist * 0.009 - playerSpeed * 0.012);
    return Math.random() < chance;
  }
}

/** A Cordero guard: a walker mesh with a gun, a post to hold and a temper. */
export class Shooter {
  constructor(scene, rnd, x, z) {
    this.group = buildPedMesh(rnd);
    this.group.position.set(x, 0, z);
    this.group.userData.shooter = this;
    scene.add(this.group);
    this.pos = this.group.position;
    this.health = 80;
    this.active = false;
    this.dead = false;
    this.shootTimer = range(rnd, 0.7, 1.4);
    this.heading = range(rnd, 0, Math.PI * 2);
  }

  get x() { return this.pos.x; }
  get z() { return this.pos.z; }

  hurt(damage) {
    this.health -= damage;
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.28;
    }
    return this.dead;
  }

  /** Face the player and, when active and in range, take shots on a timer. */
  update(dt, playerPos, combat) {
    if (this.dead || !this.active) return null;
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.heading = Math.atan2(dx, dz);
    this.group.rotation.y = this.heading;
    this.shootTimer -= dt;
    if (dist < 34 && this.shootTimer <= 0) {
      this.shootTimer = range(Math.random, 1.1, 1.9);
      return { dist };
    }
    return null;
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}
