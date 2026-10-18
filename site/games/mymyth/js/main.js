import {
  state, setState, defaultStateTemplate, setDefaultStateTemplate,
  pendingReincarnationBonus, setPendingReincarnationBonus,
  pendingReincarnationInventory, setPendingReincarnationInventory,
  pendingCompanionCarry, setPendingCompanionCarry,
  battleActive, setBattleActive, petSleepActive, companionSleepActive, developerMode, setDeveloperMode,
  treeLoreModalKey, treeLoreModalLineId, clamp, escapeHtml,
  saveGameState, loadSavedGame, clearSaveState, setOnCloudSaveHook,
  resetDeveloperSessionFlags, devKonamiTap, isDevKonamiPortraitPhase,
  isTreeNodeUnlocked, unlockTreeNode,
  legacyScoreFromState, computeReincarnationBonus, legacyEpigraph, legacyMedals,
  getActiveMyth, getActiveSlot,
} from './state.js';

import {
  LINES, FOODS, RELIC_ITEMS, PERMIT_ITEMS, REGIONS, REGION_LABEL, REGION_COLOR,
  loadGameData, randomLineId, line, nodeByKey, getCurrentNode,
  lineFor, formLineFor, formLineIdFor,
  petArtHtml,
  ensureFoodInventoryState, ensureRelicInventoryState, ensurePermitInventoryState,
} from './data.js';

import {
  els, bindEls, renderPet, renderLog, pushLog, setBar,
  closeLairSubpanels, openLairVitalsPanel, openLairEvolutionPanel,
  pickLineCards, setStartGameFn, openDevModeEntryModal, closeDevModeEntryModal,
  showConfirm, switchMythTab,
} from './ui.js';

import {
  startLairAmbient, stopLairAmbient, installAudioUserGestureUnlock, setSoundEnabled,
  startCityMapBgm, stopCityMapBgm, playDailyQuestCompleteSfx,
} from './audio.js';

import {
  cancelPetSleepSilent, clearDemandWindowTimers, clearSpiritBerryTimers,
  stopDemandAttentionLoop, stopPassiveHungerTimer, stopLifespanDemandTimer,
  startPassiveHungerTimer, startLifespanDemandTimer,
  updateSpiritBerryUi, pickSpiritBerry, shakeBerryBush,
  registerLairInteractable, dispatchLairInteractableHit,
  openFoodChoiceModal, closeFoodChoiceModal, consumeFoodById,
  openRelicInventoryModal, closeRelicInventoryModal,
  openRelicConsumeConfirm, closeRelicConsumeModal, confirmPendingRelicConsume,
  tryRequestPetSleep, onPetPortraitPointer,
  resolveDemandIndulge, resolveDemandDiscipline, clearDemand, startDemandResponseTimer,
  closeDeathLegacyAndGoPick,
  startPlayBall, resumePlayCooldownIfNeeded, refreshPlayBallButton,
  refreshBondButton,
  setCareTargetSlot,
  enqueueEvolutionJob,
} from './care.js';

import {
  setupAdventureControl, startAdventure,
  restartPetIdle, stopPetIdle, flashPetMoodPopup,
  ensureStatBonusRespectsBpCap, combatStatsForPet,
} from './combat.js';

import {
  canEvolve, getEvolvableChoiceKeys, getEvolutionChoices, globalEvolveGatesMet,
  openEvolvePreviewModal, closeEvolvePreviewModal,
  renderAndOpenEvolvePickModal, closeEvolvePickModal,
  playEvolveAscendSequence,
  renderTree, renderTreeInto, openTreeLoreModal, closeTreeLoreModal,
  openTreeNodeCompareModal, closeTreeCompareModal,
  applyDevEvolveToKey,
  setOnAscendHook,
} from './evolution.js';

import { toggleAutoCare, isAutoCareEnabled, stopAutoCare } from './auto-care.js';
import {
  handleDailyRollover,
  canClaimToday,
  claimToday,
  getCellsForUi,
  getCurrentDay,
  ensureDailiesState,
} from './dailies.js';
import { startLairEvents, stopLairEvents, hideLairEventBanner } from './lair-events.js';
import { openLegacyTimeline, closeLegacyTimeline } from './legacy-timeline.js';
import { unlockCompanionSlot, getMythBySlot } from './state.js';
import { triggerManualPlay, setMythInteractionHelpers, triggerDuoBond, canDuoBond } from './myth-interaction.js';
import { initFirebaseAuth, initAuthScreen, doLogout } from './auth.js';
import { loadCloudSave, pickNewerSave, debouncedCloudSave } from './cloud-save.js';
import { getLocalProfile, syncMythSnapshot } from './player-profile.js';
import { startFriendsListener, stopFriendsListener } from './friends.js';
import { startChallengeListener, stopChallengeListener } from './pvp.js';
import { wireProfileModal, wireFriendsModal, wirePvpModal, wireLevelUpModal, openProfileModal, openFriendsModal, openPvpModal, wireAvatarPicker, wireAchievementModal, initAchievementToast, setOnLevelUpHook, refreshLairProfileButtonAvatar } from './online-ui.js';
import {
  loadAchievements,
  checkAchievement,
  incrementAchievement,
  checkTieredAchievements,
  refreshOnlineTierAchievements,
  refreshPvpAchievementTiers,
  applyLevelUpAchievements,
} from './achievements.js';

function _renderDailiesGrid() {
  const grid = els.dailiesGrid;
  if (!grid || !state) return;
  ensureDailiesState(state);
  const cells = getCellsForUi(state);
  grid.innerHTML = cells.map(function (c) {
    const isMilestone = c.day % 5 === 0;
    const classes = [
      'dailies-cell',
      c.status,
      isMilestone ? 'milestone' : '',
    ].filter(Boolean).join(' ');
    return (
      '<div class="' + classes + '" role="listitem" aria-label="Day ' + c.day + ' — ' + c.descriptor.label + '">' +
        '<span class="dailies-cell-day">Day ' + c.day + '</span>' +
        '<span class="dailies-cell-icon" aria-hidden="true">' + c.descriptor.icon + '</span>' +
        '<span class="dailies-cell-amt">' + c.descriptor.amount + '</span>' +
      '</div>'
    );
  }).join('');
  const collectBtn = els.dailiesCollect;
  const claimable = canClaimToday(state);
  if (collectBtn) {
    collectBtn.disabled = !claimable;
    collectBtn.textContent = claimable ? 'Claim Day ' + getCurrentDay(state) + ' Bonus' : 'Come back tomorrow';
  }
  const sub = els.dailiesSubtitle;
  if (sub) {
    const streak = (state.dailies && state.dailies.streak) || 0;
    sub.textContent = streak + '-day streak · Miss a day and it resets.';
    const progressLabel = document.getElementById('dailies-progress-label');
    const progressFill = document.getElementById('dailies-progress-fill');
    if (progressLabel) progressLabel.textContent = streak + ' / 30 days';
    if (progressFill) progressFill.style.width = Math.min(100, (streak / 30) * 100) + '%';
  }
}

function _openDailiesModal() {
  if (!els.modalDailies) return;
  _renderDailiesGrid();
  els.modalDailies.classList.add('open');
}

function _closeDailiesModal() {
  if (els.modalDailies) els.modalDailies.classList.remove('open');
}

