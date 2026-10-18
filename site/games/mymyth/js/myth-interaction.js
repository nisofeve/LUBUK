import { state, clamp, petSleepActive, companionSleepActive, battleActive, lairCareActive } from './state.js';

// Lazy accessors to break the combat→myth-interaction→ui→combat circular import
function _els() { return window.__mythEls || {}; }
function _pushLog(msg) { if (window.__mythPushLog) window.__mythPushLog(msg); }
export function setMythInteractionHelpers(els, pushLog) {
  window.__mythEls = els;
  window.__mythPushLog = pushLog;
}

// Proximity thresholds (px in lair-space coordinates)
export const INTERACT_RANGE_PX = 120;
export const MIN_SEPARATION_PX = 80;

// How long myths must be close before auto-interaction triggers (ms)
const PROXIMITY_DWELL_MS = 3000;
// Cooldown between interactions (ms)
const INTERACTION_COOLDOWN_MS = 2.5 * 60 * 1000;

let lastInteractionAt = 0;
let proximityDwellSince = 0;
let interactionActive = false;
let interactionClearT = null;
let _zoneHintState = ""; // "", "ready", "dwelling"
let _zoneHintMood = "";  // "neutral", "harmonious", "irritable", "tired"

// Per-myth mood score 0..100 — aggregates happiness/energy/lifespan, penalised by hunger & low discipline.
export function mythMood(myth) {
  if (!myth || !myth.lineId) return 50;
  const h = myth.happiness != null ? myth.happiness : 50;
  const e = myth.energy != null ? myth.energy : 50;
  const life = myth.lifespan != null ? myth.lifespan : 100;
  const hunger = myth.hunger != null ? myth.hunger : 100;
  const disc = myth.discipline != null ? myth.discipline : 50;
  const base = (h * 0.5) + (e * 0.25) + (life * 0.25);
  const hungerPenalty = hunger < 30 ? (30 - hunger) * 0.4 : 0;
  const discPenalty = disc < 20 ? (20 - disc) * 0.3 : 0;
  return clamp(Math.round(base - hungerPenalty - discPenalty), 0, 100);
}

// Categorise the pair's shared mood for visual hint variance.
function _pairMoodKind(m0, m1) {
  if (!m0 || !m1) return "neutral";
  const h0 = m0.happiness != null ? m0.happiness : 50;
  const h1 = m1.happiness != null ? m1.happiness : 50;
  const e0 = m0.energy != null ? m0.energy : 50;
  const e1 = m1.energy != null ? m1.energy : 50;
  const d0 = m0.discipline != null ? m0.discipline : 50;
  const d1 = m1.discipline != null ? m1.discipline : 50;
  if (d0 < 20 && d1 < 20) return "irritable";
  if (e0 < 35 && e1 < 35) return "tired";
  if (h0 > 75 && h1 > 75) return "harmonious";
  return "neutral";
}

