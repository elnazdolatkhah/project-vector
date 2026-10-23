import test from 'node:test';
import assert from 'node:assert/strict';
import { V } from '../src/physics/vector.js';
import { sweptCircleVsAABB } from '../src/physics/collision.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { createGameState } from '../src/domain/gameState.js';

const almost = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('reflection preserves speed and flips the normal component', () => {
  const v = { x: 3, y: -4 };
  const r = V.reflect(v, { x: 1, y: 0 });
  assert.ok(almost(r.x, -3));
  assert.ok(almost(r.y, -4));
  assert.ok(almost(V.len(v), V.len(r)));
});

test('swept collision catches a fast face hit without tunneling', () => {
  const block = { id: 'B', x: 100, y: 100, width: 70, height: 70, value: 1, active: true };
  const hit = sweptCircleVsAABB({ x: 0, y: 135 }, { x: 240, y: 0 }, 6, block);
  assert.ok(hit, 'expected a collision');
  assert.ok(hit.t > 0 && hit.t < 1);
  assert.deepEqual(hit.normal, { x: -1, y: 0 });
});

test('swept collision resolves a corner with a normalized non-axis normal', () => {
  const block = { id: 'B', x: 100, y: 100, width: 70, height: 70, value: 1, active: true };
  const hit = sweptCircleVsAABB({ x: 40, y: 40 }, { x: 80, y: 80 }, 6, block);
  assert.ok(hit, 'expected a corner collision');
  assert.ok(Math.abs(hit.normal.x) > 0.1 && Math.abs(hit.normal.y) > 0.1);
  assert.ok(almost(V.len(hit.normal), 1, 1e-5));
});

test('simulateTurn changes block state when a shot hits a block', () => {
  const level = {
    levelId: 'TEST-HIT',
    launcher: { x: 360, y: 1180 },
    ballCount: 1,
    blocks: [{ id: 'B', x: 530, y: 990, width: 80, height: 80, value: 1, active: true }],
  };
  const state = createGameState(level);
  const result = simulateTurn(state, 45, { record: false });
  assert.ok(result.stats.hits >= 1);
  assert.equal(result.finalBlocks[0].active, false);
});
