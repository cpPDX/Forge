import * as THREE from 'three';
import { GRAVITY, B } from '../utils/constants.js';

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
    _arrowTimer: 0,
  };
}

export class MobSystem {
  constructor(scene, world, camera) {
    this._scene  = scene;
    this._world  = world;
    this._camera = camera;
    this._mobs   = [];
    this._arrows = [];
    this._spawnTimer = 0;
    this._maxMobs    = 15;

    // Zombie
    this._matSkin   = new THREE.MeshLambertMaterial({ color: 0x7aaa6a });
    this._matShirt  = new THREE.MeshLambertMaterial({ color: 0x2d6a44 });
    this._matPants  = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
    this._matEye    = new THREE.MeshLambertMaterial({ color: 0xff2200 });
    // Creeper
    this._matCreeper     = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
    this._matCreeperDark = new THREE.MeshLambertMaterial({ color: 0x111111 });
    // Skeleton
    this._matBone   = new THREE.MeshLambertMaterial({ color: 0xddddbb });
    this._matBoneDark = new THREE.MeshLambertMaterial({ color: 0x222200 });
    // Shared
    this._matFlash  = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this._matHpBg   = new THREE.MeshBasicMaterial({ color: 0x440000 });
    this._matHpFg   = new THREE.MeshBasicMaterial({ color: 0x00cc00 });
    this._matArrow  = new THREE.MeshLambertMaterial({ color: 0xc8a060 });
  }

  // ─── Mesh factories ────────────────────────────────────────────────────────

  _makeFaceTexture(drawFn) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    drawFn(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return new THREE.MeshLambertMaterial({ map: t });
  }

