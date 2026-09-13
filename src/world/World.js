import { B, CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../utils/constants.js';

const GRAVITY_BLOCKS = new Set([B.SAND, B.GRAVEL]);
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;
import { makeFBM2D, makeFBM3D } from '../utils/noise.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';

function rngSeed(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s>>>0)/0xffffffff; };
}

function parseChunkKey(key) {
  const parts = String(key).split(',');
  if (parts.length !== 2) throw new Error(`Invalid chunk key: ${key}`);
  const cx = Number(parts[0]), cz = Number(parts[1]);
  if (!Number.isInteger(cx) || !Number.isInteger(cz)) throw new Error(`Invalid chunk key: ${key}`);
  return { key: `${cx},${cz}`, cx, cz };
}

function isBlockId(id) {
  return Number.isInteger(id) && id >= 0 && id <= 255;
}

export class World {
  constructor(seed) {
    this.seed   = seed;
    this._chunks = new Map(); // "cx,cz" → Uint8Array
    this._dirty  = new Set();
    this._edits  = new Map(); // "cx,cz" → Map<chunkIndex, blockId>

    const s = seed;
    this._hNoise    = makeFBM2D(s ^ 0x1234, 6);
    this._biomeN    = makeFBM2D(s ^ 0xABCD, 3);
    this._caveN     = makeFBM3D(s ^ 0x5678, 3);
    this._caveN2    = makeFBM3D(s ^ 0x9012, 3);
    this._oreN      = makeFBM2D(s ^ 0x3456, 2);
    this._surfCache = new Map();
    this._spawnCache = null;
  }

  // ─── Chunk key & storage ─────────────────────────────────────────────────

  _key(cx, cz) { return `${cx},${cz}`; }

