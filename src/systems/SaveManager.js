const SAVE_KEY = 'forge_3d_v1';
export const SAVE_VERSION = 2;
const SUPPORTED_SAVE_VERSIONS = new Set([1, SAVE_VERSION]);

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertFiniteFields(obj, fields, label) {
  if (obj == null) return;
  if (!isObject(obj)) throw new Error(`Invalid ${label} save data`);
  for (const field of fields) {
    if (obj[field] != null && !Number.isFinite(obj[field])) {
      throw new Error(`Invalid ${label}.${field} save value`);
    }
  }
}

function validateInventory(data) {
  if (data == null) return;
  if (!isObject(data)) throw new Error('Invalid inventory save data');
  if (data.selectedSlot != null && (!Number.isInteger(data.selectedSlot) || data.selectedSlot < 0 || data.selectedSlot > 8)) {
    throw new Error('Invalid inventory selected slot');
  }
  if (data.slots != null) {
    if (!Array.isArray(data.slots) || data.slots.length > 36) {
      throw new Error('Invalid inventory slots');
    }
    for (const entry of data.slots) {
      if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid inventory slot entry');
      const [id, count] = entry;
      if (!Number.isInteger(id) || id < 0 || id > 255 || !Number.isInteger(count) || count < 0) {
        throw new Error('Invalid inventory slot value');
      }
    }
  }
}

function validateSaveShape(data) {
  assertFiniteFields(data.player, ['x', 'y', 'z', 'yaw', 'pitch', 'hp', 'hunger'], 'player');
  validateInventory(data.inventory);
  assertFiniteFields(data.time, ['elapsed'], 'time');

  if (data.worldEdits != null && !isObject(data.worldEdits)) {
    throw new Error('Invalid world edit save data');
  }
  if (data.chunks != null && !isObject(data.chunks)) {
    throw new Error('Invalid legacy chunk save data');
  }
}

export class SaveManager {
  constructor(storage = globalThis.localStorage) {
    this._storage = storage;
    this.lastError = null;
  }

  hasSave() {
    if (!this._storage) return false;
    return this._storage.getItem(SAVE_KEY) !== null;
  }

  save(state) {
    this.lastError = null;
    if (!this._storage) {
      const error = new Error('Persistent storage is unavailable');
      this.lastError = error;
      return { ok: false, error };
    }

    try {
      this._storage.setItem(SAVE_KEY, JSON.stringify(state));
      return { ok: true, error: null };
    } catch (error) {
      this.lastError = error;
      return { ok: false, error };
    }
  }

  load() {
    this.lastError = null;
    if (!this._storage) return null;

    try {
      const raw = this._storage.getItem(SAVE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (!isObject(data)) throw new Error('Invalid save payload');

      const version = data.version ?? 1;
      if (!Number.isInteger(version) || !SUPPORTED_SAVE_VERSIONS.has(version)) {
        throw new Error(`Unsupported save version: ${version}`);
      }

      validateSaveShape(data);
      return { ...data, version };
    } catch (error) {
      this.lastError = error;
      return null;
    }
  }

  clear() {
    if (!this._storage) return;
    this._storage.removeItem(SAVE_KEY);
    this.lastError = null;
  }

  autoSave(state) {
    return new Promise(resolve => {
      const run = () => resolve(this.save(state));
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(run);
      } else {
        setTimeout(run, 0);
      }
    });
  }
}
