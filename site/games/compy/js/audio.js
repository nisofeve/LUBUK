// ============================================================
// audio.js — Web Audio synth presets for the narrative layer.
//
// Strategy: each function takes (vol = 1) and plays a short, self-contained
// sound. Each call opens its own AudioContext, schedules nodes, and closes
// the context after the sound finishes — same pattern as the existing inline
// SFX in main.js / campfire.js / entities.js.
//
// Mute via window._storyAudioMuted = true.
// ============================================================

function _ctx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch (e) { return null; }
}

function _close(ac, ms) { setTimeout(() => { try { ac.close(); } catch (e) {} }, ms); }

function _muted() { return !!window._storyAudioMuted; }

// ── Per-event presets ──────────────────────────────────────────────────

// Soft two-tone chime, ascending. Warm, not sharp. Used on child discovery.
export function playChildDiscovery(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t  = ac.currentTime;
  const g  = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  g.connect(ac.destination);
  for (let i = 0; i < 2; i++) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(i === 0 ? 523 : 659, t + i * 0.18);
    o.connect(g);
    o.start(t + i * 0.18);
    o.stop(t + i * 0.18 + 0.65);
  }
  _close(ac, 1100);
}

// Three ascending notes, gentle and bright. Used on task completion.
export function playTaskComplete(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.value = 0.16 * vol;
  g.connect(ac.destination);
  const notes = [523, 659, 784];
  notes.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t + i * 0.15);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t + i * 0.15);
    ng.gain.exponentialRampToValueAtTime(0.18 * vol, t + i * 0.15 + 0.04);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.15 + 0.5);
    o.connect(ng); ng.connect(ac.destination);
    o.start(t + i * 0.15);
    o.stop(t + i * 0.15 + 0.55);
  });
  _close(ac, 1500);
}

// Bigger, brighter task fanfare — major-7 arpeggio + a glittery sparkle layer.
// Used when a Glimmer's task is confirmed by the player. ~1.2s total.
export function playTaskCelebrate(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  // Six rising notes — C-major triad climbing into the next octave.
  const notes = [523, 659, 784, 988, 1175, 1568]; // C5-E5-G5-B5-D6-G6
  const stride = 0.10;
  notes.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = i < 3 ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f, t + i * stride);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t + i * stride);
    ng.gain.exponentialRampToValueAtTime(0.16 * vol, t + i * stride + 0.025);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + i * stride + 0.55);
    o.connect(ng); ng.connect(ac.destination);
    o.start(t + i * stride);
    o.stop(t + i * stride + 0.6);
  });
  // Sparkle shimmer layer — high tremolo'd sine on top.
  const sparkle = ac.createOscillator();
  sparkle.type = 'sine';
  sparkle.frequency.value = 2349; // D7
  const sg = ac.createGain();
  sg.gain.setValueAtTime(0.0001, t + 0.10);
  sg.gain.exponentialRampToValueAtTime(0.04 * vol, t + 0.30);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.20);
  sparkle.connect(sg); sg.connect(ac.destination);
  // Fast tremolo for the "twinkle" feel.
  const trem = ac.createOscillator();
  trem.frequency.value = 14;
  const tg = ac.createGain();
  tg.gain.value = 0.025;
  trem.connect(tg); tg.connect(sg.gain);
  trem.start(t); trem.stop(t + 1.25);
  sparkle.start(t + 0.10); sparkle.stop(t + 1.25);
  // Soft low "boom" thud at the start — gives the fanfare body.
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 130.8; // C3
  const subG = ac.createGain();
  subG.gain.setValueAtTime(0.0001, t);
  subG.gain.exponentialRampToValueAtTime(0.10 * vol, t + 0.02);
  subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  sub.connect(subG); subG.connect(ac.destination);
  sub.start(t); sub.stop(t + 0.5);
  _close(ac, 1400);
}

// Crystal shimmer — high harmonics, ethereal. Used on shard unlock.
export function playShardUnlock(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.10);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  g.connect(ac.destination);
  // Triangle wave at C6 + harmonics
  const fundamentals = [1047, 1319, 1568];
  fundamentals.forEach(f => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.connect(g);
    o.start(t);
    o.stop(t + 2.5);
  });
  // Slow tremolo at 4Hz
  const trem = ac.createOscillator();
  trem.frequency.value = 4;
  const tremG = ac.createGain();
  tremG.gain.value = 0.06;
  trem.connect(tremG);
  tremG.connect(g.gain);
  trem.start(t);
  trem.stop(t + 2.5);
  _close(ac, 2700);
}

