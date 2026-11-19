// The wanted system: crimes add heat, heat reads as one to five stars, and stars fade one
// at a time while no police car has eyes on Dario. Being seen resets the cooling clock —
// breaking line of sight (distance, in this build) is how you lose the heat.

import { WANTED } from './config.js';

/** How much heat each crime adds, in star units. */
const CRIME_HEAT = {
  theft: 1,
  assault: 1,
  hitAndRun: 1,
  hitPolice: 1,
  crash: 0.34,
  gunshot: 0.5,
  robbery: 3,
};

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.sighted = false;
    this.unsightedTime = 0;
    this.shotHeatCooldown = 0;
    this.onStarsChanged = null;
  }

  /** The current star count, 0..5. */
  get stars() {
    if (this.heat <= 0) return 0;
    return Math.min(WANTED.maxStars, Math.ceil(this.heat));
  }

  /** Record a crime; some kinds are rate-limited so one spree cannot max out instantly. */
  commit(kind) {
    const before = this.stars;
    if (kind === 'robbery') {
      this.heat = Math.max(this.heat, CRIME_HEAT.robbery);
    } else if (kind === 'gunshot') {
      if (this.shotHeatCooldown > 0) return;
      this.shotHeatCooldown = 4;
      this.heat += CRIME_HEAT.gunshot;
    } else {
      this.heat += CRIME_HEAT[kind] ?? 0.5;
    }
    this.heat = Math.min(5.6, this.heat);
    this.unsightedTime = 0;
    if (this.stars !== before && this.onStarsChanged) this.onStarsChanged(this.stars);
  }

  /** Force at least `stars` (mission beats: a noticed theft, the robbery alarm). */
  raiseTo(stars) {
    const before = this.stars;
    this.heat = Math.max(this.heat, stars);
    this.unsightedTime = 0;
    if (this.stars !== before && this.onStarsChanged) this.onStarsChanged(this.stars);
  }

  /** Clear everything (busted, or a mission script that ends the chase). */
  clear() {
    const before = this.stars;
    this.heat = 0;
    this.unsightedTime = 0;
    if (before !== 0 && this.onStarsChanged) this.onStarsChanged(0);
  }

  /** Police call this each frame with whether any cruiser currently sees the player. */
  setSighted(seen) {
    this.sighted = seen;
  }

  update(dt) {
    this.shotHeatCooldown = Math.max(0, this.shotHeatCooldown - dt);
    if (this.heat <= 0) return;
    if (this.sighted) {
      this.unsightedTime = 0;
      return;
    }
    this.unsightedTime += dt;
    if (this.unsightedTime >= WANTED.decaySeconds) {
      const before = this.stars;
      this.heat = Math.max(0, Math.ceil(this.heat) - 1);
      this.unsightedTime = 0;
      if (this.stars !== before && this.onStarsChanged) this.onStarsChanged(this.stars);
    }
  }
}
