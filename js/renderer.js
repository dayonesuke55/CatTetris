// renderer.js — pure drawing functions. No game logic lives here; every
// function takes state and paints it.
//
// M3: every single block — falling, in the NEXT preview, or already
// locked into the stack — is drawn as one small cat face, using
// piece.js's COLORS (fur tint) and CAT_STYLES (ear/eye/mark shape) for
// the type. Earlier this file only decorated a piece's "head" cell and
// left a tail on its "tail" cell, but that information dies once a
// piece locks (board.js stores per-cell type, not per-piece grouping)
// — faces would vanish into flat blocks the moment they landed. Facing
// every cell independently needs nothing but the cell's own type, so
// it works identically for locked, falling, and preview cells.

import { CONFIG } from './config.js';
import { COLORS, CAT_STYLES, getCells, PIECE_TYPES } from './piece.js';
import { getLevel, getLevelProgress } from './affection.js';

const EYE_COLOR = '#2b2233';
const NOSE_COLOR = '#f4b6c2';

// Lightens (positive amount) or darkens (negative) a '#rrggbb' color.
function shade(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + Math.round(255 * amount));
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = clamp((num & 0xff) + Math.round(255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The "plush" cell body, shared by every block. A lighter belly-patch
// ellipse gives it a two-tone cat-fur look instead of a flat fill.
function drawBlockBody(ctx, px, py, size, color) {
  const pad = size * 0.05;
  roundRectPath(ctx, px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.22);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = shade(color, 0.22);
  ctx.beginPath();
  ctx.ellipse(px + size * 0.5, py + size * 0.7, size * 0.26, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEars(ctx, px, py, size, color, shape) {
  const dark = shade(color, -0.15);
  if (shape === 'round') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px + size * 0.24, py + size * 0.14, size * 0.15, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + size * 0.76, py + size * 0.14, size * 0.15, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'folded') {
    // Small flattened bumps close to the head, like a Scottish Fold.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(px + size * 0.26, py + size * 0.12, size * 0.13, size * 0.07, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + size * 0.74, py + size * 0.12, size * 0.13, size * 0.07, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 'pointed' (default) and 'tufted' both start as a triangle.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px + size * 0.1, py + size * 0.18);
    ctx.lineTo(px + size * 0.27, py - size * 0.08);
    ctx.lineTo(px + size * 0.4, py + size * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + size * 0.6, py + size * 0.16);
    ctx.lineTo(px + size * 0.73, py - size * 0.08);
    ctx.lineTo(px + size * 0.9, py + size * 0.18);
    ctx.closePath();
    ctx.fill();

    if (shape === 'tufted') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, size * 0.025);
      ctx.beginPath();
      ctx.moveTo(px + size * 0.27, py - size * 0.08);
      ctx.lineTo(px + size * 0.24, py - size * 0.18);
      ctx.moveTo(px + size * 0.73, py - size * 0.08);
      ctx.lineTo(px + size * 0.76, py - size * 0.18);
      ctx.stroke();
    }
  }
}

function drawEyes(ctx, px, py, size, shape) {
  const leftX = px + size * 0.35;
  const rightX = px + size * 0.65;
  const eyeY = py + size * 0.5;

  if (shape === 'sleepy') {
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(leftX, eyeY, size * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightX, eyeY, size * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (shape === 'slant') {
    ctx.fillStyle = EYE_COLOR;
    ctx.save();
    ctx.translate(leftX, eyeY);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.075, size * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(rightX, eyeY);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.075, size * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // 'round' (default)
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(leftX, eyeY, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightX, eyeY, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Drawn before eyes/nose so it sits underneath them, like real fur
// markings would.
function drawMark(ctx, px, py, size, color, shape) {
  const dark = shade(color, -0.16);
  if (shape === 'mask') {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(px + size * 0.5, py + size * 0.52, size * 0.3, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'stripes') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + size * 0.5, py + size * 0.15);
    ctx.lineTo(px + size * 0.4, py + size * 0.32);
    ctx.moveTo(px + size * 0.5, py + size * 0.15);
    ctx.lineTo(px + size * 0.6, py + size * 0.32);
    ctx.stroke();
  } else if (shape === 'patch') {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(px + size * 0.65, py + size * 0.46, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNoseAndWhiskers(ctx, px, py, size) {
  ctx.fillStyle = NOSE_COLOR;
  ctx.beginPath();
  ctx.moveTo(px + size * 0.45, py + size * 0.62);
  ctx.lineTo(px + size * 0.55, py + size * 0.62);
  ctx.lineTo(px + size * 0.5, py + size * 0.69);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(43, 34, 51, 0.55)';
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(px + size * 0.03, py + size * 0.6);
  ctx.lineTo(px + size * 0.3, py + size * 0.62);
  ctx.moveTo(px + size * 0.03, py + size * 0.7);
  ctx.lineTo(px + size * 0.3, py + size * 0.68);
  ctx.moveTo(px + size * 0.97, py + size * 0.6);
  ctx.lineTo(px + size * 0.7, py + size * 0.62);
  ctx.moveTo(px + size * 0.97, py + size * 0.7);
  ctx.lineTo(px + size * 0.7, py + size * 0.68);
  ctx.stroke();
}

// One full cat block: body + ears + mark + eyes + nose/whiskers, all
// keyed off `type` alone — no piece/rotation context needed, which is
// what lets locked board cells keep their face after landing. `x`/`y`
// are grid coordinates and may be fractional — used by main.js's
// M4 paw-drag animation to draw a block mid-slide between columns.
export function drawCatBlock(ctx, x, y, type, size) {
  const px = x * size;
  const py = y * size;
  const color = COLORS[type];
  const style = CAT_STYLES[type];

  drawBlockBody(ctx, px, py, size, color);
  drawEars(ctx, px, py, size, color, style.ear);
  drawMark(ctx, px, py, size, color, style.mark);
  drawEyes(ctx, px, py, size, style.eye);
  drawNoseAndWhiskers(ctx, px, py, size);
}

// `skip` (optional {x, y}) omits one board cell from normal
// rendering — used while the M4 paw-drag animation is drawing that
// same cell itself, mid-slide, on top.
export function drawBoard(ctx, board, skip = null) {
  ctx.fillStyle = '#1e1826';
  ctx.fillRect(0, 0, board[0].length * CONFIG.CELL_SIZE, board.length * CONFIG.CELL_SIZE);
  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      if (skip && skip.x === x && skip.y === y) return;
      drawCatBlock(ctx, x, y, cell.type, CONFIG.CELL_SIZE);
    });
  });
}

export function drawPiece(ctx, piece) {
  if (!piece) return;
  getCells(piece).forEach(({ x, y }) => {
    if (y >= 0) drawCatBlock(ctx, x, y, piece.type, CONFIG.CELL_SIZE);
  });
}

// The hard-drop landing preview: a faint outline of the current piece
// at the row it would settle on, so a hard drop (space bar) never
// lands somewhere the player didn't expect. `ghostY` is the piece's
// would-be `y` if dropped now — main.js works that out by re-running
// the same "move down until blocked" check hardDrop uses, without
// mutating anything. Drawn as a stroked outline rather than a second
// full cat face so it doesn't read as an actual second piece.
export function drawGhost(ctx, piece, ghostY, size) {
  if (!piece || ghostY === piece.y) return; // already resting here — nothing to preview
  const color = COLORS[piece.type];
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.06);
  getCells({ ...piece, y: ghostY }).forEach(({ x, y }) => {
    if (y < 0) return;
    const px = x * size;
    const py = y * size;
    const pad = size * 0.05;
    roundRectPath(ctx, px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.22);
    ctx.stroke();
  });
  ctx.restore();
}

// Draws the next piece centered in its own small preview canvas.
export function drawNext(ctx, piece) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!piece) return;

  const size = 20;
  const localCells = getCells({ ...piece, x: 0, y: 0, rotation: 0 });
  const minX = Math.min(...localCells.map((c) => c.x));
  const maxX = Math.max(...localCells.map((c) => c.x));
  const minY = Math.min(...localCells.map((c) => c.y));
  const maxY = Math.max(...localCells.map((c) => c.y));
  const w = (maxX - minX + 1) * size;
  const h = (maxY - minY + 1) * size;
  const offsetX = (ctx.canvas.width - w) / 2 - minX * size;
  const offsetY = (ctx.canvas.height - h) / 2 - minY * size;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  localCells.forEach(({ x, y }) => drawCatBlock(ctx, x, y, piece.type, size));
  ctx.restore();
}

export function drawGameOver(ctx, score, highScore) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, height / 2 - 50, width, 100);
  ctx.fillStyle = '#fdf6f0';
  ctx.textAlign = 'center';
  ctx.font = '20px sans-serif';
  ctx.fillText('Game Over', width / 2, height / 2 - 14);
  ctx.font = '14px sans-serif';
  const isNewBest = score >= highScore && score > 0;
  ctx.fillText(isNewBest ? `New Best: ${highScore}!` : `Best: ${highScore}`, width / 2, height / 2 + 10);
  ctx.fillText('Press R to restart', width / 2, height / 2 + 32);
}

