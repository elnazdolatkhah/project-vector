export const V = Object.freeze({
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: (a) => Math.hypot(a.x, a.y),
  norm: (a) => {
    const len = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / len, y: a.y / len };
  },
  reflect: (velocity, normal) => {
    const d = velocity.x * normal.x + velocity.y * normal.y;
    return {
      x: velocity.x - 2 * d * normal.x,
      y: velocity.y - 2 * d * normal.y,
    };
  },
});
