import { state, battleActive, setBattleActive, petSleepActive, companionSleepActive, lairCareActive, clamp, saveGameState, getMythBySlot, isSlotActive, mythTemperament, ensureMythTemperament } from './state.js';
import { checkProximityInteraction, MIN_SEPARATION_PX, shouldSteerTowardCompanion } from './myth-interaction.js';
import { LINES, REGIONS, REGION_LABEL, REGION_MYTH_LINE, EVOLVE_RULES, SPECIAL_MOVE_INFO, SPIRIT_FOX_HIT_MS, line, nodeByKey, getCurrentNode, petArtHtml, nodeKeyForArenaCreature, FOODS, RELIC_ITEMS, ensureFoodInventoryState, ensureRelicInventoryState } from './data.js';
import { els, pushLog, renderPet, closeLairSubpanels } from './ui.js';
import { getBattleAudioCtx, resumeBattleAudioIfNeeded, playBattleHitSfx, playBattleSfx, playSpecialWindupSfx, playSpecialLaunchSfx, playMythMoodSfxForDelta, playMythLairWalkFootstepSfx, playAdventureBattleBgm, stopAdventureBattleBgm, playAdventureRunFootstepSfx, startLairAmbient, stopLairAmbient, playBattleLootChimeSfx, playBattleEvadeSfx, playAdventureFoeRoarSfx, playMythTiredSfx, playTiredRefuseSfx } from './audio.js';
import {
  cancelPetSleepSilent,
  clearDemandWindowTimers,
  stopDemandAttentionLoop,
  updateSpiritBerryUi,
  startDemandResponseTimer,
  tickHunger,
  triggerCreatureDeath,
  applyForcedActionWhileHungry,
  foodIconFor,
  refreshPlayBallButton,
  careBlocksAdventure,
} from './care.js';
import { awardXp, recordPvpOutcome, getLocalProfile } from './player-profile.js';
import { waitAndApplyAcceptorElo, writeWeeklyLeaderboardEntry } from './leaderboard.js';
import { showLevelUpIfNeeded } from './online-ui.js';
import { checkTieredAchievements, checkAchievement, incrementAchievement, setAchievementValue } from './achievements.js';
import { submitPvpResult } from './pvp.js';
import { currentUid } from './firebase-config.js';

export { careBlocksAdventure };

