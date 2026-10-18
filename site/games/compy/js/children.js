// ============================================================
// children.js — narrative NPC system for "She Who Keeps the Light".
//
// Owns:
//   • ChildNPC entity class (silhouette → walking_in → present, AI states)
//   • ChildrenManager (per-game holder; discovery, tap dispatch, save/load)
//   • Task condition tickers (24 tasks, one TASKS[id] → checkFn(game) entry)
//
// Entry points (called from main.js):
//   game.children = new ChildrenManager(game)
//   game.children.update(dt)        — every frame
//   game.children.draw(ctx, world)  — render layer
//   game.children.handleTap(x, y)   — input dispatch (returns true if consumed)
//   game.children.checkLevelUp(lvl) — discovery hook
//   game.children.toJSON / fromJSON — save plumbing
// ============================================================

import { Entity } from './entities.js';
import { CHILDREN, HOME_ZONE, TASKS, activeTaskFor, tasksForChild } from '../data/children_data.js';
import { ChildCamp } from './child_camps.js';

// Visible mood states. The mood drives both AI and on-NPC visuals.
export const MOOD = {
  WANDER:        'WANDER',
  TROUBLED:      'TROUBLED',
  TASK_ACTIVE:   'TASK_ACTIVE',
  TASK_READY:    'TASK_READY',    // condition met, awaiting player confirmation
  JOYFUL:        'JOYFUL',
  RESTING:       'RESTING',
  FRIGHTENED:    'FRIGHTENED',
  COMPANION_PLAY:'COMPANION_PLAY',
  BONDED:        'BONDED',
  FINALE_WALK:   'FINALE_WALK',  // reserved for Phase 5
};

// Lifecycle: silhouette is visible at edge before light reaches; walking_in plays
// the entry animation; present is the normal active state.
export const PHASE = {
  HIDDEN:      'HIDDEN',
  SILHOUETTE:  'SILHOUETTE',
  WALKING_IN:  'WALKING_IN',
  PRESENT:     'PRESENT',
};

// ── ChildNPC entity ────────────────────────────────────────────────────
export class ChildNPC extends Entity {
  constructor(childIdx, def) {
    super(0, 0, { id: def.id, name: def.label });
    this.childIdx     = childIdx;
    this.def          = def;
    this.icon         = def.icon;
    this.color        = def.color;
    this.glowColor    = def.glowColor;
    this.phase        = PHASE.HIDDEN;
    this.mood         = MOOD.WANDER;
    this.targetX      = 0;
    this.targetY      = 0;
    this.aiTimer      = 1 + Math.random() * 1.5;        // AI tick every ~2s
    this.wanderTimer  = 1 + Math.random() * 3;          // pick new wander point
    this.tapBobble    = 0;
    this.joyTimer     = 0;
    this.sulkTimer    = 0;                              // C6 sulk after player leaves
    this.discoveryAnimTimer = 0;
    this.silhouetteX  = 0;
    this.silhouetteY  = 0;
    this.bondAuraPhase = Math.random() * Math.PI * 2;
    this.lastTaskCompleteAt = 0;
    this.speed = 1.2;                                   // slower than player
    this._companionPlayMate  = null;                    // cached ref to playmate
    this._companionPlayUntil = 0;
    // Task completion handshake: set by the ticker when conditions are met,
    // cleared when the player taps to confirm. The Glimmer wears a TASK_READY
    // mood + ✓ bubble while this is non-null so the player knows to come over.
    this.pendingTask = null;
  }

  // Fully bonded? (Used by BONDED mood + gold aura.)
  isBonded(game) {
    const done = game.story?.children?.tasksDone?.[this.childIdx] || 0;
    return done >= 4;
  }

  // Currently has an unstarted task? (TROUBLED bubble + dialog tap target.)
  activeTask(game) {
    const done = game.story?.children?.tasksDone?.[this.childIdx] || 0;
    return activeTaskFor(this.childIdx, done);
  }

  // Set position, used by spawn-in.
  setPos(x, y) {
    this.x = x; this.y = y;
    this.visualX = x; this.visualY = y;
    this.targetX = x; this.targetY = y;
  }

