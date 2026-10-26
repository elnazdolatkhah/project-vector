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
      score: evaluateObjective(result, objective),
      stats: result.stats,
      ballPickupsCollected,
      nextBallCount: nextGameState.balls.available,
      nextLauncher: result.nextLauncher,
      nextGameState,
      isGameOver: nextGameState.isGameOver,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.angleDeg - b.angleDeg);
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
