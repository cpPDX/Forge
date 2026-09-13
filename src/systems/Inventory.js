import { B } from '../utils/constants.js';

const HOTBAR_SIZE = 9;
const INV_SIZE    = 27;
export const MAX_STACK = 64;

export class Inventory {
  constructor() {
    // slots[0..8] = hotbar, slots[9..35] = main inventory
    this._slots = Array.from({ length: HOTBAR_SIZE + INV_SIZE }, () => ({ id: B.AIR, count: 0 }));
    this.selectedSlot = 0; // hotbar index 0-8
  }

  // ─── Hotbar ──────────────────────────────────────────────────────────────

  hotbarSlot(idx) { return this._slots[idx]; }
  invSlot(idx)    { return this._slots[HOTBAR_SIZE + idx]; }

  selectSlot(idx) { this.selectedSlot = ((idx % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE; }

  scrollSelect(delta) { this.selectSlot(this.selectedSlot + delta); }

  // ─── Adding / removing ───────────────────────────────────────────────────

  capacityFor(id) {
    if (id === B.AIR) return 0;
    let capacity = 0;
    for (const s of this._slots) {
      if (s.id === id && s.count > 0) capacity += Math.max(0, MAX_STACK - s.count);
      else if (s.id === B.AIR || s.count === 0) capacity += MAX_STACK;
    }
    return capacity;
  }

  canAdd(id, count = 1) {
    return Number.isInteger(count) && count >= 0 && this.capacityFor(id) >= count;
  }

  addItem(id, count = 1) {
    if (id === B.AIR || count <= 0) return count;
    // Try stacking into existing slots
    for (const s of this._slots) {
      if (s.id === id && s.count < MAX_STACK) {
        const take = Math.min(count, MAX_STACK - s.count);
        s.count += take; count -= take;
        if (count === 0) return 0;
      }
    }
    // Fill empty slots
    for (const s of this._slots) {
      if (s.id === B.AIR || s.count === 0) {
        const take = Math.min(count, MAX_STACK);
        s.id = id; s.count = take; count -= take;
        if (count === 0) return 0;
      }
    }
    return count; // overflow
  }

  removeItem(id, count = 1) {
    if (count <= 0) return true;
    if (this.countOf(id) < count) return false;

    let remaining = count;
    for (const s of this._slots) {
      if (s.id === id) {
        const take = Math.min(remaining, s.count);
        s.count -= take; remaining -= take;
        if (s.count === 0) s.id = B.AIR;
        if (remaining === 0) return true;
      }
    }
    return true;
  }

  consumeSelected() {
    const s = this._slots[this.selectedSlot];
    if (!s || s.count <= 0) return false;
    s.count--;
    if (s.count === 0) s.id = B.AIR;
    return true;
  }

  countOf(id) {
    return this._slots.reduce((n, s) => n + (s.id === id ? s.count : 0), 0);
  }

  // ─── Direct slot access for UI ───────────────────────────────────────────

  allSlots()    { return this._slots; }
  hotbarSlots() { return this._slots.slice(0, HOTBAR_SIZE); }
  mainSlots()   { return this._slots.slice(HOTBAR_SIZE); }

  // ─── Serialize ───────────────────────────────────────────────────────────

  serialize() {
    return {
      slots:        this._slots.map(s => [s.id, s.count]),
      selectedSlot: this.selectedSlot,
    };
  }

  load(data) {
    if (!data) return;
    if (data.slots) {
      // Reset first so restoring a snapshot cannot leave stale slot contents.
      for (const slot of this._slots) { slot.id = B.AIR; slot.count = 0; }
      data.slots.forEach(([id, count], i) => {
        if (i < this._slots.length) { this._slots[i].id = id; this._slots[i].count = count; }
      });
    }
    if (data.selectedSlot != null) this.selectedSlot = data.selectedSlot;
  }
}
