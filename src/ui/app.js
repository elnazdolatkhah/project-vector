import { INPUT_CONFIG } from '../config.js';
import { createGameState } from '../domain/gameState.js';
import { Simulation } from '../physics/simulation.js';
import { previewFuture, analyzeRobustness } from '../future/futureEngine.js';
import { LEVELS } from '../levels/levels.js';
import { CanvasRenderer } from '../render/canvasRenderer.js';
import { viewToWorld } from '../render/viewport.js';

const canvas = document.querySelector('#game');
const renderer = new CanvasRenderer(canvas);
const stageText = document.querySelector('#stageText');
const futureText = document.querySelector('#futureText');
const angleText = document.querySelector('#angleText');
const resetButton = document.querySelector('#resetButton');
const nextButton = document.querySelector('#nextButton');

const levelKeys = Object.keys(LEVELS);
let levelIndex = 0;
let state = createGameState(LEVELS[levelKeys[levelIndex]]);
let angleDeg = 45;
let future = null;
let aiming = false;
let running = false;
let pointerId = null;
let previewTimer = null;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  renderer.render({ state, future, aimAngle: running ? null : angleDeg });
}

function refreshPreview(immediate = false) {
  if (running) return;
  clearTimeout(previewTimer);
  const run = () => {
    future = previewFuture(state, angleDeg, { record: true });
    const robustness = analyzeRobustness(state, angleDeg).percent;
    futureText.textContent = `${future.hits} HITS · ${future.destroyed} DESTROYED · ${future.damage} DAMAGE · ${robustness}% STABLE`;
    angleText.textContent = `${angleDeg.toFixed(1)}°`;
    renderer.render({ state, future, aimAngle: angleDeg });
  };
  if (immediate) run();
  else previewTimer = setTimeout(run, 45);
}

function setLevel(index) {
  levelIndex = (index + levelKeys.length) % levelKeys.length;
  state = createGameState(LEVELS[levelKeys[levelIndex]]);
  future = null;
  stageText.textContent = `STAGE ${String(levelIndex + 1).padStart(2, '0')} · ${LEVELS[levelKeys[levelIndex]].name.toUpperCase()}`;
  refreshPreview(true);
}

function pointerToAngle(event) {
  const rect = canvas.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const world = viewToWorld(localX, localY, rect.width, rect.height);
  const dx = world.x - state.launcher.x;
  const dy = state.launcher.y - world.y;
  const raw = Math.atan2(dy, dx) * 180 / Math.PI;
  return Math.max(INPUT_CONFIG.angleMin, Math.min(INPUT_CONFIG.angleMax, raw));
}

canvas.addEventListener('pointerdown', (event) => {
  if (running) return;
  aiming = true;
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  angleDeg = pointerToAngle(event);
  refreshPreview(false);
  event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
  if (!aiming || event.pointerId !== pointerId || running) return;
  angleDeg = pointerToAngle(event);
  refreshPreview(false);
  event.preventDefault();
});

canvas.addEventListener('pointerup', (event) => {
  if (!aiming || event.pointerId !== pointerId || running) return;
  angleDeg = pointerToAngle(event);
  aiming = false;
  pointerId = null;
  playTurn(angleDeg);
  event.preventDefault();
});

canvas.addEventListener('pointercancel', () => {
  aiming = false;
  pointerId = null;
});

function playTurn(selectedAngle) {
  running = true;
  future = null;
  const sim = new Simulation(state, selectedAngle, undefined, { record: false });

  function frame() {
    for (let i = 0; i < 2 && !sim.finished; i += 1) sim.step();
    renderer.render({ state: { ...state, blocks: sim.blocks }, liveBalls: sim.balls, aimAngle: null });
    if (!sim.finished) requestAnimationFrame(frame);
    else {
      const result = sim.result();
      state = { ...state, blocks: result.finalBlocks, score: state.score + result.score, turn: state.turn + 1 };
      running = false;
      refreshPreview(true);
    }
  }
  requestAnimationFrame(frame);
}

resetButton.addEventListener('click', () => setLevel(levelIndex));
nextButton.addEventListener('click', () => setLevel(levelIndex + 1));
window.addEventListener('resize', resizeCanvas, { passive: true });
if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas, { passive: true });

setLevel(0);
resizeCanvas();
