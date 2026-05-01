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

    // HUD
    this._hud = new HUD();

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

    // Wire both close buttons (bottom bar + top-right X) with touchstart so
    // Safari iOS fires immediately without waiting for a synthesized click
    const closeEl = e => { e.preventDefault(); this.closeInventory(); };
    for (const id of ['inv-close-btn', 'inv-x-btn']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.addEventListener('click',      () => this.closeInventory());
      btn.addEventListener('touchstart', closeEl, { passive: false });
    }

    // Tapping the dark backdrop (anywhere outside #inv-inner) also closes
    const panel = document.getElementById('inventory-panel');
    if (panel) {
      panel.addEventListener('touchstart', e => {
        if (e.target === panel) { e.preventDefault(); this.closeInventory(); }
      }, { passive: false });
      panel.addEventListener('click', e => {
        if (e.target === panel) this.closeInventory();
      });
    }

    // Crafting list — touchstart delegation so taps fire without click delay.
    // data-craft-idx is set only on craftable entries in _refreshCraftingUI.
    // touchstart calls preventDefault so the subsequent click doesn't double-fire.
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

    // Hotbar slots — touchstart for immediate response, click for desktop
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
  }

  _toggleInventory() {
    this._inventoryOpen = !this._inventoryOpen;
    this._hud.showInventory(this._inventoryOpen);
    if (this._inventoryOpen) {
      this._hud.updateInventoryGrid(this._inventory);
      this._refreshCraftingUI();
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
