/**
 * Presentation-only acceleration scheduler for long volley tails.
 *
 * Strict Architectural Rules:
 * - Exactly 3 presentation tiers: NORMAL = 1.0x, TAIL = 2.0x, RAPID_TAIL = 6.0x.
 * - 1x → 2x: After all balls are spawned and >= 4.0s real time, latch to 2x if (active <= 3 OR exited >= 75%).
 * - 2x → 6x: After entering 2x and >= 3.0 additional real seconds in 2x, latch to 6x if active <= 3.
 * - Zero reverse transitions: never return to 2x or 1x during that volley.
 * - Tail acceleration is presentation scheduling ONLY: consumes additional canonical fixedDt steps per frame.
 * - Does NOT alter ballSpeed, fixedDt, collision math, or skip events.
 */

export const PRESENTATION_TIERS = Object.freeze({
  NORMAL: 1.0,
  TAIL: 2.0,
  RAPID_TAIL: 6.0,
});

export const ACCELERATION_CONFIG = Object.freeze({
  initialSpeed: 1.0,
  tailSpeed: 2.0,
  rapidTailSpeed: 6.0,
  minElapsedSeconds: 4.0,
  maxActiveBallsForTail: 3,
  minExitedProportionForTail: 0.75,
  min2xDurationBeforeRapid: 3.0,
  maxActiveBallsForRapidTail: 3,
});

/**
 * @typedef {'NORMAL' | 'TAIL' | 'RAPID_TAIL'} PresentationTier
 *
 * @typedef {'initial' | 'tail-active-count' | 'tail-exited-proportion' | 'latched-tail' | 'rapid-tail' | 'latched-rapid-tail'} AccelerationReason
 *
 * @typedef {Object} PresentationSpeedInputs
 * @property {number} elapsedRealSeconds
 * @property {number} activeBallsCount
 * @property {number} exitedBallsCount
 * @property {number} totalBalls
 * @property {boolean} allSpawned
 * @property {PresentationTier} [currentTier]
 * @property {boolean} [isAlreadyAccelerated=false]
 * @property {number|null} [tail2xStartTime=null]
 * @property {typeof ACCELERATION_CONFIG} [config]
 */

/**
 * Evaluates the presentation speed multiplier for live gameplay frames.
 *
 * Exact Transition Rules:
 * - 1x -> 2x: after all balls spawned and >= 4.0s elapsed, if active <= 3 or exited >= 75%.
 * - 2x -> 6x: after already in 2x and >= 3.0s real elapsed in 2x, if active <= 3.
 * - Latching: once in 2x, stays >= 2x; once in 6x, stays at 6x until volley completion.
 *
 * @param {PresentationSpeedInputs} inputs
 * @returns {{ speed: number, tier: PresentationTier, isAccelerated: boolean, reason: AccelerationReason }}
 */
export function evaluatePresentationSpeed(inputs) {
  const {
    elapsedRealSeconds,
    activeBallsCount,
    exitedBallsCount,
    totalBalls,
    allSpawned,
    currentTier = inputs.isAlreadyAccelerated ? 'TAIL' : 'NORMAL',
    tail2xStartTime = null,
    config = ACCELERATION_CONFIG,
  } = inputs;

  // Once in RAPID_TAIL (6.0x), latch unconditionally until volley completion
  if (currentTier === 'RAPID_TAIL') {
    return {
      speed: config.rapidTailSpeed,
      tier: 'RAPID_TAIL',
      isAccelerated: true,
      reason: 'latched-rapid-tail',
    };
  }

  // If in TAIL (2.0x), check 2x -> 6x rapid tail condition
  if (currentTier === 'TAIL') {
    const elapsedIn2x = tail2xStartTime != null ? elapsedRealSeconds - tail2xStartTime : 0;
    const canEscalateToRapid =
      tail2xStartTime != null &&
      elapsedIn2x >= config.min2xDurationBeforeRapid &&
      activeBallsCount <= config.maxActiveBallsForRapidTail;

    if (canEscalateToRapid) {
      return {
        speed: config.rapidTailSpeed,
        tier: 'RAPID_TAIL',
        isAccelerated: true,
        reason: 'rapid-tail',
      };
    }

    return {
      speed: config.tailSpeed,
      tier: 'TAIL',
      isAccelerated: true,
      reason: 'latched-tail',
    };
  }

  // In NORMAL (1.0x): Volley must begin at 1x; dense spawning phase must never accelerate
  if (!allSpawned) {
    return {
      speed: config.initialSpeed,
      tier: 'NORMAL',
      isAccelerated: false,
      reason: 'initial',
    };
  }

  // Must have elapsed at least 4.0 seconds of real volley time before entering 2x
  if (elapsedRealSeconds < config.minElapsedSeconds) {
    return {
      speed: config.initialSpeed,
      tier: 'NORMAL',
      isAccelerated: false,
      reason: 'initial',
    };
  }

  const isLowActiveCount = activeBallsCount <= config.maxActiveBallsForTail;
  const isHighExitedProportion =
    totalBalls > 0 && exitedBallsCount / totalBalls >= config.minExitedProportionForTail;

  if (isLowActiveCount) {
    return {
      speed: config.tailSpeed,
      tier: 'TAIL',
      isAccelerated: true,
      reason: 'tail-active-count',
    };
  }

  if (isHighExitedProportion) {
    return {
      speed: config.tailSpeed,
      tier: 'TAIL',
      isAccelerated: true,
      reason: 'tail-exited-proportion',
    };
  }

  return {
    speed: config.initialSpeed,
    tier: 'NORMAL',
    isAccelerated: false,
    reason: 'initial',
  };
}