function createSeededRandom(seed) {
  var s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─── module-level mutable state (internal only) ─── */
let battleSpeedLinesLaunchClearT = 0;
const battleComicUiTimers = { shout: 0, impact: 0 };
let idleRaf = null;
let idleX = 0;
let idleY = 0;
let idleTX = 0;
let idleTY = 0;
let portraitIdleHoldUntil = 0;
let idleCommandedSpeedMult = 1;
let idleLastStepTime = 0;
let idleJumpUntil = 0;
// companion roam state (slot 1)
let idleXC = 60;
let idleYC = -30;
let idleTXC = 60;
let idleTYC = -30;
let idleHoldUntilC = 0;
let idleJumpUntilC = 0;
let idleJumpStartTimeC = 0;
let idleNextJumpEligibleAtC = 0;
let idleWalkFootLastAtC = 0;
let idleWalkFootParityC = 0;
let idleJumpStartTime = 0;
let idleNextJumpEligibleAt = 0;
let idleWalkFootLastAt = 0;
let idleWalkFootParity = 0;
let idleMoodFrameCounter = 0;
let lastMoodPopupAt = 0;
let petMoodPopupClearT = null;
let petTiredShakeClearT = null;
let adventureIntroFootIntervalId = null;
let adventureIntroDustIntervalId = null;

/* ── Layer 1/4/2/3/5 — co-living movement state ─────────────────────────── */
// Layer 4: each myth has a soft "favorite zone" they bias toward.
let _homePoint0 = { x: -40, y: 30 };
let _homePoint1 = { x: 50, y: 30 };
let _homePointRerollAt0 = 0;
let _homePointRerollAt1 = 0;
// Layer 2: yield cooldown — once a myth yielded, the OTHER one yields for a bit.
let _yieldCooldownUntil0 = 0;
let _yieldCooldownUntil1 = 0;
// Layer 3: anti-mirror gesture ledger. { jump: { slot, at }, ... }
const _lastGesture = { jump: { slot: -1, at: 0 }, idleHold: { slot: -1, at: 0 } };
// Layer 5: glance state — a brief deceleration + facing flick when paths cross.
let _glanceUntil0 = 0;
let _glanceUntil1 = 0;
// Layer 5: tab-switch reaction (set by ui.switchMythTab via window hook).
let _tabSwitchReactionUntil0 = 0;
let _tabSwitchReactionUntil1 = 0;

/* ═══════════════════════════════════════════════════════
   COMBAT STATS
   ═══════════════════════════════════════════════════════ */

export function battlePointsFromStage(stage) {
  return 24 + stage * 20 + stage * stage * 2;
}

export function combatStatsFromStage(stage) {
  const bp = battlePointsFromStage(stage);
  const tierMul = Math.pow(1.25, stage);
  return {
    stage: stage,
    bp: bp,
    maxHp: Math.round((40 + bp * 0.88) * tierMul),
    atk: Math.round((9 + bp * 0.24) * 0.8 * tierMul),
    speed: Math.round((42 + bp * 0.68) * tierMul),
  };
}

export function derivedCombatBp(stats) {
  return Math.floor(stats.maxHp * 0.11 + stats.atk * 2 + stats.speed * 0.14);
}

export function naturalCombatBpAtStage(stage) {
  const s = combatStatsFromStage(stage);
  return derivedCombatBp({ maxHp: s.maxHp, atk: s.atk, speed: s.speed });
}

/** Hypothetical next tier natural BP (stage 4 uses +25% as pseudo–tier-V). */
export function naturalCombatBpAtNextTier(stage) {
  if (stage < 4) return naturalCombatBpAtStage(stage + 1);
  return Math.round(naturalCombatBpAtStage(4) * 1.25);
}

/** Max combat BP from training: ~85% of next tier natural BP, not below this tier's baseline. */
export function combatBpTrainingCapForStage(stage) {
  const natHere = naturalCombatBpAtStage(stage);
  const natNext = naturalCombatBpAtNextTier(stage);
  return Math.max(8, natHere, Math.floor(0.85 * natNext));
}

export function combatBpFromStatBonuses(stage, bonusHp, bonusAtk, bonusSpd, myth) {
  const m = myth || state;
  const base = combatStatsFromStage(stage);
  const happyMul = (m && m.happiness >= 100) ? 1.02 : 1;
  const maxHp = Math.round((base.maxHp + bonusHp) * happyMul);
  const atk = Math.round((base.atk + bonusAtk) * happyMul);
  const speed = Math.round((base.speed + bonusSpd) * happyMul);
  return derivedCombatBp({ maxHp: maxHp, atk: atk, speed: speed });
}

export function clampStatBonusToCombatBpCap(stage, myth) {
  const m = myth || state;
  const bonus = m && m.statBonus;
  if (!bonus) return;
  const cap = combatBpTrainingCapForStage(stage);
  let guard = 0;
  while (combatBpFromStatBonuses(stage, bonus.hp, bonus.atk, bonus.spd, m) > cap && guard++ < 800) {
    if (bonus.atk > 0) bonus.atk--;
    else if (bonus.spd > 0) bonus.spd--;
    else if (bonus.hp > 0) bonus.hp--;
    else break;
  }
}

export function ensureStatBonusRespectsBpCap(myth) {
  const m = myth || state;
  if (!m || !m.lineId) return;
  const L = LINES[m.lineId];
  if (!L) return;
  const node = getCurrentNode(L, m.nodeKey);
  if (!node) return;
  clampStatBonusToCombatBpCap(node.stage, m);
}

export function combatStatsForPet(lineId, nodeKey, myth) {
  const m = myth || state;
  const L = LINES[lineId];
  const node = nodeByKey(L, nodeKey);
  const base = combatStatsFromStage(node.stage);
  const b = (m && m.statBonus) || { hp: 0, atk: 0, spd: 0 };
  const rb = (m && m.reincarnationBonus) || { hp: 0, atk: 0, spd: 0 };
  const happyMul = (m && m.happiness >= 100) ? 1.02 : 1;
  const _wm = (typeof window !== "undefined" && window.MythalaCity && window.MythalaCity.wisdomMultipliers)
    ? window.MythalaCity.wisdomMultipliers() : null;
  const maxHp = Math.round((base.maxHp + b.hp + rb.hp) * happyMul * (_wm ? _wm.hp : 1));
  const atk = Math.round((base.atk + b.atk + rb.atk) * happyMul * (_wm ? _wm.atk : 1));
  const speed = Math.round((base.speed + b.spd + rb.spd) * happyMul * (_wm ? _wm.spd : 1));
  return {
    name: node.name,
    lineId: lineId,
    attackStyle: lineId,
    maxHp: maxHp,
    atk: atk,
    speed: speed,
    combatBp: derivedCombatBp({ maxHp: maxHp, atk: atk, speed: speed }),
    tierBp: base.bp,
    stage: node.stage,
    specialMove: node.specialMove || "attack",
  };
}

/* ═══════════════════════════════════════════════════════
   TRAINING
   ═══════════════════════════════════════════════════════ */

export function rollCombatTraining(win, playerCombatBp, enemyCombatBp, myth) {
  const m = myth || state;
  const bonus = m.statBonus || { hp: 0, atk: 0, spd: 0 };
  m.statBonus = bonus;
  const beforeHp = bonus.hp;
  const beforeAtk = bonus.atk;
  const beforeSpd = bonus.spd;
  const keys = ["hp", "atk", "spd"];
  let added = 0;
  if (!m.lineId) {
    return {
      points: 0,
      dHp: 0,
      dAtk: 0,
      dSpd: 0,
    };
  }
  const node = getCurrentNode(LINES[m.lineId], m.nodeKey);
  if (!node) {
    return {
      points: 0,
      dHp: 0,
      dAtk: 0,
      dSpd: 0,
    };
  }
  const stage = node.stage;
  const cap = combatBpTrainingCapForStage(stage);
  let maxPoints = 0;
  if (win) {
    const pb = Math.max(0, Number(playerCombatBp) || 0);
    const eb = Math.max(0, Number(enemyCombatBp) || 0);
    if (eb < pb) maxPoints = 2 + Math.floor(Math.random() * 2);
    else maxPoints = 3 + Math.floor(Math.random() * 2);
  } else {
    maxPoints = 1 + Math.floor(Math.random() * 2);
  }
  /* Each pip is one total training point (HP/Atk/Spd +1). Try stats in random order so we still
     reach the rolled total whenever the cap allows — not just one random attempt per pip. */
  for (let p = 0; p < maxPoints; p++) {
    const order = keys.slice();
    for (let j = order.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      const tmp = order[j];
      order[j] = order[k];
      order[k] = tmp;
    }
    let placed = false;
    for (let i = 0; i < order.length; i++) {
      const kk = order[i];
      bonus[kk]++;
      if (combatBpFromStatBonuses(stage, bonus.hp, bonus.atk, bonus.spd, m) > cap) {
        bonus[kk]--;
      } else {
        added++;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  return {
    points: added,
    dHp: bonus.hp - beforeHp,
    dAtk: bonus.atk - beforeAtk,
    dSpd: bonus.spd - beforeSpd,
  };
}

/* ═══════════════════════════════════════════════════════
   ENEMY GENERATION
   ═══════════════════════════════════════════════════════ */

export function scaleEnemyPowerToPlayer(stage, playerCombatBp) {
  const s = combatStatsFromStage(stage);
  let maxHp = s.maxHp;
  let atk = s.atk;
  let speed = s.speed;
  const pc = Math.max(1, playerCombatBp || 0);
  const targetBp = Math.max(
    8,
    Math.round(pc * (0.97 + Math.random() * 0.06))
  );
  let eb = derivedCombatBp({ maxHp: maxHp, atk: atk, speed: speed });
  if (eb > 0) {
    let k = targetBp / eb;
    k = Math.max(0.82, Math.min(4, k));
    maxHp = Math.max(28, Math.round(maxHp * k));
    atk = Math.max(4, Math.round(atk * k));
    speed = Math.max(24, Math.round(speed * k));
  }
  let combatBp = derivedCombatBp({ maxHp: maxHp, atk: atk, speed: speed });
  if (combatBp > 0 && combatBp !== targetBp) {
    const f = targetBp / combatBp;
    maxHp = Math.max(28, Math.round(maxHp * f));
    atk = Math.max(4, Math.round(atk * f));
    speed = Math.max(24, Math.round(speed * f));
    combatBp = derivedCombatBp({ maxHp: maxHp, atk: atk, speed: speed });
  }
  if (combatBp > 0 && combatBp !== targetBp) {
    const f2 = targetBp / combatBp;
    maxHp = Math.max(28, Math.round(maxHp * f2));
    atk = Math.max(4, Math.round(atk * f2));
    speed = Math.max(24, Math.round(speed * f2));
    combatBp = derivedCombatBp({ maxHp: maxHp, atk: atk, speed: speed });
  }
  return {
    maxHp: maxHp,
    atk: atk,
    speed: speed,
    bp: s.bp,
    combatBp: combatBp,
  };
}

export function buildArenaLineOpponent(region, stage, playerCombatBp) {
  const lineId = REGION_MYTH_LINE[region] || "avian";
  const nodeKey = nodeKeyForArenaCreature(lineId, region, stage);
  const L = LINES[lineId];
  const node = L && nodeByKey(L, nodeKey);
  const scaled = scaleEnemyPowerToPlayer(stage, playerCombatBp);
  return {
    name: node ? node.name : "Foe",
    lineId: lineId,
    nodeKey: nodeKey,
    attackStyle: lineId,
    maxHp: scaled.maxHp,
    atk: scaled.atk,
    speed: scaled.speed,
    bp: scaled.bp,
    combatBp: scaled.combatBp,
    stage: stage,
    specialMove: (node && node.specialMove) || "attack",
  };
}

/** Natural tier stats for arena foe (no BP scaling to player). */
export function buildArenaNaturalTierOpponent(region, stage) {
  const lineId = REGION_MYTH_LINE[region] || "avian";
  const nodeKey = nodeKeyForArenaCreature(lineId, region, stage);
  const L = LINES[lineId];
  const node = L && nodeByKey(L, nodeKey);
  const nat = combatStatsFromStage(stage);
  const combatBp = derivedCombatBp({ maxHp: nat.maxHp, atk: nat.atk, speed: nat.speed });
  return {
    name: node ? node.name : "Foe",
    lineId: lineId,
    nodeKey: nodeKey,
    attackStyle: lineId,
    maxHp: nat.maxHp,
    atk: nat.atk,
    speed: nat.speed,
    bp: nat.bp,
    combatBp: combatBp,
    stage: stage,
    specialMove: (node && node.specialMove) || "attack",
  };
}

/** Average of capped ratios toward current-stage evolve gates (0 if stage ≥ 4 or no rule). */
export function adventureProgressAvg(playerCombatBp, mythSelf) {
  const self = mythSelf || state;
  const lineId = (self.crossLineageId && LINES[self.crossLineageId]) ? self.crossLineageId : self.lineId;
  const L = LINES[lineId];
  const node = getCurrentNode(L, self.nodeKey);
  if (!node || node.stage >= 4) return 0;
  const rule = EVOLVE_RULES[node.stage];
  if (!rule || rule.battles <= 0 || rule.happiness <= 0 || rule.minCombatBp <= 0) return 0;
  const pBattles = Math.min(1, Math.max(0, self.battles / rule.battles));
  const pHappy = Math.min(1, Math.max(0, self.happiness / rule.happiness));
  const pBp = Math.min(1, Math.max(0, playerCombatBp / rule.minCombatBp));
  return (pBattles + pHappy + pBp) / 3;
}

/** Single roll/build for adventure foe (intro story and battle must match). */
export function buildAdventureEnemy(region, playerCombatBp, ps, mythSelf) {
  const progressAvg = adventureProgressAvg(playerCombatBp, mythSelf);
  const isUpTierNatural = progressAvg >= 0.72 && ps < 4 && Math.random() < 0.18;
  let enemy;
  if (isUpTierNatural) {
    enemy = buildArenaNaturalTierOpponent(region, ps + 1);
  } else {
    enemy = buildArenaLineOpponent(region, ps, playerCombatBp);
    const capMult = 1 - 0.45 * progressAvg;
    const capMultClamped = Math.max(0.52, Math.min(1, capMult));
    scaleEnemyDownToMaxCombatBp(
      enemy,
      Math.max(8, Math.floor(playerCombatBp * capMultClamped))
    );
  }
  return { enemy: enemy, isUpTierNatural: isUpTierNatural };
}

export function scaleEnemyDownToMaxCombatBp(enemy, maxCombatBp) {
  const cap = Math.max(8, Math.floor(maxCombatBp));
  let bp = derivedCombatBp(enemy);
  let guard = 0;
  while (bp > cap && guard++ < 36) {
    const f = (cap * 0.998) / Math.max(1, bp);
    enemy.maxHp = Math.max(28, Math.round(enemy.maxHp * f));
    enemy.atk = Math.max(4, Math.round(enemy.atk * f));
    enemy.speed = Math.max(24, Math.round(enemy.speed * f));
    bp = derivedCombatBp(enemy);
  }
  enemy.combatBp = bp;
}

export function applyMercyPityToEnemy(enemy, playerCombatBp, pityTier) {
  const pc = Math.max(1, playerCombatBp);
  let cap = pc;
  if (pityTier >= 2) {
    cap = Math.max(8, Math.floor(pc * 0.78));
  } else if (pityTier >= 1) {
    cap = Math.max(8, Math.floor(pc * 0.88));
  }
  /* pityTier 0: cap at player BP so foe stays near parity (targetBp already ~94–102% of pc). */
  scaleEnemyDownToMaxCombatBp(enemy, cap);
}

/* ═══════════════════════════════════════════════════════
   IDLE PET SYSTEM
   ═══════════════════════════════════════════════════════ */

// Keep doubled-size sprites inside the central clearing on narrow screens.
const IDLE_LAIR_BOUND_X = 64;
const IDLE_LAIR_BOUND_Y = 32;
const IDLE_LAIR_FLOOR_Y_TOP = 32;
const IDLE_HOME_SEPARATION_PX = 72;
const IDLE_WALK_SPEED_PX_S = 34.2;
/** Min ms between soft footsteps while the myth drifts in the lair. */
const IDLE_WALK_FOOTSTEP_GAP_MS = 400;
const IDLE_JUMP_DURATION_MS = 340;
const IDLE_JUMP_MIN_GAP_MS = 2200;
const IDLE_HAPPY_JUMP_THRESHOLD = 58;

/* ── Layer 2 — predictive avoidance bands ── */
const AVOID_NOTICE_PX = 90;
const AVOID_YIELD_PX = 60;
const AVOID_STOP_PX = 35;
const YIELD_PATH_RECOOLDOWN_MS = 5000;
/* ── Layer 3 — anti-mirror windows ── */
const ANTI_MIRROR_WINDOW_MS = 1100;
const JUMP_THRESHOLD_OFFSET_SLOT1 = 7;
/* ── Layer 5 — glance + tab-reaction beats ── */
const GLANCE_DURATION_MS = 420;
const GLANCE_COOLDOWN_MS = 8000;
const TAB_REACTION_MS = 600;
let _glanceCooldownUntil = 0;

/* Layer 1 — pull a fresh temperament for a slot (or fallback if myth missing). */
function _temperFor(slot) {
  const m = getMythBySlot(slot);
  return m ? mythTemperament(m) : { tempo: 0.5, restiness: 0.5, social: 0.55, curiosity: 0.55, expressiveness: 0.55 };
}

/* Layer 1 — speed multiplier for slot. tempo 0..1 → 0.85..1.30 */
function _speedMultFor(slot) {
  const t = _temperFor(slot);
  return 0.85 + t.tempo * 0.45;
}

/* Layer 1 — idle-hold dwell range for slot. restiness 0..1 → 1500..7500 ms */
function _holdDurationFor(slot) {
  const t = _temperFor(slot);
  const lo = 1500 + t.restiness * 1800;
  const hi = lo + 1800 + t.restiness * 4200;
  return lo + Math.random() * (hi - lo);
}

/* Layer 1 — happy-jump roll probability scale. */
function _jumpProbScaleFor(slot) {
  const t = _temperFor(slot);
  return 0.6 + t.expressiveness * 1.1;
}

/* Layer 1 — minimum gap before next jump roll. */
function _jumpMinGapFor(slot) {
  const t = _temperFor(slot);
  return IDLE_JUMP_MIN_GAP_MS * (1.4 - t.expressiveness * 0.6);
}

/* Layer 4 — (re)pick a homePoint for a slot. otherHomeX/Y is the other myth's home,
 * so we can keep the homes apart. */
function _pickHomePoint(slot, otherX, otherY) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const x = (Math.random() * 2 - 1) * IDLE_LAIR_BOUND_X * 0.7;
    const y = (Math.random() * 2 - 1) * IDLE_LAIR_BOUND_Y * 0.4;
    if (otherX == null || Math.hypot(x - otherX, y - otherY) >= IDLE_HOME_SEPARATION_PX) {
      return { x: x, y: y };
    }
  }
  // fallback: deterministic offset
  return slot === 1 ? { x: 48, y: 16 } : { x: -48, y: 16 };
}

/* Layer 4 — weighted target pick: 55% random, 25% near home, 15% near
 * companion-current-target (curiosity), 5% boundary glance. */
function _pickWalkTargetWeighted(slot, fromX, fromY, otherX, otherY, otherTX, otherTY) {
  const t = _temperFor(slot);
  const home = slot === 1 ? _homePoint1 : _homePoint0;
  // Boost home weight slightly for restful temperaments, curiosity boost for curious ones
  const wRandom = 55;
  const wHome = 25 + (t.restiness - 0.5) * 18;
  const wCurious = 15 + (t.curiosity - 0.5) * 14;
  const wBoundary = 5;
  const total = wRandom + wHome + wCurious + wBoundary;
  let r = Math.random() * total;
  if ((r -= wRandom) < 0) {
    return pickIdleLairWalkTarget(fromX, fromY);
  }
  if ((r -= wHome) < 0) {
    const off = 35 + Math.random() * 50;
    const ang = Math.random() * Math.PI * 2;
    return {
      x: clamp(home.x + Math.cos(ang) * off, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X),
      y: clamp(home.y + Math.sin(ang) * off, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y),
    };
  }
  if ((r -= wCurious) < 0 && otherTX != null) {
    // Aim near where the other myth is GOING, not where it stands — looks like noticing.
    const off = 55 + Math.random() * 35;
    const ang = Math.random() * Math.PI * 2;
    return {
      x: clamp(otherTX + Math.cos(ang) * off, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X),
      y: clamp(otherTY + Math.sin(ang) * off, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y),
    };
  }
  // boundary peek — pick an edge point, look outward
  const edge = Math.random() < 0.5 ? -1 : 1;
  return {
    x: edge * IDLE_LAIR_BOUND_X * (0.78 + Math.random() * 0.18),
    y: clamp(fromY + (Math.random() * 2 - 1) * 60, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y),
  };
}

/* Layer 2 — return slot that should yield (lower priority). */
function _yieldingSlot(now) {
  const m0 = getMythBySlot(0);
  const m1 = getMythBySlot(1);
  if (!m0 || !m1) return -1;
  // Sleeping or in care job → never yield. Caller already gates lairCareActive.
  // Demand active boosts priority (others yield to it).
  let p0 = 0;
  let p1 = 0;
  if (m0.demand) p0 += 2;
  if (m1.demand) p1 += 2;
  // Lower energy yields more readily.
  p0 += (m0.energy != null ? m0.energy : 50) / 100;
  p1 += (m1.energy != null ? m1.energy : 50) / 100;
  // Recent yield cooldown: if you JUST yielded, you don't yield again immediately.
  if (now < _yieldCooldownUntil0) p0 += 5;
  if (now < _yieldCooldownUntil1) p1 += 5;
  if (p0 === p1) return 1; // tiebreaker: companion yields to player myth
  return p0 < p1 ? 0 : 1;
}

/* Layer 3 — should we suppress this gesture because the other myth just did it? */
function _shouldSuppressGesture(kind, slot, now) {
  const last = _lastGesture[kind];
  if (!last) return false;
  if (last.slot !== -1 && last.slot !== slot && now - last.at < ANTI_MIRROR_WINDOW_MS) return true;
  return false;
}

function _markGesture(kind, slot, now) {
  _lastGesture[kind] = { slot: slot, at: now };
}

/* Layer 5 — schedule a brief glance (deceleration + facing flick). */
function _triggerGlance(slot, now) {
  if (slot === 1) _glanceUntil1 = now + GLANCE_DURATION_MS;
  else _glanceUntil0 = now + GLANCE_DURATION_MS;
  _glanceCooldownUntil = now + GLANCE_COOLDOWN_MS;
}

/* Layer 5 — public hook: ui.switchMythTab calls this so myths react to selection. */
export function notifyTabSwitched(newSlot) {
  const now = performance.now();
  if (newSlot === 1) {
    _tabSwitchReactionUntil1 = now + TAB_REACTION_MS;
    _tabSwitchReactionUntil0 = now + (TAB_REACTION_MS * 0.6); // previously-selected glances briefly too
  } else {
    _tabSwitchReactionUntil0 = now + TAB_REACTION_MS;
    _tabSwitchReactionUntil1 = now + (TAB_REACTION_MS * 0.6);
  }
}

export function stopPetIdle() {
  if (idleRaf) cancelAnimationFrame(idleRaf);
  idleRaf = null;
}

export function setIdleWalkTarget(deltaX, deltaY, speedMult) {
  idleTX = clamp(idleX + deltaX, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
  idleTY = clamp(idleY + deltaY, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
  portraitIdleHoldUntil = 0;
  idleCommandedSpeedMult = speedMult != null ? speedMult : 1;
}

export function pickIdleLairWalkTarget(fromX, fromY) {
  const reach = 0.22 + Math.random() * 0.78;
  let tx = fromX + (Math.random() * 2 - 1) * IDLE_LAIR_BOUND_X * reach;
  let ty = fromY + (Math.random() * 2 - 1) * IDLE_LAIR_BOUND_Y * reach;
  tx = clamp(tx, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
  ty = clamp(ty, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
  return { x: tx, y: ty };
}

export function restartPetIdle(startX, startY) {
  stopPetIdle();
  if (battleActive || petSleepActive || !els.petPortrait) return;
  idleMoodFrameCounter = 0;
  portraitIdleHoldUntil = 0;
  idleJumpUntil = 0;
  idleNextJumpEligibleAt = 0;
  idleCommandedSpeedMult = 1;
  idleX = clamp(startX || 0, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
  idleY = clamp(startY || 0, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
  idleLastStepTime = performance.now();
  idleWalkFootLastAt = 0;
  idleWalkFootParity = 0;
  // Layer 1 — seed temperament for both myths.
  if (state && state.lineId) ensureMythTemperament(state);
  if (state && state.companion && state.companion.lineId) ensureMythTemperament(state.companion);
  // Layer 4 — pick home points kept apart by ≥120 px.
  _homePoint0 = _pickHomePoint(0, null, null);
  _homePoint1 = _pickHomePoint(1, _homePoint0.x, _homePoint0.y);
  _homePointRerollAt0 = performance.now() + 60000 + Math.random() * 60000;
  _homePointRerollAt1 = performance.now() + 60000 + Math.random() * 60000;
  const t0 = _pickWalkTargetWeighted(0, idleX, idleY, null, null, null, null);
  idleTX = t0.x;
  idleTY = t0.y;
  // Init companion at offset so they don't start overlapping
  idleXC = clamp(idleX + 48, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
  idleYC = clamp(idleY - 16, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
  idleHoldUntilC = 0;
  idleJumpUntilC = 0;
  idleNextJumpEligibleAtC = 0;
  idleWalkFootLastAtC = 0;
  idleWalkFootParityC = 0;
  const tC = _pickWalkTargetWeighted(1, idleXC, idleYC, idleX, idleY, idleTX, idleTY);
  idleTXC = tC.x;
  idleTYC = tC.y;
  // Layer 5 — clear any stale glance/reaction timers
  _glanceUntil0 = 0; _glanceUntil1 = 0;
  _tabSwitchReactionUntil0 = 0; _tabSwitchReactionUntil1 = 0;
  _glanceCooldownUntil = 0;
  const idleReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function step() {
    if (battleActive || !els.petPortrait) return;
    if (lairCareActive) return;
    const prevX = idleX;
    const prevY = idleY;
    const now = performance.now();
    const dt = Math.min(0.055, Math.max(0, (now - idleLastStepTime) / 1000));
    idleLastStepTime = now;
    const inIdleHold = now < portraitIdleHoldUntil;
    // Layer 4 — periodic homePoint re-roll
    if (now >= _homePointRerollAt0) {
      if (Math.random() < 0.3) _homePoint0 = _pickHomePoint(0, _homePoint1.x, _homePoint1.y);
      _homePointRerollAt0 = now + 60000 + Math.random() * 60000;
    }
    // Layer 1/2 — temperament-scaled speed for slot 0, with avoidance slowdown.
    const speedMult0 = _speedMultFor(0) * idleCommandedSpeedMult;
    if (!inIdleHold) {
      let dx = idleTX - idleX;
      let dy = idleTY - idleY;
      let dist = Math.hypot(dx, dy);
      if (
        !idleReducedMotion &&
        now >= idleNextJumpEligibleAt &&
        now >= idleJumpUntil &&
        state.happiness >= IDLE_HAPPY_JUMP_THRESHOLD &&
        dist > 12 &&
        !_shouldSuppressGesture("jump", 0, now)
      ) {
        const mood = clamp(
          (state.happiness - IDLE_HAPPY_JUMP_THRESHOLD) / (100 - IDLE_HAPPY_JUMP_THRESHOLD),
          0,
          1
        );
        // Layer 1 — expressiveness scales jump probability.
        const pTry = (dt / 11) * (0.35 + mood * 0.95) * _jumpProbScaleFor(0);
        if (Math.random() < pTry) {
          idleJumpStartTime = now;
          idleJumpUntil = now + IDLE_JUMP_DURATION_MS;
          idleNextJumpEligibleAt = now + _jumpMinGapFor(0) + Math.random() * 2200;
          _markGesture("jump", 0, now);
          const hop = dist * (0.3 + Math.random() * 0.22);
          idleX += (dx / dist) * hop;
          idleY += (dy / dist) * hop;
          dx = idleTX - idleX;
          dy = idleTY - idleY;
          dist = Math.hypot(dx, dy);
        }
      }
      // Layer 2 — predictive deceleration when approaching the other myth.
      let walkScale = 1;
      if (isSlotActive(1)) {
        const dToC = Math.hypot(idleXC - idleX, idleYC - idleY);
        if (dToC < AVOID_NOTICE_PX) {
          const yielding = _yieldingSlot(now);
          if (yielding === 0) {
            walkScale = 0.45;
          } else {
            walkScale = 0.78;
          }
          if (dToC < AVOID_STOP_PX && yielding === 0) {
            walkScale = 0;
            if (_yieldCooldownUntil0 < now) {
              _yieldCooldownUntil0 = now + YIELD_PATH_RECOOLDOWN_MS;
              portraitIdleHoldUntil = now + 250 + Math.random() * 450;
            }
          } else if (dToC < AVOID_YIELD_PX && yielding === 0 && _yieldCooldownUntil0 < now) {
            // Reroute slot 0 on a tangent rather than collide.
            const ang = Math.atan2(idleY - idleYC, idleX - idleXC) + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 4 + Math.random() * Math.PI / 6);
            const reach = 70 + Math.random() * 40;
            idleTX = clamp(idleX + Math.cos(ang) * reach, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
            idleTY = clamp(idleY + Math.sin(ang) * reach, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
            _yieldCooldownUntil0 = now + YIELD_PATH_RECOOLDOWN_MS;
            if (now > _glanceCooldownUntil) {
              _triggerGlance(0, now);
            }
          }
        }
      }
      // Layer 5 — glance / tab-reaction further dampens speed during the beat.
      if (now < _glanceUntil0 || now < _tabSwitchReactionUntil0) walkScale *= 0.35;
      if (dist > 0.001 && walkScale > 0) {
        const stepLen = Math.min(dist, IDLE_WALK_SPEED_PX_S * speedMult0 * walkScale * dt);
        idleX += (dx / dist) * stepLen;
        idleY += (dy / dist) * stepLen;
      }
      dist = Math.hypot(idleTX - idleX, idleTY - idleY);
      if (dist < 2.4) {
        idleCommandedSpeedMult = 1;
        // Layer 1 — restful temperaments hold more often
        const t0 = _temperFor(0);
        const holdChance = 0.25 + t0.restiness * 0.45;
        const suppressMirrorHold = _shouldSuppressGesture("idleHold", 0, now);
        if (Math.random() < holdChance && !suppressMirrorHold) {
          portraitIdleHoldUntil = now + _holdDurationFor(0);
          _markGesture("idleHold", 0, now);
          idleTX = idleX;
          idleTY = idleY;
        } else if (Math.random() < 0.15 && shouldSteerTowardCompanion(now) && t0.social >= 0.4) {
          // Gentle steer toward companion (Layer 1 social gates this).
          const off = 40 + Math.random() * 30;
          const ang = Math.random() * Math.PI * 2;
          idleTX = clamp(idleXC + Math.cos(ang) * off, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
          idleTY = clamp(idleYC + Math.sin(ang) * off, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
        } else {
          // Layer 4 — weighted target pick (random / home / curiosity / boundary)
          const t = _pickWalkTargetWeighted(0, idleX, idleY, idleXC, idleYC, idleTXC, idleTYC);
          idleTX = t.x;
          idleTY = t.y;
        }
      }
    } else {
      idleTX = idleX;
      idleTY = idleY;
    }
    const layer = els.petPortrait.querySelector(".pet-portrait-idle");
    if (layer) {
      const dvx = inIdleHold ? 0 : idleX - prevX;
      const dvy = inIdleHold ? 0 : idleY - prevY;
      const speed = Math.hypot(dvx, dvy);
      const moving = !inIdleHold && speed > 0.035;
      const content = layer.querySelector(".pet-portrait-idle-content");
      if (content && moving && Math.abs(dvx) > 0.0008) {
        content.classList.toggle("facing-left", dvx < 0);
      }
      const spirit = layer.querySelector(".pet-art-raster--multi-frame");
      if (spirit) {
        spirit.classList.toggle("walking", moving);
      }
      if (moving && !idleReducedMotion) {
        if (now - idleWalkFootLastAt >= IDLE_WALK_FOOTSTEP_GAP_MS) {
          idleWalkFootLastAt = now;
          playMythLairWalkFootstepSfx(idleWalkFootParity++);
        }
      }
      let drawY = idleY;
      if (!idleReducedMotion && now < idleJumpUntil) {
        const span = idleJumpUntil - idleJumpStartTime;
        const jt = span > 0 ? (now - idleJumpStartTime) / span : 1;
        drawY -= 22 * Math.sin(Math.PI * clamp(jt, 0, 1));
      }
      const isoY0 = drawY * 0.55;
      layer.style.transform =
        "translate(" + idleX.toFixed(1) + "px," + isoY0.toFixed(1) + "px)";
      els.petPortrait.style.zIndex = String(Math.round(100 + idleY));
    }
    idleMoodFrameCounter++;
    if (idleMoodFrameCounter >= 100) {
      idleMoodFrameCounter = 0;
      maybePetMoodPopupRoll();
    }

    // ── Companion roaming (slot 1) ──
    if (els.petPortraitCompanion && isSlotActive(1)) {
      const companionMyth = getMythBySlot(1);
      const inHoldC = now < idleHoldUntilC;
      // Layer 4 — periodic homePoint re-roll for companion
      if (now >= _homePointRerollAt1) {
        if (Math.random() < 0.3) _homePoint1 = _pickHomePoint(1, _homePoint0.x, _homePoint0.y);
        _homePointRerollAt1 = now + 60000 + Math.random() * 60000;
      }
      const speedMult1 = _speedMultFor(1);
      if (!inHoldC && !companionSleepActive) {
        let dcx = idleTXC - idleXC;
        let dcy = idleTYC - idleYC;
        let distC = Math.hypot(dcx, dcy);
        // Layer 3 — slot-staggered jump threshold so they don't both unlock at exactly 58.
        const jumpThresholdC = IDLE_HAPPY_JUMP_THRESHOLD + JUMP_THRESHOLD_OFFSET_SLOT1;
        if (!idleReducedMotion && now >= idleNextJumpEligibleAtC && now >= idleJumpUntilC &&
            companionMyth.happiness >= jumpThresholdC && distC > 12 &&
            !_shouldSuppressGesture("jump", 1, now)) {
          const moodC = clamp((companionMyth.happiness - jumpThresholdC) / (100 - jumpThresholdC), 0, 1);
          // Layer 1 — expressiveness scales jump probability.
          const pTryC = (dt / 11) * (0.35 + moodC * 0.95) * _jumpProbScaleFor(1);
          if (Math.random() < pTryC) {
            idleJumpStartTimeC = now;
            idleJumpUntilC = now + IDLE_JUMP_DURATION_MS;
            idleNextJumpEligibleAtC = now + _jumpMinGapFor(1) + Math.random() * 2200;
            _markGesture("jump", 1, now);
            idleXC += (dcx / distC) * distC * (0.3 + Math.random() * 0.22);
            idleYC += (dcy / distC) * distC * (0.3 + Math.random() * 0.22);
            dcx = idleTXC - idleXC; dcy = idleTYC - idleYC;
            distC = Math.hypot(dcx, dcy);
          }
        }
        // Layer 2 — predictive deceleration mirrors slot 0.
        let walkScaleC = 1;
        const dToOther = Math.hypot(idleX - idleXC, idleY - idleYC);
        if (dToOther < AVOID_NOTICE_PX) {
          const yielding = _yieldingSlot(now);
          if (yielding === 1) walkScaleC = 0.45;
          else walkScaleC = 0.78;
          if (dToOther < AVOID_STOP_PX && yielding === 1) {
            walkScaleC = 0;
            if (_yieldCooldownUntil1 < now) {
              _yieldCooldownUntil1 = now + YIELD_PATH_RECOOLDOWN_MS;
              idleHoldUntilC = now + 250 + Math.random() * 450;
            }
          } else if (dToOther < AVOID_YIELD_PX && yielding === 1 && _yieldCooldownUntil1 < now) {
            // Layer 2 — reroute the yielding myth on a tangent rather than colliding.
            const ang = Math.atan2(idleYC - idleY, idleXC - idleX) + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 4 + Math.random() * Math.PI / 6);
            const reach = 70 + Math.random() * 40;
            idleTXC = clamp(idleXC + Math.cos(ang) * reach, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
            idleTYC = clamp(idleYC + Math.sin(ang) * reach, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
            _yieldCooldownUntil1 = now + YIELD_PATH_RECOOLDOWN_MS;
            // Layer 5 — passing-glance triggered when crossing close.
            if (now > _glanceCooldownUntil) {
              _triggerGlance(1, now);
            }
          }
        }
        // Layer 5 — glance / tab reaction
        if (now < _glanceUntil1 || now < _tabSwitchReactionUntil1) walkScaleC *= 0.35;
        if (distC > 0.001 && walkScaleC > 0) {
          const stepC = Math.min(distC, IDLE_WALK_SPEED_PX_S * speedMult1 * walkScaleC * dt);
          idleXC += (dcx / distC) * stepC;
          idleYC += (dcy / distC) * stepC;
        }
        distC = Math.hypot(idleTXC - idleXC, idleTYC - idleYC);
        if (distC < 2.4) {
          const t1 = _temperFor(1);
          const holdChanceC = 0.25 + t1.restiness * 0.45;
          const suppressMirrorHoldC = _shouldSuppressGesture("idleHold", 1, now);
          if (Math.random() < holdChanceC && !suppressMirrorHoldC) {
            idleHoldUntilC = now + _holdDurationFor(1);
            _markGesture("idleHold", 1, now);
          } else if (Math.random() < 0.15 && shouldSteerTowardCompanion(now) && t1.social >= 0.4) {
            const off = 40 + Math.random() * 30;
            const ang = Math.random() * Math.PI * 2;
            idleTXC = clamp(idleX + Math.cos(ang) * off, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
            idleTYC = clamp(idleY + Math.sin(ang) * off, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
          } else {
            const tC = _pickWalkTargetWeighted(1, idleXC, idleYC, idleX, idleY, idleTX, idleTY);
            idleTXC = tC.x; idleTYC = tC.y;
          }
        }
      }

      // Layer 2 — soft separation (replaces hard 50/50 push). Only triggers when the
      // predictive avoidance failed (e.g. both stopped at the same point). Push is
      // 25% strength and fully on the yielding side, not split.
      const sepDx = idleXC - idleX;
      const sepDy = idleYC - idleY;
      const sepDist = Math.hypot(sepDx, sepDy);
      if (sepDist < AVOID_STOP_PX && sepDist > 0.001) {
        const yielding = _yieldingSlot(now);
        const push = (AVOID_STOP_PX - sepDist) * 0.25 + 0.5;
        const nx = sepDx / sepDist;
        const ny = sepDy / sepDist;
        if (yielding === 0) {
          idleX = clamp(idleX - nx * push, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
          idleY = clamp(idleY - ny * push, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
        } else {
          idleXC = clamp(idleXC + nx * push, -IDLE_LAIR_BOUND_X, IDLE_LAIR_BOUND_X);
          idleYC = clamp(idleYC + ny * push, -IDLE_LAIR_FLOOR_Y_TOP, IDLE_LAIR_BOUND_Y);
        }
      }

      // Render companion portrait
      const companionLayer = els.petPortraitCompanion.querySelector(".pet-portrait-idle");
      if (companionLayer) {
        let drawYC = idleYC;
        if (!idleReducedMotion && now < idleJumpUntilC) {
          const spanC = idleJumpUntilC - idleJumpStartTimeC;
          const jtC = spanC > 0 ? (now - idleJumpStartTimeC) / spanC : 1;
          drawYC -= 22 * Math.sin(Math.PI * clamp(jtC, 0, 1));
        }
        const movingC = !inHoldC && !companionSleepActive;
        const contentC = companionLayer.querySelector(".pet-portrait-idle-content");
        const spiritC = companionLayer.querySelector(".pet-art-raster--multi-frame");
        if (spiritC) spiritC.classList.toggle("walking", movingC && Math.hypot(idleTXC - idleXC, idleTYC - idleYC) > 2);
        if (contentC && movingC) {
          const dvxC = idleXC - (idleXC - (idleTXC - idleXC) * 0.01);
          if (Math.abs(idleTXC - idleXC) > 1) contentC.classList.toggle("facing-left", idleTXC < idleXC);
          if (!idleReducedMotion && now - idleWalkFootLastAtC >= IDLE_WALK_FOOTSTEP_GAP_MS) {
            idleWalkFootLastAtC = now;
            playMythLairWalkFootstepSfx(idleWalkFootParityC++);
          }
        }
        const isoYC = drawYC * 0.55;
        companionLayer.style.transform = "translate(" + idleXC.toFixed(1) + "px," + isoYC.toFixed(1) + "px)";
        els.petPortraitCompanion.style.zIndex = String(Math.round(100 + idleYC));
      }

      // Check proximity for auto-interaction
      try { checkProximityInteraction(Math.hypot(idleXC - idleX, idleYC - idleY), now); } catch (e) {}
    }

    idleRaf = requestAnimationFrame(step);
  }
  idleRaf = requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════════════════
   VFX / MOOD HELPERS
   ═══════════════════════════════════════════════════════ */

export function spawnPetEatVfx(feedTier, portraitEl) {
  const target = portraitEl || els.petPortrait;
  if (!target) return;
  const root = target.querySelector(".pet-eat-vfx");
  if (!root) return;
  root.innerHTML = "";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const tier = feedTier || "mediocre";
  const cls =
    tier === "favorite"
      ? "pet-eat-crumb pet-eat-crumb--fav"
      : tier === "hate"
        ? "pet-eat-crumb pet-eat-crumb--hate"
        : tier === "berry"
          ? "pet-eat-crumb pet-eat-crumb--berry"
          : "pet-eat-crumb pet-eat-crumb--ok";
  const n = 10;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = cls;
    s.style.left = 24 + Math.random() * 52 + "%";
    s.style.bottom = 18 + Math.random() * 38 + "%";
    s.style.animationDelay = (Math.random() * 0.1).toFixed(3) + "s";
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.9;
    const dist = 36 + Math.random() * 52;
    s.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--ty", -28 + Math.sin(ang) * dist * 0.65 + "px");
    root.appendChild(s);
  }
  window.setTimeout(function () {
    if (root) root.innerHTML = "";
  }, 700);
}

export function spawnPetRefuseEatVfx(portraitEl) {
  const target = portraitEl || els.petPortrait;
  if (!target) return;
  const root = target.querySelector(".pet-eat-vfx");
  if (!root) return;
  root.innerHTML = "";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cls = "pet-eat-crumb pet-eat-crumb--refuse";
  const n = 11;
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = cls;
    s.style.left = 22 + Math.random() * 56 + "%";
    s.style.bottom = 20 + Math.random() * 36 + "%";
    s.style.animationDelay = (Math.random() * 0.08).toFixed(3) + "s";
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.85;
    const dist = 44 + Math.random() * 58;
    s.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--ty", -20 + Math.sin(ang) * dist * 0.62 + "px");
    root.appendChild(s);
  }
  window.setTimeout(function () {
    if (root) root.innerHTML = "";
  }, 700);
}

export function triggerPetAnim(animClass, feedTierOpt) {
  if (!els.petPortrait || battleActive || petSleepActive) return;
  els.petPortrait.classList.remove(
    "anim-feed",
    "anim-feed-refuse",
    "anim-pet-care",
    "anim-rest",
    "anim-discipline-sad",
    "pulse"
  );
  void els.petPortrait.offsetWidth;
  els.petPortrait.classList.add(animClass);
  if (animClass === "anim-feed") spawnPetEatVfx(feedTierOpt);
  else if (animClass === "anim-feed-refuse") spawnPetRefuseEatVfx();
  const ms =
    animClass === "anim-rest"
      ? 800
      : animClass === "anim-discipline-sad"
        ? 1400
        : animClass === "anim-feed-refuse"
          ? 620
          : 680;
  setTimeout(function () {
    if (els.petPortrait) els.petPortrait.classList.remove(animClass);
  }, ms);
}

function petMoodEmojiIsHappyHearts(emoji) {
  return emoji === "❤️" || emoji === "🥰" || emoji === "🎵";
}

export function flashPetMoodPopup(emoji, portraitEl) {
  const target = portraitEl || els.petPortrait;
  if (!target || petSleepActive || battleActive) return;
  const wrap = target.querySelector(".pet-mood-popup");
  const ico = target.querySelector(".pet-mood-popup-ico");
  const heartsRoot = target.querySelector(".pet-mood-hearts");
  if (!wrap || !ico) return;
  lastMoodPopupAt = performance.now();
  if (petMoodPopupClearT) clearTimeout(petMoodPopupClearT);
  wrap.classList.remove(
    "pet-mood-popup--show",
    "pet-mood-popup--hearts-show",
    "pet-mood-popup--hearts-variant",
    "pet-mood-popup--tired",
    "pet-mood-popup--tired-show",
    "pet-mood-popup--tired-refusal",
    "pet-mood-popup--tired-refusal-show"
  );
  void wrap.offsetWidth;
  const useHearts = heartsRoot && petMoodEmojiIsHappyHearts(emoji);
  let clearMs = 1150;
  if (useHearts) {
    wrap.classList.add("pet-mood-popup--hearts-variant");
    ico.textContent = "";
    heartsRoot.innerHTML = "";
    const count = 5 + (Math.random() * 2 > 1 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      h.className = "pet-mood-heart";
      h.setAttribute("aria-hidden", "true");
      h.textContent = "❤️";
      h.style.left = 10 + Math.random() * 80 + "%";
      h.style.animationDelay = (i * 0.14 + Math.random() * 0.1).toFixed(3) + "s";
      heartsRoot.appendChild(h);
    }
    wrap.classList.add("pet-mood-popup--hearts-show");
    clearMs = 3300;
  } else {
    if (heartsRoot) heartsRoot.innerHTML = "";
    ico.style.display = "";
    ico.textContent = emoji;
    wrap.classList.add("pet-mood-popup--show");
  }
  petMoodPopupClearT = setTimeout(function () {
    wrap.classList.remove(
      "pet-mood-popup--show",
      "pet-mood-popup--hearts-show",
      "pet-mood-popup--hearts-variant",
      "pet-mood-popup--tired",
      "pet-mood-popup--tired-show",
      "pet-mood-popup--tired-refusal",
      "pet-mood-popup--tired-refusal-show"
    );
    if (heartsRoot) heartsRoot.innerHTML = "";
    petMoodPopupClearT = null;
  }, clearMs);
}

export function flashPetMoodForConsumedFoodTier(tier, portraitEl) {
  if (tier === "favorite") flashPetMoodPopup("❤️", portraitEl);
  else if (tier === "hate") flashPetMoodPopup("😖", portraitEl);
  else if (tier === "berry") flashPetMoodPopup("✨", portraitEl);
  else flashPetMoodPopup("😌", portraitEl);
}

export function flashPetJealousy(portraitEl) {
  const target = portraitEl || els.petPortrait;
  if (!target || battleActive || petSleepActive) return;
  if (target.classList.contains("sleeping")) return;
  target.classList.remove("pet-portrait--jealous");
  void target.offsetWidth;
  target.classList.add("pet-portrait--jealous");
  flashPetMoodPopup("😤", target);
  setTimeout(function () {
    if (target) target.classList.remove("pet-portrait--jealous");
  }, 1150);
}

export function flashPetMoodForConsumedRelic(def) {
  if (!def) return;
  const ico = def.icon != null ? String(def.icon).trim() : "";
  if (ico) {
    flashPetMoodPopup(ico);
    return;
  }
  const r = def.region;
  if (r === "greek") flashPetMoodPopup("🏛️");
  else if (r === "japan") flashPetMoodPopup("⛩️");
  else if (r === "sea") flashPetMoodPopup("🌊");
  else if (r === "egypt") flashPetMoodPopup("☀️");
  else flashPetMoodPopup("✨");
}

function flashPetTiredEmotion() {
  if (!els.petPortrait || petSleepActive || battleActive) return;
  const wrap = els.petPortrait.querySelector(".pet-mood-popup");
  const ico = els.petPortrait.querySelector(".pet-mood-popup-ico");
  const heartsRoot = els.petPortrait.querySelector(".pet-mood-hearts");
  if (!wrap || !ico) return;
  lastMoodPopupAt = performance.now();
  if (petMoodPopupClearT) clearTimeout(petMoodPopupClearT);
  if (petTiredShakeClearT) clearTimeout(petTiredShakeClearT);
  wrap.classList.remove(
    "pet-mood-popup--show",
    "pet-mood-popup--hearts-show",
    "pet-mood-popup--hearts-variant",
    "pet-mood-popup--tired",
    "pet-mood-popup--tired-show",
    "pet-mood-popup--tired-refusal",
    "pet-mood-popup--tired-refusal-show"
  );
  if (heartsRoot) heartsRoot.innerHTML = "";
  void wrap.offsetWidth;
  ico.style.display = "";
  ico.textContent = "😪";
  wrap.classList.add("pet-mood-popup--tired", "pet-mood-popup--tired-show");
  playMythTiredSfx();
  els.petPortrait.classList.remove("pet-portrait--tired-shake");
  void els.petPortrait.offsetWidth;
  els.petPortrait.classList.add("pet-portrait--tired-shake");
  petTiredShakeClearT = setTimeout(function () {
    if (els.petPortrait) els.petPortrait.classList.remove("pet-portrait--tired-shake");
    petTiredShakeClearT = null;
  }, 920);
  const clearMs =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1100 : 2480;
  petMoodPopupClearT = setTimeout(function () {
    wrap.classList.remove("pet-mood-popup--tired", "pet-mood-popup--tired-show");
    petMoodPopupClearT = null;
  }, clearMs);
}

export function flashTiredRefusal() {
  if (!els.petPortrait) return;
  const wrap = els.petPortrait.querySelector(".pet-mood-popup");
  const ico = els.petPortrait.querySelector(".pet-mood-popup-ico");
  const heartsRoot = els.petPortrait.querySelector(".pet-mood-hearts");
  if (!wrap || !ico) return;
  lastMoodPopupAt = performance.now();
  if (petMoodPopupClearT) clearTimeout(petMoodPopupClearT);
  if (petTiredShakeClearT) clearTimeout(petTiredShakeClearT);
  wrap.classList.remove(
    "pet-mood-popup--show",
    "pet-mood-popup--hearts-show",
    "pet-mood-popup--hearts-variant",
    "pet-mood-popup--tired",
    "pet-mood-popup--tired-show",
    "pet-mood-popup--tired-refusal",
    "pet-mood-popup--tired-refusal-show"
  );
  if (heartsRoot) heartsRoot.innerHTML = "";
  void wrap.offsetWidth;
  ico.style.display = "";
  ico.textContent = "😴";
  wrap.classList.add("pet-mood-popup--tired-refusal", "pet-mood-popup--tired-refusal-show");
  playTiredRefuseSfx();
  els.petPortrait.classList.remove("pet-portrait--tired-shake");
  void els.petPortrait.offsetWidth;
  els.petPortrait.classList.add("pet-portrait--tired-shake");
  petTiredShakeClearT = setTimeout(function () {
    if (els.petPortrait) els.petPortrait.classList.remove("pet-portrait--tired-shake");
    petTiredShakeClearT = null;
  }, 920);
  petMoodPopupClearT = setTimeout(function () {
    wrap.classList.remove("pet-mood-popup--tired-refusal", "pet-mood-popup--tired-refusal-show");
    petMoodPopupClearT = null;
  }, 1000);
}

export function maybePetMoodPopupRoll() {
  if (!els.petPortrait || petSleepActive || battleActive || !state.lineId) return;
  if (!els.screenGame || !els.screenGame.classList.contains("active")) return;
  if (performance.now() - lastMoodPopupAt < 15000) return;
  if (state.energy <= 28 && state.energy > 0) {
    const pTired = state.energy <= 14 ? 0.052 : 0.034;
    if (Math.random() < pTired) {
      flashPetTiredEmotion();
      return;
    }
  }
  if (Math.random() > 0.028) return;
  let emoji = null;
  if (state.hunger <= 20) emoji = "🥣";
  else if (state.happiness >= 70) emoji = "🎵";
  else if (state.happiness <= 35) emoji = "😢";
  if (emoji) flashPetMoodPopup(emoji);
}

export function flashPortraitDisciplineHit() {
  if (!els.petPortrait || battleActive) return;
  const fox = els.petPortrait.querySelector(".pet-art-raster--multi-frame");
  if (fox) {
    fox.classList.add("hurting");
    setTimeout(function () {
      if (fox && fox.classList) fox.classList.remove("hurting");
    }, 480);
  }
}

export function spawnPetFurryParticles(clientX, clientY) {
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

export function sleepMs(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/* ═══════════════════════════════════════════════════════
   BATTLE VFX
   ═══════════════════════════════════════════════════════ */

function artCy(wrapEl, arRect) {
  const artEl = wrapEl.querySelector(".battle-actor-art") || wrapEl;
  const r = artEl.getBoundingClientRect();
  return r.top + r.height * 0.5 - arRect.top;
}

function spawnMysticHitSparks(defenderWrapEl, goldCrit) {
  const arena = defenderWrapEl && defenderWrapEl.closest(".battle-arena");
  if (!arena || !defenderWrapEl) return;
  const ar = arena.getBoundingClientRect();
  const wr = defenderWrapEl.getBoundingClientRect();
  const cx = wr.left + wr.width * 0.5 - ar.left;
  const cy = artCy(defenderWrapEl, ar);
  const core = document.createElement("span");
  core.className = "battle-hit-spark-core";
  core.style.left = cx + "px";
  core.style.top = cy + "px";
  arena.appendChild(core);
  setTimeout(function () {
    if (core.parentNode) core.remove();
  }, 400);
  const n = goldCrit ? 22 : 16;
  for (let i = 0; i < n; i++) {
    const sp = document.createElement("span");
    sp.className = "battle-hit-spark" + (goldCrit ? " battle-hit-spark--gold" : "");
    sp.style.left = cx + (Math.random() * 10 - 5) + "px";
    sp.style.top = cy + (Math.random() * 10 - 5) + "px";
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.55;
    const dist = 22 + Math.random() * 48;
    sp.style.setProperty("--sx", Math.cos(ang) * dist + "px");
    sp.style.setProperty("--sy", Math.sin(ang) * dist + "px");
    sp.style.setProperty("--rot", Math.random() * 540 + "deg");
    sp.style.animationDelay = Math.random() * 0.06 + "s";
    arena.appendChild(sp);
    setTimeout(function () {
      if (sp.parentNode) sp.remove();
    }, 520);
  }
}

function renderBattleSpPips(el, count) {
  if (!el) return;
  let html = "";
  for (let i = 0; i < 3; i++) {
    html += '<span class="battle-sp-pip' + (i < count ? " filled" : "") + '"></span>';
  }
  el.innerHTML = html;
}

/** intense: player Aegis Ward break — bigger shatter + flash on myth art. */
function spawnShieldShatterFx(defenderWrapEl, intense) {
  const arena = defenderWrapEl && defenderWrapEl.closest(".battle-arena");
  if (!arena || !defenderWrapEl) return;
  if (intense) {
    const art = defenderWrapEl.querySelector(".battle-actor-art");
    if (art) {
      art.classList.remove("battle-actor-aegis-shatter-flash");
      void art.offsetWidth;
      art.classList.add("battle-actor-aegis-shatter-flash");
      window.setTimeout(function () {
        art.classList.remove("battle-actor-aegis-shatter-flash");
      }, 500);
    }
  }
  const ar = arena.getBoundingClientRect();
  const wr = defenderWrapEl.getBoundingClientRect();
  const cx = wr.left + wr.width * 0.5 - ar.left;
  const cy = artCy(defenderWrapEl, ar);
  const count = intense ? 38 : 14;
  const dMin = intense ? 36 : 20;
  const dMax = intense ? 128 : 56;
  const dur = intense ? 0.52 : 0.38;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "battle-spec-particle";
    const w = intense ? 5 + Math.random() * 9 : 6;
    const h = intense ? 4 + Math.random() * 14 : 6;
    p.style.width = w + "px";
    p.style.height = h + "px";
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    p.style.marginLeft = -w / 2 + "px";
    p.style.marginTop = -h / 2 + "px";
    p.style.borderRadius = intense ? "1px" : "50%";
    p.style.background = intense
      ? "linear-gradient(135deg,#ffffff,#bae6fd 40%,#22d3ee)"
      : "linear-gradient(135deg,#e0f2fe,#22d3ee)";
    p.style.boxShadow = intense ? "0 0 14px #e0f2fe, 0 0 8px #67e8f9" : "0 0 10px #67e8f9";
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.45;
    const d = dMin + Math.random() * (dMax - dMin);
    p.style.setProperty("--tx", Math.cos(ang) * d + "px");
    p.style.setProperty("--ty", Math.sin(ang) * d + "px");
    p.style.animation = "battleSpecRise " + dur + "s ease-out forwards";
    arena.appendChild(p);
    window.setTimeout(function () {
      if (p.parentNode) p.remove();
    }, Math.round(dur * 1000) + 80);
  }
  if (intense) {
    for (let j = 0; j < 10; j++) {
      const ring = document.createElement("span");
      ring.className = "battle-spec-particle";
      const rw = 28 + Math.random() * 36;
      ring.style.width = rw + "px";
      ring.style.height = "3px";
      ring.style.left = cx + "px";
      ring.style.top = cy + "px";
      ring.style.marginLeft = -(rw / 2) + "px";
      ring.style.marginTop = "-1.5px";
      ring.style.borderRadius = "2px";
      ring.style.background = "linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)";
      ring.style.boxShadow = "0 0 12px rgba(165,243,252,0.9)";
      const a2 = Math.random() * Math.PI * 2;
      const d2 = 40 + Math.random() * 70;
      ring.style.setProperty("--tx", Math.cos(a2) * d2 + "px");
      ring.style.setProperty("--ty", Math.sin(a2) * d2 + "px");
      ring.style.animation = "battleSpecRise 0.45s ease-out forwards";
      arena.appendChild(ring);
      window.setTimeout(function () {
        if (ring.parentNode) ring.remove();
      }, 520);
    }
  }
}

/** When the player's Aegis absorbs a hit (special or normal strike). */
function playAegisShieldShatterSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.012;
    const freqs = [2093, 1760, 1568, 1318.51, 1046.5, 880];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = i < 2 ? "square" : "triangle";
      const ti = t0 + i * 0.017;
      o.frequency.setValueAtTime(freqs[i], ti);
      o.frequency.exponentialRampToValueAtTime(Math.max(80, freqs[i] * 0.45), ti + 0.11);
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.062 - i * 0.0065, ti + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ti + 0.22);
      o.start(ti);
      o.stop(ti + 0.26);
    }
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "sine";
    o2.frequency.setValueAtTime(523.25, t0 + 0.04);
    o2.frequency.exponentialRampToValueAtTime(98, t0 + 0.24);
    g2.gain.setValueAtTime(0, t0 + 0.04);
    g2.gain.linearRampToValueAtTime(0.04, t0 + 0.055);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    o2.start(t0 + 0.04);
    o2.stop(t0 + 0.36);
  } catch (e) {}
}

function flashBattleActorAegisReflect(wrapEl) {
  const art = wrapEl && wrapEl.querySelector(".battle-actor-art");
  if (!art) return;
  art.classList.remove("battle-actor-aegis-reflect-flash");
  void art.offsetWidth;
  art.classList.add("battle-actor-aegis-reflect-flash");
  window.setTimeout(function () {
    art.classList.remove("battle-actor-aegis-reflect-flash");
  }, 420);
}

/** Ward launches reflected energy toward target (arena-space particles). */
function spawnAegisReflectStreamFx(fromWrapEl, toWrapEl) {
  const arena = fromWrapEl && fromWrapEl.closest(".battle-arena");
  if (!arena || !fromWrapEl || !toWrapEl) return;
  const ar = arena.getBoundingClientRect();
  const fr = fromWrapEl.getBoundingClientRect();
  const tr = toWrapEl.getBoundingClientRect();
  const fx = fr.left + fr.width * 0.5 - ar.left;
  const fy = artCy(fromWrapEl, ar);
  const tx = tr.left + tr.width * 0.5 - ar.left;
  const ty = artCy(toWrapEl, ar);
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const n = 16;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "battle-spec-particle";
    const w = 3 + Math.random() * 6;
    p.style.width = w + "px";
    p.style.height = w + "px";
    p.style.left = fx + (Math.random() * 10 - 5) + "px";
    p.style.top = fy + (Math.random() * 10 - 5) + "px";
    p.style.marginLeft = -w / 2 + "px";
    p.style.marginTop = -w / 2 + "px";
    const jitter = (Math.random() - 0.5) * 34;
    const reach = 0.52 + Math.random() * 0.42;
    p.style.setProperty("--tx", dx * reach + perpX * jitter + "px");
    p.style.setProperty("--ty", dy * reach + perpY * jitter + "px");
    p.style.background = "radial-gradient(circle,#ffffff,#22d3ee 55%,transparent 78%)";
    p.style.boxShadow = "0 0 14px #67e8f9, 0 0 6px #e0f2fe";
    p.style.animation = "battleSpecRise " + (0.34 + Math.random() * 0.1) + "s ease-out forwards";
    arena.appendChild(p);
    window.setTimeout(function () {
      if (p.parentNode) p.remove();
    }, 520);
  }
  for (let j = 0; j < 5; j++) {
    const ring = document.createElement("span");
    ring.className = "battle-spec-particle";
    const rw = 22 + Math.random() * 28;
    ring.style.width = rw + "px";
    ring.style.height = "2px";
    ring.style.left = fx + "px";
    ring.style.top = fy + "px";
    ring.style.marginLeft = -(rw / 2) + "px";
    ring.style.marginTop = "-1px";
    ring.style.borderRadius = "2px";
    ring.style.background = "linear-gradient(90deg,transparent,rgba(255,255,255,0.92),transparent)";
    ring.style.boxShadow = "0 0 10px rgba(165,243,252,0.95)";
    const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.35;
    const dist = len * (0.45 + Math.random() * 0.35);
    ring.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    ring.style.setProperty("--ty", Math.sin(ang) * dist + "px");
    ring.style.animation = "battleSpecRise 0.4s ease-out forwards";
    arena.appendChild(ring);
    window.setTimeout(function () {
      if (ring.parentNode) ring.remove();
    }, 480);
  }
}

function playAegisReflectLaunchSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.008;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(380, t0);
    o.frequency.exponentialRampToValueAtTime(2100, t0 + 0.065);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.048, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
    o.start(t0);
    o.stop(t0 + 0.13);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "sine";
    o2.frequency.setValueAtTime(720, t0 + 0.018);
    o2.frequency.linearRampToValueAtTime(1240, t0 + 0.075);
    g2.gain.setValueAtTime(0, t0 + 0.018);
    g2.gain.linearRampToValueAtTime(0.042, t0 + 0.028);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    o2.start(t0 + 0.018);
    o2.stop(t0 + 0.14);
  } catch (e) {}
}

function playAegisReflectImpactSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.setValueAtTime(165, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.13);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.078, t0 + 0.011);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
    o.start(t0);
    o.stop(t0 + 0.22);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "triangle";
    o2.frequency.setValueAtTime(1046.5, t0 + 0.025);
    o2.frequency.exponentialRampToValueAtTime(220, t0 + 0.11);
    g2.gain.setValueAtTime(0, t0 + 0.025);
    g2.gain.linearRampToValueAtTime(0.038, t0 + 0.035);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    o2.start(t0 + 0.025);
    o2.stop(t0 + 0.17);
  } catch (e) {}
}

function spawnSpecialMoveFx(moveId, sourceWrapEl, targetWrapEl) {
  const arena = sourceWrapEl && sourceWrapEl.closest(".battle-arena");
  if (!arena || !sourceWrapEl) return;
  const ar = arena.getBoundingClientRect();
  const sr = sourceWrapEl.getBoundingClientRect();
  const sx = sr.left + sr.width * 0.5 - ar.left;
  const sy = artCy(sourceWrapEl, ar);
  if (moveId === "attack") {
    const burst = document.createElement("span");
    burst.className = "battle-spec-particle";
    burst.style.width = "64px";
    burst.style.height = "64px";
    burst.style.left = sx + "px";
    burst.style.top = sy + "px";
    burst.style.marginLeft = "-32px";
    burst.style.marginTop = "-32px";
    burst.style.background =
      "radial-gradient(circle, rgba(252,211,77,0.85) 0%, rgba(245,158,11,0.35) 45%, transparent 70%)";
    burst.style.animation = "battleSpecBurst 0.4s ease-out forwards";
    arena.appendChild(burst);
    setTimeout(function () {
      if (burst.parentNode) burst.remove();
    }, 450);
  } else if (moveId === "defend") {
    for (let i = 0; i < 20; i++) {
      const p = document.createElement("span");
      p.className = "battle-spec-particle";
      const ang = (Math.PI * 2 * i) / 20;
      const r = 38 + Math.random() * 12;
      p.style.width = "5px";
      p.style.height = "5px";
      p.style.left = sx + Math.cos(ang) * r + "px";
      p.style.top = sy + Math.sin(ang) * r + "px";
      p.style.marginLeft = "-2.5px";
      p.style.marginTop = "-2.5px";
      p.style.background = "#a5f3fc";
      p.style.boxShadow = "0 0 8px #22d3ee";
      p.style.animation = "battleSpecRise 0.55s ease-out forwards";
      p.style.setProperty("--tx", Math.cos(ang) * 8 + "px");
      p.style.setProperty("--ty", Math.sin(ang) * 8 + "px");
      arena.appendChild(p);
      setTimeout(function () {
        if (p.parentNode) p.remove();
      }, 600);
    }
  } else if (moveId === "heal") {
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("span");
      p.className = "battle-spec-particle";
      p.style.width = "7px";
      p.style.height = "7px";
      p.style.left = sx + (Math.random() * 40 - 20) + "px";
      p.style.top = sy + (Math.random() * 20 - 10) + "px";
      p.style.background = "radial-gradient(circle,#bbf7d0,#22c55e)";
      p.style.boxShadow = "0 0 10px #4ade80";
      p.style.animation = "battleSpecRise 0.65s ease-out forwards";
      p.style.setProperty("--tx", Math.random() * 16 - 8 + "px");
      p.style.setProperty("--ty", -32 - Math.random() * 40 + "px");
      arena.appendChild(p);
      setTimeout(function () {
        if (p.parentNode) p.remove();
      }, 700);
    }
  } else if (moveId === "stun" && targetWrapEl) {
    const tr = targetWrapEl.getBoundingClientRect();
    const tx = tr.left + tr.width * 0.5 - ar.left;
    const ty = tr.top + tr.height * 0.42 - ar.top;
    const ring = document.createElement("span");
    ring.className = "battle-spec-particle";
    ring.style.width = "72px";
    ring.style.height = "72px";
    ring.style.left = tx + "px";
    ring.style.top = ty + "px";
    ring.style.marginLeft = "-36px";
    ring.style.marginTop = "-36px";
    ring.style.borderRadius = "50%";
    ring.style.border = "3px solid rgba(250,204,21,0.95)";
    ring.style.boxShadow =
      "0 0 26px rgba(56,189,248,0.9), 0 0 42px rgba(147,197,253,0.55), inset 0 0 18px rgba(254,249,195,0.35)";
    ring.style.background = "transparent";
    ring.style.animation = "battleSpecBurst 0.5s ease-out forwards";
    arena.appendChild(ring);
    setTimeout(function () {
      if (ring.parentNode) ring.remove();
    }, 520);
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("span");
      p.className = "battle-spec-particle";
      p.style.width = "4px";
      p.style.height = "16px";
      p.style.left = tx + "px";
      p.style.top = ty + "px";
      p.style.marginLeft = "-2px";
      p.style.marginTop = "-8px";
      p.style.background = "linear-gradient(#fef08a,#38bdf8)";
      p.style.transform = "rotate(" + i * 30 + "deg) translateY(-36px)";
      p.style.opacity = "0.9";
      p.style.animation = "battleSpecRise 0.45s ease-out forwards";
      p.style.setProperty("--tx", "0px");
      p.style.setProperty("--ty", -8 - Math.random() * 20 + "px");
      arena.appendChild(p);
      setTimeout(function () {
        if (p.parentNode) p.remove();
      }, 500);
    }
  }
}

function pickSpecialShoutLine(arr) {
  if (!arr || !arr.length) return "";
  return arr[(Math.random() * arr.length) | 0];
}

function setBattleSpeedLinesMode(mode) {
  const el = els.battleSpeedLines;
  if (battleSpeedLinesLaunchClearT) {
    clearTimeout(battleSpeedLinesLaunchClearT);
    battleSpeedLinesLaunchClearT = 0;
  }
  if (!el) return;
  el.classList.remove("battle-speed-lines--windup", "battle-speed-lines--launch", "battle-speed-lines--reduced");
  if (mode === "off") return;
  const reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    el.classList.add("battle-speed-lines--reduced");
    if (mode === "windup") el.classList.add("battle-speed-lines--windup");
    else if (mode === "launch") el.classList.add("battle-speed-lines--launch");
    return;
  }
  if (mode === "windup") el.classList.add("battle-speed-lines--windup");
  else if (mode === "launch") {
    el.classList.remove("battle-speed-lines--windup");
    el.classList.add("battle-speed-lines--launch");
    battleSpeedLinesLaunchClearT = window.setTimeout(function () {
      battleSpeedLinesLaunchClearT = 0;
      el.classList.remove("battle-speed-lines--launch");
    }, 780);
  }
}

function showBattleComicShout(text, opts) {
  const host = els.battleComicShoutHost;
  if (!host || !text) return;
  if (battleComicUiTimers.shout) clearTimeout(battleComicUiTimers.shout);
  host.innerHTML = "";
  const side = opts && opts.side === "enemy" ? "enemy" : "player";
  const dur = (opts && opts.durationMs) || 2000;
  host.className = "battle-comic-shout-host battle-comic-shout-host--" + side;
  const b = document.createElement("div");
  b.className = "battle-comic-shout-bubble";
  b.textContent = text;
  host.appendChild(b);
  host.classList.add("visible");
  host.setAttribute("aria-hidden", "false");
  battleComicUiTimers.shout = window.setTimeout(function () {
    battleComicUiTimers.shout = 0;
    host.innerHTML = "";
    host.classList.remove("visible");
    host.setAttribute("aria-hidden", "true");
  }, dur);
}

function showBattleImpactWord(text, durationMs) {
  const host = els.battleComicImpactHost;
  if (!host || !text) return;
  if (battleComicUiTimers.impact) clearTimeout(battleComicUiTimers.impact);
  host.innerHTML = "";
  const d = durationMs || 820;
  const w = document.createElement("div");
  w.className = "battle-comic-impact-word";
  w.textContent = text;
  host.appendChild(w);
  host.classList.add("visible");
  host.setAttribute("aria-hidden", "false");
  battleComicUiTimers.impact = window.setTimeout(function () {
    battleComicUiTimers.impact = 0;
    host.innerHTML = "";
    host.classList.remove("visible");
    host.setAttribute("aria-hidden", "true");
  }, d);
}

function playComicShoutStinger() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.004;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(190, t0 + 0.048);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.052, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.085);
    o.start(t0);
    o.stop(t0 + 0.1);
  } catch (e) {}
}

function applyBattleSpecialLunge(actorWrap, durationMs) {
  const art = actorWrap && actorWrap.querySelector(".battle-actor-art");
  if (!art) return;
  art.classList.remove("battle-actor-art--special-lunge");
  void art.offsetWidth;
  art.classList.add("battle-actor-art--special-lunge");
  window.setTimeout(function () {
    if (art && art.classList) art.classList.remove("battle-actor-art--special-lunge");
  }, durationMs || 440);
}

function clearBattleComicCallout() {
  if (battleComicUiTimers.shout) clearTimeout(battleComicUiTimers.shout);
  if (battleComicUiTimers.impact) clearTimeout(battleComicUiTimers.impact);
  battleComicUiTimers.shout = 0;
  battleComicUiTimers.impact = 0;
  if (els.battleComicShoutHost) {
    els.battleComicShoutHost.innerHTML = "";
    els.battleComicShoutHost.className = "battle-comic-shout-host";
    els.battleComicShoutHost.setAttribute("aria-hidden", "true");
  }
  if (els.battleComicImpactHost) {
    els.battleComicImpactHost.innerHTML = "";
    els.battleComicImpactHost.className = "battle-comic-impact-host";
    els.battleComicImpactHost.setAttribute("aria-hidden", "true");
  }
  setBattleSpeedLinesMode("off");
  if (!els.battleComicCallout) return;
  els.battleComicCallout.innerHTML = "";
  els.battleComicCallout.classList.remove("visible");
  els.battleComicCallout.setAttribute("aria-hidden", "true");
}

async function typeComicSpecialTitle(text, totalMs) {
  const host = els.battleComicCallout;
  if (!host) return;
  host.innerHTML = "";
  host.classList.add("visible");
  host.setAttribute("aria-hidden", "false");
  const line = document.createElement("div");
  line.className = "battle-comic-line";
  host.appendChild(line);
  const chars = Array.from(text);
  const n = Math.max(1, chars.length);
  const delay = Math.max(35, Math.floor(totalMs / n));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " ") {
      line.appendChild(document.createTextNode(" "));
    } else {
      const s = document.createElement("span");
      s.className = "battle-comic-char";
      s.textContent = ch;
      line.appendChild(s);
    }
    await sleepMs(delay);
  }
}

