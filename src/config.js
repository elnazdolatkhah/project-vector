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

// Canonical Master Spec v1.0. Do not widen without an explicit design decision.
export const INPUT_CONFIG = Object.freeze({
  angleMin: 1,
  angleMax: 89,
  angleStep: 0.1,
});

export const VERSION = Object.freeze({
  schemaVersion: '1.0',
  gameVersion: '0.1',
  physicsVersion: '1.0',
  migrationVersion: 'AI-STUDIO-v1',
});
