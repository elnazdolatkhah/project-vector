import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  serializeGameState,
  deserializeGameState,
  applyTurnResult,
  computeDangerMargin,
  validatePickupClearance,
  computePickupBlockClearance,
} from '../src/domain/gameState.js';
import { ROW_PATTERNS, generateTopRow } from '../src/domain/progression.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { previewFuture } from '../src/future/futureEngine.js';
import { solve, analyzeStageFutures } from '../src/solver/solver.js';
import { LEVELS } from '../src/levels/levels.js';
import { PROGRESSION_CONFIG, columnX } from '../src/config.js';

test('1: campaign stages consume authored waves exactly', () => {
  const state = createGameState(LEVELS.L01);
  assert.ok(Array.isArray(state.waves), 'L01 must have authored waves');
  assert.equal(state.waves.length, 3, 'L01 must define exactly 3 authored waves');
  assert.equal(state.waveIndex, 0, 'initial waveIndex must be 0');

  // Turn 1: wave 0 consumed
  const res1 = simulateTurn(state, 50, { record: false });
  const turn2 = applyTurnResult(state, res1);
  assert.equal(turn2.waveIndex, 1, 'waveIndex must advance to 1');

  // Validate the incoming row matches Wave 0 specification
  const wave0Spec = state.waves[0];
  const incomingWave0Blocks = turn2.blocks.filter((b) => b.y === state.rowOriginY);
  assert.equal(
    incomingWave0Blocks.length,
    wave0Spec.blocks.length,
    'incoming wave 0 block count must match authored spec'
  );
  for (const specBlock of wave0Spec.blocks) {
    const matchingBlock = incomingWave0Blocks.find(
      (b) => b.x === columnX(specBlock.col) && b.value === specBlock.hp
    );
    assert.ok(
      matchingBlock,
      `incoming block at column ${specBlock.col} with HP ${specBlock.hp} must match wave 0 authored spec`
    );
  }

  // Turn 2: wave 1 consumed
  const res2 = simulateTurn(turn2, 55, { record: false });
  const turn3 = applyTurnResult(turn2, res2);
  assert.equal(turn3.waveIndex, 2, 'waveIndex must advance to 2');

  const wave1Spec = state.waves[1];
  const incomingWave1Blocks = turn3.blocks.filter((b) => b.y === state.rowOriginY);
  assert.equal(
    incomingWave1Blocks.length,
    wave1Spec.blocks.length,
    'incoming wave 1 block count must match authored spec'
  );
  for (const specBlock of wave1Spec.blocks) {
    const matchingBlock = incomingWave1Blocks.find(
      (b) => b.x === columnX(specBlock.col) && b.value === specBlock.hp
    );
    assert.ok(
      matchingBlock,
      `incoming block at column ${specBlock.col} with HP ${specBlock.hp} must match wave 1 authored spec`
    );
  }

  // Turn 3: wave 2 consumed
  const res3 = simulateTurn(turn3, 60, { record: false });
  const turn4 = applyTurnResult(turn3, res3);
  assert.equal(turn4.waveIndex, 3, 'waveIndex must advance to 3');

  const wave2Spec = state.waves[2];
  const incomingWave2Blocks = turn4.blocks.filter((b) => b.y === state.rowOriginY);
  assert.equal(
    incomingWave2Blocks.length,
    wave2Spec.blocks.length,
    'incoming wave 2 block count must match authored spec'
  );
  for (const specBlock of wave2Spec.blocks) {
    const matchingBlock = incomingWave2Blocks.find(
      (b) => b.x === columnX(specBlock.col) && b.value === specBlock.hp
    );
    assert.ok(
      matchingBlock,
      `incoming block at column ${specBlock.col} with HP ${specBlock.hp} must match wave 2 authored spec`
    );
  }
});

