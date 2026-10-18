import { getDb, currentUid } from './firebase-config.js';
import { state } from './state.js';
import { ensureWeeklyPvpSeasonOnProfile } from './elo.js';
import { FOODS, RELIC_ITEMS, ensureFoodInventoryState, ensureRelicInventoryState } from './data.js';

let _localProfile = null;
let _profileListenerUnsub = null;

const MAX_JOURNEY_LEVEL = 50;

const LEVEL_TITLES = {
  5: "Aspiring Keeper",
  10: "Seasoned Keeper",
  15: "Myth Veteran",
  20: "Champion",
  25: "Ascendant Master",
  30: "Legendary Keeper",
  35: "Mythic Sage",
  40: "Eternal Guardian",
  45: "Celestial Warden",
  50: "Transcendent Keeper"
};

const LEVEL_BADGES = {
  5: "Rising Star",
  10: "Seasoned Keeper",
  15: "Myth Veteran",
  20: "Champion",
  25: "Ascendant Master",
  30: "Legend Insignia",
  35: "Sage Crest",
  40: "Eternal Seal",
  45: "Celestial Mark",
  50: "Transcendent Crown"
};

const AVATAR_CHOICES = ["\uD83D\uDC09", "\uD83E\uDD85", "\u2728", "\uD83D\uDD25", "\uD83C\uDF0A", "\u2600\uFE0F", "\u26E9\uFE0F", "\uD83C\uDF38", "\uD83D\uDC0D", "\uD83E\uDDA2", "\uD83E\uDD8A", "\uD83E\uDDB9"];

export function getLocalProfile() { return _localProfile; }

export function generateFriendCode(uid) {
  var hash = 0;
  for (var i = 0; i < uid.length; i++) {
    hash = Math.imul(hash ^ uid.charCodeAt(i), 0x5bd1e995);
  }
  return "MY-" + ((hash >>> 0) % 1000000).toString().padStart(6, "0");
}

export async function createPlayerProfile(uid, email, displayName) {
  var db = getDb();
  if (!db) return;
  var existing = await db.collection("users").doc(uid).get();
  if (existing.exists) return;
  var profile = {
    uid: uid,
    email: email || null,
    displayName: displayName || "Player",
    friendCode: generateFriendCode(uid),
    avatarEmoji: "\uD83D\uDC09",
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    level: 1,
    xp: 0,
    xpToNext: 750,
    stats: {
      totalBattlesWon: 0,
      totalBattlesLost: 0,
      totalEvolutions: 0,
      totalReincarnations: 0,
      highestTier: 1,
      mythsRaised: 0,
      pvpWins: 0,
      pvpLosses: 0,
      pvpWinStreak: 0,
      pvpChallengesSent: 0,
      pvpChallengesAccepted: 0,
      pvpRandomCompleted: 0,
      onl_fr_out: 0,
      onl_fr_in: 0,
      onl_pvp_friend: 0,
      onl_pvp_rand: 0,
      onl_bat_send: 0,
      onl_bat_accept: 0,
      onl_bat_decline: 0,
      onl_ui_friends: 0,
      onl_ui_pvp: 0,
      onl_ui_profile: 0,
      onl_code_find: 0,
      onl_ui_ladder: 0,
      pvpWeekWins: 0,
      pvpWeekLosses: 0
    },
    pvpEloWeekly: 1500,
    pvpEloWeekId: null,
    profile: {
      title: "Novice Keeper",
      bio: "",
      favoriteLineage: null,
      showcaseNodeKey: null,
      badgeSlots: []
    },
    activeMythSnapshot: {
      lineId: null,
      nodeKey: "base",
      combatBp: 0,
      happiness: 50,
      battles: 0
    },
    statusMessage: "",
    isOnline: false,
    lastSeenAt: Date.now(),
    unlockedTitles: ["Novice Keeper"],
    unlockedBadges: []
  };
  try {
    await db.collection("users").doc(uid).set(profile);
    _localProfile = profile;
  } catch (e) {
    console.warn("[Profile] Create failed:", e);
  }
}

export async function loadPlayerProfile(uid) {
  var db = getDb();
  if (!db) return null;
  try {
    var doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      _localProfile = doc.data();
      if (ensureWeeklyPvpSeasonOnProfile(_localProfile)) {
        try {
          await db.collection("users").doc(uid).update({
            lastLoginAt: Date.now(),
            pvpEloWeekly: _localProfile.pvpEloWeekly,
            pvpEloWeekId: _localProfile.pvpEloWeekId,
            stats: _localProfile.stats
          });
        } catch (e) {
          await db.collection("users").doc(uid).update({ lastLoginAt: Date.now() });
        }
      } else {
        await db.collection("users").doc(uid).update({ lastLoginAt: Date.now() });
      }
    } else {
      _localProfile = null;
    }
  } catch (e) {
    console.warn("[Profile] Load failed:", e);
  }
  return _localProfile;
}

