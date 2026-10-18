import { getDb, currentUid } from './firebase-config.js';
import { state, treeUnlockedByLine } from './state.js';
import { awardXp, getLocalProfile } from './player-profile.js';

let _achievementState = {};
let _onAchievementUnlocked = null;
let _achievementsDirty = false;

export function setOnAchievementUnlocked(cb) { _onAchievementUnlocked = cb; }
export function getAchievementState() { return _achievementState; }

/* tier multiplier for repeatable achievements */
function tierXp(base, tier) { return Math.round(base * (1 + (tier - 1) * 0.5)); }

function t(id, name, desc, category, goal, xp, icon) {
  return { id: id, name: name, desc: desc, cat: category, goal: goal, xp: xp, icon: icon || "\uD83C\uDFC6" };
}

function tiered(prefix, name, desc, cat, goals, baseXp, icon) {
  var out = [];
  for (var i = 0; i < goals.length; i++) {
    var tier = i + 1;
    var suffix = goals.length > 1 ? " " + romanNum(tier) : "";
    out.push(t(prefix + "_t" + tier, name + suffix, desc.replace("{n}", String(goals[i])), cat, goals[i], tierXp(baseXp, tier), icon));
  }
  return out;
}

function romanNum(n) {
  var r = ["I","II","III","IV","V","VI"];
  return r[n - 1] || String(n);
}

/* ═══════════════════════════════════════════════════════
   ACHIEVEMENT DEFINITIONS — see ACHIEVEMENT_COUNT (368 incl. lvl_45 / lvl_50)
   ═══════════════════════════════════════════════════════ */

var ALL = [];

/* ── BATTLE (45) ── */
ALL.push.apply(ALL, tiered("bat_win", "Victorious", "Win {n} battles.", "battle", [1,10,50,100,250,500], 15, "\u2694\uFE0F"));
ALL.push.apply(ALL, tiered("bat_lose", "Learning Curve", "Lose {n} battles.", "battle", [1,10,50,100,250], 10, "\uD83D\uDCA2"));
ALL.push.apply(ALL, tiered("bat_total", "Battle Veteran", "Fight {n} total battles.", "battle", [5,25,100,250,500], 12, "\uD83D\uDEE1\uFE0F"));
ALL.push.apply(ALL, tiered("bat_streak", "Win Streak", "Win {n} battles in a row.", "battle", [3,5,10,15,20], 20, "\uD83D\uDD25"));
ALL.push.apply(ALL, tiered("bat_greek", "Greek Champion", "Win {n} battles in the Greek region.", "battle", [5,20,50,100,200], 15, "\uD83C\uDFDB\uFE0F"));
ALL.push.apply(ALL, tiered("bat_japan", "Japanese Champion", "Win {n} battles in the Japanese region.", "battle", [5,20,50,100,200], 15, "\u26E9\uFE0F"));
ALL.push.apply(ALL, tiered("bat_sea", "SEA Champion", "Win {n} battles in the SEA region.", "battle", [5,20,50,100,200], 15, "\uD83C\uDF0A"));
ALL.push.apply(ALL, tiered("bat_egypt", "Egyptian Champion", "Win {n} battles in the Egyptian region.", "battle", [5,20,50,100,200], 15, "\u2600\uFE0F"));

/* ── TOURNAMENT (5) ── */
ALL.push.apply(ALL, tiered("tour_win", "Tournament Victor", "Win {n} local tournaments.", "battle", [1,3,5,10,20], 25, "🏆"));

