export class World {
  constructor() {
    this.tileSize = 64; // Isometric tile conceptual size
    this.width = 52; // Full map radius
    this.grid = new Map(); // Store tiles sparsely
    this.initMap();
  }

  // Seeded random for consistent decoration placement
  seededRandom(x, y, seed = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  }

  // Returns cartesian x,y projected to isometric 2D screen coordinates
  toIso(x, y) {
    return {
      x: (x - y) * (this.tileSize),
      y: (x + y) * (this.tileSize / 2)
    };
  }

  initMap() {
    this.tiles = [];
    const r = this.width;
    for(let x = -r; x <= r; x++) {
      for(let y = -r; y <= r; y++) {
        if (x*x + y*y <= r*r) {
          const iso = this.toIso(x, y);
          
          // Generate decorations for this tile using seeded random
          const decorations = this.generateDecorations(x, y);
          
          this.tiles.push({ 
            cx: x, 
            cy: y, 
            isoX: iso.x, 
            isoY: iso.y,
            decorations: decorations
          });
        }
      }
    }
    // Sort tiles back-to-front for correct isometric rendering
    this.tiles.sort((a,b) => (a.cx + a.cy) - (b.cx + b.cy));
  }

  generateDecorations(tileX, tileY) {
    const decorations = [];
    const rng = (seed) => this.seededRandom(tileX, tileY, seed);

    // (Mud patches removed — they read as ugly potholes against the new pastel palette.)

    // Stones (25% chance for at least one stone)
    const stoneCount = rng(3) < 0.25 ? Math.floor(1 + rng(4) * 3) : 0;
    for (let i = 0; i < stoneCount; i++) {
      const seed = 100 + i * 10;
      decorations.push({
        type: 'stone',
        x: (rng(seed) - 0.5) * 0.7,
        y: (rng(seed + 1) - 0.5) * 0.35,
        size: 2 + rng(seed + 2) * 4,
        shade: 0.4 + rng(seed + 3) * 0.3, // Variation in grey
        elongation: 0.6 + rng(seed + 4) * 0.4
      });
    }
    
    // Small pebbles cluster (20% chance)
    if (rng(5) < 0.20) {
      const pebbleCount = 2 + Math.floor(rng(50) * 4);
      const clusterX = (rng(51) - 0.5) * 0.5;
      const clusterY = (rng(52) - 0.5) * 0.25;
      for (let i = 0; i < pebbleCount; i++) {
        const seed = 200 + i * 5;
        decorations.push({
          type: 'pebble',
          x: clusterX + (rng(seed) - 0.5) * 0.2,
          y: clusterY + (rng(seed + 1) - 0.5) * 0.1,
          size: 1 + rng(seed + 2) * 2,
          shade: 0.35 + rng(seed + 3) * 0.25
        });
      }
    }

    // Grass tufts — small clumps of blades scattered randomly.
    // Each tile has up to 3 tufts at independent probabilities.
    for (let g = 0; g < 3; g++) {
      const baseSeed = 300 + g * 7;
      if (rng(baseSeed) < 0.45) {
        decorations.push({
          type: 'grass',
          x: (rng(baseSeed + 1) - 0.5) * 0.85,
          y: (rng(baseSeed + 2) - 0.5) * 0.45,
          size:  0.8 + rng(baseSeed + 3) * 1.4,
          tilt:  (rng(baseSeed + 4) - 0.5) * 0.5,
          // Slight hue variation across tufts: yellow-green, mid-green, blue-green
          tint:  rng(baseSeed + 5),
          blades: 3 + Math.floor(rng(baseSeed + 6) * 3),
        });
      }
    }

    return decorations;
  }

  draw(ctx, playerX, playerY, lightRadiusPx, happiness = 0) {
    // Draw the ground
    for (let t of this.tiles) {
      // Frustum culling (very basic)
      const distToCamSq = Math.pow(t.isoX - playerX, 2) + Math.pow(t.isoY - playerY, 2);
      if (distToCamSq > Math.pow(1000, 2)) continue;

      this.drawIsoTile(ctx, t.isoX, t.isoY, t.decorations, t.cx, t.cy, happiness);
    }
  }

