import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/domain/gameState.js';
import { LEVELS } from '../src/levels/levels.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { solve, evaluateObjective } from '../src/solver/solver.js';

test('Preview and live simulation are the same authoritative result', () => {
  const state = createGameState(LEVELS.L04);
  const angle = 52.5;
  const preview = previewFuture(state, angle, { record: false });
  const live = simulateTurn(state, angle, { record: false });
  assert.deepEqual(preview.result.stats, live.stats);
  assert.deepEqual(preview.result.finalBlocks, live.finalBlocks);
  assert.deepEqual(preview.result.events, live.events);
});

test('Solver best candidate replays identically through simulateTurn', () => {
  const state = createGameState(LEVELS.L01);
  const solution = solve(state, { step: 5, objective: 'destruction', includeRobustness: false });
  const replay = simulateTurn(state, solution.best.angleDeg, { record: false });
  assert.equal(evaluateObjective(replay, 'destruction'), solution.best.score);
});

test('Solver tie-break is deterministic: smaller angle wins equal score', () => {
  const state = createGameState({
    levelId: 'EMPTY', launcher: { x: 360, y: 1180 }, ballCount: 1, blocks: [],
  });
  const solution = solve(state, { angleMin: 10, angleMax: 30, step: 10, objective: 'destruction', includeRobustness: false });
  assert.equal(solution.best.angleDeg, 10);
});
