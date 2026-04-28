import { TILE_SIZE, CHUNK_SIZE, TILES } from '../utils/constants.js';
import { TileRegistry } from '../utils/TileRegistry.js';

// Per-tile pixel-art draw functions
const TILE_DRAW = {};

function solid(id, color, detail = null) {
  TILE_DRAW[id] = (ctx, x, y, s) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    if (detail) detail(ctx, x, y, s);
  };
}

function drawGrass(ctx, x, y, s) {
  ctx.fillStyle = '#5d8a3c'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#4a7a2a'; ctx.fillRect(x, y, s, Math.max(2, s >> 2));
  ctx.fillStyle = '#6b3a2a'; ctx.fillRect(x, y + Math.max(2, s >> 2), s, s - Math.max(2, s >> 2));
}
function drawDirt(ctx, x, y, s) {
  ctx.fillStyle = '#6b3a2a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#5a2a1a'; ctx.fillRect(x + 1, y + 1, 2, 2);
  ctx.fillStyle = '#7a4a3a'; ctx.fillRect(x + s - 3, y + s - 3, 2, 2);
}
function drawStone(ctx, x, y, s) {
  ctx.fillStyle = '#7a7a7a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#888888'; ctx.fillRect(x + 1, y + 1, s - 2, 1);
  ctx.fillStyle = '#666666'; ctx.fillRect(x + 1, y + s - 2, s - 2, 1);
}
function drawSand(ctx, x, y, s) {
  ctx.fillStyle = '#d4b463'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#c8a850'; ctx.fillRect(x + 2, y + 2, 2, 1);
  ctx.fillStyle = '#e0c070'; ctx.fillRect(x + s - 4, y + 1, 2, 1);
}
function drawLog(ctx, x, y, s, bark, ring) {
  ctx.fillStyle = bark; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = ring;
  const m = Math.max(1, s >> 3);
  ctx.fillRect(x + m, y + m, s - m * 2, s - m * 2);
}
function drawLeaves(ctx, x, y, s, color) {
  ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y + s - 2, s, 2);
  ctx.globalAlpha = 1;
}
function drawOre(ctx, x, y, s, base, spot) {
  drawStone(ctx, x, y, s);
  ctx.fillStyle = spot;
  ctx.fillRect(x + 2, y + 2, 2, 2);
  ctx.fillRect(x + s - 4, y + s - 4, 2, 2);
  ctx.fillRect(x + 2, y + s - 4, 2, 2);
}
function drawTorch(ctx, x, y, s) {
  const cx = x + s / 2;
  ctx.fillStyle = '#8b5c14'; ctx.fillRect(cx - 1, y + 4, 2, s - 4);
  ctx.fillStyle = '#ff9900'; ctx.fillRect(cx - 2, y, 4, 4);
  ctx.fillStyle = '#ffee44'; ctx.fillRect(cx - 1, y + 1, 2, 2);
}
function drawWater(ctx, x, y, s) {
  ctx.fillStyle = '#1a5a9a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#2a7abf';
  ctx.fillRect(x, y, s, 2);
  ctx.fillRect(x, y + 6, s, 2);
}
function drawLava(ctx, x, y, s) {
  ctx.fillStyle = '#ff4400'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#ff8800';
  ctx.fillRect(x + 1, y + 1, 4, 2);
  ctx.fillRect(x + s - 5, y + 3, 3, 2);
}
function drawCactus(ctx, x, y, s) {
  ctx.fillStyle = '#2a7a1a'; ctx.fillRect(x + 3, y, s - 6, s);
  ctx.fillStyle = '#3a9a2a';
  ctx.fillRect(x + 3, y + 2, s - 6, 2);
  ctx.fillRect(x + 3, y + 8, s - 6, 2);
}
function drawGlowstone(ctx, x, y, s) {
  ctx.fillStyle = '#ffee88'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 2, 4, 4);
  ctx.fillStyle = '#ffcc00'; ctx.fillRect(x + s - 6, y + s - 6, 4, 4);
}
function drawFlower(ctx, x, y, s, color) {
  ctx.fillStyle = '#3a7a1a'; ctx.fillRect(x + s / 2 - 1, y + s / 2, 2, s / 2);
  ctx.fillStyle = color; ctx.fillRect(x + s / 2 - 3, y + 2, 6, 6);
}
function drawTallGrass(ctx, x, y, s) {
  ctx.fillStyle = '#3a7a1a';
  ctx.fillRect(x + 3, y + 4, 2, s - 4);
  ctx.fillRect(x + s - 5, y + 6, 2, s - 6);
}
function drawChest(ctx, x, y, s) {
  ctx.fillStyle = '#c89632'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#8b4513'; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = '#c89632'; ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
  ctx.fillStyle = '#ffd700'; ctx.fillRect(x + s / 2 - 1, y + s / 2 - 1, 3, 3);
}
function drawCraftingTable(ctx, x, y, s) {
  ctx.fillStyle = '#8b4513'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#a0522d'; ctx.fillRect(x + 1, y + 1, s - 2, s / 2 - 1);
  ctx.fillStyle = '#2a5a1a'; ctx.fillRect(x + 1, y + s / 2, s - 2, s / 2 - 1);
  ctx.fillStyle = '#888'; ctx.fillRect(x + 4, y + 4, 2, 2); ctx.fillRect(x + s - 6, y + 4, 2, 2);
}
function drawFurnace(ctx, x, y, s) {
  ctx.fillStyle = '#888888'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#555'; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = '#ff8800'; ctx.fillRect(x + s / 2 - 3, y + s / 2 - 1, 6, 4);
}
function drawStoneBrick(ctx, x, y, s) {
  ctx.fillStyle = '#5a5a6a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#444455';
  ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s);
  ctx.fillRect(x, y + s / 2, s, 1);
  ctx.fillRect(x + s / 2, y, 1, s / 2);
}
function drawGlass(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(128,192,224,0.35)'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(200,240,255,0.6)';
  ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s);
  ctx.fillRect(x, y + s - 1, s, 1); ctx.fillRect(x + s - 1, y, 1, s);
}
function drawIce(ctx, x, y, s) {
  ctx.fillStyle = '#b0d0e0'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(200,240,255,0.5)'; ctx.fillRect(x + 1, y + 1, s - 2, s / 3);
}
function drawBedrock(ctx, x, y, s) {
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#222'; ctx.fillRect(x + 2, y + 2, 3, 3);
  ctx.fillStyle = '#111'; ctx.fillRect(x + s - 5, y + s - 5, 3, 3);
}
function drawObsidian(ctx, x, y, s) {
  ctx.fillStyle = '#1a0a2a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#2a1a4a'; ctx.fillRect(x + 1, y + 1, 4, 4);
}
function drawSnow(ctx, x, y, s) {
  ctx.fillStyle = '#e8eeff'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, s, s >> 2);
}
function drawGrassSnow(ctx, x, y, s) {
  ctx.fillStyle = '#aaccee'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#e8eeff'; ctx.fillRect(x, y, s, Math.max(2, s >> 2));
  ctx.fillStyle = '#6b3a2a'; ctx.fillRect(x, y + Math.max(2, s >> 2), s, s - Math.max(2, s >> 2));
}
function drawVine(ctx, x, y, s) {
  ctx.fillStyle = '#1a6a0a';
  ctx.fillRect(x + s - 3, y, 2, s);
  ctx.fillRect(x + 2, y + 3, 3, 2);
  ctx.fillRect(x + 2, y + 9, 3, 2);
}
function drawSandstone(ctx, x, y, s) {
  ctx.fillStyle = '#c8a850'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#b89840'; ctx.fillRect(x, y + s / 2, s, 1);
  ctx.fillStyle = '#d8b860'; ctx.fillRect(x + 2, y + 2, s - 4, 2);
}
function drawNetherrack(ctx, x, y, s) {
  ctx.fillStyle = '#6a1a1a'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#7a2a2a'; ctx.fillRect(x + 1, y + 1, 3, 3);
  ctx.fillStyle = '#5a0a0a'; ctx.fillRect(x + s - 4, y + s - 4, 3, 3);
}
function drawHellstone(ctx, x, y, s) {
  ctx.fillStyle = '#4a1a00'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#ff4400'; ctx.fillRect(x + 2, y + 2, 2, 2);
  ctx.fillRect(x + s - 4, y + s - 4, 2, 2);
}
function drawClay(ctx, x, y, s) {
  ctx.fillStyle = '#9aacbc'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#8a9cac'; ctx.fillRect(x + 1, y + 1, s - 2, 1);
}
function drawBlock(ctx, x, y, s, color, highlight) {
  ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = highlight; ctx.fillRect(x + 1, y + 1, s - 2, 2);
}
function drawGravel(ctx, x, y, s) {
  ctx.fillStyle = '#808080'; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#707070'; ctx.fillRect(x + 1, y + 1, 3, 3);
  ctx.fillStyle = '#909090'; ctx.fillRect(x + s - 4, y + 2, 3, 3);
}

