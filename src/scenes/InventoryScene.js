import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HOTBAR_SIZE, INV_ROWS, INV_COLS } from '../utils/constants.js';

const SLOT = 36;
const PAD  = 4;

export class InventoryScene extends Phaser.Scene {
  constructor() { super('InventoryScene'); }

  create(data) {
    this._game = data?.gameScene;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const inv = this._game?.player?.inv;

    // Dim overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(200).setScrollFactor(0);

    const panW = (SLOT + PAD) * INV_COLS + PAD;
    const panH = (SLOT + PAD) * (INV_ROWS + 2) + 60;
    const px = (W - panW) / 2, py = (H - panH) / 2;

    const bg = this.add.graphics().setDepth(201).setScrollFactor(0);
    bg.fillStyle(0x222233, 0.95); bg.fillRoundedRect(px, py, panW, panH, 8);
    bg.lineStyle(1, 0x6677aa, 0.8); bg.strokeRoundedRect(px, py, panW, panH, 8);

    this.add.text(px + panW / 2, py + 10, 'Inventory', {
      fontSize: '16px', color: '#ccccff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202).setScrollFactor(0);

    // Close button
    const closeZone = this.add.zone(px + panW - 20, py + 16, 28, 28).setInteractive({ useHandCursor: true }).setDepth(202);
    this.add.text(px + panW - 20, py + 16, '✕', { fontSize: '18px', color: '#ff5555' }).setOrigin(0.5).setDepth(202).setScrollFactor(0);
    closeZone.on('pointerdown', () => this._close());

    // Draw main inventory slots
    const mainStartY = py + 40;
    if (inv) {
      for (let row = 0; row < INV_ROWS; row++) {
        for (let col = 0; col < INV_COLS; col++) {
          const sx = px + PAD + col * (SLOT + PAD);
          const sy = mainStartY + row * (SLOT + PAD);
          this._drawSlot(sx, sy, inv.getMainItem(row * INV_COLS + col), 202);
        }
      }

      // Hotbar
      const hotbarY = mainStartY + INV_ROWS * (SLOT + PAD) + PAD + 10;
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const sx = px + PAD + i * (SLOT + PAD);
        this._drawSlot(sx, hotbarY, inv.getHotbarItem(i), 202, i === inv.hotbarIndex);
      }
    }

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
      gfx.fillRect(x + 6, y + 6, SLOT - 12, SLOT - 12);
      if (slot.count > 1) {
        this.add.text(x + SLOT - 3, y + SLOT - 3, String(slot.count), {
          fontSize: '9px', color: '#ffffff',
        }).setOrigin(1).setDepth(depth + 1).setScrollFactor(0);
      }
    }
  }

  _close() {
    this.scene.stop();
  }
}
