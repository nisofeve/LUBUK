import { LINES, line, formLine, formLineId, nodeByKey, getCurrentNode } from './data.js';
import { combatStatsForPet } from './combat.js';

export let state = null;
export let defaultStateTemplate = null;
export let pendingReincarnationBonus = null;
export let pendingReincarnationInventory = null;
/** Companion myth (slot 1) snapshot stashed when slot 0 dies, so slot 1 isn't wiped on rebirth. */
export let pendingCompanionCarry = null;
export let developerMode = false;
export let treeUnlockedByLine = {};
export let treeLoreModalKey = null;
export let treeLoreModalLineId = null;
export let foodChoiceExtraCallback = null;
export let pendingRelicConsumeId = null;
export let battleActive = false;
export let petSleepActive = false;
export let lairCareActive = false;

// v2: companion sleep state (slot 0 uses petSleepActive above)
export let companionSleepActive = false;
export function setCompanionSleepActive(v) { companionSleepActive = v; }

export function setState(s) { state = s; }
export function setDefaultStateTemplate(t) { defaultStateTemplate = t; }
export function setPendingReincarnationBonus(b) { pendingReincarnationBonus = b; }
export function setPendingReincarnationInventory(inv) { pendingReincarnationInventory = inv; }
export function setPendingCompanionCarry(c) { pendingCompanionCarry = c; }
export function setDeveloperMode(v) { developerMode = v; }
export function setTreeLoreModalKey(k) { treeLoreModalKey = k; }
export function setTreeLoreModalLineId(lid) { treeLoreModalLineId = lid; }
export function setFoodChoiceExtraCallback(fn) { foodChoiceExtraCallback = fn; }
export function setPendingRelicConsumeId(id) { pendingRelicConsumeId = id; }
export function setBattleActive(v) { battleActive = v; }
export function setPetSleepActive(v) { petSleepActive = v; }
export function setLairCareActive(v) { lairCareActive = v; }

/* ── v2 two-myth helpers ── */

/**
 * Returns the myth object for a given slot.
 * Slot 0 → primary myth (state itself, minus companion/shared fields).
 * Slot 1 → state.companion (null if not unlocked).
 */
export function getMythBySlot(slot) {
  if (!state) return null;
  if (slot === 1) return state.companion || null;
  return state;
}

export function isSlotActive(slot) {
  const m = getMythBySlot(slot);
  return !!(m && m.lineId);
}

/** Returns the myth the user has selected in the lair (slot 0 or 1).
 *  Falls back to slot 0 if the companion isn't set up yet. */
export function getActiveSlot() {
  if (!state) return 0;
  const slot = state.activeMythTab || 0;
  if (slot === 1 && state.companion && state.companion.lineId) return 1;
  return 0;
}

export function getActiveMyth() {
  if (!state) return null;
  return getActiveSlot() === 1 ? state.companion : state;
}

/* ── per-myth temperament (movement personality) ───────────────────────────
 * Each myth gets a stable temperament vector that nudges idle pacing so two
 * myths in the same lair don't tick in lockstep. Values in [0..1].
 *   tempo         — walking speed (slow ↔ brisk)
 *   restiness     — how often / how long they hold still
 *   social        — pull toward companion when interaction eligible
 *   curiosity     — likelihood of glancing/looking around at idle ends
 *   expressiveness — happy-jump frequency / mood pop frequency
 *
 * Lineage gives the centre; a per-myth ±20% jitter prevents twins. */
const TEMPERAMENT_LINEAGE_DEFAULTS = {
  avian:     { tempo: 0.70, restiness: 0.30, social: 0.55, curiosity: 0.65, expressiveness: 0.80 },
  trickster: { tempo: 0.55, restiness: 0.40, social: 0.60, curiosity: 0.85, expressiveness: 0.65 },
  serpent:   { tempo: 0.35, restiness: 0.65, social: 0.50, curiosity: 0.45, expressiveness: 0.40 },
  guardian:  { tempo: 0.50, restiness: 0.55, social: 0.70, curiosity: 0.40, expressiveness: 0.50 },
};

function _jitter(v) {
  return Math.max(0, Math.min(1, v + (Math.random() * 0.4 - 0.2)));
}

export function ensureMythTemperament(myth) {
  if (!myth || !myth.lineId) return null;
  if (myth.temperament && typeof myth.temperament === "object" && myth.temperament.tempo != null) {
    return myth.temperament;
  }
  const base = TEMPERAMENT_LINEAGE_DEFAULTS[myth.lineId] || { tempo: 0.5, restiness: 0.5, social: 0.55, curiosity: 0.55, expressiveness: 0.55 };
  myth.temperament = {
    tempo: _jitter(base.tempo),
    restiness: _jitter(base.restiness),
    social: _jitter(base.social),
    curiosity: _jitter(base.curiosity),
    expressiveness: _jitter(base.expressiveness),
  };
  return myth.temperament;
}

