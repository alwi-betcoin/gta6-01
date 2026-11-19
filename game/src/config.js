// SOLANO HEAT — shared tuning constants: the Port Solano street grid, the golden-hour palette
// and the numbers every system agrees on (speeds, radii, prices). One place to tune the game.

/** The game: an original open-world crime game. Title shown on the start screen and HUD. */
export const GAME_TITLE = 'SOLANO HEAT';
export const CITY_NAME = 'Port Solano';

/** Street grid: streets run along both axes at these centre-line coordinates (metres). */
export const PITCH = 60;
export const STREET_LINES = [0, 60, 120, 180, 240, 300];
export const ROAD_WIDTH = 16;
export const SIDEWALK = 4;
/** Land runs from LAND_MIN to LAND_MAX on both axes; south of the city lies the beach. */
export const LAND_MIN = -34;
export const LAND_MAX = 334;
/** Boardwalk, sand and sea bands on the south edge (z grows southward here). */
export const BOARDWALK_Z = 322;
export const BEACH_Z0 = 330;
export const BEACH_Z1 = 360;
export const SEA_Z = 360;

/** The fixed simulation step (seconds) and the most steps one frame may catch up on. */
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

/** Player tuning. */
export const PLAYER = {
  walkSpeed: 5.4,
  sprintSpeed: 8.8,
  radius: 0.55,
  maxHealth: 100,
  punchRange: 1.9,
  punchDamage: 34,
};

/** Wanted tuning: heat thresholds are per-star police counts and busted/wasted prices. */
export const WANTED = {
  maxStars: 5,
  decaySeconds: 11,
  bustFillSeconds: 1.6,
  finePerStar: 120,
  hospitalFee: 150,
};

/** Golden-hour palette, shared by the sky, fog, lights and materials so the city coheres. */
export const PALETTE = {
  skyTop: 0x3a6ea8,
  skyHorizon: 0xffb36b,
  skyLow: 0xff8c5a,
  fog: 0xf2a56b,
  sun: 0xffd9a0,
  sunLow: 0xff9e57,
  hemiSky: 0x9db8dd,
  hemiGround: 0x8a6a4f,
  asphalt: 0x35373c,
  sidewalk: 0xb9a98f,
  sand: 0xe8cf9e,
  sea: 0x1d7a8c,
  seaDeep: 0x14586e,
  grass: 0x77a24b,
};

/** Named places the story and systems point at (x, z on the street grid). */
export const LANDMARKS = {
  fixerCafe: { x: 150, y: 0, z: 316, label: 'Café Azul — Marisol Vega' },
  marinaDock: { x: 96, y: 0, z: 352, label: 'Marina dock warehouse' },
  motelPalmas: { x: 66, y: 0, z: 128, label: 'Motel Palmas' },
  stripStore: { x: 186, y: 0, z: 128, label: 'Brillo Jewelers' },
  chopGarage: { x: 276, y: 0, z: 36, label: "Sal's Chop Garage" },
  hideout: { x: 36, y: 0, z: 286, label: "Vega's warehouse" },
  hospital: { x: 24, y: 0, z: 252, label: 'Solano General Hospital' },
  station: { x: 132, y: 0, z: 192, label: 'Port Solano PD' },
  specialCar: { x: 204, y: 0, z: 66, label: 'A parked Cordero muscle car' },
};

/** localStorage keys (save-game.js owns the shapes). */
export const SAVE_KEY = 'solano-heat-save-v1';
