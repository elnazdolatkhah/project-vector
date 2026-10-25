import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  serializeGameState,
  deserializeGameState,
  applyTurnResult,
  generateTopRow,
  checkDangerLineFailure,
  clampLauncherX,
} from '../src/domain/gameState.js';
import { PROGRESSION_CONFIG, INPUT_CONFIG } from '../src/config.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';

test('1: surviving blocks descend exactly one row', () => {
  const state = createGameState(LEVELS.L01);
  const result = simulateTurn(state, 45, { record: false });
  const nextState = applyTurnResult(state, result);

  // Find a block that survived in the simulation result
  const survivingOriginal = result.finalBlocks.find((b) => b.active && b.value > 0);
  assert.ok(survivingOriginal, 'at least one block should survive');

  const descendedBlock = nextState.blocks.find((b) => b.id === survivingOriginal.id);
  assert.ok(descendedBlock, 'surviving block must exist in nextState');
  assert.equal(
    descendedBlock.y,
    Math.round((survivingOriginal.y + PROGRESSION_CONFIG.rowStep) * 1e6) / 1e6,
    'surviving block must descend by exactly ROW_STEP (68 units)'
  );
});

test('2: destroyed blocks do not descend', () => {
  const state = createGameState({
    levelId: 'FRAGILE',
    launcher: { x: 360, y: 1180 },
    ballCount: 5,
    blocks: [
      { id: 'TARGET', x: 340, y: 300, width: 70, height: 56, value: 1, active: true },
      { id: 'SHADOW', x: 34, y: 220, width: 70, height: 56, value: 20, active: true },
    ],
  });

  // Shoot straight up to destroy TARGET
  const result = simulateTurn(state, 90, { record: false });
  const destroyed = result.finalBlocks.find((b) => b.id === 'TARGET');
  assert.equal(destroyed?.active, false, 'TARGET block should be destroyed');

  const nextState = applyTurnResult(state, result);
  const inNextState = nextState.blocks.some((b) => b.id === 'TARGET');
  assert.equal(inNextState, false, 'destroyed block must not exist in descended active blocks');
});

test('3: generated top row is deterministic', () => {
  const stateA = createGameState(LEVELS.L01);
  const stateB = createGameState(LEVELS.L01);

  const rowA1 = generateTopRow(stateA);
  const rowA2 = generateTopRow(stateA);
  const rowB1 = generateTopRow(stateB);

  assert.deepEqual(rowA1, rowA2, 'generating top row multiple times on same state must yield identical blocks');
  assert.deepEqual(rowA1, rowB1, 'generating top row on identical states must produce identical blocks');
  assert.ok(rowA1.length >= 5, 'generated row must have substantial block density');
  for (const b of rowA1) {
    assert.equal(b.y, stateA.rowOriginY, 'generated block must spawn at state.rowOriginY');
    assert.ok(b.value >= 1, 'generated block must have positive HP');
    assert.equal(b.active, true, 'generated block must be active');
  }
});

test('4: same state + same angle produces identical full next GameState', () => {
  const stateA = createGameState(LEVELS.L02);
  const stateB = createGameState(LEVELS.L02);
  const angle = 47.3;

  const resA = simulateTurn(stateA, angle, { record: false });
  const resB = simulateTurn(stateB, angle, { record: false });

  const nextA = applyTurnResult(stateA, resA);
  const nextB = applyTurnResult(stateB, resB);

  assert.deepEqual(nextA, nextB, 'committed turns must produce identical full next GameState');
});

test('5: first-exit launcher X survives into next state', () => {
  const state = createGameState(LEVELS.L01);
  const angle = 45.0;
  const result = simulateTurn(state, angle, { record: false });
  const nextState = applyTurnResult(state, result);

  assert.notEqual(result.firstExitX, null, 'first exit X must be recorded');
  assert.equal(nextState.launcher.x, clampLauncherX(result.firstExitX), 'next launcher X must equal clamped first exit');
  assert.equal(nextState.launcher.y, state.launcher.y, 'launcher Y baseline must never change');
});

