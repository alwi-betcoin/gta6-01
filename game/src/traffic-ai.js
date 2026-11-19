// Traffic: Port Solano's own drivers. Each car follows the street plan in city-layout —
// right-hand lanes, a choice at every junction, braking for the car ahead, honking when
// stuck, and a burst of panic when shots ring out or a maniac bears down on them. Cars that
// wander too far from Dario quietly re-enter the city nearer to him, so the streets around
// the player are never empty. Parked cars are spawned here too.

import { STREET_LINES } from './config.js';
import { headingFor, laneCoordinate, parkingSpots, randomRoadPoint } from './city-layout.js';
import { Car, CAR_TYPES } from './vehicles.js';
import { pick, range } from './random.js';

const DRIVABLE = ['sedan', 'sedan', 'muscle', 'truck', 'convertible', 'taxi'];

/** Wrap an angle to [-PI, PI]. */
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** A fresh route state for a car placed on a street. */
function routeState(rnd, axis, line, dir) {
  return { axis, line, dir, cruise: range(rnd, 9.5, 13.5), decidedAt: null, turn: 0, blockedTime: 0, panic: 0, stuckTime: 0 };
}

/** Place a car on a street with a coherent route state; returns the state. */
function placeOnStreet(rnd, car, axis, line, along, dir) {
  const lane = laneCoordinate(axis, line, dir);
  if (axis === 'x') {
    car.x = along;
    car.z = lane;
  } else {
    car.x = lane;
    car.z = along;
  }
  car.heading = headingFor(axis, dir);
  car.speed = 0;
  car.velX = 0;
  car.velZ = 0;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  return routeState(rnd, axis, line, dir);
}

