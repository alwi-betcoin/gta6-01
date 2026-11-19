[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/alwi-betcoin/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/alwi-betcoin/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLANO HEAT

An original 3D open-world crime game for desktop Chrome, built for the make.fun **gta6-01** bounty. Welcome to **Port Solano** — a sun-soaked coastal city of palm boulevards, neon motels and a working marina, all of it explorable on foot and by car. You are **Dario "Dash" Kane**, a wheelman fresh off the bus with $120 and a borrowed phone. Fixer **Marisol Vega** (Café Azul, on the boardwalk) has work: four story jobs that take you from a timed package run to the Brillo Jewelers score — if you can lose the heat afterwards.

Everything is original: the city, the names, the story, the art and the music were made for this entry. No Rockstar material anywhere.

## Play it

Serve the repo root and open the game (any static server works — the game itself makes **zero network requests**):

```
node serve.ts            # or: python3 -m http.server --directory game
# open http://localhost:8080  (the game is game/index.html)
```

New Game starts the story at the boardwalk. Continue picks up your saved cash, mission progress and pistol from `localStorage`.

## What's in the world

- **The city** — a 6×6 street grid over a coastal shelf: uptown towers, a neon motel/shop strip (Brillo Jewelers, Hotel Sol, Pawn ★, Taco Rey), the Cordero chop garage, a marina with docks and boats, boardwalk, beach and open sea. Procedural buildings with lit windows, palms, streetlights, props, golden-hour sun, fog and a gradient sky.
- **On foot** — third-person Dario with a walk cycle: WASD + mouse-orbit camera, sprint, punching, and a pistol (draw with `2`) with hitscan tracers, muzzle flash and hit reactions.
- **Cars** — six body types (sedan, muscle, truck, convertible, taxi, police cruiser) with arcade physics and handbrake drift. Parked cars all over the city: press `E` to steal one, `E` to get out. Traffic AI drives the grid, stops at junctions, honks, panics and flees.
- **Pedestrians** — sidewalk walkers who flee screaming (with `!` popups) from gunfire, fights and cars on the sidewalk — and who sometimes call it in.
- **Wanted & police** — a 1–5 star meter. Stealing, collisions, brawls and gunfire raise it; it decays when nobody can see you. Cruisers spawn at the city edges with synthesized sirens and flashing light bars, pursue, flank and ram; at 4+ stars they shoot. Get cornered on foot and the BUSTED meter fills — pay the fine and walk out of the station, or die and wake up at Solano General (WASTED, hospital fee applies).
- **Missions** — a four-job story chain with intro cards, dialogue, HUD objectives, map markers and beacons:
  1. **First Run** — a package from the marina to Motel Palmas, against the clock.
  2. **The Cordero Special** — steal the marked pink muscle car and deliver it to the chop garage while the city watches.
  3. **Harbor Sprint** — six checkpoints through the whole city in 140 seconds.
  4. **The Solano Score** — rob Brillo Jewelers on foot, survive the guards and 3 stars, lose the heat, reach the hideout.
  Between jobs, Marisol offers repeatable **taxi fares** — pick up, drop off, get paid.
- **HUD & menus** — cash, wanted stars, health (+ car health), weapon, district name, objective banner with sub-status, interaction prompts, dialogue subtitles, floating cash text, and a live **minimap** (streets, water, player arrow, gold mission blip, police blips). Title screen over a live city view, pause menu, busted/wasted screens.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Orbit camera (drag, or click the game for pointer lock) |
| Shift | Sprint |
| Space | Jump (on foot) / handbrake (in car) |
| E | Enter / exit car, context actions |
| 1 / 2 | Fists / pistol |
| Mouse click | Punch / shoot |
| P or Esc | Pause |
| M | Mute |

## How it was built

- **Stack:** three.js (vendored as one minified ES module at `game/vendor/three.module.min.js`), hand-written ES modules under `game/src/` — one clear job per file: `city-layout`, `building-factory`, `vehicles`, `traffic-ai`, `pedestrians`, `wanted-system`, `police-pursuit`, `combat`, `mission-chain`, `minimap`, `hud`, `audio-synth`, `effects`, `save-game`, `main`, and a `shots` staging module used to frame the screenshots through the game's own state.
- **Assets:** none. Every texture is drawn on a canvas at boot (asphalt, facades with emissive windows, neon signs, sand, sea); every sound is synthesized with WebAudio (engine, siren, shots, impacts, pickups, a warm music loop). The city is deterministic from a seed.
- **Performance:** merged static geometry for the whole city, pooled particles, shared geometries/materials, capped traffic/pedestrian counts, fixed-step simulation decoupled from rendering.
- **Screenshots:** staged with the game's own code (`game/src/shots.js` + `capture-shots.mjs` at the repo root) and captured unedited from headless Chrome at 1280×720.
- **Dossier:** `node main.ts` copies `game/` + `screenshots/` to the output dir and writes `dossier.json` via the kit's vendored library; two runs produce a byte-identical dossier.
