import { B } from '../utils/constants.js';
import { canHarvest, harvestRequirement, RESOURCE_LEADS } from './ResourceProgression.js';

export class ResourceProgressionController {
  constructor(game) {
    this._game = game;
  }

  init() {
    this._wrapMiningGate();
    this._wrapTargetLabel();
    this._installMiningLeads();
    return this;
  }

  _heldItemId() {
    const inventory = this._game._inventory;
    const slot = inventory?.hotbarSlot(inventory.selectedSlot);
    return slot?.id ?? B.AIR;
  }

  _wrapMiningGate() {
    const player = this._game._player;
    const originalHandleBreak = player._handleBreak.bind(player);

    player._handleBreak = (dt, input, mobSystem) => {
      const target = player.targeted;
      const miningActive = input?.break || input?.breakOnce;
      if (!target || !miningActive) {
        originalHandleBreak(dt, input, mobSystem);
        return;
      }

      const blockId = this._game._world.getBlock(...target.pos);
      if (canHarvest(blockId, this._heldItemId())) {
        originalHandleBreak(dt, input, mobSystem);
        return;
      }

      // Preserve one-shot melee behavior while making the under-tier block
      // unavailable to the mining path. The player's attack logic does not depend
      // on voxel targeting, so mobs in reach can still be hit normally.
      player.targeted = null;
      try {
        originalHandleBreak(dt, input, mobSystem);
      } finally {
        player.targeted = target;
        player.breakProgress = 0;
        player._breakTarget = null;
      }
    };
  }

  _wrapTargetLabel() {
    const hud = this._game._hud;
    const player = this._game._player;
    const originalSetLabel = hud.setLabel.bind(hud);

    hud.setLabel = label => {
      const target = player.targeted;
      if (!label || !target) {
        originalSetLabel(label);
        return;
      }

      const blockId = this._game._world.getBlock(...target.pos);
      const requirement = harvestRequirement(blockId);
      if (!requirement) {
        originalSetLabel(label);
        return;
      }

      const met = canHarvest(blockId, this._heldItemId());
      originalSetLabel(`${label} · ${met ? requirement.name + '+' : 'Requires ' + requirement.name}`);
    };
  }

  _installMiningLeads() {
    const craftArea = document.getElementById('inv-craft-area');
    if (!craftArea || document.getElementById('mining-leads')) return;

    const leads = document.createElement('div');
    leads.id = 'mining-leads';
    leads.style.cssText = [
      'margin-top:5px',
      'padding-top:4px',
      'border-top:1px solid #888',
      'font:9px/1.35 "Courier New",monospace',
      'color:#333',
    ].join(';');
    leads.innerHTML = [
      '<strong>MINING LEADS</strong>',
      `<div>Iron: below Y48 · ${RESOURCE_LEADS.iron.toolName}</div>`,
      `<div>Gold: below Y32 · ${RESOURCE_LEADS.gold.toolName}</div>`,
      `<div>Diamond: below Y16 · ${RESOURCE_LEADS.diamond.toolName}</div>`,
    ].join('');
    craftArea.appendChild(leads);
  }
}
