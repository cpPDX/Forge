import * as THREE from 'three';

const ATLAS_COLS = 16;
const TILE      = 16;  // px per tile
const ATLAS_PX  = ATLAS_COLS * TILE; // 256

// Helpers
function rand(rng) { return rng(); }
function rngSeeded(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function hexToRgb(h) { return [(h>>16)&0xff,(h>>8)&0xff,h&0xff]; }
function vary(v, amt, rng) { return Math.min(255,Math.max(0, v + (rng()-0.5)*2*amt)); }

export function buildTextureAtlas() {
  const totalTiles = 35; // number of distinct textures
  const rows = Math.ceil(totalTiles / ATLAS_COLS);
  const H = rows * TILE;

  const canvas = document.createElement('canvas');
  canvas.width  = ATLAS_PX;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function tileCtx(idx) {
    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    return { ox: col * TILE, oy: row * TILE };
  }

  function fillTile(idx, fn) {
    const { ox, oy } = tileCtx(idx);
    const img = ctx.createImageData(TILE, TILE);
    const rng = rngSeeded(idx * 7919 + 1);
    fn(img.data, rng);
    ctx.putImageData(img, ox, oy);
  }

  function solid(idx, color, noise = 18) {
    const [r,g,b] = hexToRgb(color);
    fillTile(idx, (d, rng) => {
      for (let i = 0; i < TILE*TILE; i++) {
        const n = (rng()-0.5)*noise;
        d[i*4]=r+n; d[i*4+1]=g+n; d[i*4+2]=b+n; d[i*4+3]=255;
      }
    });
  }

  function ore(idx, base, spotColor) {
    solid(idx, base, 14);
    const { ox, oy } = tileCtx(idx);
    const img = ctx.getImageData(ox, oy, TILE, TILE);
    const d = img.data;
    const [sr,sg,sb] = hexToRgb(spotColor);
    const spots = [[3,3],[3,10],[10,4],[11,11],[7,7]];
    for (const [sx,sy] of spots) {
      for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
        const px = (sy+dy)*TILE+(sx+dx);
        if (px<0||px>=TILE*TILE) continue;
        d[px*4]=sr; d[px*4+1]=sg; d[px*4+2]=sb; d[px*4+3]=255;
      }
    }
    ctx.putImageData(img, ox, oy);
  }

  // ── Draw all textures ─────────────────────────────────────────────────────

  // 0 GRASS_TOP
  fillTile(0, (d, rng) => {
    for (let i = 0; i < TILE*TILE; i++) {
      const g = vary(120, 20, rng);
      d[i*4]=30+g*0.2; d[i*4+1]=g; d[i*4+2]=20; d[i*4+3]=255;
    }
  });

  // 1 GRASS_SIDE
  fillTile(1, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i = y*TILE+x;
      if (y < 4) { // green top band
        const g = vary(110,20,rng);
        d[i*4]=30; d[i*4+1]=g; d[i*4+2]=20; d[i*4+3]=255;
      } else { // dirt
        const br = vary(110,15,rng);
        d[i*4]=br; d[i*4+1]=Math.floor(br*0.58); d[i*4+2]=Math.floor(br*0.42); d[i*4+3]=255;
      }
    }
  });

  // 2 DIRT
  fillTile(2, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const br = vary(108,16,rng);
      d[i*4]=br; d[i*4+1]=Math.floor(br*0.58); d[i*4+2]=Math.floor(br*0.42); d[i*4+3]=255;
    }
  });

  // 3 STONE
  solid(3, 0x7a7a7a, 16);

  // 4 SAND
  solid(4, 0xd4c07a, 14);

  // 5 GRAVEL
  fillTile(5, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const v = vary(120,30,rng);
      d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v-10; d[i*4+3]=255;
    }
  });

  // 6 BEDROCK
  fillTile(6, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const v = vary(30,12,rng);
      d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v; d[i*4+3]=255;
    }
  });

  // 7 COBBLESTONE
  fillTile(7, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i = y*TILE+x;
      const edge = (x===0||y===0||x===7||y===7||x===8||y===8) ? -20 : 0;
      const v = vary(96,12,rng)+edge;
      d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v; d[i*4+3]=255;
    }
  });

  // 8 LOG_TOP
  fillTile(8, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i = y*TILE+x;
      const cx=x-7.5, cy=y-7.5, r=Math.sqrt(cx*cx+cy*cy);
      const ring = r<2?0xd4a44a: r<5?0x8b5c1a: 0x6b3a1a;
      const [R,G,Bl] = hexToRgb(ring);
      const n = (rng()-0.5)*20;
      d[i*4]=R+n; d[i*4+1]=G+n; d[i*4+2]=Bl+n; d[i*4+3]=255;
    }
  });

  // 9 LOG_SIDE
  fillTile(9, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i = y*TILE+x;
      const stripe = (x<3||x>12)?0x5a3010:0x7a4a20;
      const [R,G,Bl] = hexToRgb(stripe);
      const n = (rng()-0.5)*18;
      d[i*4]=R+n; d[i*4+1]=G+n; d[i*4+2]=Bl+n; d[i*4+3]=255;
    }
  });

  // 10 LEAVES - with transparency
  fillTile(10, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const g = vary(100,24,rng);
      const alpha = rng()>0.15 ? 255 : 0;
      d[i*4]=20; d[i*4+1]=g; d[i*4+2]=15; d[i*4+3]=alpha;
    }
  });

  // 11 PLANKS
  fillTile(11, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i = y*TILE+x;
      const plank = Math.floor(y/4)%2;
      const base = plank?0xc08040:0xb07030;
      const [R,G,Bl] = hexToRgb(base);
      const n=(rng()-0.5)*14; const line = (y%4===0)?-30:0;
      d[i*4]=R+n+line; d[i*4+1]=G+n+line; d[i*4+2]=Bl+n+line; d[i*4+3]=255;
    }
  });

  // 12 COAL_ORE
  ore(12, 0x707070, 0x111111);
  // 13 IRON_ORE
  ore(13, 0x707070, 0xc8a07a);
  // 14 GOLD_ORE
  ore(14, 0x707070, 0xffcc00);
  // 15 DIAMOND_ORE
  ore(15, 0x707070, 0x44ddff);

  // 16 SANDSTONE_TOP
  fillTile(16, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const v = vary(200,10,rng);
      d[i*4]=v; d[i*4+1]=Math.floor(v*0.88); d[i*4+2]=Math.floor(v*0.55); d[i*4+3]=255;
    }
  });

  // 17 SANDSTONE side
  fillTile(17, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i=y*TILE+x;
      const line = (y%4===0)?-25:0;
      const v = vary(190,12,rng)+line;
      d[i*4]=v; d[i*4+1]=Math.floor(v*0.85); d[i*4+2]=Math.floor(v*0.5); d[i*4+3]=255;
    }
  });

  // 18 WATER
  fillTile(18, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      d[i*4]=30; d[i*4+1]=80+vary(40,15,rng); d[i*4+2]=200; d[i*4+3]=190;
    }
  });

  // 19 LAVA
  fillTile(19, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const r = vary(220,20,rng);
      d[i*4]=r; d[i*4+1]=Math.floor(r*0.35); d[i*4+2]=0; d[i*4+3]=255;
    }
  });

  // 20 GLOWSTONE
  fillTile(20, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const v = vary(240,15,rng);
      d[i*4]=v; d[i*4+1]=Math.floor(v*0.9); d[i*4+2]=Math.floor(v*0.3); d[i*4+3]=255;
    }
  });

  // 21 NETHERRACK
  solid(21, 0x6a1a1a, 16);

  // 22 ICE
  fillTile(22, (d, rng) => {
    for (let i=0;i<TILE*TILE;i++) {
      const v = vary(180,8,rng);
      d[i*4]=Math.floor(v*0.7); d[i*4+1]=Math.floor(v*0.85); d[i*4+2]=v; d[i*4+3]=200;
    }
  });

  // 23 SNOW_TOP
  solid(23, 0xeeeeee, 8);

  // 24 SNOW_SIDE (snow + dirt)
  fillTile(24, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i=y*TILE+x;
      if (y<3) { const v=vary(235,8,rng); d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v+10; d[i*4+3]=255; }
      else { const br=vary(108,16,rng); d[i*4]=br; d[i*4+1]=Math.floor(br*0.58); d[i*4+2]=Math.floor(br*0.42); d[i*4+3]=255; }
    }
  });

  // 25 STONE_BRICK
  fillTile(25, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i=y*TILE+x;
      const bx = Math.floor((x + (Math.floor(y/4)%2)*4) / 8);
      const mortar = (y%4===0)||(x===(bx*8 + (Math.floor(y/4)%2)*4))%8;
      const v = mortar?60:vary(90,10,rng);
      d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v; d[i*4+3]=255;
    }
  });

  // 26 CRAFT_TOP
  fillTile(26, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i=y*TILE+x;
      const lines = (x===4||x===10||y===4||y===10);
      if (lines) { d[i*4]=40; d[i*4+1]=20; d[i*4+2]=10; d[i*4+3]=255; }
      else if (x<4||y<4||x>10||y>10) {
        const br=vary(180,10,rng); d[i*4]=br; d[i*4+1]=Math.floor(br*0.6); d[i*4+2]=Math.floor(br*0.3); d[i*4+3]=255;
      } else {
        const br=vary(110,10,rng); d[i*4]=br; d[i*4+1]=Math.floor(br*0.5); d[i*4+2]=Math.floor(br*0.25); d[i*4+3]=255;
      }
    }
  });

  // 27 CRAFT_SIDE = planks
  solid(27, 0xb07030, 14);

  // 28 FURNACE_FRONT
  fillTile(28, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i=y*TILE+x;
      const inHole = x>=5&&x<=10&&y>=9&&y<=13;
      if (inHole) {
        const r=vary(200,30,rng); d[i*4]=r; d[i*4+1]=Math.floor(r*0.4); d[i*4+2]=0; d[i*4+3]=255;
      } else {
        const v=vary(80,12,rng); d[i*4]=v; d[i*4+1]=v; d[i*4+2]=v; d[i*4+3]=255;
      }
    }
  });

  // 29 FURNACE_SIDE = stone
  solid(29, 0x808080, 14);

  // 30 GLASS
  fillTile(30, (d, rng) => {
    for (let y=0;y<TILE;y++) for (let x=0;x<TILE;x++) {
      const i=y*TILE+x;
      const edge = (x===0||y===0||x===15||y===15);
      d[i*4]=200; d[i*4+1]=230; d[i*4+2]=240; d[i*4+3]=edge?200:40;
    }
  });

  // 31 IRON_BLOCK
  solid(31, 0xd0d0d0, 8);

  // 32 GOLD_BLOCK
  solid(32, 0xffd700, 12);

  // 33 DIAMOND_BLOCK
  solid(33, 0x44ddff, 12);

  // 34 CLAY
  solid(34, 0x9aacbc, 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.flipY     = false;
  texture.needsUpdate = true;

  return { texture, atlasCanvas: canvas, TILE, COLS: ATLAS_COLS, ROWS: rows };
}

export function tileUV(tileIdx, COLS, ROWS) {
  const col = tileIdx % COLS;
  const row = Math.floor(tileIdx / COLS);
  // flipY=false: UV (0,0) = top-left of canvas
  const u0 =  col      / COLS;
  const u1 = (col + 1) / COLS;
  const v0 =  row      / ROWS;
  const v1 = (row + 1) / ROWS;
  return { u0, u1, v0, v1 };
}
