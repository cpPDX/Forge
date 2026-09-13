import test from 'node:test';
import assert from 'node:assert/strict';

import { B, ITEMS } from '../src/utils/constants.js';
import { Inventory, MAX_STACK } from '../src/systems/Inventory.js';
import { Crafting } from '../src/systems/Crafting.js';
import { ForgeSystem, FORGE_TIERS } from '../src/systems/ForgeSystem.js';

const POS = [4, 70, -2];

function inventoryWith(items = []) {
  const inventory = new Inventory();
  for (const [id, count] of items) inventory.addItem(id, count);
  return inventory;
}

test('new forge stations begin at Stone tier with iron refining only', () => {
  const forge = new ForgeSystem();
  const station = forge.station(POS);

  assert.equal(station.tier, FORGE_TIERS.STONE);
  assert.equal(station.tierName, 'Stone Forge');
  assert.deepEqual(forge.refiningOptions(POS).map(r => r.id), ['iron']);
  assert.deepEqual(forge.craftingOptions(POS), []);
});

test('Stone Forge consumes exactly one iron ore and one coal and finishes after four seconds', () => {
  const forge = new ForgeSystem();
  const inventory = inventoryWith([[B.IRON_ORE, 2], [B.COAL_ORE, 2]]);

  assert.equal(forge.startRefining(POS, 'iron', inventory), true);
  assert.equal(inventory.countOf(B.IRON_ORE), 1);
  assert.equal(inventory.countOf(B.COAL_ORE), 1);

  forge.update(3.9);
  assert.equal(forge.station(POS).output, null);
  assert.ok(forge.station(POS).job);

  forge.update(0.1);
  const station = forge.station(POS);
  assert.equal(station.job, null);
  assert.deepEqual(station.output, { id: ITEMS.IRON_INGOT, count: 1 });
});

test('refined output remains buffered until inventory can collect it', () => {
  const forge = new ForgeSystem();
  const inventory = inventoryWith([[B.IRON_ORE, 1], [B.COAL_ORE, 1]]);
  assert.equal(forge.startRefining(POS, 'iron', inventory), true);
  forge.update(4);

  const full = new Inventory();
  for (const slot of full.allSlots()) {
    slot.id = B.DIRT;
    slot.count = MAX_STACK;
  }
  assert.equal(forge.collectOutput(POS, full), 0);
  assert.deepEqual(forge.station(POS).output, { id: ITEMS.IRON_INGOT, count: 1 });

  full.hotbarSlot(0).id = B.AIR;
  full.hotbarSlot(0).count = 0;
  assert.equal(forge.collectOutput(POS, full), 1);
  assert.equal(full.countOf(ITEMS.IRON_INGOT), 1);
  assert.equal(forge.station(POS).output, null);
});

test('Stone Forge cannot refine gold or forge iron equipment', () => {
  const forge = new ForgeSystem();
  const inventory = inventoryWith([
    [B.GOLD_ORE, 3],
    [B.COAL_ORE, 3],
    [ITEMS.IRON_INGOT, 8],
    [ITEMS.STICK, 4],
  ]);

  assert.equal(forge.startRefining(POS, 'gold', inventory), false);
  assert.equal(forge.craft(POS, 'iron-pickaxe', inventory), false);
  assert.equal(inventory.countOf(B.GOLD_ORE), 3);
  assert.equal(inventory.countOf(ITEMS.IRON_INGOT), 8);
});

test('Stone to Iron upgrade requires processed iron and is atomic', () => {
  const forge = new ForgeSystem();
  const insufficient = inventoryWith([[ITEMS.IRON_INGOT, 5], [B.COBBLESTONE, 4]]);

  assert.equal(forge.upgrade(POS, insufficient), false);
  assert.equal(insufficient.countOf(ITEMS.IRON_INGOT), 5);
  assert.equal(insufficient.countOf(B.COBBLESTONE), 4);
  assert.equal(forge.station(POS).tier, FORGE_TIERS.STONE);

  const enough = inventoryWith([[ITEMS.IRON_INGOT, 6], [B.COBBLESTONE, 4]]);
  assert.equal(forge.upgrade(POS, enough), true);
  assert.equal(enough.countOf(ITEMS.IRON_INGOT), 0);
  assert.equal(enough.countOf(B.COBBLESTONE), 0);
  assert.equal(forge.station(POS).tier, FORGE_TIERS.IRON);
  assert.deepEqual(forge.refiningOptions(POS).map(r => r.id), ['iron', 'gold']);
  assert.deepEqual(forge.craftingOptions(POS).map(r => r.id), ['iron-pickaxe', 'iron-sword']);
});