function playBattleLaunchWhoosh(ctx, t0, bright) {
  try {
    const dur = 0.11;
    const nFrames = Math.max(200, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, nFrames, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < nFrames; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / nFrames) * (bright || 0.42);
    }
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    f.type = "bandpass";
    f.frequency.setValueAtTime(2200, t0);
    f.frequency.exponentialRampToValueAtTime(320, t0 + dur);
    f.Q.value = 0.9;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.1, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.05);
    src.start(t0);
    src.stop(t0 + dur + 0.06);
  } catch (e) {}
}

function playSpecialImpactSfx(moveId) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const stun = moveId === "stun";
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(stun ? 165 : 110, t0);
    o.frequency.exponentialRampToValueAtTime(stun ? 38 : 22, t0 + 0.28);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(stun ? 0.16 : 0.2, t0 + 0.016);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (stun ? 0.42 : 0.52));
    o.start(t0);
    o.stop(t0 + (stun ? 0.45 : 0.55));
    if (stun) {
      const t1 = t0 + 0.03;
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.type = "square";
      o2.frequency.setValueAtTime(880, t1);
      o2.frequency.exponentialRampToValueAtTime(120, t1 + 0.12);
      g2.gain.setValueAtTime(0, t1);
      g2.gain.linearRampToValueAtTime(0.045, t1 + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.18);
      o2.start(t1);
      o2.stop(t1 + 0.2);
    }
  } catch (e) {}
}

