// Vehicles: a factory that builds each Port Solano car type from boxes (sedan, muscle,
// truck, convertible, taxi, police) and the arcade Car that drives it — throttle, steering
// that tightens with speed, handbrake drift, building and car collisions, damage and smoke.
// Wheels steer and spin; police light bars flash; headlights and tail lights glow.

import * as THREE from '../vendor/three.module.min.js';
import { forwardOf } from './city-layout.js';

const GLASS = new THREE.MeshLambertMaterial({ color: 0x1d2b38 });
const TYRE = new THREE.MeshLambertMaterial({ color: 0x17181a });
const HUB = new THREE.MeshLambertMaterial({ color: 0xb9bec6 });
const CHROME = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
const HEADLIGHT = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
const TAILLIGHT = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
const HUB_GEO = new THREE.CylinderGeometry(0.19, 0.19, 0.3, 8);

export const CAR_TYPES = {
  sedan: { length: 4.4, width: 1.9, maxSpeed: 34, accel: 25, colors: [0xc23b2e, 0x2a6fb5, 0xe8e3d8, 0x3a3f45, 0xe0a81c, 0x1f8a70] },
  muscle: { length: 4.7, width: 2.0, maxSpeed: 41, accel: 31, colors: [0xff6b1a, 0x8e2bc0, 0x15161c, 0x0e7a4f] },
  truck: { length: 5.3, width: 2.1, maxSpeed: 30, accel: 21, colors: [0x7a4a2b, 0x4a6741, 0x707880, 0xb03a2e] },
  convertible: { length: 4.3, width: 1.9, maxSpeed: 37, accel: 28, colors: [0xff5da2, 0x39d0ff, 0xf6f1e6, 0xffc93f] },
  taxi: { length: 4.4, width: 1.9, maxSpeed: 33, accel: 25, colors: [0xffc93f] },
  police: { length: 4.5, width: 1.95, maxSpeed: 39, accel: 30, colors: [0x14161c] },
};

/** Build one car's mesh group (facing +z), with steer/spin wheel refs in userData. */
export function buildCarMesh(type, color) {
  const spec = CAR_TYPES[type];
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const L = spec.length;
  const W = spec.width;
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const bodyH = type === 'truck' ? 0.85 : 0.62;
  add(new THREE.BoxGeometry(W, bodyH, L), paint, 0, 0.42 + bodyH / 2, 0);
  add(new THREE.BoxGeometry(W - 0.15, 0.16, L * 0.4), paint, 0, 0.5, L * 0.28); // bonnet slope block
  if (type === 'truck') {
    add(new THREE.BoxGeometry(W - 0.1, 0.85, 1.5), paint, 0, 1.55, L * 0.22);
    add(new THREE.BoxGeometry(W - 0.3, 0.5, 1.3), GLASS, 0, 1.6, L * 0.24);
    add(new THREE.BoxGeometry(W - 0.06, 0.5, L * 0.42), new THREE.MeshLambertMaterial({ color: 0x5c4632 }), 0, 1.05, -L * 0.26);
  } else if (type === 'convertible') {
    add(new THREE.BoxGeometry(W - 0.3, 0.34, 0.9), GLASS, 0, 1.12, L * 0.08);
    add(new THREE.BoxGeometry(W - 0.25, 0.3, 1.5), new THREE.MeshLambertMaterial({ color: 0x40260a }), 0, 1.02, -L * 0.2);
  } else {
    add(new THREE.BoxGeometry(W - 0.3, 0.52, L * 0.46), GLASS, 0, 1.28, -L * 0.03);
    add(new THREE.BoxGeometry(W - 0.42, 0.1, L * 0.4), paint, 0, 1.58, -L * 0.03);
  }
  if (type === 'muscle') {
    add(new THREE.BoxGeometry(0.7, 0.16, 0.9), paint, 0, 1.12, L * 0.18);
    add(new THREE.BoxGeometry(W - 0.2, 0.09, 0.4), paint, 0, 1.24, -L * 0.46);
    add(new THREE.BoxGeometry(0.12, 0.22, 0.3), CHROME, -0.5, 0.95, -L * 0.47);
    add(new THREE.BoxGeometry(0.12, 0.22, 0.3), CHROME, 0.5, 0.95, -L * 0.47);
  }
  if (type === 'taxi') {
    add(new THREE.BoxGeometry(0.9, 0.24, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff6bf }), 0, 1.72, -L * 0.03);
  }
  if (type === 'police') {
    add(new THREE.BoxGeometry(W + 0.02, 0.4, L * 0.3), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 0, 0.78, -0.1);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.32;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.32;
    bar.add(red, blue);
    bar.position.set(0, 1.68, -L * 0.03);
    group.add(bar);
    group.userData.lightbar = { red: red.material, blue: blue.material };
  }
  // Lights: two headlights, two tail lights, bright enough to read at dusk.
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, 0.14, 0.06), HEADLIGHT, sx * (W / 2 - 0.3), 0.78, L / 2 + 0.01);
    add(new THREE.BoxGeometry(0.34, 0.12, 0.06), TAILLIGHT, sx * (W / 2 - 0.3), 0.82, -L / 2 - 0.01);
  }
  const wheels = [];
  const pivots = [];
  for (const [wx, wz] of [[-W / 2, L / 2 - 0.85], [W / 2, L / 2 - 0.85], [-W / 2, -L / 2 + 0.85], [W / 2, -L / 2 + 0.85]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(WHEEL_GEO, TYRE);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(HUB_GEO, HUB);
    hub.rotation.z = Math.PI / 2;
    spin.add(tyre, hub);
    pivot.add(spin);
    group.add(pivot);
    wheels.push(spin);
    pivots.push(pivot);
  }
  group.userData.wheels = wheels;
  group.userData.pivots = pivots;
  return group;
}

