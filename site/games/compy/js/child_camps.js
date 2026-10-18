// ============================================================
// child_camps.js — one personal camp per child NPC.
//
// Each camp is a small static prop placed at the edge of the lit area at the
// child's discovery distance. When a child is first discovered, they spawn
// next to their camp. Children also drift back to their camp periodically
// to rest.
//
// Camps are drawn in the same depth-sorted entity pass as everything else
// in the world, so they'll occlude / be occluded by other sprites correctly.
// ============================================================

export class ChildCamp {
  constructor(childIdx, def) {
    this.childIdx = childIdx;
    this.def      = def;
    const c = def.camp || { type: 'music_stand', angle: 0, distance: 5 };
    this.x = Math.cos(c.angle) * c.distance;
    this.y = Math.sin(c.angle) * c.distance;
    this.visualX = this.x;
    this.visualY = this.y;
    this.type = c.type;
    this._time = 0;
    this.isOccupied = false;     // true while a child is resting at it
  }

  update(dt) { this._time += dt; }

  draw(ctx, world) {
    const iso = world.toIso(this.visualX, this.visualY);
    ctx.save();
    ctx.translate(iso.x, iso.y);
    this._drawShadow(ctx);
    switch (this.type) {
      case 'music_stand': this._drawMusicStand(ctx); break;
      case 'workbench':   this._drawWorkbench(ctx);  break;
      case 'easel':       this._drawEasel(ctx);      break;
      case 'picnic':      this._drawPicnic(ctx);     break;
      case 'arena':       this._drawArena(ctx);      break;
      case 'pillow_fort': this._drawPillowFort(ctx); break;
    }
    ctx.restore();
  }