function playSpecialResolveSfx(moveId) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    const f0 = moveId === "defend" ? 196 : moveId === "heal" ? 587 : 155;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * (moveId === "heal" ? 1.35 : 1.22), t0 + 0.1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.11, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    o.start(t0);
    o.stop(t0 + 0.32);
  } catch (e) {}
}

function spawnMegaScreenFlash() {
  const root = els.modalBattle;
  if (!root) return;
  const f = document.createElement("div");
  f.className = "battle-hit-flash-mega";
  root.appendChild(f);
  setTimeout(function () {
    if (f.parentNode) f.remove();
  }, 400);
}

function spawnOneWindupSpark(moveId, arena, sx, sy, intensity) {
  const p = document.createElement("span");
  p.className = "battle-spec-particle";
  const sz = 4 + Math.floor(intensity * 6);
  p.style.width = sz + "px";
  p.style.height = sz + "px";
  p.style.left = sx + (Math.random() * 36 - 18) * intensity + "px";
  p.style.top = sy + (Math.random() * 28 - 14) * intensity + "px";
  const ang = Math.random() * Math.PI * 2;
  const dist = 16 + intensity * 52 + Math.random() * 24;
  let col = "#fcd34d";
  if (moveId === "defend") col = "#67e8f9";
  else if (moveId === "heal") col = "#4ade80";
  else if (moveId === "stun") col = "#facc15";
  p.style.background = "radial-gradient(circle," + col + ",transparent)";
  p.style.boxShadow = "0 0 12px " + col;
  p.style.setProperty("--tx", Math.cos(ang) * dist + "px");
  p.style.setProperty("--ty", Math.sin(ang) * dist + "px");
  p.style.animation = "battleSpecRise " + (0.35 + intensity * 0.35) + "s ease-out forwards";
  arena.appendChild(p);
  setTimeout(function () {
    if (p.parentNode) p.remove();
  }, 900);
}

function startSpecialWindupParticles(moveId, wrapEl, durationMs) {
  const arena = wrapEl && wrapEl.closest(".battle-arena");
  if (!arena || !wrapEl) {
    return function () {};
  }
  const ar = arena.getBoundingClientRect();
  const wr = wrapEl.getBoundingClientRect();
  const sx = wr.left + wr.width * 0.5 - ar.left;
  const sy = artCy(wrapEl, ar);
  const t0 = Date.now();
  const iv = setInterval(function () {
    const elapsed = Date.now() - t0;
    if (elapsed >= durationMs) return;
    const prog = elapsed / durationMs;
    const count = 2 + Math.floor(prog * 7);
    for (let i = 0; i < count; i++) {
      spawnOneWindupSpark(moveId, arena, sx, sy, prog);
    }
  }, 95);
  return function () {
    clearInterval(iv);
  };
}

