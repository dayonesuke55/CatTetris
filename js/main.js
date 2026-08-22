// main.js — entry point and game loop.
//
// M1 scope: falling piece + controls + locking + spawning, plus line
// clearing and scoring. M2 adds the game-over restart flow (see
// resetState/onRestart below).

import { CONFIG } from './config.js';
import { createBoard, isValidPosition, lockPiece, getFullRows, clearRows } from './board.js';
import { makePieceQueue, getCells, getRotatedCells, PIECE_TYPES, BREED_PROFILES, MILESTONE_COUNTS, SPECIAL_HIGH_SCORE, SESSION_MILESTONE_COUNTS } from './piece.js';
import { drawBoard, drawPiece, drawGhost, drawNext, drawGameOver, drawPaw, drawCatBlock, drawAffectionPanel, drawBigFace } from './renderer.js';
import { bindInput } from './input.js';
import { playMeow, playPawTap, playBreedCry } from './sound.js';
import { planPawSwipe, applyPawSwipe } from './catPaw.js';
import { loadAffection, saveAffection, recordLineClear, getLevel, isCollected } from './affection.js';
import { loadSessionUnlocks, saveSessionUnlocks, emptySessionCounts, recordSessionLineClear, updateSessionUnlocks } from './sessionMilestones.js';

const boardCanvas = document.getElementById('board-canvas');
const boardCtx = boardCanvas.getContext('2d');
const fxCanvas = document.getElementById('fx-canvas');
const fxCtx = fxCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const affectionCanvas = document.getElementById('affection-canvas');
const affectionCtx = affectionCanvas.getContext('2d');
const levelUpFaceCanvas = document.getElementById('level-up-face');
const levelUpFaceCtx = levelUpFaceCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const restartBtn = document.getElementById('restart-btn');

// M7: collection view — a DOM element bundle per type rather than 7
// separate named consts, since every card is rendered identically
// (see renderCollection below).
const collectionBtn = document.getElementById('collection-btn');
const collectionOverlay = document.getElementById('collection-overlay');
const collectionCloseBtn = document.getElementById('collection-close-btn');
const collectionGridView = document.getElementById('collection-grid-view');
const collectionCards = Object.fromEntries(
  PIECE_TYPES.map((type) => [
    type,
    {
      card: document.getElementById(`collection-card-${type}`),
      faceCtx: document.getElementById(`collection-face-${type}`).getContext('2d'),
      name: document.getElementById(`collection-name-${type}`),
      personality: document.getElementById(`collection-personality-${type}`),
      trivia: document.getElementById(`collection-trivia-${type}`),
    },
  ])
);

// M7: the detail page for one breed, opened by clicking its card —
// full milestone list built dynamically (see renderDetail below), not
// hardcoded, since it's 21 rows per breed rather than a fixed handful.
const collectionDetailView = document.getElementById('collection-detail-view');
const collectionBackBtn = document.getElementById('collection-back-btn');
const collectionDetailFaceCtx = document.getElementById('collection-detail-face').getContext('2d');
const collectionDetailName = document.getElementById('collection-detail-name');
const collectionDetailPersonality = document.getElementById('collection-detail-personality');
const collectionDetailMilestones = document.getElementById('collection-detail-milestones');

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

// M6 "level up" celebration timeline: a brief fade-in/hold/fade-out for
// the big face shown below the gauge panel (see the render loop).
// Short on purpose — unlike the earlier full-card design this reuses
// otherwise-blank panel space and never blocks the board, so several
// of these can happen over a session without it getting old.
const LEVEL_UP_FADE_IN_MS = 150;
const LEVEL_UP_HOLD_MS = 900;
const LEVEL_UP_FADE_OUT_MS = 300;
const LEVEL_UP_TOTAL_MS = LEVEL_UP_FADE_IN_MS + LEVEL_UP_HOLD_MS + LEVEL_UP_FADE_OUT_MS;

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
  levelUpQueue: [], // types waiting to show their big-face celebration
  levelUp: null, // { type, startedAt } for the one currently showing
  // M7: true while the collection view is open — pauses gameplay input
  // and timers (see tryMove/tryRotate/hardDrop and the loop below)
  // rather than letting the player fall/paw-swipe blind behind it.
  collectionOpen: false,
  // M7 follow-up: per-type line-clear count for *this* game only,
  // reset in resetState() — drives sessionUnlocks below, unlike
  // affection which is cumulative across every game ever played.
  sessionCounts: emptySessionCounts(),
  // Persisted (like affection/highScore): which of each breed's
  // SESSION_MILESTONE_COUNTS tiers have ever been reached in a single
  // unbroken game. Once true, stays true forever.
  sessionUnlocks: loadSessionUnlocks(),
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
  state.levelUpQueue = [];
  state.levelUp = null;
  // Session-only tally starts fresh each game — sessionUnlocks itself
  // (what it's earned so far) is untouched, same as affection/highScore.
  state.sessionCounts = emptySessionCounts();
  closeCollection();
}

