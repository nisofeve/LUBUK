import { state, developerMode, treeLoreModalKey, treeLoreModalLineId, setTreeLoreModalKey, setTreeLoreModalLineId, battleActive, clamp, escapeHtml, saveGameState, isTreeNodeUnlocked, unlockTreeNode, getActiveMyth, getActiveSlot, getMythBySlot } from './state.js';
import { LINES, EVOLVE_RULES, FOODS, FOOD_BY_ID, REGIONS, REGION_LABEL, REGION_COLOR, REGION_MYTH_LINE, LINE_FOOD_PREFS, nodeByKey, getCurrentNode, line, formLine, formLineId, lineFor, formLineFor, formLineIdFor, petArtHtml, ensureFoodInventoryState, ensureRelicInventoryState, influenceSum, LINEAGE_ORDER, ADJACENCY, CROSS_LINEAGE_COST, RELIC_ITEMS } from './data.js';
import { combatStatsForPet, ensureStatBonusRespectsBpCap, sleepMs, restartPetIdle, stopPetIdle } from './combat.js';
import { resetPettingCooldown } from './care.js';
import { els, renderPet, pushLog, renderCombatStatsPanel, syncTreeLoreDevStrip, closeLairSubpanels } from './ui.js';
import { playEvolveTransformSfx, playEvolveGrandSuccessSfx, playEvolveChargeSfx, playMythMoodSfxForDelta } from './audio.js';
import { awardXp, incrementStat } from './player-profile.js';
import { showLevelUpIfNeeded } from './online-ui.js';
import { checkTieredAchievements, checkAchievement, incrementAchievement } from './achievements.js';

let _onAscendHook = null;
export function setOnAscendHook(fn) { _onAscendHook = fn; }

/** Resolve the myth to operate on. Defaults to the lair's active myth (slot 0 or 1). */
function _am(myth) {
  if (myth && myth.lineId) return myth;
  return getActiveMyth() || state;
}

export function evolveInfluenceGates(node) {
  if (!node || !Array.isArray(node.evolveInfluence)) return [];
  return node.evolveInfluence;
}

export function influenceGatesMetForTarget(L, toKey, optMyth) {
  const am = _am(optMyth);
  const inf = (am && am.influence) || {};
  const toNode = nodeByKey(L, toKey);
  const gates = evolveInfluenceGates(toNode);
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    const need = Number(g.min) || 0;
    if ((inf[g.region] || 0) < need) return false;
  }
  return true;
}

export function formatInfluenceGatesShort(L, toKey) {
  const toNode = nodeByKey(L, toKey);
  const gates = evolveInfluenceGates(toNode);
  if (!gates.length) return "";
  return gates
    .map(function (g) {
      return REGION_LABEL[g.region] + " ≥" + (Number(g.min) || 0);
    })
    .join(", ");
}

export const CROSS_LEGEND_INFLUENCE_MIN = 100;
export const CROSS_LEGEND_FOOD_COST = 5;

export function canonicalLegKeyFromEpicKey(epicKey) {
  if (!epicKey || epicKey.indexOf("epic_") !== 0) return null;
  return "leg_" + epicKey.slice(5);
}

export function isEpicNodeKey(k) {
  return !!k && k.indexOf("epic_") === 0;
}

export function getCrossBranchLegendKeys(L, currentKey) {
  const cur = nodeByKey(L, currentKey);
  if (!cur || cur.stage !== 3 || !isEpicNodeKey(currentKey)) return [];
  const canon = canonicalLegKeyFromEpicKey(currentKey);
  if (!canon) return [];
  return L.nodes
    .filter(function (n) {
      return n.stage === 4 && n.key.indexOf("leg_") === 0 && n.key !== canon;
    })
    .map(function (n) {
      return n.key;
    });
}

/** Tier IV epic → Tier V legendary on a different branch (not leg_<same suffix>). */
export function isCrossBranchLegendEvolution(L, fromKey, toKey) {
  if (!fromKey || !toKey || !L) return false;
  const toNode = nodeByKey(L, toKey);
  if (!toNode || toNode.stage !== 4 || toKey.indexOf("leg_") !== 0) return false;
  const canon = canonicalLegKeyFromEpicKey(fromKey);
  return canon != null && toKey !== canon;
}

export function crossBranchInfluenceMet(L, toKey, optMyth) {
  const am = _am(optMyth);
  const inf = (am && am.influence) || {};
  const toNode = nodeByKey(L, toKey);
  const gates = evolveInfluenceGates(toNode);
  for (let i = 0; i < gates.length; i++) {
    if ((inf[gates[i].region] || 0) < CROSS_LEGEND_INFLUENCE_MIN) return false;
  }
  return true;
}

export function isAdjacentLineage(lineIdA, lineIdB) {
  if (!ADJACENCY || !lineIdA || !lineIdB) return false;
  const adj = ADJACENCY[lineIdA];
  return Array.isArray(adj) && adj.indexOf(lineIdB) >= 0;
}

export function getCrossLineageTier4Choices(currentLineId) {
  if (!ADJACENCY || !currentLineId) return [];
  const adj = ADJACENCY[currentLineId] || [];
  const results = [];
  for (let i = 0; i < adj.length; i++) {
    const targetLineId = adj[i];
    const TL = LINES[targetLineId];
    if (!TL) continue;
    var tier4 = TL.nodes.filter(function (n) { return n.stage === 3; });
    for (let j = 0; j < tier4.length; j++) {
      results.push({ lineId: targetLineId, nodeKey: tier4[j].key, node: tier4[j] });
    }
  }
  return results;
}

export function crossLineageInfluenceGatesMet(targetLineId, targetNodeKey, optMyth) {
  var am = _am(optMyth);
  var inf = (am && am.influence) || {};
  var TL = LINES[targetLineId];
  if (!TL) return false;
  var toNode = nodeByKey(TL, targetNodeKey);
  if (!toNode) return false;
  var gates = evolveInfluenceGates(toNode);
  var mult = CROSS_LINEAGE_COST ? CROSS_LINEAGE_COST.influenceMultiplier || 1.5 : 1.5;
  for (var i = 0; i < gates.length; i++) {
    var need = Math.ceil((Number(gates[i].min) || 0) * mult);
    if ((inf[gates[i].region] || 0) < need) return false;
  }
  return true;
}

