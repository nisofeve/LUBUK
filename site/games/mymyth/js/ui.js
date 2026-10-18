import { state, developerMode, treeLoreModalKey, treeLoreModalLineId, battleActive, petSleepActive, companionSleepActive, clamp, escapeHtml, getMythBySlot } from './state.js';
import { LINES, REGIONS, REGION_LABEL, REGION_COLOR, EVOLVE_RULES, SPECIAL_MOVE_INFO, LINE_FOOD_PREFS, FOODS, nodeByKey, getCurrentNode, line, formLine, formLineId, petArtHtml, lineHeroHtml } from './data.js';
import { canEvolve, renderTree, getEvolutionChoices, disciplineRequiredForTarget, evolveInfluenceGates } from './evolution.js';
import { combatStatsForPet, combatBpTrainingCapForStage, restartPetIdle, ensureStatBonusRespectsBpCap, notifyTabSwitched } from './combat.js';
import { renderDemandUi, updateSpiritBerryUi, syncPetAngryOverlay, syncMoodClasses, renderPantryLine } from './care.js';

export let els = {};

export function bindEls() {
  els = {
    screenPick: document.getElementById("screen-pick"),
    screenGame: document.getElementById("screen-game"),
    linePick: document.getElementById("line-pick"),
    pickFallback: document.getElementById("pick-fallback"),
    petPortraitShell: document.getElementById("pet-portrait-shell"),
    lairDropLayer: document.getElementById("lair-drop-layer"),
    petLairActions: document.getElementById("pet-lair-actions"),
    petPortrait: document.getElementById("pet-portrait"),
    petName: document.getElementById("pet-name"),
    petRarity: document.getElementById("pet-rarity"),
    petLineLabel: document.getElementById("pet-line-label"),
    valBattles: document.getElementById("val-battles"),
    barHappiness: document.getElementById("bar-happiness"),
    numHappiness: document.getElementById("num-happiness"),
    barHunger: document.getElementById("bar-hunger"),
    numHunger: document.getElementById("num-hunger"),
    barEnergy: document.getElementById("bar-energy"),
    numEnergy: document.getElementById("num-energy"),
    barLifespan: document.getElementById("bar-lifespan"),
    numLifespan: document.getElementById("num-lifespan"),
    barDiscipline: document.getElementById("bar-discipline"),
    numDiscipline: document.getElementById("num-discipline"),
    lairMiniHunger: document.getElementById("lair-mini-hunger"),
    lairMiniHungerNum: document.getElementById("lair-mini-hunger-num"),
    lairMiniEnergy: document.getElementById("lair-mini-energy"),
    lairMiniEnergyNum: document.getElementById("lair-mini-energy-num"),
    lairMiniHappiness: document.getElementById("lair-mini-happiness"),
    lairMiniHappinessNum: document.getElementById("lair-mini-happiness-num"),
    lairMiniDiscipline: document.getElementById("lair-mini-discipline"),
    lairMiniDisciplineNum: document.getElementById("lair-mini-discipline-num"),
    lairMiniMythName: document.getElementById("lair-mini-myth-name"),
    demandStrip: document.getElementById("demand-strip"),
    demandText: document.getElementById("demand-text"),
    demandTimer: document.getElementById("demand-timer"),
    btnDemandIndulge: document.getElementById("btn-demand-indulge"),
    btnDemandDiscipline: document.getElementById("btn-demand-discipline"),
    modalDeathLegacy: document.getElementById("modal-death-legacy"),
    deathMedals: document.getElementById("death-medals"),
    deathEpigraph: document.getElementById("death-epigraph"),
    deathBonusLine: document.getElementById("death-bonus-line"),
    deathContinueBtn: document.getElementById("death-continue-btn"),
    influenceDisplay: document.getElementById("influence-display"),
    btnAdventure: document.getElementById("btn-adventure"),
    btnAutoCare: document.getElementById("btn-auto-care"),
    gameLog: document.getElementById("game-log"),
    btnEvolve: document.getElementById("btn-evolve"),
    btnFeed: document.getElementById("btn-feed"),
    btnRelicInventory: document.getElementById("btn-relic-inventory"),
    btnPlay: document.getElementById("btn-play"),
    playBallCount: document.getElementById("play-ball-count"),
    btnRest: document.getElementById("btn-rest"),
    lairBerryBush: document.getElementById("lair-berry-bush"),
    modalRelicInventory: document.getElementById("modal-relic-inventory"),
    modalRelicInventorySub: document.getElementById("modal-relic-inventory-sub"),
    relicInventoryList: document.getElementById("relic-inventory-list"),
    modalRelicInventoryClose: document.getElementById("modal-relic-inventory-close"),
    modalRelicInventoryCancel: document.getElementById("modal-relic-inventory-cancel"),
    modalRelicConsume: document.getElementById("modal-relic-consume"),
    modalRelicConsumeTitle: document.getElementById("modal-relic-consume-title"),
    modalRelicConsumeDesc: document.getElementById("modal-relic-consume-desc"),
    modalRelicConsumeClose: document.getElementById("modal-relic-consume-close"),
    modalRelicConsumeConfirm: document.getElementById("modal-relic-consume-confirm"),
    modalRelicConsumeCancel: document.getElementById("modal-relic-consume-cancel"),
    btnNewPet: document.getElementById("btn-new-pet"),
    treeContainer: document.getElementById("tree-container"),
    modalEvolve: document.getElementById("modal-evolve"),
    modalEvolveText: document.getElementById("modal-evolve-text"),
    modalEvolveArt: document.getElementById("modal-evolve-art"),
    modalEvolveInto: document.getElementById("modal-evolve-into"),
    modalEvolveOk: document.getElementById("modal-evolve-ok"),
    modalEvolveHalt: document.getElementById("modal-evolve-halt"),
    modalEvolveBox: document.getElementById("modal-evolve-box"),
    modalEvolveTitle: document.getElementById("modal-evolve-title"),
    evolveFxRoot: document.getElementById("evolve-fx-root"),
    modalEvolvePick: document.getElementById("modal-evolve-pick"),
    modalEvolvePickOptions: document.getElementById("modal-evolve-pick-options"),
    modalEvolvePickSub: document.getElementById("modal-evolve-pick-sub"),
    modalEvolvePickClose: document.getElementById("modal-evolve-pick-close"),
    modalEvolvePickCancel: document.getElementById("modal-evolve-pick-cancel"),
    btnRandomMyth: document.getElementById("btn-random-myth"),
    modalAdventureIntro: document.getElementById("modal-adventure-intro"),
    adventureIntroTrack: document.getElementById("adventure-intro-track"),
    adventureIntroDustRoot: document.getElementById("adventure-intro-dust-root"),
    adventureIntroRunnerWrap: document.getElementById("adventure-intro-runner-wrap"),
    adventureIntroRunnerBob: document.getElementById("adventure-intro-runner-bob"),
    adventureIntroRunner: document.getElementById("adventure-intro-runner"),
    adventureIntroStory: document.getElementById("adventure-intro-story"),
    adventureIntroStoryText: document.getElementById("adventure-intro-story-text"),
    adventureIntroStoryHint: document.getElementById("adventure-intro-story-hint"),
    adventureIntroFoeBurst: document.getElementById("adventure-intro-foe-burst"),
    adventureIntroStageMask: document.getElementById("adventure-intro-stage-mask"),
    adventureIntroFoeRise: document.getElementById("adventure-intro-foe-rise"),
    adventureIntroFoeRiseInner: document.getElementById("adventure-intro-foe-rise-inner"),
    adventureIntroFoeNameLine: document.getElementById("adventure-intro-foe-name-line"),
    modalBattle: document.getElementById("modal-battle"),
    battleFxLayer: document.getElementById("battle-fx-layer"),
    battlePlayerArt: document.getElementById("battle-player-art"),
    battleEnemyArt: document.getElementById("battle-enemy-art"),
    battlePlayerHp: document.getElementById("battle-player-hp"),
    battleEnemyHp: document.getElementById("battle-enemy-hp"),
    battlePlayerName: document.getElementById("battle-player-name"),
    battleEnemyName: document.getElementById("battle-enemy-name"),
    battleFeed: document.getElementById("battle-feed"),
    battleResult: document.getElementById("battle-result"),
    battleResultLabel: document.getElementById("battle-result-label"),
    battlePlayerWrap: document.getElementById("battle-player-wrap"),
    battleEnemyWrap: document.getElementById("battle-enemy-wrap"),
    valBp: document.getElementById("val-bp"),
    valHpStat: document.getElementById("val-hp-stat"),
    valAtk: document.getElementById("val-atk"),
    valSpd: document.getElementById("val-spd"),
    valTier: document.getElementById("val-tier"),
    valBpTraining: document.getElementById("val-bp-training"),
    valPantry: document.getElementById("val-pantry"),
    modalFoodChoice: document.getElementById("modal-food-choice"),
    modalFoodChoiceSub: document.getElementById("modal-food-choice-sub"),
    modalFoodChoiceList: document.getElementById("modal-food-choice-list"),
    modalFoodChoiceClose: document.getElementById("modal-food-choice-close"),
    modalFoodChoiceCancel: document.getElementById("modal-food-choice-cancel"),
    valSpecialMove: document.getElementById("val-special-move"),
    valSpecialMoveRow: document.getElementById("val-special-move-row"),
    battlePlayerHpNum: document.getElementById("battle-player-hp-num"),
    battleEnemyHpNum: document.getElementById("battle-enemy-hp-num"),
    battlePlayerSp: document.getElementById("battle-player-sp"),
    battleEnemySp: document.getElementById("battle-enemy-sp"),
    battleComicCallout: document.getElementById("battle-comic-callout"),
    battleSpeedLines: document.getElementById("battle-speed-lines"),
    battleComicShoutHost: document.getElementById("battle-comic-shout-host"),
    battleComicImpactHost: document.getElementById("battle-comic-impact-host"),
    battlePostSummary: document.getElementById("battle-post-summary"),
    modalTreeCompare: document.getElementById("modal-tree-compare"),
    modalTreeCompareTitle: document.getElementById("modal-tree-compare-title"),
    modalTreeCompareSub: document.getElementById("modal-tree-compare-sub"),
    modalTreeCompareArt: document.getElementById("modal-tree-compare-art"),
    modalTreeCompareGrid: document.getElementById("modal-tree-compare-grid"),
    modalTreeCompareClose: document.getElementById("modal-tree-compare-close"),
    modalTreeLore: document.getElementById("modal-tree-lore"),
    modalTreeLoreTitle: document.getElementById("modal-tree-lore-title"),
    modalTreeLoreArt: document.getElementById("modal-tree-lore-art"),
    modalTreeLoreBody: document.getElementById("modal-tree-lore-body"),
    modalTreeLoreClose: document.getElementById("modal-tree-lore-close"),
    modalTreeLoreRequirements: document.getElementById("modal-tree-lore-requirements"),
    modalTreeLoreDev: document.getElementById("modal-tree-lore-dev"),
    modalTreeLoreDevYes: document.getElementById("modal-tree-lore-dev-yes"),
    modalTreeLoreDevNo: document.getElementById("modal-tree-lore-dev-no"),
    modalDevModeConfirm: document.getElementById("modal-dev-mode-confirm"),
    modalDevModeYes: document.getElementById("modal-dev-mode-yes"),
    modalDevModeNo: document.getElementById("modal-dev-mode-no"),
    mythLairTitle: document.querySelector(".myth-lair-title"),
    lairPanelVitals: document.getElementById("lair-panel-vitals"),
    lairPanelEvolution: document.getElementById("lair-panel-evolution"),
    lairVitalsMini: document.getElementById("lair-vitals-mini"),
    btnLairVitals: document.getElementById("btn-lair-vitals"),
    btnLairEvolution: document.getElementById("btn-lair-evolution"),
    btnLairCloseVitals: document.getElementById("btn-lair-close-vitals"),
    btnLairCloseEvolution: document.getElementById("btn-lair-close-evolution"),
    lairEventBanner: document.getElementById("lair-event-banner"),
    lairEventDismiss: document.getElementById("lair-event-dismiss"),
    modalLegacyTimeline: document.getElementById("modal-legacy-timeline"),
    legacyTimelineList: document.getElementById("legacy-timeline-list"),
    modalLegacyTimelineClose: document.getElementById("modal-legacy-timeline-close"),
    btnPastMyths: document.getElementById("btn-past-myths"),
    btnDailies: document.getElementById("btn-dailies"),
    dailiesBadge: document.getElementById("dailies-badge"),
    modalDailies: document.getElementById("modal-dailies"),
    modalDailiesClose: document.getElementById("modal-dailies-close"),
    dailiesGrid: document.getElementById("dailies-grid"),
    dailiesSubtitle: document.getElementById("dailies-subtitle"),
    dailiesCollect: document.getElementById("btn-dailies-collect"),
    // v2 two-myth
    petPortraitCompanion: document.getElementById("pet-portrait-companion"),
    demandStrip1: document.getElementById("demand-strip-1"),
    demandText1: document.getElementById("demand-text-1"),
    demandTimer1: document.getElementById("demand-timer-1"),
    btnDemandIndulge1: document.getElementById("btn-demand-indulge-1"),
    btnDemandDiscipline1: document.getElementById("btn-demand-discipline-1"),
    mythTab0Dots: document.getElementById("myth-tab-0-dots"),
    mythTab1Dots: document.getElementById("myth-tab-1-dots"),
    mythDuoLabel0: document.getElementById("myth-duo-label-0"),
    mythDuoLabel1: document.getElementById("myth-duo-label-1"),
    mythSelectorPortrait0: document.getElementById("myth-selector-portrait-0"),
    mythSelectorPortrait1: document.getElementById("myth-selector-portrait-1"),
    petNameCompanion: document.getElementById("pet-name-companion"),
    petRarityCompanion: document.getElementById("pet-rarity-companion"),
    mythInteractionZone: document.getElementById("myth-interaction-zone"),
    btnLetThemPlay: document.getElementById("btn-let-them-play"),
    modalCompanionPick: document.getElementById("modal-companion-pick"),
    companionPickOptions: document.getElementById("companion-pick-options"),
    modalCompanionPickClose: document.getElementById("modal-companion-pick-close"),
    battlePlayerArt1: document.getElementById("battle-player-art-1"),
    battlePlayerHp1: document.getElementById("battle-player-hp-1"),
    battlePlayerHpNum1: document.getElementById("battle-player-hp-num-1"),
    battlePlayerSp1: document.getElementById("battle-player-sp-1"),
    battlePlayerWrap1: document.getElementById("battle-player-wrap-1"),
    battlePlayerName1: document.getElementById("battle-player-name-1"),
    battleEnemyArt1: document.getElementById("battle-enemy-art-1"),
    battleEnemyHp1: document.getElementById("battle-enemy-hp-1"),
    battleEnemyHpNum1: document.getElementById("battle-enemy-hp-num-1"),
    battleEnemyWrap1: document.getElementById("battle-enemy-wrap-1"),
    battleEnemyName1: document.getElementById("battle-enemy-name-1"),
    // dev
    btnDevUnlockCompanion: document.getElementById("btn-dev-unlock-companion"),
    // myth picker
    modalMythPicker: document.getElementById("modal-myth-picker"),
    mythPickerOptions: document.getElementById("myth-picker-options"),
    mythPickerSlot0: document.getElementById("myth-picker-slot0"),
    mythPickerSlot1: document.getElementById("myth-picker-slot1"),
    mythPickerCancel: document.getElementById("myth-picker-cancel"),
  };
  return !!(els.linePick && els.screenPick && els.petPortrait);
}

