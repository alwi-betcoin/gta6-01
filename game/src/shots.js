// Screenshot staging: ?shot=chase|downtown|coast|mission sets up a real moment of the
// game — real cars, real police, the real HUD — runs the simulation a few seconds so the
// scene is alive, then places the camera. Nothing is drawn or composited; the capture is
// the game exactly as it plays. main.js renders once staging is done.

import { LANDMARKS, STEP } from './config.js';
import { Shooter } from './combat.js';
import { Car } from './vehicles.js';

const _target = { x: 0, z: 0 };

/** Put Dario in a car at a pose with speed, as if mid-drive. */
function putPlayerInCar(game, car, x, z, heading, speed) {
  car.parked = false;
  car.takenByPlayer = true;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.velX = Math.sin(heading) * speed;
  car.velZ = Math.cos(heading) * speed;
  car.group.position.set(x, 0, z);
  car.group.rotation.y = heading;
  game.setCar(car);
  game.player.group.visible = false;
  game.player.pos.set(x, 0, z);
  game.player.heading = heading;
}

/** Run the live simulation for `seconds` of game time. */
function runFor(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.stepPlay(STEP);
  game.hud.update(0.05);
  game.hud.update(0.05);
}

/** Aim the camera from an offset relative to a focus point. */
function placeCamera(game, focus, dx, dy, dz, lookAhead = 4) {
  game.camera.position.set(focus.x + dx, dy, focus.z + dz);
  game.camera.lookAt(focus.x, 1.3, focus.z);
  void lookAhead;
}

/** Golden-hour sun over the staged focus, as the live loop would place it. */
function placeSun(game, x, z) {
  game.sun.position.set(x + game.SUN_OFFSET.x, game.SUN_OFFSET.y, z + game.SUN_OFFSET.z);
  game.sun.target.position.set(x, 0, z);
  game.sun.target.updateMatrixWorld();
}

/** Place a cruiser exactly behind a target car, matching its speed. */
function placeCopBehind(cop, target, back, lane) {
  const fx = Math.sin(target.heading);
  const fz = Math.cos(target.heading);
  cop.x = target.x - fx * back + fz * lane;
  cop.z = target.z - fz * back - fx * lane;
  cop.heading = target.heading;
  cop.speed = Math.abs(target.speed);
  cop.velX = fx * cop.speed;
  cop.velZ = fz * cop.speed;
  cop.group.position.set(cop.x, 0, cop.z);
  cop.group.rotation.y = target.heading;
}

/** 1 — the cover: a three-star police chase through downtown, mid-getaway mission. */
function stageChase(game) {
  const { player, missions, wanted, police } = game;
  missions.progress.nextMission = 3;
  missions.mode = 'active';
  missions.step = 1; // "LOSE THE COPS!"
  const car = new Car(game.scene, 'muscle', 0xff6b1a, 115.9, 36, 0);
  putPlayerInCar(game, car, 115.9, 36, 0, 26);
  wanted.raiseTo(3);
  const cop1 = police.spawnCop(player.pos);
  const cop2 = police.spawnCop(player.pos);
  placeCopBehind(cop1, car, 12, 0.4);
  placeCopBehind(cop2, car, 22, -2.8);
  runFor(game, 0.85);
  // Re-place the cruisers at composed offsets so the frame always reads as a chase.
  placeCopBehind(cop1, car, 10, 0.8);
  placeCopBehind(cop2, car, 17, -3.0);
  runFor(game, 0.22);
  // Front three-quarter camera: the muscle car drives at us, light bars behind it.
  const focus = { x: car.x, z: car.z };
  placeCamera(game, focus, 5.6, 3.2, 14.5);
  game.camera.lookAt(focus.x - 0.5, 1.2, focus.z - 5);
  placeSun(game, focus.x, focus.z);
}

/** 2 — on foot on the neon strip at dusk, the city alive around Dario. */
function stageDowntown(game) {
  const { player, hud } = game;
  // The strip's shops face north onto the z = 120 boulevard, so Dario stands on the
  // boulevard's north pavement looking south at the signs.
  player.pos.set(44, 0, 111.5);
  player.heading = 0;
  player.group.rotation.y = 0;
  hud.say('Marisol', 'The strip is yours tonight, Dash. Do not waste it.', 30);
  runFor(game, 2.2);
  player.pos.set(44, 0, 111.5);
  player.heading = 0;
  player.group.rotation.y = 0;
  placeCamera(game, { x: 44, z: 111.5 }, 2.4, 2.35, -8.4);
  game.camera.lookAt(41.5, 1.5, 128);
  placeSun(game, 44, 120);
}

/** 3 — driving the coast road east, ocean and palms to the right, traffic ahead. */
function stageCoast(game) {
  const car = new Car(game.scene, 'convertible', 0xff5da2, 92, 304.1, Math.PI / 2);
  putPlayerInCar(game, car, 92, 304.1, Math.PI / 2, 17);
  const ahead = game.traffic.cars[0];
  if (ahead) {
    ahead.axis = 'x';
    ahead.line = 300;
    ahead.dir = 1;
    ahead.car.x = 124;
    ahead.car.z = 304.1;
    ahead.car.heading = Math.PI / 2;
    ahead.car.speed = 11;
    ahead.car.group.position.set(124, 0, 304.1);
    ahead.car.group.rotation.y = Math.PI / 2;
  }
  runFor(game, 1.4);
  const focus = { x: car.x, z: car.z };
  placeCamera(game, focus, -12.5, 4.3, 4.6);
  game.camera.lookAt(focus.x + 10, 1.0, focus.z + 2.2);
  placeSun(game, focus.x, focus.z);
}

/** 4 — the Solano Score, mid-robbery: beacon up, guards posted, a cruiser arriving. */
function stageMission(game) {
  const { player, missions, wanted, police, hud } = game;
  missions.progress.nextMission = 3;
  missions.mode = 'active';
  missions.step = 0;
  player.pos.set(LANDMARKS.stripStore.x, 0, LANDMARKS.stripStore.z + 3.5);
  player.heading = Math.PI;
  player.group.rotation.y = Math.PI;
  player.setWeapon('pistol');
  const guardA = new Shooter(game.scene, game.rnd ?? Math.random, LANDMARKS.stripStore.x - 8, LANDMARKS.stripStore.z + 7);
  const guardB = new Shooter(game.scene, game.rnd ?? Math.random, LANDMARKS.stripStore.x + 9, LANDMARKS.stripStore.z - 4);
  missions.guards.push(guardA, guardB);
  wanted.raiseTo(2);
  const cop = police.spawnCop(player.pos);
  cop.x = 207;
  cop.z = 124.1;
  cop.heading = -Math.PI / 2;
  cop.speed = 7;
  cop.velX = -7;
  cop.velZ = 0;
  cop.group.position.set(cop.x, 0, cop.z);
  cop.group.rotation.y = -Math.PI / 2;
  hud.say('Dario', 'Easy, Brillo. Your stones are coming with me.', 30);
  runFor(game, 0.7);
  placeCamera(game, { x: player.x, z: player.z }, 3.4, 2.7, 8.8);
  game.camera.lookAt(player.x - 2, 1.6, player.z - 9);
  placeSun(game, player.x, player.z);
}

const SCENES = { chase: stageChase, downtown: stageDowntown, coast: stageCoast, mission: stageMission };

/** Stage the named scene on the built game; unknown names fall back to downtown. */
export function stageShot(name, game) {
  const stage = SCENES[name] ?? stageDowntown;
  stage(game);
}
