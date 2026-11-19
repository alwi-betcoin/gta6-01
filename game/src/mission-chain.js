// The story: four jobs for fixer Marisol Vega that take Dario "Dash" Kane from errand boy
// to the man who robbed Brillo Jewelers — a timed delivery, a noticed car theft, a harbour
// checkpoint race, and a robbery with a getaway — plus endless taxi fares between jobs.
// The runner owns the gold beacon, the objective text and timers, the mission state
// machine, and the Cordero guards who open fire during the robbery. main.js feeds it the
// world (player, car, wanted, cash) through one context object.

import * as THREE from '../vendor/three.module.min.js';
import { LANDMARKS } from './config.js';
import { randomSidewalkPoint } from './city-layout.js';
import { buildPedMesh } from './pedestrians.js';
import { Shooter } from './combat.js';

const MARISOL = 'Marisol';
const DARIO = 'Dario';

/** The story chain. Steps are driven by the runner's state machine below. */
export const STORY = [
  {
    title: 'FIRST RUN',
    pay: 400,
    intro: [
      [MARISOL, 'Dash. You drive, I pay, nobody asks what is in the box. Dock warehouse, south marina.'],
      [DARIO, 'And if the box ticks?'],
      [MARISOL, 'Then drive faster, mi amor.'],
    ],
  },
  {
    title: 'THE CORDERO SPECIAL',
    pay: 800,
    intro: [
      [MARISOL, 'The Cordero crew left a muscle car downtown, keys in, engine warm. It offends me.'],
      [MARISOL, 'Take it to Sal at the chop garage. If the police notice — and they will — that is your problem.'],
    ],
  },
  {
    title: 'HARBOR SPRINT',
    pay: 650,
    intro: [
      [MARISOL, 'A sponsor wants proof my drivers are quick. Six checkpoints, one clock, whole city.'],
      [DARIO, 'Finally, a job where speeding is the job.'],
    ],
  },
  {
    title: 'THE SOLANO SCORE',
    pay: 1200,
    intro: [
      [MARISOL, 'Brillo Jewelers, on the strip. Their safe is fat and their guard is lazy.'],
      [MARISOL, 'Take the stones, lose the police, and bring yourself to my warehouse. Then we are even with the Corderos.'],
    ],
  },
];

/** Race checkpoints for Harbor Sprint: intersections spread across the whole grid. */
const RACE_POINTS = [
  { x: 60, z: 60 }, { x: 240, z: 60 }, { x: 300, z: 180 }, { x: 120, z: 240 }, { x: 60, z: 300 }, { x: 240, z: 300 },
];

export class MissionRunner {
  /**
   * ctx: { scene, hud, audio, player, wanted, combat, rnd,
   *        playerCar(), addCash(n), commitCrime(kind), trafficPanic(x,z),
   *        spawnSpecialCar(), despawnSpecialCar(car), persist() }
   * progress: the save object ({ nextMission, storyDone, faresDone }) — mutated in place.
   */
  constructor(ctx, progress) {
    this.ctx = ctx;
    this.progress = progress;
    this.mode = progress.storyDone ? 'fare' : 'offer';
    this.step = 0;
    this.timer = 0;
    this.channel = 0;
    this.raceIndex = 0;
    this.specialCar = null;
    this.guards = [];
    this.fare = null;
    this.passengerMesh = null;
    this.setupBeacon();
    if (this.mode === 'offer') this.offerCurrent();
    else this.newFare();
  }

  setupBeacon() {
    const geo = new THREE.CylinderGeometry(2.0, 2.0, 30, 20, 1, true);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.beacon = new THREE.Mesh(geo, this.beaconMat);
    this.beacon.position.y = 15;
    const ringGeo = new THREE.RingGeometry(1.7, 2.3, 28);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.12;
    this.ctx.scene.add(this.beacon, this.ring);
  }

  /** Point the beacon at a place with a colour, or hide it (null). */
  aimBeacon(at, color = 0xffd23f) {
    if (!at) {
      this.beacon.visible = false;
      this.ring.visible = false;
      this.target = null;
      return;
    }
    this.beacon.visible = true;
    this.ring.visible = true;
    this.beacon.position.set(at.x, 15, at.z);
    this.ring.position.set(at.x, 0.12, at.z);
    this.beaconMat.color.setHex(color);
    this.ringMat.color.setHex(color);
    this.target = at;
  }

