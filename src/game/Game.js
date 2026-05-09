import * as THREE from 'three';
import { World }         from '../world/World.js';
import { ChunkMesh }     from '../world/ChunkMesh.js';
import { Player }        from '../player/Player.js';
import { Controls }      from '../player/Controls.js';
import { Inventory }     from '../systems/Inventory.js';
import { Crafting }      from '../systems/Crafting.js';
import { TimeSystem }    from '../systems/TimeSystem.js';
import { SaveManager }   from '../systems/SaveManager.js';
import { HUD }           from '../ui/HUD.js';
import { buildTextureAtlas } from '../blocks/TextureAtlas.js';
import { MobSystem }        from '../systems/MobSystem.js';
import { DropSystem }       from '../systems/DropSystem.js';
import { PlayerPreview }    from '../ui/PlayerPreview.js';
import { CHUNK_SIZE, RENDER_DIST, B, ITEMS } from '../utils/constants.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { ItemRegistry }  from '../blocks/ItemRegistry.js';

const SEED = 12345;
const FOG_START = (RENDER_DIST - 1) * CHUNK_SIZE;
const FOG_END   =  RENDER_DIST      * CHUNK_SIZE;

export class Game {
  constructor(canvas) {
    this._canvas = canvas;

    // Three.js core
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.setSize(innerWidth, innerHeight);
    this._renderer.shadowMap.enabled = false;

    this._scene  = new THREE.Scene();
    this._scene.fog = new THREE.Fog(0x87ceeb, FOG_START, FOG_END);

    this._camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, FOG_END + 16);

    // Lighting
    this._ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this._sun     = new THREE.DirectionalLight(0xfff8e0, 1.0);
    this._flashlight = new THREE.PointLight(0xfff0cc, 0, 14, 1.5);
    this._flashlightOn = false;
    this._scene.add(this._ambient, this._sun, this._flashlight);

    // Block selection outline
    this._outline = this._makeOutline();
    this._scene.add(this._outline);

    // Atlas + world
    this._atlas    = buildTextureAtlas();
    this._world    = new World(SEED);
    this._chunkMesh= new ChunkMesh(this._scene, this._atlas);

    // Systems
    this._time     = new TimeSystem();
    this._save     = new SaveManager();
    this._inventory= new Inventory();
    this._crafting = new Crafting();

    // Player + controls
    this._player   = new Player(this._world, this._camera);
    this._player.inventory = this._inventory;
    this._controls = new Controls(canvas);

    // Mobs
    this._mobs = new MobSystem(this._scene, this._world, this._camera);

    // Floating item drops
    this._drops = new DropSystem(this._scene, this._world);
    this._player.onDropItem = (x, y, z, id, count) => this._drops.spawn(x, y, z, id, count);

    // Player preview (3D mini renderer in inventory)
    this._playerPreview = new PlayerPreview(document.getElementById('player-preview'));

    // HUD
    this._hud = new HUD();

    // 2×2 crafting grid state
    this._craftGrid  = [B.AIR, B.AIR, B.AIR, B.AIR];
    this._craftGridCounts = [0, 0, 0, 0];
    this._cursorItem = null;  // { id, count } | null
    this._craftResult = null; // { id, count } | null

    // State
    this._inventoryOpen = false;
    this._dead = false;
    this._lastSave = 0;
    this._fps = 60;
    this._fpsAlpha = 0.1;
    this._lastTs = 0;
    this._modifiedChunks = new Set();

    // Starter inventory
    this._inventory.addItem(ITEMS.WOODEN_SWORD, 1);
    this._inventory.addItem(B.OAK_PLANKS, 16);
    this._inventory.addItem(B.DIRT, 32);
    this._inventory.addItem(B.STONE, 16);
    this._inventory.addItem(B.OAK_LOG, 8);
    this._inventory.addItem(B.TORCH, 8);
    this._inventory.addItem(B.CRAFTING_TABLE, 1);

    this._loadSave();
    this._bindResize();
    this._bindInventoryUI();
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  _loadSave() {
    const data = this._save.load();
    if (!data) return;
    this._player.load(data.player);
    this._inventory.load(data.inventory);
    this._time.load(data.time);
    if (data.chunks) {
      for (const [k, arr] of Object.entries(data.chunks)) {
        const [cx, cz] = k.split(',').map(Number);
        this._world.loadChunkData(cx, cz, arr);
      }
    }
  }

