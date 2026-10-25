import { PROGRESSION_CONFIG, PHYSICS_CONFIG } from '../config.js';
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
    const x = PROGRESSION_CONFIG.startX + col * PROGRESSION_CONFIG.columnSpacing;
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
 * 4. Deterministic new row generated at TOP_ROW_Y (220 units).
 * 5. Danger line failure evaluation (block.y + block.height >= DANGER_LINE_Y).
 * 6. Turn increment and score accumulation.
 * 7. Canonical validation and state serialization.
 */
export function applyTurnResult(state, simulationResult) {
  if (state.isGameOver) {
    // Terminal state cannot progress further
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

  // 3: Generate deterministic new top row
  const newRow = generateTopRow(state);

  // 4: Combined board blocks
  const nextBlocks = [...descendedBlocks, ...newRow];

  // 5: Check danger line failure condition
  const isGameOver = checkDangerLineFailure(nextBlocks, PROGRESSION_CONFIG.dangerLineY);

  const nextTurn = state.turn + 1;
  const nextRowIndex = (state.nextRowIndex ?? 1) + 1;
  const nextScore = state.score + (simulationResult?.score || 0);

  const nextState = {
    ...state,
    turn: nextTurn,
    nextRowIndex,
    score: nextScore,
    blocks: nextBlocks,
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
