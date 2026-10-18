import { getItemData, getCompanionById } from '../data/data.js';

export class Entity {
  constructor(cartX, cartY, objData) {
    this.x = cartX;
    this.y = cartY;
    this.id = objData.id || Math.random().toString(36).substr(2, 9);
    this.name = objData.name || "Entity";
    
    // Smooth visual interpolation
    this.visualX = cartX;
    this.visualY = cartY;
    
    // Physics / Pathing
    this.targetX = cartX;
    this.targetY = cartY;
    this.speed = objData.speed || 2;
    this.activeEmote = null;
    this.emoteTimer = 0;
    this.emoteAnim = 0;
  }

  showEmote(emoji, duration = 2.0) {
    this.activeEmote = emoji;
    this.emoteTimer = duration;
    this.emoteAnim = 0;
    
    // SFX - subtle audio feedback
    if (window.AudioContext) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        let vol = 0.03;
        let dur = 0.15;

        if (emoji === '💬' || emoji === '💧' || emoji === '🍗') {
           osc.type = 'sine';
           osc.frequency.setValueAtTime(500, audioCtx.currentTime);
           osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.08);
           vol = 0.025;
        } else if (emoji === '💔' || emoji === '💀') {
           // Sad/death: very soft, low, gentle sine
           osc.type = 'sine';
           osc.frequency.setValueAtTime(220, audioCtx.currentTime);
           osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.25);
           vol = 0.015;
           dur = 0.25;
        } else if (emoji === '💢') {
           osc.type = 'sawtooth';
           osc.frequency.setValueAtTime(150, audioCtx.currentTime);
           osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);
           vol = 0.02;
        } else if (emoji === '✨' || emoji === '🏆' || emoji === '🌟') {
           osc.type = 'triangle';
           osc.frequency.setValueAtTime(700, audioCtx.currentTime);
           osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.1);
           vol = 0.03;
        } else {
           osc.type = 'sine';
           osc.frequency.setValueAtTime(550, audioCtx.currentTime);
           osc.frequency.exponentialRampToValueAtTime(650, audioCtx.currentTime + 0.08);
           vol = 0.02;
        }
        
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + dur);
      } catch(e) {}
    }
  }

  update(dt) {
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      this.emoteAnim += dt;
    } else {
      this.activeEmote = null;
    }

    // Interpolate visual position towards actual Cartesian position
    this.visualX += (this.x - this.visualX) * 10 * dt;
    this.visualY += (this.y - this.visualY) * 10 * dt;
  }

  draw(ctx, world) {
    const iso = world.toIso(this.visualX, this.visualY);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    this.renderSpecific(ctx);
    this.renderEmote(ctx);
    ctx.restore();
  }

  renderEmote(ctx) {
    if (this.activeEmote) {
      const floatVal = Math.sin(this.emoteAnim * 4) * 2;
      let scale = Math.min(1, this.emoteAnim * 5);
      if (this.emoteAnim < 0.25) scale *= 1.0 + Math.sin(this.emoteAnim * 20) * 0.15;
      let alpha = 1;
      if (this.emoteTimer < 0.5) alpha = this.emoteTimer / 0.5;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, -122 + floatVal);
      ctx.scale(scale * 0.7, scale * 0.7);

      // Balloon (balloon body: ±24 corners, r=12)
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(-24, -24, 12, Math.PI, Math.PI*1.5);
      ctx.arc( 24, -24, 12, Math.PI*1.5, Math.PI*2);
      ctx.arc( 24,  24, 12, 0, Math.PI*0.5);
      ctx.arc(-24,  24, 12, Math.PI*0.5, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Pointer
      ctx.beginPath();
      ctx.moveTo(-6, 36); ctx.lineTo(6, 36); ctx.lineTo(0, 46);
      ctx.fill();
      // Border
      ctx.strokeStyle = 'rgba(0,0,0,0.09)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(-24, -24, 12, Math.PI, Math.PI*1.5);
      ctx.arc( 24, -24, 12, Math.PI*1.5, Math.PI*2);
      ctx.arc( 24,  24, 12, 0, Math.PI*0.5);
      ctx.arc(-24,  24, 12, Math.PI*0.5, Math.PI);
      ctx.closePath();
      ctx.stroke();
      // Emoji
      ctx.font = '36px Arial';
      ctx.fillStyle = '#111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.activeEmote, 0, 0);
      ctx.restore();
    }
  }

  renderSpecific(ctx) {
    // Override
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI*2);
    ctx.fill();
  }
}

export class ItemDrop extends Entity {
  constructor(x, y, itemName) {
    super(x, y, { name: itemName });
    this.itemName = itemName;
    this.hoverTime = Math.random() * Math.PI * 2;
    
    const visual = getItemData(itemName);
    this.icon = visual.icon;
    this.color = visual.color;
  }

  update(dt) {
    this.hoverTime += dt * 3;
    if (this._pickupCooldown > 0) this._pickupCooldown -= dt;
    super.update(dt);
  }

  renderSpecific(ctx) {
    const floatY = Math.sin(this.hoverTime) * 3;
    const pulse = 1 + Math.sin(this.hoverTime * 1.5) * 0.1;

    ctx.save();
    ctx.scale(2, 2); // 2x bigger items

    ctx.save();
    ctx.translate(0, -10 + floatY);
    ctx.scale(pulse, pulse);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, 0, 0);

    ctx.restore();
    ctx.restore();
  }
}

// ── Attack VFX (slash / projectile burst) ─────────────────────
export class AttackVFX {
  constructor(x, y, type = 'slash', color = '#fff', angle = 0) {
    this.x = x; this.y = y;
    this.type  = type;   // 'slash' | 'projectile'
    this.color = color;
    this.angle = angle;
    this.life  = 0;
    this.maxLife = type === 'slash' ? 0.28 : 0.5;
    this.particles = [];
    if (type === 'projectile') {
      for (let i = 0; i < 8; i++) {
        const a = angle + (Math.random() - 0.5) * 0.8;
        const spd = 2 + Math.random() * 3;
        this.particles.push({ x: 0, y: 0, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, size: 3+Math.random()*4 });
      }
    }
    this.done = false;
    this._playSFX(type, color);
  }