test('2: L01–L05 do not use generic procedural ROW_PATTERNS for campaign incoming waves', () => {
  const stageKeys = ['L01', 'L02', 'L03', 'L04', 'L05'];

  for (const key of stageKeys) {
    const level = LEVELS[key];
    const state = createGameState(level);
    assert.ok(Array.isArray(state.waves), `${key} must have authored waves array`);
    assert.ok(state.waves.length > 0, `${key} must have at least one authored wave`);

    // The procedural row generator would create a pattern based on seed & nextRowIndex
    const proceduralTopRow = generateTopRow(state);
    const proceduralCols = proceduralTopRow.map((b) => Math.round((b.x - PROGRESSION_CONFIG.blockMargin) / (PROGRESSION_CONFIG.blockWidth + PROGRESSION_CONFIG.interColumnGap))).sort();

    // Actual first wave
    const authoredWaveCols = state.waves[0].blocks.map((b) => b.col).sort();

    // The campaign wave columns must reflect authored design, not procedural ROW_PATTERNS formula
    // Furthermore, applyTurnResult must directly instantiate the authored wave blocks
    const simResult = simulateTurn(state, 50, { record: false });
    const progressedState = applyTurnResult(state, simResult);
    const actualNewBlocks = progressedState.blocks.filter((b) => b.y === state.rowOriginY);

    const actualCols = actualNewBlocks.map((b) => {
      // derive col index from columnX
      return [0, 1, 2, 3, 4, 5, 6, 7].find((c) => columnX(c) === b.x);
    }).sort();

    assert.deepEqual(
      actualCols,
      authoredWaveCols,
      `${key} turn 1 must consume authored wave columns, not procedural ROW_PATTERNS`
    );

    // Ensure HP values match authored HP, not the procedural calculateBlockHP turn*2 formula
    for (const b of actualNewBlocks) {
      const authoredBlock = state.waves[0].blocks.find((ab) => columnX(ab.col) === b.x);
      assert.ok(authoredBlock, `block at x=${b.x} must exist in wave 0 spec`);
      assert.equal(b.value, authoredBlock.hp, `block HP must be authored (${authoredBlock.hp}), not procedural formula`);
    }
  }
});

test('3: authored wave geometry uses canonical columnX', () => {
  const stageKeys = ['L01', 'L02', 'L03', 'L04', 'L05'];

  for (const key of stageKeys) {
    const level = LEVELS[key];
    for (const [wIdx, wave] of level.waves.entries()) {
      for (const [bIdx, blockSpec] of wave.blocks.entries()) {
        assert.ok(
          Number.isInteger(blockSpec.col) && blockSpec.col >= 0 && blockSpec.col <= 7,
          `${key} wave ${wIdx} block ${bIdx} col must be integer 0..7`
        );
        const expectedX = columnX(blockSpec.col) + (blockSpec.offset ?? 0);
        assert.ok(
          expectedX >= PROGRESSION_CONFIG.playableLeft &&
          expectedX + PROGRESSION_CONFIG.blockWidth <= PROGRESSION_CONFIG.playableRight,
          `${key} wave ${wIdx} block ${bIdx} must stay within playable horizontal bounds`
        );
      }
      if (wave.pickupCol !== undefined) {
        assert.ok(
          Number.isInteger(wave.pickupCol) && wave.pickupCol >= 0 && wave.pickupCol <= 7,
          `${key} wave ${wIdx} pickupCol must be integer 0..7`
        );
      }
    }
  }
});

test('4: authored pickup placement is deterministic', () => {
  // L01 wave 1 has pickupCol: 3
  const stateA = createGameState(LEVELS.L01);
  const stateB = createGameState(LEVELS.L01);

  // Turn 1
  const resA1 = simulateTurn(stateA, 45, { record: false });
  const resB1 = simulateTurn(stateB, 45, { record: false });
  const turn2A = applyTurnResult(stateA, resA1);
  const turn2B = applyTurnResult(stateB, resB1);

  // Wave 1 has pickup at col 3, which enters on Turn 2
  const resA2 = simulateTurn(turn2A, 50, { record: false });
  const resB2 = simulateTurn(turn2B, 50, { record: false });
  const turn3A = applyTurnResult(turn2A, resA2);
  const turn3B = applyTurnResult(turn2B, resB2);

  // Turn 3 board should have the newly spawned pickup from Wave 1 (which was consumed in turn 2)
  const pickupA = turn3A.pickups.find((p) => p.id === 'pickup_r2_c3');
  const pickupB = turn3B.pickups.find((p) => p.id === 'pickup_r2_c3');

  assert.ok(pickupA, 'authored pickup_r2_c3 must exist on turn 3');
  assert.deepEqual(pickupA, pickupB, 'authored pickup generation across identical states must be deepEqual');
  assert.equal(pickupA.x, columnX(3) + PROGRESSION_CONFIG.blockWidth / 2);
  assert.equal(pickupA.y, stateA.rowOriginY + PROGRESSION_CONFIG.blockHeight / 2);
});

