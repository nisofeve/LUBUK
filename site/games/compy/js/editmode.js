import { getLevelLightRadius } from '../data/data.js';

// ──────────────────────────────────────────────────────────────
// EditMode  –  tap Edit → rearrange / store structures + cosmetics
// ──────────────────────────────────────────────────────────────
export class EditMode {
  constructor(game) {
    this.game    = game;
    this.active  = false;

    // Major-structure selection / drag state
    this._selected      = null;   // 'cookingStation' | 'merchantCamp'
    this._dragging      = false;
    this._dragOffX      = 0;
    this._dragOffY      = 0;

    // Cosmetic selection
    this._selectedCos   = -1;     // index into placedCosmetics

    // Camera pan state
    this._panning       = false;
    this._panStartCamX  = 0;
    this._panStartCamY  = 0;
    this._panStartCX    = 0;
    this._panStartCY    = 0;

    // Zoom animation
    this._targetZoom    = 1;
    this._baseZoom      = 1;

    // Placement from inventory (major structures)
    this._placing       = null;
    this._previewX      = 0;
    this._previewY      = 0;
    this._previewValid  = false;

    // Placement from inventory (cosmetics)
    this._placingCos    = -1;     // index into COSMETIC_DEFS

    // Which major structures are stowed
    this.stored = {
      cookingStation: false,
      merchantCamp:   false,
    };

    // Placed cosmetics: [{ id, x, y }, ...]
    this.placedCosmetics = [];

    // r     = overlap-prevention radius
    // hitR  = tap-detection & visual ring radius
    this.DEFS = {
      cookingStation: { icon: '🍳', label: 'Cooking Station', r: 0.9, hitR: 0.38 },
      merchantCamp:   { icon: '🏕️', label: 'Merchant Camp',   r: 1.1, hitR: 0.62 },
    };
    // Child camp keys are added lazily via registerChildCamps() once the
    // ChildrenManager exists (it's constructed after EditMode in Game).
  }

  // ── Child camps registration ──────────────────────────────────
  // Called from main.js after `this.children = new ChildrenManager(this)`.
  // Adds 6 movable structures (one per Glimmer) into DEFS + stored maps so
  // the player can drag them around in Edit Mode just like the Cooking
  // Station and the Merchant Camp.
  registerChildCamps() {
    const camps = this.game.children?.camps;
    if (!camps) return;
    const labelFor = {
      music_stand: 'Music Stand',
      workbench:   'Workbench',
      easel:       'Art Easel',
      picnic:      'Picnic Spot',
      arena:       'Wooden Arena',
      pillow_fort: 'Pillow Fort',
    };
    // Per-type tap zone (cartesian-tile units). Slightly larger than the
    // visible footprint so the player rarely "just misses" a camp prop.
    const hitFor = {
      music_stand: 0.80,   // tall + narrow (sheet stand)
      workbench:   0.95,   // wide bench
      easel:       0.85,
      picnic:      1.00,   // round blanket — biggest footprint
      arena:       0.95,
      pillow_fort: 0.95,
    };
    for (let i = 0; i < camps.length; i++) {
      const c    = camps[i];
      const def  = c.def;
      const key  = `child_camp_${i}`;
      const sub  = labelFor[c.type] || 'Camp';
      this.DEFS[key] = {
        icon:  def.icon || '⛺',
        label: `${def.name || 'Glimmer'}’s ${sub}`,
        r:     1.05,                          // overlap-prevention radius
        hitR:  hitFor[c.type] || 0.85,        // generous tap zone
        // Tag so we can find these later without parsing the key everywhere.
        isChildCamp: true,
        childIdx:    i,
      };
      if (!(key in this.stored)) this.stored[key] = false;
    }
  }

  // Resolves a structure key to its live world entity (game.cookingStation /
  // game.merchantCamp / game.children.camps[i]).
  _resolveStruct(key) {
    if (!key) return null;
    if (key === 'cookingStation') return this.game.cookingStation;
    if (key === 'merchantCamp')   return this.game.merchantCamp;
    if (key.startsWith('child_camp_')) {
      const i = parseInt(key.slice('child_camp_'.length), 10);
      return this.game.children?.camps?.[i] || null;
    }
    return this.game[key] || null;
  }

  // True if the structure is currently allowed to be interacted with in edit
  // mode. Child camps require their child to be at least at SILHOUETTE phase
  // (i.e. discovered or about to be) — otherwise the prop is hidden.
  _structVisible(key) {
    const def = this.DEFS[key];
    if (!def) return false;
    if (def.isChildCamp) {
      const child = this.game.children?.list?.[def.childIdx];
      return !!(child && child.phase !== 'HIDDEN');
    }
    return true;
  }

