import { initFirebase, isFirebaseAvailable, getAuth, getDb, currentUid } from './firebase-config.js';
import { createPlayerProfile, loadPlayerProfile, getLocalProfile } from './player-profile.js';
import { loadCloudSave } from './cloud-save.js';
import { setupPresence, teardownPresence } from './presence.js';

function hasPlayerDocLoaded() {
  var p = getLocalProfile();
  return !!(p && p.uid);
}

let _onAuthReady = null;
let _authMode = "login";

export function initAuthScreen() {
  var authParticles = document.getElementById("auth-particles");
  if (authParticles) {
    for (var i = 0; i < 18; i++) {
      var p = document.createElement("span");
      p.className = "auth-particle";
      p.style.left = (8 + Math.random() * 84) + "%";
      p.style.top = (20 + Math.random() * 60) + "%";
      p.style.animationDelay = (Math.random() * 4).toFixed(2) + "s";
      p.style.animationDuration = (3 + Math.random() * 2).toFixed(2) + "s";
      authParticles.appendChild(p);
    }
  }

  var tabLogin = document.getElementById("auth-tab-login");
  var tabRegister = document.getElementById("auth-tab-register");
  var nameField = document.getElementById("auth-display-name");
  var submitBtn = document.getElementById("auth-submit");
  var guestBtn = document.getElementById("auth-guest");
  var errorEl = document.getElementById("auth-error");

  if (tabLogin) tabLogin.addEventListener("click", function () {
    _authMode = "login";
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    nameField.hidden = true;
    submitBtn.textContent = "Sign In";
    errorEl.textContent = "";
  });
  if (tabRegister) tabRegister.addEventListener("click", function () {
    _authMode = "register";
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    nameField.hidden = false;
    submitBtn.textContent = "Register";
    errorEl.textContent = "";
  });
  if (submitBtn) submitBtn.addEventListener("click", function () {
    if (_authMode === "login") doEmailLogin();
    else doEmailRegister();
  });
  if (guestBtn) guestBtn.addEventListener("click", doGuestLogin);
  var googleBtn = document.getElementById("auth-google");
  if (googleBtn) googleBtn.addEventListener("click", doGoogleLogin);
}

function setAuthLoading(loading) {
  var card = document.querySelector(".auth-card");
  if (card) card.classList.toggle("auth-loading", loading);
}

function getGoogleProvider() {
  if (typeof firebase === "undefined" || !firebase.auth || !firebase.auth.GoogleAuthProvider) return null;
  var p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}

function showAuthError(msg) {
  var el = document.getElementById("auth-error");
  if (el) el.textContent = msg || "";
}

async function clearStaleSession() {
  var auth = getAuth();
  if (auth && auth.currentUser) {
    try { await auth.signOut(); } catch (_) {}
  }
}

async function doEmailLogin() {
  var email = (document.getElementById("auth-email") || {}).value || "";
  var pass = (document.getElementById("auth-password") || {}).value || "";
  if (!email || !pass) { showAuthError("Please enter email and password."); return; }
  setAuthLoading(true);
  showAuthError("");
  try {
    await clearStaleSession();
    await getAuth().signInWithEmailAndPassword(email, pass);
  } catch (e) {
    showAuthError(friendlyAuthError(e.code));
    setAuthLoading(false);
  }
}

async function doEmailRegister() {
  var email = (document.getElementById("auth-email") || {}).value || "";
  var pass = (document.getElementById("auth-password") || {}).value || "";
  var name = (document.getElementById("auth-display-name") || {}).value || "";
  if (!email || !pass) { showAuthError("Please enter email and password."); return; }
  if (!name || name.trim().length < 2) { showAuthError("Display name must be at least 2 characters."); return; }
  setAuthLoading(true);
  showAuthError("");
  try {
    await clearStaleSession();
    var cred = await getAuth().createUserWithEmailAndPassword(email, pass);
    await createPlayerProfile(cred.user.uid, email, name.trim());
  } catch (e) {
    showAuthError(friendlyAuthError(e.code));
    setAuthLoading(false);
  }
}

