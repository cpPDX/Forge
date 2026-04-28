# FORGE — Survival Game: Handoff Document

A Terraria-style 2D survival game built with Phaser 3 and Vite, deployed to GitHub Pages.

---

## Quick Start

```bash
npm install
npm run dev        # dev server at http://localhost:3000
npm run build      # outputs to dist/
npm run preview    # serve dist/ locally
```

**Dependencies:**
- `phaser ^3.70.0`
- `vite ^5.4.0` (dev only)
- `howler ^2.2.4` (installed but audio disabled; see below)

---

## Repository Structure

```
Forge/
├── index.html                  # Entry point; contains error reporter script
├── vite.config.js              # base: './', Phaser split chunk
├── package.json
├── .github/workflows/deploy.yml   # GitHub Actions → GitHub Pages
└── src/
    ├── main.js                 # Phaser.Game config + boot
    ├── scenes/
    │   ├── Boot.js             # Loading bar
    │   ├── Preload.js          # Procedural textures, starts MainMenu
    │   ├── MainMenu.js         # Title screen, Continue/New Game
    │   ├── Game.js             # Core game loop (main scene)
    │   ├── HUDScene.js         # Parallel HUD (hearts, hotbar, time)
    │   ├── InventoryScene.js   # Inventory overlay
    │   ├── CraftingScene.js    # Crafting table overlay
    │   ├── FurnaceScene.js     # Furnace/smelting overlay
    │   └── GameOver.js         # Death screen
    ├── entities/
    │   ├── Player.js           # AABB physics, survival, block breaking
    │   ├── Mob.js              # AI, 8 mob types
    │   └── Drop.js             # Item drops with gravity/bounce
    ├── world/
    │   ├── World.js            # Seeded Perlin noise, chunk generation, AABB physics
    │   └── ChunkRenderer.js    # Canvas-based chunk renderer, per-tile pixel art
    ├── systems/
    │   ├── InventorySystem.js  # Hotbar (9) + main (27), stacking, serialize
    │   ├── CraftingSystem.js   # Recipe matching and crafting
    │   ├── TimeSystem.js       # Day/night cycle, sky color interpolation
    │   ├── LightingSystem.js   # Overlay darkness per tile, torch/lava glow
    │   └── SaveManager.js      # localStorage save/load
    └── utils/
        ├── constants.js        # All game constants (tile IDs, player stats, etc.)
        ├── TileRegistry.js     # 45 tile definitions (solid, hardness, drops, lightEmit)
        ├── ItemRegistry.js     # All item definitions (tools, food, materials)
        └── RecipeRegistry.js   # 40+ crafting/smelting recipes
```

---

## Architecture Overview

### Scene Graph

```
Boot → Preload → MainMenu → Game ──launch──► HUDScene
                                 ──launch──► InventoryScene (toggle)
                                 ──launch──► CraftingScene  (toggle)
                                 ──launch──► FurnaceScene   (toggle)
                              → GameOver
```

**Key rule:** `HUDScene` is launched **only** from `Game.create()` via `scene.launch()`. `MainMenu` and `GameOver` must NOT start HUDScene — they only call `scene.start('Game')`.

### Phaser Config (`src/main.js`)

```js
const config = {
  type: Phaser.CANVAS,        // NOT AUTO — WebGL fails silently on iOS Safari
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,               // MUST be inside scale{}, not top-level
    height: 720,
  },
  audio: { noAudio: true },   // Disables Web Audio API (iOS requires user gesture)
  input: { activePointers: 4 },
  scene: [Boot, Preload, MainMenu, Game, HUDScene, InventoryScene, CraftingScene, FurnaceScene, GameOver],
};
```

### World

- **Size:** 4096 × 512 tiles (128 × 16 chunks of 32×32)
- **Generation:** Seeded Perlin noise FBM (inline, no external dependency), 4 biomes: Forest, Desert, Snow, Jungle
- **Storage:** `Map<string, Uint16Array>` — lazy generation on first access, chunks never serialized in MVP
- **Tile access:** `getTile(tx, ty)` / `setTile(tx, ty, id)` — bit-shift indexing: `(ty & 31) << 5 | (tx & 31)`
- **Physics:** `World.moveAndCollide(px, py, pw, ph, mvx, mvy, dt)` — custom AABB, returns `{ x, y, vx, vy, onGround, onCeiling, onWall }`

### Chunk Rendering

`ChunkRenderer` keeps a `Map<key, {image, canvas, ctx}>` of active chunks. Each 32×32 chunk is an HTML `<canvas>` element uploaded as a Phaser texture via `scene.textures.addCanvas()`. Tiles are drawn using 44 individual Canvas2D draw functions (per tile type) with hand-crafted pixel art.

### HUD Communication

`Game.update()` calls `_emitHUD()` every 200ms, which writes a state object to `this.registry.set('hudState', {...})`. `HUDScene._refresh()` polls `this.registry.get('hudState')` every 100ms via a Phaser time event.

