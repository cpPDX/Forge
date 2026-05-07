import * as THREE from 'three';
import {
  GRAVITY, JUMP_VEL, WALK_SPEED, SPRINT_SPEED,
  PLAYER_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT, REACH,
  B,
} from '../utils/constants.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { ItemRegistry }  from '../blocks/ItemRegistry.js';

const HALF_W = PLAYER_WIDTH / 2;

// DDA voxel raycast — returns { pos:[x,y,z], face:[nx,ny,nz] } or null
function raycast(world, ox, oy, oz, dx, dy, dz, maxDist) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let tmx = (dx > 0 ? (x + 1 - ox) : (ox - x)) * tdx;
  let tmy = (dy > 0 ? (y + 1 - oy) : (oy - y)) * tdy;
  let tmz = (dz > 0 ? (z + 1 - oz) : (oz - z)) * tdz;
  let face = [0, 0, 0];
  let dist = 0;

  for (let i = 0; i < 100; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && BlockRegistry.isSolid(id)) {
      return { pos: [x, y, z], face };
    }
    if (dist > maxDist) return null;
    if (tmx < tmy && tmx < tmz) {
      dist = tmx; x += sx; face = [-sx, 0, 0]; tmx += tdx;
    } else if (tmy < tmz) {
      dist = tmy; y += sy; face = [0, -sy, 0]; tmy += tdy;
    } else {
      dist = tmz; z += sz; face = [0, 0, -sz]; tmz += tdz;
    }
  }
  return null;
}

