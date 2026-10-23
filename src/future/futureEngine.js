import { simulateTurn } from '../physics/simulation.js';
import { INPUT_CONFIG } from '../config.js';
import { fingerprintGameState } from '../domain/gameState.js';

export function blockHP(blocks) {
  return blocks.filter((b) => b.active).reduce((sum, b) => sum + Math.max(0, b.value), 0);
}

export function previewFuture(gameState, angleDeg, { record = true } = {}) {
  const initialHP = blockHP(gameState.blocks);
  const initialBlocks = gameState.blocks.filter((b) => b.active).length;
  const result = simulateTurn(gameState, angleDeg, { record });
  const remainingHP = blockHP(result.finalBlocks);
  const remainingBlocks = result.finalBlocks.filter((b) => b.active).length;
  return {
    stateFingerprint: fingerprintGameState(gameState),
    physicsVersion: gameState.physicsVersion,
    angleDeg,
    hits: result.stats.hits,
    destroyed: result.stats.destroyed,
    damage: Math.max(0, initialHP - remainingHP),
    remainingHP,
    remainingBlocks,
    initialHP,
    initialBlocks,
    trajectories: result.trajectories,
    result,
  };
}

export function utilityForRobustness(future) {
  return future.destroyed * 10 + future.damage;
}

export function analyzeRobustness(gameState, centerAngle, offsets = [-1, -0.5, 0, 0.5, 1]) {
  const futures = offsets.map((offset) => {
    const angle = clamp(centerAngle + offset, INPUT_CONFIG.angleMin, INPUT_CONFIG.angleMax);
    return previewFuture(gameState, angle, { record: false });
  });
  const centerIndex = offsets.findIndex((offset) => offset === 0);
  const center = futures[centerIndex >= 0 ? centerIndex : Math.floor(futures.length / 2)];
  const base = Math.max(1, utilityForRobustness(center));
  const acceptable = futures.filter((future) => utilityForRobustness(future) >= base * 0.8).length;
  return { percent: Math.round((acceptable / futures.length) * 100), futures };
}

export function compareFutures(gameState, angles) {
  return angles.map((angleDeg) => {
    const future = previewFuture(gameState, angleDeg, { record: false });
    const robustness = analyzeRobustness(gameState, angleDeg).percent;
    return { ...future, robustness };
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
