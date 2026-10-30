import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { previewFuture } from '../src/future/futureEngine.js';
import { createGameState } from '../src/domain/gameState.js';
import { LEVELS } from '../src/levels/levels.js';

// Setup JSDOM environment for real App integration tests
function setupAppHarness() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
  global.PointerEvent = dom.window.PointerEvent;
  global.sessionStorage = dom.window.sessionStorage;
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const mockCtx = new Proxy(
    {
      canvas: null,
      measureText: () => ({ width: 0 }),
      getLineDash: () => [],
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );

  dom.window.HTMLCanvasElement.prototype.getContext = function () {
    mockCtx.canvas = this;
    return mockCtx;
  };
  dom.window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 720, height: 1280, right: 720, bottom: 1280, x: 0, y: 0 };
  };
  dom.window.HTMLCanvasElement.prototype.setPointerCapture = function () {};
  dom.window.HTMLCanvasElement.prototype.releasePointerCapture = function () {};

  return dom;
}

// Convert angle (degrees) to clientX, clientY relative to standard 720x1280 viewport
function angleToClient(angleDeg, radius = 200, launcherX = 360, launcherY = 1180) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    clientX: launcherX + radius * Math.cos(rad),
    clientY: launcherY - radius * Math.sin(rad),
  };
}

