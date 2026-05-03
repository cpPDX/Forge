import { ITEMS } from '../utils/constants.js';

const DEFS = {
  [ITEMS.WOODEN_SWORD]:    { name: 'Wooden Sword',    damage: 4, reach: 3.0, color: '#c8a060' },
  [ITEMS.STONE_SWORD]:     { name: 'Stone Sword',     damage: 5, reach: 3.0, color: '#aaaaaa' },
  [ITEMS.IRON_SWORD]:      { name: 'Iron Sword',      damage: 6, reach: 3.5, color: '#d8e8f8' },
  [ITEMS.DIAMOND_SWORD]:   { name: 'Diamond Sword',   damage: 7, reach: 3.5, color: '#44ddff' },
  [ITEMS.APPLE]:           { name: 'Apple',           edible: true, hungerRestore: 4, color: '#ff4444' },
  [ITEMS.STICK]:           { name: 'Stick',           color: '#a0702a' },
  [ITEMS.WOODEN_PICKAXE]:  { name: 'Wooden Pickaxe',  damage: 2, reach: 3.0, color: '#c8a060', tool: 'pickaxe', speed: 2.0 },
  [ITEMS.STONE_PICKAXE]:   { name: 'Stone Pickaxe',   damage: 3, reach: 3.0, color: '#aaaaaa', tool: 'pickaxe', speed: 4.0 },
  [ITEMS.IRON_PICKAXE]:    { name: 'Iron Pickaxe',    damage: 4, reach: 3.5, color: '#d8e8f8', tool: 'pickaxe', speed: 6.0 },
  [ITEMS.DIAMOND_PICKAXE]: { name: 'Diamond Pickaxe', damage: 5, reach: 3.5, color: '#44ddff', tool: 'pickaxe', speed: 8.0 },
};

export const ItemRegistry = {
  get(id)    { return DEFS[id] ?? null; },
  name(id)   { return DEFS[id]?.name ?? null; },
  damage(id) { return DEFS[id]?.damage ?? 1; },
  reach(id)  { return DEFS[id]?.reach ?? 2.5; },
  color(id)  { return DEFS[id]?.color ?? '#888'; },
};
