// Builds Port Solano itself: sky and sea, the street grid, and every building, palm, lamp
// and prop, merged into a few big meshes so the whole city costs a handful of draw calls.
// Returns the merged group, the AABB colliders gameplay collides with, and an update hook
// for the sea, the boats and the odd flickering neon sign.

import * as THREE from '../vendor/three.module.min.js';
import { BEACH_Z0, BEACH_Z1, BOARDWALK_Z, LAND_MAX, LAND_MIN, PALETTE, PITCH, ROAD_WIDTH, SEA_Z, STREET_LINES } from './config.js';
import { BLOCK_KINDS, blockRect } from './city-layout.js';
import { mergeParts, UNIT_BOX, UNIT_CYLINDER, UNIT_PLANE } from './geometry-merge.js';
import { asphaltTexture, awningTexture, concreteTexture, facadeTextures, glowTexture, neonColor, palmFrondTexture, sandTexture, seaTexture, signTexture, SIGN_NAMES } from './textures.js';
import { chance, intRange, pick, range } from './random.js';

const ROOF_COLOR = new THREE.Color(0x4a3a32);
const WOOD_COLOR = new THREE.Color(0x9a6b46);

/** A gradient sky dome: warm at the horizon, deep blue up top, sun-bleached below. */
function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(1500, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 low; varying vec3 vPos;'
      + 'void main(){ float h = normalize(vPos).y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, low, pow(-h, 0.6)); gl_FragColor = vec4(c, 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffca7a, transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
  sun.position.set(-620, 210, -880);
  sun.scale.setScalar(420);
  scene.add(sun);
  return sky;
}

/** Slow clouds: big soft sprites drifting over the bay. */
function buildClouds(scene, rnd) {
  const group = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff2df, transparent: true, opacity: 0.32, depthWrite: false });
  for (let i = 0; i < 12; i += 1) {
    const s = new THREE.Sprite(mat);
    s.position.set(range(rnd, -700, 700), range(rnd, 130, 210), range(rnd, -700, 500));
    s.scale.set(range(rnd, 180, 320), range(rnd, 36, 60), 1);
    group.add(s);
  }
  scene.add(group);
  return group;
}

/** One pre-bent palm trunk geometry and one crossed-plane crown, instanced by merging. */
function palmGeometries() {
  const segments = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < 4; i += 1) {
    segments.push({ geometry: UNIT_CYLINDER, x: x + 0.14, y: y + 0.65, z: 0, sx: 0.34 - i * 0.04, sy: 1.3, sz: 0.34 - i * 0.04 });
    x += 0.28;
    y += 1.24;
  }
  const trunk = mergeParts(segments);
  const crown = mergeParts([
    { geometry: UNIT_PLANE, x: 0, y: 0, z: 0, ry: 0, sx: 5.6, sy: 3.6 },
    { geometry: UNIT_PLANE, x: 0, y: 0, z: 0, ry: Math.PI / 3, sx: 5.6, sy: 3.6 },
    { geometry: UNIT_PLANE, x: 0, y: 0, z: 0, ry: (2 * Math.PI) / 3, sx: 5.6, sy: 3.6 },
  ]);
  return { trunk, crown, topX: x, topY: y + 0.4 };
}

/**
 * Build the whole city into `scene`. `rnd` is the seeded generator so a seed rebuilds the
 * same city. Returns { group, colliders, update(dt, t) }.
 */
