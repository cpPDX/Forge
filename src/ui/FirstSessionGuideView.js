export class FirstSessionGuideView {
  constructor() {
    this._el = document.getElementById('first-session-guide');
    this._title = document.getElementById('first-session-title');
    this._hint = document.getElementById('first-session-hint');
    this._progress = document.getElementById('first-session-progress');
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
