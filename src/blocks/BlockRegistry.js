import { B } from '../utils/constants.js';

// Texture atlas: 256×256 px, 16 px per tile → 16 cols × 16 rows
// Texture index = row*16 + col
// Face order per block: [+X, -X, +Y(top), -Y(bottom), +Z, -Z]

const T = {
  GRASS_TOP:     0,
  GRASS_SIDE:    1,
  DIRT:          2,
  STONE:         3,
  SAND:          4,
  GRAVEL:        5,
  BEDROCK:       6,
  COBBLE:        7,
  LOG_TOP:       8,
  LOG_SIDE:      9,
  LEAVES:       10,
  PLANKS:       11,
  COAL_ORE:     12,
  IRON_ORE:     13,
  GOLD_ORE:     14,
  DIAMOND_ORE:  15,
  SANDSTONE_TOP:16,
  SANDSTONE:    17,
  WATER:        18,
  LAVA:         19,
  GLOWSTONE:    20,
  NETHERRACK:   21,
  ICE:          22,
  SNOW_TOP:     23,
  SNOW_SIDE:    24,
  STONE_BRICK:  25,
  CRAFT_TOP:    26,
  CRAFT_SIDE:   27,
  FURN_FRONT:   28,
  FURN_SIDE:    29,
  GLASS:        30,
  IRON_BLOCK:   31,
  GOLD_BLOCK:   32,
  DIAMOND_BLOCK:33,
  CLAY:         34,
};

function all(t) { return [t,t,t,t,t,t]; }
function column(side, top) { return [side,side,top,top,side,side]; }
function sided(side, top, bot) { return [side,side,top,bot,side,side]; }

