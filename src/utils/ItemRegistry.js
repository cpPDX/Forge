import { TILES, MAX_STACK } from './constants.js';

const ITEMS = {};

function def(id, name, opts = {}) {
  ITEMS[id] = {
    id,
    name,
    stackable:      opts.stackable    ?? true,
    maxStack:       opts.maxStack     ?? MAX_STACK,
    tileId:         opts.tileId       ?? null,
    toolType:       opts.toolType     ?? null,
    toolTier:       opts.toolTier     ?? 0,
    damage:         opts.damage       ?? 1,
    durability:     opts.durability   ?? null,
    maxDurability:  opts.maxDurability ?? null,
    hungerRestore:  opts.hungerRestore ?? 0,
    color:          opts.color        ?? 0xaaaaaa,
  };
}

// Materials
def('dirt',           'Dirt',           { tileId: TILES.DIRT,           color: 0x6b3a2a });
def('cobblestone',    'Cobblestone',    { tileId: TILES.COBBLESTONE,    color: 0x606060 });
def('stone',          'Stone',          { tileId: TILES.STONE,          color: 0x7a7a7a });
def('sand',           'Sand',           { tileId: TILES.SAND,           color: 0xd4b463 });
def('gravel',         'Gravel',         { tileId: TILES.GRAVEL,         color: 0x808080 });
def('sandstone',      'Sandstone',      { tileId: TILES.SANDSTONE,      color: 0xc8a850 });
def('clay_ball',      'Clay Ball',      {                                color: 0x9aacbc });
def('snowball',       'Snowball',       {                                color: 0xe8eeff });
def('obsidian',       'Obsidian',       { tileId: TILES.OBSIDIAN,       color: 0x1a0a2a });
def('netherrack',     'Netherrack',     { tileId: TILES.NETHERRACK,     color: 0x6a1a1a });
def('glowstone_dust', 'Glowstone Dust', {                                color: 0xffee88 });
def('cactus',         'Cactus',         { tileId: TILES.CACTUS,         color: 0x2a7a1a });

// Logs & wood
def('oak_log',        'Oak Log',        { tileId: TILES.OAK_LOG,        color: 0x5a3a1a });
def('pine_log',       'Pine Log',       { tileId: TILES.PINE_LOG,       color: 0x4a2a0a });
def('jungle_log',     'Jungle Log',     { tileId: TILES.JUNGLE_LOG,     color: 0x3a5a1a });
def('oak_planks',     'Oak Planks',     { tileId: TILES.OAK_PLANKS,     color: 0xc8964a });
def('pine_planks',    'Pine Planks',    { tileId: TILES.PINE_PLANKS,    color: 0x8a5a2a });
def('oak_sapling',    'Oak Sapling',    {                                color: 0x2a7a1a });
def('stick',          'Stick',          {                                color: 0x8a5a2a });

// Ores & ingots
def('coal',           'Coal',           {                                color: 0x333333 });
def('iron_ore',       'Iron Ore',       {                                color: 0x8a6a4a });
def('gold_ore',       'Gold Ore',       {                                color: 0x7a7040 });
def('iron_ingot',     'Iron Ingot',     {                                color: 0xc0c0c0 });
def('gold_ingot',     'Gold Ingot',     {                                color: 0xffd700 });
def('diamond',        'Diamond',        {                                color: 0x44ddff });
def('hellstone_bar',  'Hellstone Bar',  {                                color: 0x4a1a00 });

// Crafted blocks
def('stone_brick',    'Stone Brick',    { tileId: TILES.STONE_BRICK,    color: 0x5a5a6a });
def('glass',          'Glass',          { tileId: TILES.GLASS,          color: 0x80c0e0 });
def('torch',          'Torch',          { tileId: TILES.TORCH,          color: 0xff9900 });
def('chest',          'Chest',          { tileId: TILES.CHEST,          color: 0xc89632 });
def('crafting_table', 'Crafting Table', { tileId: TILES.CRAFTING_TABLE, color: 0x8b4513 });
def('furnace',        'Furnace',        { tileId: TILES.FURNACE,        color: 0x888888 });
def('iron_block',     'Iron Block',     { tileId: TILES.IRON_BLOCK,     color: 0xc0c0c0 });
def('gold_block',     'Gold Block',     { tileId: TILES.GOLD_BLOCK,     color: 0xffd700 });
def('diamond_block',  'Diamond Block',  { tileId: TILES.DIAMOND_BLOCK,  color: 0x44ddff });

// Food
def('raw_pork',    'Raw Pork',      { hungerRestore: 3,  color: 0xff9999 });
def('cooked_pork', 'Cooked Pork',   { hungerRestore: 8,  color: 0xcc6644 });
def('raw_meat',    'Raw Meat',      { hungerRestore: 2,  color: 0xff8888 });
def('cooked_meat', 'Cooked Meat',   { hungerRestore: 6,  color: 0xbb5533 });
def('raw_fish',    'Raw Fish',      { hungerRestore: 2,  color: 0x6688aa });
def('cooked_fish', 'Cooked Fish',   { hungerRestore: 5,  color: 0xaa7755 });
def('apple',       'Apple',         { hungerRestore: 4,  color: 0xff3333 });
def('bread',       'Bread',         { hungerRestore: 5,  color: 0xd4945a });