export function crossLineageFoodCostMet(currentLineId) {
  var cost = CROSS_LINEAGE_COST ? CROSS_LINEAGE_COST.foodCount || 3 : 3;
  return countFavoriteFoodInPantry(currentLineId) >= cost;
}

export function crossLineageRelicCostMet(targetLineId) {
  var cost = CROSS_LINEAGE_COST ? CROSS_LINEAGE_COST.relicCount || 1 : 1;
  var homeRegion = REGION_MYTH_LINE ? Object.keys(REGION_MYTH_LINE).find(function (r) {
    return REGION_MYTH_LINE[r] === targetLineId;
  }) : null;
  if (!homeRegion) return true;
  ensureRelicInventoryState();
  var relicId = null;
  if (Array.isArray(RELIC_ITEMS)) {
    for (var i = 0; i < RELIC_ITEMS.length; i++) {
      if (RELIC_ITEMS[i].region === homeRegion) { relicId = RELIC_ITEMS[i].id; break; }
    }
  }
  if (!relicId) return true;
  return (state.relicInventory[relicId] || 0) >= cost;
}

export function consumeCrossLineageCost(currentLineId, targetLineId) {
  var foodCost = CROSS_LINEAGE_COST ? CROSS_LINEAGE_COST.foodCount || 3 : 3;
  consumeFavoriteFoods(currentLineId, foodCost);
  var relicCost = CROSS_LINEAGE_COST ? CROSS_LINEAGE_COST.relicCount || 1 : 1;
  var homeRegion = REGION_MYTH_LINE ? Object.keys(REGION_MYTH_LINE).find(function (r) {
    return REGION_MYTH_LINE[r] === targetLineId;
  }) : null;
  if (!homeRegion) return;
  ensureRelicInventoryState();
  if (Array.isArray(RELIC_ITEMS)) {
    for (var i = 0; i < RELIC_ITEMS.length; i++) {
      if (RELIC_ITEMS[i].region === homeRegion) {
        var id = RELIC_ITEMS[i].id;
        var have = state.relicInventory[id] || 0;
        var take = Math.min(have, relicCost);
        state.relicInventory[id] = have - take;
        if (state.relicInventory[id] <= 0) state.relicInventory[id] = 0;
        break;
      }
    }
  }
}

export function isCrossLineageEvolution(targetLineId, optMyth) {
  const am = _am(optMyth);
  return !!targetLineId && targetLineId !== am.lineId && targetLineId !== (am.crossLineageId || am.lineId);
}

export function favoriteFoodTypeForLine(lineId) {
  const p = LINE_FOOD_PREFS[lineId];
  return p && p.favorite ? p.favorite : null;
}

export function countFavoriteFoodInPantry(lineId) {
  const fav = favoriteFoodTypeForLine(lineId);
  if (!fav) return 0;
  ensureFoodInventoryState();
  let n = 0;
  for (let fi = 0; fi < FOODS.length; fi++) {
    const f = FOODS[fi];
    if (f && f.type === fav) n += Math.max(0, state.foodInventory[f.id] | 0);
  }
  return n;
}

/** Removes up to `total` pantry items of the line's favorite food type (FOODS order). Returns count removed. */
export function consumeFavoriteFoods(lineId, total) {
  const fav = favoriteFoodTypeForLine(lineId);
  if (!fav || total <= 0) return 0;
  ensureFoodInventoryState();
  let removed = 0;
  for (let fi = 0; fi < FOODS.length && removed < total; fi++) {
    const f = FOODS[fi];
    if (!f || f.type !== fav) continue;
    const id = f.id;
    let have = Math.max(0, state.foodInventory[id] | 0);
    const take = Math.min(have, total - removed);
    if (take <= 0) continue;
    have -= take;
    removed += take;
    if (have <= 0) delete state.foodInventory[id];
    else state.foodInventory[id] = have;
  }
  return removed;
}

/** Canonical next + alternate Tier V keys for tree UI / requirements (stage 3 epic only adds cross legs). */
export function getEpicTierLegendChoiceKeys(L, currentKey) {
  const base = getEvolutionChoices(L, currentKey);
  const cur = nodeByKey(L, currentKey);
  if (!cur || cur.stage !== 3 || !isEpicNodeKey(currentKey)) return base;
  const seen = new Set(base);
  const cross = getCrossBranchLegendKeys(L, currentKey);
  for (let i = 0; i < cross.length; i++) seen.add(cross[i]);
  return Array.from(seen);
}

export function disciplineRequiredForTarget(L, fromKey, toKey) {
  const from = nodeByKey(L, fromKey);
  const toNode = nodeByKey(L, toKey);
  if (!from || !toNode) return 999;
  const rule = EVOLVE_RULES[from.stage];
  const base = rule && typeof rule.minDiscipline === "number" ? rule.minDiscipline : 0;
  const extra = toNode.minDiscipline != null ? toNode.minDiscipline : 0;
  return Math.max(base, extra);
}

export function globalEvolveGatesMet(optMyth) {
  const am = _am(optMyth);
  if (!am || !am.lineId) return false;
  const fLineId = formLineIdFor(am);
  const L = LINES[fLineId];
  if (!L) return false;
  const node = getCurrentNode(L, am.nodeKey);
  if (!node || node.stage >= 4) return false;
  const rule = EVOLVE_RULES[node.stage];
  if (!rule) return false;
  if ((am.happiness || 0) < rule.happiness) return false;
  if ((am.battles || 0) < rule.battles) return false;
  const st = combatStatsForPet(fLineId, am.nodeKey, am);
  if (st.combatBp < rule.minCombatBp) return false;
  return true;
}

