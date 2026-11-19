// SOLANO HEAT — boot and the one loop. Builds Port Solano (three.js scene, golden-hour
// light, the merged city), Dario, his cars, traffic, pedestrians, police, combat and
// Marisol's mission chain; then runs the fixed-step simulation behind the screens:
// menu, play, pause, busted, wasted. Input is read every frame; the world advances in
// 1/60 s steps; the camera is a drag/pointer-lock orbit that settles behind the action.
//
// ?seed=N fixes the city. ?shot=chase|downtown|coast|mission stages a screenshot scene
// (shots.js) instead of opening the menu.

import * as THREE from '../vendor/three.module.min.js';
import { GAME_TITLE, LANDMARKS, MAX_FRAME, PALETTE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { buildCity } from './building-factory.js';
import { Car } from './vehicles.js';
import { Player } from './player-character.js';
import { TrafficManager, spawnParkedCars } from './traffic-ai.js';
import { PedestrianManager } from './pedestrians.js';
import { WantedSystem } from './wanted-system.js';
import { PoliceManager } from './police-pursuit.js';
import { Combat } from './combat.js';
import { MissionRunner } from './mission-chain.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { SoundEngine } from './audio-synth.js';
import { Effects } from './effects.js';
import { clearSave, defaultSave, loadSave, storeSave } from './save-game.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;
const rnd = createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 140, 720);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2600);

const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
const SUN_OFFSET = new THREE.Vector3(-170, 130, 60);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- the world
const city = buildCity(scene, rnd);
const colliders = city.colliders;
const player = new Player(scene);
const input = createInput(canvas);
const hud = new Hud();
const minimap = new Minimap(document.getElementById('minimap'));
const audio = new SoundEngine();
const effects = new Effects(scene);
const combat = new Combat(scene, effects, audio);
const wanted = new WantedSystem();
const traffic = new TrafficManager(scene, rnd, colliders, 11);
const parkedCars = spawnParkedCars(scene, rnd, 16);
const pedestrians = new PedestrianManager(scene, rnd, colliders, 22);
const police = new PoliceManager(scene, rnd, colliders, wanted);
police.onShootPlayer = (copCar) => {
  const dist = Math.hypot(copCar.x - player.x, copCar.z - player.z);
  const speed = currentCar ? Math.abs(currentCar.speed) : player.speedNow;
  if (combat.enemyShoot(copCar.group.position, player.pos, speed, dist)) {
    if (currentCar) {
      currentCar.damage(3);
      hurtPlayer(3.5);
    } else {
      hurtPlayer(6.5);
    }
  }
};

// Dario's own sun-faded sedan, parked by the coast road: the one car that is never a theft.
const starterCar = new Car(scene, 'sedan', 0x0f7f7a, 138, 295.8, Math.PI / 2);
starterCar.parked = true;
starterCar.owned = true;
parkedCars.push(starterCar);
// Dario starts on the boardwalk, west of Café Azul — out of the coast road's traffic.
player.pos.set(128, 0, 316);
player.heading = Math.PI / 2;

// ---------------------------------------------------------------- state
let save = loadSave() ?? defaultSave();
let screen = 'menu';
let started = false;
let currentCar = null;
let bustMeter = 0;
let lastHurtTime = -99;
let simTime = 0;
let placeTimer = 0;
let hitByCarCooldown = 0;

function persist() {
  storeSave(save);
}

function addCash(amount) {
  save.cash += amount;
  if (amount > 0) save.totalEarned += amount;
  hud.setCash(save.cash);
  persist();
}

/** Every car currently in the world, for collisions and raycasts. */
function allCars() {
  const list = [...parkedCars, ...traffic.vehicles, ...police.vehicles];
  if (missions.specialCar && !list.includes(missions.specialCar)) list.push(missions.specialCar);
  return list;
}

