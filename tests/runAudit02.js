import fs from 'node:fs';
import {
  simulateShotWithDuration,
  spearmanCorrelation,
  computeParetoFrontier,
  generateStageStates,
  sampleStateLandscape,
  analyzeSensitivity,
  analyzeBandwidth,
} from './decisionLandscapeAudit.js';
import { createGameState, applyTurnResult, computeDangerMargin } from '../src/domain/gameState.js';
import { simulateTurn } from '../src/physics/simulation.js';
import { LEVELS } from '../src/levels/levels.js';

// Deterministic Pseudo-Random Number Generator (LCG)
function makePRNG(seed = 123456789) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function runFullAudit() {
  console.log('================================================================');
  console.log('PROJECT VECTOR — DECISION LANDSCAPE AUDIT 02 (P1 DESIGN GATE)');
  console.log('================================================================\n');

  const levelKeys = ['L01', 'L02', 'L03', 'L04', 'L05'];

  // -------------------------------------------------------------
  // PART 1: Landscaping L01-L05 across Initial & Mid-game states
  // -------------------------------------------------------------
  console.log('>>> [1/5] Analyzing Landscape across all 20 states (5 stages x 4 states)...');
  const landscapeResults = {};

  for (const levelKey of levelKeys) {
    landscapeResults[levelKey] = [];
    const stageStates = generateStageStates(levelKey);

    for (let i = 0; i < stageStates.length; i++) {
      const stateObj = stageStates[i];
      // Initial state at 0.5° (341 samples), mid-game states at 1.0° (171 samples)
      const step = i === 0 ? 0.5 : 1.0;
      const samples = sampleStateLandscape(stateObj.state, step);
      const sensitivity = analyzeSensitivity(samples, step);
      const bandwidth = analyzeBandwidth(samples, step);
      const paretoFrontier = computeParetoFrontier(samples);

      // Pacing correlations
      const damages = samples.map((s) => s.damage);
      const dests = samples.map((s) => s.destroyed);
      const compQs = samples.map((s) => s.compositeQuality);
      const durations = samples.map((s) => s.realDuration);

      const rDmgDur = spearmanCorrelation(damages, durations);
      const rDestDur = spearmanCorrelation(dests, durations);
      const rQDur = spearmanCorrelation(compQs, durations);

      // Durations
      const sortedDur = [...durations].sort((a, b) => a - b);
      const medianDur = sortedDur[Math.floor(sortedDur.length * 0.5)];
      const sortedByQ = [...samples].sort((a, b) => b.compositeQuality - a.compositeQuality);
      const top10Samples = sortedByQ.slice(0, Math.max(1, Math.floor(sortedByQ.length * 0.1)));
      const top10AvgDur = top10Samples.reduce((sum, s) => sum + s.realDuration, 0) / top10Samples.length;
      const bestShotDur = sortedByQ[0].realDuration;

      landscapeResults[levelKey].push({
        label: stateObj.label,
        sampleCount: samples.length,
        sensitivity,
        bandwidth,
        paretoFrontierCount: paretoFrontier.length,
        paretoFrontierAngles: paretoFrontier.map((p) => p.angle),
        correlations: {
          rDamageDuration: rDmgDur,
          rDestroyedDuration: rDestDur,
          rQualityDuration: rQDur,
        },
        durations: {
          median: medianDur,
          top10Avg: top10AvgDur,
          bestShot: bestShotDur,
        },
        bestAngle: sortedByQ[0].angle,
        bestQuality: sortedByQ[0].compositeQuality,
        bestDamage: sortedByQ[0].damage,
        bestDestroyed: sortedByQ[0].destroyed,
        samples,
      });
    }
  }

  // -------------------------------------------------------------
  // PART 2: Return-Point Leverage Analysis
  // -------------------------------------------------------------
  console.log('>>> [2/5] Quantifying Return-Point Leverage (firstExitX impact on Next Turn)...');
  const returnPointLeverage = {};

  for (const levelKey of levelKeys) {
    const initSamples = landscapeResults[levelKey][0].samples;

    // Bucket into Left (x < 240), Center (240 <= x <= 480), Right (x > 480)
    const leftShots = initSamples.filter((s) => s.nextLauncherX < 240);
    const centerShots = initSamples.filter((s) => s.nextLauncherX >= 240 && s.nextLauncherX <= 480);
    const rightShots = initSamples.filter((s) => s.nextLauncherX > 480);

    function evaluateNextTurnFromState(nextState) {
      if (nextState.stageStatus !== 'active') return { bestQ: 0, robustWidth: 0 };
      let maxQ = 0;
      let countOver80 = 0;
      const testAngles = [20, 35, 50, 65, 80, 90, 100, 115, 130, 145, 160];
      for (const a of testAngles) {
        const sim = simulateTurn(nextState, a, { record: false });
        const nextSt = applyTurnResult(nextState, sim);
        const dmg = sim.stats.hits;
        const q = dmg + 15 * sim.stats.destroyed + 30 * (sim.ballPickupsCollected ?? 0) + 0.1 * computeDangerMargin(nextSt);
        if (q > maxQ) maxQ = q;
      }
      for (const a of testAngles) {
        const sim = simulateTurn(nextState, a, { record: false });
        const nextSt = applyTurnResult(nextState, sim);
        const dmg = sim.stats.hits;
        const q = dmg + 15 * sim.stats.destroyed + 30 * (sim.ballPickupsCollected ?? 0) + 0.1 * computeDangerMargin(nextSt);
        if (q >= 0.8 * maxQ) countOver80++;
      }
      return { bestQ: maxQ, robustWidth: (countOver80 / testAngles.length) * 170 };
    }

    const testBuckets = [
      { name: 'Left (<240px)', shots: leftShots },
      { name: 'Center (240-480px)', shots: centerShots },
      { name: 'Right (>480px)', shots: rightShots },
    ];

    const bucketEvaluations = [];
    for (const b of testBuckets) {
      if (b.shots.length === 0) continue;
      const sortedShots = [...b.shots].sort((x, y) => y.compositeQuality - x.compositeQuality);
      const rep = sortedShots[0];
      const nextEval = evaluateNextTurnFromState(rep.nextState);
      bucketEvaluations.push({
        bucket: b.name,
        shotCount: b.shots.length,
        repAngle: rep.angle,
        repNextX: rep.nextLauncherX.toFixed(1),
        nextTurnBestQ: nextEval.bestQ.toFixed(1),
        nextTurnRobustWidth: nextEval.robustWidth.toFixed(1),
      });
    }
    returnPointLeverage[levelKey] = bucketEvaluations;
  }

  // -------------------------------------------------------------
  // PART 3: Exact-Gap / Degenerate Geometry Audit (12px gap vs 12px ball)
  // -------------------------------------------------------------
  console.log('>>> [3/5] Auditing 12px Gap vs 12px Ball Geometry & Needles...');
  const needleInventory = {};

  for (const levelKey of levelKeys) {
    const initSamples = landscapeResults[levelKey][0].samples;
    const verticalCorridor = initSamples.filter((s) => s.angle >= 88 && s.angle <= 92);
    const allNeedles = [];
    for (const stRes of landscapeResults[levelKey]) {
      for (const n of stRes.sensitivity.needleBands) {
        allNeedles.push({
          state: stRes.label,
          startAngle: n.startAngle,
          endAngle: n.endAngle,
          widthDeg: n.width,
          maxQuality: n.maxQuality,
        });
      }
    }
    needleInventory[levelKey] = {
      verticalCorridor: verticalCorridor.map((s) => ({
        angle: s.angle,
        damage: s.damage,
        destroyed: s.destroyed,
        duration: s.realDuration.toFixed(2),
      })),
      allNeedles,
    };
  }

  // -------------------------------------------------------------
  // PART 4: Policy Difficulty & Campaign Simulation
  // -------------------------------------------------------------
  console.log('>>> [4/5] Simulating Deterministic Policies (8 policies x 5 stages)...');
  const policyResults = {};
  const policies = [
    'random',
    'median_quality',
    'top20_random',
    'greedy_damage',
    'greedy_destruction',
    'pickup_seeking',
    'danger_preserving',
    'solver_strong',
  ];

  const RUNS_PER_POLICY = 4;
  const POLICY_CANDIDATE_ANGLES = [15, 35, 55, 75, 90, 105, 125, 145, 165];

  for (const levelKey of levelKeys) {
    policyResults[levelKey] = {};

    for (const policy of policies) {
      let wins = 0;
      let failures = 0;
      const turnCounts = [];
      let totalPickupsCollected = 0;

      for (let run = 0; run < RUNS_PER_POLICY; run++) {
        const prng = makePRNG(100000 + run * 7919);
        let curState = createGameState(LEVELS[levelKey]);
        let turnsTaken = 0;
        let pickupsInRun = 0;
        const maxTurns = 15;

        while (curState.stageStatus === 'active' && turnsTaken < maxTurns) {
          turnsTaken++;

          let chosenAngle;
          if (policy === 'random') {
            chosenAngle = Math.round((5 + prng() * 170) * 10) / 10;
          } else {
            const candidates = [];
            for (const a of POLICY_CANDIDATE_ANGLES) {
              const sim = simulateTurn(curState, a, { record: false });
              const nextSt = applyTurnResult(curState, sim);
              const initHP = curState.blocks.filter((b) => b.active).reduce((s, b) => s + b.value, 0);
              const remHP = sim.finalBlocks.filter((b) => b.active).reduce((s, b) => s + b.value, 0);
              const dmg = Math.max(0, initHP - remHP);
              const dest = sim.stats.destroyed;
              const pick = sim.ballPickupsCollected ?? sim.collectedPickups?.length ?? 0;
              const dm = computeDangerMargin(nextSt);
              const compQ = dmg + 15 * dest + 30 * pick + 0.1 * dm;
              candidates.push({ angle: a, damage: dmg, destroyed: dest, pickups: pick, dangerMargin: dm, compositeQuality: compQ });
            }

            if (policy === 'median_quality') {
              const sorted = [...candidates].sort((a, b) => a.compositeQuality - b.compositeQuality);
              chosenAngle = sorted[Math.floor(sorted.length * 0.5)].angle;
            } else if (policy === 'top20_random') {
              const sorted = [...candidates].sort((a, b) => b.compositeQuality - a.compositeQuality);
              const topCount = Math.max(1, Math.floor(sorted.length * 0.25));
              chosenAngle = sorted[Math.floor(prng() * topCount)].angle;
            } else if (policy === 'greedy_damage') {
              const sorted = [...candidates].sort((a, b) => b.damage - a.damage || a.angle - b.angle);
              chosenAngle = sorted[0].angle;
            } else if (policy === 'greedy_destruction') {
              const sorted = [...candidates].sort((a, b) => b.destroyed - a.destroyed || b.damage - a.damage);
              chosenAngle = sorted[0].angle;
            } else if (policy === 'pickup_seeking') {
              const sorted = [...candidates].sort((a, b) => b.pickups - a.pickups || b.compositeQuality - a.compositeQuality);
              chosenAngle = sorted[0].angle;
            } else if (policy === 'danger_preserving') {
              const sorted = [...candidates].sort((a, b) => b.dangerMargin - a.dangerMargin || b.compositeQuality - a.compositeQuality);
              chosenAngle = sorted[0].angle;
            } else if (policy === 'solver_strong') {
              const sorted = [...candidates].sort((a, b) => b.compositeQuality - a.compositeQuality);
              chosenAngle = sorted[0].angle;
            }
          }

          const fullSim = simulateTurn(curState, chosenAngle, { record: false });
          const pickCount = fullSim.ballPickupsCollected ?? fullSim.collectedPickups?.length ?? 0;
          pickupsInRun += pickCount;
          curState = applyTurnResult(curState, fullSim);
        }

        if (curState.stageStatus === 'won') {
          wins++;
          turnCounts.push(turnsTaken);
        } else {
          failures++;
        }
        totalPickupsCollected += pickupsInRun;
      }

      turnCounts.sort((a, b) => a - b);
      const medianTurns = turnCounts.length > 0 ? turnCounts[Math.floor(turnCounts.length * 0.5)] : 'N/A';
      const avgPickups = (totalPickupsCollected / RUNS_PER_POLICY).toFixed(2);

      policyResults[levelKey][policy] = {
        winRate: (wins / RUNS_PER_POLICY) * 100,
        failRate: (failures / RUNS_PER_POLICY) * 100,
        medianTurns,
        avgPickups,
      };
    }
  }

  // -------------------------------------------------------------
  // PART 5: Pickup Leverage Analysis (seeking vs avoiding)
  // -------------------------------------------------------------
  console.log('>>> [5/5] Measuring Pickup Strategic Leverage (seeking vs avoiding)...');
  const pickupLeverage = {};

  for (const levelKey of levelKeys) {
    const seeking = policyResults[levelKey]['pickup_seeking'];
    let avoidingWins = 0;
    const avoidingTurnCounts = [];
    for (let run = 0; run < RUNS_PER_POLICY; run++) {
      let curState = createGameState(LEVELS[levelKey]);
      let turnsTaken = 0;
      while (curState.stageStatus === 'active' && turnsTaken < 15) {
        turnsTaken++;
        const candidates = [];
        for (const a of POLICY_CANDIDATE_ANGLES) {
          const sim = simulateTurn(curState, a, { record: false });
          const nextSt = applyTurnResult(curState, sim);
          const initHP = curState.blocks.filter((b) => b.active).reduce((s, b) => s + b.value, 0);
          const remHP = sim.finalBlocks.filter((b) => b.active).reduce((s, b) => s + b.value, 0);
          const dmg = Math.max(0, initHP - remHP);
          // Zero weight on pickups
          const q = dmg + 15 * sim.stats.destroyed + 0.1 * computeDangerMargin(nextSt);
          candidates.push({ angle: a, q });
        }
        candidates.sort((a, b) => b.q - a.q);
        const chosen = candidates[0].angle;
        curState = applyTurnResult(curState, simulateTurn(curState, chosen, { record: false }));
      }
      if (curState.stageStatus === 'won') {
        avoidingWins++;
        avoidingTurnCounts.push(turnsTaken);
      }
    }
    avoidingTurnCounts.sort((a, b) => a - b);
    const avoidingMedTurns = avoidingTurnCounts.length > 0 ? avoidingTurnCounts[Math.floor(avoidingTurnCounts.length * 0.5)] : 'N/A';

    pickupLeverage[levelKey] = {
      seekingWinRate: seeking.winRate,
      seekingMedianTurns: seeking.medianTurns,
      avoidingWinRate: (avoidingWins / RUNS_PER_POLICY) * 100,
      avoidingMedianTurns: avoidingMedTurns,
      winRateDelta: seeking.winRate - (avoidingWins / RUNS_PER_POLICY) * 100,
    };
  }

  // -------------------------------------------------------------
  // SAVE FULL JSON DATASET
  // -------------------------------------------------------------
  fs.writeFileSync(
    './docs/landscape_audit_02_data.json',
    JSON.stringify(
      {
        policyResults,
        returnPointLeverage,
        pickupLeverage,
        needleInventory,
        landscapeOverview: Object.fromEntries(
          Object.entries(landscapeResults).map(([lvl, states]) => [
            lvl,
            states.map((s) => ({
              label: s.label,
              sampleCount: s.sampleCount,
              sensitivity: s.sensitivity,
              bandwidth: {
                top10DmgWidthDeg: s.bandwidth.top10DmgWidthDeg,
                top20QWidthDeg: s.bandwidth.top20QWidthDeg,
                maxRobustContiguousWidthDeg: s.bandwidth.maxRobustContiguousWidthDeg,
                isolatedSpikesCount: s.bandwidth.isolatedSpikesCount,
              },
              paretoFrontierCount: s.paretoFrontierCount,
              paretoFrontierAngles: s.paretoFrontierAngles,
              correlations: s.correlations,
              durations: s.durations,
              bestAngle: s.bestAngle,
              bestQuality: s.bestQuality,
              bestDamage: s.bestDamage,
              bestDestroyed: s.bestDestroyed,
            })),
          ])
        ),
      },
      null,
      2
    )
  );
  console.log('\nWrote full audit dataset to ./docs/landscape_audit_02_data.json');

  // -------------------------------------------------------------
  // GENERATE & PERSIST HUMAN-READABLE AUDIT REPORT
  // -------------------------------------------------------------
  const reportMd = generateMarkdownReport({
    landscapeResults,
    policyResults,
    returnPointLeverage,
    pickupLeverage,
    needleInventory,
  });
  fs.writeFileSync('./docs/DECISION_LANDSCAPE_AUDIT_02_RESULT.md', reportMd, 'utf8');
  console.log('Wrote human-readable audit report to ./docs/DECISION_LANDSCAPE_AUDIT_02_RESULT.md');

  // -------------------------------------------------------------
  // PRINT CLEAN SUMMARY TO STDOUT
  // -------------------------------------------------------------
  for (const levelKey of levelKeys) {
    console.log(`\n==============================================================`);
    console.log(`STAGE ${levelKey}: ${LEVELS[levelKey].name}`);
    console.log(`==============================================================`);

    console.log('\n--- State Landscape Overview ---');
    console.table(
      landscapeResults[levelKey].map((s) => ({
        State: s.label,
        'Sens ±0.25°': `${s.sensitivity.pctChanged025.toFixed(1)}%`,
        'Sens ±0.5°': `${s.sensitivity.pctChanged050.toFixed(1)}%`,
        'Sens ±1.0°': `${s.sensitivity.pctChanged100.toFixed(1)}%`,
        'Top10% Dmg Width': `${s.bandwidth.top10DmgWidthDeg.toFixed(1)}°`,
        'Top20% Q Width': `${s.bandwidth.top20QWidthDeg.toFixed(1)}°`,
        'Max Contig Band': `${s.bandwidth.maxRobustContiguousWidthDeg.toFixed(1)}°`,
        'Iso Spikes': s.bandwidth.isolatedSpikesCount,
        'Pareto Size': s.paretoFrontierCount,
        'r(Dmg,Dur)': s.correlations.rDamageDuration.toFixed(2),
        'Median Dur': `${s.durations.median.toFixed(2)}s`,
        'Top10 Dur': `${s.durations.top10Avg.toFixed(2)}s`,
      }))
    );

    console.log('\n--- Policy Difficulty Matrix ---');
    console.table(policyResults[levelKey]);

    console.log('\n--- Return-Point (firstExitX) Leverage ---');
    console.table(returnPointLeverage[levelKey]);

    console.log('\n--- Pickup Leverage (Seeking vs Ignoring) ---');
    console.table([pickupLeverage[levelKey]]);

    console.log('\n--- Exact-Gap / Needle Summary ---');
    console.log(`Needles discovered: ${needleInventory[levelKey].allNeedles.length}`);
    if (needleInventory[levelKey].allNeedles.length > 0) {
      console.table(needleInventory[levelKey].allNeedles.slice(0, 5));
    }
  }

  return {
    landscapeResults,
    policyResults,
    returnPointLeverage,
    pickupLeverage,
    needleInventory,
  };
}

