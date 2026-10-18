import { getDb, currentUid } from './firebase-config.js';
import { getLocalProfile, awardXp, recordPvpOutcome, incrementStat, updateProfile } from './player-profile.js';
import { computeMatchElo, getCurrentWeekId, ensureWeeklyPvpSeasonOnProfile, effectiveWeeklyElo } from './elo.js';
import { fetchUserProfileForElo, writeWeeklyLeaderboardEntry } from './leaderboard.js';
import { getAcceptedFriends } from './friends.js';
import { state } from './state.js';
import { LINES, nodeByKey } from './data.js';

function buildLiveBattleSnapshot(profile) {
  if (!state.lineId) return profile.activeMythSnapshot || {};
  var L = LINES[state.lineId];
  if (!L) return profile.activeMythSnapshot || {};
  var node = nodeByKey(L, state.nodeKey);
  if (!node) return profile.activeMythSnapshot || {};
  var bpStage = 24 + node.stage * 20 + node.stage * node.stage * 2;
  var tierMul = Math.pow(1.25, node.stage);
  var baseHp = Math.round((40 + bpStage * 0.88) * tierMul);
  var baseAtk = Math.round((9 + bpStage * 0.24) * 0.8 * tierMul);
  var baseSpd = Math.round((42 + bpStage * 0.68) * tierMul);
  var b = state.statBonus || { hp: 0, atk: 0, spd: 0 };
  var rb = state.reincarnationBonus || { hp: 0, atk: 0, spd: 0 };
  var happyMul = state.happiness >= 100 ? 1.02 : 1;
  var maxHp = Math.round((baseHp + b.hp + rb.hp) * happyMul);
  var atk = Math.round((baseAtk + b.atk + rb.atk) * happyMul);
  var speed = Math.round((baseSpd + b.spd + rb.spd) * happyMul);
  var combatBp = Math.floor(maxHp * 0.11 + atk * 2 + speed * 0.14);
  return {
    displayName: profile.displayName || "Player",
    avatarEmoji: profile.avatarEmoji || "\uD83D\uDC09",
    lineId: state.lineId,
    nodeKey: state.nodeKey,
    name: node.name,
    maxHp: maxHp,
    atk: atk,
    speed: speed,
    combatBp: combatBp,
    stage: node.stage,
    specialMove: node.specialMove || "attack",
    attackStyle: state.lineId
  };
}

let _challengeListenerUnsub = null;
let _matchListenerUnsub = null;
let _onChallengeReceived = null;
let _onChallengeCancelled = null;
let _onMatchReady = null;
let _currentMatchId = null;

export function setOnChallengeReceived(cb) { _onChallengeReceived = cb; }
export function setOnChallengeCancelled(cb) { _onChallengeCancelled = cb; }
export function setOnMatchReady(cb) { _onMatchReady = cb; }
export function getCurrentMatchId() { return _currentMatchId; }

export function startChallengeListener() {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return;
  if (_challengeListenerUnsub) _challengeListenerUnsub();

  var _notifiedMatchIds = {};
  _challengeListenerUnsub = db.collection("pvpMatches")
    .where("players", "array-contains", uid)
    .where("status", "==", "pending")
    .onSnapshot(function (snapshot) {
      snapshot.docChanges().forEach(function (change) {
        if (change.type === "added" || change.type === "modified") {
          var data = change.doc.data();
          if (data.challengedBy !== uid && !_notifiedMatchIds[change.doc.id]) {
            var snapVals = data.snapshots ? Object.keys(data.snapshots) : [];
            if (snapVals.length > 0) {
              _notifiedMatchIds[change.doc.id] = true;
              if (_onChallengeReceived) _onChallengeReceived(change.doc.id, data);
            }
          }
        } else if (change.type === "removed") {
          if (_notifiedMatchIds[change.doc.id]) {
            delete _notifiedMatchIds[change.doc.id];
            if (_onChallengeCancelled) _onChallengeCancelled(change.doc.id);
          }
        }
      });
    }, function (error) {
      console.warn("[PvP] Challenge listener denied — likely signed out.", error.code);
      if (_challengeListenerUnsub) { _challengeListenerUnsub(); _challengeListenerUnsub = null; }
    });
}

