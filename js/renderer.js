// renderer.js — pure drawing functions. No game logic lives here; every
// function takes state and paints it. Block rendering is a placeholder
// (flat color squares) until M3 swaps drawBlock for cat-pose drawings —
// piece.js's COLORS/type tagging is what makes that a one-file change.

import { CONFIG } from './config.js';
import { COLORS, getCells } from './piece.js';

function drawBlock(ctx, x, y, color) {
  const size = CONFIG.CELL_SIZE;
  const px = x * size;
  const py = y * size;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
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
  getCells(piece).forEach(({ x, y }) => {
    if (y >= 0) drawBlock(ctx, x, y, COLORS[piece.type]);
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

  ctx.fillStyle = COLORS[piece.type];
  localCells.forEach(({ x, y }) => {
    ctx.fillRect(offsetX + x * size + 1, offsetY + y * size + 1, size - 2, size - 2);
  });
}

export function drawGameOver(ctx) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, height / 2 - 36, width, 72);
  ctx.fillStyle = '#fdf6f0';
  ctx.textAlign = 'center';
  ctx.font = '20px sans-serif';
  ctx.fillText('Game Over', width / 2, height / 2);
  ctx.font = '14px sans-serif';
  ctx.fillText('Press R to restart', width / 2, height / 2 + 24);
}