  drawIsoTile(ctx, x, y, decorations = [], cx = 0, cy = 0, happiness = 0) {
    const halfW = this.tileSize;
    const halfH = this.tileSize / 2;

    // Draw base tile
    ctx.beginPath();
    ctx.moveTo(x, y - halfH);
    ctx.lineTo(x + halfW, y);
    ctx.lineTo(x, y + halfH);
    ctx.lineTo(x - halfW, y);
    ctx.closePath();

    // Grass meadow base — soft pastel green with a bit of tile-to-tile
    // variation so the ground doesn't feel uniform.
    const tShade = this.seededRandom(cx, cy, 7);
    const greenL = 165 + Math.floor(tShade * 18); // 165..183 lightness
    ctx.fillStyle = `rgb(${greenL - 30}, ${greenL + 30}, ${greenL - 60})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();

    // ── Green happiness patches ──────────────────────────────────
    if (happiness >= 50) {
      const greenFrac = Math.min(1, (happiness - 50) / 50);
      const patchSeed = this.seededRandom(cx, cy, 42);
      if (patchSeed < 0.65) {
        const alpha = greenFrac * patchSeed * 0.7;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = happiness >= 80 ? '#3a7d44' : '#2d6b3a';
        ctx.beginPath();
        const patchW = halfW * (0.4 + patchSeed * 0.5);
        const patchH = halfH * (0.4 + patchSeed * 0.4);
        const offX = (this.seededRandom(cx, cy, 43) - 0.5) * halfW * 0.4;
        const offY = (this.seededRandom(cx, cy, 44) - 0.5) * halfH * 0.4;
        ctx.ellipse(x + offX, y + offY, patchW, patchH, this.seededRandom(cx, cy, 45) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── Flowers at 80%+ happiness ─────────────────────────────────
    if (happiness >= 80) {
      const flowerSeed = this.seededRandom(cx, cy, 55);
      if (flowerSeed < 0.28) {
        const flowerFrac = Math.min(1, (happiness - 80) / 20);
        ctx.globalAlpha = flowerFrac * 0.9;
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const flowers = ['🌸','🌼','🌺','🌷','💐'];
        const fIdx = Math.floor(this.seededRandom(cx, cy, 66) * flowers.length);
        const fOffX = (this.seededRandom(cx, cy, 77) - 0.5) * halfW * 0.7;
        const fOffY = (this.seededRandom(cx, cy, 88) - 0.5) * halfH * 0.5;
        ctx.fillText(flowers[fIdx], x + fOffX, y + fOffY - 10);
        ctx.globalAlpha = 1;
      }
    }
    
    // Draw decorations
    for (const deco of decorations) {
      const decoX = x + deco.x * halfW * 2;
      const decoY = y + deco.y * halfH * 2;

      if (deco.type === 'mud') {
        this.drawMudPatch(ctx, decoX, decoY, deco);
      } else if (deco.type === 'stone') {
        this.drawStone(ctx, decoX, decoY, deco);
      } else if (deco.type === 'pebble') {
        this.drawPebble(ctx, decoX, decoY, deco);
      } else if (deco.type === 'grass') {
        this.drawGrassTuft(ctx, decoX, decoY, deco);
      }
    }
  }

  // Small clump of grass blades — fan of 3-5 lines tinted across yellow-green
  // through mid-green to blue-green. Idles with a tiny windsway each frame.
  drawGrassTuft(ctx, x, y, deco) {
    ctx.save();
    ctx.translate(x, y);
    // Skip per-tile windsway in low-spec — tuft is static.
    const sway = window._lowSpecMode ? 0 : Math.sin(Date.now() / 700 + (x + y) * 0.05) * 0.05;
    ctx.rotate(deco.tilt + sway);
    // Blade colour palette interpolated by tint.
    const t = deco.tint;
    const r = Math.round(132 + (170 - 132) * (1 - t));
    const g = Math.round(196 + (220 - 196) * (1 - Math.abs(t - 0.5) * 2));
    const b = Math.round(108 + (160 - 108) * t);
    const blade = `rgb(${r}, ${g}, ${b})`;
    const dark  = `rgb(${Math.max(0, r - 24)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 24)})`;
    const h = 4 + deco.size * 1.6;
    const w = 0.8 + deco.size * 0.5;
    // Tiny ground shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(0, 0.5, h * 0.6, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Draw a fan of blades around the centre.
    ctx.strokeStyle = dark;
    ctx.lineWidth = w + 0.4;
    ctx.lineCap = 'round';
    const N = deco.blades;
    for (let i = 0; i < N; i++) {
      const a = (i / (N - 1) - 0.5) * 0.9;       // -0.45 .. +0.45 rad fan
      const tipX = Math.sin(a) * h * 0.7;
      const tipY = -h - Math.abs(Math.sin(a)) * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tipX * 0.5, tipY * 0.4, tipX, tipY);
      ctx.stroke();
    }
    // Lighter highlights on top of the dark stroke.
    ctx.strokeStyle = blade;
    ctx.lineWidth = Math.max(0.4, w);
    for (let i = 0; i < N; i++) {
      const a = (i / (N - 1) - 0.5) * 0.9;
      const tipX = Math.sin(a) * h * 0.7;
      const tipY = -h - Math.abs(Math.sin(a)) * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tipX * 0.5, tipY * 0.4, tipX, tipY);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMudPatch(ctx, x, y, deco) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(deco.rotation);
    ctx.scale(deco.scaleX, deco.scaleY);
    
    // Irregular mud shape using multiple overlapping ellipses
    ctx.fillStyle = '#2d2418'; // warm dark brown mud
    ctx.beginPath();
    ctx.ellipse(0, 0, this.tileSize * 0.8, this.tileSize * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Slightly lighter inner area for depth
    ctx.fillStyle = '#38302a';
    ctx.beginPath();
    ctx.ellipse(2, -2, this.tileSize * 0.5, this.tileSize * 0.3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  drawStone(ctx, x, y, deco) {
    ctx.save();
    ctx.translate(x, y);
    
    const grey = Math.floor(60 + deco.shade * 40);
    const size = deco.size;
    
    // Stone shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(1, 2, size * 1.1, size * 0.5 * deco.elongation, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Main stone body (oval)
    ctx.fillStyle = `rgb(${grey}, ${grey + 5}, ${grey + 10})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6 * deco.elongation, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = `rgba(255,255,255,0.15)`;
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.2, size * 0.4, size * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Dark edge
    ctx.strokeStyle = `rgba(0,0,0,0.2)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.6 * deco.elongation, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }

  drawPebble(ctx, x, y, deco) {
    const grey = Math.floor(50 + deco.shade * 50);
    const size = deco.size;
    
    // Simple small circle
    ctx.fillStyle = `rgb(${grey}, ${grey + 3}, ${grey + 6})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Tiny highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLightMask(ctx, centerX, centerY, levelRadius, engine) {
    // The world beyond the light is a soft, drifting field of pastel CLOUDS —
    // never darkness. Expanding the light dissolves the clouds and reveals
    // the meadow underneath.
    //
    // The composition is built on an OFFSCREEN canvas (one cloud field +
    // a destination-out cutout for the lit area), then blitted back over
    // the world. Doing the cutout offscreen is critical — applying
    // destination-out directly on the world ctx would erase the entities
    // sitting in the lit area (player, Glimmers, Compies).
    const tileW = this.tileSize;
    const pxRadius = levelRadius * tileW * 1.5;
    const cw = engine.canvas.width;
    const ch = engine.canvas.height;
    const zoom = engine.camera.zoom;

    // ── LOW-SPEC FAST PATH ────────────────────────────────────────────
    // Skip the 50+ blob procedural cloud field + offscreen blit entirely.
    // Instead draw a single radial gradient directly onto the world ctx —
    // soft pink at the far edges, transparent at the lit centre. Same
    // visual intent (no darkness), a fraction of the GPU work.
    if (window._lowSpecMode) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const screenCenterX = (centerX - engine.camera.x) * zoom + cw / 2;
      const screenCenterY = (centerY - engine.camera.y) * zoom + ch / 2;
      const screenRadius  = pxRadius * zoom;
      const grd = ctx.createRadialGradient(
        screenCenterX, screenCenterY, screenRadius * 0.4,
        screenCenterX, screenCenterY, screenRadius * 1.2
      );
      grd.addColorStop(0,   'rgba(253, 230, 241, 0)');
      grd.addColorStop(0.7, 'rgba(253, 230, 241, 0.85)');
      grd.addColorStop(1,   'rgba(244, 179, 218, 1)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
      return;
    }

    // Reuse the offscreen canvas across frames; resize on canvas change.
    if (!this._cloudCanvas) this._cloudCanvas = document.createElement('canvas');
    const cc = this._cloudCanvas;
    if (cc.width !== cw)  cc.width  = cw;
    if (cc.height !== ch) cc.height = ch;
    const cctx = cc.getContext('2d');
    cctx.clearRect(0, 0, cw, ch);

    // Helper — world → screen (screen-space pixels on the offscreen canvas).
    const toScrX = (wx) => (wx - engine.camera.x) * zoom + cw / 2;
    const toScrY = (wy) => (wy - engine.camera.y) * zoom + ch / 2;
    const screenCenterX = toScrX(centerX);
    const screenCenterY = toScrY(centerY);
    const screenRadius  = pxRadius * zoom;

    // ── 1. Cloud field ────────────────────────────────────────────────────
    // Soft pastel base.
    cctx.fillStyle = '#fde6f1';
    cctx.fillRect(0, 0, cw, ch);

    // Six pastel colours layered as soft drifting blobs.
    const palette = [
      'rgba(244, 179, 218, 0.55)',  // pink
      'rgba(196, 222, 255, 0.55)',  // sky blue
      'rgba(255, 226, 173, 0.50)',  // peach
      'rgba(214, 196, 255, 0.55)',  // lavender
      'rgba(189, 239, 199, 0.50)',  // mint
      'rgba(255, 244, 197, 0.50)',  // cream
    ];

    const t = Date.now() / 9000;
    // Blob anchors live in WORLD space so they don't shimmy with the camera;
    // we just convert the centre to screen space when drawing each blob.
    const worldStepX = (pxRadius * 0.55 * 0.85) / zoom;
    const worldStepY = worldStepX;
    const worldL = engine.camera.x - cw / 2 / zoom;
    const worldR = engine.camera.x + cw / 2 / zoom;
    const worldT = engine.camera.y - ch / 2 / zoom;
    const worldB = engine.camera.y + ch / 2 / zoom;
    const xs = Math.floor(worldL / worldStepX) - 1;
    const xe = Math.ceil (worldR / worldStepX) + 1;
    const ys = Math.floor(worldT / worldStepY) - 1;
    const ye = Math.ceil (worldB / worldStepY) + 1;
    for (let gx = xs; gx <= xe; gx++) {
      for (let gy = ys; gy <= ye; gy++) {
        const seed = this.seededRandom(gx, gy, 17);
        const phase = seed * Math.PI * 2;
        const driftW = worldStepX * 0.18;
        const wcx = gx * worldStepX + Math.sin(t + phase) * driftW;
        const wcy = gy * worldStepY + Math.cos(t * 0.8 + phase) * driftW;
        const r = (pxRadius * 0.55) * (0.7 + seed * 0.6) * zoom;
        const sx = toScrX(wcx);
        const sy = toScrY(wcy);
        // Colour is keyed off the cell's stable world coords, not the loop
        // index — otherwise blobs swap colour as the camera scrolls and the
        // iteration window changes which cells are visited first.
        const colorSeed = this.seededRandom(gx, gy, 31);
        const col = palette[Math.floor(colorSeed * palette.length) % palette.length];
        const grd = cctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grd.addColorStop(0,   col);
        grd.addColorStop(0.6, col.replace(/[\d.]+\)$/, '0.30)'));
        grd.addColorStop(1,   'rgba(255,255,255,0)');
        cctx.fillStyle = grd;
        cctx.beginPath();
        cctx.arc(sx, sy, r, 0, Math.PI * 2);
        cctx.fill();
      }
    }

    // ── 2. Cut a soft hole over the lit area on the offscreen layer ──────
    cctx.globalCompositeOperation = 'destination-out';
    const cut = cctx.createRadialGradient(
      screenCenterX, screenCenterY, screenRadius * 0.25,
      screenCenterX, screenCenterY, screenRadius * 1.05
    );
    cut.addColorStop(0,   'rgba(0,0,0,1)');
    cut.addColorStop(0.8, 'rgba(0,0,0,0.85)');
    cut.addColorStop(1,   'rgba(0,0,0,0)');
    cctx.fillStyle = cut;
    cctx.fillRect(0, 0, cw, ch);
    cctx.globalCompositeOperation = 'source-over';

    // ── 3. Blit the masked cloud field over the world (screen space). ────
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cc, 0, 0);
    ctx.restore();
  }
}
