import { getLocalProfile, updateProfile, getAvatarChoices, xpForLevel, awardXp, incrementStat, getMaxJourneyLevel, getLevelRewardDescriptors } from './player-profile.js';
import { doLogout } from './auth.js';
import { currentUid, getAuth, getDb } from './firebase-config.js';
import { state, treeUnlockedByLine } from './state.js';
import { LINES, nodeByKey, petArtHtml } from './data.js';
import { showConfirm, pushLog } from './ui.js';
import {
  ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_COUNT,
  getAchievementState, getCompletedCount, getCompletedCountByCategory,
  setOnAchievementUnlocked, isAchievementComplete
} from './achievements.js';
import {
  getAcceptedFriends, getPendingIncoming, getPendingOutgoing,
  searchByFriendCode, sendFriendRequest, acceptFriendRequest,
  declineFriendRequest, removeFriend, setOnFriendsChanged, pendingIncomingCount
} from './friends.js';
import {
  challengeFriend, acceptChallenge, declineChallenge,
  findRandomMatch, cancelMatch, listenForMatchAccepted,
  setOnChallengeReceived, setOnChallengeCancelled,
  loadPvpHistory, getCurrentMatchId, listenForMatchResolved
} from './pvp.js';
import { fetchWeeklyLeaderboard, fetchMyWeeklyRank } from './leaderboard.js';
import { formatCountdownTo, getNextMondayResetLocal, formatWeekRangeLabel, DEFAULT_ELO } from './elo.js';
import { getBattleAudioCtx, resumeBattleAudioIfNeeded, playAchievementUnlockSfx } from './audio.js';
import { runPvpBattle, careBlocksAdventure } from './combat.js';

let _levelUpQueue = [];
let _levelUpShowing = false;
let _onLevelUpHook = null;
export function setOnLevelUpHook(fn) { _onLevelUpHook = fn; }

/** Sync the Lair profile button icon with the player's chosen avatarEmoji. */
export function refreshLairProfileButtonAvatar() {
  var btn = document.getElementById("btn-profile");
  if (!btn) return;
  var emojiSpan = btn.querySelector(".game-emoji");
  if (!emojiSpan) return;
  var prof = getLocalProfile();
  var emoji = (prof && prof.avatarEmoji) || "🐉";
  emojiSpan.textContent = emoji;
}

export function showLevelUpIfNeeded(rewards) {
  if (!rewards || !rewards.length) return;
  _levelUpQueue = _levelUpQueue.concat(rewards);
  if (_onLevelUpHook) {
    for (var ri = 0; ri < rewards.length; ri++) {
      try { _onLevelUpHook(rewards[ri].level); } catch (e) {}
    }
  }
  if (!_levelUpShowing) showNextLevelUp();
}

function showNextLevelUp() {
  if (!_levelUpQueue.length) { _levelUpShowing = false; return; }
  _levelUpShowing = true;
  var reward = _levelUpQueue.shift();
  var overlay = document.getElementById("modal-level-up");
  var levelText = document.getElementById("levelup-level-text");
  var rewardsEl = document.getElementById("levelup-rewards");
  if (!overlay) { _levelUpShowing = false; return; }
  levelText.textContent = "Level " + reward.level;
  rewardsEl.innerHTML = "";
  for (var i = 0; i < reward.items.length; i++) {
    var item = document.createElement("div");
    item.className = "levelup-reward-item";
    item.textContent = reward.items[i];
    item.style.animationDelay = (i * 0.15) + "s";
    rewardsEl.appendChild(item);
  }
  overlay.classList.add("open");
  try { playLevelUpSfx(); } catch (e) {}
}

function playLevelUpSfx() {
  try {
    var ctx = getBattleAudioCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime + 0.01;
    var notes = [523.25, 659.25, 783.99];
    for (var i = 0; i < notes.length; i++) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      var start = t0 + i * 0.12;
      o.frequency.setValueAtTime(notes[i], start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.1, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      o.start(start); o.stop(start + 0.4);
    }
  } catch (e) {}
}

export function wireLevelUpModal() {
  var dismiss = document.getElementById("levelup-dismiss");
  if (dismiss) dismiss.addEventListener("click", function () {
    var overlay = document.getElementById("modal-level-up");
    if (overlay) overlay.classList.remove("open");
    setTimeout(showNextLevelUp, 200);
  });
}

export function wireProfileModal() {
  var closeBtn = document.getElementById("modal-profile-close");
  var overlay = document.getElementById("modal-profile");
  if (closeBtn) closeBtn.addEventListener("click", function () { overlay.classList.remove("open"); });
  if (overlay) overlay.addEventListener("click", function (ev) { if (ev.target === overlay) overlay.classList.remove("open"); });

  var copyBtn = document.getElementById("profile-copy-code");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var code = document.getElementById("profile-friend-code");
    if (code) {
      try { navigator.clipboard.writeText(code.textContent); copyBtn.textContent = "Copied!"; setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500); } catch (e) {}
    }
  });

  var logoutBtn = document.getElementById("profile-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    overlay.classList.remove("open");
    doLogout();
  });

  var bioField = document.getElementById("profile-bio");
  if (bioField) bioField.addEventListener("change", function () {
    updateProfile({ "profile.bio": bioField.value.slice(0, 80) });
  });

  var titleSelect = document.getElementById("profile-title-select");
  if (titleSelect) titleSelect.addEventListener("change", function () {
    updateProfile({ "profile.title": titleSelect.value });
  });

  var avatarEl = document.getElementById("profile-avatar");
  if (avatarEl) avatarEl.addEventListener("click", function () {
    openAvatarPicker();
  });

  var tabs = overlay ? overlay.querySelectorAll(".profile-tab") : [];
  for (var ti = 0; ti < tabs.length; ti++) {
    tabs[ti].addEventListener("click", function () {
      switchProfileTab(this.dataset.tab);
    });
  }
}