export function stopChallengeListener() {
  if (_challengeListenerUnsub) {
    _challengeListenerUnsub();
    _challengeListenerUnsub = null;
  }
}

export async function challengeFriend(friendUid) {
  var uid = currentUid();
  var db = getDb();
  var profile = getLocalProfile();
  if (!uid || !db || !profile) return null;

  var pair = [uid, friendUid].sort();
  var mySnap = buildLiveBattleSnapshot(profile);
  var snapshotsObj = {};
  snapshotsObj[uid] = mySnap;

  var docRef = await db.collection("pvpMatches").add({
    players: pair,
    challengedBy: uid,
    snapshots: snapshotsObj,
    battleSeed: Math.floor(Math.random() * 0x7FFFFFFF),
    status: "pending",
    matchType: "friend",
    result: null,
    createdAt: Date.now(),
    resolvedAt: null
  });

  _currentMatchId = docRef.id;
  await incrementStat("onl_bat_send", 1);
  await incrementStat("pvpChallengesSent", 1);
  return docRef.id;
}

export async function acceptChallenge(matchId) {
  var uid = currentUid();
  var db = getDb();
  var profile = getLocalProfile();
  if (!uid || !db || !profile) return;

  var mySnap = buildLiveBattleSnapshot(profile);
  await db.collection("pvpMatches").doc(matchId).update({
    status: "accepted",
    ["snapshots." + uid]: mySnap
  });
  _currentMatchId = matchId;
  await incrementStat("onl_bat_accept", 1);
  await incrementStat("pvpChallengesAccepted", 1);
}

export async function declineChallenge(matchId) {
  var db = getDb();
  if (!db) return;
  await db.collection("pvpMatches").doc(matchId).update({ status: "declined" });
  await incrementStat("onl_bat_decline", 1);
}

export async function findRandomMatch() {
  var uid = currentUid();
  var db = getDb();
  var profile = getLocalProfile();
  if (!uid || !db || !profile) return null;

  var mySnap = buildLiveBattleSnapshot(profile);

  try {
    var pending = await db.collection("pvpMatches")
      .where("status", "==", "pending")
      .where("matchType", "==", "random")
      .limit(5)
      .get();

    var found = null;
    pending.forEach(function (doc) {
      if (!found) {
        var d = doc.data();
        if (d.challengedBy !== uid) found = doc;
      }
    });

    if (found) {
      await found.ref.update({
        status: "accepted",
        ["snapshots." + uid]: mySnap,
        players: firebase.firestore.FieldValue.arrayUnion(uid)
      });
      _currentMatchId = found.id;
      return { matchId: found.id, matched: true };
    }

    var snapshotsObj = {};
    snapshotsObj[uid] = mySnap;
    var docRef = await db.collection("pvpMatches").add({
      players: [uid],
      challengedBy: uid,
      snapshots: snapshotsObj,
      battleSeed: Math.floor(Math.random() * 0x7FFFFFFF),
      status: "pending",
      matchType: "random",
      result: null,
      createdAt: Date.now(),
      resolvedAt: null
    });
    _currentMatchId = docRef.id;
    return { matchId: docRef.id, matched: false };
  } catch (e) {
    console.warn("[PvP] Random match failed:", e);
    return null;
  }
}

export function listenForMatchAccepted(matchId, cb, onDeclined) {
  var db = getDb();
  if (!db) return function () {};
  if (_matchListenerUnsub) _matchListenerUnsub();
  _matchListenerUnsub = db.collection("pvpMatches").doc(matchId).onSnapshot(function (doc) {
    if (!doc.exists) return;
    var data = doc.data();
    if (data.status === "accepted") {
      cb(data);
    } else if (data.status === "declined") {
      if (_matchListenerUnsub) { _matchListenerUnsub(); _matchListenerUnsub = null; }
      if (onDeclined) onDeclined(data);
    }
  }, function (error) {
    console.warn("[PvP] Match listener denied — likely signed out.", error.code);
    if (_matchListenerUnsub) { _matchListenerUnsub(); _matchListenerUnsub = null; }
  });
  return function () {
    if (_matchListenerUnsub) { _matchListenerUnsub(); _matchListenerUnsub = null; }
  };
}