export function getEvolvableChoiceKeys(L, currentKey, optMyth) {
  const am = _am(optMyth);
  if (!globalEvolveGatesMet(am)) return [];
  var fLid = formLineIdFor(am);
  let next = getEvolutionChoices(L, currentKey, fLid);
  const cur = nodeByKey(L, currentKey);
  if (cur && cur.stage === 3 && isEpicNodeKey(currentKey)) {
    const seen = new Set(next);
    const cross = getCrossBranchLegendKeys(L, currentKey);
    for (let i = 0; i < cross.length; i++) seen.add(cross[i]);
    next = Array.from(seen);
  }
  const d = am.discipline != null ? am.discipline : 0;
  const canon = canonicalLegKeyFromEpicKey(currentKey);
  return next.filter(function (nk) {
    if (isCrossLineageKey(nk)) {
      var parsed = parseCrossLineageKey(nk);
      if (!parsed) return false;
      return crossLineageInfluenceGatesMet(parsed.lineId, parsed.nodeKey, am)
        && crossLineageFoodCostMet(am.lineId)
        && crossLineageRelicCostMet(parsed.lineId);
    }
    if (d < disciplineRequiredForTarget(L, currentKey, nk)) return false;
    if (canon && nk === canon) return influenceGatesMetForTarget(L, nk, am);
    if (canon && nk !== canon) {
      const tn = nodeByKey(L, nk);
      if (tn && tn.stage === 4)
        return crossBranchInfluenceMet(L, nk, am) && countFavoriteFoodInPantry(am.lineId) >= CROSS_LEGEND_FOOD_COST;
    }
    return influenceGatesMetForTarget(L, nk, am);
  });
}

export function canEvolve(optMyth) {
  const am = _am(optMyth);
  if (!am || !am.lineId) return false;
  const L = LINES[formLineIdFor(am)];
  if (!L) return false;
  return getEvolvableChoiceKeys(L, am.nodeKey, am).length > 0;
}

/** Immediate evolution targets from the current node. At stage 2, includes cross-lineage epic options. */
export function getEvolutionChoices(L, currentKey, currentLineId) {
  const cur = nodeByKey(L, currentKey);
  if (!cur || cur.stage >= 4) return [];
  if (cur.stage < 2) {
    const linear = ["base", "u", "r"];
    const i = linear.indexOf(currentKey);
    return i >= 0 && i < 2 ? [linear[i + 1]] : [];
  }
  if (cur.stage === 2) {
    var own = L.nodes.filter(function (n) { return n.stage === 3; }).map(function (n) { return n.key; });
    var lid = currentLineId || formLineId();
    var crossChoices = getCrossLineageTier4Choices(lid);
    for (var ci = 0; ci < crossChoices.length; ci++) {
      own.push(crossChoices[ci].lineId + ":" + crossChoices[ci].nodeKey);
    }
    return own;
  }
  if (cur.stage === 3) {
    const suffix = currentKey.replace("epic_", "");
    const leg = L.nodes.find(function (n) {
      return n.stage === 4 && n.key === "leg_" + suffix;
    });
    return leg ? [leg.key] : [];
  }
  return [];
}

export function parseCrossLineageKey(compositeKey) {
  if (!compositeKey || compositeKey.indexOf(":") < 0) return null;
  var parts = compositeKey.split(":");
  return { lineId: parts[0], nodeKey: parts[1] };
}

export function isCrossLineageKey(compositeKey) {
  return !!compositeKey && compositeKey.indexOf(":") >= 0;
}

export function nextKeysFromState(L, currentKey, optMyth) {
  const am = _am(optMyth);
  const path = pathFromBaseToKey(L, am.nodeKey);
  const i = path.indexOf(currentKey);
  if (i < 0 || i >= path.length - 1) return [];
  return [path[i + 1]];
}

export function branchLabelForNodeBranch(branch) {
  if (!branch) return "";
  if (branch === "greek_egypt") return "Greek & Egyptian";
  return REGION_LABEL[branch] || branch;
}

export function keysOnForwardPath(L, fromKey, optMyth) {
  const am = _am(optMyth);
  const set = new Set();
  let k = fromKey;
  for (let i = 0; i < 12; i++) {
    set.add(k);
    const nx = nextKeysFromState(L, k, am);
    if (!nx.length) break;
    k = nx[0];
  }
  return set;
}

export function parentKeyByChild(L) {
  const parent = { u: "base", r: "u" };
  for (let i = 0; i < L.nodes.length; i++) {
    const n = L.nodes[i];
    if (n.stage === 3) parent[n.key] = "r";
    if (n.stage === 4 && n.key.indexOf("leg_") === 0) {
      parent[n.key] = "epic_" + n.key.slice(4);
    }
  }
  parent.base = null;
  return parent;
}

export function pathFromBaseToKey(L, targetKey) {
  if (!nodeByKey(L, targetKey)) return [];
  const parent = parentKeyByChild(L);
  const path = [];
  let k = targetKey;
  for (let g = 0; g < 14 && k; g++) {
    path.unshift(k);
    k = parent[k];
  }
  if (!path.length || path[0] !== "base") return [];
  return path;
}

export function buildPathFromBase(L, targetKey) {
  return pathFromBaseToKey(L, targetKey);
}

