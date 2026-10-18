// ============================================================
// StoryPanel — narrative UI primitives for "She Who Keeps the Light".
//
// One module, several visual "kinds":
//   bubble       — small glass speech bubble above campfire (auto-dismiss)
//   vignette     — 3-line gold popup at Glimmer discovery (auto-dismiss)
//   dialog       — Glimmer NPC task dialogue with progress (manual close)
//   reveal       — full-screen story reveal on task completion
//   shard        — full-screen Memory Shard reading (typewriter, 3s lock)
//   remembering  — full-screen Hearth memory after a campfire upgrade
//   tend         — Talk / Tend two-button choice
//   monologue    — finale campfire monologue (auto-advance)
//   credits      — warm-white "Go Home" ending sequence
//
// API: StoryPanel.show({ kind, ... }) => Promise<dismissReason>
// ============================================================

const STYLE_ID = 'story-panel-styles';
const ROOT_ID  = 'story-panel-root';

let _root = null;
let _stack = [];   // active panel records, top of stack is foremost
let _styleInjected = false;

function _ensureRoot() {
  if (_root) return _root;
  if (!_styleInjected) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = STYLE_CSS;
    document.head.appendChild(s);
    _styleInjected = true;
  }
  _root = document.createElement('div');
  _root.id = ROOT_ID;
  _root.setAttribute('aria-live', 'polite');
  document.body.appendChild(_root);
  return _root;
}

function _makeId() { return 'sp_' + Math.random().toString(36).slice(2, 9); }

function _escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Linewise typewriter — applied to a node by gradually revealing characters.
// Returns a function that completes immediately if called (for fast-forward on tap).
function _typewriter(el, text, msPerChar = 25) {
  let cancelled = false;
  let i = 0;
  el.textContent = '';
  return new Promise(resolve => {
    function tick() {
      if (cancelled) { el.textContent = text; return resolve(); }
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) return resolve();
      setTimeout(tick, msPerChar);
    }
    tick();
    el._cancelTypewriter = () => { cancelled = true; };
  });
}

function _renderLines(container, lines, typewriter) {
  container.innerHTML = '';
  const linePromises = [];
  lines.forEach((line, idx) => {
    const p = document.createElement('p');
    p.className = 'sp-line';
    container.appendChild(p);
    if (typewriter) {
      const ms = (typeof typewriter === 'number') ? typewriter : 25;
      // Stagger so lines reveal one after another.
      linePromises.push(
        new Promise(r => setTimeout(r, idx * 350))
          .then(() => _typewriter(p, line, ms))
      );
    } else {
      p.innerHTML = line;
    }
  });
  return Promise.all(linePromises);
}

// ── Kind renderers ──────────────────────────────────────────────────────
// Each returns the panel's outer element; the show() driver hooks dismiss/timing.

function _renderBubble(opts) {
  const el = document.createElement('div');
  el.className = 'sp-bubble';
  el.innerHTML = `
    ${opts.icon ? `<div class="sp-bubble-icon">${_escape(opts.icon)}</div>` : ''}
    <div class="sp-bubble-text"></div>
  `;
  const text = el.querySelector('.sp-bubble-text');
  (opts.lines || []).forEach((l, i) => {
    if (i > 0) text.appendChild(document.createElement('br'));
    text.appendChild(document.createTextNode(l));
  });
  return el;
}

function _renderVignette(opts) {
  const el = document.createElement('div');
  el.className = 'sp-vignette';
  el.innerHTML = `
    ${opts.icon ? `<div class="sp-vignette-icon">${_escape(opts.icon)}</div>` : ''}
    ${opts.title ? `<div class="sp-vignette-title">${_escape(opts.title)}</div>` : ''}
    <div class="sp-vignette-lines"></div>
  `;
  const lines = el.querySelector('.sp-vignette-lines');
  (opts.lines || []).forEach(l => {
    const p = document.createElement('p');
    p.className = 'sp-line sp-line-italic';
    p.textContent = l;
    lines.appendChild(p);
  });
  return el;
}

