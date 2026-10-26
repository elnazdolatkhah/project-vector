import { BOARD_GEOMETRY, columnX } from '../config.js';

// These are migration fixtures shaped for the mobile case-study surface.
// They are NOT final production levels. Keep level geometry in data, never UI code.
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

export const LEVELS = Object.freeze({
  L01: {
    levelId: 'L01', name: 'Direct', rowOriginY: 250, totalWaves: 3, launcher: { x: 360, y: 1180 }, ballCount: 18,
    blocks: [
      ...row('A', 250, [8, 9, 10, 10, 9, 8, 7, 8]),
      ...row('B', 318, [7, 8, 9, 11, 11, 9, 8], halfPitch),
      ...row('C', 386, [6, 7, 8, 9, 8, 7, 6, 7]),
    ],
  },
  L02: {
    levelId: 'L02', name: 'Reflection', rowOriginY: 235, totalWaves: 3, launcher: { x: 360, y: 1180 }, ballCount: 20,
    blocks: [
      ...row('A', 235, [12, 11, 10, 9, 10, 11, 12, 13]),
      ...row('B', 303, [8, 9, 10, 12, 12, 10, 9], halfPitch),
      ...row('C', 371, [7, 8, 9, 10, 9, 8, 7, 8]),
      block('R1', columnX(0), 480, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 14),
      block('R2', columnX(7), 480, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 14),
    ],
  },
  L03: {
    levelId: 'L03', name: 'Double Reflection', rowOriginY: 220, totalWaves: 3, launcher: { x: 360, y: 1180 }, ballCount: 22,
    blocks: [
      ...row('A', 220, [14, 13, 12, 11, 12, 13, 14, 15]),
      ...row('B', 288, [9, 10, 11, 13, 13, 11, 10], halfPitch),
      ...row('C', 356, [8, 9, 10, 11, 10, 9, 8, 9]),
      block('D0', columnX(1), 468, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 10),
      block('D1', columnX(6), 468, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 10),
    ],
  },
  L04: {
    levelId: 'L04', name: 'Multiple Solutions', rowOriginY: 230, totalWaves: 3, launcher: { x: 360, y: 1180 }, ballCount: 24,
    blocks: [
      ...row('A', 230, [15, 13, 11, 9, 9, 11, 13, 15]),
      ...row('B', 298, [10, 8, 12, 14, 14, 12, 8], halfPitch),
      ...row('C', 366, [8, 10, 12, 16, 12, 10, 8, 9]),
      block('D0', columnX(2), 470, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 12),
      block('D1', columnX(5), 470, BOARD_GEOMETRY.blockWidth, BOARD_GEOMETRY.blockHeight, 12),
    ],
  },
  L05: {
    levelId: 'L05', name: 'Precision', rowOriginY: 220, totalWaves: 3, launcher: { x: 360, y: 1180 }, ballCount: 24,
    blocks: [
      ...row('A', 220, [18, 17, 16, 15, 15, 16, 17, 18]),
      ...row('B', 288, [12, 11, 10, 22, 22, 10, 11], halfPitch),
      ...row('C', 356, [10, 9, 8, 20, 8, 9, 10, 11]),
      block('P0', (BOARD_GEOMETRY.playableLeft + BOARD_GEOMETRY.playableRight - 92) / 2, 446, 92, 44, 28),
    ],
  },
});