function _refreshDailiesButton() {
  if (!state) return;
  ensureDailiesState(state);
  const badge = els.dailiesBadge;
  if (!badge) return;
  const show = canClaimToday(state);
  badge.hidden = !show;
}

function _handleDailiesCollect() {
  if (!state) return;
  const result = claimToday(state);
  if (!result) return;
  const day = result.day;
  const r = result.reward;
  const parts = [];
  if (r.foods.length) parts.push(r.foods.length + ' food');
  if (r.relics.length) parts.push(r.relics.length + ' relic');
  if (r.balls) parts.push(r.balls + ' play ball');
  if (r.stamina) parts.push('+' + r.stamina + ' stamina');
  if (r.pitis) parts.push(r.pitis + ' Pitis');
  if (r.tickets) parts.push(r.tickets + ' Silver Ticket');
  pushLog('Daily reward (day ' + day + ') claimed: ' + parts.join(', ') + '.');
  checkAchievement("sec_first_daily", 1);
  checkTieredAchievements("daily_streak", (state.dailies && state.dailies.streak) || 0);
  try { playDailyQuestCompleteSfx(); } catch (e) {}
  _renderDailiesGrid();
  _refreshDailiesButton();
  saveGameState();
}

function tryEnterFullscreen() {
  var el = document.documentElement;
  var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (req && !document.fullscreenElement && !document.webkitFullscreenElement) {
    req.call(el).catch(function () {});
  }
}

function tryExitFullscreen() {
  var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
    exit.call(document).catch(function () {});
  }
}

function syncFullscreenButton() {
  var btn = document.getElementById('btn-fullscreen');
  if (!btn) return;
  var inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  btn.classList.toggle('is-fullscreen', inFs);
  btn.setAttribute('aria-label', inFs ? 'Exit fullscreen' : 'Enter fullscreen');
  btn.title = inFs ? 'Exit fullscreen' : 'Enter fullscreen';
}

function startGame(lineId) {
  stopAutoCare();
  stopLairEvents();
  document.body.classList.remove("dev-mode");
  if (els.btnAutoCare) els.btnAutoCare.classList.remove("auto-care-active");
  resetDeveloperSessionFlags();
  cancelPetSleepSilent();
  clearDemandWindowTimers();
  clearSpiritBerryTimers();
  const lid = lineId && LINES[lineId] ? lineId : randomLineId();
  const fromFate = !lineId || !LINES[lineId];
  const inherited = pendingReincarnationBonus;
  setPendingReincarnationBonus(null);
  const carriedInv = pendingReincarnationInventory;
  setPendingReincarnationInventory(null);
  const carriedCompanion = pendingCompanionCarry;
  setPendingCompanionCarry(null);
  setState(JSON.parse(JSON.stringify(defaultStateTemplate)));
  state.lineId = lid;
  if (carriedInv && carriedInv.food && carriedInv.relic) {
    state.foodInventory = JSON.parse(JSON.stringify(carriedInv.food));
    state.relicInventory = JSON.parse(JSON.stringify(carriedInv.relic));
  }
  ensureFoodInventoryState();
  ensureRelicInventoryState();
  ensurePermitInventoryState();
  if (carriedCompanion && carriedCompanion.lineId) {
    state.companion = JSON.parse(JSON.stringify(carriedCompanion));
    state.slot2Unlocked = true;
  }
  if (inherited && inherited.hp + inherited.atk + inherited.spd > 0) {
    state.reincarnationBonus = {
      hp: inherited.hp || 0,
      atk: inherited.atk || 0,
      spd: inherited.spd || 0,
    };
  }
  state.log = [
    fromFate
      ? "Fate chose the " + LINES[lid].title + ". Raise your myth!"
      : "You chose the " + LINES[lid].title + ". Raise your myth!",
  ];
  if (inherited && inherited.hp + inherited.atk + inherited.spd > 0) {
    state.log.unshift(
      "A new life begins, carrying +" +
        state.reincarnationBonus.hp + " HP, +" +
        state.reincarnationBonus.atk + " Atk, +" +
        state.reincarnationBonus.spd + " Spd from your previous myth's echo."
    );
  }
  if (carriedInv && carriedInv.food && carriedInv.relic) {
    state.log.push("Your pantry and relic offerings cross the veil with you — inventory preserved.");
  }
  if (carriedCompanion && carriedCompanion.lineId) {
    state.log.push("Your companion myth still walks the lair, awaiting your return.");
  }
  els.screenPick.classList.remove("active");
  els.screenGame.classList.add("active");
  tryEnterFullscreen();
  setupAdventureControl();
  unlockTreeNode(lid, state.nodeKey);
  renderLog();
  renderPet();
  refreshPlayBallButton();
  startPassiveHungerTimer();
  startLifespanDemandTimer();
  try { stopCityMapBgm(); } catch (e) {}
  startLairAmbient(lid);
  startLairEvents();
  document.body.classList.toggle("has-companion", !!(state.companion && state.companion.lineId));
  handleDailyRollover(state);
  checkGuildDailyReset(state);
  _refreshDailiesButton();
  saveGameState();
  try {
    checkAchievement("sec_first_myth", 1);
    if (lid === "guardian") checkAchievement("sec_guardian", 1);
    if (lid === "avian") checkAchievement("sec_avian", 1);
    if (lid === "serpent") checkAchievement("sec_serpent", 1);
  } catch (e) {}
}

function resumeSavedGame(snapshot) {
  setState(JSON.parse(JSON.stringify(snapshot.state)));
  if (window.MythalaCity) window.MythalaCity.ensureFields(state);
  ensureFoodInventoryState();
  ensureRelicInventoryState();
  ensurePermitInventoryState();
  // Migration: older saves can contain active forms without matching tree unlock records.
  // Keep Lore Keeper Bestiary and Evolution pages aligned with myths already owned.
  if (state && state.lineId && state.nodeKey) {
    unlockTreeNode(state.crossLineageId || state.lineId, state.nodeKey);
  }
  if (state && state.companion && state.companion.lineId && state.companion.nodeKey) {
    unlockTreeNode(state.companion.crossLineageId || state.companion.lineId, state.companion.nodeKey);
  }
  if (snapshot.reincarnationBonus) {
    setPendingReincarnationBonus(snapshot.reincarnationBonus);
  }
  if (snapshot.reincarnationInventory) {
    setPendingReincarnationInventory(snapshot.reincarnationInventory);
  }
  if (state.spiritBerryRipeAt != null && state.spiritBerryRipeAt < Date.now()) {
    state.spiritBerryRipeAt = Date.now();
  }
  state.demand = null;
  els.screenPick.classList.remove("active");
  els.screenGame.classList.add("active");
  tryEnterFullscreen();
  setupAdventureControl();
  renderLog();
  renderPet();
  startPassiveHungerTimer();
  startLifespanDemandTimer();
  updateSpiritBerryUi();
  resumePlayCooldownIfNeeded();
  restartPetIdle();
  pushLog("Your myth stirs — the journey continues where you left off.");
  startLairEvents();
  document.body.classList.toggle("has-companion", !!(state.companion && state.companion.lineId));
  handleDailyRollover(state);
  checkGuildDailyReset(state);
  _refreshDailiesButton();
  // Mythala City: show Home Screen with city BGM (navigateTo("home") starts it via enterHome). Otherwise fall back to lair ambient.
  if (window.MythalaCity) {
    window.MythalaCity.navigateTo("home");
  } else {
    startLairAmbient(state.lineId);
  }
}

