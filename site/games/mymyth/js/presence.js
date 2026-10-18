import { getRtdb, getDb, currentUid } from './firebase-config.js';

let _presenceRef = null;
let _connectedRef = null;
let _connectedCb = null;

export function setupPresence(uid) {
  var rtdb = getRtdb();
  var db = getDb();
  if (!rtdb || !uid) return;

  _presenceRef = rtdb.ref("/status/" + uid);
  _connectedRef = rtdb.ref(".info/connected");

  _connectedCb = function (snap) {
    if (snap.val() !== true) return;
    _presenceRef.onDisconnect().set({
      isOnline: false,
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    }).then(function () {
      return _presenceRef.set({
        isOnline: true,
        lastSeenAt: firebase.database.ServerValue.TIMESTAMP
      });
    }).catch(function () {});

    if (db) {
      db.collection("users").doc(uid).set({
        isOnline: true,
        lastSeenAt: Date.now()
      }, { merge: true }).catch(function () {});
    }
  };

  _connectedRef.on("value", _connectedCb);
}

export function teardownPresence() {
  var uid = currentUid();
  if (_connectedRef && _connectedCb) {
    _connectedRef.off("value", _connectedCb);
    _connectedCb = null;
  }
  if (_presenceRef) {
    _presenceRef.set({ isOnline: false, lastSeenAt: firebase.database.ServerValue.TIMESTAMP }).catch(function () {});
    _presenceRef = null;
  }
  var db = getDb();
  if (db && uid) {
    db.collection("users").doc(uid).set({
      isOnline: false,
      lastSeenAt: Date.now()
    }, { merge: true }).catch(function () {});
  }
}
