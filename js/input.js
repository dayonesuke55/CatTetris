// input.js — keyboard handling. Translates keydown events into intents
// via the callbacks passed in; holds no game state of its own.

export function bindInput(handlers) {
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handlers.onMoveLeft?.();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handlers.onMoveRight?.();
        break;
      case 'ArrowDown':
        e.preventDefault();
        handlers.onSoftDrop?.();
        break;
      case 'ArrowUp':
        e.preventDefault();
        handlers.onRotate?.();
        break;
      case ' ':
        e.preventDefault();
        handlers.onHardDrop?.();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        handlers.onRestart?.();
        break;
    }
  });
}
