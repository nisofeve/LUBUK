import { getDb, currentUid } from './firebase-config.js';
import { state } from './state.js';

let _saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 5000;

export async function saveToCloud() {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db || !state || !state.lineId) return;
  try {
    await db.collection("saves").doc(uid).set({
      state: JSON.parse(JSON.stringify(state)),
      savedAt: Date.now()
    });
  } catch (e) {
    console.warn("[CloudSave] Save failed:", e);
  }
}

export function debouncedCloudSave() {
  if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer = setTimeout(function () {
    _saveDebounceTimer = null;
    saveToCloud();
  }, SAVE_DEBOUNCE_MS);
}

export async function loadCloudSave() {
  var uid = currentUid();
  var db = getDb();
  if (!uid || !db) return null;
  try {
    var doc = await db.collection("saves").doc(uid).get();
    if (doc.exists) {
      var data = doc.data();
      if (data && data.state && data.state.lineId) {
        return {
          kind: "game",
          snapshot: {
            state: data.state,
            reincarnationBonus: data.reincarnationBonus || null,
            reincarnationInventory: data.reincarnationInventory || null,
            savedAt: data.savedAt || 0
          }
        };
      }
    }
  } catch (e) {
    console.warn("[CloudSave] Load failed:", e);
  }
  return null;
}

export function pickNewerSave(localSave, cloudSave) {
  if (!localSave && !cloudSave) return null;
  if (!localSave) return cloudSave;
  if (!cloudSave) return localSave;
  var localT = (localSave.snapshot && localSave.snapshot.savedAt) || 0;
  var cloudT = (cloudSave.snapshot && cloudSave.snapshot.savedAt) || 0;
  return cloudT >= localT ? cloudSave : localSave;
}
