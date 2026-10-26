import { PHYSICS_CONFIG, PROGRESSION_CONFIG } from '../config.js';
import { fitWorld } from './viewport.js';
import type { GameState, FuturePreview, Block, BallPickup, Launcher, Vector2D } from '../types.js';

export interface VisualBall {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity?: number;
}

export interface BlockHitEffect {
  time: number;
  duration: number;
  intensity?: number;
}

export interface BlockDestructionEffect {
  block: Block;
  time: number;
  duration: number;
}

export interface TrajectoryTransition {
  prevPoints: Vector2D[] | null;
  currPoints: Vector2D[];
  startTime: number;
  duration: number;
}

export interface BoardTransition {
  fromBlocks: Block[];
  toBlocks: Block[];
  fromPickups?: BallPickup[];
  toPickups?: BallPickup[];
  startTime: number;
  duration: number;
}

export interface RenderOptions {
  state: GameState;
  liveBalls?: VisualBall[] | null;
  future?: FuturePreview | null;
  aimAngle?: number | null;
  launcherRecoil?: { time: number; angleDeg: number; duration: number } | null;
  launcherSettle?: { time: number; duration: number } | null;
  hitEffects?: Map<string, BlockHitEffect> | null;
  destructionEffects?: BlockDestructionEffect[] | null;
  trajectoryTransition?: TrajectoryTransition | null;
  boardTransition?: BoardTransition | null;
  returnPoint?: { x: number; y: number } | null;
  readyFadeAlpha?: number;
  now?: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to acquire 2D canvas context');
    }
    this.ctx = context;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render({
    state,
    liveBalls = null,
    future = null,
    aimAngle = null,
    launcherRecoil = null,
    launcherSettle = null,
    hitEffects = null,
    destructionEffects = null,
    trajectoryTransition = null,
    boardTransition = null,
    returnPoint = null,
    readyFadeAlpha = 1.0,
    now = performance.now(),
  }: RenderOptions): void {
    const ctx = this.ctx;
    const fit = fitWorld(this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Letterbox margin fill
    ctx.fillStyle = '#030508';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Transform to canonical 720x1280 world
    ctx.translate(fit.offsetX, fit.offsetY);
    ctx.scale(fit.scale, fit.scale);

    // Playfield background: deep, calm, uniform dark court
    ctx.fillStyle = '#080c13';
    ctx.fillRect(0, 0, PHYSICS_CONFIG.canvasWidth, PHYSICS_CONFIG.canvasHeight);

    // Clean boundary perimeter
    this.drawBoundary(ctx);

    // Danger line threshold boundary
    const isFailed = state.stageStatus === 'failed';
    const isWon = state.stageStatus === 'won';
    const isTerminal = state.stageStatus !== 'active';
    this.drawDangerLine(ctx, isFailed);

    // Hierarchy 3: Quiet, restrained ghost-ball trajectory preview behind blocks
    // Suppressed during committed volley, board transition, or terminal stage
    if (future?.trajectories && !isTerminal && !boardTransition) {
      this.drawTrajectoryPreview(ctx, future.trajectories, trajectoryTransition, readyFadeAlpha, now);
    }

    // Direct aim guide from launcher
    if (aimAngle != null && !isTerminal && !boardTransition) {
      this.drawAim(ctx, state.launcher, aimAngle, readyFadeAlpha);
    }

    // Hierarchy 2: Blocks and their state changes with capped hit feedback & descent interpolation
    this.drawBlocks(ctx, state.blocks, future, hitEffects, boardTransition, now);

    // Board pickups (+1 Ball tokens)
    this.drawPickups(ctx, state.pickups, future, boardTransition, now);

    // Destruction exit animations (restrained micro-scale and fade)
    if (destructionEffects && destructionEffects.length > 0) {
      this.drawDestructionEffects(ctx, destructionEffects, now);
    }

    // Launcher origin point with subtle recoil and settle responses
    this.drawLauncher(ctx, state.launcher, state.balls.available, launcherRecoil, launcherSettle, now);

    // Return point indicator if established during volley
    if (returnPoint) {
      this.drawReturnPoint(ctx, returnPoint);
    }

    // Hierarchy 1: Live moving balls (primary kinetic object with high visual contrast)
    if (liveBalls && liveBalls.length > 0) {
      this.drawBalls(ctx, liveBalls);
    }

    // Terminal stage presentations
    if (isWon) {
      this.drawVictoryOverlay(ctx);
    } else if (isFailed) {
      this.drawFailureOverlay(ctx);
    }

    ctx.restore();
  }

  private drawReturnPoint(ctx: CanvasRenderingContext2D, point: { x: number; y: number }): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(95, 210, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(95, 210, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBoundary(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, PHYSICS_CONFIG.canvasWidth - 16, PHYSICS_CONFIG.canvasHeight - 16);

    ctx.strokeStyle = 'rgba(95, 210, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(PHYSICS_CONFIG.canvasWidth - 8, 8);
    ctx.stroke();

    ctx.restore();
  }

  private drawDangerLine(ctx: CanvasRenderingContext2D, isFailed = false): void {
    ctx.save();
    const y = PROGRESSION_CONFIG.dangerLineY;
    ctx.strokeStyle = isFailed ? 'rgba(239, 68, 68, 0.85)' : 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = isFailed ? 2.5 : 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(PHYSICS_CONFIG.canvasWidth - 8, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = isFailed ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.38)';
    ctx.font = '700 11px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('DANGER LINE', PHYSICS_CONFIG.canvasWidth - 14, y - 4);

    ctx.restore();
  }

  private drawFailureOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const y = PROGRESSION_CONFIG.dangerLineY;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(8, y, PHYSICS_CONFIG.canvasWidth - 16, PHYSICS_CONFIG.canvasHeight - y - 16);

    const badgeW = 300;
    const badgeH = 54;
    const badgeX = (PHYSICS_CONFIG.canvasWidth - badgeW) / 2;
    const badgeY = y - 76;

    ctx.fillStyle = 'rgba(15, 17, 26, 0.94)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 1.5;
    this.fillAndStrokeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);

    ctx.fillStyle = '#f87171';
    ctx.font = '800 14px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DANGER LINE BREACHED', PHYSICS_CONFIG.canvasWidth / 2, badgeY + 19);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('PRESS ↻ TO RESTART LEVEL', PHYSICS_CONFIG.canvasWidth / 2, badgeY + 36);

    ctx.restore();
  }

  private drawVictoryOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const badgeW = 280;
    const badgeH = 54;
    const badgeX = (PHYSICS_CONFIG.canvasWidth - badgeW) / 2;
    const badgeY = 560;

    ctx.fillStyle = 'rgba(15, 17, 26, 0.94)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
    ctx.lineWidth = 1.5;
    this.fillAndStrokeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);

    ctx.fillStyle = '#34d399';
    ctx.font = '800 14px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STAGE CLEAR', PHYSICS_CONFIG.canvasWidth / 2, badgeY + 19);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('ALL WAVES COMPLETED', PHYSICS_CONFIG.canvasWidth / 2, badgeY + 36);

    ctx.restore();
  }

  private drawBlocks(
    ctx: CanvasRenderingContext2D,
    blocks: Block[],
    future: FuturePreview | null,
    hitEffects: Map<string, BlockHitEffect> | null,
    boardTransition: BoardTransition | null,
    now: number
  ): void {
    const fromMap = boardTransition ? new Map(boardTransition.fromBlocks.map((b) => [b.id, b])) : null;
    let transitionProgress = 1.0;
    let isTransitioning = false;

    if (boardTransition && now - boardTransition.startTime < boardTransition.duration) {
      isTransitioning = true;
      transitionProgress = Math.min(1.0, (now - boardTransition.startTime) / boardTransition.duration);
    }

    const ease = 1 - Math.pow(1 - transitionProgress, 3);
    const finalById = (future && !isTransitioning) ? new Map(future.result.finalBlocks.map((b) => [b.id, b])) : null;

    for (const block of blocks) {
      if (!block.active) continue;

      let renderX = block.x;
      let renderY = block.y;
      let blockOpacity = 1.0;

      if (isTransitioning) {
        const from = fromMap?.get(block.id);
        if (from) {
          renderY = from.y + (block.y - from.y) * ease;
        } else {
          const startY = block.y - PROGRESSION_CONFIG.rowStep;
          renderY = startY + (block.y - startY) * ease;
          blockOpacity = ease;
        }
      }

      const after = finalById?.get(block.id);
      const projectedDamage = after ? Math.max(0, block.value - (after.active ? after.value : 0)) : 0;
      const projectedDestroyed = after ? !after.active : false;

      ctx.save();
      if (blockOpacity < 1.0) {
        ctx.globalAlpha = blockOpacity;
      }

      // Capped hit feedback: damped flash and subtle scale (never washes out numbers)
      let scale = 1.0;
      let flash = 0;
      if (hitEffects && hitEffects.has(block.id)) {
        const hit = hitEffects.get(block.id)!;
        const elapsed = now - hit.time;
        if (elapsed < hit.duration) {
          const progress = elapsed / hit.duration;
          const intensity = hit.intensity ?? 1.0;
          scale = 1.0 + Math.sin(progress * Math.PI) * 0.025 * intensity;
          flash = Math.min(0.12, (1 - progress) * 0.12 * intensity);
        }
      }

      const centerX = renderX + block.width / 2;
      const centerY = renderY + block.height / 2;
      if (scale !== 1.0) {
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);
      }

      const radius = 6;

      if (projectedDestroyed) {
        // Destroyed: Clean amber state, instantly recognizable
        ctx.fillStyle = flash > 0 ? `rgba(251, 191, 36, ${0.18 + flash})` : 'rgba(245, 158, 11, 0.18)';
        ctx.strokeStyle = flash > 0 ? '#fef08a' : '#f59e0b';
        ctx.lineWidth = 2;
        this.fillAndStrokeRoundedRect(ctx, renderX, renderY, block.width, block.height, radius);

        // Bold amber "0" indicating imminent destruction
        ctx.fillStyle = flash > 0 ? '#fef08a' : '#fbbf24';
        ctx.font = '800 20px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0', centerX, centerY);

      } else if (projectedDamage > 0) {
        // Damaged: Subtle teal highlight with clear remaining durability
        ctx.fillStyle = flash > 0 ? `rgba(94, 234, 212, ${0.16 + flash})` : 'rgba(45, 212, 191, 0.16)';
        ctx.strokeStyle = flash > 0 ? '#99f6e4' : 'rgba(45, 212, 191, 0.7)';
        ctx.lineWidth = 2;
        this.fillAndStrokeRoundedRect(ctx, renderX, renderY, block.width, block.height, radius);

        const remainingHP = after?.active ? after.value : 0;

        ctx.fillStyle = '#f0fdfa';
        ctx.font = '800 20px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(remainingHP), centerX, centerY - 4);

        ctx.fillStyle = '#2dd4bf';
        ctx.font = '700 11px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText(`-${projectedDamage}`, centerX, centerY + 13);

      } else {
        // Unaffected: Visually recedes slightly, solid and readable
        ctx.fillStyle = flash > 0 ? `rgba(56, 189, 248, ${0.25 + flash})` : 'rgba(18, 28, 42, 0.8)';
        ctx.strokeStyle = flash > 0 ? '#7dd3fc' : 'rgba(70, 95, 120, 0.35)';
        ctx.lineWidth = 1.5;
        this.fillAndStrokeRoundedRect(ctx, renderX, renderY, block.width, block.height, radius);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '700 21px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(block.value), centerX, centerY);
      }

      ctx.restore();
    }
  }

  private drawDestructionEffects(
    ctx: CanvasRenderingContext2D,
    effects: BlockDestructionEffect[],
    now: number
  ): void {
    for (const effect of effects) {
      const elapsed = now - effect.time;
      if (elapsed >= effect.duration) continue;

      const progress = elapsed / effect.duration;
      const opacity = Math.max(0, (1 - progress) * 0.8);
      const scale = 1.0 + progress * 0.05;
      const block = effect.block;
      const centerX = block.x + block.width / 2;
      const centerY = block.y + block.height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);

      // Subtle expanding amber fade
      ctx.strokeStyle = `rgba(251, 191, 36, ${opacity})`;
      ctx.fillStyle = `rgba(245, 158, 11, ${opacity * 0.25})`;
      ctx.lineWidth = 1.5;
      this.fillAndStrokeRoundedRect(ctx, block.x, block.y, block.width, block.height, 6);

      // 4 tiny restrained corner fragments separating outward by 5px
      const offset = progress * 5;
      ctx.fillStyle = `rgba(251, 191, 36, ${opacity * 0.8})`;
      const fragSize = 2;
      ctx.fillRect(block.x - offset, block.y - offset, fragSize, fragSize);
      ctx.fillRect(block.x + block.width + offset - fragSize, block.y - offset, fragSize, fragSize);
      ctx.fillRect(block.x - offset, block.y + block.height + offset - fragSize, fragSize, fragSize);
      ctx.fillRect(block.x + block.width + offset - fragSize, block.y + block.height + offset - fragSize, fragSize, fragSize);

      ctx.restore();
    }
  }

  private fillAndStrokeRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Reference Motion Calibration: Quieted ghost-ball trajectory.
   * Increased spacing (38 units), smaller radius (2.0px), reduced opacity post-rebound,
   * and capped visible count (26 markers).
   */
  private drawTrajectoryPreview(
    ctx: CanvasRenderingContext2D,
    trajectories: Record<string, Vector2D[]>,
    transition: TrajectoryTransition | null,
    readyFadeAlpha: number,
    now: number
  ): void {
    const ids = Object.keys(trajectories);
    const primaryPoints = trajectories[ids[0]];
    if (!primaryPoints || primaryPoints.length < 2) return;

    ctx.save();

    // Check if smooth transition cross-fade is active
    if (transition && transition.prevPoints && transition.prevPoints.length >= 2) {
      const elapsed = now - transition.startTime;
      if (elapsed < transition.duration) {
        const t = elapsed / transition.duration;
        this.renderGhostPath(ctx, transition.prevPoints, (1 - t) * readyFadeAlpha);
        this.renderGhostPath(ctx, transition.currPoints, t * readyFadeAlpha);
        ctx.restore();
        return;
      }
    }

    // Steady-state ghost path
    this.renderGhostPath(ctx, primaryPoints, readyFadeAlpha);

    ctx.restore();
  }

  /**
   * Renders ghost-ball markers along the authoritative trajectory polyline with restored readability.
   */
  private renderGhostPath(ctx: CanvasRenderingContext2D, points: Vector2D[], alphaMultiplier: number): void {
    if (points.length < 2 || alphaMultiplier <= 0.01) return;

    const SPACING = 34; // Dotted ghost-ball spacing
    const MARKER_RADIUS = 2.35; // Target radius: 2.3–2.4 world units
    const MAX_MARKERS = 32; // Marker count cap

    // Detect first rebound distance along points to drop opacity on subsequent legs
    let firstReboundDist = Infinity;
    let distSoFar = 0;
    for (let i = 1; i < points.length - 1; i += 1) {
      const pPrev = points[i - 1];
      const pCurr = points[i];
      const pNext = points[i + 1];
      const segLen = Math.hypot(pCurr.x - pPrev.x, pCurr.y - pPrev.y);
      distSoFar += segLen;
      const dx1 = pCurr.x - pPrev.x;
      const dy1 = pCurr.y - pPrev.y;
      const dx2 = pNext.x - pCurr.x;
      const dy2 = pNext.y - pCurr.y;
      const dot = dx1 * dx2 + dy1 * dy2;
      const mag = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2);
      if (mag > 0 && dot / mag < 0.85) {
        firstReboundDist = distSoFar;
        break;
      }
    }

    let accumulatedDist = 0;
    let nextMarkerDist = SPACING;
    let markerIndex = 0;

    for (let i = 0; i < points.length - 1; i += 1) {
      const pA = points[i];
      const pB = points[i + 1];
      const segDx = pB.x - pA.x;
      const segDy = pB.y - pA.y;
      const segLen = Math.hypot(segDx, segDy);
      if (segLen < 1e-6) continue;

      while (accumulatedDist + segLen >= nextMarkerDist && markerIndex < MAX_MARKERS) {
        const t = (nextMarkerDist - accumulatedDist) / segLen;
        const mx = pA.x + segDx * t;
        const my = pA.y + segDy * t;

        // Calibrated opacity hierarchy:
        // First leg: approximately 0.62–0.68
        // Post-rebound leg: approximately 0.30–0.35, gently tapering with distance, staying practically readable
        let baseOpacity: number;
        if (nextMarkerDist <= firstReboundDist) {
          const legProgress = Math.min(1.0, nextMarkerDist / Math.max(1, firstReboundDist));
          baseOpacity = 0.68 - legProgress * 0.06; // 0.68 -> 0.62
        } else {
          const postDist = nextMarkerDist - firstReboundDist;
          const postProgress = Math.min(1.0, postDist / 1200);
          baseOpacity = 0.35 - postProgress * 0.09; // 0.35 -> 0.26
        }

        const markerOpacity = baseOpacity * alphaMultiplier;

        ctx.fillStyle = `rgba(45, 212, 191, ${markerOpacity})`;
        ctx.beginPath();
        ctx.arc(mx, my, MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        markerIndex += 1;
        nextMarkerDist += SPACING;
      }

      accumulatedDist += segLen;
      if (markerIndex >= MAX_MARKERS) break;
    }

    // Rebound contact readability: slightly clearer, restrained ring at deflection vertices
    for (let i = 1; i < points.length - 1; i += 1) {
      const pPrev = points[i - 1];
      const pCurr = points[i];
      const pNext = points[i + 1];
      const dx1 = pCurr.x - pPrev.x;
      const dy1 = pCurr.y - pPrev.y;
      const dx2 = pNext.x - pCurr.x;
      const dy2 = pNext.y - pCurr.y;
      const dot = dx1 * dx2 + dy1 * dy2;
      const mag = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2);
      if (mag > 0 && dot / mag < 0.85) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.75 * alphaMultiplier})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(pCurr.x, pCurr.y, 3.2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(45, 212, 191, ${0.72 * alphaMultiplier})`;
        ctx.beginPath();
        ctx.arc(pCurr.x, pCurr.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawAim(ctx: CanvasRenderingContext2D, launcher: Launcher, angleDeg: number, alphaMultiplier: number): void {
    ctx.save();
    const theta = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // Initial 2 clearly visible ghost markers along aim angle (0.62–0.68 range)
    const step = 34;
    for (let i = 1; i <= 2; i += 1) {
      const dist = i * step;
      const dotX = launcher.x + dist * cos;
      const dotY = launcher.y - dist * sin;
      ctx.fillStyle = `rgba(45, 212, 191, ${(0.68 - i * 0.05) * alphaMultiplier})`;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawLauncher(
    ctx: CanvasRenderingContext2D,
    launcher: Launcher,
    ballCount: number,
    recoil: { time: number; angleDeg: number; duration: number } | null,
    settle: { time: number; duration: number } | null,
    now: number
  ): void {
    ctx.save();

    let drawX = launcher.x;
    let drawY = launcher.y;
    let radius = 7;
    let haloOpacity = 0.15;

    // Subtle tactile launch recoil (~110ms)
    if (recoil) {
      const elapsed = now - recoil.time;
      if (elapsed < recoil.duration) {
        const p = elapsed / recoil.duration;
        const recoilDist = Math.sin(p * Math.PI) * 3.0;
        const theta = (recoil.angleDeg * Math.PI) / 180;
        drawX -= recoilDist * Math.cos(theta);
        drawY += recoilDist * Math.sin(theta);
        radius = 7 + Math.sin(p * Math.PI) * 1.2;
      }
    }

    // Volley end settle transition (~95ms)
    if (settle) {
      const elapsed = now - settle.time;
      if (elapsed < settle.duration) {
        const p = elapsed / settle.duration;
        radius = 7 + Math.sin(p * Math.PI) * 0.8;
        haloOpacity = 0.15 + Math.sin(p * Math.PI) * 0.2;
      }
    }

    // Outer subtle guide ring
    ctx.strokeStyle = `rgba(255, 255, 255, ${haloOpacity})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(drawX, drawY, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Center launcher ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Clean, understated ball count label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 17px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${ballCount}`, launcher.x + 16, launcher.y);

    ctx.restore();
  }

  private drawPickups(
    ctx: CanvasRenderingContext2D,
    pickups: BallPickup[] | undefined,
    future: FuturePreview | null,
    boardTransition: BoardTransition | null,
    now: number
  ): void {
    if (!pickups || pickups.length === 0) return;

    const fromMap = boardTransition?.fromPickups
      ? new Map(boardTransition.fromPickups.map((p) => [p.id, p]))
      : null;
    let transitionProgress = 1.0;
    let isTransitioning = false;

    if (boardTransition && now - boardTransition.startTime < boardTransition.duration) {
      isTransitioning = true;
      transitionProgress = Math.min(1.0, (now - boardTransition.startTime) / boardTransition.duration);
    }

    const ease = 1 - Math.pow(1 - transitionProgress, 3);
    const collectedSet = new Set(future?.result?.collectedPickups || []);

    for (const pickup of pickups) {
      if (!pickup.active) continue;

      let renderX = pickup.x;
      let renderY = pickup.y;
      let opacity = 1.0;

      if (isTransitioning) {
        const from = fromMap?.get(pickup.id);
        if (from) {
          renderY = from.y + (pickup.y - from.y) * ease;
        } else {
          const startY = pickup.y - PROGRESSION_CONFIG.rowStep;
          renderY = startY + (pickup.y - startY) * ease;
          opacity = ease;
        }
      }

      const willBeCollected = !isTransitioning && collectedSet.has(pickup.id);
      const radius = pickup.radius ?? 14;

      ctx.save();
      if (opacity < 1.0) {
        ctx.globalAlpha = opacity;
      }

      if (willBeCollected) {
        // Highlighted candidate acquisition state: subtle emerald ring and bright +1
        ctx.fillStyle = 'rgba(6, 78, 59, 0.45)';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(renderX, renderY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(renderX, renderY, radius - 3.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#6ee7b7';
        ctx.font = '800 11px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+1', renderX, renderY);
      } else {
        // Restrained standard token
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(95, 210, 255, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(renderX, renderY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 11px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+1', renderX, renderY);
      }

      ctx.restore();
    }
  }

  /**
   * Hierarchy 1: Live moving balls.
   * Solid, crisp white core with a clean subtle dark rim for high contrast over dark court and blocks.
   * Stable size, no trails, no glow field, no motion blur.
   */
  private drawBalls(ctx: CanvasRenderingContext2D, balls: VisualBall[]): void {
    ctx.save();

    for (const ball of balls) {
      const radius = ball.radius; // Stable size during flight

      // Solid brilliant white ball
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Clean 1px high-contrast perimeter edge ensuring crisp legibility over blocks
      ctx.strokeStyle = 'rgba(0, 5, 12, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}