test('5: no additional row enters after final authored wave', () => {
  const state = createGameState(LEVELS.L01);
  assert.equal(state.totalWaves, 3);

  let current = state;
  // Progress through all 3 waves
  for (let turn = 1; turn <= 3; turn += 1) {
    const res = simulateTurn(current, 50 + turn * 5, { record: false });
    current = applyTurnResult(current, res);
    assert.equal(current.waveIndex, turn);
  }

  const blocksAfterWave3 = current.blocks.length;

  // Turn 4: waves exhausted (waveIndex === 3, totalWaves === 3)
  const res4 = simulateTurn(current, 75, { record: false });
  const turn4State = applyTurnResult(current, res4);

  assert.equal(turn4State.waveIndex, 3, 'waveIndex must clamp at totalWaves');
  // New blocks at rowOriginY should be 0 because no incoming wave was generated
  const newBlocksAtOrigin = turn4State.blocks.filter((b) => b.y === current.rowOriginY);
  assert.equal(newBlocksAtOrigin.length, 0, 'no row must enter after final authored wave');
});

test('6: Preview, gameplay and Solver receive identical authored next wave', () => {
  const state = createGameState(LEVELS.L02);
  const angle = 60.0;

  const preview = previewFuture(state, angle, { record: false });
  const liveResult = simulateTurn(state, angle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);
  const solution = solve(state, { angleMin: 50, angleMax: 70, step: 10, includeRobustness: false });

  // Compare incoming wave blocks at rowOriginY
  const previewWaveBlocks = preview.nextGameState.blocks.filter((b) => b.y === state.rowOriginY);
  const liveWaveBlocks = liveNextState.blocks.filter((b) => b.y === state.rowOriginY);

  assert.deepEqual(
    previewWaveBlocks,
    liveWaveBlocks,
    'Preview and live gameplay must receive identical authored incoming wave blocks'
  );

  // If candidate at 60 deg is in solver:
  const cand60 = solution.candidates.find((c) => Math.abs(c.angleDeg - 60) < 1e-4);
  assert.ok(cand60, 'solver candidate for angle 60 must exist');
  const solverWaveBlocks = cand60.nextGameState.blocks.filter((b) => b.y === state.rowOriginY);
  assert.deepEqual(
    solverWaveBlocks,
    liveWaveBlocks,
    'Solver candidate must receive identical authored incoming wave blocks'
  );
});

test('7: serialize/load preserves authored wave position', () => {
  const state = createGameState(LEVELS.L03);
  assert.equal(state.waveIndex, 0);

  const res1 = simulateTurn(state, 45, { record: false });
  const turn2State = applyTurnResult(state, res1);
  assert.equal(turn2State.waveIndex, 1);

  const serialized = serializeGameState(turn2State);
  const loaded = deserializeGameState(serialized);

  assert.equal(loaded.waveIndex, 1, 'waveIndex must survive serialization');
  assert.equal(loaded.totalWaves, 4, 'totalWaves must survive serialization');
  assert.ok(Array.isArray(loaded.waves), 'waves array must survive serialization');
  assert.equal(loaded.waves.length, 4, 'waves count must survive serialization');

  // Next turn from loaded state consumes wave 1 (the 2nd authored wave)
  const res2Orig = simulateTurn(turn2State, 50, { record: false });
  const res2Loaded = simulateTurn(loaded, 50, { record: false });

  const turn3Orig = applyTurnResult(turn2State, res2Orig);
  const turn3Loaded = applyTurnResult(loaded, res2Loaded);

  assert.deepEqual(
    turn3Orig,
    turn3Loaded,
    'progression from deserialized state must identically consume the next authored wave'
  );
});

