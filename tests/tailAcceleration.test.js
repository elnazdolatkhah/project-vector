import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS_CONFIG } from '../src/config.js';
import { createGameState, applyTurnResult } from '../src/domain/gameState.js';
import { Simulation, simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { LEVELS } from '../src/levels/levels.js';
import {
  evaluatePresentationSpeed,
  ACCELERATION_CONFIG,
  PRESENTATION_TIERS,
} from '../src/physics/presentationScheduler.js';

test('tailAcceleration 1: legal shots naturally resolve with universal canonical PHYSICS_CONFIG', () => {
  const state = createGameState(LEVELS.L01);
  const totalBalls = state.balls.available;
  assert.equal(totalBalls, 18);

  // Both shallow shots (5°, 175°) and normal shots naturally resolve using the exact same PHYSICS_CONFIG
  const testAngles = [5, 45, 146, 175];
  for (const angle of testAngles) {
    const sim = new Simulation(state, angle, PHYSICS_CONFIG, { record: true });
    const result = sim.runToCompletion();

    assert.equal(result.timedOut, false, `${angle}° must not time out under universal PHYSICS_CONFIG`);
    assert.equal(result.watchdogTriggered, false, `${angle}° watchdog must not trigger`);
    assert.equal(result.completed, true, `${angle}° must complete cleanly`);
    assert.equal(result.stats.ballsExited, totalBalls, `${angle}° all balls must exit normally`);
    assert.equal(result.unresolvedBalls.length, 0, `${angle}° must have zero unresolved balls`);
    assert.ok(typeof result.firstExitX === 'number', `${angle}° firstExitX must be a valid number`);
  }
});

test('tailAcceleration 2: 1x vs 2x vs 6x presentation stepping produces byte-for-byte identical results and event sequence', () => {
  // Test across L01-L05 and multiple trajectory types
  const testCases = [
    { levelKey: 'L01', angle: 45 },
    { levelKey: 'L01', angle: 5 },
    { levelKey: 'L01', angle: 146 },
    { levelKey: 'L02', angle: 65 },
    { levelKey: 'L03', angle: 105 },
    { levelKey: 'L04', angle: 80 },
    { levelKey: 'L05', angle: 151 },
  ];

  for (const tc of testCases) {
    const baseState = createGameState(LEVELS[tc.levelKey]);

    // 1x baseline: stepped 1 canonical fixedDt per frame
    const sim1x = new Simulation(baseState, tc.angle, PHYSICS_CONFIG, { record: true });
    while (!sim1x.finished) {
      sim1x.step();
    }
    const res1x = sim1x.result();

    // 2x stepping: stepped 2 canonical fixedDt per frame
    const sim2x = new Simulation(baseState, tc.angle, PHYSICS_CONFIG, { record: true });
    while (!sim2x.finished) {
      for (let s = 0; s < 2 && !sim2x.finished; s += 1) {
        sim2x.step();
      }
    }
    const res2x = sim2x.result();

    // 6x stepping: stepped 6 canonical fixedDt per frame
    const sim6x = new Simulation(baseState, tc.angle, PHYSICS_CONFIG, { record: true });
    while (!sim6x.finished) {
      for (let s = 0; s < 6 && !sim6x.finished; s += 1) {
        sim6x.step();
      }
    }
    const res6x = sim6x.result();

    // Dynamic mixed schedule stepping: starts 1x, switches to 2x after 240 steps, switches to 6x after 600 steps
    const simMixed = new Simulation(baseState, tc.angle, PHYSICS_CONFIG, { record: true });
    let stepCount = 0;
    while (!simMixed.finished) {
      const stepQuantum = stepCount < 240 ? 1 : (stepCount < 600 ? 2 : 6);
      for (let s = 0; s < stepQuantum && !simMixed.finished; s += 1) {
        simMixed.step();
        stepCount += 1;
      }
    }
    const resMixed = simMixed.result();

    // Verify byte-for-byte exact parity across 1x, 2x, 6x, and dynamic mixed stepping
    for (const [tierLabel, resCompare] of [
      ['2x', res2x],
      ['6x', res6x],
      ['dynamic mixed', resMixed],
    ]) {
      // 1. Final blocks and HP parity
      assert.deepEqual(resCompare.finalBlocks, res1x.finalBlocks, `${tc.levelKey} ${tc.angle}°: finalBlocks parity at ${tierLabel}`);
      const hp1x = res1x.finalBlocks.filter((b) => b.active).reduce((sum, b) => sum + b.value, 0);
      const hpComp = resCompare.finalBlocks.filter((b) => b.active).reduce((sum, b) => sum + b.value, 0);
      assert.equal(hpComp, hp1x, `${tc.levelKey} ${tc.angle}°: remaining HP parity at ${tierLabel}`);

      // 2. Hits and destruction counts
      assert.equal(resCompare.stats.hits, res1x.stats.hits, `${tc.levelKey} ${tc.angle}°: hits parity at ${tierLabel}`);
      assert.equal(resCompare.stats.destroyed, res1x.stats.destroyed, `${tc.levelKey} ${tc.angle}°: destroyed parity at ${tierLabel}`);

      // 3. Pickups collected
      assert.equal(resCompare.stats.ballPickupsCollected, res1x.stats.ballPickupsCollected, `${tc.levelKey} ${tc.angle}°: pickups parity at ${tierLabel}`);
      assert.deepEqual(resCompare.collectedPickups, res1x.collectedPickups, `${tc.levelKey} ${tc.angle}°: collectedPickups list parity at ${tierLabel}`);

      // 4. First exit X and next launcher
      assert.equal(resCompare.firstExitX, res1x.firstExitX, `${tc.levelKey} ${tc.angle}°: firstExitX parity at ${tierLabel}`);
      assert.deepEqual(resCompare.nextLauncher, res1x.nextLauncher, `${tc.levelKey} ${tc.angle}°: nextLauncher parity at ${tierLabel}`);

      // 5. Complete event sequence parity
      assert.deepEqual(resCompare.events, res1x.events, `${tc.levelKey} ${tc.angle}°: full event sequence parity at ${tierLabel}`);

      // 6. nextGameState and stageStatus parity
      const next1x = applyTurnResult(baseState, res1x);
      const nextComp = applyTurnResult(baseState, resCompare);
      assert.deepEqual(nextComp, next1x, `${tc.levelKey} ${tc.angle}°: nextGameState parity at ${tierLabel}`);
      assert.equal(nextComp.stageStatus, next1x.stageStatus, `${tc.levelKey} ${tc.angle}°: stageStatus parity at ${tierLabel}`);
    }
  }
});

test('tailAcceleration 3: Preview result == committed Gameplay result across routes and stages', () => {
  const routesToTest = [
    { desc: '5° shallow boundary', levelKey: 'L01', angle: 5 },
    { desc: '175° shallow boundary', levelKey: 'L01', angle: 175 },
    { desc: 'Long reflection route', levelKey: 'L01', angle: 146 },
    { desc: 'L01 pickup route', levelKey: 'L01', angle: 26.5 },
    { desc: 'L02 representative shot', levelKey: 'L02', angle: 65 },
    { desc: 'L02 pickup route', levelKey: 'L02', angle: 15.5 },
    { desc: 'L03 representative shot', levelKey: 'L03', angle: 45 },
    { desc: 'L03 pickup route', levelKey: 'L03', angle: 23.5 },
    { desc: 'L04 representative shot', levelKey: 'L04', angle: 90 },
    { desc: 'L04 pickup route', levelKey: 'L04', angle: 139.5 },
    { desc: 'L05 representative shot', levelKey: 'L05', angle: 151 },
    { desc: 'L05 pickup route', levelKey: 'L05', angle: 23.5 },
  ];

  for (const route of routesToTest) {
    const state = createGameState(LEVELS[route.levelKey]);

    // 1. Authoritative Preview calculation
    const preview = previewFuture(state, route.angle, { record: true });

    // 2. Authoritative Gameplay simulation run to natural completion
    const gameplaySim = new Simulation(state, route.angle, PHYSICS_CONFIG, { record: true });
    const gameplayResult = gameplaySim.runToCompletion();
    const gameplayNextState = applyTurnResult(state, gameplayResult);

    // Verify Preview and Gameplay are 100% identical in outcome
    assert.equal(preview.completed, gameplayResult.completed, `${route.desc}: completed match`);
    assert.equal(preview.timedOut, gameplayResult.timedOut, `${route.desc}: timedOut match`);
    assert.equal(preview.hits, gameplayResult.stats.hits, `${route.desc}: hits match`);
    assert.equal(preview.destroyed, gameplayResult.stats.destroyed, `${route.desc}: destroyed match`);
    assert.equal(preview.ballPickupsCollected, gameplayResult.ballPickupsCollected, `${route.desc}: pickups match`);
    assert.equal(preview.firstExitX, gameplayResult.firstExitX, `${route.desc}: firstExitX match`);
    assert.deepEqual(preview.nextLauncher, gameplayResult.nextLauncher, `${route.desc}: nextLauncher match`);
    assert.deepEqual(preview.result.finalBlocks, gameplayResult.finalBlocks, `${route.desc}: finalBlocks match`);
    assert.deepEqual(preview.nextGameState, gameplayNextState, `${route.desc}: nextGameState match`);
    assert.equal(preview.stageStatus, gameplayNextState.stageStatus, `${route.desc}: stageStatus match`);
  }
});

test('tailAcceleration 4: presentation scheduler transitions (1x -> 2x -> 6x) and latching rules', () => {
  // 1. Spawning phase stays strictly at 1.0x NORMAL
  const evalSpawning = evaluatePresentationSpeed({
    elapsedRealSeconds: 2.0,
    activeBallsCount: 15,
    exitedBallsCount: 0,
    totalBalls: 18,
    allSpawned: false,
    currentTier: 'NORMAL',
  });
  assert.equal(evalSpawning.speed, 1.0);
  assert.equal(evalSpawning.tier, 'NORMAL');
  assert.equal(evalSpawning.isAccelerated, false);
  assert.equal(evalSpawning.reason, 'initial');

  // 2. Early volley (< 4.0s elapsed) stays strictly at 1.0x NORMAL even if active <= 3
  const evalEarly = evaluatePresentationSpeed({
    elapsedRealSeconds: 3.5,
    activeBallsCount: 2,
    exitedBallsCount: 16,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'NORMAL',
  });
  assert.equal(evalEarly.speed, 1.0);
  assert.equal(evalEarly.tier, 'NORMAL');
  assert.equal(evalEarly.isAccelerated, false);
  assert.equal(evalEarly.reason, 'initial');

  // 3. Short volley completing under 4.0s stays entirely at 1.0x NORMAL and never reaches 6x
  const evalShort = evaluatePresentationSpeed({
    elapsedRealSeconds: 3.8,
    activeBallsCount: 1,
    exitedBallsCount: 17,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'NORMAL',
  });
  assert.equal(evalShort.speed, 1.0);
  assert.equal(evalShort.tier, 'NORMAL');

  // 4. 1x -> 2x: at >= 4.0s, triggers 2x if active <= 3
  const evalTailA = evaluatePresentationSpeed({
    elapsedRealSeconds: 4.2,
    activeBallsCount: 3,
    exitedBallsCount: 15,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'NORMAL',
  });
  assert.equal(evalTailA.speed, 2.0);
  assert.equal(evalTailA.tier, 'TAIL');
  assert.equal(evalTailA.isAccelerated, true);
  assert.equal(evalTailA.reason, 'tail-active-count');

  // 5. 1x -> 2x: at >= 4.0s, triggers 2x if exited >= 75%
  const evalTailB = evaluatePresentationSpeed({
    elapsedRealSeconds: 4.1,
    activeBallsCount: 4,
    exitedBallsCount: 14, // 14/18 = 77.7%
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'NORMAL',
  });
  assert.equal(evalTailB.speed, 2.0);
  assert.equal(evalTailB.tier, 'TAIL');
  assert.equal(evalTailB.isAccelerated, true);
  assert.equal(evalTailB.reason, 'tail-exited-proportion');

  // 6. Cannot jump directly from NORMAL to RAPID_TAIL (6x only activates after 2x)
  const evalDirectJump = evaluatePresentationSpeed({
    elapsedRealSeconds: 15.0,
    activeBallsCount: 1,
    exitedBallsCount: 17,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'NORMAL',
  });
  assert.equal(evalDirectJump.speed, 2.0, 'first transition from NORMAL must be TAIL (2.0x), never directly 6.0x');
  assert.equal(evalDirectJump.tier, 'TAIL');

  // 7. 2x -> 6x requires at least 3.0 additional real seconds in 2x:
  // e.g. entered 2x at t=4.5s; at t=7.0s (only 2.5s in 2x), cannot escalate to 6x even with active=1
  const eval2xNotYet3s = evaluatePresentationSpeed({
    elapsedRealSeconds: 7.0,
    activeBallsCount: 1,
    exitedBallsCount: 17,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'TAIL',
    tail2xStartTime: 4.5, // 7.0 - 4.5 = 2.5s < 3.0s
  });
  assert.equal(eval2xNotYet3s.speed, 2.0, 'must remain 2x when < 3.0s spent in 2x');
  assert.equal(eval2xNotYet3s.tier, 'TAIL');
  assert.equal(eval2xNotYet3s.reason, 'latched-tail');

  // 8. 2x -> 6x requires active <= 3:
  // e.g. entered 2x at t=4.0s; at t=8.0s (4.0s in 2x), but active=4 (dense action), cannot escalate to 6x
  const eval2xActiveTooHigh = evaluatePresentationSpeed({
    elapsedRealSeconds: 8.0,
    activeBallsCount: 4,
    exitedBallsCount: 14,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'TAIL',
    tail2xStartTime: 4.0,
  });
  assert.equal(eval2xActiveTooHigh.speed, 2.0, 'cannot escalate to 6x if active > 3');
  assert.equal(eval2xActiveTooHigh.tier, 'TAIL');
  assert.equal(eval2xActiveTooHigh.reason, 'latched-tail');

  // 9. 2x -> 6x triggers when in 2x, >= 3.0s in 2x, and active <= 3
  const evalRapidTrigger = evaluatePresentationSpeed({
    elapsedRealSeconds: 7.5,
    activeBallsCount: 2,
    exitedBallsCount: 16,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'TAIL',
    tail2xStartTime: 4.2, // 7.5 - 4.2 = 3.3s >= 3.0s
  });
  assert.equal(evalRapidTrigger.speed, 6.0, 'triggers 6.0x RAPID_TAIL');
  assert.equal(evalRapidTrigger.tier, 'RAPID_TAIL');
  assert.equal(evalRapidTrigger.isAccelerated, true);
  assert.equal(evalRapidTrigger.reason, 'rapid-tail');

  // 10. RAPID_TAIL latches unconditionally until completion (never reverts to 2x or 1x)
  const evalLatchedRapid = evaluatePresentationSpeed({
    elapsedRealSeconds: 12.0,
    activeBallsCount: 1,
    exitedBallsCount: 17,
    totalBalls: 18,
    allSpawned: true,
    currentTier: 'RAPID_TAIL',
    tail2xStartTime: 4.2,
  });
  assert.equal(evalLatchedRapid.speed, 6.0, 'RAPID_TAIL latches at 6.0x');
  assert.equal(evalLatchedRapid.tier, 'RAPID_TAIL');
  assert.equal(evalLatchedRapid.isAccelerated, true);
  assert.equal(evalLatchedRapid.reason, 'latched-rapid-tail');

  // 11. No tier exceeds 6.0x (no 10x, 20x, etc.)
  assert.equal(PRESENTATION_TIERS.NORMAL, 1.0);
  assert.equal(PRESENTATION_TIERS.TAIL, 2.0);
  assert.equal(PRESENTATION_TIERS.RAPID_TAIL, 6.0);
  assert.equal(Object.keys(PRESENTATION_TIERS).length, 3, 'exactly three tiers defined');
});

test('tailAcceleration 5: stuck/pathological trajectory engine watchdog test', () => {
  const state = createGameState(LEVELS.L01);
  const initialBlocks = state.blocks.map((b) => ({ ...b }));
  const initialTurn = state.turn;
  const initialLauncherX = state.launcher.x;

  // Run with an intentionally tiny watchdog step guard (e.g. 50 steps)
  const watchdogConfig = { ...PHYSICS_CONFIG, maxSimulationSteps: 50 };
  const sim = new Simulation(state, 45, watchdogConfig, { record: true });
  const result = sim.runToCompletion();

  // 1. Distinguishable from a completed volley
  assert.equal(result.completed, false, 'watchdog failure must have completed: false');
  assert.equal(result.watchdogTriggered, true, 'watchdogTriggered must be true');
  assert.equal(result.timedOut, true, 'timedOut must be true for backwards compatibility');
  assert.ok(result.stepCount > 50, 'stepCount must reflect reached guard');

  // 2. Active balls must NOT be deactivated into a fake completion
  const activeBalls = sim.balls.filter((b) => b.active);
  assert.ok(activeBalls.length > 0, 'active balls must remain active in the simulation object');
  assert.equal(
    result.unresolvedBalls.length,
    activeBalls.length,
    'unresolvedBalls must accurately list the active in-flight balls'
  );

  // 3. Must not fabricate firstExitX or nextLauncher
  assert.equal(result.firstExitX, null, 'firstExitX must remain null');
  assert.equal(result.nextLauncher.x, initialLauncherX, 'nextLauncher must remain at original launcher position');

  // 4. Must not advance board progression
  const nextState = applyTurnResult(state, result);
  assert.equal(nextState.turn, initialTurn, 'turn must not advance on watchdog failure');
  assert.equal(nextState.launcher.x, initialLauncherX, 'launcher must not move on watchdog failure');
  assert.deepEqual(nextState.blocks, initialBlocks, 'blocks must not descend or alter on watchdog failure');
  assert.equal(nextState.stageStatus, 'active', 'stage remains active without failure/win corruption');
});

test('tailAcceleration 6: physics constants remain strictly canonical', () => {
  assert.equal(PHYSICS_CONFIG.fixedDt, 1 / 60, 'fixedDt must remain exactly 1/60');
  assert.equal(PHYSICS_CONFIG.ballSpeed, 10, 'ballSpeed must remain exactly 10');
  assert.equal(PHYSICS_CONFIG.ballRadius, 6, 'ballRadius must remain exactly 6');
  assert.equal(PHYSICS_CONFIG.gravity, 0, 'gravity must remain exactly 0');
  assert.equal(PHYSICS_CONFIG.canvasWidth, 720, 'canvasWidth must remain exactly 720');
  assert.equal(PHYSICS_CONFIG.canvasHeight, 1280, 'canvasHeight must remain exactly 1280');
  assert.equal(PHYSICS_CONFIG.maxSimulationSteps, 15000, 'maxSimulationSteps engine watchdog guard is 15000');
});

test('tailAcceleration 7: pathological long-tail simulation measurements under 1x -> 2x -> 6x schedule', () => {
  // Test the key pathological long-tail trajectories
  const cases = [
    { levelKey: 'L03', angle: 23.5, label: 'L03 23.5° (Double Reflection)' },
    { levelKey: 'L01', angle: 146, label: 'L01 146°' },
    { levelKey: 'L05', angle: 151, label: 'L05 151°' },
    { levelKey: 'L01', angle: 90, label: 'L01 90° (Standard vertical)' },
  ];

  const results = [];

  for (const c of cases) {
    const state = createGameState(LEVELS[c.levelKey]);
    const sim = new Simulation(state, c.angle, PHYSICS_CONFIG, { record: true });

    let currentTier = 'NORMAL';
    let tail2xStartTime = null;
    let timeEntering2x = null;
    let timeEntering6x = null;
    let activeBallsAt6xEntry = null;

    let realTimeElapsed = 0; // In seconds
    const frameDt = 1 / 60; // 60fps presentation tick (0.016667s)
    let accumulator = 0;
    const fixedDt = PHYSICS_CONFIG.fixedDt;

    while (!sim.finished) {
      realTimeElapsed += frameDt;

      const activeBallsCount = sim.balls.filter((b) => b.active).length;
      const exitedBallsCount = sim.balls.filter((b) => b.spawned && !b.active).length;
      const totalBalls = sim.balls.length;
      const allSpawned = sim.balls.every((b) => b.spawned);

      const speedEval = evaluatePresentationSpeed({
        elapsedRealSeconds: realTimeElapsed,
        activeBallsCount,
        exitedBallsCount,
        totalBalls,
        allSpawned,
        currentTier,
        tail2xStartTime,
      });

      if (currentTier === 'NORMAL' && speedEval.tier === 'TAIL') {
        tail2xStartTime = realTimeElapsed;
        timeEntering2x = realTimeElapsed;
      }
      if (currentTier === 'TAIL' && speedEval.tier === 'RAPID_TAIL') {
        timeEntering6x = realTimeElapsed;
        activeBallsAt6xEntry = activeBallsCount;
      }

      currentTier = speedEval.tier;
      const currentSpeed = speedEval.speed;

      accumulator += frameDt * currentSpeed;

      while (accumulator >= fixedDt && !sim.finished) {
        sim.step();
        accumulator -= fixedDt;
      }
    }

    const simRes = sim.result();
    assert.equal(simRes.completed, true, `${c.label} must complete cleanly`);

    const tailRealDuration = timeEntering2x != null ? realTimeElapsed - timeEntering2x : 0;
    const rapidTailRealDuration = timeEntering6x != null ? realTimeElapsed - timeEntering6x : 0;

    results.push({
      label: c.label,
      canonicalSteps: simRes.stepCount,
      canonicalSeconds: (simRes.stepCount * fixedDt).toFixed(2),
      timeEntering2x: timeEntering2x != null ? timeEntering2x.toFixed(2) : 'N/A',
      timeEntering6x: timeEntering6x != null ? timeEntering6x.toFixed(2) : 'N/A',
      activeBallsAt6xEntry: activeBallsAt6xEntry != null ? activeBallsAt6xEntry : 'N/A',
      tailRealDuration: tailRealDuration.toFixed(2),
      rapidTailRealDuration: rapidTailRealDuration.toFixed(2),
      totalRealVolleyDuration: realTimeElapsed.toFixed(2),
    });

    // Verification: remaining tail duration after entering 2x should be comfortably under ~8–10 real seconds!
    // And for long volleys, total real duration should be heavily compressed
    if (timeEntering6x != null) {
      assert.ok(
        rapidTailRealDuration <= 10.0,
        `${c.label}: remaining 6x tail wait (${rapidTailRealDuration}s) must be under ~8-10 real seconds`
      );
    }
  }

  // Print results summary to console for review
  console.log('\n=== Pathological Long-Tail Throughput & Duration Validation ===');
  for (const r of results) {
    console.log(`[${r.label}]`);
    console.log(`  Canonical steps: ${r.canonicalSteps} (${r.canonicalSeconds}s physics time)`);
    console.log(`  2x entry time: ${r.timeEntering2x}s`);
    console.log(`  6x entry time: ${r.timeEntering6x}s (active balls at 6x entry: ${r.activeBallsAt6xEntry})`);
    console.log(`  Tail duration (2x+6x): ${r.tailRealDuration}s (rapid 6x portion: ${r.rapidTailRealDuration}s)`);
    console.log(`  Total real volley duration: ${r.totalRealVolleyDuration}s\n`);
  }
});
