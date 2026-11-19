// Merging many transformed boxes into one BufferGeometry, so the static city (hundreds of
// buildings, palms, lamps and props) costs a handful of draw calls instead of hundreds.
// Only what the city factory needs: position, normal, uv and an index, merged by hand.

import * as THREE from '../vendor/three.module.min.js';

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();

/**
 * Merge `parts` — each { geometry, x, y, z, ry?, sx?, sy?, sz?, uvScale? } — into one geometry.
 * `uvScale` multiplies the part's uvs (facade textures repeat per building, not per world).
 * The source geometries are not disposed; callers share cached ones.
 */
export function mergeParts(parts) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const part of parts) {
    vertexCount += part.geometry.attributes.position.count;
    indexCount += part.geometry.index ? part.geometry.index.count : part.geometry.attributes.position.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);
  let vOff = 0;
  let iOff = 0;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (const part of parts) {
    const geo = part.geometry;
    _euler.set(0, part.ry ?? 0, 0);
    _quat.setFromEuler(_euler);
    _pos.set(part.x ?? 0, part.y ?? 0, part.z ?? 0);
    _scale.set(part.sx ?? 1, part.sy ?? 1, part.sz ?? 1);
    _matrix.compose(_pos, _quat, _scale);
    _normalMatrix.getNormalMatrix(_matrix);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const uvS = part.uvScale ?? [1, 1];
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(_matrix);
      positions[(vOff + i) * 3] = v.x;
      positions[(vOff + i) * 3 + 1] = v.y;
      positions[(vOff + i) * 3 + 2] = v.z;
      n.fromBufferAttribute(nor, i).applyMatrix3(_normalMatrix).normalize();
      normals[(vOff + i) * 3] = n.x;
      normals[(vOff + i) * 3 + 1] = n.y;
      normals[(vOff + i) * 3 + 2] = n.z;
      if (uv) {
        uvs[(vOff + i) * 2] = uv.getX(i) * uvS[0];
        uvs[(vOff + i) * 2 + 1] = uv.getY(i) * uvS[1];
      }
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i += 1) indices[iOff + i] = geo.index.getX(i) + vOff;
      iOff += geo.index.count;
    } else {
      for (let i = 0; i < pos.count; i += 1) indices[iOff + i] = vOff + i;
      iOff += pos.count;
    }
    vOff += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

/** A shared unit box geometry (1×1×1, centred) that mergeParts scales into place. */
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
/** A shared unit cylinder (radius 0.5, height 1) for trunks, poles and posts. */
export const UNIT_CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
/** A shared unit plane for signs, fronds and decals. */
export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
