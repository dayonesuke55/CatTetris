// piece.js — tetromino shapes, spawning, rotation, and the 7-bag queue.
//
// Each piece is plotted on a 4x4 local grid (coordinates 0-3). Rotation
// states are precomputed tables rather than derived via matrix rotation —
// simpler to read and to reason about for a first Tetris implementation.
// This is "SRS-lite": rotation just swaps to the next precomputed state
// and, on collision, tries a couple of simple horizontal kicks. It does
// not implement the full official SRS kick table, which is not needed
// for a casual, cat-flavored game.

import { CONFIG } from './config.js';

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Fur colors — one pastel hue per type, chosen to stay clearly
// distinguishable at a glance (same hue-separation as classic Tetris
// coloring: I=cyan, O=yellow, T=purple, S=green, Z=red, J=blue,
// L=orange) while matching the game's pastel/pink palette. renderer.js
// derives a lighter "belly patch" shade from each of these at draw
// time rather than storing a second color per type here.
export const COLORS = {
  I: '#7dd3f0',
  O: '#f5e37b',
  T: '#c99bf0',
  S: '#8fe0a0',
  Z: '#f0908f',
  J: '#7b8ff2',
  L: '#f0b06a',
};

// "Breed" per type — every single block is drawn as one cat face
// (see renderer.js), so this is what makes each of the 7 types read
// as a different cat rather than 7 copies of the same face in
// different colors. ear: 'pointed' | 'round' | 'tufted' | 'folded'.
// eye: 'round' | 'sleepy' | 'slant'. mark: 'none' | 'mask' | 'stripes'
// | 'patch'.
export const CAT_STYLES = {
  I: { ear: 'pointed', eye: 'slant', mark: 'mask' }, // siamese
  O: { ear: 'round', eye: 'sleepy', mark: 'none' }, // sleepy round face
  T: { ear: 'pointed', eye: 'round', mark: 'stripes' }, // classic tabby
  S: { ear: 'tufted', eye: 'round', mark: 'patch' }, // lynx-point, eye patch
  Z: { ear: 'folded', eye: 'slant', mark: 'patch' }, // scottish fold, eye patch
  J: { ear: 'pointed', eye: 'round', mark: 'mask' }, // dark-eared siamese-ish
  L: { ear: 'round', eye: 'round', mark: 'stripes' }, // orange tabby
};

// M6: the real-world breed each type's look is riffing on (see
// CAT_STYLES comments above), plus a one-line personality and cat-fact
// trivia. Shown in main.js's "breed card" celebration the moment a
// type's affection first reaches CONFIG.affection.threshold — meant
// as a little reward for actual cat lovers, and doubles as the flavor
// text the planned cat-breed collection milestone (M7) can reuse.
export const BREED_PROFILES = {
  I: {
    name: 'シャム',
    personality: 'おしゃべりで甘えん坊',
    trivia: '鳴き声がよく通り、気持ちを声でしっかり伝えてくれる猫種。',
  },
  O: {
    name: 'ブリティッシュショートヘア',
    personality: 'マイペースで貫禄たっぷり',
    trivia: '丸いほっぺと落ち着いた性格で「クマみたいな猫」と称されることも。',
  },
  T: {
    name: 'キジトラ',
    personality: '人懐っこく物怖じしない',
    trivia: '日本で最もよく見かける柄のひとつ。野生のヤマネコに近い縞模様が特徴。',
  },
  S: {
    name: 'メインクーン',
    personality: '穏やかで頼れる「優しい巨人」',
    trivia: '耳先の房毛がトレードマーク。アメリカ原産の猫種の中でも最大級の体格。',
  },
  Z: {
    name: 'スコティッシュフォールド',
    personality: 'おっとりマイペース、順応力抜群',
    trivia: '折れ耳が特徴で、1960年代にスコットランドの農場で発見されたのが起源。',
  },
  J: {
    name: 'バーミーズ',
    personality: '社交的で人にべったり甘えたがり',
    trivia: 'かつては「シャムの親戚」と考えられていたほど人懐っこい猫種。',
  },
  L: {
    name: '茶トラ',
    personality: '食いしん坊で愛嬌たっぷり',
    trivia: 'オレンジ猫はオスの割合が多いことで知られる、日本でも大人気の柄。',
  },
};

const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

export function createPiece(type) {
  return {
    type,
    rotation: 0,
    x: Math.floor(CONFIG.COLS / 2) - 2,
    y: 0,
  };
}

// Absolute board cells for a piece at its current position/rotation.
export function getCells(piece) {
  const shape = SHAPES[piece.type][piece.rotation];
  return shape.map(([dx, dy]) => ({ x: piece.x + dx, y: piece.y + dy }));
}

// Absolute board cells for a piece rotated by `dir` (+1 / -1), without
// mutating the piece — caller checks validity before committing.
export function getRotatedCells(piece, dir) {
  const rotation = (piece.rotation + dir + 4) % 4;
  const shape = SHAPES[piece.type][rotation];
  return {
    rotation,
    cells: shape.map(([dx, dy]) => ({ x: piece.x + dx, y: piece.y + dy })),
  };
}

function shuffledBag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Standard 7-bag randomizer: every piece type appears exactly once per
// bag, so droughts (e.g. no I-piece for 20 pieces) can't happen.
export function makePieceQueue() {
  let bag = shuffledBag();
  return {
    next() {
      if (bag.length === 0) bag = shuffledBag();
      return createPiece(bag.pop());
    },
  };
}
