import * as THREE from 'three';
import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { ItemRegistry }  from '../blocks/ItemRegistry.js';
import { B } from '../utils/constants.js';

const GRAVITY   = -28;
const PICKUP_DIST = 1.5;

function itemColor(id) {
  const item = ItemRegistry.get(id);
  if (item?.color) return new THREE.Color(item.color);
  const def = BlockRegistry.get(id);
  if (def?.color) return new THREE.Color(def.color);
  return new THREE.Color(0xaaaaaa);
}

export class DropSystem {
  constructor(scene, world) {
    this._scene  = scene;
    this._world  = world;
    this._drops  = [];
  }

  spawn(x, y, z, id, count = 1) {
    const geo  = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const mat  = new THREE.MeshLambertMaterial({ color: itemColor(id) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this._scene.add(mesh);
    this._drops.push({
      x, y, z, id, count,
      vx: (Math.random() - 0.5) * 2,
      vy: 3,
      vz: (Math.random() - 0.5) * 2,
      onGround: false,
      baseY: y,
      age: 0,
      mesh,
      dead: false,
    });
  }

  update(dt, player, inventory) {
    for (const d of this._drops) {
      if (d.dead) continue;
      d.age += dt;

      if (!d.onGround) {
        d.vy += GRAVITY * dt;
        const ny = d.y + d.vy * dt;
        if (this._world.isSolid(Math.floor(d.x), Math.floor(ny), Math.floor(d.z))) {
          d.vy = 0; d.onGround = true; d.baseY = Math.ceil(d.y) + 0.15;
        } else {
          d.y = ny;
        }
      }

      d.x += d.vx * dt; d.z += d.vz * dt;
      d.vx *= 0.85;     d.vz *= 0.85;

      const bobY = d.onGround ? d.baseY + Math.sin(d.age * 2.5) * 0.08 : d.y;
      d.mesh.position.set(d.x, bobY, d.z);
      d.mesh.rotation.y += dt * 1.8;

      if (d.age > 0.5) {
        const dx = player.x - d.x;
        const dy = (player.y + 0.9) - bobY;
        const dz = player.z - d.z;
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) < PICKUP_DIST) {
          const overflow = inventory.addItem(d.id, d.count);
          if (overflow === 0) {
            d.dead = true;
            this._scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            d.mesh.material.dispose();
          }
        }
      }
    }

    this._drops = this._drops.filter(d => !d.dead);
  }

  clear() {
    for (const d of this._drops) {
      this._scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
    }
    this._drops = [];
  }
}
