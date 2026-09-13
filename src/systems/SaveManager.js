const SAVE_KEY = 'forge_3d_v1';
export const SAVE_VERSION = 2;
const SUPPORTED_SAVE_VERSIONS = new Set([1, SAVE_VERSION]);

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
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid save payload');
      }

      const version = data.version ?? 1;
      if (!Number.isInteger(version) || !SUPPORTED_SAVE_VERSIONS.has(version)) {
        throw new Error(`Unsupported save version: ${version}`);
      }

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