  _drawShadow(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Ren — Music Stand ──────────────────────────────────────
  _drawMusicStand(ctx) {
    const t = this._time;
    const swing = Math.sin(t * 0.9) * 0.08;
    ctx.save();
    ctx.scale(2, 2);
    // Tripod legs
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-7, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo( 7, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo( 0, 9); ctx.stroke();
    // Vertical pole
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 2); ctx.stroke();
    // Sheet music tray
    ctx.save();
    ctx.translate(0, -22);
    ctx.rotate(swing);
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.roundRect(-12, -1, 24, 3, 1); ctx.fill();
    // Sheet of paper
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath(); ctx.roundRect(-9, -10, 18, 11, 1.5); ctx.fill();
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-7, -8 + i * 2.2);
      ctx.lineTo( 7, -8 + i * 2.2);
      ctx.stroke();
    }
    // ♪ on the sheet
    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 6px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♪', -2, -4);
    ctx.fillText('♫', 4,  -1);
    ctx.restore();
    // Hanging chime above
    ctx.save();
    ctx.translate(-13, -18);
    ctx.rotate(Math.sin(t * 1.4) * 0.12);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const x = i * 2 - 2;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 5 + i * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(0, -1, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ── Bram — Workbench ───────────────────────────────────────
  _drawWorkbench(ctx) {
    const t = this._time;
    ctx.save();
    ctx.scale(2, 2);
    // Crate base
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath(); ctx.roundRect(-12, -8, 24, 14, 2); ctx.fill();
    ctx.strokeStyle = '#3f2611';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // Plank lines
    ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(12, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4,  -8); ctx.lineTo(-4, 6);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 4,  -8); ctx.lineTo( 4, 6);  ctx.stroke();
    // Bench top
    ctx.fillStyle = '#a16207';
    ctx.beginPath(); ctx.roundRect(-14, -10, 28, 3, 1); ctx.fill();
    ctx.strokeStyle = '#3f2611';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    // Hammer leaning on the bench
    ctx.save();
    ctx.translate(-9, -11);
    ctx.rotate(-0.5 + Math.sin(t * 0.6) * 0.04);
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.roundRect(-2, -4, 4, 6, 1); ctx.fill();
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath(); ctx.roundRect(-0.6, 1, 1.2, 8, 0.4); ctx.fill();
    ctx.restore();
    // Wood plank propped up
    ctx.save();
    ctx.translate(8, -10);
    ctx.rotate(-0.2);
    ctx.fillStyle = '#92400e';
    ctx.beginPath(); ctx.roundRect(-1.5, -10, 3, 14, 0.5); ctx.fill();
    ctx.strokeStyle = '#3f2611';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
    // Wood shavings on ground
    ctx.fillStyle = '#fde7c4';
    for (let i = 0; i < 4; i++) {
      const x = -8 + i * 5 + Math.sin(t + i) * 0.3;
      ctx.beginPath(); ctx.ellipse(x, 7, 1.6, 0.6, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Wren — Art Easel ───────────────────────────────────────
  _drawEasel(ctx) {
    const t = this._time;
    ctx.save();
    ctx.scale(2, 2);
    // Tripod easel legs
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1, -22); ctx.lineTo(-9, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 1, -22); ctx.lineTo( 9, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -22);  ctx.lineTo(0, -2); ctx.stroke();
    // Cross-brace
    ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(7, 2); ctx.stroke();
    // Canvas
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath(); ctx.roundRect(-10, -20, 20, 18, 1); ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Painting on canvas — abstract coral & lavender brushstrokes
    ctx.fillStyle = 'rgba(251,113,133,0.7)';
    ctx.beginPath(); ctx.ellipse(-4, -14, 4, 2, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(167,139,250,0.6)';
    ctx.beginPath(); ctx.ellipse(3, -10, 5, 1.6, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(251,191,36,0.6)';
    ctx.beginPath(); ctx.ellipse(0, -6, 3, 1.2, 0.2, 0, Math.PI * 2); ctx.fill();
    // Faint kanji-like brush mark in the corner
    ctx.strokeStyle = 'rgba(20,18,32,0.55)';
    ctx.lineWidth = 0.7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -17); ctx.lineTo(-3, -16);
    ctx.stroke();
    // Jar of brushes on the ground, right
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.roundRect(11, 3, 5, 6, 1); ctx.fill();
    // Brushes
    ctx.strokeStyle = '#fde7c4'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(13, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(15, -2); ctx.stroke();
    // Paint splatter on the ground
    const sp = (Math.sin(t * 0.4) + 1) * 0.5;
    ctx.fillStyle = 'rgba(251,113,133,0.45)';
    ctx.beginPath(); ctx.arc(-12, 7, 1.6 + sp * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(167,139,250,0.40)';
    ctx.beginPath(); ctx.arc(-9,  9, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Mira — Picnic Blanket ──────────────────────────────────
  _drawPicnic(ctx) {
    const t = this._time;
    ctx.save();
    ctx.scale(2, 2);
    // Round picnic blanket — checkered pattern
    ctx.fillStyle = '#fda4af';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#be185d';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Checker grid (diagonal lines for an iso-friendly look)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.6;
    for (let i = -3; i <= 3; i++) {
      const x = i * 4;
      ctx.beginPath(); ctx.moveTo(x, -7); ctx.lineTo(x + 4, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 7);  ctx.lineTo(x + 4, -7); ctx.stroke();
    }
    // Wicker basket
    ctx.fillStyle = '#a16207';
    ctx.beginPath(); ctx.roundRect(-6, -8, 12, 7, 1.5); ctx.fill();
    ctx.strokeStyle = '#3f2611';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Basket weave pattern
    ctx.lineWidth = 0.5;
    for (let i = -5; i <= 5; i += 2) {
      ctx.beginPath(); ctx.moveTo(i, -8); ctx.lineTo(i + 1, -1); ctx.stroke();
    }
    // Basket handle
    ctx.beginPath(); ctx.lineWidth = 0.8;
    ctx.arc(0, -8, 5, Math.PI, Math.PI * 2);
    ctx.stroke();
    // Tiny pastry
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(8, -2, 1.6, 0, Math.PI * 2); ctx.fill();
    // Steaming kettle
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.roundRect(-12, -4, 7, 5, 1); ctx.fill();
    // Spout
    ctx.beginPath();
    ctx.moveTo(-12, -2); ctx.lineTo(-15, -3); ctx.lineTo(-13, -1);
    ctx.fill();
    // Steam
    const steamY = (t * 6) % 8;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(-14, -8 - steamY, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-13, -10 - steamY * 0.6, 1.0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Pip — Wooden Arena ─────────────────────────────────────
  _drawArena(ctx) {
    const t = this._time;
    ctx.save();
    ctx.scale(2, 2);
    // Dirt circle
    ctx.fillStyle = '#a16207';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Wooden border posts
    ctx.fillStyle = '#7c2d12';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 14, y = Math.sin(a) * 7;
      ctx.beginPath(); ctx.roundRect(x - 1, y - 3, 2, 4, 0.5); ctx.fill();
    }
    // Center sign
    ctx.save();
    ctx.translate(0, -1);
    // Sign post
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath(); ctx.roundRect(-1, -4, 2, 12, 0.5); ctx.fill();
    // Sign board
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath(); ctx.roundRect(-7, -16, 14, 8, 1); ctx.fill();
    ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 5px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PIP\'S', 0, -13.5);
    ctx.fillText('SPOT',  0, -10);
    ctx.restore();
    // Flag on top, waving
    ctx.save();
    ctx.translate(0, -16);
    const wave = Math.sin(t * 3) * 0.18;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8 + wave * 2, -1);
    ctx.lineTo(7, -3);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ── Tobi — Pillow Fort ─────────────────────────────────────
  _drawPillowFort(ctx) {
    const t = this._time;
    const breath = 1 + Math.sin(t * 1.0) * 0.02;
    ctx.save();
    ctx.scale(2 * breath, 2 * breath);
    // Back pillow stack
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.roundRect(-14, -6, 10, 8, 2); ctx.fill();
    ctx.strokeStyle = '#581c87'; ctx.lineWidth = 0.8;
    ctx.stroke();
    // Front pillow stack right
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath(); ctx.roundRect(4, -5, 10, 8, 2); ctx.fill();
    ctx.stroke();
    // Tall stack center
    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath(); ctx.roundRect(-6, -14, 12, 6, 2); ctx.fill();
    ctx.stroke();
    // Draped blanket roof
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.moveTo(-13, -8);
    ctx.bezierCurveTo(-8, -22, 8, -22, 13, -8);
    ctx.lineTo(11, -6);
    ctx.bezierCurveTo(7, -16, -7, -16, -11, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#581c87'; ctx.lineWidth = 0.6;
    ctx.stroke();
    // Stars on the blanket
    ctx.fillStyle = '#fde68a';
    ctx.font = '6px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', -5, -13);
    ctx.fillText('✦',  4, -14);
    // Inside opening — dark
    ctx.fillStyle = '#1a0f2e';
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.quadraticCurveTo(0, -12, 3, -3);
    ctx.closePath();
    ctx.fill();
    // Tiny plush peeking from inside
    ctx.fillStyle = '#92400e';
    ctx.beginPath(); ctx.arc(0, -5, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde7c4';
    ctx.beginPath(); ctx.arc(0, -4.5, 0.5, 0, Math.PI * 2); ctx.fill();
    // Soft "z" floating up when the fort is empty (Tobi's away)
    if (!this.isOccupied) {
      const zY = (t * 6) % 9;
      ctx.fillStyle = 'rgba(251,191,36,0.5)';
      ctx.font = 'bold 5px Arial';
      ctx.fillText('z', 9, -16 - zY * 0.4);
    }
    ctx.restore();
  }
}