export function closeLairSubpanels() {
  if (els.lairPanelVitals) {
    els.lairPanelVitals.classList.remove("lair-subpanel--open");
    els.lairPanelVitals.setAttribute("aria-hidden", "true");
  }
  if (els.lairPanelEvolution) {
    els.lairPanelEvolution.classList.remove("lair-subpanel--open");
    els.lairPanelEvolution.setAttribute("aria-hidden", "true");
  }
  if (els.btnLairVitals) els.btnLairVitals.setAttribute("aria-expanded", "false");
  if (els.lairVitalsMini) els.lairVitalsMini.setAttribute("aria-expanded", "false");
  if (els.btnLairEvolution) els.btnLairEvolution.setAttribute("aria-expanded", "false");
  document.body.classList.remove("lair-subpanel-open");
}

export function openLairVitalsPanel() {
  closeLairSubpanels();
  if (els.lairPanelVitals) {
    els.lairPanelVitals.classList.add("lair-subpanel--open");
    els.lairPanelVitals.setAttribute("aria-hidden", "false");
  }
  if (els.btnLairVitals) els.btnLairVitals.setAttribute("aria-expanded", "true");
  if (els.lairVitalsMini) els.lairVitalsMini.setAttribute("aria-expanded", "true");
  document.body.classList.add("lair-subpanel-open");
}

