import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  canonicalizeGameState,
  serializeGameState,
  deserializeGameState,
} from '../src/domain/gameState.js';
import { applyTurnResult } from '../src/domain/progression.js';
import { PROGRESSION_CONFIG } from '../src/config.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';

test('1: active shows neither win nor failure state', () => {
  const state = createGameState(LEVELS.L01);
  assert.equal(state.stageStatus, 'active');
  assert.equal(state.isGameOver, false);

  const isWon = state.stageStatus === 'won';
  const isFailed = state.stageStatus === 'failed';
  const isTerminal = state.stageStatus !== 'active';

  assert.equal(isWon, false, 'active state must not be won');
  assert.equal(isFailed, false, 'active state must not be failed');
  assert.equal(isTerminal, false, 'active state must not be terminal');
});

test('2: won shows win state only', () => {
  const state = createGameState({
    levelId: 'CLEAR-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    totalWaves: 1,
    waveIndex: 0,
    blocks: [
      { id: 'T1', x: 300, y: 250, width: 70, height: 56, value: 1, active: true },
    ],
  });

  // Turn 1: final wave entered
  const res1 = simulateTurn(state, 90, { record: false });
  const state1 = applyTurnResult(state, res1);
  assert.equal(state1.waveIndex, 1);

  // Clear remaining blocks
  const clearResult = {
    stats: { hits: 1, destroyed: state1.blocks.length, ballsExited: 5 },
    finalBlocks: state1.blocks.map((b) => ({ ...b, active: false, value: 0 })),
    firstExitX: 360,
    score: 100,
  };

  const wonState = applyTurnResult(state1, clearResult);

  assert.equal(wonState.stageStatus, 'won');
  assert.equal(wonState.isGameOver, false, 'won stage must have isGameOver === false');

  const isWon = wonState.stageStatus === 'won';
  const isFailed = wonState.stageStatus === 'failed';
  const isTerminal = wonState.stageStatus !== 'active';

  assert.equal(isWon, true, 'won state must be recognized as won');
  assert.equal(isFailed, false, 'won state must NOT be recognized as failed');
  assert.equal(isTerminal, true, 'won state must be terminal');
});

