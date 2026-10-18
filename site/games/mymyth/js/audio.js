// ── MyMyth Audio Module (Web Audio API) ──────────────────────────────
// Standalone — no imports. Uses only the Web Audio API.

let battleAudioCtx = null;
let lairAmbientState = null;
let adventureBattleBgmState = null;
let _pendingAmbientLineId = null;
let _audioUnlockInstalled = false;

function _isSoundEnabled() {
  try {
    var raw = localStorage.getItem("mymyth_settings");
    if (!raw) return true;
    var s = JSON.parse(raw);
    return s && s.soundEnabled !== undefined ? !!s.soundEnabled : true;
  } catch (e) { return true; }
}

/* ── File-based audio player ────────────────────────────────────────── */

const _sfxCache = new Map(); // path → Promise<AudioBuffer|null>

function _loadBuffer(path) {
  if (_sfxCache.has(path)) return _sfxCache.get(path);
  // Capture (or create) ctx synchronously to avoid multi-context race on concurrent loads.
  if (!battleAudioCtx) battleAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var ctx = battleAudioCtx;
  var p = fetch(path)
    .then(function(r) { return r.arrayBuffer(); })
    .then(function(ab) { return ctx.decodeAudioData(ab); })
    .catch(function() { return null; });
  _sfxCache.set(path, p);
  return p;
}

function _playOneShot(path, vol) {
  _loadBuffer(path).then(function(buf) {
    if (!buf) return;
    var ctx = getBattleAudioCtx();
    if (!ctx) return;
    var src = ctx.createBufferSource();
    var g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = vol != null ? vol : 0.8;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  }).catch(function() {});
}

/* ── City Map BGM ───────────────────────────────────────────────────── */

let _cityMapBgmState = null;
let _pendingCityMapBgm = false;

export function startCityMapBgm() {
  if (_cityMapBgmState) return;
  _loadBuffer("assets/SFX/01_BGM/bgm_city_map.mp3").then(function(buf) {
    if (!buf || _cityMapBgmState) return;
    var ctx = getBattleAudioCtx();
    if (!ctx) {
      _pendingCityMapBgm = true; // queue for first user gesture
      return;
    }
    _pendingCityMapBgm = false;
    var src = ctx.createBufferSource();
    var g = ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.5);
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
    _cityMapBgmState = { src: src, gain: g, ctx: ctx };
  }).catch(function() {});
}

export function stopCityMapBgm() {
  var s = _cityMapBgmState;
  _cityMapBgmState = null;
  if (!s) return;
  try {
    var t = s.ctx.currentTime;
    s.gain.gain.cancelScheduledValues(t);
    var cur = Math.max(0.0001, s.gain.gain.value);
    s.gain.gain.setValueAtTime(cur, t);
    s.gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    window.setTimeout(function() { try { s.src.stop(); } catch (e2) {} }, 1300);
  } catch (e) {}
}

/* ── End City Map BGM ───────────────────────────────────────────────── */

/** Suspend/resume the shared AudioContext when the user toggles sound in settings. */
export function setSoundEnabled(enabled) {
  if (enabled) {
    resumeBattleAudioIfNeeded();
  } else if (battleAudioCtx) {
    try { battleAudioCtx.suspend(); } catch (e) {}
  }
}

function flushPendingAmbient() {
  if (_pendingCityMapBgm) {
    _pendingCityMapBgm = false;
    startCityMapBgm();
    return;
  }
  if (_pendingAmbientLineId == null) return;
  var lid = _pendingAmbientLineId;
  _pendingAmbientLineId = null;
  startLairAmbient(lid);
}

