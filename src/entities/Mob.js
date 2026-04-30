import { TILE_SIZE } from '../utils/constants.js';

export const MOB_DEFS = {
  slime:     { name: 'Slime',      hp: 8,  damage: 2, speed: 40,  passive: false, sunBurn: false, drops: [{ itemId: 'slimeball',   count: 1 }],                                                    color: 0x55cc55, w: 14, h: 14 },
  zombie:    { name: 'Zombie',     hp: 20, damage: 3, speed: 55,  passive: false, sunBurn: true,  drops: [{ itemId: 'rotten_flesh', count: 1 }, { itemId: 'iron_ingot', count: 1, chance: 0.05 }], color: 0x558855, w: 12, h: 24 },
  skeleton:  { name: 'Skeleton',   hp: 16, damage: 2, speed: 65,  passive: false, sunBurn: true,  drops: [{ itemId: 'bone',         count: 1 }, { itemId: 'arrow',      count: 2 }],               color: 0xddddcc, w: 10, h: 22 },
  spider:    { name: 'Spider',     hp: 14, damage: 2, speed: 80,  passive: false, sunBurn: false, drops: [{ itemId: 'string',       count: 1 }, { itemId: 'spider_eye', count: 1, chance: 0.30 }], color: 0x441144, w: 16, h: 10 },
  creeper:   { name: 'Creeper',    hp: 20, damage: 0, speed: 55,  passive: false, sunBurn: false, drops: [{ itemId: 'gunpowder',    count: 1 }],                                                    color: 0x44aa44, w: 12, h: 24 },
  pig:       { name: 'Pig',        hp: 10, damage: 0, speed: 50,  passive: true,  sunBurn: false, drops: [{ itemId: 'raw_pork',     count: 1 }],                                                    color: 0xffaaaa, w: 16, h: 12 },
  rabbit:    { name: 'Rabbit',     hp: 3,  damage: 0, speed: 90,  passive: true,  sunBurn: false, drops: [{ itemId: 'raw_meat',     count: 1 }],                                                    color: 0xeeeecc, w: 8,  h: 8  },
  lava_slime:{ name: 'Lava Slime', hp: 16, damage: 5, speed: 35,  passive: false, sunBurn: false, drops: [{ itemId: 'magma_cream',  count: 1 }],                                                    color: 0xff6600, w: 14, h: 14 },
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
    this._attackCd   = 0;
    this._state      = 'idle';
    this._idleTimer  = 0;
    this._sunBurnTimer = 0;

    this._gfx = scene.add.graphics().setDepth(9);
    this._draw();
  }

  update(delta, world, player, time, isDay = false) {
    if (this.dead) return;
    const dt = delta / 1000;
    this._attackCd = Math.max(0, this._attackCd - delta);

    this._ai(dt, world, player, time);
    this._physics(dt, world);

    // Sunburn: zombie and skeleton take 1 damage/sec in direct daylight
    if (this.def.sunBurn && isDay && this._isInSunlight(world)) {
      this._sunBurnTimer += delta;
      if (this._sunBurnTimer >= 1000) {
        this._sunBurnTimer = 0;
        this.hp -= 1;
        if (this.hp <= 0) { this._die(); return; }
      }
    } else {
      this._sunBurnTimer = 0;
    }

    this._draw();
  }

  _isInSunlight(world) {
    const tx = Math.floor((this.x + this.w / 2) / TILE_SIZE);
    const ty = Math.floor(this.y / TILE_SIZE);
    for (let dy = 1; dy <= 8; dy++) {
      if (world.isSolid(tx, ty - dy)) return false;
    }
    return true;
  }

  _ai(dt, world, player, time) {
    const dx = player.centerX - (this.x + this.w / 2);
    const dy = player.centerY - (this.y + this.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.def.passive) {
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
        player.knockback(this.x + this.w / 2);
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

  takeDamage(amount) {
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

  // ─── Drawing ─────────────────────────────────────────────────────────────

  _draw() {
    const g = this._gfx;
    g.clear();
    g.x = this.x;
    g.y = this.y;
    switch (this.type) {
      case 'zombie':    this._drawZombie(g);    break;
      case 'skeleton':  this._drawSkeleton(g);  break;
      case 'creeper':   this._drawCreeper(g);   break;
      case 'spider':    this._drawSpider(g);    break;
      case 'slime':     this._drawSlime(g);     break;
      case 'lava_slime':this._drawLavaSlime(g); break;
      case 'pig':       this._drawPig(g);       break;
      case 'rabbit':    this._drawRabbit(g);    break;
      default:          this._drawGeneric(g);   break;
    }
  }

  // Zombie (12×24) — green undead humanoid with outstretched arm
  _drawZombie(g) {
    const fr = this.facingRight;

    // Dark temple/side-of-head strips
    g.fillStyle(0x2a4a2a, 1);
    g.fillRect(0, 0, 2, 8);
    g.fillRect(10, 0, 2, 8);

    // Head (flesh-green)
    g.fillStyle(0x7aaa6a, 1);
    g.fillRect(2, 0, 8, 8);

    // Eyes: white with dark pupil
    g.fillStyle(0xffffff, 1);
    g.fillRect(3, 2, 2, 2);
    g.fillRect(7, 2, 2, 2);
    g.fillStyle(0x000000, 1);
    g.fillRect(fr ? 4 : 3, 2, 1, 2);
    g.fillRect(fr ? 8 : 7, 2, 1, 2);

    // Open mouth (darker)
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(4, 5, 4, 2);

    // Shirt (torn dark green)
    g.fillStyle(0x2a6a2a, 1);
    g.fillRect(1, 8, 10, 10);
    // Tear marks
    g.fillStyle(0x1a4a1a, 1);
    g.fillRect(2, 10, 1, 3);
    g.fillRect(7, 12, 1, 3);

    // Belt
    g.fillStyle(0x6a4a1a, 1);
    g.fillRect(1, 18, 10, 2);

    // Pants (two legs with gap)
    g.fillStyle(0x1a2a3a, 1);
    g.fillRect(1, 20, 4, 4);
    g.fillRect(7, 20, 4, 4);
    // Darker gap
    g.fillStyle(0x111a22, 1);
    g.fillRect(5, 20, 2, 4);

    // Outstretched arm (skin, extends past body)
    g.fillStyle(0x7aaa6a, 1);
    if (fr) {
      g.fillRect(12, 8, 3, 10); // right arm stretched forward
      g.fillRect(-1, 9, 2, 8);  // left arm tucked back slightly
    } else {
      g.fillRect(-3, 8, 3, 10); // left arm stretched forward
      g.fillRect(11, 9, 2, 8);  // right arm tucked
    }
  }

  // Skeleton (10×22) — bone-white with hollow eye sockets and ribs
  _drawSkeleton(g) {
    // Head (8×8)
    g.fillStyle(0xeeeecc, 1);
    g.fillRect(1, 0, 8, 8);

    // Hollow eye sockets
    g.fillStyle(0x111111, 1);
    g.fillRect(2, 2, 3, 3);
    g.fillRect(6, 2, 3, 3);

    // Nasal cavity
    g.fillRect(4, 4, 2, 2);

    // Teeth row with gaps
    g.fillStyle(0xeeeecc, 1);
    g.fillRect(2, 6, 1, 2);
    g.fillRect(4, 6, 2, 2);
    g.fillRect(7, 6, 1, 2);
    g.fillStyle(0x111111, 1);
    g.fillRect(3, 6, 1, 2);
    g.fillRect(6, 6, 1, 2);

    // Spine column
    g.fillStyle(0xddddbb, 1);
    g.fillRect(4, 8, 2, 10);

    // Ribs (4 pairs)
    g.fillStyle(0xddddbb, 1);
    for (let i = 0; i < 4; i++) {
      const ry = 9 + i * 2;
      g.fillRect(1, ry, 3, 1);   // left rib
      g.fillRect(6, ry, 3, 1);   // right rib
    }

    // Pelvis
    g.fillRect(2, 18, 6, 2);

    // Leg bones
    g.fillRect(2, 20, 2, 2);
    g.fillRect(6, 20, 2, 2);

    // Arm bones (thin)
    const fr = this.facingRight;
    g.fillStyle(0xddddbb, 1);
    if (fr) {
      g.fillRect(-1, 8, 1, 10); // left arm
      g.fillRect(10, 8, 1, 10); // right arm (bow hand)
    } else {
      g.fillRect(-1, 8, 1, 10);
      g.fillRect(10, 8, 1, 10);
    }
  }

  // Creeper (12×24) — solid green with the iconic face
  _drawCreeper(g) {
    // Body — two-tone green
    g.fillStyle(0x44aa44, 1);
    g.fillRect(0, 0, 12, 12);
    g.fillStyle(0x3a9a3a, 1);
    g.fillRect(0, 12, 12, 12);

    // Face (rows 2–10) — iconic creeper pattern
    g.fillStyle(0x111111, 1);
    // Eyes
    g.fillRect(2, 3, 2, 2);
    g.fillRect(7, 3, 2, 2);
    // Mouth (Z-shape)
    g.fillRect(4, 5, 4, 2);
    g.fillRect(2, 7, 3, 2);
    g.fillRect(7, 7, 3, 2);
  }

  // Spider (16×10) — wide, low, with 8 legs and eye cluster
  _drawSpider(g) {
    // Abdomen (right side, larger)
    g.fillStyle(0x441144, 1);
    g.fillRect(7, 1, 8, 8);

    // Thorax/head (left side, smaller)
    g.fillStyle(0x551166, 1);
    g.fillRect(1, 2, 6, 6);

    // Legs — 4 on each side (thin lines)
    g.fillStyle(0x330033, 1);
    // Left legs
    g.fillRect(-2, 2, 3, 1);
    g.fillRect(-3, 4, 4, 1);
    g.fillRect(-3, 6, 4, 1);
    g.fillRect(-2, 8, 3, 1);
    // Right legs
    g.fillRect(15, 2, 3, 1);
    g.fillRect(15, 4, 4, 1);
    g.fillRect(15, 6, 4, 1);
    g.fillRect(15, 8, 3, 1);

    // Eye cluster (4 red dots)
    g.fillStyle(0xff2222, 1);
    g.fillRect(2, 3, 1, 1);
    g.fillRect(4, 3, 1, 1);
    g.fillRect(3, 4, 1, 1);
    g.fillRect(5, 4, 1, 1);
  }

  // Slime (14×14) — bouncy rounded blob
  _drawSlime(g) {
    // Outer body
    g.fillStyle(0x55cc55, 1);
    g.fillRect(2, 0, 10, 14);
    g.fillRect(0, 2, 14, 10);

    // Inner highlight (lighter top)
    g.fillStyle(0x88ee88, 1);
    g.fillRect(3, 1, 8, 5);

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillRect(3, 4, 3, 3);
    g.fillRect(8, 4, 3, 3);
    g.fillStyle(0x000000, 1);
    g.fillRect(4, 5, 1, 1);
    g.fillRect(9, 5, 1, 1);

    // Smile
    g.fillStyle(0x228822, 1);
    g.fillRect(4, 9, 1, 1);
    g.fillRect(5, 10, 4, 1);
    g.fillRect(9, 9, 1, 1);
  }

  // Lava Slime (14×14) — same shape, fire colors
  _drawLavaSlime(g) {
    g.fillStyle(0xff6600, 1);
    g.fillRect(2, 0, 10, 14);
    g.fillRect(0, 2, 14, 10);

    g.fillStyle(0xff9944, 1);
    g.fillRect(3, 1, 8, 5);

    g.fillStyle(0xffeecc, 1);
    g.fillRect(3, 4, 3, 3);
    g.fillRect(8, 4, 3, 3);
    g.fillStyle(0x330000, 1);
    g.fillRect(4, 5, 1, 1);
    g.fillRect(9, 5, 1, 1);

    // Angry brow
    g.fillStyle(0xcc3300, 1);
    g.fillRect(3, 3, 3, 1);
    g.fillRect(8, 3, 3, 1);
  }

  // Pig (16×12) — pink with round snout and hooves
  _drawPig(g) {
    // Body
    g.fillStyle(0xffaaaa, 1);
    g.fillRect(0, 2, 16, 8);

    // Head (left side)
    g.fillStyle(0xffbbbb, 1);
    g.fillRect(0, 0, 8, 10);

    // Ears
    g.fillStyle(0xff8888, 1);
    g.fillRect(1, 0, 3, 3);
    g.fillRect(5, 0, 3, 3);

    // Snout
    g.fillStyle(0xffcccc, 1);
    g.fillRect(1, 6, 6, 4);
    // Nostrils
    g.fillStyle(0xdd8888, 1);
    g.fillRect(2, 7, 1, 2);
    g.fillRect(5, 7, 1, 2);

    // Eyes
    g.fillStyle(0x331111, 1);
    g.fillRect(2, 3, 2, 2);
    g.fillRect(5, 3, 2, 2);

    // Hooves
    g.fillStyle(0xcc7777, 1);
    g.fillRect(2, 10, 2, 2);
    g.fillRect(6, 10, 2, 2);
    g.fillRect(10, 10, 2, 2);
    g.fillRect(14, 10, 2, 2);
  }

  // Rabbit (8×8) — tiny bunny with tall ears
  _drawRabbit(g) {
    const fr = this.facingRight;

    // Ears (tall)
    g.fillStyle(0xeeeecc, 1);
    g.fillRect(1, 0, 2, 4);
    g.fillRect(5, 0, 2, 4);
    // Inner ear pink
    g.fillStyle(0xffbbbb, 1);
    g.fillRect(1, 0, 1, 3);
    g.fillRect(5, 0, 1, 3);

    // Head + body
    g.fillStyle(0xeeeecc, 1);
    g.fillRect(1, 3, 6, 5);

    // Eye
    g.fillStyle(0xff2222, 1);
    g.fillRect(fr ? 5 : 2, 4, 1, 1);

    // Nose
    g.fillStyle(0xffaaaa, 1);
    g.fillRect(3, 6, 2, 1);

    // Tail
    g.fillStyle(0xffffff, 1);
    g.fillRect(fr ? 0 : 7, 5, 1, 2);
  }

  // Generic fallback
  _drawGeneric(g) {
    g.fillStyle(this.def.color, 1);
    g.fillRect(0, 0, this.w, this.h);
    g.fillStyle(0xff0000, 1);
    if (this.facingRight) g.fillRect(this.w - 3, 2, 2, 2);
    else                  g.fillRect(1, 2, 2, 2);
  }

  destroy() {
    this._gfx.destroy();
  }
}