// Register draw functions
TILE_DRAW[TILES.AIR]            = null;
TILE_DRAW[TILES.GRASS]          = drawGrass;
TILE_DRAW[TILES.DIRT]           = drawDirt;
TILE_DRAW[TILES.STONE]          = drawStone;
TILE_DRAW[TILES.SAND]           = drawSand;
TILE_DRAW[TILES.GRAVEL]         = drawGravel;
TILE_DRAW[TILES.BEDROCK]        = drawBedrock;
TILE_DRAW[TILES.SNOW_DIRT]      = drawSnow;
TILE_DRAW[TILES.COAL_ORE]       = (ctx, x, y, s) => drawOre(ctx, x, y, s, '#5a5a5a', '#222222');
TILE_DRAW[TILES.IRON_ORE]       = (ctx, x, y, s) => drawOre(ctx, x, y, s, '#8a6a4a', '#c0a080');
TILE_DRAW[TILES.GOLD_ORE]       = (ctx, x, y, s) => drawOre(ctx, x, y, s, '#7a7040', '#ffd700');
TILE_DRAW[TILES.DIAMOND_ORE]    = (ctx, x, y, s) => drawOre(ctx, x, y, s, '#4a7a9a', '#44ddff');
TILE_DRAW[TILES.HELLSTONE]      = drawHellstone;
TILE_DRAW[TILES.OBSIDIAN]       = drawObsidian;
TILE_DRAW[TILES.SANDSTONE]      = drawSandstone;
TILE_DRAW[TILES.ICE]            = drawIce;
TILE_DRAW[TILES.OAK_LOG]        = (ctx, x, y, s) => drawLog(ctx, x, y, s, '#5a3a1a', '#8a6a4a');
TILE_DRAW[TILES.PINE_LOG]       = (ctx, x, y, s) => drawLog(ctx, x, y, s, '#4a2a0a', '#7a5a3a');
TILE_DRAW[TILES.JUNGLE_LOG]     = (ctx, x, y, s) => drawLog(ctx, x, y, s, '#3a5a1a', '#6a8a4a');
TILE_DRAW[TILES.OAK_LEAVES]     = (ctx, x, y, s) => drawLeaves(ctx, x, y, s, '#2a7a1a');
TILE_DRAW[TILES.PINE_LEAVES]    = (ctx, x, y, s) => drawLeaves(ctx, x, y, s, '#1a5a0a');
TILE_DRAW[TILES.JUNGLE_LEAVES]  = (ctx, x, y, s) => drawLeaves(ctx, x, y, s, '#1a8a2a');
TILE_DRAW[TILES.CACTUS]         = drawCactus;
TILE_DRAW[TILES.COBBLESTONE]    = (ctx, x, y, s) => { drawStone(ctx, x, y, s); ctx.fillStyle = '#505050'; ctx.fillRect(x+1,y+1,3,3); ctx.fillRect(x+s-4,y+s-4,3,3); };
TILE_DRAW[TILES.OAK_PLANKS]     = (ctx, x, y, s) => { ctx.fillStyle='#c8964a'; ctx.fillRect(x,y,s,s); ctx.fillStyle='#b8864a'; ctx.fillRect(x,y+s/2,s,1); ctx.fillRect(x+s/2,y,1,s/2); };
TILE_DRAW[TILES.PINE_PLANKS]    = (ctx, x, y, s) => { ctx.fillStyle='#8a5a2a'; ctx.fillRect(x,y,s,s); ctx.fillStyle='#7a4a1a'; ctx.fillRect(x,y+s/2,s,1); ctx.fillRect(x+s/2,y,1,s/2); };
TILE_DRAW[TILES.STONE_BRICK]    = drawStoneBrick;
TILE_DRAW[TILES.GLASS]          = drawGlass;
TILE_DRAW[TILES.TORCH]          = drawTorch;
TILE_DRAW[TILES.CHEST]          = drawChest;
TILE_DRAW[TILES.CRAFTING_TABLE] = drawCraftingTable;
TILE_DRAW[TILES.FURNACE]        = drawFurnace;
TILE_DRAW[TILES.WATER]          = drawWater;
TILE_DRAW[TILES.LAVA]           = drawLava;
TILE_DRAW[TILES.GRASS_SNOW]     = drawGrassSnow;
TILE_DRAW[TILES.FLOWER_RED]     = (ctx, x, y, s) => drawFlower(ctx, x, y, s, '#ff4444');
TILE_DRAW[TILES.FLOWER_YELLOW]  = (ctx, x, y, s) => drawFlower(ctx, x, y, s, '#ffdd44');
TILE_DRAW[TILES.TALL_GRASS]     = drawTallGrass;
TILE_DRAW[TILES.VINE]           = drawVine;
TILE_DRAW[TILES.GLOWSTONE]      = drawGlowstone;
TILE_DRAW[TILES.NETHERRACK]     = drawNetherrack;
TILE_DRAW[TILES.CLAY]           = drawClay;
TILE_DRAW[TILES.IRON_BLOCK]     = (ctx, x, y, s) => drawBlock(ctx, x, y, s, '#c0c0c0', '#e0e0e0');
TILE_DRAW[TILES.GOLD_BLOCK]     = (ctx, x, y, s) => drawBlock(ctx, x, y, s, '#ffd700', '#ffee88');
TILE_DRAW[TILES.DIAMOND_BLOCK]  = (ctx, x, y, s) => drawBlock(ctx, x, y, s, '#44ddff', '#aaffff');

