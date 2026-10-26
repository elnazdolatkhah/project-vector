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

export const PROGRESSION_CONFIG = Object.freeze({
  rowStep: 68,
  defaultRowOriginY: 220,
  topRowY: 220,
  dangerLineY: 1060,
  columnCount: 8,
  columnSpacing: 82,
  startX: 34,
  blockWidth: 70,
  blockHeight: 56,
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

