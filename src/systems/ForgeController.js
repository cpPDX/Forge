import { B } from '../utils/constants.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { ItemRegistry } from '../blocks/ItemRegistry.js';
import { ForgeSystem } from './ForgeSystem.js';
import { ForgeView } from '../ui/ForgeView.js';

export class ForgeController {
  constructor(game) {
    this._game = game;
    this._system = new ForgeSystem();
    this._currentPos = null;
    this._view = new ForgeView({
      onClose: () => this.close(),
      onRefine: id => this._refine(id),
      onCollect: () => this._collect(),
      onCraft: id => this._craft(id),
      onUpgrade: () => this._upgrade(),
    });
  }

  init() {
    const saved = this._game._save.load();
    if (saved?.forge) {
      try {
        this._system.load(saved.forge, this._game._world);
      } catch (error) {
        console.error('Forge save load failed:', error);
      }
    }

    this._installForgeName();
    this._wrapSaveState();
    this._wrapInteraction();
    this._wrapWorldLifecycle();
    this._wrapTime();
    this._bindPointerLockGuard();
    return this;
  }

  _installForgeName() {
    if (BlockRegistry._forgeNamingInstalled) return;
    const originalName = BlockRegistry.name.bind(BlockRegistry);
    BlockRegistry.name = id => id === B.FURNACE ? 'Stone Forge' : originalName(id);
    BlockRegistry._forgeNamingInstalled = true;
  }

  _wrapSaveState() {
    const manager = this._game._save;
    const previousSave = manager.save.bind(manager);
    manager.save = state => previousSave({
      ...state,
      forge: this._system.serialize(),
    });
  }

  _wrapInteraction() {
    const player = this._game._player;
    const originalUpdate = player.update.bind(player);

    player.update = (dt, input, mobSystem) => {
      originalUpdate(dt, input, mobSystem);
      if (player.pendingInteract !== 'furnace' && player.pendingInteract !== 'forge') return;

      const pos = player.targeted?.pos?.slice();
      player.pendingInteract = null;
      if (!pos || this._game._world.getBlock(...pos) !== B.FURNACE) return;
      this.open(pos);
    };
  }

  _wrapWorldLifecycle() {
    const world = this._game._world;
    const originalSetBlock = world.setBlock.bind(world);
    world.setBlock = (x, y, z, id, skipGravity = false) => {
      const previous = world.getBlock(x, y, z);
      originalSetBlock(x, y, z, id, skipGravity);
      if (previous !== B.FURNACE || id === B.FURNACE) return;

      const salvage = this._system.removeStation([x, y, z]);
      for (const stack of salvage) {
        this._game._drops.spawn(x + 0.5, y + 0.75, z + 0.5, stack.id, stack.count);
      }
      if (this._currentPos && this._samePos(this._currentPos, [x, y, z])) this.close({ resumePointer: false });
      this._persist();
    };
  }

  _wrapTime() {
    const time = this._game._time;
    const originalUpdate = time.update.bind(time);
    time.update = dt => {
      originalUpdate(dt);
      const completed = this._system.update(dt);
      if (this._view.isOpen) this._render();
      if (completed) this._persist();
    };
  }

  _bindPointerLockGuard() {
    document.addEventListener('pointerlockchange', () => {
      if (this._view.isOpen) this._hidePlayOverlay();
    });
  }

  open(pos) {
    this._currentPos = pos.slice();
    this._system.ensureStation(this._currentPos);
    this._game._firstSessionController?.onForgeEstablished?.();
    this._view.open();
    this._render();
    this._releasePointerForUi();
  }

  close({ resumePointer = true } = {}) {
    this._view.close();
    this._currentPos = null;
    if (!resumePointer || this._isTouch()) return;

    try {
      const result = this._game._canvas.requestPointerLock?.();
      if (result?.catch) result.catch(() => this._showPlayOverlay());
    } catch {
      this._showPlayOverlay();
    }
  }

  _releasePointerForUi() {
    this._hidePlayOverlay();
    if (document.pointerLockElement) document.exitPointerLock?.();
    setTimeout(() => {
      if (this._view.isOpen) this._hidePlayOverlay();
    }, 0);
  }

  _refine(id) {
    if (!this._currentPos) return;
    if (this._system.startRefining(this._currentPos, id, this._game._inventory)) this._persist();
    this._render();
  }

  _collect() {
    if (!this._currentPos) return;
    if (this._system.collectOutput(this._currentPos, this._game._inventory) > 0) this._persist();
    this._render();
  }

  _craft(id) {
    if (!this._currentPos) return;
    if (this._system.craft(this._currentPos, id, this._game._inventory)) this._persist();
    this._render();
  }

  _upgrade() {
    if (!this._currentPos) return;
    if (this._system.upgrade(this._currentPos, this._game._inventory)) this._persist();
    this._render();
  }

  _render() {
    if (!this._currentPos) return;
    const inventory = this._game._inventory;
    const station = this._system.station(this._currentPos);
    const refining = this._system.refiningOptions(this._currentPos);
    const crafting = this._system.craftingOptions(this._currentPos);
    const upgrade = this._system.nextUpgrade(this._currentPos);

    this._view.render({
      title: station.tierName,
      capability: station.capability,
      job: station.job ? {
        ...station.job,
        name: refining.find(option => option.id === station.job.recipeId)?.name ?? 'Processing',
      } : null,
      output: station.output ? {
        ...station.output,
        name: this._name(station.output.id),
      } : null,
      refining: refining.map(option => ({
        id: option.id,
        name: option.name,
        duration: option.duration,
        input: `${option.input.count}× ${this._name(option.input.id)}`,
        fuel: `${option.fuel.count}× ${this._name(option.fuel.id)}`,
        output: `${option.output.count}× ${this._name(option.output.id)}`,
        enabled: !station.job
          && inventory.countOf(option.input.id) >= option.input.count
          && inventory.countOf(option.fuel.id) >= option.fuel.count
          && (!station.output || (station.output.id === option.output.id && station.output.count + option.output.count <= 64)),
      })),
      crafting: crafting.map(option => ({
        id: option.id,
        name: option.name,
        ingredients: option.ingredients.map(item => `${item.count}× ${this._name(item.id)}`).join(' + '),
        enabled: option.ingredients.every(item => inventory.countOf(item.id) >= item.count),
      })),
      upgrade: upgrade ? {
        name: upgrade.name,
        capability: upgrade.capability,
        requirements: upgrade.requirements.map(item => `${item.count}× ${this._name(item.id)}`).join(' + '),
        enabled: upgrade.requirements.every(item => inventory.countOf(item.id) >= item.count),
      } : null,
    });
  }

  _persist() {
    const result = this._game._doSave?.();
    if (result?.catch) result.catch(error => console.error('Forge save failed:', error));
  }

  _name(id) {
    return ItemRegistry.name(id) ?? BlockRegistry.name(id);
  }

  _samePos(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  }

  _isTouch() {
    return this._game._controls._isTouchDevice
      || globalThis.matchMedia?.('(pointer: coarse)').matches === true;
  }

  _hidePlayOverlay() {
    document.getElementById('click-to-play')?.classList.add('hidden');
  }

  _showPlayOverlay() {
    document.getElementById('click-to-play')?.classList.remove('hidden');
  }
}
