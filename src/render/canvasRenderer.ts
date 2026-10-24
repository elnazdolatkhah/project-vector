import { PHYSICS_CONFIG } from '../config.js';
import { fitWorld } from './viewport.js';
import type { GameState, FuturePreview, Block, Launcher, Vector2D } from '../types.js';

export interface VisualBall {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity?: number;
  scale?: number;
}

export interface BlockHitEffect {
  time: number;
  duration: number;
}

export interface BlockDestructionEffect {
  block: Block;
  time: number;
  duration: number;
}

export interface RenderOptions {
  state: GameState;
  liveBalls?: VisualBall[] | null;
  future?: FuturePreview | null;
  aimAngle?: number | null;
  launcherRecoil?: { time: number; angleDeg: number; duration: number } | null;
  hitEffects?: Map<string, BlockHitEffect> | null;
  destructionEffects?: BlockDestructionEffect[] | null;
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
    hitEffects = null,
    destructionEffects = null,
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

    // Trajectory paths rendered BEHIND blocks so prediction never obscures targets
    if (future?.trajectories) {
      this.drawTrajectories(ctx, future.trajectories);
    }

    // Direct aim guide from launcher
    if (aimAngle != null) {
      this.drawAim(ctx, state.launcher, aimAngle);
    }

    // Active blocks with hit feedback and diegetic consequence states
    this.drawBlocks(ctx, state.blocks, future, hitEffects, now);

    // Destruction exit animations (blocks in transit of breaking)
    if (destructionEffects && destructionEffects.length > 0) {
      this.drawDestructionEffects(ctx, destructionEffects, now);
    }

    // Launcher origin point with subtle recoil feel
    this.drawLauncher(ctx, state.launcher, state.balls.available, launcherRecoil, now);

    // Live animated balls with interpolation and stream rhythm
    if (liveBalls && liveBalls.length > 0) {
      this.drawBalls(ctx, liveBalls);
    }

