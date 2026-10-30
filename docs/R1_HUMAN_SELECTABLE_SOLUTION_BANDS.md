# PROJECT VECTOR — R1 Human-Selectable Solution Bands

Status: EXECUTION CALIBRATION
Date: 2026-10-30

## Goal

Reduce accidental sub-degree needle dependence without changing global physics or erasing each stage's identity.

## Baseline evidence

- Initial-state strong-route contiguity is commonly 0.5°–1.0°.
- Needle spikes appear across many angles, not only the exact 90° corridor.
- 90° itself shows a repeatable discontinuity caused by the 12px inter-column gap matching the 12px ball diameter.
- Therefore a global gap/radius change is not justified yet; local authored geometry must be tested first.

## Strategy

Treat R1 as local geometry calibration.

Do not change:
- ballRadius;
- ballSpeed;
- fixedDt;
- global interColumnGap;
- global blockWidth;
- collision math;
- aim domain;
- presentation scheduler.

Only authored stage geometry may change in this pass.

## Stage order

1. L01 — establish a broad readable baseline.
2. L05 — prove precision can remain precise without accidental degeneracy.
3. L02/L03 — preserve reflection identity while widening important entry bands.
4. L04 — minimal intervention; preserve current strategic diversity.

## Target bands

L01-L04:
- primary strong strategic routes should have at least one contiguous human-selectable band >=2°;
- preferred important bands: 2°–5°;
- isolated <1° spikes may exist only if they are not disproportionately dominant.

L05:
- intentional precision bands may be narrower;
- primary viable precision routes should generally be >=1°;
- no route should derive its value solely from exact 12px/12px clearance.

## Method

For each stage:
1. identify top needle routes from the stored P1 dataset;
2. trace the collision path and identify the specific local geometry causing the discontinuity;
3. generate 2–4 authored geometry candidates;
4. rerun only that stage's landscape audit;
5. compare band width, Pareto diversity, random-policy behavior, return-point leverage and duration;
6. reject candidates that improve robustness by flattening strategic identity.

## Allowed local edits

- horizontal offset of individual authored blocks/rows;
- vertical offset of individual authored blocks/rows;
- selective removal/addition of authored blockers;
- local blocker width/height changes where stage-specific;
- local wave composition/placement if needed for maintaining the same teaching intent.

## Forbidden shortcut

Do not widen every column gap globally.
Do not shrink the ball globally.
Do not quantize aim.
Do not snap to good angles.
Do not smooth or average simulation outcomes.

## L01 calibration objective

Current role: Direct.

Need:
- broad direct routes;
- random play not 100% reliable;
- no dominant accidental needle;
- simple readable contrast between mediocre direct shot and strong direct lane.

Change geometry, not HP first.

## L05 calibration objective

Current role: Precision.

Need:
- precision remains visibly narrower than earlier stages;
- route must be readable through Future preview;
- primary precision success should be reproducible over a deliberate band rather than a single 0.5° spike;
- remove reliance on exact-fit corridors.

## Acceptance metrics per candidate

Report:
- widest contiguous top-quality band;
- number of isolated <1° spikes;
- sensitivity at ±0.25°, ±0.5°, ±1°;
- Pareto-front size and diversity;
- random/top20/solver policy outcomes;
- median/top10/best duration;
- stage identity judgment.

## Exit

R1 passes when all five stages have human-selectable strong routes appropriate to their identity, and accidental exact-clearance needles no longer dominate strategic quality.