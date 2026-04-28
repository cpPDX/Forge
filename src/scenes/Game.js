import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, CAMERA_ZOOM, TILE_SIZE, CHUNK_SIZE, TILES, MAX_MOBS, MOB_DESPAWN_DIST } from '../utils/constants.js';
import { World }          from '../world/World.js';
import { ChunkRenderer }  from '../world/ChunkRenderer.js';
import { Player }         from '../entities/Player.js';
import { Mob, MOB_DEFS }  from '../entities/Mob.js';
import { Drop }           from '../entities/Drop.js';
import { InventorySystem }from '../systems/InventorySystem.js';
import { TimeSystem }     from '../systems/TimeSystem.js';
import { LightingSystem } from '../systems/LightingSystem.js';
import { SaveManager }    from '../systems/SaveManager.js';
import { TouchControls }  from '../ui/TouchControls.js';

const MOB_TYPES       = Object.keys(MOB_DEFS);
const SURFACE_MOBS    = ['slime', 'zombie', 'skeleton', 'spider', 'creeper', 'pig', 'rabbit'];
const UNDERWORLD_MOBS = ['lava_slime'];
const SPAWN_INTERVAL  = 4000;
const AUTOSAVE_MS     = 30000;
const HUD_EMIT_MS     = 200;

export class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create(data) {
    const { seed, saveData, newGame } = data || {};

    this._save    = new SaveManager();
    this._world   = new World(seed ?? Math.floor(Math.random() * 1e9));
    this._inv     = new InventorySystem();
    this._time    = new TimeSystem(0.35);
    this._drops   = [];
    this._mobs    = [];
    this._spawnTimer  = 0;
    this._saveTimer   = 0;
    this._hudTimer    = 0;

    // Restore save
    if (saveData) {
      this._inv.deserialize(saveData.inventory);
      this._time.deserialize(saveData.time);
    }

    const spawn = this._world.getSpawnPoint();
    const px = saveData?.player?.x ?? spawn.x;
    const py = saveData?.player?.y ?? spawn.y;

    this._player = new Player(this, this._world, this._inv, px, py);
    if (saveData?.player) {
      this._player.hp     = saveData.player.hp     ?? this._player.maxHp;
      this._player.hunger = saveData.player.hunger ?? this._player.maxHunger;
    }

    this._renderer = new ChunkRenderer(this, this._world);
    this._lighting = new LightingSystem(this, this._world, this._time);
    this._controls = new TouchControls(this);

    // Camera
    this._camX = this._player.centerX - GAME_WIDTH  / 2 / CAMERA_ZOOM;
    this._camY = this._player.centerY - GAME_HEIGHT / 2 / CAMERA_ZOOM;

    // Sky background
    this._skyGfx = this.add.graphics().setDepth(-1).setScrollFactor(0);

    // Events
    this.events.on('playerDied',  this._onPlayerDied,  this);
    this.events.on('spawnDrop',   this._onSpawnDrop,   this);
    this.events.on('mobDied',     this._onMobDied,     this);
    this.events.on('tileChanged', this._onTileChanged, this);

    // Right-click to place / interact
    this.input.on('pointerdown', (p) => {
      if (p.button === 2) this._onRightClick(p);
    });

    // Hotbar scroll
    this.input.on('wheel', (p, gos, dx, dy) => {
      this._inv.hotbarIndex = (this._inv.hotbarIndex + (dy > 0 ? 1 : -1) + 9) % 9;
    });

    // Number keys for hotbar
    for (let i = 1; i <= 9; i++) {
      this.input.keyboard.on(`keydown-${i}`, () => { this._inv.hotbarIndex = i - 1; });
    }

    // Launch HUD
    this.scene.launch('HUDScene');

    // Give starter items on new game
    if (newGame) {
      this._inv.addItem('wood_pickaxe', 1);
      this._inv.addItem('wood_axe', 1);
      this._inv.addItem('torch', 8);
      this._inv.addItem('apple', 5);
    }