function _renderDialog(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-dialog';
  // If a portrait painter was provided, render it into a square canvas on the left.
  const hasPortrait = typeof opts.portrait === 'function';
  const cb = opts.confirmButton;
  el.innerHTML = `
    <div class="sp-modal-card ${hasPortrait ? 'sp-dialog-with-portrait' : ''}">
      <button class="sp-close" aria-label="Close">×</button>
      <div class="sp-dialog-head">
        ${hasPortrait ? `<canvas class="sp-dialog-portrait" width="120" height="120"></canvas>` : (opts.icon ? `<div class="sp-dialog-icon">${_escape(opts.icon)}</div>` : '')}
        <div class="sp-dialog-name">${_escape(opts.title || '')}</div>
      </div>
      <div class="sp-dialog-lines"></div>
      ${opts.requirement ? `<div class="sp-dialog-req">${_escape(opts.requirement)}</div>` : ''}
      ${opts.progress ? `<div class="sp-dialog-progress"><div class="sp-progress-track"><div class="sp-progress-fill" style="width:${Math.max(0, Math.min(100, opts.progress.pct || 0))}%"></div></div><span class="sp-progress-label">${_escape(opts.progress.label || '')}</span></div>` : ''}
      ${cb ? `<button class="sp-btn sp-btn-primary sp-dialog-confirm">${_escape(cb.label || 'Complete ✓')}</button>` : ''}
    </div>`;
  const linesEl = el.querySelector('.sp-dialog-lines');
  (opts.lines || []).forEach(l => {
    const p = document.createElement('p');
    p.className = 'sp-line';
    p.textContent = l;
    linesEl.appendChild(p);
  });
  // Repaint the portrait every ~120ms so animations (sleepy z, headband wobble,
  // music-note bob) stay alive while the dialog is open. Note: the renderer
  // runs BEFORE the element is appended to the document, so `cv.isConnected`
  // is false on the first call. Paint unconditionally on the first frame, then
  // gate on isConnected for the loop's exit.
  if (hasPortrait) {
    const cv  = el.querySelector('.sp-dialog-portrait');
    const ctx = cv.getContext('2d');
    let started = false;
    const repaint = () => {
      // After the first paint, exit when the canvas leaves the DOM.
      if (started && !cv.isConnected) return;
      started = true;
      ctx.clearRect(0, 0, cv.width, cv.height);
      try { opts.portrait(ctx, cv.width); } catch (e) { /* ignore */ }
      el._portraitTimer = setTimeout(repaint, 120);
    };
    // Defer the first paint so the canvas is mounted and laid out.
    setTimeout(repaint, 0);
  }
  return el;
}

function _renderReveal(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-reveal';
  el.innerHTML = `
    <div class="sp-paper">
      ${opts.icon ? `<div class="sp-paper-icon">${_escape(opts.icon)}</div>` : ''}
      ${opts.kicker ? `<div class="sp-paper-kicker">${_escape(opts.kicker)}</div>` : ''}
      ${opts.title ? `<div class="sp-paper-title">${_escape(opts.title)}</div>` : ''}
      ${opts.quote ? `<blockquote class="sp-paper-quote">${_escape(opts.quote)}</blockquote>` : ''}
      <div class="sp-paper-lines"></div>
      <div class="sp-paper-hint">tap to continue</div>
    </div>`;
  return el;
}

function _renderShard(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-shard';
  el.innerHTML = `
    <div class="sp-paper sp-paper-shard">
      <div class="sp-shard-header">
        <span class="sp-shard-num">${_escape(opts.kicker || '')}</span>
        <span class="sp-shard-mark">✦</span>
      </div>
      ${opts.title ? `<div class="sp-paper-title sp-shard-title">${_escape(opts.title)}</div>` : ''}
      <div class="sp-paper-lines sp-shard-lines"></div>
      <div class="sp-paper-hint sp-shard-hint" hidden>tap to continue</div>
    </div>`;
  return el;
}

function _renderRemembering(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-remembering';
  el.innerHTML = `
    <div class="sp-paper sp-paper-remembering">
      ${opts.icon ? `<div class="sp-paper-icon sp-remembering-icon">${_escape(opts.icon)}</div>` : ''}
      ${opts.kicker ? `<div class="sp-paper-kicker">${_escape(opts.kicker)}</div>` : ''}
      ${opts.title ? `<div class="sp-paper-title">${_escape(opts.title)}</div>` : ''}
      <div class="sp-paper-lines"></div>
      <div class="sp-paper-hint">tap to continue</div>
    </div>`;
  return el;
}

function _renderTend(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-tend';
  const buttons = (opts.buttons || []).map((b, i) =>
    `<button class="sp-btn ${b.variant === 'primary' ? 'sp-btn-primary' : 'sp-btn-secondary'}" data-idx="${i}">${_escape(b.label)}</button>`
  ).join('');
  el.innerHTML = `
    <div class="sp-modal-card sp-tend-card">
      ${opts.icon ? `<div class="sp-tend-icon">${_escape(opts.icon)}</div>` : ''}
      ${opts.title ? `<div class="sp-tend-title">${_escape(opts.title)}</div>` : ''}
      ${(opts.lines || []).length ? `<div class="sp-tend-lines">${opts.lines.map(l => `<p class="sp-line">${_escape(l)}</p>`).join('')}</div>` : ''}
      ${opts.requirement ? `<div class="sp-dialog-req">${_escape(opts.requirement)}</div>` : ''}
      <div class="sp-tend-buttons">${buttons}</div>
    </div>`;
  return el;
}

function _renderMonologue(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-monologue';
  el.innerHTML = `
    <div class="sp-paper sp-paper-monologue">
      <div class="sp-monologue-glow"></div>
      <div class="sp-paper-lines"></div>
    </div>`;
  return el;
}

function _renderCredits(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-credits';
  el.innerHTML = `
    <div class="sp-credits-page">
      <div class="sp-credits-lines"></div>
    </div>`;
  return el;
}

