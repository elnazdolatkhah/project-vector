# PROJECT VECTOR — Core Validation Program 02

Status: ACTIVE RELIABILITY / CORE-DESIGN GATE
Date: 2026-10-30

## Why this program exists

External review confirmed that the engineering foundation is ahead of product proof.

No new gameplay feature, visual-polish pass, progression expansion, or content expansion should begin until the following gates are passed.

## P0 — Future Commitment Contract

### Problem
The preview angle can lag the live pointer because preview recomputation is debounced. On pointer-up, App.tsx recomputes a fresh angle from pointer coordinates and launches immediately.

Therefore the player can release while seeing Future A but commit Future B.

This violates the product contract:
**Release chooses the future currently shown to the player.**

### Required outcome
The authoritative shot angle must be exactly the angle belonging to the last authoritative preview visible at release.

### Acceptance
- preview angle and committed angle are identical;
- no pointer-up recomputation can silently select an unseen angle;
- release during a pending 35 ms recomputation is deterministic;
- rapid drag/release is covered;
- pointer-up at a coordinate different from the last pointer-move is covered;
- real App integration test, not a reimplemented handler harness;
- representative sensitive bands around 90°, 5°, 175°, and authored precision routes pass.

### Performance cleanup
Remove live-path robustness computation if it remains unused by UI.

## P1 — Decision Landscape Audit 02

Measure the actual strategic landscape across both initial and mid-game states.

For L01-L05 collect:
- sensitivity at ±0.25°, ±0.5°, ±1°;
- width of high-quality angle bands;
- Pareto-front size using damage, destruction, pickup, danger margin, next launcher;
- random / median / top-20% policy win rates;
- damage vs real presentation duration;
- best-shot duration vs median-shot duration;
- return-point leverage;
- pickup leverage;
- dangerous needle solutions such as exact-gap trajectories.

Required conclusion for each stage:
- strategic;
- too forgiving;
- too needle-dependent;
- too damage-dominated;
- pacing-hostile.

No stage rebalance before this report is complete.

## P2 — Real App Reliability Verification

Replace lifecycle harness-only confidence with integration evidence on App.tsx.

Required:
- mount actual App;
- real pointer down/move/up/cancel;
- release during pending preview debounce;
- multi-touch rejection;
- reset / next / previous during running, 2x, 6x, return slide, board transition;
- lifecycle-token stale callback prevention;
- terminal state input lock;
- background-tab / large frame-dt behavior where practical;
- resize/orientation during aim and volley.

The existing unit harness remains useful but cannot by itself close this gate.

## P3 — Gate D External Playtest

Only after P0-P2 pass.

Run 5-10 external players on the five-stage vertical slice.

Collect:
- time spent aiming;
- number of angle changes before release;
- preview use vs immediate firing;
- turn duration;
- failure rate;
- whether decisions improve after observing outcomes;
- whether preview changes choice versus a no-preview control;
- qualitative confusion;
- perceived waiting / pacing.

Compare a preview build with a controlled no-preview build.

## P4 — Source-of-Truth Reconciliation

Canonical implementation values as of 2026-10-30:
- legal angle: 5°-175°;
- fixedDt: 1/60;
- maxCollisionsPerStep: 32;
- authoritative watchdog: maxSimulationSteps 15000;
- deterministic authored waves L01-L05;
- Future Echo active;
- pickup economy active;
- row descent active;
- presentation-only volley acceleration 1x -> 2x -> 6x;
- lifecycleToken invalidation active;
- current regression suite: 152 tests at last verified audit.

Old specs that conflict with current code are historical until updated.

## Freeze

Until P0-P3 are passed:
- no new mechanics;
- no new stage family;
- no final art production;
- no procedural generation;
- no narrative expansion;
- no additional HUD analytics.

Bug fixes and validation instrumentation are allowed.

## Exit condition

The project leaves this program only when:
1. Release provably commits the visible Future.
2. Stage decision landscapes are measured and acceptable.
3. App.tsx lifecycle is integration-tested.
4. External playtest provides evidence that preview meaningfully improves/changes player decision-making.