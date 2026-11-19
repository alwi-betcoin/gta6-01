// Procedural textures: every surface in Port Solano is painted on a canvas at boot — asphalt,
// lit-window facades, sand, sea, palm fronds, neon signs — so the game ships no image assets
// and loads nothing over the network. Textures are cached and shared between materials.

import * as THREE from '../vendor/three.module.min.js';
import { pick, range } from './random.js';

const cache = new Map();

/** A canvas of the given size with a 2D context, ready to paint on. */
function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

/** Turn a painted canvas into a repeating sRGB texture. */
function toTexture(canvas, repeat = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

/** Asphalt with worn patches and a faded centre dash, drawn to repeat along a road. */
export function asphaltTexture() {
  if (cache.has('asphalt')) return cache.get('asphalt');
  const [canvas, g] = makeCanvas(256, 256);
  g.fillStyle = '#35373c';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = `rgba(${20 + Math.random() * 40},${20 + Math.random() * 40},${22 + Math.random() * 40},0.25)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = 'rgba(240,220,150,0.85)';
  g.fillRect(124, 8, 8, 84);
  g.fillRect(124, 164, 8, 84);
  g.fillStyle = 'rgba(230,230,230,0.5)';
  g.fillRect(6, 0, 5, 256);
  g.fillRect(245, 0, 5, 256);
  const tex = toTexture(canvas);
  cache.set('asphalt', tex);
  return tex;
}

/** Plain warm concrete for sidewalks and the boardwalk. */
export function concreteTexture() {
  if (cache.has('concrete')) return cache.get('concrete');
  const [canvas, g] = makeCanvas(128, 128);
  g.fillStyle = '#b9a98f';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i += 1) {
    g.fillStyle = `rgba(90,75,55,${Math.random() * 0.16})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.strokeStyle = 'rgba(80,66,48,0.55)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  const tex = toTexture(canvas);
  cache.set('concrete', tex);
  return tex;
}

/**
 * A building facade: a coloured wall with a grid of windows, some lit warm for the golden
 * hour. `lit` is the same drawing's window layer, used as the emissive map so windows glow
 * without a second texture pass. Variant chosen by seed so merged buildings can share one.
 */
export function facadeTextures(rnd, variant) {
  const key = `facade-${variant}`;
  if (cache.has(key)) return cache.get(key);
  const [canvas, g] = makeCanvas(256, 256);
  const [litCanvas, lg] = makeCanvas(256, 256);
  const walls = ['#c96f4a', '#d9a066', '#a8b8c4', '#e0cfa8', '#b45a68', '#7fa3a1', '#e8e3d8', '#caa472'];
  g.fillStyle = walls[variant % walls.length];
  g.fillRect(0, 0, 256, 256);
  lg.fillStyle = '#000000';
  lg.fillRect(0, 0, 256, 256);
  const cols = 8;
  const rows = 10;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const wx = 10 + x * 30;
      const wy = 9 + y * 24;
      const lit = rnd() < 0.42;
      g.fillStyle = lit ? '#ffd98c' : '#2c3e50';
      g.fillRect(wx, wy, 19, 14);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(wx, wy, 19, 4);
      if (lit) {
        lg.fillStyle = `rgba(255,${190 + Math.floor(rnd() * 40)},110,1)`;
        lg.fillRect(wx, wy, 19, 14);
      }
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 246, 256, 10);
  const pair = { map: toTexture(canvas), emissive: toTexture(litCanvas) };
  cache.set(key, pair);
  return pair;
}