/** Call from real user events (click/tap/key) so the context can transition to "running". */
export function resumeBattleAudioIfNeeded() {
  if (!_isSoundEnabled()) return;
  if (!battleAudioCtx) {
    battleAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  var p = battleAudioCtx.resume();
  if (p && typeof p.then === "function") {
    p.then(function () { flushPendingAmbient(); }).catch(function () {});
  } else {
    flushPendingAmbient();
  }
}

/** Registers listeners so the first tap/key unlocks audio (needed after auto-resume from save). */
export function installAudioUserGestureUnlock() {
  if (_audioUnlockInstalled || typeof document === "undefined") return;
  _audioUnlockInstalled = true;
  function onGesture() {
    resumeBattleAudioIfNeeded();
  }
  document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
  document.addEventListener("keydown", onGesture, { capture: true, passive: true });
  document.addEventListener("touchstart", onGesture, { capture: true, passive: true });
}

/**
 * Returns the shared AudioContext only while running. If suspended (no user gesture yet, or
 * sound disabled in settings), returns null so callers skip oscillator.start.
 */
export function getBattleAudioCtx() {
  if (!_isSoundEnabled()) return null;
  if (!battleAudioCtx) {
    battleAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (battleAudioCtx.state !== "running") {
    return null;
  }
  return battleAudioCtx;
}

/* ── Lair Ambient Soundscape ────────────────────────────────────────── */

var LAIR_AMBIENT_PROFILES = {
  avian:     { drone: 110,   pad: [164.81, 196.00, 246.94], shimmer: 1318, arpNotes: [329.63, 392.00, 493.88, 659.25], tempo: 3200, filterQ: 1.8 },
  serpent:   { drone: 73.42, pad: [110.00, 146.83, 174.61], shimmer: 880,  arpNotes: [220.00, 261.63, 329.63, 440.00], tempo: 4000, filterQ: 2.4 },
  trickster: { drone: 98,    pad: [146.83, 185.00, 220.00], shimmer: 1046, arpNotes: [293.66, 349.23, 440.00, 523.25], tempo: 2800, filterQ: 1.2 },
  guardian:  { drone: 82.41, pad: [123.47, 155.56, 185.00], shimmer: 987,  arpNotes: [246.94, 293.66, 369.99, 493.88], tempo: 3600, filterQ: 2.0 },
};

export function startLairAmbient(lineId) {
  stopLairAmbient();
  var prof = LAIR_AMBIENT_PROFILES[lineId];
  if (!prof) return;
  var ctx = getBattleAudioCtx();
  if (!ctx) {
    _pendingAmbientLineId = lineId;
    return;
  }
  try {
    var master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2.5);
    master.connect(ctx.destination);

    var drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.setValueAtTime(prof.drone, ctx.currentTime);
    var droneG = ctx.createGain();
    droneG.gain.setValueAtTime(0.06, ctx.currentTime);
    drone.connect(droneG);
    droneG.connect(master);
    drone.start(ctx.currentTime);

    var drone2 = ctx.createOscillator();
    drone2.type = "triangle";
    drone2.frequency.setValueAtTime(prof.drone * 2.005, ctx.currentTime);
    var drone2G = ctx.createGain();
    drone2G.gain.setValueAtTime(0.018, ctx.currentTime);
    drone2.connect(drone2G);
    drone2G.connect(master);
    drone2.start(ctx.currentTime);

    var padOscs = [];
    for (var pi = 0; pi < prof.pad.length; pi++) {
      var po = ctx.createOscillator();
      po.type = "sine";
      po.frequency.setValueAtTime(prof.pad[pi], ctx.currentTime);
      var pg = ctx.createGain();
      pg.gain.setValueAtTime(0.016, ctx.currentTime);
      var pf = ctx.createBiquadFilter();
      pf.type = "lowpass";
      pf.frequency.setValueAtTime(600 + pi * 200, ctx.currentTime);
      pf.Q.setValueAtTime(prof.filterQ, ctx.currentTime);
      po.connect(pg);
      pg.connect(pf);
      pf.connect(master);
      po.start(ctx.currentTime);
      padOscs.push(po);
    }

    var shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(prof.shimmer, ctx.currentTime);
    var shimG = ctx.createGain();
    shimG.gain.setValueAtTime(0, ctx.currentTime);
    shimmer.connect(shimG);
    shimG.connect(master);
    shimmer.start(ctx.currentTime);

    var arpStep = 0;
    var arpIntId = window.setInterval(function () {
      if (!lairAmbientState) return;
      try {
        var ac = lairAmbientState.ctx;
        var t = ac.currentTime;
        var noteIdx = arpStep % prof.arpNotes.length;
        arpStep++;
        var freq = prof.arpNotes[noteIdx];
        var o = ac.createOscillator();
        var g = ac.createGain();
        o.type = noteIdx % 2 === 0 ? "sine" : "triangle";
        o.frequency.setValueAtTime(freq, t);
        o.connect(g);
        g.connect(lairAmbientState.master);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        o.start(t);
        o.stop(t + 1.7);

        shimG.gain.cancelScheduledValues(t);
        shimG.gain.setValueAtTime(0.005, t + 0.05);
        shimG.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      } catch (e) {}
    }, prof.tempo);

    lairAmbientState = {
      ctx: ctx, master: master, drone: drone, drone2: drone2,
      padOscs: padOscs, shimmer: shimmer, shimG: shimG, arpIntId: arpIntId,
    };
  } catch (e) {}
}

export function stopLairAmbient() {
  var s = lairAmbientState;
  lairAmbientState = null;
  if (!s) return;
  try {
    window.clearInterval(s.arpIntId);
    var t = s.ctx.currentTime;
    s.master.gain.cancelScheduledValues(t);
    var gv = Math.max(0.0001, s.master.gain.value);
    s.master.gain.setValueAtTime(gv, t);
    s.master.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    var stopAt = t + 1.6;
    try { s.drone.stop(stopAt); } catch (e) {}
    try { s.drone2.stop(stopAt); } catch (e) {}
    try { s.shimmer.stop(stopAt); } catch (e) {}
    for (var i = 0; i < s.padOscs.length; i++) {
      try { s.padOscs[i].stop(stopAt); } catch (e) {}
    }
    window.setTimeout(function () {
      try { s.drone.disconnect(); } catch (e) {}
      try { s.drone2.disconnect(); } catch (e) {}
      try { s.shimmer.disconnect(); } catch (e) {}
      try { s.shimG.disconnect(); } catch (e) {}
      for (var j = 0; j < s.padOscs.length; j++) {
        try { s.padOscs[j].disconnect(); } catch (e) {}
      }
      try { s.master.disconnect(); } catch (e) {}
    }, 1800);
  } catch (e) {}
}

/* ── End Lair Ambient ───────────────────────────────────────────────── */

export function stopAdventureBattleBgm() {
  const s = adventureBattleBgmState;
  adventureBattleBgmState = null;
  if (!s) return;
  try {
    window.clearInterval(s.intId);
    const ac = s.ctx;
    const t = ac.currentTime;
    s.master.gain.cancelScheduledValues(t);
    const gv = Math.max(0.0001, s.master.gain.value);
    s.master.gain.setValueAtTime(gv, t);
    s.master.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    try {
      s.bass.stop(t + 0.42);
    } catch (e0) {}
    window.setTimeout(function () {
      try {
        s.bass.disconnect();
        s.bassG.disconnect();
        s.master.disconnect();
      } catch (e1) {}
    }, 480);
  } catch (e) {}
}

/** Looping Web Audio "battle march" for adventure foe reveal through combat until stopAdventureBattleBgm. */
export function playAdventureBattleBgm() {
  stopAdventureBattleBgm();
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const master = ctx.createGain();
    const t0 = ctx.currentTime + 0.02;
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.15, t0 + 0.28);
    master.connect(ctx.destination);
    const bass = ctx.createOscillator();
    bass.type = "sawtooth";
    bass.frequency.setValueAtTime(65, t0);
    const bassG = ctx.createGain();
    bassG.gain.setValueAtTime(0.038, t0);
    bass.connect(bassG);
    bassG.connect(master);
    bass.start(t0);
    const pattern = [220, 277, 329, 392, 329, 277, 246, 293, 349, 293];
    let step = 0;
    function pling() {
      if (!adventureBattleBgmState) return;
      const f = pattern[step % pattern.length];
      step++;
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, now);
      o.connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.085, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      o.start(now);
      o.stop(now + 0.15);
    }
    const intId = window.setInterval(pling, 168);
    pling();
    adventureBattleBgmState = { ctx: ctx, master: master, bass: bass, bassG: bassG, intId: intId };
  } catch (e) {}
}

