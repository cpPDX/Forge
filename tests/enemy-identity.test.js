import test from 'node:test';
import assert from 'node:assert/strict';

import { B } from '../src/utils/constants.js';
import {
  ENEMY_TYPES,
  allEnemyDefinitions,
  enemyDefinition,
  enemyName,
  rollEnemyDrop,
} from '../src/systems/EnemyIdentity.js';

test('vertical-slice roster uses Forge-original names and distinct roles', () => {
  const defs = allEnemyDefinitions();
  assert.deepEqual(defs.map(def => def.type).sort(), [
    ENEMY_TYPES.ASHBOUND,
    ENEMY_TYPES.SHARDCASTER,
    ENEMY_TYPES.SLAGBURST,
  ].sort());

  assert.deepEqual(defs.map(def => def.name).sort(), ['Ashbound', 'Shardcaster', 'Slagburst'].sort());
  assert.equal(new Set(defs.map(def => def.role)).size, 3);

  const forbidden = /zombie|skeleton|creeper/i;
  for (const def of defs) {
    assert.doesNotMatch(`${def.type} ${def.name} ${def.role}`, forbidden);
  }
});

test('enemy drops feed existing survival and forge loops instead of collectible-only loot', () => {
  assert.deepEqual(enemyDefinition(ENEMY_TYPES.ASHBOUND).drop, {
    id: B.COAL_ORE,
    count: 1,
    chance: 0.35,
  });
  assert.deepEqual(enemyDefinition(ENEMY_TYPES.SHARDCASTER).drop, {
    id: B.COBBLESTONE,
    count: 1,
    chance: 0.5,
  });
  assert.deepEqual(enemyDefinition(ENEMY_TYPES.SLAGBURST).drop, {
    id: B.COAL_ORE,
    count: 1,
    chance: 0.75,
  });
});

test('drop rolls are deterministic at tested boundaries and return detached stacks', () => {
  const first = rollEnemyDrop(ENEMY_TYPES.ASHBOUND, 0);
  const second = rollEnemyDrop(ENEMY_TYPES.ASHBOUND, 0);
  assert.deepEqual(first, { id: B.COAL_ORE, count: 1 });
  assert.deepEqual(second, first);
  assert.notEqual(first, second);

  assert.equal(rollEnemyDrop(ENEMY_TYPES.ASHBOUND, 0.35), null);
  assert.equal(rollEnemyDrop(ENEMY_TYPES.SHARDCASTER, 0.499), B.COBBLESTONE ? null : null);
  assert.deepEqual(rollEnemyDrop(ENEMY_TYPES.SHARDCASTER, 0.499), { id: B.COBBLESTONE, count: 1 });
  assert.equal(rollEnemyDrop(ENEMY_TYPES.SLAGBURST, 0.75), null);
  assert.equal(rollEnemyDrop('unknown', 0), null);
});

test('enemy display-name lookup is explicit', () => {
  assert.equal(enemyName(ENEMY_TYPES.ASHBOUND), 'Ashbound');
  assert.equal(enemyName(ENEMY_TYPES.SHARDCASTER), 'Shardcaster');
  assert.equal(enemyName(ENEMY_TYPES.SLAGBURST), 'Slagburst');
  assert.equal(enemyName('unknown'), 'Unknown');
});
