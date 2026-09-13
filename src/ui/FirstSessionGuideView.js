export class FirstSessionGuideView {
  constructor() {
    this._simplifyEntryScreen();
    this._removeDeadArmorUi();
    this._ensureStyles();
    this._ensureMarkup();

    this._el = document.getElementById('first-session-guide');
    this._title = document.getElementById('first-session-title');
    this._hint = document.getElementById('first-session-hint');
    this._progress = document.getElementById('first-session-progress');
  }

  _simplifyEntryScreen() {
    document.getElementById('how-to-play')?.remove();
    const subtitle = document.querySelector('#click-to-play .subtitle');
    if (subtitle) subtitle.textContent = 'Survive. Build. Forge.';
    const hint = document.querySelector('#click-to-play .tap-hint');
    if (hint) hint.textContent = 'Click to enter the world - guidance appears as you play.';
  }

  _removeDeadArmorUi() {
    document.getElementById('inv-armor')?.remove();
    const label = document.querySelector('#inv-craft-area .inv-section-label');
    if (label) label.textContent = 'Hand Crafting';
  }

  _ensureStyles() {
    if (document.getElementById('first-session-guide-styles')) return;
    const style = document.createElement('style');
    style.id = 'first-session-guide-styles';
    style.textContent = `
      #first-session-guide {
        position: fixed;
        top: max(12px, env(safe-area-inset-top));
        left: max(12px, env(safe-area-inset-left));
        z-index: 70;
        width: min(360px, 72vw);
        padding: 10px 12px;
        background: rgba(12, 12, 12, 0.82);
        border: 1px solid rgba(255, 153, 0, 0.65);
        border-left: 3px solid #ff9900;
        color: #fff;
        font-family: 'Courier New', monospace;
        text-shadow: 1px 1px 0 #000;
        pointer-events: none;
        backdrop-filter: blur(3px);
      }
      #first-session-guide.hidden { display: none; }
      #first-session-guide.goal { border-left-color: #ffd166; border-color: rgba(255, 209, 102, 0.55); }
      #first-session-title { color: #ffb347; font-size: 13px; font-weight: bold; margin-bottom: 4px; }
      #first-session-guide.goal #first-session-title { color: #ffd166; }
      #first-session-hint { color: #f3f3f3; font-size: 11px; line-height: 1.35; }
      #first-session-progress { color: #bdbdbd; font-size: 10px; line-height: 1.3; margin-top: 5px; }
      @media (pointer: coarse) {
        #first-session-guide { width: min(330px, 64vw); padding: 8px 10px; }
        #first-session-title { font-size: 12px; }
        #first-session-hint { font-size: 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  _ensureMarkup() {
    if (document.getElementById('first-session-guide')) return;
    const guide = document.createElement('section');
    guide.id = 'first-session-guide';
    guide.className = 'hidden';
    guide.setAttribute('aria-live', 'polite');
    guide.setAttribute('aria-atomic', 'true');
    guide.innerHTML = `
      <div id="first-session-title"></div>
      <div id="first-session-hint"></div>
      <div id="first-session-progress"></div>
    `;
    document.body.appendChild(guide);
  }

  render(view) {
    if (!this._el) return;
    if (!view) {
      this._el.classList.add('hidden');
      return;
    }

    this._el.classList.remove('hidden');
    this._el.classList.toggle('goal', view.goal === true);
    if (this._title) this._title.textContent = view.title ?? '';
    if (this._hint) this._hint.textContent = view.hint ?? '';
    if (this._progress) {
      this._progress.textContent = view.progress ?? '';
      this._progress.style.display = view.progress ? 'block' : 'none';
    }
  }
}