// Builds (but doesn't fill/stroke) a heart-shaped path — standard
// canvas heart trick (two rounded lobes + a bezier point). `cx`/`topY`
// is the heart's top-center point; its bounding box spans roughly
// topY..topY+s vertically. Left as a bare path so callers can fill,
// stroke, or clip to it as needed (see drawHeartGauge below).
function heartPath(ctx, cx, topY, s) {
  const topCurveHeight = s * 0.3;
  ctx.beginPath();
  ctx.moveTo(cx, topY + topCurveHeight);
  ctx.bezierCurveTo(cx, topY, cx - s / 2, topY, cx - s / 2, topY + topCurveHeight);
  ctx.bezierCurveTo(
    cx - s / 2, topY + (s + topCurveHeight) / 2,
    cx, topY + (s + topCurveHeight) / 2,
    cx, topY + s
  );
  ctx.bezierCurveTo(
    cx, topY + (s + topCurveHeight) / 2,
    cx + s / 2, topY + (s + topCurveHeight) / 2,
    cx + s / 2, topY + topCurveHeight
  );
  ctx.bezierCurveTo(cx + s / 2, topY, cx, topY, cx, topY + topCurveHeight);
  ctx.closePath();
}

// M6: one breed's affection gauge — a heart outline that fills from
// the bottom up as `fraction` (0-1) rises, in that breed's own fur
// color, like a little liquid-filled meter. Replaces an earlier design
// that drew a heart directly on stacked blocks — that made the board
// itself harder to read at a glance, so progress moved to this
// dedicated side panel instead (see drawAffectionPanel).
function drawHeartGauge(ctx, cx, topY, s, fraction, color) {
  // Faint empty heart first, so the unfilled portion still reads as a
  // heart rather than blank space.
  heartPath(ctx, cx, topY, s);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();

  if (fraction > 0) {
    ctx.save();
    heartPath(ctx, cx, topY, s);
    ctx.clip();
    const fillHeight = s * Math.min(1, fraction);
    ctx.fillStyle = color;
    ctx.fillRect(cx - s, topY + s - fillHeight, s * 2, fillHeight + s * 0.05);
    ctx.restore();
  }

  heartPath(ctx, cx, topY, s);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.stroke();
}