### Input

`TouchControls` handles both virtual joystick (touch) and keyboard (WASD/arrows/SPACE/E/SHIFT). `poll()` merges both into a single state object. `flush()` clears one-shot flags (`jumpJustPressed`, `inventoryJustPressed`).

---

## Critical Bug Fixes (history)

These are bugs that were discovered and fixed. Do NOT regress them.

### 1. `fillGradientStyle` crash (Canvas renderer)
**File:** `src/scenes/MainMenu.js` — `_buildBackground()`
**Bug:** `sky.fillGradientStyle(...)` is WebGL-only. On `Phaser.CANVAS` it silently corrupts Graphics state so nothing renders.
**Fix:** Replaced with multiple `fillStyle` + `fillRect` calls.

### 2. CSS flex conflict with Phaser ScaleManager
**File:** `index.html` — `#game-container`
**Bug:** `display:flex; align-items:center; justify-content:center` double-centered the canvas when Phaser also applied margin-based centering.
**Fix:** Removed flex. `#game-container` is now `position:fixed; inset:0; overflow:hidden`.

### 3. HUDScene double-start
**Bug:** `MainMenu` and `GameOver` both called `scene.start('HUDScene')` after `scene.start('Game')`, causing HUD to stop and restart unreliably.
**Fix:** HUDScene is launched exclusively from `Game.create()` via `scene.launch()`. Other scenes never touch HUDScene.

### 4. Wrong Vite base path
**File:** `vite.config.js`
**Bug:** `base: '/Minecraft-Dupe/'` caused 404s on GitHub Pages.
**Fix:** `base: './'` — relative paths work regardless of repo name.

### 5. iOS Safari "Params are not set" (three simultaneous fixes)
**File:** `src/main.js` + `index.html`
**Bug:** Phaser ScaleManager threw "Params are not set" on iOS Safari. Three root causes:
  1. `#game-container` reported 0 dimensions on iOS before layout settled
  2. `width`/`height` were at top-level Phaser config (ignored by ScaleManager)
  3. Web Audio API `resume()` called without user gesture → Promise rejection

**Fixes applied:**
  1. `index.html`: `#game-container { position: fixed; inset: 0; overflow: hidden; }` — forces non-zero dimensions before Phaser boots
  2. `main.js`: `width`/`height` moved inside `scale: {}` block
  3. `main.js`: `audio: { noAudio: true }` added

### 6. iOS Safari WebGL black screen
**File:** `src/main.js`
**Bug:** `type: Phaser.AUTO` chose WebGL on iOS Safari, which has silent context failures → black screen.
**Fix:** `type: Phaser.CANVAS` forced.

### 7. "phaser does not resolve to a valid URL" (GitHub Pages)
**Bug:** Browser loading raw `src/main.js` instead of built bundle. `import 'phaser'` is a Node bare specifier — invalid in browser ES modules.
**Root cause:** GitHub Pages was serving source files via Jekyll (default for repos with no special config) rather than built dist/.
**Fix required:**
  - Delete any Jekyll workflow from `.github/workflows/`
  - Keep only `deploy.yml` (the one in this repo)
  - Set GitHub Pages source to **"GitHub Actions"** in repo Settings → Pages
  - Merge feature branch → `main` (deploy.yml only triggers on `main`)

### 8. Portrait-mode warning on desktop
**File:** `index.html`
**Bug:** Rotate-to-landscape message appeared on laptop browsers in certain window sizes.
**Fix:** Media query uses `(pointer: coarse)` to only show on touchscreen devices:
```css
@media screen and (orientation: portrait) and (pointer: coarse) {
  #rotate-msg { display: flex; }
}
```

---

## Deployment Setup

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    - npm ci
    - npm run build
    - upload-pages-artifact path: dist

  deploy:
    - actions/deploy-pages@v4
