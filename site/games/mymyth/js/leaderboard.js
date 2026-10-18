import { getDb, currentUid } from './firebase-config.js';
import {
  DEFAULT_ELO,
  getCurrentWeekId,
  getWeekStartMondayLocal,
  formatWeekRangeLabel
} from './elo.js';
import { updateProfile, getLocalProfile } from './player-profile.js';

export { effectiveWeeklyElo } from './elo.js';

export async function fetchUserProfileForElo(uid) {
  var db = getDb();
  if (!db || !uid) return null;
  try {
    var doc = await db.collection("users").doc(uid).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

/**
 * Acceptor syncs weekly Elo from match payload (challenger-authoritative).
 * Call after local battle sim ends; may poll until challenger submits the resolved match.
 */
export async function waitAndApplyAcceptorElo(matchId) {
  var db = getDb();
  var uid = currentUid();
  if (!db || !uid || !matchId) return;
  try {
    for (var attempt = 0; attempt < 48; attempt++) {
      var doc = await db.collection("pvpMatches").doc(matchId).get();
      if (doc.exists) {
        var data = doc.data();
        if (data.status === "resolved" && data.elo && data.elo.players && data.elo.players[uid]) {
          var p = data.elo.players[uid];
          var wid = data.elo.weekId || getCurrentWeekId();
          var lp = getLocalProfile();
          if (!lp) return;
          lp.pvpEloWeekly = typeof p.after === "number" ? p.after : lp.pvpEloWeekly;
          lp.pvpEloWeekId = wid;
          await updateProfile({ pvpEloWeekly: lp.pvpEloWeekly, pvpEloWeekId: wid });
          return;
        }
      }
      await new Promise(function (r) { setTimeout(r, 250); });
    }
    console.warn("[Leaderboard] Elo sync timed out for match " + matchId);
  } catch (e) {
    console.warn("[Leaderboard] Acceptor Elo sync failed:", e);
  }
}

/**
 * Writes public leaderboard row (own uid only — rules-enforced).
 */
export async function writeWeeklyLeaderboardEntry(profile) {
  var db = getDb();
  var uid = currentUid();
  if (!db || !uid || !profile) return;
  var wid = getCurrentWeekId();
  var s = profile.stats || {};
  var row = {
    uid: uid,
    displayName: profile.displayName || "Player",
    avatarEmoji: profile.avatarEmoji || "\uD83D\uDC09",
    elo: typeof profile.pvpEloWeekly === "number" ? profile.pvpEloWeekly : DEFAULT_ELO,
    wins: s.pvpWeekWins || 0,
    losses: s.pvpWeekLosses || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    await db.collection("leaderboardWeekly").doc(wid).set({
      weekId: wid,
      weekStartMs: getWeekStartMondayLocal(),
      label: formatWeekRangeLabel()
    }, { merge: true });
    await db.collection("leaderboardWeekly").doc(wid).collection("entries").doc(uid).set(row, { merge: true });
  } catch (e) {
    console.warn("[Leaderboard] Entry write failed:", e);
  }
}

/**
 * @returns {Promise<Array<{ rank: number, uid: string, displayName: string, avatarEmoji: string, elo: number, wins: number, losses: number }>>}
 */
export async function fetchWeeklyLeaderboard(limit) {
  var db = getDb();
  if (!db) return [];
  var wid = getCurrentWeekId();
  var lim = Math.min(limit || 50, 100);
  try {
    var snap = await db.collection("leaderboardWeekly").doc(wid).collection("entries")
      .orderBy("elo", "desc")
      .limit(lim)
      .get();
    var rows = [];
    var i = 0;
    snap.forEach(function (doc) {
      i++;
      var d = doc.data();
      rows.push({
        rank: i,
        uid: doc.id,
        displayName: d.displayName || "Player",
        avatarEmoji: d.avatarEmoji || "\uD83D\uDC09",
        elo: typeof d.elo === "number" ? d.elo : DEFAULT_ELO,
        wins: d.wins || 0,
        losses: d.losses || 0
      });
    });
    return rows;
  } catch (e) {
    console.warn("[Leaderboard] Fetch failed:", e);
    return [];
  }
}

export async function fetchMyWeeklyRank() {
  var db = getDb();
  var uid = currentUid();
  if (!db || !uid) return null;
  var wid = getCurrentWeekId();
  try {
    var mine = await db.collection("leaderboardWeekly").doc(wid).collection("entries").doc(uid).get();
    if (!mine.exists) return { rank: null, elo: DEFAULT_ELO, inBoard: false };
    var myElo = typeof mine.data().elo === "number" ? mine.data().elo : DEFAULT_ELO;
    var higher = await db.collection("leaderboardWeekly").doc(wid).collection("entries")
      .where("elo", ">", myElo)
      .get();
    var rank = higher.size + 1;
    return { rank: rank, elo: myElo, inBoard: true };
  } catch (e) {
    return null;
  }
}