export function buildCity(scene, rnd) {
  const group = new THREE.Group();
  const colliders = [];
  const hitMeshes = [];
  const addCollider = (cx, cz, w, d) => colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });

  buildSky(scene);
  const clouds = buildClouds(scene, rnd);

  // ---- ground, roads, pavements -------------------------------------------
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(LAND_MAX - LAND_MIN + 160, LAND_MAX - LAND_MIN + 160),
    new THREE.MeshLambertMaterial({ color: 0x8a7a5c }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(150, -0.08, 150);
  land.receiveShadow = true;
  group.add(land);

  const asphalt = asphaltTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: asphalt });
  const plainAsphaltMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const roadSpan = LAND_MAX - LAND_MIN;
  for (const line of STREET_LINES) {
    for (const vertical of [true, false]) {
      const tex = asphalt.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, roadSpan / 22);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, roadSpan), mat);
      road.rotation.x = -Math.PI / 2;
      if (!vertical) road.rotation.z = Math.PI / 2;
      road.position.set(vertical ? line : 150, 0.02, vertical ? 150 : line);
      road.receiveShadow = true;
      group.add(road);
    }
    void roadMat;
  }
  for (const x of STREET_LINES) {
    for (const z of STREET_LINES) {
      const sq = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH), plainAsphaltMat);
      sq.rotation.x = -Math.PI / 2;
      sq.position.set(x, 0.03, z);
      sq.receiveShadow = true;
      group.add(sq);
    }
  }

  const concrete = concreteTexture();
  const slabParts = [];
  for (let j = 0; j < 5; j += 1) {
    for (let i = 0; i < 5; i += 1) {
      const r = blockRect(i, j);
      slabParts.push({ geometry: UNIT_BOX, x: (r.x0 + r.x1) / 2, y: 0.05, z: (r.z0 + r.z1) / 2, sx: r.x1 - r.x0, sy: 0.1, sz: r.z1 - r.z0, uvScale: [11, 11] });
    }
  }
  // Kerb strips along the outer streets and the boardwalk slab.
  slabParts.push({ geometry: UNIT_BOX, x: 150, y: 0.05, z: BOARDWALK_Z, sx: 372, sy: 0.1, sz: 15, uvScale: [60, 3] });
  const slabMat = new THREE.MeshLambertMaterial({ map: concrete });
  const slabs = new THREE.Mesh(mergeParts(slabParts), slabMat);
  slabs.receiveShadow = true;
  group.add(slabs);

  // ---- beach and sea -------------------------------------------------------
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(760, BEACH_Z1 - BEACH_Z0 + 26), new THREE.MeshLambertMaterial({ map: sandTexture() }));
  sand.material.map.repeat.set(30, 2);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(150, 0.0, (BEACH_Z0 + BEACH_Z1) / 2 + 4);
  sand.receiveShadow = true;
  group.add(sand);

  const seaTex = seaTexture();
  seaTex.repeat.set(26, 9);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1100, 320), new THREE.MeshLambertMaterial({ map: seaTex, color: 0xbfe8ef }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(150, -0.5, SEA_Z + 150);
  group.add(sea);

  // ---- buildings -----------------------------------------------------------
  const facadeParts = [[], [], [], []];
  const roofParts = [];
  const woodParts = [];
  const darkParts = [];
  const whiteParts = [];
  const greenParts = [];
  const orangeParts = [];
  const signs = [];
  let signIndex = 0;

  function addBuilding(cx, cz, w, d, h, variant) {
    facadeParts[variant].push({
      geometry: UNIT_BOX, x: cx, y: h / 2 + 0.1, z: cz, sx: w, sy: h, sz: d,
      uvScale: [Math.max(1, Math.round(w / 13)), Math.max(1, Math.round(h / 17))],
    });
    roofParts.push({ geometry: UNIT_BOX, x: cx, y: h + 0.32, z: cz, sx: w - 0.7, sy: 0.45, sz: d - 0.7 });
    addCollider(cx, cz, w + 0.4, d + 0.4);
  }

  function addSign(x, y, z, ry, w, text, color) {
    const mat = new THREE.MeshBasicMaterial({ map: signTexture(text, color, rnd), side: THREE.DoubleSide });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    group.add(sign);
    signs.push(sign);
    return sign;
  }

  function addAwning(x, y, z, ry, w) {
    const mat = new THREE.MeshLambertMaterial({ map: awningTexture(pick(rnd, ['#d94f30', '#1f8a70', '#e0a81c', '#2a6fb5']), '#f2ead8') });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 2.2), mat);
    awn.position.set(x, y, z);
    awn.rotation.y = ry;
    awn.rotation.x = ry === 0 || ry === Math.PI ? 0.35 : 0;
    awn.rotation.z = ry === Math.PI / 2 || ry === -Math.PI / 2 ? 0.35 : 0;
    group.add(awn);
  }

  for (const block of BLOCK_KINDS) {
    const r = blockRect(block.i, block.j);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    if (block.kind === 'towers') {
      const w = range(rnd, 25, 33);
      const d = range(rnd, 25, 33);
      addBuilding(cx + range(rnd, -3, 3), cz + range(rnd, -3, 3), w, d, range(rnd, 36, 68), intRange(rnd, 0, 3));
      if (chance(rnd, 0.7)) addBuilding(r.x0 + 8, r.z1 - 8, 11, 11, range(rnd, 8, 14), intRange(rnd, 0, 3));
    } else if (block.kind === 'mixed') {
      addBuilding(r.x0 + 12, r.z0 + 12, 19, 19, range(rnd, 13, 30), intRange(rnd, 0, 3));
      addBuilding(r.x1 - 12, r.z1 - 12, 19, 19, range(rnd, 10, 24), intRange(rnd, 0, 3));
      if (chance(rnd, 0.5)) addBuilding(r.x1 - 11, r.z0 + 10, 15, 14, range(rnd, 7, 12), intRange(rnd, 0, 3));
    } else if (block.kind === 'houses') {
      for (const [hx, hz] of [[r.x0 + 10, r.z0 + 10], [r.x1 - 10, r.z0 + 10], [r.x0 + 10, r.z1 - 10], [r.x1 - 10, r.z1 - 10]]) {
        const w = range(rnd, 10, 13);
        const d = range(rnd, 9, 12);
        const h = range(rnd, 4.2, 5.6);
        facadeParts[intRange(rnd, 0, 3)].push({ geometry: UNIT_BOX, x: hx, y: h / 2 + 0.1, z: hz, sx: w, sy: h, sz: d, uvScale: [1, 1] });
        const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.74, 2.6, 4);
        roofParts.push({ geometry: roof, x: hx, y: h + 1.35, z: hz, ry: Math.PI / 4 });
        addCollider(hx, hz, w + 0.4, d + 0.4);
        if (chance(rnd, 0.6)) greenParts.push({ geometry: UNIT_BOX, x: hx + range(rnd, -8, 8), y: 0.5, z: hz + range(rnd, -8, 8), sx: 1.6, sy: 0.9, sz: 1.6 });
      }
    } else {
      // Shops and motels: a row of low units along the block's street-facing edge, signs out.
      const facingNorth = block.j === 2; // the strip row faces the z = 120 boulevard
      const edgeZ = facingNorth ? r.z0 + 7 : r.z1 - 7;
      const signZ = facingNorth ? r.z0 - 0.4 : r.z1 + 0.4;
      const signRy = facingNorth ? Math.PI : 0;
      let x = r.x0 + 8;
      while (x < r.x1 - 10) {
        const w = range(rnd, 11, 16);
        const h = block.kind === 'motels' ? 7 : range(rnd, 5.5, 8.5);
        addBuilding(x + w / 2, edgeZ, w, 13, h, intRange(rnd, 0, 3));
        const name = SIGN_NAMES[signIndex % SIGN_NAMES.length];
        signIndex += 1;
        addSign(x + w / 2, h + 1.6, signZ, signRy, Math.min(w + 3, 15), name, neonColor(rnd));
        addAwning(x + w / 2, 3.1, facingNorth ? r.z0 - 0.9 : r.z1 + 0.9, signRy, w - 1);
        if (block.kind === 'motels') {
          darkParts.push({ geometry: UNIT_CYLINDER, x: x + w / 2, y: 5.5, z: signZ + (facingNorth ? -1.5 : 1.5), sx: 0.3, sy: 11, sz: 0.3 });
          whiteParts.push({ geometry: UNIT_BOX, x: x + w / 2, y: 4.4, z: edgeZ + (facingNorth ? -7.4 : 7.4), sx: w - 1, sy: 0.25, sz: 1.6 });
        }
        x += w + range(rnd, 1.5, 4);
      }
    }
    // Rubbish and crates behind the buildings, for the alleys.
    for (let k = 0; k < 2; k += 1) {
      if (!chance(rnd, 0.55)) continue;
      const px = range(rnd, r.x0 + 3, r.x1 - 3);
      const pz = range(rnd, r.z0 + 3, r.z1 - 3);
      if (colliders.some((c) => px > c.x0 - 2 && px < c.x1 + 2 && pz > c.z0 - 2 && pz < c.z1 + 2)) continue;
      if (chance(rnd, 0.5)) {
        greenParts.push({ geometry: UNIT_BOX, x: px, y: 0.75, z: pz, sx: 2.2, sy: 1.4, sz: 1.3, ry: range(rnd, 0, 3) });
        addCollider(px, pz, 2.4, 2.4);
      } else {
        woodParts.push({ geometry: UNIT_BOX, x: px, y: 0.55, z: pz, sx: 1.1, sy: 1.1, sz: 1.1, ry: range(rnd, 0, 3) });
        addCollider(px, pz, 1.4, 1.4);
      }
    }
  }

  for (let v = 0; v < 4; v += 1) {
    if (facadeParts[v].length === 0) continue;
    const tex = facadeTextures(rnd, v);
    const mat = new THREE.MeshLambertMaterial({ map: tex.map, emissive: 0xffc37a, emissiveMap: tex.emissive, emissiveIntensity: 0.62 });
    const mesh = new THREE.Mesh(mergeParts(facadeParts[v]), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    hitMeshes.push(mesh);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: ROOF_COLOR });
  const roofs = new THREE.Mesh(mergeParts(roofParts), roofMat);
  roofs.castShadow = true;
  group.add(roofs);
  hitMeshes.push(roofs);

  // ---- palms, lamps, props ---------------------------------------------------
  const { trunk, crown, topX, topY } = palmGeometries();
  const trunkParts = [];
  const crownParts = [];
  function addPalm(x, z, s = 1) {
    trunkParts.push({ geometry: trunk, x, y: 0, z, ry: range(rnd, 0, Math.PI * 2), sx: s, sy: s * range(rnd, 0.9, 1.15), sz: s });
    crownParts.push({ geometry: crown, x: x + topX * s, y: topY * s, z, ry: range(rnd, 0, Math.PI * 2), sx: s, sy: s, sz: s });
    addCollider(x, z, 0.7, 0.7);
  }
  for (let x = -20; x <= 330; x += 15) {
    addPalm(x + range(rnd, -2, 2), BOARDWALK_Z - 5.5, range(rnd, 0.95, 1.2));
    if (chance(rnd, 0.6)) addPalm(x + range(rnd, -3, 3), BEACH_Z0 + range(rnd, 2, 9), range(rnd, 0.85, 1.1));
  }
  for (const line of STREET_LINES) {
    for (let a = 14; a < 320; a += 52) {
      if (chance(rnd, 0.75)) addPalm(line - 10.4, a + range(rnd, -3, 3), range(rnd, 0.8, 1.05));
      if (chance(rnd, 0.75)) addPalm(a + range(rnd, -3, 3), line + 10.4, range(rnd, 0.8, 1.05));
    }
  }
  const trunkMesh = new THREE.Mesh(mergeParts(trunkParts), new THREE.MeshLambertMaterial({ color: 0x8a6a48 }));
  trunkMesh.castShadow = true;
  group.add(trunkMesh);
  const crownMesh = new THREE.Mesh(mergeParts(crownParts), new THREE.MeshLambertMaterial({ map: palmFrondTexture(), alphaTest: 0.45, side: THREE.DoubleSide }));
  crownMesh.castShadow = true;
  group.add(crownMesh);

  const lampParts = [];
  const lampGlowParts = [];
  for (const line of STREET_LINES) {
    for (let a = 4; a <= 326; a += 30) {
      for (const side of [-1, 1]) {
        lampParts.push({ geometry: UNIT_CYLINDER, x: line + side * 8.8, y: 2.9, z: a, sx: 0.22, sy: 5.8, sz: 0.22 });
        lampGlowParts.push({ geometry: UNIT_BOX, x: line + side * 8.8, y: 5.9, z: a, sx: 0.7, sy: 0.3, sz: 0.7 });
        lampParts.push({ geometry: UNIT_CYLINDER, x: a, y: 2.9, z: line + side * 8.8, sx: 0.22, sy: 5.8, sz: 0.22 });
        lampGlowParts.push({ geometry: UNIT_BOX, x: a, y: 5.9, z: line + side * 8.8, sx: 0.7, sy: 0.3, sz: 0.7 });
      }
    }
  }
  const lampMesh = new THREE.Mesh(mergeParts(lampParts), new THREE.MeshLambertMaterial({ color: 0x3c4046 }));
  group.add(lampMesh);
  const lampGlow = new THREE.Mesh(mergeParts(lampGlowParts), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  group.add(lampGlow);

  // Boardwalk benches, beach umbrellas, marina pier and boats.
  for (let x = 0; x <= 320; x += 32) {
    woodParts.push({ geometry: UNIT_BOX, x, y: 0.55, z: BOARDWALK_Z + 4, sx: 2.4, sy: 0.18, sz: 0.7 });
    woodParts.push({ geometry: UNIT_BOX, x, y: 0.28, z: BOARDWALK_Z + 4, sx: 2.2, sy: 0.5, sz: 0.5 });
  }
  const umbrellaParts = [];
  for (let i = 0; i < 14; i += 1) {
    const x = range(rnd, -10, 330);
    const z = range(rnd, BEACH_Z0 + 4, BEACH_Z1 - 6);
    darkParts.push({ geometry: UNIT_CYLINDER, x, y: 1.1, z, sx: 0.12, sy: 2.2, sz: 0.12 });
    umbrellaParts.push({ geometry: new THREE.ConeGeometry(2.3, 1.0, 8), x, y: 2.4, z });
  }
  const umbrellaMesh = new THREE.Mesh(mergeParts(umbrellaParts), new THREE.MeshLambertMaterial({ color: 0xff6b4a }));
  umbrellaMesh.castShadow = true;
  group.add(umbrellaMesh);

  woodParts.push({ geometry: UNIT_BOX, x: 150, y: 0.35, z: 378, sx: 7, sy: 0.5, sz: 44 });
  for (let z = 360; z <= 398; z += 9) {
    darkParts.push({ geometry: UNIT_CYLINDER, x: 146.8, y: -0.4, z, sx: 0.5, sy: 2.4, sz: 0.5 });
    darkParts.push({ geometry: UNIT_CYLINDER, x: 153.2, y: -0.4, z, sx: 0.5, sy: 2.4, sz: 0.5 });
  }
  const boats = [];
  const boatColors = [0xf2f2f2, 0xd94f30, 0x2a6fb5, 0xffc93f, 0x1f8a70, 0xf2f2f2];
  for (let i = 0; i < 6; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 8.5), new THREE.MeshLambertMaterial({ color: boatColors[i] }));
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3), new THREE.MeshLambertMaterial({ color: 0xf6f1e6 }));
    cabin.position.set(0, 1.4, -0.6);
    boat.add(cabin);
    boat.position.set(128 + i * 11 + range(rnd, -2, 2), -0.2, 384 + (i % 2) * 16);
    boat.rotation.y = range(rnd, -0.2, 0.2);
    group.add(boat);
    boats.push(boat);
  }

  const matOf = (color) => new THREE.MeshLambertMaterial({ color });
  const partSets = [
    [woodParts, matOf(WOOD_COLOR)],
    [darkParts, matOf(0x3c4046)],
    [whiteParts, matOf(0xf6f1e6)],
    [greenParts, matOf(0x3d6b35)],
    [orangeParts, matOf(0xe8762c)],
  ];
  for (const [parts, mat] of partSets) {
    if (parts.length === 0) continue;
    const mesh = new THREE.Mesh(mergeParts(parts), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  scene.add(group);

  let flicker = 0;
  function update(dt, t) {
    seaTex.offset.y = (t * 0.008) % 1;
    seaTex.offset.x = Math.sin(t * 0.05) * 0.02;
    clouds.position.x = Math.sin(t * 0.01) * 14;
    for (let i = 0; i < boats.length; i += 1) {
      boats[i].position.y = -0.2 + Math.sin(t * 0.9 + i * 1.7) * 0.14;
      boats[i].rotation.z = Math.sin(t * 0.7 + i) * 0.03;
    }
    flicker += dt;
    if (flicker > 0.12 && signs.length > 3) {
      flicker = 0;
      const sign = signs[Math.floor(Math.random() * signs.length)];
      sign.material.opacity = 1;
      if (Math.random() < 0.24) sign.visible = false;
      else sign.visible = true;
    }
  }

  return { group, colliders, hitMeshes, update };
}