  // ── Activate / deactivate ───────────────────────────────────
  enter() {
    this.active         = true;
    this._selected      = null;
    this._selectedCos   = -1;
    this._dragging      = false;
    this._panning       = false;
    this._placing       = null;
    this._placingCos    = -1;
    this.game._prevTimeMultiplier = this.game.time.multiplier;
    this.game.time.multiplier    = 0;

    // Freeze player in place immediately
    const p = this.game.player;
    if (p) {
      p.targetX = p.x; p.targetY = p.y;
      p.visualX  = p.x; p.visualY  = p.y;
      p.isWalking = false; p.isPetting = false;
      p.isEating  = false; p.isPickingUp = false;
      p.petTarget = null; p.targetEntity = null;
      p.pickupItemTarget = null;
      clearTimeout(p.autoTimer);
      p.isAuto = false;
    }

    this._baseZoom   = this.game.camera.zoom;
    this._targetZoom = this._baseZoom * 0.7;

    const btn = document.getElementById('btn-edit');
    if (btn) btn.innerHTML = '✕<br><span>Exit</span>';

    document.getElementById('hud-top')?.classList.add('edit-hide-up');
    ['btn-craft', 'btn-tiers', 'btn-ach'].forEach(id =>
      document.getElementById(id)?.classList.add('edit-hide-down')
    );

    const inv = document.getElementById('btn-inv');
    if (inv) {
      inv.innerHTML = '🏗️<br><span>Place</span>';
      inv.onclick    = () => this._openStructPanel();
    }

    document.getElementById('btn-passport')?.classList.add('edit-hide-down');
  }

  exit() {
    this.active     = false;
    this._selected  = null;
    this._selectedCos = -1;
    this._dragging  = false;
    this._panning   = false;
    this._placing   = null;
    this._placingCos = -1;
    this.game.time.multiplier = this.game._prevTimeMultiplier ?? 1;

    this._targetZoom = this._baseZoom;

    const btn = document.getElementById('btn-edit');
    if (btn) btn.innerHTML = '✏️<br><span>Edit</span>';

    document.getElementById('hud-top')?.classList.remove('edit-hide-up');
    ['btn-craft', 'btn-tiers', 'btn-ach'].forEach(id =>
      document.getElementById(id)?.classList.remove('edit-hide-down')
    );

    const inv = document.getElementById('btn-inv');
    if (inv) {
      inv.innerHTML = '🎒<br><span>Items</span>';
      inv.onclick    = () => window.openMenu('inv');
    }

    document.getElementById('btn-passport')?.classList.remove('edit-hide-down');

    this.game.canvas?.classList.remove('edit-placing');
    window._hideEditPlaceBar?.();
    this._placePending = false;
    window.closeMenu('struct');
    this.game.saveGame();
  }

  // ── Update (called each frame) ──────────────────────────────
  update(dt) {
    const g   = this.game;
    const spd = 6;
    const dz  = this._targetZoom - g.camera.zoom;
    if (Math.abs(dz) > 0.001) {
      g.camera.zoom += dz * spd * dt;
    } else {
      g.camera.zoom = this._targetZoom;
    }
  }

  // ── Input handling ──────────────────────────────────────────

