import { PROGRESSION_CONFIG, PHYSICS_CONFIG, columnX } from '../config.js';
import { clampLauncherX, validateGameState, canonicalizeGameState } from './gameState.js';

/**
 * Deterministic column patterns for top-row block placement.
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
 * Produces integer HP >= 1 that scales predictably with turn progression.
 */
export function calculateBlockHP(turn, col, nextRowIndex) {
  const base = Math.max(1, turn * 2);
  const variance = (col * 3 + nextRowIndex * 5) % 4; // 0..3 variance
  return base + variance;
}

/**
 * Generates a deterministic top row of blocks based purely on GameState.
 * Guarantees stable unique IDs, deterministic HP, and canonical placement.
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
 * A pickup spawns when (nextRowIndex % effectiveCadence === 0).
 * Placed deterministically in an open corridor (empty column) of the generated row,
 * centered at (x, y) with unique ID 'pickup_r{nextRowIndex}_c{col}'.
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
 * Canonical state transition function for committed turns.
 * 
 * Pipeline:
 * 1. Filter surviving blocks (destroyed blocks do not descend).
 * 2. Next launcher X determined from first bottom exit.
 * 3. Surviving blocks descend by exactly one ROW_STEP (68 units).
 * 4. Deterministic new row generated at canonical rowOriginY.
 * 5. Danger line failure evaluation (block.y + block.height >= DANGER_LINE_Y).
 * 6. Pickup progression: collected pickups increase balls.available for subsequent turns;
 *    uncollected pickups descend; new top-row pickups generated deterministically.
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
    : (PROGRESSION_CONFIG.defaultTotalWaves ?? 3);
  const currentWaveIndex = Number.isInteger(state.waveIndex) ? state.waveIndex : 0;
  const wavesRemaining = Math.max(0, totalWaves - currentWaveIndex);

  let newRow = [];
  let newPickups = [];
  let nextWaveIndex = currentWaveIndex;
  let nextRowIndex = state.nextRowIndex ?? 1;

  if (wavesRemaining > 0) {
    // 3: Generate deterministic new top row of blocks for incoming wave
    newRow = generateTopRow(state);
    newPickups = generateTopRowPickups(state);
    nextWaveIndex = currentWaveIndex + 1;
    nextRowIndex += 1;
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
    isGameOver,
  };

  const validation = validateGameState(nextState);
  if (!validation.ok) {
    throw new Error(`Invalid transitioned GameState: ${validation.errors.join('; ')}`);
  }

  return canonicalizeGameState(nextState);
}
