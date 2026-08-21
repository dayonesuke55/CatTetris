// sessionMilestones.js — M7 follow-up: "single-game" breed milestones,
// distinct from affection.js's cumulative, cross-game count. These
// unlock only if a breed's lines are cleared enough times within one
// continuous game (state.sessionCounts, reset every resetState() —
// see main.js), checked against piece.js's SESSION_MILESTONE_COUNTS.
// Once earned in any one game, the unlock itself is permanent — that
// part *does* persist across games/restarts (like affection and the
// high score), it's only the counter driving new unlocks that's
// per-game.

import { PIECE_TYPES, SESSION_MILESTONE_COUNTS } from './piece.js';

const UNLOCKS_KEY = 'cattetris-session-milestones';

function emptyUnlocks() {
  const unlocks = {};
  PIECE_TYPES.forEach((type) => {
    unlocks[type] = SESSION_MILESTONE_COUNTS.map(() => false);
  });
  return unlocks;
}

// Same defensive load/save pattern as affection.js/high score — a
// storage failure just means these achievements won't persist this
// time, not a crash.
export function loadSessionUnlocks() {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY);
    if (!raw) return emptyUnlocks();
    const parsed = JSON.parse(raw);
    const unlocks = emptyUnlocks();
    PIECE_TYPES.forEach((type) => {
      const arr = parsed[type];
      if (Array.isArray(arr)) {
        unlocks[type] = SESSION_MILESTONE_COUNTS.map((_, i) => Boolean(arr[i]));
      }
    });
    return unlocks;
  } catch {
    return emptyUnlocks();
  }
}

export function saveSessionUnlocks(unlocks) {
  try {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
  } catch {
    // non-critical — see affection.js's saveAffection.
  }
}

// Per-game counter, never persisted itself — only what it *unlocks*
// sticks around. Reset by main.js's resetState() on every new game.
export function emptySessionCounts() {
  const counts = {};
  PIECE_TYPES.forEach((type) => {
    counts[type] = 0;
  });
  return counts;
}

// Mirrors affection.js's recordLineClear: each type present in a
// cleared row counts once per row, regardless of how many of that
// row's cells are that type. Must run before clearRows() mutates the
// board, same as recordLineClear. Mutates `counts` in place and
// returns it for convenience.
export function recordSessionLineClear(counts, board, rowIndices) {
  rowIndices.forEach((y) => {
    const typesInRow = new Set(board[y].map((cell) => cell?.type).filter(Boolean));
    typesInRow.forEach((type) => {
      counts[type] = (counts[type] ?? 0) + 1;
    });
  });
  return counts;
}

// Checks `counts` (this game's per-type tally) against
// SESSION_MILESTONE_COUNTS and flips on any tier newly reached in
// `unlocks`, mutating it in place. Returns true if anything changed
// (so the caller knows whether to persist), so it also naturally
// no-ops on games where nothing new is crossed.
export function updateSessionUnlocks(counts, unlocks) {
  let changed = false;
  PIECE_TYPES.forEach((type) => {
    const count = counts[type] ?? 0;
    SESSION_MILESTONE_COUNTS.forEach((threshold, i) => {
      if (count >= threshold && !unlocks[type][i]) {
        unlocks[type][i] = true;
        changed = true;
      }
    });
  });
  return changed;
}