  _doSave() {
    const chunks = {};
    for (const k of this._modifiedChunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (this._world.chunkLoaded(cx, cz)) {
        chunks[k] = Array.from(this._world.getChunkData(cx, cz));
      }
    }
    this._save.autoSave({
      player:    this._player.serialize(),
      inventory: this._inventory.serialize(),
      time:      this._time.serialize(),
      chunks,
    });
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      this._renderer.setSize(innerWidth, innerHeight);
      this._camera.aspect = innerWidth / innerHeight;
      this._camera.updateProjectionMatrix();
    });
  }

  _bindInventoryUI() {
    window.__game = this;

    // Wire both close buttons (bottom bar + top-right X)
    const closeEl = e => { e.preventDefault(); this.closeInventory(); };
    for (const id of ['inv-close-btn', 'inv-x-btn']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.addEventListener('click',      () => this.closeInventory());
      btn.addEventListener('touchstart', closeEl, { passive: false });
    }

    // Tapping the dark backdrop closes
    const panel = document.getElementById('inventory-panel');
    if (panel) {
      panel.addEventListener('touchstart', e => {
        if (e.target === panel) { e.preventDefault(); this.closeInventory(); }
      }, { passive: false });
      panel.addEventListener('click', e => {
        if (e.target === panel) this.closeInventory();
      });
    }

    // Helper: bind left-click, right-click (contextmenu), and mobile long-press
    // Long-press (>400ms) triggers the right-click action (pick half / place 1)
    const bindSlotEvents = (el, handler) => {
      el.addEventListener('click', () => handler(false));
      el.addEventListener('contextmenu', ev => { ev.preventDefault(); handler(true); });
      let longTimer = null;
      el.addEventListener('touchstart', ev => {
        ev.preventDefault();
        longTimer = setTimeout(() => { longTimer = null; handler(true); }, 400);
      }, { passive: false });
      el.addEventListener('touchend', () => {
        if (longTimer) { clearTimeout(longTimer); longTimer = null; handler(false); }
      });
      el.addEventListener('touchmove', () => {
        if (longTimer) { clearTimeout(longTimer); longTimer = null; }
      });
    };

    // 2×2 craft grid slots
    const craftGridEl = document.getElementById('craft-grid');
    if (craftGridEl) {
      craftGridEl.querySelectorAll('.craft-slot').forEach((el, i) =>
        bindSlotEvents(el, rc => this._handleSlotClick('craft', i, rc))
      );
    }

    // Craft output slot
    const craftOut = document.getElementById('craft-output');
    if (craftOut) {
      craftOut.addEventListener('click', () => this._handleSlotClick('output', 0));
      craftOut.addEventListener('touchstart', e => { e.preventDefault(); this._handleSlotClick('output', 0); }, { passive: false });
    }

    // Main inventory + hotbar grids (delegated — re-bound on open via _rebindInvGrids)
    this._rebindInvGrids = () => {
      const bindGrid = (gridId, offset) => {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        grid.querySelectorAll('.inv-slot').forEach((el, i) => {
          el.onclick = null;
          bindSlotEvents(el, rc => this._handleSlotClick('inv', offset + i, rc));
        });
      };
      bindGrid('inv-main-grid', 0);
      bindGrid('inv-hotbar-grid', 27);
    };

    // Crafting recipe list
    const craftList = document.getElementById('crafting-list');
    if (craftList) {
      craftList.addEventListener('touchstart', e => {
        const entry = e.target.closest('[data-craft-idx]');
        if (entry) { e.preventDefault(); this.craft(parseInt(entry.dataset.craftIdx)); }
      }, { passive: false });
      craftList.addEventListener('click', e => {
        const entry = e.target.closest('[data-craft-idx]');
        if (entry) this.craft(parseInt(entry.dataset.craftIdx));
      });
    }

    // Hotbar slots (game HUD)
    for (let i = 0; i < 9; i++) {
      const el = document.getElementById(`slot-${i}`);
      if (!el) continue;
      el.addEventListener('click',      () => { this._inventory.selectSlot(i); this._hud.updateHotbar(this._inventory); });
      el.addEventListener('touchstart', e  => { e.preventDefault(); this._inventory.selectSlot(i); this._hud.updateHotbar(this._inventory); }, { passive: false });
    }
  }

  closeInventory() {
    this._inventoryOpen = false;
    this._hud.showInventory(false);
    this._playerPreview.stop();
    if (this._cursorItem) {
      this._inventory.addItem(this._cursorItem.id, this._cursorItem.count);
      this._cursorItem = null;
      this._hud.setCursorItem(null);
    }
  }

  _toggleInventory() {
    this._inventoryOpen = !this._inventoryOpen;
    this._hud.showInventory(this._inventoryOpen);
    if (this._inventoryOpen) {
      this._hud.updateInventoryGrid(this._inventory);
      this._hud.updateCraftGrid(this._craftGrid.map((id, i) => ({ id, count: this._craftGridCounts[i] })));
      this._hud.updateCraftOutput(this._craftResult);
      this._refreshCraftingUI();
      if (this._rebindInvGrids) this._rebindInvGrids();
      this._playerPreview.start();
    } else {
      this._playerPreview.stop();
      // Return cursor item to inventory on close
      if (this._cursorItem) {
        this._inventory.addItem(this._cursorItem.id, this._cursorItem.count);
        this._cursorItem = null;
        this._hud.setCursorItem(null);
      }
    }
  }

  _respawn() {
    this._player.respawn();
    this._dead = false;
    this._doSave();
  }

  // Called from HTML crafting buttons (index into full recipe list)
  craft(idx) {
    this._crafting.craftByIndex(idx, this._inventory);
    this._hud.updateHotbar(this._inventory);
    this._hud.updateInventoryGrid(this._inventory);
    this._refreshCraftingUI();
    if (this._rebindInvGrids) this._rebindInvGrids();
  }

  // ─── Selection outline ────────────────────────────────────────────────────

  _makeOutline() {
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000, wireframe: true, transparent: true, opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
  }

  _updateOutline() {
    const t = this._player.targeted;
    if (t) {
      this._outline.position.set(t.pos[0] + 0.5, t.pos[1] + 0.5, t.pos[2] + 0.5);
      this._outline.visible = true;
    } else {
      this._outline.visible = false;
    }
  }

  // ─── Chunk streaming ──────────────────────────────────────────────────────

  _streamChunks() {
    const px = this._player.x, pz = this._player.z;
    const cx = Math.floor(px / CHUNK_SIZE);
    const cz = Math.floor(pz / CHUNK_SIZE);
    const R  = RENDER_DIST;

    // Load / remesh dirty chunks within radius
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const ncx = cx + dx, ncz = cz + dz;
        if (!this._chunkMesh.hasMesh(ncx, ncz) || this._world.isDirty(ncx, ncz)) {
          this._chunkMesh.update(ncx, ncz, this._world);
          this._world.clearDirty(ncx, ncz);
        }
      }
    }

    // Unload meshes far away
    for (const [k] of this._chunkMesh._meshes) {
      const [mcx, mcz] = k.split(',').map(Number);
      if (Math.abs(mcx - cx) > R + 1 || Math.abs(mcz - cz) > R + 1) {
        this._chunkMesh._dispose(mcx, mcz);
      }
    }

    // Track newly modified chunks for save
    for (const k of this._world._dirty) {
      this._modifiedChunks.add(k);
    }
  }

  // ─── Main loop ────────────────────────────────────────────────────────────

  start() {
    requestAnimationFrame(ts => this._loop(ts));
  }

  _loop(ts) {
    requestAnimationFrame(ts2 => this._loop(ts2));

    const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;
    if (dt <= 0) return;

    this._fps = this._fps * (1 - this._fpsAlpha) + (1 / dt) * this._fpsAlpha;

    const input = this._controls.poll();

    // While dead, render the scene but skip all game logic
    if (this._dead) {
      this._renderer.render(this._scene, this._camera);
      return;
    }

    // Inventory toggle
    if (input.inventory) {
      this._toggleInventory();
    }

    // Flashlight toggle
    if (input.flashlight) {
      this._flashlightOn = !this._flashlightOn;
      this._updateFlashlightIcon();
    }

    // Hotbar scroll / direct key select
    if (input.scroll !== 0) {
      this._inventory.scrollSelect(input.scroll);
    }
    if (input.hotbarSelect >= 0) {
      this._inventory.selectSlot(input.hotbarSelect);
    }

    // Player update (skip movement when inventory open)
    const playerInput = this._inventoryOpen ? { ...input, locked: false } : input;
    const prevHp = this._player.hp;
    this._player.update(dt, playerInput, this._mobs);
    if (this._player.hp < prevHp) this._hud.damageFlash();

    // Death check
    if (this._player.hp <= 0) {
      this._dead = true;
      this._hud.showDeathScreen(() => this._respawn());
    }

    // Block interaction (crafting table, furnace, etc.)
    if (this._player.pendingInteract) {
      const action = this._player.pendingInteract;
      this._player.pendingInteract = null;
      if (action === 'crafting') this._toggleInventory();
    }

    // Update selected block label
    const t = this._player.targeted;
    if (t) {
      const id = this._world.getBlock(...t.pos);
      t._cachedId = id;
      this._hud.setLabel(BlockRegistry.name(id));
    } else {
      this._hud.setLabel('');
    }

    // Track dirty chunks from setBlock calls
    for (const k of this._world._dirty) {
      this._modifiedChunks.add(k);
    }

    this._drops.update(dt, this._player, this._inventory);
    this._streamChunks();
    this._updateOutline();
    this._updateFlashlight();
    this._mobs.update(dt, this._player, this._time.isDay === false);

    this._time.update(dt);
    this._time.applyToScene(this._scene, this._renderer, this._ambient, this._sun);

    this._hud.updateHotbar(this._inventory);
    this._hud.updateBars(this._player.hp, this._player.hunger);
    this._hud.updateDebug(
      this._player,
      this._chunkMesh._meshes.size,
      Math.round(this._fps),
      this._time.hourString,
      this._mobs.count(),
    );

    // Auto-save every 30s
    this._lastSave += dt;
    if (this._lastSave > 30) {
      this._lastSave = 0;
      this._doSave();
    }

    this._renderer.render(this._scene, this._camera);
  }

  // ─── Flashlight ──────────────────────────────────────────────────────────

  _updateFlashlight() {
    if (this._flashlightOn) {
      this._flashlight.position.copy(this._camera.position);
      this._flashlight.intensity = 1.8;
    } else {
      this._flashlight.intensity = 0;
    }
  }

  _updateFlashlightIcon() {
    const el = document.getElementById('flashlight-indicator');
    if (el) el.style.opacity = this._flashlightOn ? '1' : '0.35';
  }

  // ─── 2×2 Craft grid ──────────────────────────────────────────────────────

  _updateCraftOutput() {
    const ing = {};
    for (let i = 0; i < 4; i++) {
      const id = this._craftGrid[i];
      const ct = this._craftGridCounts[i];
      if (id !== B.AIR && ct > 0) ing[id] = (ing[id] ?? 0) + ct;
    }
    if (Object.keys(ing).length === 0) { this._craftResult = null; this._hud.updateCraftOutput(null); return; }

    const recipe = this._crafting.allRecipes().find(r => {
      // All required ingredients present in sufficient quantity
      if (!r.ingredients.every(ig => (ing[ig.id] ?? 0) >= ig.count)) return false;
      // No extra ingredient types that the recipe doesn't require
      const recipeIds = new Set(r.ingredients.map(ig => ig.id));
      return Object.keys(ing).every(id => recipeIds.has(Number(id)));
    });

    this._craftResult = recipe ? recipe.result : null;
    this._hud.updateCraftOutput(this._craftResult);
  }

  _handleSlotClick(type, index, isRightClick = false) {
    if (type === 'craft') {
      if (!this._cursorItem) {
        if (this._craftGrid[index] !== B.AIR && this._craftGridCounts[index] > 0) {
          if (isRightClick) {
            // Pick up half
            const half = Math.ceil(this._craftGridCounts[index] / 2);
            this._cursorItem = { id: this._craftGrid[index], count: half };
            this._craftGridCounts[index] -= half;
            if (this._craftGridCounts[index] <= 0) { this._craftGrid[index] = B.AIR; this._craftGridCounts[index] = 0; }
          } else {
            this._cursorItem = { id: this._craftGrid[index], count: this._craftGridCounts[index] };
            this._craftGrid[index] = B.AIR; this._craftGridCounts[index] = 0;
          }
        }
      } else {
        if (this._craftGrid[index] === B.AIR || this._craftGrid[index] === this._cursorItem.id) {
          const place = isRightClick ? 1 : this._cursorItem.count;
          this._craftGrid[index] = this._cursorItem.id;
          this._craftGridCounts[index] = (this._craftGridCounts[index] || 0) + place;
          this._cursorItem.count -= place;
          if (this._cursorItem.count <= 0) this._cursorItem = null;
        } else if (!isRightClick) {
          // Swap on left-click only
          const tmp = { id: this._craftGrid[index], count: this._craftGridCounts[index] };
          this._craftGrid[index] = this._cursorItem.id;
          this._craftGridCounts[index] = this._cursorItem.count;
          this._cursorItem = tmp;
        }
      }
      this._hud.updateCraftGrid(this._craftGrid.map((id, i) => ({ id, count: this._craftGridCounts[i] })));
      this._updateCraftOutput();
    } else if (type === 'output') {
      if (!isRightClick && this._craftResult && !this._cursorItem) {
        const recipe = this._crafting.allRecipes().find(r =>
          r.result.id === this._craftResult.id && r.result.count === this._craftResult.count);
        if (recipe) {
          for (const ig of recipe.ingredients) {
            let remaining = ig.count;
            for (let i = 0; i < 4 && remaining > 0; i++) {
              if (this._craftGrid[i] === ig.id) {
                const take = Math.min(this._craftGridCounts[i], remaining);
                this._craftGridCounts[i] -= take; remaining -= take;
                if (this._craftGridCounts[i] <= 0) { this._craftGrid[i] = B.AIR; this._craftGridCounts[i] = 0; }
              }
            }
          }
        }
        this._inventory.addItem(this._craftResult.id, this._craftResult.count);
        this._craftResult = null;
        this._hud.updateCraftGrid(this._craftGrid.map((id, i) => ({ id, count: this._craftGridCounts[i] })));
        this._hud.updateInventoryGrid(this._inventory);
        if (this._rebindInvGrids) this._rebindInvGrids();
        this._updateCraftOutput();
        this._refreshCraftingUI();
        this._hud.updateHotbar(this._inventory);
      }
    } else if (type === 'inv') {
      // slots array is ordered [main(27), hotbar(9)] to match updateInventoryGrid render order
      const allSlots = [...this._inventory.mainSlots(), ...this._inventory.hotbarSlots()];
      const slot = allSlots[index];
      if (!slot) return;

      if (!this._cursorItem) {
        if (slot.id !== B.AIR && slot.count > 0) {
          if (isRightClick) {
            // Pick up half (rounded up)
            const half = Math.ceil(slot.count / 2);
            this._cursorItem = { id: slot.id, count: half };
            slot.count -= half;
            if (slot.count <= 0) { slot.id = B.AIR; slot.count = 0; }
          } else {
            this._cursorItem = { id: slot.id, count: slot.count };
            slot.id = B.AIR; slot.count = 0;
          }
        }
      } else {
        if (slot.id === B.AIR || slot.id === this._cursorItem.id) {
          const existing = slot.id === this._cursorItem.id ? slot.count : 0;
          const place = isRightClick ? 1 : this._cursorItem.count;
          slot.id = this._cursorItem.id;
          slot.count = existing + place;
          this._cursorItem.count -= place;
          if (this._cursorItem.count <= 0) this._cursorItem = null;
        } else if (!isRightClick) {
          const tmp = { id: slot.id, count: slot.count };
          slot.id = this._cursorItem.id; slot.count = this._cursorItem.count;
          this._cursorItem = tmp;
        }
      }
      this._hud.updateInventoryGrid(this._inventory);
      if (this._rebindInvGrids) this._rebindInvGrids();
      this._hud.updateHotbar(this._inventory);
    }

    const iname = this._cursorItem
      ? (ItemRegistry.name(this._cursorItem.id) ?? BlockRegistry.name(this._cursorItem.id))
      : null;
    this._hud.setCursorItem(this._cursorItem
      ? { ...this._cursorItem, name: iname } : null);
  }

  // ─── Crafting UI ─────────────────────────────────────────────────────────

  _refreshCraftingUI() {
    const el = document.getElementById('crafting-list');
    if (!el) return;
    const all = this._crafting.allRecipes();
    el.innerHTML = all.map((r, i) => {
      const name = ItemRegistry.name(r.result.id) ?? BlockRegistry.name(r.result.id);
      const canCraft = r.ingredients.every(ig => this._inventory.countOf(ig.id) >= ig.count);
      const ing = r.ingredients.map(ig => {
        const have = this._inventory.countOf(ig.id);
        const iname = ItemRegistry.name(ig.id) ?? BlockRegistry.name(ig.id);
        const color = have >= ig.count ? '#2a8a2a' : '#aa2222';
        return `<span style="color:${color}">${have}/${ig.count}× ${iname}</span>`;
      }).join(', ');
      const opacity  = canCraft ? '1' : '0.55';
      const cursor   = canCraft ? 'pointer' : 'default';
      const dataAttr = canCraft ? `data-craft-idx="${i}"` : '';
      return `<div class="craft-entry" style="opacity:${opacity};cursor:${cursor}" ${dataAttr}>
        <span class="craft-name">${name} ×${r.result.count}</span>
        <span class="craft-ing">${ing}</span>
      </div>`;
    }).join('');
  }
}
