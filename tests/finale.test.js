import test from 'node:test';
import assert from 'node:assert/strict';

import { FINALE_HOLD_SECONDS, FINALE_PEAK_NIGHT, FinaleSystem } from '../src/systems/FinaleSystem.js';

function context(overrides = {}) {
  return {
    hasIronForge: true,
    hasMasterForge: true,
    hasForgebrand: true,
    nightNumber: FINALE_PEAK_NIGHT,
    peakNightActive: true,
    ...overrides,
  };
}

function tick(system, dt, overrides = {}) {
  return system.update({
    dt,
    hasMasterForge: true,
    hasForgebrand: true,
    peakNightActive: true,
    ...overrides,
  });
}

test('finale objective stays hidden until Iron Forge progression is reached', () => {
  const finale = new FinaleSystem();
  assert.equal(finale.view(context({ hasIronForge: false, hasMasterForge: false, hasForgebrand: false })), null);

  const masterStep = finale.view(context({ hasMasterForge: false, hasForgebrand: false, nightNumber: 1, peakNightActive: false }));
  assert.equal(masterStep.stage, 'master-forge');
  assert.match(masterStep.detail, /Master Forge/i);
});

test('Master Forge exposes Forgebrand as the late-slice objective', () => {
  const finale = new FinaleSystem();
  const view = finale.view(context({ hasForgebrand: false, nightNumber: 2, peakNightActive: false }));
  assert.equal(view.stage, 'forgebrand');
  assert.match(view.title, /Forgebrand/i);
  assert.match(view.detail, /2 Refined Diamond/i);
});

test('Forgebrand alone cannot complete the slice before Peak Night', () => {
  const finale = new FinaleSystem();
  const view = finale.view(context({ nightNumber: 2, peakNightActive: false }));
  assert.equal(view.stage, 'peak-night');
  assert.match(view.detail, /Night 3/i);

  const result = tick(finale, FINALE_HOLD_SECONDS, { peakNightActive: false });
  assert.equal(result.completedNow, false);
  assert.equal(finale.holdSeconds, 0);
});

test('final stand requires both 60 seconds alive and a Forgebrand kill', () => {
  const finale = new FinaleSystem();

  let result = tick(finale, FINALE_HOLD_SECONDS);
  assert.equal(result.completedNow, false);
  assert.equal(finale.holdSeconds, FINALE_HOLD_SECONDS);
  assert.equal(finale.completed, false);

  assert.equal(finale.onForgebrandKill(context()), true);
  result = tick(finale, 0.016);
  assert.equal(result.completedNow, true);
  assert.equal(finale.completed, true);
});

test('a Forgebrand kill can happen before the timer and completion waits for the full hold', () => {
  const finale = new FinaleSystem();
  assert.equal(finale.onForgebrandKill(context()), true);
  assert.equal(finale.forgebrandKill, true);

  let result = tick(finale, 59.5);
  assert.equal(result.completedNow, false);
  assert.equal(finale.completed, false);

  result = tick(finale, 0.5);
  assert.equal(result.completedNow, true);
  assert.equal(finale.completed, true);
});

test('death resets an unfinished final stand but never erases a completed run', () => {
  const finale = new FinaleSystem();
  finale.onForgebrandKill(context());
  tick(finale, 31);

  assert.equal(finale.onDeath(), true);
  assert.equal(finale.holdSeconds, 0);
  assert.equal(finale.forgebrandKill, false);
  assert.equal(finale.completed, false);

  finale.onForgebrandKill(context());
  tick(finale, FINALE_HOLD_SECONDS);
  assert.equal(finale.completed, true);
  assert.equal(finale.onDeath(), false);
  assert.equal(finale.completed, true);
});

test('an unfinished Peak Night ending resets the attempt', () => {
  const finale = new FinaleSystem();
  finale.onForgebrandKill(context());
  tick(finale, 25);

  const result = tick(finale, 0, { peakNightActive: false });
  assert.equal(result.changed, true);
  assert.equal(finale.holdSeconds, 0);
  assert.equal(finale.forgebrandKill, false);
});

test('losing Master Forge or Forgebrand eligibility resets partial progress', () => {
  const finale = new FinaleSystem();
  finale.onForgebrandKill(context());
  tick(finale, 20);

  tick(finale, 0, { hasForgebrand: false });
  assert.equal(finale.holdSeconds, 0);
  assert.equal(finale.forgebrandKill, false);

  tick(finale, 10);
  tick(finale, 0, { hasMasterForge: false });
  assert.equal(finale.holdSeconds, 0);
});

test('partial final-stand progress round-trips through save/load', () => {
  const original = new FinaleSystem();
  original.onForgebrandKill(context());
  tick(original, 27.5);

  const restored = new FinaleSystem();
  assert.equal(restored.load(original.serialize()), true);
  assert.equal(restored.holdSeconds, 27.5);
  assert.equal(restored.forgebrandKill, true);
  assert.equal(restored.completed, false);

  const result = tick(restored, FINALE_HOLD_SECONDS - 27.5);
  assert.equal(result.completedNow, true);
});

test('completion persists and reload normalizes the completed achievement', () => {
  const original = new FinaleSystem();
  original.onForgebrandKill(context());
  tick(original, FINALE_HOLD_SECONDS);
  assert.equal(original.completed, true);

  const saved = original.serialize();
  const restored = new FinaleSystem();
  assert.equal(restored.load(saved), true);
  assert.equal(restored.completed, true);
  assert.equal(restored.holdSeconds, FINALE_HOLD_SECONDS);
  assert.equal(restored.forgebrandKill, true);
  assert.equal(restored.view(context()).stage, 'complete');
});

test('invalid persisted finale state is rejected without mutating defaults', () => {
  const finale = new FinaleSystem();
  assert.equal(finale.load({ completed: false, holdSeconds: -1, forgebrandKill: false, wasPeakNight: false }), false);
  assert.deepEqual(finale.serialize(), {
    completed: false,
    holdSeconds: 0,
    forgebrandKill: false,
    wasPeakNight: false,
  });

  assert.equal(finale.load({ completed: 'yes', holdSeconds: 0, forgebrandKill: false, wasPeakNight: false }), false);
  assert.equal(finale.completed, false);
});