function tryMove(dx, dy) {
  if (state.gameOver || state.collectionOpen) return false;
  const moved = { ...state.current, x: state.current.x + dx, y: state.current.y + dy };
  if (isValidPosition(state.board, getCells(moved))) {
    state.current = moved;
    return true;
  }
  return false;
}

function tryRotate(dir) {
  if (state.gameOver || state.collectionOpen) return;
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
    // Snapshot before recordLineClear so we can tell which types (if
    // any) leveled up with this clear — a Tetris (4 rows) can even
    // push one type up more than one level at once, but it only takes
    // one level-up to trigger that row's little celebration.
    const levelsBefore = Object.fromEntries(PIECE_TYPES.map((type) => [type, getLevel(state.affection, type)]));

    // Must run before clearRows() mutates the board — it reads which
    // types were actually in the cleared rows.
    recordLineClear(state.affection, state.board, fullRows);
    saveAffection(state.affection);

    // M7 follow-up: same rows, but tallied into this game's own
    // per-type count (see sessionMilestones.js) rather than the
    // cumulative one above — persist only if a new tier was crossed.
    recordSessionLineClear(state.sessionCounts, state.board, fullRows);
    if (updateSessionUnlocks(state.sessionCounts, state.sessionUnlocks)) {
      saveSessionUnlocks(state.sessionUnlocks);
    }

    PIECE_TYPES.forEach((type) => {
      if (getLevel(state.affection, type) > levelsBefore[type]) {
        state.levelUpQueue.push(type);
      }
    });

    clearRows(state.board, fullRows);
    state.score += CONFIG.LINE_SCORES[fullRows.length] ?? 0;
    playMeow(fullRows.length);
  }

  spawnNext();
}

function softDropTick() {
  // Checked directly (not just via tryMove's own guard) — tryMove
  // returning false while the collection view is open must not be
  // mistaken for "hit bottom, lock it".
  if (state.gameOver || state.collectionOpen) return;
  if (!tryMove(0, 1)) {
    lockCurrentPiece();
  }
}

function hardDrop() {
  if (state.gameOver || state.collectionOpen) return;
  while (tryMove(0, 1)) {
    // keep dropping until it lands
  }
  lockCurrentPiece();
}

// M7: fills in every card's face/text from the *current* affection —
// called once when the view opens rather than every frame, since
// nothing in it can change while gameplay is paused behind it (see
// state.collectionOpen).
function renderCollection() {
  PIECE_TYPES.forEach((type) => {
    const { card, faceCtx, name, personality, trivia } = collectionCards[type];
    const profile = BREED_PROFILES[type];
    const met = isCollected(state.affection, type);

    faceCtx.clearRect(0, 0, faceCtx.canvas.width, faceCtx.canvas.height);
    drawCatBlock(faceCtx, 0, 0, type, faceCtx.canvas.width);

    card.classList.toggle('locked', !met);
    if (met) {
      name.textContent = profile.name;
      personality.textContent = profile.personality;
      trivia.textContent = profile.trivia;
    } else {
      name.textContent = '？？？';
      personality.textContent = '';
      trivia.textContent = `ラインを${CONFIG.affection.perLevel}回消すと出会えます`;
    }
  });
}

// M7: one row of the detail page's milestone list — either the real
// fact (unlocked) or a hint at what it takes to get there (locked).
// `countLabel` is display text ("50回" or "★特別"); `unlocked` and
// `fact`/`hint` are pre-resolved by the caller so this stays a plain
// DOM builder with no knowledge of *why* something is locked.
function buildMilestoneRow(countLabel, unlocked, fact, hint, extraClass = '') {
  const row = document.createElement('div');
  row.className = `milestone-row${unlocked ? '' : ' locked'}${extraClass ? ` ${extraClass}` : ''}`;

  const label = document.createElement('div');
  label.className = 'milestone-count';
  label.textContent = countLabel;

  const text = document.createElement('div');
  text.className = 'milestone-fact';
  text.textContent = unlocked ? fact : hint;

  row.appendChild(label);
  row.appendChild(text);
  return row;
}

