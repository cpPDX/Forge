const SAVE_KEY = 'forge_save_v1';

export class SaveManager {
  hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  save(gameState) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  autoSave(gameState) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => this.save(gameState));
    } else {
      setTimeout(() => this.save(gameState), 0);
    }
  }
}
