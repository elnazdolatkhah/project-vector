import { PHYSICS_CONFIG } from '../config.js';

export function fitWorld(viewWidth, viewHeight, worldWidth = PHYSICS_CONFIG.canvasWidth, worldHeight = PHYSICS_CONFIG.canvasHeight) {
  const scale = Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
  const width = worldWidth * scale;
  const height = worldHeight * scale;
  return {
    scale,
    offsetX: (viewWidth - width) / 2,
    offsetY: (viewHeight - height) / 2,
    width,
    height,
  };
}

export function viewToWorld(x, y, viewWidth, viewHeight) {
  const fit = fitWorld(viewWidth, viewHeight);
  return {
    x: (x - fit.offsetX) / fit.scale,
    y: (y - fit.offsetY) / fit.scale,
    inside: x >= fit.offsetX && x <= fit.offsetX + fit.width && y >= fit.offsetY && y <= fit.offsetY + fit.height,
  };
}