export function playDemandAttentionCallSfx(lineId, kind) {
  _playOneShot("assets/SFX/05_SFX_lair_care_interaction_M4A/sfx_demand_call.m4a", 0.8);
}

export function playPetFurryClickSfx() {
  _playOneShot("assets/SFX/05_SFX_lair_care_interaction_M4A/sfx_pet_click.m4a", 0.75);
}

export function playMythHappySfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_happy.m4a", 0.8);
}

export function playMythSadSfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_sad.m4a", 0.8);
}

export function playMythTiredSfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_tired.m4a", 0.75);
}

export function playBallKickSfx() {
  _playOneShot("assets/SFX/04_SFX_ball_play_M4A/sfx_ball_kick.m4a", 0.9);
}

export function playBallBounceSfx() {
  _playOneShot("assets/SFX/04_SFX_ball_play_M4A/sfx_ball_bounce.m4a", 0.8);
}

export function playFriendRequestSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_ui_notification_ping.m4a", 0.7);
}

export function playPvpVictorySfx() {
  _playOneShot("assets/SFX/06_SFX_battle_general_M4A/sfx_battle_win.m4a", 0.85);
}

export function playPvpDefeatSfx() {
  _playOneShot("assets/SFX/06_SFX_battle_general_M4A/sfx_battle_loss.m4a", 0.8);
}