function _renderNameInput(opts) {
  const el = document.createElement('div');
  el.className = 'sp-modal sp-name-input';
  el.innerHTML = `
    <div class="sp-paper sp-paper-name">
      ${opts.icon ? `<div class="sp-paper-icon">${_escape(opts.icon)}</div>` : ''}
      ${opts.title ? `<div class="sp-paper-title">${_escape(opts.title)}</div>` : ''}
      ${(opts.lines || []).map(l => `<p class="sp-line sp-line-italic">${_escape(l)}</p>`).join('')}
      <div class="sp-name-row">
        <input type="text" class="sp-name-field" maxlength="30" placeholder="${_escape(opts.placeholder || 'Your name.')}" autocomplete="off" />
      </div>
      <div class="sp-name-buttons">
        <button class="sp-btn sp-btn-secondary sp-name-skip">Leave it.</button>
        <button class="sp-btn sp-btn-primary    sp-name-confirm">That’s me.</button>
      </div>
    </div>`;
  return el;
}

const RENDERERS = {
  bubble:      _renderBubble,
  vignette:    _renderVignette,
  dialog:      _renderDialog,
  reveal:      _renderReveal,
  shard:       _renderShard,
  remembering: _renderRemembering,
  tend:        _renderTend,
  monologue:   _renderMonologue,
  credits:     _renderCredits,
  nameInput:   _renderNameInput,
};

const MODAL_KINDS    = new Set(['dialog','reveal','shard','remembering','tend','monologue','credits','nameInput']);
const FULLSCREEN_KIND = new Set(['reveal','shard','remembering','monologue','credits','nameInput']);

// Fullscreen panels queue rather than overlap. Each pending entry holds the
// original opts plus the resolve handle so the caller's promise still fires
// when the queued panel eventually dismisses.
let _fullscreenQueue = [];
const FADE_OUT_MS = 750; // matches .sp-leaving CSS transition

// ── Driver ──────────────────────────────────────────────────────────────

function show(opts = {}) {
  const root = _ensureRoot();
  const kind = opts.kind || 'bubble';
  const renderer = RENDERERS[kind];
  if (!renderer) return Promise.resolve('unknown-kind');

  // Fullscreen kinds queue if another fullscreen panel is currently visible.
  // The queued panel will be drained automatically when the current one
  // dismisses (see _dismiss). reveal/shard/remembering get this for free —
  // no more rapid-fire overlap when several Glimmer rewards land at once.
  if (FULLSCREEN_KIND.has(kind)) {
    const currentlyOpen = _stack.some(s => FULLSCREEN_KIND.has(s.kind) && !s.dismissed);
    if (currentlyOpen) {
      return new Promise((resolve) => {
        _fullscreenQueue.push({ opts, resolve });
      });
    }
  }

  const el = renderer(opts);
  el.dataset.kind = kind;
  el.dataset.id   = _makeId();
  el.classList.add('sp-enter');
  root.appendChild(el);
  // Force reflow then add visible class for transition.
  void el.offsetWidth;
  el.classList.add('sp-visible');

  // Cute SFX when a panel pops out — bubble/vignette/dialog/reveal/tend.
  // Heavier kinds (shard/remembering/credits) have their own dedicated audio.
  if (kind === 'bubble' || kind === 'vignette' || kind === 'dialog' ||
      kind === 'reveal' || kind === 'tend') {
    window.StoryAudio?.playDialogPop?.(0.7);
    // Glimmer voice chirp if the panel attributes lines to a specific spark.
    if (typeof opts.voiceSeed === 'number') {
      setTimeout(() => window.StoryAudio?.playSparkVoice?.(opts.voiceSeed, 0.6), 110);
    }
  }

  const record = { kind, el, opts, dismissed: false, resolve: null };
  const promise = new Promise(r => { record.resolve = r; });

  // Lines rendering for kinds that use the standard .sp-paper-lines container.
  const linesEl = el.querySelector('.sp-paper-lines') ||
                  el.querySelector('.sp-credits-lines');
  if (linesEl && opts.lines) {
    const tw = (kind === 'shard') ? (opts.typewriter ?? 25)
             : (kind === 'monologue') ? false
             : (opts.typewriter ?? false);
    record.linesPromise = _renderLines(linesEl, opts.lines, tw);
  }

  // Tap-to-dismiss for fullscreen + bubble + vignette.
  if (kind !== 'tend' && kind !== 'dialog') {
    const lockMs = (kind === 'shard' || kind === 'remembering' || kind === 'reveal')
      ? (opts.lockUntil ?? 3000)
      : 0;
    const armedAt = Date.now() + lockMs;
    el.addEventListener('click', (ev) => {
      if (Date.now() < armedAt) return;
      // Fast-forward a still-typing line first.
      const typing = el.querySelector('.sp-line');
      if (typing && typing._cancelTypewriter) { typing._cancelTypewriter(); }
      _dismiss(record, 'tap');
    });
  }

  // Tend buttons → resolve with chosen index.
  if (kind === 'tend') {
    el.querySelectorAll('.sp-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const choice = opts.buttons?.[idx];
        if (choice && typeof choice.onClick === 'function') {
          try { choice.onClick(); } catch (e) { /* ignore */ }
        }
        _dismiss(record, choice?.value || `btn-${idx}`);
      });
    });
  }

  // Name input — Confirm submits typed text; Skip resolves with empty string.
  if (kind === 'nameInput') {
    const input    = el.querySelector('.sp-name-field');
    const confirm  = el.querySelector('.sp-name-confirm');
    const skip     = el.querySelector('.sp-name-skip');
    if (input && opts.initialValue) input.value = opts.initialValue;
    setTimeout(() => input?.focus(), 80);
    const finish = (value) => {
      if (typeof opts.onSubmit === 'function') {
        try { opts.onSubmit(value); } catch (e) { /* ignore */ }
      }
      _dismiss(record, value || 'skipped');
    };
    confirm?.addEventListener('click', () => finish((input?.value || '').trim()));
    skip?.addEventListener('click',    () => finish(''));
    input?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') finish((input.value || '').trim());
    });
  }

  // Dialog explicit close button.
  if (kind === 'dialog') {
    const closeBtn = el.querySelector('.sp-close');
    if (closeBtn) closeBtn.addEventListener('click', () => _dismiss(record, 'close'));
    // Tap outside the card also closes.
    el.addEventListener('click', (ev) => {
      if (ev.target === el) _dismiss(record, 'backdrop');
    });
    // Optional confirm button (e.g. "Complete ✓" on a pending-task dialog).
    const confirmBtn = el.querySelector('.sp-dialog-confirm');
    if (confirmBtn && opts.confirmButton?.onClick) {
      confirmBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try { opts.confirmButton.onClick(); } catch (e) { /* ignore */ }
        _dismiss(record, 'confirm');
      });
    }
  }

  // Auto-dismiss timer.
  if (opts.dismissDelay && opts.dismissDelay > 0) {
    record._timer = setTimeout(() => _dismiss(record, 'timeout'), opts.dismissDelay);
  } else if (kind === 'bubble') {
    record._timer = setTimeout(() => _dismiss(record, 'timeout'), 4000);
  } else if (kind === 'vignette') {
    record._timer = setTimeout(() => _dismiss(record, 'timeout'), 6000);
  }

  // Monologue auto-advance: each line displays for 5s, then panel auto-resolves.
  if (kind === 'monologue') {
    const total = ((opts.lines || []).length || 1) * 5000;
    record._timer = setTimeout(() => _dismiss(record, 'timeout'), opts.dismissDelay || total);
  }

  _stack.push(record);
  return promise;
}

