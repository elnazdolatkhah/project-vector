import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_GEOMETRY,
  columnX,
  PHYSICS_CONFIG,
  INPUT_CONFIG,
  PROGRESSION_CONFIG,
} from '../src/config.js';
import {
  createGameState,
  serializeGameState,
  deserializeGameState,
  applyTurnResult,
  clampLauncherX,
} from '../src/domain/gameState.js';
import { simulateTurn, Simulation } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';
import { sweptCircleVsAABB } from '../src/physics/collision.js';

// --- PART A: EDGE-SEALED PLAYFIELD GEOMETRY TESTS ---

test('Part A - 1: Full 8-column row has no traversable side corridor for standard ball radius (6)', () => {
  // Left wall is at x=0; left edge of col 0 is at columnX(0) = playableLeft = 8.
  const leftGap = BOARD_GEOMETRY.playableLeft - 0;
  // Right wall is at canvasWidth = 720; right edge of col 7 is columnX(7) + blockWidth = 712.
  const col7Right = columnX(7) + BOARD_GEOMETRY.blockWidth;
  const rightGap = PHYSICS_CONFIG.canvasWidth - col7Right;
  const standardBallDiameter = PHYSICS_CONFIG.ballRadius * 2; // 12

  assert.equal(leftGap, 8, 'Left gap must be 8 world units');
  assert.equal(col7Right, 712, 'Column 7 right edge must be 712 world units');
  assert.equal(rightGap, 8, 'Right gap must be 8 world units');
  assert.ok(
    leftGap < standardBallDiameter,
    `Left gap (${leftGap}) must be strictly less than standard ball diameter (${standardBallDiameter})`
  );
  assert.ok(
    rightGap < standardBallDiameter,
    `Right gap (${rightGap}) must be strictly less than standard ball diameter (${standardBallDiameter})`
  );
});

test('Part A - 2: Left edge block prevents wall-scrape passage', () => {
  // Construct a row where col 0 is occupied: x=8, width=77.5, y=300, height=56
  const col0Block = {
    id: 'B_COL0',
    x: columnX(0),
    y: 300,
    width: BOARD_GEOMETRY.blockWidth,
    height: BOARD_GEOMETRY.blockHeight,
    value: 50,
    active: true,
  };

  // Attempt to fire a ball from below (e.g. x=4, y=400) vertically upward (dx=0, dy=-150)
  // along the 8-unit left corridor (between wall x=0 and block x=8).
  // Ball radius is 6. Ball center at x=4 touches left wall at x-6=-2 (<0) and block at x+6=10 (>8).
  // Swept circle must detect collision with the block or wall before passing through y=300.
  const hit = sweptCircleVsAABB({ x: 4, y: 400 }, { x: 0, y: -150 }, PHYSICS_CONFIG.ballRadius, col0Block);
  assert.ok(hit !== null, 'Ball attempting to pass left edge must collide with column 0 block');
  assert.ok(hit.t <= 1.0, 'Collision must occur within movement segment');

  // Verify full simulation cannot scrape past the left edge into the top board
  const state = createGameState({
    levelId: 'TEST-SEAL-LEFT',
    launcher: { x: 4, y: 1180 },
    ballCount: 1,
    blocks: [col0Block],
  });
  // Aim nearly vertical (89.5 deg) hugging the left wall
  const sim = new Simulation(state, 89.5, PHYSICS_CONFIG);
  const result = sim.runToCompletion();

  // Ball must hit col0Block and not pass above it untouched
  const blockHits = result.events.filter((e) => e.type === 'BlockCollision' && e.blockId === 'B_COL0');
  assert.ok(blockHits.length > 0, 'Ball must hit the left edge block when fired near left edge');
});