export class ChunkRenderer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this._cache = new Map(); // key -> { image, canvas, ctx, dirty }
  }

  getChunkImage(cx, cy) {
    const key = `${cx},${cy}`;
    if (!this._cache.has(key)) {
      this._buildChunkCanvas(cx, cy, key);
    }
    const entry = this._cache.get(key);
    if (entry.dirty) {
      this._redrawChunk(cx, cy, entry);
      entry.dirty = false;
    }
    return entry.image;
  }

  markDirty(tx, ty) {
    const key = `${tx >> 5},${ty >> 5}`;
    if (this._cache.has(key)) this._cache.get(key).dirty = true;
  }

  _buildChunkCanvas(cx, cy, key) {
    const size = CHUNK_SIZE * TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const texKey = `chunk_${key}`;
    this._drawChunk(cx, cy, ctx);
    this.scene.textures.addCanvas(texKey, canvas);
    const image = this.scene.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);
    this._cache.set(key, { image, canvas, ctx, texKey, dirty: false });
    return image;
  }

  _redrawChunk(cx, cy, entry) {
    this._drawChunk(cx, cy, entry.ctx);
    // Update the Phaser texture from the canvas
    const tex = this.scene.textures.get(entry.texKey);
    if (tex) tex.refresh();
  }

  _drawChunk(cx, cy, ctx) {
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;
    ctx.clearRect(0, 0, CHUNK_SIZE * TILE_SIZE, CHUNK_SIZE * TILE_SIZE);
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = this.world.getTile(baseX + lx, baseY + ly);
        if (id === TILES.AIR) continue;
        const drawFn = TILE_DRAW[id];
        if (drawFn) {
          drawFn(ctx, lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE);
        } else {
          // Fallback: solid color
          const def = TileRegistry.get(id);
          const hex = def.cssColor !== 'transparent' ? def.cssColor : '#ff00ff';
          ctx.fillStyle = hex;
          ctx.fillRect(lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  positionChunks(camLeft, camTop) {
    for (const [key, entry] of this._cache) {
      const [cx, cy] = key.split(',').map(Number);
      entry.image.x = cx * CHUNK_SIZE * TILE_SIZE - camLeft;
      entry.image.y = cy * CHUNK_SIZE * TILE_SIZE - camTop;
    }
  }

  destroy() {
    for (const [key, entry] of this._cache) {
      entry.image.destroy();
      this.scene.textures.remove(entry.texKey);
    }
    this._cache.clear();
  }
}