/** Beach sand with speckle and a wet band at the bottom edge. */
export function sandTexture() {
  if (cache.has('sand')) return cache.get('sand');
  const [canvas, g] = makeCanvas(256, 256);
  g.fillStyle = '#e8cf9e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i += 1) {
    g.fillStyle = `rgba(160,125,70,${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const tex = toTexture(canvas);
  cache.set('sand', tex);
  return tex;
}

/** Sea surface: deep teal with lighter sparkle streaks; the material scrolls it slowly. */
export function seaTexture() {
  if (cache.has('sea')) return cache.get('sea');
  const [canvas, g] = makeCanvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a93a8');
  grad.addColorStop(1, '#14586e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,230,180,0.35)';
  for (let i = 0; i < 46; i += 1) {
    const y = Math.random() * 256;
    g.beginPath();
    g.moveTo(Math.random() * 200, y);
    g.lineTo(Math.random() * 60 + 200, y);
    g.stroke();
  }
  const tex = toTexture(canvas);
  cache.set('sea', tex);
  return tex;
}

/** A palm frond fan drawn with alpha, for crossed-plane palm crowns. */
export function palmFrondTexture() {
  if (cache.has('palm')) return cache.get('palm');
  const [canvas, g] = makeCanvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.translate(128, 250);
  for (let i = 0; i < 9; i += 1) {
    const angle = -Math.PI / 2 + (i - 4) * 0.24;
    g.save();
    g.rotate(angle);
    g.fillStyle = i % 2 ? '#3f7d33' : '#4c9440';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(10, -90, 3, -170);
    g.quadraticCurveTo(-6, -90, 0, 0);
    g.fill();
    g.restore();
  }
  const tex = toTexture(canvas, false);
  cache.set('palm', tex);
  return tex;
}

/** A neon sign: glowing text on a dark board. Each sign text gets its own small texture. */
export function signTexture(text, color, rnd) {
  const key = `sign-${text}-${color}`;
  if (cache.has(key)) return cache.get(key);
  const [canvas, g] = makeCanvas(512, 128);
  g.fillStyle = '#1c1420';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.strokeRect(8, 8, 496, 112);
  g.font = 'bold 58px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 22;
  g.fillStyle = color;
  g.fillText(text, 256, 68);
  g.shadowBlur = 6;
  g.fillText(text, 256, 68);
  const tex = toTexture(canvas, false);
  cache.set(key, tex);
  return tex;
}

/** Striped awning canvas for shop fronts. */
export function awningTexture(colorA, colorB) {
  const key = `awning-${colorA}`;
  if (cache.has(key)) return cache.get(key);
  const [canvas, g] = makeCanvas(128, 64);
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = i % 2 ? colorA : colorB;
    g.fillRect(i * 16, 0, 16, 64);
  }
  const tex = toTexture(canvas);
  cache.set(key, tex);
  return tex;
}

/** A soft round glow dot, used for light halos, muzzle flashes and marker sprites. */
export function glowTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const [canvas, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = toTexture(canvas, false);
  cache.set('glow', tex);
  return tex;
}

/** An exclamation mark in a disc — the "!" a fleeing pedestrian pops overhead. */
export function alertTexture() {
  if (cache.has('alert')) return cache.get('alert');
  const [canvas, g] = makeCanvas(64, 64);
  g.fillStyle = '#ffcf3f';
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#40260a';
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', 32, 34);
  const tex = toTexture(canvas, false);
  cache.set('alert', tex);
  return tex;
}

/** Paint names used across the city so signs and buildings stay in one art direction. */
export const SIGN_NAMES = [
  'MOTEL PALMAS', 'CAFÉ AZUL', 'TACO REY', 'HOTEL SOL', 'BRILLO', 'PAWN ★',
  'GYM FUERZA', 'LIQUOR', 'BANCO SOLANO', 'SURF SHOP', 'DINER 9', 'FARMACIA',
];
export const NEON_COLORS = ['#ff5da2', '#39d0ff', '#ffb340', '#7dff6a', '#ff7847', '#c792ff'];

/** A random neon colour from the shared palette. */
export function neonColor(rnd) {
  return pick(rnd, NEON_COLORS);
}

/** Slight per-mesh colour variation helper (keeps merged geometry lively). */
export function variedColor(base, rnd, amount = 0.06) {
  const c = base.clone();
  const d = range(rnd, -amount, amount);
  c.offsetHSL(0, 0, d);
  return c;
}