  /** The current story mission's offer: beacon at Café Azul, special car placed for M2. */
  offerCurrent() {
    this.mode = 'offer';
    this.step = 0;
    if (this.progress.nextMission === 1 && !this.specialCar) {
      this.specialCar = this.ctx.spawnSpecialCar();
    }
    this.aimBeacon(LANDMARKS.fixerCafe);
  }

  /** Begin the offered mission: title banner and Marisol's briefing. */
  startMission() {
    const mission = STORY[this.progress.nextMission];
    this.mode = 'active';
    this.step = 0;
    this.channel = 0;
    this.raceIndex = 0;
    this.ctx.hud.banner(mission.title, 'A job for Marisol Vega');
    for (const [who, line] of mission.intro) this.ctx.hud.say(who, line, 3.6);
    this.ctx.audio.pickup();
  }

  /** Pay out, celebrate, persist, and offer the next job (or open the fare board). */
  completeMission() {
    const mission = STORY[this.progress.nextMission];
    this.ctx.addCash(mission.pay);
    this.ctx.hud.say(MARISOL, 'Good. Very good. Come see me when your hands stop shaking.', 3.6);
    this.ctx.audio.jingle();
    this.progress.nextMission += 1;
    if (this.progress.nextMission >= STORY.length) {
      this.progress.storyDone = true;
      this.ctx.hud.banner('STORY COMPLETE', `${mission.title} · +$${mission.pay} · Dario Kane owns his streets again`);
    } else {
      this.ctx.hud.banner('MISSION COMPLETE', `${mission.title} · +$${mission.pay}`);
    }
    this.cleanupMission();
    this.ctx.persist();
    if (this.progress.storyDone) this.newFare();
    else this.offerCurrent();
  }

  /** Fail the current job (a timer ran out): no pay, back to the café. */
  failMission(reason) {
    this.ctx.hud.banner('MISSION FAILED', reason);
    this.ctx.hud.say(MARISOL, 'Ay. Forget it. Come back to the café, we try again.', 3.4);
    this.ctx.audio.fail();
    this.cleanupMission();
    if (this.progress.storyDone) this.newFare();
    else this.offerCurrent();
  }

  cleanupMission() {
    for (const guard of this.guards) guard.dispose(this.ctx.scene);
    this.guards = [];
    if (this.specialCar && this.progress.nextMission !== 1) {
      this.ctx.despawnSpecialCar(this.specialCar);
      this.specialCar = null;
    }
    this.mode = 'offer';
    this.step = 0;
  }

  /** A repeatable fare: pick a passenger up, drive them across town, get paid by distance. */
  newFare() {
    this.mode = 'fare';
    this.fareStage = 'pickup';
    const { player } = this.ctx;
    const pickup = randomSidewalkPoint(this.ctx.rnd, player.pos, 130);
    const dest = randomSidewalkPoint(this.ctx.rnd, pickup, 320);
    const dist = Math.hypot(dest.x - pickup.x, dest.z - pickup.z);
    this.fare = { pickup, dest, dist, pay: 60 + Math.round(dist / 5), timer: 30 + dist / 7.5 };
    if (this.passengerMesh) this.ctx.scene.remove(this.passengerMesh);
    this.passengerMesh = buildPedMesh(this.ctx.rnd);
    this.passengerMesh.position.set(pickup.x, 0, pickup.z);
    this.ctx.scene.add(this.passengerMesh);
    this.aimBeacon(pickup, 0x51e06a);
  }

  /** main.js tells the runner when Dario gets into a car (the theft beat needs it). */
  notifyEnterCar(car) {
    if (this.mode === 'active' && this.progress.nextMission === 1 && this.step === 0 && car === this.specialCar) {
      this.step = 1;
      this.ctx.commitCrime('theft');
      this.ctx.wanted.raiseTo(2);
      this.ctx.hud.say(MARISOL, 'That is the one! Sal is waiting — move!', 3);
      this.ctx.audio.pickup();
    }
  }

  /** The minimap's gold target and green fare point. */
  mapTarget() {
    return this.mode === 'fare' ? null : this.target;
  }

  mapFare() {
    return this.mode === 'fare' ? this.target : null;
  }

