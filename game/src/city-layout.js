// The Port Solano street plan as data: where the streets run, what each block holds, where
// cars may park and pedestrians may walk. The building factory, traffic AI and minimap all
// read this one plan, so the city they draw is the city the player drives.

import { PITCH, ROAD_WIDTH, STREET_LINES } from './config.js';
import { intRange, pick } from './random.js';

/** Half the road width: the distance from a street centre line to its kerb. */
export const HALF_ROAD = ROAD_WIDTH / 2;
/** Where a right-hand-traffic lane sits, offset from the street centre line. */
export const LANE_OFFSET = 4.1;

/** The buildable interior of the block east/south of intersection (i, j): kerb to kerb. */
export function blockRect(i, j) {
  const x0 = STREET_LINES[i] + HALF_ROAD;
  const z0 = STREET_LINES[j] + HALF_ROAD;
  return { x0, z0, x1: x0 + (PITCH - ROAD_WIDTH), z1: z0 + (PITCH - ROAD_WIDTH) };
}

/** What each city block is zoned as; the factory builds to match. Row j=2 faces the strip. */
export const BLOCK_KINDS = (() => {
  const kinds = [];
  const table = [
    ['towers', 'towers', 'mixed', 'towers', 'mixed'],
    ['mixed', 'shops', 'shops', 'mixed', 'towers'],
    ['motels', 'motels', 'shops', 'motels', 'shops'],
    ['mixed', 'houses', 'mixed', 'houses', 'mixed'],
    ['houses', 'mixed', 'houses', 'towers', 'houses'],
  ];
  for (let j = 0; j < 5; j += 1) {
    for (let i = 0; i < 5; i += 1) kinds.push({ i, j, kind: table[j][i] });
  }
  return kinds;
})();

/** The neon strip: the east–west street at z = 120, where motels and shops put their signs. */
export const STRIP_Z = 120;
/** The coast road: the east–west street at z = 300, with the boardwalk and sea to its south. */
export const COAST_Z = 300;

/**
 * A lane position for a car travelling `dir` (+1 or -1) along `axis` ('x' or 'z') on the
 * street whose centre line is `line`: right-hand traffic, so the lane sits to the driver's
 * right of the centre. Returns the fixed cross-axis coordinate.
 */
export function laneCoordinate(axis, line, dir) {
  // Travelling +x, the right side is +z; travelling +z, the right side is -x.
  if (axis === 'x') return line + (dir > 0 ? LANE_OFFSET : -LANE_OFFSET);
  return line + (dir > 0 ? -LANE_OFFSET : LANE_OFFSET);
}

/** Sidewalk walking lines: the cross-axis coordinate of the pavement beside a street. */
export function sidewalkCoordinate(line, side) {
  return line + side * (HALF_ROAD + 2.1);
}

/** Parking spots along the kerbs: { x, z, ry } poses traffic leaves cars in. */
export function parkingSpots(rnd) {
  const spots = [];
  for (const zLine of STREET_LINES) {
    for (let i = 0; i < 5; i += 1) {
      const xBase = STREET_LINES[i] + HALF_ROAD + 6;
      for (let k = 0; k < 3; k += 1) {
        if (rnd() < 0.45) continue;
        const side = rnd() < 0.5 ? -1 : 1;
        spots.push({ x: xBase + k * 13 + rnd() * 3, z: zLine + side * (HALF_ROAD + 1.6), ry: Math.PI / 2 });
      }
    }
  }
  for (const xLine of STREET_LINES) {
    for (let j = 0; j < 5; j += 1) {
      const zBase = STREET_LINES[j] + HALF_ROAD + 6;
      for (let k = 0; k < 3; k += 1) {
        if (rnd() < 0.5) continue;
        const side = rnd() < 0.5 ? -1 : 1;
        spots.push({ x: xLine + side * (HALF_ROAD + 1.6), z: zBase + k * 13 + rnd() * 3, ry: 0 });
      }
    }
  }
  return spots;
}

/** A random point on a random street, on the road itself (police and traffic spawn here). */
export function randomRoadPoint(rnd, near, minDist, maxDist) {
  for (let tries = 0; tries < 24; tries += 1) {
    const vertical = rnd() < 0.5;
    const line = pick(rnd, STREET_LINES);
    const along = -10 + rnd() * 330;
    const x = vertical ? line : along;
    const z = vertical ? along : line;
    const d = Math.hypot(x - near.x, z - near.z);
    if (d >= minDist && d <= maxDist) return { x, z };
  }
  return { x: near.x + minDist, z: near.z };
}

/** A random sidewalk point near a place (passengers and pedestrians appear here). */
export function randomSidewalkPoint(rnd, near, maxDist) {
  for (let tries = 0; tries < 24; tries += 1) {
    const vertical = rnd() < 0.5;
    const line = pick(rnd, STREET_LINES);
    const side = rnd() < 0.5 ? -1 : 1;
    const along = Math.max(-6, Math.min(326, near[vertical ? 'z' : 'x'] + (rnd() * 2 - 1) * maxDist));
    const cross = sidewalkCoordinate(line, side);
    const x = vertical ? cross : along;
    const z = vertical ? along : cross;
    if (x > -20 && x < 340 && z > -20 && z < 336) return { x, z };
  }
  return { x: near.x + 6, z: near.z + 2 };
}

/** Distance from a point to the nearest street centre line (road proximity checks). */
export function distanceToRoad(x, z) {
  let best = Infinity;
  for (const line of STREET_LINES) {
    best = Math.min(best, Math.abs(x - line), Math.abs(z - line));
  }
  return best;
}

/** Whether a point is on a road or its kerb (within half the road plus a margin). */
export function isOnRoad(x, z, margin = 1.5) {
  return distanceToRoad(x, z) <= HALF_ROAD + margin;
}

/** A heading (radians, three.js rotation.y) for travel direction along an axis.
 *  Models are built facing +z, so the forward vector of heading ry is (sin ry, 0, cos ry). */
export function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

/** The forward vector (x, z) of a heading. */
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** Pick a spawn intersection index pair away from the middle of the map. */
export function edgeIntersection(rnd) {
  const options = [0, 5];
  return { i: pick(rnd, options.concat([1, 2, 3, 4])), j: intRange(rnd, 0, 5) };
}
