const SAVE_KEY = 'forge_3d_v1';

export class SaveManager {
  hasSave() { return localStorage.getItem(SAVE_KEY) !== null; }

  save(state) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Save failed:', e); }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  clear() { localStorage.removeItem(SAVE_KEY); }

  autoSave(state) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => this.save(state));
    } else {
      setTimeout(() => this.save(state), 0);
    }
  }
}
