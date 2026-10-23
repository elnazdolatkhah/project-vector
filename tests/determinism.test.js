import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, serializeGameState, deserializeGameState, fingerprintGameState } from '../src/domain/gameState.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { LEVELS } from '../src/levels/levels.js';

function normalize(result) {
  return {
    finalBlocks: result.finalBlocks.map((b) => ({ id: b.id, value: b.value, active: b.active })),
    stats: result.stats,
    events: result.events,
    score: result.score,
    elapsedTime: result.elapsedTime,
  };
}

test('same GameState + same angle produces identical result and event stream', () => {
  const state = createGameState(LEVELS.L01);
  const a = normalize(simulateTurn(state, 47.5, { record: false }));
  const b = normalize(simulateTurn(state, 47.5, { record: false }));
  assert.deepEqual(a, b);
});

test('serialize -> load preserves the next simulated turn', () => {
  const state = createGameState(LEVELS.L02);
  const loaded = deserializeGameState(serializeGameState(state));
  assert.deepEqual(
    normalize(simulateTurn(state, 39.5, { record: false })),
    normalize(simulateTurn(loaded, 39.5, { record: false })),
  );
});

test('canonical state fingerprint is stable across round trip', () => {
  const state = createGameState(LEVELS.L03);
  const serialized = serializeGameState(state);
  assert.equal(fingerprintGameState(state), fingerprintGameState(deserializeGameState(serialized)));
});
