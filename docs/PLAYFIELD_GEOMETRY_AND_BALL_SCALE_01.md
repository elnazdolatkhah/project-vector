# PROJECT VECTOR — Playfield Geometry & Ball Scale Design 01

Status: DESIGN DECISION + EXECUTION BRIEF
Date: 2026-10-26

## Why this pass exists

Three geometry issues/opportunities have been identified from live play:

1. Edge rows currently leave narrow side channels between blocks and walls. These channels can create unintended repetitive wall-scrape destruction and reduce meaningful angle choice.
2. Balls currently remain active until the physical bottom of the 1280-unit canvas, even though the launcher sits at y=1180. This creates dead visual travel below the actual launch/return line.
3. Variable ball radius could become a future strategic mechanic: small balls access narrow routes; large balls sacrifice access for stronger impact.

These must be separated into:
- immediate geometry corrections;
- future strategic ball-size system.

# PART A — EDGE-SEALED PLAYFIELD GEOMETRY

## Problem

Current canonical row geometry uses:
- canvas width = 720
- visual wall inset ≈ 8
- block startX = 34
- block width = 70
- column spacing = 82

This leaves playable side channels beside full-width rows.

With ballRadius = 6, the ball center can legally travel through a corridor between the wall collision boundary and the expanded edge block boundary.

This means a full row that visually appears to guard the width does not actually seal the side route.

## Decision

A fully occupied canonical row must seal against the playable left and right walls for the STANDARD ball.

This does NOT mean every generated row must contain edge blocks.
If an edge column is intentionally empty, an edge corridor is a deliberate tactical opening.

Therefore:
- occupied edge columns seal to the wall;
- missing edge columns create intentional open routes;
- accidental micro-corridors caused by layout padding are forbidden.

## Architecture

Define canonical horizontal board geometry from one source of truth.

Do not keep independent hard-coded values in `levels.js` and `PROGRESSION_CONFIG`.

Create/derive:
- playableLeft
- playableRight
- columnCount
- interColumnGap
- blockWidth
- columnX(col)

All level fixtures and generated rows must use the same helper.

Recommended starting geometry:
- playableLeft = 8
- playableRight = 712
- columnCount = 8
- interColumnGap = 12
- blockWidth = (playableWidth - 7 * gap) / 8 = 77.5

This is a calibration target, not a requirement to preserve current block width 70.
The implementation may choose integer/subpixel-safe equivalents provided a fully occupied row seals both edges with no legal standard-ball side corridor.

## Required tests

1. Full 8-column row has no traversable side corridor for standard radius.
2. Left edge block prevents wall-scrape passage.
3. Right edge block prevents wall-scrape passage.
4. An intentionally empty edge column DOES create a valid route.
5. Preview and live simulation agree on edge-path accessibility.

# PART B — RETURN / EXIT LINE = LAUNCHER BASELINE

## Problem

Current bottom exit condition is tied to canvasHeight.
The launcher sits above it at y=1180.

This means returning balls continue through a visually irrelevant lower strip before exiting and determining return position.

## Decision

The authoritative return/exit line for a volley should be the launcher baseline, not the physical bottom of the canvas.

Canonical rule:
- launch line Y = launcher.y
- downward-moving balls exit when their center reaches/crosses that launch line from above;
- first exit at that line determines next-turn launcher X;
- later balls visually converge/collect at that same baseline.

The canvas may still extend below the launch line for HUD/safe-area presentation, but that region is not active ball-flight space.

## Important geometry rule

The exit test must be direction-sensitive and must not instantly exit a newly spawned ball sitting on the launcher line.

At spawn:
- ball starts at launcher.y;
- launch velocity is upward;
- it remains active.

Exit only when the ball later returns downward and crosses the baseline.

## Benefits

- removes dead travel;
- tightens volley rhythm;
- makes the return point visually obvious;
- aligns physics with what the player perceives as the floor of the playfield;
- creates more room below for minimal HUD without mixing UI and physics.

## Required tests

1. Newly spawned upward-moving ball does not immediately exit.
2. Downward ball crossing launcher baseline exits deterministically.
3. First baseline crossing determines next launcher X.
4. Ball cannot continue below baseline as active physics.
5. Preview/live/solver parity remains exact.
6. Return-point behavior near left/right boundaries remains clamped correctly.

# PART C — VARIABLE BALL SCALE AS STRATEGIC SYSTEM (DESIGN CANDIDATE)

## Product idea

Ball radius can become a deliberate strategic choice rather than a cosmetic modifier.

Core trade-off:

SMALL BALL
- accesses tighter corridors;
- improves precision / route access;
- lower destructive efficiency.

STANDARD BALL
- balanced baseline;
- current canonical behavior.

LARGE BALL
- cannot enter narrow passages;
- potentially higher destructive power / multi-contact value;
- trades access for force.

## Why this fits PROJECT VECTOR

The mechanic creates qualitatively different visible futures, not merely stronger/weaker numbers.

Example:
- a small-ball future reaches a protected pickup through a narrow route;
- a large-ball future cannot enter that route but destroys a dense front cluster faster.

This supports the product philosophy: different futures are meaningfully different, not just higher-scoring.

## Critical warning

Do NOT implement variable radius yet as an ad-hoc power-up.

Changing radius affects:
- wall collision bounds;
- swept circle-vs-AABB expansion;
- pickup intersection threshold;
- launcher clamping;
- corridor accessibility;
- solver search outcomes;
- Future Preview;
- level geometry validation.

It must be introduced as an explicit per-turn BallProfile / shot-mode system with full deterministic parity.

## Recommended future model

Use discrete ball classes, not a continuous radius slider.

Candidate v1 classes:
- SMALL: radius 4
- STANDARD: radius 6
- LARGE: radius 9

Do not lock damage values yet.

Possible later force models to evaluate:
A. Large ball deals 2 HP per block contact.
B. Large ball has limited pierce / momentum through one weak block.
C. Large ball keeps 1 damage but collects a larger contact footprint — probably insufficient as a strategic reward.

Small ball should not simply be 'worse damage'; its reward is access to routes unavailable to standard/large balls.

## Future test requirements

When implemented, test:
- same state + angle + BallProfile = same result;
- different radii change accessibility predictably;
- Preview/Gameplay/Solver use identical profile;
- launcher clamps with selected radius;
- pickup intersection respects selected radius;
- edge-sealed rows remain sealed for STANDARD and LARGE while intentionally narrow passages may admit SMALL only.

# PART D — PRIORITY

Implement NOW:
1. canonical edge-sealed board geometry;
2. launcher-baseline return/exit line;
3. regression tests and documentation.

Record but DEFER:
4. variable ball scale / BallProfile system.

Do not combine Part C into the immediate implementation pass.

# Acceptance

This geometry pass is accepted when:
- accidental edge micro-corridors are gone;
- intentional empty-edge routes still work;
- balls return/exit at the launcher baseline;
- no ball flies through dead space below the launcher;
- first-return launcher behavior remains deterministic;
- all Future Preview / Gameplay / Solver parity tests remain green;
- no unrelated gameplay system is introduced.