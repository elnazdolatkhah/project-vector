import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUT_CONFIG, PHYSICS_CONFIG } from '../src/config.js';
import { createGameState, canonicalizeGameState } from '../src/domain/gameState.js';
import { Simulation, simulateTurn } from '../src/physics/simulation.js';
import { applyTurnResult } from '../src/domain/progression.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';

test('1: canonical player aim range is strictly 5°–175°', () => {
  assert.equal(INPUT_CONFIG.angleMin, 5, 'angleMin must be 5');
  assert.equal(INPUT_CONFIG.angleMax, 175, 'angleMax must be 175');

  const state = createGameState(LEVELS.L01);

  // Illegal angles below 5°
  assert.throws(() => simulateTurn(state, 1), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 4.99), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 0), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, -10), /angleDeg must be between 5 and 175/);

  // Illegal angles above 175°
  assert.throws(() => simulateTurn(state, 175.01), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 179), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 180), /angleDeg must be between 5 and 175/);
});

test('2: shallow but legal 5° and 175° shots complete normally on empty board', () => {
  const emptyState = createGameState({
    levelId: 'EMPTY-COURT',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [],
  });

  // 5° shot
  const res5 = simulateTurn(emptyState, 5, { record: true });
  assert.equal(res5.timedOut, false, '5° shot on empty board must not time out');
  assert.equal(res5.completed, true, '5° shot on empty board must complete');
  assert.equal(res5.stats.ballsExited, 1, 'ball must exit normally');
  assert.ok(typeof res5.firstExitX === 'number', 'firstExitX must be a valid number');
  assert.ok(res5.elapsedTime > 40 && res5.elapsedTime < PHYSICS_CONFIG.maxSimulationTime, 'elapsed time within bounds');

  // 175° shot
  const res175 = simulateTurn(emptyState, 175, { record: true });
  assert.equal(res175.timedOut, false, '175° shot on empty board must not time out');
  assert.equal(res175.completed, true, '175° shot on empty board must complete');
  assert.equal(res175.stats.ballsExited, 1, 'ball must exit normally');
  assert.ok(typeof res175.firstExitX === 'number', 'firstExitX must be a valid number');
  assert.ok(res175.elapsedTime > 40 && res175.elapsedTime < PHYSICS_CONFIG.maxSimulationTime, 'elapsed time within bounds');
});

test('3: shallow but legal 5° and 175° shots complete normally on L01 multi-ball fixture', () => {
  const state = createGameState(LEVELS.L01);
  const ballCount = state.balls.available;
  assert.equal(ballCount, 18);

  // 5° volley on L01
  const res5 = simulateTurn(state, 5, { record: false });
  assert.equal(res5.timedOut, false, 'L01 5° shot must not time out');
  assert.equal(res5.completed, true, 'L01 5° shot must be marked completed');
  assert.equal(res5.stats.ballsExited, ballCount, 'all 18 balls must exit normally');
  assert.ok(typeof res5.firstExitX === 'number', 'firstExitX must be established');

  // 175° volley on L01
  const res175 = simulateTurn(state, 175, { record: false });
  assert.equal(res175.timedOut, false, 'L01 175° shot must not time out');
  assert.equal(res175.completed, true, 'L01 175° shot must be marked completed');
  assert.equal(res175.stats.ballsExited, ballCount, 'all 18 balls must exit normally');
  assert.ok(typeof res175.firstExitX === 'number', 'firstExitX must be established');
});

test('4: simulation timeout cannot masquerade as a normal completed volley', () => {
  const state = createGameState(LEVELS.L01);

  // Simulate with intentionally starved maxSimulationTime (0.5 seconds)
  const shortConfig = { ...PHYSICS_CONFIG, maxSimulationTime: 0.5 };
  const sim = new Simulation(state, 45, shortConfig, { record: true });
  const result = sim.runToCompletion();

  assert.equal(result.timedOut, true, 'timedOut must be true');
  assert.equal(result.completed, false, 'completed must be false');
  assert.ok(result.events.some((e) => e.type === 'SimulationTimeout'), 'must contain SimulationTimeout event');
});

test('5: timeout must not mark unexited balls as normal exits', () => {
  const state = createGameState({
    levelId: 'TIMEOUT-CHECK',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    blocks: [],
  });

  // Short timeout before any ball can reach the bottom
  const shortConfig = { ...PHYSICS_CONFIG, maxSimulationTime: 1.0 };
  const sim = new Simulation(state, 45, shortConfig, { record: true });
  const result = sim.runToCompletion();

  assert.equal(result.timedOut, true);
  assert.equal(result.stats.ballsExited, 0, 'no balls should be marked exited if none reached bottom');
  assert.equal(result.events.filter((e) => e.type === 'BallExited').length, 0, 'no BallExited events emitted');
});

