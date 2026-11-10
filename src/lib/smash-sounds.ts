/**
 * Cartoon sound effects for Stress Smash, made on the fly with Web Audio, so
 * there are no sound files to download. On the web only; elsewhere they're
 * silent (the phone gives a little buzz instead).
 */

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let out: GainNode | null = null;

function audio(): { a: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) {
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = 0.6;
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return out ? { a: ctx, out } : null;
  } catch {
    return null;
  }
}

function tone(type: OscillatorType, from: number, to: number, start: number, dur: number, gain: number) {
  const s = audio();
  if (!s) return;
  const { a } = s;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(s.out);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(filter: BiquadFilterType, from: number, to: number, start: number, dur: number, gain: number) {
  const s = audio();
  if (!s) return;
  const { a } = s;
  const t = a.currentTime + start;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(s.out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  /** Call from a tap, so the browser lets sound play. */
  unlock() {
    audio();
  },
  whoosh() {
    noise('bandpass', 400, 2200, 0, 0.16, 0.35);
  },
  /** A squeaky toy-hammer bonk. */
  bonk(big = false) {
    tone('triangle', big ? 520 : 640, 70, 0, big ? 0.32 : 0.22, big ? 0.8 : 0.6);
    noise('lowpass', 1400, 200, 0, 0.08, big ? 0.7 : 0.5);
    tone('sine', 1500, 2700, 0.01, 0.09, 0.14);
  },
  boing() {
    const s = audio();
    if (!s) return;
    const { a } = s;
    const t = a.currentTime;
    const o = a.createOscillator();
    const lfo = a.createOscillator();
    const depth = a.createGain();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(460, t + 0.45);
    lfo.frequency.value = 16;
    depth.gain.setValueAtTime(60, t);
    depth.gain.exponentialRampToValueAtTime(1, t + 0.45);
    lfo.connect(depth).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(s.out);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.55);
    lfo.stop(t + 0.55);
  },
  /** A happy little "ta-da". */
  tada() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f * 1.01, i * 0.09, 0.22, 0.28));
  },
};
