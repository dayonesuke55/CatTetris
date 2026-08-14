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
import { COLORS, CAT_STYLES, getCells } from './piece.js';

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

// M4: the cat paw itself, drawn on fx-canvas — a pad + four toes,
// large enough to read clearly over a single cell. `x`/`y` are grid
// coordinates (x may be fractional, so it can travel smoothly across
// columns during the reach/drag phases) and `alpha` lets the caller
// fade it out as it retreats.
export function drawPaw(ctx, x, y, size, alpha = 1) {
  const px = x * size + size / 2;
  const py = y * size + size / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = '#f4b6c2';

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