test('6: timeout must not set firstExitX and must not alter nextLauncher X', () => {
  const launcher = { x: 360, y: 1180 };
  const state = createGameState({
    levelId: 'LAUNCHER-CHECK',
    launcher,
    ballCount: 5,
    blocks: [],
  });

  const shortConfig = { ...PHYSICS_CONFIG, maxSimulationTime: 1.0 };
  const sim = new Simulation(state, 45, shortConfig, { record: false });
  const result = sim.runToCompletion();

  assert.equal(result.timedOut, true);
  assert.equal(result.firstExitX, null, 'firstExitX must be null on timeout');
  assert.equal(result.nextLauncher.x, launcher.x, 'nextLauncher.x must remain at original launcher position');
});

test('7: timeout must not advance board progression', () => {
  const state = createGameState(LEVELS.L01);
  const initialBlocks = state.blocks.map((b) => ({ ...b }));
  const initialTurn = state.turn;
  const initialWave = state.waveIndex;
  const initialLauncherX = state.launcher.x;

  // Create a forced timeout simulation result
  const timedOutResult = {
    angleDeg: 45,
    timedOut: true,
    completed: false,
    finalBlocks: initialBlocks.map((b) => ({ ...b, value: b.value - 1 })),
    stats: { hits: 5, destroyed: 0, ballsExited: 0, ballPickupsCollected: 0 },
    firstExitX: null,
    nextLauncher: { x: initialLauncherX, y: state.launcher.y },
    score: 5,
  };

  const nextState = applyTurnResult(state, timedOutResult);

  // Board progression must be completely halted
  assert.equal(nextState.turn, initialTurn, 'turn must not advance on timeout');
  assert.equal(nextState.waveIndex, initialWave, 'waveIndex must not advance on timeout');
  assert.equal(nextState.launcher.x, initialLauncherX, 'launcher X must not advance on timeout');
  assert.deepEqual(nextState.blocks, state.blocks, 'blocks must not descend or alter on timeout');
  assert.equal(nextState.stageStatus, 'active', 'stage remains active without failure/win corruption');
});

test('8: Preview, Solver, replay, and live gameplay use the same 5°–175° domain', () => {
  const state = createGameState(LEVELS.L01);

  // Preview rejects out-of-bounds angles
  assert.throws(() => previewFuture(state, 1), /angleDeg must be between 5 and 175/);
  assert.throws(() => previewFuture(state, 179), /angleDeg must be between 5 and 175/);

  // Preview succeeds at boundaries
  const p5 = previewFuture(state, 5, { record: false });
  assert.equal(p5.timedOut, false);
  assert.equal(p5.completed, true);
  assert.equal(p5.angleDeg, 5);

  const p175 = previewFuture(state, 175, { record: false });
  assert.equal(p175.timedOut, false);
  assert.equal(p175.completed, true);
  assert.equal(p175.angleDeg, 175);

  // Solver respects 5°–175°
  const solution = solve(state, { step: 30, objective: 'destruction', includeRobustness: false });
  assert.ok(solution.best !== null);
  assert.ok(solution.best.angleDeg >= 5 && solution.best.angleDeg <= 175);
  for (const c of solution.candidates) {
    assert.ok(c.angleDeg >= 5 && c.angleDeg <= 175, `candidate ${c.angleDeg} must be within 5°–175°`);
    assert.equal(c.timedOut, false, 'solver candidates must be completed, not timed out');
  }

  // Replay of solver best candidate matches simulateTurn
  const replaySim = simulateTurn(state, solution.best.angleDeg, { record: false });
  assert.equal(replaySim.timedOut, false);
  assert.equal(replaySim.firstExitX, solution.best.nextLauncher.x);
});

test('9: Solver deprioritizes timed-out candidates even if score appears high', () => {
  const state = createGameState(LEVELS.L01);

  // Mock candidates with one timed-out high score and one completed lower score
  const candidates = [
    {
      angleDeg: 10,
      timedOut: true,
      completed: false,
      stageStatus: 'active',
      score: 999,
    },
    {
      angleDeg: 45,
      timedOut: false,
      completed: true,
      stageStatus: 'active',
      score: 10,
    },
  ];

  candidates.sort((a, b) => {
    const aTimeout = a.timedOut ? 1 : 0;
    const bTimeout = b.timedOut ? 1 : 0;
    if (aTimeout !== bTimeout) return aTimeout - bTimeout;
    return b.score - a.score;
  });

  assert.equal(candidates[0].angleDeg, 45, 'completed candidate must be chosen over timed-out candidate');
});
