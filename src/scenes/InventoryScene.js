import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SIZE, INV_ROWS, INV_COLS } from '../utils/constants.js';

const SLOT = 36;
const PAD  = 4;

export class InventoryScene extends Phaser.Scene {
  constructor() { super('InventoryScene'); }

  create(data) {
    this._game = data?.gameScene;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const inv = this._game?._inv;

    // Dim overlay — tap outside panel to close
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setDepth(200).setScrollFactor(0).setInteractive();
    bg.on('pointerdown', () => this._close());

    const panW = (SLOT + PAD) * INV_COLS + PAD;
    const panH = (SLOT + PAD) * (INV_ROWS + 2) + 80;
    const px = (W - panW) / 2, py = (H - panH) / 2;

    // Panel background (intercepts clicks so they don't fall through to dim bg)
    const panBg = this.add.graphics().setDepth(201).setScrollFactor(0);
    panBg.fillStyle(0x222233, 0.95); panBg.fillRoundedRect(px, py, panW, panH, 8);
    panBg.lineStyle(1, 0x6677aa, 0.8); panBg.strokeRoundedRect(px, py, panW, panH, 8);
    const panZone = this.add.zone(px + panW / 2, py + panH / 2, panW, panH)
      .setDepth(201).setInteractive();
    panZone.on('pointerdown', (p) => { p.stopPropagation(); });

    // Title
    this.add.text(px + panW / 2, py + 10, 'INVENTORY', {
      fontSize: '16px', color: '#ccccff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202).setScrollFactor(0);

    // Close button — 44×44 touch-friendly zone in top-right corner
    const closeX = px + panW - 22, closeY = py + 22;
    this.add.text(closeX, closeY, '✕', {
      fontSize: '20px', color: '#ff5555',
    }).setOrigin(0.5).setDepth(203).setScrollFactor(0);
    const closeZone = this.add.zone(closeX, closeY, 44, 44)
      .setDepth(204).setInteractive({ useHandCursor: true });
    closeZone.on('pointerdown', () => this._close());

    // Main inventory slots
    const mainLabelY = py + 40;
    this.add.text(px + PAD, mainLabelY, 'Backpack', {
      fontSize: '10px', color: '#8888aa',
    }).setOrigin(0, 0).setDepth(202).setScrollFactor(0);

    const mainStartY = mainLabelY + 14;
    if (inv) {
      for (let row = 0; row < INV_ROWS; row++) {
        for (let col = 0; col < INV_COLS; col++) {
          const sx = px + PAD + col * (SLOT + PAD);
          const sy = mainStartY + row * (SLOT + PAD);
          this._drawSlot(sx, sy, inv.getMainItem(row * INV_COLS + col), 202);
        }
      }

      // Hotbar section
      const hotbarLabelY = mainStartY + INV_ROWS * (SLOT + PAD) + 8;
      this.add.text(px + PAD, hotbarLabelY, 'Hotbar  (keys 1–9)', {
        fontSize: '10px', color: '#8888aa',
      }).setOrigin(0, 0).setDepth(202).setScrollFactor(0);

      const hotbarY = hotbarLabelY + 14;
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const sx = px + PAD + i * (SLOT + PAD);
        this._drawSlot(sx, hotbarY, inv.getHotbarItem(i), 202, i === inv.hotbarIndex);
      }
    }

    // Bottom close button — big and red, easy to hit on mobile
    const btnY = py + panH - 22;
    const btnW = panW - PAD * 2;
    const btnGfx = this.add.graphics().setDepth(202).setScrollFactor(0);
    btnGfx.fillStyle(0xaa2222, 1);
    btnGfx.fillRoundedRect(px + PAD, btnY - 16, btnW, 32, 6);
    this.add.text(px + PAD + btnW / 2, btnY, '✕  CLOSE', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(203).setScrollFactor(0);
    const btnZone = this.add.zone(px + PAD + btnW / 2, btnY, btnW, 44)
      .setDepth(204).setInteractive({ useHandCursor: true });
    btnZone.on('pointerdown', () => this._close());

    // ESC / E to close
    this.input.keyboard.on('keydown-ESC', () => this._close());
    this.input.keyboard.on('keydown-E',   () => this._close());
  }

  _drawSlot(x, y, slot, depth, selected = false) {
    const gfx = this.add.graphics().setDepth(depth).setScrollFactor(0);
    gfx.fillStyle(0x111122, 0.8); gfx.fillRect(x, y, SLOT, SLOT);
    gfx.lineStyle(1, selected ? 0xffffff : 0x445566, 1);
    gfx.strokeRect(x, y, SLOT, SLOT);

    if (slot) {
      const color = slot.def?.color ?? 0xaaaaaa;
      gfx.fillStyle(color, 1);
      gfx.fillRect(x + 5, y + 5, SLOT - 10, SLOT - 10);
      if (slot.count > 1) {
        this.add.text(x + SLOT - 3, y + SLOT - 3, String(slot.count), {
          fontSize: '9px', color: '#ffffff',
        }).setOrigin(1).setDepth(depth + 1).setScrollFactor(0);
      }
      // Item name — tiny label inside the slot
      const name = slot.def?.name ?? '';
      if (name) {
        this.add.text(x + SLOT / 2, y + SLOT - 5, name.slice(0, 5), {
          fontSize: '7px', color: '#cccccc',
        }).setOrigin(0.5, 1).setDepth(depth + 1).setScrollFactor(0);
      }
    }
  }

  _close() {
    this.scene.stop();
  }
}