const SETTINGS_KEYS = ["soundEnabled", "reducedMotion", "notificationsEnabled"];

function _loadSettings() {
  try { return JSON.parse(localStorage.getItem("mymyth_settings") || "{}"); } catch (e) { return {}; }
}
function _saveSettings(s) {
  try { localStorage.setItem("mymyth_settings", JSON.stringify(s)); } catch (e) {}
}

function _openSettingsModal() {
  var modal = document.getElementById("modal-settings");
  if (!modal) return;
  var s = _loadSettings();
  SETTINGS_KEYS.forEach(function (key) {
    var el = modal.querySelector("[data-key='" + key + "']");
    if (!el) return;
    var val = s[key] !== undefined ? !!s[key] : (key === "soundEnabled");
    el.setAttribute("aria-pressed", String(val));
  });
  modal.classList.add("open");
}

function _closeSettingsModal() {
  var modal = document.getElementById("modal-settings");
  if (modal) modal.classList.remove("open");
}

function _wireSettingsModal() {
  var modal = document.getElementById("modal-settings");
  if (!modal) return;
  var closeBtn = document.getElementById("modal-settings-close");
  if (closeBtn) closeBtn.addEventListener("click", _closeSettingsModal);
  SETTINGS_KEYS.forEach(function (key) {
    var btn = modal.querySelector("[data-key='" + key + "']");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = btn.getAttribute("aria-pressed") === "true";
      var next = !cur;
      btn.setAttribute("aria-pressed", String(next));
      var s = _loadSettings();
      s[key] = next;
      _saveSettings(s);
      if (key === "soundEnabled") setSoundEnabled(next);
    });
  });
  var returnBtn = document.getElementById("settings-return-start");
  if (returnBtn) {
    returnBtn.addEventListener("click", function () {
      _closeSettingsModal();
      _startNewLineage();
    });
  }
  var clearBtn = document.getElementById("settings-clear-data");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      showConfirm("Clear all saved data? This cannot be undone.", function () {
        _closeSettingsModal();
        clearSaveState();
        try { localStorage.removeItem("mymyth_settings"); } catch (e) {}
        _startNewLineage();
      });
    });
  }
  var codeBtn = document.getElementById("settings-enter-code");
  if (codeBtn) codeBtn.addEventListener("click", _openEnterCodeModal);
}

function _openEnterCodeModal() {
  var modal = document.getElementById("modal-enter-code");
  if (!modal) return;
  var input = document.getElementById("enter-code-input");
  var fb = document.getElementById("enter-code-feedback");
  if (input) input.value = "";
  if (fb) { fb.textContent = ""; fb.style.color = ""; }
  modal.classList.add("open");
  setTimeout(function () { if (input) { input.focus(); try { input.click(); } catch (e) {} } }, 30);
}

function _closeEnterCodeModal() {
  var modal = document.getElementById("modal-enter-code");
  if (modal) modal.classList.remove("open");
}

// ── Guild Daily Tasks ─────────────────────────────────────────────────────
var GUILD_TASK_POOL = [
  { id: 'login',   label: 'Log in today',               pitis: 10, xp: 20 },
  { id: 'feed',    label: 'Feed your myth',              pitis: 15, xp: 25 },
  { id: 'rest',    label: 'Rest your myth',              pitis: 10, xp: 15 },
  { id: 'play',    label: 'Play with your myth',         pitis: 15, xp: 20 },
  { id: 'battle',  label: 'Send myth on an adventure',   pitis: 20, xp: 30 },
  { id: 'vitals',  label: "Check your myth's vitals",    pitis: 5,  xp: 10 },
  { id: 'relic',   label: 'Use a relic',                 pitis: 15, xp: 20 },
  { id: 'market',  label: 'Visit the market',            pitis: 5,  xp: 15 },
  { id: 'pvp',     label: 'Enter the PvP arena',         pitis: 10, xp: 15 },
  { id: 'dailies', label: 'Open Daily Login Bonus',      pitis: 10, xp: 20 },
];

function _guildTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _guildPickTasks(dateStr) {
  var hash = 0;
  for (var i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  var pool = GUILD_TASK_POOL.slice();
  var seed = (Math.abs(hash) || 1) >>> 0;
  function lcg() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; }
  for (var j = pool.length - 1; j > 0; j--) {
    var k = Math.floor(lcg() * (j + 1));
    var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp;
  }
  return pool.slice(0, 3).map(function (t) {
    return { id: t.id, label: t.label, pitis: t.pitis, xp: t.xp, done: false };
  });
}

function checkGuildDailyReset(st) {
  if (!st) return;
  if (!st.guildMissions || typeof st.guildMissions !== 'object') {
    st.guildMissions = { daily: [], dailyDate: null, weekly: [], bounties: [] };
  }
  if (!('dailyDate' in st.guildMissions)) st.guildMissions.dailyDate = null;
  var today = _guildTodayStr();
  if (st.guildMissions.dailyDate !== today) {
    st.guildMissions.daily = _guildPickTasks(today);
    st.guildMissions.dailyDate = today;
    var loginTask = st.guildMissions.daily.find(function (t) { return t.id === 'login'; });
    if (loginTask) loginTask.done = true;
  }
}

function completeGuildTask(taskId) {
  if (!state || !state.guildMissions || !Array.isArray(state.guildMissions.daily)) return;
  var task = state.guildMissions.daily.find(function (t) { return t.id === taskId; });
  if (!task || task.done) return;
  task.done = true;
  state.pitis = (state.pitis || 0) + task.pitis;
  awardXp(task.xp).catch(function () {});
  saveGameState();
  _updateGuildDailyUI();
}

function _updateGuildDailyUI() {
  if (!state || !state.guildMissions || !Array.isArray(state.guildMissions.daily)) return;
  var tasks = state.guildMissions.daily;
  var done = tasks.filter(function (t) { return t.done; }).length;
  var dailyEl = document.getElementById('mc-daily');
  if (dailyEl) {
    dailyEl.textContent = '📋 Daily tasks ' + done + '/' + tasks.length +
      (done >= tasks.length ? ' — all done! ✅' : ' — visit the Guild Hall');
  }
  try { if (window.MythalaCity && window.MythalaCity.updatePitis) window.MythalaCity.updatePitis(); } catch (e) {}
  var listEl = document.getElementById('mc-guild-daily-list');
  if (listEl) _renderGuildDailyList(listEl);
  var ctrEl = document.getElementById('mc-guild-daily-counter');
  if (ctrEl) ctrEl.textContent = done + '/' + tasks.length;
}

function _renderGuildDailyList(listEl) {
  if (!listEl || !state || !state.guildMissions || !Array.isArray(state.guildMissions.daily)) return;
  var tasks = state.guildMissions.daily;
  listEl.innerHTML = tasks.map(function (t) {
    return '<div class="mc-guild-task-row' + (t.done ? ' mc-guild-task-done' : '') + '">' +
      '<span class="mc-guild-task-check">' + (t.done ? '✅' : '⬜') + '</span>' +
      '<div class="mc-guild-task-info">' +
        '<span class="mc-guild-task-label">' + t.label + '</span>' +
        '<span class="mc-guild-task-reward">+' + t.pitis + '🪙 +' + t.xp + ' XP</span>' +
      '</div>' +
    '</div>';
  }).join('');
}
// ─────────────────────────────────────────────────────────────────────────────

