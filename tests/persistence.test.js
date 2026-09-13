import test from 'node:test';
import assert from 'node:assert/strict';

import { B } from '../src/utils/constants.js';
import { World } from '../src/world/World.js';
import { SaveManager, SAVE_VERSION } from '../src/systems/SaveManager.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test('sparse world edits survive a load, additional edits, and another save', () => {
  const first = new World(12345);
  first.setBlock(1, 70, 1, B.IRON_BLOCK);
  const firstSave = first.serializeEdits();

  assert.deepEqual(Object.keys(firstSave), ['0,0']);
  assert.equal(firstSave['0,0'].length, 2, 'one changed cell should serialize as one index/id pair');

  const second = new World(12345);
  second.loadEdits(firstSave);
  assert.equal(second.getBlock(1, 70, 1), B.IRON_BLOCK);

  second.setBlock(2, 70, 2, B.GOLD_BLOCK);
  const secondSave = second.serializeEdits();

  const third = new World(12345);
  third.loadEdits(secondSave);
  assert.equal(third.getBlock(1, 70, 1), B.IRON_BLOCK);
  assert.equal(third.getBlock(2, 70, 2), B.GOLD_BLOCK);
});

test('legacy full-chunk saves migrate to sparse edits without changing the saved world', () => {
  const legacyWorld = new World(12345);
  legacyWorld.setBlock(3, 70, 3, B.DIAMOND_BLOCK);
  const legacyChunk = Array.from(legacyWorld.getChunkData(0, 0));

  const migrated = new World(12345);
  migrated.loadLegacyChunks({ '0,0': legacyChunk });
  assert.equal(migrated.getBlock(3, 70, 3), B.DIAMOND_BLOCK);

  const sparse = migrated.serializeEdits();
  assert.ok(sparse['0,0'].length < legacyChunk.length, 'migration should not keep a full chunk payload');

  const restored = new World(12345);
  restored.loadEdits(sparse);
  assert.equal(restored.getBlock(3, 70, 3), B.DIAMOND_BLOCK);
});

test('invalid sparse edit payloads fail before mutating the world', () => {
  const world = new World(12345);
  const before = world.getBlock(1, 70, 1);

  assert.throws(
    () => world.loadEdits({ '0,0': [999999, B.STONE] }),
    /Invalid edit entry/,
  );

  assert.equal(world.getBlock(1, 70, 1), before);
  assert.deepEqual(world.serializeEdits(), {});
});

test('SaveManager versions successful saves and normalizes legacy saves', () => {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);

  const result = manager.save({
    version: SAVE_VERSION,
    player: { x: 1, y: 2, z: 3, hp: 20, hunger: 20 },
    inventory: { slots: [], selectedSlot: 0 },
    time: { elapsed: 1000 },
    worldEdits: {},
  });
  assert.equal(result.ok, true);
  assert.equal(manager.load().version, SAVE_VERSION);

  storage.setItem('forge_3d_v1', JSON.stringify({
    player: { x: 1, y: 2, z: 3 },
    inventory: { slots: [], selectedSlot: 0 },
    time: { elapsed: 10 },
    chunks: {},
  }));
  assert.equal(manager.load().version, 1);
});

test('SaveManager reports corrupt, unsupported, and write-failure states', () => {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);

  storage.setItem('forge_3d_v1', '{bad json');
  assert.equal(manager.load(), null);
  assert.ok(manager.lastError instanceof Error);

  storage.setItem('forge_3d_v1', JSON.stringify({ version: 999 }));
  assert.equal(manager.load(), null);
  assert.match(manager.lastError.message, /Unsupported save version/);

  const failing = new SaveManager({
    getItem() { return null; },
    removeItem() {},
    setItem() { throw new Error('quota exceeded'); },
  });
  const failedSave = failing.save({ version: SAVE_VERSION });
  assert.equal(failedSave.ok, false);
  assert.match(failedSave.error.message, /quota exceeded/);
  assert.equal(failing.lastError, failedSave.error);
});
