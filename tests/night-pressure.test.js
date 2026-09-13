import test from 'node:test';
import assert from 'node:assert/strict';

import { B } from '../src/utils/constants.js';
import { MobSystem } from '../src/systems/MobSystem.js';
import { NightPressureSystem, pressureProfileForNight } from '../src/systems/NightPressureSystem.js';

function update(system, overrides = {}) {
  return system.update({
    isNight: false,
    hostilesAllowed: true,
    dayFrac: 0.5,
    ...overrides,
  });
}

test('Night 1 starts as a deliberately limited baseline threat', () => {
  const system = new NightPressureSystem();
  const state = update(system, { isNight: true, dayFrac: 0.8 });

  assert.equal(state.startedNight, true);
  assert.equal(state.nightNumber, 1);
  assert.equal(state.profile.maxMobs, 5);
  assert.equal(state.profile.spawnInterval, 7);
  assert.equal(state.profile.typeWeights.creeper, 0);
  assert.equal(system.activeNight, true);
});

test('tutorial grace does not consume or increment a hostile night', () => {
  const system = new NightPressureSystem();
  const protectedNight = update(system, {
    isNight: true,
    hostilesAllowed: false,
    dayFrac: 0.8,
  });

  assert.equal(protectedNight.startedNight, false);
  assert.equal(system.nightNumber, 0);
  assert.equal(system.activeNight, false);

  update(system, { isNight: false, hostilesAllowed: true, dayFrac: 0.5 });
  const realNight = update(system, { isNight: true, hostilesAllowed: true, dayFrac: 0.8 });
  assert.equal(realNight.nightNumber, 1);
});

test('sunset warning identifies the next hostile night before darkness', () => {
  const system = new NightPressureSystem();

  assert.equal(system.view({ isNight: false, hostilesAllowed: true, dayFrac: 0.67 }), null);
  const warning = system.view({ isNight: false, hostilesAllowed: true, dayFrac: 0.70 });
  assert.equal(warning.title, 'Night 1 approaches');
  assert.match(warning.detail, /shelter/i);
  assert.equal(system.view({ isNight: false, hostilesAllowed: false, dayFrac: 0.70 }), null);
});

test('later nights escalate in controlled steps and pressure caps at Night 3', () => {
  const system = new NightPressureSystem();

  update(system, { isNight: true, dayFrac: 0.8 });
  const night1 = system.profile;
  update(system, { isNight: false, dayFrac: 0.5 });
  update(system, { isNight: true, dayFrac: 0.8 });
  const night2 = system.profile;
  update(system, { isNight: false, dayFrac: 0.5 });
  update(system, { isNight: true, dayFrac: 0.8 });
  const night3 = system.profile;
  update(system, { isNight: false, dayFrac: 0.5 });
  update(system, { isNight: true, dayFrac: 0.8 });
  const night4 = system.profile;

  assert.ok(night2.maxMobs > night1.maxMobs);
  assert.ok(night2.spawnInterval < night1.spawnInterval);
  assert.ok(night2.typeWeights.creeper > night1.typeWeights.creeper);
  assert.ok(night3.maxMobs > night2.maxMobs);
  assert.deepEqual(
    { ...night4, nightNumber: 3 },
    night3,
    'Night 4 should report a new night number while retaining the capped Night 3 pressure profile',
  );
  assert.equal(system.nightNumber, 4);
});

test('night progression round-trips mid-night without double incrementing after reload', () => {
  const original = new NightPressureSystem();
  update(original, { isNight: true, dayFrac: 0.8 });
  update(original, { isNight: false, dayFrac: 0.5 });
  update(original, { isNight: true, dayFrac: 0.8 });

  const restored = new NightPressureSystem();
  assert.equal(restored.load(original.serialize()), true);
  assert.equal(restored.nightNumber, 2);
  assert.equal(restored.activeNight, true);

  const sameNight = update(restored, { isNight: true, dayFrac: 0.9 });
  assert.equal(sameNight.startedNight, false);
  assert.equal(restored.nightNumber, 2);

  update(restored, { isNight: false, dayFrac: 0.5 });
  update(restored, { isNight: true, dayFrac: 0.8 });
  assert.equal(restored.nightNumber, 3);
});

test('invalid persisted night state is rejected without mutating defaults', () => {
  const system = new NightPressureSystem();
  assert.equal(system.load({ nightNumber: -1, activeNight: true }), false);
  assert.deepEqual(system.serialize(), { nightNumber: 0, activeNight: false });
  assert.equal(system.load({ nightNumber: 2, activeNight: 'yes' }), false);
  assert.deepEqual(system.serialize(), { nightNumber: 0, activeNight: false });
});

test('pressure profiles are isolated copies and cannot mutate the model', () => {
  const profile = pressureProfileForNight(2);
  profile.typeWeights.zombie = 1;
  const fresh = pressureProfileForNight(2);
  assert.equal(fresh.typeWeights.zombie, 0.55);
});

test('MobSystem accepts pressure configuration and normalizes type weights', () => {
  const world = { getBlock() { return B.AIR; } };
  const mobs = new MobSystem({ add() {}, remove() {} }, world, { position: { x: 0, y: 0, z: 0 } });

  mobs.configurePressure({
    maxMobs: 9,
    spawnInterval: 4.8,
    spawnMinDist: 11,
    spawnMaxDist: 24,
    lightSafeRadius: 8,
    typeWeights: { zombie: 5.5, skeleton: 3.5, creeper: 1 },
  });

  const config = mobs.pressureConfig();
  assert.equal(config.maxMobs, 9);
  assert.equal(config.spawnInterval, 4.8);
  assert.equal(config.spawnMinDist, 11);
  assert.equal(config.spawnMaxDist, 24);
  assert.equal(config.lightSafeRadius, 8);
  assert.ok(Math.abs(config.typeWeights.zombie - 0.55) < 0.000001);
  assert.ok(Math.abs(config.typeWeights.skeleton - 0.35) < 0.000001);
  assert.ok(Math.abs(config.typeWeights.creeper - 0.10) < 0.000001);
  mobs.dispose();
});

test('placed torches and glowstone suppress nearby spawn candidates', () => {
  const lit = new Set([
    '3,11,4',
    '-4,10,0',
  ]);
  const world = {
    getBlock(x, y, z) {
      const key = `${x},${y},${z}`;
      if (key === '3,11,4') return B.TORCH;
      if (key === '-4,10,0') return B.GLOWSTONE;
      return B.AIR;
    },
  };
  const mobs = new MobSystem({ add() {}, remove() {} }, world, { position: { x: 0, y: 0, z: 0 } });
  mobs.configurePressure({ lightSafeRadius: 8 });

  assert.equal(mobs._isSpawnProtectedByLight(0, 10, 0), true);
  assert.equal(mobs._isSpawnProtectedByLight(20, 10, 20), false);
  assert.ok(lit.size > 0);
  mobs.dispose();
});
