/**
 * Sound effects synthesised via Web Audio API.
 * No external files — all tones are generated programmatically.
 * Silently fails on browsers that block AudioContext (no user gesture yet).
 */

let _ctx = null;

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(ctx, freq, t0, dur, type = 'sine', vol = 0.25) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function bustSound(ctx) {
  const t = ctx.currentTime;
  tone(ctx, 440, t,        0.12);
  tone(ctx, 300, t + 0.14, 0.18);
}

function legWinSound(ctx) {
  const t = ctx.currentTime;
  tone(ctx, 523, t,        0.12);
  tone(ctx, 659, t + 0.13, 0.12);
  tone(ctx, 784, t + 0.26, 0.28);
}

function matchWinSound(ctx) {
  const t = ctx.currentTime;
  tone(ctx, 523,  t,        0.10);
  tone(ctx, 659,  t + 0.11, 0.10);
  tone(ctx, 784,  t + 0.22, 0.10);
  tone(ctx, 659,  t + 0.33, 0.10);
  tone(ctx, 1047, t + 0.44, 0.50);
}

function oneEightySound(ctx) {
  const t   = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.linearRampToValueAtTime(900, t + 0.3);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.start(t);
  osc.stop(t + 0.4);
  tone(ctx, 880, t + 0.32, 0.22, 'sine', 0.3);
}

/**
 * Play a named sound effect.
 * @param {'bust'|'legwin'|'matchwin'|'180'} type
 */
export function playSound(type) {
  try {
    const ctx = getCtx();
    switch (type) {
      case 'bust':     bustSound(ctx);      break;
      case 'legwin':   legWinSound(ctx);    break;
      case 'matchwin': matchWinSound(ctx);  break;
      case '180':      oneEightySound(ctx); break;
    }
  } catch {
    // AudioContext unavailable or blocked — fail silently
  }
}