/* ── EVOLUTION (35) ── */
ALL.push.apply(ALL, tiered("evo_total", "Shape Shifter", "Evolve {n} times.", "evolution", [1,3,5,10,20], 25, "\u2728"));
ALL.push.apply(ALL, tiered("evo_tier2", "Uncommon Rise", "Reach Uncommon tier {n} times.", "evolution", [1,3,5,10,15], 20, "\uD83D\uDFE2"));
ALL.push.apply(ALL, tiered("evo_tier3", "Rare Ascent", "Reach Rare tier {n} times.", "evolution", [1,3,5,10,15], 25, "\uD83D\uDD35"));
ALL.push.apply(ALL, tiered("evo_tier4", "Epic Power", "Reach Epic tier {n} times.", "evolution", [1,2,4,8,12], 35, "\uD83D\uDFE3"));
ALL.push.apply(ALL, tiered("evo_tier5", "Legendary Status", "Reach Legendary tier {n} times.", "evolution", [1,2,3,5,8], 50, "\uD83C\uDF1F"));
ALL.push.apply(ALL, tiered("evo_cross", "Cross-Branch Pioneer", "Perform {n} cross-branch evolutions.", "evolution", [1,2,3,5,8], 40, "\uD83D\uDD00"));
ALL.push.apply(ALL, tiered("evo_crossline", "Lineage Transcender", "Perform {n} cross-lineage evolutions.", "evolution", [1,2,3,4,5], 50, "\uD83C\uDF00"));

/* ── CARE (50) ── */
ALL.push.apply(ALL, tiered("care_feed", "Good Provider", "Feed your myth {n} times.", "care", [1,10,50,100,250], 10, "\uD83C\uDF56"));
ALL.push.apply(ALL, tiered("care_fav_food", "Gourmet Chef", "Feed {n} favorite foods.", "care", [1,5,20,50,100], 15, "\u2764\uFE0F"));
ALL.push.apply(ALL, tiered("care_pet", "Gentle Touch", "Pet your myth {n} times.", "care", [1,10,50,100,300], 8, "\uD83E\uDD70"));
ALL.push.apply(ALL, tiered("care_sleep", "Dream Keeper", "Put your myth to sleep {n} times.", "care", [1,5,20,50,100], 10, "\uD83D\uDE34"));
ALL.push.apply(ALL, tiered("care_play", "Playful Spirit", "Play ball {n} times.", "care", [1,5,15,30,50], 12, "\u26BD"));
ALL.push.apply(ALL, tiered("care_demand_indulge", "Soft Heart", "Indulge {n} demands.", "care", [1,5,20,50,100], 10, "\uD83D\uDC96"));
ALL.push.apply(ALL, tiered("care_demand_discipline", "Strict Keeper", "Discipline {n} demands.", "care", [1,5,20,50,100], 10, "\uD83D\uDCAA"));
ALL.push.apply(ALL, tiered("care_berry", "Berry Farmer", "Pick {n} spirit berries.", "care", [1,5,15,30,50], 12, "\uD83E\uDED0"));
ALL.push.apply(ALL, tiered("care_happy100", "Pure Bliss", "Reach 100 happiness {n} times.", "care", [1,5,15,30,50], 15, "\uD83D\uDE0A"));
ALL.push.apply(ALL, tiered("care_discipline100", "Iron Will", "Reach 100 discipline {n} times.", "care", [1,3,8,15,25], 18, "\uD83E\uDDBE"));

ALL.push.apply(ALL, tiered("daily_streak", "Daily Devotion", "Reach a {n}-day daily streak.", "care", [3,7,14,21,30], 15, "📅"));

/* ── COLLECTION (40) ── */
ALL.push.apply(ALL, tiered("col_food_types", "Pantry Collector", "Collect {n} different food types.", "collection", [2,4,6,8,10], 15, "\uD83C\uDF7D\uFE0F"));
ALL.push.apply(ALL, tiered("col_relic_types", "Relic Hunter", "Collect {n} different relic types.", "collection", [1,2,3,4,5], 20, "\uD83C\uDFFA"));
ALL.push.apply(ALL, tiered("col_food_stock", "Hoarder", "Have {n} food items in pantry at once.", "collection", [5,15,30,50,100], 12, "\uD83D\uDCE6"));
ALL.push.apply(ALL, tiered("col_relic_stock", "Relic Vault", "Have {n} relics in inventory at once.", "collection", [3,8,15,25,40], 15, "\uD83D\uDD12"));
ALL.push.apply(ALL, tiered("col_balls", "Ball Collector", "Have {n} play balls at once.", "collection", [3,5,10,20,30], 10, "\u26BD"));
ALL.push.apply(ALL, tiered("col_forms_unlocked", "Form Discoverer", "Unlock {n} myth forms.", "collection", [2,5,10,15,20], 20, "\uD83D\uDCD6"));
ALL.push.apply(ALL, tiered("col_lineages_played", "Multi Lineage", "Play {n} different lineages.", "collection", [2,3,4], 30, "\uD83C\uDF10"));
ALL.push.apply(ALL, tiered("col_influence_total", "Regional Power", "Accumulate {n} total influence.", "collection", [20,100,250,500,1000], 15, "\uD83C\uDF0D"));

