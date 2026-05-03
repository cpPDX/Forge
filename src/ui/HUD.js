import { ItemRegistry } from '../blocks/ItemRegistry.js';
import { B } from '../utils/constants.js';
import { drawItemSprite } from './ItemSprites.js';

const HOTBAR_SIZE = 9;

export class HUD {
  constructor() {
    this._hotbarSlots = Array.from({ length: HOTBAR_SIZE }, (_, i) =>
      document.getElementById(`slot-${i}`)
    );
    this._heartsRow = document.getElementById('hearts-row');
    this._hungerRow = document.getElementById('hunger-row');
    this._label      = document.getElementById('block-label');
    this._debug      = document.getElementById('debug');
    this._invEl      = document.getElementById('inventory-panel');
    this._dmgFlash   = document.getElementById('dmg-flash');
    this._deathScreen= document.getElementById('death-screen');
    this._heartCanvases = [];
    this._hungerCanvases = [];
    this._buildIconRows();
  }

  // ─── Icon rows (hearts / hunger) ─────────────────────────────────────────

  _buildIconRows() {
    for (let i = 0; i < 10; i++) {
      this._heartCanvases.push(this._makeIcon(this._heartsRow));
      this._hungerCanvases.push(this._makeIcon(this._hungerRow));
    }
  }

  _makeIcon(parent) {
    const c = document.createElement('canvas');
    c.width = c.height = 9;
    c.style.cssText = 'width:9px;height:9px;image-rendering:pixelated;display:block;';
    if (parent) parent.appendChild(c);
    return c;
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
      el.style.background = '';

      if (slot.id !== B.AIR && slot.count > 0) {
        const sz = el.clientWidth || 44;
        const c = document.createElement('canvas');
        c.width = c.height = sz;
        c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;`;
        drawItemSprite(c.getContext('2d'), slot.id, sz);
        el.appendChild(c);

        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          el.appendChild(cnt);
        }
      }
    });
  }

  // ─── Health / Hunger ─────────────────────────────────────────────────────

  updateBars(hp, hunger) {
    this._drawHearts(hp);
    this._drawHunger(hunger);
  }

  _drawHearts(hp) {
    for (let i = 0; i < 10; i++) {
      const c = this._heartCanvases[i];
      if (!c) continue;
      const filled = hp - i * 2;
      this._drawHeart(c, filled >= 2 ? 'full' : filled >= 1 ? 'half' : 'empty');
    }
  }

  _drawHunger(hunger) {
    for (let i = 0; i < 10; i++) {
      const c = this._hungerCanvases[i];
      if (!c) continue;
      const filled = hunger - i * 2;
      this._drawDrumstick(c, filled >= 2 ? 'full' : filled >= 1 ? 'half' : 'empty');
    }
  }

  _drawHeart(canvas, state) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 9, 9);
    // background outline (dark)
    const outline = [[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[3,6]];
    const px = (x,y,col) => { ctx.fillStyle=col; ctx.fillRect(x,y,1,1); };
    for (const [x,y] of outline) px(x,y,'#550000');
    if (state === 'empty') return;
    // fill
    const fill = [[1,1],[2,1],[4,1],[5,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[3,6]];
    const fillCol = '#FF0000';
    const halfCol = '#777';
    for (const [x,y] of fill) px(x, y, (state === 'half' && x >= 3) ? halfCol : fillCol);
    // shine
    px(1,1,'#FF6666'); px(2,1,'#FF6666');
  }

  _drawDrumstick(canvas, state) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 9, 9);
    const px = (x,y,col) => { ctx.fillStyle=col; ctx.fillRect(x,y,1,1); };
    const outline = [[2,0],[3,0],[1,1],[2,1],[3,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[5,5],[3,6],[4,6],[5,6],[4,7],[5,7],[5,8]];
    for (const [x,y] of outline) px(x,y,'#552200');
    if (state === 'empty') return;
    const fill = [[2,0],[3,0],[1,1],[2,1],[3,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[5,5],[3,6],[4,6],[5,6],[4,7],[5,7],[5,8]];
    const full = '#cc7722';
    const half = '#777';
    for (const [x,y] of fill) px(x, y, (state === 'half' && x >= 3) ? half : full);
    px(1,2,'#ee9944'); px(1,3,'#ee9944');
  }

  // ─── Block / item label ───────────────────────────────────────────────────

  setLabel(name) {
    if (!this._label) return;
    this._label.textContent = name || '';
    this._label.style.opacity = name ? '1' : '0';
  }

  // ─── Damage flash ─────────────────────────────────────────────────────────

  damageFlash() {
    const el = this._dmgFlash;
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.6s ease-out';
      el.style.opacity = '0';
    });
  }

  // ─── Debug overlay ────────────────────────────────────────────────────────

  updateDebug(player, chunkCount, fps, time, mobCount) {
    if (!this._debug || this._debug.style.display !== 'block') return;
    const { x, y, z } = player;
    const slot = player.inventory?.hotbarSlot(player.inventory.selectedSlot);
    const weapon = slot && ItemRegistry.get(slot.id);
    this._debug.innerHTML =
      `XYZ: ${x.toFixed(2)} / ${y.toFixed(2)} / ${z.toFixed(2)}<br>` +
      `Chunk: ${Math.floor(x/16)}, ${Math.floor(z/16)}<br>` +
      `Chunks: ${chunkCount} &nbsp; Mobs: ${mobCount}<br>` +
      `Time: ${time} &nbsp; FPS: ${fps}<br>` +
      (weapon ? `${weapon.name} (${weapon.damage ?? 1} dmg)` : 'Fist (1 dmg)');
  }

  // ─── Inventory overlay ────────────────────────────────────────────────────

  showInventory(show) {
    if (this._invEl) this._invEl.classList.toggle('hidden', !show);
  }

  updateInventoryGrid(inventory) {
    const main = document.getElementById('inv-main-grid');
    const hbar = document.getElementById('inv-hotbar-grid');
    if (!main || !hbar) return;

    const makeSlot = slot => {
      const div = document.createElement('div');
      div.className = 'inv-slot';
      if (slot.id !== B.AIR && slot.count > 0) {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;';
        drawItemSprite(c.getContext('2d'), slot.id, 32);
        div.appendChild(c);
        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          div.appendChild(cnt);
        }
      }
      return div;
    };

    main.innerHTML = '';
    inventory.mainSlots().forEach(s => main.appendChild(makeSlot(s)));
    hbar.innerHTML = '';
    inventory.hotbarSlots().forEach(s => hbar.appendChild(makeSlot(s)));
  }

  isInventoryOpen() {
    return this._invEl && !this._invEl.classList.contains('hidden');
  }

  // ─── Death screen ─────────────────────────────────────────────────────────

  showDeathScreen(onRespawn) {
    if (!this._deathScreen) return;
    this._deathScreen.classList.remove('hidden');
    const btn = document.getElementById('respawn-btn');
    if (btn) btn.onclick = () => { this.hideDeathScreen(); onRespawn(); };
  }

  hideDeathScreen() {
    if (this._deathScreen) this._deathScreen.classList.add('hidden');
  }
}
