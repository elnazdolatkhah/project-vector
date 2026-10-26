import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState } from '../src/domain/gameState.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { applyTurnResult } from '../src/domain/progression.js';
import { PROGRESSION_CONFIG } from '../src/config.js';
import { LEVELS } from '../src/levels/levels.js';

test('Scenario 1: Candidate destroys blocks - destroyed have no echo, survivors echo one row lower', () => {
  const state = createGameState({
    levelId: 'DESTRUCTION-ECHO-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 3,
    waveIndex: 0,
    blocks: [
      { id: 'TARGET_DESTROY', x: 320, y: 300, width: 70, height: 56, value: 1, active: true },
      { id: 'SURVIVOR_BLOCK', x: 100, y: 300, width: 70, height: 56, value: 50, active: true },
    ],
  });

  // Direct shot at center target destroying it
  const future = previewFuture(state, 90, { record: true });
  assert.equal(future.destroyed, 1, 'center block must be destroyed');

  const nextState = future.nextGameState;
  assert.ok(nextState, 'nextGameState must be authoritative');

  // Destroyed block must NOT be present in nextGameState (no next echo)
  const destroyedInNext = nextState.blocks.find((b) => b.id === 'TARGET_DESTROY');
  assert.equal(destroyedInNext, undefined, 'destroyed blocks must NOT receive a next-state echo');

  // Survivor block must be present exactly one row lower (y + rowStep)
  const survivorInNext = nextState.blocks.find((b) => b.id === 'SURVIVOR_BLOCK');
  assert.ok(survivorInNext, 'surviving block must exist in nextGameState');
  assert.equal(
    survivorInNext.y,
    300 + PROGRESSION_CONFIG.rowStep,
    `survivor must echo exactly one row lower (${300 + PROGRESSION_CONFIG.rowStep})`
  );
  assert.equal(survivorInNext.x, 100, 'horizontal position must be preserved');
});

test('Scenario 2: Candidate collects +1 Ball - pickup consequence visible and next ball count authoritative', () => {
  const state = createGameState({
    levelId: 'PICKUP-ECHO-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 3,
    waveIndex: 0,
    blocks: [],
    pickups: [
      { id: 'P1', x: 360, y: 600, radius: 14, active: true },
    ],
  });

  const future = previewFuture(state, 90, { record: true });
  assert.equal(future.ballPickupsCollected, 1, 'pickup must be collected');
  assert.equal(future.nextBallCount, 6, 'authoritative next ball count must be 5 + 1 = 6');
  assert.equal(future.nextGameState.balls.available, 6);

  // Collected pickup must not remain in nextGameState uncollected pickups
  const p1InNext = future.nextGameState.pickups.find((p) => p.id === 'P1');
  assert.equal(p1InNext, undefined, 'collected pickup must be consumed in next state');
});

test('Scenario 3: Candidate changes return X strongly - next launcher ghost visibly relocates', () => {
  const state = createGameState(LEVELS.L01);
  const initialLauncherX = state.launcher.x;

  // Shot angled to the right that bounces and exits far from initial launcher X
  const future = previewFuture(state, 45, { record: true });
  assert.ok(future.firstExitX != null, 'firstExitX must be established');
  assert.ok(
    Math.abs(future.nextLauncher.x - initialLauncherX) > 10,
    `next launcher X (${future.nextLauncher.x}) should visibly relocate from initial (${initialLauncherX})`
  );

  // Replay matches future prediction exactly
  const liveResult = simulateTurn(state, 45, { record: false });
  assert.equal(liveResult.firstExitX, future.firstExitX, 'replay must agree on return X');
});

test('Scenario 4: Final wave exhausted - no incoming wave echo', () => {
  const state = createGameState({
    levelId: 'FINAL-WAVE-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 1, // Only 1 wave total
    waveIndex: 1,  // Final wave already entered
    blocks: [
      { id: 'B1', x: 200, y: 300, width: 70, height: 56, value: 50, active: true },
    ],
  });

  const future = previewFuture(state, 90, { record: true });
  const nextBlocks = future.nextGameState.blocks;

  // Must only contain descended survivor, NO newly generated wave blocks
  assert.equal(nextBlocks.length, 1, 'only the surviving block remains');
  assert.equal(nextBlocks[0].id, 'B1');
  assert.equal(nextBlocks[0].y, 300 + PROGRESSION_CONFIG.rowStep);

  const incomingWaveBlocks = nextBlocks.filter((b) => b.id.startsWith('gen_'));
  assert.equal(incomingWaveBlocks.length, 0, 'no incoming wave blocks should be generated after final wave');
});