export function openLairEvolutionPanel() {
  closeLairSubpanels();
  if (state && state.lineId) renderTree();
  if (els.lairPanelEvolution) {
    els.lairPanelEvolution.classList.add("lair-subpanel--open");
    els.lairPanelEvolution.setAttribute("aria-hidden", "false");
  }
  if (els.btnLairEvolution) els.btnLairEvolution.setAttribute("aria-expanded", "true");
  document.body.classList.add("lair-subpanel-open");
}

export function pushLog(msg) {
  state.log.unshift(msg);
  if (state.log.length > 24) state.log.pop();
  renderLog();
}

export function renderLog() {
  els.gameLog.innerHTML = state.log.map((m) => `<div>${m}</div>`).join("");
}

export function renderInfluence() {
  const slot = state ? (state.activeMythTab || 0) : 0;
  const myth = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  const inf = (myth && myth.influence) || {};
  els.influenceDisplay.innerHTML = REGIONS.map((r) => {
    const v = inf[r] || 0;
    return `<div class="inf-item ${r}">${REGION_LABEL[r]}: <strong>${v}</strong></div>`;
  }).join("");
}

export function setBar(barEl, numEl, val) {
  const v = clamp(val, 0, 100);
  barEl.style.width = v + "%";
  numEl.textContent = String(Math.round(v));

  // Mini Lair card mirrors every live update made to the selected Myth's full bars.
  let miniBar = null;
  let miniNum = null;
  if (barEl === els.barHunger) {
    miniBar = els.lairMiniHunger;
    miniNum = els.lairMiniHungerNum;
  } else if (barEl === els.barEnergy) {
    miniBar = els.lairMiniEnergy;
    miniNum = els.lairMiniEnergyNum;
  } else if (barEl === els.barHappiness) {
    miniBar = els.lairMiniHappiness;
    miniNum = els.lairMiniHappinessNum;
  } else if (barEl === els.barDiscipline) {
    miniBar = els.lairMiniDiscipline;
    miniNum = els.lairMiniDisciplineNum;
  }
  if (miniBar && miniNum) {
    miniBar.style.width = v + "%";
    miniNum.textContent = String(Math.round(v));
  }
}

