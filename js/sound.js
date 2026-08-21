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

// M6: a warm little purr for the "breed card" celebration when a cat
// type's affection first reaches its threshold — a happy payoff, so
// deliberately the opposite of playPawTap's understated mischief-boop.
// Purring is naturally a slow amplitude wobble on a low tone, so this
// is classic AM synthesis: a low carrier tone whose volume is wobbled
// by a second, much-slower oscillator (~26Hz is in real cats' typical
// purr-rate range) connected straight into the gain param.
export function playPurr() {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const duration = 1.1;

  const carrier = audioCtx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(110, now);
  carrier.frequency.linearRampToValueAtTime(150, now + duration); // happy little upward glide

  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(26, now);

  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 0.08; // wobble depth — kept small so it doesn't dip negative

  const outGain = audioCtx.createGain();
  outGain.gain.setValueAtTime(0.0001, now);
  outGain.gain.linearRampToValueAtTime(0.22, now + 0.18);
  outGain.gain.setValueAtTime(0.22, now + duration - 0.35);
  outGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  lfo.connect(lfoGain);
  lfoGain.connect(outGain.gain); // modulates the gain -> purr-like tremolo
  carrier.connect(outGain);
  outGain.connect(audioCtx.destination);

  carrier.start(now);
  lfo.start(now);
  carrier.stop(now + duration + 0.05);
  lfo.stop(now + duration + 0.05);
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
