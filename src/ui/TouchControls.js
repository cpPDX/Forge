import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';

const JOY_RADIUS = 60;
const JOY_DEAD   = 12;

export class TouchControls {
  constructor(scene) {
    this.scene = scene;

    this._state = {
      left: false, right: false, up: false, down: false,
      sprint: false,
      jumpJustPressed: false,
      breakHeld: false,
      placeJustPressed: false,
      inventoryJustPressed: false,
      aimTile: null,
    };

    this._joyActive   = false;
    this._joyBaseX    = 0;
    this._joyBaseY    = 0;
    this._joyId       = null;
    this._breakId     = null;
    this._aimPointer  = null;

    // Keyboard
    const kb = scene.input.keyboard;
    this._keys = kb.addKeys({
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right2:Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump:  Phaser.Input.Keyboard.KeyCodes.SPACE,
      inv:   Phaser.Input.Keyboard.KeyCodes.E,
      sprint:Phaser.Input.Keyboard.KeyCodes.SHIFT,
    });

    this._jumpWasDown = false;
    this._invWasDown  = false;

    // Touch
    scene.input.on('pointerdown', this._onPointerDown, this);
    scene.input.on('pointermove', this._onPointerMove, this);
    scene.input.on('pointerup',   this._onPointerUp,   this);
    scene.input.on('pointerupoutside', this._onPointerUp, this);

    // Mouse break (left button)
    scene.input.on('pointerdown', (p) => {
      if (p.button === 0 && !this._isTouchZone(p)) this._breakId = p.id;
    });
  }

  _isTouchZone(p) {
    // Only treat as virtual buttons on touch devices
    return p.wasTouch;
  }

  _onPointerDown(p) {
    if (!p.wasTouch) return;
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const x = p.x, y = p.y;

    // Inventory button: top-right
    if (x > W * 0.85 && y < H * 0.2) {
      this._state.inventoryJustPressed = true;
      return;
    }

    // Jump button: bottom-right upper area
    if (x > W * 0.75 && y > H * 0.65 && y < H * 0.82) {
      this._state.jumpJustPressed = true;
      return;
    }

    // Break button: bottom-right lower area
    if (x > W * 0.75 && y >= H * 0.82) {
      this._breakId = p.id;
      this._state.breakHeld = true;
      this._aimPointer = p;
      return;
    }

    // Joystick: left half, bottom 45%
    if (x < W * 0.5 && y > H * 0.55) {
      this._joyActive = true;
      this._joyBaseX  = x;
      this._joyBaseY  = y;
      this._joyId     = p.id;
      return;
    }
  }

  _onPointerMove(p) {
    if (p.id === this._joyId && this._joyActive) {
      const dx = p.x - this._joyBaseX;
      const dy = p.y - this._joyBaseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > JOY_DEAD) {
        this._state.left  = dx < -JOY_DEAD;
        this._state.right = dx > JOY_DEAD;
        this._state.up    = dy < -JOY_DEAD;
        this._state.down  = dy > JOY_DEAD;
        this._state.sprint = dist > JOY_RADIUS * 0.85;
      } else {
        this._state.left = this._state.right = this._state.up = this._state.down = false;
        this._state.sprint = false;
      }
    }
    if (p.id === this._breakId) this._aimPointer = p;
  }

  _onPointerUp(p) {
    if (p.id === this._joyId) {
      this._joyActive = false;
      this._joyId = null;
      this._state.left = this._state.right = this._state.up = this._state.down = false;
      this._state.sprint = false;
    }
    if (p.id === this._breakId) {
      this._breakId = null;
      this._state.breakHeld = false;
    }
  }

  poll(pointerX, pointerY, camLeft, camTop, zoom) {
    const kb = this._keys;

    // Keyboard overrides
    const kbLeft   = kb.left.isDown  || kb.left2.isDown;
    const kbRight  = kb.right.isDown || kb.right2.isDown;
    const kbJump   = kb.jump.isDown;
    const kbInv    = kb.inv.isDown;
    const kbSprint = kb.sprint.isDown;

    if (kbLeft || kbRight || kbJump) {
      this._state.left   = kbLeft;
      this._state.right  = kbRight;
      this._state.sprint = kbSprint;
    }

    if (kbJump && !this._jumpWasDown) this._state.jumpJustPressed = true;
    this._jumpWasDown = kbJump;

    if (kbInv && !this._invWasDown) this._state.inventoryJustPressed = true;
    this._invWasDown = kbInv;

    // Mouse break
    if (this.scene.input.activePointer.isDown && this.scene.input.activePointer.button === 0) {
      this._state.breakHeld = true;
    }

    // Aim tile from mouse/touch pointer
    const px = pointerX / zoom + camLeft;
    const py = pointerY / zoom + camTop;
    this._state.aimTile = {
      tx: Math.floor(px / TILE_SIZE),
      ty: Math.floor(py / TILE_SIZE),
    };

    return { ...this._state };
  }

  flush() {
    this._state.jumpJustPressed      = false;
    this._state.placeJustPressed     = false;
    this._state.inventoryJustPressed = false;
  }

  destroy() {
    this.scene.input.off('pointerdown', this._onPointerDown, this);
    this.scene.input.off('pointermove', this._onPointerMove, this);
    this.scene.input.off('pointerup',   this._onPointerUp,   this);
  }
}