/** Is anyone close enough to see a crime at (x, z)? */
function witnessed(x, z, radius = 24) {
  for (const ped of pedestrians.peds) {
    if (ped.mode !== 'down' && Math.hypot(ped.x - x, ped.z - z) < radius) return true;
  }
  return police.nearestTo(x, z).dist < 46;
}

function commitCrime(kind) {
  wanted.commit(kind);
}

const missions = new MissionRunner({
  scene,
  hud,
  audio,
  player,
  wanted,
  combat,
  rnd,
  playerCar: () => currentCar,
  addCash,
  commitCrime,
  trafficPanic: (x, z) => traffic.panicAt(x, z, 30),
  spawnSpecialCar: () => {
    const car = new Car(scene, 'muscle', 0xff5da2, LANDMARKS.specialCar.x, LANDMARKS.specialCar.z, 0);
    car.parked = true;
    car.isSpecial = true;
    return car;
  },
  despawnSpecialCar: (car) => car.dispose(scene),
  exitCarTo: (at) => exitCar(at),
  persist,
}, save);

// ---------------------------------------------------------------- player harm
function hurtPlayer(amount, silent = false) {
  if (screen !== 'play') return;
  player.health -= amount;
  lastHurtTime = simTime;
  if (!silent) {
    hud.damage();
    effects.shake(Math.min(0.3, amount * 0.02));
  }
  if (player.health <= 0 && screen === 'play') {
    player.health = 0;
    screen = 'wasted';
    save.wasted += 1;
    audio.setEngine(false);
    audio.setSiren(0);
    audio.sting();
    document.getElementById('wastedText').textContent =
      `Solano General patched you up. The bill is $${Math.min(save.cash, 150)} — and the street forgets nothing.`;
    document.getElementById('wastedScreen').hidden = false;
    document.exitPointerLock?.();
  }
}

function startBusted() {
  screen = 'busted';
  const fine = Math.min(save.cash, wanted.stars * 120);
  save.cash -= fine;
  save.busts += 1;
  wanted.clear();
  bustMeter = 0;
  audio.setEngine(false);
  audio.setSiren(0);
  audio.sting();
  document.getElementById('bustedText').textContent =
    `Port Solano PD got you. The fine is $${fine}. Marisol is not impressed.`;
  document.getElementById('bustedScreen').hidden = false;
  document.exitPointerLock?.();
  persist();
}

