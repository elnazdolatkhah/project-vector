import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  serializeGameState,
  deserializeGameState,
  applyTurnResult,
  generateTopRow,
  generateTopRowPickups,
  canonicalizeGameState,
} from '../src/domain/gameState.js';
import { PROGRESSION_CONFIG } from '../src/config.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';

test('1: deterministic pickup generation', () => {
  const stateA = createGameState(LEVELS.L01);
  stateA.nextRowIndex = 3; // Trigger spawn on cadence 3
  const stateB = createGameState(LEVELS.L01);
  stateB.nextRowIndex = 3;

  const pickupsA1 = generateTopRowPickups(stateA);
  const pickupsA2 = generateTopRowPickups(stateA);
  const pickupsB = generateTopRowPickups(stateB);

  assert.deepEqual(pickupsA1, pickupsA2, 'generating top row pickups on same state must yield identical pickups');
  assert.deepEqual(pickupsA1, pickupsB, 'generating top row pickups across identical states must match');
  assert.equal(pickupsA1.length, 1, 'should generate exactly 1 pickup on trigger row');
  assert.equal(pickupsA1[0].active, true, 'generated pickup must be active');
  assert.equal(pickupsA1[0].radius, PROGRESSION_CONFIG.pickupRadius, 'pickup radius must match config');
  assert.equal(pickupsA1[0].y, stateA.rowOriginY + PROGRESSION_CONFIG.blockHeight / 2, 'pickup Y must align with row origin');
});

test('2: pickup IDs stable/unique', () => {
  const state = createGameState(LEVELS.L01);
  const ids = new Set();

  for (let rowIndex = 1; rowIndex <= 12; rowIndex += 1) {
    const rowState = { ...state, nextRowIndex: rowIndex };
    const pickups = generateTopRowPickups(rowState, { cadence: 1 }); // Force cadence 1 for ID uniqueness test
    for (const p of pickups) {
      assert.ok(p.id.startsWith(`pickup_r${rowIndex}_`), `ID ${p.id} must reflect row index ${rowIndex}`);
      assert.ok(!ids.has(p.id), `duplicate pickup ID detected: ${p.id}`);
      ids.add(p.id);
    }
  }
  assert.equal(ids.size, 12, 'must generate 12 unique IDs across 12 rows');
});

test('3: pickup acquired by collision', () => {
  // Construct a state with a single pickup placed directly above launcher
  const state = createGameState({
    levelId: 'PICKUP_DIRECT',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [],
    pickups: [
      { id: 'target_pickup', x: 360, y: 500, radius: 14, active: true },
    ],
  });

  // Shoot straight up (90 deg) directly through the pickup
  const result = simulateTurn(state, 90, { record: false });

  assert.equal(result.ballPickupsCollected, 1, 'pickup must be collected');
  assert.deepEqual(result.collectedPickups, ['target_pickup'], 'collectedPickups list must contain target_pickup');
  const event = result.events.find((e) => e.type === 'PickupCollected');
  assert.ok(event, 'PickupCollected event must be emitted');
  assert.equal(event?.pickupId, 'target_pickup');
});

