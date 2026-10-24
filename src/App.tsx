import React, { useEffect, useRef, useState, useCallback } from 'react';
import { INPUT_CONFIG, PHYSICS_CONFIG } from './config.js';
import { createGameState } from './domain/gameState.js';
import { Simulation } from './physics/simulation.js';
import { previewFuture, analyzeRobustness } from './future/futureEngine.js';
import { LEVELS } from './levels/levels.js';
import { CanvasRenderer, type VisualBall, type BlockHitEffect, type BlockDestructionEffect } from './render/canvasRenderer';
import { viewToWorld } from './render/viewport.js';
import type { GameState, FuturePreview, Block } from './types.js';

type LevelKey = keyof typeof LEVELS;
const levelKeys = Object.keys(LEVELS) as LevelKey[];

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // DOM refs for direct, zero-overhead high-frequency updates
  const angleTextRef = useRef<HTMLDivElement | null>(null);
  const futureTextRef = useRef<HTMLDivElement | null>(null);

  // Presentation-only decoupled animation refs
  const prevBallsMapRef = useRef<Map<string, { x: number; y: number; active: boolean }>>(new Map());
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(0);
  const launcherRecoilRef = useRef<{ time: number; angleDeg: number; duration: number } | null>(null);
  const hitEffectsRef = useRef<Map<string, BlockHitEffect>>(new Map());
  const destructionEffectsRef = useRef<BlockDestructionEffect[]>([]);

  // Core state
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>(() =>
    createGameState(LEVELS[levelKeys[0]])
  );
  const [isAiming, setIsAiming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(() => {
    try {
      return sessionStorage.getItem('project_vector_onboarded') === 'true';
    } catch {
      return false;
    }
  });

  // Authoritative mutable references
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;

  const aimingRef = useRef(isAiming);
  aimingRef.current = isAiming;

  const angleRef = useRef(45.0);
  const futureRef = useRef<FuturePreview | null>(null);
  const robustnessRef = useRef<number>(100);

  // Continuous render loop for smooth 60/120Hz display refresh
  const renderCurrent = useCallback(() => {
    if (!rendererRef.current) return;
    const now = performance.now();
    rendererRef.current.render({
      state: stateRef.current,
      future: runningRef.current ? null : futureRef.current,
      aimAngle: runningRef.current ? null : angleRef.current,
      launcherRecoil: launcherRecoilRef.current,
      hitEffects: hitEffectsRef.current,
      destructionEffects: destructionEffectsRef.current,
      now,
    });
  }, []);

  // Initialize renderer on mount
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }
  }, []);

  // Update future summary DOM text directly
  const updateFutureDOM = useCallback((p: FuturePreview | null, r: number, calculating = false) => {
    if (!futureTextRef.current) return;
    if (calculating || !p) {
      futureTextRef.current.innerHTML = '<span class="opacity-40">Calculating…</span>';
    } else {
      futureTextRef.current.innerHTML = `<span>${p.hits} hits · ${p.destroyed} destroyed · ${p.damage} dmg · ${r}% stable</span>`;
    }
  }, []);

  // Authoritative future calculation (decoupled from direct finger tracking)
  const computeAuthoritativeFuture = useCallback((stateToPreview: GameState, targetAngle: number) => {
    if (runningRef.current) return;
    try {
      const p = previewFuture(stateToPreview, targetAngle, { record: true }) as FuturePreview;
      const r = analyzeRobustness(stateToPreview, targetAngle).percent;
      futureRef.current = p;
      robustnessRef.current = r;
      updateFutureDOM(p, r, false);
      renderCurrent();
    } catch {
      updateFutureDOM(null, 100, false);
    }
  }, [renderCurrent, updateFutureDOM]);

  // Schedule authoritative future recomputation with debounce
  const scheduleFutureRecomputation = useCallback((targetAngle: number, immediate = false) => {
    if (runningRef.current) return;
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    if (immediate) {
      computeAuthoritativeFuture(stateRef.current, targetAngle);
    } else {
      previewTimerRef.current = setTimeout(() => {
        computeAuthoritativeFuture(stateRef.current, targetAngle);
      }, 35);
    }
  }, [computeAuthoritativeFuture]);

  // Handle canvas sizing and re-render
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    renderCurrent();
  }, [renderCurrent]);

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
    futureRef.current = null;
    hitEffectsRef.current.clear();
    destructionEffectsRef.current = [];
    launcherRecoilRef.current = null;

    if (angleTextRef.current) {
      angleTextRef.current.textContent = `${angleRef.current.toFixed(1)}°`;
      angleTextRef.current.classList.remove('angle-active');
    }

    scheduleFutureRecomputation(angleRef.current, true);
  }, [scheduleFutureRecomputation]);

  // Map pointer client coordinates to launch angle within canonical 1°–179° range
  const pointerToAngle = useCallback((clientX: number, clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 45;
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const world = viewToWorld(localX, localY, rect.width, rect.height);
    const dx = world.x - stateRef.current.launcher.x;
    const dy = Math.max(0.001, stateRef.current.launcher.y - world.y);
    const raw = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Math.max(INPUT_CONFIG.angleMin, Math.min(INPUT_CONFIG.angleMax, raw));
  }, []);

  // Launch turn simulation with render interpolation and feedback layers
  const playTurn = useCallback((selectedAngle: number) => {
    setIsRunning(true);
    runningRef.current = true;
    futureRef.current = null;
    updateFutureDOM(null, 100, true);

    // Subtle launcher compression and release impulse
    launcherRecoilRef.current = {
      time: performance.now(),
      angleDeg: selectedAngle,
      duration: 120,
    };

    // Instantiate authoritative simulation
    const sim = new Simulation(stateRef.current, selectedAngle, undefined, { record: false });

    // Presentation stepping & interpolation state
    const fixedDt = PHYSICS_CONFIG.fixedDt; // Canonical 1/60s
    accumulatorRef.current = 0;
    lastTimeRef.current = performance.now();
    prevBallsMapRef.current.clear();
    hitEffectsRef.current.clear();
    destructionEffectsRef.current = [];

    // Map to quickly look up block initial values for destruction events
    const blockMap = new Map<string, Block>(stateRef.current.blocks.map((b) => [b.id, b]));

    function frame(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.08); // Bound dt to avoid spiral
      lastTimeRef.current = now;
      accumulatorRef.current += dt;

      // Authoritative fixed-step progression
      while (accumulatorRef.current >= fixedDt && !sim.finished) {
        // Snapshot positions before stepping
        for (const b of sim.balls) {
          prevBallsMapRef.current.set(b.id, { x: b.x, y: b.y, active: b.active });
        }

        const eventsBefore = sim.events.length;
        sim.step();
        const eventsAfter = sim.events.length;

        // Process discrete events for presentation-only feedback
        for (let i = eventsBefore; i < eventsAfter; i += 1) {
          const ev = sim.events[i];
          if (ev.type === 'BlockCollision' && ev.blockId) {
            hitEffectsRef.current.set(ev.blockId, { time: now, duration: 110 });
          } else if (ev.type === 'BlockDestroyed' && ev.blockId) {
            const blk = blockMap.get(ev.blockId) || (sim.blocks as Block[]).find((b: Block) => b.id === ev.blockId);
            if (blk) {
              destructionEffectsRef.current.push({
                block: { ...blk },
                time: now,
                duration: 160,
              });
            }
          }
        }

        accumulatorRef.current -= fixedDt;
      }

      // Compute interpolation factor alpha between previous and current physics step
      const alpha = sim.finished ? 1.0 : Math.max(0, Math.min(1, accumulatorRef.current / fixedDt));

      // Construct visual ball representations with sub-frame interpolation
      const visualBalls: VisualBall[] = [];
      for (const b of sim.balls) {
        if (!b.active) continue;

        const prev = prevBallsMapRef.current.get(b.id);
        let posX = b.x;
        let posY = b.y;

        if (prev && prev.active) {
          posX = prev.x + (b.x - prev.x) * alpha;
          posY = prev.y + (b.y - prev.y) * alpha;
        }

        // Tactile scale-in for newborn balls
        const age = sim.time - b.spawnTime;
        const scaleProgress = Math.min(1, Math.max(0.4, age / 0.05));

        visualBalls.push({
          id: b.id,
          x: posX,
          y: posY,
          vx: b.vx,
          vy: b.vy,
          radius: b.radius,
          scale: scaleProgress,
          opacity: scaleProgress,
        });
      }

      // Clean up finished destruction effects
      destructionEffectsRef.current = destructionEffectsRef.current.filter(
        (e) => now - e.time < e.duration
      );

      // Render the interpolated frame
      if (rendererRef.current) {
        rendererRef.current.render({
          state: { ...stateRef.current, blocks: sim.blocks },
          liveBalls: visualBalls,
          aimAngle: null,
          launcherRecoil: launcherRecoilRef.current,
          hitEffects: hitEffectsRef.current,
          destructionEffects: destructionEffectsRef.current,
          now,
        });
      }

      // Check if simulation and trailing exit animations are complete
      const allExitEffectsDone = destructionEffectsRef.current.length === 0;

      if (!sim.finished || !allExitEffectsDone) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        // Authoritative turn completion
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
        hitEffectsRef.current.clear();
        destructionEffectsRef.current = [];
        launcherRecoilRef.current = null;
        scheduleFutureRecomputation(angleRef.current, true);
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }, [renderCurrent, scheduleFutureRecomputation, updateFutureDOM]);

  // Direct, immediate pointer interaction handlers (0 latency)
  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (runningRef.current) return;

    if (!hasInteracted) {
      setHasInteracted(true);
      try {
        sessionStorage.setItem('project_vector_onboarded', 'true');
      } catch {
        // Safe fallback
      }
    }

    setIsAiming(true);
    aimingRef.current = true;
    pointerIdRef.current = event.pointerId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    const newAngle = pointerToAngle(event.clientX, event.clientY);
    angleRef.current = newAngle;

    if (angleTextRef.current) {
      angleTextRef.current.textContent = `${newAngle.toFixed(1)}°`;
      angleTextRef.current.classList.add('angle-active');
    }

    // Immediate visual reticle update
    renderCurrent();

    // Schedule authoritative future calculation
    scheduleFutureRecomputation(newAngle, false);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || event.pointerId !== pointerIdRef.current || runningRef.current) return;

    const newAngle = pointerToAngle(event.clientX, event.clientY);
    angleRef.current = newAngle;

    // Zero-overhead DOM angle update
    if (angleTextRef.current) {
      angleTextRef.current.textContent = `${newAngle.toFixed(1)}°`;
    }

    // Immediate visual aim line update every animation frame
    renderCurrent();

    // Throttled authoritative calculation
    scheduleFutureRecomputation(newAngle, false);
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || event.pointerId !== pointerIdRef.current || runningRef.current) return;

    const finalAngle = pointerToAngle(event.clientX, event.clientY);
    angleRef.current = finalAngle;

    if (angleTextRef.current) {
      angleTextRef.current.textContent = `${finalAngle.toFixed(1)}°`;
      angleTextRef.current.classList.remove('angle-active');
    }

    setIsAiming(false);
    aimingRef.current = false;
    pointerIdRef.current = null;

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    // Immediate launch with 0 input latency
    playTurn(finalAngle);
    event.preventDefault();
  };

  const handlePointerCancel = () => {
    setIsAiming(false);
    aimingRef.current = false;
    pointerIdRef.current = null;
    if (angleTextRef.current) {
      angleTextRef.current.classList.remove('angle-active');
    }
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
    scheduleFutureRecomputation(angleRef.current, true);
  }, [scheduleFutureRecomputation]);

  const currentLevel = LEVELS[levelKeys[levelIndex]];
  const stageTitle = `STAGE ${String(levelIndex + 1).padStart(2, '0')} · ${currentLevel.name.toUpperCase()}`;

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

      {/* Shallow, restrained top HUD with smooth transitions */}
      <header className="top">
        <button
          id="prevButton"
          aria-label="Previous level"
          onClick={() => setLevel(levelIndex - 1)}
        >
          ‹
        </button>
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
      </header>

      {/* Onboarding hint: renders only before first user interaction */}
      {!hasInteracted && (
        <div className="gesture">
          DRAG ON THE FIELD TO EXPLORE A FUTURE
          <br />
          RELEASE TO CHOOSE IT
        </div>
      )}

      {/* Restrained angle readout, connected directly to aiming gesture */}
      <div
        ref={angleTextRef}
        className="angle"
        id="angleText"
      >
        45.0°
      </div>

      {/* Quiet, non-dashboard future summary chip */}
      <div
        ref={futureTextRef}
        className="future"
        id="futureText"
      >
        <span className="opacity-40">Calculating…</span>
      </div>

      {/* Shallow bottom HUD with subtle easing */}
      <footer className="bottom">
        <button
          id="resetButton"
          aria-label="Reset level"
          onClick={() => setLevel(levelIndex)}
        >
          ↻
        </button>
        <div className="turn-indicator">
          TURN {gameState.turn} · SCORE {gameState.score}
        </div>
      </footer>
    </main>
  );
};

export default App;
