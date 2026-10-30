# PROJECT VECTOR — Decision Landscape Audit 02

Status: P1 DESIGN-VALIDATION GATE
Date: 2026-10-30

## Purpose

Determine whether the five authored stages create meaningful strategic decisions or merely expose a few fragile high-scoring angles.

No rebalance is allowed before this audit is complete.

## Scope

Analyze L01-L05 across:
- initial state;
- at least 3 deterministic mid-game states per stage generated from representative strong / competent / weak-but-reasonable prior turns;
- all legal angles 5°-175° at 0.25° resolution where computationally feasible; otherwise 0.5° with targeted 0.25° refinement around discontinuities.

## Required metrics

### 1. Sensitivity
For each sampled state, measure result deltas for ±0.25°, ±0.5°, ±1°:
- damage;
- destroyed;
- pickups;
- firstExitX / nextLauncher displacement;
- dangerMargin;
- stage outcome where applicable.

Report percentage of angles where a tiny perturbation materially changes result.

Flag needle bands narrower than 1°.

### 2. Good-angle bandwidth

Define and report at least:
- top 10% damage band width;
- top 20% composite-quality band width;
- contiguous robust solution bands;
- isolated single-sample spikes.

Do not hide discontinuities by averaging.

### 3. Pareto frontier

Compute non-dominated futures using:
- damage;
- destroyed;
- pickup gain;
- danger margin after progression;
- next-launcher position / future access metric if available;
- real presentation duration.

Report Pareto-front size and whether trade-offs are genuinely different or merely score variants.

### 4. Policy difficulty

Simulate deterministic policies from each sampled state:
- random legal angle;
- median-quality angle;
- top-20%-quality random angle;
- greedy immediate damage;
- greedy destruction;
- pickup-seeking;
- danger-preserving;
- solver/strong profile.

For campaign completion report:
- win rate;
- median turns;
- failure rate;
- pickup dependence.

Use enough deterministic seeds/samples to make comparisons meaningful.

### 5. Pacing coupling

For each state/angle sample estimate real presentation duration under current 1x->2x->6x scheduler.

Measure:
- Spearman correlation between damage and real duration;
- destruction and duration;
- composite quality and duration;
- top-10% shot duration vs median shot duration.

Flag any stage where high-quality play is systematically much slower.

### 6. Return-point leverage

Measure whether different firstExitX outcomes materially change next-turn opportunity.

Do not treat launcher movement as strategic merely because the number changes.

Quantify next-turn quality from resulting launcher positions using the same solver metrics.

### 7. Pickup leverage

Measure:
- win-rate delta with pickup-seeking vs avoiding;
- turn-count delta;
- future-quality delta from added ball count;
- whether pickup is actually contested or simply free value.

### 8. Exact-gap / degenerate geometry

Specifically audit the 12px gap vs 12px ball diameter condition.

Measure around 90° and all other discovered corridor needles.

Classify whether each needle is:
- intentional precision skill;
- acceptable emergent route;
- accidental degenerate geometry.

Do not change geometry in this pass.

## Stage classification

Each stage must receive one primary diagnosis:
- STRATEGIC;
- TOO FORGIVING;
- TOO NEEDLE-DEPENDENT;
- TOO DAMAGE-DOMINATED;
- PACING-HOSTILE;
- MIXED / REQUIRES REDESIGN.

Support the diagnosis with data, not intuition.

## Preview-value proxy

Without claiming this replaces human playtest, compare policy performance with and without access to preview-derived quality ranking.

Report whether preview-informed selection produces a meaningful improvement in:
- win rate;
- turns-to-win;
- failure avoidance;
- pickup planning;
- launcher positioning.

This is only a proxy for P3 human validation.

## Deliverables

Return:
1. per-stage table for initial state;
2. per-stage table across mid-game states;
3. sensitivity heatmap/data summary;
4. Pareto-front summary;
5. policy win-rate/turn-count matrix;
6. damage-duration correlation;
7. return-point leverage evidence;
8. pickup leverage evidence;
9. needle-solution inventory;
10. stage diagnosis;
11. ranked redesign priorities;
12. explicit verdict: P1 PASS or FAIL.

## Rules

- analysis first;
- no stage rebalance;
- no physics changes;
- no input changes;
- no HUD changes;
- no new mechanics;
- no solver objective changes that affect gameplay;
- analysis tooling/tests may be added.

## Exit condition

P1 passes only if the team can explain, with measured evidence, what strategic choice each stage teaches and which current stages must be redesigned before playtest.