const INTERACTIONS = [
  {
    id: "playfight",
    label: "🐾 Playfight!",
    condition: (m0, m1) => m0.energy > 40 && m1.energy > 40 && m0.happiness > 50 && m1.happiness > 50,
    apply(m0, m1) {
      m0.happiness = clamp(m0.happiness + 5, 0, 100);
      m1.happiness = clamp(m1.happiness + 5, 0, 100);
      m0.energy = clamp(m0.energy - 3, 0, 100);
      m1.energy = clamp(m1.energy - 3, 0, 100);
      return "They tumble and swat at each other — both spirits lifted.";
    },
    animClass: "anim-interact-playfight",
  },
  {
    id: "groom",
    label: "🪮 Grooming",
    condition: (m0, m1) =>
      (m0.happiness < 40 && m1.happiness > 60) || (m1.happiness < 40 && m0.happiness > 60),
    apply(m0, m1) {
      const [low, high] = m0.happiness < m1.happiness ? [m0, m1] : [m1, m0];
      low.happiness = clamp(low.happiness + 8, 0, 100);
      high.discipline = clamp((high.discipline || 0) + 3, 0, 100);
      return "One myth tends to the other — warmth passes between them.";
    },
    animClass: "anim-interact-groom",
  },
  {
    id: "nap",
    label: "💤 Napping together",
    condition: (m0, m1) => m0.energy < 35 && m1.energy < 35,
    apply(m0, m1) {
      m0.energy = clamp(m0.energy + 8, 0, 100);
      m1.energy = clamp(m1.energy + 8, 0, 100);
      return "Both myths curl up together — shared warmth, shared rest.";
    },
    animClass: "anim-interact-nap",
  },
  {
    id: "share_food",
    label: "🍖 Sharing food",
    condition: (m0, m1) =>
      (m0.hunger < 30 && m1.hunger > 70) || (m1.hunger < 30 && m0.hunger > 70),
    apply(m0, m1) {
      const [hungry, full] = m0.hunger < m1.hunger ? [m0, m1] : [m1, m0];
      hungry.hunger = clamp(hungry.hunger + 15, 0, 100);
      return "The well-fed myth nudges food toward the hungry one.";
    },
    animClass: "anim-interact-share",
  },
  {
    id: "spat",
    label: "😤 Territorial spat",
    condition: (m0, m1) => (m0.discipline || 0) < 20 && (m1.discipline || 0) < 20,
    apply(m0, m1) {
      m0.happiness = clamp(m0.happiness - 10, 0, 100);
      m1.happiness = clamp(m1.happiness - 10, 0, 100);
      m0.discipline = clamp((m0.discipline || 0) + 5, 0, 100);
      m1.discipline = clamp((m1.discipline || 0) + 5, 0, 100);
      return "Both myths squabble over territory — neither wins, but both learn.";
    },
    animClass: "anim-interact-spat",
  },
  {
    id: "bond",
    label: "✨ Bond pulse",
    condition: (m0, m1) => m0.happiness > 80 && m1.happiness > 80,
    apply(m0, m1) {
      m0.happiness = clamp(m0.happiness + 6, 0, 100);
      m1.happiness = clamp(m1.happiness + 6, 0, 100);
      const reg = m0.lineId ? _homeRegion(m0.lineId) : null;
      if (reg) {
        m0.influence = m0.influence || {};
        m0.influence[reg] = (m0.influence[reg] || 0) + 2;
      }
      return "A moment of pure connection — both myths radiate warmth.";
    },
    animClass: "anim-interact-bond",
  },
];

const REGION_BY_LINE = { avian: "greek", trickster: "japan", serpent: "sea", guardian: "egypt" };
function _homeRegion(lineId) { return REGION_BY_LINE[lineId] || null; }

function _eligibleInteractions(m0, m1) {
  return INTERACTIONS.filter(function (ev) {
    try { return ev.condition(m0, m1); } catch (e) { return false; }
  });
}

export function checkProximityInteraction(distPx, now) {
  if (!state || !state.companion || !state.companion.lineId) { _setZoneHint(""); return; }
  if (interactionActive) return;
  if (battleActive || petSleepActive || companionSleepActive || lairCareActive) {
    _setZoneHint("");
    proximityDwellSince = 0;
    return;
  }
  const sinceLastMs = now - lastInteractionAt;
  if (sinceLastMs < INTERACTION_COOLDOWN_MS) { _setZoneHint(""); return; }

  // Check if at least one interaction is eligible right now
  const eligible = _eligibleInteractions(state, state.companion);
  if (!eligible.length) { _setZoneHint(""); proximityDwellSince = 0; return; }

  const mood = _pairMoodKind(state, state.companion);
  if (distPx < INTERACT_RANGE_PX) {
    if (proximityDwellSince === 0) proximityDwellSince = now;
    _setZoneHint("dwelling", mood);
    if (now - proximityDwellSince >= PROXIMITY_DWELL_MS) {
      proximityDwellSince = 0;
      _setZoneHint("", "");
      _triggerAutoInteraction();
    }
  } else {
    proximityDwellSince = 0;
    _setZoneHint("ready", mood);
  }
}

function _setZoneHint(kind, mood) {
  if (_zoneHintState === kind && _zoneHintMood === (mood || "")) return;
  _zoneHintState = kind;
  _zoneHintMood = mood || "";
  const zone = _els().mythInteractionZone;
  if (!zone) return;
  if (interactionActive) return;
  zone.classList.remove("ready", "dwelling");
  if (kind) zone.classList.add(kind);
  if (mood) zone.setAttribute("data-mood", mood);
  else zone.removeAttribute("data-mood");
}

/** Is the lair currently in a state where we should leave auto-interactions alone? */
function _lairBusy() {
  return battleActive || petSleepActive || companionSleepActive || lairCareActive;
}

/** Whether we should nudge one myth toward the other this frame — used by idle pathing. */
export function shouldSteerTowardCompanion(now) {
  if (!state || !state.companion || !state.companion.lineId) return false;
  if (interactionActive || _lairBusy()) return false;
  if (now - lastInteractionAt < INTERACTION_COOLDOWN_MS) return false;
  const eligible = _eligibleInteractions(state, state.companion);
  if (!eligible.length) return false;
  return true;
}

