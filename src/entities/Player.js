import { TILE_SIZE, PLAYER, TILES } from '../utils/constants.js';
import { TileRegistry } from '../utils/TileRegistry.js';
import { ItemRegistry } from '../utils/ItemRegistry.js';

const COYOTE_FRAMES = 6;
const JUMP_BUFFER_FRAMES = 6;
const FALL_DAMAGE_MIN = 4; // tiles

export class Player {
  constructor(scene, world, inv, x, y) {
    this.scene  = scene;
    this.world  = world;
    this.inv    = inv;

    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.w = PLAYER.WIDTH;
    this.h = PLAYER.HEIGHT;

    this.onGround  = false;
    this.onWall    = false;
    this.facingRight = true;
    this.coyote    = 0;
    this.jumpBuffer = 0;

    this.hp        = PLAYER.MAX_HP;
    this.maxHp     = PLAYER.MAX_HP;
    this.hunger    = PLAYER.MAX_HUNGER;
    this.maxHunger = PLAYER.MAX_HUNGER;
    this.oxygen    = 10;
    this.inWater   = false;
    this.onFire    = false;
    this.dead      = false;

    this._invincibleUntil = 0;
    this._hungerTimer     = 0;
    this._fireTimer       = 0;

    this.fallStartY  = y;
    this.breakTarget = null;
    this.breakProgress = 0;
    this._breakTimer = 0;

    // Visual
    this._gfx = scene.add.graphics().setDepth(10);
    this._draw();
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
  get tileX()   { return Math.floor(this.centerX / TILE_SIZE); }
  get tileY()   { return Math.floor(this.centerY / TILE_SIZE); }

  update(time, delta, input) {
    if (this.dead) return;
    const dt = delta / 1000;

    this._handleMovement(dt, input, time);
    this._handleEnvironment(dt, time);
    this._handleHunger(dt);
    if (input.breakHeld && input.aimTile) {
      this._handleBreaking(dt, input.aimTile, time);
    } else {
      this.breakTarget = null;
      this.breakProgress = 0;
      this._breakTimer = 0;
    }

    // Place tile on right-click
    if (input.placeJustPressed && input.aimTile) {
      this._handlePlace(input.aimTile);
    }

    this._draw();
  }

  _handleMovement(dt, input, time) {
    const speed = input.sprint ? PLAYER.SPRINT_SPEED : PLAYER.WALK_SPEED;

    if (input.left)  { this.vx = -speed; this.facingRight = false; }
    else if (input.right) { this.vx = speed; this.facingRight = true; }
    else this.vx *= 0.75;

    // Coyote time
    if (this.onGround) this.coyote = COYOTE_FRAMES;
    else if (this.coyote > 0) this.coyote--;

    if (input.jumpJustPressed) this.jumpBuffer = JUMP_BUFFER_FRAMES;
    if (this.jumpBuffer > 0)   this.jumpBuffer--;

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = PLAYER.JUMP_VEL;
      this.coyote = 0;
      this.jumpBuffer = 0;
    }

    // Gravity (reduced in water)
    const grav = this.inWater ? PLAYER.GRAVITY * 0.25 : PLAYER.GRAVITY;
    this.vy += grav * dt;
    this.vy = Math.min(this.vy, PLAYER.MAX_FALL);

    // Track apex for fall damage
    if (this.vy < 0) this.fallStartY = Math.min(this.fallStartY, this.y);

    const res = this.world.moveAndCollide(this.x, this.y, this.w, this.h, this.vx, this.vy, dt);
    const wasOnGround = this.onGround;

    this.x = res.x; this.y = res.y;
    this.vx = res.vx; this.vy = res.vy;
    this.onGround = res.onGround;
    this.onWall   = res.onWall;

    // Fall damage
    if (res.onGround && !wasOnGround) {
      const fallTiles = (this.y - this.fallStartY) / TILE_SIZE;
      if (fallTiles > FALL_DAMAGE_MIN) {
        this.takeDamage(Math.floor(fallTiles - FALL_DAMAGE_MIN), time);
      }
      this.fallStartY = this.y;
    }
  }

  _handleEnvironment(dt, time) {
    const tile = this.world.getTile(this.tileX, this.tileY);
    this.inWater = (tile === TILES.WATER);

    if (this.inWater) {
      this.oxygen -= dt;
      if (this.oxygen <= 0) { this.oxygen = 0; this.takeDamage(1, time); }
      // Float
      if (this.vy > 0) this.vy *= 0.95;
    } else {
      this.oxygen = Math.min(10, this.oxygen + dt * 2);
    }

    if (tile === TILES.LAVA) {
      this.onFire = true;
      this._fireTimer += dt;
      if (this._fireTimer > 0.5) { this._fireTimer = 0; this.takeDamage(2, time); }
    } else {
      this.onFire = false;
      this._fireTimer = 0;
    }

    // Cactus contact
    if (this.world.getTile(this.tileX + (this.facingRight ? 1 : -1), this.tileY) === TILES.CACTUS) {
      this.takeDamage(1, time);
    }
  }

