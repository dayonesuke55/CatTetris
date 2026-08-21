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

// M6: each type's own base pitch for its level-up cry (playBreedCry
// below) — roughly follows the size/personality CAT_STYLES/
// BREED_PROFILES already imply (e.g. the big, gentle Maine Coon sits
// low; the famously vocal Siamese sits high), so all 7 have a
// distinct-sounding "voice" of their own.
const BREED_VOICE = {
  I: 620, // siamese — famously vocal, high
  O: 430, // british shorthair — mellow, low
  T: 520, // brown tabby — average, friendly
  S: 380, // maine coon — big, deep
  Z: 480, // scottish fold — soft, mid-low
  J: 560, // burmese — social, a bit high
  L: 500, // orange tabby — average, a touch bright
};

// Three reusable pitch-contour "shapes" rather than 21 fully bespoke
// curves — combined with each breed's own base pitch above, this still
// gives every breed 3 distinct-sounding cries (7 voices x 3 shapes).
function applyCryContour(osc, now, baseFreq, variant, duration) {
  if (variant === 0) {
    // short chirp: quick rise then a settle back down
    osc.frequency.setValueAtTime(baseFreq * 0.85, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.2, now + duration * 0.3);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + duration);
  } else if (variant === 1) {
    // rising mew: climbs the whole way through
    osc.frequency.setValueAtTime(baseFreq * 0.7, now);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.3, now + duration);
  } else {
    // descending mew: starts high, drifts back down
    osc.frequency.setValueAtTime(baseFreq * 1.25, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + duration);
  }
}

// M6: a level-up cry for `type` — one of 3 variants picked at random,
// so the same breed doesn't sound identical every time it levels up.
// The happy payoff for the affection gauge filling (every
// CONFIG.affection.perLevel line clears involving that breed).
export function playBreedCry(type) {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const duration = 0.32;
  const baseFreq = BREED_VOICE[type] ?? 500;
  const variant = Math.floor(Math.random() * 3);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  applyCryContour(osc, now, baseFreq, variant, duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.3, now + duration * 0.15);
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
