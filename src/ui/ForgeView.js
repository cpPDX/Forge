export class ForgeView {
  constructor(actions) {
    this._actions = actions;
    this._ensureMarkup();
    this._panel = document.getElementById('forge-panel');
    this._inner = document.getElementById('forge-inner');
    this._title = document.getElementById('forge-title');
    this._capability = document.getElementById('forge-capability');
    this._processing = document.getElementById('forge-processing');
    this._refine = document.getElementById('forge-refine-list');
    this._craft = document.getElementById('forge-craft-list');
    this._upgrade = document.getElementById('forge-upgrade');
    this._bind();
  }

  _ensureMarkup() {
    if (!document.getElementById('forge-view-style')) {
      const style = document.createElement('style');
      style.id = 'forge-view-style';
      style.textContent = `
        #forge-panel { position:fixed; inset:0; z-index:120; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.68); pointer-events:all; }
        #forge-panel.hidden { display:none; }
        #forge-inner { width:min(560px,94vw); max-height:90vh; overflow:auto; padding:16px; background:#1b1b1b; border:2px solid #6d5842; box-shadow:0 14px 50px rgba(0,0,0,.55); color:#eee; font-family:'Courier New',monospace; }
        #forge-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px; }
        #forge-title { margin:0; color:#ffad55; font-size:20px; letter-spacing:1px; }
        #forge-capability { color:#b8b8b8; font-size:11px; margin-top:3px; }
        #forge-close { min-width:44px; min-height:44px; background:#333; color:#eee; border:1px solid #777; font:700 16px monospace; cursor:pointer; }
        .forge-section { margin-top:12px; padding-top:10px; border-top:1px solid #444; }
        .forge-section h3 { margin:0 0 7px; color:#d7c19d; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
        .forge-row { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; margin:6px 0; padding:7px 8px; background:#252525; border:1px solid #3f3f3f; }
        .forge-row-title { font-size:12px; color:#fff; }
        .forge-row-meta { font-size:10px; color:#aaa; margin-top:2px; line-height:1.35; }
        .forge-action { min-height:38px; padding:6px 10px; background:#75461f; color:#fff1dc; border:1px solid #bb7c42; font:700 10px monospace; cursor:pointer; }
        .forge-action:disabled { opacity:.4; cursor:default; }
        #forge-processing { font-size:11px; color:#ddd; }
        .forge-progress { height:9px; margin:6px 0; background:#090909; border:1px solid #555; }
        .forge-progress > div { height:100%; background:#e18332; }
        .forge-output { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:7px; }
        #forge-upgrade .forge-row { border-color:#6b5b38; }
        @media (max-width:700px) { #forge-inner{width:92vw;max-height:88vh;padding:12px}.forge-row{padding:6px}.forge-action{min-height:44px} }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('forge-panel')) {
      const panel = document.createElement('div');
      panel.id = 'forge-panel';
      panel.className = 'hidden';
      panel.innerHTML = `
        <div id="forge-inner">
          <div id="forge-header">
            <div><h2 id="forge-title">Stone Forge</h2><div id="forge-capability"></div></div>
            <button id="forge-close" type="button" aria-label="Close forge">✕</button>
          </div>
          <div class="forge-section"><h3>Processing</h3><div id="forge-processing"></div><div id="forge-refine-list"></div></div>
          <div class="forge-section"><h3>Forge equipment</h3><div id="forge-craft-list"></div></div>
          <div class="forge-section"><h3>Upgrade forge</h3><div id="forge-upgrade"></div></div>
        </div>
      `;
      document.body.appendChild(panel);
    }
  }

  _bind() {
    document.getElementById('forge-close')?.addEventListener('click', () => this._actions.onClose?.());
    this._panel?.addEventListener('click', event => {
      if (event.target === this._panel) this._actions.onClose?.();
    });
    this._inner?.addEventListener('click', event => {
      const button = event.target.closest('button[data-forge-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.forgeAction;
      if (action === 'refine') this._actions.onRefine?.(button.dataset.id);
      if (action === 'collect') this._actions.onCollect?.();
      if (action === 'craft') this._actions.onCraft?.(button.dataset.id);
      if (action === 'upgrade') this._actions.onUpgrade?.();
    });
  }

  open() { this._panel?.classList.remove('hidden'); }
  close() { this._panel?.classList.add('hidden'); }
  get isOpen() { return this._panel && !this._panel.classList.contains('hidden'); }

  render(model) {
    if (!model) return;
    if (this._title) this._title.textContent = model.title;
    if (this._capability) this._capability.textContent = model.capability;

    if (this._processing) {
      if (model.job) {
        const pct = Math.max(0, Math.min(100, Math.round(model.job.progress / model.job.duration * 100)));
        this._processing.innerHTML = `<div>${model.job.name}: ${pct}%</div><div class="forge-progress"><div style="width:${pct}%"></div></div>`;
      } else {
        this._processing.textContent = 'Forge is ready.';
      }
      if (model.output) {
        const output = document.createElement('div');
        output.className = 'forge-output';
        output.innerHTML = `<span>Output: ${model.output.count}× ${model.output.name}</span><button class="forge-action" data-forge-action="collect">Collect</button>`;
        this._processing.appendChild(output);
      }
    }

    if (this._refine) {
      this._refine.innerHTML = model.refining.map(option => `
        <div class="forge-row">
          <div><div class="forge-row-title">${option.name}</div><div class="forge-row-meta">${option.input} + ${option.fuel} → ${option.output} · ${option.duration}s</div></div>
          <button class="forge-action" data-forge-action="refine" data-id="${option.id}" ${option.enabled ? '' : 'disabled'}>${model.job ? 'Busy' : 'Refine'}</button>
        </div>
      `).join('') || '<div class="forge-row-meta">No refining recipes available.</div>';
    }

    if (this._craft) {
      this._craft.innerHTML = model.crafting.map(option => `
        <div class="forge-row">
          <div><div class="forge-row-title">${option.name}</div><div class="forge-row-meta">${option.ingredients}</div></div>
          <button class="forge-action" data-forge-action="craft" data-id="${option.id}" ${option.enabled ? '' : 'disabled'}>Forge</button>
        </div>
      `).join('') || '<div class="forge-row-meta">Upgrade this forge to unlock metal equipment.</div>';
    }

    if (this._upgrade) {
      if (!model.upgrade) {
        this._upgrade.innerHTML = '<div class="forge-row-meta">Maximum forge tier reached.</div>';
      } else {
        this._upgrade.innerHTML = `
          <div class="forge-row">
            <div><div class="forge-row-title">${model.upgrade.name}</div><div class="forge-row-meta">${model.upgrade.requirements}<br>${model.upgrade.capability}</div></div>
            <button class="forge-action" data-forge-action="upgrade" ${model.upgrade.enabled ? '' : 'disabled'}>Upgrade</button>
          </div>
        `;
      }
    }
  }
}
