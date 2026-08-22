// stats.js — M8 title screen's "これまでの記録" (records) view. Simple
// cumulative play stats that persist across games (via localStorage,
// same pattern as main.js's high score and affection.js's affection),
// rather than resetting per-run.

const STORAGE_KEY = 'cattetris-stats';

function emptyStats() {
  return { gamesPlayed: 0, linesCleared: 0 };
}

// localStorage can throw (privacy mode, disabled storage, etc.) — same
// defensive pattern as main.js's high-score load/save.
export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    const stats = emptyStats();
    if (Number.isFinite(parsed.gamesPlayed)) stats.gamesPlayed = parsed.gamesPlayed;
    if (Number.isFinite(parsed.linesCleared)) stats.linesCleared = parsed.linesCleared;
    return stats;
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // non-critical — stats just won't persist this time.
  }
}
