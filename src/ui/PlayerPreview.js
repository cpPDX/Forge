import * as THREE from 'three';

export class PlayerPreview {
  constructor(canvas) {
    if (!canvas) return;
    this._canvas = canvas;
    this._renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this._renderer.setSize(64, 96, false);
    this._renderer.setClearColor(0x000000, 0);

    this._scene  = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(40, 64 / 96, 0.1, 20);
    this._camera.position.set(0, 1.2, 3.2);
    this._camera.lookAt(0, 1.0, 0);

    this._scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.9);
    sun.position.set(1, 2, 2);
    this._scene.add(sun);

    this._t   = 0;
    this._raf = null;
    this._buildPlayerMesh();
  }

  _box(w, h, d, color, x, y, z) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mat  = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return mesh;
  }

  _buildPlayerMesh() {
    const SKIN    = 0xb9825f;
    const HAIR    = 0x241d1a;
    const SHIRT   = 0x343638;
    const APRON   = 0x70472d;
    const LEATHER = 0x4c3022;
    const SCARF   = 0xb84f24;
    const PANT    = 0x252b2e;
    const BOOT    = 0x241b18;
    const EYE     = 0x171717;

    this._group = new THREE.Group();

    // Frontier-smith head: simple face, heavy hair cap, no borrowed character texture.
    this._group.add(this._box(0.48, 0.48, 0.46, SKIN, 0, 1.78, 0));
    this._group.add(this._box(0.50, 0.16, 0.48, HAIR, 0, 1.99, -0.01));
    this._group.add(this._box(0.10, 0.14, 0.03, HAIR, -0.18, 1.88, 0.235));
    this._group.add(this._box(0.06, 0.045, 0.025, EYE, -0.11, 1.80, 0.245));
    this._group.add(this._box(0.06, 0.045, 0.025, EYE,  0.11, 1.80, 0.245));
    this._group.add(this._box(0.07, 0.08, 0.035, 0x9d6649, 0, 1.72, 0.245));

    // Rust-colored neckerchief makes the player read as Forge even at thumbnail size.
    this._group.add(this._box(0.44, 0.13, 0.30, SCARF, 0, 1.48, 0.015));

    // Work shirt and leather apron.
    this._group.add(this._box(0.54, 0.74, 0.28, SHIRT, 0, 1.10, 0));
    this._group.add(this._box(0.39, 0.62, 0.055, APRON, 0, 1.06, 0.17));
    this._group.add(this._box(0.44, 0.07, 0.055, LEATHER, 0, 1.26, 0.18));

    // Sleeved arms with leather bracers/gloves.
    this._leftArm  = this._box(0.23, 0.62, 0.23, SHIRT,  0.385, 1.13, 0);
    this._rightArm = this._box(0.23, 0.62, 0.23, SHIRT, -0.385, 1.13, 0);
    this._group.add(this._leftArm, this._rightArm);
    this._group.add(this._box(0.245, 0.18, 0.245, LEATHER,  0.385, 0.86, 0));
    this._group.add(this._box(0.245, 0.18, 0.245, LEATHER, -0.385, 0.86, 0));

    // Work trousers and heavy boots.
    this._leftLeg  = this._box(0.24, 0.72, 0.25, PANT,  0.13, 0.37, 0);
    this._rightLeg = this._box(0.24, 0.72, 0.25, PANT, -0.13, 0.37, 0);
    this._group.add(this._leftLeg, this._rightLeg);
    this._group.add(this._box(0.26, 0.14, 0.34, BOOT,  0.13, 0.07, 0.035));
    this._group.add(this._box(0.26, 0.14, 0.34, BOOT, -0.13, 0.07, 0.035));

    this._scene.add(this._group);
  }

  start() {
    if (this._raf || !this._canvas) return;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._t += 0.016;
      this._group.rotation.y = Math.sin(this._t * 0.5) * 0.4 + 0.3;
      const swing = Math.sin(this._t * 1.2) * 0.15;
      this._leftArm.rotation.x  =  swing;
      this._rightArm.rotation.x = -swing;
      this._leftLeg.rotation.x  = -swing;
      this._rightLeg.rotation.x =  swing;
      this._renderer.render(this._scene, this._camera);
    };
    loop();
  }

  stop() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  dispose() {
    this.stop();
    this._renderer.dispose();
  }
}