  handleDown(clientX, clientY, cartX, cartY) {
    // ── Cosmetic placement mode ─────────────────────────────
    // New flow (mobile-friendly): TOUCH starts a "pending place" state,
    // DRAG moves the preview, LIFT commits the placement. The Place /
    // Cancel toolbar at the bottom of the screen also commits / aborts.
    if (this._placingCos >= 0) {
      const hitCos = this._cosmeticAt(cartX, cartY);
      if (hitCos >= 0) { this._cancelPlaceMode(); this._selectedCos = hitCos; return; }
      const hitStruct = this._structAt(cartX, cartY);
      if (hitStruct) { this._cancelPlaceMode(); this._selected = hitStruct; return; }
      // Snap preview to the touch point — player can drag from here.
      this._previewX = cartX; this._previewY = cartY;
      this._previewValid = this._isValidCosPos(cartX, cartY);
      this._placePending = true;
      return;
    }

    // ── Major structure placement mode ───────────────────────
    if (this._placing) {
      const hitStruct = this._structAt(cartX, cartY);
      if (hitStruct && hitStruct !== this._placing) { this._cancelPlaceMode(); this._selected = hitStruct; return; }
      const hitCos = this._cosmeticAt(cartX, cartY);
      if (hitCos >= 0) { this._cancelPlaceMode(); this._selectedCos = hitCos; return; }
      this._previewX = cartX; this._previewY = cartY;
      this._previewValid = this._isValidPos(this._placing, cartX, cartY);
      this._placePending = true;
      return;
    }

    // ── Selected cosmetic ────────────────────────────────────
    if (this._selectedCos >= 0) {
      if (this._isBagTapCos(this._selectedCos, clientX, clientY)) {
        this._storeCosmetic(this._selectedCos);
        return;
      }
      const hitCos = this._cosmeticAt(cartX, cartY);
      if (hitCos === this._selectedCos) {
        const c = this.placedCosmetics[hitCos];
        this._dragging = true;
        this._dragOffX = cartX - c.x;
        this._dragOffY = cartY - c.y;
        return;
      }
      if (hitCos >= 0) {
        this._selectedCos = hitCos;
        this._selected    = null;
        this._dragging    = false;
        return;
      }
      const hitStruct = this._structAt(cartX, cartY);
      if (hitStruct) {
        this._selectedCos = -1;
        this._selected    = hitStruct;
        this._dragging    = false;
        return;
      }
      this._selectedCos = -1;
      this._dragging    = false;
      this._startPan(clientX, clientY);
      return;
    }

    // ── Selected major structure ─────────────────────────────
    if (this._selected) {
      if (this._isBagTap(this._selected, clientX, clientY)) {
        this._storeStruct(this._selected);
        return;
      }
      const hit = this._structAt(cartX, cartY);
      if (hit === this._selected) {
        const obj      = this._resolveStruct(this._selected);
        if (!obj) return;
        this._dragging = true;
        this._dragOffX = cartX - obj.x;
        this._dragOffY = cartY - obj.y;
        return;
      }
      if (hit) {
        this._selected = hit;
        this._dragging = false;
        return;
      }
      const hitCos = this._cosmeticAt(cartX, cartY);
      if (hitCos >= 0) {
        this._selected    = null;
        this._selectedCos = hitCos;
        this._dragging    = false;
        return;
      }
      this._selected = null;
      this._dragging = false;
      this._startPan(clientX, clientY);
      return;
    }

    // ── No selection ─────────────────────────────────────────
    const hit = this._structAt(cartX, cartY);
    if (hit) {
      this._selected = hit;
    } else {
      const hitCos = this._cosmeticAt(cartX, cartY);
      if (hitCos >= 0) {
        this._selectedCos = hitCos;
      } else {
        this._startPan(clientX, clientY);
      }
    }
  }

  handleMove(clientX, clientY, cartX, cartY) {
    if (this._placingCos >= 0) {
      this._previewX     = cartX;
      this._previewY     = cartY;
      this._previewValid = this._isValidCosPos(cartX, cartY);
      return;
    }
    if (this._placing) {
      this._previewX     = cartX;
      this._previewY     = cartY;
      this._previewValid = this._isValidPos(this._placing, cartX, cartY);
      return;
    }
    if (this._dragging && this._selectedCos >= 0) {
      let nx = cartX - this._dragOffX;
      let ny = cartY - this._dragOffY;
      [nx, ny] = this._clampCosmeticPos(nx, ny);
      const c = this.placedCosmetics[this._selectedCos];
      c.x = nx; c.y = ny;
      return;
    }
    if (this._dragging && this._selected) {
      let nx = cartX - this._dragOffX;
      let ny = cartY - this._dragOffY;
      [nx, ny] = this._clampStructPos(this._selected, nx, ny);
      const obj = this._resolveStruct(this._selected);
      if (obj) {
        obj.x = nx;  obj.y = ny;
        obj.visualX = nx;  obj.visualY = ny;
      }
      return;
    }
    if (this._panning) {
      const g  = this.game;
      const dx = clientX - this._panStartCX;
      const dy = clientY - this._panStartCY;
      g.camera.x = this._panStartCamX - dx / g.camera.zoom;
      g.camera.y = this._panStartCamY - dy / g.camera.zoom;
    }
  }

  handleUp() {
    this._dragging = false;
    this._panning  = false;
    // Lift-to-place: if a placement was pending, commit it now. Lets
    // mobile players drag a finger to fine-tune the spot before
    // releasing — far easier than trying to tap the exact cell.
    if (this._placePending) {
      this._placePending = false;
      if (this._placingCos >= 0) {
        if (this._previewValid) this._placeCosmetic(this._placingCos, this._previewX, this._previewY);
        else                    this._flashInvalid = 0.4;
      } else if (this._placing) {
        if (this._previewValid) this._placeStruct(this._placing, this._previewX, this._previewY);
        else                    this._flashInvalid = 0.4;
      }
    }
  }

