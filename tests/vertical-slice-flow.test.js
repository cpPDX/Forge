import test from 'node:test';
import assert from 'node:assert/strict';

import { B, ITEMS } from '../src/utils/constants.js';
import { Inventory } from '../src/systems/Inventory.js';
import { Crafting } from '../src/systems/Crafting.js';
import { FirstSessionGuide } from '../src/systems/FirstSessionGuide.js';
import { ForgeSystem, FORGE_TIERS } from '../src/systems/ForgeSystem.js';
import { canHarvest } from '../src/systems/ResourceProgression.js';
import { NightPressureSystem } from '../src/systems/NightPressureSystem.js';
import { FinaleSystem, FINALE_HOLD_SECONDS } from '../src/systems/FinaleSystem.js';

const FORGE_POS = [2, 70, 2];

function craftResult(crafting, inventory, resultId) {
  const idx = crafting.allRecipes().findIndex(recipe => recipe.result.id === resultId);
  assert.notEqual(idx, -1, `expected hand-crafting recipe for item ${resultId}`);
  assert.equal(crafting.craftByIndex(idx, inventory), true, `expected crafting item ${resultId} to succeed`);
}

function refineAndCollect(forge, inventory, recipeId) {
  const recipe = forge.refiningOptions(FORGE_POS).find(option => option.id === recipeId);
  assert.ok(recipe, `expected refining option ${recipeId}`);
  assert.equal(forge.startRefining(FORGE_POS, recipeId, inventory), true);
  forge.update(recipe.duration);
  assert.equal(forge.collectOutput(FORGE_POS, inventory), recipe.output.count);
}

function guideUpdate(guide, inventory, overrides = {}) {
  return guide.update({
    input: null,
    inventory,
    inventoryOpen: false,
    isDay: true,
    ...overrides,
  });
}

