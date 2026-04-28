import { TILE_SIZE } from '../utils/constants.js';
import { ItemRegistry } from '../utils/ItemRegistry.js';

const GRAVITY    = 300;
const BOUNCE_DAMP = 0.4;
const ATTRACT_DIST = 4 * TILE_SIZE;
const PICKUP_DIST  = 2 * TILE_SIZE;
const LIFETIME     = 60000;

export class Drop {
  constructor(scene, x, y, itemId, count) {
    this.scene   = scene;
    this.x       = x;
    this.y       = y;
    this.vx      = (Math.random() - 0.5) * 80;
    this.vy      = -120;
    this.itemId  = itemId;
    this.count   = count;
    this.collected = false;
    this._life   = LIFETIME;

    const def   = ItemRegistry.get(itemId);
    const color = def?.color ?? 0xffffff;

    const gfx = scene.add.graphics().setDepth(5);
    gfx.fillStyle(0xffffff, 1); gfx.fillRect(-5, -5, 10, 10);
    gfx.fillStyle(color, 1);    gfx.fillRect(-4, -4, 8, 8);
    this._gfx = gfx;
  }

  update(delta, world, player) {
    if (this.collected) return;
    this._life -= delta;
    if (this._life <= 0) { this.destroy(); return; }

    const dt = delta / 1000;

    // Attract to player
    const dx = player.centerX - this.x;
    const dy = player.centerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PICKUP_DIST) {
      const left = player.inv.addItem(this.itemId, this.count);
      this.count = left;
      if (this.count <= 0) { this.destroy(); return; }
    } else if (dist < ATTRACT_DIST) {
      const speed = 200;
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
    }

    // Gravity
    this.vy += GRAVITY * dt;
    this.vy = Math.min(this.vy, 600);

    // Move X
    this.x += this.vx * dt;
    const tx = Math.floor(this.x / TILE_SIZE), ty = Math.floor(this.y / TILE_SIZE);
    if (world.isSolid(tx, ty)) {
      this.x -= this.vx * dt;
      this.vx *= -BOUNCE_DAMP;
    }

    // Move Y
    this.y += this.vy * dt;
    const ty2 = Math.floor(this.y / TILE_SIZE);
    if (world.isSolid(tx, ty2)) {
      this.y -= this.vy * dt;
      if (this.vy > 50) this.vy *= -BOUNCE_DAMP;
      else this.vy = 0;
      this.vx *= 0.85;
    }

    this._gfx.x = this.x;
    this._gfx.y = this.y;
  }

  setScrollFactor(sx, sy) {
    this._gfx.setScrollFactor(sx, sy);
  }

  destroy() {
    this.collected = true;
    this._gfx.destroy();
  }
}
