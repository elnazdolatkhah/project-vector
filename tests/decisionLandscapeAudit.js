import { createGameState, applyTurnResult, computeDangerMargin } from '../src/domain/gameState.js';
import { Simulation, simulateTurn } from '../src/physics/simulation.js';
import { evaluatePresentationSpeed } from '../src/physics/presentationScheduler.js';
import { PHYSICS_CONFIG, BOARD_GEOMETRY, INPUT_CONFIG } from '../src/config.js';
import { LEVELS } from '../src/levels/levels.js';

// -------------------------------------------------------------
// Helper: Presentation duration simulation under 1x -> 2x -> 6x
// -------------------------------------------------------------
export function simulateShotWithDuration(state, angle) {
  const sim = new Simulation(state, angle, PHYSICS_CONFIG, { record: false });
  let realTimeElapsed = 0;
  const frameDt = 1 / 60;
  let accumulator = 0;
  const fixedDt = PHYSICS_CONFIG.fixedDt;
  let currentTier = 'NORMAL';
  let tail2xStartTime = null;
  let currentSpeed = 1.0;
  const totalBalls = sim.balls.length;
  const balls = sim.balls;

  while (!sim.finished) {
    realTimeElapsed += frameDt;

    if (currentTier !== 'RAPID_TAIL') {
      let activeBallsCount = 0;
      let exitedBallsCount = 0;
      let allSpawned = true;
      for (let i = 0; i < totalBalls; i++) {
        const b = balls[i];
        if (b.active) activeBallsCount++;
        if (b.spawned) {
          if (!b.active) exitedBallsCount++;
        } else {
          allSpawned = false;
        }
      }

      const speedEval = evaluatePresentationSpeed({
        elapsedRealSeconds: realTimeElapsed,
        activeBallsCount,
        exitedBallsCount,
        totalBalls,
        allSpawned,
        currentTier,
        tail2xStartTime,
      });

      if (currentTier === 'NORMAL' && speedEval.tier === 'TAIL') {
        tail2xStartTime = realTimeElapsed;
      }
      currentTier = speedEval.tier;
      currentSpeed = speedEval.speed;
    }

    accumulator += frameDt * currentSpeed;
    while (accumulator >= fixedDt && !sim.finished) {
      sim.step();
      accumulator -= fixedDt;
    }
  }

  const result = sim.result();
  const nextState = applyTurnResult(state, result);
  const initialHP = state.blocks.filter((b) => b.active).reduce((sum, b) => sum + b.value, 0);
  const remainingHP = result.finalBlocks.filter((b) => b.active).reduce((sum, b) => sum + b.value, 0);
  const damage = Math.max(0, initialHP - remainingHP);
  const destroyed = result.stats.destroyed;
  const pickups = result.ballPickupsCollected ?? result.collectedPickups?.length ?? 0;
  const dangerMargin = computeDangerMargin(nextState);
  const nextLauncherX = result.nextLauncher?.x ?? state.launcher.x;

  // Composite quality score
  const compositeQuality = damage + 15 * destroyed + 30 * pickups + 0.1 * dangerMargin;

  return {
    angle,
    damage,
    destroyed,
    pickups,
    dangerMargin,
    nextLauncherX,
    realDuration: realTimeElapsed,
    canonicalSteps: sim.stepCount,
    stageStatus: nextState.stageStatus,
    compositeQuality,
    result,
    nextState,
  };
}

// -------------------------------------------------------------
// Helper: Spearman Rank Correlation
// -------------------------------------------------------------
function getRanks(arr) {
  const indexed = arr.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].val === indexed[j].val) {
      j++;
    }
    const avgRank = (i + j + 2) / 2; // 1-based rank
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

