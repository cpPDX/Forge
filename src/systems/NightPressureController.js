import { NightPressureSystem } from './NightPressureSystem.js';
import { NightPressureView } from '../ui/NightPressureView.js';

export class NightPressureController {
  constructor(game) {
    this._game = game;
    this._system = new NightPressureSystem();
    this._view = new NightPressureView();
  }

  init() {
    const saved = this._game._save.load();
    if (saved?.nightPressure && !this._system.load(saved.nightPressure)) {
      console.error('Night-pressure save load failed: invalid state');
    }

    this._game._nightPressureController = this;
    this._wrapSaveState();
    this._wrapMobUpdate();
    this._applyPressure();
    this._render();
    return this;
  }

  _wrapSaveState() {
    const manager = this._game._save;
    const previousSave = manager.save.bind(manager);
    manager.save = state => previousSave({
      ...state,
      nightPressure: this._system.serialize(),
    });
  }

  _wrapMobUpdate() {
    const mobs = this._game._mobs;
    const previousUpdate = mobs.update.bind(mobs);

    mobs.update = (dt, player, isNight) => {
      const hostilesAllowed = this._game._firstSessionController?.allowsHostiles !== false;
      const state = this._system.update({
        isNight,
        hostilesAllowed,
        dayFrac: this._game._time.dayFrac,
      });

      mobs.configurePressure(state.profile);
      previousUpdate(dt, player, isNight);
      this._render(hostilesAllowed);

      if (state.startedNight || state.endedNight) this._persist();
    };
  }

  _applyPressure() {
    this._game._mobs.configurePressure(this._system.profile);
  }

  _render(hostilesAllowed = this._game._firstSessionController?.allowsHostiles !== false) {
    this._view.render(this._system.view({
      isNight: this._game._time.isDay === false,
      hostilesAllowed,
      dayFrac: this._game._time.dayFrac,
    }));
  }

  _persist() {
    const result = this._game._doSave?.();
    if (result?.catch) result.catch(error => console.error('Night-pressure save failed:', error));
  }
}
