// ============================================================
// shard_system.js — Memory Shard trigger engine.
//
// Listens for narrative events emitted by gameplay, decides which (if any)
// shards to unlock, and orchestrates: legacy persistence, panel display,
// Memories tab refresh, and downstream events (e.g., shard 10 name input).
//
// Event sources:
//   • cmm:shard-trigger detail = { source, ... }
//       sources: 'task_complete' | 'bond_filled' | 'campfire_upgrade'
//                | 'junk_clean' | 'level_reveal' | 'all_shards'
//   • Direct calls: shardSystem.onLevelReveal(lvl), shardSystem.onJunkLifetime(n), etc.
//
// Output:
//   • game.legacyStory.shards[idx] = true (committed to localStorage immediately)
//   • StoryPanel.show({ kind: 'shard', ... }) queued sequentially
//   • window.renderMemoriesGrid() refreshed
//   • CustomEvent 'cmm:shard-unlocked' { idx, total } dispatched for SFX/VFX hooks
//   • Shard 10 special: dispatches 'cmm:armName' so the campfire knows to pulse + accept input
// ============================================================

import { SHARDS } from '../data/shards.js';

export class ShardSystem {
  constructor(game) {
    this.game     = game;
    this._panelQ  = [];          // queued panel show calls (sequential)
    this._showing = false;
    this._installListeners();
  }

  _installListeners() {
    window.addEventListener('cmm:shard-trigger', (ev) => this._onTriggerEvent(ev.detail || {}));
  }

  // ── Public API: callers don't need to know about the event bus. ──
  onLevelReveal(level)        { this._eval('level_reveal',     { level }); }
  onCampfireUpgrade(upgradeId){ this._eval('campfire_upgrade', { upgradeId }); }
  onJunkLifetime(total)       { this._eval('junk_total',       { total }); }
  onTaskComplete(taskId)      { this._eval('task_complete',    { taskId }); }
  onBondFilled()              { this._eval('bond_filled',      {}); }

  _onTriggerEvent({ source, taskId, shardIdx, upgradeId, level, total }) {
    // Direct shard request (rare — used by tests / debug hooks)
    if (typeof shardIdx === 'number') {
      this._unlock(shardIdx, source || 'direct');
      return;
    }
    switch (source) {
      case 'task_complete':    return this.onTaskComplete(taskId);
      case 'bond_filled':      return this.onBondFilled();
      case 'campfire_upgrade': return this.onCampfireUpgrade(upgradeId);
      case 'junk_clean':       return this.onJunkLifetime(this.game.legacyStory?.junkLifetime || 0);
      case 'level_reveal':     return this.onLevelReveal(level || this.game.player?.stats?.level || 0);
      case 'all_shards':       return this._evalAllShards();
    }
  }

  // ── Core matching: find shards whose triggerType matches and condition is met. ──
  _eval(triggerType, payload) {
    const story = this.game.legacyStory;
    if (!story) return;
    for (const s of SHARDS) {
      if (s.triggerType !== triggerType) continue;
      if (story.shards[s.idx]) continue;             // already unlocked
      if (!this._matchCondition(s, payload)) continue;
      this._unlock(s.idx, triggerType);
    }
    // After any unlock, re-check Shard 10's "all others collected" alt-trigger.
    this._evalAllShards();
  }

  _matchCondition(s, payload) {
    const cond = s.triggerCondition || {};
    switch (s.triggerType) {
      case 'campfire_upgrade': return cond.upgradeId === payload.upgradeId;
      case 'level_reveal':     return (payload.level || 0) >= (cond.level || 0);
      case 'junk_total':       return (payload.total || 0) >= (cond.total || 0);
      case 'task_complete':    return cond.taskId === payload.taskId;
      case 'bond_filled':      return true;
      case 'all_shards':       return false;          // handled in _evalAllShards
    }
    return false;
  }

  _evalAllShards() {
    const story = this.game.legacyStory;
    if (!story) return;
    const shard10 = SHARDS[9];
    if (story.shards[9]) return;                              // already collected
    const otherCount = story.shards.slice(0, 9).filter(Boolean).length;
    const target     = shard10.triggerCondition?.othersCollected || 9;
    const fallback   = shard10.triggerCondition?.levelFallback   || 50;
    const lvl        = this.game.player?.stats?.level || 0;
    if (otherCount >= target || lvl >= fallback) {
      this._unlock(9, 'all_shards');
    }
  }

  // ── Unlock + panel queue. ─────────────────────────────────────────────
  _unlock(idx, source) {
    const game  = this.game;
    const story = game.legacyStory;
    if (!story || story.shards[idx]) return;
    const shard = SHARDS[idx];
    if (!shard) return;
    story.shards[idx] = true;
    story.shardCollectDate[idx] = new Date().toISOString();
    game._commitLegacyStory?.();
    // Achievement: shard_01 … shard_10 (key from GDD's `num` zero-padded string).
    game.ach?.set?.(`shard_${shard.num}`, 1);
    if (story.shards.every(Boolean)) {
      game.ach?.set?.('shards_all', 1);
    }
    this._panelQ.push(shard);
    this._pumpQueue();
    window.dispatchEvent(new CustomEvent('cmm:shard-unlocked', {
      detail: { idx, total: story.shards.filter(Boolean).length, source },
    }));
  }

  _pumpQueue() {
    if (this._showing || this._panelQ.length === 0) return;
    const shard = this._panelQ.shift();
    this._showing = true;
    window.StoryPanel?.show({
      kind:        'shard',
      icon:        shard.icon,
      kicker:      `Shard ${shard.num}`,
      title:       shard.title,
      lines:       shard.lines,
      typewriter:  25,
      lockUntil:   3000,
    }).then(() => {
      this._showing = false;
      // Refresh Memories grid count + tile state.
      window.renderMemoriesGrid?.();
      // Shard 10 unique post-action: arm the campfire for name input.
      if (shard.idx === 9) this._armNameInput();
      this._pumpQueue();
    });
  }

  // After Shard 10 reads, the campfire should pulse on its stone ring; the next
  // tap shows a name-input prompt instead of a daily-warmth line.
  _armNameInput() {
    const story = this.game.story?.flags;
    if (!story) return;
    story.nameInputArmed = true;
    this.game.saveGame?.();
    // Soft glow signal — campfire reads this flag in its render.
    if (this.game.campfire) this.game.campfire.pulseForName = true;
  }
}

// Re-readable shard text for the Memories tab.
export function getShardForReread(idx) { return SHARDS[idx] || null; }
