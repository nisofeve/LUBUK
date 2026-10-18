/** PvP Elo (weekly ladder). Standard logistic expected score + fixed K. */

export var DEFAULT_ELO = 1500;
export var ELO_K = 32;

export function expectedScore(ra, rb) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/**
 * @returns {{ raNew: number, rbNew: number, deltaA: number, deltaB: number }}
 */
export function computeMatchElo(ra, rb, aWon) {
  var sa = aWon ? 1 : 0;
  var sb = 1 - sa;
  var ea = expectedScore(ra, rb);
  var eb = expectedScore(rb, ra);
  var deltaA = Math.round(ELO_K * (sa - ea));
  var deltaB = Math.round(ELO_K * (sb - eb));
  return {
    raNew: ra + deltaA,
    rbNew: rb + deltaB,
    deltaA: deltaA,
    deltaB: deltaB
  };
}

// --- Weekly season (Monday 00:00 local) — used by profile + ladder

export function getWeekStartMondayLocal() {
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var day = d.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getCurrentWeekId() {
  return String(getWeekStartMondayLocal());
}

export function getNextMondayResetLocal() {
  return getWeekStartMondayLocal() + 7 * 24 * 60 * 60 * 1000;
}

export function formatCountdownTo(ms) {
  var t = Math.max(0, ms - Date.now());
  var s = Math.floor(t / 1000);
  var d = Math.floor(s / 86400);
  var h = Math.floor((s % 86400) / 3600);
  var m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + "d " + h + "h";
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

export function formatWeekRangeLabel() {
  var start = new Date(getWeekStartMondayLocal());
  var end = new Date(getNextMondayResetLocal() - 1);
  var opts = { month: "short", day: "numeric" };
  return start.toLocaleDateString(undefined, opts) + " – " + end.toLocaleDateString(undefined, opts);
}

export function effectiveWeeklyElo(profile) {
  if (!profile) return DEFAULT_ELO;
  var wid = getCurrentWeekId();
  if (profile.pvpEloWeekId !== wid) return DEFAULT_ELO;
  var r = typeof profile.pvpEloWeekly === "number" ? profile.pvpEloWeekly : DEFAULT_ELO;
  return Math.max(100, Math.min(3500, r));
}

/**
 * Mutates profile; returns true if Firestore sync is needed.
 */
export function ensureWeeklyPvpSeasonOnProfile(profile) {
  if (!profile) return false;
  var wid = getCurrentWeekId();
  if (profile.pvpEloWeekId === wid) return false;
  profile.pvpEloWeekly = DEFAULT_ELO;
  profile.pvpEloWeekId = wid;
  if (!profile.stats) profile.stats = {};
  profile.stats.pvpWeekWins = 0;
  profile.stats.pvpWeekLosses = 0;
  return true;
}
