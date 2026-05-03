import { B, ITEMS } from '../utils/constants.js';

// Draws a 16×16 pixel-art sprite for any block or item ID onto ctx.
// size defaults to 16; pass larger values for bigger slots.
export function drawItemSprite(ctx, id, size = 16) {
  const s = size / 16;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const px = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.ceil(s), Math.ceil(s));
  };
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.round(w * s), Math.round(h * s));
  };

  switch (id) {
    // ── Blocks ──────────────────────────────────────────────────────────────
    case B.GRASS:         _grass(rect, px);        break;
    case B.DIRT:          _dirt(rect, px);         break;
    case B.STONE:         _stone(rect, px);        break;
    case B.COBBLESTONE:   _cobble(rect, px);       break;
    case B.SAND:          _sand(rect, px);         break;
    case B.GRAVEL:        _gravel(rect, px);       break;
    case B.OAK_LOG:       _log(rect, px);          break;
    case B.OAK_PLANKS:    _planks(rect, px);       break;
    case B.OAK_LEAVES:    _leaves(rect, px);       break;
    case B.GLASS:         _glass(rect, px);        break;
    case B.COAL_ORE:      _ore(rect, px, '#333');  break;
    case B.IRON_ORE:      _ore(rect, px, '#c8a07a'); break;
    case B.GOLD_ORE:      _ore(rect, px, '#ffd700'); break;
    case B.DIAMOND_ORE:   _ore(rect, px, '#44ddff'); break;
    case B.SANDSTONE:     _sandstone(rect, px);   break;
    case B.WATER:         _water(rect);            break;
    case B.LAVA:          _lava(rect, px);         break;
    case B.GLOWSTONE:     _glowstone(rect, px);   break;
    case B.NETHERRACK:    _netherrack(rect, px);  break;
    case B.ICE:           _ice(rect);              break;
    case B.SNOW:          _snow(rect);             break;
    case B.STONE_BRICK:   _stoneBrick(rect, px);  break;
    case B.CRAFTING_TABLE:_craftingTable(rect, px);break;
    case B.FURNACE:       _furnace(rect, px);      break;
    case B.TORCH:         _torch(rect, px);        break;
    case B.IRON_BLOCK:    rect(0,0,16,16,'#d0d0d0'); _metalSheen(rect,'#e8e8e8','#b0b0b0'); break;
    case B.GOLD_BLOCK:    rect(0,0,16,16,'#ffd700'); _metalSheen(rect,'#ffe44a','#cca800'); break;
    case B.DIAMOND_BLOCK: rect(0,0,16,16,'#44ddff'); _metalSheen(rect,'#88eeff','#22aacc'); break;
    case B.BEDROCK:       _bedrock(rect, px);      break;
    // ── Items ────────────────────────────────────────────────────────────────
    case ITEMS.WOODEN_SWORD:    _sword(rect, px, '#c8a060', '#8b5e1a'); break;
    case ITEMS.STONE_SWORD:     _sword(rect, px, '#aaaaaa', '#888888'); break;
    case ITEMS.IRON_SWORD:      _sword(rect, px, '#d8e8f8', '#aabbcc'); break;
    case ITEMS.DIAMOND_SWORD:   _sword(rect, px, '#44ddff', '#22aacc'); break;
    case ITEMS.APPLE:           _apple(rect, px);  break;
    case ITEMS.STICK:           _stick(rect, px);  break;
    case ITEMS.WOODEN_PICKAXE:  _pickaxe(rect, px, '#c8a060', '#8b5e1a'); break;
    case ITEMS.STONE_PICKAXE:   _pickaxe(rect, px, '#aaaaaa', '#888888'); break;
    case ITEMS.IRON_PICKAXE:    _pickaxe(rect, px, '#d8e8f8', '#aabbcc'); break;
    case ITEMS.DIAMOND_PICKAXE: _pickaxe(rect, px, '#44ddff', '#22aacc'); break;
    // ── Default: solid color swatch ──────────────────────────────────────────
    default: rect(0, 0, 16, 16, '#555'); break;
  }
}

// ── Block sprites ────────────────────────────────────────────────────────────

function _grass(rect, px) {
  rect(0, 0, 16, 16, '#8b5e2e');
  rect(0, 0, 16, 5, '#3a8a2a');
  // grass highlights
  for (const [x, y] of [[2,1],[5,0],[9,2],[12,1],[14,0],[1,3],[7,1],[11,3]])
    px(x, y, '#5bc44a');
  // dirt noise
  for (const [x, y] of [[3,7],[7,10],[11,8],[4,13],[9,12],[13,9]])
    px(x, y, '#7a4f22');
}