test('Part A - 3: Right edge block prevents wall-scrape passage', () => {
  // Construct a row where col 7 is occupied: x=634.5, width=77.5 (ends at 712), y=300
  const col7Block = {
    id: 'B_COL7',
    x: columnX(7),
    y: 300,
    width: BOARD_GEOMETRY.blockWidth,
    height: BOARD_GEOMETRY.blockHeight,
    value: 50,
    active: true,
  };

  // Attempt to fire upward along the 8-unit right corridor (between block right edge 712 and wall 720)
  const hit = sweptCircleVsAABB({ x: 716, y: 400 }, { x: 0, y: -150 }, PHYSICS_CONFIG.ballRadius, col7Block);
  assert.ok(hit !== null, 'Ball attempting to pass right edge must collide with column 7 block');
  assert.ok(hit.t <= 1.0, 'Collision must occur within movement segment');

  const state = createGameState({
    levelId: 'TEST-SEAL-RIGHT',
    launcher: { x: 716, y: 1180 },
    ballCount: 1,
    blocks: [col7Block],
  });
  const sim = new Simulation(state, 90.5, PHYSICS_CONFIG);
  const result = sim.runToCompletion();

  const blockHits = result.events.filter((e) => e.type === 'BlockCollision' && e.blockId === 'B_COL7');
  assert.ok(blockHits.length > 0, 'Ball must hit the right edge block when fired near right edge');
});

test('Part A - 4: An intentionally empty edge column DOES create a valid traversable route', () => {
  // Col 0 is empty; col 1 is occupied.
  // Corridor between wall (x=0) and col 1 (x=columnX(1)=97.5) has width 97.5 units.
  // Ball radius 6 (diameter 12) easily passes through this 97.5 unit space without touching col 1 block!
  const col1Block = {
    id: 'B_COL1',
    x: columnX(1),
    y: 300,
    width: BOARD_GEOMETRY.blockWidth,
    height: BOARD_GEOMETRY.blockHeight,
    value: 10,
    active: true,
  };

  const passageWidth = columnX(1) - 0;
  assert.equal(passageWidth, 97.5, 'Open col 0 corridor width must be 97.5 world units');
  assert.ok(
    passageWidth > PHYSICS_CONFIG.ballRadius * 4,
    'Corridor width must comfortably exceed ball diameter'
  );

  // Ball at x=40 moving vertically upward through the empty column 0
  const hit = sweptCircleVsAABB({ x: 40, y: 400 }, { x: 0, y: -200 }, PHYSICS_CONFIG.ballRadius, col1Block);
  assert.equal(hit, null, 'Ball in open column 0 corridor must not collide with column 1 block');

  // Verify that an intentional opening at col 7 (col 7 empty, col 6 occupied) is also traversable
  const col6Right = columnX(6) + BOARD_GEOMETRY.blockWidth; // 545 + 77.5 = 622.5
  const rightCorridorWidth = PHYSICS_CONFIG.canvasWidth - col6Right; // 720 - 622.5 = 97.5
  assert.equal(rightCorridorWidth, 97.5, 'Open col 7 corridor width must be 97.5 world units');
  const hitRight = sweptCircleVsAABB(
    { x: 670, y: 400 },
    { x: 0, y: -200 },
    PHYSICS_CONFIG.ballRadius,
    { id: 'B_COL6', x: columnX(6), y: 300, width: BOARD_GEOMETRY.blockWidth, height: BOARD_GEOMETRY.blockHeight }
  );
  assert.equal(hitRight, null, 'Ball in open column 7 corridor must not collide with column 6 block');
});

test('Part A - 5: Preview and live simulation agree on edge-path accessibility', () => {
  // A row with col 0 missing, cols 1..7 present, and a high-value block above at y=100 in col 0
  const blocks = [
    { id: 'TARGET', x: columnX(0), y: 100, width: BOARD_GEOMETRY.blockWidth, height: BOARD_GEOMETRY.blockHeight, value: 5, active: true },
    ...[1, 2, 3, 4, 5, 6, 7].map((c) => ({
      id: `WALL_${c}`,
      x: columnX(c),
      y: 400,
      width: BOARD_GEOMETRY.blockWidth,
      height: BOARD_GEOMETRY.blockHeight,
      value: 99,
      active: true,
    })),
  ];

  const state = createGameState({
    levelId: 'EDGE-PREVIEW-PARITY',
    launcher: { x: 50, y: 1180 },
    ballCount: 2,
    blocks,
  });

  const angle = 90; // Fire straight up through empty col 0
  const liveRes = simulateTurn(state, angle, { record: true });
  const previewRes = previewFuture(state, angle, { record: true });

  assert.equal(liveRes.score, previewRes.result.score, 'Score must match between live and preview');
  assert.equal(liveRes.firstExitX, previewRes.result.firstExitX, 'firstExitX must match');
  assert.deepEqual(liveRes.finalBlocks, previewRes.result.finalBlocks, 'Final blocks must match');

  // TARGET block must be hit
  const targetLive = liveRes.finalBlocks.find((b) => b.id === 'TARGET');
  assert.ok(targetLive.value < 5, 'Ball must have traveled up through col 0 and damaged TARGET');
});