test('Iron Forge crafts equipment from ingots, never raw ore', () => {
  const forge = new ForgeSystem();
  const upgradeInventory = inventoryWith([[ITEMS.IRON_INGOT, 6], [B.COBBLESTONE, 4]]);
  assert.equal(forge.upgrade(POS, upgradeInventory), true);

  const rawOnly = inventoryWith([[B.IRON_ORE, 20], [ITEMS.STICK, 10]]);
  assert.equal(forge.craft(POS, 'iron-pickaxe', rawOnly), false);
  assert.equal(rawOnly.countOf(B.IRON_ORE), 20);

  const processed = inventoryWith([[ITEMS.IRON_INGOT, 3], [ITEMS.STICK, 2]]);
  assert.equal(forge.craft(POS, 'iron-pickaxe', processed), true);
  assert.equal(processed.countOf(ITEMS.IRON_INGOT), 0);
  assert.equal(processed.countOf(ITEMS.STICK), 0);
  assert.equal(processed.countOf(ITEMS.IRON_PICKAXE), 1);
});

test('Master Forge unlocks diamond refining and diamond equipment', () => {
  const forge = new ForgeSystem();
  const firstUpgrade = inventoryWith([[ITEMS.IRON_INGOT, 6], [B.COBBLESTONE, 4]]);
  assert.equal(forge.upgrade(POS, firstUpgrade), true);

  const secondUpgrade = inventoryWith([
    [ITEMS.GOLD_INGOT, 4],
    [ITEMS.IRON_INGOT, 4],
    [B.DIAMOND_ORE, 2],
  ]);
  assert.equal(forge.upgrade(POS, secondUpgrade), true);
  assert.equal(forge.station(POS).tier, FORGE_TIERS.MASTER);
  assert.deepEqual(forge.refiningOptions(POS).map(r => r.id), ['iron', 'gold', 'diamond']);
  assert.deepEqual(forge.craftingOptions(POS).map(r => r.id), [
    'iron-pickaxe',
    'iron-sword',
    'diamond-pickaxe',
    'diamond-sword',
  ]);

  const refineInventory = inventoryWith([[B.DIAMOND_ORE, 1], [B.COAL_ORE, 1]]);
  assert.equal(forge.startRefining(POS, 'diamond', refineInventory), true);
  forge.update(6);
  assert.deepEqual(forge.station(POS).output, { id: ITEMS.REFINED_DIAMOND, count: 1 });
});

test('forge equipment crafting rolls back when result cannot fit after ingredients are consumed', () => {
  const forge = new ForgeSystem();
  const upgradeInventory = inventoryWith([[ITEMS.IRON_INGOT, 6], [B.COBBLESTONE, 4]]);
  forge.upgrade(POS, upgradeInventory);

  const inventory = new Inventory();
  for (const slot of inventory.allSlots()) {
    slot.id = B.DIRT;
    slot.count = MAX_STACK;
  }
  // Keep both ingredient stacks occupied after consuming the recipe so no slot
  // becomes available for the forged tool.
  inventory.hotbarSlot(0).id = ITEMS.IRON_INGOT;
  inventory.hotbarSlot(0).count = MAX_STACK;
  inventory.hotbarSlot(1).id = ITEMS.STICK;
  inventory.hotbarSlot(1).count = MAX_STACK;

  assert.equal(forge.craft(POS, 'iron-pickaxe', inventory), false);
  assert.equal(inventory.countOf(ITEMS.IRON_INGOT), MAX_STACK);
  assert.equal(inventory.countOf(ITEMS.STICK), MAX_STACK);
  assert.equal(inventory.countOf(ITEMS.IRON_PICKAXE), 0);
});