function spawnSpecialMoveFxExaggerated(moveId, sourceWrapEl, targetWrapEl, phase) {
  const arena = sourceWrapEl && sourceWrapEl.closest(".battle-arena");
  if (!arena || !sourceWrapEl) return;
  const ar = arena.getBoundingClientRect();
  const sr = sourceWrapEl.getBoundingClientRect();
  const sx = sr.left + sr.width * 0.5 - ar.left;
  const sy = artCy(sourceWrapEl, ar);
  const mult = phase === "impact" ? 1.6 : phase === "launch" ? 1.35 : 1.2;
  if (moveId === "attack") {
    const burst = document.createElement("span");
    burst.className = "battle-spec-mega";
    const diam = phase === "impact" ? 140 : 100;
    burst.style.width = diam + "px";
    burst.style.height = diam + "px";
    burst.style.left = (phase === "impact" && targetWrapEl ? (() => {
      const tr = targetWrapEl.getBoundingClientRect();
      return tr.left + tr.width * 0.5 - ar.left;
    })() : sx) + "px";
    burst.style.top = (phase === "impact" && targetWrapEl ? artCy(targetWrapEl, ar) : sy) + "px";
    burst.style.marginLeft = -diam / 2 + "px";
    burst.style.marginTop = -diam / 2 + "px";
    burst.style.borderRadius = "50%";
    burst.style.background =
      "radial-gradient(circle, rgba(252,211,77,0.95) 0%, rgba(245,158,11,0.45) 40%, transparent 68%)";
    burst.style.animation = "battleSpecMegaBurst " + (phase === "impact" ? 0.55 : 0.48) + "s ease-out forwards";
    arena.appendChild(burst);
    setTimeout(function () {
      if (burst.parentNode) burst.remove();
    }, 600);
  }
  const count = Math.round(
    (moveId === "defend" ? 32 : moveId === "heal" ? 36 : moveId === "stun" ? 28 : 24) * mult
  );
  const cx = sx;
  const cy = sy;
  let tx = cx;
  let ty = cy;
  if (targetWrapEl && (moveId === "stun" || phase === "impact")) {
    const tr = targetWrapEl.getBoundingClientRect();
    tx = tr.left + tr.width * 0.5 - ar.left;
    ty = artCy(targetWrapEl, ar);
  }
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "battle-spec-particle";
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = (28 + Math.random() * 55) * mult;
    p.style.width = 5 + Math.floor(mult * 4) + "px";
    p.style.height = p.style.width;
    if (moveId === "stun" && targetWrapEl) {
      p.style.left = tx + Math.cos(ang) * (20 + Math.random() * 50) + "px";
      p.style.top = ty + Math.sin(ang) * (20 + Math.random() * 50) + "px";
    } else {
      p.style.left = cx + Math.cos(ang) * (dist * 0.35) + "px";
      p.style.top = cy + Math.sin(ang) * (dist * 0.35) + "px";
    }
    let bg = "#fcd34d";
    let sh = "#fbbf24";
    if (moveId === "defend") {
      bg = "#a5f3fc";
      sh = "#22d3ee";
    } else if (moveId === "heal") {
      bg = "#86efac";
      sh = "#22c55e";
    } else if (moveId === "stun") {
      bg = "#fef9c3";
      sh = "#38bdf8";
    }
    p.style.background = "radial-gradient(circle," + bg + "," + sh + ")";
    p.style.boxShadow = "0 0 14px " + sh;
    const txv = moveId === "heal" ? Math.random() * 20 - 10 : Math.cos(ang) * dist;
    const tyv = moveId === "heal" ? -40 - Math.random() * 50 : Math.sin(ang) * dist;
    p.style.setProperty("--tx", txv + "px");
    p.style.setProperty("--ty", tyv + "px");
    p.style.animation = "battleSpecRise " + (0.5 + Math.random() * 0.25) + "s ease-out forwards";
    arena.appendChild(p);
    setTimeout(function () {
      if (p.parentNode) p.remove();
    }, 850);
  }
}

function launchBattleProjectile(style, fromPlayer, mega) {
  const fx = els.battleFxLayer;
  if (!fx) return;
  const arena = fx.closest(".battle-arena");
  const sourceWrap = fromPlayer ? els.battlePlayerWrap : els.battleEnemyWrap;
  const el = document.createElement("div");
  el.className = "battle-proj battle-proj--" + style;
  if (mega) el.classList.add("battle-proj--mega");
  if (arena && sourceWrap) {
    const ar = arena.getBoundingClientRect();
    const fxR = fx.getBoundingClientRect();
    const relY = artCy(sourceWrap, ar) - (fxR.top - ar.top);
    el.style.top = relY + "px";
    el.style.marginTop = "-18px";
  }
  if (fromPlayer) {
    el.style.left = "11%";
    fx.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add("battle-proj--fly");
        el.style.left = "84%";
      });
    });
  } else {
    el.style.left = "89%";
    fx.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add("battle-proj--fly");
        el.style.left = "16%";
      });
    });
  }
  setTimeout(
    function () {
      if (el.parentNode) el.remove();
    },
    mega ? 650 : 500
  );
}

function spawnBattleEndParticles(isWin) {
  const root = els.modalBattle;
  if (!root) return;
  const colors = isWin
    ? ["#fcd34d", "#fbbf24", "#fde68a", "#f59e0b"]
    : ["#64748b", "#94a3b8", "#475569", "#7f1d1d"];
  const rect = root.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.38;
  for (let i = 0; i < 48; i++) {
    const p = document.createElement("span");
    p.className = "evolve-particle evolve-particle--fixed";
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    const ang = (Math.PI * 2 * i) / 48 + Math.random() * 0.3;
    const dist = 80 + Math.random() * 160;
    p.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--ty", Math.sin(ang) * dist + "px");
    const c = colors[i % colors.length];
    p.style.background = c;
    p.style.color = c;
    document.body.appendChild(p);
    setTimeout(function () {
      if (p.parentNode) p.remove();
    }, 1100);
  }
}

async function showBattlePostStatSummary(win, preStats, postStats, train, petName, lootFood, lootRelic, lootBall) {
  const root = els.battlePostSummary;
  if (!root) {
    await sleepMs(3500);
    return;
  }
  const titleEl = root.querySelector("[data-bpost-title]");
  const subEl = root.querySelector("[data-bpost-sub]");
  const lootEl = root.querySelector("[data-bpost-loot]");
  const lootIcoEl = root.querySelector("[data-bpost-loot-ico]");
  const lootTextEl = root.querySelector("[data-bpost-loot-text]");
  titleEl.textContent = win ? "Victory!" : "Defeated…";
  titleEl.className = "battle-post-title " + (win ? "is-win" : "is-lose");
  subEl.textContent =
    petName +
    " · " +
    (train.points === 0
      ? "No training pips — bonuses from battle training are unchanged."
      : "+" +
        train.points +
        " training pip" +
        (train.points === 1 ? "" : "s") +
        " applied — net stat changes below");
  if (lootEl) {
    lootEl.classList.remove("is-visible");
    lootEl.setAttribute("hidden", "hidden");
    if (lootIcoEl) lootIcoEl.textContent = "";
    if (lootTextEl) lootTextEl.textContent = "";
  }

  const rows = [
    {
      strong: "[data-bpost-bp]",
      delta: "[data-bpost-d-bp]",
      val: postStats.combatBp,
      d: postStats.combatBp - preStats.combatBp,
    },
    {
      strong: "[data-bpost-hp]",
      delta: "[data-bpost-d-hp]",
      val: postStats.maxHp,
      d: postStats.maxHp - preStats.maxHp,
    },
    {
      strong: "[data-bpost-atk]",
      delta: "[data-bpost-d-atk]",
      val: postStats.atk,
      d: postStats.atk - preStats.atk,
    },
    {
      strong: "[data-bpost-spd]",
      delta: "[data-bpost-d-spd]",
      val: postStats.speed,
      d: postStats.speed - preStats.speed,
    },
  ];
  rows.forEach(function (row) {
    const sEl = root.querySelector(row.strong);
    const dEl = root.querySelector(row.delta);
    sEl.textContent = String(row.val);
    dEl.classList.remove("pop", "is-mute", "is-neg");
    dEl.style.opacity = "0";
    dEl.style.transform = "translateY(12px)";
    if (row.d > 0) {
      dEl.textContent = "+" + row.d;
    } else if (row.d < 0) {
      dEl.textContent = String(row.d);
      dEl.classList.add("is-neg");
    } else {
      dEl.textContent = "";
    }
  });

  root.setAttribute("aria-hidden", "false");
  root.classList.add("visible");
  await sleepMs(480);

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].d === 0) continue;
    const dEl = root.querySelector(rows[i].delta);
    void dEl.offsetWidth;
    dEl.classList.add("pop");
    await sleepMs(130);
  }

  await sleepMs(520);

  const hasLoot = win && (lootFood || lootRelic);
  if (lootEl && lootIcoEl && lootTextEl && hasLoot) {
    if (lootFood) {
      lootIcoEl.textContent = foodIconFor(lootFood);
      lootTextEl.textContent = lootFood.name + " — added to your pantry.";
    } else {
      lootIcoEl.textContent = lootRelic.icon || "🏺";
      lootTextEl.textContent = lootRelic.name + " — added to your relic inventory.";
    }
    lootEl.removeAttribute("hidden");
    void lootEl.offsetWidth;
    lootEl.classList.add("is-visible");
    playBattleLootChimeSfx();
    await sleepMs(lootBall ? 2200 : 3200);
  } else {
    await sleepMs(lootBall ? 1000 : 3000);
  }
  if (lootEl && lootIcoEl && lootTextEl && lootBall) {
    lootEl.classList.remove("is-visible");
    if (hasLoot) await sleepMs(250);
    lootIcoEl.textContent = "\u26BD";
    lootTextEl.textContent = "Play Ball found! Use it to play with your myth.";
    lootEl.removeAttribute("hidden");
    void lootEl.offsetWidth;
    lootEl.classList.add("is-visible");
    if (!hasLoot) playBattleLootChimeSfx();
    playBattleLootChimeSfx();
    await sleepMs(2800);
  }

  root.classList.remove("visible");
  root.setAttribute("aria-hidden", "true");
  await sleepMs(420);
  if (lootEl) {
    lootEl.classList.remove("is-visible");
    lootEl.setAttribute("hidden", "hidden");
    if (lootIcoEl) lootIcoEl.textContent = "";
    if (lootTextEl) lootTextEl.textContent = "";
  }
}

function battleMultiFrameRoot(artHost) {
  return artHost && artHost.querySelector(".pet-art-raster--multi-frame");
}

function battleSpiritFoxAttackMs(durationMs, artHost) {
  const host = artHost || els.battlePlayerArt;
  const root = battleMultiFrameRoot(host);
  if (!root) return;
  if (root._atkT) clearTimeout(root._atkT);
  if (root._hitT) {
    clearTimeout(root._hitT);
    root._hitT = null;
  }
  root.classList.remove("facing-left", "hurting");
  root.classList.add("attacking");
  root._atkT = window.setTimeout(function () {
    if (root && root.classList) root.classList.remove("attacking");
    root._atkT = null;
  }, durationMs);
}

function battleSpiritFoxHitMs(durationMs, artHost) {
  const host = artHost || els.battlePlayerArt;
  const root = battleMultiFrameRoot(host);
  if (!root) return;
  if (root._hitT) clearTimeout(root._hitT);
  if (root._atkT) {
    clearTimeout(root._atkT);
    root._atkT = null;
  }
  root.classList.remove("attacking");
  root.classList.add("hurting");
  root._hitT = window.setTimeout(function () {
    if (root && root.classList) root.classList.remove("hurting");
    root._hitT = null;
  }, durationMs);
}

function resetBattleSpiritFoxPoseFor(artHost) {
  const root = battleMultiFrameRoot(artHost);
  if (!root) return;
  if (root._atkT) {
    clearTimeout(root._atkT);
    root._atkT = null;
  }
  if (root._hitT) {
    clearTimeout(root._hitT);
    root._hitT = null;
  }
  root.classList.remove("attacking", "hurting");
}

function resetBattleSpiritFoxPose() {
  resetBattleSpiritFoxPoseFor(els.battlePlayerArt);
  resetBattleSpiritFoxPoseFor(els.battleEnemyArt);
}

function clearBindingHexShock(wrapEl) {
  if (!wrapEl) return;
  if (wrapEl._bindingHexShockT) {
    clearTimeout(wrapEl._bindingHexShockT);
    wrapEl._bindingHexShockT = null;
  }
  wrapEl.classList.remove("binding-hex-shock");
}

function applyBindingHexShock(wrapEl, durationMs) {
  if (!wrapEl) return;
  clearBindingHexShock(wrapEl);
  wrapEl.classList.add("binding-hex-shock");
  wrapEl._bindingHexShockT = window.setTimeout(function () {
    wrapEl.classList.remove("binding-hex-shock");
    wrapEl._bindingHexShockT = null;
  }, durationMs);
}

/* ═══════════════════════════════════════════════════════
   BATTLE SIMULATION
   ═══════════════════════════════════════════════════════ */

