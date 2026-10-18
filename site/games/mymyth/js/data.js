import { state, setState, setDefaultStateTemplate, loadTreeUnlocksFromStorage } from './state.js';

export let REGIONS = null;
export let REGION_LABEL = null;
export let REGION_MYTH_LINE = null;
export let REGION_COLOR = null;
export let EVOLVE_RULES = null;
export let FOODS = null;
export let FOOD_BY_ID = null;
export let RELIC_ITEMS = null;
export let RELIC_BY_ID = null;
export let PERMIT_ITEMS = null;
export let LINE_FOOD_PREFS = null;
export let PET_ART = null;
export let PET_KEY = null;
export let LINE_HERO = null;
export let SPECIAL_MOVE_INFO = null;
export let LINES = null;
export let SPIRIT_FOX_HIT_MS = null;
export let LINEAGE_ORDER = null;
export let ADJACENCY = null;
export let CROSS_LINEAGE_COST = null;

function petSvg(inner) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-hidden="true">' +
    inner +
    "</svg>"
  );
}

function petRasterHtml(src, alt, extraClass) {
  const safeAlt = String(alt).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const extra = extraClass ? " " + String(extraClass).trim() : "";
  return (
    '<span class="pet-art-raster' +
    extra +
    '" role="img" aria-label="' +
    safeAlt +
    '"><img class="pet-art-img" src="' +
    src +
    '" alt="" decoding="async" draggable="false"/></span>'
  );
}

function walkWrapHtml(paths) {
  if (Array.isArray(paths.walkFrames) && paths.walkFrames.length > 1) {
    const walkFallback = paths.walk ? ' onerror="this.onerror=null;this.src=\'' + paths.walk + '\'"' : "";
    const imgs = paths.walkFrames.map(function (src, i) {
      return '<img class="pet-art-img pet-art-img--walk-frame pet-art-img--walk-f' + (i + 1) + '" src="' + src + '"' + walkFallback + ' alt="" decoding="async" draggable="false"/>';
    }).join("");
    return '<span class="pet-art-walk-wrap pet-art-walk-wrap--frames" aria-hidden="true">' + imgs + "</span>";
  }
  return (
    '<span class="pet-art-walk-wrap" aria-hidden="true">' +
    '<img class="pet-art-img pet-art-img--walk" src="' +
    paths.walk +
    '" alt="" decoding="async" draggable="false"/>' +
    "</span>"
  );
}

function petMultiFrameRasterHtml(paths, ariaLabel, extraClass, fallback) {
  const safeLabel = String(ariaLabel).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const extra = extraClass ? " " + String(extraClass).trim() : "";
  const idleOnerror = fallback ? ' onerror="this.onerror=null;this.src=\'' + fallback + '\'"' : "";
  const hasSpecialWindup = !!paths.specialWindup;
  const hasEat = !!paths.eat;
  const hasBattleIdle = !!paths.battleIdle;
  const hasIdleHappy = !!paths.idleHappy;
  const hasIdleAngry = !!paths.idleAngry;
  const hasIdleSad = !!paths.idleSad;
  const hasDefeat = !!paths.defeat;
  const modClass =
    (hasSpecialWindup ? " has-special-windup" : "") +
    (hasEat ? " has-eat" : "") +
    (hasBattleIdle ? " has-battle-idle" : "") +
    (hasIdleHappy ? " has-idle-happy" : "") +
    (hasIdleAngry ? " has-idle-angry" : "") +
    (hasIdleSad ? " has-idle-sad" : "") +
    (hasDefeat ? " has-defeat" : "");
  const windupWrap = hasSpecialWindup
    ? '<span class="pet-art-special-windup-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--special-windup" src="' +
      paths.specialWindup +
      '" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  const eatWrap = hasEat
    ? '<span class="pet-art-eat-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--eat" src="' +
      paths.eat +
      '" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  const battleIdleFallback = fallback || paths.idle;
  const battleIdleWrap = hasBattleIdle
    ? '<span class="pet-art-battle-idle-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--battle-idle" src="' +
      paths.battleIdle +
      '" onerror="this.onerror=null;this.src=\'' + battleIdleFallback + '\'" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  const idleHappyWrap = hasIdleHappy
    ? '<span class="pet-art-idle-happy-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--idle-happy" src="' +
      paths.idleHappy +
      '" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  const idleAngryWrap = hasIdleAngry
    ? '<span class="pet-art-idle-angry-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--idle-angry" src="' +
      paths.idleAngry +
      '" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  const idleSadWrap = hasIdleSad
    ? '<span class="pet-art-idle-sad-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--idle-sad" src="' +
      paths.idleSad +
      '" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  const defeatWrap = hasDefeat
    ? '<span class="pet-art-defeat-wrap" aria-hidden="true">' +
      '<img class="pet-art-img pet-art-img--defeat" src="' +
      paths.defeat +
      '" alt="" decoding="async" draggable="false"/>' +
      "</span>"
    : "";
  return (
    '<span class="pet-art-raster pet-art-raster--multi-frame' +
    extra +
    modClass +
    '" role="img" aria-label="' +
    safeLabel +
    '">' +
    '<img class="pet-art-img pet-art-img--idle" src="' +
    paths.idle +
    '"' + idleOnerror + ' alt="" decoding="async" draggable="false"/>' +
    walkWrapHtml(paths) +
    '<span class="pet-art-attack-wrap" aria-hidden="true">' +
    '<img class="pet-art-img pet-art-img--attack" src="' +
    paths.attack +
    '" alt="" decoding="async" draggable="false"/>' +
    "</span>" +
    windupWrap +
    eatWrap +
    battleIdleWrap +
    idleHappyWrap +
    idleAngryWrap +
    idleSadWrap +
    defeatWrap +
    '<span class="pet-art-hit-wrap" aria-hidden="true">' +
    '<img class="pet-art-img pet-art-img--hit" src="' +
    paths.hit +
    '" alt="" decoding="async" draggable="false"/>' +
    "</span>" +
    '<span class="pet-art-sleep-wrap" aria-hidden="true">' +
    '<img class="pet-art-img pet-art-img--sleep" src="' +
    paths.sleep +
    '" alt="" decoding="async" draggable="false"/>' +
    "</span></span>"
  );
}

