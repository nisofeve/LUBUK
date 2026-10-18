export class Engine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Core timing
    this.lastTime = performance.now();
    this.deltaTime = 0;
    this.elapsedSeconds = 0;
    
    // Camera
    this.camera = { x: 0, y: 0, zoom: 1 };
    
    // Resize handler
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Input state
    this.input = {
      x: 0, y: 0, isDown: false,
      worldX: 0, worldY: 0
    };

    // Binding interaction
    this.canvas.addEventListener('pointerdown', (e) => this.handleInput(e, true));
    this.canvas.addEventListener('pointerup', (e) => this.handleInput(e, false));
    this.canvas.addEventListener('pointermove', (e) => this.handleInput(e, this.input.isDown));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  handleInput(e, isDown) {
    this.input.isDown = isDown;
    this.input.x = e.clientX;
    this.input.y = e.clientY;
    
    // Convert screen back to world coordinates based on camera (inverse projection)
    this.input.worldX = (this.input.x - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
    this.input.worldY = (this.input.y - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
  }

  clear() {
    // Soft pastel sky behind everything — the cloud field on top blends into this.
    this.ctx.fillStyle = '#fde6f1';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // To be overridden
  update(dt) {}
  draw(ctx) {}

  loop(timestamp) {
    if (!this.running) return;   // stopped by stop() — drop this frame and the rAF chain
    this.deltaTime = (timestamp - this.lastTime) / 1000; // in seconds
    // Cap dt for lag spikes
    if (this.deltaTime > 0.1) this.deltaTime = 0.1;
    this.lastTime = timestamp;
    this.elapsedSeconds += this.deltaTime;

    this.update(this.deltaTime);
    
    this.clear();
    
    // Setup Camera Matrix
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    this.draw(this.ctx);

    this.ctx.restore();
    
    requestAnimationFrame((ts) => this.loop(ts));
  }

  start() {
    this.lastTime = performance.now();
    this.running = true;
    requestAnimationFrame((ts) => this.loop(ts));
  }

  stop() {
    this.running = false;
  }
}
