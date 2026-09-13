import { CHUNK_SIZE, RENDER_DIST } from '../utils/constants.js';

export const CHUNK_MESH_BUDGET = 2;
export const WORLD_CACHE_RADIUS = RENDER_DIST + 3;

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function parseChunkKey(key) {
  const [cx, cz] = String(key).split(',').map(Number);
  return Number.isInteger(cx) && Number.isInteger(cz) ? { cx, cz } : null;
}

function inRadius(cx, cz, centerCx, centerCz, radius) {
  return Math.abs(cx - centerCx) <= radius && Math.abs(cz - centerCz) <= radius;
}

export function installHudCaching(hud) {
  if (!hud || hud._runtimeCachingInstalled) return hud;
  hud._runtimeCachingInstalled = true;

  const originalHotbar = hud.updateHotbar.bind(hud);
  let hotbarSignature = null;
  hud.updateHotbar = inventory => {
    const slots = inventory.hotbarSlots();
    const widths = hud._hotbarSlots?.map(el => el?.clientWidth ?? 0) ?? [];
    const signature = `${inventory.selectedSlot}|${slots.map(slot => `${slot.id}:${slot.count}`).join(',')}|${widths.join(',')}`;
    if (signature === hotbarSignature) return false;
    hotbarSignature = signature;
    originalHotbar(inventory);
    return true;
  };

  const originalHearts = hud._drawHearts.bind(hud);
  let lastHp = null;
  hud._drawHearts = hp => {
    if (hp === lastHp) return false;
    lastHp = hp;
    originalHearts(hp);
    return true;
  };

  const originalHunger = hud._drawHunger.bind(hud);
  let lastHunger = null;
  hud._drawHunger = hunger => {
    if (hunger === lastHunger) return false;
    lastHunger = hunger;
    originalHunger(hunger);
    return true;
  };

  return hud;
}

export function installWorldCacheLifecycle(world) {
  if (!world || world._runtimeCacheLifecycleInstalled) return world;
  if (typeof world._ensure !== 'function') return world;

  world._runtimeCacheLifecycleInstalled = true;
  const originalEnsure = world._ensure.bind(world);

  // Generated chunks are disposable cache. Sparse edits are the durable world
  // state, so replay them whenever an evicted chunk is regenerated.
  world._ensure = (cx, cz) => {
    const key = typeof world._key === 'function' ? world._key(cx, cz) : chunkKey(cx, cz);
    const wasLoaded = world._chunks?.has(key) === true;
    const data = originalEnsure(cx, cz);
    if (!wasLoaded) {
      const edits = world._edits?.get(key);
      if (edits) {
        for (const [idx, id] of edits) data[idx] = id;
      }
    }
    return data;
  };

  return world;
}

export function evictWorldCacheOutside(world, centerCx, centerCz, radius = WORLD_CACHE_RADIUS) {
  if (!world) return { chunks: 0, surfaces: 0 };
  let chunks = 0;
  let surfaces = 0;

  if (world._chunks instanceof Map) {
    for (const key of [...world._chunks.keys()]) {
      const parsed = parseChunkKey(key);
      if (!parsed || inRadius(parsed.cx, parsed.cz, centerCx, centerCz, radius)) continue;
      world._chunks.delete(key);
      world._dirty?.delete?.(key);
      chunks++;
    }
  }

  if (world._surfCache instanceof Map) {
    for (const key of [...world._surfCache.keys()]) {
      const parsed = parseChunkKey(key);
      if (!parsed) continue;
      const cx = Math.floor(parsed.cx / CHUNK_SIZE);
      const cz = Math.floor(parsed.cz / CHUNK_SIZE);
      if (inRadius(cx, cz, centerCx, centerCz, radius)) continue;
      world._surfCache.delete(key);
      surfaces++;
    }
  }

  return { chunks, surfaces };
}