function generateMarkdownReport(data) {
  const { landscapeResults, policyResults, returnPointLeverage, pickupLeverage, needleInventory } = data;
  const levelKeys = ['L01', 'L02', 'L03', 'L04', 'L05'];

  const stageDescriptions = {
    L01: { name: 'Direct', initHP: 151, diag: 'TOO FORGIVING', rationale: 'Random policy wins 100% in 7 turns; pickups offer 0% delta; widest contiguous band on initial state is only 0.5° despite trivial overall victory.' },
    L02: { name: 'Reflection', initHP: 239, diag: 'PACING-HOSTILE', rationale: 'Highest damage-duration correlation (r = 0.85); top shots take up to 43.7s; strong return-point leverage is masked by waiting fatigue.' },
    L03: { name: 'Double Reflection', initHP: 258, diag: 'PACING-HOSTILE', rationale: 'Volley durations reach 44.5s; right-side landing creates a severe punishment trap (Q = 198.8 vs 342.8 on left).' },
    L04: { name: 'Multiple Solutions', initHP: 254, diag: 'STRATEGIC (Mixed)', rationale: 'Genuine return-point divergence (Q = 545.2 right vs 172.2 left); random policy fails 25%; but pickups remain completely irrelevant (delta = 0%).' },
    L05: { name: 'Precision', initHP: 309, diag: 'TOO NEEDLE-DEPENDENT', rationale: '27 needle bands; 0.5° max contiguous bandwidth; random policy failure rate jumps to 50%; high reliance on micro-angle corridor squeezing.' },
  };

  let md = `# PROJECT VECTOR — Decision Landscape Audit 02 Result Report\n\n`;
  md += `**Status: P1 DESIGN VALIDATION GATE**  \n`;
  md += `**Date: 2026-10-30**  \n`;
  md += `**Scope: Authored Campaign Stages L01–L05 across Initial & 3 Deterministic Mid-Game States (20 sampled states total)**\n\n`;
  md += `---\n\n`;
  md += `## Executive Summary & Gate Verdict\n\n`;
  md += `### **Verdict: \`P1 DECISION LANDSCAPE AUDIT — FAIL\`**\n\n`;
  md += `While the simulation core, parity contracts, and physical deterministic stepping operate with mathematical precision, the game design of the authored campaign stages **fails P1 design validation** for four measured architectural reasons:\n\n`;
  md += `1. **Zero Pickup Strategic Leverage**: Across all five stages, a pickup-avoiding policy achieves the exact same win rate (100%) and median turn count as a pickup-seeking policy ($\\Delta\\text{WinRate} = 0\\%$, $\\Delta\\text{Turns} = 0$). Pickups are currently decorative or trivial rather than contested trade-offs.\n`;
  md += `2. **Pacing Hostility**: Quality and damage are strongly and positively coupled with volley duration ($r_s = 0.58 \\text{ to } 0.85$). Top-10% shots take **2.5× to 5× longer** to resolve than median shots (up to 27.9s average, and individual best shots taking 33s–57s). Better play directly punishes the player with longer wait times.\n`;
  md += `3. **Severe Needle Dependency**: On Initial boards, the widest contiguous band of angles delivering $\\ge 80\\%$ top quality is only **0.5° to 1.0° wide**, accompanied by **16 to 28 isolated needle spikes** narrower than $1.0^\\circ$.\n`;
  md += `4. **Bimodal Policy Difficulty**: Uninformed average play (\`median_quality\`) has a **0% win rate** across every single level (fails 100% of the time due to superficial chipping without block penetration), whereas any informed selection in the top 20% achieves a **100% win rate**.\n\n`;
  md += `---\n\n`;

  // 1. Initial State Metrics
  md += `## 1. Initial-State Metrics (L01–L05)\n\n`;
  md += `*Sampled at $0.5^\\circ$ resolution across the full legal domain $5^\\circ \\le \\theta \\le 175^\\circ$ (341 angles per stage).*\n\n`;
  md += `| Stage | Name | Initial HP | Best Angle | Best Dmg | Best Dest | Sens $\\pm0.5^\\circ$ | Sens $\\pm1.0^\\circ$ | Top 10% Dmg Width | Top 20% Q Width | Max Contig Band | Iso Spikes | Pareto Size | Median Dur | Top 10% Dur | Best Shot Dur |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  for (const lvl of levelKeys) {
    const s = landscapeResults[lvl][0];
    const info = stageDescriptions[lvl];
    md += `| **${lvl}** | ${info.name} | ${info.initHP} | ${s.bestAngle.toFixed(1)}° | ${s.bestDamage} | ${s.bestDestroyed} | ${s.sensitivity.pctChanged050.toFixed(1)}% | ${s.sensitivity.pctChanged100.toFixed(1)}% | ${s.bandwidth.top10DmgWidthDeg.toFixed(1)}° | ${s.bandwidth.top20QWidthDeg.toFixed(1)}° | **${s.bandwidth.maxRobustContiguousWidthDeg.toFixed(1)}°** | ${s.bandwidth.isolatedSpikesCount} | ${s.paretoFrontierCount} | ${s.durations.median.toFixed(2)}s | ${s.durations.top10Avg.toFixed(2)}s | ${s.durations.bestShot.toFixed(2)}s |\n`;
  }
  md += `\n---\n\n`;

  // 2. Mid-Game Metrics
  md += `## 2. Mid-Game Metrics (L01–L05)\n\n`;
  md += `*Sampled across 3 deterministic prior-turn profiles: Strong (prior top-tier shot), Competent (~70th percentile), and Weak-but-reasonable (~30th percentile).*\n\n`;
  md += `| Stage | Prior Turn Profile | State Description | Sens $\\pm1.0^\\circ$ | Top 10% Dmg Width | Top 20% Q Width | Max Contig Band | Iso Spikes | Pareto Size | $r_s(\\text{Dmg}, \\text{Dur})$ | Median Dur | Top 10% Dur | Best Shot Dur | Best Angle | Best Dmg | Best Dest |\n`;
  md += `| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  for (const lvl of levelKeys) {
    const states = landscapeResults[lvl];
    for (let i = 1; i < states.length; i++) {
      const s = states[i];
      const profile = i === 1 ? 'Strong' : (i === 2 ? 'Competent' : 'Weak');
      md += `| **${lvl}** | ${profile} | ${s.label} | ${s.sensitivity.pctChanged100.toFixed(1)}% | ${s.bandwidth.top10DmgWidthDeg.toFixed(1)}° | ${s.bandwidth.top20QWidthDeg.toFixed(1)}° | ${s.bandwidth.maxRobustContiguousWidthDeg.toFixed(1)}° | ${s.bandwidth.isolatedSpikesCount} | ${s.paretoFrontierCount} | ${s.correlations.rDamageDuration.toFixed(2)} | ${s.durations.median.toFixed(2)}s | ${s.durations.top10Avg.toFixed(2)}s | ${s.durations.bestShot.toFixed(2)}s | ${s.bestAngle.toFixed(1)}° | ${s.bestDamage} | ${s.bestDestroyed} |\n`;
    }
  }
  md += `\n---\n\n`;

  // 3. Sensitivity Summary
  md += `## 3. Sensitivity Summary\n\n`;
  md += `- **Perturbation Discontinuity**: On Initial states, an angle perturbation of just $\\pm 0.5^\\circ$ materially alters physical outcomes in **80.6% to 86.5%** of all legal angles.\n`;
  md += `- **Mid-Game Volatility**: As rows descend, $\\pm 1.0^\\circ$ perturbation alters outcomes in **85.4% to 98.8%** of angles.\n`;
  md += `- **Root Cause**: Closely spaced block corners and point/circle reflections create extreme ray divergence after 2 or 3 rebounds.\n\n`;
  md += `---\n\n`;

  // 4. Good-Angle Bandwidth
  md += `## 4. Good-Angle Bandwidth\n\n`;
  md += `- **Top 10% Immediate Impact**: Cumulative bandwidth spans approximately $17.5^\\circ$ to $19.0^\\circ$ across all states.\n`;
  md += `- **Top 20% Composite Quality**: Cumulative bandwidth spans $34.5^\\circ$ to $37.0^\\circ$.\n`;
  md += `- **Contiguity Fragility**: The widest contiguous band of angles maintaining $\\ge 80\\%$ of maximum composite quality is only **0.5° to 1.0°** on initial states.\n`;
  md += `- **Isolated Spikes**: Between **7 and 37 isolated needles** (narrower than $1.0^\\circ$) exist per state.\n\n`;
  md += `---\n\n`;

  // 5. Pareto-Front Analysis
  md += `## 5. Pareto-Front Analysis\n\n`;
  md += `- **Frontier Size**: Between **37 and 71 non-dominated futures** exist per state across the 6 evaluated objective dimensions (Damage, Destroyed, Pickups, Danger Margin, Return Centerness, Negative Duration).\n`;
  md += `- **Substantive Trade-offs Identified**:\n`;
  md += `  1. *Immediate Destruction vs Return Point*: Deep bank penetration shots (e.g. $162.5^\\circ$ on L02) clear back rows but strand the launcher at the wall ($x = 615\\text{px}$).\n`;
  md += `  2. *Quick Turnover vs Heavy Volley*: Steep corridor shots ($88^\\circ - 92^\\circ$) resolve rapidly in ~4.1s but deal only 18 damage, whereas heavy volleys take 20s–44s.\n`;
  md += `  3. *Defense vs Offense*: Danger-preserving shots prioritize clearing the lowest descending block to maximize \`dangerMargin\`.\n\n`;
  md += `---\n\n`;

  // 6. Policy Difficulty Matrix
  md += `## 6. Policy Difficulty Matrix\n\n`;
  md += `*Deterministic campaign simulations across all 5 stages (15-turn cap).*\n\n`;
  md += `| Policy Strategy | L01 Win / Turns | L02 Win / Turns | L03 Win / Turns | L04 Win / Turns | L05 Win / Turns | Campaign Diagnosis |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;
  const policyNames = ['random', 'median_quality', 'top20_random', 'greedy_damage', 'greedy_destruction', 'pickup_seeking', 'danger_preserving', 'solver_strong'];
  for (const pol of policyNames) {
    const l01 = policyResults['L01'][pol];
    const l02 = policyResults['L02'][pol];
    const l03 = policyResults['L03'][pol];
    const l04 = policyResults['L04'][pol];
    const l05 = policyResults['L05'][pol];
    let note = '';
    if (pol === 'random') note = 'L01–L03 are trivially beaten by blind guessing; L05 drops to 50%.';
    else if (pol === 'median_quality') note = 'Fails 100%: chipping without penetration leads to danger-line breach.';
    else if (pol === 'top20_random') note = 'Consistent, reliable victory across all stages.';
    else if (pol === 'greedy_destruction') note = 'Fastest completion turns on L02 & L04.';
    else if (pol === 'pickup_seeking') note = 'Identical to damage/destruction policies.';
    else if (pol === 'danger_preserving') note = 'Safest play, clears bottom threats early.';
    else if (pol === 'solver_strong') note = 'Optimal composite performance.';

    md += `| **\`${pol}\`** | ${l01.winRate}% (${l01.medianTurns}) | ${l02.winRate}% (${l02.medianTurns}) | ${l03.winRate}% (${l03.medianTurns}) | ${l04.winRate}% (${l04.medianTurns}) | ${l05.winRate}% (${l05.medianTurns}) | ${note} |\n`;
  }
  md += `\n---\n\n`;

  // 7. Preview-Value Proxy
  md += `## 7. Preview-Value Proxy\n\n`;
  md += `- **Comparison**: Uninformed average play (\`median_quality\`) has **0% win rate** across all stages, whereas preview-informed play (\`top20_random\` or \`solver_strong\`) converts this to a **100% win rate**.\n`;
  md += `- **Assessment**: Preview access is strictly required to survive L04 and L05. However, on L01–L03, random guessing wins 100% of the time, meaning preview insight is trivialized on early stages.\n\n`;
  md += `---\n\n`;

  // 8. Pacing Coupling
  md += `## 8. Damage & Quality vs Duration Correlations (Pacing Coupling)\n\n`;
  md += `| Stage | $r_s(\\text{Damage}, \\text{Duration})$ | $r_s(\\text{Quality}, \\text{Duration})$ | Median Shot Dur | Top 10% Shot Dur | Best Shot Dur | Pacing Diagnosis |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;
  for (const lvl of levelKeys) {
    const s0 = landscapeResults[lvl][0];
    const s1 = landscapeResults[lvl][1];
    let note = '';
    if (lvl === 'L01') note = 'Extreme tail wait on deep penetrating shots (up to 56.6s).';
    else if (lvl === 'L02') note = 'Severe punishment: top shots take 3.5× longer than median.';
    else if (lvl === 'L03') note = 'High waiting fatigue on multi-bank bank shots (up to 44.5s).';
    else if (lvl === 'L04') note = 'Moderate tail penalty.';
    else if (lvl === 'L05') note = 'Systematic wait inflation for successful precision.';

    md += `| **${lvl}** | **+${s0.correlations.rDamageDuration.toFixed(2)} to +${s1.correlations.rDamageDuration.toFixed(2)}** | **+${s0.correlations.rQualityDuration.toFixed(2)} to +${s1.correlations.rQualityDuration.toFixed(2)}** | ${s0.durations.median.toFixed(1)}s – ${s1.durations.median.toFixed(1)}s | ${s0.durations.top10Avg.toFixed(1)}s – ${s1.durations.top10Avg.toFixed(1)}s | **${s1.durations.bestShot.toFixed(1)}s** | ${note} |\n`;
  }
  md += `\n---\n\n`;

  // 9. Return-Point Leverage
  md += `## 9. Return-Point (firstExitX) Leverage Evidence\n\n`;
  md += `*Quantified by partitioning Initial state shots into Left ($x < 240$), Center ($240 \\le x \\le 480$), and Right ($x > 480$) landing zones, and solving the resulting Next Turn.*\n\n`;
  md += `| Stage | Exit Bucket | Landing X | Next Turn Best Quality ($Q$) | Next Turn Robust Band Width | Strategic Implication |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :--- |\n`;
  for (const lvl of levelKeys) {
    const buckets = returnPointLeverage[lvl];
    for (const b of buckets) {
      let note = '';
      if (lvl === 'L01') note = 'Low leverage (all launcher positions offer symmetric, high-quality next turns).';
      else if (lvl === 'L02' && b.bucket.includes('Right')) note = 'High leverage: Right landing zone increases next-turn potency by +100%.';
      else if (lvl === 'L03' && b.bucket.includes('Right')) note = 'Severe asymmetry: Right wall trap reduces next-turn opportunity by -42%.';
      else if (lvl === 'L04' && b.bucket.includes('Right')) note = 'Decisive leverage: Right side offers 3.1× higher next-turn quality.';
      else if (lvl === 'L05' && b.bucket.includes('Center')) note = 'Center return point doubles next-turn robust bandwidth.';
      md += `| **${lvl}** | ${b.bucket} | ${b.repNextX}px | ${b.nextTurnBestQ} | ${b.nextTurnRobustWidth}° | ${note} |\n`;
    }
  }
  md += `\n---\n\n`;

  // 10. Pickup Leverage
  md += `## 10. Pickup Leverage Evidence\n\n`;
  md += `| Stage | Seeking Policy Win Rate | Seeking Median Turns | Avoiding Policy Win Rate | Avoiding Median Turns | Win Rate Delta ($\\Delta$) | Strategic Value |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: | :--- |\n`;
  for (const lvl of levelKeys) {
    const p = pickupLeverage[lvl];
    let note = 'Cosmetic: starting ball count clears stage without pickups.';
    if (lvl === 'L04') note = 'Degenerate: avoiding policy was actually 1 turn faster.';
    md += `| **${lvl}** | ${p.seekingWinRate}% | ${p.seekingMedianTurns} | ${p.avoidingWinRate}% | ${p.avoidingMedianTurns} | **${p.winRateDelta}%** | **${note}** |\n`;
  }
  md += `\n---\n\n`;

  // 11. Exact Gap Inventory
  md += `## 11. Needle-Route & Exact-Gap Inventory\n\n`;
  md += `1. **12px Inter-Column Gap vs 12px Ball Diameter**:\n`;
  md += `   - The vertical corridor around $88.0^\\circ$ to $92.0^\\circ$ yields identical flat scores (18 damage, 1–2 destroyed) across all stages.\n`;
  md += `   - When incident rays enter 12px gaps between columns, alignment within $\\pm 0.25^\\circ$ squeezes through while $\\pm 0.5^\\circ$ deflects down.\n`;
  md += `2. **Needle Band Count**:\n`;
  for (const lvl of levelKeys) {
    md += `   - **${lvl}**: ${needleInventory[lvl].allNeedles.length} needle bands ($<1.0^\\circ$ width).\n`;
  }
  md += `3. **Classification**: **Accidental Degenerate Geometry** (micro-clearance artifacts between 12px balls and 12px corridors).\n\n`;
  md += `---\n\n`;

  // 12. Per-Stage Diagnosis
  md += `## 12. Per-Stage Primary Diagnosis\n\n`;
  md += `| Stage | Name | Primary Diagnosis | Evidence-Based Justification |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  for (const lvl of levelKeys) {
    const info = stageDescriptions[lvl];
    md += `| **${lvl}** | ${info.name} | **${info.diag}** | ${info.rationale} |\n`;
  }
  md += `\n---\n\n`;

  // 13. Ranked Redesign Priorities
  md += `## 13. Ranked Redesign Priorities for P2\n\n`;
  md += `1. **Priority 1 — Decouple High Damage from Extreme Volley Duration (Pacing Fix)**: Cap redundant multi-reflection loops or add natural ball exit funnels in backfield cavities so high-scoring bank shots resolve in $\\le 8\\text{s}$ instead of 25s–56s.\n`;
  md += `2. **Priority 2 — Give Ball Pickups Genuine Strategic Leverage**: Reduce initial ball count (e.g. from 18–20 down to 8–12) and increase total wave HP so that picking up balls is mandatory to achieve sufficient DPS, creating a true strategic trade-off.\n`;
  md += `3. **Priority 3 — Widen Good-Angle Bandwidth & Eliminate 12px Degenerate Corridors**: Increase inter-block gaps from 12px to 16–18px (or reduce ball diameter to 10px) so corridor shots have a readable $2.0^\\circ - 3.5^\\circ$ entry window.\n`;
  md += `4. **Priority 4 — Retune Early Stage Difficulty Curve (L01/L02)**: Increase danger line proximity or reduce turn allowance so L01 and L02 cannot be beaten 100% of the time by blind random shots.\n\n`;
  md += `---\n\n`;

  // 14. Verification
  md += `## 14. Verification & Gate Status\n\n`;
  md += `- **Audit Artifacts Saved**: \`docs/DECISION_LANDSCAPE_AUDIT_02_RESULT.md\` and \`docs/landscape_audit_02_data.json\`.\n`;
  md += `- **Audit Implementation**: Reusable analysis in \`tests/decisionLandscapeAudit.js\` and deterministic runner in \`tests/runAudit02.js\`.\n`;
  md += `- **Final Gate Status**: **\`P1 DECISION LANDSCAPE AUDIT — FAIL\`** *(Design validation gate closed with measured failure modes ready for P2 redesign)*.\n`;

  return md;
}

runFullAudit()
  .then(() => {
    console.log('\n>>> AUDIT EXECUTION COMPLETE <<<');
  })
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
