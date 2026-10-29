import React, { useEffect, useRef, useState, useCallback } from 'react';
import { INPUT_CONFIG, PHYSICS_CONFIG } from './config.js';
import { createGameState, applyTurnResult, clampLauncherX } from './domain/gameState.js';
import { Simulation } from './physics/simulation.js';
import { previewFuture, analyzeRobustness } from './future/futureEngine.js';
import { LEVELS } from './levels/levels.js';
import {
  CanvasRenderer,
  type VisualBall,
  type BlockHitEffect,
  type BlockDestructionEffect,
  type TrajectoryTransition,
  type BoardTransition,
} from './render/canvasRenderer';
import { viewToWorld } from './render/viewport.js';
import type { GameState, FuturePreview, Block } from './types.js';
import { evaluatePresentationSpeed } from './physics/presentationScheduler.js';

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
  const launcherSettleRef = useRef<{ time: number; duration: number } | null>(null);
  const readyFadeStartRef = useRef<number>(0);
  const hitEffectsRef = useRef<Map<string, BlockHitEffect>>(new Map());
  const destructionEffectsRef = useRef<BlockDestructionEffect[]>([]);
  const trajectoryTransitionRef = useRef<TrajectoryTransition | null>(null);
  const boardTransitionRef = useRef<BoardTransition | null>(null);

  // Core state
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>(() =>
    createGameState(LEVELS[levelKeys[0]])
  );
  const [isAiming, setIsAiming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [playbackTier, setPlaybackTier] = useState<'NORMAL' | 'TAIL' | 'RAPID_TAIL'>('NORMAL');
  const [isTransitioning, setIsTransitioning] = useState(false);
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

  const transitioningRef = useRef(isTransitioning);
  transitioningRef.current = isTransitioning;

  const aimingRef = useRef(isAiming);
  aimingRef.current = isAiming;

  const angleRef = useRef(45.0);
  const futureRef = useRef<FuturePreview | null>(null);
  const robustnessRef = useRef<number>(100);

  // Future Echo temporal reveal timing: fades in after holding angle stable for ~80-120ms
  const lastAngleMoveTimeRef = useRef<number>(0);
  const lastScrubAngleRef = useRef<number>(45.0);
  const echoAnimFrameRef = useRef<number | null>(null);
  const echoCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Continuous render loop for smooth 60/120Hz display refresh
  const renderCurrent = useCallback(() => {
    if (!rendererRef.current) return;
    const now = performance.now();

    // Smooth ready-fade alpha calculation after volley ends (80–120ms target: calibrated to 95ms)
    let readyFadeAlpha = 1.0;
    if (readyFadeStartRef.current > 0) {
      const elapsed = now - readyFadeStartRef.current;
      readyFadeAlpha = Math.min(1.0, elapsed / 95);
      if (readyFadeAlpha >= 1.0) {
        readyFadeStartRef.current = 0;
      }
    }

    const suppressAimAndFuture = runningRef.current || transitioningRef.current || stateRef.current.stageStatus !== 'active';

    // Future Echo temporal reveal calculation:
    // During rapid scrub, echo stays quiet (alpha 0).
    // When aim remains approximately stable for ~80–120ms (calibrated to 95ms), echo fades in cleanly.
    let futureEchoAlpha = 0;
    if (!suppressAimAndFuture && futureRef.current) {
      if (aimingRef.current) {
        const holdTime = now - lastAngleMoveTimeRef.current;
        if (holdTime >= 95) {
          futureEchoAlpha = Math.min(1.0, (holdTime - 95) / 80);
          if (futureEchoAlpha < 1.0) {
            if (echoAnimFrameRef.current) cancelAnimationFrame(echoAnimFrameRef.current);
            echoAnimFrameRef.current = requestAnimationFrame(() => renderCurrent());
          }
        } else {
          futureEchoAlpha = 0;
        }
      } else {
        futureEchoAlpha = readyFadeAlpha;
      }
    }

    rendererRef.current.render({
      state: stateRef.current,
      future: suppressAimAndFuture ? null : futureRef.current,
      aimAngle: suppressAimAndFuture ? null : angleRef.current,
      launcherRecoil: launcherRecoilRef.current,
      launcherSettle: launcherSettleRef.current,
      hitEffects: hitEffectsRef.current,
      destructionEffects: destructionEffectsRef.current,
      trajectoryTransition: trajectoryTransitionRef.current,
      boardTransition: boardTransitionRef.current,
      readyFadeAlpha,
      futureEchoAlpha,
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
  const updateFutureDOM = useCallback((p: FuturePreview | null, _r: number, calculating = false) => {
    if (!futureTextRef.current) return;
    if (stateRef.current.stageStatus === 'failed') {
      futureTextRef.current.innerHTML = '<span class="text-rose-400 font-semibold tracking-wider">GAME OVER · DANGER REACHED</span>';
      return;
    }
    if (stateRef.current.stageStatus === 'won') {
      futureTextRef.current.innerHTML = '<span class="text-amber-400 font-semibold tracking-wider">STAGE CLEAR</span>';
      return;
    }
    if (calculating || !p) {
      futureTextRef.current.innerHTML = '<span class="opacity-40">Calculating…</span>';
    } else {
      const parts = [
        `${p.damage} dmg`,
        `${p.destroyed} destroyed`,
      ];
      if (p.ballPickupsCollected > 0) {
        parts.push(`<span class="text-emerald-400 font-semibold">+${p.ballPickupsCollected} BALL${p.ballPickupsCollected > 1 ? 'S' : ''}</span>`);
      }
      futureTextRef.current.innerHTML = `<span>${parts.join(' · ')}</span>`;
    }
  }, []);

  // Authoritative future calculation (decoupled from direct finger tracking)
  const computeAuthoritativeFuture = useCallback((stateToPreview: GameState, targetAngle: number) => {
    if (runningRef.current || transitioningRef.current || stateToPreview.stageStatus !== 'active') return;
    try {
      const prevFuture = futureRef.current;
      const p = previewFuture(stateToPreview, targetAngle, { record: true }) as FuturePreview;
      const r = analyzeRobustness(stateToPreview, targetAngle).percent;

      // Clean 80ms trajectory cross-fade transition between authoritative future updates
      if (prevFuture?.trajectories?.ball0 && p.trajectories?.ball0) {
        trajectoryTransitionRef.current = {
          prevPoints: prevFuture.trajectories.ball0,
          currPoints: p.trajectories.ball0,
          startTime: performance.now(),
          duration: 80,
        };
      } else {
        trajectoryTransitionRef.current = null;
      }

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
    if (echoCheckTimerRef.current) clearTimeout(echoCheckTimerRef.current);
    if (echoAnimFrameRef.current) cancelAnimationFrame(echoAnimFrameRef.current);
    lastAngleMoveTimeRef.current = 0;

    const idx = (newIndex + levelKeys.length) % levelKeys.length;
    const newState = createGameState(LEVELS[levelKeys[idx]]);
    setLevelIndex(idx);
    setGameState(newState);
    stateRef.current = newState;
    setIsRunning(false);
    runningRef.current = false;
    setIsTransitioning(false);
    transitioningRef.current = false;
    setIsAiming(false);
    aimingRef.current = false;
    futureRef.current = null;
    hitEffectsRef.current.clear();
    destructionEffectsRef.current = [];
    launcherRecoilRef.current = null;
    launcherSettleRef.current = null;
    trajectoryTransitionRef.current = null;
    boardTransitionRef.current = null;
    readyFadeStartRef.current = performance.now();

    if (angleTextRef.current) {
      angleTextRef.current.textContent = `${angleRef.current.toFixed(1)}°`;
      angleTextRef.current.classList.remove('angle-active');
    }

    scheduleFutureRecomputation(angleRef.current, true);
  }, [scheduleFutureRecomputation]);

  // Map pointer client coordinates to launch angle within canonical 5°–175° range
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

  // Launch turn simulation with calibrated visual hierarchy and volley-end timing
  const playTurn = useCallback((selectedAngle: number) => {
    if (echoCheckTimerRef.current) clearTimeout(echoCheckTimerRef.current);
    if (echoAnimFrameRef.current) cancelAnimationFrame(echoAnimFrameRef.current);

    setIsRunning(true);
    runningRef.current = true;

    // Instant removal of all prediction visuals on shot commitment (0 residue)
    futureRef.current = null;
    trajectoryTransitionRef.current = null;
    launcherSettleRef.current = null;
    readyFadeStartRef.current = 0;
    updateFutureDOM(null, 100, true);

    // Subtle launcher compression and release impulse (~110ms)
    launcherRecoilRef.current = {
      time: performance.now(),
      angleDeg: selectedAngle,
      duration: 110,
    };

    // Authoritative Simulation: identical canonical configuration shared across Gameplay, Preview, Solver, and Replay
    const sim = new Simulation(stateRef.current, selectedAngle, PHYSICS_CONFIG, { record: false });

    // Presentation stepping & interpolation state
    const fixedDt = PHYSICS_CONFIG.fixedDt; // Canonical 1/60s
    accumulatorRef.current = 0;
    lastTimeRef.current = performance.now();
    prevBallsMapRef.current.clear();
    hitEffectsRef.current.clear();
    destructionEffectsRef.current = [];

    const volleyStartTime = performance.now();
    let currentTier: 'NORMAL' | 'TAIL' | 'RAPID_TAIL' = 'NORMAL';
    let tail2xStartTime: number | null = null;
    let currentPresentationSpeed = 1.0;

    interface ReturningBall {
      id: string;
      startX: number;
      targetX: number;
      startTime: number;
      duration: number;
    }
    const returningBalls: ReturningBall[] = [];

    const blockMap = new Map<string, Block>(stateRef.current.blocks.map((b) => [b.id, b]));

    function frame(now: number) {
      const rawDt = Math.min((now - lastTimeRef.current) / 1000, 0.08); // Bound dt to avoid spiral
      lastTimeRef.current = now;

      // Evaluate presentation acceleration dynamically for long volley tails
      const elapsedRealSeconds = (now - volleyStartTime) / 1000;
      const activeBallsCount = sim.balls.filter((b) => b.active).length;
      const exitedBallsCount = sim.balls.filter((b) => b.spawned && !b.active).length;
      const totalBalls = sim.balls.length;
      const allSpawned = sim.balls.every((b) => b.spawned);

      const speedEval = evaluatePresentationSpeed({
        elapsedRealSeconds,
        activeBallsCount,
        exitedBallsCount,
        totalBalls,
        allSpawned,
        currentTier,
        tail2xStartTime,
      });

      if (currentTier === 'NORMAL' && speedEval.tier === 'TAIL') {
        tail2xStartTime = elapsedRealSeconds;
      }
      if (speedEval.tier !== currentTier) {
        currentTier = speedEval.tier;
        setPlaybackTier(speedEval.tier);
      }
      currentPresentationSpeed = speedEval.speed;

      accumulatorRef.current += rawDt * currentPresentationSpeed;

      // Authoritative fixed-step progression
      while (accumulatorRef.current >= fixedDt && !sim.finished) {
        // Snapshot positions before stepping
        for (const b of sim.balls) {
          prevBallsMapRef.current.set(b.id, { x: b.x, y: b.y, active: b.active });
        }

        const eventsBefore = sim.events.length;
        sim.step();
        const eventsAfter = sim.events.length;

        // Process discrete events with capped heavy-volley damping
        for (let i = eventsBefore; i < eventsAfter; i += 1) {
          const ev = sim.events[i];
          if (ev.type === 'BlockCollision' && ev.blockId) {
            const existing = hitEffectsRef.current.get(ev.blockId);
            const timeSinceLast = existing ? now - existing.time : 999;
            const isRapid = timeSinceLast < 60;
            hitEffectsRef.current.set(ev.blockId, {
              time: now,
              duration: isRapid ? 65 : 80,
              intensity: isRapid ? 0.6 : 1.0,
            });
          } else if (ev.type === 'BlockDestroyed' && ev.blockId) {
            const blk = blockMap.get(ev.blockId) || (sim.blocks as Block[]).find((b: Block) => b.id === ev.blockId);
            if (blk) {
              destructionEffectsRef.current.push({
                block: { ...blk },
                time: now,
                duration: 100, // Quick, restrained 100ms exit
              });
            }
          } else if (ev.type === 'BallExited' && ev.ballId) {
            const targetX = clampLauncherX(sim.firstExitX != null ? sim.firstExitX : stateRef.current.launcher.x);
            const exitX = typeof ev.x === 'number' ? ev.x : targetX;
            const startX = clampLauncherX(exitX);
            const baseDuration = Math.abs(startX - targetX) < 4 ? 40 : 160;
            returningBalls.push({
              id: ev.ballId,
              startX,
              targetX,
              startTime: now,
              duration: baseDuration / currentPresentationSpeed,
            });
          }
        }

        accumulatorRef.current -= fixedDt;
      }

      // Compute interpolation factor alpha between previous and current physics step
      const alpha = sim.finished ? 1.0 : Math.max(0, Math.min(1, accumulatorRef.current / fixedDt));

      // Construct visual ball representations with sub-frame interpolation and stable flight size
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

        visualBalls.push({
          id: b.id,
          x: posX,
          y: posY,
          vx: b.vx,
          vy: b.vy,
          radius: b.radius, // Stable size 6 throughout flight
        });
      }

      // Smooth horizontal convergence of returning balls toward the first-exit return point
      for (const rb of returningBalls) {
        const elapsed = now - rb.startTime;
        if (elapsed < rb.duration) {
          const p = Math.min(1.0, elapsed / rb.duration);
          const ease = 1 - Math.pow(1 - p, 2);
          const currentX = rb.startX + (rb.targetX - rb.startX) * ease;
          visualBalls.push({
            id: rb.id,
            x: currentX,
            y: stateRef.current.launcher.y,
            vx: 0,
            vy: 0,
            radius: PHYSICS_CONFIG.ballRadius,
          });
        }
      }

      // Clean up finished destruction effects
      destructionEffectsRef.current = destructionEffectsRef.current.filter(
        (e) => now - e.time < e.duration
      );

      // Return point indicator target if established
      const returnPoint = sim.firstExitX != null
        ? { x: clampLauncherX(sim.firstExitX), y: stateRef.current.launcher.y }
        : null;

      // Render the interpolated frame
      if (rendererRef.current) {
        rendererRef.current.render({
          state: { ...stateRef.current, blocks: sim.blocks, pickups: sim.pickups },
          liveBalls: visualBalls,
          aimAngle: null,
          launcherRecoil: launcherRecoilRef.current,
          launcherSettle: launcherSettleRef.current,
          hitEffects: hitEffectsRef.current,
          destructionEffects: destructionEffectsRef.current,
          returnPoint,
          readyFadeAlpha: 0,
          now,
        });
      }

      const allExitEffectsDone = destructionEffectsRef.current.length === 0;
      const allReturningDone = returningBalls.length === 0 || returningBalls.every((rb) => now - rb.startTime >= rb.duration);

      if (!sim.finished || !allExitEffectsDone || !allReturningDone) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        // Volley End State: Authoritative turn completion
        const result = sim.result();

        if (!result.completed || result.watchdogTriggered || result.timedOut) {
          // Engine watchdog diagnostic: abort progression and restore ready state without advancing board
          console.error('[Engine Watchdog] Simulation exceeded deterministic safety guard without natural completion.', result);
          setIsRunning(false);
          setPlaybackTier('NORMAL');
          runningRef.current = false;
          hitEffectsRef.current.clear();
          destructionEffectsRef.current = [];
          launcherRecoilRef.current = null;
          readyFadeStartRef.current = performance.now();
          scheduleFutureRecomputation(angleRef.current, true);
          renderCurrent();
          return;
        }

        const prevBlocks = stateRef.current.blocks;
        const prevPickups = stateRef.current.pickups;
        const nextState = applyTurnResult(stateRef.current, result);
        setGameState(nextState);
        stateRef.current = nextState;

        setIsRunning(false);
        setPlaybackTier('NORMAL');
        runningRef.current = false;
        hitEffectsRef.current.clear();
        destructionEffectsRef.current = [];
        launcherRecoilRef.current = null;

        // Presentation board descent transition (target ~180–260ms, calibrated to 220ms)
        const transStart = performance.now();
        const transDuration = 220;
        boardTransitionRef.current = {
          fromBlocks: prevBlocks,
          toBlocks: nextState.blocks,
          fromPickups: prevPickups,
          toPickups: nextState.pickups,
          startTime: transStart,
          duration: transDuration,
        };
        launcherSettleRef.current = { time: transStart, duration: transDuration };
        setIsTransitioning(true);
        transitioningRef.current = true;

        function transitionLoop(transNow: number) {
          const elapsed = transNow - transStart;
          if (elapsed < transDuration) {
            renderCurrent();
            animFrameRef.current = requestAnimationFrame(transitionLoop);
          } else {
            // Presentation descent complete
            boardTransitionRef.current = null;
            launcherSettleRef.current = null;
            setIsTransitioning(false);
            transitioningRef.current = false;

            if (nextState.stageStatus === 'active') {
              readyFadeStartRef.current = performance.now();
              scheduleFutureRecomputation(angleRef.current, true);
            } else {
              futureRef.current = null;
              updateFutureDOM(null, 0, false);
              renderCurrent();
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(transitionLoop);
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }, [renderCurrent, scheduleFutureRecomputation, updateFutureDOM]);

  // Direct, immediate pointer interaction handlers (0 latency)
  const isTerminalState = () => stateRef.current.stageStatus !== 'active';

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (runningRef.current || transitioningRef.current || isTerminalState()) return;

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
    lastScrubAngleRef.current = newAngle;
    lastAngleMoveTimeRef.current = performance.now();

    if (echoCheckTimerRef.current) clearTimeout(echoCheckTimerRef.current);
    if (echoAnimFrameRef.current) cancelAnimationFrame(echoAnimFrameRef.current);

    // Fade in Future Echo if player holds stable angle for ~85-120ms
    echoCheckTimerRef.current = setTimeout(() => {
      if (aimingRef.current) {
        const startFade = performance.now();
        const duration = 90;
        function stepFade(fadeNow: number) {
          if (!aimingRef.current) return;
          renderCurrent();
          if (fadeNow - startFade < duration) {
            echoAnimFrameRef.current = requestAnimationFrame(stepFade);
          }
        }
        echoAnimFrameRef.current = requestAnimationFrame(stepFade);
      }
    }, 85);

    if (angleTextRef.current) {
      angleTextRef.current.textContent = `${newAngle.toFixed(1)}°`;
      angleTextRef.current.classList.add('angle-active');
    }

    // Immediate visual aim line update
    renderCurrent();

    // Schedule authoritative future calculation
    scheduleFutureRecomputation(newAngle, false);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimingRef.current || event.pointerId !== pointerIdRef.current || runningRef.current || transitioningRef.current || isTerminalState()) return;

    const newAngle = pointerToAngle(event.clientX, event.clientY);
    const angleDiff = Math.abs(newAngle - lastScrubAngleRef.current);
    if (angleDiff > 0.25) {
      lastScrubAngleRef.current = newAngle;
      lastAngleMoveTimeRef.current = performance.now();
    }
    angleRef.current = newAngle;

    if (echoCheckTimerRef.current) clearTimeout(echoCheckTimerRef.current);
    if (echoAnimFrameRef.current) cancelAnimationFrame(echoAnimFrameRef.current);

    // Schedule reveal timer when scrubbing pauses
    echoCheckTimerRef.current = setTimeout(() => {
      if (aimingRef.current) {
        const startFade = performance.now();
        const duration = 90;
        function stepFade(fadeNow: number) {
          if (!aimingRef.current) return;
          renderCurrent();
          if (fadeNow - startFade < duration) {
            echoAnimFrameRef.current = requestAnimationFrame(stepFade);
          }
        }
        echoAnimFrameRef.current = requestAnimationFrame(stepFade);
      }
    }, 85);

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
    if (!aimingRef.current || event.pointerId !== pointerIdRef.current || runningRef.current || transitioningRef.current || isTerminalState()) return;

    if (echoCheckTimerRef.current) clearTimeout(echoCheckTimerRef.current);
    if (echoAnimFrameRef.current) cancelAnimationFrame(echoAnimFrameRef.current);

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

      {/* Subtle rapid tail 6x acceleration badge */}
      {isRunning && playbackTier === 'RAPID_TAIL' && (
        <div className="rapid-tail-badge" aria-label="Rapid tail acceleration active">
          6×
        </div>
      )}

      {/* Onboarding hint: renders only before first user interaction */}
      {!hasInteracted && (
        <div className="gesture">
          DRAG ON THE FIELD TO EXPLORE A FUTURE
          <br />
          RELEASE TO CHOOSE IT
        </div>
      )}

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
          TURN {gameState.turn}
          {gameState.stageStatus === 'won'
            ? ' · STAGE CLEAR'
            : (gameState.stageStatus === 'failed' ? ' · FAILED' : '')}
          {gameState.stageStatus === 'active' && gameState.totalWaves > 0
            ? ` · WAVE ${Math.min(gameState.waveIndex + 1, gameState.totalWaves)}/${gameState.totalWaves}`
            : ''}
        </div>
      </footer>
    </main>
  );
};

export default App;