function _dirt(rect, px) {
  rect(0, 0, 16, 16, '#8b5e2e');
  for (const [x, y] of [[2,2],[6,1],[10,3],[14,1],[1,6],[5,8],[9,5],[13,7],[3,11],[7,13],[11,10],[15,12]])
    px(x, y, '#7a4f22');
  for (const [x, y] of [[4,4],[8,6],[12,9],[0,9],[6,12],[14,14]])
    px(x, y, '#a06535');
}

function _stone(rect, px) {
  rect(0, 0, 16, 16, '#7a7a7a');
  for (const [x, y] of [[1,2],[4,1],[8,3],[12,1],[15,4],[2,6],[6,8],[10,5],[14,7],[0,10],[3,12],[7,11],[11,13],[15,10]])
    px(x, y, '#666666');
  for (const [x, y] of [[2,4],[9,7],[5,12],[13,3],[0,14]])
    px(x, y, '#909090');
  // crack lines
  for (let i = 3; i < 12; i++) px(i, 5, '#686868');
  for (let i = 8; i < 15; i++) px(i, 11, '#686868');
}

function _cobble(rect, px) {
  rect(0, 0, 16, 16, '#888888');
  // mortar grid
  for (let x = 0; x < 16; x++) { px(x, 4, '#555'); px(x, 9, '#555'); px(x, 14, '#555'); }
  for (let y = 0; y < 4; y++) px(4, y, '#555');
  for (let y = 5; y < 9; y++) px(7, y, '#555');
  for (let y = 10; y < 14; y++) px(3, y, '#555');
  for (let y = 10; y < 14; y++) px(10, y, '#555');
  // stone shading
  for (const [x, y] of [[1,1],[5,6],[9,11],[12,2],[2,12]])
    px(x, y, '#aaa');
  for (const [x, y] of [[3,3],[8,7],[11,12],[14,1],[6,14]])
    px(x, y, '#666');
}

function _sand(rect, px) {
  rect(0, 0, 16, 16, '#d4c07a');
  for (const [x, y] of [[2,1],[5,3],[9,0],[13,2],[1,5],[6,6],[11,4],[15,7],[3,9],[7,11],[10,13],[14,10]])
    px(x, y, '#c4b060');
  for (const [x, y] of [[4,2],[8,5],[12,8],[0,12],[5,14]])
    px(x, y, '#e4d090');
}

function _gravel(rect, px) {
  rect(0, 0, 16, 16, '#888878');
  for (const [x, y] of [[1,1],[4,3],[8,1],[12,2],[2,6],[6,5],[10,7],[14,5],[1,10],[5,12],[9,10],[13,12],[3,14],[11,15]])
    px(x, y, '#666655');
  for (const [x, y] of [[3,2],[7,4],[11,3],[0,7],[4,9],[8,8],[12,11],[2,13],[7,15]])
    px(x, y, '#aaaaaa');
}

function _log(rect, px) {
  rect(0, 0, 16, 16, '#7a4a20');
  // vertical wood grain stripes
  for (let y = 0; y < 16; y++) {
    px(1, y, '#6a3a10'); px(5, y, '#8a5a30'); px(9, y, '#6a3a10'); px(13, y, '#8a5a30');
  }
  // rings on top/bottom suggestion
  rect(0, 0, 16, 1, '#5a3010');
  rect(0, 15, 16, 1, '#5a3010');
}

function _planks(rect, px) {
  rect(0, 0, 16, 16, '#c08040');
  // horizontal plank lines every 4px
  for (let x = 0; x < 16; x++) { px(x, 4, '#a06030'); px(x, 9, '#a06030'); }
  // vertical groove dividers
  for (let y = 0; y < 4; y++)   px(8, y, '#b07038');
  for (let y = 5; y < 9; y++)   px(3, y, '#b07038');
  for (let y = 10; y < 16; y++) px(11, y, '#b07038');
  // grain
  for (const [x, y] of [[2,1],[6,3],[10,1],[14,2],[1,6],[5,7],[9,6],[13,8],[3,11],[7,13],[11,12],[15,14]])
    px(x, y, '#b87848');
}

