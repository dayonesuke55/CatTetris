// board.js — board grid state, collision checks, and line clearing.
//
// The grid is the single source of truth for locked cells. Other modules
// (renderer, and later catPaw.js) must go through these exported functions
// rather than reaching into a board's internals directly — that's what
// keeps the cat-paw gimmick (M4) and future collection features
// decoupled from this core module.

export function createBoard(cols, rows) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

// `cells` is an array of {x, y} absolute board coordinates. Returns true
// only if every cell is inside the board and unoccupied.
export function isValidPosition(board, cells) {
  const rows = board.length;
  const cols = board[0].length;
  return cells.every(({ x, y }) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
    return board[y][x] === null;
  });
}

export function lockPiece(board, piece, cells) {
  cells.forEach(({ x, y }) => {
    if (y >= 0 && y < board.length && x >= 0 && x < board[0].length) {
      board[y][x] = { type: piece.type, skin: 'default' };
    }
  });
}

export function getFullRows(board) {
  const full = [];
  board.forEach((row, y) => {
    if (row.every((cell) => cell !== null)) full.push(y);
  });
  return full;
}

// Removes the given row indices and pads the top with empty rows, so the
// board keeps its original row count. Mutates `board` in place (rather
// than returning a new array) so callers holding a reference — e.g. the
// game loop's state.board — see the update automatically.
export function clearRows(board, rowIndices) {
  const cols = board[0].length;
  const rowSet = new Set(rowIndices);
  const remaining = board.filter((_, y) => !rowSet.has(y));
  const clearedCount = board.length - remaining.length;
  const freshRows = Array.from({ length: clearedCount }, () => Array(cols).fill(null));
  board.length = 0;
  board.push(...freshRows, ...remaining);
  return clearedCount;
}

export function isCellEmpty(board, x, y) {
  if (y < 0 || y >= board.length || x < 0 || x >= board[0].length) return false;
  return board[y][x] === null;
}

export function isCellLocked(board, x, y) {
  if (y < 0 || y >= board.length || x < 0 || x >= board[0].length) return false;
  return board[y][x] !== null;
}