function _dismiss(record, reason) {
  if (record.dismissed) return;
  record.dismissed = true;
  if (record._timer) { clearTimeout(record._timer); record._timer = null; }
  if (record.el._portraitTimer) { clearTimeout(record.el._portraitTimer); record.el._portraitTimer = null; }
  record.el.classList.remove('sp-visible');
  record.el.classList.add('sp-leaving');
  setTimeout(() => {
    if (record.el.parentNode) record.el.parentNode.removeChild(record.el);
  }, FADE_OUT_MS + 50);
  _stack = _stack.filter(s => s !== record);
  if (typeof record.opts.onDismiss === 'function') {
    try { record.opts.onDismiss(reason); } catch (e) { /* ignore */ }
  }
  if (record.resolve) record.resolve(reason);

  // Drain the fullscreen queue once this fullscreen panel finishes fading.
  // Waiting until after the fade prevents visible cross-flash.
  if (FULLSCREEN_KIND.has(record.kind) && _fullscreenQueue.length > 0) {
    setTimeout(() => {
      // Re-check — another panel might have opened (or been queued) meanwhile.
      const stillBlocked = _stack.some(s => FULLSCREEN_KIND.has(s.kind) && !s.dismissed);
      if (stillBlocked) return; // _dismiss for that one will retry.
      const next = _fullscreenQueue.shift();
      if (next) show(next.opts).then(next.resolve);
    }, FADE_OUT_MS);
  }
}

function dismissAll() {
  _stack.slice().forEach(r => _dismiss(r, 'dismissAll'));
}

function isOpen(kind) {
  if (!kind) return _stack.length > 0;
  return _stack.some(s => s.kind === kind);
}

// Sequential queue: each entry is the same opts shape as show().
async function queue(items) {
  const reasons = [];
  for (const item of items) {
    reasons.push(await show(item));
  }
  return reasons;
}

export const StoryPanel = { show, dismissAll, isOpen, queue };

// Also attach to window for non-module callers (campfire, finale director, etc.).
if (typeof window !== 'undefined') window.StoryPanel = StoryPanel;

// ── Styles ──────────────────────────────────────────────────────────────
const STYLE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

#${ROOT_ID} {
  position: fixed; inset: 0; z-index: 200;
  pointer-events: none;
}
#${ROOT_ID} > * { pointer-events: auto; }