  _drawZombieFace(ctx) {
    ctx.fillStyle = '#7aaa6a'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#5a9a5a'; ctx.fillRect(0, 0, 16, 1);
    ctx.fillStyle = '#330000'; ctx.fillRect(2, 4, 4, 3); ctx.fillRect(10, 4, 4, 3);
    ctx.fillStyle = '#cc0000'; ctx.fillRect(3, 5, 2, 2); ctx.fillRect(11, 5, 2, 2);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4, 10, 8, 2);
    ctx.fillStyle = '#330000'; ctx.fillRect(5, 10, 2, 1); ctx.fillRect(9, 10, 2, 1);
  }

  _drawCreeperFace(ctx) {
    ctx.fillStyle = '#44aa44'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#111111';
    ctx.fillRect(2, 3, 4, 4); ctx.fillRect(10, 3, 4, 4);
    ctx.fillRect(6, 7, 4, 4);
    ctx.fillRect(4, 11, 2, 2); ctx.fillRect(6,  9, 2, 2);
    ctx.fillRect(8, 11, 2, 2); ctx.fillRect(10, 9, 2, 2);
    ctx.fillRect(4, 13, 8, 2);
  }

  _drawSkeletonFace(ctx) {
    ctx.fillStyle = '#ddddbb'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#111111'; ctx.fillRect(2, 4, 4, 4); ctx.fillRect(10, 4, 4, 4);
    ctx.fillStyle = '#333322'; ctx.fillRect(7, 7, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 12, 2, 2); ctx.fillRect(6, 12, 2, 2);
    ctx.fillRect(9, 12, 2, 2); ctx.fillRect(12, 12, 2, 2);
    ctx.fillStyle = '#eeeecc'; ctx.fillRect(0, 0, 1, 16); ctx.fillRect(0, 0, 16, 1);
  }

  _makeMesh() {
    const g = new THREE.Group();
    const part = (geo, mat, x, y, z, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      m._origMat = mat;
      g.add(m);
      return m;
    };
    const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.28);
    part(legGeo, this._matPants, -0.13, 0.375, 0);
    part(legGeo, this._matPants,  0.13, 0.375, 0);
    part(new THREE.BoxGeometry(0.5, 0.9, 0.3), this._matShirt, 0, 1.20, 0);
    // Head with pixel-art face texture on front (+Z) face
    const zFaceMat = this._makeFaceTexture(ctx => this._drawZombieFace(ctx));
    const zHeadMats = [this._matSkin, this._matSkin, this._matSkin, this._matSkin, zFaceMat, this._matSkin];
    const zHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), zHeadMats);
    zHead.position.set(0, 1.90, 0); zHead._origMat = zHeadMats; g.add(zHead);
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.06);
    part(eyeGeo, this._matEye, -0.12, 1.92, 0.26);
    part(eyeGeo, this._matEye,  0.12, 1.92, 0.26);
    const armGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    part(armGeo, this._matSkin, -0.37, 1.4, 0, -Math.PI / 2);
    part(armGeo, this._matSkin,  0.37, 1.4, 0, -Math.PI / 2);
    return g;
  }

  _makeCreeperMesh() {
    const g = new THREE.Group();
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m._origMat = mat;
      g.add(m);
      return m;
    };
    const C = this._matCreeper, D = this._matCreeperDark;
    // 4 short legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.45, 0.2);
    part(legGeo, C, -0.15, 0.225, -0.13);
    part(legGeo, C,  0.15, 0.225, -0.13);
    part(legGeo, C, -0.15, 0.225,  0.13);
    part(legGeo, C,  0.15, 0.225,  0.13);
    // Body (squat, wide)
    part(new THREE.BoxGeometry(0.5, 0.75, 0.5), C, 0, 0.825, 0);
    // Head with iconic pixel-art creeper face texture on front (+Z) face
    const cFaceMat = this._makeFaceTexture(ctx => this._drawCreeperFace(ctx));
    const cHeadMats = [C, C, C, C, cFaceMat, C];
    const cHead = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), cHeadMats);
    cHead.position.set(0, 1.475, 0); cHead._origMat = cHeadMats; g.add(cHead);
    return g;
  }

  _makeSkeletonMesh() {
    const g = new THREE.Group();
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m._origMat = mat;
      g.add(m);
      return m;
    };
    const B_ = this._matBone, D = this._matBoneDark;
    // Thin legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    part(legGeo, B_, -0.10, 0.375, 0);
    part(legGeo, B_,  0.10, 0.375, 0);
    // Narrow ribcage body
    part(new THREE.BoxGeometry(0.38, 0.85, 0.2), B_, 0, 1.175, 0);
    // Head with pixel-art skeleton face texture on front (+Z) face
    const sFaceMat = this._makeFaceTexture(ctx => this._drawSkeletonFace(ctx));
    const sHeadMats = [B_, B_, B_, B_, sFaceMat, B_];
    const sHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), sHeadMats);
    sHead.position.set(0, 1.825, 0); sHead._origMat = sHeadMats; g.add(sHead);
    // Arms (one angled forward to hold bow)
    const armGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);
    const bowArm = part(armGeo, B_, -0.31, 1.2, 0);
    bowArm.rotation.x = -Math.PI / 4; // angled forward
    part(armGeo, B_,  0.31, 1.2, 0);
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

  spawn(x, y, z, type = 'zombie') {
    if (this._mobs.length >= this._maxMobs) return null;
    const mob = makeMob(x, y, z, type);
    switch (type) {
      case 'creeper':  mob.mesh = this._makeCreeperMesh(); break;
      case 'skeleton': mob.mesh = this._makeSkeletonMesh(); break;
      default:         mob.mesh = this._makeMesh(); break;
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
    // Hitting a fusing creeper resets its fuse
    if (mob.type === 'creeper') { mob._fusing = false; mob._fuseTimer = 0; }
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

  // ─── Update ────────────────────────────────────────────────────────────────

  update(dt, player, isNight) {
    this._spawnTimer -= dt;
    if (isNight && this._spawnTimer <= 0 && this._mobs.length < this._maxMobs) {
      this._trySpawn(player);
      this._spawnTimer = 3.5;
    }
    for (const mob of this._mobs) {
      if (!mob.dead) this._updateMob(mob, dt, player, isNight);
    }
    this._updateArrows(dt, player);
    this._mobs = this._mobs.filter(m => !m.dead);
  }

  count() { return this._mobs.length; }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _trySpawn(player) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 14 + Math.random() * 14;
    const sx = player.x + Math.cos(angle) * dist;
    const sz = player.z + Math.sin(angle) * dist;
    const fx = Math.floor(sx), fz = Math.floor(sz);
    const r = Math.random();
    const type = r < 0.5 ? 'zombie' : r < 0.8 ? 'skeleton' : 'creeper';
    for (let y = 100; y > 1; y--) {
      if (this._world.isSolid(fx, y, fz) &&
          !this._world.isSolid(fx, y + 1, fz) &&
          !this._world.isSolid(fx, y + 2, fz)) {
        this.spawn(sx, y + 1, sz, type);
        return;
      }
    }
  }

  _updateMob(mob, dt, player, isNight) {
    switch (mob.type) {
      case 'creeper':  this._updateCreeper(mob, dt, player); break;
      case 'skeleton': this._updateSkeleton(mob, dt, player, isNight); break;
      default:         this._updateZombie(mob, dt, player, isNight); break;
    }
  }

  _updateZombie(mob, dt, player, isNight) {
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
    this._applySunburn(mob, dt, isNight);
    this._updateHpBar(mob);

    // Zombie: pure melee, fist attacks only, no ranged capability
    mob.attackTimer -= dt;
    const fullDist = Math.sqrt(dx*dx + (player.y - mob.y)**2 + dz*dz);
    if (fullDist < 1.2 && mob.attackTimer <= 0) {
      player._takeDamage(3);
      player.knockback(mob.x, mob.z);
      mob.attackTimer = 1.5;
    }
    if (mob.hp <= 0 || mob.y < -30) this._kill(mob);
  }

  _updateCreeper(mob, dt, player) {
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

    // Fuse logic — accelerating flash, then explode
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
        this._kill(mob);
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

  // Skeleton: ranged-only combat — bow and arrows, backs away from close range
  _updateSkeleton(mob, dt, player, isNight) {
    const dx = player.x - mob.x, dz = player.z - mob.z;
    const distH = Math.sqrt(dx*dx + dz*dz);
    const SPEED = 2.0, MIN_DIST = 6, MAX_DIST = 20;

    // Maintain ideal shooting distance
    if (distH < MIN_DIST) {
      const nx = dx / distH, nz = dz / distH;
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
    this._applySunburn(mob, dt, isNight);
    this._updateHpBar(mob);

    // Shoot arrows
    mob._arrowTimer -= dt;
    if (distH < MAX_DIST && mob._arrowTimer <= 0) {
      mob._arrowTimer = 2.5;
      this._shootArrow(mob, player);
    }
    if (mob.hp <= 0 || mob.y < -30) this._kill(mob);
  }

  // ─── Arrow projectiles ────────────────────────────────────────────────────

  _shootArrow(mob, player) {
    const eyeY = mob.y + MOB_H * 0.8;
    const tx = player.x - mob.x;
    const ty = (player.y + 0.9) - eyeY;
    const tz = player.z - mob.z;
    const dist = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;
    const speed = 14;

    const arrow = {
      x: mob.x, y: eyeY, z: mob.z,
      vx: (tx / dist) * speed,
      vy: (ty / dist) * speed,
      vz: (tz / dist) * speed,
      mesh: null, dead: false, life: 4,
    };

    const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4);
    arrow.mesh = new THREE.Mesh(geo, this._matArrow);
    arrow.mesh.position.set(arrow.x, arrow.y, arrow.z);
    this._scene.add(arrow.mesh);
    this._arrows.push(arrow);
  }

  _updateArrows(dt, player) {
    for (const arrow of this._arrows) {
      if (arrow.dead) continue;
      arrow.life -= dt;
      if (arrow.life <= 0) { this._killArrow(arrow); continue; }

      arrow.vy += GRAVITY * 0.45 * dt;
      const nx = arrow.x + arrow.vx * dt;
      const ny = arrow.y + arrow.vy * dt;
      const nz = arrow.z + arrow.vz * dt;

      if (this._world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
        this._killArrow(arrow); continue;
      }

      // Player hit check (AABB)
      const pdx = Math.abs(player.x - nx);
      const pdy = (player.y + 0.9) - ny;
      const pdz = Math.abs(player.z - nz);
      if (pdx < 0.4 && pdy > -0.2 && pdy < 1.8 && pdz < 0.4) {
        player._takeDamage(4);
        player.knockback(arrow.x, arrow.z);
        this._killArrow(arrow); continue;
      }

      arrow.x = nx; arrow.y = ny; arrow.z = nz;
      arrow.mesh.position.set(arrow.x, arrow.y, arrow.z);
      // Orient arrow along velocity
      arrow.mesh.rotation.z = -Math.atan2(arrow.vy, Math.sqrt(arrow.vx**2 + arrow.vz**2));
      arrow.mesh.rotation.y = Math.atan2(arrow.vx, arrow.vz);
    }
    this._arrows = this._arrows.filter(a => !a.dead);
  }

  _killArrow(arrow) {
    arrow.dead = true;
    this._scene.remove(arrow.mesh);
    arrow.mesh.geometry.dispose();
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

  _applySunburn(mob, dt, isNight) {
    if (!isNight && this._isInSunlight(mob)) {
      mob._sunBurnTimer += dt;
      if (mob._sunBurnTimer >= 1) {
        mob._sunBurnTimer = 0;
        mob.hp -= 1;
        if (mob.hp <= 0) { this._kill(mob); return; }
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

  _kill(mob) {
    mob.dead = true;
    this._scene.remove(mob.mesh);
    this._scene.remove(mob.hpBar);
    mob.mesh.traverse(c => { if (c.isMesh) c.geometry.dispose(); });
    mob.hpBar.children.forEach(c => c.geometry.dispose());
    mob.hpBar._fg.material.dispose();
  }

  dispose() {
    for (const mob of this._mobs) this._kill(mob);
    for (const arrow of this._arrows) this._killArrow(arrow);
    this._mobs = []; this._arrows = [];
    this._matSkin.dispose();   this._matShirt.dispose();  this._matPants.dispose();
    this._matEye.dispose();    this._matCreeper.dispose(); this._matCreeperDark.dispose();
    this._matBone.dispose();   this._matBoneDark.dispose();
    this._matFlash.dispose();  this._matHpBg.dispose();   this._matHpFg.dispose();
    this._matArrow.dispose();
  }
}