export function renderTreeInto(container) {
  const am = _am(null);
  if (!container || !am || !am.lineId) {
    if (container) container.innerHTML = "";
    return;
  }
  var order = LINEAGE_ORDER || Object.keys(LINES);
  var homeLineId = am.lineId;
  var activeLineId = formLineIdFor(am);
  var activeKey = am.nodeKey;

  container.innerHTML = "";
  var wrap = document.createElement("div");
  wrap.className = "tree-map tree-map--merged";

  var headerRow = document.createElement("div");
  headerRow.className = "tree-row tree-row--header";
  for (var ci = 0; ci < order.length; ci++) {
    var hCell = document.createElement("div");
    hCell.className = "tree-lineage-header";
    var lineId = order[ci];
    var regionKey = REGION_MYTH_LINE ? Object.keys(REGION_MYTH_LINE).find(function (r) { return REGION_MYTH_LINE[r] === lineId; }) : null;
    var color = regionKey && REGION_COLOR ? REGION_COLOR[regionKey] : "#888";
    hCell.style.borderBottomColor = color;
    hCell.style.color = color;
    if (lineId === homeLineId) hCell.classList.add("tree-lineage-header--home");
    if (lineId === activeLineId) hCell.classList.add("tree-lineage-header--active");
    hCell.textContent = LINES[lineId] ? LINES[lineId].title.replace(" Line", "").replace(" Myth ", " ") : lineId;
    headerRow.appendChild(hCell);
  }
  wrap.appendChild(headerRow);

  var pathSets = {};
  for (var pi = 0; pi < order.length; pi++) {
    var pLid = order[pi];
    var pL = LINES[pLid];
    if (pL && pLid === activeLineId) {
      pathSets[pLid] = new Set(buildPathFromBase(pL, activeKey));
    } else {
      pathSets[pLid] = new Set();
    }
  }

  for (var stage = 0; stage <= 4; stage++) {
    var tierRow = document.createElement("div");
    tierRow.className = "tree-row tree-row--tier tree-row--tier-" + stage;
    var tierLabel = document.createElement("div");
    tierLabel.className = "tree-tier-label";
    tierLabel.textContent = "Tier " + (stage + 1);
    tierRow.appendChild(tierLabel);

    for (var li = 0; li < order.length; li++) {
      var lid = order[li];
      var L = LINES[lid];
      var colCell = document.createElement("div");
      colCell.className = "tree-lineage-col";
      if (lid === homeLineId) colCell.classList.add("tree-lineage-col--home");
      if (lid === activeLineId) colCell.classList.add("tree-lineage-col--active");
      colCell.dataset.lineage = lid;

      if (!L) { tierRow.appendChild(colCell); continue; }

      var nodesAtStage = L.nodes.filter(function (n) { return n.stage === stage; });
      if (stage <= 2) {
        var k = stage === 0 ? "base" : stage === 1 ? "u" : "r";
        nodesAtStage = [nodeByKey(L, k)].filter(Boolean);
      }

      for (var ni = 0; ni < nodesAtStage.length; ni++) {
        var nobj = nodesAtStage[ni];
        var key = nobj.key;
        var unlocked = isTreeNodeUnlocked(lid, key);
        var onPath = pathSets[lid] && pathSets[lid].has(key);
        var showPath = unlocked && onPath;

        var cell = document.createElement("div");
        cell.className = "tree-node-cell";
        var hit = document.createElement("button");
        hit.type = "button";

        var frame = document.createElement("div");
        frame.className = "tree-node-frame" + (stage >= 3 ? " tree-node-frame--branch" : "");

        var icon = document.createElement("div");
        icon.className = "tree-node-icon";
        icon.innerHTML = petArtHtml(lid, key);

        var lab = document.createElement("div");
        lab.className = "tree-node-label";

        if (unlocked) {
          hit.className = "tree-node-hit" + (showPath ? " tree-node--path" : "");
          hit.dataset.nodeKey = key;
          hit.dataset.lineId = lid;
          hit.setAttribute("aria-label", nobj.name + ", " + (LINES[lid] ? LINES[lid].title : lid) + ", tier " + (stage + 1));
          lab.textContent = nobj.name;
        } else {
          hit.className = "tree-node-hit tree-node-hit--locked";
          hit.disabled = true;
          hit.setAttribute("aria-label", "Locked form — hatch or evolve into this myth to reveal it.");
          lab.textContent = "?";
        }

        frame.appendChild(icon);
        frame.appendChild(lab);
        hit.appendChild(frame);
        cell.appendChild(hit);
        colCell.appendChild(cell);
      }

      tierRow.appendChild(colCell);
    }
    wrap.appendChild(tierRow);
  }

  var crossRow = document.createElement("div");
  crossRow.className = "tree-row tree-row--cross-links";
  var adj = ADJACENCY || {};
  for (var ai = 0; ai < order.length - 1; ai++) {
    var leftLid = order[ai];
    var rightLid = order[ai + 1];
    if (!adj[leftLid] || adj[leftLid].indexOf(rightLid) < 0) continue;
    var marker = document.createElement("div");
    marker.className = "tree-cross-link";
    marker.dataset.from = leftLid;
    marker.dataset.to = rightLid;
    marker.title = "Cross-lineage path: " + (LINES[leftLid] ? LINES[leftLid].title : leftLid) + " ↔ " + (LINES[rightLid] ? LINES[rightLid].title : rightLid);
    marker.innerHTML = '<span class="tree-cross-arrow">⇄</span>';
    crossRow.appendChild(marker);
  }
  if (crossRow.childNodes.length) {
    wrap.insertBefore(crossRow, wrap.querySelector(".tree-row--tier-3") ? wrap.querySelector(".tree-row--tier-3").nextSibling : null);
  }

  container.appendChild(wrap);
}

export function renderTree() {
  renderTreeInto(els.treeContainer);
}