test('6: preview next state == gameplay next state', () => {
  const state = createGameState(LEVELS.L03);
  const angle = 58.5;

  const preview = previewFuture(state, angle, { record: false });
  const liveResult = simulateTurn(state, angle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);

  assert.deepEqual(preview.nextGameState, liveNextState, 'FuturePreview nextGameState must match gameplay next state');
  assert.equal(preview.isGameOver, liveNextState.isGameOver, 'FuturePreview isGameOver must match gameplay next state');
});

test('7: solver replay next state == gameplay next state', () => {
  const state = createGameState(LEVELS.L01);
  const solution = solve(state, { step: 10, objective: 'destruction', includeRobustness: false });
  const bestAngle = solution.best.angleDeg;

  const liveResult = simulateTurn(state, bestAngle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);

  assert.deepEqual(solution.best.nextGameState, liveNextState, 'Solver candidate nextGameState must match gameplay replay');
  assert.equal(solution.best.isGameOver, liveNextState.isGameOver, 'Solver candidate isGameOver must match gameplay');
});

test('8: serialize -> load preserves future row generation', () => {
  const state = createGameState(LEVELS.L01);
  const res1 = simulateTurn(state, 50, { record: false });
  const turn2State = applyTurnResult(state, res1);

  const serialized = serializeGameState(turn2State);
  const loaded = deserializeGameState(serialized);

  assert.deepEqual(turn2State, loaded, 'deserialized state must match canonical state');

  const rowTurn3FromOrig = generateTopRow(turn2State);
  const rowTurn3FromLoaded = generateTopRow(loaded);

  assert.deepEqual(rowTurn3FromOrig, rowTurn3FromLoaded, 'serialize round trip must preserve future row generation');
});

test('9: unique block IDs remain stable after generation', () => {
  let state = createGameState(LEVELS.L01);
  const allEncounteredIds = new Set();

  for (const b of state.blocks) {
    assert.ok(!allEncounteredIds.has(b.id), `initial block ID ${b.id} must be unique`);
    allEncounteredIds.add(b.id);
  }

  // Progress through 3 volleys
  for (let turn = 1; turn <= 3; turn += 1) {
    const res = simulateTurn(state, 50 + turn * 5, { record: false });
    state = applyTurnResult(state, res);

    const turnIds = new Set();
    for (const b of state.blocks) {
      assert.ok(!turnIds.has(b.id), `turn ${turn}: duplicate block ID ${b.id} on board`);
      turnIds.add(b.id);
    }
  }
});

test('10: failure triggers deterministically at danger line', () => {
  // Construct a state where a block is 1 step above the danger line
  // dangerLineY = 1060, height = 56.
  // If y = 1060 - 68 = 992, bottom is 992 + 56 = 1048 < 1060 (safe).
  // After 1 descent: y = 992 + 68 = 1060, bottom is 1060 + 56 = 1116 >= 1060 (failed).
  const state = createGameState({
    levelId: 'NEAR-DANGER',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'CRITICAL', x: 200, y: PROGRESSION_CONFIG.dangerLineY - PROGRESSION_CONFIG.rowStep, width: 70, height: 56, value: 50, active: true },
    ],
  });

  assert.equal(checkDangerLineFailure(state.blocks, PROGRESSION_CONFIG.dangerLineY), false, 'initially above danger line');

  // Shot that misses the critical block
  const result = simulateTurn(state, 15, { record: false });
  const nextState = applyTurnResult(state, result);

  assert.equal(nextState.isGameOver, true, 'isGameOver must trigger when block crosses danger line');
  assert.equal(checkDangerLineFailure(nextState.blocks, PROGRESSION_CONFIG.dangerLineY), true);
});

test('11: no failure when blocks remain above danger line', () => {
  const state = createGameState({
    levelId: 'SAFE',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [
      { id: 'HIGH', x: 200, y: 300, width: 70, height: 56, value: 10, active: true },
    ],
  });

  const result = simulateTurn(state, 45, { record: false });
  const nextState = applyTurnResult(state, result);

  assert.equal(nextState.isGameOver, false, 'must not trigger game over while blocks are above danger line');
});

