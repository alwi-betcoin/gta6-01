// The HUD and screens as DOM: cash, wanted stars, health and car-health bars, the weapon
// readout, the mission objective banner, interaction prompts, dialogue subtitles, centre
// banners ("MISSION COMPLETE"), floating cash text and the damage vignette. main.js owns
// the menu buttons; this class owns everything that changes while playing.

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'cash', 'stars', 'clock', 'healthBar', 'carHealthWrap', 'carHealthBar', 'weapon',
      'objective', 'objectiveText', 'objectiveMeta', 'prompt', 'subtitle', 'banner', 'crosshair', 'damageFlash']) {
      this.el[id] = document.getElementById(id);
    }
    this.bannerTimer = 0;
    this.subtitleTimer = 0;
    this.subtitleQueue = [];
    this.flashTimer = 0;
    this.lastStars = -1;
  }

  show() { this.el.hud.hidden = false; }
  hide() { this.el.hud.hidden = true; }

  setCash(cash) {
    this.el.cash.textContent = `$${Math.max(0, Math.floor(cash)).toLocaleString('en-US')}`;
  }

  /** Wanted stars: filled gold for the level, dim outlines up to five. */
  setStars(stars) {
    if (stars === this.lastStars) return;
    this.lastStars = stars;
    let html = '';
    for (let i = 0; i < 5; i += 1) html += i < stars ? '★' : '<span class="off">★</span>';
    this.el.stars.innerHTML = html;
  }

  setHealth(frac) {
    this.el.healthBar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  /** The car's health bar shows only while driving. */
  setCarHealth(frac) {
    if (frac === null) {
      this.el.carHealthWrap.hidden = true;
      return;
    }
    this.el.carHealthWrap.hidden = false;
    this.el.carHealthBar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  setWeapon(name) {
    this.el.weapon.textContent = name;
  }

  /** The mission objective banner; pass null text to hide it. */
  setObjective(text, meta = '') {
    if (!text) {
      this.el.objective.hidden = true;
      return;
    }
    this.el.objective.hidden = false;
    if (this.el.objectiveText.textContent !== text) this.el.objectiveText.textContent = text;
    if (this.el.objectiveMeta.textContent !== meta) this.el.objectiveMeta.textContent = meta;
  }

  /** The "Press E …" interaction line; pass null to hide. */
  setPrompt(html) {
    if (!html) {
      this.el.prompt.hidden = true;
      return;
    }
    this.el.prompt.hidden = false;
    if (this.el.prompt.innerHTML !== html) this.el.prompt.innerHTML = html;
  }

  /** Queue a dialogue line; each shows for its seconds before the next. */
  say(speaker, line, seconds = 3.4) {
    this.subtitleQueue.push({ speaker, line, seconds });
  }

  /** A big centre banner (mission titles, MISSION COMPLETE, payments). */
  banner(big, small = '', seconds = 2.6) {
    const b = this.el.banner;
    b.querySelector('.big').textContent = big;
    b.querySelector('.small').textContent = small;
    b.style.opacity = '1';
    this.bannerTimer = seconds;
  }

  /** Floating "+$400" text near the cash readout when money lands. */
  floatCash(amount) {
    const span = document.createElement('div');
    span.className = 'floater';
    span.textContent = amount >= 0 ? `+$${amount}` : `-$${Math.abs(amount)}`;
    if (amount < 0) span.style.color = '#ff7a6b';
    span.style.right = `${26 + Math.random() * 30}px`;
    span.style.top = '86px';
    this.el.hud.appendChild(span);
    setTimeout(() => span.remove(), 1450);
  }

  /** The red edge vignette when Dario takes damage. */
  damage() {
    this.el.damageFlash.style.opacity = '1';
    this.flashTimer = 0.16;
  }

  setPlace(label) {
    this.el.clock.textContent = label;
  }

  setCrosshair(on) {
    this.el.crosshair.hidden = !on;
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.style.opacity = '0';
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.el.damageFlash.style.opacity = '0';
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.el.subtitle.hidden = true;
    } else if (this.subtitleQueue.length > 0) {
      const next = this.subtitleQueue.shift();
      this.el.subtitle.innerHTML = `<b>${next.speaker}:</b> ${next.line}`;
      this.el.subtitle.hidden = false;
      this.subtitleTimer = next.seconds;
    }
  }
}
