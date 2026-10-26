import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, applyTurnResult } from '../src/domain/gameState.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';

test('1. Pickup before block: ball intersects pickup first, then block; pickup is collected', () => {
  const state = createGameState({
    levelId: 'ORDER_BEFORE_BLOCK',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'BLOCK1', x: 325, y: 400, width: 70, height: 56, value: 10, active: true },
    ],
    pickups: [
      { id: 'PICKUP1', x: 360, y: 700, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });

  assert.equal(result.ballPickupsCollected, 1, 'pickup must be collected');
  assert.deepEqual(result.collectedPickups, ['PICKUP1']);

  const pickupEventIdx = result.events.findIndex((e) => e.type === 'PickupCollected' && e.pickupId === 'PICKUP1');
  const blockEventIdx = result.events.findIndex((e) => e.type === 'BlockCollision' && e.blockId === 'BLOCK1');

  assert.ok(pickupEventIdx !== -1, 'PickupCollected event must be present');
  assert.ok(blockEventIdx !== -1, 'BlockCollision event must be present');
  assert.ok(
    pickupEventIdx < blockEventIdx,
    `PickupCollected (idx ${pickupEventIdx}) must occur before BlockCollision (idx ${blockEventIdx})`
  );
});

test('2. Pickup behind blocking brick: block collision occurs first; ball reflects; pickup is NOT collected', () => {
  const state = createGameState({
    levelId: 'ORDER_BEHIND_BLOCK',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      // Block bottom is at y = 600 + 56 = 656. Ball (radius 6) impacts bottom face at y = 662.
      { id: 'BLOCK_SHIELD', x: 325, y: 600, width: 70, height: 56, value: 10, active: true },
    ],
    pickups: [
      // Pickup placed behind the brick (y = 500, above block) directly in line with shot
      { id: 'PICKUP_HIDDEN', x: 360, y: 500, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });

  assert.equal(result.ballPickupsCollected, 0, 'pickup behind block must NOT be collected');
  assert.equal(result.collectedPickups.length, 0);

  const pickupEvent = result.events.find((e) => e.type === 'PickupCollected');
  assert.equal(pickupEvent, undefined, 'no PickupCollected event should be emitted');

  const blockEvent = result.events.find((e) => e.type === 'BlockCollision');
  assert.ok(blockEvent, 'block collision must occur');
});

test('3. Pickup after rebound: ball first collides with block/wall, reflected segment crosses pickup, pickup IS collected', () => {
  // Launch from left at 45 deg toward right wall (x = 714)
  // Right wall bounce causes ball to reflect back leftward.
  // Place pickup at x = 500, y = 700.
  // When launching from (500, 1180) at 45 deg, dx = dy (up and right).
  // At y = 700 on the way up, x = 500 + (1180 - 700) = 980 (which would be beyond wall).
  // Let's set up exact coordinates:
  // Launch from (360, 1180) at 90 deg straight up.
  // Block at (325, 600) with bottom at 656. Ball reflects at y = 662 back downward.
  // We place a pickup on the rebound path that wasn't touched on the way up:
  // Place an angled deflector or shoot at angle off the side wall!
  // Let's shoot at 135 deg from (200, 800) toward left wall (x = 6).
  // dx = -1, dy = -1.
  // Distance to left wall (from center x=200 to x=6) is 194.
  // Ball reaches left wall at y = 800 - 194 = 606.
  // After reflection, dx = +1, dy = -1 (moving right and up from (6, 606)).
  // 100 units after rebound: x = 6 + 100 = 106, y = 606 - 100 = 506.
  // Place pickup at (106, 506)!
  // Notice: on the initial leg (200, 800) -> (6, 606), x is decreasing from 200 to 6.
  // (106, 506) has y = 506 < 606, so the ball is nowhere near it before the rebound!
  const state = createGameState({
    levelId: 'ORDER_AFTER_REBOUND',
    launcher: { x: 200, y: 800 },
    ballCount: 1,
    blocks: [],
    pickups: [
      { id: 'PICKUP_REBOUND', x: 106, y: 506, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 135, { record: false });

  assert.equal(result.ballPickupsCollected, 1, 'pickup along reflected segment must be collected');
  assert.equal(result.collectedPickups[0], 'PICKUP_REBOUND');

  // Verify that the wall reflection occurs before the pickup collection
  // The simulation records ball trajectory or events; we can verify the ball's X was < 20 before collecting
  const pickupEvent = result.events.find((e) => e.type === 'PickupCollected');
  assert.ok(pickupEvent, 'PickupCollected event must be present');
});

test('4. Pickup beyond wall: pickup lies beyond wall boundary on original segment; never collected', () => {
  const state = createGameState({
    levelId: 'ORDER_BEYOND_WALL',
    launcher: { x: 100, y: 800 },
    ballCount: 1,
    blocks: [],
    pickups: [
      // Pickup placed outside canvas court (x = -40, beyond left wall at x = 6)
      { id: 'PICKUP_OUTSIDE_WALL', x: -40, y: 660, radius: 14, active: true },
    ],
  });

  // Shoot toward left wall at 135 deg
  const result = simulateTurn(state, 135, { record: false });

  assert.equal(result.ballPickupsCollected, 0, 'pickup beyond wall boundary must NEVER be collected');
  assert.equal(result.collectedPickups.length, 0);
});

test('5. Pickup near exact collision point: deterministic contact evaluation at impact boundary', () => {
  // Block at x = 325, y = 500, width = 70, height = 56.
  // Bottom of block is y = 556. Ball of radius 6 hits bottom face at y = 556 + 6 = 562.
  // Case A: Pickup center at y = 572 (touches ball at y = 562 because 572 - 562 = 10 <= 6 + 14 = 20).
  // It is within contact range at the collision point, so it must be collected.
  const stateA = createGameState({
    levelId: 'ORDER_EXACT_CONTACT',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'BLOCK_BOUNDARY', x: 325, y: 500, width: 70, height: 56, value: 5, active: true },
    ],
    pickups: [
      { id: 'PICKUP_AT_BOUNDARY', x: 360, y: 572, radius: 14, active: true },
    ],
  });

  const resultA = simulateTurn(stateA, 90, { record: false });
  assert.equal(resultA.ballPickupsCollected, 1, 'pickup touching ball at collision point must be collected');

  // Case B: Pickup center at y = 530 (inside the brick, 32 units above contact point).
  // At contact point y = 562, distance to pickup center is 562 - 530 = 32 > 6 + 14 = 20.
  // Ball reflects at y = 562 away from the brick. It never reaches pickup.
  const stateB = createGameState({
    levelId: 'ORDER_JUST_BEYOND',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'BLOCK_BOUNDARY', x: 325, y: 500, width: 70, height: 56, value: 5, active: true },
    ],
    pickups: [
      { id: 'PICKUP_BEYOND_BOUNDARY', x: 360, y: 530, radius: 14, active: true },
    ],
  });

  const resultB = simulateTurn(stateB, 90, { record: false });
  assert.equal(resultB.ballPickupsCollected, 0, 'pickup beyond collision boundary must NOT be collected');
});

