import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  serializeGameState,
  deserializeGameState,
  applyTurnResult,
} from '../src/domain/gameState.js';
import { simulateTurn, Simulation } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';
import { PROGRESSION_CONFIG, PHYSICS_CONFIG } from '../src/config.js';

test('1: stage remains active while waves remain', () => {
  // L01 has totalWaves: 3. Initial waveIndex: 0.
  const state = createGameState(LEVELS.L01);
  assert.equal(state.stageStatus, 'active', 'initial stageStatus must be active');
  assert.equal(state.waveIndex, 0, 'initial waveIndex must be 0');
  assert.equal(state.totalWaves, 3, 'L01 totalWaves must be 3');

  // Turn 1: 1st wave enters. Waves remaining: 3 - 1 = 2 > 0.
  const res1 = simulateTurn(state, 50, { record: false });
  const turn2State = applyTurnResult(state, res1);
  assert.equal(turn2State.stageStatus, 'active', 'stage must remain active after wave 1');
  assert.equal(turn2State.waveIndex, 1, 'waveIndex must advance to 1');

  // Turn 2: 2nd wave enters. Waves remaining: 3 - 2 = 1 > 0.
  const res2 = simulateTurn(turn2State, 55, { record: false });
  const turn3State = applyTurnResult(turn2State, res2);
  assert.equal(turn3State.stageStatus, 'active', 'stage must remain active after wave 2');
  assert.equal(turn3State.waveIndex, 2, 'waveIndex must advance to 2');
});

test('2: exactly one wave advances per completed volley', () => {
  const state = createGameState({
    levelId: 'WAVE-ADVANCE',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 4,
    blocks: [
      { id: 'B1', x: 200, y: 300, width: 70, height: 56, value: 50, active: true },
    ],
  });

  assert.equal(state.waveIndex, 0, 'initial waveIndex is 0');

  const res1 = simulateTurn(state, 45, { record: false });
  const state1 = applyTurnResult(state, res1);
  assert.equal(state1.waveIndex, 1, 'turn 1 must increment waveIndex by exactly 1');

  const res2 = simulateTurn(state1, 45, { record: false });
  const state2 = applyTurnResult(state1, res2);
  assert.equal(state2.waveIndex, 2, 'turn 2 must increment waveIndex by exactly 1');

  const res3 = simulateTurn(state2, 45, { record: false });
  const state3 = applyTurnResult(state2, res3);
  assert.equal(state3.waveIndex, 3, 'turn 3 must increment waveIndex by exactly 1');

  const res4 = simulateTurn(state3, 45, { record: false });
  const state4 = applyTurnResult(state3, res4);
  assert.equal(state4.waveIndex, 4, 'turn 4 must increment waveIndex to totalWaves (4)');
});

test('3: no rows generate after the last wave', () => {
  // Level with totalWaves = 2.
  const state = createGameState({
    levelId: 'FINITE-WAVES',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 2,
    blocks: [
      { id: 'ANCHOR', x: 200, y: 250, width: 70, height: 56, value: 99, active: true },
    ],
  });

  // Turn 1: Wave 1 enters (gen_r1_...)
  const res1 = simulateTurn(state, 90, { record: false });
  const state1 = applyTurnResult(state, res1);
  assert.equal(state1.waveIndex, 1);
  const genWave1 = state1.blocks.filter((b) => b.id.startsWith('gen_r1_'));
  assert.ok(genWave1.length > 0, 'wave 1 row must be generated');

  // Turn 2: Wave 2 enters (gen_r2_...) - this is the final wave
  const res2 = simulateTurn(state1, 90, { record: false });
  const state2 = applyTurnResult(state1, res2);
  assert.equal(state2.waveIndex, 2);
  const genWave2 = state2.blocks.filter((b) => b.id.startsWith('gen_r2_'));
  assert.ok(genWave2.length > 0, 'wave 2 row must be generated');

  // Turn 3: Waves exhausted (waveIndex = 2 == totalWaves = 2). NO gen_r3_ should be generated!
  const res3 = simulateTurn(state2, 90, { record: false });
  const state3 = applyTurnResult(state2, res3);
  assert.equal(state3.waveIndex, 2, 'waveIndex must remain capped at totalWaves');
  const genWave3 = state3.blocks.filter((b) => b.id.startsWith('gen_r3_'));
  assert.equal(genWave3.length, 0, 'no row must generate after the last wave is exhausted');

  // Turn 4: Still exhausted. NO gen_r4_ should be generated!
  const res4 = simulateTurn(state3, 90, { record: false });
  const state4 = applyTurnResult(state3, res4);
  assert.equal(state4.waveIndex, 2, 'waveIndex remains capped');
  const genWave4 = state4.blocks.filter((b) => b.id.startsWith('gen_r4_'));
  assert.equal(genWave4.length, 0, 'no row must generate on subsequent turns');
});

