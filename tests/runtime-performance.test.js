import test from 'node:test';
import assert from 'node:assert/strict';

import { B } from '../src/utils/constants.js';
import { World } from '../src/world/World.js';
import {
  ChunkStreamer,
  evictWorldCacheOutside,
  installHudCaching,
  installWorldCacheLifecycle,
} from '../src/systems/RuntimePerformanceController.js';

function makeInventory() {
  const slots = Array.from({ length: 9 }, () => ({ id: B.AIR, count: 0 }));
  return {
    selectedSlot: 0,
    hotbarSlots() { return slots; },
    slots,
  };
}

test('HUD caching skips unchanged hotbar and status redraw work', () => {
  let hotbarCalls = 0;
  let heartCalls = 0;
  let hungerCalls = 0;
  const hud = {
    _hotbarSlots: Array.from({ length: 9 }, () => ({ clientWidth: 44 })),
    updateHotbar() { hotbarCalls++; },
    _drawHearts() { heartCalls++; },
    _drawHunger() { hungerCalls++; },
  };
  installHudCaching(hud);

  const inventory = makeInventory();
  assert.equal(hud.updateHotbar(inventory), true);
  assert.equal(hud.updateHotbar(inventory), false);
  assert.equal(hotbarCalls, 1);

  inventory.selectedSlot = 1;
  assert.equal(hud.updateHotbar(inventory), true);
  assert.equal(hotbarCalls, 2);

  inventory.slots[1] = { id: B.DIRT, count: 3 };
  assert.equal(hud.updateHotbar(inventory), true);
  assert.equal(hotbarCalls, 3);

  assert.equal(hud._drawHearts(20), true);
  assert.equal(hud._drawHearts(20), false);
  assert.equal(hud._drawHearts(19), true);
  assert.equal(heartCalls, 2);

  assert.equal(hud._drawHunger(20), true);
  assert.equal(hud._drawHunger(20), false);
  assert.equal(hud._drawHunger(18), true);
  assert.equal(hungerCalls, 2);
});

function makeStreamingFakes() {
  const updates = [];
  const disposals = [];
  const mesh = {
    _meshes: new Map(),
    hasMesh(cx, cz) { return this._meshes.has(`${cx},${cz}`); },
    update(cx, cz) {
      updates.push(`${cx},${cz}`);
      this._meshes.set(`${cx},${cz}`, {});
    },
    _dispose(cx, cz) {
      disposals.push(`${cx},${cz}`);
      this._meshes.delete(`${cx},${cz}`);
    },
  };

  let dirtyChecks = 0;
  const world = {
    _dirty: new Set(),
    _chunks: new Map(),
    _surfCache: new Map(),
    isDirty(cx, cz) {
      dirtyChecks++;
      return this._dirty.has(`${cx},${cz}`);
    },
    clearDirty(cx, cz) { this._dirty.delete(`${cx},${cz}`); },
  };

  return {
    mesh,
    world,
    updates,
    disposals,
    dirtyChecks: () => dirtyChecks,
  };
}

test('chunk streaming amortizes initial mesh work and prioritizes the player center', () => {
  const fake = makeStreamingFakes();
  const streamer = new ChunkStreamer(fake.mesh, fake.world, {
    renderDistance: 1,
    meshBudget: 2,
    cacheRadius: 2,
  });

  assert.equal(streamer.update(0, 0), 2);
  assert.equal(fake.updates.length, 2);
  assert.equal(fake.updates[0], '0,0', 'nearest center chunk should mesh first');
  assert.equal(streamer.pendingCount(), 7);

  streamer.update(0, 0);
  assert.equal(fake.updates.length, 4, 'only two additional meshes should be built per frame');
});

test('stationary streaming does no full-neighborhood rescan after the queue drains', () => {
  const fake = makeStreamingFakes();
  const streamer = new ChunkStreamer(fake.mesh, fake.world, {
    renderDistance: 1,
    meshBudget: 20,
    cacheRadius: 2,
  });

  streamer.update(0, 0);
  assert.equal(streamer.pendingCount(), 0);
  const checksAfterInitial = fake.dirtyChecks();
  const updatesAfterInitial = fake.updates.length;

  assert.equal(streamer.update(0, 0), 0);
  assert.equal(fake.dirtyChecks(), checksAfterInitial, 'unchanged center with no dirty chunks should not rescan 3×3 neighborhood');
  assert.equal(fake.updates.length, updatesAfterInitial);
});

test('visible dirty chunks are queued promptly without rebuilding the full neighborhood', () => {
  const fake = makeStreamingFakes();
  const streamer = new ChunkStreamer(fake.mesh, fake.world, {
    renderDistance: 1,
    meshBudget: 20,
    cacheRadius: 2,
  });
  streamer.update(0, 0);
  const checksAfterInitial = fake.dirtyChecks();

  fake.world._dirty.add('1,0');
  assert.equal(streamer.update(0, 0), 1);
  assert.equal(fake.updates.at(-1), '1,0');
  assert.equal(fake.dirtyChecks(), checksAfterInitial + 1, 'only queued dirty work should require an isDirty check');
});

test('center changes unload far meshes and evict generated world cache outside the retention radius', () => {
  const fake = makeStreamingFakes();
  fake.mesh._meshes.set('-5,0', {});
  fake.world._chunks.set('-5,0', new Uint8Array(1));
  fake.world._chunks.set('3,0', new Uint8Array(1));
  fake.world._surfCache.set('-80,0', 60);
  fake.world._surfCache.set('48,0', 60);

  const streamer = new ChunkStreamer(fake.mesh, fake.world, {
    renderDistance: 1,
    meshBudget: 1,
    cacheRadius: 2,
  });
  streamer.update(3, 0);

  assert.ok(fake.disposals.includes('-5,0'));
  assert.equal(fake.world._chunks.has('-5,0'), false);
  assert.equal(fake.world._chunks.has('3,0'), true);
  assert.equal(fake.world._surfCache.has('-80,0'), false);
  assert.equal(fake.world._surfCache.has('48,0'), true);
});

test('evicted edited chunks regenerate deterministically and replay sparse edits', () => {
  const world = new World(12345);
  installWorldCacheLifecycle(world);

  const x = 0, y = 10, z = 0;
  world.setBlock(x, y, z, B.GOLD_BLOCK);
  assert.equal(world.getBlock(x, y, z), B.GOLD_BLOCK);
  assert.equal(world._edits.has('0,0'), true);

  // Populate far cache, then retain only the far area so the edited origin chunk is evicted.
  world.getChunkData(10, 10);
  world.surfaceAt(160, 160);
  const result = evictWorldCacheOutside(world, 10, 10, 1);
  assert.ok(result.chunks >= 1);
  assert.equal(world._chunks.has('0,0'), false);
  assert.equal(world._edits.has('0,0'), true, 'sparse durable edits must survive cache eviction');

  assert.equal(world.getBlock(x, y, z), B.GOLD_BLOCK, 'regenerated chunk should replay the persisted sparse edit');
});
