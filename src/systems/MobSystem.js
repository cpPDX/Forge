import * as THREE from 'three';
import { GRAVITY, B } from '../utils/constants.js';
import { ENEMY_TYPES, rollEnemyDrop } from './EnemyIdentity.js';

const HALF_W = 0.3;
const MOB_H  = 1.8;
let _nextId  = 1;

function makeMob(x, y, z, type) {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0,
    hp: 20, maxHp: 20,
    onGround: false,
    attackTimer: 0,
    hitFlash: 0,
    mesh: null, hpBar: null,
    dead: false,
    id: _nextId++,
    type,
    _sunBurnTimer: 0,
    _fuseTimer: 0,
    _fusing: false,
    _shotTimer: 0,
  };
}

export class MobSystem {
  constructor(scene, world, camera) {
    this._scene  = scene;
    this._world  = world;
    this._camera = camera;
    this._mobs   = [];
    this._projectiles = [];
    this._spawnTimer = 0;
    this._maxMobs = 15;
    this._spawnInterval = 3.5;
    this._spawnMinDist = 14;
    this._spawnMaxDist = 28;
    this._typeWeights = {
      [ENEMY_TYPES.ASHBOUND]: 0.5,
      [ENEMY_TYPES.SHARDCASTER]: 0.3,
      [ENEMY_TYPES.SLAGBURST]: 0.2,
    };
    this._lightSafeRadius = 0;
    this.onDropItem = null;

    // Ashbound — charred humanoid with visible ember fractures.
    this._matAsh       = new THREE.MeshLambertMaterial({ color: 0x2a2523 });
    this._matAshCloth  = new THREE.MeshLambertMaterial({ color: 0x513326 });
    this._matAshDark   = new THREE.MeshLambertMaterial({ color: 0x171413 });
    this._matEmber     = new THREE.MeshLambertMaterial({ color: 0xff6b22, emissive: 0x7a2200 });

    // Shardcaster — faceted mineral body with a cold luminous core.
    this._matShard     = new THREE.MeshLambertMaterial({ color: 0x647985 });
    this._matShardDark = new THREE.MeshLambertMaterial({ color: 0x26343c });
    this._matShardCore = new THREE.MeshLambertMaterial({ color: 0x8dd6df, emissive: 0x1a4f58 });

    // Slagburst — squat volcanic mass with a hot unstable core.
    this._matSlag      = new THREE.MeshLambertMaterial({ color: 0x3a312e });
    this._matSlagDark  = new THREE.MeshLambertMaterial({ color: 0x1c1918 });
    this._matSlagHot   = new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: 0x8a2b00 });

    // Shared combat presentation.
    this._matFlash      = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this._matHpBg       = new THREE.MeshBasicMaterial({ color: 0x440000 });
    this._matHpFg       = new THREE.MeshBasicMaterial({ color: 0x00cc00 });
    this._matProjectile = new THREE.MeshLambertMaterial({ color: 0x9adce4, emissive: 0x163d44 });
  }

  // ─── Mesh factories ────────────────────────────────────────────────────────

  _part(group, geometry, material, x, y, z, { rx = 0, ry = 0, rz = 0 } = {}) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh._origMat = material;
    group.add(mesh);
    return mesh;
  }

  _makeAshboundMesh() {
    const g = new THREE.Group();
    const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.25);
    this._part(g, legGeo, this._matAshDark, -0.13, 0.36, 0);
    this._part(g, legGeo, this._matAshDark,  0.13, 0.36, 0);
    this._part(g, new THREE.BoxGeometry(0.52, 0.84, 0.30), this._matAshCloth, 0, 1.13, 0);

    // Uneven coal-like shoulders break the familiar block-humanoid silhouette.
    this._part(g, new THREE.DodecahedronGeometry(0.19, 0), this._matAsh, -0.35, 1.42, 0);
    this._part(g, new THREE.DodecahedronGeometry(0.14, 0), this._matAsh,  0.36, 1.36, 0.02);

    const head = this._part(g, new THREE.DodecahedronGeometry(0.32, 0), this._matAsh, 0, 1.82, 0);
    head.scale.set(0.95, 1.05, 0.9);
    const eyeGeo = new THREE.BoxGeometry(0.09, 0.055, 0.045);
    this._part(g, eyeGeo, this._matEmber, -0.11, 1.86, 0.27);
    this._part(g, eyeGeo, this._matEmber,  0.11, 1.86, 0.27);
    this._part(g, new THREE.BoxGeometry(0.04, 0.42, 0.025), this._matEmber, -0.13, 1.18, 0.17, { rz: -0.2 });

    const armGeo = new THREE.BoxGeometry(0.20, 0.65, 0.20);
    this._part(g, armGeo, this._matAsh, -0.38, 1.18, 0, { rx: -0.5 });
    this._part(g, armGeo, this._matAsh,  0.38, 1.18, 0, { rx: -0.5 });
    return g;
  }

  _makeShardcasterMesh() {
    const g = new THREE.Group();
    const legGeo = new THREE.ConeGeometry(0.11, 0.72, 4);
    this._part(g, legGeo, this._matShardDark, -0.13, 0.36, 0, { ry: Math.PI / 4 });
    this._part(g, legGeo, this._matShardDark,  0.13, 0.36, 0, { ry: Math.PI / 4 });

    const torso = this._part(g, new THREE.OctahedronGeometry(0.43, 0), this._matShard, 0, 1.10, 0);
    torso.scale.set(0.85, 1.15, 0.62);
    this._part(g, new THREE.OctahedronGeometry(0.18, 0), this._matShardCore, 0, 1.12, 0.31);

    const head = this._part(g, new THREE.OctahedronGeometry(0.27, 0), this._matShardDark, 0, 1.78, 0);
    head.scale.set(0.8, 1.1, 0.8);
    this._part(g, new THREE.OctahedronGeometry(0.07, 0), this._matShardCore, 0, 1.80, 0.25);

    // Long crystalline arms signal the ranged role without a bow/skeleton motif.
    const armGeo = new THREE.ConeGeometry(0.10, 0.72, 4);
    this._part(g, armGeo, this._matShard, -0.37, 1.15, 0.04, { rz: 0.22 });
    this._part(g, armGeo, this._matShard,  0.37, 1.15, 0.04, { rz: -0.22 });
    return g;
  }

  _makeSlagburstMesh() {
    const g = new THREE.Group();
    const footGeo = new THREE.DodecahedronGeometry(0.17, 0);
    for (const [x, z] of [[-0.25,-0.20],[0.25,-0.20],[-0.25,0.20],[0.25,0.20]]) {
      this._part(g, footGeo, this._matSlagDark, x, 0.20, z);
    }

    const body = this._part(g, new THREE.DodecahedronGeometry(0.52, 0), this._matSlag, 0, 0.82, 0);
    body.scale.set(1.05, 1.15, 1.0);
    this._part(g, new THREE.OctahedronGeometry(0.20, 0), this._matSlagHot, 0, 0.88, 0.45);
    this._part(g, new THREE.BoxGeometry(0.035, 0.52, 0.03), this._matSlagHot, -0.17, 0.86, 0.45, { rz: 0.45 });
    this._part(g, new THREE.BoxGeometry(0.035, 0.40, 0.03), this._matSlagHot, 0.19, 0.74, 0.43, { rz: -0.55 });

    const crown = this._part(g, new THREE.ConeGeometry(0.24, 0.36, 5), this._matSlagDark, 0, 1.40, 0);
    crown.rotation.y = 0.3;
    return g;
  }

  _makeHpBar() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.02), this._matHpBg);
    const fg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.02), this._matHpFg.clone());
    fg.position.z = 0.01;
    g.add(bg); g.add(fg);
    g._fg = fg;
    g.visible = false;
    return g;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  configurePressure(config = {}) {
    if (Number.isInteger(config.maxMobs) && config.maxMobs > 0) this._maxMobs = config.maxMobs;
    if (Number.isFinite(config.spawnInterval) && config.spawnInterval > 0) this._spawnInterval = config.spawnInterval;
    if (Number.isFinite(config.spawnMinDist) && config.spawnMinDist > 0) this._spawnMinDist = config.spawnMinDist;
    if (Number.isFinite(config.spawnMaxDist) && config.spawnMaxDist >= this._spawnMinDist) this._spawnMaxDist = config.spawnMaxDist;
    if (Number.isFinite(config.lightSafeRadius) && config.lightSafeRadius >= 0) this._lightSafeRadius = Math.floor(config.lightSafeRadius);

    if (config.typeWeights && typeof config.typeWeights === 'object') {
      const ashbound = Math.max(0, Number(config.typeWeights[ENEMY_TYPES.ASHBOUND]) || 0);
      const shardcaster = Math.max(0, Number(config.typeWeights[ENEMY_TYPES.SHARDCASTER]) || 0);
      const slagburst = Math.max(0, Number(config.typeWeights[ENEMY_TYPES.SLAGBURST]) || 0);
      const total = ashbound + shardcaster + slagburst;
      if (total > 0) {
        this._typeWeights = {
          [ENEMY_TYPES.ASHBOUND]: ashbound / total,
          [ENEMY_TYPES.SHARDCASTER]: shardcaster / total,
          [ENEMY_TYPES.SLAGBURST]: slagburst / total,
        };
      }
    }
  }

  pressureConfig() {
    return {
      maxMobs: this._maxMobs,
      spawnInterval: this._spawnInterval,
      spawnMinDist: this._spawnMinDist,
      spawnMaxDist: this._spawnMaxDist,
      typeWeights: { ...this._typeWeights },
      lightSafeRadius: this._lightSafeRadius,
    };
  }

  spawn(x, y, z, type = ENEMY_TYPES.ASHBOUND) {
    if (this._mobs.length >= this._maxMobs) return null;
    const mob = makeMob(x, y, z, type);
    switch (type) {
      case ENEMY_TYPES.SLAGBURST:   mob.mesh = this._makeSlagburstMesh(); break;
      case ENEMY_TYPES.SHARDCASTER: mob.mesh = this._makeShardcasterMesh(); break;
      default:                      mob.mesh = this._makeAshboundMesh(); break;
    }
    mob.hpBar = this._makeHpBar();
    mob.mesh.position.set(x, y, z);
    this._scene.add(mob.mesh);
    this._scene.add(mob.hpBar);
    this._mobs.push(mob);
    return mob;
  }

  hit(mobId, damage, ax, az) {
    const mob = this._mobs.find(m => m.id === mobId && !m.dead);
    if (!mob) return false;
    mob.hp -= damage;
    mob.hitFlash = 0.25;
    const kx = mob.x - ax, kz = mob.z - az;
    const kl = Math.sqrt(kx * kx + kz * kz) || 1;
    mob.vx += (kx / kl) * 7;
    mob.vy  = 4;
    mob.vz += (kz / kl) * 7;
    if (mob.type === ENEMY_TYPES.SLAGBURST) { mob._fusing = false; mob._fuseTimer = 0; }
    if (mob.hp <= 0) this._kill(mob);
    return true;
  }

  findTarget(px, py, pz, yaw, pitch, range) {
    const dx = -Math.sin(yaw) * Math.cos(pitch);
    const dy =  Math.sin(pitch);
    const dz = -Math.cos(yaw) * Math.cos(pitch);
    const ey = py + 1.62;
    let best = null, bestDist = range;
    for (const mob of this._mobs) {
      if (mob.dead) continue;
      const mx = mob.x - px, my = (mob.y + MOB_H * 0.5) - ey, mz = mob.z - pz;
      const d = Math.sqrt(mx*mx + my*my + mz*mz);
      if (d > range) continue;
      const dot = (mx*dx + my*dy + mz*dz) / d;
      if (dot > 0.55 && d < bestDist) { best = mob; bestDist = d; }
    }
    return best;
  }

  update(dt, player, isNight) {
    this._spawnTimer -= dt;
    if (isNight && this._spawnTimer <= 0 && this._mobs.length < this._maxMobs) {
      this._trySpawn(player);
      this._spawnTimer = this._spawnInterval;
    }
    for (const mob of this._mobs) {
      if (!mob.dead) this._updateMob(mob, dt, player, isNight);
    }
    this._updateProjectiles(dt, player);
    this._mobs = this._mobs.filter(m => !m.dead);
  }

  count() { return this._mobs.length; }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _pickSpawnType() {
    const r = Math.random();
    const ashboundEnd = this._typeWeights[ENEMY_TYPES.ASHBOUND];
    const shardcasterEnd = ashboundEnd + this._typeWeights[ENEMY_TYPES.SHARDCASTER];
    if (r < ashboundEnd) return ENEMY_TYPES.ASHBOUND;
    if (r < shardcasterEnd) return ENEMY_TYPES.SHARDCASTER;
    return ENEMY_TYPES.SLAGBURST;
  }

  _isSpawnProtectedByLight(x, y, z) {
    const radius = this._lightSafeRadius;
    if (radius <= 0) return false;

    const minY = Math.max(1, Math.floor(y) - 4);
    const maxY = Math.min(127, Math.floor(y) + 4);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        for (let by = minY; by <= maxY; by++) {
          const id = this._world.getBlock(x + dx, by, z + dz);
          if (id === B.TORCH || id === B.GLOWSTONE) return true;
        }
      }
    }
    return false;
  }

  _trySpawn(player) {
    const angle = Math.random() * Math.PI * 2;
    const span = Math.max(0, this._spawnMaxDist - this._spawnMinDist);
    const dist = this._spawnMinDist + Math.random() * span;
    const sx = player.x + Math.cos(angle) * dist;
    const sz = player.z + Math.sin(angle) * dist;
    const fx = Math.floor(sx), fz = Math.floor(sz);
    const type = this._pickSpawnType();

    for (let y = 100; y > 1; y--) {
      if (this._world.isSolid(fx, y, fz) &&
          !this._world.isSolid(fx, y + 1, fz) &&
          !this._world.isSolid(fx, y + 2, fz)) {
        const spawnY = y + 1;
        if (this._isSpawnProtectedByLight(fx, spawnY, fz)) return;
        this.spawn(sx, spawnY, sz, type);
        return;
      }
    }
  }

  _updateMob(mob, dt, player, isNight) {
    switch (mob.type) {
      case ENEMY_TYPES.SLAGBURST:   this._updateSlagburst(mob, dt, player); break;
      case ENEMY_TYPES.SHARDCASTER: this._updateShardcaster(mob, dt, player, isNight); break;
      default:                      this._updateAshbound(mob, dt, player, isNight); break;
    }
  }

  _updateAshbound(mob, dt, player, isNight) {
    const dx = player.x - mob.x, dz = player.z - mob.z;
    const distH = Math.sqrt(dx*dx + dz*dz);
    const AGGRO = 22, SPEED = 2.2;

    if (distH > 0.5 && distH < AGGRO) {
      const nx = dx / distH, nz = dz / distH;
      mob.vx = nx * SPEED; mob.vz = nz * SPEED;
      mob.mesh.rotation.y = Math.atan2(-dx, -dz);
      if (mob.onGround) {
        const fX = Math.floor(mob.x + nx * 0.7), fZ = Math.floor(mob.z + nz * 0.7);
        const fY = Math.floor(mob.y + 0.1);
        if (this._world.isSolid(fX, fY, fZ) || this._world.isSolid(fX, fY+1, fZ)) {
          mob.vy = 7.5; mob.onGround = false;
        }
      }
    } else if (distH <= 0.5) {
      mob.vx = 0; mob.vz = 0;
    } else {
      mob.vx *= 0.85; mob.vz *= 0.85;
    }

    if (!mob.onGround) mob.vy += GRAVITY * dt;
    this._collide(mob, dt);
    this._applyHitFlash(mob, dt);
    this._applyDaylightDecay(mob, dt, isNight);
    if (mob.dead) return;
    this._updateHpBar(mob);

    mob.attackTimer -= dt;
    const fullDist = Math.sqrt(dx*dx + (player.y - mob.y)**2 + dz*dz);
    if (fullDist < 1.2 && mob.attackTimer <= 0) {
      player._takeDamage(3);
      player.knockback(mob.x, mob.z);
      mob.attackTimer = 1.5;
    }
    if (mob.hp <= 0 || mob.y < -30) this._kill(mob);
  }

  _updateSlagburst(mob, dt, player) {
    const dx = player.x - mob.x, dz = player.z - mob.z;
    const distH = Math.sqrt(dx*dx + dz*dz);
    const AGGRO = 20, SPEED = 2.5, FUSE_DIST = 2.8;

    if (distH > FUSE_DIST && distH < AGGRO) {
      const nx = dx / distH, nz = dz / distH;
      mob.vx = nx * SPEED; mob.vz = nz * SPEED;
      mob.mesh.rotation.y = Math.atan2(-dx, -dz);
      if (mob.onGround) {
        const fX = Math.floor(mob.x + nx * 0.7), fZ = Math.floor(mob.z + nz * 0.7);
        const fY = Math.floor(mob.y + 0.1);
        if (this._world.isSolid(fX, fY, fZ) || this._world.isSolid(fX, fY+1, fZ)) {
          mob.vy = 7.5; mob.onGround = false;
        }
      }
    } else if (distH > AGGRO) {
      mob.vx *= 0.85; mob.vz *= 0.85;
    } else {
      mob.vx = 0; mob.vz = 0;
    }

    if (!mob.onGround) mob.vy += GRAVITY * dt;
    this._collide(mob, dt);

    if (distH < FUSE_DIST) {
      mob._fusing = true;
      mob._fuseTimer += dt;
      const flashRate = 8 + mob._fuseTimer * 12;
      const flash = Math.sin(mob._fuseTimer * flashRate) > 0;
      mob.mesh.traverse(c => {
        if (c.isMesh) c.material = flash ? this._matFlash : c._origMat;
      });
      if (mob._fuseTimer >= 1.5) {
        this._explode(mob, player);
        this._kill(mob, { drop: false });
        return;
      }
    } else if (mob._fusing) {
      mob._fusing = false; mob._fuseTimer = 0;
      mob.mesh.traverse(c => { if (c.isMesh) c.material = c._origMat; });
    } else {
      this._applyHitFlash(mob, dt);
    }

    this._updateHpBar(mob);
    if (mob.hp <= 0 || mob.y < -30) this._kill(mob);
  }

  _updateShardcaster(mob, dt, player, isNight) {
    const dx = player.x - mob.x, dz = player.z - mob.z;
    const distH = Math.sqrt(dx*dx + dz*dz);
    const SPEED = 2.0, MIN_DIST = 6, MAX_DIST = 20;

    if (distH < MIN_DIST) {
      const nx = dx / (distH || 1), nz = dz / (distH || 1);
      mob.vx = -nx * SPEED; mob.vz = -nz * SPEED;
    } else if (distH > MAX_DIST) {
      const nx = dx / distH, nz = dz / distH;
      mob.vx = nx * SPEED; mob.vz = nz * SPEED;
    } else {
      mob.vx *= 0.8; mob.vz *= 0.8;
    }
    if (distH > 0.5) mob.mesh.rotation.y = Math.atan2(-dx, -dz);

    if (!mob.onGround) mob.vy += GRAVITY * dt;
    this._collide(mob, dt);
    this._applyHitFlash(mob, dt);
    this._applyDaylightDecay(mob, dt, isNight);
    if (mob.dead) return;
    this._updateHpBar(mob);

    mob._shotTimer -= dt;
    if (distH < MAX_DIST && mob._shotTimer <= 0) {
      mob._shotTimer = 2.5;
      this._shootShard(mob, player);
    }
    if (mob.hp <= 0 || mob.y < -30) this._kill(mob);
  }

  // ─── Shard projectiles ────────────────────────────────────────────────────

  _shootShard(mob, player) {
    const originY = mob.y + MOB_H * 0.72;
    const tx = player.x - mob.x;
    const ty = (player.y + 0.9) - originY;
    const tz = player.z - mob.z;
    const dist = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;
    const speed = 14;

    const projectile = {
      x: mob.x, y: originY, z: mob.z,
      vx: (tx / dist) * speed,
      vy: (ty / dist) * speed,
      vz: (tz / dist) * speed,
      mesh: null, dead: false, life: 4,
    };

    projectile.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), this._matProjectile);
    projectile.mesh.scale.set(0.8, 0.8, 1.8);
    projectile.mesh.position.set(projectile.x, projectile.y, projectile.z);
    this._scene.add(projectile.mesh);
    this._projectiles.push(projectile);
  }

  _updateProjectiles(dt, player) {
    for (const projectile of this._projectiles) {
      if (projectile.dead) continue;
      projectile.life -= dt;
      if (projectile.life <= 0) { this._killProjectile(projectile); continue; }

      projectile.vy += GRAVITY * 0.45 * dt;
      const nx = projectile.x + projectile.vx * dt;
      const ny = projectile.y + projectile.vy * dt;
      const nz = projectile.z + projectile.vz * dt;

      if (this._world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        this._killProjectile(projectile); continue;
      }

      const pdx = Math.abs(player.x - nx);
      const pdy = (player.y + 0.9) - ny;
      const pdz = Math.abs(player.z - nz);
      if (pdx < 0.4 && pdy > -0.2 && pdy < 1.8 && pdz < 0.4) {
        player._takeDamage(4);
        player.knockback(projectile.x, projectile.z);
        this._killProjectile(projectile); continue;
      }

      projectile.x = nx; projectile.y = ny; projectile.z = nz;
      projectile.mesh.position.set(projectile.x, projectile.y, projectile.z);
      projectile.mesh.rotation.x += dt * 7;
      projectile.mesh.rotation.y += dt * 10;
    }
    this._projectiles = this._projectiles.filter(p => !p.dead);
  }

  _killProjectile(projectile) {
    projectile.dead = true;
    this._scene.remove(projectile.mesh);
    projectile.mesh.geometry.dispose();
  }

  // ─── Explosion ────────────────────────────────────────────────────────────

  _explode(mob, player) {
    const radius = 3.5;
    const cx = Math.round(mob.x), cy = Math.round(mob.y + 0.9), cz = Math.round(mob.z);
    const r = Math.ceil(radius);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx*dx + dy*dy + dz*dz <= radius*radius) {
            const id = this._world.getBlock(cx+dx, cy+dy, cz+dz);
            if (id !== B.BEDROCK) this._world.setBlock(cx+dx, cy+dy, cz+dz, B.AIR);
          }
        }
      }
    }
    const pdx = player.x - mob.x, pdy = player.y - mob.y, pdz = player.z - mob.z;
    const dist = Math.sqrt(pdx*pdx + pdy*pdy + pdz*pdz);
    if (dist < radius + 2) {
      const dmg = Math.floor(10 * Math.max(0, 1 - dist / (radius + 2)));
      if (dmg > 0) { player._takeDamage(dmg); player.knockback(mob.x, mob.z); }
    }
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  _applyHitFlash(mob, dt) {
    if (mob.hitFlash <= 0) return;
    mob.hitFlash -= dt;
    const flash = mob.hitFlash > 0;
    mob.mesh.traverse(c => {
      if (c.isMesh) c.material = flash ? this._matFlash : c._origMat;
    });
  }

  _applyDaylightDecay(mob, dt, isNight) {
    if (!isNight && this._isInSunlight(mob)) {
      mob._sunBurnTimer += dt;
      if (mob._sunBurnTimer >= 1) {
        mob._sunBurnTimer = 0;
        mob.hp -= 1;
        if (mob.hp <= 0) this._kill(mob);
      }
    } else {
      mob._sunBurnTimer = 0;
    }
  }

  _updateHpBar(mob) {
    mob.mesh.position.set(mob.x, mob.y, mob.z);
    const frac = Math.max(0, mob.hp / mob.maxHp);
    mob.hpBar.position.set(mob.x, mob.y + MOB_H + 0.3, mob.z);
    mob.hpBar.lookAt(this._camera.position);
    mob.hpBar._fg.scale.x = frac;
    mob.hpBar._fg.position.x = (frac - 1) * 0.3;
    mob.hpBar.visible = mob.hp < mob.maxHp;
  }

  _isInSunlight(mob) {
    const bx = Math.floor(mob.x), bz = Math.floor(mob.z);
    for (let dy = 1; dy <= 8; dy++) {
      if (this._world.isSolid(bx, Math.floor(mob.y + MOB_H) + dy, bz)) return false;
    }
    return true;
  }

  _collide(mob, dt) {
    const w = HALF_W, h = MOB_H;
    const check = (x, y, z) => {
      for (let bx = Math.floor(x - w); bx <= Math.floor(x + w); bx++)
        for (let by = Math.floor(y); by <= Math.floor(y + h - 0.001); by++)
          for (let bz = Math.floor(z - w); bz <= Math.floor(z + w); bz++)
            if (this._world.isSolid(bx, by, bz)) return true;
      return false;
    };
    let nx = mob.x + mob.vx * dt;
    let ny = mob.y + mob.vy * dt;
    let nz = mob.z + mob.vz * dt;
    if (check(nx, mob.y, mob.z)) { nx = mob.x; mob.vx = 0; }
    if (check(nx, mob.y, nz))    { nz = mob.z; mob.vz = 0; }
    mob.onGround = false;
    if (check(nx, ny, nz)) {
      if (mob.vy < 0) mob.onGround = true;
      ny = mob.y; mob.vy = 0;
    }
    mob.x = nx; mob.y = ny; mob.z = nz;
  }

  _kill(mob, { drop = true } = {}) {
    if (!mob || mob.dead) return;
    mob.dead = true;

    if (drop && this.onDropItem) {
      const loot = rollEnemyDrop(mob.type);
      if (loot) this.onDropItem(mob.x, mob.y + 0.55, mob.z, loot.id, loot.count);
    }

    this._scene.remove(mob.mesh);
    this._scene.remove(mob.hpBar);
    mob.mesh.traverse(c => { if (c.isMesh) c.geometry?.dispose?.(); });
    mob.hpBar.children.forEach(c => c.geometry?.dispose?.());
    mob.hpBar._fg.material.dispose();
  }

  dispose() {
    for (const mob of this._mobs) this._kill(mob, { drop: false });
    for (const projectile of this._projectiles) this._killProjectile(projectile);
    this._mobs = []; this._projectiles = [];
    this._matAsh.dispose();       this._matAshCloth.dispose(); this._matAshDark.dispose();
    this._matEmber.dispose();     this._matShard.dispose();    this._matShardDark.dispose();
    this._matShardCore.dispose(); this._matSlag.dispose();     this._matSlagDark.dispose();
    this._matSlagHot.dispose();   this._matFlash.dispose();    this._matHpBg.dispose();
    this._matHpFg.dispose();      this._matProjectile.dispose();
  }
}