export async function updateProfile(fields) {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return;
  try {
    await db.collection("users").doc(uid).update(fields);
    if (_localProfile) Object.assign(_localProfile, fields);
  } catch (e) {
    console.warn("[Profile] Update failed:", e);
  }
}

export async function syncMythSnapshot(combatStats) {
  if (!combatStats) return;
  await updateProfile({
    activeMythSnapshot: {
      lineId: combatStats.lineId || (state && state.lineId) || null,
      nodeKey: (state && state.nodeKey) || "base",
      combatBp: combatStats.combatBp || 0,
      happiness: (state && state.happiness) || 50,
      battles: (state && state.battles) || 0,
      name: combatStats.name || "Myth",
      maxHp: combatStats.maxHp || 10,
      atk: combatStats.atk || 1,
      speed: combatStats.speed || 1,
      stage: combatStats.stage || 1,
      specialMove: combatStats.specialMove || "attack"
    }
  });
}

export function xpForLevel(level) {
  return 500 + level * 250;
}

export function getMaxJourneyLevel() {
  return MAX_JOURNEY_LEVEL;
}

// Describe what rewards a given level grants, without rolling random items.
// UI helper for the Journey tab preview.
export function getLevelRewardDescriptors(level) {
  var list = [];
  list.push({ icon: "⚽", label: "Play Ball" });
  list.push({ icon: "🍖", label: "Random Food" });
  if (level % 3 === 0) list.push({ icon: "🏺", label: "Random Relic" });
  if (LEVEL_TITLES[level]) list.push({ icon: "🏅", label: "Title: " + LEVEL_TITLES[level], special: true });
  if (LEVEL_BADGES[level]) list.push({ icon: "🛡️", label: "Badge: " + LEVEL_BADGES[level], special: true });
  if ([7,14,21,28,35,42,49].indexOf(level) !== -1) list.push({ icon: "🎫", label: "Silver Ticket x1" });
  if ([4,11,17,23,32,38,44].indexOf(level) !== -1) list.push({ icon: "⚡", label: "+20 Stamina" });
  if (level === 10 || level === 30) list.push({ icon: "❤️", label: "+1 HP bonus", special: true });
  if (level === 20 || level === 35) list.push({ icon: "⚔️", label: "+1 Atk bonus", special: true });
  if (level === 40 || level === 50) list.push({ icon: "💨", label: "+1 Spd bonus", special: true });
  if (level === 45) list.push({ icon: "✨", label: "+1 Random stat", special: true });
  return list;
}