function petSpiritFoxHtml(paths) {
  return petMultiFrameRasterHtml(paths, "Fox Spirit", "pet-art-raster--black-mat");
}

function petCelestialKitsuneHtml(paths) {
  return petMultiFrameRasterHtml(paths, "Celestial Kitsune", "pet-art-raster--black-mat");
}

function petSpiritHoundHtml(paths) {
  return petMultiFrameRasterHtml(paths, "Spirit Hound", "pet-art-raster--black-mat");
}

function influenceSumForBranch(inf, regionIds) {
  let s = 0;
  for (let i = 0; i < regionIds.length; i++) s += inf[regionIds[i]] || 0;
  return s;
}

function resolveBranchAtStage3(cfg) {
  if (!cfg || !cfg.strategy) return function () { return "base"; };
  if (cfg.strategy === "avian_south_vs_mediterranean") {
    const left = cfg.left;
    const sumOf = cfg.sumOf;
    const epicIfLeftGteSum = cfg.epicIfLeftGteSum;
    const elseKey = cfg.elseKey;
    return function (inf) {
      const l = inf[left] || 0;
      const sum = influenceSumForBranch(inf, sumOf);
      return l >= sum ? epicIfLeftGteSum : elseKey;
    };
  }
  if (cfg.strategy === "compare_two") {
    const a = cfg.a;
    const b = cfg.b;
    const ifAGteB = cfg.ifAGteB;
    const elseKey = cfg.elseKey;
    return function (inf) {
      return influenceSumForBranch(inf, a) >= influenceSumForBranch(inf, b) ? ifAGteB : elseKey;
    };
  }
  if (cfg.strategy === "max_influence_epic") {
    const cands = cfg.candidates;
    return function (inf) {
      let best = cands[0].key;
      let bestV = -1;
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        const v = influenceSumForBranch(inf, c.regions);
        if (v > bestV) { bestV = v; best = c.key; }
      }
      return best;
    };
  }
  return function () { return "base"; };
}

function buildLines(rawLines) {
  const out = {};
  const ids = Object.keys(rawLines);
  for (let i = 0; i < ids.length; i++) {
    const lineId = ids[i];
    const raw = rawLines[lineId];
    out[lineId] = {
      id: raw.id,
      title: raw.title,
      theme: raw.theme,
      summary: raw.summary,
      nodes: raw.nodes,
      branchAtStage3: resolveBranchAtStage3(raw.branchAtStage3Config),
    };
  }
  return out;
}