function switchProfileTab(tabId) {
  var overlay = document.getElementById("modal-profile");
  if (!overlay) return;
  var valid = { main: 1, achievements: 1, journey: 1 };
  if (!valid[tabId]) tabId = "main";
  var tabs = overlay.querySelectorAll(".profile-tab");
  for (var i = 0; i < tabs.length; i++) {
    var active = tabs[i].dataset.tab === tabId;
    tabs[i].classList.toggle("active", active);
    tabs[i].setAttribute("aria-selected", String(active));
  }
  var panels = overlay.querySelectorAll(".profile-panel");
  for (var j = 0; j < panels.length; j++) {
    var match = panels[j].id === "profile-panel-" + tabId;
    panels[j].classList.toggle("profile-panel--active", match);
    panels[j].hidden = !match;
  }
  var scroll = overlay.querySelector(".profile-scroll");
  if (scroll) scroll.scrollTop = 0;
  if (tabId === "achievements") {
    renderAchievementTabs();
    renderAchievementList(_currentAchCat);
  } else if (tabId === "journey") {
    renderJourneyBar();
  }
}

export function openProfileModal(tabId) {
  if (getLocalProfile()) {
    incrementStat("onl_ui_profile", 1).catch(function () {});
  }
  var profile = getLocalProfile();
  var overlay = document.getElementById("modal-profile");
  if (!overlay) return;
  if (!profile) {
    var auth = getAuth();
    var user = auth && auth.currentUser;
    profile = {
      displayName: (user && user.displayName) || "Player",
      email: (user && user.email) || (user && user.isAnonymous ? "Guest account" : ""),
      uid: user ? user.uid : null,
      avatarEmoji: "\uD83D\uDC09",
      friendCode: "—",
      level: 1,
      xp: 0,
      xpToNext: 750,
      stats: {},
      profile: { title: "Novice Keeper", bio: "" },
      activeMythSnapshot: {},
      unlockedTitles: ["Novice Keeper"],
      unlockedBadges: []
    };
  }
  var el = function (id) { return document.getElementById(id); };
  var avatarEl = el("profile-avatar");
  if (avatarEl) avatarEl.textContent = profile.avatarEmoji || "\uD83D\uDC09";
  refreshLairProfileButtonAvatar();
  var nameEl = el("profile-display-name");
  if (nameEl) nameEl.textContent = profile.displayName || "Player";
  var emailEl = el("profile-email");
  if (emailEl) emailEl.textContent = profile.email || (profile.uid ? "Guest account" : "");
  var codeEl = el("profile-friend-code");
  if (codeEl) codeEl.textContent = profile.friendCode || "MY-000000";
  var xpText = el("profile-xp-text");
  if (xpText) xpText.textContent = "XP: " + (profile.xp || 0) + " / " + (profile.xpToNext || 750);
  var lvlLabel = el("profile-level-label");
  if (lvlLabel) lvlLabel.textContent = "Lv " + (profile.level || 1);
  var fill = el("profile-xp-fill");
  if (fill) fill.style.width = ((profile.xp || 0) / (profile.xpToNext || 750) * 100) + "%";
  var bio = el("profile-bio");
  if (bio) bio.value = (profile.profile && profile.profile.bio) || "";

  var titleSelect = document.getElementById("profile-title-select");
  if (titleSelect) {
    titleSelect.innerHTML = "";
    var titles = profile.unlockedTitles || ["Novice Keeper"];
    for (var i = 0; i < titles.length; i++) {
      var opt = document.createElement("option");
      opt.value = titles[i]; opt.textContent = titles[i];
      if (profile.profile && profile.profile.title === titles[i]) opt.selected = true;
      titleSelect.appendChild(opt);
    }
  }

  var statsGrid = document.getElementById("profile-stats-grid");
  if (statsGrid) {
    var s = profile.stats || {};
    var achDone = 0;
    try { achDone = getCompletedCount(); } catch (e) {}
    var snap = profile.activeMythSnapshot || {};
    statsGrid.innerHTML =
      statRow("\u2694\uFE0F Battles Won", s.totalBattlesWon) +
      statRow("\uD83D\uDCA2 Battles Lost", s.totalBattlesLost) +
      statRow("\u2728 Evolutions", s.totalEvolutions) +
      statRow("\uD83D\uDD04 Reincarnations", s.totalReincarnations) +
      statRow("\uD83C\uDFC6 PvP Wins", s.pvpWins) +
      statRow("\uD83E\uDD1D PvP Losses", s.pvpLosses) +
      statRow("\uD83C\uDFC6 Weekly Elo", typeof profile.pvpEloWeekly === "number" ? profile.pvpEloWeekly : DEFAULT_ELO) +
      statRow("\uD83D\uDCC5 This week W/L", (s.pvpWeekWins || 0) + " / " + (s.pvpWeekLosses || 0)) +
      statRow("\uD83D\uDCAB Combat BP", snap.combatBp || 0) +
      statRow("\uD83D\uDC96 Happiness", snap.happiness || 0) +
      statRow("\u26BD Balls Owned", (typeof state !== "undefined" && state ? state.playBalls || 0 : 0)) +
      statRow("\uD83C\uDFC5 Achievements", achDone + " / " + ACHIEVEMENT_COUNT);
  }

  var badgesEl = document.getElementById("profile-badges");
  if (badgesEl) {
    var badges = profile.unlockedBadges || [];
    badgesEl.innerHTML = badges.length === 0 ? '<span style="color:var(--muted);font-size:0.75rem">No badges yet</span>' :
      badges.map(function (b) { return '<span class="profile-badge earned">' + esc(b) + '</span>'; }).join("");
  }

  overlay.classList.add("open");
  switchProfileTab(tabId || "main");
}