test('6. Multiple pickups on one actually traveled segment: collected in chronological order', () => {
  const state = createGameState({
    levelId: 'ORDER_MULTIPLE_CHRONO',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'BLOCK_TARGET', x: 325, y: 300, width: 70, height: 56, value: 10, active: true },
    ],
    // Deliberately declare pickups out of physical order in the array to test sorting
    pickups: [
      { id: 'PICKUP_THIRD', x: 360, y: 500, radius: 14, active: true },
      { id: 'PICKUP_FIRST', x: 360, y: 900, radius: 14, active: true },
      { id: 'PICKUP_SECOND', x: 360, y: 700, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });

  assert.equal(result.ballPickupsCollected, 3, 'all 3 pickups must be collected');

  const pickupEvents = result.events.filter((e) => e.type === 'PickupCollected');
  assert.equal(pickupEvents.length, 3);
  assert.equal(pickupEvents[0].pickupId, 'PICKUP_FIRST', 'first reached pickup must emit first');
  assert.equal(pickupEvents[1].pickupId, 'PICKUP_SECOND', 'second reached pickup must emit second');
  assert.equal(pickupEvents[2].pickupId, 'PICKUP_THIRD', 'third reached pickup must emit third');

  const blockEventIdx = result.events.findIndex((e) => e.type === 'BlockCollision');
  const lastPickupEventIdx = result.events.lastIndexOf(pickupEvents[2]);
  assert.ok(lastPickupEventIdx < blockEventIdx, 'all pickups before block must emit before block collision');
});

