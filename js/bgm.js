// bgm.js — M9's BGM volume level persistence, same localStorage
// pattern as stats.js/affection.js. The actual <audio> elements and
// title/game playback switching live in main.js alongside the rest of
// the title/game screen wiring — this module is just the one bit of
// state that needs to survive across sessions.

// One "off" step plus 3 audible steps (rather than a slider) — a click-
// to-cycle button matches the minimal, no-slider UI everywhere else in
// this project (see the M8 title buttons, the collection/records
// overlays' close buttons, etc.).
export const BGM_VOLUME_LEVELS = [0, 0.25, 0.55, 0.85];
export const BGM_VOLUME_ICONS = ['🔇', '🔈', '🔉', '🔊'];

const VOLUME_KEY = 'cattetris-bgm-volume-level';

// Defaults to index 2 ("mid", ~the fixed 0.5 this game shipped with
// before per-level volume existed) rather than max, so a first-time
// player's BGM isn't unexpectedly louder than before.
const DEFAULT_LEVEL = 2;

export function loadBgmVolumeLevel() {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    // Number(null) is 0, not NaN — a missing key must be checked for
    // explicitly, or "never saved yet" gets silently mistaken for a
    // saved level 0 (off) instead of falling through to DEFAULT_LEVEL.
    if (stored === null) return DEFAULT_LEVEL;
    const raw = Number(stored);
    if (Number.isInteger(raw) && raw >= 0 && raw < BGM_VOLUME_LEVELS.length) return raw;
    return DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

export function saveBgmVolumeLevel(level) {
  try {
    localStorage.setItem(VOLUME_KEY, String(level));
  } catch {
    // non-critical — volume preference just won't persist this time.
  }
}
