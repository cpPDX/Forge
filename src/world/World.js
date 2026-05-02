import { B, CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../utils/constants.js';

const GRAVITY_BLOCKS = new Set([B.SAND, B.GRAVEL]);
import { makeFBM2D, makeFBM3D } from '../utils/noise.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';

function rngSeed(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s>>>0)/0xffffffff; };
}

export class World {
  constructor(seed) {
    this.seed   = seed;
    this._chunks = new Map(); // "cx,cz" → Uint8Array
    this._dirty  = new Set();

    const s = seed;
    this._hNoise    = makeFBM2D(s ^ 0x1234, 6);
    this._biomeN    = makeFBM2D(s ^ 0xABCD, 3);
    this._caveN     = makeFBM3D(s ^ 0x5678, 3);
    this._caveN2    = makeFBM3D(s ^ 0x9012, 3);
    this._oreN      = makeFBM2D(s ^ 0x3456, 2);
    this._featRng   = rngSeed(s ^ 0x7890);
    this._surfCache = new Map();
  }

  // ─── Chunk key & storage ─────────────────────────────────────────────────

  _key(cx, cz) { return `${cx},${cz}`; }

  _idx(lx, ly, lz) { return (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx; }

  _ensure(cx, cz) {
    const k = this._key(cx, cz);
    if (!this._chunks.has(k)) this._generate(cx, cz, k);
    return this._chunks.get(k);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return y < 0 ? B.BEDROCK : B.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return this._ensure(cx, cz)[this._idx(lx, y, lz)];
  }

  setBlock(x, y, z, id, _skipGravity = false) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    this._ensure(cx, cz)[this._idx(lx, y, lz)] = id;
    this._dirty.add(this._key(cx, cz));
    // Neighboring chunks need remesh if block is on border
    if (lx === 0)              this._dirty.add(this._key(cx-1, cz));
    if (lx === CHUNK_SIZE - 1) this._dirty.add(this._key(cx+1, cz));
    if (lz === 0)              this._dirty.add(this._key(cx, cz-1));
    if (lz === CHUNK_SIZE - 1) this._dirty.add(this._key(cx, cz+1));
    // Cascade gravity blocks sitting above newly placed AIR
    if (!_skipGravity && id === B.AIR) this._cascadeGravity(x, y + 1, z);
  }

  _cascadeGravity(x, startY, z) {
    for (let sy = startY; sy < CHUNK_HEIGHT; sy++) {
      const bid = this.getBlock(x, sy, z);
      if (!GRAVITY_BLOCKS.has(bid)) break;
      let landY = sy - 1;
      while (landY >= 0 && this.getBlock(x, landY, z) === B.AIR) landY--;
      landY++; // first open slot above solid
      if (landY < sy) {
        this.setBlock(x, sy,    z, B.AIR, true);
        this.setBlock(x, landY, z, bid,   true);
      }
    }
  }

  isSolid(x, y, z) { return BlockRegistry.isSolid(this.getBlock(x, y, z)); }

  chunkLoaded(cx, cz) { return this._chunks.has(this._key(cx, cz)); }

  getChunkData(cx, cz) { return this._ensure(cx, cz); }

  isDirty(cx, cz) { return this._dirty.has(this._key(cx, cz)); }
  clearDirty(cx, cz) { this._dirty.delete(this._key(cx, cz)); }
  markDirty(cx, cz) { this._dirty.add(this._key(cx, cz)); }

  // ─── Surface height ───────────────────────────────────────────────────────

  surfaceAt(x, z) {
    const k = `${x},${z}`;
    if (this._surfCache.has(k)) return this._surfCache.get(k);
    const biome = this._biomeAt(x, z);
    let h;
    if (biome === 'desert') {
      h = Math.round(SEA_LEVEL - 2 + this._hNoise(x/120, z/120) * 12 + this._hNoise(x/30, z/30)*4);
    } else if (biome === 'snow') {
      h = Math.round(SEA_LEVEL + 4 + this._hNoise(x/100, z/100) * 22 + this._hNoise(x/25, z/25)*6);
    } else if (biome === 'mountains') {
      h = Math.round(SEA_LEVEL + this._hNoise(x/80, z/80) * 40 + this._hNoise(x/20, z/20)*10);
    } else {
      h = Math.round(SEA_LEVEL + this._hNoise(x/100, z/100) * 18 + this._hNoise(x/28, z/28)*5);
    }
    h = Math.max(4, Math.min(CHUNK_HEIGHT - 8, h));
    this._surfCache.set(k, h);
    return h;
  }