    ctx.restore();
  }

  private drawBoundary(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Restrained court perimeter outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, PHYSICS_CONFIG.canvasWidth - 16, PHYSICS_CONFIG.canvasHeight - 16);

    // Top ceiling cushion hint
    ctx.strokeStyle = 'rgba(95, 210, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(PHYSICS_CONFIG.canvasWidth - 8, 8);
    ctx.stroke();

    ctx.restore();
  }

  private drawBlocks(
    ctx: CanvasRenderingContext2D,
    blocks: Block[],
    future: FuturePreview | null,
    hitEffects: Map<string, BlockHitEffect> | null,
    now: number
  ): void {
    const finalById = future ? new Map(future.result.finalBlocks.map((b) => [b.id, b])) : null;

    for (const block of blocks) {
      if (!block.active) continue;

      const after = finalById?.get(block.id);
      const projectedDamage = after ? Math.max(0, block.value - (after.active ? after.value : 0)) : 0;
      const projectedDestroyed = after ? !after.active : false;

      ctx.save();

      // Hit feedback: micro-compression and local flash (presentation only)
      let scale = 1.0;
      let flash = 0;
      if (hitEffects && hitEffects.has(block.id)) {
        const hit = hitEffects.get(block.id)!;
        const elapsed = now - hit.time;
        if (elapsed < hit.duration) {
          const progress = elapsed / hit.duration;
          scale = 1.0 + Math.sin(progress * Math.PI) * 0.06;
          flash = (1 - progress) * 0.45;
        }
      }

      const centerX = block.x + block.width / 2;
      const centerY = block.y + block.height / 2;
      if (scale !== 1.0) {
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);
      }

      const radius = 6;

      if (projectedDestroyed) {
        // Destroyed: Clean amber state, instantly recognizable without text clutter
        ctx.fillStyle = flash > 0 ? `rgba(251, 191, 36, ${0.18 + flash * 0.3})` : 'rgba(245, 158, 11, 0.18)';
        ctx.strokeStyle = flash > 0 ? '#fef08a' : '#f59e0b';
        ctx.lineWidth = 2;
        this.fillAndStrokeRoundedRect(ctx, block.x, block.y, block.width, block.height, radius);

        // Bold amber "0" indicating imminent clear
        ctx.fillStyle = flash > 0 ? '#fef08a' : '#fbbf24';
        ctx.font = '800 20px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0', centerX, centerY);

      } else if (projectedDamage > 0) {
        // Damaged: Subtle teal highlight with clear remaining durability
        ctx.fillStyle = flash > 0 ? `rgba(94, 234, 212, ${0.16 + flash * 0.3})` : 'rgba(45, 212, 191, 0.16)';
        ctx.strokeStyle = flash > 0 ? '#99f6e4' : 'rgba(45, 212, 191, 0.7)';
        ctx.lineWidth = 2;
        this.fillAndStrokeRoundedRect(ctx, block.x, block.y, block.width, block.height, radius);

        const remainingHP = after?.active ? after.value : 0;

        // Display remaining durability in crisp white
        ctx.fillStyle = flash > 0 ? '#ffffff' : '#f0fdfa';
        ctx.font = '800 20px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(remainingHP), centerX, centerY - 4);

        // Small, restrained damage delta badge below
        ctx.fillStyle = '#2dd4bf';
        ctx.font = '700 11px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText(`-${projectedDamage}`, centerX, centerY + 13);

      } else {
        // Unaffected: Visually recedes slightly, solid and readable
        ctx.fillStyle = flash > 0 ? `rgba(56, 189, 248, ${0.3 + flash * 0.3})` : 'rgba(18, 28, 42, 0.8)';
        ctx.strokeStyle = flash > 0 ? '#7dd3fc' : 'rgba(70, 95, 120, 0.35)';
        ctx.lineWidth = 1.5;
        this.fillAndStrokeRoundedRect(ctx, block.x, block.y, block.width, block.height, radius);

        ctx.fillStyle = flash > 0 ? '#ffffff' : '#cbd5e1';
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
      const opacity = Math.max(0, (1 - progress) * 0.85);
      const scale = 1.0 + progress * 0.08;
      const block = effect.block;
      const centerX = block.x + block.width / 2;
      const centerY = block.y + block.height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);

      // Subtle expanding amber fade
      ctx.strokeStyle = `rgba(251, 191, 36, ${opacity})`;
      ctx.fillStyle = `rgba(245, 158, 11, ${opacity * 0.3})`;
      ctx.lineWidth = 1.5;
      this.fillAndStrokeRoundedRect(ctx, block.x, block.y, block.width, block.height, 6);

      // 4 tiny restrained corner fragments separating outward by 6–10px
      const offset = progress * 8;
      ctx.fillStyle = `rgba(251, 191, 36, ${opacity * 0.9})`;
      const fragSize = 3;
      // Top-left
      ctx.fillRect(block.x - offset, block.y - offset, fragSize, fragSize);
      // Top-right
      ctx.fillRect(block.x + block.width + offset - fragSize, block.y - offset, fragSize, fragSize);
      // Bottom-left
      ctx.fillRect(block.x - offset, block.y + block.height + offset - fragSize, fragSize, fragSize);
      // Bottom-right
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

  private drawTrajectories(ctx: CanvasRenderingContext2D, trajectories: Record<string, Vector2D[]>): void {
    const ids = Object.keys(trajectories);
    ctx.save();

    // 1. Secondary/trailing paths: faint whisper of volley spread
    for (let index = 1; index < ids.length; index += 1) {
      const points = trajectories[ids[index]];
      if (!points || points.length < 2) continue;

      ctx.strokeStyle = 'rgba(45, 212, 191, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 4) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }

    // 2. Primary lead path: single clear, slender, refined trajectory
    const primaryPoints = trajectories[ids[0]];
    if (primaryPoints && primaryPoints.length >= 2) {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(primaryPoints[0].x, primaryPoints[0].y);
      for (let i = 1; i < primaryPoints.length; i += 2) {
        ctx.lineTo(primaryPoints[i].x, primaryPoints[i].y);
      }
      ctx.stroke();

      // Subtle rebound dots only at genuine reflection vertices
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      for (let i = 1; i < primaryPoints.length - 1; i += 1) {
        const pPrev = primaryPoints[i - 1];
        const pCurr = primaryPoints[i];
        const pNext = primaryPoints[i + 1];
        const dx1 = pCurr.x - pPrev.x;
        const dy1 = pCurr.y - pPrev.y;
        const dx2 = pNext.x - pCurr.x;
        const dy2 = pNext.y - pCurr.y;
        const dot = dx1 * dx2 + dy1 * dy2;
        const mag = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2);
        if (mag > 0 && dot / mag < 0.85) {
          ctx.beginPath();
          ctx.arc(pCurr.x, pCurr.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private drawAim(ctx: CanvasRenderingContext2D, launcher: Launcher, angleDeg: number): void {
    ctx.save();
    const theta = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rayLength = 160;

    // Slender, restrained aim guide connecting launcher to trajectory
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(launcher.x, launcher.y);
    ctx.lineTo(launcher.x + rayLength * cos, launcher.y - rayLength * sin);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  private drawLauncher(
    ctx: CanvasRenderingContext2D,
    launcher: Launcher,
    ballCount: number,
    recoil: { time: number; angleDeg: number; duration: number } | null,
    now: number
  ): void {
    ctx.save();

    let drawX = launcher.x;
    let drawY = launcher.y;
    let radius = 7;

    // Subtle tactile launch recoil (shifts back 3px along recoil angle and springs forward)
    if (recoil) {
      const elapsed = now - recoil.time;
      if (elapsed < recoil.duration) {
        const p = elapsed / recoil.duration;
        const recoilDist = Math.sin(p * Math.PI) * 3.5;
        const theta = (recoil.angleDeg * Math.PI) / 180;
        drawX -= recoilDist * Math.cos(theta);
        drawY += recoilDist * Math.sin(theta);
        radius = 7 + Math.sin(p * Math.PI) * 1.5;
      }
    }

    // Outer subtle guide ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
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

  private drawBalls(ctx: CanvasRenderingContext2D, balls: VisualBall[]): void {
    ctx.save();

    for (const ball of balls) {
      const opacity = ball.opacity ?? 1.0;
      const radius = ball.radius * (ball.scale ?? 1.0);

      // Micro velocity hint (purely visual sub-ball 2px behind for stream coherence)
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 0.5) {
        const backX = ball.x - (ball.vx / speed) * 2.5;
        const backY = ball.y - (ball.vy / speed) * 2.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
        ctx.beginPath();
        ctx.arc(backX, backY, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main crisp white ball
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