export function openTreeNodeCompareModal(clickedKey) {
  const am = _am(null);
  if (!els.modalTreeCompare || !am || !am.lineId) return;
  if (!isTreeNodeUnlocked(am.lineId, clickedKey)) return;
  closeTreeLoreModal();
  const L = lineFor(am);
  if (!L) return;
  const node = nodeByKey(L, clickedKey);
  if (!node) return;
  const stats = combatStatsForPet(am.lineId, am.nodeKey, am);
  const forward = keysOnForwardPath(L, am.nodeKey, am);
  const onForecastPath = forward.has(clickedKey);

  let rule = null;
  let sub = "";
  let title = node.emoji + " " + node.name;

  if (clickedKey === am.nodeKey) {
    sub = "Your current myth.";
    if (node.stage >= 4) {
      sub = "Your current myth — apex legendary form. No further ascension.";
    } else {
      rule = EVOLVE_RULES[node.stage];
      const choices = getEpicTierLegendChoiceKeys(L, am.nodeKey);
      if (choices.length === 1) {
        const nextN = nodeByKey(L, choices[0]);
        if (nextN) sub = "Requirements to ascend next into " + nextN.name + ".";
        else sub = "No further branch from here.";
      } else if (choices.length > 1) {
        if (node.stage === 3 && getCrossBranchLegendKeys(L, am.nodeKey).length) {
          sub =
            "Requirements to ascend to Tier V — your epic path, or costly cross-branch rites to other legendaries (100 per required region + 5 favorite pantry foods).";
        } else {
          sub =
            "Requirements to ascend — when you evolve you will choose one of " +
            choices.length +
            " epic paths.";
        }
      } else {
        sub = "No further branch from here.";
      }
    }
  } else if (node.stage === 0) {
    sub = "Hatching form — no trials. All lineages begin here.";
  } else {
    rule = EVOLVE_RULES[node.stage - 1];
    sub =
      "Trials to evolve from the prior tier into this form (tier " +
      (node.stage + 1) +
      ").";
  }

  if (clickedKey !== am.nodeKey && node.stage >= 3 && !onForecastPath) {
    sub += " This form is not on the ascension path you chose for your myth.";
  }

  els.modalTreeCompareTitle.textContent = title;
  els.modalTreeCompareSub.textContent = sub;
  els.modalTreeCompareArt.innerHTML = petArtHtml(am.lineId, clickedKey);

  const inf = (am && am.influence) || {};
  const battles = am.battles || 0;
  const happiness = am.happiness || 0;

  if (!rule) {
    els.modalTreeCompareGrid.innerHTML =
      "<p style='margin:0;font-size:0.85rem;color:var(--muted);text-align:center;line-height:1.5'>" +
      (node.stage >= 4 && clickedKey === am.nodeKey
        ? "You have reached the top of this lineage."
        : "No numeric evolution gates apply to this selection.") +
      "</p>";
  } else {
    const rows = [
      {
        m: "Battles won",
        need: "≥ " + rule.battles,
        val: battles,
        pass: battles >= rule.battles,
      },
      {
        m: "Happiness",
        need: "≥ " + rule.happiness,
        val: happiness,
        pass: happiness >= rule.happiness,
      },
      {
        m: "Combat BP",
        need: "≥ " + rule.minCombatBp,
        val: stats.combatBp,
        pass: stats.combatBp >= rule.minCombatBp,
      },
    ];
    if (clickedKey === am.nodeKey) {
      const choices = getEpicTierLegendChoiceKeys(L, am.nodeKey);
      const canonLeg = canonicalLegKeyFromEpicKey(am.nodeKey);
      choices.forEach(function (nk) {
        const tn = nodeByKey(L, nk);
        if (!tn) return;
        const gates = evolveInfluenceGates(tn);
        const useCrossMin = canonLeg && nk !== canonLeg;
        for (let gi = 0; gi < gates.length; gi++) {
          const g = gates[gi];
          const have = inf[g.region] || 0;
          const need = useCrossMin ? CROSS_LEGEND_INFLUENCE_MIN : Number(g.min) || 0;
          rows.push({
            m: tn.name + " — " + REGION_LABEL[g.region],
            need: "≥ " + need,
            val: have,
            pass: have >= need,
          });
        }
      });
      if (am.nodeKey && getCrossBranchLegendKeys(L, am.nodeKey).length) {
        const favCnt = countFavoriteFoodInPantry(am.lineId);
        rows.push({
          m: "Pantry (cross-branch paths)",
          need: "≥ " + CROSS_LEGEND_FOOD_COST + " (favorite type)",
          val: favCnt,
          pass: favCnt >= CROSS_LEGEND_FOOD_COST,
        });
      }
    } else if (node.stage >= 1) {
      const gates = evolveInfluenceGates(node);
      for (let gi = 0; gi < gates.length; gi++) {
        const g = gates[gi];
        const have = inf[g.region] || 0;
        const need = Number(g.min) || 0;
        rows.push({
          m: REGION_LABEL[g.region] + " (into " + node.name + ")",
          need: "≥ " + need,
          val: have,
          pass: have >= need,
        });
      }
    }
    if (clickedKey === am.nodeKey) {
      const choices = getEpicTierLegendChoiceKeys(L, am.nodeKey);
      if (choices.length) {
        const needs = choices.map(function (nk) {
          return disciplineRequiredForTarget(L, am.nodeKey, nk);
        });
        const lo = Math.min.apply(null, needs);
        const hi = Math.max.apply(null, needs);
        const disc = am.discipline != null ? am.discipline : 0;
        rows.push({
          m: "Discipline (next path)",
          need: lo === hi ? "≥ " + lo : "≥ " + lo + "–" + hi,
          val: disc,
          pass: needs.some(function (n) {
            return disc >= n;
          }),
        });
      }
    } else {
      const pk = parentKeyByChild(L)[clickedKey];
      if (pk) {
        const dNeed = disciplineRequiredForTarget(L, pk, clickedKey);
        const disc = am.discipline != null ? am.discipline : 0;
        rows.push({
          m: "Discipline",
          need: "≥ " + dNeed,
          val: disc,
          pass: disc >= dNeed,
        });
      }
    }
    let html =
      '<div class="tree-compare-table">' +
      '<div class="tct-row tct-head"><span class="tct-metric">Requirement</span><span class="tct-need">Need</span><span class="tct-you">You</span></div>';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cls = r.pass ? "ok" : "bad";
      const mark = r.pass ? "✓" : "✗";
      html +=
        '<div class="tct-row">' +
        '<span class="tct-metric">' +
        r.m +
        "</span>" +
        '<span class="tct-need">' +
        r.need +
        "</span>" +
        '<span class="tct-you ' +
        cls +
        '">' +
        r.val +
        " " +
        mark +
        "</span>" +
        "</div>";
    }
    html += "</div>";
    els.modalTreeCompareGrid.innerHTML = html;
  }

  els.modalTreeCompare.classList.add("open");
}

export function closeTreeCompareModal() {
  if (els.modalTreeCompare) els.modalTreeCompare.classList.remove("open");
}

export function treeLoreExcerpt(node) {
  const lore = node && Array.isArray(node.lore) ? node.lore : null;
  if (!lore || !lore.length) return "No tale is recorded for this form yet.";
  return lore.slice(0, 2).join(" ");
}

export function openTreeLoreModal(clickedKey, optLineId) {
  const am = _am(null);
  if (!els.modalTreeLore || !els.modalTreeLoreTitle || !els.modalTreeLoreArt || !els.modalTreeLoreBody || !am || !am.lineId) return;
  const lid = optLineId || am.lineId;
  if (!isTreeNodeUnlocked(lid, clickedKey)) return;
  const L = LINES[lid];
  if (!L) return;
  const node = nodeByKey(L, clickedKey);
  if (!node) return;
  setTreeLoreModalKey(clickedKey);
  setTreeLoreModalLineId(lid);
  const em = node.emoji ? String(node.emoji).trim() + " " : "";
  const lineName = L.title || lid;
  const tier = Number.isFinite(Number(node.stage)) ? "Tier " + (Number(node.stage) + 1) : "";
  const rarity = node.rarity ? String(node.rarity) : "";
  const specialMove = node.specialMove ? "Special: " + node.specialMove : "";
  const basics = [lineName, tier, rarity, specialMove].filter(Boolean).join(" · ");
  els.modalTreeLoreTitle.textContent = em + node.name;
  els.modalTreeLoreArt.innerHTML = petArtHtml(lid, clickedKey);
  els.modalTreeLoreBody.textContent = basics + "\n\n" + treeLoreExcerpt(node);
  closeTreeCompareModal();
  syncTreeLoreDevStrip();
  els.modalTreeLore.classList.add("open");
}

