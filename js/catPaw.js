// catPaw.js — M4's "cat paw" mischief gimmick. On a random, infrequent
// timer (driven from main.js), nudges one already-locked block
// sideways by 1-2 columns.
//
// Split into plan/apply rather than one mutating call: main.js runs a
// short "paw reaches in, drags the block, retreats" animation between
// the two, so the shift never appears to teleport (see main.js's
// pawAnim state machine). applyPawSwipe re-checks the plan is still
// valid at the moment it actually runs, since the board can legally
// change underneath a pending plan (a normal line clear during the
// ~0.5s animation window would shift everything above it).
//
// Safety guarantees (per README: never a game-over-causing "gotcha"):
// - Only ever reads/writes `board` — the falling piece isn't passed
//   in, so it physically cannot touch it.
// - Only considers rows at y >= config.safeTopRows. A shift's source
//   and destination are always in the same row, so this one bound is
//   enough to keep the piece-spawn buffer untouched.
// - A shift only happens if the destination cell is confirmed empty;
//   it never overwrites another locked cell.

import { isCellLocked, isCellEmpty } from './board.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findShift(board, x, y, cols) {
  const distances = shuffle([1, 2]);
  const directions = shuffle([-1, 1]);
  for (const distance of distances) {
    for (const direction of directions) {
      const toX = x + direction * distance;
      if (toX < 0 || toX >= cols) continue;
      if (!isCellEmpty(board, toX, y)) continue;
      return { y, fromX: x, toX, type: board[y][x].type };
    }
  }
  return null;
}

// Picks one locked cell at random (outside the spawn buffer) and a
// valid 1-2 column slide for it, WITHOUT mutating the board. Returns
// { y, fromX, toX, type } on success, or null if nothing safe to do
// this cycle.
export function planPawSwipe(board, config) {
  const rows = board.length;
  const cols = board[0].length;
  const safeTopRows = config.safeTopRows;

  const rowChoices = shuffle(Array.from({ length: rows - safeTopRows }, (_, i) => i + safeTopRows));

  for (const y of rowChoices) {
    const lockedXs = shuffle(
      Array.from({ length: cols }, (_, x) => x).filter((x) => isCellLocked(board, x, y))
    );
    for (const x of lockedXs) {
      const plan = findShift(board, x, y, cols);
      if (plan) return plan;
    }
  }
  return null;
}

// Applies a previously-planned shift, re-validating it against the
// current board first (normal gameplay may have changed things during
// the animation that ran between plan and apply). Returns true if the
// shift actually happened, false if it was silently skipped because
// it's no longer valid.
export function applyPawSwipe(board, plan) {
  const { y, fromX, toX, type } = plan;
  if (y < 0 || y >= board.length) return false;
  if (!isCellLocked(board, fromX, y) || board[y][fromX].type !== type) return false;
  if (!isCellEmpty(board, toX, y)) return false;

  board[y][toX] = { type, skin: 'default' };
  board[y][fromX] = null;
  return true;
}
