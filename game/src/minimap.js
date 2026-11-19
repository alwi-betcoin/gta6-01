// The minimap: a round 2D canvas, north up, drawn from the same street plan the city is
// built from — sea and beach to the south, the street grid, then blips: Dario's arrow, the
// gold mission target, green fare markers, and police flashing blue/red. Redrawn per frame
// from plain canvas calls; the whole city fits, so nothing scrolls.

import { BEACH_Z0, SEA_Z, STREET_LINES } from './config.js';

const WORLD_MIN = -40;
const WORLD_SIZE = 400;

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.size = canvas.width;
    this.blink = 0;
  }

  /** World metres to map pixels. */
  px(x) { return ((x - WORLD_MIN) / WORLD_SIZE) * this.size; }
  pz(z) { return ((z - WORLD_MIN) / WORLD_SIZE) * this.size; }

  /**
   * Draw the frame. `view` carries { player:{x,z,heading}, target:{x,z}|null,
   * fare:{x,z}|null, police:[{x,z}], special:{x,z}|null }.
   */
  draw(view, dt) {
    const g = this.g;
    const s = this.size;
    this.blink += dt;
    g.clearRect(0, 0, s, s);
    // Land, beach and sea.
    g.fillStyle = '#8a7a5c';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#2a7a8c';
    g.fillRect(0, this.pz(SEA_Z), s, s - this.pz(SEA_Z));
    g.fillStyle = '#e8cf9e';
    g.fillRect(0, this.pz(BEACH_Z0), s, this.pz(SEA_Z) - this.pz(BEACH_Z0));
    // Blocks as faint parcels, then the streets over them.
    g.fillStyle = 'rgba(255,240,210,0.13)';
    for (let j = 0; j < 5; j += 1) {
      for (let i = 0; i < 5; i += 1) {
        g.fillRect(this.px(STREET_LINES[i] + 8), this.pz(STREET_LINES[j] + 8), this.px(52) - this.px(0), this.pz(52) - this.pz(0));
      }
    }
    g.strokeStyle = '#3a3d42';
    g.lineWidth = Math.max(2, s * 0.016);
    g.beginPath();
    for (const line of STREET_LINES) {
      g.moveTo(this.px(line), this.pz(-30));
      g.lineTo(this.px(line), this.pz(330));
      g.moveTo(this.px(-30), this.pz(line));
      g.lineTo(this.px(330), this.pz(line));
    }
    g.stroke();
    // The marina pier.
    g.strokeStyle = '#9a6b46';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(this.px(150), this.pz(356));
    g.lineTo(this.px(150), this.pz(398));
    g.stroke();

    const dot = (x, z, color, r = 4) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(this.px(x), this.pz(z), r, 0, Math.PI * 2);
      g.fill();
    };
    if (view.special) dot(view.special.x, view.special.z, '#ff5da2', 4.5);
    if (view.fare) dot(view.fare.x, view.fare.z, '#51e06a', 4.5);
    // Police blips flash blue/red like their light bars.
    const copColor = Math.sin(this.blink * 9) > 0 ? '#3f8cff' : '#ff4040';
    for (const cop of view.police) dot(cop.x, cop.z, copColor, 3.6);
    // The mission target: a pulsing gold ring.
    if (view.target) {
      const pulse = 6 + Math.sin(this.blink * 5) * 1.6;
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(this.px(view.target.x), this.pz(view.target.z), pulse, 0, Math.PI * 2);
      g.stroke();
      dot(view.target.x, view.target.z, '#ffd23f', 3);
    }
    // Dario's arrow: drawn pointing up (north); canvas y grows south like world z, and a
    // heading of 0 faces +z (south), so the arrow turns by PI - heading.
    const p = view.player;
    g.save();
    g.translate(this.px(p.x), this.pz(p.z));
    g.rotate(Math.PI - p.heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(4.6, 5.4);
    g.lineTo(0, 2.6);
    g.lineTo(-4.6, 5.4);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