function statRow(label, val) {
  return '<div class="profile-stat"><span>' + esc(label) + '</span><span class="profile-stat-val">' + (val || 0) + '</span></div>';
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function wireFriendsModal() {
  var overlay = document.getElementById("modal-friends");
  var closeBtn = document.getElementById("modal-friends-close");
  if (closeBtn) closeBtn.addEventListener("click", function () { overlay.classList.remove("open"); });
  if (overlay) overlay.addEventListener("click", function (ev) { if (ev.target === overlay) overlay.classList.remove("open"); });

  var searchBtn = document.getElementById("friends-search-btn");
  if (searchBtn) searchBtn.addEventListener("click", async function () {
    var input = document.getElementById("friends-search-input");
    var result = document.getElementById("friends-search-result");
    if (!input || !result) return;
    var code = input.value.trim();
    if (!code) { result.textContent = ""; return; }
    result.textContent = "Searching...";
    var found = await searchByFriendCode(code);
    if (!found) { result.innerHTML = '<span style="color:var(--japan)">No player found.</span>'; return; }
    if (found.uid === currentUid()) { result.innerHTML = '<span style="color:var(--japan)">That\'s your own code!</span>'; return; }
    var ok = await sendFriendRequest(found.uid);
    result.innerHTML = ok ? '<span style="color:var(--sea)">Request sent to ' + esc(found.displayName) + '!</span>'
      : '<span style="color:var(--japan)">Already friends or request pending.</span>';
    input.value = "";
  });

  setOnFriendsChanged(function () {
    renderFriendsList();
    updateFriendNotifBadge();
  });
}

export function openFriendsModal() {
  var overlay = document.getElementById("modal-friends");
  if (!overlay) return;
  if (getLocalProfile()) {
    incrementStat("onl_ui_friends", 1).catch(function () {});
  }
  renderFriendsList();
  overlay.classList.add("open");
}

function renderFriendsList() {
  var pendingList = document.getElementById("friends-pending-list");
  var friendsList = document.getElementById("friends-list");
  var pendingSection = document.getElementById("friends-pending-section");
  var emptyEl = document.getElementById("friends-empty");

  var incoming = getPendingIncoming();
  var outgoing = getPendingOutgoing();
  var friends = getAcceptedFriends();

  if (pendingList) {
    if (incoming.length + outgoing.length === 0) {
      if (pendingSection) pendingSection.style.display = "none";
      pendingList.innerHTML = "";
    } else {
      if (pendingSection) pendingSection.style.display = "";
      pendingList.innerHTML = "";
      incoming.forEach(function (f) {
        pendingList.innerHTML += friendRow(f.profile, "incoming", f.friendshipId);
      });
      outgoing.forEach(function (f) {
        pendingList.innerHTML += friendRow(f.profile, "outgoing", f.friendshipId);
      });
      pendingList.querySelectorAll("[data-accept]").forEach(function (btn) {
        btn.addEventListener("click", function () { acceptFriendRequest(btn.dataset.accept); });
      });
      pendingList.querySelectorAll("[data-decline]").forEach(function (btn) {
        btn.addEventListener("click", function () { declineFriendRequest(btn.dataset.decline); });
      });
    }
  }

  if (friendsList) {
    if (friends.length === 0) {
      friendsList.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "";
    } else {
      if (emptyEl) emptyEl.style.display = "none";
      friendsList.innerHTML = "";
      friends.forEach(function (f) {
        friendsList.innerHTML += friendRow(f.profile, "accepted", f.friendshipId, f.uid);
      });
      friendsList.querySelectorAll("[data-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          showConfirm(
            "Remove Friend",
            "Are you sure you want to remove this friend? You can add them again later with their friend code.",
            function () { removeFriend(btn.dataset.remove); }
          );
        });
      });
      friendsList.querySelectorAll("[data-battle]").forEach(function (btn) {
        btn.addEventListener("click", function () { startPvpChallenge(btn.dataset.battle); });
      });
    }
  }
}

function friendRow(profile, type, friendshipId, friendUid) {
  var online = profile.isOnline;
  var dotClass = online ? "friend-online-dot online" : "friend-online-dot";
  var status = profile.statusMessage || (online ? "Online" : timeAgo(profile.lastSeenAt));
  var actions = "";
  if (type === "incoming") {
    actions = '<button class="primary" data-accept="' + friendshipId + '">Accept</button><button data-decline="' + friendshipId + '">Decline</button>';
  } else if (type === "outgoing") {
    actions = '<span style="color:var(--muted);font-size:0.7rem">Sent</span>';
  } else {
    actions = '<button class="primary" data-battle="' + (friendUid || '') + '">\u2694\uFE0F</button><button data-remove="' + friendshipId + '">\u2716</button>';
  }
  return '<div class="friend-row">' +
    '<div class="friend-avatar">' + esc(profile.avatarEmoji || "?") + '<span class="' + dotClass + '"></span></div>' +
    '<div class="friend-info"><div class="friend-name">' + esc(profile.displayName || "Player") + '</div>' +
    '<div class="friend-level">Lv ' + (profile.level || 1) + '</div>' +
    '<div class="friend-status">' + esc(status) + '</div></div>' +
    '<div class="friend-actions">' + actions + '</div></div>';
}

function timeAgo(ts) {
  if (!ts) return "Unknown";
  var diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return Math.floor(diff / 86400000) + "d ago";
}

function updateFriendNotifBadge() {
  var badge = document.getElementById("friends-notif-badge");
  if (!badge) return;
  var count = pendingIncomingCount();
  badge.textContent = count > 0 ? String(count) : "";
}

var _challengeTimeoutId = null;
var _challengeMatchId = null;

function clearChallengeTimeout() {
  if (_challengeTimeoutId) { clearTimeout(_challengeTimeoutId); _challengeTimeoutId = null; }
  _challengeMatchId = null;
}

function cancelPendingChallenge() {
  var matchStatus = document.getElementById("pvp-matchmaking-status");
  if (_challengeMatchId) {
    cancelMatch(_challengeMatchId);
  }
  clearChallengeTimeout();
  if (matchStatus) {
    matchStatus.innerHTML = '<span style="color:var(--muted)">Challenge cancelled.</span>';
    setTimeout(function () { matchStatus.hidden = true; }, 2000);
  }
}

async function startPvpChallenge(friendUid) {
  if (!friendUid) return;
  if (careBlocksAdventure()) {
    pushLog("Your myth is busy eating or playing — finish that before PvP.");
    return;
  }
  var friendsOverlay = document.getElementById("modal-friends");
  if (friendsOverlay) friendsOverlay.classList.remove("open");
  var matchId = await challengeFriend(friendUid);
  if (!matchId) return;

  _challengeMatchId = matchId;
  var pvpOverlay = document.getElementById("modal-pvp");
  var matchStatus = document.getElementById("pvp-matchmaking-status");
  if (pvpOverlay) pvpOverlay.classList.add("open");
  if (matchStatus) {
    matchStatus.hidden = false;
    matchStatus.innerHTML = '<span class="pvp-spinner"></span> Waiting for response...' +
      '<br/><button type="button" id="pvp-cancel-challenge-btn" style="margin-top:0.5rem;font-size:0.75rem">Cancel</button>';
    var cancelBtn = document.getElementById("pvp-cancel-challenge-btn");
    if (cancelBtn) cancelBtn.addEventListener("click", cancelPendingChallenge);
  }

  listenForMatchAccepted(matchId, function (matchData) {
    clearChallengeTimeout();
    if (matchStatus) matchStatus.hidden = true;
    if (pvpOverlay) pvpOverlay.classList.remove("open");
    if (careBlocksAdventure()) {
      pushLog("Your myth is busy eating or playing — finish that before PvP.");
      return;
    }
    resumeBattleAudioIfNeeded();
    runPvpBattle(matchData, matchId, true);
  }, function () {
    clearChallengeTimeout();
    cancelMatch(matchId);
    if (matchStatus) {
      matchStatus.innerHTML = '<span style="color:var(--japan)">Your friend declined the battle request.</span>';
      setTimeout(function () { matchStatus.hidden = true; }, 3000);
    }
  });

  _challengeTimeoutId = setTimeout(function () {
    if (matchStatus && !matchStatus.hidden && _challengeMatchId === matchId) {
      cancelMatch(matchId);
      clearChallengeTimeout();
      matchStatus.innerHTML = '<span style="color:var(--muted)">No response from friend. Challenge expired.</span>';
      setTimeout(function () { matchStatus.hidden = true; }, 3000);
    }
  }, 15000);
}