// M7: fills in one breed's detail page — the big face/name/personality
// header (same lock rule as the grid card) plus the full milestone
// list, each row unlocked against the *same* raw affection[type] count
// M6's gauge already tracks (see piece.js's MILESTONE_COUNTS), plus
// one special row gated on state.highScore instead. Called once per
// open, same reasoning as renderCollection — nothing here changes
// while the view (and gameplay behind it) is paused.
function renderDetail(type) {
  const profile = BREED_PROFILES[type];
  const count = state.affection[type] ?? 0;
  const met = isCollected(state.affection, type);

  collectionDetailFaceCtx.clearRect(0, 0, collectionDetailFaceCtx.canvas.width, collectionDetailFaceCtx.canvas.height);
  drawCatBlock(collectionDetailFaceCtx, 0, 0, type, collectionDetailFaceCtx.canvas.width);
  collectionDetailName.textContent = met ? profile.name : '？？？';
  collectionDetailPersonality.textContent = met ? profile.personality : '';

  collectionDetailMilestones.innerHTML = '';
  MILESTONE_COUNTS.forEach((threshold, i) => {
    const unlocked = count >= threshold;
    const hint = `ラインを${threshold}回消すとアンロック`;
    collectionDetailMilestones.appendChild(
      buildMilestoneRow(`${threshold}回`, unlocked, profile.milestoneFacts[i], hint)
    );
  });

  // M7 follow-up: a second, harder schedule — unlocked only if this
  // many of the breed's lines were cleared within one continuous game
  // (state.sessionUnlocks, persisted once earned), not summed across
  // every game ever played like the section above.
  const sessionHeader = document.createElement('div');
  sessionHeader.className = 'milestone-section-label';
  sessionHeader.textContent = '1プレイでの記録';
  collectionDetailMilestones.appendChild(sessionHeader);

  SESSION_MILESTONE_COUNTS.forEach((threshold, i) => {
    const unlocked = state.sessionUnlocks[type]?.[i] ?? false;
    const hint = `1プレイでラインを${threshold}回消すとアンロック`;
    collectionDetailMilestones.appendChild(
      buildMilestoneRow(`${threshold}回`, unlocked, profile.sessionMilestoneFacts[i], hint, 'session')
    );
  });

  const specialUnlocked = state.highScore >= SPECIAL_HIGH_SCORE;
  collectionDetailMilestones.appendChild(
    buildMilestoneRow(
      '★特別',
      specialUnlocked,
      profile.specialFact,
      `ハイスコア${SPECIAL_HIGH_SCORE}以上でアンロック`,
      'special'
    )
  );
}

function showCollectionGrid() {
  collectionDetailView.classList.add('hidden');
  collectionGridView.classList.remove('hidden');
}

function showCollectionDetail(type) {
  renderDetail(type);
  collectionGridView.classList.add('hidden');
  collectionDetailView.classList.remove('hidden');
}

PIECE_TYPES.forEach((type) => {
  collectionCards[type].card.addEventListener('click', () => showCollectionDetail(type));
});

collectionBackBtn.addEventListener('click', showCollectionGrid);

function closeCollection() {
  collectionOverlay.classList.add('hidden');
  state.collectionOpen = false;
  showCollectionGrid(); // reset for next time it's opened
}

collectionBtn.addEventListener('click', () => {
  renderCollection();
  collectionOverlay.classList.remove('hidden');
  state.collectionOpen = true;
});

collectionCloseBtn.addEventListener('click', closeCollection);

// Clicking the dimmed backdrop (not the panel itself) also closes it.
collectionOverlay.addEventListener('click', (e) => {
  if (e.target === collectionOverlay) closeCollection();
});

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

  if (!state.gameOver && !state.collectionOpen) {
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

  // M6: advance the level-up queue — one big-face celebration at a
  // time (only one display slot exists), regardless of gameOver, same
  // reasoning as the paw animation above: a celebration already
  // showing should still finish its fade cleanly.
  if (!state.levelUp && state.levelUpQueue.length > 0) {
    const type = state.levelUpQueue.shift();
    state.levelUp = { type, startedAt: timestamp };
    drawBigFace(levelUpFaceCtx, type);
    playBreedCry(type); // played now, in sync with the face actually appearing
  }
  let levelUpOpacity = 0;
  if (state.levelUp) {
    const elapsed = timestamp - state.levelUp.startedAt;
    if (elapsed < LEVEL_UP_FADE_IN_MS) {
      levelUpOpacity = elapsed / LEVEL_UP_FADE_IN_MS;
    } else if (elapsed < LEVEL_UP_FADE_IN_MS + LEVEL_UP_HOLD_MS) {
      levelUpOpacity = 1;
    } else if (elapsed < LEVEL_UP_TOTAL_MS) {
      levelUpOpacity = 1 - (elapsed - LEVEL_UP_FADE_IN_MS - LEVEL_UP_HOLD_MS) / LEVEL_UP_FADE_OUT_MS;
    } else {
      levelUpOpacity = 0;
      state.levelUp = null;
    }
  }
  levelUpFaceCanvas.style.opacity = levelUpOpacity;

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
