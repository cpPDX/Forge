import { DAY_DURATION, TIME } from '../utils/constants.js';

const SKY_COLORS = [
  { t: 0,          color: [5, 5, 20] },       // midnight
  { t: TIME.DAWN,  color: [30, 15, 50] },      // pre-dawn
  { t: TIME.DAY,   color: [100, 160, 255] },   // day
  { t: TIME.DUSK,  color: [255, 120, 60] },    // dusk
  { t: TIME.NIGHT, color: [5, 5, 20] },        // night
  { t: 1,          color: [5, 5, 20] },
];

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function toHex(rgb) {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

export class TimeSystem {
  constructor(initialTime = 0.35) {
    this.t = initialTime; // 0=midnight, 0.5=noon
  }

  update(delta) {
    this.t = (this.t + delta / DAY_DURATION) % 1;
  }

  get isDay()   { return this.t >= TIME.DAY  && this.t < TIME.DUSK; }
  get isNight() { return this.t >= TIME.NIGHT || this.t < TIME.DAWN; }
  get isDawn()  { return this.t >= TIME.DAWN  && this.t < TIME.DAY; }
  get isDusk()  { return this.t >= TIME.DUSK  && this.t < TIME.NIGHT; }

  get ambientLight() {
    if (this.isDay)   return 1.0;
    if (this.isNight) return 0.12;
    if (this.isDawn) {
      const p = (this.t - TIME.DAWN) / (TIME.DAY - TIME.DAWN);
      return 0.12 + p * 0.88;
    }
    const p = (this.t - TIME.DUSK) / (TIME.NIGHT - TIME.DUSK);
    return 1.0 - p * 0.88;
  }

  get skyColor() {
    const t = this.t;
    for (let i = 0; i < SKY_COLORS.length - 1; i++) {
      const a = SKY_COLORS[i], b = SKY_COLORS[i + 1];
      if (t >= a.t && t <= b.t) {
        const p = (t - a.t) / (b.t - a.t);
        return toHex(lerpColor(a.color, b.color, p));
      }
    }
    return '#050514';
  }

  get hourString() {
    const totalMinutes = Math.floor(this.t * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  serialize() { return { t: this.t }; }
  deserialize(d) { if (d?.t !== undefined) this.t = d.t; }
}
