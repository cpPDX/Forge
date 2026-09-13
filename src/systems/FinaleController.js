import { ITEMS } from '../utils/constants.js';
import { FORGE_TIERS } from './ForgeSystem.js';
import { FinaleSystem, FINALE_PEAK_NIGHT } from './FinaleSystem.js';
import { FinaleView } from '../ui/FinaleView.js';

export class FinaleController {
  constructor(game, { forgeController, nightPressureController } = {}) {
    this._game = game;
    this._forgeController = forgeController;
    this._nightPressureController = nightPressureController;
    this._system = new FinaleSystem();
    this._completionPaused = false;
    this._lastPersistBucket = 0;
    this._view = new FinaleView({ onContinue: () => this._continueWorld() });
  }

  init() {
    const saved = this._game._save.load();
    if (saved?.finale && !this._system.load(saved.finale)) {
      console.error('Finale save load failed: invalid state');
    }
    this._lastPersistBucket = Math.floor(this._system.holdSeconds / 5);

    this._wrapSaveState();
    this._wrapCombatKills();
    this._wrapMobUpdate();
    this._wrapRespawn();
    this._render();
    return this;
  }

  _wrapSaveState() {
    const manager = this._game._save;
    const previousSave = manager.save.bind(manager);
    manager.save = state => previousSave({
      ...state,
      finale: this._system.serialize(),
    });
  }

  _wrapCombatKills() {
    const mobs = this._game._mobs;
    const previousHit = mobs.hit.bind(mobs);

    mobs.hit = (mobId, damage, ax, az) => {
      const target = mobs._mobs.find(mob => mob.id === mobId && !mob.dead) ?? null;
      const selected = this._game._inventory.hotbarSlot(this._game._inventory.selectedSlot)?.id;
      const result = previousHit(mobId, damage, ax, az);

      if (result && target?.dead && selected === ITEMS.FORGEBRAND) {
        const context = this._context();
        if (this._system.onForgebrandKill(context)) {
          this._persist();
          this._render();
        }
      }
      return result;
    };
  }

  _wrapMobUpdate() {
    const mobs = this._game._mobs;
    const previousUpdate = mobs.update.bind(mobs);

    mobs.update = (dt, player, isNight) => {
      previousUpdate(dt, player, isNight);

      if (player.hp <= 0) {
        if (this._system.onDeath()) {
          this._persist();
          this._render();
        }
        return;
      }

      const result = this._system.update({ dt, ...this._context() });
      if (!result.changed) return;

      this._render();
      const bucket = Math.floor(this._system.holdSeconds / 5);
      if (result.completedNow || bucket !== this._lastPersistBucket) {
        this._lastPersistBucket = bucket;
        this._persist();
      }
      if (result.completedNow) this._showCompletion();
    };
  }

  _wrapRespawn() {
    const player = this._game._player;
    const previousRespawn = player.respawn.bind(player);
    player.respawn = () => {
      previousRespawn();
      if (this._system.onDeath()) {
        this._lastPersistBucket = 0;
        this._persist();
        this._render();
      }
    };
  }

  _context() {
    const forgeSystem = this._forgeController?._system;
    const nightSystem = this._nightPressureController?._system;
    const hasIronForge = forgeSystem?.hasTier?.(FORGE_TIERS.IRON) === true;
    const hasMasterForge = forgeSystem?.hasTier?.(FORGE_TIERS.MASTER) === true;
    const hasForgebrand = this._game._inventory.countOf(ITEMS.FORGEBRAND) > 0;
    const nightNumber = nightSystem?.nightNumber ?? 0;
    const peakNightActive = nightSystem?.activeNight === true && nightNumber >= FINALE_PEAK_NIGHT;

    return {
      hasIronForge,
      hasMasterForge,
      hasForgebrand,
      nightNumber,
      peakNightActive,
    };
  }

  _render() {
    this._view.renderObjective(this._system.view(this._context()));
  }

  _showCompletion() {
    if (this._completionPaused) return;
    this._completionPaused = true;
    this._game._dead = true;
    document.getElementById('click-to-play')?.classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock?.();
    this._view.showCompletion();
  }

  _continueWorld() {
    this._view.hideCompletion();
    if (!this._completionPaused) return;
    this._completionPaused = false;
    this._game._dead = false;

    if (this._isTouch()) return;
    try {
      const result = this._game._canvas.requestPointerLock?.();
      if (result?.catch) result.catch(() => this._showPlayOverlay());
    } catch {
      this._showPlayOverlay();
    }
  }

  _isTouch() {
    return this._game._controls._isTouchDevice
      || globalThis.matchMedia?.('(pointer: coarse)').matches === true;
  }

  _showPlayOverlay() {
    document.getElementById('click-to-play')?.classList.remove('hidden');
  }

  _persist() {
    const result = this._game._doSave?.();
    if (result?.catch) result.catch(error => console.error('Finale save failed:', error));
  }
}
