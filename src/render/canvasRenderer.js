import { PHYSICS_CONFIG } from '../config.js';
import { fitWorld } from './viewport.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render({ state, liveBalls = null, future = null, aimAngle = null }) {
    const ctx = this.ctx;
    const fit = fitWorld(this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#010204';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(fit.offsetX, fit.offsetY);
    ctx.scale(fit.scale, fit.scale);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, PHYSICS_CONFIG.canvasWidth, PHYSICS_CONFIG.canvasHeight);

    this.#drawBoundary(ctx);
    this.#drawBlocks(ctx, state.blocks, future);
    if (future?.trajectories) this.#drawTrajectories(ctx, future.trajectories);
    if (aimAngle != null) this.#drawAim(ctx, state.launcher, aimAngle);
    this.#drawLauncher(ctx, state.launcher, state.balls.available);
    if (liveBalls) this.#drawBalls(ctx, liveBalls);
    ctx.restore();
  }

  #drawBoundary(ctx) {
    ctx.strokeStyle = 'rgba(95,210,255,.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, PHYSICS_CONFIG.canvasWidth - 16, PHYSICS_CONFIG.canvasHeight - 16);
  }

  #drawBlocks(ctx, blocks, future) {
    const finalById = future ? new Map(future.result.finalBlocks.map((b) => [b.id, b])) : null;
    for (const block of blocks) {
      if (!block.active) continue;
      const after = finalById?.get(block.id);
      const projectedDamage = after ? Math.max(0, block.value - (after.active ? after.value : 0)) : 0;
      const projectedDestroyed = after ? !after.active : false;
      ctx.fillStyle = projectedDestroyed ? 'rgba(255,190,72,.28)' : projectedDamage ? 'rgba(81,222,216,.22)' : 'rgba(41,82,105,.42)';
      ctx.strokeStyle = projectedDestroyed ? '#ffc04a' : projectedDamage ? '#51ded8' : '#5fd2ff';
      ctx.lineWidth = projectedDestroyed ? 5 : projectedDamage ? 3 : 2;
      ctx.fillRect(block.x, block.y, block.width, block.height);
      ctx.strokeRect(block.x, block.y, block.width, block.height);
      ctx.fillStyle = '#eaf7ff';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(block.value), block.x + block.width / 2, block.y + block.height / 2);
    }
  }

  #drawTrajectories(ctx, trajectories) {
    const ids = Object.keys(trajectories);
    ids.forEach((id, index) => {
      const points = trajectories[id];
      if (!points || points.length < 2) return;
      ctx.strokeStyle = index === 0 ? 'rgba(81,222,216,.85)' : 'rgba(81,222,216,.13)';
      ctx.lineWidth = index === 0 ? 3 : 1.2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 3) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    });
  }

  #drawAim(ctx, launcher, angleDeg) {
    const theta = (angleDeg * Math.PI) / 180;
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(launcher.x, launcher.y);
    ctx.lineTo(launcher.x + 140 * Math.cos(theta), launcher.y - 140 * Math.sin(theta));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  #drawLauncher(ctx, launcher, ballCount) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(launcher.x, launcher.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`×${ballCount}`, launcher.x + 18, launcher.y + 7);
  }

  #drawBalls(ctx, balls) {
    ctx.fillStyle = '#fff';
    for (const ball of balls) {
      if (!ball.active) continue;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
