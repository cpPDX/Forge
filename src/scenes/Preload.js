import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';

export class Preload extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a14);
    this.add.text(W / 2, H / 2 - 60, 'FORGE', {
      fontSize: '48px', color: '#ff9900', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.rectangle(W / 2, H / 2 + 40, 320, 12, 0x222233).setOrigin(0.5);
    const bar = this.add.rectangle(W / 2 - 160, H / 2 + 40, 0, 10, 0xff9900).setOrigin(0, 0.5);
    this.add.text(W / 2, H / 2 + 62, 'Generating world...', {
      fontSize: '13px', color: '#666688',
    }).setOrigin(0.5);
    this.load.on('progress', p => { bar.width = 320 * p; });
  }

  create() {
    this._generateTextures();
    this.time.delayedCall(300, () => this.scene.start('MainMenu'));
  }

  _generateTextures() {
    const c1 = document.createElement('canvas');
    c1.width = 4; c1.height = 4;
    c1.getContext('2d').fillStyle = '#ffffff';
    c1.getContext('2d').fillRect(0, 0, 4, 4);
    this.textures.addCanvas('particle', c1);

    const c2 = document.createElement('canvas');
    c2.width = 1; c2.height = 2;
    const ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#1a88ff'; ctx2.fillRect(0, 0, 1, 1);
    ctx2.fillStyle = '#88ccff'; ctx2.fillRect(0, 1, 1, 1);
    this.textures.addCanvas('sky_grad', c2);
  }
}