function _leaves(rect, px) {
  const spots = [[0,0],[2,0],[4,0],[6,0],[8,0],[10,0],[12,0],[14,0],[1,1],[3,1],[5,1],[7,1],[9,1],[11,1],[13,1],[15,1],
    [0,2],[2,2],[4,2],[6,2],[8,2],[10,2],[12,2],[14,2],[1,3],[3,3],[5,3],[7,3],[9,3],[11,3],[13,3],[15,3],
    [0,4],[2,4],[4,4],[6,4],[8,4],[10,4],[12,4],[14,4],[1,5],[3,5],[5,5],[7,5],[9,5],[11,5],[13,5],[15,5],
    [0,6],[2,6],[4,6],[6,6],[8,6],[10,6],[12,6],[14,6],[1,7],[3,7],[5,7],[7,7],[9,7],[11,7],[13,7],[15,7],
    [0,8],[2,8],[4,8],[6,8],[8,8],[10,8],[12,8],[14,8],[1,9],[3,9],[5,9],[7,9],[9,9],[11,9],[13,9],[15,9],
    [0,10],[2,10],[4,10],[6,10],[8,10],[10,10],[12,10],[14,10],[1,11],[3,11],[5,11],[7,11],[9,11],[11,11],[13,11],[15,11],
    [0,12],[2,12],[4,12],[6,12],[8,12],[10,12],[12,12],[14,12],[1,13],[3,13],[5,13],[7,13],[9,13],[11,13],[13,13],[15,13],
    [0,14],[2,14],[4,14],[6,14],[8,14],[10,14],[12,14],[14,14],[1,15],[3,15],[5,15],[7,15],[9,15],[11,15],[13,15],[15,15]];
  rect(0, 0, 16, 16, '#1a4a0a');
  for (const [x, y] of spots) px(x, y, '#2a6a1a');
}

function _glass(rect) {
  rect(0, 0, 16, 16, '#aaddff');
  rect(1, 1, 14, 14, '#cceeff');
  rect(2, 2, 12, 12, '#ddeeff');
}

function _ore(rect, px, oreColor) {
  _stone(rect, px);
  // ore spots
  for (const [x, y] of [[2,3],[5,2],[10,4],[13,2],[1,8],[6,9],[11,7],[14,9],[3,13],[8,12],[12,14]])
    rect(x, y, 2, 2, oreColor);
  // highlight
  for (const [x, y] of [[2,3],[10,4],[6,9],[3,13]])
    px(x, y, lighten(oreColor));
}

function _sandstone(rect, px) {
  rect(0, 0, 16, 16, '#d4b860');
  for (let x = 0; x < 16; x++) { px(x, 5, '#c4a850'); px(x, 10, '#c4a850'); }
  for (const [x, y] of [[2,2],[7,3],[12,1],[4,7],[9,8],[14,6],[1,12],[6,13],[11,12]])
    px(x, y, '#e4c870');
}

function _water(rect) {
  rect(0, 0, 16, 16, '#1a4aaa');
  rect(0, 0, 16, 3, '#2255cc');
  rect(0, 6, 16, 2, '#2255cc');
  rect(0, 11, 16, 2, '#2255cc');
}

function _lava(rect, px) {
  rect(0, 0, 16, 16, '#aa2200');
  for (const [x, y] of [[1,1],[4,0],[8,2],[12,0],[2,4],[6,3],[10,5],[14,3],[0,7],[5,8],[9,6],[13,8],[2,11],[7,10],[11,12],[15,10],[3,14],[8,15],[12,13]])
    px(x, y, '#ff6600');
  for (const [x, y] of [[3,2],[9,1],[6,6],[12,7],[4,12],[10,14]])
    px(x, y, '#ffaa00');
}

function _glowstone(rect, px) {
  rect(0, 0, 16, 16, '#ffe040');
  for (const [x, y] of [[1,1],[4,3],[8,1],[12,2],[2,7],[6,5],[10,8],[14,6],[0,11],[4,13],[9,10],[13,12],[2,15],[7,14]])
    px(x, y, '#ffff80');
  for (const [x, y] of [[3,5],[7,3],[11,5],[5,10],[9,13]])
    px(x, y, '#cc9900');
}

function _netherrack(rect, px) {
  rect(0, 0, 16, 16, '#6a1a1a');
  for (const [x, y] of [[2,1],[5,3],[9,1],[13,2],[1,6],[6,5],[10,7],[14,5],[0,10],[4,12],[8,10],[12,13],[3,14],[9,15]])
    px(x, y, '#4a0a0a');
  for (const [x, y] of [[4,2],[8,4],[12,1],[2,8],[7,9],[11,11],[5,14]])
    px(x, y, '#8a2a2a');
}

function _ice(rect) {
  rect(0, 0, 16, 16, '#99ccff');
  rect(1, 1, 14, 1, '#bbddff');
  rect(1, 1, 1, 14, '#bbddff');
  rect(3, 5, 4, 1, '#88bbee');
  rect(9, 9, 5, 1, '#88bbee');
}

function _snow(rect) {
  rect(0, 0, 16, 16, '#eeeeff');
  rect(0, 0, 16, 2, '#ffffff');
  rect(0, 14, 16, 2, '#ddddee');
}

function _stoneBrick(rect, px) {
  rect(0, 0, 16, 16, '#888888');
  for (let x = 0; x < 16; x++) { px(x, 7, '#555'); px(x, 14, '#555'); }
  for (let y = 0; y < 7; y++)  px(8, y, '#555');
  for (let y = 8; y < 14; y++) px(4, y, '#555');
  for (let y = 8; y < 14; y++) px(12, y, '#555');
  rect(0, 0, 1, 7, '#555'); rect(15, 0, 1, 7, '#555');
}