export class ChunkStreamer {
  constructor(chunkMesh, world, {
    renderDistance = RENDER_DIST,
    meshBudget = CHUNK_MESH_BUDGET,
    cacheRadius = WORLD_CACHE_RADIUS,
  } = {}) {
    this._chunkMesh = chunkMesh;
    this._world = world;
    this._renderDistance = renderDistance;
    this._meshBudget = Math.max(1, Math.floor(meshBudget));
    this._cacheRadius = Math.max(renderDistance + 1, Math.floor(cacheRadius));
    this._centerCx = null;
    this._centerCz = null;
    this._queue = [];
    this._queued = new Set();
  }

  update(centerCx, centerCz) {
    const centerChanged = centerCx !== this._centerCx || centerCz !== this._centerCz;
    if (centerChanged) {
      this._centerCx = centerCx;
      this._centerCz = centerCz;
      this._rebuildQueue();
      this._unloadFarMeshes();
      evictWorldCacheOutside(this._world, centerCx, centerCz, this._cacheRadius);
    } else {
      this._queueVisibleDirty();
    }

    return this._processBudget();
  }

  pendingCount() {
    return this._queue.length;
  }

  _distanceSq(cx, cz) {
    const dx = cx - this._centerCx;
    const dz = cz - this._centerCz;
    return dx * dx + dz * dz;
  }

  _rebuildQueue() {
    this._queue = [];
    this._queued.clear();
    const radius = this._renderDistance;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = this._centerCx + dx;
        const cz = this._centerCz + dz;
        if (!this._chunkMesh.hasMesh(cx, cz) || this._world.isDirty(cx, cz)) {
          const key = chunkKey(cx, cz);
          this._queue.push({ key, cx, cz, dirty: this._world.isDirty(cx, cz) });
          this._queued.add(key);
        }
      }
    }

    this._queue.sort((a, b) => {
      if (a.dirty !== b.dirty) return a.dirty ? -1 : 1;
      return this._distanceSq(a.cx, a.cz) - this._distanceSq(b.cx, b.cz);
    });
  }

  _queueVisibleDirty() {
    if (!(this._world._dirty instanceof Set) || this._world._dirty.size === 0) return;
    const additions = [];

    for (const key of this._world._dirty) {
      if (this._queued.has(key)) continue;
      const parsed = parseChunkKey(key);
      if (!parsed || !inRadius(parsed.cx, parsed.cz, this._centerCx, this._centerCz, this._renderDistance)) continue;
      additions.push({ key, cx: parsed.cx, cz: parsed.cz, dirty: true });
      this._queued.add(key);
    }

    additions.sort((a, b) => this._distanceSq(a.cx, a.cz) - this._distanceSq(b.cx, b.cz));
    if (additions.length > 0) this._queue = [...additions, ...this._queue];
  }

  _processBudget() {
    let processed = 0;
    while (processed < this._meshBudget && this._queue.length > 0) {
      const entry = this._queue.shift();
      this._queued.delete(entry.key);
      if (!this._chunkMesh.hasMesh(entry.cx, entry.cz) || this._world.isDirty(entry.cx, entry.cz)) {
        this._chunkMesh.update(entry.cx, entry.cz, this._world);
        this._world.clearDirty(entry.cx, entry.cz);
        processed++;
      }
    }
    return processed;
  }

  _unloadFarMeshes() {
    const radius = this._renderDistance + 1;
    for (const [key] of [...this._chunkMesh._meshes]) {
      const parsed = parseChunkKey(key);
      if (!parsed) continue;
      if (!inRadius(parsed.cx, parsed.cz, this._centerCx, this._centerCz, radius)) {
        this._chunkMesh._dispose(parsed.cx, parsed.cz);
      }
    }
  }
}

export class RuntimePerformanceController {
  constructor(game) {
    this._game = game;
    this._streamer = null;
  }

  init() {
    installHudCaching(this._game._hud);
    installWorldCacheLifecycle(this._game._world);

    this._streamer = new ChunkStreamer(this._game._chunkMesh, this._game._world);
    this._game._streamChunks = () => {
      const cx = Math.floor(this._game._player.x / CHUNK_SIZE);
      const cz = Math.floor(this._game._player.z / CHUNK_SIZE);
      this._streamer.update(cx, cz);
    };
    this._game._runtimePerformanceController = this;
    return this;
  }
}
