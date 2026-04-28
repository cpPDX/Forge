# FORGE — Complete Source (Part 2 of 2)

Files: src/scenes/*, src/entities/*, src/systems/*, src/ui/TouchControls.js

---

## src/scenes/Boot.js

```js
import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { this._buildLoadingBar(); }

  create() { this.scene.start('Preload'); }

  _buildLoadingBar() {
    const W = this.scale.width, H = this.scale.height;
    const barW = 300, barH = 20;
    const bx = (W - barW) / 2, by = H / 2;
    this.add.rectangle(W / 2, H / 2 - 40, 300, 4, 0x333333);
    const bar = this.add.rectangle(bx, by - 40, 0, barH, 0x44aaff).setOrigin(0, 0.5);
    this.load.on('progress', (p) => { bar.width = barW * p; });
  }
}
```

---

## src/scenes/Preload.js

```js
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';

export class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const bg     = this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a14);
    const title  = this.add.text(W / 2, H / 2 - 60, 'FORGE', {
      fontSize: '48px', color: '#ff9900', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    const barBg  = this.add.rectangle(W / 2, H / 2 + 40, 320, 12, 0x222233).setOrigin(0.5);
    const bar    = this.add.rectangle(W / 2 - 160, H / 2 + 40, 0, 10, 0xff9900).setOrigin(0, 0.5);
    const txt    = this.add.text(W / 2, H / 2 + 62, 'Generating world...', {
      fontSize: '13px', color: '#666688',
    }).setOrigin(0.5);
    this.load.on('progress', p => { bar.width = 320 * p; });
  }

  create() {
    this._generateTextures();
    this.time.delayedCall(300, () => this.scene.start('MainMenu'));
  }

  _generateTextures() {
    // 4×4 white particle
    const c1 = document.createElement('canvas');
    c1.width = 4; c1.height = 4;
    c1.getContext('2d').fillStyle = '#ffffff';
    c1.getContext('2d').fillRect(0, 0, 4, 4);
    this.textures.addCanvas('particle', c1);

    // 1×2 sky gradient
    const c2 = document.createElement('canvas');
    c2.width = 1; c2.height = 2;
    const ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#1a88ff'; ctx2.fillRect(0, 0, 1, 1);
    ctx2.fillStyle = '#88ccff'; ctx2.fillRect(0, 1, 1, 1);
    this.textures.addCanvas('sky_grad', c2);
  }
}
```

---

## src/scenes/MainMenu.js

```js
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { SaveManager } from '../systems/SaveManager.js';

export class MainMenu extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.save = new SaveManager();
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const hasSave = this.save.hasSave();

    this._buildBackground(W, H);

    this.add.text(W / 2, H * 0.22, 'FORGE', {
      fontSize: '72px', color: '#ff9900', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.33, 'Survival Adventure', {
      fontSize: '22px', color: '#cccccc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(W - 10, H - 10, 'v0.1.0 | FORGE', {
      fontSize: '11px', color: '#445566',
    }).setOrigin(1);

    const btnY = H * 0.55;
    const gap  = 58;

    if (hasSave) {
      this._btn('▶  Continue', W / 2, btnY - gap, 0x44aa44, () => this._startGame(false));
    }
    this._btn('⚒  New Game', W / 2, btnY + (hasSave ? 0 : -gap / 2), 0x4477cc, () => {
      this.save.deleteSave();
      this._startGame(true);
    });
    this._btn('⚙  Settings', W / 2, btnY + gap + (hasSave ? 0 : -gap / 2), 0x666666, () => {
      this.add.text(W / 2, H * 0.85, 'Settings coming soon!', {
        fontSize: '14px', color: '#888888',
      }).setOrigin(0.5);
    });

    this._buildGroundDecor(W, H);
  }

  _btn(text, x, y, color, cb) {
    const gfx = this.add.graphics();
    const bW = 220, bH = 44;
    gfx.fillStyle(color, 0.9);
    gfx.fillRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    const lbl = this.add.text(x, y, text, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, bW, bH).setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => { gfx.setAlpha(1.2); lbl.setScale(1.04); });
    zone.on('pointerout',   () => { gfx.setAlpha(1);   lbl.setScale(1);    });
    zone.on('pointerdown',  cb);
    return { gfx, lbl };
  }

  _startGame(newGame) {
    const saveData = newGame ? null : this.save.load();
    const seed = saveData?.seed ?? Math.floor(Math.random() * 1e9);
    this.scene.start('Game', { seed, saveData, newGame });
    // HUDScene is launched from Game.create() — do NOT start it here
  }

  _buildBackground(W, H) {
    // IMPORTANT: fillGradientStyle() is WebGL-only and must NOT be used.
    // Use fillStyle + fillRect instead.
    const sky = this.add.graphics();
    sky.fillStyle(0x0a1a3a, 1); sky.fillRect(0, 0, W, H * 0.5);
    sky.fillStyle(0x0e2a5a, 1); sky.fillRect(0, H * 0.5, W, H * 0.2);
    sky.fillStyle(0x1a3a10, 1); sky.fillRect(0, H * 0.7, W, H * 0.3);

    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * W, sy = Math.random() * H * 0.6;
      const r  = Math.random() > 0.8 ? 1.5 : 1;
      sky.fillStyle(0xffffff, 0.5 + Math.random() * 0.5);
      sky.fillCircle(sx, sy, r);
    }

    const mtn = this.add.graphics();
    mtn.fillStyle(0x1a3a1a, 1);
    const pts = [];
    for (let x = 0; x <= W; x += 16) {
      pts.push({ x, y: H * 0.7 - Math.sin(x / 80) * 40 - Math.sin(x / 30) * 20 });
    }
    pts.push({ x: W, y: H }); pts.push({ x: 0, y: H });
    mtn.fillPoints(pts, true);
  }

  _buildGroundDecor(W, H) {
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 16) {
      g.fillStyle(0x5d8a3c, 1); g.fillRect(x, H - 32, 16, 8);
      g.fillStyle(0x6b3a2a, 1); g.fillRect(x, H - 24, 16, 24);
    }
    for (let x = 20; x < W - 20; x += 40 + Math.floor(Math.random() * 30)) {
      g.fillStyle(0x2a7a1a, 1);
      g.fillRect(x - 1, H - 48, 4, 16);
      g.fillRect(x - 4, H - 48, 10, 8);
    }
  }
}
```

---

## src/scenes/GameOver.js

```js
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { SaveManager } from '../systems/SaveManager.js';

export class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const save = new SaveManager();

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0);
    this.tweens.add({ targets: bg, fillAlpha: 0.85, duration: 800 });

    const title = this.add.text(W / 2, H * 0.35, 'YOU DIED', {
      fontSize: '64px', color: '#ff2222', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1000, delay: 400 });

    const sub = this.add.text(W / 2, H * 0.5, 'Your items were scattered at the death site.', {
      fontSize: '16px', color: '#888888',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 800, delay: 800 });

    this.time.delayedCall(1400, () => {
      this._btn(W / 2, H * 0.64, 'Respawn', 0x44aa44, () => {
        save.deleteSave();
        this.scene.start('Game', { newGame: true });
        // HUDScene is launched from Game.create() — do NOT start it here
      });
      this._btn(W / 2, H * 0.64 + 60, 'Main Menu', 0x4477cc, () => {
        save.deleteSave();
        this.scene.start('MainMenu');
      });
    });
  }

  _btn(x, y, label, color, cb) {
    const bW = 200, bH = 44;
    const gfx = this.add.graphics().setAlpha(0);
    gfx.fillStyle(color, 0.85);
    gfx.fillRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    this.tweens.add({ targets: gfx, alpha: 1, duration: 400 });
    const lbl = this.add.text(x, y, label, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: lbl, alpha: 1, duration: 400 });
    const zone = this.add.zone(x, y, bW, bH).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { gfx.setAlpha(1.2); lbl.setScale(1.04); });
    zone.on('pointerout',  () => { gfx.setAlpha(1);   lbl.setScale(1);    });
    zone.on('pointerdown', cb);
  }
}
```

---

## src/scenes/HUDScene.js

Key structure (full file in repo):

```js
export class HUDScene extends Phaser.Scene {
  constructor() { super('HUDScene'); }

  create() {
    this._buildHearts();    // 10 heart graphics, top-left
    this._buildHunger();    // 10 drumstick graphics, top-right
    this._buildHotbar();    // 9-slot hotbar, bottom-center
    this._buildOxygen();    // oxygen bar, visible only in water
    this._buildTimeDisplay(); // HH:MM clock, top-center

    // Poll state from Game via registry
    this.time.addEvent({ delay: 100, loop: true, callback: this._refresh, callbackScope: this });
  }

  _refresh() {
    const state = this.registry.get('hudState');
    if (!state) return;
    this._refreshHearts(state.hp, state.maxHp);
    this._refreshHunger(state.hunger, state.maxHunger);
    this._refreshHotbar(state.hotbar, state.hotbarIndex);
    this._refreshOxygen(state.oxygen, state.inWater);
    this._timeTxt.setText(state.time);
    this._timeTxt.setColor(state.isNight ? '#aaccff' : '#ffffcc');
  }
  // ... _refreshHearts, _refreshHunger, _refreshHotbar (draws slots + item colors + durability bars)
  // ... _refreshOxygen (hidden unless inWater)
}
```

HUD state object written by `Game._emitHUD()` every 200ms:
```js
{
  hp, maxHp,
  hunger, maxHunger,
  oxygen,           // seconds remaining (0–10)
  inWater,          // boolean
  hotbar,           // InventorySystem.hotbar array copy
  hotbarIndex,      // selected slot index
  time,             // "HH:MM" string
  isNight,          // boolean
}
```

---

## src/scenes/InventoryScene.js

Launched via `scene.launch('InventoryScene', { gameScene: this })`. Dim overlay + panel. Slots are non-functional drag & drop; clicking a main slot moves item to hotbar via `inv.addItem()`, then restarts the scene.

Close: X button, ESC key, E key.

---

## src/scenes/CraftingScene.js

Launched via `scene.launch('CraftingScene', { gameScene: this, station: 'crafting_table' })`. Lists `crafting.getAvailable(station)` recipes. CRAFT button calls `crafting.craft(recipe.id)` — flashes green on success, red on failure, then restarts scene.

**Known bug:** Item color swatch is hardcoded to `0xaaaaaa`. Fix: use `ItemRegistry.get(recipe.result.itemId)?.color`.

---

## src/scenes/FurnaceScene.js

Launched via `scene.launch('FurnaceScene', { gameScene: this })`. Lists furnace smelting recipes. SMELT button instantly removes input+fuel and adds result (no timer). Restarts scene after smelt.

---

## src/entities/Player.js

Key state:
```js
this.x, this.y    // top-left of AABB
this.vx, this.vy
this.w = 12, this.h = 28
this.onGround, this.onWall
this.facingRight
this.coyote       // frames of coyote time remaining (6 frames)
this.jumpBuffer   // frames of jump buffer
this.hp, this.maxHp = 20
this.hunger, this.maxHunger = 20
this.oxygen = 10  // seconds
this.inWater, this.onFire
this.dead
this.fallStartY   // tracks apex for fall damage calculation
this.breakTarget  // { tx, ty } | null
this.breakProgress // 0–1
```

Key methods:
```js
update(time, delta, input)   // calls _handleMovement, _handleEnvironment, _handleHunger, _handleBreaking
takeDamage(amount, time)     // respects invincibleUntil; emits playerDied when hp <= 0
eat(itemId, hungerRestore)
destroy()
// Getters:
get centerX/centerY/tileX/tileY
```

Fall damage: triggers when landing after `fallTiles > 4` tiles of fall. Uses `fallStartY = Math.min(fallStartY, res.y)` to track apex (not just departure point).

Block breaking: held `breakHeld` + `aimTile`. Break time = `hardness × 400ms × toolMultiplier`. Wrong tool = 5× penalty. On break: `world.setTile → AIR`, spawn drops, reduce tool durability, emit `tileChanged`.

---

## src/entities/Mob.js

```js
export class Mob {
  constructor(scene, x, y, def)  // def from MOB_DEFS
  update(delta, world, player, time)
  takeDamage(amount, time)
  _die()                          // drops items, emits 'mobDied'
  destroy()                       // removes sprite
}

export const MOB_DEFS = {
  slime, zombie, skeleton, spider, creeper,
  pig, rabbit,        // passive: flee when player < 4 tiles
  lava_slime
};
```

AI states: idle / pursue / flee (passive only). Hostile mobs pursue when within 20 tiles. Jump over walls when `onGround` and wall detected ahead. Attack radius: 1.5 tiles, 1200ms cooldown.

---

## src/entities/Drop.js

```js
export class Drop {
  constructor(scene, x, y, itemId, count)
  update(delta, world, player)   // gravity, attract (4 tiles), pickup (2 tiles), 60s lifetime
  destroy()                      // sets collected=true, destroys sprite
}
```

Physics: GRAVITY=300, BOUNCE_DAMP=0.4. Drawn as 8×8 colored square with white outline.

---

## src/ui/TouchControls.js

```js
export class TouchControls {
  constructor(scene)
  poll(pointerX, pointerY, camLeft, camTop, zoom)  // returns merged input state
  flush()                                           // clears one-shot flags
  destroy()
}
```

Input state:
```js
{
  left, right, up, down,    // movement (touch joystick or WASD/arrows)
  sprint,                    // joystick > 85% radius or SHIFT
  jumpJustPressed,           // one-shot (J button or SPACE)
  breakHeld,                 // break button held or left mouse
  placeJustPressed,          // (currently unused — right-click handled separately)
  inventoryJustPressed,      // one-shot (I button or E)
  aimTile,                   // { tx, ty } computed from pointer position
}
```

Touch zones:
- Joystick: left half, bottom 45% of screen
- Break button: bottom-right
- Place button: left of Break
- Jump button: above Break
- Inventory button: top-right corner

---

## src/systems/InventorySystem.js

```js
export class InventorySystem {
  constructor()                    // hotbar[9], main[27], hotbarIndex=0
  addItem(itemId, count)           // fills stacks → hotbar → main; returns leftover
  removeItem(itemId, count)        // removes from hotbar then main; returns removed count
  countItem(itemId)
  hasItem(itemId, count)
  dropAll()                        // clears all slots; returns [{itemId, count}]
  serialize() / deserialize(data)  // localStorage save format
  getHotbarItem(index)
  getMainItem(index)
}
```

Slot format: `{ itemId, count, def, durability }` or `null`.

---

## src/systems/CraftingSystem.js

```js
export class CraftingSystem {
  constructor(inventory)
  getAvailable(station)    // filters RecipeRegistry + checks inventory counts
  craft(recipeId)          // consumes ingredients, adds result; returns boolean
}
```

---

## src/systems/TimeSystem.js

```js
export class TimeSystem {
  constructor(initialTime = 0.35)   // 0=midnight, 0.5=noon
  update(delta)
  get isDay / isNight / isDawn / isDusk
  get ambientLight   // 0.12–1.0
  get skyColor       // hex string, interpolated at dawn/dusk
  get hourString     // "HH:MM"
  serialize() / deserialize(d)
}
```

Day length: 24000ms. Time thresholds: DAWN=0.208 (5:00), DAY=0.292 (7:00), DUSK=0.750 (18:00), NIGHT=0.833 (20:00).

---

## src/systems/LightingSystem.js

```js
export class LightingSystem {
  constructor(scene, world, timeSystem)
  update(delta, camLeft, camTop, viewW, viewH, zoom)  // redraws every 100ms on camera move
  destroy()
}
```

Renders a `Graphics` overlay at depth 20. Per-tile darkness = `1 - light`. Underground tiles sample a 29×29 (radius 14) area for light sources. Lava/Torch/Glowstone emit light.

**Performance warning:** ~2.5M ops per 100ms update at full zoom. See HANDOFF.md Known Issues for optimization advice.

---

## src/systems/SaveManager.js

```js
export class SaveManager {
  hasSave()             // checks localStorage key 'forge_save_v1'
  save(gameState)       // JSON.stringify to localStorage
  load()                // JSON.parse from localStorage; null on miss
  deleteSave()          // removes key
  autoSave(gameState)   // uses requestIdleCallback or setTimeout
}
```

Save format:
```js
{
  seed,
  player: { x, y, hp, hunger },
  inventory: { hotbar[], main[], hotbarIndex },
  time: { t },
  chunks: {},   // always empty in MVP — world modifications not persisted
}
```

---

## src/utils/RecipeRegistry.js

Recipe types:
- `shaped`: 3×3 pattern array (null = empty cell)
- `shapeless`: ingredients array with counts
- `smelting`: input + fuel + result + time (ms)

Stations: `null` (by hand), `'crafting_table'`, `'furnace'`

```js
export const RecipeRegistry = {
  getAll()
  getForStation(station)
  findMatch(station, getCount)   // unused by current CraftingSystem
};
```

Key recipes:
- oak_log → 4 oak_planks (hands)
- 2 planks → 4 sticks (hands)
- coal + stick → 4 torches (hands)
- 4 planks → crafting_table (hands)
- 8 cobblestone → furnace (crafting_table)
- 8 planks → chest (crafting_table)
- Pickaxe/axe/shovel/sword: 3 material + 2 sticks (crafting_table)
- iron_ore + coal → iron_ingot (furnace)
- gold_ore + coal → gold_ingot (furnace)
- sand + coal → glass (furnace)
- raw_pork/raw_meat/raw_fish + coal → cooked (furnace)