/** Parked cars along the kerbs: stealable, collidable, going nowhere. */
export function spawnParkedCars(scene, rnd, count) {
  const spots = parkingSpots(rnd);
  const cars = [];
  for (let i = 0; i < Math.min(count, spots.length); i += 1) {
    const spot = spots[Math.floor((i / count) * spots.length)];
    const type = pick(rnd, DRIVABLE);
    const car = new Car(scene, type, pick(rnd, CAR_TYPES[type].colors), spot.x, spot.z, spot.ry + (rnd() < 0.5 ? 0 : Math.PI));
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

export class TrafficManager {
  constructor(scene, rnd, colliders, count = 11) {
    this.scene = scene;
    this.rnd = rnd;
    this.colliders = colliders;
    this.cars = [];
    this.onHonk = null;
    for (let i = 0; i < count; i += 1) {
      const type = pick(rnd, DRIVABLE);
      const car = new Car(scene, type, pick(rnd, CAR_TYPES[type].colors), 0, 0, 0);
      const axis = rnd() < 0.5 ? 'x' : 'z';
      const line = pick(rnd, STREET_LINES);
      const state = placeOnStreet(rnd, car, axis, line, range(rnd, -4, 324), rnd() < 0.5 ? 1 : -1);
      this.cars.push({ car, ...state });
    }
  }

  /** Every traffic car, for collision and raycast lists. */
  get vehicles() {
    return this.cars.map((t) => t.car);
  }

  /** Panic every driver within `radius` of a frightening event at (x, z). */
  panicAt(x, z, radius = 26) {
    for (const t of this.cars) {
      if (Math.hypot(t.car.x - x, t.car.z - z) < radius) t.panic = Math.max(t.panic, 2.6);
    }
  }

  /** The next junction line strictly ahead of `along` in direction `dir`, or null. */
  nextJunction(along, dir) {
    let best = null;
    for (const line of STREET_LINES) {
      const d = (line - along) * dir;
      if (d > 1.5 && (best === null || d < best.d)) best = { line, d };
    }
    return best;
  }

  update(dt, ctx) {
    const { playerPos, obstacles } = ctx;
    for (const t of this.cars) {
      const car = t.car;
      if (car.takenByPlayer) continue; // Dario took it: the AI never drives it again
      if (car.dead) {
        car.step(dt, { throttle: 0, steer: 0, handbrake: false }, this.colliders);
        continue;
      }
      // Recycle cars that drifted too far from the action.
      const distPlayer = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (distPlayer > 250) {
        const p = randomRoadPoint(this.rnd, playerPos, 105, 165);
        const axis = Math.abs(p.x - Math.round(p.x / 60) * 60) < 1 ? 'z' : 'x';
        const line = axis === 'z' ? Math.round(p.x / 60) * 60 : Math.round(p.z / 60) * 60;
        const along = axis === 'z' ? p.z : p.x;
        Object.assign(t, placeOnStreet(this.rnd, car, axis, line, along, this.rnd() < 0.5 ? 1 : -1));
        continue;
      }

      const along = t.axis === 'x' ? car.x : car.z;
      const junction = this.nextJunction(along, t.dir);
      // Decide a turn once per junction.
      if (junction && junction.d < 10 && t.decidedAt !== junction.line) {
        t.decidedAt = junction.line;
        const edge = junction.line === 0 || junction.line === 300;
        const roll = this.rnd();
        t.turn = edge ? (roll < 0.5 ? 1 : -1) : roll < 0.55 ? 0 : roll < 0.775 ? 1 : -1;
      }
      // Take the turn when close: switch the leg, keep the corner smooth via pursuit.
      if (junction && junction.d < 3.2 && t.turn !== 0 && t.decidedAt === junction.line) {
        const turn = t.turn;
        const oldAxis = t.axis;
        const oldDir = t.dir;
        const newLine = junction.line;
        if (oldAxis === 'x') {
          t.axis = 'z';
          t.dir = turn > 0 ? -oldDir : oldDir; // left (+1): -dir on z; right: +dir
        } else {
          t.axis = 'x';
          t.dir = turn > 0 ? oldDir : -oldDir;
        }
        t.line = newLine;
        t.turn = 0;
        t.decidedAt = null;
      }

      // Pursuit point: ahead on my lane, swung toward the new leg when a turn is set.
      const lane = laneCoordinate(t.axis, t.line, t.dir);
      let tx;
      let tz;
      if (t.axis === 'x') {
        tx = car.x + t.dir * 8;
        tz = lane;
      } else {
        tx = lane;
        tz = car.z + t.dir * 8;
      }
      if (junction && t.turn !== 0 && junction.d < 9) {
        // Aim at a point 9 m into the exit leg, on its right-hand lane.
        if (t.axis === 'x') {
          const exitDir = t.turn > 0 ? -t.dir : t.dir;
          tx = laneCoordinate('z', junction.line, exitDir);
          tz = t.line + exitDir * 9;
        } else {
          const exitDir = t.turn > 0 ? t.dir : -t.dir;
          tx = t.line + exitDir * 9;
          tz = laneCoordinate('x', junction.line, exitDir);
        }
      }
      const desired = Math.atan2(tx - car.x, tz - car.z);
      const steer = Math.max(-1, Math.min(1, wrapAngle(desired - car.heading) * 1.9));

      // Blocked? Anything solid ahead in my lane corridor.
      let blocked = false;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      for (const other of obstacles) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = dx * fx + dz * fz;
        if (ahead < 0.5 || ahead > 11) continue;
        const lateral = Math.abs(dx * fz - dz * fx);
        if (lateral < 2.3) {
          blocked = true;
          break;
        }
      }
      let targetSpeed = t.panic > 0 ? 16.5 : t.cruise;
      if (junction && t.turn !== 0 && junction.d < 11) targetSpeed = Math.min(targetSpeed, 6.5);
      if (blocked) targetSpeed = 0;
      t.panic = Math.max(0, t.panic - dt);
      t.blockedTime = blocked ? t.blockedTime + dt : 0;
      if (blocked && t.blockedTime > 1.6 && car.honkCooldown <= 0) {
        car.honkCooldown = range(this.rnd, 2.5, 5);
        if (this.onHonk) this.onHonk(car);
      }
      const throttle = car.speed < targetSpeed - 0.4 ? 0.85 : car.speed > targetSpeed + 0.4 ? -0.7 : 0;
      const events = car.step(dt, { throttle, steer, handbrake: false }, this.colliders);
      if (events.crashed > 0) t.panic = Math.max(t.panic, 1.2);
      // Stuck cars (wedged on a corner) quietly re-enter elsewhere.
      if (Math.abs(car.speed) < 0.35 && !blocked) {
        t.stuckTime += dt;
        if (t.stuckTime > 6) {
          const p = randomRoadPoint(this.rnd, playerPos, 105, 165);
          const axis = this.rnd() < 0.5 ? 'x' : 'z';
          const line = axis === 'x' ? Math.round(p.z / 60) * 60 : Math.round(p.x / 60) * 60;
          Object.assign(t, placeOnStreet(this.rnd, car, axis, line, axis === 'x' ? p.x : p.z, this.rnd() < 0.5 ? 1 : -1));
          t.stuckTime = 0;
        }
      } else {
        t.stuckTime = 0;
      }
    }
  }
}