test('4: pickup acquired only once', () => {
  // Multi-ball volley where multiple balls pass through the same pickup
  const state = createGameState({
    levelId: 'PICKUP_MULTI_BALL',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    blocks: [],
    pickups: [
      { id: 'shared_pickup', x: 360, y: 500, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });

  assert.equal(result.ballPickupsCollected, 1, 'pickup must be collected exactly once despite 5 balls');
  const collectionEvents = result.events.filter((e) => e.type === 'PickupCollected');
  assert.equal(collectionEvents.length, 1, 'PickupCollected event must fire exactly once');
});

test('5: current volley ball count unchanged', () => {
  const initialBallCount = 10;
  const state = createGameState({
    levelId: 'PICKUP_CURRENT_VOLLEY',
    launcher: { x: 360, y: 1180 },
    ballCount: initialBallCount,
    blocks: [],
    pickups: [
      { id: 'p1', x: 360, y: 500, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });
  // Balls spawned in this simulation should equal initial count, not incremented during current volley
  const spawnEvents = result.events.filter((e) => e.type === 'BallSpawned');
  assert.equal(spawnEvents.length, initialBallCount, 'current volley ball count must remain unchanged');
  assert.equal(result.stats.ballsExited, initialBallCount, 'balls exited must equal initial ball count');
});

test('6: next-turn ball count increments by exactly one', () => {
  const initialBallCount = 18;
  const state = createGameState({
    levelId: 'PICKUP_INC_ONE',
    launcher: { x: 360, y: 1180 },
    ballCount: initialBallCount,
    blocks: [],
    pickups: [
      { id: 'p1', x: 360, y: 500, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });
  assert.equal(result.ballPickupsCollected, 1);

  const nextState = applyTurnResult(state, result);
  assert.equal(nextState.balls.available, initialBallCount + 1, 'balls.available must increment by exactly 1');
});

test('7: multiple pickups increment by the correct total if allowed by board state', () => {
  const initialBallCount = 5;
  const state = createGameState({
    levelId: 'PICKUP_MULTI_TOTAL',
    launcher: { x: 360, y: 1180 },
    ballCount: initialBallCount,
    blocks: [],
    pickups: [
      { id: 'p1', x: 360, y: 700, radius: 14, active: true },
      { id: 'p2', x: 360, y: 500, radius: 14, active: true },
    ],
  });

  // Shoot straight up collecting both p1 and p2
  const result = simulateTurn(state, 90, { record: false });
  assert.equal(result.ballPickupsCollected, 2, 'must collect both pickups');

  const nextState = applyTurnResult(state, result);
  assert.equal(nextState.balls.available, initialBallCount + 2, 'balls.available must increment by 2');
});

test('8: serialize -> load preserves new ball count', () => {
  const state = createGameState({
    levelId: 'PICKUP_SERIALIZE',
    launcher: { x: 360, y: 1180 },
    ballCount: 15,
    blocks: [],
    pickups: [
      { id: 'p1', x: 360, y: 600, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });
  const nextState = applyTurnResult(state, result);
  assert.equal(nextState.balls.available, 16);

  const serialized = serializeGameState(nextState);
  const loaded = deserializeGameState(serialized);

  assert.equal(loaded.balls.available, 16, 'deserialized state must preserve incremented ball count');
  assert.deepEqual(loaded.balls, nextState.balls);
});

test('9: Preview next ball count == gameplay next ball count', () => {
  const state = createGameState({
    levelId: 'PICKUP_PREVIEW_MATCH',
    launcher: { x: 360, y: 1180 },
    ballCount: 20,
    blocks: [],
    pickups: [
      { id: 'p_test', x: 360, y: 550, radius: 14, active: true },
    ],
  });

  const angle = 90;
  const preview = previewFuture(state, angle, { record: false });
  const liveResult = simulateTurn(state, angle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);

  assert.equal(preview.ballPickupsCollected, 1, 'preview must report 1 pickup collected');
  assert.equal(preview.nextBallCount, 21, 'preview nextBallCount must be 21');
  assert.equal(liveNextState.balls.available, 21, 'gameplay next balls.available must be 21');
  assert.equal(preview.nextBallCount, liveNextState.balls.available, 'preview next ball count must equal gameplay');
});

test('10: Solver replay next ball count == gameplay', () => {
  const state = createGameState({
    levelId: 'PICKUP_SOLVER_MATCH',
    launcher: { x: 360, y: 1180 },
    ballCount: 12,
    blocks: [
      { id: 'B1', x: 340, y: 300, width: 70, height: 56, value: 5, active: true },
    ],
    pickups: [
      { id: 'p_solver', x: 360, y: 550, radius: 14, active: true },
    ],
  });

  const solution = solve(state, { angleMin: 85, angleMax: 95, step: 1, objective: 'destruction', includeRobustness: false });

  // 1. Verify candidate with pickup collection replays identically to gameplay
  const pickupCandidate = solution.candidates.find((c) => c.ballPickupsCollected > 0);
  assert.ok(pickupCandidate, 'solver candidates must include shot collecting pickup');
  assert.equal(pickupCandidate.nextBallCount, 13);

  const replayResult = simulateTurn(state, pickupCandidate.angleDeg, { record: false });
  const replayNextState = applyTurnResult(state, replayResult);
  assert.equal(replayNextState.balls.available, pickupCandidate.nextBallCount, 'solver replay next ball count must match gameplay');
  assert.equal(replayNextState.balls.available, 13);

  // 2. Verify solver best candidate also replays identically to gameplay
  const bestCandidate = solution.best;
  const bestReplay = simulateTurn(state, bestCandidate.angleDeg, { record: false });
  const bestNextState = applyTurnResult(state, bestReplay);
  assert.equal(bestNextState.balls.available, bestCandidate.nextBallCount, 'solver best candidate replay must match gameplay');
});

test('11: destroyed/removed pickup does not persist into descended board', () => {
  const state = createGameState({
    levelId: 'PICKUP_REMOVAL',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [],
    pickups: [
      { id: 'collected_token', x: 360, y: 500, radius: 14, active: true },
      { id: 'uncollected_token', x: 100, y: 500, radius: 14, active: true },
    ],
  });

  // Shoot straight up (90 deg) collecting 'collected_token', missing 'uncollected_token'
  const result = simulateTurn(state, 90, { record: false });
  assert.equal(result.ballPickupsCollected, 1);
  assert.equal(result.collectedPickups[0], 'collected_token');

  const nextState = applyTurnResult(state, result);

  const hasCollected = nextState.pickups.some((p) => p.id === 'collected_token');
  const hasUncollected = nextState.pickups.some((p) => p.id === 'uncollected_token');

  assert.equal(hasCollected, false, 'collected pickup must not persist in nextState');
  assert.equal(hasUncollected, true, 'uncollected pickup must survive in nextState');

  const uncollected = nextState.pickups.find((p) => p.id === 'uncollected_token');
  assert.equal(
    uncollected.y,
    Math.round((500 + PROGRESSION_CONFIG.rowStep) * 1e6) / 1e6,
    'uncollected pickup must descend by ROW_STEP'
  );
});

test('12: full board progression still generates/descent correctly with pickups present', () => {
  let state = createGameState(LEVELS.L01);
  state.pickupCadence = 2; // Every 2 turns a pickup spawns

  const initialBalls = state.balls.available;

  // Turn 1
  const res1 = simulateTurn(state, 45, { record: false });
  state = applyTurnResult(state, res1);
  assert.equal(state.turn, 2);
  assert.equal(state.balls.available, initialBalls); // Turn 1 (nextRowIndex 1) did not trigger cadence 2

  // Turn 2
  const res2 = simulateTurn(state, 50, { record: false });
  state = applyTurnResult(state, res2);
  assert.equal(state.turn, 3);
  // nextRowIndex was 2 in turn 2, which spawned a pickup for row 2
  assert.ok(state.pickups.some((p) => p.id.startsWith('pickup_r2_')), 'pickup_r2_ must be present on board');

  // Verify board blocks still descended correctly
  assert.ok(state.blocks.length > 0, 'blocks must exist');
  for (const b of state.blocks) {
    assert.ok(b.y >= state.rowOriginY, 'blocks must be at or below rowOriginY');
  }
});

test('13: nextBallCount strictly equals currentBallCount + ballPickupsCollected for completed volleys', () => {
  // 1. Authoritative check on L03: starting ball count = 18, angle 25.5° collects 1 pickup
  const l03State = createGameState(LEVELS.L03);
  assert.equal(l03State.balls.available, 18, 'L03 starting ball count must be 18');

  const l03Preview = previewFuture(l03State, 25.5, { record: false });
  assert.equal(l03Preview.completed, true, 'angle 25.5° must complete normally');
  assert.equal(l03Preview.timedOut, false, 'angle 25.5° must not time out');
  assert.equal(l03Preview.ballPickupsCollected, 1, 'must collect exactly 1 pickup');
  assert.equal(l03Preview.nextBallCount, 19, 'nextBallCount must equal 18 + 1 = 19');
  assert.equal(l03Preview.nextGameState.balls.available, 19, 'replayed nextGameState.balls.available must be 19');

  // Verify Solver replay consistency
  const replaySim = simulateTurn(l03State, 25.5, { record: false });
  const replayNextState = applyTurnResult(l03State, replaySim);
  assert.equal(replayNextState.balls.available, 19, 'replayed applyTurnResult balls.available must be 19');

  // 2. Authoritative check on legal long volley (23.5° in L03 takes ~81.6s and naturally completes)
  const l03_23 = previewFuture(l03State, 23.5, { record: false });
  assert.equal(l03_23.completed, true, 'angle 23.5° naturally resolves to completion');
  assert.equal(l03_23.timedOut, false, 'angle 23.5° must not time out');
  assert.equal(l03_23.ballPickupsCollected, 1, 'must collect 1 pickup');
  assert.equal(l03_23.nextBallCount, 19, 'nextBallCount must equal 18 + 1 = 19');
  assert.equal(l03_23.nextGameState.balls.available, 19, 'nextGameState.balls.available must be 19');

  // 3. Authoritative check on uncompleted / watchdog failure: must NOT advance ball count
  const forcedTimeoutResult = {
    angleDeg: 45,
    timedOut: true,
    watchdogTriggered: true,
    completed: false,
    finalBlocks: l03State.blocks,
    stats: { hits: 1, destroyed: 0, ballsExited: 0, ballPickupsCollected: 1 },
    ballPickupsCollected: 1,
    collectedPickups: ['pickup_0'],
    firstExitX: null,
    nextLauncher: { x: l03State.launcher.x, y: l03State.launcher.y },
    score: 1,
  };
  const timedOutNextState = applyTurnResult(l03State, forcedTimeoutResult);
  assert.equal(timedOutNextState.balls.available, 18, 'watchdog/timed-out result must not advance balls.available');

  // 3. Across all campaign stages L01–L05, verify formula holds on all completed angles
  for (const stageKey of ['L01', 'L02', 'L03', 'L04', 'L05']) {
    const stageState = createGameState(LEVELS[stageKey]);
    const angles = [10, 25.5, 45, 65.5, 70, 83, 90, 111.5, 139.5, 162.5, 170];
    for (const angle of angles) {
      const future = previewFuture(stageState, angle, { record: false });
      if (future.completed && !future.timedOut) {
        assert.equal(
          future.nextBallCount,
          stageState.balls.available + future.ballPickupsCollected,
          `${stageKey} at ${angle}°: nextBallCount must equal startingBalls + ballPickupsCollected`
        );
        assert.equal(
          future.nextGameState.balls.available,
          future.nextBallCount,
          `${stageKey} at ${angle}°: nextGameState.balls.available must equal nextBallCount`
        );
      }
    }
  }
});