// --- PART B: LAUNCHER-BASELINE RETURN / EXIT LINE TESTS ---

test('Part B - 1: Newly spawned upward-moving ball does not immediately exit', () => {
  const state = createGameState({
    levelId: 'SPAWN-NO-EXIT',
    launcher: { x: 360, y: 1180 },
    ballCount: 3,
    blocks: [],
  });

  const sim = new Simulation(state, 90, PHYSICS_CONFIG);
  // Perform exactly 1 physics step
  sim.step();

  // All spawned balls must be active and moving upward (vy < 0)
  const activeBalls = sim.balls.filter((b) => b.active);
  assert.ok(activeBalls.length >= 1, 'At least 1 ball must be active after first step');
  for (const b of activeBalls) {
    assert.ok(b.y < state.launcher.y, `Ball Y (${b.y}) must be strictly above launcher baseline (${state.launcher.y})`);
    assert.ok(b.vy < 0, `Ball vy (${b.vy}) must be negative (moving upward)`);
  }

  // No exit events should have occurred on initial launch
  const exitEvents = sim.events.filter((e) => e.type === 'BallExited');
  assert.equal(exitEvents.length, 0, 'No ball exit event should occur on spawn step');
  assert.equal(sim.firstExitX, null, 'firstExitX must remain null at spawn');
});

test('Part B - 2: Downward ball crossing launcher baseline exits deterministically', () => {
  const state = createGameState({
    levelId: 'BASELINE-EXIT',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [], // Empty board: ball shoots up to top wall (y=0) and reflects straight down
  });

  const res1 = simulateTurn(state, 90, { record: true });
  const res2 = simulateTurn(state, 90, { record: true });

  assert.notEqual(res1.firstExitX, null, 'Ball must exit when crossing launcher baseline');
  assert.equal(res1.firstExitX, res2.firstExitX, 'Baseline exit X must be deterministic');
  assert.equal(res1.firstExitX, 360, 'Vertical shot must exit at launcher baseline X = 360');

  // Verify all trajectory points never exceed launcher.y
  for (const pt of res1.trajectories.ball0) {
    assert.ok(
      pt.y <= state.launcher.y + 1e-4,
      `Trajectory point Y (${pt.y}) must not exceed launcher baseline (${state.launcher.y})`
    );
  }
});

test('Part B - 3: First baseline crossing determines next launcher X', () => {
  const state = createGameState({
    levelId: 'FIRST-CROSSING',
    launcher: { x: 360, y: 1180 },
    ballCount: 2,
    blocks: [
      // Block deflects ball 0 to the left
      { id: 'B1', x: 320, y: 500, width: 80, height: 40, value: 50, active: true },
    ],
  });

  const result = simulateTurn(state, 75, { record: true });
  const nextState = applyTurnResult(state, result);

  assert.equal(nextState.launcher.x, clampLauncherX(result.firstExitX), 'Next launcher X must equal clamped firstExitX');
  assert.equal(nextState.launcher.y, state.launcher.y, 'Launcher Y must remain locked at baseline 1180');
});