    // Pre-render visible chunks
    this._updateVisibleChunks();
  }

  update(time, delta) {
    if (this._player.dead) return;

    // Poll controls
    const zoom = CAMERA_ZOOM;
    const input = this._controls.poll(
      this.input.activePointer.x,
      this.input.activePointer.y,
      this._camX,
      this._camY,
      zoom
    );

    // Use food (F key)
    if (this.input.keyboard.checkDown(this.input.keyboard.addKey('F'), 500)) {
      this._tryEat();
    }

    // Inventory toggle
    if (input.inventoryJustPressed) {
      if (this.scene.isActive('InventoryScene')) this.scene.stop('InventoryScene');
      else this.scene.launch('InventoryScene', { gameScene: this });
    }

    this._player.update(time, delta, input);
    this._controls.flush();

    // Camera follow
    const targetX = this._player.centerX - GAME_WIDTH  / 2 / zoom;
    const targetY = this._player.centerY - GAME_HEIGHT / 2 / zoom;
    this._camX += (targetX - this._camX) * 0.12;
    this._camY += (targetY - this._camY) * 0.12;

    // Clamp camera
    this._camX = Math.max(0, Math.min(this._camX, this._world.seed ? Infinity : 0));
    this._camY = Math.max(0, this._camY);

    this._updateVisibleChunks();
    this._renderScene(zoom);

    // Update drops
    for (let i = this._drops.length - 1; i >= 0; i--) {
      const d = this._drops[i];
      d.update(delta, this._world, this._player);
      if (d.collected) this._drops.splice(i, 1);
    }

    // Update mobs
    for (let i = this._mobs.length - 1; i >= 0; i--) {
      const m = this._mobs[i];
      if (m.dead) { this._mobs.splice(i, 1); continue; }
      m.update(delta, this._world, this._player, time);

      // Despawn
      const mdx = m.x - this._player.centerX;
      const mdy = m.y - this._player.centerY;
      if (Math.sqrt(mdx * mdx + mdy * mdy) > MOB_DESPAWN_DIST * TILE_SIZE) {
        m.destroy(); this._mobs.splice(i, 1);
      }
    }

    // Mob spawning
    this._spawnTimer += delta;
    if (this._spawnTimer > SPAWN_INTERVAL && this._mobs.length < MAX_MOBS) {
      this._spawnTimer = 0;
      this._trySpawnMob();
    }

    // Time
    this._time.update(delta);
    this._updateSky();

    // Lighting
    this._lighting.update(delta, this._camX, this._camY, GAME_WIDTH / zoom, GAME_HEIGHT / zoom, zoom);

    // HUD emit
    this._hudTimer += delta;
    if (this._hudTimer > HUD_EMIT_MS) { this._hudTimer = 0; this._emitHUD(); }

    // Autosave
    this._saveTimer += delta;
    if (this._saveTimer > AUTOSAVE_MS) { this._saveTimer = 0; this._doSave(); }
  }

  _updateVisibleChunks() {
    const zoom = CAMERA_ZOOM;
    const viewW = GAME_WIDTH  / zoom;
    const viewH = GAME_HEIGHT / zoom;

    const cxStart = Math.max(0, Math.floor(this._camX / (CHUNK_SIZE * TILE_SIZE)) - 1);
    const cyStart = Math.max(0, Math.floor(this._camY / (CHUNK_SIZE * TILE_SIZE)) - 1);
    const cxEnd   = cxStart + Math.ceil(viewW  / (CHUNK_SIZE * TILE_SIZE)) + 3;
    const cyEnd   = cyStart + Math.ceil(viewH  / (CHUNK_SIZE * TILE_SIZE)) + 3;

    for (let cy = cyStart; cy <= cyEnd; cy++) {
      for (let cx = cxStart; cx <= cxEnd; cx++) {
        const img = this._renderer.getChunkImage(cx, cy);
        img.x = cx * CHUNK_SIZE * TILE_SIZE;
        img.y = cy * CHUNK_SIZE * TILE_SIZE;
      }
    }
  }

  _renderScene(zoom) {
    // Offset all world objects by camera
    const offX = -this._camX * zoom;
    const offY = -this._camY * zoom;

    // Player graphics
    this._player._gfx.x = (this._player.x - this._camX) * zoom;
    this._player._gfx.y = (this._player.y - this._camY) * zoom;
    this._player._gfx.setScale(zoom);

    // Mobs
    for (const m of this._mobs) {
      m._gfx.x = (m.x - this._camX) * zoom;
      m._gfx.y = (m.y - this._camY) * zoom;
      m._gfx.setScale(zoom);
    }

    // Drops
    for (const d of this._drops) {
      d._gfx.x = (d.x - this._camX) * zoom;
      d._gfx.y = (d.y - this._camY) * zoom;
      d._gfx.setScale(zoom);
    }

    // Chunks
    for (const [key, entry] of this._renderer._cache) {
      const [cx, cy] = key.split(',').map(Number);
      entry.image.x = (cx * CHUNK_SIZE * TILE_SIZE - this._camX) * zoom;
      entry.image.y = (cy * CHUNK_SIZE * TILE_SIZE - this._camY) * zoom;
      entry.image.setScale(zoom);
    }
  }

  _updateSky() {
    const g = this._skyGfx;
    g.clear();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this._time.skyColor).color, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  _emitHUD() {
    this.registry.set('hudState', {
      hp:          this._player.hp,
      maxHp:       this._player.maxHp,
      hunger:      this._player.hunger,
      maxHunger:   this._player.maxHunger,
      oxygen:      this._player.oxygen,
      inWater:     this._player.inWater,
      hotbar:      this._inv.hotbar.map(s => s ? { ...s } : null),
      hotbarIndex: this._inv.hotbarIndex,
      time:        this._time.hourString,
      isNight:     this._time.isNight,
    });
  }

  _tryEat() {
    for (const slot of [...this._inv.hotbar, ...this._inv.main]) {
      if (!slot) continue;
      const def = slot.def;
      if (def?.hungerRestore > 0) {
        this._player.eat(slot.itemId, def.hungerRestore);
        return;
      }
    }
  }

  _onRightClick(pointer) {
    const zoom = CAMERA_ZOOM;
    const wx = pointer.x / zoom + this._camX;
    const wy = pointer.y / zoom + this._camY;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);

    const inReach = Math.abs(this._player.centerX - (tx + 0.5) * TILE_SIZE) < this._player.w * 5 &&
                    Math.abs(this._player.centerY - (ty + 0.5) * TILE_SIZE) < this._player.h * 5;
    if (!inReach) return;

    const tileId = this._world.getTile(tx, ty);
    if (tileId === TILES.CRAFTING_TABLE) {
      this.scene.launch('CraftingScene', { gameScene: this, station: 'crafting_table' });
    } else if (tileId === TILES.FURNACE) {
      this.scene.launch('FurnaceScene', { gameScene: this });
    } else if (tileId === TILES.CHEST) {
      // TODO: chest UI
      console.log('TODO: chest UI');
    } else {
      // Place tile
      if (this._world.getTile(tx, ty) === TILES.AIR) {
        const held = this._inv.getHotbarItem(this._inv.hotbarIndex);
        if (held?.def?.tileId) {
          this._world.setTile(tx, ty, held.def.tileId);
          this._inv.removeItem(held.itemId, 1);
          this._onTileChanged(tx, ty, held.def.tileId);
        }
      }
    }
  }

  _onTileChanged(tx, ty, newId) {
    this._renderer.markDirty(tx, ty);
    // Rebuild chunk canvas
    const cx = tx >> 5, cy = ty >> 5;
    const key = `${cx},${cy}`;
    if (this._renderer._cache.has(key)) {
      const entry = this._renderer._cache.get(key);
      entry.dirty = true;
      this._renderer.getChunkImage(cx, cy); // triggers redraw
    }
  }

  _onSpawnDrop(x, y, itemId, count) {
    this._drops.push(new Drop(this, x, y, itemId, count));
  }

  _onMobDied(mob) {
    const idx = this._mobs.indexOf(mob);
    if (idx !== -1) this._mobs.splice(idx, 1);
  }

  _onPlayerDied() {
    // Drop all items at death location
    const drops = this._inv.dropAll();
    for (const d of drops) {
      this._drops.push(new Drop(this, this._player.x + this._player.w / 2, this._player.y, d.itemId, d.count));
    }

    // Destroy mobs/drops visuals
    for (const m of this._mobs) m.destroy();
    for (const d of this._drops) d.destroy();
    this._mobs   = [];
    this._drops  = [];

    this._save.deleteSave();
    this._lighting.destroy();
    this.scene.stop('HUDScene');
    this.scene.stop('InventoryScene');
    this.scene.stop('CraftingScene');
    this.scene.stop('FurnaceScene');
    this.scene.start('GameOver');
  }

  _trySpawnMob() {
    const playerTY = this._player.tileY;
    const isUnderworld = playerTY >= 430;
    const pool = isUnderworld ? UNDERWORLD_MOBS : SURFACE_MOBS;

    // Pick a random spawn position off-screen
    const angle = Math.random() * Math.PI * 2;
    const dist  = 18 * TILE_SIZE + Math.random() * 6 * TILE_SIZE;
    const sx    = this._player.centerX + Math.cos(angle) * dist;
    const sy    = this._player.centerY + Math.sin(angle) * dist;

    const tx = Math.floor(sx / TILE_SIZE);
    const ty = Math.floor(sy / TILE_SIZE);

    // Only spawn on solid ground
    if (!this._world.isSolid(tx, ty + 1) || this._world.isSolid(tx, ty)) return;

    const type = pool[Math.floor(Math.random() * pool.length)];

    // Only spawn hostile mobs at night, passives anytime
    const def = MOB_DEFS[type];
    if (!def.passive && this._time.isDay) {
      if (Math.random() > 0.15) return; // rare during day
    }

    this._mobs.push(new Mob(this, sx, sy - def.h, type));
  }

  _doSave() {
    this._save.autoSave({
      seed:      this._world.seed,
      player:    { x: this._player.x, y: this._player.y, hp: this._player.hp, hunger: this._player.hunger },
      inventory: this._inv.serialize(),
      time:      this._time.serialize(),
      chunks:    {},
    });
  }

  _serializeModifiedChunks() { return {}; }
  _loadChunkData()            {}
}