// Soft crackle + low warm tone. Used on campfire tap.
export function playCampfireTap(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  // Low warmth oscillator
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.value = 110;
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.10 * vol, t + 0.02);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(og); og.connect(ac.destination);
  o.start(t); o.stop(t + 0.42);
  // Noise crackle (bandpass-filtered white noise)
  const buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 1.4;
  const sg = ac.createGain();
  sg.gain.setValueAtTime(0.10 * vol, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  src.connect(bp); bp.connect(sg); sg.connect(ac.destination);
  src.start(t); src.stop(t + 0.4);
  _close(ac, 700);
}

// Ascending chord swell — warmth expanding. Used on Remembering panel reveal.
export function playCampfireUpgrade(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.10 * vol, t + 1.0);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
  g.connect(ac.destination);
  [220, 330, 440, 660].forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(t + i * 0.06);
    o.stop(t + 3.0);
  });
  _close(ac, 3300);
}

// Full warm chord + sparkle overlay. The biggest sound in the story.
// Used on Crown Flame upgrade.
export function playCrownFlame(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18 * vol, t + 1.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 5.0);
  g.connect(ac.destination);
  // Minor pentatonic at A2 root: A2, C3, D3, E3, G3
  [110, 130.8, 146.8, 164.8, 196].forEach(f => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 5);
  });
  // Sparkle layer — high tremolo
  const sparkle = ac.createOscillator();
  sparkle.type = 'sine';
  sparkle.frequency.value = 2093;
  const sparkleG = ac.createGain();
  sparkleG.gain.setValueAtTime(0.0001, t + 0.6);
  sparkleG.gain.exponentialRampToValueAtTime(0.05 * vol, t + 1.6);
  sparkleG.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
  sparkle.connect(sparkleG); sparkleG.connect(ac.destination);
  // 12Hz tremolo on the sparkle gain
  const trem = ac.createOscillator();
  trem.frequency.value = 12;
  const tremG = ac.createGain();
  tremG.gain.value = 0.025;
  trem.connect(tremG);
  tremG.connect(sparkleG.gain);
  trem.start(t); trem.stop(t + 5);
  sparkle.start(t); sparkle.stop(t + 5);
  _close(ac, 5300);
}

// Soft heartbeat warmth — two soft pulses. Used when bond meter reaches 4/4.
export function playBondFill(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  lp.connect(ac.destination);
  for (let i = 0; i < 2; i++) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = 98;
    const og = ac.createGain();
    og.gain.setValueAtTime(0.0001, t + i * 0.18);
    og.gain.exponentialRampToValueAtTime(0.20 * vol, t + i * 0.18 + 0.04);
    og.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.18);
    o.connect(og); og.connect(lp);
    o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.2);
  }
  _close(ac, 700);
}

// Simple 8-note folk-like melody. Used on Child 1's bond moment (T1.4).
export function playChild1Melody(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  // C5, D5, E5, G5, E5, D5, C5, G4
  const notes = [523, 587, 659, 784, 659, 587, 523, 392];
  const noteDur = 0.4;
  notes.forEach((f, i) => {
    const humanise = (Math.random() - 0.5) * 0.04;
    const start = t + i * noteDur + humanise;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, start);
    const og = ac.createGain();
    const growth = 0.04 + Math.min(1, (i + 1) / 5) * 0.10;
    og.gain.setValueAtTime(0.0001, start);
    og.gain.exponentialRampToValueAtTime(growth * vol, start + 0.04);
    og.gain.exponentialRampToValueAtTime(0.0001, start + noteDur * 0.85);
    o.connect(og); og.connect(ac.destination);
    o.start(start);
    o.stop(start + noteDur);
  });
  _close(ac, notes.length * noteDur * 1000 + 600);
}

// Gentle breath sound — like opening something that has been closed.
// Used when a Shard panel opens.
export function playShardPanelOpen(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const buf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 350;
  bp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06 * vol, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
  src.connect(bp); bp.connect(g); g.connect(ac.destination);
  src.start(t); src.stop(t + 1.2);
  _close(ac, 1400);
}

// Single warm bell — personal, intimate. Used on Shard 10 name confirm.
export function playNameInputConfirm(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const o1 = ac.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 659;
  const o2 = ac.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = 1318;
  const g1 = ac.createGain();
  g1.gain.setValueAtTime(0.0001, t);
  g1.gain.exponentialRampToValueAtTime(0.18 * vol, t + 0.02);
  g1.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  const g2 = ac.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o1.connect(g1); g1.connect(ac.destination);
  o2.connect(g2); g2.connect(ac.destination);
  o1.start(t); o1.stop(t + 1.7);
  o2.start(t); o2.stop(t + 1.7);
  _close(ac, 2000);
}