test('fresh progression systems compose from first objective through the persisted Forgebrand win state', () => {
  const inventory = new Inventory();
  const crafting = new Crafting();
  const guide = new FirstSessionGuide();
  const forge = new ForgeSystem();
  const nights = new NightPressureSystem();
  const finale = new FinaleSystem();

  // First-session guidance teaches interaction language, then follows real inventory state.
  guideUpdate(guide, inventory, {
    input: { forward: true, back: false, left: false, right: false, jump: true, yaw: 0, pitch: 0 },
  });
  guideUpdate(guide, inventory, {
    input: { forward: false, back: false, left: false, right: false, jump: false, yaw: 0.05, pitch: 0 },
  });
  assert.equal(guide.step, 'wood');

  inventory.addItem(B.OAK_LOG, 2);
  guideUpdate(guide, inventory);
  assert.equal(guide.step, 'inventory');

  guideUpdate(guide, inventory, { inventoryOpen: true });
  assert.equal(guide.step, 'planks');

  craftResult(crafting, inventory, B.OAK_PLANKS);
  guideUpdate(guide, inventory);
  assert.equal(guide.step, 'sticks');

  craftResult(crafting, inventory, ITEMS.STICK);
  guideUpdate(guide, inventory);
  assert.equal(guide.step, 'pickaxe');

  // Convert the second log so the actual wooden-pickaxe recipe can be completed.
  craftResult(crafting, inventory, B.OAK_PLANKS);
  craftResult(crafting, inventory, ITEMS.WOODEN_PICKAXE);
  guideUpdate(guide, inventory);

  // On a fresh inventory the crafted pickaxe fills hotbar slot 0, which is
  // already selected, so the guide correctly skips a redundant equip prompt.
  assert.equal(inventory.hotbarSlot(inventory.selectedSlot).id, ITEMS.WOODEN_PICKAXE);
  assert.equal(guide.step, 'stone');

  // Fifteen cobblestone covers the Stone Forge, Stone Pickaxe, and Iron Forge upgrade path.
  inventory.addItem(B.COBBLESTONE, 15);
  guideUpdate(guide, inventory);
  assert.equal(guide.step, 'place');

  guide.onBlockPlaced();
  guideUpdate(guide, inventory);
  assert.equal(guide.step, 'prepare');

  craftResult(crafting, inventory, B.FURNACE);
  assert.equal(inventory.removeItem(B.FURNACE, 1), true, 'placing the Stone Forge consumes the crafted block');
  assert.equal(guide.markForgeEstablished(), true);
  assert.equal(guide.step, 'complete');
  assert.equal(guide.allowsHostiles, true);

  craftResult(crafting, inventory, ITEMS.STONE_PICKAXE);
  assert.equal(canHarvest(B.IRON_ORE, ITEMS.WOODEN_PICKAXE), false);
  assert.equal(canHarvest(B.IRON_ORE, ITEMS.STONE_PICKAXE), true);

  // The complete post-#27 material budget for the minimum Forgebrand route.
  inventory.addItem(B.IRON_ORE, 15);
  inventory.addItem(B.GOLD_ORE, 6);
  inventory.addItem(B.DIAMOND_ORE, 4);
  inventory.addItem(B.COAL_ORE, 23);
  // Replenish sticks for Iron Pickaxe + Forgebrand after the early tool crafts.
  inventory.addItem(B.OAK_LOG, 1);
  craftResult(crafting, inventory, B.OAK_PLANKS);
  craftResult(crafting, inventory, ITEMS.STICK);

  forge.ensureStation(FORGE_POS);
  assert.equal(forge.station(FORGE_POS).tier, FORGE_TIERS.STONE);

  // Stone Forge can process the entire iron budget before the upgrade.
  for (let i = 0; i < 15; i++) refineAndCollect(forge, inventory, 'iron');
  assert.equal(inventory.countOf(ITEMS.IRON_INGOT), 15);

  assert.equal(forge.upgrade(FORGE_POS, inventory), true);
  assert.equal(forge.station(FORGE_POS).tier, FORGE_TIERS.IRON);

  assert.equal(forge.craft(FORGE_POS, 'iron-pickaxe', inventory), true);
  assert.equal(canHarvest(B.GOLD_ORE, ITEMS.IRON_PICKAXE), true);
  assert.equal(canHarvest(B.DIAMOND_ORE, ITEMS.IRON_PICKAXE), true);

  for (let i = 0; i < 6; i++) refineAndCollect(forge, inventory, 'gold');
  assert.equal(inventory.countOf(ITEMS.GOLD_INGOT), 6);

  assert.equal(forge.upgrade(FORGE_POS, inventory), true);
  assert.equal(forge.station(FORGE_POS).tier, FORGE_TIERS.MASTER);

  for (let i = 0; i < 2; i++) refineAndCollect(forge, inventory, 'diamond');
  assert.equal(inventory.countOf(ITEMS.REFINED_DIAMOND), 2);

  assert.equal(forge.craft(FORGE_POS, 'forgebrand', inventory), true);
  assert.equal(inventory.countOf(ITEMS.FORGEBRAND), 1);
  assert.equal(inventory.countOf(B.DIAMOND_ORE), 0, 'the minimum path consumes four raw diamond total');

  // Advance through three genuinely hostile nights. Pressure caps at Peak while the night count continues.
  nights.update({ isNight: true, hostilesAllowed: true, dayFrac: 0.8 });
  nights.update({ isNight: false, hostilesAllowed: true, dayFrac: 0.5 });
  nights.update({ isNight: true, hostilesAllowed: true, dayFrac: 0.8 });
  nights.update({ isNight: false, hostilesAllowed: true, dayFrac: 0.5 });
  const peak = nights.update({ isNight: true, hostilesAllowed: true, dayFrac: 0.8 });
  assert.equal(peak.nightNumber, 3);
  assert.equal(peak.profile.name, 'Peak');

  const eligibility = {
    hasMasterForge: forge.station(FORGE_POS).tier === FORGE_TIERS.MASTER,
    hasForgebrand: inventory.countOf(ITEMS.FORGEBRAND) > 0,
    peakNightActive: true,
  };
  assert.equal(finale.onForgebrandKill(eligibility), true);
  const completion = finale.update({ dt: FINALE_HOLD_SECONDS, ...eligibility });
  assert.equal(completion.completedNow, true);
  assert.equal(finale.completed, true);

  // Round-trip the major progression state after completion. A reload must not erase the achievement.
  const restoredInventory = new Inventory();
  restoredInventory.load(inventory.serialize());

  const restoredGuide = new FirstSessionGuide();
  assert.equal(restoredGuide.load(guide.serialize()), true);

  const restoredForge = new ForgeSystem();
  restoredForge.load(forge.serialize(), {
    getBlock(x, y, z) {
      return x === FORGE_POS[0] && y === FORGE_POS[1] && z === FORGE_POS[2] ? B.FURNACE : B.AIR;
    },
  });

  const restoredNights = new NightPressureSystem();
  assert.equal(restoredNights.load(nights.serialize()), true);

  const restoredFinale = new FinaleSystem();
  assert.equal(restoredFinale.load(finale.serialize()), true);

  assert.equal(restoredGuide.step, 'complete');
  assert.equal(restoredForge.station(FORGE_POS).tier, FORGE_TIERS.MASTER);
  assert.equal(restoredInventory.countOf(ITEMS.FORGEBRAND), 1);
  assert.equal(restoredNights.nightNumber, 3);
  assert.equal(restoredFinale.completed, true);
  assert.equal(restoredFinale.view({
    hasIronForge: true,
    hasMasterForge: true,
    hasForgebrand: true,
    nightNumber: 3,
    peakNightActive: true,
  }).stage, 'complete');
});