function _triggerAutoInteraction() {
  const m0 = state;
  const m1 = state.companion;
  const eligible = _eligibleInteractions(m0, m1);
  if (!eligible.length) return;
  const ev = _weightedPick(eligible, m0, m1);
  _runInteraction(ev, m0, m1);
}

// Positive interactions are weighted up for high-mood pairs; spat is weighted down unless both
// genuinely low-discipline and low-happiness.
const POSITIVE_IDS = { playfight: 1, groom: 1, nap: 1, share_food: 1, bond: 1 };
function _weightedPick(list, m0, m1) {
  const pairMood = (mythMood(m0) + mythMood(m1)) / 2;
  const weights = list.map(function (ev) {
    if (ev.id === "bond") return 1 + Math.max(0, (pairMood - 60) / 10);
    if (ev.id === "spat") return Math.max(0.25, 1 - (pairMood / 100));
    if (POSITIVE_IDS[ev.id]) return 1 + Math.max(0, (pairMood - 40) / 40);
    return 1;
  });
  const total = weights.reduce(function (a, b) { return a + b; }, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

export function triggerManualPlay() {
  if (!state || !state.companion || !state.companion.lineId) return false;
  if (interactionActive) return false;
  if ((state.playBalls || 0) < 1) return false;
  state.playBalls = Math.max(0, (state.playBalls || 0) - 1);
  const ev = INTERACTIONS.find(function (e) { return e.id === "playfight"; });
  _runInteraction(ev, state, state.companion);
  return true;
}

/**
 * Player-initiated duo bond. Bypasses the cooldown and always picks a positive interaction,
 * preferring "bond" when both happy>70, falling back to "groom". Returns one of:
 *   "ok"           — ran an interaction
 *   "no_companion" — companion slot empty
 *   "lair_busy"    — sleep/battle/care in progress
 *   "too_far"      — myths aren't close enough
 *   "no_balls"     — not enough play balls
 *   "active"       — interaction already running
 */
export function triggerDuoBond(distPx) {
  if (!state || !state.companion || !state.companion.lineId) return "no_companion";
  if (interactionActive) return "active";
  if (_lairBusy()) return "lair_busy";
  if ((state.playBalls || 0) < 1) return "no_balls";
  if (distPx != null && distPx > INTERACT_RANGE_PX * 1.2) return "too_far";
  state.playBalls = Math.max(0, (state.playBalls || 0) - 1);
  const m0 = state;
  const m1 = state.companion;
  let ev;
  if (m0.happiness > 70 && m1.happiness > 70) {
    ev = INTERACTIONS.find(function (e) { return e.id === "bond"; });
  } else {
    ev = INTERACTIONS.find(function (e) { return e.id === "groom"; });
    // Groom's default condition requires a happiness gap — if neither side is low, force an equal share.
    if (ev && !ev.condition(m0, m1)) {
      ev = {
        id: "groom-forced",
        label: ev.label,
        apply: function (a, b) {
          a.happiness = clamp(a.happiness + 5, 0, 100);
          b.happiness = clamp(b.happiness + 5, 0, 100);
          return "They nuzzle in close — a chosen moment of tenderness.";
        },
        animClass: ev.animClass,
      };
    }
  }
  if (!ev) return "active";
  _runInteraction(ev, m0, m1);
  return "ok";
}

/** Is a duo bond currently possible? Used to enable/disable the Bond button. */
export function canDuoBond() {
  if (!state || !state.companion || !state.companion.lineId) return false;
  if (interactionActive || _lairBusy()) return false;
  if ((state.playBalls || 0) < 1) return false;
  return true;
}

function _runInteraction(ev, m0, m1) {
  interactionActive = true;
  lastInteractionAt = Date.now();
  const result = ev.apply(m0, m1);
  _pushLog(ev.label + " — " + result);
  _showInteractionAnim(ev.animClass);
  if (interactionClearT) clearTimeout(interactionClearT);
  interactionClearT = setTimeout(function () {
    interactionActive = false;
    _hideInteractionAnim();
  }, 2500);
}

function _showInteractionAnim(animClass) {
  const zone = _els().mythInteractionZone;
  if (!zone) return;
  zone.className = "myth-interaction-zone open " + (animClass || "");
  _zoneHintState = "";
}

function _hideInteractionAnim() {
  const zone = _els().mythInteractionZone;
  if (!zone) return;
  zone.classList.remove("open");
  _zoneHintState = "";
}

export function isInteractionActive() { return interactionActive; }