// Helper to wait inside act
function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('P0 Scenario 1: Move -> preview completes -> release at same coordinate', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  assert.ok(canvas);

  const targetAngle = 60.0;
  const p60 = angleToClient(targetAngle);

  // 1. Pointer Down
  await act(async () => {
    canvas.dispatchEvent(
      new window.PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: p60.clientX,
        clientY: p60.clientY,
        bubbles: true,
      })
    );
  });

  // 2. Wait >35ms for debounced authoritative preview to complete
  await act(async () => {
    await waitMs(60);
  });

  assert.equal(
    canvas.dataset.visiblePreviewAngle,
    targetAngle.toFixed(4),
    'Visible preview angle must match 60.0000°'
  );

  // 3. Pointer Up at same coordinate
  await act(async () => {
    canvas.dispatchEvent(
      new window.PointerEvent('pointerup', {
        pointerId: 1,
        clientX: p60.clientX,
        clientY: p60.clientY,
        bubbles: true,
      })
    );
  });

  // Immediately on release: renderedReleasePreviewAngle must be set
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, targetAngle.toFixed(4));

  // 4. Wait across deferred RAF boundary
  await act(async () => {
    await waitMs(25);
  });

  // Invariant verification: finalReleaseAngle === renderedReleasePreviewAngle === committedAngle
  assert.equal(canvas.dataset.committedAngle, targetAngle.toFixed(4));
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, canvas.dataset.committedAngle);
  assert.equal(canvas.dataset.renderedReleasePreviewDamage, canvas.dataset.committedPreviewDamage);
  assert.equal(canvas.dataset.renderedReleasePreviewDestroyed, canvas.dataset.committedPreviewDestroyed);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 2: Final move <35ms before release computes & renders release angle then commits it', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Aim at 60.0° and wait for preview to complete
  const p60 = angleToClient(60.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p60.clientX, clientY: p60.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  assert.equal(canvas.dataset.visiblePreviewAngle, (60.0).toFixed(4), 'Visible preview angle is 60.0000°');

  // Fast move to 85.0° (starts 35ms debounce)
  const p85 = angleToClient(85.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointermove', { pointerId: 1, clientX: p85.clientX, clientY: p85.clientY, bubbles: true }));
  });

  // Wait only 15ms (< 35ms debounce threshold)
  await act(async () => {
    await waitMs(15);
  });

  // Release at 85.0° while debounce is still pending
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p85.clientX, clientY: p85.clientY, bubbles: true }));
  });

  // Immediately on release: 85.0° preview has been synchronously computed and rendered
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (85.0).toFixed(4));

  // Wait across deferred RAF boundary
  await act(async () => {
    await waitMs(25);
  });

  // Contract invariant: finalReleaseAngle === renderedReleasePreviewAngle === committedAngle
  assert.equal(canvas.dataset.committedAngle, (85.0).toFixed(4), 'Committed angle must be the final release angle (85.0000°)');
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, canvas.dataset.committedAngle);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 3: Pointer-up coordinate differs from last pointer-move (finger lift jitter)', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Aim at 75.0° and complete preview
  const p75 = angleToClient(75.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p75.clientX, clientY: p75.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  assert.equal(canvas.dataset.visiblePreviewAngle, (75.0).toFixed(4));

  // Finger lift event arrives at slightly different coordinates (e.g. 76.5° due to touch release drift)
  const p765 = angleToClient(76.5);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p765.clientX, clientY: p765.clientY, bubbles: true }));
  });

  // Release coordinates (76.5°) are synchronously previewed and rendered
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (76.5).toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  // Must commit the exact rendered release angle (76.5°)
  assert.equal(canvas.dataset.committedAngle, (76.5).toFixed(4));
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, canvas.dataset.committedAngle);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 4: Rapid scrub across several angles then immediate release commits release angle', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  // Initial visible preview at stage start is 45.0°
  assert.equal(canvas.dataset.visiblePreviewAngle, (45.0).toFixed(4));

  // Rapid scrub: down at 50°, move through 70°, 90°, 110°, 130° with 10ms intervals (no debounce completes)
  const p50 = angleToClient(50.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p50.clientX, clientY: p50.clientY, bubbles: true }));
  });

  for (const scrubAngle of [70.0, 90.0, 110.0, 130.0]) {
    await act(async () => {
      await waitMs(10);
      const pos = angleToClient(scrubAngle);
      canvas.dispatchEvent(new window.PointerEvent('pointermove', { pointerId: 1, clientX: pos.clientX, clientY: pos.clientY, bubbles: true }));
    });
  }

  // Immediate release at 130° without waiting for debounce
  const p130 = angleToClient(130.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p130.clientX, clientY: p130.clientY, bubbles: true }));
  });

  // Synchronous release preview for 130.0° rendered immediately
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (130.0).toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  // Final committed angle must be 130.0000° (NEVER 45.0000°!)
  assert.equal(canvas.dataset.committedAngle, (130.0).toFixed(4), 'Rapid scrub to 130° must commit 130.0000°');
  assert.notEqual(canvas.dataset.committedAngle, (45.0).toFixed(4));
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, canvas.dataset.committedAngle);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 5: Quick tap / release while preview debounce is pending', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  assert.equal(canvas.dataset.visiblePreviewAngle, (45.0).toFixed(4));

  // Quick tap at 110°: down then up in 5ms
  const p110 = angleToClient(110.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p110.clientX, clientY: p110.clientY, bubbles: true }));
    await waitMs(5);
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p110.clientX, clientY: p110.clientY, bubbles: true }));
  });

  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (110.0).toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, (110.0).toFixed(4));
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, canvas.dataset.committedAngle);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 6: Sensitive route around 90° (vertical corridor parity)', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Aim exactly 90.0°
  const p90 = angleToClient(90.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p90.clientX, clientY: p90.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  assert.equal(canvas.dataset.visiblePreviewAngle, (90.0).toFixed(4));
  const previewDmg = canvas.dataset.visiblePreviewDamage;
  const previewDestroyed = canvas.dataset.visiblePreviewDestroyed;

  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p90.clientX, clientY: p90.clientY, bubbles: true }));
  });

  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (90.0).toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, (90.0).toFixed(4));
  assert.equal(canvas.dataset.committedPreviewDamage, previewDmg);
  assert.equal(canvas.dataset.committedPreviewDestroyed, previewDestroyed);

  // Authoritative parity check against ground-truth previewFuture
  const state = createGameState(LEVELS.L01);
  const expected = previewFuture(state, 90.0, { record: false });
  assert.equal(Number(canvas.dataset.committedPreviewDamage), expected.damage);
  assert.equal(Number(canvas.dataset.committedPreviewDestroyed), expected.destroyed);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 7: ±0.25° sensitivity fixture', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Center angle: 60.0°, test -0.25° (59.75°)
  const testAngle = 59.75;
  const pos = angleToClient(testAngle);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: pos.clientX, clientY: pos.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  assert.equal(canvas.dataset.visiblePreviewAngle, testAngle.toFixed(4));
  const expectedDmg = canvas.dataset.visiblePreviewDamage;

  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: pos.clientX, clientY: pos.clientY, bubbles: true }));
  });

  assert.equal(canvas.dataset.renderedReleasePreviewAngle, testAngle.toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, testAngle.toFixed(4));
  assert.equal(canvas.dataset.committedPreviewDamage, expectedDmg);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 8: Lower boundary 5.0° clamping and commitment', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Aim at 2.0° (below 5° min boundary)
  const pSub5 = angleToClient(2.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: pSub5.clientX, clientY: pSub5.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  // Clamped to exactly 5.0000°
  assert.equal(canvas.dataset.visiblePreviewAngle, (5.0).toFixed(4));

  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: pSub5.clientX, clientY: pSub5.clientY, bubbles: true }));
  });

  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (5.0).toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, (5.0).toFixed(4));

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 9: Upper boundary 175.0° clamping and commitment', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Aim at 178.0° (above 175° max boundary)
  const pOver175 = angleToClient(178.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: pOver175.clientX, clientY: pOver175.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  // Clamped to exactly 175.0000°
  assert.equal(canvas.dataset.visiblePreviewAngle, (175.0).toFixed(4));

  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: pOver175.clientX, clientY: pOver175.clientY, bubbles: true }));
  });

  assert.equal(canvas.dataset.renderedReleasePreviewAngle, (175.0).toFixed(4));

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, (175.0).toFixed(4));

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 10: Pointer cancel while preview is pending cancels gesture without launch', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  const p80 = angleToClient(80.0);

  // Pointer down and start move
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p80.clientX, clientY: p80.clientY, bubbles: true }));
    canvas.dispatchEvent(new window.PointerEvent('pointermove', { pointerId: 1, clientX: p80.clientX, clientY: p80.clientY, bubbles: true }));
  });

  // Cancel immediately
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
  });

  // Wait to ensure no deferred launch fires
  await act(async () => {
    await waitMs(50);
  });

  // Verify no turn was launched
  assert.equal(canvas.dataset.committedAngle, undefined, 'No committed angle should exist');

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 11: Level reset during release-finalization frame aborts launch safely', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  const resetButton = document.getElementById('resetButton');
  assert.ok(resetButton);

  // Aim at 70° on Level 1
  const p70 = angleToClient(70.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p70.clientX, clientY: p70.clientY, bubbles: true }));
  });

  // Release at 70°
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p70.clientX, clientY: p70.clientY, bubbles: true }));
  });

  // Immediately click Reset before RAF executes (race window)
  await act(async () => {
    resetButton.click();
  });

  // Wait 50ms for any deferred launch to attempt firing
  await act(async () => {
    await waitMs(50);
  });

  // Deferred launch was cancelled; stage is reset to initial state; no committed volley fired
  assert.equal(canvas.dataset.committedAngle, undefined);
  assert.equal(canvas.dataset.visiblePreviewAngle, (45.0).toFixed(4));

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 12: Level switch during release-finalization frame aborts launch safely', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  const nextButton = document.getElementById('nextButton');
  assert.ok(nextButton);

  // Aim at 80° on Level 1
  const p80 = angleToClient(80.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p80.clientX, clientY: p80.clientY, bubbles: true }));
  });

  // Release at 80°
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p80.clientX, clientY: p80.clientY, bubbles: true }));
  });

  // Immediately switch level
  await act(async () => {
    nextButton.click();
  });

  // Wait 50ms
  await act(async () => {
    await waitMs(50);
  });

  // Deferred launch was cancelled; new level loaded cleanly; no volley fired
  assert.equal(canvas.dataset.committedAngle, undefined);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 13: Multi-touch cannot replace committed preview or gesture owner', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Primary pointer (ID 1) aims at 65.0°
  const p65 = angleToClient(65.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p65.clientX, clientY: p65.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });
  assert.equal(canvas.dataset.visiblePreviewAngle, (65.0).toFixed(4));

  // Secondary pointer (ID 2) attempts to hijack at 140.0°
  const p140 = angleToClient(140.0);
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 2, clientX: p140.clientX, clientY: p140.clientY, bubbles: true }));
    canvas.dispatchEvent(new window.PointerEvent('pointermove', { pointerId: 2, clientX: p140.clientX, clientY: p140.clientY, bubbles: true }));
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 2, clientX: p140.clientX, clientY: p140.clientY, bubbles: true }));
  });

  // Secondary pointer actions were completely ignored; no shot was fired by pointer 2
  assert.equal(canvas.dataset.visiblePreviewAngle, (65.0).toFixed(4));
  assert.equal(canvas.dataset.committedAngle, undefined);

  // Primary pointer releases
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p65.clientX, clientY: p65.clientY, bubbles: true }));
  });

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, (65.0).toFixed(4));
  assert.equal(canvas.dataset.renderedReleasePreviewAngle, canvas.dataset.committedAngle);

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 14: Exactly one volley can be launched per gesture', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');
  const p50 = angleToClient(50.0);

  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p50.clientX, clientY: p50.clientY, bubbles: true }));
  });
  await act(async () => {
    await waitMs(60);
  });

  // First release launches the volley
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p50.clientX, clientY: p50.clientY, bubbles: true }));
  });

  await act(async () => {
    await waitMs(25);
  });

  assert.equal(canvas.dataset.committedAngle, (50.0).toFixed(4));

  // Attempt duplicate pointer-up immediately
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: p50.clientX, clientY: p50.clientY, bubbles: true }));
  });

  // Attempt secondary pointer-down during running volley
  await act(async () => {
    canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: p50.clientX, clientY: p50.clientY, bubbles: true }));
  });

  // Angle remains the single committed volley
  assert.equal(canvas.dataset.committedAngle, (50.0).toFixed(4));

  await act(async () => {
    root.unmount();
  });
});