  _idx(lx, ly, lz) { return (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx; }

  _ensure(cx, cz) {
    const k = this._key(cx, cz);
    if (!this._chunks.has(k)) this._generate(cx, cz, k);
    return this._chunks.get(k);
  }

  _recordEdit(key, idx, id) {
    let edits = this._edits.get(key);
    if (!edits) {
      edits = new Map();
      this._edits.set(key, edits);
    }
    edits.set(idx, id);
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
    const key = this._key(cx, cz);
    const idx = this._idx(lx, y, lz);
    this._ensure(cx, cz)[idx] = id;
    this._recordEdit(key, idx, id);
    this._dirty.add(key);
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

  // ─── Sparse world persistence ─────────────────────────────────────────────

  serializeEdits() {
    const out = {};
    for (const [key, edits] of this._edits) {
      if (edits.size === 0) continue;
      const flat = [];
      for (const [idx, id] of [...edits.entries()].sort((a, b) => a[0] - b[0])) {
        flat.push(idx, id);
      }
      out[key] = flat;
    }
    return out;
  }

  loadEdits(serialized) {
    if (serialized == null) return;
    if (typeof serialized !== 'object' || Array.isArray(serialized)) {
      throw new Error('Invalid world edit payload');
    }

    // Validate everything before mutating world state.
    const parsed = [];
    for (const [rawKey, flat] of Object.entries(serialized)) {
      const { key, cx, cz } = parseChunkKey(rawKey);
      if (!Array.isArray(flat) || flat.length % 2 !== 0) {
        throw new Error(`Invalid edit list for chunk ${key}`);
      }
      const pairs = [];
      for (let i = 0; i < flat.length; i += 2) {
        const idx = flat[i], id = flat[i + 1];
        if (!Number.isInteger(idx) || idx < 0 || idx >= CHUNK_VOLUME || !isBlockId(id)) {
          throw new Error(`Invalid edit entry for chunk ${key}`);
        }
        pairs.push([idx, id]);
      }
      parsed.push({ key, cx, cz, pairs });
    }

    for (const { key, cx, cz, pairs } of parsed) {
      const data = this._ensure(cx, cz);
      const edits = new Map();
      for (const [idx, id] of pairs) {
        data[idx] = id;
        edits.set(idx, id);
      }
      if (edits.size > 0) this._edits.set(key, edits);
      this._dirty.add(key);
    }
  }

  loadLegacyChunks(chunks) {
    if (chunks == null) return;
    if (typeof chunks !== 'object' || Array.isArray(chunks)) {
      throw new Error('Invalid legacy chunk payload');
    }

    // Validate all legacy chunks first so corrupt data cannot be partially applied.
    const parsed = [];
    for (const [rawKey, rawData] of Object.entries(chunks)) {
      const { key, cx, cz } = parseChunkKey(rawKey);
      if (!Array.isArray(rawData) || rawData.length !== CHUNK_VOLUME) {
        throw new Error(`Invalid legacy chunk length for ${key}`);
      }
      if (!rawData.every(isBlockId)) {
        throw new Error(`Invalid legacy block data for ${key}`);
      }
      parsed.push({ key, cx, cz, data: new Uint8Array(rawData) });
    }

    for (const { key, cx, cz, data: saved } of parsed) {
      const generated = this._ensure(cx, cz);
      const edits = new Map();
      for (let idx = 0; idx < CHUNK_VOLUME; idx++) {
        if (saved[idx] !== generated[idx]) edits.set(idx, saved[idx]);
      }
      this._chunks.set(key, saved);
      if (edits.size > 0) this._edits.set(key, edits);
      this._dirty.add(key);
    }
  }

  // Backward-compatible single-chunk loader for older callers.
  loadChunkData(cx, cz, data) {
    this.loadLegacyChunks({ [this._key(cx, cz)]: data });
  }

  // ─── Surface height / spawn ───────────────────────────────────────────────

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

  _spawnCandidate(x, z) {
    const biome = this._biomeAt(x, z);
    if (biome !== 'forest' && biome !== 'mountains') return null;

    const heights = [
      this.surfaceAt(x, z),
      this.surfaceAt(x + 1, z),
      this.surfaceAt(x - 1, z),
      this.surfaceAt(x, z + 1),
      this.surfaceAt(x, z - 1),
    ];
    if (Math.max(...heights) - Math.min(...heights) > 3) return null;
    return { x, z, y: heights[0] };
  }

  spawnPoint() {
    if (this._spawnCache) return { ...this._spawnCache };

    // The fixed seed's origin is desert and can leave a new player far from wood.
    // Search outward for the nearest reasonably flat grass-bearing biome instead.
    const maxRadius = 96;
    const step = 4;
    for (let radius = 0; radius <= maxRadius; radius += step) {
      const candidates = [];
      if (radius === 0) {
        candidates.push([0, 0]);
      } else {
        for (let x = -radius; x <= radius; x += step) {
          candidates.push([x, -radius], [x, radius]);
        }
        for (let z = -radius + step; z < radius; z += step) {
          candidates.push([-radius, z], [radius, z]);
        }
      }

      let best = null;
      for (const [x, z] of candidates) {
        const candidate = this._spawnCandidate(x, z);
        if (!candidate) continue;
        const dist2 = x*x + z*z;
        if (!best || dist2 < best.dist2) best = { ...candidate, dist2 };
      }
      if (best) {
        this._spawnCache = { x: best.x + 0.5, y: best.y + 2, z: best.z + 0.5 };
        return { ...this._spawnCache };
      }
    }

    // Defensive fallback if a future seed/world config has no suitable nearby biome.
    const sy = this.surfaceAt(0, 0);
    this._spawnCache = { x: 0.5, y: sy + 2, z: 0.5 };
    return { ...this._spawnCache };
  }

  // ─── Chunk generation ─────────────────────────────────────────────────────

  _generate(cx, cz, key) {
    const data = new Uint8Array(CHUNK_VOLUME);
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

    // Ores: evaluate rare/deep tiers first so common coal cannot shadow them.
    const ov = this._oreN(x * 0.17 + y * 0.13, z * 0.17 + y * 0.11);
    if (y >= 4   && y < 16  && ov > 0.92) return B.DIAMOND_ORE;
    if (y >= 4   && y < 32  && ov > 0.90) return B.GOLD_ORE;
    if (y >= 4   && y < 48  && ov > 0.85) return B.IRON_ORE;
    if (y >= 4   && y < 64  && ov > 0.78) return B.COAL_ORE;

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

  // Legacy full-chunk serializer retained for diagnostics/migration tooling.
  serializeChunks(modifiedKeys) {
    const out = {};
    for (const k of modifiedKeys) {
      if (this._chunks.has(k)) out[k] = Array.from(this._chunks.get(k));
    }
    return out;
  }
}