  _handleHunger(dt) {
    this._hungerTimer += dt;
    if (this._hungerTimer > 30) {
      this._hungerTimer = 0;
      if (this.hunger > 0) this.hunger--;
      else { this.hp = Math.max(1, this.hp - 1); }
    }
    // Passive regen when hunger is high
    if (this.hunger >= 18 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + dt * 0.1);
    }
  }

  _handleBreaking(dt, aimTile, time) {
    const { tx, ty } = aimTile;
    const inReach = Math.abs(this.centerX - (tx + 0.5) * TILE_SIZE) < PLAYER.REACH_PX &&
                    Math.abs(this.centerY - (ty + 0.5) * TILE_SIZE) < PLAYER.REACH_PX;
    if (!inReach) { this.breakTarget = null; this.breakProgress = 0; return; }

    const tileId = this.world.getTile(tx, ty);
    if (tileId === TILES.AIR) { this.breakTarget = null; return; }

    const def = TileRegistry.get(tileId);
    if (def.hardness < 0) return; // unbreakable

    if (!this.breakTarget || this.breakTarget.tx !== tx || this.breakTarget.ty !== ty) {
      this.breakTarget = { tx, ty };
      this.breakProgress = 0;
      this._breakTimer = 0;
    }

    const held = this.inv.getHotbarItem(this.inv.hotbarIndex);
    const toolDef = held ? ItemRegistry.get(held.itemId) : null;
    const toolType = toolDef?.toolType ?? null;

    let multiplier = 1;
    if (def.tool && toolType === def.tool) {
      multiplier = 0.4 - (toolDef.toolTier || 0) * 0.06;
    } else if (def.tool) {
      multiplier = 5; // wrong tool penalty
    }

    const breakTime = def.hardness * 400 * multiplier;
    this._breakTimer += dt * 1000;
    this.breakProgress = Math.min(1, this._breakTimer / breakTime);

    if (this.breakProgress >= 1) {
      this.world.setTile(tx, ty, TILES.AIR);
      this.scene.events.emit('tileChanged', tx, ty, TILES.AIR);

      // Spawn drops
      const drops = TileRegistry.drops(tileId);
      for (const drop of drops) {
        if (drop.chance && Math.random() > drop.chance) continue;
        this.scene.events.emit('spawnDrop', tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, drop.itemId, drop.count);
      }

      // Damage tool
      if (toolDef && held) this.inv.damageHeldItem();

      this.breakTarget = null;
      this.breakProgress = 0;
      this._breakTimer = 0;
    }
  }

  _handlePlace(aimTile) {
    const { tx, ty } = aimTile;
    const inReach = Math.abs(this.centerX - (tx + 0.5) * TILE_SIZE) < PLAYER.REACH_PX &&
                    Math.abs(this.centerY - (ty + 0.5) * TILE_SIZE) < PLAYER.REACH_PX;
    if (!inReach) return;
    if (this.world.getTile(tx, ty) !== TILES.AIR) return;

    const held = this.inv.getHotbarItem(this.inv.hotbarIndex);
    if (!held) return;
    const itemDef = ItemRegistry.get(held.itemId);
    if (!itemDef?.tileId) return;

    this.world.setTile(tx, ty, itemDef.tileId);
    this.inv.removeItem(held.itemId, 1);
    this.scene.events.emit('tileChanged', tx, ty, itemDef.tileId);
  }

  takeDamage(amount, time) {
    if (time < this._invincibleUntil) return;
    this.hp -= amount;
    this._invincibleUntil = time + 800;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.scene.events.emit('playerDied');
    }
  }

  eat(itemId, hungerRestore) {
    this.hunger = Math.min(this.maxHunger, this.hunger + hungerRestore);
    this.inv.removeItem(itemId, 1);
  }

  _draw() {
    const g = this._gfx;
    g.clear();
    g.x = this.x;
    g.y = this.y;

    // Body
    g.fillStyle(0x3a8acc, 1); g.fillRect(1, 10, 10, 14);
    // Head
    g.fillStyle(0xf0c070, 1); g.fillRect(2, 0, 8, 10);
    // Eyes
    g.fillStyle(0x000000, 1);
    if (this.facingRight) { g.fillRect(7, 3, 2, 2); }
    else                  { g.fillRect(3, 3, 2, 2); }
    // Legs
    g.fillStyle(0x224488, 1);
    g.fillRect(1, 24, 4, 4);
    g.fillRect(7, 24, 4, 4);

    // Break overlay
    if (this.breakTarget && this.breakProgress > 0) {
      const bx = this.breakTarget.tx * TILE_SIZE - this.x;
      const by = this.breakTarget.ty * TILE_SIZE - this.y;
      g.lineStyle(2, 0xffffff, this.breakProgress);
      g.strokeRect(bx, by, TILE_SIZE, TILE_SIZE);
      g.fillStyle(0x000000, this.breakProgress * 0.5);
      g.fillRect(bx, by, TILE_SIZE, TILE_SIZE);
    }
  }

  destroy() {
    this._gfx.destroy();
  }
}
