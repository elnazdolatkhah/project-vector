import { PROGRESSION_CONFIG, PHYSICS_CONFIG, columnX } from '../config.js';
import { clampLauncherX, validateGameState, canonicalizeGameState } from './gameState.js';

/**
 * Deterministic column patterns for top-row block placement (tooling / procedural fallback).
 * 8 canonical columns (0..7), providing tactical corridors and variation.
 */
export const ROW_PATTERNS = Object.freeze([
  [0, 1, 2, 4, 5, 6, 7], // Corridor at col 3
  [1, 2, 3, 4, 5, 6],    // Side flanks open (cols 0, 7)
  [0, 2, 3, 4, 5, 7],    // Corridors at cols 1, 6
  [0, 1, 3, 4, 6, 7],    // Corridors at cols 2, 5
  [0, 1, 2, 3, 5, 6, 7], // Corridor at col 4
  [0, 1, 2, 3, 4, 5, 7], // Corridor at col 6
  [0, 2, 3, 5, 6, 7],    // Corridors at cols 1, 4
  [1, 2, 4, 5, 6, 7],    // Corridors at cols 0, 3
]);

/**
 * Deterministic HP calculation for a generated block based on turn and position.
 * Used for procedural fallback / tooling.
 */
export function calculateBlockHP(turn, col, nextRowIndex) {
  const base = Math.max(1, turn * 2);
  const variance = (col * 3 + nextRowIndex * 5) % 4; // 0..3 variance
  return base + variance;
}

/**
 * Generates a deterministic top row of blocks based purely on GameState.
 * Procedural fallback for tooling and endless modes.
 */
export function generateTopRow(state) {
  const seed = Number.isInteger(state?.seed) ? state.seed : 1;
  const nextRowIndex = Number.isInteger(state?.nextRowIndex) ? state.nextRowIndex : 1;
  const turn = Number.isInteger(state?.turn) ? state.turn : 1;
  const rowOriginY = typeof state?.rowOriginY === 'number' && Number.isFinite(state.rowOriginY)
    ? state.rowOriginY
    : (PROGRESSION_CONFIG.defaultRowOriginY ?? PROGRESSION_CONFIG.topRowY);

  const patternIndex = Math.abs((seed * 17 + nextRowIndex * 13) % ROW_PATTERNS.length);
  const cols = ROW_PATTERNS[patternIndex];

  return cols.map((col) => {
    const id = `gen_r${nextRowIndex}_c${col}`;
    const x = columnX(col);
    const y = rowOriginY;
    const value = calculateBlockHP(turn, col, nextRowIndex);

    return {
      id,
      x,
      y,
      width: PROGRESSION_CONFIG.blockWidth,
      height: PROGRESSION_CONFIG.blockHeight,
      value,
      active: true,
    };
  });
}

/**
 * Generates deterministic +1 Ball pickups for the newly generated top row.
 * Cadence: defaults to state.pickupCadence or PROGRESSION_CONFIG.pickupSpawnCadence.
 * Used for procedural fallback / endless modes.
 */
export function generateTopRowPickups(state, { cadence = null } = {}) {
  const seed = Number.isInteger(state?.seed) ? state.seed : 1;
  const nextRowIndex = Number.isInteger(state?.nextRowIndex) ? state.nextRowIndex : 1;
  const effectiveCadence = cadence ?? state?.pickupCadence ?? PROGRESSION_CONFIG.pickupSpawnCadence ?? 3;

  if (effectiveCadence <= 0 || nextRowIndex % effectiveCadence !== 0) {
    return [];
  }

  const rowOriginY = typeof state?.rowOriginY === 'number' && Number.isFinite(state.rowOriginY)
    ? state.rowOriginY
    : (PROGRESSION_CONFIG.defaultRowOriginY ?? PROGRESSION_CONFIG.topRowY);

  const patternIndex = Math.abs((seed * 17 + nextRowIndex * 13) % ROW_PATTERNS.length);
  const blockCols = ROW_PATTERNS[patternIndex];
  const emptyCols = [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !blockCols.includes(c));

  const chosenCol = emptyCols.length > 0
    ? emptyCols[Math.abs((seed * 31 + nextRowIndex * 7) % emptyCols.length)]
    : (nextRowIndex % 8);

  const id = `pickup_r${nextRowIndex}_c${chosenCol}`;
  const x = columnX(chosenCol) + PROGRESSION_CONFIG.blockWidth / 2;
  const y = rowOriginY + PROGRESSION_CONFIG.blockHeight / 2;
  const radius = PROGRESSION_CONFIG.pickupRadius ?? 14;

  return [
    {
      id,
      x,
      y,
      radius,
      active: true,
    },
  ];
}

