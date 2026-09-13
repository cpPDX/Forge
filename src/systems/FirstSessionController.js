import { B } from '../utils/constants.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { FirstSessionGuide } from './FirstSessionGuide.js';
import { FirstSessionGuideView } from '../ui/FirstSessionGuideView.js';

const INVENTORY_SLOT_COUNT = 36;

export class FirstSessionController {
  constructor(game) {
    this._game = game;
    this._guide = new FirstSessionGuide();
    this._view = new FirstSessionGuideView();
    this._freshSave = false;
  }

  get allowsHostiles() { return this._guide.allowsHostiles; }

  init() {
    const saved = this._game._save.load();
    this._freshSave = !saved;

    if (saved?.firstSession) {
      if (!this._guide.load(saved.firstSession)) this._guide.markReturningPlayer();
    } else if (saved) {
      this._guide.markReturningPlayer();
    } else {
      this._game._inventory.load({
        selectedSlot: 0,
        slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => [B.AIR, 0]),
      });
    }

    this._game._firstSessionController = this;
    this._wrapSaveState();
    this._wrapControls();
    this._wrapHostileSpawning();
    this._wrapBlockPlacement();
    this._configureInventoryUI();
    this._configureStartOverlay();
    this._render();
    return this;
  }

  onForgeEstablished() {
    if (!this._guide.markForgeEstablished()) return false;
    this._render();
    this._persistProgress();
    return true;
  }

  _wrapSaveState() {
    const manager = this._game._save;
    const originalSave = manager.save.bind(manager);
    manager.save = state => originalSave({
      ...state,
      firstSession: this._guide.serialize(),
    });
  }

  _wrapControls() {
    const controls = this._game._controls;
    const originalPoll = controls.poll.bind(controls);
    controls.poll = () => {
      const input = originalPoll();
      const changed = this._guide.update({
        input,
        inventory: this._game._inventory,
        inventoryOpen: this._game._inventoryOpen || input.inventory,
        isDay: this._game._time.isDay,
      });
      this._render();
      if (changed) this._persistProgress();
      return input;
    };
  }

  _wrapHostileSpawning() {
    const mobs = this._game._mobs;
    const originalUpdate = mobs.update.bind(mobs);
    mobs.update = (dt, player, isNight) => {
      originalUpdate(dt, player, isNight && this._guide.allowsHostiles);
    };
  }

  _wrapBlockPlacement() {
    const player = this._game._player;
    const inventory = this._game._inventory;
    const originalHandlePlace = player._handlePlace.bind(player);

    player._handlePlace = input => {
      const selected = inventory.hotbarSlot(inventory.selectedSlot);
      const candidateId = selected?.id;
      const wasPlaceable = input?.locked
        && input.placeOnce
        && player.targeted
        && candidateId !== B.AIR
        && !!BlockRegistry.get(candidateId);
      const beforeCount = wasPlaceable ? inventory.countOf(candidateId) : 0;

      originalHandlePlace(input);

      if (!wasPlaceable) return;
      const afterCount = inventory.countOf(candidateId);
      if (afterCount !== beforeCount - 1) return;

      this._guide.onBlockPlaced();
      const changed = this._guide.update({
        inventory,
        inventoryOpen: this._game._inventoryOpen,
        isDay: this._game._time.isDay,
      });
      this._render();
      this._persistProgress();
      if (changed) this._render();
    };
  }

  _configureStartOverlay() {
    if (!this._freshSave) return;

    const howToPlay = document.getElementById('how-to-play');
    if (howToPlay) howToPlay.style.display = 'none';

    const overlay = document.getElementById('click-to-play');
    const subtitle = overlay?.querySelector('.subtitle');
    const tapHint = overlay?.querySelector('.tap-hint');
    if (subtitle) subtitle.textContent = 'Survive. Build. Forge.';
    if (tapHint) tapHint.textContent = 'Enter the world — controls are introduced as you use them.';
  }

  _configureInventoryUI() {
    const armor = document.getElementById('inv-armor');
    if (armor) armor.style.display = 'none';

    const craftArea = document.getElementById('inv-craft-area');
    if (!craftArea) return;

    const label = craftArea.querySelector('.inv-section-label');
    if (label) label.textContent = 'Hand Crafting';

    if (document.getElementById('first-session-recipes')) return;
    const recipes = document.createElement('div');
    recipes.id = 'first-session-recipes';
    recipes.style.cssText = [
      'margin-top:4px',
      'padding-top:4px',
      'border-top:1px solid #888',
      'font:9px/1.35 "Courier New",monospace',
      'color:#333',
    ].join(';');
    recipes.innerHTML = [
      '<strong>KNOWN HAND RECIPES</strong>',
      '<div>1 Log → 4 Planks</div>',
      '<div>2 Planks → 4 Sticks</div>',
      '<div>3 Planks + 2 Sticks → Wooden Pickaxe</div>',
      '<div>8 Cobblestone → Stone Forge</div>',
    ].join('');
    craftArea.appendChild(recipes);
  }

  _isTouch() {
    return this._game._controls._isTouchDevice
      || globalThis.matchMedia?.('(pointer: coarse)').matches === true;
  }

  _render() {
    this._view.render(
      this._guide.view(this._isTouch(), this._game._inventory),
      { inventoryOpen: this._game._inventoryOpen },
    );
  }

  _persistProgress() {
    const result = this._game._doSave?.();
    if (result?.catch) result.catch(error => console.error('First-session save failed:', error));
  }
}
