import { PHYSICS_CONFIG, INPUT_CONFIG } from '../config.js';
import { V } from './vector.js';
import { sweptCircleVsAABB } from './collision.js';
import { validateGameState, clampLauncherX } from '../domain/gameState.js';

function assertAngle(angleDeg) {
  if (!Number.isFinite(angleDeg) || angleDeg < INPUT_CONFIG.angleMin || angleDeg > INPUT_CONFIG.angleMax) {
    throw new RangeError(`angleDeg must be between ${INPUT_CONFIG.angleMin} and ${INPUT_CONFIG.angleMax}`);
  }
}

export class Simulation {
  constructor(gameState, angleDeg, config = PHYSICS_CONFIG, { record = false } = {}) {
    const validation = validateGameState(gameState);
    if (!validation.ok) throw new Error(`Invalid GameState: ${validation.errors.join('; ')}`);
    assertAngle(angleDeg);

    this.config = config;
    this.time = 0;
    this.finished = false;
    this.blocks = gameState.blocks.map((b) => ({ ...b }));
    this.pickups = Array.isArray(gameState.pickups)
      ? gameState.pickups.map((p) => ({ ...p, active: Boolean(p.active) }))
      : [];
    this.collectedPickupIds = new Set();
    this.launcher = { ...gameState.launcher };
    this.angleDeg = angleDeg;

    const theta = (angleDeg * Math.PI) / 180;
    this.launchVelocity = {
      x: config.ballSpeed * Math.cos(theta),
      y: -config.ballSpeed * Math.sin(theta),
    };

    this.balls = Array.from({ length: gameState.balls.available }, (_, i) => ({
      id: `ball${i}`,
      x: this.launcher.x,
      y: this.launcher.y,
      vx: 0,
      vy: 0,
      radius: config.ballRadius,
      spawnTime: i * config.spawnInterval,
      spawned: false,
      active: false,
    }));

    this.stats = { hits: 0, destroyed: 0, ballsExited: 0, ballPickupsCollected: 0 };
    this.firstExitX = null;
    this.timedOut = false;
    this.trajectories = record ? {} : null;
    this.events = [];
  }

  allDone() {
    return this.balls.every((b) => b.spawned && !b.active);
  }

  step() {
    const cfg = this.config;
    for (const ball of this.balls) {
      if (!ball.spawned && this.time + 1e-9 >= ball.spawnTime) {
        ball.spawned = true;
        ball.active = true;
        ball.x = this.launcher.x;
        ball.y = this.launcher.y;
        ball.vx = this.launchVelocity.x;
        ball.vy = this.launchVelocity.y;
        this.events.push({ t: round6(this.time), type: 'BallSpawned', ballId: ball.id });
        if (this.trajectories) this.trajectories[ball.id] = [{ x: ball.x, y: ball.y }];
      }
    }

    for (const ball of this.balls) {
      if (!ball.active) continue;
      this._advanceBall(ball);
      if (this.trajectories && ball.active) this.trajectories[ball.id].push({ x: ball.x, y: ball.y });
    }

    this.time += cfg.fixedDt;
    if (this.time > cfg.maxSimulationTime) {
      this.timedOut = true;
      this.firstExitX = null;
      for (const ball of this.balls) {
        ball.active = false;
        ball.spawned = true;
      }
      this.events.push({ t: round6(this.time), type: 'SimulationTimeout' });
    }
    this.finished = this.allDone();
    return this.finished;
  }

  runToCompletion() {
    let guard = 0;
    while (!this.finished && guard < 1e6) {
      this.step();
      guard += 1;
    }
    if (guard >= 1e6) throw new Error('Simulation guard exceeded');
    return this.result();
  }

  result() {
    const firstExitX = this.timedOut ? null : this.firstExitX;
    const nextLauncherX = firstExitX != null
      ? clampLauncherX(firstExitX, this.config)
      : this.launcher.x;

    return {
      angleDeg: this.angleDeg,
      timedOut: this.timedOut,
      completed: !this.timedOut,
      finalBlocks: this.blocks.map((b) => ({ ...b })),
      finalPickups: this.pickups.map((p) => ({ ...p })),
      collectedPickups: Array.from(this.collectedPickupIds),
      ballPickupsCollected: this.collectedPickupIds.size,
      stats: { ...this.stats, ballPickupsCollected: this.collectedPickupIds.size },
      trajectories: this.trajectories,
      events: this.events.map((e) => ({ ...e })),
      score: this.stats.hits + this.stats.destroyed * 3,
      elapsedTime: round6(this.time),
      firstExitX,
      nextLauncher: {
        x: nextLauncherX,
        y: this.launcher.y,
      },
    };
  }