  // Programmatic confirm — wired to the Place ✓ button on the floating
  // mobile placement toolbar so the player has an alternative to lift.
  confirmPlacement() {
    this._placePending = false;
    if (this._placingCos >= 0) {
      if (this._previewValid) this._placeCosmetic(this._placingCos, this._previewX, this._previewY);
      else                    this._flashInvalid = 0.4;
    } else if (this._placing) {
      if (this._previewValid) this._placeStruct(this._placing, this._previewX, this._previewY);
      else                    this._flashInvalid = 0.4;
    }
  }

  _startPan(clientX, clientY) {
    const g            = this.game;
    this._panning      = true;
    this._panStartCamX = g.camera.x;
    this._panStartCamY = g.camera.y;
    this._panStartCX   = clientX;
    this._panStartCY   = clientY;
  }

  // ── Helpers ─────────────────────────────────────────────────

  _structAt(cx, cy) {
    for (const [key, def] of Object.entries(this.DEFS)) {
      if (this.stored[key]) continue;
      if (!this._structVisible(key)) continue;
      const obj = this._resolveStruct(key);
      if (obj && Math.hypot(obj.x - cx, obj.y - cy) < def.hitR) return key;
    }
    return null;
  }

  _cosmeticAt(cx, cy) {
    for (let i = 0; i < this.placedCosmetics.length; i++) {
      const c = this.placedCosmetics[i];
      if (Math.hypot(c.x - cx, c.y - cy) < 0.45) return i;
    }
    return -1;
  }

  _isBagTap(key, clientX, clientY) {
    const pos = this._bagScreenPos(key);
    if (!pos) return false;
    return Math.hypot(clientX - pos.sx, clientY - pos.sy) < 26 * this.game.camera.zoom;
  }

  _bagScreenPos(key) {
    const obj = this._resolveStruct(key);
    if (!obj) return null;
    const def   = this.DEFS[key];
    const iso   = this.game.world.toIso(obj.x, obj.y);
    const bagIsoY = iso.y - def.hitR * 32 - 46;
    const g     = this.game;
    return {
      sx: (iso.x   - g.camera.x) * g.camera.zoom + g.canvas.width  / 2,
      sy: (bagIsoY - g.camera.y) * g.camera.zoom + g.canvas.height / 2,
    };
  }

  _isBagTapCos(idx, clientX, clientY) {
    const pos = this._bagScreenPosCos(idx);
    if (!pos) return false;
    return Math.hypot(clientX - pos.sx, clientY - pos.sy) < 22 * this.game.camera.zoom;
  }

  _bagScreenPosCos(idx) {
    const c = this.placedCosmetics[idx];
    if (!c) return null;
    const iso = this.game.world.toIso(c.x, c.y);
    const bagIsoY = iso.y - 46;
    const g = this.game;
    return {
      sx: (iso.x   - g.camera.x) * g.camera.zoom + g.canvas.width  / 2,
      sy: (bagIsoY - g.camera.y) * g.camera.zoom + g.canvas.height / 2,
    };
  }

  _clampStructPos(key, nx, ny) {
    const g = this.game;
    const lightRadius = getLevelLightRadius(g.player.stats.level);
    const safeR       = Math.max(0, lightRadius - 1.5);
    const d           = Math.hypot(nx, ny);
    if (d > safeR) { nx = (nx / d) * safeR; ny = (ny / d) * safeR; }

    const selfR  = this.DEFS[key].r;
    const minCamp = selfR + 1.0;
    const dc     = Math.hypot(nx, ny);
    if (dc < minCamp) {
      if (dc < 0.01) { nx = minCamp; ny = 0; }
      else { nx = (nx / dc) * minCamp; ny = (ny / dc) * minCamp; }
    }

    for (const [oKey, oDef] of Object.entries(this.DEFS)) {
      if (oKey === key || this.stored[oKey]) continue;
      if (!this._structVisible(oKey)) continue;
      const other   = this._resolveStruct(oKey);
      if (!other) continue;
      const minDist = selfR + oDef.r + 0.15;
      const od      = Math.hypot(nx - other.x, ny - other.y);
      if (od < minDist) {
        const dx = nx - other.x, dy = ny - other.y;
        if (od < 0.01) { nx = other.x + minDist; }
        else { nx = other.x + (dx / od) * minDist; ny = other.y + (dy / od) * minDist; }
      }
    }

    return [nx, ny];
  }

  _isValidPos(key, nx, ny) {
    const [cx, cy] = this._clampStructPos(key, nx, ny);
    return Math.hypot(cx - nx, cy - ny) < 0.2;
  }