function buildPetArt(petArtJson, spiritFoxPaths, celestialKitsunePaths, spiritHoundPaths) {
  const art = {};
  const sk = Object.keys(petArtJson.svg);
  for (let i = 0; i < sk.length; i++) art[sk[i]] = petSvg(petArtJson.svg[sk[i]]);
  const rk = Object.keys(petArtJson.raster);
  for (let j = 0; j < rk.length; j++) {
    const id = rk[j];
    const r = petArtJson.raster[id];
    if (r.multiFrame && typeof r.multiFrame === "object") {
      const mf = r.multiFrame;
      art[id] = petMultiFrameRasterHtml(
        { idle: mf.idle, walk: mf.walk, walkFrames: mf.walkFrames, attack: mf.attack, specialWindup: mf.specialWindup, eat: mf.eat, battleIdle: mf.battleIdle, idleHappy: mf.idleHappy, idleAngry: mf.idleAngry, idleSad: mf.idleSad, defeat: mf.defeat, hit: mf.hit, sleep: mf.sleep },
        r.alt,
        r.extraClass,
        r.fallback
      );
    } else {
      art[id] = petRasterHtml(r.src, r.alt, r.extraClass);
    }
  }
  art.fox_spirit = petSpiritFoxHtml(spiritFoxPaths);
  art.kitsune_cos = petCelestialKitsuneHtml(celestialKitsunePaths);
  art.hound = petSpiritHoundHtml(spiritHoundPaths);
  return art;
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    const s = document.createElement("script");
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("Failed to load " + src)); };
    document.head.appendChild(s);
  });
}

export async function loadGameData() {
  let game;
  let creatures;
  let petArtJson;
  try {
    const gameRes = await fetch("data/player/game.json");
    const creatureRes = await fetch("data/creature/creatures.json");
    const artRes = await fetch("data/creature/pet-art.json");
    if (!gameRes.ok) throw new Error("data/player/game.json HTTP " + gameRes.status);
    if (!creatureRes.ok) throw new Error("data/creature/creatures.json HTTP " + creatureRes.status);
    if (!artRes.ok) throw new Error("data/creature/pet-art.json HTTP " + artRes.status);
    game = await gameRes.json();
    creatures = await creatureRes.json();
    petArtJson = await artRes.json();
  } catch (fetchErr) {
    const b0 = window.__MYTHICAL_GAME_BUNDLE__;
    if (b0 && b0.game && b0.creatures && b0.petArt) {
      game = b0.game;
      creatures = b0.creatures;
      petArtJson = b0.petArt;
    } else {
      try {
        await loadScript("data/game-bundle.js");
      } catch (e) {
        throw fetchErr;
      }
      const b = window.__MYTHICAL_GAME_BUNDLE__;
      if (!b || !b.game || !b.creatures || !b.petArt) {
        throw fetchErr;
      }
      game = b.game;
      creatures = b.creatures;
      petArtJson = b.petArt;
    }
  }

  REGIONS = game.regions;
  REGION_LABEL = game.regionLabel;
  REGION_MYTH_LINE = game.regionMythLine;
  REGION_COLOR = game.regionColor;
  EVOLVE_RULES = game.evolveRules;
  // Stamp v2 fields onto the template so new games start with them
  const tmpl = Object.assign({}, game.defaultState, {
    _v2: true,
    companion: null,
    activeMythTab: 0,
    slot2Unlocked: false,
    dailies: { streak: 0, lastClaimedDate: null },
  });
  setDefaultStateTemplate(tmpl);
  setState(JSON.parse(JSON.stringify(tmpl)));
  FOODS = Array.isArray(game.foods) ? game.foods : [];
  LINE_FOOD_PREFS = game.lineFoodPrefs && typeof game.lineFoodPrefs === "object" ? game.lineFoodPrefs : {};
  FOOD_BY_ID = {};
  for (let fi = 0; fi < FOODS.length; fi++) {
    const f = FOODS[fi];
    if (f && f.id) FOOD_BY_ID[f.id] = f;
  }
  ensureFoodInventoryState();
  RELIC_ITEMS = Array.isArray(game.relicItems) ? game.relicItems : [];
  RELIC_BY_ID = {};
  for (let ri = 0; ri < RELIC_ITEMS.length; ri++) {
    const r = RELIC_ITEMS[ri];
    if (r && r.id) RELIC_BY_ID[r.id] = r;
  }
  ensureRelicInventoryState();
  PERMIT_ITEMS = Array.isArray(game.permitItems) ? game.permitItems : [];
  ensurePermitInventoryState();

  PET_KEY = creatures.petKey;
  LINE_HERO = creatures.lineHero;
  SPECIAL_MOVE_INFO = creatures.specialMoveInfo;
  SPIRIT_FOX_HIT_MS = creatures.spiritFox.hitMs;
  PET_ART = buildPetArt(
    petArtJson,
    creatures.spiritFox,
    creatures.celestialKitsune,
    creatures.spiritHound
  );
  LINES = buildLines(creatures.lines);
  LINEAGE_ORDER = Array.isArray(creatures.lineageOrder) ? creatures.lineageOrder : Object.keys(creatures.lines);
  ADJACENCY = creatures.adjacency && typeof creatures.adjacency === "object" ? creatures.adjacency : {};
  CROSS_LINEAGE_COST = game.crossLineageCost && typeof game.crossLineageCost === "object"
    ? game.crossLineageCost
    : { foodCount: 3, relicCount: 1, influenceMultiplier: 1.5 };
  loadTreeUnlocksFromStorage();
}

