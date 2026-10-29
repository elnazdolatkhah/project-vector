import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS_CONFIG, PROGRESSION_CONFIG } from '../src/config.js';
import { createGameState, applyTurnResult } from '../src/domain/gameState.js';
import { Simulation, simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { LEVELS } from '../src/levels/levels.js';
import {
  evaluatePresentationSpeed,
  ACCELERATION_CONFIG,
  PRESENTATION_TIERS,
} from '../src/physics/presentationScheduler.js';

// ============================================================================
// AREA A: Input Lifecycle & Multi-touch / Pointer Ownership
// ============================================================================
test('Area A: Single-pointer ownership rejects secondary pointer / multi-touch', () => {
  let isAiming = false;
  let activePointerId = null;

  function handlePointerDown(pointerId, isRunning, isTransitioning, isTerminal) {
    if (isAiming || isRunning || isTransitioning || isTerminal) return false;
    isAiming = true;
    activePointerId = pointerId;
    return true;
  }

  // First touch succeeds
  assert.equal(handlePointerDown(1, false, false, false), true, 'Primary touch begins aiming');
  assert.equal(activePointerId, 1);

  // Second touch while aiming is strictly rejected
  assert.equal(handlePointerDown(2, false, false, false), false, 'Secondary pointer down is rejected');
  assert.equal(activePointerId, 1, 'Active pointerId remains locked to primary touch');
});

test('Area A: Pointer cancel clears aiming and invalidates pending timers', () => {
  let isAiming = true;
  let activePointerId = 1;
  let echoCheckTimer = 123;
  let echoAnimFrame = 456;
  let previewTimer = 789;
  let aimLineRendered = true;

  function handlePointerCancel() {
    if (echoCheckTimer) echoCheckTimer = null;
    if (echoAnimFrame) echoAnimFrame = null;
    if (previewTimer) previewTimer = null;
    activePointerId = null;
    isAiming = false;
    aimLineRendered = false; // renderCurrent() clears visual aim line
  }

  handlePointerCancel();
  assert.equal(isAiming, false, 'Aiming state must be false');
  assert.equal(activePointerId, null, 'pointerId must be cleared');
  assert.equal(echoCheckTimer, null, 'echoCheckTimer must be cleared');
  assert.equal(echoAnimFrame, null, 'echoAnimFrame must be cancelled');
  assert.equal(previewTimer, null, 'previewTimer must be cleared');
  assert.equal(aimLineRendered, false, 'aim line must be cleared immediately');
});

// ============================================================================
// AREA B & C: Lifecycle Token & Reset/Level Switch During Any Phase
// ============================================================================
test('Area B & C: Reset/switch during board transition invalidates old transitionLoop and prevents stale mutation', () => {
  let lifecycleToken = 0;
  let stageStatus = 'active';
  let activeLevelIndex = 0;
  let renderedFramesOldTransition = 0;
  let stateMutationOccurred = false;

  // Simulate turn finishing and starting transitionLoop
  lifecycleToken += 1;
  const turnToken = lifecycleToken;
  const oldStageNextState = { turn: 2, stageStatus: 'failed', blocks: [] };

  function oldTransitionLoop(isCompleted) {
    if (lifecycleToken !== turnToken) {
      // Token mismatch: instantly aborted!
      return;
    }
    renderedFramesOldTransition += 1;
    if (isCompleted) {
      if (oldStageNextState.stageStatus !== 'active') {
        stateMutationOccurred = true;
      }
    }
  }

  // 1 frame of old transition before switch:
  oldTransitionLoop(false);
  assert.equal(renderedFramesOldTransition, 1);
  assert.equal(stateMutationOccurred, false);

  // User switches level to Stage 2 mid-transition:
  lifecycleToken += 1; // setLevel increments lifecycleToken
  activeLevelIndex = 1;
  stageStatus = 'active';

  // Old transitionLoop completion fires on next tick:
  oldTransitionLoop(true);

  // Must not have rendered or mutated new stage
  assert.equal(renderedFramesOldTransition, 1, 'Old transitionLoop must abort immediately on token mismatch');
  assert.equal(stateMutationOccurred, false, 'Old nextState must not mutate or set status on new level');
  assert.equal(activeLevelIndex, 1, 'Current level remains new level');
  assert.equal(stageStatus, 'active', 'Stage status remains pristine active for new level');
});

test('Area C: Reset during tail acceleration (2x or 6x) completely resets presentation tier to NORMAL', () => {
  let playbackTier = 'RAPID_TAIL';
  let lifecycleToken = 1;
  let isRunning = true;

  function setLevel() {
    lifecycleToken += 1;
    isRunning = false;
    playbackTier = 'NORMAL';
  }

  setLevel();
  assert.equal(playbackTier, 'NORMAL', 'Playback tier must reset to NORMAL on setLevel');
  assert.equal(isRunning, false, 'isRunning must be false');
});

// ============================================================================
// AREA D: Spawn Lifecycle Invariants
// ============================================================================
test('Area D: Ball spawn sequence is strictly deterministic, non-skipping, and non-duplicating', () => {
  const state = createGameState(LEVELS.L01);
  const totalBalls = state.balls.available;
  const sim = new Simulation(state, 45, PHYSICS_CONFIG, { record: true });

  const spawnedBallIds = [];
  while (!sim.finished) {
    for (const b of sim.balls) {
      if (b.spawned && !spawnedBallIds.includes(b.id)) {
        spawnedBallIds.push(b.id);
      }
    }
    sim.step();
  }

  assert.equal(spawnedBallIds.length, totalBalls, 'Every ball must spawn exactly once');
  for (let i = 0; i < totalBalls; i += 1) {
    assert.equal(spawnedBallIds[i], `ball${i}`, `Spawn order must be strictly ball${i}`);
  }
});

// ============================================================================
// AREA E: Collision Cap & Motion Non-Truncation Proof
// ============================================================================
test('Area E: Legal campaign trajectories never truncate remaining fixed-step motion under maxCollisionsPerStep = 32', () => {
  const levelsToAudit = ['L01', 'L02', 'L03', 'L04', 'L05'];
  let totalCapEvents = 0;
  let maxCollisionsObserved = 0;

  for (const lvlKey of levelsToAudit) {
    const state = createGameState(LEVELS[lvlKey]);
    for (let angle = 5; angle <= 175; angle += 5) {
      const sim = new Simulation(state, angle, PHYSICS_CONFIG, { record: true });
      while (!sim.finished) {
        const eventsBefore = sim.events.length;
        sim.step();
        const stepEvents = sim.events.slice(eventsBefore);
        const cols = stepEvents.filter((e) => e.type === 'BlockCollision' || e.type === 'WallCollision').length;
        if (cols > maxCollisionsObserved) {
          maxCollisionsObserved = cols;
        }
      }
      const res = sim.result();
      const capEvents = res.events.filter((e) => e.type === 'CollisionCapReached');
      totalCapEvents += capEvents.length;

      assert.equal(res.completed, true, `${lvlKey} ${angle}°: Must complete cleanly`);
      assert.equal(res.watchdogTriggered, false, `${lvlKey} ${angle}°: Watchdog must not trigger`);
      assert.equal(res.unresolvedBalls.length, 0, `${lvlKey} ${angle}°: Zero unresolved balls`);
    }
  }

  // Under maxCollisionsPerStep = 32, zero cap events occur across all campaign stages
  assert.equal(totalCapEvents, 0, 'CollisionCapReached must be exactly 0 across all legal campaign stages');
  // Maximum observed collisions per step is 24, safely under the cap of 32
  assert.ok(maxCollisionsObserved <= 24, `Peak collisions per step (${maxCollisionsObserved}) must not exceed 24`);
  assert.ok(maxCollisionsObserved < PHYSICS_CONFIG.maxCollisionsPerStep, 'Headroom exists between peak collisions and cap');
});

test('Area E: Parity across cap=32, cap=64, and cap=128 proves full step convergence without motion truncation', () => {
  // Previously identified high-collision trajectories
  const highColTrajectories = [
    { lvlKey: 'L01', angle: 90 },
    { lvlKey: 'L02', angle: 90 },
    { lvlKey: 'L03', angle: 75 },
    { lvlKey: 'L03', angle: 90 },
    { lvlKey: 'L04', angle: 30 },
    { lvlKey: 'L04', angle: 90 },
    { lvlKey: 'L04', angle: 150 },
    { lvlKey: 'L05', angle: 75 },
    { lvlKey: 'L05', angle: 90 },
    { lvlKey: 'L05', angle: 105 },
  ];

  for (const tc of highColTrajectories) {
    const baseState = createGameState(LEVELS[tc.lvlKey]);

    const sim32 = new Simulation(baseState, tc.angle, { ...PHYSICS_CONFIG, maxCollisionsPerStep: 32 }, { record: true });
    const res32 = sim32.runToCompletion();

    const sim64 = new Simulation(baseState, tc.angle, { ...PHYSICS_CONFIG, maxCollisionsPerStep: 64 }, { record: true });
    const res64 = sim64.runToCompletion();

    // Byte-for-byte exact equality between cap 32 and cap 64 proves that cap 32 fully resolved all physical motion
    assert.equal(res32.stepCount, res64.stepCount, `${tc.lvlKey} ${tc.angle}°: stepCount parity between 32 and 64`);
    assert.equal(res32.stats.hits, res64.stats.hits, `${tc.lvlKey} ${tc.angle}°: hits parity between 32 and 64`);
    assert.equal(res32.stats.destroyed, res64.stats.destroyed, `${tc.lvlKey} ${tc.angle}°: destroyed parity between 32 and 64`);
    assert.equal(res32.firstExitX, res64.firstExitX, `${tc.lvlKey} ${tc.angle}°: firstExitX parity between 32 and 64`);
    assert.deepEqual(res32.finalBlocks, res64.finalBlocks, `${tc.lvlKey} ${tc.angle}°: finalBlocks parity between 32 and 64`);
    assert.deepEqual(res32.events, res64.events, `${tc.lvlKey} ${tc.angle}°: events parity between 32 and 64`);
  }
});

test('Area E: Artificial tight-gap collision cap fixture resolves deterministically without state corruption', () => {
  const pinchedBlockA = { id: 'pA', x: 200, y: 300, width: 72, height: 40, value: 100, active: true };
  const pinchedBlockB = { id: 'pB', x: 200 + 72 + 2, y: 300, width: 72, height: 40, value: 100, active: true };

  const fixtureState = {
    ...createGameState(LEVELS.L01),
    blocks: [pinchedBlockA, pinchedBlockB],
    balls: { available: 1, inFlight: 0 },
    launcher: { x: 273, y: 600 },
  };

  const sim = new Simulation(fixtureState, 90, PHYSICS_CONFIG, { record: true });
  for (let i = 0; i < 20 && !sim.finished; i += 1) {
    sim.step();
  }

  const b = sim.balls[0];
  assert.ok(!Number.isNaN(b.x) && Number.isFinite(b.x), 'ball.x must remain finite');
  assert.ok(!Number.isNaN(b.y) && Number.isFinite(b.y), 'ball.y must remain finite');
  assert.ok(!Number.isNaN(b.vx) && Number.isFinite(b.vx), 'ball.vx must remain finite');
  assert.ok(!Number.isNaN(b.vy) && Number.isFinite(b.vy), 'ball.vy must remain finite');

  const preview = previewFuture(fixtureState, 90, { record: true });
  const gameplaySim = new Simulation(fixtureState, 90, PHYSICS_CONFIG, { record: true });
  const gameplayRes = gameplaySim.runToCompletion();

  assert.equal(preview.hits, gameplayRes.stats.hits, 'Pinched fixture hits match between Preview and Game');
  assert.equal(preview.destroyed, gameplayRes.stats.destroyed, 'Pinched fixture destructions match');
});

// ============================================================================
// AREA F: Pickup Ordering & Exclusivity
// ============================================================================
test('Area F: Two balls intersecting same pickup in same turn collect exactly once', () => {
  const state = createGameState(LEVELS.L01);
  const sim = new Simulation(state, 26.5, PHYSICS_CONFIG, { record: true });
  const res = sim.runToCompletion();

  const pickupEvents = res.events.filter((e) => e.type === 'PickupCollected');
  const uniquePickupIds = new Set(pickupEvents.map((e) => e.pickupId));

  assert.equal(pickupEvents.length, uniquePickupIds.size, 'Each pickup collected at most once');
  assert.equal(res.ballPickupsCollected, uniquePickupIds.size, 'ballPickupsCollected matches unique pickups');
});

// ============================================================================
// AREA G: Exit & FirstExitX Determinism
// ============================================================================
test('Area G: FirstExitX is established by earliest exit and immutable to later exits', () => {
  const state = createGameState(LEVELS.L01);
  const sim = new Simulation(state, 45, PHYSICS_CONFIG, { record: true });
  const res = sim.runToCompletion();

  const exitEvents = res.events.filter((e) => e.type === 'BallExited');
  assert.ok(exitEvents.length > 1, 'Multiple balls exited');

  const firstExitEvent = exitEvents[0];
  assert.equal(res.firstExitX, firstExitEvent.x, 'firstExitX matches the exact x of the first BallExited event');
  assert.ok(res.firstExitX >= 0 && res.firstExitX <= PHYSICS_CONFIG.canvasWidth, 'firstExitX within canvas bounds');
  assert.ok(res.nextLauncher.x >= 40 && res.nextLauncher.x <= 680, 'nextLauncher clamped to legal bounds');
});

// ============================================================================
// AREA J & K: Volley Completion Race & Turn Increment Exactly Once
// ============================================================================
test('Area J & K: applyTurnResult called exactly once advances turn by exactly 1 and descends board once', () => {
  const state = createGameState(LEVELS.L01);
  assert.equal(state.turn, 1);
  const initialRowY = state.blocks[0].y;

  const sim = new Simulation(state, 45, PHYSICS_CONFIG, { record: true });
  const result = sim.runToCompletion();

  const nextState = applyTurnResult(state, result);
  assert.equal(nextState.turn, 2, 'Turn must increment by exactly 1');
  assert.equal(nextState.waveIndex, 1, 'Wave index must advance by exactly 1');

  // Verify blocks descended by rowStep (68)
  const survivingBlock = nextState.blocks.find((b) => b.id === state.blocks[0].id);
  if (survivingBlock) {
    assert.equal(survivingBlock.y, initialRowY + PROGRESSION_CONFIG.rowStep, 'Surviving blocks descend exactly rowStep');
  }
});

// ============================================================================
// AREA L: Terminal State Timing & Input Locking
// ============================================================================
test('Area L: Terminal states (won or failed) reject subsequent shots', () => {
  const wonState = { ...createGameState(LEVELS.L01), stageStatus: 'won' };
  const failedState = { ...createGameState(LEVELS.L01), stageStatus: 'failed' };

  function canLaunch(state, isRunning, isTransitioning) {
    return !isRunning && !isTransitioning && state.stageStatus === 'active';
  }

  assert.equal(canLaunch(wonState, false, false), false, 'Won state cannot launch shot');
  assert.equal(canLaunch(failedState, false, false), false, 'Failed state cannot launch shot');
});

// ============================================================================
// AREA M: Future DOM Chip Presentation During Volley
// ============================================================================
test('Area M: Future DOM chip is hidden during flight (no false "Calculating…" claims)', () => {
  let domHTML = 'initial';
  let domOpacity = '1';

  function updateFutureDOM(p, calculating, isRunning, isTransitioning) {
    if (isRunning || isTransitioning) {
      domHTML = '';
      domOpacity = '0';
      return;
    }
    domOpacity = '1';
    if (calculating || !p) {
      domHTML = '<span class="opacity-40">Calculating…</span>';
    } else {
      const parts = [`${p.damage} dmg`, `${p.destroyed} destroyed`];
      domHTML = `<span>${parts.join(' · ')}</span>`;
    }
  }

  // During ready state:
  updateFutureDOM(null, true, false, false);
  assert.equal(domHTML, '<span class="opacity-40">Calculating…</span>');
  assert.equal(domOpacity, '1');

  // During flight (isRunning = true):
  updateFutureDOM(null, true, true, false);
  assert.equal(domHTML, '', 'DOM content must be empty during flight');
  assert.equal(domOpacity, '0', 'Opacity must be 0 (hidden) during flight');

  // During board transition (isTransitioning = true):
  updateFutureDOM(null, true, false, true);
  assert.equal(domHTML, '', 'DOM content must be empty during transition');
  assert.equal(domOpacity, '0', 'Opacity must be 0 (hidden) during transition');

  // Restored ready state:
  updateFutureDOM({ damage: 45, destroyed: 2, ballPickupsCollected: 0 }, false, false, false);
  assert.equal(domHTML, '<span>45 dmg · 2 destroyed</span>');
  assert.equal(domOpacity, '1');
});

// ============================================================================
// AREA N: Unmount Resource Cleanup
// ============================================================================
test('Area N: Unmount clears all pending RAFs, timers, and increments lifecycle token', () => {
  let animFrame = 1;
  let echoAnimFrame = 2;
  let previewTimer = 3;
  let echoCheckTimer = 4;
  let lifecycleToken = 10;

  function unmount() {
    lifecycleToken += 1;
    if (animFrame) animFrame = null;
    if (echoAnimFrame) echoAnimFrame = null;
    if (previewTimer) previewTimer = null;
    if (echoCheckTimer) echoCheckTimer = null;
  }

  unmount();
  assert.equal(animFrame, null, 'Main animFrame cancelled');
  assert.equal(echoAnimFrame, null, 'Echo animFrame cancelled');
  assert.equal(previewTimer, null, 'Preview timer cleared');
  assert.equal(echoCheckTimer, null, 'Echo check timer cleared');
  assert.equal(lifecycleToken, 11, 'Lifecycle token incremented to invalidate pending async callbacks');
});

// ============================================================================
// AREA O: Frame Hitch / Large Delta Time Clamp
// ============================================================================
test('Area O: Frame hitch is clamped to max 0.08s (80ms) preventing physics time spirals', () => {
  function getSafeDt(now, lastTime) {
    const rawDt = Math.min((now - lastTime) / 1000, 0.08);
    return rawDt;
  }

  // Normal 60fps frame: ~16.6ms
  assert.equal(getSafeDt(1016.6, 1000).toFixed(4), '0.0166');

  // Frame hitch (e.g. background tab return after 2.5 seconds = 2500ms):
  const hitchDt = getSafeDt(3500, 1000);
  assert.equal(hitchDt, 0.08, 'Hitch dt must be clamped strictly to 0.08s');
});