var _ladderCountdownTimer = null;

function clearLadderCountdownTimer() {
  if (_ladderCountdownTimer) {
    clearInterval(_ladderCountdownTimer);
    _ladderCountdownTimer = null;
  }
}

function updateLadderCountdownEl() {
  var el = document.getElementById("ladder-reset-countdown");
  if (el) el.textContent = formatCountdownTo(getNextMondayResetLocal());
}

function setPvpModalTab(tab) {
  var arena = document.getElementById("pvp-panel-arena");
  var ladder = document.getElementById("pvp-panel-ladder");
  var tArena = document.getElementById("pvp-tab-arena");
  var tLadder = document.getElementById("pvp-tab-ladder");
  var isArena = tab === "arena";
  if (arena) { arena.hidden = !isArena; arena.setAttribute("aria-hidden", isArena ? "false" : "true"); }
  if (ladder) { ladder.hidden = isArena; ladder.setAttribute("aria-hidden", isArena ? "true" : "false"); }
  if (tArena) {
    tArena.classList.toggle("is-active", isArena);
    tArena.setAttribute("aria-selected", isArena ? "true" : "false");
  }
  if (tLadder) {
    tLadder.classList.toggle("is-active", !isArena);
    tLadder.setAttribute("aria-selected", !isArena ? "true" : "false");
  }
  if (!isArena) {
    refreshLadderPanel();
    updateLadderCountdownEl();
    clearLadderCountdownTimer();
    _ladderCountdownTimer = setInterval(updateLadderCountdownEl, 30000);
  } else {
    clearLadderCountdownTimer();
  }
}

