// catPaw.js — M4's "cat paw" mischief gimmick. On a random, infrequent
// timer (driven from main.js), nudges one already-locked block
// sideways by 1-2 columns.
//
// Safety guarantees (per README: never a game-over-causing "gotcha"):
// - Only ever reads/writes `board` — the falling piece isn't passed
//   in, so it physically cannot touch it.
// - Only considers rows at y >= config.safeTopRows. A shift's source
//   and destination are always in the same row, so this one bound is
//   enough to keep the piece-spawn buffer untouched.
// - A shift only happens if the destination cell is empty and in
//   bounds; it never overwrites another locked cell.

import { isCellLocked, isCellEmpty } from './board.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tryShiftCell(board, x, y, cols) {
  const distances = shuffle([1, 2]);
  const directions = shuffle([-1, 1]);
  for (const distance of distances) {
    for (const direction of directions) {
      const toX = x + direction * distance;
      if (toX < 0 || toX >= cols) continue;
      if (!isCellEmpty(board, toX, y)) continue;
      const cell = board[y][x];
      board[y][toX] = cell;
      board[y][x] = null;
      return { y, fromX: x, toX, type: cell.type };
    }
  }
  return null;
}

// Picks one locked cell at random (outside the spawn buffer) and
// slides it 1-2 columns sideways into an empty neighbor. Returns
// { y, fromX, toX, type } on success, or null if nothing safe to do
// this cycle (e.g. the picked area happened to be empty, or every
// candidate cell's neighbors were all occupied/out of bounds).
export function tryPawSwipe(board, config) {
  const rows = board.length;
  const cols = board[0].length;
  const safeTopRows = config.safeTopRows;

  const rowChoices = shuffle(Array.from({ length: rows - safeTopRows }, (_, i) => i + safeTopRows));

  for (const y of rowChoices) {
    const lockedXs = shuffle(
      Array.from({ length: cols }, (_, x) => x).filter((x) => isCellLocked(board, x, y))
    );
    for (const x of lockedXs) {
      const result = tryShiftCell(board, x, y, cols);
      if (result) return result;
    }
  }
  return null;
}