export function petArtHtml(lineId, nodeKey) {
  const artId = PET_KEY[lineId]?.[nodeKey];
  const svg = artId ? PET_ART[artId] : PET_ART.unknown;
  return svg || PET_ART.unknown;
}

export function lineHeroHtml(lineId) {
  const id = LINE_HERO[lineId] || "unknown";
  return PET_ART[id] || PET_ART.unknown;
}

export function randomLineId() {
  const keys = Object.keys(LINES);
  return keys[Math.floor(Math.random() * keys.length)];
}

export function nodeByKey(lineObj, key) {
  return lineObj.nodes.find((n) => n.key === key);
}

export function getCurrentNode(lineObj, key) {
  return nodeByKey(lineObj, key);
}

export function branchMatchesArena(branch, region) {
  if (!branch) return false;
  if (branch === region) return true;
  if (branch === "greek_egypt" && (region === "greek" || region === "egypt")) return true;
  return false;
}

export function nodeKeyForArenaCreature(lineId, region, stage) {
  const L = LINES[lineId];
  if (!L) return "base";
  const atStage = L.nodes.filter((n) => n.stage === stage);
  if (!atStage.length) return "base";
  if (atStage.length === 1) return atStage[0].key;
  const matched = atStage.filter((n) => branchMatchesArena(n.branch, region));
  if (matched.length) return matched[Math.floor(Math.random() * matched.length)].key;
  return atStage[Math.floor(Math.random() * atStage.length)].key;
}

export function line() {
  return LINES[state.lineId];
}

export function formLineId() {
  return (state.crossLineageId && LINES[state.crossLineageId]) ? state.crossLineageId : state.lineId;
}

export function formLine() {
  return LINES[formLineId()];
}

export function lineFor(myth) {
  if (!myth || !myth.lineId) return null;
  return LINES[myth.lineId] || null;
}

export function formLineIdFor(myth) {
  if (!myth || !myth.lineId) return null;
  return (myth.crossLineageId && LINES[myth.crossLineageId]) ? myth.crossLineageId : myth.lineId;
}

export function formLineFor(myth) {
  const id = formLineIdFor(myth);
  return id ? LINES[id] : null;
}

export function ensureFoodInventoryState() {
  if (!state) return;
  if (!state.foodInventory || typeof state.foodInventory !== "object") state.foodInventory = {};
}

export function ensureRelicInventoryState() {
  if (!state) return;
  if (!state.relicInventory || typeof state.relicInventory !== "object") state.relicInventory = {};
  if (!Array.isArray(RELIC_ITEMS)) return;
  for (let ri = 0; ri < RELIC_ITEMS.length; ri++) {
    const id = RELIC_ITEMS[ri].id;
    if (id && state.relicInventory[id] == null) state.relicInventory[id] = 0;
  }
}

export function ensurePermitInventoryState() {
  if (!state) return;
  if (!state.permitInventory || typeof state.permitInventory !== "object") state.permitInventory = {};
  if (!Array.isArray(PERMIT_ITEMS)) return;
  for (let pi = 0; pi < PERMIT_ITEMS.length; pi++) {
    const id = PERMIT_ITEMS[pi].id;
    if (id && state.permitInventory[id] == null) state.permitInventory[id] = 0;
  }
  if (state.tamerUpgrades == null || typeof state.tamerUpgrades !== "object") {
    state.tamerUpgrades = { staminaMax: 0, staminaRegen: 0 };
  }
  if (state.playerStamina == null) state.playerStamina = 100;
}

export function influenceSum() {
  return REGIONS.reduce((s, r) => s + state.influence[r], 0);
}
