// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeValueNoise2D(seed) {
  const rng = mulberry32(seed);
  const SIZE = 512;
  const table = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < table.length; i++) table[i] = rng() * 2 - 1;

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function idx(x, y) { return ((x & (SIZE - 1)) * SIZE + (y & (SIZE - 1))); }

  return function noise(x, y) {
    const xi = Math.floor(x), xf = x - xi;
    const yi = Math.floor(y), yf = y - yi;
    const a = table[idx(xi,   yi  )];
    const b = table[idx(xi+1, yi  )];
    const c = table[idx(xi,   yi+1)];
    const d = table[idx(xi+1, yi+1)];
    return lerp(lerp(a, b, fade(xf)), lerp(c, d, fade(xf)), fade(yf));
  };
}

function makeValueNoise3D(seed) {
  const rng = mulberry32(seed);
  const SIZE = 64;
  const table = new Float32Array(SIZE * SIZE * SIZE);
  for (let i = 0; i < table.length; i++) table[i] = rng() * 2 - 1;

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function idx(x, y, z) {
    return ((x & (SIZE-1)) * SIZE * SIZE + (y & (SIZE-1)) * SIZE + (z & (SIZE-1)));
  }

  return function noise(x, y, z) {
    const xi = Math.floor(x), xf = x - xi;
    const yi = Math.floor(y), yf = y - yi;
    const zi = Math.floor(z), zf = z - zi;
    const fx = fade(xf), fy = fade(yf), fz = fade(zf);
    const a = lerp(table[idx(xi,yi,zi)],   table[idx(xi+1,yi,zi)],   fx);
    const b = lerp(table[idx(xi,yi+1,zi)], table[idx(xi+1,yi+1,zi)], fx);
    const c = lerp(table[idx(xi,yi,zi+1)], table[idx(xi+1,yi,zi+1)], fx);
    const d = lerp(table[idx(xi,yi+1,zi+1)],table[idx(xi+1,yi+1,zi+1)],fx);
    return lerp(lerp(a,b,fy), lerp(c,d,fy), fz);
  };
}

export function makeFBM2D(seed, octaves = 5) {
  const ns = [];
  for (let i = 0; i < octaves; i++) ns.push(makeValueNoise2D(seed + i * 9371));
  return function fbm(x, y) {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      v += ns[i](x * freq, y * freq) * amp;
      max += amp; amp *= 0.5; freq *= 2;
    }
    return v / max;
  };
}

export function makeFBM3D(seed, octaves = 3) {
  const ns = [];
  for (let i = 0; i < octaves; i++) ns.push(makeValueNoise3D(seed + i * 7919));
  return function fbm(x, y, z) {
    let v = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      v += ns[i](x * freq, y * freq, z * freq) * amp;
      max += amp; amp *= 0.5; freq *= 2;
    }
    return v / max;
  };
}