export async function simulateBattleCombat(player, enemy, region, pvpSeed, pvpIsChallenger, mythSelf) {
  const self = mythSelf || state;
  scaleEnemyDownToMaxCombatBp(enemy, player.combatBp);
  const rng = pvpSeed != null ? createSeededRandom(pvpSeed) : function () { return Math.random(); };
  /** Global strike / special damage tuning (1 = legacy; lower = longer fights). */
  const COMBAT_BASE_DAMAGE_MULT = 0.75;
  let php = player.maxHp;
  let ehp = enemy.maxHp;
  let pGauge = 0;
  let eGauge = 0;
  let pStunUntil = 0;
  let eStunUntil = 0;
  let pSp = 0;
  let eSp = 0;
  let pShield = false;
  let eShield = false;
  const pWrap = els.battlePlayerWrap;
  const eWrap = els.battleEnemyWrap;
  let tick = 0;
  const maxMs = 180000;
  /* Tier 2+ (stage >= 1): speed contributes half as much to the ATB gauge (≥50% slower pace). */
  const pSpeedGaugeMul = (player.stage | 0) >= 1 ? 0.5 : 1;
  const eSpeedGaugeMul = (enemy.stage | 0) >= 1 ? 0.5 : 1;

  function syncShieldClass() {
    pWrap.classList.toggle("battle-actor-shield", pShield);
    eWrap.classList.toggle("battle-actor-shield", eShield);
  }

  function updateBattleSpMeters() {
    renderBattleSpPips(els.battlePlayerSp, pSp);
    renderBattleSpPips(els.battleEnemySp, eSp);
  }

  function updateHpBars() {
    els.battlePlayerHp.style.width = Math.max(0, Math.min(100, (php / player.maxHp) * 100)) + "%";
    els.battleEnemyHp.style.width = Math.max(0, Math.min(100, (ehp / enemy.maxHp) * 100)) + "%";
    if (els.battlePlayerHpNum) {
      els.battlePlayerHpNum.textContent =
        Math.max(0, Math.ceil(php)) + " / " + player.maxHp;
    }
    if (els.battleEnemyHpNum) {
      els.battleEnemyHpNum.textContent =
        Math.max(0, Math.ceil(ehp)) + " / " + enemy.maxHp;
    }
  }

  function feedLine(msg) {
    const prev = els.battleFeed.textContent.trim();
    els.battleFeed.textContent = prev ? msg + "\n" + prev : msg;
  }

  updateHpBars();
  updateBattleSpMeters();
  syncShieldClass();
  feedLine(
    "Encounter: " +
      enemy.name +
      " (tier " +
      (enemy.stage + 1) +
      ", Combat BP ~" +
      enemy.combatBp +
      "). SP builds to 3 for a mythic special. Auto-battle engaged."
  );

  function rollStrikeMisses() {
    return rng() < 0.03 + rng() * 0.07;
  }

  const AEGIS_REFLECT_CHANCE = 0.5;
  const AEGIS_REFLECT_MULT = 0.6;

  async function applyAegisReflectDamageToEnemy(incomingDmg) {
    const refl = Math.max(1, Math.round(incomingDmg * AEGIS_REFLECT_MULT));
    spawnShieldShatterFx(pWrap, true);
    playAegisReflectLaunchSfx();
    flashBattleActorAegisReflect(pWrap);
    spawnAegisReflectStreamFx(pWrap, eWrap);
    feedLine("The Aegis flares — the strike reflects!");
    await sleepMs(400);
    if (php <= 0 || ehp <= 0) return;
    playAegisReflectImpactSfx();
    spawnMysticHitSparks(eWrap, false);
    ehp = Math.max(0, ehp - refl);
    updateHpBars();
    battleSpiritFoxHitMs(SPIRIT_FOX_HIT_MS, els.battleEnemyArt);
    eWrap.classList.add("battle-actor-hit");
    window.setTimeout(function () {
      eWrap.classList.remove("battle-actor-hit");
    }, 380);
    if (ehp <= 0) {
      feedLine(enemy.name + " takes " + refl + " reflected damage — can't continue!");
      return;
    }
    feedLine(enemy.name + " takes " + refl + " reflected damage!");
  }

  async function applyAegisReflectDamageToPlayer(incomingDmg) {
    const refl = Math.max(1, Math.round(incomingDmg * AEGIS_REFLECT_MULT));
    spawnShieldShatterFx(eWrap);
    playAegisReflectLaunchSfx();
    flashBattleActorAegisReflect(eWrap);
    spawnAegisReflectStreamFx(eWrap, pWrap);
    feedLine("The ward mirrors your blow!");
    await sleepMs(400);
    if (php <= 0 || ehp <= 0) return;
    playAegisReflectImpactSfx();
    spawnMysticHitSparks(pWrap, false);
    php = Math.max(0, php - refl);
    updateHpBars();
    battleSpiritFoxHitMs(SPIRIT_FOX_HIT_MS);
    pWrap.classList.add("battle-actor-hit");
    window.setTimeout(function () {
      pWrap.classList.remove("battle-actor-hit");
    }, 380);
    if (php <= 0) {
      feedLine(player.name + " takes " + refl + " reflected damage — can't continue!");
      return;
    }
    feedLine(player.name + " takes " + refl + " reflected damage!");
  }

  async function executePlayerSpecial() {
    if (php <= 0 || ehp <= 0) return;
    const sm = player.specialMove || "attack";
    const info = SPECIAL_MOVE_INFO[sm] || SPECIAL_MOVE_INFO.attack;
    const windupMs = 2000;
    let stopWindup = function () {};
    let specialHitLanded = false;
    if (els.modalBattle) els.modalBattle.classList.add("battle-overlay--special-sequence");
    try {
      feedLine(player.name + " channels mythic power…");
      setBattleSpeedLinesMode("windup");
      const wLine = pickSpecialShoutLine(info.shoutWindup);
      if (wLine) {
        window.setTimeout(function () {
          showBattleComicShout(wLine, { side: "player", durationMs: 1950 });
          playComicShoutStinger();
        }, 300);
      }
      pWrap.classList.add("battle-actor--special-windup");
      playSpecialWindupSfx(sm);
      stopWindup = startSpecialWindupParticles(sm, pWrap, windupMs);
      await Promise.all([sleepMs(windupMs), typeComicSpecialTitle(info.name, windupMs)]);
      stopWindup();
      pWrap.classList.remove("battle-actor--special-windup");
      if (sm === "attack") battleSpiritFoxAttackMs(2500, els.battlePlayerArt);

      const lLine = pickSpecialShoutLine(info.shoutLaunch);
      if (lLine) {
        showBattleComicShout(lLine, { side: "player", durationMs: 1550 });
        playComicShoutStinger();
      }
      setBattleSpeedLinesMode("launch");
      playSpecialLaunchSfx(sm);
      applyBattleSpecialLunge(pWrap, 480);
      spawnSpecialMoveFxExaggerated(sm, pWrap, sm === "stun" ? eWrap : null, "launch");
      await sleepMs(520);
      if (php <= 0 || ehp <= 0) return;

      if (sm === "attack") {
        launchBattleProjectile(player.attackStyle, true, true);
        await sleepMs(380);
        if (php <= 0 || ehp <= 0) return;
        if (eShield) {
          const incoming = Math.max(
            1,
            Math.round(player.atk * (0.9 + rng() * 0.26) * 2 * COMBAT_BASE_DAMAGE_MULT)
          );
          eShield = false;
          syncShieldClass();
          if (rng() < AEGIS_REFLECT_CHANCE) {
            await applyAegisReflectDamageToPlayer(incoming);
          } else {
            spawnShieldShatterFx(eWrap);
            playBattleHitSfx();
            feedLine(enemy.name + "'s ward blocks the surge!");
          }
          battleSpiritFoxAttackMs(1000, els.battlePlayerArt);
          specialHitLanded = true;
        } else {
          const dmg = Math.max(
            1,
            Math.round(player.atk * (0.9 + rng() * 0.26) * 2 * COMBAT_BASE_DAMAGE_MULT)
          );
          playSpecialImpactSfx("attack");
          if (info.impactWord) showBattleImpactWord(info.impactWord, 880);
          spawnMegaScreenFlash();
          spawnSpecialMoveFxExaggerated(sm, pWrap, eWrap, "impact");
          spawnMysticHitSparks(eWrap, true);
          spawnMysticHitSparks(eWrap, true);
          ehp = Math.max(0, ehp - dmg);
          updateHpBars();
          battleSpiritFoxHitMs(SPIRIT_FOX_HIT_MS, els.battleEnemyArt);
          battleSpiritFoxAttackMs(1000, els.battlePlayerArt);
          specialHitLanded = true;
          eWrap.classList.add("battle-actor-hit");
          setTimeout(function () {
            eWrap.classList.remove("battle-actor-hit");
          }, 380);
          if (ehp <= 0) {
            feedLine(info.name + " hits for " + dmg + "! Foe can't continue!");
          } else {
            const stunMs = Math.round(200 + rng() * 600);
            eStunUntil = tick + stunMs;
            feedLine(
              info.name + " hits for " + dmg + "! Foe stunned " + (stunMs / 1000).toFixed(1) + "s."
            );
          }
        }
      } else if (sm === "defend") {
        pShield = true;
        syncShieldClass();
        playSpecialResolveSfx("defend");
        spawnSpecialMoveFxExaggerated(sm, pWrap, null, "resolve");
        if (info.impactWord) showBattleImpactWord(info.impactWord, 720);
        feedLine("Aegis surrounds " + player.name + " — next hit absorbed.");
      } else if (sm === "heal") {
        const add = Math.round(player.maxHp * 0.25);
        php = Math.min(player.maxHp, php + add);
        playSpecialResolveSfx("heal");
        spawnSpecialMoveFxExaggerated(sm, pWrap, null, "resolve");
        if (info.impactWord) showBattleImpactWord(info.impactWord, 720);
        feedLine(player.name + " restores +" + add + " HP.");
      } else if (sm === "stun") {
        eStunUntil = tick + 2000;
        const hadEnemySp = eSp > 0;
        eSp = Math.max(0, eSp - 1);
        updateBattleSpMeters();
        playSpecialImpactSfx("stun");
        if (info.impactWord) showBattleImpactWord(info.impactWord, 920);
        spawnSpecialMoveFxExaggerated(sm, pWrap, eWrap, "resolve");
        applyBindingHexShock(eWrap, 2000);
        feedLine(
          enemy.name +
            " is mystically bound for 2.0s!" +
            (hadEnemySp ? " Foe SP −1." : "")
        );
      }
      updateHpBars();
      await sleepMs(sm === "attack" ? 120 : 280);
    } finally {
      stopWindup();
      pWrap.classList.remove("battle-actor--special-windup");
      clearBattleComicCallout();
      if (!specialHitLanded) resetBattleSpiritFoxPoseFor(els.battlePlayerArt);
      resetBattleSpiritFoxPoseFor(els.battleEnemyArt);
      if (els.modalBattle) els.modalBattle.classList.remove("battle-overlay--special-sequence");
    }
  }

  async function executeEnemySpecial() {
    if (php <= 0 || ehp <= 0) return;
    const sm = enemy.specialMove || "attack";
    const info = SPECIAL_MOVE_INFO[sm] || SPECIAL_MOVE_INFO.attack;
    const windupMs = 2000;
    let stopWindup = function () {};
    let earlyEnemyAtkT = 0;
    if (els.modalBattle) els.modalBattle.classList.add("battle-overlay--special-sequence");
    try {
      feedLine(enemy.name + " channels mythic power…");
      setBattleSpeedLinesMode("windup");
      const wLineE = pickSpecialShoutLine(info.shoutWindup);
      if (wLineE) {
        window.setTimeout(function () {
          showBattleComicShout(wLineE, { side: "enemy", durationMs: 1950 });
          playComicShoutStinger();
        }, 300);
      }
      eWrap.classList.add("battle-actor--special-windup");
      playSpecialWindupSfx(sm);
      stopWindup = startSpecialWindupParticles(sm, eWrap, windupMs);
      if (sm === "attack") {
        earlyEnemyAtkT = window.setTimeout(function () {
          earlyEnemyAtkT = 0;
          battleSpiritFoxAttackMs(1500, els.battleEnemyArt);
        }, 1480);
      }
      await Promise.all([sleepMs(windupMs), typeComicSpecialTitle(info.name, windupMs)]);
      stopWindup();
      eWrap.classList.remove("battle-actor--special-windup");

      const lLineE = pickSpecialShoutLine(info.shoutLaunch);
      if (lLineE) {
        showBattleComicShout(lLineE, { side: "enemy", durationMs: 1550 });
        playComicShoutStinger();
      }
      setBattleSpeedLinesMode("launch");
      playSpecialLaunchSfx(sm);
      applyBattleSpecialLunge(eWrap, 480);
      spawnSpecialMoveFxExaggerated(sm, eWrap, sm === "stun" ? pWrap : null, "launch");
      await sleepMs(520);
      if (php <= 0 || ehp <= 0) return;

      if (sm === "attack") {
        launchBattleProjectile(enemy.attackStyle, false, true);
        await sleepMs(380);
        if (php <= 0 || ehp <= 0) return;
        if (pShield) {
          const incoming = Math.max(
            1,
            Math.round(enemy.atk * (0.9 + rng() * 0.26) * 2 * COMBAT_BASE_DAMAGE_MULT)
          );
          pShield = false;
          syncShieldClass();
          if (rng() < AEGIS_REFLECT_CHANCE) {
            await applyAegisReflectDamageToEnemy(incoming);
          } else {
            spawnShieldShatterFx(pWrap, true);
            playAegisShieldShatterSfx();
            feedLine("Your ward shatters — surge absorbed!");
          }
        } else {
          const dmg = Math.max(
            1,
            Math.round(enemy.atk * (0.9 + rng() * 0.26) * 2 * COMBAT_BASE_DAMAGE_MULT)
          );
          playSpecialImpactSfx("attack");
          if (info.impactWord) showBattleImpactWord(info.impactWord, 880);
          spawnMegaScreenFlash();
          spawnSpecialMoveFxExaggerated(sm, eWrap, pWrap, "impact");
          spawnMysticHitSparks(pWrap, true);
          spawnMysticHitSparks(pWrap, true);
          php = Math.max(0, php - dmg);
          updateHpBars();
          battleSpiritFoxHitMs(SPIRIT_FOX_HIT_MS);
          pWrap.classList.add("battle-actor-hit");
          setTimeout(function () {
            pWrap.classList.remove("battle-actor-hit");
          }, 380);
          if (php <= 0) {
            feedLine(info.name + " hits for " + dmg + "! You can't continue!");
          } else {
            const stunMs = Math.round(200 + rng() * 600);
            pStunUntil = tick + stunMs;
            feedLine(
              info.name + " hits for " + dmg + "! You are stunned " + (stunMs / 1000).toFixed(1) + "s."
            );
          }
        }
      } else if (sm === "defend") {
        eShield = true;
        syncShieldClass();
        playSpecialResolveSfx("defend");
        spawnSpecialMoveFxExaggerated(sm, eWrap, null, "resolve");
        if (info.impactWord) showBattleImpactWord(info.impactWord, 720);
        feedLine("A ward coalesces on " + enemy.name + " — next strike absorbed.");
      } else if (sm === "heal") {
        const add = Math.round(enemy.maxHp * 0.25);
        ehp = Math.min(enemy.maxHp, ehp + add);
        playSpecialResolveSfx("heal");
        spawnSpecialMoveFxExaggerated(sm, eWrap, null, "resolve");
        if (info.impactWord) showBattleImpactWord(info.impactWord, 720);
        feedLine(enemy.name + " restores +" + add + " HP.");
      } else if (sm === "stun") {
        pStunUntil = tick + 2000;
        playSpecialImpactSfx("stun");
        if (info.impactWord) showBattleImpactWord(info.impactWord, 920);
        spawnSpecialMoveFxExaggerated(sm, eWrap, pWrap, "resolve");
        applyBindingHexShock(pWrap, 2000);
        feedLine("You are bound for 2.0s!");
      }
      updateHpBars();
      await sleepMs(sm === "attack" ? 120 : 280);
    } finally {
      if (earlyEnemyAtkT) clearTimeout(earlyEnemyAtkT);
      stopWindup();
      eWrap.classList.remove("battle-actor--special-windup");
      clearBattleComicCallout();
      resetBattleSpiritFoxPose();
      if (els.modalBattle) els.modalBattle.classList.remove("battle-overlay--special-sequence");
    }
  }

  async function applyPlayerStrikeToEnemy(isCounter) {
    if (php <= 0 || ehp <= 0) return;
    let dmg = Math.max(
      1,
      Math.round(player.atk * (0.9 + rng() * 0.26) * COMBAT_BASE_DAMAGE_MULT)
    );
    let critNote = "";
    let isCrit = false;
    if (isCounter && rng() < 0.25) {
      dmg = Math.max(1, Math.round(dmg * 1.75));
      critNote = " Critical!";
      isCrit = true;
    }
    if (eShield) {
      eShield = false;
      syncShieldClass();
      if (rng() < AEGIS_REFLECT_CHANCE) {
        await applyAegisReflectDamageToPlayer(dmg);
      } else {
        spawnShieldShatterFx(eWrap);
        feedLine(enemy.name + "'s ward shatters — blow absorbed!");
      }
      return;
    }
    playBattleHitSfx();
    spawnMysticHitSparks(eWrap, isCrit);
    ehp = Math.max(0, ehp - dmg);
    updateHpBars();
    battleSpiritFoxHitMs(SPIRIT_FOX_HIT_MS, els.battleEnemyArt);
    eWrap.classList.add("battle-actor-hit");
    setTimeout(function () {
      eWrap.classList.remove("battle-actor-hit");
    }, 380);
    const lead = isCounter
      ? player.name + " counters for " + dmg + "!" + critNote
      : player.name + " hits for " + dmg + "!" + critNote;
    if (ehp <= 0) {
      feedLine(lead + " Foe can't continue!");
      return;
    }
    const stunMs = Math.round(200 + rng() * 600);
    eStunUntil = tick + stunMs;
    feedLine(lead + " Foe stunned " + (stunMs / 1000).toFixed(1) + "s.");
    pSp++;
    updateBattleSpMeters();
    if (pSp >= 3) {
      pSp = 0;
      updateBattleSpMeters();
      await executePlayerSpecial();
    }
  }

  async function applyEnemyStrikeToPlayer(isCounter) {
    if (php <= 0 || ehp <= 0) return;
    let dmg = Math.max(
      1,
      Math.round(enemy.atk * (0.9 + rng() * 0.26) * COMBAT_BASE_DAMAGE_MULT)
    );
    let critNote = "";
    let isCrit = false;
    if (isCounter && rng() < 0.25) {
      dmg = Math.max(1, Math.round(dmg * 1.75));
      critNote = " Critical!";
      isCrit = true;
    }
    if (pShield) {
      pShield = false;
      syncShieldClass();
      if (rng() < AEGIS_REFLECT_CHANCE) {
        await applyAegisReflectDamageToEnemy(dmg);
      } else {
        spawnShieldShatterFx(pWrap, true);
        playAegisShieldShatterSfx();
        feedLine("Your ward shatters — blow absorbed!");
      }
      return;
    }
    playBattleHitSfx();
    spawnMysticHitSparks(pWrap, isCrit);
    php = Math.max(0, php - dmg);
    updateHpBars();
    battleSpiritFoxHitMs(SPIRIT_FOX_HIT_MS);
    pWrap.classList.add("battle-actor-hit");
    setTimeout(function () {
      pWrap.classList.remove("battle-actor-hit");
    }, 380);
    const lead = isCounter
      ? enemy.name + " counters for " + dmg + "!" + critNote
      : enemy.name + " hits for " + dmg + "!" + critNote;
    if (php <= 0) {
      feedLine(lead + " You can't continue!");
      return;
    }
    const stunMs = Math.round(200 + rng() * 600);
    pStunUntil = tick + stunMs;
    feedLine(lead + " You are stunned " + (stunMs / 1000).toFixed(1) + "s.");
    eSp++;
    updateBattleSpMeters();
    if (eSp >= 3) {
      eSp = 0;
      updateBattleSpMeters();
      await executeEnemySpecial();
    }
  }

  async function runEnemyCounterOnly() {
    feedLine(enemy.name + " counters!");
    battleSpiritFoxAttackMs(500, els.battleEnemyArt);
    launchBattleProjectile(enemy.attackStyle, false);
    await sleepMs(340);
    if (php <= 0 || ehp <= 0) return;
    if (rollStrikeMisses()) {
      playBattleEvadeSfx();
      feedLine(enemy.name + "'s counter missed!");
      return;
    }
    await applyEnemyStrikeToPlayer(true);
  }

  async function runPlayerCounterOnly() {
    feedLine(player.name + " counters!");
    battleSpiritFoxAttackMs(500);
    launchBattleProjectile(player.attackStyle, true);
    await sleepMs(340);
    if (php <= 0 || ehp <= 0) return;
    if (rollStrikeMisses()) {
      playBattleEvadeSfx();
      feedLine(player.name + "'s counter missed!");
      return;
    }
    await applyPlayerStrikeToEnemy(true);
  }

  async function runPlayerVolley() {
    battleSpiritFoxAttackMs(500);
    launchBattleProjectile(player.attackStyle, true);
    await sleepMs(340);
    if (php <= 0 || ehp <= 0) return;
    if (rollStrikeMisses()) {
      playBattleEvadeSfx();
      eWrap.classList.add("miss-flash");
      setTimeout(function () {
        eWrap.classList.remove("miss-flash");
      }, 450);
      feedLine(player.name + " missed!");
      await runEnemyCounterOnly();
      return;
    }
    await applyPlayerStrikeToEnemy(false);
  }

  async function runEnemyVolley() {
    battleSpiritFoxAttackMs(500, els.battleEnemyArt);
    launchBattleProjectile(enemy.attackStyle, false);
    await sleepMs(340);
    if (php <= 0 || ehp <= 0) return;
    if (rollStrikeMisses()) {
      playBattleEvadeSfx();
      pWrap.classList.add("miss-flash");
      setTimeout(function () {
        pWrap.classList.remove("miss-flash");
      }, 450);
      feedLine(enemy.name + " missed!");
      await runPlayerCounterOnly();
      return;
    }
    await applyEnemyStrikeToPlayer(false);
  }

  while (tick < maxMs) {
    if (php <= 0 || ehp <= 0) break;
    await sleepMs(48);
    tick += 48;
    pWrap.classList.toggle("stunned", tick < pStunUntil);
    eWrap.classList.toggle("stunned", tick < eStunUntil);
    if (tick >= pStunUntil) pGauge += ((player.speed * 48) / 600) * pSpeedGaugeMul;
    if (tick >= eStunUntil) eGauge += ((enemy.speed * 48) / 600) * eSpeedGaugeMul;

    let actor = null;
    if (pGauge >= 100 && eGauge >= 100) {
      if (player.speed >= enemy.speed) {
        actor = "p";
        pGauge = 0;
        eGauge = Math.max(0, eGauge - 35);
      } else {
        actor = "e";
        eGauge = 0;
        pGauge = Math.max(0, pGauge - 35);
      }
    } else if (pGauge >= 100 && tick >= pStunUntil) {
      actor = "p";
      pGauge = 0;
    } else if (eGauge >= 100 && tick >= eStunUntil) {
      actor = "e";
      eGauge = 0;
    }
    if (!actor) continue;

    if (actor === "p") {
      await runPlayerVolley();
    } else {
      await runEnemyVolley();
    }
    updateHpBars();
  }

  clearBindingHexShock(pWrap);
  clearBindingHexShock(eWrap);
  pWrap.classList.remove("stunned", "battle-actor-shield", "battle-actor--special-windup", "binding-hex-shock");
  eWrap.classList.remove("stunned", "battle-actor-shield", "battle-actor--special-windup", "binding-hex-shock");
  pShield = eShield = false;
  resetBattleSpiritFoxPose();

  let win = false;
  if (ehp <= 0 && php > 0) win = true;
  else if (php <= 0 && ehp > 0) win = false;
  else if (php <= 0 && ehp <= 0) win = php >= ehp;
  else {
    feedLine("The clash exhausts both sides…");
    win = php >= ehp;
  }

  var myWin = pvpIsChallenger === false ? !win : win;

  els.battleResult.classList.remove("win", "lose", "visible");

  let salvagedFood = null;
  let salvagedRelic = null;
  let salvagedBall = false;
  if (myWin) {
    self.battles = (self.battles || 0) + 1;
    if (!self.influence) self.influence = { greek: 0, japan: 0, sea: 0, egypt: 0 };
    self.influence[region] = (self.influence[region] || 0) + 4;
    const hWin = self.happiness;
    self.happiness = clamp(self.happiness + 3, 0, 100);
    playMythMoodSfxForDelta(self.happiness - hWin);
    self.weakerEnemyPityTier = 0;
    self.consecutiveLosses = 0;
    self.guaranteedWeakerNextBattle = false;
    const canFood = FOODS.length > 0;
    const canRelic = RELIC_ITEMS.length > 0;
    if (canFood || canRelic) {
      const lootChance = 0.58 + Math.random() * 0.24;
      if (Math.random() < lootChance) {
        if (canFood && canRelic) {
          if (Math.random() < 0.72) {
            const loot = FOODS[Math.floor(Math.random() * FOODS.length)];
            ensureFoodInventoryState();
            state.foodInventory[loot.id] = (state.foodInventory[loot.id] || 0) + 1;
            salvagedFood = loot;
          } else {
            const loot = RELIC_ITEMS[Math.floor(Math.random() * RELIC_ITEMS.length)];
            ensureRelicInventoryState();
            state.relicInventory[loot.id] = (state.relicInventory[loot.id] || 0) + 1;
            salvagedRelic = loot;
          }
        } else if (canFood) {
          const loot = FOODS[Math.floor(Math.random() * FOODS.length)];
          ensureFoodInventoryState();
          state.foodInventory[loot.id] = (state.foodInventory[loot.id] || 0) + 1;
          salvagedFood = loot;
        } else {
          const loot = RELIC_ITEMS[Math.floor(Math.random() * RELIC_ITEMS.length)];
          ensureRelicInventoryState();
          state.relicInventory[loot.id] = (state.relicInventory[loot.id] || 0) + 1;
          salvagedRelic = loot;
        }
      }
    }
    if (Math.random() < 0.25) {
      state.playBalls = (state.playBalls || 0) + 1;
      salvagedBall = true;
    }
  } else {
    const hLose = self.happiness;
    self.happiness = clamp(self.happiness - 3, 0, 100);
    playMythMoodSfxForDelta(self.happiness - hLose);
    self.hunger = clamp(self.hunger - 8, 0, 100);
    self.discipline = clamp((self.discipline != null ? self.discipline : 0) - 4, 0, 100);
    self.lifespan = clamp((self.lifespan != null ? self.lifespan : 100) - 3, 0, 100);
    if (!self.influence) self.influence = { greek: 0, japan: 0, sea: 0, egypt: 0 };
    self.influence[region] = (self.influence[region] || 0) + 1;
    self.weakerEnemyPityTier = Math.min(2, (self.weakerEnemyPityTier || 0) + 1);
    self.consecutiveLosses = (self.consecutiveLosses || 0) + 1;
    if (self.consecutiveLosses >= 2) {
      self.guaranteedWeakerNextBattle = true;
    }
  }
  const preStats = combatStatsForPet(self.lineId, self.nodeKey, self);
  const train = rollCombatTraining(myWin, player.combatBp, enemy.combatBp, self);
  const postStats = combatStatsForPet(self.lineId, self.nodeKey, self);

  playBattleSfx(myWin);
  spawnBattleEndParticles(myWin);

  pWrap.classList.add(myWin ? "battle-actor--post-win" : "battle-actor--post-lose");
  if (eWrap) eWrap.classList.add(myWin ? "battle-actor--post-lose" : "battle-actor--post-win");
  await sleepMs(2000);
  pWrap.classList.remove("battle-actor--post-win", "battle-actor--post-lose");
  if (eWrap) eWrap.classList.remove("battle-actor--post-lose", "battle-actor--post-win");

  await showBattlePostStatSummary(
    myWin,
    preStats,
    postStats,
    train,
    player.name,
    salvagedFood,
    salvagedRelic,
    salvagedBall
  );

  stopAdventureBattleBgm();

  els.modalBattle.className = "battle-overlay";
  document.body.classList.remove("battle-active");
  setBattleActive(false);
  if (state.demand) startDemandResponseTimer();

  const tp = [];
  if (train.dHp) tp.push("+" + train.dHp + " HP");
  if (train.dAtk) tp.push("+" + train.dAtk + " Atk");
  if (train.dSpd) tp.push("+" + train.dSpd + " Spd");
  const trMsg =
    train.points > 0
      ? "Training +" + train.points + (tp.length ? " (" + tp.join(", ") + ")" : "") + "."
      : "No combat training from this result.";
  if (myWin) {
    pushLog(
      "Victory in " +
        REGION_LABEL[region] +
        "! Battles +1, influence +4." +
        (salvagedFood
          ? " Salvaged food: " + foodIconFor(salvagedFood) + " " + salvagedFood.name + "."
          : "") +
        (salvagedRelic
          ? " Salvaged relic: " + (salvagedRelic.icon || "🏺") + " " + salvagedRelic.name + "."
          : "") +
        (salvagedBall ? " Found a play ball! \u26BD" : "") +
        " " +
        trMsg
    );
  } else {
    pushLog(
      "Defeat in " +
        REGION_LABEL[region] +
        "… +1 influence; hunger, discipline, and lifespan all took a hit. " +
        trMsg
    );
  }
  tickHunger(self);
  if (self.lifespan != null && self.lifespan <= 0) {
    renderPet();
    const deathSlot = (self === state.companion) ? 1 : 0;
    triggerCreatureDeath(deathSlot);
    return;
  }
  renderPet();
  refreshPlayBallButton();
  restartPetIdle();
  if (self.lineId) startLairAmbient(self.lineId);

  try {
    await incrementStat(myWin ? "totalBattlesWon" : "totalBattlesLost", 1);
    var xpRewards = await awardXp(myWin ? 30 : 10);
    if (xpRewards) showLevelUpIfNeeded(xpRewards);
  } catch (e) {}

  try {
    if (myWin) {
      checkTieredAchievements("bat_win", self.battles || 1);
      if (region === "greek") incrementAchievement("bat_greek_t1");
      if (region === "japan") incrementAchievement("bat_japan_t1");
      if (region === "sea") incrementAchievement("bat_sea_t1");
      if (region === "egypt") incrementAchievement("bat_egypt_t1");
      checkTieredAchievements("bat_greek", (self.influence && self.influence.greek) || 0);
      checkTieredAchievements("bat_japan", (self.influence && self.influence.japan) || 0);
      checkTieredAchievements("bat_sea", (self.influence && self.influence.sea) || 0);
      checkTieredAchievements("bat_egypt", (self.influence && self.influence.egypt) || 0);
    } else {
      incrementAchievement("bat_lose_t1");
      checkTieredAchievements("bat_lose", self.battles || 1);
    }
    checkTieredAchievements("bat_total", (self.battles || 0));
    checkAchievement("sec_first_battle", 1);
    checkTieredAchievements("exp_adventures", self.battles || 1);
    var totalInf = (self.influence ? (self.influence.greek || 0) + (self.influence.japan || 0) + (self.influence.sea || 0) + (self.influence.egypt || 0) : 0);
    checkTieredAchievements("col_influence_total", totalInf);
    checkTieredAchievements("exp_greek_inf", (self.influence && self.influence.greek) || 0);
    checkTieredAchievements("exp_japan_inf", (self.influence && self.influence.japan) || 0);
    checkTieredAchievements("exp_sea_inf", (self.influence && self.influence.sea) || 0);
    checkTieredAchievements("exp_egypt_inf", (self.influence && self.influence.egypt) || 0);
    var cs = combatStatsForPet(self.lineId, self.nodeKey, self);
    if (cs) {
      checkTieredAchievements("exp_bp", cs.combatBp);
      if (cs.combatBp >= 50) checkAchievement("sec_bp50", 1);
      if (cs.combatBp >= 100) checkAchievement("sec_bp100", 1);
    }
  } catch (e) {}

  saveGameState();
  return { win: win };
}

