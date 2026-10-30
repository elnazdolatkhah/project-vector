# PROJECT VECTOR — Future Commitment Contract 01

Status: P0 BLOCKER
Date: 2026-10-30

## Product contract

**The future visible at release is the future that becomes real.**

This is stricter than Simulation parity.

Same state + same angle already produces the same result. The missing guarantee is that UI release commits the same angle whose authoritative preview is visible.

## Current defect

Current App.tsx:
- authoritative preview recomputation is debounced;
- the displayed Future may therefore represent an earlier angle;
- pointer-up clears the pending preview timer;
- pointer-up then recomputes angle from pointer-up coordinates;
- playTurn(finalAngle) launches immediately.

A fast final pointer movement can therefore commit an angle the player never saw previewed.

## Required architecture

Maintain an explicit authoritative-preview record:
- preview state/lifecycle token;
- previewAngle;
- preview result;
- preview generation id or timestamp if useful.

On release:
- commit previewAngle, not a newly recomputed unseen angle;
- if no valid authoritative preview exists for the current lifecycle, do not silently fire an unpreviewed future.

Preferred UX:
- immediate pointer motion can continue visually;
- authoritative Future updates on its current cadence;
- release selects the most recently completed authoritative Future.

Do not introduce best-angle snapping.

## Important design question

The UI may show a visual aim ray between authoritative updates. That visual ray must not be mistaken for the committed Future.

If necessary, distinguish:
- live exploratory pointer angle;
- authoritative preview angle.

But the player must always understand what will be committed.

## Required tests

Use actual App integration where possible.

Cases:
1. pointer move -> preview completes -> release without movement;
2. final move <35 ms before release;
3. pointer-up coordinate differs from last pointer-move;
4. rapid scrub then immediate release;
5. exact 90° needle band;
6. ±0.25° sensitivity fixture;
7. 5° and 175° bounds;
8. pointer cancel with pending preview;
9. level reset invalidates old preview;
10. lifecycle token invalidates stale preview callback.

Assertions:
- committedAngle === visibleAuthoritativePreviewAngle;
- preview.result === committed authoritative result;
- no unseen-angle launch;
- exactly one launch;
- no stale callback after commitment.

## Performance cleanup

analyzeRobustness is currently computed in App.tsx but its ref is not consumed by the visible UI.

Remove it from the interactive preview hot path unless a current feature demonstrably uses it.

Keep robustness analysis available as offline/design tooling if useful.

## Out of scope

Do not:
- change physics;
- change stage layouts;
- quantize the entire legal domain without separate evidence;
- add magnet-to-best behavior;
- rebalance levels;
- change Future Echo design.

## Exit

P0 passes only when the real App interaction proves:
**what the player saw is exactly what the player chose.**