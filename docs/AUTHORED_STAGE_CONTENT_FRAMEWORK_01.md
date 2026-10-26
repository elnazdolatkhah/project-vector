# PROJECT VECTOR — Authored Stage Content Framework 01

Status: DESIGN + EXECUTION BRIEF
Date: 2026-10-26

## Problem

The finite-wave state machine is now correct, but current stage content is still prototype-level.

All L01–L05 currently use:
- totalWaves = 3;
- the same deterministic ROW_PATTERNS library;
- the same default seed when unspecified;
- the same generated HP formula based on turn/column;
- the same pickup cadence logic.

As a result, after the initial authored layout, the incoming wave structure across stages is too similar.

This undermines the meaning of stage names such as Direct, Reflection, Double Reflection, Multiple Solutions, and Precision.

## Product decision

Primary campaign stages should use **authored deterministic finite waves**, not a generic shared procedural row generator.

Procedural generation may remain as tooling or later endless-mode infrastructure.

Campaign stage identity must come from designed wave sequences.

## Stage data model

Extend level data to support explicit incoming waves:

`waves: [ WaveSpec, WaveSpec, ... ]`

Each WaveSpec should define at minimum:
- occupied columns;
- block HP values;
- optional horizontal offsets only if geometry remains valid;
- optional deterministic +1 Ball pickup placement;
- optional tags/intent metadata for tooling (not player-facing).

Example conceptual shape:

`{ blocks: [{ col: 0, hp: 6 }, ...], pickupCol: 3, intent: 'single-bounce-entry' }`

Do not store pixel X positions when a canonical column index is sufficient.
Use `columnX(col)` as the single geometry source.

## Authoritative progression

`applyTurnResult()` should consume the next authored WaveSpec for campaign stages.

Rules:
- exactly one authored wave enters per completed volley while waves remain;
- waveIndex identifies the next/consumed authored wave deterministically;
- no generic ROW_PATTERNS generation is used for authored campaign stages;
- generated/procedural fallback may remain for explicit endless/tooling stages only;
- Preview, Solver, replay, and serialization must consume the same authored wave.

## Validation campaign: first five stages

Use the existing L01–L05 as a small authored teaching sequence.

### L01 — DIRECT
Teaching goal: understand visible future + direct destruction.

Design:
- low HP;
- obvious direct lanes;
- no required wall bounce;
- one easy +1 Ball opportunity;
- 3 incoming authored waves;
- low danger pressure.

Player lesson:
Different direct angles create visibly different outcomes.

### L02 — REFLECTION
Teaching goal: a wall bounce can outperform the direct path.

Design:
- center/front blocks reduce the value of straight shots;
- intentional side opening enables a strong single-wall reflection;
- edge geometry remains canonical;
- pickup may reward the reflected route;
- 3–4 authored waves.

Player lesson:
Use the wall as part of the route.

### L03 — DOUBLE REFLECTION
Teaching goal: plan a longer route through multiple rebounds.

Design:
- staggered blockers;
- a high-value pocket reachable through two meaningful reflections;
- direct path remains viable but inferior in a specific consequence dimension;
- 4 authored waves.

Player lesson:
The visually longer future may produce the stronger board state.

### L04 — MULTIPLE SOLUTIONS
Teaching goal: no single obvious answer.

Design at least two genuinely viable futures:
- Future A: more immediate destruction;
- Future B: less destruction but +1 Ball / better next launcher / safer next board;
- neither should dominate in every dimension;
- 4 authored waves.

Player lesson:
`best` depends on what future you value.

### L05 — PRECISION
Teaching goal: route quality and narrow access matter.

Design:
- tighter but still STANDARD-ball-valid corridors;
- small angle differences produce meaningfully different routes;
- danger pressure is higher;
- future echo becomes useful to compare consequences;
- 4–5 authored waves.

Do NOT require variable-size balls yet.

Player lesson:
Precision changes the future, not just the hit count.

## HP design rule

Remove `turn * 2` as the primary campaign HP model.

Campaign HP should be authored per wave.

Use simple readable values in the validation sequence.
Difficulty should emerge first from geometry and consequence trade-offs, then from HP inflation.

Do not use high HP merely to make a stage last longer.

## Ball economy

Starting ball counts should be reviewed rather than automatically increasing 18→20→22→24.

For the validation sequence:
- prefer a common or near-common starting baseline unless a stage specifically tests ball economy;
- authored pickups should create progression inside the stage;
- pickup placement must create an actual route trade-off rather than a free reward.

Do not lock final production counts yet.

## Pickup design rule

Campaign pickups should be authored per wave rather than globally spawned every N rows.

`pickupSpawnCadence` remains useful for procedural/endless modes, not primary campaign stages.

A pickup is valuable only when collecting it changes route choice.

## Stage length

Do not force all stages to have the same number of waves.

Wave count should support the teaching goal.

Validation target:
- L01: 3
- L02: 3–4
- L03: 4
- L04: 4
- L05: 4–5

Exact values may be chosen during implementation if justified by the authored layouts.

## Solver/design instrumentation

For each authored stage, add a non-player-facing analysis report or test helper that can sample candidate angles and report:
- damage;
- destroyed;
- pickups;
- next launcher X;
- stageStatus;
- danger margin;
- candidate diversity / number of materially distinct futures.

Do NOT show a BEST label to the player.

The purpose is to validate that the intended teaching problem actually exists.

## Danger margin metric

Add an internal derived metric:

`dangerMargin = dangerLineY - max(activeBlockBottomY)`

for `nextGameState`.

This is tooling/solver metadata, not default HUD.

It lets us distinguish futures that deal similar damage but leave different board pressure.

## Tests

Add tests proving:
1. campaign stages consume authored waves exactly;
2. L01–L05 do not use generic procedural ROW_PATTERNS for campaign incoming waves;
3. authored wave geometry uses canonical columnX;
4. authored pickup placement is deterministic;
5. no additional row enters after final authored wave;
6. Preview/gameplay/solver receive identical authored next wave;
7. serialize/load preserves authored wave position;
8. dangerMargin derives identically from nextGameState;
9. stage-specific wave counts are respected;
10. procedural fallback remains available only when explicitly configured;
11. all previous regression tests remain green.

## Do not change
- collision physics;
- legal 5°–175° aim domain;
- timeout semantics;
- board geometry;
- launcher-baseline exit;
- return point;
- ball pickup collision rules;
- finite-wave status semantics;
- Future Echo presentation language;
- Minimal Precision visual direction.

## Acceptance

This pass is accepted when L01–L05 stop behaving like five skins over one generator and instead form a deliberately authored learning sequence with distinct strategic problems.