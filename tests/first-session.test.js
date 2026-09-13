import test from 'node:test';
import assert from 'node:assert/strict';

import { B, ITEMS, CHUNK_SIZE } from '../src/utils/constants.js';
import { Inventory } from '../src/systems/Inventory.js';
import { FirstSessionGuide } from '../src/systems/FirstSessionGuide.js';
import { World } from '../src/world/World.js';

function input(overrides = {}) {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    yaw: 0,
    pitch: 0,
    ...overrides,
  };
}

function advanceToPlacement(guide, inventory, { isDay = true } = {}) {
  guide.update({ input: input({ forward: true, jump: true }), inventory, inventoryOpen: false, isDay });
  guide.update({ input: input({ yaw: 0.1 }), inventory, inventoryOpen: false, isDay });
  assert.equal(guide.step, 'wood');

  inventory.addItem(B.OAK_LOG, 2);
  guide.update({ inventory, inventoryOpen: false, isDay });
  assert.equal(guide.step, 'inventory');

  guide.update({ inventory, inventoryOpen: true, isDay });
  assert.equal(guide.step, 'planks');

  inventory.addItem(B.OAK_PLANKS, 4);
  guide.update({ inventory, inventoryOpen: true, isDay });
  assert.equal(guide.step, 'sticks');

  inventory.addItem(ITEMS.STICK, 4);
  guide.update({ inventory, inventoryOpen: true, isDay });
  assert.equal(guide.step, 'pickaxe');

  inventory.addItem(ITEMS.WOODEN_PICKAXE, 1);
  guide.update({ inventory, inventoryOpen: true, isDay });
  assert.equal(guide.step, 'equip');

  const pickaxeSlot = inventory.hotbarSlots().findIndex(slot => slot.id === ITEMS.WOODEN_PICKAXE);
  assert.notEqual(pickaxeSlot, -1);
  inventory.selectSlot(pickaxeSlot);
  guide.update({ inventory, inventoryOpen: false, isDay });
  assert.equal(guide.step, 'stone');

  inventory.addItem(B.COBBLESTONE, 3);
  guide.update({ inventory, inventoryOpen: false, isDay });
  assert.equal(guide.step, 'place');
}

test('first-session fundamentals require move, look, and jump before gathering', () => {
  const guide = new FirstSessionGuide();
  const inventory = new Inventory();

  guide.update({
    input: input({ forward: true, jump: false }),
    inventory,
    inventoryOpen: false,
    isDay: true,
  });
  guide.update({
    input: input({ yaw: 0.1 }),
    inventory,
    inventoryOpen: false,
    isDay: true,
  });

  assert.equal(guide.step, 'bearings', 'jump is a demonstrated fundamental, not decorative progress');

  guide.update({
    input: input({ jump: true, yaw: 0.1 }),
    inventory,
    inventoryOpen: false,
    isDay: true,
  });
  assert.equal(guide.step, 'wood');
});

test('first-session progression reaches the forge goal through real inventory state', () => {
  const guide = new FirstSessionGuide();
  const inventory = new Inventory();

  advanceToPlacement(guide, inventory, { isDay: true });
  guide.onBlockPlaced();
  guide.update({ inventory, inventoryOpen: false, isDay: true });

  assert.equal(guide.step, 'prepare');
  assert.equal(guide.fundamentalsComplete, true);
  assert.equal(guide.allowsHostiles, true);
  assert.match(guide.view(false, inventory).progress, /first forge/i);
});

test('finishing fundamentals after dark stays safe until daylight before hostiles unlock', () => {
  const guide = new FirstSessionGuide();
  const inventory = new Inventory();

  advanceToPlacement(guide, inventory, { isDay: false });
  guide.onBlockPlaced();
  guide.update({ inventory, inventoryOpen: false, isDay: false });

  assert.equal(guide.step, 'prepare');
  assert.equal(guide.allowsHostiles, false);
  assert.match(guide.view(false, inventory).hint, /quiet night/i);

  guide.update({ inventory, inventoryOpen: false, isDay: true });
  assert.equal(guide.allowsHostiles, true, 'daylight arms the following night instead of spawning danger immediately');
});

test('first-session state round-trips without replaying completed mechanics', () => {
  const original = new FirstSessionGuide();
  const inventory = new Inventory();
  advanceToPlacement(original, inventory, { isDay: true });
  original.onBlockPlaced();
  original.update({ inventory, inventoryOpen: false, isDay: true });

  const restored = new FirstSessionGuide();
  assert.equal(restored.load(original.serialize()), true);
  assert.equal(restored.step, 'prepare');
  assert.equal(restored.allowsHostiles, true);
  assert.equal(restored.serialize().placedBlocks, 1);
});

test('returning players skip first-time mechanics and retain normal hostile behavior', () => {
  const guide = new FirstSessionGuide();
  guide.markReturningPlayer();

  assert.equal(guide.step, 'prepare');
  assert.equal(guide.fundamentalsComplete, true);
  assert.equal(guide.allowsHostiles, true);
});

test('fixed seed chooses a resource-bearing spawn with nearby natural wood', () => {
  const world = new World(12345);
  const spawn = world.spawnPoint();
  const sx = Math.floor(spawn.x);
  const sz = Math.floor(spawn.z);

  assert.ok(['forest', 'mountains'].includes(world._biomeAt(sx, sz)));
  const nearbyHeights = [
    world.surfaceAt(sx, sz),
    world.surfaceAt(sx + 1, sz),
    world.surfaceAt(sx - 1, sz),
    world.surfaceAt(sx, sz + 1),
    world.surfaceAt(sx, sz - 1),
  ];
  assert.ok(Math.max(...nearbyHeights) - Math.min(...nearbyHeights) <= 3, 'spawn should not begin on a steep local slope');

  let logs = 0;
  const radius = CHUNK_SIZE;
  for (let x = sx - radius; x <= sx + radius; x++) {
    for (let z = sz - radius; z <= sz + radius; z++) {
      const surface = world.surfaceAt(x, z);
      for (let y = surface + 1; y <= Math.min(surface + 8, 127); y++) {
        if (world.getBlock(x, y, z) === B.OAK_LOG) logs++;
      }
    }
  }

  assert.ok(logs >= 2, `expected at least two nearby Oak Logs, found ${logs}`);
});

test('procedural spawn chunk no longer gives away a crafting table', () => {
  const world = new World(12345);
  const spawn = world.spawnPoint();
  const cx = Math.floor(spawn.x / CHUNK_SIZE);
  const cz = Math.floor(spawn.z / CHUNK_SIZE);
  const data = world.getChunkData(cx, cz);

  assert.equal(Array.from(data).filter(id => id === B.CRAFTING_TABLE).length, 0);
});
