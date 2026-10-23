import test from 'node:test';
import assert from 'node:assert/strict';
import { fitWorld, viewToWorld } from '../src/render/viewport.js';

test('mobile viewport preserves 720x1280 world aspect ratio without stretching', () => {
  const fit = fitWorld(390, 844);
  assert.equal(Math.round(fit.width), 390);
  assert.equal(Math.round(fit.height), 693);
  assert.ok(fit.offsetY > 70 && fit.offsetY < 80);
});

test('view center maps to world center under letterboxed fit', () => {
  const world = viewToWorld(195, 422, 390, 844);
  assert.ok(Math.abs(world.x - 360) < 1e-6);
  assert.ok(Math.abs(world.y - 640) < 1e-6);
});
