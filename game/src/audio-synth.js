// All sound is synthesised with WebAudio — no audio files. One engine voice that follows
// the player's car, one siren voice that fades with the nearest police car, a tyre-screech
// voice, a laid-back synth loop for the music, and a pocketful of one-shot effects (shots,
// punches, crashes, honks, pickups, cash, jingles). The context opens on the first gesture.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.screechNodes = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.enabled = true;
  }

  /** Open the context (must be called from a user gesture at least once). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
  }

  /** A short enveloped oscillator blip. */
  blip(freq, freqEnd, seconds, type = 'sine', gain = 0.2, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + seconds);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  /** A burst of filtered noise (shots, crashes, screech texture). */
  noise(seconds, filterFreq, gain = 0.3, type = 'lowpass', when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  shot() {
    this.noise(0.16, 2600, 0.5, 'highpass');
    this.blip(160, 50, 0.12, 'square', 0.25);
  }

  enemyShot() {
    this.noise(0.13, 2000, 0.28, 'highpass');
    this.blip(140, 55, 0.1, 'square', 0.14);
  }

  punch() {
    this.blip(110, 45, 0.13, 'sine', 0.5);
    this.noise(0.06, 700, 0.2);
  }

  crash(intensity = 0.5) {
    this.noise(0.32, 500 + intensity * 500, 0.25 + intensity * 0.45);
    this.blip(90, 35, 0.3, 'triangle', 0.3 * intensity + 0.1);
  }

  honk() {
    this.blip(392, 392, 0.22, 'square', 0.1);
    this.blip(494, 494, 0.22, 'square', 0.08);
  }

  pickup() {
    this.blip(660, 660, 0.09, 'sine', 0.22);
    this.blip(990, 990, 0.14, 'sine', 0.22, 0.08);
  }

  cash() {
    this.blip(1320, 1320, 0.07, 'triangle', 0.2);
    this.blip(1760, 1760, 0.12, 'triangle', 0.2, 0.06);
  }

  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.blip(n, n, 0.22, 'triangle', 0.22, i * 0.11));
  }

  fail() {
    this.blip(330, 330, 0.2, 'triangle', 0.2);
    this.blip(220, 196, 0.34, 'triangle', 0.2, 0.16);
  }

  sting() {
    this.blip(196, 185, 0.5, 'sawtooth', 0.16);
    this.blip(147, 139, 0.6, 'sawtooth', 0.16, 0.1);
  }

  /** Start or stop the player's engine voice. */
  setEngine(on, rpm = 0, load = 0) {
    if (!this.ctx) return;
    if (on && !this.engineNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'square';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(g).connect(this.master);
      osc.start();
      osc2.start();
      this.engineNodes = { osc, osc2, filter, g };
    }
    if (!on && this.engineNodes) {
      const nodes = this.engineNodes;
      nodes.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
      setTimeout(() => { try { nodes.osc.stop(); nodes.osc2.stop(); } catch { /* already stopped */ } }, 160);
      this.engineNodes = null;
      return;
    }
    if (this.engineNodes) {
      const t = this.ctx.currentTime;
      const freq = 55 + rpm * 165 + load * 22;
      this.engineNodes.osc.frequency.setTargetAtTime(freq, t, 0.05);
      this.engineNodes.osc2.frequency.setTargetAtTime(freq * 0.5 + 3, t, 0.05);
      this.engineNodes.filter.frequency.setTargetAtTime(320 + rpm * 900, t, 0.08);
      this.engineNodes.g.gain.setTargetAtTime(0.05 + rpm * 0.075, t, 0.09);
    }
  }

  /** The police siren: level 0..1 by the nearest cruiser's distance. */
  setSiren(level) {
    if (!this.ctx) return;
    if (level > 0.02 && !this.sirenNodes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.65;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.frequency.value = 830;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(this.master);
      osc.start();
      lfo.start();
      this.sirenNodes = { osc, lfo, g };
    }
    if (this.sirenNodes) {
      this.sirenNodes.g.gain.setTargetAtTime(level * 0.085, this.ctx.currentTime, 0.15);
      if (level <= 0.02) {
        const nodes = this.sirenNodes;
        this.sirenNodes = null;
        setTimeout(() => { try { nodes.osc.stop(); nodes.lfo.stop(); } catch { /* already stopped */ } }, 300);
      }
    }
  }

  /** Tyre screech while drifting or braking hard. */
  setScreech(level) {
    if (!this.ctx) return;
    if (level > 0.03 && !this.screechNodes) {
      const len = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 950;
      filter.Q.value = 6;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(filter).connect(g).connect(this.master);
      src.start();
      this.screechNodes = { src, g };
    }
    if (this.screechNodes) {
      this.screechNodes.g.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.06);
      if (level <= 0.03) {
        const nodes = this.screechNodes;
        this.screechNodes = null;
        setTimeout(() => { try { nodes.src.stop(); } catch { /* already stopped */ } }, 200);
      }
    }
  }

  /** The music loop: a slow synthwave bass and pad, one bar per call cycle. */
  updateMusic(dt, playing) {
    if (!this.ctx || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const roots = [110, 87.3, 98, 130.8]; // A2 F2 G2 C3
    const bar = Math.floor(this.musicStep / 8) % 4;
    const stepInBar = this.musicStep % 8;
    const root = roots[bar];
    if (stepInBar % 2 === 0) this.blip(root, root, 0.24, 'triangle', 0.16);
    if (stepInBar === 0) {
      this.blip(root * 2, root * 2, 1.5, 'sine', 0.05);
      this.blip(root * 2.5, root * 2.5, 1.5, 'sine', 0.04);
      this.blip(root * 3, root * 3, 1.5, 'sine', 0.035);
    }
    if (stepInBar === 4) this.blip(root * 4, root * 4, 0.3, 'sine', 0.05);
    this.musicStep += 1;
    this.musicTimer = 0.235;
  }
}
