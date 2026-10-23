# Migration Notes — v1

## What this package fixes
The previous prototype accumulated concept, physics, solver, future preview, rendering, mobile UI, and case-study experiments in one HTML file. That made it too easy for a visual iteration to accidentally alter gameplay assumptions.

This migration separates those responsibilities and introduces a literal `simulateTurn()` public contract.

## Important correction: angle domain
The Master Spec defines 1°–89°. A later prototype expanded this to 1°–179° without a formally accepted design decision. The migration baseline restores 1°–89° and flags the wider upward hemisphere as a future design decision rather than silently treating it as canonical.

## Case-study status
The dense level arrangements in `src/levels/levels.js` are migration fixtures inspired by the mobile screen-density lesson from Bricks Breaker Quest. They are not claimed as final level design and should be replaced/validated later.

## Legacy files
`legacy/` preserves the original prototype and the latest pre-migration Future Engine prototype for traceability. Do not continue feature work directly in those files.