/**
 * Evaluates whether any active block has reached or crossed the danger line.
 * Rule: block.y + block.height >= dangerLineY for any active block with value > 0.
 */
export function checkDangerLineFailure(blocks, dangerLineY = PROGRESSION_CONFIG.dangerLineY) {
  if (!Array.isArray(blocks)) return false;
  for (const block of blocks) {
    if (block.active && block.value > 0) {
      const bottom = block.y + block.height;
      if (bottom >= dangerLineY) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Internal derived metric:
 * dangerMargin = dangerLineY - max(activeBlockBottomY)
 * Tooling/solver metric distinguishing futures that deal similar damage but leave different board pressure.
 */
export function computeDangerMargin(gameState, dangerLineY = PROGRESSION_CONFIG.dangerLineY) {
  if (!gameState || !Array.isArray(gameState.blocks)) return dangerLineY;
  const activeBlocks = gameState.blocks.filter((b) => b.active && b.value > 0);
  if (activeBlocks.length === 0) {
    return dangerLineY;
  }
  const maxBottom = Math.max(...activeBlocks.map((b) => b.y + b.height));
  return Math.round((dangerLineY - maxBottom) * 1e6) / 1e6;
}

/**
 * Canonical state transition function for committed turns.
 * 
 * Pipeline:
 * 1. Filter surviving blocks (destroyed blocks do not descend).
 * 2. Next launcher X determined from first bottom exit.
 * 3. Surviving blocks descend by exactly one ROW_STEP (68 units).
 * 4. Deterministic new row: consumes authored wave if defined on state, otherwise procedural fallback.
 * 5. Danger line failure evaluation (block.y + block.height >= DANGER_LINE_Y).
 * 6. Pickup progression: collected pickups increase balls.available for subsequent turns;
 *    uncollected pickups descend; new top-row pickups generated deterministically from authored wave / cadence.
 * 7. Turn increment and score accumulation.
 * 8. Canonical validation and state serialization.
 */
export function applyTurnResult(state, simulationResult) {
  if (state.stageStatus !== 'active' || simulationResult?.timedOut || simulationResult?.completed === false) {
    // Terminal state or timed-out simulation cannot progress board
    return canonicalizeGameState(state);
  }

  const nextLauncherX = simulationResult?.nextLauncher?.x ??
    (simulationResult?.firstExitX != null ? clampLauncherX(simulationResult.firstExitX) : state.launcher.x);

  const finalBlocks = simulationResult?.finalBlocks || state.blocks;

  // 1 & 2: Only surviving active blocks descend
  const surviving = finalBlocks.filter((b) => b.active && b.value > 0);
  const descendedBlocks = surviving.map((b) => ({
    ...b,
    y: Math.round((b.y + PROGRESSION_CONFIG.rowStep) * 1e6) / 1e6,
  }));

  // Finite wave progression check
  const totalWaves = Number.isInteger(state.totalWaves)
    ? state.totalWaves
    : (Array.isArray(state.waves) ? state.waves.length : (PROGRESSION_CONFIG.defaultTotalWaves ?? 3));
  const currentWaveIndex = Number.isInteger(state.waveIndex) ? state.waveIndex : 0;
  const wavesRemaining = Math.max(0, totalWaves - currentWaveIndex);

  let newRow = [];
  let newPickups = [];
  let nextWaveIndex = currentWaveIndex;
  let nextRowIndex = state.nextRowIndex ?? 1;

  const rowOriginY = typeof state?.rowOriginY === 'number' && Number.isFinite(state.rowOriginY)
    ? state.rowOriginY
    : (PROGRESSION_CONFIG.defaultRowOriginY ?? PROGRESSION_CONFIG.topRowY);

  if (wavesRemaining > 0) {
    if (Array.isArray(state.waves)) {
      // Primary campaign path: deterministic authored wave
      const waveSpec = state.waves[currentWaveIndex];
      if (waveSpec) {
        newRow = (waveSpec.blocks || []).map((b) => ({
          id: b.id ?? `gen_r${nextRowIndex}_c${b.col}`,
          x: columnX(b.col) + (b.offset ?? 0),
          y: rowOriginY,
          width: PROGRESSION_CONFIG.blockWidth,
          height: PROGRESSION_CONFIG.blockHeight,
          value: b.hp,
          active: true,
        }));

        if (typeof waveSpec.pickupCol === 'number' && Number.isInteger(waveSpec.pickupCol)) {
          newPickups = [
            {
              id: `pickup_r${nextRowIndex}_c${waveSpec.pickupCol}`,
              x: columnX(waveSpec.pickupCol) + PROGRESSION_CONFIG.blockWidth / 2,
              y: rowOriginY + PROGRESSION_CONFIG.blockHeight / 2,
              radius: PROGRESSION_CONFIG.pickupRadius ?? 14,
              active: true,
            },
          ];
        }
      }
      nextWaveIndex = currentWaveIndex + 1;
      nextRowIndex += 1;
    } else {
      // Procedural fallback for tooling / endless mode
      newRow = generateTopRow(state);
      newPickups = generateTopRowPickups(state);
      nextWaveIndex = currentWaveIndex + 1;
      nextRowIndex += 1;
    }
  }

  // 4: Combined board blocks
  const nextBlocks = [...descendedBlocks, ...newRow];

  // 5: Check danger line failure condition
  const breachedDanger = checkDangerLineFailure(nextBlocks, PROGRESSION_CONFIG.dangerLineY);

  // 6: Pickups & ball count progression
  const collectedPickupIds = new Set(simulationResult?.collectedPickups || []);
  const acquiredCount = simulationResult?.ballPickupsCollected ?? collectedPickupIds.size;

  const currentPickups = Array.isArray(state.pickups) ? state.pickups : [];
  const survivingPickups = currentPickups.filter((p) => p.active && !collectedPickupIds.has(p.id));
  const descendedPickups = survivingPickups
    .map((p) => ({
      ...p,
      y: Math.round((p.y + PROGRESSION_CONFIG.rowStep) * 1e6) / 1e6,
    }))
    .filter((p) => p.y < PROGRESSION_CONFIG.dangerLineY);

  const nextPickups = [...descendedPickups, ...newPickups];

  // 7: Determine authoritative stage status
  let stageStatus = 'active';
  if (breachedDanger) {
    stageStatus = 'failed';
  } else {
    const activeBlocksCount = nextBlocks.filter((b) => b.active && b.value > 0).length;
    if (nextWaveIndex >= totalWaves && activeBlocksCount === 0) {
      stageStatus = 'won';
    }
  }

  const isGameOver = stageStatus === 'failed';
  const nextTurn = state.turn + 1;
  const nextScore = state.score + (simulationResult?.score || 0);
  const nextBallsAvailable = state.balls.available + acquiredCount;

  const nextState = {
    ...state,
    stageStatus,
    turn: nextTurn,
    waveIndex: nextWaveIndex,
    totalWaves,
    nextRowIndex,
    score: nextScore,
    balls: {
      available: nextBallsAvailable,
    },
    blocks: nextBlocks,
    pickups: nextPickups,
    launcher: {
      x: nextLauncherX,
      y: state.launcher.y,
    },
    ...(Array.isArray(state.waves) ? { waves: state.waves } : {}),
    isGameOver,
  };

  const validation = validateGameState(nextState);
  if (!validation.ok) {
    throw new Error(`Invalid transitioned GameState: ${validation.errors.join('; ')}`);
  }

  return canonicalizeGameState(nextState);
}