function _craftingTable(rect, px) {
  rect(0, 0, 16, 16, '#9a5020');
  rect(0, 0, 16, 2, '#7a3a10');
  // grid lines on top face
  for (let x = 0; x < 16; x++) { px(x, 5, '#7a3a10'); px(x, 10, '#7a3a10'); }
  for (let y = 0; y < 16; y++) { px(5, y, '#7a3a10'); px(10, y, '#7a3a10'); }
  // highlights in cells
  for (const [x, y] of [[1,1],[6,1],[11,1],[1,6],[6,6],[11,6],[1,11],[6,11],[11,11]])
    px(x, y, '#c07040');
}

function _furnace(rect, px) {
  rect(0, 0, 16, 16, '#888888');
  // stone base texture
  for (const [x, y] of [[2,1],[6,3],[10,1],[14,2],[1,13],[5,14],[9,13],[13,14]])
    px(x, y, '#666');
  // fire opening
  rect(4, 6, 8, 7, '#111111');
  rect(5, 7, 6, 5, '#cc4400');
  rect(6, 8, 4, 3, '#ff8800');
  px(7, 9, '#ffcc00');
}

function _torch(rect, px) {
  // stick
  rect(7, 7, 2, 9, '#8b5e1a');
  // flame
  rect(6, 4, 4, 4, '#ff8800');
  rect(7, 2, 2, 4, '#ffcc00');
  px(8, 1, '#ffff00');
  px(7, 3, '#ffffff');
}

function _bedrock(rect, px) {
  rect(0, 0, 16, 16, '#202020');
  for (const [x, y] of [[2,1],[6,3],[10,1],[14,2],[1,6],[5,5],[9,7],[13,5],[2,10],[6,12],[10,10],[14,12],[0,14],[4,15],[8,13],[12,15]])
    px(x, y, '#333333');
  for (const [x, y] of [[3,4],[8,2],[12,4],[4,9],[9,11],[14,9]])
    px(x, y, '#484848');
}

function _metalSheen(rect, light, dark) {
  rect(0, 0, 16, 2, light);
  rect(0, 0, 2, 16, light);
  rect(14, 0, 2, 16, dark);
  rect(0, 14, 16, 2, dark);
}

// ── Item sprites ─────────────────────────────────────────────────────────────

function _sword(rect, px, bladeColor, handleColor) {
  // blade (diagonal, top-right to middle)
  for (let i = 0; i < 7; i++) px(13 - i, i + 1, bladeColor);
  for (let i = 0; i < 7; i++) px(12 - i, i + 1, lighten(bladeColor));
  // cross-guard
  rect(5, 7, 4, 1, handleColor);
  px(5, 8, handleColor); px(8, 8, handleColor);
  // handle
  for (let i = 0; i < 5; i++) px(4 - i, 8 + i, handleColor);
  // tip highlight
  px(13, 1, '#ffffff');
}

function _apple(rect, px) {
  // stem + leaf
  rect(7, 1, 1, 3, '#4a2a0a');
  rect(8, 2, 3, 2, '#2a6a1a');
  // apple body
  rect(3, 4, 10, 8, '#cc2222');
  rect(2, 5, 12, 6, '#cc2222');
  rect(4, 3, 8, 1, '#cc2222');
  rect(4, 12, 8, 1, '#cc2222');
  // shading
  rect(3, 5, 2, 4, '#ee4444');
  px(4, 4, '#ee4444');
  // shine
  px(5, 5, '#ffaaaa');
  px(6, 4, '#ffaaaa');
  // dark edge
  rect(12, 5, 2, 6, '#991111');
  rect(4, 12, 8, 1, '#991111');
}

function _stick(rect, px) {
  // diagonal stick from top-right to bottom-left
  for (let i = 0; i < 12; i++) {
    px(11 - i, 2 + i, '#a0702a');
    if (i > 0 && i < 11) px(12 - i, 2 + i, '#c09050');
  }
}

function _pickaxe(rect, px, headColor, handleColor) {
  // handle (diagonal)
  for (let i = 0; i < 9; i++) px(8 + i, 7 + i, handleColor);
  // head (horizontal, angled)
  rect(2, 3, 10, 2, headColor);
  rect(2, 5, 2,  2, headColor);
  rect(8, 5, 2,  2, headColor);
  // highlights
  for (let x = 2; x < 12; x++) px(x, 3, lighten(headColor));
  px(2, 3, '#ffffff');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8)  & 0xff) + 40);
  const b = Math.min(255, ( n        & 0xff) + 40);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