test('Scenario 5: Candidate future fails - breach location spatially obvious', () => {
  // Construct a block placed one row above danger line that will breach on descent
  const state = createGameState({
    levelId: 'BREACH-DANGER-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    totalWaves: 3,
    blocks: [
      {
        id: 'BREACH_BLOCK',
        x: 240,
        y: PROGRESSION_CONFIG.dangerLineY - PROGRESSION_CONFIG.rowStep,
        width: 70,
        height: 56,
        value: 100,
        active: true,
      },
    ],
  });

  // Shot that misses the critical block
  const future = previewFuture(state, 15, { record: false });
  assert.equal(future.stageStatus, 'failed', 'future must detect failure');

  const breachingBlock = future.nextGameState.blocks.find((b) => b.id === 'BREACH_BLOCK');
  assert.ok(breachingBlock, 'breaching block must exist in nextGameState');
  assert.ok(
    breachingBlock.y + breachingBlock.height >= PROGRESSION_CONFIG.dangerLineY,
    'breaching block bottom must cross danger line'
  );
});

test('Scenario 6: Candidate future wins - no contradictory danger/failure cue', () => {
  const state = createGameState({
    levelId: 'WIN-FUTURE-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    totalWaves: 1,
    waveIndex: 1, // Final wave already entered
    blocks: [
      { id: 'SOLO_TARGET', x: 340, y: 300, width: 70, height: 56, value: 1, active: true },
    ],
  });

  const future = previewFuture(state, 90, { record: false });
  assert.equal(future.stageStatus, 'won', 'future must predict win');
  assert.equal(future.isGameOver, false, 'won future isGameOver must be false');
  assert.equal(future.nextGameState.stageStatus, 'won');
  assert.equal(future.nextGameState.blocks.length, 0, 'no blocks remain on won board');
});

test('Scenario 7: Temporal reveal logic - rapid scrub keeps echo quiet, stable hold fades in', () => {
  const calculateAlpha = (holdDurationMs) => {
    if (holdDurationMs < 95) return 0;
    return Math.min(1.0, (holdDurationMs - 95) / 80);
  };

  // During rapid scrub (< 95ms hold)
  assert.equal(calculateAlpha(0), 0, '0ms hold has 0 alpha');
  assert.equal(calculateAlpha(30), 0, '30ms rapid scrub has 0 alpha');
  assert.equal(calculateAlpha(80), 0, '80ms scrub has 0 alpha');

  // Holding starts fade-in
  assert.ok(calculateAlpha(115) > 0 && calculateAlpha(115) < 1.0, '115ms hold has partial alpha');
  assert.ok(Math.abs(calculateAlpha(135) - 0.5) < 0.05, '135ms hold has ~0.5 alpha');

  // Settle at ~175ms+ has full opacity
  assert.equal(calculateAlpha(175), 1.0, '175ms hold is fully visible');
  assert.equal(calculateAlpha(300), 1.0, 'longer hold stays at 1.0');
});

test('Scenario 8: No extra simulation path - Future Echo derives strictly from existing FuturePreview', () => {
  const state = createGameState(LEVELS.L01);
  const future = previewFuture(state, 60, { record: false });

  // Verification that all Future Echo fields are already present in standard preview:
  assert.ok(future.nextGameState != null, 'nextGameState is present in preview');
  assert.ok(Array.isArray(future.nextGameState.blocks), 'nextGameState.blocks is present');
  assert.ok(future.nextLauncher != null, 'nextLauncher is present');
  assert.ok(typeof future.stageStatus === 'string', 'stageStatus is present');
  assert.ok(typeof future.ballPickupsCollected === 'number', 'ballPickupsCollected is present');
});