async function doGuestLogin() {
  setAuthLoading(true);
  showAuthError("");
  try {
    await clearStaleSession();
    var cred = await getAuth().signInAnonymously();
    await createPlayerProfile(cred.user.uid, null, "Guest_" + cred.user.uid.slice(0, 5));
  } catch (e) {
    showAuthError("Guest login failed. Try again.");
    setAuthLoading(false);
  }
}

async function doGoogleLogin() {
  var auth = getAuth();
  var provider = getGoogleProvider();
  if (!auth || !provider) {
    showAuthError("Google sign-in is not available. Check your connection.");
    return;
  }
  setAuthLoading(true);
  showAuthError("");
  try {
    await clearStaleSession();
    var cred = await auth.signInWithPopup(provider);
    var u = cred.user;
    var disp =
      (u.displayName && u.displayName.trim()) ||
      (u.email && u.email.split("@")[0]) ||
      "Player";
    await createPlayerProfile(u.uid, u.email || null, disp);
  } catch (e) {
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
      showAuthError("");
    } else {
      showAuthError(friendlyAuthError(e.code));
    }
    setAuthLoading(false);
  }
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use": return "This email is already registered.";
    case "auth/invalid-email": return "Invalid email address.";
    case "auth/wrong-password": return "Wrong password.";
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    case "auth/too-many-requests": return "Too many attempts. Wait a moment.";
    case "auth/invalid-credential": return "Invalid credentials. Check email and password.";
    case "auth/account-exists-with-different-credential": return "This email is already linked to another sign-in method.";
    case "auth/popup-blocked": return "Pop-up was blocked. Allow pop-ups for this site and try again.";
    case "auth/network-request-failed": return "Network error. Check your connection.";
    case "auth/operation-not-allowed": return "Google sign-in is not enabled for this app.";
    default: return "Authentication failed. Please try again.";
  }
}

export async function initFirebaseAuth(onReady) {
  _onAuthReady = onReady;
  var ok = await initFirebase();
  if (!ok) {
    if (_onAuthReady) _onAuthReady(null);
    return;
  }
  getAuth().onAuthStateChanged(
    async function (user) {
      setAuthLoading(false);
      if (user) {
        try {
          await user.getIdToken(true);
        } catch (e) {
          console.warn("[Auth] Stale session detected — signing out.");
          try { await getAuth().signOut(); } catch (_) {}
          return;
        }
        await loadPlayerProfile(user.uid);
        if (!hasPlayerDocLoaded()) {
          if (user.isAnonymous) {
            await createPlayerProfile(user.uid, null, "Guest_" + user.uid.slice(0, 5));
          } else {
            var disp =
              (user.displayName && user.displayName.trim()) ||
              (user.email && user.email.split("@")[0]) ||
              "Player";
            await createPlayerProfile(user.uid, user.email || null, disp);
          }
          await loadPlayerProfile(user.uid);
        }
        setupPresence(user.uid);
        var card = document.querySelector(".auth-card");
        if (card) card.classList.add("auth-success-flash");
        setTimeout(function () {
          if (card) card.classList.remove("auth-success-flash");
        }, 600);
        if (_onAuthReady) _onAuthReady(user);
      } else {
        teardownPresence();
        if (_onAuthReady) _onAuthReady(null);
        var screenAuth = document.getElementById("screen-auth");
        var screenPick = document.getElementById("screen-pick");
        var screenGame = document.getElementById("screen-game");
        if (screenAuth) screenAuth.classList.add("active");
        if (screenPick) screenPick.classList.remove("active");
        if (screenGame) screenGame.classList.remove("active");
      }
    },
    function (error) {
      console.warn("[Auth] Auth state error — clearing session.", error);
      setAuthLoading(false);
      if (_onAuthReady) _onAuthReady(null);
      showAuthError("Session expired. Please sign in again.");
      try { getAuth().signOut(); } catch (_) {}
    }
  );
}

export async function doLogout() {
  try {
    teardownPresence();
    await getAuth().signOut();
  } catch (e) {}
}
