import { VERSION, PHYSICS_CONFIG } from '../config.js';

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateGameState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return { ok: false, errors: ['state must be an object'] };
  if (state.schemaVersion !== VERSION.schemaVersion) errors.push(`schemaVersion must be ${VERSION.schemaVersion}`);
  if (state.physicsVersion !== VERSION.physicsVersion) errors.push(`physicsVersion must be ${VERSION.physicsVersion}`);
  if (!state.levelId) errors.push('levelId is required');
  if (!Number.isInteger(state.turn) || state.turn < 1) errors.push('turn must be an integer >= 1');
  if (!state.balls || !Number.isInteger(state.balls.available) || state.balls.available < 1) errors.push('balls.available must be an integer >= 1');
  if (!state.launcher || !finiteNumber(state.launcher.x) || !finiteNumber(state.launcher.y)) errors.push('launcher.x/y must be finite numbers');
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
  const state = {
    ...VERSION,
    levelId: level.levelId,
    turn: 1,
    score: 0,
    balls: { available: level.ballCount },
    launcher: { ...level.launcher },
    blocks: level.blocks.map((b) => ({ ...b })),
  };
  const validation = validateGameState(state);
  if (!validation.ok) throw new Error(`Invalid initial GameState: ${validation.errors.join('; ')}`);
  return state;
}

export function canonicalizeGameState(state) {
  const validation = validateGameState(state);
  if (!validation.ok) throw new Error(`Invalid GameState: ${validation.errors.join('; ')}`);
  return {
    schemaVersion: state.schemaVersion,
    gameVersion: state.gameVersion,
    physicsVersion: state.physicsVersion,
    levelId: state.levelId,
    turn: state.turn,
    score: state.score,
    balls: { available: state.balls.available },
    launcher: { x: state.launcher.x, y: state.launcher.y },
    blocks: [...state.blocks]
      .map((b) => ({ id: b.id, x: b.x, y: b.y, width: b.width, height: b.height, value: b.value, active: b.active }))
      .sort((a, b) => a.id.localeCompare(b.id)),
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

export function applyTurnResult(state, simulationResult) {
  const nextLauncherX = simulationResult?.nextLauncher?.x ??
    (simulationResult?.firstExitX != null ? clampLauncherX(simulationResult.firstExitX) : state.launcher.x);
  const nextState = {
    ...state,
    turn: state.turn + 1,
    score: state.score + (simulationResult?.score || 0),
    blocks: (simulationResult?.finalBlocks || state.blocks).map((b) => ({ ...b })),
    launcher: {
      x: nextLauncherX,
      y: state.launcher.y,
    },
  };
  const validation = validateGameState(nextState);
  if (!validation.ok) throw new Error(`Invalid transitioned GameState: ${validation.errors.join('; ')}`);
  return canonicalizeGameState(nextState);
}