function _enterCodeFeedback(msg, ok) {
  var fb = document.getElementById("enter-code-feedback");
  if (!fb) return;
  fb.textContent = msg || "";
  fb.style.color = ok ? "var(--good,#7ad97a)" : "var(--bad,#e87a7a)";
}

function _submitEnteredCode() {
  var input = document.getElementById("enter-code-input");
  if (!input) return;
  var code = String(input.value || "").trim().toLowerCase();
  if (!code) { _enterCodeFeedback("Enter a code.", false); return; }
  if (code === "kulbaq") {
    if (developerMode) {
      _enterCodeFeedback("Developer mode already on.", true);
    } else {
      setDeveloperMode(true);
      document.body.classList.add("dev-mode");
      pushLog("[Dev] Developer mode on — evolution map fully unlocked for this session.");
      try { renderTree(); } catch (e) {}
      _enterCodeFeedback("Developer mode activated.", true);
    }
    setTimeout(_closeEnterCodeModal, 600);
    return;
  }
  if (code === "menjen") {
    var am = getActiveMyth();
    if (!am || !am.lineId) { _enterCodeFeedback("No active myth.", false); return; }
    var L = formLineFor(am);
    if (!L) { _enterCodeFeedback("No active myth.", false); return; }
    var choices = getEvolvableChoiceKeys(L, am.nodeKey, am);
    if (choices && choices.length) {
      _closeEnterCodeModal();
      enqueueEvolutionJob(function () { return playEvolveAscendSequence(choices[0]); });
      return;
    }
    var any = getEvolutionChoices(L, am.nodeKey);
    if (any && any.length) {
      _closeEnterCodeModal();
      applyDevEvolveToKey(any[0].key || any[0]);
      pushLog("[Dev] Forced ascend (gates bypassed).");
      return;
    }
    _enterCodeFeedback("No further form to ascend into.", false);
    return;
  }
  _enterCodeFeedback("Invalid code.", false);
}

function _wireEnterCodeModal() {
  var modal = document.getElementById("modal-enter-code");
  if (!modal) return;
  var closeBtn = document.getElementById("modal-enter-code-close");
  var cancelBtn = document.getElementById("enter-code-cancel");
  var submitBtn = document.getElementById("enter-code-submit");
  var input = document.getElementById("enter-code-input");
  if (closeBtn) closeBtn.addEventListener("click", _closeEnterCodeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", _closeEnterCodeModal);
  if (submitBtn) submitBtn.addEventListener("click", _submitEnteredCode);
  if (input) {
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); _submitEnteredCode(); }
      else if (ev.key === "Escape") { ev.preventDefault(); _closeEnterCodeModal(); }
    });
  }
  modal.addEventListener("click", function (ev) {
    if (ev.target === modal) _closeEnterCodeModal();
  });
}

function _openCompanionPickModal() {
  if (!els.modalCompanionPick || !els.companionPickOptions) return;
  // Build line cards excluding the player's current lineId
  const lineIds = Object.keys(LINES || {});
  els.companionPickOptions.innerHTML = lineIds.map(function (lid) {
    const L = LINES[lid];
    const hero = L && L.hero ? '<span class="companion-pick-emoji">' + (L.hero.emoji || "❓") + '</span>' : '';
    return '<button type="button" class="companion-pick-btn" data-line-id="' + lid + '">' +
      hero + '<span class="companion-pick-name">' + (L ? L.title : lid) + '</span></button>';
  }).join('');
  els.modalCompanionPick.classList.add('open');
}

function _mythDisplayName(mythObj) {
  if (!mythObj || !mythObj.lineId) return "Myth";
  const fLid = mythObj.crossLineageId || mythObj.lineId;
  const L = LINES[fLid];
  const n = L && getCurrentNode(L, mythObj.nodeKey);
  return n ? n.name : (L ? L.title : "Myth");
}

function _mythDisplayRarity(mythObj) {
  if (!mythObj || !mythObj.lineId) return "";
  const fLid = mythObj.crossLineageId || mythObj.lineId;
  const L = LINES[fLid];
  const n = L && getCurrentNode(L, mythObj.nodeKey);
  return n ? n.rarity : "";
}

let _mythPickerCallback = null;

function _openMythPicker(callback) {
  if (!els.modalMythPicker || !els.mythPickerSlot0 || !els.mythPickerSlot1) {
    callback(0);
    return;
  }
  const hasCompanion = !!(state && state.companion && state.companion.lineId);
  if (!hasCompanion) {
    callback(0);
    return;
  }
  const n0 = _mythDisplayName(state);
  const r0 = _mythDisplayRarity(state);
  const n1 = _mythDisplayName(state.companion);
  const r1 = _mythDisplayRarity(state.companion);
  els.mythPickerSlot0.innerHTML =
    '<span class="picker-myth-name">' + escapeHtml(n0) + '</span>' +
    (r0 ? '<span class="picker-myth-rarity">' + escapeHtml(r0) + '</span>' : '');
  els.mythPickerSlot1.innerHTML =
    '<span class="picker-myth-name">' + escapeHtml(n1) + '</span>' +
    (r1 ? '<span class="picker-myth-rarity">' + escapeHtml(r1) + '</span>' : '');
  _mythPickerCallback = callback;
  els.modalMythPicker.classList.add('open');
}

function _closeMythPicker() {
  if (els.modalMythPicker) els.modalMythPicker.classList.remove('open');
  _mythPickerCallback = null;
}

function _withMythPicker(callback) {
  const hasCompanion = !!(state && state.companion && state.companion.lineId);
  if (!hasCompanion) {
    setCareTargetSlot(0);
    callback();
    return;
  }
  _openMythPicker(function (slot) {
    _closeMythPicker();
    setCareTargetSlot(slot);
    callback();
  });
}

function _startNewLineage() {
  showConfirm(
    "Start New Lineage",
    "Starting a new lineage will abandon your current myth. No inheritance bonus (HP, Atk, Spd) or inventory will be carried over. This cannot be undone.",
    function () {
      stopAutoCare();
      stopLairEvents();
      document.body.classList.remove("dev-mode");
      if (els.btnAutoCare) els.btnAutoCare.classList.remove("auto-care-active");
      resetDeveloperSessionFlags();
      cancelPetSleepSilent();
      clearDemandWindowTimers();
      clearSpiritBerryTimers();
      if (els.lairDropLayer) els.lairDropLayer.innerHTML = "";
      if (els.petPortrait) {
        els.petPortrait.style.removeProperty("--lair-relic-glow");
        els.petPortrait.style.removeProperty("--lair-relic-glow-soft");
        els.petPortrait.removeAttribute("data-influence-region");
        const idleC = els.petPortrait.querySelector(".pet-portrait-idle-content");
        if (idleC) {
          idleC.classList.remove("anim-lair-feed-munch", "anim-lair-relic-influence-inner", "anim-lair-curious-vfx");
        }
        const idleL = els.petPortrait.querySelector(".pet-portrait-idle");
        if (idleL) idleL.style.transform = "";
      }
      stopPassiveHungerTimer();
      stopLifespanDemandTimer();
      stopLairAmbient();
      try { stopCityMapBgm(); } catch (e) {}
      setPendingReincarnationBonus(null);
      setPendingReincarnationInventory(null);
      clearSaveState();
      closeLairSubpanels();
      closeDevModeEntryModal();
      els.screenGame.classList.remove("active");
      els.screenPick.classList.add("active");
    }
  );
}

