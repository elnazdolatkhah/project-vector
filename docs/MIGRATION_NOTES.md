# Migration Notes — v1

## What this package fixes
The previous prototype accumulated concept, physics, solver, future preview, rendering, mobile UI, and case-study experiments in one HTML file. That made it too easy for a visual iteration to accidentally alter gameplay assumptions.

This migration separates those responsibilities and introduces a literal `simulateTurn()` public contract.

## Canonical player aim domain: full upward hemisphere (1°–179°)
The canonical player aim domain is officially established as the full upward hemisphere (1°–179°), allowing direct mobile exploration of both rightward (1°–89°) and leftward (91°–179°) trajectories as well as vertical shots (90°). The earlier 1°–89° restriction is formally superseded.

## Return-point-dependent launcher position
The first ball to exit through the bottom determines the horizontal launcher origin for the next turn. Next-turn launcher Y remains fixed at the baseline. This rule is authoritative game state owned by `Simulation.result()` and transitioned via `applyTurnResult()`, serialized and reproducible across gameplay, Future Preview, solver, and tests.

## Board Progression / Row Descent v1 (schemaVersion 1.1)
Each committed volley advances the game state deterministically:
1. Volley shot consequences resolve; destroyed blocks do not descend and are removed.
2. The first bottom exit determines next-turn launcher X.
3. All surviving active blocks descend by exactly one row-step (`ROW_STEP = 68`).
4. A deterministic top row is generated at `TOP_ROW_Y = 220` with stable IDs (`gen_r{nextRowIndex}_c{col}`) and deterministic HP.
5. Danger line evaluation: If any active block's bottom reaches or crosses `DANGER_LINE_Y = 1060` (`block.y + block.height >= 1060`), the authoritative status becomes terminal (`isGameOver: true`), blocking further shots.
6. The full authoritative future of a shot includes the next board state (`nextGameState`, `isGameOver`), derived by `FuturePreview` and `Solver` using the identical `applyTurnResult()` pipeline.
7. Presentation visually interpolates block descent and top row entrance over 220ms, while authoritative state is updated immediately.

## Case-study status
The dense level arrangements in `src/levels/levels.js` are migration fixtures inspired by the mobile screen-density lesson from Bricks Breaker Quest. They are not claimed as final level design and should be replaced/validated later.

## Legacy files
`legacy/` preserves the original prototype and the latest pre-migration Future Engine prototype for traceability. Do not continue feature work directly in those files.

