export class ResourceDepthView {
  constructor() {
    this._ensureMarkup();
    this._el = document.getElementById('resource-depth');
    this._level = document.getElementById('resource-depth-level');
    this._detail = document.getElementById('resource-depth-detail');
  }

  _ensureMarkup() {
    if (!document.getElementById('resource-depth-style')) {
      const style = document.createElement('style');
      style.id = 'resource-depth-style';
      style.textContent = `
        #resource-depth {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 66;
          display: flex;
          align-items: baseline;
          gap: 7px;
          padding: 5px 8px;
          background: rgba(10, 12, 16, 0.76);
          border: 1px solid rgba(170, 190, 205, 0.55);
          color: #eef4f7;
          font-family: 'Courier New', monospace;
          text-shadow: 1px 1px 0 #000;
          pointer-events: none;
          white-space: nowrap;
        }
        #resource-depth.hidden { display: none; }
        #resource-depth-level {
          font-size: 11px;
          font-weight: bold;
          color: #d9edf7;
        }
        #resource-depth-detail {
          font-size: 9px;
          color: #b8c7cf;
        }
        @media (max-width: 700px) {
          #resource-depth { top: 8px; left: 8px; padding: 4px 6px; gap: 5px; }
          #resource-depth-level { font-size: 10px; }
          #resource-depth-detail { font-size: 8px; }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('resource-depth')) {
      const el = document.createElement('div');
      el.id = 'resource-depth';
      el.className = 'hidden';
      el.innerHTML = `
        <span id="resource-depth-level"></span>
        <span id="resource-depth-detail"></span>
      `;
      document.body.appendChild(el);
    }
  }

  render(view) {
    if (!this._el) return;
    if (!view) {
      this._el.classList.add('hidden');
      return;
    }

    this._el.classList.remove('hidden');
    if (this._level) this._level.textContent = `Y ${view.level}`;
    if (this._detail) this._detail.textContent = view.detail ?? '';
  }
}