function renderLairMiniVitals(myth) {
  if (!myth) return;
  const rows = [
    [els.lairMiniHappiness, els.lairMiniHappinessNum, myth.happiness],
    [els.lairMiniHunger, els.lairMiniHungerNum, myth.hunger],
    [els.lairMiniEnergy, els.lairMiniEnergyNum, myth.energy],
    [els.lairMiniDiscipline, els.lairMiniDisciplineNum, myth.discipline != null ? myth.discipline : 0],
  ];
  rows.forEach(([bar, num, value]) => {
    if (bar && num) setBar(bar, num, value);
  });
  if (els.lairMiniMythName) {
    const fLid = (myth.crossLineageId && LINES[myth.crossLineageId]) ? myth.crossLineageId : myth.lineId;
    const node = fLid && LINES[fLid] ? getCurrentNode(LINES[fLid], myth.nodeKey) : null;
    els.lairMiniMythName.textContent = node ? node.name : "Myth";
  }
}

export function renderPet() {
  const fLid = formLineId();
  const L = LINES[fLid];
  if (!L) return;
  const node = getCurrentNode(L, state.nodeKey);
  if (!node) return;
  var homeL = line();
  if (els.petLineLabel) els.petLineLabel.textContent = (state.crossLineageId && state.crossLineageId !== state.lineId)
    ? L.title + " (from " + (homeL ? homeL.title : state.lineId) + ")"
    : L.title;
  els.petPortrait.innerHTML =
    '<div class="pet-portrait-idle">' +
    '<div class="pet-portrait-idle-content">' +
    '<div class="pet-portrait-hungry-layer" aria-hidden="true"><span class="pet-hungry-icon" role="img" aria-label="Hungry">🍖</span></div>' +
    '<div class="pet-zzz-layer" aria-hidden="true">' +
    '<span class="pet-zzz">Z</span><span class="pet-zzz">Z</span><span class="pet-zzz">Z</span>' +
    "</div>" +
    '<div class="pet-mood-popup" aria-hidden="true">' +
    '<div class="pet-mood-hearts" aria-hidden="true"></div>' +
    '<span class="pet-mood-popup-ico"></span></div>' +
    '<div class="pet-curious-exclaim-layer" aria-hidden="true"><span class="pet-curious-exclaim" aria-hidden="true">!</span></div>' +
    '<div class="pet-angry-layer" aria-hidden="true">' +
    '<span class="pet-angry-sparks" aria-hidden="true">' +
    '<span class="pet-angry-spark"></span><span class="pet-angry-spark"></span><span class="pet-angry-spark"></span>' +
    '<span class="pet-angry-spark"></span><span class="pet-angry-spark"></span><span class="pet-angry-spark"></span>' +
    '<span class="pet-angry-spark"></span></span>' +
    '<span class="pet-angry-ico" role="img" aria-label="Angry">😠</span></div>' +
    petArtHtml(fLid, state.nodeKey) +
    '<div class="pet-eat-vfx" aria-hidden="true"></div>' +
    "</div></div>";
  els.petPortrait.className = "pet-portrait rarity-" + node.rarity;
  syncMoodClasses(els.petPortrait, state);
  if (petSleepActive) {
    els.petPortrait.classList.add("sleeping");
    const idleContent = els.petPortrait.querySelector(".pet-portrait-idle-content");
    if (idleContent) idleContent.classList.remove("facing-left");
    const sf = els.petPortrait.querySelector(".pet-art-raster--multi-frame");
    if (sf) {
      if (sf._atkT) clearTimeout(sf._atkT);
      sf._atkT = null;
      if (sf._hitT) clearTimeout(sf._hitT);
      sf._hitT = null;
      sf.classList.remove("walking", "facing-left", "attacking", "hurting");
    }
  }
  if (state.hunger <= 20) els.petPortrait.classList.add("pet-portrait--hungry");
  syncMoodClasses();
  const portraitHint =
    (state.hunger <= 20 ? "Hungry — open pantry (🍖) and choose food. " : "") +
    node.name +
    " — click myth to pet (happiness); triple-tap empty lair sparks curiosity; three clicks wake when sleeping";
  els.petPortrait.setAttribute("title", portraitHint);
  els.petPortrait.setAttribute("aria-label", portraitHint);
  els.petPortrait.setAttribute("aria-hidden", "false");
  els.petName.textContent = node.name;
  els.petRarity.textContent = node.rarity;
  els.petRarity.className = "rarity-badge rarity-" + node.rarity;
  // Stats bars: show active tab myth
  const activeTab = state.activeMythTab || 0;
  const displayedMyth = (activeTab === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  if (els.valBattles) els.valBattles.textContent = displayedMyth.battles || 0;
  setBar(els.barHappiness, els.numHappiness, displayedMyth.happiness);
  setBar(els.barHunger, els.numHunger, displayedMyth.hunger);
  setBar(els.barEnergy, els.numEnergy, displayedMyth.energy);
  if (els.barLifespan && els.numLifespan) setBar(els.barLifespan, els.numLifespan, displayedMyth.lifespan != null ? displayedMyth.lifespan : 100);
  if (els.barDiscipline && els.numDiscipline) setBar(els.barDiscipline, els.numDiscipline, displayedMyth.discipline != null ? displayedMyth.discipline : 0);
  renderLairMiniVitals(displayedMyth);
  renderDemandUi();
  renderInfluence();
  els.btnEvolve.disabled = petSleepActive || !canEvolve(displayedMyth);
  if (els.petLairActions) {
    els.petLairActions.classList.toggle("pet-lair-actions--evolve-ready", !petSleepActive && canEvolve(displayedMyth));
  }
  renderCombatStatsPanel();
  renderTree();
  updateSpiritBerryUi();
  syncPetAngryOverlay();
  _renderCompanionPortrait();
  _renderMythDuoLabels();
  if (!battleActive && els.screenGame.classList.contains("active")) restartPetIdle();
}

function _buildPortraitHtml(lineId, nodeKey, isSleeping, isHungry) {
  const artHtml = petArtHtml(lineId, nodeKey);
  return (
    '<div class="pet-portrait-idle">' +
    '<div class="pet-portrait-idle-content">' +
    '<div class="pet-portrait-hungry-layer" aria-hidden="true"><span class="pet-hungry-icon" role="img" aria-label="Hungry">🍖</span></div>' +
    '<div class="pet-zzz-layer" aria-hidden="true">' +
    '<span class="pet-zzz">Z</span><span class="pet-zzz">Z</span><span class="pet-zzz">Z</span></div>' +
    '<div class="pet-mood-popup" aria-hidden="true"><div class="pet-mood-hearts" aria-hidden="true"></div><span class="pet-mood-popup-ico"></span></div>' +
    '<div class="pet-curious-exclaim-layer" aria-hidden="true"><span class="pet-curious-exclaim" aria-hidden="true">!</span></div>' +
    '<div class="pet-angry-layer" aria-hidden="true"><span class="pet-angry-sparks" aria-hidden="true">' +
    '<span class="pet-angry-spark"></span><span class="pet-angry-spark"></span><span class="pet-angry-spark"></span>' +
    '<span class="pet-angry-spark"></span><span class="pet-angry-spark"></span><span class="pet-angry-spark"></span>' +
    '<span class="pet-angry-spark"></span></span><span class="pet-angry-ico" role="img" aria-label="Angry">😠</span></div>' +
    artHtml +
    '<div class="pet-eat-vfx" aria-hidden="true"></div>' +
    '</div></div>'
  );
}

function _renderCompanionPortrait() {
  const p = els.petPortraitCompanion;
  if (!p) return;
  const companion = state && state.companion;
  if (!companion || !companion.lineId) {
    p.innerHTML = "";
    p.className = "pet-portrait pet-portrait--companion pet-portrait--empty";
    p.setAttribute("aria-hidden", "true");
    return;
  }
  const cFLid = companion.crossLineageId || companion.lineId;
  const cL = LINES[cFLid];
  const cNode = cL && getCurrentNode(cL, companion.nodeKey);
  if (!cNode) return;
  p.innerHTML = _buildPortraitHtml(cFLid, companion.nodeKey, companionSleepActive, companion.hunger <= 20);
  p.className = "pet-portrait pet-portrait--companion rarity-" + cNode.rarity;
  if (companion.hunger <= 20) p.classList.add("pet-portrait--hungry");
  p.setAttribute("aria-label", cNode.name + " — companion");
  p.setAttribute("aria-hidden", "false");
  const sf = p.querySelector(".pet-art-raster--multi-frame");
  if (sf && companionSleepActive) sf.classList.remove("walking", "attacking", "hurting");
}

function _renderMythDuoLabels() {
  const hasCompanion = !!(state && state.companion && state.companion.lineId);
  const slot2Unlocked = !!(state && state.slot2Unlocked);
  const fLid0 = state && (state.crossLineageId || state.lineId);
  if (els.mythSelectorPortrait0) {
    els.mythSelectorPortrait0.innerHTML = fLid0 && state.nodeKey ? petArtHtml(fLid0, state.nodeKey) : "";
  }

  // Show companion label when filled OR when slot is unlocked (to add one)
  if (els.mythDuoLabel1) els.mythDuoLabel1.hidden = !(hasCompanion || slot2Unlocked);

  if (hasCompanion) {
    const c = state.companion;
    const fLid1 = c.crossLineageId || c.lineId;
    const L1 = LINES[fLid1];
    const n1 = L1 && getCurrentNode(L1, c.nodeKey);
    if (els.mythSelectorPortrait1) els.mythSelectorPortrait1.innerHTML = petArtHtml(fLid1, c.nodeKey);
    if (els.petNameCompanion) els.petNameCompanion.textContent = n1 ? n1.name : "Companion";
    if (els.petRarityCompanion) {
      els.petRarityCompanion.textContent = n1 ? n1.rarity : "";
      els.petRarityCompanion.className = "rarity-badge rarity-" + (n1 ? n1.rarity : "common");
    }
    if (els.mythDuoLabel1) els.mythDuoLabel1.classList.remove("myth-duo-label--add-companion");
  } else if (slot2Unlocked) {
    if (els.mythSelectorPortrait1) els.mythSelectorPortrait1.innerHTML = "";
    if (els.petNameCompanion) els.petNameCompanion.textContent = "Slot";
    if (els.petRarityCompanion) {
      els.petRarityCompanion.textContent = "";
      els.petRarityCompanion.className = "rarity-badge";
    }
    if (els.mythDuoLabel1) els.mythDuoLabel1.classList.add("myth-duo-label--add-companion");
  } else if (els.mythSelectorPortrait1) {
    els.mythSelectorPortrait1.innerHTML = "";
  }

  _updatePortraitSelection();
}

function _updatePortraitSelection() {
  const hasCompanion = !!(state && state.companion && state.companion.lineId);
  const active = state ? (state.activeMythTab || 0) : 0;
  if (els.petPortrait) els.petPortrait.classList.toggle("pet-portrait--selected", hasCompanion && active === 0);
  if (els.petPortraitCompanion) els.petPortraitCompanion.classList.toggle("pet-portrait--selected", hasCompanion && active === 1);
  if (els.mythDuoLabel0) {
    els.mythDuoLabel0.classList.toggle("myth-duo-label--active", !hasCompanion || active === 0);
    els.mythDuoLabel0.setAttribute("aria-pressed", String(!hasCompanion || active === 0));
  }
  if (els.mythDuoLabel1) {
    els.mythDuoLabel1.classList.toggle("myth-duo-label--active", hasCompanion && active === 1);
    els.mythDuoLabel1.setAttribute("aria-pressed", String(hasCompanion && active === 1));
  }
}

export function switchMythTab(slot) {
  if (!state) return;
  if (slot === 1 && (!state.companion || !state.companion.lineId)) return;
  const prev = state.activeMythTab || 0;
  state.activeMythTab = slot;
  try { if (typeof window !== "undefined" && window.__syncCareTargetSlot) window.__syncCareTargetSlot(slot); } catch (e) {}
  if (prev !== slot) {
    try { notifyTabSwitched(slot); } catch (e) {}
  }
  const displayedMyth = slot === 1 ? state.companion : state;
  setBar(els.barHappiness, els.numHappiness, displayedMyth.happiness);
  setBar(els.barHunger, els.numHunger, displayedMyth.hunger);
  setBar(els.barEnergy, els.numEnergy, displayedMyth.energy);
  if (els.barLifespan && els.numLifespan) setBar(els.barLifespan, els.numLifespan, displayedMyth.lifespan != null ? displayedMyth.lifespan : 100);
  if (els.barDiscipline && els.numDiscipline) setBar(els.barDiscipline, els.numDiscipline, displayedMyth.discipline != null ? displayedMyth.discipline : 0);
  renderLairMiniVitals(displayedMyth);
  renderCombatStatsPanel();
  _updatePortraitSelection();
  // Refresh the evolution map and Evolve button to reflect the newly selected myth
  try { renderTree(); } catch (e) {}
  if (els.btnEvolve) els.btnEvolve.disabled = petSleepActive || !canEvolve(displayedMyth);
}

export function renderCombatStatsPanel() {
  if (!els.valBp || !state || !state.lineId) return;
  const activeSlot = state.activeMythTab || 0;
  const myth = getMythBySlot(activeSlot) || state;
  if (!myth.lineId) return;
  var fLid = (myth.crossLineageId && LINES[myth.crossLineageId]) ? myth.crossLineageId : myth.lineId;
  ensureStatBonusRespectsBpCap(myth);
  const s = combatStatsForPet(fLid, myth.nodeKey, myth);
  const node = getCurrentNode(LINES[fLid], myth.nodeKey);
  const headerSprite = document.getElementById("vitals-myth-sprite");
  const headerName = document.getElementById("vitals-myth-name");
  if (headerSprite) headerSprite.innerHTML = petArtHtml(fLid, myth.nodeKey);
  if (headerName) headerName.textContent = node ? node.name : "—";
  const navPrev = document.getElementById("vitals-myth-prev");
  const navNext = document.getElementById("vitals-myth-next");
  const hasCompanion = !!(state.companion && state.companion.lineId);
  if (navPrev && navNext) {
    if (hasCompanion) {
      navPrev.hidden = false;
      navNext.hidden = false;
      if (!navPrev._wired) {
        navPrev.addEventListener("click", function () { switchMythTab((state.activeMythTab || 0) === 0 ? 1 : 0); });
        navPrev._wired = true;
      }
      if (!navNext._wired) {
        navNext.addEventListener("click", function () { switchMythTab((state.activeMythTab || 0) === 0 ? 1 : 0); });
        navNext._wired = true;
      }
    } else {
      navPrev.hidden = true;
      navNext.hidden = true;
    }
  }
  const tierNames = ["I", "II", "III", "IV", "V"];
  const rule = node.stage < 4 ? EVOLVE_RULES[node.stage] : null;
  els.valBp.textContent = String(s.combatBp);
  if (els.valBpTraining) {
    const b = myth.statBonus || { hp: 0, atk: 0, spd: 0 };
    const rb = myth.reincarnationBonus || { hp: 0, atk: 0, spd: 0 };
    const rbLine =
      rb.hp + rb.atk + rb.spd > 0
        ? " Past life: +" + rb.hp + " HP, +" + rb.atk + " Atk, +" + rb.spd + " Spd."
        : "";
    const trained = b.hp + b.atk + b.spd > 0;
    const cap = combatBpTrainingCapForStage(s.stage);
    const capLine =
      " Training BP cap: " + cap + " (~85% of next tier's natural Combat BP; wins add pips only until this cap).";
    const need = rule ? " Need BP ≥ " + rule.minCombatBp + " to evolve." : "";
    const discLine =
      rule && node.stage < 4
        ? (function () {
            const choices = getEvolutionChoices(LINES[fLid], myth.nodeKey, fLid);
            if (!choices.length) return "";
            const needs = choices.filter(function (nk) { return nk.indexOf(":") < 0; }).map(function (nk) {
              return disciplineRequiredForTarget(LINES[fLid], myth.nodeKey, nk);
            });
            const lo = Math.min.apply(null, needs);
            const hi = Math.max.apply(null, needs);
            const d = myth.discipline != null ? myth.discipline : 0;
            const seg =
              lo === hi ? "≥ " + lo : lo + "–" + hi + " (depends on path)";
            return " Discipline " + seg + " (you: " + d + ").";
          })()
        : "";
    const influenceGateLine =
      rule && node.stage < 4
        ? (function () {
            const Ln = LINES[fLid];
            const choices = getEvolutionChoices(Ln, myth.nodeKey, fLid);
            if (!choices.length) return "";
            const parts = [];
            for (let ci = 0; ci < choices.length; ci++) {
              const nk = choices[ci];
              const tn = nodeByKey(Ln, nk);
              if (!tn) continue;
              const gates = evolveInfluenceGates(tn);
              if (!gates.length) continue;
              const bits = gates.map(function (g) {
                const have = (myth.influence && myth.influence[g.region]) || 0;
                const need = Number(g.min) || 0;
                return REGION_LABEL[g.region] + " ≥" + need + (have >= need ? " ✓" : " (" + have + ")");
              });
              parts.push(tn.name + ": " + bits.join(", "));
            }
            return parts.length ? " Regional influence for next paths: " + parts.join(" · ") + "." : "";
          })()
        : "";
    const happyLine =
      myth.happiness >= 100 ? " Max happiness: +2% to HP, Atk, Spd." : "";
    els.valBpTraining.textContent =
      (rbLine ? rbLine + " " : "") +
      (trained
        ? "Training: +" + b.hp + " HP, +" + b.atk + " Atk, +" + b.spd + " Spd."
        : "Battle to earn random stat bonuses (wins grant more).") +
      capLine +
      happyLine +
      need +
      discLine +
      influenceGateLine;
  }
  els.valHpStat.textContent = String(s.maxHp);
  els.valAtk.textContent = String(s.atk);
  els.valSpd.textContent = String(s.speed);
  els.valTier.textContent = (tierNames[s.stage] || "?") + " · " + (node ? node.rarity : "—");
  if (els.valSpecialMove) {
    if (node) {
      const sm = SPECIAL_MOVE_INFO[node.specialMove || "attack"];
      els.valSpecialMove.textContent = "Special — " + sm.name + ": " + sm.desc;
      if (els.valSpecialMoveRow) els.valSpecialMoveRow.style.display = "flex";
    } else {
      els.valSpecialMove.textContent = "";
      if (els.valSpecialMoveRow) els.valSpecialMoveRow.style.display = "none";
    }
  }
  renderPantryLine();
}

export function openDevModeEntryModal() {
  if (els.modalDevModeConfirm) els.modalDevModeConfirm.classList.add("open");
}

export function closeDevModeEntryModal() {
  if (els.modalDevModeConfirm) els.modalDevModeConfirm.classList.remove("open");
}

export function syncTreeLoreDevStrip() {
  const el = els.modalTreeLoreDev;
  if (!el) return;
  const slot = state ? (state.activeMythTab || 0) : 0;
  const myth = (slot === 1 && state.companion && state.companion.lineId) ? state.companion : state;
  if (!developerMode || !treeLoreModalKey || !myth) {
    el.setAttribute("hidden", "");
    return;
  }
  const currentLid = myth.crossLineageId || myth.lineId;
  const targetLid = treeLoreModalLineId || myth.lineId;
  const sameForm = (myth.nodeKey === treeLoreModalKey) && (currentLid === targetLid);
  if (sameForm) el.setAttribute("hidden", "");
  else el.removeAttribute("hidden");
}

let _startGameFn = null;

export function setStartGameFn(fn) { _startGameFn = fn; }

export function showConfirm(title, body, onYes) {
  var overlay = document.getElementById("confirm-overlay");
  var titleEl = document.getElementById("confirm-title");
  var bodyEl = document.getElementById("confirm-body");
  var yesBtn = document.getElementById("confirm-yes");
  var noBtn = document.getElementById("confirm-no");
  if (!overlay) { onYes(); return; }
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  function close() {
    overlay.classList.remove("open");
    if (yesBtn) yesBtn.onclick = null;
    if (noBtn) noBtn.onclick = null;
  }
  if (yesBtn) yesBtn.onclick = function () { close(); onYes(); };
  if (noBtn) noBtn.onclick = close;
  overlay.classList.add("open");
}

export function pickLineCards() {
  if (!els.linePick) return;
  els.linePick.innerHTML = Object.values(LINES)
    .map((lineData) => {
      const hero = lineHeroHtml(lineData.id);
      return (
        '<article class="line-card" tabindex="0" role="button" data-line="' +
        lineData.id +
        '" aria-label="Start ' +
        escapeHtml(lineData.title) +
        '"><div class="line-card-art">' +
        hero +
        '</div><div class="line-card-body"><h3>' +
        escapeHtml(lineData.title) +
        '</h3><div class="theme">' +
        escapeHtml(lineData.theme) +
        '</div><div class="path">' +
        escapeHtml(lineData.summary) +
        '</div><button type="button" class="line-card-cta" data-line="' +
        lineData.id +
        '">Begin this lineage</button></div></article>'
      );
    })
    .join("");
  if (els.pickFallback) els.pickFallback.classList.remove("visible");
  els.linePick.querySelectorAll(".line-card").forEach((card) => {
    const lid = card.dataset.line;
    const start = () => { if (_startGameFn) _startGameFn(lid); };
    card.addEventListener("click", (ev) => {
      if (ev.target.closest(".line-card-cta")) return;
      start();
    });
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        start();
      }
    });
  });
  els.linePick.querySelectorAll(".line-card-cta").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (_startGameFn) _startGameFn(btn.dataset.line);
    });
  });
}