export function listenForMatchResolved(matchId, cb) {
  var db = getDb();
  if (!db) return function () {};
  var unsub = db.collection("pvpMatches").doc(matchId).onSnapshot(function (doc) {
    if (!doc.exists) return;
    var data = doc.data();
    if (data.status === "resolved" && data.result) {
      unsub();
      cb(data);
    }
  }, function (error) {
    console.warn("[PvP] Match resolved listener error.", error.code);
    unsub();
  });
  return unsub;
}

export async function cancelMatch(matchId) {
  var db = getDb();
  if (!db || !matchId) return;
  try {
    await db.collection("pvpMatches").doc(matchId).delete();
  } catch (e) {}
  _currentMatchId = null;
}

export async function submitPvpResult(matchId, winnerId, rounds) {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db || !matchId) return;

  var matchType = "friend";
  var players = [];
  try {
    var mdoc = await db.collection("pvpMatches").doc(matchId).get();
    if (mdoc.exists) {
      var md = mdoc.data();
      matchType = md.matchType || "friend";
      players = (md.players && md.players.length) ? md.players.slice().sort() : [];
    }
  } catch (e) {}

  var eloPayload = null;
  if (players.length >= 2) {
    var pA = players[0];
    var pB = players[1];
    var profA = await fetchUserProfileForElo(pA);
    var profB = await fetchUserProfileForElo(pB);
    var ra = effectiveWeeklyElo(profA);
    var rb = effectiveWeeklyElo(profB);
    var aWon = winnerId === pA;
    var resElo = computeMatchElo(ra, rb, aWon);
    var weekId = getCurrentWeekId();
    eloPayload = {
      weekId: weekId,
      players: {}
    };
    eloPayload.players[pA] = { before: ra, after: resElo.raNew, delta: resElo.deltaA };
    eloPayload.players[pB] = { before: rb, after: resElo.rbNew, delta: resElo.deltaB };
  }

  var updateData = {
    status: "resolved",
    result: { winner: winnerId, rounds: rounds },
    resolvedAt: Date.now()
  };
  if (eloPayload) updateData.elo = eloPayload;
  await db.collection("pvpMatches").doc(matchId).update(updateData);

  if (eloPayload && players.length >= 2) {
    var lp = getLocalProfile();
    if (lp) {
      ensureWeeklyPvpSeasonOnProfile(lp);
      var myNew = uid === players[0] ? eloPayload.players[players[0]].after : eloPayload.players[players[1]].after;
      lp.pvpEloWeekly = myNew;
      lp.pvpEloWeekId = eloPayload.weekId;
      await updateProfile({ pvpEloWeekly: myNew, pvpEloWeekId: eloPayload.weekId });
    }
  }

  var won = winnerId === uid;
  await recordPvpOutcome(won, matchType);
  await awardXp(won ? 40 : 10);
  try {
    await writeWeeklyLeaderboardEntry(getLocalProfile());
  } catch (e) {}
  _currentMatchId = null;
}

export function getOpponentSnapshot(matchData) {
  var uid = currentUid();
  if (!matchData || !matchData.snapshots) return null;
  var keys = Object.keys(matchData.snapshots);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] !== uid) {
      var snap = matchData.snapshots[keys[i]];
      if (snap) snap.uid = keys[i];
      return snap;
    }
  }
  return null;
}

export async function loadPvpHistory(limit) {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return [];
  try {
    var snap = await db.collection("pvpMatches")
      .where("players", "array-contains", uid)
      .where("status", "==", "resolved")
      .orderBy("resolvedAt", "desc")
      .limit(limit || 10)
      .get();
    var results = [];
    snap.forEach(function (doc) { results.push(Object.assign({ id: doc.id }, doc.data())); });
    return results;
  } catch (e) {
    return [];
  }
}