  /** The objective line for the HUD, refreshed by update(). */
  objective() {
    const m = this.progress.nextMission;
    if (this.mode === 'offer') {
      return { text: `Meet Marisol at Café Azul — next job: ${STORY[m].title}`, meta: '' };
    }
    if (this.mode === 'fare') {
      if (!this.fare) return null;
      if (this.fareStage === 'pickup') return { text: 'FARE: pick up the passenger (be in a car)', meta: `$${this.fare.pay} · ${Math.round(this.distTo(this.fare.pickup))} m` };
      return { text: 'FARE: drop your passenger at the green beacon', meta: `$${this.fare.pay} · ${Math.ceil(this.timer)} s · ${Math.round(this.distTo(this.fare.dest))} m` };
    }
    if (this.mode !== 'active') return null;
    if (m === 0) {
      if (this.step === 0) return { text: "Pick up Marisol's package at the marina dock", meta: `${Math.round(this.distTo(LANDMARKS.marinaDock))} m` };
      return { text: 'Deliver the package to Motel Palmas', meta: `${Math.ceil(this.timer)} s · ${Math.round(this.distTo(LANDMARKS.motelPalmas))} m` };
    }
    if (m === 1) {
      if (this.step === 0) return { text: 'Steal the marked Cordero muscle car (pink blip)', meta: `${Math.round(this.distTo(LANDMARKS.specialCar))} m` };
      return { text: "Deliver the car to Sal's Chop Garage", meta: `${Math.round(this.distTo(LANDMARKS.chopGarage))} m` };
    }
    if (m === 2) {
      return { text: `HARBOR SPRINT: hit checkpoint ${this.raceIndex + 1} of ${RACE_POINTS.length} — stay in a car`, meta: `${Math.ceil(this.timer)} s` };
    }
    if (m === 3) {
      if (this.step === 0) return { text: 'Rob Brillo Jewelers: stand in the beacon on foot', meta: this.channel > 0 ? `Robbing… ${Math.ceil(4 - this.channel)} s` : `${Math.round(this.distTo(LANDMARKS.stripStore))} m` };
      if (this.step === 1) return { text: 'LOSE THE COPS!', meta: 'Break away until the stars are gone' };
      return { text: "Reach Vega's warehouse hideout", meta: `${Math.round(this.distTo(LANDMARKS.hideout))} m` };
    }
    return null;
  }

  distTo(at) {
    const p = this.ctx.player.pos;
    return Math.hypot(p.x - at.x, p.z - at.z);
  }

  /** In-radius test against the player's feet or car. */
  near(at, radius) {
    return this.distTo(at) < radius;
  }

  update(dt) {
    const { player, hud } = this.ctx;
    const inCar = this.ctx.playerCar();
    // Beacon pulse.
    if (this.beacon.visible) {
      const s = 1 + Math.sin(performance.now() * 0.005) * 0.08;
      this.ring.scale.setScalar(s);
    }

    if (this.mode === 'offer') {
      if (this.near(LANDMARKS.fixerCafe, 6.5)) this.startMission();
      return;
    }

    if (this.mode === 'fare') {
      this.updateFare(dt, inCar);
      return;
    }
    if (this.mode !== 'active') return;

    const m = this.progress.nextMission;
    if (m === 0) this.updateFirstRun(dt, inCar);
    else if (m === 1) this.updateSpecial(dt, inCar);
    else if (m === 2) this.updateRace(dt, inCar);
    else if (m === 3) this.updateScore(dt, inCar);
    void hud;
    void player;
  }

  updateFirstRun(dt, inCar) {
    if (this.step === 0) {
      this.aimBeacon(LANDMARKS.marinaDock);
      if (this.near(LANDMARKS.marinaDock, 6)) {
        this.step = 1;
        this.timer = 100;
        this.ctx.audio.pickup();
        this.ctx.hud.say(DARIO, 'One ticking-free box. Motel Palmas, fast.', 2.8);
      }
    } else {
      this.aimBeacon(LANDMARKS.motelPalmas);
      this.timer -= dt;
      if (this.timer <= 0) return this.failMission('The delivery window closed.');
      if (this.near(LANDMARKS.motelPalmas, 7)) {
        this.ctx.hud.say('Motel clerk', 'Room 9. She said you would be quick. You were.', 3);
        this.completeMission();
      }
    }
    void inCar;
  }

  updateSpecial(dt, inCar) {
    if (this.step === 0) {
      this.aimBeacon(null);
      this.target = null; // the minimap's pink blip (the car itself) carries this step
      return;
    }
    this.aimBeacon(LANDMARKS.chopGarage);
    if (inCar === this.specialCar && this.near(LANDMARKS.chopGarage, 8)) {
      // Dario hops out; Sal takes the car away (main despawns it via cleanup).
      this.ctx.exitCarTo(LANDMARKS.chopGarage);
      this.completeMission();
    }
    void dt;
  }

