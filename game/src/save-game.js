// Persistence: cash, story progress and lifetime stats in localStorage, so Continue picks
// Dario up where the player left him. Every access is guarded — private windows and full
// storage simply mean the game runs session-only.

import { SAVE_KEY } from './config.js';

/** A fresh save: starting cash, no missions done, nothing earned yet. */
export function defaultSave() {
  return { cash: 120, nextMission: 0, storyDone: false, totalEarned: 0, faresDone: 0, busts: 0, wasted: 0 };
}

/** The stored save, or null when there is none (or it cannot be read or parsed). */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.cash !== 'number') return null;
    return { ...defaultSave(), ...parsed };
  } catch {
    return null;
  }
}

/** Store the save (best effort). */
export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable: the run continues without persistence.
  }
}

/** Wipe the save (New Game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