  _collectPickupsAlongSegment(P0, D, tPhys, ball) {
    if (!this.pickups || this.pickups.length === 0) return;

    const a = D.x * D.x + D.y * D.y;
    const candidates = [];

    for (const pickup of this.pickups) {
      if (!pickup.active || this.collectedPickupIds.has(pickup.id)) continue;
      const pickupRadius = pickup.radius ?? 14;
      const R = ball.radius + pickupRadius;
      const deltaX = P0.x - pickup.x;
      const deltaY = P0.y - pickup.y;
      const c = deltaX * deltaX + deltaY * deltaY - R * R;

      if (c <= 0) {
        // Ball is already intersecting/touching pickup at t = 0
        candidates.push({ pickup, tContact: 0 });
        continue;
      }

      if (a < 1e-12) {
        // Stationary ball not touching pickup
        continue;
      }

      const b = 2 * (deltaX * D.x + deltaY * D.y);
      const disc = b * b - 4 * a * c;

      if (disc < 0) {
        // Trajectory ray does not intersect pickup circle
        continue;
      }

      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / (2 * a);
      const t2 = (-b + sqrtDisc) / (2 * a);

      // Overlap with traveled interval [0, tPhys] requires entry before/at physical collision
      // and exit after/at start of interval
      if (t1 <= tPhys + 1e-9 && t2 >= 0) {
        const tContact = Math.max(0, t1);
        if (tContact <= tPhys + 1e-9) {
          candidates.push({ pickup, tContact });
        }
      }
    }

    if (candidates.length === 0) return;

    // Sort chronologically by contact time along traveled segment; tie-break deterministically by ID
    candidates.sort((pA, pB) => pA.tContact - pB.tContact || pA.pickup.id.localeCompare(pB.pickup.id));

    for (const { pickup } of candidates) {
      if (!this.collectedPickupIds.has(pickup.id)) {
        pickup.active = false;
        this.collectedPickupIds.add(pickup.id);
        this.stats.ballPickupsCollected = this.collectedPickupIds.size;
        this.events.push({
          t: round6(this.time),
          type: 'PickupCollected',
          ballId: ball.id,
          pickupId: pickup.id,
        });
      }
    }
  }

  _advanceBall(ball) {
    const cfg = this.config;
    let remainingFrac = 1;
    let collisions = 0;

    while (remainingFrac > cfg.collisionEpsilon && collisions < cfg.maxCollisionsPerStep) {
      const P0 = { x: ball.x, y: ball.y };
      const D = { x: ball.vx * remainingFrac, y: ball.vy * remainingFrac };
      const hit = this._earliestCollision(P0, D, ball.radius);
      const tPhys = hit ? hit.t : 1;

      // 1. Consider pickup intersections only along the portion the ball actually reaches before physical collision
      this._collectPickupsAlongSegment(P0, D, tPhys, ball);

      if (!hit) {
        ball.x += D.x;
        ball.y += D.y;
        break;
      }

      // Ball advances to exact physical collision point
      ball.x = P0.x + D.x * hit.t;
      ball.y = P0.y + D.y * hit.t;
      remainingFrac *= 1 - hit.t;

      if (hit.type === 'exit') {
        const exitX = round6(ball.x);
        if (this.firstExitX === null) {
          this.firstExitX = exitX;
        }
        ball.active = false;
        this.stats.ballsExited += 1;
        this.events.push({ t: round6(this.time), type: 'BallExited', ballId: ball.id, x: exitX });
        return;
      }

      if (hit.type === 'block') {
        const block = this.blocks.find((item) => item.id === hit.blockId);
        if (block?.active) {
          block.value -= 1;
          this.stats.hits += 1;
          this.events.push({ t: round6(this.time), type: 'BlockCollision', ballId: ball.id, blockId: block.id });
          if (block.value <= 0) {
            block.active = false;
            this.stats.destroyed += 1;
            this.events.push({ t: round6(this.time), type: 'BlockDestroyed', ballId: ball.id, blockId: block.id });
          }
        }
      }

      const reflected = V.reflect({ x: ball.vx, y: ball.vy }, hit.normal);
      const normalized = V.norm(reflected);
      ball.vx = normalized.x * cfg.ballSpeed;
      ball.vy = normalized.y * cfg.ballSpeed;
      ball.x += hit.normal.x * cfg.collisionEpsilon;
      ball.y += hit.normal.y * cfg.collisionEpsilon;
      collisions += 1;
    }

    if (collisions >= cfg.maxCollisionsPerStep) {
      this.events.push({ t: round6(this.time), type: 'CollisionCapReached', ballId: ball.id });
    }
  }

  _earliestCollision(P0, D, radius) {
    const cfg = this.config;
    let best = null;
    const consider = (t, normal, type, blockId) => {
      if (t == null || t < 0 || t > 1) return;
      if (!best || t < best.t) best = { t, normal, type, blockId };
    };

    if (D.x < 0) consider((radius - P0.x) / D.x, { x: 1, y: 0 }, 'wall');
    if (D.x > 0) consider((cfg.canvasWidth - radius - P0.x) / D.x, { x: -1, y: 0 }, 'wall');
    if (D.y < 0) consider((radius - P0.y) / D.y, { x: 0, y: 1 }, 'wall');
    if (D.y > 0) {
      const exitY = this.launcher.y;
      if (P0.y >= exitY) {
        consider(0, { x: 0, y: -1 }, 'exit');
      } else {
        consider((exitY - P0.y) / D.y, { x: 0, y: -1 }, 'exit');
      }
    }

    for (const block of this.blocks) {
      if (!block.active) continue;
      const hit = sweptCircleVsAABB(P0, D, radius, block);
      if (hit) consider(hit.t, hit.normal, 'block', block.id);
    }
    return best;
  }
}

export function simulateTurn(gameState, angleDeg, options = {}) {
  return new Simulation(gameState, angleDeg, PHYSICS_CONFIG, options).runToCompletion();
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

export { clampLauncherX };
