// affection.js — M6's "cat affection" mechanic. Each of the 7 cat
// types builds affection as the player clears lines containing it,
// persisting across games (via localStorage, like the high score)
// rather than resetting per-run — the point is a slow-building bond
// with each "breed" rather than a per-game stat. This is meant as the
// foundation a future cat-breed collection screen can unlock from
// (see README's post-MVP roadmap).

import { PIECE_TYPES } from './piece.js';
import { CONFIG } from './config.js';

const STORAGE_KEY = 'cattetris-affection';

function emptyAffection() {
  const affection = {};
  PIECE_TYPES.forEach((type) => {
    affection[type] = 0;
  });
  return affection;
}

// localStorage can throw (privacy mode, disabled storage, etc.) — same
// defensive pattern as main.js's high-score load/save.
export function loadAffection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAffection();
    const parsed = JSON.parse(raw);
    const affection = emptyAffection();
    PIECE_TYPES.forEach((type) => {
      if (Number.isFinite(parsed[type])) affection[type] = parsed[type];
    });
    return affection;
  } catch {
    return emptyAffection();
  }
}

export function saveAffection(affection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(affection));
  } catch {
    // non-critical — affection just won't persist this time.
  }
}

// Called with the board *before* clearRows() mutates it, so the
// cleared rows' cells are still there to read. Each type present in a
// cleared row gets +1, counted once per row regardless of how many
// cells of that type are in it — this tracks "how many cleared lines
// this breed helped with", not raw cell count. Mutates `affection` in
// place and returns it for convenience.
export function recordLineClear(affection, board, rowIndices) {
  rowIndices.forEach((y) => {
    const typesInRow = new Set(board[y].map((cell) => cell?.type).filter(Boolean));
    typesInRow.forEach((type) => {
      affection[type] = (affection[type] ?? 0) + 1;
    });
  });
  return affection;
}

// How many full tiers this type has completed (0, 1, 2, ...) — an
// uncapped count, not clamped to any max, since the gauge's tier-color
// palette (renderer.js) simply repeats its last color once the level
// runs past the palette's length.
export function getLevel(affection, type) {
  return Math.floor((affection[type] ?? 0) / CONFIG.affection.perLevel);
}

// How full the *current* tier's gauge is (0-1) — the count within this
// tier divided by perLevel. Lands exactly on 0 the instant a tier
// completes (see main.js, which checks getLevel() before/after a line
// clear to detect that same moment and trigger the level-up celebration).
export function getLevelProgress(affection, type) {
  return ((affection[type] ?? 0) % CONFIG.affection.perLevel) / CONFIG.affection.perLevel;
}

// M7: whether the player has "met" this breed enough to unlock its
// entry in the collection screen — reaching level 1 (one full gauge
// cycle) is enough, rather than requiring deep bonding, so the
// collection fills in steadily as a natural side effect of playing
// rather than needing separate grinding.
export function isCollected(affection, type) {
  return getLevel(affection, type) >= 1;
}
