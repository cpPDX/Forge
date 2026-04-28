import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { this._buildLoadingBar(); }

  create() { this.scene.start('Preload'); }

  _buildLoadingBar() {
    const W = this.scale.width, H = this.scale.height;
    const barW = 300, barH = 20;
    const bx = (W - barW) / 2;
    this.add.rectangle(W / 2, H / 2 - 40, 300, 4, 0x333333);
    const bar = this.add.rectangle(bx, H / 2 - 40, 0, barH, 0x44aaff).setOrigin(0, 0.5);
    this.load.on('progress', (p) => { bar.width = barW * p; });
  }
}