export function mythTemperament(myth) {
  if (!myth) return { tempo: 0.5, restiness: 0.5, social: 0.55, curiosity: 0.55, expressiveness: 0.55 };
  return myth.temperament || ensureMythTemperament(myth) || { tempo: 0.5, restiness: 0.5, social: 0.55, curiosity: 0.55, expressiveness: 0.55 };
}

/** Build a fresh per-myth object from the defaultStateTemplate for a new companion. */
export function newCompanionSlot(lineId) {
  if (!defaultStateTemplate || !lineId) return null;
  const base = JSON.parse(JSON.stringify(defaultStateTemplate));
  // Strip shared fields — they live on state root
  delete base.foodInventory;
  delete base.relicInventory;
  delete base.playBalls;
  delete base._v2;
  delete base.companion;
  delete base.activeMythTab;
  delete base.slot2Unlocked;
  base.lineId = lineId;
  base.log = [];
  return base;
}

/** Migrate an old (pre-v2) saved state snapshot to v2 format in-place. */
export function migrateStateV2(snap) {
  if (!snap || !snap.state) return snap;
  if (snap.state._v2) return snap; // already v2
  snap.state._v2 = true;
  snap.state.companion = null;
  snap.state.activeMythTab = 0;
  snap.state.slot2Unlocked = false;
  return snap;
}