/* ═══════════════════════════════════════════════════════
   ADVENTURE INTRO
   ═══════════════════════════════════════════════════════ */

export function adventureIntroStoryHash(region, playerStage, isUpTier, salt) {
  const s = String(region) + "," + playerStage + "," + (isUpTier ? "U" : "N");
  let h = salt >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** Romantic / philosophical setting voice — never uses real region names. */
export function adventurePlaceSoul(region, salt) {
  const pools = {
    greek: [
      "salt wind and marble light still negotiate what mortals may know",
      "the air tastes of questions no oracle ever finished answering",
      "worn stone holds debates the sea has not yet won",
      "sunlight pools like old certainty between the ribs of broken columns",
      "every horizon remembers a god who promised to return and learned absence instead",
    ],
    japan: [
      "cedar mist teaches patience before the blade learns its name",
      "rain threads the sacred gate as if silence were instructing the world",
      "the moon files its reflection thin on water that refuses to hurry",
      "mountains drink footfalls until only intention remains audible",
      "petals and resolve fall together — neither asks to be remembered",
    ],
    sea: [
      "green heat hoards memory in tide, root, and the hush between palms",
      "mangrove fingers rewrite the shore while no witness takes the minutes",
      "monsoon thought lingers in the lungs of the jungle like a second heartbeat",
      "salt and fruit and drumbeat share one humid, generous breath",
      "the horizon trades names with every wave — nothing stays spelled the same",
    ],
    egypt: [
      "gold-slow dunes rehearse eternity in their patient curves",
      "the river inscribes law on the land, gentle as judgment must be",
      "star-maps dictate what daylight pretends it can forget",
      "heat sculpts patience; the wind carries verdicts it never voices",
      "meaning shimmers on the heat — hieroglyphs written only in mirage",
    ],
  };
  const list = pools[region] || pools.greek;
  const i = Math.imul(salt >>> 0, 0x9e3779b1) % list.length;
  return list[i];
}

export function pickAdventureStoryLine(region, ctx) {
  const S = adventurePlaceSoul(region, (ctx.introSalt || 0) ^ 0x5bd1e995);
  const tierR = ["I", "II", "III", "IV", "V"];
  const foeTier = tierR[ctx.enemyStage] || "?";
  const LT = ctx.lineTitle || "Your myth";
  const EN = ctx.enemyName || "a rival";
  const normalLines = [
    function () {
      return (
        LT +
        " tears along the world's margin where " +
        S +
        " — dust and fate rise together; something waits ahead."
      );
    },
    function () {
      return (
        "Rumor travels on breath alone where " +
        S +
        "; " +
        LT +
        " answers with speed, as if hurry were a kind of prayer."
      );
    },
    function () {
      return (
        LT +
        " crosses a threshold of air where " +
        S +
        " — steel hums in the distance before honor draws it."
      );
    },
    function () {
      return (
        "The path bends toward consequence through a country where " +
        S +
        "; " +
        LT +
        " does not slow — motion is the only scripture left."
      );
    },
    function () {
      return (
        "An old pulse stirs beneath the soles of things where " +
        S +
        "; " +
        LT +
        " closes the distance in one breathless sprint toward meaning."
      );
    },
    function () {
      return (
        LT +
        " runs until the world blurs into the hush where " +
        S +
        " — then the quiet breaks like a bell under water."
      );
    },
    function () {
      return (
        "Worn earth remembers gods in its grain where " +
        S +
        "; " +
        LT +
        " follows that memory like a thread through the dark."
      );
    },
    function () {
      return (
        "Heat, cold, indifferent sky — all agree where " +
        S +
        "; " +
        LT +
        " meets a guardian stride for stride, two truths in one road."
      );
    },
    function () {
      return (
        LT +
        " hears the ring of futures not yet born echoing through " +
        S +
        " — combat as a form of listening."
      );
    },
    function () {
      return (
        "No map, only instinct crossing the mood where " +
        S +
        " — " +
        LT +
        " drifts toward the waiting foe like iron to lodestone."
      );
    },
    function () {
      return (
        "Doubt dissolves to motion where " +
        S +
        "; " +
        LT +
        " outruns the small self and dives into whatever answers."
      );
    },
  ];
  const upTierLines = [
    function () {
      return (
        "A shiver runs the marrow of the landscape where " +
        S +
        " — " +
        EN +
        " rides a tier-" +
        foeTier +
        " storm, heavier teeth than the road ever promised your heart."
      );
    },
    function () {
      return (
        LT +
        " expected a fair match in the hush where " +
        S +
        " — instead, " +
        EN +
        " looms a full tier above (" +
        foeTier +
        "), a lesson written in scale."
      );
    },
    function () {
      return (
        "Omen thick as incense where " +
        S +
        ": " +
        EN +
        " moves with the weight of tier " +
        foeTier +
        " — uncommon gravity, as if myth leaned closer."
      );
    },
    function () {
      return (
        "They whispered legend on the breath of " +
        S +
        "; " +
        EN +
        " proves it — tier " +
        foeTier +
        " blocks the way like a wall made of tomorrow."
      );
    },
  ];
  const pool = ctx.isUpTierNatural ? upTierLines : normalLines;
  const idx =
    adventureIntroStoryHash(region, ctx.playerStage, ctx.isUpTierNatural, ctx.introSalt) % pool.length;
  return pool[idx]();
}

/** One random sentence from the foe node's `lore` in creatures data; fallback to journey prose. */
export function randomEnemyLoreSentence(enemy, region, ctx) {
  if (!enemy || !enemy.lineId || !enemy.nodeKey) {
    return pickAdventureStoryLine(region, ctx);
  }
  const L = LINES[enemy.lineId];
  const node = L ? nodeByKey(L, enemy.nodeKey) : null;
  const lore = node && node.lore && node.lore.length ? node.lore : null;
  if (lore) {
    return lore[Math.floor(Math.random() * lore.length)];
  }
  return pickAdventureStoryLine(region, ctx);
}

export function stopAdventureIntroRunFx() {
  if (adventureIntroFootIntervalId != null) {
    clearInterval(adventureIntroFootIntervalId);
    adventureIntroFootIntervalId = null;
  }
  if (adventureIntroDustIntervalId != null) {
    clearInterval(adventureIntroDustIntervalId);
    adventureIntroDustIntervalId = null;
  }
  if (els.adventureIntroDustRoot) els.adventureIntroDustRoot.innerHTML = "";
  if (els.adventureIntroTrack) {
    els.adventureIntroTrack.classList.remove(
      "adventure-intro-track--running",
      "adventure-intro-track--foe-burst"
    );
  }
}

export function closeAdventureIntroOverlay() {
  stopAdventureIntroRunFx();
  if (els.modalAdventureIntro) {
    els.modalAdventureIntro.classList.remove("open", "adventure-intro-overlay--mist-out");
  }
  if (els.adventureIntroRunnerWrap) {
    els.adventureIntroRunnerWrap.classList.remove(
      "adventure-intro-runner--dash",
      "adventure-intro-runner--dash-soft",
      "adventure-intro-runner-wrap--concealed"
    );
  }
  if (els.adventureIntroRunner) els.adventureIntroRunner.innerHTML = "";
  if (els.adventureIntroFoeRise) els.adventureIntroFoeRise.setAttribute("hidden", "");
  if (els.adventureIntroFoeRiseInner) els.adventureIntroFoeRiseInner.innerHTML = "";
  if (els.adventureIntroFoeNameLine) {
    els.adventureIntroFoeNameLine.textContent = "";
    els.adventureIntroFoeNameLine.setAttribute("hidden", "");
  }
  if (els.adventureIntroStory) {
    els.adventureIntroStory.classList.remove("visible");
    els.adventureIntroStory.setAttribute("aria-hidden", "true");
  }
}

function spawnAdventureDustPuff() {
  const dustRoot = els.adventureIntroDustRoot;
  const wrap = els.adventureIntroRunnerWrap;
  if (!dustRoot || !wrap) return;
  const leftPct = 28 + Math.random() * 35;
  const p = document.createElement("span");
  p.className = "adventure-dust-puff";
  p.style.left = leftPct + "%";
  dustRoot.appendChild(p);
  setTimeout(function () {
    if (p.parentNode) p.remove();
  }, 600);
}

export async function runAdventureJourneyIntro(region, ctx) {
  const root = els.modalAdventureIntro;
  const wrap = els.adventureIntroRunnerWrap;
  const host = els.adventureIntroRunner;
  const storyEl = els.adventureIntroStory;
  const storyText = els.adventureIntroStoryText;
  const introLineId = (ctx && ctx.selfLineId) || state.lineId;
  const introNodeKey = (ctx && ctx.selfNodeKey) || state.nodeKey;
  if (!root || !wrap || !host || !storyEl || !storyText || !introLineId) return;

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animMs = reduced ? 240 : 2000;

  root.classList.remove("adventure-intro-overlay--mist-out");
  if (els.adventureIntroTrack) els.adventureIntroTrack.classList.remove("adventure-intro-track--foe-burst");
  if (els.adventureIntroRunnerWrap) {
    els.adventureIntroRunnerWrap.classList.remove("adventure-intro-runner-wrap--concealed");
  }
  if (els.adventureIntroFoeRise) els.adventureIntroFoeRise.setAttribute("hidden", "");
  if (els.adventureIntroFoeRiseInner) els.adventureIntroFoeRiseInner.innerHTML = "";
  if (els.adventureIntroFoeNameLine) {
    els.adventureIntroFoeNameLine.textContent = "";
    els.adventureIntroFoeNameLine.setAttribute("hidden", "");
  }

  stopAdventureIntroRunFx();

  host.innerHTML =
    '<div class="pet-portrait-idle">' +
    '<div class="pet-portrait-idle-content">' +
    petArtHtml(introLineId, introNodeKey) +
    "</div></div>";
  const sf = host.querySelector(".pet-art-raster--multi-frame");
  if (sf) sf.classList.add("walking");

  storyEl.classList.remove("visible");
  storyText.textContent = "";
  storyEl.setAttribute("aria-hidden", "true");

  wrap.classList.remove("adventure-intro-runner--dash", "adventure-intro-runner--dash-soft");
  if (els.adventureIntroTrack) {
    els.adventureIntroTrack.classList.remove("adventure-intro-track--running");
  }
  void wrap.offsetWidth;

  root.classList.add("open");

  await new Promise(function (resolve) {
    window.requestAnimationFrame(resolve);
  });

  if (els.adventureIntroTrack) {
    void els.adventureIntroTrack.offsetWidth;
    els.adventureIntroTrack.classList.toggle("adventure-intro-track--running", !reduced);
  }
  void wrap.offsetWidth;
  wrap.classList.add(reduced ? "adventure-intro-runner--dash-soft" : "adventure-intro-runner--dash");

  if (!reduced) {
    adventureIntroFootIntervalId = window.setInterval(playAdventureRunFootstepSfx, 290);
    adventureIntroDustIntervalId = window.setInterval(spawnAdventureDustPuff, 165);
  }

  let animDone = false;
  await new Promise(function (resolve) {
    const finish = function () {
      if (animDone) return;
      animDone = true;
      window.clearTimeout(fallbackT);
      wrap.removeEventListener("animationend", onEnd);
      resolve();
    };
    const fallbackT = window.setTimeout(finish, animMs + 120);
    function onEnd(ev) {
      if (!ev || ev.target !== wrap) return;
      finish();
    }
    wrap.addEventListener("animationend", onEnd);
  });

  stopAdventureIntroRunFx();

  const foe = ctx.enemy;
  if (foe && foe.lineId && foe.nodeKey) {
    if (els.adventureIntroRunnerWrap) els.adventureIntroRunnerWrap.classList.add("adventure-intro-runner-wrap--concealed");
    if (els.adventureIntroRunner) els.adventureIntroRunner.innerHTML = "";

    storyText.textContent = randomEnemyLoreSentence(foe, region, ctx);
    if (els.adventureIntroFoeNameLine) {
      els.adventureIntroFoeNameLine.textContent = foe.name || "";
      els.adventureIntroFoeNameLine.removeAttribute("hidden");
    }
    if (els.adventureIntroStoryHint) {
      els.adventureIntroStoryHint.textContent =
        "Click or press Enter to step into the mist and fight.";
    }
    if (els.adventureIntroFoeRiseInner) {
      els.adventureIntroFoeRiseInner.innerHTML =
        '<div class="pet-portrait-idle">' +
        '<div class="pet-portrait-idle-content">' +
        petArtHtml(foe.lineId, foe.nodeKey) +
        "</div></div>";
      const mfIdle = els.adventureIntroFoeRiseInner.querySelector(".pet-art-raster--multi-frame");
      if (mfIdle) mfIdle.classList.remove("walking", "attacking");
    }
    if (els.adventureIntroFoeRise) els.adventureIntroFoeRise.removeAttribute("hidden");
    if (els.adventureIntroFoeRiseInner) void els.adventureIntroFoeRiseInner.offsetWidth;

    storyEl.setAttribute("aria-hidden", "false");
    storyEl.classList.add("visible");

    await new Promise(function (resolve) {
      const inner = els.adventureIntroFoeRiseInner;
      if (!inner || reduced) {
        window.setTimeout(resolve, reduced ? 25 : 380);
        return;
      }
      let done = false;
      const finish = function () {
        if (done) return;
        done = true;
        inner.removeEventListener("animationend", onEnd);
        window.clearTimeout(fallbackT);
        resolve();
      };
      const fallbackT = window.setTimeout(finish, 460);
      function onEnd(ev) {
        if (!ev || ev.target !== inner) return;
        const n = String(ev.animationName || "");
        if (n.indexOf("adventureFoeRiseFromBottom") === -1 && n.indexOf("RiseFromBottom") === -1) return;
        finish();
      }
      inner.addEventListener("animationend", onEnd);
    });

    const mfAtk = els.adventureIntroFoeRiseInner && els.adventureIntroFoeRiseInner.querySelector(".pet-art-raster--multi-frame");
    if (mfAtk) mfAtk.classList.add("attacking");
    playAdventureFoeRoarSfx();
    if (els.adventureIntroTrack) els.adventureIntroTrack.classList.add("adventure-intro-track--foe-burst");

    playAdventureBattleBgm();
  } else {
    storyText.textContent = pickAdventureStoryLine(region, ctx);
    if (els.adventureIntroFoeNameLine) els.adventureIntroFoeNameLine.setAttribute("hidden", "");
    if (els.adventureIntroStoryHint) {
      els.adventureIntroStoryHint.textContent = "Click or press Enter to continue.";
    }
    storyEl.setAttribute("aria-hidden", "false");
    storyEl.classList.add("visible");
  }

  let advanceDone = false;
  await new Promise(function (resolve) {
    const done = function () {
      if (advanceDone) return;
      advanceDone = true;
      window.clearTimeout(t);
      root.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDoc, true);
      resolve();
    };
    const t = window.setTimeout(done, 6000);
    function onClick() {
      done();
    }
    function onKeyDoc(ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        done();
      }
    }
    root.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDoc, true);
  });

  if (foe && foe.lineId && foe.nodeKey) {
    await new Promise(function (resolve) {
      let finished = false;
      const finish = function () {
        if (finished) return;
        finished = true;
        root.removeEventListener("animationend", onAnimEnd);
        window.clearTimeout(fallbackT);
        resolve();
      };
      const fallbackT = window.setTimeout(finish, reduced ? 350 : 750);
      function onAnimEnd(ev) {
        if (!ev || ev.target !== root) return;
        const name = String(ev.animationName || "");
        if (name.indexOf("adventureIntroMistOut") === -1 && name.indexOf("MistOut") === -1) return;
        finish();
      }
      root.addEventListener("animationend", onAnimEnd);
      void root.offsetWidth;
      root.classList.add("adventure-intro-overlay--mist-out");
    });
  }

  closeAdventureIntroOverlay();
}

/* ═══════════════════════════════════════════════════════
   BATTLE SESSION
   ═══════════════════════════════════════════════════════ */

function setBattleHudName(nameEl, name, lineId, nodeKey, fallback) {
  if (!nameEl) return;
  nameEl.textContent = name || "Myth";
  const portrait = document.createElement("span");
  portrait.className = "battle-hud-portrait";
  if (lineId && LINES[lineId]) {
    portrait.innerHTML = petArtHtml(lineId, nodeKey || "base");
  } else {
    portrait.textContent = fallback || "✦";
  }
  nameEl.appendChild(portrait);
}

