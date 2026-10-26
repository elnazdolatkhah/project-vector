import { VERSION, PHYSICS_CONFIG, PROGRESSION_CONFIG } from '../config.js';
import { applyTurnResult, generateTopRow, generateTopRowPickups, checkDangerLineFailure } from './progression.js';

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
  return { ok: errors.length === 0, errors };
}

export function createGameState(level) {
  const rowOriginY = finiteNumber(level.rowOriginY)
    ? level.rowOriginY
    : (PROGRESSION_CONFIG.defaultRowOriginY ?? PROGRESSION_CONFIG.topRowY);

  const totalWaves = Number.isInteger(level.totalWaves) && level.totalWaves >= 0
    ? level.totalWaves
    : (PROGRESSION_CONFIG.defaultTotalWaves ?? 3);

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
  const totalWaves = Number.isInteger(state.totalWaves) ? state.totalWaves : (PROGRESSION_CONFIG.defaultTotalWaves ?? 3);
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

export { applyTurnResult, generateTopRow, generateTopRowPickups, checkDangerLineFailure, PROGRESSION_CONFIG };

