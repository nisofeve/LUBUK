import { state, battleActive, petSleepActive, lairCareActive, getActiveMyth, getActiveSlot } from './state.js';
import { FOODS, LINE_FOOD_PREFS, line, formLineId, formLineIdFor, formLineFor } from './data.js';
import {
  resolveDemandIndulge, resolveDemandDiscipline, tryEnqueueFoodCareSequence, tryRequestPetSleep,
  startPlayBall, onPetPortraitPointer, careBlocksAdventure, pickSpiritBerry,
} from './care.js';
import { startAdventure } from './combat.js';
import { canEvolve, getEvolvableChoiceKeys, applyDevEvolveToKey } from './evolution.js';
import { els } from './ui.js';

const TICK_MS = 2000;
const PET_INTERVAL_MS = 120000;
const HUNGER_FEED_THRESHOLD = 85;

let intervalId = null;
let enabled = false;
let lastPetAt = 0;

function bestFoodId(myth) {
  if (!state || !state.foodInventory) return null;
  const fLid = myth ? formLineIdFor(myth) : formLineId();
  const prefs = LINE_FOOD_PREFS[fLid] || [];
  for (let i = 0; i < prefs.length; i++) {
    if ((state.foodInventory[prefs[i]] || 0) > 0) return prefs[i];
  }
  const foods = FOODS || [];
  for (let i = 0; i < foods.length; i++) {
    if ((state.foodInventory[foods[i].id] || 0) > 0) return foods[i].id;
  }
  return null;
}

function tick() {
  if (!state || !state.lineId) return;
  if (battleActive || petSleepActive || lairCareActive) return;
  const am = getActiveMyth();
  if (!am || !am.lineId) return;
  const slot = getActiveSlot();

  // 1. Evolve
  if (canEvolve(am)) {
    const L = formLineFor(am);
    const choices = L ? getEvolvableChoiceKeys(L, am.nodeKey, am) : [];
    if (choices.length) { applyDevEvolveToKey(choices[0]); return; }
  }

  // 2. Demand (non-meal): discipline unless happiness is critically low
  if (am.demand && am.demand.kind !== "meal") {
    if ((am.happiness || 0) < 15) {
      resolveDemandIndulge(slot);
    } else {
      resolveDemandDiscipline(slot);
    }
    return;
  }

  // 3. Feed — berry first when ripe, then pantry; keep hunger topped up
  if ((am.demand && am.demand.kind === "meal") || (am.hunger || 0) < HUNGER_FEED_THRESHOLD) {
    if ((am.hunger || 0) < 100 && am.spiritBerryRipeAt != null && Date.now() >= am.spiritBerryRipeAt) {
      pickSpiritBerry();
      return;
    }
    const fid = bestFoodId(am);
    if (fid) { tryEnqueueFoodCareSequence(fid); return; }
  }

  // 4. Rest if energy low
  if ((am.energy || 0) < 30) {
    tryRequestPetSleep(slot);
    return;
  }

  // 5. Pet (throttled to PET_INTERVAL_MS)
  const now = Date.now();
  if (now - lastPetAt >= PET_INTERVAL_MS) {
    lastPetAt = now;
    const p = (slot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
    if (p) {
      const r = p.getBoundingClientRect();
      onPetPortraitPointer({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      return;
    }
  }

  // 6. Play ball
  if (!careBlocksAdventure() && (state.playBalls || 0) > 0 && (state.playCooldownEndAt || 0) <= now) {
    startPlayBall();
    return;
  }

  // 7. Adventure
  if (!careBlocksAdventure() && (am.energy || 0) >= 12) {
    startAdventure();
  }
}

export function startAutoCare() {
  if (intervalId !== null) return;
  intervalId = setInterval(tick, TICK_MS);
  enabled = true;
}

export function stopAutoCare() {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  enabled = false;
  lastPetAt = 0;
}

export function toggleAutoCare() {
  if (enabled) { stopAutoCare(); } else { startAutoCare(); }
}

export function isAutoCareEnabled() {
  return enabled;
}