/* ── REINCARNATION (30) ── */
ALL.push.apply(ALL, tiered("reinc_total", "Cycle of Life", "Reincarnate {n} times.", "reincarnation", [1,3,5,10,20,30], 25, "\uD83D\uDD04"));
ALL.push.apply(ALL, tiered("reinc_bonus_hp", "Echo of Vitality", "Accumulate {n} reincarnation HP bonus.", "reincarnation", [1,3,5,10,15], 20, "\u2764\uFE0F"));
ALL.push.apply(ALL, tiered("reinc_bonus_atk", "Echo of Fury", "Accumulate {n} reincarnation Atk bonus.", "reincarnation", [1,3,5,10,15], 20, "\u2694\uFE0F"));
ALL.push.apply(ALL, tiered("reinc_bonus_spd", "Echo of Wind", "Accumulate {n} reincarnation Spd bonus.", "reincarnation", [1,3,5,10,15], 20, "\uD83D\uDCA8"));
ALL.push.apply(ALL, tiered("reinc_score", "Life Score", "Achieve a legacy score of {n}.", "reincarnation", [10,25,40,55,65], 30, "\uD83C\uDFC5"));
ALL.push.apply(ALL, tiered("reinc_medals", "Medal Collector", "Earn {n} total legacy medals.", "reincarnation", [1,3,6,10,15], 15, "\uD83E\uDD47"));

/* ── PVP (35) ── */
ALL.push.apply(ALL, tiered("pvp_win", "Arena Victor", "Win {n} PvP battles.", "pvp", [1,5,15,30,50,100], 20, "\uD83C\uDFC6"));
ALL.push.apply(ALL, tiered("pvp_lose", "Graceful Loser", "Lose {n} PvP battles.", "pvp", [1,5,15,30,50], 10, "\uD83E\uDD1D"));
ALL.push.apply(ALL, tiered("pvp_total", "PvP Enthusiast", "Fight {n} total PvP battles.", "pvp", [1,5,20,50,100], 12, "\uD83C\uDFDF\uFE0F"));
ALL.push.apply(ALL, tiered("pvp_streak", "PvP Dominator", "Win {n} PvP battles in a row.", "pvp", [2,3,5,8,10], 25, "\uD83D\uDD25"));
ALL.push.apply(ALL, tiered("pvp_challenge_sent", "Challenger", "Send {n} PvP challenges.", "pvp", [1,5,10,20,30], 10, "\uD83D\uDCE8"));
ALL.push.apply(ALL, tiered("pvp_challenge_accepted", "Brave Heart", "Accept {n} PvP challenges.", "pvp", [1,5,10,20,30], 10, "\uD83D\uDC4A"));
ALL.push.apply(ALL, tiered("pvp_random", "Wildcard", "Complete {n} random PvP matches.", "pvp", [1,3,5,10,15], 15, "\uD83C\uDFB2"));

