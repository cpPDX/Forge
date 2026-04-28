export const TILE_SIZE = 16;
export const CHUNK_SIZE = 32;

export const WORLD_WIDTH_CHUNKS = 128;
export const WORLD_HEIGHT_CHUNKS = 16;
export const WORLD_WIDTH = WORLD_WIDTH_CHUNKS * CHUNK_SIZE;   // 4096 tiles
export const WORLD_HEIGHT = WORLD_HEIGHT_CHUNKS * CHUNK_SIZE; // 512 tiles

export const LAYER = {
  SKY_BOTTOM:           80,
  SURFACE_TOP:          80,
  SURFACE_BOTTOM:       120,
  UNDERGROUND_BOTTOM:   280,
  CAVERN_BOTTOM:        430,
  UNDERWORLD_BOTTOM:    512,
};

export const TILES = {
  AIR:            0,
  GRASS:          1,
  DIRT:           2,
  STONE:          3,
  SAND:           4,
  GRAVEL:         5,
  BEDROCK:        6,
  SNOW_DIRT:      7,
  COAL_ORE:       8,
  IRON_ORE:       9,
  GOLD_ORE:       10,
  DIAMOND_ORE:    11,
  HELLSTONE:      12,
  OBSIDIAN:       13,
  SANDSTONE:      14,
  ICE:            15,
  OAK_LOG:        16,
  PINE_LOG:       17,
  JUNGLE_LOG:     18,
  OAK_LEAVES:     19,
  PINE_LEAVES:    20,
  JUNGLE_LEAVES:  21,
  CACTUS:         22,
  COBBLESTONE:    23,
  OAK_PLANKS:     24,
  PINE_PLANKS:    25,
  STONE_BRICK:    26,
  GLASS:          27,
  TORCH:          28,
  CHEST:          29,
  CRAFTING_TABLE: 30,
  FURNACE:        31,
  WATER:          32,
  LAVA:           33,
  GRASS_SNOW:     34,
  FLOWER_RED:     35,
  FLOWER_YELLOW:  36,
  TALL_GRASS:     37,
  VINE:           38,
  GLOWSTONE:      39,
  NETHERRACK:     40,
  CLAY:           41,
  IRON_BLOCK:     42,
  GOLD_BLOCK:     43,
  DIAMOND_BLOCK:  44,
};

export const BIOME = {
  FOREST:  0,
  DESERT:  1,
  SNOW:    2,
  JUNGLE:  3,
};

export const DAY_DURATION = 24000;

export const TIME = {
  DAWN:  0.208,
  DAY:   0.292,
  DUSK:  0.750,
  NIGHT: 0.833,
};

export const MAX_LIGHT    = 15;
export const TORCH_LIGHT  = 12;
export const LAVA_LIGHT   = 14;

export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;
export const CAMERA_ZOOM = 2;

export const PLAYER = {
  WIDTH:         12,
  HEIGHT:        28,
  WALK_SPEED:    150,
  SPRINT_SPEED:  240,
  JUMP_VEL:     -420,
  GRAVITY:       900,
  MAX_FALL:      800,
  REACH_PX:      5 * 16,
  MAX_HP:        20,
  MAX_HUNGER:    20,
};

export const HOTBAR_SIZE    = 9;
export const INV_ROWS       = 3;
export const INV_COLS       = 9;
export const MAX_STACK      = 64;

export const MOB_DESPAWN_DIST = 32;
export const MAX_MOBS         = 50;
