// config.js — tunable constants shared across modules.

export const CONFIG = {
  COLS: 10,
  ROWS: 20,
  CELL_SIZE: 30,
  INITIAL_DROP_MS: 800,
  LINES_PER_LEVEL: 10,

  // Classic guideline-style scoring, indexed by lines cleared at once
  // (1-4). Level-based multiplier is future work — LINES_PER_LEVEL above
  // isn't wired to anything yet.
  LINE_SCORES: [0, 100, 300, 500, 800],

  // M4: cat paw gimmick. Fires on a random timer between the two
  // interval bounds and slides one locked cell sideways by 1-2
  // columns (see catPaw.js). safeTopRows keeps it away from the
  // spawn area entirely — it only ever picks a row at y >=
  // safeTopRows, as both the source and destination of a shift are in
  // the same row, so this one bound guarantees the piece-spawn zone
  // is never touched.
  catPaw: {
    enabled: true,
    minIntervalMs: 15000,
    maxIntervalMs: 30000,
    safeTopRows: 2,
  },

  // M6: cat affection. Each of the 7 cat types (piece types) builds
  // affection as lines containing it get cleared (see affection.js).
  // perLevel is a *repeating* interval, not a one-time threshold —
  // every perLevel clears, that type's heart gauge (side panel,
  // renderer.js's drawAffectionPanel) fills, empties, and starts
  // refilling in the next tier color, so the gauge color itself shows
  // how bonded a breed is rather than just a single milestone. This
  // replaced a v1 that used a one-time threshold=5 — playtesting found
  // that too low (it maxed out almost immediately, with no further
  // payoff, and multiple types often crossed it in the very same
  // clear). Affection persists across games via localStorage (like the
  // high score), unlike score/board state.
  affection: {
    perLevel: 10,
  },
};