/* ── SOCIAL (20) ── */
ALL.push.apply(ALL, tiered("soc_friends", "Social Butterfly", "Add {n} friends.", "social", [1,3,5,10,20], 15, "\uD83D\uDC65"));
ALL.push.apply(ALL, tiered("soc_status", "Status Update", "Change your status {n} times.", "social", [1,5,10,20], 8, "\uD83D\uDCAC"));
ALL.push.apply(ALL, tiered("soc_avatar", "Fashion Icon", "Change your avatar {n} times.", "social", [1,3,5,10], 8, "\uD83D\uDDBC\uFE0F"));
ALL.push.apply(ALL, tiered("soc_profile_bio", "Storyteller", "Update your bio {n} times.", "social", [1,3,5,10], 8, "\uD83D\uDCDD"));
ALL.push.apply(ALL, tiered("soc_code_shared", "Code Sharer", "Copy your friend code {n} times.", "social", [1,3,5], 5, "\uD83D\uDCCB"));

/* ── ONLINE / NETWORK (33) — friends, UI, PvP interactions ── */
ALL.push.apply(ALL, tiered("onl_fr_out", "Requester", "Send {n} friend requests.", "social", [3,10,25], 12, "\uD83D\uDCE9"));
ALL.push.apply(ALL, tiered("onl_fr_in", "Welcoming Hand", "Accept {n} incoming friend requests.", "social", [3,10,25], 12, "\uD83E\uDD1D"));
ALL.push.apply(ALL, tiered("onl_pvp_friend", "Duelist", "Complete {n} friend PvP matches.", "pvp", [3,15,40], 18, "\u2694\uFE0F"));
ALL.push.apply(ALL, tiered("onl_pvp_rand", "Queue Warrior", "Complete {n} random PvP matches.", "pvp", [3,15,40], 18, "\uD83C\uDFB2"));
ALL.push.apply(ALL, tiered("onl_bat_send", "Battle Herald", "Send {n} battle challenges to friends.", "pvp", [5,15,35], 12, "\uD83D\uDCE8"));
ALL.push.apply(ALL, tiered("onl_bat_accept", "Gladiator", "Accept {n} battle challenges.", "pvp", [3,12,30], 12, "\uD83D\uDC4A"));
ALL.push.apply(ALL, tiered("onl_bat_decline", "Busy Keeper", "Decline {n} battle challenges.", "pvp", [1,8,25], 8, "\uD83D\uDEAB"));
ALL.push.apply(ALL, tiered("onl_ui_friends", "Social Hub", "Open the Friends panel {n} times.", "social", [5,25,50], 6, "\uD83D\uDC65"));
ALL.push.apply(ALL, tiered("onl_ui_pvp", "Arena Regular", "Open the PvP panel {n} times.", "pvp", [5,25,50], 6, "\uD83C\uDFDF\uFE0F"));
ALL.push.apply(ALL, tiered("onl_ui_profile", "In the Spotlight", "Open your profile {n} times.", "social", [10,30,60], 6, "\uD83D\uDCCD"));
ALL.push.apply(ALL, tiered("onl_code_find", "Seeker", "Find a player by friend code {n} times.", "social", [1,5,15], 10, "\uD83D\uDD0D"));

/* ── EXPLORATION (40) ── */
ALL.push.apply(ALL, tiered("exp_greek_inf", "Greek Scholar", "Reach {n} Greek influence.", "exploration", [10,50,100,200,400,600], 15, "\uD83C\uDFDB\uFE0F"));
ALL.push.apply(ALL, tiered("exp_japan_inf", "Japanese Scholar", "Reach {n} Japanese influence.", "exploration", [10,50,100,200,400,600], 15, "\u26E9\uFE0F"));
ALL.push.apply(ALL, tiered("exp_sea_inf", "SEA Scholar", "Reach {n} SEA influence.", "exploration", [10,50,100,200,400,600], 15, "\uD83C\uDF0A"));
ALL.push.apply(ALL, tiered("exp_egypt_inf", "Egyptian Scholar", "Reach {n} Egyptian influence.", "exploration", [10,50,100,200,400,600], 15, "\u2600\uFE0F"));
ALL.push.apply(ALL, tiered("exp_all_regions", "World Traveler", "Have all regions at {n}+ influence.", "exploration", [5,20,50,100,200], 25, "\uD83C\uDF0D"));
ALL.push.apply(ALL, tiered("exp_adventures", "Adventurer", "Go on {n} adventures.", "exploration", [5,25,100,250,500], 12, "\uD83E\uDDED"));
ALL.push.apply(ALL, tiered("exp_relic_use", "Relic Sage", "Use {n} relics for influence.", "exploration", [1,5,15,30,50], 15, "\uD83D\uDD2E"));
ALL.push.apply(ALL, tiered("exp_bp", "Power Level", "Reach {n} Combat BP.", "exploration", [10,25,50,80,120], 20, "\uD83D\uDCAB"));