export function spearmanCorrelation(arrX, arrY) {
  if (arrX.length === 0 || arrX.length !== arrY.length) return 0;
  const rx = getRanks(arrX);
  const ry = getRanks(arrY);
  const n = rx.length;
  const meanX = rx.reduce((s, v) => s + v, 0) / n;
  const meanY = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX;
    const dy = ry[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

// -------------------------------------------------------------
// Helper: Pareto Frontier
// -------------------------------------------------------------
export function computeParetoFrontier(samples) {
  // Objectives to maximize:
  // 1: damage
  // 2: destroyed
  // 3: pickups
  // 4: dangerMargin
  // 5: launcherCenterness (closer to 360 is better future access)
  // 6: -realDuration (faster is better)
  const evaluated = samples.map((s) => ({
    sample: s,
    objectives: [
      s.damage,
      s.destroyed,
      s.pickups,
      s.dangerMargin,
      -Math.abs(s.nextLauncherX - 360), // Launcher centerness
      -s.realDuration, // Lower duration
    ],
  }));

  const frontier = [];
  for (let i = 0; i < evaluated.length; i++) {
    let isDominated = false;
    const a = evaluated[i].objectives;
    for (let j = 0; j < evaluated.length; j++) {
      if (i === j) continue;
      const b = evaluated[j].objectives;
      // Does b dominate a?
      let bGreaterOrEqual = true;
      let bStrictlyGreater = false;
      for (let k = 0; k < a.length; k++) {
        if (b[k] < a[k]) {
          bGreaterOrEqual = false;
          break;
        }
        if (b[k] > a[k]) {
          bStrictlyGreater = true;
        }
      }
      if (bGreaterOrEqual && bStrictlyGreater) {
        isDominated = true;
        break;
      }
    }
    if (!isDominated) {
      frontier.push(evaluated[i].sample);
    }
  }
  return frontier;
}

// -------------------------------------------------------------
// Mid-Game States Generator
// -------------------------------------------------------------
export function generateStageStates(levelKey) {
  const initialState = createGameState(LEVELS[levelKey]);

  // Sample initial state at 0.5° to pick representative angles
  const initSamples = [];
  for (let a = 5; a <= 175; a += 0.5) {
    const sim = simulateTurn(initialState, a, { record: false });
    const nextSt = applyTurnResult(initialState, sim);
    const initialHP = initialState.blocks.filter((b) => b.active).reduce((sum, b) => sum + b.value, 0);
    const remainingHP = sim.finalBlocks.filter((b) => b.active).reduce((sum, b) => sum + b.value, 0);
    const damage = Math.max(0, initialHP - remainingHP);
    const compQ = damage + 15 * sim.stats.destroyed + 30 * (sim.ballPickupsCollected ?? 0) + 0.1 * computeDangerMargin(nextSt);
    initSamples.push({ angle: a, damage, destroyed: sim.stats.destroyed, compQ, result: sim, nextSt });
  }

  // Sort by composite quality
  initSamples.sort((a, b) => b.compQ - a.compQ);

  // Strong: top angle
  const strongTurn1 = initSamples[0];
  const strongState = strongTurn1.nextSt;

  // Competent: ~70th percentile
  const competentIdx = Math.floor(initSamples.length * 0.30);
  const competentTurn1 = initSamples[competentIdx];
  const competentState = competentTurn1.nextSt;

  // Weak-but-reasonable: ~30th percentile
  const weakIdx = Math.floor(initSamples.length * 0.70);
  const weakTurn1 = initSamples[weakIdx];
  const weakState = weakTurn1.nextSt;

  return [
    { label: 'Initial (Turn 0)', state: initialState },
    { label: `Mid-Game Strong (Turn 1, prior ${strongTurn1.angle}°)`, state: strongState },
    { label: `Mid-Game Competent (Turn 1, prior ${competentTurn1.angle}°)`, state: competentState },
    { label: `Mid-Game Weak-Reasonable (Turn 1, prior ${weakTurn1.angle}°)`, state: weakState },
  ];
}

// -------------------------------------------------------------
// Sample State Across Full Angle Domain (0.25° resolution)
// -------------------------------------------------------------
export function sampleStateLandscape(state, step = 0.25) {
  const samples = [];
  for (let a = 5; a <= 175 + 1e-6; a += step) {
    const angle = Math.round(a * 1000) / 1000;
    samples.push(simulateShotWithDuration(state, angle));
  }
  return samples;
}

// -------------------------------------------------------------
// Sensitivity Analysis
// -------------------------------------------------------------
export function analyzeSensitivity(samples, step = 0.25) {
  const angleMap = new Map();
  for (let i = 0; i < samples.length; i++) {
    angleMap.set(samples[i].angle, samples[i]);
  }

  let materiallyChanged025 = 0;
  let materiallyChanged050 = 0;
  let materiallyChanged100 = 0;
  let totalEvaluated = 0;

  function isMaterialChange(s1, s2) {
    if (!s1 || !s2) return false;
    const dmgDiff = Math.abs(s1.damage - s2.damage);
    const destDiff = Math.abs(s1.destroyed - s2.destroyed);
    const pickupDiff = Math.abs(s1.pickups - s2.pickups);
    const launcherDiff = Math.abs(s1.nextLauncherX - s2.nextLauncherX);
    const statusDiff = s1.stageStatus !== s2.stageStatus;

    return dmgDiff >= 6 || destDiff >= 1 || pickupDiff >= 1 || launcherDiff >= 60 || statusDiff;
  }

  const needleBands = [];
  let currentNeedle = null;

  // Threshold for top 15% composite quality
  const sortedQ = [...samples].sort((a, b) => b.compositeQuality - a.compositeQuality);
  const top15QThreshold = sortedQ[Math.floor(sortedQ.length * 0.15)].compositeQuality;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const a = s.angle;

    // Check +/- 0.25
    const sPlus025 = angleMap.get(Math.round((a + 0.25) * 1000) / 1000);
    const sMinus025 = angleMap.get(Math.round((a - 0.25) * 1000) / 1000);
    const changed025 = isMaterialChange(s, sPlus025) || isMaterialChange(s, sMinus025);
    if (changed025) materiallyChanged025++;

    // Check +/- 0.50
    const sPlus050 = angleMap.get(Math.round((a + 0.50) * 1000) / 1000);
    const sMinus050 = angleMap.get(Math.round((a - 0.50) * 1000) / 1000);
    const changed050 = isMaterialChange(s, sPlus050) || isMaterialChange(s, sMinus050);
    if (changed050) materiallyChanged050++;

    // Check +/- 1.00
    const sPlus100 = angleMap.get(Math.round((a + 1.00) * 1000) / 1000);
    const sMinus100 = angleMap.get(Math.round((a - 1.00) * 1000) / 1000);
    const changed100 = isMaterialChange(s, sPlus100) || isMaterialChange(s, sMinus100);
    if (changed100) materiallyChanged100++;

    totalEvaluated++;

    // Needle band tracking: high-value angles that exist in narrow bands < 1.0°
    const isHighValue = s.compositeQuality >= top15QThreshold;
    if (isHighValue) {
      if (!currentNeedle) {
        currentNeedle = { startAngle: a, endAngle: a, maxQuality: s.compositeQuality, angles: [a] };
      } else {
        currentNeedle.endAngle = a;
        currentNeedle.maxQuality = Math.max(currentNeedle.maxQuality, s.compositeQuality);
        currentNeedle.angles.push(a);
      }
    } else {
      if (currentNeedle) {
        const width = Math.round((currentNeedle.endAngle - currentNeedle.startAngle + step) * 1000) / 1000;
        if (width < 1.0) {
          needleBands.push({
            startAngle: currentNeedle.startAngle,
            endAngle: currentNeedle.endAngle,
            width,
            maxQuality: currentNeedle.maxQuality,
            angles: currentNeedle.angles,
          });
        }
        currentNeedle = null;
      }
    }
  }
  if (currentNeedle) {
    const width = Math.round((currentNeedle.endAngle - currentNeedle.startAngle + step) * 1000) / 1000;
    if (width < 1.0) {
      needleBands.push({
        startAngle: currentNeedle.startAngle,
        endAngle: currentNeedle.endAngle,
        width,
        maxQuality: currentNeedle.maxQuality,
        angles: currentNeedle.angles,
      });
    }
  }

  return {
    pctChanged025: (materiallyChanged025 / totalEvaluated) * 100,
    pctChanged050: (materiallyChanged050 / totalEvaluated) * 100,
    pctChanged100: (materiallyChanged100 / totalEvaluated) * 100,
    needleBands,
  };
}

// -------------------------------------------------------------
// Good-Angle Bandwidth Analysis
// -------------------------------------------------------------
export function analyzeBandwidth(samples, step = 0.25) {
  const sortedDmg = [...samples].sort((a, b) => b.damage - a.damage);
  const sortedQ = [...samples].sort((a, b) => b.compositeQuality - a.compositeQuality);

  const top10DmgThreshold = sortedDmg[Math.floor(sortedDmg.length * 0.10)].damage;
  const top20QThreshold = sortedQ[Math.floor(sortedQ.length * 0.20)].compositeQuality;
  const maxQ = sortedQ[0].compositeQuality;
  const robustThreshold = 0.8 * maxQ;

  let top10DmgCount = 0;
  let top20QCount = 0;

  let currentRobustRun = 0;
  let maxRobustContiguousRun = 0;
  let robustContiguousBands = [];
  let currentBand = null;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.damage >= top10DmgThreshold && top10DmgThreshold > 0) top10DmgCount++;
    if (s.compositeQuality >= top20QThreshold) top20QCount++;

    if (s.compositeQuality >= robustThreshold) {
      currentRobustRun++;
      if (!currentBand) {
        currentBand = { startAngle: s.angle, endAngle: s.angle, count: 1 };
      } else {
        currentBand.endAngle = s.angle;
        currentBand.count++;
      }
    } else {
      if (currentRobustRun > maxRobustContiguousRun) {
        maxRobustContiguousRun = currentRobustRun;
      }
      if (currentBand) {
        currentBand.width = currentBand.count * step;
        robustContiguousBands.push(currentBand);
        currentBand = null;
      }
      currentRobustRun = 0;
    }
  }
  if (currentRobustRun > maxRobustContiguousRun) {
    maxRobustContiguousRun = currentRobustRun;
  }
  if (currentBand) {
    currentBand.width = currentBand.count * step;
    robustContiguousBands.push(currentBand);
  }

  // Count isolated single-sample spikes in top 10%
  let isolatedSpikesCount = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].compositeQuality >= top20QThreshold) {
      const prevQ = i > 0 ? samples[i - 1].compositeQuality : 0;
      const nextQ = i < samples.length - 1 ? samples[i + 1].compositeQuality : 0;
      if (prevQ < top20QThreshold && nextQ < top20QThreshold) {
        isolatedSpikesCount++;
      }
    }
  }

  return {
    top10DmgWidthDeg: top10DmgCount * step,
    top20QWidthDeg: top20QCount * step,
    maxRobustContiguousWidthDeg: maxRobustContiguousRun * step,
    robustContiguousBands,
    isolatedSpikesCount,
  };
}
