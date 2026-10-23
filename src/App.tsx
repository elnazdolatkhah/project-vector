import React, { useEffect, useRef, useState, useCallback } from 'react';
import { INPUT_CONFIG } from './config.js';
import { createGameState } from './domain/gameState.js';
import { Simulation } from './physics/simulation.js';
import { previewFuture, analyzeRobustness } from './future/futureEngine.js';
import { LEVELS } from './levels/levels.js';
import { CanvasRenderer } from './render/canvasRenderer';
import { viewToWorld } from './render/viewport.js';
import type { GameState, FuturePreview, Ball } from './types.js';

type LevelKey = keyof typeof LEVELS;
const levelKeys = Object.keys(LEVELS) as LevelKey[];

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>(() =>
    createGameState(LEVELS[levelKeys[0]])
  );
  const [angleDeg, setAngleDeg] = useState(45.0);
  const [future, setFuture] = useState<FuturePreview | null>(null);
  const [robustness, setRobustness] = useState<number>(100);
  const [isAiming, setIsAiming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Keep mutable references for the animation loop and event handlers
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;

  const angleRef = useRef(angleDeg);
  angleRef.current = angleDeg;

  const aimingRef = useRef(isAiming);
  aimingRef.current = isAiming;

  const futureRef = useRef(future);
  futureRef.current = future;

  // Initialize renderer once canvas is mounted
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, []);

  // Compute preview for a given angle
  const computePreview = useCallback((stateToPreview: GameState, targetAngle: number) => {
    if (runningRef.current) return;
    try {
      const p = previewFuture(stateToPreview, targetAngle, { record: true }) as FuturePreview;
      const r = analyzeRobustness(stateToPreview, targetAngle).percent;
      setFuture(p);
      setRobustness(r);
      setIsCalculating(false);

      if (rendererRef.current) {
        rendererRef.current.render({
          state: stateToPreview,
          future: p,
          aimAngle: targetAngle,
        });
      }
    } catch {
      setIsCalculating(false);
    }
  }, []);

  // Refresh preview (immediate or debounced)
  const refreshPreview = useCallback((stateToUse: GameState, targetAngle: number, immediate = false) => {
    if (runningRef.current) return;
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    if (immediate) {
      computePreview(stateToUse, targetAngle);
    } else {
      setIsCalculating(true);
      previewTimerRef.current = setTimeout(() => {
        computePreview(stateToUse, targetAngle);
      }, 45);
    }
  }, [computePreview]);

  // Handle canvas sizing and re-render
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    rendererRef.current.render({
      state: stateRef.current,
      future: runningRef.current ? null : futureRef.current,
      aimAngle: runningRef.current ? null : angleRef.current,
    });
  }, []);

  // Switch level
  const setLevel = useCallback((newIndex: number) => {
    if (runningRef.current && animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    const idx = (newIndex + levelKeys.length) % levelKeys.length;
    const newState = createGameState(LEVELS[levelKeys[idx]]);
    setLevelIndex(idx);
    setGameState(newState);
    stateRef.current = newState;
    setIsRunning(false);
    runningRef.current = false;
    setIsAiming(false);
    aimingRef.current = false;
    setFuture(null);
    futureRef.current = null;
    refreshPreview(newState, angleRef.current, true);
  }, [refreshPreview]);

  // Map pointer client coordinates to launch angle
  const pointerToAngle = useCallback((clientX: number, clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 45;
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const world = viewToWorld(localX, localY, rect.width, rect.height);
    const dx = world.x - stateRef.current.launcher.x;
    const dy = stateRef.current.launcher.y - world.y;
    const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Math.max(INPUT_CONFIG.angleMin, Math.min(INPUT_CONFIG.angleMax, raw));
  }, []);

  // Launch turn simulation
  const playTurn = useCallback((selectedAngle: number) => {
    setIsRunning(true);
    runningRef.current = true;
    setFuture(null);
    futureRef.current = null;

    const sim = new Simulation(stateRef.current, selectedAngle, undefined, { record: false });

    function frame() {
      for (let i = 0; i < 2 && !sim.finished; i += 1) {
        sim.step();
      }

      if (rendererRef.current) {
        rendererRef.current.render({
          state: { ...stateRef.current, blocks: sim.blocks },
          liveBalls: sim.balls as Ball[],
          aimAngle: null,
        });
      }

      if (!sim.finished) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        const result = sim.result();
        const nextState: GameState = {
          ...stateRef.current,
          blocks: result.finalBlocks,
          score: stateRef.current.score + result.score,
          turn: stateRef.current.turn + 1,
        };
        setGameState(nextState);
        stateRef.current = nextState;
        setIsRunning(false);
        runningRef.current = false;
        refreshPreview(nextState, angleRef.current, true);
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }, [refreshPreview]);

  // Pointer event listeners
  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (runningRef.current) return;
    setIsAiming(true);
    aimingRef.current = true;
    pointerIdRef.current = event.pointerId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    const newAngle = pointerToAngle(event.clientX, event.clientY);
    setAngleDeg(newAngle);
    angleRef.current = newAngle;
    refreshPreview(stateRef.current, newAngle, false);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || event.pointerId !== pointerIdRef.current || runningRef.current) return;
    const newAngle = pointerToAngle(event.clientX, event.clientY);
    setAngleDeg(newAngle);
    angleRef.current = newAngle;
    refreshPreview(stateRef.current, newAngle, false);
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || event.pointerId !== pointerIdRef.current || runningRef.current) return;
    const finalAngle = pointerToAngle(event.clientX, event.clientY);
    setAngleDeg(finalAngle);
    angleRef.current = finalAngle;
    setIsAiming(false);
    aimingRef.current = false;
    pointerIdRef.current = null;
    playTurn(finalAngle);
    event.preventDefault();
  };

  const handlePointerCancel = () => {
    setIsAiming(false);
    aimingRef.current = false;
    pointerIdRef.current = null;
  };

  // Window resize & visualViewport handling
  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvas, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', resizeCanvas);
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [resizeCanvas]);

  // Initial preview computation
  useEffect(() => {
    refreshPreview(gameState, 45.0, true);
  }, []);

  const currentLevel = LEVELS[levelKeys[levelIndex]];
  const stageTitle = `STAGE ${String(levelIndex + 1).padStart(2, '0')} · ${currentLevel.name.toUpperCase()}`;

  let futureContent = 'CALCULATING…';
  if (future && !isCalculating) {
    futureContent = `${future.hits} HITS · ${future.destroyed} DESTROYED · ${future.damage} DAMAGE · ${robustness}% STABLE`;
  }

  return (
    <main className="phone">
      <canvas
        id="game"
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      <div className="top">
        <div className="stage" id="stageText">
          {stageTitle}
        </div>
        <button
          id="nextButton"
          aria-label="Next level"
          onClick={() => setLevel(levelIndex + 1)}
        >
          ›
        </button>
      </div>

      <div
        className="gesture"
        style={{ opacity: isAiming || isRunning ? 0 : 1 }}
      >
        DRAG ON THE FIELD TO EXPLORE A FUTURE
        <br />
        RELEASE TO CHOOSE IT
      </div>

      <div className="angle" id="angleText">
        {angleDeg.toFixed(1)}°
      </div>

      <div className="future" id="futureText">
        {futureContent}
      </div>

      <div className="bottom">
        <button
          id="resetButton"
          aria-label="Reset level"
          onClick={() => setLevel(levelIndex)}
        >
          ↻
        </button>
      </div>
    </main>
  );
};

export default App;