export function playTiredRefuseSfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_tired_refuse.m4a", 0.75);
}

export function playMythRefuseFoodSfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_refuse_food.m4a", 0.75);
}

export function playMythMoodSfxForDelta(delta) {
  if (delta > 0) playMythHappySfx();
  else if (delta < 0) playMythSadSfx();
}

export function playMythAngrySfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_angry.m4a", 0.8);
}

/** Munch / bite when feeding (pantry or spirit berry). tier: favorite | mediocre | hate | berry */
export function playMythEatSfx(tier) {
  var file = tier === "berry" ? "sfx_myth_eat_berry"
           : tier === "favorite" ? "sfx_myth_eat_favorite"
           : tier === "hate" ? "sfx_myth_eat_hate"
           : "sfx_myth_eat_mediocre";
  _playOneShot("assets/SFX/03_SFX_eating_feeding_M4A/" + file + ".m4a", 0.75);
}

/**
 * Continuous "falling" SFX for the full drop duration; call stop() right before land thud.
 * Returns a no-op stop if audio cannot start.
 */
export function startLairDropContinuousSfx(durationMs) {
  var src = null;
  var stopped = false;
  _loadBuffer("assets/SFX/05_SFX_lair_care_interaction_M4A/sfx_lair_drop_falling.m4a").then(function(buf) {
    if (stopped || !buf) return;
    var ctx = getBattleAudioCtx();
    if (!ctx) return;
    src = ctx.createBufferSource();
    var g = ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.value = 0.7;
    src.connect(g);
    g.connect(ctx.destination);
    src.start();
  }).catch(function() {});
  return function stopLairDropContinuousSfx() {
    stopped = true;
    if (src) { try { src.stop(); } catch (e) {} }
  };
}

export function playLairDropThudSfx() {
  _playOneShot("assets/SFX/05_SFX_lair_care_interaction_M4A/sfx_lair_drop_thud.m4a", 0.9);
}