export function closeTreeLoreModal() {
  if (els.modalTreeLore) els.modalTreeLore.classList.remove("open");
  setTreeLoreModalKey(null);
  setTreeLoreModalLineId(null);
}

export function openEvolvePreviewModal(L, nk) {
  const am = _am(null);
  if (!els.modalEvolve || !L || !nk || !am) return;
  const nextNode = nodeByKey(L, nk);
  if (!nextNode) return;
  const prev = getCurrentNode(L, am.nodeKey);
  if (!prev) return;
  const needD = disciplineRequiredForTarget(L, am.nodeKey, nk);
  const d = am.discipline != null ? am.discipline : 0;
  if (d < needD) {
    pushLog("Discipline too low for this form — need " + needD + " (you: " + d + ").");
    return;
  }
  const cross = isCrossBranchLegendEvolution(L, am.nodeKey, nk);
  if (cross) {
    if (!crossBranchInfluenceMet(L, nk, am)) {
      const gates = evolveInfluenceGates(nextNode);
      const needR = gates.map(function (g) {
        return REGION_LABEL[g.region] || g.region;
      });
      pushLog(
        "Cross-branch ascension needs 100 influence in each required region (" +
          needR.join(", ") +
          ")."
      );
      return;
    }
    if (countFavoriteFoodInPantry(am.lineId) < CROSS_LEGEND_FOOD_COST) {
      pushLog(
        "Cross-branch ascension needs " +
          CROSS_LEGEND_FOOD_COST +
          " pantry foods of your line's favorite type (see feeding hints)."
      );
      return;
    }
  } else if (!influenceGatesMetForTarget(L, nk, am)) {
    pushLog(
      "Regional influence is too low for this form — check the evolution map for required regions."
    );
    return;
  }
  let body =
    "Your " +
    prev.name +
    " meets the trials of myth — battles, joy, influence, discipline, and combat instinct align.";
  if (cross) {
    body +=
      " Cross-branch ascension will consume " +
      CROSS_LEGEND_FOOD_COST +
      " favorite-type foods from the pantry when you confirm.";
  }
  els.modalEvolveText.textContent = body;
  els.modalEvolveArt.innerHTML = petArtHtml(am.lineId, nk);
  els.modalEvolveInto.textContent = "Becomes: " + nextNode.name;
  els.modalEvolve.dataset.nextKey = nk;
  els.modalEvolve.classList.add("open");
  playEvolveOpenCelebration(am.lineId);
}

export function closeEvolvePreviewModal() {
  if (!els.modalEvolve) return;
  els.modalEvolve.classList.remove("open");
  delete els.modalEvolve.dataset.nextKey;
  clearEvolveModalFx();
}

export function renderAndOpenEvolvePickModal(L, choiceKeys) {
  const am = _am(null);
  if (!els.modalEvolvePick || !els.modalEvolvePickOptions || !L || !choiceKeys.length || !am) return;
  const prev = getCurrentNode(L, am.nodeKey);
  const anyCross = choiceKeys.some(function (k) {
    return isCrossBranchLegendEvolution(L, am.nodeKey, k);
  });
  if (els.modalEvolvePickSub) {
    let sub = prev
      ? "Your " +
        prev.name +
        " can ascend along more than one path. Choose the form you commit to — this sets your epic branch."
      : "Choose the form you commit to.";
    if (anyCross) {
      sub +=
        " Alternate Tier V paths need 100 influence in each region that form demands, plus 5 favorite-type pantry foods when you confirm.";
    }
    els.modalEvolvePickSub.textContent = sub;
  }
  const parts = choiceKeys.map(function (key) {
    const n = nodeByKey(L, key);
    if (!n) return "";
    const bl = n.branch ? branchLabelForNodeBranch(n.branch) : "";
    const dReq = disciplineRequiredForTarget(L, am.nodeKey, key);
    const discHint =
      '<span class="evolve-pick-branch">Discipline ≥ ' + dReq + "</span>";
    const crossPath = isCrossBranchLegendEvolution(L, am.nodeKey, key);
    let infHintRaw = formatInfluenceGatesShort(L, key);
    if (crossPath) {
      const gates = evolveInfluenceGates(n);
      infHintRaw = gates.length
        ? gates
            .map(function (g) {
              return (REGION_LABEL[g.region] || g.region) + " ≥100";
            })
            .join(", ")
        : "";
    }
    const infHint = infHintRaw
      ? '<span class="evolve-pick-branch">Influence: ' + escapeHtml(infHintRaw) + "</span>"
      : "";
    const crossFoodHint = crossPath
      ? '<span class="evolve-pick-branch">Offering: 5× favorite pantry foods on confirm</span>'
      : "";
    const hintInner =
      (bl ? '<span class="evolve-pick-branch">' + escapeHtml(bl) + " mythos</span>" : "") +
      infHint +
      crossFoodHint +
      discHint;
    const metaBlock = hintInner
      ? '<div class="evolve-pick-card-meta">' + hintInner + "</div>"
      : "";
    return (
      '<button type="button" class="evolve-pick-card" data-pick-key="' +
      escapeHtml(key) +
      '">' +
      '<div class="evolve-pick-card-art">' +
      petArtHtml(am.lineId, key) +
      "</div>" +
      '<div class="evolve-pick-card-body">' +
      "<strong>" +
      escapeHtml(n.emoji + " " + n.name) +
      "</strong>" +
      '<span class="evolve-pick-card-rarity rarity-' +
      escapeHtml(n.rarity) +
      '">' +
      escapeHtml(n.rarity) +
      "</span>" +
      metaBlock +
      "</div></button>"
    );
  });
  els.modalEvolvePickOptions.className =
    "evolve-pick-options" + (choiceKeys.length > 1 ? " evolve-pick-options--multi" : "");
  els.modalEvolvePickOptions.innerHTML = parts.join("");
  els.modalEvolvePick.classList.add("open");
}