test('Part B - 4: Ball cannot continue below baseline as active physics', () => {
  const state = createGameState({
    levelId: 'NO-ACTIVE-BELOW',
    launcher: { x: 360, y: 1180 },
    ballCount: 4,
    blocks: [],
  });

  const sim = new Simulation(state, 60, PHYSICS_CONFIG);

  // Step through simulation until finished, asserting at EVERY step that no active ball is below baseline
  while (!sim.finished) {
    sim.step();
    for (const b of sim.balls) {
      if (b.active) {
        assert.ok(
          b.y <= state.launcher.y + 1e-4,
          `Active ball (${b.id}) Y=${b.y} must not be below launcher baseline ${state.launcher.y}`
        );
      }
    }
  }

  assert.ok(sim.allDone(), 'Simulation must finish when all balls exit at baseline');
  assert.equal(sim.stats.ballsExited, 4, 'All 4 balls must have exited at baseline');
});

test('Part B - 5: Preview/live/solver parity remains exact with launcher baseline exit', () => {
  const state = createGameState({
    levelId: 'PARITY-CHECK',
    launcher: { x: 200, y: 1180 },
    ballCount: 3,
    blocks: [
      { id: 'B1', x: columnX(2), y: 300, width: BOARD_GEOMETRY.blockWidth, height: BOARD_GEOMETRY.blockHeight, value: 10, active: true },
      { id: 'B2', x: columnX(4), y: 368, width: BOARD_GEOMETRY.blockWidth, height: BOARD_GEOMETRY.blockHeight, value: 15, active: true },
    ],
  });

  const angle = 65.4;
  const liveResult = simulateTurn(state, angle, { record: true });
  const previewResult = previewFuture(state, angle, { record: true });

  assert.equal(liveResult.score, previewResult.result.score, 'Score parity');
  assert.equal(liveResult.firstExitX, previewResult.result.firstExitX, 'firstExitX parity');
  assert.deepEqual(liveResult.nextLauncher, previewResult.result.nextLauncher, 'nextLauncher parity');
  assert.equal(liveResult.stats.hits, previewResult.result.stats.hits, 'Hits parity');
  assert.equal(liveResult.stats.destroyed, previewResult.result.stats.destroyed, 'Destroyed parity');

  // Verify solver best candidate replays identically through simulateTurn
  const solverOutput = solve(state, { sampleAngles: [45, 65.4, 80], maxDepth: 1 });
  assert.ok(solverOutput.best !== null, 'Solver must find candidate');
  const replaySim = simulateTurn(state, solverOutput.best.angleDeg, { record: false });
  assert.equal(replaySim.stats.destroyed, solverOutput.best.stats.destroyed, 'Solver candidate replay destroyed count must match');
  assert.equal(replaySim.stats.hits, solverOutput.best.stats.hits, 'Solver candidate replay hit count must match');
});

test('Part B - 6: Return-point behavior near left/right boundaries remains clamped correctly', () => {
  // Test clamping at near-left and near-right boundary
  const minValid = PHYSICS_CONFIG.ballRadius; // 6
  const maxValid = PHYSICS_CONFIG.canvasWidth - PHYSICS_CONFIG.ballRadius; // 714
  const clampedMin = clampLauncherX(2);
  const clampedMax = clampLauncherX(718);
  assert.equal(clampedMin, minValid, 'Launcher X clamped near left must be ballRadius = 6');
  assert.equal(clampedMax, maxValid, 'Launcher X clamped near right must be 720 - 6 = 714');

  // Ensure shot reflecting into lower-left corner clamps to at least ballRadius
  const stateLeft = createGameState({
    levelId: 'CLAMP-LEFT',
    launcher: { x: 100, y: 1180 },
    ballCount: 1,
    blocks: [
      // Deflector that sends ball sharply into the lower-left corner at the baseline
      { id: 'CORNER_DEFLECT', x: 20, y: 1050, width: 40, height: 40, value: 99, active: true },
    ],
  });

  const res = simulateTurn(stateLeft, 140, { record: false });
  const nextState = applyTurnResult(stateLeft, res);
  assert.ok(nextState.launcher.x >= minValid, `nextState launcher X (${nextState.launcher.x}) must be >= ${minValid}`);
  assert.ok(nextState.launcher.x <= maxValid, `nextState launcher X (${nextState.launcher.x}) must be <= ${maxValid}`);
});
