import { TILE_SIZE, LAYER, TILES } from '../utils/constants.js';
import { TileRegistry } from '../utils/TileRegistry.js';

const RADIUS = 14;
const UPDATE_MS = 100;

export class LightingSystem {
  constructor(scene, world, timeSystem) {
    this.scene = scene;
    this.world = world;
    this.timeSystem = timeSystem;

    this._gfx = scene.add.graphics().setDepth(20).setScrollFactor(0);
    this._elapsed = 0;
    this._lastCamX = -9999;
    this._lastCamY = -9999;
  }

  update(delta, camLeft, camTop, viewW, viewH, zoom) {
    this._elapsed += delta;
    const moved = Math.abs(camLeft - this._lastCamX) > TILE_SIZE || Math.abs(camTop - this._lastCamY) > TILE_SIZE;
    if (this._elapsed < UPDATE_MS && !moved) return;
    this._elapsed = 0;
    this._lastCamX = camLeft;
    this._lastCamY = camTop;

    this._draw(camLeft, camTop, viewW, viewH, zoom);
  }

  _draw(camLeft, camTop, viewW, viewH, zoom) {
    const gfx = this._gfx;
    gfx.clear();

    const ambient = this.timeSystem.ambientLight;
    const tileScreen = TILE_SIZE * zoom;

    const startTX = Math.floor(camLeft / TILE_SIZE);
    const startTY = Math.floor(camTop  / TILE_SIZE);
    const endTX   = Math.ceil((camLeft + viewW) / TILE_SIZE);
    const endTY   = Math.ceil((camTop  + viewH) / TILE_SIZE);

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const light = this._getTileLight(tx, ty, ambient);
        const darkness = 1 - light;
        if (darkness <= 0.02) continue;

        const sx = (tx * TILE_SIZE - camLeft) * zoom;
        const sy = (ty * TILE_SIZE - camTop)  * zoom;
        gfx.fillStyle(0x000000, Math.min(0.98, darkness));
        gfx.fillRect(sx, sy, tileScreen + 1, tileScreen + 1);
      }
    }
  }

  _getTileLight(tx, ty, ambient) {
    // Sky tiles get full ambient light
    if (ty < LAYER.SURFACE_TOP) return ambient;

    // Check if sky-exposed (no solid above within a range)
    let skyExposed = false;
    for (let checkY = ty - 1; checkY >= Math.max(0, ty - 20); checkY--) {
      if (TileRegistry.isSolid(this.world.getTile(tx, checkY))) break;
      if (checkY < LAYER.SURFACE_TOP) { skyExposed = true; break; }
    }
    if (skyExposed) return ambient;

    // Sample local light sources
    let maxLight = 0;
    const r = Math.min(RADIUS, 8); // cap radius for performance
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const emit = TileRegistry.lightEmit(this.world.getTile(tx + dx, ty + dy));
        if (emit === 0) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const contribution = emit / 15 * Math.max(0, 1 - dist / emit);
        if (contribution > maxLight) maxLight = contribution;
      }
    }
    return Math.min(1, maxLight);
  }

  destroy() {
    this._gfx.destroy();
  }
}