ALL.push.apply(ALL, tiered("market_buy", "Market Regular", "Buy {n} items from the Port Market.", "exploration", [5,20,50,100,200], 12, "🛒"));
ALL.push.apply(ALL, tiered("wisdom_nodes", "Sage Growth", "Unlock {n} Tamer upgrades.", "exploration", [1,3,5,10], 15, "🧠"));
ALL.push.apply(ALL, tiered("exp_districts", "District Patron", "Visit Mythala City districts {n} times.", "exploration", [5,15,30,60,100], 10, "🏙️"));

/* ── PLAYER LEVEL (10) ── */
ALL.push(t("lvl_5", "Level 5", "Reach player level 5.", "level", 5, 30, "\u2B50"));
ALL.push(t("lvl_10", "Level 10", "Reach player level 10.", "level", 10, 50, "\u2B50"));
ALL.push(t("lvl_15", "Level 15", "Reach player level 15.", "level", 15, 75, "\u2B50"));
ALL.push(t("lvl_20", "Level 20", "Reach player level 20.", "level", 20, 100, "\u2B50"));
ALL.push(t("lvl_25", "Level 25", "Reach player level 25.", "level", 25, 125, "\u2B50"));
ALL.push(t("lvl_30", "Level 30", "Reach player level 30.", "level", 30, 150, "\u2B50"));
ALL.push(t("lvl_35", "Level 35", "Reach player level 35.", "level", 35, 175, "\u2B50"));
ALL.push(t("lvl_40", "Level 40", "Reach player level 40.", "level", 40, 200, "\u2B50"));
ALL.push(t("lvl_45", "Level 45", "Reach player level 45.", "level", 45, 220, "\u2B50"));
ALL.push(t("lvl_50", "Level 50", "Reach player level 50.", "level", 50, 250, "\u2B50"));

