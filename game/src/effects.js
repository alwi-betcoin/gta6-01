// Juice: a pooled particle system (damage smoke, crash dust, tyre smoke, splashes of
// sparks), pooled skid-mark decals laid by drifting wheels, muzzle flashes with a real
// light, fast-fading tracers, and the screen shake the camera adds on impacts. Everything
// is pre-allocated; the hot loop only moves numbers.

import * as THREE from '../vendor/three.module.min.js';
import { glowTexture } from './textures.js';

const MAX_PARTICLES = 420;
const MAX_SKIDS = 260;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    // Particles: one Points cloud, per-particle life in a side array.
    this.pGeo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.pVel = new Float32Array(MAX_PARTICLES * 3);
    this.pLife = new Float32Array(MAX_PARTICLES);
    this.pMaxLife = new Float32Array(MAX_PARTICLES);
    this.pCursor = 0;
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: 1.5, map: glowTexture(), transparent: true, opacity: 0.55, vertexColors: true, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(this.pGeo, pMat);
    this.points.frustumCulled = false;
    for (let i = 0; i < MAX_PARTICLES; i += 1) this.pPos[i * 3 + 1] = -50;
    scene.add(this.points);

    // Skid marks: a ring of dark quads lying on the road.
    this.skidGeo = new THREE.PlaneGeometry(0.3, 1);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: 0.5, depthWrite: false });
    this.skids = [];
    for (let i = 0; i < MAX_SKIDS; i += 1) {
      const m = new THREE.Mesh(this.skidGeo, this.skidMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = -50;
      m.renderOrder = 1;
      scene.add(m);
      this.skids.push(m);
    }
    this.skidCursor = 0;

    // Muzzle flash: a glow sprite and a brief point light.
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb340, transparent: true, opacity: 0, depthWrite: false }));
    this.flash.scale.setScalar(1.4);
    scene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffa040, 0, 16);
    scene.add(this.flashLight);
    this.flashTimer = 0;

    // Tracers: pooled lines that fade in a few frames.
    this.tracers = [];
    for (let i = 0; i < 8; i += 1) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 }));
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.tracerCursor = 0;

    this.shakeAmount = 0;
    this.time = 0;
  }

  /** Spawn `count` particles at a point with a colour, upward drift and spread. */
  burst(point, count, color, speed = 2.2, rise = 2.4, life = 0.9) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n += 1) {
      const i = this.pCursor;
      this.pCursor = (this.pCursor + 1) % MAX_PARTICLES;
      this.pPos[i * 3] = point.x + (Math.random() - 0.5) * 0.5;
      this.pPos[i * 3 + 1] = point.y + (Math.random() - 0.5) * 0.4;
      this.pPos[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.5;
      this.pVel[i * 3] = (Math.random() - 0.5) * speed;
      this.pVel[i * 3 + 1] = Math.random() * rise;
      this.pVel[i * 3 + 2] = (Math.random() - 0.5) * speed;
      const shade = 0.8 + Math.random() * 0.35;
      this.pCol[i * 3] = c.r * shade;
      this.pCol[i * 3 + 1] = c.g * shade;
      this.pCol[i * 3 + 2] = c.b * shade;
      this.pLife[i] = life * (0.6 + Math.random() * 0.7);
      this.pMaxLife[i] = this.pLife[i];
    }
  }

  /** Lay one skid quad under a wheel; called per rear wheel while drifting. */
  skid(x, z, heading, length = 1.1) {
    const m = this.skids[this.skidCursor];
    this.skidCursor = (this.skidCursor + 1) % MAX_SKIDS;
    m.position.set(x, 0.045, z);
    m.rotation.z = -heading;
    m.scale.set(1, length, 1);
  }

  /** A gunshot's flash at the muzzle. */
  muzzle(point) {
    this.flash.position.copy(point);
    this.flash.material.opacity = 0.95;
    this.flashLight.position.copy(point);
    this.flashLight.intensity = 26;
    this.flashTimer = 0.045;
  }

  /** A tracer line from muzzle to hit point. */
  tracer(from, to) {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.material.opacity = 0.9;
    t.life = 0.07;
  }

  /** Add impact shake (decays in update; the camera reads shakeOffset). */
  shake(amount) {
    this.shakeAmount = Math.min(0.55, this.shakeAmount + amount);
  }

  /** A small random camera offset scaled by the current shake. */
  shakeOffset(out) {
    const s = this.shakeAmount;
    out.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.7, (Math.random() - 0.5) * s);
    return out;
  }

  update(dt) {
    this.time += dt;
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        this.pPos[i * 3 + 1] = -50;
        continue;
      }
      this.pVel[i * 3 + 1] += 0.6 * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash.material.opacity = 0;
        this.flashLight.intensity = 0;
      }
    }
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      }
    }
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 1.6);
  }
}
