import { ITEMS } from '../utils/constants.js';

const DEFS = {
  [ITEMS.WOODEN_SWORD]:  { name: 'Wooden Sword',  damage: 4, reach: 3.0, color: '#c8a060' },
  [ITEMS.STONE_SWORD]:   { name: 'Stone Sword',   damage: 5, reach: 3.0, color: '#aaaaaa' },
  [ITEMS.IRON_SWORD]:    { name: 'Iron Sword',    damage: 6, reach: 3.5, color: '#d8e8f8' },
  [ITEMS.DIAMOND_SWORD]: { name: 'Diamond Sword', damage: 7, reach: 3.5, color: '#44ddff' },
  [ITEMS.APPLE]:         { name: 'Apple',         edible: true, hungerRestore: 4, color: '#ff4444' },
};

export const ItemRegistry = {
  get(id)    { return DEFS[id] ?? null; },
  name(id)   { return DEFS[id]?.name ?? null; },
  damage(id) { return DEFS[id]?.damage ?? 1; },
  reach(id)  { return DEFS[id]?.reach ?? 2.5; },
  color(id)  { return DEFS[id]?.color ?? '#888'; },
};