/* ── SPECIAL / SECRET (30) ── */
ALL.push(t("sec_first_myth", "First Steps", "Start your first myth.", "special", 1, 10, "\uD83C\uDF31"));
ALL.push(t("sec_first_battle", "Into the Arena", "Fight your first battle.", "special", 1, 10, "\u2694\uFE0F"));
ALL.push(t("sec_first_evolve", "Metamorphosis", "Evolve for the first time.", "special", 1, 15, "\u2728"));
ALL.push(t("sec_first_death", "The End?", "Your myth dies for the first time.", "special", 1, 15, "\uD83D\uDC80"));
ALL.push(t("sec_first_reinc", "New Dawn", "Reincarnate for the first time.", "special", 1, 20, "\uD83C\uDF05"));
ALL.push(t("sec_first_pvp", "Challenger Approaches", "Fight your first PvP battle.", "special", 1, 15, "\uD83C\uDFDF\uFE0F"));
ALL.push(t("sec_first_friend", "Friendship!", "Add your first friend.", "special", 1, 15, "\uD83E\uDD1D"));
ALL.push(t("sec_first_relic", "Ancient Discovery", "Use your first relic.", "special", 1, 12, "\uD83C\uDFFA"));
ALL.push(t("sec_first_berry", "Berry Picker", "Pick your first spirit berry.", "special", 1, 10, "\uD83E\uDED0"));
ALL.push(t("sec_first_play", "Playtime!", "Play ball for the first time.", "special", 1, 10, "\u26BD"));
ALL.push(t("sec_max_happy", "Pure Joy", "Reach 100 happiness.", "special", 1, 15, "\uD83D\uDE0A"));
ALL.push(t("sec_max_discipline", "Perfect Discipline", "Reach 100 discipline.", "special", 1, 15, "\uD83E\uDDBE"));
ALL.push(t("sec_starving", "Starvation", "Let hunger reach 0.", "special", 1, 5, "\uD83D\uDE35"));
ALL.push(t("sec_exhausted", "Exhausted", "Let energy reach 0.", "special", 1, 5, "\uD83D\uDE2B"));
ALL.push(t("sec_full_belly", "Full Belly", "Reach 100 hunger.", "special", 1, 10, "\uD83E\uDD24"));
ALL.push(t("sec_night_owl", "Night Owl", "Play between midnight and 4 AM.", "special", 1, 10, "\uD83E\uDD89"));
ALL.push(t("sec_early_bird", "Early Bird", "Play between 5 AM and 7 AM.", "special", 1, 10, "\uD83D\uDC26"));
ALL.push(t("sec_all_lineages", "Lineage Master", "Play all 4 lineages.", "special", 1, 40, "\uD83C\uDF10"));
ALL.push(t("sec_triple_kick", "Hat Trick", "Complete a play ball session.", "special", 1, 10, "\u26BD"));
ALL.push(t("sec_forced_sleep", "Stubborn", "Force your myth to sleep.", "special", 1, 8, "\uD83D\uDE24"));
ALL.push(t("sec_angry_myth", "Tantrum", "Make your myth angry.", "special", 1, 8, "\uD83D\uDE20"));
ALL.push(t("sec_curious_myth", "Curiosity", "Trigger your myth's curiosity.", "special", 1, 8, "\u2753"));
ALL.push(t("sec_ten_foods", "Feast", "Feed 10 items in one session.", "special", 10, 15, "\uD83C\uDF7D\uFE0F"));
ALL.push(t("sec_bp50", "Power 50", "Reach 50 Combat BP.", "special", 1, 20, "\uD83D\uDCAA"));
ALL.push(t("sec_bp100", "Power 100", "Reach 100 Combat BP.", "special", 1, 35, "\uD83D\uDCAA"));
ALL.push(t("sec_7day", "Week Warrior", "Play 7 different days.", "special", 7, 25, "\uD83D\uDCC5"));
ALL.push(t("sec_30day", "Month Master", "Play 30 different days.", "special", 30, 50, "\uD83D\uDCC5"));
ALL.push(t("sec_guardian", "Guardian Line", "Play the Guardian lineage.", "special", 1, 10, "\uD83D\uDC15"));
ALL.push(t("sec_avian", "Avian Line", "Play the Avian lineage.", "special", 1, 10, "\uD83E\uDD85"));
ALL.push(t("sec_serpent", "Serpent Line", "Play the Serpent lineage.", "special", 1, 10, "\uD83D\uDC0D"));
ALL.push(t("sec_first_tourney", "First Bracket", "Enter your first local tournament.", "special", 1, 20, "\uD83C\uDFDF\uFE0F"));
ALL.push(t("sec_first_daily", "First Roll Call", "Claim your first daily reward.", "special", 1, 10, "\uD83D\uDCCB"));
ALL.push(t("sec_lore_tree", "Lineage Scholar", "View the evolution tree.", "special", 1, 10, "\uD83C\uDF33"));
ALL.push(t("sec_lore_hall", "Keeper of Echoes", "View the hall of past myths.", "special", 1, 10, "\uD83C\uDFDB\uFE0F"));
ALL.push(t("sec_first_buy", "First Purchase", "Buy an item from the Port Market.", "special", 1, 10, "\uD83D\uDED2"));
ALL.push(t("sec_all_districts", "City Explorer", "Visit all 5 Mythala City districts.", "special", 1, 20, "\uD83D\uDDFA\uFE0F"));
ALL.push(t("sec_first_wisdom", "Keeper's Wisdom", "Unlock your first Tamer upgrade.", "special", 1, 12, "\uD83E\uDDE0"));

export var ACHIEVEMENTS = ALL;
export var ACHIEVEMENT_COUNT = ALL.length;