// ---------------------------------------------------------------- cars: in and out
function nearestEnterableCar() {
  let best = null;
  let bestD = 3.4;
  for (const car of allCars()) {
    if (car.type === 'police' || car.dead) continue;
    if (!car.parked && !car.takenByPlayer && Math.abs(car.speed) > 2) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterCar(car) {
  currentCar = car;
  car.parked = false;
  car.takenByPlayer = true;
  player.group.visible = false;
  if (!car.owned && !car.stolenOnce) {
    car.stolenOnce = true;
    if (witnessed(car.x, car.z)) commitCrime('theft');
  }
  missions.notifyEnterCar(car);
  audio.init();
}

function exitCar(at = null) {
  if (!currentCar) return;
  const car = currentCar;
  currentCar = null;
  car.parked = true;
  car.speed = 0;
  car.velX = 0;
  car.velZ = 0;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const lx = fz;
  const lz = -fx;
  const px = at ? at.x : car.x + lx * 2.4;
  const pz = at ? at.z : car.z + lz * 2.4;
  player.pos.set(px, 0, pz);
  player.heading = car.heading;
  player.group.visible = true;
}

// ---------------------------------------------------------------- camera rig
const cam = { yaw: Math.PI, pitch: 0.34, dist: 9, manualTimer: 0 };
const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _shake = new THREE.Vector3();

function updateCamera(dt) {
  const orbit = input.takeOrbit();
  if (orbit.dx || orbit.dy) {
    cam.yaw -= orbit.dx * 0.0052;
    cam.pitch = Math.max(0.05, Math.min(1.15, cam.pitch + orbit.dy * 0.0042));
    cam.manualTimer = 0;
  } else {
    cam.manualTimer += dt;
  }
  if (orbit.wheel) cam.dist = Math.max(5, Math.min(30, cam.dist + orbit.wheel * 0.02));

  if (screen === 'menu' || screen === 'shot') return; // shots and the menu place the camera themselves
  const focus = currentCar ? currentCar.group.position : player.pos;
  _camTarget.set(focus.x, focus.y + (currentCar ? 1.6 : 1.7), focus.z);
  // Settle behind the action when the player is not actively orbiting.
  if (cam.manualTimer > 2.2) {
    const heading = currentCar ? currentCar.heading : player.heading;
    const behind = heading + Math.PI;
    let diff = behind - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cam.yaw += diff * Math.min(1, dt * (currentCar ? 1.5 : 0.7));
  }
  const wantDist = currentCar ? 11.5 : 8.5;
  cam.dist += (wantDist - cam.dist) * Math.min(1, dt * 2.5);
  const cx = Math.sin(cam.yaw) * Math.cos(cam.pitch);
  const cz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
  _camPos.set(
    _camTarget.x + cx * cam.dist,
    _camTarget.y + Math.sin(cam.pitch) * cam.dist,
    _camTarget.z + cz * cam.dist,
  );
  if (_camPos.y < 1.1) _camPos.y = 1.1;
  effects.shakeOffset(_shake);
  _camPos.add(_shake);
  camera.position.copy(_camPos);
  camera.lookAt(_camTarget);
}

// ---------------------------------------------------------------- simulation
const _v1 = new THREE.Vector3();

function stepPlay(dt) {
  simTime += dt;
  let inCar = currentCar !== null;

  // --- Dario, on foot or driving
  if (inCar) {
    const car = currentCar;
    const throttle = input.forward();
    const steer = -input.strafe();
    const events = car.step(dt, { throttle, steer, handbrake: input.down('Space') }, colliders);
    player.pos.set(car.x, 0, car.z);
    player.heading = car.heading;
    if (events.drifting) {
      audio.setScreech(0.8);
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      for (const side of [-1, 1]) {
        effects.skid(car.x - f.x * (car.spec.length / 2 - 0.85) + f.z * side * (car.spec.width / 2), car.z - f.z * (car.spec.length / 2 - 0.85) - f.x * side * (car.spec.width / 2), car.heading, 1.2);
      }
    } else if (throttle < 0 && car.speed > 12) {
      audio.setScreech(0.5);
    } else {
      audio.setScreech(0);
    }
    if (events.crashed > 0.12) {
      audio.crash(events.crashed);
      effects.shake(events.crashed * 0.4);
      car.smokePoint(_v1);
      effects.burst(_v1, 8, 0xcccccc, 2.5, 2, 0.6);
      if (events.crashed > 0.45) hurtPlayer(events.crashed * 9, true);
    }
    audio.setEngine(true, Math.abs(car.speed) / car.spec.maxSpeed, Math.abs(throttle));
  } else {
    audio.setEngine(false);
    audio.setScreech(0);
    const view = { x: -Math.sin(cam.yaw), z: -Math.cos(cam.yaw) };
    const right = { x: -view.z, z: view.x };
    const f = input.forward();
    const s = input.strafe();
    const move = { x: view.x * f + right.x * s, z: view.z * f + right.z * s };
    const len = Math.hypot(move.x, move.z);
    if (len > 1) {
      move.x /= len;
      move.z /= len;
    }
    player.step(dt, move, input.down('ShiftLeft') || input.down('ShiftRight'), input.take('Space'), colliders);
    // Combat on foot.
    if (input.take('KeyQ')) player.setWeapon(player.weapon === 'pistol' ? 'fists' : 'pistol');
    if (input.take('Digit1')) player.setWeapon('fists');
    if (input.take('Digit2')) player.setWeapon('pistol');
    if (input.firing && player.weapon === 'pistol') {
      const groups = [...pedestrians.peds.map((p) => p.group), ...allCars().map((c) => c.group), ...missions.guards.map((g) => g.group), ...city.hitMeshes];
      const hit = combat.shoot(player, camera, groups);
      if (hit) {
        pedestrians.panicAt(player.x, player.z, 16);
        traffic.panicAt(player.x, player.z, 24);
        if (witnessed(player.x, player.z, 30)) commitCrime('gunshot');
        if (hit.owner === 'ped') {
          const result = hit.ped.hurt(58, player.x, player.z);
          if (result === 'flee') commitCrime('assault');
          else commitCrime('assault');
          effects.burst(hit.point, 5, 0xd94f30, 1.6, 1.6, 0.5);
        } else if (hit.owner === 'shooter') {
          if (hit.shooter.hurt(58)) hud.say('Dario', 'One less Cordero watching the store.', 2.4);
        } else if (hit.owner === 'car') {
          hit.car.damage(7);
          effects.burst(hit.point, 4, 0xffc93f, 2.4, 1.4, 0.35);
          if (hit.car.type === 'police') commitCrime('hitPolice');
        }
      }
    } else if (input.firing && player.weapon === 'fists') {
      const hit = combat.punch(player, pedestrians.peds, allCars());
      if (hit && hit.ped) {
        hit.ped.hurt(34, player.x, player.z);
        commitCrime('assault');
        pedestrians.panicAt(player.x, player.z, 9);
      } else if (hit && hit.car) {
        audio.crash(0.15);
      }
    }
  }
  combat.update(dt);

  // --- enter / exit
  if (input.take('KeyE')) {
    if (inCar) exitCar();
    else {
      const car = nearestEnterableCar();
      if (car) enterCar(car);
    }
    inCar = currentCar !== null; // everything below must see the new truth
  }

  // --- the city lives
  const obstacles = allCars();
  traffic.update(dt, { playerPos: player.pos, obstacles });
  pedestrians.update(dt, player.pos);
  const policeView = police.update(dt, {
    playerPos: player.pos,
    playerInCar: inCar,
    playerCar: currentCar,
    playerSpeed: inCar ? Math.abs(currentCar.speed) : player.speedNow,
  });
  wanted.update(dt);
  missions.update(dt);
  inCar = currentCar !== null; // a mission beat (the chop-garage delivery) can end a drive

  // Guards and police open fire through the combat resolver.
  for (const shot of missions.updateGuards(dt, combat)) {
    const speed = inCar ? Math.abs(currentCar.speed) : player.speedNow;
    if (combat.enemyShoot(shot.from.pos, player.pos, speed, shot.dist)) hurtPlayer(7);
  }
  audio.setSiren(policeView.nearestDist === Infinity ? 0 : Math.max(0, 1 - policeView.nearestDist / 75));
  audio.updateMusic(dt, true);

  // --- car-to-car collisions among the movers (parked cars are immovable anchors)
  const movers = obstacles.filter((c) => !c.parked);
  for (let i = 0; i < movers.length; i += 1) {
    for (let j = i + 1; j < movers.length; j += 1) {
      const a = movers[i];
      const b = movers[j];
      const impact = a.collideCar(b, dt);
      if (impact > 0.15) {
        audio.crash(impact * 0.8);
        if (a === currentCar || b === currentCar) {
          effects.shake(impact * 0.35);
          const other = a === currentCar ? b : a;
          if (other.type === 'police') commitCrime('hitPolice');
          else if (witnessed(player.x, player.z, 30)) commitCrime('crash');
          if (impact > 0.5) hurtPlayer(impact * 7, true);
        }
      }
    }
  }
  for (const car of obstacles) car.group.position.set(car.x, 0, car.z);

  // --- running people over, and being run over
  hitByCarCooldown = Math.max(0, hitByCarCooldown - dt);
  for (const car of movers) {
    if (car === currentCar) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (!inCar && d < car.radius + 0.5 && Math.abs(car.speed) > 5 && hitByCarCooldown <= 0) {
      hurtPlayer(11);
      hitByCarCooldown = 0.9;
      player.pos.x += (player.x - car.x) * 0.4;
      player.pos.z += (player.z - car.z) * 0.4;
    }
  }
  if (inCar && Math.abs(currentCar.speed) > 3.5) {
    for (const ped of pedestrians.peds) {
      if (ped.mode === 'down') continue;
      const d = Math.hypot(ped.x - currentCar.x, ped.z - currentCar.z);
      if (d < currentCar.radius + 0.45) {
        ped.hurt(100, currentCar.x, currentCar.z);
        commitCrime('hitAndRun');
        pedestrians.panicAt(ped.x, ped.z, 15);
        audio.crash(0.3);
        effects.shake(0.18);
      }
    }
  }

  // --- damage smoke on wrecks, including Dario's ride
  for (const car of obstacles) {
    if (car.smoking && Math.random() < dt * 7) {
      car.smokePoint(_v1);
      effects.burst(_v1, 1, 0x2c2c30, 0.7, 2.6, 1.3);
    }
  }

  // --- busted meter
  const near = policeView.nearestDist;
  let busting = false;
  if (wanted.stars > 0) {
    if (!inCar && near < 3.4) busting = true;
    if (inCar && Math.abs(currentCar.speed) < 1.3 && near < 5) busting = true;
  }
  if (busting) {
    bustMeter += dt / 1.6;
    if (bustMeter >= 1) startBusted();
  } else {
    bustMeter = Math.max(0, bustMeter - dt * 0.7);
  }

  // --- gentle health regen once the shooting stops
  if (player.health > 0 && player.health < 100 && simTime - lastHurtTime > 6) {
    player.health = Math.min(100, player.health + 4.5 * dt);
  }

  // --- HUD
  hud.setStars(wanted.stars);
  hud.setHealth(player.health / 100);
  hud.setCarHealth(inCar ? currentCar.health / 100 : null);
  hud.setWeapon(inCar ? 'DRIVING' : player.weapon.toUpperCase());
  hud.setCrosshair(!inCar && player.weapon === 'pistol');
  const objective = missions.objective();
  hud.setObjective(objective ? objective.text : null, objective ? objective.meta : '');
  if (bustMeter > 0.05 && screen === 'play') {
    hud.setPrompt(`<b>BUSTED</b> in ${Math.max(0, 1.6 * (1 - bustMeter)).toFixed(1)}s — MOVE!`);
  } else if (!inCar) {
    const car = nearestEnterableCar();
    hud.setPrompt(car ? `<b>E</b> — steal the ${car.type}` : null);
  } else {
    hud.setPrompt('<b>E</b> — get out');
  }
  placeTimer -= dt;
  if (placeTimer <= 0) {
    placeTimer = 0.6;
    hud.setPlace(player.z > 322 ? 'SOLANO BEACH' : player.z > 290 ? 'THE COAST · SOLANO' : Math.abs(player.z - 120) < 26 ? 'THE STRIP · SOLANO' : player.z < 70 ? 'UPTOWN SOLANO' : 'DOWNTOWN SOLANO');
  }
  minimap.draw({
    player: { x: player.x, z: player.z, heading: inCar ? currentCar.heading : player.heading },
    target: missions.mapTarget(),
    fare: missions.mapFare(),
    police: police.vehicles,
    special: missions.specialCar ? { x: missions.specialCar.x, z: missions.specialCar.z } : null,
  }, dt);
}

// ---------------------------------------------------------------- screens & loop
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pauseMenu');

function showScreen(next) {
  screen = next;
  menuEl.hidden = next !== 'menu';
  pauseEl.hidden = next !== 'pause';
  hud.show();
  if (next === 'menu') hud.hide();
  if (next === 'play') {
    document.getElementById('bustedScreen').hidden = true;
    document.getElementById('wastedScreen').hidden = true;
  }
  input.flush();
}

function startPlay(fresh) {
  if (fresh) {
    clearSave();
    save = defaultSave();
    if (started) {
      window.location.reload();
      return;
    }
  }
  started = true;
  hud.setCash(save.cash);
  cam.yaw = player.heading + Math.PI;
  cam.pitch = 0.34;
  showScreen('play');
  status.textContent = `${GAME_TITLE}. Playing.`;
}

document.getElementById('btnNew').addEventListener('click', () => { audio.init(); startPlay(true); });
document.getElementById('btnContinue').addEventListener('click', () => { audio.init(); startPlay(false); });
document.getElementById('btnResume').addEventListener('click', () => showScreen('play'));
document.getElementById('btnQuit').addEventListener('click', () => { persist(); showScreen('menu'); });
document.getElementById('btnBusted').addEventListener('click', () => {
  exitCar();
  player.pos.set(LANDMARKS.station.x - 8, 0, LANDMARKS.station.z + 10);
  player.health = Math.max(player.health, 55);
  showScreen('play');
});
document.getElementById('btnWasted').addEventListener('click', () => {
  const fee = Math.min(save.cash, 150);
  save.cash -= fee;
  hud.setCash(save.cash);
  exitCar();
  player.pos.set(LANDMARKS.hospital.x, 0, LANDMARKS.hospital.z + 8);
  player.health = 100;
  wanted.clear();
  persist();
  showScreen('play');
});
if (!loadSave()) document.getElementById('btnContinue').disabled = true;
canvas.addEventListener('click', () => {
  if (screen === 'play') {
    audio.init();
    input.lock();
  }
});

let last = performance.now();
let accumulator = 0;
let menuAngle = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (screen === 'play') {
    if (input.take('Escape') || input.take('KeyP')) {
      document.getElementById('pauseStats').textContent =
        `Cash $${save.cash} · Jobs done ${save.nextMission}/4 · Fares ${save.faresDone} · Earned $${save.totalEarned} all time`;
      showScreen('pause');
    } else {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'play') {
        stepPlay(STEP);
        accumulator -= STEP;
      }
      if (screen !== 'play') accumulator = 0;
    }
  } else if (screen === 'menu') {
    menuAngle += dt * 0.02;
    camera.position.set(150 + Math.sin(menuAngle) * 130, 42, 185 + Math.cos(menuAngle) * 130);
    camera.lookAt(150, 4, 170);
    traffic.update(dt, { playerPos: { x: 150, z: 200 }, obstacles: allCars() });
    for (const car of allCars()) car.group.position.set(car.x, 0, car.z);
    audio.updateMusic(dt, true);
  }
  city.update(dt, now / 1000);
  effects.update(dt);
  hud.update(dt);
  updateCamera(dt);
  // The sun (and its shadows) follow Dario so the shadow box stays tight.
  const focus = screen === 'menu' ? _camTarget.set(150, 0, 170) : _camTarget.set(player.x, 0, player.z);
  sun.position.copy(focus).add(SUN_OFFSET);
  sun.target.position.copy(focus);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- go
hud.setCash(save.cash);
if (shotName) {
  screen = 'shot';
  menuEl.hidden = true;
  hud.show();
  const game = {
    scene, camera, renderer, player, traffic, police, wanted, missions, hud, effects, audio,
    parkedCars, pedestrians, cam, rnd, currentCarRef: () => currentCar,
    setCar: (car) => { currentCar = car; },
    stepPlay, allCars, sun, SUN_OFFSET,
  };
  stageShot(shotName, game);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  showScreen('menu');
  requestAnimationFrame(frame);
}
