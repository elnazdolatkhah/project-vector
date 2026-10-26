import { INPUT_CONFIG } from '../config.js';
import { simulateTurn } from '../physics/simulation.js';
import { analyzeRobustness } from '../future/futureEngine.js';
import { fingerprintGameState, applyTurnResult } from '../domain/gameState.js';

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
