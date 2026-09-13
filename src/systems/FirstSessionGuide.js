import { B, ITEMS } from '../utils/constants.js';

const STEPS = [
  'bearings',
  'wood',
  'inventory',
  'planks',
  'sticks',
  'pickaxe',
  'equip',
  'stone',
  'place',
  'prepare',
  'complete',
];

function clampStep(index) {
  return Math.max(0, Math.min(STEPS.length - 1, index));
}

export class FirstSessionGuide {
  constructor() {
    this._stepIndex = 0;
    this._moved = false;
    this._looked = false;
    this._jumped = false;
    this._placedBlocks = 0;
    this._lastYaw = null;
    this._lastPitch = null;
    this._hostilesUnlocked = false;
    this._waitingForDawn = false;
  }

  get step() { return STEPS[this._stepIndex]; }
  get fundamentalsComplete() { return this.step === 'prepare' || this.step === 'complete'; }
  get allowsHostiles() { return this._hostilesUnlocked; }

  markReturningPlayer() {
    this._stepIndex = STEPS.indexOf('complete');
    this._moved = true;
    this._looked = true;
    this._jumped = true;
    this._placedBlocks = Math.max(1, this._placedBlocks);
    this._hostilesUnlocked = true;
    this._waitingForDawn = false;
  }

  markForgeEstablished() {
    if (this.step !== 'prepare') return false;
    this._stepIndex = STEPS.indexOf('complete');
    return true;
  }

  onBlockPlaced() {
    this._placedBlocks++;
  }

  update({ input, inventory, inventoryOpen, isDay = true }) {
    if (input) {
      if (input.forward || input.back || input.left || input.right) this._moved = true;
      if (input.jump) this._jumped = true;

      if (this._lastYaw != null) {
        const yawDelta = Math.abs(input.yaw - this._lastYaw);
        const pitchDelta = Math.abs(input.pitch - this._lastPitch);
        if (yawDelta > 0.02 || pitchDelta > 0.02) this._looked = true;
      }
      this._lastYaw = input.yaw;
      this._lastPitch = input.pitch;
    }

    let changed = false;

    if (this.fundamentalsComplete && this._waitingForDawn && isDay) {
      this._waitingForDawn = false;
      this._hostilesUnlocked = true;
      changed = true;
    }

    let keepChecking = true;
    while (keepChecking) {
      keepChecking = false;
      switch (this.step) {
        case 'bearings':
          if (this._moved && this._looked && this._jumped) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'wood':
          if (inventory.countOf(B.OAK_LOG) >= 2) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'inventory':
          if (inventoryOpen) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'planks':
          if (inventory.countOf(B.OAK_PLANKS) >= 4) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'sticks':
          if (inventory.countOf(ITEMS.STICK) >= 2) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'pickaxe':
          if (inventory.countOf(ITEMS.WOODEN_PICKAXE) >= 1) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'equip': {
          const selected = inventory.hotbarSlot(inventory.selectedSlot);
          if (selected?.id === ITEMS.WOODEN_PICKAXE) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        }
        case 'stone':
          if (inventory.countOf(B.COBBLESTONE) >= 3) {
            this._advance();
            changed = keepChecking = true;
          }
          break;
        case 'place':
          if (this._placedBlocks >= 1) {
            this._enterPrepare(isDay);
            changed = true;
          }
          break;
        default:
          break;
      }
    }
    return changed;
  }

  _advance() {
    this._stepIndex = clampStep(this._stepIndex + 1);
  }

  _enterPrepare(isDay) {
    this._stepIndex = STEPS.indexOf('prepare');
    this._hostilesUnlocked = isDay === true;
    this._waitingForDawn = !this._hostilesUnlocked;
  }

