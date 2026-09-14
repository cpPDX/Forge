import test from 'node:test';
import assert from 'node:assert/strict';

import { Inventory } from '../src/systems/Inventory.js';
import { FirstSessionGuide } from '../src/systems/FirstSessionGuide.js';

function forgeGoalGuide() {
  const guide = new FirstSessionGuide();
  assert.equal(guide.load({
    step: 'prepare',
    moved: true,
    looked: true,
    jumped: true,
    placedBlocks: 1,
    hostilesUnlocked: true,
    waitingForDawn: false,
  }), true);
  return guide;
}

test('Stone Forge goal teaches the desktop interaction control explicitly', () => {
  const view = forgeGoalGuide().view(false, new Inventory());
  assert.match(view.hint, /aim at it/i);
  assert.match(view.hint, /right click/i);
});

test('Stone Forge goal teaches the touch interaction control explicitly', () => {
  const view = forgeGoalGuide().view(true, new Inventory());
  assert.match(view.hint, /aim at it/i);
  assert.match(view.hint, /tap Place/i);
});
