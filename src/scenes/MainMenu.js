import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { SaveManager } from '../systems/SaveManager.js';

export class MainMenu extends Phaser.Scene {
  constructor() { super('MainMenu'); }

  create() {
    this.save = new SaveManager();
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const hasSave = this.save.hasSave();

    this._buildBackground(W, H);

    this.add.text(W / 2, H * 0.22, 'FORGE', {
      fontSize: '72px', color: '#ff9900', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.33, 'Survival Adventure', {
      fontSize: '22px', color: '#cccccc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(W - 10, H - 10, 'v0.1.0 | FORGE', {
      fontSize: '11px', color: '#445566',
    }).setOrigin(1);

    const btnY = H * 0.55;
    const gap  = 58;

    if (hasSave) {
      this._btn('▶  Continue', W / 2, btnY - gap, 0x44aa44, () => this._startGame(false));
    }
    this._btn('⚒  New Game', W / 2, btnY + (hasSave ? 0 : -gap / 2), 0x4477cc, () => {
      this.save.deleteSave();
      this._startGame(true);
    });
    this._btn('⚙  Settings', W / 2, btnY + gap + (hasSave ? 0 : -gap / 2), 0x666666, () => {
      this.add.text(W / 2, H * 0.85, 'Settings coming soon!', {
        fontSize: '14px', color: '#888888',
      }).setOrigin(0.5);
    });

    this._buildGroundDecor(W, H);
  }

  _btn(text, x, y, color, cb) {
    const gfx = this.add.graphics();
    const bW = 220, bH = 44;
    gfx.fillStyle(color, 0.9);
    gfx.fillRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(x - bW / 2, y - bH / 2, bW, bH, 6);
    const lbl = this.add.text(x, y, text, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, bW, bH).setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => { gfx.setAlpha(1.2); lbl.setScale(1.04); });
    zone.on('pointerout',   () => { gfx.setAlpha(1);   lbl.setScale(1);    });
    zone.on('pointerdown',  cb);
    return { gfx, lbl };
  }

  _startGame(newGame) {
    const saveData = newGame ? null : this.save.load();
    const seed = saveData?.seed ?? Math.floor(Math.random() * 1e9);
    this.scene.start('Game', { seed, saveData, newGame });
    // HUDScene is launched from Game.create() — do NOT start it here
  }

  _buildBackground(W, H) {
    // fillGradientStyle is WebGL-only — use fillStyle + fillRect
    const sky = this.add.graphics();
    sky.fillStyle(0x0a1a3a, 1); sky.fillRect(0, 0, W, H * 0.5);
    sky.fillStyle(0x0e2a5a, 1); sky.fillRect(0, H * 0.5, W, H * 0.2);
    sky.fillStyle(0x1a3a10, 1); sky.fillRect(0, H * 0.7, W, H * 0.3);

    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * W, sy = Math.random() * H * 0.6;
      const r  = Math.random() > 0.8 ? 1.5 : 1;
      sky.fillStyle(0xffffff, 0.5 + Math.random() * 0.5);
      sky.fillCircle(sx, sy, r);
    }

    const mtn = this.add.graphics();
    mtn.fillStyle(0x1a3a1a, 1);
    const pts = [];
    for (let x = 0; x <= W; x += 16) {
      pts.push({ x, y: H * 0.7 - Math.sin(x / 80) * 40 - Math.sin(x / 30) * 20 });
    }
    pts.push({ x: W, y: H }); pts.push({ x: 0, y: H });
    mtn.fillPoints(pts, true);
  }

  _buildGroundDecor(W, H) {
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 16) {
      g.fillStyle(0x5d8a3c, 1); g.fillRect(x, H - 32, 16, 8);
      g.fillStyle(0x6b3a2a, 1); g.fillRect(x, H - 24, 16, 24);
    }
    for (let x = 20; x < W - 20; x += 40 + Math.floor(Math.random() * 30)) {
      g.fillStyle(0x2a7a1a, 1);
      g.fillRect(x - 1, H - 48, 4, 16);
      g.fillRect(x - 4, H - 48, 10, 8);
    }
  }
}
