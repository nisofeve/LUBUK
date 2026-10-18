import { FOODS, RELIC_ITEMS, ensureFoodInventoryState, ensureRelicInventoryState } from './data.js';

function _randFood() {
  const pool = FOODS || [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function _randRelic() {
  const pool = RELIC_ITEMS || [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// Fixed descriptor per day — determines cell display + payout shape.
// Non-milestone days cycle food → stamina → pitis (mod 3).
// Milestones every 5th day include tickets, stamina top-ups, and grand prizes.
export function getRewardDescriptor(day) {
  if (day % 5 === 0) {
    switch (day) {
      case 5:  return { kind: 'food-pack', count: 3, icon: '🍱', amount: '×3',          label: '3 Foods' };
      case 10: return { kind: 'relic',     count: 1, icon: '🏺', amount: '×1',          label: '1 Relic' };
      case 15: return { kind: 'stamina',   val: 20,  icon: '⚡', amount: '+20 Stamina', label: '+20 Stamina' };
      case 20: return { kind: 'ticket',    count: 1, icon: '🎫', amount: '×1',          label: '1 Silver Ticket' };
      case 25: return { kind: 'mixed25',              icon: '🎁', amount: '3F+2⚽+🎫',  label: '3 Foods + 2 Balls + Ticket' };
      case 30: return { kind: 'grand',                icon: '👑', amount: 'Grand!',       label: 'All Relics + 3 Balls + Ticket' };
    }
  }
  const c = day % 3;
  if (c === 1) return { kind: 'food',    count: 1, icon: '🍖', amount: '×1',    label: '1 Food' };
  if (c === 2) return { kind: 'stamina', val: 10,  icon: '⚡', amount: '+10',    label: '+10 Stamina' };
  return       { kind: 'pitis',  val: 50,  icon: '🪙', amount: '50 P',   label: '50 Pitis' };
}

function _staminaMax(state) {
  const upg = (state && state.tamerUpgrades) || {};
  return 100 + (upg.staminaMax || 0) * 25;
}

function _resolveReward(day, state) {
  const d = getRewardDescriptor(day);
  const out = { foods: [], relics: [], balls: 0, stamina: 0, pitis: 0, tickets: 0 };
  switch (d.kind) {
    case 'food':
    case 'food-pack': {
      for (let i = 0; i < (d.count || 1); i++) {
        const f = _randFood();
        if (f) out.foods.push(f);
      }
      break;
    }
    case 'relic': {
      for (let i = 0; i < (d.count || 1); i++) {
        const r = _randRelic();
        if (r) out.relics.push(r);
      }
      break;
    }
    case 'stamina': {
      out.stamina = d.val || 10;
      break;
    }
    case 'pitis': {
      out.pitis = d.val || 50;
      break;
    }
    case 'ticket': {
      out.tickets = d.count || 1;
      break;
    }
    case 'mixed25': {
      for (let i = 0; i < 3; i++) {
        const f = _randFood();
        if (f) out.foods.push(f);
      }
      out.balls = 2;
      out.tickets = 1;
      break;
    }
    case 'grand': {
      for (let i = 0; i < (RELIC_ITEMS || []).length; i++) {
        out.relics.push(RELIC_ITEMS[i]);
      }
      out.balls = 3;
      out.tickets = 1;
      break;
    }
  }
  return out;
}

function _todayStr() {
  return new Date().toDateString();
}

function _daysBetween(a, b) {
  const ta = new Date(a).setHours(0, 0, 0, 0);
  const tb = new Date(b).setHours(0, 0, 0, 0);
  return Math.round((tb - ta) / 86400000);
}

export function ensureDailiesState(state) {
  if (!state) return;
  if (!state.dailies || typeof state.dailies !== 'object') {
    state.dailies = { streak: 0, lastClaimedDate: null };
  }
  if (typeof state.dailies.streak !== 'number') state.dailies.streak = 0;
  if (state.dailies.lastClaimedDate === undefined) state.dailies.lastClaimedDate = null;
}

export function handleDailyRollover(state) {
  ensureDailiesState(state);
  const d = state.dailies;
  if (!d.lastClaimedDate) return;
  const today = _todayStr();
  const gap = _daysBetween(d.lastClaimedDate, today);
  if (gap <= 0) return;
  if (gap >= 2) {
    d.streak = 0;
  } else if (d.streak >= 30) {
    d.streak = 0;
  }
}

export function getCurrentDay(state) {
  ensureDailiesState(state);
  const s = state.dailies.streak || 0;
  if (s >= 30) return 1;
  return s + 1;
}

export function canClaimToday(state) {
  ensureDailiesState(state);
  return state.dailies.lastClaimedDate !== _todayStr();
}

export function claimToday(state) {
  if (!canClaimToday(state)) return null;
  ensureFoodInventoryState();
  ensureRelicInventoryState();
  handleDailyRollover(state);
  const day = getCurrentDay(state);
  const reward = _resolveReward(day, state);
  for (const f of reward.foods) {
    state.foodInventory[f.id] = (state.foodInventory[f.id] || 0) + 1;
  }
  for (const r of reward.relics) {
    state.relicInventory[r.id] = (state.relicInventory[r.id] || 0) + 1;
  }
  if (reward.balls) {
    state.playBalls = (state.playBalls || 0) + reward.balls;
  }
  if (reward.stamina) {
    const cur = state.playerStamina != null ? state.playerStamina : _staminaMax(state);
    state.playerStamina = Math.min(cur + reward.stamina, _staminaMax(state));
  }
  if (reward.pitis) {
    state.pitis = (state.pitis || 0) + reward.pitis;
  }
  if (reward.tickets) {
    state.silverTickets = Math.min((state.silverTickets || 0) + reward.tickets, 7);
  }
  state.dailies.streak = (state.dailies.streak || 0) + 1;
  if (state.dailies.streak > 30) state.dailies.streak = 30;
  state.dailies.lastClaimedDate = _todayStr();
  return { day, reward };
}

// Cell status: 'claimed' | 'current' | 'locked'
export function getCellsForUi(state) {
  ensureDailiesState(state);
  const streak = state.dailies.streak || 0;
  const currentDay = getCurrentDay(state);
  const claimable = canClaimToday(state);
  const cells = [];
  for (let day = 1; day <= 30; day++) {
    const descriptor = getRewardDescriptor(day);
    let status;
    if (day === currentDay && claimable) {
      status = 'current';
    } else if (day <= streak) {
      status = 'claimed';
    } else {
      status = 'locked';
    }
    cells.push({ day, status, descriptor });
  }
  return cells;
}