/* Common transitions */
.sp-enter   { opacity: 0; transform: translateY(8px); transition: opacity .28s ease-out, transform .28s ease-out; }
.sp-visible { opacity: 1; transform: translateY(0); }
.sp-leaving { opacity: 0; transform: translateY(-4px) scale(0.985); transition: opacity .75s ease-out, transform .75s ease-out; }

/* ── Bubble (campfire daily warmth) ── */
.sp-bubble {
  position: absolute; left: 50%; top: 28%;
  transform: translateX(-50%);
  max-width: 360px; padding: 12px 16px;
  background: rgba(20, 22, 38, 0.86);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(251,191,36,0.35);
  border-radius: 14px;
  color: #ede8f5; font: 13px/1.55 'Inter', system-ui, sans-serif;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 24px rgba(251,191,36,0.12);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.sp-bubble-icon { font-size: 18px; opacity: .9; }
.sp-bubble-text { font-style: italic; font-family: 'Lora', Georgia, serif; }

/* ── Vignette (child discovery) ── */
.sp-vignette {
  position: absolute; left: 50%; top: 32%;
  transform: translateX(-50%);
  width: min(420px, 86vw); padding: 18px 22px;
  background: linear-gradient(180deg, rgba(40,30,12,0.9), rgba(20,16,30,0.92));
  border: 1px solid rgba(251,191,36,0.45);
  border-radius: 16px;
  color: #fde68a; font-family: 'Lora', Georgia, serif;
  text-align: center;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 32px rgba(251,191,36,0.18);
}
.sp-vignette-icon  { font-size: 28px; margin-bottom: 6px; }
.sp-vignette-title { font-size: 15px; font-weight: 600; color: #fbbf24; letter-spacing: .5px; margin-bottom: 8px; }
.sp-vignette-lines .sp-line { margin: 4px 0; font-size: 14px; line-height: 1.6; color: #fef3c7; font-style: italic; }

/* ── Modals (full-screen scrim + card) ── */
.sp-modal {
  position: absolute; inset: 0;
  background: rgba(7, 8, 16, 0.78);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  cursor: pointer;
}
.sp-modal-card, .sp-paper {
  position: relative;
  width: min(560px, 92vw);
  max-height: 86vh; overflow: auto;
  padding: 28px 30px;
  background: rgba(24, 28, 53, 0.92);
  border: 1px solid rgba(251,191,36,0.25);
  border-radius: 18px;
  box-shadow: 0 16px 64px rgba(0,0,0,0.6);
  cursor: default;
}
.sp-paper {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,0.06), transparent 60%),
    rgba(18, 16, 28, 0.94);
  border-color: rgba(251,191,36,0.3);
  border-left: 3px solid #fbbf24;
  font-family: 'Lora', Georgia, serif;
}
.sp-paper-icon    { font-size: 32px; margin-bottom: 10px; opacity: .9; }
.sp-paper-kicker  { font: 600 11px/1 'Inter', system-ui, sans-serif; letter-spacing: 1.5px; text-transform: uppercase; color: #c4b5fd; margin-bottom: 6px; }
.sp-paper-title   { font: 700 22px/1.2 'Lora', Georgia, serif; color: #fef3c7; margin-bottom: 12px; }
.sp-paper-quote   { font-style: italic; color: #fde68a; border-left: 2px solid rgba(251,191,36,0.5); padding-left: 12px; margin: 0 0 14px 0; }
.sp-paper-lines   { color: #ede8f5; font-size: 15px; line-height: 1.85; }
.sp-paper-lines .sp-line { font-style: italic; margin-bottom: 10px; min-height: 1em; }
.sp-paper-hint    { margin-top: 18px; font: 11px 'Inter', system-ui, sans-serif; color: #635f80; text-align: right; opacity: .7; }
.sp-line-italic   { font-style: italic; }

.sp-close {
  position: absolute; top: 10px; right: 12px;
  background: none; border: none;
  font-size: 22px; line-height: 1;
  color: #a099be; cursor: pointer;
  padding: 4px 8px; border-radius: 6px;
}
.sp-close:hover { background: rgba(255,255,255,0.06); color: #ede8f5; }

/* ── Dialog (child task) ── */
.sp-dialog .sp-modal-card { padding: 24px 26px; }
.sp-dialog-head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.sp-dialog-icon { font-size: 32px; }
.sp-dialog-name { font: 700 17px 'Lora', Georgia, serif; color: #fef3c7; flex: 1; min-width: 0; }
.sp-dialog-portrait {
  flex: 0 0 auto;
  width: 96px; height: 96px;
  background: linear-gradient(160deg, rgba(20,18,32,0.85), rgba(40,28,60,0.65));
  border: 1px solid rgba(251,191,36,0.30);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 18px rgba(251,191,36,0.06) inset;
}
.sp-dialog-with-portrait .sp-dialog-name {
  font-size: 18px;
}
.sp-dialog-lines .sp-line { font-style: italic; font-family: 'Lora', Georgia, serif; color: #ede8f5; margin-bottom: 8px; line-height: 1.6; font-size: 14px; }
.sp-dialog-req { margin-top: 14px; padding: 10px 12px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); border-radius: 8px; font: 11.5px 'DM Mono', 'Consolas', monospace; color: #fbbf24; }
.sp-dialog-progress { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.sp-progress-track { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
.sp-progress-fill  { height: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); border-radius: 99px; transition: width .4s ease-out; }
.sp-progress-label { font: 11px 'Inter', system-ui, sans-serif; color: #a099be; }

/* ── Shard ── */
.sp-shard-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sp-shard-num    { font: 600 11px 'Inter', system-ui, sans-serif; letter-spacing: 1.5px; text-transform: uppercase; color: #fbbf24; }
.sp-shard-mark   { font-size: 18px; color: #fbbf24; opacity: .8; text-shadow: 0 0 12px rgba(251,191,36,0.6); }
.sp-shard-title  { font-size: 24px; }
.sp-paper-shard  {
  border-color: rgba(251,191,36,0.5);
  box-shadow: 0 0 60px rgba(251,191,36,0.18), 0 16px 64px rgba(0,0,0,0.6);
}

/* ── Tend ── */
.sp-tend-card { width: min(420px, 88vw); padding: 22px 24px; text-align: center; }
.sp-tend-icon  { font-size: 36px; margin-bottom: 10px; }
.sp-tend-title { font: 700 18px 'Lora', Georgia, serif; color: #fef3c7; margin-bottom: 12px; }
.sp-tend-lines { font-family: 'Lora', Georgia, serif; font-style: italic; color: #c4b5fd; margin-bottom: 16px; }
.sp-tend-buttons { display: flex; gap: 10px; justify-content: center; }
.sp-btn {
  padding: 10px 18px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04); color: #ede8f5; font: 600 13px 'Inter', system-ui, sans-serif;
  cursor: pointer; transition: all .2s ease;
}
.sp-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
.sp-btn-primary {
  background: linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.1));
  border-color: rgba(251,191,36,0.4); color: #fde68a;
}
.sp-btn-primary:hover { background: linear-gradient(135deg, rgba(251,191,36,0.3), rgba(251,191,36,0.18)); }

/* ── Monologue ── */
.sp-paper-monologue {
  width: min(620px, 92vw); padding: 36px 40px;
  background: radial-gradient(circle at 50% 30%, rgba(251,191,36,0.12), rgba(18,16,28,0.95) 70%);
  border-color: rgba(251,191,36,0.5);
}
.sp-monologue-glow {
  position: absolute; inset: -40px;
  background: radial-gradient(circle at 50% 50%, rgba(251,191,36,0.18), transparent 70%);
  pointer-events: none; z-index: -1;
}
.sp-paper-monologue .sp-paper-lines { font-size: 16px; line-height: 1.95; color: #fef3c7; }

/* ── Credits ── */
.sp-credits {
  background: #fff8e8;
  transition: background .8s ease-out;
}
.sp-credits-page {
  width: min(560px, 88vw); padding: 60px 40px; text-align: center;
  font-family: 'Lora', Georgia, serif; color: #6b4c1c;
}
.sp-credits-lines .sp-line {
  font-size: 16px; line-height: 1.9;
  font-style: italic; color: #6b4c1c;
  opacity: 0; animation: spCreditsLine .5s ease-out forwards;
}
.sp-credits-lines .sp-line:nth-child(1) { animation-delay: .2s; }
.sp-credits-lines .sp-line:nth-child(2) { animation-delay: 1.2s; }
.sp-credits-lines .sp-line:nth-child(3) { animation-delay: 2.2s; }
.sp-credits-lines .sp-line:nth-child(4) { animation-delay: 3.2s; }
.sp-credits-lines .sp-line:nth-child(5) { animation-delay: 4.2s; }
.sp-credits-lines .sp-line:nth-child(6) { animation-delay: 5.2s; }
.sp-credits-lines .sp-line:nth-child(7) { animation-delay: 6.2s; }
.sp-credits-lines .sp-line:nth-child(8) { animation-delay: 7.2s; }
@keyframes spCreditsLine {
  to { opacity: 1; }
}

@media (max-width: 480px) {
  .sp-paper, .sp-modal-card { padding: 22px 20px; }
  .sp-paper-title { font-size: 19px; }
  .sp-vignette { width: min(360px, 92vw); padding: 14px 18px; }
}

/* ── Passport tabs (Profile / Memories) ── */
.passport-tabs {
  display: flex; gap: 4px; padding: 6px;
  background: rgba(0,0,0,0.18);
  border-radius: 12px; margin: 0 12px 12px;
}
.passport-tab {
  flex: 1; padding: 9px 14px;
  background: transparent; border: none; cursor: pointer;
  color: #a099be; font: 600 12.5px 'Inter', system-ui, sans-serif;
  border-radius: 8px; transition: background .2s, color .2s;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.passport-tab:hover { color: #ede8f5; background: rgba(255,255,255,0.04); }
.passport-tab.active {
  background: linear-gradient(135deg, rgba(251,191,36,0.18), rgba(167,139,250,0.10));
  color: #fde68a; box-shadow: 0 0 18px rgba(251,191,36,0.10) inset;
}
.passport-tab-count {
  font: 600 10.5px 'DM Mono', 'Consolas', monospace;
  background: rgba(251,191,36,0.16);
  color: #fbbf24;
  padding: 2px 7px; border-radius: 99px;
}

/* ── Memories tab content ── */
.memories-header {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 4px 14px 12px; gap: 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin: 0 6px 14px;
}
.memories-title {
  font: italic 600 13px 'Lora', Georgia, serif;
  color: #c4b5fd;
}
.memories-progress {
  font: 700 12px 'DM Mono', 'Consolas', monospace;
  color: #fbbf24;
}
.memories-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  padding: 0 14px;
  max-height: 340px;
  overflow-y: auto;
}
@media (max-width: 480px) {
  .memories-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
}
.memory-shard {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  background: rgba(20, 18, 32, 0.6);
  border: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  cursor: default;
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
  overflow: hidden;
}
.memory-shard.locked   { opacity: 0.45; filter: grayscale(0.6); }
.memory-shard.unlocked {
  cursor: pointer;
  border-color: rgba(251,191,36,0.42);
  background: radial-gradient(circle at 50% 30%, rgba(251,191,36,0.18), rgba(20,16,28,0.85) 75%);
  box-shadow: 0 0 18px rgba(251,191,36,0.18);
}
.memory-shard.unlocked:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(251,191,36,0.28); }
.memory-shard-icon { font-size: 22px; }
.memory-shard-num  {
  font: 600 9.5px 'DM Mono', 'Consolas', monospace;
  letter-spacing: 1px; text-transform: uppercase;
  color: #635f80;
}
.memory-shard.unlocked .memory-shard-num { color: #fbbf24; }
.memory-shard-title {
  font: italic 11px/1.3 'Lora', Georgia, serif;
  color: #c4b5fd;
  text-align: center; padding: 0 6px;
  max-height: 30px; overflow: hidden;
}
.memory-shard.locked .memory-shard-title { color: #4b4663; }
.memories-footnote {
  margin: 12px 14px 6px;
  font: italic 11px 'Lora', Georgia, serif;
  color: #635f80;
  text-align: center;
}

/* All 10 shards collected — broken mirror "heals" with a soft golden pulse.
   The cracks (the gaps between tiles) light up; tiles glow brighter together. */
.memories-grid.memories-grid-complete {
  position: relative;
  border-radius: 14px;
  animation: spMirrorHeal 4s ease-out 0.2s 1;
}
.memories-grid.memories-grid-complete .memory-shard.unlocked {
  animation: spShardSettle 2.4s ease-in-out 0.2s 1;
}
.memories-grid.memories-grid-complete::after {
  content: '';
  position: absolute; inset: -6px;
  border-radius: 16px;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgba(251,191,36,0.22), transparent 70%);
  animation: spMirrorGlow 3.6s ease-out 0.4s 1;
  opacity: 0;
}
@keyframes spMirrorHeal {
  0%   { box-shadow: 0 0 0 rgba(251,191,36,0); }
  50%  { box-shadow: 0 0 50px rgba(251,191,36,0.32); }
  100% { box-shadow: 0 0 14px rgba(251,191,36,0.10); }
}
@keyframes spMirrorGlow {
  0%   { opacity: 0; }
  40%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes spShardSettle {
  0%   { transform: translateY(0)   scale(1);    box-shadow: 0 0 18px rgba(251,191,36,0.18); }
  50%  { transform: translateY(-3px) scale(1.04); box-shadow: 0 8px 36px rgba(251,191,36,0.40); }
  100% { transform: translateY(0)   scale(1);    box-shadow: 0 0 18px rgba(251,191,36,0.18); }
}

/* ── Name input (post-Shard-10 campfire) ── */
.sp-paper-name { width: min(440px, 92vw); padding: 28px 30px; text-align: center; }
.sp-paper-name .sp-line-italic { color: #c4b5fd; font-style: italic; margin: 4px 0 12px; }
.sp-name-row { margin: 18px 0 12px; }
.sp-name-field {
  width: 100%;
  padding: 12px 14px;
  background: rgba(20,18,32,0.85);
  border: 1px solid rgba(251,191,36,0.30);
  border-radius: 12px;
  color: #fef3c7;
  font: 600 16px 'Lora', Georgia, serif;
  text-align: center;
  outline: none;
  transition: border-color .2s, box-shadow .2s;
}
.sp-name-field::placeholder { color: rgba(196,181,253,0.5); font-style: italic; }
.sp-name-field:focus {
  border-color: rgba(251,191,36,0.7);
  box-shadow: 0 0 18px rgba(251,191,36,0.18);
}
.sp-name-buttons { display: flex; justify-content: center; gap: 10px; margin-top: 8px; }

/* Soft pulse on the campfire stone ring while name input is armed.
   (Visual cue is rendered on the canvas inside campfire.js.) */

/* ── Crown Flame fullscreen flash (Phase 6) ── */
body.crown-flash::after {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 55%, rgba(251,191,36,0.45), rgba(251,191,36,0) 60%);
  animation: spCrownFlash 1.8s ease-out forwards;
  z-index: 150;
}
@keyframes spCrownFlash {
  0%   { opacity: 0;   }
  20%  { opacity: 1;   }
  100% { opacity: 0;   }
}

/* ── Finale (Phase 5): HUD fade + ending modes ── */
body.finale-active #hud-top,
body.finale-active #hud-bottom {
  opacity: 0.20;
  transition: opacity 1.2s ease-out;
  pointer-events: none;
}
body.ending-light #hud-top,
body.ending-light #hud-bottom {
  opacity: 1;
  pointer-events: auto;
  transition: opacity 1.6s ease-in;
}
body.ending-light {
  /* Locked golden-hour palette — gentle warmth across the canvas. */
  filter: hue-rotate(-12deg) saturate(1.15) brightness(1.06);
  transition: filter 2s ease-out;
}
#ending-crown {
  position: absolute;
  top: 8px; right: 12px;
  font-size: 22px;
  pointer-events: none;
  text-shadow: 0 0 12px rgba(251,191,36,0.7);
  animation: spCrownPulse 4s ease-in-out infinite;
  z-index: 20;
}
@keyframes spCrownPulse {
  0%,100% { opacity: 0.85; transform: scale(1); }
  50%     { opacity: 1.0;  transform: scale(1.08); }
}

/* ── Death-screen story prelude (Phase 5) ── */
.death-story-prelude {
  font: italic 13px/1.7 'Lora', Georgia, serif;
  color: #a099be;
  padding: 6px 22px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin: 0 16px 12px;
}
.death-story-prelude strong { color: #c4b5fd; font-style: normal; }
.death-accumulation-line {
  font: italic 11px 'Lora', Georgia, serif;
  color: #635f80;
  margin: 14px 22px 4px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255,255,255,0.06);
  opacity: 0.85;
}
.run-legacy-perk-sub {
  font: italic 11px 'Lora', Georgia, serif;
  color: #c4b5fd;
  display: block;
  margin-top: 2px;
  opacity: 0.78;
}
.run-legacy-title {
  /* Gentle warmth on the rename. */
  color: #fde68a !important;
}


/* ── Glimmers pane (Compy modal → Glimmers tab) ── */
.tier-glimmers-body {
  padding: 10px 14px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.glimmer-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px;
  background: rgba(20,18,32,0.55);
  border: 1px solid rgba(255,255,255,0.06);
  border-left: 3px solid #4b4663;
  border-radius: 12px;
  transition: background .2s, border-color .2s;
}
.glimmer-row:not(.glimmer-row-locked):hover { background: rgba(20,18,32,0.78); }
.glimmer-row-locked { opacity: 0.55; filter: grayscale(0.4); }
.glimmer-row-icon {
  font-size: 28px; width: 40px; text-align: center;
  text-shadow: 0 0 12px currentColor;
}
.glimmer-row-main { flex: 1; min-width: 0; }
.glimmer-row-title {
  font: 700 13px 'Inter', system-ui, sans-serif; color: #ede8f5;
}
.glimmer-row-nick { font: italic 12px 'Lora', Georgia, serif; color: #a099be; }
.glimmer-row-rel  {
  display: block;
  margin-top: 2px;
  font: 600 10px 'Inter', system-ui, sans-serif;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: #635f80;
}
.glimmer-row-bond { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.bond-heart { font-size: 14px; }
.bond-heart-full  { color: #fbbf24; text-shadow: 0 0 6px rgba(251,191,36,0.5); }
.bond-heart-empty { color: #4b4663; }
.bond-count { font: 700 11px 'DM Mono', 'Consolas', monospace; color: #c4b5fd; margin-right: 6px; }
.bond-status {
  font: 600 10px 'Inter', system-ui, sans-serif;
  letter-spacing: .5px; text-transform: uppercase;
  padding: 2px 8px; border-radius: 99px;
}
.bond-status-locked { background: rgba(255,255,255,0.04); color: #635f80; border: 1px solid rgba(255,255,255,0.08); }
.bond-status-found  { background: rgba(167,139,250,0.10); color: #c4b5fd; border: 1px solid rgba(167,139,250,0.25); }
.bond-status-known  { background: rgba(20,184,166,0.10); color: #5eead4; border: 1px solid rgba(20,184,166,0.25); }
.bond-status-bonded { background: rgba(251,191,36,0.18); color: #fde68a; border: 1px solid rgba(251,191,36,0.40); }
.glimmer-row-quote {
  margin-top: 6px;
  font: italic 12px/1.55 'Lora', Georgia, serif;
  color: #fde68a; opacity: .9;
  border-left: 2px solid rgba(251,191,36,0.4); padding-left: 10px;
}
`;