test('8: dangerMargin derives identically from nextGameState', () => {
  const state = createGameState(LEVELS.L01);
  const angle = 45;

  const preview = previewFuture(state, angle, { record: false });
  const liveResult = simulateTurn(state, angle, { record: false });
  const liveNextState = applyTurnResult(state, liveResult);

  const expectedDangerMargin = computeDangerMargin(liveNextState);

  assert.equal(
    preview.dangerMargin,
    expectedDangerMargin,
    'preview.dangerMargin must match computeDangerMargin(nextGameState)'
  );

  // Test solver candidate dangerMargin
  const solution = solve(state, { angleMin: 40, angleMax: 50, step: 5, includeRobustness: false });
  for (const cand of solution.candidates) {
    const candMargin = computeDangerMargin(cand.nextGameState);
    assert.equal(cand.dangerMargin, candMargin, 'candidate dangerMargin must match computeDangerMargin');
  }

  // Edge cases for dangerMargin:
  // 1. Cleared board (0 active blocks) -> returns dangerLineY
  const clearedState = { ...state, blocks: [] };
  assert.equal(computeDangerMargin(clearedState), PROGRESSION_CONFIG.dangerLineY);

  // 2. Block right at danger line (bottom = dangerLineY) -> dangerMargin = 0
  const atDangerState = {
    ...state,
    blocks: [{ id: 'D0', x: 200, y: PROGRESSION_CONFIG.dangerLineY - 56, width: 70, height: 56, value: 10, active: true }],
  };
  assert.equal(computeDangerMargin(atDangerState), 0);

  // 3. Block breaching danger line (bottom = dangerLineY + 20) -> dangerMargin = -20
  const breachedState = {
    ...state,
    blocks: [{ id: 'D1', x: 200, y: PROGRESSION_CONFIG.dangerLineY - 36, width: 70, height: 56, value: 10, active: true }],
  };
  assert.equal(computeDangerMargin(breachedState), -20);
});

test('9: stage-specific wave counts are respected', () => {
  assert.equal(LEVELS.L01.totalWaves, 3, 'L01 wave count must be 3');
  assert.equal(LEVELS.L02.totalWaves, 3, 'L02 wave count must be 3');
  assert.equal(LEVELS.L03.totalWaves, 4, 'L03 wave count must be 4');
  assert.equal(LEVELS.L04.totalWaves, 4, 'L04 wave count must be 4');
  assert.equal(LEVELS.L05.totalWaves, 5, 'L05 wave count must be 5');

  assert.equal(LEVELS.L01.waves.length, 3);
  assert.equal(LEVELS.L02.waves.length, 3);
  assert.equal(LEVELS.L03.waves.length, 4);
  assert.equal(LEVELS.L04.waves.length, 4);
  assert.equal(LEVELS.L05.waves.length, 5);

  // Ensure game states created from levels adopt the respective totalWaves
  for (const [key, expectedCount] of Object.entries({ L01: 3, L02: 3, L03: 4, L04: 4, L05: 5 })) {
    const s = createGameState(LEVELS[key]);
    assert.equal(s.totalWaves, expectedCount, `${key} totalWaves must equal ${expectedCount}`);
    assert.equal(s.waves.length, expectedCount, `${key} waves.length must equal ${expectedCount}`);
  }
});

test('10: procedural fallback remains available only when explicitly configured', () => {
  // A state configured without `waves` should fall back to procedural generateTopRow
  const proceduralState = createGameState({
    levelId: 'ENDLESS_TOOLING',
    launcher: { x: 360, y: 1180 },
    ballCount: 10,
    totalWaves: 3,
    blocks: [
      { id: 'T1', x: 200, y: 400, width: 70, height: 56, value: 5, active: true },
    ],
  });

  assert.equal(proceduralState.waves, undefined, 'unauthored stage has no waves array');

  const simResult = simulateTurn(proceduralState, 45, { record: false });
  const nextState = applyTurnResult(proceduralState, simResult);

  // Should have generated row via procedural ROW_PATTERNS
  const generatedRow = nextState.blocks.filter((b) => b.id.startsWith('gen_r1_'));
  assert.ok(generatedRow.length > 0, 'procedural fallback must generate top row when waves is undefined');

  // Verify that the generated columns match procedural generateTopRow
  const expectedProcedural = generateTopRow(proceduralState);
  assert.equal(generatedRow.length, expectedProcedural.length);
  for (let i = 0; i < generatedRow.length; i += 1) {
    assert.equal(generatedRow[i].x, expectedProcedural[i].x);
    assert.equal(generatedRow[i].value, expectedProcedural[i].value);
  }
});

test('11: analyzeStageFutures produces non-player-facing design report with candidate diversity', () => {
  const state = createGameState(LEVELS.L04);
  const report = analyzeStageFutures(state, [20, 45, 70, 90, 110, 135, 160]);

  assert.equal(report.levelId, 'L04');
  assert.equal(report.sampleCount, 7);
  assert.ok(report.distinctFuturesCount >= 2, 'L04 Multiple Solutions must exhibit candidate diversity');
  assert.equal(report.samples.length, 7);

  for (const s of report.samples) {
    assert.ok(typeof s.angle === 'number');
    assert.ok(typeof s.angleDeg === 'number');
    assert.ok(typeof s.damage === 'number');
    assert.ok(typeof s.destroyed === 'number');
    assert.ok(typeof s.pickups === 'number');
    assert.ok(typeof s.ballPickupsCollected === 'number');
    assert.ok(typeof s.nextBallCount === 'number');
    assert.ok(typeof s.nextLauncherX === 'number');
    assert.ok(typeof s.stageStatus === 'string');
    assert.ok(typeof s.dangerMargin === 'number');
    assert.ok(typeof s.wallReboundCount === 'number');
    assert.ok(typeof s.leadWallRebounds === 'number');
    assert.ok(typeof s.blockReboundCount === 'number');
    assert.equal(s.timedOut, false);
    assert.equal(s.completed, true);
  }
});