  _clampCosmeticPos(x, y) {
    const lightRadius = getLevelLightRadius(this.game.player.stats.level);
    const safeR = Math.max(0, lightRadius - 1.2);
    const d = Math.hypot(x, y);
    if (d > safeR) { x = (x / d) * safeR; y = (y / d) * safeR; }
    // Keep cosmetics away from campfire centre
    const dc = Math.hypot(x, y);
    if (dc < 0.9) {
      if (dc < 0.01) { x = 0.9; y = 0; }
      else { x = (x / dc) * 0.9; y = (y / dc) * 0.9; }
    }
    return [x, y];
  }

  _isValidCosPos(x, y) {
    const lightRadius = getLevelLightRadius(this.game.player.stats.level);
    const safeR = Math.max(0, lightRadius - 1.2);
    if (Math.hypot(x, y) > safeR) return false;
    if (Math.hypot(x, y) < 0.9) return false;
    return true;
  }

  _storeStruct(key) {
    this.stored[key]    = true;
    this._selected      = null;
    this._dragging      = false;
    this._refreshStructPanel();
    this.game.saveGame();
  }

  _placeStruct(key, x, y) {
    const obj = this._resolveStruct(key);
    if (!obj) return;
    obj.x  = x;  obj.y  = y;
    obj.visualX = x;  obj.visualY = y;
    this.stored[key] = false;
    this._placing    = null;
    this.game.canvas?.classList.remove('edit-placing');
    window._hideEditPlaceBar?.();
    this._selected   = key;
    window.closeMenu('struct');
    this._refreshStructPanel();
    this.game.saveGame();
  }

  _placeCosmetic(defIdx, x, y) {
    const defs = window.COSMETIC_DEFS;
    if (!defs || defIdx < 0 || defIdx >= defs.length) return;
    const def = defs[defIdx];
    const inv = this.game.cosmeticInventory;
    if (!inv[def.id] || inv[def.id] <= 0) return;
    const [cx, cy] = this._clampCosmeticPos(x, y);
    inv[def.id]--;
    const remaining = inv[def.id] || 0;
    if (remaining <= 0) delete inv[def.id];
    this.placedCosmetics.push({ id: def.id, x: cx, y: cy });
    // Story task tickers: decor placement counts toward T4.2, T3.2, T1.3.
    const helpers = this.game.children?._taskTickerHelpers;
    if (helpers) {
      helpers.bump('T3.2', 'placed', 1);
      helpers.bump('T4.2', 'placed', 1);
      // T1.3 — decor placed within 2 tiles of Child 1 (idx 0).
      const c1 = this.game.children?.list?.[0];
      if (c1 && c1.phase === 'PRESENT') {
        if (Math.hypot(c1.x - cx, c1.y - cy) < 2) helpers.bump('T1.3', 'placedNear', 1);
      }
    }
    if (remaining > 0) {
      // Stay in place mode — inventory still has more of this item
      this._selectedCos = -1;
      this._refreshStructPanel();
    } else {
      // Inventory empty — auto-exit place mode
      this._placingCos  = -1;
      this._selectedCos = this.placedCosmetics.length - 1;
      this.game.canvas?.classList.remove('edit-placing');
      window._hideEditPlaceBar?.();
      window.closeMenu('struct');
      const inv2 = document.getElementById('btn-inv');
      if (inv2) inv2.innerHTML = '🏗️<br><span>Place</span>';
      this._refreshStructPanel();
    }
    // Signal companions to be curious about new structure
    this.game._newlyPlacedStructure = { id: def.id, x: cx, y: cy };
    // Decor placement achievements — only count REAL decor, not the
    // crafted-prop placement tokens (which use the same placement system
    // for convenience but aren't "decor" in the achievement sense).
    if (this.game.ach && !def.isCraftProp) {
      this.game.ach.inc('decor_placed');
      this.game.ach.max('decor_active', this.placedCosmetics.length);
      if (def.id === 'moon_shrine')    this.game.ach.inc('d_moon_shrine');
      if (def.id === 'beehive')        this.game.ach.inc('d_beehive');
      if (def.id === 'star_post')      this.game.ach.inc('d_starpost');
      if (def.id === 'fairy_ring')     this.game.ach.inc('d_fairy_ring');
      if (def.id === 'treasure_chest') this.game.ach.inc('d_treasure');
      // "Place every decor type" achievement excludes craft props.
      const _allDecorIds = (window.COSMETIC_DEFS || [])
        .filter(d => !d.isCraftProp).map(d => d.id);
      const _placedIds = new Set(
        this.placedCosmetics
          .filter(c => {
            const cd = (window.COSMETIC_DEFS || []).find(d => d.id === c.id);
            return cd && !cd.isCraftProp;
          })
          .map(c => c.id)
      );
      if (_allDecorIds.length > 0 && _allDecorIds.every(id => _placedIds.has(id))) {
        this.game.ach.inc('decor_all_types');
      }
    }
    this.game.saveGame();
  }