  updateRace(dt, inCar) {
    if (this.step === 0) {
      this.step = 1;
      this.timer = 140;
      this.raceIndex = 0;
      this.ctx.hud.say(MARISOL, 'Clock is running, Dash. Six lights. Go!', 2.6);
    }
    this.timer -= dt;
    if (this.timer <= 0) return this.failMission('The sponsor stopped watching.');
    const point = RACE_POINTS[this.raceIndex];
    this.aimBeacon(point, 0x39d0ff);
    if (inCar && this.near(point, 9.5)) {
      this.ctx.audio.pickup();
      this.raceIndex += 1;
      if (this.raceIndex >= RACE_POINTS.length) {
        this.ctx.hud.say('Sponsor', 'That is a wheelman. Tell Marisol the money is hers.', 3);
        this.completeMission();
      }
    }
  }

  updateScore(dt, inCar) {
    const { wanted } = this.ctx;
    if (this.step === 0) {
      this.aimBeacon(LANDMARKS.stripStore);
      if (!inCar && this.near(LANDMARKS.stripStore, 5)) {
        this.channel += dt;
        if (this.channel >= 4) {
          this.step = 1;
          this.ctx.addCash(2000);
          this.ctx.hud.floatCash(2000);
          wanted.raiseTo(3);
          this.ctx.commitCrime('robbery');
          this.ctx.trafficPanic(LANDMARKS.stripStore.x, LANDMARKS.stripStore.z);
          this.ctx.hud.say(DARIO, 'Stones are mine. Time to vanish.', 2.6);
          this.ctx.audio.cash();
          // The Cordero guards were watching the store: they open fire.
          for (const [gx, gz] of [[LANDMARKS.stripStore.x - 8, LANDMARKS.stripStore.z + 6], [LANDMARKS.stripStore.x + 9, LANDMARKS.stripStore.z - 5]]) {
            const guard = new Shooter(this.ctx.scene, this.ctx.rnd, gx, gz);
            guard.active = true;
            this.guards.push(guard);
          }
        }
      } else {
        this.channel = Math.max(0, this.channel - dt * 2);
      }
    } else if (this.step === 1) {
      this.aimBeacon(null);
      this.target = null;
      if (wanted.stars === 0) {
        this.step = 2;
        this.ctx.hud.say(MARISOL, 'Clean. Now bring yourself home, warehouse, south-west.', 3);
      }
    } else {
      this.aimBeacon(LANDMARKS.hideout);
      if (this.near(LANDMARKS.hideout, 8)) this.completeMission();
    }
    void inCar;
  }

  updateFare(dt, inCar) {
    if (!this.fare) return;
    if (this.fareStage === 'pickup') {
      this.aimBeacon(this.fare.pickup, 0x51e06a);
      if (inCar && this.near(this.fare.pickup, 6.5)) {
        this.fareStage = 'dropoff';
        this.timer = this.fare.timer;
        if (this.passengerMesh) {
          this.ctx.scene.remove(this.passengerMesh);
          this.passengerMesh = null;
        }
        this.ctx.hud.say('Passenger', 'Across town, driver. And I tip for speed.', 2.6);
        this.ctx.audio.pickup();
      }
      return;
    }
    this.aimBeacon(this.fare.dest, 0x51e06a);
    this.timer -= dt;
    if (!inCar) {
      this.ctx.hud.banner('FARE LOST', 'You left your passenger behind.');
      this.ctx.audio.fail();
      this.newFare();
      return;
    }
    if (this.timer <= 0) {
      this.ctx.hud.banner('FARE LOST', 'Too slow — no tip, no pay.');
      this.ctx.audio.fail();
      this.newFare();
      return;
    }
    if (this.near(this.fare.dest, 7)) {
      this.ctx.addCash(this.fare.pay);
      this.progress.faresDone += 1;
      this.ctx.hud.banner('FARE COMPLETE', `+$${this.fare.pay}`);
      this.ctx.audio.cash();
      this.ctx.persist();
      this.newFare();
    }
  }

  /** Guards from the robbery take their shots through here (main applies damage). */
  updateGuards(dt, combat) {
    const hits = [];
    for (const guard of this.guards) {
      const shot = guard.update(dt, this.ctx.player.pos, combat);
      if (shot) hits.push({ from: guard, dist: shot.dist });
    }
    return hits;
  }
}