async function refreshLadderPanel() {
  var loading = document.getElementById("ladder-loading");
  var list = document.getElementById("ladder-list");
  var empty = document.getElementById("ladder-empty");
  var weekLabel = document.getElementById("ladder-week-label");
  if (weekLabel) weekLabel.textContent = formatWeekRangeLabel();

  var youEmoji = document.getElementById("ladder-you-emoji");
  var youName = document.getElementById("ladder-you-name");
  var youSub = document.getElementById("ladder-you-sub");
  var youElo = document.getElementById("ladder-you-elo");
  var prof = getLocalProfile();
  if (youEmoji && prof) youEmoji.textContent = prof.avatarEmoji || "\uD83D\uDC09";
  if (youName && prof) youName.textContent = prof.displayName || "You";
  if (youElo && prof) {
    var ye = typeof prof.pvpEloWeekly === "number" ? prof.pvpEloWeekly : DEFAULT_ELO;
    youElo.textContent = String(ye);
  }

  if (loading) loading.style.display = "";
  if (list) list.hidden = true;
  if (empty) empty.hidden = true;

  var rows = await fetchWeeklyLeaderboard(50);
  var mine = await fetchMyWeeklyRank();
  var uid = currentUid();

  if (youSub) {
    if (mine && mine.inBoard && mine.rank != null) {
      youSub.textContent = "Rank #" + mine.rank + " this week · " + (rows.length ? rows.length + " on board" : "leaderboard");
    } else {
      youSub.textContent = "Unranked this week — win a match to appear";
    }
  }
  if (youElo && mine && typeof mine.elo === "number") youElo.textContent = String(mine.elo);

  if (loading) loading.style.display = "none";

  if (!rows.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (list) {
    list.hidden = false;
    list.innerHTML = rows.map(function (r) {
      var topc = r.rank === 1 ? "top1" : r.rank === 2 ? "top2" : r.rank === 3 ? "top3" : "";
      var me = uid && r.uid === uid ? " is-me" : "";
      return '<div class="ladder-row' + me + '">' +
        '<div class="ladder-rank ' + topc + '">' + r.rank + '</div>' +
        '<div class="ladder-who"><span class="av">' + esc(r.avatarEmoji || "\uD83D\uDC09") + '</span>' +
        '<span class="nm">' + esc(r.displayName) + '</span></div>' +
        '<div class="ladder-wl">' + (r.wins || 0) + "W " + (r.losses || 0) + "L</div>" +
        '<div class="ladder-elo">' + r.elo + "</div></div>";
    }).join("");
  }
}

export function wirePvpModal() {
  var overlay = document.getElementById("modal-pvp");
  var closeBtn = document.getElementById("modal-pvp-close");
  if (closeBtn) closeBtn.addEventListener("click", function () {
    overlay.classList.remove("open");
    clearLadderCountdownTimer();
  });
  if (overlay) overlay.addEventListener("click", function (ev) {
    if (ev.target === overlay) {
      overlay.classList.remove("open");
      clearLadderCountdownTimer();
    }
  });

  var tabArena = document.getElementById("pvp-tab-arena");
  var tabLadder = document.getElementById("pvp-tab-ladder");
  if (tabArena) tabArena.addEventListener("click", function () { setPvpModalTab("arena"); });
  if (tabLadder) tabLadder.addEventListener("click", function () {
    setPvpModalTab("ladder");
    incrementStat("onl_ui_ladder", 1).catch(function () {});
  });

  var refreshBtn = document.getElementById("ladder-refresh");
  if (refreshBtn) refreshBtn.addEventListener("click", function () { refreshLadderPanel(); });

  var challengeBtn = document.getElementById("pvp-challenge-friend");
  if (challengeBtn) challengeBtn.addEventListener("click", function () {
    var picker = document.getElementById("pvp-friend-picker");
    var list = document.getElementById("pvp-friend-list");
    if (!picker || !list) return;
    picker.hidden = !picker.hidden;
    if (!picker.hidden) {
      var friends = getAcceptedFriends();
      list.innerHTML = friends.length === 0 ? '<div style="color:var(--muted);font-size:0.8rem;padding:0.5rem">No friends online.</div>' :
        friends.map(function (f) {
          return '<div class="friend-row" style="cursor:pointer" data-challenge-uid="' + f.uid + '">' +
            '<div class="friend-avatar">' + esc(f.profile.avatarEmoji || "?") + '</div>' +
            '<div class="friend-info"><div class="friend-name">' + esc(f.profile.displayName) + '</div><div class="friend-level">Lv ' + (f.profile.level || 1) + ' \u00B7 BP ' + ((f.profile.activeMythSnapshot && f.profile.activeMythSnapshot.combatBp) || 0) + '</div></div></div>';
        }).join("");
      list.querySelectorAll("[data-challenge-uid]").forEach(function (row) {
        row.addEventListener("click", function () {
          picker.hidden = true;
          startPvpChallenge(row.dataset.challengeUid);
        });
      });
    }
  });

  var randomBtn = document.getElementById("pvp-random-match");
  if (randomBtn) randomBtn.addEventListener("click", startRandomMatch);

  var cancelBtn = document.getElementById("pvp-cancel-matchmaking");
  if (cancelBtn) cancelBtn.addEventListener("click", function () {
    var matchId = getCurrentMatchId();
    if (matchId) cancelMatch(matchId);
    var status = document.getElementById("pvp-matchmaking-status");
    if (status) status.hidden = true;
  });

  setOnChallengeReceived(function (matchId, data) {
    showChallengeToast(matchId, data);
  });

  setOnChallengeCancelled(function (matchId) {
    if (_challengeToastMatchId === matchId) {
      hideChallengeToast();
      showCancelledNotification();
    }
  });
}

export function openPvpModal() {
  var overlay = document.getElementById("modal-pvp");
  if (!overlay) return;
  if (getLocalProfile()) {
    incrementStat("onl_ui_pvp", 1).catch(function () {});
  }
  setPvpModalTab("arena");
  loadAndRenderPvpHistory();
  updateLadderCountdownEl();
  overlay.classList.add("open");
}

async function loadAndRenderPvpHistory() {
  var listEl = document.getElementById("pvp-history-list");
  var emptyEl = document.getElementById("pvp-history-empty");
  if (!listEl) return;
  var history = await loadPvpHistory(10);
  if (!history.length) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "";
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";
  var uid = currentUid();
  listEl.innerHTML = history.map(function (m) {
    var won = m.result && m.result.winner === uid;
    var opKey = Object.keys(m.snapshots || {}).filter(function (k) { return k !== uid; })[0];
    var opSnap = opKey ? m.snapshots[opKey] : {};
    return '<div class="pvp-history-row"><span class="' + (won ? "pvp-result-win" : "pvp-result-lose") + '">' + (won ? "WIN" : "LOSS") + '</span> vs ' + esc(opSnap.displayName || "Player") + '</div>';
  }).join("");
}

var _randomSearchInterval = null;
var _randomSearchTimeout = null;

function clearRandomSearchTimers() {
  if (_randomSearchInterval) { clearInterval(_randomSearchInterval); _randomSearchInterval = null; }
  if (_randomSearchTimeout) { clearTimeout(_randomSearchTimeout); _randomSearchTimeout = null; }
}

async function startRandomMatch() {
  if (careBlocksAdventure()) {
    pushLog("Your myth is busy eating or playing — finish that before PvP.");
    return;
  }
  var matchStatus = document.getElementById("pvp-matchmaking-status");
  if (matchStatus) {
    matchStatus.hidden = false;
    matchStatus.innerHTML =
      '<span class="pvp-spinner"></span> Searching for opponent... <span id="pvp-random-countdown">30</span>s' +
      '<br/><button type="button" id="pvp-cancel-matchmaking-inner" style="margin-top:0.5rem;font-size:0.75rem">Cancel</button>';
  }
  var result = await findRandomMatch();
  if (!result) {
    if (matchStatus) { matchStatus.hidden = true; }
    return;
  }
  var pvpOverlay = document.getElementById("modal-pvp");
  if (result.matched) {
    if (matchStatus) matchStatus.hidden = true;
    if (pvpOverlay) pvpOverlay.classList.remove("open");
    var matchDoc = await getDb().collection("pvpMatches").doc(result.matchId).get().catch(function () { return null; });
    if (matchDoc && matchDoc.exists) {
      if (careBlocksAdventure()) {
        pushLog("Your myth is busy eating or playing — finish that before PvP.");
        if (matchStatus) matchStatus.hidden = true;
        return;
      }
      resumeBattleAudioIfNeeded();
      runPvpBattle(matchDoc.data(), result.matchId, false);
    }
  } else {
    var remaining = 30;
    var countdownEl = document.getElementById("pvp-random-countdown");
    clearRandomSearchTimers();
    _randomSearchInterval = setInterval(function () {
      remaining--;
      if (countdownEl) countdownEl.textContent = String(Math.max(0, remaining));
    }, 1000);

    var cancelInner = document.getElementById("pvp-cancel-matchmaking-inner");
    if (cancelInner) cancelInner.addEventListener("click", function () {
      clearRandomSearchTimers();
      cancelMatch(result.matchId);
      if (matchStatus) matchStatus.hidden = true;
    });

    listenForMatchAccepted(result.matchId, function (matchData) {
      clearRandomSearchTimers();
      if (matchStatus) matchStatus.hidden = true;
      if (pvpOverlay) pvpOverlay.classList.remove("open");
      if (careBlocksAdventure()) {
        pushLog("Your myth is busy eating or playing — finish that before PvP.");
        return;
      }
      resumeBattleAudioIfNeeded();
      runPvpBattle(matchData, result.matchId, true);
    });

    _randomSearchTimeout = setTimeout(function () {
      clearRandomSearchTimers();
      if (matchStatus && !matchStatus.hidden) {
        cancelMatch(result.matchId);
        matchStatus.innerHTML = '<span style="color:var(--muted)">No opponent found. Try again later.</span>';
        setTimeout(function () { matchStatus.hidden = true; }, 2500);
      }
    }, 30000);
  }
}

var _challengeToastTimeout = null;
var _challengeToastMatchId = null;

function showChallengeToast(matchId, data) {
  var toast = document.getElementById("pvp-challenge-toast");
  if (!toast) return;
  if (_cancelledNotifTimeout) { clearTimeout(_cancelledNotifTimeout); _cancelledNotifTimeout = null; }
  var avatarEl = document.getElementById("pvp-challenge-avatar");
  var nameEl = document.getElementById("pvp-challenge-name");
  var statsEl = document.getElementById("pvp-challenge-stats");
  var titleEl = document.querySelector(".pvp-challenge-title");
  var actionsEl = document.querySelector(".pvp-challenge-actions");

  var snapshotValues = data && data.snapshots ? Object.values(data.snapshots) : [];
  if (!snapshotValues.length) return;
  var challenger = snapshotValues[0] || {};
  if (avatarEl) avatarEl.textContent = challenger.avatarEmoji || "\u2694\uFE0F";
  if (nameEl) nameEl.textContent = challenger.displayName || "A player";
  if (statsEl) {
    var parts = [];
    if (challenger.combatBp) parts.push("BP " + challenger.combatBp);
    if (challenger.maxHp) parts.push("HP " + challenger.maxHp);
    if (challenger.atk) parts.push("Atk " + challenger.atk);
    statsEl.textContent = parts.length ? parts.join(" \u00B7 ") : "";
  }
  if (titleEl) titleEl.textContent = "challenges you to battle!";
  if (actionsEl) {
    actionsEl.innerHTML =
      '<button type="button" class="primary" id="pvp-challenge-accept">\u2694\uFE0F Accept</button>' +
      '<button type="button" id="pvp-challenge-decline">Decline</button>';
  }
  var acceptBtn = document.getElementById("pvp-challenge-accept");
  var declineBtn = document.getElementById("pvp-challenge-decline");
  if (acceptBtn) {
    acceptBtn.dataset.matchId = matchId;
    acceptBtn.addEventListener("click", async function () {
      var mid = acceptBtn.dataset.matchId;
      if (!mid) return;
      if (careBlocksAdventure()) {
        pushLog("Your myth is busy eating or playing — finish that before accepting a battle.");
        return;
      }
      resumeBattleAudioIfNeeded();
      hideChallengeToast();
      await acceptChallenge(mid);
      try {
        var matchDoc = await getDb().collection("pvpMatches").doc(mid).get();
        if (matchDoc && matchDoc.exists) {
          if (careBlocksAdventure()) {
            pushLog("Your myth is busy eating or playing — finish that before battling.");
            return;
          }
          resumeBattleAudioIfNeeded();
          runPvpBattle(matchDoc.data(), mid, false);
        }
      } catch (e) {
        console.warn("[PvP] Failed to load match for battle:", e);
      }
    });
  }
  if (declineBtn) {
    declineBtn.dataset.matchId = matchId;
    declineBtn.addEventListener("click", function () {
      var mid = declineBtn.dataset.matchId;
      if (mid) {
        declineChallenge(mid);
        hideChallengeToast();
      }
    });
  }

  _challengeToastMatchId = matchId;
  toast.classList.add("visible");
  try { playPvpChallengeSfx(); } catch (e) {}
  if (_challengeToastTimeout) clearTimeout(_challengeToastTimeout);
  _challengeToastTimeout = setTimeout(function () {
    hideChallengeToast();
    declineChallenge(matchId);
  }, 60000);
}

function hideChallengeToast() {
  var toast = document.getElementById("pvp-challenge-toast");
  if (toast) toast.classList.remove("visible");
  if (_challengeToastTimeout) { clearTimeout(_challengeToastTimeout); _challengeToastTimeout = null; }
  _challengeToastMatchId = null;
}

var _cancelledNotifTimeout = null;

function showCancelledNotification() {
  if (_cancelledNotifTimeout) { clearTimeout(_cancelledNotifTimeout); _cancelledNotifTimeout = null; }
  var avatarEl = document.getElementById("pvp-challenge-avatar");
  var nameEl = document.getElementById("pvp-challenge-name");
  var statsEl = document.getElementById("pvp-challenge-stats");
  var titleEl = document.querySelector(".pvp-challenge-title");
  var actionsEl = document.querySelector(".pvp-challenge-actions");
  var toast = document.getElementById("pvp-challenge-toast");
  if (!toast) return;

  if (avatarEl) avatarEl.textContent = "\u274C";
  if (nameEl) nameEl.textContent = "Challenge Cancelled";
  if (statsEl) statsEl.textContent = "The challenger withdrew the battle request.";
  if (titleEl) titleEl.textContent = "";
  if (actionsEl) actionsEl.innerHTML = '<button type="button" class="primary" id="pvp-cancelled-ok">OK</button>';
  var okBtn = document.getElementById("pvp-cancelled-ok");
  if (okBtn) okBtn.addEventListener("click", function () { toast.classList.remove("visible"); });

  toast.classList.add("visible");
  _cancelledNotifTimeout = setTimeout(function () {
    toast.classList.remove("visible");
    _cancelledNotifTimeout = null;
  }, 5000);
}

function showPvpWaitingForResult(matchId, opSnap) {
  var overlay = document.getElementById("pvp-waiting-overlay");
  if (!overlay) return;
  var avatarEl = document.getElementById("pvp-waiting-avatar");
  var opNameEl = document.getElementById("pvp-waiting-opponent");
  var statusEl = document.getElementById("pvp-waiting-status");
  var resultEl = document.getElementById("pvp-waiting-result");
  var xpEl = document.getElementById("pvp-waiting-xp");
  var dismissBtn = document.getElementById("pvp-waiting-dismiss");

  var op = opSnap || {};
  if (avatarEl) avatarEl.textContent = op.avatarEmoji || "\u2694\uFE0F";
  if (opNameEl) opNameEl.textContent = "vs " + (op.displayName || "Opponent");
  if (statusEl) { statusEl.innerHTML = '<span class="pvp-waiting-spinner"></span> Battle in progress...'; statusEl.style.display = ""; }
  if (resultEl) { resultEl.className = "pvp-waiting-result"; resultEl.textContent = ""; }
  if (xpEl) { xpEl.className = "pvp-waiting-xp"; xpEl.textContent = ""; }
  if (dismissBtn) { dismissBtn.className = "primary pvp-waiting-dismiss"; }

  overlay.classList.add("open");

  listenForMatchResolved(matchId, async function (matchData) {
    var uid = currentUid();
    var won = matchData.result && matchData.result.winner === uid;

    if (statusEl) statusEl.style.display = "none";
    if (resultEl) {
      resultEl.textContent = won ? "Victory!" : "Defeat";
      resultEl.className = "pvp-waiting-result visible " + (won ? "win" : "lose");
    }

    try {
      await incrementStat(won ? "pvpWins" : "pvpLosses", 1);
      var xpRewards = await awardXp(won ? 40 : 10);
      if (xpEl) {
        xpEl.textContent = won ? "+40 XP" : "+10 XP";
        xpEl.className = "pvp-waiting-xp visible";
      }
      if (xpRewards) showLevelUpIfNeeded(xpRewards);
    } catch (e) {}

    if (dismissBtn) {
      dismissBtn.className = "primary pvp-waiting-dismiss visible";
      dismissBtn.onclick = function () {
        overlay.classList.remove("open");
        dismissBtn.onclick = null;
      };
    }
  });
}

function playPvpChallengeSfx() {
  try {
    var ctx = getBattleAudioCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime + 0.01;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(130, t0);
    o.frequency.exponentialRampToValueAtTime(180, t0 + 0.15);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.start(t0); o.stop(t0 + 0.35);
    var o2 = ctx.createOscillator();
    var g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.type = "sine";
    o2.frequency.setValueAtTime(880, t0 + 0.12);
    g2.gain.setValueAtTime(0, t0 + 0.12);
    g2.gain.linearRampToValueAtTime(0.08, t0 + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    o2.start(t0 + 0.12); o2.stop(t0 + 0.45);
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════
   JOURNEY BAR
   ═══════════════════════════════════════════════════════ */

export function renderJourneyBar() {
  var bar = document.getElementById("journey-bar");
  var profile = getLocalProfile();
  if (!bar || !profile) return;
  var level = Math.min(profile.level || 1, getMaxJourneyLevel());
  var maxNodes = getMaxJourneyLevel();
  bar.innerHTML = "";
  for (var i = 1; i <= maxNodes; i++) {
    if (i > 1) {
      var line = document.createElement("div");
      line.className = "journey-line" + (i <= level ? " filled" : "");
      bar.appendChild(line);
    }
    var node = document.createElement("div");
    var reached = i <= level;
    var isCurrent = i === level;
    node.className = "journey-node" + (reached ? " reached" : "") + (isCurrent ? " current" : "");
    var dot = document.createElement("div");
    dot.className = "journey-node-dot";
    dot.textContent = reached ? "\u2713" : String(i);
    var label = document.createElement("div");
    label.className = "journey-node-label";
    label.textContent = "Lv " + i;
    node.appendChild(dot);
    node.appendChild(label);
    bar.appendChild(node);
  }
  if (level > 1) {
    setTimeout(function () {
      var currentNode = bar.querySelector(".journey-node.current");
      if (currentNode) currentNode.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 100);
  }
  renderJourneyRewardsList(level);
}

function renderJourneyRewardsList(playerLevel) {
  var list = document.getElementById("journey-rewards-list");
  if (!list) return;
  var max = getMaxJourneyLevel();
  var html = "";
  for (var lvl = 1; lvl <= max; lvl++) {
    var rewards = getLevelRewardDescriptors(lvl);
    var status = lvl < playerLevel ? "claimed" : (lvl === playerLevel ? "current" : "locked");
    var statusIcon = status === "claimed" ? "✓" : (status === "current" ? "●" : "○");
    var pills = rewards.map(function (r) {
      var cls = "journey-reward-pill" + (r.special ? " journey-reward-pill--special" : "");
      return '<span class="' + cls + '"><span class="journey-reward-ico" aria-hidden="true">' + r.icon + '</span>' + esc(r.label) + '</span>';
    }).join("");
    html +=
      '<div class="journey-reward-row journey-reward-row--' + status + '">' +
        '<div class="journey-reward-level">' +
          '<span class="journey-reward-status" aria-hidden="true">' + statusIcon + '</span>' +
          '<span class="journey-reward-lvl">Lv ' + lvl + '</span>' +
        '</div>' +
        '<div class="journey-reward-pills">' + pills + '</div>' +
      '</div>';
  }
  list.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════
   AVATAR PICKER
   ═══════════════════════════════════════════════════════ */

export function wireAvatarPicker() {
  var overlay = document.getElementById("avatar-picker-overlay");
  if (!overlay) return;
  overlay.addEventListener("click", function (ev) {
    if (ev.target === overlay) overlay.classList.remove("open");
  });
}

export function openAvatarPicker() {
  var overlay = document.getElementById("avatar-picker-overlay");
  var emojiGrid = document.getElementById("avatar-picker-emoji-grid");
  var mythGrid = document.getElementById("avatar-picker-myth-grid");
  var profile = getLocalProfile();
  if (!overlay || !emojiGrid || !mythGrid || !profile) return;

  var currentAvatar = profile.avatarEmoji || "\uD83D\uDC09";

  emojiGrid.innerHTML = "";
  var choices = getAvatarChoices();
  for (var i = 0; i < choices.length; i++) {
    var btn = document.createElement("div");
    btn.className = "avatar-pick-item" + (choices[i] === currentAvatar ? " selected" : "");
    btn.textContent = choices[i];
    btn.dataset.emoji = choices[i];
    btn.addEventListener("click", function () {
      selectAvatar(this.dataset.emoji);
      overlay.classList.remove("open");
    });
    emojiGrid.appendChild(btn);
  }

  mythGrid.innerHTML = "";
  var lineIds = Object.keys(treeUnlockedByLine || {});
  var count = 0;
  for (var li = 0; li < lineIds.length; li++) {
    var lid = lineIds[li];
    var unlocked = treeUnlockedByLine[lid];
    if (!unlocked || !LINES || !LINES[lid]) continue;
    var keys = Object.keys(unlocked);
    for (var ki = 0; ki < keys.length; ki++) {
      var nk = keys[ki];
      var node = nodeByKey(LINES[lid], nk);
      if (!node) continue;
      var btn2 = document.createElement("div");
      btn2.className = "avatar-pick-item avatar-pick-myth";
      btn2.title = node.name;
      btn2.dataset.emoji = node.emoji || "\u2728";
      btn2.textContent = node.emoji || "\u2728";
      btn2.addEventListener("click", function () {
        selectAvatar(this.dataset.emoji);
        overlay.classList.remove("open");
      });
      mythGrid.appendChild(btn2);
      count++;
    }
  }
  if (count === 0) {
    mythGrid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);font-size:0.72rem;padding:0.3rem">Evolve to unlock myth form avatars</div>';
  }

  overlay.classList.add("open");
}

function selectAvatar(emoji) {
  updateProfile({ avatarEmoji: emoji });
  var avatarEl = document.getElementById("profile-avatar");
  if (avatarEl) avatarEl.textContent = emoji;
  var lairBtn = document.getElementById("btn-profile");
  var lairEmoji = lairBtn && lairBtn.querySelector(".game-emoji");
  if (lairEmoji) lairEmoji.textContent = emoji;
}

/* ═══════════════════════════════════════════════════════
   ACHIEVEMENT MODAL + TOAST
   ═══════════════════════════════════════════════════════ */

var _achToastQueue = [];
var _achToastShowing = false;

export function initAchievementToast() {
  setOnAchievementUnlocked(function (def) {
    _achToastQueue.push(def);
    if (!_achToastShowing) showNextAchToast();
  });
}

function showNextAchToast() {
  if (!_achToastQueue.length) { _achToastShowing = false; return; }
  _achToastShowing = true;
  var def = _achToastQueue.shift();
  try { playAchievementUnlockSfx(); } catch (e) {}
  var toast = document.getElementById("achievement-toast");
  var icon = document.getElementById("achievement-toast-icon");
  var name = document.getElementById("achievement-toast-name");
  var xp = document.getElementById("achievement-toast-xp");
  if (!toast) { _achToastShowing = false; return; }
  icon.textContent = def.icon || "\uD83C\uDFC6";
  name.textContent = def.name;
  xp.textContent = "+" + def.xp + " XP";
  toast.classList.add("visible");
  try { playAchievementSfx(); } catch (e) {}
  setTimeout(function () {
    toast.classList.remove("visible");
    setTimeout(showNextAchToast, 300);
  }, 2800);
}

function playAchievementSfx() {
  try {
    var ctx = getBattleAudioCtx();
    if (!ctx) return;
    var t0 = ctx.currentTime + 0.01;
    var notes = [784, 988, 1175, 1568];
    for (var i = 0; i < notes.length; i++) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = i < 2 ? "sine" : "triangle";
      var start = t0 + i * 0.1;
      o.frequency.setValueAtTime(notes[i], start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.08, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      o.start(start);
      o.stop(start + 0.55);
    }
    var shimmer = ctx.createOscillator();
    var sg = ctx.createGain();
    shimmer.connect(sg); sg.connect(ctx.destination);
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(2350, t0 + 0.3);
    shimmer.frequency.exponentialRampToValueAtTime(1568, t0 + 0.7);
    sg.gain.setValueAtTime(0, t0 + 0.3);
    sg.gain.linearRampToValueAtTime(0.04, t0 + 0.35);
    sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
    shimmer.start(t0 + 0.3);
    shimmer.stop(t0 + 0.85);
  } catch (e) {}
}

var _currentAchCat = "all";

// Achievements now live inside the profile modal as a tab.
// Kept exported so existing call sites keep working.
export function wireAchievementModal() {
  /* no-op — wiring is handled by wireProfileModal's tab click handlers */
}

export function openAchievementModal() {
  openProfileModal("achievements");
}

function renderAchievementTabs() {
  var tabsEl = document.getElementById("ach-cat-tabs");
  if (!tabsEl) return;
  tabsEl.innerHTML = "";
  var allTab = document.createElement("button");
  allTab.type = "button";
  allTab.className = "ach-cat-tab" + (_currentAchCat === "all" ? " active" : "");
  allTab.textContent = "All";
  allTab.addEventListener("click", function () { _currentAchCat = "all"; renderAchievementTabs(); renderAchievementList("all"); });
  tabsEl.appendChild(allTab);
  for (var i = 0; i < ACHIEVEMENT_CATEGORIES.length; i++) {
    var cat = ACHIEVEMENT_CATEGORIES[i];
    var tab = document.createElement("button");
    tab.type = "button";
    tab.className = "ach-cat-tab" + (_currentAchCat === cat.id ? " active" : "");
    tab.textContent = cat.icon + " " + cat.name;
    tab.dataset.cat = cat.id;
    tab.addEventListener("click", function () { _currentAchCat = this.dataset.cat; renderAchievementTabs(); renderAchievementList(this.dataset.cat); });
    tabsEl.appendChild(tab);
  }
}

function renderAchievementList(cat) {
  var listEl = document.getElementById("ach-list");
  var summaryEl = document.getElementById("ach-summary");
  if (!listEl) return;
  var achState = getAchievementState();
  var completed = getCompletedCount();
  if (summaryEl) summaryEl.innerHTML = "<strong>" + completed + "</strong> / " + ACHIEVEMENT_COUNT + " achievements completed";
  var filtered = cat === "all" ? ACHIEVEMENTS : ACHIEVEMENTS.filter(function (a) { return a.cat === cat; });
  listEl.innerHTML = "";
  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;text-align:center;padding:1rem 0">No achievements in this category.</div>';
    return;
  }
  for (var i = 0; i < filtered.length; i++) {
    var a = filtered[i];
    var progress = achState[a.id] || 0;
    var done = progress >= a.goal;
    var pct = Math.min(100, Math.round((progress / a.goal) * 100));
    var row = document.createElement("div");
    row.className = "ach-row" + (done ? " completed" : "");
    row.innerHTML =
      '<span class="ach-icon">' + (a.icon || "\uD83C\uDFC6") + '</span>' +
      '<div class="ach-info"><div class="ach-name">' + esc(a.name) + '</div><div class="ach-desc">' + esc(a.desc) + '</div></div>' +
      '<div class="ach-progress">' + (done ? "\u2713" : progress + "/" + a.goal) +
      '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="font-size:0.55rem;color:var(--sea)">+' + a.xp + ' XP</div></div>';
    listEl.appendChild(row);
  }
}
