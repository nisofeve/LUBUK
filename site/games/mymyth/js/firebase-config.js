/*
 * Firebase Configuration
 * Replace the placeholder values below with your actual Firebase project config.
 * Get these from: Firebase Console > Project Settings > General > Your apps > Web app
 */

const firebaseConfig = {
  apiKey: "AIzaSyD3wFK-VfWMFi7NisPLjiapbP75XxSmqtw",
  authDomain: "mymyth-1c019.firebaseapp.com",
  projectId: "mymyth-1c019",
  storageBucket: "mymyth-1c019.firebasestorage.app",
  messagingSenderId: "1025768979458",
  appId: "1:1025768979458:web:02def71f2ef0bb1ad5bb1b",
  databaseURL: "https://mymyth-1c019-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let _app = null;
let _auth = null;
let _db = null;
let _rtdb = null;
let _initPromise = null;

export function isFirebaseAvailable() {
  return typeof firebase !== "undefined" && firebase.app;
}

export function initFirebase() {
  if (_initPromise) return _initPromise;
  _initPromise = new Promise(function (resolve) {
    if (!isFirebaseAvailable()) {
      console.warn("[Firebase] SDK not loaded — running in offline mode.");
      resolve(false);
      return;
    }
    try {
      if (!firebase.apps.length) {
        _app = firebase.initializeApp(firebaseConfig);
      } else {
        _app = firebase.app();
      }
      _auth = firebase.auth();
      _db = firebase.firestore();
      _rtdb = firebase.database();
      resolve(true);
    } catch (e) {
      console.error("[Firebase] Init failed:", e);
      resolve(false);
    }
  });
  return _initPromise;
}

export function getAuth() { return _auth; }
export function getDb() { return _db; }
export function getRtdb() { return _rtdb; }
export function getApp() { return _app; }
export function currentUid() {
  return _auth && _auth.currentUser ? _auth.currentUser.uid : null;
}
