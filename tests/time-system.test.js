import test from 'node:test';
import assert from 'node:assert/strict';

import { DAY_MS } from '../src/utils/constants.js';
import { TimeSystem } from '../src/systems/TimeSystem.js';

test('loading time immediately restores the saved day/night phase', () => {
  const time = new TimeSystem();

  time.load({ elapsed: DAY_MS * 0.9 });
  assert.ok(Math.abs(time.dayFrac - 0.9) < 0.000001);
  assert.equal(time.isDay, false);

  time.load({ elapsed: DAY_MS * 1.5 });
  assert.ok(Math.abs(time.dayFrac - 0.5) < 0.000001);
  assert.equal(time.isDay, true);
});
