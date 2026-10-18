import { state, battleActive, petSleepActive, setPetSleepActive, companionSleepActive, setCompanionSleepActive, lairCareActive, setLairCareActive, setBattleActive, developerMode, pendingReincarnationBonus, setPendingReincarnationBonus, pendingReincarnationInventory, setPendingReincarnationInventory, pendingCompanionCarry, setPendingCompanionCarry, foodChoiceExtraCallback, setFoodChoiceExtraCallback, pendingRelicConsumeId, setPendingRelicConsumeId, defaultStateTemplate, setState, clamp, escapeHtml, saveGameState, saveReincarnationState, resetDeveloperSessionFlags, legacyScoreFromState, legacyScoreFromMyth, computeReincarnationBonus, legacyEpigraph, legacyMedals, getMythBySlot, isSlotActive } from './state.js';
import { REGIONS, REGION_LABEL, REGION_COLOR, FOODS, FOOD_BY_ID, RELIC_ITEMS, RELIC_BY_ID, LINE_FOOD_PREFS, EVOLVE_RULES, LINES, line, nodeByKey, getCurrentNode, ensureFoodInventoryState, ensureRelicInventoryState, petArtHtml, randomLineId } from './data.js';
import { els, pushLog, renderPet, renderLog, renderInfluence, setBar, closeLairSubpanels, pickLineCards, renderCombatStatsPanel } from './ui.js';
import { resumeBattleAudioIfNeeded, playMythHappySfx, playMythSadSfx, playMythMoodSfxForDelta, playMythEatSfx, playMythRefuseFoodSfx, playMythCuriousSfx, playDemandAttentionCallSfx, playPetFurryClickSfx, playLairRelicInfluenceBurstSfx, playAdventureRunFootstepSfx, startLairDropContinuousSfx, stopLairAmbient, stopAdventureBattleBgm, playMythAngrySfx, playLairDropThudSfx, playLairMunchBurstSfx, playMythTiredSfx, playBallKickSfx, playBallBounceSfx, stopCityMapBgm } from './audio.js';
import { canEvolve } from './evolution.js';
import { recordMythDeath } from './legacy-timeline.js';
import { awardXp, incrementStat } from './player-profile.js';
import { showLevelUpIfNeeded } from './online-ui.js';
import { checkAchievement, incrementAchievement, checkTieredAchievements, setAchievementValue } from './achievements.js';
import { combatStatsForPet, restartPetIdle, stopPetIdle, setIdleWalkTarget, triggerPetAnim, flashPetMoodPopup, spawnPetEatVfx, spawnPetRefuseEatVfx, flashPetMoodForConsumedFoodTier, flashPortraitDisciplineHit, flashPetMoodForConsumedRelic, flashPetJealousy } from './combat.js';

const HUNGRY_JEALOUSY_THRESHOLD = 20;

function _maybeFlashOtherMythJealousy(activeSlot) {
  const otherSlot = activeSlot === 1 ? 0 : 1;
  const otherMyth = otherSlot === 1
    ? (state.companion && state.companion.lineId ? state.companion : null)
    : (state.lineId ? state : null);
  if (!otherMyth) return;
  if ((otherMyth.hunger || 0) > HUNGRY_JEALOUSY_THRESHOLD) return;
  const otherPortrait = otherSlot === 1 ? els.petPortraitCompanion : els.petPortrait;
  if (!otherPortrait) return;
  flashPetJealousy(otherPortrait);
}

/* ── module-level mutable state (internal) ── */

let petSleepRaf = null;
let petSleepClickCount = 0;
let petSleepAwaitingForce = false;
let petAngryOverlayEndTime = 0;
let petAngryOverlayClearT = null;
let lastPetSleepFrameTime = 0;
let _sleepingSlot = 0;
let hungerPassiveIntervalId = null;
let lifespanDemandIntervalId = null;
let demandSpawnSeq = 0;
let demandResponseTimeoutId = null;
let demandWindowTickId = null;
let demandWindowEndsAt = 0;
let demandWindowToken = 0;
let demandAttentionTimeoutId = null;
let demandJumpClearTimeoutId = null;
let lastMoodPopupAt = 0;
let petMoodPopupClearT = null;
let petTiredShakeClearT = null;
let spiritBerryRipenTimeoutId = null;
let spiritBerryTickIntervalId = null;
let spiritBerryUiPhase = null;
let careSequenceQueue = [];
let careSequenceActive = false;
let careSequenceCurrentJobKind = null;
let pendingPantryCareItems = [];
let pendingRelicCareItems = [];
let careChaseX = 0;
let careApproachY = 0;
let _careTargetSlot = 0;
let _activeLairPortrait = null;

export function setCareTargetSlot(slot) {
  if (slot == null) slot = state ? (state.activeMythTab || 0) : 0;
  _careTargetSlot = (slot === 1 && state && state.companion && state.companion.lineId) ? 1 : 0;
}
// Expose so ui.switchMythTab can sync without a circular import
if (typeof window !== "undefined") window.__syncCareTargetSlot = setCareTargetSlot;
function _lairPortrait() { return _activeLairPortrait || els.petPortrait; }
function _targetMyth() { return _careTargetSlot === 1 && state.companion && state.companion.lineId ? state.companion : state; }
function _targetMythLineId() { const m = _targetMyth(); return (m.crossLineageId || m.lineId) || (state.crossLineageId || state.lineId); }
let lastPettingHappinessAt = 0;
let lastPettingCooldownLogAt = 0;

export function resetPettingCooldown() {
  lastPettingHappinessAt = 0;
  lastPettingCooldownLogAt = 0;
}
let lairEmptyClickCount = 0;
let lairEmptyClickAnchorX = 0;
let lairEmptyClickAnchorY = 0;
let lairEmptyClickLastAt = 0;
let lairCuriousVfxClearT = 0;
let adventureIntroFootIntervalId = null;
let adventureIntroDustIntervalId = null;

let playBallActive = false;
let playCooldownIntervalId = null;

let idleX = 0;
let idleY = 0;
let idleTX = 0;
let idleTY = 0;
let portraitIdleHoldUntil = 0;

/* ── constants ── */

const SLEEP_REFUSE_ENERGY_ABOVE = 50;
const SLEEP_REFUSE_ROLL_CHANCE = 0.36;
const SLEEP_FORCED_HAPPINESS_LOSS = 14;
const SLEEP_FORCED_DISCIPLINE_LOSS = 10;
const DISCIPLINE_PASSIVE_BASE_DECAY = 1;
const DISCIPLINE_HUNGER_ZERO_MULT = 3;
const PET_ANGRY_OVERLAY_MS = 3000;
const PETTING_HAPPINESS_COOLDOWN_MS = 5 * 60 * 1000;
const LAIR_EMPTY_CLICK_CHAIN_MS = 1000;
const LAIR_EMPTY_CLICK_RADIUS_PX = 56;
const SPIRIT_BERRY_GROW_MS = 5 * 60 * 1000;
const DEMAND_KINDS = ["meal", "pet", "rest", "relic"];
const FOOD_EFFECTIVENESS_MULT = 1.04;
const HUNGER_FEED_STAGE_K = 0.2;

const LAIR_CARE_DROP_MS = 1250;
const LAIR_CARE_RUN_MS = 568;
const LAIR_FOOD_APPROACH_MS = 520;
const LAIR_FOOD_APPROACH_MAX_DY_PX = 180;
const LAIR_CARE_EAT_MS = 5000;
const LAIR_CARE_RELIC_MS = 5000;
const LAIR_CARE_REDUCED_EAT_MS = 560;

function eatMsForTier(tier, reduced) {
  if (reduced) return LAIR_CARE_REDUCED_EAT_MS;
  if (tier === "favorite") return Math.round(LAIR_CARE_EAT_MS * 0.5);
  if (tier === "hate") return LAIR_CARE_EAT_MS;
  return Math.round(LAIR_CARE_EAT_MS * 0.8);
}
const LAIR_FLOOR_DROP_STAGGER_MS = 220;
const LAIR_CHASE_ALIGN_EPS_PX = 6;

const PLAY_COOLDOWN_MS = 10 * 60 * 1000;
const PLAY_BALL_FALL_MS = 1000;
const PLAY_CHASE_MS = 568;
const PLAY_KICK_PAUSE_MS = 400;
const PLAY_BOUNCE_MS = 500;
const PLAY_HAPPINESS_GAIN = 12;
const PLAY_DISCIPLINE_LOSS = 4;
const PLAY_ENERGY_LOSS = 6;
const PLAY_HAPPY_EMOJIS = ["\uD83D\uDE04", "\uD83E\uDD29", "\uD83C\uDF89"];

const IDLE_LAIR_BOUND_X = 92 * 1.5;
const IDLE_LAIR_BOUND_Y = 184;

/* ── internal helpers (non-exported) ── */

function startDemandAttentionLoop() {
  stopDemandAttentionLoop();
  if (!state.demand || !state.lineId || battleActive || petSleepActive) return;
  if (!els.screenGame || !els.screenGame.classList.contains("active")) return;
  demandAttentionTimeoutId = setTimeout(pulseDemandAttention, 500 + Math.random() * 700);
}

function spawnPetFurryParticles(clientX, clientY) {
  const n = 14 + Math.floor(Math.random() * 7);
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "pet-furry-particle";
    p.style.left = clientX + "px";
    p.style.top = clientY + "px";
    const ang = Math.random() * Math.PI * 2;
    const dist = 28 + Math.random() * 88;
    const rot = (Math.random() * 140 - 70).toFixed(1) + "deg";
    p.style.setProperty("--fx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--fy", Math.sin(ang) * dist - 22 + Math.random() * 18 + "px");
    p.style.setProperty("--fr", rot);
    document.body.appendChild(p);
    setTimeout(function () {
      if (p.parentNode) p.remove();
    }, 820);
  }
}

function mythContentCenterX() {
  const p = _lairPortrait();
  const c = p && p.querySelector(".pet-portrait-idle-content");
  if (!c) return 0;
  const r = c.getBoundingClientRect();
  return r.left + r.width * 0.5;
}

function mythContentCenterY() {
  const p = _lairPortrait();
  const c = p && p.querySelector(".pet-portrait-idle-content");
  if (!c) return 0;
  const r = c.getBoundingClientRect();
  return r.top + r.height * 0.5;
}

function dropCenterX(dropEl) {
  if (!dropEl) return 0;
  const r = dropEl.getBoundingClientRect();
  return r.left + r.width * 0.5;
}

function updateFacingTowardDrop(dropEl) {
  const p = _lairPortrait();
  const content = p && p.querySelector(".pet-portrait-idle-content");
  if (!content || !dropEl) return;
  const mc = mythContentCenterX();
  const fc = dropCenterX(dropEl);
  content.classList.toggle("facing-left", fc < mc);
}

const _ISO_BOUND_Y = 92;
const _ISO_Y_FACTOR = 0.55;

function applyLairIdleLayerTransform(drawYVal) {
  const p = _lairPortrait();
  const layer = p && p.querySelector(".pet-portrait-idle");
  if (!layer) return;
  const worldY = drawYVal != null ? drawYVal : idleY + careApproachY;
  const isoY = (worldY * _ISO_Y_FACTOR).toFixed(1);
  layer.style.transform =
    "translate(" + (idleX + careChaseX).toFixed(1) + "px," + isoY + "px)";
}

function beginLairCareAndFreezeIdle() {
  stopPetIdle();
  setLairCareActive(true);
  var _blfPortrait = _lairPortrait();
  var _blfContent = _blfPortrait && _blfPortrait.querySelector(".pet-portrait-idle-content");
  if (_blfContent) _blfContent.classList.remove("anim-lair-feed-munch");
  careChaseX = 0;
  careApproachY = 0;
  idleX = 0;
  idleY = 0;
  idleTX = 0;
  idleTY = 0;
  portraitIdleHoldUntil = 0;
  applyLairIdleLayerTransform(0);
  refreshPlayBallButton();
}

