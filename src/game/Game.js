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
    // Crafting buttons wired in HTML via onclick — we just expose craft()
    window.__game = this;
  }

  // Called from HTML crafting buttons
  craft(idx) {
    this._crafting.craft(idx, this._inventory);
    this._hud.updateHotbar(this._inventory);
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

    // Inventory toggle
    if (input.inventory) {
      this._inventoryOpen = !this._inventoryOpen;
      this._hud.showInventory(this._inventoryOpen);
      if (this._inventoryOpen) this._refreshCraftingUI();
    }

    // Flashlight toggle
    if (input.flashlight) {
      this._flashlightOn = !this._flashlightOn;
      this._updateFlashlightIcon();
    }

    // Hotbar scroll
    if (input.scroll !== 0) {
      this._inventory.scrollSelect(input.scroll);
    }

    // Player update (skip movement when inventory open)
    const playerInput = this._inventoryOpen ? { ...input, locked: false } : input;
    const prevHp = this._player.hp;
    this._player.update(dt, playerInput, this._mobs);
    if (this._player.hp < prevHp) this._hud.damageFlash();

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
    const avail = this._crafting.available(this._inventory);
    el.innerHTML = avail.map((r, i) => {
      const name = ItemRegistry.name(r.result.id) ?? BlockRegistry.name(r.result.id);
      const ing  = r.ingredients.map(ig => {
        const iname = ItemRegistry.name(ig.id) ?? BlockRegistry.name(ig.id);
        return `${ig.count}× ${iname}`;
      }).join(', ');
      return `<div class="craft-entry" onclick="window.__game.craft(${i})">
        <span class="craft-name">${name} ×${r.result.count}</span>
        <span class="craft-ing">${ing}</span>
      </div>`;
    }).join('') || '<div style="color:#aaa;padding:4px">Nothing craftable</div>';
  }
}
