export const FINALE_PEAK_NIGHT = 3;
export const FINALE_HOLD_SECONDS = 60;

export class FinaleSystem {
  constructor() {
    this._completed = false;
    this._holdSeconds = 0;
    this._forgebrandKill = false;
    this._wasPeakNight = false;
  }

  get completed() { return this._completed; }
  get holdSeconds() { return this._holdSeconds; }
  get forgebrandKill() { return this._forgebrandKill; }

  update({ dt, hasMasterForge, hasForgebrand, peakNightActive }) {
    if (this._completed) return { changed: false, completedNow: false };

    let changed = false;
    const eligible = hasMasterForge === true && hasForgebrand === true;

    if (!eligible) {
      if (this._holdSeconds !== 0 || this._forgebrandKill || this._wasPeakNight) {
        this._resetAttempt();
        changed = true;
      }
      return { changed, completedNow: false };
    }

    if (this._wasPeakNight && !peakNightActive) {
      this._resetAttempt();
      changed = true;
    }

    this._wasPeakNight = peakNightActive === true;
    if (peakNightActive && Number.isFinite(dt) && dt > 0) {
      const next = Math.min(FINALE_HOLD_SECONDS, this._holdSeconds + dt);
      if (next !== this._holdSeconds) {
        this._holdSeconds = next;
        changed = true;
      }
    }

    if (this._holdSeconds >= FINALE_HOLD_SECONDS && this._forgebrandKill) {
      this._completed = true;
      changed = true;
      return { changed, completedNow: true };
    }

    return { changed, completedNow: false };
  }

  onForgebrandKill({ hasMasterForge, hasForgebrand, peakNightActive }) {
    if (this._completed || !hasMasterForge || !hasForgebrand || !peakNightActive || this._forgebrandKill) {
      return false;
    }
    this._forgebrandKill = true;
    return true;
  }

  onDeath() {
    if (this._completed) return false;
    if (this._holdSeconds === 0 && !this._forgebrandKill && !this._wasPeakNight) return false;
    this._resetAttempt();
    return true;
  }

  _resetAttempt() {
    this._holdSeconds = 0;
    this._forgebrandKill = false;
    this._wasPeakNight = false;
  }

  view({ hasIronForge, hasMasterForge, hasForgebrand, nightNumber, peakNightActive }) {
    if (this._completed) {
      return {
        stage: 'complete',
        title: 'Forge 0.3 complete',
        detail: 'The forge holds. This world remains open for continued play.',
      };
    }

    if (!hasIronForge) return null;

    if (!hasMasterForge) {
      return {
        stage: 'master-forge',
        title: 'Masterwork path',
        detail: 'Upgrade the Iron Forge to a Master Forge.',
      };
    }

    if (!hasForgebrand) {
      return {
        stage: 'forgebrand',
        title: 'Forge the Forgebrand',
        detail: '2 Refined Diamond + 2 Gold Ingots + 2 Iron Ingots + 1 Stick',
      };
    }

    if (!peakNightActive) {
      const current = Number.isInteger(nightNumber) ? nightNumber : 0;
      return {
        stage: 'peak-night',
        title: 'Prepare for the final stand',
        detail: current < FINALE_PEAK_NIGHT
          ? `Peak pressure begins on Night ${FINALE_PEAK_NIGHT}. Prepare shelter, torches, food, and Forgebrand.`
          : 'Wait for the next Peak Night. Survive 60 seconds and defeat one enemy with Forgebrand.',
      };
    }

    return {
      stage: 'stand',
      title: 'Final stand',
      detail: `Hold ${Math.floor(this._holdSeconds)} / ${FINALE_HOLD_SECONDS}s · Forgebrand kill ${this._forgebrandKill ? '✓' : '○'}`,
    };
  }

  serialize() {
    return {
      completed: this._completed,
      holdSeconds: this._holdSeconds,
      forgebrandKill: this._forgebrandKill,
      wasPeakNight: this._wasPeakNight,
    };
  }

  load(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.completed !== 'boolean') return false;
    if (!Number.isFinite(data.holdSeconds) || data.holdSeconds < 0 || data.holdSeconds > FINALE_HOLD_SECONDS) return false;
    if (typeof data.forgebrandKill !== 'boolean' || typeof data.wasPeakNight !== 'boolean') return false;

    this._completed = data.completed;
    this._holdSeconds = data.completed ? FINALE_HOLD_SECONDS : data.holdSeconds;
    this._forgebrandKill = data.completed ? true : data.forgebrandKill;
    this._wasPeakNight = data.completed ? false : data.wasPeakNight;
    return true;
  }
}