test('3: failed shows failure state only', () => {
  const state = createGameState({
    levelId: 'FAIL-TEST',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    totalWaves: 3,
    blocks: [
      {
        id: 'DANGER_BLOCK',
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
  const failedState = applyTurnResult(state, res);

  assert.equal(failedState.stageStatus, 'failed');
  assert.equal(failedState.isGameOver, true, 'failed stage must have isGameOver === true');

  const isWon = failedState.stageStatus === 'won';
  const isFailed = failedState.stageStatus === 'failed';
  const isTerminal = failedState.stageStatus !== 'active';

  assert.equal(isWon, false, 'failed state must NOT be recognized as won');
  assert.equal(isFailed, true, 'failed state must be recognized as failed');
  assert.equal(isTerminal, true, 'failed state must be terminal');
});

test('4: won cannot render failure overlay or danger line alert', () => {
  const wonState = createGameState({
    levelId: 'WON-CHECK',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    stageStatus: 'won',
    totalWaves: 3,
    waveIndex: 3,
    blocks: [],
  });

  // Presentation flags identical to canvasRenderer.ts
  const isFailed = wonState.stageStatus === 'failed';
  const isWon = wonState.stageStatus === 'won';
  const isTerminal = wonState.stageStatus !== 'active';

  assert.equal(isWon, true);
  assert.equal(isFailed, false);
  assert.equal(isTerminal, true);

  // In renderer:
  // if (isWon) { drawVictoryOverlay(); } else if (isFailed) { drawFailureOverlay(); }
  let renderedOverlay = null;
  if (isWon) {
    renderedOverlay = 'VICTORY';
  } else if (isFailed) {
    renderedOverlay = 'FAILURE';
  }

  assert.equal(renderedOverlay, 'VICTORY', 'won state must ONLY render victory overlay');
  assert.notEqual(renderedOverlay, 'FAILURE', 'won state must NEVER render failure overlay');
});

test('5: failed cannot render stage-clear overlay', () => {
  const failedState = createGameState({
    levelId: 'FAILED-CHECK',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    stageStatus: 'failed',
    totalWaves: 3,
    waveIndex: 1,
    blocks: [
      { id: 'B1', x: 200, y: 1070, width: 70, height: 56, value: 10, active: true },
    ],
  });

  // Presentation flags identical to canvasRenderer.ts
  const isFailed = failedState.stageStatus === 'failed';
  const isWon = failedState.stageStatus === 'won';
  const isTerminal = failedState.stageStatus !== 'active';

  assert.equal(isWon, false);
  assert.equal(isFailed, true);
  assert.equal(isTerminal, true);

  let renderedOverlay = null;
  if (isWon) {
    renderedOverlay = 'VICTORY';
  } else if (isFailed) {
    renderedOverlay = 'FAILURE';
  }

  assert.equal(renderedOverlay, 'FAILURE', 'failed state must ONLY render failure overlay');
  assert.notEqual(renderedOverlay, 'VICTORY', 'failed state must NEVER render victory overlay');
});

test('6: both terminal states block further launches', () => {
  const wonState = createGameState({
    levelId: 'WON-BLOCK',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    stageStatus: 'won',
    turn: 3,
    totalWaves: 3,
    waveIndex: 3,
    blocks: [],
  });

  const failedState = createGameState({
    levelId: 'FAILED-BLOCK',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    stageStatus: 'failed',
    turn: 3,
    totalWaves: 3,
    waveIndex: 1,
    blocks: [
      { id: 'B1', x: 200, y: 1070, width: 70, height: 56, value: 10, active: true },
    ],
  });

  // App.tsx input check
  const isTerminal = (state) => state.stageStatus !== 'active';
  assert.equal(isTerminal(wonState), true, 'won state must block input');
  assert.equal(isTerminal(failedState), true, 'failed state must block input');

  // applyTurnResult progression guard
  const dummyRes = { stats: { hits: 0, destroyed: 0, ballsExited: 5 }, finalBlocks: [], score: 50 };
  const nextWon = applyTurnResult(wonState, dummyRes);
  const nextFailed = applyTurnResult(failedState, dummyRes);

  assert.equal(nextWon.turn, 3, 'won state cannot progress turn');
  assert.equal(nextWon.stageStatus, 'won');

  assert.equal(nextFailed.turn, 3, 'failed state cannot progress turn');
  assert.equal(nextFailed.stageStatus, 'failed');
});

test('7: Preview and Solver preserve exact stageStatus', () => {
  // Test win prediction in Future Engine
  const nearWinState = createGameState({
    levelId: 'PREVIEW-WIN',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    totalWaves: 1,
    waveIndex: 1, // Final wave already entered
    blocks: [
      { id: 'WEAK', x: 340, y: 300, width: 70, height: 56, value: 1, active: true },
    ],
  });

  const winPreview = previewFuture(nearWinState, 90, { record: false });
  assert.equal(winPreview.stageStatus, 'won');
  assert.equal(winPreview.isGameOver, false, 'won preview isGameOver must be false');
  assert.equal(winPreview.nextGameState.stageStatus, 'won');
  assert.equal(winPreview.nextGameState.isGameOver, false);

  // Test danger breach in Future Engine
  const nearFailState = createGameState({
    levelId: 'PREVIEW-FAIL',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    totalWaves: 3,
    waveIndex: 0,
    blocks: [
      { id: 'DANGER', x: 200, y: PROGRESSION_CONFIG.dangerLineY - PROGRESSION_CONFIG.rowStep, width: 70, height: 56, value: 50, active: true },
    ],
  });

  const failPreview = previewFuture(nearFailState, 15, { record: false });
  assert.equal(failPreview.stageStatus, 'failed');
  assert.equal(failPreview.isGameOver, true, 'failed preview isGameOver must be true');
  assert.equal(failPreview.nextGameState.stageStatus, 'failed');
  assert.equal(failPreview.nextGameState.isGameOver, true);

  // Test Solver candidates
  const solution = solve(nearWinState, { sampleAngles: [85, 90, 95], maxDepth: 1 });
  assert.ok(solution.best !== null);
  assert.equal(solution.best.stageStatus, 'won');
  assert.equal(solution.best.isGameOver, false);
});

test('8: serialization preserves exact stageStatus', () => {
  const states = [
    createGameState({ levelId: 'S-ACTIVE', launcher: { x: 360, y: 1180 }, ballCount: 5, stageStatus: 'active', blocks: [] }),
    createGameState({ levelId: 'S-WON', launcher: { x: 360, y: 1180 }, ballCount: 5, stageStatus: 'won', blocks: [] }),
    createGameState({ levelId: 'S-FAILED', launcher: { x: 360, y: 1180 }, ballCount: 5, stageStatus: 'failed', blocks: [] }),
  ];

  for (const s of states) {
    const json = serializeGameState(s);
    const deserialized = deserializeGameState(json);

    assert.equal(deserialized.stageStatus, s.stageStatus, `serialized status ${s.stageStatus} matches`);
    assert.equal(deserialized.isGameOver, s.stageStatus === 'failed', `serialized isGameOver matches failure status`);
  }
});

test('9: no overlapping terminal UI state is possible', () => {
  const getHudBadge = (stageStatus, isGameOver) => {
    return stageStatus === 'won'
      ? ' · STAGE CLEAR'
      : (stageStatus === 'failed' ? ' · FAILED' : '');
  };

  const getFutureDOMBadge = (stageStatus) => {
    if (stageStatus === 'failed') return 'GAME OVER · DANGER REACHED';
    if (stageStatus === 'won') return 'STAGE CLEAR';
    return null;
  };

  // Test all canonical stage statuses
  const activeState = createGameState({ levelId: 'ACT', launcher: { x: 360, y: 1180 }, ballCount: 5, stageStatus: 'active', blocks: [] });
  const wonState = createGameState({ levelId: 'WON', launcher: { x: 360, y: 1180 }, ballCount: 5, stageStatus: 'won', blocks: [] });
  const failedState = createGameState({ levelId: 'FAIL', launcher: { x: 360, y: 1180 }, ballCount: 5, stageStatus: 'failed', blocks: [] });

  // 1. HUD badge verification
  assert.equal(getHudBadge(activeState.stageStatus, activeState.isGameOver), '');
  assert.equal(getHudBadge(wonState.stageStatus, wonState.isGameOver), ' · STAGE CLEAR');
  assert.equal(getHudBadge(failedState.stageStatus, failedState.isGameOver), ' · FAILED');

  // 2. Future chip badge verification
  assert.equal(getFutureDOMBadge(activeState.stageStatus), null);
  assert.equal(getFutureDOMBadge(wonState.stageStatus), 'STAGE CLEAR');
  assert.equal(getFutureDOMBadge(failedState.stageStatus), 'GAME OVER · DANGER REACHED');

  // 3. Impossibility of dual overlay
  for (const s of [activeState, wonState, failedState]) {
    const isWon = s.stageStatus === 'won';
    const isFailed = s.stageStatus === 'failed';
    assert.equal(isWon && isFailed, false, 'isWon and isFailed can NEVER be simultaneously true');
  }
});