function wireUi() {
  var btnFs = document.getElementById('btn-fullscreen');
  if (btnFs) {
    btnFs.addEventListener('click', function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        tryExitFullscreen();
      } else {
        tryEnterFullscreen();
      }
    });
  }
  document.addEventListener('fullscreenchange', syncFullscreenButton);
  document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

  if (els.btnRandomMyth) {
    els.btnRandomMyth.addEventListener("click", () => startGame(null));
  }

  if (els.modalFoodChoiceList) {
    els.modalFoodChoiceList.addEventListener("click", function (ev) {
      const btn = ev.target.closest("[data-food-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-food-id");
      if (id) { consumeFoodById(id); completeGuildTask('feed'); }
    });
  }
  if (els.modalFoodChoiceClose) els.modalFoodChoiceClose.addEventListener("click", closeFoodChoiceModal);
  if (els.modalFoodChoiceCancel) els.modalFoodChoiceCancel.addEventListener("click", closeFoodChoiceModal);
  if (els.modalFoodChoice) {
    els.modalFoodChoice.addEventListener("click", function (ev) {
      if (ev.target === els.modalFoodChoice) closeFoodChoiceModal();
    });
  }

  if (els.btnRelicInventory) {
    els.btnRelicInventory.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (battleActive || !state.lineId) return;
      setCareTargetSlot(state.activeMythTab || 0);
      openRelicInventoryModal();
    });
  }
  if (els.relicInventoryList) {
    els.relicInventoryList.addEventListener("click", function (ev) {
      const btn = ev.target.closest("button[data-relic-id]");
      if (!btn || btn.disabled) return;
      const id = btn.getAttribute("data-relic-id");
      if (id) openRelicConsumeConfirm(id);
    });
  }
  if (els.modalRelicInventoryClose) els.modalRelicInventoryClose.addEventListener("click", closeRelicInventoryModal);
  if (els.modalRelicInventoryCancel) els.modalRelicInventoryCancel.addEventListener("click", closeRelicInventoryModal);
  if (els.modalRelicInventory) {
    els.modalRelicInventory.addEventListener("click", function (ev) {
      if (ev.target === els.modalRelicInventory) closeRelicInventoryModal();
    });
  }
  if (els.modalRelicConsumeClose) els.modalRelicConsumeClose.addEventListener("click", closeRelicConsumeModal);
  if (els.modalRelicConsumeCancel) els.modalRelicConsumeCancel.addEventListener("click", closeRelicConsumeModal);
  if (els.modalRelicConsumeConfirm) els.modalRelicConsumeConfirm.addEventListener("click", function () { confirmPendingRelicConsume(); completeGuildTask('relic'); });
  if (els.modalRelicConsume) {
    els.modalRelicConsume.addEventListener("click", function (ev) {
      if (ev.target === els.modalRelicConsume) closeRelicConsumeModal();
    });
  }

  if (els.btnFeed) {
    els.btnFeed.addEventListener("click", (ev) => {
      ev.stopPropagation();
      setCareTargetSlot(state.activeMythTab || 0);
      openFoodChoiceModal(null);
    });
  }

  if (els.lairBerryBush) {
    let _lastBushTapAt = 0;
    const tapBush = function (ev) {
      if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      const now = Date.now();
      if (now - _lastBushTapAt < 400) return;
      _lastBushTapAt = now;
      if (!state || !state.lineId) return;
      shakeBerryBush();
      if (!els.lairBerryBush.classList.contains("lair-berry-bush--ripe")) {
        pushLog("Berry bush is still growing — wait for the fruit.");
        return;
      }
      setCareTargetSlot(state.activeMythTab || 0);
      pickSpiritBerry();
    };
    els.lairBerryBush.addEventListener("click", tapBush);
    els.lairBerryBush.addEventListener("pointerdown", tapBush);
    els.lairBerryBush.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
        ev.preventDefault();
        tapBush(ev);
      }
    });
    registerLairInteractable(els.lairBerryBush, tapBush);
  }

  if (els.btnPlay) {
    els.btnPlay.addEventListener("click", function (ev) {
      ev.stopPropagation();
      startPlayBall();
      completeGuildTask('play');
    });
  }

  if (els.btnBond) {
    els.btnBond.addEventListener("click", function (ev) {
      ev.stopPropagation();
      const outcome = triggerDuoBond();
      if (outcome === "no_companion") {
        pushLog("You need a companion myth in the lair to bond.");
      } else if (outcome === "lair_busy") {
        pushLog("Not a good moment — the lair is busy.");
      } else if (outcome === "no_balls") {
        pushLog("You need at least one play ball to bond.");
      } else if (outcome === "too_far") {
        pushLog("Your myths are too far apart — wait for them to drift closer.");
      }
      refreshBondButton();
    });
  }

  if (els.mythDuoLabel0) {
    els.mythDuoLabel0.addEventListener("click", function () {
      if (!state || !state.lineId) return;
      switchMythTab(0);
      setCareTargetSlot(0);
    });
  }
  if (els.mythDuoLabel1) {
    els.mythDuoLabel1.addEventListener("click", function () {
      if (!state || !state.lineId) return;
      if (state.companion && state.companion.lineId) {
        switchMythTab(1);
        setCareTargetSlot(1);
      } else if (state.slot2Unlocked) {
        _openCompanionPickModal();
      }
    });
  }

  var btnProfile = document.getElementById("btn-profile");
  var btnFriends = document.getElementById("btn-friends");
  var btnPvp = document.getElementById("btn-pvp");
  var btnSettings = document.getElementById("btn-settings");
  if (btnProfile) btnProfile.addEventListener("click", function () { openProfileModal(); });
  if (btnFriends) btnFriends.addEventListener("click", function () { openFriendsModal(); });
  if (btnPvp) btnPvp.addEventListener("click", function () { openPvpModal(); completeGuildTask('pvp'); });
  if (btnSettings) btnSettings.addEventListener("click", function () { _openSettingsModal(); });

  // Profile — restart lineage button (same logic as old btn-new-pet)
  var btnProfileNewPet = document.getElementById("btn-profile-new-pet");
  if (btnProfileNewPet) {
    btnProfileNewPet.addEventListener("click", function () {
      var profileModal = document.getElementById("modal-profile");
      if (profileModal) profileModal.classList.remove("open");
      _startNewLineage();
    });
  }

  els.btnRest.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (petSleepActive) return;
    setCareTargetSlot(state.activeMythTab || 0);
    tryRequestPetSleep(state.activeMythTab || 0);
    completeGuildTask('rest');
  });

  if (els.petPortrait) {
    els.petPortrait.addEventListener("click", function (ev) {
      if (isDevKonamiPortraitPhase()) {
        ev.preventDefault();
        ev.stopPropagation();
        devKonamiTap("portrait", openDevModeEntryModal);
        return;
      }
    }, true);
    els.petPortrait.addEventListener("click", function(ev) { onPetPortraitPointer(ev, 0); });
    els.petPortrait.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      if (battleActive || !state.lineId) return;
      const r = els.petPortrait.getBoundingClientRect();
      onPetPortraitPointer({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, 0);
    });
  }
  // Companion portrait petting (slot 1)
  if (els.petPortraitCompanion) {
    els.petPortraitCompanion.addEventListener("click", function (ev) {
      if (!state || !state.companion || !state.companion.lineId) return;
      onPetPortraitPointer(ev, 1);
    });
  }

  // Global safety net: lair interactables sit behind portraits/interaction zones
  // and often lose clicks to stacking. The dispatcher coord-tests against every
  // registered lair object and reroutes the tap. skipDirectHit avoids double-firing
  // when the click already hit the interactable's own element.
  document.addEventListener("click", function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest("#lair-vitals-mini")) return;
    if (dispatchLairInteractableHit(ev, { skipDirectHit: true })) {
      ev.stopPropagation();
    }
  }, true);

  els.btnEvolve.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const am = getActiveMyth();
    const Ln = formLineFor(am);
    if (!Ln || !am) return;
    const choices = getEvolvableChoiceKeys(Ln, am.nodeKey, am);
    if (!choices.length) {
      const any = getEvolutionChoices(Ln, am.nodeKey);
      if (any.length && globalEvolveGatesMet(am)) {
        pushLog("Discipline or regional influence falls short of every open path — check the evolution map, demands, battles, and relic inventory.");
      }
      return;
    }
    if (choices.length === 1) {
      openEvolvePreviewModal(Ln, choices[0]);
      return;
    }
    renderAndOpenEvolvePickModal(Ln, choices);
  });

  if (els.modalEvolvePickOptions) {
    els.modalEvolvePickOptions.addEventListener("click", function (ev) {
      const card = ev.target.closest(".evolve-pick-card");
      if (!card) return;
      const nk = card.getAttribute("data-pick-key");
      if (!nk) return;
      closeEvolvePickModal();
      const amNow = getActiveMyth();
      openEvolvePreviewModal(formLineFor(amNow), nk);
    });
  }
  if (els.modalEvolvePickClose) els.modalEvolvePickClose.addEventListener("click", closeEvolvePickModal);
  if (els.modalEvolvePickCancel) els.modalEvolvePickCancel.addEventListener("click", closeEvolvePickModal);
  if (els.modalEvolveHalt) els.modalEvolveHalt.addEventListener("click", closeEvolvePreviewModal);

  els.modalEvolveOk.addEventListener("click", () => {
    const nk = els.modalEvolve.dataset.nextKey;
    closeEvolvePreviewModal();
    if (nk) {
      enqueueEvolutionJob(function () { return playEvolveAscendSequence(nk); });
    } else {
      renderPet();
    }
  });

  if (els.btnNewPet) els.btnNewPet.addEventListener("click", _startNewLineage);

  if (els.btnLairVitals) {
    els.btnLairVitals.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (!state.lineId) return;
      openLairVitalsPanel();
      completeGuildTask('vitals');
    });
  }
  if (els.lairVitalsMini) {
    const openMiniVitals = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!state.lineId) return;
      openLairVitalsPanel();
      completeGuildTask('vitals');
    };
    els.lairVitalsMini.addEventListener("click", openMiniVitals);
    els.lairVitalsMini.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      openMiniVitals(ev);
    });
    // Portrait interaction layers overlap this card on small screens. Route taps by
    // its visible bounds before those layers consume pointer input.
    document.addEventListener("pointerdown", function (ev) {
      if (document.body.classList.contains("lair-subpanel-open")) return;
      if (document.querySelector(".modal-overlay.open")) return;
      const r = els.lairVitalsMini.getBoundingClientRect();
      if (!r.width || !r.height || ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
      openMiniVitals(ev);
    }, true);
  }
  if (els.btnLairEvolution) {
    els.btnLairEvolution.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (!state.lineId) return;
      openLairEvolutionPanel();
    });
  }
  if (els.btnLairCloseVitals) els.btnLairCloseVitals.addEventListener("click", closeLairSubpanels);
  if (els.btnLairCloseEvolution) els.btnLairCloseEvolution.addEventListener("click", closeLairSubpanels);

  if (els.btnDemandIndulge) {
    els.btnDemandIndulge.addEventListener("click", function () {
      const d = state.demand;
      if (d && d.kind === "meal") {
        openFoodChoiceModal(function () {
          state.lifespan = clamp(state.lifespan + 6, 0, 100);
          state.happiness = clamp(state.happiness + 10, 0, 100);
          pushLog("The demanded feast is answered — need and spirit both ease.");
          clearDemand();
          setTimeout(function () { flashPetMoodPopup("🥰"); }, 900);
        });
        return;
      }
      resolveDemandIndulge();
    });
  }
  if (els.btnDemandDiscipline) {
    els.btnDemandDiscipline.addEventListener("click", function () {
      resolveDemandDiscipline();
    });
  }
  if (els.deathContinueBtn && els.modalDeathLegacy) {
    els.deathContinueBtn.addEventListener("click", function () { closeDeathLegacyAndGoPick(); });
    els.modalDeathLegacy.addEventListener("click", function (ev) {
      if (ev.target === els.modalDeathLegacy) closeDeathLegacyAndGoPick();
    });
  }

  if (els.treeContainer) {
    els.treeContainer.addEventListener("click", function (ev) {
      const hit = ev.target.closest(".tree-node-hit");
      if (!hit || !state.lineId || hit.disabled || hit.classList.contains("tree-node-hit--locked")) return;
      const nk = hit.getAttribute("data-node-key");
      const clickedLid = hit.getAttribute("data-line-id");
      const am = getActiveMyth();
      if (!am || !nk) return;
      const lid = clickedLid || am.lineId;
      if (isTreeNodeUnlocked(lid, nk)) openTreeLoreModal(nk, lid);
    });
  }
  if (els.modalTreeCompareClose) els.modalTreeCompareClose.addEventListener("click", closeTreeCompareModal);
  if (els.modalTreeCompare) {
    els.modalTreeCompare.addEventListener("click", function (ev) {
      if (ev.target === els.modalTreeCompare) closeTreeCompareModal();
    });
  }
  if (els.modalTreeLoreClose) els.modalTreeLoreClose.addEventListener("click", closeTreeLoreModal);
  if (els.modalTreeLore) {
    els.modalTreeLore.addEventListener("click", function (ev) {
      if (ev.target === els.modalTreeLore) closeTreeLoreModal();
    });
  }
  if (els.modalTreeLoreRequirements) {
    els.modalTreeLoreRequirements.addEventListener("click", function () {
      const k = treeLoreModalKey;
      closeTreeLoreModal();
      if (k) openTreeNodeCompareModal(k);
    });
  }
  if (els.mythLairTitle) {
    els.mythLairTitle.addEventListener("click", function () { devKonamiTap("lair", openDevModeEntryModal); });
  }
  if (els.modalDevModeYes) {
    els.modalDevModeYes.addEventListener("click", function () {
      setDeveloperMode(true);
      document.body.classList.add("dev-mode");
      closeDevModeEntryModal();
      pushLog("[Dev] Developer mode on — evolution map fully unlocked for this session.");
      renderTree();
    });
  }
  if (els.modalDevModeNo) els.modalDevModeNo.addEventListener("click", closeDevModeEntryModal);
  if (els.modalDevModeConfirm) {
    els.modalDevModeConfirm.addEventListener("click", function (ev) {
      if (ev.target === els.modalDevModeConfirm) closeDevModeEntryModal();
    });
  }
  if (els.modalTreeLoreDevYes) {
    els.modalTreeLoreDevYes.addEventListener("click", function () {
      const k = treeLoreModalKey;
      if (k) applyDevEvolveToKey(k, treeLoreModalLineId);
    });
  }
  if (els.modalTreeLoreDevNo) {
    els.modalTreeLoreDevNo.addEventListener("click", function () {
      if (els.modalTreeLoreDev) els.modalTreeLoreDev.setAttribute("hidden", "");
    });
  }
  if (els.btnAutoCare) {
    els.btnAutoCare.addEventListener("click", function () {
      toggleAutoCare();
      els.btnAutoCare.classList.toggle("auto-care-active", isAutoCareEnabled());
      pushLog(isAutoCareEnabled() ? "[Dev] Auto care ON." : "[Dev] Auto care OFF.");
    });
  }

  if (els.btnDevUnlockCompanion) {
    els.btnDevUnlockCompanion.addEventListener("click", function () {
      if (!state || !state.lineId) { pushLog("[Dev] No active myth."); return; }
      if (state.slot2Unlocked && state.companion && state.companion.lineId) {
        pushLog("[Dev] Companion slot already unlocked and filled."); return;
      }
      _openCompanionPickModal();
      pushLog("[Dev] Companion pick opened.");
    });
  }

  if (els.lairEventDismiss) {
    els.lairEventDismiss.addEventListener("click", hideLairEventBanner);
  }

  if (els.btnPastMyths) {
    els.btnPastMyths.addEventListener("click", openLegacyTimeline);
  }
  if (els.modalLegacyTimelineClose) {
    els.modalLegacyTimelineClose.addEventListener("click", closeLegacyTimeline);
  }
  if (els.modalLegacyTimeline) {
    els.modalLegacyTimeline.addEventListener("click", function (ev) {
      if (ev.target === els.modalLegacyTimeline) closeLegacyTimeline();
    });
  }

  if (els.btnDailies) {
    els.btnDailies.addEventListener("click", _openDailiesModal);
  }
  if (els.modalDailiesClose) {
    els.modalDailiesClose.addEventListener("click", _closeDailiesModal);
  }
  if (els.modalDailies) {
    els.modalDailies.addEventListener("click", function (ev) {
      if (ev.target === els.modalDailies) _closeDailiesModal();
    });
  }
  if (els.dailiesCollect) {
    els.dailiesCollect.addEventListener("click", _handleDailiesCollect);
  }

  // ── v2: companion demand strip buttons ──
  if (els.btnDemandIndulge1) {
    els.btnDemandIndulge1.addEventListener("click", function () { resolveDemandIndulge(1); });
  }
  if (els.btnDemandDiscipline1) {
    els.btnDemandDiscipline1.addEventListener("click", function () { resolveDemandDiscipline(1); });
  }

  // ── v2: let them play ──
  if (els.btnLetThemPlay) {
    els.btnLetThemPlay.addEventListener("click", function () {
      if (!triggerManualPlay()) {
        pushLog("No play balls available — or companion not active.");
      }
    });
  }

  // ── v2: companion pick modal ──
  if (els.companionPickOptions) {
    els.companionPickOptions.addEventListener("click", function (ev) {
      const btn = ev.target.closest("[data-line-id]");
      if (!btn) return;
      const lineId = btn.getAttribute("data-line-id");
      if (lineId && unlockCompanionSlot(lineId)) {
        if (els.modalCompanionPick) els.modalCompanionPick.classList.remove("open");
        saveGameState();
        renderPet();
        pushLog("A new companion joins your lair! Welcome, " + lineId + " myth.");
      }
    });
  }
  if (els.modalCompanionPickClose) {
    els.modalCompanionPickClose.addEventListener("click", function () {
      if (els.modalCompanionPick) els.modalCompanionPick.classList.remove("open");
    });
  }
}