function spawnLairDirtExplosion(layer, dropEl, reduced) {
  if (reduced || !layer || !dropEl) return;
  const lr = layer.getBoundingClientRect();
  const dr = dropEl.getBoundingClientRect();
  const cx = dr.left + dr.width * 0.5 - lr.left;
  const cy = dr.top + dr.height * 0.82 - lr.top;
  const burst = document.createElement("div");
  burst.className = "lair-dirt-burst";
  burst.style.left = cx + "px";
  burst.style.top = cy + "px";
  burst.setAttribute("aria-hidden", "true");
  const n = 15;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.4;
    const dist = 12 + Math.random() * 24;
    const p = document.createElement("span");
    p.className = "lair-dirt-particle";
    p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--dy", Math.sin(ang) * dist * 0.5 - 4 - Math.random() * 8 + "px");
    const sz = 4 + Math.random() * 6;
    p.style.width = sz + "px";
    p.style.height = sz + "px";
    burst.appendChild(p);
  }
  layer.appendChild(burst);
  window.setTimeout(function () {
    if (burst.parentNode) burst.parentNode.removeChild(burst);
  }, 520);
}

function spawnLairDropAndLand(layer, icon, reduced) {
  const fallMs = reduced ? 0 : LAIR_CARE_DROP_MS;
  const drop = document.createElement("span");
  drop.className = "lair-drop-item lair-drop-item--falling";
  if (icon instanceof HTMLElement) {
    drop.appendChild(icon);
  } else {
    drop.classList.add("game-emoji");
    drop.textContent = icon;
  }
  drop.style.setProperty("--lair-drop-x", 12 + Math.random() * 76 + "%");
  if (!reduced) {
    drop.style.animationDuration = LAIR_CARE_DROP_MS + "ms";
  }
  layer.appendChild(drop);
  return delayCareMs(fallMs).then(function () {
    drop.classList.remove("lair-drop-item--falling");
    drop.classList.add("lair-drop-item--landed");
    spawnLairDirtExplosion(layer, drop, reduced);
    playLairDropThudSfx();
    return drop;
  });
}

