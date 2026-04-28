import { TILE_SIZE, PLAYER } from '../utils/constants.js';

export const MOB_DEFS = {
  slime:     { name: 'Slime',      hp: 8,  damage: 2, speed: 40,  passive: false, drops: [{ itemId: 'slimeball', count: 1 }],                                  color: 0x55cc55, w: 14, h: 14 },
  zombie:    { name: 'Zombie',     hp: 20, damage: 3, speed: 55,  passive: false, drops: [{ itemId: 'rotten_flesh', count: 1 }, { itemId: 'iron_ingot', count: 1, chance: 0.05 }], color: 0x558855, w: 12, h: 24 },
  skeleton:  { name: 'Skeleton',   hp: 16, damage: 2, speed: 65,  passive: false, drops: [{ itemId: 'bone', count: 1 }, { itemId: 'arrow', count: 2 }],          color: 0xddddcc, w: 10, h: 22 },
  spider:    { name: 'Spider',     hp: 14, damage: 2, speed: 80,  passive: false, drops: [{ itemId: 'string', count: 1 }, { itemId: 'spider_eye', count: 1, chance: 0.30 }], color: 0x441144, w: 16, h: 10 },
  creeper:   { name: 'Creeper',    hp: 20, damage: 0, speed: 55,  passive: false, drops: [{ itemId: 'gunpowder', count: 1 }],                                   color: 0x44aa44, w: 12, h: 24 },
  pig:       { name: 'Pig',        hp: 10, damage: 0, speed: 50,  passive: true,  drops: [{ itemId: 'raw_pork', count: 1 }],                                    color: 0xffaaaa, w: 16, h: 12 },
  rabbit:    { name: 'Rabbit',     hp: 3,  damage: 0, speed: 90,  passive: true,  drops: [{ itemId: 'raw_meat', count: 1 }],                                    color: 0xeeeecc, w: 8,  h: 8  },
  lava_slime:{ name: 'Lava Slime', hp: 16, damage: 5, speed: 35,  passive: false, drops: [{ itemId: 'magma_cream', count: 1 }],                                 color: 0xff6600, w: 14, h: 14 },
};

const PURSUE_DIST  = 20 * TILE_SIZE;
const ATTACK_DIST  = 1.5 * TILE_SIZE;
const FLEE_DIST    = 4  * TILE_SIZE;
const ATTACK_CD    = 1200;
const GRAVITY      = 700;

export class Mob {
  constructor(scene, x, y, type) {
    this.scene    = scene;
    this.type     = type;
    this.def      = MOB_DEFS[type];
    this.x        = x;
    this.y        = y;
    this.vx       = 0;
    this.vy       = 0;
    this.w        = this.def.w;
    this.h        = this.def.h;
    this.hp       = this.def.hp;
    this.onGround = false;
    this.facingRight = true;
    this.dead     = false;
    this._attackCd = 0;
    this._state   = 'idle';
    this._idleTimer = 0;

    this._gfx = scene.add.graphics().setDepth(9);
    this._draw();
  }

  update(delta, world, player, time) {
    if (this.dead) return;
    const dt = delta / 1000;
    this._attackCd = Math.max(0, this._attackCd - delta);

    this._ai(dt, world, player, time);
    this._physics(dt, world);
    this._draw();
  }

  _ai(dt, world, player, time) {
    const dx = player.centerX - (this.x + this.w / 2);
    const dy = player.centerY - (this.y + this.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.def.passive) {
      // Flee when player is close
      if (dist < FLEE_DIST) {
        this.vx = -(dx / dist) * this.def.speed;
        this.facingRight = this.vx > 0;
      } else {
        this._idleWander(dt);
      }
      return;
    }

    if (dist < PURSUE_DIST) {
      this._state = 'pursue';
    } else if (this._state === 'pursue' && dist > PURSUE_DIST * 1.5) {
      this._state = 'idle';
    }

    if (this._state === 'pursue') {
      this.vx = (dx / dist) * this.def.speed;
      this.facingRight = dx > 0;

      // Jump over walls
      if (this.onGround && this.vx !== 0) {
        const checkX = this.x + (this.vx > 0 ? this.w + 2 : -2);
        const checkTX = Math.floor(checkX / TILE_SIZE);
        const checkTY = Math.floor((this.y + this.h - 4) / TILE_SIZE);
        if (world.isSolid(checkTX, checkTY)) {
          this.vy = -350;
        }
      }

      // Attack
      if (dist < ATTACK_DIST && this._attackCd === 0 && this.def.damage > 0) {
        player.takeDamage(this.def.damage, time);
        this._attackCd = ATTACK_CD;
      }
    } else {
      this._idleWander(dt);
    }
  }

  _idleWander(dt) {
    this._idleTimer -= dt;
    if (this._idleTimer <= 0) {
      const r = Math.random();
      if (r < 0.4) { this.vx = (Math.random() - 0.5) * this.def.speed * 0.5; }
      else this.vx *= 0.5;
      this._idleTimer = 1 + Math.random() * 2;
    }
    if (this.vx !== 0) this.facingRight = this.vx > 0;
  }

  _physics(dt, world) {
    this.vy += GRAVITY * dt;
    this.vy = Math.min(this.vy, 600);

    const res = world.moveAndCollide(this.x, this.y, this.w, this.h, this.vx, this.vy, dt);
    this.x = res.x; this.y = res.y;
    this.vx = res.vx; this.vy = res.vy;
    this.onGround = res.onGround;
    if (res.onWall) this.vx = 0;
  }

  takeDamage(amount, time) {
    this.hp -= amount;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.dead = true;
    for (const drop of this.def.drops) {
      if (drop.chance && Math.random() > drop.chance) continue;
      this.scene.events.emit('spawnDrop', this.x + this.w / 2, this.y + this.h / 2, drop.itemId, drop.count);
    }
    this.scene.events.emit('mobDied', this);
    this.destroy();
  }

  _draw() {
    const g = this._gfx;
    g.clear();
    g.x = this.x;
    g.y = this.y;
    g.fillStyle(this.def.color, 1);
    g.fillRect(0, 0, this.w, this.h);
    // Eyes
    g.fillStyle(0xff0000, 1);
    if (this.facingRight) g.fillRect(this.w - 3, 2, 2, 2);
    else                  g.fillRect(1, 2, 2, 2);
  }

  destroy() {
    this._gfx.destroy();
  }
}
