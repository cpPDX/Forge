import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { B } from '../src/utils/constants.js';
import { ENEMY_TYPES } from '../src/systems/EnemyIdentity.js';
import { MOB_DESPAWN_DISTANCE, MobSystem } from '../src/systems/MobSystem.js';

function makeScene() {
  return {
    added: [],
    removed: [],
    add(object) { this.added.push(object); },
    remove(object) { this.removed.push(object); },
  };
}

function makeCamera() {
  return { position: new THREE.Vector3(0, 72, 0) };
}

function makeOpenWorld(overrides = {}) {
  return {
    isSolid() { return false; },
    getBlock() { return B.AIR; },
    setBlock() {},
    ...overrides,
  };
}

function makePlayer(overrides = {}) {
  return {
    x: 0,
    y: 70,
    z: 0,
    damageTaken: 0,
    _takeDamage(amount) { this.damageTaken += amount; },
    knockback() {},
    ...overrides,
  };
}

test('distant mobs despawn without loot and immediately free local spawn capacity', () => {
  const scene = makeScene();
  const mobs = new MobSystem(scene, makeOpenWorld(), makeCamera());
  mobs.configurePressure({ maxMobs: 1, spawnInterval: 999 });

  let drops = 0;
  mobs.onDropItem = () => { drops++; };
  const far = mobs.spawn(MOB_DESPAWN_DISTANCE + 1, 70, 0, ENEMY_TYPES.ASHBOUND);
  assert.ok(far);
  assert.equal(mobs.spawn(1, 70, 0, ENEMY_TYPES.ASHBOUND), null, 'cap should be full before despawn');

  mobs.update(0.016, makePlayer(), false);

  assert.equal(mobs.count(), 0);
  assert.equal(drops, 0, 'distance cleanup must not generate farmable loot');
  assert.ok(mobs.spawn(1, 70, 0, ENEMY_TYPES.ASHBOUND), 'freed cap should admit a new local mob');
  mobs.dispose();
});

test('spawn search selects the highest valid surface above the old Y=100 ceiling', () => {
  const mobs = new MobSystem(makeScene(), makeOpenWorld({
    isSolid(_x, y) {
      return y === 120 || y === 80;
    },
  }), makeCamera());

  let captured = null;
  mobs.spawn = (x, y, z, type) => {
    captured = { x, y, z, type };
    return captured;
  };

  mobs._trySpawn(makePlayer({ x: 0, z: 0 }));

  assert.ok(captured, 'expected a valid surface spawn');
  assert.equal(captured.y, 121, 'high surface should win over the lower cave/shelf');
  mobs.dispose();
});

test('daylight exposure checks all the way to the world ceiling', () => {
  const covered = new MobSystem(makeScene(), makeOpenWorld({
    isSolid(_x, y) { return y === 50; },
  }), makeCamera());
  const mob = { x: 0, y: 10, z: 0 };

  assert.equal(covered._isInSunlight(mob), false, 'a roof far above the mob must still block daylight');
  covered.dispose();

  const open = new MobSystem(makeScene(), makeOpenWorld(), makeCamera());
  assert.equal(open._isInSunlight(mob), true);
  open.dispose();
});

test('zero-distance Shardcaster overlap never produces non-finite velocity', () => {
  const mobs = new MobSystem(makeScene(), makeOpenWorld(), makeCamera());
  const mob = mobs.spawn(0, 70, 0, ENEMY_TYPES.SHARDCASTER);
  const player = makePlayer({ x: 0, y: 70, z: 0 });

  mobs._updateShardcaster(mob, 0.016, player, true);

  assert.equal(Number.isFinite(mob.vx), true);
  assert.equal(Number.isFinite(mob.vy), true);
  assert.equal(Number.isFinite(mob.vz), true);
  mobs.dispose();
});

test('mob cleanup is idempotent and disposes each reused geometry once', () => {
  const scene = makeScene();
  const mobs = new MobSystem(scene, makeOpenWorld(), makeCamera());
  const mob = mobs.spawn(0, 70, 0, ENEMY_TYPES.ASHBOUND);

  const geometries = new Set();
  mob.mesh.traverse(child => {
    if (child.isMesh && child.geometry) geometries.add(child.geometry);
  });
  mob.hpBar.children.forEach(child => {
    if (child.geometry) geometries.add(child.geometry);
  });

  const disposeCounts = new Map();
  for (const geometry of geometries) {
    geometry.dispose = () => disposeCounts.set(geometry, (disposeCounts.get(geometry) ?? 0) + 1);
  }

  mobs._kill(mob, { drop: false });
  mobs._kill(mob, { drop: false });

  assert.equal(scene.removed.length, 2, 'mesh and HP bar should each be removed once');
  for (const geometry of geometries) {
    assert.equal(disposeCounts.get(geometry), 1, 'each unique geometry should be disposed exactly once');
  }
  mobs.dispose();
});

function makeProjectile() {
  return {
    x: 0,
    y: 10,
    z: 0,
    vx: 20,
    vy: 0,
    vz: 0,
    life: 4,
    dead: false,
    mesh: new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial(),
    ),
  };
}

test('projectile sweep catches a block crossed between frame endpoints', () => {
  const mobs = new MobSystem(makeScene(), makeOpenWorld({
    isSolid(x) { return x === 1; },
  }), makeCamera());
  mobs._projectiles.push(makeProjectile());

  mobs._updateProjectiles(0.1, makePlayer({ x: 100, y: 10, z: 0 }));

  assert.equal(mobs._projectiles.length, 0, 'projectile should be removed at the crossed block');
  mobs.dispose();
});

test('projectile sweep catches the player crossed between frame endpoints', () => {
  const mobs = new MobSystem(makeScene(), makeOpenWorld(), makeCamera());
  mobs._projectiles.push(makeProjectile());
  const player = makePlayer({ x: 1, y: 9.1, z: 0 });

  mobs._updateProjectiles(0.1, player);

  assert.equal(player.damageTaken, 4);
  assert.equal(mobs._projectiles.length, 0);
  mobs.dispose();
});
