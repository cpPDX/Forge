import { Game } from './game/Game.js';
import { FirstSessionController } from './systems/FirstSessionController.js';
import { ForgeController } from './systems/ForgeController.js';
import { ResourceProgressionController } from './systems/ResourceProgressionController.js';
import { NightPressureController } from './systems/NightPressureController.js';

const canvas = document.getElementById('game-canvas');

try {
  const game = new Game(canvas);
  new FirstSessionController(game).init();
  new ForgeController(game).init();
  new ResourceProgressionController(game).init();
  new NightPressureController(game).init();
  game.start();
} catch (err) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#111;color:#ff5555;font:13px/1.5 monospace;padding:16px;overflow:auto;z-index:99999;white-space:pre-wrap;word-break:break-all';
  el.textContent = 'INIT ERROR\n' + err.message + '\n\n' + (err.stack || '');
  document.body.appendChild(el);
}
