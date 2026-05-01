import * as THREE from 'three';
import { GRAVITY } from '../utils/constants.js';

const HALF_W  = 0.3;
const MOB_H   = 1.8;
let   _nextId = 1;

class Zombie {
  constructor(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.hp = 20; this.maxHp = 20;
    this.onGround    = false;
    this.attackTimer   = 0;
    this.hitFlash      = 0;
    this.mesh          = null;
    this.hpBar         = null;
    this.dead          = false;
    this.id            = _nextId++;
    this._sunBurnTimer = 0;
  }
}

export class MobSystem {
  constructor(scene, world, camera) {
    this._scene  = scene;
    this._world  = world;
    this._camera = camera;
    this._mobs   = [];
    this._spawnTimer = 0;
    this._maxMobs    = 15;

    // Shared materials — cloned per-mob only when flashing
    this._matSkin  = new THREE.MeshLambertMaterial({ color: 0x7aaa6a }); // zombie flesh
    this._matShirt = new THREE.MeshLambertMaterial({ color: 0x2d6a44 }); // torn shirt
    this._matPants = new THREE.MeshLambertMaterial({ color: 0x1a2a3a }); // pants
    this._matEye   = new THREE.MeshLambertMaterial({ color: 0xff2200 });
    this._matFlash = new THREE.MeshLambertMaterial({ color: 0xff4444 });
    this._matHpBg  = new THREE.MeshBasicMaterial({ color: 0x440000 });
    this._matHpFg  = new THREE.MeshBasicMaterial({ color: 0x00cc00 });
  }

  // ─── Mesh factory ──────────────────────────────────────────────────────────

  _makeMesh() {
    const g = new THREE.Group();

    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m._origMat = mat;
      g.add(m);
      return m;
    };