export function playMythCuriousSfx() {
  _playOneShot("assets/SFX/02_SFX_myth_mood_reaction_M4A/sfx_myth_curious.m4a", 0.8);
}

/** Short munch burst during lair eat phase (tier matches playMythEatSfx). */
export function playLairMunchBurstSfx(tier) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.004;
    const hate = tier === "hate";
    const berry = tier === "berry";
    const fav = tier === "favorite";
    const clickHi = berry ? 720 : fav ? 680 : hate ? 420 : 560;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.setValueAtTime(clickHi, t0);
    o.frequency.exponentialRampToValueAtTime(110, t0 + 0.038);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(hate ? 0.026 : 0.038, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.055);
    o.start(t0);
    o.stop(t0 + 0.06);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "triangle";
    o2.frequency.setValueAtTime(berry ? 165 : 142, t0 + 0.01);
    o2.frequency.exponentialRampToValueAtTime(58, t0 + 0.07);
    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(0.034, t0 + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    o2.start(t0);
    o2.stop(t0 + 0.1);
  } catch (e) {}
}

/** Resonant burst for relic influence chew phase (region keys: greek|japan|sea|egypt). */
export function playLairRelicInfluenceBurstSfx(region) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const base =
      region === "japan" ? 392 : region === "sea" ? 349.23 : region === "egypt" ? 311.13 : 440;
    const t0 = ctx.currentTime + 0.006;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(base * 0.5, t0);
    o.frequency.linearRampToValueAtTime(base, t0 + 0.08);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.065, t0 + 0.028);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
    o.start(t0);
    o.stop(t0 + 0.45);
    const t1 = t0 + 0.05;
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "triangle";
    o2.frequency.setValueAtTime(base * 1.5, t1);
    o2.frequency.exponentialRampToValueAtTime(base * 0.75, t1 + 0.16);
    g2.gain.setValueAtTime(0, t1);
    g2.gain.linearRampToValueAtTime(0.04, t1 + 0.022);
    g2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.36);
    o2.start(t1);
    o2.stop(t1 + 0.38);
  } catch (e) {}
}

export function playBattleSfx(isWin) {
  _playOneShot(
    isWin ? "assets/SFX/06_SFX_battle_general_M4A/sfx_battle_win.m4a"
           : "assets/SFX/06_SFX_battle_general_M4A/sfx_battle_loss.m4a",
    0.85
  );
}

export function playBattleLootChimeSfx() {
  _playOneShot("assets/SFX/06_SFX_battle_general_M4A/sfx_battle_loot_chime.m4a", 0.8);
}

export function playBattleHitSfx() {
  _playOneShot("assets/SFX/06_SFX_battle_general_M4A/sfx_battle_hit.m4a", 0.9);
}

export function playBattleEvadeSfx() {
  _playOneShot("assets/SFX/06_SFX_battle_general_M4A/sfx_battle_evade.m4a", 0.85);
}

/** extended: true = ~7s build-up for evolution charge; false = short cue. */
export function playEvolveChargeSfx(extended) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    const dur = extended ? 6.88 : 1.95;
    const endHz = extended ? 392 : 240;
    o.frequency.setValueAtTime(52, t0);
    o.frequency.exponentialRampToValueAtTime(endHz, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(extended ? 0.065 : 0.075, t0 + 0.22);
    g.gain.setValueAtTime(extended ? 0.065 : 0.075, t0 + dur - 0.28);
    g.gain.linearRampToValueAtTime(0.001, t0 + dur + 0.12);
    o.start(t0);
    o.stop(t0 + dur + 0.15);
  } catch (e) {}
}

export function playEvolveGrandSuccessSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const chord = [392, 523.25, 659.25, 783.99];
    for (let i = 0; i < chord.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = chord[i];
      const ti = t0 + i * 0.045;
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.1 - i * 0.014, ti + 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, ti + 1.35);
      o.start(ti);
      o.stop(ti + 1.42);
    }
    for (let j = 0; j < 6; j++) {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.type = "sine";
      o2.frequency.value = 1318.5 + j * 180;
      const tj = t0 + 0.18 + j * 0.05;
      g2.gain.setValueAtTime(0, tj);
      g2.gain.linearRampToValueAtTime(0.04, tj + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.001, tj + 0.22);
      o2.start(tj);
      o2.stop(tj + 0.26);
    }
  } catch (e) {}
}

export function playAdventureRunWhooshSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(380, t0);
    o.frequency.exponentialRampToValueAtTime(95, t0 + 0.42);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.038, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48);
    o.start(t0);
    o.stop(t0 + 0.52);
  } catch (e) {}
}

export function playAdventureRunFootstepSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.008;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.setValueAtTime(88, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.055);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.038, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);
    o.start(t0);
    o.stop(t0 + 0.075);
  } catch (e) {}
}

/** Soft footfalls while the myth drifts in the lair (quieter than adventure sprint steps). */
export function playMythLairWalkFootstepSfx(phase) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.008;
    const mul = phase & 1 ? 1.07 : 0.96;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.setValueAtTime(78 * mul, t0);
    o.frequency.exponentialRampToValueAtTime(34 * mul, t0 + 0.06);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.024, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    o.start(t0);
    o.stop(t0 + 0.08);
  } catch (e) {}
}

/** Short growl/roar when adventure foe snaps to attack pose. */
export function playAdventureFoeRoarSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.015;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.22, t0 + 0.04);
    master.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
    master.connect(ctx.destination);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(195, t0);
    o.frequency.exponentialRampToValueAtTime(72, t0 + 0.28);
    o.connect(og);
    og.connect(master);
    og.gain.setValueAtTime(0.11, t0);
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.2), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = b;
    const ng = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(420, t0);
    filter.frequency.exponentialRampToValueAtTime(180, t0 + 0.22);
    filter.Q.setValueAtTime(1.2, t0);
    noise.connect(ng);
    ng.connect(filter);
    filter.connect(master);
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(0.14, t0 + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    o.start(t0);
    o.stop(t0 + 0.36);
    noise.start(t0);
    noise.stop(t0 + 0.22);
  } catch (e) {}
}

export function playEvolveTransformSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const freqs = [392, 523.25, 659.25];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "triangle";
      o.frequency.value = freqs[i];
      const ti = t0 + i * 0.045;
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.1, ti + 0.035);
      g.gain.exponentialRampToValueAtTime(0.001, ti + 0.48);
      o.start(ti);
      o.stop(ti + 0.52);
    }
  } catch (e) {}
}

/** When the player's Aegis absorbs a hit (special or normal strike). */
export function playAegisShieldShatterSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.012;
    const freqs = [2093, 1760, 1568, 1318.51, 1046.5, 880];
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = i < 2 ? "square" : "triangle";
      const ti = t0 + i * 0.017;
      o.frequency.setValueAtTime(freqs[i], ti);
      o.frequency.exponentialRampToValueAtTime(Math.max(80, freqs[i] * 0.45), ti + 0.11);
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(0.062 - i * 0.0065, ti + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ti + 0.22);
      o.start(ti);
      o.stop(ti + 0.26);
    }
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "sine";
    o2.frequency.setValueAtTime(523.25, t0 + 0.04);
    o2.frequency.exponentialRampToValueAtTime(98, t0 + 0.24);
    g2.gain.setValueAtTime(0, t0 + 0.04);
    g2.gain.linearRampToValueAtTime(0.04, t0 + 0.055);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
    o2.start(t0 + 0.04);
    o2.stop(t0 + 0.36);
  } catch (e) {}
}

