// ──────────────────────────────────────────────────────────────
// Campfire daily-warmth lines (Layer 1 of the Hearth's voice — "Ember").
// Phase 1 uses a naive rotation with a ring-buffer to avoid repeats;
// Phase 4 will replace _pickLine() with a context-aware resolver.
// ──────────────────────────────────────────────────────────────
export const CAMPFIRE_LINES = [
  { id: 'happy_high',   tag: 'proud',      cond: g => g.player?.stats?.happy >= 80,
    text: '"Looks good out here today. You did that."' },
  { id: 'happy_low',    tag: 'steady',     cond: g => g.player?.stats?.happy < 20 && g.player?.stats?.happy >= 10,
    text: '"Still burning. Not much else I can offer right now. But still burning."' },
  { id: 'happy_crit',   tag: 'anchoring',  cond: g => g.player?.stats?.happy < 10,
    text: '"Hey. Look at me. Still here. Still burning. That\'s all I\'ve got right now. It\'s enough."' },
  { id: 'after_boss',   tag: 'witnessing', cond: g => !!g._lastNightWasBoss,
    text: '"That was a bad one. You held on though. I saw."' },
  { id: 'reincarn',     tag: 'faithful',   cond: g => (g.legacyStory?.reincarnation?.count || 0) > 0 && (g.time?.dayCount || 0) <= 1,
    text: '"You\'re back. I kept it going while you were gone. That\'s what I do."' },
  { id: 'all_children', tag: 'complete',   cond: g => g.story?.children?.found?.every(Boolean),
    text: '"They\'re all home. Do you feel that? That\'s what it was supposed to feel like."' },
  { id: 'after_shard10',tag: 'gentle',     cond: g => g.legacyStory?.shards?.[9],
    text: '"I think you\'re almost ready. To remember the last part. Take your time. I\'ll be here."' },
  { id: 'day_one',      tag: 'simple',     cond: g => (g.time?.dayCount || 0) <= 1 && (g.story?.campfire?.tapCount || 0) === 0,
    text: '"Cold out there. Come closer if you want."' },
  { id: 'after_clean',  tag: 'noticing',   cond: g => (g._junkDayCount || 0) >= 5,
    text: '"You didn\'t have to do all that. But I\'m glad you did. Things look better."' },
  { id: 'after_cook',   tag: 'seeing-her', cond: g => g._lastRecipeCookedAt && (Date.now() - g._lastRecipeCookedAt < 30000),
    text: '"Smells good. You always got the details right. I never told you I noticed that."' },
  { id: 'low_hunger',   tag: 'care',       cond: g => g.player?.stats?.hunger < 25,
    text: '"Eat something. Please. I\'ll be here when you get back."' },
  { id: 'quiet_night',  tag: 'wry',        cond: g => g.time?.phase === 'Night' && (g.nightmares?.length || 0) === 0,
    text: '"Quiet tonight. I almost don\'t trust it. But — nice."' },
  // Defaults pool — used when no condition matches.
  { id: 'def_steady',   tag: 'steady',     cond: () => true,
    text: '"I don\'t know where we are either. But I\'m here."' },
  { id: 'def_warm',     tag: 'steady',     cond: () => true,
    text: '"You came back. That\'s the part that matters."' },
  { id: 'def_quiet',    tag: 'steady',     cond: () => true,
    text: '"Nothing to fix right now. Just sit if you want."' },
];

// ──────────────────────────────────────────────────────────────
// Campfire  –  blue mystic fire at the center of the world
// ──────────────────────────────────────────────────────────────
export class Campfire {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.visualX = 0;
    this.visualY = 0;
    this.particles = [];
    this.embers    = [];
    this.burstParticles = [];
    this.level     = 1;
    this.burstTime = 0;   // > 0 while burst plays
    this.burstDuration = 1.2;
    this._prevLevel = 1;
    this._sittingTimer = 0;
    // Ring buffer of recently-shown line IDs to avoid immediate repeats.
    this._recentLines = [];

