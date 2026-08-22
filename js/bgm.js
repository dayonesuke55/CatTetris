// bgm.js — M9's BGM mute preference persistence, same localStorage
// pattern as stats.js/affection.js. The actual <audio> elements and
// title/game playback switching live in main.js alongside the rest of
// the title/game screen wiring — this module is just the one bit of
// state that needs to survive across sessions.

const MUTE_KEY = 'cattetris-bgm-muted';

export function loadBgmMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveBgmMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    // non-critical — mute preference just won't persist this time.
  }
}
