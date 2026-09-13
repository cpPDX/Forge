export class FirstSessionGuideView {
  constructor() {
    this._ensureMarkup();
    this._el = document.getElementById('first-session-guide');
    this._title = document.getElementById('first-session-title');
    this._hint = document.getElementById('first-session-hint');
    this._progress = document.getElementById('first-session-progress');
  }

  _ensureMarkup() {
    if (!document.getElementById('first-session-guide-style')) {
      const style = document.createElement('style');
      style.id = 'first-session-guide-style';
      style.textContent = `
        #first-session-guide {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 70;
          width: min(340px, calc(100vw - 24px));
          padding: 10px 12px;
          background: rgba(10, 12, 16, 0.86);
          border: 1px solid rgba(255, 153, 0, 0.7);
          border-left: 4px solid #ff9900;
          color: #f5f5f5;
          font-family: 'Courier New', monospace;
          pointer-events: none;
          text-shadow: 1px 1px 0 #000;
          box-shadow: 0 4px 18px rgba(0,0,0,0.28);
        }
        #first-session-guide.hidden { display: none; }
        #first-session-guide.inventory-open {
          left: auto;
          right: 12px;
          width: min(270px, 34vw);
        }
        #first-session-guide.goal {
          border-color: rgba(110, 190, 120, 0.75);
          border-left-color: #6ebe78;
          background: rgba(8, 20, 12, 0.78);
        }
        #first-session-title {
          color: #ffb347;
          font-size: 13px;
          font-weight: bold;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        #first-session-guide.goal #first-session-title { color: #8bd696; }
        #first-session-hint { font-size: 11px; line-height: 1.35; color: #eee; }
        #first-session-progress { font-size: 10px; line-height: 1.3; color: #bdbdbd; margin-top: 5px; }
        @media (max-width: 700px) {
          #first-session-guide { width: min(300px, 44vw); padding: 8px 10px; }
          #first-session-guide.inventory-open { width: min(240px, 31vw); }
          #first-session-hint { font-size: 10px; }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('first-session-guide')) {
      const el = document.createElement('div');
      el.id = 'first-session-guide';
      el.className = 'hidden';
      el.innerHTML = `
        <div id="first-session-title"></div>
        <div id="first-session-hint"></div>
        <div id="first-session-progress"></div>
      `;
      document.body.appendChild(el);
    }
  }

  render(view, { inventoryOpen = false } = {}) {
    if (!this._el) return;
    if (!view) {
      this._el.classList.add('hidden');
      return;
    }

    this._el.classList.remove('hidden');
    this._el.classList.toggle('goal', view.goal === true);
    this._el.classList.toggle('inventory-open', inventoryOpen === true);
    if (this._title) this._title.textContent = view.title ?? '';
    if (this._hint) this._hint.textContent = view.hint ?? '';
    if (this._progress) {
      this._progress.textContent = view.progress ?? '';
      this._progress.style.display = view.progress ? 'block' : 'none';
    }
  }
}