export async function awardXp(amount) {
  if (!_localProfile || amount <= 0) return null;
  if (typeof _localProfile.level !== "number") _localProfile.level = 1;
  if (typeof _localProfile.xp !== "number") _localProfile.xp = 0;
  if (typeof _localProfile.xpToNext !== "number" || _localProfile.xpToNext <= 0) _localProfile.xpToNext = xpForLevel(_localProfile.level);
  if (_localProfile.level >= MAX_JOURNEY_LEVEL) {
    return null;
  }
  var oldLevel = _localProfile.level;
  _localProfile.xp += amount;
  var rewards = [];
  while (_localProfile.xp >= _localProfile.xpToNext && _localProfile.level < MAX_JOURNEY_LEVEL) {
    _localProfile.xp -= _localProfile.xpToNext;
    _localProfile.level++;
    _localProfile.xpToNext = xpForLevel(_localProfile.level);
    if (_localProfile.level >= MAX_JOURNEY_LEVEL) {
      _localProfile.level = MAX_JOURNEY_LEVEL;
      _localProfile.xp = 0;
      _localProfile.xpToNext = xpForLevel(MAX_JOURNEY_LEVEL);
    }
    var lvl = _localProfile.level;
    var lvlRewards = [];
    if (!state) continue;

    state.playBalls = (state.playBalls || 0) + 1;
    lvlRewards.push("\u26BD Play Ball x1");

    if (FOODS && FOODS.length > 0) {
      var food = FOODS[Math.floor(Math.random() * FOODS.length)];
      ensureFoodInventoryState();
      state.foodInventory[food.id] = (state.foodInventory[food.id] || 0) + 1;
      lvlRewards.push((food.icon || "\uD83C\uDF56") + " " + food.name);
    }

    if ([7,14,21,28,35,42,49].indexOf(lvl) !== -1) {
      state.silverTickets = Math.min((state.silverTickets || 0) + 1, 7);
      lvlRewards.push("🎫 Silver Ticket x1");
    }
    if ([4,11,17,23,32,38,44].indexOf(lvl) !== -1) {
      var staminaMax = 100 + ((state.tamerUpgrades && state.tamerUpgrades.staminaMax) || 0) * 25;
      var curStamina = state.playerStamina != null ? state.playerStamina : staminaMax;
      state.playerStamina = Math.min(curStamina + 20, staminaMax);
      lvlRewards.push("⚡ +20 Stamina");
    }

    if (lvl % 3 === 0 && RELIC_ITEMS && RELIC_ITEMS.length > 0) {
      var relic = RELIC_ITEMS[Math.floor(Math.random() * RELIC_ITEMS.length)];
      ensureRelicInventoryState();
      state.relicInventory[relic.id] = (state.relicInventory[relic.id] || 0) + 1;
      lvlRewards.push((relic.icon || "\uD83C\uDFFA") + " " + relic.name);
    }

    if (LEVEL_TITLES[lvl]) {
      if (!_localProfile.unlockedTitles) _localProfile.unlockedTitles = [];
      if (_localProfile.unlockedTitles.indexOf(LEVEL_TITLES[lvl]) === -1) {
        _localProfile.unlockedTitles.push(LEVEL_TITLES[lvl]);
      }
      lvlRewards.push("\uD83C\uDFC5 Title: " + LEVEL_TITLES[lvl]);
    }

    if (LEVEL_BADGES[lvl]) {
      if (!_localProfile.unlockedBadges) _localProfile.unlockedBadges = [];
      if (_localProfile.unlockedBadges.indexOf(LEVEL_BADGES[lvl]) === -1) {
        _localProfile.unlockedBadges.push(LEVEL_BADGES[lvl]);
      }
      lvlRewards.push("\uD83D\uDEE1\uFE0F Badge: " + LEVEL_BADGES[lvl]);
    }

    if (lvl === 10 || lvl === 30) {
      state.statBonus = state.statBonus || { hp: 0, atk: 0, spd: 0 };
      state.statBonus.hp += 1;
      lvlRewards.push("+1 HP bonus");
    }
    if (lvl === 20 || lvl === 35) {
      state.statBonus = state.statBonus || { hp: 0, atk: 0, spd: 0 };
      state.statBonus.atk += 1;
      lvlRewards.push("+1 Atk bonus");
    }
    if (lvl === 40 || lvl === 50) {
      state.statBonus = state.statBonus || { hp: 0, atk: 0, spd: 0 };
      state.statBonus.spd += 1;
      lvlRewards.push("+1 Spd bonus");
    }
    if (lvl === 45) {
      state.statBonus = state.statBonus || { hp: 0, atk: 0, spd: 0 };
      var pick45 = ["hp", "atk", "spd"][Math.floor(Math.random() * 3)];
      state.statBonus[pick45] += 1;
      lvlRewards.push("+1 " + pick45.toUpperCase() + " bonus");
    }

    rewards.push({ level: lvl, items: lvlRewards });

    try {
      import("./achievements.js").then(function (ach) {
        if (ach.applyLevelUpAchievements) ach.applyLevelUpAchievements(lvl);
      }).catch(function () {});
    } catch (e) {}
  }

  await updateProfile({
    level: _localProfile.level,
    xp: _localProfile.xp,
    xpToNext: _localProfile.xpToNext,
    unlockedTitles: _localProfile.unlockedTitles || [],
    unlockedBadges: _localProfile.unlockedBadges || []
  });

  if (rewards.length > 0) return rewards;
  return null;
}

export async function incrementStat(key, amount) {
  if (!_localProfile || !_localProfile.stats) return;
  _localProfile.stats[key] = (_localProfile.stats[key] || 0) + (amount || 1);
  var update = {};
  update["stats." + key] = _localProfile.stats[key];
  await updateProfile(update);
  try {
    import("./achievements.js").then(function (ach) {
      if (ach.afterProfileStatIncrement) ach.afterProfileStatIncrement(key, _localProfile.stats);
    }).catch(function () {});
  } catch (e) {}
}

/**
 * Single entry point for PvP match end: updates wins/losses, streak, first-PvP secret, and PvP achievement tiers.
 * matchType: "friend" | "random" | other
 */
export async function recordPvpOutcome(won, matchType) {
  if (!_localProfile || !_localProfile.stats) return;
  ensureWeeklyPvpSeasonOnProfile(_localProfile);
  var s = _localProfile.stats;
  if (won) {
    s.pvpWins = (s.pvpWins || 0) + 1;
    s.pvpWinStreak = (s.pvpWinStreak || 0) + 1;
    s.pvpWeekWins = (s.pvpWeekWins || 0) + 1;
  } else {
    s.pvpLosses = (s.pvpLosses || 0) + 1;
    s.pvpWinStreak = 0;
    s.pvpWeekLosses = (s.pvpWeekLosses || 0) + 1;
  }
  var total = (s.pvpWins || 0) + (s.pvpLosses || 0);
  if (matchType === "friend") {
    s.onl_pvp_friend = (s.onl_pvp_friend || 0) + 1;
  } else if (matchType === "random") {
    s.onl_pvp_rand = (s.onl_pvp_rand || 0) + 1;
    s.pvpRandomCompleted = (s.pvpRandomCompleted || 0) + 1;
  }
  await updateProfile({ stats: s });
  try {
    import("./achievements.js").then(function (ach) {
      if (ach.afterPvpOutcomeRecorded) ach.afterPvpOutcomeRecorded(s, total);
    }).catch(function () {});
  } catch (e) {}
}

export function getAvatarChoices() { return AVATAR_CHOICES; }