    // Legs (pants color)
    const legGeo = new THREE.BoxGeometry(0.24, 0.75, 0.28);
    part(legGeo, this._matPants, -0.13, 0.375, 0);
    part(legGeo, this._matPants,  0.13, 0.375, 0);
    // Body (shirt color)
    part(new THREE.BoxGeometry(0.5, 0.9, 0.3), this._matShirt, 0, 1.20, 0);
    // Head (skin color)
    part(new THREE.BoxGeometry(0.5, 0.5, 0.5), this._matSkin, 0, 1.90, 0);
    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.06);
    part(eyeGeo, this._matEye, -0.12, 1.92, 0.26);
    part(eyeGeo, this._matEye,  0.12, 1.92, 0.26);
    // Arms outstretched forward (skin color, rotated along X)
    const armGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    const armL = part(armGeo, this._matSkin, -0.37, 1.4, 0);
    const armR = part(armGeo, this._matSkin,  0.37, 1.4, 0);
    armL.rotation.x = -Math.PI / 2;
    armR.rotation.x = -Math.PI / 2;

    return g;
  }

  _makeHpBar() {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.02), this._matHpBg);
    const fg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.02), this._matHpFg.clone());
    fg.position.z = 0.01;
    g.add(bg);
    g.add(fg);
    g._fg = fg;
    g.visible = false;
    return g;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  spawn(x, y, z) {
    if (this._mobs.length >= this._maxMobs) return null;
    const mob = new Zombie(x, y, z);
    mob.mesh  = this._makeMesh();
    mob.hpBar = this._makeHpBar();
    mob.mesh.position.set(x, y, z);
    this._scene.add(mob.mesh);
    this._scene.add(mob.hpBar);
    this._mobs.push(mob);
    return mob;
  }

  // Attack a mob by id — attacker pos used for knockback direction
  hit(mobId, damage, ax, az) {
    const mob = this._mobs.find(m => m.id === mobId && !m.dead);
    if (!mob) return false;
    mob.hp -= damage;
    mob.hitFlash = 0.25;
    // Knockback away from attacker
    const kx = mob.x - ax, kz = mob.z - az;
    const kl = Math.sqrt(kx * kx + kz * kz) || 1;
    mob.vx += (kx / kl) * 7;
    mob.vy  = 4;
    mob.vz += (kz / kl) * 7;
    if (mob.hp <= 0) this._kill(mob);
    return true;
  }

  // Find closest mob in camera-facing cone within range
  findTarget(px, py, pz, yaw, pitch, range) {
    const dx = -Math.sin(yaw) * Math.cos(pitch);
    const dy =  Math.sin(pitch);
    const dz = -Math.cos(yaw) * Math.cos(pitch);
    const ey = py + 1.62;

    let best = null, bestDist = range;
    for (const mob of this._mobs) {
      if (mob.dead) continue;
      const mx = mob.x - px;
      const my = (mob.y + MOB_H * 0.5) - ey;
      const mz = mob.z - pz;
      const d  = Math.sqrt(mx * mx + my * my + mz * mz);
      if (d > range) continue;
      const dot = (mx * dx + my * dy + mz * dz) / d;
      if (dot > 0.55 && d < bestDist) { best = mob; bestDist = d; }
    }
    return best;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  update(dt, player, isNight) {
    // Spawn during night
    this._spawnTimer -= dt;
    if (isNight && this._spawnTimer <= 0 && this._mobs.length < this._maxMobs) {
      this._trySpawn(player);
      this._spawnTimer = 3.5;
    }

    for (const mob of this._mobs) {
      if (!mob.dead) this._updateMob(mob, dt, player, isNight);
    }

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

    for (let y = 100; y > 1; y--) {
      if (this._world.isSolid(fx, y, fz) &&
          !this._world.isSolid(fx, y + 1, fz) &&
          !this._world.isSolid(fx, y + 2, fz)) {
        this.spawn(sx, y + 1, sz);
        return;
      }
    }
  }

  _updateMob(mob, dt, player, isNight) {
    const dx    = player.x - mob.x;
    const dz    = player.z - mob.z;
    const distH = Math.sqrt(dx * dx + dz * dz);

    // Chase player
    const AGGRO = 22, SPEED = 2.2;
    if (distH > 0.5 && distH < AGGRO) {
      const nx = dx / distH, nz = dz / distH;
      mob.vx = nx * SPEED;
      mob.vz = nz * SPEED;
      mob.mesh.rotation.y = Math.atan2(-dx, -dz);

      // Jump to climb one-block steps
      if (mob.onGround) {
        const fX = Math.floor(mob.x + nx * 0.7);
        const fZ = Math.floor(mob.z + nz * 0.7);
        const fY = Math.floor(mob.y + 0.1);
        if (this._world.isSolid(fX, fY, fZ) || this._world.isSolid(fX, fY + 1, fZ)) {
          mob.vy = 7.5;
          mob.onGround = false;
        }
      }
    } else if (distH <= 0.5) {
      mob.vx = 0; mob.vz = 0;
    } else {
      mob.vx *= 0.85; mob.vz *= 0.85;
    }

    if (!mob.onGround) mob.vy += GRAVITY * dt;
    this._collide(mob, dt);

    // Hit flash: swap to red material briefly
    if (mob.hitFlash > 0) {
      mob.hitFlash -= dt;
      const flash = mob.hitFlash > 0;
      mob.mesh.traverse(c => {
        if (c.isMesh) c.material = flash ? this._matFlash : c._origMat;
      });
    }

    // Sunburn in daylight
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

    // Update mesh
    mob.mesh.position.set(mob.x, mob.y, mob.z);

    // HP bar billboards toward camera
    const frac = Math.max(0, mob.hp / mob.maxHp);
    mob.hpBar.position.set(mob.x, mob.y + MOB_H + 0.3, mob.z);
    mob.hpBar.lookAt(this._camera.position);
    mob.hpBar._fg.scale.x = frac;
    mob.hpBar._fg.position.x = (frac - 1) * 0.3;
    mob.hpBar.visible = mob.hp < mob.maxHp;

    // Melee attack
    mob.attackTimer -= dt;
    const fullDist = Math.sqrt(dx * dx + (player.y - mob.y) ** 2 + dz * dz);
    if (fullDist < 1.5 && mob.attackTimer <= 0) {
      player._takeDamage(3);
      player.knockback(mob.x, mob.z);
      mob.attackTimer = 1.5;
    }

    if (mob.hp <= 0 || mob.y < -30) this._kill(mob);
  }

  _isInSunlight(mob) {
    const bx = Math.floor(mob.x);
    const bz = Math.floor(mob.z);
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
    this._mobs = [];
    this._matSkin.dispose();  this._matShirt.dispose();  this._matPants.dispose();
    this._matEye.dispose();   this._matFlash.dispose();
    this._matHpBg.dispose();  this._matHpFg.dispose();
  }
}
