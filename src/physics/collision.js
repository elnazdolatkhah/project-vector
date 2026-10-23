import { V } from './vector.js';

// Continuous circle-vs-axis-aligned-rectangle sweep.
// Returns {t, normal} for the earliest valid impact in [0,1], or null.
export function sweptCircleVsAABB(P0, D, radius, block) {
  const x0 = block.x - radius;
  const x1 = block.x + block.width + radius;
  const y0 = block.y - radius;
  const y1 = block.y + block.height + radius;

  let tEnterX = -Infinity;
  let tExitX = Infinity;
  let tEnterY = -Infinity;
  let tExitY = Infinity;

  if (Math.abs(D.x) < 1e-12) {
    if (P0.x < x0 || P0.x > x1) return null;
  } else {
    let t1 = (x0 - P0.x) / D.x;
    let t2 = (x1 - P0.x) / D.x;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tEnterX = t1;
    tExitX = t2;
  }

  if (Math.abs(D.y) < 1e-12) {
    if (P0.y < y0 || P0.y > y1) return null;
  } else {
    let t1 = (y0 - P0.y) / D.y;
    let t2 = (y1 - P0.y) / D.y;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tEnterY = t1;
    tExitY = t2;
  }

  const tEnter = Math.max(tEnterX, tEnterY, 0);
  const tExit = Math.min(tExitX, tExitY, 1);
  if (tEnter > tExit || tExit < 0 || tEnter > 1) return null;

  const entryX = P0.x + D.x * tEnter;
  const entryY = P0.y + D.y * tEnter;
  const enteredByX = tEnterX >= tEnterY;

  if (enteredByX) {
    if (entryY >= block.y && entryY <= block.y + block.height) {
      return { t: tEnter, normal: D.x < 0 ? { x: 1, y: 0 } : { x: -1, y: 0 } };
    }
  } else if (entryX >= block.x && entryX <= block.x + block.width) {
    return { t: tEnter, normal: D.y < 0 ? { x: 0, y: 1 } : { x: 0, y: -1 } };
  }

  const corner = {
    x: entryX < block.x ? block.x : block.x + block.width,
    y: entryY < block.y ? block.y : block.y + block.height,
  };
  const fx = P0.x - corner.x;
  const fy = P0.y - corner.y;
  const a = D.x * D.x + D.y * D.y;
  const b = 2 * (fx * D.x + fy * D.y);
  const c = fx * fx + fy * fy - radius * radius;
  if (a < 1e-12) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  const sq = Math.sqrt(disc);
  const roots = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)].filter((t) => t >= 0 && t <= 1);
  if (!roots.length) return null;
  const t = Math.min(...roots);
  const hitPoint = { x: P0.x + D.x * t, y: P0.y + D.y * t };
  return { t, normal: V.norm({ x: hitPoint.x - corner.x, y: hitPoint.y - corner.y }) };
}