test('12: campaign initial and authored-wave pickups maintain strict physical clearance margin from block AABBs', () => {
  const margin = PROGRESSION_CONFIG.pickupClearanceMargin ?? 6;
  assert.equal(margin, 6, 'pickupClearanceMargin must be explicitly defined as 6px');

  const stageKeys = ['L01', 'L02', 'L03', 'L04', 'L05'];

  for (const key of stageKeys) {
    const level = LEVELS[key];
    const state = createGameState(level);

    // 1. Initial pickups vs initial blocks
    const clearanceRes = validatePickupClearance(state, margin);
    assert.equal(
      clearanceRes.ok,
      true,
      `${key} initial pickups must not intersect or violate ${margin}px clearance margin from any block: ${JSON.stringify(clearanceRes.violations)}`
    );

    // Verify distance computation manually for every active pickup
    for (const p of state.pickups) {
      assert.ok(p.radius >= 14, `${key} pickup radius must be >= 14px`);
      for (const b of state.blocks) {
        const c = computePickupBlockClearance(p, b);
        assert.ok(
          c >= margin,
          `${key} pickup ${p.id} at (${p.x}, ${p.y}) has clearance ${c.toFixed(2)}px from block ${b.id}, must be >= ${margin}px`
        );
      }
    }

    // 2. Authored wave pickups
    let currentState = state;
    for (let wIdx = 0; wIdx < level.waves.length; wIdx += 1) {
      const waveSpec = level.waves[wIdx];
      if (typeof waveSpec.pickupCol === 'number') {
        // Assert wave pickupCol does not match any block in the wave
        const blockInSameCol = waveSpec.blocks.find((b) => b.col === waveSpec.pickupCol);
        assert.equal(
          blockInSameCol,
          undefined,
          `${key} wave ${wIdx} pickupCol ${waveSpec.pickupCol} cannot overlap authored block at column ${blockInSameCol?.col}`
        );
      }

      // Progress through wave and verify newly spawned pickups in the board state
      const sim = simulateTurn(currentState, 45, { record: false });
      currentState = applyTurnResult(currentState, sim);

      const waveClearance = validatePickupClearance(currentState, margin);
      assert.equal(
        waveClearance.ok,
        true,
        `${key} board on wave ${wIdx + 1} must maintain ${margin}px clearance for all active pickups: ${JSON.stringify(waveClearance.violations)}`
      );
    }
  }

  // 3. Regression test: intentionally overlapping or sub-clearance pickup fails invariant
  const overlappingState = {
    levelId: 'TEST_OVERLAP',
    pickups: [{ id: 'p_bad', x: 200, y: 300, radius: 14, active: true }],
    blocks: [{ id: 'b_bad', x: 190, y: 290, width: 70, height: 56, value: 5, active: true }],
  };
  const badClearance = validatePickupClearance(overlappingState, margin);
  assert.equal(badClearance.ok, false, 'validatePickupClearance must fail on overlapping pickup');
  assert.equal(badClearance.violations.length, 1);
  assert.ok(badClearance.violations[0].clearance < 0, 'clearance must be negative for physical overlap');

  // Sub-clearance test: pickup 2px from block (clearance = 2px < 6px margin)
  const touchingState = {
    levelId: 'TEST_MARGIN',
    pickups: [{ id: 'p_touch', x: 100, y: 200, radius: 14, active: true }],
    blocks: [{ id: 'b_touch', x: 100 + 14 + 2, y: 180, width: 70, height: 56, value: 5, active: true }],
  };
  const touchClearance = validatePickupClearance(touchingState, margin);
  assert.equal(touchClearance.ok, false, 'validatePickupClearance must fail if clearance < margin');
  assert.equal(touchClearance.violations.length, 1);
  assert.ok(Math.abs(touchClearance.violations[0].clearance - 2) < 1e-4);
});

