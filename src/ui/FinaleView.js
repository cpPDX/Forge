export class FinaleView {
  constructor({ onContinue } = {}) {
    this._onContinue = onContinue;
    this._ensureMarkup();
    this._objective = document.getElementById('finale-objective');
    this._objectiveTitle = document.getElementById('finale-objective-title');
    this._objectiveDetail = document.getElementById('finale-objective-detail');
    this._completion = document.getElementById('finale-completion');
    document.getElementById('finale-continue')?.addEventListener('click', () => this._onContinue?.());
  }

  _ensureMarkup() {
    if (!document.getElementById('finale-style')) {
      const style = document.createElement('style');
      style.id = 'finale-style';
      style.textContent = `
        #finale-objective {
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 67;
          width: min(300px, calc(100vw - 28px));
          padding: 9px 11px;
          border: 1px solid rgba(204, 124, 55, 0.72);
          border-radius: 3px;
          background: rgba(20, 15, 11, 0.84);
          color: #f1e9dc;
          font-family: 'Courier New', monospace;
          pointer-events: none;
          text-shadow: 1px 1px 0 #000;
          box-shadow: 0 4px 18px rgba(0,0,0,0.26);
        }
        #finale-objective.hidden { display: none; }
        #finale-objective.complete { border-color: rgba(255, 184, 84, 0.9); }
        #finale-objective-title {
          color: #f5a64b;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.4px;
        }
        #finale-objective-detail {
          margin-top: 3px;
          color: #d8d0c4;
          font-size: 9px;
          line-height: 1.35;
        }
        #finale-completion {
          position: fixed;
          inset: 0;
          z-index: 5000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(8, 6, 5, 0.86);
          font-family: 'Courier New', monospace;
        }
        #finale-completion.hidden { display: none; }
        #finale-completion-card {
          width: min(430px, calc(100vw - 32px));
          padding: 28px 24px;
          border: 2px solid #d8792d;
          background: #17110d;
          color: #f5eee3;
          text-align: center;
          box-shadow: 0 12px 48px rgba(0,0,0,0.6);
        }
        #finale-completion-card h2 {
          margin: 0;
          color: #ff9d43;
          font-size: 24px;
          letter-spacing: 2px;
        }
        #finale-completion-card .finale-kicker {
          margin-top: 7px;
          color: #c8b7a4;
          font-size: 11px;
          letter-spacing: 1px;
        }
        #finale-completion-card p {
          margin: 18px auto;
          max-width: 330px;
          color: #ddd1c2;
          font-size: 12px;
          line-height: 1.5;
        }
        #finale-continue {
          min-width: 180px;
          min-height: 44px;
          border: 1px solid #f0a15c;
          background: #6d3517;
          color: #fff6eb;
          font: bold 12px 'Courier New', monospace;
          cursor: pointer;
        }
        #finale-continue:hover, #finale-continue:focus-visible { background: #87451f; outline: 2px solid #ffd2a6; }
        @media (max-width: 700px) {
          #finale-objective { top: 64px; right: 8px; width: min(270px, calc(100vw - 16px)); }
          #finale-completion-card { padding: 24px 18px; }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('finale-objective')) {
      const objective = document.createElement('div');
      objective.id = 'finale-objective';
      objective.className = 'hidden';
      objective.innerHTML = `
        <div id="finale-objective-title"></div>
        <div id="finale-objective-detail"></div>
      `;
      document.body.appendChild(objective);
    }

    if (!document.getElementById('finale-completion')) {
      const completion = document.createElement('div');
      completion.id = 'finale-completion';
      completion.className = 'hidden';
      completion.innerHTML = `
        <div id="finale-completion-card" role="dialog" aria-modal="true" aria-labelledby="finale-completion-title">
          <h2 id="finale-completion-title">THE FORGE HOLDS</h2>
          <div class="finale-kicker">FORGE 0.3 VERTICAL SLICE COMPLETE</div>
          <p>You established the forge, mastered deeper materials, forged Forgebrand, and held through Peak Night pressure.</p>
          <button id="finale-continue" type="button">Continue this world</button>
        </div>
      `;
      document.body.appendChild(completion);
    }
  }

  renderObjective(view) {
    if (!this._objective) return;
    if (!view) {
      this._objective.classList.add('hidden');
      return;
    }
    this._objective.classList.remove('hidden');
    this._objective.classList.toggle('complete', view.stage === 'complete');
    this._objectiveTitle.textContent = view.title ?? '';
    this._objectiveDetail.textContent = view.detail ?? '';
  }

  showCompletion() {
    this._completion?.classList.remove('hidden');
    document.getElementById('finale-continue')?.focus();
  }

  hideCompletion() {
    this._completion?.classList.add('hidden');
  }
}