// Mob drops
def('slimeball',    'Slimeball',    { color: 0x55cc55 });
def('rotten_flesh', 'Rotten Flesh', { color: 0x774444 });
def('bone',         'Bone',         { color: 0xeeeecc });
def('arrow',        'Arrow',        { color: 0xccaa55 });
def('string',       'String',       { color: 0xdddddd });
def('spider_eye',   'Spider Eye',   { color: 0xcc3333 });
def('gunpowder',    'Gunpowder',    { color: 0x666655 });
def('magma_cream',  'Magma Cream',  { color: 0xff6600 });

// Flowers
def('red_flower',    'Red Flower',    { tileId: TILES.FLOWER_RED,    color: 0xff4444 });
def('yellow_flower', 'Yellow Flower', { tileId: TILES.FLOWER_YELLOW, color: 0xffdd44 });

// Tools — Wood (tier 0)
def('wood_pickaxe', 'Wood Pickaxe', { stackable: false, maxStack: 1, toolType: 'pickaxe', toolTier: 0, damage: 2, durability: 60, maxDurability: 60, color: 0xc8964a });
def('wood_axe',     'Wood Axe',     { stackable: false, maxStack: 1, toolType: 'axe',     toolTier: 0, damage: 2, durability: 60, maxDurability: 60, color: 0xc8964a });
def('wood_shovel',  'Wood Shovel',  { stackable: false, maxStack: 1, toolType: 'shovel',  toolTier: 0, damage: 1, durability: 60, maxDurability: 60, color: 0xc8964a });
def('wood_sword',   'Wood Sword',   { stackable: false, maxStack: 1, toolType: 'sword',   toolTier: 0, damage: 4, durability: 60, maxDurability: 60, color: 0xc8964a });

// Tools — Stone (tier 1)
def('stone_pickaxe', 'Stone Pickaxe', { stackable: false, maxStack: 1, toolType: 'pickaxe', toolTier: 1, damage: 3,  durability: 132, maxDurability: 132, color: 0x7a7a7a });
def('stone_axe',     'Stone Axe',     { stackable: false, maxStack: 1, toolType: 'axe',     toolTier: 1, damage: 3,  durability: 132, maxDurability: 132, color: 0x7a7a7a });
def('stone_shovel',  'Stone Shovel',  { stackable: false, maxStack: 1, toolType: 'shovel',  toolTier: 1, damage: 2,  durability: 132, maxDurability: 132, color: 0x7a7a7a });
def('stone_sword',   'Stone Sword',   { stackable: false, maxStack: 1, toolType: 'sword',   toolTier: 1, damage: 5,  durability: 132, maxDurability: 132, color: 0x7a7a7a });

// Tools — Iron (tier 2)
def('iron_pickaxe', 'Iron Pickaxe', { stackable: false, maxStack: 1, toolType: 'pickaxe', toolTier: 2, damage: 4,  durability: 251, maxDurability: 251, color: 0xc0c0c0 });
def('iron_axe',     'Iron Axe',     { stackable: false, maxStack: 1, toolType: 'axe',     toolTier: 2, damage: 4,  durability: 251, maxDurability: 251, color: 0xc0c0c0 });
def('iron_shovel',  'Iron Shovel',  { stackable: false, maxStack: 1, toolType: 'shovel',  toolTier: 2, damage: 3,  durability: 251, maxDurability: 251, color: 0xc0c0c0 });
def('iron_sword',   'Iron Sword',   { stackable: false, maxStack: 1, toolType: 'sword',   toolTier: 2, damage: 7,  durability: 251, maxDurability: 251, color: 0xc0c0c0 });

// Tools — Gold (tier 3)
def('gold_pickaxe', 'Gold Pickaxe', { stackable: false, maxStack: 1, toolType: 'pickaxe', toolTier: 3, damage: 3,  durability: 33,  maxDurability: 33,  color: 0xffd700 });
def('gold_sword',   'Gold Sword',   { stackable: false, maxStack: 1, toolType: 'sword',   toolTier: 3, damage: 6,  durability: 33,  maxDurability: 33,  color: 0xffd700 });

// Tools — Diamond (tier 4)
def('diamond_pickaxe', 'Diamond Pickaxe', { stackable: false, maxStack: 1, toolType: 'pickaxe', toolTier: 4, damage: 6,  durability: 1562, maxDurability: 1562, color: 0x44ddff });
def('diamond_axe',     'Diamond Axe',     { stackable: false, maxStack: 1, toolType: 'axe',     toolTier: 4, damage: 6,  durability: 1562, maxDurability: 1562, color: 0x44ddff });
def('diamond_sword',   'Diamond Sword',   { stackable: false, maxStack: 1, toolType: 'sword',   toolTier: 4, damage: 9,  durability: 1562, maxDurability: 1562, color: 0x44ddff });

export const ItemRegistry = {
  get(id)  { return ITEMS[id] || null; },
  all()    { return Object.values(ITEMS); },
};