test('P0 Scenario 15: Invariant verification: finalReleaseAngle === renderedReleasePreviewAngle === committedAngle', async () => {
  setupAppHarness();
  const { App } = await import('../src/App.tsx');
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(App));
  });

  const canvas = document.querySelector('canvas');

  // Test across multiple distinct angles: 35.0°, 72.5°, 128.3°, 160.0°
  const testAngles = [35.0, 72.5, 128.3, 160.0];

  for (const testAngle of testAngles) {
    const pt = angleToClient(testAngle);

    await act(async () => {
      canvas.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, clientX: pt.clientX, clientY: pt.clientY, bubbles: true }));
      // Intentionally do not wait for debounce, release immediately
      await waitMs(5);
      canvas.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, clientX: pt.clientX, clientY: pt.clientY, bubbles: true }));
    });

    const renderedPreview = canvas.dataset.renderedReleasePreviewAngle;
    assert.equal(renderedPreview, testAngle.toFixed(4), `Rendered release preview must match ${testAngle}°`);

    await act(async () => {
      await waitMs(25);
    });

    const committed = canvas.dataset.committedAngle;
    assert.equal(committed, testAngle.toFixed(4), `Committed angle must match ${testAngle}°`);
    assert.equal(renderedPreview, committed, 'renderedReleasePreviewAngle must strictly equal committedAngle');

    // Reset for next test angle
    const resetButton = document.getElementById('resetButton');
    await act(async () => {
      resetButton.click();
    });
  }

  await act(async () => {
    root.unmount();
  });
});
