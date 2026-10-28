import { INPUT_CONFIG } from '../config.js';
import { simulateTurn } from '../physics/simulation.js';
import { analyzeRobustness, previewFuture } from '../future/futureEngine.js';
import { fingerprintGameState, applyTurnResult, computeDangerMargin } from '../domain/gameState.js';

export function evaluateObjective(result, objective = 'destruction') {
  if (objective === 'damage') return result.stats.hits;
  return result.stats.destroyed;
}

export function solve(gameState, {
  angleMin = INPUT_CONFIG.angleMin,
  angleMax = INPUT_CONFIG.angleMax,
  step = 0.5,
  objective = 'destruction',
  includeRobustness = true,
} = {}) {
  const candidates = [];
  for (let angle = angleMin; angle <= angleMax + 1e-9; angle += step) {
    const angleDeg = Math.round(angle * 1000) / 1000;
    const result = simulateTurn(gameState, angleDeg, { record: false });
    const nextGameState = applyTurnResult(gameState, result);
    const ballPickupsCollected = result.ballPickupsCollected ?? result.collectedPickups?.length ?? 0;
    const dangerMargin = computeDangerMargin(nextGameState);

    candidates.push({
      angleDeg,
      objective,
      timedOut: Boolean(result.timedOut),
      completed: Boolean(result.completed),
      score: evaluateObjective(result, objective),
      stats: result.stats,
      ballPickupsCollected,
      nextBallCount: nextGameState.balls.available,
      nextLauncher: result.nextLauncher,
      nextGameState,
      dangerMargin,
      stageStatus: nextGameState.stageStatus,
      isGameOver: nextGameState.isGameOver,
    });
  }

  candidates.sort((a, b) => {
    // 0. Completed candidates strictly dominate timed-out candidates
    const aTimeout = a.timedOut ? 1 : 0;
    const bTimeout = b.timedOut ? 1 : 0;
    if (aTimeout !== bTimeout) return aTimeout - bTimeout;

    // 1. Non-failed candidates strictly dominate failed candidates
    const aFailed = a.stageStatus === 'failed' ? 1 : 0;
    const bFailed = b.stageStatus === 'failed' ? 1 : 0;
    if (aFailed !== bFailed) return aFailed - bFailed;

    // 2. Won candidates prioritize completion
    const aWon = a.stageStatus === 'won' ? 1 : 0;
    const bWon = b.stageStatus === 'won' ? 1 : 0;
    if (aWon !== bWon) return bWon - aWon;

    // 3. Score evaluation
    if (b.score !== a.score) return b.score - a.score;

    // 4. Deterministic tie-break by smaller angle
    return a.angleDeg - b.angleDeg;
  });
  const best = candidates[0];
  if (includeRobustness && best) best.robustness = analyzeRobustness(gameState, best.angleDeg).percent;

  return {
    stateFingerprint: fingerprintGameState(gameState),
    physicsVersion: gameState.physicsVersion,
    objective,
    angleRange: [angleMin, angleMax],
    step,
    best,
    candidates,
  };
}

/**
 * Classifies an authoritative candidate future by consequence and rebound geometry.
 */
export function classifyCandidateFuture(gameState, angleDeg) {
  const preview = previewFuture(gameState, angleDeg, { record: true });
  const events = preview.result.events;
  const b0Events = events.filter((e) => e.ballId === 'ball0');
  const firstBlockIdx = b0Events.findIndex((e) => e.type === 'BlockCollision');

  const leadWallRebounds = b0Events.filter(
    (e, idx) => e.type === 'WallCollision' && (firstBlockIdx === -1 || idx < firstBlockIdx)
  ).length;

  const leadSideWallRebounds = b0Events.filter(
    (e, idx) => e.type === 'WallCollision' && e.normal?.x !== 0 && (firstBlockIdx === -1 || idx < firstBlockIdx)
  ).length;

  const wallReboundCount = events.filter((e) => e.type === 'WallCollision').length;
  const sideWallRebounds = events.filter((e) => e.type === 'WallCollision' && e.normal?.x !== 0).length;
  const blockReboundCount = preview.hits;

  return {
    angle: angleDeg,
    angleDeg,
    damage: preview.damage,
    destroyed: preview.destroyed,
    pickups: preview.ballPickupsCollected,
    ballPickupsCollected: preview.ballPickupsCollected,
    nextBallCount: preview.nextBallCount,
    dangerMargin: preview.dangerMargin,
    nextLauncherX: preview.nextLauncher?.x ?? gameState.launcher.x,
    stageStatus: preview.stageStatus,
    wallReboundCount,
    leadWallRebounds,
    sideWallRebounds,
    leadSideWallRebounds,
    blockReboundCount,
    timedOut: Boolean(preview.timedOut),
    completed: Boolean(preview.completed),
    preview,
  };
}

/**
 * Non-player-facing design/solver analysis report.
 * Samples candidate angles on an authored stage and reports consequences:
 * angle, damage, destroyed, pickups, next ball count, danger margin,
 * next launcher X, stageStatus, wall rebound counts, and block rebound count.
 */
export function analyzeStageFutures(gameState, sampleAngles = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]) {
  const samples = sampleAngles.map((angleDeg) => {
    const classification = classifyCandidateFuture(gameState, angleDeg);
    const { preview, ...sample } = classification;
    return sample;
  });

  const uniqueOutcomes = new Set(
    samples.map(
      (s) => `${s.damage}|${s.destroyed}|${s.pickups}|${Math.round(s.nextLauncherX)}|${s.stageStatus}|${Math.round(s.dangerMargin)}`
    )
  );

  return {
    levelId: gameState.levelId,
    sampleCount: samples.length,
    distinctFuturesCount: uniqueOutcomes.size,
    samples,
  };
}
