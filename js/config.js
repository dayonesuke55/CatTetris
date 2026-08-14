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

  // Filled in at M4 — cat paw gimmick tuning lives here so it can be
  // adjusted (or disabled) without touching catPaw.js itself.
  catPaw: {
    enabled: false,
  },
};
