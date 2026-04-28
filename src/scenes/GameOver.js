import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { SaveManager } from '../systems/SaveManager.js';

export class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const save = new SaveManager();

    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0);
    this.tweens.add({ targets: bg, fillAlpha: 0.85, duration: 800 });

    const title = this.add.text(W / 2, H * 0.35, 'YOU DIED', {
      fontSize: '64px', color: '#ff2222', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1000, delay: 400 });

    const sub = this.add.text(W / 2, H * 0.5, 'Your items were scattered at the death site.', {
      fontSize: '16px', color: '#888888',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 800, delay: 800 });

    this.time.delayedCall(1400, () => {
      this._btn(W / 2, H * 0.64, 'Respawn', 0x44aa44, () => {
        save.deleteSave();
        this.scene.start('Game', { newGame: true });
        // HUDScene is launched from Game.create() — do NOT start it here
      });
      this._btn(W / 2, H * 0.64 + 60, 'Main Menu', 0x4477cc, () => {
        save.deleteSave();
        this.scene.start('MainMenu');
      });
    });
  }

  _btn(x, y, label, color, cb) {
    const bW = 200, bH = 44;
    const gfx = this.add.graphics().setAlpha(0);
    gfx.fillStyle(color, 0.85);
    gfx.fillRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    this.tweens.add({ targets: gfx, alpha: 1, duration: 400 });
    const lbl = this.add.text(x, y, label, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: lbl, alpha: 1, duration: 400 });
    const zone = this.add.zone(x, y, bW, bH).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { gfx.setAlpha(1.2); lbl.setScale(1.04); });
    zone.on('pointerout',  () => { gfx.setAlpha(1);   lbl.setScale(1);    });
    zone.on('pointerdown', cb);
  }
}