export var ACHIEVEMENT_CATEGORIES = [
  { id: "battle", name: "Battle", icon: "\u2694\uFE0F" },
  { id: "evolution", name: "Evolution", icon: "\u2728" },
  { id: "care", name: "Care", icon: "\uD83D\uDC96" },
  { id: "collection", name: "Collection", icon: "\uD83D\uDCE6" },
  { id: "reincarnation", name: "Reincarnation", icon: "\uD83D\uDD04" },
  { id: "pvp", name: "PvP", icon: "\uD83C\uDFC6" },
  { id: "social", name: "Social", icon: "\uD83D\uDC65" },
  { id: "exploration", name: "Exploration", icon: "\uD83C\uDF0D" },
  { id: "level", name: "Level", icon: "\u2B50" },
  { id: "special", name: "Special", icon: "\uD83C\uDF1F" }
];

var _achById = {};
for (var _i = 0; _i < ALL.length; _i++) _achById[ALL[_i].id] = ALL[_i];
export function getAchievementById(id) { return _achById[id] || null; }

export function applyLevelUpAchievements(level) {
  var milestones = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  for (var i = 0; i < milestones.length; i++) {
    var m = milestones[i];
    if (level >= m) {
      setAchievementValue("lvl_" + m, level);
    }
  }
}

export function refreshOnlineTierAchievements(stats) {
  if (!stats) return;
  checkTieredAchievements("onl_fr_out", stats.onl_fr_out || 0);
  checkTieredAchievements("onl_fr_in", stats.onl_fr_in || 0);
  checkTieredAchievements("onl_pvp_friend", stats.onl_pvp_friend || 0);
  checkTieredAchievements("onl_pvp_rand", stats.onl_pvp_rand || 0);
  checkTieredAchievements("onl_bat_send", stats.onl_bat_send || 0);
  checkTieredAchievements("onl_bat_accept", stats.onl_bat_accept || 0);
  checkTieredAchievements("onl_bat_decline", stats.onl_bat_decline || 0);
  checkTieredAchievements("onl_ui_friends", stats.onl_ui_friends || 0);
  checkTieredAchievements("onl_ui_pvp", stats.onl_ui_pvp || 0);
  checkTieredAchievements("onl_ui_profile", stats.onl_ui_profile || 0);
  checkTieredAchievements("onl_code_find", stats.onl_code_find || 0);
}

export function refreshPvpAchievementTiers(stats) {
  if (!stats) return;
  var wins = stats.pvpWins || 0;
  var losses = stats.pvpLosses || 0;
  var total = wins + losses;
  checkTieredAchievements("pvp_win", wins);
  checkTieredAchievements("pvp_lose", losses);
  checkTieredAchievements("pvp_total", total);
  checkTieredAchievements("pvp_streak", stats.pvpWinStreak || 0);
  checkTieredAchievements("pvp_challenge_sent", stats.pvpChallengesSent || 0);
  checkTieredAchievements("pvp_challenge_accepted", stats.pvpChallengesAccepted || 0);
  checkTieredAchievements("pvp_random", stats.pvpRandomCompleted || 0);
}

export function afterPvpOutcomeRecorded(stats, totalMatches) {
  refreshPvpAchievementTiers(stats);
  refreshOnlineTierAchievements(stats);
  if (totalMatches >= 1) {
    checkAchievement("sec_first_pvp", 1);
  }
}

export function afterProfileStatIncrement(key, stats) {
  if (!stats) return;
  if (
    key === "onl_fr_out" || key === "onl_fr_in" || key === "onl_bat_send" ||
    key === "onl_bat_accept" || key === "onl_bat_decline" || key === "onl_ui_friends" ||
    key === "onl_ui_pvp" || key === "onl_ui_profile" || key === "onl_code_find" ||
    key === "onl_pvp_friend" || key === "onl_pvp_rand"
  ) {
    refreshOnlineTierAchievements(stats);
  }
  if (key === "pvpWins" || key === "pvpLosses" || key === "pvpWinStreak" || key === "pvpChallengesSent" ||
      key === "pvpChallengesAccepted" || key === "pvpRandomCompleted") {
    refreshPvpAchievementTiers(stats);
  }
}