test('12: full 1°–179° aiming still works after progression', () => {
  let state = createGameState(LEVELS.L01);
  const result = simulateTurn(state, 60, { record: false });
  state = applyTurnResult(state, result);

  const testAngles = [INPUT_CONFIG.angleMin, 15, 45, 90, 135, 165, INPUT_CONFIG.angleMax];
  for (const angle of testAngles) {
    const res = simulateTurn(state, angle, { record: false });
    assert.ok(res.elapsedTime > 0, `angle ${angle} must simulate successfully on progressed state`);
    const next = applyTurnResult(state, res);
    assert.equal(next.turn, state.turn + 1, 'progression on next turn must advance');
  }
});

test('13: turn increments exactly once per volley', () => {
  let state = createGameState(LEVELS.L01);
  assert.equal(state.turn, 1, 'initial turn is 1');

  const res1 = simulateTurn(state, 45, { record: false });
  state = applyTurnResult(state, res1);
  assert.equal(state.turn, 2, 'first volley advances turn to 2');

  const res2 = simulateTurn(state, 55, { record: false });
  state = applyTurnResult(state, res2);
  assert.equal(state.turn, 3, 'second volley advances turn to 3');
});

test('14: new row is generated exactly once per completed volley', () => {
  const state = createGameState(LEVELS.L01);
  assert.equal(state.nextRowIndex, 1, 'initial nextRowIndex is 1');

  const res = simulateTurn(state, 45, { record: false });
  const nextState = applyTurnResult(state, res);

  assert.equal(nextState.nextRowIndex, 2, 'nextRowIndex must advance by 1');

  const survivingLevelBlocks = res.finalBlocks.filter((b) => b.active && b.value > 0).length;
  const newRowBlocks = nextState.blocks.filter((b) => b.id.startsWith('gen_r1_'));

  assert.ok(newRowBlocks.length > 0, 'new row must contain generated blocks with gen_r1_ prefix');
  assert.equal(
    nextState.blocks.length,
    survivingLevelBlocks + newRowBlocks.length,
    'total blocks must equal surviving blocks plus newly generated row blocks'
  );
});

test('15: L01 generated row appears at its canonical row origin (250)', () => {
  const state = createGameState(LEVELS.L01);
  assert.equal(state.rowOriginY, 250, 'L01 state.rowOriginY must be 250');
  const newRow = generateTopRow(state);
  assert.ok(newRow.length > 0, 'new row must contain blocks');
  for (const b of newRow) {
    assert.equal(b.y, 250, 'L01 generated blocks must have y = 250');
  }
});

test('16: L02 generated row appears at its canonical row origin (235)', () => {
  const state = createGameState(LEVELS.L02);
  assert.equal(state.rowOriginY, 235, 'L02 state.rowOriginY must be 235');
  const newRow = generateTopRow(state);
  assert.ok(newRow.length > 0, 'new row must contain blocks');
  for (const b of newRow) {
    assert.equal(b.y, 235, 'L02 generated blocks must have y = 235');
  }
});

test('17: L03 generated row appears at its canonical row origin (220)', () => {
  const state = createGameState(LEVELS.L03);
  assert.equal(state.rowOriginY, 220, 'L03 state.rowOriginY must be 220');
  const newRow = generateTopRow(state);
  assert.ok(newRow.length > 0, 'new row must contain blocks');
  for (const b of newRow) {
    assert.equal(b.y, 220, 'L03 generated blocks must have y = 220');
  }
});