export function closeEvolvePickModal() {
  if (els.modalEvolvePick) els.modalEvolvePick.classList.remove("open");
}

export function clearEvolveModalFx() {
  if (els.evolveFxRoot) els.evolveFxRoot.innerHTML = "";
  if (els.modalEvolve) els.modalEvolve.classList.remove("evolve-opening");
}

export function evolveLineParticlePalette(lineId) {
  const lid = lineId || "avian";
  if (lid === "serpent") {
    return ["#34d399", "#2dd4bf", "#6ee7b7", "#10b981", "#5eead4", "#a7f3d0", "#fcd34d"];
  }
  if (lid === "trickster") {
    return ["#c084fc", "#e879f9", "#f472b6", "#a78bfa", "#f0abfc", "#fcd34d", "#fde68a"];
  }
  if (lid === "guardian") {
    return ["#fbbf24", "#f59e0b", "#d97706", "#fcd34d", "#fde68a", "#f97316", "#c084fc"];
  }
  return ["#7dd3fc", "#e0f2fe", "#38bdf8", "#fcd34d", "#fde68a", "#fbbf24", "#a5b4fc"];
}

export function spawnEvolveParticles(rootEl, count, optColors) {
  if (!rootEl) return;
  const colors =
    optColors && optColors.length
      ? optColors
      : ["#fcd34d", "#f59e0b", "#fbbf24", "#fde68a", "#c084fc", "#a78bfa", "#34d399", "#f472b6"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "evolve-particle";
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.45;
    const dist = 85 + Math.random() * 150;
    p.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--ty", Math.sin(ang) * dist + "px");
    const c = colors[i % colors.length];
    p.style.background = c;
    p.style.color = c;
    rootEl.appendChild(p);
    setTimeout(() => {
      if (p.parentNode) p.remove();
    }, 1100);
  }
}

export function spawnEvolveParticlesViewport(cx, cy, count, optColors) {
  const colors =
    optColors && optColors.length
      ? optColors
      : ["#fcd34d", "#f59e0b", "#fbbf24", "#fde68a", "#a78bfa", "#22d3ee"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "evolve-particle evolve-particle--fixed";
    p.style.left = cx + "px";
    p.style.top = cy + "px";
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 40 + Math.random() * 118;
    p.style.setProperty("--tx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--ty", Math.sin(ang) * dist + "px");
    const c = colors[i % colors.length];
    p.style.background = c;
    p.style.color = c;
    document.body.appendChild(p);
    setTimeout(() => {
      if (p.parentNode) p.remove();
    }, 1100);
  }
}

export function playEvolveOpenCelebration(optLineId) {
  clearEvolveModalFx();
  els.modalEvolve.classList.add("evolve-opening");
  setTimeout(() => els.modalEvolve.classList.remove("evolve-opening"), 800);
  const lineId = optLineId || (_am(null).lineId);
  spawnEvolveParticles(els.evolveFxRoot, 42, evolveLineParticlePalette(lineId));
  const box = els.modalEvolveBox;
  if (box) {
    box.classList.remove("evolve-modal-burst");
    void box.offsetWidth;
    box.classList.add("evolve-modal-burst");
    setTimeout(() => box.classList.remove("evolve-modal-burst"), 700);
  }
  const title = els.modalEvolveTitle;
  if (title) {
    title.classList.remove("evolve-title-shine");
    void title.offsetWidth;
    title.classList.add("evolve-title-shine");
    setTimeout(() => title.classList.remove("evolve-title-shine"), 1000);
  }
}

export function playEvolveConfirmCelebration(optLineId, optSlot) {
  const slot = optSlot != null ? optSlot : getActiveSlot();
  const portrait = (slot === 1 && els.petPortraitCompanion) ? els.petPortraitCompanion : els.petPortrait;
  if (!portrait) return;
  const lid = optLineId || (_am(null).lineId) || "avian";
  const palette = evolveLineParticlePalette(lid);
  const r = portrait.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  spawnEvolveParticlesViewport(cx, cy, 56, palette);
  portrait.classList.remove("evolve-flash");
  void portrait.offsetWidth;
  portrait.classList.add("evolve-flash");
  setTimeout(() => portrait.classList.remove("evolve-flash"), 1200);
}

