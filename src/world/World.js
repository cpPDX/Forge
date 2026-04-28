import { TILES, BIOME, LAYER, CHUNK_SIZE, WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from '../utils/constants.js';
import { TileRegistry } from '../utils/TileRegistry.js';

// Minimal seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Simple Perlin-like noise via value noise + smoothstep
function makeNoise(seed) {
  const rng = mulberry32(seed);
  const TABLE_SIZE = 512;
  const table = new Float32Array(TABLE_SIZE);
  for (let i = 0; i < TABLE_SIZE; i++) table[i] = rng() * 2 - 1;

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  return function noise1d(x) {
    const xi = Math.floor(x) & (TABLE_SIZE / 2 - 1);
    const xf = x - Math.floor(x);
    return lerp(table[xi], table[xi + 1], fade(xf));
  };
}

function makeFBM(seed, octaves = 4) {
  const ns = [];
  for (let i = 0; i < octaves; i++) ns.push(makeNoise(seed + i * 1337));
  return function fbm(x) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      val += ns[i](x * freq) * amp;
      amp *= 0.5; freq *= 2;
    }
    return val;
  };
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this._chunks = new Map();
    this._surfaceCache = new Map();
    this._dirtyChunks = new Set();

    const s = seed;
    this._surfNoise   = makeFBM(s ^ 0x1234, 4);
    this._biomeNoise  = makeNoise(s ^ 0xABCD);
    this._caveNoise1  = makeFBM(s ^ 0x5678, 3);
    this._caveNoise2  = makeFBM(s ^ 0x9ABC, 3);
    this._oreNoise    = makeNoise(s ^ 0xDEF0);
    this._detailNoise = makeFBM(s ^ 0x2468, 2);
    this._featRng     = mulberry32(s ^ 0x1357);
  }

  getTile(tx, ty) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return TILES.AIR;
    const key = this._chunkKey(tx, ty);
    if (!this._chunks.has(key)) this._generateChunk(tx >> 5, ty >> 5);
    const chunk = this._chunks.get(key);
    return chunk[(ty & 31) << 5 | (tx & 31)];
  }

  setTile(tx, ty, id) {
    if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return;
    const key = this._chunkKey(tx, ty);
    if (!this._chunks.has(key)) this._generateChunk(tx >> 5, ty >> 5);
    const chunk = this._chunks.get(key);
    chunk[(ty & 31) << 5 | (tx & 31)] = id;
    this._dirtyChunks.add(key);
  }

  isSolid(tx, ty) {
    return TileRegistry.isSolid(this.getTile(tx, ty));
  }

  getSurfaceHeight(tx) {
    if (this._surfaceCache.has(tx)) return this._surfaceCache.get(tx);
    const biome = this.getBiome(tx);
    let baseY = 90;
    if (biome === BIOME.DESERT) baseY = 88;
    if (biome === BIOME.SNOW)   baseY = 92;
    if (biome === BIOME.JUNGLE) baseY = 85;
    const h = Math.round(baseY + this._surfNoise(tx / 80) * 20 + this._detailNoise(tx / 20) * 8);
    const clamped = Math.max(LAYER.SURFACE_TOP, Math.min(LAYER.SURFACE_BOTTOM - 1, h));
    this._surfaceCache.set(tx, clamped);
    return clamped;
  }

  getBiome(tx) {
    const v = this._biomeNoise(tx / 400);
    if (v < -0.4)  return BIOME.SNOW;
    if (v < -0.05) return BIOME.FOREST;
    if (v < 0.35)  return BIOME.DESERT;
    return BIOME.JUNGLE;
  }

  getSpawnPoint() {
    const cx = Math.floor(WORLD_WIDTH / 2);
    const sy = this.getSurfaceHeight(cx);
    return { x: cx * TILE_SIZE + TILE_SIZE / 2, y: (sy - 2) * TILE_SIZE };
  }

  // AABB physics — returns { x, y, vx, vy, onGround, onCeiling, onWall }
  moveAndCollide(px, py, pw, ph, mvx, mvy, dt) {
    let x = px, y = py;
    const vx = mvx, vy = mvy;
    let onGround = false, onCeiling = false, onWall = false;

    // Move X
    x += vx * dt;
    if (this._rectOverlap(x, y, pw, ph)) {
      onWall = true;
      if (vx > 0) x = Math.floor((x + pw) / TILE_SIZE) * TILE_SIZE - pw - 0.01;
      else        x = Math.ceil(x / TILE_SIZE) * TILE_SIZE + 0.01;
    }

    // Move Y
    y += vy * dt;
    if (this._rectOverlap(x, y, pw, ph)) {
      if (vy > 0) {
        y = Math.floor((y + ph) / TILE_SIZE) * TILE_SIZE - ph - 0.01;
        onGround = true;
      } else {
        y = Math.ceil(y / TILE_SIZE) * TILE_SIZE + 0.01;
        onCeiling = true;
      }
    }

    return { x, y, vx: onWall ? 0 : vx, vy: (onGround || onCeiling) ? 0 : vy, onGround, onCeiling, onWall };
  }

  _rectOverlap(x, y, w, h) {
    const x1 = Math.floor(x / TILE_SIZE);
    const y1 = Math.floor(y / TILE_SIZE);
    const x2 = Math.floor((x + w - 0.01) / TILE_SIZE);
    const y2 = Math.floor((y + h - 0.01) / TILE_SIZE);
    for (let ty = y1; ty <= y2; ty++) {
      for (let tx = x1; tx <= x2; tx++) {
        if (this.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  _chunkKey(tx, ty) {
    return `${tx >> 5},${ty >> 5}`;
  }

  _generateChunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (this._chunks.has(key)) return;
    const data = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE);
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tx = baseX + lx;
      const surfY = this.getSurfaceHeight(tx);
      const biome = this.getBiome(tx);

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const ty = baseY + ly;
        data[ly << 5 | lx] = this._generateTile(tx, ty, surfY, biome);
      }
    }

    // Place surface features
    this._placeSurfaceFeatures(data, baseX, baseY);

    this._chunks.set(key, data);
  }

  _generateTile(tx, ty, surfY, biome) {
    const depth = ty - surfY;

    // Bedrock
    if (ty >= WORLD_HEIGHT - 3) return TILES.BEDROCK;

    // Sky
    if (ty < surfY) {
      // Water pockets near surface in jungle
      if (biome === BIOME.JUNGLE && depth > -3 && depth < 0 && this._oreNoise(tx / 5 + ty / 3) > 0.7) return TILES.WATER;
      return TILES.AIR;
    }

    // Underworld
    if (ty >= LAYER.CAVERN_BOTTOM) {
      const v = this._caveNoise1(tx / 30) * this._caveNoise2(ty / 20);
      if (v > 0.05 && ty < WORLD_HEIGHT - 3) {
        if (this._oreNoise(tx * 0.1 + ty * 0.07) > 0.6) return TILES.GLOWSTONE;
        if (this._oreNoise(tx * 0.07 + ty * 0.11) > 0.5) return TILES.LAVA;
        return TILES.AIR;
      }
      if (this._oreNoise(tx * 0.05 + ty * 0.08) > 0.85) return TILES.HELLSTONE;
      return TILES.NETHERRACK;
    }

    // Cave carving
    const c1 = this._caveNoise1(tx / 40 + ty / 60);
    const c2 = this._caveNoise2(tx / 55 + ty / 35);
    if (depth > 5 && c1 * c2 > 0.12) return TILES.AIR;

    // Surface tile
    if (depth === 0) {
      if (biome === BIOME.DESERT) return TILES.SAND;
      if (biome === BIOME.SNOW)   return TILES.GRASS_SNOW;
      return TILES.GRASS;
    }

    // Near-surface
    if (depth < 5) {
      if (biome === BIOME.DESERT)  return TILES.SAND;
      if (biome === BIOME.SNOW)    return TILES.SNOW_DIRT;
      return TILES.DIRT;
    }

    // Sandstone under desert sand
    if (biome === BIOME.DESERT && depth < 15) return TILES.SANDSTONE;

    // Ores
    const ov = this._oreNoise(tx * 0.13 + ty * 0.17);
    if (ty >= 50  && ty < 200 && ov > 0.82) return TILES.COAL_ORE;
    if (ty >= 80  && ty < 280 && ov > 0.87) return TILES.IRON_ORE;
    if (ty >= 150 && ty < 350 && ov > 0.91) return TILES.GOLD_ORE;
    if (ty >= 250 && ty < 450 && ov > 0.94) return TILES.DIAMOND_ORE;

    // Clay pockets near surface
    if (depth > 4 && depth < 20 && this._oreNoise(tx * 0.2 + ty * 0.3) > 0.9) return TILES.CLAY;

    // Ice underground in snow biome
    if (biome === BIOME.SNOW && depth < 20 && this._oreNoise(tx * 0.15 + ty * 0.2) > 0.88) return TILES.ICE;

    return TILES.STONE;
  }

  _placeSurfaceFeatures(data, baseX, baseY) {
    const rng = this._featRng;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const tx = baseX + lx;
      const surfY = this.getSurfaceHeight(tx);
      const biome = this.getBiome(tx);
      const ly = surfY - baseY;

      // Only place features that fit in this chunk
      if (ly < 0 || ly >= CHUNK_SIZE) continue;

      // Surface decoration on top of surface tile (ly - 1)
      const decorLy = ly - 1;
      if (decorLy < 0 || decorLy >= CHUNK_SIZE) continue;

      const r = rng();
      if (biome === BIOME.FOREST || biome === BIOME.JUNGLE) {
        if (r < 0.06) {
          // Tree
          this._placeTree(data, baseX, baseY, lx, ly, biome);
        } else if (r < 0.10) {
          data[decorLy << 5 | lx] = TILES.FLOWER_RED;
        } else if (r < 0.14) {
          data[decorLy << 5 | lx] = TILES.FLOWER_YELLOW;
        } else if (r < 0.22) {
          data[decorLy << 5 | lx] = TILES.TALL_GRASS;
        }
      } else if (biome === BIOME.DESERT) {
        if (r < 0.04) {
          // Cactus (2-3 tall)
          const h = Math.floor(rng() * 2) + 2;
          for (let i = 0; i < h; i++) {
            const cly = decorLy - i;
            if (cly >= 0 && cly < CHUNK_SIZE) data[cly << 5 | lx] = TILES.CACTUS;
          }
        }
      } else if (biome === BIOME.SNOW) {
        if (r < 0.05) {
          this._placeTree(data, baseX, baseY, lx, ly, biome);
        }
      }
    }
  }

  _placeTree(data, baseX, baseY, lx, ly, biome) {
    const rng = this._featRng;
    const height = Math.floor(rng() * 3) + 4;
    const log = biome === BIOME.JUNGLE ? TILES.JUNGLE_LOG : biome === BIOME.SNOW ? TILES.PINE_LOG : TILES.OAK_LOG;
    const leaves = biome === BIOME.JUNGLE ? TILES.JUNGLE_LEAVES : biome === BIOME.SNOW ? TILES.PINE_LEAVES : TILES.OAK_LEAVES;

    for (let i = 1; i <= height; i++) {
      const tly = ly - i;
      if (tly >= 0 && tly < CHUNK_SIZE) data[tly << 5 | lx] = log;
    }

    // Leaf crown
    const crownY = ly - height;
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && dy === 1) continue;
        const clx = lx + dx, cly = crownY + dy;
        if (clx < 0 || clx >= CHUNK_SIZE || cly < 0 || cly >= CHUNK_SIZE) continue;
        const idx = cly << 5 | clx;
        if (data[idx] === TILES.AIR) data[idx] = leaves;
      }
    }
  }
}
