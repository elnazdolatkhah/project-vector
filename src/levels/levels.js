import { BOARD_GEOMETRY, columnX } from '../config.js';

// Canonical geometry helper for blocks
const block = (id, x, y, width, height, value) => ({ id, x, y, width, height, value, active: true });
const pitch = BOARD_GEOMETRY.blockWidth + BOARD_GEOMETRY.interColumnGap;
const halfPitch = pitch / 2;

const row = (prefix, y, values, offset = 0) =>
  values.map((value, i) =>
    block(
      `${prefix}${i}`,
      columnX(i) + offset,
      y,
      BOARD_GEOMETRY.blockWidth,
      BOARD_GEOMETRY.blockHeight,
      value
    )
  );

/**
 * Authored deterministic campaign stages L01–L05.
 * Each level defines:
 * - deliberate initial board layout;
 * - authored deterministic incoming waves with canonical column indexing;
 * - authored per-wave HP and pickup placements;
 * - distinct teaching intent and wave count.
 */
export const LEVELS = Object.freeze({
  L01: {
    levelId: 'L01',
    name: 'Direct',
    rowOriginY: 250,
    totalWaves: 3,
    launcher: { x: 360, y: 1180 },
    ballCount: 18,
    pickups: [
      { id: 'pickup_0', x: columnX(2) + 40, y: 480, radius: 14, active: true },
    ],
    blocks: [
      ...row('A', 250, [6, 7, 7, 8, 8, 7, 7, 6]),
      ...row('B', 318, [5, 6, 7, 8, 8, 7, 6], halfPitch),
      ...row('C', 386, [4, 5, 6, 7, 6, 5, 4, 5]),
    ],
    waves: [
      {
        intent: 'direct-center-open',
        blocks: [{ col: 1, hp: 4 }, { col: 2, hp: 5 }, { col: 5, hp: 5 }, { col: 6, hp: 4 }],
      },
      {
        intent: 'direct-center-pickup',
        blocks: [{ col: 0, hp: 4 }, { col: 1, hp: 5 }, { col: 6, hp: 5 }, { col: 7, hp: 4 }],
        pickupCol: 3,
      },
      {
        intent: 'direct-center-cluster',
        blocks: [{ col: 2, hp: 5 }, { col: 3, hp: 6 }, { col: 4, hp: 6 }, { col: 5, hp: 5 }],
      },
    ],
  },

  L02: {
    levelId: 'L02',
    name: 'Reflection',
    rowOriginY: 235,
    totalWaves: 3,
    launcher: { x: 360, y: 1180 },
    ballCount: 18,
    pickups: [
      { id: 'pickup_0', x: columnX(7) + 40, y: 520, radius: 14, active: true },
    ],
    blocks: [
      ...row('A', 235, [8, 9, 10, 12, 12, 10, 9, 8]),
      ...row('B', 303, [7, 8, 12, 14, 14, 12, 8], halfPitch),
      ...row('C', 371, [6, 7, 10, 12, 12, 10, 7, 6]),
      block('R1', columnX(0), 480, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 12),
      block('R2', columnX(7), 480, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 12),
    ],
    waves: [
      {
        intent: 'center-shield-wall-bank-entry',
        blocks: [{ col: 2, hp: 8 }, { col: 3, hp: 12 }, { col: 4, hp: 12 }, { col: 5, hp: 8 }],
      },
      {
        intent: 'flank-funnel',
        blocks: [{ col: 1, hp: 7 }, { col: 2, hp: 9 }, { col: 5, hp: 9 }, { col: 6, hp: 7 }],
      },
      {
        intent: 'back-pocket-reflection-target',
        blocks: [{ col: 3, hp: 10 }, { col: 4, hp: 10 }],
      },
    ],
  },

  L03: {
    levelId: 'L03',
    name: 'Double Reflection',
    rowOriginY: 220,
    totalWaves: 4,
    launcher: { x: 360, y: 1180 },
    ballCount: 18,
    pickups: [
      { id: 'pickup_0', x: columnX(7) + 40, y: 520, radius: 14, active: true },
    ],
    blocks: [
      ...row('A', 220, [10, 9, 8, 8, 8, 8, 9, 10]),
      ...row('B', 288, [8, 10, 12, 12, 10, 8, 8], halfPitch),
      ...row('C', 356, [7, 8, 10, 10, 8, 7, 8]),
      block('D0', columnX(0), 480, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 14),
      block('D1', columnX(7), 480, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 14),
      block('D2', columnX(1), 500, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 10),
      block('D3', columnX(6), 500, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 10),
    ],
    waves: [
      {
        intent: 'zigzag-stagger-1',
        blocks: [{ col: 0, hp: 8 }, { col: 1, hp: 10 }, { col: 4, hp: 10 }, { col: 5, hp: 8 }],
      },
      {
        intent: 'double-reflection-rebound-funnel',
        blocks: [{ col: 2, hp: 9 }, { col: 3, hp: 11 }, { col: 6, hp: 11 }, { col: 7, hp: 9 }],
      },
      {
        intent: 'rebound-pocket-choke',
        blocks: [{ col: 0, hp: 10 }, { col: 3, hp: 12 }, { col: 4, hp: 12 }, { col: 7, hp: 10 }],
      },
      {
        intent: 'deep-pocket-double-bank',
        blocks: [{ col: 1, hp: 10 }, { col: 2, hp: 11 }, { col: 5, hp: 11 }, { col: 6, hp: 10 }],
      },
    ],
  },

  L04: {
    levelId: 'L04',
    name: 'Multiple Solutions',
    rowOriginY: 230,
    totalWaves: 4,
    launcher: { x: 360, y: 1180 },
    ballCount: 20,
    pickups: [
      { id: 'pickup_0', x: columnX(5) + 40, y: 400, radius: 14, active: true },
    ],
    blocks: [
      ...row('A', 230, [14, 12, 10, 8, 8, 10, 12, 14]),
      ...row('B', 298, [10, 8, 12, 14, 14, 12, 8], halfPitch),
      ...row('C', 366, [8, 10, 12, 14, 12, 10, 8, 9]),
      block('D0', columnX(2), 470, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 12),
      block('D1', columnX(5), 470, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 12),
    ],
    waves: [
      {
        intent: 'branch-choice-destruction-vs-economy',
        blocks: [{ col: 0, hp: 14 }, { col: 1, hp: 12 }, { col: 2, hp: 10 }, { col: 5, hp: 6 }, { col: 6, hp: 6 }],
        pickupCol: 0,
      },
      {
        intent: 'asymmetric-board-pressure',
        blocks: [{ col: 0, hp: 12 }, { col: 1, hp: 10 }, { col: 4, hp: 7 }, { col: 5, hp: 7 }],
      },
      {
        intent: 'consequence-tradeoff-cluster',
        blocks: [{ col: 1, hp: 10 }, { col: 2, hp: 10 }, { col: 6, hp: 8 }, { col: 7, hp: 8 }],
      },
      {
        intent: 'dual-solution-resolution',
        blocks: [{ col: 0, hp: 10 }, { col: 3, hp: 8 }, { col: 4, hp: 8 }, { col: 7, hp: 10 }],
      },
    ],
  },

  L05: {
    levelId: 'L05',
    name: 'Precision',
    rowOriginY: 220,
    totalWaves: 5,
    launcher: { x: 360, y: 1180 },
    ballCount: 20,
    pickups: [
      { id: 'pickup_0', x: columnX(7) + 40, y: 350, radius: 14, active: true },
    ],
    blocks: [
      ...row('A', 220, [16, 15, 14, 14, 14, 14, 15, 16]),
      ...row('B', 288, [12, 11, 10, 18, 18, 10, 11], halfPitch),
      ...row('C', 356, [10, 9, 8, 16, 8, 9, 10, 11]),
      block('P0', (BOARD_GEOMETRY.playableLeft + BOARD_GEOMETRY.playableRight - 92) / 2, 446, 92, 44, 24),
    ],
    waves: [
      {
        intent: 'precision-slot-col3',
        blocks: [{ col: 0, hp: 14 }, { col: 1, hp: 12 }, { col: 2, hp: 12 }, { col: 4, hp: 12 }, { col: 5, hp: 12 }, { col: 6, hp: 12 }, { col: 7, hp: 14 }],
      },
      {
        intent: 'dual-precision-slits',
        blocks: [{ col: 0, hp: 12 }, { col: 2, hp: 10 }, { col: 3, hp: 10 }, { col: 4, hp: 10 }, { col: 5, hp: 10 }, { col: 7, hp: 12 }],
      },
      {
        intent: 'tight-channel-offset',
        blocks: [{ col: 1, hp: 12 }, { col: 2, hp: 12 }, { col: 3, hp: 12 }, { col: 5, hp: 12 }, { col: 6, hp: 12 }, { col: 7, hp: 12 }],
      },
      {
        intent: 'danger-pressure-precision-gates',
        blocks: [{ col: 0, hp: 12 }, { col: 1, hp: 12 }, { col: 3, hp: 12 }, { col: 4, hp: 12 }, { col: 6, hp: 12 }, { col: 7, hp: 12 }],
      },
      {
        intent: 'final-precision-breach',
        blocks: [{ col: 0, hp: 10 }, { col: 1, hp: 10 }, { col: 2, hp: 10 }, { col: 5, hp: 10 }, { col: 6, hp: 10 }, { col: 7, hp: 10 }],
      },
    ],
  },
});
