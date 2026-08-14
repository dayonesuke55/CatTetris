// sound.js — small sound effects synthesized on the fly via the Web
// Audio API. No audio files: same "no external assets" reasoning as
// renderer.js's procedural cat blocks, and it keeps the project's
// zero-build, zero-dependency static-site setup intact.

let ctx = null;

function getContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null; // very old / unsupported browser
  if (!ctx) ctx = new AudioCtx();
  // Browsers start an AudioContext suspended until a user gesture.
  // Every call site here is reached from a keydown/click handler (or
  // a game-loop tick shortly after one), so resuming is always safe.
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A short "nya" — pitch rises then dips, like a little cat cry.
// `intensity` (lines cleared at once, 1-4) scales pitch/volume/length
// so a Tetris feels more triumphant than a single line.
export function playMeow(intensity = 1) {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const duration = 0.28 + intensity * 0.03;
  const baseFreq = 520 + intensity * 40;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.frequency.setValueAtTime(baseFreq * 0.7, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 1.35, now + duration * 0.35);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, now + duration);

  const peakVolume = Math.min(0.25 + intensity * 0.05, 0.45);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peakVolume, now + duration * 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

// A soft, low "boop" for the M4 cat-paw gimmick nudging a block —
// deliberately understated (this is mischief, not an achievement).
export function playPawTap() {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const duration = 0.16;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.frequency.setValueAtTime(210, now);
  osc.frequency.exponentialRampToValueAtTime(105, now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}