  update(dt, game) {
    super.update(dt);
    if (this.tapBobble > 0) this.tapBobble = Math.max(0, this.tapBobble - dt * 2);
    if (this.joyTimer > 0)  this.joyTimer  = Math.max(0, this.joyTimer  - dt);
    this.bondAuraPhase += dt * (Math.PI * 2 / 10);   // 36°/s → 10s/rotation
    this.discoveryAnimTimer += dt;

    if (this.phase === PHASE.HIDDEN || this.phase === PHASE.SILHOUETTE) {
      return; // no AI or movement until walking_in fires
    }

    if (this.phase === PHASE.WALKING_IN) {
      // Walk toward (0,0) — campfire — for the entry sequence.
      this._stepToward(0, 0, dt);
      // Sparkle-ring timer counts down for the first 1.5s of the walk-in.
      if (this._walkInSparkleTimer === undefined) this._walkInSparkleTimer = 1.5;
      this._walkInSparkleTimer = Math.max(0, this._walkInSparkleTimer - dt);
      if (Math.hypot(this.x, this.y) < 1.2) {
        this.phase = PHASE.PRESENT;
      }
      return;
    }

    // Finale override: while game.finale has assigned a target, skip AI and
    // walk straight to the formation point. Mood is forced to FINALE_WALK.
    if (this._finaleTarget) {
      this.mood = MOOD.FINALE_WALK;
      this._stepToward(this._finaleTarget.x, this._finaleTarget.y, dt);
      return;
    }

    // PRESENT — full AI loop.
    this._updateMood(game);
    this._stepTowardTarget(dt);

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 1.8 + Math.random() * 0.8;
      this._aiTick(game);
    }
  }

  // ── AI ───────────────────────────────────────────────────────────────
  _updateMood(game) {
    if (this.isBonded(game)) {
      // Joy state can briefly override BONDED visually right after a task.
      if (this.joyTimer > 0) { this.mood = MOOD.JOYFUL; return; }
      this.mood = MOOD.BONDED;
      return;
    }
    // Joy briefly takes priority when a task just completed.
    if (this.joyTimer > 0) { this.mood = MOOD.JOYFUL; return; }
    // Task ready: condition met, waiting for the player to come tap and confirm.
    // Takes priority over frightened/resting so the ✓ bubble stays visible.
    if (this.pendingTask) { this.mood = MOOD.TASK_READY; return; }
    // Frightened: nightmare within 5 tiles.
    if (game.nightmares?.length) {
      for (const n of game.nightmares) {
        if (n.isDead) continue;
        if (Math.hypot(n.x - this.x, n.y - this.y) < 5) { this.mood = MOOD.FRIGHTENED; return; }
      }
    }
    // Resting at camp (day-time): once docked, stay until rest timer expires.
    if (this._restingAtCamp) { this.mood = MOOD.RESTING; return; }
    // Resting: night phase.
    if (game.time?.phase === 'Night') { this.mood = MOOD.RESTING; return; }
    // Companion play: affinity Compy nearby, low-frequency.
    if (this._companionPlayUntil > Date.now()) { this.mood = MOOD.COMPANION_PLAY; return; }
    // Troubled: a task is pending.
    const task = this.activeTask(game);
    if (task) { this.mood = MOOD.TROUBLED; return; }
    this.mood = MOOD.WANDER;
  }

  _aiTick(game) {
    // Frightened — run to campfire.
    if (this.mood === MOOD.FRIGHTENED) {
      this.targetX = 0; this.targetY = 0;
      this._restingAtCamp = false;
      return;
    }
    // Resting — sleeping at camp (day) or by the campfire (night).
    if (this.mood === MOOD.RESTING) {
      if (this._restingAtCamp) {
        const camp = game.children?.camps?.[this.childIdx];
        if (camp) {
          this.targetX = camp.x + (Math.random() - 0.5) * 0.4;
          this.targetY = camp.y + (Math.random() - 0.5) * 0.4;
        }
        // Wake-up timer set when we entered rest; checked here.
        if (Date.now() > (this._restUntil || 0)) {
          this._restingAtCamp = false;
          this._nextRestAt = Date.now() + (60 + Math.random() * 90) * 1000;
        }
      } else {
        this.targetX = (Math.random() - 0.5) * 1.6;
        this.targetY = (Math.random() - 0.5) * 1.6;
      }
      return;
    }
    // Companion play continues to whatever the playmate is doing — no new target.
    if (this.mood === MOOD.COMPANION_PLAY) {
      const mate = this._companionPlayMate;
      if (mate) {
        this.targetX = mate.x + (Math.random() - 0.5) * 0.6;
        this.targetY = mate.y + (Math.random() - 0.5) * 0.6;
      }
      return;
    }
    // Periodic rest-at-camp roll. Initialised on first tick.
    if (typeof this._nextRestAt !== 'number') {
      this._nextRestAt = Date.now() + (40 + Math.random() * 60) * 1000;
    }
    if (this.mood === MOOD.WANDER && Date.now() > this._nextRestAt) {
      // Don't head to the camp if the player has stowed it via Edit Mode —
      // the prop isn't in the world right now.
      const stowed = !!game.editMode?.stored?.[`child_camp_${this.childIdx}`];
      if (!stowed) {
        this._restingAtCamp = true;
        this._restUntil     = Date.now() + (20 + Math.random() * 25) * 1000;
        const camp = game.children?.camps?.[this.childIdx];
        if (camp) { this.targetX = camp.x; this.targetY = camp.y; }
        return;
      }
      // Stowed camp: defer the next attempt by ~30s and continue wandering.
      this._nextRestAt = Date.now() + 30 * 1000;
    }
    // 30% chance per tick to start companion play if affinity Compy is nearby.
    if (this.mood === MOOD.WANDER && Math.random() < 0.3) {
      const mate = this._findAffinityCompy(game);
      if (mate && Math.hypot(mate.x - this.x, mate.y - this.y) < 4) {
        this._companionPlayMate  = mate;
        this._companionPlayUntil = Date.now() + (15 + Math.random() * 15) * 1000;
      }
    }
    // Pick a new wander target based on home zone.
    const t = this._pickHomeTarget(game);
    if (t) { this.targetX = t.x; this.targetY = t.y; }
  }

  _findAffinityCompy(game) {
    if (!this.def.compyAffinity || !game.companions) return null;
    return game.companions.find(c => c?.id === this.def.compyAffinity || c?.type === this.def.compyAffinity);
  }

  _pickHomeTarget(game) {
    const r = (typeof game.getLightRadius === 'function')
      ? game.getLightRadius()
      : ((game.player?.stats?.level || 1) * 0.5 + 1);
    switch (this.def.homeZone) {
      case HOME_ZONE.PLAYER_TILE: {
        // Stay within clingyMaxDist (default 2) of player.
        const max = this.def.flags?.clingyMaxDist || 2;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * (max - 0.4) + 0.4;
        return { x: game.player.x + Math.cos(a) * d, y: game.player.y + Math.sin(a) * d };
      }
      case HOME_ZONE.ROAM: {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * (r * 0.85);
        return { x: Math.cos(a) * d, y: Math.sin(a) * d };
      }
      case HOME_ZONE.LOWEST_MOOD: {
        // Migrate toward whichever entity has the lowest happiness/mood.
        const target = this._findLowestMoodTarget(game);
        if (target) {
          const a = Math.random() * Math.PI * 2;
          return { x: target.x + Math.cos(a) * 1.2, y: target.y + Math.sin(a) * 1.2 };
        }
        return { x: 0, y: 0 };
      }
      case HOME_ZONE.QUIET_CORNER: {
        // A quiet corner near the SW edge of the lit area.
        const a = Math.PI * 0.85 + (Math.random() - 0.5) * 0.4;
        const d = r * 0.78;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d };
      }
      case HOME_ZONE.CRAFT_CENTRE: {
        // Near the cooking station, fall back to small radius around origin.
        const cs = game.cookingStation;
        const cx = cs ? cs.x : 1.6;
        const cy = cs ? cs.y : 0.5;
        const a = Math.random() * Math.PI * 2;
        return { x: cx + Math.cos(a) * 0.9, y: cy + Math.sin(a) * 0.9 };
      }
      case HOME_ZONE.LIGHT_EDGE: {
        // Sit near the light boundary, slightly apart.
        const a = -Math.PI * 0.25 + (Math.random() - 0.5) * 0.6;
        const d = r * 0.92;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d };
      }
    }
    return { x: 0, y: 0 };
  }

  _findLowestMoodTarget(game) {
    let lowest = null, lowestVal = Infinity;
    // Other children with active tasks (TROUBLED) are highest-priority targets.
    if (game.children?.list) {
      for (const c of game.children.list) {
        if (c === this || c.phase !== PHASE.PRESENT) continue;
        const score = (c.mood === MOOD.TROUBLED) ? 5
                    : (c.mood === MOOD.FRIGHTENED) ? 0
                    : 50;
        if (score < lowestVal) { lowest = c; lowestVal = score; }
      }
    }
    // If no troubled child, drift toward the player when their happy is low.
    if (!lowest && (game.player?.stats?.happy || 100) < 40) {
      lowest = game.player;
    }
    return lowest;
  }

  _stepTowardTarget(dt) {
    this._stepToward(this.targetX, this.targetY, dt);
  }

  _stepToward(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d  = Math.hypot(dx, dy);
    if (d < 0.05) return;
    const sp = this.speed * dt;
    if (d <= sp) { this.x = tx; this.y = ty; return; }
    this.x += (dx / d) * sp;
    this.y += (dy / d) * sp;
  }

  // ── Render ───────────────────────────────────────────────────────────
  draw(ctx, world) {
    if (this.phase === PHASE.HIDDEN) return;
    const iso = world.toIso(this.visualX, this.visualY);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    if (this.phase === PHASE.SILHOUETTE) {
      this._renderSilhouette(ctx);
    } else {
      this._renderBody(ctx);
    }
    ctx.restore();
    // Emote bubble piggy-backs on the inherited render path.
    if (this.activeEmote) {
      ctx.save();
      ctx.translate(iso.x, iso.y);
      this.renderEmote(ctx);
      ctx.restore();
    }
  }

  _renderSilhouette(ctx) {
    const t = Date.now() / 1000;
    const pulse = 0.6 + 0.3 * Math.sin(t * 1.2 * Math.PI * 2);    // 1.2Hz pulse
    ctx.save();
    ctx.scale(2, 2);
    // Drift sparkles upward
    ctx.globalAlpha = 0.6;
    ctx.font = '8px Arial'; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const a = (t * 0.6 + i * 2) % (Math.PI * 2);
      ctx.fillText('✨', Math.cos(a) * 10, -22 + ((t * 8 + i * 3) % 18) * -1);
    }
    // Dark silhouette — single bean (no head, matches the new headless body).
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, -10, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Per-Glimmer pastel palette + hat / floating-accessory choice.
  // Mirrors the Mysterious Merchant's silhouette (cloak + hat + glowing
  // eyes) but each Glimmer gets a unique cute outfit driven by its
  // personality. Hues are spaced ~60° around the wheel so the six are
  // instantly distinguishable at a glance:
  //   Tobi  violet  · Pip yellow  · Mira hot-pink
  //   Wren  teal    · Bram green  · Ren  cobalt
  // The eye-glow uses a CONTRASTING pastel so faces always pop on the cloak.
  static _GLIMMER_LOOK = {
    CHILD_6: { // Tobi — Hearthmote · violet
      cloak: '#d8b4fe', cloakDeep: '#9333ea', trim: '#f3e8ff',
      hat: 'pom_cap', hatColor: '#a855f7', hatTrim: '#fbcfe8',
      eyeGlow: '#fbcfe8', float: '🧸',
    },
    CHILD_5: { // Pip — Brightspark · sunshine yellow
      cloak: '#fef08a', cloakDeep: '#ca8a04', trim: '#fef9c3',
      hat: 'crown', hatColor: '#eab308', hatTrim: '#fed7aa',
      eyeGlow: '#fed7aa', float: '✨',
    },
    CHILD_4: { // Mira — Tender · hot rose pink
      cloak: '#fda4af', cloakDeep: '#e11d48', trim: '#fecdd3',
      hat: 'bun_cap', hatColor: '#f43f5e', hatTrim: '#fff4c4',
      eyeGlow: '#fff4c4', float: '💗',
    },
    CHILD_3: { // Wren — Dreamwick · teal / cyan (the artist's ink-water)
      cloak: '#a5f3fc', cloakDeep: '#0891b2', trim: '#cffafe',
      hat: 'beret', hatColor: '#0e7490', hatTrim: '#bbf7d0',
      eyeGlow: '#bbf7d0', float: '🎨',
    },
    CHILD_2: { // Bram — Forgespark · forest green
      cloak: '#86efac', cloakDeep: '#15803d', trim: '#dcfce7',
      hat: 'cap', hatColor: '#16a34a', hatTrim: '#bae6fd',
      eyeGlow: '#bae6fd', float: '🔨',
    },
    CHILD_1: { // Ren — Tuneflame · cobalt blue
      cloak: '#bfdbfe', cloakDeep: '#1d4ed8', trim: '#dbeafe',
      hat: 'tall_pointy', hatColor: '#3b82f6', hatTrim: '#fef3c7',
      eyeGlow: '#e9d5ff', float: '🎵',
    },
  };

  _renderBody(ctx) {
    const t  = Date.now() / 1000;
    const bonded = this.mood === MOOD.BONDED || (this.joyTimer > 0 && this._wasBonded);
    const walking = Math.hypot(this.targetX - this.x, this.targetY - this.y) > 0.1;
    let tapBobY = 0;
    if (this.tapBobble > 0) {
      const p = 1 - this.tapBobble;
      tapBobY = -Math.sin(p * Math.PI * 3) * (1 - p) * 10;
    }

    const look = this.def.look || {};
    const lookScale = look.scale || 1.0;
    const ml = ChildNPC._GLIMMER_LOOK[this.def.id] || {
      cloak: look.bodyColor || '#c4b5fd', cloakDeep: '#7c6b99', trim: '#fff4ec',
      hat: 'pom_cap', hatColor: '#7c6b99', hatTrim: '#fbcfe8',
      eyeGlow: '#fde68a', float: '✦',
    };

    // Per-emotion body deformation (squash/stretch + tilt) plus animation phase.
    const em = this._faceEmotion();
    const def = this._bodyDeform(em, t);

    ctx.save();
    ctx.scale(1.5 * lookScale, 1.5 * lookScale);
    ctx.translate(0, tapBobY / (1.5 * lookScale));

    // Discovery walk-in sparkle ring.
    if (this._walkInSparkleTimer > 0) {
      const f = 1 - (this._walkInSparkleTimer / 1.5);
      const ringR = 8 + f * 18;
      ctx.save();
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 2, ringR, ringR * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = ringR * (0.55 + Math.sin(this._walkInSparkleTimer * 6 + i) * 0.1);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, 2 + Math.sin(a) * r * 0.45, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Finale arrival flash.
    if (this._finaleFlashTimer > 0) {
      const f = 1 - (this._finaleFlashTimer / 0.6);
      ctx.save();
      ctx.globalAlpha = 1 - f;
      const grad = ctx.createRadialGradient(0, 2, 2, 0, 2, 18);
      grad.addColorStop(0,   'rgba(254,243,199,0.9)');
      grad.addColorStop(0.6, 'rgba(251,191,36,0.5)');
      grad.addColorStop(1,   'rgba(251,191,36,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 2, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this._finaleFlashTimer = Math.max(0, this._finaleFlashTimer - 0.016);
    }

    // Bonded gold aura. Skipped in low-spec — radial gradients are
    // expensive when 6 Glimmers are visible at once.
    if (bonded && !window._lowSpecMode) {
      const grad = ctx.createRadialGradient(0, -16, 4, 0, -16, 28);
      grad.addColorStop(0, 'rgba(251,191,36,0.0)');
      grad.addColorStop(0.5, 'rgba(251,191,36,0.22)');
      grad.addColorStop(1, 'rgba(251,191,36,0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, -16, 28 + Math.sin(t * 2) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Animation timing — match player's 6Hz walk cadence.
    const bodyBob  = walking ? Math.sin(t * 6) * 2.5 : Math.sin(t * 1.2) * 0.8;
    const legSwing = walking ? Math.sin(t * 6) * 6 : 0;
    const armSwing = walking ? Math.sin(t * 6) * 10 : Math.sin(t * 1.2) * 1.5;
    const breathe  = Math.sin(Date.now() / 800) * 0.5;

    // ── Soft drop shadow under the cloak. ──
    ctx.fillStyle = 'rgba(120, 80, 130, 0.20)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Cloak body (Mysterious-Merchant silhouette in pastel). ──
    // Soft sway + subtle squash from the per-emotion `def` table.
    ctx.save();
    ctx.rotate(def.tilt);

    const bobY = bodyBob; // existing 6Hz walk bob
    // Cloak silhouette goes from the ground (y≈-3) up to the hat brim (y≈-34).
    const bottomY = -3 + bobY * 0.4;
    const topY    = (-34 - breathe) * def.sy + bobY * 0.3;
    const widthB  = 13 * def.sx;
    const widthT  = 9  * def.sx;

    // Fill cloak.
    ctx.fillStyle = ml.cloak;
    ctx.beginPath();
    ctx.moveTo(-widthB, bottomY);
    ctx.quadraticCurveTo(-widthB - 1, (bottomY + topY) / 2, -widthT, topY);
    ctx.lineTo(widthT, topY);
    ctx.quadraticCurveTo(widthB + 1, (bottomY + topY) / 2, widthB, bottomY);
    ctx.closePath();
    ctx.fill();
    // Sticker outline.
    ctx.strokeStyle = ml.cloakDeep;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Cloak inner highlight stripe (gives the figure volume).
    ctx.fillStyle = ml.trim;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-widthT * 0.5, topY + 2);
    ctx.quadraticCurveTo(-widthB * 0.45, (bottomY + topY) / 2, -widthB * 0.35, bottomY - 2);
    ctx.lineTo(-widthB * 0.05, bottomY - 2);
    ctx.quadraticCurveTo(-widthT * 0.05, (bottomY + topY) / 2, -widthT * 0.15, topY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cloak hem (two scalloped notches for cuteness).
    ctx.fillStyle = ml.cloakDeep;
    ctx.beginPath();
    ctx.moveTo(-widthB, bottomY);
    ctx.quadraticCurveTo(-widthB * 0.5, bottomY + 3, 0, bottomY);
    ctx.quadraticCurveTo(widthB * 0.5, bottomY + 3, widthB, bottomY);
    ctx.lineTo(widthB, bottomY + 1);
    ctx.lineTo(-widthB, bottomY + 1);
    ctx.closePath();
    ctx.fill();

    // ── Hat — different shape per personality. ──
    const hatBaseY = topY - 1;
    this._drawGlimmerHat(ctx, hatBaseY, ml, def, bobY * 0.2);

    // ── Glowing eyes peeking from the hat shadow. ──
    const eyeY = topY + 4;
    // Two soft glow halos behind the eye dots.
    ctx.save();
    if (!window._lowSpecMode) {
      ctx.shadowColor = ml.eyeGlow;
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = ml.eyeGlow;
    const eyeJitter = em === 'scared' ? Math.sin(Date.now() / 60) * 0.5 : 0;
    ctx.beginPath(); ctx.arc(-3 + eyeJitter, eyeY, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 3 + eyeJitter, eyeY, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Tiny white sparkle inside each eye.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-3.5 + eyeJitter, eyeY - 0.4, 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 2.5 + eyeJitter, eyeY - 0.4, 0.55, 0, Math.PI * 2); ctx.fill();

    // ── Floating signature accessory beside the cloak. ──
    const fIcon = ml.float;
    if (fIcon) {
      const fY = -16 + bobY + Math.sin(t * 2.4) * 2.2;
      const fX = widthB + 4 + Math.sin(t * 1.6) * 0.6;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Faint glow under the icon for the sticker pop.
      ctx.save();
      ctx.shadowColor = ml.eyeGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = ml.eyeGlow;
      ctx.fillText(fIcon, fX, fY);
      ctx.restore();
    }

    ctx.restore(); // end body-tilt transform

    // Convenience refs used by the bubble/joy/name code below — keep names
    // similar to the previous render so those blocks don't need editing.
    const bodyCY = (topY + bottomY) / 2;
    const bodyH  = (bottomY - topY) / 2;

    // Troubled 💬 bubble above the spark when a task is waiting,
    // or ✨ when the task condition is met (player needs to come tap & confirm).
    if (this.mood === MOOD.TROUBLED || this.mood === MOOD.TASK_READY) {
      const float = Math.sin(t * 3) * 1.2;
      const isReady = this.mood === MOOD.TASK_READY;
      ctx.font = isReady ? 'bold 14px Arial' : '11px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Soft glow behind the ready badge so it pops.
      if (isReady) {
        ctx.save();
        ctx.shadowColor = '#fde68a';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#fde68a';
        ctx.fillText('✨', 0, bodyCY - bodyH - 10 + float);
        ctx.restore();
      } else {
        ctx.fillText('💬', 0, bodyCY - bodyH - 10 + float);
      }
    }
    // Joy burst sparkles on completion.
    if (this.joyTimer > 0) {
      const f = (this.joyTimer % 0.6) / 0.6;
      ctx.globalAlpha = 1 - f;
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + f * 2;
        const r = 14 + f * 10;
        ctx.fillText('✨', Math.cos(a) * r, eyeY + Math.sin(a) * r * 0.5);
      }
      ctx.globalAlpha = 1;
    }

    // Given name under the spark.
    ctx.font = 'italic 6.5px Lora, serif';
    ctx.fillStyle = bonded ? '#fbbf24' : '#cdc4dd';
    ctx.textAlign = 'center';
    ctx.fillText(this.def.name || this.def.label, 0, 9);

    ctx.restore();
  }

  // ── Glimmer hat shapes — one per personality. ──
  // Drawn centred at (0, baseY) so the brim sits on the cloak's hood line.
  // bobOffsetY is added to subtle hat sway so it parallaxes with the cloak.
  _drawGlimmerHat(ctx, baseY, ml, def, bobOffsetY = 0) {
    const yB = baseY + bobOffsetY;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ml.cloakDeep;

    switch (ml.hat) {
      case 'pom_cap': {
        // Soft sleeping cap with pom-pom — Tobi.
        ctx.fillStyle = ml.hatColor;
        ctx.beginPath();
        ctx.moveTo(-9, yB);
        ctx.quadraticCurveTo(-10, yB - 6, -4, yB - 9);
        ctx.quadraticCurveTo(0,  yB - 14, 6, yB - 8);
        ctx.lineTo(9, yB);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Pom-pom.
        ctx.fillStyle = ml.hatTrim;
        ctx.beginPath(); ctx.arc(7, yB - 9, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'crown': {
        // Pointy little crown — Pip.
        ctx.fillStyle = ml.hatColor;
        ctx.beginPath();
        ctx.moveTo(-9, yB);
        ctx.lineTo(-9, yB - 3);
        ctx.lineTo(-5, yB - 8);
        ctx.lineTo(-2, yB - 4);
        ctx.lineTo(0,  yB - 10);
        ctx.lineTo(2,  yB - 4);
        ctx.lineTo(5,  yB - 8);
        ctx.lineTo(9,  yB - 3);
        ctx.lineTo(9, yB);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Tip jewels.
        ctx.fillStyle = ml.hatTrim;
        ctx.beginPath(); ctx.arc(-5, yB - 8, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 0, yB - 10, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 5, yB - 8, 1, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bun_cap': {
        // Soft bun-shaped cap — Mira.
        ctx.fillStyle = ml.hatColor;
        ctx.beginPath();
        ctx.ellipse(0, yB - 4, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, yB - 9, 4.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Cute heart on the front.
        ctx.fillStyle = ml.hatTrim;
        ctx.beginPath();
        ctx.moveTo(0, yB - 2);
        ctx.bezierCurveTo(-3, yB - 5, -3, yB - 7, 0, yB - 5);
        ctx.bezierCurveTo(3, yB - 7, 3, yB - 5, 0, yB - 2);
        ctx.fill();
        break;
      }
      case 'beret': {
        // Floppy artist beret — Wren.
        ctx.fillStyle = ml.hatColor;
        ctx.beginPath();
        ctx.ellipse(-1, yB - 6, 11, 5, -0.18, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Stem on top.
        ctx.fillStyle = ml.hatTrim;
        ctx.beginPath();
        ctx.arc(-7, yB - 10, 1.6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'cap': {
        // Worker / builder cap with a brim — Bram.
        ctx.fillStyle = ml.hatColor;
        // Crown.
        ctx.beginPath();
        ctx.moveTo(-7, yB);
        ctx.quadraticCurveTo(-8, yB - 8, 0, yB - 9);
        ctx.quadraticCurveTo(8, yB - 8, 7, yB);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Brim sticking forward (left).
        ctx.beginPath();
        ctx.moveTo(-7, yB);
        ctx.lineTo(-13, yB + 2);
        ctx.lineTo(-7, yB + 2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Front patch.
        ctx.fillStyle = ml.hatTrim;
        ctx.beginPath();
        ctx.arc(0, yB - 4, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'tall_pointy': {
        // Tall conical wizard-hat with a feather — Ren.
        ctx.fillStyle = ml.hatColor;
        ctx.beginPath();
        ctx.moveTo(-9, yB);
        ctx.lineTo(-2, yB - 16);
        ctx.lineTo(2,  yB - 16);
        ctx.lineTo(9, yB);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Brim.
        ctx.fillStyle = ml.cloakDeep;
        ctx.beginPath();
        ctx.ellipse(0, yB, 11, 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Feather.
        ctx.fillStyle = ml.hatTrim;
        ctx.beginPath();
        ctx.moveTo(2, yB - 16);
        ctx.quadraticCurveTo(8, yB - 18, 10, yB - 12);
        ctx.quadraticCurveTo(6, yB - 13, 2, yB - 14);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      }
      default: {
        // Fallback: simple round cap.
        ctx.fillStyle = ml.hatColor;
        ctx.beginPath();
        ctx.ellipse(0, yB - 4, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }
  }

  // ── Body deformation table (squash/stretch/tilt per emotion) ──
  // Returns { sx, sy, tilt } applied to the body ellipse. The eye drawing
  // already changes shape per emotion, so this just amplifies through the
  // whole creature for exaggerated, coordinated body language.
  _bodyDeform(em, t) {
    // Subtle breathing wobble baseline.
    const wob = Math.sin(t * 1.1) * 0.02;
    if (em === 'happy') {
      // Stretch upward, gentle bob — boundless little flame leap.
      const lift = Math.sin(t * 4) * 0.04;
      return { sx: 0.92 + wob, sy: 1.08 + lift, tilt: Math.sin(t * 2) * 0.03 };
    }
    if (em === 'sad') {
      // Squash down, droop a little.
      return { sx: 1.10, sy: 0.88, tilt: Math.sin(t * 0.8) * 0.02 };
    }
    if (em === 'scared') {
      // Trembling — rapid tiny scale jitter.
      const shake = Math.sin(t * 22) * 0.04;
      return { sx: 0.95 + shake, sy: 1.05 - shake, tilt: Math.sin(t * 28) * 0.05 };
    }
    if (em === 'sleepy') {
      // Slow lull side-to-side, slightly squashed.
      return { sx: 1.04, sy: 0.96, tilt: Math.sin(t * 0.7) * 0.07 };
    }
    if (em === 'smug') {
      // Hip-cocked tilt, normal body.
      return { sx: 1.0, sy: 1.0, tilt: 0.10 + Math.sin(t * 1.5) * 0.01 };
    }
    if (em === 'determined') {
      // Stand tall and stiff — slight upward stretch, no tilt.
      return { sx: 0.95, sy: 1.05, tilt: 0 };
    }
    if (em === 'dreamy') {
      // Slow gentle sway, soft body.
      return { sx: 1.02 + wob, sy: 1.0, tilt: Math.sin(t * 1.0) * 0.06 };
    }
    // calm / default
    return { sx: 1.0 + wob, sy: 1.0, tilt: Math.sin(t * 0.9) * 0.015 };
  }

  // ── Hair styles. Each takes (ctx, headY, color) and draws on a head centred at (0, headY).
  _drawHair(ctx, headY, style, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#2d2640';
    ctx.lineWidth = 0.8;
    switch (style) {
      case 'long_bangs': {
        // Smooth bangs that drape across the forehead — Ren.
        ctx.beginPath();
        ctx.moveTo(-12, headY - 8);
        ctx.bezierCurveTo(-10, headY - 14, 10, headY - 14, 12, headY - 8);
        ctx.lineTo(11, headY + 1);
        ctx.bezierCurveTo(8, headY - 4, -8, headY - 4, -11, headY + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'messy_short': {
        // Spiked tufts sticking up — Bram.
        ctx.beginPath();
        ctx.moveTo(-12, headY - 6);
        ctx.lineTo(-10, headY - 13);
        ctx.lineTo(-6,  headY - 8);
        ctx.lineTo(-2,  headY - 14);
        ctx.lineTo(2,   headY - 8);
        ctx.lineTo(6,   headY - 13);
        ctx.lineTo(10,  headY - 7);
        ctx.lineTo(12,  headY - 5);
        ctx.bezierCurveTo(8, headY - 11, -8, headY - 11, -12, headY - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'side_braid': {
        // Soft top with a long braid trailing on one side — Wren.
        ctx.beginPath();
        ctx.moveTo(-12, headY - 6);
        ctx.bezierCurveTo(-12, headY - 14, 12, headY - 14, 12, headY - 6);
        ctx.bezierCurveTo(8, headY - 11, -8, headY - 11, -12, headY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Side braid (right side).
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(11, headY + 4, 2.5, 5, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12, headY + 9, 2.2, 4, -0.30, 0, Math.PI * 2);
        ctx.fill();
        // Tiny ribbon at the tip.
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.ellipse(13, headY + 12, 1.6, 1.0, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'twin_buns': {
        // Two top buns + center cap — Mira.
        ctx.beginPath();
        ctx.moveTo(-12, headY - 6);
        ctx.bezierCurveTo(-12, headY - 13, 12, headY - 13, 12, headY - 6);
        ctx.bezierCurveTo(8, headY - 10, -8, headY - 10, -12, headY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Buns
        ctx.beginPath(); ctx.arc(-9, headY - 13, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc( 9, headY - 13, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'spiky': {
        // Aggressive uppercut spikes — Pip.
        ctx.beginPath();
        const peaks = [-12, -7, -2, 3, 8, 12];
        const heights = [-10, -16, -12, -17, -13, -10];
        ctx.moveTo(peaks[0], headY - 5);
        for (let i = 0; i < peaks.length; i++) {
          ctx.lineTo(peaks[i] - 2, heights[i] + headY);
          ctx.lineTo(peaks[i] + 1, headY - 7);
        }
        ctx.lineTo(13, headY - 5);
        ctx.bezierCurveTo(8, headY - 9, -8, headY - 9, -12, headY - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'fluffy': {
        // Pillowy round cloud of hair — Tobi (youngest, soft).
        ctx.beginPath();
        ctx.arc(-9, headY - 9, 5, 0, Math.PI * 2);
        ctx.arc(-3, headY - 12, 5, 0, Math.PI * 2);
        ctx.arc( 3, headY - 12, 5, 0, Math.PI * 2);
        ctx.arc( 9, headY - 9, 5, 0, Math.PI * 2);
        ctx.arc( 0, headY - 7, 5, 0, Math.PI * 2);
        ctx.fill();
        // Soft outline along bottom only
        ctx.beginPath();
        ctx.moveTo(-12, headY - 5);
        ctx.bezierCurveTo(-10, headY - 8, 10, headY - 8, 12, headY - 5);
        ctx.stroke();
        break;
      }
      default: {
        // Generic short tuft fallback.
        ctx.beginPath();
        ctx.moveTo(-6, headY - 12);
        ctx.quadraticCurveTo(-2, headY - 22, 2, headY - 14);
        ctx.quadraticCurveTo(4, headY - 20, 8, headY - 12);
        ctx.quadraticCurveTo(3, headY - 13, -6, headY - 12);
        ctx.fill();
      }
    }
  }

  // Optional accessory rendered on the body (chest area).
  _drawBodyAccessory(ctx, bodyY, look) {
    if (!look) return;
    if (look.accessory === 'apron_heart') {
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      // Tiny heart on chest
      ctx.moveTo(0, bodyY + 5);
      ctx.bezierCurveTo(-3, bodyY + 2, -3, bodyY - 1, 0, bodyY + 1);
      ctx.bezierCurveTo(3, bodyY - 1, 3, bodyY + 2, 0, bodyY + 5);
      ctx.fill();
    }
    if (look.accessory === 'plush') {
      // Tiny plush bear hugged on the side.
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath(); ctx.arc(13, bodyY + 4, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, bodyY + 1, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, bodyY + 1, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fde7c4';
      ctx.beginPath(); ctx.arc(13, bodyY + 5, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Optional accessory floating around or on the head.
  _drawHeadAccessory(ctx, headY, look, t) {
    if (!look) return;
    if (look.accessory === 'music_note') {
      // Soft ♪ floating beside the ear.
      const wob = Math.sin(t * 1.4) * 1.2;
      ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText('♪', 17, headY - 8 + wob);
      // Three drifting note particles riding sine waves above the head.
      const glyphs = ['♪','♫','♬'];
      ctx.font = 'bold 6px Arial';
      ctx.fillStyle = '#bae6fd';
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.45 + i * 0.6) % 1;          // 0..1 lifecycle
        const alpha = phase < 0.15 ? phase / 0.15
                     : phase > 0.85 ? (1 - phase) / 0.15
                     : 1;
        const lx = -10 + i * 10 + Math.sin(t * 1.6 + i) * 2;
        const ly = headY - 14 - phase * 18;
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillText(glyphs[i], lx, ly);
      }
      ctx.globalAlpha = 1;
    }
    if (look.accessory === 'bandage_cheek') {
      // X-shaped bandage on left cheek.
      ctx.save();
      ctx.translate(-7, headY + 2);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-3, -1, 6, 2);
      ctx.fillRect(-1, -3, 2, 6);
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(-3, -1, 6, 2);
      ctx.strokeRect(-1, -3, 2, 6);
      ctx.restore();
    }
    if (look.accessory === 'paint_smudge') {
      // Coral smudge across the cheek.
      ctx.fillStyle = 'rgba(251,113,133,0.6)';
      ctx.beginPath();
      ctx.ellipse(7, headY + 2, 3, 1.4, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(167,139,250,0.45)';
      ctx.beginPath();
      ctx.ellipse(-6, headY + 5, 1.6, 0.9, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (look.accessory === 'headband') {
      // Red headband across the forehead.
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(0, headY - 5, 13, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Side knot.
      ctx.beginPath();
      ctx.ellipse(-13, headY - 4, 2.4, 1.6, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Map mood → which face emotion to render.
  _faceEmotion() {
    if (this.mood === MOOD.JOYFUL || this.mood === MOOD.BONDED) return 'happy';
    if (this.mood === MOOD.FRIGHTENED) return 'scared';
    if (this.mood === MOOD.RESTING)    return 'sleepy';
    if (this.mood === MOOD.TROUBLED)   return 'sad';
    return this.def.look?.defaultEmotion || 'calm';
  }

  // Cute chibi eyes only — no mouths. Glimmers express through eye shape +
  // body squash/stretch (see _bodyDeform). All eyes get a soft sparkle highlight.
  _drawFace(ctx, headY, em) {
    ctx.strokeStyle = '#2d2640';
    ctx.lineCap = 'round';

    // Helper — round glossy eye with two highlights. Used by most emotions.
    const eye = (cx, cy, r) => {
      ctx.fillStyle = '#2d2640';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      // Big upper-left sparkle.
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.4, r * 0.42, 0, Math.PI * 2); ctx.fill();
      // Tiny lower-right sparkle.
      ctx.beginPath(); ctx.arc(cx + r * 0.35, cy + r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();
    };

    if (em === 'happy') {
      // Closed smiley arcs (^_^).
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-5, headY,     3.2, Math.PI * 1.05, Math.PI * 1.95, true); ctx.stroke();
      ctx.beginPath(); ctx.arc( 5, headY,     3.2, Math.PI * 1.05, Math.PI * 1.95, true); ctx.stroke();
      return;
    }
    if (em === 'sad') {
      // Big watery glossy eyes, slightly droopy. No tears, no mouth.
      eye(-5, headY,     2.5);
      eye( 5, headY,     2.5);
      // Soft drooping lid hint above.
      ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.arc(-5, headY - 2.5, 3.0, Math.PI * 1.15, Math.PI * 1.85, true); ctx.stroke();
      ctx.beginPath(); ctx.arc( 5, headY - 2.5, 3.0, Math.PI * 1.15, Math.PI * 1.85, true); ctx.stroke();
      return;
    }
    if (em === 'scared') {
      // Wide cute startled eyes — purple pupils, not pure black, with sparkle.
      const shake = Math.sin(Date.now() / 80) * 0.4;
      // Eye whites
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5 + shake, headY - 0.5, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 5 + shake, headY - 0.5, 3.4, 0, Math.PI * 2); ctx.fill();
      // Soft outline
      ctx.strokeStyle = '#5b4b78';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(-5 + shake, headY - 0.5, 3.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc( 5 + shake, headY - 0.5, 3.4, 0, Math.PI * 2); ctx.stroke();
      // Friendly purple pupils with sparkle.
      ctx.fillStyle = '#5b3a8c';
      ctx.beginPath(); ctx.arc(-5 + shake, headY - 0.3, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 5 + shake, headY - 0.3, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5.5 + shake, headY - 0.8, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 4.5 + shake, headY - 0.8, 0.6, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (em === 'sleepy') {
      // Closed eyelash arcs only — no mouth. Floating "z" beside.
      ctx.strokeStyle = '#2d2640';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-5, headY - 0.5, 2.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc( 5, headY - 0.5, 2.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      // Tiny lashes for sleep cuteness.
      ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.moveTo(-7, headY - 0.5); ctx.lineTo(-7.8, headY + 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 7, headY - 0.5); ctx.lineTo( 7.8, headY + 0.4); ctx.stroke();
      // Floating z.
      ctx.font = 'bold 6px Arial';
      ctx.fillStyle = '#a78bfa';
      ctx.fillText('z', 11, headY - 6);
      return;
    }
    if (em === 'smug') {
      // Wink — one closed arc, one round glossy eye. No mouth.
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-5, headY, 2.6, Math.PI * 1.05, Math.PI * 1.95, true); ctx.stroke();
      eye(5, headY, 2.4);
      return;
    }
    if (em === 'determined') {
      // Sparkly star-shine eyes (cute, not stern). No brows, no mouth.
      eye(-5, headY, 2.6);
      eye( 5, headY, 2.6);
      // Extra little glint above each eye.
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-3.5, headY - 2.5, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 3.5, headY - 2.5, 0.7, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (em === 'dreamy') {
      // Soft half-closed eyes with little sparkle below.
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-5, headY - 0.5, 2.6, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.beginPath(); ctx.arc( 5, headY - 0.5, 2.6, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5, headY + 1.2, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 5, headY + 1.2, 0.6, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // 'calm' — default. Round glossy eyes.
    eye(-5, headY, 2.2);
    eye( 5, headY, 2.2);
  }

  // Render the spark — Mysterious-Merchant style cloak + hat + glow eyes —
  // into a square portrait. Used by the task dialog (StoryPanel).
  drawPortrait(ctx, size = 96) {
    const ml = ChildNPC._GLIMMER_LOOK[this.def.id] || {
      cloak: this.def.look?.bodyColor || '#c4b5fd', cloakDeep: '#7c6b99',
      trim: '#fff4ec', hat: 'pom_cap', hatColor: '#7c6b99',
      hatTrim: '#fbcfe8', eyeGlow: '#fde68a', float: '✦',
    };
    ctx.save();
    ctx.translate(size / 2, size / 2 + 16);
    ctx.scale(2.0, 2.0);

    // Soft circular backdrop in the spark's cloak colour.
    const grad = ctx.createRadialGradient(0, -10, 4, 0, -10, 26);
    grad.addColorStop(0,   ml.cloak);
    grad.addColorStop(0.6, ml.cloak);
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(0, -10, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // ── Cloak silhouette ──
    const bottomY = 0, topY = -28;
    const widthB = 13, widthT = 9;
    ctx.fillStyle = ml.cloak;
    ctx.beginPath();
    ctx.moveTo(-widthB, bottomY);
    ctx.quadraticCurveTo(-widthB - 1, (bottomY + topY) / 2, -widthT, topY);
    ctx.lineTo(widthT, topY);
    ctx.quadraticCurveTo(widthB + 1, (bottomY + topY) / 2, widthB, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ml.cloakDeep;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Trim stripe.
    ctx.fillStyle = ml.trim;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-widthT * 0.5, topY + 2);
    ctx.quadraticCurveTo(-widthB * 0.45, (bottomY + topY) / 2, -widthB * 0.35, bottomY - 2);
    ctx.lineTo(-widthB * 0.05, bottomY - 2);
    ctx.quadraticCurveTo(-widthT * 0.05, (bottomY + topY) / 2, -widthT * 0.15, topY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Hat. ──
    this._drawGlimmerHat(ctx, topY, ml, { sx: 1, sy: 1, tilt: 0 }, 0);

    // ── Glowing eyes. ──
    const eyeY = topY + 4;
    ctx.save();
    ctx.shadowColor = ml.eyeGlow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = ml.eyeGlow;
    ctx.beginPath(); ctx.arc(-3, eyeY, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 3, eyeY, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-3.5, eyeY - 0.4, 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 2.5, eyeY - 0.4, 0.55, 0, Math.PI * 2); ctx.fill();

    // ── Floating signature. ──
    if (ml.float) {
      ctx.save();
      ctx.shadowColor = ml.eyeGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = ml.eyeGlow;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ml.float, widthB + 5, -12);
      ctx.restore();
    }

    ctx.restore();
  }
}

// ── Manager ────────────────────────────────────────────────────────────
export class ChildrenManager {
  constructor(game) {
    this.game = game;
    this.list = CHILDREN.map((def, idx) => new ChildNPC(idx, def));
    // One personal camp per child — same index alignment as `list`.
    this.camps = CHILDREN.map((def, idx) => new ChildCamp(idx, def));
    this._taskTickAcc = 0;     // throttle task condition checks to 0.5s
    this._taskTickerHelpers = makeTaskTickerHelpers();
    this._lastVignetteAt = 0;
    this._lastInputActAt = Date.now();    // for T4.3 inaction timer
  }

  // Mark used-from-input — resets T4.3 inaction timer.
  noteInputActivity() { this._lastInputActAt = Date.now(); }

  update(dt) {
    const game = this.game;
    // Cycle each present child's AI + animation.
    for (const c of this.list) c.update(dt, game);
    // Camps tick their own time so animations (kettle steam, flag wave) keep going.
    for (const cmp of this.camps) cmp.update(dt);
    // Mark each camp as occupied if its child is currently sitting at it.
    for (let i = 0; i < this.camps.length; i++) {
      const child = this.list[i], camp = this.camps[i];
      camp.isOccupied = !!(child && child._restingAtCamp);
    }

    // Discovery: any silhouette that the light has reached should walk in.
    const r = game.getLightRadius?.() ?? ((game.player?.stats?.level || 1) * 0.5 + 1);
    for (const c of this.list) {
      if (c.phase === PHASE.SILHOUETTE) {
        const d = Math.hypot(c.silhouetteX, c.silhouetteY);
        if (d <= r * 0.95) this._beginWalkIn(c);
      }
    }

    // Task tickers (every 0.5s) — only the active task per child runs.
    this._taskTickAcc += dt;
    if (this._taskTickAcc >= 0.5) {
      this._taskTickAcc = 0;
      this._tickActiveTasks();
    }
  }

  draw(ctx, world) {
    // Children + camps render via main.js's depth-sorted entity-list pass.
    // This direct draw path is unused by the live game and exists for tests.
    for (const cmp of this.camps) cmp.draw(ctx, world);
    for (const c of this.list)    c.draw(ctx, world);
  }

  // Tap dispatch — true if any child consumed the tap.
  handleTap(calcX, calcY) {
    for (const c of this.list) {
      if (c.phase !== PHASE.PRESENT) continue;
      if (Math.hypot(c.x - calcX, c.y - calcY) < 0.45) {
        c.tapBobble = 1.0;
        if (typeof window.openChildDialog === 'function') {
          window.openChildDialog(c.childIdx);
        }
        return true;
      }
    }
    return false;
  }

  // Discovery hook called from main.js checkLevelUp().
  // Spawns a silhouette at the darkness edge nearest the player.
  checkLevelUp(level) {
    const game = this.game;
    for (const c of this.list) {
      if (c.phase !== PHASE.HIDDEN) continue;
      if (c.def.discoveryLevel <= 0) continue;          // Day-1 specials handled separately
      if (level >= c.def.discoveryLevel) {
        this._spawnSilhouette(c);
      }
    }
  }

  // Day-1 child setup — Child 6 spawns immediately.
  spawnDayOne() {
    const c6 = this.list[5];
    if (!c6 || c6.phase !== PHASE.HIDDEN) return;
    c6.phase = PHASE.PRESENT;
    c6.setPos(this.game.player.x + 0.6, this.game.player.y + 0.4);
    this._fireDiscoveryVignette(c6, /*deferred=*/ true);
  }

  _spawnSilhouette(c) {
    // Each child appears next to their personal camp, slightly offset so the
    // sprite isn't drawn directly on top of the prop.
    const camp = this.camps[c.childIdx];
    if (camp) {
      const offset = 0.9;
      const offX = camp.x + Math.cos(camp.def.camp.angle) * offset;
      const offY = camp.y + Math.sin(camp.def.camp.angle) * offset;
      c.silhouetteX = offX;
      c.silhouetteY = offY;
    } else {
      // Defensive fallback — keep the old "edge of light" placement.
      const game = this.game;
      const r = game.getLightRadius?.() ?? ((game.player?.stats?.level || 1) * 0.5 + 1);
      const angle = Math.atan2(game.player.y, game.player.x) + (Math.random() - 0.5) * 0.6;
      const distance = r + 1.4;
      c.silhouetteX = Math.cos(angle) * distance;
      c.silhouetteY = Math.sin(angle) * distance;
    }
    c.phase = PHASE.SILHOUETTE;
    c.setPos(c.silhouetteX, c.silhouetteY);
  }

  _beginWalkIn(c) {
    c.phase = PHASE.WALKING_IN;
    // Start movement target toward the player immediately.
    c.targetX = this.game.player.x;
    c.targetY = this.game.player.y;
    c.discoveryAnimTimer = 0;
    this._fireDiscoveryVignette(c);
    // After walking_in completes (handled in update()), mark found in story state.
    const story = this.game.story?.children;
    if (story && !story.found[c.childIdx]) {
      story.found[c.childIdx] = true;
      // Achievement: child{birthOrder}_found.
      this.game.ach?.set?.(`child${c.def.birthOrder}_found`, 1);
      this.game.saveGame?.();
    }
  }

  _fireDiscoveryVignette(c, deferred) {
    const fire = () => {
      this._lastVignetteAt = Date.now();
      window.StoryAudio?.playChildDiscovery?.(0.9);
      const head = c.def.name
        ? `${c.def.name} — ${c.def.nickname}`
        : `${c.def.label} — ${c.def.nickname}`;
      window.StoryPanel?.show({
        kind: 'vignette',
        title: head,
        icon:  c.icon,
        lines: c.def.discoveryLines,
        dismissDelay: 6000,
        voiceSeed: c.childIdx,
      });
    };
    if (deferred) setTimeout(fire, 900); else fire();
  }

  // ── Task tickers ─────────────────────────────────────────────────────
  // The ticker only DETECTS that conditions are met — it does NOT fire the
  // story panel. Instead it stores `pendingTask` on the Glimmer; the player
  // has to walk over and tap to confirm before the story reveal plays.
  _tickActiveTasks() {
    const game = this.game;
    for (const c of this.list) {
      if (c.phase !== PHASE.PRESENT) continue;
      if (c.pendingTask) continue; // already waiting for player to confirm
      const task = c.activeTask(game);
      if (!task) continue;
      try {
        const result = runTaskTicker(task, game, c, this._taskTickerHelpers);
        if (result === true) {
          this._markTaskPending(c, task);
        } else if (result && typeof result === 'object') {
          if (typeof result.progress === 'number') {
            game._childTaskProgress = game._childTaskProgress || {};
            game._childTaskProgress[task.id] = result.progress;
          }
          if (result.done) this._markTaskPending(c, task);
        }
      } catch (e) { /* silent — keep loop alive */ }
    }
  }

  // Phase 1 of completion: condition met. Mark the Glimmer as ready-to-report
  // so the ✨ bubble appears. A soft chime nudges the player to come over.
  // Also enqueues a HUD-strip "✓ tick + confetti" celebration that fires when
  // no modal is open (drainer in main.js), preserving discovery order.
  _markTaskPending(c, task) {
    if (c.pendingTask) return;
    c.pendingTask = task;
    window.StoryAudio?.playTaskComplete?.(0.55);
    // Refresh the HUD now so the row appears in "ready" state with the
    // stable data-task-id the drainer needs to locate it.
    window.updateActiveTasksHUD?.();
    window._enqueueTaskCelebration?.(c.childIdx, task.id);
  }

  // Phase 2: player tapped the Glimmer and pressed "Complete" in the dialog.
  // This is where the actual story-reveal panel fires (queued by StoryPanel
  // so simultaneous reveals never overlap).
  confirmPendingTask(childIdx) {
    const c = this.list[childIdx];
    if (!c || !c.pendingTask) return false;
    const task = c.pendingTask;
    c.pendingTask = null;
    this._completeTask(c, task);
    return true;
  }

  _completeTask(c, task) {
    const game = this.game;
    const story = game.story?.children;
    if (!story) return;
    if (story.tasksDone[c.childIdx] >= task.slot) return; // already credited
    story.tasksDone[c.childIdx] = task.slot;
    if (task.slot >= 4) story.bond[c.childIdx] = true;
    // Drop the persistent green-tick from the HUD strip — the row will
    // re-render to show the next task (or disappear) with no stale tick.
    window._clearTaskTick?.(task.id);
    // Beefier joy state for the celebration — sparkles last longer.
    c.joyTimer = 2.4;
    c._wasBonded = c.isBonded(game);
    c.lastTaskCompleteAt = Date.now();
    // Achievement counters.
    // task_<lower-id-with-underscores>: e.g., 'T6.1' → 'task_t6_1'
    const taskKey = `task_${task.id.toLowerCase().replace(/\./g, '_')}`;
    game.ach?.set?.(taskKey, 1);
    if (task.slot >= 4) {
      game.ach?.set?.(`child${c.def.birthOrder}_bond`, 1);
    }
    // ── Celebration SFX + VFX. ───────────────────────────────────────
    // Always fire the bigger fanfare on top of the slot-specific chime.
    window.StoryAudio?.playTaskCelebrate?.(task.slot >= 4 ? 1.0 : 0.85);
    if (task.slot >= 4) window.StoryAudio?.playBondFill?.(0.9);
    else                window.StoryAudio?.playTaskComplete?.(0.85);
    // Confetti rain at the Glimmer's spot. Final-task completions get a
    // second burst at the campfire too for extra oomph.
    game._spawnCelebrationBurst?.(c.x, c.y);
    if (task.slot >= 4) {
      setTimeout(() => game._spawnCelebrationBurst?.(c.x, c.y), 250);
      setTimeout(() => game._spawnCelebrationBurst?.(0, 0),     500);
    }
    // Child 1's final bond beat (T1.4) plays the 8-note folk melody.
    if (task.id === 'T1.4') {
      setTimeout(() => window.StoryAudio?.playChild1Melody?.(0.85), 800);
    }
    game.saveGame?.();

    // Story Reveal panel — chain into shard/bond shard if applicable.
    const lines = [task.storyReveal];
    if (task.memoryEcho) lines.push('— ' + task.memoryEcho);
    window.StoryPanel?.show({
      kind: 'reveal',
      icon: c.icon,
      kicker: `${c.def.name || c.def.label} · Task ${task.slot} / 4`,
      title: task.name,
      quote: task.completionLine,
      lines,
      voiceSeed: c.childIdx,
    }).then(() => {
      // Phase 3 trigger hook: if this task should fire a Memory Shard, queue it.
      if (typeof task.shardTrigger === 'number') {
        window.dispatchEvent(new CustomEvent('cmm:shard-trigger', {
          detail: { source: 'task_complete', taskId: task.id, shardIdx: task.shardTrigger },
        }));
      }
      // Bond filled? Emit for Shard 09.
      if (story.bond.every(Boolean)) {
        window.dispatchEvent(new CustomEvent('cmm:shard-trigger', {
          detail: { source: 'bond_filled' },
        }));
      }
    });
  }

  // ── Save / Load ──────────────────────────────────────────────────────
  // Position state is per-run; the canonical truth (found, tasksDone, bond) lives
  // in game.story.children. We just bring children to PRESENT phase if found, and
  // place them at their home zones.
  hydrateFromStory() {
    const game = this.game;
    const found = game.story?.children?.found || [];
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (found[i]) {
        c.phase = PHASE.PRESENT;
        const t = c._pickHomeTarget(game) || { x: 0, y: 0 };
        c.setPos(t.x, t.y);
      } else {
        c.phase = PHASE.HIDDEN;
      }
    }
  }
}

// ── Task tickers ──────────────────────────────────────────────────────
// Tasks are gameplay-oriented and polled against achievement counters
// (see TASKS in children_data.js: each task carries a `counter` key and
// a `target`). The default ticker just reads game.ach.c[counter] and
// reports progress. Composite tasks (T1.4) get a special handler.
// Tickers run every 0.5s per present Glimmer's active task.
// ────────────────────────────────────────────────────────────────────────

function makeTaskTickerHelpers() {
  // Per-task scratch state lives here so save/load doesn't need to know.
  return {
    state: Object.create(null),
    bump(taskId, key, by = 1) {
      const s = this.state[taskId] = this.state[taskId] || {};
      s[key] = (s[key] || 0) + by;
      return s[key];
    },
    set(taskId, key, value) {
      const s = this.state[taskId] = this.state[taskId] || {};
      s[key] = value;
      return value;
    },
    get(taskId, key, def) {
      const s = this.state[taskId];
      if (!s || !(key in s)) return def;
      return s[key];
    },
  };
}

// Generic counter-based check used for every task that has `counter` + `target`.
function counterCheck(game, taskDef) {
  if (!taskDef?.counter) return false;
  const cur = (game.ach?.c?.[taskDef.counter] || 0);
  if (cur >= taskDef.target) return true;
  return { progress: Math.min(1, cur / taskDef.target) };
}

// Special handlers for tasks that need extra conditions beyond a single counter.
// `composite: true` in the task data dispatches here.
export const TASK_TICKERS = {
  // T1.4 — Tuneflame finale: all six Glimmers found AND warmth >= target.
  'T1.4': (g, c, h, taskDef) => {
    const allFound = (g.story?.children?.found || []).every(Boolean);
    const happy = g.player?.stats?.happy || 0;
    const target = taskDef?.target || 80;
    if (allFound && happy >= target) return true;
    // Show partial progress on warmth even when not all sparks present.
    return { progress: Math.min(1, happy / target) * (allFound ? 1 : 0.7) };
  },
};

// Default dispatcher: composite tasks → TASK_TICKERS, otherwise counter check.
export function runTaskTicker(taskDef, game, child, helpers) {
  if (taskDef?.composite) {
    const fn = TASK_TICKERS[taskDef.id];
    if (fn) return fn(game, child, helpers, taskDef);
  }
  return counterCheck(game, taskDef);
}
