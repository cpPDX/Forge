import test from 'node:test';
import assert from 'node:assert/strict';

import { Controls } from '../src/player/Controls.js';

function makeControlState() {
  const controls = Object.create(Controls.prototype);
  Object.assign(controls, {
    _keys: {},
    _jumpQueued: false,
    _breakQueued: false,
    _placeQueued: false,
    _inventoryQueued: false,
    _flashlightQueued: false,
    _scrollDelta: 0,
    _hotbarSelect: -1,
    _mouseBreakHeld: false,
    _touchBreak: false,
    _touchPlace: false,
    _joyId: null,
    _lookId: null,
    _joyDX: 0,
    _joyDY: 0,
  });
  return controls;
}

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { listeners.set(type, fn); },
    fire(type, event = {}) {
      const fn = listeners.get(type);
      if (fn) fn({ preventDefault() {}, ...event });
    },
  };
}

test('keyboard one-shot actions ignore browser key repeat', () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const win = eventTarget();
  const debug = { style: { display: 'none' } };
  globalThis.window = win;
  globalThis.document = { getElementById(id) { return id === 'debug' ? debug : null; } };

  try {
    const controls = makeControlState();
    controls._bindKeyboard();

    win.fire('keydown', { code: 'KeyE', repeat: false });
    assert.equal(controls._inventoryQueued, true);
    controls._inventoryQueued = false;
    win.fire('keydown', { code: 'KeyE', repeat: true });
    assert.equal(controls._inventoryQueued, false);

    win.fire('keydown', { code: 'KeyF', repeat: false });
    assert.equal(controls._flashlightQueued, true);
    controls._flashlightQueued = false;
    win.fire('keydown', { code: 'KeyF', repeat: true });
    assert.equal(controls._flashlightQueued, false);

    win.fire('keydown', { code: 'Space', repeat: false });
    assert.equal(controls._jumpQueued, true);
    controls._jumpQueued = false;
    win.fire('keydown', { code: 'Space', repeat: true });
    assert.equal(controls._jumpQueued, false);

    win.fire('keydown', { code: 'F3', repeat: false });
    assert.equal(debug.style.display, 'block');
    win.fire('keydown', { code: 'F3', repeat: true });
    assert.equal(debug.style.display, 'block');
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});

test('window blur clears held and queued actions to a neutral state', () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const win = eventTarget();
  const doc = eventTarget();
  doc.hidden = false;
  doc.getElementById = () => null;
  globalThis.window = win;
  globalThis.document = doc;

  try {
    const controls = makeControlState();
    controls._keys = { KeyW: true, KeyX: true };
    controls._jumpQueued = true;
    controls._breakQueued = true;
    controls._placeQueued = true;
    controls._inventoryQueued = true;
    controls._flashlightQueued = true;
    controls._mouseBreakHeld = true;
    controls._touchBreak = true;
    controls._joyId = 3;
    controls._lookId = 4;
    controls._joyDX = 1;
    controls._joyDY = -1;

    controls._bindInterruptions();
    win.fire('blur');

    assert.deepEqual(controls._keys, {});
    assert.equal(controls._jumpQueued, false);
    assert.equal(controls._breakQueued, false);
    assert.equal(controls._placeQueued, false);
    assert.equal(controls._inventoryQueued, false);
    assert.equal(controls._flashlightQueued, false);
    assert.equal(controls._mouseBreakHeld, false);
    assert.equal(controls._touchBreak, false);
    assert.equal(controls._joyId, null);
    assert.equal(controls._lookId, null);
    assert.equal(controls._joyDX, 0);
    assert.equal(controls._joyDY, 0);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});

test('visibility interruption clears held actions', () => {
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  const win = eventTarget();
  const doc = eventTarget();
  doc.hidden = false;
  doc.getElementById = () => null;
  globalThis.window = win;
  globalThis.document = doc;

  try {
    const controls = makeControlState();
    controls._keys = { KeyW: true };
    controls._touchBreak = true;
    controls._bindInterruptions();

    doc.hidden = true;
    doc.fire('visibilitychange');

    assert.deepEqual(controls._keys, {});
    assert.equal(controls._touchBreak, false);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});

test('mobile Break clears held state on touchcancel as well as touchend', () => {
  const oldDocument = globalThis.document;
  const elements = new Map();
  const ids = ['btn-jump', 'btn-break', 'btn-place', 'btn-inv', 'btn-flashlight'];
  for (const id of ids) elements.set(id, eventTarget());
  globalThis.document = { getElementById(id) { return elements.get(id) ?? null; } };

  try {
    const controls = makeControlState();
    controls._bindButtons();
    const breakButton = elements.get('btn-break');

    breakButton.fire('touchstart');
    assert.equal(controls._touchBreak, true);
    assert.equal(controls._breakQueued, true);

    breakButton.fire('touchcancel');
    assert.equal(controls._touchBreak, false);
  } finally {
    globalThis.document = oldDocument;
  }
});
