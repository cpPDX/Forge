import * as THREE from 'three';

export class PlayerPreview {
  constructor(canvas) {
    if (!canvas) return;
    this._canvas = canvas;
    this._renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    this._renderer.setSize(64, 96, false); // false = don't override CSS with inline styles
    this._renderer.setClearColor(0x000000, 0);

    this._scene  = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(40, 64 / 96, 0.1, 20);
    this._camera.position.set(0, 1.2, 3.2);
    this._camera.lookAt(0, 1.0, 0);

    this._scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff8e0, 0.8);
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
    const SKIN = 0xc8a070;
    const SHIRT= 0x3daaaa;
    const PANT = 0x22449a;
    const SHOE = 0x553322;

    this._group = new THREE.Group();

    // head with Steve face texture on front
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headFaceTex = this._makeSteveFaceTex();
    const skinMat = new THREE.MeshLambertMaterial({ color: SKIN });
    const headMats = [skinMat, skinMat, skinMat, skinMat,
      new THREE.MeshLambertMaterial({ map: headFaceTex }), skinMat];
    const head = new THREE.Mesh(headGeo, headMats);
    head.position.set(0, 1.75, 0);
    this._group.add(head);

    // torso
    this._group.add(this._box(0.5, 0.75, 0.25, SHIRT, 0, 1.125, 0));

    // arms
    this._leftArm  = this._box(0.25, 0.65, 0.25, SKIN,  0.375, 1.15, 0);
    this._rightArm = this._box(0.25, 0.65, 0.25, SKIN, -0.375, 1.15, 0);
    this._group.add(this._leftArm, this._rightArm);

    // legs
    this._leftLeg  = this._box(0.25, 0.75, 0.25, PANT,  0.125, 0.375, 0);
    this._rightLeg = this._box(0.25, 0.75, 0.25, PANT, -0.125, 0.375, 0);
    this._group.add(this._leftLeg, this._rightLeg);

    // feet
    this._group.add(this._box(0.25, 0.12, 0.3, SHOE,  0.125, 0.06, 0.025));
    this._group.add(this._box(0.25, 0.12, 0.3, SHOE, -0.125, 0.06, 0.025));

    this._scene.add(this._group);
  }

  _makeSteveFaceTex() {
    const c   = document.createElement('canvas');
    c.width   = 16; c.height = 16;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#c8a070';
    ctx.fillRect(0, 0, 16, 16);

    // eyes
    ctx.fillStyle = '#3d2b1e';
    ctx.fillRect(3, 5, 3, 2);
    ctx.fillRect(10, 5, 3, 2);
    // whites
    ctx.fillStyle = '#eeeecc';
    ctx.fillRect(4, 5, 2, 2);
    ctx.fillRect(11, 5, 2, 2);
    // pupils
    ctx.fillStyle = '#111111';
    ctx.fillRect(5, 6, 1, 1);
    ctx.fillRect(12, 6, 1, 1);

    // nose
    ctx.fillStyle = '#b07850';
    ctx.fillRect(7, 7, 2, 2);

    // mouth
    ctx.fillStyle = '#6a3a2a';
    ctx.fillRect(5, 10, 6, 1);
    ctx.fillRect(5, 11, 1, 1);
    ctx.fillRect(10, 11, 1, 1);

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  start() {
    if (this._raf || !this._canvas) return;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this._t += 0.016;
      this._group.rotation.y = Math.sin(this._t * 0.5) * 0.4 + 0.3;
      // subtle idle arm swing
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