```

**Requirements to make this work:**
1. Go to repo Settings → Pages → Source → select **"GitHub Actions"** (not "Deploy from branch")
2. Make sure no other workflow is deploying to GitHub Pages
3. Push to `main` branch to trigger

### Feature Branch

Current development is on: `claude/recreate-handoff-docs-KZdmy`

This branch cannot deploy to GitHub Pages directly because the `github-pages` environment only allows `main`. To deploy: merge this branch into `main`.

---

## Known Issues & TODOs

### Performance: LightingSystem
**File:** `src/systems/LightingSystem.js` — `_getTileLight()`

The current implementation loops over a 29×29 radius (radius=14) for **every visible tile** every 100ms. For a 1280×720 viewport at zoom=2, that's ~3,000 tiles × 841 iterations = ~2.5M ops per update. This will cause frame drops, especially on mobile.

**Suggested fix:** Pre-compute a light map for the visible region once per camera move, then do a single pass to render the overlay.

### Chest UI Not Implemented
`src/scenes/Game.js` — `_placeOrInteract()`: clicking a chest logs TODO and returns. Chest contents are never stored.

### Chunk Save/Load Incomplete
`Game._serializeModifiedChunks()` returns `{}` and `_loadChunkData()` is empty. Modified world tiles are lost on reload (only player stats, inventory, and time persist).

### Bread Recipe Requires Wheat
`RecipeRegistry.js` has a bread recipe requiring `wheat`, but `wheat` is never generated in the world or obtainable. Recipe will never be craftable.

### CraftingScene Color Swatch Placeholder
`src/scenes/CraftingScene.js` — `_drawRecipe()`: the item color is hardcoded to `0xaaaaaa`. Should look up `ItemRegistry.get(recipe.result.itemId)?.color`.

### Howler Installed but Unused
`howler` is in dependencies but never imported. Either wire up sound effects or remove it from `package.json` to reduce bundle size.

---

## Game Constants Reference

**`src/utils/constants.js`**

| Constant | Value | Notes |
|---|---|---|
| TILE_SIZE | 16 | pixels |
| CHUNK_SIZE | 32 | tiles per chunk side |
| WORLD_WIDTH | 4096 | tiles (128 chunks) |
| WORLD_HEIGHT | 512 | tiles (16 chunks) |
| GAME_WIDTH | 1280 | canvas resolution |
| GAME_HEIGHT | 720 | canvas resolution |
| CAMERA_ZOOM | 2 | default zoom (not used by ScaleManager) |
| PLAYER.WALK_SPEED | 150 | px/s |
| PLAYER.SPRINT_SPEED | 240 | px/s |
| PLAYER.JUMP_VEL | -420 | px/s upward |
| PLAYER.GRAVITY | 900 | px/s² |
| PLAYER.MAX_HP | 20 | (10 hearts) |
| PLAYER.MAX_HUNGER | 20 | (10 drumsticks) |
| PLAYER.REACH_PX | 80 | 5 tiles reach |
| HOTBAR_SIZE | 9 | |
| INV_ROWS | 3 | main inventory rows |
| INV_COLS | 9 | main inventory cols |
| MAX_STACK | 64 | default (tools: 1) |
| DAY_DURATION | 24000 | ms per full day |
| MAX_MOBS | 50 | |
| MOB_DESPAWN_DIST | 32 | tiles |

---

## Tile IDs (never reorder — saves would break)

```
0=AIR  1=GRASS  2=DIRT  3=STONE  4=SAND  5=GRAVEL  6=BEDROCK
7=SNOW_DIRT  8=COAL_ORE  9=IRON_ORE  10=GOLD_ORE  11=DIAMOND_ORE
12=HELLSTONE  13=OBSIDIAN  14=SANDSTONE  15=ICE
16=OAK_LOG  17=PINE_LOG  18=JUNGLE_LOG
19=OAK_LEAVES  20=PINE_LEAVES  21=JUNGLE_LEAVES
22=CACTUS  23=COBBLESTONE  24=OAK_PLANKS  25=PINE_PLANKS
26=STONE_BRICK  27=GLASS  28=TORCH  29=CHEST
30=CRAFTING_TABLE  31=FURNACE  32=WATER  33=LAVA
34=GRASS_SNOW  35=FLOWER_RED  36=FLOWER_YELLOW  37=TALL_GRASS
38=VINE  39=GLOWSTONE  40=NETHERRACK  41=CLAY
42=IRON_BLOCK  43=GOLD_BLOCK  44=DIAMOND_BLOCK
```

---

## Layer Y-Boundaries (tiles)

```
0–79:   Sky (AIR)
80–119: Surface zone
120–279: Underground
280–429: Cavern
430–511: Underworld (Hellstone, Lava, Lava Slime mobs)
509–511: Bedrock
```

---

## Mob Definitions

| ID | Name | HP | Damage | Speed | Drops |
|---|---|---|---|---|---|
| slime | Slime | 8 | 2 | 40 | slimeball |
| zombie | Zombie | 20 | 3 | 55 | rotten_flesh, iron_ingot (5%) |
| skeleton | Skeleton | 16 | 2 | 65 | bone, arrow×2 |
| spider | Spider | 14 | 2 | 80 | string, spider_eye (30%) |
| creeper | Creeper | 20 | 0 | 55 | gunpowder |
| pig | Pig | 10 | 0 | 50 | raw_pork (passive) |
| rabbit | Rabbit | 3 | 0 | 90 | raw_meat (passive) |
| lava_slime | Lava Slime | 16 | 5 | 35 | magma_cream |

---

## Tool Tiers

| Tier | Material | Pickaxe Durability | Axe | Shovel | Sword |
|---|---|---|---|---|---|
| 0 | Wood | 60 | 60 | 60 | 60 |
| 1 | Stone | 132 | 132 | 132 | 132 |
| 2 | Iron | 251 | 251 | 251 | 251 |
| 3 | Gold | 33 | — | — | 33 |
| 4 | Diamond | 1562 | 1562 | — | 1562 |