  _storeCosmetic(idx) {
    const c = this.placedCosmetics[idx];
    if (!c) return;
    const inv = this.game.cosmeticInventory;
    inv[c.id] = (inv[c.id] || 0) + 1;
    this.placedCosmetics.splice(idx, 1);
    this._selectedCos = -1;
    this._dragging    = false;
    this._refreshStructPanel();
    this.game.saveGame();
  }

  // ── Structure Panel (modal-struct) ──────────────────────────

  _cancelPlaceMode() {
    this._placingCos = -1;
    this._placing    = null;
    this._placePending = false;
    this.game.canvas?.classList.remove('edit-placing');
    const inv = document.getElementById('btn-inv');
    if (inv) inv.innerHTML = '🏗️<br><span>Place</span>';
    window._hideEditPlaceBar?.();
  }

  _openStructPanel() {
    if (this._placingCos >= 0 || this._placing) {
      this._cancelPlaceMode();
      return;
    }
    this._refreshStructPanel();
    window.openMenu('struct');
  }

  _refreshStructPanel() {
    const list = document.getElementById('struct-list');
    if (!list) return;
    const defs = window.COSMETIC_DEFS || [];
    const storedEntries = Object.entries(this.stored).filter(([, v]) => v);
    const allCosEntries = Object.entries(this.game.cosmeticInventory || {})
      .filter(([, cnt]) => cnt > 0)
      .map(([id, cnt]) => ({ id, cnt, def: defs.find(d => d.id === id) }))
      .filter(e => e.def);
    // Split crafted props from regular decor so the panel reads as
    // "Crafted Props" + "Decor" — easier to find what you just built.
    const craftEntries = allCosEntries.filter(e => e.def.isCraftProp);
    const cosEntries   = allCosEntries.filter(e => !e.def.isCraftProp);

    if (storedEntries.length === 0 && allCosEntries.length === 0) {
      list.innerHTML = `<div class="struct-empty">No structures in inventory.<br>Craft a prop, move structures to the bag icon,<br>or buy Decor from the Merchant.</div>`;
      return;
    }

    const structHtml = storedEntries.map(([key]) => {
      const def = this.DEFS[key];
      return `<div class="struct-row" onclick="window._editPlaceStruct('${key}')">
        <span class="struct-row-icon">${def.icon}</span>
        <div class="struct-row-info">
          <div class="struct-row-name">${def.label}</div>
          <div class="struct-row-sub">Tap to place on map</div>
        </div>
        <span class="struct-place-btn">Place ›</span>
      </div>`;
    }).join('');

    const rowHtml = (entry) => {
      const { id, cnt, def } = entry;
      const defIdx = defs.findIndex(d => d.id === id);
      return `<div class="struct-row" onclick="window._editPlaceCos(${defIdx})">
        <span class="struct-row-icon">${def.icon}</span>
        <div class="struct-row-info">
          <div class="struct-row-name">${def.name}</div>
          <div class="struct-row-sub">${cnt > 1 ? 'x'+cnt+' available' : 'Tap to place'}</div>
        </div>
        <span class="struct-place-btn">Place ›</span>
      </div>`;
    };

    const craftHeader = craftEntries.length
      ? `<div class="struct-section-label">Crafted Props (${craftEntries.reduce((s,e)=>s+e.cnt,0)})</div>` : '';
    const craftHtml = craftEntries.map(rowHtml).join('');

    const cosHeader = cosEntries.length
      ? `<div class="struct-section-label">Decor (${cosEntries.reduce((s,e)=>s+e.cnt,0)} items)</div>` : '';
    const cosHtml = cosEntries.map(rowHtml).join('');

    list.innerHTML = structHtml + craftHeader + craftHtml + cosHeader + cosHtml;
  }

  // ── Drawing ─────────────────────────────────────────────────

