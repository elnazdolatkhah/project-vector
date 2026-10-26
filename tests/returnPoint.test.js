import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  serializeGameState,
  deserializeGameState,
  applyTurnResult,
  clampLauncherX,
} from '../src/domain/gameState.js';
import { simulateTurn, Simulation } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve, evaluateObjective } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';
import { PHYSICS_CONFIG, INPUT_CONFIG } from '../src/config.js';

test('1: first bottom exit X is deterministic', () => {
  const state = createGameState(LEVELS.L01);
  const angle = 47.5;
  const res1 = simulateTurn(state, angle, { record: false });
  const res2 = simulateTurn(state, angle, { record: false });

  assert.notEqual(res1.firstExitX, null, 'firstExitX should be recorded on bottom exit');
  assert.equal(res1.firstExitX, res2.firstExitX, 'repeated simulation must produce identical firstExitX');
  assert.deepEqual(res1.nextLauncher, res2.nextLauncher, 'nextLauncher must be strictly deterministic');
});

test('2: first exiting ball wins even if later balls exit elsewhere', () => {
  // Construct a state where ball 0 and ball 1 bounce in directions that exit at different times/positions
  const state = createGameState({
    levelId: 'MULTI-EXIT',
    launcher: { x: 360, y: 1180 },
    ballCount: 3,
    blocks: [
      { id: 'B1', x: 200, y: 500, width: 80, height: 40, value: 10, active: true },
    ],
  });

  const sim = new Simulation(state, 60, PHYSICS_CONFIG, { record: false });
  const result = sim.runToCompletion();

  const exitEvents = result.events.filter((e) => e.type === 'BallExited');
  assert.ok(exitEvents.length >= 2, 'expected multiple ball exit events');
  assert.equal(result.firstExitX, exitEvents[0].x, 'result.firstExitX must equal the first exit event X coordinate');
});

test('3: next-turn launcher X equals authoritative first-exit X', () => {
  const state = createGameState(LEVELS.L02);
  const result = simulateTurn(state, 55, { record: false });
  const nextState = applyTurnResult(state, result);

  assert.equal(nextState.launcher.y, state.launcher.y, 'launcher Y baseline must never change');
  assert.equal(nextState.launcher.x, clampLauncherX(result.firstExitX), 'next launcher X must equal clamped firstExitX');
  assert.equal(nextState.turn, state.turn + 1, 'turn must advance by 1');
  assert.equal(nextState.score, state.score + result.score, 'score must accumulate');
});

test('4: launcher X survives serialize -> deserialize', () => {
  const state = createGameState(LEVELS.L01);
  state.launcher.x = 185.42;

  const serialized = serializeGameState(state);
  const loaded = deserializeGameState(serialized);

  assert.equal(loaded.launcher.x, 185.42, 'launcher X must survive serialization round trip');
  assert.equal(loaded.launcher.y, state.launcher.y, 'launcher Y must survive serialization round trip');
});

test('5: Preview and live gameplay produce identical next-launcher X', () => {
  const state = createGameState(LEVELS.L03);
  const angle = 62.0;

  const preview = previewFuture(state, angle, { record: false });
  const live = simulateTurn(state, angle, { record: false });

  assert.notEqual(preview.firstExitX, null);
  assert.equal(preview.firstExitX, live.firstExitX);
  assert.deepEqual(preview.nextLauncher, live.nextLauncher);
});

test('6: Solver replay produces identical next-launcher X', () => {
  const state = createGameState(LEVELS.L01);
  const solution = solve(state, { step: 10, objective: 'destruction', includeRobustness: false });
  const replay = simulateTurn(state, solution.best.angleDeg, { record: false });

  assert.deepEqual(replay.nextLauncher, solution.best.nextLauncher || {
    x: clampLauncherX(replay.firstExitX),
    y: state.launcher.y,
  });
  assert.equal(evaluateObjective(replay, 'destruction'), solution.best.score);
});

test('7: launcher X is clamped correctly near left and right boundaries', () => {
  const minValid = PHYSICS_CONFIG.ballRadius;
  const maxValid = PHYSICS_CONFIG.canvasWidth - PHYSICS_CONFIG.ballRadius;

  assert.equal(clampLauncherX(-50), minValid, 'values below left boundary clamp to ballRadius');
  assert.equal(clampLauncherX(0), minValid, 'values at 0 clamp to ballRadius');
  assert.equal(clampLauncherX(minValid - 1), minValid, 'values just inside wall clamp to ballRadius');
  assert.equal(clampLauncherX(minValid + 10), minValid + 10, 'in-bounds values stay unchanged');
  assert.equal(clampLauncherX(PHYSICS_CONFIG.canvasWidth + 100), maxValid, 'values beyond right boundary clamp to canvasWidth - ballRadius');
  assert.equal(clampLauncherX(maxValid + 5), maxValid, 'values past right wall clamp to maxValid');
});

test('8: canonical 5°–175° aiming still works from a non-centered launcher', () => {
  const offCenterState = createGameState({
    levelId: 'OFF-CENTER',
    launcher: { x: 100, y: 1180 }, // Situated close to left boundary
    ballCount: 1,
    blocks: [{ id: 'B1', x: 300, y: 600, width: 80, height: 60, value: 5, active: true }],
  });

  const testAngles = [INPUT_CONFIG.angleMin, 15, 45, 90, 135, 165, INPUT_CONFIG.angleMax];
  for (const angle of testAngles) {
    const res = simulateTurn(offCenterState, angle, { record: false });
    assert.ok(res.elapsedTime > 0, `angle ${angle} should simulate successfully from off-center launcher`);
    assert.ok(res.nextLauncher.x >= PHYSICS_CONFIG.ballRadius && res.nextLauncher.x <= PHYSICS_CONFIG.canvasWidth - PHYSICS_CONFIG.ballRadius);
  }
});
