import test from 'node:test';
import assert from 'node:assert/strict';

import { B, ITEMS } from '../src/utils/constants.js';
import { World } from '../src/world/World.js';
import { Player } from '../src/player/Player.js';
import { Inventory } from '../src/systems/Inventory.js';

class FakeWorld {
  constructor(blockId) {
    this.blockId = blockId;
    this.setCalls = 0;
  }

  spawnPoint() { return { x: 0.5, y: 10, z: 0.5 }; }
  getBlock() { return this.blockId; }
  setBlock(_x, _y, _z, id) {
    this.blockId = id;
    this.setCalls++;
  }
}

function makePlayer(blockId, heldItemId = null) {
  const world = new FakeWorld(blockId);
  const camera = { position: { set() {} }, rotation: {} };
  const player = new Player(world, camera);
  player.inventory = new Inventory();
  player.targeted = { pos: [1, 10, 1], face: [0, 1, 0] };
  if (heldItemId != null) player.inventory.addItem(heldItemId, 1);
  return { player, world };
}

test('ore generation evaluates rare tiers before common coal', () => {
  const world = new World(12345);
  world._caveN = () => 0;
  world._caveN2 = () => 0;
  world._oreN = () => 0.95;

  assert.equal(world._genBlock(0, 10, 0, 80, 'forest'), B.DIAMOND_ORE);
  assert.equal(world._genBlock(0, 20, 0, 80, 'forest'), B.GOLD_ORE);
  assert.equal(world._genBlock(0, 40, 0, 80, 'forest'), B.IRON_ORE);
  assert.equal(world._genBlock(0, 50, 0, 80, 'forest'), B.COAL_ORE);
});

test('a fresh break press starts hardness-aware mining instead of deleting the block', () => {
  const { player, world } = makePlayer(B.STONE);

  player._handleBreak(0.016, { locked: true, breakOnce: true, break: true }, null);

  assert.equal(world.blockId, B.STONE);
  assert.equal(world.setCalls, 0);
  assert.ok(player.breakProgress > 0 && player.breakProgress < 1);
});

test('bedrock is unbreakable through the fresh-press path', () => {
  const { player, world } = makePlayer(B.BEDROCK);

  player._handleBreak(10, { locked: true, breakOnce: true, break: true }, null);

  assert.equal(world.blockId, B.BEDROCK);
  assert.equal(world.setCalls, 0);
  assert.equal(player.breakProgress, 0);
});

test('matching pickaxes materially increase mining progress', () => {
  const fist = makePlayer(B.STONE);
  const diamond = makePlayer(B.STONE, ITEMS.DIAMOND_PICKAXE);

  fist.player._handleBreak(0.1, { locked: true, breakOnce: false, break: true }, null);
  diamond.player._handleBreak(0.1, { locked: true, breakOnce: false, break: true }, null);

  assert.ok(diamond.player.breakProgress > fist.player.breakProgress);
});

test('a mob hit consumes the fresh attack without mining the targeted block', () => {
  const { player, world } = makePlayer(B.STONE, ITEMS.WOODEN_SWORD);
  let hitCount = 0;
  const mobs = {
    findTarget() { return { id: 99 }; },
    hit() { hitCount++; return true; },
  };

  player._handleBreak(0.5, { locked: true, breakOnce: true, break: true }, mobs);

  assert.equal(hitCount, 1);
  assert.equal(world.blockId, B.STONE);
  assert.equal(world.setCalls, 0);
  assert.equal(player.breakProgress, 0);
});
