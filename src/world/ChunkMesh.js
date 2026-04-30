import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT, B } from '../utils/constants.js';
import { BlockRegistry } from '../blocks/BlockRegistry.js';
import { tileUV } from '../blocks/TextureAtlas.js';

// Face definitions — vertex order is CCW when viewed from outside (Three.js FrontSide default).
// Pattern per face: BL→BR→TR→TL in screen-space.
// UV: V=1 at block bottom (dirt), V=0 at block top (green band) for side faces.
const FACES = [
  // +X (east)  — looking from +X: screen-right = -Z
  { dir:[1,0,0],  norm:[1,0,0],  fi:0,
    verts:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]] },
  // -X (west)  — looking from -X: screen-right = +Z
  { dir:[-1,0,0], norm:[-1,0,0], fi:1,
    verts:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]] },
  // +Y (top)   — looking from above: screen-right = +X, up = -Z
  { dir:[0,1,0],  norm:[0,1,0],  fi:2,
    verts:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
    uvs:  [[0,0],[1,0],[1,1],[0,1]] },
  // -Y (bottom)— looking from below: screen-right = -X, up = -Z
  { dir:[0,-1,0], norm:[0,-1,0], fi:3,
    verts:[[1,0,1],[0,0,1],[0,0,0],[1,0,0]],
    uvs:  [[0,0],[1,0],[1,1],[0,1]] },
  // +Z (south) — looking from +Z: screen-right = +X
  { dir:[0,0,1],  norm:[0,0,1],  fi:4,
    verts:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]] },
  // -Z (north) — looking from -Z: screen-right = -X
  { dir:[0,0,-1], norm:[0,0,-1], fi:5,
    verts:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],
    uvs:  [[0,1],[1,1],[1,0],[0,0]] },
];

export class ChunkMesh {
  constructor(scene, atlas) {
    this._scene  = scene;
    this._atlas  = atlas;
    this._meshes = new Map(); // key → { solid, transparent }
  }

  // Build or rebuild the mesh for chunk (cx,cz)
  update(cx, cz, world) {
    this._dispose(cx, cz);

    const { solid, transparent } = this._build(cx, cz, world);

    const key = `${cx},${cz}`;
    const objs = {};

    if (solid) {
      const mat = new THREE.MeshLambertMaterial({ map: this._atlas.texture, side: THREE.FrontSide });
      const mesh = new THREE.Mesh(solid, mat);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      this._scene.add(mesh);
      objs.solid = mesh;
    }
    if (transparent) {
      const mat = new THREE.MeshLambertMaterial({
        map: this._atlas.texture, side: THREE.DoubleSide,
        transparent: true, alphaTest: 0.1, depthWrite: false,
      });
      const mesh = new THREE.Mesh(transparent, mat);
      mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      this._scene.add(mesh);
      objs.transparent = mesh;
    }

    this._meshes.set(key, objs);
  }

  _dispose(cx, cz) {
    const key = `${cx},${cz}`;
    const objs = this._meshes.get(key);
    if (!objs) return;
    for (const mesh of Object.values(objs)) {
      this._scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this._meshes.delete(key);
  }

  disposeAll() {
    for (const [k] of this._meshes) {
      const [cx, cz] = k.split(',').map(Number);
      this._dispose(cx, cz);
    }
  }

  _build(cx, cz, world) {
    // Opaque buffers
    const sp = [], sn = [], su = [], si = [];
    // Transparent buffers
    const tp = [], tn = [], tu = [], ti = [];
    let sv = 0, tv = 0;

    const bx0 = cx * CHUNK_SIZE, bz0 = cz * CHUNK_SIZE;
    const { COLS, ROWS } = this._atlas;

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const wx = bx0 + lx, wz = bz0 + lz;
          const id = world.getBlock(wx, ly, wz);
          if (id === B.AIR) continue;

          const def = BlockRegistry.get(id);
          if (!def) continue;
          const isTransp = def.transparent;

          for (const face of FACES) {
            const nx = wx + face.dir[0];
            const ny = ly + face.dir[1];
            const nz = wz + face.dir[2];
            const nid = world.getBlock(nx, ny, nz);

            // Skip face if neighbor is the same fluid (water-water, etc.)
            if (def.fluid && nid === id) continue;
            // Skip if neighbor is fully opaque
            if (!BlockRegistry.isTransparent(nid)) continue;
            // For transparent blocks, also skip if neighbor is same type
            if (isTransp && !def.fluid && nid === id) continue;

            const texIdx = def.faces[face.fi];
            const uv = tileUV(texIdx, COLS, ROWS);

            const P = isTransp ? tp : sp;
            const N = isTransp ? tn : sn;
            const U = isTransp ? tu : su;
            const I = isTransp ? ti : si;
            const base = isTransp ? tv : sv;

            for (let vi = 0; vi < 4; vi++) {
              const [ox,oy,oz] = face.verts[vi];
              P.push(lx+ox, ly+oy, lz+oz);
              N.push(...face.norm);
              // Map face UV [0..1] to atlas UV
              const [fu, fv] = face.uvs[vi];
              U.push(
                uv.u0 + fu * (uv.u1 - uv.u0),
                uv.v0 + fv * (uv.v1 - uv.v0),
              );
            }
            I.push(base, base+1, base+2, base, base+2, base+3);
            if (isTransp) tv += 4; else sv += 4;
          }
        }
      }
    }

    const makeGeo = (P, N, U, I) => {
      if (I.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal',   new THREE.Float32BufferAttribute(N, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(U, 2));
      geo.setIndex(I);
      return geo;
    };

    return {
      solid:       makeGeo(sp, sn, su, si),
      transparent: makeGeo(tp, tn, tu, ti),
    };
  }

  hasMesh(cx, cz) { return this._meshes.has(`${cx},${cz}`); }
}
