import { B } from '../utils/constants.js';

export const ENEMY_TYPES = Object.freeze({
  ASHBOUND: 'ashbound',
  SHARDCASTER: 'shardcaster',
  SLAGBURST: 'slagburst',
});

const DEFINITIONS = Object.freeze({
  [ENEMY_TYPES.ASHBOUND]: Object.freeze({
    name: 'Ashbound',
    role: 'Relentless close-range pressure',
    drop: Object.freeze({ id: B.COAL_ORE, count: 1, chance: 0.35 }),
  }),
  [ENEMY_TYPES.SHARDCASTER]: Object.freeze({
    name: 'Shardcaster',
    role: 'Ranged pressure that punishes exposed ground',
    drop: Object.freeze({ id: B.COBBLESTONE, count: 1, chance: 0.5 }),
  }),
  [ENEMY_TYPES.SLAGBURST]: Object.freeze({
    name: 'Slagburst',
    role: 'Volatile close-range threat that damages structures',
    drop: Object.freeze({ id: B.COAL_ORE, count: 1, chance: 0.75 }),
  }),
});

export function enemyDefinition(type) {
  const def = DEFINITIONS[type];
  if (!def) return null;
  return {
    ...def,
    drop: def.drop ? { ...def.drop } : null,
  };
}

export function enemyName(type) {
  return DEFINITIONS[type]?.name ?? 'Unknown';
}

export function rollEnemyDrop(type, roll = Math.random()) {
  const drop = DEFINITIONS[type]?.drop;
  if (!drop || !Number.isFinite(roll) || roll < 0 || roll >= 1 || roll >= drop.chance) return null;
  return { id: drop.id, count: drop.count };
}

export function allEnemyDefinitions() {
  return Object.entries(DEFINITIONS).map(([type, def]) => ({
    type,
    ...def,
    drop: def.drop ? { ...def.drop } : null,
  }));
}