  view(isTouch, inventory) {
    const invControl = isTouch ? 'Tap Inv' : 'Press E';
    const breakControl = isTouch ? 'hold Break' : 'hold left click';
    const placeControl = isTouch ? 'tap Place' : 'right click';
    const selectControl = isTouch ? 'tap its hotbar slot' : 'use 1-9 or the mouse wheel';

    switch (this.step) {
      case 'bearings':
        return {
          title: 'Get your bearings',
          hint: isTouch
            ? 'Use the left side to move, drag the right side to look, and ▲ to jump.'
            : 'Move with WASD, look with the mouse, and use Space to jump.',
          progress: `${this._moved ? '✓' : '○'} move   ${this._looked ? '✓' : '○'} look   ${this._jumped ? '✓' : '○'} jump`,
        };
      case 'wood': {
        const have = inventory.countOf(B.OAK_LOG);
        return {
          title: 'Gather wood',
          hint: `Aim at an Oak Log and ${breakControl} until it breaks, then walk over the drop.`,
          progress: `Oak Logs ${Math.min(have, 2)} / 2`,
        };
      }
      case 'inventory':
        return { title: 'Open your pack', hint: `${invControl} to open Inventory and Hand Crafting.` };
      case 'planks':
        return {
          title: 'Craft Oak Planks',
          hint: 'Move an Oak Log into any Hand Crafting square, then take the output.',
          progress: 'Recipe: 1 Oak Log → 4 Oak Planks',
        };
      case 'sticks':
        return {
          title: 'Craft Sticks',
          hint: 'Put Oak Planks into Hand Crafting and take the output.',
          progress: 'Recipe: 2 Oak Planks → 4 Sticks',
        };
      case 'pickaxe': {
        const planks = inventory.countOf(B.OAK_PLANKS);
        const sticks = inventory.countOf(ITEMS.STICK);
        return {
          title: 'Craft a Wooden Pickaxe',
          hint: planks < 3
            ? 'You need 3 Planks. Craft another Oak Log into Planks first.'
            : 'Put Planks and Sticks into Hand Crafting, then take the pickaxe.',
          progress: `Need 3 Planks + 2 Sticks   Have ${planks} + ${sticks}`,
        };
      }
      case 'equip':
        return { title: 'Equip your pickaxe', hint: `Find the Wooden Pickaxe in your hotbar and ${selectControl}.` };
      case 'stone': {
        const have = inventory.countOf(B.COBBLESTONE);
        return {
          title: 'Mine stone',
          hint: `Aim at Stone and ${breakControl}. The pickaxe should break it noticeably faster.`,
          progress: `Cobblestone ${Math.min(have, 3)} / 3`,
        };
      }
      case 'place':
        return {
          title: 'Start a foothold',
          hint: `Select Planks or Cobblestone, aim at a block face, then ${placeControl} to place one block.`,
        };
      case 'prepare':
        return {
          title: 'Establish your forge',
          hint: this._waitingForDawn
            ? 'This night stays quiet. Mine more stone, craft a Stone Forge, and use it before the next sunset.'
            : 'Mine enough Cobblestone to craft and place a Stone Forge, then interact with it to begin refining.',
          progress: 'Recipe: 8 Cobblestone → Stone Forge',
          goal: true,
        };
      case 'complete':
      default:
        return null;
    }
  }

  serialize() {
    return {
      step: this.step,
      moved: this._moved,
      looked: this._looked,
      jumped: this._jumped,
      placedBlocks: this._placedBlocks,
      hostilesUnlocked: this._hostilesUnlocked,
      waitingForDawn: this._waitingForDawn,
    };
  }

  load(data) {
    if (!data || typeof data !== 'object') return false;
    const stepIndex = STEPS.indexOf(data.step);
    if (stepIndex < 0) return false;

    this._stepIndex = stepIndex;
    this._moved = data.moved === true;
    this._looked = data.looked === true;
    this._jumped = data.jumped === true;
    this._placedBlocks = Number.isInteger(data.placedBlocks) && data.placedBlocks >= 0
      ? data.placedBlocks
      : 0;

    if (this.fundamentalsComplete) {
      this._hostilesUnlocked = data.hostilesUnlocked !== false;
      this._waitingForDawn = data.waitingForDawn === true && !this._hostilesUnlocked;
    } else {
      this._hostilesUnlocked = false;
      this._waitingForDawn = false;
    }
    return true;
  }
}
