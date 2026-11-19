// A small seeded random generator (mulberry32) so a given ?seed always builds the same city
// and stages the same screenshot, plus the pick/range helpers every system shares.

/** Create a generator from a 32-bit seed. Returns a function giving floats in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from generator `rnd`. */
export function range(rnd, min, max) {
  return min + rnd() * (max - min);
}

/** An integer in [min, max] inclusive from generator `rnd`. */
export function intRange(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

/** One element of `list`, chosen by generator `rnd`. */
export function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length) % list.length];
}

/** True with probability `p` according to generator `rnd`. */
export function chance(rnd, p) {
  return rnd() < p;
}
