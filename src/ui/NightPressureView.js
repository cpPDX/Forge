export class NightPressureView {
  constructor() {
    this._ensureMarkup();
    this._el = document.getElementById('night-pressure');
    this._title = document.getElementById('night-pressure-title');
    this._detail = document.getElementById('night-pressure-detail');
  }

  _ensureMarkup() {
    if (!document.getElementById('night-pressure-style')) {
      const style = document.createElement('style');
      style.id = 'night-pressure-style';
      style.textContent = `
        #night-pressure {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 68;
          max-width: min(420px, calc(100vw - 32px));
          padding: 8px 12px;
          border: 1px solid rgba(255, 184, 92, 0.72);
          border-radius: 3px;
          background: rgba(18, 14, 10, 0.84);
          color: #f4f0e8;
          font-family: 'Courier New', monospace;
          text-align: center;
          pointer-events: none;
          text-shadow: 1px 1px 0 #000;
          box-shadow: 0 4px 18px rgba(0,0,0,0.3);
        }
        #night-pressure.hidden { display: none; }
        #night-pressure.danger {
          border-color: rgba(218, 84, 72, 0.82);
          background: rgba(30, 8, 8, 0.88);
        }
        #night-pressure-title {
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 0.6px;
          color: #ffc36a;
        }
        #night-pressure.danger #night-pressure-title { color: #ff8578; }
        #night-pressure-detail {
          margin-top: 2px;
          font-size: 10px;
          line-height: 1.3;
          color: #d8d2c8;
        }
        @media (max-width: 700px) {
          #night-pressure {
            top: 8px;
            max-width: min(320px, calc(100vw - 24px));
            padding: 7px 9px;
          }
          #night-pressure-title { font-size: 11px; }
          #night-pressure-detail { font-size: 9px; }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('night-pressure')) {
      const el = document.createElement('div');
      el.id = 'night-pressure';
      el.className = 'hidden';
      el.innerHTML = `
        <div id="night-pressure-title"></div>
        <div id="night-pressure-detail"></div>
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
    this._el.classList.toggle('danger', view.tone === 'danger');
    if (this._title) this._title.textContent = view.title ?? '';
    if (this._detail) this._detail.textContent = view.detail ?? '';
  }
}