export async function runBattleSession(region, adventureOptions) {
  cancelPetSleepSilent();
  setBattleActive(true);
  updateSpiritBerryUi();
  stopDemandAttentionLoop();
  clearDemandWindowTimers();
  stopLairAmbient();
  stopPetIdle();
  document.body.classList.add("battle-active");

  const slot = (adventureOptions && adventureOptions.mythSlot != null)
    ? adventureOptions.mythSlot
    : (state.activeMythTab || 0);
  const mythSelf = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  const selfFLid = (mythSelf.crossLineageId && LINES[mythSelf.crossLineageId]) ? mythSelf.crossLineageId : mythSelf.lineId;
  const player = combatStatsForPet(selfFLid, mythSelf.nodeKey, mythSelf);
  const ps = getCurrentNode(LINES[selfFLid], mythSelf.nodeKey).stage;
  const advIntro =
    adventureOptions && adventureOptions.adventure
      ? "Battle — " + REGION_LABEL[region] + ".\n"
      : "";

  let enemy;
  if (adventureOptions && adventureOptions.adventure) {
    const built = buildAdventureEnemy(region, player.combatBp, ps, mythSelf);
    enemy = built.enemy;
    await runAdventureJourneyIntro(region, {
      enemy: built.enemy,
      isUpTierNatural: built.isUpTierNatural,
      enemyName: built.enemy.name,
      enemyStage: built.enemy.stage,
      playerStage: ps,
      lineTitle: LINES[selfFLid].title,
      selfLineId: mythSelf.lineId,
      selfNodeKey: mythSelf.nodeKey,
      selfFormLineId: selfFLid,
      introSalt: (Math.random() * 0x7fffffff) | 0,
    });
  } else {
    enemy = buildArenaLineOpponent(region, ps, player.combatBp);
  }

  var _wasOpen = els.modalBattle.classList.contains("open");
  els.modalBattle.className = "battle-overlay arena-" + region + (_wasOpen ? " open" : "");
  els.battleFeed.textContent = "";
  els.battleResult.classList.remove("visible", "win", "lose");
  if (els.battlePostSummary) {
    els.battlePostSummary.classList.remove("visible");
    els.battlePostSummary.setAttribute("aria-hidden", "true");
  }
  clearBattleComicCallout();
  resetBattleSpiritFoxPose();
  if (els.modalBattle) {
    els.modalBattle.classList.remove("battle-overlay--special-sequence");
    els.modalBattle.querySelectorAll(".battle-hit-flash-mega, .battle-spec-mega").forEach(function (n) {
      n.remove();
    });
  }
  if (els.battleFxLayer) els.battleFxLayer.innerHTML = "";
  if (els.modalBattle) {
    const ar = els.modalBattle.querySelector(".battle-arena");
    if (ar) {
      ar.querySelectorAll(".battle-hit-spark, .battle-hit-spark-core, .battle-spec-particle").forEach(
        function (n) {
          n.remove();
        }
      );
    }
  }
  if (els.battlePlayerWrap) {
    clearBindingHexShock(els.battlePlayerWrap);
    els.battlePlayerWrap.classList.remove(
      "battle-actor-shield",
      "battle-actor--special-windup",
      "binding-hex-shock"
    );
  }
  if (els.battleEnemyWrap) {
    clearBindingHexShock(els.battleEnemyWrap);
    els.battleEnemyWrap.classList.remove(
      "battle-actor-shield",
      "battle-actor--special-windup",
      "binding-hex-shock"
    );
  }

  if (mythSelf.guaranteedWeakerNextBattle) {
    const pc = Math.max(1, player.combatBp);
    scaleEnemyDownToMaxCombatBp(enemy, Math.max(8, Math.floor(pc * 0.68)));
    mythSelf.weakerEnemyPityTier = 0;
    mythSelf.consecutiveLosses = 0;
    mythSelf.guaranteedWeakerNextBattle = false;
    els.battleFeed.textContent =
      advIntro +
      "Mercy: after two losses, this foe is tuned weaker — pity reset for the road ahead.\n";
  } else {
    if (advIntro) els.battleFeed.textContent = advIntro;
    applyMercyPityToEnemy(enemy, player.combatBp, mythSelf.weakerEnemyPityTier || 0);
  }

  els.modalBattle.classList.add("open");

  setBattleHudName(els.battlePlayerName, player.name, mythSelf.lineId, mythSelf.nodeKey);
  setBattleHudName(els.battleEnemyName, enemy.name, enemy.lineId, enemy.nodeKey);
  els.battlePlayerArt.innerHTML = petArtHtml(mythSelf.lineId, mythSelf.nodeKey);
  els.battleEnemyArt.innerHTML = petArtHtml(enemy.lineId, enemy.nodeKey);
  els.battlePlayerHp.style.width = "100%";
  els.battleEnemyHp.style.width = "100%";

  await simulateBattleCombat(player, enemy, region, undefined, undefined, mythSelf);
}

var PVP_TAUNT_LINES = [
  "{name} steps from the shadows, eyes gleaming with challenge.",
  "A rival keeper appears — {name} will not yield easily.",
  "{name} has heard of your myth. They are not impressed.",
  "The ground trembles as {name}'s myth enters the arena.",
  "{name} grins. \"Is that the best you can raise?\"",
  "Legends speak of {name}'s ferocity. Now you face it.",
  "{name}'s myth roars — the challenge has been accepted.",
  "\"Your myth looks tired,\" {name} taunts. \"This won't take long.\"",
  "{name} raises a hand. The arena falls silent.",
  "From across the veil, {name} emerges — ready for war.",
  "\"I've been waiting for this,\" says {name}. \"Don't disappoint me.\"",
  "{name}'s myth coils with energy, eager to prove its strength.",
  "A hush falls over the arena. {name} has arrived.",
  "\"Show me what your myth is made of,\" {name} demands.",
  "{name} locks eyes with you. There is no turning back.",
  "The air crackles as {name}'s myth readies for battle.",
];

function pickPvpTaunt(opponentName) {
  var line = PVP_TAUNT_LINES[Math.floor(Math.random() * PVP_TAUNT_LINES.length)];
  return line.replace(/\{name\}/g, opponentName);
}

async function runPvpIntro(mySnap, opSnap, region) {
  var root = els.modalAdventureIntro;
  var wrap = els.adventureIntroRunnerWrap;
  var host = els.adventureIntroRunner;
  var storyEl = els.adventureIntroStory;
  var storyText = els.adventureIntroStoryText;
  if (!root || !wrap || !host || !storyEl || !storyText) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var animMs = reduced ? 480 : 4000;

  root.classList.remove("adventure-intro-overlay--mist-out");
  if (els.adventureIntroTrack) els.adventureIntroTrack.classList.remove("adventure-intro-track--foe-burst");
  if (els.adventureIntroRunnerWrap) els.adventureIntroRunnerWrap.classList.remove("adventure-intro-runner-wrap--concealed");
  if (els.adventureIntroFoeRise) els.adventureIntroFoeRise.setAttribute("hidden", "");
  if (els.adventureIntroFoeRiseInner) els.adventureIntroFoeRiseInner.innerHTML = "";
  if (els.adventureIntroFoeNameLine) {
    els.adventureIntroFoeNameLine.textContent = "";
    els.adventureIntroFoeNameLine.setAttribute("hidden", "");
  }

  stopAdventureIntroRunFx();

  var myLineId = mySnap.lineId || state.lineId;
  var myNodeKey = mySnap.nodeKey || state.nodeKey;
  if (myLineId && LINES[myLineId]) {
    host.innerHTML = '<div class="pet-portrait-idle"><div class="pet-portrait-idle-content">' + petArtHtml(myLineId, myNodeKey) + '</div></div>';
  } else {
    host.innerHTML = '<div style="font-size:3rem;text-align:center">' + (mySnap.avatarEmoji || "\uD83D\uDC09") + '</div>';
  }
  var sf = host.querySelector(".pet-art-raster--multi-frame");
  if (sf) sf.classList.add("walking");

  storyEl.classList.remove("visible");
  storyText.textContent = "";
  storyEl.setAttribute("aria-hidden", "true");

  wrap.classList.remove("adventure-intro-runner--dash", "adventure-intro-runner--dash-soft");
  if (els.adventureIntroTrack) els.adventureIntroTrack.classList.remove("adventure-intro-track--running");
  void wrap.offsetWidth;

  root.classList.add("open");

  await new Promise(function (r) { window.requestAnimationFrame(r); });

  if (els.adventureIntroTrack) {
    void els.adventureIntroTrack.offsetWidth;
    els.adventureIntroTrack.classList.toggle("adventure-intro-track--running", !reduced);
  }
  void wrap.offsetWidth;
  wrap.classList.add(reduced ? "adventure-intro-runner--dash-soft" : "adventure-intro-runner--dash");

  if (!reduced) {
    adventureIntroFootIntervalId = window.setInterval(playAdventureRunFootstepSfx, 290);
    adventureIntroDustIntervalId = window.setInterval(spawnAdventureDustPuff, 165);
  }

  var animDone = false;
  await new Promise(function (resolve) {
    var finish = function () { if (animDone) return; animDone = true; window.clearTimeout(fb); wrap.removeEventListener("animationend", onEnd); resolve(); };
    var fb = window.setTimeout(finish, animMs + 120);
    function onEnd(ev) { if (!ev || ev.target !== wrap) return; finish(); }
    wrap.addEventListener("animationend", onEnd);
  });

  stopAdventureIntroRunFx();

  if (els.adventureIntroRunnerWrap) els.adventureIntroRunnerWrap.classList.add("adventure-intro-runner-wrap--concealed");
  if (els.adventureIntroRunner) els.adventureIntroRunner.innerHTML = "";

  var opName = opSnap.displayName || opSnap.name || "Opponent";
  var taunt = pickPvpTaunt(opName);
  storyText.textContent = taunt;

  if (els.adventureIntroFoeNameLine) {
    var nameLine = (opSnap.avatarEmoji || "") + " " + opName;
    if (opSnap.profile && opSnap.profile.title) nameLine += " — " + opSnap.profile.title;
    els.adventureIntroFoeNameLine.textContent = nameLine;
    els.adventureIntroFoeNameLine.removeAttribute("hidden");
  }
  if (els.adventureIntroStoryHint) {
    els.adventureIntroStoryHint.textContent = "Click or press Enter to begin the battle.";
  }

  var opLineId = opSnap.lineId;
  var opNodeKey = opSnap.nodeKey || "base";
  if (els.adventureIntroFoeRiseInner) {
    if (opLineId && LINES[opLineId]) {
      els.adventureIntroFoeRiseInner.innerHTML = '<div class="pet-portrait-idle"><div class="pet-portrait-idle-content">' + petArtHtml(opLineId, opNodeKey) + '</div></div>';
    } else {
      els.adventureIntroFoeRiseInner.innerHTML = '<div style="font-size:4rem;text-align:center">' + (opSnap.avatarEmoji || "\u2694\uFE0F") + '</div>';
    }
    var mfIdle = els.adventureIntroFoeRiseInner.querySelector(".pet-art-raster--multi-frame");
    if (mfIdle) mfIdle.classList.remove("walking", "attacking");
  }
  if (els.adventureIntroFoeRise) els.adventureIntroFoeRise.removeAttribute("hidden");
  if (els.adventureIntroFoeRiseInner) void els.adventureIntroFoeRiseInner.offsetWidth;

  storyEl.setAttribute("aria-hidden", "false");
  storyEl.classList.add("visible");

  await new Promise(function (resolve) {
    var inner = els.adventureIntroFoeRiseInner;
    if (!inner || reduced) { window.setTimeout(resolve, reduced ? 50 : 760); return; }
    var done = false;
    var finish = function () { if (done) return; done = true; inner.removeEventListener("animationend", onEnd); window.clearTimeout(fb); resolve(); };
    var fb = window.setTimeout(finish, 920);
    function onEnd(ev) { if (!ev || ev.target !== inner) return; finish(); }
    inner.addEventListener("animationend", onEnd);
  });

  var mfAtk = els.adventureIntroFoeRiseInner && els.adventureIntroFoeRiseInner.querySelector(".pet-art-raster--multi-frame");
  if (mfAtk) mfAtk.classList.add("attacking");
  playAdventureFoeRoarSfx();
  if (els.adventureIntroTrack) els.adventureIntroTrack.classList.add("adventure-intro-track--foe-burst");

  playAdventureBattleBgm();

  var advDone = false;
  await new Promise(function (resolve) {
    var done = function () { if (advDone) return; advDone = true; window.clearTimeout(t); root.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey, true); resolve(); };
    var t = window.setTimeout(done, 12000);
    function onClick() { done(); }
    function onKey(ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); done(); } }
    root.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  });

  showLairCoverShield();
  root.classList.add("adventure-intro-overlay--mist-out");
  await new Promise(function (resolve) {
    var finished = false;
    var finish = function () { if (finished) return; finished = true; root.removeEventListener("animationend", onAnimEnd); window.clearTimeout(fb); resolve(); };
    var fb = window.setTimeout(finish, reduced ? 700 : 1500);
    function onAnimEnd(ev) { if (!ev || ev.target !== root) return; finish(); }
    root.addEventListener("animationend", onAnimEnd);
  });

  if (els.modalBattle) els.modalBattle.classList.add("open");
  closeAdventureIntroOverlay();
  hideLairCoverShield();
}

function showLairCoverShield() {
  var sh = document.getElementById("lair-cover-shield");
  if (!sh) {
    sh = document.createElement("div");
    sh.id = "lair-cover-shield";
    sh.setAttribute("aria-hidden", "true");
    sh.style.cssText = "position:fixed;inset:0;z-index:198;background:radial-gradient(ellipse at 50% 25%, rgba(10,14,28,1), rgba(4,6,12,1));pointer-events:none;display:none;";
    document.body.appendChild(sh);
  }
  sh.style.display = "block";
}

function hideLairCoverShield() {
  var sh = document.getElementById("lair-cover-shield");
  if (sh) sh.style.display = "none";
}

function snapToStats(snap) {
  return {
    name: snap.displayName || snap.name || "Player",
    lineId: snap.lineId || null,
    nodeKey: snap.nodeKey || "base",
    attackStyle: snap.attackStyle || snap.lineId || "guardian",
    maxHp: snap.maxHp || 30,
    atk: snap.atk || 5,
    speed: snap.speed || 30,
    combatBp: snap.combatBp || 10,
    stage: snap.stage || 1,
    specialMove: snap.specialMove || "attack",
    avatarEmoji: snap.avatarEmoji || "\uD83D\uDC09",
  };
}

export async function runPvpBattle(matchData, matchId, isChallenger) {
  if (battleActive || !state.lineId) return;
  if (careBlocksAdventure()) {
    pushLog("Your myth is busy eating or playing — finish that before battling.");
    return;
  }
  cancelPetSleepSilent();
  setBattleActive(true);
  updateSpiritBerryUi();
  stopDemandAttentionLoop();
  clearDemandWindowTimers();
  stopLairAmbient();
  stopPetIdle();
  document.body.classList.add("battle-active");

  var uid = currentUid();
  var challengerUid = matchData.challengedBy;
  var snapshots = matchData.snapshots || {};
  var playerKeys = Object.keys(snapshots);
  var acceptorUid = null;
  for (var i = 0; i < playerKeys.length; i++) {
    if (playerKeys[i] !== challengerUid) { acceptorUid = playerKeys[i]; break; }
  }

  var challengerSnap = snapshots[challengerUid] || {};
  var acceptorSnap = snapshots[acceptorUid] || {};
  var simPlayer = snapToStats(challengerSnap);
  var simEnemy = snapToStats(acceptorSnap);

  var battleSeed = matchData.battleSeed;
  var regionRng = battleSeed != null ? createSeededRandom(battleSeed ^ 0x12345) : null;
  var region = REGIONS[Math.floor((regionRng ? regionRng() : Math.random()) * REGIONS.length)];

  var pLabel = challengerSnap.displayName || simPlayer.name;
  var eLabel = acceptorSnap.displayName || simEnemy.name;
  var pAvatar = challengerSnap.avatarEmoji || "\uD83D\uDC09";
  var eAvatar = acceptorSnap.avatarEmoji || "\uD83D\uDC09";

  var mySnap = isChallenger ? challengerSnap : acceptorSnap;
  var opSnap = isChallenger ? acceptorSnap : challengerSnap;
  await runPvpIntro(mySnap, opSnap, region);

  els.modalBattle.className = "battle-overlay arena-" + region;
  els.battleFeed.textContent = "PvP — " + pLabel + " vs " + eLabel + "\n";
  els.battleResult.classList.remove("visible", "win", "lose");
  if (els.battlePostSummary) {
    els.battlePostSummary.classList.remove("visible");
    els.battlePostSummary.setAttribute("aria-hidden", "true");
  }
  clearBattleComicCallout();
  resetBattleSpiritFoxPose();
  if (els.modalBattle) {
    els.modalBattle.classList.remove("battle-overlay--special-sequence");
    els.modalBattle.querySelectorAll(".battle-hit-flash-mega, .battle-spec-mega").forEach(function (n) { n.remove(); });
  }
  if (els.battleFxLayer) els.battleFxLayer.innerHTML = "";
  if (els.battlePlayerWrap) {
    clearBindingHexShock(els.battlePlayerWrap);
    els.battlePlayerWrap.classList.remove("battle-actor-shield", "battle-actor--special-windup", "binding-hex-shock");
  }
  if (els.battleEnemyWrap) {
    clearBindingHexShock(els.battleEnemyWrap);
    els.battleEnemyWrap.classList.remove("battle-actor-shield", "battle-actor--special-windup", "binding-hex-shock");
  }

  els.modalBattle.classList.add("open");
  setBattleHudName(els.battlePlayerName, pLabel, simPlayer.lineId, simPlayer.nodeKey, pAvatar);
  setBattleHudName(els.battleEnemyName, eLabel, simEnemy.lineId, simEnemy.nodeKey, eAvatar);
  if (simPlayer.lineId && LINES[simPlayer.lineId]) {
    els.battlePlayerArt.innerHTML = petArtHtml(simPlayer.lineId, simPlayer.nodeKey || "base");
  } else {
    els.battlePlayerArt.innerHTML = '<span style="font-size:2.5rem">' + pAvatar + '</span>';
  }
  if (simEnemy.lineId && LINES[simEnemy.lineId]) {
    els.battleEnemyArt.innerHTML = petArtHtml(simEnemy.lineId, simEnemy.nodeKey || "base");
  } else {
    els.battleEnemyArt.innerHTML = '<span style="font-size:2.5rem">' + eAvatar + '</span>';
  }
  els.battlePlayerHp.style.width = "100%";
  els.battleEnemyHp.style.width = "100%";

  var result = await simulateBattleCombat(simPlayer, simEnemy, region, battleSeed, isChallenger);

  var challengerWon = result && result.win;
  var iWon = isChallenger ? challengerWon : !challengerWon;

  if (matchId && uid) {
    if (isChallenger) {
      var winnerId = challengerWon ? uid : (acceptorUid || null);
      try {
        await submitPvpResult(matchId, winnerId, null);
      } catch (e) {
        console.warn("[PvP] Failed to submit result:", e);
      }
    } else {
      try {
        var mt = matchData.matchType || "friend";
        await waitAndApplyAcceptorElo(matchId);
        await recordPvpOutcome(iWon, mt);
        var xpRewards = await awardXp(iWon ? 40 : 10);
        if (xpRewards) showLevelUpIfNeeded(xpRewards);
        await writeWeeklyLeaderboardEntry(getLocalProfile());
      } catch (e) {}
    }
  }
}

export function setupAdventureControl() {
  if (!els.btnAdventure) return;
  els.btnAdventure.addEventListener("click", startAdventure);
}

export function startAdventure(regionOverride) {
  if (battleActive) return;
  if (careBlocksAdventure()) {
    pushLog("Your myth is busy eating or playing — wait until they are done.");
    return;
  }
  const slot = state.activeMythTab || 0;
  const mythSelf = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  if (!mythSelf.lineId) return;
  if (mythSelf.energy < 12) {
    pushLog("Too tired for adventure. Rest first.");
    flashTiredRefusal();
    return;
  }
  if (mythSelf.hunger <= 20) {
    applyForcedActionWhileHungry("hungry for adventure", mythSelf);
  }
  const region = (regionOverride && REGIONS.indexOf(regionOverride) >= 0)
    ? regionOverride
    : REGIONS[Math.floor(Math.random() * REGIONS.length)];
  closeLairSubpanels();
  mythSelf.energy = clamp(mythSelf.energy - 12, 0, 100);
  renderPet();
  resumeBattleAudioIfNeeded();
  runBattleSession(region, { adventure: true, mythSlot: slot }).catch(function () {
    stopAdventureBattleBgm();
    setBattleActive(false);
    document.body.classList.remove("battle-active");
    closeAdventureIntroOverlay();
    if (els.modalBattle) els.modalBattle.classList.remove("open");
    restartPetIdle();
    if (state.demand) startDemandResponseTimer();
  });
}