export class Player {
  constructor(world, camera) {
    this._world  = world;
    this.camera  = camera;

    // Position = feet center
    const sp = world.spawnPoint();
    this.x = sp.x; this.y = sp.y; this.z = sp.z;
    this.vx = 0; this.vy = 0; this.vz = 0;

    this.onGround = false;
    this.sneaking = false;

    // Look angles (driven by Controls)
    this.yaw   = 0;
    this.pitch = 0;

    // Block targeting
    this.targeted = null; // { pos, face }
    this.breakProgress = 0; // 0..1
    this._breakTarget = null;

    // Stats
    this.hp     = 20;
    this.hunger = 20;
    this._hungerTimer = 0;
    this._fallDmgVy  = 0;
    this._starvTimer = 0;

    // Pending block interaction (read and cleared by Game each frame)
    this.pendingInteract = null;

    // Inventory reference (set by Game)
    this.inventory = null;

    // Drop callback — if set, block breaks spawn floating items instead of going to inventory
    this.onDropItem = null;

    this._dir = new THREE.Vector3();
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  update(dt, input, mobSystem = null) {
    this.yaw   = input.yaw;
    this.pitch = input.pitch;

    this._move(dt, input);
    this._applyGravity(dt);
    this._collide(dt);
    this._updateCamera();
    this._updateTarget();
    this._handleBreak(dt, input, mobSystem);
    this._handlePlace(input);
    this._handleHunger(dt);
  }

  // ─── Movement ────────────────────────────────────────────────────────────

  _move(dt, input) {
    if (!input.locked) return;

    const speed = input.sprint ? SPRINT_SPEED : (this.sneaking ? 1.3 : WALK_SPEED);
    this.sneaking = input.sneak;

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    let mx = 0, mz = 0;
    if (input.forward) { mx -= sy; mz -= cy; }
    if (input.back)    { mx += sy; mz += cy; }
    if (input.left)    { mx -= cy; mz += sy; }
    if (input.right)   { mx += cy; mz -= sy; }

    const len = Math.sqrt(mx*mx + mz*mz);
    if (len > 0) { mx /= len; mz /= len; }

    // Slow down when moving through leaves
    const lx = Math.floor(this.x), lz = Math.floor(this.z);
    const inLeaves = this._world.getBlock(lx, Math.floor(this.y + 0.5), lz) === B.OAK_LEAVES
                  || this._world.getBlock(lx, Math.floor(this.y + 1.2), lz) === B.OAK_LEAVES;
    const leafMult = inLeaves ? 0.35 : 1.0;

    this.vx = mx * speed * leafMult;
    this.vz = mz * speed * leafMult;

    if (input.jump && this.onGround) {
      this.vy = JUMP_VEL;
      this.onGround = false;
    }
  }

  // ─── Physics ─────────────────────────────────────────────────────────────

  _applyGravity(dt) {
    if (!this.onGround) {
      this._fallDmgVy = Math.min(this.vy, this._fallDmgVy);
      this.vy += GRAVITY * dt;
    }
  }

  _collide(dt) {
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    let nz = this.z + this.vz * dt;
    const w = HALF_W, h = PLAYER_HEIGHT;

    // X
    if (this._blockCheck(nx, this.y, this.z, w, h)) {
      nx = this.x; this.vx = 0;
    }
    // Z
    if (this._blockCheck(nx, this.y, nz, w, h)) {
      nz = this.z; this.vz = 0;
    }
    // Y
    const prevOnGround = this.onGround;
    this.onGround = false;
    if (this._blockCheck(nx, ny, nz, w, h)) {
      if (this.vy < 0) {
        // Landing — convert velocity to equivalent fall distance: d = v²/(2g)
        const fallSpeed = -this._fallDmgVy;
        let fallBlocks  = (fallSpeed * fallSpeed) / (2 * 28);
        // Leaves cushion the landing by 2 blocks
        const landId = this._world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (landId === B.OAK_LEAVES) fallBlocks = Math.max(0, fallBlocks - 2);
        if (fallBlocks > 3) this._takeDamage(Math.floor(fallBlocks - 3));
        this.onGround = true;
      }
      ny = this.y;
      this.vy = 0;
      this._fallDmgVy = 0;
    }

    this.x = nx; this.y = ny; this.z = nz;
  }

  _blockCheck(x, y, z, w, h) {
    const x0 = Math.floor(x - w), x1 = Math.floor(x + w);
    const y0 = Math.floor(y),     y1 = Math.floor(y + h - 0.001);
    const z0 = Math.floor(z - w), z1 = Math.floor(z + w);
    for (let bx = x0; bx <= x1; bx++)
      for (let by = y0; by <= y1; by++)
        for (let bz = z0; bz <= z1; bz++)
          if (this._world.isSolid(bx, by, bz)) return true;
    return false;
  }

  // ─── Camera ──────────────────────────────────────────────────────────────

  _updateCamera() {
    this.camera.position.set(this.x, this.y + EYE_HEIGHT, this.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  // ─── Block targeting ─────────────────────────────────────────────────────

  _updateTarget() {
    const { x, y, z, pitch, yaw } = this;
    const ey = y + EYE_HEIGHT;
    const dx = -Math.sin(yaw) * Math.cos(pitch);
    const dy =  Math.sin(pitch);
    const dz = -Math.cos(yaw) * Math.cos(pitch);
    this.targeted = raycast(this._world, x, ey, z, dx, dy, dz, REACH);
  }

  // ─── Block interaction ───────────────────────────────────────────────────

  // Returns true if a mob was hit (prevents simultaneous block-break)
  _attack(mobSystem) {
    if (!mobSystem) return false;
    let damage = 1, reach = 2.5; // bare fists
    if (this.inventory) {
      const slot = this.inventory.hotbarSlot(this.inventory.selectedSlot);
      if (slot && slot.id !== B.AIR) {
        const item = ItemRegistry.get(slot.id);
        if (item) { damage = item.damage; reach = item.reach; }
      }
    }
    const target = mobSystem.findTarget(this.x, this.y, this.z, this.yaw, this.pitch, reach);
    if (target) {
      mobSystem.hit(target.id, damage, this.x, this.z);
      return true;
    }
    return false;
  }

  _handleBreak(dt, input, mobSystem) {
    if (!input.locked) return;

    // One-shot: try mob hit first, then block break
    if (input.breakOnce) {
      if (this._attack(mobSystem)) return;
      if (this.targeted) {
        const [bx, by, bz] = this.targeted.pos;
        const id = this._world.getBlock(bx, by, bz);
        const def = BlockRegistry.get(id);
        this._world.setBlock(bx, by, bz, B.AIR);
        if (def?.drops != null) {
          if (!def.dropChance || Math.random() < def.dropChance) {
            if (this.onDropItem) {
              this.onDropItem(bx + 0.5, by + 0.5, bz + 0.5, def.drops, 1);
            } else if (this.inventory) {
              this.inventory.addItem(def.drops, 1);
            }
          }
        }
        this.breakProgress = 0;
        this._breakTarget = null;
      }
      return;
    }

    // Hold-to-break
    if (input.break && this.targeted) {
      const t = this.targeted.pos;
      const same = this._breakTarget && this._breakTarget[0] === t[0]
                && this._breakTarget[1] === t[1] && this._breakTarget[2] === t[2];
      if (!same) { this.breakProgress = 0; this._breakTarget = t.slice(); }

      const id   = this._world.getBlock(t[0], t[1], t[2]);
      const hard = BlockRegistry.hardness(id);
      if (hard < 0) return; // unbreakable

      const heldSlot = this.inventory?.hotbarSlot(this.inventory.selectedSlot);
      const heldTool = heldSlot ? ItemRegistry.get(heldSlot.id) : null;
      const blockDef = BlockRegistry.get(id);
      const toolSpeed = (heldTool?.tool && blockDef?.tool && heldTool.tool === blockDef.tool)
        ? (heldTool.speed ?? 2.0) : 1.0;
      this.breakProgress += dt * toolSpeed / (hard + 0.3);
      if (this.breakProgress >= 1) {
        const bId  = this._world.getBlock(t[0], t[1], t[2]);
        const bDef = BlockRegistry.get(bId);
        this._world.setBlock(t[0], t[1], t[2], B.AIR);
        if (bDef?.drops != null) {
          if (!bDef.dropChance || Math.random() < bDef.dropChance) {
            if (this.onDropItem) {
              this.onDropItem(t[0] + 0.5, t[1] + 0.5, t[2] + 0.5, bDef.drops, 1);
            } else if (this.inventory) {
              this.inventory.addItem(bDef.drops, 1);
            }
          }
        }
        this.breakProgress = 0;
        this._breakTarget = null;
      }
    } else {
      this.breakProgress = 0;
      this._breakTarget = null;
    }
  }

  _handlePlace(input) {
    if (!input.locked || !input.placeOnce) return;
    if (!this.inventory) return;

    // 1. Block interaction — right-clicking an interactive block (e.g. crafting table)
    if (this.targeted) {
      const [bx, by, bz] = this.targeted.pos;
      const tDef = BlockRegistry.get(this._world.getBlock(bx, by, bz));
      if (tDef?.interactive) {
        this.pendingInteract = tDef.interactive;
        return;
      }
    }

    const slot = this.inventory.hotbarSlot(this.inventory.selectedSlot);
    if (!slot || slot.id === B.AIR || slot.count <= 0) return;

    // 2. Eating — consume edible item if hungry
    const item = ItemRegistry.get(slot.id);
    if (item?.edible) {
      if (this.hunger < 20) {
        this.hunger = Math.min(20, this.hunger + item.hungerRestore);
        this.inventory.consumeSelected();
      }
      return;
    }

    // 3. Placing — standard block placement
    if (!this.targeted) return;
    if (!BlockRegistry.get(slot.id)) return;

    const [bx, by, bz] = this.targeted.pos;
    const [fx, fy, fz] = this.targeted.face;
    const px = bx + fx, py = by + fy, pz = bz + fz;

    if (this._overlapsPlayer(px, py, pz)) return;
    this._world.setBlock(px, py, pz, slot.id);
    this.inventory.consumeSelected();
  }

  _overlapsPlayer(bx, by, bz) {
    const w = HALF_W + 0.01, h = PLAYER_HEIGHT;
    return bx < this.x + w && bx + 1 > this.x - w &&
           by < this.y + h && by + 1 > this.y &&
           bz < this.z + w && bz + 1 > this.z - w;
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  _handleHunger(dt) {
    this._hungerTimer += dt;
    if (this._hungerTimer >= 60) {
      this._hungerTimer = 0;
      if (this.hunger > 0) this.hunger--;
    }
    if (this.hunger >= 18 && this.hp < 20) {
      this.hp = Math.min(20, this.hp + dt * 0.5);
    }
    if (this.hunger === 0) {
      this._starvTimer += dt;
      if (this._starvTimer >= 4) { this._starvTimer = 0; this._takeDamage(1); }
    } else {
      this._starvTimer = 0;
    }
  }

  _takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }

  respawn() {
    const sp = this._world.spawnPoint();
    this.x = sp.x; this.y = sp.y; this.z = sp.z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.hp = 20; this.hunger = 20;
    this._fallDmgVy = 0; this._starvTimer = 0;
    this.onGround = false;
  }

  knockback(fromX, fromZ) {
    const dx = this.x - fromX, dz = this.z - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    this.vx = (dx / len) * 8;
    this.vz = (dz / len) * 8;
    this.vy = 4;
  }

  // ─── Serialize ───────────────────────────────────────────────────────────

  serialize() {
    return { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, hp: this.hp, hunger: this.hunger };
  }

  load(data) {
    if (!data) return;
    this.x = data.x ?? this.x; this.y = data.y ?? this.y; this.z = data.z ?? this.z;
    this.yaw = data.yaw ?? 0; this.pitch = data.pitch ?? 0;
    this.hp = data.hp ?? 20; this.hunger = data.hunger ?? 20;
  }
}
