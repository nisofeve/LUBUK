import { state } from './state.js';
import { FOODS, RELIC_ITEMS, ensureFoodInventoryState, ensureRelicInventoryState } from './data.js';
import { els, pushLog } from './ui.js';

const CHECK_INTERVAL_MS = 180000; // 3 minutes
const EVENT_CHANCE = 0.40;
const BANNER_AUTO_DISMISS_MS = 20000;

let intervalId = null;
let dismissTimeoutId = null;

const EVENTS = [
  {
    id: "gift_food",
    label: "A mysterious visitor left food at the entrance!",
    emoji: "🎁",
    apply(st) {
      const foods = FOODS || [];
      if (!foods.length) return false;
      ensureFoodInventoryState();
      const food = foods[Math.floor(Math.random() * foods.length)];
      st.foodInventory[food.id] = (st.foodInventory[food.id] || 0) + 2;
      return food.name + " x2 added to pantry.";
    },
  },
  {
    id: "energy_surge",
    label: "A warm ley-line pulse flows through the lair!",
    emoji: "⚡",
    apply(st) {
      if (st.energy >= 100) return false;
      const gain = Math.min(20, 100 - st.energy);
      st.energy = Math.min(100, st.energy + gain);
      return "+" + gain + " Energy.";
    },
  },
  {
    id: "berry_blessing",
    label: "Spirit light blooms — the berry ripens early!",
    emoji: "🍇",
    apply(st) {
      if (st.spiritBerryRipeAt == null) return false;
      st.spiritBerryRipeAt = Date.now();
      return "Spirit Berry is now ripe.";
    },
  },
  {
    id: "star_alignment",
    label: "Stars align over your myth's homeland!",
    emoji: "⭐",
    apply(st) {
      if (!st.lineId) return false;
      const reg = _homeRegion(st.lineId);
      if (!reg) return false;
      if (!st.influence) st.influence = {};
      st.influence[reg] = (st.influence[reg] || 0) + 6;
      return "+6 " + reg + " influence.";
    },
  },
  {
    id: "cursed_wind",
    label: "A cursed wind howls through the lair...",
    emoji: "🌪️",
    apply(st) {
      st.happiness = Math.max(0, (st.happiness || 0) - 8);
      st.energy = Math.max(0, (st.energy || 0) - 5);
      return "-8 Happiness, -5 Energy.";
    },
  },
  {
    id: "relic_cache",
    label: "A hidden cache of relics was unearthed!",
    emoji: "🏺",
    apply(st) {
      const relics = RELIC_ITEMS || [];
      if (!relics.length) return false;
      ensureRelicInventoryState();
      const relic = relics[Math.floor(Math.random() * relics.length)];
      st.relicInventory[relic.id] = (st.relicInventory[relic.id] || 0) + 1;
      return relic.name + " added to relics.";
    },
  },
];

const REGION_BY_LINE = {
  avian: "greek",
  trickster: "japan",
  serpent: "sea",
  guardian: "egypt",
};

function _homeRegion(lineId) {
  return REGION_BY_LINE[lineId] || null;
}

function _pickEvent() {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}

function _tick() {
  if (!state || !state.lineId) return;
  if (Math.random() > EVENT_CHANCE) return;
  const ev = _pickEvent();
  const detail = ev.apply(state);
  if (detail === false) return;
  _showBanner(ev, detail);
  pushLog("[Lair Event] " + ev.label + (detail ? " " + detail : ""));
}

function _showBanner(ev, detail) {
  const banner = els.lairEventBanner;
  if (!banner) return;
  const msgEl = banner.querySelector(".lair-event-msg");
  const detailEl = banner.querySelector(".lair-event-detail");
  const iconEl = banner.querySelector(".lair-event-icon");
  if (iconEl) iconEl.textContent = ev.emoji;
  if (msgEl) msgEl.textContent = ev.label;
  if (detailEl) detailEl.textContent = detail || "";
  banner.classList.add("open");
  if (dismissTimeoutId) clearTimeout(dismissTimeoutId);
  dismissTimeoutId = setTimeout(hideLairEventBanner, BANNER_AUTO_DISMISS_MS);
}

export function hideLairEventBanner() {
  if (dismissTimeoutId) { clearTimeout(dismissTimeoutId); dismissTimeoutId = null; }
  const banner = els.lairEventBanner;
  if (banner) banner.classList.remove("open");
}

export function startLairEvents() {
  if (intervalId !== null) return;
  intervalId = setInterval(_tick, CHECK_INTERVAL_MS);
}

export function stopLairEvents() {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  hideLairEventBanner();
}
