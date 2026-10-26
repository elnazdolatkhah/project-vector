import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUT_CONFIG } from '../src/config.js';
import { createGameState } from '../src/domain/gameState.js';
import { LEVELS } from '../src/levels/levels.js';
import { Simulation, simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';

test('canonical INPUT_CONFIG allows the canonical aim domain (5°–175°)', () => {
  assert.equal(INPUT_CONFIG.angleMin, 5);
  assert.equal(INPUT_CONFIG.angleMax, 175);

  const state = createGameState(LEVELS.L01);
  assert.throws(() => simulateTurn(state, 1), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 4.9), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 175.1), /angleDeg must be between 5 and 175/);
  assert.throws(() => simulateTurn(state, 179), /angleDeg must be between 5 and 175/);
});

test('an angle below 90° produces a rightward initial X component', () => {
  const state = createGameState(LEVELS.L01);
  const sim = new Simulation(state, 45, undefined, { record: false });
  assert.ok(sim.launchVelocity.x > 0, 'expected rightward X velocity for angle < 90°');
  assert.ok(sim.launchVelocity.y < 0, 'expected upward Y velocity');
});

test('90° produces an approximately vertical shot', () => {
  const state = createGameState(LEVELS.L01);
  const sim = new Simulation(state, 90, undefined, { record: false });
  assert.ok(Math.abs(sim.launchVelocity.x) < 1e-6, 'expected near-zero X velocity for 90°');
  assert.ok(sim.launchVelocity.y < 0, 'expected upward Y velocity for 90°');
});

test('an angle above 90° produces a leftward initial X component', () => {
  const state = createGameState(LEVELS.L01);
  const sim = new Simulation(state, 135, undefined, { record: false });
  assert.ok(sim.launchVelocity.x < 0, 'expected leftward X velocity for angle > 90°');
  assert.ok(sim.launchVelocity.y < 0, 'expected upward Y velocity for 135°');
});

test('135° can be simulated deterministically', () => {
  const state = createGameState(LEVELS.L02);
  const run1 = simulateTurn(state, 135, { record: false });
  const run2 = simulateTurn(state, 135, { record: false });

  assert.deepEqual(run1.stats, run2.stats);
  assert.deepEqual(run1.finalBlocks, run2.finalBlocks);
  assert.deepEqual(run1.events, run2.events);
  assert.equal(run1.score, run2.score);
});

test('pointer aiming can resolve a valid upper-left angle rather than clamping it to 89°', () => {
  const launcher = { x: 360, y: 1180 };
  // A touch position located up and to the left of the launcher
  const worldTouch = { x: 160, y: 980 }; // dx = -200, dy = 200

  const dx = worldTouch.x - launcher.x;
  const dy = Math.max(0.001, launcher.y - worldTouch.y);
  const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const clampedAngle = Math.max(INPUT_CONFIG.angleMin, Math.min(INPUT_CONFIG.angleMax, rawAngle));

  assert.ok(clampedAngle > 89, `expected angle > 89°, got ${clampedAngle}°`);
  assert.ok(Math.abs(clampedAngle - 135) < 1e-4, `expected 135°, got ${clampedAngle}°`);
});

test('solver and Future Preview support the full 5°–175° range', () => {
  const state = createGameState(LEVELS.L01);

  // Future preview at extreme left
  const leftFuture = previewFuture(state, 175, { record: false });
  assert.ok(leftFuture.result, 'previewFuture should succeed at 175°');
  assert.equal(leftFuture.angleDeg, 175);
  assert.equal(leftFuture.timedOut, false);
  assert.equal(leftFuture.completed, true);

  // Future preview at extreme right
  const rightFuture = previewFuture(state, 5, { record: false });
  assert.ok(rightFuture.result, 'previewFuture should succeed at 5°');
  assert.equal(rightFuture.angleDeg, 5);
  assert.equal(rightFuture.timedOut, false);
  assert.equal(rightFuture.completed, true);

  // Solver over full 5°–175° domain
  const solution = solve(state, {
    angleMin: 5,
    angleMax: 175,
    step: 25,
    objective: 'destruction',
    includeRobustness: true,
  });

  assert.ok(solution.best, 'solver should return a best candidate');
  assert.ok(solution.candidates.length >= 7, 'solver should test candidates across 5°–175°');
  assert.ok(solution.candidates.some((c) => c.angleDeg > 90), 'solver candidates must include angles > 90°');
  assert.ok(solution.candidates.some((c) => c.angleDeg < 90), 'solver candidates must include angles < 90°');
});