test('18: generated row to next descended row spacing is exactly one ROW_STEP grid interval where rows are adjacent', () => {
  const state = createGameState(LEVELS.L01);
  // Initial rows for L01: A at 250, B at 318, C at 386
  const simResult = simulateTurn(state, 45, { record: false });
  const nextState = applyTurnResult(state, simResult);

  const genBlocks = nextState.blocks.filter((b) => b.id.startsWith('gen_r1_'));
  const descendedA = nextState.blocks.filter((b) => b.id.startsWith('A') && b.active);

  assert.ok(genBlocks.length > 0, 'generated row must exist');
  assert.ok(descendedA.length > 0, 'descended former top row blocks must exist');

  const genY = genBlocks[0].y;
  const descY = descendedA[0].y;

  assert.equal(genY, 250, 'generated row must be at rowOriginY (250)');
  assert.equal(descY, 318, 'descended former top row must be at 250 + ROW_STEP = 318');
  assert.equal(
    descY - genY,
    PROGRESSION_CONFIG.rowStep,
    `spacing between generated row and descended row must be exactly ROW_STEP (${PROGRESSION_CONFIG.rowStep})`
  );
});

test('19: row origin remains stable even if original top row was completely destroyed', () => {
  const state = createGameState(LEVELS.L01);
  // Simulate complete destruction of top row A
  const blocksWithoutRowA = state.blocks
    .filter((b) => !b.id.startsWith('A'))
    .map((b) => ({ ...b }));

  const simulatedResult = {
    stats: { hits: 10, destroyed: 8, ballsExited: state.balls.available },
    finalBlocks: blocksWithoutRowA,
    firstExitX: 360,
    score: 100,
  };

  const nextState = applyTurnResult(state, simulatedResult);
  assert.equal(nextState.rowOriginY, 250, 'rowOriginY must remain 250 even if top row was destroyed');

  const generatedRow = generateTopRow(nextState);
  for (const b of generatedRow) {
    assert.equal(b.y, 250, 'generated blocks must remain at canonical rowOriginY');
  }
});

test('20: serialize -> load preserves the same row grid', () => {
  const state = createGameState(LEVELS.L01);
  const serialized = serializeGameState(state);
  const loaded = deserializeGameState(serialized);

  assert.equal(loaded.rowOriginY, state.rowOriginY, 'deserialized state must preserve rowOriginY');

  const rowFromOriginal = generateTopRow(state);
  const rowFromLoaded = generateTopRow(loaded);

  assert.deepEqual(rowFromOriginal, rowFromLoaded, 'generated rows must be identical across serialization');
});

test('21: Preview, gameplay and Solver produce identical generated-row Y coordinates', () => {
  const state = createGameState(LEVELS.L04); // L04 rowOriginY: 230
  const angle = 50.0;

  const preview = previewFuture(state, angle, { record: false });
  const liveResult = simulateTurn(state, angle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);
  const solution = solve(state, { step: 10, objective: 'destruction', includeRobustness: false });
  const solverNextState = solution.best.nextGameState;

  const previewGenBlocks = preview.nextGameState.blocks.filter((b) => b.id.startsWith('gen_r1_'));
  const liveGenBlocks = liveNextState.blocks.filter((b) => b.id.startsWith('gen_r1_'));
  const solverGenBlocks = solverNextState.blocks.filter((b) => b.id.startsWith('gen_r1_'));

  assert.ok(previewGenBlocks.length > 0);
  assert.ok(liveGenBlocks.length > 0);
  assert.ok(solverGenBlocks.length > 0);

  for (const b of previewGenBlocks) {
    assert.equal(b.y, 230, 'Preview generated block must have canonical Y');
  }
  for (const b of liveGenBlocks) {
    assert.equal(b.y, 230, 'Live gameplay generated block must have canonical Y');
  }
  for (const b of solverGenBlocks) {
    assert.equal(b.y, 230, 'Solver generated block must have canonical Y');
  }

  assert.deepEqual(
    previewGenBlocks.map((b) => b.y),
    liveGenBlocks.map((b) => b.y),
    'Preview and gameplay must have identical generated-row Y'
  );
  assert.deepEqual(
    liveGenBlocks.map((b) => b.y),
    solverGenBlocks.map((b) => b.y),
    'Gameplay and Solver must have identical generated-row Y'
  );
});