export function playAegisReflectLaunchSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.008;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(380, t0);
    o.frequency.exponentialRampToValueAtTime(2100, t0 + 0.065);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.048, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
    o.start(t0);
    o.stop(t0 + 0.13);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "sine";
    o2.frequency.setValueAtTime(720, t0 + 0.018);
    o2.frequency.linearRampToValueAtTime(1240, t0 + 0.075);
    g2.gain.setValueAtTime(0, t0 + 0.018);
    g2.gain.linearRampToValueAtTime(0.042, t0 + 0.028);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    o2.start(t0 + 0.018);
    o2.stop(t0 + 0.14);
  } catch (e) {}
}

export function playAegisReflectImpactSfx() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "square";
    o.frequency.setValueAtTime(165, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.13);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.078, t0 + 0.011);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.19);
    o.start(t0);
    o.stop(t0 + 0.22);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.type = "triangle";
    o2.frequency.setValueAtTime(1046.5, t0 + 0.025);
    o2.frequency.exponentialRampToValueAtTime(220, t0 + 0.11);
    g2.gain.setValueAtTime(0, t0 + 0.025);
    g2.gain.linearRampToValueAtTime(0.038, t0 + 0.035);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    o2.start(t0 + 0.025);
    o2.stop(t0 + 0.17);
  } catch (e) {}
}

export function playComicShoutStinger() {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.004;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(190, t0 + 0.048);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.052, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.085);
    o.start(t0);
    o.stop(t0 + 0.1);
  } catch (e) {}
}

export function playBattleWindupNoiseLayer(ctx, t0) {
  try {
    const dur = 1.72;
    const nFrames = Math.max(400, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, nFrames, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < nFrames; i++) {
      const t = i / nFrames;
      ch[i] = (Math.random() * 2 - 1) * 0.22 * (0.35 + t * t);
    }
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    f.type = "lowpass";
    f.frequency.setValueAtTime(2400, t0);
    f.frequency.exponentialRampToValueAtTime(140, t0 + dur);
    f.Q.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.038, t0 + 0.35);
    g.gain.linearRampToValueAtTime(0.055, t0 + 1.2);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.08);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  } catch (e) {}
}

export function playBattleLaunchWhoosh(ctx, t0, bright) {
  try {
    const dur = 0.11;
    const nFrames = Math.max(200, Math.ceil(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, nFrames, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < nFrames; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / nFrames) * (bright || 0.42);
    }
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    f.type = "bandpass";
    f.frequency.setValueAtTime(2200, t0);
    f.frequency.exponentialRampToValueAtTime(320, t0 + dur);
    f.Q.value = 0.9;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.1, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.05);
    src.start(t0);
    src.stop(t0 + dur + 0.06);
  } catch (e) {}
}

export function playSpecialWindupSfx(moveId) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    playBattleWindupNoiseLayer(ctx, t0);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.connect(g);
    o2.connect(g);
    g.connect(ctx.destination);
    o1.type = "sine";
    o2.type = "triangle";
    const base =
      moveId === "attack" ? 88 : moveId === "defend" ? 125 : moveId === "heal" ? 155 : 72;
    o1.frequency.setValueAtTime(base, t0);
    o1.frequency.exponentialRampToValueAtTime(base * 5.2, t0 + 1.88);
    o2.frequency.setValueAtTime(base * 1.03, t0);
    o2.frequency.exponentialRampToValueAtTime(base * 6.5, t0 + 1.92);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.4);
    g.gain.linearRampToValueAtTime(0.11, t0 + 1.55);
    g.gain.linearRampToValueAtTime(0.001, t0 + 2.08);
    o1.start(t0);
    o2.start(t0);
    o1.stop(t0 + 2.12);
    o2.stop(t0 + 2.12);
  } catch (e) {}
}

