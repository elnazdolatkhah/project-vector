export const PHYSICS_CONFIG = Object.freeze({
  canvasWidth: 720,
  canvasHeight: 1280,
  ballRadius: 6,
  ballSpeed: 10,
  gravity: 0,
  fixedDt: 1 / 60,
  spawnInterval: 0.08,
  maxSimulationTime: 30,
  collisionEpsilon: 0.0001,
  maxCollisionsPerStep: 8,
});

// Canonical player aim domain = full upward hemisphere, 1°–179°.
export const INPUT_CONFIG = Object.freeze({
  angleMin: 1,
  angleMax: 179,
  angleStep: 0.1,
});

export const BOARD_GEOMETRY = Object.freeze({
  playableLeft: 8,
  playableRight: 712,
  columnCount: 8,
  interColumnGap: 12,
  blockWidth: 77.5,
  blockHeight: 56,
});

export function columnX(col) {
  if (col < 0 || col >= BOARD_GEOMETRY.columnCount) {
    throw new RangeError(`Column index ${col} out of range [0, ${BOARD_GEOMETRY.columnCount - 1}]`);
  }
  return BOARD_GEOMETRY.playableLeft + col * (BOARD_GEOMETRY.blockWidth + BOARD_GEOMETRY.interColumnGap);
}

export const PROGRESSION_CONFIG = Object.freeze({
  rowStep: 68,
  defaultRowOriginY: 220,
  topRowY: 220,
  dangerLineY: 1060,
  columnCount: BOARD_GEOMETRY.columnCount,
  columnSpacing: BOARD_GEOMETRY.blockWidth + BOARD_GEOMETRY.interColumnGap,
  startX: BOARD_GEOMETRY.playableLeft,
  blockWidth: BOARD_GEOMETRY.blockWidth,
  blockHeight: BOARD_GEOMETRY.blockHeight,
  interColumnGap: BOARD_GEOMETRY.interColumnGap,
  playableLeft: BOARD_GEOMETRY.playableLeft,
  playableRight: BOARD_GEOMETRY.playableRight,
  pickupRadius: 14,
  pickupSpawnCadence: 3,
  transitionDurationMs: 220,
});

export const VERSION = Object.freeze({
  schemaVersion: '1.1',
  gameVersion: '0.1',
  physicsVersion: '1.0',
  migrationVersion: 'AI-STUDIO-v1',
});