/* Mythala City (M0/M1): hand the shared router a thin adapter over module state. */
function _bootMythalaCity() {
  if (!window.MythalaCity) return;
  window.MythalaCity.boot({
    getState: function () { return state; },
    saveState: function () { try { saveGameState(); } catch (e) {} },
    getLevel: function () {
      try { var p = getLocalProfile(); return (p && p.level) || 1; } catch (e) { return 1; }
    },
    getMythName: function () { return state && state.lineId ? _mythDisplayName(state) : ""; },
    getMythRarity: function () { return state && state.lineId ? _mythDisplayRarity(state) : ""; },
    getMythEmoji: function () {
      var L = state && state.lineId ? LINES[state.crossLineageId || state.lineId] : null;
      return (L && L.hero && L.hero.emoji) || "🥚";
    },
    getTownMyth: function (slot) {
      var myth = getMythBySlot(slot);
      if (!myth || !myth.lineId) return null;
      var lid = myth.crossLineageId || myth.lineId;
      var L = LINES[lid] || LINES[myth.lineId];
      var node = L && getCurrentNode(L, myth.nodeKey);
      return {
        lineId: lid,
        nodeKey: myth.nodeKey,
        name: node ? node.name : (L ? L.title : "Myth"),
        emoji: (node && node.emoji) || (L && L.hero && L.hero.emoji) || "🥚",
        art: petArtHtml(lid, myth.nodeKey),
        hunger: myth.hunger == null ? 100 : myth.hunger,
        energy: myth.energy == null ? 100 : myth.energy,
        happiness: myth.happiness == null ? 100 : myth.happiness,
        lifespan: myth.lifespan == null ? 100 : myth.lifespan,
        sleeping: slot === 1 ? !!companionSleepActive : !!petSleepActive,
      };
    },
    setActiveMythSlot: function (slot) {
      if (slot !== 0 && slot !== 1) return false;
      if (!getMythBySlot(slot)) return false;
      switchMythTab(slot);
      saveGameState();
      return true;
    },
    enterLair: function () {
      try { stopCityMapBgm(); } catch (e) {}
      try { startLairAmbient(state.lineId); } catch (e) {}
    },
    enterHome: function () {
      try { stopLairAmbient(); } catch (e) {}
      try { startCityMapBgm(); } catch (e) {}
    },
    openProfile: function () { try { openProfileModal(); } catch (e) {} },
    openFriends: function () { try { openFriendsModal(); } catch (e) {} },
    openSettings: function () { _openSettingsModal(); },
    beginNewGame: function (lineId) { startGame(lineId); },
    getDefaultName: function () {
      try { var p = getLocalProfile(); return (p && p.displayName) || ""; } catch (e) { return ""; }
    },
    getLineages: function () {
      return Object.keys(LINES || {}).map(function (id) {
        var L = LINES[id];
        return {
          id: id,
          title: L.title || id,
          theme: L.theme || "",
          summary: L.summary || "",
          emoji: (L.hero && L.hero.emoji) || "✦",
        };
      });
    },
    getBestiaryNodes: function () {
      return Object.keys(LINES || {}).map(function (lineId) {
        var L = LINES[lineId];
        return {
          id: lineId,
          title: L.title || lineId,
          theme: L.theme || "",
          nodes: (L.nodes || []).map(function (n) {
            return {
              key: n.key,
              name: n.name || n.key,
              stage: n.stage || 0,
              rarity: n.rarity || "common",
              emoji: n.emoji || "✦",
              lore: Array.isArray(n.lore) ? n.lore : (n.lore ? [n.lore] : []),
              specialMove: n.specialMove || "",
              unlocked: isTreeNodeUnlocked(lineId, n.key),
            };
          }),
        };
      });
    },
    getBestiaryArt: function (lineId, nodeKey) {
      return petArtHtml(lineId, nodeKey);
    },
    getRegions: function () {
      return (REGIONS || []).map(function (r) {
        return { key: r, label: (REGION_LABEL && REGION_LABEL[r]) || r, color: (REGION_COLOR && REGION_COLOR[r]) || "#888" };
      });
    },
    openEvolutionMap: function () {
      try { openLairEvolutionPanel(); } catch (e) {}
    },
    renderEvolutionInto: function (containerId) {
      var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      if (el) try { renderTreeInto(el); } catch (e) {}
    },
    openTreeLoreModal: function (nodeKey, lineId) {
      try { openTreeLoreModal(nodeKey, lineId); } catch (e) {}
    },
    openHall: function () { try { openLegacyTimeline(); } catch (e) {} },
    getShopItems: function () {
      return {
        foods: (FOODS || []).map(function (f) { return { id: f.id, name: f.name, icon: f.icon || "🍱", asset: f.asset || "" }; }),
        relics: (RELIC_ITEMS || []).map(function (r) { return { id: r.id, name: r.name, icon: r.icon || "🪬", asset: r.asset || "", region: r.region }; }),
      };
    },
    startAdventure: function (region) { completeGuildTask('battle'); try { startAdventure(region || undefined); } catch (e) {} },
    openDailies: function () { completeGuildTask('dailies'); _openDailiesModal(); },
    completeGuildTask: function (id) { completeGuildTask(id); },
    renderGuildDaily: function () { _updateGuildDailyUI(); },
    onInventoryChanged: function () {
      try { refreshPlayBallButton(); } catch (e) {}
      try { if (state && state.lineId) renderPet(); } catch (e) {}
    },
    getPlayerCombatBp: function () {
      try {
        if (state && state.lineId) {
          var s = combatStatsForPet(state.crossLineageId || state.lineId, state.nodeKey);
          return (s && s.combatBp) || 0;
        }
      } catch (e) {}
      return 0;
    },
    openSparring: function () { try { openPvpModal(); } catch (e) {} },
    checkAchievement: function (id, val) { try { checkAchievement(id, val); } catch (e) {} },
    incrementAchievement: function (id, amt) { try { incrementAchievement(id, amt || 1); } catch (e) {} },
    checkTieredAchievements: function (prefix, val) { try { checkTieredAchievements(prefix, val); } catch (e) {} },
  });
}

