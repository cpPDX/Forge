import test from 'node:test';
import assert from 'node:assert/strict';

import { B } from '../src/utils/constants.js';
import { Inventory, MAX_STACK } from '../src/systems/Inventory.js';
import { Crafting } from '../src/systems/Crafting.js';
import { DropSystem } from '../src/systems/DropSystem.js';
import { Game } from '../src/game/Game.js';

function fillInventory(inventory, id = B.DIRT, count = MAX_STACK) {
  for (const slot of inventory.allSlots()) {
    slot.id = id;
    slot.count = count;
  }
}

function fakeHud() {
  return {
    updateCraftGrid() {},
    updateCraftOutput() {},
    updateInventoryGrid() {},
    updateHotbar() {},
    setCursorItem() {},
  };
}

test('removeItem is atomic when the requested total is unavailable', () => {
  const inventory = new Inventory();
  inventory.addItem(B.DIRT, 3);

  assert.equal(inventory.removeItem(B.DIRT, 5), false);
  assert.equal(inventory.countOf(B.DIRT), 3);
});

test('addItem enforces the stack limit and preserves overflow in another slot', () => {
  const inventory = new Inventory();

  assert.equal(inventory.addItem(B.DIRT, MAX_STACK + 1), 0);
  const dirtStacks = inventory.allSlots().filter(s => s.id === B.DIRT);
  assert.deepEqual(dirtStacks.map(s => s.count), [MAX_STACK, 1]);
  assert.equal(inventory.countOf(B.DIRT), MAX_STACK + 1);
});

test('legacy overstacked inventory is normalized without losing items', () => {
  const inventory = new Inventory();
  const saved = {
    selectedSlot: 0,
    slots: [[B.DIRT, 70], ...Array.from({ length: 35 }, () => [B.AIR, 0])],
  };

  const overflow = inventory.load(saved);

  assert.deepEqual(overflow, []);
  assert.equal(inventory.countOf(B.DIRT), 70);
  assert.ok(inventory.allSlots().every(s => s.count <= MAX_STACK));
});

test('inventory crafting rolls back ingredients when output cannot fit', () => {
  const inventory = new Inventory();
  fillInventory(inventory);
  inventory.hotbarSlot(0).id = B.OAK_LOG;
  inventory.hotbarSlot(0).count = MAX_STACK;
  const crafting = new Crafting();

  assert.equal(crafting.craftByIndex(0, inventory), false);
  assert.equal(inventory.countOf(B.OAK_LOG), MAX_STACK);
  assert.equal(inventory.countOf(B.OAK_PLANKS), 0);
  assert.ok(inventory.allSlots().every(s => s.count <= MAX_STACK));
});

test('inventory crafting may use the slot freed by consumed ingredients', () => {
  const inventory = new Inventory();
  fillInventory(inventory);
  inventory.hotbarSlot(0).id = B.OAK_LOG;
  inventory.hotbarSlot(0).count = 1;
  const crafting = new Crafting();

  assert.equal(crafting.craftByIndex(0, inventory), true);
  assert.equal(inventory.countOf(B.OAK_LOG), 0);
  assert.equal(inventory.countOf(B.OAK_PLANKS), 4);
});

test('partial ground-drop pickup keeps the exact uncollected remainder', () => {
  const scene = { add() {}, remove() {} };
  const world = { isSolid() { return false; } };
  const drops = new DropSystem(scene, world);
  const inventory = new Inventory();
  fillInventory(inventory);
  inventory.hotbarSlot(0).id = B.AIR;
  inventory.hotbarSlot(0).count = 0;

  const drop = drops.spawn(0, 0, 0, B.STONE, 70);
  drop.age = 1;
  drop.onGround = true;
  drop.baseY = 0;
  drop.vx = drop.vy = drop.vz = 0;
  const player = { x: 0, y: -0.9, z: 0 };

  drops.update(0, player, inventory);
  assert.equal(inventory.countOf(B.STONE), MAX_STACK);
  assert.equal(drop.count, 6);
  assert.equal(drop.dead, false);

  inventory.hotbarSlot(1).id = B.AIR;
  inventory.hotbarSlot(1).count = 0;
  drops.update(0, player, inventory);
  assert.equal(inventory.countOf(B.STONE), 70);
  assert.equal(drops._drops.length, 0);
});

test('inventory UI merge caps the target stack and leaves remainder on cursor', () => {
  const inventory = new Inventory();
  inventory.hotbarSlot(0).id = B.DIRT;
  inventory.hotbarSlot(0).count = 63;
  const game = {
    _inventory: inventory,
    _cursorItem: { id: B.DIRT, count: 10 },
    _hud: fakeHud(),
    _rebindInvGrids: null,
  };

  Game.prototype._handleSlotClick.call(game, 'inv', 27, false);

  assert.equal(inventory.hotbarSlot(0).count, MAX_STACK);
  assert.deepEqual(game._cursorItem, { id: B.DIRT, count: 9 });
});

test('craft-grid merge caps at 64 and preserves cursor remainder', () => {
  const game = {
    _craftGrid: [B.DIRT, B.AIR, B.AIR, B.AIR],
    _craftGridCounts: [63, 0, 0, 0],
    _cursorItem: { id: B.DIRT, count: 10 },
    _hud: fakeHud(),
    _updateCraftOutput() {},
  };

  Game.prototype._handleSlotClick.call(game, 'craft', 0, false);

  assert.equal(game._craftGridCounts[0], MAX_STACK);
  assert.deepEqual(game._cursorItem, { id: B.DIRT, count: 9 });
});

test('manual craft output leaves grid untouched when inventory has no room', () => {
  const inventory = new Inventory();
  fillInventory(inventory);
  const crafting = new Crafting();
  const game = {
    _inventory: inventory,
    _crafting: crafting,
    _craftGrid: [B.OAK_LOG, B.AIR, B.AIR, B.AIR],
    _craftGridCounts: [1, 0, 0, 0],
    _craftResult: { id: B.OAK_PLANKS, count: 4 },
    _cursorItem: null,
    _hud: fakeHud(),
    _rebindInvGrids: null,
    _updateCraftOutput() {},
    _refreshCraftingUI() {},
  };

  Game.prototype._handleSlotClick.call(game, 'output', 0, false);

  assert.equal(game._craftGrid[0], B.OAK_LOG);
  assert.equal(game._craftGridCounts[0], 1);
  assert.deepEqual(game._craftResult, { id: B.OAK_PLANKS, count: 4 });
});

test('closing with a cursor item drops only true inventory overflow', () => {
  const inventory = new Inventory();
  fillInventory(inventory);
  const spawned = [];
  const game = {
    _inventory: inventory,
    _cursorItem: { id: B.STONE, count: 5 },
    _player: { x: 1, y: 2, z: 3 },
    _drops: { spawn(...args) { spawned.push(args); } },
    _hud: fakeHud(),
  };

  Game.prototype._returnCursorItem.call(game);

  assert.equal(game._cursorItem, null);
  assert.equal(inventory.countOf(B.STONE), 0);
  assert.deepEqual(spawned, [[1, 2.75, 3, B.STONE, 5]]);
});
