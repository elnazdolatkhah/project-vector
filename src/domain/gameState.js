import { VERSION, PHYSICS_CONFIG, PROGRESSION_CONFIG } from '../config.js';
import { applyTurnResult, generateTopRow, generateTopRowPickups, checkDangerLineFailure, computeDangerMargin } from './progression.js';

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateGameState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return { ok: false, errors: ['state must be an object'] };
  if (state.schemaVersion !== VERSION.schemaVersion && state.schemaVersion !== '1.1') {
    errors.push(`schemaVersion must be ${VERSION.schemaVersion}`);
  }
  if (state.physicsVersion !== VERSION.physicsVersion) errors.push(`physicsVersion must be ${VERSION.physicsVersion}`);
  if (!state.levelId) errors.push('levelId is required');
  if (state.stageStatus !== undefined && !['active', 'won', 'failed'].includes(state.stageStatus)) {
    errors.push("stageStatus must be 'active', 'won', or 'failed'");
  }
  if (state.totalWaves !== undefined && (!Number.isInteger(state.totalWaves) || state.totalWaves < 0)) {
    errors.push('totalWaves must be an integer >= 0');
  }
  if (state.waveIndex !== undefined && (!Number.isInteger(state.waveIndex) || state.waveIndex < 0)) {
    errors.push('waveIndex must be an integer >= 0');
  }
  if (!Number.isInteger(state.turn) || state.turn < 1) errors.push('turn must be an integer >= 1');
  if (!state.balls || !Number.isInteger(state.balls.available) || state.balls.available < 1) errors.push('balls.available must be an integer >= 1');
  if (!state.launcher || !finiteNumber(state.launcher.x) || !finiteNumber(state.launcher.y)) errors.push('launcher.x/y must be finite numbers');
  if (state.rowOriginY !== undefined && !finiteNumber(state.rowOriginY)) errors.push('rowOriginY must be a finite number');
  if (state.pickupCadence !== undefined && (!Number.isInteger(state.pickupCadence) || state.pickupCadence < 1)) errors.push('pickupCadence must be an integer >= 1');
  if (state.seed !== undefined && !Number.isInteger(state.seed)) errors.push('seed must be an integer');
  if (state.nextRowIndex !== undefined && (!Number.isInteger(state.nextRowIndex) || state.nextRowIndex < 1)) errors.push('nextRowIndex must be an integer >= 1');
  if (state.isGameOver !== undefined && typeof state.isGameOver !== 'boolean') errors.push('isGameOver must be a boolean');

  if (state.waves !== undefined) {
    if (!Array.isArray(state.waves)) {
      errors.push('waves must be an array');
    } else {
      for (const [wIdx, wave] of state.waves.entries()) {
        if (!wave || typeof wave !== 'object') {
          errors.push(`wave[${wIdx}] must be an object`);
          continue;
        }
        if (!Array.isArray(wave.blocks)) {
          errors.push(`wave[${wIdx}].blocks must be an array`);
        } else {
          for (const [bIdx, b] of wave.blocks.entries()) {
            if (!Number.isInteger(b.col) || b.col < 0 || b.col > 7) {
              errors.push(`wave[${wIdx}].blocks[${bIdx}].col must be integer between 0 and 7`);
            }
            if (!finiteNumber(b.hp) || b.hp <= 0) {
              errors.push(`wave[${wIdx}].blocks[${bIdx}].hp must be > 0`);
            }
            if (b.offset !== undefined && !finiteNumber(b.offset)) {
              errors.push(`wave[${wIdx}].blocks[${bIdx}].offset must be finite`);
            }
          }
        }
        if (wave.pickupCol !== undefined) {
          if (!Number.isInteger(wave.pickupCol) || wave.pickupCol < 0 || wave.pickupCol > 7) {
            errors.push(`wave[${wIdx}].pickupCol must be integer between 0 and 7`);
          } else {
            const overlappingBlock = wave.blocks?.find((b) => b.col === wave.pickupCol);
            if (overlappingBlock) {
              errors.push(`wave[${wIdx}] pickupCol ${wave.pickupCol} cannot overlap authored block at column ${overlappingBlock.col}`);
            }
          }
        }
      }
    }
  }

  if (state.pickups !== undefined) {
    if (!Array.isArray(state.pickups)) errors.push('pickups must be an array');
    else {
      const pids = new Set();
      for (const [index, p] of state.pickups.entries()) {
        if (!p.id || pids.has(p.id)) errors.push(`pickup[${index}].id must be unique`);
        pids.add(p.id);
        if (!finiteNumber(p.x) || !finiteNumber(p.y)) errors.push(`pickup[${index}].x/y must be finite numbers`);
        if (p.radius !== undefined && (!finiteNumber(p.radius) || p.radius <= 0)) errors.push(`pickup[${index}].radius must be > 0`);
        if (typeof p.active !== 'boolean') errors.push(`pickup[${index}].active must be boolean`);
      }
    }
  }

  if (!Array.isArray(state.blocks)) errors.push('blocks must be an array');
  else {
    const ids = new Set();
    for (const [index, b] of state.blocks.entries()) {
      if (!b.id || ids.has(b.id)) errors.push(`block[${index}].id must be unique`);
      ids.add(b.id);
      for (const key of ['x', 'y', 'width', 'height', 'value']) {
        if (!finiteNumber(b[key])) errors.push(`block[${index}].${key} must be finite`);
      }
      if (b.width <= 0 || b.height <= 0) errors.push(`block[${index}] width/height must be > 0`);
      if (typeof b.active !== 'boolean') errors.push(`block[${index}].active must be boolean`);
    }
  }

  const isCampaignStage = Array.isArray(state.waves) || (typeof state.levelId === 'string' && /^L\d+$/.test(state.levelId));
  if (isCampaignStage && Array.isArray(state.pickups) && Array.isArray(state.blocks)) {
    const clearanceRes = validatePickupClearance(state, PROGRESSION_CONFIG.pickupClearanceMargin ?? 6);
    if (!clearanceRes.ok) {
      for (const v of clearanceRes.violations) {
        errors.push(
          `pickup ${v.pickupId} at (${v.pickupPos.x}, ${v.pickupPos.y}) violates clearance margin from block ${v.blockId} (clearance: ${v.clearance.toFixed(2)}px < required: ${v.requiredMargin}px)`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Computes minimum physical clearance between a circular pickup and a rectangular block AABB.
 * clearance = distance(circleCenter, closestPointOnAABB) - radius
 * Positive = separated by clear space; 0 = touching; negative = intersecting/embedded.
 */
export function computePickupBlockClearance(pickup, block) {
  const px = pickup.x;
  const py = pickup.y;
  const r = pickup.radius ?? PROGRESSION_CONFIG.pickupRadius ?? 14;

  const bx = block.x;
  const by = block.y;
  const bw = block.width;
  const bh = block.height;

  const cx = Math.max(bx, Math.min(px, bx + bw));
  const cy = Math.max(by, Math.min(py, by + bh));

  const dist = Math.hypot(px - cx, py - cy);
  return dist - r;
}

/**
 * Validates that all active pickups maintain at least clearanceMargin from all active blocks.
 * Invariant: pickup circle vs expanded block AABB must not intersect.
 */
export function validatePickupClearance(gameState, clearanceMargin = (PROGRESSION_CONFIG.pickupClearanceMargin ?? 6)) {
  const pickups = (gameState?.pickups || []).filter((p) => p.active !== false);
  const blocks = (gameState?.blocks || []).filter((b) => b.active !== false && b.value > 0);
  const violations = [];

  for (const pickup of pickups) {
    for (const block of blocks) {
      const clearance = computePickupBlockClearance(pickup, block);
      if (clearance < clearanceMargin) {
        violations.push({
          pickupId: pickup.id,
          pickupPos: { x: pickup.x, y: pickup.y, radius: pickup.radius ?? PROGRESSION_CONFIG.pickupRadius ?? 14 },
          blockId: block.id,
          blockRect: { x: block.x, y: block.y, width: block.width, height: block.height },
          clearance,
          requiredMargin: clearanceMargin,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    clearanceMargin,
    violations,
  };
}

export function createGameState(level) {
  const rowOriginY = finiteNumber(level.rowOriginY)
    ? level.rowOriginY
    : (PROGRESSION_CONFIG.defaultRowOriginY ?? PROGRESSION_CONFIG.topRowY);

  const totalWaves = Number.isInteger(level.totalWaves) && level.totalWaves >= 0
    ? level.totalWaves
    : (Array.isArray(level.waves) ? level.waves.length : (PROGRESSION_CONFIG.defaultTotalWaves ?? 3));

  const waveIndex = Number.isInteger(level.waveIndex) && level.waveIndex >= 0
    ? level.waveIndex
    : 0;

  const stageStatus = level.stageStatus && ['active', 'won', 'failed'].includes(level.stageStatus)
    ? level.stageStatus
    : (level.isGameOver ? 'failed' : 'active');

  const isGameOver = stageStatus === 'failed';

  const pickups = Array.isArray(level.pickups)
    ? level.pickups.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        radius: p.radius ?? PROGRESSION_CONFIG.pickupRadius,
        active: p.active !== false,
      }))
    : [];

  const waves = Array.isArray(level.waves)
    ? level.waves.map((w) => ({
        ...w,
        blocks: (w.blocks || []).map((b) => ({ ...b })),
      }))
    : undefined;

  const state = {
    ...VERSION,
    levelId: level.levelId,
    stageStatus,
    turn: Number.isInteger(level.turn) && level.turn >= 1 ? level.turn : 1,
    waveIndex,
    totalWaves,
    score: Number.isInteger(level.score) && level.score >= 0 ? level.score : 0,
    balls: { available: level.ballCount },
    launcher: { ...level.launcher },
    blocks: level.blocks.map((b) => ({ ...b })),
    pickups,
    ...(waves !== undefined ? { waves } : {}),
    rowOriginY,
    pickupCadence: Number.isInteger(level.pickupCadence) ? level.pickupCadence : PROGRESSION_CONFIG.pickupSpawnCadence,
    seed: Number.isInteger(level.seed) ? level.seed : 1,
    nextRowIndex: 1,
    isGameOver,
  };
  const validation = validateGameState(state);
  if (!validation.ok) throw new Error(`Invalid initial GameState: ${validation.errors.join('; ')}`);
  return state;
}

export function canonicalizeGameState(state) {
  const validation = validateGameState(state);
  if (!validation.ok) throw new Error(`Invalid GameState: ${validation.errors.join('; ')}`);
  const rowOriginY = finiteNumber(state.rowOriginY)
    ? state.rowOriginY
    : (PROGRESSION_CONFIG.defaultRowOriginY ?? PROGRESSION_CONFIG.topRowY);

  const stageStatus = state.stageStatus ?? (state.isGameOver ? 'failed' : 'active');
  const totalWaves = Number.isInteger(state.totalWaves) ? state.totalWaves : (Array.isArray(state.waves) ? state.waves.length : (PROGRESSION_CONFIG.defaultTotalWaves ?? 3));
  const waveIndex = Number.isInteger(state.waveIndex) ? state.waveIndex : 0;
  const isGameOver = stageStatus === 'failed';

  const pickups = Array.isArray(state.pickups)
    ? [...state.pickups]
        .map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          radius: p.radius ?? PROGRESSION_CONFIG.pickupRadius,
          active: Boolean(p.active),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];

  const waves = Array.isArray(state.waves)
    ? state.waves.map((w) => ({
        ...w,
        blocks: (w.blocks || []).map((b) => ({ ...b })),
      }))
    : undefined;

  return {
    schemaVersion: VERSION.schemaVersion,
    gameVersion: state.gameVersion,
    physicsVersion: state.physicsVersion,
    ...(state.migrationVersion ? { migrationVersion: state.migrationVersion } : {}),
    levelId: state.levelId,
    stageStatus,
    turn: state.turn,
    waveIndex,
    totalWaves,
    score: state.score,
    balls: { available: state.balls.available },
    launcher: { x: state.launcher.x, y: state.launcher.y },
    blocks: [...state.blocks]
      .map((b) => ({ id: b.id, x: b.x, y: b.y, width: b.width, height: b.height, value: b.value, active: b.active }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    pickups,
    ...(waves !== undefined ? { waves } : {}),
    rowOriginY,
    pickupCadence: Number.isInteger(state.pickupCadence) ? state.pickupCadence : PROGRESSION_CONFIG.pickupSpawnCadence,
    seed: Number.isInteger(state.seed) ? state.seed : 1,
    nextRowIndex: Number.isInteger(state.nextRowIndex) ? state.nextRowIndex : 1,
    isGameOver,
  };
}

export function serializeGameState(state) {
  return JSON.stringify(canonicalizeGameState(state));
}

export function deserializeGameState(serialized) {
  const state = JSON.parse(serialized);
  const validation = validateGameState(state);
  if (!validation.ok) throw new Error(`Invalid serialized GameState: ${validation.errors.join('; ')}`);
  return canonicalizeGameState(state);
}

export function fingerprintGameState(state) {
  const str = serializeGameState(state);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `pv-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function clampLauncherX(x, config = PHYSICS_CONFIG) {
  const min = config.ballRadius;
  const max = config.canvasWidth - config.ballRadius;
  const clamped = Math.max(min, Math.min(max, x));
  return Math.round(clamped * 1e6) / 1e6;
}

export { applyTurnResult, generateTopRow, generateTopRowPickups, checkDangerLineFailure, computeDangerMargin, PROGRESSION_CONFIG };