    // Initialise particle pool
    for (let i = 0; i < 40; i++) this._spawnParticle(true);
    for (let i = 0; i < 12; i++) this._spawnEmber(true);
  }

  // ── Particle helpers ──────────────────────────────────────
  _spawnParticle(aged = false) {
    const scale = 0.6 + this.level * 0.05;
    const p = {
      x: (Math.random() - 0.5) * 10 * scale,
      y: -8 - Math.random() * 5 * scale,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -(0.6 + Math.random() * 1.2) * scale,
      life: aged ? Math.random() : 0,
      maxLife: 0.8 + Math.random() * 0.6,
      size: 3 + Math.random() * 5 * scale,
      hue: 190 + Math.random() * 40,  // blue-cyan hues
    };
    this.particles.push(p);
  }

  _spawnEmber(aged = false) {
    const scale = 0.5 + this.level * 0.04;
    const e = {
      x: (Math.random() - 0.5) * 14 * scale,
      y: -8 - Math.random() * 6,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(0.8 + Math.random() * 2.5) * scale,
      life: aged ? Math.random() : 0,
      maxLife: 1.2 + Math.random() * 1.0,
      size: 1.5 + Math.random() * 2,
    };
    this.embers.push(e);
  }

  _spawnBurstParticle() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    this.burstParticles.push({
      x: 0, y: -12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      life: 0, maxLife: 0.6 + Math.random() * 0.5,
      size: 4 + Math.random() * 8,
      hue: 200 + Math.random() * 50,
    });
  }

  // ── Pick a daily-warmth line for the current game state.
  // Phase 1: condition-matching with a 5-entry ring buffer so the same line never
  // repeats within a small window. Phase 4 will replace this with a richer
  // priority resolver that considers more game-state signals.
  pickLine(game) {
    const recent = this._recentLines;
    const matches = CAMPFIRE_LINES.filter(L => {
      try { return L.cond(game); } catch (e) { return false; }
    });
    // Prefer lines NOT in the recent ring buffer, but fall back to the full pool
    // if every match has already been shown recently.
    let pool = matches.filter(L => !recent.includes(L.id));
    if (pool.length === 0) pool = matches;
    if (pool.length === 0) pool = CAMPFIRE_LINES.slice(-3); // safety: defaults pool
    const pick = pool[Math.floor(Math.random() * pool.length)];
    recent.push(pick.id);
    if (recent.length > 5) recent.shift();
    return pick;
  }

  // ── Level-up burst ────────────────────────────────────────
  triggerBurst(newLevel) {
    this.level = newLevel;
    this.burstTime = this.burstDuration;
    for (let i = 0; i < 35; i++) this._spawnBurstParticle();
    // SFX – rising whoosh
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      osc.connect(filter); filter.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.6);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch(e) {}
  }

  // ── Update ────────────────────────────────────────────────
  update(dt, level) {
    if (level !== this._prevLevel) {
      this.triggerBurst(level);
      this._prevLevel = level;
    }
    this.level = level;
    const scale = 0.5 + level * 0.05;
    const targetCount = Math.floor(20 + level * 2);

    // Regular particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt * 60 * 0.016;
      p.y += p.vy * dt * 60 * 0.016;
      p.vx += (Math.random() - 0.5) * 0.04;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        if (this.particles.length < targetCount) this._spawnParticle();
      }
    }
    while (this.particles.length < targetCount) this._spawnParticle();

    // Embers
    const targetEmbers = Math.floor(6 + level);
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life += dt;
      e.x += e.vx * dt * 60 * 0.016;
      e.y += e.vy * dt * 60 * 0.016;
      e.vy += 0.03; // slight gravity
      e.vx += (Math.random() - 0.5) * 0.06;
      if (e.life >= e.maxLife) {
        this.embers.splice(i, 1);
        if (this.embers.length < targetEmbers) this._spawnEmber();
      }
    }
    while (this.embers.length < targetEmbers) this._spawnEmber();

    // Burst particles
    if (this.burstTime > 0) {
      this.burstTime -= dt;
      for (let i = this.burstParticles.length - 1; i >= 0; i--) {
        const b = this.burstParticles[i];
        b.life += dt;
        b.x += b.vx * dt * 60 * 0.016;
        b.y += b.vy * dt * 60 * 0.016;
        b.vy += 0.15;
        if (b.life >= b.maxLife) this.burstParticles.splice(i, 1);
      }
    }

    // Sitting behavior — handled externally by Game
    this._sittingTimer += dt;
  }

  // ── Draw ─────────────────────────────────────────────────
  // Ground-layer pass — rendered BEFORE entities so they walk on top of the
  // stone ring / logs (correct depth for objects on the floor).
  draw(ctx, world) {
    const iso = world.toIso(this.x, this.y);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    this._drawGroundLayer(ctx);
    ctx.restore();
  }

  // Flame-layer pass — rendered AFTER entities so the fire columns visually
  // tower OVER any character standing at or near the campfire (no more
  // characters "stepping on" the flame).
  drawFlame(ctx, world) {
    const iso = world.toIso(this.x, this.y);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    this._drawFlameLayer(ctx);
    if (this.pulseForTend || this.pulseForName) this._drawNamePulse(ctx);
    ctx.restore();
  }

  // Slow gold pulse on the stone ring — invitation, not urgency.
  _drawNamePulse(ctx) {
    const t = Date.now() / 1000;
    const breath = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.2));   // 0..1
    ctx.save();
    ctx.scale(2, 2);
    ctx.globalAlpha = 0.32 * breath;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12 + breath * 18;
    ctx.beginPath();
    ctx.ellipse(0, 4, 28, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Shared per-frame state for both layers.
  _campfireFrameState() {
    const t = Date.now() / 1000;
    const scale = 0.6 + this.level * 0.04;
    const breath   = Math.sin(t * 0.9) * 0.35 + Math.sin(t * 1.7 + 1.3) * 0.25 + Math.sin(t * 2.6 + 2.4) * 0.18;
    const breathN  = 1 + breath * 0.04;
    const flicker  = Math.sin(t * 11 + 0.7) * 0.25 + Math.sin(t * 17 + 2.1) * 0.18 + Math.sin(t * 23 + 1.4) * 0.12;
    const upg = (typeof window !== 'undefined' && window.gameInstance?.story?.campfire?.upgrades) || [];
    return {
      t, scale, breath, breathN, flicker,
      hasWarmStones: !!upg[0], hasWindShield: !!upg[1], hasCarvedLog: !!upg[2],
      hasFlowerRing: !!upg[3], hasDeepRoots:  !!upg[4], hasCrownFlame: !!upg[5],
    };
  }

  // ── GROUND LAYER ──────────────────────────────────────────
  // Drawn BELOW entities. Ports the intro-fire campfire look: cyan ember
  // bed under a pair of indigo log planks, with the original stone ring
  // (kept for upgrade colour reactivity) and all decorative upgrade
  // overlays (Warm Stones, Carved Log, Flower Ring, Deep Roots).
  _drawGroundLayer(ctx) {
    ctx.save();
    ctx.scale(2, 2);
    const { t, scale, breath, breathN, flicker,
            hasWarmStones, hasCarvedLog, hasFlowerRing, hasDeepRoots, hasCrownFlame } = this._campfireFrameState();

    // ── Ground glow ───────────────────────────────────────
    // Cool blue base; warms toward gold as upgrades land. (Intro fire uses
    // the same cool palette so the in-game and intro now match.)
    const goldShift = (hasCarvedLog ? 0.2 : 0) + (hasFlowerRing ? 0.25 : 0) + (hasCrownFlame ? 0.55 : 0);
    const glowAlpha = 0.18 + breath * 0.04 + flicker * 0.05;
    const glo = ctx.createRadialGradient(0, 0, 0, 0, 0, 42 * scale * breathN);
    if (hasCrownFlame) {
      glo.addColorStop(0, `rgba(251,191,36,${glowAlpha + 0.10})`);
      glo.addColorStop(1, 'rgba(0,0,0,0)');
    } else if (goldShift > 0) {
      glo.addColorStop(0, `rgba(${Math.round(80 + 171 * goldShift)},${Math.round(160 + 31 * goldShift)},${Math.round(255 - 219 * goldShift)},${glowAlpha})`);
      glo.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      glo.addColorStop(0, `rgba(120,180,255,${glowAlpha})`);
      glo.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = glo;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42 * scale * breathN, 19 * scale * breathN, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── CAMP_01 Warm Stones — amber base glow under the stone ring ──
    if (hasWarmStones) {
      const ws = 0.22 + 0.06 * Math.sin(t * 1.3);
      const wsGrad = ctx.createRadialGradient(0, 2, 0, 0, 2, 18 * scale);
      wsGrad.addColorStop(0, `rgba(245,158,11,${ws})`);
      wsGrad.addColorStop(1, 'rgba(245,158,11,0)');
      ctx.fillStyle = wsGrad;
      ctx.beginPath();
      ctx.ellipse(0, 2, 16 * scale, 7 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── CAMP_05 Deep Roots — ground shimmer pulse + root tendril etching ──
    if (hasDeepRoots) {
      const drPulse = 0.5 + 0.5 * Math.sin(t * 0.6);
      ctx.save();
      ctx.globalAlpha = 0.18 * drPulse;
      ctx.strokeStyle = '#65a30d';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.05;
        const r1 = 8 * scale, r2 = 18 * scale + 2 * Math.sin(t * 1.1 + i);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.5 + 2);
        ctx.quadraticCurveTo(
          Math.cos(a + 0.3) * (r1 + r2) * 0.5, Math.sin(a + 0.3) * (r1 + r2) * 0.25 + 4,
          Math.cos(a) * r2,                    Math.sin(a) * r2 * 0.5 + 3
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Stone ring ────────────────────────────────────────
    // Six pebbles around the fire pit. Colour warms with Warm Stones +
    // intensifies further with Crown Flame (kept as-is for upgrade visuals).
    ctx.fillStyle = hasCrownFlame ? '#7c5b32' : (hasWarmStones ? '#5a4632' : '#3a3a4a');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 10 * scale, Math.sin(a) * 5 * scale, 4 * scale, 2.5 * scale, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── CAMP_04 Flower Ring — wildflowers around the stone ring ──
    if (hasFlowerRing) {
      ctx.font = `${6 * scale}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const flowers = ['🌸','🌼','🌺','🌷','🌻','💮'];
      for (let i = 0; i < 6; i++) {
        const a   = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const wob = Math.sin(t * 0.8 + i) * 0.5 * scale;
        ctx.fillText(flowers[i], Math.cos(a) * 12 * scale + wob, Math.sin(a) * 6 * scale + 2);
      }
    }

    // ── Cyan ember bed (intro-fire port) ──────────────────
    // Pulsing cyan/blue glow centred on the fire pit, drawn under the logs
    // so the wood reads as silhouetted against the embers.
    const bedPulse = 0.85 + 0.15 * Math.sin(t * 1.6);
    const bedGrd = ctx.createRadialGradient(0, 1.5, 0, 0, 1.5, 16 * scale * bedPulse);
    bedGrd.addColorStop(0,    `rgba(180, 240, 255, ${0.85 * bedPulse})`);
    bedGrd.addColorStop(0.45, `rgba( 90, 180, 255, ${0.55 * bedPulse})`);
    bedGrd.addColorStop(1,    'rgba(40, 60, 200, 0)');
    ctx.fillStyle = bedGrd;
    ctx.beginPath();
    ctx.ellipse(0, 1.5, 18 * scale * bedPulse, 6 * scale * bedPulse, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Indigo logs (intro-fire port) ─────────────────────
    // Two stacked elliptical "planks" with a charred outer rim and a
    // brighter highlight on top — replaces the old roundRect log cross.
    ctx.save();
    // Charred outer rim
    ctx.fillStyle = '#1a0e1f';
    ctx.beginPath(); ctx.ellipse(-9 * scale, 3 * scale, 12 * scale, 3 * scale, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 9 * scale, 3 * scale, 12 * scale, 3 * scale,  0.3, 0, Math.PI * 2); ctx.fill();
    // Wood body
    ctx.fillStyle = '#3a2f5c';
    ctx.beginPath(); ctx.ellipse(-9 * scale, 2.3 * scale, 11.2 * scale, 2.5 * scale, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 9 * scale, 2.3 * scale, 11.2 * scale, 2.5 * scale,  0.3, 0, Math.PI * 2); ctx.fill();
    // Top highlight
    ctx.fillStyle = '#5a4f8c';
    ctx.beginPath(); ctx.ellipse(-9 * scale, 1.5 * scale, 10.4 * scale, 1.8 * scale, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 9 * scale, 1.5 * scale, 10.4 * scale, 1.8 * scale,  0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ── CAMP_03 Carved Log — etched calligraphy pattern on the logs ──
    // Re-tuned for the new log geometry (pair of side-by-side ellipses
    // instead of a roundRect cross). One line + dots per log.
    if (hasCarvedLog) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251,191,36,0.55)';
      ctx.fillStyle   = 'rgba(251,191,36,0.45)';
      ctx.lineWidth = 0.6;
      for (const sx of [-9, 9]) {
        ctx.beginPath();
        ctx.moveTo((sx - 6) * scale, 1.5 * scale);
        ctx.lineTo((sx + 6) * scale, 1.5 * scale);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const x = (sx - 5 + i * 3.3) * scale;
          ctx.beginPath(); ctx.arc(x, 1.5 * scale, 0.7, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore(); // end ground layer
  }

  // ── FLAME LAYER ───────────────────────────────────────────
  // Drawn ABOVE entities. Ports the intro-fire flame look: four stacked
  // cool-blue tongues with asymmetric Bezier sway, blended with 'lighter'
  // composite for a glowing core. Embers, bursts, and upgrade overlays
  // (Wind Shield, Flower Ring petals, Crown Flame) all still layer on top.
  _drawFlameLayer(ctx) {
    ctx.save();
    ctx.scale(2, 2);
    const { t, scale, breathN, flicker,
            hasWindShield, hasFlowerRing, hasCrownFlame } = this._campfireFrameState();

    // ── Layered flame body (intro-fire port) ─────────────────
    // Each layer has its own width/height base, sway speed, flicker phase
    // and gradient colours. Two desynced sines feed each flicker so the
    // silhouette never settles into a clean rhythm. Drawn with 'lighter'
    // so overlap reads as luminous brightness rather than chalky stack.
    const baseY = -8 * scale;
    const layers = [
      // Wide outer aura — deep indigo halo
      { col1: 'rgba( 50,  90, 200, 0.00)', col2: 'rgba( 70, 130, 230, 0.42)', col3: 'rgba(120, 180, 255, 0.20)',
        w: 16, h: 44, off: -1, speed: 0.7, sway: 1.2, swayAmp: 1.3, phase: 0.0, flickerAmp: 2.4 },
      // Mid blue tongue
      { col1: 'rgba( 40, 130, 240, 0.00)', col2: 'rgba( 90, 170, 255, 0.65)', col3: 'rgba(170, 215, 255, 0.45)',
        w: 11, h: 38, off:  0.5, speed: 1.1, sway: 1.6, swayAmp: 1.0, phase: 1.3, flickerAmp: 2.8 },
      // Inner cyan tongue
      { col1: 'rgba( 90, 200, 255, 0.00)', col2: 'rgba(160, 230, 255, 0.85)', col3: 'rgba(220, 245, 255, 0.70)',
        w:  8, h: 31, off:  2.0, speed: 1.5, sway: 2.1, swayAmp: 0.7, phase: 2.5, flickerAmp: 3.0 },
      // Pale icy core
      { col1: 'rgba(200, 240, 255, 0.00)', col2: 'rgba(230, 250, 255, 0.95)', col3: 'rgba(255, 255, 255, 0.95)',
        w:  4.5, h: 22, off:  3.5, speed: 2.1, sway: 2.7, swayAmp: 0.4, phase: 4.1, flickerAmp: 2.4 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of layers) {
      // Two desynced sines for an organic flicker. breathN couples the
      // overall body to the existing slow "breathing" rhythm so bursts
      // and upgrades still feel coherent with the rest of the campfire.
      const f1 = Math.sin(t * l.speed + l.phase);
      const f2 = Math.sin(t * l.speed * 1.7 + l.phase * 0.6);
      const flick = (f1 * 0.6 + f2 * 0.4) * 0.5 + 0.5;
      const flameH = (l.h + flick * l.flickerAmp) * scale * breathN;
      const flameW = (l.w + flick * 0.9) * scale;
      const sway = Math.sin(t * l.sway + l.phase) * l.swayAmp * scale;
      const baseTopY = baseY - l.off * scale;
      const tipX = sway;
      const tipY = baseTopY - flameH;

      const grd = ctx.createLinearGradient(0, baseTopY, 0, tipY);
      grd.addColorStop(0,    l.col1);
      grd.addColorStop(0.55, l.col2);
      grd.addColorStop(1,    l.col3);
      ctx.fillStyle = grd;

      // Asymmetric control points pulled by sway → silhouette wobbles
      // like a real flame instead of breathing as one rigid teardrop.
      const halfW = flameW / 2;
      const cpL_x = -halfW * 0.55 + sway * 0.4;
      const cpR_x =  halfW * 0.55 + sway * 0.4;
      const cpL_y = baseTopY - flameH * (0.42 + 0.05 * Math.sin(t + l.phase));
      const cpR_y = baseTopY - flameH * (0.42 + 0.05 * Math.cos(t + l.phase));

      // Per-layer outer glow — skipped in low-spec mode (the most
      // expensive canvas op on mobile GPUs).
      if (!window._lowSpecMode) {
        ctx.shadowColor = l.col2;
        ctx.shadowBlur  = (4 + flick * 2) * scale;
      }

      ctx.beginPath();
      ctx.moveTo(-halfW, baseTopY);
      ctx.quadraticCurveTo(cpL_x, cpL_y, tipX, tipY);
      ctx.quadraticCurveTo(cpR_x, cpR_y, halfW, baseTopY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    // ── Floating ember sparks ─────────────────────────────
    // Low-spec: render half the embers and skip the per-spark shadowBlur.
    const lowSpec = !!window._lowSpecMode;
    const embersToRender = lowSpec ? this.embers.length / 2 : this.embers.length;
    for (let i = 0; i < embersToRender; i++) {
      const e = this.embers[i];
      const pct   = e.life / e.maxLife;
      const alpha = (pct < 0.3 ? pct / 0.3 : 1 - pct) * 0.9;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = `hsl(210,100%,${70 + pct * 20}%)`;
      if (!lowSpec) {
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur  = 4;
      }
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * (1 - pct * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // ── Level-up burst particles ──────────────────────────
    for (const b of this.burstParticles) {
      const pct = b.life / b.maxLife;
      ctx.globalAlpha = (1 - pct) * 0.8;
      ctx.fillStyle   = `hsl(${b.hue},100%,${50 + pct * 30}%)`;
      ctx.shadowColor = `hsl(${b.hue},100%,60%)`;
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * (1 - pct * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // ── CAMP_02 Wind Shield — shimmer barrier around the flame edge ──
    if (hasWindShield) {
      const sh = 0.35 + 0.1 * Math.sin(t * 0.7);
      ctx.save();
      ctx.globalAlpha = sh;
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 0.8;
      ctx.shadowColor = '#bae6fd';
      ctx.shadowBlur = 4;
      // Spiral barrier — two interleaved arcs, slowly rotating.
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const off = i * Math.PI;
        const r   = 16 * scale;
        ctx.ellipse(0, -10 * scale, r, r * 1.4, t * 0.4 + off, 0, Math.PI * 1.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── CAMP_04 Flower Ring — petal drift particles ──
    if (hasFlowerRing) {
      ctx.save();
      ctx.font = `${5 * scale}px Arial`; ctx.textAlign = 'center';
      const petals = ['🌸','💮','✿'];
      for (let i = 0; i < 4; i++) {
        const ph = (t * 0.6 + i * 1.7) % 4;             // 0..4s loop
        const a  = i * 1.6 + t * 0.3;
        const r  = 12 * scale + ph * 2;
        const y  = -8 - ph * 6;
        ctx.globalAlpha = Math.max(0, 1 - ph / 3) * 0.6;
        ctx.fillText(petals[i % petals.length], Math.cos(a) * r, y);
      }
      ctx.restore();
    }

    // ── CAMP_06 Crown Flame — gold apex bezier crown above the tallest tongue ──
    if (hasCrownFlame) {
      const cy   = -42 * scale - flicker * 1.5;
      const wob  = Math.sin(t * 1.5) * 0.6;
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur  = 14;
      const cgrad = ctx.createLinearGradient(0, cy - 8, 0, cy);
      cgrad.addColorStop(0,    'rgba(254,243,199,0.95)');
      cgrad.addColorStop(0.6,  'rgba(251,191,36,0.85)');
      cgrad.addColorStop(1,    'rgba(245,158,11,0.0)');
      ctx.fillStyle = cgrad;
      // 3-point apex crown drawn as bezier petals.
      ctx.beginPath();
      ctx.moveTo(-7 * scale + wob, cy);
      ctx.bezierCurveTo(-5 * scale, cy - 9, -2.5 * scale, cy - 8, 0, cy - 4);
      ctx.bezierCurveTo( 2.5 * scale, cy - 8,  5 * scale, cy - 9,  7 * scale + wob, cy);
      ctx.bezierCurveTo( 4 * scale, cy + 2,    -4 * scale, cy + 2,  -7 * scale + wob, cy);
      ctx.fill();
      // Center spike — taller than the side apexes.
      ctx.beginPath();
      ctx.moveTo(-3 * scale, cy);
      ctx.bezierCurveTo(-2 * scale, cy - 11, 2 * scale, cy - 11, 3 * scale, cy);
      ctx.fill();
      ctx.restore();
    }

    // ── Inner bright pip (intro-fire port) ────────────────
    // Small pulsing ball near the heart of the fire that subtly tracks
    // the inner core's sway — sells the "alive" look more than the old
    // static teardrop. Drawn with 'lighter' so it adds glow on top of
    // the layered tongues without dimming them.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const corePulse = 0.85 + 0.15 * Math.sin(t * 3.1) + flicker * 0.10;
    const coreSway  = Math.sin(t * 2.7 + 4.1) * 0.6 * scale;
    const coreCx = coreSway;
    const coreCy = -12 * scale - 1.4 * scale * Math.sin(t * 2.3);
    const coreR  = 7 * scale * corePulse;
    const coreGrad = ctx.createRadialGradient(coreCx, coreCy, 0, coreCx, coreCy, coreR);
    coreGrad.addColorStop(0,   `rgba(255,255,255,${0.95 * corePulse})`);
    coreGrad.addColorStop(0.5, `rgba(200,240,255,${0.55 * corePulse})`);
    coreGrad.addColorStop(1,   'rgba(120,200,255,0)');
    ctx.fillStyle = coreGrad;
    if (!window._lowSpecMode) {
      ctx.shadowColor = '#a0e8ff';
      ctx.shadowBlur  = (10 + flicker * 6) * scale;
    }
    ctx.beginPath();
    ctx.arc(coreCx, coreCy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
  }
}

// ──────────────────────────────────────────────────────────────
// CookingStation  –  campfire + pot in the level-3 expansion area
// ──────────────────────────────────────────────────────────────
export class CookingStation {
  constructor() {
    this.x = 2;
    this.y = 0.5;
    this.visualX = this.x;
    this.visualY = this.y;
    this._time = 0;
    this.tapBobble = 0;
    this.steamParticles = [];
    for (let i = 0; i < 8; i++) this._spawnSteam(true);
  }

  _spawnSteam(aged = false) {
    this.steamParticles.push({
      x: (Math.random() - 0.5) * 8,
      y: 0,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.4 + Math.random() * 0.5),
      life: aged ? Math.random() * 1.5 : 0,
      maxLife: 1.4 + Math.random() * 1.0,
      size: 2 + Math.random() * 3,
    });
  }

  update(dt) {
    this._time += dt;
    if (this.tapBobble > 0) this.tapBobble -= dt;
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const p = this.steamParticles[i];
      p.life += dt;
      p.x += p.vx * dt * 60 * 0.016;
      p.y += p.vy * dt * 60 * 0.016;
      p.vx += (Math.random() - 0.5) * 0.01;
      if (p.life >= p.maxLife) { this.steamParticles.splice(i, 1); this._spawnSteam(); }
    }
    while (this.steamParticles.length < 8) this._spawnSteam();
  }

  draw(ctx, world) {
    const iso = world.toIso(this.x, this.y);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    if (this.tapBobble > 0) {
      const p = 1 - this.tapBobble;
      ctx.translate(0, -Math.sin(p * Math.PI * 3) * (1 - p) * 7);
    }
    this._drawStation(ctx);
    ctx.restore();
  }

  _drawStation(ctx) {
    ctx.save();
    ctx.scale(1.5, 1.5);
    const t = this._time;
    const flicker = Math.sin(t * 7.3) * 0.08 + Math.sin(t * 11.7) * 0.05;

    // Warm ground glow
    const glo = ctx.createRadialGradient(0, 2, 0, 0, 2, 34);
    glo.addColorStop(0, `rgba(255,120,30,${0.22 + flicker})`);
    glo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glo;
    ctx.beginPath();
    ctx.ellipse(0, 2, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone ring
    ctx.fillStyle = '#3a3a4a';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 10, Math.sin(a) * 5, 4, 2.5, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Log cross
    ctx.save();
    ctx.fillStyle = '#5c3d2e';
    ctx.beginPath(); ctx.roundRect(-10, -3, 20, 4, 2); ctx.fill();
    ctx.rotate(Math.PI / 3);
    ctx.beginPath(); ctx.roundRect(-10, -3, 20, 4, 2); ctx.fill();
    ctx.restore();

    // Flames (warm orange/amber/red)
    const flameData = [
      { ox: -3, hue: 15,  sx: 5, fh: 7 },
      { ox:  0, hue: 35,  sx: 6, fh: 9 },
      { ox:  3, hue: 8,   sx: 5, fh: 7 },
    ];
    ctx.globalAlpha = 0.85;
    for (const fd of flameData) {
      const fx = fd.ox + Math.sin(t * (5.2 + fd.ox)) * 1.5;
      const fh = fd.fh + Math.sin(t * (3.1 + fd.ox * 0.7)) * 1.5;
      ctx.shadowColor = `hsl(${fd.hue},100%,55%)`;
      ctx.shadowBlur = 10;
      ctx.fillStyle = `hsl(${fd.hue},90%,58%)`;
      ctx.beginPath();
      ctx.moveTo(fx - fd.sx * 0.7, 0);
      ctx.bezierCurveTo(fx - fd.sx, -fh * 0.4, fx - 2, -fh * 0.85, fx, -fh);
      ctx.bezierCurveTo(fx + 2, -fh * 0.85, fx + fd.sx, -fh * 0.4, fx + fd.sx * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // Pot shadow
    const potY = -16;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1, potY + 11, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pot body
    ctx.fillStyle = '#18182a';
    ctx.beginPath();
    ctx.ellipse(0, potY + 2, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pot rim
    ctx.strokeStyle = '#38385a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, potY - 7, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, potY - 7, 12, 4.5, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Handles
    ctx.strokeStyle = '#28284a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-14, potY, 4, Math.PI * 0.45, Math.PI * 1.55, true); ctx.stroke();
    ctx.beginPath(); ctx.arc(14,  potY, 4, Math.PI * 1.55, Math.PI * 0.45, true); ctx.stroke();

    // Bubbling contents
    const bub = 0.28 + Math.sin(t * 4.3) * 0.09;
    ctx.fillStyle = `rgba(255,130,20,${bub})`;
    ctx.beginPath();
    ctx.ellipse(0, potY - 7, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Steam particles (rise from pot rim)
    for (const p of this.steamParticles) {
      const pct = p.life / p.maxLife;
      const alpha = (pct < 0.25 ? pct / 0.25 : 1 - pct) * 0.55;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(220,215,235,1)`;
      ctx.beginPath();
      ctx.arc(p.x, potY - 8 + p.y, p.size * (0.5 + pct * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
