import test from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS } from '../src/utils/constants.js';
import { drawItemSprite } from '../src/ui/ItemSprites.js';

function renderCalls(id, size = 16) {
  const calls = [];
  const ctx = {
    imageSmoothingEnabled: true,
    fillStyle: null,
    clearRect(x, y, w, h) {
      calls.push(['clear', x, y, w, h]);
    },
    fillRect(x, y, w, h) {
      calls.push(['fill', x, y, w, h, this.fillStyle]);
    },
  };

  drawItemSprite(ctx, id, size);
  return calls;
}

function signature(id) {
  return JSON.stringify(renderCalls(id));
}

function fillColors(id) {
  return new Set(renderCalls(id)
    .filter(call => call[0] === 'fill')
    .map(call => call[5]));
}

test('processed forge materials no longer use the generic fallback sprite', () => {
  const fallback = signature(250);
  const ids = [ITEMS.IRON_INGOT, ITEMS.GOLD_INGOT, ITEMS.REFINED_DIAMOND];

  for (const id of ids) {
    assert.notEqual(signature(id), fallback, `item ${id} should have a dedicated sprite`);
  }
});

test('processed forge material sprites remain pairwise distinguishable', () => {
  const signatures = [
    signature(ITEMS.IRON_INGOT),
    signature(ITEMS.GOLD_INGOT),
    signature(ITEMS.REFINED_DIAMOND),
  ];

  assert.equal(new Set(signatures).size, signatures.length);
});

test('Refined Diamond is rendered as a cut gem rather than the metal-ingot silhouette', () => {
  const diamond = renderCalls(ITEMS.REFINED_DIAMOND).filter(call => call[0] === 'fill');
  const iron = renderCalls(ITEMS.IRON_INGOT).filter(call => call[0] === 'fill');

  assert.notDeepEqual(diamond.map(call => call.slice(1, 5)), iron.map(call => call.slice(1, 5)));
  assert.ok(fillColors(ITEMS.REFINED_DIAMOND).has('#bdf8ff'));
  assert.ok(fillColors(ITEMS.REFINED_DIAMOND).has('#197e99'));
});

test('Forgebrand has a distinct ember-steel sprite and preserves the legacy ID alias', () => {
  assert.equal(ITEMS.FORGEBRAND, 103);
  assert.equal(ITEMS.DIAMOND_SWORD, ITEMS.FORGEBRAND);

  const forgebrand = signature(ITEMS.FORGEBRAND);
  assert.notEqual(forgebrand, signature(ITEMS.IRON_SWORD));
  assert.notEqual(forgebrand, signature(ITEMS.DIAMOND_PICKAXE));

  const colors = fillColors(ITEMS.FORGEBRAND);
  assert.ok(colors.has('#34383b'), 'Forgebrand should include dark forged steel');
  assert.ok(colors.has('#ff7a1a'), 'Forgebrand should include an ember accent');
  assert.ok(colors.has('#8f989e'), 'Forgebrand should retain a readable steel edge');
});

test('item sprites scale using the existing pixel-art coordinate contract', () => {
  const calls = renderCalls(ITEMS.IRON_INGOT, 32);
  assert.deepEqual(calls[0], ['clear', 0, 0, 32, 32]);
  assert.ok(calls.some(call => call[0] === 'fill' && call[3] >= 12), 'scaled ingot should expand its geometry');
});