// M6: tier colors the gauge cycles through as a breed levels up —
// tier 0 (still working toward the first level) uses the breed's own
// fur color (COLORS[type], handled as a special case below) so a
// brand-new bond still looks tied to that specific cat; every tier
// after that switches to this shared, progressively warmer palette
// instead, so *any* breed's gauge reads as "more deeply bonded" once
// it's glowing gold or rose rather than its everyday fur tint. Levels
// past the last entry just keep reusing it — there's no visual cap,
// only a practical one.
const TIER_COLORS = ['#ffd76a', '#ff9f6b', '#ff6b81'];

function tierColorFor(type, level) {
  if (level <= 0) return COLORS[type];
  return TIER_COLORS[Math.min(level - 1, TIER_COLORS.length - 1)];
}

// M6: the per-breed affection roster shown in the side panel — one row
// per cat type (a small face icon + its heart gauge), so progress is
// visible at a glance without touching the board's own rendering. A
// level-up used to bounce the row itself, but that read as too subtle
// to notice — main.js now shows a big face (see drawBigFace) in the
// panel's spare space below instead, so this function stays a plain,
// un-animated readout.
export function drawAffectionPanel(ctx, affection) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const faceSize = 26;
  const heartSize = 24;
  const rowHeight = height / PIECE_TYPES.length;

  PIECE_TYPES.forEach((type, i) => {
    const centerY = i * rowHeight + rowHeight / 2;
    const level = getLevel(affection, type);
    const fraction = getLevelProgress(affection, type);
    const color = tierColorFor(type, level);
    const heartCx = 6 + faceSize + 10 + heartSize / 2;

    ctx.save();
    ctx.translate(6, centerY - faceSize / 2);
    drawCatBlock(ctx, 0, 0, type, faceSize);
    ctx.restore();

    drawHeartGauge(ctx, heartCx, centerY - heartSize / 2, heartSize, fraction, color);
  });
}

