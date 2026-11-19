// Port Solano PD: cruisers spawn at the city's edge of earshot and hunt Dario down. They
// pursue by pure steering (aim where he will be), ram his car, box him in, and — at four
// stars and up — stop and shoot. On foot they close in to make the bust. Their light bars
// flash, their siren swells as the nearest one closes, and they report "eyes on" to the
// wanted system so heat only fades once he truly breaks away.

import { STREET_LINES } from './config.js';
import { randomRoadPoint } from './city-layout.js';
import { Car } from './vehicles.js';
import { range } from './random.js';

/** How many cruisers answer each star level. */
const COPS_BY_STARS = [0, 1, 2, 3, 4, 6];

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class PoliceManager {
  constructor(scene, rnd, colliders, wanted) {
    this.scene = scene;
    this.rnd = rnd;
    this.colliders = colliders;
    this.wanted = wanted;
    this.cops = []; // { car, shootTimer, role }
    this.spawnTimer = 0;
    this.onShootPlayer = null; // (copCar) => void, main applies the hit chance and damage
    this.time = 0;
  }

  get vehicles() {
    return this.cops.map((c) => c.car);
  }

  /** The closest cruiser to a point, and its distance. */
  nearestTo(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const cop of this.cops) {
      const d = Math.hypot(cop.car.x - x, cop.car.z - z);
      if (d < bestD) {
        bestD = d;
        best = cop.car;
      }
    }
    return { car: best, dist: bestD };
  }

  spawnCop(playerPos) {
    const p = randomRoadPoint(this.rnd, playerPos, 88, 125);
    const car = new Car(this.scene, 'police', 0x14161c, p.x, p.z, range(this.rnd, 0, Math.PI * 2));
    car.health = 130;
    this.cops.push({ car, shootTimer: range(this.rnd, 0.8, 1.6), role: this.cops.length % 2 });
    return car;
  }

  update(dt, ctx) {
    this.time += dt;
    const { playerPos, playerInCar, playerCar, playerSpeed } = ctx;
    const stars = this.wanted.stars;
    const wantedCount = COPS_BY_STARS[stars] ?? 0;

    // Spawn up to strength, retire distant cruisers when the heat is gone.
    this.spawnTimer -= dt;
    const alive = this.cops.filter((c) => !c.car.dead);
    if (stars > 0 && alive.length < wantedCount && this.spawnTimer <= 0) {
      this.spawnCop(playerPos);
      this.spawnTimer = 1.6;
    }
    for (let i = this.cops.length - 1; i >= 0; i -= 1) {
      const cop = this.cops[i];
      const d = Math.hypot(cop.car.x - playerPos.x, cop.car.z - playerPos.z);
      if ((stars === 0 && d > 60) || d > 260) {
        cop.car.dispose(this.scene);
        this.cops.splice(i, 1);
      }
    }

    let sighted = false;
    let nearestDist = Infinity;
    for (const cop of this.cops) {
      const car = cop.car;
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);
      if (dist < 58 && !car.dead) sighted = true;

      // Light bar: alternate red/blue twice a second.
      const bar = car.group.userData.lightbar;
      if (bar) {
        const phase = Math.sin(this.time * 11 + cop.role) > 0;
        bar.red.color.setHex(phase ? 0xff2222 : 0x551111);
        bar.blue.color.setHex(phase ? 0x112255 : 0x2266ff);
      }
      if (car.dead) {
        car.step(dt, { throttle: 0, steer: 0, handbrake: false }, this.colliders);
        continue;
      }

      // Aim point: the player's position, led by his velocity when he is driving.
      let aimX = playerPos.x;
      let aimZ = playerPos.z;
      if (playerInCar && playerCar) {
        aimX += playerCar.velX * Math.min(0.7, dist / 60);
        aimZ += playerCar.velZ * Math.min(0.7, dist / 60);
      }
      // The second cruiser aims at a flank so they box rather than queue.
      if (cop.role === 1 && dist < 26) {
        const px = -dz / (dist || 1);
        const pz = dx / (dist || 1);
        aimX += px * 7;
        aimZ += pz * 7;
      }
      const desired = Math.atan2(aimX - car.x, aimZ - car.z);
      const steer = Math.max(-1, Math.min(1, wrapAngle(desired - car.heading) * 2.1));

      // Speed policy: full chase far away; match and press when close; hold off a little
      // when Dario is on foot so the bust can happen instead of a flattening.
      let throttle = 0;
      const topSpeed = 37 + stars * 0.8;
      if (!playerInCar && dist < 4.2) {
        throttle = car.speed > 0.4 ? -0.9 : 0;
      } else if (dist > 7) {
        throttle = car.speed < topSpeed ? 1 : 0;
      } else {
        throttle = car.speed < Math.max(6, playerSpeed + 3) ? 0.7 : -0.4;
      }
      if (Math.abs(wrapAngle(desired - car.heading)) > 2.4 && dist < 9) throttle = -0.8; // reverse out of a bad angle
      car.step(dt, { throttle, steer, handbrake: false }, this.colliders);

      // At four stars and up, a stopped cruiser's officer shoots.
      cop.shootTimer -= dt;
      if (stars >= 4 && dist < 36 && Math.abs(car.speed) < 3.5 && cop.shootTimer <= 0) {
        cop.shootTimer = range(this.rnd, 1.0, 1.7);
        if (this.onShootPlayer) this.onShootPlayer(car);
      }
    }
    this.wanted.setSighted(sighted);
    return { nearestDist, sighted };
  }
}
