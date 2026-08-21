// main.js — entry point and game loop.
//
// M1 scope: falling piece + controls + locking + spawning, plus line
// clearing and scoring. M2 adds the game-over restart flow (see
// resetState/onRestart below).

import { CONFIG } from './config.js';
import { createBoard, isValidPosition, lockPiece, getFullRows, clearRows } from './board.js';
import { makePieceQueue, getCells, getRotatedCells } from './piece.js';
import { drawBoard, drawPiece, drawGhost, drawNext, drawGameOver, drawPaw, drawCatBlock, drawAffectionPanel } from './renderer.js';
import { bindInput } from './input.js';
import { playMeow, playPawTap } from './sound.js';
import { planPawSwipe, applyPawSwipe } from './catPaw.js';
import { loadAffection, saveAffection, recordLineClear } from './affection.js';

const boardCanvas = document.getElementById('board-canvas');
const boardCtx = boardCanvas.getContext('2d');
const fxCanvas = document.getElementById('fx-canvas');
const fxCtx = fxCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const affectionCanvas = document.getElementById('affection-canvas');
const affectionCtx = affectionCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const restartBtn = document.getElementById('restart-btn');

// fx-canvas is wider than the board (see index.html) so the M4 cat
// paw can visibly reach in from beyond the play area instead of
// popping in right at its edge. fxMarginPx is derived from the actual
// canvas width rather than duplicating a hardcoded number, and we set
// fx-canvas's CSS offset from it too, so the HTML width attribute is
// the one place this is ever tuned.
const boardWidthPx = CONFIG.COLS * CONFIG.CELL_SIZE;
const fxMarginPx = (fxCanvas.width - boardWidthPx) / 2;
const fxMarginCols = fxMarginPx / CONFIG.CELL_SIZE;
fxCanvas.style.left = `-${fxMarginPx}px`;

function fxCellCenterX(gridX) {
  return fxMarginPx + gridX * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
}
function fxCellCenterY(gridY) {
  return gridY * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
}

// M4 paw-swipe animation phases: the paw reaches in from well outside
// the board, makes contact (that's when the tap sound plays and the
// block starts visibly sliding with it), then fades out at the
// destination. Split into phases — rather than moving the block
// instantly — so the shift reads as "the cat did this" instead of a
// sudden teleport.
const PAW_REACH_MS = 320;
const PAW_DRAG_MS = 220;
const PAW_SETTLE_MS = 240;
const PAW_TOTAL_MS = PAW_REACH_MS + PAW_DRAG_MS + PAW_SETTLE_MS;

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
  pawAnim: null, // { plan, startedAt, contactMade, valid, mutationApplied } while a swipe is animating
  // M6: per-type affection ({ I: 0, O: 0, ... }), loaded once here and
  // never touched by resetState() below — like highScore, it's a
  // slow-building meta stat across games, not a per-run one.
  affection: loadAffection(),
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
  state.pawAnim = null;
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

// Where the current piece would land if hard-dropped right now — same
// "keep moving down while valid" check hardDrop uses, but read-only.
// Recomputed every frame (in the render loop below) since it depends
// on the piece's live x/rotation, both of which can change between
// drops.
function getGhostY(piece) {
  let y = piece.y;
  while (isValidPosition(state.board, getCells({ ...piece, y: y + 1 }))) {
    y++;
  }
  return y;
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
    // Must run before clearRows() mutates the board — it reads which
    // types were actually in the cleared rows.
    recordLineClear(state.affection, state.board, fullRows);
    saveAffection(state.affection);
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
        // Don't start a new swipe while one's still animating.
        if (!state.pawAnim) {
          const plan = planPawSwipe(state.board, CONFIG.catPaw);
          if (plan) state.pawAnim = { plan, startedAt: timestamp, contactMade: false };
        }
      }
    }
  }

  // Advance any in-flight paw animation regardless of gameOver, so a
  // swipe that was already underway always finishes cleanly instead
  // of freezing mid-drag.
  let pawSkipCell = null;
  let pawDrawBlock = null;
  let pawDraw = null;
  if (state.pawAnim) {
    const anim = state.pawAnim;
    const { plan } = anim;
    const elapsed = timestamp - anim.startedAt;
    const direction = Math.sign(plan.toX - plan.fromX);
    // Paw enters from the side the block is moving away from (behind
    // it), then pushes it forward — reads as a deliberate shove.
    const fromLeft = direction > 0;
    const reachStartGridX = direction > 0 ? -fxMarginCols : CONFIG.COLS + fxMarginCols;

    if (elapsed < PAW_REACH_MS) {
      const t = elapsed / PAW_REACH_MS;
      const gridX = reachStartGridX + (plan.fromX - reachStartGridX) * t;
      pawDraw = { px: fxCellCenterX(gridX), py: fxCellCenterY(plan.y), fromLeft, alpha: 1 };
    } else if (elapsed < PAW_REACH_MS + PAW_DRAG_MS) {
      if (!anim.contactMade) {
        anim.contactMade = true;
        // Re-check right before committing to the drag visual — a
        // line clear during the reach phase can shift rows underneath
        // a pending plan.
        anim.valid =
          plan.y < state.board.length &&
          state.board[plan.y][plan.fromX] !== null &&
          state.board[plan.y][plan.fromX].type === plan.type &&
          state.board[plan.y][plan.toX] === null;
        if (anim.valid) playPawTap();
      }
      if (anim.valid) {
        const t = (elapsed - PAW_REACH_MS) / PAW_DRAG_MS;
        const gridX = plan.fromX + (plan.toX - plan.fromX) * t;
        pawSkipCell = { x: plan.fromX, y: plan.y };
        pawDrawBlock = { x: gridX, y: plan.y, type: plan.type };
        pawDraw = { px: fxCellCenterX(gridX), py: fxCellCenterY(plan.y), fromLeft, alpha: 1 };
      }
    } else if (elapsed < PAW_TOTAL_MS) {
      if (anim.valid && !anim.mutationApplied) {
        anim.mutationApplied = applyPawSwipe(state.board, plan);
      }
      if (anim.valid) {
        const t = (elapsed - PAW_REACH_MS - PAW_DRAG_MS) / PAW_SETTLE_MS;
        pawDraw = { px: fxCellCenterX(plan.toX), py: fxCellCenterY(plan.y), fromLeft, alpha: 1 - t };
      }
    } else {
      state.pawAnim = null;
    }
  }

  drawBoard(boardCtx, state.board, pawSkipCell);
  if (!state.gameOver) drawGhost(boardCtx, state.current, getGhostY(state.current), CONFIG.CELL_SIZE);
  drawPiece(boardCtx, state.current);
  if (pawDrawBlock) drawCatBlock(boardCtx, pawDrawBlock.x, pawDrawBlock.y, pawDrawBlock.type, CONFIG.CELL_SIZE);
  drawNext(nextCtx, state.next);
  drawAffectionPanel(affectionCtx, state.affection);
  scoreEl.textContent = `Score: ${state.score}`;
  highScoreEl.textContent = `Best: ${state.highScore}`;
  restartBtn.classList.toggle('hidden', !state.gameOver);
  if (state.gameOver) drawGameOver(boardCtx, state.score, state.highScore);

  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  if (pawDraw) drawPaw(fxCtx, pawDraw.px, pawDraw.py, pawDraw.fromLeft, pawDraw.alpha);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
