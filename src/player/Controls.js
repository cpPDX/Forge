const SENSITIVITY = 0.0018;
const TOUCH_SENS  = 0.006;

export class Controls {
  constructor(canvas) {
    this._canvas = canvas;

    // Keyboard state
    this._keys = {};

    // Mouse look
    this._yaw   = 0;
    this._pitch = 0;
    this._locked = false;

    // One-shot flags
    this._jumpQueued      = false;
    this._breakQueued     = false;
    this._placeQueued     = false;
    this._inventoryQueued = false;
    this._flashlightQueued = false;
    this._scrollDelta     = 0;
    this._hotbarSelect    = -1;
    this._mouseBreakHeld  = false;

    // Touch state
    this._joyId    = null;
    this._joyBaseX = 0;
    this._joyBaseY = 0;
    this._joyDX    = 0;
    this._joyDY    = 0;
    this._lookId   = null;
    this._lookLastX = 0;
    this._lookLastY = 0;
    this._touchBreak = false;
    this._touchPlace = false;
    this._isTouchDevice = false;

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
    this._bindButtons();
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'Space')   { e.preventDefault(); this._jumpQueued = true; }
      if (e.code === 'KeyE')    this._inventoryQueued = true;
      if (e.code === 'KeyF')    this._flashlightQueued = true;
      if (e.code >= 'Digit1' && e.code <= 'Digit9')
        this._hotbarSelect = parseInt(e.code.slice(5)) - 1;
      if (e.code === 'F3') {
        const d = document.getElementById('debug');
        if (d) d.style.display = d.style.display === 'block' ? 'none' : 'block';
      }
    });
    window.addEventListener('keyup', e => { this._keys[e.code] = false; });
  }

  // ─── Pointer lock (desktop) ───────────────────────────────────────────────

  _bindMouse() {
    document.addEventListener('pointerlockchange', () => {
      this._locked = document.pointerLockElement === this._canvas;
      document.getElementById('click-to-play').classList.toggle('hidden', this._locked);
    });
    document.addEventListener('mousemove', e => {
      if (!this._locked) return;
      this._yaw   -= e.movementX * SENSITIVITY;
      this._pitch -= e.movementY * SENSITIVITY;
      this._pitch  = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, this._pitch));
    });
    document.addEventListener('mousedown', e => {
      if (!this._locked) return;
      if (e.button === 0) { this._breakQueued = true; this._mouseBreakHeld = true; }
      if (e.button === 2) this._placeQueued = true;
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) this._mouseBreakHeld = false;
    });
    // Canvas click allows locking on desktop without needing click-to-play
    this._canvas.addEventListener('click', () => {
      if (!this._locked && !this._isTouchDevice) this._canvas.requestPointerLock();
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      this._scrollDelta += e.deltaY > 0 ? 1 : -1;
    }, { passive: true });

    const ctp = document.getElementById('click-to-play');
    if (ctp) {
      ctp.addEventListener('click', () => {
        this._canvas.requestPointerLock();
      });
    }
  }

  // ─── Touch controls ───────────────────────────────────────────────────────

  _bindTouch() {
    const joyZone  = document.getElementById('joy-zone');
    const lookZone = document.getElementById('look-zone');
    const joyBase  = document.getElementById('joy-base');
    const joyKnob  = document.getElementById('joy-knob');

    if (!joyZone) return;

    const onDown = (zone, e) => {
      if (!this._isTouchDevice) {
        this._isTouchDevice = true;
        document.getElementById('click-to-play')?.classList.add('hidden');
      }
      for (const t of e.changedTouches) {
        if (zone === joyZone && this._joyId === null) {
          this._joyId = t.identifier;
          this._joyBaseX = t.clientX;
          this._joyBaseY = t.clientY;
          this._joyDX = 0; this._joyDY = 0;
          if (joyBase) { joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px'; joyBase.style.display = 'block'; }
          if (joyKnob) { joyKnob.style.left = t.clientX + 'px'; joyKnob.style.top = t.clientY + 'px'; joyKnob.style.display = 'block'; }
        }
        if (zone === lookZone && this._lookId === null) {
          this._lookId = t.identifier;
          this._lookLastX = t.clientX;
          this._lookLastY = t.clientY;
        }
      }
    };

    const onMove = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          const dx = t.clientX - this._joyBaseX;
          const dy = t.clientY - this._joyBaseY;
          const len = Math.sqrt(dx*dx+dy*dy);
          const maxR = 44;
          const cx = len > maxR ? this._joyBaseX + dx/len*maxR : t.clientX;
          const cy = len > maxR ? this._joyBaseY + dy/len*maxR : t.clientY;
          if (joyKnob) { joyKnob.style.left = cx + 'px'; joyKnob.style.top = cy + 'px'; }
          const norm = Math.min(len, maxR) / maxR;
          this._joyDX = len > 6 ? (dx/len)*norm : 0;
          this._joyDY = len > 6 ? (dy/len)*norm : 0;
        }
        if (t.identifier === this._lookId) {
          const dx = t.clientX - this._lookLastX;
          const dy = t.clientY - this._lookLastY;
          this._yaw   -= dx * TOUCH_SENS;
          this._pitch -= dy * TOUCH_SENS;
          this._pitch  = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, this._pitch));
          this._lookLastX = t.clientX;
          this._lookLastY = t.clientY;
        }
      }
    };

    const onUp = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joyId) {
          this._joyId = null; this._joyDX = 0; this._joyDY = 0;
          if (joyBase) joyBase.style.display = 'none';
          if (joyKnob) joyKnob.style.display = 'none';
        }
        if (t.identifier === this._lookId) this._lookId = null;
      }
    };

    joyZone.addEventListener('touchstart',  e => { e.preventDefault(); onDown(joyZone, e); }, { passive: false });
    lookZone.addEventListener('touchstart', e => { e.preventDefault(); onDown(lookZone, e); }, { passive: false });
    window.addEventListener('touchmove',    onMove, { passive: false });
    window.addEventListener('touchend',     onUp,   { passive: false });
    window.addEventListener('touchcancel',  onUp,   { passive: false });
  }

  _bindButtons() {
    const on = (id, downFn, upFn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); downFn(); }, { passive: false });
      if (upFn) el.addEventListener('touchend', e => { e.preventDefault(); upFn(); }, { passive: false });
    };
    on('btn-jump',       () => { this._jumpQueued = true; });
    on('btn-break',      () => { this._touchBreak = true; this._breakQueued = true; }, () => { this._touchBreak = false; });
    on('btn-place',      () => { this._placeQueued = true; });
    on('btn-inv',        () => { this._inventoryQueued = true; });
    on('btn-flashlight', () => { this._flashlightQueued = true; });
  }

  // ─── Poll ─────────────────────────────────────────────────────────────────

  poll() {
    const k = this._keys;
    const touch = this._isTouchDevice;

    const forward = !!(k['KeyW'] || k['ArrowUp'])    || this._joyDY < -0.15;
    const back    = !!(k['KeyS'] || k['ArrowDown'])   || this._joyDY >  0.15;
    const left    = !!(k['KeyA'] || k['ArrowLeft'])   || this._joyDX < -0.15;
    const right   = !!(k['KeyD'] || k['ArrowRight'])  || this._joyDX >  0.15;
    const sprint  = !!(k['ShiftLeft'] || k['ShiftRight']) || (Math.abs(this._joyDX) > 0.8 || Math.abs(this._joyDY) > 0.8);
    const sneak   = !!(k['ControlLeft']);

    const state = {
      forward, back, left, right, sprint, sneak,
      jump:      this._jumpQueued,
      break:     !!(k['KeyX']) || this._touchBreak || this._mouseBreakHeld,
      breakOnce: this._breakQueued,
      placeOnce: this._placeQueued,
      inventory:     this._inventoryQueued,
      flashlight:    this._flashlightQueued,
      scroll:        this._scrollDelta,
      hotbarSelect:  this._hotbarSelect,
      yaw:       this._yaw,
      pitch:     this._pitch,
      locked:    this._locked || touch,
    };

    // Reset one-shots
    this._jumpQueued       = false;
    this._breakQueued      = false;
    this._placeQueued      = false;
    this._inventoryQueued  = false;
    this._flashlightQueued = false;
    this._scrollDelta      = 0;
    this._hotbarSelect     = -1;

    return state;
  }
}
