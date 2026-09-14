import test from 'node:test';
import assert from 'node:assert/strict';

import { B, ITEMS, CHUNK_SIZE, CHUNK_HEIGHT } from '../src/utils/constants.js';
import { Inventory } from '../src/systems/Inventory.js';
import {
  TOOL_TIERS,
  toolTierForItem,
  harvestRequirement,
  canHarvest,
  RESOURCE_LEADS,
  depthGuidance,
} from '../src/systems/ResourceProgression.js';
import { ResourceProgressionController } from '../src/systems/ResourceProgressionController.js';
import { World } from '../src/world/World.js';

test('pickaxe tiers form a deadlock-free resource ladder', () => {
  assert.equal(toolTierForItem(ITEMS.WOODEN_PICKAXE), TOOL_TIERS.WOOD);
  assert.equal(toolTierForItem(ITEMS.STONE_PICKAXE), TOOL_TIERS.STONE);
  assert.equal(toolTierForItem(ITEMS.IRON_PICKAXE), TOOL_TIERS.IRON);
  assert.equal(toolTierForItem(ITEMS.DIAMOND_PICKAXE), TOOL_TIERS.DIAMOND);

  assert.equal(canHarvest(B.STONE, ITEMS.WOODEN_PICKAXE), true);
  assert.equal(canHarvest(B.COAL_ORE, ITEMS.WOODEN_PICKAXE), true);
  assert.equal(canHarvest(B.IRON_ORE, ITEMS.WOODEN_PICKAXE), false);
  assert.equal(canHarvest(B.IRON_ORE, ITEMS.STONE_PICKAXE), true);
  assert.equal(canHarvest(B.GOLD_ORE, ITEMS.STONE_PICKAXE), false);
  assert.equal(canHarvest(B.DIAMOND_ORE, ITEMS.STONE_PICKAXE), false);
  assert.equal(canHarvest(B.GOLD_ORE, ITEMS.IRON_PICKAXE), true);
  assert.equal(canHarvest(B.DIAMOND_ORE, ITEMS.IRON_PICKAXE), true);
});

test('resource requirements expose the exact minimum tool and depth leads', () => {
  assert.equal(harvestRequirement(B.IRON_ORE).name, 'Stone Pickaxe');
  assert.equal(harvestRequirement(B.GOLD_ORE).name, 'Iron Pickaxe');
  assert.equal(harvestRequirement(B.DIAMOND_ORE).name, 'Iron Pickaxe');

  assert.equal(RESOURCE_LEADS.iron.maxY, 47);
  assert.equal(RESOURCE_LEADS.gold.maxY, 31);
  assert.equal(RESOURCE_LEADS.diamond.maxY, 15);
});

test('depth guidance maps the current Y level to the next resource threshold', () => {
  assert.deepEqual(depthGuidance(64.9), { level: 64, detail: 'Iron below Y48' });
  assert.deepEqual(depthGuidance(47.9), { level: 47, detail: 'Iron zone · Gold below Y32' });
  assert.deepEqual(depthGuidance(31.9), { level: 31, detail: 'Gold zone · Diamond below Y16' });
  assert.deepEqual(depthGuidance(15.9), { level: 15, detail: 'Diamond zone' });
});

test('depth indicator waits for the first forge and skips unchanged per-frame renders', () => {
  const renders = [];
  const game = {
    _player: { y: 64.8 },
    _firstSessionController: { complete: false },
    _hud: { updateDebug() {} },
  };
  const controller = new ResourceProgressionController(game, {
    depthView: { render(view) { renders.push(view); } },
  });
  controller._wrapDepthIndicator();

  game._hud.updateDebug();
  game._hud.updateDebug();
  assert.deepEqual(renders, [null], 'onboarding keeps the depth readout hidden without repeated DOM work');

  game._firstSessionController.complete = true;
  game._hud.updateDebug();
  game._hud.updateDebug();
  assert.deepEqual(renders.at(-1), { level: 64, detail: 'Iron below Y48' });
  assert.equal(renders.length, 2, 'unchanged level is not rendered every frame');

  game._player.y = 47.8;
  game._hud.updateDebug();
  assert.deepEqual(renders.at(-1), { level: 47, detail: 'Iron zone · Gold below Y32' });

  game._player.y = 47.1;
  game._hud.updateDebug();
  assert.equal(renders.length, 3, 'movement within the same integer Y level does not redraw');
});