test('4: empty current board does not win if future waves remain', () => {
  // Start with an empty board (blocks: []), but totalWaves = 2
  const state = createGameState({
    levelId: 'WAITING-FOR-WAVES',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    totalWaves: 2,
    blocks: [],
  });

  assert.equal(state.stageStatus, 'active', 'initial empty board with waves remaining is active');

  // Turn 1: Wave 1 enters. WaveIndex becomes 1 (< 2).
  // Even if all generated blocks of wave 1 were cleared or if it had 0 blocks, stage must not win yet.
  const res = simulateTurn(state, 45, { record: false });
  // Construct a simulation result where all wave 1 blocks were destroyed
  const allDestroyedResult = {
    ...res,
    finalBlocks: res.finalBlocks.map((b) => ({ ...b, active: false, value: 0 })),
  };
  const nextState = applyTurnResult(state, allDestroyedResult);

  assert.equal(nextState.waveIndex, 1, 'waveIndex is 1');
  assert.equal(nextState.totalWaves, 2, 'totalWaves is 2');
  assert.equal(
    nextState.stageStatus,
    'active',
    'empty board must NOT win while future waves remain (waveIndex 1 < totalWaves 2)'
  );
  assert.equal(nextState.isGameOver, false);
});

test('5: final wave entered + no active blocks = WON', () => {
  // Level with totalWaves = 1, single weak block
  const state = createGameState({
    levelId: 'CLEAR-STAGE',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 1,
    blocks: [
      { id: 'TARGET', x: 340, y: 250, width: 70, height: 56, value: 1, active: true },
    ],
  });

  // Turn 1: Wave 1 enters (final wave). WaveIndex becomes 1 == totalWaves.
  const res1 = simulateTurn(state, 90, { record: false });
  const state1 = applyTurnResult(state, res1);
  assert.equal(state1.waveIndex, 1, 'final wave has entered');

  // Now clear all remaining blocks
  const clearResult = {
    stats: { hits: 10, destroyed: state1.blocks.length, ballsExited: 5 },
    finalBlocks: state1.blocks.map((b) => ({ ...b, active: false, value: 0 })),
    firstExitX: 360,
    score: 100,
  };

  const wonState = applyTurnResult(state1, clearResult);
  assert.equal(wonState.stageStatus, 'won', 'stage must be WON when all waves entered and all blocks destroyed');
  assert.equal(wonState.isGameOver, false, 'won stage is not game over / failure (isGameOver = false)');
});

test('6: danger breach = FAILED', () => {
  // Block positioned right above danger line
  const state = createGameState({
    levelId: 'DANGER-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    totalWaves: 3,
    blocks: [
      {
        id: 'CRITICAL',
        x: 200,
        y: PROGRESSION_CONFIG.dangerLineY - PROGRESSION_CONFIG.rowStep,
        width: 70,
        height: 56,
        value: 50,
        active: true,
      },
    ],
  });

  const res = simulateTurn(state, 15, { record: false });
  const nextState = applyTurnResult(state, res);

  assert.equal(nextState.stageStatus, 'failed', 'stage must be FAILED when danger line is breached');
  assert.equal(nextState.isGameOver, true, 'isGameOver must be true on failure');
});

test('7: WON state cannot advance further', () => {
  const wonState = createGameState({
    levelId: 'WON-FROZEN',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    totalWaves: 1,
    waveIndex: 1,
    stageStatus: 'won',
    turn: 5,
    score: 500,
    blocks: [],
  });

  assert.equal(wonState.stageStatus, 'won');

  const dummyResult = {
    stats: { hits: 0, destroyed: 0, ballsExited: 10 },
    finalBlocks: [],
    firstExitX: 400,
    score: 50,
  };

  const afterTurn = applyTurnResult(wonState, dummyResult);
  assert.equal(afterTurn.stageStatus, 'won', 'stageStatus must remain won');
  assert.equal(afterTurn.turn, 5, 'turn must not advance on won state');
  assert.equal(afterTurn.score, 500, 'score must not change on won state');
  assert.equal(afterTurn.launcher.x, wonState.launcher.x, 'launcher must not move on won state');
});

test('8: FAILED state cannot advance further', () => {
  const failedState = createGameState({
    levelId: 'FAILED-FROZEN',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    totalWaves: 3,
    waveIndex: 1,
    stageStatus: 'failed',
    turn: 4,
    score: 250,
    blocks: [
      { id: 'BREACH', x: 200, y: 1100, width: 70, height: 56, value: 10, active: true },
    ],
  });

  assert.equal(failedState.stageStatus, 'failed');

  const dummyResult = {
    stats: { hits: 0, destroyed: 0, ballsExited: 10 },
    finalBlocks: failedState.blocks,
    firstExitX: 400,
    score: 50,
  };

  const afterTurn = applyTurnResult(failedState, dummyResult);
  assert.equal(afterTurn.stageStatus, 'failed', 'stageStatus must remain failed');
  assert.equal(afterTurn.turn, 4, 'turn must not advance on failed state');
  assert.equal(afterTurn.score, 250, 'score must not change on failed state');
});