  _playSFX(type, color) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      if (type === 'slash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.15);
        g.gain.setValueAtTime(0.06, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
        osc.start(); osc.stop(ac.currentTime + 0.18);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.25);
        g.gain.setValueAtTime(0.05, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.28);
        osc.start(); osc.stop(ac.currentTime + 0.28);
      }
    } catch(e) {}
  }

  update(dt) {
    this.life += dt;
    if (this.life >= this.maxLife) { this.done = true; return; }
    for (const p of this.particles) {
      p.x += p.vx * dt * 60 * 0.016;
      p.y += p.vy * dt * 60 * 0.016;
      p.vx *= 0.92; p.vy *= 0.92;
    }
  }

  draw(ctx, world) {
    const iso = world.toIso(this.x, this.y);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    const pct = this.life / this.maxLife;
    const alpha = 1 - pct;

    if (this.type === 'slash') {
      const len  = 28 + pct * 10;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 10;
      ctx.lineWidth   = 4 * (1 - pct);
      ctx.lineCap = 'round';
      ctx.save();
      ctx.rotate(this.angle);
      // Triple arc slashes
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 6, -20, len, -0.6, 0.6);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      for (const p of this.particles) {
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 20, p.size * (1 - pct * 0.5), 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// Bullet — projectile fired by companions and nightmares
// ─────────────────────────────────────────────────────────────
export class Bullet {
  constructor(x, y, dx, dy, speed, damage, ownerType, color, icon, ownerEntity = null) {
    this.x = x; this.y = y;
    this.dx = dx; this.dy = dy;
    this.speed = speed;
    this.damage = damage;
    this.ownerType = ownerType; // 'companion' | 'nightmare'
    this.color = color;
    this.icon = icon;
    this.ownerEntity = ownerEntity;
    this.life = 0;
    this.maxLife = 2.5;
    this.hit = false;
    this.trail = [];
    this._playSFX();
  }

  _playSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      if (this.ownerType === 'companion') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1050, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, ac.currentTime + 0.06);
        g.gain.setValueAtTime(0.035, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.2);
        g.gain.setValueAtTime(0.05, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.24);
      }
      osc.start(); osc.stop(ac.currentTime + 0.25);
    } catch(e) {}
  }

  update(dt) {
    if (this.hit) return;
    this.life += dt;
    if (this.life >= this.maxLife) { this.hit = true; return; }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();
    this.x += this.dx * this.speed * dt;
    this.y += this.dy * this.speed * dt;
  }

  draw(ctx, world) {
    if (this.hit) return;
    const iso = world.toIso(this.x, this.y);
    ctx.save();

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const tp = this.trail[i];
      const tIso = world.toIso(tp.x, tp.y);
      const frac = i / this.trail.length;
      ctx.globalAlpha = frac * 0.5;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(tIso.x, tIso.y - 24, frac * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    ctx.translate(iso.x, iso.y - 24);
    if (this.ownerType === 'companion') {
      // Spinning sparkle star
      const spin = this.life * 8;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI / 4) + spin;
        const r = i % 2 === 0 ? 9 : 3.5;
        const px2 = Math.cos(a) * r, py2 = Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      // Pulsing dark orb
      const pulse = 1 + Math.sin(this.life * 14) * 0.22;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 9 * pulse);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.35, this.color);
      grad.addColorStop(1, this.color + '00');
      ctx.fillStyle = grad;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(0, 0, 9 * pulse, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export class Player extends Entity {
  constructor(x, y, data) {
    super(x, y, data);
    this.stats = {
      hp: data.maxHp,
      maxHp: data.maxHp,
      hunger: 100,
      thirst: 100,
      happy: 30,
      level: 1,
      xp: 0
    };
    this.inventory = {}; // itemName -> quantity
    this.personality = data.personality || 'Curious'; // see PLAYER_TRAITS in data.js
    this.speed = 4;
    this.isAuto = true;
    this.autoTimer = 0;
    this.wanderTimer = 0;
    this.needEmoteTimer = 0;
    this.attackTimer = 0;
    this.targetEntity = null;
    this.isDead = false;
    
    // Procedural animation state
    this.animTime = 0;
    this.isWalking = false;
    this.facingLeft = false;
    this.emotion = 'neutral'; // 'happy', 'neutral', 'sad', 'scared'
    
    // Petting state
    this.isPetting = false;
    this.petTarget = null;
    this.petAnimTime = 0;
    this.petAnimDuration = 1.5; // seconds for petting animation

    // Eating cooked food (2s animation)
    this.isEating = false;
    this.eatingTime = 0;
    this.eatingDuration = 2;
    this.eatingFoodIcon = '';
    this.onEatComplete = null;

    // Ground item pickup (walk near → reach animation → collected in Game)
    this.pickupItemTarget = null;
    this.isPickingUp = false;
    this.pickupAnimTime = 0;
    this.pickupAnimDuration = 0.55;
    this.pickupItemIcon = '';
    this.pendingCollectedItem = null;
    this.hitFlashTimer = 0;
    this.isCleaningJunk = false;
    this._hasShield = false;
    // Idle-flee tracking: any manual control (tap, drag, button) calls
    // noteManualControl() and refreshes this stamp. After 10s of no manual
    // control, takeDamage() triggers a flee response away from the attacker.
    this.lastControlledAt = Date.now();
    this.fleeTimer = 0;          // > 0 while a flee path is being walked
  }

  // Called from main.js whenever the player issues a manual command —
  // resets the 10-second idle countdown.
  noteManualControl() {
    this.lastControlledAt = Date.now();
    this.fleeTimer = 0;
  }

  takeDamage(amount, attacker = null) {
    if (this._hasShield) {
      this._hasShield = false;
      this.showEmote('🛡️', 0.8);
      this._playShieldBreakSFX();
      if (this.onShieldBroken) this.onShieldBroken();
      return; // absorb the hit
    }
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.hitFlashTimer = 0.3;
    this.showEmote('💥', 0.8);
    this._playHitSFX();

    // Idle flee — if the player hasn't given a command for 10+ seconds,
    // the avatar runs away from whoever just hurt it. Manual control resumes
    // immediately if the player taps, since noteManualControl() resets this.
    const idleMs = Date.now() - (this.lastControlledAt || 0);
    if (idleMs >= 10000 && attacker && !this.isDead) {
      const dx = this.x - attacker.x;
      const dy = this.y - attacker.y;
      const d  = Math.hypot(dx, dy) || 1;
      const FLEE_DIST = 7;
      this.targetX = this.x + (dx / d) * FLEE_DIST;
      this.targetY = this.y + (dy / d) * FLEE_DIST;
      this.targetEntity = null;
      this.petTarget = null;
      this.pickupItemTarget = null;
      this.isPetting = false;
      this.isEating = false;
      this.fleeTimer = 1.5;
      this.showEmote('😱', 1.6);
    }

    if (this.onDamaged) this.onDamaged();
  }

  _playShieldBreakSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'triangle';
      o.frequency.setValueAtTime(1400, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.25);
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.28);
      o.start(); o.stop(ac.currentTime + 0.28);
    } catch(e) {}
  }

  _playHitSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(280, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.18);
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
      osc.start(); osc.stop(ac.currentTime + 0.22);
    } catch(e) {}
  }


  update(dt, input, currentRadius = 100, game = null) {
    if (this.isDead) return;

    // Eating animation — lock in place, no combat/pet/move
    if (this.isEating) {
      const timeScaled = game ? dt * game.time.multiplier : dt;
      this.eatingTime += timeScaled;
      this.targetX = this.x;
      this.targetY = this.y;
      this.petTarget = null;
      this.isPetting = false;
      this.targetEntity = null;
      this.pickupItemTarget = null;
      this.isPickingUp = false;
      if (this.eatingTime >= this.eatingDuration) {
        this.isEating = false;
        const done = this.onEatComplete;
        this.onEatComplete = null;
        this.eatingFoodIcon = '';
        this.eatingTime = 0;
        if (done) done();
      }
      super.update(dt);
      return;
    }

    // Item pickup animation (reach & grab) — lock in place
    if (this.isPickingUp) {
      const timeScaled = game ? dt * game.time.multiplier : dt;
      this.pickupAnimTime += timeScaled;
      this.targetX = this.x;
      this.targetY = this.y;
      if (this.pickupItemTarget) {
        if (this.pickupItemTarget.x < this.x) this.facingLeft = true;
        else if (this.pickupItemTarget.x > this.x) this.facingLeft = false;
      }
      if (this.pickupAnimTime >= this.pickupAnimDuration) {
        this.isPickingUp = false;
        this.pickupAnimTime = 0;
        this.pickupItemIcon = '';
        const itemRef = this.pickupItemTarget;
        this.pickupItemTarget = null;
        if (itemRef) this.pendingCollectedItem = itemRef;
      }
      super.update(dt);
      return;
    }

    // Get perk bonuses (with defaults)
    const perks = game?.perkBonuses || {};
    const food  = game?._foodBuffActive || {};
    let hungerDecay = perks.hungerDecay || 1;
    let thirstDecay = perks.thirstDecay || 1;
    let happinessDecay = perks.happinessDecay || 1;
    let hpRegen = perks.hpRegen || 0;
    let baseAttack = 2;
    const nightDamageBonus = perks.nightDamageBonus || 0;
    const nightAttackBonus = perks.nightAttackBonus || 0;
    const maxHpBonus = perks.maxHpBonus || 0;

    // Player personality trait effects (see PLAYER_TRAITS in data.js)
    if (this.personality === 'Stoic')      happinessDecay *= 0.5;            // Steady through any storm
    if (this.personality === 'Brave' && this.stats.hp < this.stats.maxHp * 0.30) baseAttack += 1; // Cornered fury

    // Happiness Candle (merchant rare): freeze passive happiness decay for its duration
    if (game?._happinessCandleTimer > 0) happinessDecay = 0;

    // Mood Lantern + Dream Chime passive props: multiply happiness decay
    if (game?._propDecayBonus && game._propDecayBonus < 1) happinessDecay *= game._propDecayBonus;

    // ── Recipe food buffs (compose into the running modifiers) ──
    if (food.foodHungerDecayMul) hungerDecay *= food.foodHungerDecayMul;
    if (food.foodHappyDecayMul)  happinessDecay *= food.foodHappyDecayMul;
    if (food.foodAllStatsMul) {
      // "All stats +10%" = decay −10% across the board, hp regen +10%
      hungerDecay *= 1 / food.foodAllStatsMul;
      thirstDecay *= 1 / food.foodAllStatsMul;
      happinessDecay *= 1 / food.foodAllStatsMul;
    }
    if (food.foodHpRegen)        hpRegen += food.foodHpRegen / 60;            // value in HP/min → HP/s baseline
    if (food.foodHappinessLock)  happinessDecay = 0;                          // Cloud Fleece Bun lock
    if (food.foodThirstImmune)   thirstDecay = 0;                              // Ice Crystal Ramen
    if (food.foodAttackBonus)    baseAttack += food.foodAttackBonus;          // alt name (compat)
    if (food.attackBonus)        baseAttack += food.attackBonus;

    // Decay logic with perk modifiers
    const timeScaled = game ? dt * game.time.multiplier : dt;
    
    this.stats.hunger = Math.max(0, this.stats.hunger - (timeScaled / 20) * hungerDecay);
    this.stats.thirst = Math.max(0, this.stats.thirst - (timeScaled / 30) * thirstDecay);
    // Prism Deer: happiness can never drop below the perk's minHappiness floor.
    const happyFloor = perks.minHappiness || 0;
    this.stats.happy = Math.max(happyFloor, this.stats.happy - (timeScaled / 120) * happinessDecay);

    // HP regeneration when fed (from perks)
    const effectiveMaxHp = this.stats.maxHp + maxHpBonus;
    if (hpRegen > 0 && this.stats.hunger > 50 && this.stats.thirst > 50) {
      this.stats.hp = Math.min(effectiveMaxHp, this.stats.hp + hpRegen * timeScaled);
    }

    if (this.stats.hunger <= 0) {
      this.stats.hp -= timeScaled / 30;
    }
    if (this.stats.thirst <= 0) {
      this.stats.hp -= (timeScaled * 2) / 30;
    }
    if (this.stats.happy < 10) {
      this.stats.hp -= timeScaled / 60;
    }

    if (this.stats.hp <= 0 && !this.isDead) {
      this.stats.hp = 0;
      this.isDead = true;
      this.showEmote('💀', 5.0);
      if (game && typeof game.gameOver === 'function') {
        game.gameOver();
      }
      return;
    }

    this.needEmoteTimer -= dt;
    if (this.needEmoteTimer <= 0) {
      if (this.stats.hunger < 15) { this.showEmote('🍗', 1.5); this.needEmoteTimer = 45; }
      else if (this.stats.thirst < 15) { this.showEmote('💧', 1.5); this.needEmoteTimer = 45; }
      else if (this.stats.happy < 25) { this.showEmote('💔', 1.5); this.needEmoteTimer = 60; }
      else { this.needEmoteTimer = 5; }
    }

    // Petting animation
    if (this.isPetting) {
      // Self-heal: if the target was cleared mid-animation (e.g. tap on junk
      // / child / merchant rerouted the player), drop the petting state right
      // away so the arm doesn't lock extended and walking can resume.
      if (!this.petTarget || this.petTarget.isDead) {
        this.isPetting    = false;
        this.petAnimTime  = 0;
        this.onPetStart   = null;
        this.onPetComplete = null;
      } else {
        this.petAnimTime += dt;
        // Face the companion
        if (this.petTarget.x < this.x) this.facingLeft = true;
        else this.facingLeft = false;
        // Complete petting after animation duration
        if (this.petAnimTime >= this.petAnimDuration) {
          this.isPetting = false;
          this.petAnimTime = 0;
          // Actual pet effect is triggered by game after animation
          if (this.onPetComplete) {
            this.onPetComplete(this.petTarget);
            this.onPetComplete = null;
          }
          this.petTarget = null;
        }
        // Don't move during petting
        super.update(dt);
        return;
      }
    }
    
    // Check if walking to pet target
    if (this.petTarget && !this.isPetting) {
      const distToPet = Math.hypot(this.petTarget.x - this.x, this.petTarget.y - this.y);
      if (distToPet < 0.18) {
        // Close enough, start petting animation
        this.isPetting = true;
        this.petAnimTime = 0;
        this.targetX = this.x;
        this.targetY = this.y;
        
        // Notify companion that petting has started
        if (this.onPetStart) {
          this.onPetStart(this.petTarget);
          this.onPetStart = null;
        }
      } else {
        // Keep walking towards pet target
        this.targetX = this.petTarget.x;
        this.targetY = this.petTarget.y;
      }
    }

    // (Auto-walk-to-item removed — items magnet to the player instead.
    //  See the magnet block in Game.update.)

    // Combat with companion perk bonuses
    if (this.targetEntity && !this.targetEntity.isDead) {
      const dToEnemy = Math.hypot(this.targetEntity.x - this.x, this.targetEntity.y - this.y);
      if (dToEnemy < 1.5) {
        this.attackTimer -= dt;
        const attackCooldown = 0.8;
        if (this.attackTimer <= 0) {
          let dmg = baseAttack;
          const isNight = game?.time?.phase === 'Night';
          if (isNight) {
            dmg += nightDamageBonus;
            dmg += nightAttackBonus;
          }
          this.targetEntity.takeDamage(Math.floor(dmg));
          this.attackTimer = attackCooldown;
          this._attackLungeTimer = 0.25; // trigger lunge animation
          this.showEmote('⚔️', 0.5);
          // Player attack VFX via game
          if (game && game.spawnAttackVFX) {
            const angle = Math.atan2(this.targetEntity.y - this.y, this.targetEntity.x - this.x);
            game.spawnAttackVFX(this.targetEntity.x, this.targetEntity.y, 'slash', '#ffffff', angle);
          }
        }
      } else {
        this.targetX = this.targetEntity.x;
        this.targetY = this.targetEntity.y;
      }
    } else {
      this.targetEntity = null;
    }

    // Pathing logic
    let moveSpeed = this.speed;
    if (this.stats.happy >= 80) moveSpeed *= 1.3;
    else if (this.stats.happy < 30) moveSpeed *= 0.6;
    if (this.stats.hunger <= 10 || this.stats.thirst <= 10) moveSpeed *= 0.5;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distToTarget = Math.hypot(dx, dy);
    
    // Check direction
    if (dx < -0.05) this.facingLeft = true;
    else if (dx > 0.05) this.facingLeft = false;

    if (distToTarget > 0.05) {
      this.x += (dx / distToTarget) * moveSpeed * dt;
      this.y += (dy / distToTarget) * moveSpeed * dt;
      this.animTime += dt * moveSpeed * 1.2;
      this.isWalking = true;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isWalking = false;
    }

    // Determine emotion from stats
    if (this.stats.hunger <= 10 || this.stats.thirst <= 10 || this.stats.hp <= 30) this.emotion = 'scared';
    else if (this.stats.happy < 40) this.emotion = 'sad';
    else if (this.stats.happy >= 80) this.emotion = 'happy';
    else this.emotion = 'neutral';

    if (this.isAuto && !this.pickupItemTarget && !this.petTarget && !this.targetEntity) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        // Smaller wander step — keeps player well within light
        this.targetX = this.x + (Math.random() * 2.5 - 1.25);
        this.targetY = this.y + (Math.random() * 2.5 - 1.25);
        this.wanderTimer = 2 + Math.random() * 4;
      }
    }

    // Clamp target to light radius with comfortable inset
    const safeRadius = Math.max(0, currentRadius - 1.2);
    const targetDist = Math.hypot(this.targetX, this.targetY);
    if (targetDist > safeRadius) {
      this.targetX = (this.targetX / targetDist) * safeRadius;
      this.targetY = (this.targetY / targetDist) * safeRadius;
    }

    // Clamp current position
    const dist = Math.hypot(this.x, this.y);
    if (dist > safeRadius) {
      this.x = (this.x / dist) * safeRadius;
      this.y = (this.y / dist) * safeRadius;
    }
    
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    super.update(dt);
  }

  collectItem(item) {
    if (!this.inventory[item.itemName]) {
      this.inventory[item.itemName] = 0;
    }
    this.inventory[item.itemName]++;
    this.showEmote('✨', 1.5);
  }

  renderSpecific(ctx) {
    ctx.save();
    // Character-only saturation drop when the player is sad. The world,
    // clouds, and UI stay vivid — only the character itself goes greyer.
    // Skipped in low-spec mode (canvas filters are GPU-expensive on mobile).
    const sat = window._happinessSaturation;
    if (!window._lowSpecMode && typeof sat === 'number' && sat < 1) {
      ctx.filter = `saturate(${Math.round(sat * 100)}%)`;
    }
    ctx.scale(1.5, 1.5);
    if (this.facingLeft) ctx.scale(-1, 1);

    const t = this.animTime;
    const walking = this.isWalking && !this.isPetting && !this.isEating && !this.isPickingUp && !this.isCleaningJunk;
    const bodyBob = walking ? Math.sin(t * 6) * 2.5 : Math.sin(t * 1.2) * 0.8;
    const legSwing = walking ? Math.sin(t * 6) * 6 : 0;
    let armSwing = walking ? Math.sin(t * 6) * 10 : Math.sin(t * 1.2) * 1.5;
    const breathe = Math.sin(Date.now() / 800) * 0.5; // gentle idle breathing
    
    // Petting animation overrides
    let petArmExtend = 0;
    let petArmRub = 0;
    if (this.isCleaningJunk) {
      armSwing = Math.sin(t * 18) * 14; // rapid scrubbing arms
    } else if (this.isEating) {
      armSwing = 0;
    } else if (this.isPickingUp) {
      const puProgress = this.pickupAnimTime / this.pickupAnimDuration;
      if (puProgress < 0.35) {
        petArmExtend = (puProgress / 0.35) * 18;
      } else {
        petArmExtend = 18;
        petArmRub = Math.sin((puProgress - 0.35) * 22) * 5;
      }
      armSwing = 0;
    } else if (this.isPetting) {
      const petProgress = this.petAnimTime / this.petAnimDuration;
      // Arm extends out then rubs back and forth
      if (petProgress < 0.2) {
        // Extend arm
        petArmExtend = (petProgress / 0.2) * 20;
      } else {
        // Rubbing motion
        petArmExtend = 20;
        petArmRub = Math.sin((petProgress - 0.2) * 25) * 8;
      }
      armSwing = 0; // No normal arm swing during petting
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Avatar colour palette (falls back to default purple if not set)
    const _ac = window._avatarColors || {};
    const _cBody = _ac.body || '#c4b5fd';
    const _cSkin = _ac.skin || '#f0eaff';
    const _cHair = _ac.hair || '#8b5cf6';
    const _cLeg  = _ac.leg  || '#8b7aad';
    const _cFoot = _ac.foot || '#7c6b99';

    // Stubby legs (very short and cute)
    ctx.lineCap = 'round';
    ctx.strokeStyle = _cLeg;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-4, -5 + bodyBob);
    ctx.lineTo(-4 - legSwing * 0.25, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -5 + bodyBob);
    ctx.lineTo(4 + legSwing * 0.25, 2);
    ctx.stroke();
    // Tiny round feet
    ctx.fillStyle = _cFoot;
    ctx.beginPath(); ctx.arc(-4 - legSwing * 0.25, 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4 + legSwing * 0.25, 3, 2.5, 0, Math.PI * 2); ctx.fill();

    // Body (rounder, softer shape - bean-like)
    const bodyY = -18 + bodyBob;
    ctx.fillStyle = _cBody;
    ctx.beginPath();
    ctx.ellipse(0, bodyY, 11 + breathe, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d2640';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // Belly highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-2, bodyY - 2, 5, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Stubby arms (very short)
    ctx.strokeStyle = _cBody;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    // Left arm (back arm, normal swing)
    ctx.beginPath();
    ctx.moveTo(-10, bodyY + 1);
    ctx.lineTo(-14, bodyY + 8 + armSwing * 0.2);
    ctx.stroke();
    
    // Right arm (front arm, extends for petting)
    const rightArmEndX = 14 + petArmExtend + petArmRub;
    const rightArmEndY = bodyY + 8 - armSwing * 0.2 - (this.isPetting ? 5 : 0) - (this.isPickingUp ? 4 : 0);
    ctx.beginPath();
    ctx.moveTo(10, bodyY + 1);
    ctx.lineTo(rightArmEndX, rightArmEndY);
    ctx.stroke();
    
    // Arm outlines
    ctx.strokeStyle = '#2d2640';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-10, bodyY + 1); ctx.lineTo(-14, bodyY + 8 + armSwing * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, bodyY + 1); ctx.lineTo(rightArmEndX, rightArmEndY); ctx.stroke();

    // Tiny round hands
    ctx.fillStyle = _cSkin;
    ctx.beginPath(); ctx.arc(-14, bodyY + 9 + armSwing * 0.2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rightArmEndX, rightArmEndY + 1, 2.5, 0, Math.PI * 2); ctx.fill();
    
    // Item icon at hand while reaching for pickup
    if (this.isPickingUp && this.pickupItemIcon) {
      const grabPhase = this.pickupAnimTime / this.pickupAnimDuration;
      ctx.save();
      const iconAlpha = grabPhase < 0.85 ? 1 : Math.max(0, 1 - (grabPhase - 0.85) / 0.15);
      ctx.globalAlpha = iconAlpha;
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.pickupItemIcon, rightArmEndX + 6, rightArmEndY - 4);
      ctx.restore();
    }

    // Heart particles during petting
    if (this.isPetting && this.petAnimTime > 0.3) {
      const heartPhase = (this.petAnimTime - 0.3) * 5;
      for (let i = 0; i < 3; i++) {
        const hx = rightArmEndX + 5 + Math.sin(heartPhase + i * 2) * 6;
        const hy = rightArmEndY - 10 - (heartPhase + i * 0.5) * 3;
        const alpha = Math.max(0, 1 - ((heartPhase + i * 0.3) % 2) * 0.5);
        ctx.globalAlpha = alpha;
        ctx.font = '8px Arial';
        ctx.fillStyle = '#ec4899';
        ctx.fillText('💕', hx, hy);
      }
      ctx.globalAlpha = 1;
    }


    // Head (big head = cute, 1.3x bigger than body)
    const headY = bodyY - 18;
    ctx.fillStyle = _cSkin;
    ctx.beginPath();
    ctx.arc(0, headY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d2640';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Ears (tiny round)
    ctx.fillStyle = _cSkin;
    ctx.beginPath(); ctx.arc(-12, headY - 7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, headY - 7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2d2640';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(-12, headY - 7, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(12, headY - 7, 4, 0, Math.PI * 2); ctx.stroke();
    // Inner ear pink
    ctx.fillStyle = 'rgba(236,72,153,0.2)';
    ctx.beginPath(); ctx.arc(-12, headY - 6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, headY - 6, 2, 0, Math.PI * 2); ctx.fill();

    // Hair tuft (fluffy)
    ctx.fillStyle = _cHair;
    ctx.beginPath();
    ctx.moveTo(-6, headY - 12);
    ctx.quadraticCurveTo(-2, headY - 22, 2, headY - 14);
    ctx.quadraticCurveTo(4, headY - 20, 8, headY - 12);
    ctx.quadraticCurveTo(3, headY - 13, -6, headY - 12);
    ctx.fill();

    // Permanent blush (always cute)
    ctx.fillStyle = 'rgba(236,72,153,0.18)';
    ctx.beginPath(); ctx.ellipse(-8, headY + 4, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, headY + 4, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Face based on emotion
    if (this.isEating) {
      this._drawFace(ctx, headY, 'eating');
    } else {
      this._drawFace(ctx, headY);
    }

    // Eating: food from body → mouth, then chew VFX (draw in front of face)
    if (this.isEating && this.eatingFoodIcon) {
      const eatT = this.eatingTime / this.eatingDuration;
      const liftT = Math.min(1, this.eatingTime / 0.45);
      const ease = 1 - Math.pow(1 - liftT, 3);
      const startX = -5;
      const startY = bodyY + 8;
      const endX = 11;
      const endY = headY - 2;
      const fx = startX + (endX - startX) * ease;
      const fy = startY + (endY - startY) * ease;
      const chew = eatT > 0.4 ? Math.sin(this.eatingTime * 14) * 0.08 : 0;
      const fade = eatT > 0.82 ? 1 - (eatT - 0.82) / 0.18 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      const bounce = eatT > 0.4 ? Math.sin(this.eatingTime * 12) * 2 : 0;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(fx + bounce, fy + chew);
      ctx.rotate(chew * 0.5);
      ctx.fillText(this.eatingFoodIcon, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;

      // VFX: sparkles / crumbs while chewing
      if (eatT > 0.35 && eatT < 0.92) {
        const crumbs = 5;
        for (let i = 0; i < crumbs; i++) {
          const a = (this.eatingTime * 3 + i * 1.2) % (Math.PI * 2);
          const r = 12 + Math.sin(this.eatingTime * 8 + i) * 6;
          ctx.globalAlpha = 0.35 + Math.sin(this.eatingTime * 10 + i) * 0.2;
          ctx.font = `${6 + (i % 3)}px Arial`;
          ctx.fillStyle = i % 2 === 0 ? '#fcd34d' : '#fff';
          ctx.fillText(['✨', '·', '♪'][i % 3], endX + Math.cos(a) * r * 0.4, headY - 4 + Math.sin(a) * r * 0.35);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Hit flash
    if (this.hitFlashTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.hitFlashTimer * 5) * 0.65;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.ellipse(0, -25, 18, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _drawFace(ctx, headY, forceEmotion = null) {
    const em = forceEmotion || this.emotion;
    if (em === 'eating') {
      // Chewing / enjoying food
      ctx.strokeStyle = '#2d2640';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-5, headY - 1, 3, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, headY - 1, 3, Math.PI, 0); ctx.stroke();
      const chew = Math.sin(Date.now() / 80) * 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, headY + 5 + chew, 4 + chew * 0.3, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(236,72,153,0.25)';
      ctx.beginPath(); ctx.ellipse(-8, headY + 4, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, headY + 4, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (em === 'happy') {
      // Big happy closed eyes (upside-down U)
      ctx.strokeStyle = '#2d2640';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-5, headY - 1, 3, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, headY - 1, 3, Math.PI, 0); ctx.stroke();
      // Big cat smile
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, headY + 4);
      ctx.quadraticCurveTo(-2, headY + 8, 0, headY + 5);
      ctx.quadraticCurveTo(2, headY + 8, 5, headY + 4);
      ctx.stroke();
      // Extra blush intensity
      ctx.fillStyle = 'rgba(236,72,153,0.2)';
      ctx.beginPath(); ctx.ellipse(-8, headY + 4, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, headY + 4, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    } else if (em === 'sad') {
      // Big watery eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-5, headY - 1, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, headY - 1, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a3060';
      ctx.beginPath(); ctx.arc(-5, headY, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, headY, 2.2, 0, Math.PI * 2); ctx.fill();
      // Shine in eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-4, headY - 1, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, headY - 1, 0.8, 0, Math.PI * 2); ctx.fill();
      // Watery glint at bottom
      ctx.fillStyle = 'rgba(96,165,250,0.35)';
      ctx.beginPath(); ctx.ellipse(-5, headY + 2.5, 3.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, headY + 2.5, 3.5, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      // Sad eyebrows (inner up)
      ctx.strokeStyle = '#2d2640';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-8, headY - 5); ctx.lineTo(-3, headY - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, headY - 5); ctx.lineTo(3, headY - 4); ctx.stroke();
      // Small wobbly frown
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-3, headY + 6);
      ctx.quadraticCurveTo(0, headY + 4, 3, headY + 6);
      ctx.stroke();
      // Tear rolling down
      const tearY = (Date.now() / 400) % 8;
      ctx.fillStyle = 'rgba(96,165,250,0.5)';
      ctx.beginPath(); ctx.ellipse(8, headY + 3 + tearY, 1.2, 2, 0.15, 0, Math.PI * 2); ctx.fill();

    } else if (em === 'scared') {
      // Huge round eyes (saucer eyes)
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5, headY - 1, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, headY - 1, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2d2640';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(-5, headY - 1, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, headY - 1, 5, 0, Math.PI * 2); ctx.stroke();
      // Tiny shaking pupils
      const shake = Math.sin(Date.now() / 60) * 0.5;
      ctx.fillStyle = '#2d2640';
      ctx.beginPath(); ctx.arc(-5 + shake, headY - 1, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5 + shake, headY - 1, 2, 0, Math.PI * 2); ctx.fill();
      // Eye shine
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-4, headY - 2.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, headY - 2.5, 1.2, 0, Math.PI * 2); ctx.fill();
      // Small open mouth
      ctx.fillStyle = '#4a3060';
      ctx.beginPath(); ctx.ellipse(0, headY + 5, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
      // Sweat drop
      ctx.fillStyle = 'rgba(96,165,250,0.45)';
      ctx.beginPath();
      ctx.moveTo(-13, headY - 5);
      ctx.quadraticCurveTo(-14, headY - 1, -12, headY + 1);
      ctx.quadraticCurveTo(-11, headY - 2, -13, headY - 5);
      ctx.fill();

    } else {
      // Neutral — big cute dot eyes with shine
      ctx.fillStyle = '#2d2640';
      ctx.beginPath(); ctx.arc(-5, headY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, headY, 3, 0, Math.PI * 2); ctx.fill();
      // Eye shine
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-4, headY - 1, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, headY - 1, 1.2, 0, Math.PI * 2); ctx.fill();
      // Small gentle mouth
      ctx.strokeStyle = '#2d2640';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-2, headY + 5);
      ctx.quadraticCurveTo(0, headY + 6.5, 2, headY + 5);
      ctx.stroke();
    }
  }
}

export class Companion extends Entity {
  constructor(x, y, compData) {
    super(x, y, compData);
    this.color    = compData.color;
    this.icon     = compData.icon;
    // artImg may not be passed directly — many construction sites strip the data
    // object down to id/name/color/etc. Fall back to the master registry lookup.
    this.artImg   = compData.artImg || (compData.id ? (getCompanionById(compData.id)?.artImg || null) : null);
    this.dropName = compData.drop;
    this.type     = compData.type || compData.id;
    this.personality = compData.personality || 'Playful';

    // Drop timer — halved (10-20s initial, 150s reset)
    this.dropTimer = 10 + Math.random() * 10;

    // Pet state
    this.petCooldown   = 0;
    this.beingPetted   = false;
    this.petWiggleTime = 0;
    this.needsPetting  = false;   // true after ~90s without a pet
    this._petNeededTimer = Math.random() * 60; // stagger initial timers

    // ── Combat ──────────────────────────────────────────
    this.role        = compData.role || 'attacker';
    this.attackType  = 'ranged';
    this.attackRange = 3.2;
    this.attackDmg   = compData.tier ? compData.tier : 1;
    this.attackTimer = 1 + Math.random();
    this.attackCooldown = 2.0;
    this.aggroTarget = null;
    this.aggroRange  = 5.0;

    // ── HP / KO / Revive ───────────────────────────────
    const tierHp = [0, 30, 45, 65, 90, 120, 160];
    this.maxHp   = tierHp[compData.tier || 1];
    this.hp      = this.maxHp;

    // ── Role-based stat tuning ─────────────────────────
    if (this.role === 'defender') {
      this.attackDmg      = Math.max(1, Math.floor(this.attackDmg * 0.6));
      this.maxHp          = Math.round(this.maxHp * 1.3);
      this.hp             = this.maxHp;
      this.attackCooldown = 2.5;
      this._shieldCooldown = 0;   // ready immediately
    } else if (this.role === 'caster') {
      this.attackRange    = 4.5;
      this.attackCooldown = 3.5;
      this.aggroRange     = 6.0;
    } else if (this.role === 'stunner') {
      this.attackRange    = 1.5;
      this.attackCooldown = 2.2;
      this.attackDmg      = Math.ceil(this.attackDmg * 1.8);
    }
    this.isKO    = false;       // unconscious
    this.reviveTimer = 0;       // countdown to revive (60s)
    this.hpRegenRate = 2;       // HP per second when healthy

    // ── Behaviour state machine ─────────────────────────
    // 'follow'|'aggro'|'idle_wander'|'sit_fire'|'ko'|'think'|'goto_dest'|'flee'
    this.bhvState   = 'follow';
    this.bhvTimer   = 0;
    this.wanderTX   = x; this.wanderTY = y;
    this.wanderTimer = 0;

    // For sitting animation
    this.isSitting  = false;
    this.sitTimer   = 0;

    this.targetX = x;
    this.targetY = y;

    this.hitFlashTimer = 0;
    this.victoryJumpTimer = 0;
    this.detectTimer = 0;
    this._wasAggro = false;
    this.tapBobble = 0;
    this.facingLeft = false;       // mirror sprite when moving leftward
    this._prevX = 0;               // snapshot for facing-direction derivation

    // Junk cleaning. Most call sites construct a Companion from a hand-picked
    // subset of fields and don't forward `junkCleaner`, so fall back to looking
    // it up by id (same pattern as `artImg` above).
    this.junkCleaner = !!(compData.junkCleaner
      ?? (compData.id ? getCompanionById(compData.id)?.junkCleaner : false));
    this.junkTarget = null;
    this.junkCleanProgress = 0;
    this.isCleaningJunk = false;

    // ── Destination / Think system ───────────────────────
    // Favorite structures per personality (2-3 preferred IDs)
    const _FAVE = {
      'Playful':    ['flower_pot','fountain','sunflower','garden_swing','fairy_ring'],
      'Shy':        ['mossy_rock','bamboo_grove','fern_patch','bonsai','stepping_stones'],
      'Brave':      ['moon_shrine','wood_fence','mossy_rock','stone_arch','stone_pillar'],
      'Grumpy':     ['log_bench','clay_vase','mossy_rock','barrel','crate_stack'],
      'Maternal':   ['flower_pot','hibiscus','planter','bird_bath','wildflower_bed'],
      'Clingy':     ['paper_lantern','candle_post','flower_pot','wind_chime','dream_orb'],
      'Gluttonous': ['giant_mush','cactus','fountain','beehive','lotus_pond'],
      'Solitary':   ['bamboo_grove','pine_tree','mossy_rock','stone_pillar','sundial'],
      'Stoic':      ['moon_shrine','log_bench','clay_vase','sundial','stone_arch'],
      'Empathetic': ['hibiscus','cherry_bloom','oak_tree','tulip_patch','lavender_bush'],
    };
    this.favoriteStructures = _FAVE[this.personality] || ['oak_tree','flower_pot'];

    this._destTarget        = null;  // { x, y, type, id? }
    this._thinkTimer        = 0;
    this._idleDecisionTimer = 4 + Math.random() * 8; // stagger first decision
    this._visitedStructures = new Set();

    // ── Flee system ──────────────────────────────────────
    this._fleeFrom  = null;   // Nightmare to flee from
    this._fleeTimer = 0;
  }

  // ── Damage ──────────────────────────────────────────────────
  takeDamage(amount) {
    if (this.isKO) return;
    this.hp -= amount;
    this.hitFlashTimer = 0.3;
    this.showEmote('💢', 0.4);
    this._playHitSFX();
    if (this.hp <= 0) {
      this.hp = 0;
      this.isKO = true;
      // Companion Den prop: respawn 30s faster (default 60s → 30s when built)
      const game = this._game || window.gameInstance;
      const denBonus = (game && game.builtProps && game.builtProps.companion_den) ? 30 : 0;
      this.reviveTimer = Math.max(15, 60 - denBonus);
      this.bhvState = 'ko';
      this.isSitting = false;
      this.aggroTarget = null;
      this.showEmote('💤', 3.0);
    }
  }

  _playHitSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.15);
      g.gain.setValueAtTime(0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
      osc.start(); osc.stop(ac.currentTime + 0.18);
    } catch(e) {}
  }

  _playDetectSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [[700,0],[900,0.05],[1100,0.1]].forEach(([freq, delay]) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
        g.gain.setValueAtTime(0.055, ac.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.14);
        osc.start(ac.currentTime + delay);
        osc.stop(ac.currentTime + delay + 0.14);
      });
    } catch(e) {}
  }

  // ── Role-based attacks ────────────────────────────────────────
  _performRoleAttack(nm, game) {
    if (!game) return;
    const d = Math.hypot(nm.x - this.x, nm.y - this.y) || 1;
    if (this.role === 'stunner') {
      nm.takeDamage(this.attackDmg, this);
      const angle = Math.atan2(nm.y - this.y, nm.x - this.x);
      if (game.spawnAttackVFX) game.spawnAttackVFX(nm.x, nm.y, 'slash', '#f59e0b', angle);
      if (Math.random() < 0.5) {
        nm.stunTimer = 3.0;
        this.showEmote('💫', 1.2);
        this._playStunSFX();
      } else {
        this.showEmote('⚔️', 0.5);
        this._playMeleeSFX();
      }
    } else if (this.role === 'caster') {
      this._fireCastChain(nm, game);
    } else {
      // attacker + defender: ranged bullet
      if (game.spawnBullet) {
        game.spawnBullet(this.x, this.y, (nm.x - this.x) / d, (nm.y - this.y) / d,
                         'companion', this.color, this.icon, this.attackDmg, this);
      }
    }
    nm.state = 'chase';
    nm._aggroedTarget = this;
  }

  _fireCastChain(primary, game) {
    const allNm = game.nightmares || [];
    const chain  = [primary];
    let last     = primary;
    for (let i = 0; i < 2; i++) {
      let next = null, nextDist = 3.5;
      for (const nm of allNm) {
        if (nm.isDead || chain.includes(nm)) continue;
        const d = Math.hypot(nm.x - last.x, nm.y - last.y);
        if (d < nextDist) { next = nm; nextDist = d; }
      }
      if (!next) break;
      chain.push(next); last = next;
    }
    const positions = [{ x: this.x, y: this.y }, ...chain.map(n => ({ x: n.x, y: n.y }))];
    chain.forEach((nm, i) => {
      nm.takeDamage(Math.max(1, Math.floor(this.attackDmg * Math.pow(0.7, i))), this);
      nm.state = 'chase';
    });
    if (game.spawnChainLightningVFX) game.spawnChainLightningVFX(positions);
    this._playCastSFX();
    this.showEmote('⚡', 1.2);
  }

  _playMeleeSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(280, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(90, ac.currentTime + 0.12);
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
      o.start(); o.stop(ac.currentTime + 0.14);
    } catch(e) {}
  }

  _playStunSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [600, 900, 1200].forEach((freq, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, ac.currentTime + i * 0.06);
        o.frequency.exponentialRampToValueAtTime(freq * 1.3, ac.currentTime + i * 0.06 + 0.08);
        g.gain.setValueAtTime(0.05, ac.currentTime + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.06 + 0.12);
        o.start(ac.currentTime + i * 0.06);
        o.stop(ac.currentTime + i * 0.06 + 0.12);
      });
    } catch(e) {}
  }

  _playCastSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      // Rising electric crackle
      const o1 = ac.createOscillator(), o2 = ac.createOscillator();
      const g  = ac.createGain();
      o1.connect(g); o2.connect(g); g.connect(ac.destination);
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(400, ac.currentTime);
      o1.frequency.exponentialRampToValueAtTime(1800, ac.currentTime + 0.18);
      o2.type = 'square';
      o2.frequency.setValueAtTime(200, ac.currentTime);
      o2.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.18);
      g.gain.setValueAtTime(0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
      o1.start(); o1.stop(ac.currentTime + 0.22);
      o2.start(); o2.stop(ac.currentTime + 0.22);
    } catch(e) {}
  }

  _playShieldSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [800, 1000, 1200, 1500].forEach((freq, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ac.currentTime + i * 0.04);
        g.gain.setValueAtTime(0.04, ac.currentTime + i * 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.04 + 0.18);
        o.start(ac.currentTime + i * 0.04);
        o.stop(ac.currentTime + i * 0.04 + 0.18);
      });
    } catch(e) {}
  }

  pet() {
    if (this.petCooldown > 0) return false;
    this.dropTimer = Math.max(0, this.dropTimer - 20);
    this.petCooldown = 60;
    this.showEmote('💕', 2.0);
    this.beingPetted = false;
    // Player interaction clears flee/think/dest
    if (this.bhvState === 'flee' || this.bhvState === 'think') {
      this.bhvState = 'follow';
      this._fleeFrom = null; this._fleeTimer = 0;
      this._destTarget = null;
    }
    // Clear needs-petting state
    this.needsPetting = false;
    this._petNeededTimer = 0;
    return true;
  }

  startBeingPetted() {
    this.beingPetted = true;
    this.petWiggleTime = 0;
  }

  // ── Pick nearest nightmare within aggro range ───────────────
  _findNearestNightmare(nightmares) {
    let best = null, bestDist = this.aggroRange;
    for (const n of nightmares) {
      if (n.isDead) continue;
      const d = Math.hypot(n.x - this.x, n.y - this.y);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }

  // ── Called when player takes damage — non-combat compies flee ──
  _onPlayerAttacked(nearestEnemy) {
    if (this.isKO || this.beingPetted) return;
    const goesAggro = !['Shy','Maternal','Stoic'].includes(this.personality);
    if (goesAggro) return; // combat compies handle via aggro
    if (this.bhvState === 'flee') return;
    this.bhvState = 'flee';
    this._fleeFrom = nearestEnemy;
    this._fleeTimer = 4 + Math.random() * 3;
    this._destTarget = null;
    this.showEmote('😱', 2.5);
  }

  // ── Pick next destination after thinking ─────────────────────
  _pickDestination(game, player, campfire) {
    const placed   = game?.editMode?.placedCosmetics || [];
    const newStruct = game?._newlyPlacedStructure;

    // Curiosity: unvisited new structure gets top priority
    if (newStruct) {
      const key = `${newStruct.x.toFixed(1)},${newStruct.y.toFixed(1)}`;
      if (!this._visitedStructures.has(key) && Math.random() < 0.80) {
        this.bhvState   = 'goto_dest';
        this._destTarget = { x: newStruct.x, y: newStruct.y, type: 'curiosity', id: newStruct.id };
        this.showEmote('👀', 2.0);
        return;
      }
    }

    // Build weighted option list. We want active behaviour (not just following) —
    // weight the player option low so Compys actually explore when destinations exist.
    const opts = [];
    const favPlaced = placed.filter(c => this.favoriteStructures.includes(c.id));
    if (favPlaced.length > 0) {
      const pick = favPlaced[Math.floor(Math.random() * favPlaced.length)];
      opts.push({ w: 50, type: 'fav_struct', x: pick.x, y: pick.y, id: pick.id });
    }
    if (placed.length > 0) {
      const pick = placed[Math.floor(Math.random() * placed.length)];
      opts.push({ w: 25, type: 'struct', x: pick.x, y: pick.y, id: pick.id });
    }
    if (campfire) opts.push({ w: 30, type: 'campfire', x: 0, y: 0 });
    // Local free-wander: picks a random nearby spot to roam (prevents early-game follow lock)
    opts.push({ w: 20, type: 'wander', x: this.x + (Math.random() - 0.5) * 6, y: this.y + (Math.random() - 0.5) * 6 });
    opts.push({ w: 5,  type: 'player', x: player.x, y: player.y });

    if (opts.length === 0) { this.bhvState = 'follow'; return; }

    let roll = Math.random() * opts.reduce((s, o) => s + o.w, 0);
    for (const opt of opts) {
      roll -= opt.w;
      if (roll <= 0) {
        if (opt.type === 'player') { this.bhvState = 'follow'; return; }
        if (opt.type === 'campfire') { this.bhvState = 'sit_fire'; return; }
        if (opt.type === 'wander') {
          this.bhvState    = 'idle_wander';
          this.bhvTimer    = 6 + Math.random() * 8;
          this.wanderTX    = opt.x;
          this.wanderTY    = opt.y;
          this.wanderTimer = 2 + Math.random() * 3;
          this.showEmote(['🌿','💨','🐾'][Math.floor(Math.random() * 3)], 1.2);
          return;
        }
        this.bhvState   = 'goto_dest';
        this._destTarget = { x: opt.x, y: opt.y, type: opt.type, id: opt.id };
        this.showEmote(['🏃','✨','💨'][Math.floor(Math.random() * 3)], 1.2);
        return;
      }
    }
    this.bhvState = 'follow';
  }

  // ── Reaction on arriving at destination ──────────────────────
  _onArriveAtDest(dest, game) {
    if (dest.x !== undefined) {
      const key = `${dest.x.toFixed(1)},${dest.y.toFixed(1)}`;
      this._visitedStructures.add(key);
      // Clear curiosity flag if this was the new structure
      if (game?._newlyPlacedStructure) {
        const ns = game._newlyPlacedStructure;
        if (Math.abs(ns.x - dest.x) < 0.5 && Math.abs(ns.y - dest.y) < 0.5) {
          game._newlyPlacedStructure = null;
        }
      }
    }
    const reacts = {
      'Playful': ['😄','✨','🎵'], 'Shy': ['👀','😳'], 'Brave': ['💪','😤'],
      'Grumpy': ['😒','💢'], 'Maternal': ['🌸','💞'], 'Clingy': ['💕','🥺'],
      'Gluttonous': ['😋','🍖'], 'Solitary': ['💭','😑'], 'Stoic': ['😶','👁️'],
      'Empathetic': ['💞','✨'],
    };
    const pool = reacts[this.personality] || ['💭'];
    this.showEmote(pool[Math.floor(Math.random() * pool.length)], 2.0);
  }

  // ── Behaviour tree ──────────────────────────────────────────
  _updateBehaviour(dt, player, nightmares, campfire, game) {
    // KO state handled separately
    if (this.isKO) return;

    const distToPlayer   = Math.hypot(player.x - this.x, player.y - this.y);
    const distToCampfire = campfire ? Math.hypot(this.x, this.y) : 999;
    const PERSONALITY    = this.personality;
    const goesAggro      = !['Shy','Maternal','Stoic'].includes(PERSONALITY);
    const likesFire      = ['Playful','Solitary','Stoic','Gluttonous','Grumpy'].includes(PERSONALITY);
    const clingy         = PERSONALITY === 'Clingy';

    // ── 1. COMBAT — always highest priority ──────────────
    if (goesAggro || (nightmares.length > 0 && distToPlayer < 2)) {
      const nm = this._findNearestNightmare(nightmares);
      if (nm) {
        this.aggroTarget = nm;
        this.bhvState    = 'aggro';
        this._destTarget = null;
        this._fleeTimer  = 0;
        this.isSitting   = false;
        return;
      }
    }
    this.aggroTarget = null;

    // ── 2. FLEE — non-combat compy shocked by nearby enemy ──
    if (this.bhvState === 'flee') {
      this._fleeTimer -= dt;
      if (this._fleeTimer <= 0 || distToPlayer > 7) {
        this.bhvState  = 'follow';
        this._fleeFrom = null;
      }
      return;
    }

    // ── 3. THINK — deliberating next destination ─────────
    if (this.bhvState === 'think') {
      this._thinkTimer -= dt;
      if (this._thinkTimer <= 0) {
        this._pickDestination(game, player, campfire);
      }
      return;
    }

    // ── 4. GOTO DESTINATION ───────────────────────────────
    if (this.bhvState === 'goto_dest' && this._destTarget) {
      const dest = this._destTarget;
      // Validate structure still placed
      if (dest.type === 'fav_struct' || dest.type === 'struct' || dest.type === 'curiosity') {
        const placed = game?.editMode?.placedCosmetics || [];
        if (!placed.some(c => Math.abs(c.x - dest.x) < 0.5 && Math.abs(c.y - dest.y) < 0.5)) {
          this.bhvState = 'follow';
          this._destTarget = null;
          return;
        }
      }
      const dist = Math.hypot(dest.x - this.x, dest.y - this.y);
      if (dist < 0.9) {
        this._onArriveAtDest(dest, game);
        // Linger with a wander near the destination
        this.bhvState   = 'idle_wander';
        this.bhvTimer   = 8 + Math.random() * 10;
        this.wanderTimer = 0;
        this._destTarget = null;
        return;
      }
      this.targetX = dest.x;
      this.targetY = dest.y;
      return;
    }

    // ── 5. SIT NEAR CAMPFIRE ──────────────────────────────
    // Campfire is a homebase — Compys should be able to camp there regardless of player distance.
    // Clingy still follows; others sit if they're close to the fire.
    if (likesFire && distToCampfire < 2.5 && !clingy) {
      if (this.bhvState !== 'sit_fire') {
        this.bhvState = 'sit_fire';
        this.sitTimer = 6 + Math.random() * 14;
        this.isSitting = true;
        if (Math.random() < 0.5) this.showEmote(['💤','😊','💭','🔥'][Math.floor(Math.random()*4)], 3);
      } else {
        this.sitTimer -= dt;
        if (this.sitTimer <= 0) { this.bhvState = 'follow'; this.isSitting = false; }
      }
      return;
    } else if (this.bhvState === 'sit_fire') {
      this.bhvState = 'follow'; this.isSitting = false;
    }

    // ── 6. IDLE WANDER (brief wander after arriving at dest) ─
    if (this.bhvState === 'idle_wander') {
      this.bhvTimer   -= dt;
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        const d = 0.3 + Math.random() * 0.8;
        this.wanderTX   = this.x + Math.cos(a) * d;
        this.wanderTY   = this.y + Math.sin(a) * d;
        this.wanderTimer = 1.5 + Math.random() * 2.5;
        if (Math.random() < 0.25) {
          const emoteMap = {
            'Playful':['😄','🎵','✨'],'Shy':['👀','😳','🌸'],'Brave':['💪','⚔️','😤'],
            'Grumpy':['😤','💢','😒'],'Maternal':['🌸','💞','🤗'],'Clingy':['👋','🥺','💕'],
            'Gluttonous':['🍗','😋','🍯'],'Solitary':['🌙','💭','😑'],
            'Stoic':['😶','💭','👁️'],'Empathetic':['💞','🌈','✨'],
          };
          const pool = emoteMap[PERSONALITY] || ['💭'];
          this.showEmote(pool[Math.floor(Math.random()*pool.length)], 2);
        }
      }
      if (this.bhvTimer <= 0) { this.bhvState = 'follow'; this.wanderTimer = 0; }
      this.targetX = this.wanderTX;
      this.targetY = this.wanderTY;
      return;
    }

    // ── 7. IDLE DECISION TIMER — trigger think state ──────
    // Allow the timer to tick regardless of player proximity so Compys don't get stuck
    // in pure follow mode while chasing a moving player.
    if (!clingy) {
      this._idleDecisionTimer -= dt;
      if (this._idleDecisionTimer <= 0) {
        this._idleDecisionTimer = 6 + Math.random() * 10;
        const placed = game?.editMode?.placedCosmetics || [];
        const hasDest = placed.length > 0 || campfire || game?._newlyPlacedStructure;
        if (hasDest) {
          this.bhvState    = 'think';
          this._thinkTimer = 1.5 + Math.random() * 2.0;
          this.showEmote('💭', this._thinkTimer + 0.8);
          return;
        } else {
          // No structures yet — just wander locally instead of following
          this.bhvState   = 'idle_wander';
          this.bhvTimer   = 6 + Math.random() * 8;
          this.wanderTimer = 0;
          return;
        }
      }
    }

    // ── 8. DEFAULT: follow player ─────────────────────────
    this.bhvState  = 'follow';
    this.isSitting = false;
  }

  update(dt, player, currentRadius = 100, game = null) {
    // Snapshot for facing-direction derivation at end of tick.
    this._prevX = this.x;
    // Get perk bonuses
    const perks = game?.perkBonuses || {};
    // dropSpeedMult is a SPEED multiplier (>1 = faster drops, used by legacy perks).
    // companionProduceSpeed is a TIME multiplier (<1 = faster drops, used by Aurora Butterfly).
    // Compose them: effective tick = dt * speed / produceTime. Defaults are 1 for both.
    const dropSpeedMult    = perks.dropSpeed              || 1;
    const produceTimeMult  = perks.companionProduceSpeed  || 1;
    const effectiveDropTickMult = dropSpeedMult / produceTimeMult;
    const doubleDropChance = perks.doubleDropChance || 0;
    
    // ── KO / Revive ──────────────────────────────────────
    if (this.isKO) {
      this.reviveTimer -= dt;
      if (this.reviveTimer <= 0) {
        this.isKO  = false;
        this.hp    = Math.ceil(this.maxHp * 0.5);
        this.bhvState = 'follow';
        this.showEmote('💖', 2.5);
      }
      super.update(dt);
      return;
    }

    // ── Passive HP regen ─────────────────────────────────
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegenRate * dt * 0.2);
    }
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.victoryJumpTimer > 0) this.victoryJumpTimer -= dt;
    if (this.detectTimer > 0) this.detectTimer -= dt;
    if (this.tapBobble > 0) this.tapBobble -= dt;

    // ── Pet cooldown ─────────────────────────────────────
    if (this.petCooldown > 0) this.petCooldown -= dt;
    if (this.beingPetted)      this.petWiggleTime += dt;

    // ── Needs-petting accumulator ─────────────────────────
    // Count up when cooldown is 0 (companion is ready to be petted again)
    if (this.petCooldown <= 0 && !this.isKO && !this.beingPetted) {
      this._petNeededTimer += dt;
      if (this._petNeededTimer >= 90) this.needsPetting = true;
    } else {
      // Reset accumulator while on cooldown or KO'd
      if (this.petCooldown > 0 || this.isKO) this._petNeededTimer = 0;
    }

    // ── Drop logic ───────────────────────────────────────
    this.dropTimer -= dt * effectiveDropTickMult;
    if (this.dropTimer <= 0) {
      this.dropTimer = 150; // halved from 300
      this.showEmote('✨', 3.0);
      if (game && typeof game.spawnItem === 'function') {
        game.spawnItem(this.x, this.y, this.dropName);
        if (Math.random() < doubleDropChance) {
          game.spawnItem(this.x + 0.5, this.y + 0.5, this.dropName);
          this.showEmote('🍀', 2.0);
        }
      }
    }

    // ── Behaviour tree ───────────────────────────────────
    const nightmares = game?.nightmares || [];
    const campfire   = game?.campfire   || null;
    this._updateBehaviour(dt, player, nightmares, campfire, game);

    // ── Detect trigger: when first entering aggro ────────────────
    const nowAggro = this.bhvState === 'aggro';
    if (nowAggro && !this._wasAggro) {
      this.detectTimer = 0.75;
      this._playDetectSFX();
    }
    this._wasAggro = nowAggro;

    // Pause movement briefly during detect animation
    if (this.detectTimer > 0 && this.bhvState === 'aggro') {
      this.targetX = this.x;
      this.targetY = this.y;
      super.update(dt);
      return;
    }

    // ── Defender: cast shield on player when nightmares are present ──
    if (this.role === 'defender' && !this.isKO && game) {
      this._shieldCooldown = (this._shieldCooldown || 0) - dt;
      const hasNm = (game.nightmares || []).some(n => !n.isDead);
      if (this._shieldCooldown <= 0 && hasNm && game.player && !game.player._hasShield) {
        game.player._hasShield = true;
        this._shieldCooldown = 5.0;
        this._playShieldSFX();
        if (game.spawnShieldVFX) game.spawnShieldVFX();
        this.showEmote('🛡️', 1.5);
      }
    }

    // ── Combat: role-based attack against aggroed nightmare ──────
    if (this.bhvState === 'aggro' && this.aggroTarget && !this.aggroTarget.isDead) {
      const nm = this.aggroTarget;
      const distToNm = Math.hypot(nm.x - this.x, nm.y - this.y);

      // Defender: intercept — position between player and nightmare
      let moveX = nm.x, moveY = nm.y, moveDist = distToNm;
      if (this.role === 'defender' && game?.player) {
        moveX = (nm.x + game.player.x) / 2;
        moveY = (nm.y + game.player.y) / 2;
        moveDist = Math.hypot(moveX - this.x, moveY - this.y);
      }

      if (moveDist > this.attackRange) {
        const dx = (moveX - this.x) / (moveDist || 1);
        const dy = (moveY - this.y) / (moveDist || 1);
        this.x += dx * this.speed * dt;
        this.y += dy * this.speed * dt;
      } else {
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          this._performRoleAttack(nm, game);
        }
      }
      this.targetX = this.x;
      this.targetY = this.y;
    } else if (this.bhvState === 'sit_fire' || this.bhvState === 'think') {
      // Stay put
      this.targetX = this.x;
      this.targetY = this.y;
    } else if (this.bhvState === 'flee' && this._fleeFrom) {
      // Run away from enemy at boosted speed
      const ex = this._fleeFrom.x, ey = this._fleeFrom.y;
      const fa = Math.atan2(this.y - ey, this.x - ex);
      this.x += Math.cos(fa) * this.speed * 1.25 * dt;
      this.y += Math.sin(fa) * this.speed * 1.25 * dt;
      this.targetX = this.x; this.targetY = this.y;
    } else if (this.bhvState === 'goto_dest' && this._destTarget) {
      // Walk toward destination
      const dx = this._destTarget.x - this.x;
      const dy = this._destTarget.y - this.y;
      const d  = Math.hypot(dx, dy);
      if (d > 0.05) {
        this.x += (dx / d) * this.speed * 0.9 * dt;
        this.y += (dy / d) * this.speed * 0.9 * dt;
      }
      this.targetX = this.x; this.targetY = this.y;
    } else if (this.bhvState === 'idle_wander') {
      // Wander target already set by behaviour tree
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const d  = Math.hypot(dx, dy);
      if (d > 0.05) {
        this.x += (dx / d) * this.speed * 0.6 * dt;
        this.y += (dy / d) * this.speed * 0.6 * dt;
      }
    } else {
      // Follow player with personality-based spacing
      const spacing     = this.personality === 'Clingy' ? 0.8 : 2.2;
      const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
      if (distToPlayer > spacing) {
        const dirX    = (player.x - this.x) / distToPlayer;
        const dirY    = (player.y - this.y) / distToPlayer;
        const moveSpd = this.speed * (this.personality === 'Clingy' ? 1.3 : 1);
        this.x += dirX * moveSpd * dt;
        this.y += dirY * moveSpd * dt;
      }
    }

    // ── Junk-cleaner AI ──────────────────────────────────────────
    if (this.junkCleaner && game && game.junks && !this.aggroTarget && this.bhvState !== 'ko') {
      if (this.isCleaningJunk && this.junkTarget) {
        if (this.junkTarget.isDead) {
          // Junk was already cleaned (by player or died)
          this.isCleaningJunk = false; this.junkTarget = null; this.junkCleanProgress = 0;
        } else {
          const dj = Math.hypot(this.junkTarget.x - this.x, this.junkTarget.y - this.y);
          if (dj < 1.4) {
            // Clean it. Cleaner Compies scrub 2.5× faster — chunky pulse of progress
            // each tick — and pull from a wider radius (1.1 → 1.4 tiles).
            const cleanRate = 2.5;
            this.junkCleanProgress += dt * cleanRate;
            this.junkTarget.cleanProgress = this.junkCleanProgress;
            this.targetX = this.x; this.targetY = this.y;
            if (this.junkCleanProgress >= this.junkTarget.cleanTime) {
              // Done — let game handle the removal via the junkTarget.isDead flag
              this.junkTarget.triggerPoof();
              if (game.ach) { game.ach.inc('junk_cleaned'); game.ach.inc('junk_compy_clean'); }
              if (this.junkTarget.level === 3 && game.ach) game.ach.inc('junk3_cleaned');
              // Drop chance bumped 1.5× for cleaner Compies — they're better foragers too.
              const dropRoll = this.junkTarget.dropChance * 1.5;
              if (Math.random() < dropRoll && game.spawnItem) {
                const pool = this.junkTarget._dropPool;
                game.spawnItem(this.junkTarget.x, this.junkTarget.y, pool[Math.floor(Math.random()*pool.length)]);
                if (game.ach) game.ach.inc('junk_item_found');
              }
              if (game._grantXP) game._grantXP(this.junkTarget.level * 5);
              this.isCleaningJunk = false; this.junkTarget = null; this.junkCleanProgress = 0;
              this.showEmote('✨', 1.5);
            }
          } else {
            // Walk toward junk — cleaner Compies hustle 1.5× their normal speed.
            this.targetX = this.junkTarget.x; this.targetY = this.junkTarget.y;
            const dx2 = this.junkTarget.x - this.x, dy2 = this.junkTarget.y - this.y;
            const d2 = Math.hypot(dx2, dy2) || 1;
            this.x += (dx2/d2) * this.speed * 1.5 * dt;
            this.y += (dy2/d2) * this.speed * 1.5 * dt;
          }
        }
      } else {
        // Find nearest unattended, un-dead junk. Search radius widened from
        // 8 → 14 tiles so cleaner Compies actively prowl the lit area.
        this.isCleaningJunk = false; this.junkCleanProgress = 0;
        let nearest = null, nearDist = 14;
        for (const j of game.junks) {
          if (j.isDead) continue;
          const d = Math.hypot(j.x - this.x, j.y - this.y);
          if (d < nearDist) { nearDist = d; nearest = j; }
        }
        if (nearest) { this.junkTarget = nearest; this.isCleaningJunk = true; this.junkCleanProgress = 0; }
      }
    } else if (!this.junkCleaner) {
      this.isCleaningJunk = false; this.junkTarget = null;
    }

    // ── Separation from other companions (prevent overlap) ───────
    if (game && game.companions) {
      const SEP_RADIUS = 0.65;
      for (const other of game.companions) {
        if (other === this || other.isKO) continue;
        const sx = other.x - this.x, sy = other.y - this.y;
        const sepDist = Math.hypot(sx, sy);
        if (sepDist > 0 && sepDist < SEP_RADIUS) {
          const push = ((SEP_RADIUS - sepDist) / SEP_RADIUS) * 1.8 * dt;
          this.x -= (sx / sepDist) * push;
          this.y -= (sy / sepDist) * push;
        }
      }
    }

    // ── Clamp to light radius with inset ─────────────────────────
    const safeRadius = Math.max(0, currentRadius - 1.0);
    const dist = Math.hypot(this.x, this.y);
    if (dist > safeRadius) {
      this.x = (this.x / dist) * safeRadius;
      this.y = (this.y / dist) * safeRadius;
    }
    // Also clamp wander targets inside safe zone
    const wanderDist = Math.hypot(this.wanderTX, this.wanderTY);
    if (wanderDist > safeRadius) {
      this.wanderTX = (this.wanderTX / wanderDist) * safeRadius;
      this.wanderTY = (this.wanderTY / wanderDist) * safeRadius;
    }

    // Update facing direction from net x movement this tick.
    // Threshold filters out micro-jitter so the sprite doesn't flicker when idle.
    const _facingDx = this.x - this._prevX;
    if (_facingDx < -0.005) this.facingLeft = true;
    else if (_facingDx > 0.005) this.facingLeft = false;

    super.update(dt);
  }

  renderSpecific(ctx) {
    const t = Date.now() / 1000;
    const distToPlayerEst = Math.hypot(this.targetX - this.x, this.targetY - this.y);
    const walking = distToPlayerEst > 0.1 && !this.beingPetted;
    let bob = walking ? Math.sin(t * 8) * 1.5 : Math.sin(t * 1.5) * 0.5;
    const legSwing = walking ? Math.sin(t * 8) * 5 : 0;

    // Happy wiggle when being petted
    let wiggleRotation = 0;
    if (this.beingPetted) {
      wiggleRotation = Math.sin(this.petWiggleTime * 20) * 0.15;
      bob = Math.sin(this.petWiggleTime * 15) * 3; // Bouncy happy bob
    }

    // Tap bobble
    let tapBobY = 0;
    if (this.tapBobble > 0) {
      const p = 1 - this.tapBobble;
      tapBobY = -Math.sin(p * Math.PI * 3) * (1 - p) * 10;
    }

    ctx.save();
    ctx.scale(2.6, 2.6); // base 2.0 × 1.3 — Compy reads 30% larger in-world
    // Mirror horizontally so the sprite faces its movement direction.
    if (this.facingLeft) ctx.scale(-1, 1);
    ctx.translate(0, tapBobY / 2);

    // Victory jump
    // Junk-cleaning animation — rapid scrub wobble + sparkles
    if (this.isCleaningJunk) {
      const scrub = Math.sin(t * 18) * 5;
      ctx.translate(scrub, 0);
      ctx.globalAlpha = 0.85;
      ctx.font = '10px Arial'; ctx.textAlign = 'center';
      const sparkAngles = [t * 4, t * 4 + 2.1, t * 4 + 4.2];
      for (const sa of sparkAngles) {
        ctx.fillText('✨', Math.cos(sa) * 16, -22 + Math.sin(sa) * 8);
      }
      ctx.globalAlpha = 1;
    }

    if (this.victoryJumpTimer > 0) {
      const jt = (2.0 - this.victoryJumpTimer) / 2.0;
      const jumpY = Math.sin(jt * Math.PI * 4) * 14 * (1 - jt * 0.5);
      ctx.translate(0, -Math.max(0, jumpY));
      // Star burst
      if (this.victoryJumpTimer > 1.6) {
        const stars = 5;
        for (let i = 0; i < stars; i++) {
          const a = (i / stars) * Math.PI * 2 + t * 3;
          const r = 18 + Math.sin(t * 6 + i) * 4;
          ctx.globalAlpha = 0.7;
          ctx.font = '8px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(['⭐','✨','🌟'][i % 3], Math.cos(a) * r, -16 + Math.sin(a) * r * 0.5);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Detect animation — big ! exclamation jump
    if (this.detectTimer > 0) {
      const dFrac = this.detectTimer / 0.75;
      const jumpY = Math.sin(dFrac * Math.PI * 2) * 18 * dFrac;
      ctx.translate(0, -jumpY);
      const excAlpha = Math.min(1, dFrac * 2.5);
      ctx.save();
      ctx.globalAlpha = excAlpha;
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Pop-in scale
      const excScale = 0.5 + dFrac * 1.5;
      ctx.scale(excScale, excScale);
      ctx.fillText('!', 0, -36);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }


    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, -7, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Apply wiggle rotation
    ctx.save();
    ctx.rotate(wiggleRotation);

    const artReady = this.artImg && this.artImg.complete && this.artImg.naturalWidth > 0;

    if (artReady) {
      // Sprite render — draw the companion art image centered on the body footprint.
      // Size 32×32 sits on the same ground the emoji body would (bottom near y=-2).
      const size = 32;
      // Cute walk: bigger vertical hop + squash/stretch when moving so the
      // sprite reads as bouncing on its feet.
      const hop      = walking ? Math.abs(Math.sin(t * 8)) * 4 : 0;
      const squashY  = walking ? 1 + Math.sin(t * 8) * 0.08 : 1;
      const squashX  = walking ? 1 - Math.sin(t * 8) * 0.06 : 1;
      const drawW = size * squashX;
      const drawH = size * squashY;
      // Anchor the sprite's BOTTOM at the same ground line so squash makes feet
      // press down, not the head — center y was -18 (so bottom = -2).
      ctx.drawImage(
        this.artImg,
        -drawW / 2,
        -2 - drawH + bob - hop,
        drawW, drawH
      );
    } else {
      // Tiny legs
      ctx.strokeStyle = this.color || '#ec4899';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3, -4 + bob); ctx.lineTo(-3 - legSwing * 0.2, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -4 + bob); ctx.lineTo(3 + legSwing * 0.2, 0); ctx.stroke();

      // Body
      ctx.fillStyle = this.color || '#ec4899';
      ctx.beginPath();
      ctx.arc(0, -12 + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1e1e2e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Icon face
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.icon, 0, -12 + bob);

      // Tiny eyes - happy squint when being petted
      ctx.fillStyle = '#1e1e2e';
      if (this.beingPetted) {
        // Happy closed eyes (curved lines)
        ctx.strokeStyle = '#1e1e2e';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(-3, -17 + bob, 2, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(3, -17 + bob, 2, 0, Math.PI); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(-3, -17 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -17 + bob, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Hit flash
    if (this.hitFlashTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.hitFlashTimer * 5) * 0.7;
      ctx.fillStyle = '#ff6666';
      ctx.beginPath();
      ctx.ellipse(0, -12 + bob, 13, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.restore();
  }
}

export class Nightmare extends Entity {
  constructor(x, y, data) {
    super(x, y, data);
    this.color    = data.color   || '#52525b';
    this.icon     = data.icon    || '🐺';
    this.maxHp    = data.hp      || 5;
    this.hp       = this.maxHp;
    this.dmg      = data.dmg     || 1;
    // Speeds reduced 30% (Fast 4.5→3.15, Medium 3→2.1, Slow 1.5→1.05)
    this.speed    = data.speed === 'Fast' ? 3.15 : (data.speed === 'Medium' ? 2.1 : 1.05);
    this.special  = data.special  || null;   // 'drainHappiness' | 'spawnPups' | null
    this.isBoss   = data.isBoss   || false;
    this.state    = 'chase'; // 'chase' | 'retreat' | 'dead'
    this.attackTimer   = 0;
    this.specialTimer  = 0;
    this.isDead        = false;
    this._spawnedId    = data.id || null;
    this.hitFlashTimer = 0;
    this.lastDamageOwner = null;
    this.stunTimer     = 0;
    this._poofTimer       = 0;
    this._poofBurstTimer  = 0;
    this._poofParticles   = [];
  }

  _triggerPoof() {
    this._poofTimer = 1.1;
    this._poofBurstTimer = 0.18;
    this._poofParticles = [];
    const r = this.isBoss ? 34 : 20;
    const n = this.isBoss ? 36 : 22;
    const tint = this.color || '#52525b';
    const COLS = [tint, tint, '#1a0533', '#2a1f3d', '#18181b', '#3f3f46', '#e9d5ff'];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const spd = 30 + Math.random() * 60 * (this.isBoss ? 1.3 : 1);
      const isSparkle = Math.random() < 0.15;
      this._poofParticles.push({
        x: (Math.random() - 0.5) * r * 0.5,
        y: (Math.random() - 0.5) * r * 0.3 - r * 0.2,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.4 - 30,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        size: (isSparkle ? 1.5 : 3.5 + Math.random() * 4.5) * (this.isBoss ? 1.25 : 1),
        col: COLS[Math.floor(Math.random() * COLS.length)],
        glow: isSparkle ? '#e9d5ff' : tint,
        isSparkle
      });
    }
  }

  takeDamage(amount, ownerEntity = null) {
    this.hp -= amount;
    this.hitFlashTimer = 0.35;
    this.lastDamageOwner = ownerEntity;
    this.showEmote('💢', 0.5);
    this._playHitSFX();
    if (this.hp <= 0 && !this.isDead) {
      this.isDead = true;
      this.state  = 'dead';
      this._triggerPoof();
      this._playPoofSFX();
      // Notify owning companion of kill for victory jump
      if (ownerEntity && ownerEntity.victoryJumpTimer !== undefined) {
        ownerEntity.victoryJumpTimer = 2.0;
        ownerEntity.showEmote('🎉', 2.0);
      }
    }
  }

  _playPoofSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;

      // Filtered noise whoosh — bandpass sweeps 1600→300 Hz over ~0.3s: the "poof" air.
      const dur = 0.32;
      const noiseBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate * (dur + 0.05)), ac.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;

      const filt = ac.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = 1.1;
      filt.frequency.setValueAtTime(1600, now);
      filt.frequency.exponentialRampToValueAtTime(300, now + dur);

      const noiseG = ac.createGain();
      noiseG.gain.setValueAtTime(0.0001, now);
      noiseG.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + dur);

      src.connect(filt); filt.connect(noiseG); noiseG.connect(ac.destination);
      src.start(now); src.stop(now + dur + 0.05);

      // Low body "pff" — soft sine thump at the start so the poof has weight.
      const thud = ac.createOscillator();
      const thudG = ac.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(180, now);
      thud.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      thudG.gain.setValueAtTime(0.16, now);
      thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      thud.connect(thudG); thudG.connect(ac.destination);
      thud.start(now); thud.stop(now + 0.2);
    } catch (e) {}
  }

  _playHitSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.2);
      g.gain.setValueAtTime(0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
      osc.start(); osc.stop(ac.currentTime + 0.25);
    } catch(e) {}
  }

  update(dt, target, currentLightRadius, game = null) {
    if (this._poofBurstTimer > 0) this._poofBurstTimer -= dt;
    if (this._poofTimer > 0) {
      this._poofTimer -= dt;
      for (const p of this._poofParticles) {
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.vx *= 1 - dt * 2.5;    // air resistance
        p.vy += 15 * dt;         // light gravity so smoke rises before settling
        p.life -= dt;
      }
    }
    if (this.isDead) return;

    // Stun: frozen, can't move or attack
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
      super.update(dt);
      return;
    }

    this.specialTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    if (this.state === 'chase' && target && !target.isDead) {
      if (Math.random() < 0.005) this.showEmote('💢', 1.0);

      // Moon Ferret: this nightmare ignores the player — wander aimlessly until dawn
      if (this.ignoresPlayer) {
        this._idleWanderTimer = (this._idleWanderTimer || 0) - dt;
        if (this._idleWanderTimer <= 0) {
          this._idleWanderTimer = 2 + Math.random() * 3;
          this._idleWanderDir = Math.random() * Math.PI * 2;
        }
        const dx = Math.cos(this._idleWanderDir || 0), dy = Math.sin(this._idleWanderDir || 0);
        this.x += dx * this.speed * 0.4 * dt;
        this.y += dy * this.speed * 0.4 * dt;
        super.update(dt);
        return;
      }

      const dist = Math.hypot(target.x - this.x, target.y - this.y);

      // ── Weeping Wisp: hover at mid-range, drain happiness ───────
      if (this.special === 'drainHappiness') {
        const drainRange = 2.5;
        // Move to mid-range then hold
        if (dist > drainRange) {
          const dirX = (target.x - this.x) / dist;
          const dirY = (target.y - this.y) / dist;
          this.x += dirX * this.speed * dt;
          this.y += dirY * this.speed * dt;
        }
        // Drain happiness every 2 seconds in range
        if (dist <= drainRange && this.specialTimer <= 0) {
          target.stats.happy = Math.max(0, target.stats.happy - 8);
          target.showEmote('💥', 1.0);
          this.showEmote('👻', 0.8);
          this.specialTimer = 2;
        }
        // Wisp deals no direct HP damage
      }
      // ── Nightmare Root: static, spawns pups every 8s ───────
      else if (this.special === 'spawnPups') {
        // Root doesn't move
        if (this.specialTimer <= 0 && game) {
          const angle = Math.random() * Math.PI * 2;
          game._spawnPupFrom(this.x, this.y, angle);
          this.showEmote('💫', 1.0);
          this.specialTimer = 8;
        }
      }
      // ── Void Titan: slow charge + ranged shockwave every 6s ─────
      else if (this.isBoss) {
        const bossRange = 2.5;
        if (dist > bossRange) {
          const dirX = (target.x - this.x) / dist;
          const dirY = (target.y - this.y) / dist;
          this.x += dirX * this.speed * dt;
          this.y += dirY * this.speed * dt;
        } else {
          this.attackTimer -= dt;
          if (this.attackTimer <= 0) {
            if (game && game.spawnBullet) {
              const d2 = Math.hypot(target.x - this.x, target.y - this.y) || 1;
              game.spawnBullet(this.x, this.y, (target.x - this.x) / d2, (target.y - this.y) / d2,
                               'nightmare', this.color, this.icon, this.dmg * 2, null);
            }
            this.attackTimer = 2;
          }
        }
        // Shockwave: hit all entities in radius 2
        if (this.specialTimer <= 0) {
          this.showEmote('💥', 1.5);
          if (game) game._titanShockwave(this.x, this.y);
          this.specialTimer = 6;
        }
      }
      // ── Standard ranged attack ───────────────────
      else {
        const shootRange = 2.5;
        if (dist > shootRange) {
          const dirX = (target.x - this.x) / dist;
          const dirY = (target.y - this.y) / dist;
          this.x += dirX * this.speed * dt;
          this.y += dirY * this.speed * dt;
        } else {
          this.attackTimer -= dt;
          if (this.attackTimer <= 0) {
            // Silk Spider: chance to trap (stun) the nightmare instead of letting it fire
            const trapChance = game?.perkBonuses?.nightmareTrapChance || 0;
            if (trapChance > 0 && Math.random() < trapChance) {
              this.stunTimer = 3.0;
              this.showEmote('🕸️', 2.0);
              if (game) game.ach.inc('spider_trap');
            } else {
              if (game && game.spawnBullet) {
                const d2 = Math.hypot(target.x - this.x, target.y - this.y) || 1;
                game.spawnBullet(this.x, this.y, (target.x - this.x) / d2, (target.y - this.y) / d2,
                                 'nightmare', this.color, this.icon, this.dmg, null);
              }
              target.stats && (target.stats.happy = Math.max(0, target.stats.happy - 3));
            }
            this.attackTimer = 1.5;
          }
        }
      }
    } else if (this.state === 'retreat') {
      const distToCenter = Math.hypot(this.x, this.y) || 1;
      this.x += (this.x / distToCenter) * this.speed * dt;
      this.y += (this.y / distToCenter) * this.speed * dt;
    }

    super.update(dt);
  }

  draw(ctx, world) {
    // During the death puff, replace the body + emote with the smoke effect.
    if (this._poofTimer > 0) {
      const iso = world.toIso(this.visualX, this.visualY);
      ctx.save();
      ctx.translate(iso.x, iso.y);
      this._renderPoof(ctx);
      ctx.restore();
      return;
    }
    // Dead but poof already finished — don't flicker the body back in while the
    // dissipation timer waits to remove the entity from the list.
    if (this.isDead) return;
    super.draw(ctx, world);
  }

  _renderPoof(ctx) {
    const pct = 1 - this._poofTimer / 1.1; // 0→1 over lifetime
    const baseR = this.isBoss ? 28 : 18;

    // Expanding burst ring flash (early phase only)
    if (pct < 0.35) {
      const ringAlpha = (1 - pct / 0.35) * 0.6;
      const ringR = pct * baseR * 4;
      ctx.save();
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = this.color || '#7c3aed';
      ctx.shadowColor = '#7c3aed';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3 + (1 - pct / 0.35) * 3;
      ctx.beginPath();
      ctx.ellipse(0, -baseR * 0.2, ringR, ringR * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Smoke particles
    for (const p of this._poofParticles) {
      if (p.life <= 0) continue;
      const alpha = (p.life / p.maxLife) * 0.9;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.isSparkle) {
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 10, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = 6;
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 10, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  renderSpecific(ctx) {
    const t = Date.now() / 1000;
    const pulse   = Math.abs(Math.sin(t * 2.5)) * 4;
    const wobble  = Math.sin(t * 3.5) * 0.06;
    const blobScale = 1 + Math.sin(t * 4) * 0.07;
    ctx.save();
    ctx.scale(1.5, 1.5);
    ctx.rotate(wobble);
    const col  = this.color;
    const size = this.isBoss ? 22 : 14;
    const numBlobs = this.isBoss ? 8 : 5;
    // outer mist
    const mistGrad = ctx.createRadialGradient(0, -8, 0, 0, -8, size + 18 + pulse);
    mistGrad.addColorStop(0, col + '60');
    mistGrad.addColorStop(0.5, col + '20');
    mistGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mistGrad;
    ctx.beginPath();
    ctx.ellipse(0, -6, size + 18 + pulse, size + 14 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    // sub-blobs
    ctx.save();
    ctx.scale(blobScale, blobScale);
    for (let i = 0; i < numBlobs; i++) {
      const a = (i / numBlobs) * Math.PI * 2 + t * 0.5;
      const br = size * 0.55 + Math.sin(t * 2 + i) * 2;
      const bx = Math.cos(a) * br * 0.8;
      const by = -8 + Math.sin(a) * br * 0.5;
      const bs = size * 0.45 + Math.sin(t * 3 + i) * 1.5;
      ctx.globalAlpha = 0.45 + Math.sin(t * 2 + i) * 0.15;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(bx, by, bs, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.restore();
    // core body
    const coreGrad = ctx.createRadialGradient(0, -8, 0, 0, -8, size);
    coreGrad.addColorStop(0, '#1a0028');
    coreGrad.addColorStop(0.6, col);
    coreGrad.addColorStop(1, col + '80');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(0, -8, size * blobScale, (size + 4) * blobScale, 0, 0, Math.PI * 2);
    ctx.fill();
    // yellow glowing slit eyes
    const eyeY   = -12 + Math.sin(t * 1.5) * 1;
    const eyeGlow = 0.7 + Math.sin(t * 4) * 0.3;
    const eyeW    = this.isBoss ? 5 : 3.5;
    ctx.shadowColor = '#ffee00'; ctx.shadowBlur = 14;
    ctx.fillStyle = `rgba(255,238,0,${eyeGlow})`;
    ctx.beginPath(); ctx.ellipse(-eyeW, eyeY, eyeW*0.85, eyeW*0.65, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( eyeW, eyeY, eyeW*0.85, eyeW*0.65, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0000';
    ctx.beginPath(); ctx.ellipse(-eyeW, eyeY, eyeW*0.25, eyeW*0.6, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( eyeW, eyeY, eyeW*0.25, eyeW*0.6, 0, 0, Math.PI*2); ctx.fill();
    // special overlays
    if (this.special === 'drainHappiness') {
      const dp = 0.06 + Math.sin(t * 2) * 0.03;
      ctx.strokeStyle = `rgba(236,72,153,${dp})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -8, 2.5 * 64, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.1;
      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.moveTo(-5, -2); ctx.quadraticCurveTo(0, 14, 5, -2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (this.special === 'spawnPups') {
      ctx.strokeStyle = 'rgba(107,63,14,0.6)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t * 0.3;
        const len = 12 + Math.sin(t * 2 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(Math.cos(a+0.3)*7, Math.sin(a+0.3)*5, Math.cos(a)*len, Math.sin(a)*len);
        ctx.stroke();
      }
    } else if (this.isBoss) {
      ctx.strokeStyle = `rgba(180,80,255,${0.3 + Math.sin(t*3)*0.1})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -8, size * 1.5, 0, Math.PI * 2); ctx.stroke();
      const bw = 60, bh = 5;
      const pct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw/2, -64, bw, bh);
      ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.fillRect(-bw/2, -64, bw * pct, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(-bw/2, -64, bw, bh);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px Arial'; ctx.textAlign = 'center';
      ctx.fillText('VOID TITAN', 0, -70);
    }

    // Cat ears
    const earH = this.isBoss ? 13 : 9;
    const earW = this.isBoss ? 7 : 5;
    const earTop = -8 - size - earH * 0.6;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    // Left ear (outer)
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-size * 0.55, -8 - size * 0.65);
    ctx.lineTo(-size * 0.85, earTop);
    ctx.lineTo(-size * 0.25, -8 - size * 0.5);
    ctx.closePath(); ctx.fill();
    // Left ear (inner pink)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,180,200,0.55)';
    ctx.beginPath();
    ctx.moveTo(-size * 0.52, -8 - size * 0.6);
    ctx.lineTo(-size * 0.78, earTop + earH * 0.35);
    ctx.lineTo(-size * 0.3, -8 - size * 0.48);
    ctx.closePath(); ctx.fill();
    // Right ear (outer)
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(size * 0.55, -8 - size * 0.65);
    ctx.lineTo(size * 0.85, earTop);
    ctx.lineTo(size * 0.25, -8 - size * 0.5);
    ctx.closePath(); ctx.fill();
    // Right ear (inner pink)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,180,200,0.55)';
    ctx.beginPath();
    ctx.moveTo(size * 0.52, -8 - size * 0.6);
    ctx.lineTo(size * 0.78, earTop + earH * 0.35);
    ctx.lineTo(size * 0.3, -8 - size * 0.48);
    ctx.closePath(); ctx.fill();

    // Animated tail (S-curve behind the body)
    const tailSwing = Math.sin(t * 2.8) * 0.9; // lazy wag
    const tailLen = this.isBoss ? 32 : 22;
    const tx0 = 0, ty0 = -2; // base of tail at body bottom
    const tx1 = tailLen * 0.5 + tailSwing * tailLen * 0.6;
    const ty1 = tailLen * 0.3;
    const tx2 = tailLen * 0.8 + tailSwing * tailLen;
    const ty2 = -tailLen * 0.5 + Math.cos(t * 2.8) * tailLen * 0.3;
    ctx.strokeStyle = col;
    ctx.lineWidth = this.isBoss ? 5 : 3.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.bezierCurveTo(tx1 * 0.5, ty1 * 0.8, tx1, ty1, tx2, ty2);
    ctx.stroke();
    // fluffy tail tip
    ctx.shadowBlur = 14;
    ctx.fillStyle = col + 'cc';
    ctx.beginPath();
    ctx.arc(tx2, ty2, this.isBoss ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hit flash
    if (this.hitFlashTimer > 0) {
      ctx.globalAlpha = Math.min(1, this.hitFlashTimer * 4) * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(0, -8, size * 1.2, size * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

export class Merchant extends Entity {
  constructor(x, y) {
    super(x, y, { name: 'Merchant', speed: 0.8 });
    this.wanderTimer = 0;
    this.wanderTargetX = x;
    this.wanderTargetY = y;
    this.bobTime = Math.random() * Math.PI * 2;
    this.tapBobble = 0;
  }

  update(dt, currentRadius) {
    this.bobTime += dt;
    if (this.tapBobble > 0) this.tapBobble -= dt;

    // Pause wander when the player taps the merchant or the shop is open,
    // so the merchant stops moving until the interaction is done.
    // Skip the freeze during the nighttime scared-run flee.
    const scaredRun = !!(window.gameInstance && window.gameInstance._merchantScaredRun);
    const modalOpen = !scaredRun && document.getElementById('modal-merchant')?.style.display === 'flex';
    const tappedRecently = !scaredRun && this.tapBobble > 0;
    if (modalOpen || tappedRecently) {
      super.update(dt);
      return;
    }

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const d = 0.5 + Math.random();
      this.wanderTargetX = this.x + Math.cos(angle) * d;
      this.wanderTargetY = this.y + Math.sin(angle) * d;
      this.wanderTimer = 3 + Math.random() * 4;
    }
    const dx = this.wanderTargetX - this.x;
    const dy = this.wanderTargetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.05) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
    const safe = Math.max(0, currentRadius - 1);
    const dc = Math.hypot(this.x, this.y);
    if (dc > safe) { this.x = (this.x / dc) * safe; this.y = (this.y / dc) * safe; }
    super.update(dt);
  }

  renderSpecific(ctx) {
    ctx.save();
    ctx.scale(1.5, 1.5);
    const t = this.bobTime;
    const bob = Math.sin(t * 1.5) * 1.5;
    const sway = Math.sin(t * 0.8) * 0.04;

    // Tap bobble
    if (this.tapBobble > 0) {
      const p = 1 - this.tapBobble;
      ctx.translate(0, -Math.sin(p * Math.PI * 3) * (1 - p) * 7);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(0, 3, 14, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.rotate(sway);

    // Cloak body (dark purple-grey)
    ctx.fillStyle = '#2a1f3d';
    ctx.beginPath();
    ctx.moveTo(-12, -5 + bob);
    ctx.quadraticCurveTo(-14, -25 + bob, -8, -35 + bob);
    ctx.lineTo(8, -35 + bob);
    ctx.quadraticCurveTo(14, -25 + bob, 12, -5 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a1230';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Cloak highlight
    ctx.fillStyle = 'rgba(139,92,246,0.15)';
    ctx.beginPath();
    ctx.moveTo(-6, -10 + bob);
    ctx.quadraticCurveTo(-8, -28 + bob, -4, -33 + bob);
    ctx.lineTo(0, -33 + bob);
    ctx.quadraticCurveTo(-2, -20 + bob, -3, -10 + bob);
    ctx.closePath();
    ctx.fill();

    // Hat (wide brim)
    ctx.fillStyle = '#1e1530';
    ctx.beginPath();
    ctx.ellipse(0, -36 + bob, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hat crown
    ctx.fillStyle = '#261d3a';
    ctx.beginPath();
    ctx.moveTo(-7, -36 + bob);
    ctx.quadraticCurveTo(-8, -48 + bob, 0, -50 + bob);
    ctx.quadraticCurveTo(8, -48 + bob, 7, -36 + bob);
    ctx.closePath();
    ctx.fill();

    // Hidden face — glowing eyes behind shadow
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(-3, -32 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -32 + bob, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Floating briefcase (moonlight glow)
    const bcY = -8 + bob + Math.sin(t * 2) * 2;
    ctx.fillStyle = '#3b1f7e';
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(10, bcY, 10, 7, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(13, bcY + 2, 4, 1);

    // Interaction indicator
    const pulse = 0.5 + Math.sin(t * 3) * 0.3;
    ctx.fillStyle = `rgba(245,158,11,${pulse})`;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('💰', 0, -55 + bob + Math.sin(t * 4) * 2);

    ctx.restore();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// Junk — dark memory clusters that drain happiness
// ─────────────────────────────────────────────────────────────
export class Junk {
  constructor(x, y, level = 1) {
    this.x = x; this.y = y;
    this.visualX = x; this.visualY = y;
    this.level = Math.max(1, Math.min(3, level));
    this.cleanTime  = [0, 1, 3, 6][this.level];
    this.cleanProgress = 0;
    this.isDead = false;
    this._poofTimer = 0;
    this._poofParticles = [];
    this._animTime = 0;
    // Happiness drain per second to nearby characters (within 2 tiles)
    this.happyDrainRate = [0, 0.8, 1.8, 3.5][this.level];
    // T1 item drop pool
    this._dropPool = ['Mushroom','Rice','Egg','Fresh Dew','Clover Leaf','Seaweed Noodle','Wildflower'];
    this.dropChance = [0, 0.35, 0.55, 0.75][this.level];
  }

  get drawRadius() { return [0, 18, 26, 38][this.level]; }

  triggerPoof() {
    this._poofTimer = 1.1;
    this._poofParticles = [];
    this._poofBurstTimer = 0.18; // initial flash burst
    const r = this.drawRadius;
    const n = 16 + this.level * 8; // more particles per level
    const COLS = ['#7c3aed','#9d4edd','#c084fc','#1a0533','#f3e8ff','#6d28d9','#4c1d95'];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const spd = 35 + Math.random() * 70 * this.level;
      const isSparkle = Math.random() < 0.3;
      this._poofParticles.push({
        x: (Math.random() - 0.5) * r * 0.5,
        y: (Math.random() - 0.5) * r * 0.5 - r * 0.3,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.5 - 20,
        life: 0.5 + Math.random() * 0.55,
        maxLife: 1.1,
        size: (isSparkle ? 1.5 : 3 + Math.random() * 5) * (0.7 + this.level * 0.2),
        col: COLS[Math.floor(Math.random() * COLS.length)],
        glow: isSparkle ? '#e9d5ff' : '#7c3aed',
        isSparkle
      });
    }
    this.isDead = true;
    Junk._playPoofSFX(this.level);
  }

  static _playPoofSFX(level) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;
      // Deep thud — low rumble decaying quickly
      const thud = ac.createOscillator();
      const thudG = ac.createGain();
      thud.connect(thudG); thudG.connect(ac.destination);
      thud.type = 'sine';
      thud.frequency.setValueAtTime(90 + level * 25, now);
      thud.frequency.exponentialRampToValueAtTime(25, now + 0.2);
      thudG.gain.setValueAtTime(0.22 + level * 0.05, now);
      thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      thud.start(now); thud.stop(now + 0.3);
      // Whoosh — noise-like filtered sweep
      const buf = ac.createBuffer(1, ac.sampleRate * 0.45, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const filt = ac.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(700 + level * 180, now);
      filt.frequency.exponentialRampToValueAtTime(100, now + 0.4);
      filt.Q.value = 0.7;
      const whooshG = ac.createGain();
      whooshG.gain.setValueAtTime(0.08 + level * 0.018, now);
      whooshG.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      src.connect(filt); filt.connect(whooshG); whooshG.connect(ac.destination);
      src.start(now); src.stop(now + 0.45);
      // High sparkle ping (layered on top for poof feel)
      const ping = ac.createOscillator();
      const pingG = ac.createGain();
      ping.connect(pingG); pingG.connect(ac.destination);
      ping.type = 'sine';
      ping.frequency.setValueAtTime(1200 + level * 200, now + 0.02);
      ping.frequency.exponentialRampToValueAtTime(400, now + 0.18);
      pingG.gain.setValueAtTime(0.06 + level * 0.01, now + 0.02);
      pingG.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      ping.start(now + 0.02); ping.stop(now + 0.24);
    } catch(e) {}
  }

  update(dt) {
    this._animTime += dt;
    if (this._poofBurstTimer > 0) this._poofBurstTimer -= dt;
    if (this._poofTimer > 0) {
      this._poofTimer -= dt;
      for (const p of this._poofParticles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - dt * 2.5; // air resistance
        p.vy += 30 * dt; // gravity
        p.life -= dt;
      }
    }
  }

  draw(ctx, world) {
    const iso = world.toIso(this.visualX, this.visualY);
    ctx.save();
    ctx.translate(iso.x, iso.y);

    if (this._poofTimer > 0) {
      const pct = 1 - this._poofTimer / 1.1; // 0→1 over lifetime

      // Expanding burst ring flash (early phase only)
      if (pct < 0.35) {
        const ringAlpha = (1 - pct / 0.35) * 0.75;
        const ringR = pct * this.drawRadius * 4;
        ctx.save();
        ctx.globalAlpha = ringAlpha;
        ctx.strokeStyle = '#c084fc';
        ctx.shadowColor = '#7c3aed';
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3 + (1 - pct / 0.35) * 4;
        ctx.beginPath();
        ctx.ellipse(0, -this.drawRadius * 0.2, ringR, ringR * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Particles
      for (const p of this._poofParticles) {
        if (p.life <= 0) continue;
        const alpha = (p.life / p.maxLife) * 0.9;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (p.isSparkle) {
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y - 10, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.shadowColor = p.glow;
          ctx.shadowBlur = 6;
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 10, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else {
      this._drawJunk(ctx);
    }
    ctx.restore();
  }

  _drawJunk(ctx) {
    const t = this._animTime;
    const r = this.drawRadius;
    const w1 = Math.sin(t * 2.3) * 2.5;
    const w2 = Math.cos(t * 3.1) * 2;

    // Breathing rhythm: slow inhale-exhale cycle
    const breathe = Math.sin(t * 1.1) * 0.5 + 0.5; // 0..1, ~1.1 rad/s ≈ one breath per ~5.7s
    const breathScale = 1 + breathe * 0.12 * this.level; // level 3 expands 36%

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.6, r * 1.1 * breathScale, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer breathing glow — pulses with breath
    const glowAlpha = 0.18 + breathe * 0.28;
    const glowR = r * (1.9 + breathe * 0.6);
    const auraGrad = ctx.createRadialGradient(0, -r * 0.2, 0, 0, -r * 0.2, glowR);
    auraGrad.addColorStop(0,   `rgba(120,10,200,${glowAlpha * 1.4})`);
    auraGrad.addColorStop(0.35,`rgba(75,5,130,${glowAlpha})`);
    auraGrad.addColorStop(0.7, `rgba(40,0,80,${glowAlpha * 0.4})`);
    auraGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.1, glowR, glowR * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary tight glow ring that pulses bright on exhale
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = 8 + breathe * 22;
    ctx.strokeStyle = `rgba(139,40,255,${0.15 + breathe * 0.35})`;
    ctx.lineWidth = 2 + breathe * 3;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.2, r * breathScale * 1.05, r * breathScale * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Main dark blob (scales with breath)
    ctx.save();
    ctx.scale(breathScale, breathScale);
    ctx.shadowColor = '#4c1d95'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#150328';
    ctx.beginPath();
    ctx.moveTo(-r + w1, 2);
    ctx.bezierCurveTo(-r * 1.1, -r * 0.7 + w2, -r * 0.2 + w1, -r * 1.35, r * 0.6, -r * 1.0 + w2);
    ctx.bezierCurveTo(r * 1.15, -r * 0.6, r * 1.1 + w1, r * 0.2, r * 0.5, r * 0.45 + w2);
    ctx.bezierCurveTo(r * 0.1, r * 0.7, -r * 0.7, r * 0.6 + w1 * 0.5, -r + w2, r * 0.1);
    ctx.closePath();
    ctx.fill();

    // Inner purple core
    ctx.fillStyle = '#2d0b4e';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.35 + w1 * 0.4, r * 0.55, r * 0.65, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Ghostly eyes (2 per level)
    const eyeAlpha = 0.55 + Math.sin(t * 1.8) * 0.3;
    const eyePairs = [[{ex:-r*0.28,ey:-r*0.55},{ex:r*0.22,ey:-r*0.45}],
                      [{ex:-r*0.3,ey:-r*0.6},{ex:r*0.25,ey:-r*0.5},{ex:-r*0.05,ey:-r*0.3}],
                      [{ex:-r*0.35,ey:-r*0.65},{ex:r*0.3,ey:-r*0.55},{ex:-r*0.1,ey:-r*0.35},{ex:r*0.05,ey:-r*0.2}]];
    for (const eye of eyePairs[this.level - 1]) {
      ctx.globalAlpha = eyeAlpha;
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.ellipse(eye.ex + w1 * 0.1, eye.ey + w2 * 0.1, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#0f0015';
      ctx.beginPath();
      ctx.arc(eye.ex, eye.ey, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore(); // end breathScale

    // Level dots
    for (let i = 0; i < this.level; i++) {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(-4 + i * 5, r * 0.55, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clean progress arc (if being cleaned)
    if (this.cleanProgress > 0) {
      const pct = this.cleanProgress / this.cleanTime;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#34d399'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, -r * 0.3, r + 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// MerchantCamp — static world asset near campfire
// ─────────────────────────────────────────────────────────────
export class MerchantCamp {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.visualX = x; this.visualY = y;
    this._time = 0;
    this.merchantInside = false; // true when merchant hiding at night
  }

  update(dt) { this._time += dt; }

  draw(ctx, world) {
    const iso = world.toIso(this.x, this.y);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    this._drawCamp(ctx);
    ctx.restore();
  }

  _drawCamp(ctx) {
    const t = this._time;
    const lanternSwing = Math.sin(t * 1.2) * 0.06;
    ctx.save();
    ctx.scale(2, 2);

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Back tent wall
    ctx.fillStyle = '#3b2a5e';
    ctx.beginPath();
    ctx.moveTo(-22, -5);
    ctx.lineTo(0, -42);
    ctx.lineTo(22, -5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a1f45';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tent fabric (main face)
    const tentGrad = ctx.createLinearGradient(-20, -40, 20, 0);
    tentGrad.addColorStop(0, '#6d3fa0');
    tentGrad.addColorStop(0.5, '#4e2d7a');
    tentGrad.addColorStop(1, '#3b2060');
    ctx.fillStyle = tentGrad;
    ctx.beginPath();
    ctx.moveTo(-20, -4);
    ctx.lineTo(0, -40);
    ctx.lineTo(20, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a1545';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tent stripes
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7, -40 + Math.abs(i) * 14);
      ctx.lineTo(i * 10 - i * 3, -4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Tent entrance (dark opening)
    ctx.fillStyle = '#1a0f2e';
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.quadraticCurveTo(-2, -24, 8, -4);
    ctx.closePath();
    ctx.fill();

    // Entrance curtain (partially open)
    ctx.fillStyle = '#8b5cf6';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.quadraticCurveTo(-5, -20, -1, -4);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Peak decoration - star
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 0, -44);
    ctx.shadowBlur = 0;

    // Hanging lantern (left pole)
    ctx.save();
    ctx.translate(-26, -20);
    ctx.rotate(lanternSwing);
    // Pole
    ctx.strokeStyle = '#4a3060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(0, 8);
    ctx.stroke();
    // Lantern body
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(-4, 8, 8, 10, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // "Asleep" indicator when merchant hiding inside
    if (this.merchantInside) {
      const zAlpha = 0.5 + Math.sin(t * 1.5) * 0.3;
      ctx.globalAlpha = zAlpha;
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('💤', 5, -50);
      ctx.globalAlpha = 1;
    }
    ctx.restore(); // end 2x scale
  }
}

// ── Chain Lightning VFX ───────────────────────────────────────────
export class ChainLightningVFX {
  constructor(positions) {
    this.positions = positions; // [{x,y}, ...] from caster through targets
    this.life      = 0;
    this.maxLife   = 0.38;
    this.done      = false;
    // Pre-bake random offsets so the bolt doesn't jitter each frame
    this.jags = positions.slice(0, -1).map(() => ({
      mx: (Math.random() - 0.5) * 22,
      my: (Math.random() - 0.5) * 12,
    }));
    this._playSFX();
  }

  _playSFX() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o1.connect(g); o2.connect(g); g.connect(ac.destination);
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(300, ac.currentTime);
      o1.frequency.exponentialRampToValueAtTime(2200, ac.currentTime + 0.14);
      o2.type = 'square';
      o2.frequency.setValueAtTime(150, ac.currentTime);
      o2.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.14);
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
      o1.start(); o1.stop(ac.currentTime + 0.22);
      o2.start(); o2.stop(ac.currentTime + 0.22);
    } catch(e) {}
  }

  update(dt) {
    this.life += dt;
    if (this.life >= this.maxLife) this.done = true;
  }

  draw(ctx, world) {
    if (this.done) return;
    const pct   = this.life / this.maxLife;
    const alpha = 1 - pct;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.5 * (1 - pct * 0.6);
    ctx.lineCap = 'round';

    for (let i = 0; i < this.positions.length - 1; i++) {
      const a   = world.toIso(this.positions[i].x,   this.positions[i].y);
      const b   = world.toIso(this.positions[i + 1].x, this.positions[i + 1].y);
      const jag = this.jags[i] || { mx: 0, my: 0 };

      // Outer glow arc
      ctx.strokeStyle = '#bfdbfe';
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur  = 18;
      ctx.lineWidth   = 3 * (1 - pct * 0.5);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 28);
      ctx.quadraticCurveTo((a.x + b.x) / 2 + jag.mx, (a.y + b.y) / 2 - 28 + jag.my, b.x, b.y - 28);
      ctx.stroke();

      // Inner white core
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur  = 6;
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 28);
      ctx.quadraticCurveTo((a.x + b.x) / 2 + jag.mx, (a.y + b.y) / 2 - 28 + jag.my, b.x, b.y - 28);
      ctx.stroke();

      // Impact burst at each target node (skip first = caster)
      if (i > 0) {
        const r = 7 * (1 - pct);
        ctx.fillStyle = '#93c5fd';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(a.x, a.y - 28, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Final target burst
    const last = world.toIso(this.positions[this.positions.length - 1].x, this.positions[this.positions.length - 1].y);
    ctx.fillStyle = '#dbeafe';
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(last.x, last.y - 28, 9 * (1 - pct), 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── Shield Cast VFX (expanding ring when shield is applied) ──────
export class ShieldCastVFX {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.life    = 0;
    this.maxLife = 0.5;
    this.done    = false;
  }

  update(dt) {
    this.life += dt;
    if (this.life >= this.maxLife) this.done = true;
  }

  draw(ctx, world) {
    if (this.done) return;
    const iso  = world.toIso(this.x, this.y);
    const pct  = this.life / this.maxLife;
    const r    = 14 + pct * 28;
    ctx.save();
    ctx.globalAlpha = (1 - pct) * 0.75;
    ctx.strokeStyle = '#93c5fd';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur  = 16;
    ctx.lineWidth   = 2.5 * (1 - pct);
    ctx.beginPath();
    ctx.ellipse(iso.x, iso.y - 30, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    ctx.restore();
  }
}
