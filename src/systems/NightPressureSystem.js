const PROFILES = [
  {
    tier: 1,
    name: 'Baseline',
    maxMobs: 5,
    spawnInterval: 7.0,
    spawnMinDist: 13,
    spawnMaxDist: 24,
    typeWeights: { zombie: 0.75, skeleton: 0.25, creeper: 0.00 },
    lightSafeRadius: 8,
  },
  {
    tier: 2,
    name: 'Rising',
    maxMobs: 9,
    spawnInterval: 4.8,
    spawnMinDist: 11,
    spawnMaxDist: 24,
    typeWeights: { zombie: 0.55, skeleton: 0.35, creeper: 0.10 },
    lightSafeRadius: 8,
  },
  {
    tier: 3,
    name: 'Peak',
    maxMobs: 13,
    spawnInterval: 3.4,
    spawnMinDist: 10,
    spawnMaxDist: 22,
    typeWeights: { zombie: 0.45, skeleton: 0.35, creeper: 0.20 },
    lightSafeRadius: 8,
  },
];

const SUNSET_WARNING_START = 0.68;
const SUNSET_START = 0.75;

function cloneProfile(profile, nightNumber) {
  return {
    ...profile,
    nightNumber,
    typeWeights: { ...profile.typeWeights },
  };
}

export function pressureProfileForNight(nightNumber) {
  const normalized = Math.max(1, Number.isInteger(nightNumber) ? nightNumber : 1);
  const profile = PROFILES[Math.min(PROFILES.length, normalized) - 1];
  return cloneProfile(profile, normalized);
}

export class NightPressureSystem {
  constructor() {
    this._nightNumber = 0;
    this._activeNight = false;
  }

  get nightNumber() { return this._nightNumber; }
  get activeNight() { return this._activeNight; }
  get profile() { return pressureProfileForNight(Math.max(1, this._nightNumber)); }

  update({ isNight, hostilesAllowed, dayFrac }) {
    const hostileNight = isNight === true && hostilesAllowed === true;
    let startedNight = false;
    let endedNight = false;

    if (hostileNight && !this._activeNight) {
      this._nightNumber += 1;
      this._activeNight = true;
      startedNight = true;
    } else if (!isNight && this._activeNight) {
      this._activeNight = false;
      endedNight = true;
    }

    const warning = hostilesAllowed === true
      && isNight !== true
      && Number.isFinite(dayFrac)
      && dayFrac >= SUNSET_WARNING_START
      && dayFrac < SUNSET_START;

    return {
      startedNight,
      endedNight,
      warning,
      hostileNight,
      nightNumber: this._nightNumber,
      profile: pressureProfileForNight(Math.max(1, this._nightNumber || 1)),
    };
  }

  view({ isNight, hostilesAllowed, dayFrac }) {
    const profile = pressureProfileForNight(Math.max(1, this._nightNumber || 1));
    const warning = hostilesAllowed === true
      && isNight !== true
      && Number.isFinite(dayFrac)
      && dayFrac >= SUNSET_WARNING_START
      && dayFrac < SUNSET_START;

    if (warning) {
      const nextNight = this._nightNumber + 1;
      const nextProfile = pressureProfileForNight(nextNight);
      return {
        tone: 'warning',
        title: `Night ${nextNight} approaches`,
        detail: nextNight === 1
          ? 'Finish shelter, place torches, eat, and equip a weapon.'
          : `${nextProfile.name} pressure — reinforce shelter, extend torch cover, and upgrade gear.`,
      };
    }

    if (isNight === true && hostilesAllowed === true && this._nightNumber > 0) {
      return {
        tone: 'danger',
        title: `Night ${this._nightNumber}`,
        detail: `${profile.name} pressure · torches suppress nearby spawns`,
      };
    }

    return null;
  }

  serialize() {
    return {
      nightNumber: this._nightNumber,
      activeNight: this._activeNight,
    };
  }

  load(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Number.isInteger(data.nightNumber) || data.nightNumber < 0) return false;
    if (typeof data.activeNight !== 'boolean') return false;

    this._nightNumber = data.nightNumber;
    this._activeNight = data.activeNight;
    return true;
  }
}