  _biomeAt(x, z) {
    const v = this._biomeN(x/400, z/400);
    if (v < -0.35) return 'snow';
    if (v < 0.0)   return 'forest';
    if (v < 0.35)  return 'desert';
    return 'mountains';
  }

  spawnPoint() {
    const sy = this.surfaceAt(0, 0);
    return { x: 0.5, y: sy + 2, z: 0.5 };
  }

  // ─── Chunk generation ─────────────────────────────────────────────────────

  _generate(cx, cz, key) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const bx0  = cx * CHUNK_SIZE;
    const bz0  = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = bx0 + lx, wz = bz0 + lz;
        const surf  = this.surfaceAt(wx, wz);
        const biome = this._biomeAt(wx, wz);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = this._idx(lx, y, lz);
          data[idx] = this._genBlock(wx, y, wz, surf, biome);
        }
      }
    }

    // Surface features (trees etc.) — second pass
    const rng = rngSeed(cx * 73856093 ^ cz * 19349663 ^ this.seed);
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = bx0 + lx, wz = bz0 + lz;
        const surf  = this.surfaceAt(wx, wz);
        const biome = this._biomeAt(wx, wz);
        const top   = data[this._idx(lx, surf, lz)];
        if (top === B.GRASS && rng() < 0.03) {
          this._placeTree(data, lx, surf + 1, lz, bx0, bz0, biome, rng);
        }
        if (top === B.GRASS && rng() < 0.008) {
          // Crafting table on surface for starter
          if (surf + 1 < CHUNK_HEIGHT) data[this._idx(lx, surf+1, lz)] = B.CRAFTING_TABLE;
        }
      }
    }

    this._chunks.set(key, data);
  }

  _genBlock(x, y, z, surf, biome) {
    if (y === 0) return B.BEDROCK;
    if (y < 0)   return B.BEDROCK;

    // Cave carving
    if (y > 0 && y < surf - 1) {
      const c1 = this._caveN(x/20, y/12, z/20);
      const c2 = this._caveN2(x/18, y/14, z/18);
      if (c1 * c2 > 0.11) return B.AIR;
    }

    // Above surface
    if (y > surf) return B.AIR;

    // Surface layer
    if (y === surf) {
      if (biome === 'desert') return B.SAND;
      if (biome === 'snow')   return B.SNOW;
      return B.GRASS;
    }

    const depth = surf - y;

    if (biome === 'desert' && depth < 6) return B.SAND;
    if (biome === 'snow'   && depth < 4) return B.DIRT;
    if (depth < 4) return B.DIRT;

    // Sandstone under desert
    if (biome === 'desert' && depth < 14) return B.SANDSTONE;

    // Ores
    const ov = this._oreN(x * 0.17 + y * 0.13, z * 0.17 + y * 0.11);
    if (y >= 4   && y < 64  && ov > 0.78) return B.COAL_ORE;
    if (y >= 4   && y < 48  && ov > 0.85) return B.IRON_ORE;
    if (y >= 4   && y < 32  && ov > 0.90) return B.GOLD_ORE;
    if (y >= 4   && y < 16  && ov > 0.93) return B.DIAMOND_ORE;

    // Clay pockets near water level
    if (y >= SEA_LEVEL - 4 && y <= SEA_LEVEL && ov > 0.88) return B.CLAY;

    if (y >= 1 && y <= 4) return B.BEDROCK;

    return B.STONE;
  }

  _placeTree(data, lx, baseY, lz, bx0, bz0, biome, rng) {
    const h = Math.floor(rng() * 3) + 4;
    // Trunk
    for (let dy = 0; dy < h; dy++) {
      const y = baseY + dy;
      if (y >= CHUNK_HEIGHT) break;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
        data[this._idx(lx, y, lz)] = B.OAK_LOG;
      }
    }
    // Leaf crown
    const ty = baseY + h;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy >= 0 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          const nx = lx + dx, ny = ty + dy, nz = lz + dz;
          if (nx < 0 || nx >= CHUNK_SIZE || nz < 0 || nz >= CHUNK_SIZE) continue;
          if (ny < 0 || ny >= CHUNK_HEIGHT) continue;
          const idx = this._idx(nx, ny, nz);
          if (data[idx] === B.AIR) data[idx] = B.OAK_LEAVES;
        }
      }
    }
  }

  // Load chunk data (from save)
  loadChunkData(cx, cz, data) {
    this._chunks.set(this._key(cx, cz), new Uint8Array(data));
  }

  // Serialize modified chunks
  serializeChunks(modifiedKeys) {
    const out = {};
    for (const k of modifiedKeys) {
      if (this._chunks.has(k)) out[k] = Array.from(this._chunks.get(k));
    }
    return out;
  }
}
