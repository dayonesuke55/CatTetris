// main.js — entry point and game loop.
//
// M1 scope: falling piece + controls + locking + spawning, plus line
// clearing and scoring. M2 adds the game-over restart flow (see
// resetState/onRestart below).

import { CONFIG } from './config.js';
import { createBoard, isValidPosition, lockPiece, getFullRows, clearRows } from './board.js';
import { makePieceQueue, getCells, getRotatedCells } from './piece.js';
import { drawBoard, drawPiece, drawNext, drawGameOver, drawPawFlash } from './renderer.js';
import { bindInput } from './input.js';
import { playMeow, playPawTap } from './sound.js';
import { tryPawSwipe } from './catPaw.js';

const boardCanvas = document.getElementById('board-canvas');
const boardCtx = boardCanvas.getContext('2d');
const fxCanvas = document.getElementById('fx-canvas');
const fxCtx = fxCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const restartBtn = document.getElementById('restart-btn');

const PAW_FLASH_DURATION_MS = 450;

function randomPawInterval() {
  const { minIntervalMs, maxIntervalMs } = CONFIG.catPaw;
  return minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
}

const HIGH_SCORE_KEY = 'cattetris-high-score';

// localStorage can throw (privacy mode, disabled storage, etc.) — a
// missing high score isn't worth crashing the game over.
function loadHighScore() {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    // non-critical — just means the best score won't persist this time.
  }
}

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
  highScore: loadHighScore(),
  gameOver: false,
  pawTimer: 0,
  pawInterval: randomPawInterval(),
  pawEffect: null, // { x, y, startedAt } while the paw-print flash is visible
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
  state.pawTimer = 0;
  state.pawInterval = randomPawInterval();
  state.pawEffect = null;
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
    // Player restarts via resetState() (bound to the R key / restart button).
    state.gameOver = true;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore(state.highScore);
    }
  }
}

function lockCurrentPiece() {
  lockPiece(state.board, state.current, getCells(state.current));

  const fullRows = getFullRows(state.board);
  if (fullRows.length > 0) {
    clearRows(state.board, fullRows);
    state.score += CONFIG.LINE_SCORES[fullRows.length] ?? 0;
    playMeow(fullRows.length);
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

restartBtn.addEventListener('click', () => {
  if (state.gameOver) resetState();
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

    if (CONFIG.catPaw.enabled) {
      state.pawTimer += dt;
      if (state.pawTimer >= state.pawInterval) {
        state.pawTimer = 0;
        state.pawInterval = randomPawInterval();
        const result = tryPawSwipe(state.board, CONFIG.catPaw);
        if (result) {
          state.pawEffect = { x: result.toX, y: result.y, startedAt: timestamp };
          playPawTap();
        }
      }
    }
  }

  drawBoard(boardCtx, state.board);
  drawPiece(boardCtx, state.current);
  drawNext(nextCtx, state.next);
  scoreEl.textContent = `Score: ${state.score}`;
  highScoreEl.textContent = `Best: ${state.highScore}`;
  restartBtn.classList.toggle('hidden', !state.gameOver);
  if (state.gameOver) drawGameOver(boardCtx, state.score, state.highScore);

  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  if (state.pawEffect) {
    const progress = (timestamp - state.pawEffect.startedAt) / PAW_FLASH_DURATION_MS;
    if (progress >= 1) {
      state.pawEffect = null;
    } else {
      drawPawFlash(fxCtx, state.pawEffect.x, state.pawEffect.y, progress);
    }
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