test('9: Preview status == gameplay status', () => {
  // Test both active progression and winning future
  const stateActive = createGameState(LEVELS.L01);
  const angle = 60;
  const liveResActive = simulateTurn(stateActive, angle, { record: false });
  const liveNextActive = applyTurnResult(stateActive, liveResActive);
  const previewActive = previewFuture(stateActive, angle, { record: false });

  assert.equal(previewActive.stageStatus, liveNextActive.stageStatus, 'Preview stageStatus matches live gameplay');
  assert.equal(previewActive.nextGameState.stageStatus, liveNextActive.stageStatus);
  assert.equal(previewActive.nextGameState.waveIndex, liveNextActive.waveIndex);
  assert.equal(previewActive.nextGameState.totalWaves, liveNextActive.totalWaves);

  // Test danger breach in Preview vs Gameplay
  const stateDanger = createGameState({
    levelId: 'PREVIEW-DANGER',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    totalWaves: 3,
    blocks: [
      { id: 'CRITICAL', x: 200, y: PROGRESSION_CONFIG.dangerLineY - PROGRESSION_CONFIG.rowStep, width: 70, height: 56, value: 50, active: true },
    ],
  });
  const liveResDanger = simulateTurn(stateDanger, 15, { record: false });
  const liveNextDanger = applyTurnResult(stateDanger, liveResDanger);
  const previewDanger = previewFuture(stateDanger, 15, { record: false });

  assert.equal(liveNextDanger.stageStatus, 'failed');
  assert.equal(previewDanger.stageStatus, 'failed', 'Preview must detect failure identically to gameplay');
  assert.equal(previewDanger.isGameOver, true);
});

test('10: Solver replay status == gameplay status', () => {
  const state = createGameState(LEVELS.L01);
  const solution = solve(state, { sampleAngles: [30, 45, 60, 75, 90], maxDepth: 1 });
  const bestCandidate = solution.best;

  assert.ok(bestCandidate !== null, 'Solver must return best candidate');
  assert.equal(bestCandidate.stageStatus, bestCandidate.nextGameState.stageStatus);

  // Replay best candidate through live simulation
  const replaySim = simulateTurn(state, bestCandidate.angleDeg, { record: false });
  const replayNextState = applyTurnResult(state, replaySim);

  assert.equal(bestCandidate.stageStatus, replayNextState.stageStatus, 'Solver candidate stageStatus matches replay');
  assert.equal(bestCandidate.nextGameState.waveIndex, replayNextState.waveIndex, 'Solver waveIndex matches replay');
  assert.equal(bestCandidate.nextGameState.totalWaves, replayNextState.totalWaves, 'Solver totalWaves matches replay');
});

test('11: serialize/load preserves wave index and stage status', () => {
  const state = createGameState({
    levelId: 'SERIALIZE-STAGE',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    totalWaves: 5,
    waveIndex: 3,
    stageStatus: 'active',
    turn: 4,
    score: 120,
    blocks: [
      { id: 'B1', x: 200, y: 300, width: 70, height: 56, value: 12, active: true },
    ],
  });

  const serialized = serializeGameState(state);
  const loaded = deserializeGameState(serialized);

  assert.equal(loaded.stageStatus, 'active', 'deserialized state must preserve stageStatus');
  assert.equal(loaded.waveIndex, 3, 'deserialized state must preserve waveIndex');
  assert.equal(loaded.totalWaves, 5, 'deserialized state must preserve totalWaves');
  assert.deepEqual(loaded, state, 'canonicalized state must round-trip exactly');

  // Verify won status serialization
  const wonState = { ...state, stageStatus: 'won' };
  const wonLoaded = deserializeGameState(serializeGameState(wonState));
  assert.equal(wonLoaded.stageStatus, 'won');
  assert.equal(wonLoaded.isGameOver, false);

  // Verify failed status serialization
  const failedState = { ...state, stageStatus: 'failed', isGameOver: true };
  const failedLoaded = deserializeGameState(serializeGameState(failedState));
  assert.equal(failedLoaded.stageStatus, 'failed');
  assert.equal(failedLoaded.isGameOver, true);
});

test('12: all existing systems remain valid on finite-wave L01 stage', () => {
  const state = createGameState(LEVELS.L01);
  assert.equal(state.totalWaves, 3, 'L01 has 3 finite waves');
  assert.equal(state.stageStatus, 'active');

  // Step through all 3 waves
  let current = state;
  for (let turn = 1; turn <= 3; turn += 1) {
    const res = simulateTurn(current, 50 + turn * 5, { record: false });
    current = applyTurnResult(current, res);
    assert.equal(current.waveIndex, turn, `after turn ${turn}, waveIndex must be ${turn}`);
    assert.equal(current.stageStatus, 'active');
  }

  // Volley 4: waves exhausted (waveIndex = 3, totalWaves = 3)
  const res4 = simulateTurn(current, 70, { record: false });
  const turn4State = applyTurnResult(current, res4);
  assert.equal(turn4State.waveIndex, 3, 'waveIndex must not exceed totalWaves');
  assert.equal(turn4State.totalWaves, 3);
  // Ensure no new block row gen_r4_ was added
  const r4Blocks = turn4State.blocks.filter((b) => b.id.startsWith('gen_r4_'));
  assert.equal(r4Blocks.length, 0, 'no 4th wave must enter on finite 3-wave L01 stage');
});
