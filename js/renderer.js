// renderer.js — pure drawing functions. No game logic lives here; every
// function takes state and paints it.
//
// M3: blocks are drawn as a procedural "cat blob" rather than flat
// squares. Given a piece's actual cell layout (any rotation), we pick
// a head cell (topmost, then leftmost) and a tail cell (bottommost,
// then rightmost) and decorate those — this needs no per-type,
// per-rotation art and can't visually break under rotation, unlike
// hand-drawn pose illustrations. Locked cells on the board no longer
// carry their original piece grouping (see board.js), so they only
// get the plain rounded block — face/tail decoration is reserved for
// the falling piece and the NEXT preview.

import { CONFIG } from './config.js';
import { COLORS, getCells } from './piece.js';

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

// A single "plush" cell — the shared visual unit for both locked
// board cells and (decorated further below) live piece cells.
function drawBlock(ctx, x, y, color, size = CONFIG.CELL_SIZE) {
  const px = x * size;
  const py = y * size;
  const pad = size * 0.05;
  roundRectPath(ctx, px + pad, py + pad, size - pad * 2, size - pad * 2, size * 0.22);
  ctx.fillStyle = color;
  ctx.fill();
}

// Ears/eyes/nose/whiskers centered on one grid cell.
function drawCatFace(ctx, cellX, cellY, size, color) {
  const px = cellX * size;
  const py = cellY * size;

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

  ctx.fillStyle = EYE_COLOR;
  ctx.beginPath();
  ctx.arc(px + size * 0.35, py + size * 0.5, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + size * 0.65, py + size * 0.5, size * 0.06, 0, Math.PI * 2);
  ctx.fill();

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
  ctx.moveTo(px + size * 0.03, py + size * 0.58);
  ctx.lineTo(px + size * 0.3, py + size * 0.6);
  ctx.moveTo(px + size * 0.03, py + size * 0.7);
  ctx.lineTo(px + size * 0.3, py + size * 0.66);
  ctx.moveTo(px + size * 0.97, py + size * 0.58);
  ctx.lineTo(px + size * 0.7, py + size * 0.6);
  ctx.moveTo(px + size * 0.97, py + size * 0.7);
  ctx.lineTo(px + size * 0.7, py + size * 0.66);
  ctx.stroke();
}

// A curved tail poking outward from the tail cell, away from the
// body — (dirX, dirY) is a unit-ish direction from head to tail.
function drawCatTail(ctx, cellX, cellY, size, dirX, dirY, color) {
  const cx = cellX * size + size / 2;
  const cy = cellY * size + size / 2;
  const endX = cx + dirX * size * 0.9;
  const endY = cy + dirY * size * 0.9;
  // Curl the tail sideways relative to its direction of travel.
  const curlX = cx + dirX * size * 0.55 - dirY * size * 0.35;
  const curlY = cy + dirY * size * 0.55 + dirX * size * 0.35;

  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(curlX, curlY, endX, endY);
  ctx.stroke();
}

// Topmost-then-leftmost cell is the "head"; bottommost-then-rightmost
// is the "tail". Deterministic for any rotation state, so it never
// needs a per-shape lookup table.
function pickHeadAndTail(cells) {
  let head = cells[0];
  let tail = cells[0];
  for (const c of cells) {
    if (c.y < head.y || (c.y === head.y && c.x < head.x)) head = c;
    if (c.y > tail.y || (c.y === tail.y && c.x > tail.x)) tail = c;
  }
  return { head, tail };
}

function tailDirection(head, tail) {
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  if (dx === 0 && dy === 0) return { x: 0, y: 1 };
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx), y: 0 }
    : { x: 0, y: Math.sign(dy) };
}

// Draws a full decorated piece (body + face + tail) given cells
// already in the target coordinate system. Shared by drawPiece
// (board grid) and drawNext (its own small preview grid).
function drawCatPieceCells(ctx, cells, color, size) {
  if (cells.length === 0) return;
  const { head, tail } = pickHeadAndTail(cells);
  const dir = tailDirection(head, tail);
  cells.forEach(({ x, y }) => drawBlock(ctx, x, y, color, size));
  drawCatTail(ctx, tail.x, tail.y, size, dir.x, dir.y, shade(color, -0.18));
  drawCatFace(ctx, head.x, head.y, size, color);
}

export function drawBoard(ctx, board) {
  ctx.fillStyle = '#1e1826';
  ctx.fillRect(0, 0, board[0].length * CONFIG.CELL_SIZE, board.length * CONFIG.CELL_SIZE);
  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) drawBlock(ctx, x, y, COLORS[cell.type]);
    });
  });
}

export function drawPiece(ctx, piece) {
  if (!piece) return;
  const cells = getCells(piece);
  const visibleCells = cells.filter((c) => c.y >= 0);
  if (visibleCells.length === 0) return;

  // Anatomy is picked from the full (possibly partly off-board) shape
  // so head/tail placement stays stable as the piece enters play, but
  // only the visible portion is actually painted.
  const { head, tail } = pickHeadAndTail(cells);
  const dir = tailDirection(head, tail);
  const color = COLORS[piece.type];

  visibleCells.forEach(({ x, y }) => drawBlock(ctx, x, y, color));
  if (tail.y >= 0) drawCatTail(ctx, tail.x, tail.y, CONFIG.CELL_SIZE, dir.x, dir.y, shade(color, -0.18));
  if (head.y >= 0) drawCatFace(ctx, head.x, head.y, CONFIG.CELL_SIZE, color);
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
  drawCatPieceCells(ctx, localCells, COLORS[piece.type], size);
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