/** Unlock the companion slot with a chosen lineId. */
export function unlockCompanionSlot(lineId) {
  if (!state) return false;
  if (state.companion && state.companion.lineId) return false; // already occupied
  const companion = newCompanionSlot(lineId);
  if (!companion) return false;
  state.companion = companion;
  state.slot2Unlocked = true;
  ensureMythTemperament(companion);
  return true;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SAVE_STATE_KEY = "myMythSaveState";
const SAVE_REINCARNATION_KEY = "myMythReincarnation";
const TREE_UNLOCK_STORAGE_KEY = "myMythTreeUnlocks";

export function loadTreeUnlocksFromStorage() {
  try {
    const raw = localStorage.getItem(TREE_UNLOCK_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      treeUnlockedByLine = parsed;
    }
  } catch (e) {}
}

export function saveTreeUnlocksToStorage() {
  try {
    localStorage.setItem(TREE_UNLOCK_STORAGE_KEY, JSON.stringify(treeUnlockedByLine));
  } catch (e) {}
}

let _onCloudSave = null;
export function setOnCloudSaveHook(fn) { _onCloudSave = fn; }

export function saveGameState() {
  if (!state || !state.lineId) return;
  try {
    state._v2 = true; // stamp v2 on every save
    const snapshot = {
      state: state,
      reincarnationBonus: pendingReincarnationBonus || null,
      reincarnationInventory: pendingReincarnationInventory || null,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_STATE_KEY, JSON.stringify(snapshot));
  } catch (e) {}
  if (_onCloudSave) try { _onCloudSave(); } catch (e) {}
}

export function saveReincarnationState() {
  try {
    const snap = {
      reincarnationBonus: pendingReincarnationBonus || null,
      reincarnationInventory: pendingReincarnationInventory || null,
      companionCarry: pendingCompanionCarry || null,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_REINCARNATION_KEY, JSON.stringify(snap));
    localStorage.removeItem(SAVE_STATE_KEY);
  } catch (e) {}
}

export function clearSaveState() {
  try {
    localStorage.removeItem(SAVE_STATE_KEY);
    localStorage.removeItem(SAVE_REINCARNATION_KEY);
  } catch (e) {}
}

export function loadSavedGame() {
  try {
    var raw = localStorage.getItem(SAVE_STATE_KEY);
    if (raw) {
      var snap = JSON.parse(raw);
      if (snap && snap.state && snap.state.lineId && LINES[snap.state.lineId]) {
        snap = migrateStateV2(snap);
        return { kind: "game", snapshot: snap };
      }
    }
    var reincRaw = localStorage.getItem(SAVE_REINCARNATION_KEY);
    if (reincRaw) {
      var rsnap = JSON.parse(reincRaw);
      if (rsnap) {
        if (rsnap.companionCarry) pendingCompanionCarry = rsnap.companionCarry;
        return { kind: "reincarnation", snapshot: rsnap };
      }
    }
  } catch (e) {}
  return null;
}

export function isTreeNodeUnlocked(lineId, nodeKey) {
  if (!lineId || !nodeKey) return false;
  if (
    developerMode &&
    LINES &&
    LINES[lineId] &&
    nodeByKey(LINES[lineId], nodeKey)
  ) {
    return true;
  }
  const bag = treeUnlockedByLine[lineId];
  return !!(bag && bag[nodeKey]);
}

export function unlockTreeNode(lineId, nodeKey) {
  if (!lineId || !nodeKey) return;
  if (!treeUnlockedByLine[lineId]) treeUnlockedByLine[lineId] = {};
  if (treeUnlockedByLine[lineId][nodeKey]) return;
  treeUnlockedByLine[lineId][nodeKey] = true;
  saveTreeUnlocksToStorage();
}

export function legacyScoreFromMyth(myth) {
  if (!myth || !myth.lineId) return 0;
  const fLid = myth.crossLineageId || myth.lineId;
  const L = LINES[fLid];
  const node = L && getCurrentNode(L, myth.nodeKey);
  const stage = node ? node.stage : 0;
  const st = combatStatsForPet(fLid, myth.nodeKey);
  const bpNorm = Math.min(1.35, st.combatBp / 100);
  const happy = (myth.happiness != null ? myth.happiness : 50) / 100;
  const bat = Math.min(1.2, (myth.battles || 0) / 40);
  const disc = (myth.discipline != null ? myth.discipline : 0) / 100;
  return stage * 22 + bpNorm * 28 + happy * 18 + bat * 14 + disc * 12;
}

export function legacyScoreFromState() {
  return legacyScoreFromMyth(state);
}

export function legacyEpigraph(score) {
  const lines = [
    "A faint ember returns to the dark, having scarcely learned its own name.",
    "Brief was the song, yet even echoes leave a hollow the wind remembers.",
    "It walked further than most and left marks the rain has not yet washed away.",
    "A worthy myth — the tales it carried will outlast the teller.",
    "From hatchling to herald, this myth blazed a trail that legends will trace in quiet awe.",
  ];
  const idx = Math.min(lines.length - 1, Math.floor(score / 20));
  return lines[idx];
}

export function legacyMedals(score) {
  const m = [];
  if (score >= 18) m.push({ emoji: "🎗️", label: "Endurance" });
  if (score >= 38) m.push({ emoji: "⚔️", label: "Valor" });
  if (score >= 58) m.push({ emoji: "🌟", label: "Ascendant" });
  if (score >= 78) m.push({ emoji: "👑", label: "Myth-forged" });
  return m.length ? m : [{ emoji: "🕯️", label: "Remembrance" }];
}

export function computeReincarnationBonus(score) {
  const hp = Math.max(0, Math.round(1 + score * 0.14));
  const atk = Math.max(0, Math.round(score * 0.06));
  const spd = Math.max(0, Math.round(1 + score * 0.09));
  return { hp: hp, atk: atk, spd: spd };
}

let devKonamiPhase = 0;
let devKonamiCount = 0;
let devKonamiTimer = null;

export function resetDevKonami() {
  devKonamiPhase = 0;
  devKonamiCount = 0;
  if (devKonamiTimer) {
    clearTimeout(devKonamiTimer);
    devKonamiTimer = null;
  }
}

export function resetDeveloperSessionFlags() {
  developerMode = false;
  resetDevKonami();
}

export function armDevKonamiIdleTimeout() {
  if (devKonamiTimer) clearTimeout(devKonamiTimer);
  devKonamiTimer = setTimeout(function () {
    devKonamiTimer = null;
    resetDevKonami();
  }, 4000);
}

export function isDevKonamiPortraitPhase() {
  return !developerMode && devKonamiPhase === 1;
}

export function devKonamiTap(which, openDevModeEntryModalFn) {
  if (developerMode) return;
  if (!state || !state.lineId) return;
  if (battleActive) return;
  armDevKonamiIdleTimeout();
  // Sequence: 3× lair → 4× portrait (empty spot) → 2× lair
  if (devKonamiPhase === 0) {
    if (which !== "lair") { resetDevKonami(); return; }
    devKonamiCount++;
    if (devKonamiCount >= 3) { devKonamiPhase = 1; devKonamiCount = 0; }
    return;
  }
  if (devKonamiPhase === 1) {
    if (which !== "portrait") { resetDevKonami(); return; }
    devKonamiCount++;
    if (devKonamiCount >= 4) { devKonamiPhase = 2; devKonamiCount = 0; }
    return;
  }
  if (devKonamiPhase === 2) {
    if (which !== "lair") { resetDevKonami(); return; }
    devKonamiCount++;
    if (devKonamiCount >= 2) { resetDevKonami(); openDevModeEntryModalFn(); }
  }
}