/** One car in the world: pose, arcade physics state, health and its driver kind. */
export class Car {
  constructor(scene, type, color, x, z, heading) {
    this.type = type;
    this.spec = CAR_TYPES[type];
    this.group = buildCarMesh(type, color);
    this.group.userData.car = this;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.velX = 0;
    this.velZ = 0;
    this.steer = 0;
    this.health = 100;
    this.radius = 1.75;
    this.dead = false;
    this.smoking = false;
    this.honkCooldown = 0;
    this.crashCooldown = 0;
    this.onCrash = null;
  }

  get pos() {
    return this.group.position;
  }

  /** Advance the arcade physics. input: { throttle, steer, handbrake }. Returns events. */
  step(dt, input, colliders) {
    const events = { crashed: 0, drifting: false };
    const spec = this.spec;
    const throttle = this.dead ? 0 : input.throttle;
    if (throttle > 0) this.speed += spec.accel * throttle * dt * (this.speed < 0 ? 2.2 : 1);
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= spec.accel * 1.6 * dt;
      else this.speed += spec.accel * 0.55 * throttle * dt;
    }
    const top = this.speed >= 0 ? spec.maxSpeed : 11;
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 0.12 && throttle === 0) this.speed = 0;
    this.speed = Math.max(-11, Math.min(top, this.speed));

    const steerTarget = (this.dead ? 0 : input.steer) * 0.62 / (1 + Math.abs(this.speed) * 0.05);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 9);
    if (Math.abs(this.speed) > 0.2) {
      const turn = this.steer * this.speed * dt * (input.handbrake ? 0.42 : 0.30);
      this.heading += turn;
    }
    // Velocity is kept as forward speed plus a lateral slide: steering re-aims the forward
    // part, the slide decays with grip — slowly under the handbrake, which is the drift.
    const f = forwardOf(this.heading);
    const fSpeed = this.velX * f.x + this.velZ * f.z;
    let latX = this.velX - f.x * fSpeed;
    let latZ = this.velZ - f.z * fSpeed;
    const latDecay = Math.exp(-(input.handbrake ? 1.5 : 8.0) * dt);
    latX *= latDecay;
    latZ *= latDecay;
    this.velX = f.x * this.speed + latX;
    this.velZ = f.z * this.speed + latZ;
    if (input.handbrake && Math.abs(this.speed) > 9) events.drifting = true;
    this.x += this.velX * dt;
    this.z += this.velZ * dt;

    // Buildings: circle against each nearby AABB, pushed out along the shallow axis.
    if (colliders) {
      for (const c of colliders) {
        if (this.x < c.x0 - 3 || this.x > c.x1 + 3 || this.z < c.z0 - 3 || this.z > c.z1 + 3) continue;
        const nx = Math.max(c.x0, Math.min(c.x1, this.x));
        const nz = Math.max(c.z0, Math.min(c.z1, this.z));
        let dx = this.x - nx;
        let dz = this.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= this.radius * this.radius) continue;
        const impact = Math.abs(this.velX * (dx) + this.velZ * (dz));
        if (d2 < 0.0001) {
          dx = this.x - (c.x0 + c.x1) / 2;
          dz = this.z - (c.z0 + c.z1) / 2;
          if (Math.abs(dx) > Math.abs(dz)) { this.x = dx > 0 ? c.x1 + this.radius : c.x0 - this.radius; this.velX = 0; }
          else { this.z = dz > 0 ? c.z1 + this.radius : c.z0 - this.radius; this.velZ = 0; }
        } else {
          const d = Math.sqrt(d2);
          const push = this.radius - d;
          this.x += (dx / d) * push;
          this.z += (dz / d) * push;
          const vn = this.velX * (dx / d) + this.velZ * (dz / d);
          if (vn < 0) {
            this.velX -= vn * (dx / d) * 1.4;
            this.velZ -= vn * (dz / d) * 1.4;
            this.speed *= 0.55;
          }
        }
        if (impact > 3.2 && this.crashCooldown <= 0) {
          events.crashed = Math.min(1, impact / 14);
          this.damage(impact * 1.1);
          this.crashCooldown = 0.25;
        }
      }
    }
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    this.honkCooldown = Math.max(0, this.honkCooldown - dt);

    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.36;
    for (const wheel of this.group.userData.wheels) wheel.rotation.x += spin;
    const pivots = this.group.userData.pivots;
    pivots[0].rotation.y = this.steer * 0.85;
    pivots[1].rotation.y = this.steer * 0.85;
    this.smoking = this.health < 45;
    return events;
  }

  /** Car-to-car push: separates overlapping cars and trades a little health.
   *  A parked car (other.parked) does not move: this car takes the whole push. */
  collideCar(other, dt) {
    if (this.parked) return 0;
    const dx = this.x - other.x;
    const dz = this.z - other.z;
    const rr = this.radius + other.radius - 0.5;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 0.0001) return 0;
    const d = Math.sqrt(d2);
    const push = other.parked ? rr - d : (rr - d) / 2;
    const ux = dx / d;
    const uz = dz / d;
    this.x += ux * push;
    this.z += uz * push;
    if (!other.parked) {
      other.x -= ux * push;
      other.z -= uz * push;
      other.group.position.set(other.x, 0, other.z);
    }
    const rel = Math.abs((this.velX - other.velX) * ux + (this.velZ - other.velZ) * uz);
    if (rel > 3) {
      this.damage(rel * 0.7);
      other.damage(rel * 0.7);
      return Math.min(1, rel / 13);
    }
    return 0;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.speed = 0;
    }
  }

  /** World-space point of the engine bay, where damage smoke rises. */
  smokePoint(out) {
    const f = forwardOf(this.heading);
    out.set(this.x + f.x * this.spec.length * 0.32, 1.15, this.z + f.z * this.spec.length * 0.32);
    return out;
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}
