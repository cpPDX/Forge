export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 128;
export const SEA_LEVEL    = 64;
export const RENDER_DIST  = 5;   // chunks in each direction

export const GRAVITY        = -28;
export const JUMP_VEL       =  9;
export const WALK_SPEED     =  4.3;
export const SPRINT_SPEED   =  7.0;
export const PLAYER_WIDTH   =  0.6;
export const PLAYER_HEIGHT  =  1.8;
export const EYE_HEIGHT     =  1.62;
export const REACH          =  5.0;  // blocks

export const MAX_HP     = 20;
export const MAX_HUNGER = 20;

// Day/night: full cycle in ms
export const DAY_MS = 12 * 60 * 1000;

// Block IDs — never reorder
// Non-block item IDs (>= 100, never placed as blocks)
export const ITEMS = {
  WOODEN_SWORD:  100,
  STONE_SWORD:   101,
  IRON_SWORD:    102,
  DIAMOND_SWORD: 103,
};

export const B = {
  AIR:           0,
  GRASS:         1,
  DIRT:          2,
  STONE:         3,
  SAND:          4,
  GRAVEL:        5,
  BEDROCK:       6,
  COBBLESTONE:   7,
  OAK_LOG:       8,
  OAK_LEAVES:    9,
  OAK_PLANKS:   10,
  GLASS:        11,
  COAL_ORE:     12,
  IRON_ORE:     13,
  GOLD_ORE:     14,
  DIAMOND_ORE:  15,
  SANDSTONE:    16,
  WATER:        17,
  LAVA:         18,
  GLOWSTONE:    19,
  NETHERRACK:   20,
  ICE:          21,
  SNOW:         22,
  STONE_BRICK:  23,
  CRAFTING_TABLE:24,
  FURNACE:      25,
  TORCH:        26,
  IRON_BLOCK:   27,
  GOLD_BLOCK:   28,
  DIAMOND_BLOCK:29,
  CLAY:         30,
  SNOW_BLOCK:   31,
};
