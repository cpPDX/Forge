import * as THREE from 'three';
import { DAY_MS } from '../utils/constants.js';

const SKY = [
  { t: 0.00, sky: 0x050a1a, fog: 0x050a1a, amb: 0.05 },
  { t: 0.20, sky: 0x050a1a, fog: 0x050a1a, amb: 0.05 },
  { t: 0.25, sky: 0xf5a050, fog: 0xd08840, amb: 0.35 },
  { t: 0.30, sky: 0x87ceeb, fog: 0xbbd8f0, amb: 0.70 },
  { t: 0.50, sky: 0x87ceeb, fog: 0xc8e8ff, amb: 1.00 },
  { t: 0.70, sky: 0x87ceeb, fog: 0xbbd8f0, amb: 0.70 },
  { t: 0.75, sky: 0xf08030, fog: 0xd07828, amb: 0.35 },
  { t: 0.80, sky: 0x050a1a, fog: 0x050a1a, amb: 0.05 },
  { t: 1.00, sky: 0x050a1a, fog: 0x050a1a, amb: 0.05 },
];

function lerpHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16 | g << 8 | bl) >>> 0;
}

function sampleSky(dayFrac) {
  for (let i = 1; i < SKY.length; i++) {
    if (dayFrac <= SKY[i].t) {
      const prev = SKY[i - 1], next = SKY[i];
      const f = (dayFrac - prev.t) / (next.t - prev.t);
      return {
        sky: lerpHex(prev.sky, next.sky, f),
        fog: lerpHex(prev.fog, next.fog, f),
        amb: prev.amb + (next.amb - prev.amb) * f,
      };
    }
  }
  return { sky: 0x87ceeb, fog: 0xc8e8ff, amb: 1.0 };
}

export class TimeSystem {
  constructor() {
    this._elapsed = DAY_MS * 0.35; // start mid-morning
    this.dayFrac  = 0.35;
  }

  update(dt) {
    this._elapsed += dt * 1000;
    this.dayFrac = (this._elapsed % DAY_MS) / DAY_MS;
  }

  applyToScene(scene, renderer, ambientLight, sunLight) {
    const { sky, fog, amb } = sampleSky(this.dayFrac);
    renderer.setClearColor(sky);
    if (scene.fog) scene.fog.color.setHex(fog);
    ambientLight.intensity = amb * 0.6;

    const angle = this.dayFrac * Math.PI * 2 - Math.PI / 2;
    sunLight.position.set(Math.cos(angle) * 100, Math.sin(angle) * 100, 50);
    sunLight.intensity = Math.max(0, Math.sin(angle + Math.PI / 2));
  }

  get isDay() { return this.dayFrac > 0.25 && this.dayFrac < 0.75; }

  get hourString() {
    const h = Math.floor(this.dayFrac * 24);
    const m = Math.floor((this.dayFrac * 24 - h) * 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  serialize() { return { elapsed: this._elapsed }; }
  load(data)  { if (data?.elapsed != null) this._elapsed = data.elapsed; }
}