function chaseMythToDropElement(dropEl, runMs, reduced) {
  return new Promise(function (resolve) {
    if (!dropEl || !els.petPortrait) {
      resolve();
      return;
    }
    careApproachY = 0;
    updateFacingTowardDrop(dropEl);
    if (reduced) {
      snapMythCenterToDropHoriz(dropEl);
      resolve();
      return;
    }
    const _chasePortrait = _lairPortrait();
    const _chaseSpirit = _chasePortrait && _chasePortrait.querySelector(".pet-art-raster--multi-frame");
    if (_chaseSpirit) _chaseSpirit.classList.add("walking");
    scheduleLairRunFootsteps(runMs);
    const t0 = performance.now();
    let lastT = t0;
    function frame(now) {
      const d = dropCenterX(dropEl) - mythContentCenterX();
      const elapsed = now - t0;
      if (Math.abs(d) <= LAIR_CHASE_ALIGN_EPS_PX || elapsed >= runMs + 280) {
        snapMythCenterToDropHoriz(dropEl);
        if (_chaseSpirit) _chaseSpirit.classList.remove("walking");
        resolve();
        return;
      }
      const dt = Math.min(0.048, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;
      careChaseX += d * Math.min(0.936, 12.96 * dt);
      applyLairIdleLayerTransform();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function refreshHudAfterLairCareEat() {
  if (!els.barHappiness || !state) return;
  const m = _targetMyth();
  setBar(els.barHappiness, els.numHappiness, m.happiness);
  setBar(els.barHunger, els.numHunger, m.hunger);
  if (els.barDiscipline && els.numDiscipline) {
    setBar(els.barDiscipline, els.numDiscipline, m.discipline != null ? m.discipline : 0);
  }
  renderDemandUi();
  renderInfluence();
  renderPantryLine();
  renderCombatStatsPanel();
  if (els.petPortrait) els.petPortrait.classList.toggle("pet-portrait--hungry", state.hunger <= 20);
  if (els.petPortraitCompanion && state.companion && state.companion.lineId) {
    els.petPortraitCompanion.classList.toggle("pet-portrait--hungry", state.companion.hunger <= 20);
  }
}

/* ── spirit berry ── */

export function clearSpiritBerryTimers() {
  if (spiritBerryRipenTimeoutId !== null) {
    clearTimeout(spiritBerryRipenTimeoutId);
    spiritBerryRipenTimeoutId = null;
  }
  if (spiritBerryTickIntervalId !== null) {
    clearInterval(spiritBerryTickIntervalId);
    spiritBerryTickIntervalId = null;
  }
}

/* ── lair interactable registry ──
 * Lair objects (bush, future toys, bowls, nests, etc.) sit behind the pet portrait
 * in the DOM stacking order. Clicks that visually land on them often hit the
 * portrait/interaction zone instead, so the object's own click listener never fires.
 * Register each lair interactable here so pointer dispatch can coord-test against
 * the full registry and route the click to the correct handler. New objects only
 * need one registerLairInteractable(el, onTap) call at setup — no per-object
 * intercept code required. */

const lairInteractables = [];

export function registerLairInteractable(el, onTap) {
  if (!el || typeof onTap !== "function") return;
  for (let i = 0; i < lairInteractables.length; i++) {
    if (lairInteractables[i].el === el) { lairInteractables[i].onTap = onTap; return; }
  }
  lairInteractables.push({ el, onTap });
}

export function dispatchLairInteractableHit(ev, options) {
  if (!ev || ev.clientX == null) return false;
  const skipDirectHit = !!(options && options.skipDirectHit);
  for (let i = 0; i < lairInteractables.length; i++) {
    const entry = lairInteractables[i];
    const el = entry.el;
    if (!el || !el.isConnected) continue;
    if (skipDirectHit && ev.target && el.contains(ev.target)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (ev.clientX < r.left || ev.clientX > r.right) continue;
    if (ev.clientY < r.top || ev.clientY > r.bottom) continue;
    entry.onTap(ev);
    return true;
  }
  return false;
}

export function shakeBerryBush() {
  const b = els.lairBerryBush;
  if (!b) return;
  b.classList.remove("lair-berry-bush--shake");
  void b.offsetWidth;
  b.classList.add("lair-berry-bush--shake");
  setTimeout(function () {
    if (els.lairBerryBush) els.lairBerryBush.classList.remove("lair-berry-bush--shake");
  }, 320);
}

export function refreshSpiritBerryInteraction() {
  const bush = els.lairBerryBush;
  if (!bush || !state || !state.lineId) return;
  const ripe = state.spiritBerryRipeAt != null && Date.now() >= state.spiritBerryRipeAt;
  if (ripe) {
    const locked = petSleepActive || battleActive || careSequenceBerryBusy();
    bush.setAttribute("aria-disabled", locked ? "true" : "false");
  }
}

export function ensureSpiritBerryRipeAt() {
  if (!state || !state.lineId) return;
  const t = state.spiritBerryRipeAt;
  if (t == null || typeof t !== "number" || !isFinite(t)) {
    state.spiritBerryRipeAt = Date.now() + SPIRIT_BERRY_GROW_MS;
  }
}

export function formatSpiritBerryCountdown(msLeft) {
  const sec = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

export function updateSpiritBerryUi() {
  const bush = els.lairBerryBush;
  if (!bush || !state || !state.lineId) {
    clearSpiritBerryTimers();
    spiritBerryUiPhase = null;
    return;
  }
  ensureSpiritBerryRipeAt();
  const now = Date.now();
  const ripeAt = state.spiritBerryRipeAt;
  const ripe = now >= ripeAt;
  const phase = ripe ? "ripe" : "growing";
  spiritBerryUiPhase = phase;
  clearSpiritBerryTimers();
  const locked = petSleepActive || battleActive || careSequenceBerryBusy();

  if (ripe) {
    bush.classList.add("lair-berry-bush--ripe");
    bush.setAttribute("aria-disabled", locked ? "true" : "false");
    bush.setAttribute("aria-label", "Ripe spirit berry — tap to feed your myth");
    bush.title = locked
      ? "Berry ready — wake your myth or finish battle to pick."
      : "Ripe spirit berry — tap to feed your myth (+15 hunger).";
  } else {
    bush.classList.remove("lair-berry-bush--ripe");
    bush.setAttribute("aria-disabled", "true");
    bush.setAttribute("aria-label", "Spirit berry bush (growing)");
    bush.title = "Spirit berry bush — growing";
    const waitMs = Math.min(Math.max(ripeAt - now, 0), 2147483647);
    spiritBerryRipenTimeoutId = setTimeout(function () {
      spiritBerryRipenTimeoutId = null;
      updateSpiritBerryUi();
    }, waitMs + 40);
  }
}

export function pickSpiritBerry() {
  if (!state || !state.lineId || battleActive || petSleepActive || lairCareActive) return;
  ensureSpiritBerryRipeAt();
  if (Date.now() < state.spiritBerryRipeAt) return;
  if (careSequenceBerryBusy()) return;
  const tgt = _targetMyth();
  if (tgt.hunger >= 100) {
    pushLog("Your myth ignores the berry — already full.");
    playMythRefuseFoodSfx();
    triggerPetAnim("anim-feed-refuse");
    flashPetMoodPopup("🙅");
    return;
  }
  careSequenceQueue.push({ kind: "berry", slot: _careTargetSlot });
  resumeBattleAudioIfNeeded();
  pumpCareQueue();
  updateSpiritBerryUi();
}

/* ── demands ── */

export function demandMessage(kind) {
  if (kind === "meal") return "Your myth demands a feast — now.";
  if (kind === "pet") return "Your myth presses against you, begging for affection.";
  if (kind === "rest") return "Your myth is restless and insists on quiet rest.";
  if (kind === "relic") return "Your myth craves a relic offering from the shrines.";
  return "Your myth makes an urgent plea.";
}

export function clearDemandWindowTimers() {
  if (demandResponseTimeoutId !== null) {
    clearTimeout(demandResponseTimeoutId);
    demandResponseTimeoutId = null;
  }
  if (demandWindowTickId !== null) {
    clearInterval(demandWindowTickId);
    demandWindowTickId = null;
  }
  if (els.demandTimer) {
    els.demandTimer.textContent = "";
    els.demandTimer.classList.remove("is-urgent");
  }
}

export function stopDemandAttentionLoop() {
  if (demandAttentionTimeoutId !== null) {
    clearTimeout(demandAttentionTimeoutId);
    demandAttentionTimeoutId = null;
  }
  if (demandJumpClearTimeoutId !== null) {
    clearTimeout(demandJumpClearTimeoutId);
    demandJumpClearTimeoutId = null;
  }
  if (els.petPortrait) els.petPortrait.classList.remove("pet-portrait--demand-jump");
}

export function triggerDemandAttentionJump() {
  if (!els.petPortrait) return;
  els.petPortrait.classList.remove("pet-portrait--demand-jump");
  void els.petPortrait.offsetWidth;
  els.petPortrait.classList.add("pet-portrait--demand-jump");
  if (demandJumpClearTimeoutId !== null) clearTimeout(demandJumpClearTimeoutId);
  demandJumpClearTimeoutId = setTimeout(function () {
    demandJumpClearTimeoutId = null;
    if (els.petPortrait) els.petPortrait.classList.remove("pet-portrait--demand-jump");
  }, 560);
}

export function pulseDemandAttention() {
  demandAttentionTimeoutId = null;
  if (!state.demand || !state.lineId || battleActive || petSleepActive) return;
  if (!els.screenGame || !els.screenGame.classList.contains("active")) return;
  triggerDemandAttentionJump();
  playDemandAttentionCallSfx(state.lineId, state.demand.kind);
  demandAttentionTimeoutId = setTimeout(pulseDemandAttention, 2400 + Math.random() * 2600);
}

export function updateDemandTimerEl() {
  if (!els.demandTimer || !state.demand) return;
  const msLeft = Math.max(0, demandWindowEndsAt - Date.now());
  const sec = Math.ceil(msLeft / 1000);
  if (sec <= 0) {
    els.demandTimer.textContent = "";
    return;
  }
  els.demandTimer.textContent = "Respond within " + sec + "s";
  els.demandTimer.classList.toggle("is-urgent", sec <= 5);
}

export function startDemandResponseTimer() {
  clearDemandWindowTimers();
  if (!state.demand || !state.lineId) return;
  demandWindowToken = state.demand.spawnToken;
  demandWindowEndsAt = Date.now() + 15000;
  updateDemandTimerEl();
  demandWindowTickId = setInterval(function () {
    if (!state.demand || state.demand.spawnToken !== demandWindowToken) {
      clearDemandWindowTimers();
      return;
    }
    updateDemandTimerEl();
  }, 200);
  demandResponseTimeoutId = setTimeout(function () {
    demandResponseTimeoutId = null;
    if (!state.demand || state.demand.spawnToken !== demandWindowToken) return;
    onDemandWindowTimedOut();
  }, 15000);
}

export function onDemandWindowTimedOut() {
  clearDemandWindowTimers();
  if (!state.demand) return;
  state.demand = null;
  renderDemandUi();
  const h0 = state.happiness;
  state.happiness = clamp(state.happiness - 20, 0, 100);
  playMythMoodSfxForDelta(state.happiness - h0);
  pushLog("Time ran out — the plea fades unheard. Your myth turns away, crestfallen.");
  renderPet();
  flashPetMoodPopup("😢");
  if (els.barHappiness && els.numHappiness) setBar(els.barHappiness, els.numHappiness, state.happiness);
}

function _demandStripEls(slot) {
  if (slot === 1) return {
    strip: els.demandStrip1,
    text: els.demandText1,
    timer: els.demandTimer1,
  };
  return { strip: els.demandStrip, text: els.demandText, timer: els.demandTimer };
}

export function renderDemandUiForSlot(slot) {
  const myth = getMythBySlot(slot);
  const ui = _demandStripEls(slot);
  if (!ui.strip || !ui.text) return;
  const d = myth ? myth.demand : null;
  if (!d || !myth || !myth.lineId) {
    if (slot === 0) stopDemandAttentionLoop();
    ui.strip.classList.remove("visible");
    if (ui.timer) { ui.timer.textContent = ""; ui.timer.classList.remove("is-urgent"); }
    return;
  }
  ui.text.textContent = demandMessage(d.kind) + " (" + d.ticksLeft + " warnings left)";
  ui.strip.classList.add("visible");
  if (slot === 0) startDemandAttentionLoop();
}

export function renderDemandUi() {
  renderDemandUiForSlot(0);
  renderDemandUiForSlot(1);
}

export function spawnRandomDemandForSlot(slot) {
  const myth = getMythBySlot(slot);
  if (!myth || myth.demand || !myth.lineId) return;
  const kind = DEMAND_KINDS[Math.floor(Math.random() * DEMAND_KINDS.length)];
  demandSpawnSeq++;
  myth.demand = {
    kind: kind,
    ticksLeft: 3 + Math.floor(Math.random() * 2),
    spawnToken: demandSpawnSeq,
  };
  const who = slot === 1 ? "Your companion" : "Your myth";
  pushLog(who + " voices a need — indulge or discipline before patience runs out.");
  renderDemandUiForSlot(slot);
  if (slot === 0) startDemandResponseTimer();
}

export function spawnRandomDemand() {
  spawnRandomDemandForSlot(0);
}

export function clearDemandForSlot(slot) {
  const myth = getMythBySlot(slot);
  if (!myth) return;
  if (slot === 0) clearDemandWindowTimers();
  myth.demand = null;
  renderDemandUiForSlot(slot);
  saveGameState();
}

export function clearDemand() {
  clearDemandForSlot(0);
}

export function renderMythTabIndicators() {
  // Update tab dot indicators showing hunger/happiness state at a glance
  if (els.mythTab0Dots && state) {
    els.mythTab0Dots.classList.toggle("dot-hungry", state.hunger <= 20);
    els.mythTab0Dots.classList.toggle("dot-sad", state.happiness <= 20);
  }
  if (els.mythTab1Dots && state && state.companion && state.companion.lineId) {
    els.mythTab1Dots.classList.toggle("dot-hungry", state.companion.hunger <= 20);
    els.mythTab1Dots.classList.toggle("dot-sad", state.companion.happiness <= 20);
  }
}

export function resolveDemandIndulge(slot) {
  slot = slot != null ? slot : 0;
  const myth = getMythBySlot(slot);
  const d = myth ? myth.demand : null;
  if (!d || !myth.lineId) return;
  const k = d.kind;
  const happyBefore = myth.happiness;
  if (k === "meal") return;
  if (k === "pet") {
    myth.happiness = clamp(myth.happiness + 18, 0, 100);
    myth.lifespan = clamp(myth.lifespan + 4, 0, 100);
    pushLog("You shower " + (slot === 1 ? "your companion" : "it") + " with attention; its spirit brightens.");
  } else if (k === "rest") {
    myth.energy = clamp(myth.energy + 28, 0, 100);
    myth.happiness = clamp(myth.happiness + 8, 0, 100);
    myth.lifespan = clamp(myth.lifespan + 3, 0, 100);
    pushLog("You grant rest; breath and years feel a little longer.");
  } else if (k === "relic") {
    ensureRelicInventoryState();
    if (RELIC_ITEMS.length) {
      const loot = RELIC_ITEMS[Math.floor(Math.random() * RELIC_ITEMS.length)];
      state.relicInventory[loot.id] = (state.relicInventory[loot.id] || 0) + 1;
      pushLog("You consecrate a relic gift — " + (loot.icon || "🏺") + " " + loot.name + " was placed in your inventory.");
    }
    myth.happiness = clamp(myth.happiness + 9, 0, 100);
    myth.lifespan = clamp(myth.lifespan + 4, 0, 100);
  }
  playMythMoodSfxForDelta(myth.happiness - happyBefore);
  clearDemandForSlot(slot);
  renderPet();
  flashPetMoodPopup("🥰");
  try { incrementAchievement("care_demand_indulge_t1"); } catch (e) {}
}

export function resolveDemandDiscipline(slot) {
  slot = slot != null ? slot : 0;
  const myth = getMythBySlot(slot);
  if (!myth || !myth.demand || !myth.lineId) return;
  myth.discipline = clamp((myth.discipline != null ? myth.discipline : 0) + 25, 0, 100);
  const h0 = myth.happiness;
  myth.happiness = clamp(myth.happiness - 10, 0, 100);
  playMythMoodSfxForDelta(myth.happiness - h0);
  pushLog("You hold the line with discipline — the demand fades, tempered.");
  clearDemandForSlot(slot);
  renderPet();
  flashPortraitDisciplineHit();
  triggerPetAnim("anim-discipline-sad");
  flashPetMoodPopup("😢");
  try {
    incrementAchievement("care_demand_discipline_t1");
    if (myth.discipline >= 100) incrementAchievement("care_discipline100_t1");
    if (myth.discipline >= 100) checkAchievement("sec_max_discipline", 1);
  } catch (e) {}
}

/* ── timers (lifespan / hunger) ── */

function _tickLifespanForMyth(myth, isSleeping, slot) {
  if (!myth || !myth.lineId) return;
  if (myth.demand) {
    myth.demand.ticksLeft--;
    if (myth.demand.ticksLeft <= 0) {
      if (slot === 0) clearDemandWindowTimers();
      const h0 = myth.happiness;
      myth.happiness = clamp(myth.happiness - 16, 0, 100);
      playMythMoodSfxForDelta(myth.happiness - h0);
      myth.lifespan = clamp(myth.lifespan - 4, 0, 100);
      pushLog("A need ignored — sorrow etches into " + (slot === 1 ? "your companion's" : "your myth's") + " remaining days.");
      myth.demand = null;
      renderDemandUiForSlot(slot);
    } else {
      renderDemandUiForSlot(slot);
    }
  } else if (Math.random() < 0.16) {
    spawnRandomDemandForSlot(slot);
  }
  let drain = 0.575;
  if (myth.happiness < 35) drain += 0.425;
  if (myth.happiness < 18) drain += 0.275;
  if (isSleeping) drain *= 0.42;
  myth.lifespan = clamp(myth.lifespan - drain, 0, 100);
}

function _tryAutoSleepForMyth(myth, slot, isSleeping) {
  if (!myth || !myth.lineId) return;
  if (isSleeping) return;
  if (petSleepActive || battleActive) return;
  if (myth.energy >= 10) return;
  if (myth.hunger <= 0) return;
  if (Math.random() >= 0.6) return;
  startPetSleep(false, slot);
}

export function tickLifespanAndDemand() {
  if (!state || !state.lineId || !els.screenGame || !els.screenGame.classList.contains("active")) return;
  if (els.modalDeathLegacy && els.modalDeathLegacy.classList.contains("open")) return;

  _tickLifespanForMyth(state, petSleepActive, 0);
  _tickLifespanForMyth(state.companion, companionSleepActive, 1);

  _tryAutoSleepForMyth(state, 0, petSleepActive);
  _tryAutoSleepForMyth(state.companion, 1, companionSleepActive);

  const activeTab = state.activeMythTab || 0;
  const displayed = activeTab === 1 && state.companion ? state.companion : state;
  if (els.barLifespan && els.numLifespan) setBar(els.barLifespan, els.numLifespan, displayed.lifespan);
  if (els.barDiscipline && els.numDiscipline) setBar(els.barDiscipline, els.numDiscipline, displayed.discipline != null ? displayed.discipline : 0);

  if (state.lifespan <= 0) {
    triggerCreatureDeath(0);
  }
  if (state.companion && state.companion.lineId && state.companion.lifespan <= 0) {
    triggerCreatureDeath(1);
  }
}

export function startLifespanDemandTimer() {
  stopLifespanDemandTimer();
  lifespanDemandIntervalId = setInterval(tickLifespanAndDemand, 60000);
}

export function stopLifespanDemandTimer() {
  if (lifespanDemandIntervalId !== null) {
    clearInterval(lifespanDemandIntervalId);
    lifespanDemandIntervalId = null;
  }
}

export function tickHunger(myth) {
  const m = myth || state;
  if (!m) return;
  m.hunger = clamp(m.hunger - 1, 0, 100);
}

function _tickPassiveHungerForMyth(myth) {
  if (!myth || !myth.lineId) return;
  myth.hunger = clamp(myth.hunger - 1, 0, 100);
  myth.happiness = clamp(myth.happiness - 2, 0, 100);
  myth.energy = clamp(myth.energy - 1, 0, 100);
  const h = myth.hunger;
  let discLoss = DISCIPLINE_PASSIVE_BASE_DECAY;
  if (h <= 8) discLoss += 4;
  else if (h <= 15) discLoss += 3;
  else if (h <= 20) discLoss += 2;
  else if (h <= 35) discLoss += 1;
  if (h <= 0) discLoss *= DISCIPLINE_HUNGER_ZERO_MULT;
  myth.discipline = clamp((myth.discipline != null ? myth.discipline : 0) - discLoss, 0, 100);
}

export function startPassiveHungerTimer() {
  stopPassiveHungerTimer();
  hungerPassiveIntervalId = setInterval(function () {
    if (!state || !state.lineId || !els.screenGame || !els.screenGame.classList.contains("active")) return;
    _tickPassiveHungerForMyth(state);
    _tickPassiveHungerForMyth(state.companion);
    // Update UI bars for the active tab myth
    const activeTab = (state.activeMythTab || 0);
    const displayed = activeTab === 1 && state.companion ? state.companion : state;
    if (els.barDiscipline && els.numDiscipline) setBar(els.barDiscipline, els.numDiscipline, displayed.discipline != null ? displayed.discipline : 0);
    if (els.barHunger && els.numHunger) setBar(els.barHunger, els.numHunger, displayed.hunger);
    if (els.barHappiness && els.numHappiness) setBar(els.barHappiness, els.numHappiness, displayed.happiness);
    if (els.barEnergy && els.numEnergy) setBar(els.barEnergy, els.numEnergy, displayed.energy);
    syncMoodClasses(
      activeTab === 1 && state.companion && state.companion.lineId ? (els.petPortraitCompanion || els.petPortrait) : els.petPortrait,
      displayed
    );
    // Hungry indicator: show if either myth is hungry
    const isHungry0 = state.hunger <= 20;
    const isHungry1 = state.companion && state.companion.lineId && state.companion.hunger <= 20;
    if (els.petPortrait) {
      els.petPortrait.classList.toggle("pet-portrait--hungry", isHungry0);
      const L = line();
      const node = L && getCurrentNode(L, state.nodeKey);
      if (node) {
        const portraitHint =
          (isHungry0 ? "Hungry — open pantry (🍖) and choose food. " : "") +
          node.name + " — click myth to pet";
        els.petPortrait.setAttribute("title", portraitHint);
        els.petPortrait.setAttribute("aria-label", portraitHint);
      }
    }
    if (els.petPortraitCompanion) {
      els.petPortraitCompanion.classList.toggle("pet-portrait--hungry", !!isHungry1);
    }
    syncMoodClasses();
    // Update companion tab indicator dots
    renderMythTabIndicators();
  }, 120000);
}

export function stopPassiveHungerTimer() {
  if (hungerPassiveIntervalId !== null) {
    clearInterval(hungerPassiveIntervalId);
    hungerPassiveIntervalId = null;
  }
}

/* ── death ── */

export function triggerCreatureDeath(slot) {
  slot = slot != null ? slot : 0;
  // If only the companion died, just clear that slot and continue
  if (slot === 1 && state && state.companion && state.companion.lineId) {
    try { recordMythDeath(state.companion); } catch (e) {}
    const companionScore = legacyScoreFromMyth(state.companion);
    pushLog("Your companion myth has faded — its legend is recorded in Past Myths.");
    state.companion = null;
    state.slot2Unlocked = false;
    renderPet();
    renderDemandUiForSlot(1);
    saveGameState();
    return;
  }

  // Primary myth died — full death/reincarnation flow.
  // Preserve the surviving companion (slot 1) across rebirth so it isn't wiped.
  if (state && state.companion && state.companion.lineId) {
    setPendingCompanionCarry(JSON.parse(JSON.stringify(state.companion)));
  } else {
    setPendingCompanionCarry(null);
  }
  clearSpiritBerryTimers();
  spiritBerryUiPhase = null;
  careSequenceQueue.length = 0;
  careSequenceActive = false;
  careSequenceCurrentJobKind = null;
  pendingPantryCareItems.length = 0;
  pendingRelicCareItems.length = 0;
  setLairCareActive(false);
  careChaseX = 0;
  careApproachY = 0;
  if (els.lairDropLayer) els.lairDropLayer.innerHTML = "";
  stopLifespanDemandTimer();
  stopPassiveHungerTimer();
  stopDemandAttentionLoop();
  stopLairAmbient();
  cancelPetSleepSilent();
  setBattleActive(false);
  document.body.classList.remove("battle-active");
  if (els.modalBattle) els.modalBattle.classList.remove("open");

  const score = legacyScoreFromState();
  const bonus = computeReincarnationBonus(score);
  setPendingReincarnationBonus({ hp: bonus.hp, atk: bonus.atk, spd: bonus.spd });

  const medals = legacyMedals(score);
  const epigraph = legacyEpigraph(score);
  if (els.deathMedals) {
    els.deathMedals.innerHTML = medals
      .map(function (x) {
        return (
          '<span class="death-medal" title="' +
          escapeHtml(x.label) +
          '">' +
          x.emoji +
          " " +
          escapeHtml(x.label) +
          "</span>"
        );
      })
      .join("");
  }
  if (els.deathEpigraph) els.deathEpigraph.textContent = epigraph;
  if (els.deathBonusLine) {
    els.deathBonusLine.textContent =
      "Your next myth inherits +" +
      bonus.hp +
      " HP, +" +
      bonus.atk +
      " Atk, +" +
      bonus.spd +
      " Spd from this life's legend.";
  }
  if (els.modalDeathLegacy) els.modalDeathLegacy.classList.add("open");

  try {
    incrementStat("totalReincarnations", 1);
    var xpRewards = awardXp(75);
    if (xpRewards && xpRewards.then) xpRewards.then(function (r) { if (r) showLevelUpIfNeeded(r); });
  } catch (e) {}

  try {
    checkAchievement("sec_first_death", 1);
    checkAchievement("sec_first_reinc", 1);
    incrementAchievement("reinc_total_t1");
  } catch (e) {}

  try { recordMythDeath(state); } catch (e) {}
  saveReincarnationState();
}

export function closeDeathLegacyAndGoPick() {
  resetDeveloperSessionFlags();
  if (els.modalDeathLegacy) els.modalDeathLegacy.classList.remove("open");
  stopDemandAttentionLoop();
  clearDemandWindowTimers();
  clearSpiritBerryTimers();
  stopLairAmbient();
  spiritBerryUiPhase = null;
  ensureFoodInventoryState();
  ensureRelicInventoryState();
  // Preserve surviving companion (defensive; triggerCreatureDeath also stashes it).
  if (!pendingCompanionCarry && state && state.companion && state.companion.lineId) {
    setPendingCompanionCarry(JSON.parse(JSON.stringify(state.companion)));
  }
  setPendingReincarnationInventory({
    food: JSON.parse(JSON.stringify(state.foodInventory)),
    relic: JSON.parse(JSON.stringify(state.relicInventory)),
  });
  setState(JSON.parse(JSON.stringify(defaultStateTemplate)));
  state.lineId = null;
  state.log = [];
  ensureFoodInventoryState();
  ensureRelicInventoryState();
  if (els.screenGame) els.screenGame.classList.remove("active");
  if (els.gameLog) els.gameLog.innerHTML = "";
  pickLineCards();
  // Mythala City: route the bereaved Tamer through Lady Kemala for the next Myth.
  try { stopCityMapBgm(); } catch (e) {}
  if (window.MythalaCity) window.MythalaCity.goBestow();
  else if (els.screenPick) els.screenPick.classList.add("active");
}

/* ── sleep ── */

export function cancelPetSleepSilent() {
  setPetSleepActive(false);
  setCompanionSleepActive(false);
  petSleepClickCount = 0;
  if (petSleepRaf) cancelAnimationFrame(petSleepRaf);
  petSleepRaf = null;
  lastPetSleepFrameTime = 0;
  document.body.classList.remove("pet-sleeping");
  if (els.petPortrait) els.petPortrait.classList.remove("sleeping");
  if (els.petPortraitCompanion) els.petPortraitCompanion.classList.remove("sleeping");
  setUiSleepLocked(false);
  petSleepAwaitingForce = false;
  clearPetAngryOverlay();
  _sleepingSlot = 0;
}

export function clearPetAngryOverlay() {
  if (petAngryOverlayClearT) {
    clearTimeout(petAngryOverlayClearT);
    petAngryOverlayClearT = null;
  }
  petAngryOverlayEndTime = 0;
  syncPetAngryOverlay();
}

export function syncMoodClasses(portraitEl, myth) {
  const portrait = portraitEl || els.petPortrait;
  if (!portrait) return;
  const m = myth || state;
  const sad = m.happiness <= 30;
  portrait.classList.toggle('mood-happy', m.happiness >= 70 && !sad);
  portrait.classList.toggle('mood-sad', sad);
}

export function syncPetAngryOverlay() {
  if (!els.petPortrait) return;
  const layer = els.petPortrait.querySelector(".pet-angry-layer");
  if (!layer) return;
  layer.classList.toggle("pet-angry-layer--active", performance.now() < petAngryOverlayEndTime);
}

export function startPetAngryOverlay() {
  if (petAngryOverlayClearT) {
    clearTimeout(petAngryOverlayClearT);
    petAngryOverlayClearT = null;
  }
  petAngryOverlayEndTime = performance.now() + PET_ANGRY_OVERLAY_MS;
  syncPetAngryOverlay();
  petAngryOverlayClearT = setTimeout(function () {
    petAngryOverlayEndTime = 0;
    syncPetAngryOverlay();
    petAngryOverlayClearT = null;
  }, PET_ANGRY_OVERLAY_MS);
}

export function setUiSleepLocked(locked) {
  if (!els.btnFeed && !els.btnRest) return;
  if (els.btnFeed) els.btnFeed.disabled = locked;
  if (els.btnRelicInventory) els.btnRelicInventory.disabled = locked;
  els.btnRest.disabled = locked;
  const am = (state && state.activeMythTab === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  els.btnEvolve.disabled = locked || !canEvolve(am);
  if (els.petLairActions) {
    els.petLairActions.classList.toggle(
      "pet-lair-actions--evolve-ready",
      !locked && canEvolve(am)
    );
  }
  if (els.btnDemandIndulge) els.btnDemandIndulge.disabled = locked;
  if (els.btnDemandDiscipline) els.btnDemandDiscipline.disabled = locked;
  refreshSpiritBerryInteraction();
  refreshPlayBallButton();
}

export function applyForcedActionWhileHungry(contextPhrase, myth) {
  const m = myth || state;
  const happyBefore = m.happiness;
  m.happiness = clamp(m.happiness - 16, 0, 100);
  m.discipline = clamp((m.discipline != null ? m.discipline : 0) + 1, 0, 100);
  if (happyBefore < 20) {
    m.discipline = clamp(m.discipline - 5, 0, 100);
  }
  playMythMoodSfxForDelta(m.happiness - happyBefore);
  pushLog(
    "You press on while " +
      contextPhrase +
      " — the myth strains, discipline shifts, and mood sours."
  );
}

export function finishPetSleep(reason) {
  if (!petSleepActive) return;
  const slot = _sleepingSlot;
  const tgt = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  setPetSleepActive(false);
  setCompanionSleepActive(false);
  petSleepClickCount = 0;
  if (petSleepRaf) cancelAnimationFrame(petSleepRaf);
  petSleepRaf = null;
  lastPetSleepFrameTime = 0;
  document.body.classList.remove("pet-sleeping");
  if (els.petPortrait) els.petPortrait.classList.remove("sleeping");
  if (els.petPortraitCompanion) els.petPortraitCompanion.classList.remove("sleeping");
  setUiSleepLocked(false);
  if (reason !== "starved") {
    const h0 = tgt.happiness;
    tgt.happiness = clamp(tgt.happiness + 1, 0, 100);
    playMythMoodSfxForDelta(tgt.happiness - h0);
    tickHunger(tgt);
  }
  if (reason === "full") {
    pushLog("Your myth wakes fully rested — energy topped off.");
  } else if (reason === "starved") {
    pushLog("Too famished to stay asleep — feed a meal.");
  } else {
    pushLog("Your myth stirs — woke from your gentle taps.");
  }
  _sleepingSlot = 0;
  renderPet();
}

export function tryRequestPetSleep(slot) {
  if (slot == null) slot = _careTargetSlot;
  const tgt = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  if (petSleepActive || battleActive || !els.petPortrait || !state.lineId || !tgt.lineId) return;
  if (tgt.energy >= 100) {
    pushLog("Your myth is already brimming with energy.");
    return;
  }
  if (tgt.hunger <= 0) {
    pushLog("Your myth is too starved to rest — feed a meal first.");
    return;
  }
  if (tgt.energy > SLEEP_REFUSE_ENERGY_ABOVE) {
    if (petSleepAwaitingForce) {
      petSleepAwaitingForce = false;
      startPetSleep(true, slot);
      return;
    }
    if (Math.random() < SLEEP_REFUSE_ROLL_CHANCE) {
      petSleepAwaitingForce = true;
      pushLog(
        "Your myth refuses to settle — too much energy still runs through them. Press Rest again to insist; they will resent it."
      );
      return;
    }
    petSleepAwaitingForce = false;
  } else {
    petSleepAwaitingForce = false;
  }
  startPetSleep(false, slot);
}

export function startPetSleep(forcedRest, slot) {
  if (slot == null) slot = _careTargetSlot;
  const tgt = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  const sleepPortrait = (slot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  if (petSleepActive || battleActive || !sleepPortrait || !state.lineId || !tgt.lineId) return;
  if (tgt.energy >= 100) {
    pushLog("Your myth is already brimming with energy.");
    return;
  }
  if (tgt.hunger <= 0) {
    pushLog("Your myth is too starved to rest — feed a meal first.");
    return;
  }
  if (tgt.hunger <= 20) {
    applyForcedActionWhileHungry("still hungry", tgt);
  }
  const forced = !!forcedRest;
  const activeSlot = state.activeMythTab || 0;
  if (forced) {
    tgt.happiness = clamp(tgt.happiness - SLEEP_FORCED_HAPPINESS_LOSS, 0, 100);
    tgt.discipline = clamp(
      (tgt.discipline != null ? tgt.discipline : 0) - SLEEP_FORCED_DISCIPLINE_LOSS,
      0,
      100
    );
    playMythAngrySfx();
    if (activeSlot === slot) {
      setBar(els.barHappiness, els.numHappiness, tgt.happiness);
      if (els.barDiscipline && els.numDiscipline) {
        setBar(els.barDiscipline, els.numDiscipline, tgt.discipline);
      }
      const tgtPortrait = slot === 1 && els.petPortraitCompanion ? els.petPortraitCompanion : els.petPortrait;
      syncMoodClasses(tgtPortrait, tgt);
    }
    pushLog(
      "You force rest while they still brim with vigor — happiness and discipline slip as anger flares. Three taps still wake them."
    );
    startPetAngryOverlay();
  } else {
    pushLog(
      "Your myth drifts asleep — energy creeps back slowly and sleep gnaws at hunger. Three taps wake them, or wait until energy is full."
    );
  }
  _sleepingSlot = slot;
  setPetSleepActive(true);
  if (slot === 1) setCompanionSleepActive(true);
  petSleepClickCount = 0;
  stopPetIdle();
  stopDemandAttentionLoop();
  try { incrementAchievement("care_sleep_t1"); } catch (e) {}
  document.body.classList.add("pet-sleeping");
  sleepPortrait.classList.add("sleeping");
  setUiSleepLocked(true);
  lastPetSleepFrameTime = performance.now();
  function tick(now) {
    if (!petSleepActive) return;
    const dt = Math.min(0.14, (now - lastPetSleepFrameTime) / 1000);
    lastPetSleepFrameTime = now;
    tgt.energy = clamp(tgt.energy + (dt * 11) / 4, 0, 100);
    tgt.hunger = clamp(tgt.hunger - 1 * dt, 0, 100);
    if ((state.activeMythTab || 0) === slot) {
      setBar(els.barEnergy, els.numEnergy, tgt.energy);
      if (els.barHunger && els.numHunger) setBar(els.barHunger, els.numHunger, tgt.hunger);
    }
    if (sleepPortrait) {
      sleepPortrait.classList.toggle("pet-portrait--hungry", tgt.hunger <= 20);
    }
    if (tgt.hunger <= 0) {
      finishPetSleep("starved");
      return;
    }
    if (tgt.energy >= 100) {
      finishPetSleep("full");
      return;
    }
    petSleepRaf = requestAnimationFrame(tick);
  }
  petSleepRaf = requestAnimationFrame(tick);
}

/* ── petting ── */

export function applyPettingStatRefresh() {
  const tgt = _targetMyth();
  const activeSlot = state.activeMythTab || 0;
  if (activeSlot === _careTargetSlot) {
    setBar(els.barHappiness, els.numHappiness, tgt.happiness);
  }
  const tgtPortrait = (_careTargetSlot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  if (tgtPortrait) {
    tgtPortrait.classList.toggle("pet-portrait--hungry", tgt.hunger <= 20);
  }
  syncMoodClasses(tgtPortrait, tgt);
  renderCombatStatsPanel();
}

export function isClickOnMythIdleContent(ev) {
  const c = els.petPortrait && els.petPortrait.querySelector(".pet-portrait-idle-content");
  if (!c || ev.clientX == null || ev.clientY == null) return false;
  const r = c.getBoundingClientRect();
  return (
    ev.clientX >= r.left &&
    ev.clientX <= r.right &&
    ev.clientY >= r.top &&
    ev.clientY <= r.bottom
  );
}

export function onPetPortraitPointer(ev, slot) {
  if (battleActive || !state.lineId) return;
  if (dispatchLairInteractableHit(ev)) return;
  // Resolve target slot for petting / sleep — prefer explicit slot, fall back to active tab.
  const _resolvedSlot = (slot != null)
    ? slot
    : (state ? (state.activeMythTab || 0) : 0);
  const _resolvedMyth = (_resolvedSlot === 1 && state.companion && state.companion.lineId)
    ? state.companion
    : state;
  if (petSleepActive) {
    if (slot == null || slot === _sleepingSlot) {
      spawnPetFurryParticles(ev.clientX, ev.clientY);
      playPetFurryClickSfx();
      petSleepClickCount++;
      if (petSleepClickCount >= 3) {
        finishPetSleep("tap");
      }
    }
    return;
  }
  if (!isClickOnMythIdleContent(ev)) {
    const now = performance.now();
    const dx = ev.clientX - lairEmptyClickAnchorX;
    const dy = ev.clientY - lairEmptyClickAnchorY;
    const distSq = dx * dx + dy * dy;
    const R = LAIR_EMPTY_CLICK_RADIUS_PX;
    if (
      lairEmptyClickCount === 0 ||
      now - lairEmptyClickLastAt > LAIR_EMPTY_CLICK_CHAIN_MS ||
      distSq > R * R
    ) {
      lairEmptyClickCount = 1;
      lairEmptyClickAnchorX = ev.clientX;
      lairEmptyClickAnchorY = ev.clientY;
    } else {
      lairEmptyClickCount++;
    }
    lairEmptyClickLastAt = now;
    if (lairEmptyClickCount >= 2) {
      lairEmptyClickCount = 0;
      triggerMythCuriousAtLairPoint(ev.clientX, ev.clientY);
    }
    return;
  }
  lairEmptyClickCount = 0;
  spawnPetFurryParticles(ev.clientX, ev.clientY);
  playPetFurryClickSfx();
  const now = performance.now();
  if (
    lastPettingHappinessAt > 0 &&
    now - lastPettingHappinessAt < PETTING_HAPPINESS_COOLDOWN_MS
  ) {
    const left = PETTING_HAPPINESS_COOLDOWN_MS - (now - lastPettingHappinessAt);
    if (now - lastPettingCooldownLogAt > 14000) {
      lastPettingCooldownLogAt = now;
      const mins = Math.max(1, Math.ceil(left / 60000));
      pushLog(
        "Your myth enjoys the touch, but happiness from petting is still settling — try again in about " +
          mins +
          " min."
      );
    }
    applyPettingStatRefresh();
    triggerPetAnim("anim-pet-care");
    return;
  }
  lastPettingHappinessAt = now;
  const pTgt = _resolvedMyth;
  if (!pTgt || !pTgt.lineId) return;
  const h0 = pTgt.happiness;
  pTgt.happiness = clamp(pTgt.happiness + 8, 0, 100);
  playMythMoodSfxForDelta(pTgt.happiness - h0);
  flashPetMoodPopup("🥰", _resolvedSlot === 1 ? els.petPortraitCompanion : els.petPortrait);
  pushLog("You pet your myth. Happiness rises.");
  applyPettingStatRefresh();
  triggerPetAnim("anim-pet-care");
  try { incrementAchievement("care_pet_t1"); } catch (e) {}
  try { if (pTgt.happiness >= 100) incrementAchievement("care_happy100_t1"); } catch (e) {}
}

function _playCuriousVfxOnPortrait(portrait, clientX) {
  const content = portrait && portrait.querySelector(".pet-portrait-idle-content");
  if (!content) return;
  const r = content.getBoundingClientRect();
  const cx = r.left + r.width * 0.5;
  content.classList.toggle("facing-left", clientX < cx);
  playMythCuriousSfx();
  if (lairCuriousVfxClearT) {
    window.clearTimeout(lairCuriousVfxClearT);
    lairCuriousVfxClearT = 0;
  }
  content.classList.remove("anim-lair-curious-vfx");
  void content.offsetWidth;
  content.classList.add("anim-lair-curious-vfx");
  lairCuriousVfxClearT = window.setTimeout(function () {
    lairCuriousVfxClearT = 0;
    if (content && content.classList) content.classList.remove("anim-lair-curious-vfx");
  }, 980);
}

function _runPrimaryMythToLairPoint(clientX, clientY) {
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  let prob = 1.0;
  const disc = state.discipline != null ? state.discipline : 50;
  const hunger = state.hunger != null ? state.hunger : 100;
  const happiness = state.happiness != null ? state.happiness : 50;
  if (disc < 20) prob *= 0.2;
  if (hunger < 20 || happiness < 20) prob *= 0.5;
  if (Math.random() > prob) return;

  const mythCx = mythContentCenterX();
  const mythCy = mythContentCenterY();
  setIdleWalkTarget(clientX - mythCx, clientY - mythCy, 1.2);
}

export function triggerMythCuriousAtLairPoint(clientX, clientY) {
  if (!els.petPortrait || !state.lineId || battleActive || petSleepActive || lairCareActive) return;

  const myths = [];
  if (els.petPortrait && state.lineId) {
    myths.push({ slot: 0, portrait: els.petPortrait });
  }
  if (els.petPortraitCompanion && state.companion && state.companion.lineId) {
    myths.push({ slot: 1, portrait: els.petPortraitCompanion });
  }
  if (!myths.length) return;

  for (let i = 0; i < myths.length; i++) {
    const m = myths[i];
    const content = m.portrait.querySelector(".pet-portrait-idle-content");
    const r = (content || m.portrait).getBoundingClientRect();
    m.dist = Math.hypot(clientX - (r.left + r.width * 0.5), clientY - (r.top + r.height * 0.5));
  }
  myths.sort(function (a, b) { return a.dist - b.dist; });

  for (let i = 0; i < myths.length; i++) {
    const m = myths[i];
    const react = (i === 0) || (Math.random() < 0.5);
    if (!react) continue;
    _playCuriousVfxOnPortrait(m.portrait, clientX);
    if (m.slot === 0) _runPrimaryMythToLairPoint(clientX, clientY);
  }
}

/* ── food / pantry ── */

export function pantryItemCount() {
  ensureFoodInventoryState();
  let n = 0;
  const inv = state.foodInventory;
  const ids = Object.keys(inv);
  for (let i = 0; i < ids.length; i++) {
    n += Math.max(0, inv[ids[i]] | 0);
  }
  return n;
}

export function foodTypeLabel(t) {
  if (t === "meat") return "Meat";
  if (t === "veggies") return "Veggies";
  if (t === "pastries") return "Pastries";
  if (t === "fish") return "Fish";
  return String(t || "?");
}

export function foodIconFor(food) {
  if (!food) return "🍽️";
  if (food.icon) return food.icon;
  const t = food.type;
  if (t === "meat") return "🍖";
  if (t === "veggies") return "🥬";
  if (t === "pastries") return "🥐";
  if (t === "fish") return "🐟";
  return "🍽️";
}

function inventoryItemVisualHtml(item, fallbackIcon, extraClass) {
  const classes = "item-icon" + (extraClass ? " " + extraClass : "");
  if (item && item.asset) {
    return '<img class="' + classes + '" src="' + escapeHtml(item.asset) + '" alt="" aria-hidden="true">';
  }
  return '<span class="game-emoji' + (extraClass ? " " + extraClass : "") + '" aria-hidden="true">' + fallbackIcon + "</span>";
}

export function foodPreferenceTier(lineId, foodType) {
  const p = LINE_FOOD_PREFS[lineId];
  if (!p || !foodType) return "mediocre";
  if (foodType === p.favorite) return "favorite";
  if (foodType === p.hate) return "hate";
  return "mediocre";
}

export function lineFoodPrefSummary(lineId) {
  const p = LINE_FOOD_PREFS[lineId];
  if (!p) return "";
  return (
    "This lineage favors " +
    foodTypeLabel(p.favorite) +
    ", tolerates " +
    foodTypeLabel(p.mediocre) +
    ", and dislikes " +
    foodTypeLabel(p.hate) +
    "."
  );
}

export function applyFoodItemEffect(foodDef, slot) {
  slot = (slot != null ? slot : _careTargetSlot);
  const myth = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  const mLineId = _targetMythLineId();
  const m = FOOD_EFFECTIVENESS_MULT;
  const mL = LINES[mLineId];
  const node = mL && getCurrentNode(mL, myth.nodeKey);
  const stage = node && node.stage != null ? node.stage : 0;
  const hungerStageMult = 1 / (1 + stage * HUNGER_FEED_STAGE_K);
  const tier = foodPreferenceTier(mLineId, foodDef.type);
  const fIco = foodIconFor(foodDef);
  if (tier === "favorite") {
    myth.hunger = clamp(myth.hunger + Math.round(24 * m * hungerStageMult), 0, 100);
    myth.happiness = clamp(myth.happiness + Math.round(7 * m), 0, 100);
    pushLog(fIco + " " + foodDef.name + " hit the spot — a favorite taste.");
  } else if (tier === "hate") {
    myth.hunger = clamp(myth.hunger + Math.round(9 * m * hungerStageMult), 0, 100);
    myth.happiness = clamp(myth.happiness - Math.round(15 * m), 0, 100);
    myth.discipline = clamp((myth.discipline != null ? myth.discipline : 0) - Math.round(3 * m), 0, 100);
    pushLog(fIco + " " + foodDef.name + " goes down wrong — mood and bearing both suffer.");
  } else {
    myth.hunger = clamp(myth.hunger + Math.round(14 * m * hungerStageMult), 0, 100);
    pushLog(fIco + " " + foodDef.name + " fills the belly — plain fare, no lift in mood.");
  }
  try {
    if (slot === 0) {
      incrementAchievement("care_feed_t1");
      if (tier === "favorite") incrementAchievement("care_fav_food_t1");
      if (myth.hunger >= 100) checkAchievement("sec_full_belly", 1);
      if (myth.happiness >= 100) incrementAchievement("care_happy100_t1");
    }
  } catch (e) {}
  return tier;
}

export function consumeFoodById(foodId) {
  return tryEnqueueFoodCareSequence(foodId);
}

export function openFoodChoiceModal(extraCallback) {
  ensureFoodInventoryState();
  setFoodChoiceExtraCallback(typeof extraCallback === "function" ? extraCallback : null);
  const _ftm = _targetMyth();
  if (state.demand) clearDemandWindowTimers();
  if (_ftm.hunger >= 100) {
    pushLog("Your myth turns away — already full.");
    playMythRefuseFoodSfx();
    triggerPetAnim("anim-feed-refuse");
    flashPetMoodPopup("🙅");
    setFoodChoiceExtraCallback(null);
    if (state.demand) startDemandResponseTimer();
    return;
  }
  if (!FOODS.length) {
    pushLog("No provisions are defined.");
    setFoodChoiceExtraCallback(null);
    if (state.demand) startDemandResponseTimer();
    return;
  }
  const n = pantryItemCount();
  if (n <= 0) {
    pushLog("Pantry is empty — win battles for a chance to salvage food.");
    setFoodChoiceExtraCallback(null);
    if (state.demand) startDemandResponseTimer();
    return;
  }
  if (els.modalFoodChoiceSub) {
    els.modalFoodChoiceSub.textContent = _targetMythLineId() ? lineFoodPrefSummary(_targetMythLineId()) : "";
  }
  refreshFoodChoiceModalList();
  if (els.modalFoodChoice) els.modalFoodChoice.classList.add("open");
  refreshPlayBallButton();
}

export function closeFoodChoiceModal() {
  if (els.modalFoodChoice) els.modalFoodChoice.classList.remove("open");
  if (pendingPantryCareItems.length > 0) {
    const batch = pendingPantryCareItems.slice();
    const batchSlot = (batch[0] && batch[0].slot != null) ? batch[0].slot : 0;
    pendingPantryCareItems.length = 0;
    careSequenceQueue.push({ kind: "pantryFloor", items: batch, slot: batchSlot });
    resumeBattleAudioIfNeeded();
    pumpCareQueue();
  }
  setFoodChoiceExtraCallback(null);
  if (state.demand) startDemandResponseTimer();
  refreshPlayBallButton();
}

export function renderPantryLine() {
  if (!els.valPantry) return;
  if (!state || !state.lineId) {
    els.valPantry.textContent = "";
    return;
  }
  const inv = state.foodInventory;
  const chunks = [];
  for (let i = 0; i < FOODS.length; i++) {
    const f = FOODS[i];
    const c = Math.max(0, inv[f.id] | 0);
    if (c <= 0) continue;
    chunks.push(
      '<span class="pantry-chip" title="' +
        escapeHtml(f.name) +
        '">' + inventoryItemVisualHtml(f, foodIconFor(f)) + "×" +
        c +
        "</span>"
    );
  }
  if (!chunks.length) {
    els.valPantry.textContent = "Pantry: empty — win battles for food. Use 🍖 when you have some.";
  } else {
    els.valPantry.innerHTML =
      '<span class="pantry-label">Pantry:</span> ' +
      chunks.join(" ") +
      ' <span class="pantry-hint">· 🍖 to eat</span>';
  }
}

export function refreshFoodChoiceModalList() {
  ensureFoodInventoryState();
  if (!els.modalFoodChoiceList || !state || !state.lineId) return;
  const inv = state.foodInventory;
  const rows = [];
  for (let i = 0; i < FOODS.length; i++) {
    const f = FOODS[i];
    const c = Math.max(0, inv[f.id] | 0);
    if (c <= 0) continue;
    const tier = foodPreferenceTier(state.lineId, f.type);
    const prefNote =
      tier === "favorite" ? "Favorite" : tier === "hate" ? "Disliked" : "Mediocre";
    rows.push(
      '<article class="food-choice-row food-choice-row--' + tier + '">' +
        '<div class="food-choice-visual">' +
          inventoryItemVisualHtml(f, foodIconFor(f), "food-choice-art") +
          '<span class="food-choice-stock" aria-label="' + c + ' in pantry">×' + c + '</span>' +
        '</div>' +
        '<div class="food-choice-copy"><strong>' + escapeHtml(f.name) + '</strong>' +
          '<span class="food-choice-type">' + escapeHtml(foodTypeLabel(f.type)) + '</span>' +
          '<span class="food-choice-pref">' + escapeHtml(prefNote) + '</span>' +
        '</div>' +
        '<button type="button" class="food-use-btn" data-food-id="' + escapeHtml(f.id) + '">Feed</button>' +
      '</article>'
    );
  }
  els.modalFoodChoiceList.innerHTML =
    rows.length > 0
      ? rows.join("")
      : '<div class="food-choice-empty"><span aria-hidden="true">🧺</span><strong>Pantry is empty</strong><p>Win battles for a chance to salvage food.</p></div>';
}

export function refreshFoodChoiceModalListIfOpen() {
  if (els.modalFoodChoice && els.modalFoodChoice.classList.contains("open")) {
    refreshFoodChoiceModalList();
  }
}

export function tryEnqueueFoodCareSequence(foodId) {
  ensureFoodInventoryState();
  if (!state || !state.lineId || battleActive || petSleepActive || lairCareActive) return false;
  const _etm = _targetMyth();
  if (_etm.hunger >= 100) {
    pushLog("Your myth refuses another bite — hunger is full.");
    playMythRefuseFoodSfx();
    triggerPetAnim("anim-feed-refuse");
    flashPetMoodPopup("🙅");
    return false;
  }
  const c = Math.max(0, state.foodInventory[foodId] | 0);
  if (c <= 0) return false;
  const foodDef = FOOD_BY_ID[foodId];
  if (!foodDef) return false;
  const demandExtra = pendingPantryCareItems.length === 0 ? foodChoiceExtraCallback : null;
  if (pendingPantryCareItems.length === 0) setFoodChoiceExtraCallback(null);
  state.foodInventory[foodId] = c - 1;
  if (state.foodInventory[foodId] <= 0) delete state.foodInventory[foodId];
  pendingPantryCareItems.push({ foodDef: foodDef, demandExtra: demandExtra, slot: _careTargetSlot });
  refreshFoodChoiceModalList();
  return true;
}

/* ── relic ── */

export function reserveRelicItemForCareSequence(relicId) {
  ensureRelicInventoryState();
  const def = RELIC_BY_ID[relicId];
  if (!def) return null;
  const n = Math.max(0, state.relicInventory[relicId] | 0);
  if (n <= 0) return null;
  if (_targetMyth().hunger < 15) {
    pushLog("Your myth is too hungry to offer relics. Feed from the pantry first.");
    return null;
  }
  state.relicInventory[relicId] = n - 1;
  if (state.relicInventory[relicId] <= 0) delete state.relicInventory[relicId];
  return def;
}

export function closeRelicInventoryModal() {
  if (els.modalRelicInventory) els.modalRelicInventory.classList.remove("open");
  if (pendingRelicCareItems.length > 0) {
    const batch = pendingRelicCareItems.slice();
    const batchSlot = (batch[0] && batch[0].slot != null) ? batch[0].slot : 0;
    pendingRelicCareItems.length = 0;
    careSequenceQueue.push({ kind: "relicFloor", items: batch, slot: batchSlot });
    resumeBattleAudioIfNeeded();
    pumpCareQueue();
  }
}

export function renderRelicInventoryList() {
  if (!els.relicInventoryList) return;
  ensureRelicInventoryState();
  const rows = [];
  const canOffer = state.hunger >= 15;
  for (let i = 0; i < RELIC_ITEMS.length; i++) {
    const r = RELIC_ITEMS[i];
    const c = Math.max(0, state.relicInventory[r.id] | 0);
    if (c <= 0) continue;
    const amt = Number(r.influence) || 6;
    const regionLabel = REGION_LABEL[r.region] || r.region;
    const ico = String(r.icon || "🏺");
    const disabled = !canOffer;
    const metaExtra = !canOffer ? " · Need hunger ≥ 15 to offer" : "";
    rows.push(
      '<div class="food-choice-row"><div>' +
        inventoryItemVisualHtml(r, ico, "relic-row-ico") + " <strong>" +
        escapeHtml(r.name) +
        '</strong><div class="food-choice-meta">' +
        escapeHtml(regionLabel) +
        " influence +" +
        amt +
        " · ×" +
        c +
        metaExtra +
        "</div></div><button type=\"button\" class=\"food-use-btn\" data-relic-id=\"" +
        escapeHtml(r.id) +
        '"' +
        (disabled ? " disabled" : "") +
        ">Offer</button></div>"
    );
  }
  if (!rows.length) {
    els.relicInventoryList.innerHTML =
      '<div class="food-choice-row"><div><strong>No relics in inventory</strong><div class="food-choice-meta">Win battles or indulge relic demands to earn offerings.</div></div></div>';
  } else {
    els.relicInventoryList.innerHTML = rows.join("");
  }
}

export function openRelicInventoryModal() {
  if (!els.modalRelicInventory) return;
  if (els.modalRelicInventorySub) {
    els.modalRelicInventorySub.textContent =
      "Each offering adds regional influence and costs 8 hunger. " +
      (state.hunger < 15
        ? "You're too hungry to offer relics — open the pantry (🍖) and eat first."
        : "You have enough hunger to offer.");
  }
  renderRelicInventoryList();
  els.modalRelicInventory.classList.add("open");
}

export function closeRelicConsumeModal() {
  setPendingRelicConsumeId(null);
  if (els.modalRelicConsume) els.modalRelicConsume.classList.remove("open");
}

export function openRelicConsumeConfirm(relicId) {
  const def = RELIC_BY_ID[relicId];
  if (!def || !els.modalRelicConsume) return;
  setPendingRelicConsumeId(relicId);
  if (els.modalRelicConsumeTitle) {
    els.modalRelicConsumeTitle.textContent = (def.icon || "🏺") + " " + def.name;
  }
  if (els.modalRelicConsumeDesc) {
    els.modalRelicConsumeDesc.textContent =
      (def.icon || "🏺") +
      " " +
      def.description +
      " Grants +" +
      (Number(def.influence) || 6) +
      " " +
      REGION_LABEL[def.region] +
      " influence. Costs 8 hunger (need at least 15 to offer).";
  }
  els.modalRelicConsume.classList.add("open");
}

export function confirmPendingRelicConsume() {
  const id = pendingRelicConsumeId;
  if (!id) return;
  if (battleActive || petSleepActive || lairCareActive) return;
  const def = reserveRelicItemForCareSequence(id);
  if (!def) return;
  closeRelicConsumeModal();
  pendingRelicCareItems.push({ def: def, slot: _careTargetSlot });
  renderRelicInventoryList();
}

export function refreshRelicInventoryModalIfOpen() {
  if (els.modalRelicInventory && els.modalRelicInventory.classList.contains("open")) {
    renderRelicInventoryList();
  }
}

/* ── care sequences (lair floor animations) ── */

export function careSequenceBerryBusy() {
  if (lairCareActive) return true;
  for (let i = 0; i < careSequenceQueue.length; i++) {
    if (careSequenceQueue[i].kind === "berry") return true;
  }
  return careSequenceActive && careSequenceCurrentJobKind === "berry";
}

/** True while myth is in eating animations, food picker, play-ball minigame, or queued care. */
export function careBlocksAdventure() {
  if (playBallActive) return true;
  if (lairCareActive) return true;
  if (careSequenceActive) return true;
  if (careSequenceQueue.length > 0) return true;
  if (els.modalFoodChoice && els.modalFoodChoice.classList.contains("open")) return true;
  return false;
}

export function pumpCareQueue() {
  if (careSequenceActive) return;
  const job = careSequenceQueue.shift();
  if (!job) return;
  careSequenceActive = true;
  careSequenceCurrentJobKind = job.kind;
  runCareSequenceJob(job)
    .then(function () {
      careSequenceCurrentJobKind = null;
      careSequenceActive = false;
      updateSpiritBerryUi();
      refreshPlayBallButton();
      pumpCareQueue();
    })
    .catch(function () {
      careSequenceCurrentJobKind = null;
      careSequenceActive = false;
      updateSpiritBerryUi();
      refreshPlayBallButton();
      pumpCareQueue();
    });
}

export function runCareSequenceJob(job) {
  if (!state || !state.lineId) return Promise.resolve();
  if (battleActive || petSleepActive) return Promise.resolve();
  if (job.kind === "pantryFloor") {
    return runPantryFloorBatch(job.items, job.slot || 0);
  }
  if (job.kind === "berry") {
    ensureSpiritBerryRipeAt();
    const slot = job.slot != null ? job.slot : _careTargetSlot;
    const tgt = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
    if (Date.now() < state.spiritBerryRipeAt || tgt.hunger >= 100) {
      return Promise.resolve();
    }
    return runBerryLairFloorSequence(slot);
  }
  if (job.kind === "relicFloor") {
    return runRelicFloorBatch(job.items, job.slot || 0);
  }
  if (job.kind === "evolution") {
    return Promise.resolve(job.fn()).then(function () {});
  }
  return Promise.resolve();
}

export function enqueueEvolutionJob(fn) {
  careSequenceQueue.push({ kind: "evolution", fn: fn });
  pumpCareQueue();
}

export function endLairCareAndResumeIdle() {
  _activeLairPortrait = null;
  setLairCareActive(false);
  const resumeX = careChaseX;
  careChaseX = 0;
  careApproachY = 0;
  restartPetIdle(resumeX, 0);
  saveGameState();
  refreshPlayBallButton();
}

/* ═══════════════════════════════════════════════════════
   PLAY BALL
   ═══════════════════════════════════════════════════════ */

function isPlayCooldownActive() {
  return (state.playCooldownEndAt || 0) > Date.now();
}

function formatPlayCooldown() {
  const left = Math.max(0, (state.playCooldownEndAt || 0) - Date.now());
  const sec = Math.ceil(left / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function startPlayCooldownTicker() {
  if (playCooldownIntervalId) clearInterval(playCooldownIntervalId);
  if (!els.btnPlay) return;
  els.btnPlay.disabled = true;
  els.btnPlay.classList.add("play-cooldown");
  els.btnPlay.setAttribute("data-cooldown", formatPlayCooldown());
  playCooldownIntervalId = setInterval(function () {
    if (!isPlayCooldownActive()) {
      clearInterval(playCooldownIntervalId);
      playCooldownIntervalId = null;
      if (els.btnPlay) {
        els.btnPlay.classList.remove("play-cooldown");
        els.btnPlay.removeAttribute("data-cooldown");
      }
      refreshPlayBallButton();
      return;
    }
    if (els.btnPlay) els.btnPlay.setAttribute("data-cooldown", formatPlayCooldown());
  }, 1000);
}

export function resumePlayCooldownIfNeeded() {
  if (isPlayCooldownActive()) startPlayCooldownTicker();
  refreshPlayBallButton();
}

export function refreshPlayBallButton() {
  var count = state.playBalls || 0;
  if (els.playBallCount) {
    els.playBallCount.textContent = count > 0 ? String(count) : "";
    els.playBallCount.setAttribute("data-count", String(count));
  }
  var block = petSleepActive || battleActive || careBlocksAdventure();
  if (els.btnPlay && !els.btnPlay.classList.contains("play-cooldown")) {
    els.btnPlay.disabled = count <= 0 || block;
  }
  if (els.btnAdventure) {
    els.btnAdventure.disabled = block;
  }
  refreshBondButton();
}

export function refreshBondButton() {
  if (!els.btnBond) return;
  const hasCompanion = !!(state && state.companion && state.companion.lineId);
  if (!hasCompanion) {
    els.btnBond.hidden = true;
    els.btnBond.disabled = true;
    return;
  }
  els.btnBond.hidden = false;
  const block = petSleepActive || battleActive || careBlocksAdventure();
  const count = state.playBalls || 0;
  els.btnBond.disabled = block || count <= 0;
}

function spawnKickBurst(layer, ballEl) {
  if (!layer || !ballEl) return;
  const lr = layer.getBoundingClientRect();
  const br = ballEl.getBoundingClientRect();
  const burst = document.createElement("div");
  burst.className = "lair-ball-kick-burst";
  burst.style.left = (br.left + br.width * 0.5 - lr.left) + "px";
  burst.style.top = (br.top + br.height * 0.5 - lr.top) + "px";
  layer.appendChild(burst);
  setTimeout(function () { if (burst.parentNode) burst.remove(); }, 450);
}

function spawnWallHit(layer, side) {
  if (!layer) return;
  const hit = document.createElement("div");
  hit.className = "lair-ball-wall-hit lair-ball-wall-hit--" + side;
  layer.appendChild(hit);
  setTimeout(function () { if (hit.parentNode) hit.remove(); }, 400);
}

function animateBallBounce(ballEl, targetXPct) {
  return new Promise(function (resolve) {
    ballEl.classList.add("lair-ball--bouncing", "lair-ball--arc");
    ballEl.style.setProperty("--lair-drop-x", targetXPct + "%");
    ballEl.style.left = targetXPct + "%";
    setTimeout(function () {
      ballEl.classList.remove("lair-ball--bouncing", "lair-ball--arc");
      resolve();
    }, PLAY_BOUNCE_MS);
  });
}

export function startPlayBall(slot) {
  if (battleActive || petSleepActive || lairCareActive || playBallActive) return;
  if (isPlayCooldownActive()) return;
  if ((state.playBalls || 0) <= 0) return;
  const playSlot = (slot != null ? slot : _careTargetSlot);
  const playMyth = (playSlot === 1 && state.companion && state.companion.lineId) ? state.companion : state;

  state.playBalls = (state.playBalls || 0) - 1;
  refreshPlayBallButton();
  playBallActive = true;
  const layer = els.lairDropLayer;
  _activeLairPortrait = (playSlot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  const portrait = _lairPortrait();
  if (!layer || !portrait || !state.lineId) {
    playBallActive = false;
    _activeLairPortrait = null;
    return;
  }

  const reduced = prefersReducedMotionCare();
  beginLairCareAndFreezeIdle();
  resumeBattleAudioIfNeeded();

  var ballXPct = 12 + Math.random() * 76;
  var ballEl = document.createElement("span");
  ballEl.className = "lair-ball game-emoji lair-ball--falling";
  ballEl.textContent = "\u26BD";
  ballEl.style.setProperty("--lair-drop-x", ballXPct + "%");
  if (!reduced) {
    ballEl.style.animationDuration = PLAY_BALL_FALL_MS + "ms";
  }
  layer.appendChild(ballEl);

  var fallMs = reduced ? 0 : PLAY_BALL_FALL_MS;
  var stopFall = reduced ? function () {} : startLairDropContinuousSfx(PLAY_BALL_FALL_MS);

  delayCareMs(fallMs).then(function () {
    stopFall();
    ballEl.classList.remove("lair-ball--falling");
    ballEl.classList.add("lair-ball--landed");
    spawnLairDirtExplosion(layer, ballEl, reduced);
    playLairDropThudSfx();

    flashPetMoodPopup("\uD83D\uDE32");
    return delayCareMs(reduced ? 200 : 600);
  }).then(function () {
    var kickIndex = 0;

    function doKick() {
      if (kickIndex >= 3) {
        return delayCareMs(reduced ? 100 : 300).then(finishPlay);
      }

      var runMs = reduced ? 0 : PLAY_CHASE_MS;
      return chaseMythToDropElement(ballEl, runMs, reduced).then(function () {
        return nudgeMythCloserToFoodBeforeEat(ballEl, reduced);
      }).then(function () {
        return delayCareMs(reduced ? 80 : PLAY_KICK_PAUSE_MS);
      }).then(function () {
        flashPetMoodPopup(PLAY_HAPPY_EMOJIS[kickIndex % PLAY_HAPPY_EMOJIS.length]);
        triggerPetAnim("anim-pet-care");
        playBallKickSfx();
        spawnKickBurst(layer, ballEl);
        portrait.classList.add("mood-happy");
        var kickRaster = portrait.querySelector(".pet-art-raster--multi-frame");
        if (kickRaster) {
          kickRaster.classList.remove("walking", "attacking", "hurting");
          kickRaster.classList.add("kicking-happy");
        }
        window.setTimeout(function () {
          portrait.classList.remove("mood-happy");
          if (kickRaster) kickRaster.classList.remove("kicking-happy");
        }, 900);

        var currentPct = parseFloat(ballEl.style.getPropertyValue("--lair-drop-x")) || 50;
        var targetPct;
        if (currentPct < 50) {
          targetPct = 78 + Math.random() * 10;
        } else {
          targetPct = 12 + Math.random() * 10;
        }

        return animateBallBounce(ballEl, targetPct);
      }).then(function () {
        playBallBounceSfx();
        var finalPct = parseFloat(ballEl.style.getPropertyValue("--lair-drop-x")) || 50;
        spawnWallHit(layer, finalPct > 50 ? "right" : "left");

        kickIndex++;
        return delayCareMs(reduced ? 80 : 250).then(doKick);
      });
    }

    return doKick();
  }).then(function () {}).catch(function () {
    finishPlay();
  });

  function finishPlay() {
    if (ballEl && ballEl.parentNode) ballEl.remove();

    var h0 = playMyth.happiness;
    playMyth.happiness = clamp(playMyth.happiness + PLAY_HAPPINESS_GAIN, 0, 100);
    playMythMoodSfxForDelta(playMyth.happiness - h0);
    playMyth.discipline = clamp((playMyth.discipline || 0) - PLAY_DISCIPLINE_LOSS, 0, 100);
    playMyth.energy = clamp(playMyth.energy - PLAY_ENERGY_LOSS, 0, 100);

    if (els.barHappiness) setBar(els.barHappiness, els.numHappiness, playMyth.happiness);
    if (els.barDiscipline) setBar(els.barDiscipline, els.numDiscipline, playMyth.discipline || 0);
    if (els.barEnergy) setBar(els.barEnergy, els.numEnergy, playMyth.energy);

    pushLog("Your myth had fun chasing the ball! Happiness rises.");
    flashPetMoodPopup("\uD83E\uDD70");

    playBallActive = false;
    endLairCareAndResumeIdle();

    try {
      var xpRewards = awardXp(5);
      if (xpRewards && xpRewards.then) xpRewards.then(function (r) { if (r) showLevelUpIfNeeded(r); });
    } catch (e) {}
    try {
      checkAchievement("sec_first_play", 1);
      checkAchievement("sec_triple_kick", 1);
      incrementAchievement("care_play_t1");
    } catch (e) {}

    state.playCooldownEndAt = Date.now() + PLAY_COOLDOWN_MS;
    saveGameState();
    startPlayCooldownTicker();

    return Promise.resolve();
  }
}

export function delayCareMs(ms) {
  return new Promise(function (resolve) {
    window.setTimeout(resolve, ms);
  });
}

export function prefersReducedMotionCare() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function lairGlowFromRegionColor(region) {
  const hex = (REGION_COLOR && REGION_COLOR[region]) || "#6eb5ff";
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!m) {
    return { glow: "rgba(110, 181, 255, 0.55)", soft: "rgba(110, 181, 255, 0.22)" };
  }
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return {
    glow: "rgba(" + r + "," + g + "," + b + ",0.55)",
    soft: "rgba(" + r + "," + g + "," + b + ",0.22)",
  };
}

export function snapMythCenterToDropHoriz(dropEl) {
  if (!dropEl || !_lairPortrait()) return;
  updateFacingTowardDrop(dropEl);
  const sideOffset = dropCenterX(dropEl) < window.innerWidth * 0.5 ? 30 : -30;
  careChaseX += dropCenterX(dropEl) - mythContentCenterX() + sideOffset;
  applyLairIdleLayerTransform(0);
}

export function nudgeMythCloserToFoodBeforeEat(dropEl, reduced) {
  return new Promise(function (resolve) {
    if (!dropEl || !_lairPortrait() || reduced) {
      resolve();
      return;
    }
    const dr = dropEl.getBoundingClientRect();
    const p = _lairPortrait();
    const mythContent = p && p.querySelector(".pet-portrait-idle-content");
    const mythRect = mythContent ? mythContent.getBoundingClientRect() : null;
    const mythHalfH = mythRect ? mythRect.height * 0.5 : 0;
    // Aim myth's center so its bottom (feet) lands at the food's top edge — myth arrives at
    // the food instead of overshooting into it or stopping well above it.
    const targetMythCy = dr.top - mythHalfH * 0.15 - 25;
    const mythCy = mythContentCenterY();
    // Convert screen delta to world units (undo Y compression)
    let targetDy = (targetMythCy - mythCy) / _ISO_Y_FACTOR;
    targetDy = clamp(targetDy, 0, LAIR_FOOD_APPROACH_MAX_DY_PX / _ISO_Y_FACTOR);
    if (targetDy < 2.5) {
      resolve();
      return;
    }
    const _nudgeSpirit = p.querySelector(".pet-art-raster--multi-frame");
    if (_nudgeSpirit) _nudgeSpirit.classList.add("walking");
    const startY = careApproachY;
    const dur = LAIR_FOOD_APPROACH_MS;
    const t0 = performance.now();
    function frame(now) {
      const u = Math.min(1, (now - t0) / dur);
      const ease = 1 - (1 - u) * (1 - u);
      careApproachY = startY + targetDy * ease;
      applyLairIdleLayerTransform();
      if (u < 1) requestAnimationFrame(frame);
      else {
        if (_nudgeSpirit) _nudgeSpirit.classList.remove("walking");
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

export function runPantryFloorBatch(items, slot) {
  slot = slot != null ? slot : _careTargetSlot;
  _activeLairPortrait = (slot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  const layer = els.lairDropLayer;
  const portrait = _lairPortrait();
  if (!layer || !portrait || !items || !items.length || !state.lineId) return Promise.resolve();
  const batchMyth = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  const batchLineId = (batchMyth.crossLineageId || batchMyth.lineId) || (state.crossLineageId || state.lineId);
  const reduced = prefersReducedMotionCare();
  beginLairCareAndFreezeIdle();
  resumeBattleAudioIfNeeded();
  _maybeFlashOtherMythJealousy(slot);
  const floor = [];
  const stagger = reduced ? 0 : LAIR_FLOOR_DROP_STAGGER_MS;
  function dropOne(i) {
    if (i >= items.length) return Promise.resolve();
    const it = items[i];
    const icon = foodIconFor(it.foodDef);
    return spawnLairDropAndLand(layer, icon, reduced).then(function (drop) {
      const tier = foodPreferenceTier(batchLineId, it.foodDef.type);
      floor.push({
        el: drop,
        kind: "food",
        foodDef: it.foodDef,
        tier: tier,
        demandExtra: it.demandExtra,
      });
      return delayCareMs(stagger).then(function () {
        return dropOne(i + 1);
      });
    });
  }
  function consumeOne() {
    if (!floor.length) {
      endLairCareAndResumeIdle();
      renderPet();
      refreshFoodChoiceModalListIfOpen();
      refreshRelicInventoryModalIfOpen();
      return Promise.resolve();
    }
    const idx = pickNextFoodFloorIndex(floor);
    if (idx < 0) {
      endLairCareAndResumeIdle();
      renderPet();
      return Promise.resolve();
    }
    const entry = floor[idx];
    floor.splice(idx, 1);
    const runMs = reduced ? 0 : LAIR_CARE_RUN_MS;
    const tier = entry.tier;
    const eatMs = eatMsForTier(tier, reduced);
    return chaseMythToDropElement(entry.el, runMs, reduced)
      .then(function () {
        return nudgeMythCloserToFoodBeforeEat(entry.el, reduced);
      })
      .then(function () {
      const idleContent = portrait.querySelector(".pet-portrait-idle-content");
      if (idleContent) idleContent.classList.add("anim-lair-feed-munch");
      let munchIv = null;
      let vfxIv = null;
      if (!reduced) {
        munchIv = window.setInterval(function () {
          playLairMunchBurstSfx(tier);
        }, 300);
        playLairMunchBurstSfx(tier);
        vfxIv = window.setInterval(function () {
          spawnPetEatVfx(tier, portrait);
        }, 620);
      }
      spawnPetEatVfx(tier, portrait);
      return delayCareMs(eatMs).then(function () {
        if (munchIv !== null) clearInterval(munchIv);
        if (vfxIv !== null) clearInterval(vfxIv);
        if (idleContent) idleContent.classList.remove("anim-lair-feed-munch");
        if (entry.el.parentNode) entry.el.remove();
        careApproachY = 0;
        applyLairIdleLayerTransform(0);
        const happyBeforeFood = batchMyth.happiness;
        const foodTier = applyFoodItemEffect(entry.foodDef, slot);
        if (typeof entry.demandExtra === "function") entry.demandExtra();
        playMythMoodSfxForDelta(batchMyth.happiness - happyBeforeFood);
        playMythEatSfx(foodTier);
        flashPetMoodForConsumedFoodTier(foodTier, portrait);
        refreshHudAfterLairCareEat();
        return consumeOne();
      });
      });
  }
  return dropOne(0).then(function () {
    return consumeOne();
  });
}

export function runBerryLairFloorSequence(slot) {
  slot = slot != null ? slot : _careTargetSlot;
  const tgt = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  _activeLairPortrait = (slot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  const layer = els.lairDropLayer;
  const portrait = _lairPortrait();
  if (!layer || !portrait || !state.lineId) return Promise.resolve();
  const reduced = prefersReducedMotionCare();
  const tier = "berry";
  beginLairCareAndFreezeIdle();
  resumeBattleAudioIfNeeded();
  _maybeFlashOtherMythJealousy(slot);
  const berryImg = document.createElement("img");
  berryImg.src = "assets/art/spirit-berry.png";
  berryImg.className = "lair-drop-berry-img";
  berryImg.alt = "";
  return spawnLairDropAndLand(layer, berryImg, reduced).then(function (drop) {
    const runMs = reduced ? 0 : LAIR_CARE_RUN_MS;
    const eatMs = eatMsForTier("berry", reduced);
    return chaseMythToDropElement(drop, runMs, reduced)
      .then(function () {
        return nudgeMythCloserToFoodBeforeEat(drop, reduced);
      })
      .then(function () {
      const idleContent = portrait.querySelector(".pet-portrait-idle-content");
      if (idleContent) idleContent.classList.add("anim-lair-feed-munch");
      let munchIv = null;
      let vfxIv = null;
      if (!reduced) {
        munchIv = window.setInterval(function () {
          playLairMunchBurstSfx(tier);
        }, 300);
        playLairMunchBurstSfx(tier);
        vfxIv = window.setInterval(function () {
          spawnPetEatVfx(tier, portrait);
        }, 620);
      }
      spawnPetEatVfx(tier, portrait);
      return delayCareMs(eatMs).then(function () {
        if (munchIv !== null) clearInterval(munchIv);
        if (vfxIv !== null) clearInterval(vfxIv);
        if (idleContent) idleContent.classList.remove("anim-lair-feed-munch");
        if (drop.parentNode) drop.remove();
        const h0 = tgt.happiness;
        tgt.hunger = clamp(tgt.hunger + 12, 0, 100);
        tgt.happiness = clamp(tgt.happiness + 1, 0, 100);
        playMythMoodSfxForDelta(tgt.happiness - h0);
        playMythEatSfx("berry");
        flashPetMoodForConsumedFoodTier("berry", portrait);
        state.spiritBerryRipeAt = Date.now() + SPIRIT_BERRY_GROW_MS;
        pushLog("Your myth savors the spirit berry — hunger eases (+12), mood lifts a little.");
        const activeSlot = state.activeMythTab || 0;
        if (activeSlot === slot && els.barHunger && els.numHunger) setBar(els.barHunger, els.numHunger, tgt.hunger);
        portrait.classList.toggle("pet-portrait--hungry", tgt.hunger <= 20);
        endLairCareAndResumeIdle();
        renderPet();
        refreshFoodChoiceModalListIfOpen();
        refreshRelicInventoryModalIfOpen();
      });
      });
  });
}

export function runRelicFloorBatch(items, slot) {
  slot = slot != null ? slot : _careTargetSlot;
  _activeLairPortrait = (slot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  const layer = els.lairDropLayer;
  const portrait = _lairPortrait();
  const batchMyth = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  if (!layer || !portrait || !items || !items.length || !state.lineId) return Promise.resolve();
  const reduced = prefersReducedMotionCare();
  beginLairCareAndFreezeIdle();
  resumeBattleAudioIfNeeded();
  const floor = [];
  const stagger = reduced ? 0 : LAIR_FLOOR_DROP_STAGGER_MS;
  function dropOne(i) {
    if (i >= items.length) return Promise.resolve();
    const it = items[i];
    const icon = String(it.def.icon || "🏺");
    return spawnLairDropAndLand(layer, icon, reduced).then(function (drop) {
      floor.push({ el: drop, kind: "relic", def: it.def });
      return delayCareMs(stagger).then(function () {
        return dropOne(i + 1);
      });
    });
  }
  function consumeOne() {
    if (!floor.length) {
      endLairCareAndResumeIdle();
      renderPet();
      refreshFoodChoiceModalListIfOpen();
      refreshRelicInventoryModalIfOpen();
      return Promise.resolve();
    }
    const idx = pickNextRelicFloorIndex(floor);
    if (idx < 0) {
      endLairCareAndResumeIdle();
      renderPet();
      return Promise.resolve();
    }
    const entry = floor[idx];
    floor.splice(idx, 1);
    const def = entry.def;
    const region = def.region;
    const glow = lairGlowFromRegionColor(region);
    const runMs = reduced ? 0 : LAIR_CARE_RUN_MS;
    const phaseMs = reduced ? LAIR_CARE_REDUCED_EAT_MS : LAIR_CARE_RELIC_MS;
    return chaseMythToDropElement(entry.el, runMs, reduced).then(function () {
      portrait.style.setProperty("--lair-relic-glow", glow.glow);
      portrait.style.setProperty("--lair-relic-glow-soft", glow.soft);
      portrait.setAttribute("data-influence-region", String(region || ""));
      const idleContent = portrait.querySelector(".pet-portrait-idle-content");
      if (idleContent) idleContent.classList.add("anim-lair-relic-influence-inner");
      let relicIv = null;
      if (!reduced) {
        relicIv = window.setInterval(function () {
          playLairRelicInfluenceBurstSfx(region);
        }, 360);
        playLairRelicInfluenceBurstSfx(region);
      }
      return delayCareMs(phaseMs).then(function () {
        if (relicIv !== null) clearInterval(relicIv);
        if (idleContent) idleContent.classList.remove("anim-lair-relic-influence-inner");
        portrait.style.removeProperty("--lair-relic-glow");
        portrait.style.removeProperty("--lair-relic-glow-soft");
        portrait.removeAttribute("data-influence-region");
        if (entry.el.parentNode) entry.el.remove();
        const amt = Number(def.influence) || 6;
        batchMyth.hunger = clamp(batchMyth.hunger - 8, 0, 100);
        batchMyth.influence[def.region] = (batchMyth.influence[def.region] || 0) + amt;
        const h0 = batchMyth.happiness;
        batchMyth.happiness = clamp(batchMyth.happiness + 2, 0, 100);
        playMythMoodSfxForDelta(batchMyth.happiness - h0);
        flashPetMoodForConsumedRelic(def);
        pushLog(
          "Offered " +
            (def.icon || "🏺") +
            " " +
            def.name +
            ". " +
            REGION_LABEL[def.region] +
            " influence +" +
            amt +
            "."
        );
        refreshHudAfterLairCareEat();
        return consumeOne();
      });
    });
  }
  return dropOne(0).then(function () {
    return consumeOne();
  });
}

export function scheduleLairRunFootsteps(runMs) {
  if (runMs < 220) return;
  const frac = [0, 0.23, 0.48, 0.74];
  const used = {};
  for (let i = 0; i < frac.length; i++) {
    const t = Math.round(runMs * frac[i]);
    if (t >= runMs - 50 || used[t]) continue;
    used[t] = 1;
    window.setTimeout(function () {
      playAdventureRunFootstepSfx();
    }, t);
  }
}

/* ── helpers ── */

export function pickNextFoodFloorIndex(floor) {
  const foods = [];
  for (let i = 0; i < floor.length; i++) {
    if (floor[i].kind === "food") foods.push({ i: i, tier: floor[i].tier, el: floor[i].el });
  }
  if (!foods.length) return -1;
  const mythCx = mythContentCenterX();
  const favs = foods.filter(function (x) {
    return x.tier === "favorite";
  });
  const pool = favs.length ? favs : foods;
  let best = pool[0];
  let bestD = Math.abs(dropCenterX(best.el) - mythCx);
  for (let j = 1; j < pool.length; j++) {
    const d = Math.abs(dropCenterX(pool[j].el) - mythCx);
    if (d < bestD) {
      best = pool[j];
      bestD = d;
    }
  }
  return best.i;
}

export function pickNextRelicFloorIndex(floor) {
  let bestI = -1;
  let bestD = Infinity;
  const mythCx = mythContentCenterX();
  for (let i = 0; i < floor.length; i++) {
    const d = Math.abs(dropCenterX(floor[i].el) - mythCx);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}