test('forge crafting may use a slot freed by consumed ingredients', () => {
  const forge = new ForgeSystem();
  forge.upgrade(POS, inventoryWith([[ITEMS.IRON_INGOT, 6], [B.COBBLESTONE, 4]]));

  const inventory = new Inventory();
  for (const slot of inventory.allSlots()) {
    slot.id = B.DIRT;
    slot.count = MAX_STACK;
  }
  inventory.hotbarSlot(0).id = ITEMS.IRON_INGOT;
  inventory.hotbarSlot(0).count = 3;
  inventory.hotbarSlot(1).id = ITEMS.STICK;
  inventory.hotbarSlot(1).count = 2;

  assert.equal(forge.craft(POS, 'iron-pickaxe', inventory), true);
  assert.equal(inventory.countOf(ITEMS.IRON_PICKAXE), 1);
});

test('forge tier and partial processing round-trip through save/load', () => {
  const forge = new ForgeSystem();
  forge.upgrade(POS, inventoryWith([[ITEMS.IRON_INGOT, 6], [B.COBBLESTONE, 4]]));
  const working = inventoryWith([[B.GOLD_ORE, 1], [B.COAL_ORE, 1]]);
  assert.equal(forge.startRefining(POS, 'gold', working), true);
  forge.update(2.25);

  const saved = forge.serialize();
  const restored = new ForgeSystem();
  const world = { getBlock(...pos) { return pos.join(',') === POS.join(',') ? B.FURNACE : B.AIR; } };
  restored.load(saved, world);

  const station = restored.station(POS);
  assert.equal(station.tier, FORGE_TIERS.IRON);
  assert.equal(station.job.recipeId, 'gold');
  assert.ok(Math.abs(station.job.progress - 2.25) < 0.000001);

  restored.update(2.75);
  assert.deepEqual(restored.station(POS).output, { id: ITEMS.GOLD_INGOT, count: 1 });
});

test('loading forge state ignores stations whose world block was removed', () => {
  const forge = new ForgeSystem();
  forge.ensureStation(POS);
  const saved = forge.serialize();

  const restored = new ForgeSystem();
  restored.load(saved, { getBlock() { return B.AIR; } });

  assert.deepEqual(restored.serialize(), { stations: {} });
});

test('breaking a running forge salvages committed input and fuel', () => {
  const forge = new ForgeSystem();
  const inventory = inventoryWith([[B.IRON_ORE, 1], [B.COAL_ORE, 1]]);
  assert.equal(forge.startRefining(POS, 'iron', inventory), true);
  forge.update(2);

  const salvage = forge.removeStation(POS);
  assert.deepEqual(salvage.sort((a, b) => a.id - b.id), [
    { id: B.COAL_ORE, count: 1 },
    { id: B.IRON_ORE, count: 1 },
  ].sort((a, b) => a.id - b.id));
  assert.deepEqual(forge.serialize(), { stations: {} });
});

test('breaking a forge with completed output salvages the output', () => {
  const forge = new ForgeSystem();
  const inventory = inventoryWith([[B.IRON_ORE, 1], [B.COAL_ORE, 1]]);
  forge.startRefining(POS, 'iron', inventory);
  forge.update(4);

  assert.deepEqual(forge.removeStation(POS), [{ id: ITEMS.IRON_INGOT, count: 1 }]);
  assert.deepEqual(forge.serialize(), { stations: {} });
});

test('removing an empty station clears its persisted progression state without salvage', () => {
  const forge = new ForgeSystem();
  forge.ensureStation(POS);
  assert.deepEqual(forge.removeStation(POS), []);
  assert.deepEqual(forge.serialize(), { stations: {} });
});

test('hand crafting cannot produce advanced metal equipment from raw ore', () => {
  const crafting = new Crafting();
  const advancedResults = new Set([
    ITEMS.IRON_PICKAXE,
    ITEMS.IRON_SWORD,
    ITEMS.DIAMOND_PICKAXE,
    ITEMS.DIAMOND_SWORD,
  ]);

  for (const recipe of crafting.allRecipes()) {
    assert.equal(advancedResults.has(recipe.result.id), false, 'advanced metal equipment must be forge-only');
    if ([B.IRON_BLOCK, B.GOLD_BLOCK, B.DIAMOND_BLOCK].includes(recipe.result.id)) {
      assert.equal(recipe.ingredients.some(item => [B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE].includes(item.id)), false);
    }
  }
});
