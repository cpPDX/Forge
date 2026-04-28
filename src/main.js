import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/constants.js';
import { Boot }           from './scenes/Boot.js';
import { Preload }        from './scenes/Preload.js';
import { MainMenu }       from './scenes/MainMenu.js';
import { Game }           from './scenes/Game.js';
import { HUDScene }       from './scenes/HUDScene.js';
import { InventoryScene } from './scenes/InventoryScene.js';
import { CraftingScene }  from './scenes/CraftingScene.js';
import { FurnaceScene }   from './scenes/FurnaceScene.js';
import { GameOver }       from './scenes/GameOver.js';

const config = {
  type: Phaser.CANVAS,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true,
  antialias: false,

  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:      GAME_WIDTH,
    height:     GAME_HEIGHT,
  },

  audio: {
    noAudio: true,
  },

  input: {
    activePointers: 4,
  },

  scene: [Boot, Preload, MainMenu, Game, HUDScene, InventoryScene, CraftingScene, FurnaceScene, GameOver],
};

document.addEventListener('contextmenu', e => e.preventDefault());

try {
  new Phaser.Game(config);
} catch (err) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#111;color:#ff5555;font:13px/1.5 monospace;padding:16px;overflow:auto;z-index:99999;white-space:pre-wrap;word-break:break-all';
  el.textContent = 'PHASER INIT ERROR\n' + err.message + '\n\n' + (err.stack || '');
  document.body.appendChild(el);
}
