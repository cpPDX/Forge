import { B } from '../utils/constants.js';
import { canHarvest, depthGuidance, harvestRequirement, RESOURCE_LEADS } from './ResourceProgression.js';
import { ResourceDepthView } from '../ui/ResourceDepthView.js';

export class ResourceProgressionController {
  constructor(game, { depthView = null } = {}) {
    this._game = game;
    this._depthView = depthView;
    this._lastDepthKey = null;
  }

  init() {
    this._wrapMiningGate();
    this._wrapTargetLabel();
    this._installMiningLeads();
    if (!this._depthView && typeof document !== 'undefined') this._depthView = new ResourceDepthView();
    if (this._depthView) this._wrapDepthIndicator();
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

  _wrapDepthIndicator() {
    const hud = this._game._hud;
    const originalUpdateDebug = hud.updateDebug.bind(hud);

    hud.updateDebug = (...args) => {
      originalUpdateDebug(...args);
      const view = this._depthViewState();
      const key = view ? `${view.level}|${view.detail}` : 'hidden';
      if (key === this._lastDepthKey) return;
      this._lastDepthKey = key;
      this._depthView.render(view);
    };
  }

  _depthViewState() {
    if (this._game._firstSessionController?.complete !== true) return null;

    const debug = globalThis.document?.getElementById?.('debug');
    if (debug?.style?.display === 'block') return null;

    return depthGuidance(this._game._player?.y ?? 0);
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
