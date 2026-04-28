import { HOTBAR_SIZE, INV_ROWS, INV_COLS, MAX_STACK } from '../utils/constants.js';
import { ItemRegistry } from '../utils/ItemRegistry.js';

export class InventorySystem {
  constructor() {
    this.hotbar = new Array(HOTBAR_SIZE).fill(null);
    this.main   = new Array(INV_ROWS * INV_COLS).fill(null);
    this.hotbarIndex = 0;
  }

  addItem(itemId, count) {
    const def = ItemRegistry.get(itemId);
    if (!def) return count;
    const maxStack = def.stackable ? def.maxStack : 1;
    let remaining = count;

    // Fill existing stacks
    for (const slots of [this.hotbar, this.main]) {
      for (const slot of slots) {
        if (!slot || slot.itemId !== itemId || slot.count >= maxStack) continue;
        const space = maxStack - slot.count;
        const add = Math.min(space, remaining);
        slot.count += add;
        remaining -= add;
        if (remaining === 0) return 0;
      }
    }

    // Fill empty slots — hotbar first, then main
    for (const slots of [this.hotbar, this.main]) {
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] !== null) continue;
        const add = Math.min(maxStack, remaining);
        slots[i] = { itemId, count: add, def, durability: def.maxDurability };
        remaining -= add;
        if (remaining === 0) return 0;
      }
    }

    return remaining;
  }

  removeItem(itemId, count) {
    let remaining = count;
    for (const slots of [this.hotbar, this.main]) {
      for (let i = 0; i < slots.length; i++) {
        if (!slots[i] || slots[i].itemId !== itemId) continue;
        const take = Math.min(slots[i].count, remaining);
        slots[i].count -= take;
        remaining -= take;
        if (slots[i].count === 0) slots[i] = null;
        if (remaining === 0) return count;
      }
    }
    return count - remaining;
  }

  countItem(itemId) {
    let total = 0;
    for (const slots of [this.hotbar, this.main]) {
      for (const slot of slots) {
        if (slot && slot.itemId === itemId) total += slot.count;
      }
    }
    return total;
  }

  hasItem(itemId, count = 1) {
    return this.countItem(itemId) >= count;
  }

  dropAll() {
    const drops = [];
    for (const slots of [this.hotbar, this.main]) {
      for (let i = 0; i < slots.length; i++) {
        if (slots[i]) {
          drops.push({ itemId: slots[i].itemId, count: slots[i].count });
          slots[i] = null;
        }
      }
    }
    return drops;
  }

  getHotbarItem(index) { return this.hotbar[index] || null; }
  getMainItem(index)   { return this.main[index] || null; }

  damageHeldItem() {
    const slot = this.hotbar[this.hotbarIndex];
    if (!slot || slot.durability === null) return;
    slot.durability--;
    if (slot.durability <= 0) this.hotbar[this.hotbarIndex] = null;
  }

  serialize() {
    return {
      hotbar:      this.hotbar.map(s => s ? { itemId: s.itemId, count: s.count, durability: s.durability } : null),
      main:        this.main.map(s => s ? { itemId: s.itemId, count: s.count, durability: s.durability } : null),
      hotbarIndex: this.hotbarIndex,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.hotbarIndex = data.hotbarIndex ?? 0;
    const restore = (slots, saved) => {
      for (let i = 0; i < slots.length; i++) {
        const s = saved[i];
        if (!s) { slots[i] = null; continue; }
        const def = ItemRegistry.get(s.itemId);
        slots[i] = def ? { itemId: s.itemId, count: s.count, def, durability: s.durability ?? def.maxDurability } : null;
      }
    };
    restore(this.hotbar, data.hotbar || []);
    restore(this.main,   data.main   || []);
  }
}