export async function playEvolveAscendSequence(nk) {
  const am = _am(null);
  if (!am || !am.lineId) return;
  const slot = (am === state) ? 0 : 1;

  var crossParsed = parseCrossLineageKey(nk);
  var isCrossLineage = !!crossParsed;
  var targetLineId = isCrossLineage ? crossParsed.lineId : formLineIdFor(am);
  var targetNodeKey = isCrossLineage ? crossParsed.nodeKey : nk;

  const L0 = LINES[formLineIdFor(am)];
  const fromKey = am.nodeKey;
  const wasCrossBranch = !isCrossLineage && !!(L0 && isCrossBranchLegendEvolution(L0, fromKey, targetNodeKey));

  if (isCrossLineage) {
    consumeCrossLineageCost(am.lineId, targetLineId);
    pushLog("Offerings consumed for the cross-lineage rite — food and relics sacrificed.");
  } else if (wasCrossBranch) {
    const ate = consumeFavoriteFoods(am.lineId, CROSS_LEGEND_FOOD_COST);
    if (ate < CROSS_LEGEND_FOOD_COST) {
      pushLog("Cross-branch ascension aborted — not enough favorite-type foods in the pantry.");
      return;
    }
  }

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chargeMs = reduced ? 2000 : 7000;
  const lineId = targetLineId || "avian";
  const palette = evolveLineParticlePalette(lineId);

  // ── Show evolve stage ──
  const stageEl = document.getElementById("evolve-stage");
  const stagePet = document.getElementById("evolve-stage-pet");
  const stageArt = document.getElementById("evolve-stage-art");
  const stageLbl = document.getElementById("evolve-stage-lbl");
  if (stageArt) stageArt.innerHTML = petArtHtml(am.crossLineageId || am.lineId, am.nodeKey);
  if (stageLbl) { stageLbl.textContent = "Evolving…"; stageLbl.classList.remove("evolved"); }
  if (stageEl) {
    stageEl.className = "evolve-stage active --" + lineId;
    stageEl.removeAttribute("aria-hidden");
  }

  stopPetIdle();
  playEvolveChargeSfx(!reduced);

  let chargeOverlay = null;
  let particleTicker = null;
  if (!reduced) {
    chargeOverlay = document.createElement("div");
    chargeOverlay.className = "evolve-charge-overlay evolve-charge-overlay--" + lineId;
    chargeOverlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(chargeOverlay);
    particleTicker = window.setInterval(function () {
      const rEl = stagePet || els.petPortrait;
      if (!rEl) return;
      const r = rEl.getBoundingClientRect();
      spawnEvolveParticlesViewport(
        r.left + r.width / 2,
        r.top + r.height / 2,
        4 + ((Math.random() * 5) | 0),
        palette
      );
    }, 340);
  }
  if (stagePet) {
    stagePet.classList.remove("evolve-vibrate", "evolve-flash");
    void stagePet.offsetWidth;
    stagePet.classList.add("evolve-vibrate");
  }

  await sleepMs(chargeMs);

  if (particleTicker != null) { clearInterval(particleTicker); particleTicker = null; }
  if (chargeOverlay && chargeOverlay.parentNode) chargeOverlay.remove();
  if (stagePet) stagePet.classList.remove("evolve-vibrate");

  // ── Apply evolution ──
  am.nodeKey = targetNodeKey;
  if (isCrossLineage) am.crossLineageId = targetLineId;
  unlockTreeNode(targetLineId, targetNodeKey);
  ensureStatBonusRespectsBpCap(am);
  const h0 = am.happiness != null ? am.happiness : 0;
  am.happiness = clamp(h0 + 5, 0, 100);
  playMythMoodSfxForDelta(am.happiness - h0);
  am.energy = clamp((am.energy != null ? am.energy : 0) - 10, 0, 100);
  am.lifespan = clamp(
    Math.round((am.lifespan != null ? am.lifespan : 100) * 1.25),
    0,
    100
  );
  resetPettingCooldown();

  var evolvedNode = nodeByKey(LINES[targetLineId], targetNodeKey);
  var evolveMsg = "Evolved into " + (evolvedNode ? evolvedNode.name : targetNodeKey) + " — renewed vigor lengthens its days.";
  if (isCrossLineage) evolveMsg += " A cross-lineage transformation! Your myth transcends its origins.";
  else if (wasCrossBranch) evolveMsg += " Favorite foods were offered for the cross-branch rite.";
  pushLog(evolveMsg);
  renderPet();

  // ── Show new form on stage ──
  if (stageArt) stageArt.innerHTML = petArtHtml(targetLineId, targetNodeKey);
  if (stageLbl) { stageLbl.textContent = evolvedNode ? evolvedNode.name : "Ascended!"; stageLbl.classList.add("evolved"); }
  if (stagePet) {
    stagePet.classList.remove("evolve-flash");
    void stagePet.offsetWidth;
    stagePet.classList.add("evolve-flash");
    setTimeout(function () { stagePet.classList.remove("evolve-flash"); }, 1200);
  }

  playEvolveTransformSfx();
  const burst = document.createElement("div");
  burst.className = "evolve-transform-burst evolve-transform-burst--" + lineId;
  burst.setAttribute("aria-hidden", "true");
  document.body.appendChild(burst);
  setTimeout(function () { if (burst.parentNode) burst.remove(); }, 1450);
  playEvolveGrandSuccessSfx();

  // Celebrate with viewport particles centred on stage portrait
  if (stagePet) {
    const r = stagePet.getBoundingClientRect();
    spawnEvolveParticlesViewport(r.left + r.width / 2, r.top + r.height / 2, 56, palette);
  } else {
    playEvolveConfirmCelebration(lineId, slot);
  }

  restartPetIdle();

  try {
    incrementStat("totalEvolutions", 1);
    var xpAmount = 50;
    if (evolvedNode && evolvedNode.stage >= 4) xpAmount += 100;
    var xpRewards = await awardXp(xpAmount);
    if (xpRewards) showLevelUpIfNeeded(xpRewards);
  } catch (e) {}

  try {
    checkAchievement("sec_first_evolve", 1);
    incrementAchievement("evo_total_t1");
    checkTieredAchievements("evo_total", am.battles || 1);
    if (evolvedNode) {
      if (evolvedNode.stage >= 1) incrementAchievement("evo_tier2_t1");
      if (evolvedNode.stage >= 2) incrementAchievement("evo_tier3_t1");
      if (evolvedNode.stage >= 3) incrementAchievement("evo_tier4_t1");
      if (evolvedNode.stage >= 4) incrementAchievement("evo_tier5_t1");
    }
    if (isCrossLineage) incrementAchievement("evo_crossline_t1");
    if (wasCrossBranch) incrementAchievement("evo_cross_t1");
  } catch (e) {}

  if (_onAscendHook && evolvedNode) {
    try { _onAscendHook(evolvedNode); } catch (e) {}
  }

  saveGameState();

  // ── Return to Lair after reveal ──
  await sleepMs(2600);
  if (stageEl) { stageEl.className = "evolve-stage"; stageEl.setAttribute("aria-hidden", "true"); }
  try { closeLairSubpanels(); } catch (e) {}
}

export function applyDevEvolveToKey(nk, optLineId) {
  const am = _am(null);
  if (!nk || !am || !am.lineId) return;
  const targetLid = optLineId || (am.crossLineageId || am.lineId);
  const TL = LINES[targetLid];
  if (!TL) return;
  const node = nodeByKey(TL, nk);
  if (!node) return;
  const currentLid = am.crossLineageId || am.lineId;
  if (nk === am.nodeKey && targetLid === currentLid) {
    pushLog("[Dev] Already this form.");
    return;
  }
  am.nodeKey = nk;
  if (targetLid !== am.lineId) {
    am.crossLineageId = targetLid;
  } else {
    am.crossLineageId = null;
  }
  unlockTreeNode(targetLid, nk);
  ensureStatBonusRespectsBpCap(am);
  closeTreeLoreModal();
  closeTreeCompareModal();
  renderPet();
  renderTree();
  const homeL = LINES[am.lineId];
  const note = (targetLid !== am.lineId)
    ? " (cross-lineage from " + (homeL ? homeL.title : am.lineId) + ")"
    : "";
  pushLog("[Dev] Jumped to " + node.name + note + ".");
}