  drawGrid(ctx) {
    const lr  = getLevelLightRadius(this.game.player.stats.level);
    const gr  = Math.ceil(lr) + 1;
    const w   = this.game.world;
    ctx.save();
    ctx.lineWidth = 0.7;

    for (let i = -gr; i <= gr; i++) {
      for (let j = -gr; j <= gr; j++) {
        if (Math.hypot(i + 0.5, j + 0.5) > lr - 0.4) continue;
        const p0 = w.toIso(i,   j);
        const p1 = w.toIso(i+1, j);
        const p2 = w.toIso(i+1, j+1);
        const p3 = w.toIso(i,   j+1);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle   = 'rgba(139,92,246,0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(139,92,246,0.20)';
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** Draw placed cosmetics — called from main draw loop (always visible) */
  drawCosmetics(ctx) {
    if (!this.placedCosmetics.length) return;
    const defs = window.COSMETIC_DEFS;
    if (!defs) return;
    ctx.save();
    ctx.font = '26px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of this.placedCosmetics) {
      const def = defs.find(d => d.id === c.id);
      if (!def) continue;
      const iso = this.game.world.toIso(c.x, c.y);
      ctx.fillText(def.icon, iso.x, iso.y - 12);
    }
    ctx.restore();
  }

  drawOverlay(ctx) {
    this.drawGrid(ctx);
    this._drawCampfireFixed(ctx);

    if (this._flashInvalid > 0) this._flashInvalid -= 0.016;

    if (this._placingCos >= 0) {
      this._drawCosPlacementPreview(ctx);
    } else if (this._placing) {
      this._drawPlacementPreview(ctx);
    } else if (this._selectedCos >= 0) {
      this._drawCosSelectionRing(ctx, this._selectedCos);
      this._drawCosBagIcon(ctx, this._selectedCos);
    } else if (this._selected) {
      this._drawSelectionRing(ctx, this._selected);
      this._drawBagIcon(ctx, this._selected);
    }
  }

  _drawCampfireFixed(ctx) {
    const g   = this.game;
    const iso = g.world.toIso(0, 0);
    const t   = Date.now() / 1000;
    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.1;
    ctx.strokeStyle = 'rgba(251,191,36,0.6)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 60, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', 0, -44);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawSelectionRing(ctx, key) {
    const g   = this.game;
    const obj = this._resolveStruct(key);
    if (!obj) return;
    const iso   = g.world.toIso(obj.x, obj.y);
    const t     = Date.now() / 1000;
    const pulse = 0.55 + Math.sin(t * 3.5) * 0.35;
    const def   = this.DEFS[key];
    const rx    = def.hitR * 64;
    const ry    = def.hitR * 32;

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.save();
    ctx.shadowColor = 'rgba(139,92,246,0.9)';
    ctx.shadowBlur  = 14;
    ctx.strokeStyle = `rgba(139,92,246,${pulse})`;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = `rgba(200,180,255,${pulse * 0.7})`;
    ctx.lineWidth   = 1.5;
    [[0,-1],[0,1],[1,0],[-1,0]].forEach(([dx,dy]) => {
      ctx.beginPath();
      ctx.moveTo(dx*rx*0.82, dy*ry*0.82);
      ctx.lineTo(dx*rx, dy*ry);
      ctx.stroke();
    });
    ctx.restore();
  }

  _drawCosSelectionRing(ctx, idx) {
    const c = this.placedCosmetics[idx];
    if (!c) return;
    const iso = this.game.world.toIso(c.x, c.y);
    const t   = Date.now() / 1000;
    const pulse = 0.55 + Math.sin(t * 3.5) * 0.35;

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.shadowColor = 'rgba(139,92,246,0.9)';
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = `rgba(139,92,246,${pulse})`;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawBagIcon(ctx, key) {
    const g   = this.game;
    const obj = this._resolveStruct(key);
    if (!obj) return;
    const iso  = g.world.toIso(obj.x, obj.y);
    const t    = Date.now() / 1000;
    const bobY = Math.sin(t * 3) * 3;
    const def  = this.DEFS[key];
    const bagY = -def.hitR * 32 - 42 + bobY;

    ctx.save();
    ctx.translate(iso.x, iso.y);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, bagY + 24, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = 'rgba(139,92,246,0.6)';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = 'rgba(20,12,40,0.9)';
    ctx.beginPath();
    ctx.arc(0, bagY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,0.7)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.font          = '22px Arial';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('🎒', 0, bagY);

    ctx.font      = 'bold 9px Arial';
    ctx.fillStyle = 'rgba(200,180,255,0.8)';
    ctx.fillText('STORE', 0, bagY + 28);

    ctx.restore();
  }

  _drawCosBagIcon(ctx, idx) {
    const c = this.placedCosmetics[idx];
    if (!c) return;
    const iso  = this.game.world.toIso(c.x, c.y);
    const t    = Date.now() / 1000;
    const bobY = Math.sin(t * 3) * 3;
    const bagY = -44 + bobY;

    ctx.save();
    ctx.translate(iso.x, iso.y);

    ctx.save();
    ctx.shadowColor = 'rgba(139,92,246,0.6)';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = 'rgba(20,12,40,0.9)';
    ctx.beginPath();
    ctx.arc(0, bagY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,0.7)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎒', 0, bagY);

    ctx.font      = 'bold 8px Arial';
    ctx.fillStyle = 'rgba(200,180,255,0.8)';
    ctx.fillText('STORE', 0, bagY + 24);

    ctx.restore();
  }

  _drawPlacementPreview(ctx) {
    const def   = this.DEFS[this._placing];
    const iso   = this.game.world.toIso(this._previewX, this._previewY);
    const valid = this._previewValid;
    const flash = this._flashInvalid > 0;
    const t     = Date.now() / 1000;
    const alpha = flash ? (Math.sin(t * 30) > 0 ? 0.9 : 0.2) : (0.65 + Math.sin(t * 3) * 0.15);

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.ellipse(0, 0, def.r * 64, def.r * 32, 0, 0, Math.PI * 2);
    ctx.fillStyle   = valid ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)';
    ctx.fill();
    ctx.strokeStyle = valid ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.font          = '40px Arial';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillStyle     = '#fff';
    ctx.globalAlpha   = alpha * 0.85;
    ctx.fillText(def.icon, 0, -22);

    ctx.font      = 'bold 11px Arial';
    ctx.fillStyle = valid ? 'rgba(134,239,172,0.9)' : 'rgba(252,165,165,0.9)';
    ctx.fillText(valid ? 'Drag to position · lift to place' : 'Invalid spot', 0, 20);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawCosPlacementPreview(ctx) {
    const defs = window.COSMETIC_DEFS;
    if (!defs || this._placingCos < 0) return;
    const def   = defs[this._placingCos];
    const iso   = this.game.world.toIso(this._previewX, this._previewY);
    const valid = this._previewValid;
    const flash = this._flashInvalid > 0;
    const t     = Date.now() / 1000;
    const alpha = flash ? (Math.sin(t * 30) > 0 ? 0.9 : 0.2) : (0.65 + Math.sin(t * 3) * 0.15);

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle   = valid ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)';
    ctx.fill();
    ctx.strokeStyle = valid ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillText(def.icon, 0, -18);

    ctx.font      = 'bold 11px Arial';
    ctx.fillStyle = valid ? 'rgba(134,239,172,0.9)' : 'rgba(252,165,165,0.9)';
    ctx.fillText(valid ? 'Tap to place' : 'Invalid spot', 0, 16);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Persistence ─────────────────────────────────────────────

  toSaveData() {
    const positions = {
      cookingStation: { x: this.game.cookingStation?.x ?? 2,   y: this.game.cookingStation?.y ?? 0.5 },
      merchantCamp:   { x: this.game.merchantCamp?.x  ?? -2.4, y: this.game.merchantCamp?.y  ?? -2.4 },
    };
    const camps = this.game.children?.camps;
    if (camps) {
      for (let i = 0; i < camps.length; i++) {
        const c = camps[i];
        positions[`child_camp_${i}`] = { x: c.x, y: c.y };
      }
    }
    return {
      stored:          { ...this.stored },
      positions,
      placedCosmetics: this.placedCosmetics.map(c => ({ ...c })),
    };
  }

  fromSaveData(data) {
    if (!data) return;
    if (data.stored)    Object.assign(this.stored, data.stored);
    if (data.positions) {
      const cs = data.positions.cookingStation;
      if (cs && this.game.cookingStation) {
        this.game.cookingStation.x = cs.x; this.game.cookingStation.y = cs.y;
        this.game.cookingStation.visualX = cs.x; this.game.cookingStation.visualY = cs.y;
      }
      const mc = data.positions.merchantCamp;
      if (mc && this.game.merchantCamp) {
        this.game.merchantCamp.x = mc.x; this.game.merchantCamp.y = mc.y;
        this.game.merchantCamp.visualX = mc.x; this.game.merchantCamp.visualY = mc.y;
      }
      // Restore custom child-camp positions if the player rearranged them.
      const camps = this.game.children?.camps;
      if (camps) {
        for (let i = 0; i < camps.length; i++) {
          const saved = data.positions[`child_camp_${i}`];
          if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
            const c = camps[i];
            c.x = saved.x; c.y = saved.y;
            c.visualX = saved.x; c.visualY = saved.y;
          }
        }
      }
    }
    if (data.placedCosmetics) {
      this.placedCosmetics = data.placedCosmetics.map(c => ({ ...c }));
    }
  }
}