test('under-tier mining is blocked without suppressing the normal break handler entirely', () => {
  const inventory = new Inventory();
  inventory.addItem(ITEMS.WOODEN_PICKAXE, 1);
  const player = {
    targeted: { pos: [1, 20, 1], face: [0, 1, 0] },
    breakProgress: 0.5,
    _breakTarget: [1, 20, 1],
    calls: 0,
    sawTarget: null,
    _handleBreak(_dt, _input, _mobs) {
      this.calls++;
      this.sawTarget = this.targeted;
    },
  };
  const game = {
    _player: player,
    _inventory: inventory,
    _world: { getBlock() { return B.IRON_ORE; } },
  };

  const controller = new ResourceProgressionController(game);
  controller._wrapMiningGate();
  player._handleBreak(0.1, { break: true, breakOnce: false }, null);

  assert.equal(player.calls, 1, 'wrapped handler still runs so combat/other semantics are preserved');
  assert.equal(player.sawTarget, null, 'blocked ore is hidden only from the mining path');
  assert.deepEqual(player.targeted.pos, [1, 20, 1], 'target is restored for rendering and interaction');
  assert.equal(player.breakProgress, 0);
  assert.equal(player._breakTarget, null);
});

test('sufficient tool leaves the normal mining target intact', () => {
  const inventory = new Inventory();
  inventory.addItem(ITEMS.STONE_PICKAXE, 1);
  const target = { pos: [1, 20, 1], face: [0, 1, 0] };
  const player = {
    targeted: target,
    sawTarget: null,
    _handleBreak() { this.sawTarget = this.targeted; },
  };
  const game = {
    _player: player,
    _inventory: inventory,
    _world: { getBlock() { return B.IRON_ORE; } },
  };

  const controller = new ResourceProgressionController(game);
  controller._wrapMiningGate();
  player._handleBreak(0.1, { break: true, breakOnce: false }, null);

  assert.equal(player.sawTarget, target);
});

function countOreInNearbyChunks(world, blockId, radiusChunks) {
  const spawn = world.spawnPoint();
  const centerCx = Math.floor(spawn.x / CHUNK_SIZE);
  const centerCz = Math.floor(spawn.z / CHUNK_SIZE);
  let count = 0;

  for (let cx = centerCx - radiusChunks; cx <= centerCx + radiusChunks; cx++) {
    for (let cz = centerCz - radiusChunks; cz <= centerCz + radiusChunks; cz++) {
      const data = world.getChunkData(cx, cz);
      for (let i = 0; i < data.length; i++) {
        if (data[i] === blockId) count++;
      }
    }
  }
  return count;
}

test('fixed-seed nearby underground contains headroom for the complete Forgebrand arc', () => {
  const world = new World(12345);
  const radius = 2; // 5×5 chunks, roughly an 80×80 block search footprint.
  const iron = countOreInNearbyChunks(world, B.IRON_ORE, radius);
  const gold = countOreInNearbyChunks(world, B.GOLD_ORE, radius);
  const diamond = countOreInNearbyChunks(world, B.DIAMOND_ORE, radius);

  // Minimum post-#27 route consumes 15 iron (Iron Forge + Iron Pickaxe +
  // Master upgrade + Forgebrand), 6 gold (Master upgrade + Forgebrand), and
  // 4 raw diamond (2 for the Master upgrade + 2 refined for Forgebrand).
  // Require additional local headroom so the finale does not depend on finding
  // essentially every relevant vein in the initial search footprint.
  assert.ok(iron >= 20, `expected >=20 nearby Iron Ore for a 15-ore route, found ${iron}`);
  assert.ok(gold >= 8, `expected >=8 nearby Gold Ore for a 6-ore route, found ${gold}`);
  assert.ok(diamond >= 6, `expected >=6 nearby Diamond Ore for a 4-ore route, found ${diamond}`);
});

test('ore depth bands match the player-facing progression leads', () => {
  const world = new World(12345);
  world._caveN = () => 0;
  world._caveN2 = () => 0;
  world._oreN = () => 0.95;
  const surface = CHUNK_HEIGHT - 8;

  assert.equal(world._genBlock(0, 47, 0, surface, 'forest'), B.IRON_ORE);
  assert.notEqual(world._genBlock(0, 48, 0, surface, 'forest'), B.IRON_ORE);
  assert.equal(world._genBlock(0, 31, 0, surface, 'forest'), B.GOLD_ORE);
  assert.notEqual(world._genBlock(0, 32, 0, surface, 'forest'), B.GOLD_ORE);
  assert.equal(world._genBlock(0, 15, 0, surface, 'forest'), B.DIAMOND_ORE);
  assert.notEqual(world._genBlock(0, 16, 0, surface, 'forest'), B.DIAMOND_ORE);
});
