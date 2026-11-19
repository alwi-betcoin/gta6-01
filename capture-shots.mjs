// SOLANO HEAT — screenshot capture tooling (not part of the game).
// Serves the repo with the starter's serve.ts, drives headless Chrome to each
// staged scene (game/src/shots.js, selected with ?shot=<name>&seed=1), and
// writes screenshots/<file>.jpg at 1280x720, re-encoding lower if a frame
// would exceed the kit's 256 KiB cap.
//
// Usage: node capture-shots.mjs
// Needs Puppeteer + Chrome for Testing; by default it borrows the install
// from the sibling token-radar tools folder (override with PUPPETEER_HOME).

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8137;
const PUPPETEER_HOME = process.env.PUPPETEER_HOME
  || '/home/hatch/workspace/makefun-work/token-radar-01/tools/package.json';
const require = createRequire(PUPPETEER_HOME);
const puppeteer = require('puppeteer');

const SCENES = [
  { name: 'chase', file: 'screenshots/1-chase.jpg' },
  { name: 'downtown', file: 'screenshots/2-downtown.jpg' },
  { name: 'coast', file: 'screenshots/3-coast-drive.jpg' },
  { name: 'mission', file: 'screenshots/4-mission.jpg' },
];
const MAX_BYTES = 256 * 1024;

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await sleep(1200);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  for (const scene of SCENES) {
    const url = `http://127.0.0.1:${PORT}/index.html?shot=${scene.name}&seed=1`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction('window.__shotReady === true', { timeout: 30000 });
    await sleep(250);
    let quality = 88;
    const target = path.join(ROOT, scene.file);
    for (;;) {
      await page.screenshot({ path: target, type: 'jpeg', quality });
      const size = statSync(target).size;
      console.log(`${scene.file}: ${(size / 1024).toFixed(1)} KiB at q${quality}`);
      if (size <= MAX_BYTES || quality <= 60) break;
      quality -= 10;
    }
  }
  await browser.close();
} finally {
  server.kill();
}
