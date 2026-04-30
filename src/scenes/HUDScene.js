import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SIZE } from '../utils/constants.js';

const SLOT_SIZE = 40;
const SLOT_PAD  = 4;

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUDScene'); }

  create() {
    this._hearts      = [];
    this._hunger      = [];
    this._hotbarGfx   = this.add.graphics().setDepth(100).setScrollFactor(0);
    this._hotbarItems = [];
    this._oxyBar      = null;
    this._timeTxt     = null;
    this._lastDamageFlash = 0;
    this._lastSaveToast   = 0;

    this._buildHearts();
    this._buildHunger();
    this._buildHotbar();
    this._buildOxygen();
    this._buildTimeDisplay();
    this._buildBreakProgress();
    this._buildDamageFlash();
    this._buildSaveToast();
    this._buildTouchButtons();

    this.time.addEvent({ delay: 100, loop: true, callback: this._refresh, callbackScope: this });
  }

  // ─── Hearts ───────────────────────────────────────────────────────────────

  _buildHearts() {
    for (let i = 0; i < 10; i++) {
      const g = this.add.graphics().setDepth(101).setScrollFactor(0);
      this._hearts.push(g);
    }
  }

  // ─── Hunger ───────────────────────────────────────────────────────────────

  _buildHunger() {
    for (let i = 0; i < 10; i++) {
      const g = this.add.graphics().setDepth(101).setScrollFactor(0);
      this._hunger.push(g);
    }
  }

  // ─── Hotbar ───────────────────────────────────────────────────────────────

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

      // Key-number hint (1–9) in top-left corner of each slot
      const numTxt = this.add.text(x + 3, y + 2, String(i + 1), {
        fontSize: '8px', color: '#888888',
      }).setOrigin(0, 0).setDepth(102).setScrollFactor(0);

      this._hotbarItems.push({ gfx: itemGfx, txt, numTxt, x, y });
    }
  }

  // ─── Oxygen bar ───────────────────────────────────────────────────────────

  _buildOxygen() {
    this._oxyGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
    this._oxyGfx.setVisible(false);
  }

  // ─── Time display ─────────────────────────────────────────────────────────

  _buildTimeDisplay() {
    this._timeTxt = this.add.text(GAME_WIDTH / 2, 10, '12:00', {
      fontSize: '14px', color: '#ffffcc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
  }

  // ─── Break progress bar ───────────────────────────────────────────────────

  _buildBreakProgress() {
    const bW = 120, bH = 6;
    this._breakX = (GAME_WIDTH - bW) / 2;
    this._breakY = GAME_HEIGHT - SLOT_SIZE - 10 - 14;
    this._breakW = bW;
    this._breakH = bH;

    this._breakBg = this.add.graphics().setDepth(103).setScrollFactor(0).setVisible(false);
    this._breakBg.fillStyle(0x000000, 0.65);
    this._breakBg.fillRect(this._breakX - 1, this._breakY - 1, bW + 2, bH + 2);

    this._breakFill = this.add.graphics().setDepth(104).setScrollFactor(0).setVisible(false);
  }

  _refreshBreakProgress(progress) {
    if (progress > 0 && progress < 1) {
      this._breakBg.setVisible(true);
      this._breakFill.setVisible(true);
      this._breakFill.clear();
      this._breakFill.fillStyle(0xff8800, 1);
      this._breakFill.fillRect(this._breakX, this._breakY, Math.round(this._breakW * progress), this._breakH);
    } else {
      this._breakBg.setVisible(false);
      this._breakFill.setVisible(false);
    }
  }

  // ─── Damage flash ─────────────────────────────────────────────────────────

  _buildDamageFlash() {
    this._dmgFlash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff0000, 0
    ).setDepth(199).setScrollFactor(0);
  }

  _triggerDamageFlash() {
    this.tweens.killTweensOf(this._dmgFlash);
    this._dmgFlash.setAlpha(0.4);
    this.tweens.add({
      targets: this._dmgFlash, alpha: 0, duration: 600, ease: 'Power2',
    });
  }

  // ─── Save toast ───────────────────────────────────────────────────────────

  _buildSaveToast() {
    this._saveToast = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - SLOT_SIZE - 34, '✓ Saved', {
      fontSize: '13px', color: '#88ff88',
      stroke: '#000000', strokeThickness: 2,
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0).setAlpha(0);
  }

  // ─── Touch button overlays (mobile only) ──────────────────────────────────

  _buildTouchButtons() {
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const g = this.add.graphics().setDepth(99).setScrollFactor(0);

    const fillAlpha   = 0.10;
    const strokeAlpha = 0.28;
    const textAlpha   = 0.55;

    const drawBtn = (cx, cy, bw, bh, label) => {
      g.fillStyle(0xffffff, fillAlpha);
      g.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      g.lineStyle(1, 0xffffff, strokeAlpha);
      g.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      this.add.text(cx, cy, label, {
        fontSize: '13px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(99).setScrollFactor(0).setAlpha(textAlpha);
    };

    // Joystick zone indicator — left half, bottom 45%
    const joyX = W * 0.18, joyY = H * 0.80;
    g.lineStyle(1, 0xffffff, 0.18);
    g.strokeCircle(joyX, joyY, 55);
    g.lineStyle(1, 0xffffff, 0.10);
    g.strokeCircle(joyX, joyY, 20);
    this.add.text(joyX, joyY + 68, 'MOVE', {
      fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(99).setScrollFactor(0).setAlpha(0.25);

    // Jump: x > 75%, y 65%–82%
    drawBtn(W * 0.875, H * 0.735, 140, 56, '▲  JUMP');

    // Break: x > 75%, y > 82%
    drawBtn(W * 0.875, H * 0.905, 160, 52, '⛏  BREAK');

    // Inventory: x > 85%, y < 20%
    drawBtn(W * 0.922, H * 0.10, 100, 38, '⚙ INV');
  }

  // ─── Selected item name label ─────────────────────────────────────────────

  _buildSelectedItemName() {
    // built inline below hotbar — called lazily on first refresh
    const y = GAME_HEIGHT - SLOT_SIZE - 14;
    this._selectedNameTxt = this.add.text(GAME_WIDTH / 2, y, '', {
      fontSize: '12px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(102).setScrollFactor(0);
  }

  // ─── Refresh (100 ms tick) ────────────────────────────────────────────────

  _refresh() {
    const state = this.registry.get('hudState');
    if (!state) return;

    this._refreshHearts(state.hp, state.maxHp);
    this._refreshHunger(state.hunger, state.maxHunger);
    this._refreshHotbar(state.hotbar, state.hotbarIndex);
    this._refreshOxygen(state.oxygen, state.inWater);
    this._refreshBreakProgress(state.breakProgress ?? 0);

    this._timeTxt.setText(state.time);
    this._timeTxt.setColor(state.isNight ? '#aaccff' : '#ffffcc');

    // Damage flash
    const dmgTs = this.registry.get('damageFlash');
    if (dmgTs && dmgTs !== this._lastDamageFlash) {
      this._lastDamageFlash = dmgTs;
      this._triggerDamageFlash();
    }

    // Save toast
    const saveTs = this.registry.get('saveToast');
    if (saveTs && saveTs !== this._lastSaveToast) {
      this._lastSaveToast = saveTs;
      this.tweens.killTweensOf(this._saveToast);
      this._saveToast.setAlpha(1);
      this.tweens.add({
        targets: this._saveToast, alpha: 0, duration: 1200, delay: 1000, ease: 'Power2',
      });
    }
  }

  // ─── Heart / hunger / hotbar / oxygen refresh ─────────────────────────────

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

    // Selected item name above hotbar
    if (!this._selectedNameTxt) this._buildSelectedItemName();
    const sel = hotbar[hotbarIndex];
    this._selectedNameTxt.setText(sel?.def?.name ?? '');
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