export function playSpecialLaunchSfx(moveId) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    playBattleLaunchWhoosh(ctx, t0, moveId === "heal" ? 0.28 : 0.45);
    if (moveId === "attack") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "triangle";
      o.frequency.setValueAtTime(120, t0);
      o.frequency.exponentialRampToValueAtTime(720, t0 + 0.18);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.2, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      o.start(t0);
      o.stop(t0 + 0.38);
    } else if (moveId === "defend") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(330, t0);
      o.frequency.linearRampToValueAtTime(880, t0 + 0.22);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      o.start(t0);
      o.stop(t0 + 0.45);
    } else if (moveId === "heal") {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(392, t0);
      o.frequency.exponentialRampToValueAtTime(1046, t0 + 0.25);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
      o.start(t0);
      o.stop(t0 + 0.43);
    } else {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "square";
      o.frequency.setValueAtTime(200, t0);
      o.frequency.exponentialRampToValueAtTime(55, t0 + 0.28);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.1, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
      o.start(t0);
      o.stop(t0 + 0.42);
    }
  } catch (e) {}
}

export function playSpecialImpactSfx(moveId) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const stun = moveId === "stun";
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(stun ? 165 : 110, t0);
    o.frequency.exponentialRampToValueAtTime(stun ? 38 : 22, t0 + 0.28);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(stun ? 0.16 : 0.2, t0 + 0.016);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (stun ? 0.42 : 0.52));
    o.start(t0);
    o.stop(t0 + (stun ? 0.45 : 0.55));
    if (stun) {
      const t1 = t0 + 0.03;
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.type = "square";
      o2.frequency.setValueAtTime(880, t1);
      o2.frequency.exponentialRampToValueAtTime(120, t1 + 0.12);
      g2.gain.setValueAtTime(0, t1);
      g2.gain.linearRampToValueAtTime(0.045, t1 + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.001, t1 + 0.18);
      o2.start(t1);
      o2.stop(t1 + 0.2);
    }
  } catch (e) {}
}

export function playSpecialResolveSfx(moveId) {
  try {
    const ctx = getBattleAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    const f0 = moveId === "defend" ? 196 : moveId === "heal" ? 587 : 155;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * (moveId === "heal" ? 1.35 : 1.22), t0 + 0.1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.11, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
    o.start(t0);
    o.stop(t0 + 0.32);
  } catch (e) {}
}

/* ── New SFX exports (category 07 + misc) ──────────────────────────── */

export function playAchievementUnlockSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_achievement_unlock.m4a", 0.85);
}
export function playBondLevelUpSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_bond_level_up.m4a", 0.85);
}
export function playChallengeReceivedSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_challenge_received.m4a", 0.85);
}
export function playDailyQuestCompleteSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_daily_quest_complete.m4a", 0.85);
}
export function playDistrictUnlockSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_district_unlock.m4a", 0.9);
}
export function playEggHatchRevealSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_egg_hatch_reveal.m4a", 0.9);
}
export function playJourneyMilestoneSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_journey_milestone.m4a", 0.85);
}
export function playLevelUpSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_level_up.m4a", 0.9);
}
export function playNpcDialogueStartSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_npc_dialogue_start.m4a", 0.75);
}
export function playShopCoinCollectSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_shop_coin_collect.m4a", 0.8);
}
export function playShopPurchaseSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_shop_purchase.m4a", 0.85);
}
export function playStatBoostSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_stat_boost.m4a", 0.85);
}
export function playTournamentBracketRevealSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_tournament_bracket_reveal.m4a", 0.9);
}
export function playTournamentRoundStartSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_tournament_round_start.m4a", 0.9);
}
export function playUiBackSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_ui_back.m4a", 0.6);
}
export function playUiConfirmSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_ui_confirm.m4a", 0.65);
}
export function playUiNotificationPingSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_ui_notification_ping.m4a", 0.7);
}
export function playUiTabSwitchSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_ui_tab_switch.m4a", 0.55);
}
export function playUiTapSfx() {
  _playOneShot("assets/SFX/07_SFX_missing_M4A/sfx_ui_tap.m4a", 0.5);
}
