# Migration Notes — v1

## What this package fixes
The previous prototype accumulated concept, physics, solver, future preview, rendering, mobile UI, and case-study experiments in one HTML file. That made it too easy for a visual iteration to accidentally alter gameplay assumptions.

This migration separates those responsibilities and introduces a literal `simulateTurn()` public contract.

## Canonical player aim domain: full upward hemisphere (1°–179°)
The canonical player aim domain is officially established as the full upward hemisphere (1°–179°), allowing direct mobile exploration of both rightward (1°–89°) and leftward (91°–179°) trajectories as well as vertical shots (90°). The earlier 1°–89° restriction is formally superseded.

## Return-point-dependent launcher position
The first ball to exit through the bottom determines the horizontal launcher origin for the next turn. Next-turn launcher Y remains fixed at the baseline. This rule is authoritative game state owned by `Simulation.result()` and transitioned via `applyTurnResult()`, serialized and reproducible across gameplay, Future Preview, solver, and tests.

## Case-study status
The dense level arrangements in `src/levels/levels.js` are migration fixtures inspired by the mobile screen-density lesson from Bricks Breaker Quest. They are not claimed as final level design and should be replaced/validated later.

## Legacy files
`legacy/` preserves the original prototype and the latest pre-migration Future Engine prototype for traceability. Do not continue feature work directly in those files.
