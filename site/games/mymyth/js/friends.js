import { getDb, currentUid } from './firebase-config.js';
import { getLocalProfile, incrementStat } from './player-profile.js';

let _friendsListenerUnsub = null;
let _friendProfiles = {};
let _friendships = [];
let _onFriendsChanged = null;

export function setOnFriendsChanged(cb) { _onFriendsChanged = cb; }
export function getFriendships() { return _friendships; }
export function getFriendProfiles() { return _friendProfiles; }

export function startFriendsListener() {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return;
  if (_friendsListenerUnsub) _friendsListenerUnsub();

  _friendsListenerUnsub = db.collection("friendships")
    .where("users", "array-contains", uid)
    .onSnapshot(async function (snapshot) {
      _friendships = [];
      snapshot.forEach(function (doc) {
        _friendships.push(Object.assign({ id: doc.id }, doc.data()));
      });
      await loadFriendProfiles();
      if (_onFriendsChanged) _onFriendsChanged();
    }, function (error) {
      console.warn("[Friends] Listener denied — likely signed out.", error.code);
      if (_friendsListenerUnsub) { _friendsListenerUnsub(); _friendsListenerUnsub = null; }
    });
}

export function stopFriendsListener() {
  if (_friendsListenerUnsub) {
    _friendsListenerUnsub();
    _friendsListenerUnsub = null;
  }
}

async function loadFriendProfiles() {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return;
  var uids = [];
  for (var i = 0; i < _friendships.length; i++) {
    var fs = _friendships[i];
    for (var j = 0; j < fs.users.length; j++) {
      if (fs.users[j] !== uid && uids.indexOf(fs.users[j]) === -1) {
        uids.push(fs.users[j]);
      }
    }
  }
  for (var k = 0; k < uids.length; k++) {
    try {
      var doc = await db.collection("users").doc(uids[k]).get();
      if (doc.exists) _friendProfiles[uids[k]] = doc.data();
    } catch (e) {}
  }
}

export async function searchByFriendCode(code) {
  var db = getDb();
  if (!db || !code) return null;
  try {
    var snap = await db.collection("users").where("friendCode", "==", code.trim().toUpperCase()).limit(1).get();
    if (!snap.empty) {
      var doc = snap.docs[0];
      await incrementStat("onl_code_find", 1);
      return Object.assign({ uid: doc.id }, doc.data());
    }
  } catch (e) {}
  return null;
}

export async function sendFriendRequest(targetUid) {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db || uid === targetUid) return false;

  var existing = await db.collection("friendships")
    .where("users", "array-contains", uid)
    .get();
  var alreadyExists = false;
  existing.forEach(function (doc) {
    var d = doc.data();
    if (d.users.indexOf(targetUid) !== -1) alreadyExists = true;
  });
  if (alreadyExists) return false;

  var pair = [uid, targetUid].sort();
  await db.collection("friendships").add({
    users: pair,
    status: "pending",
    requestedBy: uid,
    requestedAt: Date.now(),
    acceptedAt: null
  });
  await incrementStat("onl_fr_out", 1);
  return true;
}

export async function acceptFriendRequest(friendshipId) {
  var db = getDb();
  if (!db) return;
  await db.collection("friendships").doc(friendshipId).update({
    status: "accepted",
    acceptedAt: Date.now()
  });
  await incrementStat("onl_fr_in", 1);
}

export async function declineFriendRequest(friendshipId) {
  var db = getDb();
  if (!db) return;
  await db.collection("friendships").doc(friendshipId).delete();
}

export async function removeFriend(friendshipId) {
  var db = getDb();
  if (!db) return;
  await db.collection("friendships").doc(friendshipId).delete();
}

export function getAcceptedFriends() {
  var uid = currentUid();
  var result = [];
  for (var i = 0; i < _friendships.length; i++) {
    var fs = _friendships[i];
    if (fs.status !== "accepted") continue;
    var fuid = fs.users[0] === uid ? fs.users[1] : fs.users[0];
    var prof = _friendProfiles[fuid];
    if (prof) result.push({ friendshipId: fs.id, uid: fuid, profile: prof });
  }
  result.sort(function (a, b) {
    var aOn = a.profile.isOnline ? 1 : 0;
    var bOn = b.profile.isOnline ? 1 : 0;
    if (aOn !== bOn) return bOn - aOn;
    return (b.profile.lastSeenAt || 0) - (a.profile.lastSeenAt || 0);
  });
  return result;
}

export function getPendingIncoming() {
  var uid = currentUid();
  var result = [];
  for (var i = 0; i < _friendships.length; i++) {
    var fs = _friendships[i];
    if (fs.status !== "pending" || fs.requestedBy === uid) continue;
    var fuid = fs.users[0] === uid ? fs.users[1] : fs.users[0];
    var prof = _friendProfiles[fuid];
    result.push({ friendshipId: fs.id, uid: fuid, profile: prof || { displayName: "Unknown", avatarEmoji: "?" } });
  }
  return result;
}

export function getPendingOutgoing() {
  var uid = currentUid();
  var result = [];
  for (var i = 0; i < _friendships.length; i++) {
    var fs = _friendships[i];
    if (fs.status !== "pending" || fs.requestedBy !== uid) continue;
    var fuid = fs.users[0] === uid ? fs.users[1] : fs.users[0];
    var prof = _friendProfiles[fuid];
    result.push({ friendshipId: fs.id, uid: fuid, profile: prof || { displayName: "Unknown", avatarEmoji: "?" } });
  }
  return result;
}

export function pendingIncomingCount() {
  return getPendingIncoming().length;
}
