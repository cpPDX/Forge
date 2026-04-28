import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SIZE } from '../utils/constants.js';

const SLOT_SIZE = 40;
const SLOT_PAD  = 4;

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUDScene'); }

  create() {
    this._hearts    = [];
    this._hunger    = [];
    this._hotbarGfx = this.add.graphics().setDepth(100).setScrollFactor(0);
    this._hotbarItems = [];
    this._oxyBar    = null;
    this._timeTxt   = null;

    this._buildHearts();
    this._buildHunger();
    this._buildHotbar();
    this._buildOxygen();
    this._buildTimeDisplay();

    this.time.addEvent({ delay: 100, loop: true, callback: this._refresh, callbackScope: this });
  }

  _buildHearts() {
    for (let i = 0; i < 10; i++) {
      const g = this.add.graphics().setDepth(101).setScrollFactor(0);
      this._hearts.push(g);
    }
  }

  _buildHunger() {
    for (let i = 0; i < 10; i++) {
      const g = this.add.graphics().setDepth(101).setScrollFactor(0);
      this._hunger.push(g);
    }
  }

  _buildHotbar() {
    const totalW = HOTBAR_SIZE * (SLOT_SIZE + SLOT_PAD) - SLOT_PAD;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = GAME_HEIGHT - SLOT_SIZE - 10;

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = startX + i * (SLOT_SIZE + SLOT_PAD);
      const gfx = this.add.graphics().setDepth(100).setScrollFactor(0);
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillRect(x, y, SLOT_SIZE, SLOT_SIZE);
      gfx.lineStyle(1, 0x888888, 0.8);
      gfx.strokeRect(x, y, SLOT_SIZE, SLOT_SIZE);

      const itemGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
      const txt = this.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE - 4, '', {
        fontSize: '9px', color: '#ffffff',
      }).setOrigin(0.5, 1).setDepth(102).setScrollFactor(0);
      this._hotbarItems.push({ gfx: itemGfx, txt, x, y });
    }
  }

  _buildOxygen() {
    this._oxyGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
    this._oxyGfx.setVisible(false);
  }

  _buildTimeDisplay() {
    this._timeTxt = this.add.text(GAME_WIDTH / 2, 10, '12:00', {
      fontSize: '14px', color: '#ffffcc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
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

  _refreshHearts(hp, maxHp) {
    for (let i = 0; i < 10; i++) {
      const g = this._hearts[i];
      g.clear();
      const x = 10 + i * 18, y = 10;
      const filled = hp >= (i + 1) * 2;
      const half   = !filled && hp >= i * 2 + 1;
      g.fillStyle(0x660000, 1); g.fillRect(x, y, 14, 14);
      if (filled || half) {
        g.fillStyle(0xff2222, 1);
        g.fillRect(x + 1, y + 1, filled ? 12 : 6, 12);
      }
    }
  }

  _refreshHunger(hunger, maxHunger) {
    for (let i = 0; i < 10; i++) {
      const g = this._hunger[i];
      g.clear();
      const x = GAME_WIDTH - 190 + i * 18, y = 10;
      const filled = hunger >= (i + 1) * 2;
      const half   = !filled && hunger >= i * 2 + 1;
      g.fillStyle(0x442200, 1); g.fillRect(x, y, 14, 14);
      if (filled || half) {
        g.fillStyle(0xcc8800, 1);
        g.fillRect(x + 1, y + 1, filled ? 12 : 6, 12);
      }
    }
  }

  _refreshHotbar(hotbar, hotbarIndex) {
    if (!hotbar) return;
    const totalW = HOTBAR_SIZE * (SLOT_SIZE + SLOT_PAD) - SLOT_PAD;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = GAME_HEIGHT - SLOT_SIZE - 10;

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = hotbar[i];
      const { gfx, txt, x } = this._hotbarItems[i];
      gfx.clear();

      // Selection border
      if (i === hotbarIndex) {
        gfx.lineStyle(2, 0xffffff, 1);
        gfx.strokeRect(x - 1, y - 1, SLOT_SIZE + 2, SLOT_SIZE + 2);
      }

      if (slot) {
        const color = slot.def?.color ?? 0xaaaaaa;
        gfx.fillStyle(color, 1);
        gfx.fillRect(x + 8, y + 8, SLOT_SIZE - 16, SLOT_SIZE - 16);

        // Durability bar
        if (slot.durability !== null && slot.def?.maxDurability) {
          const pct = slot.durability / slot.def.maxDurability;
          gfx.fillStyle(0x000000, 1); gfx.fillRect(x + 2, y + SLOT_SIZE - 5, SLOT_SIZE - 4, 3);
          const barColor = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2222;
          gfx.fillStyle(barColor, 1); gfx.fillRect(x + 2, y + SLOT_SIZE - 5, Math.round((SLOT_SIZE - 4) * pct), 3);
        }

        txt.setText(slot.count > 1 ? String(slot.count) : '');
      } else {
        txt.setText('');
      }
    }
  }

  _refreshOxygen(oxygen, inWater) {
    const g = this._oxyGfx;
    g.clear();
    g.setVisible(!!inWater);
    if (!inWater) return;
    const pct = Math.max(0, oxygen / 10);
    const bW = 100, bH = 8;
    const x = (GAME_WIDTH - bW) / 2, y = 28;
    g.fillStyle(0x000044, 0.7); g.fillRect(x, y, bW, bH);
    g.fillStyle(0x4488ff, 1);   g.fillRect(x, y, Math.round(bW * pct), bH);
    g.lineStyle(1, 0x88aaff, 1); g.strokeRect(x, y, bW, bH);
  }
}
