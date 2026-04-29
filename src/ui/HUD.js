import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { B } from '../utils/constants.js';

const HOTBAR_SIZE = 9;

export class HUD {
  constructor() {
    this._hotbarSlots = Array.from({ length: HOTBAR_SIZE }, (_, i) =>
      document.getElementById(`slot-${i}`)
    );
    this._health  = document.getElementById('health-bar');
    this._hunger  = document.getElementById('hunger-bar');
    this._label   = document.getElementById('block-label');
    this._debug   = document.getElementById('debug');
    this._invEl   = document.getElementById('inventory-panel');
    this._crosshair = document.querySelector('.crosshair');
  }

  // ─── Hotbar ──────────────────────────────────────────────────────────────

  updateHotbar(inventory) {
    const slots = inventory.hotbarSlots();
    const sel   = inventory.selectedSlot;

    slots.forEach((slot, i) => {
      const el = this._hotbarSlots[i];
      if (!el) return;
      el.classList.toggle('selected', i === sel);
      el.innerHTML = '';

      if (slot.id !== B.AIR && slot.count > 0) {
        const name = el.dataset.label = BlockRegistry.name(slot.id);
        el.style.background = this._blockColor(slot.id);
        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          el.appendChild(cnt);
        }
      } else {
        el.style.background = '';
        el.dataset.label = '';
      }
    });
  }

  // ─── Health / Hunger ─────────────────────────────────────────────────────

  updateBars(hp, hunger) {
    if (this._health) this._health.style.width = `${(hp / 20) * 100}%`;
    if (this._hunger) this._hunger.style.width = `${(hunger / 20) * 100}%`;
  }

  // ─── Block label ─────────────────────────────────────────────────────────

  updateLabel(targeted) {
    if (!this._label) return;
    if (targeted) {
      const [x, y, z] = targeted.pos;
      const id = targeted._cachedId;
      this._label.textContent = id ? BlockRegistry.name(id) : '';
      this._label.style.opacity = id ? '1' : '0';
    } else {
      this._label.style.opacity = '0';
    }
  }

  setLabel(name) {
    if (!this._label) return;
    this._label.textContent = name || '';
    this._label.style.opacity = name ? '1' : '0';
  }

  // ─── Debug overlay ────────────────────────────────────────────────────────

  updateDebug(player, chunkCount, fps, time) {
    if (!this._debug || this._debug.style.display === 'none') return;
    const { x, y, z } = player;
    this._debug.innerHTML =
      `XYZ: ${x.toFixed(2)} / ${y.toFixed(2)} / ${z.toFixed(2)}<br>` +
      `Chunk: ${Math.floor(x/16)}, ${Math.floor(z/16)}<br>` +
      `Chunks loaded: ${chunkCount}<br>` +
      `Time: ${time}<br>` +
      `FPS: ${fps}`;
  }

  // ─── Inventory overlay ────────────────────────────────────────────────────

  showInventory(show) {
    if (this._invEl) this._invEl.classList.toggle('hidden', !show);
  }

  isInventoryOpen() {
    return this._invEl && !this._invEl.classList.contains('hidden');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  _blockColor(id) {
    const colors = {
      [B.GRASS]: '#3a8a2a', [B.DIRT]: '#8b5e2e', [B.STONE]: '#7a7a7a',
      [B.SAND]: '#d4c07a', [B.COBBLESTONE]: '#7a7a7a', [B.OAK_LOG]: '#7a4a20',
      [B.OAK_PLANKS]: '#c08040', [B.OAK_LEAVES]: '#2a6a1a', [B.GLASS]: '#aaddff',
      [B.COAL_ORE]: '#555', [B.IRON_ORE]: '#c8a07a', [B.GOLD_ORE]: '#ffd700',
      [B.DIAMOND_ORE]: '#44ddff', [B.SANDSTONE]: '#d4b860', [B.WATER]: '#2255cc',
      [B.LAVA]: '#ff4400', [B.GLOWSTONE]: '#ffe040', [B.NETHERRACK]: '#6a1a1a',
      [B.ICE]: '#aaddff', [B.SNOW]: '#eeeeff', [B.STONE_BRICK]: '#888',
      [B.CRAFTING_TABLE]: '#7a4020', [B.FURNACE]: '#606060',
      [B.IRON_BLOCK]: '#d0d0d0', [B.GOLD_BLOCK]: '#ffd700', [B.DIAMOND_BLOCK]: '#44ddff',
      [B.CLAY]: '#9aacbc', [B.SNOW_BLOCK]: '#eeeeff', [B.GRAVEL]: '#888878',
      [B.BEDROCK]: '#202020',
    };
    return colors[id] ?? '#555';
  }
}