// M6: the "level up!" celebration — that breed's face, big, shown
// briefly in the blank space below the gauge panel (see main.js for
// the fade-in/hold/fade-out timeline and the queue that plays these
// one at a time). Just drawCatBlock scaled up to fill the canvas —
// no special expression, the size alone is the celebration.
export function drawBigFace(ctx, type) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawCatBlock(ctx, 0, 0, type, ctx.canvas.width);
}

const PAW_FUR_COLOR = '#d9c2a8';
const PAW_PAD_COLOR = '#f4b6c2';

// M4: an actual cat leg reaching in — a thick fur-colored limb
// stretching from off fx-canvas's edge up to a pink paw pad with
// toes, big enough to unmistakably read as "a cat is doing this from
// outside the screen" rather than a small icon. `px`/`py` are plain
// pixel coordinates in fx-canvas's own space (which is wider than the
// board and extends past its edges — see index.html/style.css), so
// the caller owns all the column/margin math. `fromLeft` picks which
// canvas edge the arm trails off toward. `alpha` fades it on retreat.
export function drawPaw(ctx, px, py, fromLeft, alpha = 1) {
  const size = 117; // reference scale for the pad/toes/arm below (1.5x the original 78)

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);

  // The leg: a thick rounded stroke from off-canvas to the paw.
  const edgeX = fromLeft ? -40 : ctx.canvas.width + 40;
  ctx.strokeStyle = PAW_FUR_COLOR;
  ctx.lineWidth = size * 0.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(edgeX, py);
  ctx.lineTo(px, py);
  ctx.stroke();

  // Paw pad + four toes on top of the leg's end.
  ctx.fillStyle = PAW_PAD_COLOR;
  ctx.beginPath();
  ctx.ellipse(px, py + size * 0.1, size * 0.34, size * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();

  const toes = [
    [-0.34, -0.26],
    [-0.12, -0.42],
    [0.12, -0.42],
    [0.34, -0.26],
  ];
  toes.forEach(([ox, oy]) => {
    ctx.beginPath();
    ctx.ellipse(px + ox * size, py + oy * size, size * 0.11, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
