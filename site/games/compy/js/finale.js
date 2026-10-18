// ============================================================
// finale.js — director script for "She Remembered" (Phase 5).
//
// Trigger check (one-shot per profile, fires at the next dawn):
//   • all 10 Memory Shards collected
//   • all 6 Glimmer bond meters at 4/4
//   • player level ≥ 45
//   • finale not yet triggered (legacyStory.finaleTriggered)
//
// Stages:
//   0 IDLE        — pre-trigger
//   1 GATHERING   — Glimmers walk to circle around the Hearth (~12s)
//   2 CIRCLE      — seated half-circle, Glimmers tappable for final lines
//   3 MONOLOGUE   — the Hearth's multi-paragraph speech (auto-advances by line)
//   4 SHARD10     — name input if not already done; otherwise skipped
//   5 ENDING      — Stay / Go Home choice
//   6 COMPLETE
// ============================================================

import { CHILDREN } from '../data/children_data.js';

const STAGE = {
  IDLE:      'IDLE',
  GATHERING: 'GATHERING',
  CIRCLE:    'CIRCLE',
  MONOLOGUE: 'MONOLOGUE',
  SHARD10:   'SHARD10',
  ENDING:    'ENDING',
  COMPLETE:  'COMPLETE',
};

// ── The Hearth's monologue, broken into one paragraph per panel line.
// StoryPanel.monologue auto-advances 5s per line; total ≈ 50s here.
const MONOLOGUE_LINES = [
  'I\'ve been thinking.',
  'You came here because you forgot yourself.',
  'And you found — what?',
  'Six little sparks that needed you.',
  'A fire that wouldn\'t go out.',
  'A world that got brighter the more you paid attention.',
  'You spent years learning how to build things that hold.',
  'How space shapes the people inside it.',
  'How a single line, drawn with intention, can carry meaning for a lifetime.',
  'Look at what you built here.',
  'That\'s not a dream.',
  'That\'s your life.',
  'Come home.',
  'We\'re all here.',
  'We\'ve been here.',
];

// Children's final tap lines per GDD Final Scene table.
const CHILD_FINAL_LINES = {
  CHILD_1: '"You came to me first. I won\'t forget that."',
  CHILD_2: '"I cleared the path. You just had to walk it."',
  CHILD_3: '"I\'ve been drawing this whole time. I want to show you. When we\'re home, will you teach me properly?"',
  CHILD_4: '"I\'m just sitting here. You don\'t have to do anything. Neither do I."',
  CHILD_5: '"I knew you\'d figure it out. I always knew."',
  CHILD_6: '"You came back. You always come back."',
};

export class FinaleDirector {
  constructor(game) {
    this.game     = game;
    this.stage    = STAGE.IDLE;
    this.timer    = 0;
    this._queued  = false;       // set when trigger conditions met; fires next dawn
    this._lastCheckedDay = 0;
  }

  // Called every frame from game.update().
  update(dt) {
    if (!this.game.legacyStory) return;
    if (this.stage === STAGE.IDLE) {
      // Trigger check on day-rollover (cheap, single-shot per dawn).
      const dc = this.game.time?.dayCount || 1;
      if (dc !== this._lastCheckedDay && this.game.time?.phase === 'Day') {
        this._lastCheckedDay = dc;
        this._checkTrigger();
      }
      if (this._queued) {
        this._beginGathering();
      }
      return;
    }

    this.timer += dt;

    if (this.stage === STAGE.GATHERING) {
      // Per-Glimmer arrival check: trigger a one-shot flash when a spark first
      // reaches their formation slot.
      for (const c of this.game.children?.list || []) {
        if (c.phase !== 'PRESENT' || !c._finaleTarget) continue;
        const inSlot = Math.hypot(c.x - c._finaleTarget.x, c.y - c._finaleTarget.y) < 0.6;
        if (inSlot && !c._finaleArrived) {
          c._finaleArrived    = true;
          c._finaleFlashTimer = 0.6;
        }
      }
      // Advance once all are seated (or after the safety timeout).
      const arrived = this.game.children?.list.every(c => c._finaleArrived);
      if (arrived || this.timer > 30) this._beginCircle();
    }
  }