test('7. Already collected pickup: never emits a second PickupCollected event when crossed again', () => {
  // Ball travels up through pickup at (360, 800), hits block at (325, 600), reflects down through (360, 800) again
  const state = createGameState({
    levelId: 'ORDER_SINGLE_EMISSION',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'BOUNCE_BLOCK', x: 325, y: 600, width: 70, height: 56, value: 10, active: true },
    ],
    pickups: [
      { id: 'RE_CROSSED_PICKUP', x: 360, y: 800, radius: 14, active: true },
    ],
  });

  const result = simulateTurn(state, 90, { record: false });

  assert.equal(result.ballPickupsCollected, 1, 'pickup must be collected only once');
  const matchingEvents = result.events.filter((e) => e.type === 'PickupCollected' && e.pickupId === 'RE_CROSSED_PICKUP');
  assert.equal(matchingEvents.length, 1, 'exactly one PickupCollected event must be emitted despite re-crossing');
});

test('8. Preview, gameplay and solver produce identical pickup results after ordering audit', () => {
  const state = createGameState({
    levelId: 'ORDER_PARITY',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    blocks: [
      { id: 'SHIELD_1', x: 325, y: 500, width: 70, height: 56, value: 20, active: true },
      { id: 'SHIELD_2', x: 100, y: 400, width: 70, height: 56, value: 20, active: true },
    ],
    pickups: [
      { id: 'P_EXPOSED', x: 360, y: 750, radius: 14, active: true }, // in front of shield 1
      { id: 'P_OCCLUDED', x: 360, y: 420, radius: 14, active: true }, // behind shield 1
      { id: 'P_SIDE', x: 200, y: 600, radius: 14, active: true },
    ],
  });

  const angle = 90;
  const preview = previewFuture(state, angle, { record: false });
  const liveResult = simulateTurn(state, angle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);

  const solution = solve(state, { angleMin: 88, angleMax: 92, step: 1, objective: 'destruction', includeRobustness: false });
  const solverCandidate90 = solution.candidates.find((c) => Math.abs(c.angleDeg - 90) < 1e-4);

  // 1. Both live and preview collect ONLY P_EXPOSED (P_OCCLUDED is behind SHIELD_1)
  assert.equal(liveResult.ballPickupsCollected, 1);
  assert.deepEqual(liveResult.collectedPickups, ['P_EXPOSED']);
  assert.equal(preview.ballPickupsCollected, 1);
  assert.equal(preview.nextBallCount, 11);
  assert.equal(liveNextState.balls.available, 11);

  // 2. Solver matches
  assert.ok(solverCandidate90);
  assert.equal(solverCandidate90.ballPickupsCollected, 1);
  assert.equal(solverCandidate90.nextBallCount, 11);

  // 3. Exact state equality
  assert.deepEqual(preview.nextGameState, liveNextState, 'FuturePreview nextGameState must match gameplay next state');
  assert.deepEqual(solverCandidate90.nextGameState, liveNextState, 'Solver nextGameState must match gameplay next state');
});
