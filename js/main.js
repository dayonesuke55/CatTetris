// main.js — entry point and game loop.
//
// M1 scope: falling piece + controls + locking + spawning, plus line
// clearing and scoring. M2 adds the game-over restart flow (see
// resetState/onRestart below).

import { CONFIG } from './config.js';
import { createBoard, isValidPosition, lockPiece, getFullRows, clearRows } from './board.js';
import { makePieceQueue, getCells, getRotatedCells } from './piece.js';
import { drawBoard, drawPiece, drawNext, drawGameOver } from './renderer.js';
import { bindInput } from './input.js';

const boardCanvas = document.getElementById('board-canvas');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');

// Reassigned on restart so a new game gets a fresh 7-bag sequence
// rather than continuing the previous game's bag.
let queue = makePieceQueue();

const state = {
  board: createBoard(CONFIG.COLS, CONFIG.ROWS),
  current: queue.next(),
  next: queue.next(),
  dropTimer: 0,
  dropInterval: CONFIG.INITIAL_DROP_MS,
  score: 0,
  gameOver: false,
};

// Puts state back to a fresh game. Only meaningful while gameOver is
// true — see onRestart below.
function resetState() {
  queue = makePieceQueue();
  state.board = createBoard(CONFIG.COLS, CONFIG.ROWS);
  state.current = queue.next();
  state.next = queue.next();
  state.dropTimer = 0;
  state.dropInterval = CONFIG.INITIAL_DROP_MS;
  state.score = 0;
  state.gameOver = false;
}

function tryMove(dx, dy) {
  if (state.gameOver) return false;
  const moved = { ...state.current, x: state.current.x + dx, y: state.current.y + dy };
  if (isValidPosition(state.board, getCells(moved))) {
    state.current = moved;
    return true;
  }
  return false;
}

function tryRotate(dir) {
  if (state.gameOver) return;
  const { rotation, cells } = getRotatedCells(state.current, dir);
  if (isValidPosition(state.board, cells)) {
    state.current = { ...state.current, rotation };
    return;
  }
  // Simple wall kick: nudge sideways and retry before giving up.
  for (const kick of [-1, 1, -2, 2]) {
    const kicked = cells.map((c) => ({ x: c.x + kick, y: c.y }));
    if (isValidPosition(state.board, kicked)) {
      state.current = { ...state.current, rotation, x: state.current.x + kick };
      return;
    }
  }
}

function spawnNext() {
  state.current = state.next;
  state.next = queue.next();
  if (!isValidPosition(state.board, getCells(state.current))) {
    // Board is full where the new piece needs to appear — game over.
    // Player restarts via resetState() (bound to the R key).
    state.gameOver = true;
  }
}

function lockCurrentPiece() {
  lockPiece(state.board, state.current, getCells(state.current));

  const fullRows = getFullRows(state.board);
  if (fullRows.length > 0) {
    clearRows(state.board, fullRows);
    state.score += CONFIG.LINE_SCORES[fullRows.length] ?? 0;
  }

  spawnNext();
}

function softDropTick() {
  if (state.gameOver) return;
  if (!tryMove(0, 1)) {
    lockCurrentPiece();
  }
}

function hardDrop() {
  if (state.gameOver) return;
  while (tryMove(0, 1)) {
    // keep dropping until it lands
  }
  lockCurrentPiece();
}

bindInput({
  onMoveLeft: () => tryMove(-1, 0),
  onMoveRight: () => tryMove(1, 0),
  onSoftDrop: () => softDropTick(),
  onRotate: () => tryRotate(1),
  onHardDrop: () => hardDrop(),
  onRestart: () => {
    if (state.gameOver) resetState();
  },
});

let lastTime = null;
function loop(timestamp) {
  if (lastTime === null) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (!state.gameOver) {
    state.dropTimer += dt;
    if (state.dropTimer >= state.dropInterval) {
      state.dropTimer = 0;
      softDropTick();
    }
  }

  drawBoard(boardCtx, state.board);
  drawPiece(boardCtx, state.current);
  drawNext(nextCtx, state.next);
  scoreEl.textContent = `Score: ${state.score}`;
  if (state.gameOver) drawGameOver(boardCtx);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