/* ═══════════════════════════════════════════════════════
   PERSISTENCE
   ═══════════════════════════════════════════════════════ */

export async function loadAchievements() {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) {
    var raw = localStorage.getItem("myMythAchievements");
    if (raw) try { _achievementState = JSON.parse(raw); } catch (e) {}
    return;
  }
  try {
    var doc = await db.collection("achievements").doc(uid).get();
    if (doc.exists) _achievementState = doc.data().progress || {};
    else _achievementState = {};
  } catch (e) {
    var raw2 = localStorage.getItem("myMythAchievements");
    if (raw2) try { _achievementState = JSON.parse(raw2); } catch (e2) {}
  }
}

async function saveAchievements() {
  try { localStorage.setItem("myMythAchievements", JSON.stringify(_achievementState)); } catch (e) {}
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return;
  try {
    await db.collection("achievements").doc(uid).set({ progress: _achievementState, updatedAt: Date.now() });
  } catch (e) {}
}

function debouncedSaveAchievements() {
  _achievementsDirty = true;
  setTimeout(function () {
    if (_achievementsDirty) { _achievementsDirty = false; saveAchievements(); }
  }, 3000);
}

/* ═══════════════════════════════════════════════════════
   TRACKING
   ═══════════════════════════════════════════════════════ */

export function checkAchievement(id, currentValue) {
  var def = _achById[id];
  if (!def) return;
  var prev = _achievementState[id] || 0;
  if (prev >= def.goal) return;
  var val = typeof currentValue === "number" ? currentValue : (prev + 1);
  _achievementState[id] = val;
  if (val >= def.goal && prev < def.goal) {
    _achievementState[id] = def.goal;
    debouncedSaveAchievements();
    try { awardXp(def.xp); } catch (e) {}
    if (_onAchievementUnlocked) _onAchievementUnlocked(def);
  } else {
    debouncedSaveAchievements();
  }
}

export function incrementAchievement(id, amount) {
  var def = _achById[id];
  if (!def) return;
  var prev = _achievementState[id] || 0;
  if (prev >= def.goal) return;
  var val = prev + (amount || 1);
  _achievementState[id] = Math.min(val, def.goal);
  if (val >= def.goal && prev < def.goal) {
    debouncedSaveAchievements();
    try { awardXp(def.xp); } catch (e) {}
    if (_onAchievementUnlocked) _onAchievementUnlocked(def);
  } else {
    debouncedSaveAchievements();
  }
}

export function setAchievementValue(id, value) {
  var def = _achById[id];
  if (!def) return;
  var prev = _achievementState[id] || 0;
  if (prev >= def.goal) return;
  if (value <= prev) return;
  _achievementState[id] = Math.min(value, def.goal);
  if (value >= def.goal && prev < def.goal) {
    debouncedSaveAchievements();
    try { awardXp(def.xp); } catch (e) {}
    if (_onAchievementUnlocked) _onAchievementUnlocked(def);
  } else {
    debouncedSaveAchievements();
  }
}

export function checkTieredAchievements(prefix, value) {
  for (var tier = 1; tier <= 6; tier++) {
    var id = prefix + "_t" + tier;
    var def = _achById[id];
    if (!def) break;
    setAchievementValue(id, value);
  }
}

export function isAchievementComplete(id) {
  var def = _achById[id];
  if (!def) return false;
  return (_achievementState[id] || 0) >= def.goal;
}

export function getCompletedCount() {
  var count = 0;
  for (var i = 0; i < ALL.length; i++) {
    if ((_achievementState[ALL[i].id] || 0) >= ALL[i].goal) count++;
  }
  return count;
}

export function getCompletedCountByCategory(cat) {
  var count = 0;
  var total = 0;
  for (var i = 0; i < ALL.length; i++) {
    if (ALL[i].cat !== cat) continue;
    total++;
    if ((_achievementState[ALL[i].id] || 0) >= ALL[i].goal) count++;
  }
  return { done: count, total: total };
}
