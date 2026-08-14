// main.js — entry point / game loop
// M0: skeleton only. Confirms index.html -> CSS -> ES module wiring works
// end-to-end by drawing a placeholder rectangle on the board canvas.
// Board/piece/input logic will be added starting at M1.

const boardCanvas = document.getElementById('board-canvas');
const ctx = boardCanvas.getContext('2d');

ctx.fillStyle = '#1e1826';
ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

ctx.fillStyle = '#f4b6c2';
ctx.fillRect(
  boardCanvas.width / 2 - 40,
  boardCanvas.height / 2 - 40,
  80,
  80
);

ctx.fillStyle = '#fdf6f0';
ctx.font = '14px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('CatTetris skeleton ready', boardCanvas.width / 2, boardCanvas.height / 2 + 60);