  // ── Trigger ───────────────────────────────────────────────────────────
  _checkTrigger() {
    const g = this.game;
    if (g.legacyStory.finaleTriggered) return;
    const allShards = (g.legacyStory.shards || []).slice(0, 9).every(Boolean);
    const allBonds  = (g.story?.children?.bond || []).every(Boolean);
    const lv45      = (g.player?.stats?.level || 0) >= 45;
    const allFound  = (g.story?.children?.found || []).every(Boolean);
    if (allShards && allBonds && lv45 && allFound) {
      this._queued = true;
    }
  }

  // ── Stage 1 — Gathering ───────────────────────────────────────────────
  _beginGathering() {
    this.stage  = STAGE.GATHERING;
    this.timer  = 0;
    this._queued = false;
    const game  = this.game;

    // Force the campfire to its Crown Flame visual (regardless of upgrade flags).
    if (game.story?.campfire?.upgrades) game.story.campfire.upgrades[5] = true;
    if (game.campfire) game.campfire.pulseForName = false;     // suppress competing pulses
    if (game.campfire) game.campfire.pulseForTend = false;

    // Suspend nightmare spawns + clear the field for the duration of the scene.
    game._finaleSuspendNightmares = true;
    game.nightmares = [];
    game._nightmareWarnings = [];

    // Assign each child a circle slot around the campfire — half-circle facing player.
    // Order: youngest closest to player, eldest farthest. Half-circle radius ~2.5 tiles.
    const slotOrder = [5, 4, 3, 2, 1, 0];                       // C6 → C1
    const baseAngle = -Math.PI;                                  // start to the left
    const arc       = Math.PI;                                   // 180° arc
    for (let i = 0; i < slotOrder.length; i++) {
      const childIdx = slotOrder[i];
      const c = game.children?.list?.[childIdx];
      if (!c) continue;
      // If a child wasn't found yet, force them into PRESENT at the target location.
      if (c.phase !== 'PRESENT') {
        c.phase = 'PRESENT';
        c.setPos(0, 0);
        if (game.story?.children?.found) game.story.children.found[childIdx] = true;
      }
      const angle = baseAngle + (i / (slotOrder.length - 1)) * arc;
      const r     = 2.6;
      c._finaleTarget = { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    }

    // HUD fade — drop opacity to 20% so the scene reads as cinematic.
    document.body.classList.add('finale-active');
    // Low sustained ambient chord plays under the entire scene; stop fn captured.
    this._ambientStop = window.StoryAudio?.playFinaleAmbient?.(0.7);
  }

  // ── Stage 2 — Circle (children seated, can be tapped for final lines) ─
  _beginCircle() {
    this.stage = STAGE.CIRCLE;
    this.timer = 0;
    // Float a one-time hint over the campfire.
    window.StoryPanel?.show({
      kind: 'bubble', icon: '✦',
      lines: ['Tap each spark if you wish. The Hearth is waiting.'],
      dismissDelay: 7000,
    });
    // Wait ~25 seconds for taps; if none happen the monologue starts anyway.
    this._circleWait = setTimeout(() => this._beginMonologue(), 25000);
    // Allow the player to skip the wait by tapping the campfire — handled in main.js.
    this.game._finaleAllowSkip = true;
  }

  // Tap dispatcher exported so main.js can route taps during the circle stage.
  // Returns true if consumed.
  handleChildTap(childIdx) {
    if (this.stage !== STAGE.CIRCLE) return false;
    const c = this.game.children?.list?.[childIdx];
    if (!c) return false;
    const def = CHILDREN[childIdx];
    const line = CHILD_FINAL_LINES[def.id] || def.bondLine;
    window.StoryPanel?.show({
      kind: 'bubble', icon: c.icon, lines: [line], dismissDelay: 5000,
      voiceSeed: childIdx,
    });
    return true;
  }
  handleCampfireTap() {
    if (this.stage === STAGE.CIRCLE) {
      clearTimeout(this._circleWait);
      this._beginMonologue();
      return true;
    }
    return false;
  }

  // ── Stage 3 — Campfire monologue ──────────────────────────────────────
  _beginMonologue() {
    this.stage = STAGE.MONOLOGUE;
    this.timer = 0;
    this.game._finaleAllowSkip = false;
    window.StoryPanel?.show({
      kind: 'monologue',
      lines: MONOLOGUE_LINES,
      dismissDelay: MONOLOGUE_LINES.length * 5000,
    }).then(() => this._afterMonologue());
  }

  _afterMonologue() {
    // Stage 4 — Shard 10 if not yet collected.
    const shard10 = !!this.game.legacyStory?.shards?.[9];
    if (!shard10) {
      this.stage = STAGE.SHARD10;
      // Force the alt-trigger which will fire shard 10 + name input.
      this.game.shardSystem?._unlock?.(9, 'finale');
      // Wait for the name input to resolve before showing endings.
      const wait = () => {
        if (this.game.story?.flags?.nameInputArmed) {
          setTimeout(wait, 600);
        } else {
          this._beginEnding();
        }
      };
      setTimeout(wait, 4000);
    } else {
      this._beginEnding();
    }
  }

  // ── Stage 5 — Ending choice ───────────────────────────────────────────
  _beginEnding() {
    this.stage = STAGE.ENDING;
    window.StoryPanel?.show({
      kind: 'tend',
      icon: '🌟',
      title: 'Two endings. Both yours.',
      lines: ['Stay a while longer, or go home. There is no wrong choice.'],
      buttons: [
        { label: 'Stay a while longer.', variant: 'secondary', value: 'light' },
        { label: 'Go home.',             variant: 'primary',   value: 'home'  },
      ],
    }).then((choice) => this._chooseEnding(choice));
  }

  _chooseEnding(choice) {
    const game = this.game;
    if (!game.legacyStory) return;
    game.legacyStory.finaleTriggered = true;
    // Stop the ambient chord either way before the ending takes over.
    if (typeof this._ambientStop === 'function') { try { this._ambientStop(); } catch (e) {} }
    if (choice === 'home' || choice === 'btn-1') {
      game.legacyStory.ending = 'home';
      game._commitLegacyStory?.();
      game.ach?.set?.('ending_home', 1);
      this._endingHome();
    } else {
      game.legacyStory.ending = 'light';
      game._commitLegacyStory?.();
      game.ach?.set?.('ending_light', 1);
      this._endingLight();
    }
    this.stage = STAGE.COMPLETE;
  }

  // ── Ending A — "Stay a while longer." ─────────────────────────────────
  _endingLight() {
    const game = this.game;
    // Lock peaceful mode: nightmares disabled, palette locked, children stay.
    game._endingPeaceful = true;
    game._finaleSuspendNightmares = true;
    // Release children from finale formation; they wander normally now.
    for (const c of game.children?.list || []) c._finaleTarget = null;
    document.body.classList.remove('finale-active');
    document.body.classList.add('ending-light');
    window.StoryPanel?.show({
      kind: 'bubble', icon: '👑',
      lines: ['"She kept the light."'],
      dismissDelay: 5000,
    });
    // Show the small crown badge in the HUD corner.
    const hud = document.getElementById('hud-top');
    if (hud && !document.getElementById('ending-crown')) {
      const c = document.createElement('div');
      c.id = 'ending-crown';
      c.textContent = '👑';
      c.title = 'She kept the light.';
      hud.appendChild(c);
    }
  }

  // ── Ending B — "Go home." ─────────────────────────────────────────────
  _endingHome() {
    const game = this.game;
    const name = game.legacyStory?.campfireName || 'her name';
    const days = game.time?.dayCount || 0;
    // Stat snapshot for the credits text. Pull from achievement counters.
    const cooked = game.ach?.c?.cook_total || 0;
    const nights = (game.legacyStory?.reincarnation?.count || 0)
                 + Math.max(0, (game.time?.dayCount || 1) - 1);
    const lines = [
      `She made ${cooked} meals.`,
      `She survived ${nights} nights.`,
      'She found all six of them.',
      'She put the brush down for a while.',
      'She picked it back up.',
      `She remembered ${name}.`,
      'She kept the light.',
    ];
    document.body.classList.remove('finale-active');
    document.body.classList.add('ending-home');
    window.StoryAudio?.playCreditsFade?.(0.9);
    window.StoryPanel?.show({
      kind: 'credits',
      lines,
      dismissDelay: lines.length * 1300 + 4000,
    }).then(() => {
      // Soft fade back to the start menu.
      document.body.classList.remove('ending-home');
      window._showStartMenu?.();
    });
  }
}