const DEFS = {
  [B.AIR]:           null,
  [B.GRASS]:         { name:'Grass',         faces: sided(T.GRASS_SIDE, T.GRASS_TOP, T.DIRT), solid:true,  hard:0.6,  tool:null,     drops:B.DIRT     },
  [B.DIRT]:          { name:'Dirt',           faces: all(T.DIRT),                              solid:true,  hard:0.5,  tool:'shovel', drops:B.DIRT     },
  [B.STONE]:         { name:'Stone',          faces: all(T.STONE),                             solid:true,  hard:1.5,  tool:'pickaxe',drops:B.COBBLESTONE},
  [B.SAND]:          { name:'Sand',           faces: all(T.SAND),                              solid:true,  hard:0.5,  tool:'shovel', drops:B.SAND     },
  [B.GRAVEL]:        { name:'Gravel',         faces: all(T.GRAVEL),                            solid:true,  hard:0.6,  tool:'shovel', drops:B.GRAVEL   },
  [B.BEDROCK]:       { name:'Bedrock',        faces: all(T.BEDROCK),                           solid:true,  hard:-1,   tool:null,     drops:null       },
  [B.COBBLESTONE]:   { name:'Cobblestone',    faces: all(T.COBBLE),                            solid:true,  hard:2.0,  tool:'pickaxe',drops:B.COBBLESTONE},
  [B.OAK_LOG]:       { name:'Oak Log',        faces: column(T.LOG_SIDE, T.LOG_TOP),            solid:true,  hard:2.0,  tool:'axe',    drops:B.OAK_LOG  },
  [B.OAK_LEAVES]:    { name:'Oak Leaves',     faces: all(T.LEAVES),                            solid:false, hard:0.2,  tool:null,     drops:null, transparent:true, tint:0x3a8a2a },
  [B.OAK_PLANKS]:    { name:'Oak Planks',     faces: all(T.PLANKS),                            solid:true,  hard:2.0,  tool:'axe',    drops:B.OAK_PLANKS},
  [B.GLASS]:         { name:'Glass',          faces: all(T.GLASS),                             solid:true,  hard:0.3,  tool:null,     drops:B.GLASS, transparent:true  },
  [B.COAL_ORE]:      { name:'Coal Ore',       faces: all(T.COAL_ORE),                          solid:true,  hard:3.0,  tool:'pickaxe',drops:B.COAL_ORE    },
  [B.IRON_ORE]:      { name:'Iron Ore',       faces: all(T.IRON_ORE),                          solid:true,  hard:3.0,  tool:'pickaxe',drops:B.IRON_ORE    },
  [B.GOLD_ORE]:      { name:'Gold Ore',       faces: all(T.GOLD_ORE),                          solid:true,  hard:3.0,  tool:'pickaxe',drops:B.GOLD_ORE    },
  [B.DIAMOND_ORE]:   { name:'Diamond Ore',    faces: all(T.DIAMOND_ORE),                       solid:true,  hard:3.0,  tool:'pickaxe',drops:B.DIAMOND_ORE  },
  [B.SANDSTONE]:     { name:'Sandstone',      faces: sided(T.SANDSTONE, T.SANDSTONE_TOP, T.SANDSTONE_TOP), solid:true, hard:0.8, tool:'pickaxe', drops:B.SANDSTONE },
  [B.WATER]:         { name:'Water',          faces: all(T.WATER),                             solid:false, hard:-1,   tool:null,     drops:null, transparent:true, fluid:true   },
  [B.LAVA]:          { name:'Lava',           faces: all(T.LAVA),                              solid:false, hard:-1,   tool:null,     drops:null, lightEmit:15, fluid:true         },
  [B.GLOWSTONE]:     { name:'Glowstone',      faces: all(T.GLOWSTONE),                         solid:true,  hard:0.3,  tool:'pickaxe',drops:B.GLOWSTONE, lightEmit:15                },
  [B.NETHERRACK]:    { name:'Netherrack',     faces: all(T.NETHERRACK),                        solid:true,  hard:0.4,  tool:'pickaxe',drops:B.NETHERRACK },
  [B.ICE]:           { name:'Ice',            faces: all(T.ICE),                               solid:true,  hard:0.5,  tool:'pickaxe',drops:null, transparent:true },
  [B.SNOW]:          { name:'Snow',           faces: sided(T.SNOW_SIDE, T.SNOW_TOP, T.DIRT),   solid:true,  hard:0.2,  tool:'shovel', drops:B.SNOW    },
  [B.STONE_BRICK]:   { name:'Stone Brick',    faces: all(T.STONE_BRICK),                       solid:true,  hard:1.5,  tool:'pickaxe',drops:B.STONE_BRICK },
  [B.CRAFTING_TABLE]:{ name:'Crafting Table', faces:[T.CRAFT_SIDE,T.CRAFT_SIDE,T.CRAFT_TOP,T.PLANKS,T.CRAFT_SIDE,T.CRAFT_SIDE], solid:true, hard:2.5, tool:'axe', drops:B.CRAFTING_TABLE, interactive:'crafting' },
  [B.FURNACE]:       { name:'Furnace',        faces:[T.FURN_SIDE,T.FURN_SIDE,T.FURN_SIDE,T.FURN_SIDE,T.FURN_FRONT,T.FURN_SIDE], solid:true, hard:3.5, tool:'pickaxe', drops:B.FURNACE, interactive:'furnace' },
  [B.TORCH]:         { name:'Torch',          faces: all(T.GLOWSTONE),                         solid:false, hard:0,    tool:null,     drops:null, lightEmit:14, transparent:true  },
  [B.IRON_BLOCK]:    { name:'Iron Block',     faces: all(T.IRON_BLOCK),                        solid:true,  hard:5.0,  tool:'pickaxe',drops:B.IRON_BLOCK },
  [B.GOLD_BLOCK]:    { name:'Gold Block',     faces: all(T.GOLD_BLOCK),                        solid:true,  hard:3.0,  tool:'pickaxe',drops:B.GOLD_BLOCK },
  [B.DIAMOND_BLOCK]: { name:'Diamond Block',  faces: all(T.DIAMOND_BLOCK),                     solid:true,  hard:5.0,  tool:'pickaxe',drops:B.DIAMOND_BLOCK },
  [B.CLAY]:          { name:'Clay',           faces: all(T.CLAY),                              solid:true,  hard:0.6,  tool:'shovel', drops:B.CLAY    },
  [B.SNOW_BLOCK]:    { name:'Snow Block',     faces: all(T.SNOW_TOP),                          solid:true,  hard:0.2,  tool:'shovel', drops:B.SNOW    },
};

export const BlockRegistry = {
  get(id)           { return DEFS[id] ?? null; },
  isSolid(id)       { return DEFS[id]?.solid ?? false; },
  isTransparent(id) { return !DEFS[id] || !!DEFS[id].transparent; },
  isFluid(id)       { return !!DEFS[id]?.fluid; },
  hardness(id)      { return DEFS[id]?.hard ?? 0; },
  name(id)          { return DEFS[id]?.name ?? 'Air'; },
  all()             { return Object.entries(DEFS).filter(([,v])=>v).map(([k,v])=>({id:+k,...v})); },
  textureIds        : T,
};