async function boot() {
  installAudioUserGestureUnlock();
  try {
    await loadGameData();
  } catch (err) {
    console.error(err);
    const fb = document.getElementById("pick-fallback");
    if (fb) {
      fb.textContent =
        "Could not load game data. Ensure data/game-bundle.js exists next to index.html, or serve via a local web server (ES modules require HTTP). " +
        (err && err.message ? err.message : String(err));
      fb.classList.add("visible");
    }
    return;
  }
  if (!bindEls()) {
    const fb = document.getElementById("pick-fallback");
    if (fb) fb.classList.add("visible");
    return;
  }
  if (els.pickFallback) els.pickFallback.classList.remove("visible");
  setMythInteractionHelpers(els, pushLog);
  setStartGameFn(startGame);
  wireUi();
  _bootMythalaCity();
  _wireSettingsModal();
  _wireEnterCodeModal();
  initAuthScreen();
  setOnCloudSaveHook(function () {
    debouncedCloudSave();
    try {
      var cs = (typeof combatStatsForPet === "function" && state && state.lineId)
        ? combatStatsForPet(state.lineId, state.nodeKey)
        : null;
      if (cs) syncMythSnapshot(cs);
    } catch (e) {}
  });

  try {
    wireProfileModal();
    wireFriendsModal();
    wirePvpModal();
    wireLevelUpModal();
    wireAvatarPicker();
    wireAchievementModal();
    initAchievementToast();
    setOnAscendHook(function (evolvedNode) {
      if (evolvedNode.stage >= 1 && state && state.lineId && !state.slot2Unlocked) {
        _openCompanionPickModal();
      }
    });
  } catch (e) {}

  await initFirebaseAuth(async function (user) {
    var screenAuth = document.getElementById("screen-auth");
    var screenPick = document.getElementById("screen-pick");

    if (user) {
      if (screenAuth) screenAuth.classList.remove("active");
      try { refreshLairProfileButtonAvatar(); } catch (e) {}
      startFriendsListener();
      startChallengeListener();
      try { await loadAchievements(); } catch (e) {}
      try {
        var pr = getLocalProfile();
        if (pr && pr.stats) {
          refreshOnlineTierAchievements(pr.stats);
          refreshPvpAchievementTiers(pr.stats);
          applyLevelUpAchievements(pr.level || 1);
          var pw = pr.stats.pvpWins || 0;
          var pl = pr.stats.pvpLosses || 0;
          if (pw + pl >= 1) checkAchievement("sec_first_pvp", 1);
        }
      } catch (e2) {}
    } else {
      stopFriendsListener();
      stopChallengeListener();
      return;
    }

    var localSave = loadSavedGame();
    var cloudSave = null;
    try { cloudSave = await loadCloudSave(); } catch (e) {}
    var best = pickNewerSave(localSave, cloudSave);

    if (best && best.kind === "game") {
      resumeSavedGame(best.snapshot);
    } else if (best && best.kind === "reincarnation") {
      setPendingReincarnationBonus(best.snapshot.reincarnationBonus || null);
      setPendingReincarnationInventory(best.snapshot.reincarnationInventory || null);
      if (best.snapshot.companionCarry) setPendingCompanionCarry(best.snapshot.companionCarry);
      // Mythala City: a new Myth always comes from Lady Kemala.
      try { stopCityMapBgm(); } catch (e) {}
      if (window.MythalaCity) window.MythalaCity.goBestow();
      else { if (screenPick) screenPick.classList.add("active"); pickLineCards(); }
    } else if (localSave && localSave.kind === "game") {
      resumeSavedGame(localSave.snapshot);
    } else {
      // Brand-new Tamer: route through Lady Kemala's onboarding.
      try { stopCityMapBgm(); } catch (e) {}
      if (window.MythalaCity) window.MythalaCity.startOnboarding();
      else { if (screenPick) screenPick.classList.add("active"); pickLineCards(); }
    }
  });

  window.addEventListener("beforeunload", function () {
    if (state && state.lineId) {
      saveGameState();
      debouncedCloudSave();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { boot(); });
} else {
  boot();
}