// Low sustained chord — held warmth, barely audible. Used during finale.
// Returns a stop() function so the caller can fade it out.
export function playFinaleAmbient(vol = 1) {
  if (_muted()) return () => {};
  const ac = _ctx(); if (!ac) return () => {};
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04 * vol, t + 4);
  g.connect(ac.destination);
  const oscs = [];
  [110, 165, 220].forEach(f => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    oscs.push(o);
  });
  // Slow tremolo at 0.2Hz (felt as breathing, not heard as rhythm)
  const trem = ac.createOscillator();
  trem.frequency.value = 0.2;
  const tremG = ac.createGain();
  tremG.gain.value = 0.015;
  trem.connect(tremG);
  tremG.connect(g.gain);
  trem.start(t);
  oscs.push(trem);
  return () => {
    const stopT = ac.currentTime;
    g.gain.cancelScheduledValues(stopT);
    g.gain.exponentialRampToValueAtTime(0.0001, stopT + 1.5);
    oscs.forEach(o => o.stop(stopT + 1.6));
    _close(ac, 1800);
  };
}

// Single sustained note fading to silence. Used during the Go-Home credits.
export function playCreditsFade(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.value = 220;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.10 * vol, t);
  g.gain.linearRampToValueAtTime(0.0001, t + 4);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 4.1);
  _close(ac, 4500);
}

// ── Cute UI SFX ─────────────────────────────────────────────────────────
// Tiny, playful sounds for window/dialog/button interactions.

// Soft "pop-up" when a window opens. Two ascending sine blips, ~140ms total.
export function playWindowOpen(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const notes = [660, 988]; // E5 → B5
  notes.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t + i * 0.06);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.06);
    g.gain.exponentialRampToValueAtTime(0.10 * vol, t + i * 0.06 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.10);
    o.connect(g); g.connect(ac.destination);
    o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.12);
  });
  _close(ac, 350);
}

// Soft "tuck-away" when a window closes. Two descending sine blips, ~140ms.
export function playWindowClose(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const notes = [880, 587]; // A5 → D5
  notes.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t + i * 0.05);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.08 * vol, t + i * 0.05 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.09);
    o.connect(g); g.connect(ac.destination);
    o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.10);
  });
  _close(ac, 300);
}

// Bouncy "boop" when a dialogue/speech bubble appears. Triangle wave, quick.
export function playDialogPop(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.20);
  _close(ac, 280);
}

// Quick soft button click — for non-window action buttons.
export function playButtonPress(vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1100, t);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06 * vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + 0.08);
  _close(ac, 200);
}

// Cute Glimmer "voice" — short randomised chirp using two short sine blips
// pitched in a soft mid-register. Pass a seed (e.g. childIdx) for consistency.
export function playSparkVoice(seed = 0, vol = 1) {
  if (_muted()) return;
  const ac = _ctx(); if (!ac) return;
  const t = ac.currentTime;
  // Per-Glimmer base pitch so each one sounds like itself.
  // 0=Tuneflame (lowest, calm) → 5=Hearthmote (highest, smallest).
  const basePitches = [392, 440, 523, 587, 659, 784]; // G4..G5
  const base = basePitches[seed % basePitches.length] || 523;
  const notes = [base, base * 1.20];
  notes.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = 'sine';
    const detune = (Math.random() - 0.5) * 8; // tiny humanise
    o.frequency.setValueAtTime(f + detune, t + i * 0.07);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.07 * vol, t + i * 0.07 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.13);
    o.connect(g); g.connect(ac.destination);
    o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.14);
  });
  _close(ac, 350);
}

// ── Auto-wire to shard / task / upgrade / discovery events. ──
// Callers don't have to remember to fire SFX manually; the dispatch above
// (cmm:shard-unlocked, cmm:shard-trigger) is enough.
let _wired = false;
export function wireStoryAudio() {
  if (_wired) return;
  _wired = true;
  window.addEventListener('cmm:shard-unlocked', () => {
    playShardPanelOpen(0.8);
    setTimeout(() => playShardUnlock(1.0), 600);
  });
}

// Expose for inline callers (campfire.onTap fires this directly).
if (typeof window !== 'undefined') {
  window.StoryAudio = {
    playChildDiscovery,
    playTaskComplete,
    playTaskCelebrate,
    playShardUnlock,
    playCampfireTap,
    playCampfireUpgrade,
    playCrownFlame,
    playBondFill,
    playChild1Melody,
    playShardPanelOpen,
    playNameInputConfirm,
    playFinaleAmbient,
    playCreditsFade,
    playWindowOpen,
    playWindowClose,
    playDialogPop,
    playButtonPress,
    playSparkVoice,
  };
}
