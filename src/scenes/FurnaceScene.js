import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { ItemRegistry } from '../utils/ItemRegistry.js';

export class FurnaceScene extends Phaser.Scene {
  constructor() { super('FurnaceScene'); }

  create(data) {
    this._game    = data?.gameScene;
    this._crafting = this._game ? new CraftingSystem(this._game.player.inv) : null;
    this._build();
  }

  _build() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(200).setScrollFactor(0);

    const panW = 380, panH = 380;
    const px = (W - panW) / 2, py = (H - panH) / 2;

    const bg = this.add.graphics().setDepth(201).setScrollFactor(0);
    bg.fillStyle(0x1a1a22, 0.97); bg.fillRoundedRect(px, py, panW, panH, 8);
    bg.lineStyle(1, 0x6677aa, 0.8); bg.strokeRoundedRect(px, py, panW, panH, 8);

    this.add.text(px + panW / 2, py + 12, 'Furnace', {
      fontSize: '16px', color: '#ffaa44', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202).setScrollFactor(0);

    const closeZone = this.add.zone(px + panW - 18, py + 18, 28, 28).setInteractive({ useHandCursor: true }).setDepth(203);
    this.add.text(px + panW - 18, py + 18, '✕', { fontSize: '18px', color: '#ff5555' }).setOrigin(0.5).setDepth(203).setScrollFactor(0);
    closeZone.on('pointerdown', () => this._close());

    const recipes = this._crafting ? this._crafting.getAvailable('furnace') : [];
    const listY = py + 48;

    if (recipes.length === 0) {
      this.add.text(px + panW / 2, listY + 40, 'Nothing to smelt\n(need input + coal)', {
        fontSize: '13px', color: '#888888', align: 'center',
      }).setOrigin(0.5, 0).setDepth(202).setScrollFactor(0);
    }

    recipes.slice(0, 5).forEach((recipe, idx) => {
      const ry = listY + idx * 56;
      this._drawRecipe(recipe, px + 10, ry, panW - 20);
    });

    this.input.keyboard.on('keydown-ESC', () => this._close());
    this.input.keyboard.on('keydown-E',   () => this._close());
  }

  _drawRecipe(recipe, x, y, w) {
    const gfx = this.add.graphics().setDepth(202).setScrollFactor(0);
    gfx.fillStyle(0x2a2235, 0.9); gfx.fillRoundedRect(x, y, w, 50, 4);
    gfx.fillStyle(0xff8800, 0.3); gfx.fillRect(x + 2, y + 2, 8, 46);

    const inDef  = ItemRegistry.get(recipe.input);
    const outDef = ItemRegistry.get(recipe.result.itemId);

    gfx.fillStyle(inDef?.color ?? 0xaaaaaa, 1);  gfx.fillRect(x + 16, y + 9, 32, 32);
    this.add.text(x + 54, y + 10, '→', { fontSize: '22px', color: '#ff8800' }).setDepth(203).setScrollFactor(0);
    gfx.fillStyle(outDef?.color ?? 0xaaaaaa, 1); gfx.fillRect(x + 72, y + 9, 32, 32);

    this.add.text(x + 114, y + 8,  inDef?.name  ?? recipe.input,          { fontSize: '12px', color: '#ffffff' }).setDepth(203).setScrollFactor(0);
    this.add.text(x + 114, y + 24, '+ 1 coal → ' + (outDef?.name ?? '?'), { fontSize: '11px', color: '#aaaaaa' }).setDepth(203).setScrollFactor(0);

    const btnX = x + w - 72, btnY = y + 11;
    const btn = this.add.graphics().setDepth(203).setScrollFactor(0);
    btn.fillStyle(0xcc6600, 1); btn.fillRoundedRect(btnX, btnY, 60, 28, 4);
    this.add.text(btnX + 30, btnY + 14, 'SMELT', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(204).setScrollFactor(0);

    const zone = this.add.zone(btnX + 30, btnY + 14, 60, 28).setInteractive({ useHandCursor: true }).setDepth(205);
    zone.on('pointerover', () => btn.setAlpha(1.3));
    zone.on('pointerout',  () => btn.setAlpha(1));
    zone.on('pointerdown', () => {
      this._crafting?.craft(recipe.id);
      this.scene.restart({ gameScene: this._game });
    });
  }

  _close() { this.scene.stop(); }
}
