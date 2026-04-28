import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { ItemRegistry } from '../utils/ItemRegistry.js';

export class CraftingScene extends Phaser.Scene {
  constructor() { super('CraftingScene'); }

  create(data) {
    this._game    = data?.gameScene;
    this._station = data?.station ?? null;
    this._crafting = this._game ? new CraftingSystem(this._game.player.inv) : null;
    this._build();
  }

  _build() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(200).setScrollFactor(0);

    const panW = 420, panH = 440;
    const px = (W - panW) / 2, py = (H - panH) / 2;

    const bg = this.add.graphics().setDepth(201).setScrollFactor(0);
    bg.fillStyle(0x1a2230, 0.97); bg.fillRoundedRect(px, py, panW, panH, 8);
    bg.lineStyle(1, 0x6677aa, 0.8); bg.strokeRoundedRect(px, py, panW, panH, 8);

    const title = this._station ? 'Crafting Table' : 'Crafting';
    this.add.text(px + panW / 2, py + 12, title, {
      fontSize: '16px', color: '#ccccff', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(202).setScrollFactor(0);

    const closeZone = this.add.zone(px + panW - 18, py + 18, 28, 28).setInteractive({ useHandCursor: true }).setDepth(203);
    this.add.text(px + panW - 18, py + 18, '✕', { fontSize: '18px', color: '#ff5555' }).setOrigin(0.5).setDepth(203).setScrollFactor(0);
    closeZone.on('pointerdown', () => this._close());

    const recipes = this._crafting ? this._crafting.getAvailable(this._station) : [];
    const listY = py + 45;
    const maxVisible = 7;

    if (recipes.length === 0) {
      this.add.text(px + panW / 2, listY + 60, 'No recipes available', {
        fontSize: '14px', color: '#888888',
      }).setOrigin(0.5, 0).setDepth(202).setScrollFactor(0);
    }

    recipes.slice(0, maxVisible).forEach((recipe, idx) => {
      const ry = listY + idx * 52;
      this._drawRecipe(recipe, px + 10, ry, panW - 20, idx);
    });

    this.input.keyboard.on('keydown-ESC', () => this._close());
    this.input.keyboard.on('keydown-E',   () => this._close());
  }

  _drawRecipe(recipe, x, y, w, idx) {
    const gfx = this.add.graphics().setDepth(202).setScrollFactor(0);
    gfx.fillStyle(0x2a3445, 0.9); gfx.fillRoundedRect(x, y, w, 48, 4);

    const itemDef = ItemRegistry.get(recipe.result.itemId);
    const color   = itemDef?.color ?? 0xaaaaaa;
    gfx.fillStyle(color, 1); gfx.fillRect(x + 6, y + 8, 32, 32);

    this.add.text(x + 46, y + 8, itemDef?.name ?? recipe.result.itemId, {
      fontSize: '13px', color: '#ffffff',
    }).setDepth(203).setScrollFactor(0);

    const ingText = recipe.ingredients
      ? recipe.ingredients.map(i => `${i.count}x ${i.itemId}`).join(', ')
      : `${recipe.input} + ${recipe.fuel}`;
    this.add.text(x + 46, y + 26, ingText, {
      fontSize: '10px', color: '#aaaaaa',
    }).setDepth(203).setScrollFactor(0);

    // Craft button
    const btnX = x + w - 72, btnY = y + 10;
    const btn = this.add.graphics().setDepth(203).setScrollFactor(0);
    btn.fillStyle(0x448844, 1); btn.fillRoundedRect(btnX, btnY, 60, 28, 4);
    const btnLbl = this.add.text(btnX + 30, btnY + 14, 'CRAFT', {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(204).setScrollFactor(0);

    const zone = this.add.zone(btnX + 30, btnY + 14, 60, 28).setInteractive({ useHandCursor: true }).setDepth(205);
    zone.on('pointerover', () => btn.setAlpha(1.3));
    zone.on('pointerout',  () => btn.setAlpha(1));
    zone.on('pointerdown', () => {
      const ok = this._crafting?.craft(recipe.id);
      btn.clear();
      btn.fillStyle(ok ? 0x44cc44 : 0xcc4444, 1); btn.fillRoundedRect(btnX, btnY, 60, 28, 4);
      this.time.delayedCall(300, () => {
        this.scene.restart({ gameScene: this._game, station: this._station });
      });
    });
  }

  _close() { this.scene.stop(); }
}
